import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  Truck, 
  User, 
  Plus, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  Scissors, 
  MapPin, 
  Phone,
  Calculator,
  ShieldAlert,
  Layers,
  ArrowRight
} from 'lucide-react';
import { 
  ServiceAppointment, 
  Machinery, 
  Employee, 
  Client, 
  AgendaVehicleAssignment, 
  AgendaTeamMember 
} from '../../types';
import { 
  isForrageira, 
  isCaminhao, 
  isTrator, 
  formatMachineryOptionLabel, 
  formatTruckOptionLabel,
  findLinkedOperator 
} from './serviceHelpers';
import { getStoredMachineries, formatDateBR } from '../../lib/storage';

// Funções utilitárias de timestamp e cálculo de término sem timezone drift
const getCurrentTimeString = (): string => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
};

const toTimestamp = (dateStr?: string, timeStr?: string): number => {
  if (!dateStr || !timeStr) return NaN;
  const [y, m, d] = dateStr.split('-').map(Number);
  const [h, min] = timeStr.split(':').map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d) || isNaN(h) || isNaN(min)) return NaN;
  return new Date(y, m - 1, d, h, min, 0, 0).getTime();
};

const fromTimestamp = (ms: number): { dateStr: string; timeStr: string } => {
  const dt = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  const timeStr = `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  return { dateStr, timeStr };
};

const getApptDurationMinutes = (app: ServiceAppointment): number => {
  if (app.totalTimeMinutes && app.totalTimeMinutes > 0) return app.totalTimeMinutes;
  const startMs = toTimestamp(app.startDate, app.startTime);
  const endMs = toTimestamp(app.endDate || app.startDate, app.endTime || app.startTime);
  if (!isNaN(startMs) && !isNaN(endMs) && endMs > startMs) {
    return Math.round((endMs - startMs) / 60000);
  }
  return 60;
};

const getApptEndMs = (app: ServiceAppointment): number => {
  if (app.endDate && app.endTime) {
    const endMs = toTimestamp(app.endDate, app.endTime);
    if (!isNaN(endMs)) return endMs;
  }
  const startMs = toTimestamp(app.startDate, app.startTime);
  const dur = getApptDurationMinutes(app);
  return isNaN(startMs) ? 0 : startMs + dur * 60000;
};

interface AppointmentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (appointment: ServiceAppointment, cascadedAppointments?: ServiceAppointment[]) => void;
  editAppointment?: ServiceAppointment | null;
  existingAppointments: ServiceAppointment[];
  machineries?: Machinery[];
  employees?: Employee[];
  clients?: Client[];
  nextAppointmentNumber?: string;
}

export const AppointmentFormModal: React.FC<AppointmentFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editAppointment,
  existingAppointments,
  machineries = [],
  employees = [],
  clients = [],
  nextAppointmentNumber = 'AG-2026-001',
}) => {
  // 1. Identificação Básica
  const [appointmentNumber, setAppointmentNumber] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientName, setClientName] = useState('');
  const [farmName, setFarmName] = useState('');
  const [locationCityState, setLocationCityState] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [serviceType, setServiceType] = useState<'Corte / Ensilagem' | 'Colheita' | 'Serviço de Trator' | 'Serviço de Máquina' | 'Frete / Transporte'>('Corte / Ensilagem');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState(getCurrentTimeString);

  // 2. Parâmetros de Tempo e Rendimento (Iniciam limpos / vazios para digitação direta)
  const [travelTimeMinutes, setTravelTimeMinutes] = useState<number | ''>(''); // Deslocamento
  const [trailerLoadingTimeMinutes, setTrailerLoadingTimeMinutes] = useState<number | ''>(''); // Prancha
  const [areaUnit, setAreaUnit] = useState<'hectares' | 'alqueires' | 'horas'>('hectares');
  const [estimatedQuantity, setEstimatedQuantity] = useState<number | ''>(''); // Quantidade
  const [productivityRatePerHour, setProductivityRatePerHour] = useState<number | ''>(''); // Rendimento ha/h

  // 3. Frotas e Equipe Escalada
  const [primaryMachineryId, setPrimaryMachineryId] = useState('');
  const [primaryOperatorId, setPrimaryOperatorId] = useState('');
  const [assignedVehicles, setAssignedVehicles] = useState<AgendaVehicleAssignment[]>([]);
  const [assignedTeam, setAssignedTeam] = useState<AgendaTeamMember[]>([]);

  // 4. Status e Observações
  const [status, setStatus] = useState<'agendado' | 'em_deslocamento' | 'em_execucao' | 'concluido' | 'cancelado'>('agendado');
  const [fieldNotes, setFieldNotes] = useState('');

  // Erro ou conflito forçado / remanejamento em cascata
  const [conflictWarningAck, setConflictWarningAck] = useState(false);
  const [applyAutoShift, setApplyAutoShift] = useState(false);

  // Lista de máquinas disponíveis consolidando cadastro de frotas (prop + storage) e sugestões padrão da frota
  const availableMachineries = useMemo(() => {
    const list: Machinery[] = [...machineries];

    // Sincroniza veículos salvos no storage de Gestão de Frotas
    try {
      const stored = getStoredMachineries();
      (stored || []).forEach(sm => {
        const existingIdx = list.findIndex(m => m.id === sm.id);
        if (existingIdx >= 0) {
          list[existingIdx] = { ...list[existingIdx], ...sm };
        } else {
          list.push(sm);
        }
      });
    } catch (e) {
      console.error('Erro ao ler frotas do storage', e);
    }

    const defaultSuggestions: Machinery[] = [
      {
        id: 'veh_forr_05_2023',
        name: 'Claas Jaguar 870 (Maq 02)',
        fleetNumber: 'Maq 02',
        model: 'Claas Jaguar 870',
        brand: 'Claas',
        licensePlateOrSerial: 'CLAAS-870-05',
        categoryType: 'Forrageira',
        status: 'disponivel',
      },
      {
        id: 'veh_colh_02_2022',
        name: 'Claas Jaguar 860 (Maq 03)',
        fleetNumber: 'Maq 03',
        model: 'Claas Jaguar 860',
        brand: 'Claas',
        licensePlateOrSerial: 'CLAAS-860-02',
        categoryType: 'Forrageira',
        status: 'disponivel',
      },
      {
        id: 'veh_trator_jd_6110',
        name: 'Trator JD 6110J + JF C120 (Maq 04)',
        fleetNumber: 'Maq 04',
        model: 'JD 6110J + JF C120',
        brand: 'John Deere',
        licensePlateOrSerial: 'TRAT-6110-01',
        categoryType: 'Trator',
        status: 'disponivel',
      },
      {
        id: 'veh_evd_2j61',
        name: 'Mercedes-Benz 2726 + Suporte (Maq 05)',
        fleetNumber: 'Maq 05',
        model: 'MB 2726 6x4 Silagem',
        brand: 'Mercedes-Benz',
        licensePlateOrSerial: 'EVD-2J61',
        categoryType: 'Caminhão',
        status: 'disponivel',
      },
    ];

    defaultSuggestions.forEach(sug => {
      if (!list.some(m => m.id === sug.id || (m.fleetNumber && m.fleetNumber.toLowerCase() === sug.fleetNumber.toLowerCase()))) {
        list.push(sug);
      }
    });

    return list;
  }, [machineries]);

  // Helper de busca automática (LOOKUP) na tabela "Gestão de Frotas > Veículos"
  const lookupFleetVehicle = (vehicleId: string): Machinery | undefined => {
    if (!vehicleId) return undefined;
    const fromAvailable = availableMachineries.find(m => m.id === vehicleId);
    if (fromAvailable) return fromAvailable;

    const fromProp = machineries.find(m => m.id === vehicleId);
    if (fromProp) return fromProp;

    try {
      const stored = getStoredMachineries();
      const fromStored = (stored || []).find(m => m.id === vehicleId);
      if (fromStored) return fromStored;
    } catch (e) {
      console.error(e);
    }

    return undefined;
  };

  // Manipulador ao selecionar a Máquina Principal com regra de LOOKUP de motorista/operador
  const handlePrimaryMachineryChange = (newMachId: string) => {
    setPrimaryMachineryId(newMachId);

    // REGRA DE AUTOMAÇÃO (LOOKUP): busca o operador pré-vinculado no cadastro do veículo em Frotas
    if (newMachId) {
      const selectedMach = lookupFleetVehicle(newMachId);
      if (selectedMach) {
        const linkedOp = findLinkedOperator(selectedMach, employees);
        if (linkedOp.id) {
          setPrimaryOperatorId(linkedOp.id);
        } else if (linkedOp.name) {
          const matchedEmp = employees.find(e => 
            e.name.trim().toLowerCase() === linkedOp.name.trim().toLowerCase()
          );
          if (matchedEmp) {
            setPrimaryOperatorId(matchedEmp.id);
          }
        }
      }
    }
  };

  // Inicialização ao abrir modal (Novo ou Edição)
  useEffect(() => {
    if (editAppointment) {
      setAppointmentNumber(editAppointment.appointmentNumber);
      setClientId(editAppointment.clientId || '');
      setClientName(editAppointment.clientName || '');
      setFarmName(editAppointment.farmName || '');
      setLocationCityState(editAppointment.locationCityState || '');
      setContactPhone(editAppointment.contactPhone || '');
      setServiceType(editAppointment.serviceType || 'Corte / Ensilagem');
      setStartDate(editAppointment.startDate || new Date().toISOString().split('T')[0]);
      setStartTime(editAppointment.startTime || getCurrentTimeString());
      setTravelTimeMinutes(editAppointment.travelTimeMinutes !== undefined && editAppointment.travelTimeMinutes !== null ? editAppointment.travelTimeMinutes : '');
      setTrailerLoadingTimeMinutes(editAppointment.trailerLoadingTimeMinutes !== undefined && editAppointment.trailerLoadingTimeMinutes !== null ? editAppointment.trailerLoadingTimeMinutes : '');
      setAreaUnit(editAppointment.areaUnit || 'hectares');
      setEstimatedQuantity(editAppointment.estimatedQuantity !== undefined && editAppointment.estimatedQuantity !== null ? editAppointment.estimatedQuantity : '');
      setProductivityRatePerHour(editAppointment.productivityRatePerHour !== undefined && editAppointment.productivityRatePerHour !== null ? editAppointment.productivityRatePerHour : '');
      
      // Auto-preenche a máquina principal vinda do contexto da coluna ou do agendamento
      const targetMachId = editAppointment.primaryMachineryId || '';
      const matchingMach = availableMachineries.find(m => 
        m.id === targetMachId || 
        (editAppointment.primaryMachineryPrefix && m.fleetNumber && m.fleetNumber.toLowerCase() === editAppointment.primaryMachineryPrefix.toLowerCase()) ||
        (m.fleetNumber && targetMachId.toLowerCase().includes(m.fleetNumber.toLowerCase()))
      );
      setPrimaryMachineryId(matchingMach ? matchingMach.id : targetMachId);

      setAssignedVehicles(editAppointment.assignedVehicles || []);
      setAssignedTeam(editAppointment.assignedTeam || []);
      setStatus(editAppointment.status || 'agendado');
      setFieldNotes(editAppointment.fieldNotes || '');

      // Procura operador principal na equipe ou faz o LOOKUP automático na máquina
      const op = editAppointment.assignedTeam?.find(t => t.role.toLowerCase().includes('forrageira') || t.role.toLowerCase().includes('principal'));
      if (op && op.employeeId) {
        setPrimaryOperatorId(op.employeeId);
      } else if (matchingMach) {
        const linkedOp = findLinkedOperator(matchingMach, employees);
        if (linkedOp.id) {
          setPrimaryOperatorId(linkedOp.id);
        } else if (linkedOp.name) {
          const matchedEmp = employees.find(e => 
            e.name.trim().toLowerCase() === linkedOp.name.trim().toLowerCase()
          );
          if (matchedEmp) setPrimaryOperatorId(matchedEmp.id);
        }
      }
    } else {
      setAppointmentNumber(nextAppointmentNumber);
      setClientId('');
      setClientName('');
      setFarmName('');
      setLocationCityState('');
      setContactPhone('');
      setServiceType('Corte / Ensilagem');
      setStartDate(new Date().toISOString().split('T')[0]);
      setStartTime(getCurrentTimeString());
      setTravelTimeMinutes('');
      setTrailerLoadingTimeMinutes('');
      setAreaUnit('hectares');
      setEstimatedQuantity('');
      setProductivityRatePerHour('');

      // Pré-seleciona a primeira forrageira disponível se houver e busca o operador vinculado
      const firstForr = availableMachineries.find(isForrageira) || availableMachineries[0];
      if (firstForr) {
        setPrimaryMachineryId(firstForr.id);
        const linkedOp = findLinkedOperator(firstForr, employees);
        if (linkedOp.id) {
          setPrimaryOperatorId(linkedOp.id);
        } else if (linkedOp.name) {
          const matchedEmp = employees.find(e => 
            e.name.trim().toLowerCase() === linkedOp.name.trim().toLowerCase()
          );
          setPrimaryOperatorId(matchedEmp ? matchedEmp.id : (employees[0]?.id || ''));
        } else {
          setPrimaryOperatorId(employees[0]?.id || '');
        }
      } else {
        setPrimaryMachineryId('');
        setPrimaryOperatorId('');
      }

      setAssignedVehicles([]);
      setAssignedTeam([]);
      setStatus('agendado');
      setFieldNotes('');
    }
    setConflictWarningAck(false);
    setApplyAutoShift(false);
  }, [editAppointment, isOpen, nextAppointmentNumber, availableMachineries, employees]);

  // Sincronização ao selecionar Cliente
  const handleClientChange = (cId: string) => {
    setClientId(cId);
    const selected = clients.find(c => c.id === cId);
    if (selected) {
      setClientName(selected.name);
      setFarmName(selected.farmName || '');
      setLocationCityState([selected.city, selected.state].filter(Boolean).join(' - '));
      setContactPhone(selected.phone || '');
    }
  };

  // Cálculo de Tempo de Execução, Tempo Total e Término Previsto
  const { executionMinutes, totalMinutes, calculatedEndDate, calculatedEndTime, hasValidCalculation } = useMemo(() => {
    const qty = typeof estimatedQuantity === 'number' ? estimatedQuantity : (parseFloat(String(estimatedQuantity)) || 0);
    const rate = typeof productivityRatePerHour === 'number' ? productivityRatePerHour : (parseFloat(String(productivityRatePerHour)) || 0);
    const travel = typeof travelTimeMinutes === 'number' ? travelTimeMinutes : (parseInt(String(travelTimeMinutes)) || 0);
    const trailer = typeof trailerLoadingTimeMinutes === 'number' ? trailerLoadingTimeMinutes : (parseInt(String(trailerLoadingTimeMinutes)) || 0);

    // Processar ou exibir apenas se Quantidade Prevista e Rendimento Operacional forem maiores que zero
    if (qty <= 0 || rate <= 0) {
      return {
        executionMinutes: 0,
        totalMinutes: 0,
        calculatedEndDate: '',
        calculatedEndTime: '',
        hasValidCalculation: false
      };
    }

    const execMin = Math.round((qty / rate) * 60);
    const totMin = Math.max(0, travel + trailer + execMin);

    if (!startDate || !startTime) {
      return {
        executionMinutes: execMin,
        totalMinutes: totMin,
        calculatedEndDate: '',
        calculatedEndTime: '',
        hasValidCalculation: true
      };
    }

    // Converte startDate + startTime para objeto Date e soma minutos
    const [year, month, day] = (startDate || '2026-09-18').split('-').map(Number);
    const [hours, minutes] = (startTime || '07:00').split(':').map(Number);

    if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hours) || isNaN(minutes)) {
      return {
        executionMinutes: execMin,
        totalMinutes: totMin,
        calculatedEndDate: startDate,
        calculatedEndTime: startTime,
        hasValidCalculation: true
      };
    }

    const startDateTime = new Date(year, month - 1, day, hours, minutes);
    const endDateTime = new Date(startDateTime.getTime() + totMin * 60000);

    const endY = endDateTime.getFullYear();
    const endM = String(endDateTime.getMonth() + 1).padStart(2, '0');
    const endD = String(endDateTime.getDate()).padStart(2, '0');
    const endH = String(endDateTime.getHours()).padStart(2, '0');
    const endMin = String(endDateTime.getMinutes()).padStart(2, '0');

    return {
      executionMinutes: execMin,
      totalMinutes: totMin,
      calculatedEndDate: `${endY}-${endM}-${endD}`,
      calculatedEndTime: `${endH}:${endMin}`,
      hasValidCalculation: true
    };
  }, [startDate, startTime, travelTimeMinutes, trailerLoadingTimeMinutes, estimatedQuantity, productivityRatePerHour]);

  // Lista de todos os IDs de veículos escalados neste agendamento
  const allCurrentVehicleIds = useMemo(() => {
    const ids = new Set<string>();
    if (primaryMachineryId) ids.add(primaryMachineryId);
    assignedVehicles.forEach(v => {
      if (v.machineryId) ids.add(v.machineryId);
    });
    return Array.from(ids);
  }, [primaryMachineryId, assignedVehicles]);

  // 5. REGRA CRÍTICA DE NEGÓCIO: Detecção de Conflito de Horário para o Mesmo Veículo
  const vehicleScheduleConflicts = useMemo(() => {
    if (!startDate || !startTime || !calculatedEndDate || !calculatedEndTime || allCurrentVehicleIds.length === 0) {
      return [];
    }

    const currentStartMs = toTimestamp(startDate, startTime);
    const currentEndMs = toTimestamp(calculatedEndDate, calculatedEndTime);

    if (isNaN(currentStartMs) || isNaN(currentEndMs)) return [];

    const conflicts: {
      vehicleId: string;
      vehicleName: string;
      conflictingAppointment: ServiceAppointment;
    }[] = [];

    // Compara com outros agendamentos cadastrados (exceto o próprio se em edição)
    existingAppointments.forEach(otherAppt => {
      if (editAppointment && otherAppt.id === editAppointment.id) return;
      if (otherAppt.status === 'cancelado') return;

      const otherStartMs = toTimestamp(otherAppt.startDate, otherAppt.startTime);
      const otherEndMs = getApptEndMs(otherAppt);

      if (isNaN(otherStartMs) || isNaN(otherEndMs)) return;

      // Há sobreposição se: currentStart < otherEnd AND currentEnd > otherStart
      const hasOverlap = currentStartMs < otherEndMs && currentEndMs > otherStartMs;

      if (hasOverlap) {
        // Verifica se algum veículo deste agendamento está no outro
        const otherVehicleIds = new Set<string>();
        if (otherAppt.primaryMachineryId) otherVehicleIds.add(otherAppt.primaryMachineryId);
        (otherAppt.assignedVehicles || []).forEach(v => {
          if (v.machineryId) otherVehicleIds.add(v.machineryId);
        });

        allCurrentVehicleIds.forEach(vId => {
          if (otherVehicleIds.has(vId)) {
            const mach = machineries.find(m => m.id === vId);
            const machName = mach 
              ? `${mach.fleetNumber || mach.name} (Placa/Série: ${mach.licensePlateOrSerial || '—'})`
              : 'Veículo';

            conflicts.push({
              vehicleId: vId,
              vehicleName: machName,
              conflictingAppointment: otherAppt,
            });
          }
        });
      }
    });

    return conflicts;
  }, [startDate, startTime, calculatedEndDate, calculatedEndTime, allCurrentVehicleIds, existingAppointments, editAppointment, machineries]);

  // 1. Sugestão Inteligente do Próximo Horário Disponível
  const nextAvailableSlot = useMemo(() => {
    if (vehicleScheduleConflicts.length === 0) return null;
    if (!startDate || !startTime || !calculatedEndDate || !calculatedEndTime) return null;

    const currentDurationMin = totalMinutes > 0 ? totalMinutes : 60;
    const affectedVehicleIds = new Set(vehicleScheduleConflicts.map(c => c.vehicleId));
    if (primaryMachineryId) affectedVehicleIds.add(primaryMachineryId);

    // Identifica o maior término entre os agendamentos que geraram o conflito direto
    let maxConflictEndMs = 0;
    vehicleScheduleConflicts.forEach(conf => {
      const endMs = getApptEndMs(conf.conflictingAppointment);
      if (endMs > maxConflictEndMs) {
        maxConflictEndMs = endMs;
      }
    });

    if (maxConflictEndMs === 0) return null;

    // Busca próximo slot onde todos os veículos da escala fiquem livres
    let candidateStartMs = maxConflictEndMs;
    let iterations = 0;
    let isSlotFree = false;

    while (!isSlotFree && iterations < 50) {
      iterations++;
      const candidateEndMs = candidateStartMs + currentDurationMin * 60000;

      const collision = existingAppointments.find(app => {
        if (editAppointment && app.id === editAppointment.id) return false;
        if (app.status === 'cancelado') return false;

        const appVehicles = [app.primaryMachineryId, ...(app.assignedVehicles || []).map(v => v.machineryId)].filter(Boolean);
        const shares = appVehicles.some(vId => affectedVehicleIds.has(vId!));
        if (!shares) return false;

        const aStartMs = toTimestamp(app.startDate, app.startTime);
        const aEndMs = getApptEndMs(app);
        if (isNaN(aStartMs) || isNaN(aEndMs)) return false;

        return candidateStartMs < aEndMs && candidateEndMs > aStartMs;
      });

      if (collision) {
        const collEndMs = getApptEndMs(collision);
        candidateStartMs = Math.max(candidateStartMs + 15 * 60000, collEndMs);
      } else {
        isSlotFree = true;
      }
    }

    const { dateStr, timeStr } = fromTimestamp(candidateStartMs);
    return {
      date: dateStr,
      time: timeStr,
      timestampMs: candidateStartMs
    };
  }, [vehicleScheduleConflicts, startDate, startTime, calculatedEndDate, calculatedEndTime, totalMinutes, primaryMachineryId, existingAppointments, editAppointment]);

  const handleApplyNextAvailableSlot = () => {
    if (!nextAvailableSlot) return;
    setStartDate(nextAvailableSlot.date);
    setStartTime(nextAvailableSlot.time);
    setConflictWarningAck(false);
    setApplyAutoShift(false);
  };

  // 2. Lógica de Encaixe com Remanejamento Automático em Cascata para Frente
  const cascadedDisplacements = useMemo(() => {
    if (vehicleScheduleConflicts.length === 0) return [];
    if (!startDate || !startTime || !calculatedEndDate || !calculatedEndTime) return [];

    const currentStartMs = toTimestamp(startDate, startTime);
    const currentEndMs = toTimestamp(calculatedEndDate, calculatedEndTime);
    if (isNaN(currentStartMs) || isNaN(currentEndMs)) return [];

    const affectedVehicleIds = new Set(vehicleScheduleConflicts.map(c => c.vehicleId));
    if (primaryMachineryId) affectedVehicleIds.add(primaryMachineryId);

    // Agendamentos candidatos a deslocamento (mesma máquina/veículos, não cancelados, não concluídos)
    const candidateAppts = existingAppointments.filter(app => {
      if (editAppointment && app.id === editAppointment.id) return false;
      if (app.status === 'cancelado' || app.status === 'concluido') return false;

      const appVehicles = [app.primaryMachineryId, ...(app.assignedVehicles || []).map(v => v.machineryId)].filter(Boolean);
      const shares = appVehicles.some(vId => affectedVehicleIds.has(vId!));
      if (!shares) return false;

      const aStartMs = toTimestamp(app.startDate, app.startTime);
      const aEndMs = getApptEndMs(app);
      if (isNaN(aStartMs) || isNaN(aEndMs)) return false;

      const hasOverlap = currentStartMs < aEndMs && currentEndMs > aStartMs;
      const startsAfter = aStartMs >= currentStartMs;
      return hasOverlap || startsAfter;
    });

    if (candidateAppts.length === 0) return [];

    // Ordena cronologicamente por horário de início original
    candidateAppts.sort((a, b) => {
      const aStart = toTimestamp(a.startDate, a.startTime);
      const bStart = toTimestamp(b.startDate, b.startTime);
      return aStart - bStart;
    });

    let currentPointerMs = currentEndMs;
    const displacements: {
      original: ServiceAppointment;
      newStartDate: string;
      newStartTime: string;
      newEndDate: string;
      newEndTime: string;
      minutesShifted: number;
    }[] = [];

    for (const app of candidateAppts) {
      const origStartMs = toTimestamp(app.startDate, app.startTime);
      const origEndMs = getApptEndMs(app);
      const durMin = getApptDurationMinutes(app);

      // Se o ponteiro ultrapassa o início original do agendamento, empurra para frente!
      if (currentPointerMs > origStartMs) {
        const { dateStr: newStartDate, timeStr: newStartTime } = fromTimestamp(currentPointerMs);
        const newEndMs = currentPointerMs + durMin * 60000;
        const { dateStr: newEndDate, timeStr: newEndTime } = fromTimestamp(newEndMs);

        displacements.push({
          original: app,
          newStartDate,
          newStartTime,
          newEndDate,
          newEndTime,
          minutesShifted: Math.round((currentPointerMs - origStartMs) / 60000),
        });

        currentPointerMs = newEndMs;
      } else {
        currentPointerMs = Math.max(currentPointerMs, origEndMs);
      }
    }

    return displacements;
  }, [vehicleScheduleConflicts, startDate, startTime, calculatedEndDate, calculatedEndTime, primaryMachineryId, existingAppointments, editAppointment]);

  // Identificação de veículos de apoio já escalados
  const supportVehicleIds = useMemo(() => {
    return new Set(assignedVehicles.map(v => v.machineryId).filter(Boolean));
  }, [assignedVehicles]);

  // Validação em tempo real de duplicidade de veículos e placas neste agendamento
  const duplicateVehicleIndices = useMemo(() => {
    const dupIndices = new Set<number>();
    const normalizePlate = (p?: string) => (p || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    
    const primaryMach = availableMachineries.find(m => m.id === primaryMachineryId);
    const primaryPlate = normalizePlate(primaryMach?.licensePlateOrSerial || primaryMach?.serialNumber);

    assignedVehicles.forEach((veh, idx) => {
      let isDup = false;

      // 1. Checa contra a Máquina Principal
      if (primaryMachineryId && veh.machineryId === primaryMachineryId) {
        isDup = true;
      }
      const currentPlate = normalizePlate(veh.plateOrSerial);
      if (primaryPlate && currentPlate && currentPlate === primaryPlate) {
        isDup = true;
      }

      // 2. Checa contra outras linhas de apoio
      assignedVehicles.forEach((otherVeh, otherIdx) => {
        if (otherIdx !== idx) {
          if (veh.machineryId && otherVeh.machineryId && veh.machineryId === otherVeh.machineryId) {
            isDup = true;
          }
          const otherPlate = normalizePlate(otherVeh.plateOrSerial);
          if (currentPlate && otherPlate && currentPlate === otherPlate) {
            isDup = true;
          }
        }
      });

      if (isDup) {
        dupIndices.add(idx);
      }
    });

    return dupIndices;
  }, [primaryMachineryId, assignedVehicles, availableMachineries]);

  const isPrimaryMachineryDuplicate = useMemo(() => {
    if (!primaryMachineryId) return false;
    const normalizePlate = (p?: string) => (p || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const primaryMach = availableMachineries.find(m => m.id === primaryMachineryId);
    const primaryPlate = normalizePlate(primaryMach?.licensePlateOrSerial || primaryMach?.serialNumber);

    return assignedVehicles.some(v => {
      if (v.machineryId && v.machineryId === primaryMachineryId) return true;
      const vPlate = normalizePlate(v.plateOrSerial);
      if (primaryPlate && vPlate && primaryPlate === vPlate) return true;
      return false;
    });
  }, [primaryMachineryId, assignedVehicles, availableMachineries]);

  // Manipulação de Veículos de Apoio (Caminhões e Tratores)
  const handleAddVehicle = (category: 'caminhao' | 'trator' | 'prancha') => {
    // Veículos já selecionados neste agendamento (máquina principal + frotas de apoio)
    const currentlySelectedIds = new Set<string>();
    if (primaryMachineryId) currentlySelectedIds.add(primaryMachineryId);
    assignedVehicles.forEach(v => {
      if (v.machineryId) currentlySelectedIds.add(v.machineryId);
    });

    // Acha um veículo adequado da frota não adicionado ainda neste agendamento
    const available = availableMachineries.filter(m => {
      if (category === 'caminhao') return isCaminhao(m);
      if (category === 'trator') return isTrator(m);
      return true;
    }).filter(m => !currentlySelectedIds.has(m.id));

    if (available.length === 0) {
      alert(`Todos os veículos da categoria ${category === 'caminhao' ? 'Caminhão' : 'Trator'} cadastrados na frota já estão escalados para este agendamento!`);
      return;
    }

    const selected = available[0];
    if (!selected) return;

    const prefix = selected.fleetNumber || selected.name || (category === 'caminhao' ? 'Caminhão' : 'Trator');
    const plate = selected.licensePlateOrSerial || selected.serialNumber || 'PLACA';

    // REGRA DE AUTOMAÇÃO (LOOKUP): Busca o motorista/condutor vinculado ao veículo em Frotas
    const linkedOp = findLinkedOperator(selected, employees);
    const driver = linkedOp.name || '';

    const newAssignment: AgendaVehicleAssignment = {
      machineryId: selected.id,
      prefix: prefix,
      plateOrSerial: plate,
      model: selected.model || selected.name || '',
      category: category,
      driverOrOperatorId: linkedOp.id || '',
      driverOrOperatorName: driver,
    };

    setAssignedVehicles([...assignedVehicles, newAssignment]);
  };

  const handleUpdateVehicle = (index: number, field: keyof AgendaVehicleAssignment, value: any) => {
    const updated = [...assignedVehicles];
    if (field === 'machineryId') {
      const selected = lookupFleetVehicle(value);
      if (selected) {
        // REGRA DE AUTOMAÇÃO (LOOKUP): Sempre que o usuário selecionar um veículo no campo "FROTA / PREFIXO & PLACA",
        // o campo "MOTORISTA / CONDUTOR" deve ser preenchido AUTOMATICAMENTE com o nome do motorista daquele veículo em frotas
        const linkedOp = findLinkedOperator(selected, employees);
        updated[index] = {
          ...updated[index],
          machineryId: selected.id,
          prefix: selected.fleetNumber || selected.name,
          plateOrSerial: selected.licensePlateOrSerial || selected.serialNumber || 'OFICIAL',
          model: selected.model || selected.name,
          driverOrOperatorId: linkedOp.id || '',
          driverOrOperatorName: linkedOp.name || '',
        };
      } else {
        updated[index] = {
          ...updated[index],
          machineryId: value,
        };
      }
    } else {
      // Permite que o usuário altere manualmente o nome do condutor caso outro vá dirigir
      updated[index] = { ...updated[index], [field]: value };
    }
    setAssignedVehicles(updated);
  };

  const handleRemoveVehicle = (index: number) => {
    setAssignedVehicles(assignedVehicles.filter((_, i) => i !== index));
  };

  // Salvar Agendamento com validação completa
  const handleSave = () => {
    if (!clientName.trim()) {
      alert('Por favor, informe o nome do Cliente / Produtor Rural.');
      return;
    }

    if (!primaryMachineryId) {
      alert('Por favor, selecione a Máquina Principal (Forrageira/Ensiladeira).');
      return;
    }

    if (duplicateVehicleIndices.size > 0 || isPrimaryMachineryDuplicate) {
      alert('Este veículo já está escalado para este agendamento!\nPor favor, altere ou remova os veículos repetidos antes de salvar.');
      return;
    }

    if (vehicleScheduleConflicts.length > 0 && !conflictWarningAck && !applyAutoShift) {
      alert('Atenção: Há sobreposição de horários para veículos nesta escala! Escolha a sugestão de próximo horário livre ou confirme o remanejamento.');
      return;
    }

    const primaryMach = availableMachineries.find(m => m.id === primaryMachineryId);
    const primaryOp = employees.find(e => e.id === primaryOperatorId);

    // Compila equipe completa
    const fullTeam: AgendaTeamMember[] = [];
    if (primaryOp) {
      fullTeam.push({
        employeeId: primaryOp.id,
        employeeName: primaryOp.name,
        role: 'Operador de Forrageira Principal',
        assignedVehiclePrefix: primaryMach?.fleetNumber || primaryMach?.name || 'Forrageira Principal',
      });
    }

    // Adiciona motoristas dos veículos de apoio
    assignedVehicles.forEach(v => {
      if (v.driverOrOperatorName) {
        fullTeam.push({
          employeeId: v.driverOrOperatorId || `temp-${Math.random()}`,
          employeeName: v.driverOrOperatorName,
          role: v.category === 'caminhao' ? 'Motorista de Caminhão Silagem' : 'Operador de Apoio',
          assignedVehiclePrefix: v.prefix,
        });
      }
    });

    const appointmentToSave: ServiceAppointment = {
      id: editAppointment?.id || `appt-${Date.now()}`,
      appointmentNumber: appointmentNumber.trim() || nextAppointmentNumber,
      clientId,
      clientName: clientName.trim(),
      farmName: farmName.trim(),
      locationCityState: locationCityState.trim(),
      contactPhone: contactPhone.trim(),
      serviceType,
      serviceTab: 'corte',
      startDate,
      startTime,
      travelTimeMinutes: typeof travelTimeMinutes === 'number' ? travelTimeMinutes : (parseInt(String(travelTimeMinutes)) || 0),
      trailerLoadingTimeMinutes: typeof trailerLoadingTimeMinutes === 'number' ? trailerLoadingTimeMinutes : (parseInt(String(trailerLoadingTimeMinutes)) || 0),
      areaUnit,
      estimatedQuantity: typeof estimatedQuantity === 'number' ? estimatedQuantity : (parseFloat(String(estimatedQuantity)) || 0),
      productivityRatePerHour: typeof productivityRatePerHour === 'number' ? productivityRatePerHour : (parseFloat(String(productivityRatePerHour)) || 0),
      executionTimeMinutes: executionMinutes,
      totalTimeMinutes: totalMinutes,
      endDate: calculatedEndDate || startDate,
      endTime: calculatedEndTime || startTime,

      primaryMachineryId,
      primaryMachineryPrefix: primaryMach?.fleetNumber || primaryMach?.name || 'Forrageira',
      primaryMachineryPlate: primaryMach?.licensePlateOrSerial || primaryMach?.serialNumber || 'OFICIAL',
      primaryMachineryModel: primaryMach?.model || primaryMach?.name || '',

      assignedVehicles,
      assignedTeam: fullTeam,

      status,
      fieldNotes: fieldNotes.trim(),
      createdAt: editAppointment?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    let cascadedUpdates: ServiceAppointment[] | undefined = undefined;
    if (applyAutoShift && cascadedDisplacements.length > 0) {
      cascadedUpdates = cascadedDisplacements.map(disp => ({
        ...disp.original,
        startDate: disp.newStartDate,
        startTime: disp.newStartTime,
        endDate: disp.newEndDate,
        endTime: disp.newEndTime,
        updatedAt: new Date().toISOString(),
      }));
    }

    onSave(appointmentToSave, cascadedUpdates);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 w-full max-w-4xl max-h-[94vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 dark:border-stone-800 bg-[#2e65aa] text-white rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/15 rounded-xl">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold flex items-center gap-2">
                <span>{editAppointment?.id ? 'Editar Agendamento de Serviço' : 'Novo Agendamento na Agenda'}</span>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-white/20 text-white font-bold">
                  {appointmentNumber || nextAppointmentNumber}
                </span>
              </h2>
              <p className="text-xs text-blue-100 font-medium mt-0.5">
                Cálculo de tempos logísticos, escala de veículos com placas/prefixos e controle de frotas sem sobreposição.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo do Formulário */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 text-stone-900 dark:text-stone-100">
          
          {/* ALERTA CRÍTICO: Conflito de Horário para o Mesmo Veículo */}
          {vehicleScheduleConflicts.length > 0 && (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border-2 border-red-500/80 text-red-900 dark:text-red-200 shadow-sm space-y-3">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-6 h-6 text-red-600 dark:text-red-400 shrink-0" />
                <h4 className="text-sm font-black uppercase tracking-tight text-red-800 dark:text-red-300">
                  ⚠️ Conflito de Horário Detectado para o Mesmo Veículo!
                </h4>
              </div>
              <p className="text-xs leading-relaxed font-medium">
                Os seguintes veículos desta escala já estão alocados em outro agendamento no mesmo período de tempo:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-xs font-bold">
                {vehicleScheduleConflicts.map((conf, i) => (
                  <li key={i}>
                    <span className="underline">{conf.vehicleName}</span> já está escalado para{' '}
                    <strong className="text-red-700 dark:text-red-300">{conf.conflictingAppointment.clientName}</strong> ({conf.conflictingAppointment.appointmentNumber}){' '}
                    em {formatDateBR(conf.conflictingAppointment.startDate)} das {conf.conflictingAppointment.startTime}h às {conf.conflictingAppointment.endTime || '—'}h.
                  </li>
                ))}
              </ul>

              {/* 1. Sugestão Inteligente de Próximo Horário Disponível */}
              {nextAvailableSlot && (
                <div className="pt-2 border-t border-red-200 dark:border-red-900/60 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleApplyNextAvailableSlot}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-white dark:bg-red-950 text-red-900 dark:text-red-100 border-2 border-red-400 dark:border-red-700 hover:bg-red-100/70 dark:hover:bg-red-900/80 rounded-lg text-xs font-black shadow-xs transition-colors cursor-pointer"
                    title="Ajustar automaticamente data e horário de início"
                  >
                    <span>💡 Agendar para o próximo horário disponível:</span>
                    <span className="underline font-mono bg-red-100 dark:bg-red-900/60 px-1.5 py-0.5 rounded">
                      {formatDateBR(nextAvailableSlot.date)} às {nextAvailableSlot.time}h
                    </span>
                  </button>
                </div>
              )}

              {/* 2. Lógica de Encaixe com Remanejamento Automático para Frente */}
              {cascadedDisplacements.length > 0 && (
                <div className="p-3 rounded-lg bg-white/90 dark:bg-red-950/70 border border-red-300 dark:border-red-800 space-y-2">
                  <div className="flex items-start gap-2">
                    <input 
                      type="checkbox"
                      id="apply-auto-shift"
                      checked={applyAutoShift}
                      onChange={(e) => {
                        setApplyAutoShift(e.target.checked);
                        if (e.target.checked) setConflictWarningAck(true);
                      }}
                      className="mt-0.5 rounded text-red-600 focus:ring-red-500 w-4 h-4 cursor-pointer shrink-0"
                    />
                    <div className="space-y-1 text-xs">
                      <label htmlFor="apply-auto-shift" className="font-black text-red-950 dark:text-red-100 cursor-pointer block leading-tight">
                        ⚠️ Esta ação irá deslocar os agendamentos seguintes desta máquina para frente. Deseja aplicar o remanejamento automático?
                      </label>
                      <p className="text-[11px] font-medium text-red-800 dark:text-red-300 leading-normal">
                        O sistema abrirá espaço para este serviço e empurrará o horário de início dos serviços seguintes na agenda daquela máquina para frente, recalculando o cronograma em cascata de forma atômica no banco de dados.
                      </p>
                    </div>
                  </div>

                  {applyAutoShift && (
                    <div className="mt-2 pt-2 border-t border-red-200 dark:border-red-800/60 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-bold text-red-900 dark:text-red-200 uppercase tracking-wide">
                        <span>Serviços que serão empurrados ({cascadedDisplacements.length}):</span>
                        <span>Novo Horário Previsto</span>
                      </div>
                      <div className="space-y-1 max-h-32 overflow-y-auto pr-0.5">
                        {cascadedDisplacements.map((disp, idx) => (
                          <div 
                            key={idx} 
                            className="flex items-center justify-between gap-2 p-1.5 rounded bg-white dark:bg-stone-900 border border-red-200 dark:border-red-900 text-[11px]"
                          >
                            <div className="truncate font-semibold text-stone-800 dark:text-stone-200">
                              <strong className="text-red-700 dark:text-red-400 font-mono">{disp.original.appointmentNumber}</strong>{' '}
                              <span>({disp.original.clientName || 'Cliente'})</span>
                            </div>
                            <div className="shrink-0 flex items-center gap-1.5 font-mono text-[11px]">
                              <span className="line-through text-stone-400 text-[10px]">{disp.original.startTime}h</span>
                              <span className="text-stone-400">➔</span>
                              <span className="font-bold text-red-700 dark:text-red-300">
                                {formatDateBR(disp.newStartDate)} às {disp.newStartTime}h
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Confirmação Manual de Remanejamento */}
              <div className="pt-1 flex items-center gap-2">
                <input 
                  type="checkbox"
                  id="ack-conflict"
                  checked={conflictWarningAck}
                  onChange={(e) => setConflictWarningAck(e.target.checked)}
                  className="rounded text-red-600 focus:ring-red-500 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="ack-conflict" className="text-xs font-semibold cursor-pointer text-stone-800 dark:text-stone-300">
                  Estou ciente da sobreposição e confirmo o remanejamento manual desta frota.
                </label>
              </div>
            </div>
          )}

          {/* 1. SEÇÃO: DADOS DO CLIENTE & LOCALIZAÇÃO */}
          <div className="bg-stone-50 dark:bg-stone-800/50 p-4 rounded-xl border border-stone-200 dark:border-stone-800 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center gap-2">
              <User className="w-4 h-4 text-[#2e65aa]" />
              <span>1. Cliente e Local da Operação</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Seleção de Cliente Existente ou Digitação */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Cliente / Produtor Rural <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <select
                    value={clientId}
                    onChange={(e) => handleClientChange(e.target.value)}
                    className="w-1/2 p-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-semibold text-stone-900 dark:text-stone-100"
                  >
                    <option value="">-- Puxar da Base de Clientes --</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.farmName ? `(${c.farmName})` : ''}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Nome do produtor / cliente..."
                    className="w-1/2 p-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-bold text-stone-900 dark:text-stone-100"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Fazenda / Propriedade
                </label>
                <input
                  type="text"
                  value={farmName}
                  onChange={(e) => setFarmName(e.target.value)}
                  placeholder="Ex: Fazenda Santa Maria"
                  className="w-full p-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-semibold text-stone-900 dark:text-stone-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Município / UF
                </label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 absolute left-2.5 top-3 text-stone-400" />
                  <input
                    type="text"
                    value={locationCityState}
                    onChange={(e) => setLocationCityState(e.target.value)}
                    placeholder="Ex: Cascavel - PR"
                    className="w-full pl-8 p-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-semibold text-stone-900 dark:text-stone-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Telefone / WhatsApp de Contato
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 absolute left-2.5 top-3 text-stone-400" />
                  <input
                    type="text"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="(45) 99999-9999"
                    className="w-full pl-8 p-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-semibold text-stone-900 dark:text-stone-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Tipo de Serviço Solicitado
                </label>
                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value as any)}
                  className="w-full p-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-bold text-[#2e65aa]"
                >
                  <option value="Corte / Ensilagem">Corte / Ensilagem</option>
                  <option value="Colheita">Colheita Agrícola</option>
                  <option value="Serviço de Trator">Serviço de Trator</option>
                  <option value="Serviço de Máquina">Serviço de Máquina</option>
                  <option value="Frete / Transporte">Frete / Transporte</option>
                </select>
              </div>
            </div>
          </div>

          {/* 2. SEÇÃO: CÁLCULO DE TEMPO TOTAL (DESLOCAMENTO + PRANCHA + EXECUÇÃO) */}
          <div className="bg-emerald-50/70 dark:bg-emerald-950/30 p-4 rounded-xl border border-emerald-300 dark:border-emerald-800 space-y-4">
            <div className="flex items-center justify-between border-b border-emerald-200 dark:border-emerald-800 pb-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-emerald-900 dark:text-emerald-300 flex items-center gap-2">
                <Calculator className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <span>2. Cronograma Logístico e Cálculo de Tempo Total</span>
              </h3>
              <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-400">
                Fórmula: Deslocamento + Prancha + (Área ÷ Rendimento)
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Data de Início
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full p-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-bold text-stone-900 dark:text-stone-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Horário de Saída / Início
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full p-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-bold text-stone-900 dark:text-stone-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Deslocamento (Minutos)
                </label>
                <input
                  type="number"
                  min="0"
                  step="5"
                  placeholder="0"
                  value={travelTimeMinutes}
                  onChange={(e) => setTravelTimeMinutes(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full p-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-semibold text-stone-900 dark:text-stone-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Tempo Prancha / Embarque (Min)
                </label>
                <input
                  type="number"
                  min="0"
                  step="5"
                  placeholder="0"
                  value={trailerLoadingTimeMinutes}
                  onChange={(e) => setTrailerLoadingTimeMinutes(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full p-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-semibold text-stone-900 dark:text-stone-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Unidade de Medida
                </label>
                <select
                  value={areaUnit}
                  onChange={(e) => setAreaUnit(e.target.value as any)}
                  className="w-full p-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-bold text-stone-900 dark:text-stone-100"
                >
                  <option value="hectares">Hectares (ha)</option>
                  <option value="alqueires">Alqueires (alq)</option>
                  <option value="horas">Horas de Trabalho (h)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Quantidade Prevista ({areaUnit === 'hectares' ? 'ha' : areaUnit === 'alqueires' ? 'alq' : 'h'})
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="0.0"
                  value={estimatedQuantity}
                  onChange={(e) => setEstimatedQuantity(e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full p-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-bold text-stone-900 dark:text-stone-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Rendimento Operacional ({areaUnit === 'hectares' ? 'ha/h' : areaUnit === 'alqueires' ? 'alq/h' : 'h/h'})
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="0.0"
                  value={productivityRatePerHour}
                  onChange={(e) => setProductivityRatePerHour(e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full p-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-bold text-stone-900 dark:text-stone-100"
                />
              </div>
            </div>

            {/* Painel do Resultado do Tempo Calculado */}
            {hasValidCalculation ? (
              <div className="p-3 bg-white dark:bg-stone-900 rounded-xl border border-emerald-300 dark:border-emerald-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center shadow-xs">
                <div>
                  <span className="block text-[10px] uppercase font-bold text-stone-500">Tempo de Execução</span>
                  <span className="text-sm font-black text-stone-900 dark:text-stone-100">
                    {Math.floor(executionMinutes / 60)}h {executionMinutes % 60}min
                  </span>
                  <span className="text-[10px] text-stone-400 block font-medium">({executionMinutes} min totais)</span>
                </div>

                <div>
                  <span className="block text-[10px] uppercase font-bold text-stone-500">Tempo Total Operacional</span>
                  <span className="text-sm font-black text-emerald-700 dark:text-emerald-400">
                    {Math.floor(totalMinutes / 60)}h {totalMinutes % 60}min
                  </span>
                  <span className="text-[10px] text-stone-400 block font-medium">Desloc + Prancha + Corte</span>
                </div>

                <div>
                  <span className="block text-[10px] uppercase font-bold text-stone-500">Data Término Previsto</span>
                  <span className="text-sm font-black text-stone-900 dark:text-stone-100">
                    {calculatedEndDate ? calculatedEndDate.split('-').reverse().join('/') : '—'}
                  </span>
                </div>

                <div>
                  <span className="block text-[10px] uppercase font-bold text-stone-500">Horário Término Previsto</span>
                  <span className="text-sm font-black text-[#2e65aa] dark:text-blue-400">
                    {calculatedEndTime ? `${calculatedEndTime}h` : '—'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-stone-50/80 dark:bg-stone-900/60 rounded-xl border border-dashed border-stone-300 dark:border-stone-700 flex flex-col items-center justify-center text-center">
                <div className="flex items-center gap-1.5 text-stone-600 dark:text-stone-400 font-bold text-xs">
                  <Clock className="w-4 h-4 text-stone-400" />
                  <span>Aguardando preenchimento de Quantidade Prevista e Rendimento Operacional</span>
                </div>
                <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                  Informe a quantidade e o rendimento para calcular automaticamente o tempo de execução e término previsto.
                </p>
              </div>
            )}
          </div>

          {/* 3. SEÇÃO: ESCALA DE FROTAS & VEÍCULOS RASTREADOS POR PLACA / PREFIXO */}
          <div className="bg-stone-50 dark:bg-stone-800/50 p-4 rounded-xl border border-stone-200 dark:border-stone-800 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-stone-800 dark:text-stone-200 flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#2e65aa]" />
                <span>3. Escala de Frotas & Veículos (Rastreados por Prefixo e Placa)</span>
              </h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleAddVehicle('caminhao')}
                  className="px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-900 dark:bg-blue-950 dark:text-blue-300 cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Caminhão</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddVehicle('trator')}
                  className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-amber-950 dark:text-amber-300 cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Trator</span>
                </button>
              </div>
            </div>

            {/* Máquina Principal (Forrageira / Ensiladeira) */}
            <div className="p-3 bg-white dark:bg-stone-900 rounded-lg border-2 border-emerald-500/60 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                  <Scissors className="w-4 h-4 text-emerald-600" />
                  <span>Máquina Principal (Ensiladeira / Forrageira) *</span>
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 uppercase">
                  Veículo Primário
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-400 mb-1">
                    Veículo / Prefixo e Placa
                  </label>
                  <select
                    value={primaryMachineryId}
                    onChange={(e) => handlePrimaryMachineryChange(e.target.value)}
                    className={`w-full p-2 bg-stone-50 dark:bg-stone-800 border ${
                      isPrimaryMachineryDuplicate ? 'border-red-500 ring-1 ring-red-500' : 'border-stone-300 dark:border-stone-700'
                    } rounded-lg text-xs font-extrabold text-stone-900 dark:text-stone-100`}
                    required
                  >
                    <option value="">-- Selecione a Máquina Principal --</option>
                    {availableMachineries
                      .filter(m => !supportVehicleIds.has(m.id) || m.id === primaryMachineryId)
                      .map(m => (
                        <option key={m.id} value={m.id}>
                          {m.fleetNumber ? `[${m.fleetNumber}] ` : ''}{formatMachineryOptionLabel(m)}
                        </option>
                      ))}
                  </select>
                  {isPrimaryMachineryDuplicate && (
                    <span className="text-[10px] font-bold text-red-600 dark:text-red-400 mt-1 block leading-tight">
                      Este veículo já está escalado para este agendamento!
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-400 mb-1">
                    Operador Principal Responsável
                  </label>
                  <select
                    value={primaryOperatorId}
                    onChange={(e) => setPrimaryOperatorId(e.target.value)}
                    className="w-full p-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-bold text-stone-900 dark:text-stone-100"
                  >
                    <option value="">-- Selecione o Operador --</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.role || 'Operador'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Lista de Veículos de Apoio Escalados */}
            <div className="space-y-2">
              <span className="text-[11px] font-extrabold uppercase text-stone-600 dark:text-stone-400 block">
                Frotas de Apoio Escaladas (Caminhões de Silagem & Tratores Compactadores):
              </span>

              {assignedVehicles.length === 0 ? (
                <div className="p-4 bg-white dark:bg-stone-900 rounded-lg border border-dashed border-stone-300 dark:border-stone-700 text-center text-xs text-stone-500">
                  Nenhum veículo de apoio adicionado. Clique nos botões acima para escalar caminhões e tratores por prefixo/placa.
                </div>
              ) : (
                assignedVehicles.map((veh, idx) => {
                  const isDuplicate = duplicateVehicleIndices.has(idx);

                  // Veículos selecionados em OUTRAS linhas ou na Máquina Principal
                  const otherSelectedVehicleIds = new Set<string>();
                  if (primaryMachineryId) otherSelectedVehicleIds.add(primaryMachineryId);
                  assignedVehicles.forEach((v, i) => {
                    if (i !== idx && v.machineryId) otherSelectedVehicleIds.add(v.machineryId);
                  });

                  return (
                    <div 
                      key={idx} 
                      className={`p-2.5 bg-white dark:bg-stone-900 rounded-lg border ${
                        isDuplicate ? 'border-red-400 dark:border-red-700 bg-red-50/20' : 'border-stone-300 dark:border-stone-700'
                      } grid grid-cols-1 sm:grid-cols-12 gap-2 items-center text-xs`}
                    >
                      <div className="sm:col-span-2">
                        <span className="font-bold text-[10px] uppercase text-stone-400 block">Tipo</span>
                        <span className={`inline-block font-extrabold px-1.5 py-0.5 rounded text-[10px] uppercase ${
                          veh.category === 'caminhao' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {veh.category === 'caminhao' ? 'Caminhão' : 'Trator'}
                        </span>
                      </div>

                      <div className="sm:col-span-4">
                        <span className="font-bold text-[10px] uppercase text-stone-400 block">Frota / Prefixo & Placa</span>
                        <select
                          value={veh.machineryId}
                          onChange={(e) => handleUpdateVehicle(idx, 'machineryId', e.target.value)}
                          className={`w-full p-1.5 bg-stone-50 dark:bg-stone-800 border ${
                            isDuplicate ? 'border-red-500 ring-1 ring-red-500' : 'border-stone-200 dark:border-stone-700'
                          } rounded text-xs font-bold`}
                        >
                          {availableMachineries
                            .filter(m => !otherSelectedVehicleIds.has(m.id) || m.id === veh.machineryId)
                            .map(m => (
                              <option key={m.id} value={m.id}>
                                {m.fleetNumber ? `[${m.fleetNumber}] ` : ''}{m.licensePlateOrSerial || m.serialNumber} - {m.model || m.name}
                              </option>
                            ))}
                        </select>
                        {isDuplicate && (
                          <span className="text-[10px] font-bold text-red-600 dark:text-red-400 mt-1 block leading-tight">
                            Este veículo já está escalado para este agendamento!
                          </span>
                        )}
                      </div>

                      <div className="sm:col-span-3">
                        <span className="font-bold text-[10px] uppercase text-stone-400 block">Placa / Prefixo Gravado</span>
                        <input
                          type="text"
                          value={veh.plateOrSerial}
                          onChange={(e) => handleUpdateVehicle(idx, 'plateOrSerial', e.target.value)}
                          className={`w-full p-1.5 bg-stone-50 dark:bg-stone-800 border ${
                            isDuplicate ? 'border-red-500 ring-1 ring-red-500' : 'border-stone-200 dark:border-stone-700'
                          } rounded text-xs font-mono font-bold`}
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <span className="font-bold text-[10px] uppercase text-stone-400 block">Motorista / Condutor</span>
                        <input
                          type="text"
                          value={veh.driverOrOperatorName || ''}
                          onChange={(e) => handleUpdateVehicle(idx, 'driverOrOperatorName', e.target.value)}
                          placeholder="Nome do motorista..."
                          className="w-full p-1.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded text-xs font-semibold"
                        />
                      </div>

                      <div className="sm:col-span-1 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveVehicle(idx)}
                          className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors cursor-pointer"
                          title="Remover veículo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 4. SEÇÃO: STATUS & OBSERVAÇÕES DE CAMPO */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                Status do Agendamento
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full p-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-bold"
              >
                <option value="agendado">Agendado</option>
                <option value="em_deslocamento">Em Deslocamento</option>
                <option value="em_execucao">Em Execução</option>
                <option value="concluido">Concluído</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                Instruções de Campo & Observações Técnicas
              </label>
              <input
                type="text"
                value={fieldNotes}
                onChange={(e) => setFieldNotes(e.target.value)}
                placeholder="Ex: Regular picado em 10mm, solo úmido na baixada, entrada pela porteira principal."
                className="w-full p-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-semibold text-stone-900 dark:text-stone-100"
              />
            </div>
          </div>

        </div>

        {/* Rodapé com Ações */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/60 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold rounded-lg border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white text-xs font-extrabold shadow-sm transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Salvar Agendamento</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
