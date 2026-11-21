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
  Settings,
  Wallet,
} from 'lucide-react';
import { Expense, BankAccount, Employee, PaymentMethod, FinanceiroCheque } from '../../types';
import {
  formatCurrencyBRL,
  formatDateBR,
  getStoredFinanceiroCheques,
  saveStoredFinanceiroCheques,
} from '../../lib/storage';
import {
  CAIXA_INTERNO_ID,
  CAIXA_INTERNO_LABEL,
  getCaixaInternoSaldoAtual,
} from '../../lib/caixaStorage';
import { fetchFinanceiroCheques, saveFinanceiroCheque } from '../../lib/supabaseService';
import { BankLogoIcon } from './BankLogoIcon';
import {
  useGlobalPaymentMethods,
  getPaymentMethodKey,
  getGlobalPaymentMethodLabel,
  extractGlobalPaymentMethodFromRecord,
} from '../../lib/paymentMethodsStorage';
import { PaymentMethodsManagerModal } from '../common/PaymentMethodsManager';

const formatCurrencyInputMask = (val: number | undefined | null): string => {
  if (val === undefined || val === null || isNaN(val) || val === 0) return '0,00';
  return val.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const parseCurrencyMaskToFloat = (raw: string): number => {
  if (!raw) return 0;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return 0;
  const cents = parseInt(digits, 10);
  if (isNaN(cents)) return 0;
  return Number((cents / 100).toFixed(2));
};

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
  settlementNotes?: string;
  originalAmount?: number;
  fineAmount?: number;
  interestAmount?: number;
  discountAmount?: number;
  paidAmount?: number;
  paidViaCashBox?: boolean;
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
    settlementNotes?: string;
    originalAmount?: number;
    fineAmount?: number;
    interestAmount?: number;
    discountAmount?: number;
    paidAmount?: number;
    paidViaCashBox?: boolean;
    chequeOrigin?: 'proprio' | 'terceiros';
    checkNumber?: string;
    chequeGoodForDate?: string;
    usedChequeIds?: string[];
    usedChequesSummary?: string;
  }) => void;
}

