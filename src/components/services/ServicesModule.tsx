import React, { useState, useMemo } from 'react';
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
  ClipboardList
} from 'lucide-react';
import { ServiceOrder, Machinery, Employee, Client, CompanyProfile, ServiceAppointment } from '../../types';
import { formatCurrencyBRL, formatDateBR } from '../../lib/storage';
import { useConfirm } from '../../context/ConfirmContext';
import { ServiceFormModal, ServiceTabType } from './ServiceFormModal';
import { ServiceAgendaModule } from './ServiceAgendaModule';
import { FieldFormsView } from './FieldFormsView';

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
    return services.filter((srv) => {
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
  }, [services, activeTab, statusFilter, searchTerm]);

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
    if (!onSaveServices) return;

    const exists = services.some((s) => s.id === savedService.id);
    if (exists) {
      onSaveServices(services.map((s) => (s.id === savedService.id ? savedService : s)));
    } else {
      onSaveServices([savedService, ...services]);
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

    if (isConfirmed && onSaveServices) {
      onSaveServices(services.filter((s) => s.id !== id));
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
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 border-b border-zinc-300 dark:border-stone-800 pb-2">
        <div>
          <h1 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tracking-tight">
            {activeTab === 'agenda' ? 'Agenda de Serviços' : activeTab === 'formularios' ? 'Formulários de Campo' : 'Serviços'}
          </h1>
          <p className="text-[11px] sm:text-xs text-zinc-600 dark:text-stone-400 font-medium mt-0.5">
            {activeTab === 'agenda'
              ? 'Planejamento logístico de campo, escala de frotas e controle de sobreposição de horários.'
              : activeTab === 'formularios'
              ? 'Blocos de lançamentos digitais para operadores de corte, tratoristas e transporte de silagem.'
              : 'Gestão de cortes, colheitas, serviços e orçamentos agrícolas.'}
          </p>
        </div>

        {/* Botão de Ação Principal em Verde-esmeralda */}
        {activeTab !== 'agenda' && activeTab !== 'formularios' && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenNew}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white text-xs font-bold rounded-lg shadow-xs transition-colors duration-150 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{tabConfig.newButtonLabel || '+ Novo'}</span>
            </button>
          </div>
        )}
      </header>

      {/* ========================================================
          3. MENU DE ABAS (TABS) DE NAVEGAÇÃO
          Barra com fundo cinza gelo suave (bg-zinc-200), abas inativas em cinza escuro
          e aba ativa com fundo branco sólido, contorno nítido e destaque esmeralda
          ======================================================== */}
      <nav 
        aria-label="Abas de Serviços" 
        className="flex items-center gap-1.5 p-1.5 bg-zinc-200 dark:bg-stone-900 rounded-xl border border-zinc-300 dark:border-stone-800 overflow-x-auto scrollbar-none shadow-2xs"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`group inline-flex items-center gap-2 px-3.5 py-1.5 text-xs sm:text-sm font-bold rounded-lg whitespace-nowrap transition-all duration-150 cursor-pointer focus:outline-none ${
                isActive
                  ? 'bg-white text-zinc-900 dark:bg-stone-800 dark:text-white shadow-xs border border-zinc-300/90 dark:border-stone-700'
                  : 'text-zinc-700 dark:text-stone-400 hover:text-zinc-900 dark:hover:text-stone-200 hover:bg-zinc-300/60 dark:hover:bg-stone-800/60'
              }`}
            >
              <Icon 
                className={`w-4 h-4 transition-colors ${
                  isActive 
                    ? 'text-emerald-600 dark:text-emerald-400' 
                    : 'text-zinc-500 group-hover:text-zinc-800 dark:text-stone-400 dark:group-hover:text-stone-200'
                }`} 
              />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* RENDERIZAÇÃO DA ABA ATIVA: AGENDA DE SERVIÇOS, FORMULÁRIOS DE CAMPO OU LISTAGEM DE SERVIÇOS */}
      {activeTab === 'agenda' ? (
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
            placeholder="Buscar cliente, fazenda ou nº..."
            className="w-full pl-9 pr-8 py-1.5 bg-white dark:bg-stone-900 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs sm:text-sm text-zinc-900 dark:text-white font-semibold placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors shadow-2xs"
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
            className="w-full appearance-none pl-3 pr-8 py-1.5 bg-white dark:bg-stone-900 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs sm:text-sm font-bold text-zinc-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors shadow-2xs cursor-pointer"
          >
            <option value="todos" className="text-zinc-900 font-semibold">Status: Todos</option>
            <option value="agendado" className="text-zinc-900 font-semibold">Agendado</option>
            <option value="em_andamento" className="text-zinc-900 font-semibold">Em Andamento</option>
            <option value="concluido" className="text-zinc-900 font-semibold">Concluído</option>
            <option value="cancelado" className="text-zinc-900 font-semibold">Cancelado</option>
          </select>
          <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-zinc-400">
            <ChevronDown className="w-3.5 h-3.5" />
          </div>
        </div>
      </section>

      {/* ========================================================
          5. TABELA / CARDS DAS ORDENS DE SERVIÇO
          Fundo central branco sólido (bg-white), borda perimetral escura/nítida (border-zinc-300)
          e cabeçalho cinza claro (bg-zinc-100) com texto escuro
          ======================================================== */}
      <section 
        aria-label="Lista de Serviços"
        className="crm-card bg-white dark:bg-stone-900 border border-zinc-300 dark:border-stone-800 rounded-xl shadow-xs overflow-hidden"
      >
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse">
            {/* Cabeçalho da Tabela - Fundo bg-zinc-100 com Texto em Cinza Escuro de Alta Legibilidade */}
            <thead>
              <tr className="border-b border-zinc-300 dark:border-stone-800 bg-zinc-100 dark:bg-stone-800/80">
                <th scope="col" className="px-3 py-2 text-xs font-bold text-zinc-700 dark:text-stone-300 uppercase tracking-wider w-16">
                  Nº
                </th>
                <th scope="col" className="px-3 py-2 text-xs font-bold text-zinc-700 dark:text-stone-300 uppercase tracking-wider">
                  CLIENTE
                </th>
                <th scope="col" className="px-3 py-2 text-xs font-bold text-zinc-700 dark:text-stone-300 uppercase tracking-wider">
                  {tabConfig.dateColumn}
                </th>
                <th scope="col" className="px-3 py-2 text-xs font-bold text-zinc-700 dark:text-stone-300 uppercase tracking-wider text-center">
                  {tabConfig.quantityColumn}
                </th>
                <th scope="col" className="px-3 py-2 text-xs font-bold text-zinc-700 dark:text-stone-300 uppercase tracking-wider text-center">
                  STATUS
                </th>
                <th scope="col" className="px-3 py-2 text-xs font-bold text-zinc-700 dark:text-stone-300 uppercase tracking-wider text-right">
                  TOTAL
                </th>
                <th scope="col" className="px-2.5 py-2 text-xs font-bold text-zinc-700 dark:text-stone-300 uppercase tracking-wider text-right w-20">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>

            {/* Corpo da Tabela - Linhas com Fundo Branco Sólido e Textos em Alta Legibilidade */}
            <tbody className="divide-y divide-zinc-200 dark:divide-stone-800 bg-white dark:bg-stone-900">
              {filteredServices.length === 0 ? (
                /* Bloco de Estado Vazio Centralizado */
                <tr className="bg-white dark:bg-stone-900">
                  <td colSpan={7} className="px-4 py-12 text-center bg-white dark:bg-stone-900">
                    <p className="text-sm font-semibold text-zinc-500 dark:text-stone-400">
                      Nenhum registro encontrado
                    </p>
                  </td>
                </tr>
              ) : (
                /* Linhas Preenchidas com Fundo Branco e Textos Legíveis */
                filteredServices.map((service, index) => {
                  const itemNumber = (index + 1).toString().padStart(3, '0');
                  const statusColors: Record<string, string> = {
                    agendado: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800 font-bold',
                    em_andamento: 'bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800 font-bold',
                    concluido: 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800 font-bold',
                    cancelado: 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800 font-bold',
                  };

                  const statusLabels: Record<string, string> = {
                    agendado: 'Agendado',
                    em_andamento: 'Em Andamento',
                    concluido: 'Concluído',
                    cancelado: 'Cancelado',
                  };

                  const currentStatus = service.status || 'agendado';

                  // Quantidade exibida de acordo com a unidade e aba
                  let quantityDisplay = '--';
                  if (activeTab === 'frete' || service.serviceTab === 'frete' || service.truckBillingMode) {
                    const mode = service.truckBillingMode;
                    if (mode === 'km' || mode === 'somente_km') {
                      quantityDisplay = `${service.truckServiceTotalKm || service.areaQuantity || 0} km`;
                    } else if (mode === 'horas') {
                      quantityDisplay = `${service.truckServiceHours || service.areaQuantity || 0} h`;
                    } else if (mode === 'cargas' || mode === 'cargas_km') {
                      const addKm = service.truckServiceKmAdditional ? ` + ${service.truckServiceKmAdditional} km` : '';
                      quantityDisplay = `${service.truckServiceLoads || 0} cargas${addKm}`;
                    } else if (mode === 'viagem') {
                      quantityDisplay = `${service.truckServiceTrips || 1} viagem${(service.truckServiceTrips || 1) > 1 ? 's' : ''}`;
                    } else if (service.truckServiceTotalKm) {
                      quantityDisplay = `${service.truckServiceTotalKm} km`;
                    } else if (service.truckServiceHours) {
                      quantityDisplay = `${service.truckServiceHours} h`;
                    } else {
                      quantityDisplay = '--';
                    }
                  } else if (service.areaUnit === 'alqueires' && (service.areaQuantity ?? service.areaHectares)) {
                    quantityDisplay = `${service.areaQuantity ?? service.areaHectares} alq`;
                  } else if (service.areaUnit === 'hora' && (service.areaQuantity ?? service.tractorHours)) {
                    quantityDisplay = `${service.areaQuantity ?? service.tractorHours} h`;
                  } else if (service.areaQuantity ?? service.areaHectares) {
                    quantityDisplay = `${service.areaQuantity ?? service.areaHectares} ha`;
                  } else if (service.tractorHours) {
                    quantityDisplay = `${service.tractorHours} h`;
                  }

                  return (
                    <tr 
                      key={service.id} 
                      className="bg-white dark:bg-stone-900 hover:bg-zinc-50 dark:hover:bg-stone-800/60 transition-colors duration-150 group border-b border-zinc-200 dark:border-stone-800"
                    >
                      {/* Nº */}
                      <td className="px-3 py-2 text-xs font-mono text-zinc-600 dark:text-stone-400 font-bold">
                        #{itemNumber}
                      </td>

                      {/* Cliente e Descrições Secundárias */}
                      <td className="px-3 py-2">
                        <div className="font-bold text-zinc-900 dark:text-white text-sm leading-snug">
                          {service.clientName}
                        </div>
                        {service.farmName && (
                          <div className="text-[11px] text-zinc-500 dark:text-stone-400 font-medium">
                            {service.farmName}
                          </div>
                        )}
                        {(service.freightOrigin || service.freightDestination) && (
                          <div className="text-[11px] text-zinc-600 dark:text-stone-300 font-medium flex items-center gap-1 mt-0.5">
                            <span className="bg-zinc-100 dark:bg-stone-800 text-zinc-800 dark:text-stone-200 font-semibold px-1.5 py-0.5 rounded border border-zinc-200 dark:border-stone-700">
                              Rota: {service.freightOrigin || 'Origem'} ➔ {service.freightDestination || 'Destino'}
                            </span>
                          </div>
                        )}
                        {(service.machineryAssigned || service.operatorAssigned || service.tractorName || service.forageHarvesterName || service.freightDriverName || service.freightMaterialType) && (
                          <div className="text-[11px] text-zinc-600 dark:text-stone-400 font-medium mt-0.5 flex flex-wrap items-center gap-1.5">
                            {service.freightMaterialType && (
                              <span className="text-purple-800 dark:text-purple-300 font-semibold bg-purple-50 dark:bg-purple-950/50 px-1.5 py-0.5 rounded border border-purple-200 dark:border-purple-800">
                                Carga: {service.freightMaterialType}
                              </span>
                            )}
                            {service.forageHarvesterName && (
                              <span className="text-amber-800 dark:text-amber-300 font-semibold bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                                Forr: {service.forageHarvesterName}
                              </span>
                            )}
                            {service.tractorName && (
                              <span className="text-blue-800 dark:text-blue-300 font-semibold bg-blue-50 dark:bg-blue-950/50 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                                Trator: {service.tractorName}
                              </span>
                            )}
                            {!service.forageHarvesterName && !service.tractorName && service.machineryAssigned && (
                              <span className="text-zinc-700 dark:text-stone-300 font-semibold bg-zinc-100 dark:bg-stone-800 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-stone-700">
                                {activeTab === 'frete' || service.serviceTab === 'frete' ? `Caminhão: ${service.machineryAssigned}` : service.machineryAssigned}
                              </span>
                            )}
                            {(service.operatorAssigned || service.tractorOperatorName || service.forageOperatorName || service.freightDriverName) && (
                              <span className="text-zinc-600 dark:text-stone-400 font-medium">
                                • {activeTab === 'frete' || service.serviceTab === 'frete' ? 'Motorista' : 'Op'}: {service.freightDriverName || service.operatorAssigned || service.tractorOperatorName || service.forageOperatorName}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Data */}
                      <td className="px-3 py-2 text-xs text-zinc-700 dark:text-stone-300 font-medium whitespace-nowrap">
                        {service.startDate ? formatDateBR(service.startDate) : '--'}
                      </td>

                      {/* Quantidade / Área */}
                      <td className="px-3 py-2 text-xs text-center text-zinc-800 dark:text-stone-200 font-bold whitespace-nowrap">
                        {quantityDisplay}
                      </td>

                      {/* Status */}
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        <span 
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            statusColors[currentStatus] || 'bg-zinc-100 text-zinc-800 border-zinc-300'
                          }`}
                        >
                          {statusLabels[currentStatus] || currentStatus}
                        </span>
                      </td>

                      {/* Total */}
                      <td className="px-3 py-2 text-right font-black text-zinc-900 dark:text-white text-xs sm:text-sm whitespace-nowrap">
                        {formatCurrencyBRL(service.totalAmount || 0)}
                      </td>

                      {/* Ações */}
                      <td className="px-2.5 py-2 text-right whitespace-nowrap">
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
