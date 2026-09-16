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
import { isForrageira, isCaminhao, isTrator, formatMachineryOptionLabel, formatTruckOptionLabel } from './serviceHelpers';

interface AppointmentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (appointment: ServiceAppointment) => void;
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
  const [startTime, setStartTime] = useState('07:00');

  // 2. Parâmetros de Tempo e Rendimento
  const [travelTimeMinutes, setTravelTimeMinutes] = useState(60); // Deslocamento
  const [trailerLoadingTimeMinutes, setTrailerLoadingTimeMinutes] = useState(45); // Prancha
  const [areaUnit, setAreaUnit] = useState<'hectares' | 'alqueires' | 'horas'>('hectares');
  const [estimatedQuantity, setEstimatedQuantity] = useState(20); // Quantidade
  const [productivityRatePerHour, setProductivityRatePerHour] = useState(1.5); // Rendimento ha/h

  // 3. Frotas e Equipe Escalada
  const [primaryMachineryId, setPrimaryMachineryId] = useState('');
  const [primaryOperatorId, setPrimaryOperatorId] = useState('');
  const [assignedVehicles, setAssignedVehicles] = useState<AgendaVehicleAssignment[]>([]);
  const [assignedTeam, setAssignedTeam] = useState<AgendaTeamMember[]>([]);

  // 4. Status e Observações
  const [status, setStatus] = useState<'agendado' | 'em_deslocamento' | 'em_execucao' | 'concluido' | 'cancelado'>('agendado');
  const [fieldNotes, setFieldNotes] = useState('');

  // Erro ou conflito forçado
  const [conflictWarningAck, setConflictWarningAck] = useState(false);

  // Lista de máquinas disponíveis consolidando cadastro de frotas e sugestões padrão da frota
  const availableMachineries = useMemo(() => {
    const list: Machinery[] = [...machineries];
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
      setStartTime(editAppointment.startTime || '07:00');
      setTravelTimeMinutes(editAppointment.travelTimeMinutes ?? 60);
      setTrailerLoadingTimeMinutes(editAppointment.trailerLoadingTimeMinutes ?? 45);
      setAreaUnit(editAppointment.areaUnit || 'hectares');
      setEstimatedQuantity(editAppointment.estimatedQuantity || 20);
      setProductivityRatePerHour(editAppointment.productivityRatePerHour || 1.5);
      
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

      // Procura operador principal na equipe
      const op = editAppointment.assignedTeam?.find(t => t.role.toLowerCase().includes('forrageira') || t.role.toLowerCase().includes('principal'));
      if (op) setPrimaryOperatorId(op.employeeId);
    } else {
      setAppointmentNumber(nextAppointmentNumber);
      setClientId('');
      setClientName('');
      setFarmName('');
      setLocationCityState('');
      setContactPhone('');
      setServiceType('Corte / Ensilagem');
      setStartDate(new Date().toISOString().split('T')[0]);
      setStartTime('07:00');
      setTravelTimeMinutes(60);
      setTrailerLoadingTimeMinutes(45);
      setAreaUnit('hectares');
      setEstimatedQuantity(20);
      setProductivityRatePerHour(1.5);

      // Pré-seleciona a primeira forrageira disponível se houver
      const firstForr = availableMachineries.find(isForrageira) || availableMachineries[0];
      if (firstForr) {
        setPrimaryMachineryId(firstForr.id);
        const prefix = firstForr.fleetNumber || firstForr.name || 'Forrageira 01';
        const plate = firstForr.licensePlateOrSerial || firstForr.serialNumber || 'OFICIAL';
        const op = employees[0];
        setPrimaryOperatorId(op ? op.id : '');
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
  const { executionMinutes, totalMinutes, calculatedEndDate, calculatedEndTime } = useMemo(() => {
    const rate = productivityRatePerHour > 0 ? productivityRatePerHour : 1;
    const qty = estimatedQuantity > 0 ? estimatedQuantity : 0;
    const execMin = Math.round((qty / rate) * 60);
    const totMin = Math.max(0, (travelTimeMinutes || 0) + (trailerLoadingTimeMinutes || 0) + execMin);

    // Converte startDate + startTime para objeto Date e soma minutos
    const [year, month, day] = (startDate || '2026-09-18').split('-').map(Number);
    const [hours, minutes] = (startTime || '07:00').split(':').map(Number);

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
      calculatedEndTime: `${endH}:${endMin}`
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

    const currentStartMs = new Date(`${startDate}T${startTime}`).getTime();
    const currentEndMs = new Date(`${calculatedEndDate}T${calculatedEndTime}`).getTime();

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

      const otherStartMs = new Date(`${otherAppt.startDate}T${otherAppt.startTime}`).getTime();
      const otherEndMs = new Date(`${otherAppt.endDate}T${otherAppt.endTime}`).getTime();

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

  // Manipulação de Veículos de Apoio (Caminhões e Tratores)
  const handleAddVehicle = (category: 'caminhao' | 'trator' | 'prancha') => {
    // Acha um veículo adequado da frota não adicionado ainda
    const available = machineries.filter(m => {
      if (category === 'caminhao') return isCaminhao(m);
      if (category === 'trator') return isTrator(m);
      return true;
    }).filter(m => !allCurrentVehicleIds.includes(m.id));

    const selected = available[0] || machineries[0];
    if (!selected) return;

    const prefix = selected.fleetNumber || selected.name || (category === 'caminhao' ? 'Caminhão' : 'Trator');
    const plate = selected.licensePlateOrSerial || selected.serialNumber || 'PLACA';
    const driver = employees[0]?.name || '';

    const newAssignment: AgendaVehicleAssignment = {
      machineryId: selected.id,
      prefix: prefix,
      plateOrSerial: plate,
      model: selected.model || selected.name || '',
      category: category,
      driverOrOperatorName: driver,
    };

    setAssignedVehicles([...assignedVehicles, newAssignment]);
  };

  const handleUpdateVehicle = (index: number, field: keyof AgendaVehicleAssignment, value: any) => {
    const updated = [...assignedVehicles];
    if (field === 'machineryId') {
      const selected = machineries.find(m => m.id === value);
      if (selected) {
        updated[index] = {
          ...updated[index],
          machineryId: selected.id,
          prefix: selected.fleetNumber || selected.name,
          plateOrSerial: selected.licensePlateOrSerial || selected.serialNumber || 'OFICIAL',
          model: selected.model || selected.name,
        };
      }
    } else {
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

    if (vehicleScheduleConflicts.length > 0 && !conflictWarningAck) {
      alert('Atenção: Há sobreposição de horários para veículos nesta escala! Verifique o alerta em vermelho ou marque a ciência de ajuste.');
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
      travelTimeMinutes,
      trailerLoadingTimeMinutes,
      areaUnit,
      estimatedQuantity,
      productivityRatePerHour,
      executionTimeMinutes: executionMinutes,
      totalTimeMinutes: totalMinutes,
      endDate: calculatedEndDate,
      endTime: calculatedEndTime,

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

    onSave(appointmentToSave);
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
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border-2 border-red-500/80 text-red-900 dark:text-red-200 shadow-sm animate-pulse space-y-2">
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
                    em {conf.conflictingAppointment.startDate} das {conf.conflictingAppointment.startTime}h às {conf.conflictingAppointment.endTime}h.
                  </li>
                ))}
              </ul>
              <div className="pt-2 flex items-center gap-2">
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
                  value={travelTimeMinutes}
                  onChange={(e) => setTravelTimeMinutes(Math.max(0, parseInt(e.target.value) || 0))}
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
                  value={trailerLoadingTimeMinutes}
                  onChange={(e) => setTrailerLoadingTimeMinutes(Math.max(0, parseInt(e.target.value) || 0))}
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
                  min="0.1"
                  step="0.5"
                  value={estimatedQuantity}
                  onChange={(e) => setEstimatedQuantity(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full p-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-bold text-stone-900 dark:text-stone-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Rendimento Operacional ({areaUnit === 'hectares' ? 'ha/h' : areaUnit === 'alqueires' ? 'alq/h' : 'h/h'})
                </label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={productivityRatePerHour}
                  onChange={(e) => setProductivityRatePerHour(Math.max(0.1, parseFloat(e.target.value) || 1))}
                  className="w-full p-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-bold text-stone-900 dark:text-stone-100"
                />
              </div>
            </div>

            {/* Painel do Resultado do Tempo Calculado */}
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
                  {calculatedEndDate.split('-').reverse().join('/')}
                </span>
              </div>

              <div>
                <span className="block text-[10px] uppercase font-bold text-stone-500">Horário Término Previsto</span>
                <span className="text-sm font-black text-[#2e65aa] dark:text-blue-400">
                  {calculatedEndTime}h
                </span>
              </div>
            </div>
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
                    onChange={(e) => setPrimaryMachineryId(e.target.value)}
                    className="w-full p-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-extrabold text-stone-900 dark:text-stone-100"
                    required
                  >
                    <option value="">-- Selecione a Máquina Principal --</option>
                    {availableMachineries.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.fleetNumber ? `[${m.fleetNumber}] ` : ''}{formatMachineryOptionLabel(m)}
                      </option>
                    ))}
                  </select>
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
                assignedVehicles.map((veh, idx) => (
                  <div 
                    key={idx} 
                    className="p-2.5 bg-white dark:bg-stone-900 rounded-lg border border-stone-300 dark:border-stone-700 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center text-xs"
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
                        className="w-full p-1.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded text-xs font-bold"
                      >
                        {machineries.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.fleetNumber ? `[${m.fleetNumber}] ` : ''}{m.licensePlateOrSerial || m.serialNumber} - {m.model || m.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-3">
                      <span className="font-bold text-[10px] uppercase text-stone-400 block">Placa / Prefixo Gravado</span>
                      <input
                        type="text"
                        value={veh.plateOrSerial}
                        onChange={(e) => handleUpdateVehicle(idx, 'plateOrSerial', e.target.value)}
                        className="w-full p-1.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded text-xs font-mono font-bold"
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
                ))
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
