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

  // Silage specific metric: Cost per Estimated Ton
  const currentSeason = seasons[0];
  const totalTons = currentSeason?.estimatedTons || 2000;
  const costPerTon = totalTons > 0 ? totalExpenses / totalTons : 0;
  const costPerHectare = (currentSeason?.plantedHectares || 45) > 0 ? totalExpenses / (currentSeason.plantedHectares || 45) : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 mb-3.5">
      
      {/* Total Geral & Pagas */}
      <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 p-3 sm:p-3.5 rounded-2xl border border-blue-200/80 dark:border-stone-800 shadow-xs text-black dark:text-white">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black text-black dark:text-stone-300 uppercase tracking-wider">Total em Despesas</span>
          <div className="p-1.5 rounded-lg bg-blue-100/70 dark:bg-emerald-950/60 text-black dark:text-emerald-400 border border-blue-200/80 dark:border-emerald-800/60">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-1">
          <span className="text-xl sm:text-2xl font-black text-black dark:text-white tracking-tight font-['Outfit']">
            {formatCurrencyBRL(totalExpenses)}
          </span>
        </div>
        <div className="mt-1 text-[11px] text-black/85 dark:text-stone-300 flex items-center justify-between pt-1.5 border-t border-blue-200/60 dark:border-stone-800">
          <span>Pagas: <strong className="text-black dark:text-emerald-400 font-bold">{formatCurrencyBRL(paidExpenses)}</strong></span>
          <span className="text-black/75 dark:text-stone-400 font-bold">{expenses.length} lançamentos</span>
        </div>
      </div>

      {/* Contas a Pagar / Pendentes */}
      <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 p-3 sm:p-3.5 rounded-2xl border border-blue-200/80 dark:border-stone-800 shadow-xs text-black dark:text-white">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black text-black dark:text-stone-300 uppercase tracking-wider">A Pagar / Pendentes</span>
          <div className="p-1.5 rounded-lg bg-blue-100/70 dark:bg-amber-950/60 text-black dark:text-amber-400 border border-blue-200/80 dark:border-amber-800/60">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-1">
          <span className="text-xl sm:text-2xl font-black text-black dark:text-amber-400 tracking-tight font-['Outfit']">
            {formatCurrencyBRL(pendingExpenses)}
          </span>
        </div>
        <div className="mt-1 text-[11px] text-black/85 dark:text-stone-300 flex items-center justify-between pt-1.5 border-t border-blue-200/60 dark:border-stone-800">
          <span className="font-bold">Vencem em breve</span>
          {overdueExpenses > 0 ? (
            <span className="text-rose-900 dark:text-rose-400 font-black flex items-center gap-1">
              <AlertOctagon className="w-3 h-3" />
              {formatCurrencyBRL(overdueExpenses)} vencido
            </span>
          ) : (
            <span className="text-black dark:text-emerald-400 font-bold">Em dia</span>
          )}
        </div>
      </div>

      {/* Custo Operacional (Diesel & Peças) */}
      <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 p-3 sm:p-3.5 rounded-2xl border border-blue-200/80 dark:border-stone-800 shadow-xs text-black dark:text-white">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black text-black dark:text-stone-300 uppercase tracking-wider">Diesel & Manutenção</span>
          <div className="p-1.5 rounded-lg bg-blue-100/70 dark:bg-blue-950/60 text-black dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/60">
            <Tractor className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-1">
          <span className="text-xl sm:text-2xl font-black text-black dark:text-white tracking-tight font-['Outfit']">
            {formatCurrencyBRL(fuelExpenses + maintenanceExpenses)}
          </span>
        </div>
        <div className="mt-1 text-[11px] text-black/85 dark:text-stone-300 flex items-center justify-between pt-1.5 border-t border-blue-200/60 dark:border-stone-800">
          <span>Diesel: <strong className="text-black dark:text-amber-400 font-bold">{formatCurrencyBRL(fuelExpenses)}</strong></span>
          <span>Peças: <strong className="text-black dark:text-rose-400 font-bold">{formatCurrencyBRL(maintenanceExpenses)}</strong></span>
        </div>
      </div>

      {/* Indicador de Custo por Tonelada de Silagem */}
      <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 p-3 sm:p-3.5 rounded-2xl border border-blue-200/80 dark:border-stone-800 shadow-xs text-black dark:text-white">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black text-black dark:text-stone-300 uppercase tracking-wider">Custo / Tonelada</span>
          <div className="p-1.5 rounded-lg bg-blue-100/70 dark:bg-emerald-900/80 text-black dark:text-emerald-400 border border-blue-200/80 dark:border-emerald-700/50">
            <Scale className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-1">
          <span className="text-xl sm:text-2xl font-black text-black dark:text-emerald-300 tracking-tight font-['Outfit']">
            {formatCurrencyBRL(costPerTon)}
            <span className="text-[10px] font-bold text-black/80 dark:text-emerald-400/80 ml-1">/ ton</span>
          </span>
        </div>
        <div className="mt-1 text-[11px] text-black/85 dark:text-stone-300 flex items-center justify-between pt-1.5 border-t border-blue-200/60 dark:border-stone-800">
          <span>Safra: {currentSeason?.name ? currentSeason.name.slice(0, 15) + '...' : 'Atual'}</span>
          <span className="font-bold text-black dark:text-white">{formatCurrencyBRL(costPerHectare)}/ha</span>
        </div>
      </div>

    </div>
  );
};
