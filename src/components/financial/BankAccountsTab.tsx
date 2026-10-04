import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Building2, 
  Plus, 
  Wallet, 
  Landmark, 
  CreditCard, 
  CheckCircle2, 
  ArrowUpRight, 
  ArrowDownRight, 
  Trash2, 
  Edit2, 
  DollarSign, 
  QrCode, 
  Sparkles, 
  FileText, 
  Link2 
} from 'lucide-react';
import { BankAccount, Expense, BankTransaction, Employee, ExpenseCategory, CorporateCard } from '../../types';
import { formatCurrencyBRL, formatDateBR, getStoredExpenses, saveStoredExpenses, getActiveCompanyId, saveStoredBankAccounts, getStoredBankAccounts } from '../../lib/storage';
import { upsertContaBancaria, deleteContaBancaria } from '../../lib/supabaseService';
import { useConfirm } from '../../context/ConfirmContext';
import { BankAccountModal } from './BankAccountModal';
import { BankLogoIcon } from './BankLogoIcon';
import { BankAccountStatementModal } from './BankAccountStatementModal';
import { BankIntegrationCard } from './BankIntegrationCard';
import { getBankTheme } from './bankThemes';

interface BankAccountsTabProps {
  accounts: BankAccount[];
  onSaveAccounts: (accounts: BankAccount[]) => void;
  expenses?: Expense[];
  employees?: Employee[];
  transactions?: BankTransaction[];
  onSaveTransactions?: (transactions: BankTransaction[]) => void;
  onAddExpenseFromBankBill?: (expense: Partial<Expense>) => void;
  onLinkExpensesToAccount?: (expenseIds: string[], accountId: string) => void;
  categories?: ExpenseCategory[];
}

/**
 * Leitura isolada e resiliente de contas bancárias no LocalStorage
 */
function loadInitialLocalAccounts(fallbackAccounts: BankAccount[] = []): BankAccount[] {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      // 1. Chave prioritária solicitada
      const rawGlobal = window.localStorage.getItem('colaca_silagem_financeiro_contas');
      if (rawGlobal) {
        const parsed = JSON.parse(rawGlobal);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }

      // 2. Chave escopada por empresa ativa
      const cId = getActiveCompanyId();
      if (cId) {
        const rawScoped = window.localStorage.getItem(`colaca_silagem_financeiro_contas_${cId}`);
        if (rawScoped) {
          const parsed = JSON.parse(rawScoped);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      }
    }
  } catch (err) {
    console.warn('Erro ao carregar contas bancárias do LocalStorage:', err);
  }

  if (Array.isArray(fallbackAccounts) && fallbackAccounts.length > 0) {
    return fallbackAccounts;
  }
  return getStoredBankAccounts();
}

/**
 * Cálculo isolado do Saldo Consolidado usando variáveis locais simples
 */
function computeConsolidatedBalances(accList: BankAccount[]) {
  let localTotal = 0;
  let localOverdraft = 0;

  try {
    if (Array.isArray(accList)) {
      for (const a of accList) {
        if (!a) continue;
        const bal = typeof a.balance === 'number' && !isNaN(a.balance) ? a.balance : 0;
        const lim = typeof a.overdraftLimit === 'number' && !isNaN(a.overdraftLimit) ? a.overdraftLimit : 0;
        localTotal += bal;
        localOverdraft += lim;
      }
    }
  } catch (err) {
    console.warn('Erro ao calcular saldo consolidado:', err);
  }

  return {
    totalBalance: localTotal,
    totalOverdraftLimit: localOverdraft,
    totalAvailableResources: localTotal + localOverdraft,
  };
}

