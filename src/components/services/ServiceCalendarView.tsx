import React, { useState, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Clock, 
  Scissors, 
  Edit, 
  Printer, 
  Plus, 
  MapPin, 
  Tractor,
  Truck,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { ServiceAppointment } from '../../types';

interface ServiceCalendarViewProps {
  appointments: ServiceAppointment[];
  onSelectAppointment: (appointment: ServiceAppointment) => void;
  onCreateAppointmentForDate?: (dateStr: string) => void;
  onExecuteService?: (appointment: ServiceAppointment) => void;
  onPrintAppointment?: (appointment: ServiceAppointment) => void;
  resolvePrimaryVehicleDisplay?: (appointment: ServiceAppointment) => string;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const WEEKDAY_NAMES_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WEEKDAY_NAMES_FULL = [
  'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
  'Quinta-feira', 'Sexta-feira', 'Sábado'
];

export const ServiceCalendarView: React.FC<ServiceCalendarViewProps> = ({
  appointments,
  onSelectAppointment,
  onCreateAppointmentForDate,
  onExecuteService,
  onPrintAppointment,
  resolvePrimaryVehicleDisplay,
}) => {
  // Modo de visualização interna do calendário: Diário, Semanal, Mensal, Anual
  const [calendarMode, setCalendarMode] = useState<'diario' | 'semanal' | 'mensal' | 'anual'>('mensal');

  // Inicialização inteligente da data: se houver agendamentos, abre no mês do primeiro agendamento
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    if (appointments && appointments.length > 0) {
      const firstDateStr = appointments[0].startDate;
      if (firstDateStr && /^\d{4}-\d{2}-\d{2}$/.test(firstDateStr)) {
        const [y, m, d] = firstDateStr.split('-').map(Number);
        return new Date(y, m - 1, d);
      }
    }
    return new Date();
  });

  // Helpers de formatação de data
  const formatIsoDate = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getMachineDisplay = (a: ServiceAppointment): string => {
    if (resolvePrimaryVehicleDisplay) {
      const res = resolvePrimaryVehicleDisplay(a);
      if (res && res !== 'NÃO DEFINIDO') return res;
    }
    return a.primaryMachineryPrefix || a.primaryMachineryModel || 'Máquina Principal';
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'em_execucao':
      case 'em_deslocamento':
        return {
          bg: 'bg-emerald-50 dark:bg-emerald-950/40',
          text: 'text-emerald-900 dark:text-emerald-200',
          border: 'border-emerald-300 dark:border-emerald-700',
          dot: 'bg-emerald-500 animate-pulse',
          label: 'Em Campo',
        };
      case 'agendado':
        return {
          bg: 'bg-amber-50 dark:bg-amber-950/40',
          text: 'text-amber-900 dark:text-amber-200',
          border: 'border-amber-300 dark:border-amber-700',
          dot: 'bg-amber-500',
          label: 'Agendado',
        };
      case 'concluido':
        return {
          bg: 'bg-blue-50 dark:bg-blue-950/40',
          text: 'text-blue-900 dark:text-blue-200',
          border: 'border-blue-300 dark:border-blue-700',
          dot: 'bg-blue-500',
          label: 'Concluído',
        };
      case 'cancelado':
        return {
          bg: 'bg-rose-50 dark:bg-rose-950/40',
          text: 'text-rose-900 dark:text-rose-200',
          border: 'border-rose-300 dark:border-rose-700 line-through opacity-70',
          dot: 'bg-rose-500',
          label: 'Cancelado',
        };
      default:
        return {
          bg: 'bg-stone-50 dark:bg-stone-800',
          text: 'text-stone-800 dark:text-stone-200',
          border: 'border-stone-300 dark:border-stone-700',
          dot: 'bg-stone-400',
          label: status,
        };
    }
  };

  // Funções de Navegação
  const handlePrev = () => {
    const newDate = new Date(currentDate);
    if (calendarMode === 'diario') {
      newDate.setDate(newDate.getDate() - 1);
    } else if (calendarMode === 'semanal') {
      newDate.setDate(newDate.getDate() - 7);
    } else if (calendarMode === 'mensal') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else if (calendarMode === 'anual') {
      newDate.setFullYear(newDate.getFullYear() - 1);
    }
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (calendarMode === 'diario') {
      newDate.setDate(newDate.getDate() + 1);
    } else if (calendarMode === 'semanal') {
      newDate.setDate(newDate.getDate() + 7);
    } else if (calendarMode === 'mensal') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else if (calendarMode === 'anual') {
      newDate.setFullYear(newDate.getFullYear() + 1);
    }
    setCurrentDate(newDate);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Título e subtexto do período atual
  const periodHeader = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    if (calendarMode === 'diario') {
      const weekday = WEEKDAY_NAMES_FULL[currentDate.getDay()];
      const day = currentDate.getDate();
      return `${weekday}, ${day} de ${MONTH_NAMES[month]} de ${year}`;
    }

    if (calendarMode === 'semanal') {
      // Início e fim da semana atual (domingo a sábado)
      const dayOfWeek = currentDate.getDay();
      const start = new Date(currentDate);
      start.setDate(currentDate.getDate() - dayOfWeek);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);

      const sDay = start.getDate();
      const sMonth = MONTH_NAMES[start.getMonth()].slice(0, 3);
      const eDay = end.getDate();
      const eMonth = MONTH_NAMES[end.getMonth()].slice(0, 3);

      return `Semana de ${sDay} ${sMonth} a ${eDay} ${eMonth} de ${year}`;
    }

    if (calendarMode === 'mensal') {
      return `${MONTH_NAMES[month]} de ${year}`;
    }

    return `Ano de ${year}`;
  }, [calendarMode, currentDate]);

  // Agendamentos mapeados por data no formato YYYY-MM-DD
  const appointmentsByDate = useMemo(() => {
    const map: Record<string, ServiceAppointment[]> = {};
    appointments.forEach(app => {
      const d = app.startDate;
      if (!map[d]) map[d] = [];
      map[d].push(app);
    });

    // Ordena por horário de início em cada dia
    Object.keys(map).forEach(key => {
      map[key].sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
    });

    return map;
  }, [appointments]);

  // Dias para o grid mensal (incluindo dias do mês anterior e posterior para fechar as semanas)
  const monthCalendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const startDayOfWeek = firstDayOfMonth.getDay(); // 0 = Domingo
    const totalDays = lastDayOfMonth.getDate();

    const days: { date: Date; dateStr: string; isCurrentMonth: boolean; isToday: boolean }[] = [];

    const todayStr = formatIsoDate(new Date());

    // Dias do mês anterior
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      const str = formatIsoDate(d);
      days.push({
        date: d,
        dateStr: str,
        isCurrentMonth: false,
        isToday: str === todayStr,
      });
    }

    // Dias do mês atual
    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(year, month, i);
      const str = formatIsoDate(d);
      days.push({
        date: d,
        dateStr: str,
        isCurrentMonth: true,
        isToday: str === todayStr,
      });
    }

    // Dias do mês seguinte para completar as linhas de 7 colunas (até 35 ou 42)
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const str = formatIsoDate(d);
      days.push({
        date: d,
        dateStr: str,
        isCurrentMonth: false,
        isToday: str === todayStr,
      });
    }

    return days;
  }, [currentDate]);

  // Dias para a visão semanal (7 dias de domingo a sábado)
  const weekCalendarDays = useMemo(() => {
    const dayOfWeek = currentDate.getDay();
    const start = new Date(currentDate);
    start.setDate(currentDate.getDate() - dayOfWeek);

    const todayStr = formatIsoDate(new Date());
    const days: { date: Date; dateStr: string; isToday: boolean }[] = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const str = formatIsoDate(d);
      days.push({
        date: d,
        dateStr: str,
        isToday: str === todayStr,
      });
    }

    return days;
  }, [currentDate]);

  return (
    <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs overflow-hidden flex flex-col">
      {/* 1. BARRA DE NAVEGAÇÃO E CONTROLES SUPERIORES DO CALENDÁRIO */}
      <div className="p-3 sm:p-4 border-b border-stone-200 dark:border-stone-800 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-stone-50/50 dark:bg-stone-850/50">
        {/* Lado Esquerdo: Navegação de Período e Título */}
        <div className="flex items-center flex-wrap gap-2 sm:gap-3">
          {/* Botões de Avanço / Recuo */}
          <div className="flex items-center gap-1 bg-white dark:bg-stone-800 p-1 rounded-xl border border-stone-200 dark:border-stone-700 shadow-2xs">
            <button
              type="button"
              onClick={handlePrev}
              className="p-1.5 rounded-lg text-stone-600 hover:text-stone-900 dark:text-stone-300 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors cursor-pointer"
              title="Período Anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="px-2.5 py-1 text-xs font-bold text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-lg transition-colors cursor-pointer"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="p-1.5 rounded-lg text-stone-600 hover:text-stone-900 dark:text-stone-300 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors cursor-pointer"
              title="Próximo Período"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Nome do Período Atual */}
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-[#2e65aa] dark:text-blue-400" />
            <span className="text-sm sm:text-base font-black text-stone-900 dark:text-stone-100 tracking-tight">
              {periodHeader}
            </span>
          </div>
        </div>

        {/* Lado Direito: Alternância de Modo [Diário] [Semanal] [Mensal] [Anual] */}
        <div className="flex items-center gap-1 bg-white dark:bg-stone-800 p-1 rounded-xl border border-stone-200 dark:border-stone-700 shadow-2xs self-start md:self-auto">
          <button
            type="button"
            onClick={() => setCalendarMode('diario')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer select-none ${
              calendarMode === 'diario'
                ? 'bg-[#0f2d59] text-white shadow-sm border border-[#0b2140] dark:bg-[#1e40af] dark:border-blue-600'
                : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-700 font-bold border border-transparent'
            }`}
          >
            Diário
          </button>
          <button
            type="button"
            onClick={() => setCalendarMode('semanal')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer select-none ${
              calendarMode === 'semanal'
                ? 'bg-[#0f2d59] text-white shadow-sm border border-[#0b2140] dark:bg-[#1e40af] dark:border-blue-600'
                : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-700 font-bold border border-transparent'
            }`}
          >
            Semanal
          </button>
          <button
            type="button"
            onClick={() => setCalendarMode('mensal')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer select-none ${
              calendarMode === 'mensal'
                ? 'bg-[#0f2d59] text-white shadow-sm border border-[#0b2140] dark:bg-[#1e40af] dark:border-blue-600'
                : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-700 font-bold border border-transparent'
            }`}
          >
            Mensal
          </button>
          <button
            type="button"
            onClick={() => setCalendarMode('anual')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer select-none ${
              calendarMode === 'anual'
                ? 'bg-[#0f2d59] text-white shadow-sm border border-[#0b2140] dark:bg-[#1e40af] dark:border-blue-600'
                : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-700 font-bold border border-transparent'
            }`}
          >
            Anual
          </button>
        </div>
      </div>

      {/* 2. CONTEÚDO DO CALENDÁRIO CONFORME MODO SELECIONADO */}

      {/* ========================================================================= */}
      {/* 2.1 VISÃO MENSAL (Padrão e Mais Utilizada) */}
      {/* ========================================================================= */}
      {calendarMode === 'mensal' && (
        <div className="flex flex-col">
          {/* Cabeçalho dos dias da semana (DOM - SÁB) */}
          <div className="grid grid-cols-7 border-b border-stone-200 dark:border-stone-800 bg-stone-100/70 dark:bg-stone-800/80 text-center py-2 text-[11px] font-black uppercase text-stone-600 dark:text-stone-300 tracking-wider">
            {WEEKDAY_NAMES_SHORT.map((name, i) => (
              <div key={name} className={i === 0 || i === 6 ? 'text-amber-700 dark:text-amber-400' : ''}>
                {name}
              </div>
            ))}
          </div>

          {/* Grid dos Dias do Mês */}
          <div className="grid grid-cols-7 divide-x divide-y divide-stone-200 dark:divide-stone-800 border-b border-stone-200 dark:border-stone-800">
            {monthCalendarDays.map(item => {
              const dayAppointments = appointmentsByDate[item.dateStr] || [];
              const hasAppointments = dayAppointments.length > 0;

              return (
                <div
                  key={item.dateStr}
                  onClick={() => {
                    if (onCreateAppointmentForDate) {
                      onCreateAppointmentForDate(item.dateStr);
                    }
                  }}
                  className={`min-h-[105px] sm:min-h-[120px] p-1.5 flex flex-col justify-between transition-colors relative group ${
                    !item.isCurrentMonth
                      ? 'bg-stone-50/40 dark:bg-stone-900/30 text-stone-400 dark:text-stone-600'
                      : 'bg-white dark:bg-stone-900 hover:bg-stone-50/70 dark:hover:bg-stone-800/40'
                  } ${item.isToday ? 'ring-1 ring-inset ring-blue-500/50 bg-blue-50/20 dark:bg-blue-950/20' : ''}`}
                >
                  {/* Topo do Card do Dia: Botão de adicionar e Número do dia */}
                  <div className="flex items-center justify-between mb-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onCreateAppointmentForDate) {
                          onCreateAppointmentForDate(item.dateStr);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-stone-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-all cursor-pointer"
                      title={`Novo agendamento em ${item.dateStr}`}
                    >
                      <Plus className="w-3 h-3" />
                    </button>

                    <span
                      className={`text-xs font-extrabold px-1.5 py-0.5 rounded-full inline-block ${
                        item.isToday
                          ? 'bg-[#2e65aa] text-white shadow-2xs font-black'
                          : item.isCurrentMonth
                          ? 'text-stone-700 dark:text-stone-300'
                          : 'text-stone-400 dark:text-stone-600'
                      }`}
                    >
                      {item.date.getDate()}
                    </span>
                  </div>

                  {/* Lista de Tags de Agendamentos do Dia */}
                  <div className="flex-1 flex flex-col gap-1 overflow-y-auto max-h-[85px] no-scrollbar">
                    {dayAppointments.map(app => {
                      const cfg = getStatusConfig(app.status);
                      const machDisplay = getMachineDisplay(app);

                      return (
                        <div
                          key={app.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectAppointment(app);
                          }}
                          className={`w-full text-left px-2 py-1 rounded-md border text-[10px] leading-tight font-medium cursor-pointer transition-all hover:scale-[1.01] hover:shadow-sm ${cfg.bg} ${cfg.text} ${cfg.border} flex flex-col gap-0.5`}
                          title={`Clique para visualizar ou editar o agendamento de ${app.clientName}`}
                        >
                          {/* Linha compacta conforme especificado: [Hora de Início] - [Nome do Cliente] - [Máquina Principal] */}
                          <div className="flex items-center gap-1 font-bold">
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} shrink-0`} />
                            <span className="font-mono text-[9.5px] font-black">{app.startTime || '08:00'}</span>
                            <span className="truncate">{app.clientName}</span>
                          </div>

                          <div className="text-[9px] truncate font-mono opacity-85 pl-2.5">
                            {machDisplay}
                          </div>
                        </div>
                      );
                    })}

                    {!hasAppointments && (
                      <div className="flex-1 flex items-center justify-center opacity-0 group-hover:opacity-40 transition-opacity">
                        <span className="text-[9px] font-medium text-stone-400">+ agendar</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2.2 VISÃO SEMANAL (Coluna para cada um dos 7 dias com cards detalhados) */}
      {/* ========================================================================= */}
      {calendarMode === 'semanal' && (
        <div className="flex flex-col">
          {/* Cabeçalho da Semana */}
          <div className="grid grid-cols-7 border-b border-stone-200 dark:border-stone-800 bg-stone-100/70 dark:bg-stone-800/80 text-center py-2.5">
            {weekCalendarDays.map((item, idx) => {
              const dayAppointments = appointmentsByDate[item.dateStr] || [];
              const weekday = WEEKDAY_NAMES_SHORT[item.date.getDay()];

              return (
                <div key={item.dateStr} className="flex flex-col items-center gap-0.5 px-1">
                  <span className="text-[11px] font-black uppercase text-stone-600 dark:text-stone-400">
                    {weekday}
                  </span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      item.isToday
                        ? 'bg-[#2e65aa] text-white font-black shadow-xs'
                        : 'text-stone-800 dark:text-stone-200'
                    }`}
                  >
                    {item.date.getDate()}
                  </span>
                  <span className="text-[9px] font-semibold text-stone-500">
                    {dayAppointments.length} {dayAppointments.length === 1 ? 'serviço' : 'serviços'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Colunas dos 7 Dias da Semana */}
          <div className="grid grid-cols-7 divide-x divide-stone-200 dark:divide-stone-800 min-h-[380px] bg-stone-50/20 dark:bg-stone-900/20">
            {weekCalendarDays.map(item => {
              const dayAppointments = appointmentsByDate[item.dateStr] || [];

              return (
                <div
                  key={item.dateStr}
                  className={`p-2 flex flex-col gap-2 ${
                    item.isToday ? 'bg-blue-50/20 dark:bg-blue-950/15' : ''
                  }`}
                >
                  {dayAppointments.length === 0 ? (
                    <div
                      onClick={() => onCreateAppointmentForDate && onCreateAppointmentForDate(item.dateStr)}
                      className="h-36 rounded-xl border border-dashed border-stone-200 dark:border-stone-800 flex flex-col items-center justify-center p-2 text-center text-stone-400 hover:text-stone-600 hover:border-stone-300 dark:hover:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-850 transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4 mb-1 opacity-60" />
                      <span className="text-[10px] font-bold">Sem serviços</span>
                      <span className="text-[8.5px] opacity-70">+ Agendar</span>
                    </div>
                  ) : (
                    dayAppointments.map(app => {
                      const cfg = getStatusConfig(app.status);
                      const machDisplay = getMachineDisplay(app);

                      return (
                        <div
                          key={app.id}
                          className={`rounded-xl border p-2.5 shadow-2xs flex flex-col gap-1.5 transition-all hover:shadow-sm ${cfg.bg} ${cfg.border}`}
                        >
                          {/* Horário e Status */}
                          <div className="flex items-center justify-between gap-1 text-[10px] font-bold">
                            <span className="flex items-center gap-1 font-mono text-stone-800 dark:text-stone-200">
                              <Clock className="w-3 h-3 text-stone-400" />
                              {app.startTime}h {app.endTime ? `- ${app.endTime}h` : ''}
                            </span>
                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${cfg.text}`}>
                              {cfg.label}
                            </span>
                          </div>

                          {/* Cliente e Fazenda */}
                          <div className="leading-tight">
                            <div className="font-extrabold text-xs text-stone-900 dark:text-stone-100 truncate">
                              {app.clientName}
                            </div>
                            <div className="text-[10px] text-stone-500 dark:text-stone-400 truncate flex items-center gap-0.5 mt-0.5">
                              <MapPin className="w-2.5 h-2.5 shrink-0" />
                              {app.farmName || app.locationCityState || 'Sede'}
                            </div>
                          </div>

                          {/* Máquina Principal */}
                          <div className="bg-white/80 dark:bg-stone-800/80 rounded-md px-1.5 py-1 border border-stone-200/80 dark:border-stone-700 text-[10px] font-mono font-bold text-stone-800 dark:text-stone-200 truncate">
                            {machDisplay}
                          </div>

                          {/* Volume / Área */}
                          <div className="text-[10px] font-bold text-stone-700 dark:text-stone-300">
                            {app.estimatedQuantity ? `${app.estimatedQuantity} ${app.areaUnit === 'alqueires' ? 'alq' : 'ha'}` : '—'}
                          </div>

                          {/* Ações Rápidas */}
                          <div className="flex items-center justify-between gap-1 pt-1 border-t border-stone-200/60 dark:border-stone-700/60 mt-0.5">
                            {onExecuteService && app.status !== 'concluido' && (
                              <button
                                type="button"
                                onClick={() => onExecuteService(app)}
                                className="px-2 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[9.5px] rounded transition-colors flex items-center gap-1 cursor-pointer"
                                title="Puxar serviço para o corte"
                              >
                                <Scissors className="w-2.5 h-2.5" />
                                Puxar
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => onSelectAppointment(app)}
                              className="px-2 py-1 bg-white dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 border border-stone-300 dark:border-stone-600 text-stone-700 dark:text-stone-200 font-bold text-[9.5px] rounded transition-colors flex items-center gap-1 cursor-pointer ml-auto"
                            >
                              <Edit className="w-2.5 h-2.5" />
                              Editar
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2.3 VISÃO DIÁRIA (Foco nos agendamentos detalhados do dia selecionado) */}
      {/* ========================================================================= */}
      {calendarMode === 'diario' && (
        <div className="p-4 flex flex-col gap-4">
          {/* Card Resumo do Dia */}
          <div className="bg-stone-50 dark:bg-stone-850 p-3.5 rounded-xl border border-stone-200 dark:border-stone-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold uppercase text-stone-500 dark:text-stone-400 block">
                Agendamentos do Dia
              </span>
              <h3 className="text-base font-black text-stone-900 dark:text-stone-100">
                {formatIsoDate(currentDate)} ({WEEKDAY_NAMES_FULL[currentDate.getDay()]})
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-stone-200 dark:bg-stone-700 text-stone-800 dark:text-stone-200 font-mono">
                {(appointmentsByDate[formatIsoDate(currentDate)] || []).length} operações
              </span>
              {onCreateAppointmentForDate && (
                <button
                  type="button"
                  onClick={() => onCreateAppointmentForDate(formatIsoDate(currentDate))}
                  className="px-3 py-1.5 bg-[#0f2d59] hover:bg-[#1a4279] dark:bg-[#1e40af] text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agendar para este Dia
                </button>
              )}
            </div>
          </div>

          {/* Lista de Agendamentos do Dia Selecionado */}
          <div className="flex flex-col gap-2.5">
            {(!appointmentsByDate[formatIsoDate(currentDate)] || appointmentsByDate[formatIsoDate(currentDate)].length === 0) ? (
              <div className="py-12 text-center rounded-xl border border-dashed border-stone-200 dark:border-stone-800 bg-stone-50/40 dark:bg-stone-900/40">
                <CalendarIcon className="w-8 h-8 mx-auto text-stone-400 mb-2 opacity-60" />
                <p className="text-xs font-bold text-stone-600 dark:text-stone-400">
                  Nenhum serviço agrícola agendado para esta data.
                </p>
                <p className="text-[11px] text-stone-400 mt-1">
                  Clique no botão acima para adicionar um novo agendamento neste dia.
                </p>
              </div>
            ) : (
              appointmentsByDate[formatIsoDate(currentDate)].map(app => {
                const cfg = getStatusConfig(app.status);
                const machDisplay = getMachineDisplay(app);

                return (
                  <div
                    key={app.id}
                    className="p-3.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 hover:border-stone-300 dark:hover:border-stone-700 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors"
                  >
                    {/* Informações Principais */}
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 rounded-xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 flex flex-col items-center justify-center min-w-[64px]">
                        <Clock className="w-4 h-4 text-[#2e65aa] dark:text-blue-400 mb-0.5" />
                        <span className="text-xs font-black font-mono text-stone-900 dark:text-stone-100">
                          {app.startTime}h
                        </span>
                        {app.endTime && (
                          <span className="text-[9px] font-mono text-stone-500">
                            até {app.endTime}h
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-stone-400">
                            {app.appointmentNumber}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[9.5px] font-black uppercase border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                            {cfg.label}
                          </span>
                        </div>

                        <h4 className="text-sm font-black text-stone-900 dark:text-stone-100">
                          {app.clientName}
                        </h4>

                        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-stone-600 dark:text-stone-400">
                          <span className="flex items-center gap-1 font-medium">
                            <MapPin className="w-3 h-3 text-stone-400" />
                            {app.farmName || app.locationCityState || 'Local não informado'}
                          </span>
                          <span>•</span>
                          <span className="font-bold text-stone-800 dark:text-stone-200">
                            {app.estimatedQuantity ? `${app.estimatedQuantity} ${app.areaUnit === 'alqueires' ? 'alqueires (alq)' : 'hectares (ha)'}` : 'Área não definida'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Máquina e Frota */}
                    <div className="flex flex-col md:items-end gap-1.5 border-t md:border-t-0 pt-2 md:pt-0 border-stone-100 dark:border-stone-800">
                      <div className="flex items-center gap-1.5">
                        <Tractor className="w-3.5 h-3.5 text-stone-500" />
                        <span className="text-xs font-mono font-extrabold text-stone-900 dark:text-stone-100 bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded border border-stone-200 dark:border-stone-700">
                          {machDisplay}
                        </span>
                      </div>

                      {app.assignedVehicles && app.assignedVehicles.length > 0 && (
                        <div className="flex items-center gap-1 text-[11px] text-stone-500">
                          <Truck className="w-3 h-3" />
                          <span>{app.assignedVehicles.length} veículos de apoio na frota</span>
                        </div>
                      )}

                      {/* Botões de Ação */}
                      <div className="flex items-center gap-1.5 mt-1">
                        {onExecuteService && app.status !== 'concluido' && (
                          <button
                            type="button"
                            onClick={() => onExecuteService(app)}
                            className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                          >
                            <Scissors className="w-3 h-3" />
                            Puxar Corte
                          </button>
                        )}
                        {onPrintAppointment && (
                          <button
                            type="button"
                            onClick={() => onPrintAppointment(app)}
                            className="p-1.5 text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors border border-stone-200 dark:border-stone-700 cursor-pointer"
                            title="Imprimir Ordem"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onSelectAppointment(app)}
                          className="px-2.5 py-1 bg-white dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 border border-stone-300 dark:border-stone-600 text-stone-800 dark:text-stone-200 font-bold text-xs rounded-lg transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                        >
                          <Edit className="w-3 h-3" />
                          Editar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2.4 VISÃO ANUAL (12 mini-calendários dos meses para visão panorâmica) */}
      {/* ========================================================================= */}
      {calendarMode === 'anual' && (
        <div className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {MONTH_NAMES.map((mName, mIdx) => {
              const year = currentDate.getFullYear();
              const firstDay = new Date(year, mIdx, 1);
              const lastDay = new Date(year, mIdx + 1, 0);
              const startDay = firstDay.getDay();
              const total = lastDay.getDate();

              // Total de agendamentos neste mês
              const monthPrefix = `${year}-${String(mIdx + 1).padStart(2, '0')}`;
              const monthAppts = appointments.filter(a => a.startDate.startsWith(monthPrefix));

              return (
                <div
                  key={mName}
                  onClick={() => {
                    const d = new Date(year, mIdx, 1);
                    setCurrentDate(d);
                    setCalendarMode('mensal');
                  }}
                  className="rounded-xl border border-stone-200 dark:border-stone-800 p-3 bg-stone-50/50 dark:bg-stone-850/40 hover:bg-stone-100/70 dark:hover:bg-stone-800/60 transition-all cursor-pointer shadow-2xs flex flex-col"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-black text-xs text-stone-900 dark:text-stone-100">
                      {mName}
                    </span>
                    {monthAppts.length > 0 && (
                      <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                        {monthAppts.length} {monthAppts.length === 1 ? 'serviço' : 'serviços'}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-7 text-center text-[9px] font-bold text-stone-400 mb-1">
                    {WEEKDAY_NAMES_SHORT.map(w => (
                      <span key={w}>{w[0]}</span>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 text-center text-[10px] gap-y-1">
                    {Array.from({ length: startDay }).map((_, i) => (
                      <span key={`empty-${i}`} className="opacity-0">0</span>
                    ))}
                    {Array.from({ length: total }).map((_, i) => {
                      const dayNum = i + 1;
                      const dateStr = `${monthPrefix}-${String(dayNum).padStart(2, '0')}`;
                      const hasAppts = Boolean(appointmentsByDate[dateStr]?.length);

                      return (
                        <span
                          key={dayNum}
                          className={`font-semibold py-0.5 rounded-full inline-block ${
                            hasAppts
                              ? 'bg-amber-400 text-stone-900 font-black shadow-xs'
                              : 'text-stone-600 dark:text-stone-400'
                          }`}
                        >
                          {dayNum}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
