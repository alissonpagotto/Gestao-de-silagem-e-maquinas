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
  FileSpreadsheet,
  AlertCircle
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
  getStoredMachineries,
  formatDateBR 
} from '../../lib/storage';
import { deleteAgendamento, deleteFrente, upsertFrente, updateAgendamentoFrente, upsertAgendamento } from '../../lib/supabaseService';
import { AppointmentFormModal } from './AppointmentFormModal';
import { PrintFieldOrderModal } from './PrintFieldOrderModal';
import { DispatchFieldModal } from './DispatchFieldModal';
import { ForageHarvesterIcon } from '../fleet/ForageHarvesterIcon';
import { VehicleSearchModal } from './VehicleSearchModal';
import { ServiceCalendarView } from './ServiceCalendarView';

interface ServiceAgendaModuleProps {
  machineries?: Machinery[];
  employees?: Employee[];
  clients?: Client[];
  companyProfile?: CompanyProfile;
  onExecuteAppointment: (appointment: ServiceAppointment) => void;
}

// Cores das Frentes de Colheita (mantendo estritamente verde, amarelo e bege/laranja)
const FRONT_COLOR_PALETTES = [
  { headerBgColor: '#fef08a', columnBgColor: '#fefce8', borderColor: '#ca8a04' }, // Amarelo Claro
  { headerBgColor: '#fed7aa', columnBgColor: '#fff7ed', borderColor: '#ea580c' }, // Laranja / Bege
  { headerBgColor: '#bbf7d0', columnBgColor: '#f0fdf4', borderColor: '#16a34a' }, // Verde Pastel
  { headerBgColor: '#fde047', columnBgColor: '#fef9c3', borderColor: '#eab308' }, // Amarelo Ouro
  { headerBgColor: '#fef3c7', columnBgColor: '#fffbeb', borderColor: '#d97706' }, // Bege Âmbar
  { headerBgColor: '#dcfce7', columnBgColor: '#f0fdf4', borderColor: '#22c55e' }, // Verde Claro
];

// Colunas padrão de Máquinas Principais correspondentes às frentes ativas (inicialmente limpas)
const DEFAULT_MACHINE_COLUMNS: any[] = [];

