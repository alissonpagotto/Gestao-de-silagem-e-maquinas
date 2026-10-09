import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Scissors,
  Wheat,
  Tractor,
  Wrench,
  FileText,
  Search,
  Plus,
  ChevronDown,
  X,
  Trash2,
  Pencil,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Clock,
  AlertCircle,
  Truck,
  ClipboardList,
  Lock
} from 'lucide-react';
import { ServiceOrder, Machinery, Employee, Client, CompanyProfile, ServiceAppointment } from '../../types';
import { formatCurrencyBRL, formatDateBR, getActiveCompanyId } from '../../lib/storage';
import { useConfirm } from '../../context/ConfirmContext';
import { ServiceFormModal, ServiceTabType } from './ServiceFormModal';
import { ServiceAgendaModule } from './ServiceAgendaModule';
import { FieldFormsView } from './FieldFormsView';
import { supabase } from '../../lib/supabaseClient';
import { fetchAllClientModulesFromSupabase, isSupabaseConfigured } from '../../lib/supabaseService';
import { getActiveUserSession, SimulatedUserSession } from '../../lib/cadastrosBaseStorage';

export type ServiceTab = 'agenda' | 'corte' | 'colheita' | 'trator' | 'maquina' | 'frete' | 'orcamento' | 'formularios';

interface ServicesModuleProps {
  services?: ServiceOrder[];
  machineries?: Machinery[];
  employees?: Employee[];
  clients?: Client[];
  companyProfile?: CompanyProfile;
  onSaveServices?: (services: ServiceOrder[]) => void;
  onSaveClients?: (clients: Client[]) => void;
}

