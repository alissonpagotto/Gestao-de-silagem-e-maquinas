import React, { useState, useMemo, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ArrowUpRight, 
  ArrowDownRight,
  ArrowDownLeft,
  Calendar as CalendarIcon,
  LayoutGrid,
  BarChart2,
  Truck,
  Handshake,
  FileSpreadsheet,
  Layers,
  Sprout,
  Tractor,
  PieChart as PieIcon,
  Download,
  Landmark,
  Scale,
  PlusCircle,
  Sparkles
} from 'lucide-react';
import { 
  Expense, 
  SilageOrder, 
  CropSeason, 
  BankAccount, 
  ThirdPartySettlement, 
  BrokerSettlement,
  ServiceOrder,
  ExpenseCategory,
  CostCenter,
  Employee,
  FleetTeam,
  Machinery,
  CompanyProfile,
  BankTransaction,
  PaymentMethod
} from '../../types';
import { formatCurrencyBRL, getStoredBankTransactions, saveStoredBankTransactions, saveStoredExpenses, getStoredBrokerSettlements, saveStoredBrokerSettlements } from '../../lib/storage';
import { BankAccountsTab } from './BankAccountsTab';
import { PayablesTab } from './PayablesTab';
import { ReceivablesTab } from './ReceivablesTab';
import { ThirdPartySettlementsTab } from './ThirdPartySettlementsTab';
import { BrokerSettlementsTab } from './BrokerSettlementsTab';
import { FinancialExportTab } from './FinancialExportTab';
import { ExpenseStats } from '../expenses/ExpenseStats';
import { ExpenseCharts } from '../expenses/ExpenseCharts';
import { ExpenseList } from '../expenses/ExpenseList';

export type FinancialTabType = 
  | 'consolidado' 
  | 'despesas'
  | 'contas' 
  | 'a_pagar' 
  | 'a_receber' 
  | 'acertos' 
  | 'acertos_agenciadores'
  | 'exportar';

interface FinancialSummaryProps {
  expenses: Expense[];
  orders: SilageOrder[];
  seasons: CropSeason[];
  services?: ServiceOrder[];
  bankAccounts?: BankAccount[];
  bankTransactions?: BankTransaction[];
  settlements?: ThirdPartySettlement[];
  categories?: ExpenseCategory[];
  costCenters?: CostCenter[];
  employees?: Employee[];
  fleetTeams?: FleetTeam[];
  machineries?: Machinery[];
  companyProfile?: CompanyProfile;
  initialSubTab?: FinancialTabType;
  onSaveBankAccounts?: (accounts: BankAccount[]) => void;
  onSaveBankTransactions?: (transactions: BankTransaction[]) => void;
  onSaveExpenses?: (expenses: Expense[]) => void;
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
  }) => void;
  onReverseExpense?: (id: string) => void;
  onAddExpenseFromBankBill?: (expense: Partial<Expense>) => void;
  onLinkExpensesToAccount?: (expenseIds: string[], accountId: string) => void;
  onSaveSettlements?: (settlements: ThirdPartySettlement[]) => void;
  onToggleExpenseStatus?: (id: string) => void;
  onEditExpense?: (exp: Expense) => void;
  onNewExpense?: () => void;
  onDeleteExpense?: (id: string) => void;
  onViewReceipt?: (exp: Expense) => void;
  onDuplicateExpense?: (exp: Expense) => void;
  onOpenAiParser?: () => void;
  onAddExpenseFromNfe?: (expense: Partial<Expense>) => void;
}

