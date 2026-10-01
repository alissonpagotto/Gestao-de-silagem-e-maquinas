import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { 
  Plus, 
  Search, 
  Calendar, 
  Trash2, 
  Edit2, 
  Palmtree, 
  X,
  Printer,
  FileText,
  Wifi
} from 'lucide-react';
import { Employee, VacationRecord } from '../../types';
import { formatCurrencyBRL, formatDateBR, getActiveCompanyId, saveStoredVacations } from '../../lib/storage';
import { useConfirm } from '../../context/ConfirmContext';
import { useAuth } from '../../context/AuthContext';
import { isSupabaseConfigured } from '../../lib/supabase';
import {
  saveCloudVacations,
  fetchCloudVacations,
  upsertRhFeriasRecord,
  deleteRhFeriasRecord,
  toValidUUID,
} from '../../lib/supabaseService';
import {
  VacationReceiptModal,
  subscribeToVacationRealtimeChannel,
  sendVacationRealtimeBroadcast,
} from './VacationReceiptModal';
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
 * Converte texto digitado em número decimal flexível (padrão PT-BR ou numérico direto)
 */
function parseFlexibleCurrency(val: string | number | undefined | null): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.max(0, Math.round(val * 100) / 100);
  if (!val) return 0;
  const cleaned = String(val).replace(/[R$\s-]/g, '').trim();
  if (!cleaned) return 0;

  if (cleaned.includes('.') && cleaned.includes(',')) {
    const normalized = cleaned.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(normalized);
    return isNaN(num) ? 0 : Math.max(0, Math.round(num * 100) / 100);
  }

  if (cleaned.includes(',')) {
    const normalized = cleaned.replace(',', '.');
    const num = parseFloat(normalized);
    return isNaN(num) ? 0 : Math.max(0, Math.round(num * 100) / 100);
  }

  if (cleaned.includes('.')) {
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      const normalized = cleaned.replace(/\./g, '');
      const num = parseFloat(normalized);
      return isNaN(num) ? 0 : Math.max(0, Math.round(num * 100) / 100);
    }
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : Math.max(0, Math.round(num * 100) / 100);
  }

  const num = parseFloat(cleaned.replace(/[^\d]/g, ''));
  return isNaN(num) ? 0 : Math.max(0, Math.round(num * 100) / 100);
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
 * Input numérico discreto (sem bordas grossas, estilo border-bottom que se destaca ao focar)
 */
interface DiscreteNumericInputProps {
  value: number;
  onChange: (newVal: number) => void;
  colorClass?: string;
  ariaLabel?: string;
}

