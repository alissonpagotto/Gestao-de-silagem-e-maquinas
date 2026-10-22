import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  ArrowDownLeft, 
  Search, 
  AlertCircle, 
  Check, 
  Landmark, 
  Calendar, 
  DollarSign,
  Tag,
  CreditCard,
  Building2,
  Receipt,
  FileCheck2
} from 'lucide-react';
import { BankAccount, PaymentMethod, SilageOrder, ServiceOrder } from '../../types';
import { formatCurrencyBRL, formatDateBR, getStoredOrders, getStoredServices } from '../../lib/storage';

export interface PendingReceivableOption {
  id: string;
  sourceType: 'silage_order' | 'service_order' | 'direct';
  clientName: string;
  description: string;
  date: string;
  dueDate: string;
  amount: number;
}

interface ReceiveTitleQuickModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: BankAccount[];
  defaultAccountId?: string;
  orders?: SilageOrder[];
  services?: ServiceOrder[];
  onConfirmReceipt: (params: {
    receivableId?: string;
    sourceType?: 'silage_order' | 'service_order' | 'direct';
    clientName: string;
    description: string;
    amount: number;
    receiptDate: string;
    bankAccountId: string;
    bankAccountName: string;
    paymentMethod: PaymentMethod;
    documentNumber?: string;
    notes?: string;
  }) => void;
}

