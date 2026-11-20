import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  Sparkles,
  Lock,
  WalletCards
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
  PaymentMethod,
  ReversalAuditEntry
} from '../../types';
import { formatCurrencyBRL, getLastDayOfMonth, getStoredBankTransactions, saveStoredBankTransactions, getStoredExpenses, saveStoredExpenses, getStoredBrokerSettlements, saveStoredBrokerSettlements, getStoredFinanceiroCheques, saveStoredFinanceiroCheques, getActiveCompanyId, getStoredDocumentosEntrada, getStoredFiscalRecords } from '../../lib/storage';
import { recordFinancialReversalAudit, reverseCashRegisterSettlement, getLoggedAuditUserName, formatCurrentAuditDateTimeBR } from '../../lib/financialAudit';
import { supabase } from '../../lib/supabaseClient';
import { fetchContasAPagar, saveFinanceiroCheque, toValidUUID, isSupabaseConfigured } from '../../lib/supabaseService';
import { BankAccountsTab } from './BankAccountsTab';
import { PayablesTab } from './PayablesTab';
import { ReceivablesTab } from './ReceivablesTab';
import { ChequesCustodiaTab } from './ChequesCustodiaTab';
import { ThirdPartySettlementsTab } from './ThirdPartySettlementsTab';
import { BrokerSettlementsTab } from './BrokerSettlementsTab';
import { FinancialExportTab } from './FinancialExportTab';
import { ExpenseStats } from '../expenses/ExpenseStats';
import { ExpenseCharts } from '../expenses/ExpenseCharts';
import { ExpenseList } from '../expenses/ExpenseList';
import { hasFinanceiroSubPermission } from '../../lib/cadastrosBaseStorage';
import { CompetenceSelector, getPrevCompetence, getNextCompetence, getCompetenceDateRange } from './CompetenceSelector';

