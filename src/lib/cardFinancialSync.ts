import { BankAccount, CorporateCard, BankTransaction, Expense } from '../types';
import { 
  getStoredBankAccounts, 
  saveStoredBankAccounts, 
  getStoredBankTransactions, 
  saveStoredBankTransactions 
} from './storage';
import { calculateCardInvoiceDueDate } from './formatters';

export function formatCorporateCardDisplay(card: CorporateCard, account?: BankAccount): string {
  const bankRaw = account?.bankName || account?.name || '';
  let bankName = '';
  if (bankRaw.toLowerCase().includes('sicredi')) {
    bankName = 'Sicredi ';
  } else if (bankRaw.toLowerCase().includes('brasil')) {
    bankName = 'Banco do Brasil ';
  } else if (bankRaw.toLowerCase().includes('sicoob')) {
    bankName = 'Sicoob ';
  } else if (bankRaw.toLowerCase().includes('bradesco')) {
    bankName = 'Bradesco ';
  } else if (bankRaw.toLowerCase().includes('itau') || bankRaw.toLowerCase().includes('itaú')) {
    bankName = 'Itaú ';
  } else if (bankRaw.trim()) {
    const cleanBank = bankRaw.split('-')[0]?.trim() || bankRaw.trim();
    bankName = `${cleanBank} `;
  }

  let brand = 'MasterCard';
  if (card.brand) {
    if (card.brand.toLowerCase() === 'mastercard') brand = 'MasterCard';
    else if (card.brand.toLowerCase() === 'visa') brand = 'Visa';
    else if (card.brand.toLowerCase() === 'elo') brand = 'Elo';
    else if (card.brand.toLowerCase() === 'amex') brand = 'American Express';
    else brand = card.brand.toUpperCase();
  } else if (card.name) {
    if (card.name.toLowerCase().includes('visa')) brand = 'Visa';
    else if (card.name.toLowerCase().includes('master')) brand = 'MasterCard';
    else if (card.name.toLowerCase().includes('elo')) brand = 'Elo';
    else brand = card.name.split('Final')[0]?.trim() || 'Corporativo';
  }

  const last4 = card.last4 || (card.name && card.name.match(/\d{4}/)?.[0]) || '4520';
  const titular = card.titular_nome || card.responsibleEmployeeName;
  const titularPart = titular ? ` • ${titular}` : '';

  return `💳 ${bankName}${brand} - Final ${last4}${titularPart}`;
}

export interface CardSyncResult {
  updatedAccounts: BankAccount[];
  updatedTransactions: BankTransaction[];
  newTransaction?: BankTransaction;
}

/**
 * Sincroniza uma despesa (nova ou atualizada) com os limites de cartões corporativos
 * e saldos bancários:
 * - CARTÃO DE CRÉDITO: Aumenta o limite utilizado do cartão e gera lançamento em Contas a Pagar na data de vencimento da fatura. Não debita o saldo em conta imediatamente.
 * - CARTÃO DE DÉBITO: Baixa imediata do saldo real na conta bancária e gera registro no extrato bancário identificado com o cartão.
 * - Limpeza / Reversão: Reverte o efeito de edições anteriores caso o valor ou método tenham mudado.
 */
