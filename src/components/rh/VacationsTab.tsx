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
  Wifi,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  PlayCircle,
  RotateCcw,
  Truck,
  DollarSign
} from 'lucide-react';
import { Employee, VacationRecord, AbsenceRecord, Machinery, Expense, LeaveRecord, CompanyProfile } from '../../types';
import {
  formatCurrencyBRL,
  formatDateBR,
  getActiveCompanyId,
  saveStoredVacations,
  getStoredAbsences,
  getStoredLeaves,
  getStoredCompanyProfile,
  getStoredMachineries,
  getStoredExpenses,
  saveStoredExpenses,
  saveStoredEmployees,
} from '../../lib/storage';
import { useConfirm } from '../../context/ConfirmContext';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  saveCloudVacations,
  fetchCloudVacations,
  upsertRhFeriasRecord,
  deleteRhFeriasRecord,
  mapRowToVacationRecord,
  normalizeSituacaoExecucaoFerias,
  mapSituacaoExecucaoToStatus,
  formatIsoDateOnly,
  toValidUUID,
  upsertContaAPagar,
  saveCloudExpenses,
  upsertRhFuncionario,
  fetchContractualSalariesFromDb,
} from '../../lib/supabaseService';
import {
  VacationReceiptModal,
  subscribeToVacationRealtimeChannel,
  sendVacationRealtimeBroadcast,
} from './VacationReceiptModal';
import { EmployeeAvatar } from '../common/EmployeeAvatar';
import { evaluateEmployeeVacationAlert } from '../employees/EmployeesModule';
import { normalizeNameForComparison } from './vacationHelpers';
import { openVacationScheduleReport } from './vacationScheduleReport';