export const PaymentSettlementModal: React.FC<PaymentSettlementModalProps> = ({
  isOpen,
  onClose,
  expense,
  bankAccounts = [],
  employees = [],
  onConfirmSettlement,
}) => {
  const today = new Date().toISOString().split('T')[0];
  const { activeMethods: activeGlobalPaymentMethods } = useGlobalPaymentMethods();
  const [isPaymentMethodsManagerOpen, setIsPaymentMethodsManagerOpen] = useState(false);

  const [paymentDate, setPaymentDate] = useState(today);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [customEmployeeName, setCustomEmployeeName] = useState('');
  const [selectedBankAccountId, setSelectedBankAccountId] = useState('');
  const [creditSupplier, setCreditSupplier] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [authenticationCode, setAuthenticationCode] = useState('');
  const [notes, setNotes] = useState('');
  const [fineAmount, setFineAmount] = useState<number>(0);
  const [interestAmount, setInterestAmount] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [caixaInternoBalance, setCaixaInternoBalance] = useState<number>(() => getCaixaInternoSaldoAtual());
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
      setCaixaInternoBalance(getCaixaInternoSaldoAtual());
    };

    refreshCustody();
    fetchFinanceiroCheques()
      .then((list) => {
        if (Array.isArray(list)) setCustodyCheques(list);
      })
      .catch(() => {});

    window.addEventListener('financeiro_cheques_updated', refreshCustody);
    window.addEventListener('agrocontrol_caixa_operacional_updated', refreshCustody);
    window.addEventListener('storage', refreshCustody);
    return () => {
      window.removeEventListener('financeiro_cheques_updated', refreshCustody);
      window.removeEventListener('agrocontrol_caixa_operacional_updated', refreshCustody);
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
    setCaixaInternoBalance(getCaixaInternoSaldoAtual());

    // Inicializa Fornecedor do Crédito
    setCreditSupplier(expense.creditSupplier || expense.supplier || '');

    // Método de pagamento original pré-preenchido automaticamente
    const detectedMethod = extractGlobalPaymentMethodFromRecord(expense);
    if (detectedMethod) {
      setPaymentMethod(detectedMethod);
    } else {
      setPaymentMethod('pix');
    }

    // Valores de Multa, Juros e Desconto
    setFineAmount(Number(expense.fineAmount) || 0);
    setInterestAmount(Number(expense.interestAmount) || 0);
    setDiscountAmount(Number(expense.discountAmount) || 0);

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

    // Mantém Qual Banco / Caixa em branco por padrão para exigir escolha explícita do usuário
    setSelectedBankAccountId('');

    setAuthenticationCode(expense.paymentAuthenticationCode || '');
    setNotes(expense.settlementNotes || '');
  }, [isOpen, expense?.id]);

  // Lista de funcionários ativos
  const activeEmployees = useMemo(() => {
    return employees.filter((e) => e.active !== false);
  }, [employees]);

  const isCashBoxSelected = selectedBankAccountId === CAIXA_INTERNO_ID;

  // Conta bancária selecionada
  const selectedAccount = useMemo(() => {
    return bankAccounts.find((a) => a.id === selectedBankAccountId);
  }, [bankAccounts, selectedBankAccountId]);

  // Cheques disponíveis em carteira ("EM_NOSSO_PODER")
  const availableCustodyCheques = useMemo(() => {
    const inWallet = custodyCheques.filter((c) => c.status === 'EM_NOSSO_PODER');
    const q = String(chequeSearch ?? '').trim().toLowerCase();
    if (!q) return inWallet;
    return inWallet.filter((c) => {
      const num = String(c?.numero_cheque ?? c?.numeroCheque ?? '').toLowerCase();
      const emitente = String(c?.emitente_nome ?? c?.emitenteNome ?? '').toLowerCase();
      const banco = String(c?.banco ?? '').toLowerCase();
      const cliente = String(c?.cliente_nome ?? c?.clienteNome ?? '').toLowerCase();
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
  const isMissingBankAccount =
    !isThirdPartyCheque && (!selectedBankAccountId || (!isCashBoxSelected && !selectedAccount));

  // Cálculo Financeiro em Tempo Real: Valor Original + Multa + Juros - Desconto = Valor Efetivo Pago
  const originalExpenseAmount = Number(expense?.originalAmount ?? expense?.amount ?? 0) || 0;
  const effectivePaidAmount = useMemo(() => {
    const net = originalExpenseAmount + (Number(fineAmount) || 0) + (Number(interestAmount) || 0) - (Number(discountAmount) || 0);
    return Math.max(0, Number(net.toFixed(2)));
  }, [originalExpenseAmount, fineAmount, interestAmount, discountAmount]);

  // Saldo após o débito calculado (Conta Bancária ou Caixa Interno)
  const accountBalanceBefore = isCashBoxSelected ? caixaInternoBalance : (selectedAccount?.balance ?? 0);
  const accountBalanceAfter = Number((accountBalanceBefore - effectivePaidAmount).toFixed(2));

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

    // Validação 3: Qual Banco / Caixa Interno (apenas quando NÃO for Cheque de Terceiros)
    if (!isThirdPartyCheque) {
      if (!selectedBankAccountId || (!isCashBoxSelected && !selectedAccount)) {
        setErrorMessage('Selecione obrigatoriamente a Conta Bancária ou Caixa Interno de onde sairá o dinheiro.');
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

    const resolvedBankId = isThirdPartyCheque
      ? ''
      : isCashBoxSelected
        ? CAIXA_INTERNO_ID
        : selectedAccount!.id;
    const resolvedBankName = isThirdPartyCheque
      ? `Cheque de Terceiros (${finalCheckNumber || 'Custódia'})`
      : isCashBoxSelected
        ? CAIXA_INTERNO_LABEL
        : selectedAccount!.name;

    onConfirmSettlement({
      expenseId: expense.id,
      paymentDate,
      paidByEmployeeId: employeeId,
      paidByEmployeeName: employeeName,
      bankAccountId: resolvedBankId,
      bankAccountName: resolvedBankName,
      creditSupplier: resolvedSupplier,
      paymentMethod,
      authenticationCode: authenticationCode.trim() || undefined,
      notes: finalNotes,
      settlementNotes: notes.trim() || undefined,
      originalAmount: originalExpenseAmount,
      fineAmount: Number(fineAmount) || 0,
      interestAmount: Number(interestAmount) || 0,
      discountAmount: Number(discountAmount) || 0,
      paidAmount: effectivePaidAmount,
      paidViaCashBox: !isThirdPartyCheque && isCashBoxSelected,
      chequeOrigin: paymentMethod === 'cheque' ? chequeOrigin : undefined,
      checkNumber: finalCheckNumber,
      chequeGoodForDate: isOwnCheque ? ownChequeGoodForDate : undefined,
      usedChequeIds: isThirdPartyCheque ? selectedCustodyChequeIds : undefined,
      usedChequesSummary: finalSummary || undefined,
    });

    onClose();
  };

  const diffCustody = selectedCustodyTotal - effectivePaidAmount;

  return (
    <div
      id="modal-baixa-pagamento"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 overflow-hidden overflow-y-hidden animate-in fade-in"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.60)' }}
    >
      <div className="w-[92vw] max-w-[1260px] max-h-[94vh] bg-[#cad4e6] rounded-xl shadow-2xl overflow-hidden border border-black my-auto flex flex-col justify-between mx-auto">
        {/* CABEÇALHO */}
        <div className="px-4 py-2 flex items-center justify-between text-slate-900 shrink-0 bg-[#cad4e6] border-b border-black">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-slate-900 shrink-0 border border-black shadow-2xs">
              <FileCheck2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-black leading-tight">
                BAIXA DE CONTA A PAGAR
              </h3>
              <span className="text-[11px] text-slate-800 font-medium hidden sm:inline leading-tight">
                • Responsável, vencimento e débito em conta ou caixa interno
              </span>
            </div>
          </div>

          <button
            type="button"
            id="btn-fechar-modal-baixa"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-800 hover:text-black hover:bg-black/10 transition cursor-pointer"
            title="Fechar Modal"
          >
            <X className="w-4 h-4 text-black" />
          </button>
        </div>

        {/* FORMULÁRIO */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 min-h-0 flex flex-col overflow-hidden bg-[#cad4e6] text-black"
        >
          <div className="flex-1 min-h-0 overflow-y-auto p-2.5 sm:p-3 space-y-2">
          {/* Alerta de Validação */}
          {errorMessage && (
            <div
              id="alerta-erro-baixa"
              className="p-2 bg-rose-100 border border-black rounded-lg flex items-center space-x-2 text-rose-900 text-xs font-black animate-in fade-in"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. CARD RESUMO DA DESPESA A PAGAR */}
          <div className="bg-[#e0e6f1] rounded-xl p-2.5 border border-black shadow-2xs space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">
                    Título:
                  </span>
                  <h4 className="text-xs sm:text-sm font-black text-black truncate">
                    {expense.supplier || 'Fornecedor não especificado'}
                  </h4>
                  <span className="px-1.5 py-0.5 rounded bg-white border border-gray-400 text-black text-[10px] font-bold">
                    {expense.categoryName || 'Geral'}
                  </span>
                  {expense.invoiceNumber && (
                    <span className="text-[10px] text-slate-700 font-mono font-bold">
                      NF: {expense.invoiceNumber}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-800 font-medium truncate mt-0.5">
                  {expense.description}
                </p>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-700 block leading-none">
                    Vencimento Original
                  </span>
                  <div className="flex items-center justify-end gap-1 mt-0.5 text-xs font-bold text-black font-mono">
                    <Clock className="w-3 h-3 text-slate-700" />
                    <span>{dueDate ? formatDateBR(dueDate) : 'N/I'}</span>
                    {dueDate && isOverdue && (
                      <span className="text-[9px] font-black bg-rose-100 text-rose-800 px-1 rounded border border-rose-300">
                        Atraso
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right border-l border-black/20 pl-3">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-700 block leading-none">
                    Original
                  </span>
                  <div className="text-xs sm:text-sm font-bold text-slate-700 font-['Outfit']">
                    {formatCurrencyBRL(originalExpenseAmount)}
                  </div>
                </div>
                <div className="text-right border-l border-black/20 pl-3">
                  <span className="text-[9px] font-black uppercase tracking-wider text-emerald-800 block leading-none">
                    Efetivo a Pagar
                  </span>
                  <div className="text-base sm:text-lg font-black text-black font-['Outfit'] leading-tight">
                    {formatCurrencyBRL(effectivePaidAmount)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 1B. BLOCO DE CÁLCULO FINANCEIRO EM TEMPO REAL (MULTA, JUROS, DESCONTO, VALOR EFETIVO PAGO) */}
          <div className="bg-[#e0e6f1] rounded-xl p-2.5 border border-black shadow-2xs space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-black">
                Cálculo Financeiro em Tempo Real (Encargos &amp; Descontos)
              </span>
              <span className="text-[10px] font-bold text-slate-700">
                Original + Multa + Juros - Desconto = Valor Efetivo Pago
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 items-stretch">
              <div className="bg-slate-100 border border-slate-400 rounded-lg p-2 flex flex-col justify-between">
                <span className="text-[10px] font-black uppercase text-slate-700 block leading-tight">
                  Valor Original (R$)
                </span>
                <div className="text-sm font-black text-slate-900 font-mono mt-0.5">
                  {formatCurrencyBRL(originalExpenseAmount)}
                </div>
              </div>

              <div className="bg-white border border-gray-400 rounded-lg p-2 flex flex-col justify-between">
                <label htmlFor="input-multa-baixa" className="text-[10px] font-black uppercase text-rose-700 block mb-0.5 leading-tight">
                  (+) Multa (R$)
                </label>
                <input
                  id="input-multa-baixa"
                  type="text"
                  inputMode="numeric"
                  value={formatCurrencyInputMask(fineAmount)}
                  onChange={(e) => {
                    setFineAmount(parseCurrencyMaskToFloat(e.target.value));
                    setErrorMessage('');
                  }}
                  className="w-full px-2 py-1 text-xs sm:text-sm font-black font-mono text-rose-700 bg-rose-50/40 border border-slate-400 rounded-md focus:ring-2 focus:ring-rose-500 outline-hidden text-right"
                />
              </div>

              <div className="bg-white border border-gray-400 rounded-lg p-2 flex flex-col justify-between">
                <label htmlFor="input-juros-baixa" className="text-[10px] font-black uppercase text-rose-700 block mb-0.5 leading-tight">
                  (+) Juros / Encargos (R$)
                </label>
                <input
                  id="input-juros-baixa"
                  type="text"
                  inputMode="numeric"
                  value={formatCurrencyInputMask(interestAmount)}
                  onChange={(e) => {
                    setInterestAmount(parseCurrencyMaskToFloat(e.target.value));
                    setErrorMessage('');
                  }}
                  className="w-full px-2 py-1 text-xs sm:text-sm font-black font-mono text-rose-700 bg-rose-50/40 border border-slate-400 rounded-md focus:ring-2 focus:ring-rose-500 outline-hidden text-right"
                />
              </div>

              <div className="bg-white border border-gray-400 rounded-lg p-2 flex flex-col justify-between">
                <label htmlFor="input-desconto-baixa" className="text-[10px] font-black uppercase text-emerald-700 block mb-0.5 leading-tight">
                  (-) Desconto / Abatimento (R$)
                </label>
                <input
                  id="input-desconto-baixa"
                  type="text"
                  inputMode="numeric"
                  value={formatCurrencyInputMask(discountAmount)}
                  onChange={(e) => {
                    setDiscountAmount(parseCurrencyMaskToFloat(e.target.value));
                    setErrorMessage('');
                  }}
                  className="w-full px-2 py-1 text-xs sm:text-sm font-black font-mono text-emerald-700 bg-emerald-50/40 border border-slate-400 rounded-md focus:ring-2 focus:ring-emerald-600 outline-hidden text-right"
                />
              </div>

              <div className="bg-emerald-50 border-2 border-emerald-700 rounded-lg p-2 flex flex-col justify-between shadow-2xs">
                <span className="text-[10px] font-black uppercase text-emerald-900 block leading-tight">
                  (=) Efetivo Pago (R$)
                </span>
                <div className="text-sm sm:text-base font-black text-emerald-800 font-['Outfit'] mt-0.5 text-right">
                  {formatCurrencyBRL(effectivePaidAmount)}
                </div>
              </div>
            </div>
          </div>

          {/* 2. BLOCO MOVIDO PARA O TOPO: DATA DO PAGAMENTO EFETIVO & FORMA DE PAGAMENTO UTILIZADA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Data do Pagamento */}
            <div className="bg-[#e0e6f1] rounded-xl p-2.5 border border-black shadow-2xs space-y-1">
              <label htmlFor="input-data-pagamento-baixa" className="block text-xs font-black text-black flex items-center justify-between gap-1.5">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#0963cb]" />
                  <span>Data do Pagamento Efetivo <span className="text-rose-600">*</span></span>
                </span>
                <span className="text-[10px] text-slate-700 font-medium">
                  {paymentDate === today ? 'Hoje' : formatDateBR(paymentDate)}
                </span>
              </label>
              <input
                id="input-data-pagamento-baixa"
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs sm:text-sm font-bold bg-white text-black border border-gray-400 rounded-lg focus:ring-2 focus:ring-[#0963cb] outline-hidden shadow-2xs"
              />
            </div>

            {/* Forma de Pagamento (Sincronizada com Lista Única Global) */}
            <div className="bg-[#e0e6f1] rounded-xl p-2.5 border border-black shadow-2xs space-y-1">
              <div className="flex items-center justify-between">
                <label htmlFor="select-metodo-pagamento-baixa" className="block text-xs font-black text-black flex items-center gap-1.5">
                  <WalletCards className="w-3.5 h-3.5 text-[#0963cb]" />
                  <span>Forma de Pagamento Utilizada</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsPaymentMethodsManagerOpen(true)}
                  title="Gerenciar Formas de Pagamento"
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white hover:bg-slate-100 border border-black text-[9px] font-black text-black uppercase cursor-pointer"
                >
                  <Settings className="w-3 h-3" />
                  <span>Gerenciar</span>
                </button>
              </div>
              <select
                id="select-metodo-pagamento-baixa"
                value={paymentMethod}
                onChange={(e) => {
                  setPaymentMethod(e.target.value as PaymentMethod);
                  setErrorMessage('');
                }}
                className="w-full px-2.5 py-1.5 text-xs sm:text-sm font-bold bg-white text-black border border-black rounded-lg focus:ring-2 focus:ring-[#0963cb] outline-hidden shadow-2xs cursor-pointer uppercase"
              >
                {activeGlobalPaymentMethods.map((m) => {
                  const key = getPaymentMethodKey(m);
                  return (
                    <option key={m.id} value={key}>
                      {m.nome}
                    </option>
                  );
                })}
                {paymentMethod &&
                  !activeGlobalPaymentMethods.some((m) => getPaymentMethodKey(m) === paymentMethod) && (
                    <option value={paymentMethod}>
                      {getGlobalPaymentMethodLabel(paymentMethod)}
                    </option>
                  )}
              </select>
            </div>
          </div>

          {/* 3. PAINEL CONDICIONAL DE CHEQUE (PRÓPRIO vs TERCEIROS / CUSTÓDIA) */}
          {paymentMethod === 'cheque' && (
            <div className="bg-[#e0e6f1] rounded-2xl p-3.5 sm:p-4 border border-black shadow-2xs space-y-3 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <WalletCards className="w-4 h-4 text-[#0963cb]" />
                  <span className="text-xs font-black uppercase tracking-wide text-black">
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
                        ? 'bg-[#0963cb] text-white border-black shadow-xs'
                        : 'bg-white text-black border-gray-400 hover:bg-slate-100'
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
                        ? 'bg-emerald-600 text-white border-black shadow-xs'
                        : 'bg-white text-black border-gray-400 hover:bg-slate-100'
                    }`}
                  >
                    <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                    <span>Cheque de Terceiros (Repasse da Custódia)</span>
                  </button>
                </div>
              </div>

              {/* CASO 1: CHEQUE PRÓPRIO (EMPRESA) */}
              {chequeOrigin === 'proprio' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-black/20">
                  <div className="bg-[#e0e6f1] rounded-xl p-3 border border-black space-y-1">
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
                      className="w-full px-3 py-2 text-xs sm:text-sm font-bold font-mono bg-white text-black border border-gray-400 rounded-xl focus:ring-2 focus:ring-[#0963cb] outline-hidden"
                    />
                    <span className="text-[10px] text-slate-700 font-medium block">
                      Número da folha emitida da conta bancária da empresa
                    </span>
                  </div>

                  <div className="bg-[#e0e6f1] rounded-xl p-3 border border-black space-y-1">
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
                      className="w-full px-3 py-2 text-xs sm:text-sm font-bold bg-white text-black border border-gray-400 rounded-xl focus:ring-2 focus:ring-[#0963cb] outline-hidden"
                    />
                    <span className="text-[10px] text-slate-700 font-medium block">
                      Previsão de compensação bancária do cheque emitido
                    </span>
                  </div>
                </div>
              )}

              {/* CASO 2: CHEQUE DE TERCEIROS (REPASSE DA CUSTÓDIA) */}
              {chequeOrigin === 'terceiros' && (
                <div className="space-y-2.5 pt-2 border-t border-black/20">
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-emerald-50 border border-black rounded-xl px-3 py-2 text-xs text-emerald-950">
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
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={chequeSearch}
                      onChange={(e) => setChequeSearch(e.target.value)}
                      placeholder="Buscar cheque em carteira por nº, emitente ou banco de origem..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs font-semibold bg-white text-black border border-gray-400 rounded-xl focus:ring-2 focus:ring-emerald-600 outline-hidden"
                    />
                  </div>

                  {/* Lista multi-select de cheques em carteira */}
                  <div className="max-h-52 overflow-y-auto bg-white border border-black rounded-xl divide-y divide-gray-300">
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
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-[#e0e6f1] border border-black rounded-xl px-3 py-2 text-xs">
                    <span className="font-bold text-black">
                      Selecionados: <strong className="text-black">{selectedCustodyChequeIds.length}</strong> cheque(s)
                    </span>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-bold text-slate-800">
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

          {/* 4. QUAL BANCO / CAIXA INTERNO (Oculto quando Cheque de Terceiros - Repasse da Custódia) */}
          {!isThirdPartyCheque && (
            <div className="bg-[#e0e6f1] rounded-xl p-2.5 border border-black shadow-2xs space-y-1.5">
              <label
                htmlFor="select-conta-baixa"
                className="block text-xs font-black text-black flex items-center justify-between"
              >
                <span className="flex items-center gap-1.5">
                  <Landmark className="w-3.5 h-3.5 text-[#0963cb]" />
                  <span>
                    Qual Banco / Caixa de onde sairá o dinheiro <span className="text-rose-600">*</span>
                  </span>
                </span>
                <span className="text-[10px] text-rose-600 font-bold bg-rose-50 border border-rose-300 px-1.5 py-0.5 rounded">
                  Obrigatório
                </span>
              </label>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 items-center">
                <select
                  id="select-conta-baixa"
                  required
                  value={selectedBankAccountId}
                  onChange={(e) => {
                    setSelectedBankAccountId(e.target.value);
                    setErrorMessage('');
                  }}
                  className="w-full px-2.5 py-1.5 text-xs sm:text-sm font-bold bg-white text-black border border-gray-400 rounded-lg focus:ring-2 focus:ring-[#0963cb] outline-hidden shadow-2xs cursor-pointer"
                >
                  <option value="">-- Selecione o Banco ou Caixa --</option>
                  <option value={CAIXA_INTERNO_ID}>
                    {CAIXA_INTERNO_LABEL} — Saldo em Dinheiro: {formatCurrencyBRL(caixaInternoBalance)}
                  </option>
                  {bankAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.bankCode ? `[${acc.bankCode}] ` : ''}
                      {acc.name} ({acc.bankName}) - Saldo: {formatCurrencyBRL(acc.balance)}
                    </option>
                  ))}
                </select>

                {/* Pré-visualização do impacto no saldo (Caixa Interno ou Conta Bancária) */}
                {(isCashBoxSelected || selectedAccount) && (
                  <div className="px-2.5 py-1.5 rounded-lg bg-white border border-gray-400 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2 min-w-0">
                      <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 overflow-hidden shadow-2xs bg-emerald-50 border border-emerald-200">
                        {isCashBoxSelected ? (
                          <Wallet className="w-3.5 h-3.5 text-emerald-700" />
                        ) : (
                          <BankLogoIcon code={selectedAccount!.bankCode} name={selectedAccount!.bankName} size={22} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-black text-xs truncate">
                          {isCashBoxSelected ? CAIXA_INTERNO_LABEL : selectedAccount!.name}
                        </div>
                        <div className="text-[10px] text-slate-600 truncate">
                          {isCashBoxSelected
                            ? 'Sangria automática no Caixa'
                            : `${selectedAccount!.bankName} ${selectedAccount!.accountNumber ? `• CC: ${selectedAccount!.accountNumber}` : ''}`}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0 pl-2">
                      <div className="text-[10px] text-slate-600 font-semibold">
                        Saldo: <strong className="text-black">{formatCurrencyBRL(accountBalanceBefore)}</strong>
                      </div>
                      <div className="text-[11px] font-black flex items-center justify-end gap-1">
                        <span className="text-slate-600">Após:</span>
                        <span className={accountBalanceAfter < 0 ? 'text-rose-600' : 'text-emerald-700'}>
                          {formatCurrencyBRL(accountBalanceAfter)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 5. FORNECEDOR DO CRÉDITO & RESPONSÁVEL PELO PAGAMENTO */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
            {/* Qual o Fornecedor do Crédito */}
            <div className="bg-[#e0e6f1] rounded-xl p-2.5 border border-black shadow-2xs space-y-1">
              <label
                htmlFor="input-fornecedor-credito"
                className="block text-xs font-black text-black flex items-center justify-between"
              >
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#0963cb]" />
                  <span>
                    Qual o Fornecedor do Crédito (Favorecido) <span className="text-rose-600">*</span>
                  </span>
                </span>
                <span className="text-[10px] text-rose-600 font-bold bg-rose-50 border border-rose-300 px-1.5 py-0.5 rounded">
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
                className="w-full px-2.5 py-1.5 text-xs sm:text-sm font-bold bg-white text-black border border-gray-400 rounded-lg focus:ring-2 focus:ring-[#0963cb] outline-hidden shadow-2xs"
              />
            </div>

            {/* Responsável pelo Pagamento */}
            <div className="bg-[#e0e6f1] rounded-xl p-2.5 border border-black shadow-2xs space-y-1">
              <label
                htmlFor="select-funcionario-baixa"
                className="block text-xs font-black text-black flex items-center justify-between"
              >
                <span className="flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-[#0963cb]" />
                  <span>
                    Responsável pelo Pagamento (Quem realizou) <span className="text-rose-600">*</span>
                  </span>
                </span>
                <span className="text-[10px] text-slate-700 font-semibold">Obrigatório</span>
              </label>

              <select
                id="select-funcionario-baixa"
                required
                value={selectedEmployeeId}
                onChange={(e) => {
                  setSelectedEmployeeId(e.target.value);
                  setErrorMessage('');
                }}
                className="w-full px-2.5 py-1.5 text-xs sm:text-sm font-bold bg-white text-black border border-gray-400 rounded-lg focus:ring-2 focus:ring-[#0963cb] outline-hidden shadow-2xs cursor-pointer"
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
                    className="w-full px-2.5 py-1.5 text-xs sm:text-sm font-bold bg-white text-black border border-gray-400 rounded-lg focus:ring-2 focus:ring-[#0963cb] outline-hidden shadow-2xs"
                  />
                </div>
              )}
            </div>
          </div>

          {/* 6. CÓDIGO DE AUTENTICAÇÃO & OBSERVAÇÃO DA BAIXA (OPCIONAL) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
            <div className="bg-[#e0e6f1] rounded-xl p-2.5 border border-black shadow-2xs space-y-1">
              <label htmlFor="input-codigo-autenticacao-baixa" className="block text-xs font-black text-black flex items-center justify-between">
                <span>Código de Autenticação Bancária / ID da Transação (Opcional)</span>
                <span className="text-[10px] text-slate-700 font-semibold">Comprovante</span>
              </label>
              <input
                id="input-codigo-autenticacao-baixa"
                type="text"
                value={authenticationCode}
                onChange={(e) => setAuthenticationCode(e.target.value)}
                placeholder="Ex: E1234567820260912... ou Nº do documento"
                className="w-full px-2.5 py-1.5 text-xs sm:text-sm font-bold bg-white text-black border border-gray-400 rounded-lg focus:ring-2 focus:ring-[#0963cb] outline-hidden shadow-2xs font-mono"
              />
            </div>

            <div className="bg-[#e0e6f1] rounded-xl p-2.5 border border-black shadow-2xs space-y-1">
              <label htmlFor="input-observacao-baixa" className="block text-xs font-black text-black flex items-center justify-between">
                <span>Observação da Baixa (Opcional)</span>
                <span className="text-[10px] text-slate-700 font-semibold">Auditoria</span>
              </label>
              <input
                id="input-observacao-baixa"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Desconto negociado p/ pagto antecipado, multa por atraso..."
                className="w-full px-2.5 py-1.5 text-xs sm:text-sm font-semibold bg-white text-black border border-gray-400 rounded-lg focus:ring-2 focus:ring-[#0963cb] outline-hidden shadow-2xs"
              />
            </div>
          </div>

          </div>

          {/* BOTÕES DE AÇÃO */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-t border-black bg-[#cad4e6] shrink-0">
            <div className="text-[11px] font-bold">
              {isMissingBankAccount ? (
                <span className="text-amber-900 bg-amber-100 border border-black px-2 py-1 rounded-md inline-flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  <span>Selecione o Banco ou Caixa para liberar a baixa</span>
                </span>
              ) : (
                <span className="text-emerald-900">✓ Pronto para confirmar a liquidação.</span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                id="btn-cancelar-baixa"
                onClick={onClose}
                className="px-4 py-1.5 text-xs sm:text-sm font-bold rounded-lg bg-white border border-black text-black hover:bg-slate-100 cursor-pointer transition shadow-2xs"
              >
                Cancelar
              </button>
              <button
                type="submit"
                id="btn-confirmar-baixa-pagamento"
                disabled={isMissingBankAccount}
                title={isMissingBankAccount ? 'Selecione o Banco ou Caixa de onde sairá o dinheiro' : 'Confirmar liquidação do título'}
                className={`px-5 py-1.5 text-xs sm:text-sm font-black rounded-lg shadow-md transition flex items-center space-x-1.5 ${
                  isMissingBankAccount
                    ? 'bg-slate-300 text-slate-600 border border-slate-400 cursor-not-allowed shadow-none'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-800 cursor-pointer active:scale-98'
                }`}
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>
                  {isThirdPartyCheque
                    ? 'Confirmar Baixa com Cheque(s) de Terceiros'
                    : isCashBoxSelected
                      ? `Confirmar Baixa (${formatCurrencyBRL(effectivePaidAmount)}) via Caixa Interno`
                      : `Confirmar Baixa e Debitar ${formatCurrencyBRL(effectivePaidAmount)}`}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>

      <PaymentMethodsManagerModal
        isOpen={isPaymentMethodsManagerOpen}
        onClose={() => setIsPaymentMethodsManagerOpen(false)}
      />
    </div>
  );
};
