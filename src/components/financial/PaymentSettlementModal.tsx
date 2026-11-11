import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Check,
  AlertCircle,
  Calendar,
  UserCheck,
  Building2,
  Landmark,
  FileCheck2,
  Clock,
  WalletCards,
  ArrowUpRight,
  Search,
  Info,
} from 'lucide-react';
import { Expense, BankAccount, Employee, PaymentMethod, FinanceiroCheque } from '../../types';
import {
  formatCurrencyBRL,
  formatDateBR,
  getStoredFinanceiroCheques,
  saveStoredFinanceiroCheques,
} from '../../lib/storage';
import { fetchFinanceiroCheques, saveFinanceiroCheque } from '../../lib/supabaseService';
import { BankLogoIcon } from './BankLogoIcon';

export interface PaymentSettlementData {
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
}

interface PaymentSettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  expense: Expense | null;
  bankAccounts: BankAccount[];
  employees: Employee[];
  onConfirmSettlement: (params: {
    expenseId: string;
    paymentDate: string;
    paidByEmployeeId: string;
    paidByEmployeeName: string;
    bankAccountId: string;
    bankAccountName: string;
    creditSupplier: string;
    paymentMethod: PaymentMethod;
    authenticationCode?: string;
    notes?: string;
    chequeOrigin?: 'proprio' | 'terceiros';
    checkNumber?: string;
    chequeGoodForDate?: string;
    usedChequeIds?: string[];
    usedChequesSummary?: string;
  }) => void;
}

const PAYMENT_METHOD_OPTIONS: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'assinado_nota', label: 'Assinado Nota' },
  { value: 'boleto', label: 'Boleto Bancário' },
  { value: 'cartao_credito', label: 'Cartão de Crédito' },
  { value: 'cartao_debito', label: 'Cartão de Débito' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'dinheiro', label: 'Dinheiro em Espécie (Caixa)' },
  { value: 'pix', label: 'PIX' },
  { value: 'safra_prazo', label: 'Safra / A Prazo' },
  { value: 'transferencia', label: 'Transferência (TED / DOC)' },
];