export const ServicesModule: React.FC<ServicesModuleProps> = ({
  services = [],
  machineries = [],
  employees = [],
  clients = [],
  companyProfile,
  onSaveServices,
  onSaveClients,
}) => {
  const { confirm } = useConfirm();

  // Active Tab State (Padrão: 'corte', ou lendo o parâmetro da URL como ?tab=formularios)
  const [activeTab, setActiveTab] = useState<ServiceTab>(() => {
    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        const tabParam = params.get('tab') || params.get('subtab');
        if (tabParam === 'formularios' || tabParam === 'agenda' || tabParam === 'corte' || tabParam === 'colheita' || tabParam === 'trator' || tabParam === 'maquina' || tabParam === 'frete' || tabParam === 'orcamento') {
          return tabParam as ServiceTab;
        }
      } catch (e) {
        console.error(e);
      }
    }
    return 'corte';
  });

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');

  // Modal State for "+ Novo" & Edição
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<ServiceOrder | null>(null);

  const [localServices, setLocalServices] = useState<ServiceOrder[]>(services);

  useEffect(() => {
    if (services) {
      setLocalServices(services);
    }
  }, [services]);

  const onSaveServicesRef = useRef(onSaveServices);
  useEffect(() => {
    onSaveServicesRef.current = onSaveServices;
  }, [onSaveServices]);

  const servicesDebounceTimerRef = useRef<any>(null);

  // Sincronização em tempo real multi-dispositivos (Supabase Realtime) escutando 'site_settings'
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let isMounted = true;
    const companyId = companyProfile?.id || getActiveCompanyId();
    const channelId = `services_module_rt_${companyId || 'default'}`;

    const existingChannels = supabase.getChannels?.() || [];
    for (const ch of existingChannels) {
      if (ch.topic === channelId || ch.topic === `realtime:${channelId}`) {
        try { supabase.removeChannel(ch); } catch (_) {}
      }
    }

    const debouncedFetchServices = () => {
      if (servicesDebounceTimerRef.current) clearTimeout(servicesDebounceTimerRef.current);
      servicesDebounceTimerRef.current = setTimeout(async () => {
        try {
          const fresh = await fetchAllClientModulesFromSupabase(companyId);
          if (isMounted && fresh && Array.isArray(fresh.services)) {
            setLocalServices(fresh.services);
            onSaveServicesRef.current?.(fresh.services);
          }
        } catch (_) {}
      }, 400);
    };

    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'site_settings' },
        () => {
          debouncedFetchServices();
        }
      )
      .subscribe();

    const handleFocus = () => {
      debouncedFetchServices();
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      isMounted = false;
      if (servicesDebounceTimerRef.current) {
        clearTimeout(servicesDebounceTimerRef.current);
      }
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
      try {
        supabase.removeChannel(channel);
      } catch (_) {}
    };
  }, [companyProfile?.id]);

  // Tabs Definition na ordem exata requerida:
  // Agenda | Corte | Colheita | Serviço de Trator | Serviço de Máquina | Serviço de Frete | Orçamento | Formulários
  const tabs = [
    { id: 'agenda' as ServiceTab, label: 'Agenda de Serviços', icon: CalendarDays },
    { id: 'corte' as ServiceTab, label: 'Corte', icon: Scissors },
    { id: 'colheita' as ServiceTab, label: 'Colheita', icon: Wheat },
    { id: 'trator' as ServiceTab, label: 'Serviço de Trator', icon: Tractor },
    { id: 'maquina' as ServiceTab, label: 'Serviço de Máquina', icon: Wrench },
    { id: 'frete' as ServiceTab, label: 'Serviço de Frete', icon: Truck },
    { id: 'orcamento' as ServiceTab, label: 'Orçamento', icon: FileText },
    { id: 'formularios' as ServiceTab, label: 'Formulários', icon: ClipboardList },
  ];

  // Controle de Sessão e Sub-permissões por Aba
  const [userSession, setUserSession] = useState<SimulatedUserSession>(() => getActiveUserSession());

  useEffect(() => {
    const handleSessionSync = (e: any) => {
      if (e?.detail) {
        setUserSession(e.detail);
      } else {
        setUserSession(getActiveUserSession());
      }
    };
    window.addEventListener('colaca_silagem_session_updated', handleSessionSync);
    window.addEventListener('storage', handleSessionSync);
    return () => {
      window.removeEventListener('colaca_silagem_session_updated', handleSessionSync);
      window.removeEventListener('storage', handleSessionSync);
    };
  }, []);

  const isServiceTabAllowed = (tabId: ServiceTab): boolean => {
    if (userSession.type === 'admin') return true;
    if (userSession.permissions && userSession.permissions.servicos === false) return false;
    if (userSession.permissions?.sub_servicos) {
      const ss = userSession.permissions.sub_servicos;
      if (tabId === 'agenda') return ss.agenda !== false;
      if (tabId === 'corte') return ss.corte !== false;
      if (tabId === 'colheita') return ss.colheita !== false;
      if (tabId === 'trator') return ss.trator !== false;
      if (tabId === 'maquina') return ss.maquina !== false;
      if (tabId === 'frete') return ss.frete !== false;
      if (tabId === 'orcamento') return ss.orcamento !== false;
      if (tabId === 'formularios') return true;
    }
    return true;
  };

  const allowedTabs = useMemo(() => {
    return tabs.filter(t => isServiceTabAllowed(t.id));
  }, [userSession]);

  // Se a aba ativa estiver bloqueada pelo perfil do cargo, redireciona para a primeira permitida
  useEffect(() => {
    if (allowedTabs.length > 0 && !isServiceTabAllowed(activeTab)) {
      setActiveTab(allowedTabs[0].id);
    }
  }, [userSession, activeTab, allowedTabs]);

  // Configurações Dinâmicas por Aba
  const tabConfig = useMemo(() => {
    switch (activeTab) {
      case 'agenda':
        return {
          dateColumn: 'DATA PREVISTA',
          quantityColumn: 'ÁREA / HORAS',
          newButtonLabel: '+ Novo Agendamento',
          serviceTypeName: 'Agenda de Serviços',
        };
      case 'corte':
        return {
          dateColumn: 'DATA DO CORTE',
          quantityColumn: 'ÁREA / UNIDADE',
          newButtonLabel: '+ Novo Corte',
          serviceTypeName: 'Ensilagem',
        };
      case 'colheita':
        return {
          dateColumn: 'DATA DA COLHEITA',
          quantityColumn: 'HECTARES (ha)',
          newButtonLabel: '+ Nova Colheita',
          serviceTypeName: 'Colheita',
        };
      case 'trator':
        return {
          dateColumn: 'DATA DO SERVIÇO',
          quantityColumn: 'HORAS / ÁREA',
          newButtonLabel: '+ Novo Serviço de Trator',
          serviceTypeName: 'Serviço de Trator',
        };
      case 'maquina':
        return {
          dateColumn: 'DATA DA OPERAÇÃO',
          quantityColumn: 'HORAS / ÁREA',
          newButtonLabel: '+ Novo Serviço de Máquina',
          serviceTypeName: 'Serviço de Máquina',
        };
      case 'frete':
        return {
          dateColumn: 'DATA DO FRETE',
          quantityColumn: 'KM / HORAS',
          newButtonLabel: '+ Novo Serviço de Frete',
          serviceTypeName: 'Serviço de Frete',
        };
      case 'orcamento':
      default:
        return {
          dateColumn: 'DATA DO ORÇAMENTO',
          quantityColumn: 'QUANTIDADE',
          newButtonLabel: '+ Novo Orçamento',
          serviceTypeName: 'Orçamento Agrícola',
        };
    }
  }, [activeTab]);

  // Filtragem dos registros da aba ativa
  const filteredServices = useMemo(() => {
    return localServices.filter((srv) => {
      const typeStr = (srv.serviceType || '').toLowerCase();
      const tabStr = (srv.serviceTab || '').toLowerCase();
      const isFreight = tabStr === 'frete' || typeStr.includes('frete') || typeStr.includes('transporte') || srv.equipmentCategory === 'caminhoes' || !!srv.truckBillingMode;

      let matchesTab = false;

      if (activeTab === 'corte') {
        matchesTab = (typeStr.includes('corte') || typeStr.includes('ensilagem') || !srv.serviceType) && !isFreight;
      } else if (activeTab === 'colheita') {
        matchesTab = typeStr.includes('colheita') && !isFreight;
      } else if (activeTab === 'trator') {
        matchesTab = (typeStr.includes('trator') || typeStr.includes('preparo') || typeStr.includes('plantio')) && !isFreight;
      } else if (activeTab === 'maquina') {
        // Máquinas pesadas excluindo frete
        matchesTab = (typeStr.includes('máquina') || typeStr.includes('maquina')) && !isFreight && srv.equipmentCategory !== 'caminhoes';
      } else if (activeTab === 'frete') {
        matchesTab = isFreight;
      } else if (activeTab === 'orcamento') {
        matchesTab = typeStr.includes('orçamento') || typeStr.includes('orcamento');
      }

      if (!matchesTab) return false;

      // Filtro de status
      if (statusFilter !== 'todos') {
        if (srv.status !== statusFilter) return false;
      }

      // Filtro por texto
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesClient = srv.clientName.toLowerCase().includes(query);
        const matchesFarm = (srv.farmName || '').toLowerCase().includes(query);
        const matchesNumber = (srv.orderNumber || srv.id).toLowerCase().includes(query);
        const matchesRoute = ((srv.freightOrigin || '') + ' ' + (srv.freightDestination || '')).toLowerCase().includes(query);
        if (!matchesClient && !matchesFarm && !matchesNumber && !matchesRoute) return false;
      }

      return true;
    });
  }, [localServices, activeTab, statusFilter, searchTerm]);

  // Abertura do Modal para Novo Registro
  const handleOpenNew = () => {
    setEditRecord(null);
    setIsModalOpen(true);
  };

  // Abertura do Modal para Edição
  const handleOpenEdit = (record: ServiceOrder) => {
    setEditRecord(record);
    setIsModalOpen(true);
  };

  // Salvar Serviço (Novo ou Editado)
  const handleSaveService = (savedService: ServiceOrder) => {
    const exists = localServices.some((s) => s.id === savedService.id);
    const updated = exists
      ? localServices.map((s) => (s.id === savedService.id ? savedService : s))
      : [savedService, ...localServices];
    setLocalServices(updated);
    if (onSaveServices) {
      onSaveServices(updated);
    }

    // REGRA DE FLUXO: Mantém o modal aberto para conferência do DRE e emissão de comprovantes
    // Apenas o botão "Sair" fecha o modal voluntariamente
    setEditRecord(savedService);
  };

  // Excluir Serviço
  const handleDeleteService = async (id: string, name: string) => {
    const isConfirmed = await confirm({
      title: 'Excluir Registro',
      message: `Deseja realmente remover o registro de "${name}"?`,
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });

    if (isConfirmed) {
      const updated = localServices.filter((s) => s.id !== id);
      setLocalServices(updated);
      if (onSaveServices) {
        onSaveServices(updated);
      }
    }
  };

  // REGRA DE NEGÓCIO: Fluxo de Execução a partir da Agenda
  // Puxar o cliente agendado e preencher o novo corte automaticamente
  const handleExecuteAppointmentFromAgenda = (appointment: ServiceAppointment) => {
    const matchingClient = clients.find(
      (c) => c.id === appointment.clientId || c.name.toLowerCase() === appointment.clientName.toLowerCase()
    );

    // Converte veículos escalados para o formato de caminhões do serviço
    const trucksList = (appointment.assignedVehicles || [])
      .filter((v) => v.category === 'caminhao')
      .map((v) => ({
        id: `truck-item-${Math.random()}`,
        machineryId: v.machineryId,
        truckName: `${v.prefix} (${v.plateOrSerial})`,
        truckPlate: v.plateOrSerial,
        driverName: v.driverOrOperatorName || '',
        loadsCount: 0,
        ratePerLoad: 0,
        totalAmount: 0,
      }));

    const tractor = (appointment.assignedVehicles || []).find((v) => v.category === 'trator');
    const forageOp = appointment.assignedTeam?.find(
      (t) => t.role.toLowerCase().includes('forrageira') || t.role.toLowerCase().includes('principal')
    );

    const draftOrder: Partial<ServiceOrder> = {
      id: `draft-${Date.now()}`,
      serviceType: 'corte',
      serviceTab: 'corte',
      clientId: appointment.clientId || (matchingClient ? matchingClient.id : ''),
      clientName: appointment.clientName,
      farmName: appointment.farmName || (matchingClient ? matchingClient.farmName : ''),
      startDate: appointment.startDate,
      areaQuantity: appointment.estimatedQuantity || undefined,
      areaHectares: appointment.areaUnit === 'hectares' ? appointment.estimatedQuantity : undefined,
      areaUnit: appointment.areaUnit === 'alqueires' ? 'alqueires' : 'hectares',
      forageHarvesterId: appointment.primaryMachineryId,
      forageHarvesterName: appointment.primaryMachineryPrefix,
      forageOperatorId: forageOp?.employeeId,
      forageOperatorName: forageOp?.employeeName,
      tractorId: tractor?.machineryId,
      tractorName: tractor?.prefix,
      tractorOperatorName: tractor?.driverOrOperatorName,
      trucks: trucksList as any,
      notes: appointment.fieldNotes
        ? `[Agendamento ${appointment.appointmentNumber}] ${appointment.fieldNotes}`
        : `[Agendamento ${appointment.appointmentNumber}]`,
      status: 'em_andamento',
    };

    setEditRecord(draftOrder as ServiceOrder);
    setActiveTab('corte');
    setIsModalOpen(true);
  };

  return (
    <div 
      className="w-full max-w-none space-y-3 antialiased text-zinc-900 dark:text-zinc-100"
    >
      
      {/* ========================================================
          2. CABEÇALHO (HEADER) COMPACTO
          Título, subtítulo e botão de ação principal "+ Novo"
          ======================================================== */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 border-b border-slate-300 dark:border-stone-800 shadow-[0_1px_0px_0px_rgba(255,255,255,0.8)] dark:shadow-[0_1px_0px_0px_rgba(255,255,255,0.05)] pb-2">
        <div>
          <h1 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tracking-tight">
            {activeTab === 'agenda' ? 'Agenda de Serviços' : activeTab === 'formularios' ? 'Formulários de Campo' : 'Serviços'}
          </h1>
        </div>

        {/* Botão de Ação Principal com Relevo Acetinado 3D */}
        {activeTab !== 'agenda' && activeTab !== 'formularios' && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenNew}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 hover:from-slate-600 hover:to-slate-800 text-white text-xs font-bold rounded-lg border border-slate-600/80 shadow-[inset_0_1px_0px_rgba(255,255,255,0.25),0_1px_2px_rgba(0,0,0,0.15)] transition-all duration-150 cursor-pointer focus:outline-none focus:ring-2 focus:ring-zinc-600 focus:ring-offset-1"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{tabConfig.newButtonLabel || '+ Novo'}</span>
            </button>
          </div>
        )}
      </header>

      {/* ========================================================
          3. MÓDULO DE SERVIÇOS: ABAS MDI TRIDIMENSIONAL + BLOCO ENVOLVIDO
          ======================================================== */}
      <div className="w-full flex flex-col">
        {/* BASE DE FUNDO DAS ABAS: MOLDURA MDI TRIDIMENSIONAL ACETINADA (10% MENOR) */}
        <div className="w-full bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 border-b border-slate-400 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9)] rounded-t-lg border border-b-0 border-slate-300 dark:border-stone-700 overflow-x-auto scrollbar-none">
          <nav 
            aria-label="Abas de Serviços" 
            className="w-full flex items-stretch"
          >
            {allowedTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 min-w-max flex items-center justify-center gap-1.5 px-3 py-1 text-[10px] font-bold tracking-wide uppercase select-none transition cursor-pointer whitespace-nowrap border-r border-slate-300/80 dark:border-stone-700/80 last:border-r-0 ${
                    isActive
                      ? 'bg-white text-zinc-900 dark:bg-stone-900 dark:text-white shadow-xs border-t-2 border-t-emerald-600 -mb-px z-10'
                      : 'bg-slate-200/50 hover:bg-slate-200 dark:bg-stone-850 dark:hover:bg-stone-800 text-slate-700 dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-200'
                  }`}
                >
                  <Icon 
                    className={`w-3.5 h-3.5 transition-colors ${
                      isActive 
                        ? 'text-emerald-700 dark:text-emerald-400' 
                        : 'text-slate-500 dark:text-stone-400'
                    }`} 
                  />
                  <span>{tab.label.toUpperCase()}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* BLOCO INFERIOR DE CONTEÚDO ENVOLVIDO NA MOLDURA PADRONIZADA (COLADO À BASE DAS ABAS) */}
        <div className="w-full border border-slate-300 dark:border-stone-700 rounded-b-lg bg-slate-50 dark:bg-stone-900 shadow-sm overflow-hidden p-3 sm:p-4 space-y-3">
          {/* RENDERIZAÇÃO DA ABA ATIVA: FUNÇÃO RESTRITA, AGENDA DE SERVIÇOS, FORMULÁRIOS DE CAMPO OU LISTAGEM DE SERVIÇOS */}
          {!isServiceTabAllowed(activeTab) ? (
            <div className="py-12 px-6 text-center bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-2xl space-y-4 max-w-lg mx-auto shadow-xs my-6">
              <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center">
                <Lock className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  Função Restrita para o seu Cargo
                </h3>
                <p className="text-xs text-zinc-600 dark:text-stone-400 leading-relaxed">
                  O cargo <strong>{userSession.cargoNome}</strong> possui acesso ao módulo de Serviços, porém a sub-permissão para esta tela está desativada no cadastro do seu cargo.
                </p>
              </div>
              {allowedTabs.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab(allowedTabs[0].id)}
                  className="inline-flex items-center px-4 py-2 rounded-xl bg-[#0963cb] text-white text-xs font-bold hover:bg-[#074ea3] transition shadow-xs cursor-pointer"
                >
                  Ir para {allowedTabs[0].label}
                </button>
              )}
            </div>
          ) : activeTab === 'agenda' ? (
            <ServiceAgendaModule
              machineries={machineries}
              employees={employees}
              clients={clients}
              companyProfile={companyProfile}
              onExecuteAppointment={handleExecuteAppointmentFromAgenda}
            />
          ) : activeTab === 'formularios' ? (
            <FieldFormsView
              companyProfile={companyProfile}
              machineries={machineries}
              employees={employees}
              clients={clients}
            />
          ) : (
            <>
              {/* ========================================================
                  4. BARRA DE FILTROS (SEARCH & DROPDOWN)
                  ======================================================== */}
              <section 
                aria-label="Filtros de Serviços"
                className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full"
              >
                {/* Campo de Busca */}
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                    <Search className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="BUSCAR CLIENTE, FAZENDA OU Nº..."
                    className="w-full pl-9 pr-8 py-1.5 bg-white dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded-lg text-xs text-zinc-900 dark:text-white font-semibold placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition-colors shadow-2xs uppercase"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-zinc-400 hover:text-zinc-700 dark:hover:text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Dropdown de Status */}
                <div className="relative sm:w-44">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full appearance-none pl-3 pr-8 py-1.5 bg-white dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded-lg text-xs font-bold text-zinc-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition-colors shadow-2xs cursor-pointer uppercase"
                  >
                    <option value="todos" className="text-zinc-900 font-semibold">STATUS: TODOS</option>
                    <option value="agendado" className="text-zinc-900 font-semibold">AGENDADO</option>
                    <option value="em_andamento" className="text-zinc-900 font-semibold">EM ANDAMENTO</option>
                    <option value="concluido" className="text-zinc-900 font-semibold">CONCLUÍDO</option>
                    <option value="cancelado" className="text-zinc-900 font-semibold">CANCELADO</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-zinc-400">
                    <ChevronDown className="w-3.5 h-3.5" />
                  </div>
                </div>
              </section>

              {/* ========================================================
                  5. TABELA SLIM DESIGN PRO DAS ORDENS DE SERVIÇO
                  ======================================================== */}
              <section 
                aria-label="Lista de Serviços"
                className="bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-lg shadow-2xs overflow-hidden"
              >
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    {/* Cabeçalho da Tabela Slim */}
                    <thead>
                      <tr className="border-b border-slate-300 dark:border-stone-700 bg-slate-100 dark:bg-stone-800/80">
                        <th scope="col" className="px-3 py-1 text-[10px] font-bold text-zinc-700 dark:text-stone-300 uppercase tracking-wider w-16 whitespace-nowrap">
                          Nº
                        </th>
                        <th scope="col" className="px-3 py-1 text-[10px] font-bold text-zinc-700 dark:text-stone-300 uppercase tracking-wider whitespace-nowrap">
                          CLIENTE
                        </th>
                        <th scope="col" className="px-3 py-1 text-[10px] font-bold text-zinc-700 dark:text-stone-300 uppercase tracking-wider whitespace-nowrap">
                          {(tabConfig.dateColumn || 'DATA').toUpperCase()}
                        </th>
                        <th scope="col" className="px-3 py-1 text-[10px] font-bold text-zinc-700 dark:text-stone-300 uppercase tracking-wider text-center whitespace-nowrap">
                          {(tabConfig.quantityColumn || 'ÁREA / UNIDADE').toUpperCase()}
                        </th>
                        <th scope="col" className="px-3 py-1 text-[10px] font-bold text-zinc-700 dark:text-stone-300 uppercase tracking-wider text-center whitespace-nowrap">
                          STATUS
                        </th>
                        <th scope="col" className="px-3 py-1 text-[10px] font-bold text-zinc-700 dark:text-stone-300 uppercase tracking-wider text-right whitespace-nowrap">
                          TOTAL
                        </th>
                        <th scope="col" className="px-2.5 py-1 text-[10px] font-bold text-zinc-700 dark:text-stone-300 uppercase tracking-wider text-right w-20 whitespace-nowrap">
                          <span className="sr-only">AÇÕES</span>
                        </th>
                      </tr>
                    </thead>

                    {/* Corpo da Tabela Slim */}
                    <tbody className="divide-y divide-slate-200 dark:divide-stone-800 bg-white dark:bg-stone-900">
                      {filteredServices.length === 0 ? (
                        <tr className="bg-white dark:bg-stone-900">
                          <td colSpan={7} className="px-4 py-8 text-center bg-white dark:bg-stone-900">
                            <p className="text-xs font-bold text-zinc-500 dark:text-stone-400 uppercase">
                              {activeTab === 'trator' 
                                ? 'NENHUM SERVIÇO DE TRATOR ENCONTRADO' 
                                : activeTab === 'corte'
                                ? 'NENHUM SERVIÇO DE CORTE DE SILAGEM ENCONTRADO'
                                : activeTab === 'colheita'
                                ? 'NENHUM SERVIÇO DE COLHEITA DE GRÃOS ENCONTRADO'
                                : activeTab === 'maquina'
                                ? 'NENHUM SERVIÇO DE MÁQUINA ENCONTRADO'
                                : activeTab === 'frete'
                                ? 'NENHUM SERVIÇO DE FRETE ENCONTRADO'
                                : activeTab === 'orcamento'
                                ? 'NENHUM ORÇAMENTO ENCONTRADO'
                                : 'NENHUM SERVIÇO ENCONTRADO'}
                            </p>
                          </td>
                        </tr>
                      ) : (
                        filteredServices.map((service, index) => {
                          const itemNumber = (index + 1).toString().padStart(3, '0');
                          const statusColors: Record<string, string> = {
                            agendado: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-stone-800 dark:text-amber-400 dark:border-stone-700 font-bold',
                            em_andamento: 'bg-blue-50 text-blue-800 border-blue-300 dark:bg-stone-800 dark:text-blue-400 dark:border-stone-700 font-bold',
                            concluido: 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-stone-800 dark:text-emerald-400 dark:border-stone-700 font-bold',
                            cancelado: 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-stone-800 dark:text-rose-400 dark:border-stone-700 font-bold',
                          };

                          const statusLabels: Record<string, string> = {
                            agendado: 'AGENDADO',
                            em_andamento: 'EM ANDAMENTO',
                            concluido: 'CONCLUÍDO',
                            cancelado: 'CANCELADO',
                          };

                          const currentStatus = service.status || 'agendado';

                          // Quantidade exibida de acordo com a unidade e aba
                          let quantityDisplay = '--';
                          if (activeTab === 'frete' || service.serviceTab === 'frete' || service.truckBillingMode) {
                            const mode = service.truckBillingMode;
                            if (mode === 'km' || mode === 'somente_km') {
                              quantityDisplay = `${service.truckServiceTotalKm || service.areaQuantity || 0} KM`;
                            } else if (mode === 'horas') {
                              quantityDisplay = `${service.truckServiceHours || service.areaQuantity || 0} H`;
                            } else if (mode === 'cargas' || mode === 'cargas_km') {
                              const addKm = service.truckServiceKmAdditional ? ` + ${service.truckServiceKmAdditional} KM` : '';
                              quantityDisplay = `${service.truckServiceLoads || 0} CARGAS${addKm}`;
                            } else if (mode === 'viagem') {
                              quantityDisplay = `${service.truckServiceTrips || 1} VIAGEM${(service.truckServiceTrips || 1) > 1 ? 'S' : ''}`;
                            } else if (service.truckServiceTotalKm) {
                              quantityDisplay = `${service.truckServiceTotalKm} KM`;
                            } else if (service.truckServiceHours) {
                              quantityDisplay = `${service.truckServiceHours} H`;
                            } else {
                              quantityDisplay = '--';
                            }
                          } else if (service.areaUnit === 'alqueires' && (service.areaQuantity ?? service.areaHectares)) {
                            quantityDisplay = `${service.areaQuantity ?? service.areaHectares} ALQ`;
                          } else if (service.areaUnit === 'hora' && (service.areaQuantity ?? service.tractorHours)) {
                            quantityDisplay = `${service.areaQuantity ?? service.tractorHours} H`;
                          } else if (service.areaQuantity ?? service.areaHectares) {
                            quantityDisplay = `${service.areaQuantity ?? service.areaHectares} HA`;
                          } else if (service.tractorHours) {
                            quantityDisplay = `${service.tractorHours} H`;
                          }

                          return (
                            <tr 
                              key={service.id} 
                              className="bg-white dark:bg-stone-900 hover:bg-slate-50 dark:hover:bg-stone-800/60 transition-colors duration-150 group border-b border-slate-200 dark:border-stone-800"
                            >
                              {/* Nº */}
                              <td className="px-3 py-1 text-xs font-mono text-zinc-600 dark:text-stone-400 font-bold whitespace-nowrap">
                                #{itemNumber}
                              </td>

                              {/* Cliente e Descrições Secundárias */}
                              <td className="px-3 py-1 whitespace-nowrap">
                                <div className="font-bold text-zinc-900 dark:text-white text-xs leading-snug uppercase">
                                  {service.clientName}
                                </div>
                                {service.farmName && (
                                  <div className="text-[10px] text-zinc-500 dark:text-stone-400 font-medium uppercase">
                                    {service.farmName}
                                  </div>
                                )}
                                {(service.freightOrigin || service.freightDestination) && (
                                  <div className="text-[10px] text-zinc-600 dark:text-stone-300 font-medium flex items-center gap-1 mt-0.5 uppercase">
                                    <span className="bg-zinc-100 dark:bg-stone-800 text-zinc-800 dark:text-stone-200 font-semibold px-1 py-0.2 rounded border border-zinc-200 dark:border-stone-700">
                                      ROTA: {service.freightOrigin || 'ORIGEM'} ➔ {service.freightDestination || 'DESTINO'}
                                    </span>
                                  </div>
                                )}
                                {(service.machineryAssigned || service.operatorAssigned || service.tractorName || service.forageHarvesterName || service.freightDriverName || service.freightMaterialType) && (
                                  <div className="text-[10px] text-zinc-600 dark:text-stone-400 font-medium mt-0.5 flex flex-wrap items-center gap-1 uppercase">
                                    {service.freightMaterialType && (
                                      <span className="text-purple-800 dark:text-purple-300 font-semibold bg-purple-50 dark:bg-purple-950/50 px-1 py-0.2 rounded border border-purple-200 dark:border-purple-800">
                                        CARGA: {service.freightMaterialType}
                                      </span>
                                    )}
                                    {service.forageHarvesterName && (
                                      <span className="text-amber-800 dark:text-amber-300 font-semibold bg-amber-50 dark:bg-amber-950/50 px-1 py-0.2 rounded border border-amber-200 dark:border-amber-800">
                                        FORR: {service.forageHarvesterName}
                                      </span>
                                    )}
                                    {service.tractorName && (
                                      <span className="text-blue-800 dark:text-blue-300 font-semibold bg-blue-50 dark:bg-blue-950/50 px-1 py-0.2 rounded border border-blue-200 dark:border-blue-800">
                                        TRATOR: {service.tractorName}
                                      </span>
                                    )}
                                    {!service.forageHarvesterName && !service.tractorName && service.machineryAssigned && (
                                      <span className="text-zinc-700 dark:text-stone-300 font-semibold bg-zinc-100 dark:bg-stone-800 px-1 py-0.2 rounded border border-zinc-200 dark:border-stone-700">
                                        {activeTab === 'frete' || service.serviceTab === 'frete' ? `CAMINHÃO: ${service.machineryAssigned}` : service.machineryAssigned}
                                      </span>
                                    )}
                                    {(service.operatorAssigned || service.tractorOperatorName || service.forageOperatorName || service.freightDriverName) && (
                                      <span className="text-zinc-600 dark:text-stone-400 font-medium">
                                        • {activeTab === 'frete' || service.serviceTab === 'frete' ? 'MOTORISTA' : 'OP'}: {service.freightDriverName || service.operatorAssigned || service.tractorOperatorName || service.forageOperatorName}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>

                              {/* Data */}
                              <td className="px-3 py-1 text-xs text-zinc-700 dark:text-stone-300 font-medium whitespace-nowrap">
                                {service.startDate ? formatDateBR(service.startDate) : '--'}
                              </td>

                              {/* Quantidade / Área */}
                              <td className="px-3 py-1 text-xs text-center text-zinc-800 dark:text-stone-200 font-bold whitespace-nowrap uppercase">
                                {quantityDisplay}
                              </td>

                              {/* Status */}
                              <td className="px-3 py-1 text-center whitespace-nowrap">
                                <span 
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${
                                    statusColors[currentStatus] || 'bg-zinc-100 text-zinc-800 border-zinc-300'
                                  }`}
                                >
                                  {statusLabels[currentStatus] || currentStatus}
                                </span>
                              </td>

                              {/* Total */}
                              <td className="px-3 py-1 text-right font-black text-zinc-900 dark:text-white text-xs whitespace-nowrap">
                                {formatCurrencyBRL(service.totalAmount || 0)}
                              </td>

                              {/* Ações */}
                              <td className="px-2.5 py-1 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEdit(service)}
                                    className="p-1 text-zinc-500 hover:text-emerald-700 hover:bg-emerald-50 dark:text-stone-400 dark:hover:text-emerald-400 dark:hover:bg-emerald-950/30 rounded-md transition-colors cursor-pointer"
                                    title="Editar serviço"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteService(service.id, service.clientName)}
                                    className="p-1 text-zinc-500 hover:text-rose-600 hover:bg-rose-50 dark:text-stone-400 dark:hover:text-rose-400 dark:hover:bg-rose-950/30 rounded-md transition-colors cursor-pointer"
                                    title="Excluir serviço"
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
              </section>
            </>
          )}
        </div>
      </div>

      {/* ========================================================
          MODAL DINÂMICO PARA "+ NOVO" & EDIÇÃO
          Adapta-se à aba ativa: Corte, Colheita, Trator, Máquina...
          ======================================================== */}
      <ServiceFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditRecord(null);
        }}
        onSave={handleSaveService}
        activeTab={activeTab as ServiceTabType}
        clients={clients}
        machineries={machineries}
        employees={employees}
        companyProfile={companyProfile}
        nextNumber={`#${String(services.length + 1).padStart(3, '0')}`}
        editRecord={editRecord}
        onSaveClient={(newClient) => {
          if (onSaveClients) {
            onSaveClients([newClient, ...clients]);
          }
        }}
      />

    </div>
  );
};

export default ServicesModule;
