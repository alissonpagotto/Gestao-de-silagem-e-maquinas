import React, { useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  BarChart2, 
  Sprout, 
  Calendar as CalendarIcon,
  PieChart as PieIcon,
  Layers,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';
import { Expense, SilageOrder, ServiceOrder, FuelLog } from '../../types';
import { formatCurrencyBRL } from '../../lib/storage';

interface ReportsDashboardTabProps {
  expenses: Expense[];
  orders: SilageOrder[];
  services: ServiceOrder[];
  fuelLogs?: FuelLog[];
  quickPeriod: 'mes_atual' | '1_mes' | '3_meses' | '6_meses' | '12_meses';
  onQuickPeriodChange: (p: 'mes_atual' | '1_mes' | '3_meses' | '6_meses' | '12_meses') => void;
  startDate: string;
  endDate: string;
  onStartDateChange: (d: string) => void;
  onEndDateChange: (d: string) => void;
  selectedMonthName: string;
  selectedYear: number;
}

export const ReportsDashboardTab: React.FC<ReportsDashboardTabProps> = ({
  expenses,
  orders,
  services,
  fuelLogs = [],
  quickPeriod,
  onQuickPeriodChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  selectedMonthName,
  selectedYear,
}) => {
  // Current Month Data (Row 1)
  const currentMonthStart = `${selectedYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;
  const currentMonthEnd = `${selectedYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}-31`;

  const currentMonthEntradas = useMemo(() => {
    const ordersRev = orders
      .filter(o => o.deliveryDate >= currentMonthStart && o.deliveryDate <= currentMonthEnd && o.status !== 'cancelado')
      .reduce((sum, o) => sum + o.totalAmount, 0);
    const servicesRev = services
      .filter(s => s.startDate >= currentMonthStart && s.startDate <= currentMonthEnd && s.status !== 'cancelado')
      .reduce((sum, s) => sum + s.totalAmount, 0);
    return ordersRev + servicesRev;
  }, [orders, services, currentMonthStart, currentMonthEnd]);

  const currentMonthSaidas = useMemo(() => {
    return expenses
      .filter(e => e.dueDate >= currentMonthStart && e.dueDate <= currentMonthEnd)
      .reduce((sum, e) => sum + e.amount, 0);
  }, [expenses, currentMonthStart, currentMonthEnd]);

  const currentMonthSaldo = currentMonthEntradas - currentMonthSaidas;

  // Filtered Period Data (Row 2)
  const periodEntradas = useMemo(() => {
    const ordersRev = orders
      .filter(o => o.deliveryDate >= startDate && o.deliveryDate <= endDate && o.status !== 'cancelado')
      .reduce((sum, o) => sum + o.totalAmount, 0);
    const servicesRev = services
      .filter(s => s.startDate >= startDate && s.startDate <= endDate && s.status !== 'cancelado')
      .reduce((sum, s) => sum + s.totalAmount, 0);
    return ordersRev + servicesRev;
  }, [orders, services, startDate, endDate]);

  const periodSaidas = useMemo(() => {
    return expenses
      .filter(e => e.dueDate >= startDate && e.dueDate <= endDate)
      .reduce((sum, e) => sum + e.amount, 0);
  }, [expenses, startDate, endDate]);

  const periodSaldo = periodEntradas - periodSaidas;

  // Chart Data: Grouping by Month or Day
  const chartData = useMemo(() => {
    const monthMap = new Map<string, { label: string; entradas: number; saidas: number }>();
    
    // Last 6 months or months in range
    const months = [
      'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
      'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
    ];

    // Initialize 6 months up to current
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${months[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`;
      monthMap.set(key, { label, entradas: 0, saidas: 0 });
    }

    orders.forEach(o => {
      if (o.status !== 'cancelado') {
        const key = o.deliveryDate.slice(0, 7);
        if (monthMap.has(key)) {
          monthMap.get(key)!.entradas += o.totalAmount;
        }
      }
    });

    services.forEach(s => {
      if (s.status !== 'cancelado') {
        const key = s.startDate.slice(0, 7);
        if (monthMap.has(key)) {
          monthMap.get(key)!.entradas += s.totalAmount;
        }
      }
    });

    expenses.forEach(e => {
      const key = e.dueDate.slice(0, 7);
      if (monthMap.has(key)) {
        monthMap.get(key)!.saidas += e.amount;
      }
    });

    return Array.from(monthMap.values());
  }, [orders, services, expenses]);

  // Top Expense Categories in the period
  const topCategories = useMemo(() => {
    const map = new Map<string, number>();
    expenses
      .filter(e => e.dueDate >= startDate && e.dueDate <= endDate)
      .forEach(e => {
        const cat = e.categoryName || 'Outras Despesas';
        map.set(cat, (map.get(cat) || 0) + e.amount);
      });
    
    const sorted = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    return sorted;
  }, [expenses, startDate, endDate]);

  return (
    <div className="space-y-4 sm:space-y-6">
      
      {/* 1. FILTRAR PERÍODO (Em uma única linha horizontal compacta: Data primeiro, depois opções de meses) */}
      <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-slate-400 dark:border-stone-800 rounded-xl px-3.5 py-2 sm:py-2.5 shadow-xs flex flex-wrap lg:flex-nowrap items-center justify-between gap-2.5 text-black dark:text-white">
        
        {/* Esquerda: Rótulo + Seleção por Data */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1.5 text-black dark:text-stone-400">
            <CalendarIcon className="w-3.5 h-3.5 text-black dark:text-[#009688]" />
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-black dark:text-white">
              FILTRAR POR PERÍODO:
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-black dark:text-stone-200 outline-none focus:ring-1 focus:ring-sky-600"
            />
            <span className="text-[11px] text-black dark:text-stone-400 font-bold">até</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-black dark:text-stone-200 outline-none focus:ring-1 focus:ring-sky-600"
            />
          </div>
        </div>

        {/* Direita: Opções Rápidas de Meses */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'mes_atual', label: 'Mês atual' },
            { id: '1_mes', label: '1 mês' },
            { id: '3_meses', label: '3 meses' },
            { id: '6_meses', label: '6 meses' },
            { id: '12_meses', label: '12 meses' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onQuickPeriodChange(item.id as any)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                quickPeriod === item.id
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-white/80 dark:bg-stone-800 text-black dark:text-stone-300 hover:bg-white border border-slate-300 dark:border-stone-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Mês atual — setembro/2026 (Cards Compactos com metade do tamanho) */}
      <div className="space-y-1">
        <h3 className="text-[11px] font-black uppercase tracking-wider text-black dark:text-stone-400">
          MÊS ATUAL — {selectedMonthName ? selectedMonthName.toUpperCase() : 'MÊS ATUAL'}/{selectedYear}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-2.5">
          
          {/* Card Entradas */}
          <div className="bg-[#f0fdf4] dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 border-l-[3px] border-l-emerald-500 rounded-xl px-3 py-2 sm:py-2.5 flex items-center space-x-3 shadow-2xs">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block uppercase tracking-wider">
                Entradas
              </span>
              <div className="text-sm sm:text-base font-black text-stone-900 dark:text-stone-100 font-['Outfit'] truncate">
                {formatCurrencyBRL(currentMonthEntradas)}
              </div>
            </div>
          </div>

          {/* Card Saídas */}
          <div className="bg-[#fff1f2] dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 border-l-[3px] border-l-rose-500 rounded-xl px-3 py-2 sm:py-2.5 flex items-center space-x-3 shadow-2xs">
            <div className="w-7 h-7 rounded-lg bg-rose-100 dark:bg-rose-900/60 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
              <TrendingDown className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 block uppercase tracking-wider">
                Saídas
              </span>
              <div className="text-sm sm:text-base font-black text-rose-600 dark:text-rose-400 font-['Outfit'] truncate">
                {formatCurrencyBRL(currentMonthSaidas)}
              </div>
            </div>
          </div>

          {/* Card Saldo Real */}
          <div className="bg-[#f0f9ff] dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/40 border-l-[3px] border-l-sky-500 rounded-xl px-3 py-2 sm:py-2.5 flex items-center space-x-3 shadow-2xs">
            <div className="w-7 h-7 rounded-lg bg-sky-100 dark:bg-sky-900/60 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
              <DollarSign className="w-3.5 h-3.5 font-bold" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 block uppercase tracking-wider">
                Saldo Real
              </span>
              <div className="text-sm sm:text-base font-black text-sky-700 dark:text-sky-300 font-['Outfit'] truncate">
                {formatCurrencyBRL(currentMonthSaldo)}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* 3. Período Selecionado Acumulado */}
      <div className="space-y-1">
        <h3 className="text-[11px] font-black uppercase tracking-wider text-black dark:text-stone-400">
          PERÍODO SELECIONADO — ACUMULADO
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-2.5">
          
          {/* Card Total Entradas */}
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl px-3 py-2 sm:py-2.5 flex items-center space-x-3 shadow-2xs border-l-[3px] border-l-emerald-400">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 block uppercase tracking-wider">
                Total Entradas
              </span>
              <div className="text-sm sm:text-base font-black text-stone-900 dark:text-stone-100 font-['Outfit'] truncate">
                {formatCurrencyBRL(periodEntradas)}
              </div>
            </div>
          </div>

          {/* Card Total Saídas */}
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl px-3 py-2 sm:py-2.5 flex items-center space-x-3 shadow-2xs border-l-[3px] border-l-rose-400">
            <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/60 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
              <TrendingDown className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 block uppercase tracking-wider">
                Total Saídas
              </span>
              <div className="text-sm sm:text-base font-black text-stone-900 dark:text-stone-100 font-['Outfit'] truncate">
                {formatCurrencyBRL(periodSaidas)}
              </div>
            </div>
          </div>

          {/* Card Saldo Acumulado */}
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl px-3 py-2 sm:py-2.5 flex items-center space-x-3 shadow-2xs border-l-[3px] border-l-sky-400">
            <div className="w-7 h-7 rounded-lg bg-sky-50 dark:bg-sky-950/60 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
              <BarChart2 className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 block uppercase tracking-wider">
                Saldo Acumulado
              </span>
              <div className={`text-sm sm:text-base font-black font-['Outfit'] truncate ${periodSaldo >= 0 ? 'text-stone-900 dark:text-stone-100' : 'text-rose-600'}`}>
                {formatCurrencyBRL(periodSaldo)}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* 4. Gráfico: Entradas (Serviços Silagem) vs Saídas (Despesas) */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center space-x-2">
          <Sprout className="w-4 h-4 text-[#009688]" />
          <h3 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100">
            Entradas (Serviços Silagem) vs Saídas (Despesas)
          </h3>
        </div>

        <div className="h-64 sm:h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
              <XAxis 
                dataKey="label" 
                tick={{ fontSize: 11, fill: '#78716c' }} 
                axisLine={false} 
                tickLine={false} 
              />
              <YAxis 
                tick={{ fontSize: 11, fill: '#78716c' }} 
                axisLine={false} 
                tickLine={false}
                tickFormatter={(val) => `R$${(val / 1000).toFixed(0)}k`}
              />
              <Tooltip 
                formatter={(val: number | undefined) => [formatCurrencyBRL(val || 0), '']}
                contentStyle={{ 
                  borderRadius: '12px', 
                  border: '1px solid #e7e5e4', 
                  backgroundColor: '#ffffff',
                  fontSize: '12px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                }} 
              />
              <Legend 
                wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} 
              />
              <Bar 
                dataKey="entradas" 
                name="Entradas (Vendas & Serviços)" 
                fill="#009688" 
                radius={[6, 6, 0, 0]} 
              />
              <Bar 
                dataKey="saidas" 
                name="Saídas (Despesas Operacionais)" 
                fill="#f43f5e" 
                radius={[6, 6, 0, 0]} 
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 5. Principais Centros de Despesas do Período */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-5 shadow-xs">
        <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100 mb-3 flex items-center space-x-1.5">
          <PieIcon className="w-3.5 h-3.5 text-stone-400" />
          <span>Composição de Despesas no Período Selecionado</span>
        </h4>

        {topCategories.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {topCategories.slice(0, 6).map(([catName, amount]) => {
              const percent = periodSaidas > 0 ? (amount / periodSaidas) * 100 : 0;
              return (
                <div key={catName} className="p-3 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200/70 dark:border-stone-700/60">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-semibold text-stone-800 dark:text-stone-200 truncate">{catName}</span>
                    <span className="text-xs font-bold text-rose-600">{formatCurrencyBRL(amount)}</span>
                  </div>
                  <div className="w-full bg-stone-200 dark:bg-stone-700 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div className="bg-rose-500 h-full rounded-full" style={{ width: `${percent}%` }} />
                  </div>
                  <div className="flex justify-between items-center mt-1 text-[10px] text-stone-400 font-medium">
                    <span>Participação</span>
                    <span>{percent.toFixed(1)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-stone-400 py-4 text-center">
            Nenhuma despesa registrada para o período selecionado.
          </p>
        )}
      </div>

    </div>
  );
};
