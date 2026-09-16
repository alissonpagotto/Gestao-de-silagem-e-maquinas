import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  Wallet, 
  Landmark, 
  CreditCard, 
  DollarSign, 
  Sparkles, 
  X, 
  Check, 
  AlertCircle,
  HelpCircle,
  QrCode,
  ShieldAlert,
  ArrowRight,
  Plus,
  Trash2,
  Calendar,
  UserCheck,
  RefreshCw,
  Zap,
  CheckCircle2
} from 'lucide-react';
import { BankAccount, CorporateCard, Employee, Expense } from '../../types';
import { formatCurrencyBRL, formatDateBR, getStoredEmployees, getStoredExpenses, saveStoredExpenses } from '../../lib/storage';
import { formatarMoeda, desformatarMoeda } from '../../lib/formatters';
import { BankCombobox } from './BankCombobox';
import { BRAZILIAN_BANKS } from './brazilianBanks';
import { BankLogoIcon } from './BankLogoIcon';

export interface BankAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingAccount: BankAccount | null;
  onSave: (account: Omit<BankAccount, 'id'> & { id?: string }) => void;
  employees?: Employee[];
  expenses?: Expense[];
  onProvisionCardInvoice?: (params: {
    card: CorporateCard;
    account?: BankAccount;
    amount: number;
    dueDate: string;
    description: string;
  }) => void;
}

// Opções rápidas de paleta de cores para identificar a conta
const COLOR_PRESETS = [
  { label: 'BB Amarelo', color: '#eab308' },
  { label: 'Bradesco Vermelho', color: '#dc2626' },
  { label: 'Itaú Laranja', color: '#ea580c' },
  { label: 'Santander Vermelho', color: '#e11d48' },
  { label: 'Caixa Azul', color: '#0284c7' },
  { label: 'Nubank Roxo', color: '#8b5cf6' },
  { label: 'Inter Laranja', color: '#f97316' },
  { label: 'Sicredi Verde', color: '#16a34a' },
  { label: 'Sicoob Esmeralda', color: '#059669' },
  { label: 'Teal Agrícola', color: '#0d9488' },
  { label: 'Azul Institucional', color: '#0963cb' },
  { label: 'Cinza / Caixa Sede', color: '#475569' },
];

/**
 * Aplica máscara de acordo com o tipo de chave PIX selecionado
 */
function applyPixMask(value: string, type: 'cpf' | 'cnpj' | 'phone' | 'email' | 'random'): string {
  if (!value) return '';
  switch (type) {
    case 'cpf': {
      const digits = value.replace(/\D/g, '').slice(0, 11);
      if (digits.length <= 3) return digits;
      if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
      if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
      return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
    }
    case 'cnpj': {
      const digits = value.replace(/\D/g, '').slice(0, 14);
      if (digits.length <= 2) return digits;
      if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
      if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
      if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
      return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
    }
    case 'phone': {
      const digits = value.replace(/\D/g, '').slice(0, 11);
      if (!digits) return '';
      if (digits.length <= 2) return `(${digits}`;
      if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
      if (digits.length <= 10) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
      }
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
    }
    case 'email':
      return value.trim().toLowerCase();
    case 'random':
      return value.trim();
    default:
      return value;
  }
}

/**
 * Identifica o tipo de chave PIX caso esteja editando uma conta antiga sem tipo especificado
 */
function detectPixType(key: string): 'cpf' | 'cnpj' | 'phone' | 'email' | 'random' {
  if (!key) return 'cpf';
  const clean = key.trim();
  if (clean.includes('@')) return 'email';
  const digits = clean.replace(/\D/g, '');
  if (digits.length === 14 || clean.includes('/')) return 'cnpj';
  if (clean.includes('(') || clean.includes(')')) return 'phone';
  if (clean.length > 25 && clean.includes('-')) return 'random';
  if (digits.length === 11 && clean.includes('.')) return 'cpf';
  if (digits.length === 11) return 'cpf';
  if (digits.length === 10) return 'phone';
  return 'cpf';
}

