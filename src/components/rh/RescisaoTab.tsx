import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Calculator, 
  Printer, 
  Save, 
  Trash2, 
  FileText, 
  UserX, 
  AlertCircle, 
  CheckCircle2, 
  Calendar, 
  DollarSign, 
  UserCheck, 
  X, 
  Plus, 
  Clock, 
  Eye, 
  Building2,
  Phone,
  RefreshCw,
  Scale,
  BookmarkCheck,
  FileEdit,
  Search
} from 'lucide-react';
import { 
  Employee, 
  SalaryAdvance, 
  AbsenceRecord, 
  CompanyProfile,
  TerminationRecord, 
  TerminationReason, 
  NoticeType,
  TerminationCalculation,
  VacationRecord
} from '../../types';
import { 
  formatCurrencyBRL, 
  formatDateBR, 
  getActiveCompanyId,
  getStoredTerminations, 
  saveStoredTerminations 
} from '../../lib/storage';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  saveCloudTerminations,
  fetchCloudTerminations,
  upsertRhRescisaoRecord,
  deleteRhRescisaoRecord,
  mapRowToTerminationRecord,
  toValidUUID,
} from '../../lib/supabaseService';
import { useAuth } from '../../context/AuthContext';
import { 
  formatMoneyBRL, 
  parseMoneyToFloat, 
  parseRawOrFormattedToFloat,
  formatNumberBRL,
  formatCPF, 
  formatEmployeeAdmissionDate 
} from './payrollHelpers';
import { useConfirm } from '../../context/ConfirmContext';
import { EmployeeAvatar } from '../common/EmployeeAvatar';

export interface ResignCalculationModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}

