import React, { useState } from 'react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid,
} from 'recharts';
import { ChevronDown, ChevronUp, BarChart2 } from 'lucide-react';
import { Expense } from '../../types';
import { formatCurrencyBRL } from '../../lib/storage';

interface ExpenseChartsProps {
  expenses: Expense[];
}

export const ExpenseCharts: React.FC<ExpenseChartsProps> = ({ expenses }) => {
  const [isOpen, setIsOpen] = useState(true);

  // Aggregate by Category
  const categoryMap: { [name: string]: { name: string; value: number; color: string } } = {};
  
  expenses.forEach((exp) => {
    const key = exp.categoryName || 'Outros';
    if (!categoryMap[key]) {
      categoryMap[key] = {
        name: key,
        value: 0,
        color: exp.categoryColor || '#10b981',
      };
    }
    categoryMap[key].value += exp.amount;
  });

  const categoryData = Object.values(categoryMap).sort((a, b) => b.value - a.value);

  // Aggregate by Cost Center / Type
  const costCenterMap: { [name: string]: number } = {};
  expenses.forEach((exp) => {
    const key = exp.costCenterName || exp.machineryName || 'Geral';
    costCenterMap[key] = (costCenterMap[key] || 0) + exp.amount;
  });

  const costCenterData = Object.entries(costCenterMap)
    .map(([name, amount]) => ({
      name: name.length > 16 ? name.slice(0, 15) + '...' : name,
      fullName: name,
      valor: amount,
    }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 5);

  const total = expenses.reduce((acc, curr) => acc + curr.amount, 0);

  if (expenses.length === 0) {
    return null;
  }

  return (
    <div className="crm-card bg-white dark:bg-stone-900 rounded-2xl border border-zinc-200 dark:border-stone-800 shadow-2xs overflow-hidden mb-3.5 text-zinc-900 dark:text-white">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2.5 flex items-center justify-between bg-zinc-50 dark:bg-stone-800/50 hover:bg-zinc-100 dark:hover:bg-stone-800 transition cursor-pointer text-left"
      >
        <div className="flex items-center space-x-2">
          <span className="p-1 rounded-md bg-zinc-200 dark:bg-emerald-950 text-zinc-800 dark:text-emerald-400 font-black text-xs border border-zinc-300 dark:border-emerald-800">
            Gráficos
          </span>
          <span className="font-black text-zinc-900 dark:text-stone-200 text-xs sm:text-sm">
            Distribuição Visual das Despesas ({categoryData.length} categorias · {formatCurrencyBRL(total)})
          </span>
        </div>
        <div className="flex items-center space-x-1.5 text-xs text-zinc-500 dark:text-stone-400 font-bold">
          <span>{isOpen ? 'Ocultar Gráficos' : 'Expandir Gráficos'}</span>
          <span className="text-zinc-500 dark:text-stone-400">{isOpen ? '▲' : '▼'}</span>
        </div>
      </button>

      {isOpen && (
        <div className="p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-2 gap-3.5 border-t border-zinc-200 dark:border-stone-800 animate-in fade-in duration-150">
          
          {/* Category Breakdown */}
          <div className="p-3 rounded-xl border border-zinc-200 dark:border-stone-800 bg-white dark:bg-stone-800/30 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-black text-zinc-900 dark:text-stone-200 text-xs uppercase tracking-wider">
                Despesas por Categoria
              </h4>
              <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400">
                {categoryData.length} categorias
              </span>
            </div>

            <div className="h-44 sm:h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: number) => [
                      `${formatCurrencyBRL(val)} (${((val / (total || 1)) * 100).toFixed(1)}%)`,
                      'Valor',
                    ]}
                    contentStyle={{ backgroundColor: '#18181b', borderRadius: '8px', color: '#fff', border: '1px solid #27272a', fontSize: '11px', padding: '6px 10px' }}
                    itemStyle={{ color: '#34d399' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend pills */}
            <div className="mt-1 flex flex-wrap gap-1.5 max-h-20 overflow-y-auto pt-1.5 border-t border-zinc-100 dark:border-stone-800">
              {categoryData.slice(0, 8).map((item, idx) => (
                <div key={idx} className="flex items-center space-x-1 text-[10px] text-zinc-700 dark:text-stone-300 bg-zinc-50 dark:bg-stone-800 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-stone-700">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="font-bold truncate max-w-[90px]">{item.name}</span>
                  <span className="text-zinc-500 dark:text-stone-400 font-black">
                    {((item.value / (total || 1)) * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Cost Center / Machinery Bar Chart */}
          <div className="p-3 rounded-xl border border-zinc-200 dark:border-stone-800 bg-white dark:bg-stone-800/30 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-black text-zinc-900 dark:text-stone-200 text-xs uppercase tracking-wider">
                Centros de Custo & Maquinários
              </h4>
              <span className="text-[11px] font-black text-zinc-500 dark:text-stone-400">
                Top destinos
              </span>
            </div>

            <div className="h-44 sm:h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={costCenterData} layout="vertical" margin={{ top: 2, right: 20, left: 0, bottom: 2 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e4e4e7" />
                  <XAxis type="number" tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} fontSize={10} stroke="#71717a" />
                  <YAxis dataKey="name" type="category" width={95} fontSize={10} stroke="#71717a" />
                  <Tooltip
                    formatter={(val: number) => [formatCurrencyBRL(val), 'Gasto']}
                    labelFormatter={(label) => `Destino: ${label}`}
                    contentStyle={{ backgroundColor: '#18181b', borderRadius: '8px', color: '#fff', border: '1px solid #27272a', fontSize: '11px', padding: '6px 10px' }}
                  />
                  <Bar dataKey="valor" fill="#71717a" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-auto pt-1.5 border-t border-zinc-100 dark:border-stone-800 text-[10px] text-zinc-500 dark:text-stone-400 flex justify-between items-center font-bold">
              <span>Recursos distribuídos</span>
              <span className="text-zinc-800 dark:text-stone-300 font-black">{costCenterData.length} centros principais</span>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};
