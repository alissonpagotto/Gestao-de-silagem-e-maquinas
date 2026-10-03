import React, { useState, useEffect, useRef } from 'react';
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
  CalendarX,
  Eye,
  ArrowUpRight,
  Send,
  Share2
} from 'lucide-react';
import { Employee, PayrollRecord, SalaryAdvance, ServiceOrder, AbsenceRecord, Expense, PayrollCommissionItem, PayrollDeductionItem } from '../../types';
import { 
  formatCurrencyBRL, 
  formatDateBR, 
  getStoredServices, 
  getStoredCompanyProfile, 
  getStoredAbsences,
  getStoredMachineries,
  getStoredExpenses,
  saveStoredExpenses,
  getActiveCompanyId,
  saveCompanyRhFolhas,
  saveStoredPayrolls
} from '../../lib/storage';
import { 
  insertFinanceiroContasAPagar, 
  saveCloudExpenses, 
  isSupabaseConfigured, 
  toValidUUID,
  upsertRhFolhasPagamento,
  fetchCloudPayrolls,
  deleteRhFolhaPagamento,
  mapRowToPayrollRecord,
  fetchCloudAbsences,
} from '../../lib/supabaseService';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import { 
  getEmployeeMonthCommissions, 
  EmployeeMonthCommissions,
  formatMoneyBRL,
  parseMoneyToFloat,
  formatCPF,
  formatEmployeeAdmissionDate,
  formatEmployeeBankDeposit,
  getFifthBusinessDayOfSubsequentMonth,
  findEmployeeLinkedMachinery,
  calculateProgressiveInss,
  calculateOfficialIrrf,
  getAdmissionProportionality,
  AdmissionProportionality,
  getFaixaIrrf
} from './payrollHelpers';
import { PayslipModal } from './PayslipModal';
import { LivePayslipPreview } from './LivePayslipPreview';

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
  disabled?: boolean;
  required?: boolean;
  title?: string;
  headerRight?: React.ReactNode;
  subtitle?: React.ReactNode;
}

