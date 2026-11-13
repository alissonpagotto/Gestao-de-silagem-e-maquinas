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
import { CompetenceSelector } from '../financial/CompetenceSelector';
import { 
  formatMoneyBRL, 
  formatEmployeeAdmissionDate,
  getAdmissionProportionality 
} from './payrollHelpers';
import { formatDateBR, formatCurrencyBRL, getActiveCompanyId, saveStoredAbsences, getStoredAbsences } from '../../lib/storage';
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
import { AbsenceModal } from './AbsenceModal';

interface FaltasTabProps {
  employees: Employee[];
  absences: AbsenceRecord[];
  payrolls?: PayrollRecord[];
  currentMonthRef: string;
  onChangeMonthRef?: (month: string) => void;
  onSaveAbsences: (absences: AbsenceRecord[]) => void;
  onApplyDiscountToPayroll?: (absence: AbsenceRecord) => void;
}

export const FaltasTab: React.FC<FaltasTabProps> = ({
  employees,
  absences,
  payrolls = [],
  currentMonthRef,
  onChangeMonthRef,
  onSaveAbsences,
  onApplyDiscountToPayroll,
}) => {
  const { confirm } = useConfirm();
  const { currentUser, companyId: authCompanyId } = useAuth();
  const currentUserId = currentUser?.id;
  const effectiveCompanyId = authCompanyId || currentUserId || getActiveCompanyId() || 'default';

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => currentMonthRef || '10/2026');
  const [typeFilter, setTypeFilter] = useState<string>('todos');
  const [discountFilter, setDiscountFilter] = useState<string>('todos');

  // Sincroniza reativamente a competência com o estado global da folha
  useEffect(() => {
    if (currentMonthRef && currentMonthRef !== selectedMonth) {
      setSelectedMonth(currentMonthRef);
    }
  }, [currentMonthRef]);

  // Navegação unificada de mês idêntica à Folha de Pagamento
  const handlePrevMonth = () => {
    const rawMonth = selectedMonth || currentMonthRef || '10/2026';
    const parts = rawMonth.split('/');
    let month = Number(parts[0]) || 1;
    let year = Number(parts[1]) || 2026;
    let newMonth = month - 1;
    let newYear = year;
    if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    }
    const newRef = `${String(newMonth).padStart(2, '0')}/${newYear}`;
    setSelectedMonth(newRef);
    onChangeMonthRef?.(newRef);
  };

  const handleNextMonth = () => {
    const rawMonth = selectedMonth || currentMonthRef || '10/2026';
    const parts = rawMonth.split('/');
    let month = Number(parts[0]) || 1;
    let year = Number(parts[1]) || 2026;
    let newMonth = month + 1;
    let newYear = year;
    if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    }
    const newRef = `${String(newMonth).padStart(2, '0')}/${newYear}`;
    setSelectedMonth(newRef);
    onChangeMonthRef?.(newRef);
  };

  // Deduplicação estrita de faltas (ELIMINAÇÃO DE DUPLICIDADES):
  // Certifica-se de que cada ocorrência de falta do dia 22/09/2026 gere apenas uma única linha na tabela,
  // eliminando linhas repetidas com o mesmo ID ou mesma data/colaborador.
  const loadAndDeduplicateAbsences = React.useCallback((): AbsenceRecord[] => {
    try {
      const storedFaltas = getStoredAbsences();
      const seen = new Set<string>();
      const cleanList: AbsenceRecord[] = [];

      for (const item of storedFaltas) {
        if (!item) continue;
        let d = item.date || '';
        if (d.includes('/')) {
          const parts = d.split('/');
          if (parts.length === 3) d = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
        const empKey = String(item.employeeId || item.employeeName || '').trim().toLowerCase();
        const dedupeKey = `${empKey}_${d}`;
        const idKey = item.id ? String(item.id).trim() : '';

        // Se já viu a data e colaborador, descarta duplicata (ex: 22/09/2026 de Diego da Cruz Alves)
        if (seen.has(dedupeKey) || (idKey && seen.has(`id_${idKey}`))) {
          continue;
        }

        seen.add(dedupeKey);
        if (idKey) seen.add(`id_${idKey}`);

        const rawDisc = item.discountAmount !== undefined ? item.discountAmount : (item as any).desconto;
        const disc = rawDisc !== undefined && rawDisc !== null ? Number(rawDisc) : 0;

        cleanList.push({
          ...item,
          date: d,
          type: 'injustificada',
          tipo: 'falta_injustificada',
          tipo_registro: 'falta_injustificada',
          desconto: disc,
          discountAmount: disc,
        } as AbsenceRecord);
      }

      if (cleanList.length !== storedFaltas.length) {
        saveStoredAbsences(cleanList);
      }

      return cleanList;
    } catch {
      return getStoredAbsences();
    }
  }, []);

  // Inicialização reativa imediata: consome estritamente agrocontrol_faltas com deduplicação
  const [localAbsences, setLocalAbsences] = useState<AbsenceRecord[]>(() => {
    return loadAndDeduplicateAbsences();
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAbsence, setEditingAbsence] = useState<AbsenceRecord | null>(null);



  const absencesRef = useRef<AbsenceRecord[]>(localAbsences);
  absencesRef.current = localAbsences;

  const onSaveAbsencesRef = React.useRef(onSaveAbsences);
  onSaveAbsencesRef.current = onSaveAbsences;

  // Escuta alterações de storage para recarregar imediatamente
  useEffect(() => {
    const handleSync = () => {
      const res = loadAndDeduplicateAbsences();
      if (res.length > 0) {
        setLocalAbsences(res);
      }
    };
    handleSync();
    window.addEventListener('storage', handleSync);
    window.addEventListener('silagem_absences_updated', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('silagem_absences_updated', handleSync);
    };
  }, [loadAndDeduplicateAbsences]);

  // Trava de segurança para carga inicial única das faltas
  const isAbsencesLoadedRef = useRef<string | null>(null);

  // Sincronização em Tempo Real via Realtime Channel apontando estritamente para 'rh_faltas'
  useEffect(() => {
    if (!effectiveCompanyId) return;

    let isMounted = true;
    let debounceTimer: any = null;

    const loadInitialFromSupabase = async () => {
      try {
        const stored = getStoredAbsences();
        if (stored.length > 0 && isMounted) {
          setLocalAbsences(stored);
        }
        const fresh = await fetchCloudAbsences(effectiveCompanyId);
        if (!isMounted) return;
        if (Array.isArray(fresh) && fresh.length > 0) {
          // Unifica sem perder registros armazenados no LocalStorage
          const merged = [...fresh];
          for (const s of stored) {
            if (!merged.some(m => m.id === s.id)) {
              merged.push(s);
            }
          }
          setLocalAbsences(merged);
          saveStoredAbsences(merged);
          onSaveAbsencesRef.current(merged);
        } else if (stored.length > 0) {
          setLocalAbsences(stored);
          saveStoredAbsences(stored);
          onSaveAbsencesRef.current(stored);
        }
      } catch (err) {
        if (isMounted) {
          const stored = getStoredAbsences();
          setLocalAbsences(stored);
        }
      }
    };

    if (isAbsencesLoadedRef.current !== effectiveCompanyId) {
      isAbsencesLoadedRef.current = effectiveCompanyId;
      const stored = getStoredAbsences();
      setLocalAbsences(stored.length > 0 ? stored : (Array.isArray(absences) ? absences : []));
      if (isSupabaseConfigured) {
        loadInitialFromSupabase();
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



  // Helper de comparação robusta de competência / mês
  const isMonthMatching = (a: AbsenceRecord, selMonth: string) => {
    if (!selMonth || selMonth === 'todos') return true;
    const cleanSel = selMonth.trim();
    if (a.referenceMonth && a.referenceMonth.trim() === cleanSel) return true;
    const parts = cleanSel.split('/');
    if (parts.length === 2) {
      const [m, y] = parts;
      const mPad = m.padStart(2, '0');
      if (a.date) {
        if (a.date.startsWith(`${y}-${mPad}`) || a.date.startsWith(`${y}-${Number(m)}`)) return true;
        if (a.date.includes(`/${mPad}/${y}`) || a.date.endsWith(`${mPad}/${y}`)) return true;
      }
      if (a.referenceMonth) {
        if (a.referenceMonth.replace('-', '/') === `${y}/${mPad}` || a.referenceMonth.replace('-', '/') === `${mPad}/${y}`) return true;
      }
    }
    return false;
  };

  // Deduplicação estrita nas listagens (ELIMINAÇÃO DE DUPLICIDADES):
  // Certifique-se de que cada ocorrência de falta do dia 22/09/2026 gere apenas uma única linha na tabela,
  // eliminando linhas repetidas com o mesmo ID ou mesma data.
  const activeAbsences = React.useMemo(() => {
    const seen = new Set<string>();
    const deduplicated: AbsenceRecord[] = [];

    for (const item of localAbsences) {
      if (!item) continue;
      let d = item.date || '';
      if (d.includes('/')) {
        const parts = d.split('/');
        if (parts.length === 3) d = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
      const empKey = String(item.employeeId || item.employeeName || '').trim().toLowerCase();
      const dedupeKey = `${empKey}_${d}`;
      const idKey = item.id ? String(item.id).trim() : '';

      if (seen.has(dedupeKey) || (idKey && seen.has(`id_${idKey}`))) {
        continue;
      }
      seen.add(dedupeKey);
      if (idKey) seen.add(`id_${idKey}`);
      deduplicated.push(item);
    }
    return deduplicated;
  }, [localAbsences]);

  const filtered = activeAbsences.filter(a => {
    const matchesSearch = 
      a.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.reason && a.reason.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (a.notes && a.notes.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesMonth = isMonthMatching(a, selectedMonth);
    const matchesType = typeFilter === 'todos' || a.type === typeFilter;
    const matchesDiscount = 
      discountFilter === 'todos' || 
      (discountFilter === 'com_desconto' && a.discountPayroll) ||
      (discountFilter === 'sem_desconto' && !a.discountPayroll) ||
      (discountFilter === a.status);

    return matchesSearch && matchesMonth && matchesType && matchesDiscount;
  });

  // KPIs for the selected month or total
  const monthAbsences = selectedMonth
    ? activeAbsences.filter(a => isMonthMatching(a, selectedMonth))
    : activeAbsences;
  const totalOccurrences = monthAbsences.length;
  const unjustifiedCount = monthAbsences.filter(a => a.type === 'injustificada' || a.type === 'suspensao').length;
  const justifiedCount = monthAbsences.filter(a => a.type === 'justificada').length;
  const totalDiscountAmount = monthAbsences
    .filter(a => a.discountPayroll)
    .reduce((sum, a) => sum + (Number(a.discountAmount) || 0), 0);

  const handleOpenModal = (item?: AbsenceRecord) => {
    setEditingAbsence(item || null);
    setIsModalOpen(true);
  };

  const handleSaveAbsenceModal = (recordToSave: AbsenceRecord & { tipo?: string; tipo_registro?: string; desconto?: number }) => {
    const canonicalId = toValidUUID(recordToSave.id);
    const fullRecord: AbsenceRecord = {
      ...recordToSave,
      id: canonicalId,
      companyId: effectiveCompanyId,
      userId: currentUserId,
    };

    let nextList: AbsenceRecord[];
    if (editingAbsence) {
      nextList = localAbsences.map(a => a.id === editingAbsence.id ? fullRecord : a);
    } else {
      nextList = [fullRecord, ...localAbsences];
    }

    setLocalAbsences(nextList);
    onSaveAbsences(nextList);
    saveStoredAbsences(nextList);
    try {
      localStorage.setItem('colaca_silagem_rh_faltas', JSON.stringify(nextList));
      localStorage.setItem('agrocontrol_faltas', JSON.stringify(nextList));
    } catch (_) {}
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('silagem_absences_updated', { detail: nextList }));
      window.dispatchEvent(new CustomEvent('agrocontrol_faltas_updated', { detail: nextList }));
    }
    setIsModalOpen(false);

    // Gravação e sincronização imediata na tabela public.rh_faltas do Supabase
    if (isSupabaseConfigured) {
      upsertRhFalta(fullRecord, currentUserId, effectiveCompanyId).catch(err => {
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
      try {
        localStorage.setItem('colaca_silagem_rh_faltas', JSON.stringify(nextList));
        localStorage.setItem('agrocontrol_faltas', JSON.stringify(nextList));
      } catch (_) {}
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('silagem_absences_updated', { detail: nextList }));
        window.dispatchEvent(new CustomEvent('agrocontrol_faltas_updated', { detail: nextList }));
      }

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
    try {
      localStorage.setItem('colaca_silagem_rh_faltas', JSON.stringify(updated));
      localStorage.setItem('agrocontrol_faltas', JSON.stringify(updated));
    } catch (_) {}
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('silagem_absences_updated', { detail: updated }));
      window.dispatchEvent(new CustomEvent('agrocontrol_faltas_updated', { detail: updated }));
    }

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
          {/* Seletor Unificado de Competência com Navegação por Setas */}
          <CompetenceSelector
            competence={selectedMonth}
            onPrev={handlePrevMonth}
            onNext={handleNextMonth}
          />

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
      <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-slate-300 dark:border-stone-800 rounded-xl overflow-hidden shadow-xs">
        <div className="max-h-[calc(100vh-320px)] overflow-y-auto overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 text-[11px] font-black text-black dark:text-white uppercase tracking-wider border-b border-slate-300 dark:border-stone-700 shadow-sm">
              <tr>
                <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 py-2.5 px-3">Situação</th>
                <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 py-2.5 px-3">Colaborador</th>
                <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 py-2.5 px-3">Tipo de Falta</th>
                <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 py-2.5 px-3 text-center">Data / Período</th>
                <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 py-2.5 px-3 text-center">Qtd. Dias</th>
                <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 py-2.5 px-3">Motivo / Justificativa</th>
                <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 py-2.5 px-3 text-right">Desconto Estimado</th>
                <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 py-2.5 px-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-200/60 dark:divide-stone-800">
              {filtered.length > 0 ? (
                filtered.map((item) => (
                  <tr key={item.id} className="even:bg-[#f2f2f2] odd:bg-white dark:even:bg-stone-800/50 dark:odd:bg-stone-900 hover:bg-slate-200/60 dark:hover:bg-stone-800 transition border-b border-slate-200 dark:border-stone-800">
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
                  <td colSpan={8} className="py-4 text-center text-stone-500 dark:text-stone-400 text-xs font-semibold uppercase">
                    NENHUM REGISTRO ENCONTRADO
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Reutilizável de Falta / Ocorrência */}
      <AbsenceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingAbsence={editingAbsence}
        employees={employees}
        currentMonthRef={currentMonthRef}
        selectedMonth={selectedMonth}
        onSave={handleSaveAbsenceModal}
      />

    </div>
  );
};