export const ReceiveTitleQuickModal: React.FC<ReceiveTitleQuickModalProps> = ({
  isOpen,
  onClose,
  accounts = [],
  defaultAccountId,
  orders = [],
  services = [],
  onConfirmReceipt,
}) => {
  const today = new Date().toISOString().split('T')[0];

  const [mode, setMode] = useState<'pending' | 'direct'>('pending');
  const [selectedReceivableId, setSelectedReceivableId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Campos de liquidação
  const [receiptDate, setReceiptDate] = useState<string>(today);
  const [bankAccountId, setBankAccountId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [documentNumber, setDocumentNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Campos para lançamento direto
  const [directDescription, setDirectDescription] = useState<string>('');
  const [directClient, setDirectClient] = useState<string>('');
  const [directAmountStr, setDirectAmountStr] = useState<string>('');

  // Consolidar títulos a receber pendentes
  const pendingReceivables: PendingReceivableOption[] = useMemo(() => {
    const list: PendingReceivableOption[] = [];

    // 1. Ordens de silagem
    const effectiveOrders = (orders && orders.length > 0) ? orders : getStoredOrders();
    effectiveOrders.forEach((o) => {
      if (o.paymentStatus !== 'pago' && o.totalAmount > 0) {
        list.push({
          id: o.id,
          sourceType: 'silage_order',
          clientName: o.clientName || 'CLIENTE NÃO INFORMADO',
          description: `VENDA DE SILAGEM (${o.tons} TONS)`,
          date: o.date || o.createdAt || today,
          dueDate: o.deliveryDate || o.date || today,
          amount: Number(o.totalAmount) || 0,
        });
      }
    });

    // 2. Ordens de serviço
    const effectiveServices = (services && services.length > 0) ? services : getStoredServices();
    effectiveServices.forEach((s) => {
      const isPaid = (s as any).paymentStatus === 'pago';
      if (!isPaid && (s.totalAmount || 0) > 0) {
        list.push({
          id: s.id,
          sourceType: 'service_order',
          clientName: s.clientName || 'CLIENTE NÃO INFORMADO',
          description: `PRESTAÇÃO DE SERVIÇO (${s.tonsHarvested || 0} TONS / ${s.hoursWorked || 0} HRS)`,
          date: s.date || (s as any).createdAt || today,
          dueDate: s.date || today,
          amount: Number(s.totalAmount) || 0,
        });
      }
    });

    return list;
  }, [orders, services, today]);

  // Filtro de títulos a receber
  const filteredPending = useMemo(() => {
    if (!searchTerm.trim()) return pendingReceivables;
    const q = searchTerm.toLowerCase();
    return pendingReceivables.filter((r) =>
      r.clientName.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q)
    );
  }, [pendingReceivables, searchTerm]);

  // Item selecionado
  const selectedItem = useMemo(() => {
    return pendingReceivables.find(r => r.id === selectedReceivableId);
  }, [pendingReceivables, selectedReceivableId]);

  useEffect(() => {
    if (isOpen) {
      setErrorMessage('');
      setSearchTerm('');
      setReceiptDate(today);
      setPaymentMethod('pix');
      setDocumentNumber('');
      setNotes('');
      setDirectDescription('');
      setDirectClient('');
      setDirectAmountStr('');

      // Conta padrão (prioritária ou primeira)
      const initialAcc = defaultAccountId && accounts.some(a => a.id === defaultAccountId)
        ? defaultAccountId
        : (accounts.find(a => (a as any).isPriority || (a as any).prioritaria)?.id || accounts[0]?.id || '');
      setBankAccountId(initialAcc);

      if (pendingReceivables.length > 0) {
        setMode('pending');
        setSelectedReceivableId(pendingReceivables[0].id);
      } else {
        setMode('direct');
        setSelectedReceivableId('');
      }
    }
  }, [isOpen, defaultAccountId, accounts, pendingReceivables]);

  const selectedAccount = useMemo(() => {
    return accounts.find(a => a.id === bankAccountId);
  }, [accounts, bankAccountId]);

  // Valor a receber efetivo
  const effectiveAmount = useMemo(() => {
    if (mode === 'pending') {
      return selectedItem ? selectedItem.amount : 0;
    } else {
      if (!directAmountStr) return 0;
      const clean = directAmountStr.replace(/[^\d,]/g, '').replace(',', '.');
      return parseFloat(clean) || 0;
    }
  }, [mode, selectedItem, directAmountStr]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!bankAccountId || !selectedAccount) {
      setErrorMessage('SELECIONE A CONTA BANCÁRIA DE DESTINO.');
      return;
    }

    if (!receiptDate) {
      setErrorMessage('INFORME A DATA DO RECEBIMENTO.');
      return;
    }

    if (mode === 'pending') {
      if (!selectedReceivableId || !selectedItem) {
        setErrorMessage('SELECIONE O TÍTULO PENDENTE A SER RECEBIDO.');
        return;
      }

      onConfirmReceipt({
        receivableId: selectedItem.id,
        sourceType: selectedItem.sourceType,
        clientName: selectedItem.clientName.toUpperCase(),
        description: selectedItem.description.toUpperCase(),
        amount: selectedItem.amount,
        receiptDate,
        bankAccountId: selectedAccount.id,
        bankAccountName: selectedAccount.name,
        paymentMethod,
        documentNumber: documentNumber.trim().toUpperCase() || undefined,
        notes: notes.trim().toUpperCase() || undefined,
      });
    } else {
      if (!directClient.trim()) {
        setErrorMessage('INFORME O NOME DO CLIENTE / PAGADOR.');
        return;
      }
      if (!directDescription.trim()) {
        setErrorMessage('INFORME A DESCRIÇÃO DO RECEBIMENTO.');
        return;
      }
      if (effectiveAmount <= 0) {
        setErrorMessage('INFORME UM VALOR VÁLIDO (MAIOR QUE ZERO).');
        return;
      }

      onConfirmReceipt({
        sourceType: 'direct',
        clientName: directClient.trim().toUpperCase(),
        description: directDescription.trim().toUpperCase(),
        amount: effectiveAmount,
        receiptDate,
        bankAccountId: selectedAccount.id,
        bankAccountName: selectedAccount.name,
        paymentMethod,
        documentNumber: documentNumber.trim().toUpperCase() || undefined,
        notes: notes.trim().toUpperCase() || undefined,
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-hidden">
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-receive-title"
        className="w-full max-w-2xl bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-2xl shadow-2xl flex flex-col max-h-[94vh] overflow-hidden"
      >
        {/* CABEÇALHO METÁLICO ACETINADO COM DESTAQUE VERDE PROFISSIONAL */}
        <div className="bg-gradient-to-r from-emerald-950 via-[#1b5e20] to-[#164e28] text-white px-4 py-2.5 flex items-center justify-between shrink-0 shadow-xs border-b border-emerald-900">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center shadow-xs">
              <ArrowDownLeft className="w-4 h-4 stroke-[3]" />
            </div>
            <div>
              <h3 id="modal-receive-title" className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                RECEBER TÍTULO — BAIXA OPERACIONAL
              </h3>
              <p className="text-[10px] text-emerald-200 font-semibold uppercase">
                CRÉDITO BANCÁRIO E LIQUIDAÇÃO DE CONTAS A RECEBER
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-800/80 transition cursor-pointer"
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

          {/* SELETOR DE MODALIDADE */}
          <div className="flex rounded-xl p-0.5 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
            <button
              type="button"
              onClick={() => setMode('pending')}
              className={`flex-1 py-1.5 px-3 rounded-lg font-black text-xs transition cursor-pointer uppercase ${
                mode === 'pending'
                  ? 'bg-white dark:bg-stone-900 text-[#1b5e20] dark:text-emerald-400 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
            >
              SELECIONAR TÍTULO PENDENTE ({pendingReceivables.length})
            </button>
            <button
              type="button"
              onClick={() => setMode('direct')}
              className={`flex-1 py-1.5 px-3 rounded-lg font-black text-xs transition cursor-pointer uppercase ${
                mode === 'direct'
                  ? 'bg-white dark:bg-stone-900 text-[#1b5e20] dark:text-emerald-400 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
            >
              RECEBIMENTO AVULSO / DIRETO
            </button>
          </div>

          {/* MODO 1: SELEÇÃO DE TÍTULO PENDENTE */}
          {mode === 'pending' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="text"
                    placeholder="BUSCAR POR CLIENTE OU TIPO DE SERVIÇO/PRODUTO..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg pl-8 pr-3 py-1.5 font-bold text-stone-900 dark:text-white uppercase outline-none focus:ring-1 focus:ring-[#1b5e20] text-xs"
                  />
                </div>
              </div>

              {filteredPending.length === 0 ? (
                <div className="p-4 text-center rounded-xl border border-dashed border-stone-300 dark:border-stone-700 text-stone-500 uppercase text-[11px] font-bold">
                  NENHUM TÍTULO A RECEBER PENDENTE ENCONTRADO. VOCÊ PODE REGISTRAR UM "RECEBIMENTO AVULSO / DIRETO".
                </div>
              ) : (
                <div className="max-h-40 overflow-y-auto space-y-1 rounded-xl border border-stone-200 dark:border-stone-700 p-1 bg-stone-50/50 dark:bg-stone-850">
                  {filteredPending.map((r) => {
                    const isSelected = r.id === selectedReceivableId;
                    return (
                      <div
                        key={r.id}
                        onClick={() => setSelectedReceivableId(r.id)}
                        className={`p-2 rounded-lg border transition cursor-pointer flex items-center justify-between text-xs ${
                          isSelected
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-950 dark:text-emerald-200'
                            : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 hover:border-emerald-300'
                        }`}
                      >
                        <div className="space-y-0.5 truncate pr-2">
                          <div className="font-black uppercase truncate flex items-center gap-1.5">
                            <span className="text-[11px]">{r.clientName}</span>
                            <span className="text-[9px] px-1 py-0.2 rounded bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300 font-semibold">
                              {r.sourceType === 'silage_order' ? 'SILAGEM' : 'SERVIÇO'}
                            </span>
                          </div>
                          <div className="text-[10px] text-stone-500 dark:text-stone-400 font-semibold uppercase truncate">
                            {r.description} • DATA: {formatDateBR(r.date)}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-mono font-black text-xs text-emerald-700 dark:text-emerald-400 block">
                            {formatCurrencyBRL(r.amount)}
                          </span>
                          {isSelected && (
                            <span className="text-[9px] font-black text-emerald-700 dark:text-emerald-400 uppercase">
                              ✓ SELECIONADO
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* MODO 2: RECEBIMENTO AVULSO / DIRETO */}
          {mode === 'direct' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-850">
              <div className="sm:col-span-2 space-y-1">
                <label htmlFor="direct-client-input" className="block text-[10px] font-black text-stone-700 dark:text-stone-300 uppercase tracking-wide">
                  CLIENTE / PAGADOR *
                </label>
                <input
                  id="direct-client-input"
                  type="text"
                  placeholder="NOME DO CLIENTE OU PAGADOR"
                  value={directClient}
                  onChange={(e) => setDirectClient(e.target.value.toUpperCase())}
                  className="w-full bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg px-2.5 py-1.5 font-bold text-stone-900 dark:text-white uppercase outline-none focus:ring-1 focus:ring-[#1b5e20] text-xs"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="direct-receive-amount-input" className="block text-[10px] font-black text-stone-700 dark:text-stone-300 uppercase tracking-wide">
                  VALOR (R$) *
                </label>
                <input
                  id="direct-receive-amount-input"
                  type="text"
                  placeholder="R$ 0,00"
                  value={directAmountStr}
                  onChange={(e) => {
                    let v = e.target.value.replace(/[^\d]/g, '');
                    if (!v) {
                      setDirectAmountStr('');
                      return;
                    }
                    const num = parseInt(v, 10) / 100;
                    setDirectAmountStr(num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                  }}
                  className="w-full bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg px-2.5 py-1.5 font-black text-stone-900 dark:text-white font-['Outfit'] text-xs focus:ring-1 focus:ring-[#1b5e20] outline-none"
                />
              </div>

              <div className="sm:col-span-3 space-y-1">
                <label htmlFor="direct-receive-desc-input" className="block text-[10px] font-black text-stone-700 dark:text-stone-300 uppercase tracking-wide">
                  HISTÓRICO / DESCRIÇÃO DO RECEBIMENTO *
                </label>
                <input
                  id="direct-receive-desc-input"
                  type="text"
                  placeholder="EX: PAGAMENTO ENTRADA DE SAFRA / PARCELA"
                  value={directDescription}
                  onChange={(e) => setDirectDescription(e.target.value.toUpperCase())}
                  className="w-full bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg px-2.5 py-1.5 font-bold text-stone-900 dark:text-white uppercase outline-none focus:ring-1 focus:ring-[#1b5e20] text-xs"
                />
              </div>
            </div>
          )}

          {/* DADOS DA ENTRADA BANCÁRIA */}
          <div className="space-y-2 pt-1 border-t border-stone-200 dark:border-stone-700">
            <div className="text-[10px] font-black text-stone-500 dark:text-stone-400 uppercase tracking-wider">
              DESTINAÇÃO BANCÁRIA E CONCILIAÇÃO
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* CONTA BANCÁRIA DE DESTINO */}
              <div className="space-y-1">
                <label htmlFor="receive-bank-account-select" className="block text-[10px] font-black text-stone-700 dark:text-stone-300 uppercase tracking-wide">
                  ONDE ENTRA O DINHEIRO (CONTA BANCÁRIA) *
                </label>
                <select
                  id="receive-bank-account-select"
                  value={bankAccountId}
                  onChange={(e) => setBankAccountId(e.target.value)}
                  className="w-full bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg px-2.5 py-1.5 font-bold text-stone-900 dark:text-white uppercase focus:ring-1 focus:ring-[#1b5e20] outline-none text-xs"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.bankName} - {acc.name} ({formatCurrencyBRL(acc.balance)})
                    </option>
                  ))}
                </select>
                {selectedAccount && (
                  <div className="text-[9.5px] text-stone-500 font-semibold uppercase mt-0.5">
                    SALDO ATUAL: <strong className="text-stone-900 dark:text-white">{formatCurrencyBRL(selectedAccount.balance)}</strong>
                  </div>
                )}
              </div>

              {/* FORMA DE RECEBIMENTO */}
              <div className="space-y-1">
                <label htmlFor="receive-method-select" className="block text-[10px] font-black text-stone-700 dark:text-stone-300 uppercase tracking-wide">
                  FORMA DE RECEBIMENTO *
                </label>
                <select
                  id="receive-method-select"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg px-2.5 py-1.5 font-bold text-stone-900 dark:text-white uppercase focus:ring-1 focus:ring-[#1b5e20] outline-none text-xs"
                >
                  <option value="pix">PIX</option>
                  <option value="transferencia">TRANSFERÊNCIA (TED / DOC)</option>
                  <option value="boleto">BOLETO BANCÁRIO</option>
                  <option value="dinheiro">DINHEIRO (ESPÉCIE / CAIXA)</option>
                  <option value="debito">CARTÃO DE DÉBITO</option>
                  <option value="credito">CARTÃO DE CRÉDITO</option>
                  <option value="cheque">CHEQUE</option>
                </select>
              </div>

              {/* DATA DO RECEBIMENTO */}
              <div className="space-y-1">
                <label htmlFor="receive-date-input" className="block text-[10px] font-black text-stone-700 dark:text-stone-300 uppercase tracking-wide">
                  DATA EFETIVA DO CRÉDITO / RECEBIMENTO *
                </label>
                <input
                  id="receive-date-input"
                  type="date"
                  value={receiptDate}
                  onChange={(e) => setReceiptDate(e.target.value)}
                  className="w-full bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg px-2.5 py-1.5 font-bold text-stone-900 dark:text-white uppercase outline-none focus:ring-1 focus:ring-[#1b5e20] text-xs"
                />
              </div>

              {/* Nº DOC / AUTENTICAÇÃO */}
              <div className="space-y-1">
                <label htmlFor="receive-doc-input" className="block text-[10px] font-black text-stone-700 dark:text-stone-300 uppercase tracking-wide">
                  Nº DOCUMENTO / AUTENTICAÇÃO (OPCIONAL)
                </label>
                <input
                  id="receive-doc-input"
                  type="text"
                  placeholder="EX: PIX E2E-99120"
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value.toUpperCase())}
                  className="w-full bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg px-2.5 py-1.5 font-bold text-stone-900 dark:text-white uppercase outline-none text-xs"
                />
              </div>
            </div>

            {/* OBSERVAÇÕES */}
            <div className="space-y-1">
              <label htmlFor="receive-notes-input" className="block text-[10px] font-black text-stone-700 dark:text-stone-300 uppercase tracking-wide">
                OBSERVAÇÕES ADICIONAIS (OPCIONAL)
              </label>
              <input
                id="receive-notes-input"
                type="text"
                placeholder="OBSERVAÇÕES DO RECEBIMENTO"
                value={notes}
                onChange={(e) => setNotes(e.target.value.toUpperCase())}
                className="w-full bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg px-2.5 py-1.5 font-bold text-stone-900 dark:text-white uppercase outline-none text-xs"
              />
            </div>
          </div>

          {/* RESUMO DO VALOR A SER CREDITADO */}
          {effectiveAmount > 0 && selectedAccount && (
            <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black text-emerald-900 dark:text-emerald-300 uppercase block">
                  TOTAL A CREDITAR NA CONTA:
                </span>
                <span className="text-[10px] text-stone-600 dark:text-stone-400 font-semibold uppercase">
                  CONTA: {selectedAccount.name} • NOVO SALDO: {formatCurrencyBRL(selectedAccount.balance + effectiveAmount)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-base sm:text-lg font-black text-[#1b5e20] dark:text-emerald-400 font-['Outfit']">
                  + {formatCurrencyBRL(effectiveAmount)}
                </span>
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
              className="px-4 py-1.5 rounded-lg bg-[#1e5631] hover:bg-[#184627] text-white font-black transition cursor-pointer shadow-xs active:scale-95 inline-flex items-center gap-1.5 uppercase text-xs border border-[#164224]"
            >
              <ArrowDownLeft className="w-3.5 h-3.5 stroke-[3]" />
              <span>CONFIRMAR RECEBIMENTO</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
