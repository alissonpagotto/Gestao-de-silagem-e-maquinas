import React, { useState, useMemo } from 'react';
import { 
  X, 
  Search, 
  Calendar, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Filter, 
  FileText, 
  Printer, 
  Plus, 
  Landmark, 
  User, 
  Tag, 
  Building2, 
  AlertCircle,
  Clock,
  RotateCcw,
  CheckCircle2,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { BankAccount, Expense, BankTransaction, Employee } from '../../types';
import { formatCurrencyBRL, formatDateBR } from '../../lib/storage';
import { BankLogoIcon } from './BankLogoIcon';

interface BankAccountStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: BankAccount[];
  selectedAccountId?: string;
  expenses: Expense[];
  transactions: BankTransaction[];
  employees: Employee[];
  onAddTransaction?: (transaction: Omit<BankTransaction, 'id' | 'createdAt'>) => void;
  onDeleteTransaction?: (id: string) => void;
}

export const BankAccountStatementModal: React.FC<BankAccountStatementModalProps> = ({
  isOpen,
  onClose,
  accounts = [],
  selectedAccountId: initialAccountId,
  expenses = [],
  transactions = [],
  employees = [],
  onAddTransaction,
  onDeleteTransaction,
}) => {
  // Conta ativa no extrato
  const [activeAccountId, setActiveAccountId] = useState<string>(initialAccountId || (accounts[0]?.id || 'todas'));

  // Datas para filtro (Padrão: início e fim do mês atual)
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState<string>(defaultStart);
  const [endDate, setEndDate] = useState<string>(defaultEnd);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'todas' | 'entrada' | 'saida'>('todas');

  // Estado para novo lançamento manual
  const [isAddingEntry, setIsAddingEntry] = useState(false);
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newDesc, setNewDesc] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newType, setNewType] = useState<'entrada' | 'saida'>('saida');
  const [newCategory, setNewCategory] = useState('Tarifas Bancárias');
  const [newEmployeeId, setNewEmployeeId] = useState('');
  const [newDoc, setNewDoc] = useState('');

  // Conta selecionada
  const activeAccount = useMemo(() => {
    return accounts.find((a) => a.id === activeAccountId);
  }, [accounts, activeAccountId]);

  // Consolidar movimentações da conta (Despesas baixadas com essa conta + BankTransactions)
  const allMovements = useMemo(() => {
    const list: BankTransaction[] = [];

    // 1. Movimentações diretas registradas
    transactions.forEach((tx) => {
      if (activeAccountId === 'todas' || tx.bankAccountId === activeAccountId) {
        list.push(tx);
      }
    });

    // 2. Despesas pagas vinculadas a esta conta bancária (Saídas / Débitos)
    expenses.forEach((exp) => {
      if (exp.status === 'pago') {
        const matchesAccount = activeAccountId === 'todas' 
          ? !!exp.bankAccountId 
          : exp.bankAccountId === activeAccountId;

        if (matchesAccount) {
          // Evita duplicar se já foi adicionado como BankTransaction com sourceId
          const alreadyInList = list.some((item) => item.sourceId === exp.id);
          if (!alreadyInList) {
            const acc = accounts.find((a) => a.id === exp.bankAccountId);
            list.push({
              id: `exp_tx_${exp.id}`,
              bankAccountId: exp.bankAccountId || '',
              bankAccountName: exp.bankAccountName || acc?.name || 'Conta Bancária',
              date: exp.paymentDate || exp.dueDate || exp.date || '',
              description: exp.description ? `${exp.supplier ? `${exp.supplier} - ` : ''}${exp.description}` : exp.supplier || 'Pagamento de Despesa',
              type: 'saida',
              amount: exp.amount,
              category: exp.categoryName || 'Despesas Gerais',
              sourceType: 'despesa',
              sourceId: exp.id,
              paidByEmployeeId: exp.paidByEmployeeId || exp.employeeId,
              paidByEmployeeName: exp.paidByEmployeeName || exp.employeeName,
              documentNumber: exp.invoiceNumber || exp.paymentAuthenticationCode,
              createdAt: exp.createdAt,
            });
          }
        }
      }
    });

    // Ordenação decrescente por data (mais recentes primeiro)
    return list.sort((a, b) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      return dateB.localeCompare(dateA);
    });
  }, [activeAccountId, transactions, expenses, accounts]);

  // FILTRO POR INTERVALO DE DATAS, TEXTO E TIPO
  const filteredMovements = useMemo(() => {
    return allMovements.filter((m) => {
      // Filtro por Data Inicial e Final
      if (startDate && m.date && m.date < startDate) return false;
      if (endDate && m.date && m.date > endDate) return false;

      // Filtro por Tipo (Entrada ou Saída)
      if (typeFilter !== 'todas' && m.type !== typeFilter) return false;

      // Filtro por Busca de Texto
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const descMatch = m.description.toLowerCase().includes(query);
        const catMatch = m.category?.toLowerCase().includes(query);
        const empMatch = m.paidByEmployeeName?.toLowerCase().includes(query);
        const docMatch = m.documentNumber?.toLowerCase().includes(query);
        const accMatch = m.bankAccountName?.toLowerCase().includes(query);
        if (!descMatch && !catMatch && !empMatch && !docMatch && !accMatch) {
          return false;
        }
      }

      return true;
    });
  }, [allMovements, startDate, endDate, typeFilter, searchTerm]);

  // Cálculos de Resumo do Período
  const metrics = useMemo(() => {
    let totalEntradas = 0;
    let totalSaidas = 0;

    filteredMovements.forEach((m) => {
      if (m.type === 'entrada') {
        totalEntradas += m.amount;
      } else {
        totalSaidas += m.amount;
      }
    });

    const saldoPeriodo = totalEntradas - totalSaidas;

    return {
      totalEntradas,
      totalSaidas,
      saldoPeriodo,
      count: filteredMovements.length,
    };
  }, [filteredMovements]);

  // Atalhos rápidos de data
  const handleQuickPeriod = (preset: 'hoje' | '7dias' | 'mes_atual' | '30dias' | 'ano' | 'tudo') => {
    const todayStr = new Date().toISOString().split('T')[0];
    const curr = new Date();

    switch (preset) {
      case 'hoje':
        setStartDate(todayStr);
        setEndDate(todayStr);
        break;
      case '7dias': {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        setStartDate(d.toISOString().split('T')[0]);
        setEndDate(todayStr);
        break;
      }
      case 'mes_atual':
        setStartDate(new Date(curr.getFullYear(), curr.getMonth(), 1).toISOString().split('T')[0]);
        setEndDate(new Date(curr.getFullYear(), curr.getMonth() + 1, 0).toISOString().split('T')[0]);
        break;
      case '30dias': {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        setStartDate(d.toISOString().split('T')[0]);
        setEndDate(todayStr);
        break;
      }
      case 'ano':
        setStartDate(new Date(curr.getFullYear(), 0, 1).toISOString().split('T')[0]);
        setEndDate(new Date(curr.getFullYear(), 11, 31).toISOString().split('T')[0]);
        break;
      case 'tudo':
        setStartDate('');
        setEndDate('');
        break;
    }
  };

  if (!isOpen) return null;

  const handleSaveNewEntry = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(newAmount.replace(/\./g, '').replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      alert('Informe um valor numérico válido maior que zero.');
      return;
    }

    if (!newDesc.trim()) {
      alert('Informe a descrição do lançamento.');
      return;
    }

    const targetAccId = activeAccountId === 'todas' ? (accounts[0]?.id || '') : activeAccountId;
    if (!targetAccId) {
      alert('Selecione uma conta bancária para o lançamento.');
      return;
    }

    const targetAcc = accounts.find((a) => a.id === targetAccId);
    const emp = employees.find((e) => e.id === newEmployeeId);

    if (onAddTransaction) {
      onAddTransaction({
        bankAccountId: targetAccId,
        bankAccountName: targetAcc?.name || 'Conta Bancária',
        date: newDate,
        description: newDesc.trim(),
        type: newType,
        amount: val,
        category: newCategory,
        sourceType: 'manual',
        paidByEmployeeId: newEmployeeId || undefined,
        paidByEmployeeName: emp?.name || undefined,
        documentNumber: newDoc.trim() || undefined,
      });
    }

    setIsAddingEntry(false);
    setNewDesc('');
    setNewAmount('');
    setNewDoc('');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div 
      id="modal-extrato-bancario"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto backdrop-blur-xs animate-in fade-in"
      style={{ backgroundColor: 'rgba(9, 99, 203, 0.45)' }}
    >
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-stone-300 my-auto flex flex-col max-h-[96vh]">
        
        {/* CABEÇALHO DO EXTRATO */}
        <div 
          className="px-5 py-4 flex flex-wrap items-center justify-between text-white shrink-0 shadow-sm gap-3"
          style={{ backgroundColor: '#0963cb' }}
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0 shadow-inner">
              <FileText className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                Extrato de Contas Bancárias
              </h3>
              <p className="text-xs text-sky-100 font-medium">
                Movimentações financeiras, identificação de responsáveis e conciliação
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Seletor de Conta */}
            <div className="bg-white/10 rounded-xl p-1 flex items-center border border-white/20">
              <select
                id="select-conta-extrato-topo"
                value={activeAccountId}
                onChange={(e) => setActiveAccountId(e.target.value)}
                className="bg-transparent text-white font-bold text-xs sm:text-sm px-2 py-1 outline-hidden cursor-pointer"
              >
                <option value="todas" className="text-black bg-white font-bold">
                  🏦 Todas as Contas ({accounts.length})
                </option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id} className="text-black bg-white font-semibold">
                    {acc.bankCode ? `[${acc.bankCode}] ` : ''}{acc.name} ({acc.bankName})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              id="btn-imprimir-extrato"
              onClick={handlePrint}
              className="p-2 rounded-xl text-white/90 hover:text-white hover:bg-white/20 transition cursor-pointer flex items-center gap-1 text-xs font-bold"
              title="Imprimir Extrato"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>

            <button
              type="button"
              id="btn-fechar-modal-extrato"
              onClick={onClose}
              className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/20 transition cursor-pointer"
              title="Fechar"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* CORPO DO EXTRATO */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-black bg-stone-50/50">
          
          {/* BANNER DA CONTA ATIVA */}
          {activeAccount && (
            <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0 shadow-inner overflow-hidden"
                  style={{ backgroundColor: activeAccount.color || '#0963cb' }}
                >
                  <BankLogoIcon code={activeAccount.bankCode} name={activeAccount.bankName} size={30} className="text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-black text-black">
                      {activeAccount.name}
                    </h4>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 uppercase">
                      {activeAccount.accountType.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 font-medium">
                    {activeAccount.bankName} 
                    {activeAccount.agency ? ` • Agência: ${activeAccount.agency}` : ''}
                    {activeAccount.accountNumber ? ` • Conta: ${activeAccount.accountNumber}${activeAccount.accountDigit ? `-${activeAccount.accountDigit}` : ''}` : ''}
                    {activeAccount.pixKey ? ` • PIX: ${activeAccount.pixKey}` : ''}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-black uppercase tracking-wider text-stone-500 block">
                  Saldo Atual em Conta
                </span>
                <span className={`text-xl sm:text-2xl font-black font-['Outfit'] ${activeAccount.balance < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                  {formatCurrencyBRL(activeAccount.balance)}
                </span>
              </div>
            </div>
          )}

          {/* ÁREA DE FILTROS: INTERVALO DE DATAS (OBRIGATÓRIO) + BUSCA + ATALHOS */}
          <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-2xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-2.5">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-[#0963cb]" />
                <span className="text-xs sm:text-sm font-black text-black">
                  Filtro Obrigatório por Intervalo de Datas
                </span>
              </div>

              {/* Atalhos Rápidos de Período */}
              <div className="flex items-center gap-1 overflow-x-auto text-[11px]">
                <button
                  type="button"
                  onClick={() => handleQuickPeriod('hoje')}
                  className="px-2 py-1 rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-100 font-bold cursor-pointer"
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPeriod('7dias')}
                  className="px-2 py-1 rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-100 font-bold cursor-pointer"
                >
                  7 Dias
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPeriod('mes_atual')}
                  className="px-2 py-1 rounded-lg border border-[#0963cb] bg-blue-50 text-[#0963cb] font-black cursor-pointer"
                >
                  Mês Atual
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPeriod('30dias')}
                  className="px-2 py-1 rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-100 font-bold cursor-pointer"
                >
                  30 Dias
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPeriod('ano')}
                  className="px-2 py-1 rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-100 font-bold cursor-pointer"
                >
                  Ano Todo
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPeriod('tudo')}
                  className="px-2 py-1 rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-100 font-bold cursor-pointer"
                >
                  Todos
                </button>
              </div>
            </div>

            {/* Campos de Data Inicial e Final + Busca + Tipo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Data Inicial */}
              <div>
                <label htmlFor="filtro-extrato-data-inicio" className="block text-[11px] font-black text-black mb-1">
                  Data Inicial
                </label>
                <input
                  id="filtro-extrato-data-inicio"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs sm:text-sm font-bold bg-white text-black border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#0963cb] outline-hidden shadow-2xs"
                />
              </div>

              {/* Data Final */}
              <div>
                <label htmlFor="filtro-extrato-data-fim" className="block text-[11px] font-black text-black mb-1">
                  Data Final
                </label>
                <input
                  id="filtro-extrato-data-fim"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs sm:text-sm font-bold bg-white text-black border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#0963cb] outline-hidden shadow-2xs"
                />
              </div>

              {/* Busca por Texto */}
              <div>
                <label htmlFor="filtro-extrato-busca" className="block text-[11px] font-black text-black mb-1">
                  Buscar Lançamento
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="filtro-extrato-busca"
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Descrição, responsável, doc..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs sm:text-sm font-semibold bg-white text-black border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#0963cb] outline-hidden shadow-2xs"
                  />
                </div>
              </div>

              {/* Filtro por Tipo */}
              <div>
                <label htmlFor="filtro-extrato-tipo" className="block text-[11px] font-black text-black mb-1">
                  Tipo de Movimento
                </label>
                <select
                  id="filtro-extrato-tipo"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as any)}
                  className="w-full px-3 py-1.5 text-xs sm:text-sm font-bold bg-white text-black border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#0963cb] outline-hidden shadow-2xs cursor-pointer"
                >
                  <option value="todas">Todos (Entradas e Saídas)</option>
                  <option value="entrada">🟢 Apenas Entradas (Créditos)</option>
                  <option value="saida">🔴 Apenas Saídas (Débitos)</option>
                </select>
              </div>
            </div>
          </div>

          {/* CARDS DE RESUMO DO PERÍODO */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Total Entradas */}
            <div className="bg-white rounded-2xl p-3.5 border border-stone-200 shadow-2xs flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-stone-500 block">
                  (+) Total Entradas (Período)
                </span>
                <span className="text-base sm:text-lg font-black text-emerald-700 font-['Outfit']">
                  {formatCurrencyBRL(metrics.totalEntradas)}
                </span>
              </div>
            </div>

            {/* Total Saídas */}
            <div className="bg-white rounded-2xl p-3.5 border border-stone-200 shadow-2xs flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <TrendingDown className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-stone-500 block">
                  (-) Total Saídas (Período)
                </span>
                <span className="text-base sm:text-lg font-black text-rose-600 font-['Outfit']">
                  {formatCurrencyBRL(metrics.totalSaidas)}
                </span>
              </div>
            </div>

            {/* Resultado do Período */}
            <div className="bg-white rounded-2xl p-3.5 border border-stone-200 shadow-2xs flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${metrics.saldoPeriodo >= 0 ? 'bg-blue-100 text-[#0963cb]' : 'bg-amber-100 text-amber-700'}`}>
                <Landmark className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-stone-500 block">
                  (=) Resultado Líquido do Período
                </span>
                <span className={`text-base sm:text-lg font-black font-['Outfit'] ${metrics.saldoPeriodo >= 0 ? 'text-[#0963cb]' : 'text-rose-600'}`}>
                  {formatCurrencyBRL(metrics.saldoPeriodo)}
                </span>
              </div>
            </div>
          </div>

          {/* BOTÃO PARA NOVO LANÇAMENTO MANUAL (TARIFAS, RENDIMENTOS, AJUSTES) */}
          <div className="flex items-center justify-between">
            <div className="text-xs text-stone-600 font-bold">
              Exibindo <span className="text-black font-black">{filteredMovements.length}</span> lançamentos encontrados no período selecionado
            </div>

            <button
              type="button"
              id="btn-abrir-novo-lancamento-extrato"
              onClick={() => setIsAddingEntry(!isAddingEntry)}
              className="px-3 py-1.5 rounded-xl bg-white border border-stone-300 text-black hover:bg-stone-50 text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition"
            >
              <Plus className="w-3.5 h-3.5 text-[#0963cb] stroke-[3]" />
              <span>{isAddingEntry ? 'Cancelar Lançamento' : '+ Lançamento Manual no Extrato'}</span>
            </button>
          </div>

          {/* FORMULÁRIO COLAPSÁVEL DE NOVO LANÇAMENTO MANUAL */}
          {isAddingEntry && (
            <form onSubmit={handleSaveNewEntry} className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-black text-[#0963cb] uppercase tracking-wider flex items-center gap-1.5">
                  <Landmark className="w-4 h-4" />
                  Novo Lançamento Manual no Extrato Bancário
                </h5>
                <span className="text-[10px] text-stone-500 font-medium">
                  Tarifas, rendimentos, depósitos, estornos ou transferências
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-black mb-1">Data</label>
                  <input
                    type="date"
                    required
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-bold bg-white text-black border border-stone-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-black mb-1">Tipo</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 text-xs font-bold bg-white text-black border border-stone-300 rounded-xl"
                  >
                    <option value="saida">🔴 Saída (Débito / Tarifa)</option>
                    <option value="entrada">🟢 Entrada (Crédito / Rendimento)</option>
                  </select>
                </div>

                <div className="lg:col-span-2">
                  <label className="block text-[11px] font-bold text-black mb-1">Descrição</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Tarifa de Manutenção, Rendimento CDB..."
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-semibold bg-white text-black border border-stone-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-black mb-1">Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0,00"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-black bg-white text-black border border-stone-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-black mb-1">Responsável pela Operação</label>
                  <select
                    value={newEmployeeId}
                    onChange={(e) => setNewEmployeeId(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-semibold bg-white text-black border border-stone-300 rounded-xl"
                  >
                    <option value="">-- Selecione o Responsável --</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-black mb-1">Categoria</label>
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-semibold bg-white text-black border border-stone-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-black mb-1">Nº Documento / Autenticação</label>
                  <input
                    type="text"
                    placeholder="Opcional"
                    value={newDoc}
                    onChange={(e) => setNewDoc(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-semibold bg-white text-black border border-stone-300 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0963cb] text-white font-bold text-xs rounded-xl shadow-xs hover:bg-blue-700 cursor-pointer transition"
                >
                  Salvar Lançamento no Extrato
                </button>
              </div>
            </form>
          )}

          {/* TABELA DE MOVIMENTAÇÕES DO EXTRATO */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-stone-100/80 border-b border-stone-200 text-stone-700 uppercase tracking-wider font-black text-[10px]">
                    <th className="py-3 px-3.5">Data</th>
                    <th className="py-3 px-3.5">Descrição da Movimentação</th>
                    <th className="py-3 px-3.5">Conta Bancária</th>
                    <th className="py-3 px-3.5">Responsável (Quem fez)</th>
                    <th className="py-3 px-3.5">Tipo</th>
                    <th className="py-3 px-3.5 text-right">Valor (R$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-medium">
                  {filteredMovements.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-stone-500">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <AlertCircle className="w-8 h-8 text-stone-400" />
                          <p className="font-bold text-sm text-stone-700">
                            Nenhuma movimentação financeira encontrada para este período.
                          </p>
                          <p className="text-xs text-stone-500">
                            Altere o intervalo de datas ou cadastre novos pagamentos e baixas.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredMovements.map((m) => {
                      const isEntry = m.type === 'entrada';

                      return (
                        <tr key={m.id} className="hover:bg-stone-50/80 transition-colors">
                          {/* Data */}
                          <td className="py-3 px-3.5 font-bold font-mono text-stone-800 whitespace-nowrap">
                            {m.date ? formatDateBR(m.date) : '—'}
                          </td>

                          {/* Descrição + Categoria + Documento */}
                          <td className="py-3 px-3.5">
                            <div className="font-black text-black text-xs sm:text-sm">
                              {m.description}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-stone-500">
                              <span className="bg-stone-100 text-stone-700 px-1.5 py-0.2 rounded font-semibold">
                                {m.category || 'Movimentação'}
                              </span>
                              {m.documentNumber && (
                                <span className="font-mono text-stone-500">
                                  Doc: {m.documentNumber}
                                </span>
                              )}
                              {m.sourceType === 'despesa' && (
                                <span className="bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded font-bold text-[10px]">
                                  Conta a Pagar Baixada
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Conta Bancária */}
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <span className="font-bold text-stone-800 text-xs">
                              {m.bankAccountName || 'Conta Bancária'}
                            </span>
                          </td>

                          {/* Responsável (Quem realizou) */}
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            {m.paidByEmployeeName ? (
                              <div className="flex items-center space-x-1.5 text-stone-800 font-bold">
                                <User className="w-3.5 h-3.5 text-[#0963cb]" />
                                <span>{m.paidByEmployeeName}</span>
                              </div>
                            ) : (
                              <span className="text-stone-400 italic text-[11px]">Não registrado</span>
                            )}
                          </td>

                          {/* Tipo */}
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            {isEntry ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800">
                                <ArrowDownLeft className="w-3 h-3 stroke-[3]" />
                                Entrada
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black bg-rose-100 text-rose-800">
                                <ArrowUpRight className="w-3 h-3 stroke-[3]" />
                                Saída
                              </span>
                            )}
                          </td>

                          {/* Valor */}
                          <td className="py-3 px-3.5 text-right whitespace-nowrap">
                            <span className={`font-black font-['Outfit'] text-xs sm:text-sm ${isEntry ? 'text-emerald-700' : 'text-rose-600'}`}>
                              {isEntry ? '+' : '-'} {formatCurrencyBRL(m.amount)}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* RODAPÉ DO MODAL */}
        <div className="px-5 py-3 bg-stone-100 border-t border-stone-200 flex items-center justify-between text-xs text-stone-600 shrink-0">
          <div className="font-bold">
            Intervalo ativo: <span className="text-black font-mono font-bold">{startDate ? formatDateBR(startDate) : 'Início'}</span> até <span className="text-black font-mono font-bold">{endDate ? formatDateBR(endDate) : 'Hoje'}</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white border border-stone-300 font-bold text-stone-700 hover:bg-stone-50 cursor-pointer shadow-2xs"
          >
            Fechar Extrato
          </button>
        </div>

      </div>
    </div>
  );
};
