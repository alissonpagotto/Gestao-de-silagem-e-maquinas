import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  UserSquare2, 
  Plus, 
  AlertTriangle, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  Phone, 
  Trash2, 
  Edit3, 
  Search, 
  CreditCard, 
  Briefcase, 
  DollarSign, 
  ChevronDown, 
  ChevronUp, 
  Award, 
  X,
  Printer,
  MessageCircle,
  Camera,
  UploadCloud,
  FileText,
  Building2,
  Download,
  FileCheck,
  Paperclip,
  MapPin,
  Loader2
} from 'lucide-react';
import { Employee, CompanyProfile, EmployeeAttachment, Cargo, EmployeeRole, EmployeeRegistrationType, VacationRecord } from '../../types';
import { formatDateBR, checkCnhStatus, formatCurrencyBRL, getStoredCompanyProfile, saveStoredEmployees, getActiveCompanyId, getStoredVacations, saveStoredVacations } from '../../lib/storage';
import { formatPhone, formatCpfCnpj, parseCurrencyInput, formatCurrencyInputDisplay } from '../../lib/formatters';
import { formatIsoDateOnly, deleteRhFuncionario, fetchRhFuncionarios, mapRowToEmployee, toValidUUID, isSupabaseConfigured, uploadEmployeePhotoToStorage, uploadEmployeeDocumentToStorage, upsertRhFuncionario, fetchCloudVacations, mapRowToVacationRecord } from '../../lib/supabaseService';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { EmployeePhotoCropModal } from './EmployeePhotoCropModal';
import { ManageableDropdown } from '../common/ManageableDropdown';
import { RoleSelectDropdown } from './RoleSelectDropdown';
import { CategoryOptionsManagerModal } from '../common/CategoryOptionsManagerModal';
import { useConfirm } from '../../context/ConfirmContext';
import { PrintPreviewModal } from '../common/PrintPreviewModal';
import { PrintDocumentOptions } from '../../lib/printService';
import { PrintableEmployeeSheet } from './PrintableEmployeeSheet';
import { generateEmployeeSheetHtml, generateEmployeeWhatsAppText } from './employeePrintUtils';
import { EmployeeAvatar, isBrokenAvatarUrl } from '../common/EmployeeAvatar';


const STORAGE_KEYS = {
  REG_TYPES: 'silagem_facil_custom_reg_types_v3',
  ROLES: 'silagem_facil_custom_roles_v3',
  CONTRACT_TYPES: 'silagem_facil_custom_contract_types_v1',
};

// Opções estritas de Vínculo Contratual em ordem alfabética exata
const DEFAULT_REG_TYPES = [
  'Agenciador',
  'Auxiliar',
  'Diarista / Safrista',
  'Funcionário',
  'Mecanico Especialista',
  'Motorista Terceirizado',
  'Prestador de Serviço'
];

// Cargos/Funções operacionais que NUNCA devem constar no Tipo de Cadastro
const EXCLUDED_FROM_REG_TYPES = [
  'Operador de Maquinas',
  'Operador de Máquinas',
  'Operador de Forrageira',
  'Operador de Trator Agrícola',
  'Operador de Trator',
  'Operador de forrageira',
  'Operador de trator'
];

// Opções estritas de Cargo / Função em ordem alfabética exata
const DEFAULT_ROLES = [
  'Administrador',
  'Agenciador',
  'Auxiliar de produção',
  'Escritorio',
  'Financeiro',
  'Mecanico',
  'Mecanico especialista',
  'Mecanico interno',
  'Motorista',
  'Operador de Forrageira',
  'Operador de maquinas',
  'Operador de trator',
  'Recepcionista'
];

const DEFAULT_CONTRACT_TYPES = [
  'Registrado (CLT)',
  'Prestador de Serviço (PJ)',
  'Contrato Temporário',
  'Diarista/Informal'
];

// 1. Opções padrão para "Local de Recebimento" (Dropdown/Select editável)
const DEFAULT_PAYMENT_LOCATIONS = [
  'Conta pessoal',
  'Conta de terceiro',
];

// 2. Opções padrão para "Conta de Depósito" ordenadas estritamente em ordem alfabética
const DEFAULT_DEPOSIT_BANKS = [
  'B.Brasil',
  'Bradesco',
  'Cresol',
  'Evolua',
  'Itaú',
  'Sicoob',
  'Sicredi',
];

function normalizeStandardOption(val: string | undefined | null, defaults: string[]): string {
  if (!val) return '';
  const trimmed = String(val).trim();
  if (!trimmed) return '';
  const matched = defaults.find(opt => opt.toLowerCase() === trimmed.toLowerCase());
  return matched || trimmed;
}

/**
 * Detecta automaticamente se o valor digitado em "Conta Corrente (C.C.) / Chave Pix"
 * corresponde a um E-mail, CPF, CNPJ, Celular, Chave Aleatória (EVP) ou Conta Corrente.
 */
function detectAccountOrPixType(rawValue: string): {
  type: 'empty' | 'email' | 'cpf' | 'cnpj' | 'phone' | 'evp' | 'account';
  label: string;
  canQuickFormat11Digits: boolean;
} {
  const val = (rawValue || '').trim();
  if (!val) return { type: 'empty', label: '', canQuickFormat11Digits: false };

  if (val.includes('@')) {
    return { type: 'email', label: 'Chave Pix: E-mail', canQuickFormat11Digits: false };
  }
  if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(val)) {
    return { type: 'evp', label: 'Chave Pix: Aleatória', canQuickFormat11Digits: false };
  }
  if (/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(val)) {
    return { type: 'cpf', label: 'Chave Pix: CPF', canQuickFormat11Digits: false };
  }
  if (/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(val)) {
    return { type: 'cnpj', label: 'Chave Pix: CNPJ', canQuickFormat11Digits: false };
  }
  if (/^\(\d{2}\)\s?\d{4,5}-\d{4}$/.test(val) || /^\+55\d{10,11}$/.test(val)) {
    return { type: 'phone', label: 'Chave Pix: Celular', canQuickFormat11Digits: false };
  }

  const digitsOnly = val.replace(/\D/g, '');
  const isOnlyDigits = /^\d+$/.test(val);
  if (isOnlyDigits && digitsOnly.length === 11) {
    return { type: 'account', label: '11 dígitos (C.C., CPF ou Celular)', canQuickFormat11Digits: true };
  }

  if (/[a-zA-Z]/.test(val) && val.length >= 20) {
    return { type: 'evp', label: 'Chave Pix: Aleatória', canQuickFormat11Digits: false };
  }

  return { type: 'account', label: 'Conta Corrente / Pix', canQuickFormat11Digits: digitsOnly.length === 11 };
}

export interface EmployeeVacationAlert {
  level: 'none' | 'warning' | 'expired';
  badgeText: string;
  title: string;
  description: string;
  monthsAccumulated: number;
  monthsLabel: string;
  vestingStart: string;
  vestingEnd: string;
  concessiveLimit: string;
}

/**
 * 4. FUNÇÃO DE AUTOMAÇÃO DE ALERTA DE FÉRIAS:
 * Analisa a "Data de Admissão" e o "Período Aquisitivo" do colaborador ativo no Supabase:
 * - FÉRIAS PRÓXIMAS A VENCER (amarelo/laranja): entre 11 e 12 meses de trabalho acumulados sem gozar férias.
 * - FÉRIAS VENCIDAS (vermelho crítico): período aquisitivo ultrapassou 12 meses sem registro de gozo de férias.
 */
