import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Check, 
  AlertCircle, 
  Calendar, 
  UserCheck, 
  Building2, 
  Landmark, 
  CreditCard, 
  DollarSign, 
  FileCheck2,
  Wallet,
  Clock,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { Expense, BankAccount, Employee, PaymentMethod } from '../../types';
import { formatCurrencyBRL, formatDateBR } from '../../lib/storage';
import { BankLogoIcon } from './BankLogoIcon';

export interface PaymentSettlementData {
  paymentDate: string;
  paidByEmployeeId: string;
  paidByEmployeeName: string;
  bankAccountId: string;
  bankAccountName: string;
  creditSupplier: string;
  paymentMethod: PaymentMethod;
  authenticationCode?: string;
  notes?: string;
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

  const [paymentDate, setPaymentDate] = useState(today);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [customEmployeeName, setCustomEmployeeName] = useState('');
  const [selectedBankAccountId, setSelectedBankAccountId] = useState('');
  const [creditSupplier, setCreditSupplier] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [authenticationCode, setAuthenticationCode] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Sincroniza ao abrir o modal
  useEffect(() => {
    if (!isOpen || !expense) return;
    setErrorMessage('');
    setPaymentDate(today);

    // Inicializa Fornecedor do Crédito
    setCreditSupplier(expense.creditSupplier || expense.supplier || '');

    // Se a despesa já tinha método de pagamento configurado
    if (expense.paymentMethod) {
      setPaymentMethod(expense.paymentMethod);
    } else {
      setPaymentMethod('pix');
    }

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
    } else if (bankAccounts.length === 1) {
      setSelectedBankAccountId(bankAccounts[0].id);
    } else if (bankAccounts.length > 0) {
      // Pré-seleciona a primeira conta disponível
      setSelectedBankAccountId(bankAccounts[0].id);
    } else {
      setSelectedBankAccountId('');
    }

    setAuthenticationCode(expense.paymentAuthenticationCode || '');
    setNotes(expense.notes || '');
  }, [isOpen, expense, bankAccounts, today]);

  // Lista de funcionários ativos
  const activeEmployees = useMemo(() => {
    return employees.filter((e) => e.active !== false);
  }, [employees]);

  // Conta bancária selecionada
  const selectedAccount = useMemo(() => {
    return bankAccounts.find((a) => a.id === selectedBankAccountId);
  }, [bankAccounts, selectedBankAccountId]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    // Validação 1: Data de pagamento
    if (!paymentDate) {
      setErrorMessage('Informe a data efetiva do pagamento.');
      return;
    }

    // Validação 2: Qual o Fornecedor do Crédito
    if (!creditSupplier.trim()) {
      setErrorMessage('Informe obrigatoriamente "Qual o Fornecedor do Crédito" para efetuar o pagamento.');
      return;
    }

    // Validação 3: Qual Banco (Conta Bancária de onde sairá o dinheiro)
    if (!selectedBankAccountId || !selectedAccount) {
      setErrorMessage('Selecione obrigatoriamente "Qual Banco" (Conta Bancária de onde sairá o dinheiro).');
      return;
    }

    // Validação 4: Identificação do Responsável ("quem fez o pagamento")
    let employeeName = '';
    let employeeId = selectedEmployeeId;

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

    onConfirmSettlement({
      expenseId: expense.id,
      paymentDate,
      paidByEmployeeId: employeeId,
      paidByEmployeeName: employeeName,
      bankAccountId: selectedAccount.id,
      bankAccountName: selectedAccount.name,
      creditSupplier: creditSupplier.trim(),
      paymentMethod,
      authenticationCode: authenticationCode.trim() || undefined,
      notes: notes.trim() || undefined,
    });

    onClose();
  };

  return (
    <div 
      id="modal-baixa-pagamento"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto backdrop-blur-xs animate-in fade-in"
      style={{ backgroundColor: 'rgba(9, 99, 203, 0.45)' }}
    >
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-stone-300 my-auto flex flex-col max-h-[94vh]">
        {/* CABEÇALHO */}
        <div 
          className="px-5 py-4 flex items-center justify-between text-white shrink-0 shadow-sm"
          style={{ backgroundColor: '#0963cb' }}
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0 shadow-inner">
              <FileCheck2 className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                Baixa de Conta a Pagar
              </h3>
              <p className="text-xs text-sky-100 font-medium">
                Identificação de responsável, vencimento e débito em conta bancária
              </p>
            </div>
          </div>

          <button
            type="button"
            id="btn-fechar-modal-baixa"
            onClick={onClose}
            className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/20 transition cursor-pointer"
            title="Fechar Modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* FORMULÁRIO */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-black">
          
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

          {/* CARD RESUMO DA DESPESA A PAGAR */}
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

          {/* BLOCO 1: QUAL BANCO (Conta Bancária de onde sairá o dinheiro) */}
          <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-2xs space-y-2.5">
            <label 
              htmlFor="select-conta-baixa" 
              className="block text-xs font-black text-black flex items-center justify-between"
            >
              <span className="flex items-center gap-1.5">
                <Landmark className="w-4 h-4 text-[#0963cb]" />
                <span>Qual Banco (Conta Bancária de onde sairá o dinheiro) <span className="text-rose-600">*</span></span>
              </span>
              <span className="text-[10px] text-rose-600 font-bold bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">Obrigatório</span>
            </label>

            {bankAccounts.length === 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 font-medium">
                Nenhuma conta bancária cadastrada no sistema. Cadastre uma conta na aba "Contas Bancárias" antes de realizar a baixa.
              </div>
            ) : (
              <div className="space-y-2">
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
                      {acc.bankCode ? `[${acc.bankCode}] ` : ''}{acc.name} ({acc.bankName}) - Saldo: {formatCurrencyBRL(acc.balance)}
                    </option>
                  ))}
                </select>

                {/* Pré-visualização do impacto no saldo */}
                {selectedAccount && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2.5">
                      <div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 overflow-hidden shadow-2xs"
                        style={{ backgroundColor: selectedAccount.color || '#0963cb' }}
                      >
                        <BankLogoIcon code={selectedAccount.bankCode} name={selectedAccount.bankName} size={20} className="text-white" />
                      </div>
                      <div>
                        <div className="font-bold text-black text-xs">
                          {selectedAccount.name}
                        </div>
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

          {/* BLOCO 2: QUAL O FORNECEDOR DO CRÉDITO */}
          <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-2xs space-y-2.5">
            <label 
              htmlFor="input-fornecedor-credito" 
              className="block text-xs font-black text-black flex items-center justify-between"
            >
              <span className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-[#0963cb]" />
                <span>Qual o Fornecedor do Crédito (Favorecido / Financiador) <span className="text-rose-600">*</span></span>
              </span>
              <span className="text-[10px] text-rose-600 font-bold bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">Obrigatório</span>
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
              placeholder="Ex: John Deere Financial, Banco do Brasil, Bradesco Financiamentos, Fornecedor X..."
              className="w-full px-3 py-2 text-xs sm:text-sm font-bold bg-white text-black border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#0963cb] outline-hidden shadow-2xs"
            />
            <span className="text-[10px] text-stone-500 font-medium block">
              Informe a instituição financeira, banco concedente de crédito ou fornecedor favorecido deste pagamento
            </span>
          </div>

          {/* BLOCO 3: RESPONSÁVEL PELO PAGAMENTO ("Quem fez o pagamento") */}
          <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-2xs space-y-2.5">
            <label 
              htmlFor="select-funcionario-baixa" 
              className="block text-xs font-black text-black flex items-center justify-between"
            >
              <span className="flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-[#0963cb]" />
                <span>Responsável pelo Pagamento (Quem realizou a operação) <span className="text-rose-600">*</span></span>
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

          {/* BLOCO: DATA DE PAGAMENTO & FORMA DE PAGAMENTO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Data do Pagamento */}
            <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-2xs space-y-1.5">
              <label htmlFor="input-data-pagamento-baixa" className="block text-xs font-black text-black">
                Data do Pagamento Efetivo <span className="text-rose-600">*</span>
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

            {/* Forma de Pagamento */}
            <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-2xs space-y-1.5">
              <label htmlFor="select-metodo-pagamento-baixa" className="block text-xs font-black text-black">
                Forma de Pagamento Utilizada
              </label>
              <select
                id="select-metodo-pagamento-baixa"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 text-xs sm:text-sm font-bold bg-white text-black border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#0963cb] outline-hidden shadow-2xs cursor-pointer capitalize"
              >
                <option value="pix">PIX</option>
                <option value="boleto">Boleto Bancário</option>
                <option value="transferencia">Transferência (TED / DOC)</option>
                <option value="cartao_debito">Cartão de Débito</option>
                <option value="cartao_credito">Cartão de Crédito</option>
                <option value="dinheiro">Dinheiro em Espécie (Caixa)</option>
                <option value="safra_prazo">Safra / A Prazo</option>
              </select>
              <span className="text-[10px] text-stone-500 block">
                Canal bancário utilizado
              </span>
            </div>
          </div>

          {/* BLOCO: CÓDIGO DE AUTENTICAÇÃO / COMPROVANTE (OPCIONAL) */}
          <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-2xs space-y-1.5">
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
              <span>Confirmar Baixa e Debitar Conta</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
