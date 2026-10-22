import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  ArrowLeftRight, 
  Landmark, 
  AlertCircle, 
  Check, 
  ArrowRight,
  Wallet
} from 'lucide-react';
import { BankAccount } from '../../types';
import { formatCurrencyBRL } from '../../lib/storage';
import { BankLogoIcon } from './BankLogoIcon';

interface TransferFundsModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: BankAccount[];
  defaultSourceAccountId?: string;
  onTransfer: (params: {
    sourceAccountId: string;
    destAccountId: string;
    amount: number;
    date: string;
    description: string;
    documentNumber?: string;
  }) => void;
}

export const TransferFundsModal: React.FC<TransferFundsModalProps> = ({
  isOpen,
  onClose,
  accounts = [],
  defaultSourceAccountId,
  onTransfer,
}) => {
  const today = new Date().toISOString().split('T')[0];

  const [sourceAccountId, setSourceAccountId] = useState<string>('');
  const [destAccountId, setDestAccountId] = useState<string>('');
  const [amountStr, setAmountStr] = useState<string>('');
  const [date, setDate] = useState<string>(today);
  const [description, setDescription] = useState<string>('TRANSFERÊNCIA DE RECURSOS ENTRE CONTAS');
  const [documentNumber, setDocumentNumber] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setErrorMessage('');
      setDate(today);
      setDescription('TRANSFERÊNCIA DE RECURSOS ENTRE CONTAS');
      setAmountStr('');
      setDocumentNumber('');

      // Define conta de origem padrão
      const initialSource = defaultSourceAccountId && accounts.some(a => a.id === defaultSourceAccountId)
        ? defaultSourceAccountId
        : (accounts[0]?.id || '');
      setSourceAccountId(initialSource);

      // Define conta de destino diferente da origem
      const initialDest = accounts.find(a => a.id !== initialSource)?.id || '';
      setDestAccountId(initialDest);
    }
  }, [isOpen, defaultSourceAccountId, accounts]);

  const sourceAccount = useMemo(() => {
    return accounts.find(a => a.id === sourceAccountId);
  }, [accounts, sourceAccountId]);

  const destAccount = useMemo(() => {
    return accounts.find(a => a.id === destAccountId);
  }, [accounts, destAccountId]);

  // Contas disponíveis para destino (excluindo a origem)
  const availableDestAccounts = useMemo(() => {
    return accounts.filter(a => a.id !== sourceAccountId);
  }, [accounts, sourceAccountId]);

  // Parse do valor numérico
  const numericAmount = useMemo(() => {
    if (!amountStr) return 0;
    const clean = amountStr.replace(/[^\d,]/g, '').replace(',', '.');
    return parseFloat(clean) || 0;
  }, [amountStr]);

  // Simulação de saldos
  const sourceBalanceCurrent = sourceAccount?.balance ?? 0;
  const sourceOverdraft = sourceAccount?.overdraftLimit ?? 0;
  const sourceAvailable = sourceBalanceCurrent + sourceOverdraft;
  const sourceBalanceAfter = sourceBalanceCurrent - numericAmount;

  const destBalanceCurrent = destAccount?.balance ?? 0;
  const destBalanceAfter = destBalanceCurrent + numericAmount;

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!sourceAccountId || !sourceAccount) {
      setErrorMessage('SELECIONE A CONTA DE ORIGEM.');
      return;
    }

    if (!destAccountId || !destAccount) {
      setErrorMessage('SELECIONE A CONTA DE DESTINO.');
      return;
    }

    if (sourceAccountId === destAccountId) {
      setErrorMessage('A CONTA DE DESTINO DEVE SER DIFERENTE DA CONTA DE ORIGEM.');
      return;
    }

    if (numericAmount <= 0) {
      setErrorMessage('INFORME UM VALOR VÁLIDO PARA A TRANSFERÊNCIA (MAIOR QUE ZERO).');
      return;
    }

    if (numericAmount > sourceAvailable) {
      setErrorMessage(`SALDO INSUFICIENTE NA CONTA DE ORIGEM. DISPONÍVEL (COM LIMITE): ${formatCurrencyBRL(sourceAvailable)}`);
      return;
    }

    if (!date) {
      setErrorMessage('INFORME A DATA DA TRANSFERÊNCIA.');
      return;
    }

    onTransfer({
      sourceAccountId,
      destAccountId,
      amount: numericAmount,
      date,
      description: description.trim().toUpperCase() || 'TRANSFERÊNCIA ENTRE CONTAS BANCÁRIAS',
      documentNumber: documentNumber.trim().toUpperCase() || undefined,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-hidden">
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-transfer-title"
        className="w-full max-w-xl bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
      >
        {/* CABEÇALHO METÁLICO ACETINADO */}
        <div className="bg-gradient-to-r from-stone-100 via-stone-200 to-stone-100 dark:from-stone-800 dark:via-stone-750 dark:to-stone-800 border-b border-stone-300 dark:border-stone-700 px-4 py-2.5 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-stone-700 text-white flex items-center justify-center shadow-xs">
              <ArrowLeftRight className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h3 id="modal-transfer-title" className="text-xs sm:text-sm font-black text-stone-900 dark:text-white uppercase tracking-wider">
                TRANSFERÊNCIA ENTRE CONTAS BANCÁRIAS
              </h3>
              <p className="text-[10px] text-stone-600 dark:text-stone-300 font-semibold uppercase">
                MOVIMENTAÇÃO E CONCILIAÇÃO DE RECURSOS INTERNOS
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-stone-500 hover:text-stone-900 dark:hover:text-white hover:bg-stone-200 dark:hover:bg-stone-700 transition cursor-pointer"
            title="FECHAR"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* FORMULÁRIO COM ROLAGEM INTERNA */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
          {errorMessage && (
            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-lg flex items-center gap-2 text-rose-700 dark:text-rose-300 text-[11px] font-bold uppercase">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* GRID: ORIGEM E DESTINO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* CONTA DE ORIGEM */}
            <div className="space-y-1 p-2.5 rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/30 dark:bg-rose-950/10">
              <label htmlFor="source-account-select" className="block text-[10px] font-black text-rose-800 dark:text-rose-300 uppercase tracking-wide">
                DE ONDE SAI O DINHEIRO (CONTA DE ORIGEM) *
              </label>
              <select
                id="source-account-select"
                value={sourceAccountId}
                onChange={(e) => {
                  const newSource = e.target.value;
                  setSourceAccountId(newSource);
                  if (newSource === destAccountId) {
                    const fallbackDest = accounts.find(a => a.id !== newSource)?.id || '';
                    setDestAccountId(fallbackDest);
                  }
                }}
                className="w-full bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg px-2.5 py-1.5 font-bold text-stone-900 dark:text-white uppercase focus:ring-1 focus:ring-rose-500 outline-none text-xs"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.bankName} - {acc.name} ({formatCurrencyBRL(acc.balance)})
                  </option>
                ))}
              </select>
              {sourceAccount && (
                <div className="text-[10px] text-stone-600 dark:text-stone-400 font-semibold uppercase mt-1">
                  SALDO ATUAL: <strong className={sourceAccount.balance < 0 ? 'text-rose-600 font-black' : 'text-stone-900 dark:text-white font-black'}>{formatCurrencyBRL(sourceAccount.balance)}</strong>
                  {sourceAccount.overdraftLimit > 0 && (
                    <span className="text-emerald-700 dark:text-emerald-400"> (LIMITE: {formatCurrencyBRL(sourceAccount.overdraftLimit)})</span>
                  )}
                </div>
              )}
            </div>

            {/* CONTA DE DESTINO */}
            <div className="space-y-1 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/30 dark:bg-emerald-950/10">
              <label htmlFor="dest-account-select" className="block text-[10px] font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">
                ONDE ENTRA O DINHEIRO (CONTA DE DESTINO) *
              </label>
              <select
                id="dest-account-select"
                value={destAccountId}
                onChange={(e) => setDestAccountId(e.target.value)}
                className="w-full bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg px-2.5 py-1.5 font-bold text-stone-900 dark:text-white uppercase focus:ring-1 focus:ring-emerald-500 outline-none text-xs"
              >
                <option value="">SELECIONE A CONTA DE DESTINO</option>
                {availableDestAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.bankName} - {acc.name} ({formatCurrencyBRL(acc.balance)})
                  </option>
                ))}
              </select>
              {destAccount && (
                <div className="text-[10px] text-stone-600 dark:text-stone-400 font-semibold uppercase mt-1">
                  SALDO ATUAL: <strong className={destAccount.balance < 0 ? 'text-rose-600 font-black' : 'text-stone-900 dark:text-white font-black'}>{formatCurrencyBRL(destAccount.balance)}</strong>
                </div>
              )}
            </div>
          </div>

          {/* GRID: VALOR E DATA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="transfer-amount-input" className="block text-[10.5px] font-black text-stone-700 dark:text-stone-300 uppercase tracking-wide">
                VALOR DA TRANSFERÊNCIA (R$) *
              </label>
              <input
                id="transfer-amount-input"
                type="text"
                placeholder="R$ 0,00"
                value={amountStr}
                onChange={(e) => {
                  let v = e.target.value.replace(/[^\d]/g, '');
                  if (!v) {
                    setAmountStr('');
                    return;
                  }
                  const num = parseInt(v, 10) / 100;
                  setAmountStr(num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                }}
                className="w-full bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg px-3 py-1.5 font-black text-stone-900 dark:text-white font-['Outfit'] text-sm focus:ring-1 focus:ring-stone-600 outline-none"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="transfer-date-input" className="block text-[10.5px] font-black text-stone-700 dark:text-stone-300 uppercase tracking-wide">
                DATA DA TRANSFERÊNCIA *
              </label>
              <input
                id="transfer-date-input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg px-2.5 py-1.5 font-bold text-stone-900 dark:text-white outline-none focus:ring-1 focus:ring-stone-600 uppercase text-xs"
              />
            </div>
          </div>

          {/* DESCRIÇÃO E DOCUMENTO */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label htmlFor="transfer-desc-input" className="block text-[10.5px] font-black text-stone-700 dark:text-stone-300 uppercase tracking-wide">
                HISTÓRICO / IDENTIFICAÇÃO DA MOVIMENTAÇÃO
              </label>
              <input
                id="transfer-desc-input"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value.toUpperCase())}
                placeholder="EX: TRANSFERÊNCIA DE RECURSOS ENTRE CONTAS"
                className="w-full bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg px-3 py-1.5 font-bold text-stone-900 dark:text-white uppercase outline-none focus:ring-1 focus:ring-stone-600 text-xs"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="transfer-doc-input" className="block text-[10.5px] font-black text-stone-700 dark:text-stone-300 uppercase tracking-wide">
                Nº DOC / COMPROVANTE (OPCIONAL)
              </label>
              <input
                id="transfer-doc-input"
                type="text"
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value.toUpperCase())}
                placeholder="EX: TED 948102"
                className="w-full bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg px-2.5 py-1.5 font-bold text-stone-900 dark:text-white uppercase outline-none focus:ring-1 focus:ring-stone-600 text-xs"
              />
            </div>
          </div>

          {/* SIMULAÇÃO DE SALDOS PÓS-TRANSFERÊNCIA */}
          {numericAmount > 0 && sourceAccount && destAccount && (
            <div className="p-3 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700 space-y-1.5">
              <div className="text-[10px] font-black text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                SIMULAÇÃO DE IMPACTO NOS SALDOS BANCÁRIOS
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-750">
                  <span className="text-[9.5px] font-bold text-rose-700 dark:text-rose-400 uppercase block">
                    ORIGEM: {sourceAccount.name}
                  </span>
                  <div className="flex items-center gap-1 font-mono font-bold mt-0.5">
                    <span className="line-through text-stone-400">{formatCurrencyBRL(sourceBalanceCurrent)}</span>
                    <ArrowRight className="w-3 h-3 text-stone-400" />
                    <span className={sourceBalanceAfter < 0 ? 'text-rose-600 font-black' : 'text-stone-900 dark:text-white font-black'}>
                      {formatCurrencyBRL(sourceBalanceAfter)}
                    </span>
                  </div>
                </div>

                <div className="p-2 bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-750">
                  <span className="text-[9.5px] font-bold text-emerald-700 dark:text-emerald-400 uppercase block">
                    DESTINO: {destAccount.name}
                  </span>
                  <div className="flex items-center gap-1 font-mono font-bold mt-0.5">
                    <span className="line-through text-stone-400">{formatCurrencyBRL(destBalanceCurrent)}</span>
                    <ArrowRight className="w-3 h-3 text-stone-400" />
                    <span className="text-emerald-700 dark:text-emerald-400 font-black">
                      {formatCurrencyBRL(destBalanceAfter)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* BOTÕES DE AÇÃO */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-stone-200 dark:border-stone-700">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 font-bold hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer uppercase text-xs"
            >
              CANCELAR
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-stone-900 hover:bg-black text-white font-black transition cursor-pointer shadow-xs active:scale-95 inline-flex items-center gap-1.5 uppercase text-xs"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>CONFIRMAR TRANSFERÊNCIA</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
