import React from 'react';
import { 
  CheckCircle2, 
  Clock, 
  AlertOctagon, 
  Fuel, 
  TrendingDown, 
  Tractor,
  Layers,
  Utensils
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

  // Gasto com Alimentação (na competência filtrada)
  const foodExpenseItems = expenses.filter((e) => {
    const catId = String(e?.categoryId ?? '').toLowerCase().trim();
    const catName = String(e?.categoryName ?? e?.category ?? '').toLowerCase().trim();
    return (
      catId === 'cat_alimentacao' ||
      catName === 'alimentação' ||
      catName === 'alimentacao' ||
      catName.includes('aliment') ||
      catName.includes('refei') ||
      catName.includes('marmit') ||
      catName.includes('restaurante')
    );
  });
  const foodExpensesTotal = foodExpenseItems.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  const foodExpensesCount = foodExpenseItems.length;
  const foodExpensesPercent = totalExpenses > 0 ? (foodExpensesTotal / totalExpenses) * 100 : 0;

  return (
    <div className="shrink-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
      
      {/* Card 1: Total Geral & Pagas */}
      <div 
        id="card-despesas-total"
        className="bg-[#e0e6f1] dark:bg-stone-900 py-2 px-3 rounded-lg border border-black dark:border-stone-800 shadow-xs text-black dark:text-white"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-black text-slate-700 dark:text-stone-300 uppercase tracking-wider leading-none">Total em Despesas</span>
          <div className="p-1 rounded-lg bg-white/80 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-black/20 dark:border-emerald-800/60 shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-0.5 leading-tight">
          <span className="text-lg sm:text-xl font-black text-black dark:text-white tracking-tight font-['Outfit'] leading-tight">
            {formatCurrencyBRL(totalExpenses)}
          </span>
        </div>
        <div className="mt-1 text-[10.5px] text-slate-700 dark:text-stone-300 flex items-center justify-between pt-1 border-t border-black/20 dark:border-stone-800 leading-tight">
          <span>Pagas: <strong className="text-black dark:text-emerald-400 font-bold">{formatCurrencyBRL(paidExpenses)}</strong></span>
          <span className="text-slate-700 dark:text-stone-400 font-bold">{expenses.length} lançamentos</span>
        </div>
      </div>

      {/* Card 2: Contas a Pagar / Pendentes */}
      <div 
        id="card-despesas-pendentes"
        className="bg-[#e0e6f1] dark:bg-stone-900 py-2 px-3 rounded-lg border border-black dark:border-stone-800 shadow-xs text-black dark:text-white"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-black text-slate-700 dark:text-stone-300 uppercase tracking-wider leading-none">A Pagar / Pendentes</span>
          <div className="p-1 rounded-lg bg-white/80 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-black/20 dark:border-amber-800/60 shrink-0">
            <Clock className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-0.5 leading-tight">
          <span className="text-lg sm:text-xl font-black text-black dark:text-amber-400 tracking-tight font-['Outfit'] leading-tight">
            {formatCurrencyBRL(pendingExpenses)}
          </span>
        </div>
        <div className="mt-1 text-[10.5px] text-slate-700 dark:text-stone-300 flex items-center justify-between pt-1 border-t border-black/20 dark:border-stone-800 leading-tight">
          <span className="font-bold">Vencem em breve</span>
          {overdueExpenses > 0 ? (
            <span className="text-rose-700 dark:text-rose-400 font-black flex items-center gap-1">
              <AlertOctagon className="w-3 h-3" />
              {formatCurrencyBRL(overdueExpenses)} vencido
            </span>
          ) : (
            <span className="text-emerald-800 dark:text-emerald-400 font-bold">Em dia</span>
          )}
        </div>
      </div>

      {/* Card 3: Custo Operacional (Diesel & Peças) */}
      <div 
        id="card-despesas-diesel"
        className="bg-[#e0e6f1] dark:bg-stone-900 py-2 px-3 rounded-lg border border-black dark:border-stone-800 shadow-xs text-black dark:text-white"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-black text-slate-700 dark:text-stone-300 uppercase tracking-wider leading-none">Diesel & Manutenção</span>
          <div className="p-1 rounded-lg bg-white/80 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-black/20 dark:border-blue-800/60 shrink-0">
            <Tractor className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-0.5 leading-tight">
          <span className="text-lg sm:text-xl font-black text-black dark:text-white tracking-tight font-['Outfit'] leading-tight">
            {formatCurrencyBRL(fuelExpenses + maintenanceExpenses)}
          </span>
        </div>
        <div className="mt-1 text-[10.5px] text-slate-700 dark:text-stone-300 flex items-center justify-between pt-1 border-t border-black/20 dark:border-stone-800 leading-tight">
          <span>Diesel: <strong className="text-black dark:text-amber-400 font-bold">{formatCurrencyBRL(fuelExpenses)}</strong></span>
          <span>Peças: <strong className="text-black dark:text-rose-400 font-bold">{formatCurrencyBRL(maintenanceExpenses)}</strong></span>
        </div>
      </div>

      {/* Card 4: Gasto com Alimentação */}
      <div 
        id="card-despesas-alimentacao"
        className="bg-[#e0e6f1] dark:bg-stone-900 py-2 px-3 rounded-lg border border-black dark:border-stone-800 shadow-xs text-black dark:text-white"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-black text-slate-700 dark:text-stone-300 uppercase tracking-wider leading-none">Gasto com Alimentação</span>
          <div className="p-1 rounded-lg bg-white/80 dark:bg-orange-950/60 text-orange-700 dark:text-orange-400 border border-black/20 dark:border-orange-800/60 shrink-0">
            <Utensils className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-0.5 leading-tight">
          <span className="text-lg sm:text-xl font-black text-black dark:text-white tracking-tight font-['Outfit'] leading-tight">
            {formatCurrencyBRL(foodExpensesTotal)}
          </span>
        </div>
        <div className="mt-1 text-[10.5px] text-slate-700 dark:text-stone-300 flex items-center justify-between pt-1 border-t border-black/20 dark:border-stone-800 leading-tight">
          <span className="font-bold">
            {foodExpensesCount} {foodExpensesCount === 1 ? 'lançamento' : 'lançamentos'}
          </span>
          <span className="font-bold text-black dark:text-white">
            {foodExpensesPercent.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% do total
          </span>
        </div>
      </div>

    </div>
  );
};
