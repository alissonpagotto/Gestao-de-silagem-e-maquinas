import { BankAccount, CorporateCard, Expense } from '../types';

export function formatCorporateCardDisplay(card: CorporateCard, account?: BankAccount): string {
  const last4 = card.last4 ? ` • Final ${card.last4}` : '';
  const titular = card.titular_nome || card.responsibleEmployeeName ? ` (${card.titular_nome || card.responsibleEmployeeName})` : '';
  const bank = account?.name ? ` [${account.name}]` : '';
  return `${card.name}${last4}${titular}${bank}`;
}

export function syncExpenseWithCardsAndBank(
  newExp: Expense,
  prevExp?: Expense | null,
  bankAccounts: BankAccount[] = []
): { updatedAccounts: BankAccount[] } {
  if (!bankAccounts || bankAccounts.length === 0) {
    return { updatedAccounts: [] };
  }

  const updatedAccounts = bankAccounts.map(acc => {
    let accCopy = { ...acc };
    const cards = accCopy.corporateCards ? [...accCopy.corporateCards] : [];

    // Ajuste de cartão corporativo
    if (cards.length > 0) {
      let cardsChanged = false;
      const updatedCards = cards.map(c => {
        let cardCopy = { ...c };
        // Reverte valor anterior se existia
        if (prevExp && prevExp.corporateCardId === c.id) {
          const prevAmt = Number(prevExp.amount) || 0;
          cardCopy.usedLimit = Math.max(0, (cardCopy.usedLimit || 0) - prevAmt);
          cardsChanged = true;
        }
        // Aplica novo valor
        if (newExp && newExp.corporateCardId === c.id) {
          const newAmt = Number(newExp.amount) || 0;
          cardCopy.usedLimit = (cardCopy.usedLimit || 0) + newAmt;
          cardsChanged = true;
        }
        return cardCopy;
      });

      if (cardsChanged) {
        accCopy.corporateCards = updatedCards;
      }
    }

    // Ajuste de saldo da conta se a despesa for debitada diretamente
    if (accCopy.id === newExp.bankAccountId && newExp.status === 'pago') {
      const prevAmt = (prevExp && prevExp.bankAccountId === accCopy.id && prevExp.status === 'pago')
        ? (Number(prevExp.amount) || 0)
        : 0;
      const newAmt = Number(newExp.amount) || 0;
      const diff = newAmt - prevAmt;
      accCopy.balance = (accCopy.balance || 0) - diff;
    } else if (prevExp && prevExp.bankAccountId === accCopy.id && prevExp.status === 'pago' && newExp.status !== 'pago') {
      const prevAmt = Number(prevExp.amount) || 0;
      accCopy.balance = (accCopy.balance || 0) + prevAmt;
    }

    return accCopy;
  });

  return { updatedAccounts };
}

export function revertExpenseCardsAndBank(
  exp: Expense,
  bankAccounts: BankAccount[] = []
): { updatedAccounts: BankAccount[] } {
  if (!bankAccounts || bankAccounts.length === 0) {
    return { updatedAccounts: [] };
  }

  const updatedAccounts = bankAccounts.map(acc => {
    let accCopy = { ...acc };

    if (accCopy.corporateCards && accCopy.corporateCards.length > 0 && exp.corporateCardId) {
      accCopy.corporateCards = accCopy.corporateCards.map(c => {
        if (c.id === exp.corporateCardId) {
          const amt = Number(exp.amount) || 0;
          return {
            ...c,
            usedLimit: Math.max(0, (c.usedLimit || 0) - amt),
          };
        }
        return c;
      });
    }

    if (exp.bankAccountId === accCopy.id && exp.status === 'pago') {
      const amt = Number(exp.amount) || 0;
      accCopy.balance = (accCopy.balance || 0) + amt;
    }

    return accCopy;
  });

  return { updatedAccounts };
}
