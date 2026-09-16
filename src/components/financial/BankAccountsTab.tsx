import React, { useState } from 'react';
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
import { formatCurrencyBRL, formatDateBR, getStoredExpenses, saveStoredExpenses } from '../../lib/storage';
import { useConfirm } from '../../context/ConfirmContext';
import { BankAccountModal } from './BankAccountModal';
import { BankLogoIcon } from './BankLogoIcon';
import { BankAccountStatementModal } from './BankAccountStatementModal';
import { BankIntegrationCard } from './BankIntegrationCard';

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

export const BankAccountsTab: React.FC<BankAccountsTabProps> = ({
  accounts,
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

  // Extrato Modal State
  const [isStatementOpen, setIsStatementOpen] = useState(false);
  const [statementAccountId, setStatementAccountId] = useState<string>('todas');

  // Totais consolidados
  const totalBalance = accounts.reduce((acc, a) => acc + (a.balance || 0), 0);
  const totalOverdraftLimit = accounts.reduce((acc, a) => acc + (a.overdraftLimit || 0), 0);
  const totalAvailableResources = totalBalance + totalOverdraftLimit;

  const handleOpenModal = (acc?: BankAccount) => {
    setEditingAccount(acc || null);
    setIsModalOpen(true);
  };

  const handleOpenStatement = (accountId?: string) => {
    setStatementAccountId(accountId || (accounts[0]?.id || 'todas'));
    setIsStatementOpen(true);
  };

  const handleSaveAccount = (accountData: Omit<BankAccount, 'id'> & { id?: string }) => {
    if (accountData.id) {
      const updated = accounts.map((a) =>
        a.id === accountData.id ? ({ ...accountData, id: accountData.id } as BankAccount) : a
      );
      onSaveAccounts(updated);
    } else {
      const newAcc: BankAccount = {
        ...accountData,
        id: `bank_${Date.now()}`,
      } as BankAccount;
      onSaveAccounts([...accounts, newAcc]);
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
  };

  const handleDelete = async (id: string) => {
    const acc = accounts.find((a) => a.id === id);
    const isConfirmed = await confirm({
      title: 'Excluir Conta Bancária',
      message: acc?.name
        ? `Deseja realmente excluir a conta "${acc.name}" (${acc.bankName})?`
        : 'Deseja realmente excluir esta conta bancária?',
      confirmLabel: 'Sim, Excluir',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });
    if (isConfirmed) {
      onSaveAccounts(accounts.filter((a) => a.id !== id));
    }
  };

  // Manipulador de novos lançamentos manuais no extrato
  const handleAddTransaction = (newTxData: Omit<BankTransaction, 'id' | 'createdAt'>) => {
    const newTx: BankTransaction = {
      ...newTxData,
      id: `tx_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    const updatedTransactions = [newTx, ...transactions];
    if (onSaveTransactions) {
      onSaveTransactions(updatedTransactions);
    }

    // Se for lançamento manual, atualiza também o saldo da conta
    if (newTx.bankAccountId) {
      const updatedAccounts = accounts.map((acc) => {
        if (acc.id === newTx.bankAccountId) {
          const delta = newTx.type === 'entrada' ? newTx.amount : -newTx.amount;
          return {
            ...acc,
            balance: acc.balance + delta,
          };
        }
        return acc;
      });
      onSaveAccounts(updatedAccounts);
    }
  };

  // Manipulador de importação de transações bancárias (OFX / CSV)
  const handleImportBankTransactions = (newTxs: Omit<BankTransaction, 'id' | 'createdAt'>[]) => {
    const formatted: BankTransaction[] = newTxs.map((t, idx) => ({
      ...t,
      id: `tx_imp_${Date.now()}_${idx}`,
      createdAt: new Date().toISOString(),
    }));

    const updatedTransactions = [...formatted, ...transactions];
    if (onSaveTransactions) {
      onSaveTransactions(updatedTransactions);
    }

    // Atualiza os saldos das contas impactadas
    if (newTxs.length > 0) {
      const updatedAccounts = accounts.map((acc) => {
        const matchingTxs = newTxs.filter((tx) => tx.bankAccountId === acc.id);
        if (matchingTxs.length > 0) {
          const netDelta = matchingTxs.reduce((sum, tx) => {
            return sum + (tx.type === 'entrada' ? tx.amount : -tx.amount);
          }, 0);
          return {
            ...acc,
            balance: acc.balance + netDelta,
          };
        }
        return acc;
      });
      onSaveAccounts(updatedAccounts);
    }
  };

  const getAccountTypeLabel = (type: BankAccount['accountType']) => {
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
          accounts={accounts}
          selectedAccountId={statementAccountId !== 'todas' ? statementAccountId : undefined}
          onSelectAccount={(id) => setStatementAccountId(id)}
          expenses={expenses}
          categories={categories}
          onAddExpenseFromBankBill={onAddExpenseFromBankBill}
          onImportBankTransactions={handleImportBankTransactions}
          onLinkExpensesToAccount={onLinkExpensesToAccount}
        />
      </div>

      {/* Accounts Grid */}
      {accounts.length === 0 ? (
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
          accounts.length === 1 
            ? 'grid-cols-1 max-w-md' 
            : accounts.length === 2 
              ? 'grid-cols-1 sm:grid-cols-2' 
              : accounts.length === 3 
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' 
                : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
        }`}>
          {accounts.map((acc) => {
            const hasOverdraft = (acc.overdraftLimit || 0) > 0;
            const totalAccAvailable = (acc.balance || 0) + (acc.overdraftLimit || 0);

            return (
              <div
                key={acc.id}
                id={`card-conta-${acc.id}`}
                className="bg-white border border-slate-200 rounded-xl p-2 sm:p-2.5 shadow-2xs flex flex-col justify-between gap-1.5 hover:border-slate-300 transition text-black"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center space-x-2 truncate min-w-0">
                      <div
                        className="w-7 h-7 rounded-md flex items-center justify-center text-white shadow-2xs font-black shrink-0 overflow-hidden"
                        style={{ backgroundColor: acc.color || '#009688' }}
                      >
                        {acc.accountType === 'caixa_fisico' ? (
                          <Wallet className="w-3.5 h-3.5" />
                        ) : (
                          <BankLogoIcon code={acc.bankCode} name={acc.bankName} size={15} className="text-white" />
                        )}
                      </div>
                      <div className="truncate min-w-0">
                        <h4 className="font-black text-black text-xs leading-tight truncate">
                          {acc.name}
                        </h4>
                        <div className="flex items-center space-x-1 text-[9.5px] text-stone-500 font-semibold truncate leading-tight">
                          {acc.bankCode && (
                            <span className="px-1 py-0.2 rounded text-[8.5px] font-bold font-mono bg-stone-100 text-stone-600 border border-stone-200">
                              {acc.bankCode}
                            </span>
                          )}
                          <span className="truncate">{acc.bankName}</span>
                        </div>
                      </div>
                    </div>

                    <span className="text-[8.5px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-stone-700 border border-slate-200 shrink-0 leading-none">
                      {getAccountTypeLabel(acc.accountType)}
                    </span>
                  </div>

                  {/* Card de Saldo Compacto */}
                  <div className="p-1.5 sm:p-2 bg-slate-50/90 rounded-lg border border-slate-200/80 space-y-0.5">
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
                      {formatCurrencyBRL(hasOverdraft ? totalAccAvailable : acc.balance)}
                    </div>

                    {hasOverdraft && (
                      <div className="text-[9px] text-stone-600 font-medium border-t border-slate-200/70 pt-0.5 flex justify-between items-center leading-tight">
                        <span>Próprio: <strong className={acc.balance < 0 ? 'text-rose-600' : 'text-stone-900'}>{formatCurrencyBRL(acc.balance)}</strong></span>
                        <span>Limite: <strong className="text-emerald-800">{formatCurrencyBRL(acc.overdraftLimit || 0)}</strong></span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Dados da Base e Ações Integradas */}
                <div className="pt-1 border-t border-slate-100 space-y-1">
                  {/* Dados de Ag/Conta e PIX compactos */}
                  {((acc.agency || acc.accountNumber) || acc.pixKey || (acc.corporateCards && acc.corporateCards.length > 0)) && (
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

                      {acc.pixKey && (
                        <div className="flex justify-between items-center gap-1">
                          <span className="text-stone-400 font-medium text-[8.5px] shrink-0">
                            PIX{acc.pixKeyType ? ` (${acc.pixKeyType.toUpperCase()})` : ''}:
                          </span>
                          <span className="font-mono text-[9px] font-bold text-emerald-800 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200 truncate max-w-[140px]" title={acc.pixKey}>
                            {acc.pixKey}
                          </span>
                        </div>
                      )}

                      {acc.corporateCards && acc.corporateCards.length > 0 && (
                        <div className="flex justify-between items-center gap-1">
                          <span className="text-purple-700 font-medium text-[8.5px] flex items-center gap-1">
                            <CreditCard className="w-2.5 h-2.5 text-purple-600" />
                            <span>{acc.corporateCards.length} {acc.corporateCards.length === 1 ? 'Cartão' : 'Cartões'}:</span>
                          </span>
                          <span className="font-mono text-[8.5px] font-bold text-purple-900 bg-purple-50 px-1 py-0.2 rounded border border-purple-200">
                            {formatCurrencyBRL(acc.corporateCards.reduce((s, c) => s + (c.usedLimit || 0), 0))} util.
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Barra de Ações Integrada */}
                  <div className="flex items-center justify-between pt-0.5">
                    <button
                      type="button"
                      onClick={() => handleOpenStatement(acc.id)}
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
                        onClick={() => handleDelete(acc.id)}
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
        accounts={accounts}
        selectedAccountId={statementAccountId}
        expenses={expenses}
        transactions={transactions}
        employees={employees}
        onAddTransaction={handleAddTransaction}
      />
    </div>
  );
};
