import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  CheckCircle2, 
  Clock, 
  FileText, 
  Trash2, 
  Edit2, 
  ChevronLeft, 
  ChevronRight, 
  DollarSign,
  Users,
  Sparkles,
  Printer,
  X,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Calendar,
  CreditCard,
  Landmark,
  Building2,
  ShieldAlert,
  ShieldCheck,
  CalendarX
} from 'lucide-react';
import { Employee, PayrollRecord, SalaryAdvance, ServiceOrder, AbsenceRecord } from '../../types';
import { formatCurrencyBRL, formatDateBR, getStoredServices, getStoredCompanyProfile, getStoredAbsences } from '../../lib/storage';
import { useConfirm } from '../../context/ConfirmContext';
import { 
  getEmployeeMonthCommissions, 
  EmployeeMonthCommissions,
  formatMoneyBRL,
  parseMoneyToFloat,
  formatCPF,
  formatEmployeeAdmissionDate,
  formatEmployeeBankDeposit
} from './payrollHelpers';
import { PayslipModal } from './PayslipModal';

// ==========================================
// COMPONENTE DE INPUT MONETÁRIO BRL (R$ 0.000,00)
// ==========================================
interface BrlCurrencyInputProps {
  id?: string;
  label: string;
  value: number;
  onChange: (val: number) => void;
  className?: string;
  inputClassName?: string;
  readOnly?: boolean;
  required?: boolean;
  title?: string;
  headerRight?: React.ReactNode;
}

const BrlCurrencyInput: React.FC<BrlCurrencyInputProps> = ({
  id,
  label,
  value,
  onChange,
  className = '',
  inputClassName = '',
  readOnly = false,
  required = false,
  title,
  headerRight,
}) => {
  const displayVal = formatMoneyBRL(value);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
    const num = parseMoneyToFloat(e.target.value);
    onChange(num);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (readOnly) return;
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim();
    if (!pasted) return;

    if (pasted.includes(',') && pasted.includes('.')) {
      const normalized = pasted.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
      const val = parseFloat(normalized);
      onChange(isNaN(val) ? 0 : Number(val.toFixed(2)));
    } else if (pasted.includes(',')) {
      const normalized = pasted.replace(/[^\d,]/g, '').replace(',', '.');
      const val = parseFloat(normalized);
      onChange(isNaN(val) ? 0 : Number(val.toFixed(2)));
    } else if (pasted.includes('.')) {
      const normalized = pasted.replace(/[^\d.]/g, '');
      const val = parseFloat(normalized);
      onChange(isNaN(val) ? 0 : Number(val.toFixed(2)));
    } else {
      const clean = pasted.replace(/\D/g, '');
      const val = parseInt(clean, 10);
      onChange(isNaN(val) ? 0 : Number((val / 100).toFixed(2)));
    }
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-1">
        <label htmlFor={id} className="block text-[11px] font-bold text-black dark:text-stone-200 truncate">
          {label}
        </label>
        {headerRight}
      </div>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          value={displayVal}
          onChange={handleChange}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          readOnly={readOnly}
          required={required}
          title={title}
          className={`w-full p-2.5 border border-stone-300 rounded-lg bg-white dark:bg-stone-800 text-black dark:text-white font-bold outline-none focus:ring-1 focus:ring-[#0963cb] text-xs sm:text-sm ${inputClassName}`}
        />
      </div>
    </div>
  );
};

// ==========================================
// REGRAS DE NEGÓCIO DA FOLHA DE PAGAMENTO
// ==========================================

// 1. Identificação de Motoristas e Vínculos Terceirizados
// (Regra: Terceirizados são geridos exclusivamente pelo módulo Financeiro - Acerto de Terceiros)
export const isThirdPartyDriver = (emp?: Partial<Employee>): boolean => {
  if (!emp) return false;
  const contract = (emp.contractType || '').toLowerCase().trim();
  const regType = (emp.registrationType || '').toLowerCase().trim();
  const role = (emp.role || '').toLowerCase().trim();

  // Vínculo explicitamente terceirizado
  const isTerceirizado = 
    contract.includes('terceiriz') || 
    regType.includes('terceiriz') || 
    role.includes('terceiriz') ||
    role.includes('terceiro') ||
    role.includes('freteiro');

  const isDriverOrTransport = 
    role.includes('motorista') || 
    role.includes('caminhão') || 
    role.includes('caminhao') ||
    regType.includes('motorista');

  // Motorista com vínculo terceirizado
  if (isDriverOrTransport && isTerceirizado) return true;
  // Qualquer registro cujo contrato seja Terceirizado
  if (contract === 'terceirizado' || contract.startsWith('terceiriz')) return true;
  if (role.includes('motorista terceirizado')) return true;

  return false;
};

// 1.2 Identificação de Agenciador (Comissões e repasses geridos exclusivamente pelo Financeiro)
export const isBrokerEmployee = (emp?: Partial<Employee>): boolean => {
  if (!emp) return false;
  const roleStr = (emp.role || '').toLowerCase();
  const rolesList = Array.isArray(emp.roles) ? emp.roles.map(r => r.toLowerCase()) : [];
  return roleStr.includes('agenciador') || rolesList.some(r => r.includes('agenciador'));
};

// 2. Identificação de Regime Registrado (CLT)
// (Regra: Desconto automático de INSS aplicado unicamente para quem tem registro CLT)
export const isCltContract = (emp?: Partial<Employee>): boolean => {
  if (!emp) return false;
  const contract = (emp.contractType || '').toLowerCase().trim();
  const regType = (emp.registrationType || '').toLowerCase().trim();

  // Regimes sem CLT: Prestador PJ, Diarista, Temporário, Terceirizado, Autônomo
  if (
    contract.includes('pj') || 
    contract.includes('prestador') || 
    contract.includes('diarista') || 
    contract.includes('informal') || 
    contract.includes('autônomo') || 
    contract.includes('autonomo') ||
    contract.includes('terceiriz') ||
    regType.includes('prestador') ||
    regType.includes('diarista')
  ) {
    return false;
  }

  // Registrado (CLT)
  if (
    contract.includes('registrado') || 
    contract.includes('clt') || 
    regType.includes('registrado') || 
    regType.includes('clt')
  ) {
    return true;
  }

  // Padrão default da empresa caso seja "Funcionário" e não especificado regime PJ/Diarista
  if (!contract && (regType === 'funcionário' || regType === 'funcionario')) {
    return true;
  }

  return false;
};

// 3. Cálculo automático do INSS (unicamente para CLT)
export const calculateAutomaticInss = (emp: Partial<Employee> | undefined, salary: number): number => {
  if (!isCltContract(emp)) {
    return 0; // SEM REGISTRO CLT: isento de cálculo automático de INSS no holerite
  }
  // Alíquota média rural/CLT ~8.5%, com teto da previdência de R$ 908,86
  const rate = 0.085;
  const inss = Math.round(salary * rate * 100) / 100;
  return Math.min(inss, 908.86);
};

