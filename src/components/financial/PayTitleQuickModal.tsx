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
  Receipt,
  Settings,
} from 'lucide-react';
import { Expense, BankAccount, Employee, PaymentMethod } from '../../types';
import { formatCurrencyBRL, formatDateBR } from '../../lib/storage';
import {
  useGlobalPaymentMethods,
  getPaymentMethodKey,
  getGlobalPaymentMethodLabel,
  extractGlobalPaymentMethodFromRecord,
} from '../../lib/paymentMethodsStorage';
import { PaymentMethodsManagerModal } from '../common/PaymentMethodsManager';

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
  const [isPaymentMethodsManagerOpen, setIsPaymentMethodsManagerOpen] = useState<boolean>(false);
  const { activeMethods: activeGlobalPaymentMethods } = useGlobalPaymentMethods();

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
      const resolvedMethod = extractGlobalPaymentMethodFromRecord(selectedExpense);
      if (resolvedMethod) {
        setPaymentMethod(resolvedMethod);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 overflow-hidden" style={{ backgroundColor: 'rgba(0, 0, 0, 0.60)' }}>
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-pay-title"
        className="w-[88vw] max-w-[1300px] h-[92vh] max-h-[92vh] bg-[#cad4e6] border border-black rounded-xl shadow-2xl flex flex-col justify-between mx-auto my-auto overflow-hidden"
      >
        {/* CABEÇALHO */}
        <div className="bg-[#cad4e6] text-black px-4 sm:px-5 py-3 flex items-center justify-between shrink-0 border-b border-black">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-white border border-black text-emerald-700 flex items-center justify-center shrink-0">
              <ArrowUpRight className="w-4 h-4 stroke-[3]" />
            </div>
            <div>
              <h3 id="modal-pay-title" className="text-sm sm:text-base font-black uppercase tracking-wide text-black">
                PAGAR TÍTULO — BAIXA OPERACIONAL
              </h3>
              <p className="text-[11px] text-black/80 font-medium uppercase">
                DÉBITO BANCÁRIO E LIQUIDAÇÃO DE CONTAS A PAGAR
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

          {/* SELETOR DE MODALIDADE: TÍTULO EXISTENTE OU AVULSO */}
          <div className="flex rounded-xl p-1 bg-[#e0e6f1] border border-black gap-1">
            <button
              type="button"
              onClick={() => setMode('pending')}
              className={`flex-1 py-2 px-3 rounded-lg font-black text-xs transition cursor-pointer uppercase ${
                mode === 'pending'
                  ? 'bg-white border border-black text-emerald-800 shadow-xs'
                  : 'text-black/70 hover:text-black'
              }`}
            >
              SELECIONAR TÍTULO PENDENTE ({pendingExpenses.length})
            </button>
            <button
              type="button"
              onClick={() => setMode('direct')}
              className={`flex-1 py-2 px-3 rounded-lg font-black text-xs transition cursor-pointer uppercase ${
                mode === 'direct'
                  ? 'bg-white border border-black text-emerald-800 shadow-xs'
                  : 'text-black/70 hover:text-black'
              }`}
            >
              PAGAMENTO AVULSO / DIRETO
            </button>
          </div>

          {/* MODO 1: SELEÇÃO DE TÍTULO PENDENTE */}
          {mode === 'pending' && (
            <div className="space-y-2.5 bg-[#e0e6f1] border border-black rounded-xl p-3.5">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" />
                  <input
                    type="text"
                    placeholder="BUSCAR POR CREDOR, DESCRIÇÃO OU CATEGORIA..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white border border-gray-400 rounded-lg pl-8 pr-3 py-1.5 font-bold text-black uppercase outline-none focus:ring-1 focus:ring-emerald-700 text-xs"
                  />
                </div>
              </div>

              {filteredPending.length === 0 ? (
                <div className="p-4 text-center rounded-xl border border-dashed border-black bg-white text-black uppercase text-[11px] font-bold">
                  NENHUM TÍTULO PENDENTE ENCONTRADO. VOCÊ PODE ALTERNAR PARA "PAGAMENTO AVULSO / DIRETO".
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-xl border border-black p-1.5 bg-white">
                  {filteredPending.map((exp) => {
                    const isSelected = exp.id === selectedExpenseId;
                    return (
                      <div
                        key={exp.id}
                        onClick={() => setSelectedExpenseId(exp.id)}
                        className={`p-2 rounded-lg border transition cursor-pointer flex items-center justify-between text-xs ${
                          isSelected
                            ? 'bg-emerald-50 border-emerald-700 text-emerald-950'
                            : 'bg-white border-gray-300 hover:border-black'
                        }`}
                      >
                        <div className="space-y-0.5 truncate pr-2">
                          <div className="font-black uppercase truncate flex items-center gap-1.5">
                            <span className="text-[11px]">{exp.supplier || 'CREDOR NÃO INFORMADO'}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#e0e6f1] border border-black/30 text-black font-semibold">
                              {exp.categoryName || 'GERAL'}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-700 font-semibold uppercase truncate">
                            {exp.description} • VENC: {formatDateBR(exp.dueDate || exp.date)}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-mono font-black text-xs text-rose-700 block">
                            {formatCurrencyBRL(exp.amount)}
                          </span>
                          {isSelected && (
                            <span className="text-[9px] font-black text-emerald-700 uppercase">
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3.5 rounded-xl border border-black bg-[#e0e6f1]">
              <div className="sm:col-span-2 space-y-1">
                <label htmlFor="direct-desc-input" className="block text-[10px] font-black text-black uppercase tracking-wide">
                  DESCRIÇÃO DA DESPESA / TÍTULO *
                </label>
                <input
                  id="direct-desc-input"
                  type="text"
                  placeholder="EX: ABASTECIMENTO EXTRA OU MANUTENÇÃO"
                  value={directDescription}
                  onChange={(e) => setDirectDescription(e.target.value.toUpperCase())}
                  className="w-full bg-white border border-black rounded-lg px-2.5 py-1.5 font-bold text-black uppercase outline-none focus:ring-1 focus:ring-[#1b5e20] text-xs"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="direct-amount-input" className="block text-[10px] font-black text-black uppercase tracking-wide">
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
                  className="w-full bg-white border border-black rounded-lg px-2.5 py-1.5 font-black text-black font-['Outfit'] text-xs focus:ring-1 focus:ring-[#1b5e20] outline-none"
                />
              </div>

              <div className="sm:col-span-3 space-y-1">
                <label htmlFor="direct-supplier-input" className="block text-[10px] font-black text-black uppercase tracking-wide">
                  FORNECEDOR / CREDOR DO PAGAMENTO *
                </label>
                <input
                  id="direct-supplier-input"
                  type="text"
                  placeholder="NOME DA EMPRESA OU BENEFICIÁRIO"
                  value={directSupplier}
                  onChange={(e) => setDirectSupplier(e.target.value.toUpperCase())}
                  className="w-full bg-white border border-black rounded-lg px-2.5 py-1.5 font-bold text-black uppercase outline-none focus:ring-1 focus:ring-[#1b5e20] text-xs"
                />
              </div>
            </div>
          )}

          {/* DADOS DA BAIXA FINANCEIRA */}
          <div className="space-y-2.5 p-3.5 bg-[#e0e6f1] border border-black rounded-xl">
            <div className="text-[10px] font-black text-black uppercase tracking-wider">
              PARÂMETROS DA BAIXA BANCÁRIA
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* CONTA BANCÁRIA */}
              <div className="space-y-1">
                <label htmlFor="pay-bank-account-select" className="block text-[10px] font-black text-black uppercase tracking-wide">
                  DE ONDE SAI O DINHEIRO (CONTA BANCÁRIA) *
                </label>
                <select
                  id="pay-bank-account-select"
                  value={bankAccountId}
                  onChange={(e) => setBankAccountId(e.target.value)}
                  className="w-full bg-white border border-black rounded-lg px-2.5 py-1.5 font-bold text-black uppercase focus:ring-1 focus:ring-[#1b5e20] outline-none text-xs"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.bankName} - {acc.name} ({formatCurrencyBRL(acc.balance)})
                    </option>
                  ))}
                </select>
                {selectedAccount && (
                  <div className="text-[9.5px] text-slate-700 font-semibold uppercase mt-0.5">
                    SALDO ATUAL: <strong className="text-black">{formatCurrencyBRL(selectedAccount.balance)}</strong>
                  </div>
                )}
              </div>

              {/* FORMA DE PAGAMENTO */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="pay-method-select" className="block text-[10px] font-black text-black uppercase tracking-wide">
                    FORMA DE PAGAMENTO *
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
                  id="pay-method-select"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full bg-white border border-black rounded-lg px-2.5 py-1.5 font-bold text-black uppercase focus:ring-1 focus:ring-[#1b5e20] outline-none text-xs cursor-pointer"
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

              {/* DATA DO PAGAMENTO */}
              <div className="space-y-1">
                <label htmlFor="pay-date-input" className="block text-[10px] font-black text-black uppercase tracking-wide">
                  DATA EFETIVA DO PAGAMENTO *
                </label>
                <input
                  id="pay-date-input"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full bg-white border border-black rounded-lg px-2.5 py-1.5 font-bold text-black uppercase outline-none focus:ring-1 focus:ring-[#1b5e20] text-xs"
                />
              </div>

              {/* RESPONSÁVEL / FUNCIONÁRIO */}
              <div className="space-y-1">
                <label htmlFor="pay-employee-select" className="block text-[10px] font-black text-black uppercase tracking-wide">
                  RESPONSÁVEL PELO PAGAMENTO *
                </label>
                <select
                  id="pay-employee-select"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="w-full bg-white border border-black rounded-lg px-2.5 py-1.5 font-bold text-black uppercase focus:ring-1 focus:ring-[#1b5e20] outline-none text-xs"
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
                    className="w-full mt-1 bg-white border border-black rounded-lg px-2.5 py-1 font-bold text-black uppercase text-xs"
                  />
                )}
              </div>
            </div>

            {/* COMPROVANTE E OBSERVAÇÕES */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label htmlFor="pay-auth-input" className="block text-[10px] font-black text-black uppercase tracking-wide">
                  CÓDIGO DE AUTENTICAÇÃO / PROTOCOLO (OPCIONAL)
                </label>
                <input
                  id="pay-auth-input"
                  type="text"
                  placeholder="EX: AUTH-98218-BRL"
                  value={authCode}
                  onChange={(e) => setAuthCode(e.target.value.toUpperCase())}
                  className="w-full bg-white border border-black rounded-lg px-2.5 py-1.5 font-bold text-black uppercase outline-none text-xs"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="pay-notes-input" className="block text-[10px] font-black text-black uppercase tracking-wide">
                  OBSERVAÇÕES ADICIONAIS (OPCIONAL)
                </label>
                <input
                  id="pay-notes-input"
                  type="text"
                  placeholder="OBSERVAÇÕES DE QUITAÇÃO"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value.toUpperCase())}
                  className="w-full bg-white border border-black rounded-lg px-2.5 py-1.5 font-bold text-black uppercase outline-none text-xs"
                />
              </div>
            </div>
          </div>

          {/* RESUMO DO VALOR A SER DEBITADO */}
          {effectiveAmount > 0 && selectedAccount && (
            <div className="p-3 bg-[#e0e6f1] rounded-xl border border-black flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black text-black uppercase block">
                  TOTAL A LIQUIDAR DA CONTA:
                </span>
                <span className="text-[10px] text-slate-800 font-semibold uppercase">
                  CONTA: {selectedAccount.name} • SALDO RESTANTE: {formatCurrencyBRL(selectedAccount.balance - effectiveAmount)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-base sm:text-lg font-black text-emerald-700 font-['Outfit']">
                  {formatCurrencyBRL(effectiveAmount)}
                </span>
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
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black transition cursor-pointer shadow-xs active:scale-95 inline-flex items-center gap-1.5 uppercase text-xs border border-emerald-800"
            >
              <ArrowUpRight className="w-3.5 h-3.5 stroke-[3]" />
              <span>CONFIRMAR PAGAMENTO</span>
            </button>
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