export const BankAccountModal: React.FC<BankAccountModalProps> = ({
  isOpen,
  onClose,
  editingAccount,
  onSave,
  employees = [],
  expenses = [],
  onProvisionCardInvoice,
}) => {
  // Form State
  const [name, setName] = useState('');
  const [bankName, setBankName] = useState('Banco do Brasil');
  const [bankCode, setBankCode] = useState<string | undefined>('001');
  const [accountType, setAccountType] = useState<BankAccount['accountType']>('corrente');
  const [agency, setAgency] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountDigit, setAccountDigit] = useState('');
  
  // Saldo e Cheque Especial
  const [balanceInput, setBalanceInput] = useState('0,00');
  const [isNegativeBalance, setIsNegativeBalance] = useState(false);
  const [overdraftInput, setOverdraftInput] = useState('0,00');
  
  // Chave PIX
  const [pixKeyType, setPixKeyType] = useState<'cpf' | 'cnpj' | 'phone' | 'email' | 'random'>('cpf');
  const [pixKey, setPixKey] = useState('');
  
  // Cor
  const [color, setColor] = useState('#009688');
  const [validationError, setValidationError] = useState('');

  // Cartões Corporativos Vinculados
  const [corporateCards, setCorporateCards] = useState<CorporateCard[]>([]);
  const [cardNotification, setCardNotification] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // Lista de funcionários disponíveis (prop ou storage)
  const availableEmployees: Employee[] = useMemo(() => {
    if (employees && employees.length > 0) return employees;
    return getStoredEmployees();
  }, [employees]);

  // Lista de despesas do sistema para cálculo de despesas acumuladas
  const systemExpenses: Expense[] = useMemo(() => {
    if (expenses && expenses.length > 0) return expenses;
    return getStoredExpenses();
  }, [expenses]);

  // Helper para calcular soma de despesas lançadas no sistema para um determinado cartão
  const getCardExpensesSum = (card: CorporateCard): number => {
    if (!systemExpenses || systemExpenses.length === 0) return 0;
    return systemExpenses
      .filter((e) => {
        if (e.status === 'pago') return false; // Apenas despesas abertas / a pagar
        if (e.corporateCardId && e.corporateCardId === card.id) return true;
        if (card.name && e.corporateCardName && e.corporateCardName.toLowerCase() === card.name.toLowerCase()) return true;
        if (
          card.responsibleEmployeeId &&
          e.employeeId === card.responsibleEmployeeId &&
          (e.paymentMethod === 'cartao_credito' || e.paymentMethod === 'cartao_debito')
        ) {
          return true;
        }
        return false;
      })
      .reduce((sum, e) => sum + (e.amount || 0), 0);
  };

  // Helper para calcular a data de vencimento da fatura com precisão
  const calculateDueDate = (dueDay: number): string => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const currentDay = today.getDate();

    let targetYear = currentYear;
    let targetMonth = currentMonth;

    if (currentDay > dueDay) {
      targetMonth += 1;
      if (targetMonth > 11) {
        targetMonth = 0;
        targetYear += 1;
      }
    }

    const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const finalDay = Math.min(Math.max(1, dueDay), daysInMonth);

    const formattedMonth = String(targetMonth + 1).padStart(2, '0');
    const formattedDay = String(finalDay).padStart(2, '0');
    return `${targetYear}-${formattedMonth}-${formattedDay}`;
  };

  // Sincroniza ao abrir o modal
  useEffect(() => {
    if (!isOpen) return;
    setValidationError('');
    setCardNotification(null);

    if (editingAccount) {
      setName(editingAccount.name || '');
      setBankName(editingAccount.bankName || 'Banco do Brasil');
      setBankCode(editingAccount.bankCode || undefined);
      setAccountType(editingAccount.accountType || 'corrente');
      setAgency(editingAccount.agency || '');
      setAccountNumber(editingAccount.accountNumber || '');
      setAccountDigit(editingAccount.accountDigit || '');

      // Saldo Inicial
      const currentBal = editingAccount.balance || 0;
      setIsNegativeBalance(currentBal < 0);
      const absBal = Math.abs(currentBal);
      setBalanceInput(absBal > 0 ? formatarMoeda(Math.round(absBal * 100)) : '0,00');

      // Limite de Cheque Especial
      const currentOverdraft = editingAccount.overdraftLimit || 0;
      setOverdraftInput(currentOverdraft > 0 ? formatarMoeda(Math.round(currentOverdraft * 100)) : '0,00');

      // PIX
      const pKey = editingAccount.pixKey || '';
      const pType = editingAccount.pixKeyType || detectPixType(pKey);
      setPixKeyType(pType);
      setPixKey(applyPixMask(pKey, pType));

      setColor(editingAccount.color || '#009688');

      // Cartões Corporativos Vinculados
      if (editingAccount.corporateCards && editingAccount.corporateCards.length > 0) {
        setCorporateCards(editingAccount.corporateCards.map(card => ({ ...card })));
      } else {
        setCorporateCards([]);
      }
    } else {
      setName('');
      setBankName('Banco do Brasil');
      setBankCode('001');
      setAccountType('corrente');
      setAgency('');
      setAccountNumber('');
      setAccountDigit('');
      setBalanceInput('0,00');
      setIsNegativeBalance(false);
      setOverdraftInput('0,00');
      setPixKeyType('cpf');
      setPixKey('');
      setColor('#eab308'); // default yellow for BB
      setCorporateCards([]);
    }
  }, [isOpen, editingAccount]);

  // Cálculos dinâmicos em tempo real
  const numericBalance = useMemo(() => {
    const raw = desformatarMoeda(balanceInput);
    return isNegativeBalance ? -raw : raw;
  }, [balanceInput, isNegativeBalance]);

  const numericOverdraft = useMemo(() => {
    return desformatarMoeda(overdraftInput);
  }, [overdraftInput]);

  // Saldo total disponível para uso = Saldo Próprio + Limite Especial
  const totalAvailable = useMemo(() => {
    return Math.round((numericBalance + numericOverdraft) * 100) / 100;
  }, [numericBalance, numericOverdraft]);

  // Manipulador de troca de banco no Combobox
  const handleBankChange = (newBankName: string, newBankCode?: string, suggestedColor?: string) => {
    setBankName(newBankName);
    setBankCode(newBankCode);
    if (suggestedColor) {
      setColor(suggestedColor);
    }
  };

  // Manipulador de troca do tipo de chave PIX
  const handlePixTypeChange = (newType: 'cpf' | 'cnpj' | 'phone' | 'email' | 'random') => {
    setPixKeyType(newType);
    setPixKey((prev) => applyPixMask(prev, newType));
  };

  const handlePixKeyChange = (val: string) => {
    const formatted = applyPixMask(val, pixKeyType);
    setPixKey(formatted);
  };

  // Manipuladores de Cartões de Crédito Corporativos
  const handleAddCard = () => {
    const defaultEmp = availableEmployees[0];
    const newCardId = `card_${Date.now()}`;
    const randomEnding = Math.floor(1000 + Math.random() * 9000);
    const newCard: CorporateCard = {
      id: newCardId,
      name: `Visa Final ${randomEnding}`,
      responsibleEmployeeId: defaultEmp?.id || '',
      responsibleEmployeeName: defaultEmp?.name || '',
      totalLimit: 5000,
      usedLimit: 0,
      dueDay: 10,
      status: 'ativo',
    };
    setCorporateCards((prev) => [...prev, newCard]);
  };

  const handleUpdateCard = (id: string, updates: Partial<CorporateCard>) => {
    setCorporateCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  };

  const handleRemoveCard = (id: string) => {
    setCorporateCards((prev) => prev.filter((c) => c.id !== id));
  };

  // Lógica de fechamento de fatura: envia despesa para Contas a Pagar
  const handleCloseAndProvisionInvoice = (card: CorporateCard) => {
    if (!card.usedLimit || card.usedLimit <= 0) {
      setCardNotification({
        message: `O cartão "${card.name}" não possui saldo devedor/utilizado para provisionar fatura.`,
        type: 'info',
      });
      return;
    }

    const dueDate = calculateDueDate(card.dueDay || 10);
    const invoiceDesc = `Fatura ${card.name} - ${card.responsibleEmployeeName || 'Cartão Corporativo'}`;

    if (onProvisionCardInvoice) {
      onProvisionCardInvoice({
        card,
        account: editingAccount || undefined,
        amount: card.usedLimit,
        dueDate,
        description: invoiceDesc,
      });
    } else {
      // Cria a despesa diretamente no Contas a Pagar (Storage)
      const newExpense: Expense = {
        id: `exp_card_inv_${card.id}_${Date.now()}`,
        description: invoiceDesc,
        amount: card.usedLimit,
        categoryId: 'cat_cartao',
        categoryName: 'Fatura de Cartão Corporativo',
        categoryColor: '#8b5cf6',
        dueDate,
        date: new Date().toISOString().split('T')[0],
        status: 'pendente',
        paymentMethod: 'boleto',
        supplier: `${bankName} - Cartão Corporativo (${card.name})`,
        bankAccountId: editingAccount?.id,
        bankAccountName: editingAccount?.name || bankName,
        employeeId: card.responsibleEmployeeId,
        employeeName: card.responsibleEmployeeName,
        corporateCardId: card.id,
        corporateCardName: card.name,
        notes: `Fatura de cartão corporativo provisionada automaticamente para quitação em ${formatDateBR(dueDate)}. Limite Total: ${formatCurrencyBRL(card.totalLimit)}. Responsável: ${card.responsibleEmployeeName || 'Não especificado'}.`,
        createdAt: new Date().toISOString(),
      };

      const currentExpenses = getStoredExpenses();
      saveStoredExpenses([newExpense, ...currentExpenses]);
    }

    const provisionedAmount = card.usedLimit;

    // Atualiza o cartão para registrar o fechamento e zera o saldo devedor para novo ciclo
    handleUpdateCard(card.id, {
      usedLimit: 0,
      lastInvoiceProvisionedAt: new Date().toISOString(),
    });

    setCardNotification({
      message: `Fatura de ${formatCurrencyBRL(provisionedAmount)} do cartão "${card.name}" provisionada com sucesso no Contas a Pagar (Vencimento: ${formatDateBR(dueDate)})!`,
      type: 'success',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setValidationError('Por favor, informe o Nome Identificador da Conta.');
      return;
    }

    if (!bankName.trim()) {
      setValidationError('Por favor, selecione ou informe a Instituição Financeira.');
      return;
    }

    onSave({
      ...(editingAccount ? { id: editingAccount.id } : {}),
      name: name.trim(),
      bankName: bankName.trim(),
      bankCode: bankCode || undefined,
      accountType,
      agency: agency.trim() || undefined,
      accountNumber: accountNumber.trim() || undefined,
      accountDigit: accountDigit.trim().toUpperCase() || undefined,
      balance: numericBalance,
      overdraftLimit: numericOverdraft > 0 ? numericOverdraft : undefined,
      pixKey: pixKey.trim() || undefined,
      pixKeyType: pixKey.trim() ? pixKeyType : undefined,
      color,
      corporateCards,
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      id="modal-cadastro-conta-bancaria"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto backdrop-blur-xs animate-in fade-in"
      style={{ backgroundColor: 'rgba(10, 139, 193, 0.75)' }} // Azul intermediário com transparência
    >
      <div 
        className="w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-[#0963cb]/40 my-auto flex flex-col max-h-[94vh]"
        style={{ backgroundColor: '#b0d2ed' }} // Fundo do bloco: Azul claro #b0d2ed
      >
        {/* CABEÇALHO: Azul forte #0963cb com texto e ícone em branco #ffffff */}
        <div 
          className="px-5 py-3.5 flex items-center justify-between shrink-0 shadow-sm"
          style={{ backgroundColor: '#0963cb', color: '#ffffff' }}
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0 shadow-inner">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                {editingAccount ? 'Editar Conta Bancária' : 'Nova Conta Bancária / Caixa'}
              </h3>
              <p className="text-xs text-sky-100 font-medium">
                Gestão de contas correntes, cooperativas de crédito e caixa sede
              </p>
            </div>
          </div>

          <button
            type="button"
            id="btn-fechar-modal-conta"
            onClick={onClose}
            className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/20 transition cursor-pointer"
            title="Fechar Modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* CORPO DO FORMULÁRIO */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-black">
          
          {/* Mensagem de Erro de Validação */}
          {validationError && (
            <div 
              id="alerta-validacao-conta"
              className="p-3 bg-rose-100 border border-rose-400 rounded-xl flex items-center space-x-2 text-rose-900 text-xs font-black animate-in fade-in"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* BLOCO 1: Identificação da Conta & Marcador Visual */}
          <div className="bg-white/95 rounded-2xl p-4 border border-[#96c1e5] shadow-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
              
              {/* Nome Identificador da Conta */}
              <div className="sm:col-span-8">
                <label 
                  htmlFor="input-conta-nome" 
                  className="block text-xs font-black text-black mb-1 flex items-center justify-between"
                >
                  <span>
                    Nome Identificador da Conta <span className="text-rose-600">*</span>
                  </span>
                  <span className="text-[10px] text-stone-500 font-semibold">Ex: Conta Principal Agro, Caixa Sede</span>
                </label>
                <input
                  id="input-conta-nome"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    setValidationError('');
                    setName(e.target.value);
                  }}
                  placeholder="Ex: Banco do Brasil - Fazenda Sede"
                  className="w-full px-3 py-2 text-xs sm:text-sm font-bold bg-white text-black border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#0963cb] focus:border-[#0963cb] outline-hidden shadow-2xs"
                />
              </div>

              {/* Cor / Marcador Visual */}
              <div className="sm:col-span-4">
                <label className="block text-xs font-black text-black mb-1 flex items-center justify-between">
                  <span>Marcador Visual</span>
                  <span className="text-[10px] text-stone-500 font-semibold">Etiqueta</span>
                </label>
                <div className="flex items-center space-x-2">
                  <div 
                    id="marcador-visual-banco"
                    className="w-9 h-9 rounded-xl border border-stone-300 shadow-inner flex items-center justify-center text-white shrink-0 font-bold overflow-hidden"
                    style={{ backgroundColor: color }}
                    title={bankName || 'Conta Bancária'}
                  >
                    <BankLogoIcon 
                      code={bankCode} 
                      name={bankName} 
                      size={24} 
                      className="text-white" 
                    />
                  </div>
                  <div className="flex-1 flex items-center gap-1.5 overflow-x-auto py-1">
                    {COLOR_PRESETS.slice(0, 6).map((preset) => (
                      <button
                        key={preset.color}
                        type="button"
                        onClick={() => setColor(preset.color)}
                        className={`w-6 h-6 rounded-lg transition-transform shrink-0 shadow-2xs cursor-pointer ${
                          color === preset.color ? 'ring-2 ring-black scale-110' : 'hover:scale-105 opacity-85 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: preset.color }}
                        title={preset.label}
                      />
                    ))}
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-6 h-6 rounded-lg cursor-pointer border-0 bg-transparent shrink-0"
                      title="Escolher outra cor personalizada"
                    />
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* BLOCO 2: Instituição Financeira & Dados Bancários */}
          <div className="bg-white/95 rounded-2xl p-4 border border-[#96c1e5] shadow-xs space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
              
              {/* 1. Instituição Financeira (Combobox Inteligente com busca por código ou nome) */}
              <div className="sm:col-span-7">
                <label className="block text-xs font-black text-black mb-1 flex items-center justify-between">
                  <span>Instituição Financeira <span className="text-rose-600">*</span></span>
                  <span className="text-[10px] text-stone-500 font-semibold">Busca por código ou nome</span>
                </label>
                <BankCombobox
                  value={bankName}
                  bankCode={bankCode}
                  onChange={handleBankChange}
                />
              </div>

              {/* 2. Tipo de Conta */}
              <div className="sm:col-span-5">
                <label htmlFor="select-tipo-conta" className="block text-xs font-black text-black mb-1">
                  Tipo de Conta / Destinação
                </label>
                <select
                  id="select-tipo-conta"
                  value={accountType}
                  onChange={(e) => setAccountType(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs sm:text-sm font-bold bg-white text-black border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#0963cb] outline-hidden shadow-2xs cursor-pointer"
                >
                  <option value="corrente">Conta Corrente (C.C.)</option>
                  <option value="poupanca">Poupança Agro / Pessoal</option>
                  <option value="aplicacao">Aplicação / Renda Fixa</option>
                  <option value="caixa_fisico">Caixa Físico / Espécie Sede</option>
                </select>
              </div>

            </div>

            {/* Agência, Conta e Dígito (DV) */}
            <div className="grid grid-cols-12 gap-2.5 pt-1">
              {/* Agência */}
              <div className="col-span-5 sm:col-span-4">
                <label htmlFor="input-conta-agencia" className="block text-xs font-black text-black mb-1">
                  Agência
                </label>
                <input
                  id="input-conta-agencia"
                  type="text"
                  value={agency}
                  onChange={(e) => setAgency(e.target.value)}
                  placeholder="Ex: 1234-5"
                  className="w-full px-3 py-2 text-xs sm:text-sm font-bold bg-white text-black border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#0963cb] outline-hidden shadow-2xs font-mono"
                />
              </div>

              {/* Número da Conta */}
              <div className="col-span-5 sm:col-span-6">
                <label htmlFor="input-conta-numero" className="block text-xs font-black text-black mb-1">
                  Número da Conta
                </label>
                <input
                  id="input-conta-numero"
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="Ex: 12345678"
                  className="w-full px-3 py-2 text-xs sm:text-sm font-bold bg-white text-black border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#0963cb] outline-hidden shadow-2xs font-mono"
                />
              </div>

              {/* Dígito (DV) */}
              <div className="col-span-2 sm:col-span-2">
                <label 
                  htmlFor="input-conta-dv" 
                  className="block text-xs font-black text-black mb-1 truncate text-center"
                  title="Dígito Verificador da Conta"
                >
                  Dígito (DV)
                </label>
                <input
                  id="input-conta-dv"
                  type="text"
                  maxLength={2}
                  value={accountDigit}
                  onChange={(e) => setAccountDigit(e.target.value.toUpperCase())}
                  placeholder="X"
                  className="w-full px-2 py-2 text-xs sm:text-sm font-black bg-white text-black border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#0963cb] outline-hidden shadow-2xs text-center font-mono uppercase"
                />
              </div>
            </div>
          </div>

          {/* BLOCO 3: Valores, Saldo Inicial e Limite de Cheque Especial */}
          <div className="bg-white/95 rounded-2xl p-4 border border-[#96c1e5] shadow-xs space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              
              {/* Saldo Inicial / Atual */}
              <div>
                <label 
                  htmlFor="input-conta-saldo" 
                  className="block text-xs font-black text-black mb-1 flex items-center justify-between"
                >
                  <span>Saldo Inicial / Atual (R$)</span>
                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => setIsNegativeBalance(!isNegativeBalance)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-black tracking-tight transition cursor-pointer ${
                        isNegativeBalance
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      }`}
                      title="Alternar entre saldo positivo e saldo negativo (devedor)"
                    >
                      {isNegativeBalance ? '(-) Negativo' : '(+) Positivo'}
                    </button>
                  </div>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-black/70 font-black text-xs pointer-events-none select-none">
                    {isNegativeBalance ? '- R$' : 'R$'}
                  </span>
                  <input
                    id="input-conta-saldo"
                    type="text"
                    inputMode="numeric"
                    value={balanceInput}
                    onChange={(e) => {
                      const formatted = formatarMoeda(e.target.value);
                      setBalanceInput(formatted || '0,00');
                    }}
                    className={`w-full pl-12 pr-3 py-2 text-xs sm:text-sm font-black bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#0963cb] outline-hidden shadow-2xs font-mono ${
                      isNegativeBalance ? 'text-rose-600' : 'text-black'
                    }`}
                  />
                </div>
                <span className="text-[10px] text-stone-500 font-medium block mt-1">
                  Saldo existente no extrato bancário desta conta
                </span>
              </div>

              {/* Limite de Cheque Especial (R$) */}
              <div>
                <label 
                  htmlFor="input-conta-cheque-especial" 
                  className="block text-xs font-black text-black mb-1 flex items-center justify-between"
                >
                  <span className="flex items-center gap-1">
                    <CreditCard className="w-3.5 h-3.5 text-[#0963cb]" />
                    <span>Limite de Cheque Especial (R$)</span>
                  </span>
                  <span className="text-[10px] text-stone-500 font-semibold">Crédito Rotativo</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-black/70 font-black text-xs pointer-events-none select-none">
                    R$
                  </span>
                  <input
                    id="input-conta-cheque-especial"
                    type="text"
                    inputMode="numeric"
                    value={overdraftInput}
                    onChange={(e) => {
                      const formatted = formatarMoeda(e.target.value);
                      setOverdraftInput(formatted || '0,00');
                    }}
                    placeholder="0,00"
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm font-black bg-white text-black border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#0963cb] outline-hidden shadow-2xs font-mono"
                  />
                </div>
                <span className="text-[10px] text-stone-500 font-medium block mt-1">
                  Limite concedido pelo banco para cobertura emergencial
                </span>
              </div>

            </div>

            {/* CARD DE PRÉ-VISUALIZAÇÃO: Saldo Total Disponível para Uso */}
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-sky-50 via-blue-50 to-emerald-50 border border-sky-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-sky-950 block">
                  Saldo Total Disponível para Uso
                </span>
                <div className="text-xl sm:text-2xl font-black text-black font-['Outfit'] tracking-tight">
                  {formatCurrencyBRL(totalAvailable)}
                </div>
              </div>

              <div className="text-xs text-stone-700 font-medium sm:text-right border-t sm:border-t-0 pt-1.5 sm:pt-0 border-sky-200">
                <div className="flex sm:justify-end items-center gap-1.5 text-[11px]">
                  <span>Saldo em Conta:</span>
                  <strong className={numericBalance < 0 ? 'text-rose-700 font-bold' : 'text-black font-bold'}>
                    {formatCurrencyBRL(numericBalance)}
                  </strong>
                </div>
                <div className="flex sm:justify-end items-center gap-1.5 text-[11px]">
                  <span>+ Limite Especial:</span>
                  <strong className="text-emerald-800 font-bold">
                    {formatCurrencyBRL(numericOverdraft)}
                  </strong>
                </div>
                {numericBalance < 0 && numericOverdraft > 0 && (
                  <span className="text-[10px] text-amber-900 font-bold block mt-0.5">
                    ⚠️ Conta operando no cheque especial
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* BLOCO 4: Chave PIX Composta (Tipo + Input Mascarado) */}
          <div className="bg-white/95 rounded-2xl p-4 border border-[#96c1e5] shadow-xs space-y-2.5">
            <label className="block text-xs font-black text-black flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5 text-[#0963cb]" />
                <span>Chave PIX (Opcional)</span>
              </span>
              <span className="text-[10px] text-stone-500 font-semibold">
                Para recebimentos e transferências rápidas
              </span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              {/* Select do Tipo de Chave */}
              <div className="sm:col-span-4">
                <select
                  id="select-tipo-chave-pix"
                  value={pixKeyType}
                  onChange={(e) => handlePixTypeChange(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs sm:text-sm font-black bg-white text-black border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#0963cb] outline-hidden shadow-2xs cursor-pointer"
                >
                  <option value="cpf">CPF (Pessoa Física)</option>
                  <option value="cnpj">CNPJ (Pessoa Jurídica)</option>
                  <option value="phone">Celular (Telefone)</option>
                  <option value="email">E-mail</option>
                  <option value="random">Chave Aleatória (EVP)</option>
                </select>
              </div>

              {/* Input da Chave com Máscara Dinâmica */}
              <div className="sm:col-span-8">
                <input
                  id="input-chave-pix"
                  type={pixKeyType === 'email' ? 'email' : 'text'}
                  value={pixKey}
                  onChange={(e) => handlePixKeyChange(e.target.value)}
                  placeholder={
                    pixKeyType === 'cpf'
                      ? '000.000.000-00'
                      : pixKeyType === 'cnpj'
                      ? '00.000.000/0000-00'
                      : pixKeyType === 'phone'
                      ? '(00) 00000-0000'
                      : pixKeyType === 'email'
                      ? 'financeiro@agro.com.br'
                      : 'Cole ou digite a chave aleatória...'
                  }
                  className="w-full px-3 py-2 text-xs sm:text-sm font-bold bg-white text-black border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#0963cb] outline-hidden shadow-2xs font-mono"
                />
              </div>
            </div>
          </div>

          {/* BLOCO 5: Cartões Corporativos Vinculados (Exatamente acima dos botões Cancelar / Atualizar) */}
          <div 
            id="bloco-cartoes-corporativos"
            className="bg-white/95 rounded-2xl p-4 border border-[#96c1e5] shadow-xs space-y-3.5"
          >
            {/* Cabeçalho da Seção */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-700 shrink-0">
                  <CreditCard className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-black uppercase tracking-wider flex items-center gap-1.5">
                    <span>Cartões de Crédito Vinculados</span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                      {corporateCards.length}
                    </span>
                  </h4>
                  <p className="text-[10px] text-stone-500 font-medium">
                    Cartões corporativos com faturas quitadas através desta conta bancária
                  </p>
                </div>
              </div>

              <button
                type="button"
                id="btn-adicionar-cartao-credito"
                onClick={handleAddCard}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#0963cb] hover:bg-[#0852a8] text-white rounded-xl text-xs font-black transition shadow-xs cursor-pointer active:scale-98 shrink-0 min-h-[34px]"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>+ Adicionar Cartão</span>
              </button>
            </div>

            {/* Banner de Feedback de Fechamento de Fatura */}
            {cardNotification && (
              <div className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 shadow-2xs animate-in fade-in ${
                cardNotification.type === 'success' 
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900' 
                  : 'bg-blue-50 border-blue-300 text-blue-900'
              }`}>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{cardNotification.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setCardNotification(null)}
                  className="text-stone-500 hover:text-stone-800 p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Listagem de Cartões ou Estado Vazio */}
            {corporateCards.length === 0 ? (
              <div className="text-center py-6 px-4 bg-slate-50/90 rounded-xl border border-dashed border-stone-300">
                <CreditCard className="w-8 h-8 text-stone-400 mx-auto mb-1.5" />
                <p className="text-xs font-black text-stone-800">Nenhum cartão de crédito vinculado a esta conta bancária</p>
                <p className="text-[11px] text-stone-500 mt-0.5 max-w-md mx-auto">
                  Vincule cartões corporativos de funcionários (Módulo RH) para gerenciar limites e automatizar o fechamento e provisionamento de faturas no Contas a Pagar.
                </p>
                <button
                  type="button"
                  onClick={handleAddCard}
                  className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-stone-300 hover:bg-stone-50 text-stone-800 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-[#0963cb]" />
                  <span>Vincular Primeiro Cartão</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {corporateCards.map((card, index) => {
                  const cardExpenses = getCardExpensesSum(card);
                  const usedPercent = card.totalLimit > 0 ? Math.min(100, Math.round((card.usedLimit / card.totalLimit) * 100)) : 0;
                  const availableLimit = Math.max(0, card.totalLimit - card.usedLimit);
                  const nextDueDate = calculateDueDate(card.dueDay || 10);

                  return (
                    <div
                      key={card.id || index}
                      className="bg-white border border-stone-300 rounded-xl p-3.5 space-y-3 shadow-2xs hover:border-indigo-300 transition"
                    >
                      {/* Linha Superior: Identificador/Final e Botão Excluir */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1">
                          <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0">
                            <CreditCard className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex-1 max-w-sm">
                            <label className="block text-[10px] font-black text-black uppercase tracking-wider mb-0.5">
                              Identificador / Final do Cartão
                            </label>
                            <input
                              type="text"
                              value={card.name}
                              onChange={(e) => handleUpdateCard(card.id, { name: e.target.value })}
                              placeholder="Ex: Visa Final 4321"
                              className="w-full px-2.5 py-1 text-xs font-black bg-white text-black border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#0963cb] outline-hidden shadow-2xs font-mono"
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {card.lastInvoiceProvisionedAt && (
                            <span className="hidden sm:inline-block text-[10px] text-purple-800 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200 font-semibold">
                              Última fatura: {formatDateBR(card.lastInvoiceProvisionedAt.split('T')[0])}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveCard(card.id)}
                            className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="Excluir este Cartão"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Grid de Campos Compactos */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                        
                        {/* Funcionário Responsável: Dropdown com Módulo RH */}
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-black text-black uppercase tracking-wider mb-1 flex items-center gap-1">
                            <UserCheck className="w-3 h-3 text-[#0963cb]" />
                            <span>Funcionário Responsável (Módulo RH)</span>
                          </label>
                          <select
                            value={card.responsibleEmployeeId}
                            onChange={(e) => {
                              const emp = availableEmployees.find((x) => x.id === e.target.value);
                              handleUpdateCard(card.id, {
                                responsibleEmployeeId: e.target.value,
                                responsibleEmployeeName: emp?.name || '',
                              });
                            }}
                            className="w-full px-2.5 py-1.5 text-xs font-bold bg-white text-black border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#0963cb] outline-hidden shadow-2xs cursor-pointer truncate"
                          >
                            <option value="">-- Selecione o Funcionário Responsável --</option>
                            {availableEmployees.map((emp) => (
                              <option key={emp.id} value={emp.id}>
                                {emp.name} {emp.role ? `(${emp.role})` : ''}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Limite Total do Cartão (R$) com máscara monetária */}
                        <div>
                          <label className="block text-[10px] font-black text-black uppercase tracking-wider mb-1">
                            Limite Total (R$)
                          </label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-black/60 font-black text-[11px] pointer-events-none select-none">
                              R$
                            </span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={card.totalLimit > 0 ? formatarMoeda(Math.round(card.totalLimit * 100)) : '0,00'}
                              onChange={(e) => {
                                const val = desformatarMoeda(e.target.value);
                                handleUpdateCard(card.id, { totalLimit: val });
                              }}
                              placeholder="0,00"
                              className="w-full pl-8 pr-2.5 py-1.5 text-xs font-black bg-white text-black border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#0963cb] outline-hidden shadow-2xs font-mono"
                            />
                          </div>
                        </div>

                        {/* Limite Utilizado / Saldo Devedor Atual (R$) */}
                        <div>
                          <label className="block text-[10px] font-black text-black uppercase tracking-wider mb-1 flex items-center justify-between">
                            <span>Limite Utilizado (R$)</span>
                            {cardExpenses > 0 && (
                              <button
                                type="button"
                                onClick={() => handleUpdateCard(card.id, { usedLimit: cardExpenses })}
                                className="text-[9px] text-[#0963cb] hover:underline flex items-center gap-0.5 cursor-pointer font-bold"
                                title="Copiar soma de despesas lançadas no sistema para este titular/cartão"
                              >
                                <RefreshCw className="w-2.5 h-2.5" />
                                <span>{formatCurrencyBRL(cardExpenses)}</span>
                              </button>
                            )}
                          </label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-black/60 font-black text-[11px] pointer-events-none select-none">
                              R$
                            </span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={card.usedLimit > 0 ? formatarMoeda(Math.round(card.usedLimit * 100)) : '0,00'}
                              onChange={(e) => {
                                const val = desformatarMoeda(e.target.value);
                                handleUpdateCard(card.id, { usedLimit: val });
                              }}
                              placeholder="0,00"
                              className="w-full pl-8 pr-2.5 py-1.5 text-xs font-black bg-white text-black border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#0963cb] outline-hidden shadow-2xs font-mono"
                            />
                          </div>
                        </div>

                      </div>

                      {/* Linha de Vencimento, Barra de Progresso e Ação de Quitação Automática */}
                      <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        
                        {/* Dia de Vencimento da Fatura (Select de 1 a 31) */}
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase text-stone-600 flex items-center gap-1 shrink-0">
                            <Calendar className="w-3 h-3 text-[#0963cb]" />
                            <span>Vencimento da Fatura:</span>
                          </span>
                          <select
                            value={card.dueDay || 10}
                            onChange={(e) => handleUpdateCard(card.id, { dueDay: Number(e.target.value) })}
                            className="px-2 py-1 text-xs font-bold bg-white text-black border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#0963cb] outline-hidden shadow-2xs cursor-pointer font-mono"
                          >
                            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                              <option key={day} value={day}>
                                Dia {String(day).padStart(2, '0')}
                              </option>
                            ))}
                          </select>
                          <span className="text-[10px] text-stone-500 font-medium">
                            (Próx: {formatDateBR(nextDueDate)})
                          </span>
                        </div>

                        {/* Botão de Fechamento da Fatura / Provisionamento no Contas a Pagar */}
                        <button
                          type="button"
                          onClick={() => handleCloseAndProvisionInvoice(card)}
                          disabled={card.usedLimit <= 0}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition shadow-xs cursor-pointer active:scale-98 ${
                            card.usedLimit > 0
                              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white'
                              : 'bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed'
                          }`}
                          title={
                            card.usedLimit > 0
                              ? `Provisionar fatura de ${formatCurrencyBRL(card.usedLimit)} no Contas a Pagar com vencimento em ${formatDateBR(nextDueDate)}`
                              : 'Não há limite utilizado para provisionar fatura'
                          }
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>Fechar Fatura & Provisionar</span>
                        </button>

                      </div>

                      {/* Barra Visual de Consumo do Limite */}
                      <div className="space-y-1 pt-0.5">
                        <div className="flex justify-between items-center text-[10px] font-semibold text-stone-600">
                          <span>
                            Utilizado: <strong className="text-black font-bold font-mono">{formatCurrencyBRL(card.usedLimit)}</strong> ({usedPercent}%)
                          </span>
                          <span>
                            Disponível: <strong className="text-emerald-700 font-bold font-mono">{formatCurrencyBRL(availableLimit)}</strong>
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                          <div
                            className={`h-full transition-all duration-300 rounded-full ${
                              usedPercent > 90
                                ? 'bg-rose-500'
                                : usedPercent > 70
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${usedPercent}%` }}
                          />
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RODAPÉ DO MODAL: Botões de Ação */}
          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-black/15 shrink-0">
            <button
              type="button"
              id="btn-cancelar-modal-conta"
              onClick={onClose}
              className="px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl bg-white border border-stone-300 text-stone-700 hover:bg-stone-50 cursor-pointer transition shadow-2xs min-h-[40px]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              id="btn-salvar-conta-bancaria"
              className="px-6 py-2.5 text-xs sm:text-sm font-black rounded-xl bg-[#0963cb] hover:bg-[#0852a8] text-white shadow-md cursor-pointer transition active:scale-98 flex items-center space-x-1.5 min-h-[40px]"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{editingAccount ? 'Atualizar Conta' : 'Salvar Conta'}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