export const FinancialSummary: React.FC<FinancialSummaryProps> = ({
  expenses = [],
  orders = [],
  seasons = [],
  services = [],
  bankAccounts = [],
  bankTransactions: bankTransactionsProp,
  settlements = [],
  categories = [],
  costCenters = [],
  employees = [],
  fleetTeams = [],
  machineries = [],
  companyProfile,
  initialSubTab,
  onSaveBankAccounts = (_accounts: BankAccount[]) => {},
  onSaveBankTransactions,
  onSaveExpenses,
  onSettleExpense,
  onReverseExpense,
  onAddExpenseFromBankBill,
  onLinkExpensesToAccount,
  onSaveSettlements = (_settlements: ThirdPartySettlement[]) => {},
  onToggleExpenseStatus = (_id: string) => {},
  onEditExpense,
  onNewExpense,
  onDeleteExpense = (_id: string) => {},
  onViewReceipt = (_exp: Expense) => {},
  onDuplicateExpense = (_exp: Expense) => {},
  onOpenAiParser,
  onAddExpenseFromNfe = (_expense: Partial<Expense>) => {},
}) => {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<FinancialTabType>(initialSubTab || 'consolidado');

  // Internal bank transactions state if not controlled
  const [internalBankTransactions, setInternalBankTransactions] = useState<BankTransaction[]>(
    () => bankTransactionsProp || getStoredBankTransactions()
  );

  useEffect(() => {
    if (bankTransactionsProp) {
      setInternalBankTransactions(bankTransactionsProp);
    }
  }, [bankTransactionsProp]);

  const handleSaveTransactions = (txs: BankTransaction[]) => {
    setInternalBankTransactions(txs);
    saveStoredBankTransactions(txs);
    if (onSaveBankTransactions) {
      onSaveBankTransactions(txs);
    }
  };

  // State para Acertos de Agenciadores com persistência
  const [internalBrokerSettlements, setInternalBrokerSettlements] = useState<BrokerSettlement[]>(
    () => getStoredBrokerSettlements()
  );

  const handleSaveBrokerSettlements = (items: BrokerSettlement[]) => {
    setInternalBrokerSettlements(items);
    saveStoredBrokerSettlements(items);
  };

  // Liquidação de Despesa com identificação de funcionário e débito bancário
  const handleSettleExpenseInternal = (params: {
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
  }) => {
    if (onSettleExpense) {
      onSettleExpense(params);
      return;
    }

    const exp = expenses.find((e) => e.id === params.expenseId);
    if (!exp) return;

    // Atualiza a despesa
    const updatedExpenses = expenses.map((e) => {
      if (e.id === params.expenseId) {
        return {
          ...e,
          status: 'pago' as const,
          paymentDate: params.paymentDate,
          paidByEmployeeId: params.paidByEmployeeId,
          paidByEmployeeName: params.paidByEmployeeName,
          bankAccountId: params.bankAccountId,
          bankAccountName: params.bankAccountName,
          creditSupplier: params.creditSupplier || e.creditSupplier || e.supplier,
          paymentMethod: params.paymentMethod,
          notes: params.notes ? (e.notes ? `${e.notes} | ${params.notes}` : params.notes) : e.notes,
        };
      }
      return e;
    });

    if (onSaveExpenses) {
      onSaveExpenses(updatedExpenses);
    } else {
      saveStoredExpenses(updatedExpenses);
      onToggleExpenseStatus(params.expenseId);
    }

    // Debita o saldo da conta bancária
    const updatedAccounts = bankAccounts.map((acc) => {
      if (acc.id === params.bankAccountId) {
        return {
          ...acc,
          balance: acc.balance - exp.amount,
        };
      }
      return acc;
    });
    onSaveBankAccounts(updatedAccounts);

    // Registra a transação bancária no extrato da conta
    const newTx: BankTransaction = {
      id: `tx_pay_${Date.now()}`,
      bankAccountId: params.bankAccountId,
      bankAccountName: params.bankAccountName,
      date: params.paymentDate,
      description: `Pagamento Despesa: ${params.creditSupplier || exp.supplier || exp.description}`,
      type: 'saida',
      amount: exp.amount,
      category: exp.categoryName || 'Despesas',
      expenseId: exp.id,
      paidByEmployeeId: params.paidByEmployeeId,
      paidByEmployeeName: params.paidByEmployeeName,
      sourceType: 'baixa_pagamento',
      notes: params.notes,
      createdAt: new Date().toISOString(),
    };

    handleSaveTransactions([newTx, ...internalBankTransactions]);
  };

  // Estorno de Despesa com estorno do saldo bancário
  const handleReverseExpenseInternal = (expenseId: string) => {
    if (onReverseExpense) {
      onReverseExpense(expenseId);
      return;
    }

    const exp = expenses.find((e) => e.id === expenseId);
    if (!exp) return;

    const updatedExpenses = expenses.map((e) => {
      if (e.id === expenseId) {
        return {
          ...e,
          status: 'pendente' as const,
        };
      }
      return e;
    });

    if (onSaveExpenses) {
      onSaveExpenses(updatedExpenses);
    } else {
      saveStoredExpenses(updatedExpenses);
      onToggleExpenseStatus(expenseId);
    }

    // Devolve o saldo à conta se tiver sido debitado
    if (exp.bankAccountId) {
      const updatedAccounts = bankAccounts.map((acc) => {
        if (acc.id === exp.bankAccountId) {
          return {
            ...acc,
            balance: acc.balance + exp.amount,
          };
        }
        return acc;
      });
      onSaveBankAccounts(updatedAccounts);

      // Registra estorno no extrato
      const refundTx: BankTransaction = {
        id: `tx_rev_${Date.now()}`,
        bankAccountId: exp.bankAccountId,
        bankAccountName: exp.bankAccountName || 'Conta Bancária',
        date: new Date().toISOString().split('T')[0],
        description: `Estorno Pagamento: ${exp.supplier || exp.description}`,
        type: 'entrada',
        amount: exp.amount,
        category: 'Estorno de Pagamento',
        expenseId: exp.id,
        sourceType: 'manual',
        createdAt: new Date().toISOString(),
      };
      handleSaveTransactions([refundTx, ...internalBankTransactions]);
    }
  };

  // Inserir boleto / conta bancária
  const handleAddExpenseFromBankBillInternal = (newExpData: Partial<Expense>) => {
    if (onAddExpenseFromBankBill) {
      onAddExpenseFromBankBill(newExpData);
      return;
    }

    const cat = categories.find((c) => c.name === newExpData.categoryName);
    const newExp: Expense = {
      id: `exp_bank_${Date.now()}`,
      description: newExpData.description || 'Despesa Bancária',
      amount: newExpData.amount || 0,
      categoryId: newExpData.categoryId || cat?.id || 'cat_default',
      categoryName: newExpData.categoryName || cat?.name || 'Geral',
      categoryColor: cat?.color || '#0963cb',
      dueDate: newExpData.dueDate || new Date().toISOString().split('T')[0],
      date: newExpData.dueDate || new Date().toISOString().split('T')[0],
      status: 'pendente',
      paymentMethod: 'boleto',
      supplier: newExpData.supplier || 'Fornecedor Bancário',
      bankAccountId: newExpData.bankAccountId,
      bankAccountName: newExpData.bankAccountName,
      invoiceNumber: newExpData.invoiceNumber,
      notes: newExpData.notes,
      createdAt: new Date().toISOString(),
    };

    const updated = [newExp, ...expenses];
    if (onSaveExpenses) {
      onSaveExpenses(updated);
    } else {
      saveStoredExpenses(updated);
    }
  };

  // Vincular contas a pagar em lote à conta bancária
  const handleLinkExpensesToAccountInternal = (expenseIds: string[], accountId: string) => {
    if (onLinkExpensesToAccount) {
      onLinkExpensesToAccount(expenseIds, accountId);
      return;
    }

    const acc = bankAccounts.find((a) => a.id === accountId);
    if (!acc) return;

    const updated = expenses.map((e) => {
      if (expenseIds.includes(e.id)) {
        return {
          ...e,
          bankAccountId: acc.id,
          bankAccountName: acc.name,
        };
      }
      return e;
    });

    if (onSaveExpenses) {
      onSaveExpenses(updated);
    } else {
      saveStoredExpenses(updated);
    }
  };

  useEffect(() => {
    if (initialSubTab) {
      setActiveTab(initialSubTab);
    }
  }, [initialSubTab]);

  // Period Filter State
  const [quickPeriod, setQuickPeriod] = useState<'mes_atual' | '1_mes' | '3_meses' | '6_meses' | '12_meses'>('mes_atual');
  
  // Custom Date Range
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonthNum = today.getMonth(); // 0-indexed

  // Format Month Year in PT-BR (ex: "agosto/2026")
  const monthNames = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];
  const currentMonthName = monthNames[currentMonthNum];
  const capitalizedMonthName = currentMonthName.charAt(0).toUpperCase() + currentMonthName.slice(1);

  // Default start & end of current month
  const firstDayOfMonth = new Date(currentYear, currentMonthNum, 1).toISOString().split('T')[0];
  const lastDayOfMonth = new Date(currentYear, currentMonthNum + 1, 0).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(lastDayOfMonth);

  // Quick period handler
  const handleQuickPeriodChange = (period: 'mes_atual' | '1_mes' | '3_meses' | '6_meses' | '12_meses') => {
    setQuickPeriod(period);
    const now = new Date();
    let start = new Date();
    let end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    if (period === 'mes_atual') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === '1_mes') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    } else if (period === '3_meses') {
      start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    } else if (period === '6_meses') {
      start = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    } else if (period === '12_meses') {
      start = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    }

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  // Filter Data for Current Month (Row 1)
  const currentMonthStart = `${currentYear}-${String(currentMonthNum + 1).padStart(2, '0')}-01`;
  const currentMonthEnd = `${currentYear}-${String(currentMonthNum + 1).padStart(2, '0')}-31`;

  const currentMonthRevenue = useMemo(() => {
    const ordersRev = orders
      .filter((o) => o.date >= currentMonthStart && o.date <= currentMonthEnd)
      .reduce((acc, curr) => acc + curr.totalAmount, 0);
    const servicesRev = services
      .filter((s) => s.date >= currentMonthStart && s.date <= currentMonthEnd)
      .reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);
    return ordersRev + servicesRev;
  }, [orders, services, currentMonthStart, currentMonthEnd]);

  const currentMonthExpenses = useMemo(() => {
    return expenses
      .filter((e) => e.date >= currentMonthStart && e.date <= currentMonthEnd)
      .reduce((acc, curr) => acc + curr.amount, 0);
  }, [expenses, currentMonthStart, currentMonthEnd]);

  const currentMonthRealBalance = currentMonthRevenue - currentMonthExpenses;

  // Filter Data for Filtered Period (Row 2)
  const periodRevenue = useMemo(() => {
    const ordersRev = orders
      .filter((o) => (!startDate || o.date >= startDate) && (!endDate || o.date <= endDate))
      .reduce((acc, curr) => acc + curr.totalAmount, 0);
    const servicesRev = services
      .filter((s) => (!startDate || s.date >= startDate) && (!endDate || s.date <= endDate))
      .reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);
    return ordersRev + servicesRev;
  }, [orders, services, startDate, endDate]);

  const periodExpenses = useMemo(() => {
    return expenses
      .filter((e) => (!startDate || e.date >= startDate) && (!endDate || e.date <= endDate))
      .reduce((acc, curr) => acc + curr.amount, 0);
  }, [expenses, startDate, endDate]);

  const periodAccumulatedBalance = periodRevenue - periodExpenses;

  // Global / DRE Metrics
  const currentSeason = seasons[0];
  const totalRevenue = orders.reduce((acc, curr) => acc + curr.totalAmount, 0) +
                       services.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);

  const directCosts = expenses
    .filter((e) => ['cat_combustivel', 'cat_insumos', 'cat_mao_de_obra', 'cat_lona_embalagem'].includes(e.categoryId))
    .reduce((acc, curr) => acc + curr.amount, 0);

  const machineryCosts = expenses
    .filter((e) => e.categoryId === 'cat_manutencao')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const overheadCosts = expenses
    .filter((e) => ['cat_frete', 'cat_alimentacao', 'cat_arrendamento', 'cat_administrativo', 'cat_outros'].includes(e.categoryId))
    .reduce((acc, curr) => acc + curr.amount, 0);

  const totalCosts = directCosts + machineryCosts + overheadCosts;
  const grossMargin = totalRevenue - directCosts;
  const netProfit = totalRevenue - totalCosts;

  const totalTonsEstimated = currentSeason?.estimatedTons || 2250;
  const revenuePerTon = totalTonsEstimated > 0 ? totalRevenue / totalTonsEstimated : 0;
  const costPerTon = totalTonsEstimated > 0 ? totalCosts / totalTonsEstimated : 0;
  const profitPerTon = revenuePerTon - costPerTon;

  // Formatted period title label
  const periodLabel = useMemo(() => {
    if (quickPeriod === 'mes_atual') {
      return `${capitalizedMonthName}/${currentYear}`;
    }
    return `${startDate.split('-').reverse().join('/')} até ${endDate.split('-').reverse().join('/')}`;
  }, [quickPeriod, capitalizedMonthName, currentYear, startDate, endDate]);

  return (
    <div id="financial-module" className="w-full max-w-none space-y-4 sm:space-y-5">
      
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-black text-white tracking-tight font-['Outfit']">
            Financeiro
          </h1>
          <p className="text-xs text-white/90 font-medium">
            Contas a pagar, a receber e fluxo de caixa
          </p>
        </div>
      </div>

      {/* 2. Top Navigation Tabs Bar */}
      <div className="crm-card bg-white dark:bg-stone-900 rounded-xl border border-zinc-200 dark:border-stone-800 p-1.5 shadow-xs flex items-center overflow-x-auto gap-1.5 scrollbar-none text-zinc-900 dark:text-white">
        
        {/* Aba Consolidado */}
        <button
          type="button"
          onClick={() => setActiveTab('consolidado')}
          className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'consolidado'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-xs'
              : 'text-zinc-700 dark:text-stone-300 hover:bg-zinc-100 dark:hover:bg-slate-700 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span>Consolidado</span>
        </button>

        {/* Aba Despesas */}
        <button
          type="button"
          onClick={() => setActiveTab('despesas')}
          className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'despesas'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-xs'
              : 'text-zinc-700 dark:text-stone-300 hover:bg-zinc-100 dark:hover:bg-slate-700 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span>Despesas</span>
        </button>

        {/* Aba Contas Bancárias */}
        <button
          type="button"
          onClick={() => setActiveTab('contas')}
          className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'contas'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'text-black dark:text-stone-300 hover:bg-black/10 dark:hover:bg-slate-700 hover:text-black dark:hover:text-white'
          }`}
        >
          <BarChart2 className="w-3.5 h-3.5" />
          <span>Contas Bancárias</span>
        </button>

        {/* Aba A Pagar */}
        <button
          type="button"
          onClick={() => setActiveTab('a_pagar')}
          className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'a_pagar'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'text-black dark:text-stone-300 hover:bg-black/10 dark:hover:bg-slate-700 hover:text-black dark:hover:text-white'
          }`}
        >
          <ArrowDownLeft className="w-3.5 h-3.5" />
          <span>A Pagar</span>
        </button>

        {/* Aba A Receber */}
        <button
          type="button"
          onClick={() => setActiveTab('a_receber')}
          className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'a_receber'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'text-black dark:text-stone-300 hover:bg-black/10 dark:hover:bg-slate-700 hover:text-black dark:hover:text-white'
          }`}
        >
          <ArrowUpRight className="w-3.5 h-3.5" />
          <span>A Receber</span>
        </button>

        {/* Aba Acertos Terceiros */}
        <button
          type="button"
          onClick={() => setActiveTab('acertos')}
          className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'acertos'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'text-black dark:text-stone-300 hover:bg-black/10 dark:hover:bg-slate-700 hover:text-black dark:hover:text-white'
          }`}
        >
          <Truck className="w-3.5 h-3.5" />
          <span>Acertos Terceiros</span>
        </button>

        {/* Aba Acertos Agenciadores (Posicionada exatamente após Acertos Terceiros e antes de Exportar) */}
        <button
          type="button"
          onClick={() => setActiveTab('acertos_agenciadores')}
          className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'acertos_agenciadores'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'text-black dark:text-stone-300 hover:bg-black/10 dark:hover:bg-slate-700 hover:text-black dark:hover:text-white'
          }`}
        >
          <Handshake className="w-3.5 h-3.5" />
          <span>Acertos Agenciadores</span>
        </button>

        {/* Aba Exportar */}
        <button
          type="button"
          onClick={() => setActiveTab('exportar')}
          className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'exportar'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'text-black dark:text-stone-300 hover:bg-black/10 dark:hover:bg-slate-700 hover:text-black dark:hover:text-white'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>Exportar</span>
        </button>

      </div>

      {/* ABA: Consolidado */}
      {activeTab === 'consolidado' && (
        <div className="space-y-4">
          {/* 3. FILTRAR PERÍODO Section compact */}
          <div className="crm-card bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-xl px-3.5 py-2.5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-2.5 text-zinc-900 dark:text-white">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-black text-black dark:text-white uppercase tracking-wider whitespace-nowrap">
                FILTRAR PERÍODO:
              </span>
              <div className="flex items-center space-x-1 overflow-x-auto scrollbar-none">
                <button
                  type="button"
                  onClick={() => handleQuickPeriodChange('mes_atual')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    quickPeriod === 'mes_atual'
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'bg-white/80 dark:bg-stone-800 text-black dark:text-stone-200 hover:bg-white border border-slate-300 dark:border-stone-700'
                  }`}
                >
                  Mês atual
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPeriodChange('1_mes')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    quickPeriod === '1_mes'
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'bg-white/80 dark:bg-stone-800 text-black dark:text-stone-200 hover:bg-white border border-slate-300 dark:border-stone-700'
                  }`}
                >
                  1 mês
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPeriodChange('3_meses')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    quickPeriod === '3_meses'
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'bg-white/80 dark:bg-stone-800 text-black dark:text-stone-200 hover:bg-white border border-slate-300 dark:border-stone-700'
                  }`}
                >
                  3 meses
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPeriodChange('6_meses')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    quickPeriod === '6_meses'
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'bg-white/80 dark:bg-stone-800 text-black dark:text-stone-200 hover:bg-white border border-slate-300 dark:border-stone-700'
                  }`}
                >
                  6 meses
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPeriodChange('12_meses')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    quickPeriod === '12_meses'
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'bg-white/80 dark:bg-stone-800 text-black dark:text-stone-200 hover:bg-white border border-slate-300 dark:border-stone-700'
                  }`}
                >
                  12 meses
                </button>
              </div>
            </div>

            {/* Date range pickers */}
            <div className="flex items-center space-x-1.5 text-xs text-black dark:text-white">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setQuickPeriod('' as any);
                }}
                className="px-2.5 py-1 border border-slate-400 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-800 text-black dark:text-white text-xs font-medium focus:ring-1 focus:ring-sky-600 outline-none"
              />
              <span className="text-[11px] font-bold text-black dark:text-white">até</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setQuickPeriod('' as any);
                }}
                className="px-2.5 py-1 border border-slate-400 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-800 text-black dark:text-white text-xs font-medium focus:ring-1 focus:ring-sky-600 outline-none"
              />
            </div>
          </div>

      {/* 4. Compact Summary Indicators */}
      <div className="space-y-2">
        {/* Row 1: Mês Atual */}
        <div className="space-y-1">
          <div className="text-[11px] font-black text-black dark:text-white uppercase tracking-wider">
            Mês atual — {currentMonthName}/{currentYear}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Card Entradas (Mês Atual) */}
            <div className="crm-card bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-xl px-3.5 py-2.5 shadow-xs flex items-center justify-between text-zinc-900 dark:text-white">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-stone-800 flex items-center justify-center text-zinc-700 dark:text-stone-300 shrink-0">
                  <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <span className="text-[11px] font-black text-zinc-500 dark:text-stone-400 uppercase block leading-tight">
                    Entradas
                  </span>
                  <span className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tracking-tight font-['Outfit']">
                    {formatCurrencyBRL(currentMonthRevenue)}
                  </span>
                </div>
              </div>
            </div>

            {/* Card Saídas (Mês Atual) */}
            <div className="crm-card bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-xl px-3.5 py-2.5 shadow-xs flex items-center justify-between text-zinc-900 dark:text-white">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-stone-800 flex items-center justify-center text-zinc-700 dark:text-stone-300 shrink-0">
                  <ArrowDownRight className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <span className="text-[11px] font-black text-zinc-500 dark:text-stone-400 uppercase block leading-tight">
                    Saídas
                  </span>
                  <span className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tracking-tight font-['Outfit']">
                    {formatCurrencyBRL(currentMonthExpenses)}
                  </span>
                </div>
              </div>
            </div>

            {/* Card Saldo Real (Mês Atual) */}
            <div className="crm-card bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-xl px-3.5 py-2.5 shadow-xs flex items-center justify-between text-zinc-900 dark:text-white">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-stone-800 flex items-center justify-center text-zinc-700 dark:text-stone-300 shrink-0">
                  <DollarSign className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <span className="text-[11px] font-black text-zinc-500 dark:text-stone-400 uppercase block leading-tight">
                    Saldo Real
                  </span>
                  <span className={`text-base sm:text-lg font-black tracking-tight font-['Outfit'] ${
                    currentMonthRealBalance >= 0 ? 'text-zinc-900 dark:text-white' : 'text-zinc-800 dark:text-stone-200'
                  }`}>
                    {formatCurrencyBRL(currentMonthRealBalance)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Período Filtrado */}
        <div className="space-y-1">
          <div className="text-[11px] font-black text-zinc-500 dark:text-stone-400 uppercase tracking-wider">
            Período: {periodLabel}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Card Total Entradas */}
            <div className="crm-card bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-xl px-3.5 py-2.5 shadow-xs flex items-center justify-between text-zinc-900 dark:text-white">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-stone-800 flex items-center justify-center text-zinc-700 dark:text-stone-300 shrink-0">
                  <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <span className="text-[11px] font-black text-zinc-500 dark:text-stone-400 uppercase block leading-tight">
                    Total Entradas
                  </span>
                  <span className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tracking-tight font-['Outfit']">
                    {formatCurrencyBRL(periodRevenue)}
                  </span>
                </div>
              </div>
            </div>

            {/* Card Total Saídas */}
            <div className="crm-card bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-xl px-3.5 py-2.5 shadow-xs flex items-center justify-between text-zinc-900 dark:text-white">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-stone-800 flex items-center justify-center text-zinc-700 dark:text-stone-300 shrink-0">
                  <ArrowDownRight className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <span className="text-[11px] font-black text-zinc-500 dark:text-stone-400 uppercase block leading-tight">
                    Total Saídas
                  </span>
                  <span className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tracking-tight font-['Outfit']">
                    {formatCurrencyBRL(periodExpenses)}
                  </span>
                </div>
              </div>
            </div>

            {/* Card Saldo Acumulado */}
            <div className="crm-card bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-xl px-3.5 py-2.5 shadow-xs flex items-center justify-between text-zinc-900 dark:text-white">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-stone-800 flex items-center justify-center text-zinc-700 dark:text-stone-300 shrink-0">
                  <BarChart2 className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <span className="text-[11px] font-black text-zinc-500 dark:text-stone-400 uppercase block leading-tight">
                    Saldo Acumulado
                  </span>
                  <span className={`text-base sm:text-lg font-black tracking-tight font-['Outfit'] ${
                    periodAccumulatedBalance >= 0 ? 'text-zinc-900 dark:text-white' : 'text-zinc-800 dark:text-stone-200'
                  }`}>
                    {formatCurrencyBRL(periodAccumulatedBalance)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Structured DRE Statement Table */}
      <div className="crm-card bg-white dark:bg-stone-900 rounded-xl border border-zinc-200 dark:border-stone-800 overflow-hidden shadow-xs text-zinc-900 dark:text-white">
            <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-stone-800 bg-zinc-50 dark:bg-stone-900 flex items-center justify-between">
              <div>
                <h3 className="font-black text-zinc-900 dark:text-white text-sm">
                  Demonstração do Resultado do Exercício (DRE Agro Consolidado)
                </h3>
                <p className="text-xs text-zinc-500 dark:text-stone-300 font-medium">
                  Acompanhamento gerencial das receitas, custos diretos de campo, frota e resultado operacional
                </p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 bg-white dark:bg-stone-800 text-zinc-800 dark:text-white border border-zinc-200 dark:border-stone-700 rounded-lg">
                {currentSeason?.name || 'Safra Atual'}
              </span>
            </div>

            <div className="divide-y divide-blue-200/60 dark:divide-stone-800 text-xs sm:text-sm">
              
              {/* Revenue */}
              <div className="p-4 flex items-center justify-between bg-emerald-100/60 dark:bg-emerald-950/40 font-bold text-emerald-950 dark:text-emerald-200">
                <span>(+) RECEITA BRUTA DE VENDAS & SERVIÇOS DE SILAGEM</span>
                <span className="font-black">{formatCurrencyBRL(totalRevenue)}</span>
              </div>

              {/* Direct Costs */}
              <div className="p-4 flex items-center justify-between pl-6 bg-white/40 dark:bg-stone-850 text-black dark:text-white font-medium">
                <span>(-) Custos Diretos de Campo (Insumos, Sementes, Adubos, Lona, Inoculante)</span>
                <span className="text-rose-700 dark:text-rose-400 font-bold">{formatCurrencyBRL(directCosts)}</span>
              </div>

              {/* Gross Margin */}
              <div className="p-4 flex items-center justify-between bg-blue-100/50 dark:bg-stone-800 font-bold text-black dark:text-white">
                <span>(=) MARGEM BRUTA DE CONTRIBUIÇÃO</span>
                <span className="text-emerald-800 dark:text-emerald-300 font-black">{formatCurrencyBRL(grossMargin)}</span>
              </div>

              {/* Machinery Costs */}
              <div className="p-4 flex items-center justify-between pl-6 bg-white/40 dark:bg-stone-850 text-black dark:text-white font-medium">
                <span>(-) Manutenção da Frota & Peças de Ensiladeira</span>
                <span className="text-rose-700 dark:text-rose-400 font-bold">{formatCurrencyBRL(machineryCosts)}</span>
              </div>

              {/* Overhead */}
              <div className="p-4 flex items-center justify-between pl-6 bg-white/40 dark:bg-stone-850 text-black dark:text-white font-medium">
                <span>(-) Despesas Operacionais, Fretes Terceirizados & Administrativo</span>
                <span className="text-rose-700 dark:text-rose-400 font-bold">{formatCurrencyBRL(overheadCosts)}</span>
              </div>

              {/* Net Profit */}
              <div className="p-4 sm:p-5 flex items-center justify-between bg-slate-900 text-white font-extrabold text-sm sm:text-base">
                <span>(=) RESULTADO OPERACIONAL LÍQUIDO</span>
                <span className={netProfit >= 0 ? 'text-emerald-400 font-black' : 'text-rose-400 font-black'}>
                  {formatCurrencyBRL(netProfit)}
                </span>
              </div>

            </div>
          </div>

          {/* Unit Cost & Silage Metrics */}
          <div className="crm-card bg-white dark:bg-stone-900 p-5 rounded-xl border border-zinc-200 dark:border-stone-800 shadow-xs text-zinc-900 dark:text-white">
            <h3 className="font-black text-zinc-900 dark:text-white text-sm mb-3">
              Unitizadores por Tonelada de Silagem
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div className="p-3.5 bg-zinc-50 dark:bg-stone-800 rounded-xl border border-zinc-200 dark:border-stone-700">
                <span className="text-[11px] font-black text-zinc-500 dark:text-stone-300 uppercase">
                  Preço Médio de Venda
                </span>
                <p className="text-xl font-black text-zinc-900 dark:text-white mt-1 font-['Outfit']">
                  {formatCurrencyBRL(revenuePerTon)}/ton
                </p>
              </div>
              <div className="p-3.5 bg-zinc-50 dark:bg-stone-800 rounded-xl border border-zinc-200 dark:border-stone-700">
                <span className="text-[11px] font-black text-zinc-500 dark:text-stone-300 uppercase">
                  Custo Total de Produção
                </span>
                <p className="text-xl font-black text-zinc-900 dark:text-white mt-1 font-['Outfit']">
                  {formatCurrencyBRL(costPerTon)}/ton
                </p>
              </div>
              <div className="p-3.5 bg-zinc-50 dark:bg-stone-800 rounded-xl border border-zinc-200 dark:border-stone-700">
                <span className="text-[11px] font-black text-zinc-500 dark:text-stone-300 uppercase">
                  Lucro Líquido Unitário
                </span>
                <p className="text-xl font-black text-zinc-900 dark:text-white mt-1 font-['Outfit']">
                  {formatCurrencyBRL(profitPerTon)}/ton
                </p>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ABA: Despesas */}
      {activeTab === 'despesas' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-black dark:text-stone-100 font-['Outfit']">
                Controle de Despesas
              </h2>
              <p className="text-xs sm:text-sm font-semibold text-black dark:text-stone-300">
                Gerencie todos os custos e despesas operacionais
              </p>
            </div>

            {/* Action Controls */}
            <div className="flex items-center space-x-2">
              {onNewExpense && (
                <button
                  id="btn-expense-new-financial"
                  onClick={onNewExpense}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition active:scale-95 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Lançar Despesa</span>
                </button>
              )}
              
              {onOpenAiParser && (
                <button
                  id="btn-expense-ai-fast-financial"
                  onClick={onOpenAiParser}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 border border-stone-300 dark:border-stone-700 hover:bg-stone-200 dark:hover:bg-stone-700 transition cursor-pointer"
                  title="Lançamento Rápido com IA"
                >
                  <Sparkles className="w-4 h-4 text-emerald-500" />
                  <span className="hidden sm:inline">IA Rápida</span>
                </button>
              )}
            </div>
          </div>

          <ExpenseStats
            expenses={expenses}
            machineries={machineries}
            seasons={seasons}
          />

          <ExpenseCharts expenses={expenses} />

          <ExpenseList
            expenses={expenses}
            categories={categories}
            costCenters={costCenters}
            employees={employees}
            teams={fleetTeams}
            companyProfile={companyProfile || { tradeName: 'Silagem Fácil' } as any}
            onNewExpense={onNewExpense || (() => {})}
            onEditExpense={onEditExpense || (() => {})}
            onDeleteExpense={onDeleteExpense}
            onToggleStatus={onToggleExpenseStatus}
            onViewReceipt={onViewReceipt}
            onDuplicateExpense={onDuplicateExpense}
          />
        </div>
      )}

      {/* ABA: Contas Bancárias */}
      {activeTab === 'contas' && (
        <BankAccountsTab
          accounts={bankAccounts}
          onSaveAccounts={onSaveBankAccounts}
          expenses={expenses}
          employees={employees}
          transactions={internalBankTransactions}
          onSaveTransactions={handleSaveTransactions}
          onAddExpenseFromBankBill={handleAddExpenseFromBankBillInternal}
          onLinkExpensesToAccount={handleLinkExpensesToAccountInternal}
          categories={categories}
        />
      )}

      {/* ABA: A Pagar */}
      {activeTab === 'a_pagar' && (
        <PayablesTab
          expenses={expenses}
          bankAccounts={bankAccounts}
          employees={employees}
          onToggleStatus={onToggleExpenseStatus}
          onSettleExpense={handleSettleExpenseInternal}
          onReverseExpense={handleReverseExpenseInternal}
          onEditExpense={onEditExpense}
          onDeleteExpense={onDeleteExpense}
          onViewReceipt={onViewReceipt}
          onNewExpense={onNewExpense}
        />
      )}

      {/* ABA: A Receber */}
      {activeTab === 'a_receber' && (
        <ReceivablesTab
          orders={orders}
          services={services}
        />
      )}

      {/* ABA: Acertos Terceiros */}
      {activeTab === 'acertos' && (
        <ThirdPartySettlementsTab
          settlements={settlements}
          onSaveSettlements={onSaveSettlements}
        />
      )}

      {/* ABA: Acertos Agenciadores (Nova Aba de Controle de Comissões e Repasses) */}
      {activeTab === 'acertos_agenciadores' && (
        <BrokerSettlementsTab
          settlements={internalBrokerSettlements}
          onSaveSettlements={handleSaveBrokerSettlements}
          employees={employees}
          orders={orders}
          bankAccounts={bankAccounts}
        />
      )}

      {/* ABA: Exportar */}
      {activeTab === 'exportar' && (
        <FinancialExportTab
          expenses={expenses}
          orders={orders}
          seasons={seasons}
          settlements={settlements}
        />
      )}

    </div>
  );
};
