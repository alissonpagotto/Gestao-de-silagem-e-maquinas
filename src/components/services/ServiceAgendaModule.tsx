import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  Truck, 
  User, 
  Search, 
  Plus, 
  Printer, 
  Play, 
  Edit, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  ChevronRight, 
  Filter, 
  Scissors, 
  MapPin, 
  CalendarDays,
  ShieldCheck,
  Building,
  Layers,
  ArrowUpRight,
  TrendingUp,
  FileSpreadsheet
} from 'lucide-react';
import { 
  ServiceAppointment, 
  Machinery, 
  Employee, 
  Client, 
  CompanyProfile 
} from '../../types';
import { 
  getStoredAppointments, 
  saveStoredAppointments, 
  formatDateBR 
} from '../../lib/storage';
import { AppointmentFormModal } from './AppointmentFormModal';
import { PrintFieldOrderModal } from './PrintFieldOrderModal';

interface ServiceAgendaModuleProps {
  machineries?: Machinery[];
  employees?: Employee[];
  clients?: Client[];
  companyProfile?: CompanyProfile;
  onExecuteAppointment: (appointment: ServiceAppointment) => void;
}

// Exemplos iniciais realistas caso o banco esteja vazio
const DEFAULT_INITIAL_APPOINTMENTS: ServiceAppointment[] = [
  {
    id: 'appt-initial-01',
    appointmentNumber: 'AG-2026-001',
    clientId: 'cli-01',
    clientName: 'Fazenda Santa Maria (Agrícola Silveira)',
    farmName: 'Sede Principal - Talhão 04',
    locationCityState: 'Toledo - PR',
    contactPhone: '(45) 99812-4433',
    serviceType: 'Corte / Ensilagem',
    serviceTab: 'corte',
    startDate: '2026-09-18',
    startTime: '07:00',
    travelTimeMinutes: 45,
    trailerLoadingTimeMinutes: 30,
    areaUnit: 'hectares',
    estimatedQuantity: 28,
    productivityRatePerHour: 1.6,
    executionTimeMinutes: 1050, // 17h30min
    totalTimeMinutes: 1125, // 18h45min
    endDate: '2026-09-19',
    endTime: '01:45',
    primaryMachineryId: 'mach-01',
    primaryMachineryPrefix: 'Forrageira 01 - FOR-01',
    primaryMachineryPlate: 'SÉRIE JD-8500',
    primaryMachineryModel: 'John Deere 8500i',
    assignedVehicles: [
      {
        machineryId: 'truck-01',
        prefix: 'Caminhão 02 - CAM-02',
        plateOrSerial: 'MTU-8920',
        model: 'VW Constellation 24.280',
        category: 'caminhao',
        driverOrOperatorName: 'Carlos Eduardo Silveira'
      },
      {
        machineryId: 'truck-02',
        prefix: 'Caminhão 04 - CAM-04',
        plateOrSerial: 'BCX-4E12',
        model: 'Volvo VM 330',
        category: 'caminhao',
        driverOrOperatorName: 'Roberto Mendes'
      },
      {
        machineryId: 'trac-01',
        prefix: 'Trator 01 - TR-01',
        plateOrSerial: 'JD-7225J',
        model: 'John Deere 7225J',
        category: 'trator',
        driverOrOperatorName: 'Valdir Fontana'
      }
    ],
    assignedTeam: [
      {
        employeeId: 'emp-01',
        employeeName: 'Marcos Aurélio Silveira',
        role: 'Operador de Forrageira Principal',
        assignedVehiclePrefix: 'FOR-01'
      },
      {
        employeeId: 'emp-02',
        employeeName: 'Carlos Eduardo Silveira',
        role: 'Motorista de Caminhão Silagem',
        assignedVehiclePrefix: 'CAM-02'
      },
      {
        employeeId: 'emp-03',
        employeeName: 'Roberto Mendes',
        role: 'Motorista de Caminhão Silagem',
        assignedVehiclePrefix: 'CAM-04'
      },
      {
        employeeId: 'emp-04',
        employeeName: 'Valdir Fontana',
        role: 'Operador de Trator Compactador',
        assignedVehiclePrefix: 'TR-01'
      }
    ],
    status: 'agendado',
    fieldNotes: 'Entrada pelo trevo sul. Área com milho ponto dente 34% MS. Silo tipo trincheira 40x12m.',
    createdAt: '2026-09-15T10:00:00.000Z'
  },
  {
    id: 'appt-initial-02',
    appointmentNumber: 'AG-2026-002',
    clientId: 'cli-02',
    clientName: 'Agropecuária Bela Vista',
    farmName: 'Fazenda Bela Vista - Piquete 02',
    locationCityState: 'Cascavel - PR',
    contactPhone: '(45) 99765-2110',
    serviceType: 'Corte / Ensilagem',
    serviceTab: 'corte',
    startDate: '2026-09-20',
    startTime: '08:00',
    travelTimeMinutes: 60,
    trailerLoadingTimeMinutes: 40,
    areaUnit: 'hectares',
    estimatedQuantity: 18,
    productivityRatePerHour: 1.5,
    executionTimeMinutes: 720, // 12h
    totalTimeMinutes: 820, // 13h40min
    endDate: '2026-09-20',
    endTime: '21:40',
    primaryMachineryId: 'mach-02',
    primaryMachineryPrefix: 'Forrageira 02 - FOR-02',
    primaryMachineryPlate: 'CLAAS-870',
    primaryMachineryModel: 'Claas Jaguar 870',
    assignedVehicles: [
      {
        machineryId: 'truck-03',
        prefix: 'Caminhão 01 - CAM-01',
        plateOrSerial: 'BRA-2E19',
        model: 'Mercedes-Benz Axor 2544',
        category: 'caminhao',
        driverOrOperatorName: 'Gilberto Lima'
      }
    ],
    assignedTeam: [
      {
        employeeId: 'emp-05',
        employeeName: 'Rogério Batista',
        role: 'Operador de Forrageira Principal',
        assignedVehiclePrefix: 'FOR-02'
      },
      {
        employeeId: 'emp-06',
        employeeName: 'Gilberto Lima',
        role: 'Motorista de Caminhão Silagem',
        assignedVehiclePrefix: 'CAM-01'
      }
    ],
    status: 'agendado',
    fieldNotes: 'Acesso asfaltado até a sede. Silo superfície compactação com lâmina.',
    createdAt: '2026-09-16T14:30:00.000Z'
  }
];