export const PaymentSettlementModal: React.FC<PaymentSettlementModalProps> = ({
  isOpen,
  onClose,
  expense,
  bankAccounts = [],
  employees = [],
  onConfirmSettlement,
}) => {
  const today = new Date().toISOString().split('T')[0];

  const [paymentDate, setPaymentDate] = useState(today);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [customEmployeeName, setCustomEmployeeName] = useState('');
  const [selectedBankAccountId, setSelectedBankAccountId] = useState('');
  const [creditSupplier, setCreditSupplier] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [authenticationCode, setAuthenticationCode] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Estados específicos para Cheque
  const [chequeOrigin, setChequeOrigin] = useState<'proprio' | 'terceiros'>('proprio');
  const [ownChequeNumber, setOwnChequeNumber] = useState('');
  const [ownChequeGoodForDate, setOwnChequeGoodForDate] = useState(today);
  const [custodyCheques, setCustodyCheques] = useState<FinanceiroCheque[]>(() =>
    getStoredFinanceiroCheques()
  );
  const [selectedCustodyChequeIds, setSelectedCustodyChequeIds] = useState<string[]>([]);
  const [chequeSearch, setChequeSearch] = useState('');

  const initializedKeyRef = useRef<string | null>(null);

  // Sincroniza cheques da custódia ao abrir o modal e via eventos globais
  useEffect(() => {
    if (!isOpen) return;

    const refreshCustody = () => {
      setCustodyCheques(getStoredFinanceiroCheques());
    };

    refreshCustody();
    fetchFinanceiroCheques()
      .then((list) => {
        if (Array.isArray(list)) setCustodyCheques(list);
      })
      .catch(() => {});

    window.addEventListener('financeiro_cheques_updated', refreshCustody);
    window.addEventListener('storage', refreshCustody);
    return () => {
      window.removeEventListener('financeiro_cheques_updated', refreshCustody);
      window.removeEventListener('storage', refreshCustody);
    };
  }, [isOpen]);

  // Sincroniza formulário ao abrir o modal
  useEffect(() => {
    if (!isOpen || !expense) {
      initializedKeyRef.current = null;
      return;
    }

    const currentKey = `${expense.id}_${isOpen}`;
    if (initializedKeyRef.current === currentKey) {
      return;
    }
    initializedKeyRef.current = currentKey;

    setErrorMessage('');
    setPaymentDate(today);

    // Inicializa Fornecedor do Crédito
    setCreditSupplier(expense.creditSupplier || expense.supplier || '');

    // Método de pagamento configurado
    if (expense.paymentMethod && PAYMENT_METHOD_OPTIONS.some((m) => m.value === expense.paymentMethod)) {
      setPaymentMethod(expense.paymentMethod);
    } else {
      setPaymentMethod('pix');
    }

    // Campos de Cheque
    setChequeOrigin(expense.chequeOrigin || 'proprio');
    setOwnChequeNumber(expense.checkNumber || '');
    setOwnChequeGoodForDate(expense.chequeGoodForDate || expense.dueDate || expense.date || today);
    setSelectedCustodyChequeIds(expense.usedChequeIds || []);
    setChequeSearch('');

    // Se já havia funcionário pré-vinculado
    if (expense.employeeId) {
      setSelectedEmployeeId(expense.employeeId);
      setCustomEmployeeName(expense.employeeName || '');
    } else if (expense.paidByEmployeeId) {
      setSelectedEmployeeId(expense.paidByEmployeeId);
      setCustomEmployeeName(expense.paidByEmployeeName || '');
    } else {
      setSelectedEmployeeId('');
      setCustomEmployeeName('');
    }

    // Seleção de conta bancária padrão
    if (expense.bankAccountId && bankAccounts.some((a) => a.id === expense.bankAccountId)) {
      setSelectedBankAccountId(expense.bankAccountId);
    } else if (bankAccounts.length > 0) {
      setSelectedBankAccountId(bankAccounts[0].id);
    } else {
      setSelectedBankAccountId('');
    }

    setAuthenticationCode(expense.paymentAuthenticationCode || '');
    setNotes(expense.notes || '');
  }, [isOpen, expense?.id]);

  // Lista de funcionários ativos
  const activeEmployees = useMemo(() => {
    return employees.filter((e) => e.active !== false);
  }, [employees]);

  // Conta bancária selecionada
  const selectedAccount = useMemo(() => {
    return bankAccounts.find((a) => a.id === selectedBankAccountId);
  }, [bankAccounts, selectedBankAccountId]);

  // Cheques disponíveis em carteira ("EM_NOSSO_PODER")
  const availableCustodyCheques = useMemo(() => {
    const inWallet = custodyCheques.filter((c) => c.status === 'EM_NOSSO_PODER');
    const q = chequeSearch.trim().toLowerCase();
    if (!q) return inWallet;
    return inWallet.filter((c) => {
      const num = (c.numero_cheque || c.numeroCheque || '').toLowerCase();
      const emitente = (c.emitente_nome || c.emitenteNome || '').toLowerCase();
      const banco = (c.banco || '').toLowerCase();
      const cliente = (c.cliente_nome || c.clienteNome || '').toLowerCase();
      return num.includes(q) || emitente.includes(q) || banco.includes(q) || cliente.includes(q);
    });
  }, [custodyCheques, chequeSearch]);

  const selectedCustodyCheques = useMemo(() => {
    const idSet = new Set(selectedCustodyChequeIds);
    return custodyCheques.filter((c) => idSet.has(c.id));
  }, [custodyCheques, selectedCustodyChequeIds]);

  const selectedCustodyTotal = useMemo(() => {
    return selectedCustodyCheques.reduce((acc, c) => acc + (Number(c.valor) || 0), 0);
  }, [selectedCustodyCheques]);

  const isThirdPartyCheque = paymentMethod === 'cheque' && chequeOrigin === 'terceiros';
  const isOwnCheque = paymentMethod === 'cheque' && chequeOrigin === 'proprio';

  // Saldo após o débito calculado
  const accountBalanceBefore = selectedAccount?.balance ?? 0;
  const expenseAmount = expense?.amount ?? 0;
  const accountBalanceAfter = accountBalanceBefore - expenseAmount;

  // Análise de vencimento
  const dueDate = expense?.dueDate || expense?.date || '';
  const isOverdue = useMemo(() => {
    if (!dueDate || !paymentDate) return false;
    return paymentDate > dueDate;
  }, [dueDate, paymentDate]);

  if (!isOpen || !expense) return null;

  const toggleCustodyCheque = (chequeId: string) => {
    setErrorMessage('');
    setSelectedCustodyChequeIds((prev) =>
      prev.includes(chequeId) ? prev.filter((id) => id !== chequeId) : [...prev, chequeId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    // Validação 1: Data de pagamento
    if (!paymentDate) {
      setErrorMessage('Informe a data efetiva do pagamento.');
      return;
    }

    // Validação 2: Regras específicas de Cheque
    if (isOwnCheque) {
      if (!ownChequeNumber.trim()) {
        setErrorMessage('Informe obrigatoriamente o "Número do Cheque Emitido".');
        return;
      }
      if (!ownChequeGoodForDate) {
        setErrorMessage('Informe obrigatoriamente a "Data de Bom Para / Compensação" do cheque.');
        return;
      }
    }

    if (isThirdPartyCheque) {
      if (selectedCustodyChequeIds.length === 0) {
        setErrorMessage('Selecione pelo menos um cheque de terceiros da Custódia ("Em Carteira") para realizar o repasse.');
        return;
      }
    }

    // Validação 3: Qual Banco (apenas quando NÃO for Cheque de Terceiros)
    if (!isThirdPartyCheque) {
      if (!selectedBankAccountId || !selectedAccount) {
        setErrorMessage('Selecione obrigatoriamente "Qual Banco" (Conta Bancária de onde sairá o dinheiro).');
        return;
      }
    }

    // Validação 4: Qual o Fornecedor do Crédito
    if (!creditSupplier.trim()) {
      setErrorMessage('Informe obrigatoriamente "Qual o Fornecedor do Crédito" para efetuar o pagamento.');
      return;
    }

    // Validação 5: Identificação do Responsável ("quem fez o pagamento")
    let employeeName = '';
    const employeeId = selectedEmployeeId;

    if (selectedEmployeeId === 'outro') {
      if (!customEmployeeName.trim()) {
        setErrorMessage('Por favor, digite o nome do responsável que efetuou o pagamento.');
        return;
      }
      employeeName = customEmployeeName.trim();
    } else if (selectedEmployeeId) {
      const found = employees.find((emp) => emp.id === selectedEmployeeId);
      employeeName = found?.name || 'Funcionário';
    } else {
      setErrorMessage('Identifique obrigatoriamente qual funcionário realizou o pagamento.');
      return;
    }

    const resolvedSupplier = creditSupplier.trim();
    let finalCheckNumber = isOwnCheque ? ownChequeNumber.trim() : undefined;
    let finalSummary = '';
    let finalNotes = notes.trim() || undefined;

    // Gatilho de Repasse na Custódia de Cheques (Cheque de Terceiros)
    if (isThirdPartyCheque) {
      const usedCheques = custodyCheques.filter((c) => selectedCustodyChequeIds.includes(c.id));
      const chequeNums = usedCheques.map((c) => c.numero_cheque || c.numeroCheque || 'S/N');
      finalCheckNumber = chequeNums.join(', ');
      finalSummary = usedCheques
        .map(
          (c) =>
            `Nº ${c.numero_cheque || c.numeroCheque} (${c.emitente_nome || c.emitenteNome} • ${c.banco} • ${formatCurrencyBRL(c.valor)})`
        )
        .join(' | ');

      const repasseNote = `Repasse Cheque(s) de Terceiros: ${finalSummary}`;
      finalNotes = finalNotes ? `${finalNotes} | ${repasseNote}` : repasseNote;

      // Atualiza status de cada folha utilizada para REPASSADO na Custódia
      const nowIso = new Date().toISOString();
      const updatedAllCheques = getStoredFinanceiroCheques().map((c) => {
        if (!selectedCustodyChequeIds.includes(c.id)) return c;
        return {
          ...c,
          status: 'REPASSADO' as const,
          fornecedor_destino: resolvedSupplier,
          fornecedorDestino: resolvedSupplier,
          data_repasse: paymentDate,
          dataRepasse: paymentDate,
          despesa_id: expense.id,
          despesaId: expense.id,
          observacoes: `Repassado em pagamento para ${resolvedSupplier} em ${formatDateBR(paymentDate)} (${expense.description})`,
          updated_at: nowIso,
        };
      });

      saveStoredFinanceiroCheques(updatedAllCheques);

      // Persiste individualmente (inclusive tentativa no Supabase)
      usedCheques.forEach((chq) => {
        saveFinanceiroCheque({
          ...chq,
          status: 'REPASSADO',
          fornecedor_destino: resolvedSupplier,
          fornecedorDestino: resolvedSupplier,
          data_repasse: paymentDate,
          dataRepasse: paymentDate,
          despesa_id: expense.id,
          despesaId: expense.id,
          observacoes: `Repassado em pagamento para ${resolvedSupplier} em ${formatDateBR(paymentDate)} (${expense.description})`,
        }).catch((err) => console.warn('[PaymentSettlementModal] Aviso ao repassar cheque:', err));
      });

      window.dispatchEvent(new CustomEvent('financeiro_cheques_updated'));
      window.dispatchEvent(new Event('storage'));
    } else if (isOwnCheque) {
      finalSummary = `Cheque Próprio nº ${ownChequeNumber.trim()} (Bom p/: ${formatDateBR(ownChequeGoodForDate)})`;
      finalNotes = finalNotes ? `${finalNotes} | ${finalSummary}` : finalSummary;
    }

    onConfirmSettlement({
      expenseId: expense.id,
      paymentDate,
      paidByEmployeeId: employeeId,
      paidByEmployeeName: employeeName,
      bankAccountId: isThirdPartyCheque ? '' : selectedAccount!.id,
      bankAccountName: isThirdPartyCheque
        ? `Cheque de Terceiros (${finalCheckNumber || 'Custódia'})`
        : selectedAccount!.name,
      creditSupplier: resolvedSupplier,
      paymentMethod,
      authenticationCode: authenticationCode.trim() || undefined,
      notes: finalNotes,
      chequeOrigin: paymentMethod === 'cheque' ? chequeOrigin : undefined,
      checkNumber: finalCheckNumber,
      chequeGoodForDate: isOwnCheque ? ownChequeGoodForDate : undefined,
      usedChequeIds: isThirdPartyCheque ? selectedCustodyChequeIds : undefined,
      usedChequesSummary: finalSummary || undefined,
    });

    onClose();
  };

  const diffCustody = selectedCustodyTotal - expenseAmount;

  return (
    <div
      id="modal-baixa-pagamento"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-zinc-950/70 backdrop-blur-xs overflow-hidden overflow-y-hidden animate-in fade-in"
    >
      <div className="w-[80vw] max-w-[80vw] bg-white dark:bg-stone-900 rounded-2xl shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9),inset_-1px_-1px_0px_rgba(0,0,0,0.15)] overflow-hidden overflow-y-hidden border border-slate-400 dark:border-stone-700 my-auto flex flex-col max-h-[92vh]">
        {/* CABEÇALHO - Moldura Metálica 3D Acetinada */}
        <div className="px-4 sm:px-6 py-2.5 flex items-center justify-between text-slate-800 dark:text-stone-100 shrink-0 bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 dark:from-stone-900 dark:via-stone-850 dark:to-stone-900 border-b border-slate-400 dark:border-stone-700 rounded-t-2xl shadow-xs">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/80 dark:bg-stone-800 flex items-center justify-center text-slate-800 dark:text-stone-100 shrink-0 border border-slate-300 dark:border-stone-700 shadow-2xs">
              <FileCheck2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-stone-100 flex items-center gap-1.5 leading-tight">
                BAIXA DE CONTA A PAGAR
              </h3>
              <p className="text-[11px] text-slate-600 dark:text-stone-400 font-medium leading-tight">
                Identificação de responsável, vencimento e débito em conta bancária ou repasse de custódia
              </p>
            </div>
          </div>

          <button
            type="button"
            id="btn-fechar-modal-baixa"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-300/60 dark:text-stone-400 dark:hover:text-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
            title="Fechar Modal"
          >
            <X className="w-4 h-4 text-slate-700 dark:text-stone-200" />
          </button>
        </div>

        {/* FORMULÁRIO */}
        <form
          onSubmit={handleSubmit}
          className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1 text-slate-900 dark:text-stone-100 max-h-[82vh] scrollbar-none"
        >
          {/* Alerta de Validação */}
          {errorMessage && (
            <div
              id="alerta-erro-baixa"
              className="p-3 bg-rose-100 border border-rose-400 rounded-xl flex items-center space-x-2 text-rose-900 text-xs font-black animate-in fade-in"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. CARD RESUMO DA DESPESA A PAGAR */}
          <div className="bg-gradient-to-br from-slate-50 to-blue-50/40 rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-stone-500">
                  Título Selecionado
                </span>
                <h4 className="text-sm sm:text-base font-black text-black">
                  {expense.supplier || 'Fornecedor não especificado'}
                </h4>
                <p className="text-xs text-stone-600 font-medium">
                  {expense.description}
                </p>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[10px] font-black uppercase tracking-wider text-stone-500 block">
                  Valor a Pagar
                </span>
                <div className="text-xl sm:text-2xl font-black text-black font-['Outfit']">
                  {formatCurrencyBRL(expense.amount)}
                </div>
              </div>
            </div>

            {/* Linha Informativa: Categoria e Data de Vencimento Original */}
            <div className="pt-2 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-stone-600">
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded-md bg-white border border-stone-200 text-stone-800 text-[11px] font-bold">
                  {expense.categoryName || 'Geral'}
                </span>
                {expense.invoiceNumber && (
                  <span className="text-[11px] text-stone-500 font-mono">
                    NF: {expense.invoiceNumber}
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-1.5 text-xs">
                <Clock className="w-3.5 h-3.5 text-stone-500" />
                <span>Vencimento Original:</span>
                <strong className="font-bold text-black font-mono">
                  {dueDate ? formatDateBR(dueDate) : 'Não informado'}
                </strong>
                {dueDate && isOverdue && (
                  <span className="text-[10px] font-black bg-rose-100 text-rose-800 px-1.5 py-0.2 rounded border border-rose-200">
                    Liquidação em Atraso
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 2. BLOCO MOVIDO PARA O TOPO: DATA DO PAGAMENTO EFETIVO & FORMA DE PAGAMENTO UTILIZADA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Data do Pagamento */}
            <div className="bg-white rounded-2xl p-3.5 border border-stone-200 shadow-2xs space-y-1.5">
              <label htmlFor="input-data-pagamento-baixa" className="block text-xs font-black text-black flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#0963cb]" />
                <span>Data do Pagamento Efetivo <span className="text-rose-600">*</span></span>
              </label>
              <div className="relative">
                <input
                  id="input-data-pagamento-baixa"
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm font-bold bg-white text-black border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#0963cb] outline-hidden shadow-2xs"
                />
              </div>
              <span className="text-[10px] text-stone-500 block">
                {paymentDate === today ? 'Liquidando na data de hoje' : `Data selecionada: ${formatDateBR(paymentDate)}`}
              </span>
            </div>

            {/* Forma de Pagamento (Ordem Alfabética Estrita) */}
            <div className="bg-white rounded-2xl p-3.5 border border-stone-200 shadow-2xs space-y-1.5">
              <label htmlFor="select-metodo-pagamento-baixa" className="block text-xs font-black text-black flex items-center gap-1.5">
                <WalletCards className="w-3.5 h-3.5 text-[#0963cb]" />
                <span>Forma de Pagamento Utilizada</span>
              </label>
              <select
                id="select-metodo-pagamento-baixa"
                value={paymentMethod}
                onChange={(e) => {
                  setPaymentMethod(e.target.value as PaymentMethod);
                  setErrorMessage('');
                }}
                className="w-full px-3 py-2 text-xs sm:text-sm font-bold bg-white text-black border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#0963cb] outline-hidden shadow-2xs cursor-pointer"
              >
                {PAYMENT_METHOD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-stone-500 block">
                Canal bancário ou meio de pagamento utilizado
              </span>
            </div>
          </div>

          {/* 3. PAINEL CONDICIONAL DE CHEQUE (PRÓPRIO vs TERCEIROS / CUSTÓDIA) */}
          {paymentMethod === 'cheque' && (
            <div className="bg-slate-50 rounded-2xl p-3.5 sm:p-4 border border-slate-300 shadow-2xs space-y-3 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <WalletCards className="w-4 h-4 text-[#0963cb]" />
                  <span className="text-xs font-black uppercase tracking-wide text-slate-900">
                    Origem do Cheque Utilizado <span className="text-rose-600">*</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1 max-w-2xl">
                  <button
                    type="button"
                    id="btn-cheque-proprio"
                    onClick={() => {
                      setChequeOrigin('proprio');
                      setErrorMessage('');
                    }}
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl border text-xs font-black transition cursor-pointer ${
                      chequeOrigin === 'proprio'
                        ? 'bg-[#0963cb] text-white border-[#0963cb] shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <Landmark className="w-3.5 h-3.5 shrink-0" />
                    <span>Cheque Próprio (Empresa)</span>
                  </button>

                  <button
                    type="button"
                    id="btn-cheque-terceiros"
                    onClick={() => {
                      setChequeOrigin('terceiros');
                      setErrorMessage('');
                    }}
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl border text-xs font-black transition cursor-pointer ${
                      chequeOrigin === 'terceiros'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                    <span>Cheque de Terceiros (Repasse da Custódia)</span>
                  </button>
                </div>
              </div>

              {/* CASO 1: CHEQUE PRÓPRIO (EMPRESA) */}
              {chequeOrigin === 'proprio' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                  <div className="bg-white rounded-xl p-3 border border-stone-200 space-y-1">
                    <label htmlFor="input-numero-cheque-proprio" className="block text-xs font-black text-black">
                      Número do Cheque Emitido <span className="text-rose-600">*</span>
                    </label>
                    <input
                      id="input-numero-cheque-proprio"
                      type="text"
                      required
                      value={ownChequeNumber}
                      onChange={(e) => {
                        setOwnChequeNumber(e.target.value);
                        setErrorMessage('');
                      }}
                      placeholder="Ex: 000452 ou 850123-4"
                      className="w-full px-3 py-2 text-xs sm:text-sm font-bold font-mono bg-white text-black border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#0963cb] outline-hidden"
                    />
                    <span className="text-[10px] text-stone-500 block">
                      Número da folha emitida da conta bancária da empresa
                    </span>
                  </div>

                  <div className="bg-white rounded-xl p-3 border border-stone-200 space-y-1">
                    <label htmlFor="input-bom-para-cheque-proprio" className="block text-xs font-black text-black">
                      Data de Bom Para / Compensação <span className="text-rose-600">*</span>
                    </label>
                    <input
                      id="input-bom-para-cheque-proprio"
                      type="date"
                      required
                      value={ownChequeGoodForDate}
                      onChange={(e) => {
                        setOwnChequeGoodForDate(e.target.value);
                        setErrorMessage('');
                      }}
                      className="w-full px-3 py-2 text-xs sm:text-sm font-bold bg-white text-black border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#0963cb] outline-hidden"
                    />
                    <span className="text-[10px] text-stone-500 block">
                      Previsão de compensação bancária do cheque emitido
                    </span>
                  </div>
                </div>
              )}

              {/* CASO 2: CHEQUE DE TERCEIROS (REPASSE DA CUSTÓDIA) */}
              {chequeOrigin === 'terceiros' && (
                <div className="space-y-2.5 pt-2 border-t border-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-xs text-emerald-950">
                    <div className="flex items-center gap-2 font-bold">
                      <Info className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>
                        O saldo das contas bancárias da empresa <strong>não</strong> será debitado — o pagamento será quitado com folha(s) da Custódia de Cheques.
                      </span>
                    </div>
                    <span className="text-[11px] font-black text-emerald-800">
                      {availableCustodyCheques.length} cheque(s) Em Carteira
                    </span>
                  </div>

                  {/* Busca rápida nos cheques em carteira */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={chequeSearch}
                      onChange={(e) => setChequeSearch(e.target.value)}
                      placeholder="Buscar cheque em carteira por nº, emitente ou banco de origem..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs font-semibold bg-white text-black border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-600 outline-hidden"
                    />
                  </div>

                  {/* Lista multi-select de cheques em carteira */}
                  <div className="max-h-52 overflow-y-auto bg-white border border-stone-300 rounded-xl divide-y divide-stone-200">
                    {availableCustodyCheques.length === 0 ? (
                      <div className="p-4 text-center text-xs font-semibold text-stone-500">
                        Nenhum cheque com status "Em Carteira" encontrado na Custódia de Cheques.
                      </div>
                    ) : (
                      availableCustodyCheques.map((chq) => {
                        const isSelected = selectedCustodyChequeIds.includes(chq.id);
                        const chqNum = chq.numero_cheque || chq.numeroCheque || 'S/N';
                        const emitente = chq.emitente_nome || chq.emitenteNome || 'Emitente não informado';
                        const venc = chq.data_vencimento || chq.dataVencimento || '';
                        return (
                          <label
                            key={chq.id}
                            className={`flex items-center justify-between gap-3 px-3 py-2 cursor-pointer transition text-xs ${
                              isSelected ? 'bg-emerald-50/90' : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleCustodyCheque(chq.id)}
                                className="w-4 h-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                              />
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5 font-bold text-slate-900">
                                  <span className="font-mono font-black text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded text-[11px]">
                                    Nº {chqNum}
                                  </span>
                                  <span className="truncate">{emitente}</span>
                                  <span className="text-stone-400">•</span>
                                  <span className="text-stone-700 font-semibold">{chq.banco}</span>
                                </div>
                                <div className="text-[11px] text-stone-500 font-medium mt-0.5">
                                  Vencimento / Bom Para: <strong className="font-mono text-stone-800">{venc ? formatDateBR(venc) : '—'}</strong>
                                  {chq.cliente_nome && chq.cliente_nome !== emitente ? ` • Cliente: ${chq.cliente_nome}` : ''}
                                </div>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <span className="font-black text-sm text-slate-900 font-['Outfit']">
                                {formatCurrencyBRL(Number(chq.valor) || 0)}
                              </span>
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>

                  {/* Resumo da seleção de repasse */}
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs">
                    <span className="font-bold text-stone-700">
                      Selecionados: <strong className="text-black">{selectedCustodyChequeIds.length}</strong> cheque(s)
                    </span>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-bold text-stone-600">
                        Total em Cheques:{' '}
                        <strong className="text-emerald-700 font-['Outfit'] text-sm">
                          {formatCurrencyBRL(selectedCustodyTotal)}
                        </strong>
                      </span>
                      {selectedCustodyChequeIds.length > 0 && (
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-black border ${
                            Math.abs(diffCustody) < 0.01
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : diffCustody > 0
                                ? 'bg-amber-50 text-amber-800 border-amber-300'
                                : 'bg-rose-50 text-rose-800 border-rose-300'
                          }`}
                        >
                          {Math.abs(diffCustody) < 0.01
                            ? 'Valor Exato do Título'
                            : diffCustody > 0
                              ? `Troco / Excedente: ${formatCurrencyBRL(diffCustody)}`
                              : `Diferença Restante: ${formatCurrencyBRL(Math.abs(diffCustody))}`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 4. QUAL BANCO (Oculto quando Cheque de Terceiros - Repasse da Custódia) */}
          {!isThirdPartyCheque && (
            <div className="bg-white rounded-2xl p-3.5 border border-stone-200 shadow-2xs space-y-2">
              <label
                htmlFor="select-conta-baixa"
                className="block text-xs font-black text-black flex items-center justify-between"
              >
                <span className="flex items-center gap-1.5">
                  <Landmark className="w-4 h-4 text-[#0963cb]" />
                  <span>
                    Qual Banco (Conta Bancária de onde sairá o dinheiro) <span className="text-rose-600">*</span>
                  </span>
                </span>
                <span className="text-[10px] text-rose-600 font-bold bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                  Obrigatório
                </span>
              </label>

              {bankAccounts.length === 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 font-medium">
                  Nenhuma conta bancária cadastrada no sistema. Cadastre uma conta na aba "Contas Bancárias" antes de realizar a baixa.
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-center">
                  <select
                    id="select-conta-baixa"
                    required
                    value={selectedBankAccountId}
                    onChange={(e) => {
                      setSelectedBankAccountId(e.target.value);
                      setErrorMessage('');
                    }}
                    className="w-full px-3 py-2 text-xs sm:text-sm font-bold bg-white text-black border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#0963cb] outline-hidden shadow-2xs cursor-pointer"
                  >
                    <option value="">-- Selecione o Banco / Conta para Saída do Dinheiro --</option>
                    {bankAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.bankCode ? `[${acc.bankCode}] ` : ''}
                        {acc.name} ({acc.bankName}) - Saldo: {formatCurrencyBRL(acc.balance)}
                      </option>
                    ))}
                  </select>

                  {/* Pré-visualização do impacto no saldo */}
                  {selectedAccount && (
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                          <BankLogoIcon code={selectedAccount.bankCode} name={selectedAccount.bankName} size={24} />
                        </div>
                        <div>
                          <div className="font-bold text-black text-xs">{selectedAccount.name}</div>
                          <div className="text-[11px] text-stone-500">
                            {selectedAccount.bankName} {selectedAccount.accountNumber ? `• CC: ${selectedAccount.accountNumber}` : ''}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[10px] text-stone-500 font-semibold">
                          Saldo Atual: <strong className="text-black">{formatCurrencyBRL(accountBalanceBefore)}</strong>
                        </div>
                        <div className="text-[11px] font-black flex items-center justify-end gap-1">
                          <span className="text-stone-500">Após Débito:</span>
                          <span className={accountBalanceAfter < 0 ? 'text-rose-600' : 'text-emerald-700'}>
                            {formatCurrencyBRL(accountBalanceAfter)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 5. FORNECEDOR DO CRÉDITO & RESPONSÁVEL PELO PAGAMENTO */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Qual o Fornecedor do Crédito */}
            <div className="bg-white rounded-2xl p-3.5 border border-stone-200 shadow-2xs space-y-2">
              <label
                htmlFor="input-fornecedor-credito"
                className="block text-xs font-black text-black flex items-center justify-between"
              >
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-[#0963cb]" />
                  <span>
                    Qual o Fornecedor do Crédito (Favorecido) <span className="text-rose-600">*</span>
                  </span>
                </span>
                <span className="text-[10px] text-rose-600 font-bold bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                  Obrigatório
                </span>
              </label>

              <input
                id="input-fornecedor-credito"
                type="text"
                required
                value={creditSupplier}
                onChange={(e) => {
                  setCreditSupplier(e.target.value);
                  setErrorMessage('');
                }}
                placeholder="Ex: John Deere Financial, Banco do Brasil, Fornecedor X..."
                className="w-full px-3 py-2 text-xs sm:text-sm font-bold bg-white text-black border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#0963cb] outline-hidden shadow-2xs"
              />
              <span className="text-[10px] text-stone-500 font-medium block">
                Informe a instituição financeira, banco ou fornecedor favorecido deste pagamento
              </span>
            </div>

            {/* Responsável pelo Pagamento */}
            <div className="bg-white rounded-2xl p-3.5 border border-stone-200 shadow-2xs space-y-2">
              <label
                htmlFor="select-funcionario-baixa"
                className="block text-xs font-black text-black flex items-center justify-between"
              >
                <span className="flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-[#0963cb]" />
                  <span>
                    Responsável pelo Pagamento (Quem realizou) <span className="text-rose-600">*</span>
                  </span>
                </span>
                <span className="text-[10px] text-stone-500 font-semibold">Obrigatório</span>
              </label>

              <select
                id="select-funcionario-baixa"
                required
                value={selectedEmployeeId}
                onChange={(e) => {
                  setSelectedEmployeeId(e.target.value);
                  setErrorMessage('');
                }}
                className="w-full px-3 py-2 text-xs sm:text-sm font-bold bg-white text-black border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#0963cb] outline-hidden shadow-2xs cursor-pointer"
              >
                <option value="">-- Selecione o Funcionário Responsável --</option>
                {activeEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} {emp.role ? `(${emp.role})` : ''}
                  </option>
                ))}
                <option value="outro">+ Outro Responsável / Gestor Direto</option>
              </select>

              {selectedEmployeeId === 'outro' && (
                <div className="pt-1 animate-in fade-in">
                  <input
                    type="text"
                    value={customEmployeeName}
                    onChange={(e) => setCustomEmployeeName(e.target.value)}
                    placeholder="Digite o nome completo de quem realizou o pagamento..."
                    className="w-full px-3 py-2 text-xs sm:text-sm font-bold bg-white text-black border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#0963cb] outline-hidden shadow-2xs"
                  />
                </div>
              )}
              <span className="text-[10px] text-stone-500 font-medium block">
                Registrado para auditoria, prestação de contas e histórico de conformidade financeira
              </span>
            </div>
          </div>

          {/* 6. CÓDIGO DE AUTENTICAÇÃO / COMPROVANTE (OPCIONAL) */}
          <div className="bg-white rounded-2xl p-3.5 border border-stone-200 shadow-2xs space-y-1.5">
            <label htmlFor="input-codigo-autenticacao-baixa" className="block text-xs font-black text-black flex items-center justify-between">
              <span>Código de Autenticação Bancária / ID da Transação (Opcional)</span>
              <span className="text-[10px] text-stone-500 font-semibold">Comprovante</span>
            </label>
            <input
              id="input-codigo-autenticacao-baixa"
              type="text"
              value={authenticationCode}
              onChange={(e) => setAuthenticationCode(e.target.value)}
              placeholder="Ex: E1234567820260912... ou Nº do documento"
              className="w-full px-3 py-2 text-xs sm:text-sm font-bold bg-white text-black border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#0963cb] outline-hidden shadow-2xs font-mono"
            />
          </div>

          {/* BOTÕES DE AÇÃO */}
          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-stone-200 shrink-0">
            <button
              type="button"
              id="btn-cancelar-baixa"
              onClick={onClose}
              className="px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl bg-white border border-stone-300 text-stone-700 hover:bg-stone-50 cursor-pointer transition shadow-2xs min-h-[40px]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              id="btn-confirmar-baixa-pagamento"
              className="px-6 py-2.5 text-xs sm:text-sm font-black rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md cursor-pointer transition active:scale-98 flex items-center space-x-1.5 min-h-[40px]"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>
                {isThirdPartyCheque
                  ? 'Confirmar Baixa com Cheque(s) de Terceiros'
                  : 'Confirmar Baixa e Debitar Conta'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
