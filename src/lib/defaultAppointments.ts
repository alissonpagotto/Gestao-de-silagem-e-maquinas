import { ServiceAppointment } from '../types';

export const DEFAULT_INITIAL_APPOINTMENTS: ServiceAppointment[] = [];

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
