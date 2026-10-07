import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Wrench, 
  Plus, 
  Search, 
  Filter, 
  DollarSign, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Edit3, 
  Trash2, 
  Layers,
  Sparkles,
  MapPin,
  UserCheck,
  Package,
  ShoppingCart,
  Printer,
  FileText,
  CreditCard,
  Building2,
  Truck,
  Tag,
  Hammer,
  Eye,
  X
} from 'lucide-react';
import { MaintenanceLog, Machinery, CompanyProfile, MaintenancePurchaseRequest, MaintenanceCategoryDefinition } from '../../types';
import { formatCurrencyBRL, formatDateBR, getStoredMaintenanceCategories, saveStoredMaintenanceCategories, getActiveCompanyId, saveStoredMaintenanceLogs } from '../../lib/storage';
import { supabase } from '../../lib/supabaseClient';
import { isSupabaseConfigured, deleteCloudMaintenanceLog, mapRowToMaintenanceLog, toValidUUID } from '../../lib/supabaseService';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import { MaintenanceDetailModal } from './MaintenanceDetailModal';
import { MaintenancePurchaseModal } from './MaintenancePurchaseModal';
import { MaintenanceCategoriesModal } from './MaintenanceCategoriesModal';

interface FleetMaintenanceViewProps {
  maintenanceLogs: MaintenanceLog[];
  machineries: Machinery[];
  companyProfile?: CompanyProfile;
  purchaseRequests?: MaintenancePurchaseRequest[];
  onSavePurchaseRequests?: (requests: MaintenancePurchaseRequest[]) => void;
  onOpenNewMaintenance: () => void;
  onEditMaintenance: (log: MaintenanceLog) => void;
  onDeleteMaintenance: (id: string) => void;
  onUpdateStatus: (id: string, newStatus: MaintenanceLog['status']) => void;
}