export const ServiceAgendaModule: React.FC<ServiceAgendaModuleProps> = ({
  machineries = [],
  employees = [],
  clients = [],
  companyProfile,
  onExecuteAppointment,
}) => {
  // Estado principal de agendamentos
  const [appointments, setAppointments] = useState<ServiceAppointment[]>(() => {
    const stored = getStoredAppointments();
    if (stored && stored.length > 0) return stored;
    return DEFAULT_INITIAL_APPOINTMENTS;
  });

  // Filtros e Visualização
  const [viewMode, setViewMode] = useState<'cronograma' | 'frotas' | 'tabela'>('cronograma');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [dateFilter, setDateFilter] = useState<string>('');

  // Modais
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editAppointment, setEditAppointment] = useState<ServiceAppointment | null>(null);
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [selectedForPrint, setSelectedForPrint] = useState<ServiceAppointment | null>(null);

  // Sincronização e persistência
  useEffect(() => {
    saveStoredAppointments(appointments);
  }, [appointments]);

  // Próximo número de agendamento sequencial
  const nextAppointmentNumber = useMemo(() => {
    const year = new Date().getFullYear();
    const count = appointments.length + 1;
    return `AG-${year}-${String(count).padStart(3, '0')}`;
  }, [appointments]);

  // Lista filtrada
  const filteredAppointments = useMemo(() => {
    return appointments.filter(app => {
      // Filtro de Texto
      const term = searchTerm.toLowerCase();
      const matchText = 
        !term ||
        app.appointmentNumber.toLowerCase().includes(term) ||
        app.clientName.toLowerCase().includes(term) ||
        (app.farmName && app.farmName.toLowerCase().includes(term)) ||
        (app.locationCityState && app.locationCityState.toLowerCase().includes(term)) ||
        (app.primaryMachineryPrefix && app.primaryMachineryPrefix.toLowerCase().includes(term)) ||
        (app.primaryMachineryPlate && app.primaryMachineryPlate.toLowerCase().includes(term)) ||
        app.assignedVehicles?.some(v => 
          v.prefix.toLowerCase().includes(term) || 
          v.plateOrSerial.toLowerCase().includes(term) ||
          (v.driverOrOperatorName && v.driverOrOperatorName.toLowerCase().includes(term))
        );

      // Filtro de Status
      const matchStatus = statusFilter === 'todos' || app.status === statusFilter;

      // Filtro de Data
      const matchDate = !dateFilter || app.startDate === dateFilter;

      return matchText && matchStatus && matchDate;
    }).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }, [appointments, searchTerm, statusFilter, dateFilter]);

  // Métricas de Resumo
  const metrics = useMemo(() => {
    const total = appointments.length;
    const agendados = appointments.filter(a => a.status === 'agendado').length;
    const emExecucao = appointments.filter(a => a.status === 'em_execucao' || a.status === 'em_deslocamento').length;
    const concluidos = appointments.filter(a => a.status === 'concluido').length;
    const totalHectares = appointments
      .filter(a => a.status !== 'cancelado')
      .reduce((acc, a) => acc + (a.areaUnit === 'hectares' ? a.estimatedQuantity : 0), 0);

    return { total, agendados, emExecucao, concluidos, totalHectares };
  }, [appointments]);

  // Manipuladores de Ação
  const handleCreateNew = () => {
    setEditAppointment(null);
    setIsFormOpen(true);
  };

  const handleEdit = (appointment: ServiceAppointment) => {
    setEditAppointment(appointment);
    setIsFormOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Tem certeza que deseja remover este agendamento da agenda?')) {
      const updated = appointments.filter(a => a.id !== id);
      setAppointments(updated);
    }
  };

  const handleSaveAppointment = (saved: ServiceAppointment) => {
    const exists = appointments.some(a => a.id === saved.id);
    let updated: ServiceAppointment[];
    if (exists) {
      updated = appointments.map(a => a.id === saved.id ? saved : a);
    } else {
      updated = [saved, ...appointments];
    }
    setAppointments(updated);
  };

  const handleOpenPrint = (appointment: ServiceAppointment) => {
    setSelectedForPrint(appointment);
    setIsPrintOpen(true);
  };

  // Execução do Serviço: Puxar cliente e dados para o Corte
  const handleExecuteService = (appointment: ServiceAppointment) => {
    // 1. Atualiza status do agendamento para 'em_execucao'
    const updated = appointments.map(a => 
      a.id === appointment.id ? { ...a, status: 'em_execucao' as const } : a
    );
    setAppointments(updated);

    // 2. Chama handler que preenche e abre o formulário de corte
    onExecuteAppointment(appointment);
  };

  const formatMinToHoursText = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}min`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}min`;
  };

  return (
    <div className="space-y-6">
      
      {/* 1. CABEÇALHO DO MÓDULO & AÇÕES PRINCIPAIS */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-[#2e65aa]/10 text-[#2e65aa] dark:bg-blue-950 dark:text-blue-300">
                <CalendarDays className="w-6 h-6" />
              </span>
              <div>
                <h1 className="text-xl font-extrabold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <span>Agenda de Serviços Agrícolas</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-bold">
                    Logística & Frotas
                  </span>
                </h1>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                  Cálculo de tempos (Deslocamento + Prancha + Execução), escala de frotas por placas/prefixos sem sobreposição de horários.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCreateNew}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2e65aa] hover:bg-[#25528c] active:bg-[#1d4273] text-white text-xs font-extrabold shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Agendamento</span>
            </button>
          </div>
        </div>

        {/* 2. CARDS DE MÉTRICAS KPI */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-stone-100 dark:border-stone-800">
          <div className="bg-stone-50 dark:bg-stone-800/40 p-3 rounded-xl border border-stone-200/80 dark:border-stone-800">
            <span className="text-[10px] font-bold uppercase text-stone-500 block">Total Agendado</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-black text-stone-900 dark:text-stone-100">{metrics.total}</span>
              <span className="text-xs font-semibold text-stone-400">operações</span>
            </div>
          </div>

          <div className="bg-amber-50/60 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-200/80 dark:border-amber-900/40">
            <span className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400 block">Aguardando Saída</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-black text-amber-900 dark:text-amber-300">{metrics.agendados}</span>
              <span className="text-xs font-semibold text-amber-600">na base</span>
            </div>
          </div>

          <div className="bg-emerald-50/60 dark:bg-emerald-950/20 p-3 rounded-xl border border-emerald-200/80 dark:border-emerald-900/40">
            <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400 block">Em Campo / Execução</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-black text-emerald-900 dark:text-emerald-300">{metrics.emExecucao}</span>
              <span className="text-xs font-semibold text-emerald-600">em operação</span>
            </div>
          </div>

          <div className="bg-blue-50/60 dark:bg-blue-950/20 p-3 rounded-xl border border-blue-200/80 dark:border-blue-900/40">
            <span className="text-[10px] font-bold uppercase text-blue-700 dark:text-blue-400 block">Área Programada</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-black text-blue-900 dark:text-blue-300">{metrics.totalHectares.toFixed(1)}</span>
              <span className="text-xs font-semibold text-blue-600">ha estimados</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. BARRA DE FILTROS E SELEÇÃO DE VISÃO */}
      <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Seletor de Abas de Visão */}
        <div className="flex items-center gap-1 bg-stone-100 dark:bg-stone-800 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setViewMode('cronograma')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
              viewMode === 'cronograma'
                ? 'bg-white dark:bg-stone-900 text-[#2e65aa] shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
          >
            Cronograma Operacional
          </button>
          <button
            type="button"
            onClick={() => setViewMode('frotas')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
              viewMode === 'frotas'
                ? 'bg-white dark:bg-stone-900 text-[#2e65aa] shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
          >
            Escala por Placas/Frotas
          </button>
          <button
            type="button"
            onClick={() => setViewMode('tabela')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
              viewMode === 'tabela'
                ? 'bg-white dark:bg-stone-900 text-[#2e65aa] shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
          >
            Lista Completa
          </button>
        </div>

        {/* Filtros: Busca e Status */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-stone-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar cliente, fazenda, placa ou prefixo..."
              className="w-full pl-8 pr-3 py-1.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs font-medium text-stone-900 dark:text-stone-100"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="p-1.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs font-bold text-stone-700 dark:text-stone-200"
          >
            <option value="todos">Todos os Status</option>
            <option value="agendado">Agendado</option>
            <option value="em_deslocamento">Em Deslocamento</option>
            <option value="em_execucao">Em Execução</option>
            <option value="concluido">Concluído</option>
            <option value="cancelado">Cancelado</option>
          </select>

          {dateFilter && (
            <button
              type="button"
              onClick={() => setDateFilter('')}
              className="text-xs text-red-600 hover:underline font-bold"
            >
              Limpar Data
            </button>
          )}
        </div>
      </div>

      {/* 4. CONTEÚDO PRINCIPAL DE ACORDO COM A VISÃO SELECIONADA */}

      {/* VISÃO 1: CRONOGRAMA OPERACIONAL */}
      {viewMode === 'cronograma' && (
        <div className="space-y-4">
          {filteredAppointments.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-stone-900 rounded-2xl border border-dashed border-stone-300 dark:border-stone-800">
              <Calendar className="w-12 h-12 text-stone-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-stone-700 dark:text-stone-300">
                Nenhum agendamento encontrado
              </h3>
              <p className="text-xs text-stone-500 mt-1">
                Ajuste os filtros ou crie um novo agendamento de serviço com cálculo de tempo e escala de frota.
              </p>
              <button
                type="button"
                onClick={handleCreateNew}
                className="mt-4 px-4 py-2 bg-[#2e65aa] text-white rounded-xl text-xs font-bold hover:bg-[#25528c]"
              >
                + Criar Primeiro Agendamento
              </button>
            </div>
          ) : (
            filteredAppointments.map((app) => (
              <div
                key={app.id}
                className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs hover:border-[#2e65aa]/60 transition-all p-5 space-y-4"
              >
                {/* Linha Superior: Cabeçalho do Card */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100 dark:border-stone-800">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-black px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700">
                      {app.appointmentNumber}
                    </span>
                    <div>
                      <h3 className="text-base font-black text-stone-900 dark:text-stone-100 flex items-center gap-2">
                        <span>{app.clientName}</span>
                        {app.farmName && (
                          <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">
                            • {app.farmName}
                          </span>
                        )}
                      </h3>
                      <div className="flex items-center gap-3 text-xs text-stone-500 mt-0.5">
                        {app.locationCityState && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-stone-400" />
                            {app.locationCityState}
                          </span>
                        )}
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                          {app.serviceType}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status Badge e Botões Rápidos */}
                  <div className="flex items-center gap-2 self-start sm:self-center">
                    <span className={`text-[11px] font-black uppercase px-2.5 py-1 rounded-lg border ${
                      app.status === 'em_execucao'
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300 animate-pulse'
                        : app.status === 'em_deslocamento'
                        ? 'bg-blue-100 text-blue-900 border-blue-300'
                        : app.status === 'concluido'
                        ? 'bg-stone-100 text-stone-800 border-stone-300'
                        : app.status === 'cancelado'
                        ? 'bg-red-100 text-red-800 border-red-300'
                        : 'bg-amber-100 text-amber-900 border-amber-300'
                    }`}>
                      {app.status === 'em_execucao' ? '● Em Execução no Corte' : app.status.replace('_', ' ')}
                    </span>

                    {/* AÇÃO PRINCIPAL: Puxar para Corte / Iniciar Execução */}
                    <button
                      type="button"
                      onClick={() => handleExecuteService(app)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black shadow-xs transition-colors cursor-pointer"
                      title="Puxar cliente e dados agendados para preencher novo corte automaticamente"
                    >
                      <Scissors className="w-3.5 h-3.5" />
                      <span>Iniciar Execução (Puxar Corte)</span>
                    </button>

                    {/* Botão de Impressão A4 da Ordem de Campo */}
                    <button
                      type="button"
                      onClick={() => handleOpenPrint(app)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 hover:bg-stone-100 text-stone-700 dark:text-stone-200 text-xs font-bold transition-colors cursor-pointer"
                      title="Imprimir Ordem de Campo em via única A4"
                    >
                      <Printer className="w-3.5 h-3.5 text-stone-500" />
                      <span>Ordem de Campo (A4)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleEdit(app)}
                      className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-700 hover:bg-stone-100 text-stone-600 dark:text-stone-300 transition-colors"
                      title="Editar agendamento"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(app.id)}
                      className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-700 hover:bg-red-50 text-red-500 transition-colors"
                      title="Excluir agendamento"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Linha Central: Desdobramento dos Tempos Logísticos e Produção */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 p-3 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200/70 dark:border-stone-800 text-xs">
                  <div>
                    <span className="block text-[10px] font-bold uppercase text-stone-500">Início / Saída Base</span>
                    <span className="font-extrabold text-stone-900 dark:text-stone-100">
                      {formatDateBR(app.startDate)} às {app.startTime}h
                    </span>
                  </div>

                  <div>
                    <span className="block text-[10px] font-bold uppercase text-stone-500">Deslocamento + Prancha</span>
                    <span className="font-bold text-stone-800 dark:text-stone-200">
                      {formatMinToHoursText(app.travelTimeMinutes)} + {formatMinToHoursText(app.trailerLoadingTimeMinutes)}
                    </span>
                  </div>

                  <div>
                    <span className="block text-[10px] font-bold uppercase text-stone-500">Área & Rendimento</span>
                    <span className="font-bold text-stone-800 dark:text-stone-200">
                      {app.estimatedQuantity} {app.areaUnit === 'hectares' ? 'ha' : app.areaUnit} ({app.productivityRatePerHour} {app.areaUnit === 'hectares' ? 'ha/h' : '/h'})
                    </span>
                  </div>

                  <div>
                    <span className="block text-[10px] font-bold uppercase text-stone-500">Tempo Execução</span>
                    <span className="font-bold text-stone-800 dark:text-stone-200">
                      {formatMinToHoursText(app.executionTimeMinutes)}
                    </span>
                  </div>

                  <div className="bg-emerald-50/80 dark:bg-emerald-950/40 p-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    <span className="block text-[9px] font-black uppercase text-emerald-800 dark:text-emerald-400">Tempo Total Operacional</span>
                    <span className="font-black text-emerald-900 dark:text-emerald-300">
                      {formatMinToHoursText(app.totalTimeMinutes)}
                    </span>
                    <span className="block text-[10px] text-stone-500 font-semibold">Término: {app.endTime}h</span>
                  </div>
                </div>

                {/* Linha Inferior: Veículos Escalados (Prefixo e Placa) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold uppercase text-stone-500 flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-[#2e65aa]" />
                      <span>Frotas e Veículos Escalados (Rastreados por Placas / Prefixos):</span>
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {/* Forrageira Principal */}
                    {app.primaryMachineryPrefix && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 text-xs font-bold text-emerald-950 dark:text-emerald-200">
                        <Scissors className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{app.primaryMachineryPrefix}</span>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white dark:bg-stone-900 border border-emerald-200">
                          {app.primaryMachineryPlate}
                        </span>
                      </div>
                    )}

                    {/* Veículos de Apoio (Caminhões e Tratores) */}
                    {app.assignedVehicles?.map((v, idx) => (
                      <div
                        key={idx}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${
                          v.category === 'caminhao'
                            ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-950 dark:text-blue-200'
                            : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-950 dark:text-amber-200'
                        }`}
                      >
                        <Truck className="w-3.5 h-3.5 opacity-70" />
                        <span className="font-bold">{v.prefix}</span>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white dark:bg-stone-900 border border-stone-200">
                          {v.plateOrSerial}
                        </span>
                        {v.driverOrOperatorName && (
                          <span className="text-[10px] opacity-75">
                            ({v.driverOrOperatorName})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Observações de Campo se houver */}
                {app.fieldNotes && (
                  <p className="text-xs italic text-stone-500 dark:text-stone-400 bg-stone-50/50 dark:bg-stone-800/30 p-2 rounded-lg border border-stone-100 dark:border-stone-800">
                    <strong>Instruções de Campo:</strong> {app.fieldNotes}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* VISÃO 2: ESCALA POR FROTAS E VEÍCULOS (TIMELINE DE USO) */}
      {viewMode === 'frotas' && (
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-5 space-y-4">
          <div className="border-b border-stone-100 dark:border-stone-800 pb-3">
            <h3 className="text-sm font-extrabold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <Truck className="w-4 h-4 text-[#2e65aa]" />
              <span>Escala e Ocupação Individual de Frotas (Prevenção de Sobreposição)</span>
            </h3>
            <p className="text-xs text-stone-500">
              Cada máquina e caminhão rastreado estritamente por Placa ou Prefixo de frota com os períodos alocados.
            </p>
          </div>

          <div className="space-y-3">
            {machineries.map(mach => {
              const prefix = mach.fleetNumber || mach.name;
              const plate = mach.licensePlateOrSerial || mach.serialNumber || 'OFICIAL';

              // Agendamentos deste veículo
              const vehicleAppts = appointments.filter(a => {
                if (a.status === 'cancelado') return false;
                if (a.primaryMachineryId === mach.id) return true;
                return a.assignedVehicles?.some(v => v.machineryId === mach.id);
              });

              return (
                <div 
                  key={mach.id}
                  className="p-3.5 rounded-xl border border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700 bg-stone-50/50 dark:bg-stone-800/30 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-white dark:bg-stone-900 border border-stone-200 text-stone-900 dark:text-stone-100">
                        {prefix}
                      </span>
                      <span className="font-mono text-xs font-bold text-stone-600 dark:text-stone-400">
                        Placa/Série: {plate}
                      </span>
                      <span className="text-xs font-medium text-stone-500">
                        • {mach.model || mach.name}
                      </span>
                    </div>

                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${
                      vehicleAppts.length > 0 
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' 
                        : 'bg-stone-200 text-stone-700 dark:bg-stone-700 dark:text-stone-300'
                    }`}>
                      {vehicleAppts.length} {vehicleAppts.length === 1 ? 'Serviço Agendado' : 'Serviços Agendados'}
                    </span>
                  </div>

                  {/* Lista de Compromissos do Veículo */}
                  {vehicleAppts.length === 0 ? (
                    <p className="text-xs text-stone-400 italic">Disponível para agendamento (nenhum conflito registrado).</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {vehicleAppts.map(a => (
                        <div 
                          key={a.id}
                          className="p-2 bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-800 text-xs flex items-center justify-between"
                        >
                          <div>
                            <span className="font-bold text-stone-900 dark:text-stone-100 block truncate">
                              {a.clientName} ({a.farmName || 'Fazenda'})
                            </span>
                            <span className="text-[11px] text-stone-500">
                              {formatDateBR(a.startDate)} • {a.startTime}h às {a.endTime}h ({formatMinToHoursText(a.totalTimeMinutes)})
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 ml-2">
                            <button
                              type="button"
                              onClick={() => handleExecuteService(a)}
                              className="px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded text-[10px] font-black cursor-pointer"
                              title="Puxar para corte"
                            >
                              Puxar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenPrint(a)}
                              className="p-1 text-stone-500 hover:text-stone-700 rounded"
                              title="Ordem de Campo"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VISÃO 3: TABELA COMPLETA */}
      {viewMode === 'tabela' && (
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold border-b border-stone-200 dark:border-stone-700">
                  <th className="p-3">Nº Agendamento</th>
                  <th className="p-3">Cliente / Fazenda</th>
                  <th className="p-3">Data & Saída</th>
                  <th className="p-3">Tempo Total</th>
                  <th className="p-3">Máquina Principal</th>
                  <th className="p-3">Frotas de Apoio</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {filteredAppointments.map(a => (
                  <tr key={a.id} className="hover:bg-stone-50 dark:hover:bg-stone-800/40">
                    <td className="p-3 font-mono font-bold text-stone-900 dark:text-stone-100">
                      {a.appointmentNumber}
                    </td>
                    <td className="p-3">
                      <div className="font-extrabold text-stone-900 dark:text-stone-100">{a.clientName}</div>
                      <div className="text-[11px] text-stone-500">{a.farmName || a.locationCityState}</div>
                    </td>
                    <td className="p-3 font-semibold text-stone-800 dark:text-stone-200">
                      {formatDateBR(a.startDate)} às {a.startTime}h
                    </td>
                    <td className="p-3 font-bold text-emerald-800 dark:text-emerald-400">
                      {formatMinToHoursText(a.totalTimeMinutes)}
                    </td>
                    <td className="p-3 font-medium">
                      <span className="font-bold">{a.primaryMachineryPrefix}</span>
                      <span className="text-[10px] text-stone-400 block font-mono">{a.primaryMachineryPlate}</span>
                    </td>
                    <td className="p-3">
                      <span className="text-[11px] font-semibold text-stone-600 dark:text-stone-300">
                        {a.assignedVehicles?.length || 0} veículos
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-800 border">
                        {a.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-1">
                      <button
                        type="button"
                        onClick={() => handleExecuteService(a)}
                        className="px-2 py-1 bg-emerald-700 text-white rounded font-bold text-[10px] hover:bg-emerald-800"
                        title="Puxar para corte"
                      >
                        Puxar Corte
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenPrint(a)}
                        className="p-1 text-stone-500 hover:text-stone-700"
                        title="Imprimir Ordem de Campo"
                      >
                        <Printer className="w-3.5 h-3.5 inline" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEdit(a)}
                        className="p-1 text-stone-500 hover:text-stone-700"
                      >
                        <Edit className="w-3.5 h-3.5 inline" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(a.id)}
                        className="p-1 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-3.5 h-3.5 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL DE CRIAÇÃO / EDIÇÃO DE AGENDAMENTO COM CALCULO DE TEMPO E ANTI-SOBREPOSIÇÃO */}
      <AppointmentFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSaveAppointment}
        editAppointment={editAppointment}
        existingAppointments={appointments}
        machineries={machineries}
        employees={employees}
        clients={clients}
        nextAppointmentNumber={nextAppointmentNumber}
      />

      {/* MODAL DE IMPRESSÃO EM VIA ÚNICA A4 DA ORDEM DE CAMPO */}
      <PrintFieldOrderModal
        isOpen={isPrintOpen}
        onClose={() => setIsPrintOpen(false)}
        appointment={selectedForPrint}
        companyProfile={companyProfile}
      />

    </div>
  );
};
