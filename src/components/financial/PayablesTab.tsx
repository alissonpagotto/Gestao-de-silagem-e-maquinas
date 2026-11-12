import React, { useState, useMemo } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Search, 
  Filter, 
  ArrowDownLeft, 
  DollarSign, 
  Calendar,
  Building,
  Tag,
  Landmark,
  UserCheck,
  RotateCcw,
  ShieldCheck,
  Plus,
  Check,
  Edit3,
  Trash2,
  Paperclip,
  X,
  CreditCard
} from 'lucide-react';
import { Expense, BankAccount, Employee, PaymentMethod } from '../../types';
import { formatCurrencyBRL, formatDateBR } from '../../lib/storage';
import { PaymentSettlementModal } from './PaymentSettlementModal';
import { useConfirm } from '../../context/ConfirmContext';
import { CompetenceSelector, getPrevCompetence, getNextCompetence, matchesCompetence } from './CompetenceSelector';

interface PayablesTabProps {
  expenses: Expense[];
  bankAccounts?: BankAccount[];
  employees?: Employee[];
  onToggleStatus: (id: string) => void;
  onSettleExpense?: (params: {
    expenseId: string;
    paymentDate: string;
    paidByEmployeeId: string;
    paidByEmployeeName: string;
    bankAccountId: string;
    bankAccountName: string;
    creditSupplier?: string;
    paymentMethod: PaymentMethod;
    authenticationCode?: string;
    notes?: string;
    chequeOrigin?: 'proprio' | 'terceiros';
    checkNumber?: string;
    chequeGoodForDate?: string;
    usedChequeIds?: string[];
    usedChequesSummary?: string;
  }) => void;
  onReverseExpense?: (id: string) => void;
  onEditExpense?: (exp: Expense) => void;
  onDeleteExpense?: (id: string) => void;
  onViewReceipt?: (exp: Expense) => void;
  onNewExpense?: () => void;
  competenceMonth?: string;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
}

