import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  ArrowUpRight, 
  Search, 
  AlertCircle, 
  Check, 
  Landmark, 
  UserCheck, 
  Calendar, 
  DollarSign,
  Tag,
  CreditCard,
  Building2,
  Receipt
} from 'lucide-react';
import { Expense, BankAccount, Employee, PaymentMethod } from '../../types';
import { formatCurrencyBRL, formatDateBR } from '../../lib/storage';

interface PayTitleQuickModalProps {
  isOpen: boolean;
  onClose: () => void;
  expenses: Expense[];
  accounts: BankAccount[];
  employees: Employee[];
  defaultAccountId?: string;
  onConfirmPayment: (params: {
    expenseId?: string;
    description: string;
    supplier: string;
    amount: number;
    paymentDate: string;
    bankAccountId: string;
    bankAccountName: string;
    paidByEmployeeId: string;
    paidByEmployeeName: string;
    paymentMethod: PaymentMethod;
    notes?: string;
    authenticationCode?: string;
  }) => void;
}

export const PayTitleQuickModal: React.FC<PayTitleQuickModalProps> = ({
  isOpen,
  onClose,
  expenses = [],
  accounts = [],
  employees = [],
  defaultAccountId,
  onConfirmPayment,
}) => {
  const today = new Date().toISOString().split('T')[0];

  const [mode, setMode] = useState<'pending' | 'direct'>('pending');
  const [selectedExpenseId, setSelectedExpenseId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Campos de liquidação
  const [paymentDate, setPaymentDate] = useState<string>(today);
  const [bankAccountId, setBankAccountId] = useState<string>('');
  const [employeeId, setEmployeeId] = useState<string>('');
  const [customEmployeeName, setCustomEmployeeName] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [authCode, setAuthCode] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Campos para lançamento direto
  const [directDescription, setDirectDescription] = useState<string>('');
  const [directSupplier, setDirectSupplier] = useState<string>('');
  const [directAmountStr, setDirectAmountStr] = useState<string>('');

  // Lista de despesas pendentes
  const pendingExpenses = useMemo(() => {
    return expenses.filter(e => e && e.status === 'pendente' && Number(e.amount) > 0);
  }, [expenses]);

  // Filtro de despesas pendentes
  const filteredPending = useMemo(() => {
    if (!searchTerm.trim()) return pendingExpenses;
    const q = searchTerm.toLowerCase();
    return pendingExpenses.filter(e => 
      (e.description || '').toLowerCase().includes(q) ||
      (e.supplier || '').toLowerCase().includes(q) ||
      (e.categoryName || '').toLowerCase().includes(q)
    );
  }, [pendingExpenses, searchTerm]);

  // Despesa selecionada
  const selectedExpense = useMemo(() => {
    return expenses.find(e => e.id === selectedExpenseId);
  }, [expenses, selectedExpenseId]);

  useEffect(() => {
    if (isOpen) {
      setErrorMessage('');
      setSearchTerm('');
      setPaymentDate(today);
      setPaymentMethod('pix');
      setAuthCode('');
      setNotes('');
      setDirectDescription('');
      setDirectSupplier('');
      setDirectAmountStr('');

      // Conta padrão (prioritária ou primeira)
      const initialAcc = defaultAccountId && accounts.some(a => a.id === defaultAccountId)
        ? defaultAccountId
        : (accounts.find(a => (a as any).isPriority || (a as any).prioritaria)?.id || accounts[0]?.id || '');
      setBankAccountId(initialAcc);

      // Se houver pendências, abre em modo pendente e pré-seleciona a primeira
      if (pendingExpenses.length > 0) {
        setMode('pending');
        setSelectedExpenseId(pendingExpenses[0].id);
      } else {
        setMode('direct');
        setSelectedExpenseId('');
      }

      // Funcionário padrão
      const activeEmps = employees.filter(e => e.active !== false);
      if (activeEmps.length > 0) {
        setEmployeeId(activeEmps[0].id);
      }
    }
  }, [isOpen, defaultAccountId, accounts, employees, pendingExpenses]);

  // Atualiza dados quando a despesa selecionada muda
  useEffect(() => {
    if (selectedExpense) {
      if (selectedExpense.bankAccountId && accounts.some(a => a.id === selectedExpense.bankAccountId)) {
        setBankAccountId(selectedExpense.bankAccountId);
      }
      if (selectedExpense.employeeId && employees.some(e => e.id === selectedExpense.employeeId)) {
        setEmployeeId(selectedExpense.employeeId);
      }
      if (selectedExpense.paymentMethod) {
        setPaymentMethod(selectedExpense.paymentMethod);
      }
    }
  }, [selectedExpense, accounts, employees]);

  const selectedAccount = useMemo(() => {
    return accounts.find(a => a.id === bankAccountId);
  }, [accounts, bankAccountId]);

  // Valor a pagar
  const effectiveAmount = useMemo(() => {
    if (mode === 'pending') {
      return selectedExpense ? Number(selectedExpense.amount) || 0 : 0;
    } else {
      if (!directAmountStr) return 0;
      const clean = directAmountStr.replace(/[^\d,]/g, '').replace(',', '.');
      return parseFloat(clean) || 0;
    }
  }, [mode, selectedExpense, directAmountStr]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!bankAccountId || !selectedAccount) {
      setErrorMessage('SELECIONE A CONTA BANCÁRIA DE ONDE SAIRÁ O PAGAMENTO.');
      return;
    }

    if (!paymentDate) {
      setErrorMessage('INFORME A DATA DO PAGAMENTO.');
      return;
    }

    let finalEmployeeName = '';
    if (employeeId === 'outro') {
      if (!customEmployeeName.trim()) {
        setErrorMessage('INFORME O NOME DO RESPONSÁVEL QUE EFETUOU O PAGAMENTO.');
        return;
      }
      finalEmployeeName = customEmployeeName.trim().toUpperCase();
    } else if (employeeId) {
      const emp = employees.find(e => e.id === employeeId);
      finalEmployeeName = emp?.name?.toUpperCase() || 'RESPONSÁVEL FINANCEIRO';
    } else {
      setErrorMessage('SELECIONE O FUNCIONÁRIO RESPONSÁVEL PELO PAGAMENTO.');
      return;
    }

    if (mode === 'pending') {
      if (!selectedExpenseId || !selectedExpense) {
        setErrorMessage('SELECIONE O TÍTULO PENDENTE A SER PAGO.');
        return;
      }

      onConfirmPayment({
        expenseId: selectedExpense.id,
        description: selectedExpense.description.toUpperCase(),
        supplier: (selectedExpense.supplier || selectedExpense.creditSupplier || 'FORNECEDOR').toUpperCase(),
        amount: Number(selectedExpense.amount) || 0,
        paymentDate,
        bankAccountId: selectedAccount.id,
        bankAccountName: selectedAccount.name,
        paidByEmployeeId: employeeId,
        paidByEmployeeName: finalEmployeeName,
        paymentMethod,
        notes: notes.trim().toUpperCase() || undefined,
        authenticationCode: authCode.trim().toUpperCase() || undefined,
      });
    } else {
      if (!directDescription.trim()) {
        setErrorMessage('INFORME A DESCRIÇÃO DO TÍTULO / DESPESA.');
        return;
      }
      if (!directSupplier.trim()) {
        setErrorMessage('INFORME O NOME DO CREDOR / FORNECEDOR.');
        return;
      }
      if (effectiveAmount <= 0) {
        setErrorMessage('INFORME UM VALOR VÁLIDO (MAIOR QUE ZERO).');
        return;
      }

      onConfirmPayment({
        description: directDescription.trim().toUpperCase(),
        supplier: directSupplier.trim().toUpperCase(),
        amount: effectiveAmount,
        paymentDate,
        bankAccountId: selectedAccount.id,
        bankAccountName: selectedAccount.name,
        paidByEmployeeId: employeeId,
        paidByEmployeeName: finalEmployeeName,
        paymentMethod,
        notes: notes.trim().toUpperCase() || undefined,
        authenticationCode: authCode.trim().toUpperCase() || undefined,
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-hidden">
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-pay-title"
        className="w-full max-w-2xl bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-2xl shadow-2xl flex flex-col max-h-[94vh] overflow-hidden"
      >
        {/* CABEÇALHO METÁLICO ACETINADO COM DESTAQUE VERDE PROFISSIONAL */}
        <div className="bg-gradient-to-r from-emerald-950 via-[#1b5e20] to-[#164e28] text-white px-4 py-2.5 flex items-center justify-between shrink-0 shadow-xs border-b border-emerald-900">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center shadow-xs">
              <ArrowUpRight className="w-4 h-4 stroke-[3]" />
            </div>
            <div>
              <h3 id="modal-pay-title" className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                PAGAR TÍTULO — BAIXA OPERACIONAL
              </h3>
              <p className="text-[10px] text-emerald-200 font-semibold uppercase">
                DÉBITO BANCÁRIO E LIQUIDAÇÃO DE CONTAS A PAGAR
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

          {/* SELETOR DE MODALIDADE: TÍTULO EXISTENTE OU AVULSO */}
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
              SELECIONAR TÍTULO PENDENTE ({pendingExpenses.length})
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
              PAGAMENTO AVULSO / DIRETO
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
                    placeholder="BUSCAR POR CREDOR, DESCRIÇÃO OU CATEGORIA..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg pl-8 pr-3 py-1.5 font-bold text-stone-900 dark:text-white uppercase outline-none focus:ring-1 focus:ring-[#1b5e20] text-xs"
                  />
                </div>
              </div>

              {filteredPending.length === 0 ? (
                <div className="p-4 text-center rounded-xl border border-dashed border-stone-300 dark:border-stone-700 text-stone-500 uppercase text-[11px] font-bold">
                  NENHUM TÍTULO PENDENTE ENCONTRADO. VOCÊ PODE ALTERNAR PARA "PAGAMENTO AVULSO / DIRETO".
                </div>
              ) : (
                <div className="max-h-40 overflow-y-auto space-y-1 rounded-xl border border-stone-200 dark:border-stone-700 p-1 bg-stone-50/50 dark:bg-stone-850">
                  {filteredPending.map((exp) => {
                    const isSelected = exp.id === selectedExpenseId;
                    return (
                      <div
                        key={exp.id}
                        onClick={() => setSelectedExpenseId(exp.id)}
                        className={`p-2 rounded-lg border transition cursor-pointer flex items-center justify-between text-xs ${
                          isSelected
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-950 dark:text-emerald-200'
                            : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 hover:border-emerald-300'
                        }`}
                      >
                        <div className="space-y-0.5 truncate pr-2">
                          <div className="font-black uppercase truncate flex items-center gap-1.5">
                            <span className="text-[11px]">{exp.supplier || 'CREDOR NÃO INFORMADO'}</span>
                            <span className="text-[9px] px-1 py-0.2 rounded bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300 font-semibold">
                              {exp.categoryName || 'GERAL'}
                            </span>
                          </div>
                          <div className="text-[10px] text-stone-500 dark:text-stone-400 font-semibold uppercase truncate">
                            {exp.description} • VENC: {formatDateBR(exp.dueDate || exp.date)}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-mono font-black text-xs text-rose-700 dark:text-rose-400 block">
                            {formatCurrencyBRL(exp.amount)}
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

          {/* MODO 2: PAGAMENTO AVULSO / DIRETO */}
          {mode === 'direct' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-850">
              <div className="sm:col-span-2 space-y-1">
                <label htmlFor="direct-desc-input" className="block text-[10px] font-black text-stone-700 dark:text-stone-300 uppercase tracking-wide">
                  DESCRIÇÃO DA DESPESA / TÍTULO *
                </label>
                <input
                  id="direct-desc-input"
                  type="text"
                  placeholder="EX: ABASTECIMENTO EXTRA OU MANUTENÇÃO"
                  value={directDescription}
                  onChange={(e) => setDirectDescription(e.target.value.toUpperCase())}
                  className="w-full bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg px-2.5 py-1.5 font-bold text-stone-900 dark:text-white uppercase outline-none focus:ring-1 focus:ring-[#1b5e20] text-xs"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="direct-amount-input" className="block text-[10px] font-black text-stone-700 dark:text-stone-300 uppercase tracking-wide">
                  VALOR (R$) *
                </label>
                <input
                  id="direct-amount-input"
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
                <label htmlFor="direct-supplier-input" className="block text-[10px] font-black text-stone-700 dark:text-stone-300 uppercase tracking-wide">
                  FORNECEDOR / CREDOR DO PAGAMENTO *
                </label>
                <input
                  id="direct-supplier-input"
                  type="text"
                  placeholder="NOME DA EMPRESA OU BENEFICIÁRIO"
                  value={directSupplier}
                  onChange={(e) => setDirectSupplier(e.target.value.toUpperCase())}
                  className="w-full bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg px-2.5 py-1.5 font-bold text-stone-900 dark:text-white uppercase outline-none focus:ring-1 focus:ring-[#1b5e20] text-xs"
                />
              </div>
            </div>
          )}

          {/* DADOS DA BAIXA FINANCEIRA */}
          <div className="space-y-2 pt-1 border-t border-stone-200 dark:border-stone-700">
            <div className="text-[10px] font-black text-stone-500 dark:text-stone-400 uppercase tracking-wider">
              PARÂMETROS DA BAIXA BANCÁRIA
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* CONTA BANCÁRIA */}
              <div className="space-y-1">
                <label htmlFor="pay-bank-account-select" className="block text-[10px] font-black text-stone-700 dark:text-stone-300 uppercase tracking-wide">
                  DE ONDE SAI O DINHEIRO (CONTA BANCÁRIA) *
                </label>
                <select
                  id="pay-bank-account-select"
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

              {/* FORMA DE PAGAMENTO */}
              <div className="space-y-1">
                <label htmlFor="pay-method-select" className="block text-[10px] font-black text-stone-700 dark:text-stone-300 uppercase tracking-wide">
                  FORMA DE PAGAMENTO *
                </label>
                <select
                  id="pay-method-select"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg px-2.5 py-1.5 font-bold text-stone-900 dark:text-white uppercase focus:ring-1 focus:ring-[#1b5e20] outline-none text-xs"
                >
                  <option value="pix">PIX</option>
                  <option value="transferencia">TRANSFERÊNCIA (TED / DOC)</option>
                  <option value="boleto">BOLETO BANCÁRIO</option>
                  <option value="debito">CARTÃO DE DÉBITO</option>
                  <option value="dinheiro">DINHEIRO (ESPÉCIE / CAIXA)</option>
                  <option value="cheque">CHEQUE</option>
                </select>
              </div>

              {/* DATA DO PAGAMENTO */}
              <div className="space-y-1">
                <label htmlFor="pay-date-input" className="block text-[10px] font-black text-stone-700 dark:text-stone-300 uppercase tracking-wide">
                  DATA EFETIVA DO PAGAMENTO *
                </label>
                <input
                  id="pay-date-input"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg px-2.5 py-1.5 font-bold text-stone-900 dark:text-white uppercase outline-none focus:ring-1 focus:ring-[#1b5e20] text-xs"
                />
              </div>

              {/* RESPONSÁVEL / FUNCIONÁRIO */}
              <div className="space-y-1">
                <label htmlFor="pay-employee-select" className="block text-[10px] font-black text-stone-700 dark:text-stone-300 uppercase tracking-wide">
                  RESPONSÁVEL PELO PAGAMENTO *
                </label>
                <select
                  id="pay-employee-select"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="w-full bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg px-2.5 py-1.5 font-bold text-stone-900 dark:text-white uppercase focus:ring-1 focus:ring-[#1b5e20] outline-none text-xs"
                >
                  {employees.filter(e => e.active !== false).map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name.toUpperCase()}
                    </option>
                  ))}
                  <option value="outro">OUTRO RESPONSÁVEL (DIGITAR NOME)</option>
                </select>
                {employeeId === 'outro' && (
                  <input
                    type="text"
                    placeholder="DIGITE O NOME DO RESPONSÁVEL"
                    value={customEmployeeName}
                    onChange={(e) => setCustomEmployeeName(e.target.value.toUpperCase())}
                    className="w-full mt-1 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg px-2.5 py-1 font-bold text-stone-900 dark:text-white uppercase text-xs"
                  />
                )}
              </div>
            </div>

            {/* COMPROVANTE E OBSERVAÇÕES */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label htmlFor="pay-auth-input" className="block text-[10px] font-black text-stone-700 dark:text-stone-300 uppercase tracking-wide">
                  CÓDIGO DE AUTENTICAÇÃO / PROTOCOLO (OPCIONAL)
                </label>
                <input
                  id="pay-auth-input"
                  type="text"
                  placeholder="EX: AUTH-98218-BRL"
                  value={authCode}
                  onChange={(e) => setAuthCode(e.target.value.toUpperCase())}
                  className="w-full bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg px-2.5 py-1.5 font-bold text-stone-900 dark:text-white uppercase outline-none text-xs"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="pay-notes-input" className="block text-[10px] font-black text-stone-700 dark:text-stone-300 uppercase tracking-wide">
                  OBSERVAÇÕES ADICIONAIS (OPCIONAL)
                </label>
                <input
                  id="pay-notes-input"
                  type="text"
                  placeholder="OBSERVAÇÕES DE QUITAÇÃO"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value.toUpperCase())}
                  className="w-full bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg px-2.5 py-1.5 font-bold text-stone-900 dark:text-white uppercase outline-none text-xs"
                />
              </div>
            </div>
          </div>

          {/* RESUMO DO VALOR A SER DEBITADO */}
          {effectiveAmount > 0 && selectedAccount && (
            <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black text-emerald-900 dark:text-emerald-300 uppercase block">
                  TOTAL A LIQUIDAR DA CONTA:
                </span>
                <span className="text-[10px] text-stone-600 dark:text-stone-400 font-semibold uppercase">
                  CONTA: {selectedAccount.name} • SALDO RESTANTE: {formatCurrencyBRL(selectedAccount.balance - effectiveAmount)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-base sm:text-lg font-black text-[#1b5e20] dark:text-emerald-400 font-['Outfit']">
                  {formatCurrencyBRL(effectiveAmount)}
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
              <ArrowUpRight className="w-3.5 h-3.5 stroke-[3]" />
              <span>CONFIRMAR PAGAMENTO</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
