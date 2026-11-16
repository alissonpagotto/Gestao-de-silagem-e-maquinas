import { Employee, WorkScheduleDay, WorkScheduleItem } from '../types';

export const WORK_SCHEDULES_STORAGE_KEY = 'agrocontrol_escalas_trabalho';
export const WORK_SCHEDULES_UPDATED_EVENT = 'agrocontrol_escalas_trabalho_updated';

export const ALL_WORK_SCHEDULE_DAYS: WorkScheduleDay[] = [
  'Seg',
  'Ter',
  'Qua',
  'Qui',
  'Sex',
  'Sáb',
  'Dom',
];

export const DEFAULT_WORK_SCHEDULES: WorkScheduleItem[] = [
  {
    id: 'esc_comercial_0730',
    name: 'Comercial Padrão',
    startTime: '07:30',
    endTime: '17:30',
    breakInterval: '12:00 às 13:12',
    weeklyHours: '44h',
    daysOfWeek: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'],
  },
  {
    id: 'esc_administrativo_0800',
    name: 'Comercial Administrativo',
    startTime: '08:00',
    endTime: '18:00',
    breakInterval: '12:00 às 13:30',
    weeklyHours: '44h',
    daysOfWeek: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'],
  },
  {
    id: 'esc_safra_campo',
    name: 'Escala Safra / Operacional',
    startTime: '06:00',
    endTime: '18:00',
    breakInterval: '1h30 (flexível)',
    weeklyHours: '44h',
    daysOfWeek: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
  },
  {
    id: 'esc_turno_12x36',
    name: 'Turno 12x36',
    startTime: '07:00',
    endTime: '19:00',
    breakInterval: '1h00',
    weeklyHours: '36h',
    daysOfWeek: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],
  },
];

export function formatWorkScheduleDaysSummary(days: WorkScheduleDay[]): string {
  if (!Array.isArray(days) || days.length === 0) return '';
  const ordered = ALL_WORK_SCHEDULE_DAYS.filter((d) => days.includes(d));
  if (ordered.length === 7) return 'Seg a Dom';
  if (
    ordered.length === 5 &&
    ordered[0] === 'Seg' &&
    ordered[1] === 'Ter' &&
    ordered[2] === 'Qua' &&
    ordered[3] === 'Qui' &&
    ordered[4] === 'Sex'
  ) {
    return 'Seg a Sex';
  }
  if (
    ordered.length === 6 &&
    ordered[0] === 'Seg' &&
    ordered[1] === 'Ter' &&
    ordered[2] === 'Qua' &&
    ordered[3] === 'Qui' &&
    ordered[4] === 'Sex' &&
    ordered[5] === 'Sáb'
  ) {
    return 'Seg a Sáb';
  }
  return ordered.join(', ');
}

export function formatWorkScheduleLabel(schedule: WorkScheduleItem): string {
  const cleanName = (schedule.name || '').trim();
  const timeRange =
    schedule.startTime && schedule.endTime
      ? `${schedule.startTime} às ${schedule.endTime}`
      : (schedule.startTime || schedule.endTime || '').trim();
  const daysSummary = formatWorkScheduleDaysSummary(schedule.daysOfWeek || []);
  const detailParts = [timeRange, daysSummary].filter(Boolean).join(' - ');
  if (cleanName && detailParts) {
    return `${cleanName} (${detailParts})`;
  }
  return cleanName || detailParts || '';
}

export function getStoredWorkSchedules(): WorkScheduleItem[] {
  try {
    const raw = localStorage.getItem(WORK_SCHEDULES_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(WORK_SCHEDULES_STORAGE_KEY, JSON.stringify(DEFAULT_WORK_SCHEDULES));
      return DEFAULT_WORK_SCHEDULES.map((item) => ({ ...item, daysOfWeek: [...item.daysOfWeek] }));
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(WORK_SCHEDULES_STORAGE_KEY, JSON.stringify(DEFAULT_WORK_SCHEDULES));
      return DEFAULT_WORK_SCHEDULES.map((item) => ({ ...item, daysOfWeek: [...item.daysOfWeek] }));
    }
    return parsed
      .filter((item) => item && typeof item === 'object' && String(item.name || '').trim())
      .map((item) => ({
        id: String(item.id || `esc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`),
        name: String(item.name || '').trim(),
        startTime: String(item.startTime || '').trim(),
        endTime: String(item.endTime || '').trim(),
        breakInterval: String(item.breakInterval || '').trim(),
        weeklyHours: String(item.weeklyHours || '').trim(),
        daysOfWeek: Array.isArray(item.daysOfWeek)
          ? ALL_WORK_SCHEDULE_DAYS.filter((d) => item.daysOfWeek.includes(d))
          : [],
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }));
  } catch {
    return DEFAULT_WORK_SCHEDULES.map((item) => ({ ...item, daysOfWeek: [...item.daysOfWeek] }));
  }
}

export function saveStoredWorkSchedules(list: WorkScheduleItem[]): void {
  try {
    localStorage.setItem(WORK_SCHEDULES_STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent(WORK_SCHEDULES_UPDATED_EVENT, { detail: list }));
  } catch (err) {
    console.warn('[RH] Erro ao salvar escalas de trabalho:', err);
  }
}

export function isEmployeeActiveForSchedule(emp: Employee): boolean {
  if (!emp) return false;
  const st = String(emp.status || '').toLowerCase().trim();
  if (
    emp.active === false ||
    st === 'inativo' ||
    st === 'inativo_sazonal' ||
    st === 'inativo (sazonal)' ||
    st === 'fora_periodo' ||
    st === 'fora de período' ||
    st === 'demitido' ||
    st === 'desligado' ||
    st === 'excluido' ||
    Boolean(emp.terminationDate)
  ) {
    return false;
  }
  return true;
}

export function doesEmployeeMatchWorkSchedule(emp: Employee, schedule: WorkScheduleItem): boolean {
  if (!emp || !schedule) return false;
  if (emp.workScheduleId && emp.workScheduleId === schedule.id) return true;
  const empScheduleText = String(emp.workSchedule || emp.jornada_trabalho || '')
    .trim()
    .toLowerCase();
  if (!empScheduleText) return false;

  const formattedLabel = formatWorkScheduleLabel(schedule).toLowerCase();
  if (empScheduleText === formattedLabel) return true;

  const scaleName = (schedule.name || '').trim().toLowerCase();
  if (scaleName && (empScheduleText === scaleName || empScheduleText.startsWith(`${scaleName} (`))) {
    return true;
  }

  // Retrocompatibilidade com os rótulos iniciais antes do gerenciador dinâmico
  if (schedule.id === 'esc_comercial_0730' && empScheduleText.includes('07:30 às 17:30')) return true;
  if (schedule.id === 'esc_administrativo_0800' && empScheduleText.includes('08:00 às 18:00')) return true;
  if (schedule.id === 'esc_safra_campo' && empScheduleText.includes('escala safra')) return true;
  if (schedule.id === 'esc_turno_12x36' && empScheduleText.includes('12x36')) return true;

  return false;
}