// Lista inicial limpa de agendamentos
const DEFAULT_INITIAL_APPOINTMENTS: ServiceAppointment[] = [];

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
  const [viewMode, setViewMode] = useState<'cronograma' | 'frotas' | 'calendario'>('cronograma');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [dateFilter, setDateFilter] = useState<string>('');

  // Modais
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editAppointment, setEditAppointment] = useState<ServiceAppointment | null>(null);
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [selectedForPrint, setSelectedForPrint] = useState<ServiceAppointment | null>(null);
  const [isDispatchOpen, setIsDispatchOpen] = useState(false);
  const [selectedForDispatch, setSelectedForDispatch] = useState<ServiceAppointment | null>(null);
  const [isVehicleSearchModalOpen, setIsVehicleSearchModalOpen] = useState(false);
  const [selectedColumnForVehicle, setSelectedColumnForVehicle] = useState<{
    id: string;
    name: string;
    machineryId?: string;
  } | null>(null);

  // Confirmação de Exclusão de Agendamentos (Regras 1, 2 e 3)
  const [appointmentToDelete, setAppointmentToDelete] = useState<ServiceAppointment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Exclusão e Gerenciamento de Frentes (Colunas)
  const [frontToDelete, setFrontToDelete] = useState<{
    id: string;
    name: string;
    machineryId?: string;
    machineryName?: string;
    headerBgColor?: string;
    columnBgColor?: string;
    borderColor?: string;
    frontNumber?: number;
  } | null>(null);
  const [isDeletingFront, setIsDeletingFront] = useState(false);
  const [frontDeleteBlocked, setFrontDeleteBlocked] = useState<string | null>(null);

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
        (app.primaryMachineryModel && app.primaryMachineryModel.toLowerCase().includes(term)) ||
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
    
    const nonCancelled = appointments.filter(a => a.status !== 'cancelado');

    // Bloco 1: Total unificado em Hectares (convertendo alqueires por 2.42)
    const totalHectares = nonCancelled.reduce((acc, a) => {
      const qty = Number(a.estimatedQuantity) || 0;
      const unit = String(a.areaUnit || '').toLowerCase().trim();
      if (unit === 'alqueires' || unit === 'alq' || unit === 'alqueire') {
        return acc + (qty * 2.42);
      }
      if (unit === 'hectares' || unit === 'ha' || unit === 'hectare') {
        return acc + qty;
      }
      return acc;
    }, 0);

    // Bloco 2: Total estritamente de agendamentos lançados em Alqueires (alq)
    const totalAlqueires = nonCancelled.reduce((acc, a) => {
      const qty = Number(a.estimatedQuantity) || 0;
      const unit = String(a.areaUnit || '').toLowerCase().trim();
      if (unit === 'alqueires' || unit === 'alq' || unit === 'alqueire') {
        return acc + qty;
      }
      return acc;
    }, 0);

    // Bloco 3: Total acumulado de horas previstas de execução/serviço
    const totalMinutes = nonCancelled.reduce((acc, a) => {
      const mins = Number(a.totalTimeMinutes) || Number(a.executionTimeMinutes) || 0;
      return acc + mins;
    }, 0);
    const totalHours = totalMinutes / 60;

    return { total, agendados, emExecucao, concluidos, totalHectares, totalAlqueires, totalHours };
  }, [appointments]);

  // Agendamentos ativos para a visualização da Escala de Frotas
  const activeAppointmentsForFleet = useMemo(() => {
    return filteredAppointments.filter(a => {
      if (statusFilter === 'todos') {
        return a.status !== 'cancelado';
      }
      return true;
    });
  }, [filteredAppointments, statusFilter]);

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

  // Lista consolidada de veículos/máquinas para lookup preciso de placas e modelos
  const allMachineries = useMemo(() => {
    const list = [...(machineries || [])];
    try {
      const stored = getStoredMachineries();
      (stored || []).forEach(sm => {
        if (!list.some(m => m.id === sm.id)) {
          list.push(sm);
        }
      });
    } catch (e) {
      // ignore
    }

    return list;
  }, [machineries]);

  // Função para resolver com precisão a Placa e Modelo do Veículo Principal
  // Exemplo de exibição esperado: [Placa] - [Modelo do Veículo] (Ex: "MAQ-02 - CLAAS JAGUAR 860")
  const resolvePrimaryVehicleDisplay = (a: ServiceAppointment): string => {
    // 1. Busca direta da máquina pelo primaryMachineryId
    let matchedMach: Machinery | undefined;
    if (a.primaryMachineryId) {
      matchedMach = allMachineries.find(m => m.id === a.primaryMachineryId);
    }

    // 2. Busca através da frente vinculada (frontId ou correspondência de coluna)
    if (!matchedMach && (a.frontId || a.primaryMachineryId)) {
      const col = columnsList.find(c => c.id === a.frontId || c.id === a.primaryMachineryId);
      if (col?.machineryId) {
        matchedMach = allMachineries.find(m => m.id === col.machineryId);
      }
    }

    // 3. Busca por frontNumber ou pelo dígito contido no prefixo (ex: "01" -> frente 1, "02" -> frente 2)
    const cleanPrefix = (a.primaryMachineryPrefix || '').trim();
    const digitsOnly = cleanPrefix.replace(/\D/g, '');
    const parsedFrontNum = a.frontNumber || (digitsOnly ? parseInt(digitsOnly, 10) : undefined);

    if (!matchedMach && parsedFrontNum) {
      const colByNum = columnsList.find(c => c.frontNumber === parsedFrontNum);
      if (colByNum?.machineryId) {
        matchedMach = allMachineries.find(m => m.id === colByNum.machineryId);
      }
    }

    // 4. Busca por prefixo / número de frota / placa na lista de máquinas
    if (!matchedMach && cleanPrefix) {
      matchedMach = allMachineries.find(m => {
        const fn = (m.fleetNumber || '').trim().toLowerCase();
        const pref = cleanPrefix.toLowerCase();
        if (!fn && !pref) return false;
        if (fn === pref || fn === `maq ${pref}` || fn === `maq-${pref}`) return true;
        if (digitsOnly && fn.replace(/\D/g, '') === digitsOnly && digitsOnly.length > 0) return true;
        if (m.licensePlateOrSerial && m.licensePlateOrSerial.trim().toLowerCase() === pref) return true;
        return false;
      });
    }

    // 5. Fallback por índice da coluna caso frontNumber seja 1, 2, ...
    if (!matchedMach && parsedFrontNum && columnsList[parsedFrontNum - 1]?.machineryId) {
      matchedMach = allMachineries.find(m => m.id === columnsList[parsedFrontNum - 1].machineryId);
    }

    // --- Extração da Placa / Identificação ---
    let plate = '';
    if (a.primaryMachineryPlate && a.primaryMachineryPlate !== 'OFICIAL' && a.primaryMachineryPlate !== cleanPrefix) {
      plate = a.primaryMachineryPlate.trim();
    } else if (matchedMach?.licensePlateOrSerial && matchedMach.licensePlateOrSerial !== 'OFICIAL') {
      plate = matchedMach.licensePlateOrSerial.trim();
    } else if ((matchedMach as any)?.plate_or_serial) {
      plate = String((matchedMach as any).plate_or_serial).trim();
    } else if (matchedMach?.fleetNumber) {
      plate = matchedMach.fleetNumber.trim();
    } else if (cleanPrefix && !/^\d+$/.test(cleanPrefix) && cleanPrefix.length > 2) {
      // Se o prefixo for um texto descritivo (ex: "MAQ-02")
      plate = cleanPrefix;
    } else if (digitsOnly) {
      // Se for apenas número como "01" ou "02", formata como placa padrão "MAQ-01" ou "MAQ-02"
      plate = `MAQ-${digitsOnly.padStart(2, '0')}`;
    } else if (cleanPrefix) {
      plate = cleanPrefix;
    }

    // --- Extração do Modelo da Máquina ---
    let model = '';
    if (a.primaryMachineryModel && a.primaryMachineryModel !== a.primaryMachineryPrefix) {
      model = a.primaryMachineryModel.trim();
    } else if (matchedMach?.model) {
      model = matchedMach.model.trim();
    } else if (matchedMach?.name) {
      model = matchedMach.name.trim();
    } else if (parsedFrontNum) {
      const col = columnsList.find(c => c.frontNumber === parsedFrontNum) || columnsList[parsedFrontNum - 1];
      if (col?.machineryName) {
        model = col.machineryName.trim();
      }
    }

    // Limpeza de prefixos entre colchetes no modelo (ex: "[ION JER MAQ 10]" ou "[JF MAQ1]")
    if (model.startsWith('[') && model.includes(']')) {
      const cleaned = model.replace(/^\[.*?\]\s*/, '').trim();
      if (cleaned) model = cleaned;
    }

    // Formatação em caixa alta para visual padrão
    plate = plate.toUpperCase();
    model = model.toUpperCase();

    // Montagem final do texto: [Placa] - [Modelo do Veículo]
    if (plate && model) {
      if (model === plate) {
        return plate;
      }
      if (model.startsWith(`${plate} - `) || model.startsWith(`${plate} — `)) {
        return model;
      }
      return `${plate} - ${model}`;
    }

    if (plate) return plate;
    if (model) return model;
    return 'NÃO DEFINIDO';
  };

  // Agrupamento dos agendamentos filtrados por cada Máquina Principal com ordenação cronológica
  const appointmentsByColumn = useMemo(() => {
    const map: Record<string, ServiceAppointment[]> = {};
    machineColumns.forEach(col => {
      map[col.id] = [];
    });

    filteredAppointments.forEach(app => {
      let matchedColId: string | null = null;

      for (const col of machineColumns) {
        // 1. Vínculo direto por ID da frente salva
        if (app.frontId && app.frontId === col.id) {
          matchedColId = col.id;
          break;
        }

        // 2. Vínculo direto por ID da coluna ou ID da máquina vinculada
        if (
          (app.primaryMachineryId && col.id && app.primaryMachineryId === col.id) ||
          (app.primaryMachineryId && col.machineryId && app.primaryMachineryId === col.machineryId)
        ) {
          matchedColId = col.id;
          break;
        }

        // 3. Vínculo por número de frente explícito
        if (app.frontNumber && col.frontNumber && app.frontNumber === col.frontNumber) {
          matchedColId = col.id;
          break;
        }

        // 4. Vínculo exato por nome/prefixo da máquina ou nome da coluna
        const appPrefix = (app.primaryMachineryPrefix || '').trim().toLowerCase();
        const colMach = (col.machineryName || '').trim().toLowerCase();
        const colName = (col.name || '').trim().toLowerCase();

        if (appPrefix && colMach && appPrefix === colMach) {
          matchedColId = col.id;
          break;
        }
        if (appPrefix && colName && appPrefix === colName) {
          matchedColId = col.id;
          break;
        }
        if (appPrefix && appPrefix === `frente #${col.frontNumber || ''}`.toLowerCase()) {
          matchedColId = col.id;
          break;
        }

        // 5. Checagem textual aproximada
        if (colMach && (appPrefix.includes(colMach) || colMach.includes(appPrefix))) {
          matchedColId = col.id;
          break;
        }
        if (colName && (appPrefix.includes(colName) || colName.includes(appPrefix))) {
          matchedColId = col.id;
          break;
        }

        // 6. Checa modelo das máquinas (ex: 870, 860, 6110, 2726, 8500)
        const appModel = (app.primaryMachineryModel || '').toLowerCase();
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

  // Drag and Drop nativo entre colunas de frentes / máquinas
  const [draggedApptId, setDraggedApptId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);

  // 1. Ativação do Evento de Arraste (Drag): Captura o ID do agendamento
  const handleDragStart = (e: React.DragEvent, apptId: string) => {
    e.dataTransfer.setData('text/plain', apptId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedApptId(apptId);
  };

  const handleDragEnd = () => {
    setDraggedApptId(null);
    setDragOverColId(null);
  };

  // 2. Área de Soltura (Drop): Configuração dos eventos de dragover / enter / leave
  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColId !== colId) {
      setDragOverColId(colId);
    }
  };

  const handleDragEnter = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragOverColId !== colId) {
      setDragOverColId(colId);
    }
  };

  const handleDragLeave = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    const related = e.relatedTarget as Node | null;
    if (related && e.currentTarget.contains(related)) {
      return;
    }
    if (dragOverColId === colId) {
      setDragOverColId(null);
    }
  };

  const saveColumns = (newCols: typeof columnsList) => {
    setColumnsList(newCols);
    const newTeams: FleetTeam[] = newCols.map((c, idx) => ({
      id: c.id,
      name: c.machineryName || c.name,
      machineryId: c.machineryId,
      machineryName: c.machineryName,
      headerBgColor: c.headerBgColor,
      columnBgColor: c.columnBgColor,
      borderColor: c.borderColor,
      order: idx + 1,
      createdAt: new Date().toISOString(),
    }));
    saveStoredFleetTeams(newTeams);
  };

  // 3. Atualização no Supabase e na Tela ao soltar o cartão sobre a nova coluna
  const handleDrop = async (e: React.DragEvent, targetCol: typeof machineColumns[0]) => {
    e.preventDefault();
    e.stopPropagation();
    const apptId = e.dataTransfer.getData('text/plain') || draggedApptId;
    setDragOverColId(null);
    setDraggedApptId(null);
    if (!apptId) return;

    const targetApp = appointments.find(a => a.id === apptId);
    if (!targetApp) return;

    // Se o agendamento já pertence a esta coluna, encerra
    const currentColumnAppointments = appointmentsByColumn[targetCol.id] || [];
    if (currentColumnAppointments.some(a => a.id === apptId)) {
      return;
    }

    const targetMachinery = allMachineries.find(m => m.id === targetCol.machineryId);
    const newMachId = targetCol.machineryId || targetCol.id;
    const newMachPrefix = targetCol.machineryName || targetCol.name;

    const updatedApp: ServiceAppointment = {
      ...targetApp,
      frontId: targetCol.id,
      frontNumber: targetCol.frontNumber,
      primaryMachineryId: newMachId,
      primaryMachineryPrefix: newMachPrefix,
      primaryMachineryPlate: targetMachinery?.licensePlateOrSerial || (targetMachinery as any)?.plate_or_serial || targetMachinery?.plateOrSerial || targetApp.primaryMachineryPlate || '',
      primaryMachineryModel: targetMachinery?.model || targetMachinery?.name || targetApp.primaryMachineryModel || '',
      updatedAt: new Date().toISOString(),
    };

    // Atualização imediata dos States locais (muda o card visualmente e recalcula o contador de serviços das frentes envolvidas)
    const updatedAppointments = appointments.map(a => (a.id === apptId ? updatedApp : a));
    setAppointments(updatedAppointments);
    saveStoredAppointments(updatedAppointments);

    // Executa chamada de atualização (UPDATE) no Supabase
    try {
      await updateAgendamentoFrente(targetApp.id, newMachId, newMachPrefix);
      await upsertAgendamento(updatedApp);
    } catch (err) {
      console.warn('Erro ao atualizar agendamento no Supabase via Drag and Drop:', err);
    }
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
          name: formattedMachName,
          machineryId: vehicle.id,
          machineryName: formattedMachName,
        };
      }
      return c;
    });

    saveColumns(updatedCols);

    // Sincroniza com o Supabase se configurado
    const selectedUpdatedCol = updatedCols.find(c => c.id === selectedColumnForVehicle.id);
    if (selectedUpdatedCol) {
      upsertFrente({
        id: selectedUpdatedCol.id,
        name: formattedMachName,
        machineryId: vehicle.id,
        machineryName: formattedMachName,
        headerBgColor: selectedUpdatedCol.headerBgColor,
        columnBgColor: selectedUpdatedCol.columnBgColor,
        borderColor: selectedUpdatedCol.borderColor,
        frontNumber: selectedUpdatedCol.frontNumber,
      }).catch(err => console.warn('Supabase upsertFrente notice:', err));
    }

    setIsVehicleSearchModalOpen(false);
    setSelectedColumnForVehicle(null);
  };

  // 1. Botão de Incluir Frente (Cria nova coluna vazia no final do quadro, Ex: Frente #5)
  const handleAddFront = () => {
    const nextFrontNumber = columnsList.length + 1;
    const paletteIndex = (nextFrontNumber - 1) % FRONT_COLOR_PALETTES.length;
    const palette = FRONT_COLOR_PALETTES[paletteIndex];
    const newId = `frente_${Date.now()}`;

    const newColumn = {
      id: newId,
      name: `Frente #${nextFrontNumber}`,
      machineryId: '',
      machineryName: '',
      headerBgColor: palette.headerBgColor,
      columnBgColor: palette.columnBgColor,
      borderColor: palette.borderColor,
      frontNumber: nextFrontNumber,
    };

    const updated = [...columnsList, newColumn];
    saveColumns(updated);

    upsertFrente({
      id: newId,
      name: newColumn.name,
      machineryId: '',
      machineryName: '',
      headerBgColor: newColumn.headerBgColor,
      columnBgColor: newColumn.columnBgColor,
      borderColor: newColumn.borderColor,
      frontNumber: newColumn.frontNumber,
    }).catch(err => console.warn('Supabase upsertFrente notice:', err));
  };

  // 2. Botão de Excluir Frente (Ícone discreto de lixeira, só permite se não houver agendamentos vinculados)
  const handleDeleteFrontClick = (col: (typeof columnsList)[0]) => {
    const linked = appointmentsByColumn[col.id] || [];
    if (linked.length > 0) {
      setFrontDeleteBlocked(
        `A Frente #${col.frontNumber || 1} (${col.machineryName || col.name}) possui ${linked.length} agendamento(s) vinculado(s). Para garantir a integridade dos dados, realoque ou exclua os agendamentos antes de remover esta frente.`
      );
      return;
    }
    setFrontToDelete(col);
  };

  const handleConfirmDeleteFront = async () => {
    if (!frontToDelete) return;
    const targetId = frontToDelete.id;
    setIsDeletingFront(true);

    try {
      await deleteFrente(targetId);
    } catch (err) {
      console.warn('Supabase deleteFrente notice:', err);
    }

    const updated = columnsList
      .filter(c => c.id !== targetId)
      .map((c, idx) => ({
        ...c,
        frontNumber: idx + 1,
      }));

    saveColumns(updated);
    setIsDeletingFront(false);
    setFrontToDelete(null);
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

  const handleCreateAppointmentForDate = (dateStr: string) => {
    setEditAppointment({
      id: '',
      appointmentNumber: nextAppointmentNumber,
      clientId: '',
      clientName: '',
      startDate: dateStr,
      startTime: '08:00',
      travelTimeMinutes: 45,
      trailerLoadingTimeMinutes: 30,
      areaUnit: 'hectares',
      estimatedQuantity: 15,
      productivityRatePerHour: 1.5,
      executionTimeMinutes: 600,
      totalTimeMinutes: 675,
      endDate: dateStr,
      endTime: '19:15',
      primaryMachineryId: '',
      primaryMachineryPrefix: '',
      assignedVehicles: [],
      assignedTeam: [],
      status: 'agendado',
      createdAt: new Date().toISOString()
    } as ServiceAppointment);
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

  const handleSaveAppointment = async (saved: ServiceAppointment, cascadedUpdates?: ServiceAppointment[]) => {
    let updated = [...appointments];
    const exists = updated.some(a => a.id === saved.id);
    if (exists) {
      updated = updated.map(a => a.id === saved.id ? saved : a);
    } else {
      updated = [saved, ...updated];
    }

    if (cascadedUpdates && cascadedUpdates.length > 0) {
      const cascadeMap = new Map(cascadedUpdates.map(u => [u.id, u]));
      updated = updated.map(a => cascadeMap.has(a.id) ? cascadeMap.get(a.id)! : a);
    }

    setAppointments(updated);
    saveStoredAppointments(updated);
    try {
      await upsertAgendamento(saved);
      if (cascadedUpdates && cascadedUpdates.length > 0) {
        await Promise.all(cascadedUpdates.map(cu => upsertAgendamento(cu)));
      }
    } catch (err) {
      console.warn('Erro ao sincronizar agendamento no Supabase:', err);
    }
  };

  const handleOpenPrint = (appointment: ServiceAppointment) => {
    setSelectedForPrint(appointment);
    setIsPrintOpen(true);
  };

  // Disparo de Escala para a Equipe de Campo (WhatsApp & Retorno de Dados Reais)
  const handleOpenDispatch = (appointment: ServiceAppointment) => {
    setSelectedForDispatch(appointment);
    setIsDispatchOpen(true);
  };

  // Salvar Retorno Real de Campo
  const handleSaveRealData = async (appointmentId: string, realData: {
    realStartDate?: string;
    realStartTime?: string;
    realEndDate?: string;
    realEndTime?: string;
    realLoadsCount?: number;
    realHourMeterStart?: number;
    realHourMeterEnd?: number;
    realNotes?: string;
  }) => {
    const updated = appointments.map(a => {
      if (a.id === appointmentId) {
        return {
          ...a,
          ...realData,
          updatedAt: new Date().toISOString()
        };
      }
      return a;
    });

    setAppointments(updated);

    // Se o agendamento atualizado estiver selecionado para disparo, sincroniza estado
    if (selectedForDispatch && selectedForDispatch.id === appointmentId) {
      setSelectedForDispatch(prev => prev ? { ...prev, ...realData } : null);
    }

    // Persistência no Supabase
    try {
      const target = updated.find(a => a.id === appointmentId);
      if (target) {
        await upsertAgendamento(target);
      }
    } catch (err) {
      console.warn('Erro ao atualizar dados reais de campo no banco:', err);
    }
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
      <div className="bg-white rounded-xl border border-zinc-300 p-2.5 sm:p-3 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-zinc-100 text-zinc-800 border border-zinc-300 shrink-0">
              <CalendarDays className="w-5 h-5 text-zinc-800" />
            </span>
            <div>
              <h1 className="text-sm sm:text-base font-extrabold text-zinc-900 flex items-center gap-2">
                <span>Agenda de Serviços Agrícolas</span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-100 border border-zinc-300 text-zinc-700 font-bold">
                  Logística & Frotas
                </span>
              </h1>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Cálculo de tempos (Deslocamento + Prancha + Execução), escala de frotas e logística de campo.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleCreateNew()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white text-xs font-bold shadow-2xs transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Novo Agendamento</span>
            </button>
          </div>
        </div>

        {/* 2. CARDS DE MÉTRICAS KPI (COMPACTOS: ALTURA E FONTES OTIMIZADAS) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 pt-2 border-t border-zinc-200">
          <div className="bg-zinc-50 px-2.5 py-1.5 rounded-lg border border-zinc-300">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase text-zinc-500 block">Total Agendado</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base sm:text-lg font-black text-zinc-900">{metrics.total}</span>
              <span className="text-[10px] font-semibold text-zinc-500">operações</span>
            </div>
          </div>

          <div className="bg-amber-50/70 px-2.5 py-1.5 rounded-lg border border-amber-200">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase text-amber-800 block">Aguardando Saída</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base sm:text-lg font-black text-amber-900">{metrics.agendados}</span>
              <span className="text-[10px] font-semibold text-amber-700">na base</span>
            </div>
          </div>

          <div className="bg-emerald-50/70 px-2.5 py-1.5 rounded-lg border border-emerald-200">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase text-emerald-800 block">Em Campo / Execução</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base sm:text-lg font-black text-emerald-900">{metrics.emExecucao}</span>
              <span className="text-[10px] font-semibold text-emerald-700">em operação</span>
            </div>
          </div>

          <div className="bg-zinc-100 px-2.5 py-1.5 rounded-lg border border-zinc-300">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase text-zinc-700 block">Área Programada</span>
            <div className="flex items-baseline flex-wrap gap-x-2.5 sm:gap-x-3 gap-y-1 mt-0.5">
              {/* Bloco 1: Hectares */}
              <div className="flex items-baseline gap-1">
                <span className="text-base sm:text-lg font-black text-zinc-900">{metrics.totalHectares.toFixed(1)}</span>
                <span className="text-[10px] font-semibold text-zinc-600">ha estimados</span>
              </div>

              {/* Divisor */}
              <span className="text-zinc-400 font-bold select-none text-xs">/</span>

              {/* Bloco 2: Alqueires */}
              <div className="flex items-baseline gap-1">
                <span className="text-base sm:text-lg font-black text-zinc-900">{metrics.totalAlqueires.toFixed(1)}</span>
                <span className="text-[10px] font-semibold text-zinc-600">alq estimados</span>
              </div>

              {/* Divisor */}
              <span className="text-zinc-400 font-bold select-none text-xs">/</span>

              {/* Bloco 3: Horas */}
              <div className="flex items-baseline gap-1">
                <span className="text-base sm:text-lg font-black text-zinc-900">{metrics.totalHours.toFixed(1)}</span>
                <span className="text-[10px] font-semibold text-zinc-600">hrs estimadas</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. BARRA DE FILTROS E SELEÇÃO DE VISÃO COMPACTA */}
      <div className="bg-white rounded-xl border border-zinc-300 p-2 sm:p-2.5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-2">
        {/* Seletor de Abas de Visão */}
        <div className="flex items-center gap-1 bg-zinc-200 p-1 rounded-xl border border-zinc-300">
          <button
            type="button"
            onClick={() => setViewMode('cronograma')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer select-none ${
              viewMode === 'cronograma'
                ? 'bg-zinc-800 text-white shadow-xs border border-zinc-700'
                : 'text-zinc-700 hover:text-zinc-900 hover:bg-zinc-300/60 font-bold border border-transparent'
            }`}
          >
            1. Cronograma Operacional
          </button>
          <button
            type="button"
            onClick={() => setViewMode('frotas')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer select-none ${
              viewMode === 'frotas'
                ? 'bg-zinc-800 text-white shadow-xs border border-zinc-700'
                : 'text-zinc-700 hover:text-zinc-900 hover:bg-zinc-300/60 font-bold border border-transparent'
            }`}
          >
            2. Escala por Placas/Frotas
          </button>
          <button
            type="button"
            onClick={() => setViewMode('calendario')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer select-none ${
              viewMode === 'calendario'
                ? 'bg-zinc-800 text-white shadow-xs border border-zinc-700'
                : 'text-zinc-700 hover:text-zinc-900 hover:bg-zinc-300/60 font-bold border border-transparent'
            }`}
          >
            3. Calendário
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
            
            {/* 1. TOPO DA MOLDURA: Cabeçalho com título, contadores e botão + Nova Frente */}
            <div className="bg-[#ffedd5] dark:bg-amber-950 text-stone-950 dark:text-amber-100 py-2.5 px-4 border-b-3 border-black dark:border-stone-700 relative flex flex-wrap items-center justify-between gap-2">
              <div className="flex-1 text-center sm:text-left sm:pl-2">
                <h3 className="text-base sm:text-lg font-black tracking-wide font-['Outfit']">
                  Agenda Operacional por Máquinas & Frentes de Colheita
                </h3>
              </div>
              <div className="flex items-center gap-3 ml-auto">
                <span className="text-xs font-bold text-stone-600 dark:text-amber-300 hidden md:inline">
                  Total: {filteredAppointments.length} Agendamentos em {machineColumns.length} Frentes
                </span>
                {/* Botão de Incluir Frente no topo direito do quadro */}
                <button
                  type="button"
                  onClick={handleAddFront}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-black rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer border border-emerald-700"
                  title="Criar nova frente de colheita"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  <span>+ Nova Frente</span>
                </button>
              </div>
            </div>

            {/* 2. GRID DE COLUNAS LADO A LADO POR MÁQUINA PRINCIPAL */}
            {machineColumns.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center justify-center space-y-3 bg-stone-50/50 dark:bg-stone-900/50">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600">
                  <Calendar className="w-7 h-7" />
                </div>
                <div className="max-w-md">
                  <h3 className="text-sm font-black text-stone-800 dark:text-stone-200 uppercase tracking-tight">Nenhuma Frente de Colheita Configurada</h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                    Cadastre suas máquinas ou clique em "+ Nova Frente" para criar as colunas de agendamento por equipe/forrageira.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddFront}
                  className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>Criar Primeira Frente</span>
                </button>
              </div>
            ) : (
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
                  .reduce((sum, a) => {
                    const qty = Number(a.estimatedQuantity) || 0;
                    const unit = String(a.areaUnit || '').toLowerCase().trim();
                    if (unit === 'alqueires' || unit === 'alq' || unit === 'alqueire') {
                      return sum + (qty * 2.42);
                    }
                    if (unit === 'hectares' || unit === 'ha' || unit === 'hectare') {
                      return sum + qty;
                    }
                    return sum;
                  }, 0);

                return (
                  <div
                    key={col.id}
                    onDragOver={(e) => handleDragOver(e, col.id)}
                    onDragEnter={(e) => handleDragEnter(e, col.id)}
                    onDragLeave={(e) => handleDragLeave(e, col.id)}
                    onDrop={(e) => handleDrop(e, col)}
                    className={`flex flex-col transition-colors duration-150 ${
                      isDragOver ? 'ring-4 ring-inset ring-amber-500 bg-amber-100 dark:bg-amber-950' : ''
                    }`}
                    style={{
                      backgroundColor: isDragOver ? undefined : col.columnBgColor || '#fefce8'
                    }}
                  >
                    {/* Cabeçalho da Coluna: Frente #X, Botão Excluir Frente, Título Principal com Nome/Prefixo da Máquina */}
                    <div
                      className="p-2.5 border-b-3 border-black dark:border-stone-700 flex flex-col justify-between items-center text-center select-none"
                      style={{
                        backgroundColor: col.headerBgColor || '#fef08a',
                        color: '#000000'
                      }}
                    >
                      <div className="w-full flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-black/70">
                            Frente #{col.frontNumber || idx + 1}
                          </span>
                          {/* Botão de Excluir Frente (Ícone discreto de lixeira) */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteFrontClick(col);
                            }}
                            title={`Excluir Frente #${col.frontNumber || idx + 1}`}
                            className="p-0.5 text-black/40 hover:text-red-700 hover:bg-red-500/15 rounded transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleCreateNew(col.machineryId, col.machineryName || col.name)}
                          title={`Novo agendamento para ${col.machineryName || `Frente #${col.frontNumber || idx + 1}`}`}
                          className="flex items-center space-x-0.5 hover:text-black transition cursor-pointer text-[10px] font-black underline"
                        >
                          <Plus className="w-3 h-3 inline" />
                          <span>+ Add</span>
                        </button>
                      </div>

                      {/* Título Principal: Exibe diretamente o Nome e Placa/Prefixo da Máquina (substituindo o antigo texto fixo Maq XX) */}
                      <div className="flex items-center justify-center gap-1.5 my-1 w-full px-1">
                        <button
                          type="button"
                          onClick={() => handleOpenVehicleSearch(col)}
                          title="Clique para selecionar ou trocar a máquina desta frente em Frotas"
                          className="text-xs sm:text-sm font-black text-black tracking-tight font-['Outfit'] truncate hover:underline cursor-pointer max-w-[85%]"
                        >
                          {col.machineryName || 'Selecionar Máquina'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenVehicleSearch(col)}
                          title="Vincular ou trocar máquina (Buscar em Frotas)"
                          className="p-1 rounded-md bg-black/5 hover:bg-black/15 active:scale-95 transition-all cursor-pointer flex items-center justify-center border border-black/15 shadow-2xs group shrink-0"
                        >
                          <ForageHarvesterIcon className="w-5 h-4.5 group-hover:scale-110 transition-transform" />
                        </button>
                      </div>

                      {/* Indicador de serviços e área calculada */}
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
                        Mover agendamento para {col.machineryName || col.name}
                      </div>
                    )}

                    {/* LISTAGEM DOS CARDS EMPILHADOS VERTICALMENTE (ORDEM CRONOLÓGICA) */}
                    <div 
                      onDragOver={(e) => handleDragOver(e, col.id)}
                      onDragEnter={(e) => handleDragEnter(e, col.id)}
                      onDrop={(e) => handleDrop(e, col)}
                      className="p-2 space-y-2.5 flex-1 min-h-[420px]"
                    >
                      {colAppointments.length === 0 ? (
                        <div 
                          onDragOver={(e) => handleDragOver(e, col.id)}
                          onDragEnter={(e) => handleDragEnter(e, col.id)}
                          onDrop={(e) => handleDrop(e, col)}
                          className="p-6 text-center text-xs font-semibold text-stone-500 italic flex flex-col items-center justify-center h-full min-h-[200px]"
                        >
                          <Calendar className="w-8 h-8 text-black/20 mb-2" />
                          <span>Nenhum serviço agendado</span>
                          <span className="text-[11px] font-normal text-stone-400 mt-0.5">
                            Máquina livre para alocação
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCreateNew(col.machineryId, col.machineryName || col.name)}
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
                              draggable={true}
                              onDragStart={(e) => handleDragStart(e, app.id)}
                              onDragEnd={handleDragEnd}
                              className={`bg-white dark:bg-stone-900 border-2 border-black/80 dark:border-stone-700 rounded-lg p-3 shadow-xs hover:shadow-md transition-all space-y-2 cursor-grab active:cursor-grabbing select-none ${
                                isBeingDragged ? 'opacity-40 ring-2 ring-black scale-[0.98]' : ''
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
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900 bg-zinc-50 p-1.5 rounded-md border border-zinc-300">
                                  <Clock className="w-3.5 h-3.5 text-zinc-700 shrink-0" />
                                  <span className="truncate">
                                    {formatDateBR(app.startDate)} às <span className="font-black text-black">{app.startTime}h</span>
                                  </span>
                                  {app.endTime && (
                                    <span className="text-[10px] text-stone-500 font-normal shrink-0 ml-auto">
                                      até {app.endTime}h
                                    </span>
                                  )}
                                </div>
                                {app.realStartTime && (
                                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                                    <span className="uppercase text-[9px] px-1 py-0.2 rounded bg-emerald-600 text-white font-black">
                                      REAL:
                                    </span>
                                    <span>{app.realStartTime}h às {app.realEndTime || '—'}h</span>
                                    {app.realLoadsCount !== undefined && app.realLoadsCount > 0 && (
                                      <span className="ml-auto font-semibold text-emerald-700 dark:text-emerald-400">
                                        {app.realLoadsCount} cgs
                                      </span>
                                    )}
                                  </div>
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
                              <div 
                                onMouseDown={(e) => e.stopPropagation()}
                                className="pt-2 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between gap-1"
                              >
                                <button
                                  type="button"
                                  draggable={false}
                                  onClick={() => handleOpenDispatch(app)}
                                  className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-md text-[10px] font-black shadow-xs transition-colors cursor-pointer active:scale-95"
                                  title="Disparar Escala para a Equipe de Campo via WhatsApp"
                                >
                                  <Scissors className="w-3 h-3" />
                                  <span>Puxar Corte</span>
                                </button>

                                <button
                                  type="button"
                                  draggable={false}
                                  onClick={() => handleOpenPrint(app)}
                                  className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-md transition-colors border border-stone-200 dark:border-stone-700 cursor-pointer"
                                  title="Ordem de Campo (A4)"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  draggable={false}
                                  onClick={() => handleEdit(app)}
                                  className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-md transition-colors border border-stone-200 dark:border-stone-700 cursor-pointer"
                                  title="Editar Agendamento"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  draggable={false}
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
            )}
          </div>
        </div>
      )}

      {/* VISÃO 2: ESCALA POR PLACAS/FROTAS - TABELA ESTRUTURADA EM LINHAS HORIZONTAIS */}
      {viewMode === 'frotas' && (
        <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-stone-100/90 dark:bg-stone-800/90 text-stone-700 dark:text-stone-300 font-extrabold border-b border-stone-200 dark:border-stone-700 uppercase text-[10px] sm:text-[11px] tracking-wider">
                  <th className="py-3 px-3.5 whitespace-nowrap">Nº Agendamento</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Veículo Principal</th>
                  <th className="py-3 px-3.5">Cliente & Local</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Período</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Volume / Área</th>
                  <th className="py-3 px-3.5">Trator</th>
                  <th className="py-3 px-3.5">Demais Veículos</th>
                  <th className="py-3 px-3.5 text-right whitespace-nowrap">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {activeAppointmentsForFleet.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-stone-500 dark:text-stone-400 text-xs">
                      Nenhum agendamento ativo encontrado com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  activeAppointmentsForFleet.map(a => {
                    // Coluna 1 (Veículo Principal): Exibir diretamente [Placa] - [Modelo do Veículo] (Ex: "MAQ-02 - CLAAS JAGUAR 860")
                    const mainVehicle = resolvePrimaryVehicleDisplay(a);

                    // Coluna 2 (Cliente & Local): Exibir o Nome do Cliente e a Cidade na mesma célula
                    const clientCity = a.locationCityState || 
                      clients?.find(c => c.id === a.clientId)?.city || 
                      a.farmName || 
                      '—';

                    // Coluna 4 (Volume/Área): Exibir a quantidade de área (ha/alq) ou total de horas previstas
                    const unitLabel = a.areaUnit === 'hectares' ? 'ha' : a.areaUnit === 'alqueires' ? 'alq' : 'horas';
                    const volumeText = a.estimatedQuantity ? `${a.estimatedQuantity} ${unitLabel}` : '—';

                    // Coluna 5 (Trator): Trator escalado na frota de apoio deste agendamento (prefixo/placa). Se não houver, em branco
                    const tractors = (a.assignedVehicles || []).filter(v => {
                      if (v.category === 'trator') return true;
                      const prefixL = (v.prefix || '').toLowerCase();
                      const modelL = (v.model || '').toLowerCase();
                      return prefixL.includes('trator') || modelL.includes('trator');
                    });

                    // Coluna 6 (Demais Veículos): Listar todos os outros veículos de apoio restantes (Caminhões de silagem, etc.)
                    const otherVehicles = (a.assignedVehicles || []).filter(v => {
                      const isTractor = v.category === 'trator' || 
                        (v.prefix || '').toLowerCase().includes('trator') || 
                        (v.model || '').toLowerCase().includes('trator');
                      return !isTractor;
                    });

                    return (
                      <tr 
                        key={a.id}
                        className="hover:bg-stone-50/90 dark:hover:bg-stone-800/50 transition-colors"
                      >
                        {/* 1ª Coluna: Nº Agendamento */}
                        <td className="py-3 px-3.5 align-middle whitespace-nowrap">
                          <span className="font-extrabold text-stone-900 dark:text-stone-100 text-xs font-mono">
                            {a.appointmentNumber}
                          </span>
                        </td>

                        {/* 2ª Coluna: Veículo Principal */}
                        <td className="py-3 px-3.5 align-middle whitespace-nowrap">
                          <span className="font-extrabold text-stone-900 dark:text-stone-100 text-xs px-2.5 py-1 rounded bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 inline-block font-mono">
                            {mainVehicle}
                          </span>
                        </td>

                        {/* Coluna 2: Cliente & Local */}
                        <td className="py-3 px-3.5 align-middle">
                          <div className="font-bold text-stone-900 dark:text-stone-100 text-xs leading-tight">
                            {a.clientName}
                          </div>
                          <div className="text-[11px] font-medium text-stone-500 dark:text-stone-400 mt-0.5 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-stone-400 shrink-0" />
                            <span>{clientCity}</span>
                          </div>
                        </td>

                        {/* Coluna 3: Período */}
                        <td className="py-3 px-3.5 align-middle whitespace-nowrap">
                          <div className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                            <span className="text-[10px] uppercase font-bold text-stone-400 dark:text-stone-500 mr-1">Início:</span>
                            {formatDateBR(a.startDate)}{a.startTime ? ` às ${a.startTime}h` : ''}
                          </div>
                          <div className="text-xs font-semibold text-stone-600 dark:text-stone-400 mt-0.5">
                            <span className="text-[10px] uppercase font-bold text-stone-400 dark:text-stone-500 mr-1">Fim:</span>
                            {formatDateBR(a.endDate || a.startDate)}{a.endTime ? ` às ${a.endTime}h` : ''}
                          </div>
                          {/* Linha discreta de Horário Real trazido manualmente de campo */}
                          <div className="mt-1 pt-1 border-t border-stone-100 dark:border-stone-800 text-[11px] font-medium">
                            {a.realStartTime ? (
                              <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                                <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-black">
                                  REAL:
                                </span>
                                <span>{a.realStartTime}h às {a.realEndTime || '—'}h</span>
                                {a.realLoadsCount !== undefined && a.realLoadsCount > 0 && (
                                  <span className="text-stone-500 dark:text-stone-400 font-normal">
                                    • {a.realLoadsCount} cgs
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="text-stone-400 dark:text-stone-500 text-[10px] italic">
                                REAL: Aguardando retorno...
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Coluna 4: Volume/Área */}
                        <td className="py-3 px-3.5 align-middle whitespace-nowrap">
                          <div className="text-xs font-bold text-stone-900 dark:text-stone-100">
                            {volumeText}
                          </div>
                          {a.totalTimeMinutes > 0 && (
                            <div className="text-[11px] font-medium text-stone-500 dark:text-stone-400 mt-0.5">
                              Previsto: {formatMinToHoursText(a.totalTimeMinutes)}
                            </div>
                          )}
                        </td>

                        {/* Coluna 5: Trator */}
                        <td className="py-3 px-3.5 align-middle">
                          {tractors.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-1">
                              {tractors.map((t, idx) => {
                                const displayPrefix = t.prefix || t.model || 'Trator';
                                const displayPlate = t.plateOrSerial && t.plateOrSerial !== t.prefix ? t.plateOrSerial : '';
                                return (
                                  <span 
                                    key={idx}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800/60 font-mono"
                                  >
                                    <span>{displayPrefix}</span>
                                    {displayPlate && (
                                      <span className="text-[10px] text-amber-700 dark:text-amber-300 font-normal">
                                        ({displayPlate})
                                      </span>
                                    )}
                                  </span>
                                );
                              })}
                            </div>
                          ) : null /* Deixa em branco caso não haja trator */}
                        </td>

                        {/* Coluna 6: Demais Veículos */}
                        <td className="py-3 px-3.5 align-middle">
                          {otherVehicles.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-1.5">
                              {otherVehicles.map((v, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700 whitespace-nowrap"
                                  title={v.model || v.plateOrSerial}
                                >
                                  <Truck className="w-3 h-3 text-stone-400 shrink-0" />
                                  <span>{v.prefix || v.model || v.plateOrSerial}</span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-stone-400 text-xs italic">—</span>
                          )}
                        </td>

                        {/* Ações */}
                        <td className="py-3 px-3.5 align-middle text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenDispatch(a)}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold cursor-pointer transition-colors shadow-2xs flex items-center gap-1 active:scale-95"
                              title="Disparar Escala para a Equipe de Campo via WhatsApp"
                            >
                              <Play className="w-3 h-3" />
                              <span>Puxar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenPrint(a)}
                              className="p-1 text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 rounded transition-colors"
                              title="Imprimir Ordem de Campo"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEdit(a)}
                              className="p-1 text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 rounded transition-colors"
                              title="Editar Agendamento"
                            >
                              <Edit className="w-3.5 h-3.5" />
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
      )}

      {/* VISÃO 3: CALENDÁRIO OPERACIONAL */}
      {viewMode === 'calendario' && (
        <ServiceCalendarView
          appointments={filteredAppointments}
          onSelectAppointment={handleEdit}
          onCreateAppointmentForDate={handleCreateAppointmentForDate}
          onExecuteService={handleOpenDispatch}
          onPrintAppointment={handleOpenPrint}
          resolvePrimaryVehicleDisplay={resolvePrimaryVehicleDisplay}
        />
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

      {/* 2. MODAL DE ALERTA: EXCLUSÃO DE FRENTE BLOQUEADA (POSSUI AGENDAMENTOS VINCULADOS) */}
      {frontDeleteBlocked && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setFrontDeleteBlocked(null)}
        >
          <div 
            className="w-full max-w-md bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 p-5 sm:p-6 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5">
              <div className="p-3 bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 rounded-xl shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1 flex-1 min-w-0">
                <h3 className="text-base font-extrabold text-stone-900 dark:text-stone-100">
                  Exclusão Não Permitida
                </h3>
                <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                  {frontDeleteBlocked}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-stone-100 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setFrontDeleteBlocked(null)}
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 active:scale-95 rounded-lg transition-all shadow-xs cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DE FRENTE (COLUNA VAZIA) */}
      {frontToDelete && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => !isDeletingFront && setFrontToDelete(null)}
        >
          <div 
            className="w-full max-w-md bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 p-5 sm:p-6 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5">
              <div className="p-3 bg-red-100 dark:bg-red-950/80 text-red-600 dark:text-red-400 rounded-xl shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1 flex-1 min-w-0">
                <h3 className="text-base font-extrabold text-stone-900 dark:text-stone-100">
                  Excluir Frente Operacional
                </h3>
                <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                  Tem certeza que deseja excluir a{' '}
                  <strong className="text-stone-900 dark:text-stone-100 font-extrabold">
                    Frente #{frontToDelete.frontNumber}
                  </strong>?
                </p>
              </div>
            </div>

            <div className="p-3 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700/60 space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-stone-500 dark:text-stone-400">
                <span>Coluna / Frente:</span>
                <span className="font-bold text-stone-800 dark:text-stone-200">
                  Frente #{frontToDelete.frontNumber}
                </span>
              </div>
              <div className="flex items-center justify-between text-stone-500 dark:text-stone-400">
                <span>Máquina Vinculada:</span>
                <span className="font-semibold text-stone-800 dark:text-stone-200 truncate max-w-[200px]">
                  {frontToDelete.machineryName || 'Nenhuma (Sem Máquina)'}
                </span>
              </div>
              <div className="flex items-center justify-between text-stone-500 dark:text-stone-400">
                <span>Agendamentos Vinculados:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  0 (Coluna Vazia)
                </span>
              </div>
            </div>

            <p className="text-[11px] text-stone-400 dark:text-stone-500">
              Esta ação removerá a coluna inteira da agenda operacional e do banco de dados.
            </p>

            <div className="flex items-center justify-end gap-2 pt-1 border-t border-stone-100 dark:border-stone-800">
              <button
                type="button"
                disabled={isDeletingFront}
                onClick={() => setFrontToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-stone-700 dark:text-stone-300 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeletingFront}
                onClick={handleConfirmDeleteFront}
                className="px-4 py-2 text-xs font-black text-white bg-red-600 hover:bg-red-700 active:scale-95 rounded-lg transition-all shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingFront ? 'Excluindo...' : 'Excluir Frente'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE DISPARO DE ESCALA PARA CAMPO VIA WHATSAPP E RETORNO */}
      {isDispatchOpen && selectedForDispatch && (
        <DispatchFieldModal
          isOpen={isDispatchOpen}
          onClose={() => {
            setIsDispatchOpen(false);
            setSelectedForDispatch(null);
          }}
          appointment={selectedForDispatch}
          employees={employees}
          machineries={machineries}
          companyProfile={companyProfile}
          onSaveRealData={handleSaveRealData}
          onProceedToBilling={(app) => {
            handleExecuteService(app);
          }}
        />
      )}

    </div>
  );
};