export function evaluateEmployeeVacationAlert(
  emp: {
    id?: string;
    name?: string;
    admissionDate?: string;
    terminationDate?: string;
    acquisitionPeriodStart?: string;
    active?: boolean;
    status?: string;
  },
  vacations: VacationRecord[]
): EmployeeVacationAlert {
  const emptyAlert: EmployeeVacationAlert = {
    level: 'none',
    badgeText: '',
    title: '',
    description: '',
    monthsAccumulated: 0,
    monthsLabel: '',
    vestingStart: '',
    vestingEnd: '',
    concessiveLimit: '',
  };

  if (!emp) return emptyAlert;
  const st = String(emp.status || '').toLowerCase();
  if (emp.active === false || st === 'inativo' || st === 'excluido' || Boolean(emp.terminationDate)) {
    return emptyAlert;
  }

  const rawAdmission = formatIsoDateOnly(
    emp.admissionDate || (emp as any).data_admissao || (emp as any).admitted_at || ''
  );
  if (!rawAdmission) return emptyAlert;

  const admParts = rawAdmission.split('-').map(Number);
  if (admParts.length !== 3 || isNaN(admParts[0]) || isNaN(admParts[1]) || isNaN(admParts[2])) {
    return emptyAlert;
  }

  const admDate = new Date(admParts[0], admParts[1] - 1, admParts[2], 12, 0, 0);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  if (admDate > today) return emptyAlert;

  // Filtra registros de férias pertencentes a este colaborador no Supabase
  const empUuid = emp.id ? toValidUUID(emp.id) : '';
  const empNameNorm = (emp.name || '').trim().toUpperCase();

  const empVacations = (vacations || []).filter(v => {
    if (!v) return false;
    if (emp.id && (v.employeeId === emp.id || toValidUUID(v.employeeId) === empUuid)) return true;
    if (empNameNorm && (v.employeeName || '').trim().toUpperCase() === empNameNorm) return true;
    return false;
  });

  // Se o colaborador está em gozo de férias neste exato momento, não dispara alerta de falta de gozo
  const isCurrentlyOnVacation =
    st === 'ferias' ||
    empVacations.some(v => {
      const vst = String(v.status || '').toLowerCase();
      if (vst === 'em_gozo') return true;
      const endDt = v.endDate || (v as any).returnDate;
      if ((vst === 'concluido' || vst === 'gozadas' || vst === 'agendado') && v.startDate && endDt) {
        const sIso = formatIsoDateOnly(v.startDate);
        const rIso = formatIsoDateOnly(endDt);
        const tIso = formatIsoDateOnly(today.toISOString());
        return Boolean(sIso && rIso && tIso && tIso >= sIso && tIso <= rIso);
      }
      return false;
    });

  if (isCurrentlyOnVacation) return emptyAlert;

  // Determina o início do Período Aquisitivo aberto (sem quitação concluída no Supabase)
  const settledVacations = empVacations.filter(v => {
    const vst = String(v.status || '').toLowerCase();
    const sit = String(v.situacao_execucao || '').toUpperCase().trim();
    return (
      vst === 'concluido' ||
      vst === 'concluida' ||
      vst === 'gozadas' ||
      vst === 'quitado' ||
      vst === 'regular' ||
      sit === 'CONCLUIDO' ||
      sit === 'QUITADO' ||
      sit === 'REGULAR' ||
      sit === 'QUITADO/REGULAR'
    );
  });

  let cycleStart = new Date(admDate.getTime());

  // Se o colaborador possui período aquisitivo atualizado explicitamente após retorno de férias
  const explicitEmpAcqStart = formatIsoDateOnly(
    emp.acquisitionPeriodStart || (emp as any).periodo_aquisitivo_inicio || ''
  );
  if (explicitEmpAcqStart) {
    const ep = explicitEmpAcqStart.split('-').map(Number);
    if (ep.length === 3 && !isNaN(ep[0])) {
      const explicitDate = new Date(ep[0], ep[1] - 1, ep[2], 12, 0, 0);
      if (explicitDate > cycleStart) {
        cycleStart = explicitDate;
      }
    }
  }

  if (settledVacations.length > 0) {
    // Avança o ciclo aquisitivo com base na quantidade de períodos já quitados ou no maior acquisitionPeriodEnd / nextAcquisitionPeriodStart
    const byCountDate = new Date(admDate.getFullYear() + settledVacations.length, admDate.getMonth(), admDate.getDate(), 12, 0, 0);
    if (byCountDate > cycleStart) {
      cycleStart = byCountDate;
    }

    for (const v of settledVacations) {
      const vNextStartIso = formatIsoDateOnly((v as any).nextAcquisitionPeriodStart || '');
      if (vNextStartIso) {
        const np = vNextStartIso.split('-').map(Number);
        if (np.length === 3 && !isNaN(np[0])) {
          const nextCycle = new Date(np[0], np[1] - 1, np[2], 12, 0, 0);
          if (nextCycle > cycleStart) {
            cycleStart = nextCycle;
          }
        }
      }

      const vEndIso = formatIsoDateOnly(v.acquisitionPeriodEnd || (v as any).vestingPeriodEnd || '');
      if (vEndIso) {
        const ep = vEndIso.split('-').map(Number);
        if (ep.length === 3 && !isNaN(ep[0])) {
          const nextCycle = new Date(ep[0], ep[1] - 1, ep[2] + 1, 12, 0, 0);
          if (nextCycle > cycleStart) {
            cycleStart = nextCycle;
          }
        }
      }
    }
  }

  const elevenMonthsDate = new Date(cycleStart.getFullYear(), cycleStart.getMonth() + 11, cycleStart.getDate(), 12, 0, 0);
  const twelveMonthsDate = new Date(cycleStart.getFullYear() + 1, cycleStart.getMonth(), cycleStart.getDate(), 12, 0, 0);

  // Cálculo preciso de meses acumulados de trabalho sem gozar férias
  let wholeMonths = (today.getFullYear() - cycleStart.getFullYear()) * 12 + (today.getMonth() - cycleStart.getMonth());
  const anchorMonthDate = new Date(cycleStart.getFullYear(), cycleStart.getMonth() + wholeMonths, cycleStart.getDate(), 12, 0, 0);
  if (today < anchorMonthDate) {
    wholeMonths -= 1;
  }
  const prevAnchorDate = new Date(cycleStart.getFullYear(), cycleStart.getMonth() + wholeMonths, cycleStart.getDate(), 12, 0, 0);
  const remainingDays = Math.max(0, Math.round((today.getTime() - prevAnchorDate.getTime()) / (1000 * 60 * 60 * 24)));
  const monthsAccumulated = Number((wholeMonths + remainingDays / 30).toFixed(1));

  const vestingStartStr = formatIsoDateOnly(cycleStart.toISOString()) || rawAdmission;
  const vestingEndEndObj = new Date(twelveMonthsDate.getFullYear(), twelveMonthsDate.getMonth(), twelveMonthsDate.getDate() - 1, 12, 0, 0);
  const vestingEndStr = formatIsoDateOnly(vestingEndEndObj.toISOString()) || '';
  // Limite para Gozo: somando 11 meses ao fim do período aquisitivo para evitar pagamento em dobro
  const concessiveLimitDate = new Date(vestingEndEndObj.getFullYear(), vestingEndEndObj.getMonth() + 11, vestingEndEndObj.getDate(), 12, 0, 0);
  const concessiveLimitStr = formatIsoDateOnly(concessiveLimitDate.toISOString()) || '';

  const monthsText =
    remainingDays > 0
      ? `${wholeMonths} ${wholeMonths === 1 ? 'mês' : 'meses'} e ${remainingDays} ${remainingDays === 1 ? 'dia' : 'dias'}`
      : `${wholeMonths} ${wholeMonths === 1 ? 'mês' : 'meses'}`;

  const hasExplicitExpiredRecord = empVacations.some(v => String(v.status || '').toLowerCase() === 'vencida');

  // Regra 2: FÉRIAS VENCIDAS (> 12 meses sem registro de gozo de férias)
  if (today >= twelveMonthsDate || monthsAccumulated > 12 || hasExplicitExpiredRecord) {
    return {
      level: 'expired',
      badgeText: 'FÉRIAS VENCIDAS',
      title: 'ALERTA CRÍTICO: FÉRIAS VENCIDAS (PERÍODO CONCESSIVO LIMITE)',
      description: `O período aquisitivo (${formatDateBR(vestingStartStr)} a ${formatDateBR(vestingEndStr)}) ultrapassou 12 meses (${monthsText} acumulados) sem registro de gozo de férias. A empresa entrou no período concessivo limite (data limite: ${formatDateBR(concessiveLimitStr)}).`,
      monthsAccumulated: Math.max(monthsAccumulated, 12.1),
      monthsLabel: monthsText,
      vestingStart: vestingStartStr,
      vestingEnd: vestingEndStr,
      concessiveLimit: concessiveLimitStr,
    };
  }

  // Regra 1: FÉRIAS PRÓXIMAS A VENCER (entre 11 e 12 meses de trabalho sem gozar férias)
  if (today >= elevenMonthsDate && today < twelveMonthsDate) {
    const daysToComplete12Months = Math.max(1, Math.round((twelveMonthsDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    return {
      level: 'warning',
      badgeText: 'FÉRIAS PRÓXIMAS A VENCER',
      title: 'ATENÇÃO RH: FÉRIAS PRÓXIMAS A VENCER (11 A 12 MESES ACUMULADOS)',
      description: `Colaborador acumulou ${monthsText} de trabalho sem gozar férias (Período Aquisitivo: ${formatDateBR(vestingStartStr)} a ${formatDateBR(vestingEndStr)}). Faltam ${daysToComplete12Months} ${daysToComplete12Months === 1 ? 'dia' : 'dias'} para completar 12 meses.`,
      monthsAccumulated,
      monthsLabel: monthsText,
      vestingStart: vestingStartStr,
      vestingEnd: vestingEndStr,
      concessiveLimit: concessiveLimitStr,
    };
  }

  return {
    ...emptyAlert,
    monthsAccumulated,
    monthsLabel: monthsText,
    vestingStart: vestingStartStr,
    vestingEnd: vestingEndStr,
    concessiveLimit: concessiveLimitStr,
  };
}

interface EditableComboboxFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (newValue: string) => void;
  options: string[];
  placeholder?: string;
}

/**
 * Componente Combobox Editável (Select + Input livre):
 * Exibe as opções padrão em um dropdown interativo ao clicar/focar e permite digitar qualquer texto personalizado.
 */
const EditableComboboxField: React.FC<EditableComboboxFieldProps> = ({
  id,
  label,
  value,
  onChange,
  options,
  placeholder = 'Selecione ou digite...',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasExactMatch = options.some(opt => opt.toLowerCase() === (value || '').trim().toLowerCase());

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor={id} className="block text-xs font-bold text-black mb-1">
        {label}
      </label>
      <div className="relative flex items-center">
        <input
          id={id}
          type="text"
          value={value}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            onChange(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full pl-3 pr-8 py-1.5 bg-white border border-stone-300 rounded-lg text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[#0963cb]"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setIsOpen(prev => !prev)}
          className="absolute right-1.5 p-1 text-stone-500 hover:text-[#0963cb] rounded-md transition cursor-pointer"
          title="Abrir lista de opções"
        >
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {isOpen && (
        <div className="absolute z-40 mt-1 w-full bg-white border border-stone-300 rounded-lg shadow-lg max-h-52 overflow-y-auto py-1">
          <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-400 border-b border-stone-100">
            Opções Padrão (ou digite no campo)
          </div>
          {options.map((option) => {
            const isSelected = (value || '').trim().toLowerCase() === option.toLowerCase();
            return (
              <button
                key={option}
                type="button"
                onClick={() => {
                  onChange(option);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-xs sm:text-sm flex items-center justify-between transition cursor-pointer ${
                  isSelected
                    ? 'bg-[#0963cb]/10 text-[#0963cb] font-bold'
                    : 'text-stone-800 hover:bg-stone-100 font-medium'
                }`}
              >
                <span>{option}</span>
                {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-[#0963cb] shrink-0" />}
              </button>
            );
          })}
          {value && value.trim() !== '' && !hasExactMatch && (
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-full text-left px-3 py-1.5 text-xs text-sky-800 bg-sky-50/80 hover:bg-sky-100 border-t border-stone-100 font-semibold flex items-center justify-between cursor-pointer"
            >
              <span className="truncate">Manter personalizado: "{value.trim()}"</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-200/70 text-sky-900 font-bold ml-2 shrink-0">
                Personalizado
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

interface EmployeesModuleProps {
  employees: Employee[];
  vacations?: VacationRecord[];
  companyProfile?: CompanyProfile;
  onSaveEmployees: (employees: Employee[]) => void;
  onDeleteEmployee?: (id: string) => Promise<void> | void;
  externalNewEmployeeTrigger?: number;
  externalPrintEmployeesTrigger?: number;
}

export const EmployeesModule: React.FC<EmployeesModuleProps> = ({
  employees,
  vacations: propVacations,
  companyProfile,
  onSaveEmployees,
  onDeleteEmployee,
  externalNewEmployeeTrigger,
  externalPrintEmployeesTrigger,
}) => {
  const { confirm } = useConfirm();
  const [searchTerm, setSearchTerm] = useState('');
  const [vacationQuickFilter, setVacationQuickFilter] = useState<'all' | 'expired' | 'warning'>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [singleEmployeePrintOptions, setSingleEmployeePrintOptions] = useState<PrintDocumentOptions | null>(null);
  const [isSingleEmployeePrintOpen, setIsSingleEmployeePrintOpen] = useState(false);

  // State for single-employee printable sheet
  const [employeeToPrint, setEmployeeToPrint] = useState<Partial<Employee> | null>(null);

  const activeCompany = useMemo(() => companyProfile || getStoredCompanyProfile(), [companyProfile]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  // Dynamic Options with persistence
  const [regTypeOptions, setRegTypeOptions] = useState<string[]>(() => {
    try {
      // 1. Checar armazenamento v3 atualizado
      const savedV3 = localStorage.getItem(STORAGE_KEYS.REG_TYPES);
      if (savedV3) {
        const parsed = JSON.parse(savedV3);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const cleaned = parsed.filter(item => !EXCLUDED_FROM_REG_TYPES.includes(item));
          return Array.from(new Set(cleaned)).sort((a, b) => a.localeCompare('pt-BR'));
        }
      }

      // 2. Migrar de v2 se existir, removendo cargos/funções operacionais
      const savedV2 = localStorage.getItem('silagem_facil_custom_reg_types_v2');
      if (savedV2) {
        const parsed = JSON.parse(savedV2);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const customOnly = parsed.filter(item => 
            !EXCLUDED_FROM_REG_TYPES.includes(item) && !DEFAULT_REG_TYPES.includes(item)
          );
          const merged = [...DEFAULT_REG_TYPES, ...customOnly].sort((a, b) => a.localeCompare('pt-BR'));
          localStorage.setItem(STORAGE_KEYS.REG_TYPES, JSON.stringify(merged));
          return merged;
        }
      }

      localStorage.setItem(STORAGE_KEYS.REG_TYPES, JSON.stringify(DEFAULT_REG_TYPES));
      return DEFAULT_REG_TYPES;
    } catch {
      return DEFAULT_REG_TYPES;
    }
  });

  const [roleOptions, setRoleOptions] = useState<string[]>(() => {
    try {
      // 1. Checar armazenamento v3 atualizado
      const savedV3 = localStorage.getItem(STORAGE_KEYS.ROLES);
      if (savedV3) {
        const parsed = JSON.parse(savedV3);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return Array.from(new Set([...DEFAULT_ROLES, ...parsed])).sort((a, b) => a.localeCompare(b, 'pt-BR'));
        }
      }

      // 2. Migrar se o usuário tiver salvo em v2
      const savedV2 = localStorage.getItem('silagem_facil_custom_roles_v2');
      if (savedV2) {
        const parsed = JSON.parse(savedV2);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const merged = Array.from(new Set([...DEFAULT_ROLES, ...parsed])).sort((a, b) => a.localeCompare(b, 'pt-BR'));
          localStorage.setItem(STORAGE_KEYS.ROLES, JSON.stringify(merged));
          return merged;
        }
      }

      // 3. Migrar se o usuário tiver adicionado cargos customizados em v1
      const savedV1 = localStorage.getItem('silagem_facil_custom_roles_v1');
      if (savedV1) {
        const parsed = JSON.parse(savedV1);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const oldDefaults = ['Motorista', 'Operador de forrageira', 'Operador de trator', 'Auxiliar', 'Administrador', 'Mecanico Especialista'];
          const customOnly = parsed.filter(item => !oldDefaults.includes(item) && !DEFAULT_ROLES.includes(item));
          const merged = [...DEFAULT_ROLES, ...customOnly].sort((a, b) => a.localeCompare(b, 'pt-BR'));
          localStorage.setItem(STORAGE_KEYS.ROLES, JSON.stringify(merged));
          return merged;
        }
      }

      localStorage.setItem(STORAGE_KEYS.ROLES, JSON.stringify(DEFAULT_ROLES));
      return DEFAULT_ROLES;
    } catch {
      return DEFAULT_ROLES;
    }
  });

  const [contractTypeOptions, setContractTypeOptions] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CONTRACT_TYPES);
      return saved ? JSON.parse(saved) : DEFAULT_CONTRACT_TYPES;
    } catch {
      return DEFAULT_CONTRACT_TYPES;
    }
  });

  const handleUpdateRegTypeOptions = (newOpts: string[]) => {
    const cleaned = newOpts.filter(item => !EXCLUDED_FROM_REG_TYPES.includes(item));
    const sorted = Array.from(new Set(cleaned)).sort((a, b) => a.localeCompare('pt-BR'));
    setRegTypeOptions(sorted);
    localStorage.setItem(STORAGE_KEYS.REG_TYPES, JSON.stringify(sorted));
  };

  const handleUpdateRoleOptions = (newOpts: string[]) => {
    const sorted = Array.from(new Set(newOpts)).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    setRoleOptions(sorted);
    localStorage.setItem(STORAGE_KEYS.ROLES, JSON.stringify(sorted));
    if (role1 && !sorted.some(r => r.toLowerCase() === role1.toLowerCase())) {
      setRole1(sorted[0] || 'Operador de Forrageira');
    }
    if (role2 && !sorted.some(r => r.toLowerCase() === role2.toLowerCase())) {
      setRole2('');
    }
  };

  const handleUpdateContractTypeOptions = (newOpts: string[]) => {
    setContractTypeOptions(newOpts);
    localStorage.setItem(STORAGE_KEYS.CONTRACT_TYPES, JSON.stringify(newOpts));
  };

  // Form State
  const [registrationType, setRegistrationType] = useState<EmployeeRegistrationType | string>('Funcionário');
  const [name, setName] = useState<string>('');
  const [role1, setRole1] = useState<string>('Operador de Forrageira');
  const [role2, setRole2] = useState<string>('');
  const [isRoleManagerOpen, setIsRoleManagerOpen] = useState<boolean>(false);
  const [roleManagerTarget, setRoleManagerTarget] = useState<'role1' | 'role2' | null>(null);

  // Broker Commission State (Agenciador)
  const [brokerCommissionType, setBrokerCommissionType] = useState<string>('Porcentagem (%) sobre o valor do pedido');
  const [brokerCommissionValue, setBrokerCommissionValue] = useState<string>('5,00');
  const [actingRegion, setActingRegion] = useState<string>('');

  const isBroker = useMemo(() => {
    return role1.trim().toLowerCase() === 'agenciador' || role2.trim().toLowerCase() === 'agenciador';
  }, [role1, role2]);

  const sortedRoleOptions = useMemo(() => {
    return [...roleOptions].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [roleOptions]);

  const [cpf, setCpf] = useState<string>('');
  const [rg, setRg] = useState<string>('');
  const [birthDate, setBirthDate] = useState<string>('');
  const [pis, setPis] = useState<string>('');
  const [photoUrl, setPhotoUrl] = useState<string | undefined>('');
  const [phone, setPhone] = useState<string>('');
  const [baseSalary, setBaseSalary] = useState<string>('0,00');
  const [contractType, setContractType] = useState<string>('Registrado (CLT)');
  const [admissionDate, setAdmissionDate] = useState<string>('');
  const [terminationDate, setTerminationDate] = useState<string>('');
  const [isActive, setIsActive] = useState<boolean>(true);

  // Commission Box State
  const [receivesCommission, setReceivesCommission] = useState<boolean>(false);
  const [commissionPerHour, setCommissionPerHour] = useState<string>('0,00');
  const [commissionPerAlqueire, setCommissionPerAlqueire] = useState<string>('0,00');
  const [commissionPerHectare, setCommissionPerHectare] = useState<string>('0,00');

  // Se a função for Agenciador, desativa automaticamente a comissão de produção geral
  useEffect(() => {
    if (isBroker && receivesCommission) {
      setReceivesCommission(false);
    }
  }, [isBroker, receivesCommission]);

  // CNH Details (Collapsible / Extended)
  const [showCnhFields, setShowCnhFields] = useState<boolean>(false);
  const [cnhNumber, setCnhNumber] = useState<string>('');
  const [cnhCategory, setCnhCategory] = useState<string>('B');
  const [cnhExpiration, setCnhExpiration] = useState<string>('');
  const [cnhUpgradeDT, setCnhUpgradeDT] = useState<boolean>(false);
  const [cnhUpgradeCategory, setCnhUpgradeCategory] = useState<string>('A');

  // Financial / Payment Info
  const [paymentLocation, setPaymentLocation] = useState<string>('');
  const [bankPixKey, setBankPixKey] = useState<string>('');
  const [bankAgency, setBankAgency] = useState<string>('');
  const [bankAccount, setBankAccount] = useState<string>('');

  // Attachments / Documents
  const [admissionExamDoc, setAdmissionExamDoc] = useState<EmployeeAttachment | null>(null);
  const [experienceContractDoc, setExperienceContractDoc] = useState<EmployeeAttachment | null>(null);
  const [generalDocs, setGeneralDocs] = useState<EmployeeAttachment | null>(null);
  const [signedRegistrationDoc, setSignedRegistrationDoc] = useState<EmployeeAttachment | null>(null);

  // Estados independentes para os 4 arquivos (Upload para bucket 'documentos')
  const [asoFile, setAsoFile] = useState<File | null>(null);
  const [contratoFile, setContratoFile] = useState<File | null>(null);
  const [cnhFile, setCnhFile] = useState<File | null>(null);
  const [fichaFile, setFichaFile] = useState<File | null>(null);

  const [localEmployees, setLocalEmployees] = useState<Employee[]>(employees);
  const [localVacations, setLocalVacations] = useState<VacationRecord[]>(() =>
    propVacations && propVacations.length > 0 ? propVacations : getStoredVacations()
  );
  const { currentUser } = useAuth();
  const [isCropModalOpen, setIsCropModalOpen] = useState<boolean>(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);

  // Identificador do funcionário ativo selecionado para edição (primitivo estável para controle de loops)
  const activeEmployeeId = editingEmployee?.id ? String(editingEmployee.id) : null;

  useEffect(() => {
    if (employees) {
      setLocalEmployees(employees);
    }
  }, [employees]);

  useEffect(() => {
    if (propVacations) {
      setLocalVacations(propVacations);
    }
  }, [propVacations]);

  // 1. Estancar o Loop do useEffect para Férias/Afastamentos do Funcionário Selecionado no Modal:
  // Hook controlado com dependência direta no ID do funcionário ativo (activeEmployeeId) e no estado do modal (isModalOpen).
  // Limpa ouvintes e impede loop infinito de requisições ao Supabase enquanto o modal estiver aberto.
  const lastFetchedEmployeeVacIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Se o modal estiver fechado ou não houver funcionário selecionado, reseta o ref de controle e encerra
    if (!isModalOpen || !activeEmployeeId || !isSupabaseConfigured) {
      if (!isModalOpen) {
        lastFetchedEmployeeVacIdRef.current = null;
      }
      return;
    }

    // Se já carregou para o mesmo funcionário ativo enquanto o modal está aberto, estanca o loop
    if (lastFetchedEmployeeVacIdRef.current === activeEmployeeId) {
      return;
    }

    let isMounted = true;
    lastFetchedEmployeeVacIdRef.current = activeEmployeeId;
    const companyId = activeCompany?.id || getActiveCompanyId();
    const activeUid = currentUser?.id;

    // Busca específica das informações de férias/afastamento do funcionário selecionado
    fetchCloudVacations(companyId, activeEmployeeId, activeUid)
      .then((cloudVacations) => {
        if (!isMounted) return;
        // 2. Validação de Resposta do Banco:
        // Se a consulta retornar vazia ou der erro, trata o estado local como um array vazio [] de forma silenciosa
        if (Array.isArray(cloudVacations) && cloudVacations.length > 0) {
          setLocalVacations(prev => {
            const currentList = Array.isArray(prev) ? prev : [];
            const otherEmployeesVacs = currentList.filter(
              v => v.employeeId !== activeEmployeeId && toValidUUID(v.employeeId) !== toValidUUID(activeEmployeeId)
            );
            const merged = [...otherEmployeesVacs, ...cloudVacations];
            saveStoredVacations(merged);
            return merged;
          });
        } else {
          // Trata silenciosamente como array vazio [] para o funcionário ativo
          setLocalVacations(prev => {
            const currentList = Array.isArray(prev) ? prev : [];
            return currentList.filter(
              v => v.employeeId !== activeEmployeeId && toValidUUID(v.employeeId) !== toValidUUID(activeEmployeeId)
            );
          });
        }
      })
      .catch(() => {
        // Falha tratada de forma silenciosa para não poluir o console
        if (isMounted) {
          setLocalVacations(prev => {
            const currentList = Array.isArray(prev) ? prev : [];
            return currentList.filter(
              v => v.employeeId !== activeEmployeeId && toValidUUID(v.employeeId) !== toValidUUID(activeEmployeeId)
            );
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isModalOpen, activeEmployeeId, activeCompany?.id, currentUser?.id]);

  // Gatilho de verificação em background para sincronizar férias (rh_ferias) do Supabase (uma única vez)
  const hasInitialVacSyncRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let isMounted = true;
    const companyId = activeCompany?.id || getActiveCompanyId();
    const activeUid = currentUser?.id;

    if (!hasInitialVacSyncRef.current) {
      hasInitialVacSyncRef.current = true;
      fetchCloudVacations(companyId, undefined, activeUid)
        .then((cloudVacations) => {
          if (!isMounted) return;
          // 2. Validação de Resposta do Banco:
          // Se a consulta retornar vazia ou der erro, trata o estado local como um array vazio [] de forma silenciosa
          if (Array.isArray(cloudVacations) && cloudVacations.length > 0) {
            setLocalVacations(cloudVacations);
            saveStoredVacations(cloudVacations);
          } else {
            setLocalVacations([]);
          }
        })
        .catch(() => {
          if (isMounted) {
            setLocalVacations([]);
          }
        });
    }

    let vacChannel: any = null;
    try {
      const channelId = `emp_vac_alerts_rt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      vacChannel = supabase
        .channel(channelId)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'rh_ferias' },
          (payload: any) => {
            if (!isMounted) return;
            if (payload.eventType === 'DELETE' && payload.old?.id) {
              setLocalVacations(prev => prev.filter(v => v.id !== payload.old.id && toValidUUID(v.id) !== payload.old.id));
            } else if (payload.new) {
              const mapped = mapRowToVacationRecord(payload.new);
              setLocalVacations(prev => {
                const exists = prev.some(v => v.id === mapped.id || toValidUUID(v.id) === mapped.id);
                return exists
                  ? prev.map(v => (v.id === mapped.id || toValidUUID(v.id) === mapped.id ? { ...v, ...mapped } : v))
                  : [mapped, ...prev];
              });
            }
          }
        )
        .subscribe();
    } catch (_) {}

    const handleLocalVacationMutation = (e: any) => {
      const incoming = e?.detail?.vacation as VacationRecord | undefined;
      if (!incoming || !isMounted) return;
      const targetId = toValidUUID(incoming.id);
      setLocalVacations(prev => {
        const exists = prev.some(v => v.id === incoming.id || toValidUUID(v.id) === targetId);
        return exists
          ? prev.map(v => (v.id === incoming.id || toValidUUID(v.id) === targetId ? { ...v, ...incoming } : v))
          : [incoming, ...prev];
      });
    };

    window.addEventListener('silagem_vacation_realtime_mutation', handleLocalVacationMutation);

    return () => {
      isMounted = false;
      window.removeEventListener('silagem_vacation_realtime_mutation', handleLocalVacationMutation);
      if (vacChannel) {
        try {
          supabase.removeChannel(vacChannel);
        } catch (_) {}
      }
    };
  }, [activeCompany?.id, currentUser?.id]);

  // Sincronização em tempo real multi-dispositivos (Supabase Realtime) escutando 'rh_funcionarios' com isolamento estrito
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let isMounted = true;
    let channel: any = null;

    const setupRealtime = async () => {
      let activeUid = currentUser?.id;
      if (!activeUid) {
        try {
          const { data: authData } = await supabase.auth.getUser();
          activeUid = authData?.user?.id;
          if (!activeUid) {
            const { data: sessData } = await supabase.auth.getSession();
            activeUid = sessData?.session?.user?.id;
          }
        } catch (_) {}
      }
      if (!activeUid) return;

      const channelId = `employees_module_rt_${activeUid}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      channel = supabase
        .channel(channelId)
        .on(
          'postgres_changes',
          { 
            event: '*', 
            schema: 'public', 
            table: 'rh_funcionarios',
            filter: `user_id=eq.${activeUid}`
          },
          async (payload: any) => {
            if (!isMounted) return;
            console.info('📡 [Realtime RH - Funcionários] Alteração em rh_funcionarios:', payload.eventType, payload);

            // Blindagem absoluta de isolamento: descarta eventos pertencentes a outros assinantes
            if (payload.new) {
              const rowUid = String(payload.new.user_id || '').trim();
              if (rowUid && rowUid !== activeUid) {
                return;
              }
            }

            // 1. Atualização de estado imediata sem delay (Zero delay)
            if (payload.eventType === 'DELETE') {
              const deletedId = payload.old?.id;
              if (deletedId) {
                setLocalEmployees(prev => {
                  const updated = prev.filter(e => e.id !== deletedId && toValidUUID(e.id) !== deletedId);
                  saveStoredEmployees(updated);
                  if (onSaveEmployees) onSaveEmployees(updated);
                  return updated;
                });
              }
            } else if (payload.eventType === 'INSERT' && payload.new) {
              const baseMapped = mapRowToEmployee(payload.new);
              const mapped: Employee = {
                ...baseMapped,
                user_id: activeUid,
                userId: activeUid,
                paymentLocation: payload.new.local_recebimento || payload.new.payment_location || baseMapped.paymentLocation,
                bankPixKey: payload.new.banco_chave_pix || payload.new.bank_pix_key || baseMapped.bankPixKey,
                bankAgency: payload.new.agencia || payload.new.bank_agency || baseMapped.bankAgency,
                bankAccount: payload.new.conta_corrente || payload.new.bank_account || baseMapped.bankAccount,
                local_recebimento: payload.new.local_recebimento || baseMapped.paymentLocation,
                banco_chave_pix: payload.new.banco_chave_pix || baseMapped.bankPixKey,
                agencia: payload.new.agencia || baseMapped.bankAgency,
                conta_corrente: payload.new.conta_corrente || baseMapped.bankAccount,
                photoUrl: payload.new.foto_url || baseMapped.photoUrl,
                foto_url: payload.new.foto_url || baseMapped.foto_url,
                aso_url: payload.new.aso_url || baseMapped.aso_url,
                contrato_experiencia_url: payload.new.contrato_experiencia_url || baseMapped.contrato_experiencia_url,
                cnh_url: payload.new.cnh_url || baseMapped.cnh_url,
                ficha_registro_url: payload.new.ficha_registro_url || baseMapped.ficha_registro_url,
                admissionExamDoc: baseMapped.admissionExamDoc,
                experienceContractDoc: baseMapped.experienceContractDoc,
                generalDocs: baseMapped.generalDocs,
                signedRegistrationDoc: baseMapped.signedRegistrationDoc,
              };
              setLocalEmployees(prev => {
                const exists = prev.some(e => e.id === mapped.id || toValidUUID(e.id) === mapped.id);
                const updated = exists
                  ? prev.map(e => (e.id === mapped.id || toValidUUID(e.id) === mapped.id) ? { ...e, ...mapped } : e)
                  : [...prev, mapped].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
                saveStoredEmployees(updated);
                if (onSaveEmployees) onSaveEmployees(updated);
                return updated;
              });
            } else if (payload.eventType === 'UPDATE' && payload.new) {
              const baseMapped = mapRowToEmployee(payload.new);
              const mapped: Employee = {
                ...baseMapped,
                user_id: activeUid,
                userId: activeUid,
                paymentLocation: payload.new.local_recebimento || payload.new.payment_location || baseMapped.paymentLocation,
                bankPixKey: payload.new.banco_chave_pix || payload.new.bank_pix_key || baseMapped.bankPixKey,
                bankAgency: payload.new.agencia || payload.new.bank_agency || baseMapped.bankAgency,
                bankAccount: payload.new.conta_corrente || payload.new.bank_account || baseMapped.bankAccount,
                local_recebimento: payload.new.local_recebimento || baseMapped.paymentLocation,
                banco_chave_pix: payload.new.banco_chave_pix || baseMapped.bankPixKey,
                agencia: payload.new.agencia || baseMapped.bankAgency,
                conta_corrente: payload.new.conta_corrente || baseMapped.bankAccount,
                photoUrl: payload.new.foto_url || baseMapped.photoUrl,
                foto_url: payload.new.foto_url || baseMapped.foto_url,
                aso_url: payload.new.aso_url || baseMapped.aso_url,
                contrato_experiencia_url: payload.new.contrato_experiencia_url || baseMapped.contrato_experiencia_url,
                cnh_url: payload.new.cnh_url || baseMapped.cnh_url,
                ficha_registro_url: payload.new.ficha_registro_url || baseMapped.ficha_registro_url,
                admissionExamDoc: baseMapped.admissionExamDoc,
                experienceContractDoc: baseMapped.experienceContractDoc,
                generalDocs: baseMapped.generalDocs,
                signedRegistrationDoc: baseMapped.signedRegistrationDoc,
              };
              setLocalEmployees(prev => {
                const updated = prev.map(e => (e.id === mapped.id || toValidUUID(e.id) === mapped.id) ? { ...e, ...mapped } : e);
                saveStoredEmployees(updated);
                if (onSaveEmployees) onSaveEmployees(updated);
                return updated;
              });
            }

            // 2. Reconciliação completa com filtro estrito .eq('user_id', activeUid)
            try {
              const fresh = await fetchRhFuncionarios(undefined, activeUid);
              if (isMounted && fresh && Array.isArray(fresh)) {
                const strictlyMine = fresh.filter(e => String(e.userId || (e as any).user_id || '').trim() === activeUid);
                setLocalEmployees(strictlyMine);
                saveStoredEmployees(strictlyMine);
                if (onSaveEmployees) onSaveEmployees(strictlyMine);
              }
            } catch (err) {
              console.warn('[EmployeesModule] Erro ao sincronizar funcionários em tempo real:', err);
            }
          }
        )
        .subscribe();
    };

    setupRealtime();

    // Revalidação em caso de foco / retorno à aba (evita cache obsoleto)
    const handleFocus = async () => {
      let activeUid = currentUser?.id;
      if (!activeUid) {
        try {
          const { data: authData } = await supabase.auth.getUser();
          activeUid = authData?.user?.id;
        } catch (_) {}
      }
      if (!activeUid) return;

      try {
        const fresh = await fetchRhFuncionarios(undefined, activeUid);
        if (isMounted && fresh && Array.isArray(fresh)) {
          const strictlyMine = fresh.filter(e => String(e.userId || (e as any).user_id || '').trim() === activeUid);
          setLocalEmployees(strictlyMine);
          saveStoredEmployees(strictlyMine);
          if (onSaveEmployees) onSaveEmployees(strictlyMine);
        }
      } catch (_) {}
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      isMounted = false;
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [currentUser?.id, onSaveEmployees]);

  const cnhReport = checkCnhStatus(localEmployees);

  // Lista de colaboradores deduplicada por id e ordenada de A a Z pelo nome
  const filteredEmployees = useMemo(() => {
    // 1. Deduplicação para garantir integridade caso venham registros duplicados
    const seen = new Set<string>();
    const deduplicated: Employee[] = [];
    for (const emp of localEmployees) {
      if (!emp || !emp.name || emp.name.trim() === '') continue;
      const st = String(emp.status || '').toLowerCase();
      if (st === 'excluido' || st === 'inativo' || emp.active === false) continue;
      // Ignora o registro antigo/duplicado de ALISSON PAG sem CPF
      if (emp.id === 'ab80e2fa-5094-43b3-83bf-c34047bf1b42' || (emp.name.trim().toUpperCase() === 'ALISSON PAG' && !emp.cpf)) {
        continue;
      }
      const key = emp.id ? String(emp.id) : `${emp.name?.trim().toUpperCase()}_${emp.cpf || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(emp);
      }
    }

    return deduplicated
      .filter(emp =>
        (emp.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (emp.role || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (emp.roles && emp.roles.some(r => r.toLowerCase().includes(searchTerm.toLowerCase()))) ||
        (emp.cpf && emp.cpf.includes(searchTerm)) ||
        (emp.rg && emp.rg.includes(searchTerm)) ||
        (emp.pis && emp.pis.includes(searchTerm)) ||
        (emp.cnhNumber && emp.cnhNumber.includes(searchTerm))
      )
      .sort((a, b) => 
        (a.name || (a as any).nome_funcionario || '').localeCompare(b.name || (b as any).nome_funcionario || '', 'pt-BR')
      );
  }, [localEmployees, searchTerm]);

  // 1. ORDENAÇÃO AUTOMÁTICA DA TABELA (ORDEM ALFABÉTICA A-Z):
  // Garante que a lista de colaboradores seja exibida SEMPRE em ordem alfabética
  const listaOrdenada = useMemo(() => {
    return [...filteredEmployees].sort((a, b) => 
      (a.name || (a as any).nome_funcionario || '').localeCompare(b.name || (b as any).nome_funcionario || '', 'pt-BR')
    );
  }, [filteredEmployees]);

  // 2. SINCRONIZAÇÃO DO CONTADOR (USEMEMO):
  // Altera o valor do card "TOTAL DE COLABORADORES" para refletir exatamente o tamanho da array
  // de funcionários ativos já filtrados no front-end, garantindo que o número visualizado seja
  // fixo e rigorosamente idêntico à quantidade de linhas exibidas na tabela.
  const totalColaboradoresCount = useMemo(() => {
    return listaOrdenada.length;
  }, [listaOrdenada]);

  const activeColaboradoresCount = useMemo(() => {
    return listaOrdenada.filter(e => e.active !== false && String(e.status || '').toLowerCase() !== 'inativo' && String(e.status || '').toLowerCase() !== 'excluido').length;
  }, [listaOrdenada]);

  // 4. MAPA DE ALERTAS DE FÉRIAS EM TEMPO REAL (USEMEMO):
  // Analisa Data de Admissão e Período Aquisitivo de todos os colaboradores ativos
  const vacationAlertsByEmployeeId = useMemo(() => {
    const map: Record<string, EmployeeVacationAlert> = {};
    for (const emp of listaOrdenada) {
      if (!emp.id) continue;
      map[emp.id] = evaluateEmployeeVacationAlert(emp, localVacations);
    }
    return map;
  }, [listaOrdenada, localVacations]);

  const vacationAlertsSummary = useMemo(() => {
    let expiredCount = 0;
    let warningCount = 0;
    for (const emp of listaOrdenada) {
      const alert = vacationAlertsByEmployeeId[emp.id];
      if (!alert) continue;
      if (alert.level === 'expired') expiredCount += 1;
      else if (alert.level === 'warning') warningCount += 1;
    }
    return { expiredCount, warningCount, totalAlerts: expiredCount + warningCount };
  }, [listaOrdenada, vacationAlertsByEmployeeId]);

  // Lista exibida após aplicação do filtro rápido de férias (Todos, Férias Vencidas, Férias a Vencer)
  const displayedEmployees = useMemo(() => {
    if (vacationQuickFilter === 'expired') {
      return listaOrdenada.filter(emp => vacationAlertsByEmployeeId[emp.id]?.level === 'expired');
    }
    if (vacationQuickFilter === 'warning') {
      return listaOrdenada.filter(emp => vacationAlertsByEmployeeId[emp.id]?.level === 'warning');
    }
    return listaOrdenada;
  }, [listaOrdenada, vacationQuickFilter, vacationAlertsByEmployeeId]);

  // Alerta de Férias dinâmico para o colaborador aberto no modal de edição/cadastro
  const modalVacationAlert = useMemo(() => {
    return evaluateEmployeeVacationAlert(
      {
        id: editingEmployee?.id,
        name: name || editingEmployee?.name,
        admissionDate: admissionDate || editingEmployee?.admissionDate,
        terminationDate: terminationDate || editingEmployee?.terminationDate,
        active: isActive,
        status: isActive ? (editingEmployee?.status || 'ativo') : 'inativo',
      },
      localVacations
    );
  }, [editingEmployee, name, admissionDate, terminationDate, isActive, localVacations]);

  const detectedAccountOrPix = useMemo(() => {
    return detectAccountOrPixType(bankAccount);
  }, [bankAccount]);

  const handleOpenNew = () => {
    setEditingEmployee(null);
    setRegistrationType('Funcionário');
    setName('');
    setRole1('Operador de Forrageira');
    setRole2('');
    setBrokerCommissionType('Porcentagem (%) sobre o valor do pedido');
    setBrokerCommissionValue('5,00');
    setActingRegion('');
    setCpf('');
    setRg('');
    setBirthDate('');
    setPis('');
    setPhotoUrl('');
    setPhone('');
    setBaseSalary('0,00');
    setContractType('Registrado (CLT)');
    setAdmissionDate(new Date().toISOString().split('T')[0]);
    setTerminationDate('');
    setIsActive(true);
    setReceivesCommission(false);
    setCommissionPerHour('0,00');
    setCommissionPerAlqueire('0,00');
    setCommissionPerHectare('0,00');
    setCnhNumber('');
    setCnhCategory('B');
    setCnhExpiration('');
    setCnhUpgradeDT(false);
    setCnhUpgradeCategory('A');
    setPaymentLocation('');
    setBankPixKey('');
    setBankAgency('');
    setBankAccount('');
    setAsoFile(null);
    setContratoFile(null);
    setCnhFile(null);
    setFichaFile(null);
    setAdmissionExamDoc(null);
    setExperienceContractDoc(null);
    setGeneralDocs(null);
    setSignedRegistrationDoc(null);
    setShowCnhFields(false);
    setIsModalOpen(true);
  };

  // Listeners para triggers externos vindos da linha do cabeçalho principal
  const lastNewTriggerRef = useRef(externalNewEmployeeTrigger);
  useEffect(() => {
    if (externalNewEmployeeTrigger !== undefined && externalNewEmployeeTrigger !== lastNewTriggerRef.current) {
      lastNewTriggerRef.current = externalNewEmployeeTrigger;
      if (externalNewEmployeeTrigger > 0) {
        handleOpenNew();
      }
    }
  }, [externalNewEmployeeTrigger]);

  const lastPrintTriggerRef = useRef(externalPrintEmployeesTrigger);
  useEffect(() => {
    if (externalPrintEmployeesTrigger !== undefined && externalPrintEmployeesTrigger !== lastPrintTriggerRef.current) {
      lastPrintTriggerRef.current = externalPrintEmployeesTrigger;
      if (externalPrintEmployeesTrigger > 0) {
        setIsPrintModalOpen(true);
      }
    }
  }, [externalPrintEmployeesTrigger]);

  const handleOpenEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    const resolvedRegType = emp.registrationType === 'mecanico_especialista' ? 'Mecanico Especialista' : (emp.registrationType || 'Funcionário');
    
    // Inicialização das funções 1 e 2
    let initialRoles: string[] = [];
    if (Array.isArray(emp.roles) && emp.roles.length > 0) {
      initialRoles = emp.roles;
    } else if (emp.role) {
      initialRoles = emp.role.split(',').map(r => r.trim()).filter(Boolean);
    }
    const normalizedRoles = initialRoles.map(r => r === 'mecanico_especialista' ? 'Mecanico especialista' : r);
    const r1 = normalizedRoles[0] || 'Operador de Forrageira';
    const r2 = normalizedRoles[1] || '';

    setRegistrationType(resolvedRegType);
    setName((emp.name || '').toUpperCase());
    setRole1(r1);
    setRole2(r2);
    setBrokerCommissionType(emp.brokerCommissionType || 'Porcentagem (%) sobre o valor do pedido');
    setBrokerCommissionValue(
      emp.brokerCommissionValue !== undefined
        ? formatCurrencyInputDisplay(emp.brokerCommissionValue)
        : '5,00'
    );
    setActingRegion((emp.actingRegion || '').toUpperCase());
    setCpf(emp.cpf || '');
    setRg((emp.rg || '').toUpperCase());
    setBirthDate(emp.birthDate || '');
    setPis((emp.pis || '').toUpperCase());
    setPhotoUrl(emp.photoUrl && !isBrokenAvatarUrl(emp.photoUrl) ? emp.photoUrl : '');
    setPhone(emp.phone || '');
    setBaseSalary(emp.baseSalary !== undefined ? formatCurrencyInputDisplay(emp.baseSalary) : (emp.salary !== undefined ? formatCurrencyInputDisplay(emp.salary) : '0,00'));
    setContractType(emp.contractType || (emp as any).regime || 'Registrado (CLT)');
    
    // Converte datas para YYYY-MM-DD para garantir compatibilidade com input type="date"
    const safeAdm = formatIsoDateOnly(emp.admissionDate || (emp as any).data_admissao || (emp as any).admitted_at) || '';
    setAdmissionDate(safeAdm);
    const safeTerm = formatIsoDateOnly(emp.terminationDate || (emp as any).data_demissao) || '';
    setTerminationDate(safeTerm);
    const safeBirth = formatIsoDateOnly(emp.birthDate || (emp as any).data_nascimento) || '';
    setBirthDate(safeBirth);

    setIsActive(emp.active !== undefined ? emp.active : (emp.status !== 'inativo'));
    const isEmpBroker = r1.trim().toLowerCase() === 'agenciador' || r2.trim().toLowerCase() === 'agenciador';

    // Normalização rigorosa de comissões numéricas
    const commVal = Number(
      emp.commissionPerHour ||
      emp.commissionPerAlqueire ||
      emp.commissionPerHectare ||
      (emp as any).comissao_hora ||
      (emp as any).comissao_alqueire ||
      (emp as any).comissao_hectare ||
      (emp as any).comissao_valor ||
      (emp as any).comissao ||
      0
    );
    const recComm = Boolean(
      emp.receivesCommission ||
      (emp as any).recebe_comissao ||
      commVal > 0
    );
    setReceivesCommission(isEmpBroker ? false : recComm);

    const commPerHourVal = (emp.commissionPerHour !== undefined && Number(emp.commissionPerHour) > 0)
      ? emp.commissionPerHour
      : ((emp as any).comissao_hora || (emp as any).comissao_valor || (emp as any).comissao || 0);
    setCommissionPerHour(!isEmpBroker && commPerHourVal ? formatCurrencyInputDisplay(Number(commPerHourVal)) : '0,00');

    const commPerAlqVal = (emp.commissionPerAlqueire !== undefined && Number(emp.commissionPerAlqueire) > 0)
      ? emp.commissionPerAlqueire
      : ((emp as any).comissao_alqueire || 0);
    setCommissionPerAlqueire(!isEmpBroker && commPerAlqVal ? formatCurrencyInputDisplay(Number(commPerAlqVal)) : '0,00');

    const commPerHaVal = (emp.commissionPerHectare !== undefined && Number(emp.commissionPerHectare) > 0)
      ? emp.commissionPerHectare
      : ((emp as any).comissao_hectare || 0);
    setCommissionPerHectare(!isEmpBroker && commPerHaVal ? formatCurrencyInputDisplay(Number(commPerHaVal)) : '0,00');
    
    setCnhNumber((emp.cnhNumber || '').toUpperCase());
    setCnhCategory(emp.cnhCategory || 'B');
    const safeCnhExp = formatIsoDateOnly(emp.cnhExpiration || (emp as any).license_expiry || (emp as any).cnh_vencimento) || '';
    setCnhExpiration(safeCnhExp);
    setCnhUpgradeDT(Boolean(emp.cnhUpgradeDT));
    setCnhUpgradeCategory(emp.cnhUpgradeCategory || 'A');

    setPaymentLocation(
      normalizeStandardOption((emp as any).local_recebimento || emp.paymentLocation || '', DEFAULT_PAYMENT_LOCATIONS)
    );
    setBankPixKey(
      normalizeStandardOption((emp as any).banco_chave_pix || emp.bankPixKey || '', DEFAULT_DEPOSIT_BANKS)
    );
    setBankAgency(((emp as any).agencia || emp.bankAgency || '').toUpperCase());
    setBankAccount(((emp as any).conta_corrente || emp.bankAccount || '').trim());

    setAsoFile(null);
    setContratoFile(null);
    setCnhFile(null);
    setFichaFile(null);

    const asoUrl = emp.aso_url || (emp as any).aso_url;
    const asoDoc = emp.admissionExamDoc || (asoUrl ? {
      name: 'Exame Admissional (ASO)',
      fileData: asoUrl,
      uploadedAt: new Date().toISOString(),
    } : null);
    setAdmissionExamDoc(asoDoc);

    const expUrl = emp.contrato_experiencia_url || (emp as any).contrato_experiencia_url || (emp as any).contrato_url;
    const expDoc = emp.experienceContractDoc || (expUrl ? {
      name: 'Contrato de Experiência',
      fileData: expUrl,
      uploadedAt: new Date().toISOString(),
    } : null);
    setExperienceContractDoc(expDoc);

    const cnhDocUrl = emp.cnh_url || (emp as any).cnh_url;
    const cnhDoc = emp.generalDocs || (cnhDocUrl ? {
      name: 'Documentos Gerais (RE + CNH)',
      fileData: cnhDocUrl,
      uploadedAt: new Date().toISOString(),
    } : null);
    setGeneralDocs(cnhDoc);

    const fichaUrl = emp.ficha_registro_url || (emp as any).ficha_registro_url;
    const fichaDoc = emp.signedRegistrationDoc || (fichaUrl ? {
      name: 'Ficha Cadastral Assinada',
      fileData: fichaUrl,
      uploadedAt: new Date().toISOString(),
    } : null);
    setSignedRegistrationDoc(fichaDoc);

    setShowCnhFields(Boolean(emp.cnhNumber || emp.cnhExpiration || emp.cnhUpgradeDT));
    setIsModalOpen(true);
  };

  // Open official print preview modal for a specific employee sheet
  const handleOpenEmployeePrint = (emp: Partial<Employee>) => {
    setEmployeeToPrint(emp);
    const contentHtml = generateEmployeeSheetHtml(emp, activeCompany);
    const whatsappText = generateEmployeeWhatsAppText(emp, activeCompany);
    const empName = emp.name?.trim() || 'Colaborador';
    const companyTradeName = activeCompany.tradeName || 'Silagem Fácil';

    setSingleEmployeePrintOptions({
      title: `Ficha Cadastral & Termo de Admissão - ${empName}`,
      subtitle: `Colaborador: ${empName} • Função: ${emp.role || 'Operador'} • Regime: ${emp.contractType || 'CLT'}`,
      documentType: 'CADASTRO DE FUNCIONÁRIO PARA ASSINATURA',
      company: activeCompany,
      contentHtml,
      showSignatures: true,
      signatureLabels: [
        `Assinatura do Colaborador: ${empName}`,
        `Recursos Humanos - ${companyTradeName}`
      ],
      whatsappText,
    });
    setIsSingleEmployeePrintOpen(true);
  };

  // Helper alias to trigger employee sheet print modal
  const handlePrintEmployeeSheet = (emp: Partial<Employee>) => {
    handleOpenEmployeePrint(emp);
  };

  // Helper to trigger print from current modal form state
  const handlePrintCurrentModalEmployee = () => {
    const parsedSalary = parseCurrencyInput(baseSalary);
    const parsedPerHour = parseCurrencyInput(commissionPerHour);
    const parsedPerAlq = parseCurrencyInput(commissionPerAlqueire);
    const parsedPerHa = parseCurrencyInput(commissionPerHectare);

    const activeRoles: string[] = [];
    if (role1.trim()) activeRoles.push(role1.trim());
    if (role2.trim() && role2.trim().toLowerCase() !== role1.trim().toLowerCase()) activeRoles.push(role2.trim());
    const finalRoles = activeRoles.length > 0 ? activeRoles : ['Operador de Forrageira'];
    const finalRole = finalRoles.join(', ');
    const rawRegType = registrationType.trim();
    const finalRegType = (rawRegType === 'mecanico_especialista' ? 'Mecanico Especialista' : rawRegType) || 'Funcionário';
    const finalReceivesCommission = !isBroker && receivesCommission;

    const snapshot: Partial<Employee> = {
      id: editingEmployee?.id || `emp_temp_${Date.now()}`,
      name: name.trim().toUpperCase() || 'NOME DO COLABORADOR',
      registrationType: finalRegType,
      role: finalRole,
      roles: finalRoles,
      brokerCommissionType: isBroker ? brokerCommissionType : undefined,
      brokerCommissionValue: isBroker ? parseCurrencyInput(brokerCommissionValue) : undefined,
      actingRegion: isBroker && actingRegion.trim() ? actingRegion.trim().toUpperCase() : undefined,
      cpf: cpf.trim() || undefined,
      rg: rg.trim() ? rg.trim().toUpperCase() : undefined,
      birthDate: birthDate || undefined,
      pis: pis.trim() ? pis.trim().toUpperCase() : undefined,
      photoUrl: photoUrl || undefined,
      phone: phone.trim() || 'Não informado',
      baseSalary: parsedSalary,
      salary: parsedSalary,
      contractType: contractType.trim() || 'Registrado (CLT)',
      admissionDate: admissionDate || undefined,
      terminationDate: terminationDate || undefined,
      active: isActive,
      status: isActive ? 'ativo' : 'inativo',
      receivesCommission: finalReceivesCommission,
      commissionPerHour: finalReceivesCommission ? parsedPerHour : 0,
      commissionPerAlqueire: finalReceivesCommission ? parsedPerAlq : 0,
      commissionPerHectare: finalReceivesCommission ? parsedPerHa : 0,
      cnhNumber: cnhNumber.trim() ? cnhNumber.trim().toUpperCase() : undefined,
      cnhCategory: cnhNumber.trim() ? cnhCategory : undefined,
      cnhExpiration: cnhExpiration || undefined,
      cnhUpgradeDT,
      cnhUpgradeCategory: cnhUpgradeDT ? cnhUpgradeCategory : undefined,
      paymentLocation: paymentLocation.trim() ? normalizeStandardOption(paymentLocation.trim(), DEFAULT_PAYMENT_LOCATIONS) : undefined,
      bankPixKey: bankPixKey.trim() ? normalizeStandardOption(bankPixKey.trim(), DEFAULT_DEPOSIT_BANKS) : undefined,
      bankAgency: bankAgency.trim() ? bankAgency.trim().toUpperCase() : undefined,
      bankAccount: bankAccount.trim() ? bankAccount.trim() : undefined,
      admissionExamDoc: admissionExamDoc || undefined,
      experienceContractDoc: experienceContractDoc || undefined,
      generalDocs: generalDocs || undefined,
      signedRegistrationDoc: signedRegistrationDoc || undefined,
    };

    handleOpenEmployeePrint(snapshot);
  };

  // Profile Photo Upload & Crop Handler
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('A foto deve ter no máximo 10MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setCropImageSrc(result);
      setIsCropModalOpen(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleConfirmCrop = async (result: { file: File; previewUrl: string; publicUrl?: string }) => {
    if (result.publicUrl) {
      setPhotoUrl(result.publicUrl);
    } else {
      try {
        const fileExt = result.file.name.split('.').pop() || 'jpg';
        const fileName = `emp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
        const { data, error } = await supabase.storage
          .from('avatars')
          .upload(fileName, result.file, { contentType: result.file.type || 'image/jpeg', upsert: true });
        if (!error && data?.path) {
          const { data: pubData } = supabase.storage.from('avatars').getPublicUrl(data.path);
          if (pubData?.publicUrl) {
            setPhotoUrl(pubData.publicUrl);
            return;
          }
        }
      } catch (err) {
        console.warn('Aviso no fallback do avatar:', err);
      }
      setPhotoUrl(result.previewUrl);
    }
  };

  // Document Upload Handler - Gerenciamento de múltiplos estados de arquivos separados e independentes
  const handleFileUpload = (
    field: 'admissionExamDoc' | 'experienceContractDoc' | 'generalDocs' | 'signedRegistrationDoc',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert('O arquivo deve ter no máximo 15MB.');
      e.target.value = '';
      return;
    }

    // 1. Atualiza o estado independente do arquivo File bruto selecionado para upload em lote
    if (field === 'admissionExamDoc') {
      setAsoFile(file);
    } else if (field === 'experienceContractDoc') {
      setContratoFile(file);
    } else if (field === 'generalDocs') {
      setCnhFile(file);
    } else if (field === 'signedRegistrationDoc') {
      setFichaFile(file);
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const attachment: EmployeeAttachment = {
        name: file.name,
        fileData: event.target?.result as string,
        uploadedAt: new Date().toISOString(),
        size: file.size,
      };

      if (field === 'admissionExamDoc') setAdmissionExamDoc(attachment);
      else if (field === 'experienceContractDoc') setExperienceContractDoc(attachment);
      else if (field === 'generalDocs') setGeneralDocs(attachment);
      else if (field === 'signedRegistrationDoc') setSignedRegistrationDoc(attachment);
    };
    reader.readAsDataURL(file);
    // Limpa valor do elemento input para permitir upload consecutivo do mesmo arquivo se necessário
    e.target.value = '';
  };

  const handleRemoveFile = (field: 'admissionExamDoc' | 'experienceContractDoc' | 'generalDocs' | 'signedRegistrationDoc') => {
    if (field === 'admissionExamDoc') {
      setAsoFile(null);
      setAdmissionExamDoc(null);
    } else if (field === 'experienceContractDoc') {
      setContratoFile(null);
      setExperienceContractDoc(null);
    } else if (field === 'generalDocs') {
      setCnhFile(null);
      setGeneralDocs(null);
    } else if (field === 'signedRegistrationDoc') {
      setFichaFile(null);
      setSignedRegistrationDoc(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!id) return;
    const emp = localEmployees.find(e => e.id === id);
    const isConfirmed = await confirm({
      title: 'Excluir Funcionário / Colaborador',
      message: emp?.name 
        ? `Deseja realmente remover o colaborador "${emp.name}" do sistema?`
        : 'Deseja realmente remover este colaborador do sistema?',
      confirmLabel: 'Sim, Excluir',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });
    if (isConfirmed) {
      // 1. Atualização imediata do estado local e armazenamento
      const updatedList = localEmployees.filter(e => e.id !== id);
      setLocalEmployees(updatedList);
      saveStoredEmployees(updatedList);

      // 2. Chama explicitamente a exclusão no Supabase (.delete().eq('id', id)) SEM disparar operação de insert/upsert
      if (onDeleteEmployee) {
        try {
          await onDeleteEmployee(id);
        } catch (err) {
          console.error('[RH Excluir Funcionário Error]', err);
        }
      } else {
        deleteRhFuncionario(id).catch(err => {
          console.error('[RH deleteRhFuncionario Fallback Error]', err);
        });
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!name.trim()) return;
    if (!role1.trim()) {
      alert('Por favor, selecione a Função 1 (obrigatória).');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. CARIMBO DE DONO OBRIGATÓRIO (FIM DO VAZAMENTO):
      // Capture o ID do usuário logado antes de disparar o comando para o Supabase
      let activeUid: string | undefined = undefined;
      try {
        const { data: authData } = await supabase.auth.getUser();
        activeUid = authData?.user?.id;
        if (!activeUid) {
          const { data: sessData } = await supabase.auth.getSession();
          activeUid = sessData?.session?.user?.id;
        }
      } catch (_) {}

      if (!activeUid && currentUser?.id) {
        activeUid = currentUser.id;
      }

      if (!activeUid) {
        alert('Sessão expirada ou usuário não autenticado. Por favor, faça login novamente.');
        return;
      }

      // Garante ID único estável e canônico
      const finalId = editingEmployee?.id || ((typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `emp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);
      const targetValidUuid = toValidUUID(finalId);

      // 1. UPLOAD RESILIENTE DA FOTO (bucket 'avatars'):
      // Captura o link de retorno textual do Storage e descarta qualquer payload binário pesado.
      // Se falhar por qualquer motivo de RLS ou rede, exibe aviso e NÃO interrompe a gravação das informações cadastrais e bancárias.
      let finalFotoUrl: string | null = null;
      if (photoUrl && typeof photoUrl === 'string' && photoUrl.trim()) {
        const rawPhoto = photoUrl.trim();
        if (rawPhoto.startsWith('http://') || rawPhoto.startsWith('https://')) {
          finalFotoUrl = rawPhoto;
        } else if (rawPhoto.startsWith('data:') || rawPhoto.startsWith('blob:')) {
          try {
            const uploadedUrl = await uploadEmployeePhotoToStorage(rawPhoto, finalId, activeCompany?.id || activeUid);
            if (uploadedUrl && (uploadedUrl.startsWith('http://') || uploadedUrl.startsWith('https://'))) {
              finalFotoUrl = uploadedUrl;
              setPhotoUrl(uploadedUrl);
            } else {
              console.warn('[RH Foto] Aviso: O upload da foto para o bucket "avatars" não retornou uma URL válida. O salvamento prosseguirá sem a foto.');
            }
          } catch (photoErr: any) {
            console.warn('[RH Foto] Aviso no upload da foto (Storage/RLS). Prosseguindo com o salvamento das informações cadastrais e bancárias:', photoErr?.message || photoErr);
          }
        }
      }

      // Preserva foto existente se for uma URL válida prévia e nenhum novo upload tiver sido concluído
      if (!finalFotoUrl && editingEmployee?.foto_url && (editingEmployee.foto_url.startsWith('http://') || editingEmployee.foto_url.startsWith('https://'))) {
        finalFotoUrl = editingEmployee.foto_url;
      } else if (!finalFotoUrl && editingEmployee?.photoUrl && (editingEmployee.photoUrl.startsWith('http://') || editingEmployee.photoUrl.startsWith('https://'))) {
        finalFotoUrl = editingEmployee.photoUrl;
      }

      // 2. ROTINA DE UPLOAD SEQUENCIAL/EM LOTE PARA O BUCKET 'documentos':
      // Envia ao bucket 'documentos' todos os arquivos novos selecionados pelo usuário,
      // capturando a URL pública com o método .getPublicUrl().data.publicUrl
      const uploadDocToStorage = async (
        file: File | null,
        docState: EmployeeAttachment | null,
        docType: 'aso' | 'contrato_experiencia' | 'cnh' | 'ficha_registro',
        existingDbUrl?: string | null
      ): Promise<string | null> => {
        // Se usuário removeu o anexo da interface
        if (!file && !docState) {
          return null;
        }

        // Caso 1: Novo arquivo File selecionado pelo usuário no formulário
        if (file && isSupabaseConfigured) {
          try {
            const validUuid = toValidUUID(finalId) || finalId;
            const cleanCompanyId = activeCompany?.id ? (toValidUUID(activeCompany.id) || activeCompany.id) : (activeUid || 'geral');
            const fileExt = file.name.includes('.') ? '.' + file.name.split('.').pop()?.toLowerCase() : '.pdf';
            const safeDocName = file.name
              .replace(/[^a-zA-Z0-9._-]/g, '_')
              .replace(/\.[^/.]+$/, '');
            const fileName = `${validUuid}_${docType}_${Date.now()}_${safeDocName}${fileExt}`;
            const filePath = `${cleanCompanyId}/${fileName}`;

            const { data, error } = await supabase.storage
              .from('documentos')
              .upload(filePath, file, {
                contentType: file.type || 'application/pdf',
                cacheControl: '3600',
                upsert: true,
              });

            if (!error && data?.path) {
              const { data: publicData } = supabase.storage
                .from('documentos')
                .getPublicUrl(data.path);
              const returnedUrl = publicData?.publicUrl?.trim();
              if (returnedUrl && (returnedUrl.startsWith('http://') || returnedUrl.startsWith('https://'))) {
                console.info(`✅ [Supabase Storage] Documento (${docType}) enviado com sucesso no bucket 'documentos':`, returnedUrl);
                return returnedUrl;
              }
            } else if (error) {
              console.warn(`[Supabase Storage] Erro ao enviar anexo (${docType}) para 'documentos':`, error.message);
            }
          } catch (uploadErr) {
            console.warn(`[Supabase Storage] Exceção ao gravar anexo em 'documentos' (${docType}):`, uploadErr);
          }
        }

        // Caso 2: base64 (data: ou blob:) que necessite upload
        if (docState?.fileData && (docState.fileData.startsWith('data:') || docState.fileData.startsWith('blob:'))) {
          try {
            const uploaded = await uploadEmployeeDocumentToStorage(
              docState.fileData,
              finalId,
              docType,
              activeCompany?.id || activeUid,
              docState.name
            );
            if (uploaded && (uploaded.startsWith('http://') || uploaded.startsWith('https://'))) {
              return uploaded;
            }
          } catch (err: any) {
            console.warn(`[Supabase Storage] Falha ao enviar base64 (${docType}):`, err?.message || err);
          }
        }

        // Caso 3: Preserva link HTTP público prévio do docState
        if (docState?.fileData && (docState.fileData.startsWith('http://') || docState.fileData.startsWith('https://'))) {
          return docState.fileData.trim();
        }

        // Caso 4: Preserva link HTTP anterior salvo no banco
        if (existingDbUrl && (existingDbUrl.startsWith('http://') || existingDbUrl.startsWith('https://'))) {
          return existingDbUrl.trim();
        }

        return null;
      };

      // Executa o envio sequencial / em lote de todos os 4 anexos de retorno
      const [finalAsoUrl, finalContratoUrl, finalCnhUrl, finalFichaUrl] = await Promise.all([
        uploadDocToStorage(asoFile, admissionExamDoc, 'aso', editingEmployee?.aso_url),
        uploadDocToStorage(contratoFile, experienceContractDoc, 'contrato_experiencia', editingEmployee?.contrato_experiencia_url),
        uploadDocToStorage(cnhFile, generalDocs, 'cnh', editingEmployee?.cnh_url),
        uploadDocToStorage(fichaFile, signedRegistrationDoc, 'ficha_registro', editingEmployee?.ficha_registro_url),
      ]);

      // 3. SALVAR OS CAMPOS DE TEXTO DA SEÇÃO DE PAGAMENTO:
      // Mapear e incluir no payload de salvamento as 4 caixas de texto da seção 3:
      // 'local_recebimento', 'banco_chave_pix', 'agencia' e 'conta_corrente'.
      const cleanLocalRecebimento = paymentLocation && paymentLocation.trim()
        ? normalizeStandardOption(paymentLocation.trim(), DEFAULT_PAYMENT_LOCATIONS)
        : null;
      const cleanBancoChavePix = bankPixKey && bankPixKey.trim()
        ? normalizeStandardOption(bankPixKey.trim(), DEFAULT_DEPOSIT_BANKS)
        : null;
      const cleanAgencia = bankAgency && bankAgency.trim() ? bankAgency.trim().toUpperCase() : null;
      const cleanContaCorrente = bankAccount && bankAccount.trim() ? bankAccount.trim() : null;

      const activeRoles: string[] = [];
      if (role1.trim()) activeRoles.push(role1.trim());
      if (role2.trim() && role2.trim().toLowerCase() !== role1.trim().toLowerCase()) activeRoles.push(role2.trim());
      const finalRoles = activeRoles.length > 0 ? activeRoles : ['Operador de Forrageira'];
      const finalRole = finalRoles.join(', ');
      
      const rawRegType = registrationType.trim();
      const finalRegType = (rawRegType === 'mecanico_especialista' ? 'Mecanico Especialista' : rawRegType) || 'Funcionário';

      // Conversão de valores monetários e comissões com Number() e parseFloat()
      const parsedSalary = Number(parseCurrencyInput(baseSalary)) || 0;
      const parsedPerHour = Number(parseCurrencyInput(commissionPerHour)) || 0;
      const parsedPerAlq = Number(parseCurrencyInput(commissionPerAlqueire)) || 0;
      const parsedPerHa = Number(parseCurrencyInput(commissionPerHectare)) || 0;
      const parsedBrokerCommission = isBroker ? (Number(parseCurrencyInput(brokerCommissionValue)) || 0) : 0;
      const hasAnyCommission = parsedPerHour > 0 || parsedPerAlq > 0 || parsedPerHa > 0;
      const finalReceivesCommission = !isBroker && (receivesCommission || hasAnyCommission);

      const numPerHour = finalReceivesCommission ? (Number(parseFloat(String(parsedPerHour))) || 0) : 0;
      const numPerAlq = finalReceivesCommission ? (Number(parseFloat(String(parsedPerAlq))) || 0) : 0;
      const numPerHa = finalReceivesCommission ? (Number(parseFloat(String(parsedPerHa))) || 0) : 0;

      // Formatação rigorosa de datas para YYYY-MM-DD
      const formattedAdmissionDate = admissionDate ? (formatIsoDateOnly(admissionDate) || admissionDate.trim()) : undefined;
      const formattedTerminationDate = terminationDate ? (formatIsoDateOnly(terminationDate) || terminationDate.trim()) : undefined;
      const formattedBirthDate = birthDate ? (formatIsoDateOnly(birthDate) || birthDate.trim()) : undefined;
      const formattedCnhExpiration = cnhExpiration ? (formatIsoDateOnly(cnhExpiration) || cnhExpiration.trim()) : undefined;

      // 1. CARIMBO DE DONO OBRIGATÓRIO (user_id: activeUid)
      const employeeData: Employee = {
        id: finalId,
        user_id: activeUid,
        userId: activeUid,
        companyId: activeCompany?.id || activeUid,
        name: name.trim().toUpperCase(),
        registrationType: finalRegType,
        role: finalRole,
        roles: finalRoles,
        brokerCommissionType: isBroker ? brokerCommissionType : undefined,
        brokerCommissionValue: isBroker ? (Number(parseFloat(String(parsedBrokerCommission))) || 0) : 0,
        actingRegion: isBroker && actingRegion.trim() ? actingRegion.trim().toUpperCase() : undefined,
        cpf: cpf.trim() || undefined,
        rg: rg.trim() ? rg.trim().toUpperCase() : undefined,
        birthDate: formattedBirthDate,
        pis: pis.trim() ? pis.trim().toUpperCase() : undefined,
        photoUrl: finalFotoUrl || undefined,
        foto_url: finalFotoUrl || undefined,
        avatar_url: finalFotoUrl || undefined,
        // Colunas físicas dos anexos da Seção 4 (bucket documentos):
        aso_url: finalAsoUrl || undefined,
        contrato_experiencia_url: finalContratoUrl || undefined,
        cnh_url: finalCnhUrl || undefined,
        ficha_registro_url: finalFichaUrl || undefined,
        phone: phone.trim(),
        baseSalary: parsedSalary,
        salary: parsedSalary,
        contractType: contractType.trim() || 'Registrado (CLT)',
        admissionDate: formattedAdmissionDate,
        terminationDate: formattedTerminationDate,
        active: isActive,
        status: isActive ? (editingEmployee?.status === 'ferias' ? 'ferias' : editingEmployee?.status === 'afastado' ? 'afastado' : 'ativo') : 'inativo',
        receivesCommission: finalReceivesCommission,
        commissionPerHour: numPerHour,
        commissionPerAlqueire: numPerAlq,
        commissionPerHectare: numPerHa,
        comissao_hora: numPerHour,
        comissao_alqueire: numPerAlq,
        comissao_hectare: numPerHa,
        recebe_comissao: finalReceivesCommission,
        cnhNumber: cnhNumber.trim() ? cnhNumber.trim().toUpperCase() : undefined,
        cnhCategory: cnhNumber.trim() ? cnhCategory : undefined,
        cnhExpiration: formattedCnhExpiration,
        cnhUpgradeDT,
        cnhUpgradeCategory: cnhUpgradeDT ? cnhUpgradeCategory : undefined,
        
        // 2. Seção 3 - Rosa
        local_recebimento: cleanLocalRecebimento || undefined,
        paymentLocation: cleanLocalRecebimento || undefined,
        banco_chave_pix: cleanBancoChavePix || undefined,
        bankPixKey: cleanBancoChavePix || undefined,
        agencia: cleanAgencia || undefined,
        bankAgency: cleanAgencia || undefined,
        conta_corrente: cleanContaCorrente || undefined,
        bankAccount: cleanContaCorrente || undefined,

        // 3. Documentos e anexos da Seção 4 (preservação e preview)
        admissionExamDoc: finalAsoUrl ? {
          name: asoFile?.name || admissionExamDoc?.name || 'Exame Admissional (ASO)',
          fileData: finalAsoUrl,
          uploadedAt: new Date().toISOString(),
          size: asoFile?.size || admissionExamDoc?.size,
        } : (admissionExamDoc && typeof admissionExamDoc.fileData === 'string' && admissionExamDoc.fileData.startsWith('http') ? admissionExamDoc : undefined),

        experienceContractDoc: finalContratoUrl ? {
          name: contratoFile?.name || experienceContractDoc?.name || 'Contrato de Experiência',
          fileData: finalContratoUrl,
          uploadedAt: new Date().toISOString(),
          size: contratoFile?.size || experienceContractDoc?.size,
        } : (experienceContractDoc && typeof experienceContractDoc.fileData === 'string' && experienceContractDoc.fileData.startsWith('http') ? experienceContractDoc : undefined),

        generalDocs: finalCnhUrl ? {
          name: cnhFile?.name || generalDocs?.name || 'Documentos Gerais (RE + CNH)',
          fileData: finalCnhUrl,
          uploadedAt: new Date().toISOString(),
          size: cnhFile?.size || generalDocs?.size,
        } : (generalDocs && typeof generalDocs.fileData === 'string' && generalDocs.fileData.startsWith('http') ? generalDocs : undefined),

        signedRegistrationDoc: finalFichaUrl ? {
          name: fichaFile?.name || signedRegistrationDoc?.name || 'Ficha Cadastral Assinada',
          fileData: finalFichaUrl,
          uploadedAt: new Date().toISOString(),
          size: fichaFile?.size || signedRegistrationDoc?.size,
        } : (signedRegistrationDoc && typeof signedRegistrationDoc.fileData === 'string' && signedRegistrationDoc.fileData.startsWith('http') ? signedRegistrationDoc : undefined),
      };

      // Dispara persistência com carimbo obrigatório do assinante no Supabase
      if (isSupabaseConfigured && activeUid) {
        try {
          const activeCompanyId = activeCompany?.id || activeUid;
          const safeCompanyUuid = activeCompanyId && toValidUUID(activeCompanyId) === activeCompanyId ? activeCompanyId : null;

          // Payload alinhado estritamente com as colunas físicas da tabela public.rh_funcionarios:
          // 'local_recebimento', 'banco_chave_pix', 'agencia', 'conta_corrente', 'foto_url',
          // 'aso_url', 'contrato_experiencia_url', 'cnh_url' e 'ficha_registro_url'
          const directRow: Record<string, any> = {
            id: targetValidUuid,
            user_id: activeUid,
            name: employeeData.name,
            role: employeeData.role,
            cpf: employeeData.cpf || null,
            phone: employeeData.phone || null,
            status: employeeData.status || 'ativo',
            registration_type: employeeData.registrationType || 'Funcionário',
            salary: employeeData.salary || 0,
            admission_date: employeeData.admissionDate || null,
            driver_license: employeeData.cnhNumber || null,
            license_category: employeeData.cnhCategory || null,
            license_expiry: employeeData.cnhExpiration || null,
            // 4 Campos da Seção Rosa
            local_recebimento: cleanLocalRecebimento || null,
            banco_chave_pix: cleanBancoChavePix || null,
            agencia: cleanAgencia || null,
            conta_corrente: cleanContaCorrente || null,
            // Foto de Perfil (link de texto do bucket avatars)
            foto_url: finalFotoUrl || null,
            // 4 Anexos da Seção 4 (bucket documentos)
            aso_url: finalAsoUrl || null,
            contrato_experiencia_url: finalContratoUrl || null,
            cnh_url: finalCnhUrl || null,
            ficha_registro_url: finalFichaUrl || null,
            updated_at: new Date().toISOString(),
          };

          if (safeCompanyUuid) {
            directRow.company_id = safeCompanyUuid;
          }

          // 1. Tenta atualizar com PATCH com isolamento estrito por id e user_id
          const { id: _ignoredId, ...patchBody } = directRow;
          const updateRes = await supabase
            .from('rh_funcionarios')
            .update(patchBody)
            .eq('id', targetValidUuid)
            .eq('user_id', activeUid)
            .select('id');

          if (!updateRes.error && Array.isArray(updateRes.data) && updateRes.data.length > 0) {
            console.info('✅ [RH Salvar] Registro atualizado (PATCH) em public.rh_funcionarios com user_id:', activeUid);
          } else {
            // 2. Se o registro ainda não existia ou update retornou 0 linhas, executa UPSERT com user_id
            const { error: upsertErr } = await supabase
              .from('rh_funcionarios')
              .upsert(directRow, { onConflict: 'id' });

            if (upsertErr) {
              console.warn('[RH Salvar] Upsert direto falhou, acionando fallback com upsertRhFuncionario:', upsertErr.message);
              await upsertRhFuncionario(employeeData, activeCompany?.id, activeUid);
            } else {
              console.info('✅ [RH Salvar] Registro gravado com sucesso em public.rh_funcionarios (UPSERT) com user_id:', activeUid);
            }
          }
        } catch (dbErr) {
          console.warn('[RH Salvar] Exceção ao gravar no Supabase:', dbErr);
          await upsertRhFuncionario(employeeData, activeCompany?.id, activeUid);
        }
      }

      let updatedList: Employee[] = [];
      if (editingEmployee) {
        updatedList = localEmployees.map(emp =>
          emp.id === editingEmployee.id ? employeeData : emp
        );
      } else {
        updatedList = [...localEmployees, employeeData];
      }

      // Atualização imediata no estado local da tabela e no storage
      setLocalEmployees(updatedList);
      saveStoredEmployees(updatedList);

      // Notifica o manipulador superior para persistência no Supabase
      if (onSaveEmployees) {
        try {
          await onSaveEmployees(updatedList);
        } catch (err: any) {
          console.error('[RH onSaveEmployees Error]', err);
        }
      }

      setAsoFile(null);
      setContratoFile(null);
      setCnhFile(null);
      setFichaFile(null);
      setEditingEmployee(null);
      setIsModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseModal = () => {
    setAsoFile(null);
    setContratoFile(null);
    setCnhFile(null);
    setFichaFile(null);
    setAdmissionExamDoc(null);
    setExperienceContractDoc(null);
    setGeneralDocs(null);
    setSignedRegistrationDoc(null);
    setEditingEmployee(null);
    setIsModalOpen(false);
  };

  const getCnhBadge = (emp: Employee) => {
    if (!emp.cnhExpiration) {
      return (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 font-medium">
          Sem CNH
        </span>
      );
    }

    const today = new Date();
    const in60Days = new Date();
    in60Days.setDate(today.getDate() + 60);
    const exp = new Date(emp.cnhExpiration);

    if (exp < today) {
      return (
        <span className="inline-flex items-center space-x-1 text-[10px] px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-bold border border-rose-200 dark:border-rose-800">
          <AlertCircle className="w-3 h-3" />
          <span>CNH Vencida ({formatDateBR(emp.cnhExpiration)})</span>
        </span>
      );
    }

    if (exp <= in60Days) {
      return (
        <span className="inline-flex items-center space-x-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-800">
          <AlertTriangle className="w-3 h-3" />
          <span>Vence em breve ({formatDateBR(emp.cnhExpiration)})</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center space-x-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-medium">
        <CheckCircle2 className="w-3 h-3" />
        <span>CNH Regular ({formatDateBR(emp.cnhExpiration)})</span>
      </span>
    );
  };

  // Formats print HTML for employees list
  const employeesPrintHtml = useMemo(() => {
    const listToPrint = filteredEmployees.length > 0 ? filteredEmployees : employees;
    const totalBaseSalary = listToPrint.reduce((acc, emp) => {
      const sal = emp.baseSalary ?? emp.salary ?? 0;
      return acc + (typeof sal === 'number' ? sal : 0);
    }, 0);

    const activeCount = listToPrint.filter(e => e.active !== false && e.status !== 'inativo').length;
    const now = new Date();
    const in60Days = new Date();
    in60Days.setDate(in60Days.getDate() + 60);

    return `
      <!-- Metrics Overview Cards -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px;">
          <div style="font-size: 7.5pt; font-weight: 700; color: #64748b; text-transform: uppercase;">Total Listado</div>
          <div style="font-size: 13pt; font-weight: 900; color: #0f172a; margin-top: 2px;">${listToPrint.length} colaboradores</div>
        </div>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 8px 12px;">
          <div style="font-size: 7.5pt; font-weight: 700; color: #166534; text-transform: uppercase;">Colaboradores Ativos</div>
          <div style="font-size: 13pt; font-weight: 900; color: #15803d; margin-top: 2px;">${activeCount} ativos</div>
        </div>
        <div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 6px; padding: 8px 12px;">
          <div style="font-size: 7.5pt; font-weight: 700; color: #9f1239; text-transform: uppercase;">CNHs Vencidas</div>
          <div style="font-size: 13pt; font-weight: 900; color: #e11d48; margin-top: 2px;">${cnhReport.expiredCount}</div>
        </div>
        <div style="background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 6px; padding: 8px 12px;">
          <div style="font-size: 7.5pt; font-weight: 700; color: #115e59; text-transform: uppercase;">Total Salário Base</div>
          <div style="font-size: 12pt; font-weight: 900; color: #0f766e; margin-top: 2px;">${formatCurrencyBRL(totalBaseSalary)}</div>
        </div>
      </div>

      <!-- Employees Table -->
      <table style="width: 100%; border-collapse: collapse; font-size: 8pt; margin-top: 6px;">
        <thead>
          <tr style="background: #009688; color: #ffffff; text-align: left; font-size: 7.5pt; text-transform: uppercase;">
            <th style="padding: 7px 8px; border: 1px solid #00897b; width: 4%;">#</th>
            <th style="padding: 7px 8px; border: 1px solid #00897b; width: 26%;">Colaborador / Contato</th>
            <th style="padding: 7px 8px; border: 1px solid #00897b; width: 22%;">Cargo & Vínculo</th>
            <th style="padding: 7px 8px; border: 1px solid #00897b; width: 14%; text-align: right;">Salário Base</th>
            <th style="padding: 7px 8px; border: 1px solid #00897b; width: 16%;">Comissões</th>
            <th style="padding: 7px 8px; border: 1px solid #00897b; width: 18%;">CNH / Validade</th>
          </tr>
        </thead>
        <tbody>
          ${listToPrint.map((emp, index) => {
            const isInactive = emp.active === false || emp.status === 'inativo';
            const sal = emp.baseSalary ?? emp.salary ?? 0;
            const rowBg = index % 2 === 0 ? '#ffffff' : '#f8fafc';

            // CNH status label
            let cnhText = '<span style="color: #94a3b8;">Sem CNH</span>';
            if (emp.cnhExpiration) {
              const expDate = new Date(emp.cnhExpiration);
              if (expDate < now) {
                cnhText = `<strong style="color: #e11d48;">VENCIDA (${formatDateBR(emp.cnhExpiration)})</strong><br/><span style="font-size: 7pt; color: #64748b;">Cat. ${emp.cnhCategory || '-'} | Nº ${emp.cnhNumber || '-'}</span>`;
              } else if (expDate <= in60Days) {
                cnhText = `<strong style="color: #d97706;">Vence em breve (${formatDateBR(emp.cnhExpiration)})</strong><br/><span style="font-size: 7pt; color: #64748b;">Cat. ${emp.cnhCategory || '-'} | Nº ${emp.cnhNumber || '-'}</span>`;
              } else {
                cnhText = `<strong style="color: #16a34a;">Regular (${formatDateBR(emp.cnhExpiration)})</strong><br/><span style="font-size: 7pt; color: #64748b;">Cat. ${emp.cnhCategory || '-'} | Nº ${emp.cnhNumber || '-'}</span>`;
              }
            }

            // Commission info
            const comParts: string[] = [];
            if (emp.receivesCommission) {
              if (emp.commissionPerHour && emp.commissionPerHour > 0) comParts.push(`R$ ${emp.commissionPerHour.toFixed(2)}/h`);
              if (emp.commissionPerAlqueire && emp.commissionPerAlqueire > 0) comParts.push(`R$ ${emp.commissionPerAlqueire.toFixed(2)}/alq`);
              if (emp.commissionPerHectare && emp.commissionPerHectare > 0) comParts.push(`R$ ${emp.commissionPerHectare.toFixed(2)}/ha`);
            }
            const comText = comParts.length > 0 
              ? `<span style="color: #b45309; font-weight: 700;">${comParts.join(' | ')}</span>`
              : '<span style="color: #94a3b8;">Sem comissão</span>';

            return `
              <tr style="background: ${rowBg}; border-bottom: 1px solid #e2e8f0; page-break-inside: avoid;">
                <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: bold; color: #64748b; text-align: center;">
                  ${index + 1}
                </td>
                <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">
                  <strong style="color: #0f172a; font-size: 8.5pt;">${emp.name}</strong>
                  ${isInactive ? ' <span style="display: inline-block; font-size: 6.5pt; font-weight: 800; background: #e2e8f0; color: #475569; padding: 1px 4px; border-radius: 3px;">INATIVO</span>' : ' <span style="display: inline-block; font-size: 6.5pt; font-weight: 800; background: #dcfce7; color: #15803d; padding: 1px 4px; border-radius: 3px;">ATIVO</span>'}
                  <div style="font-size: 7.5pt; color: #64748b; margin-top: 2px;">
                    ${emp.cpf ? `CPF: ${emp.cpf}` : ''} ${emp.phone ? `| Tel: ${emp.phone}` : ''}
                  </div>
                </td>
                <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">
                  <strong style="color: #1e293b;">${emp.role || '-'}</strong>
                  <div style="font-size: 7.5pt; color: #64748b; margin-top: 2px;">
                    ${emp.contractType || emp.registrationType || 'CLT'} ${emp.admissionDate ? `| Adm: ${formatDateBR(emp.admissionDate)}` : ''}
                  </div>
                </td>
                <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: right; font-weight: 700; color: #0f172a;">
                  ${formatCurrencyBRL(sal)}
                </td>
                <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-size: 7.5pt;">
                  ${comText}
                </td>
                <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-size: 7.5pt;">
                  ${cnhText}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
        <tfoot>
          <tr style="background: #f1f5f9; font-weight: 800; border-top: 2px solid #cbd5e1; font-size: 8.5pt;">
            <td colspan="3" style="padding: 8px; border: 1px solid #cbd5e1; text-align: right; color: #334155; text-transform: uppercase;">
              Total Geral da Folha Base (${listToPrint.length} registros):
            </td>
            <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right; color: #009688;">
              ${formatCurrencyBRL(totalBaseSalary)}
            </td>
            <td colspan="2" style="padding: 8px; border: 1px solid #cbd5e1; color: #64748b; font-size: 7.5pt;">
              *Comissões variáveis calculadas conforme serviços executados
            </td>
          </tr>
        </tfoot>
      </table>
    `;
  }, [filteredEmployees, employees, cnhReport]);

  // Formats WhatsApp text message
  const employeesWhatsAppText = useMemo(() => {
    const listToPrint = filteredEmployees.length > 0 ? filteredEmployees : employees;
    const now = new Date();
    const dateStr = formatDateBR(now.toISOString().split('T')[0]);
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const activeCount = listToPrint.filter(e => e.active !== false && e.status !== 'inativo').length;

    let text = `🚜 *${activeCompany.tradeName?.toUpperCase() || 'SILAGEM FÁCIL'}*\n`;
    text += `📋 *RELAÇÃO DE FUNCIONÁRIOS, MOTORISTAS & OPERADORES*\n`;
    text += `📅 *Emissão:* ${dateStr} às ${timeStr}\n`;
    text += `👥 *Total:* ${listToPrint.length} colaboradores (${activeCount} ativos)\n`;
    text += `⚠️ *CNHs Vencidas:* ${cnhReport.expiredCount}\n\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;

    listToPrint.forEach((emp, i) => {
      text += `*${i + 1}. ${emp.name}*\n`;
      text += `   💼 Cargo: ${emp.role || '-'}\n`;
      if (emp.cpf) text += `   📄 CPF: ${emp.cpf}\n`;
      if (emp.phone) text += `   📞 Tel: ${emp.phone}\n`;
      if (emp.cnhExpiration) {
        text += `   🪪 CNH (Cat ${emp.cnhCategory || '-'}): Validade ${formatDateBR(emp.cnhExpiration)}\n`;
      }
      text += `\n`;
    });

    return text;
  }, [filteredEmployees, employees, activeCompany, cnhReport]);

  return (
    <div id="employees-module" className="space-y-3 sm:space-y-3.5 animate-fade-in">
      {/* CNH Alert, Vacation Alert & Staff Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-3.5 shadow-xs flex items-center justify-between text-black">
          <div>
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-rose-700">
              CNHs Vencidas
            </span>
            <div className="text-xl sm:text-2xl font-black text-rose-700 font-['Outfit'] mt-0.5">
              {cnhReport.expiredCount}
            </div>
            <p className="text-[10px] sm:text-[11px] text-black/75 font-medium mt-0.5">
              Exige regularização imediata
            </p>
          </div>
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center font-black">
            !
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-3.5 shadow-xs flex items-center justify-between text-black">
          <div>
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-amber-700">
              CNHs a Vencer (60 dias)
            </span>
            <div className="text-xl sm:text-2xl font-black text-amber-700 font-['Outfit'] mt-0.5">
              {cnhReport.expiringIn60DaysCount}
            </div>
            <p className="text-[10px] sm:text-[11px] text-black/75 font-medium mt-0.5">
              Agendar renovação com motorista
            </p>
          </div>
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center font-bold">
            <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        <div
          className={`bg-white border rounded-xl p-3 sm:p-3.5 shadow-xs flex items-center justify-between text-black ${
            vacationAlertsSummary.expiredCount > 0
              ? 'border-rose-300 bg-rose-50/30'
              : vacationAlertsSummary.warningCount > 0
                ? 'border-amber-300 bg-amber-50/30'
                : 'border-slate-200'
          }`}
        >
          <div>
            <span
              className={`text-[10px] sm:text-[11px] font-black uppercase tracking-wider ${
                vacationAlertsSummary.expiredCount > 0
                  ? 'text-rose-700'
                  : vacationAlertsSummary.warningCount > 0
                    ? 'text-amber-700'
                    : 'text-emerald-700'
              }`}
            >
              Alertas de Férias (RH)
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span
                className={`text-xl sm:text-2xl font-black font-['Outfit'] ${
                  vacationAlertsSummary.expiredCount > 0
                    ? 'text-rose-700'
                    : vacationAlertsSummary.warningCount > 0
                      ? 'text-amber-700'
                      : 'text-emerald-700'
                }`}
              >
                {vacationAlertsSummary.totalAlerts}
              </span>
              <span className="text-[10px] font-bold text-black/75">
                {vacationAlertsSummary.expiredCount > 0 && `${vacationAlertsSummary.expiredCount} vencida(s)`}
                {vacationAlertsSummary.expiredCount > 0 && vacationAlertsSummary.warningCount > 0 && ' • '}
                {vacationAlertsSummary.warningCount > 0 && `${vacationAlertsSummary.warningCount} próx. a vencer`}
                {vacationAlertsSummary.totalAlerts === 0 && 'Períodos regulares'}
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-black/75 font-medium mt-0.5">
              Monitoramento automático (11–12+ meses)
            </p>
          </div>
          <div
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl border flex items-center justify-center font-bold ${
              vacationAlertsSummary.expiredCount > 0
                ? 'bg-rose-100 border-rose-300 text-rose-700'
                : vacationAlertsSummary.warningCount > 0
                  ? 'bg-amber-100 border-amber-300 text-amber-800'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}
          >
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-3.5 shadow-xs flex items-center justify-between text-black">
          <div>
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-black">
              Total de Colaboradores
            </span>
            <div className="text-xl sm:text-2xl font-black text-black font-['Outfit'] mt-0.5">
              {totalColaboradoresCount}
            </div>
            <p className="text-[10px] sm:text-[11px] text-black/75 font-medium mt-0.5">
              {activeColaboradoresCount} ativos no momento
            </p>
          </div>
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-100 border border-slate-200 text-black flex items-center justify-center">
            <UserSquare2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>
      </div>

      {/* Search Bar & Quick Vacation Alert Filter Badges */}
      <div className="bg-white border border-slate-200 rounded-xl p-2.5 sm:p-3 shadow-xs space-y-2.5 text-black">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-black absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome, cargo, CPF ou número de CNH..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-white border border-slate-300 rounded-lg text-xs sm:text-sm text-black placeholder-slate-400 focus:ring-1 focus:ring-sky-600 outline-none"
          />
        </div>

        {/* Linha de Botões de Filtro Rápido (Filtros Estilizados como Badges) */}
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <button
            type="button"
            onClick={() => setVacationQuickFilter('all')}
            className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold border transition cursor-pointer ${
              vacationQuickFilter === 'all'
                ? 'bg-[#0963cb] text-white border-[#0963cb] shadow-2xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
            }`}
          >
            <UserSquare2 className="w-3.5 h-3.5 shrink-0" />
            <span>Todos os Colaboradores ({listaOrdenada.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setVacationQuickFilter('expired')}
            className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold border transition cursor-pointer ${
              vacationQuickFilter === 'expired'
                ? 'bg-rose-600 text-white border-rose-700 shadow-2xs'
                : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-300'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>Férias Vencidas ({vacationAlertsSummary.expiredCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setVacationQuickFilter('warning')}
            className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold border transition cursor-pointer ${
              vacationQuickFilter === 'warning'
                ? 'bg-amber-500 text-stone-950 border-amber-600 shadow-2xs'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>Férias a Vencer ({vacationAlertsSummary.warningCount})</span>
          </button>
        </div>
      </div>

      {/* Employees Table / Cards */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs text-black">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-black uppercase text-[10px] font-black tracking-wider">
              <tr>
                <th className="py-3 px-4">Nome & Contato</th>
                <th className="py-3 px-4">Cargo / Regime</th>
                <th className="py-3 px-4">Salário Base</th>
                <th className="py-3 px-4">Comissão</th>
                <th className="py-3 px-4">CNH / Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {displayedEmployees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 text-xs font-semibold">
                    {vacationQuickFilter === 'expired'
                      ? 'Nenhum colaborador com Férias Vencidas no momento.'
                      : vacationQuickFilter === 'warning'
                        ? 'Nenhum colaborador com Férias Próximas a Vencer no momento.'
                        : 'Nenhum colaborador encontrado.'}
                  </td>
                </tr>
              ) : displayedEmployees.map((emp) => {
                const vacAlert = vacationAlertsByEmployeeId[emp.id];
                return (
                  <tr key={emp.id} className="hover:bg-slate-50 transition">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center space-x-3">
                      <EmployeeAvatar
                        photoUrl={emp.photoUrl}
                        name={emp.name}
                        size="sm"
                        className="shrink-0 rounded-xl"
                      />
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <div className="font-bold text-black uppercase">
                            {emp.name}
                          </div>
                          {emp.active === false || emp.status === 'inativo' ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-black font-bold">
                              INATIVO
                            </span>
                          ) : (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold">
                              ATIVO
                            </span>
                          )}
                          {vacAlert && vacAlert.level === 'expired' && (
                            <span
                              title={vacAlert.description}
                              className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full bg-rose-600 text-white font-black tracking-wide shadow-2xs animate-pulse"
                            >
                              <AlertCircle className="w-3 h-3 shrink-0" />
                              <span>FÉRIAS VENCIDAS ({vacAlert.monthsLabel})</span>
                            </span>
                          )}
                          {vacAlert && vacAlert.level === 'warning' && (
                            <span
                              title={vacAlert.description}
                              className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full bg-amber-500 text-stone-950 font-black tracking-wide shadow-2xs"
                            >
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              <span>FÉRIAS PRÓXIMAS A VENCER ({vacAlert.monthsLabel})</span>
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-black/75 font-medium mt-0.5">
                          {emp.cpf && (
                            <span className="font-mono text-[11px]">CPF: {emp.cpf}</span>
                          )}
                          {emp.phone && (
                            <div className="flex items-center space-x-1 text-black/75">
                              <Phone className="w-3 h-3 text-black/60" />
                              <span>{emp.phone}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="flex items-start space-x-1.5 text-black font-bold">
                      <Briefcase className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                      <div className="flex flex-wrap gap-1 items-center">
                        {(emp.roles && emp.roles.length > 0
                          ? emp.roles
                          : (emp.role || 'Operador').split(',').map(r => r.trim()).filter(Boolean)
                        ).map((r, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-sky-50 text-sky-900 border border-sky-200/70"
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-[11px] text-black/75 font-medium mt-1">
                      {emp.contractType || 'Registrado (CLT)'}
                      {emp.admissionDate && ` • Adm: ${formatDateBR(emp.admissionDate)}`}
                    </div>
                    {vacAlert && vacAlert.level !== 'none' && (
                      <div
                        className={`mt-1 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${
                          vacAlert.level === 'expired'
                            ? 'bg-rose-50 text-rose-800 border-rose-300'
                            : 'bg-amber-50 text-amber-900 border-amber-300'
                        }`}
                      >
                        <Calendar className="w-3 h-3 shrink-0" />
                        <span>
                          Aq.: {formatDateBR(vacAlert.vestingStart)} a {formatDateBR(vacAlert.vestingEnd)}
                        </span>
                      </div>
                    )}
                    {emp.actingRegion && (
                      <div className="flex items-center space-x-1 text-[11px] text-orange-950 font-bold mt-1">
                        <MapPin className="w-3 h-3 text-orange-600 shrink-0" />
                        <span className="uppercase">{emp.actingRegion}</span>
                      </div>
                    )}
                  </td>

                  <td className="py-3.5 px-4 font-black text-black font-['Outfit']">
                    {formatCurrencyBRL(emp.baseSalary || emp.salary || 0)}
                  </td>

                  <td className="py-3.5 px-4">
                    {emp.brokerCommissionValue !== undefined && emp.brokerCommissionValue > 0 ? (
                      <div className="space-y-0.5 text-[11px]">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-sky-50 border border-sky-200 text-sky-800 font-bold text-[10px]">
                          Comissão Agenciador
                        </span>
                        <div className="text-black/80 font-bold font-['Outfit'] text-[10px]">
                          {emp.brokerCommissionType === 'Valor Fixo por contrato/pedido'
                            ? `${formatCurrencyBRL(emp.brokerCommissionValue)} /pedido`
                            : `${emp.brokerCommissionValue}% ${emp.brokerCommissionType?.includes('produção') ? 'produção' : 'pedido'}`}
                        </div>
                      </div>
                    ) : emp.receivesCommission ? (
                      <div className="space-y-0.5 text-[11px]">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 font-bold text-[10px]">
                          Comissão Ativa
                        </span>
                        <div className="text-black/80 font-bold font-['Outfit'] text-[10px]">
                          {emp.commissionPerHour ? `${formatCurrencyBRL(emp.commissionPerHour)}/h ` : ''}
                          {emp.commissionPerAlqueire ? `${formatCurrencyBRL(emp.commissionPerAlqueire)}/alq ` : ''}
                          {emp.commissionPerHectare ? `${formatCurrencyBRL(emp.commissionPerHectare)}/ha` : ''}
                        </div>
                      </div>
                    ) : (
                      <span className="text-black/60 text-xs font-medium">Sem comissão</span>
                    )}
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="space-y-1">
                      {emp.cnhNumber ? (
                        <div className="flex items-center space-x-1 text-xs">
                          <CreditCard className="w-3 h-3 text-slate-500" />
                          <span className="font-bold text-black">
                            Cat. {emp.cnhCategory || 'B'}
                          </span>
                        </div>
                      ) : null}
                      {getCnhBadge(emp)}
                    </div>
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end space-x-1.5">
                      <button
                        type="button"
                        onClick={() => handlePrintEmployeeSheet(emp)}
                        className="p-1.5 text-black hover:text-amber-700 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                        title="Imprimir cadastro do funcionário para assinatura"
                      >
                        <Printer className="w-4 h-4 text-amber-600" />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(emp)}
                        className="p-1.5 text-black hover:text-sky-700 hover:bg-sky-50 rounded-lg transition cursor-pointer"
                        title="Editar"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(emp.id)}
                        className="p-1.5 text-black hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ); })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Cadastro/Edição de Colaborador */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 no-print">
          <div className="bg-[#b0d2ed] border border-[#0963cb]/30 rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
            
            {/* Header - Solid Blue Bar */}
            <div className="px-5 py-3 bg-[#0963cb] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2">
                <UserSquare2 className="w-5 h-5 text-white" />
                <h3 className="text-base sm:text-lg font-bold tracking-tight text-white">
                  {editingEmployee ? 'Editar Cadastro de Funcionário' : 'Novo Cadastro de Funcionário'}
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="p-1 rounded-lg text-white hover:bg-white/20 transition cursor-pointer"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Banner Automático de Alerta de Férias no Topo do Modal de Edição */}
            {modalVacationAlert.level !== 'none' && (
              <div
                className={`px-5 py-3 border-b-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0 ${
                  modalVacationAlert.level === 'expired'
                    ? 'bg-rose-50 border-rose-400 text-rose-950'
                    : 'bg-amber-50 border-amber-400 text-amber-950'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div
                    className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                      modalVacationAlert.level === 'expired'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-amber-500 text-stone-950 shadow-xs'
                    }`}
                  >
                    {modalVacationAlert.level === 'expired' ? (
                      <AlertCircle className="w-5 h-5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5" />
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          modalVacationAlert.level === 'expired'
                            ? 'bg-rose-600 text-white'
                            : 'bg-amber-500 text-stone-950'
                        }`}
                      >
                        {modalVacationAlert.badgeText}
                      </span>
                      <span
                        className={`text-xs font-black uppercase ${
                          modalVacationAlert.level === 'expired' ? 'text-rose-900' : 'text-amber-900'
                        }`}
                      >
                        {modalVacationAlert.monthsLabel} sem gozo de férias
                      </span>
                    </div>
                    <p
                      className={`text-xs font-semibold leading-snug ${
                        modalVacationAlert.level === 'expired' ? 'text-rose-900' : 'text-amber-900'
                      }`}
                    >
                      {modalVacationAlert.description}
                    </p>
                  </div>
                </div>
                <div
                  className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border shrink-0 self-start sm:self-center ${
                    modalVacationAlert.level === 'expired'
                      ? 'bg-rose-100/90 border-rose-300 text-rose-900'
                      : 'bg-amber-100/90 border-amber-300 text-amber-950'
                  }`}
                >
                  <div>Período Aquisitivo:</div>
                  <div className="font-mono font-black">
                    {formatDateBR(modalVacationAlert.vestingStart)} a {formatDateBR(modalVacationAlert.vestingEnd)}
                  </div>
                </div>
              </div>
            )}

            {/* Quick Action Highlight Banner: Imprimir Cadastro */}
            <div className="bg-amber-50 border-b border-amber-200 px-5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
              <div className="flex items-center space-x-2">
                <Printer className="w-4 h-4 text-amber-700 shrink-0" />
                <p className="text-xs text-amber-900 font-medium">
                  Pronto para colher assinatura física? Imprima a ficha A4 com termo de responsabilidade e dados cadastrais.
                </p>
              </div>
              <button
                type="button"
                onClick={handlePrintCurrentModalEmployee}
                className="inline-flex items-center justify-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer whitespace-nowrap"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir cadastro do funcionário para assinatura</span>
              </button>
            </div>

            <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-6 overflow-y-auto flex-1 no-scrollbar bg-[#b0d2ed]">
              
              {/* SECTION 1: DADOS BÁSICOS & FOTO */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2 pb-1.5 border-b border-black/15">
                  <UserSquare2 className="w-4 h-4 text-black" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-black">
                    1. Dados Básicos do Funcionário
                  </h4>
                </div>

                {/* Profile Photo & Primary Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-start">
                  
                  {/* Photo Upload Thumbnail */}
                  <div className="sm:col-span-3 flex flex-col items-center justify-center p-3 border border-dashed border-stone-300 rounded-xl bg-white text-center">
                    {photoUrl && !isBrokenAvatarUrl(photoUrl) ? (
                      <div className="relative group">
                        <img 
                          src={photoUrl} 
                          alt="Foto Perfil" 
                          className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-2 border-[#0963cb] shadow-sm"
                          onError={() => setPhotoUrl('')}
                        />
                        <button
                          type="button"
                          onClick={() => setPhotoUrl('')}
                          className="absolute -top-1 -right-1 p-1 bg-rose-600 text-white rounded-full hover:bg-rose-700 shadow-sm cursor-pointer"
                          title="Remover foto"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-stone-100 flex items-center justify-center text-stone-400">
                        <Camera className="w-8 h-8" />
                      </div>
                    )}

                    <label className="mt-2.5 inline-flex items-center space-x-1 px-2.5 py-1 text-[11px] font-semibold text-[#0963cb] bg-[#0963cb]/10 hover:bg-[#0963cb]/20 rounded-lg cursor-pointer transition">
                      <Camera className="w-3 h-3" />
                      <span>{photoUrl ? 'Alterar foto' : 'Upload de Foto'}</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handlePhotoUpload}
                      />
                    </label>
                    <span className="text-[10px] text-stone-600 mt-1">JPG ou PNG até 5MB</span>
                  </div>

                  {/* Basic fields in grid */}
                  <div className="sm:col-span-9 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <ManageableDropdown
                        id="employee-registration-type-dropdown"
                        label="Tipo de Cadastro"
                        value={registrationType}
                        onChange={setRegistrationType}
                        options={regTypeOptions}
                        onOptionsChange={handleUpdateRegTypeOptions}
                        placeholder=""
                        newItemPlaceholder="Novo tipo..."
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-black mb-1">
                        Nome completo <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value.toUpperCase())}
                        className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[#0963cb] uppercase"
                      />
                    </div>

                    {/* CPF & RG */}
                    <div>
                      <label className="block text-xs font-bold text-black mb-1">
                        CPF
                      </label>
                      <input
                        type="text"
                        value={cpf}
                        onChange={(e) => setCpf(formatCpfCnpj(e.target.value))}
                        maxLength={14}
                        className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[#0963cb]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-black mb-1">
                        Número do RG
                      </label>
                      <input
                        type="text"
                        value={rg}
                        onChange={(e) => setRg(e.target.value.toUpperCase())}
                        className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[#0963cb] uppercase"
                      />
                    </div>

                    {/* Data de Nascimento & PIS */}
                    <div>
                      <label className="block text-xs font-bold text-black mb-1">
                        Data de Nascimento
                      </label>
                      <input
                        type="date"
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[#0963cb]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-black mb-1">
                        Número do PIS / PASEP
                      </label>
                      <input
                        type="text"
                        value={pis}
                        onChange={(e) => setPis(e.target.value.toUpperCase())}
                        className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[#0963cb] uppercase"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* CAMPO CONDICIONAL: REGIÃO DE ATUAÇÃO (ESPECÍFICO DO AGENCIADOR) */}
              {isBroker && (
                <div className="p-3 bg-gradient-to-r from-orange-50/90 via-amber-50/80 to-orange-50/90 border-2 border-orange-400 rounded-xl space-y-1.5 transition-all duration-200 shadow-2xs">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <label 
                      htmlFor="employee-acting-region"
                      className="flex items-center space-x-1.5 text-xs font-black text-orange-950 uppercase tracking-wide"
                    >
                      <MapPin className="w-4 h-4 text-orange-600 shrink-0" />
                      <span>Região de Atuação</span>
                      <span className="text-rose-600 font-bold">*</span>
                    </label>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 border border-orange-300">
                      <MapPin className="w-2.5 h-2.5 text-orange-600" />
                      Específico do Agenciador
                    </span>
                  </div>

                  <div className="relative">
                    <input
                      id="employee-acting-region"
                      type="text"
                      required={isBroker}
                      value={actingRegion}
                      onChange={(e) => setActingRegion(e.target.value.toUpperCase())}
                      placeholder="EX: SUDOESTE DO PARANÁ, NORTE PIONEIRO, VALE DO PARANAPANEMA..."
                      className="w-full px-3 py-1.5 bg-white border-2 border-orange-400 focus:border-orange-600 rounded-lg text-black text-xs sm:text-sm font-bold uppercase placeholder:normal-case placeholder:font-normal placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 transition shadow-2xs"
                    />
                  </div>
                </div>
              )}

              {/* SECTION 2: DADOS PROFISSIONAIS & CONTRATUAIS */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2 pb-1.5 border-b border-black/15">
                  <Briefcase className="w-4 h-4 text-black" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-black">
                    2. Dados Profissionais & Contrato
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Linha 1: Função 1 (Obrigatório) & Função 2 (Opcional) */}
                  <div>
                    <RoleSelectDropdown
                      id="employee-role-1"
                      label="Função 1"
                      required
                      value={role1}
                      onChange={setRole1}
                      options={sortedRoleOptions}
                      onOpenManager={() => {
                        setRoleManagerTarget('role1');
                        setIsRoleManagerOpen(true);
                      }}
                      placeholder="Selecione a função principal..."
                    />
                  </div>

                  <div>
                    <RoleSelectDropdown
                      id="employee-role-2"
                      label="Função 2 (Opcional)"
                      isOptional
                      value={role2}
                      onChange={setRole2}
                      options={sortedRoleOptions}
                      disabledOption={role1}
                      onOpenManager={() => {
                        setRoleManagerTarget('role2');
                        setIsRoleManagerOpen(true);
                      }}
                      placeholder="Selecione (se houver acúmulo)..."
                    />
                  </div>

                  {/* BLOCO CONDICIONAL: CONFIGURAÇÃO DE COMISSÃO DO AGENCIADOR */}
                  {isBroker && (
                    <div className="sm:col-span-2 p-3.5 bg-gradient-to-r from-sky-50/75 to-blue-50/60 border border-sky-200 rounded-xl space-y-2.5 transition-all duration-200 shadow-2xs">
                      <div className="flex items-center justify-between pb-1.5 border-b border-sky-200/80">
                        <div className="flex items-center space-x-2">
                          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#0963cb] text-white text-[11px] font-black">
                            %
                          </span>
                          <h5 className="text-xs font-black uppercase tracking-wider text-[#0963cb]">
                            Configuração de Comissão do Agenciador
                          </h5>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200">
                          Agenciador Ativo
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
                        {/* Tipo de Comissão */}
                        <div>
                          <label className="block text-xs font-bold text-black mb-1">
                            Tipo de Comissão <span className="text-rose-600">*</span>
                          </label>
                          <select
                            value={brokerCommissionType}
                            onChange={(e) => {
                              const newType = e.target.value;
                              setBrokerCommissionType(newType);
                              if (newType === 'Valor Fixo por contrato/pedido' && (!brokerCommissionValue || brokerCommissionValue === '5,00')) {
                                setBrokerCommissionValue('100,00');
                              } else if (newType !== 'Valor Fixo por contrato/pedido' && (!brokerCommissionValue || parseCurrencyInput(brokerCommissionValue) > 100)) {
                                setBrokerCommissionValue('5,00');
                              }
                            }}
                            className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[#0963cb] shadow-2xs"
                          >
                            <option value="Porcentagem (%) sobre o valor do pedido">
                              Porcentagem (%) sobre o valor do pedido
                            </option>
                            <option value="Porcentagem (%) sobre a produção">
                              Porcentagem (%) sobre a produção
                            </option>
                            <option value="Valor Fixo por contrato/pedido">
                              Valor Fixo por contrato/pedido
                            </option>
                          </select>
                        </div>

                        {/* Input Numérico Correspondente com Máscara */}
                        <div>
                          {brokerCommissionType === 'Valor Fixo por contrato/pedido' ? (
                            <div>
                              <label className="block text-xs font-bold text-black mb-1">
                                Valor Fixo da Comissão (R$) <span className="text-rose-600">*</span>
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs sm:text-sm font-bold text-stone-500">
                                  R$
                                </span>
                                <input
                                  type="text"
                                  value={brokerCommissionValue}
                                  onChange={(e) => setBrokerCommissionValue(e.target.value)}
                                  onBlur={() => {
                                    if (brokerCommissionValue) {
                                      const parsed = parseCurrencyInput(brokerCommissionValue);
                                      setBrokerCommissionValue(formatCurrencyInputDisplay(parsed));
                                    }
                                  }}
                                  placeholder="0,00"
                                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-stone-300 rounded-lg text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[#0963cb] shadow-2xs"
                                />
                              </div>
                            </div>
                          ) : (
                            <div>
                              <label className="block text-xs font-bold text-black mb-1">
                                {brokerCommissionType === 'Porcentagem (%) sobre a produção'
                                  ? 'Comissão sobre a Produção (%)'
                                  : 'Comissão sobre o Valor do Pedido (%)'}{' '}
                                <span className="text-rose-600">*</span>
                              </label>
                              <div className="relative">
                                <input
                                  type="text"
                                  value={brokerCommissionValue}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/[^0-9.,]/g, '');
                                    setBrokerCommissionValue(val);
                                  }}
                                  onBlur={() => {
                                    if (brokerCommissionValue) {
                                      const parsed = parseCurrencyInput(brokerCommissionValue);
                                      setBrokerCommissionValue(formatCurrencyInputDisplay(parsed));
                                    }
                                  }}
                                  placeholder="5,00"
                                  className="w-full pl-3 pr-8 py-1.5 bg-white border border-stone-300 rounded-lg text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[#0963cb] shadow-2xs"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs sm:text-sm font-bold text-stone-500">
                                  %
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <p className="text-[11px] text-sky-800 font-medium">
                        {brokerCommissionType === 'Porcentagem (%) sobre o valor do pedido' &&
                          '💡 A comissão será calculada automaticamente aplicando este percentual sobre o valor total faturado dos pedidos agenciados.'}
                        {brokerCommissionType === 'Porcentagem (%) sobre a produção' &&
                          '💡 A comissão será calculada aplicando este percentual sobre o volume/valor de produção nos pedidos agenciados.'}
                        {brokerCommissionType === 'Valor Fixo por contrato/pedido' &&
                          '💡 Será computado este valor monetário fixo para cada contrato ou pedido fechado pelo agenciador.'}
                      </p>
                    </div>
                  )}

                  {/* Linha 2: Telefone / WhatsApp & Salário Base */}
                  <div>
                    <label className="block text-xs font-bold text-black mb-1">
                      Telefone / WhatsApp
                    </label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(formatPhone(e.target.value))}
                      maxLength={15}
                      className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[#0963cb]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-black mb-1">
                      Salário Base (R$)
                    </label>
                    <input
                      type="text"
                      value={baseSalary}
                      onChange={(e) => setBaseSalary(e.target.value)}
                      onBlur={() => {
                        if (baseSalary) {
                          const parsed = parseCurrencyInput(baseSalary);
                          setBaseSalary(formatCurrencyInputDisplay(parsed));
                        }
                      }}
                      className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[#0963cb]"
                    />
                  </div>

                  {/* Linha 3: Regime de Contratação */}
                  <div className="sm:col-span-2">
                    <ManageableDropdown
                      label="Regime de Contratação"
                      value={contractType}
                      onChange={setContractType}
                      options={contractTypeOptions}
                      onOptionsChange={handleUpdateContractTypeOptions}
                      placeholder=""
                      newItemPlaceholder="Novo regime..."
                    />
                  </div>

                  {/* Linha 4: Data de Admissão & Data de Demissão */}
                  <div>
                    <label className="block text-xs font-bold text-black mb-1">
                      Data de Admissão <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={admissionDate}
                      onChange={(e) => setAdmissionDate(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[#0963cb]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-black mb-1">
                      Data de Demissão
                    </label>
                    <input
                      type="date"
                      value={terminationDate}
                      onChange={(e) => setTerminationDate(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[#0963cb]"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsActive(!isActive)}
                    className={`
                      relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none
                      ${isActive ? 'bg-[#0963cb]' : 'bg-stone-300'}
                    `}
                  >
                    <span
                      className={`
                        pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out
                        ${isActive ? 'translate-x-5' : 'translate-x-0'}
                      `}
                    />
                  </button>
                  <span className="text-xs sm:text-sm font-bold text-black">
                    Funcionário ativo no quadro de colaboradores
                  </span>
                </div>
              </div>

              {/* SECTION 3: COMISSÃO VARIÁVEL SOBRE PRODUÇÃO (OCULTADA PARA AGENCIADORES) */}
              {!isBroker && (
                <div className="rounded-xl border border-stone-300 bg-white/70 p-3 space-y-2 transition-all duration-200">
                  <div className="flex items-center space-x-2.5">
                    <button
                      type="button"
                      onClick={() => setReceivesCommission(!receivesCommission)}
                      className={`
                        relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none
                        ${receivesCommission ? 'bg-[#0963cb]' : 'bg-stone-300'}
                      `}
                    >
                      <span
                        className={`
                          pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out
                          ${receivesCommission ? 'translate-x-5' : 'translate-x-0'}
                        `}
                      />
                    </button>
                    <span className="text-xs sm:text-sm font-bold text-black">
                      Recebe comissão variável sobre produção
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-0.5">
                    <div>
                      <label className="block text-[11px] font-bold text-black mb-1">
                        Por hora (R$/h)
                      </label>
                      <input
                        type="text"
                        value={commissionPerHour}
                        onChange={(e) => setCommissionPerHour(e.target.value)}
                        onBlur={() => {
                          if (commissionPerHour) {
                            const parsed = parseCurrencyInput(commissionPerHour);
                            setCommissionPerHour(formatCurrencyInputDisplay(parsed));
                          }
                        }}
                        disabled={!receivesCommission}
                        className={`w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[#0963cb] ${
                          !receivesCommission ? 'opacity-60 cursor-not-allowed bg-stone-100' : ''
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-black mb-1">
                        Por alqueire (R$/alq)
                      </label>
                      <input
                        type="text"
                        value={commissionPerAlqueire}
                        onChange={(e) => setCommissionPerAlqueire(e.target.value)}
                        onBlur={() => {
                          if (commissionPerAlqueire) {
                            const parsed = parseCurrencyInput(commissionPerAlqueire);
                            setCommissionPerAlqueire(formatCurrencyInputDisplay(parsed));
                          }
                        }}
                        disabled={!receivesCommission}
                        className={`w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[#0963cb] ${
                          !receivesCommission ? 'opacity-60 cursor-not-allowed bg-stone-100' : ''
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-black mb-1">
                        Por hectare (R$/ha)
                      </label>
                      <input
                        type="text"
                        value={commissionPerHectare}
                        onChange={(e) => setCommissionPerHectare(e.target.value)}
                        onBlur={() => {
                          if (commissionPerHectare) {
                            const parsed = parseCurrencyInput(commissionPerHectare);
                            setCommissionPerHectare(formatCurrencyInputDisplay(parsed));
                          }
                        }}
                        disabled={!receivesCommission}
                        className={`w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[#0963cb] ${
                          !receivesCommission ? 'opacity-60 cursor-not-allowed bg-stone-100' : ''
                        }`}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 4: CNH & MELHORAR CATEGORIA (DT) */}
              <div className="border border-stone-300 rounded-xl overflow-hidden bg-white/70">
                <button
                  type="button"
                  onClick={() => setShowCnhFields(!showCnhFields)}
                  className="w-full px-3.5 py-2.5 bg-white/80 flex items-center justify-between text-xs font-bold text-black hover:bg-white transition cursor-pointer"
                >
                  <div className="flex items-center space-x-2">
                    <CreditCard className="w-4 h-4 text-[#0963cb]" />
                    <span>Carteira de Habilitação (CNH) & Opção de Melhorar Categoria (DT)</span>
                  </div>
                  {showCnhFields ? <ChevronUp className="w-4 h-4 text-black" /> : <ChevronDown className="w-4 h-4 text-black" />}
                </button>

                {showCnhFields && (
                  <div className="p-4 bg-white space-y-4 border-t border-stone-300 animate-fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-black uppercase tracking-wider mb-1">
                          Nº CNH
                        </label>
                        <input
                          type="text"
                          value={cnhNumber}
                          onChange={(e) => setCnhNumber(e.target.value.toUpperCase())}
                          className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-black text-xs focus:outline-none focus:ring-1 focus:ring-[#0963cb] uppercase"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-black uppercase tracking-wider mb-1">
                          CATEGORIA CNH ATUAL
                        </label>
                        <select
                          value={cnhCategory}
                          onChange={(e) => setCnhCategory(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-black text-xs focus:outline-none focus:ring-1 focus:ring-[#0963cb]"
                        >
                          <option value="A">A (Moto / Veículo 2 rodas)</option>
                          <option value="B">B (Carro / Utilitário leve)</option>
                          <option value="C">C (Caminhão / Trator agrícola)</option>
                          <option value="D">D (Ônibus / Van)</option>
                          <option value="E">E (Carreta / Articulado)</option>
                          <option value="AB">AB (Moto + Carro)</option>
                          <option value="AC">AC (Moto + Caminhão)</option>
                          <option value="AD">AD (Moto + Ônibus)</option>
                          <option value="AE">AE (Moto + Carreta)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-black uppercase tracking-wider mb-1">
                          VALIDADE CNH
                        </label>
                        <input
                          type="date"
                          value={cnhExpiration}
                          onChange={(e) => setCnhExpiration(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-black text-xs focus:outline-none focus:ring-1 focus:ring-[#0963cb]"
                        />
                      </div>
                    </div>

                    {/* Sub-bloco: Melhorar categoria (DT) */}
                    <div className="p-3 bg-sky-50/80 border border-sky-200 rounded-xl space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="cnh-upgrade-checkbox"
                            checked={cnhUpgradeDT}
                            onChange={(e) => setCnhUpgradeDT(e.target.checked)}
                            className="w-4 h-4 text-[#0963cb] rounded border-stone-300 focus:ring-[#0963cb] cursor-pointer"
                          />
                          <label htmlFor="cnh-upgrade-checkbox" className="text-xs font-bold text-black cursor-pointer">
                            Melhorar categoria (DT)
                          </label>
                        </div>
                        <span className="text-[11px] text-sky-800 font-medium">
                          Incentivo de evolução / plano de habilitação
                        </span>
                      </div>

                      {cnhUpgradeDT && (
                        <div className="pt-2 border-t border-sky-200 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fade-in">
                          <div>
                            <label className="block text-[10px] font-bold text-black uppercase tracking-wider mb-1">
                              Categoria Alvo / Associação (DT):
                            </label>
                            <select
                              value={cnhUpgradeCategory}
                              onChange={(e) => setCnhUpgradeCategory(e.target.value)}
                              className="w-full px-3 py-1.5 bg-white border border-sky-300 rounded-lg text-black text-xs focus:outline-none focus:ring-1 focus:ring-[#0963cb]"
                            >
                              <option value="A">A (Habilitação para Motocicletas)</option>
                              <option value="A + C">A + C (Moto + Caminhão)</option>
                              <option value="A + D">A + D (Moto + Ônibus/Van)</option>
                              <option value="A + E">A + E (Moto + Carreta/Bitrem)</option>
                              <option value="C">C (Caminhão / Trator)</option>
                              <option value="D">D (Ônibus / Van)</option>
                              <option value="E">E (Carreta / Articulado)</option>
                              <option value="Outra Associação">Outra Associação Personalizada</option>
                            </select>
                          </div>
                          <div className="flex items-center text-[11px] text-stone-700 pt-3">
                            Indica que o colaborador está em processo de alteração ou evolução de categoria junto ao DETRAN.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 5: INFORMAÇÕES DE PAGAMENTO / RECEBIMENTO */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2 pb-1.5 border-b border-black/15">
                  <Building2 className="w-4 h-4 text-black" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-black">
                    3. Informações de Pagamento / Recebimento
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <EditableComboboxField
                      id="employee-payment-location"
                      label="Local de Recebimento"
                      value={paymentLocation}
                      onChange={setPaymentLocation}
                      options={DEFAULT_PAYMENT_LOCATIONS}
                      placeholder="Selecione ou digite..."
                    />
                  </div>

                  <div>
                    <EditableComboboxField
                      id="employee-deposit-account-bank"
                      label="Conta de Depósito"
                      value={bankPixKey}
                      onChange={setBankPixKey}
                      options={DEFAULT_DEPOSIT_BANKS}
                      placeholder="Selecione o banco ou digite..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-black mb-1">
                      Agência (Ag.)
                    </label>
                    <input
                      type="text"
                      value={bankAgency}
                      onChange={(e) => setBankAgency(e.target.value.toUpperCase())}
                      placeholder="Ex: 0001-9"
                      className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[#0963cb] uppercase"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1 gap-1">
                      <label className="block text-xs font-bold text-black truncate">
                        Conta Corrente (C.C.) / Chave Pix
                      </label>
                      {detectedAccountOrPix.type !== 'empty' && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 bg-white/80 text-[#0963cb] border border-[#0963cb]/30 rounded shrink-0">
                          {detectedAccountOrPix.label}
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={bankAccount}
                      onChange={(e) => {
                        const raw = e.target.value;
                        // Se contiver '@' (e-mail), preserva minúsculas; caso contrário permite números, letras e símbolos de C.C. e Pix
                        if (raw.includes('@')) {
                          setBankAccount(raw.trim());
                        } else {
                          setBankAccount(raw);
                        }
                      }}
                      placeholder="C.C., CPF, E-mail, Celular ou Chave Aleatória"
                      className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[#0963cb]"
                    />
                    {detectedAccountOrPix.canQuickFormat11Digits && (
                      <div className="flex flex-wrap items-center gap-1 mt-1">
                        <span className="text-[10px] text-black/70 font-semibold">Formatar como:</span>
                        <button
                          type="button"
                          onClick={() => setBankAccount(formatCpfCnpj(bankAccount.replace(/\D/g, '')))}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-white hover:bg-sky-50 text-[#0963cb] border border-stone-300 font-bold cursor-pointer transition"
                        >
                          CPF
                        </button>
                        <button
                          type="button"
                          onClick={() => setBankAccount(formatPhone(bankAccount.replace(/\D/g, '')))}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-white hover:bg-sky-50 text-[#0963cb] border border-stone-300 font-bold cursor-pointer transition"
                        >
                          Celular
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* SECTION 6: ANEXOS & ARQUIVOS DE RETORNO (PDF/IMAGEM) */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2 pb-1.5 border-b border-black/15">
                  <Paperclip className="w-4 h-4 text-black" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-black">
                    4. Anexos & Documentos de Retorno (PDF / Imagem)
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  
                  {/* Item 1: Exame Admissional */}
                  <div className="p-3 border border-stone-300 rounded-xl bg-white flex flex-col justify-between space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-stone-600" />
                        <span className="text-xs font-bold text-black">
                          Exame Admissional (ASO)
                        </span>
                      </div>
                      {admissionExamDoc && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Anexado
                        </span>
                      )}
                    </div>

                    {admissionExamDoc ? (
                      <div className="flex items-center justify-between text-xs bg-stone-50 p-2 rounded-lg border border-stone-200">
                        <span className="truncate max-w-[180px] font-medium text-stone-700" title={admissionExamDoc.name}>
                          {admissionExamDoc.name}
                        </span>
                        <div className="flex items-center space-x-2 shrink-0">
                          <a 
                            href={admissionExamDoc.fileData} 
                            target="_blank"
                            rel="noopener noreferrer"
                            download={admissionExamDoc.name} 
                            className="text-[#0963cb] hover:underline flex items-center text-[11px]"
                          >
                            <Download className="w-3.5 h-3.5 mr-0.5" /> Baixar
                          </a>
                          <button
                            type="button"
                            onClick={() => handleRemoveFile('admissionExamDoc')}
                            className="text-rose-600 hover:text-rose-700 p-1"
                            title="Remover anexo"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="flex items-center justify-center space-x-2 px-3 py-2 border border-dashed border-stone-300 rounded-lg text-xs font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer transition">
                        <UploadCloud className="w-4 h-4 text-stone-500" />
                        <span>Upload ASO (PDF ou Imagem)</span>
                        <input
                          type="file"
                          accept=".pdf, image/*"
                          className="hidden"
                          onChange={(e) => handleFileUpload('admissionExamDoc', e)}
                        />
                      </label>
                    )}
                  </div>

                  {/* Item 2: Contrato de Experiência */}
                  <div className="p-3 border border-stone-300 rounded-xl bg-white flex flex-col justify-between space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-stone-600" />
                        <span className="text-xs font-bold text-black">
                          Contrato de Experiência
                        </span>
                      </div>
                      {experienceContractDoc && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Anexado
                        </span>
                      )}
                    </div>

                    {experienceContractDoc ? (
                      <div className="flex items-center justify-between text-xs bg-stone-50 p-2 rounded-lg border border-stone-200">
                        <span className="truncate max-w-[180px] font-medium text-stone-700" title={experienceContractDoc.name}>
                          {experienceContractDoc.name}
                        </span>
                        <div className="flex items-center space-x-2 shrink-0">
                          <a 
                            href={experienceContractDoc.fileData} 
                            target="_blank"
                            rel="noopener noreferrer"
                            download={experienceContractDoc.name} 
                            className="text-[#0963cb] hover:underline flex items-center text-[11px]"
                          >
                            <Download className="w-3.5 h-3.5 mr-0.5" /> Baixar
                          </a>
                          <button
                            type="button"
                            onClick={() => handleRemoveFile('experienceContractDoc')}
                            className="text-rose-600 hover:text-rose-700 p-1"
                            title="Remover anexo"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="flex items-center justify-center space-x-2 px-3 py-2 border border-dashed border-stone-300 rounded-lg text-xs font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer transition">
                        <UploadCloud className="w-4 h-4 text-stone-500" />
                        <span>Upload Contrato (PDF ou Imagem)</span>
                        <input
                          type="file"
                          accept=".pdf, image/*"
                          className="hidden"
                          onChange={(e) => handleFileUpload('experienceContractDoc', e)}
                        />
                      </label>
                    )}
                  </div>

                  {/* Item 3: Documentos Gerais (RE + CNH) */}
                  <div className="p-3 border border-stone-300 rounded-xl bg-white flex flex-col justify-between space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-stone-600" />
                        <span className="text-xs font-bold text-black">
                          Documentos Gerais (RE + CNH)
                        </span>
                      </div>
                      {generalDocs && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Anexado
                        </span>
                      )}
                    </div>

                    {generalDocs ? (
                      <div className="flex items-center justify-between text-xs bg-stone-50 p-2 rounded-lg border border-stone-200">
                        <span className="truncate max-w-[180px] font-medium text-stone-700" title={generalDocs.name}>
                          {generalDocs.name}
                        </span>
                        <div className="flex items-center space-x-2 shrink-0">
                          <a 
                            href={generalDocs.fileData} 
                            target="_blank"
                            rel="noopener noreferrer"
                            download={generalDocs.name} 
                            className="text-[#0963cb] hover:underline flex items-center text-[11px]"
                          >
                            <Download className="w-3.5 h-3.5 mr-0.5" /> Baixar
                          </a>
                          <button
                            type="button"
                            onClick={() => handleRemoveFile('generalDocs')}
                            className="text-rose-600 hover:text-rose-700 p-1"
                            title="Remover anexo"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="flex items-center justify-center space-x-2 px-3 py-2 border border-dashed border-stone-300 rounded-lg text-xs font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer transition">
                        <UploadCloud className="w-4 h-4 text-stone-500" />
                        <span>Upload RE + CNH (PDF ou Imagem)</span>
                        <input
                          type="file"
                          accept=".pdf, image/*"
                          className="hidden"
                          onChange={(e) => handleFileUpload('generalDocs', e)}
                        />
                      </label>
                    )}
                  </div>

                  {/* Item 4: Upload do Cadastro Assinado (Retorno) */}
                  <div className="p-3 border border-stone-300 rounded-xl bg-white flex flex-col justify-between space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <FileCheck className="w-4 h-4 text-[#0963cb]" />
                        <span className="text-xs font-bold text-black">
                          Ficha Cadastral Assinada (Retorno)
                        </span>
                      </div>
                      {signedRegistrationDoc && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Anexado
                        </span>
                      )}
                    </div>

                    {signedRegistrationDoc ? (
                      <div className="flex items-center justify-between text-xs bg-stone-50 p-2 rounded-lg border border-stone-200">
                        <span className="truncate max-w-[180px] font-medium text-stone-700" title={signedRegistrationDoc.name}>
                          {signedRegistrationDoc.name}
                        </span>
                        <div className="flex items-center space-x-2 shrink-0">
                          <a 
                            href={signedRegistrationDoc.fileData} 
                            target="_blank"
                            rel="noopener noreferrer"
                            download={signedRegistrationDoc.name} 
                            className="text-[#0963cb] hover:underline flex items-center text-[11px]"
                          >
                            <Download className="w-3.5 h-3.5 mr-0.5" /> Baixar
                          </a>
                          <button
                            type="button"
                            onClick={() => handleRemoveFile('signedRegistrationDoc')}
                            className="text-rose-600 hover:text-rose-700 p-1"
                            title="Remover anexo"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="flex items-center justify-center space-x-2 px-3 py-2 border border-dashed border-stone-300 rounded-lg text-xs font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer transition">
                        <UploadCloud className="w-4 h-4 text-[#0963cb]" />
                        <span>Upload Ficha Assinada Digitalizada</span>
                        <input
                          type="file"
                          accept=".pdf, image/*"
                          className="hidden"
                          onChange={(e) => handleFileUpload('signedRegistrationDoc', e)}
                        />
                      </label>
                    )}
                  </div>

                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 border-t border-black/15">
                <button
                  type="button"
                  onClick={handlePrintCurrentModalEmployee}
                  className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-4 py-2 rounded-lg border border-amber-400 text-amber-900 bg-amber-100 hover:bg-amber-200 text-xs font-bold transition cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir cadastro do funcionário para assinatura</span>
                </button>

                <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-5 py-2 rounded-lg border border-stone-300 text-stone-700 bg-white hover:bg-stone-50 text-xs sm:text-sm font-semibold transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2 rounded-lg bg-[#0963cb] hover:bg-[#0852a8] text-white text-xs sm:text-sm font-bold shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center space-x-2 min-w-[140px]"
                  >
                    {isSubmitting && <Loader2 className="w-4 h-4 animate-spin text-white" />}
                    <span>{isSubmitting ? 'Salvando...' : (editingEmployee ? 'Salvar Alterações' : 'Cadastrar Colaborador')}</span>
                  </button>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Print Preview Modal with Company Logo & Cadastral Data (Full Staff Roster) */}
      <PrintPreviewModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        options={{
          title: 'Relação de Funcionários, Motoristas & Operadores',
          subtitle: 'Quadro geral de colaboradores, cargos, remunerações e controle de CNH',
          documentType: 'RELATÓRIO CADASTRAL DE COLABORADORES',
          company: activeCompany,
          contentHtml: employeesPrintHtml,
          signatureLabels: ['Gestor de Recursos Humanos / Operações', 'Diretoria / Responsável Legal'],
          whatsappText: employeesWhatsAppText,
        }}
      />

      {/* Print Preview Modal for Single Employee Registration Sheet (with Direct Print, PDF Download, WhatsApp) */}
      {singleEmployeePrintOptions && (
        <PrintPreviewModal
          isOpen={isSingleEmployeePrintOpen}
          onClose={() => setIsSingleEmployeePrintOpen(false)}
          options={singleEmployeePrintOptions}
        />
      )}

      {/* Single Employee Printable Sheet (renders in DOM, styled by @media print) */}
      <PrintableEmployeeSheet 
        employee={employeeToPrint} 
        companyProfile={activeCompany} 
      />

      {/* Modal Gerenciador de Cargos e Funções */}
      <CategoryOptionsManagerModal
        isOpen={isRoleManagerOpen}
        onClose={() => {
          setIsRoleManagerOpen(false);
          setRoleManagerTarget(null);
        }}
        title="Gerenciar Cargos & Funções"
        subtitle="Inclua, edite, reordene ou exclua funções cadastradas na empresa"
        items={roleOptions}
        defaultItems={DEFAULT_ROLES}
        onSaveItems={handleUpdateRoleOptions}
        placeholder="Nome da nova função / cargo..."
        onSelectItem={(selectedRole) => {
          if (roleManagerTarget === 'role1') {
            setRole1(selectedRole);
          } else if (roleManagerTarget === 'role2') {
            setRole2(selectedRole);
          }
        }}
      />

      {/* Modal de Recorte e Upload de Foto (Bucket Público 'avatars') */}
      <EmployeePhotoCropModal
        isOpen={isCropModalOpen}
        imageSrc={cropImageSrc}
        employeeId={editingEmployee?.id}
        companyId={activeCompany?.id}
        employeeName={name || 'Colaborador'}
        onClose={() => {
          setIsCropModalOpen(false);
          setCropImageSrc(null);
        }}
        onConfirm={handleConfirmCrop}
      />

    </div>
  );
};

