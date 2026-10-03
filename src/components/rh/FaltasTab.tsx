import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Search, 
  CalendarX2, 
  Calendar, 
  User, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  Edit2, 
  X, 
  DollarSign, 
  ArrowRight,
  ShieldAlert,
  FileSpreadsheet,
  Check
} from 'lucide-react';
import { Employee, AbsenceRecord, PayrollRecord } from '../../types';
import { 
  formatMoneyBRL, 
  formatEmployeeAdmissionDate,
  getAdmissionProportionality 
} from './payrollHelpers';
import { formatDateBR, formatCurrencyBRL, getActiveCompanyId, saveStoredAbsences } from '../../lib/storage';
import { useConfirm } from '../../context/ConfirmContext';
import { supabase } from '../../lib/supabase';
import { 
  isSupabaseConfigured, 
  fetchCloudAbsences, 
  upsertRhFalta, 
  deleteRhFalta, 
  toValidUUID, 
  mapRowToAbsenceRecord 
} from '../../lib/supabaseService';
import { useAuth } from '../../context/AuthContext';

interface FaltasTabProps {
  employees: Employee[];
  absences: AbsenceRecord[];
  payrolls?: PayrollRecord[];
  currentMonthRef: string;
  onSaveAbsences: (absences: AbsenceRecord[]) => void;
  onApplyDiscountToPayroll?: (absence: AbsenceRecord) => void;
}

