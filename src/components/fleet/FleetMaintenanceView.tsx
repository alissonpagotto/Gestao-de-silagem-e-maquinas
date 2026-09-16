import React, { useState, useMemo, useEffect } from 'react';
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
import { formatCurrencyBRL, formatDateBR, getStoredMaintenanceCategories, saveStoredMaintenanceCategories } from '../../lib/storage';
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
    return maintenanceLogs.filter((log) => {
      const matchSearch =
        log.machineryPlateOrName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.osNumber && log.osNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        log.workshopOrMechanic.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.serviceCategory.toLowerCase().includes(searchTerm.toLowerCase());

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
  }, [maintenanceLogs, searchTerm, selectedVehicle, selectedStatus, selectedCategory, selectedLocation, selectedPartsOrigin, filterReformaOnly, startDate, endDate]);

  // Statistics
  const totalCost = filteredLogs.reduce((acc, curr) => acc + curr.totalCost, 0);
  const totalParts = filteredLogs.reduce((acc, curr) => acc + curr.partsCost, 0);
  const totalLabor = filteredLogs.reduce((acc, curr) => acc + curr.laborCost, 0);
  const pendingCount = filteredLogs.filter(m => m.status === 'em_andamento' || m.status === 'agendada' || m.status === 'aguardando_pecas').length;

  /* CARD REFORMA & ENTRESSAFRA: CÁLCULOS TÉCNICOS */
  const reformaLogs = useMemo(() => {
    return maintenanceLogs.filter((log) => {
      const matchVehicle = selectedVehicle === 'todos' || log.machineryId === selectedVehicle;
      const matchLocation = selectedLocation === 'todos' || log.location === selectedLocation;
      const isReforma = 
        (log.type && (log.type.toLowerCase().includes('reforma') || log.type.toLowerCase().includes('entressafra'))) ||
        (log.serviceCategory && (log.serviceCategory.toLowerCase().includes('reforma') || log.serviceCategory.toLowerCase().includes('entressafra'))) ||
        (log.description && (log.description.toLowerCase().includes('reforma') || log.description.toLowerCase().includes('entressafra')));
      return matchVehicle && matchLocation && isReforma;
    });
  }, [maintenanceLogs, selectedVehicle, selectedLocation]);

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
    <div className="w-full space-y-5 sm:space-y-6 animate-in fade-in duration-200">
      
      {/* Conteúdo da Tela de Manutenção - Oculto na Impressão da OS */}
      <div className="w-full space-y-5 sm:space-y-6 print:hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 dark:border-stone-800 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <Wrench style={{ color: '#823028' }} className="w-5 h-5 text-[#823028]" />
            <h2 className="text-base font-bold text-stone-900 dark:text-stone-100 font-['Outfit']">
              Gestão de Manutenções & Ordens de Serviço (OS)
            </h2>
          </div>
          <p 
            style={{ color: '#000000' }} 
            className="text-xs text-[#000000] dark:text-stone-400 mt-0.5"
          >
            Controle de revisões preventivas, quebras na roça/estrada, baixa de estoque, cotações e faturamento NF-e
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          {/* Botão de Cotações da Roça */}
          <button
            onClick={() => setIsPurchaseModalOpen(true)}
            className="inline-flex items-center space-x-1.5 px-3 py-2 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
          >
            <ShoppingCart className="w-3.5 h-3.5 text-amber-600" />
            <span>Cotações & Compras</span>
            {purchaseRequests.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                {purchaseRequests.length}
              </span>
            )}
          </button>

          {/* Botão Nova OS */}
          <button
            onClick={onOpenNewMaintenance}
            className="inline-flex items-center space-x-2 px-4 py-2.5 bg-[#8da7eb] hover:bg-[#7292e7] text-slate-950 border border-[#7292e7] text-xs font-black rounded-xl shadow-xs transition active:scale-95 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4 text-slate-950" />
            <span>Nova Ordem de Manutenção</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
              Total Investido em Manutenção
            </span>
            <DollarSign className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-stone-900 dark:text-stone-100 mt-1 font-['Outfit']">
            {formatCurrencyBRL(totalCost)}
          </div>
          <p className="text-xs text-stone-500 mt-0.5">{filteredLogs.length} ordens de serviço</p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
              Peças & Insumos
            </span>
            <Layers className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-black text-sky-700 dark:text-sky-400 mt-1 font-['Outfit']">
            {formatCurrencyBRL(totalParts)}
          </div>
          <p className="text-xs text-stone-500 mt-0.5">Filtros, facas, rolamentos, óleos</p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
              Mão de Obra
            </span>
            <Wrench className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-700 dark:text-amber-400 mt-1 font-['Outfit']">
            {formatCurrencyBRL(totalLabor)}
          </div>
          <p className="text-xs text-stone-500 mt-0.5">Oficinas terceiras e mecânica</p>
        </div>

        {/* CARD REFORMA & ENTRESSAFRA */}
        <div 
          onClick={() => setFilterReformaOnly(prev => !prev)}
          className={`p-4 rounded-xl bg-white dark:bg-stone-900 border shadow-xs transition cursor-pointer select-none ${
            filterReformaOnly
              ? 'border-purple-500 ring-2 ring-purple-600/30 dark:ring-purple-500/40 bg-purple-50/20 dark:bg-purple-950/20'
              : 'border-stone-200 dark:border-stone-800 hover:border-purple-300 dark:hover:border-purple-700'
          }`}
          title={filterReformaOnly ? "Clique para desativar filtro de Reforma / Entressafra" : "Clique para filtrar manutenções de Reforma / Entressafra"}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
              REFORMA & ENTRESSAFRA
            </span>
            <Hammer className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-2xl font-black text-purple-700 dark:text-purple-400 mt-1 font-['Outfit']">
            {formatCurrencyBRL(totalReforma)}
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {reformaCount} {reformaCount === 1 ? 'máquina em reforma' : 'máquinas em reforma'}
            </p>
            {filterReformaOnly && (
              <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-950/60 px-1.5 py-0.5 rounded-md">
                Filtrando
              </span>
            )}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
              OS Em Aberto
            </span>
            <Clock className="w-4 h-4 text-rose-600" />
          </div>
          <div className={`text-2xl font-black mt-1 font-['Outfit'] ${pendingCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
            {pendingCount}
          </div>
          <p className="text-xs text-stone-500 mt-0.5">Veículos aguardando liberação</p>
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

      {/* Maintenance Logs Table (Clean, Compact and Full-Width without Horizontal Scroll) */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 overflow-hidden shadow-xs w-full">
        <div className="w-full overflow-x-auto xl:overflow-x-visible scrollbar-none">
          <table className="w-full text-left text-xs table-auto">
            <thead className="bg-stone-50 dark:bg-stone-800/80 text-[10px] sm:text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider border-b border-stone-200 dark:border-stone-800">
              <tr>
                <th className="py-2.5 px-2 whitespace-nowrap">Data & OS</th>
                <th className="py-2.5 px-2">Veículo</th>
                <th className="py-2.5 px-2 whitespace-nowrap">Local</th>
                <th className="py-2.5 px-2">Executante</th>
                <th className="py-2.5 px-2 whitespace-nowrap">Origem Peças</th>
                <th className="py-2.5 px-2">Descrição do Serviço</th>
                <th className="py-2.5 px-2 text-right whitespace-nowrap">Peças</th>
                <th className="py-2.5 px-2 text-right whitespace-nowrap">M. Obra</th>
                <th className="py-2.5 px-2 text-right whitespace-nowrap">Total</th>
                <th className="py-2.5 px-2 text-center whitespace-nowrap">Status</th>
                <th className="py-2.5 px-2 text-right whitespace-nowrap">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60 font-medium">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-stone-400">
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
                      <td className="py-2 px-2 whitespace-nowrap">
                        <div className="font-mono font-bold text-stone-800 dark:text-stone-200 text-xs">
                          {formatDateBR(log.date)}
                        </div>
                        <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-bold block mt-0.5">
                          {log.osNumber || `OS-${log.id.slice(-5)}`}
                        </span>
                      </td>

                      {/* Veículo */}
                      <td className="py-2 px-2 min-w-[120px] max-w-[180px]">
                        <div className="font-bold text-stone-900 dark:text-stone-100 text-xs truncate" title={log.machineryPlateOrName}>
                          {log.machineryPlateOrName}
                        </div>
                        <span className="text-[10px] text-stone-500 dark:text-stone-400 block font-medium truncate" title={`${log.type.toUpperCase()} • ${log.serviceCategory}`}>
                          {log.type.toUpperCase()} • {log.serviceCategory}
                        </span>
                      </td>

                      {/* Local (Badge Sutil com Cores do Requisito) */}
                      <td className="py-2 px-2 whitespace-nowrap">
                        <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${locBadge.badgeClass}`}>
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
                      <td className="py-2 px-2 min-w-[110px] max-w-[140px]">
                        <div className={`text-xs font-bold truncate ${execBadge.bg}`} title={execBadge.label}>
                          {execBadge.label}
                        </div>
                        <span className="text-[10px] text-stone-500 dark:text-stone-400 truncate block" title={execBadge.detail}>
                          {execBadge.detail}
                        </span>
                      </td>

                      {/* Origem das Peças */}
                      <td className="py-2 px-2 whitespace-nowrap">
                        {getPartsOriginBadge(log.partsOriginSummary)}
                        {log.nfeLink?.nfeNumber && (
                          <span className="text-[9px] font-mono text-stone-400 block mt-0.5">
                            NF-e: {log.nfeLink.nfeNumber}
                          </span>
                        )}
                      </td>

                      {/* Descrição */}
                      <td className="py-2 px-2 text-stone-700 dark:text-stone-300 min-w-[120px] max-w-xs">
                        <p className="line-clamp-2 text-xs leading-snug" title={log.description}>
                          {log.description}
                        </p>
                      </td>

                      {/* Peças */}
                      <td className="py-2 px-2 text-right font-mono text-xs text-stone-600 dark:text-stone-400 whitespace-nowrap">
                        {formatCurrencyBRL(log.partsCost)}
                      </td>

                      {/* M. Obra */}
                      <td className="py-2 px-2 text-right font-mono text-xs text-stone-600 dark:text-stone-400 whitespace-nowrap">
                        {formatCurrencyBRL(log.laborCost)}
                      </td>

                      {/* Total */}
                      <td className="py-2 px-2 text-right font-mono font-black text-xs text-stone-900 dark:text-stone-100 whitespace-nowrap">
                        {formatCurrencyBRL(log.totalCost)}
                      </td>

                      {/* Status */}
                      <td className="py-2 px-2 text-center whitespace-nowrap">
                        <select
                          value={log.status}
                          onChange={(e) => onUpdateStatus(log.id, e.target.value as any)}
                          className={`text-[10px] sm:text-[11px] font-bold px-2 py-1 rounded-lg border cursor-pointer ${
                            log.status === 'concluida'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300'
                              : log.status === 'em_andamento'
                              ? 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300'
                              : log.status === 'aguardando_pecas'
                              ? 'bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950/50 dark:text-purple-300'
                              : 'bg-stone-50 text-stone-600 border-stone-200 dark:bg-stone-800 dark:text-stone-300'
                          }`}
                        >
                          <option value="concluida">✓ Concluída</option>
                          <option value="em_andamento">⏳ Em Andamento</option>
                          <option value="aguardando_pecas">📦 Aguardando Peças</option>
                          <option value="agendada">📅 Agendada</option>
                        </select>
                      </td>

                      {/* Ações */}
                      <td className="py-2 px-2 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* Botão de Ação Rápida: Abrir itens */}
                          <button
                            type="button"
                            onClick={() => setViewingLog(log)}
                            title="Abrir itens / Visualizar detalhes da OS"
                            className="inline-flex items-center space-x-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-blue-800 text-[11px] font-bold transition cursor-pointer shrink-0 active:scale-95 shadow-2xs"
                          >
                            <Eye className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                            <span>Abrir itens</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onEditMaintenance(log)}
                            title="Editar OS"
                            className="p-1.5 text-stone-400 hover:text-blue-600 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onDeleteMaintenance(log.id)}
                            title="Excluir OS"
                            className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
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
