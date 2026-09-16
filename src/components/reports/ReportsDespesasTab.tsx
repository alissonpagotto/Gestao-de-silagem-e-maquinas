import React, { useState, useMemo } from 'react';
import { 
  DollarSign, 
  Search, 
  Download, 
  PieChart, 
  Filter, 
  Calendar, 
  Building2, 
  CheckCircle2, 
  Clock 
} from 'lucide-react';
import { Expense } from '../../types';
import { formatCurrencyBRL, formatDateBR } from '../../lib/storage';

interface ReportsDespesasTabProps {
  expenses: Expense[];
  startDate: string;
  endDate: string;
}

export const ReportsDespesasTab: React.FC<ReportsDespesasTabProps> = ({
  expenses,
  startDate,
  endDate,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('todas');
  const [selectedStatus, setSelectedStatus] = useState('todos');

  // Categories list
  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    expenses.forEach(e => {
      if (e.categoryName) set.add(e.categoryName);
    });
    return Array.from(set);
  }, [expenses]);

  // Filtered Expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const matchDate = e.dueDate >= startDate && e.dueDate <= endDate;
      const matchSearch = 
        e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.supplier && e.supplier.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (e.costCenterName && e.costCenterName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (e.machineryName && e.machineryName.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchCategory = selectedCategory === 'todas' || e.categoryName === selectedCategory;
      const matchStatus = selectedStatus === 'todos' || e.status === selectedStatus;
      return matchDate && matchSearch && matchCategory && matchStatus;
    });
  }, [expenses, startDate, endDate, searchTerm, selectedCategory, selectedStatus]);

  // KPIs
  const totalAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const paidAmount = filteredExpenses.filter(e => e.status === 'pago').reduce((sum, e) => sum + e.amount, 0);
  const pendingAmount = filteredExpenses.filter(e => e.status !== 'pago').reduce((sum, e) => sum + e.amount, 0);

  const handleExportCsv = () => {
    const headers = 'Data_Vencimento,Descricao,Categoria,Fornecedor,Centro_Custo,Maquina,Valor,Status,Data_Pagamento\n';
    const rows = filteredExpenses.map(e => 
      `"${e.dueDate}","${e.description}","${e.categoryName}","${e.supplier || ''}","${e.costCenterName || ''}","${e.machineryName || ''}","${e.amount}","${e.status}","${e.paymentDate || ''}"`
    ).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio_despesas_${startDate}_a_${endDate}.csv`;
    link.click();
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      
      {/* Top Header */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center text-rose-600 dark:text-rose-400">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
              Relatório Analítico de Custos & Despesas
            </h3>
            <p className="text-xs text-stone-500">
              Discriminação de gastos por categoria, fornecedor, safra e centro de custos
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-3.5 py-1.5 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 font-bold text-xs rounded-xl transition cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Exportar Despesas (CSV)</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
        
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-3.5 shadow-2xs border-l-4 border-l-rose-500">
          <span className="text-[11px] font-bold text-stone-500 uppercase block">Total Despesas no Período</span>
          <div className="text-lg sm:text-xl font-black text-rose-600 dark:text-rose-400 mt-0.5">
            {formatCurrencyBRL(totalAmount)}
          </div>
          <span className="text-[10px] text-stone-400">{filteredExpenses.length} lançamentos</span>
        </div>

        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-3.5 shadow-2xs border-l-4 border-l-emerald-500">
          <span className="text-[11px] font-bold text-stone-500 uppercase block">Despesas Pagas (Quitadas)</span>
          <div className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
            {formatCurrencyBRL(paidAmount)}
          </div>
          <span className="text-[10px] text-stone-400">{filteredExpenses.filter(e => e.status === 'pago').length} quitadas</span>
        </div>

        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-3.5 shadow-2xs border-l-4 border-l-amber-500">
          <span className="text-[11px] font-bold text-stone-500 uppercase block">A Pagar (Pendentes)</span>
          <div className="text-lg sm:text-xl font-black text-amber-600 dark:text-amber-400 mt-0.5">
            {formatCurrencyBRL(pendingAmount)}
          </div>
          <span className="text-[10px] text-stone-400">{filteredExpenses.filter(e => e.status !== 'pago').length} pendências</span>
        </div>

      </div>

      {/* Filter and Search */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-3 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-2.5">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por descrição, fornecedor ou máquina..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 outline-none focus:ring-1 focus:ring-[#009688]"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full sm:w-auto px-3 py-1.5 text-xs font-semibold rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200"
          >
            <option value="todas">Todas as categorias</option>
            {categoryOptions.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full sm:w-auto px-3 py-1.5 text-xs font-semibold rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200"
          >
            <option value="todos">Todos os status</option>
            <option value="pago">Pagas</option>
            <option value="pendente">Pendentes</option>
            <option value="atrasado">Atrasadas</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 dark:bg-stone-800/70 text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider border-b border-stone-200 dark:border-stone-800">
              <tr>
                <th className="py-3 px-3.5">Vencimento</th>
                <th className="py-3 px-3.5">Descrição</th>
                <th className="py-3 px-3.5">Categoria</th>
                <th className="py-3 px-3.5">Fornecedor</th>
                <th className="py-3 px-3.5">Centro Custo / Safra</th>
                <th className="py-3 px-3.5">Máquina / Veículo</th>
                <th className="py-3 px-3.5 text-right">Valor (R$)</th>
                <th className="py-3 px-3.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              {filteredExpenses.length > 0 ? (
                filteredExpenses.map((item) => (
                  <tr key={item.id} className="hover:bg-stone-50/70 dark:hover:bg-stone-800/40 transition">
                    <td className="py-2.5 px-3.5 whitespace-nowrap text-stone-600 dark:text-stone-400">
                      {formatDateBR(item.dueDate)}
                    </td>
                    <td className="py-2.5 px-3.5 font-bold text-stone-900 dark:text-stone-100">
                      {item.description}
                    </td>
                    <td className="py-2.5 px-3.5 font-medium text-stone-700 dark:text-stone-300">
                      <span className="inline-flex items-center space-x-1">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.categoryColor || '#78716c' }} />
                        <span>{item.categoryName}</span>
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 text-stone-600 dark:text-stone-400">
                      {item.supplier || '-'}
                    </td>
                    <td className="py-2.5 px-3.5 text-stone-600 dark:text-stone-400">
                      {item.costCenterName || '-'}
                    </td>
                    <td className="py-2.5 px-3.5 text-stone-600 dark:text-stone-400">
                      {item.machineryName || '-'}
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-black text-rose-600 dark:text-rose-400 whitespace-nowrap">
                      {formatCurrencyBRL(item.amount)}
                    </td>
                    <td className="py-2.5 px-3.5 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        item.status === 'pago'
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                          : item.status === 'atrasado'
                          ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                          : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-stone-400">
                    Nenhuma despesa localizada no período e filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