export type FinancialTabType = 
  | 'consolidado' 
  | 'despesas'
  | 'contas' 
  | 'a_pagar' 
  | 'a_receber' 
  | 'custodia_cheques'
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
  onSettlePayment?: (expenseId: string, settlementData: any) => void;
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
  onReverseExpense?: (
    id: string,
    audit?: { user: string; dateTime: string; isoTimestamp?: string; reason: string }
  ) => void;
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
  onSaveOrders?: (orders: SilageOrder[]) => void;
  onSaveServices?: (services: ServiceOrder[]) => void;
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
  onSaveOrders,
  onSaveServices,
}) => {
  // Validação de Sub-permissões do Módulo Financeiro
  const allowedFinancialTabs = useMemo<FinancialTabType[]>(() => {
    const list: FinancialTabType[] = [];
    if (hasFinanceiroSubPermission('dre')) list.push('consolidado');
    if (hasFinanceiroSubPermission('contas_bancarias')) list.push('contas');
    if (hasFinanceiroSubPermission('a_pagar')) list.push('a_pagar');
    if (hasFinanceiroSubPermission('a_receber')) list.push('a_receber');
    if (hasFinanceiroSubPermission('a_receber') || hasFinanceiroSubPermission('contas_bancarias')) list.push('custodia_cheques');
    if (hasFinanceiroSubPermission('acertos_terceiros')) list.push('acertos');
    if (hasFinanceiroSubPermission('acertos_agenciadores')) list.push('acertos_agenciadores');
    if (hasFinanceiroSubPermission('exportar')) list.push('exportar');
    return list.length > 0 ? list : ['consolidado'];
  }, []);

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<FinancialTabType>(() => {
    if (initialSubTab && allowedFinancialTabs.includes(initialSubTab)) return initialSubTab;
    return allowedFinancialTabs[0] || 'consolidado';
  });

  useEffect(() => {
    if (allowedFinancialTabs.length > 0 && !allowedFinancialTabs.includes(activeTab)) {
      setActiveTab(allowedFinancialTabs[0]);
    }
  }, [allowedFinancialTabs, activeTab]);

  const [localExpenses, setLocalExpenses] = useState<Expense[]>(expenses);

  useEffect(() => {
    if (expenses) {
      setLocalExpenses((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(expenses)) return prev;
        return expenses;
      });
    }
  }, [expenses]);

  useEffect(() => {
    const handleLocalExpensesUpdated = (ev: any) => {
      const updated = ev?.detail;
      if (Array.isArray(updated)) {
        setLocalExpenses((prev) => {
          if (JSON.stringify(prev) === JSON.stringify(updated)) return prev;
          return updated;
        });
      } else {
        const stored = getStoredExpenses();
        if (Array.isArray(stored)) {
          setLocalExpenses((prev) => {
            if (JSON.stringify(prev) === JSON.stringify(stored)) return prev;
            return stored;
          });
        }
      }
    };
    window.addEventListener('silagem_expenses_updated', handleLocalExpensesUpdated);
    window.addEventListener('agrocontrol_contas_a_pagar_updated', handleLocalExpensesUpdated);
    return () => {
      window.removeEventListener('silagem_expenses_updated', handleLocalExpensesUpdated);
      window.removeEventListener('agrocontrol_contas_a_pagar_updated', handleLocalExpensesUpdated);
    };
  }, []);

  const onSaveExpensesRef = useRef(onSaveExpenses);
  useEffect(() => {
    onSaveExpensesRef.current = onSaveExpenses;
  }, [onSaveExpenses]);

  const expensesDebounceTimerRef = useRef<any>(null);

  // Sincronização em tempo real multi-dispositivos (Supabase Realtime) escutando 'contas_a_pagar'
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let isMounted = true;
    const companyId = companyProfile?.id || getActiveCompanyId();
    const channelId = `fin_expenses_rt_${companyId || 'default'}`;

    const existingChannels = supabase.getChannels?.() || [];
    for (const ch of existingChannels) {
      if (ch.topic === channelId || ch.topic === `realtime:${channelId}`) {
        try { supabase.removeChannel(ch); } catch (_) {}
      }
    }

    const debouncedFetchContas = () => {
      if (expensesDebounceTimerRef.current) clearTimeout(expensesDebounceTimerRef.current);
      expensesDebounceTimerRef.current = setTimeout(async () => {
        try {
          const fresh = await fetchContasAPagar(companyId);
          if (isMounted && fresh && Array.isArray(fresh) && fresh.length > 0) {
            const currentStored: Expense[] = getStoredExpenses();
            const existingMap = new Map<string, Expense>();
            const uuidToKey = new Map<string, string>();
            currentStored.forEach(e => {
              if (e?.id) {
                existingMap.set(e.id, e);
                uuidToKey.set(toValidUUID(e.id), e.id);
              }
            });

            const docsMap = new Map<string, any>();
            getStoredDocumentosEntrada().forEach(doc => {
              if (doc?.id) {
                docsMap.set(doc.id, doc);
                docsMap.set(toValidUUID(doc.id), doc);
              }
            });
            getStoredFiscalRecords().forEach(fr => {
              if (fr?.id) {
                docsMap.set(fr.id, fr);
                docsMap.set(toValidUUID(fr.id), fr);
              }
            });

            fresh.forEach((d: any) => {
              const matchedKey = existingMap.has(d.id) ? d.id : uuidToKey.get(toValidUUID(d.id));
              const existing = matchedKey ? existingMap.get(matchedKey) : undefined;
              const docMatch = d.nota_fiscal_id
                ? (docsMap.get(d.nota_fiscal_id) || docsMap.get(toValidUUID(d.nota_fiscal_id)))
                : undefined;

              const resolvedSupplier =
                (existing?.supplier && existing.supplier !== 'Fornecedor' && existing.supplier !== 'Fornecedor N/I' ? existing.supplier : '') ||
                d.fornecedor ||
                d.credor ||
                docMatch?.fornecedor ||
                docMatch?.fornecedor_nome ||
                docMatch?.supplier ||
                'Fornecedor N/I';

              const docNum = docMatch?.numero || docMatch?.numero_documento || docMatch?.invoiceNumber || existing?.invoiceNumber;
              const parcLabel = d.numero_parcela || (existing as any)?.numero_parcela;
              const resolvedDesc =
                existing?.description ||
                d.descricao ||
                (docNum
                  ? `Compra ${docNum}${parcLabel && parcLabel !== '01/01' ? ` (${parcLabel})` : ''} - ${resolvedSupplier}`
                  : d.centro_custo || 'Despesa Lançada');

              const baseExp: Expense = {
                ...(existing || {}),
                id: existing?.id || d.id,
                description: resolvedDesc,
                amount: Number(d.valor_parcela ?? existing?.amount ?? 0),
                dueDate: d.data_vencimento || existing?.dueDate || new Date().toISOString().split('T')[0],
                status: d.status_pago ? 'pago' : 'pendente',
                categoryId: existing?.categoryId || 'despesa_geral',
                categoryColor: existing?.categoryColor || '#10b981',
                category: existing?.category || d.centro_custo || 'Geral',
                categoryName: existing?.categoryName || d.centro_custo || 'Geral',
                paymentMethod: (d.forma_pagamento || existing?.paymentMethod || 'boleto') as PaymentMethod,
                supplier: resolvedSupplier,
                invoiceNumber: docNum,
                createdAt: existing?.createdAt || d.created_at || new Date().toISOString()
              };

              if (d.nota_fiscal_id) (baseExp as any).notaId = (existing as any)?.notaId || d.nota_fiscal_id;
              if (parcLabel) (baseExp as any).numero_parcela = parcLabel;

              existingMap.set(baseExp.id, baseExp);
            });

            const mergedList = Array.from(existingMap.values());
            if (JSON.stringify(mergedList) !== JSON.stringify(currentStored)) {
              setLocalExpenses(mergedList);
              saveStoredExpenses(mergedList);
              onSaveExpensesRef.current?.(mergedList);
            }
          }
        } catch (_) {}
      }, 400);
    };

    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contas_a_pagar' },
        (payload: any) => {
          if (payload.eventType === 'DELETE') {
            const deletedId = payload.old?.id;
            if (deletedId) {
              setLocalExpenses(prev => {
                const updated = prev.filter(e => e.id !== deletedId && toValidUUID(e.id) !== deletedId);
                saveStoredExpenses(updated);
                onSaveExpensesRef.current?.(updated);
                return updated;
              });
            }
          }
          debouncedFetchContas();
        }
      )
      .subscribe();

    const handleFocus = () => {
      debouncedFetchContas();
    };

    const handleLocalExpensesEvent = (ev: any) => {
      if (isMounted && Array.isArray(ev?.detail)) {
        setLocalExpenses((prev) => {
          if (JSON.stringify(prev) === JSON.stringify(ev.detail)) return prev;
          return ev.detail;
        });
      }
    };
    window.addEventListener('silagem_expenses_updated', handleLocalExpensesEvent);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      isMounted = false;
      if (expensesDebounceTimerRef.current) {
        clearTimeout(expensesDebounceTimerRef.current);
      }
      window.removeEventListener('silagem_expenses_updated', handleLocalExpensesEvent);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
      try {
        supabase.removeChannel(channel);
      } catch (_) {}
    };
  }, [companyProfile?.id]);

  // Internal bank transactions state if not controlled
  const [internalBankTransactions, setInternalBankTransactions] = useState<BankTransaction[]>(
    () => bankTransactionsProp || getStoredBankTransactions()
  );

  useEffect(() => {
    if (bankTransactionsProp) {
      setInternalBankTransactions((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(bankTransactionsProp)) return prev;
        return bankTransactionsProp;
      });
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
    chequeOrigin?: 'proprio' | 'terceiros';
    checkNumber?: string;
    chequeGoodForDate?: string;
    usedChequeIds?: string[];
    usedChequesSummary?: string;
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
          paymentAuthenticationCode: params.authenticationCode || e.paymentAuthenticationCode,
          chequeOrigin: params.chequeOrigin,
          checkNumber: params.checkNumber || e.checkNumber,
          chequeGoodForDate: params.chequeGoodForDate,
          usedChequeIds: params.usedChequeIds,
          usedChequesSummary: params.usedChequesSummary,
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

    // Debita o saldo da conta bancária apenas quando houver conta bancária (ignora repasse de cheque de terceiros)
    if (params.bankAccountId) {
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
    }
  };

  // Estorno de Despesa com estorno do saldo bancário/caixa e devolução de cheques de terceiros para custódia
  const handleReverseExpenseInternal = (
    expenseId: string,
    audit?: { user: string; dateTime: string; isoTimestamp?: string; reason: string }
  ) => {
    if (onReverseExpense) {
      onReverseExpense(expenseId, audit);
      return;
    }

    const exp = expenses.find((e) => e.id === expenseId) || localExpenses.find((e) => e.id === expenseId);
    if (!exp) return;

    const now = new Date();
    const auditUser = audit?.user || getLoggedAuditUserName();
    const auditDateTime = audit?.dateTime || formatCurrentAuditDateTimeBR(now);
    const auditReason = audit?.reason || 'Estorno manual';
    const reversalEntry: ReversalAuditEntry = {
      id: `rev_pag_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      targetType: 'pagar',
      targetId: exp.id,
      description: exp.description,
      amount: Number(exp.amount) || 0,
      user: auditUser,
      dateTime: auditDateTime,
      isoTimestamp: audit?.isoTimestamp || now.toISOString(),
      reason: auditReason,
      previousStatus: exp.status,
      previousPaymentDate: exp.paymentDate,
      bankAccountId: exp.bankAccountId,
      bankAccountName: exp.bankAccountName,
    };

    // Se a despesa foi quitada com cheque(s) de terceiros da custódia, retorna os cheques para EM_NOSSO_PODER
    if (Array.isArray(exp.usedChequeIds) && exp.usedChequeIds.length > 0) {
      const usedSet = new Set(exp.usedChequeIds);
      const currentCheques = getStoredFinanceiroCheques();
      const revertedCheques = currentCheques.map((c) => {
        if (!usedSet.has(c.id)) return c;
        const reverted = {
          ...c,
          status: 'EM_NOSSO_PODER' as const,
          fornecedor_destino: '',
          fornecedorDestino: '',
          data_repasse: '',
          dataRepasse: '',
          despesa_id: '',
          despesaId: '',
          updated_at: now.toISOString(),
        };
        saveFinanceiroCheque(reverted).catch(() => {});
        return reverted;
      });
      saveStoredFinanceiroCheques(revertedCheques);
      window.dispatchEvent(new CustomEvent('financeiro_cheques_updated'));
      window.dispatchEvent(new Event('storage'));
    }

    // Devolve o saldo à conta se tiver sido debitado e remove a movimentação correspondente do extrato
    if (exp.bankAccountId) {
      const updatedAccounts = bankAccounts.map((acc) => {
        if (acc.id === exp.bankAccountId) {
          return {
            ...acc,
            balance: Number(((Number(acc.balance) || 0) + (Number(exp.amount) || 0)).toFixed(2)),
          };
        }
        return acc;
      });
      onSaveBankAccounts(updatedAccounts);

      const matchedTxIdx = internalBankTransactions.findIndex(
        (tx) =>
          (tx.expenseId === exp.id || tx.sourceId === exp.id) &&
          tx.type === 'saida'
      );
      if (matchedTxIdx >= 0) {
        const nextTxs = internalBankTransactions.filter((_, i) => i !== matchedTxIdx);
        handleSaveTransactions(nextTxs);
      } else {
        const refundTx: BankTransaction = {
          id: `tx_rev_${Date.now()}`,
          bankAccountId: exp.bankAccountId,
          bankAccountName: exp.bankAccountName || 'Conta Bancária',
          date: now.toISOString().split('T')[0],
          description: `Estorno Pagamento (${auditUser}): ${exp.supplier || exp.description} — Motivo: ${auditReason}`,
          type: 'entrada',
          amount: exp.amount,
          category: 'Estorno de Pagamento',
          expenseId: exp.id,
          sourceId: exp.id,
          sourceType: 'ajuste',
          createdAt: now.toISOString(),
        };
        handleSaveTransactions([refundTx, ...internalBankTransactions]);
      }
    } else {
      reverseCashRegisterSettlement({
        type: 'pagar',
        targetId: exp.id,
        amount: exp.amount,
        description: exp.description,
        partyName: exp.supplier,
        paymentMethod: exp.paymentMethod,
        bankAccountId: exp.bankAccountId,
        reason: auditReason,
        user: auditUser,
      });
    }

    const updatedExpenses = expenses.map((e) => {
      if (e.id === expenseId) {
        return {
          ...e,
          status: 'pendente' as const,
          paymentDate: undefined,
          bankAccountId: undefined,
          bankAccountName: undefined,
          paidByEmployeeId: undefined,
          paidByEmployeeName: undefined,
          paymentAuthenticationCode: undefined,
          usedChequeIds: undefined,
          usedChequesSummary: undefined,
          chequeOrigin: undefined,
          lastReversal: reversalEntry,
          reversalHistory: [reversalEntry, ...(e.reversalHistory || [])],
          updatedAt: now.toISOString(),
        };
      }
      return e;
    });

    recordFinancialReversalAudit(reversalEntry);

    if (onSaveExpenses) {
      onSaveExpenses(updatedExpenses);
    } else {
      saveStoredExpenses(updatedExpenses);
      onToggleExpenseStatus(expenseId);
    }
  };

  // Inserir boleto / conta bancária
  const handleAddExpenseFromBankBillInternal = (newExpData: Partial<Expense>) => {
    if (onAddExpenseFromBankBill) {
      onAddExpenseFromBankBill(newExpData);
      return;
    }

    const cat = Array.isArray(categories) ? categories.find((c) => c.name === newExpData.categoryName) : undefined;
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

  // Centralized Competence Month State (MM/AAAA)
  const [competenceMonth, setCompetenceMonth] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('agrocontrol_financial_competence');
      if (saved && /^\d{2}\/\d{4}$/.test(saved)) return saved;
    } catch {}
    const now = new Date();
    return `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  });

  // Month names in PT-BR
  const monthNames = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];

  // Derive initial date range from active competence
  const initialRange = getCompetenceDateRange(competenceMonth);
  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);

  const handlePrevCompetence = () => {
    setCompetenceMonth((prev) => {
      const next = getPrevCompetence(prev);
      try { localStorage.setItem('agrocontrol_financial_competence', next); } catch {}
      const range = getCompetenceDateRange(next);
      setStartDate(range.start);
      setEndDate(range.end);
      return next;
    });
  };

  const handleNextCompetence = () => {
    setCompetenceMonth((prev) => {
      const next = getNextCompetence(prev);
      try { localStorage.setItem('agrocontrol_financial_competence', next); } catch {}
      const range = getCompetenceDateRange(next);
      setStartDate(range.start);
      setEndDate(range.end);
      return next;
    });
  };

  // Active competence dates and month names
  const [compMonthStr, compYearStr] = competenceMonth.split('/');
  const compMonthNum = (parseInt(compMonthStr, 10) || 1) - 1; // 0-indexed
  const compYear = parseInt(compYearStr, 10) || 2026;
  const currentMonthName = monthNames[compMonthNum] || '';
  const capitalizedMonthName = currentMonthName.charAt(0).toUpperCase() + currentMonthName.slice(1);

  // Active month boundaries based on competence
  const currentMonthStart = `${compYear}-${String(compMonthNum + 1).padStart(2, '0')}-01`;
  const currentMonthEnd = getLastDayOfMonth(compYear, compMonthNum);

  // Carregamento reativo das receitas financeiras consolidadas e PDV (Print 3)
  const [receitasConsolidadas, setReceitasConsolidadas] = useState<any[]>(() => {
    try {
      const raw = localStorage.getItem('agrocontrol_financeiro_consolidado') || 
                  localStorage.getItem('agrocontrol_receitas_liquidadas') || '[]';
      return JSON.parse(raw);
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const handleUpdate = () => {
      try {
        const raw = localStorage.getItem('agrocontrol_financeiro_consolidado') || 
                    localStorage.getItem('agrocontrol_receitas_liquidadas') || '[]';
        setReceitasConsolidadas(JSON.parse(raw));
      } catch {}
    };
    window.addEventListener('agrocontrol_financeiro_consolidado_updated', handleUpdate);
    window.addEventListener('agrocontrol_receitas_liquidadas_updated', handleUpdate);
    window.addEventListener('agrocontrol_vendas_updated', handleUpdate);
    return () => {
      window.removeEventListener('agrocontrol_financeiro_consolidado_updated', handleUpdate);
      window.removeEventListener('agrocontrol_receitas_liquidadas_updated', handleUpdate);
      window.removeEventListener('agrocontrol_vendas_updated', handleUpdate);
    };
  }, []);

  const currentMonthRevenue = useMemo(() => {
    const ordersRev = orders
      .filter((o) => {
        const d = o.date || o.deliveryDate || o.createdAt || '';
        return d >= currentMonthStart && d <= currentMonthEnd;
      })
      .reduce((acc, curr) => acc + curr.totalAmount, 0);
    const servicesRev = services
      .filter((s) => {
        const d = s.date || s.startDate || (s as any).createdAt || '';
        return d >= currentMonthStart && d <= currentMonthEnd;
      })
      .reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);
    const receitasRev = receitasConsolidadas
      .filter((r) => {
        let d = r.date || '';
        if (!d && r.data && r.data.includes('/')) {
          const parts = r.data.split('/');
          if (parts.length === 3) d = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        if (!d) d = r.createdAt ? r.createdAt.split('T')[0] : '';
        return d >= currentMonthStart && d <= currentMonthEnd;
      })
      .reduce((acc, curr) => acc + (Number(curr.valor ?? curr.totalLiquido ?? curr.amount ?? curr.totalAmount) || 0), 0);
    return ordersRev + servicesRev + receitasRev;
  }, [orders, services, receitasConsolidadas, currentMonthStart, currentMonthEnd]);

  const currentMonthExpenses = useMemo(() => {
    return expenses
      .filter((e) => e.date >= currentMonthStart && e.date <= currentMonthEnd)
      .reduce((acc, curr) => acc + curr.amount, 0);
  }, [expenses, currentMonthStart, currentMonthEnd]);

  const currentMonthRealBalance = currentMonthRevenue - currentMonthExpenses;

  // Filter Data for Filtered Period (Row 2)
  const periodRevenue = useMemo(() => {
    const ordersRev = orders
      .filter((o) => {
        const d = o.date || o.deliveryDate || o.createdAt || '';
        return (!startDate || d >= startDate) && (!endDate || d <= endDate);
      })
      .reduce((acc, curr) => acc + curr.totalAmount, 0);
    const servicesRev = services
      .filter((s) => {
        const d = s.date || s.startDate || (s as any).createdAt || '';
        return (!startDate || d >= startDate) && (!endDate || d <= endDate);
      })
      .reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);
    const receitasRev = receitasConsolidadas
      .filter((r) => {
        let d = r.date || '';
        if (!d && r.data && r.data.includes('/')) {
          const parts = r.data.split('/');
          if (parts.length === 3) d = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        if (!d) d = r.createdAt ? r.createdAt.split('T')[0] : '';
        return (!startDate || d >= startDate) && (!endDate || d <= endDate);
      })
      .reduce((acc, curr) => acc + (Number(curr.valor ?? curr.totalLiquido ?? curr.amount ?? curr.totalAmount) || 0), 0);
    return ordersRev + servicesRev + receitasRev;
  }, [orders, services, receitasConsolidadas, startDate, endDate]);

  const periodExpenses = useMemo(() => {
    return expenses
      .filter((e) => (!startDate || e.date >= startDate) && (!endDate || e.date <= endDate))
      .reduce((acc, curr) => acc + curr.amount, 0);
  }, [expenses, startDate, endDate]);

  const periodAccumulatedBalance = periodRevenue - periodExpenses;

  // Global / DRE Metrics
  const totalRevenue = (orders || []).reduce((acc, curr) => acc + (curr?.totalAmount || 0), 0) +
                       (services || []).reduce((acc, curr) => acc + (curr?.totalAmount || 0), 0) +
                       receitasConsolidadas.reduce((acc, curr) => acc + (Number(curr.valor ?? curr.totalLiquido ?? curr.amount ?? curr.totalAmount) || 0), 0);

  const directCosts = (expenses || [])
    .filter((e) => ['cat_combustivel', 'cat_insumos', 'cat_mao_de_obra', 'cat_lona_embalagem'].includes(e.categoryId))
    .reduce((acc, curr) => acc + (curr?.amount || 0), 0);

  const machineryCosts = (expenses || [])
    .filter((e) => e.categoryId === 'cat_manutencao')
    .reduce((acc, curr) => acc + (curr?.amount || 0), 0);

  const overheadCosts = (expenses || [])
    .filter((e) => ['cat_frete', 'cat_alimentacao', 'cat_arrendamento', 'cat_administrativo', 'cat_outros'].includes(e.categoryId))
    .reduce((acc, curr) => acc + (curr?.amount || 0), 0);

  const totalCosts = directCosts + machineryCosts + overheadCosts;
  const grossMargin = totalRevenue - directCosts;
  const netProfit = totalRevenue - totalCosts;

  // Formatted period title label
  const periodLabel = useMemo(() => {
    return `${capitalizedMonthName.toUpperCase()}/${compYear}`;
  }, [capitalizedMonthName, compYear]);

  return (
    <div id="financial-module" className="w-full max-w-none flex-1 min-h-0 h-full max-h-full flex flex-col gap-2 overflow-hidden p-2 sm:p-3">
      
      {/* 1. Header Padronizado 3D Slim */}
      <header className="no-print shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 bg-[#cad4e6] border border-black rounded-lg px-3 py-1.5">
        <div>
          <h1 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tracking-tight">
            Financeiro
          </h1>
        </div>
      </header>

      {/* 2. ESTRUTURA INTEGRADA DE ABAS SUPERIORES E MOLDURA GERAL (PADRÃO OURO) */}
      <div className="w-full flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* BASE DE FUNDO DAS ABAS: MOLDURA MDI TRIDIMENSIONAL ACETINADA */}
        <div className="shrink-0 w-full bg-[#cad4e6] dark:bg-stone-850 dark:border-stone-700 rounded-t-lg border border-b-0 border-black overflow-x-auto scrollbar-none">
          <nav 
            aria-label="Abas do Financeiro" 
            className="w-full flex items-center overflow-x-auto whitespace-nowrap scrollbar-none"
          >
            {/* Aba Consolidado */}
            {hasFinanceiroSubPermission('dre') ? (
              <button
                type="button"
                onClick={() => setActiveTab('consolidado')}
                style={activeTab === 'consolidado' ? { backgroundColor: 'rgba(251, 146, 60, 0.40)' } : undefined}
                className={`flex-1 min-w-max flex items-center justify-center gap-1.5 px-3 py-1 text-[10px] tracking-wide uppercase transition cursor-pointer select-none whitespace-nowrap border-r border-slate-300/80 dark:border-stone-700/80 ${
                  activeTab === 'consolidado'
                    ? 'bg-orange-400/40 text-black font-semibold shadow-xs border-t-2 border-t-emerald-600 -mb-px z-10'
                    : 'bg-slate-200/50 hover:bg-slate-200 dark:bg-stone-850 dark:hover:bg-stone-800 text-slate-700 font-bold dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-200'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Consolidado</span>
              </button>
            ) : (
              <div className="flex-1 min-w-max flex items-center justify-center gap-1.5 px-3 py-1 text-[10px] font-bold tracking-wide uppercase whitespace-nowrap bg-zinc-300/40 text-zinc-400 opacity-60 select-none border-r border-slate-300/80">
                <Lock className="w-3.5 h-3.5 text-zinc-400" />
                <span>Consolidado (Bloqueado)</span>
              </div>
            )}

            {/* Aba Contas Bancárias */}
            {hasFinanceiroSubPermission('contas_bancarias') ? (
              <button
                type="button"
                onClick={() => setActiveTab('contas')}
                style={activeTab === 'contas' ? { backgroundColor: 'rgba(251, 146, 60, 0.40)' } : undefined}
                className={`flex-1 min-w-max flex items-center justify-center gap-1.5 px-3 py-1 text-[10px] tracking-wide uppercase transition cursor-pointer select-none whitespace-nowrap border-r border-slate-300/80 dark:border-stone-700/80 ${
                  activeTab === 'contas'
                    ? 'bg-orange-400/40 text-black font-semibold shadow-xs border-t-2 border-t-emerald-600 -mb-px z-10'
                    : 'bg-slate-200/50 hover:bg-slate-200 dark:bg-stone-850 dark:hover:bg-stone-800 text-slate-700 font-bold dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-200'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <span>Contas Bancárias</span>
              </button>
            ) : (
              <div className="flex-1 min-w-max flex items-center justify-center gap-1.5 px-3 py-1 text-[10px] font-bold tracking-wide uppercase whitespace-nowrap bg-zinc-300/40 text-zinc-400 opacity-60 select-none border-r border-slate-300/80">
                <Lock className="w-3.5 h-3.5 text-zinc-400" />
                <span>Contas (Bloqueado)</span>
              </div>
            )}

            {/* Aba A Pagar */}
            {hasFinanceiroSubPermission('a_pagar') ? (
              <button
                type="button"
                onClick={() => setActiveTab('a_pagar')}
                style={activeTab === 'a_pagar' ? { backgroundColor: 'rgba(251, 146, 60, 0.40)' } : undefined}
                className={`flex-1 min-w-max flex items-center justify-center gap-1.5 px-3 py-1 text-[10px] tracking-wide uppercase transition cursor-pointer select-none whitespace-nowrap border-r border-slate-300/80 dark:border-stone-700/80 ${
                  activeTab === 'a_pagar'
                    ? 'bg-orange-400/40 text-black font-semibold shadow-xs border-t-2 border-t-emerald-600 -mb-px z-10'
                    : 'bg-slate-200/50 hover:bg-slate-200 dark:bg-stone-850 dark:hover:bg-stone-800 text-slate-700 font-bold dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-200'
                }`}
              >
                <ArrowDownLeft className="w-3.5 h-3.5" />
                <span>A Pagar</span>
              </button>
            ) : (
              <div className="flex-1 min-w-max flex items-center justify-center gap-1.5 px-3 py-1 text-[10px] font-bold tracking-wide uppercase whitespace-nowrap bg-zinc-300/40 text-zinc-400 opacity-60 select-none border-r border-slate-300/80">
                <Lock className="w-3.5 h-3.5 text-zinc-400" />
                <span>A Pagar (Bloqueado)</span>
              </div>
            )}

            {/* Aba A Receber */}
            {hasFinanceiroSubPermission('a_receber') ? (
              <button
                type="button"
                onClick={() => setActiveTab('a_receber')}
                style={activeTab === 'a_receber' ? { backgroundColor: 'rgba(251, 146, 60, 0.40)' } : undefined}
                className={`flex-1 min-w-max flex items-center justify-center gap-1.5 px-3 py-1 text-[10px] tracking-wide uppercase transition cursor-pointer select-none whitespace-nowrap border-r border-slate-300/80 dark:border-stone-700/80 ${
                  activeTab === 'a_receber'
                    ? 'bg-orange-400/40 text-black font-semibold shadow-xs border-t-2 border-t-emerald-600 -mb-px z-10'
                    : 'bg-slate-200/50 hover:bg-slate-200 dark:bg-stone-850 dark:hover:bg-stone-800 text-slate-700 font-bold dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-200'
                }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>A Receber</span>
              </button>
            ) : (
              <div className="flex-1 min-w-max flex items-center justify-center gap-1.5 px-3 py-1 text-[10px] font-bold tracking-wide uppercase whitespace-nowrap bg-zinc-300/40 text-zinc-400 opacity-60 select-none border-r border-slate-300/80">
                <Lock className="w-3.5 h-3.5 text-zinc-400" />
                <span>A Receber (Bloqueado)</span>
              </div>
            )}

            {/* Aba Custódia de Cheques */}
            {(hasFinanceiroSubPermission('a_receber') || hasFinanceiroSubPermission('contas_bancarias')) ? (
              <button
                type="button"
                onClick={() => setActiveTab('custodia_cheques')}
                style={activeTab === 'custodia_cheques' ? { backgroundColor: 'rgba(251, 146, 60, 0.40)' } : undefined}
                className={`flex-1 min-w-max flex items-center justify-center gap-1.5 px-3 py-1 text-[10px] tracking-wide uppercase transition cursor-pointer select-none whitespace-nowrap border-r border-slate-300/80 dark:border-stone-700/80 ${
                  activeTab === 'custodia_cheques'
                    ? 'bg-orange-400/40 text-black font-semibold shadow-xs border-t-2 border-t-emerald-600 -mb-px z-10'
                    : 'bg-slate-200/50 hover:bg-slate-200 dark:bg-stone-850 dark:hover:bg-stone-800 text-slate-700 font-bold dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-200'
                }`}
              >
                <WalletCards className="w-3.5 h-3.5" />
                <span>Custódia de Cheques</span>
              </button>
            ) : (
              <div className="flex-1 min-w-max flex items-center justify-center gap-1.5 px-3 py-1 text-[10px] font-bold tracking-wide uppercase whitespace-nowrap bg-zinc-300/40 text-zinc-400 opacity-60 select-none border-r border-slate-300/80">
                <Lock className="w-3.5 h-3.5 text-zinc-400" />
                <span>Cheques (Bloqueado)</span>
              </div>
            )}


            {/* Aba Acertos Terceiros */}
            {hasFinanceiroSubPermission('acertos_terceiros') ? (
              <button
                type="button"
                onClick={() => setActiveTab('acertos')}
                style={activeTab === 'acertos' ? { backgroundColor: 'rgba(251, 146, 60, 0.40)' } : undefined}
                className={`flex-1 min-w-max flex items-center justify-center gap-1.5 px-3 py-1 text-[10px] tracking-wide uppercase transition cursor-pointer select-none whitespace-nowrap border-r border-slate-300/80 dark:border-stone-700/80 ${
                  activeTab === 'acertos'
                    ? 'bg-orange-400/40 text-black font-semibold shadow-xs border-t-2 border-t-emerald-600 -mb-px z-10'
                    : 'bg-slate-200/50 hover:bg-slate-200 dark:bg-stone-850 dark:hover:bg-stone-800 text-slate-700 font-bold dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-200'
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Acertos Terceiros</span>
              </button>
            ) : (
              <div className="flex-1 min-w-max flex items-center justify-center gap-1.5 px-3 py-1 text-[10px] font-bold tracking-wide uppercase whitespace-nowrap bg-zinc-300/40 text-zinc-400 opacity-60 select-none border-r border-slate-300/80">
                <Lock className="w-3.5 h-3.5 text-zinc-400" />
                <span>Acertos (Bloqueado)</span>
              </div>
            )}

            {/* Aba Acertos Agenciadores */}
            {hasFinanceiroSubPermission('acertos_agenciadores') ? (
              <button
                type="button"
                onClick={() => setActiveTab('acertos_agenciadores')}
                style={activeTab === 'acertos_agenciadores' ? { backgroundColor: 'rgba(251, 146, 60, 0.40)' } : undefined}
                className={`flex-1 min-w-max flex items-center justify-center gap-1.5 px-3 py-1 text-[10px] tracking-wide uppercase transition cursor-pointer select-none whitespace-nowrap border-r border-slate-300/80 dark:border-stone-700/80 ${
                  activeTab === 'acertos_agenciadores'
                    ? 'bg-orange-400/40 text-black font-semibold shadow-xs border-t-2 border-t-emerald-600 -mb-px z-10'
                    : 'bg-slate-200/50 hover:bg-slate-200 dark:bg-stone-850 dark:hover:bg-stone-800 text-slate-700 font-bold dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-200'
                }`}
              >
                <Handshake className="w-3.5 h-3.5" />
                <span>Acertos Agenciadores</span>
              </button>
            ) : (
              <div className="flex-1 min-w-max flex items-center justify-center gap-1.5 px-3 py-1 text-[10px] font-bold tracking-wide uppercase whitespace-nowrap bg-zinc-300/40 text-zinc-400 opacity-60 select-none border-r border-slate-300/80">
                <Lock className="w-3.5 h-3.5 text-zinc-400" />
                <span>Agenciadores (Bloqueado)</span>
              </div>
            )}

            {/* Aba Exportar */}
            {hasFinanceiroSubPermission('exportar') ? (
              <button
                type="button"
                onClick={() => setActiveTab('exportar')}
                style={activeTab === 'exportar' ? { backgroundColor: 'rgba(251, 146, 60, 0.40)' } : undefined}
                className={`flex-1 min-w-max flex items-center justify-center gap-1.5 px-3 py-1 text-[10px] tracking-wide uppercase transition cursor-pointer select-none whitespace-nowrap ${
                  activeTab === 'exportar'
                    ? 'bg-orange-400/40 text-black font-semibold shadow-xs border-t-2 border-t-emerald-600 -mb-px z-10'
                    : 'bg-slate-200/50 hover:bg-slate-200 dark:bg-stone-850 dark:hover:bg-stone-800 text-slate-700 font-bold dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-200'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Exportar</span>
              </button>
            ) : (
              <div className="flex-1 min-w-max flex items-center justify-center gap-1.5 px-3 py-1 text-[10px] font-bold tracking-wide uppercase whitespace-nowrap bg-zinc-300/40 text-zinc-400 opacity-60 select-none">
                <Lock className="w-3.5 h-3.5 text-zinc-400" />
                <span>Exportar (Bloqueado)</span>
              </div>
            )}
          </nav>
        </div>

        {/* MOLDURA GERAL INTEGRADA DE PONTA A PONTA (SEM VÃO LIVRE) */}
        <div className={`w-full border border-black dark:border-stone-700 rounded-b-lg bg-[#e0e6f1]/40 dark:bg-stone-900 shadow-sm global ${['a_pagar', 'a_receber', 'custodia_cheques', 'acertos', 'acertos_agenciadores'].includes(activeTab) ? 'flex-1 min-h-0 flex flex-col overflow-hidden p-2.5' : 'flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 space-y-3'}`}>

      {/* ABA: Consolidado */}
      {activeTab === 'consolidado' && (
        <div className="space-y-4">
          {/* 3. Seletor de Competência Padronizado & Intervalo de Datas */}
          <div className="crm-card bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-xl px-3.5 py-2.5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-2.5 text-zinc-900 dark:text-white">
            <CompetenceSelector
              competence={competenceMonth}
              onPrev={handlePrevCompetence}
              onNext={handleNextCompetence}
            />

            {/* Date range pickers */}
            <div className="consolidado-date-range flex items-center space-x-1.5 text-xs text-black dark:text-white bg-transparent border-none">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2.5 py-1 border border-slate-400 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-800 text-black dark:text-white text-xs font-medium focus:ring-1 focus:ring-sky-600 outline-none"
              />
              <span className="text-[11px] font-bold text-black dark:text-white">até</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2.5 py-1 border border-slate-400 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-800 text-black dark:text-white text-xs font-medium focus:ring-1 focus:ring-sky-600 outline-none"
              />
            </div>
          </div>

      {/* 4. Compact Summary Indicators */}
      <div className="space-y-2">
        {/* Row 1: Mês Atual */}
        <div className="space-y-1">
          <div className="text-[11px] font-black text-black dark:text-white uppercase tracking-wider">
            Mês atual — {currentMonthName}/{compYear}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Card Entradas (Mês Atual) */}
            <div className="crm-card bg-[#f5f0d9] dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-xl px-3.5 py-2.5 shadow-xs flex items-center justify-between text-zinc-900 dark:text-white">
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
            <div className="crm-card bg-[#fec591] dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-xl px-3.5 py-2.5 shadow-xs flex items-center justify-between text-zinc-900 dark:text-white">
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
            <div className="crm-card bg-[#c4d398] dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-xl px-3.5 py-2.5 shadow-xs flex items-center justify-between text-zinc-900 dark:text-white">
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
            <div className="crm-card bg-[#e0e6f1] dark:bg-stone-900 border border-black dark:border-stone-800 rounded-xl px-3.5 py-2.5 shadow-xs flex items-center justify-between text-zinc-900 dark:text-white">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-stone-800 flex items-center justify-center text-zinc-700 dark:text-stone-300 shrink-0">
                  <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <span className="text-[11px] font-black text-zinc-600 dark:text-stone-400 uppercase block leading-tight">
                    Total Entradas
                  </span>
                  <span className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tracking-tight font-['Outfit']">
                    {formatCurrencyBRL(periodRevenue)}
                  </span>
                </div>
              </div>
            </div>

            {/* Card Total Saídas */}
            <div className="crm-card bg-[#e0e6f1] dark:bg-stone-900 border border-black dark:border-stone-800 rounded-xl px-3.5 py-2.5 shadow-xs flex items-center justify-between text-zinc-900 dark:text-white">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-stone-800 flex items-center justify-center text-zinc-700 dark:text-stone-300 shrink-0">
                  <ArrowDownRight className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <span className="text-[11px] font-black text-zinc-600 dark:text-stone-400 uppercase block leading-tight">
                    Total Saídas
                  </span>
                  <span className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tracking-tight font-['Outfit']">
                    {formatCurrencyBRL(periodExpenses)}
                  </span>
                </div>
              </div>
            </div>

            {/* Card Saldo Acumulado */}
            <div className="crm-card bg-[#e0e6f1] dark:bg-stone-900 border border-black dark:border-stone-800 rounded-xl px-3.5 py-2.5 shadow-xs flex items-center justify-between text-zinc-900 dark:text-white">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-stone-800 flex items-center justify-center text-zinc-700 dark:text-stone-300 shrink-0">
                  <BarChart2 className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <span className="text-[11px] font-black text-zinc-600 dark:text-stone-400 uppercase block leading-tight">
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
      <div className="crm-card bg-[#e0e6f1] dark:bg-stone-900 rounded-xl border border-black dark:border-stone-800 overflow-hidden shadow-xs text-zinc-900 dark:text-white">
            <div className="p-4 sm:p-5 border-b border-black dark:border-stone-800 bg-[#e0e6f1] dark:bg-stone-900 flex items-center justify-between">
              <div>
                <h3 className="font-black text-zinc-900 dark:text-white text-sm">
                  Demonstrativo do Resultado do Exercício (DRE Gerencial)
                </h3>
                <p className="text-xs text-zinc-600 dark:text-stone-300 font-medium">
                  Acompanhamento gerencial das receitas, custos diretos operacionais, frota e resultado operacional
                </p>
              </div>
            </div>

            <div className="divide-y divide-black/15 dark:divide-stone-800 text-xs sm:text-sm">
              
              {/* Revenue */}
              <div className="p-4 flex items-center justify-between bg-emerald-100/60 dark:bg-emerald-950/40 font-bold text-emerald-950 dark:text-emerald-200">
                <span>(+) RECEITA BRUTA DE VENDAS & SERVIÇOS</span>
                <span className="font-black">{formatCurrencyBRL(totalRevenue)}</span>
              </div>

              {/* Direct Costs */}
              <div className="p-4 flex items-center justify-between pl-6 bg-[#e0e6f1] dark:bg-stone-850 text-black dark:text-white font-medium">
                <span>(-) Custos Diretos Operacionais (Insumos, Mercadorias & Materiais)</span>
                <span className="text-rose-700 dark:text-rose-400 font-bold">{formatCurrencyBRL(directCosts)}</span>
              </div>

              {/* Gross Margin */}
              <div className="p-4 flex items-center justify-between bg-blue-100/60 dark:bg-stone-800 font-bold text-black dark:text-white">
                <span>(=) MARGEM BRUTA DE CONTRIBUIÇÃO</span>
                <span className="text-emerald-800 dark:text-emerald-300 font-black">{formatCurrencyBRL(grossMargin)}</span>
              </div>

              {/* Machinery Costs */}
              <div className="p-4 flex items-center justify-between pl-6 bg-[#e0e6f1] dark:bg-stone-850 text-black dark:text-white font-medium">
                <span>(-) Manutenção da Frota & Equipamentos</span>
                <span className="text-rose-700 dark:text-rose-400 font-bold">{formatCurrencyBRL(machineryCosts)}</span>
              </div>

              {/* Overhead */}
              <div className="p-4 flex items-center justify-between pl-6 bg-[#e0e6f1] dark:bg-stone-850 text-black dark:text-white font-medium">
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
          orders={orders}
          services={services}
          onSaveOrders={onSaveOrders}
          onSaveServices={onSaveServices}
          onSettleExpense={handleSettleExpenseInternal}
        />
      )}

      {/* ABA: A Pagar */}
      {activeTab === 'a_pagar' && (
        <PayablesTab
          expenses={localExpenses}
          bankAccounts={bankAccounts}
          employees={employees}
          onToggleStatus={onToggleExpenseStatus}
          onSettleExpense={handleSettleExpenseInternal}
          onReverseExpense={handleReverseExpenseInternal}
          onEditExpense={onEditExpense}
          onDeleteExpense={onDeleteExpense}
          onViewReceipt={onViewReceipt}
          onNewExpense={onNewExpense}
          competenceMonth={competenceMonth}
          onPrevMonth={handlePrevCompetence}
          onNextMonth={handleNextCompetence}
        />
      )}

      {/* ABA: A Receber */}
      {activeTab === 'a_receber' && (
        <ReceivablesTab
          orders={orders}
          services={services}
          bankAccounts={bankAccounts}
          companyProfile={companyProfile}
          onSaveOrders={onSaveOrders}
          onSaveServices={onSaveServices}
          competenceMonth={competenceMonth}
          onPrevMonth={handlePrevCompetence}
          onNextMonth={handleNextCompetence}
        />
      )}

      {/* ABA: Custódia de Cheques */}
      {activeTab === 'custodia_cheques' && (
        <ChequesCustodiaTab
          bankAccounts={bankAccounts}
          companyProfile={companyProfile}
          competenceMonth={competenceMonth}
          onPrevMonth={handlePrevCompetence}
          onNextMonth={handleNextCompetence}
          onSaveBankAccounts={onSaveBankAccounts}
        />
      )}


      {/* ABA: Acertos Terceiros */}
      {activeTab === 'acertos' && (
        <ThirdPartySettlementsTab
          settlements={settlements}
          onSaveSettlements={onSaveSettlements}
          competenceMonth={competenceMonth}
          onPrevMonth={handlePrevCompetence}
          onNextMonth={handleNextCompetence}
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
          competenceMonth={competenceMonth}
          onPrevMonth={handlePrevCompetence}
          onNextMonth={handleNextCompetence}
        />
      )}

      {/* ABA: Exportar */}
      {activeTab === 'exportar' && (
        <FinancialExportTab
          expenses={expenses}
          orders={orders}
          seasons={seasons}
          settlements={settlements}
          competenceMonth={competenceMonth}
          onPrevMonth={handlePrevCompetence}
          onNextMonth={handleNextCompetence}
        />
      )}

        </div>
      </div>
    </div>
  );
};