export const FleetMaintenanceView: React.FC<FleetMaintenanceViewProps> = ({
  maintenanceLogs,
  machineries,
  companyProfile,
  purchaseRequests = [],
  onSavePurchaseRequests,
  onOpenNewMaintenance,
  onEditMaintenance,
  onDeleteMaintenance,
  onUpdateStatus,
}) => {
  const { currentUser } = useAuth();
  const { confirm } = useConfirm();
  const [localLogs, setLocalLogs] = useState<MaintenanceLog[]>(() => maintenanceLogs);

  // Sincroniza estado local com as props quando houver atualização externa
  useEffect(() => {
    setLocalLogs((prev) => {
      if (JSON.stringify(prev) === JSON.stringify(maintenanceLogs)) return prev;
      return maintenanceLogs;
    });
  }, [maintenanceLogs]);

  const onDeleteMaintenanceRef = useRef(onDeleteMaintenance);
  useEffect(() => {
    onDeleteMaintenanceRef.current = onDeleteMaintenance;
  }, [onDeleteMaintenance]);

  // Listener em tempo real (Supabase Realtime) escutando eventos na tabela oficial 'manutencoes'
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const companyId = companyProfile?.id || getActiveCompanyId();
    const channelId = `manutencoes_view_rt_${companyId || 'default'}`;

    const existingChannels = supabase.getChannels?.() || [];
    for (const ch of existingChannels) {
      if (ch.topic === channelId || ch.topic === `realtime:${channelId}`) {
        try { supabase.removeChannel(ch); } catch (_) {}
      }
    }

    const handlePayload = (payload: any) => {
      if (payload.eventType === 'DELETE') {
        const delId = payload.old?.id;
        if (delId) {
          setLocalLogs(prev => prev.filter(m => m.id !== delId && toValidUUID(m.id) !== delId));
          onDeleteMaintenanceRef.current?.(delId);
        }
      } else if (payload.eventType === 'INSERT' && payload.new) {
        const item = mapRowToMaintenanceLog(payload.new);
        setLocalLogs(prev => {
          const exists = prev.some(m => m.id === item.id || toValidUUID(m.id) === item.id);
          if (exists) {
            return prev.map(m => (m.id === item.id || toValidUUID(m.id) === item.id) ? { ...m, ...item } : m);
          }
          return [item, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        });
        window.dispatchEvent(new CustomEvent('silagem_maintenance_changed', { detail: item }));
      } else if (payload.eventType === 'UPDATE' && payload.new) {
        const item = mapRowToMaintenanceLog(payload.new);
        setLocalLogs(prev => prev.map(m => (m.id === item.id || toValidUUID(m.id) === item.id) ? { ...m, ...item } : m));
        window.dispatchEvent(new CustomEvent('silagem_maintenance_changed', { detail: item }));
      }
    };

    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'manutencoes' },
        handlePayload
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'frotas_manutencoes' },
        handlePayload
      )
      .on(
        'broadcast',
        { event: 'delete_manutencao' },
        (payload: any) => {
          const delId = payload.payload?.id;
          if (delId) {
            setLocalLogs(prev => prev.filter(m => m.id !== delId && toValidUUID(m.id) !== delId));
            onDeleteMaintenanceRef.current?.(delId);
          }
        }
      )
      .subscribe();

    const handleLocal = (e: any) => {
      const delId = e.detail?.id;
      if (delId) {
        setLocalLogs(prev => prev.filter(m => m.id !== delId && toValidUUID(m.id) !== delId));
      }
    };
    window.addEventListener('silagem_maintenance_deleted', handleLocal);

    return () => {
      window.removeEventListener('silagem_maintenance_deleted', handleLocal);
      try { supabase.removeChannel(channel); } catch (_) {}
    };
  }, [companyProfile?.id]);

  // Função rigorosa de exclusão física no Supabase com amarração por usuário ativo e atualização reativa
  const handleDeleteOrdem = async (ordemId: string) => {
    const isConfirmed = await confirm({
      title: 'Excluir Ordem de Manutenção',
      message: 'Deseja realmente excluir esta ordem de serviço/manutenção? Esta ação é definitiva.',
      confirmLabel: 'Sim, Excluir',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });
    if (!isConfirmed) return;

    try {
      // 1. Identifica o usuário ativo para amarração de segurança RLS
      let currentUserId = currentUser?.id || currentUser?.uid;
      if (!currentUserId && isSupabaseConfigured) {
        try {
          const { data: authData } = await supabase.auth.getUser();
          currentUserId = authData?.user?.id;
        } catch (_) {}
      }

      const cId = companyProfile?.id || getActiveCompanyId();

      // 2. Execução do Comando Físico no Supabase com amarração por usuário ativo na tabela 'manutencoes'
      if (isSupabaseConfigured) {
        let query = supabase.from('manutencoes').delete().eq('id', ordemId);
        if (currentUserId) {
          query = query.eq('user_id', currentUserId);
        }
        const { error } = await query;
        if (error) {
          console.warn('[Manutenções] Erro no delete de manutencoes com user_id, tentando por id direto:', error.message);
          await supabase.from('manutencoes').delete().eq('id', ordemId);
        } else {
          await supabase.from('manutencoes').delete().eq('id', ordemId);
        }

        // Tenta também em frotas_manutencoes para limpeza legada se existir
        try {
          await supabase.from('frotas_manutencoes').delete().eq('id', ordemId);
        } catch (_) {}

        // Limpeza de contingência no espelho site_settings para que F5 não ressuscite a OS
        await deleteCloudMaintenanceLog(ordemId, currentUserId, cId);

        // Propagação via Supabase Realtime para que suma simultaneamente em todos os outros dispositivos abertos
        try {
          const rtChannel = supabase.channel(`manutencoes_rt_broadcast_${Date.now()}`);
          let channelCleaned = false;
          const cleanUpChannel = () => {
            if (channelCleaned) return;
            channelCleaned = true;
            try { supabase.removeChannel(rtChannel); } catch (_) {}
          };
          const safetyTimer = setTimeout(cleanUpChannel, 3000);

          rtChannel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              rtChannel.send({
                type: 'broadcast',
                event: 'delete_manutencao',
                payload: { id: ordemId, user_id: currentUserId, company_id: cId }
              }).finally(() => {
                setTimeout(cleanUpChannel, 500);
              });
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
              clearTimeout(safetyTimer);
              cleanUpChannel();
            }
          });
        } catch (_) {}
      }

      // 3. Atualização Reativa e Sincronizada:
      // Remove o registro do estado local do componente imediatamente
      const nextLogs = localLogs.filter(m => m.id !== ordemId);
      setLocalLogs(nextLogs);
      saveStoredMaintenanceLogs(nextLogs);
      onDeleteMaintenance(ordemId);

      // Propaga evento local para sincronização em tempo real imediata na mesma janela
      window.dispatchEvent(new CustomEvent('silagem_maintenance_deleted', { detail: { id: ordemId } }));
    } catch (err) {
      console.error('Falha ao excluir ordem de manutenção:', err);
    }
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('todos');
  const [selectedVehicle, setSelectedVehicle] = useState<string>('todos');
  const [selectedStatus, setSelectedStatus] = useState<string>('todos');
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');
  const [selectedLocation, setSelectedLocation] = useState<string>('todos');
  const [selectedPartsOrigin, setSelectedPartsOrigin] = useState<string>('todos');

  // Modais de Laudo e Compras
  const [viewingLog, setViewingLog] = useState<MaintenanceLog | null>(null);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);

  /* CARD REFORMA & ENTRESSAFRA: FILTRO DE CLIQUE (OPCIONAL) */
  const [filterReformaOnly, setFilterReformaOnly] = useState(false);

  // Manipulador rápido do filtro por Mês
  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedMonth(val);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const formatDateStr = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    if (val === 'todos') {
      setStartDate('');
      setEndDate('');
    } else if (val === 'current') {
      const first = new Date(currentYear, currentMonth, 1);
      const last = new Date(currentYear, currentMonth + 1, 0);
      setStartDate(formatDateStr(first));
      setEndDate(formatDateStr(last));
    } else if (val === 'previous') {
      const first = new Date(currentYear, currentMonth - 1, 1);
      const last = new Date(currentYear, currentMonth, 0);
      setStartDate(formatDateStr(first));
      setEndDate(formatDateStr(last));
    } else if (val === 'last3') {
      const first = new Date(currentYear, currentMonth - 2, 1);
      const last = new Date(currentYear, currentMonth + 1, 0);
      setStartDate(formatDateStr(first));
      setEndDate(formatDateStr(last));
    } else {
      // Meses individuais '01' a '12' do ano corrente
      const mIdx = parseInt(val, 10) - 1;
      if (!isNaN(mIdx) && mIdx >= 0 && mIdx <= 11) {
        const first = new Date(currentYear, mIdx, 1);
        const last = new Date(currentYear, mIdx + 1, 0);
        setStartDate(formatDateStr(first));
        setEndDate(formatDateStr(last));
      }
    }
  };

  const handleClearAllFilters = () => {
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
    setSelectedMonth('todos');
    setSelectedLocation('todos');
    setSelectedVehicle('todos');
    setSelectedStatus('todos');
    setSelectedPartsOrigin('todos');
    setFilterReformaOnly(false);
  };

  const hasActiveFilters = Boolean(
    searchTerm ||
    startDate ||
    endDate ||
    selectedMonth !== 'todos' ||
    selectedLocation !== 'todos' ||
    selectedVehicle !== 'todos' ||
    selectedStatus !== 'todos' ||
    selectedPartsOrigin !== 'todos' ||
    filterReformaOnly
  );

  // Filtered maintenance logs
  const filteredLogs = useMemo(() => {
    const term = (searchTerm || '').trim().toLowerCase();
    return localLogs.filter((log) => {
      if (!log) return false;
      const plateOrName = String(log.machineryPlateOrName || '').toLowerCase();
      const desc = String(log.description || '').toLowerCase();
      const os = String(log.osNumber || '').toLowerCase();
      const workshop = String(log.workshopOrMechanic || '').toLowerCase();
      const cat = String(log.serviceCategory || '').toLowerCase();

      const matchSearch =
        !term ||
        plateOrName.includes(term) ||
        desc.includes(term) ||
        os.includes(term) ||
        workshop.includes(term) ||
        cat.includes(term);

      const matchVehicle = selectedVehicle === 'todos' || log.machineryId === selectedVehicle;
      const matchStatus = selectedStatus === 'todos' || log.status === selectedStatus;
      const matchCategory = selectedCategory === 'todos' || log.serviceCategory === selectedCategory;
      const matchLocation = selectedLocation === 'todos' || log.location === selectedLocation;
      const matchOrigin = selectedPartsOrigin === 'todos' || log.partsOriginSummary === selectedPartsOrigin;

      // Filtro de intervalo de datas
      const logDate = log.date ? log.date.slice(0, 10) : '';
      const matchStartDate = !startDate || (logDate ? logDate >= startDate : true);
      const matchEndDate = !endDate || (logDate ? logDate <= endDate : true);

      /* CARD REFORMA & ENTRESSAFRA: FILTRAGEM AO CLICAR NO CARD */
      const isReformaOrEntressafra = 
        (log.type && (log.type.toLowerCase().includes('reforma') || log.type.toLowerCase().includes('entressafra'))) ||
        (log.serviceCategory && (log.serviceCategory.toLowerCase().includes('reforma') || log.serviceCategory.toLowerCase().includes('entressafra'))) ||
        (log.description && (log.description.toLowerCase().includes('reforma') || log.description.toLowerCase().includes('entressafra')));

      const matchReforma = !filterReformaOnly || isReformaOrEntressafra;

      return matchSearch && matchVehicle && matchStatus && matchCategory && matchLocation && matchOrigin && matchReforma && matchStartDate && matchEndDate;
    });
  }, [localLogs, searchTerm, selectedVehicle, selectedStatus, selectedCategory, selectedLocation, selectedPartsOrigin, filterReformaOnly, startDate, endDate]);

  // Statistics
  const totalCost = filteredLogs.reduce((acc, curr) => acc + curr.totalCost, 0);
  const totalParts = filteredLogs.reduce((acc, curr) => acc + curr.partsCost, 0);
  const totalLabor = filteredLogs.reduce((acc, curr) => acc + curr.laborCost, 0);
  const pendingCount = filteredLogs.filter(m => m.status === 'em_andamento' || m.status === 'agendada' || m.status === 'aguardando_pecas').length;

  /* CARD REFORMA & ENTRESSAFRA: CÁLCULOS TÉCNICOS */
  const reformaLogs = useMemo(() => {
    return localLogs.filter((log) => {
      const matchVehicle = selectedVehicle === 'todos' || log.machineryId === selectedVehicle;
      const matchLocation = selectedLocation === 'todos' || log.location === selectedLocation;
      const isReforma = 
        (log.type && (log.type.toLowerCase().includes('reforma') || log.type.toLowerCase().includes('entressafra'))) ||
        (log.serviceCategory && (log.serviceCategory.toLowerCase().includes('reforma') || log.serviceCategory.toLowerCase().includes('entressafra'))) ||
        (log.description && (log.description.toLowerCase().includes('reforma') || log.description.toLowerCase().includes('entressafra')));
      return matchVehicle && matchLocation && isReforma;
    });
  }, [localLogs, selectedVehicle, selectedLocation]);

  const totalReforma = useMemo(() => {
    return reformaLogs.reduce((acc, curr) => acc + (curr.totalCost || 0), 0);
  }, [reformaLogs]);

  const reformaCount = reformaLogs.length;

  // Local Badges Helper
  const getLocationBadge = (loc?: MaintenanceLog['location']) => {
    switch (loc) {
      case 'roca':
        return {
          label: 'Roça',
          fullLabel: 'Roça (Campo)',
          badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800',
          dotColor: 'bg-emerald-500',
        };
      case 'estrada':
        return {
          label: 'Estrada',
          fullLabel: 'Estrada (Socorro)',
          badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200/80 dark:border-amber-800',
          dotColor: 'bg-amber-500',
        };
      case 'oficina_interna':
        return {
          label: 'Oficina Interna',
          fullLabel: 'Oficina Interna (Barracão)',
          badgeClass: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 border-sky-200/80 dark:border-sky-800',
          dotColor: 'bg-sky-500',
        };
      case 'oficina_externa':
        return {
          label: 'Oficina Externa',
          fullLabel: 'Oficina Externa (Terceira)',
          badgeClass: 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border-purple-200/80 dark:border-purple-800',
          dotColor: 'bg-purple-500',
        };
      default:
        return {
          label: 'Interna',
          fullLabel: 'Oficina Interna',
          badgeClass: 'bg-stone-50 text-stone-600 dark:bg-stone-800 dark:text-stone-300 border-stone-200',
          dotColor: 'bg-stone-400',
        };
    }
  };

  // Executante Helper
  const getExecutorBadge = (type?: MaintenanceLog['executorType'], name?: string) => {
    switch (type) {
      case 'equipe_propria':
        return {
          label: 'Equipe Própria',
          detail: name || 'Motorista/Operador',
          bg: 'text-stone-700 dark:text-stone-300',
        };
      case 'mecanico_interno':
        return {
          label: 'Mecânico Interno',
          detail: name || 'Mecânica Própria',
          bg: 'text-sky-700 dark:text-sky-300',
        };
      case 'mecanico_campo':
        return {
          label: 'Socorro em Campo',
          detail: name || 'Mecânico Terceiro',
          bg: 'text-amber-700 dark:text-amber-300',
        };
      case 'mecanica_terceirizada':
        return {
          label: 'Oficina Terceira',
          detail: name || 'Concessionária',
          bg: 'text-purple-700 dark:text-purple-300',
        };
      default:
        return {
          label: 'Interno',
          detail: name || 'Mecânica Interna',
          bg: 'text-stone-700 dark:text-stone-300',
        };
    }
  };

  // Origem de Peças Helper
  const getPartsOriginBadge = (origin?: MaintenanceLog['partsOriginSummary']) => {
    switch (origin) {
      case 'almoxarifado':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
            📦 Almoxarifado
          </span>
        );
      case 'externo':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            🛒 Compra Ext.
          </span>
        );
      case 'misto':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
            🔀 Misto (Est+Ext)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium text-stone-400 bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-800">
            S/ Peças
          </span>
        );
    }
  };

  return (
    <div className="w-full space-y-2.5 animate-in fade-in duration-200">
      
      {/* Conteúdo da Tela de Manutenção - Oculto na Impressão da OS */}
      <div className="w-full space-y-2.5 print:hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200 dark:border-stone-800 pb-2">
        <div>
          <div className="flex items-center space-x-2">
            <Wrench style={{ color: '#823028' }} className="w-5 h-5 text-[#823028]" />
            <h2 className="text-base font-bold text-stone-900 dark:text-stone-100 font-['Outfit']">
              Gestão de Manutenções & Ordens de Serviço (OS)
            </h2>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          {/* Botão de Cotações da Roça com Gradiente Metálico 3D */}
          <button
            type="button"
            onClick={() => setIsPurchaseModalOpen(true)}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 hover:brightness-95 text-slate-800 border border-slate-400 text-xs font-semibold rounded-xl shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9),inset_-1px_-1px_0px_rgba(0,0,0,0.15)] transition active:scale-95 cursor-pointer shrink-0 uppercase tracking-wide"
          >
            <ShoppingCart className="w-3.5 h-3.5 text-slate-800 stroke-[2.2]" />
            <span>COTAÇÕES & COMPRAS</span>
            {purchaseRequests.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white shadow-2xs">
                {purchaseRequests.length}
              </span>
            )}
          </button>

          {/* Botão Nova OS */}
          <button
            type="button"
            onClick={onOpenNewMaintenance}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 hover:brightness-95 text-slate-800 border border-slate-400 text-xs font-semibold rounded-xl shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9),inset_-1px_-1px_0px_rgba(0,0,0,0.15)] transition active:scale-95 cursor-pointer shrink-0 uppercase tracking-wide"
          >
            <Plus className="w-4 h-4 text-slate-800 stroke-[2.2]" />
            <span>NOVA ORDEM DE MANUTENÇÃO</span>
          </button>
        </div>
      </div>

      {/* KPI Cards - Compactados no padrão 3D Slim */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
        <div className="py-2 px-3 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
              Total Investido em Manutenção
            </span>
            <DollarSign className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <div className="text-xl font-black text-stone-900 dark:text-stone-100 mt-0.5 font-['Outfit']">
            {formatCurrencyBRL(totalCost)}
          </div>
          <p className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5">{filteredLogs.length} ordens de serviço</p>
        </div>

        <div className="py-2 px-3 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
              Peças & Insumos
            </span>
            <Layers className="w-3.5 h-3.5 text-sky-600" />
          </div>
          <div className="text-xl font-black text-sky-700 dark:text-sky-400 mt-0.5 font-['Outfit']">
            {formatCurrencyBRL(totalParts)}
          </div>
          <p className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5">Filtros, facas, rolamentos, óleos</p>
        </div>

        <div className="py-2 px-3 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
              Mão de Obra
            </span>
            <Wrench className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-xl font-black text-amber-700 dark:text-amber-400 mt-0.5 font-['Outfit']">
            {formatCurrencyBRL(totalLabor)}
          </div>
          <p className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5">Oficinas terceiras e mecânica</p>
        </div>

        {/* CARD REFORMA & ENTRESSAFRA */}
        <div 
          onClick={() => setFilterReformaOnly(prev => !prev)}
          className={`py-2 px-3 rounded-xl bg-white dark:bg-stone-900 border shadow-2xs transition cursor-pointer select-none ${
            filterReformaOnly
              ? 'border-purple-500 ring-2 ring-purple-600/30 dark:ring-purple-500/40 bg-purple-50/20 dark:bg-purple-950/20'
              : 'border-stone-200 dark:border-stone-800 hover:border-purple-300 dark:hover:border-purple-700'
          }`}
          title={filterReformaOnly ? "Clique para desativar filtro de Reforma / Entressafra" : "Clique para filtrar manutenções de Reforma / Entressafra"}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
              REFORMA & ENTRESSAFRA
            </span>
            <Hammer className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-xl font-black text-purple-700 dark:text-purple-400 mt-0.5 font-['Outfit']">
            {formatCurrencyBRL(totalReforma)}
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <p className="text-[10px] text-stone-500 dark:text-stone-400">
              {reformaCount} {reformaCount === 1 ? 'máquina em reforma' : 'máquinas em reforma'}
            </p>
            {filterReformaOnly && (
              <span className="text-[9px] font-bold text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-950/60 px-1 py-0.2 rounded">
                Filtrando
              </span>
            )}
          </div>
        </div>

        <div className="py-2 px-3 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
              OS Em Aberto
            </span>
            <Clock className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <div className={`text-xl font-black mt-0.5 font-['Outfit'] ${pendingCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
            {pendingCount}
          </div>
          <p className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5">Veículos aguardando liberação</p>
        </div>
      </div>

      {/* Filter and Search Bar (Compact Single-Line) */}
      <div className="bg-white dark:bg-stone-900 px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-800 shadow-xs flex flex-wrap items-center gap-2">
        {/* 1. Busca por texto */}
        <div className="relative min-w-[160px] sm:w-52">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar OS, veículo, peça..."
            className="w-full pl-8 pr-2.5 py-1 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-1.5 focus:ring-indigo-600"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* 2. Período de Datas (De: e Até:) */}
        <div className="flex items-center space-x-1.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg px-2 py-1">
          <Calendar className="w-3.5 h-3.5 text-stone-400 shrink-0" />
          <span className="text-[10px] font-bold text-stone-500 uppercase tracking-tight">De:</span>
          <input 
            type="date" 
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setSelectedMonth('custom');
            }}
            className="bg-transparent text-xs text-stone-900 dark:text-stone-100 focus:outline-none cursor-pointer"
          />
          <span className="text-stone-300 dark:text-stone-600">|</span>
          <span className="text-[10px] font-bold text-stone-500 uppercase tracking-tight">Até:</span>
          <input 
            type="date" 
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setSelectedMonth('custom');
            }}
            className="bg-transparent text-xs text-stone-900 dark:text-stone-100 focus:outline-none cursor-pointer"
          />
          {(startDate || endDate) && (
            <button
              type="button"
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setSelectedMonth('todos');
              }}
              title="Limpar período de datas"
              className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 p-0.5 ml-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* 3. Mês */}
        <select
          value={selectedMonth}
          onChange={handleMonthChange}
          className="py-1 px-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-semibold focus:outline-none focus:ring-1.5 focus:ring-indigo-600 cursor-pointer"
        >
          <option value="todos">Mês: Todos</option>
          <option value="current">Mês Atual</option>
          <option value="previous">Mês Anterior</option>
          <option value="last3">Últimos 3 Meses</option>
          <option disabled>──────────</option>
          <option value="01">Janeiro</option>
          <option value="02">Fevereiro</option>
          <option value="03">Março</option>
          <option value="04">Abril</option>
          <option value="05">Maio</option>
          <option value="06">Junho</option>
          <option value="07">Julho</option>
          <option value="08">Agosto</option>
          <option value="09">Setembro</option>
          <option value="10">Outubro</option>
          <option value="11">Novembro</option>
          <option value="12">Dezembro</option>
        </select>

        {/* 4. Todos os Locais */}
        <select
          value={selectedLocation}
          onChange={(e) => setSelectedLocation(e.target.value)}
          className="py-1 px-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-semibold focus:outline-none focus:ring-1.5 focus:ring-indigo-600 cursor-pointer"
        >
          <option value="todos">Todos os Locais</option>
          <option value="roca">🌱 Roça (Campo)</option>
          <option value="estrada">🚛 Estrada (Socorro)</option>
          <option value="oficina_interna">🏠 Oficina Interna</option>
          <option value="oficina_externa">🏢 Oficina Externa</option>
        </select>

        {/* 5. Todos os Veículos */}
        <select
          value={selectedVehicle}
          onChange={(e) => setSelectedVehicle(e.target.value)}
          className="py-1 px-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-semibold focus:outline-none focus:ring-1.5 focus:ring-indigo-600 cursor-pointer max-w-[170px] truncate"
        >
          <option value="todos">Todos os Veículos</option>
          {machineries.map((m) => (
            <option key={m.id} value={m.id}>
              {m.licensePlateOrSerial ? `[${m.licensePlateOrSerial}] ` : ''}{m.model || m.name}
            </option>
          ))}
        </select>

        {/* 6. Todos os Status */}
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="py-1 px-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-semibold focus:outline-none focus:ring-1.5 focus:ring-indigo-600 cursor-pointer"
        >
          <option value="todos">Todos os Status</option>
          <option value="concluida">Concluída</option>
          <option value="em_andamento">Em Andamento</option>
          <option value="aguardando_pecas">Aguardando Peças</option>
          <option value="agendada">Agendada</option>
        </select>

        {/* 7. Todas as Origens */}
        <select
          value={selectedPartsOrigin}
          onChange={(e) => setSelectedPartsOrigin(e.target.value)}
          className="py-1 px-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-semibold focus:outline-none focus:ring-1.5 focus:ring-indigo-600 cursor-pointer"
        >
          <option value="todos">Todas Origens</option>
          <option value="almoxarifado">Almoxarifado</option>
          <option value="externo">Compra Externa</option>
          <option value="misto">Misto</option>
        </select>

        {/* 8. Limpar Filtros */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClearAllFilters}
            className="py-1 px-2 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 text-xs font-bold transition flex items-center space-x-1 cursor-pointer ml-auto"
            title="Limpar todos os filtros"
          >
            <X className="w-3 h-3 text-stone-500" />
            <span>Limpar</span>
          </button>
        )}
      </div>

      {/* Maintenance Logs Table (Clean, Compact, Slim Rows and Full-Width without Horizontal Scroll) */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 overflow-hidden shadow-xs w-full">
        <div className="w-full overflow-x-auto xl:overflow-x-visible max-h-[calc(100vh-270px)] overflow-y-auto scrollbar-none">
          <table className="w-full text-left text-xs table-auto">
            <thead className="bg-stone-50 dark:bg-stone-800/80 text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider border-b border-stone-200 dark:border-stone-800 sticky top-0 z-10 shadow-2xs">
              <tr>
                <th className="py-1.5 px-2 whitespace-nowrap">Data & OS</th>
                <th className="py-1.5 px-2">Veículo</th>
                <th className="py-1.5 px-2 whitespace-nowrap">Local</th>
                <th className="py-1.5 px-2">Executante</th>
                <th className="py-1.5 px-2 whitespace-nowrap">Origem Peças</th>
                <th className="py-1.5 px-2">Descrição do Serviço</th>
                <th className="py-1.5 px-2 text-right whitespace-nowrap">Peças</th>
                <th className="py-1.5 px-2 text-right whitespace-nowrap">M. Obra</th>
                <th className="py-1.5 px-2 text-right whitespace-nowrap">Total</th>
                <th className="py-1.5 px-2 text-center whitespace-nowrap">Status</th>
                <th className="py-1.5 px-2 text-right whitespace-nowrap">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60 font-medium">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-stone-400">
                    Nenhuma ordem de manutenção encontrada com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const locBadge = getLocationBadge(log.location);
                  const execBadge = getExecutorBadge(log.executorType, log.workshopOrMechanic || log.executorName);
                  
                  return (
                    <tr key={log.id} className="hover:bg-stone-50/80 dark:hover:bg-stone-800/40 transition group">
                      
                      {/* Data & Nº OS */}
                      <td className="py-1 px-2 whitespace-nowrap">
                        <div className="font-mono font-bold text-stone-800 dark:text-stone-200 text-xs">
                          {formatDateBR(log.date)}
                        </div>
                        <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-bold block mt-0.5">
                          {log.osNumber || `OS-${log.id.slice(-5)}`}
                        </span>
                      </td>

                      {/* Veículo */}
                      <td className="py-1 px-2 min-w-[120px] max-w-[180px]">
                        <div className="font-bold text-stone-900 dark:text-stone-100 text-xs truncate" title={log.machineryPlateOrName}>
                          {log.machineryPlateOrName}
                        </div>
                        <span className="text-[10px] text-stone-500 dark:text-stone-400 block font-medium truncate" title={`${log.type.toUpperCase()} • ${log.serviceCategory}`}>
                          {log.type.toUpperCase()} • {log.serviceCategory}
                        </span>
                      </td>

                      {/* Local (Badge Sutil com Cores do Requisito) */}
                      <td className="py-1 px-2 whitespace-nowrap">
                        <span className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold border ${locBadge.badgeClass}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${locBadge.dotColor}`}></span>
                          <span>{locBadge.label}</span>
                        </span>
                        {log.locationDetails && (
                          <span className="text-[9px] text-stone-400 block truncate max-w-[100px]" title={log.locationDetails}>
                            {log.locationDetails}
                          </span>
                        )}
                      </td>

                      {/* Executante */}
                      <td className="py-1 px-2 min-w-[110px] max-w-[140px]">
                        <div className={`text-xs font-bold truncate ${execBadge.bg}`} title={execBadge.label}>
                          {execBadge.label}
                        </div>
                        <span className="text-[10px] text-stone-500 dark:text-stone-400 truncate block" title={execBadge.detail}>
                          {execBadge.detail}
                        </span>
                      </td>

                      {/* Origem das Peças */}
                      <td className="py-1 px-2 whitespace-nowrap">
                        {getPartsOriginBadge(log.partsOriginSummary)}
                        {log.nfeLink?.nfeNumber && (
                          <span className="text-[9px] font-mono text-stone-400 block mt-0.5">
                            NF-e: {log.nfeLink.nfeNumber}
                          </span>
                        )}
                      </td>

                      {/* Descrição */}
                      <td className="py-1 px-2 text-stone-700 dark:text-stone-300 min-w-[120px] max-w-xs">
                        <p className="line-clamp-2 text-xs leading-snug" title={log.description}>
                          {log.description}
                        </p>
                      </td>

                      {/* Peças */}
                      <td className="py-1 px-2 text-right font-mono text-xs text-stone-600 dark:text-stone-400 whitespace-nowrap">
                        {formatCurrencyBRL(log.partsCost)}
                      </td>

                      {/* M. Obra */}
                      <td className="py-1 px-2 text-right font-mono text-xs text-stone-600 dark:text-stone-400 whitespace-nowrap">
                        {formatCurrencyBRL(log.laborCost)}
                      </td>

                      {/* Total */}
                      <td className="py-1 px-2 text-right font-mono font-black text-xs text-stone-900 dark:text-stone-100 whitespace-nowrap">
                        {formatCurrencyBRL(log.totalCost)}
                      </td>

                      {/* Status - Badges minimalistas em tom pastel suave (Soft Cores) */}
                      <td className="py-1 px-2 text-center whitespace-nowrap">
                        <select
                          value={log.status}
                          onChange={(e) => onUpdateStatus(log.id, e.target.value as any)}
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg border cursor-pointer shadow-2xs focus:outline-none transition ${
                            log.status === 'concluida'
                              ? 'bg-emerald-50/80 text-emerald-800 border-emerald-200/80 hover:bg-emerald-100/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60'
                              : log.status === 'em_andamento'
                              ? 'bg-amber-50/80 text-amber-800 border-amber-200/80 hover:bg-amber-100/60 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60'
                              : log.status === 'aguardando_pecas'
                              ? 'bg-purple-50/80 text-purple-800 border-purple-200/80 hover:bg-purple-100/60 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/60'
                              : 'bg-slate-100/80 text-slate-800 border-slate-200/80 hover:bg-slate-200/60 dark:bg-stone-800/60 dark:text-stone-300 dark:border-stone-700'
                          }`}
                        >
                          <option value="concluida">CONCLUÍDA</option>
                          <option value="em_andamento">EM ANDAMENTO</option>
                          <option value="aguardando_pecas">AGUARDANDO PEÇAS</option>
                          <option value="agendada">AGENDADA</option>
                        </select>
                      </td>

                      {/* Ações */}
                      <td className="py-1 px-2 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* Botão de Ação Rápida: Abrir itens */}
                          <button
                            type="button"
                            onClick={() => setViewingLog(log)}
                            title="Abrir itens / Visualizar detalhes da OS"
                            className="inline-flex items-center space-x-1 px-2 py-0.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-blue-800 text-[10px] font-bold transition cursor-pointer shrink-0 active:scale-95 shadow-2xs"
                          >
                            <Eye className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                            <span>Abrir itens</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onEditMaintenance(log)}
                            title="Editar OS"
                            className="p-1 text-stone-400 hover:text-blue-600 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteOrdem(log.id)}
                            title="Excluir OS"
                            className="p-1 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>

      {/* Modal de Impressão / Detalhamento da OS */}
      <MaintenanceDetailModal
        isOpen={!!viewingLog}
        onClose={() => setViewingLog(null)}
        log={viewingLog}
        machinery={machineries.find(m => m.id === viewingLog?.machineryId)}
        companyProfile={companyProfile}
      />

      {/* Modal de Solicitações de Compra da Roça */}
      <MaintenancePurchaseModal
        isOpen={isPurchaseModalOpen}
        onClose={() => setIsPurchaseModalOpen(false)}
        purchaseRequests={purchaseRequests}
        onSavePurchaseRequests={onSavePurchaseRequests || (() => {})}
        maintenanceLogs={maintenanceLogs}
        machineries={machineries}
      />

    </div>
  );
};
