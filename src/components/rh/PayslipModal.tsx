import React, { useMemo, useEffect, useState } from 'react';
import { X, Printer, Download, CheckCircle2, User, Building, Calendar, DollarSign, FileText, CreditCard, CalendarX, AlertCircle, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';
import { PayrollRecord, Employee, CompanyProfile, SalaryAdvance, AbsenceRecord, ServiceOrder } from '../../types';
import { formatCurrencyBRL, formatDateBR, getStoredServices, getStoredAbsences, getStoredSalaryAdvances } from '../../lib/storage';
import { PrintReportFooter } from '../common/PrintReportFooter';
import { formatCPF, formatEmployeeAdmissionDate, formatEmployeeBankDeposit, getEmployeeMonthCommissions, EmployeeMonthCommissions } from './payrollHelpers';

interface PayslipModalProps {
  payroll: PayrollRecord | null;
  employee?: Employee;
  companyProfile: CompanyProfile;
  isOpen: boolean;
  onClose: () => void;
  // Opcionais para receber listas diretamente ou consultar do storage em tempo real
  advances?: SalaryAdvance[];
  absences?: AbsenceRecord[];
  services?: ServiceOrder[];
  allEmployees?: Employee[];
  commissionsInfo?: EmployeeMonthCommissions | null;
}

export const PayslipModal: React.FC<PayslipModalProps> = ({
  payroll,
  employee,
  companyProfile,
  isOpen,
  onClose,
  advances,
  absences,
  services,
  allEmployees,
  commissionsInfo,
}) => {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  useEffect(() => {
    if (!isOpen || !payroll) return;

    document.body.classList.add('has-payslip-open');
    const handleBeforePrint = () => {
      document.body.classList.add('printing-payslip');
    };
    const handleAfterPrint = () => {
      document.body.classList.remove('printing-payslip');
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      document.body.classList.remove('has-payslip-open');
      document.body.classList.remove('printing-payslip');
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [isOpen, payroll]);

  // Dados Institucionais da Empresa
  const tradeName =
    companyProfile?.tradeName ||
    companyProfile?.companyName ||
    companyProfile?.corporateName ||
    'SILAGEM ZÉ BUSCA-PÉ';

  const corporateName =
    companyProfile?.corporateName && companyProfile.corporateName !== tradeName
      ? companyProfile.corporateName
      : null;

  const cnpj = companyProfile?.cnpjCpf || (companyProfile as any)?.cnpj || '';

  const fullCompanyAddress = useMemo(() => {
    const parts: string[] = [];
    if (companyProfile?.address) {
      let addr = companyProfile.address;
      if (companyProfile.number) addr += `, nº ${companyProfile.number}`;
      if (companyProfile.neighborhood) addr += ` - Bairro ${companyProfile.neighborhood}`;
      parts.push(addr);
    }
    if (companyProfile?.city) {
      parts.push(`${companyProfile.city}${companyProfile.state ? `/${companyProfile.state}` : ''}`);
    }
    if (companyProfile?.zipCode) {
      parts.push(`CEP: ${companyProfile.zipCode}`);
    }
    return parts.join(' • ');
  }, [companyProfile]);

  // Identificação do Documento (Lado Direito)
  const docNumber = useMemo(() => {
    if (!payroll?.referenceMonth) return '01';
    const formattedRef = payroll.referenceMonth.includes('/')
      ? payroll.referenceMonth.split('/').reverse().join('/')
      : payroll.referenceMonth;
    return `HOL-${formattedRef}`;
  }, [payroll?.referenceMonth]);

  const issueDate = useMemo(() => {
    if (payroll?.paymentDate) return formatDateBR(payroll.paymentDate);
    const today = new Date().toISOString().split('T')[0];
    return formatDateBR(today);
  }, [payroll?.paymentDate]);

  const contractRegime = useMemo(() => {
    const type = employee?.registrationType || employee?.contractType;
    if (!type) return 'CLT (REGISTRADO)';
    const upper = type.toUpperCase().trim();
    if (upper === 'CLT' || upper === 'FUNCIONÁRIO') {
      return 'CLT (REGISTRADO)';
    }
    if (upper.includes('DIARISTA') || upper.includes('SAFRISTA')) {
      return 'DIARISTA / SAFRISTA';
    }
    if (upper.includes('PRESTADOR')) {
      return 'PRESTADOR DE SERVIÇO';
    }
    return upper;
  }, [employee]);

  // 1. Apuração detalhada das Ordens de Serviço / Comissões
  const resolvedCommissions = useMemo(() => {
    if (!payroll) return { totalCommission: 0, servicesCount: 0, breakdown: [] };
    if (commissionsInfo) return commissionsInfo;
    const srvs = services || getStoredServices();
    const emps = allEmployees || (employee ? [employee] : []);
    return getEmployeeMonthCommissions(payroll.employeeId, payroll.referenceMonth, srvs, emps);
  }, [commissionsInfo, services, allEmployees, employee, payroll?.employeeId, payroll?.referenceMonth]);

  // 2. Apuração detalhada dos Vales / Adiantamentos
  const resolvedAdvances = useMemo(() => {
    if (!payroll) return [];
    const list = advances || getStoredSalaryAdvances();
    return list.filter(
      a => a.employeeId === payroll.employeeId &&
           a.referenceMonth === payroll.referenceMonth &&
           (a.status as string) !== 'cancelado'
    );
  }, [advances, payroll?.employeeId, payroll?.referenceMonth]);

  // 3. Apuração detalhada das Faltas e Ocorrências
  const resolvedAbsences = useMemo(() => {
    if (!payroll) return [];
    const list = absences || getStoredAbsences();
    return list.filter(a => {
      if (a.employeeId !== payroll.employeeId) return false;
      if (a.status === 'abonada') return false;
      if (a.discountPayroll === false) return false;
      if (a.referenceMonth) return a.referenceMonth === payroll.referenceMonth;
      if (a.date) {
        const [y, m] = a.date.split('-');
        return `${m}/${y}` === payroll.referenceMonth;
      }
      return false;
    });
  }, [absences, payroll?.employeeId, payroll?.referenceMonth]);

  // Safe early exit AFTER all hooks are called
  if (!isOpen || !payroll) return null;

  const handleDownloadPDF = async () => {
    if (!payroll) return;
    const target = document.getElementById('recibo-holerite-branco');
    if (!target) {
      console.warn('Elemento #recibo-holerite-branco não encontrado para exportação');
      window.print();
      return;
    }

    try {
      setIsGeneratingPdf(true);

      // Padronização do nome do arquivo (Ex: "Holerite_PEDRO_SILVEIRA_09_2026.pdf")
      const cleanName = (payroll.employeeName || 'COLABORADOR')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .trim()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

      let cleanMonth = (payroll.referenceMonth || '').trim();
      if (cleanMonth.includes('/')) {
        cleanMonth = cleanMonth.replace(/\//g, '_');
      } else if (cleanMonth.includes('-')) {
        const parts = cleanMonth.split('-');
        if (parts.length === 2 && parts[0].length === 4) {
          cleanMonth = `${parts[1]}_${parts[0]}`;
        } else {
          cleanMonth = cleanMonth.replace(/-/g, '_');
        }
      } else if (!cleanMonth) {
        cleanMonth = '09_2026';
      }

      const filename = `Holerite_${cleanName}_${cleanMonth}.pdf`;

      // Captura o contêiner com qualidade nítida para impressão
      const canvas = await html2canvas(target, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          clonedDoc.documentElement.classList.remove('dark');
          clonedDoc.body.classList.remove('dark');
          const clonedEl = clonedDoc.getElementById('recibo-holerite-branco');
          if (clonedEl) {
            clonedEl.classList.remove('dark:bg-stone-900', 'dark:text-stone-100');
            clonedEl.style.backgroundColor = '#ffffff';
            clonedEl.style.color = '#1c1917';
          }
        },
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.98);

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth(); // 210mm
      const pdfHeight = pdf.internal.pageSize.getHeight(); // 297mm

      const imgProps = pdf.getImageProperties(imgData);
      const marginX = 8;
      const marginY = 8;
      const printableWidth = pdfWidth - marginX * 2;
      const imgHeight = (imgProps.height * printableWidth) / imgProps.width;

      let heightLeft = imgHeight;
      let position = marginY;

      // Primeira página
      pdf.addImage(imgData, 'JPEG', marginX, position, printableWidth, imgHeight);
      heightLeft -= (pdfHeight - marginY * 2);

      // Se houver overflow e precisar de mais páginas
      while (heightLeft > 0) {
        position = heightLeft - imgHeight + marginY;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', marginX, position, printableWidth, imgHeight);
        heightLeft -= (pdfHeight - marginY * 2);
      }

      pdf.save(filename);
    } catch (error) {
      console.error('Erro ao gerar documento PDF do holerite:', error);
      try {
        window.print();
      } catch (_) {}
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const totalEarnings = payroll.baseSalary + (payroll.overtimeAmount || 0) + (payroll.bonusAmount || 0) + (payroll.commissionAmount || 0);
  const totalDiscounts = payroll.inssDiscount + payroll.advancesDiscount + payroll.otherDiscounts;

  // Verifica se há qualquer lançamento detalhado ou observação para exibir a seção de conferência
  const hasDetailedBreakdown = 
    resolvedCommissions.breakdown.length > 0 || 
    resolvedAdvances.length > 0 || 
    resolvedAbsences.length > 0 || 
    Boolean(payroll.notes && payroll.notes.trim());

  return (
    <div 
      id="printable-payslip-overlay"
      className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto print:p-0 print:m-0 print:bg-white print:fixed print:top-0 print:left-0 print:right-0 print:w-full print:inset-0 print:z-[99999] print:overflow-visible"
    >
      <div 
        id="printable-payslip-card"
        className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150 print:top-0 print:left-0 print:max-w-none print:w-full print:m-0 print:p-0 print:shadow-none print:border-none print:rounded-none print:bg-white"
      >
        
        {/* Modal Action Header (Non-printable) */}
        <div className="print:hidden flex items-center justify-between px-5 py-3.5 bg-stone-50 dark:bg-stone-800/80 border-b border-stone-200 dark:border-stone-800">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-bold text-stone-900 dark:text-stone-100">
              Demonstrativo de Pagamento de Salário (Holerite)
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-[#0963cb]/10 text-[#0963cb]">
              {payroll.referenceMonth}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              id="btn-print-payslip"
              onClick={handleDownloadPDF}
              disabled={isGeneratingPdf}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#0963cb] text-white text-xs font-bold hover:bg-blue-700 active:scale-95 transition cursor-pointer shadow-xs disabled:opacity-75 disabled:cursor-not-allowed"
              title="Baixar Holerite em PDF"
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Gerando PDF...</span>
                </>
              ) : (
                <>
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir / PDF</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-lg hover:bg-stone-200 dark:hover:bg-stone-700 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Holerite Content */}
        <div className="p-6 sm:p-8 space-y-5 text-stone-900 dark:text-stone-100 bg-white dark:bg-stone-900 print:p-2" id="recibo-holerite-branco">
          
          {/* ========================================================================= */}
          {/* CABEÇALHO PADRÃO ORDEM DE SERVIÇO (2 COLUNAS JUSTIFY-BETWEEN)             */}
          {/* ========================================================================= */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 dark:border-stone-700 pb-3 mb-2 gap-4">
            {/* LADO ESQUERDO: Dados da Empresa (Logo + Nome Marcante + Badge + Dados Cadastrais) */}
            <div className="flex items-start gap-3 flex-1 min-w-0">
              {/* Ícone / Logo quadrado da empresa */}
              <div className="w-14 h-14 min-w-[56px] max-w-[56px] rounded-lg border border-slate-200 dark:border-stone-700 bg-slate-50 dark:bg-stone-800 flex items-center justify-center overflow-hidden p-1 shrink-0 shadow-2xs">
                {companyProfile?.logoUrl ? (
                  <img
                    src={companyProfile.logoUrl}
                    alt={tradeName}
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full bg-blue-50 dark:bg-stone-800 flex flex-col items-center justify-center text-[#0963cb] dark:text-blue-400 p-0.5 rounded">
                    <Building className="w-6 h-6 stroke-[1.8]" />
                    <span className="text-[8px] font-black uppercase tracking-wider mt-0.5">ERP</span>
                  </div>
                )}
              </div>

              {/* Dados Institucionais */}
              <div className="space-y-0.5 flex-1 min-w-0">
                {/* Nome principal em negrito marcante + Badge descritiva cinza/azul clara */}
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-stone-100 uppercase truncate font-['Outfit']">
                    {tradeName}
                  </h1>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border shrink-0 bg-blue-50 text-[#0963cb] border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60 tracking-wider">
                    DEMONSTRATIVO DE SALÁRIO
                  </span>
                </div>

                {/* Razão Social */}
                {corporateName && (
                  <p className="text-[11px] text-slate-700 dark:text-stone-300 font-semibold truncate">
                    Razão Social: <span className="text-slate-900 dark:text-stone-100 font-bold">{corporateName}</span>
                  </p>
                )}

                {/* Informações cadastrais em fonte pequena (text-xs) e cor cinza escura */}
                <div className="text-xs text-slate-600 dark:text-stone-400 leading-tight space-y-0.5 pt-0.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    {cnpj && (
                      <span>
                        <strong className="text-slate-800 dark:text-stone-200">CNPJ/CPF:</strong> {cnpj}
                      </span>
                    )}
                    {companyProfile?.stateRegistration && (
                      <span>
                        • <strong className="text-slate-800 dark:text-stone-200">IE:</strong> {companyProfile.stateRegistration}
                      </span>
                    )}
                    {companyProfile?.phone && (
                      <span>
                        • <strong className="text-slate-800 dark:text-stone-200">Contato:</strong> {companyProfile.phone}
                      </span>
                    )}
                    {companyProfile?.email && (
                      <span>
                        • <strong className="text-slate-800 dark:text-stone-200">E-mail:</strong> {companyProfile.email}
                      </span>
                    )}
                  </div>
                  {fullCompanyAddress && (
                    <div className="truncate text-[11px] text-slate-500 dark:text-stone-400">
                      <strong className="text-slate-700 dark:text-stone-300">Endereço:</strong> {fullCompanyAddress}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* LADO DIREITO: Identificação do Documento */}
            <div className="text-right space-y-0.5 shrink-0 min-w-[170px] pt-0.5">
              <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-stone-100 tracking-tight uppercase font-['Outfit']">
                RECIBO DE PAGAMENTO Nº {docNumber}
              </p>
              <p className="text-xs text-slate-600 dark:text-stone-400">
                Data da Emissão: <strong className="text-slate-900 dark:text-stone-100">{issueDate}</strong>
              </p>
              <p className="text-xs text-slate-600 dark:text-stone-400">
                Referência: <strong className="text-[#0963cb] dark:text-blue-400 font-bold">{payroll.referenceMonth}</strong>
              </p>
              <p className="text-[11px] text-slate-500 dark:text-stone-400">
                Regime: <strong className="text-slate-800 dark:text-stone-200 uppercase">{contractRegime}</strong>
              </p>
            </div>
          </div>

          {/* Dados Cadastrais do Empregado Enriquecidos (Bloco Compacto e Alinhado) */}
          <div className="border border-stone-300 dark:border-stone-700 rounded-lg p-2 sm:p-2.5 print:p-1.5 my-1 sm:my-1.5 print:my-0.5 bg-stone-50/50 dark:bg-stone-800/30">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-1 sm:gap-y-1.5 print:gap-y-0.5 print:gap-x-2 text-xs">
              <div>
                <span className="text-stone-500 block text-[9.5px] sm:text-[10px] print:text-[8.5px] font-bold leading-tight">Colaborador:</span>
                <span className="font-bold text-stone-900 dark:text-stone-100 text-[11px] sm:text-xs print:text-[9.5px] block leading-tight truncate">{payroll.employeeName}</span>
              </div>
              <div>
                <span className="text-stone-500 block text-[9.5px] sm:text-[10px] print:text-[8.5px] font-bold leading-tight">Função / Cargo:</span>
                <span className="font-semibold text-stone-800 dark:text-stone-200 text-[11px] sm:text-xs print:text-[9.5px] block leading-tight truncate">{payroll.employeeRole}</span>
              </div>
              <div>
                <span className="text-stone-500 block text-[9.5px] sm:text-[10px] print:text-[8.5px] font-bold leading-tight">CPF:</span>
                <span className="font-semibold text-stone-800 dark:text-stone-200 text-[11px] sm:text-xs print:text-[9.5px] block leading-tight">
                  {formatCPF(employee?.cpf)}
                </span>
              </div>
              <div>
                <span className="text-stone-500 block text-[9.5px] sm:text-[10px] print:text-[8.5px] font-bold leading-tight">Data de Admissão:</span>
                <span className="font-semibold text-stone-800 dark:text-stone-200 text-[11px] sm:text-xs print:text-[9.5px] block leading-tight">
                  {formatEmployeeAdmissionDate(employee?.admissionDate)}
                </span>
              </div>
              <div>
                <span className="text-stone-500 block text-[9.5px] sm:text-[10px] print:text-[8.5px] font-bold leading-tight">Mês Referência:</span>
                <span className="font-bold text-[#0963cb] text-[11px] sm:text-xs print:text-[9.5px] block leading-tight">{payroll.referenceMonth}</span>
              </div>
              <div>
                <span className="text-stone-500 block text-[9.5px] sm:text-[10px] print:text-[8.5px] font-bold leading-tight">Regime / Vínculo:</span>
                <span className="font-semibold text-stone-800 dark:text-stone-200 text-[11px] sm:text-xs print:text-[9.5px] block leading-tight">
                  {employee?.contractType || 'CLT'}
                </span>
              </div>
              <div className="sm:col-span-3 lg:col-span-2">
                <span className="text-stone-500 block text-[9.5px] sm:text-[10px] print:text-[8.5px] font-bold leading-tight">Banco para Depósito:</span>
                <span className="font-bold text-stone-800 dark:text-stone-200 text-[11px] sm:text-xs print:text-[9.5px] truncate block leading-tight" title={formatEmployeeBankDeposit(employee)}>
                  {formatEmployeeBankDeposit(employee)}
                </span>
              </div>
            </div>
          </div>

          {/* Tabela de Itens (Proventos e Descontos) */}
          <div className="border border-stone-300 dark:border-stone-700 rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-stone-100 dark:bg-stone-800 text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase border-b border-stone-300 dark:border-stone-700">
                <tr>
                  <th className="py-2.5 px-3 text-left">Cód.</th>
                  <th className="py-2.5 px-3 text-left">Descrição da Verba</th>
                  <th className="py-2.5 px-3 text-center">Ref.</th>
                  <th className="py-2.5 px-3 text-right">Vencimentos (R$)</th>
                  <th className="py-2.5 px-3 text-right">Descontos (R$)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
                <tr>
                  <td className="py-2 px-3 text-stone-400">001</td>
                  <td className="py-2 px-3 font-semibold text-stone-800 dark:text-stone-200">Salário Base Mensal</td>
                  <td className="py-2 px-3 text-center text-stone-500">30d</td>
                  <td className="py-2 px-3 text-right font-medium text-emerald-600 dark:text-emerald-400">
                    {formatCurrencyBRL(payroll.baseSalary)}
                  </td>
                  <td className="py-2 px-3 text-right text-stone-400">-</td>
                </tr>

                {payroll.overtimeAmount > 0 && (
                  <tr>
                    <td className="py-2 px-3 text-stone-400">012</td>
                    <td className="py-2 px-3 font-semibold text-stone-800 dark:text-stone-200">
                      Horas Extras / Adicional Safra & Colheita
                    </td>
                    <td className="py-2 px-3 text-center text-stone-500">{payroll.overtimeHours ? `${payroll.overtimeHours}h` : '--'}</td>
                    <td className="py-2 px-3 text-right font-medium text-emerald-600 dark:text-emerald-400">
                      {formatCurrencyBRL(payroll.overtimeAmount)}
                    </td>
                    <td className="py-2 px-3 text-right text-stone-400">-</td>
                  </tr>
                )}

                {payroll.bonusAmount > 0 && (
                  <tr>
                    <td className="py-2 px-3 text-stone-400">024</td>
                    <td className="py-2 px-3 font-semibold text-stone-800 dark:text-stone-200">
                      Insalubridade / Bônus Produtividade
                    </td>
                    <td className="py-2 px-3 text-center text-stone-500">--</td>
                    <td className="py-2 px-3 text-right font-medium text-emerald-600 dark:text-emerald-400">
                      {formatCurrencyBRL(payroll.bonusAmount)}
                    </td>
                    <td className="py-2 px-3 text-right text-stone-400">-</td>
                  </tr>
                )}

                {(payroll.commissionAmount || 0) > 0 && (
                  <tr>
                    <td className="py-2 px-3 text-stone-400">035</td>
                    <td className="py-2 px-3 font-semibold text-stone-800 dark:text-stone-200">
                      Comissões Variáveis de Silagem / Produção
                    </td>
                    <td className="py-2 px-3 text-center text-stone-500">--</td>
                    <td className="py-2 px-3 text-right font-medium text-emerald-600 dark:text-emerald-400">
                      {formatCurrencyBRL(payroll.commissionAmount || 0)}
                    </td>
                    <td className="py-2 px-3 text-right text-stone-400">-</td>
                  </tr>
                )}

                {payroll.inssDiscount > 0 && (
                  <tr>
                    <td className="py-2 px-3 text-stone-400">101</td>
                    <td className="py-2 px-3 font-semibold text-stone-800 dark:text-stone-200">
                      Desconto Previdência Social (INSS)
                    </td>
                    <td className="py-2 px-3 text-center text-stone-500">Oficial</td>
                    <td className="py-2 px-3 text-right text-stone-400">-</td>
                    <td className="py-2 px-3 text-right font-medium text-rose-600 dark:text-rose-400">
                      {formatCurrencyBRL(payroll.inssDiscount)}
                    </td>
                  </tr>
                )}

                {payroll.advancesDiscount > 0 && (
                  <tr>
                    <td className="py-2 px-3 text-stone-400">110</td>
                    <td className="py-2 px-3 font-semibold text-stone-800 dark:text-stone-200">
                      Adiantamento Salarial / Vales do Mês
                    </td>
                    <td className="py-2 px-3 text-center text-stone-500">Vales</td>
                    <td className="py-2 px-3 text-right text-stone-400">-</td>
                    <td className="py-2 px-3 text-right font-medium text-rose-600 dark:text-rose-400">
                      {formatCurrencyBRL(payroll.advancesDiscount)}
                    </td>
                  </tr>
                )}

                {payroll.otherDiscounts > 0 && (
                  <tr>
                    <td className="py-2 px-3 text-stone-400">120</td>
                    <td className="py-2 px-3 font-semibold text-stone-800 dark:text-stone-200">
                      Outros Descontos / Faltas / Farmácia
                    </td>
                    <td className="py-2 px-3 text-center text-stone-500">--</td>
                    <td className="py-2 px-3 text-right text-stone-400">-</td>
                    <td className="py-2 px-3 text-right font-medium text-rose-600 dark:text-rose-400">
                      {formatCurrencyBRL(payroll.otherDiscounts)}
                    </td>
                  </tr>
                )}
              </tbody>

              {/* Totais */}
              <tfoot className="bg-stone-50 dark:bg-stone-800/60 font-bold border-t border-stone-300 dark:border-stone-700">
                <tr>
                  <td colSpan={3} className="py-2.5 px-3 text-right text-stone-600 dark:text-stone-400">
                    Totais das Verbas:
                  </td>
                  <td className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400">
                    {formatCurrencyBRL(totalEarnings)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-rose-600 dark:text-rose-400">
                    {formatCurrencyBRL(totalDiscounts)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Resumo Líquido */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-stone-50 dark:bg-stone-800/50 border border-stone-300 dark:border-stone-700 rounded-xl p-4">
            <div>
              <span className="text-[11px] text-stone-500 dark:text-stone-400 block uppercase font-bold">
                Total Bruto de Proventos
              </span>
              <span className="text-sm font-bold text-stone-800 dark:text-stone-200">
                {formatCurrencyBRL(totalEarnings)}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-stone-500 dark:text-stone-400 block uppercase font-bold">
                Total de Deduções
              </span>
              <span className="text-sm font-bold text-rose-600 dark:text-rose-400">
                - {formatCurrencyBRL(totalDiscounts)}
              </span>
            </div>
            <div className="border-t sm:border-t-0 sm:border-l border-stone-300 dark:border-stone-700 pt-2 sm:pt-0 sm:pl-4">
              <span className="text-[11px] text-[#009688] block uppercase font-black tracking-wider">
                Valor Líquido a Receber
              </span>
              <span className="text-lg font-black text-[#009688]">
                {formatCurrencyBRL(payroll.netSalary)}
              </span>
            </div>
          </div>

          {/* Seção: DETALHAMENTO DOS LANÇAMENTOS (CONFERÊNCIA) */}
          {hasDetailedBreakdown && (
            <div className="border border-stone-300 dark:border-stone-700 rounded-xl p-3 sm:p-4 bg-stone-50/50 dark:bg-stone-800/20 space-y-3 print:p-2.5 print:space-y-2">
              <div className="flex items-center justify-between border-b border-stone-300 dark:border-stone-700 pb-1.5">
                <span className="text-[11px] font-black tracking-wider uppercase text-stone-800 dark:text-stone-200">
                  DETALHAMENTO DOS LANÇAMENTOS (CONFERÊNCIA)
                </span>
                <span className="text-[10px] text-stone-500 font-bold">
                  Competência: {payroll.referenceMonth}
                </span>
              </div>

              {/* Subbloco Comissões: Ordens de Serviço Integradas */}
              {resolvedCommissions.breakdown.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-blue-900 dark:text-blue-300 border-b border-blue-100 dark:border-stone-700/80 pb-0.5">
                    <span className="flex items-center space-x-1">
                      <FileText className="w-3 h-3 text-[#0963cb] shrink-0" />
                      <span>Ordens de Serviço Integradas ({resolvedCommissions.breakdown.length})</span>
                    </span>
                    <span className="font-extrabold text-[#0963cb] dark:text-sky-400 font-['Outfit']">
                      Subtotal: {formatCurrencyBRL(resolvedCommissions.total)}
                    </span>
                  </div>
                  <div className="space-y-1 pl-1">
                    {resolvedCommissions.breakdown.map((item, idx) => {
                      const cleanDesc = (item.formattedLine || item.description || '').replace(/\s*\(\s*cla?ss\s*\)/gi, '');
                      return (
                        <div 
                          key={item.serviceId ? `${item.serviceId}-${idx}` : idx}
                          className="text-[11px] leading-relaxed text-stone-800 dark:text-stone-200 border-b border-stone-200/60 dark:border-stone-800 pb-1 font-mono sm:font-sans"
                        >
                          {cleanDesc}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Subbloco Vales / Adiantamentos */}
              {resolvedAdvances.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-rose-950 dark:text-rose-300 border-b border-rose-100 dark:border-stone-700/80 pb-0.5">
                    <span className="flex items-center space-x-1">
                      <CreditCard className="w-3 h-3 text-rose-600 shrink-0" />
                      <span>Vales / Adiantamentos Integrados ({resolvedAdvances.length})</span>
                    </span>
                    <span className="font-extrabold text-rose-700 dark:text-rose-400 font-['Outfit']">
                      Subtotal: {formatCurrencyBRL(resolvedAdvances.reduce((sum, a) => sum + (Number(a.amount) || 0), 0))}
                    </span>
                  </div>
                  <div className="space-y-1 pl-1">
                    {resolvedAdvances.map((adv, idx) => {
                      const parcelLabel = adv.discountType === 'Parcelado' && adv.installmentNumber && adv.totalInstallments
                        ? `Parcela [${adv.installmentNumber}/${adv.totalInstallments}]`
                        : 'Parcela [1/1]';
                      const dateStr = formatDateBR(adv.date);
                      const resp = adv.responsibleUser || 'ADMINISTRADOR SISTEMA';
                      const reasonPart = adv.reason ? ` — Motivo: ${adv.reason}` : '';
                      return (
                        <div 
                          key={adv.id || idx}
                          className="text-[11px] leading-relaxed text-stone-800 dark:text-stone-200 border-b border-stone-200/60 dark:border-stone-800 pb-1 font-mono sm:font-sans flex flex-col sm:flex-row sm:items-center sm:justify-between"
                        >
                          <span>
                            {parcelLabel} — Data: {dateStr} — Responsável: {resp}{reasonPart} — Valor: -{formatCurrencyBRL(adv.amount)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Subbloco Faltas: Faltas Integradas do RH */}
              {resolvedAbsences.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-amber-950 dark:text-amber-300 border-b border-amber-100 dark:border-stone-700/80 pb-0.5">
                    <span className="flex items-center space-x-1">
                      <CalendarX className="w-3 h-3 text-amber-600 shrink-0" />
                      <span>Faltas Integradas do RH ({resolvedAbsences.length})</span>
                    </span>
                    <span className="font-extrabold text-amber-800 dark:text-amber-400 font-['Outfit']">
                      Subtotal: {formatCurrencyBRL(
                        resolvedAbsences.reduce((sum, a) => {
                          if (a.discountAmount !== undefined && a.discountAmount > 0) return sum + Number(a.discountAmount);
                          const daily = (payroll.baseSalary || 3500) / 30;
                          return sum + Math.round((daily * (a.daysCount || 1)) * 100) / 100;
                        }, 0)
                      )}
                    </span>
                  </div>
                  <div className="space-y-1 pl-1">
                    {resolvedAbsences.map((abs, idx) => {
                      const dateStr = formatDateBR(abs.date);
                      const reasonStr = abs.reason || `Falta ${abs.type || 'injustificada'} (${abs.daysCount || 1} dia${(abs.daysCount || 1) > 1 ? 's' : ''})`;
                      const itemDiscount = (abs.discountAmount && abs.discountAmount > 0)
                        ? abs.discountAmount
                        : Math.round((((payroll.baseSalary || 3500) / 30) * (abs.daysCount || 1)) * 100) / 100;
                      const obsPart = abs.notes ? ` — Obs: ${abs.notes}` : '';
                      return (
                        <div 
                          key={abs.id || idx}
                          className="text-[11px] leading-relaxed text-stone-800 dark:text-stone-200 border-b border-stone-200/60 dark:border-stone-800 pb-1 font-mono sm:font-sans flex flex-col sm:flex-row sm:items-center sm:justify-between"
                        >
                          <span>
                            Data: {dateStr} — Motivo: {reasonStr}{obsPart} — Valor: -{formatCurrencyBRL(itemDiscount)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Observações Gerais / Internas no rodapé do detalhamento */}
              {payroll.notes && payroll.notes.trim() && (
                <div className="pt-1.5 border-t border-stone-200 dark:border-stone-700/80 text-[11px] text-stone-700 dark:text-stone-300">
                  <span className="font-bold text-stone-900 dark:text-stone-100">Observações: </span>
                  <span>{payroll.notes}</span>
                </div>
              )}
            </div>
          )}

          {/* Rodapé Corporativo Padronizado */}
          <PrintReportFooter
            showSignatures={true}
            signatureLabels={[
              'Empregador / Departamento Pessoal',
              `Colaborador: ${payroll.employeeName}`
            ]}
            companyName={companyProfile.tradeName || companyProfile.corporateName || 'Silagem Fácil ERP'}
            authCode={`HOL-${payroll.id.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase()}`}
          />

        </div>

      </div>
    </div>
  );
};