export const FaltasTab: React.FC<FaltasTabProps> = ({
  employees,
  absences,
  payrolls = [],
  currentMonthRef,
  onSaveAbsences,
  onApplyDiscountToPayroll,
}) => {
  const { confirm } = useConfirm();
  const { currentUser, companyId: authCompanyId } = useAuth();
  const currentUserId = currentUser?.id;
  const effectiveCompanyId = authCompanyId || currentUserId || getActiveCompanyId() || 'default';

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthRef);
  const [typeFilter, setTypeFilter] = useState<string>('todos');
  const [discountFilter, setDiscountFilter] = useState<string>('todos');

  // 2. LIMPEZA DE CACHE DO ESTADO (STATE RESET):
  // Inicializa com array local vazia (.useState([])) antes de disparar a nova busca reativa,
  // impedindo que dados residuais ou erro 400 travem a renderização da tela.
  const [localAbsences, setLocalAbsences] = useState<AbsenceRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAbsence, setEditingAbsence] = useState<AbsenceRecord | null>(null);

  // Form State
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [date, setDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [daysCount, setDaysCount] = useState<number>(1);
  const [absenceUnit, setAbsenceUnit] = useState<'dias' | 'horas'>('dias');
  const [absenceHours, setAbsenceHours] = useState<number>(2.5);
  const [calculationMemory, setCalculationMemory] = useState<string>('');
  const [type, setType] = useState<AbsenceRecord['type']>('injustificada');
  const [discountPayroll, setDiscountPayroll] = useState<boolean>(true);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [referenceMonth, setReferenceMonth] = useState<string>(currentMonthRef);
  const [status, setStatus] = useState<AbsenceRecord['status']>('pendente');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  const absencesRef = useRef<AbsenceRecord[]>(localAbsences);
  absencesRef.current = localAbsences;

  const onSaveAbsencesRef = React.useRef(onSaveAbsences);
  onSaveAbsencesRef.current = onSaveAbsences;

  // Trava de segurança para carga inicial única das faltas
  const isAbsencesLoadedRef = useRef<string | null>(null);

  // Sincronização em Tempo Real via Realtime Channel apontando estritamente para 'rh_faltas'
  useEffect(() => {
    if (!effectiveCompanyId) return;

    let isMounted = true;
    let debounceTimer: any = null;

    const loadInitialFromSupabase = async () => {
      try {
        setIsLoading(true);
        const fresh = await fetchCloudAbsences(effectiveCompanyId);
        if (!isMounted) return;
        if (Array.isArray(fresh)) {
          setLocalAbsences(fresh);
          saveStoredAbsences(fresh);
          onSaveAbsencesRef.current(fresh);
        }
      } catch (err) {
        if (isMounted) {
          setLocalAbsences([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    if (isAbsencesLoadedRef.current !== effectiveCompanyId) {
      isAbsencesLoadedRef.current = effectiveCompanyId;
      if (isSupabaseConfigured) {
        loadInitialFromSupabase();
      } else {
        setLocalAbsences(Array.isArray(absences) ? absences : []);
        setIsLoading(false);
      }
    }

    // Assinatura com canal estável por tenant (sem Date.now/random) para reaproveitamento de conexão
    const channelTopic = `rh_faltas_tab_${effectiveCompanyId}`;
    const faltasRtChannel = isSupabaseConfigured ? supabase
      .channel(channelTopic)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rh_faltas' },
        (payload: any) => {
          if (!isMounted) return;

          if (payload.eventType === 'DELETE' && payload.old?.id) {
            const deletedId = toValidUUID(payload.old.id);
            setLocalAbsences(prev => {
              const nextList = prev.filter(a => toValidUUID(a.id) !== deletedId);
              saveStoredAbsences(nextList);
              onSaveAbsencesRef.current(nextList);
              return nextList;
            });
            return;
          }

          if (payload.new) {
            const mapped = mapRowToAbsenceRecord(payload.new);
            const mappedId = toValidUUID(mapped.id);
            setLocalAbsences(prev => {
              const exists = prev.some(a => toValidUUID(a.id) === mappedId);
              const nextList = exists
                ? prev.map(a => toValidUUID(a.id) === mappedId ? { ...a, ...mapped, id: mappedId } : a)
                : [{ ...mapped, id: mappedId }, ...prev];
              saveStoredAbsences(nextList);
              onSaveAbsencesRef.current(nextList);
              return nextList;
            });
          }
        }
      )
      .subscribe() : null;

    return () => {
      isMounted = false;
      if (debounceTimer) clearTimeout(debounceTimer);
      if (faltasRtChannel) {
        try {
          supabase.removeChannel(faltasRtChannel);
        } catch (_) {}
      }
    };
  }, [effectiveCompanyId]);

  // 2. AJUSTE DO VALOR DO DIA & 3. HORAS FRACIONADAS (CLT / PROPORCIONALIDADE):
  const calculateAbsenceDiscount = (
    empId: string,
    unit: 'dias' | 'horas',
    days: number,
    hours: number,
    isDiscount: boolean,
    monthRef: string
  ) => {
    const emp = employees.find(e => e.id === empId);
    const contractualSalary = Number(emp?.salary || emp?.baseSalary) || 3500;

    if (!isDiscount || !emp) {
      return {
        discountAmount: 0,
        calculationMemory: 'Desconto não aplicável em folha de pagamento.',
        isProportional: false,
        proportionalSalary: contractualSalary,
        contractualSalary,
        dailyRate: Math.round((contractualSalary / 30) * 100) / 100,
        hourlyRate: Math.round((contractualSalary / 220) * 100) / 100,
        daysWorkedMonth: 30,
        admissionDateFormatted: emp?.admissionDate ? formatEmployeeAdmissionDate(emp.admissionDate) : '',
      };
    }

    // Regra de Proporcionalidade de Admissão:
    // Se o funcionário foi admitido no mês da competência (ex: Admissão em 03/09/2026 para a folha 09/2026),
    // o valor do dia para desconto deve ser calculado dividindo o 'Salário Proporcional do Mês'
    // (R$ 3.733,33 pelos 28 dias trabalhados) por 28, e NÃO o salário contratual cheio (R$ 4.000,00) por 30.
    const admInfo = getAdmissionProportionality(emp.admissionDate, monthRef, contractualSalary);
    const isProportional = admInfo.isAdmittedInCompetenceMonth;
    const baseSalaryToUse = isProportional ? admInfo.proportionalSalary : contractualSalary;
    const daysWorkedInMonth = isProportional ? admInfo.daysWorked : 30;

    const dailyRate = isProportional
      ? (daysWorkedInMonth > 0 ? (baseSalaryToUse / daysWorkedInMonth) : (baseSalaryToUse / 30))
      : (contractualSalary / 30);

    // Regra de Cálculo para Horas: Jornada padrão de 220 horas mensais:
    // Valor da Hora = (Salário Base ou Proporcional / 220).
    // Valor do Desconto = (Valor da Hora * Quantidade de Horas informadas, ex: 2,5).
    const hourlyRate = baseSalaryToUse / 220;

    let calculatedDiscount = 0;
    let memoryText = '';

    const baseLabel = isProportional
      ? `Salário Proporcional Admissão (${formatMoneyBRL(baseSalaryToUse)})`
      : `Salário Base (${formatMoneyBRL(contractualSalary)})`;

    if (unit === 'horas') {
      const validHours = Math.max(0, Number(hours) || 0);
      calculatedDiscount = Math.round((hourlyRate * validHours) * 100) / 100;
      const hoursFormatted = validHours.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
      memoryText = `Base de cálculo: ${baseLabel} | Valor da Hora: ${formatMoneyBRL(hourlyRate)} | Desconto aplicado para ${hoursFormatted} horas.`;
    } else {
      const validDays = Math.max(0, Number(days) || 0);
      calculatedDiscount = Math.round((dailyRate * validDays) * 100) / 100;
      const daysDesc = isProportional && daysWorkedInMonth < 30
        ? `Salário Proporcional Admissão (${formatMoneyBRL(baseSalaryToUse)} pelos ${daysWorkedInMonth} dias trabalhados)`
        : baseLabel;
      memoryText = `Base de cálculo: ${daysDesc} | Valor do Dia: ${formatMoneyBRL(dailyRate)} | Desconto aplicado para ${validDays} dia(s).`;
    }

    return {
      discountAmount: calculatedDiscount,
      calculationMemory: memoryText,
      isProportional,
      proportionalSalary: baseSalaryToUse,
      contractualSalary,
      dailyRate: Math.round(dailyRate * 100) / 100,
      hourlyRate: Math.round(hourlyRate * 100) / 100,
      daysWorkedMonth: daysWorkedInMonth,
      admissionDateFormatted: admInfo.admissionDate ? formatEmployeeAdmissionDate(admInfo.admissionDate) : '',
    };
  };

  const proportionalCalc = calculateAbsenceDiscount(
    selectedEmployeeId,
    absenceUnit,
    daysCount,
    absenceHours,
    discountPayroll,
    referenceMonth
  );

  const handleEmployeeChange = (empId: string) => {
    setSelectedEmployeeId(empId);
    const res = calculateAbsenceDiscount(empId, absenceUnit, daysCount, absenceHours, discountPayroll, referenceMonth);
    setDiscountAmount(res.discountAmount);
    setCalculationMemory(res.calculationMemory);
  };

  const handleUnitChange = (newUnit: 'dias' | 'horas') => {
    setAbsenceUnit(newUnit);
    const res = calculateAbsenceDiscount(selectedEmployeeId, newUnit, daysCount, absenceHours, discountPayroll, referenceMonth);
    setDiscountAmount(res.discountAmount);
    setCalculationMemory(res.calculationMemory);
  };

  const handleHoursChange = (hrs: number) => {
    setAbsenceHours(hrs);
    const res = calculateAbsenceDiscount(selectedEmployeeId, 'horas', daysCount, hrs, discountPayroll, referenceMonth);
    setDiscountAmount(res.discountAmount);
    setCalculationMemory(res.calculationMemory);
  };

  const handleDaysChange = (days: number) => {
    setDaysCount(days);
    if (date && days > 0) {
      const d1 = new Date(date + 'T00:00:00');
      const endD = new Date(d1.getTime() + (days - 1) * 24 * 60 * 60 * 1000);
      setEndDate(endD.toISOString().split('T')[0]);
    }
    const res = calculateAbsenceDiscount(selectedEmployeeId, 'dias', days, absenceHours, discountPayroll, referenceMonth);
    setDiscountAmount(res.discountAmount);
    setCalculationMemory(res.calculationMemory);
  };

  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    if (daysCount === 1 || !endDate) {
      setEndDate(newDate);
    }
  };

  const handleMonthRefChange = (mRef: string) => {
    setReferenceMonth(mRef);
    const res = calculateAbsenceDiscount(selectedEmployeeId, absenceUnit, daysCount, absenceHours, discountPayroll, mRef);
    setDiscountAmount(res.discountAmount);
    setCalculationMemory(res.calculationMemory);
  };

  const handleToggleDiscount = (checked: boolean) => {
    setDiscountPayroll(checked);
    const res = calculateAbsenceDiscount(selectedEmployeeId, absenceUnit, daysCount, absenceHours, checked, referenceMonth);
    setDiscountAmount(res.discountAmount);
    setCalculationMemory(res.calculationMemory);
  };

  const handleResetToCalculated = () => {
    const res = calculateAbsenceDiscount(selectedEmployeeId, absenceUnit, daysCount, absenceHours, discountPayroll, referenceMonth);
    setDiscountAmount(res.discountAmount);
    setCalculationMemory(res.calculationMemory);
  };

  // Filtered List usando a array local reativa com state reset
  const activeAbsences = localAbsences;
  const filtered = activeAbsences.filter(a => {
    const matchesSearch = 
      a.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.reason && a.reason.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (a.notes && a.notes.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesMonth = !selectedMonth || a.referenceMonth === selectedMonth || a.date.startsWith(selectedMonth.split('/').reverse().join('-'));
    const matchesType = typeFilter === 'todos' || a.type === typeFilter;
    const matchesDiscount = 
      discountFilter === 'todos' || 
      (discountFilter === 'com_desconto' && a.discountPayroll) ||
      (discountFilter === 'sem_desconto' && !a.discountPayroll) ||
      (discountFilter === a.status);

    return matchesSearch && matchesMonth && matchesType && matchesDiscount;
  });

  // KPIs for the selected month or total
  const monthAbsences = selectedMonth ? activeAbsences.filter(a => a.referenceMonth === selectedMonth) : activeAbsences;
  const totalOccurrences = monthAbsences.length;
  const unjustifiedCount = monthAbsences.filter(a => a.type === 'injustificada' || a.type === 'suspensao').length;
  const justifiedCount = monthAbsences.filter(a => a.type === 'justificada').length;
  const totalDiscountAmount = monthAbsences
    .filter(a => a.discountPayroll)
    .reduce((sum, a) => sum + (a.discountAmount || 0), 0);

  const handleOpenModal = (item?: AbsenceRecord) => {
    if (item) {
      setEditingAbsence(item);
      setSelectedEmployeeId(item.employeeId);
      setDate(item.date);
      setEndDate(item.endDate || '');
      setDaysCount(item.daysCount || 1);
      const unit = item.absenceUnit || ((item.absenceHours && item.absenceHours > 0) ? 'horas' : 'dias');
      setAbsenceUnit(unit);
      setAbsenceHours(item.absenceHours !== undefined ? Number(item.absenceHours) : 2.5);
      setType(item.type);
      setDiscountPayroll(item.discountPayroll);
      const mRef = item.referenceMonth || currentMonthRef;
      setReferenceMonth(mRef);
      setStatus(item.status);
      setReason(item.reason || '');
      setNotes(item.notes || '');

      const res = calculateAbsenceDiscount(
        item.employeeId,
        unit,
        item.daysCount || 1,
        item.absenceHours || 2.5,
        item.discountPayroll,
        mRef
      );
      setDiscountAmount(item.discountAmount !== undefined ? item.discountAmount : res.discountAmount);
      setCalculationMemory(item.calculationMemory || res.calculationMemory);
    } else {
      setEditingAbsence(null);
      const activeEmps = employees.filter(e => e.status !== 'inativo');
      const firstId = activeEmps.length > 0 ? activeEmps[0].id : '';
      setSelectedEmployeeId(firstId);
      const today = new Date().toISOString().split('T')[0];
      setDate(today);
      setEndDate(today);
      setDaysCount(1);
      setAbsenceUnit('dias');
      setAbsenceHours(2.5);
      setType('injustificada');
      setDiscountPayroll(true);
      setReferenceMonth(currentMonthRef);
      setStatus('pendente');
      setReason('');
      setNotes('');

      if (firstId) {
        const res = calculateAbsenceDiscount(firstId, 'dias', 1, 2.5, true, currentMonthRef);
        setDiscountAmount(res.discountAmount);
        setCalculationMemory(res.calculationMemory);
      } else {
        setDiscountAmount(0);
        setCalculationMemory('');
      }
    }
    setIsModalOpen(true);
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find(e => e.id === selectedEmployeeId);
    if (!emp) return;

    const calc = calculateAbsenceDiscount(
      selectedEmployeeId,
      absenceUnit,
      daysCount,
      absenceHours,
      discountPayroll,
      referenceMonth
    );

    let recordToSave: AbsenceRecord;
    let nextList: AbsenceRecord[];

    const finalMemory = discountPayroll ? (calculationMemory || calc.calculationMemory) : undefined;
    const finalHours = absenceUnit === 'horas' ? Number(absenceHours) : undefined;

    if (editingAbsence) {
      recordToSave = {
        ...editingAbsence,
        companyId: effectiveCompanyId,
        userId: currentUserId,
        employeeId: emp.id,
        employeeName: emp.name,
        employeeRole: emp.role,
        date,
        endDate: endDate || undefined,
        daysCount: absenceUnit === 'horas' ? 1 : daysCount,
        absenceUnit,
        absenceHours: finalHours,
        calculationMemory: finalMemory,
        isProportionalAdmission: calc.isProportional,
        proportionalBaseSalary: calc.isProportional ? calc.proportionalSalary : undefined,
        type,
        discountPayroll,
        discountAmount: discountPayroll ? discountAmount : 0,
        referenceMonth,
        status,
        reason: reason || undefined,
        notes: notes || undefined,
        updatedAt: new Date().toISOString(),
      };
      nextList = localAbsences.map(a => a.id === editingAbsence.id ? recordToSave : a);
    } else {
      recordToSave = {
        id: toValidUUID(`abs_${Date.now()}_${emp.id}`),
        companyId: effectiveCompanyId,
        userId: currentUserId,
        employeeId: emp.id,
        employeeName: emp.name,
        employeeRole: emp.role,
        date,
        endDate: endDate || undefined,
        daysCount: absenceUnit === 'horas' ? 1 : daysCount,
        absenceUnit,
        absenceHours: finalHours,
        calculationMemory: finalMemory,
        isProportionalAdmission: calc.isProportional,
        proportionalBaseSalary: calc.isProportional ? calc.proportionalSalary : undefined,
        type,
        discountPayroll,
        discountAmount: discountPayroll ? discountAmount : 0,
        referenceMonth,
        status,
        reason: reason || undefined,
        notes: notes || undefined,
        createdAt: new Date().toISOString(),
      };
      nextList = [recordToSave, ...localAbsences];
    }

    setLocalAbsences(nextList);
    onSaveAbsences(nextList);
    saveStoredAbsences(nextList);
    setIsModalOpen(false);

    // Gravação e sincronização imediata na tabela public.rh_faltas do Supabase
    if (isSupabaseConfigured) {
      upsertRhFalta(recordToSave, currentUserId, effectiveCompanyId).catch(err => {
        console.error('[FaltasTab] Erro ao salvar ocorrência em rh_faltas:', err);
      });
    }
  };

  const handleDelete = async (id: string) => {
    const isOk = await confirm({
      title: 'Excluir Ocorrência',
      message: 'Deseja remover este registro de falta/ausência? Se ela já foi descontada na folha, os valores deverão ser revistos manualmente.',
      confirmLabel: 'Sim, excluir',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });
    if (isOk) {
      const nextList = localAbsences.filter(a => a.id !== id);
      setLocalAbsences(nextList);
      onSaveAbsences(nextList);
      saveStoredAbsences(nextList);

      // Exclusão imediata na tabela public.rh_faltas do Supabase
      if (isSupabaseConfigured) {
        deleteRhFalta(id, currentUserId).catch(err => {
          console.error('[FaltasTab] Erro ao excluir falta em rh_faltas:', err);
        });
      }
    }
  };

  const handleMarkAsDiscounted = (item: AbsenceRecord) => {
    const updatedItem: AbsenceRecord = {
      ...item,
      status: 'descontada' as const,
      updatedAt: new Date().toISOString(),
    };
    const updated = localAbsences.map(a => a.id === item.id ? updatedItem : a);
    setLocalAbsences(updated);
    onSaveAbsences(updated);
    saveStoredAbsences(updated);

    if (isSupabaseConfigured) {
      upsertRhFalta(updatedItem, currentUserId, effectiveCompanyId).catch(err => {
        console.error('[FaltasTab] Erro ao atualizar status em rh_faltas:', err);
      });
    }

    if (onApplyDiscountToPayroll) {
      onApplyDiscountToPayroll(item);
    }
  };

  return (
    <div className="w-full max-w-none space-y-4 text-black dark:text-white">
      
      {/* 4 Cards de Métricas (Pink / Rose Theme) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-4 shadow-xs flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-pink-100/90 dark:bg-pink-950/60 border border-pink-300 dark:border-pink-800 flex items-center justify-center text-pink-700 dark:text-pink-300 shrink-0">
            <CalendarX2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-black dark:text-stone-300 uppercase tracking-wider block">
              Faltas no Mês ({selectedMonth})
            </span>
            <span className="text-2xl font-black text-black dark:text-white mt-0.5 block font-['Outfit']">
              {totalOccurrences}
            </span>
          </div>
        </div>

        <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-4 shadow-xs flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-rose-100/80 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 flex items-center justify-center text-rose-700 dark:text-rose-300 shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-black dark:text-stone-300 uppercase tracking-wider block">
              Injustificadas / Suspensões
            </span>
            <span className="text-2xl font-black text-black dark:text-rose-400 mt-0.5 block font-['Outfit']">
              {unjustifiedCount}
            </span>
          </div>
        </div>

        <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-4 shadow-xs flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-100/80 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 flex items-center justify-center text-emerald-800 dark:text-emerald-300 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-black dark:text-stone-300 uppercase tracking-wider block">
              Justificadas / Abonadas
            </span>
            <span className="text-2xl font-black text-black dark:text-emerald-400 mt-0.5 block font-['Outfit']">
              {justifiedCount}
            </span>
          </div>
        </div>

        <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-4 shadow-xs flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-100/80 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 flex items-center justify-center text-amber-800 dark:text-amber-300 shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-black dark:text-stone-300 uppercase tracking-wider block">
              Descontos em Folha (R$)
            </span>
            <span className="text-xl sm:text-2xl font-black text-black dark:text-rose-400 mt-0.5 block font-['Outfit']">
              {formatCurrencyBRL(totalDiscountAmount)}
            </span>
          </div>
        </div>

      </div>

      {/* Barra de Filtros & Ações */}
      <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-3 sm:p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Competência Mês */}
          <div className="flex items-center space-x-1.5 bg-white border border-stone-300 px-2.5 py-1.5 rounded-lg">
            <Calendar className="w-3.5 h-3.5 text-black/60" />
            <span className="text-[11px] font-bold text-black">Mês:</span>
            <input
              type="text"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              placeholder="MM/YYYY"
              className="w-20 text-xs font-bold text-black outline-none"
            />
          </div>

          {/* Campo de Busca */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 text-black/60 dark:text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar colaborador ou motivo..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-stone-300 rounded-lg text-black text-xs placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-pink-600 font-medium"
            />
          </div>

          {/* Filtro por Tipo */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-black text-xs font-medium outline-none focus:ring-1 focus:ring-pink-600 cursor-pointer"
          >
            <option value="todos">Todos os Tipos</option>
            <option value="injustificada">Falta Injustificada</option>
            <option value="justificada">Falta Justificada</option>
            <option value="atraso">Atraso Expressivo</option>
            <option value="suspensao">Suspensão Disciplinar</option>
          </select>

          {/* Filtro por Desconto */}
          <select
            value={discountFilter}
            onChange={(e) => setDiscountFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-black text-xs font-medium outline-none focus:ring-1 focus:ring-pink-600 cursor-pointer"
          >
            <option value="todos">Todos os Descontos</option>
            <option value="com_desconto">Com Desconto em Folha</option>
            <option value="sem_desconto">Sem Desconto (Abonada)</option>
            <option value="descontada">Já Descontada na Folha</option>
            <option value="pendente">Pendente de Aplicação</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => handleOpenModal()}
          className="inline-flex items-center justify-center space-x-1.5 px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold transition shadow-xs cursor-pointer active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Falta</span>
        </button>

      </div>

      {/* Tabela de Faltas */}
      <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-blue-100/60 dark:bg-stone-800 text-[11px] font-black text-black dark:text-white uppercase tracking-wider border-b border-blue-200/80 dark:border-stone-700">
              <tr>
                <th className="py-2.5 px-3">Situação</th>
                <th className="py-2.5 px-3">Colaborador</th>
                <th className="py-2.5 px-3">Tipo de Falta</th>
                <th className="py-2.5 px-3 text-center">Data / Período</th>
                <th className="py-2.5 px-3 text-center">Qtd. Dias</th>
                <th className="py-2.5 px-3">Motivo / Justificativa</th>
                <th className="py-2.5 px-3 text-right">Desconto Estimado</th>
                <th className="py-2.5 px-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-200/60 dark:divide-stone-800">
              {filtered.length > 0 ? (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-blue-200/40 dark:hover:bg-stone-800/60 transition">
                    <td className="py-2 px-3">
                      <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        item.status === 'descontada'
                          ? 'bg-emerald-100 border-emerald-300 text-emerald-900'
                          : item.status === 'abonada'
                          ? 'bg-blue-100 border-blue-300 text-blue-900'
                          : 'bg-amber-100 border-amber-300 text-amber-900'
                      }`}>
                        {item.status === 'descontada' ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Descontada</span>
                          </>
                        ) : item.status === 'abonada' ? (
                          <>
                            <Check className="w-3 h-3" />
                            <span>Abonada</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3" />
                            <span>Pendente</span>
                          </>
                        )}
                      </span>
                    </td>

                    <td className="py-2 px-3">
                      <div className="font-bold text-black dark:text-white">
                        {item.employeeName}
                      </div>
                      <div className="text-[10px] text-black/80 dark:text-stone-300 font-medium">
                        {item.employeeRole} • Comp: {item.referenceMonth}
                      </div>
                    </td>

                    <td className="py-2 px-3">
                      <span className={`font-bold px-2 py-0.5 rounded-md text-[11px] ${
                        item.type === 'injustificada'
                          ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-900 dark:text-rose-300'
                          : item.type === 'suspensao'
                          ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-900 dark:text-purple-300'
                          : item.type === 'atraso'
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300'
                          : 'bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200'
                      }`}>
                        {item.type === 'injustificada' && 'Falta Injustificada'}
                        {item.type === 'justificada' && 'Falta Justificada'}
                        {item.type === 'atraso' && 'Atraso Expressivo'}
                        {item.type === 'suspensao' && 'Suspensão'}
                      </span>
                    </td>

                    <td className="py-2 px-3 text-center text-black dark:text-stone-200 font-medium">
                      {formatDateBR(item.date)}
                      {item.endDate && item.endDate !== item.date && (
                        <> até {formatDateBR(item.endDate)}</>
                      )}
                    </td>

                    <td className="py-2 px-3 text-center">
                      <span className="font-bold text-black dark:text-white">
                        {item.absenceUnit === 'horas'
                          ? `${Number(item.absenceHours || item.daysCount).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} hora(s)`
                          : `${item.daysCount} dia(s)`}
                      </span>
                      {item.absenceUnit === 'horas' && (
                        <span className="block text-[9.5px] text-blue-900 dark:text-blue-300 font-semibold">
                          (Horas fracionadas)
                        </span>
                      )}
                    </td>

                    <td className="py-2 px-3 max-w-xs">
                      <div className="text-black dark:text-stone-200 font-medium truncate">
                        {item.reason || 'Sem justificativa informada'}
                      </div>
                      {item.notes && (
                        <div className="text-[10px] text-black/75 dark:text-stone-400 truncate">
                          {item.notes}
                        </div>
                      )}
                    </td>

                    <td className="py-2 px-3 text-right">
                      {item.discountPayroll && item.discountAmount ? (
                        <div>
                          <span className="font-bold text-rose-900 dark:text-rose-400 font-['Outfit']">
                            - {formatMoneyBRL(item.discountAmount)}
                          </span>
                          {item.calculationMemory && (
                            <span 
                              className="block text-[9px] text-stone-600 dark:text-stone-400 truncate max-w-[170px] ml-auto cursor-help"
                              title={item.calculationMemory}
                            >
                              {item.calculationMemory}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-stone-500 font-medium text-[11px]">
                          Isento (R$ 0,00)
                        </span>
                      )}
                    </td>

                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        {item.discountPayroll && item.status !== 'descontada' && (
                          <button
                            type="button"
                            onClick={() => handleMarkAsDiscounted(item)}
                            className="p-1 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-100/60 rounded transition cursor-pointer"
                            title="Marcar como Descontada na Folha"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenModal(item)}
                          className="p-1 text-black/70 hover:text-black dark:text-stone-400 dark:hover:text-white hover:bg-blue-200/50 dark:hover:bg-stone-800 rounded transition cursor-pointer"
                          title="Editar Registro"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="p-1 text-rose-600 hover:text-rose-700 hover:bg-rose-100/50 dark:hover:bg-rose-950/50 rounded transition cursor-pointer"
                          title="Excluir Registro"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-black/70 dark:text-stone-400 font-medium">
                    Nenhuma falta ou ocorrência encontrada para o filtro selecionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 1. Modal: Cadastro / Edição de Falta (Ampliado em max-w-5xl / ERP Corporativo) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="crm-card bg-[#87AFE3] border border-blue-200/80 rounded-2xl w-[92%] max-w-5xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            
            {/* Header Corporativo ERP */}
            <div className="flex items-center justify-between px-6 py-4 bg-[#0963cb] text-white">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/10 rounded-lg">
                  <CalendarX2 className="w-5 h-5 text-pink-300" />
                </div>
                <div>
                  <h3 className="font-bold text-base">
                    {editingAbsence ? 'Editar Falta / Ocorrência' : 'Registrar Falta / Ocorrência'}
                  </h3>
                  <p className="text-xs text-blue-100 font-medium">
                    Lançamento corporativo com cálculo de horas fracionadas, proporcionalidade de admissão e reflexos na folha
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="p-5 sm:p-6 space-y-4 text-xs bg-[#b0d2ed] max-h-[85vh] overflow-y-auto">
              
              {/* CARD 1: DADOS DO COLABORADOR, COMPETÊNCIA E SITUAÇÃO */}
              <div className="bg-white border border-stone-300 rounded-xl p-4 shadow-xs">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-start">
                  
                  {/* Colaborador */}
                  <div className="md:col-span-6">
                    <label className="block font-bold text-black mb-1">
                      Colaborador / Funcionário <span className="text-rose-600">*</span>
                    </label>
                    <select
                      value={selectedEmployeeId}
                      onChange={(e) => handleEmployeeChange(e.target.value)}
                      className="w-full p-2.5 border border-stone-300 rounded-lg bg-white text-black outline-none focus:ring-1 focus:ring-[#0963cb] font-semibold text-xs"
                      required
                    >
                      <option value="">Selecione um funcionário...</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} ({emp.role}) - Salário Base: {formatMoneyBRL(emp.salary || emp.baseSalary || 3500)}
                          {emp.admissionDate ? ` • Adm: ${formatDateBR(emp.admissionDate)}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Competência da Folha */}
                  <div className="md:col-span-3">
                    <label className="block font-bold text-black mb-1">
                      Competência da Folha <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={referenceMonth}
                      onChange={(e) => handleMonthRefChange(e.target.value)}
                      placeholder="MM/AAAA (ex: 09/2026)"
                      className="w-full p-2.5 border border-stone-300 rounded-lg bg-white text-black font-bold outline-none focus:ring-1 focus:ring-[#0963cb] text-xs"
                      required
                    />
                  </div>

                  {/* Situação / Status */}
                  <div className="md:col-span-3">
                    <label className="block font-bold text-black mb-1">
                      Situação / Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full p-2.5 border border-stone-300 rounded-lg bg-white text-black font-bold outline-none focus:ring-1 focus:ring-[#0963cb] text-xs"
                    >
                      <option value="pendente">Pendente de Aplicação</option>
                      <option value="descontada">Já Descontada na Folha</option>
                      <option value="justificada">Justificada pela Diretoria</option>
                      <option value="abonada">Abonada (Sem Prejuízo)</option>
                    </select>
                  </div>

                </div>

                {/* ALERTA DE PROPORCIONALIDADE DE ADMISSÃO */}
                {proportionalCalc.isProportional && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start space-x-2.5">
                    <AlertCircle className="w-4 h-4 text-[#0963cb] shrink-0 mt-0.5" />
                    <div className="text-[11px] text-blue-900 leading-relaxed">
                      <span className="font-bold">Regra de Proporcionalidade de Admissão:</span> Colaborador admitido no mês em{' '}
                      <strong>{proportionalCalc.admissionDateFormatted}</strong>. Salário Proporcional da competência:{' '}
                      <strong className="text-blue-950">{formatMoneyBRL(proportionalCalc.proportionalSalary)}</strong>{' '}
                      ({proportionalCalc.daysWorkedMonth} dias trabalhados de 30). O valor do dia é calculado por{' '}
                      <strong>{proportionalCalc.daysWorkedMonth}</strong> e a hora pela jornada padrão de <strong>220h</strong>.
                    </div>
                  </div>
                )}
              </div>

              {/* GRID PARALELO DE 2 COLUNAS (PADRÃO CORPORATIVO ERP) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                
                {/* COLUNA ESQUERDA: ENQUADRAMENTO DA OCORRÊNCIA E MEDIÇÃO */}
                <div className="bg-white border border-stone-300 rounded-xl p-4 shadow-xs space-y-3.5">
                  <div className="flex items-center space-x-2 border-b border-stone-200 pb-2">
                    <Calendar className="w-4 h-4 text-[#0963cb]" />
                    <span className="font-black text-black uppercase tracking-wider text-[11px]">
                      Enquadramento & Medição da Ausência
                    </span>
                  </div>

                  {/* Tipo da Ocorrência */}
                  <div>
                    <label className="block font-bold text-black mb-1">
                      Tipo da Ocorrência <span className="text-rose-600">*</span>
                    </label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value as any)}
                      className="w-full p-2.5 border border-stone-300 rounded-lg bg-white text-black outline-none focus:ring-1 focus:ring-[#0963cb] font-semibold text-xs"
                      required
                    >
                      <option value="injustificada">Falta Injustificada</option>
                      <option value="justificada">Falta Justificada (Sem desconto ou abonada)</option>
                      <option value="atraso">Atraso Expressivo / Saída Antecipada</option>
                      <option value="suspensao">Suspensão Disciplinar</option>
                    </select>
                  </div>

                  {/* Datas */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-black mb-1">
                        Data Inicial da Ausência <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => handleDateChange(e.target.value)}
                        className="w-full p-2 border border-stone-300 rounded-lg bg-white text-black font-medium outline-none focus:ring-1 focus:ring-[#0963cb]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-black mb-1">
                        Data Final
                      </label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full p-2 border border-stone-300 rounded-lg bg-white text-black font-medium outline-none focus:ring-1 focus:ring-[#0963cb]"
                      />
                    </div>
                  </div>

                  {/* 3. UNIDADE DE MEDIDA: SELETOR TOGGLE [ Dia Todo ] ou [ Horas ] */}
                  <div>
                    <label className="block font-bold text-black mb-1.5">
                      Tipo de Ausência (Unidade de Medida) <span className="text-rose-600">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2 p-1 bg-stone-100 border border-stone-300 rounded-xl">
                      <button
                        type="button"
                        onClick={() => handleUnitChange('dias')}
                        className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center space-x-2 transition cursor-pointer ${
                          absenceUnit === 'dias'
                            ? 'bg-[#0963cb] text-white shadow-xs'
                            : 'text-stone-700 hover:text-black hover:bg-stone-200/60'
                        }`}
                      >
                        <span>📅 Dia Todo</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUnitChange('horas')}
                        className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center space-x-2 transition cursor-pointer ${
                          absenceUnit === 'horas'
                            ? 'bg-[#0963cb] text-white shadow-xs'
                            : 'text-stone-700 hover:text-black hover:bg-stone-200/60'
                        }`}
                      >
                        <span>⏱️ Horas</span>
                      </button>
                    </div>
                  </div>

                  {/* QUANTIDADE CONFORME UNIDADE */}
                  {absenceUnit === 'dias' ? (
                    <div>
                      <label className="block font-bold text-black mb-1">
                        Dias de Ausência (Números Inteiros) <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={daysCount || ''}
                        onChange={(e) => handleDaysChange(parseInt(e.target.value) || 1)}
                        className="w-full p-2.5 border border-stone-300 rounded-lg bg-white text-black font-bold outline-none focus:ring-1 focus:ring-[#0963cb] text-sm"
                        required
                      />
                      <span className="text-[10px] text-stone-500 mt-1 block">
                        Cálculo diário proporcional aos dias trabalhados do mês.
                      </span>
                    </div>
                  ) : (
                    <div>
                      <label className="block font-bold text-black mb-1">
                        Quantidade de Horas (Horas Fracionadas) <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={absenceHours !== undefined ? absenceHours : ''}
                        onChange={(e) => handleHoursChange(parseFloat(e.target.value) || 0)}
                        placeholder="Ex: 2.5 (duas horas e meia), 4.0..."
                        className="w-full p-2.5 border border-stone-300 rounded-lg bg-white text-black font-bold outline-none focus:ring-1 focus:ring-[#0963cb] text-sm"
                        required
                      />
                      <span className="text-[10px] text-stone-500 mt-1 block">
                        Aceita frações decimais (ex: 2.5 horas, 4 horas). Jornada padrão: 220 horas mensais.
                      </span>
                    </div>
                  )}

                  {/* Motivo e Observações */}
                  <div className="space-y-2.5 pt-1">
                    <div>
                      <label className="block font-bold text-black mb-1">
                        Motivo Apresentado / Relato da Falta
                      </label>
                      <input
                        type="text"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Ex: Não compareceu ao corte de silagem / Atraso no início do turno..."
                        className="w-full p-2 border border-stone-300 rounded-lg bg-white text-black outline-none focus:ring-1 focus:ring-[#0963cb] text-xs font-medium"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-black mb-1">
                        Observações Internas (RH / Supervisão de Campo)
                      </label>
                      <textarea
                        rows={2}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full p-2 border border-stone-300 rounded-lg bg-white text-black outline-none focus:ring-1 focus:ring-[#0963cb] resize-none text-xs"
                        placeholder="Registro sobre contato, advertência aplicada, compensação de jornada..."
                      />
                    </div>
                  </div>

                </div>

                {/* COLUNA DIREITA: REFLEXO FINANCEIRO & MEMÓRIA DE CÁLCULO TRANSPARENTE */}
                <div className="bg-white border border-stone-300 rounded-xl p-4 shadow-xs flex flex-col justify-between space-y-3.5">
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                      <div className="flex items-center space-x-2">
                        <DollarSign className="w-4 h-4 text-emerald-700" />
                        <span className="font-black text-black uppercase tracking-wider text-[11px]">
                          Reflexo Financeiro na Folha de Pagamento
                        </span>
                      </div>
                      <label className="flex items-center space-x-2 cursor-pointer bg-stone-50 px-2.5 py-1 rounded-lg border border-stone-300 hover:bg-stone-100 transition">
                        <input
                          type="checkbox"
                          checked={discountPayroll}
                          onChange={(e) => handleToggleDiscount(e.target.checked)}
                          className="rounded text-pink-600 focus:ring-pink-500 w-4 h-4 cursor-pointer"
                        />
                        <span className="font-bold text-xs text-black">
                          Aplicar Desconto
                        </span>
                      </label>
                    </div>

                    {discountPayroll ? (
                      <div className="space-y-3">
                        
                        {/* Tabela de bases apuradas */}
                        <div className="grid grid-cols-2 gap-2.5 bg-stone-50 p-3 rounded-xl border border-stone-200">
                          <div>
                            <span className="text-[10px] text-stone-500 font-bold block uppercase tracking-wider">
                              Salário Contratual Cheio
                            </span>
                            <span className="text-xs font-bold text-black">
                              {formatMoneyBRL(proportionalCalc.contractualSalary)}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] text-stone-500 font-bold block uppercase tracking-wider">
                              Base Utilizada no Cálculo
                            </span>
                            <span className="text-xs font-bold text-blue-900">
                              {formatMoneyBRL(proportionalCalc.proportionalSalary)}
                              {proportionalCalc.isProportional && (
                                <span className="text-[10px] text-blue-700 block font-normal">
                                  (Proporcional Admissão)
                                </span>
                              )}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] text-stone-500 font-bold block uppercase tracking-wider">
                              Valor do Dia de Trabalho
                            </span>
                            <span className="text-xs font-bold text-stone-800">
                              {formatMoneyBRL(proportionalCalc.dailyRate)} / dia
                              {proportionalCalc.isProportional ? (
                                <span className="text-[10px] text-stone-500 block font-normal">
                                  (÷ {proportionalCalc.daysWorkedMonth} dias trab.)
                                </span>
                              ) : (
                                <span className="text-[10px] text-stone-500 block font-normal">
                                  (÷ 30 dias padrão)
                                </span>
                              )}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] text-stone-500 font-bold block uppercase tracking-wider">
                              Valor da Hora de Trabalho
                            </span>
                            <span className="text-xs font-bold text-stone-800">
                              {formatMoneyBRL(proportionalCalc.hourlyRate)} / hora
                              <span className="text-[10px] text-stone-500 block font-normal">
                                (÷ 220 horas jornada)
                              </span>
                            </span>
                          </div>
                        </div>

                        {/* Input do Valor Total do Desconto */}
                        <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-xl space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="block text-xs font-black uppercase tracking-wider text-rose-950">
                              Valor Total do Desconto em Folha
                            </label>
                            <button
                              type="button"
                              onClick={() => handleResetToCalculated()}
                              className="text-[10px] text-[#0963cb] hover:underline font-bold cursor-pointer"
                              title="Recalcular valor exato pela fórmula"
                            >
                              ↺ Recalcular Padrão
                            </button>
                          </div>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-rose-800 font-bold text-base">
                              R$
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              value={discountAmount !== undefined ? discountAmount : ''}
                              onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                              className="w-full pl-10 pr-3 py-2 border border-rose-300 rounded-lg bg-white text-rose-800 font-black text-lg outline-none focus:ring-2 focus:ring-rose-500 shadow-inner"
                              required
                            />
                          </div>
                        </div>

                        {/* 4. DETALHAMENTO DO REFLEXO FINANCEIRO (MEMÓRIA DE CÁLCULO TRANSPARENTE) */}
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                          <div className="flex items-center space-x-1.5 text-amber-900 font-bold text-[11px]">
                            <Clock className="w-3.5 h-3.5 text-amber-700" />
                            <span>Memória de Cálculo do Desconto:</span>
                          </div>
                          <p className="text-[11px] text-amber-950 leading-relaxed font-mono bg-white/80 p-2.5 rounded-lg border border-amber-200/80 break-words">
                            {calculationMemory || proportionalCalc.calculationMemory}
                          </p>
                          <span className="text-[10px] text-stone-500 block italic">
                            Exibição transparente para controle da folha de pagamento e auditoria de RH.
                          </span>
                        </div>

                      </div>
                    ) : (
                      <div className="py-8 text-center bg-stone-50 border border-dashed border-stone-300 rounded-xl text-stone-500">
                        <Check className="w-6 h-6 mx-auto mb-1 text-emerald-600" />
                        <p className="font-bold text-xs text-stone-700">Ocorrência sem impacto financeiro</p>
                        <p className="text-[11px] text-stone-500 max-w-xs mx-auto mt-1">
                          O colaborador terá a justificativa registrada no histórico, sem dedução no contracheque.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Resumo Rodapé da Coluna Direita */}
                  <div className="pt-2 border-t border-stone-200 flex items-center justify-between text-[11px] text-stone-600">
                    <span>Unidade ativa: <strong>{absenceUnit === 'horas' ? 'Horas Fracionadas' : 'Dias Inteiros'}</strong></span>
                    <span>Status: <strong className="uppercase text-black">{status}</strong></span>
                  </div>
                </div>

              </div>

              {/* BOTÕES DE AÇÃO */}
              <div className="flex items-center justify-between pt-3 border-t border-black/15">
                <div className="text-[11px] text-blue-950 font-medium hidden sm:block">
                  Sincronizado automaticamente via Supabase Realtime (tabela <code className="bg-white/60 px-1 py-0.5 rounded text-[#0963cb] font-bold">public.rh_faltas</code>)
                </div>
                <div className="flex items-center space-x-2.5 ml-auto">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-lg bg-white border border-stone-300 text-stone-700 font-bold hover:bg-stone-50 cursor-pointer transition shadow-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 rounded-lg bg-pink-600 hover:bg-pink-700 text-white font-bold transition shadow-md cursor-pointer flex items-center space-x-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>Salvar Falta / Ocorrência</span>
                  </button>
                </div>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