export const ResignCalculationModal: React.FC<ResignCalculationModalProps> = ({
  isOpen,
  onClose,
  title = 'Simulador & Cálculo Rescisório CLT',
  subtitle = 'Apuração completa de verbas rescisórias, férias, 13º proporcional, FGTS e deduções legais',
  children,
}) => {
  if (!isOpen) return null;

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-slate-50 dark:bg-stone-950 border border-slate-200 dark:border-stone-800 rounded-2xl w-full max-w-6xl shadow-2xl overflow-hidden my-auto max-h-[95vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-[#0963cb] text-white shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-white/15 text-white">
              <Calculator className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black tracking-tight text-white uppercase font-['Outfit']">
                {title}
              </h2>
              <p className="text-[11px] sm:text-xs text-white/85 font-medium">
                {subtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition cursor-pointer"
            title="Fechar Simulador de Rescisão"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo do Simulador em Modal */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  );
};

interface RescisaoTabProps {
  employees: Employee[];
  vacations?: VacationRecord[];
  companyProfile?: CompanyProfile;
  advances?: SalaryAdvance[];
  absences?: AbsenceRecord[];
  onSaveEmployees?: (employees: Employee[]) => void;
}

export const RescisaoTab: React.FC<RescisaoTabProps> = ({
  employees = [],
  vacations = [],
  companyProfile,
  advances = [],
  absences = [],
  onSaveEmployees,
}) => {
  const { confirm } = useConfirm();
  const { currentUser, companyId: authCompanyId } = useAuth();
  const activeTenantId = useMemo(() => {
    return authCompanyId || currentUser?.id || getActiveCompanyId() || 'default';
  }, [authCompanyId, currentUser?.id]);

  const clientInstanceIdRef = useRef<string>(`resc_tab_${Math.random().toString(36).slice(2, 10)}`);
  const realtimeChannelRef = useRef<any>(null);

  // Histórico de Rescisões persistido
  const [terminations, setTerminations] = useState<TerminationRecord[]>(() => getStoredTerminations());
  const terminationsRef = useRef<TerminationRecord[]>(terminations);
  useEffect(() => {
    terminationsRef.current = terminations;
  }, [terminations]);

  // Estado do Modal de Cálculo Rescisório (inicia obrigatoriamente fechado: isOpen = false)
  const [isCalculationModalOpen, setIsCalculationModalOpen] = useState<boolean>(false);
  const [editingTerminationId, setEditingTerminationId] = useState<string | null>(null);

  // Filtros de Busca na Listagem Histórica
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'homologado' | 'rascunho'>('all');

  // Estado do Formulário
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [reason, setReason] = useState<TerminationReason>('sem_justa_causa');
  const [noticeType, setNoticeType] = useState<NoticeType>('indenizado');
  const [admissionDate, setAdmissionDate] = useState<string>('');
  const [terminationDate, setTerminationDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [baseSalary, setBaseSalary] = useState<number>(0);
  const [baseSalaryDisplay, setBaseSalaryDisplay] = useState<string>('0,00');
  
  // Parâmetros de Férias e FGTS
  const [vacationExpiredPeriods, setVacationExpiredPeriods] = useState<number>(0);
  const [vacationExpiredInput, setVacationExpiredInput] = useState<string>('0');
  const [customFgtsBalance, setCustomFgtsBalance] = useState<string>('');
  const [isManualFgts, setIsManualFgts] = useState<boolean>(false);
  const [markInactive, setMarkInactive] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>('');

  // Controles de Inclusão e Cálculo
  const [includeFgtsFine, setIncludeFgtsFine] = useState<boolean>(false);
  const [includeInssDiscount, setIncludeInssDiscount] = useState<boolean>(true);

  // Controle de Rascunhos e Persistência
  const [isSavingDraft, setIsSavingDraft] = useState<boolean>(false);
  const [draftBannerMessage, setDraftBannerMessage] = useState<string | null>(null);
  const [vacationAlert, setVacationAlert] = useState<string | null>(null);

  // Sincronização inicial e Escuta Ativa (Supabase Realtime) da tabela public.rh_rescisoes
  useEffect(() => {
    fetchCloudTerminations(activeTenantId).then((cloudList) => {
      if (cloudList && Array.isArray(cloudList) && cloudList.length > 0) {
        setTerminations((prev) => {
          const map = new Map<string, TerminationRecord>();
          prev.forEach((t) => map.set(toValidUUID(t.id), { ...t, id: toValidUUID(t.id) }));
          cloudList.forEach((t) => map.set(toValidUUID(t.id), { ...t, id: toValidUUID(t.id) }));
          const merged = Array.from(map.values()).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          saveStoredTerminations(merged);
          return merged;
        });
      }
    }).catch((err) => console.warn('Aviso ao sincronizar rescisões com o Supabase:', err));
  }, [activeTenantId]);

  useEffect(() => {
    if (!isSupabaseConfigured || !activeTenantId) return;

    const applyIncomingTermination = (incoming: TerminationRecord) => {
      if (!incoming) return;
      const incomingId = toValidUUID(incoming.id);
      const normalized: TerminationRecord = { ...incoming, id: incomingId, companyId: activeTenantId };

      setTerminations((prev) => {
        const exists = prev.some((t) => toValidUUID(t.id) === incomingId);
        const next = exists
          ? prev.map((t) => (toValidUUID(t.id) === incomingId ? { ...t, ...normalized, id: incomingId } : t))
          : [normalized, ...prev];
        saveStoredTerminations(next);
        return next;
      });

      setViewingTRCT((prev) =>
        prev && toValidUUID(prev.id) === incomingId ? { ...prev, ...normalized } : prev
      );

      // Se o colaborador desta rescisão estiver selecionado na tela, atualiza os campos locais automaticamente
      if (selectedEmployeeId && normalized.employeeId === selectedEmployeeId) {
        if (normalized.reason) setReason(normalized.reason);
        if (normalized.noticeType) setNoticeType(normalized.noticeType);
        if (normalized.admissionDate) setAdmissionDate(normalized.admissionDate);
        if (normalized.terminationDate) setTerminationDate(normalized.terminationDate);
        if (normalized.baseSalary !== undefined) {
          setBaseSalary(normalized.baseSalary);
          setBaseSalaryDisplay(formatNumberBRL(normalized.baseSalary));
        }
        if (normalized.vacationExpiredPeriods !== undefined) {
          setVacationExpiredPeriods(normalized.vacationExpiredPeriods);
          setVacationExpiredInput(String(normalized.vacationExpiredPeriods));
        }
        if (normalized.customFgtsBalance !== undefined) setCustomFgtsBalance(normalized.customFgtsBalance);
        if (normalized.isManualFgts !== undefined) setIsManualFgts(Boolean(normalized.isManualFgts));
        if (normalized.includeFgtsFine !== undefined) setIncludeFgtsFine(Boolean(normalized.includeFgtsFine));
        if (normalized.includeInssDiscount !== undefined) setIncludeInssDiscount(Boolean(normalized.includeInssDiscount));
        if (normalized.customAbsencesDiscount !== undefined) setCustomAbsencesDiscount(normalized.customAbsencesDiscount);
        if (normalized.customAdvancesDiscount !== undefined) setCustomAdvancesDiscount(normalized.customAdvancesDiscount);
        if (normalized.otherDeductionsInput !== undefined) setOtherDeductionsInput(normalized.otherDeductionsInput);
        if (normalized.notes !== undefined) setNotes(normalized.notes);
      }
    };

    const channelTopic = `rh-rescisoes-realtime-${activeTenantId}`;
    let channel: any = null;

    try {
      const existingChannels = supabase.getChannels?.() || [];
      for (const ch of existingChannels) {
        if (ch.topic === channelTopic || ch.topic === `realtime:${channelTopic}`) {
          try {
            supabase.removeChannel(ch);
          } catch (_) {}
        }
      }

      channel = supabase
        .channel(channelTopic, {
          config: { broadcast: { self: false } },
        })
        .on('broadcast', { event: 'termination_mutation' }, (msg: any) => {
          const payload = msg?.payload || msg;
          if (!payload || payload.senderId === clientInstanceIdRef.current) return;
          if (payload.tenantId && payload.tenantId !== activeTenantId) return;
          if (payload.termination) {
            applyIncomingTermination(payload.termination);
          }
        })
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'rh_rescisoes' },
          (payload: any) => {
            const eventType = payload?.eventType;
            if (eventType === 'DELETE') {
              const oldId = payload?.old?.id;
              if (oldId) {
                const targetId = toValidUUID(String(oldId));
                setTerminations((prev) => {
                  const next = prev.filter((t) => toValidUUID(t.id) !== targetId);
                  saveStoredTerminations(next);
                  return next;
                });
              }
              return;
            }

            const row = payload?.new;
            if (!row) return;
            if (row.company_id && String(row.company_id) !== String(activeTenantId)) return;

            const mapped = mapRowToTerminationRecord(row);
            if (mapped) {
              applyIncomingTermination(mapped);
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'site_settings',
            filter: `id=eq.cloud_terminations_${activeTenantId}`,
          },
          (payload: any) => {
            const row = payload?.new;
            if (row?.hero_title) {
              try {
                const parsed = JSON.parse(row.hero_title) as TerminationRecord[];
                if (Array.isArray(parsed)) {
                  setTerminations(parsed);
                  saveStoredTerminations(parsed);
                }
              } catch (_) {}
            }
          }
        )
        .subscribe();

      realtimeChannelRef.current = channel;
    } catch (err) {
      console.warn('⚠️ [Realtime Rescisões Notice]:', err);
    }

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch (_) {}
      }
      realtimeChannelRef.current = null;
    };
  }, [activeTenantId, selectedEmployeeId]);

  // Deduções adicionais ajustáveis
  const [customAbsencesDiscount, setCustomAbsencesDiscount] = useState<string>('0,00');
  const [customAdvancesDiscount, setCustomAdvancesDiscount] = useState<string>('0,00');
  const [otherDeductionsInput, setOtherDeductionsInput] = useState<string>('0,00');

  // Modal de Impressão / TRCT
  const [viewingTRCT, setViewingTRCT] = useState<TerminationRecord | null>(null);

  // Handlers para formatação monetária segura
  const handleBaseSalaryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const digits = val.replace(/\D/g, '');
    if (!digits) {
      setBaseSalary(0);
      setBaseSalaryDisplay('0,00');
      return;
    }
    const num = parseInt(digits, 10) / 100;
    setBaseSalary(num);
    setBaseSalaryDisplay(formatNumberBRL(num));
  };

  const handleBaseSalaryPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim();
    if (!pasted) return;
    const num = parseRawOrFormattedToFloat(pasted);
    setBaseSalary(num);
    setBaseSalaryDisplay(formatNumberBRL(num));
  };

  const handleMoneyChange = (setter: (val: string) => void) => {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const digits = e.target.value.replace(/\D/g, '');
      if (!digits) {
        setter('0,00');
        return;
      }
      const num = parseInt(digits, 10) / 100;
      setter(formatNumberBRL(num));
    };
  };

  const handleMoneyPaste = (setter: (val: string) => void) => {
    return (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData('text').trim();
      if (!pasted) return;
      const num = parseRawOrFormattedToFloat(pasted);
      setter(formatNumberBRL(num));
    };
  };

  // Referência para evitar re-carregamento desnecessário enquanto o usuário edita campos
  const lastLoadedEmployeeIdRef = useRef<string | null>(null);

  // Manipulador para férias vencidas aceitando apenas períodos inteiros legais (CLT Art. 130)
  const handleVacationExpiredChange = (valStr: string) => {
    // 1. Bloqueio automático para contratos menores de 12 meses
    if (dateAnalysis.contractHasLessThanOneYear) {
      setVacationExpiredPeriods(0);
      setVacationExpiredInput('0');
      setVacationAlert(
        `Trava de Segurança CLT / Antiduplicação:\nO contrato possui menos de 12 meses (${dateAnalysis.totalDays} dias trabalhados). É proibido lançar férias vencidas (nem frações como 0,5 período), pois não houve aquisição de período integral (Art. 130 CLT). O período trabalhado é pago exclusivamente nas Férias Proporcionais (${dateAnalysis.vacationProportionalMonths}/12 avos).`
      );
      return;
    }

    const normalized = valStr.replace(',', '.').trim();
    if (!normalized) {
      setVacationExpiredPeriods(0);
      setVacationExpiredInput('0');
      setVacationAlert(null);
      return;
    }
    const num = Math.floor(parseFloat(normalized));
    if (isNaN(num) || num <= 0) {
      setVacationExpiredPeriods(0);
      setVacationExpiredInput('0');
      setVacationAlert(null);
      return;
    }

    // Regra antiduplicação CLT: não pode exceder o número de períodos aquisitivos completos do contrato
    const maxAllowed = dateAnalysis.completedAcquisitionPeriods;
    if (num > maxAllowed) {
      setVacationAlert(
        `Alerta de Parametrização CLT / Antiduplicação:\nO contrato possui ${maxAllowed} período(s) aquisitivo(s) completo(s) de 12 meses. O valor foi ajustado para ${maxAllowed} para evitar pagamento em duplicidade ou cálculo inflado.`
      );
      setVacationExpiredPeriods(maxAllowed);
      setVacationExpiredInput(String(maxAllowed));
      return;
    }

    setVacationAlert(null);
    setVacationExpiredPeriods(num);
    setVacationExpiredInput(String(num));
  };

  // Colaborador Selecionado
  const selectedEmployee = useMemo(() => {
    return employees.find((e) => e.id === selectedEmployeeId) || null;
  }, [employees, selectedEmployeeId]);

  // Ao selecionar funcionário, verifica se há rascunho salvo para restaurar ou preenche com dados cadastrais e cálculo retroativo de férias
  useEffect(() => {
    if (selectedEmployee) {
      // Se este funcionário já foi carregado ativamente, não sobrescreve os campos que o usuário está digitando
      if (lastLoadedEmployeeIdRef.current === selectedEmployee.id) {
        return;
      }
      lastLoadedEmployeeIdRef.current = selectedEmployee.id;

      // Verifica se já existe um rascunho 'Em Andamento' para este colaborador
      const existingDraft = terminations.find(
        (t) => t.employeeId === selectedEmployee.id && t.status === 'rascunho'
      );

      if (existingDraft) {
        // Carrega com fidelidade todos os campos salvos no rascunho
        setReason(existingDraft.reason || 'sem_justa_causa');
        setNoticeType(existingDraft.noticeType || 'indenizado');
        const adm = existingDraft.admissionDate || selectedEmployee.admissionDate?.split('T')[0] || '';
        const term = existingDraft.terminationDate || new Date().toISOString().split('T')[0];
        setAdmissionDate(adm);
        setTerminationDate(term);

        const sal = existingDraft.baseSalary ?? (selectedEmployee.baseSalary ?? selectedEmployee.salary ?? 0);
        setBaseSalary(sal);
        setBaseSalaryDisplay(formatNumberBRL(sal));

        // Aplica a trava antiduplicação mesmo em rascunhos antigos se o contrato tiver < 12 meses
        const s = adm ? new Date(adm + 'T12:00:00') : null;
        const e = term ? new Date(term + 'T12:00:00') : null;
        let isShortContract = true;
        if (s && e && !isNaN(s.getTime()) && !isNaN(e.getTime())) {
          const nextYear = new Date(s);
          nextYear.setFullYear(nextYear.getFullYear() + 1);
          isShortContract = nextYear > e;
        }

        const vacCount = isShortContract ? 0 : (existingDraft.vacationExpiredPeriods ?? existingDraft.calculation?.vacationExpiredCount ?? 0);
        setVacationExpiredPeriods(vacCount);
        setVacationExpiredInput(vacCount > 0 ? String(vacCount) : '0');

        setCustomFgtsBalance(existingDraft.customFgtsBalance || '');
        setIsManualFgts(Boolean(existingDraft.isManualFgts || (existingDraft.customFgtsBalance && existingDraft.customFgtsBalance !== '0,00')));
        setIncludeFgtsFine(Boolean(existingDraft.includeFgtsFine));
        setIncludeInssDiscount(existingDraft.includeInssDiscount !== undefined ? existingDraft.includeInssDiscount : true);
        setCustomAbsencesDiscount(existingDraft.customAbsencesDiscount || '0,00');
        setCustomAdvancesDiscount(existingDraft.customAdvancesDiscount || '0,00');
        setOtherDeductionsInput(existingDraft.otherDeductionsInput || '0,00');
        setNotes(existingDraft.notes || '');
        setDraftBannerMessage(`Rascunho em andamento carregado para ${selectedEmployee.name}. Altere o que precisar e salve ou homologue.`);
      } else {
        setDraftBannerMessage(null);
        const rawSal = selectedEmployee.baseSalary ?? selectedEmployee.salary ?? 0;
        const sal = typeof rawSal === 'number' ? rawSal : parseRawOrFormattedToFloat(rawSal);
        setBaseSalary(sal);
        setBaseSalaryDisplay(formatNumberBRL(sal));
        
        const cleanAdm = selectedEmployee.admissionDate ? selectedEmployee.admissionDate.split('T')[0] : '';
        setAdmissionDate(cleanAdm);
        const todayIso = new Date().toISOString().split('T')[0];
        setTerminationDate(todayIso);

        // 1. TRATAMENTO DE HISTÓRICO DE FÉRIAS (DADOS AUSENTES OU ZERADOS):
        // Se contrato < 12 meses: Férias Vencidas OBRIGATORIAMENTE 0.
        // Se contrato > 12 meses e NÃO houver férias gozadas: calcula retroativamente quantos períodos vencidos existem.
        let initialExpiredVacations = 0;
        if (cleanAdm) {
          const s = new Date(cleanAdm + 'T12:00:00');
          const e = new Date(todayIso + 'T12:00:00');
          if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
            let completedP = 0;
            let anniv = new Date(s);
            while (true) {
              const nextA = new Date(anniv);
              nextA.setFullYear(nextA.getFullYear() + 1);
              if (nextA <= e) {
                completedP++;
                anniv = nextA;
              } else {
                break;
              }
            }
            if (completedP > 0) {
              const empVacs = (vacations || []).filter(
                (v) => v.employeeId === selectedEmployee.id && (v.status === 'concluido' || v.status === 'em_gozo' || v.daysCount >= 20)
              );
              initialExpiredVacations = Math.max(0, completedP - empVacs.length);
            }
          }
        }
        setVacationExpiredPeriods(initialExpiredVacations);
        setVacationExpiredInput(String(initialExpiredVacations));

        // Buscar adiantamentos pendentes em aberto deste colaborador
        const pendingAdvances = advances
          .filter((a) => a.employeeId === selectedEmployee.id && a.status === 'pendente')
          .reduce((sum, a) => sum + (a.amount || 0), 0);
        setCustomAdvancesDiscount(pendingAdvances > 0 ? formatNumberBRL(pendingAdvances) : '0,00');

        // Buscar faltas injustificadas pendentes de desconto
        const pendingAbsences = absences
          .filter((ab) => ab.employeeId === selectedEmployee.id && ab.type === 'injustificada' && ab.status === 'pendente')
          .reduce((sum, ab) => sum + (ab.discountAmount || (sal > 0 ? (sal / 30) * ab.daysCount : 0)), 0);
        setCustomAbsencesDiscount(pendingAbsences > 0 ? formatNumberBRL(pendingAbsences) : '0,00');

        setIsManualFgts(false);
        setCustomFgtsBalance('');
        setIncludeFgtsFine(false);
        setIncludeInssDiscount(true);
        setOtherDeductionsInput('0,00');
        setNotes('');
      }
    } else {
      lastLoadedEmployeeIdRef.current = null;
      setBaseSalary(0);
      setBaseSalaryDisplay('0,00');
      setAdmissionDate('');
      setCustomAdvancesDiscount('0,00');
      setCustomAbsencesDiscount('0,00');
      setOtherDeductionsInput('0,00');
      setCustomFgtsBalance('');
      setVacationExpiredPeriods(0);
      setVacationExpiredInput('0');
      setDraftBannerMessage(null);
    }
  }, [selectedEmployeeId, selectedEmployee, advances, absences, terminations, vacations]);

  // Cálculo de datas e proporções rigorosamente aderente à CLT
  const dateAnalysis = useMemo(() => {
    if (!admissionDate || !terminationDate) {
      return {
        totalDays: 0,
        totalMonths: 0,
        yearsOfService: 0,
        completedAcquisitionPeriods: 0,
        unexhaustedExpiredPeriods: 0,
        workedDaysCurrentMonth: 0,
        thirteenthMonths: 0,
        thirteenthMonthsWorked: 0,
        thirteenthMonthsProjectedNotice: 0,
        vacationProportionalMonths: 0,
        vacationMonthsWorked: 0,
        vacationMonthsProjectedNotice: 0,
        noticeDays: 30,
        projectedTerminationDate: '',
        isProjectedNotice: false,
        contractHasLessThanOneYear: true,
      };
    }

    const start = new Date(admissionDate + 'T12:00:00');
    const end = new Date(terminationDate + 'T12:00:00');

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
      return {
        totalDays: 0,
        totalMonths: 0,
        yearsOfService: 0,
        completedAcquisitionPeriods: 0,
        unexhaustedExpiredPeriods: 0,
        workedDaysCurrentMonth: 0,
        thirteenthMonths: 0,
        thirteenthMonthsWorked: 0,
        thirteenthMonthsProjectedNotice: 0,
        vacationProportionalMonths: 0,
        vacationMonthsWorked: 0,
        vacationMonthsProjectedNotice: 0,
        noticeDays: 30,
        projectedTerminationDate: '',
        isProjectedNotice: false,
        contractHasLessThanOneYear: true,
      };
    }

    // Dias exatos de calendário de contrato trabalhado (inclusivo de início e fim)
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    const totalMonths = Math.max(1, Math.round(totalDays / 30.4375));

    // Períodos aquisitivos de 12 meses completos (CLT Art. 130)
    let completedAcquisitionPeriods = 0;
    let lastAnniversary = new Date(start);
    while (true) {
      const nextAnniv = new Date(lastAnniversary);
      nextAnniv.setFullYear(nextAnniv.getFullYear() + 1);
      if (nextAnniv <= end) {
        completedAcquisitionPeriods++;
        lastAnniversary = nextAnniv;
      } else {
        break;
      }
    }
    const contractHasLessThanOneYear = completedAcquisitionPeriods === 0;

    // Histórico de Férias gozadas no sistema para este colaborador
    const empVacations = (vacations || []).filter(
      (v) => v.employeeId === selectedEmployee?.id && (v.status === 'concluido' || v.status === 'em_gozo' || v.daysCount >= 20)
    );
    const enjoyedVacationsCount = empVacations.length;
    const unexhaustedExpiredPeriods = contractHasLessThanOneYear
      ? 0
      : Math.max(0, completedAcquisitionPeriods - enjoyedVacationsCount);

    // Anos completos de serviço para a Lei do Aviso Prévio (Lei 12.506/2011: 30 dias + 3 dias/ano completo)
    const yearsOfService = completedAcquisitionPeriods;
    const noticeDays = Math.min(90, 30 + yearsOfService * 3);

    // Projeção do Aviso Prévio Indenizado (CLT Art. 487, § 1º, Súmula 305 e OJ 82 SDI-1 do TST)
    const isProjectedNotice = noticeType === 'indenizado' && (reason === 'sem_justa_causa' || reason === 'acordo_mutuo');
    const projectedEnd = isProjectedNotice
      ? new Date(end.getTime() + noticeDays * 24 * 60 * 60 * 1000)
      : end;
    const projectedTerminationDate = projectedEnd.toISOString().split('T')[0];

    // Dias trabalhados no mês do término físico (dia 1 até dia do término, limitado a 30)
    const endDay = end.getDate();
    const workedDaysCurrentMonth = Math.min(30, endDay);

    // 13º Salário Proporcional (Trabalhado e com Projeção)
    // Regra da CLT: mês conta se houver >= 15 dias trabalhados
    const calcThirteenthAvos = (cutoff: Date): number => {
      const targetYear = cutoff.getFullYear();
      let avos = 0;
      const startM = (start.getFullYear() === targetYear) ? start.getMonth() : 0;
      const endM = cutoff.getMonth();

      for (let m = startM; m <= endM; m++) {
        let days = 0;
        if (m === startM && start.getFullYear() === targetYear) {
          const daysInFirst = new Date(targetYear, m + 1, 0).getDate();
          days = daysInFirst - start.getDate() + 1;
        } else if (m === endM) {
          days = cutoff.getDate();
        } else {
          days = 30;
        }
        if (days >= 15) {
          avos++;
        }
      }
      return Math.min(12, Math.max(0, avos));
    };

    const thirteenthMonthsWorked = calcThirteenthAvos(end);
    const thirteenthMonthsTotal = isProjectedNotice ? calcThirteenthAvos(projectedEnd) : thirteenthMonthsWorked;
    const thirteenthMonthsProjectedNotice = Math.max(0, thirteenthMonthsTotal - thirteenthMonthsWorked);

    // Férias Proporcionais a partir do último aniversário aquisitivo (ou da admissão se 0 aniversários)
    const calcVacationAvos = (cutoff: Date): number => {
      let avos = 0;
      let curr = new Date(lastAnniversary);
      while (avos < 12) {
        const next = new Date(curr);
        next.setMonth(next.getMonth() + 1);
        if (next <= cutoff) {
          avos++;
          curr = next;
        } else {
          const diffMs = cutoff.getTime() - curr.getTime();
          const rem = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          if (rem >= 15) {
            avos++;
          }
          break;
        }
      }
      return Math.min(12, Math.max(0, avos));
    };

    const vacationMonthsWorked = calcVacationAvos(end);
    const vacationMonthsTotal = isProjectedNotice ? calcVacationAvos(projectedEnd) : vacationMonthsWorked;
    const vacationMonthsProjectedNotice = Math.max(0, vacationMonthsTotal - vacationMonthsWorked);

    return {
      totalDays,
      totalMonths,
      yearsOfService,
      completedAcquisitionPeriods,
      unexhaustedExpiredPeriods,
      workedDaysCurrentMonth,
      thirteenthMonths: thirteenthMonthsTotal,
      thirteenthMonthsWorked,
      thirteenthMonthsProjectedNotice,
      vacationProportionalMonths: vacationMonthsTotal,
      vacationMonthsWorked,
      vacationMonthsProjectedNotice,
      noticeDays,
      projectedTerminationDate,
      isProjectedNotice,
      contractHasLessThanOneYear,
    };
  }, [admissionDate, terminationDate, noticeType, reason, vacations, selectedEmployee]);

  // Função auxiliar de cálculo do INSS progressivo brasileiro
  const calculateINSS = (base: number): number => {
    if (base <= 0) return 0;
    // Tabela INSS vigente
    let inss = 0;
    const faixas = [
      { limite: 1412.00, aliq: 0.075 },
      { limite: 2666.68, aliq: 0.09 },
      { limite: 4000.03, aliq: 0.12 },
      { limite: 7786.02, aliq: 0.14 }
    ];

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
    return Math.min(inss, 908.86); // Teto
  };

  // Motor de Cálculo da Rescisão
  const calculation: TerminationCalculation = useMemo(() => {
    const salary = typeof baseSalary === 'number' ? baseSalary : parseRawOrFormattedToFloat(baseSalaryDisplay);
    if (salary <= 0 || !selectedEmployee) {
      return {
        workedDaysCurrentMonth: 0,
        salaryBalance: 0,
        thirteenthProportionalMonths: 0,
        thirteenthProportionalAmount: 0,
        vacationExpiredCount: 0,
        vacationExpiredAmount: 0,
        vacationProportionalMonths: 0,
        vacationProportionalAmount: 0,
        vacationOneThirdBonus: 0,
        noticeDays: 30,
        noticeAmount: 0,
        fgtsEstimatedBalance: 0,
        fgtsFineRate: 0,
        fgtsFineAmount: 0,
        grossTotal: 0,
        includeFgtsFine,
        includeInssDiscount,
        inssSalaryBalance: 0,
        inssThirteenth: 0,
        irrfDiscount: 0,
        absenceDiscount: 0,
        advancesDiscount: 0,
        noticeDeduction: 0,
        otherDeductions: 0,
        totalDeductions: 0,
        netTotal: 0,
      };
    }

    const dailyRate = salary / 30;
    const workedDays = dateAnalysis.workedDaysCurrentMonth;

    // 1. Saldo de Salário
    const salaryBalance = Number((dailyRate * workedDays).toFixed(2));

    // 2. Aviso Prévio
    let noticeAmount = 0;
    let noticeDeduction = 0;
    if (reason === 'sem_justa_causa') {
      if (noticeType === 'indenizado') {
        noticeAmount = Number((dailyRate * dateAnalysis.noticeDays).toFixed(2));
      }
    } else if (reason === 'acordo_mutuo') {
      if (noticeType === 'indenizado') {
        noticeAmount = Number(((dailyRate * dateAnalysis.noticeDays) / 2).toFixed(2));
      }
    } else if (reason === 'pedido_demissao') {
      if (noticeType === 'dispensado') {
        noticeDeduction = 0;
      } else if (noticeType === 'indenizado') {
        // Empregado não cumpriu e indeniza a empresa (desconto de 30 dias)
        noticeDeduction = Number((salary).toFixed(2));
      }
    }

    // 3. 13º Salário Proporcional
    let thirteenthMonths = dateAnalysis.thirteenthMonths;
    let thirteenthProportionalAmount = 0;
    if (reason !== 'com_justa_causa') {
      thirteenthProportionalAmount = Number(((salary / 12) * thirteenthMonths).toFixed(2));
    } else {
      thirteenthMonths = 0;
    }

    // 4. Férias Vencidas (Regra Antiduplicação CLT: se contrato tiver menos de 12 meses, é obrigatoriamente 0)
    const effectiveExpiredCount = dateAnalysis.contractHasLessThanOneYear
      ? 0
      : Math.min(dateAnalysis.completedAcquisitionPeriods, Math.max(0, vacationExpiredPeriods));
    const vacationExpiredAmount = Number((effectiveExpiredCount * salary).toFixed(2));

    // 5. Férias Proporcionais
    let vacationPropMonths = dateAnalysis.vacationProportionalMonths;
    let vacationProportionalAmount = 0;
    if (reason !== 'com_justa_causa') {
      vacationProportionalAmount = Number(((salary / 12) * vacationPropMonths).toFixed(2));
    } else {
      vacationPropMonths = 0;
    }

    // 6. 1/3 Constitucional de Férias (sobre vencidas reais + proporcionais reais)
    let vacationOneThirdBonus = 0;
    if (vacationExpiredAmount > 0 || vacationProportionalAmount > 0) {
      vacationOneThirdBonus = Number(((vacationExpiredAmount + vacationProportionalAmount) / 3).toFixed(2));
    }

    // 7. Estimativa do FGTS e Multa Rescisória
    let fgtsBase = 0;
    if (isManualFgts && customFgtsBalance !== '') {
      fgtsBase = parseRawOrFormattedToFloat(customFgtsBalance);
    } else {
      // 8% do salário por mês trabalhado
      fgtsBase = Number((salary * 0.08 * dateAnalysis.totalMonths).toFixed(2));
    }

    let fgtsFineRate = 0;
    if (reason === 'sem_justa_causa') {
      fgtsFineRate = 40;
    } else if (reason === 'acordo_mutuo') {
      fgtsFineRate = 20;
    }
    const calculatedFgtsFine = Number(((fgtsBase * fgtsFineRate) / 100).toFixed(2));
    // Se a opção "Calcular Multa do FGTS (40%)" estiver desmarcada, a multa é estritamente ZERADA
    const fgtsFineAmount = includeFgtsFine ? calculatedFgtsFine : 0;

    // Total Bruto dos Proventos
    const grossTotal = Number((
      salaryBalance +
      noticeAmount +
      thirteenthProportionalAmount +
      vacationExpiredAmount +
      vacationProportionalAmount +
      vacationOneThirdBonus +
      fgtsFineAmount
    ).toFixed(2));

    // Descontos / Deduções
    const rawInssSalary = Number(calculateINSS(salaryBalance).toFixed(2));
    const rawInssThirteenth = Number(calculateINSS(thirteenthProportionalAmount).toFixed(2));

    const inssSalaryBalance = includeInssDiscount ? rawInssSalary : 0;
    const inssThirteenth = includeInssDiscount ? rawInssThirteenth : 0;
    
    // IRRF Simplificado (se aplicável após dedução INSS)
    const irrfBase = Math.max(0, salaryBalance - inssSalaryBalance);
    let irrfDiscount = 0;
    if (irrfBase > 2826.65) {
      irrfDiscount = Number(((irrfBase * 0.075) - 169.44).toFixed(2));
    }

    const absenceDiscount = parseRawOrFormattedToFloat(customAbsencesDiscount);
    const advancesDiscount = parseRawOrFormattedToFloat(customAdvancesDiscount);
    const otherDeductions = parseRawOrFormattedToFloat(otherDeductionsInput);

    const totalDeductions = Number((
      inssSalaryBalance +
      inssThirteenth +
      irrfDiscount +
      absenceDiscount +
      advancesDiscount +
      noticeDeduction +
      otherDeductions
    ).toFixed(2));

    const netTotal = Math.max(0, Number((grossTotal - totalDeductions).toFixed(2)));

    return {
      workedDaysCurrentMonth: workedDays,
      salaryBalance,
      thirteenthProportionalMonths: thirteenthMonths,
      thirteenthProportionalAmount,
      vacationExpiredCount: vacationExpiredPeriods,
      vacationExpiredAmount,
      vacationProportionalMonths: vacationPropMonths,
      vacationProportionalAmount,
      vacationOneThirdBonus,
      noticeDays: dateAnalysis.noticeDays,
      noticeAmount,
      fgtsEstimatedBalance: fgtsBase,
      fgtsFineRate,
      fgtsFineAmount,
      grossTotal,
      includeFgtsFine,
      includeInssDiscount,
      inssSalaryBalance,
      inssThirteenth,
      irrfDiscount,
      absenceDiscount,
      advancesDiscount,
      noticeDeduction,
      otherDeductions,
      totalDeductions,
      netTotal,
    };
  }, [
    baseSalary,
    baseSalaryDisplay,
    selectedEmployee,
    reason,
    noticeType,
    dateAnalysis,
    vacationExpiredPeriods,
    isManualFgts,
    customFgtsBalance,
    customAbsencesDiscount,
    customAdvancesDiscount,
    otherDeductionsInput,
    includeFgtsFine,
    includeInssDiscount,
  ]);

  // Sincroniza automaticamente edições manuais de rascunhos existentes na tabela rh_rescisoes
  useEffect(() => {
    if (!selectedEmployee) return;
    const existingDraft = terminationsRef.current.find(
      (t) => t.employeeId === selectedEmployee.id && t.status === 'rascunho'
    );
    if (!existingDraft) return;

    const timer = setTimeout(() => {
      const canonicalId = toValidUUID(existingDraft.id);
      const updatedDraft: TerminationRecord = {
        ...existingDraft,
        id: canonicalId,
        companyId: activeTenantId,
        employeeId: selectedEmployee.id,
        employeeName: selectedEmployee.name,
        employeeRole: selectedEmployee.role || 'Colaborador',
        employeeCpf: selectedEmployee.cpf,
        admissionDate: admissionDate || selectedEmployee.admissionDate || '',
        terminationDate,
        reason,
        noticeType,
        baseSalary,
        calculation,
        includeFgtsFine,
        includeInssDiscount,
        vacationExpiredPeriods,
        customFgtsBalance,
        isManualFgts,
        customAbsencesDiscount,
        customAdvancesDiscount,
        otherDeductionsInput,
        notes,
        status: 'rascunho',
        markEmployeeInactive: false,
        updatedAt: new Date().toISOString(),
      };

      const nextList = terminationsRef.current.map((t) =>
        toValidUUID(t.id) === canonicalId ? updatedDraft : t
      );
      setTerminations(nextList);
      saveStoredTerminations(nextList);

      if (isSupabaseConfigured) {
        upsertRhRescisaoRecord(updatedDraft, activeTenantId).catch(() => {});
        try {
          realtimeChannelRef.current?.send({
            type: 'broadcast',
            event: 'termination_mutation',
            payload: {
              tenantId: activeTenantId,
              senderId: clientInstanceIdRef.current,
              termination: updatedDraft,
            },
          });
        } catch (_) {}
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [
    selectedEmployee,
    activeTenantId,
    admissionDate,
    terminationDate,
    reason,
    noticeType,
    baseSalary,
    calculation,
    includeFgtsFine,
    includeInssDiscount,
    vacationExpiredPeriods,
    customFgtsBalance,
    isManualFgts,
    customAbsencesDiscount,
    customAdvancesDiscount,
    otherDeductionsInput,
    notes,
  ]);

  // Abrir modal para "+ Nova Rescisão" com campos limpos prontos para seleção do funcionário
  const handleOpenNewRescisao = () => {
    setEditingTerminationId(null);
    lastLoadedEmployeeIdRef.current = null;
    setSelectedEmployeeId('');
    setReason('sem_justa_causa');
    setNoticeType('indenizado');
    setAdmissionDate('');
    setTerminationDate(new Date().toISOString().split('T')[0]);
    setBaseSalary(0);
    setBaseSalaryDisplay('0,00');
    setVacationExpiredPeriods(0);
    setVacationExpiredInput('0');
    setCustomFgtsBalance('');
    setIsManualFgts(false);
    setIncludeFgtsFine(false);
    setIncludeInssDiscount(true);
    setCustomAbsencesDiscount('0,00');
    setCustomAdvancesDiscount('0,00');
    setOtherDeductionsInput('0,00');
    setMarkInactive(true);
    setNotes('');
    setDraftBannerMessage(null);
    setVacationAlert(null);
    setIsCalculationModalOpen(true);
  };

  // Visualizar / Editar rescisão ou rascunho existente na janela modal
  const handleEditTermination = (record: TerminationRecord) => {
    setEditingTerminationId(record.id);
    lastLoadedEmployeeIdRef.current = record.employeeId;
    setSelectedEmployeeId(record.employeeId);
    setReason(record.reason || 'sem_justa_causa');
    setNoticeType(record.noticeType || 'indenizado');

    const emp = employees.find((e) => e.id === record.employeeId);
    const adm = record.admissionDate || emp?.admissionDate?.split('T')[0] || '';
    setAdmissionDate(adm);
    setTerminationDate(record.terminationDate || new Date().toISOString().split('T')[0]);

    const sal = record.baseSalary ?? emp?.baseSalary ?? emp?.salary ?? 0;
    setBaseSalary(sal);
    setBaseSalaryDisplay(formatNumberBRL(sal));

    const vac = record.vacationExpiredPeriods ?? record.calculation?.vacationExpiredCount ?? 0;
    setVacationExpiredPeriods(vac);
    setVacationExpiredInput(vac > 0 ? String(vac) : '0');

    setCustomFgtsBalance(record.customFgtsBalance || '');
    setIsManualFgts(Boolean(record.isManualFgts || (record.customFgtsBalance && record.customFgtsBalance !== '0,00')));
    setIncludeFgtsFine(Boolean(record.includeFgtsFine ?? record.calculation?.includeFgtsFine));
    setIncludeInssDiscount(
      record.includeInssDiscount !== undefined
        ? record.includeInssDiscount
        : record.calculation?.includeInssDiscount !== undefined
          ? record.calculation.includeInssDiscount
          : true
    );
    setCustomAbsencesDiscount(
      record.customAbsencesDiscount ||
        (record.calculation?.absenceDiscount ? formatNumberBRL(record.calculation.absenceDiscount) : '0,00')
    );
    setCustomAdvancesDiscount(
      record.customAdvancesDiscount ||
        (record.calculation?.advancesDiscount ? formatNumberBRL(record.calculation.advancesDiscount) : '0,00')
    );
    setOtherDeductionsInput(
      record.otherDeductionsInput ||
        (record.calculation?.otherDeductions ? formatNumberBRL(record.calculation.otherDeductions) : '0,00')
    );
    setMarkInactive(record.markEmployeeInactive !== undefined ? record.markEmployeeInactive : true);
    setNotes(record.notes || '');
    setVacationAlert(null);
    setDraftBannerMessage(
      record.status === 'rascunho'
        ? `Rascunho de "${record.employeeName}" carregado para edição.`
        : `Visualizando / editando rescisão de "${record.employeeName}".`
    );
    setIsCalculationModalOpen(true);
  };

  // Salvar Rescisão no Histórico e na tabela rh_rescisoes do Supabase
  const handleSaveTermination = async () => {
    if (!selectedEmployee) {
      await confirm({
        title: 'Selecione um Funcionário',
        message: 'Por favor, selecione o colaborador para calcular e registrar a rescisão.',
        confirmLabel: 'Entendido',
        variant: 'primary',
      });
      return;
    }

    const isConfirmed = await confirm({
      title: 'Confirmar Homologação da Rescisão',
      message: `Deseja registrar o desligamento de ${selectedEmployee.name} com valor líquido de ${formatMoneyBRL(calculation.netTotal)}?${
        markInactive ? ' O status do colaborador será alterado para inativo.' : ''
      }`,
      confirmLabel: 'Confirmar e Salvar',
      cancelLabel: 'Revisar',
      variant: 'primary',
    });

    if (!isConfirmed) return;

    // Estratégia de upsert: reutiliza ID em edição ou registro existente do mesmo funcionário
    const existingForEmployee = editingTerminationId
      ? terminations.find((t) => toValidUUID(t.id) === toValidUUID(editingTerminationId))
      : terminations.find(
          (t) =>
            t.employeeId === selectedEmployee.id &&
            (t.status === 'rascunho' || t.terminationDate === terminationDate)
        );
    const canonicalId = toValidUUID(
      existingForEmployee?.id || editingTerminationId || `term_${activeTenantId}_${selectedEmployee.id}_${terminationDate}`
    );

    const newRecord: TerminationRecord = {
      id: canonicalId,
      companyId: activeTenantId,
      employeeId: selectedEmployee.id,
      employeeName: selectedEmployee.name,
      employeeRole: selectedEmployee.role,
      employeeCpf: selectedEmployee.cpf,
      admissionDate: admissionDate || selectedEmployee.admissionDate || '',
      terminationDate: terminationDate,
      reason,
      noticeType,
      baseSalary,
      calculation,
      includeFgtsFine,
      includeInssDiscount,
      vacationExpiredPeriods,
      customFgtsBalance,
      isManualFgts,
      customAbsencesDiscount,
      customAdvancesDiscount,
      otherDeductionsInput,
      notes,
      status: 'homologado',
      markEmployeeInactive: markInactive,
      createdAt: existingForEmployee?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Remove eventual rascunho anterior deste funcionário e atualiza lista imediatamente
    const otherTerminations = terminations.filter(
      (t) => !(t.employeeId === selectedEmployee.id && t.status === 'rascunho') && toValidUUID(t.id) !== canonicalId
    );
    const updated = [newRecord, ...otherTerminations];
    setTerminations(updated);
    saveStoredTerminations(updated);

    if (isSupabaseConfigured) {
      await upsertRhRescisaoRecord(newRecord, activeTenantId).catch(() => {});
      saveCloudTerminations(updated, activeTenantId).catch(() => {});
      try {
        realtimeChannelRef.current?.send({
          type: 'broadcast',
          event: 'termination_mutation',
          payload: {
            tenantId: activeTenantId,
            senderId: clientInstanceIdRef.current,
            termination: newRecord,
          },
        });
      } catch (_) {}
    }

    setDraftBannerMessage(null);
    setEditingTerminationId(null);

    // Atualizar status do funcionário se solicitado
    if (markInactive && onSaveEmployees) {
      const updatedEmployees = employees.map((emp) => {
        if (emp.id === selectedEmployee.id) {
          return {
            ...emp,
            status: 'inativo' as const,
            active: false,
            terminationDate: terminationDate,
          };
        }
        return emp;
      });
      onSaveEmployees(updatedEmployees);
    }

    // Fecha o modal de cálculo para exibir instantaneamente a listagem atualizada na página inicial
    setIsCalculationModalOpen(false);
  };

  // Salvar Rascunho (Em Andamento) sem alterar o status do colaborador para inativo
  const handleSaveDraft = async () => {
    if (!selectedEmployee) {
      await confirm({
        title: 'Selecione um Funcionário',
        message: 'Por favor, selecione um colaborador antes de salvar o rascunho da rescisão.',
        confirmLabel: 'Entendido',
        cancelLabel: '',
        variant: 'primary',
      });
      return;
    }

    setIsSavingDraft(true);
    try {
      const existingDraft = editingTerminationId
        ? terminations.find((t) => toValidUUID(t.id) === toValidUUID(editingTerminationId))
        : terminations.find(
            (t) => t.employeeId === selectedEmployee.id && t.status === 'rascunho'
          );
      const canonicalId = toValidUUID(
        existingDraft?.id || editingTerminationId || `draft_${activeTenantId}_${selectedEmployee.id}`
      );

      const draftRecord: TerminationRecord = {
        id: canonicalId,
        companyId: activeTenantId,
        employeeId: selectedEmployee.id,
        employeeName: selectedEmployee.name,
        employeeRole: selectedEmployee.role || 'Colaborador',
        employeeCpf: selectedEmployee.cpf,
        admissionDate: admissionDate || selectedEmployee.admissionDate || '',
        terminationDate: terminationDate,
        reason,
        noticeType,
        baseSalary,
        calculation,
        includeFgtsFine,
        includeInssDiscount,
        vacationExpiredPeriods,
        customFgtsBalance,
        isManualFgts,
        customAbsencesDiscount,
        customAdvancesDiscount,
        otherDeductionsInput,
        notes,
        status: 'rascunho',
        markEmployeeInactive: false, // JAMAIS altera status para inativo em rascunho
        createdAt: existingDraft?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const otherTerminations = terminations.filter((t) => toValidUUID(t.id) !== canonicalId);
      const updated = [draftRecord, ...otherTerminations];

      setTerminations(updated);
      saveStoredTerminations(updated);

      // Persistência na nuvem (Supabase: rh_rescisoes + site_settings)
      if (isSupabaseConfigured) {
        await upsertRhRescisaoRecord(draftRecord, activeTenantId);
        await saveCloudTerminations(updated, activeTenantId);
        try {
          realtimeChannelRef.current?.send({
            type: 'broadcast',
            event: 'termination_mutation',
            payload: {
              tenantId: activeTenantId,
              senderId: clientInstanceIdRef.current,
              termination: draftRecord,
            },
          });
        } catch (_) {}
      }

      setDraftBannerMessage(`Rascunho de "${selectedEmployee.name}" salvo com sucesso! O colaborador continua ATIVO.`);
    } catch (e) {
      console.error('Erro ao salvar rascunho no Supabase:', e);
      setDraftBannerMessage(`Rascunho de "${selectedEmployee.name}" salvo localmente.`);
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Excluir registro ou rascunho do histórico
  const handleDeleteTermination = async (id: string, empName: string) => {
    const targetItem = terminations.find((t) => t.id === id);
    const isDraft = targetItem?.status === 'rascunho';

    const isConfirmed = await confirm({
      title: isDraft ? 'Excluir Rascunho' : 'Excluir Rescisão',
      message: `Deseja realmente remover o ${isDraft ? 'rascunho em andamento' : 'registro de rescisão'} de "${empName}"?`,
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });

    if (isConfirmed) {
      const updated = terminations.filter((t) => t.id !== id);
      setTerminations(updated);
      saveStoredTerminations(updated);
      if (isSupabaseConfigured) {
        deleteRhRescisaoRecord(id, activeTenantId).catch(() => {});
        saveCloudTerminations(updated, activeTenantId).catch(() => {});
      }
    }
  };

  // Nome formatado do motivo
  const getReasonLabel = (r: TerminationReason): string => {
    switch (r) {
      case 'sem_justa_causa':
        return 'Sem Justa Causa (Empregador)';
      case 'com_justa_causa':
        return 'Com Justa Causa (Falta Grave)';
      case 'pedido_demissao':
        return 'Pedido de Demissão (Empregado)';
      case 'acordo_mutuo':
        return 'Acordo entre as Partes (Art. 484-A CLT)';
      case 'termino_contrato':
        return 'Término de Contrato / Experiência';
      default:
        return r;
    }
  };

  // Filtragem da listagem histórica de rescisões
  const filteredTerminations = useMemo(() => {
    return terminations.filter((t) => {
      const matchesSearch =
        (t.employeeName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.employeeRole || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        getReasonLabel(t.reason).toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;
      if (statusFilter === 'homologado' && t.status === 'rascunho') return false;
      if (statusFilter === 'rascunho' && t.status !== 'rascunho') return false;
      return true;
    });
  }, [terminations, searchTerm, statusFilter]);

  const homologadosCount = useMemo(
    () => terminations.filter((t) => t.status !== 'rascunho').length,
    [terminations]
  );
  const rascunhosCount = useMemo(
    () => terminations.filter((t) => t.status === 'rascunho').length,
    [terminations]
  );
  const totalRescisoesLiquido = useMemo(
    () => terminations.reduce((sum, t) => sum + (t.calculation?.netTotal || 0), 0),
    [terminations]
  );

  return (
    <div className="w-full space-y-3 sm:space-y-4 antialiased">
      
      {/* ========================================================================= */}
      {/* 1. CABEÇALHO SUPERIOR DA PÁGINA INICIAL DA ABA RESCISÃO                    */}
      {/* ========================================================================= */}
      <div className="no-print crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-3 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-black dark:text-white">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-blue-100/70 dark:bg-stone-800 border border-blue-200/80 dark:border-stone-700 text-black dark:text-white">
            <UserX className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-black dark:text-white">
              Gestão e Histórico de Rescisões Contratuais (CLT)
            </h3>
            <p className="text-xs text-black/85 dark:text-stone-300 font-medium">
              Controle de desligamentos processados, apuração de verbas rescisórias e emissão do TRCT oficial
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenNewRescisao}
          className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl transition shadow-xs cursor-pointer active:scale-95"
        >
          <span>+ Nova Rescisão</span>
        </button>
      </div>

      {/* KPIs Rápidos de Rescisões */}
      <div className="no-print grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="crm-card bg-white dark:bg-stone-900 border border-emerald-200 dark:border-stone-800 rounded-xl p-2.5 shadow-xs text-black dark:text-white">
          <span className="text-[11px] font-black text-emerald-700 dark:text-emerald-400 block uppercase">
            Rescisões Homologadas
          </span>
          <span className="text-base font-black text-emerald-700 dark:text-emerald-400 font-['Outfit']">
            {homologadosCount} registro(s)
          </span>
        </div>
        <div className="crm-card bg-white dark:bg-stone-900 border border-amber-200 dark:border-stone-800 rounded-xl p-2.5 shadow-xs text-black dark:text-white">
          <span className="text-[11px] font-black text-amber-700 dark:text-amber-400 block uppercase">
            Rascunhos em Andamento
          </span>
          <span className="text-base font-black text-amber-700 dark:text-amber-400 font-['Outfit']">
            {rascunhosCount} rascunho(s)
          </span>
        </div>
        <div className="crm-card bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-800 rounded-xl p-2.5 shadow-xs text-black dark:text-white">
          <span className="text-[11px] font-black text-slate-700 dark:text-stone-300 block uppercase">
            Total Líquido Rescisório
          </span>
          <span className="text-base font-black text-black dark:text-white font-['Outfit']">
            {formatMoneyBRL(totalRescisoesLiquido)}
          </span>
        </div>
      </div>

      {/* Barra de Busca e Filtros de Status */}
      <div className="no-print bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-800 rounded-xl p-2.5 sm:p-3 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-black dark:text-white">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar colaborador, cargo ou tipo de rescisão..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1.5 text-xs border border-slate-300 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-800 text-black dark:text-white placeholder-slate-400 outline-none focus:ring-1 focus:ring-sky-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-2.5 py-1 rounded-full text-xs font-bold border transition cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-[#0963cb] text-white border-[#0963cb]'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
            }`}
          >
            Todas ({terminations.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('homologado')}
            className={`px-2.5 py-1 rounded-full text-xs font-bold border transition cursor-pointer ${
              statusFilter === 'homologado'
                ? 'bg-emerald-600 text-white border-emerald-700'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
            }`}
          >
            Homologadas ({homologadosCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('rascunho')}
            className={`px-2.5 py-1 rounded-full text-xs font-bold border transition cursor-pointer ${
              statusFilter === 'rascunho'
                ? 'bg-amber-500 text-stone-950 border-amber-600'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
            }`}
          >
            Em Andamento ({rascunhosCount})
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. TABELA DE HISTÓRICO DE RESCISÕES CALCULADAS / PROCESSADAS              */}
      {/* ========================================================================= */}
      <div className="no-print bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-800 rounded-xl overflow-hidden shadow-xs text-black dark:text-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 dark:bg-stone-800 text-[10px] sm:text-[11px] font-black text-black dark:text-white uppercase tracking-wider border-b border-slate-200 dark:border-stone-700">
              <tr>
                <th className="py-3 px-4">Colaborador</th>
                <th className="py-3 px-4">Data de Admissão</th>
                <th className="py-3 px-4">Data de Desligamento</th>
                <th className="py-3 px-4">Tipo de Rescisão</th>
                <th className="py-3 px-4 text-right">Valor Líquido Rescisório (R$)</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-stone-800">
              {filteredTerminations.length > 0 ? (
                filteredTerminations.map((t) => {
                  const matchedEmp = employees.find((e) => e.id === t.employeeId);
                  const displayAdmission = t.admissionDate || matchedEmp?.admissionDate || '';
                  const displayRole = t.employeeRole || matchedEmp?.role || 'Colaborador';

                  return (
                    <tr key={t.id || t.employeeId} className="hover:bg-slate-50 dark:hover:bg-stone-800/50 transition">
                      {/* 1. Colaborador (Nome e Cargo) */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-3">
                          <EmployeeAvatar
                            photoUrl={matchedEmp?.photoUrl || (matchedEmp as any)?.foto_url}
                            name={t.employeeName}
                            size="sm"
                            className="shrink-0 rounded-xl"
                          />
                          <div>
                            <div className="font-bold text-black dark:text-white uppercase text-xs sm:text-sm">
                              {t.employeeName}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-50 text-sky-900 border border-sky-200/70">
                                {displayRole}
                              </span>
                              {t.status === 'rascunho' ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 inline-flex items-center gap-1">
                                  <Clock className="w-2.5 h-2.5" />
                                  Em Andamento
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1">
                                  <CheckCircle2 className="w-2.5 h-2.5" />
                                  Homologado
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Data de Admissão */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-xs font-semibold text-slate-700 dark:text-stone-300">
                        {displayAdmission ? formatDateBR(displayAdmission) : 'Não informada'}
                      </td>

                      {/* 3. Data de Desligamento */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-xs font-bold text-slate-900 dark:text-white">
                        {formatDateBR(t.terminationDate)}
                      </td>

                      {/* 4. Tipo de Rescisão */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-xs text-slate-800 dark:text-stone-200">
                          {getReasonLabel(t.reason)}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-stone-400 font-medium capitalize">
                          Aviso Prévio: {t.noticeType} ({t.calculation?.noticeDays || 30} dias)
                        </div>
                      </td>

                      {/* 5. Valor Líquido Rescisório (R$) */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <span className="font-black text-sm text-emerald-700 dark:text-emerald-400 font-['Outfit']">
                          {formatMoneyBRL(t.calculation?.netTotal || 0)}
                        </span>
                      </td>

                      {/* 6. Ações: Visualizar/Editar e Imprimir TRCT (PDF) */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end space-x-1.5">
                          <button
                            type="button"
                            onClick={() => handleEditTermination(t)}
                            className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-[#0963cb] hover:bg-[#0852a8] text-white text-xs font-bold shadow-2xs transition cursor-pointer active:scale-95"
                            title="Visualizar ou Editar Cálculo Rescisório"
                          >
                            <FileEdit className="w-3.5 h-3.5 shrink-0" />
                            <span>Visualizar/Editar</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setViewingTRCT(t)}
                            className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-stone-950 text-xs font-bold shadow-2xs transition cursor-pointer active:scale-95"
                            title="Imprimir Termo de Rescisão (TRCT PDF)"
                          >
                            <Printer className="w-3.5 h-3.5 shrink-0" />
                            <span>Imprimir TRCT (PDF)</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteTermination(t.id, t.employeeName)}
                            className="p-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                            title={t.status === 'rascunho' ? 'Excluir rascunho' : 'Excluir rescisão do histórico'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500 dark:text-stone-400 text-xs font-semibold">
                    Nenhuma rescisão processada ou rascunho encontrado. Clique em <strong className="text-emerald-700 dark:text-emerald-400">"+ Nova Rescisão"</strong> no topo à direita para iniciar um cálculo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. MODAL DO SIMULADOR E CÁLCULO DE RESCISÃO (ResignCalculationModal)      */}
      {/* ========================================================================= */}
      <ResignCalculationModal
        isOpen={isCalculationModalOpen}
        onClose={() => setIsCalculationModalOpen(false)}
        title={editingTerminationId ? 'Visualizar / Editar Rescisão Contratual' : 'Nova Rescisão — Simulador & Cálculo CLT'}
      >
        <div className="no-print grid grid-cols-1 lg:grid-cols-12 gap-4">
          
          {/* Formulário Principal (8 colunas) */}
          <div className="lg:col-span-8 bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-stone-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 rounded-xl border border-emerald-200 dark:border-emerald-800/60">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight">
                    Simulador & Cálculo Rescisório CLT
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-stone-400">
                    Preencha os dados do colaborador para apurar verbas, FGTS e deduções
                  </p>
                </div>
              </div>
              
              {selectedEmployee && (
                <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-stone-800 text-slate-700 dark:text-stone-300 border border-slate-200 dark:border-stone-700">
                  Cargo: {selectedEmployee.role || 'Geral'}
                </span>
              )}
            </div>

          {/* Banner de Feedback / Rascunho Recuperado */}
          {draftBannerMessage && (
            <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/70 rounded-xl text-xs text-amber-900 dark:text-amber-200 shadow-2xs">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="font-semibold">{draftBannerMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setDraftBannerMessage(null)}
                className="text-amber-600 hover:text-amber-900 dark:hover:text-white p-1 cursor-pointer"
                title="Fechar aviso"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Seção 1: Seleção de Funcionário e Motivo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-black text-slate-800 dark:text-stone-200 mb-1">
                Selecione o Funcionário <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="">-- Selecione o colaborador --</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.role || 'Colaborador'}) {emp.status === 'inativo' ? '— [Inativo]' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-800 dark:text-stone-200 mb-1">
                Motivo do Desligamento <span className="text-rose-500">*</span>
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as TerminationReason)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="sem_justa_causa">Demissão sem Justa Causa (Empregador)</option>
                <option value="pedido_demissao">Pedido de Demissão (Empregado)</option>
                <option value="com_justa_causa">Demissão com Justa Causa</option>
                <option value="acordo_mutuo">Acordo entre as Partes (Art. 484-A CLT)</option>
                <option value="termino_contrato">Término de Contrato de Experiência / Prazo</option>
              </select>
            </div>
          </div>

          {/* Seção 2: Datas, Salário Base e Aviso Prévio */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-stone-300 mb-1">
                Data de Admissão
              </label>
              <input
                type="date"
                value={admissionDate}
                onChange={(e) => setAdmissionDate(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-stone-300 mb-1">
                Data de Desligamento <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={terminationDate}
                onChange={(e) => setTerminationDate(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-stone-300 mb-1">
                Salário Base (R$) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={baseSalaryDisplay}
                onChange={handleBaseSalaryChange}
                onPaste={handleBaseSalaryPaste}
                onFocus={(e) => e.target.select()}
                placeholder="0,00"
                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-stone-300 mb-1">
                Aviso Prévio
              </label>
              <select
                value={noticeType}
                onChange={(e) => setNoticeType(e.target.value as NoticeType)}
                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="indenizado">Indenizado</option>
                <option value="trabalhado">Trabalhado</option>
                <option value="dispensado">Dispensado / N/A</option>
              </select>
            </div>
          </div>

          {/* Seção 3: Parâmetros Férias e Saldo FGTS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 dark:bg-stone-800/40 rounded-xl border border-slate-200/80 dark:border-stone-800">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-stone-300">
                  Férias Vencidas (Períodos Integrais CLT)
                </label>
                {dateAnalysis.contractHasLessThanOneYear ? (
                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                    Trava CLT: R$ 0,00 (&lt; 1 ano)
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500 dark:text-stone-400">
                    Máx. legal: {dateAnalysis.completedAcquisitionPeriods} per.
                  </span>
                )}
              </div>
              <div className="space-y-1.5">
                <input
                  type="number"
                  step="1"
                  min="0"
                  max={dateAnalysis.completedAcquisitionPeriods}
                  disabled={dateAnalysis.contractHasLessThanOneYear}
                  value={vacationExpiredInput}
                  onChange={(e) => handleVacationExpiredChange(e.target.value)}
                  placeholder="0"
                  className={`w-full px-2.5 py-1.5 border rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    dateAnalysis.contractHasLessThanOneYear
                      ? 'bg-slate-100 dark:bg-stone-900 border-slate-200 dark:border-stone-800 text-slate-400 dark:text-stone-500 cursor-not-allowed'
                      : 'bg-white dark:bg-stone-800 border-slate-300 dark:border-stone-700 text-slate-900 dark:text-white'
                  }`}
                />
                
                {/* Botões de Período Inteiro Conforme CLT Art. 130 */}
                <div className="flex items-center gap-1 flex-wrap">
                  {dateAnalysis.contractHasLessThanOneYear ? (
                    <span className="text-[10px] text-slate-500 dark:text-stone-400 italic">
                      Tempo trabalhado quitado nas Férias Proporcionais ({dateAnalysis.vacationProportionalMonths}/12)
                    </span>
                  ) : (
                    Array.from({ length: Math.min(4, dateAnalysis.completedAcquisitionPeriods + 1) }, (_, i) => i).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleVacationExpiredChange(String(preset))}
                        className={`px-2 py-0.5 text-[10px] rounded-md font-bold transition border cursor-pointer ${
                          vacationExpiredPeriods === preset
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                            : 'bg-white dark:bg-stone-800 text-slate-600 dark:text-stone-300 border-slate-200 dark:border-stone-700 hover:bg-slate-100 dark:hover:bg-stone-700'
                        }`}
                      >
                        {preset === 0 ? '0 per.' : `${preset} per. (${preset * 12}m)`}
                      </button>
                    ))
                  )}
                </div>

                {/* Alerta Visual de Parametrização / Trava de Férias */}
                {vacationAlert && (
                  <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-[11px] text-amber-800 dark:text-amber-300 flex items-start justify-between gap-1.5">
                    <div className="flex items-start gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <span className="whitespace-pre-line leading-tight font-medium">{vacationAlert}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setVacationAlert(null)}
                      className="text-amber-700 hover:text-amber-900 dark:text-amber-300 cursor-pointer shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="sm:col-span-2 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-stone-300">
                  Saldo FGTS para Multa ({calculation.fgtsFineRate}%)
                </label>
                <button
                  type="button"
                  onClick={() => setIsManualFgts(!isManualFgts)}
                  className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 underline cursor-pointer"
                >
                  {isManualFgts ? 'Calcular automaticamente' : 'Informar saldo exato'}
                </button>
              </div>

              {isManualFgts ? (
                <div>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={customFgtsBalance}
                    onChange={handleMoneyChange(setCustomFgtsBalance)}
                    onPaste={handleMoneyPaste(setCustomFgtsBalance)}
                    onFocus={(e) => e.target.select()}
                    placeholder="0,00"
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white"
                  />
                  {/* Trava: a base só pode aparecer se o usuário preencher com valor > 0 E a multa for > 0 */}
                  {parseRawOrFormattedToFloat(customFgtsBalance) > 0 && includeFgtsFine && calculation.fgtsFineAmount > 0 && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block mt-1">
                      (Base informada: {formatMoneyBRL(parseRawOrFormattedToFloat(customFgtsBalance))})
                    </span>
                  )}
                </div>
              ) : (
                <div className="px-2.5 py-1.5 bg-slate-200/70 dark:bg-stone-700/60 rounded-lg text-xs text-slate-800 dark:text-stone-200 font-bold flex items-center justify-between">
                  {/* Trava CLT: Se a multa for R$ 0,00 ou não houver saldo real informado, a base estimada é OBRIGATORIAMENTE OCULTADA */}
                  {includeFgtsFine && calculation.fgtsFineAmount > 0 ? (
                    <>
                      <span className="text-slate-700 dark:text-stone-300 font-medium">Estimativa automática da multa</span>
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                        (Multa {calculation.fgtsFineRate}%: {formatMoneyBRL(calculation.fgtsFineAmount)})
                      </span>
                    </>
                  ) : (
                    <span className="text-slate-500 dark:text-stone-400 font-normal text-[11px]">
                      Multa FGTS não inclusa / Sem saldo real informado
                    </span>
                  )}
                </div>
              )}

              {/* Checkbox Multa FGTS */}
              <label className="flex items-center space-x-2 text-xs font-bold text-slate-800 dark:text-stone-200 cursor-pointer pt-0.5">
                <input
                  type="checkbox"
                  checked={includeFgtsFine}
                  onChange={(e) => setIncludeFgtsFine(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                />
                <span>Calcular Multa do FGTS ({calculation.fgtsFineRate}%)</span>
              </label>
            </div>
          </div>

          {/* Seção 4: Deduções e Ajustes Financeiros */}
          <div className="p-3 bg-slate-50 dark:bg-stone-800/40 rounded-xl border border-slate-200/80 dark:border-stone-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="block text-xs font-black text-slate-800 dark:text-stone-200">
                Ajuste de Deduções Rescisórias
              </span>

              {/* Checkbox Desconto de INSS */}
              <label className="flex items-center space-x-2 text-xs font-bold text-slate-800 dark:text-stone-200 cursor-pointer bg-white dark:bg-stone-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-stone-700 shadow-2xs">
                <input
                  type="checkbox"
                  checked={includeInssDiscount}
                  onChange={(e) => setIncludeInssDiscount(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                />
                <span>Calcular Desconto de INSS</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-stone-400 mb-1">
                  Vales / Adiantamentos em Aberto (R$)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={customAdvancesDiscount}
                  onChange={handleMoneyChange(setCustomAdvancesDiscount)}
                  onPaste={handleMoneyPaste(setCustomAdvancesDiscount)}
                  onFocus={(e) => e.target.select()}
                  placeholder="0,00"
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-stone-400 mb-1">
                  Faltas e Atrasos Injustificados (R$)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={customAbsencesDiscount}
                  onChange={handleMoneyChange(setCustomAbsencesDiscount)}
                  onPaste={handleMoneyPaste(setCustomAbsencesDiscount)}
                  onFocus={(e) => e.target.select()}
                  placeholder="0,00"
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-stone-400 mb-1">
                  Outras Deduções / Convênios (R$)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={otherDeductionsInput}
                  onChange={handleMoneyChange(setOtherDeductionsInput)}
                  onPaste={handleMoneyPaste(setOtherDeductionsInput)}
                  onFocus={(e) => e.target.select()}
                  placeholder="0,00"
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400"
                />
              </div>
            </div>
          </div>

          {/* Opção de Inativar Funcionário e Observações */}
          <div className="pt-2 border-t border-slate-200 dark:border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <label className="flex items-center space-x-2 text-xs font-bold text-slate-800 dark:text-stone-200 cursor-pointer">
              <input
                type="checkbox"
                checked={markInactive}
                onChange={(e) => setMarkInactive(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
              />
              <span>Atualizar status do colaborador para "Inativo / Desligado" no sistema</span>
            </label>

            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={() => setIsCalculationModalOpen(false)}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-slate-700 dark:text-stone-300 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                <span>Cancelar</span>
              </button>

              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={isSavingDraft || !selectedEmployee}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white rounded-xl text-xs font-black transition shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                title="Salvar rascunho em andamento sem alterar o colaborador para inativo"
              >
                {isSavingDraft ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <BookmarkCheck className="w-4 h-4" />
                )}
                <span>{isSavingDraft ? 'Salvando Rascunho...' : 'Salvar Rascunho'}</span>
              </button>

              <button
                type="button"
                onClick={handleSaveTermination}
                disabled={!selectedEmployee}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-black transition shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                <span>Homologar Rescisão</span>
              </button>
            </div>
          </div>

        </div>

        {/* Resumo em Destaque (4 colunas) */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* Card Principal de Valor Líquido */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-2xl border border-slate-700 shadow-md space-y-3">
            <div className="flex items-center justify-between text-slate-300 text-xs">
              <span className="uppercase font-bold tracking-wider">Valor Líquido a Pagar</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                CLT Oficial
              </span>
            </div>

            <div className="text-2xl sm:text-3xl font-black text-emerald-400 tracking-tight">
              {formatMoneyBRL(calculation.netTotal)}
            </div>

            <div className="pt-3 border-t border-slate-700/80 space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <span>Total Bruto Proventos:</span>
                <span className="font-bold text-white">{formatMoneyBRL(calculation.grossTotal)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>Total Deduções:</span>
                <span className="font-bold text-rose-400">- {formatMoneyBRL(calculation.totalDeductions)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-300 pt-1 border-t border-slate-700/50">
                <span>Multa FGTS ({calculation.fgtsFineRate}%):</span>
                <span className="font-bold text-amber-300 flex items-center gap-1.5">
                  {includeFgtsFine ? formatMoneyBRL(calculation.fgtsFineAmount) : 'R$ 0,00'}
                  {includeFgtsFine ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                      Inclusa
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/80 text-slate-400 font-normal">
                      Não inclusa
                    </span>
                  )}
                </span>
              </div>
            </div>

            {selectedEmployee && (
              <button
                type="button"
                onClick={() => {
                  setViewingTRCT({
                    id: editingTerminationId || 'temp_preview',
                    employeeId: selectedEmployee.id,
                    employeeName: selectedEmployee.name,
                    employeeRole: selectedEmployee.role,
                    employeeCpf: selectedEmployee.cpf,
                    admissionDate: admissionDate || selectedEmployee.admissionDate || '',
                    terminationDate,
                    reason,
                    noticeType,
                    baseSalary,
                    calculation,
                    includeFgtsFine,
                    includeInssDiscount,
                    customFgtsBalance,
                    isManualFgts,
                    status: 'rascunho',
                    createdAt: new Date().toISOString(),
                  });
                }}
                className="w-full mt-2 inline-flex items-center justify-center space-x-2 px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition border border-white/15 cursor-pointer"
              >
                <Printer className="w-4 h-4 text-emerald-400" />
                <span>Imprimir Termo de Rescisão (TRCT)</span>
              </button>
            )}
          </div>

          {/* Discriminação Rápida das Verbas */}
          <div className="bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-800 rounded-2xl p-4 shadow-xs space-y-2 text-xs">
            <h3 className="font-black text-slate-900 dark:text-white border-b border-slate-200 dark:border-stone-800 pb-2 flex items-center justify-between">
              <span>Discriminação das Verbas</span>
              <span className="text-[10px] font-normal text-slate-500">Regras CLT</span>
            </h3>

            <div className="space-y-1.5 text-slate-600 dark:text-stone-300">
              <div className="flex justify-between">
                <span>Saldo Salário ({calculation.workedDaysCurrentMonth}d):</span>
                <span className="font-bold text-slate-900 dark:text-white">{formatMoneyBRL(calculation.salaryBalance)}</span>
              </div>

              {calculation.noticeAmount > 0 && (
                <div className="flex justify-between">
                  <span>Aviso Prévio ({calculation.noticeDays}d):</span>
                  <span className="font-bold text-slate-900 dark:text-white">{formatMoneyBRL(calculation.noticeAmount)}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span>13º Salário ({calculation.thirteenthProportionalMonths}/12):</span>
                <span className="font-bold text-slate-900 dark:text-white">{formatMoneyBRL(calculation.thirteenthProportionalAmount)}</span>
              </div>

              {calculation.vacationExpiredAmount > 0 && (
                <div className="flex justify-between">
                  <span>Férias Vencidas ({calculation.vacationExpiredCount.toString().replace('.', ',')} per.):</span>
                  <span className="font-bold text-slate-900 dark:text-white">{formatMoneyBRL(calculation.vacationExpiredAmount)}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span>Férias Prop. ({calculation.vacationProportionalMonths}/12):</span>
                <span className="font-bold text-slate-900 dark:text-white">{formatMoneyBRL(calculation.vacationProportionalAmount)}</span>
              </div>

              <div className="flex justify-between">
                <span>1/3 Constitucional Férias:</span>
                <span className="font-bold text-slate-900 dark:text-white">{formatMoneyBRL(calculation.vacationOneThirdBonus)}</span>
              </div>

              {includeFgtsFine ? (
                calculation.fgtsFineAmount > 0 && (
                  <div className="flex justify-between text-amber-600 dark:text-amber-400 font-bold">
                    <span>Multa Rescisória FGTS ({calculation.fgtsFineRate}%):</span>
                    <span>{formatMoneyBRL(calculation.fgtsFineAmount)}</span>
                  </div>
                )
              ) : (
                <div className="flex justify-between text-slate-400 dark:text-stone-500 italic text-[11px]">
                  <span>Multa Rescisória FGTS ({calculation.fgtsFineRate}%):</span>
                  <span>R$ 0,00 (Desmarcada)</span>
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 dark:border-stone-800 space-y-1 text-rose-600 dark:text-rose-400">
                {includeInssDiscount ? (
                  <>
                    <div className="flex justify-between">
                      <span>INSS Saldo de Salário:</span>
                      <span className="font-bold">- {formatMoneyBRL(calculation.inssSalaryBalance)}</span>
                    </div>
                    {calculation.inssThirteenth > 0 && (
                      <div className="flex justify-between">
                        <span>INSS 13º Salário:</span>
                        <span className="font-bold">- {formatMoneyBRL(calculation.inssThirteenth)}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex justify-between text-slate-400 dark:text-stone-500 italic text-[11px]">
                    <span>Desconto de INSS:</span>
                    <span>Não aplicado (Isento)</span>
                  </div>
                )}
                {calculation.advancesDiscount > 0 && (
                  <div className="flex justify-between">
                    <span>Vales e Adiantamentos:</span>
                    <span className="font-bold">- {formatMoneyBRL(calculation.advancesDiscount)}</span>
                  </div>
                )}
                {calculation.absenceDiscount > 0 && (
                  <div className="flex justify-between">
                    <span>Faltas e Atrasos:</span>
                    <span className="font-bold">- {formatMoneyBRL(calculation.absenceDiscount)}</span>
                  </div>
                )}
                {calculation.noticeDeduction > 0 && (
                  <div className="flex justify-between">
                    <span>Aviso Prévio Não Cumprido:</span>
                    <span className="font-bold">- {formatMoneyBRL(calculation.noticeDeduction)}</span>
                  </div>
                )}
                {calculation.otherDeductions > 0 && (
                  <div className="flex justify-between">
                    <span>Outras Deduções:</span>
                    <span className="font-bold">- {formatMoneyBRL(calculation.otherDeductions)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>

        </div>
      </ResignCalculationModal>

      {/* ========================================================================= */}
      {/* 4. MODAL DE IMPRESSÃO DO TERMO DE RESCISÃO (TRCT OFICIAL)                 */}
      {/* ========================================================================= */}
      {viewingTRCT && (
        <div className="modal-trct trct-modal-container fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto print:static print:p-0 print:m-0 print:bg-white print:overflow-visible">
          <div className="modal-trct trct-modal-wrapper bg-white text-black w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden my-auto border border-slate-200 print:shadow-none print:border-none print:m-0 print:rounded-none">
            
            {/* Barra Superior com Controles */}
            <div className="no-print header-modal-trct bg-slate-900 text-white p-3 sm:p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-emerald-400" />
                <span className="text-xs sm:text-sm font-black">
                  Termo de Rescisão do Contrato de Trabalho (TRCT)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn-print-action px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs relative z-20 pointer-events-auto"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir / Salvar PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (viewingTRCT && isSupabaseConfigured) {
                      upsertRhRescisaoRecord(viewingTRCT, activeTenantId).catch(() => {});
                    }
                    setViewingTRCT(null);
                  }}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Documento Imprimível A4 */}
            <div id="trct-print-area" className="modal-trct trct-print-document p-6 sm:p-8 space-y-3 text-xs font-sans bg-white print:p-0 print:space-y-1.5">
              
              {/* Cabeçalho da Empresa */}
              <div className="block-rescisao trct-avoid-break flex items-start justify-between border-b-2 border-black pb-2.5 gap-3 print:pb-1.5">
                <div className="flex items-center gap-3">
                  {companyProfile?.logoUrl ? (
                    <img 
                      src={companyProfile.logoUrl} 
                      alt="Logo" 
                      className="h-12 w-auto max-w-[110px] object-contain print:h-10" 
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="p-2 border-2 border-black font-black text-sm tracking-tighter print:p-1.5">
                      {companyProfile?.tradeName || companyProfile?.corporateName || 'EMPRESA'}
                    </div>
                  )}
                  <div>
                    <h1 className="font-black text-sm sm:text-base uppercase tracking-tight text-black print:text-sm">
                      {companyProfile?.corporateName || companyProfile?.tradeName || 'Razão Social da Empresa'}
                    </h1>
                    <p className="text-[11px] font-semibold text-slate-700 print:text-black print:text-[10px]">
                      CNPJ/CPF: {companyProfile?.cnpjCpf || companyProfile?.cnpj || 'Não informado'}
                    </p>
                    <p className="text-[10px] text-slate-600 print:text-black print:text-[9px]">
                      {[companyProfile?.address, companyProfile?.number, companyProfile?.neighborhood, companyProfile?.city, companyProfile?.state]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                    {companyProfile?.phone && (
                      <p className="text-[10px] font-bold text-slate-800 print:text-black print:text-[9px] flex items-center gap-1">
                        <Phone className="w-2.5 h-2.5" />
                        {companyProfile.phone}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-black text-xs sm:text-sm uppercase tracking-tight block border border-black px-2 py-1 bg-slate-100 print:bg-white text-black print:py-0.5">
                    TRCT - TERMO RESCISÓRIO
                  </span>
                  <span className="text-[10px] text-slate-600 print:text-black print:text-[9px] font-mono mt-0.5 block">
                    Emissão: {new Date().toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>

              {/* Dados do Contrato e Empregado */}
              <div className="block-rescisao trct-avoid-break border border-black p-2.5 rounded-md space-y-1.5 bg-slate-50/50 print:bg-white print:p-1.5">
                <div className="font-bold text-[11px] uppercase border-b border-black pb-1 text-black print:text-[10px] print:pb-0.5">
                  Identificação do Empregado e do Contrato de Trabalho
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 print:gap-1">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-600 print:text-black print:text-[9px]">Nome do Empregado:</span>
                    <span className="font-bold text-xs text-black print:text-[10px]">{viewingTRCT.employeeName}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-600 print:text-black print:text-[9px]">CPF:</span>
                    <span className="font-semibold text-black print:text-[9.5px]">{formatCPF(viewingTRCT.employeeCpf)}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-600 print:text-black print:text-[9px]">Cargo / Função:</span>
                    <span className="font-semibold text-black print:text-[9.5px]">{viewingTRCT.employeeRole || 'Geral'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-600 print:text-black print:text-[9px]">Salário Base:</span>
                    <span className="font-bold text-emerald-700 print:text-black print:text-[10px]">{formatMoneyBRL(viewingTRCT.baseSalary)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-black print:gap-1 print:pt-0.5">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-600 print:text-black print:text-[9px]">Data Admissão:</span>
                    <span className="font-semibold text-black print:text-[9.5px]">{formatEmployeeAdmissionDate(viewingTRCT.admissionDate)}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-600 print:text-black print:text-[9px]">Data Afastamento:</span>
                    <span className="font-semibold text-black print:text-[9.5px]">{formatDateBR(viewingTRCT.terminationDate)}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-600 print:text-black print:text-[9px]">Aviso Prévio:</span>
                    <span className="font-semibold capitalize text-black print:text-[9.5px]">{viewingTRCT.noticeType} ({viewingTRCT.calculation.noticeDays} dias)</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-600 print:text-black print:text-[9px]">Causa do Afastamento:</span>
                    <span className="font-semibold text-black print:text-[9.5px]">{getReasonLabel(viewingTRCT.reason)}</span>
                  </div>
                </div>
              </div>

              {/* Tabela de Verbas Rescisórias (Proventos) */}
              <div className="block-rescisao trct-avoid-break border border-black rounded-md overflow-hidden">
                <div className="bg-slate-200 print:bg-slate-100 font-black text-[11px] uppercase p-1.5 border-b border-black text-black print:text-[10px] print:py-0.5">
                  Discriminação das Verbas Rescisórias (Proventos)
                </div>
                <table className="w-full text-left text-[11px] border-collapse print:text-[10px]">
                  <thead>
                    <tr className="border-b border-black bg-slate-50 print:bg-white font-bold text-black">
                      <th className="py-1 px-2 w-16 border-r border-black/30 print:py-0.5">Rubrica</th>
                      <th className="py-1 px-2 border-r border-black/30 print:py-0.5">Descrição</th>
                      <th className="py-1 px-2 w-28 text-center border-r border-black/30 print:py-0.5">Referência</th>
                      <th className="py-1 px-2 text-right w-28 print:py-0.5">Valor (R$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/20 text-black">
                    <tr>
                      <td className="py-1 px-2 font-mono border-r border-black/20 print:py-0.5">01</td>
                      <td className="py-1 px-2 border-r border-black/20 print:py-0.5">Saldo de Salário</td>
                      <td className="py-1 px-2 text-center border-r border-black/20 print:py-0.5">{viewingTRCT.calculation.workedDaysCurrentMonth} dias</td>
                      <td className="py-1 px-2 text-right font-bold print:py-0.5">{formatMoneyBRL(viewingTRCT.calculation.salaryBalance)}</td>
                    </tr>
                    {viewingTRCT.calculation.noticeAmount > 0 && (
                      <tr>
                        <td className="py-1 px-2 font-mono border-r border-black/20 print:py-0.5">02</td>
                        <td className="py-1 px-2 border-r border-black/20 print:py-0.5">Aviso Prévio Indenizado</td>
                        <td className="py-1 px-2 text-center border-r border-black/20 print:py-0.5">{viewingTRCT.calculation.noticeDays} dias</td>
                        <td className="py-1 px-2 text-right font-bold print:py-0.5">{formatMoneyBRL(viewingTRCT.calculation.noticeAmount)}</td>
                      </tr>
                    )}
                    <tr>
                      <td className="py-1 px-2 font-mono border-r border-black/20 print:py-0.5">03</td>
                      <td className="py-1 px-2 border-r border-black/20 print:py-0.5">13º Salário Proporcional</td>
                      <td className="py-1 px-2 text-center border-r border-black/20 print:py-0.5">{viewingTRCT.calculation.thirteenthProportionalMonths}/12 avos</td>
                      <td className="py-1 px-2 text-right font-bold print:py-0.5">{formatMoneyBRL(viewingTRCT.calculation.thirteenthProportionalAmount)}</td>
                    </tr>
                    {viewingTRCT.calculation.vacationExpiredAmount > 0 && (
                      <tr>
                        <td className="py-1 px-2 font-mono border-r border-black/20 print:py-0.5">04</td>
                        <td className="py-1 px-2 border-r border-black/20 print:py-0.5">Férias Vencidas</td>
                        <td className="py-1 px-2 text-center border-r border-black/20 print:py-0.5">{viewingTRCT.calculation.vacationExpiredCount.toString().replace('.', ',')} período(s)</td>
                        <td className="py-1 px-2 text-right font-bold print:py-0.5">{formatMoneyBRL(viewingTRCT.calculation.vacationExpiredAmount)}</td>
                      </tr>
                    )}
                    <tr>
                      <td className="py-1 px-2 font-mono border-r border-black/20 print:py-0.5">05</td>
                      <td className="py-1 px-2 border-r border-black/20 print:py-0.5">Férias Proporcionais</td>
                      <td className="py-1 px-2 text-center border-r border-black/20 print:py-0.5">{viewingTRCT.calculation.vacationProportionalMonths}/12 avos</td>
                      <td className="py-1 px-2 text-right font-bold print:py-0.5">{formatMoneyBRL(viewingTRCT.calculation.vacationProportionalAmount)}</td>
                    </tr>
                    <tr>
                      <td className="py-1 px-2 font-mono border-r border-black/20 print:py-0.5">06</td>
                      <td className="py-1 px-2 border-r border-black/20 print:py-0.5">1/3 Constitucional sobre Férias</td>
                      <td className="py-1 px-2 text-center border-r border-black/20 print:py-0.5">Art. 7º CF</td>
                      <td className="py-1 px-2 text-right font-bold print:py-0.5">{formatMoneyBRL(viewingTRCT.calculation.vacationOneThirdBonus)}</td>
                    </tr>
                    {viewingTRCT.calculation.includeFgtsFine && viewingTRCT.calculation.fgtsFineAmount > 0 && (
                      <tr>
                        <td className="py-1 px-2 font-mono border-r border-black/20 print:py-0.5">07</td>
                        <td className="py-1 px-2 border-r border-black/20 print:py-0.5">Multa Rescisória FGTS ({viewingTRCT.calculation.fgtsFineRate}%)</td>
                        <td className="py-1 px-2 text-center border-r border-black/20 print:py-0.5">Art. 18 Lei 8.036</td>
                        <td className="py-1 px-2 text-right font-bold print:py-0.5">{formatMoneyBRL(viewingTRCT.calculation.fgtsFineAmount)}</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 print:bg-white font-black border-t-2 border-black">
                      <td colSpan={3} className="py-1 px-2 text-right text-black print:py-0.5">TOTAL BRUTO DOS PROVENTOS:</td>
                      <td className="py-1 px-2 text-right text-emerald-800 print:text-black font-black print:py-0.5">{formatMoneyBRL(viewingTRCT.calculation.grossTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Tabela de Deduções */}
              <div className="block-rescisao trct-avoid-break border border-black rounded-md overflow-hidden">
                <div className="bg-slate-200 print:bg-slate-100 font-black text-[11px] uppercase p-1.5 border-b border-black text-black print:text-[10px] print:py-0.5">
                  Deduções e Descontos Rescisórios
                </div>
                <table className="w-full text-left text-[11px] border-collapse print:text-[10px]">
                  <thead>
                    <tr className="border-b border-black bg-slate-50 print:bg-white font-bold text-black">
                      <th className="py-1 px-2 w-16 border-r border-black/30 print:py-0.5">Rubrica</th>
                      <th className="py-1 px-2 border-r border-black/30 print:py-0.5">Descrição</th>
                      <th className="py-1 px-2 text-right w-28 print:py-0.5">Valor (R$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/20 text-black">
                    {viewingTRCT.calculation.includeInssDiscount !== false ? (
                      <>
                        <tr>
                          <td className="py-1 px-2 font-mono border-r border-black/20 print:py-0.5">101</td>
                          <td className="py-1 px-2 border-r border-black/20 print:py-0.5">Previdência Social (INSS Saldo de Salário)</td>
                          <td className="py-1 px-2 text-right font-bold text-rose-700 print:text-black print:py-0.5">{formatMoneyBRL(viewingTRCT.calculation.inssSalaryBalance)}</td>
                        </tr>
                        {viewingTRCT.calculation.inssThirteenth > 0 && (
                          <tr>
                            <td className="py-1 px-2 font-mono border-r border-black/20 print:py-0.5">102</td>
                            <td className="py-1 px-2 border-r border-black/20 print:py-0.5">Previdência Social (INSS sobre 13º Salário)</td>
                            <td className="py-1 px-2 text-right font-bold text-rose-700 print:text-black print:py-0.5">{formatMoneyBRL(viewingTRCT.calculation.inssThirteenth)}</td>
                          </tr>
                        )}
                      </>
                    ) : (
                      <tr>
                        <td className="py-1 px-2 font-mono border-r border-black/20 print:py-0.5">101</td>
                        <td className="py-1 px-2 text-slate-500 print:text-black italic border-r border-black/20 print:py-0.5">Previdência Social (INSS) - Desconto Desativado / Isento</td>
                        <td className="py-1 px-2 text-right font-bold text-slate-500 print:text-black print:py-0.5">R$ 0,00</td>
                      </tr>
                    )}
                    {viewingTRCT.calculation.advancesDiscount > 0 && (
                      <tr>
                        <td className="py-1 px-2 font-mono border-r border-black/20 print:py-0.5">103</td>
                        <td className="py-1 px-2 border-r border-black/20 print:py-0.5">Vales e Adiantamentos Salariais em Aberto</td>
                        <td className="py-1 px-2 text-right font-bold text-rose-700 print:text-black print:py-0.5">{formatMoneyBRL(viewingTRCT.calculation.advancesDiscount)}</td>
                      </tr>
                    )}
                    {viewingTRCT.calculation.absenceDiscount > 0 && (
                      <tr>
                        <td className="py-1 px-2 font-mono border-r border-black/20 print:py-0.5">104</td>
                        <td className="py-1 px-2 border-r border-black/20 print:py-0.5">Faltas e Atrasos Injustificados</td>
                        <td className="py-1 px-2 text-right font-bold text-rose-700 print:text-black print:py-0.5">{formatMoneyBRL(viewingTRCT.calculation.absenceDiscount)}</td>
                      </tr>
                    )}
                    {viewingTRCT.calculation.noticeDeduction > 0 && (
                      <tr>
                        <td className="py-1 px-2 font-mono border-r border-black/20 print:py-0.5">105</td>
                        <td className="py-1 px-2 border-r border-black/20 print:py-0.5">Aviso Prévio Não Cumprido (Desconto Art. 487 CLT)</td>
                        <td className="py-1 px-2 text-right font-bold text-rose-700 print:text-black print:py-0.5">{formatMoneyBRL(viewingTRCT.calculation.noticeDeduction)}</td>
                      </tr>
                    )}
                    {viewingTRCT.calculation.otherDeductions > 0 && (
                      <tr>
                        <td className="py-1 px-2 font-mono border-r border-black/20 print:py-0.5">106</td>
                        <td className="py-1 px-2 border-r border-black/20 print:py-0.5">Outras Deduções Autorizadas</td>
                        <td className="py-1 px-2 text-right font-bold text-rose-700 print:text-black print:py-0.5">{formatMoneyBRL(viewingTRCT.calculation.otherDeductions)}</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 print:bg-white font-black border-t-2 border-black">
                      <td colSpan={2} className="py-1 px-2 text-right text-black print:py-0.5">TOTAL GERAL DAS DEDUÇÕES:</td>
                      <td className="py-1 px-2 text-right text-rose-800 print:text-black font-black print:py-0.5">{formatMoneyBRL(viewingTRCT.calculation.totalDeductions)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Quadro Resumo com Líquido e Multa FGTS */}
              <div className="block-rescisao trct-avoid-break grid grid-cols-1 sm:grid-cols-2 gap-2 border-2 border-black p-2.5 rounded-md bg-slate-50 print:bg-white print:p-1.5">
                <div>
                  <span className="text-[10px] font-bold text-slate-600 print:text-black block uppercase print:text-[9px]">Multa Rescisória FGTS ({viewingTRCT.calculation.fgtsFineRate}%):</span>
                  <span className="text-sm font-bold text-black print:text-xs">
                    {formatMoneyBRL(viewingTRCT.calculation.fgtsFineAmount)}
                  </span>
                  {/* TRAVA DE EXIBIÇÃO: Oculta obrigatoriamente a base se a multa for R$ 0,00 ou não houver saldo real informado > 0 */}
                  {(() => {
                    const rawCustomFgts = parseRawOrFormattedToFloat(viewingTRCT.customFgtsBalance || '');
                    const hasRealFgtsInformed = Boolean(viewingTRCT.isManualFgts && rawCustomFgts > 0);
                    const shouldShowBase = viewingTRCT.calculation.fgtsFineAmount > 0 && hasRealFgtsInformed;

                    if (!shouldShowBase) return null;

                    return (
                      <span className="text-[10px] text-slate-500 print:text-black block print:text-[8.5px]">
                        (Base informada: {formatMoneyBRL(rawCustomFgts)})
                      </span>
                    );
                  })()}
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-black text-slate-600 print:text-black block uppercase print:text-[9px]">VALOR LÍQUIDO A RECEBER:</span>
                  <span className="text-xl sm:text-2xl font-black text-emerald-800 print:text-black print:text-lg">
                    {formatMoneyBRL(viewingTRCT.calculation.netTotal)}
                  </span>
                </div>
              </div>

              {/* Container Exclusivo e Indivisível de Quitação e Assinaturas (Sem quebras de página) */}
              <div className="block-rescisao trct-signature-block trct-avoid-break pt-1.5 space-y-2 print:pt-1 print:space-y-1.5">
                
                {/* Termo de Quitação */}
                <p className="text-[9.5px] text-slate-700 print:text-black text-justify leading-relaxed print:text-[8.5px] print:leading-tight m-0">
                  Foi prestada, sem ônus para o empregado, a assistência e conferência da presente rescisão contratual, tendo o colaborador recebido os valores líquidos discriminados acima, dando plena e geral quitação das parcelas expressamente consignadas neste termo.
                </p>

                {/* Linhas de Assinatura com textos centralizados e margem correta */}
                <div className="pt-4 pb-2 grid grid-cols-2 gap-8 text-center text-xs print:pt-3 print:gap-6 print:pb-0">
                  <div className="trct-signature-box border-t-2 border-black pt-1.5 flex flex-col items-center justify-center text-center">
                    <span className="font-bold uppercase text-black block text-[11px] leading-normal print:text-[9.5px] max-w-[90%] truncate">
                      {companyProfile?.tradeName || companyProfile?.corporateName || 'Empregador'}
                    </span>
                    <span className="text-[9.5px] text-slate-600 print:text-black mt-0.5 block font-medium print:text-[8px]">
                      Assinatura do Empregador / Responsável
                    </span>
                  </div>

                  <div className="trct-signature-box border-t-2 border-black pt-1.5 flex flex-col items-center justify-center text-center">
                    <span className="font-bold uppercase text-black block text-[11px] leading-normal print:text-[9.5px] max-w-[90%] truncate">
                      {viewingTRCT.employeeName}
                    </span>
                    <span className="text-[9.5px] text-slate-600 print:text-black mt-0.5 block font-medium print:text-[8px]">
                      Assinatura do Empregado / Colaborador
                    </span>
                  </div>
                </div>

              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
};