export const BankAccountsTab: React.FC<BankAccountsTabProps> = ({
  accounts = [],
  onSaveAccounts,
  expenses = [],
  employees = [],
  transactions = [],
  onSaveTransactions,
  onAddExpenseFromBankBill,
  onLinkExpensesToAccount,
  categories = [],
}) => {
  const { confirm } = useConfirm();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);

  // Leitura inicial das contas bancárias diretamente do LocalStorage
  const [localAccounts, setLocalAccounts] = useState<BankAccount[]>(() => {
    return loadInitialLocalAccounts(accounts);
  });

  // Lista efetiva de contas com proteção contra listas vazias ou nulas
  const effectiveAccounts = useMemo(() => {
    if (Array.isArray(localAccounts) && localAccounts.length > 0) return localAccounts;
    if (Array.isArray(accounts) && accounts.length > 0) return accounts;
    return [];
  }, [localAccounts, accounts]);

  // Saldo Consolidado em computação isolada pura (sem chamada a setState e sem risco de loop)
  const consolidatedBalances = useMemo(() => {
    return computeConsolidatedBalances(effectiveAccounts);
  }, [effectiveAccounts]);

  // Trava de segurança para execução EXCLUSIVAMENTE UMA ÚNICA VEZ durante o carregamento inicial
  const isInitialLoad = useRef(true);

  useEffect(() => {
    if (!isInitialLoad.current) return;
    isInitialLoad.current = false;

    try {
      const stored = loadInitialLocalAccounts(accounts);
      const safeList = Array.isArray(stored) && stored.length > 0 
        ? stored 
        : (Array.isArray(accounts) && accounts.length > 0 ? accounts : []);
      if (safeList.length > 0) {
        setLocalAccounts(safeList);
      }
    } catch (err) {
      console.warn('Erro ao inicializar saldos e contas bancárias:', err);
    }
  }, []);

  const lastPropsJsonRef = useRef(JSON.stringify(accounts || []));

  // Extrato Modal State e Seletor de Conta Vinculada
  const [isStatementOpen, setIsStatementOpen] = useState(false);
  const [statementAccountId, setStatementAccountId] = useState<string>('todas');

  const { totalBalance, totalOverdraftLimit, totalAvailableResources } = consolidatedBalances;

  const handleOpenModal = (acc?: BankAccount) => {
    setEditingAccount(acc || null);
    setIsModalOpen(true);
  };

  const handleOpenStatement = (accountId?: string) => {
    setStatementAccountId(accountId || (effectiveAccounts[0]?.id || 'todas'));
    setIsStatementOpen(true);
  };

  const handleSaveAccount = (accountData: Omit<BankAccount, 'id'> & { id?: string }) => {
    try {
      const activeCompanyId = getActiveCompanyId();
      let updated: BankAccount[] = [];
      if (accountData.id) {
        const updatedAccount: BankAccount = { ...accountData, id: accountData.id } as BankAccount;
        updated = effectiveAccounts.map((a) =>
          a.id === accountData.id ? updatedAccount : a
        );
      } else {
        const newAcc: BankAccount = {
          ...accountData,
          id: `bank_${Date.now()}`,
        } as BankAccount;
        updated = [...effectiveAccounts, newAcc];
      }

      saveStoredBankAccounts(updated);
      setLocalAccounts(updated);
      lastPropsJsonRef.current = JSON.stringify(updated);

      if (onSaveAccounts) {
        onSaveAccounts(updated);
      }

      const target = accountData.id ? ({ ...accountData, id: accountData.id } as BankAccount) : updated[0];
      upsertContaBancaria(target, activeCompanyId).catch(err => console.warn('Supabase upsertContaBancaria notice:', err));
    } catch (err) {
      console.warn('Erro ao salvar conta bancária:', err);
    }
  };

  // Manipulador para provisionamento automático de fatura de cartão de crédito corporativo em Contas a Pagar
  const handleProvisionCardInvoice = ({
    card,
    account,
    amount,
    dueDate,
    description,
  }: {
    card: CorporateCard;
    account?: BankAccount;
    amount: number;
    dueDate: string;
    description: string;
  }) => {
    try {
      const newExpense: Expense = {
        id: `exp_card_inv_${card.id}_${Date.now()}`,
        description,
        amount,
        categoryId: 'cat_cartao',
        categoryName: 'Fatura de Cartão Corporativo',
        categoryColor: '#8b5cf6',
        dueDate,
        date: new Date().toISOString().split('T')[0],
        status: 'pendente',
        paymentMethod: 'boleto',
        supplier: account ? `${account.bankName} - Cartão Corporativo (${card.name})` : `Cartão Corporativo (${card.name})`,
        bankAccountId: account?.id,
        bankAccountName: account?.name || account?.bankName,
        employeeId: card.responsibleEmployeeId,
        employeeName: card.responsibleEmployeeName,
        corporateCardId: card.id,
        corporateCardName: card.name,
        notes: `Fatura de cartão corporativo provisionada automaticamente para quitação em ${formatDateBR(dueDate)}. Limite Total: ${formatCurrencyBRL(card.totalLimit)}. Titular: ${card.responsibleEmployeeName || 'Não especificado'}.`,
        createdAt: new Date().toISOString(),
      };

      if (onAddExpenseFromBankBill) {
        onAddExpenseFromBankBill(newExpense);
      } else {
        const currentExpenses = getStoredExpenses();
        saveStoredExpenses([newExpense, ...currentExpenses]);
      }
    } catch (err) {
      console.warn('Erro ao provisionar fatura de cartão:', err);
    }
  };

  const handleDelete = async (id: string) => {
    const acc = effectiveAccounts.find((a) => a.id === id);
    const isConfirmed = await confirm({
      title: 'Excluir Conta Bancária',
      message: acc?.name
        ? `Deseja realmente excluir a conta "${acc.name}" (${acc.bankName || 'Banco'})?`
        : 'Deseja realmente excluir esta conta bancária?',
      confirmLabel: 'Sim, Excluir',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });

    if (isConfirmed) {
      try {
        const activeCompanyId = getActiveCompanyId();
        const updated = effectiveAccounts.filter((a) => a.id !== id);
        saveStoredBankAccounts(updated);
        setLocalAccounts(updated);
        lastPropsJsonRef.current = JSON.stringify(updated);

        if (onSaveAccounts) {
          onSaveAccounts(updated);
        }

        deleteContaBancaria(id, activeCompanyId).catch(err => console.warn('Supabase deleteContaBancaria notice:', err));
      } catch (err) {
        console.warn('Erro ao excluir conta bancária:', err);
      }
    }
  };

  // Manipulador de novos lançamentos manuais no extrato
  const handleAddTransaction = (newTxData: Omit<BankTransaction, 'id' | 'createdAt'>) => {
    try {
      const newTx: BankTransaction = {
        ...newTxData,
        id: `tx_${Date.now()}`,
        createdAt: new Date().toISOString(),
      };

      const updatedTransactions = [newTx, ...transactions];
      if (onSaveTransactions) {
        onSaveTransactions(updatedTransactions);
      }

      if (newTx.bankAccountId) {
        const activeCompanyId = getActiveCompanyId();
        const updatedAccounts = effectiveAccounts.map((acc) => {
          if (acc.id === newTx.bankAccountId) {
            const delta = newTx.type === 'entrada' ? newTx.amount : -newTx.amount;
            const updatedAcc = {
              ...acc,
              balance: (acc.balance || 0) + delta,
            };
            upsertContaBancaria(updatedAcc, activeCompanyId).catch(console.warn);
            return updatedAcc;
          }
          return acc;
        });

        saveStoredBankAccounts(updatedAccounts);
        setLocalAccounts(updatedAccounts);
        lastPropsJsonRef.current = JSON.stringify(updatedAccounts);

        if (onSaveAccounts) {
          onSaveAccounts(updatedAccounts);
        }
      }
    } catch (err) {
      console.warn('Erro ao adicionar transação:', err);
    }
  };

  // Manipulador de importação de transações bancárias (OFX / CSV)
  const handleImportBankTransactions = (newTxs: Omit<BankTransaction, 'id' | 'createdAt'>[]) => {
    try {
      const formatted: BankTransaction[] = newTxs.map((t, idx) => ({
        ...t,
        id: `tx_imp_${Date.now()}_${idx}`,
        createdAt: new Date().toISOString(),
      }));

      const updatedTransactions = [...formatted, ...transactions];
      if (onSaveTransactions) {
        onSaveTransactions(updatedTransactions);
      }

      if (newTxs.length > 0) {
        const activeCompanyId = getActiveCompanyId();
        const updatedAccounts = effectiveAccounts.map((acc) => {
          const matchingTxs = newTxs.filter((tx) => tx.bankAccountId === acc.id);
          if (matchingTxs.length > 0) {
            const netDelta = matchingTxs.reduce((sum, tx) => {
              return sum + (tx.type === 'entrada' ? tx.amount : -tx.amount);
            }, 0);
            const updatedAcc = {
              ...acc,
              balance: (acc.balance || 0) + netDelta,
            };
            upsertContaBancaria(updatedAcc, activeCompanyId).catch(console.warn);
            return updatedAcc;
          }
          return acc;
        });

        saveStoredBankAccounts(updatedAccounts);
        setLocalAccounts(updatedAccounts);
        lastPropsJsonRef.current = JSON.stringify(updatedAccounts);

        if (onSaveAccounts) {
          onSaveAccounts(updatedAccounts);
        }
      }
    } catch (err) {
      console.warn('Erro ao importar transações:', err);
    }
  };

  const getAccountTypeLabel = (type?: BankAccount['accountType']) => {
    try {
      switch (type) {
        case 'corrente':
          return 'Conta Corrente';
        case 'poupanca':
          return 'Poupança Agro';
        case 'aplicacao':
          return 'Investimento / Aplicação';
        case 'caixa_fisico':
          return 'Caixa Físico / Sede';
        default:
          return 'Conta Bancária';
      }
    } catch (_) {
      return 'Conta Bancária';
    }
  };

  return (
    <div className="flex flex-col gap-2 sm:gap-2.5 h-full overflow-hidden justify-start">
      {/* Header & Total Balance */}
      <div className="bg-white border border-slate-200 rounded-xl p-2.5 sm:px-3.5 sm:py-2 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-black shrink-0">
        <div className="space-y-0.5">
          <div className="flex items-center space-x-2">
            <span className="text-[10.5px] font-black text-black uppercase tracking-wider">
              Saldo Consolidado em Contas
            </span>
            {totalOverdraftLimit > 0 && (
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                + Limite Ativo
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <div className="text-xl sm:text-2xl font-black text-black font-['Outfit'] leading-tight">
              {formatCurrencyBRL(totalAvailableResources)}
            </div>
            {totalOverdraftLimit > 0 && (
              <div className="text-[11px] text-stone-600 font-semibold">
                (Próprio: <strong className={totalBalance < 0 ? 'text-rose-600 font-bold' : 'text-black font-bold'}>{formatCurrencyBRL(totalBalance)}</strong> + Limite: <strong className="text-emerald-800 font-bold">{formatCurrencyBRL(totalOverdraftLimit)}</strong>)
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {/* Botão de Ver Extrato Bancário */}
          <button
            type="button"
            id="btn-abrir-extrato-geral"
            onClick={() => handleOpenStatement()}
            className="inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-stone-50 text-stone-800 font-bold text-xs rounded-lg border border-stone-300 transition shadow-2xs cursor-pointer active:scale-95"
            title="Abrir Extrato de Contas Bancárias"
          >
            <FileText className="w-3.5 h-3.5 text-[#0963cb]" />
            <span>Extrato Geral</span>
          </button>

          {/* Botão de Cadastrar Nova Conta */}
          <button
            type="button"
            id="btn-abrir-nova-conta"
            onClick={() => handleOpenModal()}
            className="inline-flex items-center justify-center space-x-1.5 px-3.5 py-1.5 bg-[#0963cb] hover:bg-[#0852a8] text-white font-black text-xs rounded-lg transition shadow-2xs cursor-pointer active:scale-95 shrink-0"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>Cadastrar Conta</span>
          </button>
        </div>
      </div>

      {/* CARD DE INTEGRAÇÃO: Barra horizontal única e compacta */}
      <div className="shrink-0">
        <BankIntegrationCard
          accounts={effectiveAccounts}
          selectedAccountId={statementAccountId !== 'todas' ? statementAccountId : undefined}
          onSelectAccount={(id) => {
            if (id && id !== statementAccountId) {
              setStatementAccountId(id);
            }
          }}
          expenses={expenses}
          categories={categories}
          onAddExpenseFromBankBill={onAddExpenseFromBankBill}
          onImportBankTransactions={handleImportBankTransactions}
          onLinkExpensesToAccount={onLinkExpensesToAccount}
        />
      </div>

      {/* Accounts Grid */}
      {effectiveAccounts.length === 0 ? (
        <div className="bg-white border border-dashed border-stone-300 rounded-xl p-6 text-center space-y-2 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-[#0963cb] flex items-center justify-center mx-auto">
            <Landmark className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-black text-black">Nenhuma conta bancária cadastrada</h3>
          <p className="text-xs text-stone-600 max-w-md mx-auto">
            Cadastre as contas correntes bancárias, cooperativas de crédito (Sicredi, Sicoob, Banco do Brasil, Caixa, Itaú, Bradesco, Santander, Cresol) ou o caixa físico da fazenda.
          </p>
          <button
            type="button"
            onClick={() => handleOpenModal()}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#0963cb] text-white rounded-lg text-xs font-bold hover:bg-[#0852a8] transition cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Cadastrar Primeira Conta</span>
          </button>
        </div>
      ) : (
        <div className={`grid gap-2 sm:gap-2.5 overflow-y-auto pr-0.5 ${
          effectiveAccounts.length === 1 
            ? 'grid-cols-1 max-w-md' 
            : effectiveAccounts.length === 2 
              ? 'grid-cols-1 sm:grid-cols-2' 
              : effectiveAccounts.length === 3 
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' 
                : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
        }`}>
          {effectiveAccounts.map((acc, index) => {
            // Bloco try/catch para erros visuais em dados incompletos ou anômalos
            let safeColor = '#009688';
            let safeBankName = 'Conta Bancária';
            let safeBankCode = '';
            let safeAccountType: BankAccount['accountType'] = 'corrente';
            let hasOverdraft = false;
            let totalAccAvailable = 0;
            let safeAccBalance = 0;
            let safeOverdraft = 0;
            let safeAccName = 'Conta Bancária';
            let safeId = `acc_${index}`;

            try {
              if (acc) {
                safeId = acc.id || `acc_${index}`;
                safeColor = (acc.color && typeof acc.color === 'string' && acc.color.trim()) ? acc.color : '#009688';
                safeBankName = acc.bankName || acc.name || 'Conta Bancária';
                safeBankCode = acc.bankCode || '';
                safeAccountType = acc.accountType || 'corrente';
                safeAccName = acc.name || safeBankName;
                safeAccBalance = typeof acc.balance === 'number' && !isNaN(acc.balance) ? acc.balance : 0;
                safeOverdraft = typeof acc.overdraftLimit === 'number' && !isNaN(acc.overdraftLimit) ? acc.overdraftLimit : 0;
                hasOverdraft = safeOverdraft > 0;
                totalAccAvailable = safeAccBalance + safeOverdraft;
              }
            } catch (err) {
              console.warn('Erro ao processar visual da conta bancária:', err);
            }

            let theme = getBankTheme('', 'Conta Bancária');
            try {
              theme = getBankTheme(safeBankCode, safeBankName, safeAccountType);
            } catch (err) {
              console.warn('Erro ao mapear tema visual da conta bancária:', err);
            }

            return (
              <div
                key={safeId}
                id={`card-conta-${safeId}`}
                className={`${theme.bgCard} border ${theme.borderCard} ${theme.hoverBorder} rounded-xl p-2.5 sm:p-3 shadow-2xs flex flex-col justify-between gap-2 transition text-black relative overflow-hidden`}
                style={{
                  borderLeftWidth: '4px',
                  borderLeftColor: theme.accentBar,
                }}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center space-x-2.5 truncate min-w-0">
                      {/* Logotipo oficial em tamanho nítido e discreto (30px) */}
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-xs font-black shrink-0 overflow-hidden p-0.5"
                        style={{ backgroundColor: theme.accentBar }}
                      >
                        {safeAccountType === 'caixa_fisico' ? (
                          <Wallet className="w-4 h-4 text-white" />
                        ) : (
                          <BankLogoIcon code={safeBankCode} name={safeBankName} size={30} className="text-white" />
                        )}
                      </div>
                      <div className="truncate min-w-0">
                        <h4 className={`font-black text-xs sm:text-[13px] leading-tight truncate ${theme.textPrimary}`}>
                          {safeAccName}
                        </h4>
                        <div className="flex items-center space-x-1.5 text-[9.5px] font-semibold truncate leading-tight mt-0.5">
                          {safeBankCode && (
                            <span className={`px-1.5 py-0.2 rounded text-[8.5px] font-bold font-mono border shadow-2xs ${theme.accentTag}`}>
                              {safeBankCode}
                            </span>
                          )}
                          <span className={`truncate font-bold ${theme.textSecondary}`}>{safeBankName}</span>
                        </div>
                      </div>
                    </div>

                    <span className={`text-[8.5px] font-bold px-1.5 py-0.2 rounded shrink-0 leading-none shadow-2xs border ${theme.badgeBg}`}>
                      {getAccountTypeLabel(safeAccountType)}
                    </span>
                  </div>

                  {/* Card de Saldo Compacto com fundo e borda temáticos */}
                  <div className={`p-1.5 sm:p-2 rounded-lg border space-y-0.5 ${theme.innerCardBg}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[8.5px] font-extrabold text-stone-500 uppercase tracking-wider">
                        {hasOverdraft ? 'Disponível Total' : 'Saldo em Conta'}
                      </span>
                      {hasOverdraft && (
                        <span className="text-[8px] font-black uppercase text-emerald-800 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                          + Limite
                        </span>
                      )}
                    </div>

                    <div className={`text-base sm:text-[17px] font-black font-['Outfit'] leading-tight ${totalAccAvailable >= 0 ? 'text-black' : 'text-rose-600'}`}>
                      {formatCurrencyBRL(hasOverdraft ? totalAccAvailable : safeAccBalance)}
                    </div>

                    {hasOverdraft && (
                      <div className="text-[9px] text-stone-600 font-medium border-t border-slate-200/70 pt-0.5 flex justify-between items-center leading-tight">
                        <span>Próprio: <strong className={safeAccBalance < 0 ? 'text-rose-600' : 'text-stone-900'}>{formatCurrencyBRL(safeAccBalance)}</strong></span>
                        <span>Limite: <strong className="text-emerald-800">{formatCurrencyBRL(safeOverdraft)}</strong></span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Dados da Base e Ações Integradas */}
                <div className="pt-1 border-t border-black/5 dark:border-white/5 space-y-1">
                  {acc && ((acc.agency || acc.accountNumber) || acc.pixKey || (acc.corporateCards && acc.corporateCards.length > 0)) && (
                    <div className="space-y-0.5 text-[9px] text-stone-600 leading-tight">
                      {(acc.agency || acc.accountNumber) && (
                        <div className="flex justify-between items-center gap-1">
                          <span className="text-stone-400 font-medium text-[8.5px]">Ag/Conta:</span>
                          <span className="font-bold font-mono text-stone-800 text-[9.5px] truncate">
                            {acc.agency ? `Ag: ${acc.agency}` : ''} 
                            {acc.agency && acc.accountNumber ? ' | ' : ''}
                            {acc.accountNumber ? `CC: ${acc.accountNumber}${acc.accountDigit ? `-${acc.accountDigit}` : ''}` : ''}
                          </span>
                        </div>
                      )}

                      {acc.responsavel_conta_nome && (
                        <div className="flex justify-between items-center gap-1.5">
                          <span className="text-stone-400 font-medium text-[8.5px] shrink-0">Titular:</span>
                          <div className="flex items-center gap-1 truncate min-w-0">
                            <div 
                              className="w-3.5 h-3.5 rounded shrink-0 overflow-hidden flex items-center justify-center p-0.2 shadow-2xs"
                              style={{ backgroundColor: theme.accentBar }}
                            >
                              <BankLogoIcon code={safeBankCode} name={safeBankName} size={14} className="text-white" />
                            </div>
                            <span className="font-bold text-stone-800 text-[9.5px] truncate" title={acc.responsavel_conta_nome}>
                              {acc.responsavel_conta_nome}
                            </span>
                          </div>
                        </div>
                      )}

                      {acc.pixKey && (
                        <div className="flex justify-between items-center gap-1">
                          <span className="text-stone-400 font-medium text-[8.5px] shrink-0">
                            PIX{acc.pixKeyType ? ` (${String(acc.pixKeyType).toUpperCase()})` : ''}:
                          </span>
                          <span className="font-mono text-[9px] font-bold text-emerald-800 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200 truncate max-w-[140px]" title={acc.pixKey}>
                            {acc.pixKey}
                          </span>
                        </div>
                      )}

                      {acc.corporateCards && Array.isArray(acc.corporateCards) && acc.corporateCards.length > 0 && (
                        <div className="flex justify-between items-center gap-1">
                          <span className="text-purple-700 font-medium text-[8.5px] flex items-center gap-1">
                            <CreditCard className="w-2.5 h-2.5 text-purple-600" />
                            <span>{acc.corporateCards.length} {acc.corporateCards.length === 1 ? 'Cartão' : 'Cartões'}:</span>
                          </span>
                          <span className="font-mono text-[8.5px] font-bold text-purple-900 bg-purple-50 px-1 py-0.2 rounded border border-purple-200">
                            {formatCurrencyBRL(acc.corporateCards.reduce((s, c) => s + (c && typeof c.usedLimit === 'number' ? c.usedLimit : 0), 0))} util.
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Barra de Ações Integrada */}
                  <div className="flex items-center justify-between pt-0.5">
                    <button
                      type="button"
                      onClick={() => handleOpenStatement(acc?.id)}
                      className="inline-flex items-center space-x-1 text-[10px] font-bold text-[#0963cb] hover:text-blue-800 hover:bg-blue-50/80 px-1.5 py-0.5 rounded transition cursor-pointer active:scale-95"
                      title="Ver Extrato da Conta"
                    >
                      <FileText className="w-2.5 h-2.5" />
                      <span>Ver Extrato</span>
                    </button>

                    <div className="flex items-center space-x-0.5">
                      <button
                        type="button"
                        onClick={() => handleOpenModal(acc)}
                        className="p-1 text-stone-400 hover:text-[#0963cb] hover:bg-sky-50 rounded transition cursor-pointer"
                        title="Editar Conta"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => acc && handleDelete(acc.id)}
                        className="p-1 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                        title="Excluir Conta"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Cadastrar / Editar Conta */}
      <BankAccountModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingAccount={editingAccount}
        onSave={handleSaveAccount}
        employees={employees}
        expenses={expenses}
        onProvisionCardInvoice={handleProvisionCardInvoice}
      />

      {/* Modal Extrato de Contas Bancárias (com busca obrigatória por intervalo de datas) */}
      <BankAccountStatementModal
        isOpen={isStatementOpen}
        onClose={() => setIsStatementOpen(false)}
        accounts={effectiveAccounts}
        selectedAccountId={statementAccountId}
        expenses={expenses}
        transactions={transactions}
        employees={employees}
        onAddTransaction={handleAddTransaction}
      />
    </div>
  );
};