const BrlCurrencyInput: React.FC<BrlCurrencyInputProps> = ({
  id,
  label,
  value,
  onChange,
  className = '',
  inputClassName = '',
  readOnly = false,
  disabled = false,
  required = false,
  title,
  headerRight,
  subtitle,
}) => {
  const displayVal = formatMoneyBRL(value);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly || disabled) return;
    const num = parseMoneyToFloat(e.target.value);
    onChange(num);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (readOnly || disabled) return;
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
      <div className="flex items-center justify-between mb-0.5">
        <label htmlFor={id} className="block text-xs font-semibold text-stone-900 dark:text-stone-200 truncate">
          {label}
        </label>
        {headerRight}
      </div>
      {subtitle && <div className="text-[9px] text-stone-500 mb-0.5 leading-none">{subtitle}</div>}
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
          disabled={disabled}
          required={required}
          title={title}
          className={`w-full px-2 py-1 border border-stone-300 dark:border-stone-600 rounded-lg bg-white dark:bg-stone-800 text-stone-900 dark:text-white font-bold outline-none focus:ring-1 focus:ring-[#0963cb] text-xs transition ${
            disabled ? 'opacity-50 bg-stone-100 dark:bg-stone-900/60 cursor-not-allowed' : ''
          } ${inputClassName}`}
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
  const { currentUser, activeCompanyId } = useAuth();
  const activeUid = currentUser?.id || currentUser?.uid;
  const companyProfile = getStoredCompanyProfile();
  const effectiveCompanyId = activeCompanyId || companyProfile?.id || getActiveCompanyId() || activeUid || '';
  const [searchTerm, setSearchTerm] = useState('');

  const employeesRef = useRef(employees);
  employeesRef.current = employees;
  const onSavePayrollsRef = useRef(onSavePayrolls);
  onSavePayrollsRef.current = onSavePayrolls;

  // Sincronização em tempo real com ordens de serviço de silagem
  const [internalServices, setInternalServices] = useState<ServiceOrder[]>(() => 
    Array.isArray(services) ? services : (Array.isArray(getStoredServices()) ? getStoredServices() : [])
  );

  useEffect(() => {
    setInternalServices(Array.isArray(services) ? services : (Array.isArray(getStoredServices()) ? getStoredServices() : []));
  }, [services]);

  // Sincronização em tempo real com registros de faltas
  const [internalAbsences, setInternalAbsences] = useState<AbsenceRecord[]>(() => 
    Array.isArray(absences) ? absences : (Array.isArray(getStoredAbsences()) ? getStoredAbsences() : [])
  );

  useEffect(() => {
    setInternalAbsences(Array.isArray(absences) ? absences : (Array.isArray(getStoredAbsences()) ? getStoredAbsences() : []));
  }, [absences]);

  // Sincronização local com eventos de serviços e faltas na mesma aba
  useEffect(() => {
    const handleServicesUpdate = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setInternalServices(e.detail);
      } else {
        const stored = getStoredServices();
        setInternalServices(Array.isArray(stored) ? stored : []);
      }
    };
    const handleAbsencesUpdate = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setInternalAbsences(e.detail);
      } else {
        const stored = getStoredAbsences();
        setInternalAbsences(Array.isArray(stored) ? stored : []);
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

  // Assinatura Realtime Channel controlada estritamente por companyId para rh_faltas
  useEffect(() => {
    if (!isSupabaseConfigured || !effectiveCompanyId) return;

    let faltasDebounceTimer: any = null;
    const channelTopic = `rh_faltas_payroll_rt_${effectiveCompanyId}`;

    const faltasChannel = supabase
      .channel(channelTopic)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rh_faltas' },
        () => {
          if (faltasDebounceTimer) clearTimeout(faltasDebounceTimer);
          faltasDebounceTimer = setTimeout(async () => {
            try {
              const fresh = await fetchCloudAbsences();
              if (Array.isArray(fresh) && fresh.length > 0) {
                setInternalAbsences(fresh);
              }
            } catch (_) {}
          }, 500);
        }
      )
      .subscribe();

    return () => {
      if (faltasDebounceTimer) clearTimeout(faltasDebounceTimer);
      try {
        supabase.removeChannel(faltasChannel);
      } catch (_) {}
    };
  }, [effectiveCompanyId]);

  // Estado das Folhas de Pagamento conectado diretamente à nuvem (Supabase)
  const [localPayrolls, setLocalPayrolls] = useState<PayrollRecord[]>(() => 
    Array.isArray(payrolls) ? payrolls : []
  );

  useEffect(() => {
    setLocalPayrolls(Array.isArray(payrolls) ? payrolls : []);
  }, [payrolls]);

  // Trava de segurança para carga inicial única das folhas de pagamento
  const isPayrollsLoadedRef = useRef<string | null>(null);

  // Carga inicial das folhas de pagamento diretamente da nuvem (tabela public.rh_folhas_pagamento)
  useEffect(() => {
    if (!isSupabaseConfigured || !effectiveCompanyId) return;
    if (isPayrollsLoadedRef.current === effectiveCompanyId) return;
    isPayrollsLoadedRef.current = effectiveCompanyId;

    let isMounted = true;

    const loadCloudPayrolls = async () => {
      try {
        const cloudData = await fetchCloudPayrolls(effectiveCompanyId);
        if (isMounted) {
          if (Array.isArray(cloudData) && cloudData.length > 0) {
            const safeEmps = Array.isArray(employeesRef.current) ? employeesRef.current : [];
            const cleanList = cloudData.map(p => {
              if (!p.employeeName || !p.employeeRole) {
                const emp = safeEmps.find(e => e.id === p.employeeId || toValidUUID(e.id) === p.employeeId);
                if (emp) {
                  return {
                    ...p,
                    employeeName: p.employeeName || emp.name,
                    employeeRole: p.employeeRole || emp.role,
                  };
                }
              }
              return p;
            });
            setLocalPayrolls(cleanList);
            onSavePayrollsRef.current(cleanList);
          } else {
            setLocalPayrolls([]);
          }
        }
      } catch (err) {
        if (isMounted) {
          setLocalPayrolls([]);
        }
      }
    };

    loadCloudPayrolls();

    return () => {
      isMounted = false;
    };
  }, [effectiveCompanyId]);

  // Listener em tempo real (Supabase Realtime) escutando 'rh_folhas_pagamento' com fechamento severo
  useEffect(() => {
    if (!isSupabaseConfigured || !effectiveCompanyId) return;
    let isMounted = true;

    const channelId = `rh_folhas_pagamento_rt_${effectiveCompanyId}`;

    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rh_folhas_pagamento',
        },
        (payload: any) => {
          if (!isMounted) return;

          // Validação de segurança por assinante
          if (payload.new) {
            const rowUid = String(payload.new.user_id || '').trim();
            const rowCid = String(payload.new.company_id || '').trim();
            if (rowUid && rowUid !== effectiveCompanyId && rowCid && rowCid !== effectiveCompanyId) {
              return;
            }
          }

          if (payload.eventType === 'DELETE' && payload.old?.id) {
            const delId = toValidUUID(payload.old.id);
            setLocalPayrolls(prev => {
              const next = prev.filter(p => toValidUUID(p.id) !== delId && p.id !== delId && p.id !== payload.old.id);
              onSavePayrollsRef.current(next);
              return next;
            });
          } else if (payload.new) {
            const mapped = mapRowToPayrollRecord(payload.new);
            const mappedId = toValidUUID(mapped.id);

            const currentEmps = employeesRef.current || [];
            const emp = currentEmps.find(e => e.id === mapped.employeeId || toValidUUID(e.id) === mapped.employeeId);
            if (emp) {
              if (!mapped.employeeName) mapped.employeeName = emp.name;
              if (!mapped.employeeRole) mapped.employeeRole = emp.role;
            }

            setLocalPayrolls(prev => {
              const isMatch = (p: PayrollRecord) => {
                if (mappedId && (toValidUUID(p.id) === mappedId || p.id === mappedId || p.id === payload.new.id)) return true;
                if (p.employeeId && mapped.employeeId && (p.employeeId === mapped.employeeId || toValidUUID(p.employeeId) === toValidUUID(mapped.employeeId))) {
                  if (p.referenceMonth && mapped.referenceMonth && p.referenceMonth === mapped.referenceMonth) return true;
                }
                return false;
              };

              const exists = prev.some(isMatch);
              const next = exists
                ? prev.map(p => isMatch(p) ? { ...p, ...mapped, id: mappedId || p.id } : p)
                : [mapped, ...prev];

              onSavePayrollsRef.current(next);
              return next;
            });
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      try {
        supabase.removeChannel(channel);
      } catch (_) {}
    };
  }, [effectiveCompanyId]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPayroll, setEditingPayroll] = useState<PayrollRecord | null>(null);
  const [modalPayslipPayroll, setModalPayslipPayroll] = useState<PayrollRecord | null>(null);

  // Form State
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [baseSalaryContratual, setBaseSalaryContratual] = useState<number>(0);
  const [baseCalculoInssFgts, setBaseCalculoInssFgts] = useState<number>(0);
  const [baseSalary, setBaseSalary] = useState<number>(0);
  const [overtimeAmount, setOvertimeAmount] = useState<number>(0);
  const [bonusAmount, setBonusAmount] = useState<number>(0);
  const [commissionAmount, setCommissionAmount] = useState<number>(0);
  const [commissionsInfo, setCommissionsInfo] = useState<EmployeeMonthCommissions | null>(null);
  const [showCommissionBreakdown, setShowCommissionBreakdown] = useState(false);
  const [inssDiscount, setInssDiscount] = useState<number>(0);
  const [inssEnabled, setInssEnabled] = useState<boolean>(true);
  const [aliquotaInss, setAliquotaInss] = useState<number>(8.04);
  const [aliquotaInssStr, setAliquotaInssStr] = useState<string>('8,04');
  const [irrfDiscount, setIrrfDiscount] = useState<number>(0);
  const [irrfEnabled, setIrrfEnabled] = useState<boolean>(false);
  const [aliquotaIrrf, setAliquotaIrrf] = useState<number>(0.0);
  const [aliquotaIrrfStr, setAliquotaIrrfStr] = useState<string>('0,0');
  const [sindicalDiscount, setSindicalDiscount] = useState<number>(25.23);
  const [sindicalEnabled, setSindicalEnabled] = useState<boolean>(true);
  const [aliquotaSindicato, setAliquotaSindicato] = useState<number>(1.0);
  const [aliquotaSindicatoStr, setAliquotaSindicatoStr] = useState<string>('1,0');
  const [lastCustomSindical, setLastCustomSindical] = useState<number>(25.23);
  const [admissionInfo, setAdmissionInfo] = useState<AdmissionProportionality | null>(null);
  const [useProportionalSalary, setUseProportionalSalary] = useState<boolean>(false);
  const [advancesDiscount, setAdvancesDiscount] = useState<number>(0);
  const [otherDiscounts, setOtherDiscounts] = useState<number>(0);
  const [payrollStatus, setPayrollStatus] = useState<'pendente' | 'pago' | 'integrado' | 'lancado' | string>('pendente');
  const [notes, setNotes] = useState('');
  const [integratingId, setIntegratingId] = useState<string | null>(null);
  const [integrationBanner, setIntegrationBanner] = useState<{
    type: 'success' | 'info' | 'error';
    title: string;
    details: string;
  } | null>(null);

  // Manipuladores de Cálculo Reativo Automático (Base Cálc. INSS/FGTS e Alíquotas)
  const handleBaseCalculoChange = (newBase: number) => {
    setBaseCalculoInssFgts(newBase);
    if (inssEnabled) {
      const calculatedInss = Math.round((newBase * (aliquotaInss / 100)) * 100) / 100;
      setInssDiscount(calculatedInss);
      if (irrfEnabled) {
        const baseIrrf = Math.max(0, newBase - calculatedInss);
        const calculatedIrrf = aliquotaIrrf > 0 
          ? Math.round((baseIrrf * (aliquotaIrrf / 100)) * 100) / 100 
          : calculateOfficialIrrf(newBase, calculatedInss);
        setIrrfDiscount(calculatedIrrf);
      }
    }
    if (sindicalEnabled) {
      const calculatedSind = Math.round((newBase * (aliquotaSindicato / 100)) * 100) / 100;
      setSindicalDiscount(calculatedSind);
      setLastCustomSindical(calculatedSind);
    }
  };

  const handleAliquotaInssChange = (valStr: string) => {
    setAliquotaInssStr(valStr);
    const normalized = valStr.replace(',', '.').replace(/[^\d.]/g, '');
    const parsed = parseFloat(normalized);
    if (!isNaN(parsed) && parsed >= 0) {
      setAliquotaInss(parsed);
      if (inssEnabled) {
        const base = baseCalculoInssFgts > 0 ? baseCalculoInssFgts : (baseSalaryContratual || baseSalary);
        const calculated = Math.round((base * (parsed / 100)) * 100) / 100;
        setInssDiscount(calculated);
      }
    }
  };

  const handleInssDiscountChange = (val: number) => {
    setInssDiscount(val);
    const base = baseCalculoInssFgts > 0 ? baseCalculoInssFgts : (baseSalaryContratual || baseSalary);
    if (base > 0) {
      const derivedAliq = Number(((val / base) * 100).toFixed(2));
      setAliquotaInss(derivedAliq);
      setAliquotaInssStr(derivedAliq.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }));
    }
  };

  const handleAliquotaSindicatoChange = (valStr: string) => {
    setAliquotaSindicatoStr(valStr);
    const normalized = valStr.replace(',', '.').replace(/[^\d.]/g, '');
    const parsed = parseFloat(normalized);
    if (!isNaN(parsed) && parsed >= 0) {
      setAliquotaSindicato(parsed);
      if (sindicalEnabled) {
        const base = baseCalculoInssFgts > 0 ? baseCalculoInssFgts : (baseSalaryContratual || baseSalary);
        const calculated = Math.round((base * (parsed / 100)) * 100) / 100;
        setSindicalDiscount(calculated);
        setLastCustomSindical(calculated);
      }
    }
  };

  const handleSindicalDiscountChange = (val: number) => {
    setSindicalDiscount(val);
    if (val > 0) setLastCustomSindical(val);
    const base = baseCalculoInssFgts > 0 ? baseCalculoInssFgts : (baseSalaryContratual || baseSalary);
    if (base > 0) {
      const derivedAliq = Number(((val / base) * 100).toFixed(2));
      setAliquotaSindicato(derivedAliq);
      setAliquotaSindicatoStr(derivedAliq.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }));
    }
  };

  const handleAliquotaIrrfChange = (valStr: string) => {
    setAliquotaIrrfStr(valStr);
    const normalized = valStr.replace(',', '.').replace(/[^\d.]/g, '');
    const parsed = parseFloat(normalized);
    if (!isNaN(parsed) && parsed >= 0) {
      setAliquotaIrrf(parsed);
      if (irrfEnabled) {
        const base = baseCalculoInssFgts > 0 ? baseCalculoInssFgts : (baseSalaryContratual || baseSalary);
        const baseIrrf = Math.max(0, base - (inssEnabled ? inssDiscount : 0));
        const calculated = Math.round((baseIrrf * (parsed / 100)) * 100) / 100;
        setIrrfDiscount(calculated);
      }
    }
  };

  const handleIrrfDiscountChange = (val: number) => {
    setIrrfDiscount(val);
    const base = baseCalculoInssFgts > 0 ? baseCalculoInssFgts : (baseSalaryContratual || baseSalary);
    const baseIrrf = Math.max(0, base - (inssEnabled ? inssDiscount : 0));
    if (baseIrrf > 0) {
      const derivedAliq = Number(((val / baseIrrf) * 100).toFixed(2));
      setAliquotaIrrf(derivedAliq);
      setAliquotaIrrfStr(derivedAliq.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }));
    }
  };

  // Detalhamento e sincronização de Vales e Faltas no Modal
  const [syncedAdvances, setSyncedAdvances] = useState<SalaryAdvance[]>([]);
  const [syncedAbsences, setSyncedAbsences] = useState<AbsenceRecord[]>([]);
  const [showAdvancesBreakdown, setShowAdvancesBreakdown] = useState(true);
  const [showAbsencesBreakdown, setShowAbsencesBreakdown] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Listas de Detalhamento de Comissões e Deduções
  const [commissionItems, setCommissionItems] = useState<PayrollCommissionItem[]>([]);
  const [deductionItems, setDeductionItems] = useState<PayrollDeductionItem[]>([]);

  // Mini-form para inclusão / edição de comissão manual
  const [isAddingCommission, setIsAddingCommission] = useState(false);
  const [editingCommItemId, setEditingCommItemId] = useState<string | null>(null);
  const [newCommDesc, setNewCommDesc] = useState('');
  const [newCommRef, setNewCommRef] = useState('');
  const [newCommAmount, setNewCommAmount] = useState<number>(0);

  // Mini-form para inclusão / edição de desconto manual
  const [isAddingDeduction, setIsAddingDeduction] = useState(false);
  const [editingDeductItemId, setEditingDeductItemId] = useState<string | null>(null);
  const [newDeductType, setNewDeductType] = useState('Vale / Adiantamento');
  const [newDeductDesc, setNewDeductDesc] = useState('');
  const [newDeductDate, setNewDeductDate] = useState('');
  const [newDeductAmount, setNewDeductAmount] = useState<number>(0);

  // Ação de Impressão Isolada do Recibo Branco (Holerite Oficial) com injeção de estilos do projeto
  const handlePrintIsolated = () => {
    const reciboElement = document.getElementById('recibo-holerite-branco') || document.getElementById('live-holerite-sheet');
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
            <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
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
      
      // Aguarda a renderização completa e imagens do QR Code carregarem antes de disparar a impressora
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 750);
    }
  };

  // Prepara os dados atuais do modal e dispara a impressão isolada
  const handlePrintCurrentModalPayroll = () => {
    const emp = employees.find(e => e.id === selectedEmployeeId);
    if (!emp) {
      alert('Por favor, selecione um colaborador primeiro.');
      return;
    }
    const activeInss = inssEnabled ? (inssDiscount || 0) : 0;
    const activeIrrf = irrfEnabled ? (irrfDiscount || 0) : 0;
    const activeSindical = sindicalEnabled ? (sindicalDiscount || 0) : 0;
    const currentGross = (baseSalary || 0) + (overtimeAmount || 0) + (bonusAmount || 0) + (commissionAmount || 0);
    const currentNet = Math.max(
      0,
      currentGross - (activeInss + activeIrrf + activeSindical + advancesDiscount + otherDiscounts)
    );
    const calculatedBase = baseCalculoInssFgts || baseSalaryContratual || baseSalary;
    const calculatedBaseIrrf = Math.max(0, calculatedBase - activeInss);
    const calculatedFaixaIrrf = getFaixaIrrf(calculatedBaseIrrf);
    const calculatedFgtsDoMes = Math.round((calculatedBase * 0.08) * 100) / 100;

    const draft: PayrollRecord = {
      id: editingPayroll?.id || `pay_draft_${Date.now()}`,
      employeeId: emp.id,
      employeeName: emp.name,
      employeeRole: emp.role,
      referenceMonth: currentMonthRef,
      baseSalary: baseSalary,
      baseSalaryContratual,
      baseCalculoInssFgts: calculatedBase,
      base_inss: calculatedBase,
      aliquota_inss: aliquotaInss,
      aliquotaInss,
      aliquota_sindicato: aliquotaSindicato,
      aliquotaSindicato,
      aliquota_irrf: aliquotaIrrf,
      aliquotaIrrf,
      baseCalculoFgts: calculatedBase,
      fgtsDoMes: calculatedFgtsDoMes,
      baseCalculoIrrf: calculatedBaseIrrf,
      faixaIrrf: calculatedFaixaIrrf,
      overtimeHours: editingPayroll?.overtimeHours || 0,
      overtimeAmount: overtimeAmount,
      bonusAmount: bonusAmount,
      commissionAmount: commissionAmount,
      commissionItems,
      inssDiscount: activeInss,
      inssEnabled,
      irrfDiscount: activeIrrf,
      irrfEnabled,
      sindicalDiscount: activeSindical,
      sindicalEnabled,
      taxaSindical: activeSindical,
      advancesDiscount: advancesDiscount,
      otherDiscounts: otherDiscounts,
      deductionItems,
      netSalary: currentNet,
      status: payrollStatus,
      notes: notes,
      payload: {
        ...(editingPayroll?.payload || {}),
        baseSalaryContratual,
        baseCalculoInssFgts: calculatedBase,
        base_inss: calculatedBase,
        aliquota_inss: aliquotaInss,
        aliquotaInss,
        aliquota_sindicato: aliquotaSindicato,
        aliquotaSindicato,
        aliquota_irrf: aliquotaIrrf,
        aliquotaIrrf,
        baseCalculoFgts: calculatedBase,
        fgtsDoMes: calculatedFgtsDoMes,
        baseCalculoIrrf: calculatedBaseIrrf,
        faixaIrrf: calculatedFaixaIrrf,
        commissionItems,
        deductionItems,
      },
      createdAt: editingPayroll?.createdAt || new Date().toISOString(),
    };
    setModalPayslipPayroll(draft);

    // Aguarda o React renderizar o elemento #recibo-holerite-branco e dispara a impressão isolada
    setTimeout(() => {
      handlePrintIsolated();
    }, 250);
  };

  // Filtered Payrolls - Exclusão estrita de Terceirizados (gerenciados pelo Financeiro)
  const monthPayrolls = (Array.isArray(localPayrolls) ? localPayrolls : []).filter(p => {
    if (p.referenceMonth !== currentMonthRef) return false;
    const emp = employees.find(e => e.id === p.employeeId);
    if (emp && isThirdPartyDriver(emp)) return false;
    if ((p.employeeRole || '').toLowerCase().includes('terceiriz')) return false;
    return true;
  });

  const filtered = monthPayrolls.filter(p => 
    (p.employeeName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.employeeRole || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Totais
  const totalBase = monthPayrolls.reduce((sum, p) => sum + (p.baseSalary || 0), 0);
  const totalCommissions = monthPayrolls.reduce((sum, p) => sum + (p.commissionAmount || 0), 0);
  const totalOvertimeBonus = monthPayrolls.reduce((sum, p) => sum + (p.overtimeAmount || 0) + (p.bonusAmount || 0) + (p.commissionAmount || 0), 0);
  const totalDiscounts = monthPayrolls.reduce(
    (sum, p) => sum + (p.inssDiscount || 0) + (p.irrfDiscount || 0) + (p.sindicalDiscount || (p as any).taxaSindical || 0) + (p.advancesDiscount || 0) + (p.otherDiscounts || 0),
    0
  );
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
  const syncEmployeeData = (
    empId: string, 
    customSalary?: number,
    forceContractualSalary?: boolean
  ) => {
    if (!empId) return;
    const emp = employees.find(e => e.id === empId);
    if (!emp) return;

    const fullContractual = emp.salary || emp.baseSalary || 2523.21;
    setBaseSalaryContratual(fullContractual);
    setBaseCalculoInssFgts(fullContractual);
    
    // Regra da Data de Admissão no mês:
    const admData = getAdmissionProportionality(emp.admissionDate, currentMonthRef, fullContractual);
    setAdmissionInfo(admData);

    let activeSalary = fullContractual;
    if (customSalary !== undefined) {
      activeSalary = customSalary;
      setUseProportionalSalary(admData.isAdmittedInCompetenceMonth && Math.abs(customSalary - admData.proportionalSalary) < 0.05);
    } else if (admData.isAdmittedInCompetenceMonth && !forceContractualSalary) {
      // Como a competência é 09/2026 e a admissão foi em 03/09/2026, calcula e exibe o Salário Proporcional (28 dias de 30)
      activeSalary = admData.proportionalSalary;
      setUseProportionalSalary(true);
    } else {
      activeSalary = fullContractual;
      setUseProportionalSalary(false);
    }
    setBaseSalary(activeSalary);

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

    let totalFaltasDesconto = empAbsences.reduce((sum, a) => {
      if (a.discountAmount !== undefined && a.discountAmount > 0) {
        return sum + Number(a.discountAmount);
      }
      const daily = (activeSalary || 3500) / 30;
      const days = a.daysCount || 1;
      return sum + Math.round((daily * days) * 100) / 100;
    }, 0);

    // Se o usuário preferir usar o salário integral cheio e a admissão foi no mês, pode descontar os dias anteriores como falta
    if (forceContractualSalary && admData.isAdmittedInCompetenceMonth) {
      totalFaltasDesconto += admData.unworkedDeductionAmount;
    }

    setOtherDiscounts(totalFaltasDesconto);
    setSyncedAbsences(empAbsences);
    if (empAbsences.length > 0) {
      setShowAdvancesBreakdown(true);
    }

    // 3.1 Constrói lista estruturada de Deduções (Vales, Faltas, Pré-admissão) preservando itens manuais
    const generatedDeductItems: PayrollDeductionItem[] = [];

    empAdvances.forEach((adv, idx) => {
      const parcelLabel = adv.discountType === 'Parcelado' && adv.installmentNumber && adv.totalInstallments
        ? `[${adv.installmentNumber}/${adv.totalInstallments}] `
        : '';
      const reason = adv.reason ? `: ${adv.reason}` : '';
      generatedDeductItems.push({
        id: `ded_adv_${adv.id || idx}`,
        type: 'Vale / Adiantamento',
        description: `${parcelLabel}Vale Adiantamento${reason}`,
        date: formatDateBR(adv.date),
        amount: Number(adv.amount) || 0,
        isManual: false,
        sourceId: adv.id,
      });
    });

    empAbsences.forEach((abs, idx) => {
      const itemDiscount = (abs.discountAmount && abs.discountAmount > 0)
        ? Number(abs.discountAmount)
        : Math.round((((activeSalary || 3500) / 30) * (abs.daysCount || 1)) * 100) / 100;
      generatedDeductItems.push({
        id: `ded_abs_${abs.id || idx}`,
        type: 'Falta / Atraso',
        description: abs.reason || `Falta (${abs.daysCount || 1}d)`,
        date: formatDateBR(abs.date),
        amount: itemDiscount,
        isManual: false,
        sourceId: abs.id,
      });
    });

    if (forceContractualSalary && admData.isAdmittedInCompetenceMonth) {
      generatedDeductItems.push({
        id: `ded_pre_adm_${Date.now()}`,
        type: 'Falta / Atraso',
        description: `Dias anteriores à admissão (${admData.unworkedDays} dias)`,
        date: formatEmployeeAdmissionDate(admData.admissionDate),
        amount: admData.unworkedDeductionAmount,
        isManual: false,
      });
    }

    setDeductionItems(prev => {
      const manuals = prev.filter(
        it => it.isManual && 
              !it.description?.toLowerCase().includes('sindicat') && 
              !it.description?.toLowerCase().includes('taxa assist') &&
              !it.type?.toLowerCase().includes('sindicat')
      );
      return [...generatedDeductItems, ...manuals];
    });

    // 4. INTEGRAÇÃO DE VALORES: Apuração ativa de comissões de silagem e produção no mês
    const commData = getEmployeeMonthCommissions(empId, currentMonthRef, internalServices, employees);
    setCommissionAmount(commData.total);
    setCommissionsInfo(commData);
    if (commData.count > 0) {
      setShowCommissionBreakdown(true);
    }

    // 4.1 Constrói lista estruturada de Comissões preservando itens manuais
    const generatedCommItems: PayrollCommissionItem[] = commData.breakdown.map((b, idx) => {
      let desc = (b.formattedLine || b.description || 'Comissão de Silagem / Produção').replace(/\s*\(\s*cla?ss\s*\)/gi, '');
      if (b.clientName && !desc.toLowerCase().includes(b.clientName.toLowerCase())) {
        desc = `Ensilagem - Produtor ${b.clientName}`;
      }
      return {
        id: `comm_sync_${idx}_${b.serviceId || Date.now()}`,
        description: desc,
        referenceDate: b.date ? formatDateBR(b.date) : (b.orderNumber ? `OS #${b.orderNumber}` : currentMonthRef),
        amount: Number(b.amount) || 0,
        isManual: false,
      };
    });

    setCommissionItems(prev => {
      const manuals = prev.filter(it => it.isManual);
      const combined = [...generatedCommItems, ...manuals];
      const sum = combined.reduce((acc, it) => acc + (Number(it.amount) || 0), 0);
      setCommissionAmount(sum);
      return combined;
    });

    // 5. REGRA DE NEGÓCIO: Cálculo oficial de INSS, IRRF e Taxa Assistencial Sindicato com Alíquotas Visíveis
    const isClt = isCltContract(emp);
    const baseCalc = fullContractual;
    if (isClt) {
      setInssEnabled(true);
      let aliqInss = 8.04;
      if (Math.abs(baseCalc - 2523.21) < 1.0) {
        aliqInss = 8.04;
      } else {
        const progressiveInss = calculateProgressiveInss(baseCalc);
        aliqInss = baseCalc > 0 ? Number(((progressiveInss / baseCalc) * 100).toFixed(2)) : 8.04;
      }
      setAliquotaInss(aliqInss);
      setAliquotaInssStr(aliqInss.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }));
      const inssCalculated = Math.abs(baseCalc - 2523.21) < 1.0 ? 202.76 : Math.round((baseCalc * (aliqInss / 100)) * 100) / 100;
      setInssDiscount(inssCalculated);

      // Taxa Assistencial Sindicato: 1.0% -> R$ 25,23 (se 2523.21)
      setSindicalEnabled(true);
      const aliqSind = 1.0;
      setAliquotaSindicato(aliqSind);
      setAliquotaSindicatoStr('1,0');
      const sindCalculated = Math.round((baseCalc * (aliqSind / 100)) * 100) / 100;
      setSindicalDiscount(sindCalculated);
      setLastCustomSindical(sindCalculated);

      // IRRF
      const baseIrrf = Math.max(0, baseCalc - inssCalculated);
      const progressiveIrrf = calculateOfficialIrrf(baseCalc, inssCalculated);
      const aliqIrrf = (progressiveIrrf > 0 && baseIrrf > 0) ? Number(((progressiveIrrf / baseIrrf) * 100).toFixed(2)) : 0.0;
      setAliquotaIrrf(aliqIrrf);
      setAliquotaIrrfStr(aliqIrrf.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }));
      setIrrfDiscount(progressiveIrrf);
      setIrrfEnabled(progressiveIrrf > 0);
    } else {
      setInssEnabled(false);
      setInssDiscount(0);
      setAliquotaInss(0);
      setAliquotaInssStr('0,0');
      setIrrfEnabled(false);
      setIrrfDiscount(0);
      setAliquotaIrrf(0);
      setAliquotaIrrfStr('0,0');
      setSindicalEnabled(false);
      setSindicalDiscount(0);
      setAliquotaSindicato(0);
      setAliquotaSindicatoStr('0,0');
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

      const emp = employees.find(e => e.id === payroll.employeeId);
      const fullSal = emp?.salary || emp?.baseSalary || payroll.baseSalary || 2523.21;
      const contratual = payroll.baseSalaryContratual ?? payroll.payload?.baseSalaryContratual ?? fullSal;
      setBaseSalaryContratual(contratual);

      const baseInssFgts = payroll.baseCalculoInssFgts ?? payroll.base_inss ?? payroll.payload?.baseCalculoInssFgts ?? payroll.payload?.base_inss ?? contratual;
      setBaseCalculoInssFgts(baseInssFgts);

      const admData = getAdmissionProportionality(emp?.admissionDate, currentMonthRef, fullSal);
      setAdmissionInfo(admData);
      setUseProportionalSalary(
        payroll.isProportional !== undefined 
          ? Boolean(payroll.isProportional) 
          : (admData.isAdmittedInCompetenceMonth && Math.abs(payroll.baseSalary - admData.proportionalSalary) < 0.5)
      );

      // Apuração ativa das comissões do mês
      const commData = getEmployeeMonthCommissions(payroll.employeeId, currentMonthRef, internalServices, employees);
      setCommissionsInfo(commData);
      setCommissionAmount(payroll.commissionAmount !== undefined ? payroll.commissionAmount : commData.total);

      // INSS
      const isClt = isCltContract(emp);
      setInssDiscount(payroll.inssDiscount || 0);
      setInssEnabled(payroll.inssEnabled !== undefined ? Boolean(payroll.inssEnabled) : (payroll.inssDiscount > 0 || isClt));
      const savedAliqInss = payroll.aliquotaInss ?? payroll.aliquota_inss ?? payroll.payload?.aliquotaInss ?? payroll.payload?.aliquota_inss;
      const finalAliqInss = savedAliqInss !== undefined 
        ? Number(savedAliqInss) 
        : (baseInssFgts > 0 && (payroll.inssDiscount || 0) > 0 ? Number((((payroll.inssDiscount || 0) / baseInssFgts) * 100).toFixed(2)) : (isClt ? 8.04 : 0));
      setAliquotaInss(finalAliqInss);
      setAliquotaInssStr(finalAliqInss.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }));

      // IRRF
      const irrfVal = payroll.irrfDiscount || 0;
      setIrrfDiscount(irrfVal);
      setIrrfEnabled(payroll.irrfEnabled !== undefined ? Boolean(payroll.irrfEnabled) : (irrfVal > 0));
      const savedAliqIrrf = payroll.aliquotaIrrf ?? payroll.aliquota_irrf ?? payroll.payload?.aliquotaIrrf ?? payroll.payload?.aliquota_irrf;
      const baseIrrf = Math.max(0, baseInssFgts - (payroll.inssDiscount || 0));
      const finalAliqIrrf = savedAliqIrrf !== undefined 
        ? Number(savedAliqIrrf) 
        : (baseIrrf > 0 && irrfVal > 0 ? Number(((irrfVal / baseIrrf) * 100).toFixed(2)) : 0.0);
      setAliquotaIrrf(finalAliqIrrf);
      setAliquotaIrrfStr(finalAliqIrrf.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }));

      // Taxa Assistencial Sindicato
      const savedSindical = payroll.sindicalDiscount !== undefined 
        ? payroll.sindicalDiscount 
        : ((payroll as any).taxaSindical !== undefined ? (payroll as any).taxaSindical : ((payroll as any).desconto_sindical ?? (payroll as any).payload?.sindicalDiscount ?? (payroll as any).payload?.taxaSindical));
      const savedSindicalEnabled = payroll.sindicalEnabled !== undefined 
        ? Boolean(payroll.sindicalEnabled) 
        : ((payroll as any).payload?.sindicalEnabled !== undefined 
            ? Boolean((payroll as any).payload.sindicalEnabled) 
            : (savedSindical !== undefined ? Number(savedSindical) > 0 : isClt));

      let finalSindicalAmount = savedSindical !== undefined ? Number(savedSindical) : (isClt ? 25.23 : 0);
      let finalSindicalEnabled = savedSindicalEnabled;

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
      // Carregar itens de comissão existentes ou gerar da apuração
      let loadedCommItems: PayrollCommissionItem[] = [];
      if (Array.isArray(payroll.commissionItems) && payroll.commissionItems.length > 0) {
        loadedCommItems = payroll.commissionItems;
      } else if (Array.isArray(payroll.payload?.commissionItems) && payroll.payload.commissionItems.length > 0) {
        loadedCommItems = payroll.payload.commissionItems;
      } else {
        loadedCommItems = commData.breakdown.map((b, idx) => {
          let desc = (b.formattedLine || b.description || 'Comissão de Produção / Silagem').replace(/\s*\(\s*cla?ss\s*\)/gi, '');
          if (b.clientName && !desc.toLowerCase().includes(b.clientName.toLowerCase())) {
            desc = `Ensilagem - Produtor ${b.clientName}`;
          }
          return {
            id: `comm_${idx}_${Date.now()}`,
            description: desc,
            referenceDate: b.date ? formatDateBR(b.date) : (b.orderNumber ? `OS #${b.orderNumber}` : currentMonthRef),
            amount: Number(b.amount) || 0,
            isManual: false,
          };
        });
      }
      setCommissionItems(loadedCommItems);

      // Carregar itens de deduções existentes ou gerar dos vales e faltas
      let loadedDeductItems: PayrollDeductionItem[] = [];
      if (Array.isArray(payroll.deductionItems) && payroll.deductionItems.length > 0) {
        loadedDeductItems = payroll.deductionItems;
      } else if (Array.isArray(payroll.payload?.deductionItems) && payroll.payload.deductionItems.length > 0) {
        loadedDeductItems = payroll.payload.deductionItems;
      } else {
        empAdvances.forEach((adv, idx) => {
          const parcelLabel = adv.discountType === 'Parcelado' && adv.installmentNumber && adv.totalInstallments
            ? `[${adv.installmentNumber}/${adv.totalInstallments}] `
            : '';
          const reason = adv.reason ? `: ${adv.reason}` : '';
          loadedDeductItems.push({
            id: `ded_adv_${adv.id || idx}`,
            type: 'Vale / Adiantamento',
            description: `${parcelLabel}Vale Adiantamento${reason}`,
            date: formatDateBR(adv.date),
            amount: Number(adv.amount) || 0,
            isManual: false,
            sourceId: adv.id,
          });
        });

        empAbsences.forEach((abs, idx) => {
          const itemDiscount = (abs.discountAmount && abs.discountAmount > 0)
            ? Number(abs.discountAmount)
            : Math.round((((payroll.baseSalary || 3500) / 30) * (abs.daysCount || 1)) * 100) / 100;
          loadedDeductItems.push({
            id: `ded_abs_${abs.id || idx}`,
            type: 'Falta / Atraso',
            description: abs.reason || `Falta (${abs.daysCount || 1}d)`,
            date: formatDateBR(abs.date),
            amount: itemDiscount,
            isManual: false,
            sourceId: abs.id,
          });
        });
      }

      // Se houver desconto sindical na lista de deduções vindo de dados legados, extrai o valor para o campo fixo e purga da lista
      const legacySindicalItem = loadedDeductItems.find(
        it => it.description?.toLowerCase().includes('sindicat') || 
              it.description?.toLowerCase().includes('taxa assist') || 
              it.type?.toLowerCase().includes('sindicat')
      );
      if (legacySindicalItem && (!savedSindical || Number(savedSindical) === 0)) {
        finalSindicalAmount = Number(legacySindicalItem.amount) || 25.23;
        finalSindicalEnabled = true;
      }

      // Limpa estritamente a lista de deduções para que NUNCA exiba itens de taxa sindical
      loadedDeductItems = loadedDeductItems.filter(
        it => !it.description?.toLowerCase().includes('sindicat') && 
              !it.description?.toLowerCase().includes('taxa assist') && 
              !it.type?.toLowerCase().includes('sindicat')
      );

      setSindicalEnabled(finalSindicalEnabled);
      setSindicalDiscount(finalSindicalEnabled ? (finalSindicalAmount > 0 ? finalSindicalAmount : 25.23) : 0);
      setLastCustomSindical(finalSindicalAmount > 0 ? finalSindicalAmount : 25.23);

      const savedAliqSind = payroll.aliquotaSindicato ?? payroll.aliquota_sindicato ?? payroll.payload?.aliquotaSindicato ?? payroll.payload?.aliquota_sindicato;
      const finalAliqSind = savedAliqSind !== undefined 
        ? Number(savedAliqSind) 
        : (baseInssFgts > 0 && Number(finalSindicalAmount) > 0 ? Number(((Number(finalSindicalAmount) / baseInssFgts) * 100).toFixed(2)) : (isClt ? 1.0 : 0));
      setAliquotaSindicato(finalAliqSind);
      setAliquotaSindicatoStr(finalAliqSind.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }));

      setDeductionItems(loadedDeductItems);
    } else {
      setEditingPayroll(null);
      setCommissionsInfo(null);
      setShowCommissionBreakdown(false);
      setSyncedAdvances([]);
      setSyncedAbsences([]);
      setCommissionItems([]);
      setDeductionItems([]);
      // Selecionar primeiro funcionário ativo NÃO terceirizado
      const firstActive = employees.find(e => e.status === 'ativo' && !isThirdPartyDriver(e) && !isBrokerEmployee(e));
      if (firstActive) {
        handleSelectEmployee(firstActive.id);
      } else {
        setSelectedEmployeeId('');
        setBaseSalary(0);
        setBaseSalaryContratual(0);
        setBaseCalculoInssFgts(0);
        setAliquotaInss(8.04);
        setAliquotaInssStr('8,04');
        setAliquotaSindicato(1.0);
        setAliquotaSindicatoStr('1,0');
        setAliquotaIrrf(0.0);
        setAliquotaIrrfStr('0,0');
        setInssDiscount(0);
        setInssEnabled(true);
        setIrrfDiscount(0);
        setIrrfEnabled(false);
        setSindicalDiscount(25.23);
        setSindicalEnabled(true);
        setLastCustomSindical(25.23);
        setAdvancesDiscount(0);
        setCommissionAmount(0);
        setOtherDiscounts(0);
        setAdmissionInfo(null);
        setUseProportionalSalary(false);
      }
      setOvertimeAmount(0);
      setBonusAmount(0);
      setPayrollStatus('pendente');
      setNotes('');
    }
    setIsAddingCommission(false);
    setIsAddingDeduction(false);
    setEditingCommItemId(null);
    setEditingDeductItemId(null);
    setIsModalOpen(true);
  };

  // Inclusão / Edição de Comissão Manual
  const handleSaveCommissionItem = () => {
    if (!newCommDesc.trim() || newCommAmount <= 0) return;
    
    if (editingCommItemId) {
      setCommissionItems(prev => prev.map(it => {
        if (it.id === editingCommItemId) {
          return {
            ...it,
            description: newCommDesc.trim(),
            referenceDate: newCommRef.trim() || currentMonthRef,
            amount: newCommAmount,
          };
        }
        return it;
      }));
    } else {
      const newItem: PayrollCommissionItem = {
        id: `comm_man_${Date.now()}`,
        description: newCommDesc.trim(),
        referenceDate: newCommRef.trim() || currentMonthRef,
        amount: newCommAmount,
        isManual: true,
      };
      setCommissionItems(prev => [...prev, newItem]);
    }

    setEditingCommItemId(null);
    setNewCommDesc('');
    setNewCommRef('');
    setNewCommAmount(0);
    setIsAddingCommission(false);
  };

  const handleStartEditCommission = (item: PayrollCommissionItem) => {
    setEditingCommItemId(item.id);
    setNewCommDesc(item.description);
    setNewCommRef(item.referenceDate || '');
    setNewCommAmount(item.amount);
    setIsAddingCommission(true);
  };

  const handleDeleteCommissionItem = (id: string) => {
    setCommissionItems(prev => prev.filter(it => it.id !== id));
  };

  // Inclusão / Edição de Desconto Manual
  const handleSaveDeductionItem = () => {
    if (!newDeductType || newDeductAmount <= 0) return;

    // Se o usuário tentar incluir taxa sindical manualmente no extrato inferior,
    // direciona para o campo fixo de Taxa Assistencial Sindicato no topo
    if (newDeductDesc.toLowerCase().includes('sindicat') || newDeductDesc.toLowerCase().includes('taxa assist') || newDeductType.toLowerCase().includes('sindicat')) {
      setSindicalEnabled(true);
      setSindicalDiscount(newDeductAmount);
      setLastCustomSindical(newDeductAmount);
      setEditingDeductItemId(null);
      setNewDeductDesc('');
      setNewDeductDate('');
      setNewDeductAmount(0);
      setIsAddingDeduction(false);
      return;
    }

    if (editingDeductItemId) {
      setDeductionItems(prev => prev.map(it => {
        if (it.id === editingDeductItemId) {
          return {
            ...it,
            type: newDeductType,
            description: newDeductDesc.trim() || newDeductType,
            date: newDeductDate.trim() || formatDateBR(new Date().toISOString().split('T')[0]),
            amount: newDeductAmount,
          };
        }
        return it;
      }));
    } else {
      const newItem: PayrollDeductionItem = {
        id: `ded_man_${Date.now()}`,
        type: newDeductType,
        description: newDeductDesc.trim() || newDeductType,
        date: newDeductDate.trim() || formatDateBR(new Date().toISOString().split('T')[0]),
        amount: newDeductAmount,
        isManual: true,
      };
      setDeductionItems(prev => [...prev, newItem]);
    }

    setEditingDeductItemId(null);
    setNewDeductDesc('');
    setNewDeductDate('');
    setNewDeductAmount(0);
    setIsAddingDeduction(false);
  };

  const handleStartEditDeduction = (item: PayrollDeductionItem) => {
    setEditingDeductItemId(item.id);
    setNewDeductType(item.type || 'Vale / Adiantamento');
    setNewDeductDesc(item.description || '');
    setNewDeductDate(item.date || '');
    setNewDeductAmount(item.amount);
    setIsAddingDeduction(true);
  };

  const handleDeleteDeductionItem = (id: string) => {
    setDeductionItems(prev => prev.filter(it => it.id !== id));
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find(e => e.id === selectedEmployeeId);
    if (!emp) return;

    const totalCommissions = commissionItems.reduce((acc, it) => acc + (Number(it.amount) || 0), 0);
    const activeCommission = commissionItems.length > 0 ? totalCommissions : (commissionAmount || 0);

    const cleanDeductionsList = deductionItems.filter(
      it => !it.description?.toLowerCase().includes('sindicat') && 
            !it.description?.toLowerCase().includes('taxa assist') && 
            !it.type?.toLowerCase().includes('sindicat')
    );
    const totalDeductionsList = cleanDeductionsList.reduce((acc, it) => acc + (Number(it.amount) || 0), 0);
    const totalAdv = cleanDeductionsList.length > 0
      ? cleanDeductionsList.filter(it => it.type === 'Vale / Adiantamento').reduce((acc, it) => acc + (Number(it.amount) || 0), 0)
      : (advancesDiscount || 0);
    const totalOth = cleanDeductionsList.length > 0
      ? cleanDeductionsList.filter(it => it.type !== 'Vale / Adiantamento').reduce((acc, it) => acc + (Number(it.amount) || 0), 0)
      : (otherDiscounts || 0);

    const activeInss = inssEnabled ? (inssDiscount || 0) : 0;
    const activeIrrf = irrfEnabled ? (irrfDiscount || 0) : 0;
    const activeSindical = sindicalEnabled ? (sindicalDiscount || 0) : 0;
    const totalGross = (baseSalary || 0) + (overtimeAmount || 0) + (bonusAmount || 0) + activeCommission;
    const totalDeductions = activeInss + activeIrrf + activeSindical + (cleanDeductionsList.length > 0 ? totalDeductionsList : (totalAdv + totalOth));
    const netSalary = Math.max(0, totalGross - totalDeductions);

    const calculatedBase = baseCalculoInssFgts || baseSalaryContratual || baseSalary;
    const calculatedBaseIrrf = Math.max(0, calculatedBase - activeInss);
    const calculatedFaixaIrrf = getFaixaIrrf(calculatedBaseIrrf);
    const calculatedFgtsDoMes = Math.round((calculatedBase * 0.08) * 100) / 100;

    let recordToSave: PayrollRecord;
    let nextList: PayrollRecord[];

    const baseRecordData = {
      companyId: effectiveCompanyId,
      userId: activeUid,
      employeeId: emp.id,
      employeeName: emp.name,
      employeeRole: emp.role,
      referenceMonth: currentMonthRef,
      baseSalary,
      baseSalaryContratual,
      baseCalculoInssFgts: calculatedBase,
      base_inss: calculatedBase,
      aliquota_inss: aliquotaInss,
      aliquotaInss,
      aliquota_sindicato: aliquotaSindicato,
      aliquotaSindicato,
      aliquota_irrf: aliquotaIrrf,
      aliquotaIrrf,
      baseCalculoFgts: calculatedBase,
      fgtsDoMes: calculatedFgtsDoMes,
      baseCalculoIrrf: calculatedBaseIrrf,
      faixaIrrf: calculatedFaixaIrrf,
      overtimeAmount,
      bonusAmount,
      commissionAmount: activeCommission,
      commissionItems,
      inssDiscount: activeInss,
      inssEnabled,
      irrfDiscount: activeIrrf,
      irrfEnabled,
      sindicalDiscount: activeSindical,
      sindicalEnabled,
      taxaSindical: activeSindical,
      daysWorked: admissionInfo?.isAdmittedInCompetenceMonth ? admissionInfo.daysWorked : 30,
      unworkedDays: admissionInfo?.isAdmittedInCompetenceMonth ? admissionInfo.unworkedDays : 0,
      isProportional: useProportionalSalary,
      advancesDiscount: totalAdv,
      otherDiscounts: totalOth,
      deductionItems: cleanDeductionsList,
      netSalary,
      status: payrollStatus,
      notes,
      payload: {
        ...(editingPayroll?.payload || {}),
        baseSalaryContratual,
        baseCalculoInssFgts: calculatedBase,
        base_inss: calculatedBase,
        aliquota_inss: aliquotaInss,
        aliquotaInss,
        aliquota_sindicato: aliquotaSindicato,
        aliquotaSindicato,
        aliquota_irrf: aliquotaIrrf,
        aliquotaIrrf,
        baseCalculoFgts: calculatedBase,
        fgtsDoMes: calculatedFgtsDoMes,
        baseCalculoIrrf: calculatedBaseIrrf,
        faixaIrrf: calculatedFaixaIrrf,
        commissionItems,
        deductionItems: cleanDeductionsList,
        sindicalDiscount: activeSindical,
        sindicalEnabled,
        taxaSindical: activeSindical,
      },
    };

    if (editingPayroll) {
      recordToSave = {
        ...editingPayroll,
        ...baseRecordData,
      };
      nextList = localPayrolls.map(p => p.id === editingPayroll.id ? recordToSave : p);
    } else {
      recordToSave = {
        ...baseRecordData,
        id: `pay_${Date.now()}_${emp.id}`,
        createdAt: new Date().toISOString(),
      };
      nextList = [recordToSave, ...localPayrolls];
    }

    setLocalPayrolls(nextList);
    onSavePayrolls(nextList);
    try {
      localStorage.setItem('colaca_silagem_rh_folhas', JSON.stringify(nextList));
    } catch (_) {}
    setIsModalOpen(false);

    // Gravação direta na tabela public.rh_folhas_pagamento do Supabase (abandonando localStorage)
    if (isSupabaseConfigured) {
      (async () => {
        let uid = activeUid;
        if (!uid) {
          try {
            const { data: authData } = await supabase.auth.getUser();
            uid = authData?.user?.id;
          } catch (_) {}
        }
        let tenantCompanyId = activeCompanyId || companyProfile?.companyId || companyProfile?.id || getActiveCompanyId() || uid || '';
        if (!tenantCompanyId && uid) {
          try {
            const { data: authData } = await supabase.auth.getUser();
            tenantCompanyId = authData?.user?.user_metadata?.company_id || authData?.user?.app_metadata?.company_id || uid;
          } catch (_) {}
        }
        recordToSave.companyId = tenantCompanyId;
        recordToSave.userId = uid;
        if (uid && tenantCompanyId) {
          try {
            const success = await upsertRhFolhasPagamento(recordToSave, uid, tenantCompanyId);
            if (!success) {
              console.error('[PayrollTab] Aviso: Falha ao persistir folha no Supabase para:', recordToSave.employeeName);
            } else {
              console.info('✅ [PayrollTab] Folha persistida com sucesso no Supabase:', recordToSave.employeeName);
              // Dispara evento broadcast imediato para os demais clientes
              try {
                const rtChan = supabase.channel(`rh_folhas_pagamento_rt_${uid}`);
                await rtChan.send({
                  type: 'broadcast',
                  event: 'payroll_updated',
                  payload: recordToSave
                });
                setTimeout(() => {
                  try { supabase.removeChannel(rtChan); } catch (_) {}
                }, 200);
              } catch (_) {}
            }
          } catch (err: any) {
            console.error('[PayrollTab Catch - Erro ao salvar folha de pagamento]:', {
              message: err?.message,
              details: err?.details,
              hint: err?.hint,
              code: err?.code,
              rawError: err,
            });
          }
        }
      })();
    }
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
    const updatedPayrolls = localPayrolls.map(p => {
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
      const fullContractual = emp.salary || emp.baseSalary || 3500;
      const admData = getAdmissionProportionality(emp.admissionDate, currentMonthRef, fullContractual);
      const salary = admData.isAdmittedInCompetenceMonth ? admData.proportionalSalary : fullContractual;
      
      // INTEGRAÇÃO DE VALORES: Apuração ativa de comissões apuradas no mês
      const commData = getEmployeeMonthCommissions(emp.id, currentMonthRef, internalServices, employees);
      const commTotal = commData.total;
      const grossBase = salary + commTotal;

      // REGRA: Apenas colaboradores Registrado (CLT) recebem cálculo automático de INSS, IRRF e Taxa Sindical
      const isClt = isCltContract(emp);
      const inss = isClt ? calculateProgressiveInss(grossBase) : 0;
      const irrf = isClt ? calculateOfficialIrrf(grossBase, inss) : 0;
      const sindical = isClt ? 25.23 : 0;
      
      const empAdvances = advances.filter(a => a.employeeId === emp.id && a.referenceMonth === currentMonthRef);
      const advTotal = empAdvances.reduce((sum, a) => sum + a.amount, 0);
      const net = Math.max(0, grossBase - inss - irrf - sindical - advTotal);

      let initialNote = '';
      if (commTotal > 0) {
        initialNote = `Comissões apuradas: ${formatCurrencyBRL(commTotal)} (${commData.count} OS de silagem)`;
      }
      if (admData.isAdmittedInCompetenceMonth) {
        const admNote = `Admissão em ${formatEmployeeAdmissionDate(admData.admissionDate)}: Proporcional a ${admData.daysWorked}/30 dias`;
        initialNote = initialNote ? `${initialNote} • ${admNote}` : admNote;
      }

      return {
        id: `pay_${Date.now()}_${emp.id}`,
        companyId: effectiveCompanyId,
        userId: activeUid,
        employeeId: emp.id,
        employeeName: emp.name,
        employeeRole: emp.role,
        referenceMonth: currentMonthRef,
        baseSalary: salary,
        baseSalaryContratual: fullContractual,
        baseCalculoInssFgts: fullContractual,
        base_inss: fullContractual,
        aliquota_inss: isClt ? (fullContractual > 0 && inss > 0 ? Number(((inss / fullContractual) * 100).toFixed(2)) : 8.04) : 0,
        aliquotaInss: isClt ? (fullContractual > 0 && inss > 0 ? Number(((inss / fullContractual) * 100).toFixed(2)) : 8.04) : 0,
        aliquota_sindicato: isClt ? 1.0 : 0,
        aliquotaSindicato: isClt ? 1.0 : 0,
        aliquota_irrf: 0,
        aliquotaIrrf: 0,
        baseCalculoFgts: fullContractual,
        fgtsDoMes: Math.round((fullContractual * 0.08) * 100) / 100,
        baseCalculoIrrf: Math.max(0, fullContractual - inss),
        faixaIrrf: getFaixaIrrf(Math.max(0, fullContractual - inss)),
        overtimeAmount: 0,
        bonusAmount: 0,
        commissionAmount: commTotal,
        inssDiscount: inss,
        inssEnabled: isClt,
        irrfDiscount: irrf,
        irrfEnabled: irrf > 0,
        sindicalDiscount: sindical,
        sindicalEnabled: isClt,
        taxaSindical: sindical,
        daysWorked: admData.isAdmittedInCompetenceMonth ? admData.daysWorked : 30,
        unworkedDays: admData.isAdmittedInCompetenceMonth ? admData.unworkedDays : 0,
        isProportional: admData.isAdmittedInCompetenceMonth,
        advancesDiscount: advTotal,
        otherDiscounts: 0,
        netSalary: net,
        status: 'pendente',
        notes: initialNote,
        payload: {
          baseSalaryContratual: fullContractual,
          baseCalculoInssFgts: fullContractual,
          base_inss: fullContractual,
          aliquota_inss: isClt ? (fullContractual > 0 && inss > 0 ? Number(((inss / fullContractual) * 100).toFixed(2)) : 8.04) : 0,
          aliquotaInss: isClt ? (fullContractual > 0 && inss > 0 ? Number(((inss / fullContractual) * 100).toFixed(2)) : 8.04) : 0,
          aliquota_sindicato: isClt ? 1.0 : 0,
          aliquotaSindicato: isClt ? 1.0 : 0,
          aliquota_irrf: 0,
          aliquotaIrrf: 0,
          baseCalculoFgts: fullContractual,
          fgtsDoMes: Math.round((fullContractual * 0.08) * 100) / 100,
          baseCalculoIrrf: Math.max(0, fullContractual - inss),
          faixaIrrf: getFaixaIrrf(Math.max(0, fullContractual - inss)),
        },
        createdAt: new Date().toISOString(),
      };
    });

    const nextList = newRecords.length > 0 ? [...newRecords, ...updatedPayrolls] : updatedPayrolls;
    setLocalPayrolls(nextList);
    onSavePayrolls(nextList);
    try {
      localStorage.setItem('colaca_silagem_rh_folhas', JSON.stringify(nextList));
    } catch (_) {}

    // Gravação direta das folhas geradas no Supabase (abandonando localStorage)
    if (isSupabaseConfigured) {
      (async () => {
        let uid = activeUid;
        if (!uid) {
          try {
            const { data: authData } = await supabase.auth.getUser();
            uid = authData?.user?.id;
          } catch (_) {}
        }
        let tenantCompanyId = activeCompanyId || companyProfile?.companyId || companyProfile?.id || getActiveCompanyId() || uid || '';
        if (!tenantCompanyId && uid) {
          try {
            const { data: authData } = await supabase.auth.getUser();
            tenantCompanyId = authData?.user?.user_metadata?.company_id || authData?.user?.app_metadata?.company_id || uid;
          } catch (_) {}
        }
        if (uid && tenantCompanyId) {
          try {
            const payloadList = nextList.map(item => ({
              ...item,
              companyId: item.companyId || tenantCompanyId,
              userId: item.userId || uid,
            }));
            const success = await upsertRhFolhasPagamento(payloadList, uid, tenantCompanyId);
            if (!success) {
              console.error('[PayrollTab Batch] Falha ao persistir lote de folhas no Supabase.');
            } else {
              console.info(`✅ [PayrollTab Batch] ${nextList.length} folhas sincronizadas com sucesso no Supabase.`);
            }
          } catch (err: any) {
            console.error('[PayrollTab Batch Catch - Erro ao salvar folhas em lote]:', {
              message: err?.message,
              details: err?.details,
              hint: err?.hint,
              code: err?.code,
              rawError: err,
            });
          }
        }
      })();
    }
  };

  const handleToggleStatus = (id: string) => {
    let updatedItem: PayrollRecord | null = null;
    const nextList = localPayrolls.map(p => {
      if (p.id === id) {
        const nextStatus = p.status === 'pago' ? 'pendente' : 'pago';
        updatedItem = {
          ...p,
          companyId: effectiveCompanyId || p.companyId,
          userId: activeUid || p.userId,
          status: nextStatus,
          paymentDate: nextStatus === 'pago' ? new Date().toISOString().split('T')[0] : undefined,
        };
        return updatedItem;
      }
      return p;
    });

    setLocalPayrolls(nextList);
    onSavePayrolls(nextList);

    if (updatedItem && isSupabaseConfigured) {
      (async () => {
        let uid = activeUid;
        if (!uid) {
          try {
            const { data: authData } = await supabase.auth.getUser();
            uid = authData?.user?.id;
          } catch (_) {}
        }
        let tenantCompanyId = activeCompanyId || companyProfile?.companyId || companyProfile?.id || getActiveCompanyId() || uid || '';
        if (!tenantCompanyId && uid) {
          try {
            const { data: authData } = await supabase.auth.getUser();
            tenantCompanyId = authData?.user?.user_metadata?.company_id || authData?.user?.app_metadata?.company_id || uid;
          } catch (_) {}
        }
        if (uid && tenantCompanyId) {
          try {
            const success = await upsertRhFolhasPagamento({
              ...updatedItem!,
              companyId: tenantCompanyId,
              userId: uid
            }, uid, tenantCompanyId);
            if (!success) {
              console.error('[PayrollTab Toggle Status] Falha ao atualizar status da folha no Supabase:', updatedItem?.employeeName);
            } else {
              console.info(`✅ [PayrollTab Toggle Status] Status atualizado no Supabase: ${updatedItem?.employeeName} -> ${updatedItem?.status}`);
            }
          } catch (err: any) {
            console.error('[PayrollTab Toggle Status Catch - Erro ao atualizar status no Supabase]:', {
              message: err?.message,
              details: err?.details,
              hint: err?.hint,
              code: err?.code,
              rawError: err,
            });
          }
        }
      })();
    }
  };

  const handleDelete = async (id: string) => {
    const item = localPayrolls.find(p => p.id === id);
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
      const nextList = localPayrolls.filter(p => p.id !== id);
      setLocalPayrolls(nextList);
      onSavePayrolls(nextList);

      if (isSupabaseConfigured) {
        (async () => {
          let uid = activeUid;
          if (!uid) {
            try {
              const { data: authData } = await supabase.auth.getUser();
              uid = authData?.user?.id;
            } catch (_) {}
          }
          if (uid) {
            await deleteRhFolhaPagamento(id, uid);
          }
        })();
      }
    }
  };

  /**
   * PROJETO DE INTEGRAÇÃO FINANCEIRA (BOTÃO INTEGRAR FOLHA AO CONTAS A PAGAR E DRE):
   * 1. Lê a linha correspondente da folha (item).
   * 2. Lança registro de débito na tabela 'public.financeiro_contas_a_pagar' do Supabase:
   *    - Valor do Título: exatamente a coluna "LÍQUIDO A PAGAR" (netSalary).
   *    - Descrição: "Pagamento de Salário - [Nome] - Competência [MM/AAAA]".
   *    - Categoria: "Despesas com Pessoal / Salários".
   *    - Data de Vencimento: 5º dia útil do mês subsequente à competência.
   * 3. Lança despesa no DRE do Veículo/Máquina vinculado (pelo valor dos Proventos / Custo Total)
   *    ou no DRE Geral da Empresa sob a categoria "Custos Administrativos / Escritório".
   * 4. Muda status da linha para "Integrado" e desabilita o botão para impedir duplicidade.
   */
  const handleIntegrarFolhaFinanceiro = async (item: PayrollRecord) => {
    if (item.status === 'integrado' || item.status === 'lancado' || Boolean(item.isIntegrated)) {
      return;
    }

    setIntegratingId(item.id);
    try {
      const activeTenantId = getActiveCompanyId() || 'default';
      const canonicalId = toValidUUID(item.id);
      const payableId = toValidUUID(`cap_folha_${canonicalId}`);

      // 1. Data de Vencimento: 5º dia útil do mês subsequente à competência da folha
      const dueDateIso = getFifthBusinessDayOfSubsequentMonth(item.referenceMonth);

      // 2. Colaborador ativo e verificação de veículo / maquinário fixo vinculado
      const emp = employees.find(
        (e) => e.id === item.employeeId || e.name.trim().toLowerCase() === item.employeeName.trim().toLowerCase()
      );
      const machineriesList = getStoredMachineries();
      const linkedMachinery = findEmployeeLinkedMachinery(emp, machineriesList);
      const vehicleLabel = linkedMachinery
        ? `${linkedMachinery.name || linkedMachinery.model || 'Veículo'}${
            linkedMachinery.licensePlateOrSerial ? ` (${linkedMachinery.licensePlateOrSerial})` : ''
          }`
        : undefined;

      // 3. Valores da Folha:
      // Valor do Título = exatamente o valor da coluna "LÍQUIDO A PAGAR"
      const netSalaryVal = Math.max(0, Math.round(Number(item.netSalary || 0) * 100) / 100);
      // Proventos (+) / Custo total da folha daquele colaborador
      const additionalEarnings = (item.overtimeAmount || 0) + (item.bonusAmount || 0) + (item.commissionAmount || 0);
      const totalEarningsVal = Math.max(0, Math.round(((item.baseSalary || 0) + additionalEarnings) * 100) / 100);
      const proventosDRE = totalEarningsVal > 0 ? totalEarningsVal : netSalaryVal;

      let compMonthIso = new Date().toISOString().slice(0, 7);
      if (item.referenceMonth.includes('/')) {
        const [m, y] = item.referenceMonth.split('/');
        compMonthIso = `${y}-${m.padStart(2, '0')}`;
      } else if (item.referenceMonth.includes('-')) {
        compMonthIso = item.referenceMonth.slice(0, 7);
      }

      // 4. REGRA DE NEGÓCIO 1: Lançamento no Contas a Pagar (tabela 'public.financeiro_contas_a_pagar' do Supabase)
      await insertFinanceiroContasAPagar({
        id: payableId,
        valor: netSalaryVal,
        descricao: `Pagamento de Salário - ${item.employeeName} - Competência ${item.referenceMonth}`,
        historico: `Pagamento de Salário - ${item.employeeName} - Competência ${item.referenceMonth}`,
        categoria: 'Despesas com Pessoal / Salários',
        categoria_financeira: 'Despesas com Pessoal / Salários',
        centro_custo: linkedMachinery
          ? `DRE Veículo: ${vehicleLabel}`
          : 'Custos Administrativos / Escritório',
        data_vencimento: dueDateIso,
        employee_id: item.employeeId,
        colaborador_id: item.employeeId,
        colaborador_nome: item.employeeName,
        competencia: item.referenceMonth,
        veiculo_id: linkedMachinery?.id,
        placa: linkedMachinery?.licensePlateOrSerial,
        veiculo_nome: vehicleLabel,
        custo_dre: proventosDRE,
      }, activeTenantId);

      // 5. REGRA DE NEGÓCIO 2: Lançamento no DRE do Veículo / DRE Geral da Empresa
      const expenseEntry: Expense = {
        id: payableId,
        companyId: activeTenantId,
        description: linkedMachinery
          ? `Pagamento de Salário - ${item.employeeName} - Competência ${item.referenceMonth} | DRE Veículo: ${vehicleLabel}`
          : `Pagamento de Salário - ${item.employeeName} - Competência ${item.referenceMonth} | Custos Administrativos / Escritório`,
        amount: netSalaryVal,
        dreGrossAmount: proventosDRE,
        dreCategory: linkedMachinery
          ? 'Despesa Operacional de Mão de Obra/Pessoal'
          : 'Custos Administrativos / Escritório',
        competenceMonth: compMonthIso,
        categoryId: linkedMachinery ? 'cat_mao_de_obra' : 'cat_administrativo',
        categoryName: linkedMachinery
          ? 'Despesas com Pessoal / Salários'
          : 'Custos Administrativos / Escritório',
        categoryColor: linkedMachinery ? '#0284c7' : '#64748b',
        dueDate: dueDateIso,
        date: `${compMonthIso}-01`,
        status: 'pendente',
        paymentMethod: 'pix',
        supplier: item.employeeName,
        employeeId: item.employeeId,
        employeeName: item.employeeName,
        machineryId: linkedMachinery?.id,
        machineryName: vehicleLabel,
        costCenterName: linkedMachinery
          ? `DRE Veículo: ${vehicleLabel}`
          : 'Custos Administrativos / Escritório',
        notes: linkedMachinery
          ? `Contas a Pagar: ${formatCurrencyBRL(netSalaryVal)} (Venc. ${formatDateBR(dueDateIso)}) • DRE Veículo: ${vehicleLabel} [${formatCurrencyBRL(proventosDRE)} Bruto]`
          : `Contas a Pagar: ${formatCurrencyBRL(netSalaryVal)} (Venc. ${formatDateBR(dueDateIso)}) • DRE Geral Escritório [${formatCurrencyBRL(proventosDRE)} Bruto]`,
        createdAt: new Date().toISOString(),
      };

      const storedExpenses = getStoredExpenses();
      const existingExpIdx = storedExpenses.findIndex(
        (e) => e.id === payableId || toValidUUID(e.id) === payableId
      );
      let updatedExpenses: Expense[];
      if (existingExpIdx >= 0) {
        updatedExpenses = storedExpenses.map((e, idx) =>
          idx === existingExpIdx ? { ...e, ...expenseEntry } : e
        );
      } else {
        updatedExpenses = [expenseEntry, ...storedExpenses];
      }
      saveStoredExpenses(updatedExpenses);
      if (isSupabaseConfigured) {
        saveCloudExpenses(updatedExpenses, activeTenantId).catch(() => {});
      }
      window.dispatchEvent(new CustomEvent('silagem_expenses_updated', { detail: updatedExpenses }));

      // 6. FEEDBACK VISUAL E TRAVA DE SEGURANÇA:
      // Status da linha muda para "Integrado" e botão fica disabled
      let integratedItem: PayrollRecord | null = null;
      const updatedPayrolls = localPayrolls.map((p) => {
        if (p.id === item.id) {
          integratedItem = {
            ...p,
            status: 'integrado' as const,
            isIntegrated: true,
            integratedAt: new Date().toISOString(),
            financePayableId: payableId,
          };
          return integratedItem;
        }
        return p;
      });
      setLocalPayrolls(updatedPayrolls);
      onSavePayrolls(updatedPayrolls);

      if (integratedItem && isSupabaseConfigured) {
        let uid = activeUid;
        if (!uid) {
          try {
            const { data: authData } = await supabase.auth.getUser();
            uid = authData?.user?.id;
          } catch (_) {}
        }
        let tenantCompanyId = activeCompanyId || companyProfile?.companyId || companyProfile?.id || getActiveCompanyId() || uid || '';
        if (!tenantCompanyId && uid) {
          try {
            const { data: authData } = await supabase.auth.getUser();
            tenantCompanyId = authData?.user?.user_metadata?.company_id || authData?.user?.app_metadata?.company_id || uid;
          } catch (_) {}
        }
        if (uid && tenantCompanyId) {
          upsertRhFolhasPagamento({
            ...integratedItem,
            companyId: tenantCompanyId,
            userId: uid
          }, uid, tenantCompanyId).catch(() => {});
        }
      }

      // 7. Feedback visual de sucesso
      setIntegrationBanner({
        type: 'success',
        title: `Salário Integrado ao Financeiro: ${item.employeeName}`,
        details: linkedMachinery
          ? `Título de ${formatCurrencyBRL(netSalaryVal)} lançado no Contas a Pagar (vencimento em ${formatDateBR(dueDateIso)}) • Custo de ${formatCurrencyBRL(proventosDRE)} lançado no DRE do Veículo [${vehicleLabel}] como Despesa Operacional de Mão de Obra/Pessoal.`
          : `Título de ${formatCurrencyBRL(netSalaryVal)} lançado no Contas a Pagar (vencimento em ${formatDateBR(dueDateIso)}) • Custo de ${formatCurrencyBRL(proventosDRE)} lançado no DRE Geral da Empresa como Custos Administrativos / Escritório.`,
      });
    } catch (err) {
      console.error('Erro na integração financeira:', err);
      setIntegrationBanner({
        type: 'error',
        title: 'Erro na Integração Financeira',
        details: 'Não foi possível concluir o lançamento no Supabase. Verifique a conexão e tente novamente.',
      });
    } finally {
      setIntegratingId(null);
    }
  };

  const totalCommissionsFromItems = commissionItems.reduce((acc, it) => acc + (Number(it.amount) || 0), 0);
  const activeCommissionTotal = commissionItems.length > 0 ? totalCommissionsFromItems : (commissionAmount || 0);
  const modalGrossTotal = (baseSalary || 0) + (overtimeAmount || 0) + (bonusAmount || 0) + activeCommissionTotal;

  const activeInssDiscount = inssEnabled ? (inssDiscount || 0) : 0;
  const activeIrrfDiscount = irrfEnabled ? (irrfDiscount || 0) : 0;
  const activeSindicalDiscount = sindicalEnabled ? (sindicalDiscount || 0) : 0;
  const totalDeductionsFromItems = deductionItems.reduce((acc, it) => acc + (Number(it.amount) || 0), 0);
  const activeListDeductions = deductionItems.length > 0 ? totalDeductionsFromItems : ((advancesDiscount || 0) + (otherDiscounts || 0));
  const modalDiscountsTotal = activeInssDiscount + activeIrrfDiscount + activeSindicalDiscount + activeListDeductions;
  const calculatedModalNet = Math.max(0, modalGrossTotal - modalDiscountsTotal);

  return (
    <div className="space-y-3 sm:space-y-4">
      
      {/* Banner de Feedback da Integração Financeira */}
      {integrationBanner && (
        <div
          className={`p-3 rounded-xl border flex items-start justify-between gap-3 shadow-xs ${
            integrationBanner.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200'
              : integrationBanner.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-950 dark:text-rose-200'
              : 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-950 dark:text-blue-200'
          }`}
        >
          <div className="flex items-start space-x-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-black">{integrationBanner.title}</p>
              <p className="text-[11px] font-medium opacity-90 mt-0.5">{integrationBanner.details}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIntegrationBanner(null)}
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded transition cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

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
                      {item.status === 'integrado' || item.status === 'lancado' || Boolean(item.isIntegrated) ? (
                        <span
                          className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border bg-blue-100 dark:bg-blue-950/70 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-300 shadow-2xs"
                          title="Lançado e integrado ao Contas a Pagar e DRE"
                        >
                          <CheckCircle2 className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                          <span>Integrado</span>
                        </span>
                      ) : (
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
                      )}
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
                      <div>{formatCurrencyBRL((item.irrfDiscount || 0) + ((item as any).sindicalDiscount || (item as any).taxaSindical || 0) + (item.advancesDiscount || 0) + (item.otherDiscounts || 0))}</div>
                      {(((item as any).sindicalDiscount || (item as any).taxaSindical || 0) > 0) && (
                        <div className="text-[10px] text-rose-950 dark:text-rose-300 font-semibold" title="Taxa Assistencial Sindicato">
                          sindicato: {formatCurrencyBRL((item as any).sindicalDiscount || (item as any).taxaSindical)}
                        </div>
                      )}
                    </td>

                    <td className="py-2 px-3 text-right font-black text-black dark:text-white whitespace-nowrap text-xs font-['Outfit']">
                      {formatCurrencyBRL(item.netSalary)}
                    </td>

                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        {/* 1. Botão de Integração Financeira (antes do ícone do olho) */}
                        <button
                          type="button"
                          onClick={() => handleIntegrarFolhaFinanceiro(item)}
                          disabled={item.status === 'integrado' || item.status === 'lancado' || Boolean(item.isIntegrated) || integratingId === item.id}
                          className={`p-1 rounded transition ${
                            item.status === 'integrado' || item.status === 'lancado' || Boolean(item.isIntegrated)
                              ? 'text-slate-400 dark:text-stone-600 opacity-40 cursor-not-allowed'
                              : 'text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-100/70 dark:hover:bg-stone-800 cursor-pointer active:scale-95'
                          }`}
                          title={
                            item.status === 'integrado' || item.status === 'lancado' || Boolean(item.isIntegrated)
                              ? 'Salário já integrado ao Contas a Pagar e DRE do Veículo'
                              : 'Enviar para Contas a Pagar e DRE do Veículo'
                          }
                        >
                          {integratingId === item.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                          ) : (
                            <svg
                              className="w-3.5 h-3.5 shrink-0"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
                              <polyline points="16 6 12 2 8 6" />
                              <line x1="12" y1="2" x2="12" y2="15" />
                            </svg>
                          )}
                        </button>

                        {/* 2. Ícone do Olho (Ver / Imprimir Holerite) */}
                        <button
                          type="button"
                          onClick={() => onViewPayslip(item)}
                          className="p-1 text-black dark:text-sky-400 hover:bg-blue-200/60 dark:hover:bg-stone-800 rounded transition cursor-pointer"
                          title="Ver / Imprimir Holerite"
                        >
                          <Eye className="w-3.5 h-3.5" />
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

      {/* Modal Lançamento / Edição de Folha - Formato Split Screen 50/50 */}
      {isModalOpen && (
        <div 
          id="payroll-edit-modal-overlay" 
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-3 bg-black/60 backdrop-blur-xs overflow-y-auto print:hidden"
        >
          <div className="bg-stone-100 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-2xl w-[96vw] max-w-[1550px] shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150 h-[92vh] max-h-[92vh] flex flex-col print:hidden">
            
            {/* Header com azul padrão #0963cb e texto/ícone em branco #ffffff */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#0963cb] text-white shrink-0 shadow-xs">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight flex items-center gap-2">
                  <span>{editingPayroll ? 'Editar Folha de Pagamento' : 'Lançar Folha de Pagamento'}</span>
                  <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded-full font-mono font-bold">
                    {currentMonthRef}
                  </span>
                </h3>
              </div>
              <div className="flex items-center space-x-2">
                <span className="hidden md:inline-block text-[11px] font-bold text-blue-100 bg-white/10 px-2.5 py-1 rounded-lg">
                  Split Screen • Lançamentos & Espelho do Holerite
                </span>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 text-white hover:bg-white/20 rounded-lg transition cursor-pointer"
                  title="Fechar Modal"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveModal} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* CORPO SPLIT SCREEN: 50% ESQUERDA (LANÇAMENTOS) / 50% DIREITA (ESPELHO DO HOLERITE) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 flex-1 min-h-0 divide-y lg:divide-y-0 lg:divide-x divide-stone-300 dark:divide-stone-700 overflow-hidden">
                
                {/* ======================================================== */}
                {/* COLUNA DA ESQUERDA: Painel de Lançamentos (Slim/Compact) */}
                {/* ======================================================== */}
                <div className="overflow-y-hidden p-2 space-y-1.5 bg-[#e8f1f8] dark:bg-stone-900 text-stone-900 dark:text-stone-100 flex flex-col justify-between">
                  
                  {/* 1. Colaborador & Informações de Enquadramento */}
                  <div className="bg-white dark:bg-stone-800 rounded-xl p-2 border border-stone-300 dark:border-stone-700 shadow-2xs space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-stone-900 dark:text-stone-100">
                        Colaborador / Funcionário <span className="text-rose-600">*</span>
                      </label>
                      <span className="text-[9px] text-stone-500 dark:text-stone-400 font-medium">
                        (Motoristas Terceirizados são geridos no Financeiro)
                      </span>
                    </div>

                    <select
                      value={selectedEmployeeId}
                      onChange={(e) => handleSelectEmployee(e.target.value)}
                      className="w-full px-2 py-1 border border-stone-300 dark:border-stone-600 rounded-lg bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 outline-none focus:ring-1 focus:ring-[#0963cb] text-xs font-semibold shadow-2xs"
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

                    {/* Resumo do Colaborador: Vínculo, Admissão, CPF e Depósito */}
                    {selectedEmployeeId && (() => {
                      const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);
                      if (!selectedEmployee) return null;
                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-0.5 text-xs">
                          <div className="p-1 bg-stone-50 dark:bg-stone-900 rounded border border-stone-200 dark:border-stone-700">
                            <span className="text-[8px] font-bold text-stone-500 uppercase block tracking-wider leading-none">
                              Regime / Vínculo:
                            </span>
                            <span className="font-bold text-stone-900 dark:text-stone-100 text-[10px] block mt-0.5 truncate">
                              {selectedEmployee.role} ({selectedEmployee.contractType || 'CLT'})
                            </span>
                          </div>

                          <div className="p-1 bg-stone-50 dark:bg-stone-900 rounded border border-stone-200 dark:border-stone-700">
                            <span className="text-[8px] font-bold text-stone-500 uppercase block tracking-wider leading-none">
                              CPF / Admissão:
                            </span>
                            <span className="font-bold text-stone-900 dark:text-stone-100 text-[10px] block mt-0.5 truncate">
                              {formatCPF(selectedEmployee.cpf)} • {formatEmployeeAdmissionDate(selectedEmployee.admissionDate)}
                            </span>
                          </div>

                          <div className="p-1 bg-stone-50 dark:bg-stone-900 rounded border border-stone-200 dark:border-stone-700">
                            <span className="text-[8px] font-bold text-stone-500 uppercase block tracking-wider leading-none">
                              Banco para Depósito:
                            </span>
                            <span className="font-bold text-stone-900 dark:text-stone-100 text-[10px] block mt-0.5 truncate" title={formatEmployeeBankDeposit(selectedEmployee)}>
                              {formatEmployeeBankDeposit(selectedEmployee)}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* 2. Bloco de Proventos com Grid 2 Colunas para os Inputs */}
                  <div className="p-2 bg-blue-50/90 dark:bg-stone-850 border border-blue-200 dark:border-stone-700 rounded-xl space-y-1 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold uppercase text-blue-950 dark:text-blue-300 block tracking-wider">
                          Proventos (Vencimentos)
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-blue-200/60 dark:bg-blue-900/60 text-blue-900 dark:text-blue-200 font-bold text-[9.5px] font-['Outfit']">
                          Bruto: {formatMoneyBRL(modalGrossTotal)}
                        </span>
                      </div>
                      {selectedEmployeeId && (
                        <button
                          type="button"
                          onClick={handleSyncButton}
                          className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-white hover:bg-blue-100 dark:bg-stone-800 dark:hover:bg-stone-700 text-[#0963cb] dark:text-sky-400 border border-blue-300 dark:border-blue-600 font-bold text-[10px] shadow-2xs hover:shadow-xs active:scale-98 transition cursor-pointer"
                          title="Sincronizar comissões de OS, adiantamentos e faltas ativas cadastradas no mês"
                        >
                          <RefreshCw className={`w-3 h-3 text-[#0963cb] dark:text-sky-400 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
                          <span>Sincronizar Comissões / Vales</span>
                        </button>
                      )}
                    </div>

                    {/* Destaque Inteligente: Regra de Proporcionalidade da Data de Admissão */}
                    {admissionInfo?.isAdmittedInCompetenceMonth && (
                      <div className="p-1 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300/80 dark:border-amber-800 rounded-lg flex flex-wrap items-center justify-between gap-1 text-[9.5px]">
                        <div className="flex items-center space-x-1.5 text-amber-950 dark:text-amber-200 font-semibold">
                          <Calendar className="w-3 h-3 text-amber-600 shrink-0" />
                          <span>
                            Admissão em <strong>{formatEmployeeAdmissionDate(admissionInfo.admissionDate)}</strong>: Proporcional a <strong>{admissionInfo.daysWorked} de 30 dias</strong> ({formatMoneyBRL(admissionInfo.proportionalSalary)})
                          </span>
                        </div>
                        <div className="flex items-center space-x-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setBaseSalary(admissionInfo.proportionalSalary);
                              setUseProportionalSalary(true);
                            }}
                            className={`px-1.5 py-0.2 rounded text-[9px] font-bold border transition cursor-pointer ${
                              useProportionalSalary 
                                ? 'bg-amber-600 text-white border-amber-700 shadow-2xs' 
                                : 'bg-white hover:bg-amber-100 text-amber-900 border-amber-300'
                            }`}
                          >
                            ✓ Proporcional ({admissionInfo.daysWorked}d)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setBaseSalary(admissionInfo.fullContractualSalary);
                              setUseProportionalSalary(false);
                            }}
                            className={`px-1.5 py-0.2 rounded text-[9px] font-bold border transition cursor-pointer ${
                              !useProportionalSalary 
                                ? 'bg-stone-700 text-white border-stone-800 shadow-2xs' 
                                : 'bg-white hover:bg-stone-100 text-stone-800 border-stone-300'
                            }`}
                          >
                            Integral (30d)
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Grid Compacto de 2 Colunas para os Inputs de Proventos */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <BrlCurrencyInput
                        id="baseSalaryContratual"
                        label="Salário Base Contratual (R$)"
                        value={baseSalaryContratual}
                        onChange={(val) => {
                          setBaseSalaryContratual(val);
                          if (baseCalculoInssFgts === 0 || baseCalculoInssFgts === baseSalaryContratual) {
                            handleBaseCalculoChange(val);
                          }
                        }}
                        title="Valor fixo da ficha do funcionário"
                        inputClassName="border-stone-300 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-bold"
                      />
                      <BrlCurrencyInput
                        id="baseCalculoInssFgts"
                        label="Base Cálc. INSS / FGTS (R$)"
                        value={baseCalculoInssFgts}
                        onChange={handleBaseCalculoChange}
                        title="Valor usado efetivamente no mês para incidir as taxas"
                        inputClassName="border-[#0963cb]/40 bg-blue-50/80 dark:bg-blue-950/40 text-[#0963cb] dark:text-sky-300 font-black focus:ring-[#0963cb]"
                      />
                      <BrlCurrencyInput
                        id="baseSalary"
                        label={admissionInfo?.isAdmittedInCompetenceMonth && useProportionalSalary ? "Salário Base (Proporcional)" : "Salário Base (Folha)"}
                        value={baseSalary}
                        onChange={(val) => {
                          setBaseSalary(val);
                          if (admissionInfo?.isAdmittedInCompetenceMonth) {
                            setUseProportionalSalary(Math.abs(val - admissionInfo.proportionalSalary) < 0.05);
                          }
                        }}
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
                        label={commissionItems.length > 0 ? `Comissões Silagem (${commissionItems.length})` : "Comissões Silagem"}
                        value={activeCommissionTotal}
                        onChange={(val) => {
                          setCommissionAmount(val);
                        }}
                        inputClassName="border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-300 focus:ring-emerald-600 font-bold"
                        headerRight={
                          <span className="text-[9px] font-bold text-emerald-700 font-['Outfit']">
                            {commissionItems.length} item(ns)
                          </span>
                        }
                        title="Valor total apurado ou lançado nas comissões de silagem"
                      />
                    </div>

                    {/* Mini-tabela de Detalhamento de Proventos (Extrato de Comissões) */}
                    <div className="p-1 sm:p-1.5 bg-white/95 dark:bg-stone-800/95 border border-blue-200 dark:border-stone-700 rounded-lg space-y-1 shadow-2xs my-0.5">
                      <div className="flex items-center justify-between pb-0.5 border-b border-blue-100 dark:border-stone-700">
                        <div className="flex items-center space-x-1.5">
                          <FileText className="w-3 h-3 text-[#0963cb] shrink-0" />
                          <span className="text-[9.5px] font-bold uppercase text-blue-950 dark:text-blue-200 tracking-wider">
                            Extrato de Comissões
                          </span>
                          <span className="px-1 py-0.2 rounded bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300 font-extrabold text-[8.5px] font-['Outfit']">
                            + {formatCurrencyBRL(activeCommissionTotal)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingCommission(!isAddingCommission);
                            setEditingCommItemId(null);
                            setNewCommDesc('');
                            setNewCommRef(currentMonthRef);
                            setNewCommAmount(0);
                          }}
                          className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-[#0963cb] border border-blue-300 font-bold text-[9px] transition cursor-pointer shadow-2xs"
                        >
                          <Plus className="w-2.5 h-2.5 text-[#0963cb]" />
                          <span>+ Comissão</span>
                        </button>
                      </div>

                      {/* Formulário de inclusão / edição manual de comissão */}
                      {isAddingCommission && (
                        <div className="p-1.5 bg-blue-50/90 border border-blue-200 rounded-lg space-y-1 animate-in fade-in duration-100">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold uppercase text-blue-950 tracking-wider">
                              {editingCommItemId ? 'Editar Comissão' : 'Nova Comissão Manual'}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setIsAddingCommission(false);
                                setEditingCommItemId(null);
                              }}
                              className="text-stone-500 hover:text-stone-800 text-[9px] font-bold cursor-pointer"
                            >
                              ✕ Fechar
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-1 items-end">
                            <div className="sm:col-span-6">
                              <label className="block text-[8px] font-bold text-stone-700 uppercase mb-0.5">
                                Descrição <span className="text-rose-600">*</span>
                              </label>
                              <input
                                type="text"
                                value={newCommDesc}
                                onChange={(e) => setNewCommDesc(e.target.value)}
                                placeholder="Ex: Ensilagem..."
                                className="w-full px-1.5 py-0.5 bg-white border border-stone-300 rounded text-stone-900 text-xs font-medium outline-none focus:ring-1 focus:ring-[#0963cb]"
                              />
                            </div>
                            <div className="sm:col-span-3">
                              <label className="block text-[8px] font-bold text-stone-700 uppercase mb-0.5">
                                Referência
                              </label>
                              <input
                                type="text"
                                value={newCommRef}
                                onChange={(e) => setNewCommRef(e.target.value)}
                                placeholder="Ex: OS #1042"
                                className="w-full px-1.5 py-0.5 bg-white border border-stone-300 rounded text-stone-900 text-xs font-medium outline-none focus:ring-1 focus:ring-[#0963cb]"
                              />
                            </div>
                            <div className="sm:col-span-3">
                              <BrlCurrencyInput
                                id="newCommAmount"
                                label="Valor (+)"
                                value={newCommAmount}
                                onChange={setNewCommAmount}
                                inputClassName="border-emerald-300 bg-white text-emerald-800 font-bold"
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-end space-x-1 pt-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                setIsAddingCommission(false);
                                setEditingCommItemId(null);
                              }}
                              className="px-1.5 py-0.5 text-stone-600 font-bold hover:bg-stone-200/60 rounded text-[9px] cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveCommissionItem}
                              disabled={!newCommDesc.trim() || newCommAmount <= 0}
                              className="px-2 py-0.5 bg-[#0963cb] hover:bg-[#0852a8] text-white font-bold rounded text-[9.5px] shadow-2xs disabled:opacity-40 cursor-pointer"
                            >
                              {editingCommItemId ? 'Atualizar' : 'Adicionar'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Tabela de Itens de Comissão */}
                      <div className="max-h-16 overflow-y-auto border border-stone-200 rounded bg-stone-50/50">
                        <table className="w-full text-left border-collapse text-[9px]">
                          <thead className="bg-stone-100 text-stone-700 font-bold uppercase text-[7.5px] sticky top-0 border-b border-stone-200 z-10">
                            <tr>
                              <th className="py-1 px-1.5">Descrição</th>
                              <th className="py-1 px-1.5 w-16">Ref.</th>
                              <th className="py-1 px-1.5 text-right w-20">Valor (+)</th>
                              <th className="py-1 px-1.5 text-center w-10">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-200/70 bg-white">
                            {commissionItems.length > 0 ? (
                              commissionItems.map((item) => (
                                <tr key={item.id} className="hover:bg-blue-50/40 transition">
                                  <td className="py-1 px-1.5 font-medium text-stone-900">
                                    <div className="flex items-center space-x-1">
                                      <span className="truncate max-w-[130px] text-[9px]">{item.description}</span>
                                      <span className={`px-1 py-0.2 rounded text-[7px] font-bold shrink-0 ${
                                        item.isManual ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                                      }`}>
                                        {item.isManual ? 'Manual' : 'OS'}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-1 px-1.5 text-stone-600 whitespace-nowrap text-[8.5px]">
                                    {item.referenceDate || currentMonthRef}
                                  </td>
                                  <td className="py-1 px-1.5 text-right font-black text-emerald-800 font-['Outfit'] whitespace-nowrap text-[9px]">
                                    + {formatCurrencyBRL(item.amount)}
                                  </td>
                                  <td className="py-1 px-1.5 text-center whitespace-nowrap">
                                    <div className="flex items-center justify-center space-x-1">
                                      {item.isManual && (
                                        <button
                                          type="button"
                                          onClick={() => handleStartEditCommission(item)}
                                          className="p-0.5 text-stone-500 hover:text-[#0963cb] rounded transition cursor-pointer"
                                          title="Editar"
                                        >
                                          <Edit2 className="w-2.5 h-2.5" />
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteCommissionItem(item.id)}
                                        className="p-0.5 text-stone-400 hover:text-rose-600 rounded transition cursor-pointer"
                                        title="Excluir"
                                      >
                                        <Trash2 className="w-2.5 h-2.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={4} className="py-1 text-center text-stone-500 text-[8.5px]">
                                  Nenhuma comissão lançada nesta competência.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* 3. Bloco de Deduções (Descontos & Impostos) */}
                  <div className="p-2 bg-white dark:bg-stone-800 rounded-xl border border-stone-300 dark:border-stone-700 space-y-1 shadow-2xs">
                    <div className="flex items-center justify-between pb-0.5">
                      <span className="text-xs font-bold uppercase text-stone-900 dark:text-stone-100 tracking-wider block">
                        Deduções (Descontos & Impostos)
                      </span>
                      <span className="text-[9.5px] font-bold text-rose-700 font-['Outfit']">
                        Total Deduções: - {formatMoneyBRL(modalDiscountsTotal)}
                      </span>
                    </div>

                    {/* Linha dos Impostos e Descontos Oficiais (INSS, IRRF e Sindicato) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {/* INSS */}
                      <div className="bg-stone-50 dark:bg-stone-900 p-1.5 rounded-lg border border-stone-200 dark:border-stone-700 space-y-0.5 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-1 flex-wrap">
                            <span className="text-xs font-semibold text-stone-900 dark:text-stone-100">INSS</span>
                            <div className="inline-flex items-center bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-600 rounded px-1 py-0.2 shadow-2xs">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={aliquotaInssStr}
                                onChange={(e) => handleAliquotaInssChange(e.target.value)}
                                disabled={!inssEnabled}
                                className="w-8 text-center font-black text-[10px] text-[#0963cb] dark:text-sky-400 bg-transparent outline-none p-0"
                                title="Alíquota (%)"
                              />
                              <span className="text-[8.5px] font-bold text-stone-500">%</span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={() => {
                                const next = !inssEnabled;
                                setInssEnabled(next);
                                if (next) {
                                  const base = baseCalculoInssFgts || baseSalaryContratual || baseSalary;
                                  const calculated = Math.round((base * (aliquotaInss / 100)) * 100) / 100;
                                  setInssDiscount(calculated > 0 ? calculated : calculateProgressiveInss(base));
                                } else {
                                  setInssDiscount(0);
                                }
                              }}
                              className={`relative inline-flex h-3 w-5.5 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                                inssEnabled ? 'bg-[#0963cb]' : 'bg-stone-300'
                              }`}
                            >
                              <span className={`inline-block h-2 w-2 transform rounded-full bg-white transition duration-200 ease-in-out ${
                                inssEnabled ? 'translate-x-2.5' : 'translate-x-0.5'
                              }`} />
                            </button>
                            <span className={`text-[8px] font-bold ${inssEnabled ? 'text-[#0963cb]' : 'text-stone-400'}`}>
                              {inssEnabled ? 'Ativo' : 'Isento'}
                            </span>
                          </div>
                        </div>

                        <BrlCurrencyInput
                          id="inssDiscount"
                          label=""
                          value={inssDiscount}
                          onChange={handleInssDiscountChange}
                          disabled={!inssEnabled}
                          inputClassName="border-blue-300 bg-white dark:bg-stone-800 text-stone-900 dark:text-white font-bold"
                        />
                      </div>

                      {/* IRRF */}
                      <div className="bg-stone-50 dark:bg-stone-900 p-1.5 rounded-lg border border-stone-200 dark:border-stone-700 space-y-0.5 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-1 flex-wrap">
                            <span className="text-xs font-semibold text-stone-900 dark:text-stone-100">IRRF</span>
                            <div className="inline-flex items-center bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-600 rounded px-1 py-0.2 shadow-2xs">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={aliquotaIrrfStr}
                                onChange={(e) => handleAliquotaIrrfChange(e.target.value)}
                                disabled={!irrfEnabled}
                                className="w-8 text-center font-black text-[10px] text-[#0963cb] dark:text-sky-400 bg-transparent outline-none p-0"
                                title="Alíquota (%)"
                              />
                              <span className="text-[8.5px] font-bold text-stone-500">%</span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={() => {
                                const next = !irrfEnabled;
                                setIrrfEnabled(next);
                                if (next) {
                                  const base = baseCalculoInssFgts || baseSalaryContratual || baseSalary;
                                  const inssVal = inssEnabled ? inssDiscount : 0;
                                  const baseIrrf = Math.max(0, base - inssVal);
                                  const calculated = aliquotaIrrf > 0 
                                    ? Math.round((baseIrrf * (aliquotaIrrf / 100)) * 100) / 100 
                                    : calculateOfficialIrrf(base, inssVal);
                                  setIrrfDiscount(calculated);
                                } else {
                                  setIrrfDiscount(0);
                                }
                              }}
                              className={`relative inline-flex h-3 w-5.5 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                                irrfEnabled ? 'bg-[#0963cb]' : 'bg-stone-300'
                              }`}
                            >
                              <span className={`inline-block h-2 w-2 transform rounded-full bg-white transition duration-200 ease-in-out ${
                                irrfEnabled ? 'translate-x-2.5' : 'translate-x-0.5'
                              }`} />
                            </button>
                            <span className={`text-[8px] font-bold ${irrfEnabled ? 'text-[#0963cb]' : 'text-stone-400'}`}>
                              {irrfEnabled ? 'Ativo' : 'Isento'}
                            </span>
                          </div>
                        </div>

                        <BrlCurrencyInput
                          id="irrfDiscount"
                          label=""
                          value={irrfDiscount}
                          onChange={handleIrrfDiscountChange}
                          disabled={!irrfEnabled}
                          inputClassName="border-blue-300 bg-white dark:bg-stone-800 text-stone-900 dark:text-white font-bold"
                        />
                      </div>

                      {/* Sindicato */}
                      <div className="bg-stone-50 dark:bg-stone-900 p-1.5 rounded-lg border border-stone-200 dark:border-stone-700 space-y-0.5 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-1 flex-wrap">
                            <span className="text-xs font-semibold text-stone-900 dark:text-stone-100 truncate" title="Taxa Assistencial Sindicato">
                              Sindicato
                            </span>
                            <div className="inline-flex items-center bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-600 rounded px-1 py-0.2 shadow-2xs">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={aliquotaSindicatoStr}
                                onChange={(e) => handleAliquotaSindicatoChange(e.target.value)}
                                disabled={!sindicalEnabled}
                                className="w-8 text-center font-black text-[10px] text-[#0963cb] dark:text-sky-400 bg-transparent outline-none p-0"
                                title="Alíquota (%)"
                              />
                              <span className="text-[8.5px] font-bold text-stone-500">%</span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={() => {
                                const next = !sindicalEnabled;
                                setSindicalEnabled(next);
                                if (next) {
                                  const base = baseCalculoInssFgts || baseSalaryContratual || baseSalary;
                                  const calculated = Math.round((base * (aliquotaSindicato / 100)) * 100) / 100;
                                  const restoredVal = calculated > 0 ? calculated : (lastCustomSindical > 0 ? lastCustomSindical : 25.23);
                                  setSindicalDiscount(restoredVal);
                                } else {
                                  if (sindicalDiscount > 0) {
                                    setLastCustomSindical(sindicalDiscount);
                                  }
                                  setSindicalDiscount(0);
                                }
                              }}
                              className={`relative inline-flex h-3 w-5.5 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                                sindicalEnabled ? 'bg-[#0963cb]' : 'bg-stone-300'
                              }`}
                            >
                              <span className={`inline-block h-2 w-2 transform rounded-full bg-white transition duration-200 ease-in-out ${
                                sindicalEnabled ? 'translate-x-2.5' : 'translate-x-0.5'
                              }`} />
                            </button>
                            <span className={`text-[8px] font-bold ${sindicalEnabled ? 'text-[#0963cb]' : 'text-stone-400'}`}>
                              {sindicalEnabled ? 'Ativo' : 'Isento'}
                            </span>
                          </div>
                        </div>

                        <BrlCurrencyInput
                          id="sindicalDiscount"
                          label=""
                          value={sindicalDiscount}
                          onChange={handleSindicalDiscountChange}
                          disabled={!sindicalEnabled}
                          inputClassName="border-blue-300 bg-white dark:bg-stone-800 text-stone-900 dark:text-white font-bold"
                        />
                      </div>
                    </div>

                    {/* Mini-tabela de Detalhamento de Deduções (Extrato de Descontos Ocorridos no Mês) */}
                    <div className="pt-0.5 space-y-1 my-0.5">
                      <div className="flex items-center justify-between pb-0.5 border-b border-stone-200 dark:border-stone-700">
                        <div className="flex items-center space-x-1.5">
                          <CreditCard className="w-3 h-3 text-rose-600 shrink-0" />
                          <span className="text-[9.5px] font-bold uppercase text-stone-900 dark:text-stone-100 tracking-wider">
                            Extrato de Descontos Ocorridos no Mês
                          </span>
                          <span className="px-1 py-0.2 rounded bg-rose-100 text-rose-900 font-extrabold text-[8.5px] font-['Outfit']">
                            - {formatCurrencyBRL(activeListDeductions)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingDeduction(!isAddingDeduction);
                            setEditingDeductItemId(null);
                            setNewDeductType('Vale / Adiantamento');
                            setNewDeductDesc('');
                            setNewDeductDate(formatDateBR(new Date().toISOString().split('T')[0]));
                            setNewDeductAmount(0);
                          }}
                          className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 font-bold text-[9px] transition cursor-pointer shadow-2xs"
                        >
                          <Plus className="w-2.5 h-2.5 text-rose-600" />
                          <span>+ Desconto</span>
                        </button>
                      </div>

                      {/* Formulário de inclusão / edição manual de desconto */}
                      {isAddingDeduction && (
                        <div className="p-1.5 bg-rose-50/80 border border-rose-200 rounded-lg space-y-1 animate-in fade-in duration-100">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold uppercase text-rose-950 tracking-wider">
                              {editingDeductItemId ? 'Editar Desconto' : 'Novo Desconto Manual'}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setIsAddingDeduction(false);
                                setEditingDeductItemId(null);
                              }}
                              className="text-stone-500 hover:text-stone-800 text-[9px] font-bold cursor-pointer"
                            >
                              ✕ Fechar
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-1 items-end">
                            <div className="sm:col-span-3">
                              <label className="block text-[8px] font-bold text-stone-700 uppercase mb-0.5">
                                Tipo
                              </label>
                              <select
                                value={newDeductType}
                                onChange={(e) => setNewDeductType(e.target.value)}
                                className="w-full px-1.5 py-0.5 bg-white border border-stone-300 rounded text-stone-900 text-xs font-semibold outline-none focus:ring-1 focus:ring-rose-600"
                              >
                                <option value="Vale / Adiantamento">Vale / Adiantamento</option>
                                <option value="Peças / Oficina">Peças / Oficina</option>
                                <option value="Combustível">Combustível</option>
                                <option value="Falta / Atraso">Falta / Atraso</option>
                                <option value="Outro Desconto">Outro Desconto</option>
                              </select>
                            </div>
                            <div className="sm:col-span-4">
                              <label className="block text-[8px] font-bold text-stone-700 uppercase mb-0.5">
                                Descrição
                              </label>
                              <input
                                type="text"
                                value={newDeductDesc}
                                onChange={(e) => setNewDeductDesc(e.target.value)}
                                placeholder="Ex: Adiantamento..."
                                className="w-full px-1.5 py-0.5 bg-white border border-stone-300 rounded text-stone-900 text-xs font-medium outline-none focus:ring-1 focus:ring-rose-600"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-[8px] font-bold text-stone-700 uppercase mb-0.5">
                                Data
                              </label>
                              <input
                                type="text"
                                value={newDeductDate}
                                onChange={(e) => setNewDeductDate(e.target.value)}
                                placeholder="Ex: 15/09/2026"
                                className="w-full px-1.5 py-0.5 bg-white border border-stone-300 rounded text-stone-900 text-xs font-medium outline-none focus:ring-1 focus:ring-rose-600"
                              />
                            </div>
                            <div className="sm:col-span-3">
                              <BrlCurrencyInput
                                id="newDeductAmount"
                                label="Valor (-)"
                                value={newDeductAmount}
                                onChange={setNewDeductAmount}
                                inputClassName="border-rose-300 bg-white text-rose-800 font-bold"
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-end space-x-1 pt-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                setIsAddingDeduction(false);
                                setEditingDeductItemId(null);
                              }}
                              className="px-1.5 py-0.5 text-stone-600 font-bold hover:bg-stone-200/60 rounded text-[9px] cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveDeductionItem}
                              disabled={!newDeductType || newDeductAmount <= 0}
                              className="px-2 py-0.5 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded text-[9.5px] shadow-2xs disabled:opacity-40 cursor-pointer"
                            >
                              {editingDeductItemId ? 'Atualizar' : 'Adicionar'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Tabela de Lançamentos de Deduções */}
                      <div className="max-h-16 overflow-y-auto border border-stone-200 rounded bg-stone-50/50">
                        <table className="w-full text-left border-collapse text-[9px]">
                          <thead className="bg-stone-100 text-stone-700 font-bold uppercase text-[7.5px] sticky top-0 border-b border-stone-200 z-10">
                            <tr>
                              <th className="py-1 px-1.5">Tipo / Descrição</th>
                              <th className="py-1 px-1.5 w-16">Data</th>
                              <th className="py-1 px-1.5 text-right w-20">Valor (-)</th>
                              <th className="py-1 px-1.5 text-center w-10">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-200/70 bg-white">
                            {deductionItems.length > 0 ? (
                              deductionItems.map((item) => (
                                <tr key={item.id} className="hover:bg-rose-50/40 transition">
                                  <td className="py-1 px-1.5 font-medium text-stone-900">
                                    <div className="flex items-center space-x-1">
                                      <span className={`px-1 py-0.2 rounded text-[7px] font-bold shrink-0 ${
                                        item.type === 'Vale / Adiantamento'
                                          ? 'bg-rose-100 text-rose-800'
                                          : item.type === 'Falta / Atraso'
                                          ? 'bg-amber-100 text-amber-800'
                                          : 'bg-purple-100 text-purple-800'
                                      }`}>
                                        {item.type}
                                      </span>
                                      <span className="truncate max-w-[130px] text-stone-800 font-semibold text-[9px]" title={item.description}>
                                        {item.description || item.type}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-1 px-1.5 text-stone-600 whitespace-nowrap text-[8.5px]">
                                    {item.date || '-'}
                                  </td>
                                  <td className="py-1 px-1.5 text-right font-black text-rose-700 font-['Outfit'] whitespace-nowrap text-[9px]">
                                    - {formatCurrencyBRL(item.amount)}
                                  </td>
                                  <td className="py-1 px-1.5 text-center whitespace-nowrap">
                                    <div className="flex items-center justify-center space-x-1">
                                      {item.isManual && (
                                        <button
                                          type="button"
                                          onClick={() => handleStartEditDeduction(item)}
                                          className="p-0.5 text-stone-500 hover:text-rose-700 rounded transition cursor-pointer"
                                          title="Editar"
                                        >
                                          <Edit2 className="w-2.5 h-2.5" />
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteDeductionItem(item.id)}
                                        className="p-0.5 text-stone-400 hover:text-rose-600 rounded transition cursor-pointer"
                                        title="Excluir"
                                      >
                                        <Trash2 className="w-2.5 h-2.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={4} className="py-1 text-center text-stone-500 text-[8.5px]">
                                  Nenhum vale ou falta adicionado nesta competência.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* 4. Situação do Pagamento & Observações */}
                  <div className="bg-white dark:bg-stone-800 rounded-xl p-1.5 border border-stone-300 dark:border-stone-700 shadow-2xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-semibold text-stone-900 dark:text-stone-100 tracking-wider">
                          Situação:
                        </span>
                        <div className="flex items-center space-x-2 bg-stone-50 dark:bg-stone-900 px-2 py-0.5 rounded-lg border border-stone-200 dark:border-stone-700">
                          <label className="flex items-center space-x-1 cursor-pointer">
                            <input
                              type="radio"
                              name="status"
                              checked={payrollStatus === 'pendente'}
                              onChange={() => setPayrollStatus('pendente')}
                              className="text-[#0963cb] focus:ring-[#0963cb] accent-[#0963cb] cursor-pointer"
                            />
                            <span className="font-bold text-amber-700 text-xs">A Pagar</span>
                          </label>
                          <label className="flex items-center space-x-1 cursor-pointer">
                            <input
                              type="radio"
                              name="status"
                              checked={payrollStatus === 'pago'}
                              onChange={() => setPayrollStatus('pago')}
                              className="text-[#0963cb] focus:ring-[#0963cb] accent-[#0963cb] cursor-pointer"
                            />
                            <span className="font-bold text-emerald-700 text-xs">Já Pago</span>
                          </label>
                        </div>
                      </div>

                      <div className="flex-1 sm:max-w-xs flex items-center gap-1.5">
                        <label className="text-xs font-semibold text-stone-900 dark:text-stone-100 tracking-wider shrink-0">
                          Obs:
                        </label>
                        <input
                          type="text"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Ex: Pagamento via Pix..."
                          className="w-full px-2 py-1 bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-600 rounded text-stone-900 dark:text-stone-100 text-xs outline-none focus:ring-1 focus:ring-[#0963cb]"
                        />
                      </div>
                    </div>
                  </div>

                </div>

                {/* ======================================================== */}
                {/* COLUNA DA DIREITA: Espelho do Holerite em Tempo Real    */}
                {/* ======================================================== */}
                <div className="overflow-y-auto p-3 sm:p-5 bg-stone-200/90 dark:bg-stone-950 flex flex-col items-center">
                  <LivePayslipPreview
                    companyProfile={companyProfile}
                    employee={employees.find(e => e.id === selectedEmployeeId)}
                    currentMonthRef={currentMonthRef}
                    baseSalary={baseSalary}
                    admissionInfo={admissionInfo}
                    overtimeAmount={overtimeAmount}
                    bonusAmount={bonusAmount}
                    commissionAmount={commissionAmount}
                    commissionItems={commissionItems}
                    activeCommissionTotal={activeCommissionTotal}
                    inssDiscount={inssDiscount}
                    inssEnabled={inssEnabled}
                    aliquotaInssStr={aliquotaInssStr}
                    irrfDiscount={irrfDiscount}
                    irrfEnabled={irrfEnabled}
                    aliquotaIrrfStr={aliquotaIrrfStr}
                    sindicalDiscount={sindicalDiscount}
                    sindicalEnabled={sindicalEnabled}
                    aliquotaSindicatoStr={aliquotaSindicatoStr}
                    deductionItems={deductionItems}
                    advancesDiscount={advancesDiscount}
                    otherDiscounts={otherDiscounts}
                    activeListDeductions={activeListDeductions}
                    modalGrossTotal={modalGrossTotal}
                    modalDiscountsTotal={modalDiscountsTotal}
                    calculatedModalNet={calculatedModalNet}
                    baseCalculoInssFgts={baseCalculoInssFgts}
                    baseSalaryContratual={baseSalaryContratual}
                  />
                </div>

              </div>

              {/* ======================================================== */}
              {/* BARRA INFERIOR DE AÇÕES (Fixa no rodapé do modal)        */}
              {/* ======================================================== */}
              <div className="px-4 py-2.5 bg-white dark:bg-stone-850 border-t border-stone-300 dark:border-stone-700 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-stone-500 font-bold uppercase">Colaborador:</span>
                    <strong className="text-xs text-stone-900 dark:text-stone-100 font-bold">
                      {employees.find(e => e.id === selectedEmployeeId)?.name || 'Nenhum selecionado'}
                    </strong>
                  </div>
                  <div className="h-4 w-px bg-stone-300 dark:bg-stone-700 hidden sm:block" />
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-stone-500 font-bold uppercase">Líquido a Pagar:</span>
                    <strong className="text-sm font-black text-[#0963cb] dark:text-sky-400 font-['Outfit']">
                      {formatMoneyBRL(calculatedModalNet)}
                    </strong>
                  </div>
                </div>

                <div className="flex items-center space-x-2 justify-end">
                  <button
                    type="button"
                    onClick={handlePrintCurrentModalPayroll}
                    disabled={!selectedEmployeeId}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 border border-stone-300 dark:border-stone-600 text-stone-700 dark:text-stone-200 font-bold transition shadow-2xs cursor-pointer text-xs disabled:opacity-40"
                    title="Imprimir Holerite Oficial (Recibo Limpo em PDF)"
                  >
                    <Printer className="w-3.5 h-3.5 text-stone-600 dark:text-stone-300" />
                    <span>Imprimir Holerite</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-3.5 py-1.5 rounded-lg bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-600 text-stone-700 dark:text-stone-200 font-bold hover:bg-stone-50 dark:hover:bg-stone-700 cursor-pointer transition text-xs shadow-2xs"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4.5 py-1.5 rounded-lg bg-[#0963cb] hover:bg-[#0852a8] text-white font-bold transition shadow-xs cursor-pointer text-xs"
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
