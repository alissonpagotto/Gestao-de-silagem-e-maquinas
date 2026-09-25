import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Calendar, 
  Download, 
  Printer, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Paperclip, 
  MoreVertical, 
  Edit3, 
  Trash2, 
  Copy, 
  Plus, 
  FileSpreadsheet,
  Tractor,
  ArrowUpDown,
  Check,
  Building2,
  Layers,
  MessageCircle
} from 'lucide-react';
import { Expense, ExpenseCategory, ExpenseStatus, CostCenter, CompanyProfile, Employee, FleetTeam } from '../../types';
import { formatCurrencyBRL, formatDateBR, getStoredCompanyProfile } from '../../lib/storage';
import { PrintPreviewModal } from '../common/PrintPreviewModal';

interface ExpenseListProps {
  expenses: Expense[];
  categories: ExpenseCategory[];
  costCenters: CostCenter[];
  employees?: Employee[];
  teams?: FleetTeam[];
  companyProfile?: CompanyProfile;
  onNewExpense: () => void;
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (id: string) => void;
  onToggleStatus: (id: string, newStatus: ExpenseStatus) => void;
  onViewReceipt: (expense: Expense) => void;
  onDuplicateExpense: (expense: Expense) => void;
}

export const ExpenseList: React.FC<ExpenseListProps> = ({
  expenses,
  categories,
  costCenters,
  employees = [],
  teams = [],
  companyProfile,
  onNewExpense,
  onEditExpense,
  onDeleteExpense,
  onToggleStatus,
  onViewReceipt,
  onDuplicateExpense,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('todos');
  const [selectedCategory, setSelectedCategory] = useState<string>('todas');
  const [selectedCostCenter, setSelectedCostCenter] = useState<string>('todos');
  const [sortBy, setSortBy] = useState<'date_asc' | 'date_desc' | 'amount_desc' | 'amount_asc'>('date_asc');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const activeCompany = useMemo(() => {
    return companyProfile || getStoredCompanyProfile();
  }, [companyProfile]);

  // Filter logic
  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      // Search term
      const matchesSearch = 
        exp.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exp.supplier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exp.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exp.categoryName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exp.machineryName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exp.employeeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exp.teamName?.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      // Status
      if (selectedStatus !== 'todos' && exp.status !== selectedStatus) {
        return false;
      }

      // Category
      if (selectedCategory !== 'todas' && exp.categoryId !== selectedCategory) {
        return false;
      }

      // Cost Center
      if (selectedCostCenter !== 'todos' && exp.costCenterId !== selectedCostCenter) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      const dateA = (a.dueDate || '').trim();
      const dateB = (b.dueDate || '').trim();

      if (sortBy === 'date_asc') {
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        return (a.description || '').localeCompare(b.description || '');
      }
      if (sortBy === 'date_desc') {
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        return (b.description || '').localeCompare(a.description || '');
      }
      if (sortBy === 'amount_desc') return b.amount - a.amount;
      if (sortBy === 'amount_asc') return a.amount - b.amount;
      return 0;
    });
  }, [expenses, searchTerm, selectedStatus, selectedCategory, selectedCostCenter, sortBy]);

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'ID',
      'Descricao',
      'Valor (R$)',
      'Categoria',
      'Status',
      'Vencimento',
      'Data Pagamento',
      'Forma Pagamento',
      'Fornecedor',
      'Maquinario',
      'Centro de Custo',
      'NF',
      'Obs'
    ];

    const rows = filteredExpenses.map((exp) => [
      exp.id,
      `"${exp.description.replace(/"/g, '""')}"`,
      exp.amount.toFixed(2),
      `"${exp.categoryName}"`,
      exp.status,
      exp.dueDate,
      exp.paymentDate || '',
      exp.paymentMethod,
      `"${(exp.supplier || '').replace(/"/g, '""')}"`,
      `"${(exp.machineryName || '').replace(/"/g, '""')}"`,
      `"${(exp.costCenterName || '').replace(/"/g, '""')}"`,
      `"${exp.invoiceNumber || ''}"`,
      `"${(exp.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + 
      [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `despesas_silagem_facil_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: ExpenseStatus) => {
    switch (status) {
      case 'pago':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Pago</span>
          </span>
        );
      case 'pendente':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            <span>Pendente</span>
          </span>
        );
      case 'atrasado':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <AlertCircle className="w-3 h-3 text-rose-600" />
            <span>Atrasado</span>
          </span>
        );
      case 'agendado':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <Calendar className="w-3 h-3 text-blue-600" />
            <span>Agendado</span>
          </span>
        );
      case 'compensado_estoque':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200" title="Compensado pelo Estoque (Sem Dívida Pendente)">
            <CheckCircle2 className="w-3 h-3 text-purple-600" />
            <span>Compensado Estoque</span>
          </span>
        );
      default:
        return null;
    }
  };

  const totalFiltered = filteredExpenses.reduce((acc, curr) => acc + curr.amount, 0);

  // Printable HTML for Expenses List
  const expensesPrintHtml = useMemo(() => {
    const totalAmount = filteredExpenses.reduce((acc, curr) => acc + curr.amount, 0);
    const paidAmount = filteredExpenses.filter(e => e.status === 'pago').reduce((acc, curr) => acc + curr.amount, 0);
    const pendingAmount = totalAmount - paidAmount;

    let html = `
      <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; padding:8px 12px; border:1px solid #e2e8f0; border-radius:6px; margin-bottom:14px; font-size:8.5pt;">
        <div><strong>Total de Lançamentos:</strong> ${filteredExpenses.length} despesas</div>
        <div><strong>Total Pago:</strong> <span style="color:#059669; font-weight:bold;">${formatCurrencyBRL(paidAmount)}</span></div>
        <div><strong>Pendente / A Pagar:</strong> <span style="color:#dc2626; font-weight:bold;">${formatCurrencyBRL(pendingAmount)}</span></div>
        <div><strong>Total Geral:</strong> <span style="font-weight:bold; font-size:9.5pt;">${formatCurrencyBRL(totalAmount)}</span></div>
      </div>

      <table style="width:100%; border-collapse:collapse; font-size:8pt; text-align:left;">
        <thead>
          <tr style="background:#0f172a; color:#ffffff;">
            <th style="padding:6px 8px; border:1px solid #0f172a;">Vencimento</th>
            <th style="padding:6px 8px; border:1px solid #0f172a;">Descrição</th>
            <th style="padding:6px 8px; border:1px solid #0f172a;">Categoria</th>
            <th style="padding:6px 8px; border:1px solid #0f172a;">Centro de Custo</th>
            <th style="padding:6px 8px; border:1px solid #0f172a;">Fornecedor</th>
            <th style="padding:6px 8px; border:1px solid #0f172a; text-align:center;">Status</th>
            <th style="padding:6px 8px; border:1px solid #0f172a; text-align:right;">Valor</th>
          </tr>
        </thead>
        <tbody>
    `;

    filteredExpenses.forEach((exp, idx) => {
      const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      const statusColor = exp.status === 'pago' ? '#059669' : exp.status === 'atrasado' ? '#dc2626' : '#d97706';
      const statusText = exp.status === 'pago' ? 'PAGO' : exp.status === 'atrasado' ? 'ATRASADO' : 'PENDENTE';

      html += `
        <tr style="background:${bg}; border-bottom:1px solid #e2e8f0;">
          <td style="padding:5px 8px;">${formatDateBR(exp.dueDate)}</td>
          <td style="padding:5px 8px; font-weight:bold; color:#0f172a;">${exp.description}</td>
          <td style="padding:5px 8px; color:#475569;">${exp.categoryName}</td>
          <td style="padding:5px 8px; color:#475569;">${exp.costCenterName || '-'}</td>
          <td style="padding:5px 8px; color:#64748b;">${exp.supplier || '-'}</td>
          <td style="padding:5px 8px; text-align:center; font-weight:bold; color:${statusColor}; font-size:7.5pt;">${statusText}</td>
          <td style="padding:5px 8px; text-align:right; font-weight:bold; color:#0f172a;">${formatCurrencyBRL(exp.amount)}</td>
        </tr>
      `;
    });

    html += `
        </tbody>
        <tfoot>
          <tr style="background:#f1f5f9; font-weight:bold; border-top:2px solid #0f172a;">
            <td colspan="6" style="padding:8px; text-align:right; font-size:9pt;">VALOR TOTAL:</td>
            <td style="padding:8px; text-align:right; font-size:9.5pt; color:#0f172a;">${formatCurrencyBRL(totalAmount)}</td>
          </tr>
        </tfoot>
      </table>
    `;

    return html;
  }, [filteredExpenses]);

  // WhatsApp text for expenses
  const expensesWhatsAppText = useMemo(() => {
    const now = new Date();
    const dateStr = formatDateBR(now.toISOString().split('T')[0]);
    const totalAmount = filteredExpenses.reduce((acc, curr) => acc + curr.amount, 0);
    const paidAmount = filteredExpenses.filter(e => e.status === 'pago').reduce((acc, curr) => acc + curr.amount, 0);
    const pendingAmount = totalAmount - paidAmount;

    let text = `💸 *${activeCompany.tradeName?.toUpperCase() || 'SILAGEM FÁCIL'}*\n`;
    text += `📋 *RELATÓRIO DE DESPESAS & CUSTOS OPERACIONAIS*\n`;
    text += `📅 *Posição em:* ${dateStr}\n\n`;
    text += `💰 *Total Geral:* ${formatCurrencyBRL(totalAmount)}\n`;
    text += `✅ *Total Pago:* ${formatCurrencyBRL(paidAmount)}\n`;
    text += `⏳ *A Pagar / Pendente:* ${formatCurrencyBRL(pendingAmount)}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
    text += `*Últimos Lançamentos (${Math.min(filteredExpenses.length, 8)} de ${filteredExpenses.length}):*\n`;

    filteredExpenses.slice(0, 8).forEach(e => {
      const statusIcon = e.status === 'pago' ? '✅' : '⏳';
      text += `• ${statusIcon} *${formatCurrencyBRL(e.amount)}* - ${e.description} (${formatDateBR(e.dueDate)})\n`;
    });

    text += `\n_Emitido via Silagem Fácil Pro - Gestão Agrícola_`;
    return text;
  }, [activeCompany, filteredExpenses]);

  return (
    <div className="crm-card bg-white dark:bg-stone-900 rounded-2xl border border-zinc-200 dark:border-stone-800 shadow-xs overflow-hidden text-zinc-900 dark:text-white">
      
      {/* Top Filter & Search Bar */}
      <div className="p-3 sm:p-3.5 border-b border-zinc-200 dark:border-stone-800 bg-zinc-50 dark:bg-stone-800/50 space-y-2.5">
        
        {/* Search & Actions Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2 w-3.5 h-3.5 text-zinc-400 dark:text-stone-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por descrição, fornecedor, trator ou NF..."
              className="w-full pl-8 pr-4 py-1.5 bg-white dark:bg-stone-800 text-xs rounded-xl border border-zinc-200 dark:border-stone-700 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white font-bold"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2 text-zinc-400 dark:text-stone-400 hover:text-zinc-900 dark:hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center space-x-1.5">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center space-x-1 px-2.5 py-1.5 text-xs font-bold text-zinc-700 dark:text-stone-200 bg-white dark:bg-stone-800 hover:bg-zinc-100 dark:hover:bg-stone-700 border border-zinc-200 dark:border-stone-700 rounded-xl transition shadow-2xs cursor-pointer"
              title="Exportar dados para Excel / CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-zinc-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">CSV</span>
            </button>

            <button
              onClick={() => setIsPrintModalOpen(true)}
              className="inline-flex items-center space-x-1 px-2.5 py-1.5 text-xs font-bold text-zinc-700 dark:text-emerald-300 bg-white dark:bg-emerald-950/60 hover:bg-zinc-100 dark:hover:bg-emerald-900 border border-zinc-200 dark:border-emerald-800 rounded-xl transition shadow-2xs cursor-pointer"
              title="Compartilhar lista de despesas por WhatsApp"
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>

            <button
              onClick={() => setIsPrintModalOpen(true)}
              className="inline-flex items-center space-x-1 px-2.5 py-1.5 text-xs font-bold text-zinc-700 dark:text-stone-200 bg-white dark:bg-stone-800 hover:bg-zinc-100 dark:hover:bg-stone-700 border border-zinc-200 dark:border-stone-700 rounded-xl transition shadow-2xs cursor-pointer"
              title="Imprimir relatório com logotipo e dados cadastrais da empresa"
            >
              <Printer className="w-3.5 h-3.5 text-zinc-600 dark:text-stone-300" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>

            <button
              onClick={onNewExpense}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-white bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 rounded-xl transition shadow-xs active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Novo Lançamento</span>
            </button>
          </div>

        </div>

        {/* Dropdown Filters Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-0.5">
          
          {/* Status Filter */}
          <div>
            <label className="block text-[10px] font-black text-zinc-500 dark:text-stone-300 uppercase tracking-wider mb-0.5">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-2 py-1 text-xs bg-white dark:bg-stone-800 rounded-lg border border-zinc-200 dark:border-stone-700 font-bold text-zinc-900 dark:text-white"
            >
              <option value="todos">Todos os Status</option>
              <option value="pago">Pagas</option>
              <option value="pendente">Pendentes</option>
              <option value="atrasado">Atrasadas</option>
              <option value="agendado">Agendadas</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-[10px] font-black text-zinc-500 dark:text-stone-300 uppercase tracking-wider mb-0.5">Categoria</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-2 py-1 text-xs bg-white dark:bg-stone-800 rounded-lg border border-zinc-200 dark:border-stone-700 font-bold text-zinc-900 dark:text-white"
            >
              <option value="todas">Todas as Categorias</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Cost Center Filter */}
          <div>
            <label className="block text-[10px] font-black text-zinc-500 dark:text-stone-300 uppercase tracking-wider mb-0.5">Centro de Custo</label>
            <select
              value={selectedCostCenter}
              onChange={(e) => setSelectedCostCenter(e.target.value)}
              className="w-full px-2 py-1 text-xs bg-white dark:bg-stone-800 rounded-lg border border-zinc-200 dark:border-stone-700 font-bold text-zinc-900 dark:text-white"
            >
              <option value="todos">Todos os Centros</option>
              {costCenters.map((cc) => (
                <option key={cc.id} value={cc.id}>
                  {cc.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-[10px] font-black text-zinc-500 dark:text-stone-300 uppercase tracking-wider mb-0.5">Ordenar por</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-2 py-1 text-xs bg-white dark:bg-stone-800 rounded-lg border border-zinc-200 dark:border-stone-700 font-bold text-zinc-900 dark:text-white"
            >
              <option value="date_asc">Vencimento (Mais Próximo / Evolução)</option>
              <option value="date_desc">Vencimento (Mais Distante)</option>
              <option value="amount_desc">Maior Valor (R$)</option>
              <option value="amount_asc">Menor Valor (R$)</option>
            </select>
          </div>

        </div>

      </div>

      {/* Summary of current view */}
      <div className="px-4 py-2 bg-zinc-50 dark:bg-stone-800/80 border-b border-zinc-200 dark:border-stone-800 text-xs text-zinc-600 dark:text-stone-300 flex items-center justify-between">
        <span>
          Mostrando <strong className="text-zinc-900 dark:text-white font-black">{filteredExpenses.length}</strong> lançamento(s)
        </span>
        <span>
          Soma do filtro: <strong className="text-zinc-900 dark:text-white font-black">{formatCurrencyBRL(totalFiltered)}</strong>
        </span>
      </div>

      {/* Desktop Table View */}
      <div className="overflow-x-auto hidden md:block">
        <table className="w-full text-left text-xs text-zinc-900 dark:text-stone-200">
          <thead className="bg-zinc-100 dark:bg-stone-800 text-zinc-700 dark:text-stone-300 font-black border-b border-zinc-200 dark:border-stone-700 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="py-1.5 px-3">Descrição & Fornecedor</th>
              <th className="py-1.5 px-3">Categoria</th>
              <th className="py-1.5 px-3">Vencimento</th>
              <th className="py-1.5 px-3">Centro / Máquina</th>
              <th className="py-1.5 px-3">Valor</th>
              <th className="py-1.5 px-3">Status</th>
              <th className="py-1.5 px-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-stone-800 font-medium bg-white dark:bg-stone-900">
            {filteredExpenses.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-black/75 dark:text-stone-400">
                  Nenhum lançamento encontrado com os filtros atuais.
                </td>
              </tr>
            ) : (
              filteredExpenses.map((exp) => (
                <tr key={exp.id} className="hover:bg-blue-200/40 dark:hover:bg-stone-800/60 transition-colors">
                  
                  {/* Description & Supplier */}
                  <td className="py-1.5 px-3 max-w-xs">
                    <div className="font-bold text-black dark:text-white line-clamp-1 leading-snug">{exp.description}</div>
                    <div className="text-[10px] text-black/80 dark:text-stone-400 flex flex-wrap items-center gap-1 mt-0.5">
                      {exp.employeeName && (
                        <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold ${
                          exp.employeeName.startsWith('Equipe') || exp.teamName
                            ? 'text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800'
                            : exp.employeeName.startsWith('Todos')
                            ? 'text-purple-900 dark:text-purple-200 bg-purple-100 dark:bg-purple-950/60 border border-purple-300 dark:border-purple-800'
                            : 'text-blue-900 dark:text-blue-200 bg-blue-100 dark:bg-blue-950/60 border border-blue-300 dark:border-blue-800'
                        }`}>
                          {exp.employeeName.startsWith('Equipe') || exp.teamName ? '👥 ' : exp.employeeName.startsWith('Todos') ? '🌐 ' : '👤 '}
                          {exp.employeeName}
                        </span>
                      )}
                      {exp.supplier && <span className="font-semibold text-black dark:text-stone-300">{exp.supplier}</span>}
                      {exp.invoiceNumber && <span className="text-black/70 dark:text-stone-400">&bull; NF: {exp.invoiceNumber}</span>}
                      {exp.quantity && exp.unitPrice && (
                        <span className="text-black/70 dark:text-stone-400">
                          &bull; {exp.quantity} {exp.unit} @ R${exp.unitPrice}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Category */}
                  <td className="py-1.5 px-3">
                    <span
                      className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/70 dark:bg-stone-800/80 text-black dark:text-white border border-black/10 dark:border-stone-700"
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: exp.categoryColor }}
                      />
                      <span>{exp.categoryName}</span>
                    </span>
                  </td>

                  {/* Due Date & Payment Date */}
                  <td className="py-1.5 px-3 whitespace-nowrap">
                    <div className="font-bold text-black dark:text-white leading-snug">{formatDateBR(exp.dueDate)}</div>
                    {exp.paymentDate && exp.status === 'pago' && (
                      <div className="text-[9px] text-black dark:text-emerald-400 font-bold">
                        Pago: {formatDateBR(exp.paymentDate)}
                      </div>
                    )}
                  </td>

                  {/* Cost Center / Machinery */}
                  <td className="py-1.5 px-3">
                    {exp.machineryName ? (
                      <div className="flex items-center space-x-1 text-[10px] text-black dark:text-blue-300 font-bold">
                        <Tractor className="w-3 h-3 text-black dark:text-blue-400 shrink-0" />
                        <span className="truncate max-w-[140px]">{exp.machineryName}</span>
                      </div>
                    ) : exp.costCenterName ? (
                      <div className="flex items-center space-x-1 text-[10px] text-black/85 dark:text-stone-300 font-medium">
                        <Building2 className="w-2.5 h-2.5 text-black/60 dark:text-stone-400 shrink-0" />
                        <span className="truncate max-w-[140px]">{exp.costCenterName}</span>
                      </div>
                    ) : (
                      <span className="text-black/60 dark:text-stone-500 text-[10px]">-</span>
                    )}
                  </td>

                  {/* Amount */}
                  <td className="py-1.5 px-3 whitespace-nowrap">
                    <div className="font-black text-black dark:text-white text-xs font-['Outfit']">
                      {formatCurrencyBRL(exp.amount)}
                    </div>
                    <div className="text-[9px] text-black/75 dark:text-stone-400 uppercase font-black">
                      {exp.paymentMethod.replace('_', ' ')}
                    </div>
                    {exp.bankAccountName && (
                      <div className="text-[9px] text-blue-900 dark:text-blue-300 font-bold truncate max-w-[120px]" title={exp.bankAccountName}>
                        🏦 {exp.bankAccountName}
                      </div>
                    )}
                    {exp.paidByEmployeeName && (
                      <div className="text-[9px] text-emerald-950 dark:text-emerald-300 font-medium truncate max-w-[120px]" title={`Baixa por: ${exp.paidByEmployeeName}`}>
                        ✓ {exp.paidByEmployeeName}
                      </div>
                    )}
                  </td>

                  {/* Status with quick toggle */}
                  <td className="py-1.5 px-3 whitespace-nowrap">
                    <button
                      onClick={() =>
                        onToggleStatus(
                          exp.id,
                          exp.status === 'pago' ? 'pendente' : 'pago'
                        )
                      }
                      title="Clique para alternar Pago / Pendente"
                      className="cursor-pointer hover:opacity-85 transition"
                    >
                      {getStatusBadge(exp.status)}
                    </button>
                  </td>

                  {/* Actions */}
                  <td className="py-1.5 px-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end space-x-1">
                      
                      {/* Receipt icon */}
                      {exp.receiptUrl && (
                        <button
                          onClick={() => onViewReceipt(exp)}
                          className="p-1 text-emerald-800 dark:text-emerald-400 hover:bg-blue-200/60 dark:hover:bg-stone-800 rounded-md transition"
                          title="Ver Comprovante / NF"
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Duplicate */}
                      <button
                        onClick={() => onDuplicateExpense(exp)}
                        className="p-1 text-black/70 dark:text-stone-400 hover:text-black dark:hover:text-white hover:bg-blue-200/60 dark:hover:bg-stone-800 rounded-md transition"
                        title="Duplicar Despesa"
                      >
                        <Copy className="w-3 h-3" />
                      </button>

                      {/* Edit */}
                      <button
                        onClick={() => onEditExpense(exp)}
                        className="p-1 text-black dark:text-sky-400 hover:text-black dark:hover:text-white hover:bg-blue-200/60 dark:hover:bg-stone-800 rounded-md transition"
                        title="Editar"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => onDeleteExpense(exp.id)}
                        className="p-1.5 text-black/70 dark:text-stone-400 hover:text-rose-700 hover:bg-rose-100 dark:hover:bg-rose-950/40 rounded-lg transition"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                    </div>
                  </td>

                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List View */}
      <div className="divide-y divide-zinc-100 dark:divide-stone-800 md:hidden bg-white dark:bg-stone-900">
        {filteredExpenses.length === 0 ? (
          <div className="py-10 text-center text-black/75 dark:text-stone-400 text-xs">
            Nenhum lançamento encontrado.
          </div>
        ) : (
          filteredExpenses.map((exp) => (
            <div key={exp.id} className="p-4 space-y-3">
              
              <div className="flex items-start justify-between">
                <div>
                  <span
                    className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold mb-1 bg-white/70 dark:bg-stone-800 text-black dark:text-white border border-black/10 dark:border-stone-700"
                  >
                    <span>{exp.categoryName}</span>
                  </span>
                  <h4 className="font-black text-black dark:text-white text-sm">{exp.description}</h4>
                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                    {exp.employeeName && (
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        exp.employeeName.startsWith('Equipe') || exp.teamName
                          ? 'text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800'
                          : exp.employeeName.startsWith('Todos')
                          ? 'text-purple-900 dark:text-purple-200 bg-purple-100 dark:bg-purple-950/60 border border-purple-300 dark:border-purple-800'
                          : 'text-blue-900 dark:text-blue-200 bg-blue-100 dark:bg-blue-950/60 border border-blue-300 dark:border-blue-800'
                      }`}>
                        {exp.employeeName.startsWith('Equipe') || exp.teamName ? '👥 ' : exp.employeeName.startsWith('Todos') ? '🌐 ' : '👤 '}
                        {exp.employeeName}
                      </span>
                    )}
                    {exp.supplier && (
                      <p className="text-xs text-black/85 dark:text-stone-300 font-semibold">{exp.supplier}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-black text-black dark:text-white text-base block font-['Outfit']">
                    {formatCurrencyBRL(exp.amount)}
                  </span>
                  <button
                    onClick={() =>
                      onToggleStatus(
                        exp.id,
                        exp.status === 'pago' ? 'pendente' : 'pago'
                      )
                    }
                  >
                    {getStatusBadge(exp.status)}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-black/80 dark:text-stone-400 pt-1 border-t border-blue-200/60 dark:border-stone-800">
                <div className="flex items-center space-x-3">
                  <span>Venc: <strong className="text-black dark:text-white">{formatDateBR(exp.dueDate)}</strong></span>
                  {exp.machineryName && (
                    <span className="text-black dark:text-blue-400 font-bold flex items-center gap-1">
                      <Tractor className="w-3 h-3" /> {exp.machineryName.split(' ')[0]}
                    </span>
                  )}
                </div>
                
                <div className="flex items-center space-x-2">
                  {exp.receiptUrl && (
                    <button
                      onClick={() => onViewReceipt(exp)}
                      className="p-1 text-emerald-800 dark:text-emerald-400"
                      title="Ver Comprovante"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => onEditExpense(exp)}
                    className="p-1 text-black dark:text-stone-300"
                    title="Editar"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDeleteExpense(exp.id)}
                    className="p-1 text-rose-800 dark:text-rose-500"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

            </div>
          ))
        )}
      </div>

      {/* Print Preview Modal with Company Logo & Data */}
      <PrintPreviewModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        options={{
          title: 'Relatório Financeiro de Contas a Pagar & Despesas',
          subtitle: 'Demonstrativo analítico de despesas, centros de custo e fornecedores',
          documentType: 'RELATÓRIO DE CONTAS A PAGAR',
          company: activeCompany,
          contentHtml: expensesPrintHtml,
          signatureLabels: ['Encarregado / Lançador', 'Aprovação Financeira / Diretoria'],
          whatsappText: expensesWhatsAppText,
        }}
      />

    </div>
  );
};