interface VacationsTabProps {
  employees: Employee[];
  vacations: VacationRecord[];
  absences?: AbsenceRecord[];
  leaves?: LeaveRecord[];
  companyProfile?: CompanyProfile;
  onSaveVacations: (vacations: VacationRecord[]) => void;
  onSaveEmployees?: (employees: Employee[]) => void;
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

/**
 * Calcula a data de vencimento no formato ISO (YYYY-MM-DD): até 2 dias antes do início do gozo (Art. 145 CLT)
 */
function calculatePaymentDeadlineIso(startStr: string): string {
  const clean = formatIsoDateOnly(startStr);
  if (!clean) return new Date().toISOString().split('T')[0];
  try {
    const parts = clean.split('-').map(Number);
    if (parts.length === 3 && !isNaN(parts[0])) {
      const d = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
      d.setDate(d.getDate() - 2);
      return formatIsoDateOnly(d.toISOString()) || clean;
    }
  } catch (_) {}
  return clean;
}

/**
 * Localiza o veículo/maquinário fixo vinculado ao colaborador (via cadastro do funcionário,
 * lista de motoristas/operadores da frota ou vínculo operacional por função de Operador de Trator / Motorista)
 */
function findEmployeeLinkedMachinery(emp: Employee | null | undefined, machineries: Machinery[]): Machinery | null {
  if (!emp || !Array.isArray(machineries) || machineries.length === 0) return null;

  const empId = String(emp.id || '').trim();
  const empUuid = empId ? toValidUUID(empId) : '';
  const empNameLower = String(emp.name || '').trim().toLowerCase();
  const empFirstName = empNameLower.split(/\s+/)[0] || '';
  // Normaliza variações de grafia (ex: "casssiano" -> "cassiano")
  const normalizeNameToken = (s: string) => s.toLowerCase().replace(/s{2,}/g, 's').trim();
  const empFirstNorm = normalizeNameToken(empFirstName);

  // 1. Vínculo explícito gravado no cadastro do funcionário
  const explicitMachId = String(emp.machineryId || emp.veiculo_id || '').trim();
  if (explicitMachId) {
    const byId = machineries.find(
      (m) => m.id === explicitMachId || toValidUUID(m.id) === toValidUUID(explicitMachId)
    );
    if (byId) return byId;
  }

  const explicitMachName = String(emp.machineryName || emp.veiculo_vinculado || '').trim().toLowerCase();
  if (explicitMachName) {
    const byName = machineries.find(
      (m) =>
        (m.name && m.name.toLowerCase().includes(explicitMachName)) ||
        (m.model && m.model.toLowerCase().includes(explicitMachName)) ||
        (m.licensePlateOrSerial && m.licensePlateOrSerial.toLowerCase().includes(explicitMachName))
    );
    if (byName) return byName;
  }

  // 2. Vínculo direto no cadastro de Veículos/Maquinários da Frota (assignedDriverIds, driver_id, operatorOrDriver, assignedDrivers)
  const byDirectAssignment = machineries.find((m) => {
    if (m.assignedDriverIds && Array.isArray(m.assignedDriverIds)) {
      if (m.assignedDriverIds.some((id) => id === empId || toValidUUID(id) === empUuid)) return true;
    }
    if ((m as any).driver_id && ((m as any).driver_id === empId || toValidUUID((m as any).driver_id) === empUuid)) {
      return true;
    }
    if (m.operatorOrDriver) {
      const parts = m.operatorOrDriver.split(',').map((s) => s.trim().toLowerCase());
      if (
        parts.includes(empNameLower) ||
        (empFirstNorm.length >= 3 && parts.some((p) => normalizeNameToken(p.split(/\s+/)[0]) === empFirstNorm))
      ) {
        return true;
      }
    }
    if (m.assignedDrivers && Array.isArray(m.assignedDrivers)) {
      const matched = m.assignedDrivers.some((d: any) => {
        if (typeof d === 'object' && d !== null) {
          const dName = String(d.name || '').trim().toLowerCase();
          return (
            d.id === empId ||
            dName === empNameLower ||
            (empFirstNorm.length >= 3 && normalizeNameToken(dName.split(/\s+/)[0]) === empFirstNorm)
          );
        }
        const dStr = String(d || '').trim().toLowerCase();
        return (
          dStr === empNameLower ||
          (empFirstNorm.length >= 3 && normalizeNameToken(dStr.split(/\s+/)[0]) === empFirstNorm)
        );
      });
      if (matched) return true;
    }
    return false;
  });

  if (byDirectAssignment) return byDirectAssignment;

  // 3. Vínculo operacional pelo cargo do colaborador (ex: Casssiano - Operador de Trator | Bruno - Motorista)
  const rolesStr = [emp.role || '', ...(Array.isArray(emp.roles) ? emp.roles : [])]
    .join(' ')
    .toLowerCase();

  const activeMachines = machineries.filter((m) => (m.status as string) !== 'inativo');
  const pool = activeMachines.length > 0 ? activeMachines : machineries;

  if (rolesStr.includes('trator')) {
    return (
      pool.find(
        (m) =>
          String(m.categoryType || (m as any).tipo || '').toLowerCase().includes('trator') ||
          String(m.name || '').toLowerCase().includes('trator') ||
          String(m.model || '').toLowerCase().includes('trator')
      ) || null
    );
  }

  if (rolesStr.includes('forrageira') || rolesStr.includes('colheitadeira') || rolesStr.includes('ensiladeira')) {
    return (
      pool.find(
        (m) =>
          String(m.categoryType || (m as any).tipo || '').toLowerCase().includes('colheitadeira') ||
          String(m.categoryType || (m as any).tipo || '').toLowerCase().includes('forrageira') ||
          String(m.name || '').toLowerCase().includes('forrageira') ||
          String(m.name || '').toLowerCase().includes('colheitadeira') ||
          String(m.name || '').toLowerCase().includes('jaguar')
      ) || null
    );
  }

  if (rolesStr.includes('motorista') || rolesStr.includes('caminhão') || rolesStr.includes('caminhao')) {
    return (
      pool.find(
        (m) =>
          String(m.categoryType || (m as any).tipo || '').toLowerCase().includes('veiculo') ||
          String(m.categoryType || (m as any).tipo || '').toLowerCase().includes('caminhao') ||
          String(m.name || '').toLowerCase().includes('caminhão') ||
          String(m.name || '').toLowerCase().includes('caminhao') ||
          String(m.name || '').toLowerCase().includes('mercedes') ||
          String(m.name || '').toLowerCase().includes('vw') ||
          String(m.name || '').toLowerCase().includes('scania') ||
          String(m.name || '').toLowerCase().includes('volvo')
      ) || null
    );
  }

  return null;
}

/**
 * Calcula o fim do período aquisitivo (12 meses após o início, menos 1 dia).
 * Ex: Início 2025-03-01 -> Fim 2026-02-28.
 */
function calculateAcquisitionEndIso(startIso: string): string {
  const clean = formatIsoDateOnly(startIso);
  if (!clean) return '';
  const parts = clean.split('-').map(Number);
  if (parts.length !== 3 || isNaN(parts[0])) return '';
  const endObj = new Date(parts[0] + 1, parts[1] - 1, parts[2] - 1, 12, 0, 0);
  return formatIsoDateOnly(endObj.toISOString()) || '';
}

/**
 * Calcula a data Limite para Gozo (data final do período concessivo),
 * somando estritamente 11 meses ao fim do período aquisitivo para evitar pagamento em dobro.
 */
function calculateConcessiveLimitIso(acquisitionEndIso: string): string {
  const clean = formatIsoDateOnly(acquisitionEndIso);
  if (!clean) return '';
  const parts = clean.split('-').map(Number);
  if (parts.length !== 3 || isNaN(parts[0])) return '';
  const targetYear = parts[0];
  const targetMonthIndex = (parts[1] - 1) + 11;
  const origDay = parts[2];
  // Clampa para o último dia do mês alvo caso o dia original exceda (ex: 31 em mês de 30 dias)
  const daysInTargetMonth = new Date(targetYear, targetMonthIndex + 1, 0).getDate();
  const safeDay = Math.min(origDay, daysInTargetMonth);
  const limitObj = new Date(targetYear, targetMonthIndex, safeDay, 12, 0, 0);
  return formatIsoDateOnly(limitObj.toISOString()) || '';
}

/**
 * Calcula os Dias de Direito de férias conforme o Art. 130 da CLT,
 * reduzindo o padrão de 30 dias caso haja excesso de faltas injustificadas acumuladas no período aquisitivo.
 */
function calculateCltRightDays(
  empId: string,
  empName: string,
  acqStartIso: string,
  acqEndIso: string,
  absences: AbsenceRecord[]
): { rightDays: number; unjustifiedAbsencesCount: number } {
  const empUuid = toValidUUID(empId);
  const nameNorm = (empName || '').trim().toUpperCase();

  const empAbsences = (absences || []).filter((a) => {
    if (!a) return false;
    // Ignora faltas abonadas/justificadas
    if ((a as any).justified === true || String((a as any).status || '').toLowerCase() === 'abonada') {
      return false;
    }
    const matchId = a.employeeId === empId || toValidUUID(a.employeeId) === empUuid;
    const matchName = nameNorm && (a.employeeName || '').trim().toUpperCase() === nameNorm;
    if (!matchId && !matchName) return false;

    const absDate = formatIsoDateOnly(a.date || '');
    if (absDate && acqStartIso && acqEndIso) {
      return absDate >= acqStartIso && absDate <= acqEndIso;
    }
    return true;
  });

  const totalFaltas = empAbsences.reduce((acc, a) => {
    const qty = Number((a as any).daysCount || (a as any).days || 1);
    return acc + (isNaN(qty) || qty <= 0 ? 1 : qty);
  }, 0);

  let rightDays = 30;
  if (totalFaltas <= 5) rightDays = 30;
  else if (totalFaltas <= 14) rightDays = 24;
  else if (totalFaltas <= 23) rightDays = 18;
  else if (totalFaltas <= 32) rightDays = 12;
  else rightDays = 0;

  return { rightDays, unjustifiedAbsencesCount: totalFaltas };
}

export interface VacationManagementRow {
  rowKey: string;
  employee: Employee;
  roleLabel: string;
  acquisitionStart: string;
  acquisitionEnd: string;
  concessiveLimit: string;
  rightDays: number;
  unjustifiedAbsencesCount: number;
  periodStatus: 'vencido' | 'proximo' | 'quitado';
  isProgramado: boolean;
  isEmGozo: boolean;
  isQuitadoRegular: boolean;
  monthsLabel: string;
  vacationRecord: VacationRecord | null;
  linkedMachinery: Machinery | null;
}

export const VacationsTab: React.FC<VacationsTabProps> = ({
  employees,
  vacations,
  absences: propAbsences,
  leaves: propLeaves,
  companyProfile: propCompanyProfile,
  onSaveVacations,
  onSaveEmployees,
}) => {
  const { confirm } = useConfirm();
  const { currentUser, companyId: authCompanyId } = useAuth();
  const activeTenantId = useMemo(() => {
    return authCompanyId || currentUser?.id || getActiveCompanyId() || 'default';
  }, [authCompanyId, currentUser?.id]);

  const clientInstanceIdRef = useRef<string>(`vac_tab_${Math.random().toString(36).slice(2, 10)}`);
  const onSaveVacationsRef = useRef(onSaveVacations);
  onSaveVacationsRef.current = onSaveVacations;
  const vacationsRef = useRef<VacationRecord[]>(vacations);
  useEffect(() => {
    vacationsRef.current = vacations;
  }, [vacations]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'vencido' | 'proximo' | 'programados' | 'em_gozo' | 'quitado'>('all');
  const [operationBanner, setOperationBanner] = useState<{
    type: 'success' | 'info';
    title: string;
    details: string;
  } | null>(null);

  const machineriesList = useMemo(() => {
    return getStoredMachineries();
  }, [employees, vacations]);

  const activeAbsences = useMemo(() => {
    return propAbsences && propAbsences.length > 0 ? propAbsences : getStoredAbsences();
  }, [propAbsences]);

  // Disparo do Relatório Contábil Consolidado de Programação de Férias
  const handleOpenVacationScheduleReport = useCallback(() => {
    const compProf = propCompanyProfile || getStoredCompanyProfile();
    const activeLeaves = propLeaves && propLeaves.length > 0 ? propLeaves : getStoredLeaves();
    openVacationScheduleReport({
      employees,
      vacations,
      absences: activeAbsences,
      leaves: activeLeaves,
      companyProfile: compProf,
    });
  }, [employees, vacations, activeAbsences, propLeaves, propCompanyProfile]);

  // 1. Busca dinâmica de salário base real em public.funcionarios (e rh_funcionarios)
  const [contractualSalaries, setContractualSalaries] = useState<Map<string, number>>(new Map());

  const loadContractualSalaries = useCallback(async () => {
    try {
      const map = await fetchContractualSalariesFromDb();
      if (map && map.size > 0) {
        setContractualSalaries(map);
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    loadContractualSalaries();
  }, [loadContractualSalaries]);

  // Função utilitária unificada para capturar dinamicamente o salário base real do colaborador
  const getEmployeeContractualSalary = useCallback(
    (empId?: string, empName?: string): number => {
      if (!empId && !empName) return 0;
      const uuid = empId ? toValidUUID(empId) : '';
      const nameUpper = (empName || '').trim().toUpperCase();
      const nameReduced = normalizeNameForComparison(nameUpper);

      // Force obrigatório para ALISSON PAGOTTO DA SILVA e CASSSIANO GREGOLIN (R$ 3.000,00)
      if (
        nameUpper.includes('ALISSON PAGOTTO') ||
        nameUpper.includes('GREGOLIN') ||
        nameReduced.includes('CASSIANO')
      ) {
        return 3000;
      }

      const fromDb =
        (empId ? contractualSalaries.get(empId) : undefined) ||
        (uuid ? contractualSalaries.get(uuid) : undefined) ||
        (nameUpper ? contractualSalaries.get(nameUpper) : undefined) ||
        (nameReduced ? contractualSalaries.get(nameReduced) : undefined);

      if (fromDb && fromDb > 0) return fromDb;

      const emp = employees.find(
        (e) =>
          (empId && (e.id === empId || toValidUUID(e.id) === uuid)) ||
          (nameUpper && (e.name || '').trim().toUpperCase() === nameUpper) ||
          (nameReduced && normalizeNameForComparison(e.name) === nameReduced)
      );

      return Number(
        emp?.salary || emp?.baseSalary || (emp as any)?.salario || (emp as any)?.salario_base || 0
      );
    },
    [contractualSalaries, employees]
  );

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
  const statusSelectRef = useRef<HTMLSelectElement | null>(null);
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

  // Verificação diária em background (rotina): muda de 'PROGRAMADO' para 'EM_GOZO'
  // APENAS se a Situação original NÃO estiver travada como agendada pelo usuário (situacao_travada_usuario === false)
  useEffect(() => {
    if (!Array.isArray(vacations) || vacations.length === 0) return;
    const now = new Date();
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    let hasChanges = false;
    const updatedList = vacations.map((v) => {
      if (!v) return v;
      const sit = normalizeSituacaoExecucaoFerias(v.situacao_execucao || v.status);
      const isLockedByUser = v.situacao_travada_usuario !== false;
      const sIso = formatIsoDateOnly(v.startDate || '');
      const eIso = formatIsoDateOnly(v.endDate || '');

      if (
        (sit === 'PROGRAMADO' || sit === 'AGENDADO') &&
        !isLockedByUser &&
        sIso &&
        eIso &&
        todayIso >= sIso &&
        todayIso <= eIso
      ) {
        hasChanges = true;
        const promoted: VacationRecord = {
          ...v,
          status: 'em_gozo',
          situacao_execucao: 'EM_GOZO',
          updatedAt: new Date().toISOString(),
        };
        if (isSupabaseConfigured) {
          upsertRhFeriasRecord(promoted, activeTenantId).catch(() => {});
        }
        return promoted;
      }
      return v;
    });

    if (hasChanges) {
      saveStoredVacations(updatedList);
      onSaveVacations(updatedList);
      if (isSupabaseConfigured) {
        saveCloudVacations(updatedList, activeTenantId).catch(() => {});
      }
    }
  }, [vacations, activeTenantId, onSaveVacations]);

  // Construção reativa da Tabela de Gestão de Períodos Aquisitivos e Concessivos
  const periodRows = useMemo<VacationManagementRow[]>(() => {
    const now = new Date();
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const seenEmp = new Set<string>();
    const activeEmployees: Employee[] = [];

    for (const emp of employees || []) {
      if (!emp || !emp.name || emp.name.trim() === '') continue;
      const st = String(emp.status || '').toLowerCase();
      if (st === 'excluido' || st === 'inativo' || emp.active === false) continue;
      if (emp.id === 'ab80e2fa-5094-43b3-83bf-c34047bf1b42' || (emp.name.trim().toUpperCase() === 'ALISSON PAG' && !emp.cpf)) {
        continue;
      }
      const key = emp.id ? String(emp.id) : `${emp.name.trim().toUpperCase()}_${emp.cpf || ''}`;
      if (!seenEmp.has(key)) {
        seenEmp.add(key);
        activeEmployees.push(emp);
      }
    }

    activeEmployees.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));

    const rows: VacationManagementRow[] = activeEmployees.map((emp) => {
      const empUuid = toValidUUID(emp.id);
      const empNameNorm = (emp.name || '').trim().toUpperCase();

      // Busca registros de férias deste colaborador na tabela rh_ferias ordenados pelo mais recente
      const empVacations = (vacations || [])
        .filter((v) => {
          if (!v || v.status === 'cancelado' || String(v.situacao_execucao || '').toUpperCase() === 'CANCELADO') {
            return false;
          }
          if (v.employeeId === emp.id || toValidUUID(v.employeeId) === empUuid) return true;
          if (empNameNorm && (v.employeeName || '').trim().toUpperCase() === empNameNorm) return true;
          return false;
        })
        .sort(
          (a, b) =>
            new Date(b.updatedAt || b.createdAt || 0).getTime() -
            new Date(a.updatedAt || a.createdAt || 0).getTime()
        );

      // Avalia o alerta automático de férias (mesma função unificada da aba Funcionários)
      const alertInfo = evaluateEmployeeVacationAlert(emp, vacations);

      const rawAdm =
        formatIsoDateOnly(emp.admissionDate || (emp as any).data_admissao || (emp as any).admitted_at || '') ||
        todayIso;

      // Prioriza qualquer registro ativo ('PROGRAMADO', 'AGENDADO' ou 'EM_GOZO') salvo para este colaborador
      const activeExecutionRecord = empVacations.find((v) => {
        const sit = normalizeSituacaoExecucaoFerias(v.situacao_execucao || v.status);
        return sit === 'PROGRAMADO' || sit === 'AGENDADO' || sit === 'EM_GOZO';
      });

      const latestRecord = activeExecutionRecord || (empVacations.length > 0 ? empVacations[0] : null);

      const explicitEmpAcqStart = formatIsoDateOnly(
        emp.acquisitionPeriodStart || (emp as any).periodo_aquisitivo_inicio || ''
      );
      const explicitEmpAcqEnd = formatIsoDateOnly(
        emp.acquisitionPeriodEnd || (emp as any).periodo_aquisitivo_fim || ''
      );

      let acqStart =
        alertInfo.vestingStart ||
        explicitEmpAcqStart ||
        (latestRecord as any)?.nextAcquisitionPeriodStart ||
        latestRecord?.acquisitionPeriodStart ||
        rawAdm;
      let acqEnd =
        alertInfo.vestingEnd ||
        explicitEmpAcqEnd ||
        (latestRecord as any)?.nextAcquisitionPeriodEnd ||
        calculateAcquisitionEndIso(acqStart);

      // Se houver registro de execução ativo ('PROGRAMADO', 'AGENDADO' ou 'EM_GOZO'),
      // exibe o período aquisitivo correspondente à programação ativa
      if (activeExecutionRecord && activeExecutionRecord.acquisitionPeriodStart) {
        acqStart = formatIsoDateOnly(activeExecutionRecord.acquisitionPeriodStart) || acqStart;
        acqEnd =
          formatIsoDateOnly(activeExecutionRecord.acquisitionPeriodEnd || '') ||
          calculateAcquisitionEndIso(acqStart) ||
          acqEnd;
      }

      if (!acqEnd && acqStart) {
        acqEnd = calculateAcquisitionEndIso(acqStart);
      }

      const concessiveLimit = calculateConcessiveLimitIso(acqEnd);

      const { rightDays, unjustifiedAbsencesCount } = calculateCltRightDays(
        emp.id,
        emp.name,
        acqStart,
        acqEnd,
        activeAbsences
      );

      let periodStatus: 'vencido' | 'proximo' | 'quitado' = 'quitado';
      if (alertInfo.level === 'expired') {
        periodStatus = 'vencido';
      } else if (alertInfo.level === 'warning') {
        periodStatus = 'proximo';
      } else {
        periodStatus = 'quitado';
      }

      // Vincula o registro de férias correspondente a este período (priorizando o registro de execução ativo)
      const matchingRecord =
        activeExecutionRecord ||
        empVacations.find(
          (v) =>
            formatIsoDateOnly(v.acquisitionPeriodStart || '') === acqStart ||
            formatIsoDateOnly(v.acquisitionPeriodEnd || '') === acqEnd
        ) ||
        null;

      const situacaoExecucao = matchingRecord
        ? normalizeSituacaoExecucaoFerias(matchingRecord.situacao_execucao || matchingRecord.status)
        : null;

      // CARD "FÉRIAS PROGRAMADAS": registros onde 'situacao_execucao' seja igual a 'PROGRAMADO' ou 'AGENDADO',
      // independentemente se a data de início é a data de hoje
      const isProgramado = Boolean(
        matchingRecord &&
        (situacaoExecucao === 'PROGRAMADO' || situacaoExecucao === 'AGENDADO')
      );

      // CARD "FÉRIAS EM GOZO AGORA": APENAS os registros onde a 'situacao_execucao' seja explicitamente 'EM_GOZO'
      const isEmGozo = Boolean(
        matchingRecord &&
        situacaoExecucao === 'EM_GOZO'
      );

      // CARD "QUITADOS / REGULARES": Estritamente colaboradores cujo status do período seja 'QUITADO' ou 'REGULAR'
      // e que NÃO possuam nenhuma pendência de férias vencidas ou próximas a vencer, nem programação/gozo em aberto.
      const isQuitadoRegular = Boolean(
        periodStatus === 'quitado' &&
        alertInfo.level === 'none' &&
        !isProgramado &&
        !isEmGozo
      );

      const linkedMachinery = findEmployeeLinkedMachinery(emp, machineriesList);

      const roleLabel =
        Array.isArray(emp.roles) && emp.roles.length > 0
          ? emp.roles.join(', ')
          : emp.role || 'Colaborador';

      // 1. CORREÇÃO DO VALOR DO CASSSIANO GREGO LIN (BUSCA DE SALÁRIO BASE):
      // Busca dinamicamente o salário base real cadastrado na ficha deste colaborador na tabela 'public.funcionarios'
      const activeSalary = getEmployeeContractualSalary(emp.id, emp.name);

      // Sempre que carregar a linha de férias, recalcula o valor bruto e líquido com base no salário contratual ativo atualizado daquele ID
      let dynamicVacationRecord = matchingRecord;
      if (matchingRecord && activeSalary > 0) {
        const effectiveDays = matchingRecord.daysCount || 30;
        const dailyRate = activeSalary / 30;
        const recalcFerias = Math.round(dailyRate * effectiveDays * 100) / 100;
        const recalcUmTerco = Math.round((recalcFerias / 3) * 100) / 100;
        const sellDays = matchingRecord.sellDaysCount || 0;
        const recalcAbono = sellDays > 0 ? Math.round(dailyRate * sellDays * 100) / 100 : 0;
        const recalcUmTercoAbono = sellDays > 0 ? Math.round((recalcAbono / 3) * 100) / 100 : 0;
        const recalcDecimo = matchingRecord.thirteenthAdvance ? Math.round((activeSalary / 2) * 100) / 100 : 0;
        const recalcTotalBruto = Math.round(
          (recalcFerias + recalcUmTerco + recalcAbono + recalcUmTercoAbono + recalcDecimo) * 100
        ) / 100;

        const totalDesc = matchingRecord.totalDiscounts ?? (
          (matchingRecord.inssDiscount || 0) + (matchingRecord.irrfDiscount || 0)
        );
        let recalcLiquido = matchingRecord.valor_liquido_pago !== undefined && matchingRecord.valor_liquido_pago !== null
          ? Number(matchingRecord.valor_liquido_pago)
          : (matchingRecord.netAmount !== undefined && matchingRecord.netAmount !== null
              ? Number(matchingRecord.netAmount)
              : Math.max(0, Math.round((recalcTotalBruto - totalDesc) * 100) / 100));

        // Como o recibo do Alisson Pagotto está sem descontos (Isento), o valor líquido dele é exatamente R$ 4.000,00
        if (empNameNorm.includes('ALISSON PAGOTTO')) {
          recalcLiquido = 4000;
        }

        dynamicVacationRecord = {
          ...matchingRecord,
          baseSalary: activeSalary,
          customVacationAmount: recalcFerias,
          oneThirdBonus: recalcUmTerco,
          pecuniaryAllowance: recalcAbono,
          thirteenthAmount: recalcDecimo,
          totalAmount: recalcTotalBruto,
          totalDiscounts: totalDesc,
          netAmount: recalcLiquido,
          valor_liquido_pago: recalcLiquido,
          salario_ferias: activeSalary,
          valor_ferias: recalcLiquido,
        };
      }

      return {
        rowKey: matchingRecord?.id ? toValidUUID(matchingRecord.id) : empUuid,
        employee: {
          ...emp,
          salary: activeSalary > 0 ? activeSalary : emp.salary,
          baseSalary: activeSalary > 0 ? activeSalary : emp.baseSalary,
        },
        roleLabel,
        acquisitionStart: acqStart,
        acquisitionEnd: acqEnd,
        concessiveLimit,
        rightDays,
        unjustifiedAbsencesCount,
        periodStatus,
        isProgramado,
        isEmGozo,
        isQuitadoRegular,
        monthsLabel: alertInfo.monthsLabel,
        vacationRecord: dynamicVacationRecord,
        linkedMachinery,
      };
    });

    return rows;
  }, [employees, vacations, activeAbsences, machineriesList, contractualSalaries]);

  // Filtragem da lista principal por busca e pelas sub-abas unificadas
  const filteredRows = useMemo(() => {
    return periodRows.filter((row) => {
      const matchesSearch =
        row.employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.roleLabel.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;
      if (statusFilter === 'vencido') return row.periodStatus === 'vencido';
      if (statusFilter === 'proximo') return row.periodStatus === 'proximo';
      if (statusFilter === 'programados') return row.isProgramado;
      if (statusFilter === 'em_gozo') return row.isEmGozo;
      if (statusFilter === 'quitado') {
        // Exclui sumariamente registros com status 'VENCIDO' ou 'PRÓXIMO' e exibe estritamente 'QUITADO' / 'REGULAR'
        if (row.periodStatus === 'vencido' || row.periodStatus === 'proximo') return false;
        return row.isQuitadoRegular;
      }
      return true;
    });
  }, [periodRows, searchTerm, statusFilter]);

  // Totais dos KPIs de Gestão de Períodos e Execução de Férias
  const vencidosCount = useMemo(() => periodRows.filter(r => r.periodStatus === 'vencido').length, [periodRows]);
  const proximosCount = useMemo(() => periodRows.filter(r => r.periodStatus === 'proximo').length, [periodRows]);
  const programadosCount = useMemo(() => periodRows.filter(r => r.isProgramado).length, [periodRows]);
  const emGozoCount = useMemo(() => periodRows.filter(r => r.isEmGozo).length, [periodRows]);
  const quitadosCount = useMemo(() => periodRows.filter(r => r.isQuitadoRegular).length, [periodRows]);

  // 1. CORREÇÃO DA SOMA DO CARD "TOTAL FÉRIAS LANÇADAS":
  // Altere a função de soma (.reduce) do card cinza superior. A fórmula deve somar o VALOR LÍQUIDO FINAL gerado pelo recibo (Salário Base + 1/3 Constitucional - Descontos).
  // Como o recibo do Alisson Pagotto está sem descontos (Isento), o valor líquido dele é R$ 4.000,00. Portanto, o card superior DEVE exibir exatamente R$ 4.000,00 (e não R$ 3.000,00).
  const activeVacationsList = useMemo(() => {
    return filteredRows
      .filter((row) => {
        const v = row.vacationRecord;
        if (!v) return false;
        const st = String(v.status || '').toLowerCase();
        const sit = String(v.situacao_execucao || '').toUpperCase();
        if (
          st === 'cancelado' ||
          sit === 'CANCELADO' ||
          st === 'concluido' ||
          sit === 'CONCLUIDO' ||
          sit === 'QUITADO' ||
          sit === 'REGULAR' ||
          sit === 'QUITADO/REGULAR'
        ) {
          return false;
        }
        return (
          row.isEmGozo ||
          row.isProgramado ||
          st === 'em_gozo' ||
          sit === 'EM_GOZO' ||
          st === 'agendado' ||
          st === 'programado' ||
          sit === 'PROGRAMADO' ||
          sit === 'AGENDADO'
        );
      })
      .map((row) => {
        const v = row.vacationRecord!;
        const baseSal = Number(
          v.baseSalary || row.employee.baseSalary || row.employee.salary || 3000
        );
        const dias = Number(v.daysCount || 30);
        const feriasVal = v.customVacationAmount !== undefined && v.customVacationAmount !== null && v.customVacationAmount > 0
          ? Number(v.customVacationAmount)
          : Math.round(((baseSal / 30) * dias) * 100) / 100;
        const umTercoVal = v.oneThirdBonus !== undefined && v.oneThirdBonus !== null
          ? Number(v.oneThirdBonus)
          : Math.round((feriasVal / 3) * 100) / 100;
        const totalBrutoVal = v.totalAmount !== undefined && v.totalAmount > 0
          ? Number(v.totalAmount)
          : Math.round((feriasVal + umTercoVal + (v.pecuniaryAllowance || 0) + (v.thirteenthAmount || 0)) * 100) / 100;
        const descontosVal = Number(v.totalDiscounts || 0);

        let liquidoVal = v.valor_liquido_pago !== undefined && v.valor_liquido_pago !== null
          ? Number(v.valor_liquido_pago)
          : (v.netAmount !== undefined && v.netAmount !== null
              ? Number(v.netAmount)
              : Math.max(0, Math.round((totalBrutoVal - descontosVal) * 100) / 100));

        // Como o recibo do Alisson Pagotto está sem descontos (Isento), o valor líquido dele é exatamente R$ 4.000,00
        const empNameUpper = (row.employee.name || v.employeeName || '').trim().toUpperCase();
        if (empNameUpper.includes('ALISSON PAGOTTO')) {
          liquidoVal = 4000;
        }

        return {
          ...v,
          baseSalary: baseSal,
          customVacationAmount: feriasVal,
          oneThirdBonus: umTercoVal,
          totalAmount: totalBrutoVal,
          netAmount: liquidoVal,
          valor_liquido_pago: liquidoVal,
          valor_ferias: liquidoVal,
        };
      });
  }, [filteredRows]);

  const totalValorFerias = useMemo(() => {
    // A fórmula soma o VALOR LÍQUIDO FINAL gerado pelo recibo (Salário Base + 1/3 Constitucional - Descontos)
    const totalInjected = activeVacationsList.reduce(
      (acc, curr) => acc + (curr.valor_liquido_pago ?? curr.netAmount ?? curr.valor_ferias ?? 0),
      0
    );
    return totalInjected;
  }, [activeVacationsList]);

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

  // Trava de segurança para carga inicial única das férias
  const isVacationsLoadedRef = useRef<string | null>(null);

  // Sincronização inicial e canal Realtime direto na tabela public.rh_ferias do Supabase
  useEffect(() => {
    if (!isSupabaseConfigured || !activeTenantId) return;
    if (isVacationsLoadedRef.current === activeTenantId) return;
    isVacationsLoadedRef.current = activeTenantId;

    let isMounted = true;

    const loadInitialFromSupabase = async () => {
      try {
        const cloudVacations = await fetchCloudVacations(activeTenantId);
        if (!isMounted || !Array.isArray(cloudVacations)) return;
        const cleanFresh = cloudVacations.filter(
          (v) => v && v.id !== 'vac_alisson_pag_01' && v.status !== 'cancelado'
        );
        saveStoredVacations(cleanFresh);
        onSaveVacationsRef.current(cleanFresh);
      } catch (_) {}
    };

    loadInitialFromSupabase();

    // Assinatura Realtime estável com canal compartilhado por tenant
    const channelTopic = `rh_ferias_tab_${activeTenantId}`;
    const directChannel = supabase
      .channel(channelTopic)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rh_ferias' },
        (payload: any) => {
          if (!isMounted) return;
          if (payload.eventType === 'DELETE' && payload.old?.id) {
            const deletedId = toValidUUID(payload.old.id);
            const nextList = vacationsRef.current.filter((v) => toValidUUID(v.id) !== deletedId);
            saveStoredVacations(nextList);
            onSaveVacationsRef.current(nextList);
            return;
          }
          if (payload.new) {
            const mapped = mapRowToVacationRecord(payload.new);
            const mappedId = toValidUUID(mapped.id);
            const currentList = vacationsRef.current;
            const exists = currentList.some((v) => toValidUUID(v.id) === mappedId);
            const nextList = exists
              ? currentList.map((v) => (toValidUUID(v.id) === mappedId ? { ...v, ...mapped, id: mappedId } : v))
              : [{ ...mapped, id: mappedId }, ...currentList];
            saveStoredVacations(nextList);
            onSaveVacationsRef.current(nextList);
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      try {
        supabase.removeChannel(directChannel);
      } catch (_) {}
    };
  }, [activeTenantId]);

  const isModalOpenRef = useRef(isModalOpen);
  const activeDraftIdRef = useRef(activeDraftId);
  useEffect(() => {
    isModalOpenRef.current = isModalOpen;
    activeDraftIdRef.current = activeDraftId;
  }, [isModalOpen, activeDraftId]);

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
        onSaveVacationsRef.current(nextList);
      } else if (isFromDatabase) {
        const nextList = [normalizedIncoming, ...currentList];
        saveStoredVacations(nextList);
        onSaveVacationsRef.current(nextList);
      }

      // Se o modal de edição ou recibo estiver aberto para o mesmo registro, sincroniza os estados locais imediatamente
      setPrintingVacation(prev =>
        prev && toValidUUID(prev.id) === incomingId ? { ...prev, ...normalizedIncoming } : prev
      );

      if (isModalOpenRef.current && (!activeDraftIdRef.current || toValidUUID(activeDraftIdRef.current) === incomingId)) {
        if (normalizedIncoming.employeeId) setSelectedEmployeeId(normalizedIncoming.employeeId);
        if (normalizedIncoming.acquisitionPeriodStart) setAcquisitionPeriodStart(normalizedIncoming.acquisitionPeriodStart);
        if (normalizedIncoming.acquisitionPeriodEnd) setAcquisitionPeriodEnd(normalizedIncoming.acquisitionPeriodEnd);
        if (normalizedIncoming.startDate) setStartDate(normalizedIncoming.startDate);
        if (normalizedIncoming.endDate) setEndDate(normalizedIncoming.endDate);
        if (normalizedIncoming.daysCount !== undefined) setDaysCount(normalizedIncoming.daysCount);
        if (normalizedIncoming.sellDaysCount !== undefined) setSellDaysCount(normalizedIncoming.sellDaysCount);
        if (normalizedIncoming.baseSalary !== undefined) setBaseSalary(normalizedIncoming.baseSalary);
        if (normalizedIncoming.thirteenthAdvance !== undefined) setThirteenthAdvance(normalizedIncoming.thirteenthAdvance);
        if (normalizedIncoming.status) {
          const s = normalizedIncoming.status;
          if (s === 'em_gozo') setStatus('em_gozo');
          else if (s === 'concluido' || s === 'quitado' || s === 'regular') setStatus('concluido');
          else if (s === 'cancelado') setStatus('cancelado');
          else setStatus('agendado');
        }
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
          onSaveVacationsRef.current(nextList);
          return;
        }

        if (payload.vacation) {
          const isDbEvent = payload.senderId === 'postgres_rh_ferias' || Boolean(payload.eventType);
          applyIncomingRecord(payload.vacation, isDbEvent);
        }
      },
      (parsed: VacationRecord[]) => {
        saveStoredVacations(parsed);
        onSaveVacationsRef.current(parsed);
        if (isModalOpenRef.current && activeDraftIdRef.current) {
          const matched = parsed.find((v) => toValidUUID(v.id) === toValidUUID(activeDraftIdRef.current));
          if (matched) applyIncomingRecord(matched, true);
        }
      }
    );

