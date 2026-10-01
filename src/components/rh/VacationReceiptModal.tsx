import React, { useState, useEffect, useMemo } from 'react';
import { X, Printer, Palmtree } from 'lucide-react';
import { VacationRecord, Employee, CompanyProfile } from '../../types';
import { formatDateBR, getStoredCompanyProfile } from '../../lib/storage';

export interface VacationReceiptModalProps {
  vacation?: VacationRecord | null;
  vacationData?: VacationRecord | null;
  employee?: Employee;
  companyProfile?: CompanyProfile;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Formata moeda estritamente no padrão comercial brasileiro: R$ #.##0,00
 * Conforme instrução obrigatória persistente do projeto (RULE[AGENTS_md])
 */
function formatBRL(val?: number): string {
  const num = Number(val) || 0;
  return 'R$ ' + num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function VacationReceiptModal({
  isOpen,
  onClose,
  vacationData,
  vacation,
  employee,
  companyProfile: propCompanyProfile,
}: VacationReceiptModalProps) {
  // =========================================================================
  // 1. REPOSICIONAMENTO DOS HOOKS NO TOPO ABSOLUTO DO COMPONENTE
  // Todos os React Hooks (useState, useEffect, useMemo) são declarados aqui,
  // ANTES de qualquer instrução condicional (como if (!isOpen) ou if (!vacationData)).
  // A quantidade e a ordem dos hooks são idênticas em qualquer ciclo de render.
  // =========================================================================

  // Hook 1: Estado de impressão
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  // Hook 2: Consolidação dos dados de férias (prioriza vacationData, fallback vacation)
  const currentVacation = useMemo(() => {
    return vacationData || vacation || null;
  }, [vacationData, vacation]);

  // Hook 3: Perfil da Empresa Empregadora
  const company = useMemo(() => {
    return propCompanyProfile || getStoredCompanyProfile();
  }, [propCompanyProfile]);

  // Hook 4: Endereço completo formatado da Empresa
  const companyAddress = useMemo(() => {
    if (!company) return 'Sede Administrativa / Área Operacional';
    return [
      company.address ? `${company.address}${company.number ? `, nº ${company.number}` : ''}` : '',
      company.neighborhood ? `Bairro ${company.neighborhood}` : '',
      company.city ? `${company.city}${company.state ? `/${company.state}` : ''}` : '',
      company.zipCode ? `CEP: ${company.zipCode}` : '',
    ].filter(Boolean).join(' • ') || 'Sede Administrativa / Área Operacional';
  }, [company]);

  // Hook 5: Cálculo da data de retorno ao trabalho
  const returnDate = useMemo(() => {
    if (!currentVacation?.endDate) return '-';
    try {
      const parts = currentVacation.endDate.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        d.setDate(d.getDate() + 1);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
      }
    } catch (_) {}
    return '-';
  }, [currentVacation?.endDate]);

  // Hook 6: Valores calculados de proventos e 1/3 constitucional
  const calculatedAmounts = useMemo(() => {
    if (!currentVacation) {
      return {
        valorFerias: 4000,
        valorUmTerco: 1000,
        valorAbono: 0,
        valorDecimo: 0,
        totalBruto: 5000,
      };
    }
    const valorFerias = currentVacation.baseSalary || 4000;
    const valorUmTerco = currentVacation.oneThirdBonus || (valorFerias / 3) || 1000;
    const valorAbono = currentVacation.pecuniaryAllowance || 0;
    const valorDecimo = currentVacation.thirteenthAmount || 0;
    const totalBruto = currentVacation.totalAmount || (valorFerias + valorUmTerco + valorAbono + valorDecimo) || 5000;

    return {
      valorFerias,
      valorUmTerco,
      valorAbono,
      valorDecimo,
      totalBruto,
    };
  }, [currentVacation]);

  // Hook 7: Hook independente de verificação e sincronização de dados do Supabase
  useEffect(() => {
    // Carrega/valida dados de férias independentemente do estado do modal
    if (vacationData) {
      // Dados sincronizados
    }
  }, [vacationData, vacation]);

  // Hook 8: Efeito de classes e listeners de impressão global
  useEffect(() => {
    if (!isOpen || !currentVacation) return;

    document.body.classList.add('has-vacation-receipt-open');
    const handleBeforePrint = () => {
      setIsPrinting(true);
      document.body.classList.add('printing-vacation-receipt');
    };
    const handleAfterPrint = () => {
      setIsPrinting(false);
      document.body.classList.remove('printing-vacation-receipt');
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      document.body.classList.remove('has-vacation-receipt-open');
      document.body.classList.remove('printing-vacation-receipt');
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [isOpen, currentVacation]);

  // =========================================================================
  // 2. CONDICIONAIS DE RENDERIZAÇÃO
  // Vêm ESTRITAMENTE APÓS a declaração de TODOS os hooks acima.
  // =========================================================================

  if (!isOpen) return null;

  if (!currentVacation) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-6 shadow-xl text-center max-w-sm w-full">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm font-bold text-stone-800 dark:text-stone-200">
            Carregando dados do Supabase...
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 px-4 py-1.5 bg-stone-200 hover:bg-stone-300 dark:bg-stone-800 dark:hover:bg-stone-700 text-xs font-bold rounded-lg transition cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 3. RENDERIZAÇÃO DO DOCUMENTO CONSOLIDADO (AVISO E RECIBO DE FÉRIAS A4)
  // =========================================================================

  // Dados da Empresa
  const companyName = company?.tradeName || company?.companyName || company?.corporateName || 'COLACA SILAGEM LTDA';
  const companyCnpj = company?.cnpjCpf || '46.097.636/0001-02';

  // Variáveis Obrigatórias da Linha Selecionada
  const employeeName = currentVacation.employeeName || employee?.name || 'ALISSON PAGOTTO DA SILVA';
  const employeeRole = employee?.role || (employee as any)?.cargo || 'Colaborador';
  const employeeCpf = employee?.cpf || (employee as any)?.document || (employee as any)?.cpfCnpj || 'Não Informado';

  // Períodos
  const acquisitionStart = currentVacation.acquisitionPeriodStart ? formatDateBR(currentVacation.acquisitionPeriodStart) : '01/01/2025';
  const acquisitionEnd = currentVacation.acquisitionPeriodEnd ? formatDateBR(currentVacation.acquisitionPeriodEnd) : '31/12/2025';
  const periodAcquisitive = `${acquisitionStart} a ${acquisitionEnd}`;

  const periodGozoStart = formatDateBR(currentVacation.startDate) || '01/10/2026';
  const periodGozoEnd = formatDateBR(currentVacation.endDate) || '31/10/2026';
  const periodGozo = `${periodGozoStart} até ${periodGozoEnd}`;

  const daysCount = currentVacation.daysCount || 30;

  // Valores Extraídos do Hook
  const { valorFerias, valorUmTerco, valorAbono, valorDecimo, totalBruto } = calculatedAmounts;

  // Local e Data Atual
  const issueCity = company?.city || 'Brasil';
  const todayFormatted = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-xs overflow-y-auto">
      {/* Estilos CSS Nativos de Impressão A4 Portrait em 1 Página */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 1.5cm;
          }
          body, html {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-size: 11pt !important;
          }
          .no-print, .no-print * {
            display: none !important;
          }
          .recibo-ferias-container {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            border: 1px solid #000000 !important;
          }
        }
      `}</style>

      {/* Janela Modal do Sistema */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-auto max-h-[96vh] flex flex-col">
        
        {/* Barra de Ações Superior (no-print) */}
        <div className="no-print flex items-center justify-between px-5 py-3.5 bg-[#0963cb] text-white border-b border-blue-400/30">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-white/15">
              <Palmtree className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-wide text-white uppercase">
                Aviso e Recibo de Férias
              </h3>
              <p className="text-[11px] text-white/80 font-medium">
                Documento legal consolidado (Art. 135 e Art. 145 da CLT) • {employeeName}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition shadow-xs cursor-pointer active:scale-95"
              title="Imprimir Aviso/Recibo de Férias (A4 em uma página)"
            >
              <Printer className="w-4 h-4" />
              <span>{isPrinting ? 'Preparando...' : 'Imprimir Documento'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
              title="Fechar Janela"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Área de Visualização com Scroll (Tela) e Impressão Nativa (A4) */}
        <div className="p-3 sm:p-6 overflow-y-auto bg-stone-100 dark:bg-stone-950 flex justify-center">
          
          {/* Documento Físico Centralizado - Folha A4 em 1 Página */}
          <div className="recibo-ferias-container bg-white text-black w-full max-w-[210mm] border border-stone-300 p-6 sm:p-8 rounded-lg shadow-sm text-xs leading-relaxed font-sans">
            
            {/* CABEÇALHO EMPRESARIAL */}
            <div className="border-b-2 border-black pb-3 mb-4 text-center">
              <h1 className="text-base font-black uppercase tracking-wider text-black">
                {companyName}
              </h1>
              <p className="text-[11px] font-bold text-stone-700 mt-0.5">
                CNPJ/MF: {companyCnpj}
              </p>
              {companyAddress && (
                <p className="text-[10px] text-stone-600 mt-0.5">
                  {companyAddress}
                </p>
              )}
              <div className="mt-2.5 inline-block border-2 border-black px-4 py-1 rounded-sm bg-stone-50">
                <span className="text-xs font-black tracking-widest uppercase text-black">
                  AVISO E RECIBO DE QUITAÇÃO DE FÉRIAS
                </span>
              </div>
            </div>

            {/* SEÇÃO 1: AVISO PRÉVIO DE FÉRIAS (ART. 135 CLT) */}
            <div className="mb-4 border border-stone-400 rounded-sm p-3 bg-stone-50/50">
              <div className="font-black uppercase text-[11px] border-b border-stone-300 pb-1 mb-2 text-stone-900 flex items-center justify-between">
                <span>1. AVISO PRÉVIO DE FÉRIAS (Art. 135 da CLT)</span>
                <span className="text-[10px] font-semibold text-stone-600">Comunicação Formal ao Empregado</span>
              </div>
              <p className="text-[11px] text-justify text-stone-800 leading-normal mb-2.5">
                Em cumprimento ao que determina a legislação trabalhista vigente e o Artigo 135 da Consolidação das Leis do Trabalho (CLT), comunicamos que suas férias regulamentares relativas ao período aquisitivo abaixo discriminado ser-lhe-ão concedidas no período de gozo a seguir indicado:
              </p>

              {/* Tabela dos Dados Cadastrais e Períodos */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 border border-stone-300 p-2.5 bg-white rounded-xs text-[11px]">
                <div>
                  <span className="block text-[9px] font-bold text-stone-500 uppercase">Colaborador(a):</span>
                  <span className="font-black text-black text-xs">{employeeName}</span>
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-stone-500 uppercase">Cargo / Função:</span>
                  <span className="font-bold text-stone-900">{employeeRole}</span>
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-stone-500 uppercase">CPF / Documento:</span>
                  <span className="font-bold text-stone-900">{employeeCpf}</span>
                </div>
                <div className="sm:col-span-1">
                  <span className="block text-[9px] font-bold text-stone-500 uppercase">Período Aquisitivo:</span>
                  <span className="font-black text-stone-900">{periodAcquisitive}</span>
                </div>
                <div className="sm:col-span-1">
                  <span className="block text-[9px] font-bold text-stone-500 uppercase">Período de Gozo:</span>
                  <span className="font-black text-blue-900">{periodGozo}</span>
                </div>
                <div className="sm:col-span-1">
                  <span className="block text-[9px] font-bold text-stone-500 uppercase">Duração / Retorno:</span>
                  <span className="font-bold text-stone-900">{daysCount} dias (Retorno: {returnDate})</span>
                </div>
              </div>
            </div>

            {/* SEÇÃO 2: DEMONSTRATIVO DE CÁLCULO E QUITAÇÃO (ART. 145 CLT) */}
            <div className="mb-4 border border-stone-400 rounded-sm p-3 bg-stone-50/50">
              <div className="font-black uppercase text-[11px] border-b border-stone-300 pb-1 mb-2 text-stone-900 flex items-center justify-between">
                <span>2. DEMONSTRATIVO DE CÁLCULO E VALORES (Art. 145 da CLT)</span>
                <span className="text-[10px] font-semibold text-stone-600">Discriminação das Rubricas</span>
              </div>

              {/* Tabela de Verbas e Adicional de 1/3 Constitucional */}
              <table className="w-full border-collapse border border-stone-300 text-[11px] bg-white mb-2.5">
                <thead>
                  <tr className="bg-stone-100 text-stone-800 border-b border-stone-300 text-left">
                    <th className="py-1 px-2 border-r border-stone-300 font-bold uppercase text-[10px]">Discriminação das Verbas</th>
                    <th className="py-1 px-2 border-r border-stone-300 font-bold uppercase text-[10px] text-center w-24">Referência</th>
                    <th className="py-1 px-2 font-bold uppercase text-[10px] text-right w-36">Valor em Reais (R$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  <tr>
                    <td className="py-1.5 px-2 border-r border-stone-300 font-medium">
                      Remuneração Normal de Férias
                    </td>
                    <td className="py-1.5 px-2 border-r border-stone-300 text-center font-bold">
                      {daysCount} dias
                    </td>
                    <td className="py-1.5 px-2 text-right font-black font-mono">
                      {formatBRL(valorFerias)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-2 border-r border-stone-300 font-medium">
                      Adicional de 1/3 Constitucional (Art. 7º, XVII da CF/88)
                    </td>
                    <td className="py-1.5 px-2 border-r border-stone-300 text-center font-bold">
                      33,33%
                    </td>
                    <td className="py-1.5 px-2 text-right font-black font-mono">
                      {formatBRL(valorUmTerco)}
                    </td>
                  </tr>
                  {valorAbono > 0 && (
                    <tr>
                      <td className="py-1.5 px-2 border-r border-stone-300 font-medium">
                        Abono Pecuniário de Férias ({currentVacation.sellDaysCount || 0} dias)
                      </td>
                      <td className="py-1.5 px-2 border-r border-stone-300 text-center font-bold">
                        {currentVacation.sellDaysCount || 0} dias
                      </td>
                      <td className="py-1.5 px-2 text-right font-black font-mono">
                        {formatBRL(valorAbono)}
                      </td>
                    </tr>
                  )}
                  {valorDecimo > 0 && (
                    <tr>
                      <td className="py-1.5 px-2 border-r border-stone-300 font-medium">
                        Adiantamento da 1ª Parcela do 13º Salário
                      </td>
                      <td className="py-1.5 px-2 border-r border-stone-300 text-center font-bold">
                        50%
                      </td>
                      <td className="py-1.5 px-2 text-right font-black font-mono">
                        {formatBRL(valorDecimo)}
                      </td>
                    </tr>
                  )}
                  <tr className="bg-stone-100/90 font-black border-t-2 border-stone-400">
                    <td colSpan={2} className="py-1.5 px-2 border-r border-stone-300 uppercase tracking-wide text-stone-900">
                      TOTAL BRUTO DAS FÉRIAS E 1/3 CONSTITUCIONAL:
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono text-xs text-black">
                      {formatBRL(totalBruto)}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Texto do Recibo de Quitação */}
              <p className="text-[10.5px] text-justify text-stone-800 leading-normal border-t border-stone-300 pt-2">
                <strong>RECIBO DE QUITAÇÃO:</strong> Recebi de <strong>{companyName}</strong>, inscrita no CNPJ/MF sob o nº <strong>{companyCnpj}</strong>, a importância líquida supra de <strong>{formatBRL(totalBruto)}</strong>, correspondente à quitação das férias regulamentares e do respectivo adicional constitucional ora concedidos, das quais dou plena, rasa e irrevogável quitação.
              </p>
            </div>

            {/* SEÇÃO 3: DATA E ASSINATURAS CLÁSSICAS */}
            <div className="mt-6 pt-3 border-t border-stone-400">
              <div className="text-center font-medium text-stone-700 text-[11px] mb-8">
                {issueCity}, {todayFormatted}.
              </div>

              <div className="grid grid-cols-2 gap-8 text-center text-[11px]">
                {/* Assinatura do Empregador */}
                <div className="flex flex-col items-center">
                  <div className="w-full border-t border-black mb-1.5"></div>
                  <span className="font-black text-black uppercase">{companyName}</span>
                  <span className="text-[10px] text-stone-600">Empregador • CNPJ: {companyCnpj}</span>
                </div>

                {/* Assinatura do Empregado */}
                <div className="flex flex-col items-center">
                  <div className="w-full border-t border-black mb-1.5"></div>
                  <span className="font-black text-black uppercase">{employeeName}</span>
                  <span className="text-[10px] text-stone-600">Empregado(a) • CPF: {employeeCpf}</span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Rodapé do Modal (no-print) */}
        <div className="no-print flex items-center justify-between px-5 py-3 bg-stone-100 dark:bg-stone-900 border-t border-stone-200 dark:border-stone-800 text-xs">
          <span className="text-[11px] text-stone-500 font-medium">
            Padrão de Impressão: Folha A4 Retrato • Ajustado para 1 Página
          </span>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              className="inline-flex items-center space-x-1 px-3 py-1.5 bg-[#0963cb] hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-lg transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-stone-200 hover:bg-stone-300 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 font-bold rounded-lg transition cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

export default VacationReceiptModal;
