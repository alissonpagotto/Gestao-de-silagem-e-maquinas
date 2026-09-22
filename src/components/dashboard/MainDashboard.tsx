import React, { useState, useMemo } from 'react';
import { 
  ArrowDownRight, 
  ArrowUpRight,
  Receipt, 
  Users, 
  Tractor, 
  AlertTriangle, 
  ChevronRight, 
  CheckCircle2, 
  Sparkles, 
  PlusCircle, 
  FolderSync, 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  FileText,
  Calendar,
  Truck,
  ShieldCheck,
  AlertCircle,
  Fuel,
  Sprout,
  Layers,
  Activity
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
import { 
  Expense, 
  Client, 
  Machinery, 
  Employee, 
  SilageOrder, 
  ServiceOrder,
  InventoryItem,
  FuelLog,
  CropSeason
} from '../../types';
import { formatCurrencyBRL, formatDateBR, checkCnhStatus } from '../../lib/storage';

interface MainDashboardProps {
  expenses: Expense[];
  clients: Client[];
  machineries: Machinery[];
  employees: Employee[];
  orders: SilageOrder[];
  services?: ServiceOrder[];
  inventory?: InventoryItem[];
  fuelLogs?: FuelLog[];
  seasons?: CropSeason[];
  onNavigate: (tab: string) => void;
  onNewExpense: () => void;
  onOpenAiParser: () => void;
  onOpenIntegration: () => void;
}

export const MainDashboard: React.FC<MainDashboardProps> = ({
  expenses,
  clients,
  machineries,
  employees,
  orders,
  services = [],
  inventory = [],
  fuelLogs = [],
  seasons = [],
  onNavigate,
  onNewExpense,
  onOpenAiParser,
  onOpenIntegration,
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<'mes_atual' | 'todos'>('todos');

  // Calculate current month expenses
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  const currentMonthExpenses = expenses.filter(e => e.dueDate?.startsWith(currentMonthStr));
  const currentMonthTotal = currentMonthExpenses.reduce((acc, curr) => acc + curr.amount, 0);
  const currentMonthCount = currentMonthExpenses.length;

  // Total expenses
  const totalExpensesAmount = expenses.reduce((acc, curr) => acc + curr.amount, 0);
  const totalExpensesCount = expenses.length;

  // Clients count
  const clientsCount = clients.length;

  // Machinery & fleet operators count
  const machineriesCount = machineries.length;
  const operatorsCount = employees.length;

  // CNH Status
  const cnhReport = checkCnhStatus(employees);

  // Categories breakdown for chart view
  const categoryTotals: { [name: string]: { total: number; color: string } } = {};
  expenses.forEach(e => {
    if (!categoryTotals[e.categoryName]) {
      categoryTotals[e.categoryName] = { total: 0, color: e.categoryColor || '#10b981' };
    }
    categoryTotals[e.categoryName].total += e.amount;
  });

  // 1. Fluxo Financeiro & Operacional Mensal (Últimos 6 meses)
  const monthlyData = useMemo(() => {
    const months = [];
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const year = d.getFullYear();
      const monthNum = d.getMonth() + 1;
      const monthPrefix = `${year}-${String(monthNum).padStart(2, '0')}`;
      const label = `${monthNames[d.getMonth()]}/${String(year).slice(-2)}`;
      
      const ordersRev = orders
        .filter(o => o.deliveryDate?.startsWith(monthPrefix) && o.status !== 'cancelado')
        .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        
      const servicesRev = services
        .filter(s => s.startDate?.startsWith(monthPrefix) && s.status !== 'cancelado')
        .reduce((sum, s) => sum + (s.totalAmount || 0), 0);
        
      const revenue = ordersRev + servicesRev;
      
      const expensesTotal = expenses
        .filter(e => e.dueDate?.startsWith(monthPrefix))
        .reduce((sum, e) => sum + (e.amount || 0), 0);

      const dieselTotal = expenses
        .filter(e => e.dueDate?.startsWith(monthPrefix) && (
          e.categoryName?.toLowerCase().includes('combust') || 
          e.categoryName?.toLowerCase().includes('diesel') ||
          e.description?.toLowerCase().includes('diesel')
        ))
        .reduce((sum, e) => sum + (e.amount || 0), 0);

      months.push({
        name: label,
        receitas: revenue,
        custos: expensesTotal,
        diesel: dieselTotal,
      });
    }

    const hasActivity = months.some(m => m.receitas > 0 || m.custos > 0);
    if (!hasActivity) {
      return [];
    }
    
    return months;
  }, [orders, services, expenses]);

  // 2. Consumo de Diesel por Ensiladeira e Maquinário (apenas registros reais)
  const dieselByMachinery = useMemo(() => {
    const machineMap: { [key: string]: { liters: number; cost: number; type: string } } = {};

    machineries.forEach(m => {
      const name = m.name || m.plate || 'Equipamento';
      const isEnsiladeira = (m.type?.toLowerCase().includes('ensiladeira') || m.type?.toLowerCase().includes('forrageira') || m.categoryType === 'ensiladeira');
      const isTrator = (m.type?.toLowerCase().includes('trator') || m.categoryType === 'trator');
      const typeLabel = isEnsiladeira ? 'Ensiladeira' : isTrator ? 'Trator' : 'Frota/Caminhão';
      
      if (m.totalFuelExpenses && m.totalFuelExpenses > 0) {
        machineMap[name] = {
          liters: m.fuelCapacityLiters || 0,
          cost: m.totalFuelExpenses,
          type: typeLabel
        };
      }
    });

    if (fuelLogs && fuelLogs.length > 0) {
      fuelLogs.forEach(fl => {
        const name = fl.vehicleName || 'Outro Veículo';
        if (!machineMap[name]) {
          machineMap[name] = { liters: 0, cost: 0, type: 'Frota' };
        }
        machineMap[name].liters += fl.liters || 0;
        machineMap[name].cost += fl.totalCost || (fl.liters * (fl.pricePerLiter || 6.2));
      });
    }

    const items = Object.entries(machineMap).map(([name, data]) => ({
      name,
      litros: Math.round(data.liters),
      custo: Math.round(data.cost),
      tipo: data.type
    }))
    .filter(i => i.litros > 0 || i.custo > 0)
    .sort((a, b) => b.litros - a.litros).slice(0, 5);

    if (items.length === 0) {
      return [];
    }
    return items;
  }, [machineries, fuelLogs]);

  // 3. Tabela de Custos & Rentabilidade por Safra (retorna apenas safras reais ou lista vazia)
  const seasonsSummary = useMemo(() => {
    if (!seasons || seasons.length === 0) {
      return [];
    }

    const totalServRev = services.reduce((acc, s) => acc + (s.totalAmount || 0), 0);
    const totalOrdersRev = orders.reduce((acc, o) => acc + (o.totalAmount || 0), 0);
    const totalRev = totalServRev + totalOrdersRev;
    const totalAreaHectares = services.reduce((acc, s) => acc + (s.areaHectares || 0), 0);
    const totalTons = services.reduce((acc, s) => acc + (s.tonsEstimated || 0), 0) + orders.reduce((acc, o) => acc + (o.quantityTons || 0), 0);
    
    const dieselExpenses = expenses
      .filter(e => e.categoryName?.toLowerCase().includes('combust') || e.categoryName?.toLowerCase().includes('diesel'))
      .reduce((sum, e) => sum + e.amount, 0);

    const otherExpenses = expenses
      .filter(e => !e.categoryName?.toLowerCase().includes('combust') && !e.categoryName?.toLowerCase().includes('diesel'))
      .reduce((sum, e) => sum + e.amount, 0);

    return seasons.map(s => {
      return {
        id: s.id,
        nome: s.name,
        cultura: s.cropType || 'Não informada',
        area: s.totalAreaHectares ? `${s.totalAreaHectares.toFixed(1)} ha` : (totalAreaHectares > 0 ? `${totalAreaHectares.toFixed(1)} ha` : '0.0 ha'),
        producao: s.totalProductionTons ? `${s.totalProductionTons.toLocaleString('pt-BR')} ton` : (totalTons > 0 ? `${totalTons.toLocaleString('pt-BR')} ton` : '0 ton'),
        custoDiesel: dieselExpenses,
        outrosCustos: otherExpenses,
        faturamento: totalRev,
        status: s.status === 'em_andamento' ? 'Em Andamento' : s.status === 'planejada' ? 'Planejada' : 'Finalizada',
        statusColor: s.status === 'em_andamento' 
          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
          : 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300'
      };
    });
  }, [seasons, services, orders, expenses]);

  // Indicadores de topo do bloco analítico
  const totalSafraFaturamento = seasonsSummary.reduce((sum, s) => sum + s.faturamento, 0);
  const totalSafraCustos = seasonsSummary.reduce((sum, s) => sum + s.custoDiesel + s.outrosCustos, 0);
  const totalSafraMargem = totalSafraFaturamento - totalSafraCustos;
  const margemPercentual = totalSafraFaturamento > 0 ? (totalSafraMargem / totalSafraFaturamento) * 100 : 0;

  return (
    <div id="main-dashboard-view" className="w-full max-w-none space-y-2 sm:space-y-2.5">
      
      {/* Linha 1 (Topo Máximo): Cards de Resumos e Indicadores Globais */}
      <div 
        id="top-summary-cards-row" 
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5 w-full"
      >
        {/* Card 1: DESPESAS DO MÊS */}
        <div 
          id="stat-card-despesas-mes"
          onClick={() => onNavigate('despesas')}
          className="crm-card bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-xl p-2 sm:p-2.5 shadow-xs hover:border-zinc-300 dark:hover:border-stone-700 transition flex items-center justify-between cursor-pointer group text-zinc-900 dark:text-white"
        >
          <div className="min-w-0 pr-1.5">
            <span className="text-[9px] font-bold tracking-wider text-zinc-500 dark:text-stone-400 uppercase block">
              DESPESAS DO MÊS
            </span>
            <div className="text-base sm:text-lg font-black text-zinc-900 dark:text-white font-['Outfit'] leading-tight truncate">
              {formatCurrencyBRL(currentMonthTotal)}
            </div>
            <span className="text-[10px] font-semibold text-zinc-500 dark:text-stone-400 block truncate">
              {currentMonthCount} lançamentos
            </span>
          </div>
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-zinc-100 dark:bg-stone-800 border border-zinc-200/80 dark:border-stone-700 flex items-center justify-center text-zinc-700 dark:text-stone-300 shadow-2xs group-hover:scale-105 transition shrink-0">
            <ArrowDownRight className="w-4 h-4 stroke-[2.5]" />
          </div>
        </div>

        {/* Card 2: TOTAL DESPESAS */}
        <div 
          id="stat-card-total-despesas"
          onClick={() => onNavigate('despesas')}
          className="crm-card bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-xl p-2 sm:p-2.5 shadow-xs hover:border-zinc-300 dark:hover:border-stone-700 transition flex items-center justify-between cursor-pointer group text-zinc-900 dark:text-white"
        >
          <div className="min-w-0 pr-1.5">
            <span className="text-[9px] font-bold tracking-wider text-zinc-500 dark:text-stone-400 uppercase block">
              TOTAL DESPESAS
            </span>
            <div className="text-base sm:text-lg font-black text-zinc-900 dark:text-white font-['Outfit'] leading-tight truncate">
              {formatCurrencyBRL(totalExpensesAmount)}
            </div>
            <span className="text-[10px] font-semibold text-zinc-500 dark:text-stone-400 block truncate">
              {totalExpensesCount} registros
            </span>
          </div>
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-zinc-100 dark:bg-stone-800 border border-zinc-200/80 dark:border-stone-700 flex items-center justify-center text-zinc-700 dark:text-stone-300 shadow-2xs group-hover:scale-105 transition shrink-0">
            <DollarSign className="w-4 h-4 stroke-[2.5]" />
          </div>
        </div>

        {/* Card 3: CLIENTES */}
        <div 
          id="stat-card-clientes"
          onClick={() => onNavigate('clientes')}
          className="crm-card bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-xl p-2 sm:p-2.5 shadow-xs hover:border-zinc-300 dark:hover:border-stone-700 transition flex items-center justify-between cursor-pointer group text-zinc-900 dark:text-white"
        >
          <div className="min-w-0 pr-1.5">
            <span className="text-[9px] font-bold tracking-wider text-zinc-500 dark:text-stone-400 uppercase block">
              CLIENTES
            </span>
            <div className="text-base sm:text-lg font-black text-zinc-900 dark:text-white font-['Outfit'] leading-tight truncate">
              {clientsCount}
            </div>
            <span className="text-[10px] font-semibold text-zinc-500 dark:text-stone-400 block truncate">
              {clientsCount} cadastrados
            </span>
          </div>
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-zinc-100 dark:bg-stone-800 border border-zinc-200/80 dark:border-stone-700 flex items-center justify-center text-zinc-700 dark:text-stone-300 shadow-2xs group-hover:scale-105 transition shrink-0">
            <Users className="w-4 h-4 stroke-[2.2]" />
          </div>
        </div>

        {/* Card 4: FROTAS */}
        <div 
          id="stat-card-frotas"
          onClick={() => onNavigate('frotas')}
          className="crm-card bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-xl p-2 sm:p-2.5 shadow-xs hover:border-zinc-300 dark:hover:border-stone-700 transition flex items-center justify-between cursor-pointer group text-zinc-900 dark:text-white"
        >
          <div className="min-w-0 pr-1.5">
            <span className="text-[9px] font-bold tracking-wider text-zinc-500 dark:text-stone-400 uppercase block">
              FROTAS
            </span>
            <div className="text-base sm:text-lg font-black text-zinc-900 dark:text-white font-['Outfit'] leading-tight truncate">
              {machineriesCount}
            </div>
            <span className="text-[10px] font-semibold text-zinc-500 dark:text-stone-400 block truncate">
              {operatorsCount} motoristas/operadores
            </span>
          </div>
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-zinc-100 dark:bg-stone-800 border border-zinc-200/80 dark:border-stone-700 flex items-center justify-center text-zinc-700 dark:text-stone-300 shadow-2xs group-hover:scale-105 transition shrink-0">
            <Tractor className="w-4 h-4 stroke-[2.2]" />
          </div>
        </div>
      </div>

      {/* Linha 2 (Intermediária): Cards de Atalhos e Lançamentos Rápidos */}
      <div 
        id="top-shortcut-cards-row" 
        className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5 w-full"
      >
        
        {/* Card 1: Despesas / Lançamentos */}
        <button 
          id="shortcut-card-despesas"
          onClick={() => onNavigate('despesas')}
          className="crm-card bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-xl p-2 sm:p-2.5 shadow-xs hover:border-zinc-300 dark:hover:border-stone-700 hover:shadow-sm transition flex items-center justify-between cursor-pointer group text-zinc-900 dark:text-white text-left w-full"
        >
          <div className="min-w-0 pr-1.5">
            <span className="text-[9px] font-bold tracking-wider text-zinc-500 dark:text-stone-400 uppercase block">
              Despesas
            </span>
            <div className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white font-['Outfit'] truncate leading-tight">
              Lançamentos
            </div>
            <span className="text-[10px] font-semibold text-zinc-500 dark:text-stone-400 block truncate mt-0.5">
              {formatCurrencyBRL(currentMonthTotal)} ({currentMonthCount})
            </span>
          </div>
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-zinc-100 dark:bg-stone-800 border border-zinc-200/80 dark:border-stone-700 text-zinc-700 dark:text-stone-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition shadow-2xs">
            <Receipt className="w-4 h-4 stroke-[2.2]" />
          </div>
        </button>

        {/* Card 2: Serviços / Ensilagem */}
        <button 
          id="shortcut-card-servicos"
          onClick={() => onNavigate('servicos')}
          className="crm-card bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-xl p-2 sm:p-2.5 shadow-xs hover:border-zinc-300 dark:hover:border-stone-700 hover:shadow-sm transition flex items-center justify-between cursor-pointer group text-zinc-900 dark:text-white text-left w-full"
        >
          <div className="min-w-0 pr-1.5">
            <span className="text-[9px] font-bold tracking-wider text-zinc-500 dark:text-stone-400 uppercase block">
              Serviços
            </span>
            <div className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white font-['Outfit'] truncate leading-tight">
              Ensilagem
            </div>
            <span className="text-[10px] font-semibold text-zinc-500 dark:text-stone-400 block truncate mt-0.5">
              {services.length} ordens de corte
            </span>
          </div>
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-zinc-100 dark:bg-stone-800 border border-zinc-200/80 dark:border-stone-700 text-zinc-700 dark:text-stone-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition shadow-2xs">
            <Tractor className="w-4 h-4 stroke-[2.2]" />
          </div>
        </button>

        {/* Card 3: Estoque / Insumos */}
        <button 
          id="shortcut-card-estoque"
          onClick={() => onNavigate('estoque')}
          className="crm-card bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-xl p-2 sm:p-2.5 shadow-xs hover:border-zinc-300 dark:hover:border-stone-700 hover:shadow-sm transition flex items-center justify-between cursor-pointer group text-zinc-900 dark:text-white text-left w-full"
        >
          <div className="min-w-0 pr-1.5">
            <span className="text-[9px] font-bold tracking-wider text-zinc-500 dark:text-stone-400 uppercase block">
              Estoque
            </span>
            <div className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white font-['Outfit'] truncate leading-tight">
              Insumos
            </div>
            <span className="text-[10px] font-semibold text-zinc-500 dark:text-stone-400 block truncate mt-0.5">
              {inventory.length} itens controlados
            </span>
          </div>
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-zinc-100 dark:bg-stone-800 border border-zinc-200/80 dark:border-stone-700 text-zinc-700 dark:text-stone-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition shadow-2xs">
            <ShieldCheck className="w-4 h-4 stroke-[2.2]" />
          </div>
        </button>

        {/* Card 4: Clientes / Produtores */}
        <button 
          id="shortcut-card-clientes"
          onClick={() => onNavigate('clientes')}
          className="crm-card bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-xl p-2 sm:p-2.5 shadow-xs hover:border-zinc-300 dark:hover:border-stone-700 hover:shadow-sm transition flex items-center justify-between cursor-pointer group text-zinc-900 dark:text-white text-left w-full"
        >
          <div className="min-w-0 pr-1.5">
            <span className="text-[9px] font-bold tracking-wider text-zinc-500 dark:text-stone-400 uppercase block">
              Clientes
            </span>
            <div className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white font-['Outfit'] truncate leading-tight">
              Produtores
            </div>
            <span className="text-[10px] font-semibold text-zinc-500 dark:text-stone-400 block truncate mt-0.5">
              {clientsCount} cadastrados
            </span>
          </div>
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-zinc-100 dark:bg-stone-800 border border-zinc-200/80 dark:border-stone-700 text-zinc-700 dark:text-stone-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition shadow-2xs">
            <Users className="w-4 h-4 stroke-[2.2]" />
          </div>
        </button>

      </div>

      {/* Main Content Grid: Left 2/3 (Data & Migration / Charts) and Right 1/3 (Status da Frota) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5 sm:gap-3">
        
        {/* Left Section: 2 Columns */}
        <div className="lg:col-span-2 space-y-2.5">
          
          {/* Main Container: Analytical Safra & Operations Dashboard */}
          <div className="crm-card bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-xl p-3 sm:p-4 shadow-xs text-zinc-900 dark:text-white space-y-2.5 sm:space-y-3">
            
            {/* 1. Header do Bloco Analítico Executivo */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-zinc-200 dark:border-stone-800 pb-2">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-zinc-100 dark:bg-stone-800 border border-zinc-200 dark:border-stone-700 text-zinc-700 dark:text-stone-300 flex items-center justify-center shrink-0">
                  <BarChart3 className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-zinc-900 dark:text-white font-['Outfit'] tracking-tight">
                    Gráficos & Tabelas da Safra & Custos Operacionais
                  </h3>
                  <p className="text-[11px] text-zinc-500 dark:text-stone-400 font-medium">
                    Acompanhamento direto em tempo real de custos por safra, diesel das ensiladeiras e fluxo financeiro
                  </p>
                </div>
              </div>

              {/* Badges Executivos de Resumo */}
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md bg-zinc-50 dark:bg-stone-800/80 border border-zinc-200 dark:border-stone-700">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 dark:text-stone-400 block">
                    Faturamento Safras
                  </span>
                  <span className="text-xs font-black text-zinc-900 dark:text-white font-['Outfit']">
                    {formatCurrencyBRL(totalSafraFaturamento)}
                  </span>
                </div>

                <div className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md bg-zinc-50 dark:bg-stone-800/80 border border-zinc-200 dark:border-stone-700">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 dark:text-stone-400 block">
                    Custos Totais
                  </span>
                  <span className="text-xs font-black text-zinc-900 dark:text-white font-['Outfit']">
                    {formatCurrencyBRL(totalSafraCustos)}
                  </span>
                </div>

                <div className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md bg-zinc-50 dark:bg-stone-800/80 border border-zinc-200 dark:border-stone-700">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 dark:text-stone-400 block">
                    Margem ({margemPercentual.toFixed(1)}%)
                  </span>
                  <span className="text-xs font-black text-zinc-900 dark:text-white font-['Outfit']">
                    {formatCurrencyBRL(totalSafraMargem)}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Gráficos da Safra (2 Colunas Responsivas com Altura Otimizada) */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2 sm:gap-2.5">
              
              {/* Gráfico 1: Faturamento vs. Custos Operacionais */}
              <div className="bg-zinc-50/80 dark:bg-stone-800/40 rounded-xl p-2 sm:p-2.5 border border-zinc-200 dark:border-stone-800 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center space-x-1.5">
                    <div className="w-5 h-5 rounded-md bg-zinc-100 dark:bg-stone-800 border border-zinc-200 dark:border-stone-700 text-zinc-700 dark:text-stone-300 flex items-center justify-center">
                      <TrendingUp className="w-3 h-3" />
                    </div>
                    <h4 className="text-xs font-bold text-zinc-900 dark:text-white">
                      Fluxo Operacional: Faturamento vs. Custos
                    </h4>
                  </div>
                  <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-white dark:bg-stone-800 text-zinc-600 dark:text-stone-300 border border-zinc-200 dark:border-stone-700">
                    Últimos 6 Meses
                  </span>
                </div>

                  <div className="h-36 sm:h-40 w-full flex items-center justify-center">
                    {monthlyData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyData} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis 
                            dataKey="name" 
                            tick={{ fontSize: 10, fill: '#64748b' }} 
                            axisLine={false} 
                            tickLine={false} 
                          />
                          <YAxis 
                            tick={{ fontSize: 9, fill: '#64748b' }} 
                            axisLine={false} 
                            tickLine={false}
                            tickFormatter={(val) => `R$${(val / 1000).toFixed(0)}k`}
                          />
                          <Tooltip 
                            formatter={(val: number | undefined) => [formatCurrencyBRL(val || 0), '']}
                            contentStyle={{ 
                              borderRadius: '8px', 
                              border: '1px solid #cbd5e1', 
                              backgroundColor: '#ffffff',
                              color: '#000000',
                              fontSize: '10px',
                              boxShadow: '0 2px 4px rgb(0 0 0 / 0.1)'
                            }} 
                          />
                          <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '4px' }} />
                          <Bar 
                            dataKey="receitas" 
                            name="Faturamento" 
                            fill="#10b981" 
                            radius={[3, 3, 0, 0]} 
                          />
                          <Bar 
                            dataKey="custos" 
                            name="Custos Totais" 
                            fill="#0284c7" 
                            radius={[3, 3, 0, 0]} 
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-center p-3 text-slate-400 dark:text-stone-500">
                        <TrendingUp className="w-6 h-6 mb-1 opacity-30 stroke-1" />
                        <p className="text-xs font-semibold text-stone-600 dark:text-stone-400">Nenhum fluxo financeiro no período</p>
                        <p className="text-[10px] text-stone-400 dark:text-stone-500">Faturamento e custos aparecerão conforme os lançamentos.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Gráfico 2: Consumo de Diesel das Ensiladeiras e Frotas */}
                <div className="bg-slate-50/80 dark:bg-stone-800/40 rounded-xl p-2 sm:p-2.5 border border-slate-200/80 dark:border-stone-800 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center space-x-1.5">
                      <div className="w-5 h-5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center">
                        <Fuel className="w-3 h-3" />
                      </div>
                      <h4 className="text-xs font-bold text-black dark:text-white">
                        Consumo de Diesel: Ensiladeiras & Frotas
                      </h4>
                    </div>
                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-white dark:bg-stone-800 text-black/70 dark:text-stone-300 border border-slate-200 dark:border-stone-700">
                      Volume (L)
                    </span>
                  </div>

                  <div className="h-36 sm:h-40 w-full flex items-center justify-center">
                    {dieselByMachinery.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dieselByMachinery} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                          <XAxis 
                            type="number" 
                            tick={{ fontSize: 9, fill: '#64748b' }} 
                            axisLine={false} 
                            tickLine={false}
                            tickFormatter={(val) => `${val} L`}
                          />
                          <YAxis 
                            type="category" 
                            dataKey="name" 
                            tick={{ fontSize: 9, fill: '#334155' }} 
                            axisLine={false} 
                            tickLine={false}
                            width={95}
                          />
                          <Tooltip 
                            formatter={(val: number | undefined, name: string | undefined, item: any) => [
                              `${val?.toLocaleString('pt-BR')} L (${formatCurrencyBRL(item?.payload?.custo || 0)})`, 
                              'Consumo'
                            ]}
                            contentStyle={{ 
                              borderRadius: '8px', 
                              border: '1px solid #cbd5e1', 
                              backgroundColor: '#ffffff',
                              color: '#000000',
                              fontSize: '10px',
                              boxShadow: '0 2px 4px rgb(0 0 0 / 0.1)'
                            }} 
                          />
                          <Bar 
                            dataKey="litros" 
                            name="Diesel (L)" 
                            fill="#f59e0b" 
                            radius={[0, 3, 3, 0]} 
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-center p-3 text-slate-400 dark:text-stone-500">
                        <Fuel className="w-6 h-6 mb-1 opacity-30 stroke-1" />
                        <p className="text-xs font-semibold text-stone-600 dark:text-stone-400">Nenhum consumo de diesel registrado</p>
                        <p className="text-[10px] text-stone-400 dark:text-stone-500">Abastecimentos e custos de combustível aparecerão aqui.</p>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* 3. Tabela de Custos por Safra (Densidade Compacta) */}
              <div className="bg-white dark:bg-stone-900 rounded-xl border border-zinc-200 dark:border-stone-800 overflow-hidden shadow-2xs">
                <div className="p-2 sm:p-2.5 bg-zinc-50 dark:bg-stone-800/60 border-b border-zinc-200 dark:border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div className="flex items-center space-x-1.5">
                    <Sprout className="w-3.5 h-3.5 text-zinc-700 dark:text-stone-300" />
                    <h4 className="text-xs font-bold text-zinc-900 dark:text-white font-['Outfit']">
                      Tabela de Custos & Rentabilidade por Safra
                    </h4>
                  </div>
                  <span className="text-[10px] text-zinc-500 dark:text-stone-400 font-medium">
                    Fluxo financeiro detalhado de corte, ensilagem e faturamento
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-zinc-100 dark:bg-stone-800 text-zinc-700 dark:text-stone-300 font-bold border-b border-zinc-200 dark:border-stone-800">
                      <tr>
                        <th className="py-1.5 px-2">Safra</th>
                        <th className="py-1.5 px-2">Cultura</th>
                        <th className="py-1.5 px-2">Área & Prod.</th>
                        <th className="py-1.5 px-2">Diesel</th>
                        <th className="py-1.5 px-2">Outros Custos</th>
                        <th className="py-1.5 px-2">Faturamento</th>
                        <th className="py-1.5 px-2">Margem Líquida</th>
                        <th className="py-1.5 px-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-stone-800">
                      {seasonsSummary.length > 0 ? (
                        seasonsSummary.map((season) => {
                          const totalCusto = season.custoDiesel + season.outrosCustos;
                          const margem = season.faturamento - totalCusto;
                          const percMargem = season.faturamento > 0 ? (margem / season.faturamento) * 100 : 0;
                          return (
                            <tr key={season.id} className="hover:bg-zinc-50/70 dark:hover:bg-stone-800/40 transition">
                              <td className="py-1 px-2 font-bold text-zinc-900 dark:text-white whitespace-nowrap">
                                {season.nome}
                              </td>
                              <td className="py-1 px-2 text-zinc-700 dark:text-stone-300 whitespace-nowrap">
                                {season.cultura}
                              </td>
                              <td className="py-1 px-2 text-zinc-700 dark:text-stone-300 whitespace-nowrap">
                                {season.area} • <span className="font-semibold">{season.producao}</span>
                              </td>
                              <td className="py-1 px-2 font-semibold text-zinc-800 dark:text-stone-300 whitespace-nowrap">
                                {formatCurrencyBRL(season.custoDiesel)}
                              </td>
                              <td className="py-1 px-2 text-zinc-700 dark:text-stone-400 whitespace-nowrap">
                                {formatCurrencyBRL(season.outrosCustos)}
                              </td>
                              <td className="py-1 px-2 font-bold text-zinc-900 dark:text-white whitespace-nowrap">
                                {formatCurrencyBRL(season.faturamento)}
                              </td>
                              <td className="py-1 px-2 whitespace-nowrap">
                                <span className="font-black text-zinc-900 dark:text-white">
                                  {formatCurrencyBRL(margem)}
                                </span>{' '}
                                <span className="text-[9px] font-bold text-zinc-700 dark:text-stone-300 bg-zinc-100 dark:bg-stone-800 border border-zinc-200 dark:border-stone-700 px-1 py-0.2 rounded ml-1">
                                  +{percMargem.toFixed(1)}%
                                </span>
                              </td>
                              <td className="py-1 px-2 text-center whitespace-nowrap">
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-zinc-100 text-zinc-700 border border-zinc-200 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-700">
                                  {season.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={8} className="py-4 px-2 text-center text-xs text-zinc-500 dark:text-stone-400">
                            Nenhuma safra cadastrada ou ativa no sistema.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4. Distribuição de Despesas Operacionais por Categoria (Compacta) */}
              <div className="pt-1">
                <div className="flex items-center justify-between mb-1.5">
                  <div>
                    <h4 className="text-xs font-bold text-black dark:text-white font-['Outfit'] flex items-center space-x-1.5">
                      <Layers className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                      <span>Distribuição de Despesas por Categoria</span>
                    </h4>
                    <p className="text-[10px] text-black/75 dark:text-stone-400">
                      Detalhamento proporcional dos custos na produção, corte e logística
                    </p>
                  </div>
                  <span className="text-xs font-bold text-black dark:text-stone-200">
                    Total: {formatCurrencyBRL(totalExpensesAmount)}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {Object.entries(categoryTotals).length > 0 ? (
                    Object.entries(categoryTotals).map(([name, { total, color }]) => {
                      const percentage = totalExpensesAmount > 0 ? (total / totalExpensesAmount) * 100 : 0;
                      return (
                        <div key={name} className="space-y-0.5">
                          <div className="flex justify-between text-[11px] font-medium">
                            <span className="text-black dark:text-stone-200 font-bold flex items-center space-x-1.5">
                              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: color }}></span>
                              <span>{name}</span>
                            </span>
                            <span className="font-bold text-black dark:text-stone-100">
                              {formatCurrencyBRL(total)}{' '}
                              <span className="text-black/60 dark:text-stone-400 font-normal">({percentage.toFixed(1)}%)</span>
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-stone-800 rounded-full h-1.5 overflow-hidden border border-slate-200 dark:border-stone-700">
                            <div 
                              className="h-1.5 rounded-full transition-all duration-500" 
                              style={{ width: `${percentage}%`, backgroundColor: color }}
                            ></div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-[11px] text-black/70 dark:text-stone-400">Nenhum lançamento registrado.</p>
                  )}
                </div>
              </div>

              {/* 5. Últimos Lançamentos com Link Rápido (Compacto) */}
              <div className="pt-2 border-t border-slate-200 dark:border-stone-800">
                <div className="flex items-center justify-between mb-1.5">
                  <h4 className="text-[11px] font-black text-black dark:text-white uppercase tracking-wider flex items-center space-x-1.5">
                    <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Últimos Lançamentos Registrados</span>
                  </h4>
                  <button
                    onClick={() => onNavigate('despesas')}
                    className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 flex items-center space-x-1 cursor-pointer"
                  >
                    <span>Ver todas as despesas</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {expenses.slice(0, 4).map((exp) => (
                    <div 
                      key={exp.id} 
                      className="flex items-center justify-between p-1.5 px-2 rounded-lg bg-slate-50 dark:bg-stone-800/50 border border-slate-200 dark:border-stone-800 text-[11px]"
                    >
                      <div className="min-w-0 pr-1.5">
                        <p className="font-bold text-black dark:text-white truncate">
                          {exp.description}
                        </p>
                        <span className="text-[10px] text-black/75 dark:text-stone-400 font-medium">
                          {exp.supplier || 'Sem fornecedor'} • {formatDateBR(exp.dueDate)}
                        </span>
                      </div>
                      <span className="font-black text-black dark:text-white shrink-0">
                        {formatCurrencyBRL(exp.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>

        {/* Right Section: 1 Column - Status da Frota e Máquinas no Pátio (Compacto) */}
        <div className="space-y-2.5">
          <div 
            id="card-status-frota"
            className="crm-card bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-xl p-3 shadow-xs text-zinc-900 dark:text-white"
          >
            
            {/* Header: Status da Frota */}
            <div className="flex items-center space-x-2 pb-2 border-b border-zinc-200 dark:border-stone-800">
              <AlertTriangle className="w-4 h-4 text-zinc-700 dark:text-stone-300" />
              <h3 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white font-['Outfit']">
                Status da Frota
              </h3>
            </div>

            {/* Alert Cards Container */}
            <div className="space-y-1.5 mt-2">
              
              {/* Alert 1: CNH(s) Vencida(s) */}
              <div 
                id="alert-cnh-vencida"
                onClick={() => onNavigate('funcionarios')}
                className="bg-zinc-100 hover:bg-zinc-200/80 dark:bg-stone-800 dark:hover:bg-stone-700/80 text-zinc-900 dark:text-white rounded-lg p-2.5 flex items-center justify-between transition border-l-4 border-red-500 border-t border-r border-b border-zinc-300 dark:border-stone-700 shadow-2xs cursor-pointer group"
              >
                <div className="flex items-center space-x-2.5">
                  <div className="w-6 h-6 rounded-md bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center font-bold text-xs shrink-0 border border-red-200 dark:border-red-900/60">
                    <span>!</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-[11px] text-red-700 dark:text-red-400 leading-tight">
                      {cnhReport.expiredCount} CNH(s) Vencida(s)
                    </h4>
                    <p className="text-[9px] text-zinc-600 dark:text-stone-400 leading-tight">
                      Regularização necessária
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-400 group-hover:translate-x-0.5 transition" />
              </div>

              {/* Alert 2: CNH(s) a Vencer */}
              <div 
                id="alert-cnh-a-vencer"
                onClick={() => onNavigate('funcionarios')}
                className="bg-zinc-100 hover:bg-zinc-200/80 dark:bg-stone-800 dark:hover:bg-stone-700/80 text-zinc-900 dark:text-white rounded-lg p-2.5 flex items-center justify-between transition border-l-4 border-amber-500 border-t border-r border-b border-zinc-300 dark:border-stone-700 shadow-2xs cursor-pointer group"
              >
                <div className="flex items-center space-x-2.5">
                  <div className="w-6 h-6 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-200 dark:border-amber-900/60">
                    <AlertTriangle className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-[11px] text-amber-800 dark:text-amber-400 leading-tight">
                      {cnhReport.expiringIn60DaysCount} CNH(s) a Vencer
                    </h4>
                    <p className="text-[9px] text-zinc-600 dark:text-stone-400 leading-tight">
                      Próximos 60 dias
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-400 group-hover:translate-x-0.5 transition" />
              </div>

            </div>

            {/* Footer status text */}
            <div className="mt-2 pt-2 border-t border-zinc-200 dark:border-stone-800">
              {cnhReport.expiredCount === 0 && cnhReport.expiringIn60DaysCount === 0 ? (
                <div className="flex items-center space-x-1.5 text-[10px] text-zinc-500 dark:text-stone-400 font-semibold">
                  <CheckCircle2 className="w-3 h-3 text-zinc-600 dark:text-stone-400" />
                  <span>Nenhum alerta de CNH pendente.</span>
                </div>
              ) : (
                <div className="space-y-0.5 text-[10px]">
                  <span className="font-bold text-zinc-800 dark:text-stone-200 block">
                    Motoristas com CNH a vencer:
                  </span>
                  {cnhReport.expiringEmployees.map(emp => (
                    <div key={emp.id} className="flex justify-between text-zinc-700 dark:text-stone-300 font-medium">
                      <span className="truncate pr-1">{emp.name}</span>
                      <span className="font-bold shrink-0">{formatDateBR(emp.cnhExpiration)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Button to fleet management */}
            <button
              onClick={() => onNavigate('frotas')}
              className="w-full mt-2 py-1.5 px-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-zinc-800 dark:text-stone-200 text-[11px] font-bold rounded-lg transition flex items-center justify-center space-x-1.5 cursor-pointer border border-zinc-200 dark:border-stone-700"
            >
              <Truck className="w-3.5 h-3.5 text-zinc-700 dark:text-stone-300" />
              <span>Ver Gestão de Frotas</span>
            </button>

          </div>

          {/* Quick Machinery Status Widget */}
          <div className="crm-card bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-xl p-3 shadow-xs text-zinc-900 dark:text-white">
            <h4 className="text-[10px] font-black text-zinc-500 dark:text-stone-400 uppercase tracking-wider mb-2">
              Máquinas no Pátio / Operação
            </h4>
            <div className="space-y-1.5">
              {machineries.slice(0, 3).map((m) => (
                <div key={m.id} className="flex items-center justify-between text-[11px] p-2 rounded-lg bg-zinc-50 dark:bg-stone-800/70 border border-zinc-200 dark:border-stone-700">
                  <div className="min-w-0 pr-1.5">
                    <p className="font-bold text-zinc-900 dark:text-white truncate">{m.name}</p>
                    <span className="text-[10px] text-zinc-500 dark:text-stone-400 font-medium">{m.hourMeter}h de uso</span>
                  </div>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${
                    m.status === 'operacional' 
                      ? 'bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-stone-700 dark:text-stone-200 dark:border-stone-600' 
                      : 'bg-zinc-200 text-zinc-700 border-zinc-300 dark:bg-stone-800 dark:text-stone-400 dark:border-stone-700'
                  }`}>
                    {m.status === 'operacional' ? 'Operacional' : 'Manutenção'}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
