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
  CompanyProfile,
  FleetTeam 
} from '../../types';
import { 
  getStoredAppointments, 
  saveStoredAppointments, 
  getStoredFleetTeams,
  saveStoredFleetTeams,
  formatDateBR 
} from '../../lib/storage';
import { deleteAgendamento } from '../../lib/supabaseService';
import { AppointmentFormModal } from './AppointmentFormModal';
import { PrintFieldOrderModal } from './PrintFieldOrderModal';
import { ForageHarvesterIcon } from '../fleet/ForageHarvesterIcon';
import { VehicleSearchModal } from './VehicleSearchModal';

interface ServiceAgendaModuleProps {
  machineries?: Machinery[];
  employees?: Employee[];
  clients?: Client[];
  companyProfile?: CompanyProfile;
  onExecuteAppointment: (appointment: ServiceAppointment) => void;
}

// Colunas padrão de Máquinas Principais correspondentes às frentes ativas
const DEFAULT_MACHINE_COLUMNS = [
  {
    id: 'team_maq_02',
    name: 'Maq 02',
    headerBgColor: '#fef08a',
    columnBgColor: '#fefce8',
    borderColor: '#ca8a04',
    machineryId: 'veh_forr_05_2023',
    machineryName: 'FORR 05 2023 (Claas 870)',
    frontNumber: 1,
  },
  {
    id: 'team_maq_03',
    name: 'Maq 03',
    headerBgColor: '#fed7aa',
    columnBgColor: '#fff7ed',
    borderColor: '#ea580c',
    machineryId: 'veh_colh_02_2022',
    machineryName: 'COLH 02 2022 (Claas 860)',
    frontNumber: 2,
  },
  {
    id: 'team_maq_04',
    name: 'Maq 04',
    headerBgColor: '#bbf7d0',
    columnBgColor: '#f0fdf4',
    borderColor: '#16a34a',
    machineryId: 'veh_trator_jd_6110',
    machineryName: 'Trator JD 6110J + JF C120',
    frontNumber: 3,
  },
  {
    id: 'team_maq_05',
    name: 'Maq 05',
    headerBgColor: '#fde047',
    columnBgColor: '#fef9c3',
    borderColor: '#eab308',
    machineryId: 'veh_evd_2j61',
    machineryName: 'Frota MB 2726 + Suporte',
    frontNumber: 4,
  },
];

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
  const [isVehicleSearchModalOpen, setIsVehicleSearchModalOpen] = useState(false);
  const [selectedColumnForVehicle, setSelectedColumnForVehicle] = useState<{
    id: string;
    name: string;
    machineryId?: string;
  } | null>(null);

  // Confirmação de Exclusão (Regras 1, 2 e 3)
  const [appointmentToDelete, setAppointmentToDelete] = useState<ServiceAppointment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  // Colunas de Máquinas Principais (sincronizadas com as equipes ativas ou padrão Maq 02, Maq 03, Maq 04, Maq 05)
  const [columnsList, setColumnsList] = useState(() => {
    const storedTeams = getStoredFleetTeams();
    if (storedTeams && storedTeams.length > 0) {
      return storedTeams.map((team, idx) => ({
        id: team.id,
        name: team.name,
        machineryId: team.machineryId,
        machineryName: team.machineryName || team.name,
        headerBgColor: team.headerBgColor || '#fef08a',
        columnBgColor: team.columnBgColor || '#fefce8',
        borderColor: team.borderColor || '#ca8a04',
        frontNumber: team.order || idx + 1,
      }));
    }
    return DEFAULT_MACHINE_COLUMNS;
  });

  const machineColumns = columnsList;

  // Agrupamento dos agendamentos filtrados por cada Máquina Principal com ordenação cronológica
  const appointmentsByColumn = useMemo(() => {
    const map: Record<string, ServiceAppointment[]> = {};
    machineColumns.forEach(col => {
      map[col.id] = [];
    });

    filteredAppointments.forEach(app => {
      let matchedColId: string | null = null;

      for (const col of machineColumns) {
        // 1. Pelo ID direto da máquina
        if (app.primaryMachineryId && col.machineryId && app.primaryMachineryId === col.machineryId) {
          matchedColId = col.id;
          break;
        }

        const appPrefix = (app.primaryMachineryPrefix || '').toLowerCase();
        const appModel = (app.primaryMachineryModel || '').toLowerCase();
        const colName = col.name.toLowerCase();
        const colMach = (col.machineryName || '').toLowerCase();

        // 2. Checa se o número de máquina casa (ex: "Maq 02" casa com "Forrageira 02", "FOR-02", "02")
        const numMatch = colName.match(/\d+/);
        if (numMatch) {
          const num = numMatch[0];
          const paddedNum = num.padStart(2, '0');
          if (
            appPrefix.includes(`maq ${num}`) ||
            appPrefix.includes(`maq ${paddedNum}`) ||
            appPrefix.includes(`forr ${num}`) ||
            appPrefix.includes(`forr ${paddedNum}`) ||
            appPrefix.includes(`for-${paddedNum}`) ||
            appPrefix.includes(`for-${num}`) ||
            appPrefix.includes(` ${paddedNum}`) ||
            appPrefix.includes(` ${num}`)
          ) {
            matchedColId = col.id;
            break;
          }
        }

        // 3. Checa modelo das máquinas (ex: 870, 860, 6110, 2726, 8500)
        if (colMach.includes('870') && (appModel.includes('870') || appPrefix.includes('870'))) {
          matchedColId = col.id;
          break;
        }
        if (colMach.includes('860') && (appModel.includes('860') || appPrefix.includes('860'))) {
          matchedColId = col.id;
          break;
        }
        if (colMach.includes('6110') && (appModel.includes('6110') || appPrefix.includes('6110'))) {
          matchedColId = col.id;
          break;
        }
        if (colMach.includes('2726') && (appModel.includes('2726') || appPrefix.includes('2726'))) {
          matchedColId = col.id;
          break;
        }

        // 4. Checagem textual aproximada
        if (colMach && appPrefix.includes(colMach)) {
          matchedColId = col.id;
          break;
        }
        if (colName && appPrefix.includes(colName)) {
          matchedColId = col.id;
          break;
        }
      }

      // Se encontrou coluna, adiciona
      if (matchedColId && map[matchedColId]) {
        map[matchedColId].push(app);
      } else if (machineColumns[0]) {
        // Fallback seguro: se não deu match com nenhuma máquina específica, coloca na primeira coluna
        map[machineColumns[0].id].push(app);
      }
    });

    // Ordenação estrita CRONOLÓGICA dentro de cada coluna (primeiros horários no topo)
    machineColumns.forEach(col => {
      map[col.id].sort((a, b) => {
        const timeA = new Date(`${a.startDate}T${a.startTime || '00:00'}`).getTime();
        const timeB = new Date(`${b.startDate}T${b.startTime || '00:00'}`).getTime();
        return timeA - timeB;
      });
    });

    return map;
  }, [machineColumns, filteredAppointments]);

  // Drag and Drop entre colunas de máquinas
  const [draggedApptId, setDraggedApptId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, apptId: string) => {
    e.dataTransfer.setData('text/plain', apptId);
    setDraggedApptId(apptId);
  };

  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    setDragOverColId(colId);
  };

  const handleDragLeave = (e: React.DragEvent, colId: string) => {
    if (dragOverColId === colId) {
      setDragOverColId(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetCol: typeof machineColumns[0]) => {
    e.preventDefault();
    const apptId = e.dataTransfer.getData('text/plain') || draggedApptId;
    setDragOverColId(null);
    setDraggedApptId(null);
    if (!apptId) return;

    const targetApp = appointments.find(a => a.id === apptId);
    if (!targetApp) return;

    // Atualiza a máquina principal do agendamento
    const updated = appointments.map(a => {
      if (a.id === apptId) {
        return {
          ...a,
          primaryMachineryId: targetCol.machineryId || targetCol.id,
          primaryMachineryPrefix: `${targetCol.name} - ${targetCol.machineryName || ''}`.trim(),
        };
      }
      return a;
    });
    setAppointments(updated);
  };

  const handleOpenVehicleSearch = (col: { id: string; name: string; machineryId?: string }) => {
    setSelectedColumnForVehicle(col);
    setIsVehicleSearchModalOpen(true);
  };

  const handleSelectVehicleForColumn = (vehicle: { id: string; name: string; prefix?: string }) => {
    if (!selectedColumnForVehicle) return;

    const formattedMachName = `${vehicle.prefix ? `[${vehicle.prefix}] ` : ''}${vehicle.name}`;

    const updatedCols = columnsList.map(c => {
      if (c.id === selectedColumnForVehicle.id) {
        return {
          ...c,
          machineryId: vehicle.id,
          machineryName: formattedMachName,
        };
      }
      return c;
    });

    setColumnsList(updatedCols);

    // Salva nas frotas
    const currentStoredTeams = getStoredFleetTeams();
    if (currentStoredTeams && currentStoredTeams.length > 0) {
      const updatedTeams = currentStoredTeams.map(t => {
        if (t.id === selectedColumnForVehicle.id) {
          return {
            ...t,
            machineryId: vehicle.id,
            machineryName: formattedMachName,
          };
        }
        return t;
      });
      saveStoredFleetTeams(updatedTeams);
    } else {
      const newTeams: FleetTeam[] = updatedCols.map((c, idx) => ({
        id: c.id,
        name: c.name,
        machineryId: c.machineryId,
        machineryName: c.machineryName,
        headerBgColor: c.headerBgColor,
        columnBgColor: c.columnBgColor,
        borderColor: c.borderColor,
        order: idx + 1,
        createdAt: new Date().toISOString(),
      }));
      saveStoredFleetTeams(newTeams);
    }

    setIsVehicleSearchModalOpen(false);
    setSelectedColumnForVehicle(null);
  };

  // Manipuladores de Ação
  const handleCreateNew = (presetMachineryId?: string, presetMachineryPrefix?: string) => {
    if (presetMachineryId || presetMachineryPrefix) {
      setEditAppointment({
        id: '',
        appointmentNumber: nextAppointmentNumber,
        clientId: '',
        clientName: '',
        farmName: '',
        locationCityState: '',
        contactPhone: '',
        serviceType: 'Corte / Ensilagem',
        serviceTab: 'corte',
        startDate: new Date().toISOString().split('T')[0],
        startTime: '07:00',
        travelTimeMinutes: 60,
        trailerLoadingTimeMinutes: 45,
        areaUnit: 'hectares',
        estimatedQuantity: 20,
        productivityRatePerHour: 1.5,
        executionTimeMinutes: 800,
        totalTimeMinutes: 905,
        endDate: new Date().toISOString().split('T')[0],
        endTime: '22:05',
        primaryMachineryId: presetMachineryId || '',
        primaryMachineryPrefix: presetMachineryPrefix || '',
        assignedVehicles: [],
        assignedTeam: [],
        status: 'agendado',
        createdAt: new Date().toISOString()
      } as ServiceAppointment);
    } else {
      setEditAppointment(null);
    }
    setIsFormOpen(true);
  };

  const handleEdit = (appointment: ServiceAppointment) => {
    setEditAppointment(appointment);
    setIsFormOpen(true);
  };

  // 1. Confirmação de Exclusão: Abre o alerta de confirmação na tela
  const handleDeleteClick = (appointment: ServiceAppointment) => {
    setAppointmentToDelete(appointment);
  };

  // 2. Integração com o Supabase & 3. Atualização Instantânea do Quadro (State Update)
  const handleConfirmDelete = async () => {
    if (!appointmentToDelete) return;
    const targetId = appointmentToDelete.id;
    setIsDeleting(true);

    try {
      // 2. Chamada de exclusão (DELETE) na tabela de agendamentos do banco de dados utilizando o ID do card
      await deleteAgendamento(targetId);
    } catch (err) {
      console.warn('Erro ao excluir no Supabase:', err);
    }

    // 3. Remove instantaneamente o card da tela e atualiza o contador de serviços da coluna correspondente
    // (ex: de "3 serviços" para "2 serviços" na Maq 02), sem precisar recarregar a página inteira
    setAppointments(prev => {
      const updated = prev.filter(a => a.id !== targetId);
      saveStoredAppointments(updated);
      return updated;
    });

    setIsDeleting(false);
    setAppointmentToDelete(null);
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
    <div className="space-y-2.5">
      
      {/* 1. CABEÇALHO DO MÓDULO & AÇÕES PRINCIPAIS (LAYOUT COMPACTO) */}
      <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 p-2.5 sm:p-3 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#2e65aa]/10 text-[#2e65aa] dark:bg-blue-950 dark:text-blue-300 shrink-0">
              <CalendarDays className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-sm sm:text-base font-extrabold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <span>Agenda de Serviços Agrícolas</span>
                <span className="text-[10px] px-2 py-0.2 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-bold">
                  Logística & Frotas
                </span>
              </h1>
              <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.2">
                Cálculo de tempos (Deslocamento + Prancha + Execução), escala de frotas e logística de campo.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleCreateNew()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2e65aa] hover:bg-[#25528c] active:bg-[#1d4273] text-white text-xs font-bold shadow-2xs transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Novo Agendamento</span>
            </button>
          </div>
        </div>

        {/* 2. CARDS DE MÉTRICAS KPI (COMPACTOS: ALTURA E FONTES OTIMIZADAS) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 pt-2 border-t border-stone-100 dark:border-stone-800">
          <div className="bg-stone-50 dark:bg-stone-800/40 px-2.5 py-1.5 rounded-lg border border-stone-200/80 dark:border-stone-800">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase text-stone-500 block">Total Agendado</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base sm:text-lg font-black text-stone-900 dark:text-stone-100">{metrics.total}</span>
              <span className="text-[10px] font-semibold text-stone-400">operações</span>
            </div>
          </div>

          <div className="bg-amber-50/60 dark:bg-amber-950/20 px-2.5 py-1.5 rounded-lg border border-amber-200/80 dark:border-amber-900/40">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400 block">Aguardando Saída</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base sm:text-lg font-black text-amber-900 dark:text-amber-300">{metrics.agendados}</span>
              <span className="text-[10px] font-semibold text-amber-600">na base</span>
            </div>
          </div>

          <div className="bg-emerald-50/60 dark:bg-emerald-950/20 px-2.5 py-1.5 rounded-lg border border-emerald-200/80 dark:border-emerald-900/40">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400 block">Em Campo / Execução</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base sm:text-lg font-black text-emerald-900 dark:text-emerald-300">{metrics.emExecucao}</span>
              <span className="text-[10px] font-semibold text-emerald-600">em operação</span>
            </div>
          </div>

          <div className="bg-blue-50/60 dark:bg-blue-950/20 px-2.5 py-1.5 rounded-lg border border-blue-200/80 dark:border-blue-900/40">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase text-blue-700 dark:text-blue-400 block">Área Programada</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base sm:text-lg font-black text-blue-900 dark:text-blue-300">{metrics.totalHectares.toFixed(1)}</span>
              <span className="text-[10px] font-semibold text-blue-600">ha estimados</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. BARRA DE FILTROS E SELEÇÃO DE VISÃO COMPACTA */}
      <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 p-2 sm:p-2.5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-2">
        {/* Seletor de Abas de Visão */}
        <div className="flex items-center gap-1 bg-stone-100 dark:bg-stone-800 p-0.5 rounded-lg">
          <button
            type="button"
            onClick={() => setViewMode('cronograma')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-extrabold transition-all cursor-pointer ${
              viewMode === 'cronograma'
                ? 'bg-white dark:bg-stone-900 text-[#2e65aa] shadow-2xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
          >
            Cronograma Operacional
          </button>
          <button
            type="button"
            onClick={() => setViewMode('frotas')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-extrabold transition-all cursor-pointer ${
              viewMode === 'frotas'
                ? 'bg-white dark:bg-stone-900 text-[#2e65aa] shadow-2xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
          >
            Escala por Placas/Frotas
          </button>
          <button
            type="button"
            onClick={() => setViewMode('tabela')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-extrabold transition-all cursor-pointer ${
              viewMode === 'tabela'
                ? 'bg-white dark:bg-stone-900 text-[#2e65aa] shadow-2xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
          >
            Lista Completa
          </button>
        </div>

        {/* Filtros: Busca e Status */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-stone-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar cliente, fazenda, placa..."
              className="w-full pl-7 pr-2.5 py-1 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs font-medium text-stone-900 dark:text-stone-100"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="py-1 px-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs font-bold text-stone-700 dark:text-stone-200"
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
              className="text-[11px] text-red-600 hover:underline font-bold"
            >
              Limpar Data
            </button>
          )}
        </div>
      </div>

      {/* 4. CONTEÚDO PRINCIPAL DE ACORDO COM A VISÃO SELECIONADA */}

      {/* VISÃO 1: CRONOGRAMA OPERACIONAL EM COLUNAS LADO A LADO (ESTILO KANBAN / MÁQUINAS PRINCIPAIS) */}
      {viewMode === 'cronograma' && (
        <div className="w-full overflow-x-auto pb-4">
          {/* Moldura Externa idêntica ao quadro de Equipes */}
          <div className="min-w-[840px] border-3 border-black dark:border-stone-700 rounded-lg overflow-hidden shadow-md bg-white dark:bg-stone-950">
            
            {/* 1. TOPO DA MOLDURA: Cabeçalho com título e contadores */}
            <div className="bg-[#ffedd5] dark:bg-amber-950 text-stone-950 dark:text-amber-100 py-2.5 px-4 border-b-3 border-black dark:border-stone-700 text-center relative flex items-center justify-center">
              <h3 className="text-base sm:text-lg font-black tracking-wide font-['Outfit']">
                Agenda Operacional por Máquinas & Frentes de Colheita
              </h3>
              <span className="absolute right-4 text-xs font-bold text-stone-600 dark:text-amber-300 hidden sm:inline">
                Total: {filteredAppointments.length} Agendamentos em {machineColumns.length} Frentes
              </span>
            </div>

            {/* 2. GRID DE COLUNAS LADO A LADO POR MÁQUINA PRINCIPAL */}
            <div 
              className="grid divide-x-3 divide-black dark:divide-stone-700 items-stretch"
              style={{
                gridTemplateColumns: `repeat(${machineColumns.length}, minmax(240px, 1fr))`
              }}
            >
              {machineColumns.map((col, idx) => {
                const colAppointments = appointmentsByColumn[col.id] || [];
                const isDragOver = dragOverColId === col.id;
                const totalHectaresCol = colAppointments
                  .filter(a => a.status !== 'cancelado')
                  .reduce((sum, a) => sum + (a.areaUnit === 'hectares' ? a.estimatedQuantity : 0), 0);

                return (
                  <div
                    key={col.id}
                    onDragOver={(e) => handleDragOver(e, col.id)}
                    onDragLeave={(e) => handleDragLeave(e, col.id)}
                    onDrop={(e) => handleDrop(e, col)}
                    className={`flex flex-col transition-colors duration-150 ${
                      isDragOver ? 'ring-4 ring-inset ring-amber-500 bg-amber-100 dark:bg-amber-950' : ''
                    }`}
                    style={{
                      backgroundColor: isDragOver ? undefined : col.columnBgColor || '#fefce8'
                    }}
                  >
                    {/* Cabeçalho da Coluna: Frente #X, Nome da Máquina (Maq 02, Maq 03, etc.) */}
                    <div
                      className="p-2.5 border-b-3 border-black dark:border-stone-700 flex flex-col justify-between items-center text-center select-none"
                      style={{
                        backgroundColor: col.headerBgColor || '#fef08a',
                        color: '#000000'
                      }}
                    >
                      <div className="w-full flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-black/60">
                          Frente #{col.frontNumber || idx + 1}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleCreateNew(col.machineryId, col.name)}
                          title={`Novo agendamento para ${col.name}`}
                          className="flex items-center space-x-0.5 hover:text-black transition cursor-pointer text-[10px] font-black underline"
                        >
                          <Plus className="w-3 h-3 inline" />
                          <span>+ Add</span>
                        </button>
                      </div>

                      <div className="flex items-center justify-center gap-1.5 my-0.5">
                        <h4 className="text-base sm:text-lg font-black text-black tracking-tight font-['Outfit']">
                          {col.name}
                        </h4>
                        <button
                          type="button"
                          onClick={() => handleOpenVehicleSearch(col)}
                          title={`Vincular/Trocar máquina para ${col.name} (Buscar em Frotas)`}
                          className="p-1 rounded-md bg-black/5 hover:bg-black/15 active:scale-95 transition-all cursor-pointer flex items-center justify-center border border-black/15 shadow-2xs group"
                        >
                          <ForageHarvesterIcon className="w-5 h-4.5 group-hover:scale-110 transition-transform" />
                        </button>
                      </div>

                      {col.machineryName && (
                        <button
                          type="button"
                          onClick={() => handleOpenVehicleSearch(col)}
                          title="Clique para trocar máquina em Frotas"
                          className="text-[11px] font-semibold text-black/75 hover:text-black hover:underline truncate max-w-full px-1 transition-colors cursor-pointer"
                        >
                          🚜 {col.machineryName}
                        </button>
                      )}

                      <div className="mt-1 flex items-center justify-between w-full text-[10px] font-bold text-black/70 border-t border-black/15 pt-1">
                        <span>{colAppointments.length} {colAppointments.length === 1 ? 'serviço' : 'serviços'}</span>
                        {totalHectaresCol > 0 ? (
                          <span>{totalHectaresCol.toFixed(1)} ha</span>
                        ) : (
                          <span>Disponível</span>
                        )}
                      </div>
                    </div>

                    {/* Indicador visual de Drag Over */}
                    {isDragOver && (
                      <div className="p-3 m-2 border-2 border-dashed border-black rounded-lg text-center text-xs font-black text-black bg-amber-200/60 animate-pulse">
                        Mover agendamento para {col.name}
                      </div>
                    )}

                    {/* LISTAGEM DOS CARDS EMPILHADOS VERTICALMENTE (ORDEM CRONOLÓGICA) */}
                    <div className="p-2 space-y-2.5 flex-1 min-h-[420px]">
                      {colAppointments.length === 0 ? (
                        <div className="p-6 text-center text-xs font-semibold text-stone-500 italic flex flex-col items-center justify-center h-full min-h-[200px]">
                          <Calendar className="w-8 h-8 text-black/20 mb-2" />
                          <span>Nenhum serviço agendado</span>
                          <span className="text-[11px] font-normal text-stone-400 mt-0.5">
                            Máquina livre para alocação
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCreateNew(col.machineryId, col.name)}
                            className="mt-3 px-3 py-1 bg-black/10 hover:bg-black/20 rounded text-[11px] font-bold text-black transition cursor-pointer"
                          >
                            + Agendar
                          </button>
                        </div>
                      ) : (
                        colAppointments.map((app) => {
                          const isBeingDragged = draggedApptId === app.id;

                          return (
                            <div
                              key={app.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, app.id)}
                              className={`bg-white dark:bg-stone-900 border-2 border-black/80 dark:border-stone-700 rounded-lg p-3 shadow-xs hover:shadow-md transition-all space-y-2 cursor-grab active:cursor-grabbing ${
                                isBeingDragged ? 'opacity-40 ring-2 ring-black' : ''
                              }`}
                            >
                              {/* Topo do Card: Número do Agendamento + Badge de Status */}
                              <div className="flex items-center justify-between gap-1.5 border-b border-stone-100 dark:border-stone-800 pb-1.5">
                                <span className="font-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700">
                                  {app.appointmentNumber}
                                </span>

                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${
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
                                  {app.status === 'em_execucao' ? '● Em Execução' : app.status.replace('_', ' ')}
                                </span>
                              </div>

                              {/* 1. NOME DO CLIENTE & FAZENDA */}
                              <div>
                                <h5 className="font-black text-xs sm:text-sm text-stone-950 dark:text-stone-100 leading-snug">
                                  {app.clientName}
                                </h5>
                                {app.farmName && (
                                  <span className="text-[11px] font-semibold text-stone-600 dark:text-stone-400 block truncate">
                                    🏡 {app.farmName}
                                  </span>
                                )}
                              </div>

                              {/* 2. DATA E HORA DO AGENDAMENTO (EM DESTAQUE CRONOLÓGICO) */}
                              <div className="flex items-center gap-1.5 text-xs font-bold text-stone-900 dark:text-stone-100 bg-stone-50 dark:bg-stone-800/60 p-1.5 rounded-md border border-stone-200 dark:border-stone-700">
                                <Clock className="w-3.5 h-3.5 text-[#2e65aa] shrink-0" />
                                <span className="truncate">
                                  {formatDateBR(app.startDate)} às <span className="font-black text-[#2e65aa] dark:text-blue-400">{app.startTime}h</span>
                                </span>
                                {app.endTime && (
                                  <span className="text-[10px] text-stone-500 font-normal shrink-0 ml-auto">
                                    até {app.endTime}h
                                  </span>
                                )}
                              </div>

                              {/* 3. CIDADE E ENDEREÇO / LOCALIZAÇÃO */}
                              <div className="flex items-start gap-1 text-[11px] text-stone-600 dark:text-stone-300 leading-tight">
                                <MapPin className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                                <span className="font-medium line-clamp-2">
                                  {app.locationCityState || 'Localização de campo'}
                                  {app.farmName && !app.locationCityState ? ` - ${app.farmName}` : ''}
                                </span>
                              </div>

                              {/* Área, Rendimento & Tempo Estimado */}
                              <div className="flex items-center justify-between text-[10px] font-bold text-stone-600 dark:text-stone-400 bg-emerald-50/60 dark:bg-emerald-950/20 px-2 py-1 rounded border border-emerald-200/60 dark:border-emerald-900/30">
                                <span>🌾 {app.estimatedQuantity} {app.areaUnit === 'hectares' ? 'ha' : app.areaUnit}</span>
                                <span>⏱️ {formatMinToHoursText(app.totalTimeMinutes)}</span>
                              </div>

                              {/* Veículos de Apoio Escalados (Caminhões e Tratores) */}
                              {app.assignedVehicles && app.assignedVehicles.length > 0 && (
                                <div className="flex flex-wrap gap-1 pt-0.5">
                                  {app.assignedVehicles.map((v, vIdx) => (
                                    <span
                                      key={vIdx}
                                      className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 border border-blue-200 dark:border-blue-800 truncate max-w-full"
                                      title={`${v.prefix} (${v.plateOrSerial}) - ${v.driverOrOperatorName || 'Sem motorista'}`}
                                    >
                                      🚛 {v.prefix.replace(/Caminhão \d+ - /i, '')} ({v.plateOrSerial})
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* AÇÕES DO CARD */}
                              <div className="pt-2 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleExecuteService(app)}
                                  className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-md text-[10px] font-black shadow-xs transition-colors cursor-pointer"
                                  title="Puxar cliente e dados agendados para preencher novo corte automaticamente"
                                >
                                  <Scissors className="w-3 h-3" />
                                  <span>Puxar Corte</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleOpenPrint(app)}
                                  className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-md transition-colors border border-stone-200 dark:border-stone-700 cursor-pointer"
                                  title="Ordem de Campo (A4)"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleEdit(app)}
                                  className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-md transition-colors border border-stone-200 dark:border-stone-700 cursor-pointer"
                                  title="Editar Agendamento"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteClick(app)}
                                  className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-md transition-colors border border-stone-200 dark:border-stone-700 cursor-pointer"
                                  title="Excluir Agendamento"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
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
                        onClick={() => handleDeleteClick(a)}
                        className="p-1 text-red-500 hover:text-red-700 cursor-pointer"
                        title="Excluir Agendamento"
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

      {/* MODAL DE BUSCA E VINCULAÇÃO DE VEÍCULO DA FROTA */}
      <VehicleSearchModal
        isOpen={isVehicleSearchModalOpen}
        onClose={() => {
          setIsVehicleSearchModalOpen(false);
          setSelectedColumnForVehicle(null);
        }}
        columnName={selectedColumnForVehicle?.name || ''}
        currentMachineryId={selectedColumnForVehicle?.machineryId}
        machineries={machineries}
        onSelectVehicle={handleSelectVehicleForColumn}
      />

      {/* 1. MODAL DE CONFIRMAÇÃO DE EXCLUSÃO NA TELA */}
      {appointmentToDelete && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => !isDeleting && setAppointmentToDelete(null)}
        >
          <div 
            className="bg-white dark:bg-stone-900 rounded-2xl max-w-md w-full p-5 border border-stone-200 dark:border-stone-800 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1 flex-1 min-w-0">
                <h3 className="text-base font-extrabold text-stone-900 dark:text-stone-100">
                  Confirmar Exclusão
                </h3>
                <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                  Tem certeza que deseja excluir o agendamento do cliente{' '}
                  <strong className="text-stone-900 dark:text-stone-100 font-extrabold">
                    {appointmentToDelete.clientName}
                  </strong>?
                </p>
              </div>
            </div>

            <div className="p-3 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700/60 space-y-1 text-xs">
              <div className="flex items-center justify-between text-stone-500 dark:text-stone-400">
                <span>Agendamento:</span>
                <span className="font-mono font-bold text-stone-800 dark:text-stone-200">
                  {appointmentToDelete.appointmentNumber}
                </span>
              </div>
              {appointmentToDelete.farmName && (
                <div className="flex items-center justify-between text-stone-500 dark:text-stone-400">
                  <span>Fazenda:</span>
                  <span className="font-medium text-stone-800 dark:text-stone-200 truncate max-w-[200px]">
                    {appointmentToDelete.farmName}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-stone-500 dark:text-stone-400">
                <span>Data:</span>
                <span className="font-medium text-stone-800 dark:text-stone-200">
                  {formatDateBR ? formatDateBR(appointmentToDelete.startDate) : appointmentToDelete.startDate}
                </span>
              </div>
              {appointmentToDelete.primaryMachineryPrefix && (
                <div className="flex items-center justify-between text-stone-500 dark:text-stone-400">
                  <span>Máquina Alocada:</span>
                  <span className="font-medium text-stone-800 dark:text-stone-200 truncate max-w-[200px]">
                    {appointmentToDelete.primaryMachineryPrefix}
                  </span>
                </div>
              )}
            </div>

            <p className="text-[11px] text-stone-400 dark:text-stone-500">
              Esta ação removerá o agendamento da agenda operacional e do banco de dados.
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setAppointmentToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-stone-700 dark:text-stone-300 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-black text-white bg-red-600 hover:bg-red-700 active:scale-95 rounded-lg transition-all shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Excluindo...' : 'Excluir Agendamento'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