export const PayablesTab: React.FC<PayablesTabProps> = ({
  expenses,
  bankAccounts = [],
  employees = [],
  onToggleStatus,
  onSettleExpense,
  onReverseExpense,
  onEditExpense,
  onDeleteExpense,
  onViewReceipt,
  onNewExpense,
  competenceMonth,
  onPrevMonth,
  onNextMonth,
}) => {
  const { confirm } = useConfirm();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pendente' | 'pago'>('all');
  const [internalCompetence, setInternalCompetence] = useState<string>(() => {
    const now = new Date();
    return `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  });

  const activeCompetence = competenceMonth || internalCompetence;
  const handlePrev = onPrevMonth || (() => setInternalCompetence((prev) => getPrevCompetence(prev)));
  const handleNext = onNextMonth || (() => setInternalCompetence((prev) => getNextCompetence(prev)));

  const [settlementExpense, setSettlementExpense] = useState<Expense | null>(null);
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);

  // Filtro opcional por intervalo de datas
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const safeExpenses = useMemo(() => {
    const list = Array.isArray(expenses) ? expenses.filter(Boolean) : [];
    const seen = new Set<string>();
    const deduped: Expense[] = [];
    for (const exp of list) {
      if (!exp || !exp.id) continue;

      const val = typeof exp.amount === 'number'
        ? exp.amount
        : (typeof (exp as any).valor === 'number'
            ? (exp as any).valor
            : parseFloat(String(exp.amount ?? (exp as any).valor ?? (exp as any).valor_parcela ?? '0').replace(/\./g, '').replace(',', '.')) || 0);

      if (isNaN(val) || val <= 0) {
        continue;
      }

      // Trava de ID único e trava de notaId + parcela
      const notaRef = (exp as any).notaId || (exp as any).documento_entrada_id || (exp as any).nota_fiscal_id;
      const parcRef = (exp as any).numero_parcela;
      const key = notaRef && parcRef
        ? `${notaRef}_${parcRef}`
        : exp.id;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(exp);
    }

    return deduped;
  }, [expenses]);
  const competenceExpenses = useMemo(() => {
    return safeExpenses.filter((e) => {
      const targetDate =
        e.dueDate ||
        (e as any).data_vencimento ||
        (e as any).date ||
        e.issueDate ||
        (e as any).data_emissao ||
        (e.createdAt ? String(e.createdAt).split('T')[0] : '');
      return matchesCompetence(targetDate, activeCompetence);
    });
  }, [safeExpenses, activeCompetence]);

  const pendingExpenses = competenceExpenses.filter((e) => (e.status || 'pendente') === 'pendente');
  const paidExpenses = competenceExpenses.filter((e) => e.status === 'pago');

  const totalPending = pendingExpenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
  const totalPaid = paidExpenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
  const totalGeneral = competenceExpenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

  const todayStr = new Date().toISOString().split('T')[0];

  const filteredExpenses = competenceExpenses.filter((e) => {
    if (!e) return false;
    const matchesStatus = statusFilter === 'all' || e.status === statusFilter;

    // Intervalo de datas personalizado (se informado)
    let matchesDateRange = true;
    const targetDate = e.dueDate || e.date;
    if (startDate && targetDate && targetDate < startDate) matchesDateRange = false;
    if (endDate && targetDate && targetDate > endDate) matchesDateRange = false;

    const q = (searchTerm || '').trim().toLowerCase();
    if (!q) {
      return matchesStatus && matchesDateRange;
    }

    const desc = (e.description || '').toLowerCase();
    const supp = (e.supplier || '').toLowerCase();
    const cat = (e.categoryName || e.category || '').toLowerCase();
    const paid = (e.paidByEmployeeName || '').toLowerCase();
    const bank = (e.bankAccountName || '').toLowerCase();

    const matchesSearch =
      desc.includes(q) ||
      supp.includes(q) ||
      cat.includes(q) ||
      paid.includes(q) ||
      bank.includes(q);

    return matchesStatus && matchesDateRange && matchesSearch;
  });

  // Handler para clique no botão de status ou liquidar
  const handleActionClick = (exp: Expense) => {
    if (exp.status === 'pago') {
      // Se já está pago, confirma o estorno
      handleReverseClick(exp);
    } else {
      // Se está pendente, abre o modal de baixa com responsável e banco
      setSettlementExpense(exp);
      setIsSettlementModalOpen(true);
    }
  };

  const handleReverseClick = async (exp: Expense) => {
    const bankMsg = exp.bankAccountName ? ` O saldo de ${formatCurrencyBRL(exp.amount)} será devolvido à conta ${exp.bankAccountName}.` : '';
    const isConfirmed = await confirm({
      title: 'Estornar Pagamento da Despesa',
      message: `Deseja realmente estornar o pagamento de "${exp.description}" (${formatCurrencyBRL(exp.amount)})?${bankMsg} O status voltará para "A Pagar".`,
      confirmLabel: 'Sim, Estornar',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });

    if (isConfirmed) {
      if (onReverseExpense) {
        onReverseExpense(exp.id);
      } else {
        onToggleStatus(exp.id);
      }
    }
  };

  const handleDeleteClick = async (exp: Expense) => {
    const isConfirmed = await confirm({
      title: 'Confirmar Exclusão',
      message: 'Tem certeza que deseja excluir permanentemente este lançamento financeiro?',
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });

    if (isConfirmed && onDeleteExpense) {
      onDeleteExpense(exp.id);
    }
  };

  return (
    <div id="financial-tab-pagar" className="financial-subtab-clean space-y-3">
      {/* KPI Cards (Compact) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-transparent">
        <div className="financial-kpi-card bg-[#e0e6f1] dark:bg-stone-900 border border-slate-400/70 dark:border-stone-800 rounded-xl p-3 shadow-xs flex items-center justify-between text-black dark:text-white">
          <div className="bg-transparent">
            <span className="text-[11px] font-black text-black dark:text-stone-200 uppercase tracking-wider block">
              A Pagar (Pendentes)
            </span>
            <div className="text-lg sm:text-xl font-black text-amber-700 dark:text-amber-400 mt-0.5 font-['Outfit'] bg-transparent">
              {formatCurrencyBRL(totalPending)}
            </div>
            <p className="text-[11px] text-black/70 dark:text-stone-400 font-medium">
              {pendingExpenses.length} títulos aguardando liquidação
            </p>
          </div>
          <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 shrink-0 border border-amber-200 dark:border-amber-800">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        <div className="financial-kpi-card bg-[#e0e6f1] dark:bg-stone-900 border border-slate-400/70 dark:border-stone-800 rounded-xl p-3 shadow-xs flex items-center justify-between text-black dark:text-white">
          <div className="bg-transparent">
            <span className="text-[11px] font-black text-black dark:text-stone-200 uppercase tracking-wider block">
              Liquidadas (Pagas)
            </span>
            <div className="text-lg sm:text-xl font-black text-emerald-700 dark:text-emerald-400 mt-0.5 font-['Outfit'] bg-transparent">
              {formatCurrencyBRL(totalPaid)}
            </div>
            <p className="text-[11px] text-black/70 dark:text-stone-400 font-medium">
              {paidExpenses.length} despesas baixadas no banco
            </p>
          </div>
          <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 shrink-0 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        <div className="financial-kpi-card bg-[#e0e6f1] dark:bg-stone-900 border border-slate-400/70 dark:border-stone-800 rounded-xl p-3 shadow-xs flex items-center justify-between text-black dark:text-white">
          <div className="bg-transparent">
            <span className="text-[11px] font-black text-black dark:text-stone-200 uppercase tracking-wider block">
              Volume Total de Contas
            </span>
            <div className="text-lg sm:text-xl font-black text-black dark:text-white mt-0.5 font-['Outfit'] bg-transparent">
              {formatCurrencyBRL(totalGeneral)}
            </div>
            <p className="text-[11px] text-black/70 dark:text-stone-400 font-medium">
              {competenceExpenses.length} despesas no total
            </p>
          </div>
          <div className="p-2 rounded-lg bg-slate-100 dark:bg-stone-800 text-black dark:text-stone-200 shrink-0 border border-slate-200 dark:border-stone-700">
            <ArrowDownLeft className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Filters Bar (Compact) */}
      <div className="bg-[#e0e6f1] dark:bg-stone-900 border border-slate-400/70 dark:border-stone-800 rounded-xl px-3 py-2.5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-2.5 text-black dark:text-white">
        <div className="flex items-center space-x-1.5 w-full sm:w-auto overflow-x-auto scrollbar-none">
          <CompetenceSelector
            competence={activeCompetence}
            onPrev={handlePrev}
            onNext={handleNext}
          />

          {/* Divisor sutil */}
          <div className="h-5 w-px bg-slate-300 mx-1 shrink-0 hidden sm:block" />

          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              statusFilter === 'all'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-slate-100 text-black hover:bg-slate-200'
            }`}
          >
            Todas ({competenceExpenses.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('pendente')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              statusFilter === 'pendente'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 text-black hover:bg-slate-200'
            }`}
          >
            A Pagar ({pendingExpenses.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('pago')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              statusFilter === 'pago'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-black hover:bg-slate-200'
            }`}
          >
            Pagas ({paidExpenses.length})
          </button>

          {/* Divisor sutil */}
          <div className="h-4 w-px bg-slate-300 mx-0.5 shrink-0 hidden md:block" />

          {/* Filtro por Intervalo de Datas (De: / Até:) */}
          <div className="flex items-center space-x-1.5 shrink-0">
            <div className="flex items-center space-x-1 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200 text-xs">
              <span className="text-[11px] font-black text-black">De:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-xs text-black font-semibold outline-none cursor-pointer"
                title="Filtrar a partir desta data"
              />
            </div>
            <div className="flex items-center space-x-1 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200 text-xs">
              <span className="text-[11px] font-black text-black">Até:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-xs text-black font-semibold outline-none cursor-pointer"
                title="Filtrar até esta data"
              />
            </div>
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="p-1 text-slate-600 hover:text-rose-600 hover:bg-slate-200 rounded transition cursor-pointer"
                title="Limpar intervalo de datas"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-black absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar fornecedor, despesa, responsável..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-black placeholder-slate-400 outline-none focus:ring-1 focus:ring-sky-600 font-medium"
            />
          </div>

          {onNewExpense && (
            <button
              type="button"
              onClick={onNewExpense}
              className="px-3 py-1.5 bg-[#0963cb] hover:bg-blue-700 text-white text-xs font-black rounded-lg transition shadow-2xs shrink-0 flex items-center space-x-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span className="hidden sm:inline">Nova Despesa</span>
            </button>
          )}
        </div>
      </div>

      {/* Payables List Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs text-black">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] font-bold text-black uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-1 px-2.5 whitespace-nowrap">VENCIMENTO</th>
                <th className="py-1 px-2.5 whitespace-nowrap">FORNECEDOR / DESCRIÇÃO</th>
                <th className="py-1 px-2.5 whitespace-nowrap">CATEGORIA</th>
                <th className="py-1 px-2.5 whitespace-nowrap">RESPONSÁVEL / BANCO</th>
                <th className="py-1 px-2.5 text-right whitespace-nowrap">VALOR (R$)</th>
                <th className="py-1 px-2.5 text-right whitespace-nowrap pr-3">AÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredExpenses.length > 0 ? (
                filteredExpenses.map((exp) => {
                  const isPaid = exp.status === 'pago';
                  const dueDateVal = exp.dueDate || exp.date || '';
                  const isOverdue = !isPaid && dueDateVal && dueDateVal < todayStr;

                  return (
                    <tr key={exp.id} className="even:bg-[#f2f2f2] odd:bg-white dark:even:bg-stone-800/50 dark:odd:bg-stone-900 hover:bg-slate-200/60 dark:hover:bg-stone-800 transition whitespace-nowrap border-b border-slate-200 dark:border-stone-800">
                      {/* Vencimento com Identificação de Atraso */}
                      <td className="py-1 px-2.5 font-bold text-black whitespace-nowrap text-xs">
                        <div className="flex items-center space-x-1.5 font-mono">
                          <span>{dueDateVal ? formatDateBR(dueDateVal) : '—'}</span>
                          {isOverdue && (
                            <span className="text-[9px] font-black text-rose-600 bg-rose-50 border border-rose-200 px-1 py-0.2 rounded uppercase">
                              VENCIDA
                            </span>
                          )}
                          {isPaid && exp.paymentDate && (
                            <span className="text-[9px] text-emerald-800 font-bold bg-emerald-50 border border-emerald-200 px-1 py-0.2 rounded uppercase">
                              PAGO {formatDateBR(exp.paymentDate)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Fornecedor / Descrição */}
                      <td className="py-1 px-2.5 whitespace-nowrap max-w-[280px]">
                        <div className="font-bold text-black text-xs truncate uppercase" title={exp.supplier || ''}>
                          {exp.supplier || 'SEM FORNECEDOR INFORMADO'}
                        </div>
                        <div className="text-[10px] text-stone-600 font-medium truncate uppercase" title={exp.description || ''}>
                          {exp.description}
                        </div>
                      </td>

                      {/* Categoria */}
                      <td className="py-1 px-2.5 text-black whitespace-nowrap">
                        <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-black border border-slate-200 text-[10px] font-bold uppercase">
                          {exp.categoryName || exp.category || 'GERAL'}
                        </span>
                      </td>

                      {/* Responsável pelo Pagamento & Banco de Débito */}
                      <td className="py-1 px-2.5 text-black text-xs whitespace-nowrap max-w-[200px]">
                        {isPaid ? (
                          <div className="flex items-center space-x-1.5 truncate text-[10px] font-semibold text-emerald-900 uppercase">
                            {exp.corporateCardName && (
                              <span className="truncate flex items-center space-x-1 text-purple-800 font-bold bg-purple-50 px-1 py-0.5 rounded border border-purple-200">
                                <CreditCard className="w-3 h-3 text-purple-600 shrink-0" />
                                <span>{exp.corporateCardName}</span>
                              </span>
                            )}
                            {exp.paidByEmployeeName && (
                              <span className="truncate flex items-center space-x-1">
                                <UserCheck className="w-3 h-3 text-emerald-700 shrink-0" />
                                <span>{exp.paidByEmployeeName}</span>
                              </span>
                            )}
                            {exp.paymentMethod === 'cheque' && exp.chequeOrigin === 'terceiros' && (
                              <span
                                className="truncate flex items-center space-x-1 text-violet-800 font-bold bg-violet-50 px-1.5 py-0.5 rounded border border-violet-200"
                                title={exp.usedChequesSummary || `Repasse Cheque(s) de Terceiros: ${exp.checkNumber || ''}`}
                              >
                                <span>CHQ TERCEIROS {exp.checkNumber ? `Nº ${exp.checkNumber}` : '(CUSTÓDIA)'}</span>
                              </span>
                            )}
                            {exp.paymentMethod === 'cheque' && exp.chequeOrigin === 'proprio' && (
                              <span
                                className="truncate flex items-center space-x-1 text-sky-800 font-bold bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200"
                                title={exp.chequeGoodForDate ? `Bom para ${formatDateBR(exp.chequeGoodForDate)}` : undefined}
                              >
                                <span>CHQ PRÓPRIO {exp.checkNumber ? `Nº ${exp.checkNumber}` : ''}</span>
                              </span>
                            )}
                            {exp.bankAccountName && !(exp.paymentMethod === 'cheque' && exp.chequeOrigin === 'terceiros') && (
                              <span className="truncate flex items-center space-x-1 text-stone-600">
                                <Landmark className="w-3 h-3 text-[#0963cb] shrink-0" />
                                <span>{exp.bankAccountName}</span>
                              </span>
                            )}
                            {!exp.corporateCardName && !exp.paidByEmployeeName && !exp.bankAccountName && exp.paymentMethod !== 'cheque' && (
                              <span className="text-stone-400 italic">PAGO SEM REGISTRO</span>
                            )}
                          </div>
                        ) : (
                          <div className="text-[10px] font-medium uppercase truncate flex items-center space-x-1.5">
                            {exp.corporateCardName ? (
                              <span className="truncate flex items-center space-x-1 text-purple-800 font-bold bg-purple-50 px-1 py-0.5 rounded border border-purple-200">
                                <CreditCard className="w-3 h-3 text-purple-600 shrink-0" />
                                <span>FATURA: {exp.corporateCardName}</span>
                              </span>
                            ) : exp.bankAccountName ? (
                              <span className="flex items-center space-x-1 text-stone-600 truncate">
                                <Landmark className="w-3 h-3 text-[#0963cb] shrink-0" />
                                <span>PREV: {exp.bankAccountName}</span>
                              </span>
                            ) : (
                              <span className="text-stone-400 italic">A DEFINIR NA BAIXA</span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Valor */}
                      <td className="py-1 px-2.5 text-right font-black text-black whitespace-nowrap text-xs font-mono">
                        {formatCurrencyBRL(exp.amount)}
                      </td>

                      {/* Ações (Organizadas à direita, com indicador de Status à esquerda do botão Liquidar) */}
                      <td className="py-1 px-2.5 text-right whitespace-nowrap pr-3">
                        <div className="flex items-center justify-end space-x-1.5">
                          
                          {/* Indicador de STATUS */}
                          {isPaid ? (
                            <span 
                              id={`status-badge-${exp.id}`}
                              className="h-6 inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 border border-emerald-300 text-emerald-800 uppercase shadow-2xs"
                              title={`Conta liquidada / paga em ${exp.paymentDate ? formatDateBR(exp.paymentDate) : 'data anterior'}`}
                            >
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span>PAGA</span>
                            </span>
                          ) : isOverdue ? (
                            <span 
                              id={`status-badge-${exp.id}`}
                              className="h-6 inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-50 border border-rose-300 text-rose-700 uppercase shadow-2xs"
                              title="Conta com vencimento expirado"
                            >
                              <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" />
                              <span>VENCIDA</span>
                            </span>
                          ) : (
                            <span 
                              id={`status-badge-${exp.id}`}
                              className="h-6 inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 border border-amber-300 text-amber-800 uppercase shadow-2xs"
                              title="Conta pendente aguardando liquidação"
                            >
                              <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                              <span>A PAGAR</span>
                            </span>
                          )}

                          {/* Botão Liquidar / Estornar */}
                          <button
                            type="button"
                            id={`btn-acao-baixa-${exp.id}`}
                            onClick={() => handleActionClick(exp)}
                            className={`h-6 inline-flex items-center space-x-1 text-[10px] font-black px-2 py-0.5 rounded-md border transition cursor-pointer shadow-2xs uppercase ${
                              isPaid
                                ? 'border-slate-300 bg-white hover:bg-slate-100 text-stone-700'
                                : 'border-emerald-600 bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95'
                            }`}
                            title={isPaid ? 'Estornar baixa deste pagamento' : 'Liquidar conta a pagar'}
                          >
                            {isPaid ? (
                              <>
                                <RotateCcw className="w-3 h-3" />
                                <span>ESTORNAR</span>
                              </>
                            ) : (
                              <>
                                <Check className="w-3 h-3 stroke-[3]" />
                                <span>LIQUIDAR</span>
                              </>
                            )}
                          </button>

                          {/* Comprovante / NF */}
                          {onViewReceipt && (exp.receiptUrl || exp.invoiceNumber) && (
                            <button
                              type="button"
                              id={`btn-comprovante-${exp.id}`}
                              onClick={() => onViewReceipt(exp)}
                              className="h-6 w-6 inline-flex items-center justify-center p-1 text-stone-600 hover:text-sky-700 hover:bg-sky-50 rounded-md transition cursor-pointer border border-slate-200"
                              title="Ver Comprovante / NF"
                            >
                              <Paperclip className="w-3 h-3" />
                            </button>
                          )}

                          {/* Editar */}
                          {onEditExpense && (
                            <button
                              type="button"
                              id={`btn-editar-${exp.id}`}
                              onClick={() => onEditExpense(exp)}
                              className="h-6 w-6 inline-flex items-center justify-center p-1 text-stone-600 hover:text-sky-700 hover:bg-sky-50 rounded-md transition cursor-pointer border border-slate-200"
                              title="Editar Lançamento"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          )}

                          {/* Excluir Lançamento Financeiro */}
                          <button
                            type="button"
                            id={`btn-excluir-${exp.id}`}
                            onClick={() => handleDeleteClick(exp)}
                            className="h-6 w-6 inline-flex items-center justify-center p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition cursor-pointer border border-rose-200"
                            title="Excluir Lançamento Financeiro"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-stone-500 font-semibold text-xs uppercase">
                    NENHUM REGISTRO ENCONTRADO
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Baixa de Pagamento */}
      {isSettlementModalOpen && settlementExpense && (
        <PaymentSettlementModal
          isOpen={isSettlementModalOpen}
          onClose={() => {
            setIsSettlementModalOpen(false);
            setSettlementExpense(null);
          }}
          expense={settlementExpense}
          bankAccounts={bankAccounts}
          employees={employees}
          onConfirmSettlement={(params) => {
            if (onSettleExpense) {
              onSettleExpense(params);
            } else {
              onToggleStatus(params.expenseId);
            }
            setIsSettlementModalOpen(false);
            setSettlementExpense(null);
          }}
        />
      )}
    </div>
  );
};