const DiscreteNumericInput: React.FC<DiscreteNumericInputProps> = ({
  value,
  onChange,
  colorClass = 'text-emerald-700 dark:text-emerald-400',
  ariaLabel,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [rawText, setRawText] = useState(() => formatBRL(value));

  useEffect(() => {
    if (!isFocused) {
      setRawText(formatBRL(value));
    }
  }, [value, isFocused]);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    const formattedNum = (Number(value) || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    setRawText(formattedNum);
    setTimeout(() => {
      try {
        e.target.select();
      } catch (_) {}
    }, 0);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valStr = e.target.value;
    setRawText(valStr);
    const parsed = parseFlexibleCurrency(valStr);
    onChange(parsed);
  };

  const handleBlur = () => {
    setIsFocused(false);
    setRawText(formatBRL(value));
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={ariaLabel}
      value={isFocused ? rawText : formatBRL(value)}
      onFocus={handleFocus}
      onChange={handleChange}
      onBlur={handleBlur}
      className={`w-28 text-right font-black font-mono text-[13px] leading-tight bg-transparent border-0 border-b border-transparent hover:border-stone-400 focus:border-[#0963cb] focus:bg-blue-50/70 dark:focus:bg-blue-950/50 focus:outline-none px-1 py-0.5 rounded-t-xs transition-colors cursor-text ${colorClass}`}
    />
  );
};

/**
 * Componente Toggle Switch Liga/Desliga para INSS e IRRF
 */
interface DiscountSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

const DiscountSwitch: React.FC<DiscountSwitchProps> = ({ checked, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    title={checked ? `${label}: Ativado (clique para zerar)` : `${label}: Desativado (clique para calcular)`}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-4 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#0963cb] ${
      checked ? 'bg-[#0963cb]' : 'bg-stone-300 dark:bg-stone-700'
    }`}
  >
    <span
      className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
        checked ? 'translate-x-4' : 'translate-x-0'
      }`}
    />
  </button>
);

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
  const { currentUser, companyId: authCompanyId } = useAuth();
  const activeTenantId = useMemo(() => {
    return authCompanyId || currentUser?.id || getActiveCompanyId() || 'default';
  }, [authCompanyId, currentUser?.id]);

  const clientInstanceIdRef = useRef<string>(`vac_tab_${Math.random().toString(36).slice(2, 10)}`);
  const vacationsRef = useRef<VacationRecord[]>(vacations);
  useEffect(() => {
    vacationsRef.current = vacations;
  }, [vacations]);

  const [searchTerm, setSearchTerm] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVacation, setEditingVacation] = useState<VacationRecord | null>(null);
  const [printingVacation, setPrintingVacation] = useState<VacationRecord | null>(null);

  // Form State
  const [activeDraftId, setActiveDraftId] = useState<string>('');
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

  // Editable Financial Overrides & Switches
  const [customFeriasGozo, setCustomFeriasGozo] = useState<number | null>(null);
  const [customUmTercoGozo, setCustomUmTercoGozo] = useState<number | null>(null);
  const [customAbonoPecuniario, setCustomAbonoPecuniario] = useState<number | null>(null);
  const [customUmTercoAbono, setCustomUmTercoAbono] = useState<number | null>(null);
  const [customDecimoAdiantamento, setCustomDecimoAdiantamento] = useState<number | null>(null);
  const [inssEnabled, setInssEnabled] = useState<boolean>(true);
  const [irrfEnabled, setIrrfEnabled] = useState<boolean>(true);
  const [customInssDiscount, setCustomInssDiscount] = useState<number | null>(null);
  const [customIrrfDiscount, setCustomIrrfDiscount] = useState<number | null>(null);

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

  // Cálculos financeiros dinâmicos completos da janela modal (recalcula instantaneamente no front-end)
  const financials = useMemo(() => {
    const dailyRate = baseSalary > 0 ? baseSalary / 30 : 0;
    const effectiveGozoDays = Math.max(0, daysCount);

    const autoFeriasGozo = Math.round((dailyRate * effectiveGozoDays) * 100) / 100;
    const valorFeriasGozo = customFeriasGozo !== null ? customFeriasGozo : autoFeriasGozo;

    const autoUmTercoGozo = Math.round((valorFeriasGozo / 3) * 100) / 100;
    const valorUmTercoGozo = customUmTercoGozo !== null ? customUmTercoGozo : autoUmTercoGozo;

    const autoAbonoPecuniario = sellDaysCount > 0 ? Math.round((dailyRate * sellDaysCount) * 100) / 100 : 0;
    const valorAbonoPecuniario = sellDaysCount > 0
      ? (customAbonoPecuniario !== null ? customAbonoPecuniario : autoAbonoPecuniario)
      : 0;

    const autoUmTercoAbono = sellDaysCount > 0 ? Math.round((valorAbonoPecuniario / 3) * 100) / 100 : 0;
    const valorUmTercoAbono = sellDaysCount > 0
      ? (customUmTercoAbono !== null ? customUmTercoAbono : autoUmTercoAbono)
      : 0;

    const autoDecimo = thirteenthAdvance ? Math.round((baseSalary / 2) * 100) / 100 : 0;
    const valorDecimoAdiantamento = thirteenthAdvance
      ? (customDecimoAdiantamento !== null ? customDecimoAdiantamento : autoDecimo)
      : 0;

    const totalBruto = Math.round(
      (valorFeriasGozo + valorUmTercoGozo + valorAbonoPecuniario + valorUmTercoAbono + valorDecimoAdiantamento) * 100
    ) / 100;

    // Regra de Negócio INSS: Se Switch ativado, calcula e aplica normalmente; se desativado, zera desconto e Base Previdenciária
    const rawBaseINSS = Math.round((valorFeriasGozo + valorUmTercoGozo) * 100) / 100;
    const baseINSS = inssEnabled ? rawBaseINSS : 0;
    const autoInss = calculateVacationINSS(baseINSS);
    const inssDiscount = inssEnabled
      ? (customInssDiscount !== null ? customInssDiscount : autoInss.inssAmount)
      : 0;
    const inssEffectiveRate = inssEnabled && baseINSS > 0
      ? (inssDiscount / baseINSS) * 100
      : 0;

    // Regra de Negócio IRRF: Se Switch ativado, calcula e aplica normalmente; se desativado, zera desconto e Base correspondente
    const rawBaseIRRF = Math.max(0, Math.round((rawBaseINSS - inssDiscount) * 100) / 100);
    const baseIRRF = irrfEnabled ? rawBaseIRRF : 0;
    const autoIrrf = calculateVacationIRRF(baseIRRF);
    const irrfDiscount = irrfEnabled
      ? (customIrrfDiscount !== null ? customIrrfDiscount : autoIrrf.irrfAmount)
      : 0;
    const irrfRate = irrfEnabled ? autoIrrf.irrfRate : 0;

    const totalDescontos = Math.round((inssDiscount + irrfDiscount) * 100) / 100;
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
      inssDiscount,
      inssEffectiveRate,
      baseIRRF,
      irrfDiscount,
      irrfRate,
      totalDescontos,
      valorLiquido,
    };
  }, [
    baseSalary,
    daysCount,
    sellDaysCount,
    thirteenthAdvance,
    customFeriasGozo,
    customUmTercoGozo,
    customAbonoPecuniario,
    customUmTercoAbono,
    customDecimoAdiantamento,
    inssEnabled,
    irrfEnabled,
    customInssDiscount,
    customIrrfDiscount,
  ]);

  // Data limite para pagamento (até 2 dias antes do início do gozo - Art. 145 CLT)
  const paymentDeadline = useMemo(() => {
    return formatPaymentDeadline(startDate);
  }, [startDate]);

  // Sincronização inicial com a tabela public.rh_ferias do Supabase
  useEffect(() => {
    if (!isSupabaseConfigured || !activeTenantId) return;
    let isMounted = true;
    fetchCloudVacations(activeTenantId)
      .then((cloudVacations) => {
        if (!isMounted || !cloudVacations || !Array.isArray(cloudVacations) || cloudVacations.length === 0) return;
        const currentList = vacationsRef.current;
        const map = new Map<string, VacationRecord>();
        currentList.forEach((v) => map.set(toValidUUID(v.id), { ...v, id: toValidUUID(v.id) }));
        cloudVacations.forEach((v) => map.set(toValidUUID(v.id), { ...v, id: toValidUUID(v.id) }));
        const merged = Array.from(map.values()).sort(
          (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
        saveStoredVacations(merged);
        onSaveVacations(merged);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [activeTenantId]);

  // Canal de Escuta Ativa (Supabase Realtime Channel) para sincronizar dispositivos do mesmo locatário
  useEffect(() => {
    const applyIncomingRecord = (incoming: VacationRecord, isFromDatabase = false) => {
      if (!incoming) return;
      const incomingId = toValidUUID(incoming.id);
      const normalizedIncoming: VacationRecord = { ...incoming, id: incomingId };

      // Atualiza na lista principal (UPDATE se existir, INSERT se vier do banco ou já estiver salvo)
      const currentList = vacationsRef.current;
      const existsInList = currentList.some(v => toValidUUID(v.id) === incomingId);
      if (existsInList) {
        const nextList = currentList.map(v =>
          toValidUUID(v.id) === incomingId ? { ...v, ...normalizedIncoming, id: toValidUUID(v.id) } : v
        );
        saveStoredVacations(nextList);
        onSaveVacations(nextList);
      } else if (isFromDatabase) {
        const nextList = [normalizedIncoming, ...currentList];
        saveStoredVacations(nextList);
        onSaveVacations(nextList);
      }

      // Se o modal de edição ou recibo estiver aberto para o mesmo registro, sincroniza os estados locais imediatamente
      setPrintingVacation(prev =>
        prev && toValidUUID(prev.id) === incomingId ? { ...prev, ...normalizedIncoming } : prev
      );

      if (isModalOpen && (!activeDraftId || toValidUUID(activeDraftId) === incomingId)) {
        if (normalizedIncoming.employeeId) setSelectedEmployeeId(normalizedIncoming.employeeId);
        if (normalizedIncoming.acquisitionPeriodStart) setAcquisitionPeriodStart(normalizedIncoming.acquisitionPeriodStart);
        if (normalizedIncoming.acquisitionPeriodEnd) setAcquisitionPeriodEnd(normalizedIncoming.acquisitionPeriodEnd);
        if (normalizedIncoming.startDate) setStartDate(normalizedIncoming.startDate);
        if (normalizedIncoming.endDate) setEndDate(normalizedIncoming.endDate);
        if (normalizedIncoming.daysCount !== undefined) setDaysCount(normalizedIncoming.daysCount);
        if (normalizedIncoming.sellDaysCount !== undefined) setSellDaysCount(normalizedIncoming.sellDaysCount);
        if (normalizedIncoming.baseSalary !== undefined) setBaseSalary(normalizedIncoming.baseSalary);
        if (normalizedIncoming.thirteenthAdvance !== undefined) setThirteenthAdvance(normalizedIncoming.thirteenthAdvance);
        if (normalizedIncoming.status) setStatus(normalizedIncoming.status);
        if (normalizedIncoming.notes !== undefined) setNotes(normalizedIncoming.notes);
        if (normalizedIncoming.customVacationAmount !== undefined) setCustomFeriasGozo(normalizedIncoming.customVacationAmount);
        if (normalizedIncoming.oneThirdBonus !== undefined) setCustomUmTercoGozo(normalizedIncoming.oneThirdBonus);
        if (normalizedIncoming.thirteenthAmount !== undefined) setCustomDecimoAdiantamento(normalizedIncoming.thirteenthAmount);
        if (normalizedIncoming.inssEnabled !== undefined) setInssEnabled(normalizedIncoming.inssEnabled);
        if (normalizedIncoming.irrfEnabled !== undefined) setIrrfEnabled(normalizedIncoming.irrfEnabled);
        if (normalizedIncoming.inssDiscount !== undefined) setCustomInssDiscount(normalizedIncoming.inssDiscount);
        if (normalizedIncoming.irrfDiscount !== undefined) setCustomIrrfDiscount(normalizedIncoming.irrfDiscount);
      }
    };

    const handleLocalEvent = (e: any) => {
      const detail = e?.detail;
      if (!detail || detail.senderId === clientInstanceIdRef.current) return;
      if (detail.tenantId && detail.tenantId !== activeTenantId) return;
      if (detail.vacation) {
        applyIncomingRecord(detail.vacation, false);
      }
    };

    window.addEventListener('silagem_vacation_realtime_mutation', handleLocalEvent);

    const unsubscribeRealtime = subscribeToVacationRealtimeChannel(
      activeTenantId,
      (payload: any) => {
        if (!payload || payload.senderId === clientInstanceIdRef.current) return;
        if (payload.tenantId && payload.tenantId !== activeTenantId) return;

        if (payload.eventType === 'DELETE' && payload.deletedId) {
          const targetId = toValidUUID(payload.deletedId);
          const nextList = vacationsRef.current.filter(v => toValidUUID(v.id) !== targetId);
          saveStoredVacations(nextList);
          onSaveVacations(nextList);
          return;
        }

        if (payload.vacation) {
          const isDbEvent = payload.senderId === 'postgres_rh_ferias' || Boolean(payload.eventType);
          applyIncomingRecord(payload.vacation, isDbEvent);
        }
      },
      (parsed: VacationRecord[]) => {
        saveStoredVacations(parsed);
        onSaveVacations(parsed);
        if (isModalOpen && activeDraftId) {
          const matched = parsed.find((v) => toValidUUID(v.id) === toValidUUID(activeDraftId));
          if (matched) applyIncomingRecord(matched, true);
        }
      }
    );

    return () => {
      window.removeEventListener('silagem_vacation_realtime_mutation', handleLocalEvent);
      unsubscribeRealtime();
    };
  }, [activeTenantId, isModalOpen, activeDraftId, onSaveVacations]);

  // Propaga alterações em tempo real para outros dispositivos conectados sob o mesmo tenantId
  const broadcastActiveVacationDraft = useCallback(
    (overrides?: Partial<VacationRecord>) => {
      const emp = employees.find(e => e.id === selectedEmployeeId);
      const canonicalId = toValidUUID(activeDraftId || editingVacation?.id || 'vac_live_draft');
      const draftRecord: VacationRecord = {
        id: canonicalId,
        companyId: activeTenantId,
        employeeId: emp?.id || selectedEmployeeId,
        employeeName: emp?.name || editingVacation?.employeeName || 'Colaborador',
        acquisitionPeriodStart,
        acquisitionPeriodEnd,
        startDate,
        endDate,
        daysCount,
        sellDaysCount,
        baseSalary,
        customVacationAmount: financials.valorFeriasGozo,
        oneThirdBonus: financials.valorUmTercoGozo,
        pecuniaryAllowance: Math.round((financials.valorAbonoPecuniario + financials.valorUmTercoAbono) * 100) / 100,
        thirteenthAdvance,
        thirteenthAmount: financials.valorDecimoAdiantamento,
        inssEnabled,
        irrfEnabled,
        baseINSS: financials.baseINSS,
        baseIRRF: financials.baseIRRF,
        inssDiscount: financials.inssDiscount,
        irrfDiscount: financials.irrfDiscount,
        totalDiscounts: financials.totalDescontos,
        netAmount: financials.valorLiquido,
        totalAmount: financials.totalBruto,
        status,
        notes,
        createdAt: editingVacation?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...overrides,
      };

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('silagem_vacation_realtime_mutation', {
            detail: {
              tenantId: activeTenantId,
              senderId: clientInstanceIdRef.current,
              vacation: draftRecord,
            },
          })
        );
      }

      if (isSupabaseConfigured) {
        sendVacationRealtimeBroadcast(activeTenantId, clientInstanceIdRef.current, draftRecord);
      }

      // Se já é um registro salvo sendo editado, atualiza via upsert em rh_ferias e na lista
      if (editingVacation) {
        const targetId = toValidUUID(editingVacation.id);
        const nextList = vacationsRef.current.map(v => (toValidUUID(v.id) === targetId ? draftRecord : v));
        saveStoredVacations(nextList);
        onSaveVacations(nextList);
        if (isSupabaseConfigured) {
          upsertRhFeriasRecord(draftRecord, activeTenantId).catch(() => {});
          saveCloudVacations(nextList, activeTenantId).catch(() => {});
        }
      }
    },
    [
      activeDraftId,
      editingVacation,
      activeTenantId,
      employees,
      selectedEmployeeId,
      acquisitionPeriodStart,
      acquisitionPeriodEnd,
      startDate,
      endDate,
      daysCount,
      sellDaysCount,
      baseSalary,
      financials,
      thirteenthAdvance,
      inssEnabled,
      irrfEnabled,
      status,
      notes,
      onSaveVacations,
    ]
  );

  const resetCustomOverrides = () => {
    setCustomFeriasGozo(null);
    setCustomUmTercoGozo(null);
    setCustomAbonoPecuniario(null);
    setCustomUmTercoAbono(null);
    setCustomDecimoAdiantamento(null);
    setCustomInssDiscount(null);
    setCustomIrrfDiscount(null);
  };

  const handleSelectEmployee = (empId: string) => {
    setSelectedEmployeeId(empId);
    const emp = employees.find(e => e.id === empId);
    if (emp) {
      const salary = emp.salary || emp.baseSalary || 3500;
      setBaseSalary(salary);
      resetCustomOverrides();
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
      setCustomFeriasGozo(null);
      setCustomUmTercoGozo(null);
    }
  };

  const handleAbonoChange = (newAbono: number) => {
    setSellDaysCount(newAbono);
    const newDays = newAbono === 10 ? 20 : 30;
    setDaysCount(newDays);
    setCustomFeriasGozo(null);
    setCustomUmTercoGozo(null);
    setCustomAbonoPecuniario(null);
    setCustomUmTercoAbono(null);
    if (startDate) {
      setEndDate(calculateEndDateFromStart(startDate, newDays));
    }
  };

  const handleOpenModal = (vacation?: VacationRecord) => {
    if (vacation) {
      setEditingVacation(vacation);
      setActiveDraftId(vacation.id);
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

      setCustomFeriasGozo(vacation.customVacationAmount !== undefined ? vacation.customVacationAmount : null);
      setCustomUmTercoGozo(vacation.oneThirdBonus !== undefined ? vacation.oneThirdBonus : null);
      setCustomAbonoPecuniario(null);
      setCustomUmTercoAbono(null);
      setCustomDecimoAdiantamento(vacation.thirteenthAmount !== undefined ? vacation.thirteenthAmount : null);
      setInssEnabled(vacation.inssEnabled !== undefined ? vacation.inssEnabled : true);
      setIrrfEnabled(vacation.irrfEnabled !== undefined ? vacation.irrfEnabled : true);
      setCustomInssDiscount(vacation.inssDiscount !== undefined ? vacation.inssDiscount : null);
      setCustomIrrfDiscount(vacation.irrfDiscount !== undefined ? vacation.irrfDiscount : null);
    } else {
      const draftId = toValidUUID(`vac_${Date.now()}`);
      setEditingVacation(null);
      setActiveDraftId(draftId);
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
      setInssEnabled(true);
      setIrrfEnabled(true);
      resetCustomOverrides();
    }
    setIsModalOpen(true);
  };

  const handleCloseProgrammingModal = () => {
    if (editingVacation) {
      broadcastActiveVacationDraft();
    }
    setIsModalOpen(false);
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find(e => e.id === selectedEmployeeId);
    if (!emp) return;

    // Estratégia de upsert: se já existir registro para o mesmo funcionário e mesmo período, reutiliza o ID
    const existingSamePeriod = !editingVacation
      ? vacations.find(
          (v) =>
            v.employeeId === emp.id &&
            v.startDate === startDate &&
            v.acquisitionPeriodStart === acquisitionPeriodStart
        )
      : null;

    const targetRecord = editingVacation || existingSamePeriod;
    const canonicalId = toValidUUID(targetRecord ? targetRecord.id : (activeDraftId || `vac_${Date.now()}`));

    const recordPayload: VacationRecord = {
      id: canonicalId,
      companyId: activeTenantId,
      employeeId: emp.id,
      employeeName: emp.name,
      acquisitionPeriodStart,
      acquisitionPeriodEnd,
      startDate,
      endDate,
      daysCount,
      sellDaysCount,
      baseSalary,
      customVacationAmount: financials.valorFeriasGozo,
      oneThirdBonus: financials.valorUmTercoGozo,
      pecuniaryAllowance: Math.round((financials.valorAbonoPecuniario + financials.valorUmTercoAbono) * 100) / 100,
      thirteenthAdvance,
      thirteenthAmount: financials.valorDecimoAdiantamento,
      inssEnabled,
      irrfEnabled,
      baseINSS: financials.baseINSS,
      baseIRRF: financials.baseIRRF,
      inssDiscount: financials.inssDiscount,
      irrfDiscount: financials.irrfDiscount,
      totalDiscounts: financials.totalDescontos,
      netAmount: financials.valorLiquido,
      totalAmount: financials.totalBruto,
      status,
      notes,
      createdAt: targetRecord?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const nextVacations = targetRecord
      ? vacations.map(v => (toValidUUID(v.id) === canonicalId ? recordPayload : v))
      : [recordPayload, ...vacations];

    saveStoredVacations(nextVacations);
    onSaveVacations(nextVacations);
    if (isSupabaseConfigured) {
      upsertRhFeriasRecord(recordPayload, activeTenantId).catch(() => {});
      saveCloudVacations(nextVacations, activeTenantId).catch(() => {});
    }
    broadcastActiveVacationDraft(recordPayload);
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
      const nextList = vacations.filter(v => v.id !== id);
      saveStoredVacations(nextList);
      onSaveVacations(nextList);
      if (isSupabaseConfigured) {
        deleteRhFeriasRecord(id, activeTenantId).catch(() => {});
        saveCloudVacations(nextList, activeTenantId).catch(() => {});
      }
    }
  };

  const handleToggleStatus = (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'agendado' ? 'em_gozo' : currentStatus === 'em_gozo' ? 'concluido' : 'agendado';
    const nextList = vacations.map(v => (v.id === id ? { ...v, status: nextStatus as any, updatedAt: new Date().toISOString() } : v));
    saveStoredVacations(nextList);
    onSaveVacations(nextList);
    const updatedItem = nextList.find(v => v.id === id);
    if (updatedItem && isSupabaseConfigured) {
      upsertRhFeriasRecord(updatedItem, activeTenantId).catch(() => {});
      saveCloudVacations(nextList, activeTenantId).catch(() => {});
      sendVacationRealtimeBroadcast(activeTenantId, clientInstanceIdRef.current, updatedItem);
    }
  };

  const handlePreviewReceipt = () => {
    const emp = selectedEmp || employees.find(e => e.id === selectedEmployeeId);
    const previewData: VacationRecord = {
      id: editingVacation ? editingVacation.id : (activeDraftId || `vac_preview_${Date.now()}`),
      companyId: activeTenantId,
      employeeId: emp?.id || selectedEmployeeId,
      employeeName: emp?.name || 'Colaborador',
      acquisitionPeriodStart,
      acquisitionPeriodEnd,
      startDate,
      endDate,
      daysCount,
      sellDaysCount,
      baseSalary,
      customVacationAmount: financials.valorFeriasGozo,
      oneThirdBonus: financials.valorUmTercoGozo,
      pecuniaryAllowance: Math.round((financials.valorAbonoPecuniario + financials.valorUmTercoAbono) * 100) / 100,
      thirteenthAdvance,
      thirteenthAmount: financials.valorDecimoAdiantamento,
      inssEnabled,
      irrfEnabled,
      baseINSS: financials.baseINSS,
      baseIRRF: financials.baseIRRF,
      inssDiscount: financials.inssDiscount,
      irrfDiscount: financials.irrfDiscount,
      totalDiscounts: financials.totalDescontos,
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
                  <tr key={item.id || item.employeeId} className="hover:bg-blue-200/40 dark:hover:bg-stone-800/60 transition">
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
      {/* JANELA DE PROGRAMAÇÃO E CÁLCULO DE FÉRIAS (COMPACTA E SINCRONIZADA)      */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-3 bg-black/75 backdrop-blur-xs overflow-y-hidden"
          style={{ overflowY: 'hidden' }}
        >
          <div
            className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150 flex flex-col"
            style={{ overflowY: 'hidden' }}
          >
            {/* 1. CABEÇALHO COMPACTO DO MODAL */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#0963cb] text-white shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 rounded-lg bg-white/15 text-white">
                  <Palmtree className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-black tracking-tight text-white uppercase font-['Outfit']">
                      Programação e Cálculo de Férias
                    </h3>
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-100 border border-emerald-400/30">
                      <Wifi className="w-2.5 h-2.5 text-emerald-300" />
                      <span>Tempo Real</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-white/80 font-medium">
                    Planejamento trabalhista oficial, apuração de proventos CLT e retenções legais
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2.5">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider border shadow-xs ${
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
                  onClick={handleCloseProgrammingModal}
                  className="p-1 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
                  title="Fechar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Linha Compacta com Foto, Nome, Cargo e Salário Base */}
            <div className="px-4 py-2 bg-stone-50 dark:bg-stone-800/80 border-b border-stone-200 dark:border-stone-700/80 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center space-x-2.5 min-w-0">
                <EmployeeAvatar
                  photoUrl={selectedEmp?.photoUrl || (selectedEmp as any)?.foto_url}
                  name={selectedEmp?.name || 'Colaborador'}
                  size="sm"
                  className="rounded-lg border border-stone-300 dark:border-stone-700 shrink-0 shadow-xs"
                />
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <h4 className="text-xs sm:text-sm font-black text-black dark:text-white uppercase truncate font-['Outfit']">
                      {selectedEmp?.name || 'Selecione o Colaborador'}
                    </h4>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-stone-200 dark:bg-stone-700 text-stone-800 dark:text-stone-200 uppercase">
                      {selectedEmp?.contractType || 'CLT'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 text-[11px] text-stone-600 dark:text-stone-300">
                    <span className="font-semibold">{selectedEmp?.role || 'Função não informada'}</span>
                    <span>•</span>
                    <span>
                      Salário Base: <strong className="font-mono font-black text-black dark:text-white">{formatBRL(baseSalary)}</strong>
                    </span>
                  </div>
                </div>
              </div>

              <div className="w-full sm:w-auto">
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => handleSelectEmployee(e.target.value)}
                  className="w-full sm:w-auto px-2.5 py-1 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-600 rounded-lg text-xs font-bold text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-[#0963cb] cursor-pointer shadow-xs"
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

            {/* FORMULÁRIO COMPACTADO: Padding 16px, Gap 0.75rem, overflow-y hidden */}
            <form
              onSubmit={handleSaveModal}
              className="p-4 overflow-y-hidden flex flex-col gap-3 bg-stone-100/70 dark:bg-stone-950 flex-1"
              style={{ padding: '16px', gap: '0.75rem', overflowY: 'hidden' }}
            >
              {/* 2. BLOCO 1: CONFIGURAÇÃO DO PERÍODO */}
              <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-3 shadow-xs flex flex-col gap-2">
                <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-1.5">
                  <div className="flex items-center space-x-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#0963cb]" />
                    <span className="text-[11px] font-black uppercase tracking-wider text-black dark:text-white">
                      1. Configuração do Período & Parâmetros
                    </span>
                  </div>
                  <span className="text-[10px] font-medium text-stone-500">
                    Período Aquisitivo: {acquisitionPeriodStart ? formatDateBR(acquisitionPeriodStart) : '01/01/2025'} a {acquisitionPeriodEnd ? formatDateBR(acquisitionPeriodEnd) : '31/12/2025'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-stone-700 dark:text-stone-300 mb-0.5">
                      Início do Gozo <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => handleStartDateChange(e.target.value)}
                      className="w-full px-2 py-1 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-bold text-black dark:text-white outline-none focus:ring-1 focus:ring-[#0963cb]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-stone-700 dark:text-stone-300 mb-0.5">
                      Término do Gozo <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => handleEndDateChange(e.target.value)}
                      className="w-full px-2 py-1 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-bold text-black dark:text-white outline-none focus:ring-1 focus:ring-[#0963cb]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-stone-700 dark:text-stone-300 mb-0.5">
                      Total de Gozo
                    </label>
                    <div className="px-2 py-1 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-lg flex items-center justify-between">
                      <span className="text-xs font-black text-[#0963cb] dark:text-sky-400 font-mono">
                        {daysCount}d
                      </span>
                      <span className="text-[9px] font-bold uppercase px-1 py-0.5 rounded-xs bg-blue-200/70 dark:bg-blue-900 text-blue-900 dark:text-blue-200">
                        {sellDaysCount > 0 ? `+${sellDaysCount}d Abono` : 'Integral'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-stone-700 dark:text-stone-300 mb-0.5">
                      Abono Pecuniário
                    </label>
                    <select
                      value={sellDaysCount}
                      onChange={(e) => handleAbonoChange(Number(e.target.value))}
                      className="w-full px-2 py-1 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-bold text-black dark:text-white outline-none focus:ring-1 focus:ring-[#0963cb] cursor-pointer"
                    >
                      <option value={0}>Sem Abono (30d)</option>
                      <option value={10}>Vender 10d (Gozo 20d)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-stone-700 dark:text-stone-300 mb-0.5">
                      Adiantamento 13º
                    </label>
                    <select
                      value={thirteenthAdvance ? 'sim' : 'nao'}
                      onChange={(e) => {
                        setThirteenthAdvance(e.target.value === 'sim');
                        setCustomDecimoAdiantamento(null);
                      }}
                      className="w-full px-2 py-1 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-bold text-black dark:text-white outline-none focus:ring-1 focus:ring-[#0963cb] cursor-pointer"
                    >
                      <option value="nao">Não</option>
                      <option value="sim">Sim (+50%)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-stone-700 dark:text-stone-300 mb-0.5">
                      Situação
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full px-2 py-1 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-bold text-black dark:text-white outline-none focus:ring-1 focus:ring-[#0963cb] cursor-pointer"
                    >
                      <option value="agendado">Agendado</option>
                      <option value="em_gozo">Em Gozo</option>
                      <option value="concluido">Concluído</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 3. BLOCO 2: DEMONSTRATIVO FINANCEIRO (FONTE 13PX, INPUTS DINÂMICOS E TOGGLE SWITCHES) */}
              <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden shadow-xs">
                <div className="px-3 py-1.5 bg-stone-50 dark:bg-stone-800/60 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#0963cb]" />
                    <span className="text-[11px] font-black uppercase tracking-wider text-black dark:text-white">
                      2. Demonstrativo Financeiro de Proventos e Descontos (Valores Editáveis)
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-stone-500 uppercase">
                    Salário Base: {formatBRL(baseSalary)} ({formatBRL(financials.dailyRate)}/dia)
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table
                    className="w-full text-[13px] leading-tight text-left"
                    style={{ fontSize: '13px' }}
                  >
                    <thead className="bg-stone-100/90 dark:bg-stone-800 text-[10px] font-black uppercase text-stone-700 dark:text-stone-300 border-b border-stone-200 dark:border-stone-800">
                      <tr>
                        <th className="py-1.5 px-3 text-left">Rubrica / Discriminação</th>
                        <th className="py-1.5 px-2 text-center w-24">Referência</th>
                        <th className="py-1.5 px-3 text-right w-36 text-emerald-700 dark:text-emerald-400">PROVENTOS (+)</th>
                        <th className="py-1.5 px-3 text-right w-36 text-rose-700 dark:text-rose-400">DESCONTOS (-)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60 text-stone-900 dark:text-stone-100 text-[13px]">
                      {/* Linha 1: Valor das Férias */}
                      <tr className="hover:bg-stone-50/60 dark:hover:bg-stone-800/40 transition">
                        <td className="py-1 px-3 font-semibold">
                          Valor das Férias (Gozo Regular CLT)
                        </td>
                        <td className="py-1 px-2 text-center font-bold text-stone-600 dark:text-stone-400">
                          {financials.effectiveGozoDays} dias
                        </td>
                        <td className="py-1 px-3 text-right">
                          <DiscreteNumericInput
                            value={financials.valorFeriasGozo}
                            ariaLabel="Valor das Férias"
                            colorClass="text-emerald-700 dark:text-emerald-400"
                            onChange={(val) => {
                              setCustomFeriasGozo(val);
                              setTimeout(() => broadcastActiveVacationDraft({ customVacationAmount: val }), 0);
                            }}
                          />
                        </td>
                        <td className="py-1 px-3 text-right font-mono text-stone-400">-</td>
                      </tr>

                      {/* Linha 2: 1/3 Constitucional de Férias */}
                      <tr className="hover:bg-stone-50/60 dark:hover:bg-stone-800/40 transition">
                        <td className="py-1 px-3 font-semibold">
                          1/3 Constitucional de Férias (Art. 7º, XVII CF/88)
                        </td>
                        <td className="py-1 px-2 text-center font-bold text-stone-600 dark:text-stone-400">
                          33,33%
                        </td>
                        <td className="py-1 px-3 text-right">
                          <DiscreteNumericInput
                            value={financials.valorUmTercoGozo}
                            ariaLabel="1/3 Constitucional de Férias"
                            colorClass="text-emerald-700 dark:text-emerald-400"
                            onChange={(val) => {
                              setCustomUmTercoGozo(val);
                              setTimeout(() => broadcastActiveVacationDraft({ oneThirdBonus: val }), 0);
                            }}
                          />
                        </td>
                        <td className="py-1 px-3 text-right font-mono text-stone-400">-</td>
                      </tr>

                      {/* Linhas 3 e 4: Abono Pecuniário e 1/3 Abono (se ativados) */}
                      {sellDaysCount > 0 && (
                        <>
                          <tr className="hover:bg-stone-50/60 dark:hover:bg-stone-800/40 transition bg-amber-50/25 dark:bg-amber-950/15">
                            <td className="py-1 px-3 font-semibold">
                              Abono Pecuniário (Venda de 10 Dias - Art. 143 CLT)
                            </td>
                            <td className="py-1 px-2 text-center font-bold text-amber-700 dark:text-amber-400">
                              {sellDaysCount} dias
                            </td>
                            <td className="py-1 px-3 text-right">
                              <DiscreteNumericInput
                                value={financials.valorAbonoPecuniario}
                                ariaLabel="Abono Pecuniário"
                                colorClass="text-emerald-700 dark:text-emerald-400"
                                onChange={(val) => {
                                  setCustomAbonoPecuniario(val);
                                  setTimeout(() => broadcastActiveVacationDraft(), 0);
                                }}
                              />
                            </td>
                            <td className="py-1 px-3 text-right font-mono text-stone-400">-</td>
                          </tr>
                          <tr className="hover:bg-stone-50/60 dark:hover:bg-stone-800/40 transition bg-amber-50/25 dark:bg-amber-950/15">
                            <td className="py-1 px-3 font-semibold">
                              1/3 Constitucional sobre Abono Pecuniário
                            </td>
                            <td className="py-1 px-2 text-center font-bold text-amber-700 dark:text-amber-400">
                              33,33%
                            </td>
                            <td className="py-1 px-3 text-right">
                              <DiscreteNumericInput
                                value={financials.valorUmTercoAbono}
                                ariaLabel="1/3 sobre Abono Pecuniário"
                                colorClass="text-emerald-700 dark:text-emerald-400"
                                onChange={(val) => {
                                  setCustomUmTercoAbono(val);
                                  setTimeout(() => broadcastActiveVacationDraft(), 0);
                                }}
                              />
                            </td>
                            <td className="py-1 px-3 text-right font-mono text-stone-400">-</td>
                          </tr>
                        </>
                      )}

                      {/* Linha 5: Adiantamento do 13º Salário (se ativado) */}
                      {thirteenthAdvance && (
                        <tr className="hover:bg-stone-50/60 dark:hover:bg-stone-800/40 transition bg-blue-50/25 dark:bg-blue-950/15">
                          <td className="py-1 px-3 font-semibold">
                            Adiantamento da 1ª Parcela do 13º Salário (Lei 4.749/65)
                          </td>
                          <td className="py-1 px-2 text-center font-bold text-blue-700 dark:text-blue-400">
                            50,00%
                          </td>
                          <td className="py-1 px-3 text-right">
                            <DiscreteNumericInput
                              value={financials.valorDecimoAdiantamento}
                              ariaLabel="Adiantamento do 13º Salário"
                              colorClass="text-emerald-700 dark:text-emerald-400"
                              onChange={(val) => {
                                setCustomDecimoAdiantamento(val);
                                setTimeout(() => broadcastActiveVacationDraft({ thirteenthAmount: val }), 0);
                              }}
                            />
                          </td>
                          <td className="py-1 px-3 text-right font-mono text-stone-400">-</td>
                        </tr>
                      )}

                      {/* Linha 6: Desconto de INSS sobre Férias com Toggle Switch */}
                      <tr className="hover:bg-stone-50/60 dark:hover:bg-stone-800/40 transition">
                        <td className="py-1 px-3 font-semibold">
                          <div className="flex items-center justify-between gap-2">
                            <span className={inssEnabled ? '' : 'text-stone-400 line-through'}>
                              Desconto de INSS sobre Férias (Tabela Progressiva)
                            </span>
                            <DiscountSwitch
                              checked={inssEnabled}
                              onChange={(checked) => {
                                setInssEnabled(checked);
                                setCustomInssDiscount(checked ? null : 0);
                                setTimeout(
                                  () =>
                                    broadcastActiveVacationDraft({
                                      inssEnabled: checked,
                                      inssDiscount: checked ? undefined : 0,
                                    }),
                                  0
                                );
                              }}
                              label="Desconto de INSS"
                            />
                          </div>
                        </td>
                        <td className="py-1 px-2 text-center font-bold text-stone-600 dark:text-stone-400">
                          {inssEnabled ? `${financials.inssEffectiveRate.toFixed(2).replace('.', ',')}%` : 'Isento'}
                        </td>
                        <td className="py-1 px-3 text-right font-mono text-stone-400">-</td>
                        <td className="py-1 px-3 text-right">
                          <DiscreteNumericInput
                            value={financials.inssDiscount}
                            ariaLabel="Desconto de INSS"
                            colorClass={inssEnabled ? 'text-rose-700 dark:text-rose-400' : 'text-stone-400'}
                            onChange={(val) => {
                              const nextEnabled = val > 0 ? true : inssEnabled;
                              setInssEnabled(nextEnabled);
                              setCustomInssDiscount(val);
                              setTimeout(
                                () =>
                                  broadcastActiveVacationDraft({
                                    inssEnabled: nextEnabled,
                                    inssDiscount: val,
                                  }),
                                0
                              );
                            }}
                          />
                        </td>
                      </tr>

                      {/* Linha 7: Desconto de IRRF sobre Férias com Toggle Switch */}
                      <tr className="hover:bg-stone-50/60 dark:hover:bg-stone-800/40 transition">
                        <td className="py-1 px-3 font-semibold">
                          <div className="flex items-center justify-between gap-2">
                            <span className={irrfEnabled ? '' : 'text-stone-400 line-through'}>
                              Desconto de IRRF sobre Férias (Retenção na Fonte)
                            </span>
                            <DiscountSwitch
                              checked={irrfEnabled}
                              onChange={(checked) => {
                                setIrrfEnabled(checked);
                                setCustomIrrfDiscount(checked ? null : 0);
                                setTimeout(
                                  () =>
                                    broadcastActiveVacationDraft({
                                      irrfEnabled: checked,
                                      irrfDiscount: checked ? undefined : 0,
                                    }),
                                  0
                                );
                              }}
                              label="Desconto de IRRF"
                            />
                          </div>
                        </td>
                        <td className="py-1 px-2 text-center font-bold text-stone-600 dark:text-stone-400">
                          {irrfEnabled && financials.irrfRate > 0 ? `${financials.irrfRate.toFixed(1).replace('.', ',')}%` : 'Isento'}
                        </td>
                        <td className="py-1 px-3 text-right font-mono text-stone-400">-</td>
                        <td className="py-1 px-3 text-right">
                          <DiscreteNumericInput
                            value={financials.irrfDiscount}
                            ariaLabel="Desconto de IRRF"
                            colorClass={irrfEnabled ? 'text-rose-700 dark:text-rose-400' : 'text-stone-400'}
                            onChange={(val) => {
                              const nextEnabled = val > 0 ? true : irrfEnabled;
                              setIrrfEnabled(nextEnabled);
                              setCustomIrrfDiscount(val);
                              setTimeout(
                                () =>
                                  broadcastActiveVacationDraft({
                                    irrfEnabled: nextEnabled,
                                    irrfDiscount: val,
                                  }),
                                0
                              );
                            }}
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4. BLOCO 3: RESUMO E TOTAIS DO RECIBO COMPACTO */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-0 rounded-xl overflow-hidden border border-stone-300 dark:border-stone-700 shadow-xs">
                <div className="md:col-span-6 bg-white dark:bg-stone-800/90 p-2.5 px-3.5 flex flex-col justify-between space-y-1">
                  <div className="flex items-center justify-between text-xs pb-1 border-b border-stone-200 dark:border-stone-700">
                    <span className="font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wide">
                      Total Bruto (Proventos):
                    </span>
                    <span className="text-sm font-black text-emerald-700 dark:text-emerald-400 font-mono">
                      {formatBRL(financials.totalBruto)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pb-1 border-b border-stone-200 dark:border-stone-700">
                    <span className="font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wide">
                      Total de Descontos (INSS + IRRF):
                    </span>
                    <span className="text-sm font-black text-rose-700 dark:text-rose-400 font-mono">
                      {formatBRL(financials.totalDescontos)}
                    </span>
                  </div>

                  <div className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center justify-between pt-0.5">
                    <span>Base Previdenciária: <strong>{formatBRL(financials.baseINSS)}</strong></span>
                    <span>Base IRRF: <strong>{formatBRL(financials.baseIRRF)}</strong></span>
                  </div>
                </div>

                <div className="md:col-span-6 bg-[#0963cb]/10 dark:bg-blue-950/40 border-t md:border-t-0 md:border-l border-blue-200 dark:border-blue-900 p-2.5 px-3.5 flex flex-col justify-between text-right">
                  <div className="flex items-center justify-between md:justify-end md:flex-col md:items-end">
                    <span className="text-[11px] font-black uppercase tracking-wider text-[#0963cb] dark:text-sky-300 block">
                      Valor Líquido a Pagar
                    </span>
                    <div className="text-xl sm:text-2xl font-black text-[#0963cb] dark:text-sky-400 font-['Outfit'] leading-tight">
                      {formatBRL(financials.valorLiquido)}
                    </div>
                  </div>

                  <div className="mt-1 pt-1 border-t border-blue-200/80 dark:border-blue-800/80">
                    <p className="text-[10px] font-bold text-stone-700 dark:text-stone-300">
                      Limite para pagamento: 2 dias antes do gozo (
                      <span className="text-[#0963cb] dark:text-sky-300 font-black underline">
                        {paymentDeadline}
                      </span>
                      )
                    </p>
                  </div>
                </div>
              </div>

              {/* Observações Compactas e Ações na mesma linha/bloco final */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-0.5">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Observações gerais sobre o período de férias (opcional)..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-1.5 border border-stone-300 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-900 text-black dark:text-white outline-none focus:ring-1 focus:ring-[#0963cb] text-xs"
                  />
                </div>

                <div className="flex items-center justify-between sm:justify-end space-x-2 shrink-0">
                  <button
                    type="button"
                    onClick={handlePreviewReceipt}
                    className="inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 font-bold text-xs rounded-lg shadow-xs transition cursor-pointer active:scale-95"
                    title="Abrir Aviso e Recibo de Férias (PDF)"
                  >
                    <Printer className="w-3.5 h-3.5 text-[#0963cb]" />
                    <span>Recibo (PDF)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCloseProgrammingModal}
                    className="px-3 py-1.5 rounded-lg bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 font-bold text-xs hover:bg-stone-50 dark:hover:bg-stone-700 cursor-pointer transition"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-[#0963cb] hover:bg-[#0852a8] text-white font-bold text-xs transition shadow-sm cursor-pointer active:scale-95"
                  >
                    Salvar Férias
                  </button>
                </div>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Modal Aviso e Recibo de Férias para Impressão e Edição em Tempo Real */}
      <VacationReceiptModal
        isOpen={Boolean(printingVacation)}
        vacation={printingVacation}
        vacationData={printingVacation}
        employee={employees.find(e => e.id === printingVacation?.employeeId || e.name === printingVacation?.employeeName)}
        onClose={() => setPrintingVacation(null)}
        onSaveVacation={(updated) => {
          setPrintingVacation(updated);
          if (vacations.some(v => v.id === updated.id)) {
            onSaveVacations(vacations.map(v => (v.id === updated.id ? updated : v)));
          }
        }}
      />

    </div>
  );
};
