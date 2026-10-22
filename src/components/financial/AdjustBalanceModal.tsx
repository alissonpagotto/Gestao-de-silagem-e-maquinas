import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  SlidersHorizontal, 
  AlertCircle, 
  Check, 
  ArrowRight,
  Landmark,
  Scale
} from 'lucide-react';
import { BankAccount } from '../../types';
import { formatCurrencyBRL } from '../../lib/storage';

interface AdjustBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: BankAccount[];
  defaultAccountId?: string;
  onAdjustBalance: (params: {
    accountId: string;
    newBalance: number;
    difference: number;
    date: string;
    reason: string;
    notes?: string;
  }) => void;
}

export const AdjustBalanceModal: React.FC<AdjustBalanceModalProps> = ({
  isOpen,
  onClose,
  accounts = [],
  defaultAccountId,
  onAdjustBalance,
}) => {
  const today = new Date().toISOString().split('T')[0];

  const [accountId, setAccountId] = useState<string>('');
  const [adjustMode, setAdjustMode] = useState<'set_total' | 'diff'>('set_total');
  const [amountStr, setAmountStr] = useState<string>('');
  const [diffType, setDiffType] = useState<'credit' | 'debit'>('credit');
  const [date, setDate] = useState<string>(today);
  const [reason, setReason] = useState<string>('CONCILIAÇÃO BANCÁRIA');
  const [notes, setNotes] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setErrorMessage('');
      setDate(today);
      setReason('CONCILIAÇÃO BANCÁRIA');
      setNotes('');
      setAmountStr('');
      setAdjustMode('set_total');
      setDiffType('credit');

      const initialAcc = defaultAccountId && accounts.some(a => a.id === defaultAccountId)
        ? defaultAccountId
        : (accounts[0]?.id || '');
      setAccountId(initialAcc);
    }
  }, [isOpen, defaultAccountId, accounts]);

  const selectedAccount = useMemo(() => {
    return accounts.find(a => a.id === accountId);
  }, [accounts, accountId]);

  const currentBalance = selectedAccount?.balance ?? 0;

  // Valor numérico digitado
  const numericAmount = useMemo(() => {
    if (!amountStr) return 0;
    const clean = amountStr.replace(/[^\d,]/g, '').replace(',', '.');
    return parseFloat(clean) || 0;
  }, [amountStr]);

  // Cálculo do novo saldo e diferença dependendo do modo
  const { calculatedNewBalance, difference } = useMemo(() => {
    if (adjustMode === 'set_total') {
      const newBal = numericAmount;
      const diff = newBal - currentBalance;
      return { calculatedNewBalance: newBal, difference: diff };
    } else {
      const diff = diffType === 'credit' ? numericAmount : -numericAmount;
      const newBal = currentBalance + diff;
      return { calculatedNewBalance: newBal, difference: diff };
    }
  }, [adjustMode, numericAmount, currentBalance, diffType]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!accountId || !selectedAccount) {
      setErrorMessage('SELECIONE UMA CONTA BANCÁRIA PARA AJUSTE.');
      return;
    }

    if (!amountStr) {
      setErrorMessage('INFORME O VALOR DO AJUSTE OU O NOVO SALDO DA CONTA.');
      return;
    }

    if (Math.abs(difference) < 0.001) {
      setErrorMessage('O NOVO SALDO É IDÊNTICO AO SALDO ATUAL. NÃO HÁ DIFERENÇA A AJUSTAR.');
      return;
    }

    if (!reason.trim()) {
      setErrorMessage('INFORME O MOTIVO OU JUSTIFICATIVA DO AJUSTE DE SALDO.');
      return;
    }

    if (!date) {
      setErrorMessage('INFORME A DATA DO AJUSTE.');
      return;
    }

    onAdjustBalance({
      accountId,
      newBalance: calculatedNewBalance,
      difference,
      date,
      reason: reason.trim().toUpperCase(),
      notes: notes.trim().toUpperCase() || undefined,
    });

    onClose();
  };

  const QUICK_REASONS = [
    'CONCILIAÇÃO BANCÁRIA',
    'TARIFAS / TAXAS BANCÁRIAS',
    'RENDIMENTO DE APLICAÇÃO',
    'CORREÇÃO DE SALDO INICIAL',
    'DIFERENÇA DE CENTAVOS / ARREDONDAMENTO'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-hidden">
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-adjust-title"
        className="w-full max-w-xl bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
      >
        {/* CABEÇALHO METÁLICO ACETINADO */}
        <div className="bg-gradient-to-r from-stone-100 via-stone-200 to-stone-100 dark:from-stone-800 dark:via-stone-750 dark:to-stone-800 border-b border-stone-300 dark:border-stone-700 px-4 py-2.5 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-stone-700 text-white flex items-center justify-center shadow-xs">
              <SlidersHorizontal className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h3 id="modal-adjust-title" className="text-xs sm:text-sm font-black text-stone-900 dark:text-white uppercase tracking-wider">
                AJUSTE DE SALDO BANCÁRIO / CONCILIAÇÃO
              </h3>
              <p className="text-[10px] text-stone-600 dark:text-stone-300 font-semibold uppercase">
                RECONCILIAÇÃO CONTÁBIL E EQUALIZAÇÃO DE EXTRATO
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

          {/* SELEÇÃO DA CONTA */}
          <div className="space-y-1">
            <label htmlFor="adjust-account-select" className="block text-[10.5px] font-black text-stone-700 dark:text-stone-300 uppercase tracking-wide">
              CONTA BANCÁRIA A SER AJUSTADA *
            </label>
            <select
              id="adjust-account-select"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg px-2.5 py-1.5 font-bold text-stone-900 dark:text-white uppercase focus:ring-1 focus:ring-stone-600 outline-none text-xs"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.bankName} - {acc.name} (SALDO ATUAL: {formatCurrencyBRL(acc.balance)})
                </option>
              ))}
            </select>
            {selectedAccount && (
              <div className="text-[10.5px] text-stone-600 dark:text-stone-400 font-semibold uppercase mt-1 p-2 bg-stone-50 dark:bg-stone-800 rounded-lg border border-stone-200 dark:border-stone-700 flex items-center justify-between">
                <span>SALDO REGISTRADO NO SISTEMA:</span>
                <strong className={currentBalance < 0 ? 'text-rose-600 font-black' : 'text-stone-900 dark:text-white font-black'}>
                  {formatCurrencyBRL(currentBalance)}
                </strong>
              </div>
            )}
          </div>

          {/* MODO DE AJUSTE */}
          <div className="space-y-1.5">
            <span className="block text-[10.5px] font-black text-stone-700 dark:text-stone-300 uppercase tracking-wide">
              MODALIDADE DO AJUSTE *
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAdjustMode('set_total')}
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                  adjustMode === 'set_total'
                    ? 'border-stone-900 bg-stone-900 text-white shadow-xs'
                    : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:bg-stone-50'
                }`}
              >
                <div className="font-black text-[10.5px] uppercase">NOVO SALDO REAL</div>
                <div className={`text-[9.5px] mt-0.5 uppercase ${adjustMode === 'set_total' ? 'text-stone-300' : 'text-stone-500'}`}>
                  DIGITAR O SALDO FINAL DO EXTRATO
                </div>
              </button>

              <button
                type="button"
                onClick={() => setAdjustMode('diff')}
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                  adjustMode === 'diff'
                    ? 'border-stone-900 bg-stone-900 text-white shadow-xs'
                    : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:bg-stone-50'
                }`}
              >
                <div className="font-black text-[10.5px] uppercase">LANÇAR DIFERENÇA</div>
                <div className={`text-[9.5px] mt-0.5 uppercase ${adjustMode === 'diff' ? 'text-stone-300' : 'text-stone-500'}`}>
                  ACRESCENTAR (+) OU DEDUZIR (-) VALOR
                </div>
              </button>
            </div>
          </div>

          {/* ENTRADA DE VALORES */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {adjustMode === 'set_total' ? (
              <div className="space-y-1">
                <label htmlFor="adjust-real-balance-input" className="block text-[10.5px] font-black text-stone-700 dark:text-stone-300 uppercase tracking-wide">
                  NOVO SALDO CONSOLIDADO DO BANCO (R$) *
                </label>
                <input
                  id="adjust-real-balance-input"
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
            ) : (
              <div className="space-y-1">
                <label htmlFor="adjust-diff-input" className="block text-[10.5px] font-black text-stone-700 dark:text-stone-300 uppercase tracking-wide">
                  VALOR DO AJUSTE (R$) *
                </label>
                <div className="flex gap-1.5">
                  <div className="flex rounded-lg border border-stone-300 dark:border-stone-700 overflow-hidden shrink-0">
                    <button
                      type="button"
                      onClick={() => setDiffType('credit')}
                      className={`px-2.5 py-1 text-xs font-black cursor-pointer uppercase ${
                        diffType === 'credit'
                          ? 'bg-emerald-700 text-white'
                          : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                      }`}
                    >
                      + CRÉDITO
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiffType('debit')}
                      className={`px-2.5 py-1 text-xs font-black cursor-pointer uppercase ${
                        diffType === 'debit'
                          ? 'bg-rose-700 text-white'
                          : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                      }`}
                    >
                      - DÉBITO
                    </button>
                  </div>
                  <input
                    id="adjust-diff-input"
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
                    className="flex-1 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg px-3 py-1.5 font-black text-stone-900 dark:text-white font-['Outfit'] text-sm focus:ring-1 focus:ring-stone-600 outline-none"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label htmlFor="adjust-date-input" className="block text-[10.5px] font-black text-stone-700 dark:text-stone-300 uppercase tracking-wide">
                DATA EFETIVA DO AJUSTE *
              </label>
              <input
                id="adjust-date-input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg px-2.5 py-1.5 font-bold text-stone-900 dark:text-white outline-none focus:ring-1 focus:ring-stone-600 uppercase text-xs"
              />
            </div>
          </div>

          {/* MOTIVO / JUSTIFICATIVA */}
          <div className="space-y-1.5">
            <label htmlFor="adjust-reason-input" className="block text-[10.5px] font-black text-stone-700 dark:text-stone-300 uppercase tracking-wide">
              MOTIVO / JUSTIFICATIVA DA OPERAÇÃO *
            </label>
            <div className="flex flex-wrap gap-1">
              {QUICK_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full border transition cursor-pointer uppercase ${
                    reason === r
                      ? 'bg-stone-800 text-white border-stone-800'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:bg-stone-200'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <input
              id="adjust-reason-input"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value.toUpperCase())}
              placeholder="JUSTIFICATIVA DETALHADA DO AJUSTE"
              className="w-full bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg px-3 py-1.5 font-bold text-stone-900 dark:text-white uppercase outline-none focus:ring-1 focus:ring-stone-600 text-xs"
            />
          </div>

          {/* OBSERVAÇÕES ADICIONAIS */}
          <div className="space-y-1">
            <label htmlFor="adjust-notes-input" className="block text-[10.5px] font-black text-stone-700 dark:text-stone-300 uppercase tracking-wide">
              OBSERVAÇÕES ADICIONAIS / NOTAS CONTÁBEIS (OPCIONAL)
            </label>
            <input
              id="adjust-notes-input"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value.toUpperCase())}
              placeholder="EX: CONCILIADO COM EXTRATO DE OUTUBRO/2026"
              className="w-full bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg px-3 py-1.5 font-bold text-stone-900 dark:text-white uppercase outline-none focus:ring-1 focus:ring-stone-600 text-xs"
            />
          </div>

          {/* IMPACTO APURADO */}
          {numericAmount > 0 && selectedAccount && (
            <div className="p-3 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700 space-y-1.5">
              <div className="text-[10px] font-black text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                RESUMO DO AJUSTE NO SALDO BANCÁRIO
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-750">
                  <span className="text-[9.5px] font-bold text-stone-500 uppercase block">
                    EVOLUÇÃO DO SALDO:
                  </span>
                  <div className="flex items-center gap-1 font-mono font-bold mt-0.5">
                    <span className="line-through text-stone-400">{formatCurrencyBRL(currentBalance)}</span>
                    <ArrowRight className="w-3 h-3 text-stone-400" />
                    <span className={calculatedNewBalance < 0 ? 'text-rose-600 font-black' : 'text-stone-900 dark:text-white font-black'}>
                      {formatCurrencyBRL(calculatedNewBalance)}
                    </span>
                  </div>
                </div>

                <div className="p-2 bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-750">
                  <span className="text-[9.5px] font-bold text-stone-500 uppercase block">
                    LANÇAMENTO CONTÁBIL:
                  </span>
                  <div className="font-mono font-black mt-0.5">
                    <span className={difference >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600'}>
                      {difference >= 0 ? `+ ${formatCurrencyBRL(difference)} (CRÉDITO)` : `- ${formatCurrencyBRL(Math.abs(difference))} (DÉBITO)`}
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
              <SlidersHorizontal className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>CONFIRMAR AJUSTE DE SALDO</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
