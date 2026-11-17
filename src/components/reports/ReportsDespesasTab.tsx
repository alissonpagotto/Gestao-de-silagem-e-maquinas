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
import { 
  CompetenceSelector, 
  getPrevCompetence, 
  getNextCompetence 
} from '../financial/CompetenceSelector';

interface ReportsDespesasTabProps {
  expenses: Expense[];
  startDate: string;
  endDate: string;
  competence?: string;
  onCompetenceChange?: (comp: string) => void;
  onStartDateChange?: (d: string) => void;
  onEndDateChange?: (d: string) => void;
}

export const ReportsDespesasTab: React.FC<ReportsDespesasTabProps> = ({
  expenses,
  startDate,
  endDate,
  competence,
  onCompetenceChange,
  onStartDateChange,
  onEndDateChange,
}) => {
  const activeCompetence = useMemo(() => {
    if (competence) return competence;
    if (startDate && startDate.length >= 7) {
      const [y, m] = startDate.split('-');
      return `${m}/${y}`;
    }
    const now = new Date();
    return `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  }, [competence, startDate]);

  const handlePrev = () => {
    const nextComp = getPrevCompetence(activeCompetence);
    onCompetenceChange?.(nextComp);
  };

  const handleNext = () => {
    const nextComp = getNextCompetence(activeCompetence);
    onCompetenceChange?.(nextComp);
  };
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
    const term = (searchTerm || '').toLowerCase().trim();
    return (expenses || []).filter(e => {
      const matchDate = e?.dueDate ? (e.dueDate >= startDate && e.dueDate <= endDate) : false;
      const matchSearch = !term ||
        Boolean(e.description?.toLowerCase().includes(term)) ||
        Boolean(e.supplier?.toLowerCase().includes(term)) ||
        Boolean(e.costCenterName?.toLowerCase().includes(term)) ||
        Boolean(e.machineryName?.toLowerCase().includes(term));
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
    <div className="flex-1 min-h-0 h-full max-h-full flex flex-col gap-2.5 overflow-hidden animate-fade-in financial-subtab-clean">
      
      {/* 1. Cards de Resumo Finos e Compactos */}
      <div className="shrink-0 grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-2.5">
        
        <div className="bg-[#e0e6f1] dark:bg-stone-900 rounded-lg py-2 px-3 border border-black dark:border-stone-800 border-l-[3px] border-l-rose-500 shadow-2xs flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center shrink-0 border border-black/15">
            <DollarSign className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 block leading-tight truncate">
              Total Despesas no Período
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-x-2">
              <div className="text-sm sm:text-base font-black text-rose-700 dark:text-rose-400 font-['Outfit'] leading-tight truncate">
                {formatCurrencyBRL(totalAmount)}
              </div>
              <div className="text-[10px] text-stone-600 leading-tight truncate">
                {filteredExpenses.length} lançamentos
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#e0e6f1] dark:bg-stone-900 rounded-lg py-2 px-3 border border-black dark:border-stone-800 border-l-[3px] border-l-emerald-500 shadow-2xs flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center shrink-0 border border-black/15">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 block leading-tight truncate">
              Despesas Pagas (Quitadas)
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-x-2">
              <div className="text-sm sm:text-base font-black text-emerald-700 dark:text-emerald-400 font-['Outfit'] leading-tight truncate">
                {formatCurrencyBRL(paidAmount)}
              </div>
              <div className="text-[10px] text-stone-600 leading-tight truncate">
                {filteredExpenses.filter(e => e.status === 'pago').length} quitadas
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#e0e6f1] dark:bg-stone-900 rounded-lg py-2 px-3 border border-black dark:border-stone-800 border-l-[3px] border-l-amber-500 shadow-2xs flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center shrink-0 border border-black/15">
            <Clock className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 block leading-tight truncate">
              A Pagar (Pendentes)
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-x-2">
              <div className="text-sm sm:text-base font-black text-amber-700 dark:text-amber-400 font-['Outfit'] leading-tight truncate">
                {formatCurrencyBRL(pendingAmount)}
              </div>
              <div className="text-[10px] text-stone-600 leading-tight truncate">
                {filteredExpenses.filter(e => e.status !== 'pago').length} pendências
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* 2. Filtros, Busca, Competência e Exportação */}
      <div className="shrink-0 bg-[#cad4e6] dark:bg-stone-900 px-3 py-2 rounded-lg border border-black dark:border-stone-800 shadow-xs flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por descrição, fornecedor ou máquina..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#009688]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#009688]"
          >
            <option value="todas">Todas as categorias</option>
            {categoryOptions.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#009688]"
          >
            <option value="todos">Todos os status</option>
            <option value="pago">Pagas</option>
            <option value="pendente">Pendentes</option>
            <option value="atrasado">Atrasadas</option>
          </select>

          <CompetenceSelector
            competence={activeCompetence}
            onPrev={handlePrev}
            onNext={handleNext}
          />

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-[#e0e6f1] dark:bg-stone-800 text-black dark:text-stone-300 hover:bg-[#d2dced] dark:hover:bg-stone-700 border border-black dark:border-stone-700 font-bold text-xs rounded-lg transition cursor-pointer shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar Despesas (CSV)</span>
          </button>
        </div>
      </div>

      {/* 3. Tabela */}
      <div className="flex-1 min-h-0 flex flex-col bg-[#e0e6f1] dark:bg-stone-900 border border-black dark:border-stone-800 rounded-lg overflow-hidden shadow-xs">
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 text-[11px] font-bold text-black dark:text-stone-300 uppercase tracking-wider border-b border-black dark:border-stone-700 shadow-sm">
              <tr>
                <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5">Vencimento</th>
                <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5">Descrição</th>
                <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5">Categoria</th>
                <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5">Fornecedor</th>
                <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5">Centro Custo / Safra</th>
                <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5">Máquina / Veículo</th>
                <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5 text-right">Valor (R$)</th>
                <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="bg-[#e0e6f1] divide-y divide-black/15 dark:divide-stone-800">
              {filteredExpenses.length > 0 ? (
                filteredExpenses.map((item) => (
                  <tr key={item.id} className="bg-[#e0e6f1] dark:bg-stone-900 hover:bg-[#d2dced] dark:hover:bg-stone-800 transition border-b border-black/20 dark:border-stone-800">
                    <td className="py-2.5 px-3.5 whitespace-nowrap text-stone-700 dark:text-stone-400">
                      {formatDateBR(item.dueDate)}
                    </td>
                    <td className="py-2.5 px-3.5 font-bold text-stone-900 dark:text-stone-100">
                      {item.description}
                    </td>
                    <td className="py-2.5 px-3.5 font-medium text-stone-800 dark:text-stone-300">
                      <span className="inline-flex items-center space-x-1">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.categoryColor || '#78716c' }} />
                        <span>{item.categoryName}</span>
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 text-stone-700 dark:text-stone-400">
                      {item.supplier || '-'}
                    </td>
                    <td className="py-2.5 px-3.5 text-stone-700 dark:text-stone-400">
                      {item.costCenterName || '-'}
                    </td>
                    <td className="py-2.5 px-3.5 text-stone-700 dark:text-stone-400">
                      {item.machineryName || '-'}
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-black text-rose-700 dark:text-rose-400 whitespace-nowrap">
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
                  <td colSpan={8} className="py-8 text-center text-stone-600 bg-[#e0e6f1] dark:bg-stone-900">
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
