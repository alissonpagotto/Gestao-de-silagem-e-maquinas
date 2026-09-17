import { ServiceAppointment } from '../types';

export const DEFAULT_INITIAL_APPOINTMENTS: ServiceAppointment[] = [
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
    estimatedQuantity: 15,
    productivityRatePerHour: 1.6,
    executionTimeMinutes: 562, 
    totalTimeMinutes: 664, 
    endDate: '2026-09-18',
    endTime: '16:10',
    primaryMachineryId: 'mach-01',
    primaryMachineryPrefix: 'MAQ-01 - John Deere 8500i',
    primaryMachineryPlate: 'MAQ-01',
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
    areaUnit: 'alqueires',
    estimatedQuantity: 10,
    productivityRatePerHour: 1.5,
    executionTimeMinutes: 462, 
    totalTimeMinutes: 562,
    endDate: '2026-09-20',
    endTime: '17:22',
    primaryMachineryId: 'mach-02',
    primaryMachineryPrefix: 'MAQ-02 - CLAAS JAGUAR 860',
    primaryMachineryPlate: 'MAQ-02',
    primaryMachineryModel: 'CLAAS JAGUAR 860',
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

/**
 * Busca agendamento por ID ou por appointmentNumber (ex: 'AG-2026-002' ou 'appt-initial-02')
 * Busca no localStorage e, caso não encontre ou esteja vazio, consulta DEFAULT_INITIAL_APPOINTMENTS.
 */
export function findAppointmentByIdOrNumber(idOrNumber: string, storedList?: ServiceAppointment[]): ServiceAppointment | undefined {
  if (!idOrNumber) return undefined;
  const clean = idOrNumber.trim().toLowerCase();

  const listToSearch: ServiceAppointment[] = [];
  if (storedList && storedList.length > 0) {
    listToSearch.push(...storedList);
  }

  // Tenta ler do localStorage se estiver em ambiente de navegador
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('silagem_appointments');
      if (raw) {
        const parsed: ServiceAppointment[] = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach(p => {
            if (!listToSearch.some(item => item.id === p.id)) {
              listToSearch.push(p);
            }
          });
        }
      }
    } catch (e) {
      console.error('Error reading appointments from storage', e);
    }
  }

  // Adiciona os padrões caso não estejam na lista
  DEFAULT_INITIAL_APPOINTMENTS.forEach(def => {
    if (!listToSearch.some(item => item.id === def.id || item.appointmentNumber === def.appointmentNumber)) {
      listToSearch.push(def);
    }
  });

  // 1. Match exato pelo número (ex: AG-2026-002)
  let found = listToSearch.find(a => a.appointmentNumber?.toLowerCase().trim() === clean);
  if (found) return found;

  // 2. Match exato pelo ID (ex: appt-initial-02)
  found = listToSearch.find(a => a.id?.toLowerCase().trim() === clean);
  if (found) return found;

  // 3. Match parcial se conter o número ou dígitos
  found = listToSearch.find(a => 
    a.appointmentNumber?.toLowerCase().replace(/[^a-z0-9]/g, '') === clean.replace(/[^a-z0-9]/g, '')
  );
  if (found) return found;

  // 4. Match por includes
  found = listToSearch.find(a => 
    a.appointmentNumber?.toLowerCase().includes(clean) || 
    clean.includes(a.appointmentNumber?.toLowerCase() || '____')
  );

  return found;
}