interface PayrollTabProps {
  employees: Employee[];
  payrolls: PayrollRecord[];
  advances: SalaryAdvance[];
  absences?: AbsenceRecord[];
  services?: ServiceOrder[];
  currentMonthRef: string;
  onChangeMonthRef: (month: string) => void;
  onSavePayrolls: (payrolls: PayrollRecord[]) => void;
  onViewPayslip: (payroll: PayrollRecord) => void;
}

export const PayrollTab: React.FC<PayrollTabProps> = ({
  employees,
  payrolls,
  advances,
  absences,
  services,
  currentMonthRef,
  onChangeMonthRef,
  onSavePayrolls,
  onViewPayslip,
}) => {
  const { confirm } = useConfirm();
  const [searchTerm, setSearchTerm] = useState('');

  // Sincronização em tempo real com ordens de serviço de silagem
  const [internalServices, setInternalServices] = useState<ServiceOrder[]>(() => services || getStoredServices());

  useEffect(() => {
    if (services) {
      setInternalServices(services);
    }
  }, [services]);

  // Sincronização em tempo real com registros de faltas
  const [internalAbsences, setInternalAbsences] = useState<AbsenceRecord[]>(() => absences || getStoredAbsences());

  useEffect(() => {
    if (absences) {
      setInternalAbsences(absences);
    }
  }, [absences]);

  useEffect(() => {
    const handleServicesUpdate = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setInternalServices(e.detail);
      } else {
        setInternalServices(getStoredServices());
      }
    };
    const handleAbsencesUpdate = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setInternalAbsences(e.detail);
      } else {
        setInternalAbsences(getStoredAbsences());
      }
    };
    window.addEventListener('silagem_services_updated', handleServicesUpdate);
    window.addEventListener('silagem_absences_updated', handleAbsencesUpdate);
    window.addEventListener('storage', handleServicesUpdate);
    window.addEventListener('storage', handleAbsencesUpdate);
    return () => {
      window.removeEventListener('silagem_services_updated', handleServicesUpdate);
      window.removeEventListener('silagem_absences_updated', handleAbsencesUpdate);
      window.removeEventListener('storage', handleServicesUpdate);
      window.removeEventListener('storage', handleAbsencesUpdate);
    };
  }, []);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPayroll, setEditingPayroll] = useState<PayrollRecord | null>(null);
  const [modalPayslipPayroll, setModalPayslipPayroll] = useState<PayrollRecord | null>(null);
  const companyProfile = getStoredCompanyProfile();

  // Form State
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [baseSalary, setBaseSalary] = useState<number>(0);
  const [overtimeAmount, setOvertimeAmount] = useState<number>(0);
  const [bonusAmount, setBonusAmount] = useState<number>(0);
  const [commissionAmount, setCommissionAmount] = useState<number>(0);
  const [commissionsInfo, setCommissionsInfo] = useState<EmployeeMonthCommissions | null>(null);
  const [showCommissionBreakdown, setShowCommissionBreakdown] = useState(false);
  const [inssDiscount, setInssDiscount] = useState<number>(0);
  const [advancesDiscount, setAdvancesDiscount] = useState<number>(0);
  const [otherDiscounts, setOtherDiscounts] = useState<number>(0);
  const [payrollStatus, setPayrollStatus] = useState<'pendente' | 'pago'>('pendente');
  const [notes, setNotes] = useState('');

  // Detalhamento e sincronização de Vales e Faltas no Modal
  const [syncedAdvances, setSyncedAdvances] = useState<SalaryAdvance[]>([]);
  const [syncedAbsences, setSyncedAbsences] = useState<AbsenceRecord[]>([]);
  const [showAdvancesBreakdown, setShowAdvancesBreakdown] = useState(true);
  const [showAbsencesBreakdown, setShowAbsencesBreakdown] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Ação de Impressão Isolada do Recibo Branco (Holerite Oficial) com injeção de estilos do projeto
  const handlePrintIsolated = () => {
    const reciboElement = document.getElementById('recibo-holerite-branco');
    if (!reciboElement) return;

    const printWindow = window.open('', '_blank', 'width=900,height=1000');
    if (printWindow) {
      // Captura todas as folhas de estilo ativas no sistema principal
      const estilosPai = Array.from(document.styleSheets)
        .map(styleSheet => {
          try {
            return Array.from(styleSheet.cssRules)
              .map(rule => rule.cssText)
              .join('\n');
          } catch (e) {
            return '';
          }
        })
        .join('\n');

      printWindow.document.write(`
        <html>
          <head>
            <title>Imprimir Holerite</title>
            <style>
              ${estilosPai}
              body { background: white !important; color: black !important; padding: 24px; font-family: sans-serif; }
              @media print {
                body { padding: 0; }
                .no-print { display: none !important; }
              }
            </style>
          </head>
          <body class="bg-white text-black antialiased">
            <div class="w-full max-w-4xl mx-auto p-4 bg-white border border-gray-200 rounded-xl shadow-none">
              ${reciboElement.innerHTML}
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      
      // Aguarda a renderização completa e dispara a impressora
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 600);
    }
  };

  // Prepara os dados atuais do modal e dispara a impressão isolada
  const handlePrintCurrentModalPayroll = () => {
    const emp = employees.find(e => e.id === selectedEmployeeId);
    if (!emp) {
      alert('Por favor, selecione um colaborador primeiro.');
      return;
    }
    const currentNet = Math.max(
      0,
      (baseSalary + overtimeAmount + bonusAmount + commissionAmount) -
        (inssDiscount + advancesDiscount + otherDiscounts)
    );
    const draft: PayrollRecord = {
      id: editingPayroll?.id || `pay_draft_${Date.now()}`,
      employeeId: emp.id,
      employeeName: emp.name,
      employeeRole: emp.role,
      referenceMonth: currentMonthRef,
      baseSalary: baseSalary,
      overtimeHours: editingPayroll?.overtimeHours || 0,
      overtimeAmount: overtimeAmount,
      bonusAmount: bonusAmount,
      commissionAmount: commissionAmount,
      inssDiscount: inssDiscount,
      advancesDiscount: advancesDiscount,
      otherDiscounts: otherDiscounts,
      netSalary: currentNet,
      status: payrollStatus,
      notes: notes,
      createdAt: editingPayroll?.createdAt || new Date().toISOString(),
    };
    setModalPayslipPayroll(draft);

    // Aguarda o React renderizar o elemento #recibo-holerite-branco e dispara a impressão isolada
    setTimeout(() => {
      handlePrintIsolated();
    }, 150);
  };

  // Filtered Payrolls - Exclusão estrita de Terceirizados (gerenciados pelo Financeiro)
  const monthPayrolls = payrolls.filter(p => {
    if (p.referenceMonth !== currentMonthRef) return false;
    const emp = employees.find(e => e.id === p.employeeId);
    if (emp && isThirdPartyDriver(emp)) return false;
    if ((p.employeeRole || '').toLowerCase().includes('terceiriz')) return false;
    return true;
  });

  const filtered = monthPayrolls.filter(p => 
    p.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.employeeRole.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Totais
  const totalBase = monthPayrolls.reduce((sum, p) => sum + (p.baseSalary || 0), 0);
  const totalCommissions = monthPayrolls.reduce((sum, p) => sum + (p.commissionAmount || 0), 0);
  const totalOvertimeBonus = monthPayrolls.reduce((sum, p) => sum + (p.overtimeAmount || 0) + (p.bonusAmount || 0) + (p.commissionAmount || 0), 0);
  const totalDiscounts = monthPayrolls.reduce((sum, p) => sum + (p.inssDiscount || 0) + (p.advancesDiscount || 0) + (p.otherDiscounts || 0), 0);
  const totalNet = monthPayrolls.reduce((sum, p) => sum + (p.netSalary || 0), 0);

  // Navegação de Mês
  const handlePrevMonth = () => {
    const [month, year] = currentMonthRef.split('/').map(Number);
    let newMonth = month - 1;
    let newYear = year;
    if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    }
    onChangeMonthRef(`${String(newMonth).padStart(2, '0')}/${newYear}`);
  };

  const handleNextMonth = () => {
    const [month, year] = currentMonthRef.split('/').map(Number);
    let newMonth = month + 1;
    let newYear = year;
    if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    }
    onChangeMonthRef(`${String(newMonth).padStart(2, '0')}/${newYear}`);
  };

  // Sincronização centralizada de Comissões, Vales e Faltas para o Colaborador
  const syncEmployeeData = (empId: string, customSalary?: number) => {
    if (!empId) return;
    const emp = employees.find(e => e.id === empId);
    if (!emp) return;

    const salary = customSalary !== undefined ? customSalary : (emp.baseSalary || emp.salary || 3500);
    setBaseSalary(salary);
    
    // 1. REGRA DE NEGÓCIO: Desconto automático de INSS APENAS para regime Registrado (CLT)
    const estimatedInss = calculateAutomaticInss(emp, salary);
    setInssDiscount(estimatedInss);

    // 2. Vales / Adiantamentos ativos do colaborador na competência
    const empAdvances = (advances || []).filter(
      a => a.employeeId === empId && 
           a.referenceMonth === currentMonthRef && 
           (a.status as string) !== 'cancelado'
    );
    const totalEmpAdvances = empAdvances.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
    setAdvancesDiscount(totalEmpAdvances);
    setSyncedAdvances(empAdvances);
    if (empAdvances.length > 0) {
      setShowAdvancesBreakdown(true);
    }

    // 3. Faltas / Ocorrências ativas cadastradas na aba "Faltas" na competência
    const currentAbsencesList = (internalAbsences && internalAbsences.length > 0) 
      ? internalAbsences 
      : getStoredAbsences();

    const empAbsences = currentAbsencesList.filter(a => {
      if (a.employeeId !== empId) return false;
      if (a.status === 'abonada') return false;
      if (a.discountPayroll === false) return false;
      if (a.referenceMonth) {
        return a.referenceMonth === currentMonthRef;
      }
      if (a.date) {
        const [y, m] = a.date.split('-');
        return `${m}/${y}` === currentMonthRef;
      }
      return false;
    });

    const totalFaltasDesconto = empAbsences.reduce((sum, a) => {
      if (a.discountAmount !== undefined && a.discountAmount > 0) {
        return sum + Number(a.discountAmount);
      }
      // Cálculo da diária padrão CLT (Salário / 30 dias) * dias de falta
      const daily = (salary || 3500) / 30;
      const days = a.daysCount || 1;
      return sum + Math.round((daily * days) * 100) / 100;
    }, 0);

    setOtherDiscounts(totalFaltasDesconto);
    setSyncedAbsences(empAbsences);
    if (empAbsences.length > 0) {
      setShowAbsencesBreakdown(true);
    }

    // 4. INTEGRAÇÃO DE VALORES: Apuração ativa de comissões de silagem e produção no mês
    const commData = getEmployeeMonthCommissions(empId, currentMonthRef, internalServices, employees);
    setCommissionAmount(commData.total);
    setCommissionsInfo(commData);
    if (commData.count > 0) {
      setShowCommissionBreakdown(true);
    }
  };

  // Auto-fill when employee is selected in Modal
  const handleSelectEmployee = (empId: string) => {
    setSelectedEmployeeId(empId);
    syncEmployeeData(empId);
  };

  // Ação explícita do botão de Sincronização em Destaque
  const handleSyncButton = () => {
    if (!selectedEmployeeId) return;
    setIsSyncing(true);
    syncEmployeeData(selectedEmployeeId, baseSalary);
    setTimeout(() => {
      setIsSyncing(false);
    }, 400);
  };

  const handleOpenModal = (payroll?: PayrollRecord) => {
    if (payroll) {
      setEditingPayroll(payroll);
      setSelectedEmployeeId(payroll.employeeId);
      setBaseSalary(payroll.baseSalary);
      setOvertimeAmount(payroll.overtimeAmount || 0);
      setBonusAmount(payroll.bonusAmount || 0);
      
      // Apuração ativa das comissões do mês
      const commData = getEmployeeMonthCommissions(payroll.employeeId, currentMonthRef, internalServices, employees);
      setCommissionsInfo(commData);
      setCommissionAmount(payroll.commissionAmount !== undefined ? payroll.commissionAmount : commData.total);

      setInssDiscount(payroll.inssDiscount || 0);
      setAdvancesDiscount(payroll.advancesDiscount || 0);
      setOtherDiscounts(payroll.otherDiscounts || 0);
      setPayrollStatus(payroll.status);
      setNotes(payroll.notes || '');
      setShowCommissionBreakdown(commData.count > 0);

      // Carregar listas detalhadas de vales e faltas para inspeção imediata no modal
      const empAdvances = (advances || []).filter(
        a => a.employeeId === payroll.employeeId && 
             a.referenceMonth === currentMonthRef && 
             (a.status as string) !== 'cancelado'
      );
      setSyncedAdvances(empAdvances);
      setShowAdvancesBreakdown(empAdvances.length > 0);

      const currentAbsencesList = (internalAbsences && internalAbsences.length > 0) 
        ? internalAbsences 
        : getStoredAbsences();
      const empAbsences = currentAbsencesList.filter(a => {
        if (a.employeeId !== payroll.employeeId) return false;
        if (a.status === 'abonada') return false;
        if (a.discountPayroll === false) return false;
        if (a.referenceMonth) return a.referenceMonth === currentMonthRef;
        if (a.date) {
          const [y, m] = a.date.split('-');
          return `${m}/${y}` === currentMonthRef;
        }
        return false;
      });
      setSyncedAbsences(empAbsences);
      setShowAbsencesBreakdown(empAbsences.length > 0);
    } else {
      setEditingPayroll(null);
      setCommissionsInfo(null);
      setShowCommissionBreakdown(false);
      setSyncedAdvances([]);
      setSyncedAbsences([]);
      // Selecionar primeiro funcionário ativo NÃO terceirizado
      const firstActive = employees.find(e => e.status === 'ativo' && !isThirdPartyDriver(e) && !isBrokerEmployee(e));
      if (firstActive) {
        handleSelectEmployee(firstActive.id);
      } else {
        setSelectedEmployeeId('');
        setBaseSalary(0);
        setInssDiscount(0);
        setAdvancesDiscount(0);
        setCommissionAmount(0);
        setOtherDiscounts(0);
      }
      setOvertimeAmount(0);
      setBonusAmount(0);
      setPayrollStatus('pendente');
      setNotes('');
    }
    setIsModalOpen(true);
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find(e => e.id === selectedEmployeeId);
    if (!emp) return;

    const netSalary = Math.max(0, (baseSalary + overtimeAmount + bonusAmount + commissionAmount) - (inssDiscount + advancesDiscount + otherDiscounts));

    if (editingPayroll) {
      const updated = payrolls.map(p => p.id === editingPayroll.id ? {
        ...p,
        employeeId: emp.id,
        employeeName: emp.name,
        employeeRole: emp.role,
        referenceMonth: currentMonthRef,
        baseSalary,
        overtimeAmount,
        bonusAmount,
        commissionAmount,
        inssDiscount,
        advancesDiscount,
        otherDiscounts,
        netSalary,
        status: payrollStatus,
        notes,
      } : p);
      onSavePayrolls(updated);
    } else {
      const newPayroll: PayrollRecord = {
        id: `pay_${Date.now()}`,
        employeeId: emp.id,
        employeeName: emp.name,
        employeeRole: emp.role,
        referenceMonth: currentMonthRef,
        baseSalary,
        overtimeAmount,
        bonusAmount,
        commissionAmount,
        inssDiscount,
        advancesDiscount,
        otherDiscounts,
        netSalary,
        status: payrollStatus,
        notes,
        createdAt: new Date().toISOString(),
      };
      onSavePayrolls([newPayroll, ...payrolls]);
    }
    setIsModalOpen(false);
  };

  // Gerar folha em lote para todos os ativos que ainda não têm folha neste mês
  // REGRA DE NEGÓCIO:
  // 1. Motoristas com vínculo "Terceirizado" NÃO entram na folha (acerto gerido pelo Financeiro)
  // 2. Colaboradores com função "Agenciador" NÃO entram na folha (comissões e repasses geridos exclusivamente pelo Financeiro > Acertos Agenciadores)
  // 3. Desconto de INSS calculado UNICAMENTE para funcionários "Registrado" (CLT)
  // 4. Integração de Valores: Comissões apuradas nas ordens de serviço do mês somadas automaticamente em Proventos (+)
  const handleBatchGenerate = () => {
    const activeEmployees = employees.filter(e => e.status === 'ativo' && !isThirdPartyDriver(e) && !isBrokerEmployee(e));
    const existingEmpIds = new Set(monthPayrolls.map(p => p.employeeId));

    // Atualiza folhas pendentes do mês com eventuais novas comissões apuradas nas ordens de serviço
    const updatedPayrolls = payrolls.map(p => {
      if (p.referenceMonth !== currentMonthRef || p.status !== 'pendente') return p;
      const emp = employees.find(e => e.id === p.employeeId);
      if (!emp || isThirdPartyDriver(emp) || isBrokerEmployee(emp)) return p;

      const commData = getEmployeeMonthCommissions(emp.id, currentMonthRef, internalServices, employees);
      const newComm = commData.total;
      if (p.commissionAmount !== newComm) {
        const net = Math.max(0, (p.baseSalary + (p.overtimeAmount || 0) + (p.bonusAmount || 0) + newComm) - (p.inssDiscount + p.advancesDiscount + p.otherDiscounts));
        let updatedNotes = p.notes || '';
        if (newComm > 0 && !updatedNotes.includes('Comissões')) {
          updatedNotes = updatedNotes ? `${updatedNotes} • Comissões: ${formatCurrencyBRL(newComm)}` : `Comissões: ${formatCurrencyBRL(newComm)}`;
        }
        return {
          ...p,
          commissionAmount: newComm,
          netSalary: net,
          notes: updatedNotes,
        };
      }
      return p;
    });

    const missing = activeEmployees.filter(e => !existingEmpIds.has(e.id));
    const newRecords: PayrollRecord[] = missing.map(emp => {
      const salary = emp.salary || emp.baseSalary || 3500;
      
      // REGRA: Apenas colaboradores Registrado (CLT) recebem cálculo automático de INSS
      const inss = calculateAutomaticInss(emp, salary);
      
      const empAdvances = advances.filter(a => a.employeeId === emp.id && a.referenceMonth === currentMonthRef);
      const advTotal = empAdvances.reduce((sum, a) => sum + a.amount, 0);

      // INTEGRAÇÃO DE VALORES: Apuração ativa de comissões apuradas no mês
      const commData = getEmployeeMonthCommissions(emp.id, currentMonthRef, internalServices, employees);
      const commTotal = commData.total;
      const net = Math.max(0, (salary + commTotal) - inss - advTotal);

      const initialNote = commTotal > 0 
        ? `Comissões apuradas: ${formatCurrencyBRL(commTotal)} (${commData.count} OS de silagem)` 
        : '';

      return {
        id: `pay_${Date.now()}_${emp.id}`,
        employeeId: emp.id,
        employeeName: emp.name,
        employeeRole: emp.role,
        referenceMonth: currentMonthRef,
        baseSalary: salary,
        overtimeAmount: 0,
        bonusAmount: 0,
        commissionAmount: commTotal,
        inssDiscount: inss,
        advancesDiscount: advTotal,
        otherDiscounts: 0,
        netSalary: net,
        status: 'pendente',
        notes: initialNote,
        createdAt: new Date().toISOString(),
      };
    });

    if (newRecords.length > 0) {
      onSavePayrolls([...newRecords, ...updatedPayrolls]);
    } else {
      onSavePayrolls(updatedPayrolls);
    }
  };

  const handleToggleStatus = (id: string) => {
    onSavePayrolls(payrolls.map(p => {
      if (p.id === id) {
        const nextStatus = p.status === 'pago' ? 'pendente' : 'pago';
        return {
          ...p,
          status: nextStatus,
          paymentDate: nextStatus === 'pago' ? new Date().toISOString().split('T')[0] : undefined,
        };
      }
      return p;
    }));
  };

  const handleDelete = async (id: string) => {
    const item = payrolls.find(p => p.id === id);
    const isConfirmed = await confirm({
      title: 'Excluir Holerite / Folha',
      message: item?.employeeName
        ? `Deseja realmente excluir o lançamento da folha de pagamento de "${item.employeeName}" (${item.referenceMonth})?`
        : 'Deseja realmente excluir este lançamento da folha?',
      confirmLabel: 'Sim, Excluir',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });
    if (isConfirmed) {
      onSavePayrolls(payrolls.filter(p => p.id !== id));
    }
  };


  const calculatedModalNet = Math.max(0, (baseSalary + overtimeAmount + bonusAmount + commissionAmount) - (inssDiscount + advancesDiscount + otherDiscounts));

  return (
    <div className="space-y-3 sm:space-y-4">
      
      {/* Month Selector Bar & Action Controls */}
      <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-3 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-black dark:text-white">
        
        {/* Month Selector */}
        <div className="flex items-center space-x-2 w-full sm:w-auto justify-between sm:justify-start">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1.5 rounded-lg border border-blue-300 dark:border-stone-700 bg-blue-100/50 dark:bg-stone-800 hover:bg-blue-200/70 dark:hover:bg-stone-700 transition cursor-pointer text-black dark:text-white"
            title="Mês Anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <div className="flex items-center space-x-2 px-3 py-1 bg-blue-100/70 dark:bg-stone-800 rounded-lg text-xs font-black text-black dark:text-white">
            <span>Competência:</span>
            <span className="text-black dark:text-sky-400 font-black text-sm">{currentMonthRef}</span>
          </div>

          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1.5 rounded-lg border border-blue-300 dark:border-stone-700 bg-blue-100/50 dark:bg-stone-800 hover:bg-blue-200/70 dark:hover:bg-stone-700 transition cursor-pointer text-black dark:text-white"
            title="Próximo Mês"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleBatchGenerate}
            className="flex-1 sm:flex-none inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 border border-emerald-400 dark:border-emerald-700 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-950 dark:text-emerald-300 font-bold text-xs rounded-lg hover:bg-emerald-600 hover:text-white transition cursor-pointer"
            title="Gera folhas automáticas com proventos de comissões integradas para todos os colaboradores ativos"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Gerar Folha em Lote</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenModal()}
            className="flex-1 sm:flex-none inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition shadow-xs cursor-pointer active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Lançar Folha</span>
          </button>
        </div>

      </div>

      {/* Quick Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-2.5 shadow-xs text-black dark:text-white">
          <span className="text-[11px] font-black text-black dark:text-stone-300 block uppercase">Salários Base</span>
          <span className="text-sm sm:text-base font-black text-black dark:text-white font-['Outfit']">
            {formatCurrencyBRL(totalBase)}
          </span>
        </div>
        <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-2.5 shadow-xs text-black dark:text-white">
          <span className="text-[11px] font-black text-black dark:text-stone-300 block uppercase">Horas Extras/Bônus</span>
          <span className="text-sm sm:text-base font-black text-black dark:text-emerald-400 font-['Outfit']">
            +{formatCurrencyBRL(totalOvertimeBonus)}
          </span>
          {totalCommissions > 0 && (
            <span className="text-[10px] text-black/80 dark:text-emerald-300 font-bold block truncate" title={`Comissões apuradas no mês: ${formatCurrencyBRL(totalCommissions)}`}>
              (inclui {formatCurrencyBRL(totalCommissions)} em comissões)
            </span>
          )}
        </div>
        <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-2.5 shadow-xs text-black dark:text-white">
          <span className="text-[11px] font-black text-black dark:text-stone-300 block uppercase">Total Deduções</span>
          <span className="text-sm sm:text-base font-black text-black dark:text-rose-400 font-['Outfit']">
            -{formatCurrencyBRL(totalDiscounts)}
          </span>
        </div>
        <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-2.5 shadow-xs text-black dark:text-white">
          <span className="text-[11px] font-black text-black dark:text-stone-300 block uppercase">Total Líquido Folha</span>
          <span className="text-sm sm:text-base font-black text-black dark:text-white font-['Outfit']">
            {formatCurrencyBRL(totalNet)}
          </span>
        </div>
      </div>

      {/* Banner Informativo de Regras de Negócio */}
      <div className="crm-card bg-blue-100/80 dark:bg-stone-800/80 border border-blue-300 dark:border-stone-700 rounded-xl p-3 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center space-x-2 text-black dark:text-stone-200">
          <ShieldCheck className="w-4 h-4 text-[#0963cb] shrink-0" />
          <span>
            <strong className="text-black dark:text-white">Integração de Comissões & Regras de Vínculo:</strong> Comissões apuradas em ordens de serviço de silagem e produção são somadas automaticamente em <strong className="text-black dark:text-white">Proventos (+)</strong> de colaboradores internos. Motoristas <strong className="text-black dark:text-white">Terceirizados</strong> e <strong className="text-black dark:text-white">Agenciadores</strong> têm repasses geridos exclusivamente pelo Financeiro. Cálculo automático de <strong className="text-black dark:text-white">INSS</strong> restrito ao regime CLT.
          </span>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl px-3 py-2 shadow-xs flex items-center justify-between text-black dark:text-white">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-black dark:text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar colaborador ou função..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1.5 text-xs border border-blue-300 dark:border-stone-700 rounded-lg bg-blue-100/50 dark:bg-stone-800 text-black dark:text-white placeholder-black/60 dark:placeholder-stone-400 outline-none focus:ring-1 focus:ring-sky-600"
          />
        </div>
        <span className="text-xs text-black/85 dark:text-stone-300 font-bold hidden sm:block">
          {filtered.length} holerite(s) na competência {currentMonthRef}
        </span>
      </div>

      {/* Payroll Table */}
      <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl overflow-hidden shadow-xs text-black dark:text-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-blue-100/60 dark:bg-stone-800 text-[11px] font-black text-black dark:text-white uppercase tracking-wider border-b border-blue-200/80 dark:border-stone-700">
              <tr>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3">Colaborador</th>
                <th className="py-2 px-3">Cargo / Função</th>
                <th className="py-2 px-3 text-right">Salário Base</th>
                <th className="py-2 px-3 text-right">Proventos (+)</th>
                <th className="py-2 px-3 text-right">INSS (-)</th>
                <th className="py-2 px-3 text-right">Vales/Desc. (-)</th>
                <th className="py-2 px-3 text-right">Líquido a Pagar</th>
                <th className="py-2 px-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-200/60 dark:divide-stone-800 bg-[#87AFE3] dark:bg-stone-900">
              {filtered.length > 0 ? (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-blue-200/40 dark:hover:bg-stone-800/60 transition">
                    <td className="py-2 px-3">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(item.id)}
                        className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-bold cursor-pointer transition border ${
                          item.status === 'pago'
                            ? 'bg-emerald-100 border-emerald-300 text-emerald-900'
                            : 'bg-amber-100 border-amber-300 text-amber-900'
                        }`}
                      >
                        {item.status === 'pago' ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Pago</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3" />
                            <span>A Pagar</span>
                          </>
                        )}
                      </button>
                    </td>

                    <td className="py-2 px-3">
                      <div className="font-bold text-black dark:text-white text-xs">
                        {item.employeeName}
                      </div>
                      {item.notes && (
                        <div className="text-[10px] text-black/80 dark:text-stone-300 font-medium truncate max-w-xs">
                          {item.notes}
                        </div>
                      )}
                    </td>

                    <td className="py-2 px-3 text-black/85 dark:text-stone-300 font-medium text-xs">
                      {item.employeeRole}
                    </td>

                    <td className="py-2 px-3 text-right font-medium text-black dark:text-stone-200 text-xs font-['Outfit']">
                      {formatCurrencyBRL(item.baseSalary)}
                    </td>

                    <td className="py-2 px-3 text-right font-bold text-emerald-900 dark:text-emerald-400 text-xs font-['Outfit']">
                      <div>{formatCurrencyBRL((item.overtimeAmount || 0) + (item.bonusAmount || 0) + (item.commissionAmount || 0))}</div>
                      {(item.commissionAmount || 0) > 0 && (
                        <div className="text-[10px] text-emerald-950 dark:text-emerald-300 font-bold" title="Comissões apuradas nas ordens de serviço de silagem e produção">
                          +{formatCurrencyBRL(item.commissionAmount || 0)} comissão
                        </div>
                      )}
                    </td>

                    <td className="py-2 px-3 text-right font-bold text-rose-900 dark:text-rose-400 text-xs font-['Outfit']">
                      {formatCurrencyBRL(item.inssDiscount || 0)}
                    </td>

                    <td className="py-2 px-3 text-right font-bold text-rose-900 dark:text-rose-400 text-xs font-['Outfit']">
                      {formatCurrencyBRL((item.advancesDiscount || 0) + (item.otherDiscounts || 0))}
                    </td>

                    <td className="py-2 px-3 text-right font-black text-black dark:text-white whitespace-nowrap text-xs font-['Outfit']">
                      {formatCurrencyBRL(item.netSalary)}
                    </td>

                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          type="button"
                          onClick={() => onViewPayslip(item)}
                          className="p-1 text-black dark:text-sky-400 hover:bg-blue-200/60 dark:hover:bg-stone-800 rounded transition cursor-pointer"
                          title="Ver / Imprimir Holerite"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenModal(item)}
                          className="p-1 text-black/70 dark:text-stone-400 hover:text-black dark:hover:text-[#009688] hover:bg-blue-200/60 dark:hover:bg-stone-800 rounded transition cursor-pointer"
                          title="Editar Folha"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="p-1 text-black/70 dark:text-stone-400 hover:text-rose-700 hover:bg-rose-100 dark:hover:bg-rose-950/40 rounded transition cursor-pointer"
                          title="Excluir Folha"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-black/75 dark:text-stone-400 text-xs">
                    Nenhuma folha de pagamento lançada para a competência {currentMonthRef}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Lançamento / Edição de Folha - Compactado para Tela Única sem barra de rolagem geral */}
      {isModalOpen && (
        <div 
          id="payroll-edit-modal-overlay" 
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-3 bg-black/60 backdrop-blur-xs overflow-y-auto print:hidden"
        >
          <div className="bg-[#b0d2ed] border border-[#0963cb]/30 rounded-2xl w-11/12 max-w-6xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150 max-h-[96vh] flex flex-col print:hidden">
            
            {/* Header com azul padrão #0963cb e texto/ícone em branco #ffffff */}
            <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 bg-[#0963cb] text-white shrink-0">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-white" />
                <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  {editingPayroll ? 'Editar Folha de Pagamento' : 'Lançar Folha de Pagamento'} ({currentMonthRef})
                </h3>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 text-white hover:bg-white/20 rounded-lg transition cursor-pointer"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveModal} className="p-3 sm:p-3.5 space-y-2 text-xs bg-[#b0d2ed] overflow-y-auto flex-1">
              
              {/* Colaborador & Informações de Enquadramento */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-end">
                <div className="lg:col-span-8">
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="block font-bold text-black text-xs">
                      Colaborador / Funcionário <span className="text-rose-600">*</span>
                    </label>
                    <span className="text-[10px] text-stone-700 font-medium">
                      (Motoristas Terceirizados são geridos no Financeiro)
                    </span>
                  </div>
                  <select
                    value={selectedEmployeeId}
                    onChange={(e) => handleSelectEmployee(e.target.value)}
                    className="w-full p-2 border border-stone-300 rounded-lg bg-white text-black outline-none focus:ring-1 focus:ring-[#0963cb] font-semibold text-xs"
                    required
                  >
                    <option value="">Selecione um funcionário...</option>
                    {employees
                      .filter(emp => !isThirdPartyDriver(emp) && !isBrokerEmployee(emp))
                      .map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} ({emp.role}) - {emp.contractType || 'CLT'} - Salário: {formatCurrencyBRL(emp.salary || emp.baseSalary || 3500)}
                        </option>
                    ))}
                  </select>
                </div>
                <div className="lg:col-span-4">
                  {selectedEmployeeId ? (() => {
                    const emp = employees.find(e => e.id === selectedEmployeeId);
                    const isClt = isCltContract(emp);
                    return (
                      <div className="p-2 bg-white border border-stone-300 rounded-lg flex items-center justify-between shadow-2xs">
                        <div className="truncate mr-2">
                          <span className="text-[9px] text-stone-500 font-bold uppercase block tracking-wider leading-none">Regime / Vínculo</span>
                          <span className="text-xs font-bold text-stone-900 truncate block mt-0.5">{emp?.role || 'Operador'} ({emp?.contractType || 'CLT'})</span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${
                          isClt ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {isClt ? 'CLT: INSS Automático' : 'Isento de INSS'}
                        </span>
                      </div>
                    );
                  })() : (
                    <div className="p-2 bg-white/70 border border-stone-300 rounded-lg text-stone-500 text-xs text-center font-medium">
                      Selecione um colaborador para carregar dados
                    </div>
                  )}
                </div>
              </div>

              {/* Enriquecimento do Cabeçalho do Funcionário: Admissão, CPF e Banco para Depósito */}
              {selectedEmployeeId && (() => {
                const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);
                if (!selectedEmployee) return null;
                return (
                  <div className="p-2 bg-white border border-stone-300 rounded-xl shadow-2xs">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <div className="flex items-center space-x-2 p-1.5 bg-stone-50 rounded-lg border border-stone-200">
                        <Calendar className="w-3.5 h-3.5 text-[#0963cb] shrink-0" />
                        <div className="truncate">
                          <span className="text-[9px] font-bold text-stone-500 uppercase block tracking-wider leading-none">
                            Data de Admissão:
                          </span>
                          <span className="font-bold text-stone-900 text-xs block mt-0.5">
                            {formatEmployeeAdmissionDate(selectedEmployee.admissionDate)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 p-1.5 bg-stone-50 rounded-lg border border-stone-200">
                        <CreditCard className="w-3.5 h-3.5 text-[#0963cb] shrink-0" />
                        <div className="truncate">
                          <span className="text-[9px] font-bold text-stone-500 uppercase block tracking-wider leading-none">
                            CPF:
                          </span>
                          <span className="font-bold text-stone-900 text-xs block mt-0.5">
                            {formatCPF(selectedEmployee.cpf)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 p-1.5 bg-stone-50 rounded-lg border border-stone-200">
                        <Landmark className="w-3.5 h-3.5 text-[#0963cb] shrink-0" />
                        <div className="truncate">
                          <span className="text-[9px] font-bold text-stone-500 uppercase block tracking-wider leading-none">
                            Banco para Depósito:
                          </span>
                          <span className="font-bold text-stone-900 text-xs truncate block mt-0.5" title={formatEmployeeBankDeposit(selectedEmployee)}>
                            {formatEmployeeBankDeposit(selectedEmployee)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Grid de Proventos com botão de sincronização em alto destaque */}
              <div className="p-2.5 sm:p-3 bg-blue-50/80 dark:bg-stone-900/90 border border-blue-200 dark:border-stone-700 rounded-xl space-y-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-blue-950 dark:text-blue-300 block tracking-wider">
                    Proventos (Vencimentos)
                  </span>
                  {selectedEmployeeId && (
                    <button
                      type="button"
                      onClick={handleSyncButton}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-stone-800 dark:hover:bg-stone-700 text-[#0963cb] dark:text-sky-400 border border-blue-300 dark:border-blue-600 font-bold text-xs shadow-xs hover:shadow-sm active:scale-98 transition cursor-pointer"
                      title="Sincronizar comissões de OS, adiantamentos e faltas ativas cadastradas no mês"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-[#0963cb] dark:text-sky-400 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span className="font-bold">Sincronizar Comissões / Vales / Faltas</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  <BrlCurrencyInput
                    id="baseSalary"
                    label="Salário Base"
                    value={baseSalary}
                    onChange={setBaseSalary}
                    required
                  />
                  <BrlCurrencyInput
                    id="overtimeAmount"
                    label="Horas Extras / Safra"
                    value={overtimeAmount}
                    onChange={setOvertimeAmount}
                  />
                  <BrlCurrencyInput
                    id="bonusAmount"
                    label="Bônus / Insalubridade"
                    value={bonusAmount}
                    onChange={setBonusAmount}
                  />
                  <BrlCurrencyInput
                    id="commissionAmount"
                    label="Comissões Silagem"
                    value={commissionAmount}
                    onChange={setCommissionAmount}
                    inputClassName="border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-300 focus:ring-emerald-600"
                    headerRight={
                      commissionsInfo && commissionsInfo.breakdown.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => setShowCommissionBreakdown(!showCommissionBreakdown)}
                          className="text-[10px] font-bold text-[#0963cb] flex items-center space-x-0.5 cursor-pointer hover:underline"
                        >
                          <span>{commissionsInfo.count} OS</span>
                          {showCommissionBreakdown ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      ) : null
                    }
                    title="Comissões apuradas automaticamente no fechamento de cortes e ordens de silagem"
                  />
                </div>

                {/* Detalhamento das comissões apuradas no mês com altura contida para evitar rolagem da página */}
                {commissionsInfo && commissionsInfo.breakdown.length > 0 && showCommissionBreakdown && (
                  <div className="mt-1.5 p-2 bg-white/95 dark:bg-stone-800/95 border border-blue-200 dark:border-stone-700 rounded-lg space-y-1 text-xs shadow-2xs">
                    <div className="flex items-center justify-between font-bold text-blue-950 dark:text-blue-200 border-b border-blue-100 dark:border-stone-700 pb-1">
                      <span className="flex items-center space-x-1.5">
                        <FileText className="w-3.5 h-3.5 text-[#0963cb]" />
                        <span className="text-[11px] sm:text-xs">Ordens de Serviço Integradas ({commissionsInfo.referenceMonth})</span>
                      </span>
                      <span className="font-extrabold text-[#0963cb] dark:text-sky-400 font-['Outfit'] text-[11px] sm:text-xs">
                        Total: {formatCurrencyBRL(commissionsInfo.total)}
                      </span>
                    </div>
                    <div className="max-h-[140px] overflow-y-auto space-y-1 pr-1">
                      {commissionsInfo.breakdown.map((b, idx) => (
                        <div 
                          key={idx} 
                          className="p-1.5 bg-blue-50/50 dark:bg-stone-900/60 rounded border border-blue-100/90 dark:border-stone-700 text-[11px] text-stone-900 dark:text-stone-100 font-medium leading-normal"
                        >
                          {(b.formattedLine || b.description || '').replace(/\s*\(\s*cla?ss\s*\)/gi, '')}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Grid 2 Colunas: Deduções (Esquerda) + Situação & Salário Líquido (Direita) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5">
                {/* Deduções com Máscara BRL e Listas Detalhadas de Vales e Faltas */}
                <div className="lg:col-span-7 p-2.5 sm:p-3 bg-white border border-stone-300 rounded-xl space-y-2 shadow-xs">
                  <span className="text-xs font-black uppercase text-black tracking-wider block">
                    Deduções (Descontos & Vales)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <BrlCurrencyInput
                      id="inssDiscount"
                      label="INSS"
                      value={inssDiscount}
                      onChange={setInssDiscount}
                    />
                    <BrlCurrencyInput
                      id="advancesDiscount"
                      label="Vales / Adiantamentos"
                      value={advancesDiscount}
                      onChange={setAdvancesDiscount}
                      headerRight={
                        syncedAdvances.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => setShowAdvancesBreakdown(!showAdvancesBreakdown)}
                            className="text-[10px] font-bold text-rose-700 hover:text-rose-800 flex items-center space-x-0.5 cursor-pointer hover:underline"
                            title="Alternar detalhamento de vales"
                          >
                            <span>{syncedAdvances.length} Vale(s)</span>
                            {showAdvancesBreakdown ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        ) : null
                      }
                    />
                    <BrlCurrencyInput
                      id="otherDiscounts"
                      label="Outros Descontos / Faltas"
                      value={otherDiscounts}
                      onChange={setOtherDiscounts}
                      headerRight={
                        syncedAbsences.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => setShowAbsencesBreakdown(!showAbsencesBreakdown)}
                            className="text-[10px] font-bold text-amber-800 hover:text-amber-900 flex items-center space-x-0.5 cursor-pointer hover:underline"
                            title="Alternar detalhamento de faltas"
                          >
                            <span>{syncedAbsences.length} Falta(s)</span>
                            {showAbsencesBreakdown ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        ) : null
                      }
                    />
                  </div>

                  {/* Lista Detalhada de Vales / Adiantamentos Sincronizados */}
                  {syncedAdvances.length > 0 && showAdvancesBreakdown && (
                    <div className="p-2 bg-rose-50/40 border border-rose-200 rounded-lg space-y-1 text-xs shadow-2xs">
                      <div className="flex items-center justify-between font-bold text-rose-950 border-b border-rose-100 pb-1">
                        <span className="flex items-center space-x-1.5">
                          <CreditCard className="w-3.5 h-3.5 text-rose-600" />
                          <span className="text-[11px] font-bold">Vales / Adiantamentos Integrados ({syncedAdvances.length})</span>
                        </span>
                        <span className="font-extrabold text-rose-700 font-['Outfit'] text-[11px]">
                          Total: {formatCurrencyBRL(advancesDiscount)}
                        </span>
                      </div>
                      <div className="max-h-[110px] overflow-y-auto space-y-1 pr-1">
                        {syncedAdvances.map((adv, idx) => {
                          const parcelLabel = adv.discountType === 'Parcelado' && adv.installmentNumber && adv.totalInstallments
                            ? `Parcela [${adv.installmentNumber}/${adv.totalInstallments}]`
                            : 'Parcela [1/1] (Cota Única)';
                          const dateStr = formatDateBR(adv.date);
                          const resp = adv.responsibleUser || 'ADMINISTRADOR SISTEMA';
                          return (
                            <div 
                              key={adv.id || idx}
                              className="p-1.5 bg-white rounded border border-rose-100 text-[11px] flex items-center justify-between leading-normal"
                            >
                              <div className="truncate mr-2">
                                <span className="font-bold text-stone-900">
                                  {parcelLabel} — Data: {dateStr} — Responsável: <span className="text-stone-700 font-semibold">{resp}</span>
                                </span>
                                {adv.reason && (
                                  <span className="text-stone-500 text-[10px] block truncate">
                                    Motivo: {adv.reason}
                                  </span>
                                )}
                              </div>
                              <span className="font-extrabold text-rose-700 font-['Outfit'] shrink-0">
                                - {formatCurrencyBRL(adv.amount)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Lista Detalhada de Faltas e Ocorrências Sincronizadas */}
                  {syncedAbsences.length > 0 && showAbsencesBreakdown && (
                    <div className="p-2 bg-amber-50/40 border border-amber-200 rounded-lg space-y-1 text-xs shadow-2xs">
                      <div className="flex items-center justify-between font-bold text-amber-950 border-b border-amber-100 pb-1">
                        <span className="flex items-center space-x-1.5">
                          <CalendarX className="w-3.5 h-3.5 text-amber-600" />
                          <span className="text-[11px] font-bold">Faltas Integradas do RH ({syncedAbsences.length})</span>
                        </span>
                        <span className="font-extrabold text-amber-800 font-['Outfit'] text-[11px]">
                          Total: {formatCurrencyBRL(otherDiscounts)}
                        </span>
                      </div>
                      <div className="max-h-[110px] overflow-y-auto space-y-1 pr-1">
                        {syncedAbsences.map((abs, idx) => {
                          const dateStr = formatDateBR(abs.date);
                          const reasonStr = abs.reason || `Falta ${abs.type || 'injustificada'} (${abs.daysCount || 1} dia${(abs.daysCount || 1) > 1 ? 's' : ''})`;
                          const itemDiscount = (abs.discountAmount && abs.discountAmount > 0)
                            ? abs.discountAmount
                            : Math.round((((baseSalary || 3500) / 30) * (abs.daysCount || 1)) * 100) / 100;
                          return (
                            <div 
                              key={abs.id || idx}
                              className="p-1.5 bg-white rounded border border-amber-100 text-[11px] flex items-center justify-between leading-normal"
                            >
                              <div className="truncate mr-2">
                                <span className="font-bold text-stone-900">
                                  Data: {dateStr} — Motivo: <span className="text-stone-700 font-semibold">{reasonStr}</span>
                                </span>
                                {abs.notes && (
                                  <span className="text-stone-500 text-[10px] block truncate">
                                    Obs: {abs.notes}
                                  </span>
                                )}
                              </div>
                              <span className="font-extrabold text-amber-800 font-['Outfit'] shrink-0">
                                - {formatCurrencyBRL(itemDiscount)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Situação do Pagamento & Salário Líquido */}
                <div className="lg:col-span-5 p-2.5 sm:p-3 bg-white border border-stone-300 rounded-xl shadow-xs flex flex-col justify-between space-y-2">
                  <div>
                    <span className="text-xs font-black uppercase text-black tracking-wider block mb-1.5">
                      Situação do Pagamento:
                    </span>
                    <div className="flex items-center space-x-3">
                      <label className="flex items-center space-x-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="status"
                          checked={payrollStatus === 'pendente'}
                          onChange={() => setPayrollStatus('pendente')}
                          className="text-[#0963cb] focus:ring-[#0963cb] accent-[#0963cb] cursor-pointer"
                        />
                        <span className="font-bold text-amber-700 text-xs">A Pagar</span>
                      </label>
                      <label className="flex items-center space-x-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="status"
                          checked={payrollStatus === 'pago'}
                          onChange={() => setPayrollStatus('pago')}
                          className="text-[#0963cb] focus:ring-[#0963cb] accent-[#0963cb] cursor-pointer"
                        />
                        <span className="font-bold text-emerald-700 text-xs">Já Liquidado / Pago</span>
                      </label>
                    </div>
                  </div>

                  <div className="pt-1.5 border-t border-stone-200 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] font-bold text-stone-500 uppercase block tracking-wider leading-none">Total a Pagar</span>
                      <span className="text-xs font-bold text-stone-800">Salário Líquido</span>
                    </div>
                    <span className="text-xl sm:text-2xl font-black text-[#0963cb] font-['Outfit']">
                      {formatMoneyBRL(calculatedModalNet)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Observações Internas e Ações do Rodapé */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-black/15 shrink-0">
                {/* Campo de Observações Internas */}
                <div className="flex-1 min-w-0 p-1.5 bg-white border border-stone-300 rounded-lg shadow-2xs flex items-center gap-2">
                  <label className="font-bold text-black text-xs shrink-0">
                    Observações:
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ex: Pagamento agendado, observações..."
                    className="w-full p-1 bg-transparent text-black outline-none text-xs font-medium"
                  />
                </div>

                {/* Botões de Ação com Botão Único 'Imprimir Folha' entre Observações e Cancelar */}
                <div className="flex items-center space-x-2 shrink-0 justify-end">
                  <button
                    type="button"
                    onClick={handlePrintCurrentModalPayroll}
                    disabled={!selectedEmployeeId}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 border border-stone-300 text-stone-700 font-bold transition shadow-2xs cursor-pointer text-xs disabled:opacity-40"
                    title="Imprimir Holerite Oficial (Recibo Limpo em PDF)"
                  >
                    <Printer className="w-3.5 h-3.5 text-stone-600" />
                    <span>Imprimir Folha</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-1.5 rounded-lg bg-white border border-stone-300 text-stone-700 font-bold hover:bg-stone-50 cursor-pointer transition text-xs shadow-2xs"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-1.5 rounded-lg bg-[#0963cb] hover:bg-[#0852a8] text-white font-bold transition shadow-xs cursor-pointer text-xs"
                  >
                    Salvar Folha de Pagamento
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Impressão do Holerite Padronizado */}
      <PayslipModal
        payroll={modalPayslipPayroll}
        employee={employees.find(e => e.id === modalPayslipPayroll?.employeeId)}
        companyProfile={companyProfile}
        isOpen={!!modalPayslipPayroll}
        onClose={() => setModalPayslipPayroll(null)}
        advances={advances}
        absences={internalAbsences}
        services={internalServices}
        allEmployees={employees}
        commissionsInfo={modalPayslipPayroll?.employeeId === selectedEmployeeId ? commissionsInfo : undefined}
      />

    </div>
  );
};
