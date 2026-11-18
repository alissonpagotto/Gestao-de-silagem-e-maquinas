import React, { useMemo, useState } from 'react';
import {
  Clock,
  Plus,
  Edit3,
  Trash2,
  Users,
  Check,
  X,
  CalendarDays,
  Timer,
} from 'lucide-react';
import { Employee, WorkScheduleDay, WorkScheduleItem } from '../../types';
import {
  ALL_WORK_SCHEDULE_DAYS,
  DEFAULT_WORK_SCHEDULES,
  doesEmployeeMatchWorkSchedule,
  formatWorkScheduleDaysSummary,
  formatWorkScheduleLabel,
  isEmployeeActiveForSchedule,
  saveStoredWorkSchedules,
} from '../../lib/workSchedulesStorage';
import { useConfirm } from '../../context/ConfirmContext';

interface WorkSchedulesManagerProps {
  schedules: WorkScheduleItem[];
  employees: Employee[];
  onSchedulesChange?: (next: WorkScheduleItem[]) => void;
  onSelectSchedule?: (schedule: WorkScheduleItem) => void;
  selectedScheduleId?: string;
  selectedScheduleText?: string;
  isModalContext?: boolean;
}

export const WorkSchedulesManager: React.FC<WorkSchedulesManagerProps> = ({
  schedules,
  employees,
  onSchedulesChange,
  onSelectSchedule,
  selectedScheduleId,
  selectedScheduleText,
  isModalContext = false,
}) => {
  const { confirm } = useConfirm();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);

  const [name, setName] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('07:30');
  const [endTime, setEndTime] = useState<string>('17:30');
  const [breakInterval, setBreakInterval] = useState<string>('12:00 às 13:12');
  const [weeklyHours, setWeeklyHours] = useState<string>('44h');
  const [daysOfWeek, setDaysOfWeek] = useState<WorkScheduleDay[]>(['Seg', 'Ter', 'Qua', 'Qui', 'Sex']);
  const [formError, setFormError] = useState<string>('');

  const activeEmployees = useMemo(
    () => (employees || []).filter(isEmployeeActiveForSchedule),
    [employees]
  );

  const linkedByScheduleId = useMemo(() => {
    const map: Record<string, Employee[]> = {};
    schedules.forEach((scale) => {
      map[scale.id] = activeEmployees.filter((emp) => doesEmployeeMatchWorkSchedule(emp, scale));
    });
    return map;
  }, [schedules, activeEmployees]);

  const totalLinkedActive = useMemo(() => {
    const seenIds = new Set<string>();
    Object.values(linkedByScheduleId).forEach((list) => {
      list.forEach((emp) => seenIds.add(emp.id));
    });
    return seenIds.size;
  }, [linkedByScheduleId]);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setStartTime('07:30');
    setEndTime('17:30');
    setBreakInterval('12:00 às 13:12');
    setWeeklyHours('44h');
    setDaysOfWeek(['Seg', 'Ter', 'Qua', 'Qui', 'Sex']);
    setFormError('');
  };

  const handleStartNew = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleStartEdit = (scale: WorkScheduleItem) => {
    setEditingId(scale.id);
    setName(scale.name || '');
    setStartTime(scale.startTime || '');
    setEndTime(scale.endTime || '');
    setBreakInterval(scale.breakInterval || '');
    setWeeklyHours(scale.weeklyHours || '');
    setDaysOfWeek(Array.isArray(scale.daysOfWeek) ? [...scale.daysOfWeek] : []);
    setFormError('');
    setIsFormOpen(true);
  };

  const handleToggleDay = (day: WorkScheduleDay) => {
    setDaysOfWeek((prev) => {
      const exists = prev.includes(day);
      const next = exists ? prev.filter((d) => d !== day) : [...prev, day];
      return ALL_WORK_SCHEDULE_DAYS.filter((d) => next.includes(d));
    });
  };

  const handleSaveSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setFormError('Informe o nome da escala ou turno.');
      return;
    }
    if (!startTime.trim() || !endTime.trim()) {
      setFormError('Informe os horários de entrada e saída.');
      return;
    }

    const nowIso = new Date().toISOString();
    let updatedList: WorkScheduleItem[];

    if (editingId) {
      updatedList = schedules.map((item) =>
        item.id === editingId
          ? {
              ...item,
              name: cleanName,
              startTime: startTime.trim(),
              endTime: endTime.trim(),
              breakInterval: breakInterval.trim(),
              weeklyHours: weeklyHours.trim(),
              daysOfWeek: [...daysOfWeek],
              updatedAt: nowIso,
            }
          : item
      );
    } else {
      const newItem: WorkScheduleItem = {
        id: `esc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: cleanName,
        startTime: startTime.trim(),
        endTime: endTime.trim(),
        breakInterval: breakInterval.trim(),
        weeklyHours: weeklyHours.trim(),
        daysOfWeek: [...daysOfWeek],
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      updatedList = [...schedules, newItem];
    }

    saveStoredWorkSchedules(updatedList);
    onSchedulesChange?.(updatedList);
    resetForm();
    setIsFormOpen(false);
  };

  const handleDeleteSchedule = async (scale: WorkScheduleItem) => {
    const linkedCount = (linkedByScheduleId[scale.id] || []).length;
    const confirmed = await confirm({
      title: 'Excluir Escala de Trabalho',
      message:
        linkedCount > 0
          ? `A escala "${scale.name}" possui ${linkedCount} funcionário(s) ativo(s) vinculado(s). Deseja removê-la da lista de escalas disponíveis? (Os dados já salvos nos colaboradores serão preservados.)`
          : `Deseja excluir a escala "${scale.name}"?`,
      confirmLabel: 'Excluir Escala',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });

    if (!confirmed) return;

    const updatedList = schedules.filter((item) => item.id !== scale.id);
    saveStoredWorkSchedules(updatedList);
    onSchedulesChange?.(updatedList);

    if (editingId === scale.id) {
      resetForm();
      setIsFormOpen(false);
    }
  };

  const handleRestoreDefaults = async () => {
    const confirmed = await confirm({
      title: 'Restaurar Escalas Padrão',
      message: 'Deseja adicionar novamente as escalas padrão que não estiverem na lista atual?',
      confirmLabel: 'Restaurar Padrões',
      cancelLabel: 'Cancelar',
      variant: 'primary',
    });
    if (!confirmed) return;

    const existingIds = new Set(schedules.map((s) => s.id));
    const existingNames = new Set(schedules.map((s) => String(s.name ?? '').trim().toLowerCase()));
    const missingDefaults = DEFAULT_WORK_SCHEDULES.filter(
      (def) => !existingIds.has(def.id) && !existingNames.has(String(def.name ?? '').trim().toLowerCase())
    );
    const merged = [...schedules, ...missingDefaults];
    saveStoredWorkSchedules(merged);
    onSchedulesChange?.(merged);
  };

  const previewLabel = formatWorkScheduleLabel({
    id: editingId || 'preview',
    name: name.trim() || 'Nome da Escala',
    startTime: startTime.trim(),
    endTime: endTime.trim(),
    breakInterval: breakInterval.trim(),
    weeklyHours: weeklyHours.trim(),
    daysOfWeek,
  });

  return (
    <div className={isModalContext ? 'flex flex-col gap-3' : 'flex-1 min-h-0 h-full max-h-full flex flex-col gap-3 overflow-hidden'}>
      {/* Cabeçalho Oficial da Sub-aba / Gerenciador */}
      <div className="shrink-0 bg-[#e0e6f1] border border-black rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <Clock className="w-4 h-4 text-black shrink-0" />
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wide text-black">
              ⏰ Escalas &amp; Horários de Trabalho
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white text-black border border-black/30">
              {schedules.length} ESCALA{schedules.length === 1 ? '' : 'S'} CADASTRADA{schedules.length === 1 ? '' : 'S'}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-400">
              {totalLinkedActive} ATIVO{totalLinkedActive === 1 ? '' : 'S'} VINCULADO{totalLinkedActive === 1 ? '' : 'S'}
            </span>
          </div>
          <p className="text-[11px] font-medium text-stone-700">
            Cadastre e personalize turnos operacionais, horários de entrada/saída, intervalo e carga horária para seleção rápida no cadastro de colaboradores.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {schedules.length < DEFAULT_WORK_SCHEDULES.length && (
            <button
              type="button"
              onClick={handleRestoreDefaults}
              className="px-2.5 py-1.5 rounded-lg border border-gray-500 bg-white hover:bg-slate-100 text-black text-[11px] font-bold uppercase transition cursor-pointer"
            >
              Restaurar Padrões
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (isFormOpen && !editingId) {
                setIsFormOpen(false);
              } else {
                handleStartNew();
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0963cb] hover:bg-[#074fa5] text-white text-xs font-bold uppercase border border-[#06458f] shadow-xs transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nova Escala / Turno</span>
          </button>
        </div>
      </div>

      {/* Formulário de Criação / Edição de Escala */}
      {isFormOpen && (
        <form
          onSubmit={handleSaveSchedule}
          className="shrink-0 bg-[#e0e6f1] border border-black rounded-xl p-3.5 space-y-3 shadow-xs"
        >
          <div className="flex items-center justify-between pb-1.5 border-b border-black/15">
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-[#0963cb]" />
              <h4 className="text-xs font-black uppercase tracking-wider text-black">
                {editingId ? 'Editar Escala / Turno de Trabalho' : 'Cadastrar Nova Escala / Turno'}
              </h4>
            </div>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setIsFormOpen(false);
              }}
              className="p-1 rounded-md hover:bg-black/10 text-black cursor-pointer"
              title="Fechar formulário"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {formError && (
            <div className="px-3 py-1.5 rounded-lg bg-rose-100 border border-rose-400 text-rose-900 text-xs font-bold">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="sm:col-span-2 lg:col-span-2">
              <label htmlFor="work-scale-name" className="block text-xs font-bold text-black mb-1">
                Nome da Escala / Turno <span className="text-rose-600">*</span>
              </label>
              <input
                id="work-scale-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (formError) setFormError('');
                }}
                placeholder="Ex: Comercial Padrão, Escala Safra / Campo, Turno 12x36"
                className="w-full px-3 py-1.5 bg-white border border-gray-400 rounded-lg text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[#0963cb]"
                required
              />
            </div>

            <div>
              <label htmlFor="work-scale-start" className="block text-xs font-bold text-black mb-1">
                Horário de Entrada <span className="text-rose-600">*</span>
              </label>
              <input
                id="work-scale-start"
                type="time"
                value={startTime}
                onChange={(e) => {
                  setStartTime(e.target.value);
                  if (formError) setFormError('');
                }}
                className="w-full px-2.5 py-1.5 bg-white border border-gray-400 rounded-lg text-black text-xs sm:text-sm font-mono font-bold focus:outline-none focus:ring-1 focus:ring-[#0963cb]"
                required
              />
            </div>

            <div>
              <label htmlFor="work-scale-end" className="block text-xs font-bold text-black mb-1">
                Horário de Saída <span className="text-rose-600">*</span>
              </label>
              <input
                id="work-scale-end"
                type="time"
                value={endTime}
                onChange={(e) => {
                  setEndTime(e.target.value);
                  if (formError) setFormError('');
                }}
                className="w-full px-2.5 py-1.5 bg-white border border-gray-400 rounded-lg text-black text-xs sm:text-sm font-mono font-bold focus:outline-none focus:ring-1 focus:ring-[#0963cb]"
                required
              />
            </div>

            <div>
              <label htmlFor="work-scale-break" className="block text-xs font-bold text-black mb-1">
                Intervalo / Almoço
              </label>
              <input
                id="work-scale-break"
                type="text"
                value={breakInterval}
                onChange={(e) => setBreakInterval(e.target.value)}
                placeholder="Ex: 12:00 às 13:30 ou 1h30"
                className="w-full px-3 py-1.5 bg-white border border-gray-400 rounded-lg text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[#0963cb]"
              />
            </div>

            <div>
              <label htmlFor="work-scale-weekly" className="block text-xs font-bold text-black mb-1">
                Carga Horária Semanal
              </label>
              <input
                id="work-scale-weekly"
                type="text"
                value={weeklyHours}
                onChange={(e) => setWeeklyHours(e.target.value)}
                placeholder="Ex: 44h, 40h, 36h"
                className="w-full px-3 py-1.5 bg-white border border-gray-400 rounded-lg text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[#0963cb]"
              />
            </div>
          </div>

          {/* Dias da Semana Aplicáveis */}
          <div className="bg-white/80 border border-gray-400 rounded-lg p-2.5 space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-black flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-[#0963cb]" />
                <span>Dias da Semana Aplicáveis</span>
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setDaysOfWeek(['Seg', 'Ter', 'Qua', 'Qui', 'Sex'])}
                  className="text-[10px] font-bold px-2 py-0.5 rounded border border-gray-300 bg-white hover:bg-slate-100 text-stone-700 cursor-pointer"
                >
                  Seg a Sex
                </button>
                <button
                  type="button"
                  onClick={() => setDaysOfWeek(['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'])}
                  className="text-[10px] font-bold px-2 py-0.5 rounded border border-gray-300 bg-white hover:bg-slate-100 text-stone-700 cursor-pointer"
                >
                  Seg a Sáb
                </button>
                <button
                  type="button"
                  onClick={() => setDaysOfWeek([...ALL_WORK_SCHEDULE_DAYS])}
                  className="text-[10px] font-bold px-2 py-0.5 rounded border border-gray-300 bg-white hover:bg-slate-100 text-stone-700 cursor-pointer"
                >
                  Todos os Dias
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-0.5">
              {ALL_WORK_SCHEDULE_DAYS.map((day) => {
                const checked = daysOfWeek.includes(day);
                return (
                  <label
                    key={day}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-bold cursor-pointer select-none transition ${
                      checked
                        ? 'bg-[#0963cb] text-white border-[#06458f] shadow-2xs'
                        : 'bg-white text-black border-gray-400 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggleDay(day)}
                      className="sr-only"
                    />
                    <span>{day}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
            <div className="text-[11px] font-medium text-stone-800">
              <span className="font-bold text-black">Texto aplicado na ficha:</span>{' '}
              <span className="font-semibold text-[#0963cb]">{previewLabel}</span>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setIsFormOpen(false);
                }}
                className="px-3 py-1.5 rounded-lg border border-gray-400 bg-white hover:bg-gray-100 text-black text-xs font-bold uppercase cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase border border-emerald-700 shadow-xs transition cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{editingId ? 'Salvar Alterações' : 'Cadastrar Escala'}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Lista / Quadro Oficial de Escalas Cadastradas */}
      <div className="flex-1 min-h-0 flex flex-col bg-[#e0e6f1] border border-black rounded-xl overflow-hidden">
        {schedules.length === 0 ? (
          <div className="p-6 text-center space-y-2 bg-white/70">
            <p className="text-xs font-bold text-black uppercase">
              Nenhuma escala de trabalho cadastrada.
            </p>
            <button
              type="button"
              onClick={handleStartNew}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0963cb] text-white text-xs font-bold uppercase cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Criar Primeira Escala</span>
            </button>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-20 bg-[#cad4e6] border-b border-black text-black uppercase text-[10px] font-black tracking-wider">
                <tr>
                  <th className="py-2 px-3">Nome da Escala / Turno</th>
                  <th className="py-2 px-3 whitespace-nowrap">Entrada / Saída</th>
                  <th className="py-2 px-3 whitespace-nowrap">Intervalo / Almoço</th>
                  <th className="py-2 px-3 whitespace-nowrap text-center">Carga Semanal</th>
                  <th className="py-2 px-3">Dias Aplicáveis</th>
                  <th className="py-2 px-3 whitespace-nowrap text-center">Funcionários Ativos</th>
                  <th className="py-2 px-3 text-right whitespace-nowrap">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/15 bg-white">
                {schedules.map((scale) => {
                  const linkedEmps = linkedByScheduleId[scale.id] || [];
                  const linkedCount = linkedEmps.length;
                  const scaleLabel = formatWorkScheduleLabel(scale);
                  const isCurrentlySelected =
                    Boolean(isModalContext) &&
                    (selectedScheduleId === scale.id ||
                      (selectedScheduleText && selectedScheduleText.trim() === scaleLabel));

                  return (
                    <tr
                      key={scale.id}
                      className={`transition ${
                        isCurrentlySelected ? 'bg-sky-50/90' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-2 px-3 align-middle">
                        <div className="font-bold text-black text-xs sm:text-sm">
                          {scale.name}
                        </div>
                        <div className="text-[10px] text-stone-600 font-medium">
                          {scaleLabel}
                        </div>
                      </td>

                      <td className="py-2 px-3 align-middle whitespace-nowrap font-mono font-bold text-black">
                        {scale.startTime || '--:--'} às {scale.endTime || '--:--'}
                      </td>

                      <td className="py-2 px-3 align-middle whitespace-nowrap text-stone-700 font-medium">
                        {scale.breakInterval || 'Não informado'}
                      </td>

                      <td className="py-2 px-3 align-middle whitespace-nowrap text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#e0e6f1] border border-black/30 text-black font-bold text-[11px]">
                          {scale.weeklyHours || '—'}
                        </span>
                      </td>

                      <td className="py-2 px-3 align-middle">
                        <div className="flex flex-wrap gap-1">
                          {(scale.daysOfWeek || []).length > 0 ? (
                            scale.daysOfWeek.map((day) => (
                              <span
                                key={day}
                                className="px-1.5 py-0.2 rounded bg-slate-100 border border-slate-300 text-black text-[10px] font-bold"
                              >
                                {day}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] text-stone-500">
                              {formatWorkScheduleDaysSummary(scale.daysOfWeek || []) || 'Não definido'}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-2 px-3 align-middle text-center">
                        <div
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                            linkedCount > 0
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : 'bg-slate-100 text-slate-600 border-slate-300'
                          }`}
                          title={
                            linkedCount > 0
                              ? linkedEmps.map((e) => e.name).join(', ')
                              : 'Nenhum funcionário ativo vinculado'
                          }
                        >
                          <Users className="w-3 h-3 shrink-0" />
                          <span>
                            {linkedCount} {linkedCount === 1 ? 'ativo' : 'ativos'}
                          </span>
                        </div>
                      </td>

                      <td className="py-2 px-3 align-middle text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {isModalContext && onSelectSchedule && (
                            <button
                              type="button"
                              onClick={() => onSelectSchedule(scale)}
                              className={`px-2 py-1 rounded text-[11px] font-bold uppercase border transition cursor-pointer ${
                                isCurrentlySelected
                                  ? 'bg-[#0963cb] text-white border-[#06458f]'
                                  : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700'
                              }`}
                            >
                              {isCurrentlySelected ? 'Selecionada' : 'Usar Escala'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleStartEdit(scale)}
                            className="p-1.5 rounded border border-gray-400 bg-white hover:bg-sky-50 text-black hover:text-[#0963cb] transition cursor-pointer"
                            title="Editar escala"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteSchedule(scale)}
                            className="p-1.5 rounded border border-gray-400 bg-white hover:bg-rose-50 text-rose-600 hover:text-rose-700 transition cursor-pointer"
                            title="Excluir escala"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
