import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Trash2, 
  Edit2, 
  Palmtree, 
  AlertCircle,
  X,
  DollarSign,
  Printer,
  FileText
} from 'lucide-react';
import { Employee, VacationRecord } from '../../types';
import { formatCurrencyBRL, formatDateBR } from '../../lib/storage';
import { useConfirm } from '../../context/ConfirmContext';
import { VacationReceiptModal } from './VacationReceiptModal';
import { EmployeeAvatar } from '../common/EmployeeAvatar';

interface VacationsTabProps {
  employees: Employee[];
  vacations: VacationRecord[];
  onSaveVacations: (vacations: VacationRecord[]) => void;
}

/**
 * Formata valores monetários estritamente no padrão comercial brasileiro: R$ #.##0,00
 * Conforme instrução obrigatória persistente do projeto (RULE[AGENTS_md])
 */
function formatBRL(val?: number): string {
  const num = Number(val) || 0;
  return 'R$ ' + num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Tabela Oficial Progressiva do INSS Brasileiro
 */
function calculateVacationINSS(base: number): { inssAmount: number; effectiveRate: number } {
  if (base <= 0) return { inssAmount: 0, effectiveRate: 0 };
  const faixas = [
    { limite: 1412.00, aliq: 0.075 },
    { limite: 2666.68, aliq: 0.09 },
    { limite: 4000.03, aliq: 0.12 },
    { limite: 7786.02, aliq: 0.14 }
  ];

  let inss = 0;
  let anterior = 0;
  for (const f of faixas) {
    if (base > anterior) {
      const baseFaixa = Math.min(base, f.limite) - anterior;
      inss += baseFaixa * f.aliq;
      anterior = f.limite;
    } else {
      break;
    }
  }
  const inssTeto = 908.86;
  const inssFinal = Math.min(inss, inssTeto);
  const roundedInss = Math.round(inssFinal * 100) / 100;
  const effectiveRate = base > 0 ? (roundedInss / base) * 100 : 0;
  return { inssAmount: roundedInss, effectiveRate };
}

/**
 * Tabela Oficial de Retenção do IRRF na Fonte com Dedução por Faixa
 */
function calculateVacationIRRF(baseIRRF: number): { irrfAmount: number; irrfRate: number } {
  if (baseIRRF <= 2259.20) {
    return { irrfAmount: 0, irrfRate: 0 };
  }
  let aliq = 0;
  let deducao = 0;
  if (baseIRRF <= 2826.65) {
    aliq = 0.075;
    deducao = 169.44;
  } else if (baseIRRF <= 3751.05) {
    aliq = 0.15;
    deducao = 381.44;
  } else if (baseIRRF <= 4664.68) {
    aliq = 0.225;
    deducao = 662.77;
  } else {
    aliq = 0.275;
    deducao = 896.00;
  }

  const irrf = Math.max(0, (baseIRRF * aliq) - deducao);
  const roundedIrrf = Math.round(irrf * 100) / 100;
  return { irrfAmount: roundedIrrf, irrfRate: aliq * 100 };
}

/**
 * Motor Financeiro de Férias (CLT, CF/88, Previdência e IRRF)
 */
function calculateFullVacationFinancials(salary: number, days: number, sellDays: number, is13th: boolean) {
  const dailyRate = salary > 0 ? salary / 30 : 0;
  
  // Dias de gozo efetivos
  const effectiveGozoDays = Math.max(0, days);
  const valorFeriasGozo = Math.round((dailyRate * effectiveGozoDays) * 100) / 100;
  const valorUmTercoGozo = Math.round((valorFeriasGozo / 3) * 100) / 100;

  // Abono pecuniário (venda de dias - Art. 143 CLT)
  const valorAbonoPecuniario = sellDays > 0 ? Math.round((dailyRate * sellDays) * 100) / 100 : 0;
  const valorUmTercoAbono = sellDays > 0 ? Math.round((valorAbonoPecuniario / 3) * 100) / 100 : 0;

  // Adiantamento do 13º salário (50% do salário - Lei 4.749/65)
  const valorDecimoAdiantamento = is13th ? Math.round((salary / 2) * 100) / 100 : 0;

  // Total bruto de proventos
  const totalBruto = Math.round((valorFeriasGozo + valorUmTercoGozo + valorAbonoPecuniario + valorUmTercoAbono + valorDecimoAdiantamento) * 100) / 100;

  // Base do INSS: apenas férias gozadas + 1/3 (abono pecuniário é indenizatório e isento de INSS)
  const baseINSS = Math.round((valorFeriasGozo + valorUmTercoGozo) * 100) / 100;
  const { inssAmount, effectiveRate: inssEffectiveRate } = calculateVacationINSS(baseINSS);

  // Base do IRRF: baseINSS - inssAmount (abono pecuniário e 1/3 são isentos de IRRF - Súmula 386 STJ)
  const baseIRRF = Math.max(0, Math.round((baseINSS - inssAmount) * 100) / 100);
  const { irrfAmount, irrfRate } = calculateVacationIRRF(baseIRRF);

  // Total de descontos
  const totalDescontos = Math.round((inssAmount + irrfAmount) * 100) / 100;

  // Valor líquido final a pagar
  const valorLiquido = Math.max(0, Math.round((totalBruto - totalDescontos) * 100) / 100);

  return {
    dailyRate,
    effectiveGozoDays,
    valorFeriasGozo,
    valorUmTercoGozo,
    valorAbonoPecuniario,
    valorUmTercoAbono,
    valorDecimoAdiantamento,
    totalBruto,
    baseINSS,
    inssDiscount: inssAmount,
    inssEffectiveRate,
    baseIRRF,
    irrfDiscount: irrfAmount,
    irrfRate,
    totalDescontos,
    valorLiquido,
  };
}

/**
 * Utilitários de manipulação de datas para cálculo automático de período de gozo
 */
function calculateEndDateFromStart(startStr: string, days: number): string {
  if (!startStr) return '';
  try {
    const parts = startStr.split('-');
    if (parts.length === 3) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      d.setDate(d.getDate() + Math.max(1, days) - 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
  } catch (_) {}
  return '';
}

function calculateDaysDiff(startStr: string, endStr: string): number {
  if (!startStr || !endStr) return 30;
  try {
    const p1 = startStr.split('-');
    const p2 = endStr.split('-');
    if (p1.length === 3 && p2.length === 3) {
      const d1 = new Date(Number(p1[0]), Number(p1[1]) - 1, Number(p1[2]));
      const d2 = new Date(Number(p2[0]), Number(p2[1]) - 1, Number(p2[2]));
      const diffTime = d2.getTime() - d1.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return diffDays > 0 ? diffDays : 1;
    }
  } catch (_) {}
  return 30;
}

function formatPaymentDeadline(startStr: string): string {
  if (!startStr) return '-';
  try {
    const parts = startStr.split('-');
    if (parts.length === 3) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      d.setDate(d.getDate() - 2);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
  } catch (_) {}
  return '-';
}

export const VacationsTab: React.FC<VacationsTabProps> = ({
  employees,
  vacations,
  onSaveVacations,
}) => {
  const { confirm } = useConfirm();
  const [searchTerm, setSearchTerm] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVacation, setEditingVacation] = useState<VacationRecord | null>(null);
  const [printingVacation, setPrintingVacation] = useState<VacationRecord | null>(null);

  // Form State
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [acquisitionPeriodStart, setAcquisitionPeriodStart] = useState('');
  const [acquisitionPeriodEnd, setAcquisitionPeriodEnd] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [daysCount, setDaysCount] = useState<number>(30);
  const [sellDaysCount, setSellDaysCount] = useState<number>(0);
  const [baseSalary, setBaseSalary] = useState<number>(0);
  const [thirteenthAdvance, setThirteenthAdvance] = useState<boolean>(false);
  const [status, setStatus] = useState<'agendado' | 'em_gozo' | 'concluido' | 'cancelado'>('agendado');
  const [notes, setNotes] = useState('');

  // Colaborador atualmente selecionado
  const selectedEmp = useMemo(() => {
    return employees.find(e => e.id === selectedEmployeeId) || null;
  }, [employees, selectedEmployeeId]);

  // Filtragem da lista principal
  const filtered = useMemo(() => {
    return vacations.filter(v => 
      v.employeeName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [vacations, searchTerm]);

  // Totais dos KPIs
  const emGozoCount = vacations.filter(v => v.status === 'em_gozo').length;
  const agendadasCount = vacations.filter(v => v.status === 'agendado').length;
  const concluidasCount = vacations.filter(v => v.status === 'concluido').length;
  const totalValorFerias = vacations.reduce((sum, v) => sum + (v.totalAmount || 0), 0);

  // Cálculos financeiros dinâmicos completos da janela modal
  const financials = useMemo(() => {
    return calculateFullVacationFinancials(baseSalary, daysCount, sellDaysCount, thirteenthAdvance);
  }, [baseSalary, daysCount, sellDaysCount, thirteenthAdvance]);

  // Data limite para pagamento (até 2 dias antes do início do gozo - Art. 145 CLT)
  const paymentDeadline = useMemo(() => {
    return formatPaymentDeadline(startDate);
  }, [startDate]);

  const handleSelectEmployee = (empId: string) => {
    setSelectedEmployeeId(empId);
    const emp = employees.find(e => e.id === empId);
    if (emp) {
      const salary = emp.salary || emp.baseSalary || 3500;
      setBaseSalary(salary);
    }
  };

  const handleStartDateChange = (newStart: string) => {
    setStartDate(newStart);
    if (newStart && daysCount > 0) {
      setEndDate(calculateEndDateFromStart(newStart, daysCount));
    }
  };

  const handleEndDateChange = (newEnd: string) => {
    setEndDate(newEnd);
    if (startDate && newEnd) {
      const diff = calculateDaysDiff(startDate, newEnd);
      setDaysCount(diff);
    }
  };

  const handleAbonoChange = (newAbono: number) => {
    setSellDaysCount(newAbono);
    // Se selecionado 10 dias, ajuste os dias de gozo para 20 automaticamente (ou 30 se 0 dias)
    const newDays = newAbono === 10 ? 20 : 30;
    setDaysCount(newDays);
    if (startDate) {
      setEndDate(calculateEndDateFromStart(startDate, newDays));
    }
  };

  const handleOpenModal = (vacation?: VacationRecord) => {
    if (vacation) {
      setEditingVacation(vacation);
      setSelectedEmployeeId(vacation.employeeId);
      setAcquisitionPeriodStart(vacation.acquisitionPeriodStart || '2025-01-01');
      setAcquisitionPeriodEnd(vacation.acquisitionPeriodEnd || '2025-12-31');
      setStartDate(vacation.startDate);
      setEndDate(vacation.endDate);
      setDaysCount(vacation.daysCount);
      setSellDaysCount(vacation.sellDaysCount || 0);
      setBaseSalary(vacation.baseSalary);
      setThirteenthAdvance(vacation.thirteenthAdvance || false);
      setStatus(vacation.status);
      setNotes(vacation.notes || '');
    } else {
      setEditingVacation(null);
      const firstActive = employees.find(e => e.status === 'ativo') || employees[0];
      const salary = firstActive?.salary || firstActive?.baseSalary || 3500;
      if (firstActive) {
        setSelectedEmployeeId(firstActive.id);
        setBaseSalary(salary);
      } else {
        setSelectedEmployeeId('');
        setBaseSalary(0);
      }
      setAcquisitionPeriodStart('2025-01-01');
      setAcquisitionPeriodEnd('2025-12-31');
      const today = new Date().toISOString().split('T')[0];
      setStartDate(today);
      setEndDate(calculateEndDateFromStart(today, 30));
      setDaysCount(30);
      setSellDaysCount(0);
      setThirteenthAdvance(false);
      setStatus('agendado');
      setNotes('');
    }
    setIsModalOpen(true);
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find(e => e.id === selectedEmployeeId);
    if (!emp) return;

    const calc = calculateFullVacationFinancials(baseSalary, daysCount, sellDaysCount, thirteenthAdvance);

    if (editingVacation) {
      const updated = vacations.map(v => v.id === editingVacation.id ? {
        ...v,
        employeeId: emp.id,
        employeeName: emp.name,
        acquisitionPeriodStart,
        acquisitionPeriodEnd,
        startDate,
        endDate,
        daysCount,
        sellDaysCount,
        baseSalary,
        oneThirdBonus: calc.valorUmTercoGozo,
        pecuniaryAllowance: calc.valorAbonoPecuniario + calc.valorUmTercoAbono,
        thirteenthAdvance,
        thirteenthAmount: calc.valorDecimoAdiantamento,
        inssDiscount: calc.inssDiscount,
        irrfDiscount: calc.irrfDiscount,
        netAmount: calc.valorLiquido,
        totalAmount: calc.totalBruto,
        status,
        notes,
      } : v);
      onSaveVacations(updated);
    } else {
      const newVac: VacationRecord = {
        id: `vac_${Date.now()}`,
        employeeId: emp.id,
        employeeName: emp.name,
        acquisitionPeriodStart,
        acquisitionPeriodEnd,
        startDate,
        endDate,
        daysCount,
        sellDaysCount,
        baseSalary,
        oneThirdBonus: calc.valorUmTercoGozo,
        pecuniaryAllowance: calc.valorAbonoPecuniario + calc.valorUmTercoAbono,
        thirteenthAdvance,
        thirteenthAmount: calc.valorDecimoAdiantamento,
        inssDiscount: calc.inssDiscount,
        irrfDiscount: calc.irrfDiscount,
        netAmount: calc.valorLiquido,
        totalAmount: calc.totalBruto,
        status,
        notes,
        createdAt: new Date().toISOString(),
      };
      onSaveVacations([newVac, ...vacations]);
    }
    setIsModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    const item = vacations.find(v => v.id === id);
    const isConfirmed = await confirm({
      title: 'Excluir Registro de Férias',
      message: item?.employeeName
        ? `Deseja realmente excluir o registro de férias de "${item.employeeName}"?`
        : 'Deseja realmente excluir este registro de férias?',
      confirmLabel: 'Sim, Excluir',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });
    if (isConfirmed) {
      onSaveVacations(vacations.filter(v => v.id !== id));
    }
  };

  const handleToggleStatus = (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'agendado' ? 'em_gozo' : currentStatus === 'em_gozo' ? 'concluido' : 'agendado';
    onSaveVacations(vacations.map(v => v.id === id ? { ...v, status: nextStatus as any } : v));
  };

  const handlePreviewReceipt = () => {
    const emp = selectedEmp || employees.find(e => e.id === selectedEmployeeId);
    const previewData: VacationRecord = {
      id: editingVacation ? editingVacation.id : `vac_preview_${Date.now()}`,
      employeeId: emp?.id || selectedEmployeeId,
      employeeName: emp?.name || 'Colaborador',
      acquisitionPeriodStart,
      acquisitionPeriodEnd,
      startDate,
      endDate,
      daysCount,
      sellDaysCount,
      baseSalary,
      oneThirdBonus: financials.valorUmTercoGozo,
      pecuniaryAllowance: financials.valorAbonoPecuniario + financials.valorUmTercoAbono,
      thirteenthAdvance,
      thirteenthAmount: financials.valorDecimoAdiantamento,
      inssDiscount: financials.inssDiscount,
      irrfDiscount: financials.irrfDiscount,
      netAmount: financials.valorLiquido,
      totalAmount: financials.totalBruto,
      status,
      notes,
      createdAt: editingVacation?.createdAt || new Date().toISOString(),
    };
    setPrintingVacation(previewData);
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      
      {/* Top Header & Actions */}
      <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-3 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-black dark:text-white">
        <div className="flex items-center space-x-2">
          <div className="p-2 rounded-lg bg-blue-100/70 dark:bg-stone-800 border border-blue-200/80 dark:border-stone-700 text-black dark:text-white">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-black dark:text-white">
              Controle e Agendamento de Férias
            </h3>
            <p className="text-xs text-black/85 dark:text-stone-300 font-medium">
              Planejamento de períodos aquisitivos, gozo e 1/3 constitucional
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleOpenModal()}
          className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition shadow-xs cursor-pointer active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Agendar Férias</span>
        </button>
      </div>

      {/* Quick Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-2.5 shadow-xs text-black dark:text-white">
          <span className="text-[11px] font-black text-black dark:text-stone-300 block uppercase">Férias Agendadas</span>
          <span className="text-base font-black text-black dark:text-sky-400 font-['Outfit']">
            {agendadasCount} colaborador(es)
          </span>
        </div>
        <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-2.5 shadow-xs text-black dark:text-white">
          <span className="text-[11px] font-black text-black dark:text-stone-300 block uppercase">Em Gozo Atual</span>
          <span className="text-base font-black text-black dark:text-amber-400 font-['Outfit']">
            {emGozoCount} colaborador(es)
          </span>
        </div>
        <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-2.5 shadow-xs text-black dark:text-white">
          <span className="text-[11px] font-black text-black dark:text-stone-300 block uppercase">Concluídas</span>
          <span className="text-base font-black text-black dark:text-emerald-400 font-['Outfit']">
            {concluidasCount} registro(s)
          </span>
        </div>
        <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-2.5 shadow-xs text-black dark:text-white">
          <span className="text-[11px] font-black text-black dark:text-stone-300 block uppercase">Total Férias Lançadas</span>
          <span className="text-base font-black text-black dark:text-white font-['Outfit']">
            {formatCurrencyBRL(totalValorFerias)}
          </span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl px-3 py-2 shadow-xs flex items-center justify-between text-black dark:text-white">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-black dark:text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar colaborador..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1.5 text-xs border border-blue-300 dark:border-stone-700 rounded-lg bg-blue-100/50 dark:bg-stone-800 text-black dark:text-white placeholder-black/60 dark:placeholder-stone-400 outline-none focus:ring-1 focus:ring-sky-600"
          />
        </div>
        <span className="text-xs text-black/85 dark:text-stone-300 font-bold hidden sm:block">
          {filtered.length} registro(s) de férias
        </span>
      </div>

      {/* Table */}
      <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl overflow-hidden shadow-xs text-black dark:text-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-blue-100/60 dark:bg-stone-800 text-[11px] font-black text-black dark:text-white uppercase tracking-wider border-b border-blue-200/80 dark:border-stone-700">
              <tr>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Colaborador</th>
                <th className="py-2.5 px-3">Período de Gozo</th>
                <th className="py-2.5 px-3 text-center">Dias / Venda</th>
                <th className="py-2.5 px-3 text-right">1/3 Constitucional</th>
                <th className="py-2.5 px-3 text-right">Abono Pecuniário</th>
                <th className="py-2.5 px-3 text-right">Total Férias</th>
                <th className="py-2.5 px-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-200/60 dark:divide-stone-800 bg-[#87AFE3] dark:bg-stone-900">
              {filtered.length > 0 ? (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-blue-200/40 dark:hover:bg-stone-800/60 transition">
                    <td className="py-2 px-3">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(item.id, item.status)}
                        className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-bold cursor-pointer transition border ${
                          item.status === 'em_gozo'
                            ? 'bg-amber-100 border-amber-300 text-amber-900'
                            : item.status === 'concluido'
                            ? 'bg-emerald-100 border-emerald-300 text-emerald-900'
                            : 'bg-blue-100 border-blue-300 text-blue-900'
                        }`}
                      >
                        <span>
                          {item.status === 'em_gozo' ? 'Em Gozo' : item.status === 'concluido' ? 'Concluído' : 'Agendado'}
                        </span>
                      </button>
                    </td>

                    <td className="py-2 px-3">
                      <div className="font-bold text-black dark:text-white text-xs">
                        {item.employeeName}
                      </div>
                      {item.acquisitionPeriodStart && (
                        <div className="text-[10px] text-black/80 dark:text-stone-300 font-medium">
                          Aq: {formatDateBR(item.acquisitionPeriodStart)} a {formatDateBR(item.acquisitionPeriodEnd)}
                        </div>
                      )}
                    </td>

                    <td className="py-2 px-3 text-black/85 dark:text-stone-300 font-medium text-xs whitespace-nowrap">
                      {formatDateBR(item.startDate)} até {formatDateBR(item.endDate)}
                    </td>

                    <td className="py-2 px-3 text-center text-xs">
                      <span className="font-bold text-black dark:text-white">{item.daysCount} dias</span>
                      {item.sellDaysCount > 0 && (
                        <span className="text-[10px] block text-amber-900 dark:text-amber-300 font-bold">
                          (+ {item.sellDaysCount}d vendidos)
                        </span>
                      )}
                    </td>

                    <td className="py-2 px-3 text-right font-medium text-black dark:text-stone-200 text-xs font-['Outfit']">
                      {formatCurrencyBRL(item.oneThirdBonus)}
                    </td>

                    <td className="py-2 px-3 text-right font-medium text-black dark:text-stone-200 text-xs font-['Outfit']">
                      {item.pecuniaryAllowance ? formatCurrencyBRL(item.pecuniaryAllowance) : '-'}
                    </td>

                    <td className="py-2 px-3 text-right font-black text-black dark:text-white text-xs whitespace-nowrap font-['Outfit']">
                      {formatCurrencyBRL(item.totalAmount)}
                    </td>

                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          type="button"
                          onClick={() => setPrintingVacation(item)}
                          className="p-1 text-black dark:text-sky-400 hover:bg-blue-200/60 dark:hover:bg-stone-800 rounded transition cursor-pointer"
                          title="Imprimir Aviso/Recibo de Férias"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenModal(item)}
                          className="p-1 text-black dark:text-sky-400 hover:bg-blue-200/60 dark:hover:bg-stone-800 rounded transition cursor-pointer"
                          title="Editar Férias"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="p-1 text-black/70 dark:text-stone-400 hover:text-rose-700 hover:bg-rose-100 dark:hover:bg-rose-950/40 rounded transition cursor-pointer"
                          title="Excluir Férias"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-black/75 dark:text-stone-400 text-xs">
                    Nenhum registro de férias cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* JANELA PROFISSIONAL DE PROGRAMAÇÃO E CÁLCULO DE FÉRIAS (MODAL PREMIUM) */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[95vh]">
            
            {/* 1. CABEÇALHO DO MODAL */}
            <div className="flex items-center justify-between px-6 py-4 bg-[#0963cb] text-white shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-white/15 text-white">
                  <Palmtree className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight text-white uppercase font-['Outfit']">
                    Programação e Cálculo de Férias
                  </h3>
                  <p className="text-xs text-white/80 font-medium">
                    Planejamento trabalhista oficial, apuração de proventos CLT e retenções legais
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                {/* Badge Discreto com o Status Atual */}
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border shadow-xs ${
                  status === 'em_gozo'
                    ? 'bg-emerald-500 text-white border-emerald-400'
                    : status === 'concluido'
                    ? 'bg-slate-700 text-white border-slate-600'
                    : status === 'cancelado'
                    ? 'bg-rose-600 text-white border-rose-500'
                    : 'bg-white text-[#0963cb] border-blue-200'
                }`}>
                  {status === 'em_gozo' ? 'Gozo' : status === 'concluido' ? 'Concluído' : status === 'cancelado' ? 'Cancelado' : 'Agendado'}
                </span>

                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
                  title="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Linha Elegante com Foto em Miniatura, Nome Completo, Cargo e Salário Base */}
            <div className="px-6 py-3.5 bg-stone-50 dark:bg-stone-800/80 border-b border-stone-200 dark:border-stone-700/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center space-x-3.5 min-w-0">
                <EmployeeAvatar
                  photoUrl={selectedEmp?.photoUrl || (selectedEmp as any)?.foto_url}
                  name={selectedEmp?.name || 'Colaborador'}
                  size="md"
                  className="rounded-xl border border-stone-300 dark:border-stone-700 shrink-0 shadow-xs"
                />
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <h4 className="text-sm sm:text-base font-black text-black dark:text-white uppercase truncate font-['Outfit']">
                      {selectedEmp?.name || 'Selecione o Colaborador'}
                    </h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-stone-200 dark:bg-stone-700 text-stone-800 dark:text-stone-200 uppercase">
                      {selectedEmp?.contractType || 'CLT'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3 text-xs text-stone-600 dark:text-stone-300 mt-0.5">
                    <span className="font-semibold">{selectedEmp?.role || 'Função não informada'}</span>
                    <span>•</span>
                    <span>
                      Salário Base: <strong className="font-mono font-black text-black dark:text-white">{formatBRL(baseSalary)}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Seletor rápido de colaborador para alteração ou inclusão */}
              <div className="w-full sm:w-auto">
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => handleSelectEmployee(e.target.value)}
                  className="w-full sm:w-auto px-3 py-1.5 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-600 rounded-lg text-xs font-bold text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-[#0963cb] cursor-pointer shadow-xs"
                >
                  <option value="">Trocar Colaborador...</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.role}) - {formatBRL(emp.salary || emp.baseSalary || 3500)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* FORMULÁRIO COM OS 3 BLOCOS MODULARES */}
            <form onSubmit={handleSaveModal} className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 bg-stone-100/70 dark:bg-stone-950 flex-1">
              
              {/* 2. BLOCO 1: CONFIGURAÇÃO DO PERÍODO (GRID DE 3 COLUNAS) */}
              <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-2.5">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-[#0963cb]" />
                    <span className="text-xs font-black uppercase tracking-wider text-black dark:text-white">
                      1. Configuração do Período & Parâmetros
                    </span>
                  </div>
                  <span className="text-[11px] font-medium text-stone-500">
                    Período Aquisitivo: {acquisitionPeriodStart ? formatDateBR(acquisitionPeriodStart) : '01/01/2025'} a {acquisitionPeriodEnd ? formatDateBR(acquisitionPeriodEnd) : '31/12/2025'}
                  </span>
                </div>

                {/* Grid Principal de 3 Colunas */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Coluna 1: Data de Início do Gozo */}
                  <div>
                    <label className="block text-xs font-bold text-stone-800 dark:text-stone-200 mb-1.5">
                      Data de Início do Gozo <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => handleStartDateChange(e.target.value)}
                      className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-bold text-black dark:text-white outline-none focus:ring-2 focus:ring-[#0963cb] transition"
                      required
                    />
                  </div>

                  {/* Coluna 2: Data de Término do Gozo */}
                  <div>
                    <label className="block text-xs font-bold text-stone-800 dark:text-stone-200 mb-1.5">
                      Data de Término do Gozo <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => handleEndDateChange(e.target.value)}
                      className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-bold text-black dark:text-white outline-none focus:ring-2 focus:ring-[#0963cb] transition"
                      required
                    />
                  </div>

                  {/* Coluna 3: Total de Dias de Gozo */}
                  <div>
                    <label className="block text-xs font-bold text-stone-800 dark:text-stone-200 mb-1.5">
                      Total de Dias de Gozo
                    </label>
                    <div className="px-3 py-2 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-lg flex items-center justify-between">
                      <span className="text-sm font-black text-[#0963cb] dark:text-sky-400 font-mono">
                        {daysCount} {daysCount === 1 ? 'Dia' : 'Dias'}
                      </span>
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm bg-blue-200/70 dark:bg-blue-900 text-blue-900 dark:text-blue-200">
                        {sellDaysCount > 0 ? `${daysCount}d Gozo + ${sellDaysCount}d Abono` : 'Integral 30d'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Linha 2 de Parâmetros: Venda de Dias, Adiantamento 13º e Situação */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                  {/* Venda de Dias / Abono Pecuniário */}
                  <div>
                    <label className="block text-xs font-bold text-stone-800 dark:text-stone-200 mb-1.5">
                      Venda de Dias / Abono Pecuniário
                    </label>
                    <select
                      value={sellDaysCount}
                      onChange={(e) => handleAbonoChange(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-bold text-black dark:text-white outline-none focus:ring-2 focus:ring-[#0963cb] cursor-pointer"
                    >
                      <option value={0}>Sem Abono (0 dias - Gozo 30 dias)</option>
                      <option value={10}>10 Dias (Abono Pecuniário - Gozo 20 dias)</option>
                    </select>
                  </div>

                  {/* Adiantamento de 13º Salário */}
                  <div>
                    <label className="block text-xs font-bold text-stone-800 dark:text-stone-200 mb-1.5">
                      Adiantamento 13º Salário
                    </label>
                    <select
                      value={thirteenthAdvance ? 'sim' : 'nao'}
                      onChange={(e) => setThirteenthAdvance(e.target.value === 'sim')}
                      className="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-bold text-black dark:text-white outline-none focus:ring-2 focus:ring-[#0963cb] cursor-pointer"
                    >
                      <option value="nao">Não (Sem adiantamento)</option>
                      <option value="sim">Sim (+50% da 1ª Parcela)</option>
                    </select>
                  </div>

                  {/* Situação das Férias */}
                  <div>
                    <label className="block text-xs font-bold text-stone-800 dark:text-stone-200 mb-1.5">
                      Situação das Férias
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-bold text-black dark:text-white outline-none focus:ring-2 focus:ring-[#0963cb] cursor-pointer"
                    >
                      <option value="agendado">Agendado</option>
                      <option value="em_gozo">Em Gozo</option>
                      <option value="concluido">Concluído</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 3. BLOCO 2: DEMONSTRATIVO FINANCEIRO DETALHADO (TABELA DE PROVENTOS E DESCONTOS) */}
              <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden shadow-xs">
                <div className="px-4 sm:px-5 py-3 bg-stone-50 dark:bg-stone-800/60 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-[#0963cb]" />
                    <span className="text-xs font-black uppercase tracking-wider text-black dark:text-white">
                      2. Demonstrativo Financeiro de Proventos e Descontos
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-stone-500 uppercase">
                    Salário Base: {formatBRL(baseSalary)} ({formatBRL(financials.dailyRate)}/dia)
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-stone-100/90 dark:bg-stone-800 text-[10px] font-black uppercase text-stone-700 dark:text-stone-300 border-b border-stone-200 dark:border-stone-800">
                      <tr>
                        <th className="py-2.5 px-4 text-left">Rubrica / Discriminação</th>
                        <th className="py-2.5 px-4 text-center w-28">Referência</th>
                        <th className="py-2.5 px-4 text-right w-36 text-emerald-700 dark:text-emerald-400">Proventos (+)</th>
                        <th className="py-2.5 px-4 text-right w-36 text-rose-700 dark:text-rose-400">Descontos (-)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60 text-stone-900 dark:text-stone-100">
                      {/* Linha 1: Valor das Férias */}
                      <tr className="hover:bg-stone-50/60 dark:hover:bg-stone-800/40 transition">
                        <td className="py-2.5 px-4 font-semibold">
                          Valor das Férias (Gozo Regular CLT)
                        </td>
                        <td className="py-2.5 px-4 text-center font-bold text-stone-600 dark:text-stone-400">
                          {financials.effectiveGozoDays} dias
                        </td>
                        <td className="py-2.5 px-4 text-right font-black font-mono text-emerald-700 dark:text-emerald-400">
                          {formatBRL(financials.valorFeriasGozo)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-stone-400">
                          -
                        </td>
                      </tr>

                      {/* Linha 2: 1/3 Constitucional de Férias */}
                      <tr className="hover:bg-stone-50/60 dark:hover:bg-stone-800/40 transition">
                        <td className="py-2.5 px-4 font-semibold">
                          1/3 Constitucional de Férias (Art. 7º, XVII CF/88)
                        </td>
                        <td className="py-2.5 px-4 text-center font-bold text-stone-600 dark:text-stone-400">
                          33,33%
                        </td>
                        <td className="py-2.5 px-4 text-right font-black font-mono text-emerald-700 dark:text-emerald-400">
                          {formatBRL(financials.valorUmTercoGozo)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-stone-400">
                          -
                        </td>
                      </tr>

                      {/* Linhas 3 e 4: Abono Pecuniário e 1/3 Abono (se ativados) */}
                      {sellDaysCount > 0 && (
                        <>
                          <tr className="hover:bg-stone-50/60 dark:hover:bg-stone-800/40 transition bg-amber-50/25 dark:bg-amber-950/15">
                            <td className="py-2.5 px-4 font-semibold">
                              Abono Pecuniário (Venda de 10 Dias - Art. 143 CLT)
                            </td>
                            <td className="py-2.5 px-4 text-center font-bold text-amber-700 dark:text-amber-400">
                              {sellDaysCount} dias
                            </td>
                            <td className="py-2.5 px-4 text-right font-black font-mono text-emerald-700 dark:text-emerald-400">
                              {formatBRL(financials.valorAbonoPecuniario)}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono text-stone-400">
                              -
                            </td>
                          </tr>
                          <tr className="hover:bg-stone-50/60 dark:hover:bg-stone-800/40 transition bg-amber-50/25 dark:bg-amber-950/15">
                            <td className="py-2.5 px-4 font-semibold">
                              1/3 Constitucional sobre Abono Pecuniário
                            </td>
                            <td className="py-2.5 px-4 text-center font-bold text-amber-700 dark:text-amber-400">
                              33,33%
                            </td>
                            <td className="py-2.5 px-4 text-right font-black font-mono text-emerald-700 dark:text-emerald-400">
                              {formatBRL(financials.valorUmTercoAbono)}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono text-stone-400">
                              -
                            </td>
                          </tr>
                        </>
                      )}

                      {/* Linha 5: Adiantamento do 13º Salário (se ativado) */}
                      {thirteenthAdvance && (
                        <tr className="hover:bg-stone-50/60 dark:hover:bg-stone-800/40 transition bg-blue-50/25 dark:bg-blue-950/15">
                          <td className="py-2.5 px-4 font-semibold">
                            Adiantamento da 1ª Parcela do 13º Salário (Lei 4.749/65)
                          </td>
                          <td className="py-2.5 px-4 text-center font-bold text-blue-700 dark:text-blue-400">
                            50,00%
                          </td>
                          <td className="py-2.5 px-4 text-right font-black font-mono text-emerald-700 dark:text-emerald-400">
                            {formatBRL(financials.valorDecimoAdiantamento)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-stone-400">
                            -
                          </td>
                        </tr>
                      )}

                      {/* Linha 6: Desconto de INSS sobre Férias */}
                      <tr className="hover:bg-stone-50/60 dark:hover:bg-stone-800/40 transition">
                        <td className="py-2.5 px-4 font-semibold">
                          Desconto de INSS sobre Férias (Tabela Progressiva)
                        </td>
                        <td className="py-2.5 px-4 text-center font-bold text-stone-600 dark:text-stone-400">
                          {financials.inssEffectiveRate.toFixed(2).replace('.', ',')}%
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-stone-400">
                          -
                        </td>
                        <td className="py-2.5 px-4 text-right font-black font-mono text-rose-700 dark:text-rose-400">
                          {formatBRL(financials.inssDiscount)}
                        </td>
                      </tr>

                      {/* Linha 7: Desconto de IRRF sobre Férias */}
                      <tr className="hover:bg-stone-50/60 dark:hover:bg-stone-800/40 transition">
                        <td className="py-2.5 px-4 font-semibold">
                          Desconto de IRRF sobre Férias (Retenção na Fonte)
                        </td>
                        <td className="py-2.5 px-4 text-center font-bold text-stone-600 dark:text-stone-400">
                          {financials.irrfRate > 0 ? `${financials.irrfRate.toFixed(1).replace('.', ',')}%` : 'Isento'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-stone-400">
                          -
                        </td>
                        <td className="py-2.5 px-4 text-right font-black font-mono text-rose-700 dark:text-rose-400">
                          {financials.irrfDiscount > 0 ? formatBRL(financials.irrfDiscount) : 'R$ 0,00'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4. BLOCO 3: RESUMO E TOTAIS DO RECIBO (RODAPÉ DESTACADO COM DUAS CORES CONTRASTANTES) */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-0 rounded-2xl overflow-hidden border border-stone-300 dark:border-stone-700 shadow-md">
                
                {/* Lado Esquerdo: Proventos Brutos e Descontos (Fundo Neutro/Suave) */}
                <div className="md:col-span-6 bg-white dark:bg-stone-800/90 p-4 sm:p-5 flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between text-xs pb-2 border-b border-stone-200 dark:border-stone-700">
                    <span className="font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wide">
                      Total Bruto (Proventos):
                    </span>
                    <span className="text-sm font-black text-emerald-700 dark:text-emerald-400 font-mono">
                      {formatBRL(financials.totalBruto)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pb-2 border-b border-stone-200 dark:border-stone-700">
                    <span className="font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wide">
                      Total de Descontos (INSS + IRRF):
                    </span>
                    <span className="text-sm font-black text-rose-700 dark:text-rose-400 font-mono">
                      {formatBRL(financials.totalDescontos)}
                    </span>
                  </div>

                  <div className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center justify-between pt-1">
                    <span>Base Previdenciária: {formatBRL(financials.baseINSS)}</span>
                    <span>Base IRRF: {formatBRL(financials.baseIRRF)}</span>
                  </div>
                </div>

                {/* Lado Direito: Valor Líquido em Alto Destaque Corporativo (Azul/Verde) */}
                <div className="md:col-span-6 bg-[#0963cb]/10 dark:bg-blue-950/40 border-t md:border-t-0 md:border-l border-blue-200 dark:border-blue-900 p-4 sm:p-5 flex flex-col justify-between text-right">
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-[#0963cb] dark:text-sky-300 block">
                      Valor Líquido a Pagar
                    </span>
                    <div className="text-2xl sm:text-3xl font-black text-[#0963cb] dark:text-sky-400 font-['Outfit'] mt-1">
                      {formatBRL(financials.valorLiquido)}
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-blue-200/80 dark:border-blue-800/80">
                    <p className="text-[11px] font-bold text-stone-700 dark:text-stone-300">
                      Data limite para pagamento: até 2 dias antes do início do gozo (
                      <span className="text-[#0963cb] dark:text-sky-300 font-black underline">
                        {paymentDeadline}
                      </span>
                      )
                    </p>
                  </div>
                </div>

              </div>

              {/* Observações Opcionais */}
              <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-3.5 shadow-xs">
                <label className="block text-xs font-bold text-stone-800 dark:text-stone-200 mb-1">
                  Observações Gerais (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-2 border border-stone-300 dark:border-stone-700 rounded-lg bg-stone-50 dark:bg-stone-800 text-black dark:text-white outline-none focus:ring-2 focus:ring-[#0963cb] resize-none text-xs"
                />
              </div>

              {/* 5. AÇÕES (BOTÕES DE RODAPÉ) */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                {/* Botão Auxiliar: Visualizar Recibo (PDF) */}
                <button
                  type="button"
                  onClick={handlePreviewReceipt}
                  className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-4 py-2 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 font-bold text-xs rounded-xl shadow-xs transition cursor-pointer active:scale-95"
                  title="Abrir prévia de impressão e documento A4 do recibo de férias"
                >
                  <Printer className="w-4 h-4 text-[#0963cb]" />
                  <span>Visualizar Recibo (PDF)</span>
                </button>

                {/* Botões Primários: Cancelar e Salvar */}
                <div className="flex items-center space-x-2.5 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 font-bold text-xs hover:bg-stone-50 dark:hover:bg-stone-700 cursor-pointer transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#0963cb] hover:bg-[#0852a8] text-white font-bold text-xs transition shadow-sm cursor-pointer active:scale-95"
                  >
                    Salvar Férias
                  </button>
                </div>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Modal Aviso e Recibo de Férias para Impressão */}
      <VacationReceiptModal
        isOpen={Boolean(printingVacation)}
        vacation={printingVacation}
        vacationData={printingVacation}
        employee={employees.find(e => e.id === printingVacation?.employeeId || e.name === printingVacation?.employeeName)}
        onClose={() => setPrintingVacation(null)}
      />

    </div>
  );
};