export function syncExpenseWithCardsAndBank(
  newExpense: Expense,
  previousExpense?: Expense | null,
  currentAccounts?: BankAccount[]
): CardSyncResult {
  const baseAccounts: BankAccount[] = (currentAccounts && currentAccounts.length > 0)
    ? currentAccounts.map(a => ({
        ...a,
        corporateCards: Array.isArray(a.corporateCards) ? a.corporateCards.map(c => ({ ...c })) : []
      }))
    : getStoredBankAccounts().map(a => ({
        ...a,
        corporateCards: Array.isArray(a.corporateCards) ? a.corporateCards.map(c => ({ ...c })) : []
      }));

  let transactions = [...getStoredBankTransactions()];
  let generatedTx: BankTransaction | undefined;

  // 1. REVERSÃO DO EFEITO ANTERIOR (se estiver editando uma despesa existente)
  if (previousExpense) {
    const prevAmt = Number(previousExpense.amount) || 0;
    if (previousExpense.paymentMethod === 'cartao_credito' && previousExpense.corporateCardId && prevAmt > 0) {
      for (const acc of baseAccounts) {
        if (acc.corporateCards) {
          const c = acc.corporateCards.find(card => card.id === previousExpense.corporateCardId);
          if (c) {
            c.usedLimit = Math.max(0, (Number(c.usedLimit) || 0) - prevAmt);
            break;
          }
        }
      }
    } else if (previousExpense.paymentMethod === 'cartao_debito' && previousExpense.bankAccountId && prevAmt > 0) {
      const acc = baseAccounts.find(a => a.id === previousExpense.bankAccountId);
      if (acc) {
        acc.balance = (Number(acc.balance) || 0) + prevAmt;
      }
      transactions = transactions.filter(t => t.sourceId !== previousExpense.id && t.expenseId !== previousExpense.id);
    }
  }

  // 2. APLICAÇÃO DO NOVO EFEITO
  const newAmt = Number(newExpense.amount) || 0;

  if (newExpense.paymentMethod === 'cartao_credito' && newExpense.corporateCardId && newAmt > 0) {
    // CARTÃO DE CRÉDITO: Não mexe no saldo bancário. Atualiza o Limite Utilizado do cartão.
    for (const acc of baseAccounts) {
      if (acc.corporateCards) {
        const c = acc.corporateCards.find(card => card.id === newExpense.corporateCardId);
        if (c) {
          c.usedLimit = (Number(c.usedLimit) || 0) + newAmt;
          break;
        }
      }
    }
  } else if (newExpense.paymentMethod === 'cartao_debito' && newAmt > 0) {
    // CARTÃO DE DÉBITO: Baixa imediata no saldo real da conta e registro no extrato
    let targetAcc = baseAccounts.find(a => a.id === newExpense.bankAccountId);
    if (!targetAcc && newExpense.corporateCardId) {
      targetAcc = baseAccounts.find(a => a.corporateCards?.some(c => c.id === newExpense.corporateCardId));
    }
    if (!targetAcc && baseAccounts.length > 0) {
      targetAcc = baseAccounts.find(a => a.isPriority || a.prioritaria) || baseAccounts[0];
    }

    if (targetAcc) {
      targetAcc.balance = (Number(targetAcc.balance) || 0) - newAmt;

      const cardLabel = newExpense.corporateCardName || 'Cartão Corporativo';
      const txDate = newExpense.paymentDate || newExpense.dueDate || new Date().toISOString().split('T')[0];
      const txDesc = `${newExpense.description || newExpense.categoryName || 'Despesa'} - Débito Cartão (${cardLabel})`;

      // Remove eventual transação prévia do mesmo id
      transactions = transactions.filter(t => t.sourceId !== newExpense.id && t.expenseId !== newExpense.id);

      generatedTx = {
        id: `tx_card_deb_${newExpense.id}_${Date.now()}`,
        bankAccountId: targetAcc.id,
        bankAccountName: targetAcc.name || targetAcc.bankName,
        date: txDate,
        description: txDesc,
        type: 'saida',
        amount: newAmt,
        category: newExpense.categoryName || 'Despesa',
        sourceType: 'despesa',
        sourceId: newExpense.id,
        expenseId: newExpense.id,
        paidByEmployeeId: newExpense.paidByEmployeeId || newExpense.employeeId,
        paidByEmployeeName: newExpense.paidByEmployeeName || newExpense.employeeName,
        documentNumber: newExpense.invoiceNumber,
        notes: `Pagamento com Cartão de Débito: ${cardLabel}. Fornecedor: ${newExpense.supplier || 'N/A'}.`,
        balanceAfter: targetAcc.balance,
      };

      transactions.push(generatedTx);
    }
  }

  // 3. PERSISTÊNCIA EM LOCALSTORAGE E NOTIFICAÇÃO
  saveStoredBankAccounts(baseAccounts);
  saveStoredBankTransactions(transactions);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('agrocontrol_bank_accounts_updated', { detail: baseAccounts }));
    window.dispatchEvent(new CustomEvent('agrocontrol_bank_transactions_updated', { detail: transactions }));
  }

  return {
    updatedAccounts: baseAccounts,
    updatedTransactions: transactions,
    newTransaction: generatedTx,
  };
}

/**
 * Reverte o efeito de uma despesa excluída sobre os cartões ou conta bancária
 */
export function revertExpenseCardsAndBank(
  expense: Expense,
  currentAccounts?: BankAccount[]
): CardSyncResult {
  const baseAccounts: BankAccount[] = (currentAccounts && currentAccounts.length > 0)
    ? currentAccounts.map(a => ({
        ...a,
        corporateCards: Array.isArray(a.corporateCards) ? a.corporateCards.map(c => ({ ...c })) : []
      }))
    : getStoredBankAccounts().map(a => ({
        ...a,
        corporateCards: Array.isArray(a.corporateCards) ? a.corporateCards.map(c => ({ ...c })) : []
      }));

  let transactions = [...getStoredBankTransactions()];
  const amt = Number(expense.amount) || 0;

  if (expense.paymentMethod === 'cartao_credito' && expense.corporateCardId && amt > 0) {
    for (const acc of baseAccounts) {
      if (acc.corporateCards) {
        const c = acc.corporateCards.find(card => card.id === expense.corporateCardId);
        if (c) {
          c.usedLimit = Math.max(0, (Number(c.usedLimit) || 0) - amt);
          break;
        }
      }
    }
  } else if (expense.paymentMethod === 'cartao_debito' && amt > 0) {
    let targetAcc = baseAccounts.find(a => a.id === expense.bankAccountId);
    if (!targetAcc && expense.corporateCardId) {
      targetAcc = baseAccounts.find(a => a.corporateCards?.some(c => c.id === expense.corporateCardId));
    }
    if (targetAcc) {
      targetAcc.balance = (Number(targetAcc.balance) || 0) + amt;
    }
    transactions = transactions.filter(t => t.sourceId !== expense.id && t.expenseId !== expense.id);
  }

  saveStoredBankAccounts(baseAccounts);
  saveStoredBankTransactions(transactions);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('agrocontrol_bank_accounts_updated', { detail: baseAccounts }));
    window.dispatchEvent(new CustomEvent('agrocontrol_bank_transactions_updated', { detail: transactions }));
  }

  return {
    updatedAccounts: baseAccounts,
    updatedTransactions: transactions,
  };
}
