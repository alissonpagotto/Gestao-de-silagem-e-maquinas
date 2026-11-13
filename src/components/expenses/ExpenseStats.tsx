import React from 'react';
import { 
  CheckCircle2, 
  Clock, 
  AlertOctagon, 
  Fuel, 
  TrendingDown, 
  Tractor,
  Layers,
  Scale
} from 'lucide-react';
import { Expense, Machinery, CropSeason } from '../../types';
import { formatCurrencyBRL } from '../../lib/storage';

interface ExpenseStatsProps {
  expenses: Expense[];
  machineries: Machinery[];
  seasons: CropSeason[];
}

export const ExpenseStats: React.FC<ExpenseStatsProps> = ({
  expenses,
  machineries,
  seasons,
}) => {
  // Calculations
  const totalExpenses = expenses.reduce((acc, curr) => acc + curr.amount, 0);
  const paidExpenses = expenses
    .filter((e) => e.status === 'pago')
    .reduce((acc, curr) => acc + curr.amount, 0);
  const pendingExpenses = expenses
    .filter((e) => e.status === 'pendente' || e.status === 'agendado')
    .reduce((acc, curr) => acc + curr.amount, 0);
  const overdueExpenses = expenses
    .filter((e) => e.status === 'atrasado')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const fuelExpenses = expenses
    .filter((e) => e.categoryId === 'cat_combustivel')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const maintenanceExpenses = expenses
    .filter((e) => e.categoryId === 'cat_manutencao')
    .reduce((acc, curr) => acc + curr.amount, 0);

  // Silage specific metric: Cost per Estimated Ton & Cost per Hectare
  const currentSeason = Array.isArray(seasons) && seasons.length > 0 ? seasons[0] : null;
  const totalTons = (currentSeason?.estimatedTons && currentSeason.estimatedTons > 0) ? currentSeason.estimatedTons : 0;
  const costPerTon = totalTons > 0 ? totalExpenses / totalTons : 0;
  const plantedHectares = (currentSeason?.plantedHectares && currentSeason.plantedHectares > 0)
    ? currentSeason.plantedHectares
    : (currentSeason?.totalAreaHectares && currentSeason.totalAreaHectares > 0)
      ? currentSeason.totalAreaHectares
      : 0;
  const costPerHectare = plantedHectares > 0 ? totalExpenses / plantedHectares : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
      
      {/* Card 1: Total Geral & Pagas */}
      <div 
        id="card-despesas-total"
        className="bg-white dark:bg-stone-900 py-2 px-3 rounded-2xl border border-black dark:border-stone-800 shadow-xs text-zinc-900 dark:text-white"
        style={{ backgroundColor: '#ffffff', border: '1px solid #000000' }}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-black text-zinc-500 dark:text-stone-300 uppercase tracking-wider leading-none">Total em Despesas</span>
          <div className="p-1 rounded-lg bg-zinc-100 dark:bg-emerald-950/60 text-zinc-700 dark:text-emerald-400 border border-zinc-200 dark:border-emerald-800/60 shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-0.5 leading-tight">
          <span className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white tracking-tight font-['Outfit'] leading-tight">
            {formatCurrencyBRL(totalExpenses)}
          </span>
        </div>
        <div className="mt-1 text-[10.5px] text-zinc-500 dark:text-stone-300 flex items-center justify-between pt-1 border-t border-zinc-100 dark:border-stone-800 leading-tight">
          <span>Pagas: <strong className="text-zinc-900 dark:text-emerald-400 font-bold">{formatCurrencyBRL(paidExpenses)}</strong></span>
          <span className="text-zinc-500 dark:text-stone-400 font-bold">{expenses.length} lançamentos</span>
        </div>
      </div>

      {/* Card 2: Contas a Pagar / Pendentes */}
      <div 
        id="card-despesas-pendentes"
        className="bg-white dark:bg-stone-900 py-2 px-3 rounded-2xl border border-black dark:border-stone-800 shadow-xs text-zinc-900 dark:text-white"
        style={{ backgroundColor: '#ffffff', border: '1px solid #000000' }}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-black text-zinc-500 dark:text-stone-300 uppercase tracking-wider leading-none">A Pagar / Pendentes</span>
          <div className="p-1 rounded-lg bg-zinc-100 dark:bg-amber-950/60 text-zinc-700 dark:text-amber-400 border border-zinc-200 dark:border-amber-800/60 shrink-0">
            <Clock className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-0.5 leading-tight">
          <span className="text-lg sm:text-xl font-black text-zinc-900 dark:text-amber-400 tracking-tight font-['Outfit'] leading-tight">
            {formatCurrencyBRL(pendingExpenses)}
          </span>
        </div>
        <div className="mt-1 text-[10.5px] text-zinc-500 dark:text-stone-300 flex items-center justify-between pt-1 border-t border-zinc-100 dark:border-stone-800 leading-tight">
          <span className="font-bold">Vencem em breve</span>
          {overdueExpenses > 0 ? (
            <span className="text-rose-600 dark:text-rose-400 font-black flex items-center gap-1">
              <AlertOctagon className="w-3 h-3" />
              {formatCurrencyBRL(overdueExpenses)} vencido
            </span>
          ) : (
            <span className="text-zinc-700 dark:text-emerald-400 font-bold">Em dia</span>
          )}
        </div>
      </div>

      {/* Card 3: Custo Operacional (Diesel & Peças) */}
      <div 
        id="card-despesas-diesel"
        className="bg-white dark:bg-stone-900 py-2 px-3 rounded-2xl border border-black dark:border-stone-800 shadow-xs text-zinc-900 dark:text-white"
        style={{ backgroundColor: '#ffffff', border: '1px solid #000000' }}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-black text-zinc-500 dark:text-stone-300 uppercase tracking-wider leading-none">Diesel & Manutenção</span>
          <div className="p-1 rounded-lg bg-zinc-100 dark:bg-blue-950/60 text-zinc-700 dark:text-blue-400 border border-zinc-200 dark:border-blue-800/60 shrink-0">
            <Tractor className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-0.5 leading-tight">
          <span className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white tracking-tight font-['Outfit'] leading-tight">
            {formatCurrencyBRL(fuelExpenses + maintenanceExpenses)}
          </span>
        </div>
        <div className="mt-1 text-[10.5px] text-zinc-500 dark:text-stone-300 flex items-center justify-between pt-1 border-t border-zinc-100 dark:border-stone-800 leading-tight">
          <span>Diesel: <strong className="text-zinc-800 dark:text-amber-400 font-bold">{formatCurrencyBRL(fuelExpenses)}</strong></span>
          <span>Peças: <strong className="text-zinc-800 dark:text-rose-400 font-bold">{formatCurrencyBRL(maintenanceExpenses)}</strong></span>
        </div>
      </div>

      {/* Card 4: Indicador de Custo por Tonelada de Silagem */}
      <div 
        id="card-despesas-custo-ton"
        className="bg-white dark:bg-stone-900 py-2 px-3 rounded-2xl border border-black dark:border-stone-800 shadow-xs text-zinc-900 dark:text-white"
        style={{ backgroundColor: '#ffffff', border: '1px solid #000000' }}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-black text-zinc-500 dark:text-stone-300 uppercase tracking-wider leading-none">Custo / Tonelada</span>
          <div className="p-1 rounded-lg bg-zinc-100 dark:bg-emerald-900/80 text-zinc-700 dark:text-emerald-400 border border-zinc-200 dark:border-emerald-700/50 shrink-0">
            <Scale className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-0.5 leading-tight">
          <span className="text-lg sm:text-xl font-black text-zinc-900 dark:text-emerald-300 tracking-tight font-['Outfit'] leading-tight">
            {formatCurrencyBRL(costPerTon)}
            <span className="text-[10px] font-bold text-zinc-500 dark:text-emerald-400/80 ml-1">/ ton</span>
          </span>
        </div>
        <div className="mt-1 text-[10.5px] text-zinc-500 dark:text-stone-300 flex items-center justify-between pt-1 border-t border-zinc-100 dark:border-stone-800 leading-tight">
          <span>Safra: {currentSeason?.name ? currentSeason.name.slice(0, 15) + '...' : 'Atual'}</span>
          <span className="font-bold text-zinc-900 dark:text-white">{formatCurrencyBRL(costPerHectare)}/ha</span>
        </div>
      </div>

    </div>
  );
};
