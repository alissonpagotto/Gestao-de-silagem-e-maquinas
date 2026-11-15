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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-2 sm:p-4 overflow-hidden">
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-transfer-title"
        className="w-[88vw] max-w-[1300px] h-[92vh] max-h-[92vh] bg-[#cad4e6] border border-black rounded-xl shadow-2xl flex flex-col justify-between mx-auto my-auto overflow-hidden"
      >
        {/* CABEÇALHO */}
        <div className="bg-[#cad4e6] border-b border-black px-4 sm:px-5 py-3 flex items-center justify-between shrink-0 text-black">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-white border border-black text-black flex items-center justify-center shrink-0">
              <ArrowLeftRight className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h3 id="modal-transfer-title" className="text-sm sm:text-base font-black text-black uppercase tracking-wide">
                TRANSFERÊNCIA ENTRE CONTAS BANCÁRIAS
              </h3>
              <p className="text-[11px] text-black/80 font-medium uppercase">
                MOVIMENTAÇÃO E CONCILIAÇÃO DE RECURSOS INTERNOS
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-black hover:bg-black/10 transition cursor-pointer"
            title="FECHAR"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* FORMULÁRIO COM ROLAGEM INTERNA E RODAPÉ FIXO */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden bg-[#cad4e6] text-black text-xs">
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-3.5">
          {errorMessage && (
            <div className="p-2.5 bg-rose-100 border border-black rounded-lg flex items-center gap-2 text-rose-800 text-[11px] font-bold uppercase">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* GRID: ORIGEM E DESTINO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* CONTA DE ORIGEM */}
            <div className="space-y-1 p-3.5 rounded-xl border border-black bg-[#e0e6f1]">
              <label htmlFor="source-account-select" className="block text-[10px] font-black text-rose-800 uppercase tracking-wide">
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
            <div className="space-y-1 p-3.5 rounded-xl border border-black bg-[#e0e6f1]">
              <label htmlFor="dest-account-select" className="block text-[10px] font-black text-emerald-800 uppercase tracking-wide">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#e0e6f1] border border-black rounded-xl p-3.5">
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#e0e6f1] border border-black rounded-xl p-3.5">
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
            <div className="p-3.5 bg-[#e0e6f1] rounded-xl border border-black space-y-1.5">
              <div className="text-[10px] font-black text-black uppercase tracking-wider">
                SIMULAÇÃO DE IMPACTO NOS SALDOS BANCÁRIOS
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 bg-white rounded-lg border border-black">
                  <span className="text-[9.5px] font-bold text-rose-700 uppercase block">
                    ORIGEM: {sourceAccount.name}
                  </span>
                  <div className="flex items-center gap-1 font-mono font-bold mt-0.5">
                    <span className="line-through text-slate-500">{formatCurrencyBRL(sourceBalanceCurrent)}</span>
                    <ArrowRight className="w-3 h-3 text-slate-500" />
                    <span className={sourceBalanceAfter < 0 ? 'text-rose-600 font-black' : 'text-black font-black'}>
                      {formatCurrencyBRL(sourceBalanceAfter)}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 bg-white rounded-lg border border-black">
                  <span className="text-[9.5px] font-bold text-emerald-700 uppercase block">
                    DESTINO: {destAccount.name}
                  </span>
                  <div className="flex items-center gap-1 font-mono font-bold mt-0.5">
                    <span className="line-through text-slate-500">{formatCurrencyBRL(destBalanceCurrent)}</span>
                    <ArrowRight className="w-3 h-3 text-slate-500" />
                    <span className="text-emerald-700 font-black">
                      {formatCurrencyBRL(destBalanceAfter)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          </div>

          {/* BOTÕES DE AÇÃO */}
          <div className="px-4 sm:px-5 py-3 flex items-center justify-end gap-2 border-t border-black bg-[#cad4e6] shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white border border-black text-black font-bold hover:bg-slate-100 transition cursor-pointer uppercase text-xs"
            >
              CANCELAR
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 border border-emerald-800 text-white font-black transition cursor-pointer shadow-xs active:scale-95 inline-flex items-center gap-1.5 uppercase text-xs"
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