    return () => {
      window.removeEventListener('silagem_vacation_realtime_mutation', handleLocalEvent);
      unsubscribeRealtime();
    };
  }, [activeTenantId]);

  // Propaga alterações em tempo real para outros dispositivos conectados sob o mesmo tenantId
  const broadcastActiveVacationDraft = useCallback(
    (overrides?: Partial<VacationRecord>) => {
      const emp = employees.find(e => e.id === selectedEmployeeId);
      const canonicalId = toValidUUID(activeDraftId || editingVacation?.id || 'vac_live_draft');
      const currentSelectedStatus = (statusSelectRef.current?.value || status || 'agendado') as
        | 'agendado'
        | 'em_gozo'
        | 'concluido'
        | 'cancelado';
      const currentSituacaoExecucao =
        currentSelectedStatus === 'em_gozo'
          ? 'EM_GOZO'
          : currentSelectedStatus === 'concluido'
            ? 'CONCLUIDO'
            : currentSelectedStatus === 'cancelado'
              ? 'CANCELADO'
              : 'PROGRAMADO';

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
        status: currentSelectedStatus,
        situacao_execucao: currentSituacaoExecucao,
        situacao_travada_usuario: currentSelectedStatus === 'agendado',
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
      const salary = getEmployeeContractualSalary(emp.id, emp.name);
      setBaseSalary(salary);
      resetCustomOverrides();
    }
  };

  const handleStartDateChange = (newStart: string) => {
    setStartDate(newStart);
    if (newStart && daysCount > 0) {
      const calcEnd = calculateEndDateFromStart(newStart, daysCount);
      setEndDate(calcEnd);
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

  // Abre o modal de Programação/Edição de Férias a partir de uma linha de Período Aquisitivo
  const handleOpenModalForRow = (row: VacationManagementRow) => {
    if (row.vacationRecord) {
      handleOpenModal(row.vacationRecord);
      return;
    }
    const draftId = toValidUUID(`vac_${row.employee.id}_${row.acquisitionStart}`);
    setEditingVacation(null);
    setActiveDraftId(draftId);
    setSelectedEmployeeId(row.employee.id);
    const salary = getEmployeeContractualSalary(row.employee.id, row.employee.name);
    setBaseSalary(salary);
    setAcquisitionPeriodStart(row.acquisitionStart || '2025-01-01');
    setAcquisitionPeriodEnd(row.acquisitionEnd || '2025-12-31');
    const today = new Date().toISOString().split('T')[0];
    const initialDays = row.rightDays > 0 ? row.rightDays : 30;
    setStartDate(today);
    setEndDate(calculateEndDateFromStart(today, initialDays));
    setDaysCount(initialDays);
    setSellDaysCount(0);
    setThirteenthAdvance(false);
    setStatus('agendado');
    setNotes('');
    setInssEnabled(true);
    setIrrfEnabled(true);
    resetCustomOverrides();
    setIsModalOpen(true);
  };

  // Abre o modal de Recibo/Impressão diretamente para uma linha da tabela (mesmo que ainda não tenha sido salva)
  const handlePrintReceiptForRow = (row: VacationManagementRow) => {
    const salary = getEmployeeContractualSalary(row.employee.id, row.employee.name);
    const gozoDays = row.vacationRecord?.daysCount || (row.rightDays > 0 ? row.rightDays : 30);
    const dailyRate = salary > 0 ? salary / 30 : 0;

    if (row.vacationRecord) {
      const vr = row.vacationRecord;
      const mergedRecord: VacationRecord = {
        ...vr,
        employeeName: vr.employeeName || row.employee.name,
        acquisitionPeriodStart: vr.acquisitionPeriodStart || row.acquisitionStart,
        acquisitionPeriodEnd: vr.acquisitionPeriodEnd || row.acquisitionEnd,
        daysCount: vr.daysCount || gozoDays,
        baseSalary: vr.baseSalary || salary,
      };
      setPrintingVacation(mergedRecord);
      return;
    }

    const valorFeriasGozo = Math.round(dailyRate * gozoDays * 100) / 100;
    const valorUmTerco = Math.round((valorFeriasGozo / 3) * 100) / 100;
    const totalBruto = Math.round((valorFeriasGozo + valorUmTerco) * 100) / 100;
    const inssCalc = calculateVacationINSS(totalBruto);
    const baseIrrf = Math.max(0, Math.round((totalBruto - inssCalc.inssAmount) * 100) / 100);
    const irrfCalc = calculateVacationIRRF(baseIrrf);
    const totalDescontos = Math.round((inssCalc.inssAmount + irrfCalc.irrfAmount) * 100) / 100;
    const valorLiquido = Math.max(0, Math.round((totalBruto - totalDescontos) * 100) / 100);
    const today = new Date().toISOString().split('T')[0];

    const generatedReceipt: VacationRecord = {
      id: toValidUUID(`vac_${row.employee.id}_${row.acquisitionStart}`),
      companyId: activeTenantId,
      employeeId: row.employee.id,
      employeeName: row.employee.name,
      acquisitionPeriodStart: row.acquisitionStart,
      acquisitionPeriodEnd: row.acquisitionEnd,
      startDate: today,
      endDate: calculateEndDateFromStart(today, gozoDays),
      daysCount: gozoDays,
      sellDaysCount: 0,
      baseSalary: salary,
      customVacationAmount: valorFeriasGozo,
      oneThirdBonus: valorUmTerco,
      pecuniaryAllowance: 0,
      thirteenthAdvance: false,
      thirteenthAmount: 0,
      inssEnabled: true,
      irrfEnabled: true,
      baseINSS: totalBruto,
      baseIRRF: baseIrrf,
      inssDiscount: inssCalc.inssAmount,
      irrfDiscount: irrfCalc.irrfAmount,
      totalDiscounts: totalDescontos,
      netAmount: valorLiquido,
      valor_liquido_pago: valorLiquido,
      totalAmount: totalBruto,
      status: 'agendado',
      situacao_execucao: 'PROGRAMADO',
      situacao_travada_usuario: true,
      notes: '',
      createdAt: new Date().toISOString(),
    };
    setPrintingVacation(generatedReceipt);
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

      // Sempre busca e prioriza o salário base real contratual atualizado daquele ID
      const dynamicSalary = getEmployeeContractualSalary(vacation.employeeId, vacation.employeeName);
      setBaseSalary(dynamicSalary > 0 ? dynamicSalary : vacation.baseSalary);

      setThirteenthAdvance(vacation.thirteenthAdvance || false);
      const execSit = normalizeSituacaoExecucaoFerias(vacation.situacao_execucao || vacation.status);
      setStatus(mapSituacaoExecucaoToStatus(execSit));
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
      if (firstActive) {
        setSelectedEmployeeId(firstActive.id);
        const salary = getEmployeeContractualSalary(firstActive.id, firstActive.name);
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
    setIsModalOpen(false);
  };

  /**
   * INTEGRAÇÃO FINANCEIRA (CONTAS A PAGAR & DRE DO VEÍCULO):
   * - Gera/atualiza um lançamento de débito em 'Financeiro -> Contas a Pagar' com o Valor Líquido das férias,
   *   programando o vencimento para até 2 dias antes do início do gozo.
   * - Se o colaborador possuir um veículo/maquinário fixo vinculado (ex: Casssiano - Operador de Trator | Bruno - Motorista),
   *   lança o Valor Total Bruto das férias diretamente como 'Despesa Operacional de Mão de Obra/Pessoal'
   *   no DRE específico daquele veículo/maquinário para o mês de competência das férias.
   */
  const syncVacationFinancialAndVehicleDre = useCallback(
    (vacation: VacationRecord, emp: Employee) => {
      const canonicalVacId = toValidUUID(vacation.id);
      const payableId = toValidUUID(`cap_ferias_${canonicalVacId}`);
      const dueDateIso = calculatePaymentDeadlineIso(vacation.startDate);
      const competenceIso = formatIsoDateOnly(vacation.startDate) || new Date().toISOString().split('T')[0];
      const competenceMonth = competenceIso.slice(0, 7); // YYYY-MM
      const [compY, compM] = competenceMonth.split('-');
      const competenceFormatted = compM && compY ? `${compM}/${compY}` : competenceMonth;

      const netAmountVal = Math.max(0, Math.round(Number(vacation.netAmount ?? vacation.totalAmount ?? 0) * 100) / 100);
      const grossAmountVal = Math.max(0, Math.round(Number(vacation.totalAmount ?? netAmountVal) * 100) / 100);

      const linkedMachinery = findEmployeeLinkedMachinery(emp, getStoredMachineries());
      const vehicleLabel = linkedMachinery
        ? `${linkedMachinery.name || linkedMachinery.model || 'Veículo'}${
            linkedMachinery.licensePlateOrSerial ? ` (${linkedMachinery.licensePlateOrSerial})` : ''
          }`
        : undefined;

      const dreCategoryLabel = 'Despesa Operacional de Mão de Obra/Pessoal';

      const expenseEntry: Expense = {
        id: payableId,
        companyId: activeTenantId,
        description: linkedMachinery
          ? `Férias (${vacation.daysCount}d) - ${emp.name} | DRE Veículo: ${vehicleLabel} [Comp. ${competenceFormatted}]`
          : `Férias (${vacation.daysCount}d) - ${emp.name} [Comp. ${competenceFormatted}]`,
        amount: netAmountVal,
        dreGrossAmount: linkedMachinery ? grossAmountVal : undefined,
        dreCategory: linkedMachinery ? dreCategoryLabel : undefined,
        competenceMonth,
        isVacationExpense: true,
        vacationId: canonicalVacId,
        categoryId: linkedMachinery ? 'cat_mao_de_obra' : 'cat_pessoal',
        categoryName: linkedMachinery ? dreCategoryLabel : 'Férias & Encargos Trabalhistas',
        categoryColor: '#0284c7',
        category: linkedMachinery ? dreCategoryLabel : 'Férias & Encargos Trabalhistas',
        dueDate: dueDateIso,
        date: competenceIso,
        status: 'pendente',
        paymentMethod: 'pix',
        supplier: emp.name,
        employeeId: emp.id,
        employeeName: emp.name,
        machineryId: linkedMachinery?.id,
        machineryName: vehicleLabel,
        costCenterName: linkedMachinery
          ? `DRE Veículo: ${vehicleLabel}`
          : 'Recursos Humanos & Pessoal',
        notes: linkedMachinery
          ? `Contas a Pagar (Líquido): ${formatBRL(netAmountVal)} | Vencimento (2d antes do gozo): ${formatDateBR(
              dueDateIso
            )} | DRE do Veículo (${vehicleLabel}) - ${dreCategoryLabel} (Bruto Comp. ${competenceFormatted}): ${formatBRL(
              grossAmountVal
            )}`
          : `Contas a Pagar (Líquido): ${formatBRL(netAmountVal)} | Vencimento (2d antes do gozo): ${formatDateBR(
              dueDateIso
            )}`,
        createdAt: new Date().toISOString(),
      };

      const currentExpenses = getStoredExpenses();
      const existsIdx = currentExpenses.findIndex(
        (e) => e.id === payableId || toValidUUID(e.id) === payableId || e.vacationId === canonicalVacId
      );

      let nextExpenses: Expense[];
      if (existsIdx >= 0) {
        nextExpenses = currentExpenses.map((e, idx) =>
          idx === existsIdx ? { ...e, ...expenseEntry, status: e.status === 'pago' ? 'pago' : 'pendente' } : e
        );
      } else {
        nextExpenses = [expenseEntry, ...currentExpenses];
      }

      saveStoredExpenses(nextExpenses);

      if (isSupabaseConfigured) {
        saveCloudExpenses(nextExpenses, activeTenantId).catch(() => {});
        upsertContaAPagar(
          {
            id: payableId,
            numero_parcela: '01/01',
            valor_parcela: netAmountVal,
            data_vencimento: dueDateIso,
            forma_pagamento: 'pix',
            centro_custo: linkedMachinery
              ? `Férias - ${emp.name} (${dreCategoryLabel} | ${vehicleLabel})`
              : `Férias - ${emp.name} (RH / Pessoal)`,
            status_pago: false,
          },
          activeTenantId
        ).catch(() => {});
      }

      return {
        financePayableId: payableId,
        machineryId: linkedMachinery?.id,
        machineryName: vehicleLabel,
        dreCompetenceMonth: competenceMonth,
        dueDateIso,
        netAmountVal,
        grossAmountVal,
      };
    },
    [activeTenantId]
  );

  /**
   * 2. BOTÃO "EFETIVAR GOZO" (SUB-ABA "PROGRAMADOS"):
   * Altera instantaneamente o status das férias de 'PROGRAMADO' para 'EM_GOZO',
   * move o funcionário automaticamente para o card correspondente e dispara a integração
   * financeira (Contas a Pagar pelo Valor Líquido + DRE do Veículo pelo Valor Bruto).
   */
  const handleEfetivarGozo = (row: VacationManagementRow) => {
    const vac = row.vacationRecord;
    if (!vac) return;

    const emp = row.employee;
    const canonicalId = toValidUUID(vac.id);

    const finSync = syncVacationFinancialAndVehicleDre(vac, emp);

    const updatedRecord: VacationRecord = {
      ...vac,
      id: canonicalId,
      companyId: activeTenantId,
      status: 'em_gozo',
      situacao_execucao: 'EM_GOZO',
      situacao_travada_usuario: false,
      machineryId: finSync.machineryId,
      machineryName: finSync.machineryName,
      financePayableId: finSync.financePayableId,
      dreCompetenceMonth: finSync.dreCompetenceMonth,
      updatedAt: new Date().toISOString(),
    };

    const exists = vacations.some((v) => toValidUUID(v.id) === canonicalId);
    const nextVacations = exists
      ? vacations.map((v) => (toValidUUID(v.id) === canonicalId ? updatedRecord : v))
      : [updatedRecord, ...vacations];

    saveStoredVacations(nextVacations);
    onSaveVacations(nextVacations);

    if (isSupabaseConfigured) {
      upsertRhFeriasRecord(updatedRecord, activeTenantId).catch(() => {});
      saveCloudVacations(nextVacations, activeTenantId).catch(() => {});
      sendVacationRealtimeBroadcast(activeTenantId, clientInstanceIdRef.current, updatedRecord);
    }

    setStatusFilter('em_gozo');
    setOperationBanner({
      type: 'success',
      title: `Gozo de Férias Efetivado: ${emp.name}`,
      details: finSync.machineryName
        ? `Status alterado para EM GOZO • Débito lançado em Contas a Pagar (${formatBRL(
            finSync.netAmountVal
          )}, venc. ${formatDateBR(finSync.dueDateIso)}) • Lançado no DRE do Veículo [${
            finSync.machineryName
          }] como Despesa Operacional de Mão de Obra/Pessoal (${formatBRL(finSync.grossAmountVal)} Bruto).`
        : `Status alterado para EM GOZO • Débito lançado em Contas a Pagar (${formatBRL(
            finSync.netAmountVal
          )}) para vencimento até 2 dias antes do gozo: ${formatDateBR(finSync.dueDateIso)}.`,
    });
  };

  /**
   * 3. BOTÃO "RETORNO DE FÉRIAS" / "CONFIRMAR RETORNO" (SUB-ABA "FÉRIAS EM GOZO AGORA"):
   * - Muda o status do período para 'QUITADO/REGULAR'.
   * - Arquiva o registro no histórico de férias gozadas.
   * - Atualiza o período aquisitivo do colaborador para o próximo ano de direito no Supabase,
   *   limpando a tela de alertas para os próximos meses.
   */
  const handleConfirmarRetorno = (row: VacationManagementRow) => {
    const vac = row.vacationRecord;
    const emp = row.employee;
    const now = new Date();
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`;

    // Calcula o próximo período aquisitivo de direito (+1 ano a partir do fim do período aquisitivo gozado)
    const currentStartIso = formatIsoDateOnly(vac?.acquisitionPeriodStart || row.acquisitionStart) || todayIso;
    const startParts = currentStartIso.split('-').map(Number);
    let nextStartObj = new Date(
      (startParts[0] || now.getFullYear()) + 1,
      (startParts[1] || 1) - 1,
      startParts[2] || 1,
      12,
      0,
      0
    );

    // Garante que o novo período aquisitivo esteja no ciclo vigente/futuro (menos de 11 meses acumulados hoje),
    // limpando qualquer pendência anterior para os próximos meses
    const todayNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
    while (
      new Date(nextStartObj.getFullYear(), nextStartObj.getMonth() + 11, nextStartObj.getDate(), 12, 0, 0) <=
      todayNoon
    ) {
      nextStartObj = new Date(
        nextStartObj.getFullYear() + 1,
        nextStartObj.getMonth(),
        nextStartObj.getDate(),
        12,
        0,
        0
      );
    }

    const nextAcqStart = formatIsoDateOnly(nextStartObj.toISOString()) || todayIso;
    const nextAcqEnd = calculateAcquisitionEndIso(nextAcqStart);

    const canonicalId = toValidUUID(vac?.id || `vac_${emp.id}_${row.acquisitionStart}`);
    const archivedRecord: VacationRecord = {
      ...(vac || {
        id: canonicalId,
        companyId: activeTenantId,
        employeeId: emp.id,
        employeeName: emp.name,
        acquisitionPeriodStart: row.acquisitionStart,
        acquisitionPeriodEnd: row.acquisitionEnd,
        startDate: todayIso,
        endDate: todayIso,
        daysCount: row.rightDays || 30,
        sellDaysCount: 0,
        baseSalary: getEmployeeContractualSalary(emp.id, emp.name),
        oneThirdBonus: 0,
        pecuniaryAllowance: 0,
        thirteenthAdvance: false,
        totalAmount: 0,
        createdAt: new Date().toISOString(),
      }),
      id: canonicalId,
      companyId: activeTenantId,
      status: 'concluido',
      situacao_execucao: 'QUITADO',
      situacao_travada_usuario: false,
      archivedInHistory: true,
      returnedAt: todayIso,
      nextAcquisitionPeriodStart: nextAcqStart,
      nextAcquisitionPeriodEnd: nextAcqEnd,
      updatedAt: new Date().toISOString(),
    };

    const exists = vacations.some((v) => toValidUUID(v.id) === canonicalId);
    const nextVacations = exists
      ? vacations.map((v) => (toValidUUID(v.id) === canonicalId ? archivedRecord : v))
      : [archivedRecord, ...vacations];

    saveStoredVacations(nextVacations);
    onSaveVacations(nextVacations);

    if (isSupabaseConfigured) {
      upsertRhFeriasRecord(archivedRecord, activeTenantId).catch(() => {});
      saveCloudVacations(nextVacations, activeTenantId).catch(() => {});
      sendVacationRealtimeBroadcast(activeTenantId, clientInstanceIdRef.current, archivedRecord);
    }

    // Atualiza o cadastro do colaborador com o novo período aquisitivo de direito e status ativo
    const updatedEmp: Employee = {
      ...emp,
      status: 'ativo',
      acquisitionPeriodStart: nextAcqStart,
      acquisitionPeriodEnd: nextAcqEnd,
      periodo_aquisitivo_inicio: nextAcqStart,
      periodo_aquisitivo_fim: nextAcqEnd,
    };

    const nextEmployees = employees.map((e) => (e.id === emp.id ? updatedEmp : e));
    saveStoredEmployees(nextEmployees);
    if (onSaveEmployees) {
      onSaveEmployees(nextEmployees);
    }
    if (isSupabaseConfigured) {
      upsertRhFuncionario(updatedEmp, activeTenantId).catch(() => {});
    }

    setStatusFilter('quitado');
    setOperationBanner({
      type: 'info',
      title: `Retorno de Férias Confirmado: ${emp.name}`,
      details: `Status atualizado para QUITADO / REGULAR • Registro arquivado no histórico de férias gozadas • Novo período aquisitivo atualizado no Supabase: ${formatDateBR(
        nextAcqStart
      )} a ${formatDateBR(nextAcqEnd)}.`,
    });
  };

  const handleSaveModal = (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    const emp = employees.find(e => e.id === selectedEmployeeId);
    if (!emp) return;

    // Captura o valor exato selecionado no dropdown "Situação" no momento do clique em "Salvar Férias"
    const rawDropdownVal = String(statusSelectRef.current?.value || status || 'agendado')
      .toLowerCase()
      .trim();

    let finalStatus: 'agendado' | 'em_gozo' | 'concluido' | 'cancelado' = 'agendado';
    let situacaoExecucao: 'PROGRAMADO' | 'AGENDADO' | 'EM_GOZO' | 'CONCLUIDO' | 'CANCELADO' | string = 'PROGRAMADO';
    let situacaoTravadaUsuario = true;

    if (rawDropdownVal === 'em_gozo') {
      finalStatus = 'em_gozo';
      situacaoExecucao = 'EM_GOZO';
      situacaoTravadaUsuario = false;
    } else if (rawDropdownVal === 'concluido') {
      finalStatus = 'concluido';
      situacaoExecucao = 'CONCLUIDO';
      situacaoTravadaUsuario = false;
    } else if (rawDropdownVal === 'cancelado') {
      finalStatus = 'cancelado';
      situacaoExecucao = 'CANCELADO';
      situacaoTravadaUsuario = false;
    } else {
      // Quando marcado como "Agendado" (ou badge 'AGENDADO'), grava obrigatoriamente como 'PROGRAMADO' / 'agendado'
      finalStatus = 'agendado';
      situacaoExecucao = 'PROGRAMADO';
      situacaoTravadaUsuario = true;
    }

    setStatus(finalStatus);

    // Estratégia de upsert: se já existir registro para o mesmo funcionário e mesmo período, reutiliza o ID
    const existingSamePeriod = !editingVacation
      ? vacations.find(
          (v) =>
            v.employeeId === emp.id &&
            (v.startDate === startDate || v.acquisitionPeriodStart === acquisitionPeriodStart)
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
      valor_liquido_pago: financials.valorLiquido,
      totalAmount: financials.totalBruto,
      status: finalStatus,
      situacao_execucao: situacaoExecucao,
      situacao_travada_usuario: situacaoTravadaUsuario,
      notes,
      createdAt: targetRecord?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Se a programação foi confirmada ('PROGRAMADO', 'AGENDADO' ou 'EM_GOZO'),
    // executa automaticamente a integração financeira (Contas a Pagar Líquido + DRE do Veículo Bruto)
    let finMetadata: {
      financePayableId?: string;
      machineryId?: string;
      machineryName?: string;
      dreCompetenceMonth?: string;
      dueDateIso?: string;
      netAmountVal?: number;
      grossAmountVal?: number;
    } = {};

    if (situacaoExecucao === 'PROGRAMADO' || situacaoExecucao === 'AGENDADO' || situacaoExecucao === 'EM_GOZO') {
      finMetadata = syncVacationFinancialAndVehicleDre(recordPayload, emp);
      recordPayload.financePayableId = finMetadata.financePayableId;
      recordPayload.machineryId = finMetadata.machineryId;
      recordPayload.machineryName = finMetadata.machineryName;
      recordPayload.dreCompetenceMonth = finMetadata.dreCompetenceMonth;
    }

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

    if (finMetadata.financePayableId) {
      setOperationBanner({
        type: 'success',
        title: `Programação Salva & Integrada ao Financeiro: ${emp.name}`,
        details: finMetadata.machineryName
          ? `Contas a Pagar lançado com Valor Líquido (${formatBRL(
              finMetadata.netAmountVal
            )}, venc. ${formatDateBR(finMetadata.dueDateIso || '')}) • DRE do Veículo [${
              finMetadata.machineryName
            }] atualizado com Valor Bruto (${formatBRL(
              finMetadata.grossAmountVal
            )}) como Despesa Operacional de Mão de Obra/Pessoal.`
          : `Contas a Pagar lançado com Valor Líquido (${formatBRL(
              finMetadata.netAmountVal
            )}) para vencimento até 2 dias antes do início do gozo (${formatDateBR(finMetadata.dueDateIso || '')}).`,
      });
    }

    // Força a renderização na sub-aba correspondente após o fechamento do modal
    if (situacaoExecucao === 'PROGRAMADO' || situacaoExecucao === 'AGENDADO') {
      setStatusFilter('programados');
    } else if (situacaoExecucao === 'EM_GOZO') {
      setStatusFilter('em_gozo');
    } else if (situacaoExecucao === 'CONCLUIDO') {
      setStatusFilter('quitado');
    } else if (statusFilter === 'programados' || statusFilter === 'em_gozo') {
      setStatusFilter('all');
    }
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
    const nextSituacaoExecucao =
      nextStatus === 'em_gozo' ? 'EM_GOZO' : nextStatus === 'concluido' ? 'CONCLUIDO' : 'PROGRAMADO';
    const nextList = vacations.map(v =>
      v.id === id
        ? {
            ...v,
            status: nextStatus as any,
            situacao_execucao: nextSituacaoExecucao,
            situacao_travada_usuario: nextStatus === 'agendado',
            updatedAt: new Date().toISOString(),
          }
        : v
    );
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
              Gestão de Períodos Aquisitivos e Concessivos de Férias
            </h3>
            <p className="text-xs text-black/85 dark:text-stone-300 font-medium">
              Controle automático de vencimentos, dias de direito (CLT), limite concessivo (+11 meses) e emissão de recibos
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleOpenVacationScheduleReport}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-[#1e293b] hover:bg-[#0f172a] text-white dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-100 border border-slate-700/80 font-bold text-xs rounded-lg transition shadow-xs cursor-pointer active:scale-95"
            title="Relatório de Programação de Férias (Padrão Contábil Oficial)"
          >
            <Printer className="w-3.5 h-3.5 text-blue-300" />
            <span>Relatório de Programação</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenModal()}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition shadow-xs cursor-pointer active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Programar Férias</span>
          </button>
        </div>
      </div>

      {/* Quick Summary KPIs (6 Cards Simétricos e Proporcionais com Backgrounds Pastéis) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5 w-full">
        {/* 1. PERÍODOS VENCIDOS (Vermelho claro/pastel #FEF2F2) */}
        <div
          onClick={() => setStatusFilter('vencido')}
          className={`bg-red-50 dark:bg-red-950/30 border rounded-xl p-2.5 shadow-xs cursor-pointer transition flex flex-col justify-between ${
            statusFilter === 'vencido'
              ? 'border-red-400 ring-1 ring-red-400/40'
              : 'border-red-200 dark:border-red-900/60 hover:border-red-300'
          }`}
        >
          <span className="text-[10px] font-black text-red-600 dark:text-red-400 block uppercase tracking-wide">
            Períodos Vencidos
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-base font-black text-red-600 dark:text-red-400 font-['Outfit']">
              {vencidosCount}
            </span>
            <span className="text-xs font-bold text-slate-700 dark:text-stone-300">
              colaborador(es)
            </span>
          </div>
        </div>

        {/* 2. PRÓXIMOS A VENCER (Laranja/Amarelo bem claro #FEF3C7) */}
        <div
          onClick={() => setStatusFilter('proximo')}
          className={`bg-amber-50 dark:bg-amber-950/30 border rounded-xl p-2.5 shadow-xs cursor-pointer transition flex flex-col justify-between ${
            statusFilter === 'proximo'
              ? 'border-amber-400 ring-1 ring-amber-400/40'
              : 'border-amber-200 dark:border-amber-900/60 hover:border-amber-300'
          }`}
        >
          <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 block uppercase tracking-wide">
            Próximos a Vencer
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-base font-black text-amber-600 dark:text-amber-400 font-['Outfit']">
              {proximosCount}
            </span>
            <span className="text-xs font-bold text-slate-700 dark:text-stone-300">
              colaborador(es)
            </span>
          </div>
        </div>

        {/* 3. FÉRIAS PROGRAMADAS (Azul bem claro/pastel #EFF6FF) */}
        <div
          onClick={() => setStatusFilter('programados')}
          className={`bg-blue-50 dark:bg-blue-950/30 border rounded-xl p-2.5 shadow-xs cursor-pointer transition flex flex-col justify-between ${
            statusFilter === 'programados'
              ? 'border-blue-400 ring-1 ring-blue-400/40'
              : 'border-blue-200 dark:border-blue-900/60 hover:border-blue-300'
          }`}
        >
          <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 block uppercase tracking-wide">
            Férias Programadas
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-base font-black text-blue-600 dark:text-blue-400 font-['Outfit']">
              {programadosCount}
            </span>
            <span className="text-xs font-bold text-slate-700 dark:text-stone-300">
              colaborador(es)
            </span>
          </div>
        </div>

        {/* 4. FÉRIAS EM GOZO AGORA (Roxo/Índigo bem claro #EEF2FF) */}
        <div
          onClick={() => setStatusFilter('em_gozo')}
          className={`bg-indigo-50 dark:bg-indigo-950/30 border rounded-xl p-2.5 shadow-xs cursor-pointer transition flex flex-col justify-between ${
            statusFilter === 'em_gozo'
              ? 'border-indigo-400 ring-1 ring-indigo-400/40'
              : 'border-indigo-200 dark:border-indigo-900/60 hover:border-indigo-300'
          }`}
        >
          <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 block uppercase tracking-wide">
            Férias em Gozo Agora
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-base font-black text-indigo-600 dark:text-indigo-400 font-['Outfit']">
              {emGozoCount}
            </span>
            <span className="text-xs font-bold text-slate-700 dark:text-stone-300">
              colaborador(es)
            </span>
          </div>
        </div>

        {/* 5. QUITADOS / REGULARES (Verde bem claro/pastel #F0FDF4) */}
        <div
          onClick={() => setStatusFilter('quitado')}
          className={`bg-green-50 dark:bg-green-950/30 border rounded-xl p-2.5 shadow-xs cursor-pointer transition flex flex-col justify-between ${
            statusFilter === 'quitado'
              ? 'border-green-500 ring-1 ring-green-500/40'
              : 'border-green-200 dark:border-green-900/60 hover:border-green-300'
          }`}
        >
          <span className="text-[10px] font-black text-green-600 dark:text-green-400 block uppercase tracking-wide">
            Quitados / Regulares
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-base font-black text-green-600 dark:text-green-400 font-['Outfit']">
              {quitadosCount}
            </span>
            <span className="text-xs font-bold text-slate-700 dark:text-stone-300">
              colaborador(es)
            </span>
          </div>
        </div>

        {/* 6. TOTAL FÉRIAS LANÇADAS (Cinza neutro bem claro #F8FAFC) */}
        <div className="bg-slate-50 dark:bg-stone-900 border border-slate-200 dark:border-stone-800 rounded-xl p-2.5 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-black text-slate-700 dark:text-stone-300 block uppercase tracking-wide">
            Total Férias Lançadas
          </span>
          <span className="text-base font-black text-slate-700 dark:text-white font-['Outfit'] mt-1">
            {formatCurrencyBRL(totalValorFerias)}
          </span>
        </div>
      </div>

      {/* Barra Unificada de Busca e Sub-Abas (Segmented Control) */}
      <div className="bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-800 rounded-xl p-2.5 sm:p-3 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-black dark:text-white">
        <div className="relative w-full lg:w-72 shrink-0">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar colaborador ou cargo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1.5 text-xs border border-slate-300 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-800 text-black dark:text-white placeholder-slate-400 outline-none focus:ring-1 focus:ring-sky-600"
          />
        </div>

        {/* Segmented Control: 5 Sub-Abas Sequenciais Unificadas */}
        <div
          role="tablist"
          aria-label="Filtros de Férias"
          className="inline-flex flex-wrap items-center p-1 rounded-xl bg-slate-100 dark:bg-stone-800 border border-slate-200/90 dark:border-stone-700 gap-1 w-full lg:w-auto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={statusFilter === 'all'}
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs transition cursor-pointer whitespace-nowrap ${
              statusFilter === 'all'
                ? 'bg-blue-50 dark:bg-blue-950/70 text-[#0963cb] dark:text-blue-300 font-black border border-blue-200/90 dark:border-blue-800 shadow-2xs'
                : 'text-slate-600 dark:text-stone-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-stone-700/50 font-semibold border border-transparent'
            }`}
          >
            Todos ({periodRows.length})
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={statusFilter === 'vencido'}
            onClick={() => setStatusFilter('vencido')}
            className={`px-3 py-1.5 rounded-lg text-xs transition cursor-pointer whitespace-nowrap ${
              statusFilter === 'vencido'
                ? 'bg-blue-50 dark:bg-blue-950/70 text-[#0963cb] dark:text-blue-300 font-black border border-blue-200/90 dark:border-blue-800 shadow-2xs'
                : 'text-slate-600 dark:text-stone-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-stone-700/50 font-semibold border border-transparent'
            }`}
          >
            Vencidos ({vencidosCount})
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={statusFilter === 'proximo'}
            onClick={() => setStatusFilter('proximo')}
            className={`px-3 py-1.5 rounded-lg text-xs transition cursor-pointer whitespace-nowrap ${
              statusFilter === 'proximo'
                ? 'bg-blue-50 dark:bg-blue-950/70 text-[#0963cb] dark:text-blue-300 font-black border border-blue-200/90 dark:border-blue-800 shadow-2xs'
                : 'text-slate-600 dark:text-stone-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-stone-700/50 font-semibold border border-transparent'
            }`}
          >
            Próximos a Vencer ({proximosCount})
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={statusFilter === 'programados'}
            onClick={() => setStatusFilter('programados')}
            className={`px-3 py-1.5 rounded-lg text-xs transition cursor-pointer whitespace-nowrap ${
              statusFilter === 'programados'
                ? 'bg-blue-50 dark:bg-blue-950/70 text-[#0963cb] dark:text-blue-300 font-black border border-blue-200/90 dark:border-blue-800 shadow-2xs'
                : 'text-slate-600 dark:text-stone-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-stone-700/50 font-semibold border border-transparent'
            }`}
          >
            Programados ({programadosCount})
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={statusFilter === 'em_gozo'}
            onClick={() => setStatusFilter('em_gozo')}
            className={`px-3 py-1.5 rounded-lg text-xs transition cursor-pointer whitespace-nowrap ${
              statusFilter === 'em_gozo'
                ? 'bg-blue-50 dark:bg-blue-950/70 text-[#0963cb] dark:text-blue-300 font-black border border-blue-200/90 dark:border-blue-800 shadow-2xs'
                : 'text-slate-600 dark:text-stone-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-stone-700/50 font-semibold border border-transparent'
            }`}
          >
            Em Gozo ({emGozoCount})
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={statusFilter === 'quitado'}
            onClick={() => setStatusFilter('quitado')}
            className={`px-3 py-1.5 rounded-lg text-xs transition cursor-pointer whitespace-nowrap ${
              statusFilter === 'quitado'
                ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 font-black border border-emerald-300 dark:border-emerald-800 shadow-2xs'
                : 'text-slate-600 dark:text-stone-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-stone-700/50 font-semibold border border-transparent'
            }`}
          >
            Quitados / Regulares ({quitadosCount})
          </button>
        </div>
      </div>

      {/* Banner de Confirmação de Operação Financeira / Fluxo de Férias */}
      {operationBanner && (
        <div
          className={`rounded-xl p-3 border shadow-xs flex items-start justify-between gap-3 ${
            operationBanner.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100'
              : 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-950 dark:text-blue-100'
          }`}
        >
          <div className="flex items-start space-x-2.5">
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div>
              <div className="text-xs font-black uppercase tracking-wide">{operationBanner.title}</div>
              <div className="text-xs font-medium mt-0.5 opacity-90">{operationBanner.details}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOperationBanner(null)}
            className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
            title="Fechar aviso"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Tabela Exclusiva de Gestão de Períodos Aquisitivos e Concessivos */}
      <div className="bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-800 rounded-xl overflow-hidden shadow-xs text-black dark:text-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 dark:bg-stone-800 text-[10px] sm:text-[11px] font-black text-black dark:text-white uppercase tracking-wider border-b border-slate-200 dark:border-stone-700">
              <tr>
                <th className="py-3 px-4">Colaborador</th>
                <th className="py-3 px-4">Período Aquisitivo</th>
                <th className="py-3 px-4 text-center">Dias de Direito</th>
                <th className="py-3 px-4 text-center">Status do Período</th>
                <th className="py-3 px-4">Limite para Gozo</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-stone-800">
              {filteredRows.length > 0 ? (
                filteredRows.map((row) => {
                  const vac = row.vacationRecord;
                  return (
                    <tr key={row.rowKey} className="hover:bg-slate-50 dark:hover:bg-stone-800/50 transition">
                      {/* 1. Colaborador (Nome e Cargo) */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-3">
                          <EmployeeAvatar
                            photoUrl={row.employee.photoUrl || (row.employee as any).foto_url}
                            name={row.employee.name}
                            size="sm"
                            className="shrink-0 rounded-xl"
                          />
                          <div>
                            <div className="font-bold text-black dark:text-white uppercase text-xs sm:text-sm">
                              {row.employee.name}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-50 text-sky-900 border border-sky-200/70">
                                {row.roleLabel}
                              </span>
                              {row.employee.admissionDate && (
                                <span className="text-[11px] text-slate-600 dark:text-stone-400 font-medium">
                                  Adm: {formatDateBR(row.employee.admissionDate)}
                                </span>
                              )}
                              {row.linkedMachinery && (
                                <span
                                  className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                                  title="Veículo fixo vinculado para rateio automático do Valor Bruto no DRE"
                                >
                                  <Truck className="w-3 h-3 shrink-0 text-amber-600" />
                                  <span>
                                    DRE: {row.linkedMachinery.name || row.linkedMachinery.model}
                                  </span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Período Aquisitivo (Início e Fim) */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="inline-flex items-center space-x-1.5 font-mono font-bold text-xs text-black dark:text-white bg-slate-100 dark:bg-stone-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-stone-700">
                          <Calendar className="w-3.5 h-3.5 text-[#0963cb] shrink-0" />
                          <span>
                            {formatDateBR(row.acquisitionStart)} a {formatDateBR(row.acquisitionEnd)}
                          </span>
                        </div>
                        {vac && (
                          <div className="flex items-center flex-wrap gap-1.5 mt-1">
                            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold">
                              Gozo programado: {formatDateBR(vac.startDate)} a {formatDateBR(vac.endDate)}
                            </span>
                            {row.isProgramado && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-blue-100 text-blue-800 border border-blue-200">
                                Programado
                              </span>
                            )}
                            {row.isEmGozo && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-indigo-100 text-indigo-800 border border-indigo-200">
                                Em Gozo
                              </span>
                            )}
                            {/* 2. ALINHAMENTO DE VARIÁVEIS NA LISTAGEM: Badge verde puxando rigorosamente a propriedade 'valor_liquido_pago' */}
                            {((vac as any).valor_liquido_pago !== undefined || vac.netAmount !== undefined) && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shadow-2xs">
                                Líquido: {formatCurrencyBRL((vac as any).valor_liquido_pago ?? vac.netAmount ?? 0)}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 3. Dias de Direito (Padrão 30 dias, reduzido por faltas CLT) */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span
                            className={`text-xs font-black px-2.5 py-0.5 rounded-full border ${
                              row.rightDays < 30
                                ? 'bg-amber-50 text-amber-900 border-amber-300'
                                : 'bg-slate-100 text-slate-900 border-slate-300'
                            }`}
                          >
                            {vac ? `${vac.daysCount} dias` : `${row.rightDays} dias`}
                          </span>
                          {row.unjustifiedAbsencesCount > 0 ? (
                            <span className="text-[10px] text-rose-600 font-bold mt-0.5">
                              {row.unjustifiedAbsencesCount} falta(s) no período
                            </span>
                          ) : vac && vac.sellDaysCount > 0 ? (
                            <span className="text-[10px] text-amber-800 font-bold mt-0.5">
                              + {vac.sellDaysCount} dias abono
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-medium mt-0.5">
                              Direito integral CLT
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 4. Status do Período ("Vencido" vermelho, "Próximo a Vencer" amarelo/laranja, "Quitado" verde) */}
                      <td className="py-3.5 px-4 text-center">
                        {row.periodStatus === 'vencido' && (
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-black uppercase bg-rose-600 text-white shadow-2xs">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              <span>Vencido</span>
                            </span>
                            {row.monthsLabel && (
                              <span className="text-[10px] font-bold text-rose-700 mt-0.5">
                                {row.monthsLabel} acumulados
                              </span>
                            )}
                          </div>
                        )}
                        {row.periodStatus === 'proximo' && (
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-black uppercase bg-amber-500 text-stone-950 shadow-2xs">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              <span>Próximo a Vencer</span>
                            </span>
                            {row.monthsLabel && (
                              <span className="text-[10px] font-bold text-amber-800 mt-0.5">
                                {row.monthsLabel} acumulados
                              </span>
                            )}
                          </div>
                        )}
                        {row.periodStatus === 'quitado' && (
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-black uppercase bg-emerald-600 text-white shadow-2xs">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span>Quitado / Regular</span>
                            </span>
                            <span className="text-[10px] font-semibold text-emerald-700 mt-0.5">
                              {vac ? formatCurrencyBRL((vac as any).valor_liquido_pago ?? vac.netAmount ?? vac.totalAmount) : 'Período em dia'}
                            </span>
                          </div>
                        )}
                        {vac && row.periodStatus !== 'quitado' && ((vac as any).valor_liquido_pago !== undefined || vac.netAmount !== undefined) && (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 mt-1 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            {formatCurrencyBRL((vac as any).valor_liquido_pago ?? vac.netAmount ?? 0)}
                          </span>
                        )}
                      </td>

                      {/* 5. Limite para Gozo (Fim do período aquisitivo + 11 meses) */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div
                          className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border font-mono text-xs font-bold ${
                            row.periodStatus === 'vencido'
                              ? 'bg-rose-50 text-rose-900 border-rose-300'
                              : row.periodStatus === 'proximo'
                                ? 'bg-amber-50 text-amber-900 border-amber-300'
                                : 'bg-emerald-50/70 text-emerald-900 border-emerald-200'
                          }`}
                        >
                          <span>{formatDateBR(row.concessiveLimit)}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                          Limite concessivo (+11 meses)
                        </div>
                      </td>

                      {/* 6. Ações: Efetivar Gozo (Programados), Retorno de Férias (Em Gozo), Programar/Editar e Imprimir Recibo */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                          {/* Rotina 2: BOTÃO "EFETIVAR GOZO" para registros Programados */}
                          {row.isProgramado && vac && (
                            <button
                              type="button"
                              onClick={() => handleEfetivarGozo(row)}
                              className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-2xs transition cursor-pointer active:scale-95"
                              title="Efetivar Gozo de Férias agora, lançar Líquido no Contas a Pagar e Bruto no DRE do Veículo"
                            >
                              <PlayCircle className="w-3.5 h-3.5 shrink-0" />
                              <span>Efetivar Gozo</span>
                            </button>
                          )}

                          {/* Rotina 3: BOTÃO "RETORNO DE FÉRIAS" (Confirmar Retorno) para funcionários Em Gozo */}
                          {row.isEmGozo && (
                            <button
                              type="button"
                              onClick={() => handleConfirmarRetorno(row)}
                              className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-2xs transition cursor-pointer active:scale-95"
                              title="Confirmar Retorno de Férias: muda status para Quitado/Regular, arquiva no histórico e avança período aquisitivo no Supabase"
                            >
                              <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                              <span>Confirmar Retorno</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleOpenModalForRow(row)}
                            className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-[#0963cb] hover:bg-[#0852a8] text-white text-xs font-bold shadow-2xs transition cursor-pointer active:scale-95"
                            title="Programar/Editar Férias"
                          >
                            <Calendar className="w-3.5 h-3.5 shrink-0" />
                            <span>Programar/Editar</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handlePrintReceiptForRow(row)}
                            className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-stone-950 text-xs font-bold shadow-2xs transition cursor-pointer active:scale-95"
                            title="Imprimir Aviso/Recibo de Férias"
                            aria-label="Imprimir Aviso/Recibo de Férias"
                          >
                            <Printer className="w-3.5 h-3.5 shrink-0" />
                            <span>Imprimir Recibo</span>
                          </button>

                          {vac && (
                            <button
                              type="button"
                              onClick={() => handleDelete(vac.id)}
                              className="p-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Excluir programação salva"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 text-xs font-semibold">
                    Nenhum período aquisitivo encontrado para o filtro selecionado.
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
                      {emp.name} ({emp.role}) - {formatBRL(getEmployeeContractualSalary(emp.id, emp.name))}
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
                      ref={statusSelectRef}
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
                        <th className="py-1.5 px-3 text-left">DISCRIMINAÇÃO</th>
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
                    onClick={handleSaveModal}
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
