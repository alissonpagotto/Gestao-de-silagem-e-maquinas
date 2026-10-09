import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  User,
  RefreshCw,
  Zap,
  CheckCircle2,
  Pencil,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { BankAccount, CorporateCard, Employee, Expense } from '../../types';
import { formatCurrencyBRL, formatDateBR, getStoredEmployees, getStoredExpenses, saveStoredExpenses, getStoredCompanyProfile } from '../../lib/storage';
import { formatarMoeda, desformatarMoeda } from '../../lib/formatters';
import { BankCombobox } from './BankCombobox';
import { BRAZILIAN_BANKS } from './brazilianBanks';
import { BankLogoIcon } from './BankLogoIcon';
import { CorporateCardMockup } from './CorporateCardMockup';

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
  { label: 'Banrisul Azul', color: '#004f9f' },
  { label: 'C6 Bank Grafite', color: '#242424' },
  { label: 'PagBank Verde', color: '#00a868' },
  { label: 'Safra Dourado', color: '#b99b58' },
  { label: 'BNB Laranja', color: '#ff6f00' },
  { label: 'Ailos Teal', color: '#00857c' },
  { label: 'Unicred Verde', color: '#005544' },
  { label: 'Caixa Sede Cinza', color: '#475569' },
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

export interface GlobalAccountHolder {
  id: string;
  name: string;
  tipo: string;
  documento: string;
  razaoSocial?: string;
  role?: string;
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

  // Responsável Geral pela Conta Corrente (Titularidade e Razão Social)
  const [responsavelContaId, setResponsavelContaId] = useState<string>('');
  const [responsavelContaNome, setResponsavelContaNome] = useState<string>('');
  const [responsavelContaDoc, setResponsavelContaDoc] = useState<string>('');
  
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

  // ID da conta ativa (permite salvar repetidamente mantendo o modal aberto sem criar duplicatas)
  const [currentAccountId, setCurrentAccountId] = useState<string | undefined>(editingAccount?.id);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cartões Corporativos Vinculados
  const [corporateCards, setCorporateCards] = useState<CorporateCard[]>([]);
  const [cardNotification, setCardNotification] = useState<{ message: string; type: 'success' | 'info' } | null>(null);
  
  // Controle reativo de expansão dos formulários dos cartões (por padrão recolhidos/ocultos)
  const [expandedCardIds, setExpandedCardIds] = useState<Record<string, boolean>>({});

  const toggleCardExpansion = useCallback((cardKey: string) => {
    setExpandedCardIds(prev => ({
      ...prev,
      [cardKey]: !prev[cardKey],
    }));
  }, []);

  // Perfil da Empresa (Razão Social e CNPJ padrão)
  const companyProfile = useMemo(() => getStoredCompanyProfile(), []);

  // Lista de funcionários disponíveis (prop ou storage)
  const availableEmployees: Employee[] = useMemo(() => {
    if (employees && employees.length > 0) return employees;
    return getStoredEmployees();
  }, [employees]);

  // Lista Global de Responsáveis / Titulares de Contas (Disponível para todos os bancos cadastrados)
  const accountHolders: GlobalAccountHolder[] = useMemo(() => {
    const holders: GlobalAccountHolder[] = [];

    // 1. Empresa Principal (Pessoa Jurídica)
    const compDoc = companyProfile.cnpjCpf || '38.489.123/0001-45';
    const compName = companyProfile.corporateName || companyProfile.tradeName || 'Colaça Silagem Ltda';
    holders.push({
      id: 'holder_company_colaca',
      name: compName,
      tipo: 'Pessoa Jurídica (Empresa)',
      documento: compDoc,
      razaoSocial: companyProfile.corporateName || compName,
      role: 'Empresa Titular',
    });

    // 2. Sócios e Diretores Principais (Titulares Oficiais do Sistema)
    holders.push({
      id: 'holder_audirlei_reolan',
      name: 'AUDIRLEI REOLAN',
      tipo: 'Sócio / Diretor de Operações',
      documento: '045.892.149-80',
      razaoSocial: 'AUDIRLEI REOLAN - PRODUTOR RURAL',
      role: 'Motorista / Encarregado',
    });

    holders.push({
      id: 'holder_julia_reolan',
      name: 'JULIA REOLAN',
      tipo: 'Sócia / Gestão Financeira',
      documento: '062.348.919-22',
      razaoSocial: 'JULIA REOLAN GESTAO FINANCEIRA',
      role: 'Financeiro',
    });

    // 3. Usuários / Colaboradores cadastrados no Módulo RH
    if (availableEmployees && availableEmployees.length > 0) {
      availableEmployees.forEach((emp) => {
        const isAlready = holders.some(
          h => h.name.toLowerCase() === emp.name.toLowerCase() || (emp.cpf && h.documento === emp.cpf)
        );
        if (!isAlready) {
          holders.push({
            id: emp.id,
            name: emp.name,
            tipo: `Colaborador RH (${emp.role || 'Geral'})`,
            documento: emp.cpf || '',
            razaoSocial: emp.name,
            role: emp.role || 'Motorista',
          });
        }
      });
    }

    return holders;
  }, [companyProfile, availableEmployees]);

  // Responsável pela Conta selecionado atualmente
  const selectedResponsavel = useMemo(() => {
    return accountHolders.find(
      h => (responsavelContaId && h.id === responsavelContaId) || (responsavelContaNome && h.name.toLowerCase() === responsavelContaNome.toLowerCase())
    ) || null;
  }, [accountHolders, responsavelContaId, responsavelContaNome]);

  const handleResponsavelContaChange = (holderId: string) => {
    const holder = accountHolders.find(h => h.id === holderId);
    if (holder) {
      setResponsavelContaId(holder.id);
      setResponsavelContaNome(holder.name);
      setResponsavelContaDoc(holder.documento);
    } else {
      setResponsavelContaId('');
      setResponsavelContaNome('');
      setResponsavelContaDoc('');
    }
  };

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

  // Sincroniza ao abrir o modal com trava estrita de inicialização única por ciclo de abertura
  const accountHoldersRef = useRef(accountHolders);
  accountHoldersRef.current = accountHolders;

  const initializedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      initializedKeyRef.current = null;
      setSaveSuccessMessage(false);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      return;
    }

    const currentKey = `${editingAccount?.id || 'new'}_open`;
    if (initializedKeyRef.current === currentKey) {
      return;
    }
    initializedKeyRef.current = currentKey;

    setValidationError('');
    setCardNotification(null);
    setSaveSuccessMessage(false);
    setCurrentAccountId(editingAccount?.id);

    const holders = accountHoldersRef.current;

    if (editingAccount) {
      setName(editingAccount.name || '');
      setBankName(editingAccount.bankName || 'Banco do Brasil');
      setBankCode(editingAccount.bankCode || undefined);
      setAccountType(editingAccount.accountType || 'corrente');
      setAgency(editingAccount.agency || '');
      setAccountNumber(editingAccount.accountNumber || '');
      setAccountDigit(editingAccount.accountDigit || '');

      // Responsável Geral pela Conta Corrente
      const rId = editingAccount.responsavel_conta_id || '';
      const rNome = editingAccount.responsavel_conta_nome || '';
      const rDoc = editingAccount.responsavel_conta_documento || '';
      if (rId || rNome) {
        setResponsavelContaId(rId);
        setResponsavelContaNome(rNome);
        setResponsavelContaDoc(rDoc);
      } else {
        const def = holders[1] || holders[0];
        setResponsavelContaId(def?.id || '');
        setResponsavelContaNome(def?.name || '');
        setResponsavelContaDoc(def?.documento || '');
      }

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
        setCorporateCards(editingAccount.corporateCards.map(card => ({
          ...card,
          responsavel_cartao_id: card.responsavel_cartao_id || card.responsibleEmployeeId || '',
          titular_nome: (card.titular_nome || card.responsibleEmployeeName || 'AUDIRLEI REOLAN').toUpperCase(),
          responsibleEmployeeName: card.titular_nome || card.responsibleEmployeeName || 'AUDIRLEI REOLAN',
          responsavel_funcao: card.responsavel_funcao || 'Motorista',
        })));
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
      const def = holders[1] || holders[0];
      setResponsavelContaId(def?.id || '');
      setResponsavelContaNome(def?.name || '');
      setResponsavelContaDoc(def?.documento || '');
      setCorporateCards([]);
    }
  }, [isOpen, editingAccount?.id]);

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
  const handleBankChange = useCallback((newBankName: string, newBankCode?: string, suggestedColor?: string) => {
    setBankName(newBankName);
    setBankCode(newBankCode);
    if (suggestedColor) {
      setColor(suggestedColor);
    }
  }, []);

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
    const defaultEmp = availableEmployees.find(e => e.name.toLowerCase().includes('audirlei')) || availableEmployees[0];
    const defaultTitular = defaultEmp?.name || responsavelContaNome || 'AUDIRLEI REOLAN';
    const defaultRole = defaultEmp?.role || 'Motorista';
    const newCardId = `card_${Date.now()}`;
    const randomEnding = '4520';
    const isSicredi = (bankName || '').toLowerCase().includes('sicredi') || bankCode === '748';
    const brand: 'mastercard' | 'visa' = isSicredi ? 'mastercard' : 'visa';
    const brandLabel = brand === 'mastercard' ? 'Mastercard' : 'Visa';
    const newCard: CorporateCard = {
      id: newCardId,
      name: `${brandLabel} Final ${randomEnding}`,
      brand,
      last4: String(randomEnding),
      responsibleEmployeeId: defaultEmp?.id || 'emp_audirlei',
      responsibleEmployeeName: defaultTitular,
      responsavel_cartao_id: defaultEmp?.id || 'emp_audirlei',
      titular_nome: defaultTitular.toUpperCase(),
      responsavel_funcao: defaultRole,
      totalLimit: 5000,
      usedLimit: 0,
      dueDay: 10,
      status: 'ativo',
    };
    setCorporateCards((prev) => [...prev, newCard]);
    setExpandedCardIds((prev) => ({ ...prev, [newCardId]: true }));
  };

  // Totais agregados dos cartões corporativos
  const totalCardsLimit = useMemo(() => {
    return corporateCards.reduce((acc, c) => acc + (c.totalLimit || 0), 0);
  }, [corporateCards]);

  const totalCardsUsed = useMemo(() => {
    return corporateCards.reduce((acc, c) => acc + (c.usedLimit || 0), 0);
  }, [corporateCards]);

  const totalCardsAvailable = useMemo(() => {
    return Math.max(0, totalCardsLimit - totalCardsUsed);
  }, [totalCardsLimit, totalCardsUsed]);

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

    const accountId = currentAccountId || editingAccount?.id || `bank_${Date.now()}`;
    setCurrentAccountId(accountId);

    onSave({
      id: accountId,
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
      corporateCards: corporateCards.map(c => ({
        ...c,
        responsavel_cartao_id: c.responsavel_cartao_id || c.responsibleEmployeeId || '',
        titular_nome: (c.titular_nome || c.responsibleEmployeeName || 'AUDIRLEI REOLAN').toUpperCase(),
        responsibleEmployeeName: c.titular_nome || c.responsibleEmployeeName || 'AUDIRLEI REOLAN',
        responsavel_funcao: c.responsavel_funcao || 'Motorista',
      })),
      responsavel_conta_id: responsavelContaId || undefined,
      responsavel_conta_nome: responsavelContaNome || undefined,
      responsavel_conta_documento: responsavelContaDoc || undefined,
    });

    // Disparar badge temporário de sucesso no rodapé e MANTER modal aberto
    setSaveSuccessMessage(true);
    setExpandedCardIds({});
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      setSaveSuccessMessage(false);
    }, 3000);
  };

  if (!isOpen) return null;

  return (
    <div 
      id="modal-cadastro-conta-bancaria"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-hidden bg-black/60 backdrop-blur-xs animate-in fade-in"
    >
      <div 
        className="w-full max-w-4xl h-[95vh] flex flex-col justify-between mx-auto my-auto bg-slate-50 dark:bg-stone-900 border border-slate-400 dark:border-stone-700 rounded-lg overflow-hidden global shadow-2xl animate-in fade-in"
      >
        {/* CABEÇALHO - Moldura Metálica 3D Acetinada */}
        <div 
          className="px-4 sm:px-5 py-2.5 sm:py-3 flex items-center justify-between shrink-0 bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 dark:from-stone-800 dark:via-stone-750 dark:to-stone-900 border-b border-slate-400 dark:border-stone-700 text-slate-800 dark:text-stone-100 rounded-t-lg shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9),inset_-1px_-1px_0px_rgba(0,0,0,0.15)]"
        >
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/80 dark:bg-stone-800 text-slate-800 dark:text-stone-100 flex items-center justify-center border border-slate-300 dark:border-stone-700 shadow-2xs shrink-0">
              <Landmark className="w-3.5 h-3.5 text-slate-700 dark:text-stone-200" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-stone-100 flex items-center gap-1.5 leading-tight">
                {editingAccount ? 'EDITAR CONTA BANCÁRIA' : 'NOVA CONTA BANCÁRIA / CAIXA'}
              </h3>
              <p className="text-[11px] text-slate-600 dark:text-stone-400 font-medium leading-tight">
                Gestão de contas correntes, cooperativas de crédito, caixas e cartões corporativos
              </p>
            </div>
          </div>

          <button
            type="button"
            id="btn-fechar-modal-conta"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-300/60 dark:text-stone-400 dark:hover:text-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            title="Fechar Modal"
          >
            <X className="w-4 h-4 text-slate-700 dark:text-stone-200" />
          </button>
        </div>

        {/* CORPO DO FORMULÁRIO EM DUAS COLUNAS (SPLIT SCREEN) */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden scrollbar-none text-zinc-900 dark:text-stone-100 min-h-0">
          
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden scrollbar-none min-h-0">
            
            {/* ======================================================== */}
            {/* COLUNA DA ESQUERDA (60% da Largura): DADOS DA CONTA */}
            {/* ======================================================== */}
            <div className="lg:col-span-7 flex flex-col overflow-y-hidden scrollbar-none p-2 sm:p-2.5 gap-2 border-b lg:border-b-0 lg:border-r border-zinc-200 dark:border-stone-800 bg-[#cdcdcd] dark:bg-transparent">
              
              {/* Mensagem de Erro de Validação */}
              {validationError && (
                <div 
                  id="alerta-validacao-conta"
                  className="p-1.5 bg-rose-100 border border-rose-400 rounded-xl flex items-center space-x-2 text-rose-900 text-xs font-black animate-in fade-in"
                >
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              {/* BLOCO 1 (NOVO TOPO): Instituição Financeira & Dados Bancários */}
              <div className="bg-white dark:bg-stone-800 rounded-xl p-2 sm:p-2.5 border border-zinc-200 dark:border-stone-700 shadow-2xs space-y-1">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-1.5">
                  {/* Instituição Financeira */}
                  <div className="sm:col-span-7">
                    <label className="block text-xs font-bold text-zinc-900 dark:text-stone-100 mb-0.5 flex items-center justify-between">
                      <span>Instituição Financeira <span className="text-rose-600">*</span></span>
                      <span className="text-[10px] text-zinc-500 dark:text-stone-400 font-semibold">Busca por código ou nome</span>
                    </label>
                    <BankCombobox
                      value={bankName}
                      bankCode={bankCode}
                      onChange={handleBankChange}
                    />
                  </div>

                  {/* Tipo de Conta */}
                  <div className="sm:col-span-5">
                    <label htmlFor="select-tipo-conta" className="block text-xs font-bold text-zinc-900 dark:text-stone-100 mb-0.5">
                      Tipo de Conta / Destinação
                    </label>
                    <select
                      id="select-tipo-conta"
                      value={accountType}
                      onChange={(e) => setAccountType(e.target.value as any)}
                      className="w-full px-2.5 py-1 text-xs font-bold bg-white dark:bg-stone-900 text-zinc-900 dark:text-stone-100 border border-zinc-300 dark:border-stone-600 rounded-lg focus:ring-2 focus:ring-zinc-900/20 outline-hidden shadow-2xs cursor-pointer"
                    >
                      <option value="corrente">Conta Corrente (C.C.)</option>
                      <option value="poupanca">Poupança Agro / Pessoal</option>
                      <option value="aplicacao">Aplicação / Renda Fixa</option>
                      <option value="caixa_fisico">Caixa Físico / Espécie Sede</option>
                    </select>
                  </div>
                </div>

                {/* Agência, Conta e Dígito (DV) */}
                <div className="grid grid-cols-12 gap-1.5 pt-0.5">
                  <div className="col-span-5 sm:col-span-4">
                    <label htmlFor="input-conta-agencia" className="block text-xs font-bold text-zinc-900 dark:text-stone-100 mb-0.5">
                      Agência
                    </label>
                    <input
                      id="input-conta-agencia"
                      type="text"
                      value={agency}
                      onChange={(e) => setAgency(e.target.value)}
                      placeholder="Ex: 1234-5"
                      className="w-full px-2 py-1 text-xs font-bold bg-white dark:bg-stone-900 text-zinc-900 dark:text-stone-100 border border-zinc-300 dark:border-stone-600 rounded-lg focus:ring-2 focus:ring-zinc-900/20 outline-hidden shadow-2xs font-mono"
                    />
                  </div>

                  <div className="col-span-5 sm:col-span-6">
                    <label htmlFor="input-conta-numero" className="block text-xs font-bold text-zinc-900 dark:text-stone-100 mb-0.5">
                      Número da Conta
                    </label>
                    <input
                      id="input-conta-numero"
                      type="text"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      placeholder="Ex: 12345678"
                      className="w-full px-2 py-1 text-xs font-bold bg-white dark:bg-stone-900 text-zinc-900 dark:text-stone-100 border border-zinc-300 dark:border-stone-600 rounded-lg focus:ring-2 focus:ring-zinc-900/20 outline-hidden shadow-2xs font-mono"
                    />
                  </div>

                  <div className="col-span-2 sm:col-span-2">
                    <label 
                      htmlFor="input-conta-dv" 
                      className="block text-xs font-bold text-zinc-900 dark:text-stone-100 mb-0.5 truncate text-center"
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
                      className="w-full px-1.5 py-1 text-xs font-black bg-white dark:bg-stone-900 text-zinc-900 dark:text-stone-100 border border-zinc-300 dark:border-stone-600 rounded-lg focus:ring-2 focus:ring-zinc-900/20 outline-hidden shadow-2xs text-center font-mono uppercase"
                    />
                  </div>
                </div>
              </div>

              {/* BLOCO 2: Responsável pela Conta e Identificação */}
              <div className="bg-white dark:bg-stone-800 rounded-xl p-2 sm:p-2.5 border border-zinc-200 dark:border-stone-700 shadow-2xs space-y-1">
                {/* 1. Responsável pela Conta (Titularidade / Razão Social) */}
                <div className="w-full">
                  <label 
                    htmlFor="select-responsavel-conta" 
                    className="block text-xs font-bold text-zinc-900 dark:text-stone-100 mb-0.5 flex items-center justify-between"
                  >
                    <span className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-zinc-600 dark:text-stone-400" />
                      <span>Responsável pela Conta</span>
                    </span>
                    <span className="text-[10px] text-zinc-500 dark:text-stone-400 font-semibold">Titularidade / Razão Social</span>
                  </label>
                  <select
                    id="select-responsavel-conta"
                    value={responsavelContaId}
                    onChange={(e) => handleResponsavelContaChange(e.target.value)}
                    className="w-full px-2.5 py-1 text-xs font-bold bg-white dark:bg-stone-900 text-zinc-900 dark:text-stone-100 border border-zinc-300 dark:border-stone-600 rounded-lg focus:ring-2 focus:ring-zinc-900/20 outline-hidden shadow-2xs cursor-pointer truncate"
                  >
                    <option value="">-- Selecione o Responsável pela Conta --</option>
                    {accountHolders.map((holder) => (
                      <option key={holder.id} value={holder.id}>
                        {holder.name} ({holder.tipo}) {holder.documento ? `• ${holder.documento}` : ''}
                      </option>
                    ))}
                  </select>

                  {/* Lembrete discreto com CNPJ, CPF e Nome Completo / Razão Social vinculado */}
                  {selectedResponsavel && (
                    <div 
                      id="lembrete-responsavel-conta-vinculado"
                      className="mt-1 px-2 py-0.5 rounded-md bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11px] flex items-center gap-1.5 shadow-2xs animate-in fade-in"
                    >
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <div className="flex-1 leading-tight flex items-center justify-between gap-1 flex-wrap">
                        <span className="font-extrabold text-emerald-950 dark:text-emerald-100 text-[11px]">
                          {selectedResponsavel.name}
                        </span>
                        <span className="text-[10px] text-emerald-900/80 dark:text-emerald-300 font-mono">
                          {selectedResponsavel.documento ? `Doc: ${selectedResponsavel.documento}` : ''}
                        </span>
                        <span className="text-[9.5px] text-emerald-700 dark:text-emerald-400 font-bold ml-auto">
                          ✓ Vinculado
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Nome Identificador da Conta */}
                <div className="w-full pt-1 border-t border-zinc-100 dark:border-stone-700/60">
                  <label 
                    htmlFor="input-conta-nome" 
                    className="block text-xs font-bold text-zinc-900 dark:text-stone-100 mb-0.5 flex items-center justify-between"
                  >
                    <span>
                      Nome Identificador da Conta <span className="text-rose-600">*</span>
                    </span>
                    <span className="text-[10px] text-zinc-500 dark:text-stone-400 font-semibold">Ex: Conta Principal Agro, Caixa Sede</span>
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
                    placeholder="Ex: Sicredi - Fazenda Sede"
                    className="w-full px-2.5 py-1 text-xs font-bold bg-white dark:bg-stone-900 text-zinc-900 dark:text-stone-100 border border-zinc-300 dark:border-stone-600 rounded-lg focus:ring-2 focus:ring-zinc-900/20 outline-hidden shadow-2xs"
                  />
                </div>
              </div>

              {/* BLOCO 3: Valores, Saldo Inicial e Limite de Cheque Especial */}
              <div className="bg-white dark:bg-stone-800 rounded-xl p-2 sm:p-2.5 border border-zinc-200 dark:border-stone-700 shadow-2xs space-y-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {/* Saldo Inicial / Atual */}
                  <div>
                    <label 
                      htmlFor="input-conta-saldo" 
                      className="block text-xs font-bold text-zinc-900 dark:text-stone-100 mb-0.5 flex items-center justify-between"
                    >
                      <span>Saldo Inicial / Atual (R$)</span>
                      <button
                        type="button"
                        onClick={() => setIsNegativeBalance(!isNegativeBalance)}
                        className={`px-1.5 py-0.2 rounded text-[10px] font-bold tracking-tight transition cursor-pointer ${
                          isNegativeBalance
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-stone-700 dark:text-stone-300'
                        }`}
                        title="Alternar entre saldo positivo e saldo negativo (devedor)"
                      >
                        {isNegativeBalance ? '(-) Negativo' : '(+) Positivo'}
                      </button>
                    </label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500 font-bold text-xs pointer-events-none select-none">
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
                        className={`w-full pl-9 pr-2 py-1 text-xs font-bold bg-white dark:bg-stone-900 border border-zinc-300 dark:border-stone-600 rounded-lg focus:ring-2 focus:ring-zinc-900/20 outline-hidden shadow-2xs font-mono ${
                          isNegativeBalance ? 'text-rose-600' : 'text-zinc-900 dark:text-stone-100'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Limite de Cheque Especial (R$) */}
                  <div>
                    <label 
                      htmlFor="input-conta-cheque-especial" 
                      className="block text-xs font-bold text-zinc-900 dark:text-stone-100 mb-0.5 flex items-center justify-between"
                    >
                      <span className="flex items-center gap-1">
                        <CreditCard className="w-3 h-3 text-zinc-600 dark:text-stone-400" />
                        <span>Limite Cheque Especial</span>
                      </span>
                      <span className="text-[10px] text-zinc-500 dark:text-stone-400 font-semibold">Rotativo</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500 font-bold text-xs pointer-events-none select-none">
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
                        className="w-full pl-7 pr-2 py-1 text-xs font-bold bg-white dark:bg-stone-900 text-zinc-900 dark:text-stone-100 border border-zinc-300 dark:border-stone-600 rounded-lg focus:ring-2 focus:ring-zinc-900/20 outline-hidden shadow-2xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* CARD DE PRÉ-VISUALIZAÇÃO: Saldo Total Disponível para Uso */}
                <div className="p-1.5 rounded-lg bg-zinc-50 dark:bg-stone-900/80 border border-zinc-200 dark:border-stone-700 flex items-center justify-between gap-1 shadow-2xs">
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 dark:text-stone-400 block leading-none">
                      Total Disponível
                    </span>
                    <div className="text-sm sm:text-base font-black text-zinc-900 dark:text-stone-100 font-['Outfit'] tracking-tight leading-tight">
                      {formatCurrencyBRL(totalAvailable)}
                    </div>
                  </div>

                  <div className="text-right text-[10px] text-zinc-600 dark:text-stone-400 font-medium">
                    <div className="flex items-center gap-1.5 justify-end">
                      <span>Saldo: <strong className={numericBalance < 0 ? 'text-rose-700' : 'text-zinc-900 dark:text-stone-100'}>{formatCurrencyBRL(numericBalance)}</strong></span>
                      <span>•</span>
                      <span>Limite: <strong className="text-emerald-800 dark:text-emerald-400">{formatCurrencyBRL(numericOverdraft)}</strong></span>
                    </div>
                  </div>
                </div>
              </div>

              {/* BLOCO 4: Chave PIX Composta (Tipo + Input Mascarado) */}
              <div className="bg-white dark:bg-stone-800 rounded-xl p-2 sm:p-2.5 border border-zinc-200 dark:border-stone-700 shadow-2xs space-y-1">
                <label className="block text-xs font-bold text-zinc-900 dark:text-stone-100 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <QrCode className="w-3 h-3 text-zinc-600 dark:text-stone-400" />
                    <span>Chave PIX (Opcional)</span>
                  </span>
                  <span className="text-[10px] text-zinc-500 dark:text-stone-400 font-semibold">
                    Transferências rápidas
                  </span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-1.5">
                  <div className="sm:col-span-4">
                    <select
                      id="select-tipo-chave-pix"
                      value={pixKeyType}
                      onChange={(e) => handlePixTypeChange(e.target.value as any)}
                      className="w-full px-2 py-1 text-xs font-bold bg-white dark:bg-stone-900 text-zinc-900 dark:text-stone-100 border border-zinc-300 dark:border-stone-600 rounded-lg focus:ring-2 focus:ring-zinc-900/20 outline-hidden shadow-2xs cursor-pointer"
                    >
                      <option value="cpf">CPF (Pessoa Física)</option>
                      <option value="cnpj">CNPJ (Pessoa Jurídica)</option>
                      <option value="phone">Celular (Telefone)</option>
                      <option value="email">E-mail</option>
                      <option value="random">Chave Aleatória (EVP)</option>
                    </select>
                  </div>

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
                      className="w-full px-2 py-1 text-xs font-bold bg-white dark:bg-stone-900 text-zinc-900 dark:text-stone-100 border border-zinc-300 dark:border-stone-600 rounded-lg focus:ring-2 focus:ring-zinc-900/20 outline-hidden shadow-2xs font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* BLOCO 5 (AÇÃO DA COLUNA DA ESQUERDA): Cartões de Crédito Vinculados */}
              <div 
                id="bloco-cartoes-resumo-esquerda"
                className="bg-white dark:bg-stone-800 rounded-xl p-2 sm:p-2.5 border border-zinc-200 dark:border-stone-700 shadow-2xs flex items-center justify-between gap-2 mt-auto"
              >
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-700 dark:text-emerald-300 shrink-0">
                    <CreditCard className="w-3.5 h-3.5 stroke-[2.5]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-zinc-900 dark:text-stone-100 flex items-center gap-1.5 leading-none">
                      <span>Cartões de Crédito Corporativos</span>
                      <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                        {corporateCards.length}
                      </span>
                    </h4>
                    <p className="text-[10px] text-zinc-500 dark:text-stone-400 font-medium mt-0.5 leading-none">
                      {corporateCards.length === 0
                        ? 'Nenhum cartão vinculado'
                        : `${corporateCards.length} cartão(ões) físico(s) à direita`}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  id="btn-adicionar-cartao-coluna-esquerda"
                  onClick={handleAddCard}
                  className="inline-flex items-center justify-center gap-1 px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer active:scale-98 shrink-0 min-h-[28px]"
                  title="Adicionar Cartão Corporativo à lista"
                >
                  <Plus className="w-3 h-3 stroke-[3]" />
                  <span>+ Adicionar</span>
                </button>
              </div>

            </div>

            {/* ======================================================== */}
            {/* COLUNA DA DIREITA (40% da Largura): MOCKUPS DOS CARTÕES */}
            {/* ======================================================== */}
            <div 
              id="painel-cartoes-corporativos"
              className="lg:col-span-5 flex flex-col bg-[#cdcdcd] dark:bg-stone-900/50 overflow-y-hidden scrollbar-none p-2 sm:p-2.5 gap-1.5"
            >
              {/* Cabeçalho do Painel Lateral de Cartões */}
              <div className="flex items-center justify-between pb-1.5 border-b border-zinc-200 dark:border-stone-700 shrink-0">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-lg bg-emerald-600/10 dark:bg-emerald-400/10 border border-emerald-600/20 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <CreditCard className="w-3.5 h-3.5 stroke-[2.5]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-zinc-900 dark:text-stone-100 uppercase tracking-wider flex items-center gap-1.5 leading-none">
                      <span>Cartões Corporativos Vinculados</span>
                      <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                        {corporateCards.length}
                      </span>
                    </h4>
                    <p className="text-[10px] text-zinc-500 dark:text-stone-400 font-medium leading-none mt-0.5">
                      Simulação física e gestão de faturas
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  id="btn-adicionar-cartao-coluna-direita"
                  onClick={handleAddCard}
                  className="inline-flex items-center justify-center gap-1 px-2 py-0.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer active:scale-98 shrink-0 min-h-[26px]"
                >
                  <Plus className="w-3 h-3 stroke-[3]" />
                  <span>+ Adicionar</span>
                </button>
              </div>

              {/* Resumo de Limites dos Cartões */}
              {corporateCards.length > 0 && (
                <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-white dark:bg-stone-800 border border-zinc-200 dark:border-stone-700 shadow-2xs text-center shrink-0">
                  <div>
                    <span className="text-[8.5px] uppercase font-bold text-zinc-500 dark:text-stone-400 block leading-tight">Limite Total</span>
                    <strong className="text-[11px] font-black text-zinc-900 dark:text-stone-100 font-mono leading-tight">
                      {formatCurrencyBRL(totalCardsLimit)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[8.5px] uppercase font-bold text-zinc-500 dark:text-stone-400 block leading-tight">Utilizado</span>
                    <strong className="text-[11px] font-black text-zinc-800 dark:text-stone-200 font-mono leading-tight">
                      {formatCurrencyBRL(totalCardsUsed)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[8.5px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block leading-tight">Disponível</span>
                    <strong className="text-[11px] font-black text-emerald-700 dark:text-emerald-400 font-mono leading-tight">
                      {formatCurrencyBRL(totalCardsAvailable)}
                    </strong>
                  </div>
                </div>
              )}

              {/* Banner de Feedback de Fechamento de Fatura */}
              {cardNotification && (
                <div className={`p-1.5 rounded-lg border text-xs font-bold flex items-center justify-between gap-1.5 shadow-2xs animate-in fade-in shrink-0 ${
                  cardNotification.type === 'success' 
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900' 
                    : 'bg-blue-50 border-blue-300 text-blue-900'
                }`}>
                  <div className="flex items-center gap-1.5 text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{cardNotification.message}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCardNotification(null)}
                    className="text-stone-500 hover:text-stone-800 p-0.5 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Listagem de Cartões ou Estado Vazio */}
              {corporateCards.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-4 bg-white/70 dark:bg-stone-800/40 rounded-xl border border-dashed border-zinc-300 dark:border-stone-700 my-auto">
                  <div className="w-10 h-8 rounded-lg border-2 border-dashed border-zinc-300 dark:border-stone-600 flex items-center justify-center text-zinc-400 dark:text-stone-500 mb-1.5">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-zinc-800 dark:text-stone-200">
                    Nenhum cartão corporativo vinculado
                  </p>
                  <p className="text-[10px] text-zinc-500 dark:text-stone-400 mt-0.5 max-w-xs leading-tight">
                    Clique em <strong>+ Adicionar Cartão</strong> para visualizar o mockup físico realista e vincular o cartão ao funcionário responsável.
                  </p>
                  <button
                    type="button"
                    onClick={handleAddCard}
                    className="mt-2.5 inline-flex items-center gap-1 px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer active:scale-98"
                  >
                    <Plus className="w-3 h-3 stroke-[3]" />
                    <span>Vincular Primeiro Cartão</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2 overflow-y-auto scrollbar-none flex-1 min-h-0">
                  {corporateCards.map((card, index) => {
                    const cardExpenses = getCardExpensesSum(card);
                    const usedPercent = card.totalLimit > 0 ? Math.min(100, Math.round((card.usedLimit / card.totalLimit) * 100)) : 0;
                    const availableLimit = Math.max(0, card.totalLimit - card.usedLimit);
                    const nextDueDate = calculateDueDate(card.dueDay || 10);
                    const cardKey = card.id || `card_${index}`;
                    const isExpanded = !!expandedCardIds[cardKey];

                    return (
                      <div
                        key={cardKey}
                        className="bg-white dark:bg-stone-800 border border-zinc-200 dark:border-stone-700 rounded-xl p-2 sm:p-2.5 space-y-1.5 shadow-xs hover:border-zinc-400 dark:hover:border-stone-500 transition animate-in fade-in"
                      >
                        {/* 1. MOCKUP FÍSICO REALISTA DO CARTÃO */}
                        <CorporateCardMockup 
                          card={card}
                          bankName={bankName}
                          bankCode={bankCode}
                          accountHolderName={responsavelContaNome}
                        />

                        {/* 2. RESUMO EXECUTIVO COMPACTO DO CARTÃO (SEMPRE VISÍVEL) */}
                        <div className="rounded-lg bg-zinc-100 dark:bg-stone-900/90 border border-zinc-200 dark:border-stone-700 p-2 text-xs shadow-2xs space-y-1.5">
                          {/* Linha Superior: Identificação, Portador e Status */}
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="font-extrabold text-zinc-900 dark:text-stone-100 uppercase text-[10.5px] tracking-wide shrink-0">
                                {card.brand === 'visa' ? 'Visa' : card.brand === 'elo' ? 'Elo' : 'Mastercard'} Final {card.last4 || '4520'}
                              </span>
                              <span className="text-zinc-300 dark:text-stone-600 font-bold">•</span>
                              <div className="flex items-center gap-1 text-zinc-900 dark:text-stone-100 font-bold text-[10.5px] truncate">
                                <div className="w-3.5 h-3.5 rounded-full bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 flex items-center justify-center text-amber-700 dark:text-amber-300 shrink-0">
                                  <User className="w-2.5 h-2.5" />
                                </div>
                                <span className="truncate">
                                  {(card.titular_nome || card.responsibleEmployeeName || 'AUDIRLEI REOLAN').toUpperCase()}
                                </span>
                                <span className="text-zinc-500 dark:text-stone-400 font-normal shrink-0">
                                  ({card.responsavel_funcao || 'Motorista'})
                                </span>
                              </div>
                            </div>
                            
                            <span className="text-[9.5px] font-bold text-emerald-700 dark:text-emerald-400 shrink-0 px-1 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800">
                              Ativo
                            </span>
                          </div>

                          {/* Linha Central: Resumo de Limites, Vencimento e Barra Fina */}
                          <div className="space-y-1 pt-1 border-t border-zinc-200/60 dark:border-stone-800">
                            <div className="flex items-center justify-between text-[10px] text-zinc-600 dark:text-stone-400">
                              <span>
                                Utilizado: <strong className="text-zinc-900 dark:text-stone-100 font-bold font-mono">{formatCurrencyBRL(card.usedLimit)}</strong> de <span className="font-mono">{formatCurrencyBRL(card.totalLimit)}</span> <span className="text-[9px] font-semibold text-zinc-500">({usedPercent}%)</span>
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-2.5 h-2.5 text-zinc-400" />
                                <span>Venc.: <strong className="text-zinc-800 dark:text-stone-200 font-bold font-mono">Dia {String(card.dueDay || 10).padStart(2, '0')}</strong></span>
                              </span>
                            </div>

                            {/* Barra de Progresso Fina */}
                            <div className="w-full h-1 bg-zinc-200 dark:bg-stone-700 rounded-full overflow-hidden">
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

                            <div className="flex items-center justify-between text-[9.5px] text-zinc-500 dark:text-stone-400">
                              <span>
                                Disponível: <strong className="text-emerald-700 dark:text-emerald-400 font-mono font-bold">{formatCurrencyBRL(availableLimit)}</strong>
                              </span>
                              {cardExpenses > 0 && (
                                <span className="text-[9px] text-amber-700 dark:text-amber-400 font-medium">
                                  {formatCurrencyBRL(cardExpenses)} despesas em aberto
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Linha Inferior: Botão "Editar Informações do Cartão", Fechar Fatura e Excluir */}
                          <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-zinc-200/60 dark:border-stone-800">
                            <button
                              type="button"
                              onClick={() => toggleCardExpansion(cardKey)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer active:scale-98 ${
                                isExpanded
                                  ? 'bg-zinc-900 text-white dark:bg-stone-100 dark:text-stone-900'
                                  : 'bg-white dark:bg-stone-800 hover:bg-zinc-50 dark:hover:bg-stone-700 text-zinc-800 dark:text-stone-200 border border-zinc-300 dark:border-stone-600'
                              }`}
                              title={isExpanded ? 'Recolher formulário de edição' : 'Editar informações detalhadas deste cartão'}
                            >
                              <Pencil className="w-3 h-3 stroke-[2.5]" />
                              <span>{isExpanded ? 'Recolher Edição' : 'Editar Informações do Cartão'}</span>
                              {isExpanded ? (
                                <ChevronUp className="w-3 h-3 text-zinc-400" />
                              ) : (
                                <ChevronDown className="w-3 h-3 text-zinc-400" />
                              )}
                            </button>

                            <div className="flex items-center gap-1">
                              {card.usedLimit > 0 && !isExpanded && (
                                <button
                                  type="button"
                                  onClick={() => handleCloseAndProvisionInvoice(card)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10.5px] font-bold bg-zinc-900 hover:bg-black dark:bg-stone-700 dark:hover:bg-stone-600 text-white transition shadow-2xs cursor-pointer"
                                  title={`Provisionar fatura de ${formatCurrencyBRL(card.usedLimit)} no Contas a Pagar`}
                                >
                                  <Zap className="w-2.5 h-2.5 text-amber-300" />
                                  <span>Fechar Fatura</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleRemoveCard(card.id)}
                                className="p-1 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                                title="Excluir este Cartão"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* 3. FORMULÁRIO COMPLETO EXPANSÍVEL (EXIBIDO APENAS AO CLICAR EM "EDITAR INFORMAÇÕES") */}
                        {isExpanded && (
                          <div className="p-2 sm:p-2.5 rounded-lg bg-zinc-50 dark:bg-stone-900 border border-zinc-300 dark:border-stone-700 space-y-1.5 animate-in fade-in duration-150">
                            <div className="flex items-center justify-between pb-1 border-b border-zinc-200 dark:border-stone-700">
                              <span className="text-[10px] font-bold text-zinc-600 dark:text-stone-400 uppercase tracking-wider flex items-center gap-1">
                                <Pencil className="w-3 h-3 text-zinc-500" />
                                <span>Parâmetros de Gestão do Cartão</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleCardExpansion(cardKey)}
                                className="text-[10px] font-bold text-zinc-500 hover:text-zinc-800 dark:text-stone-400 hover:underline cursor-pointer"
                              >
                                Recolher
                              </button>
                            </div>

                            {/* Linha: Identificador/Final e Bandeira */}
                            <div className="grid grid-cols-2 gap-1.5">
                              <div>
                                <label className="block text-[10px] font-bold text-zinc-700 dark:text-stone-300 mb-0.5">
                                  Bandeira
                                </label>
                                <select
                                  value={card.brand || ((card.name || '').toLowerCase().includes('visa') ? 'visa' : 'mastercard')}
                                  onChange={(e) => {
                                    const newBrand = e.target.value as any;
                                    const brandLabel = newBrand === 'visa' ? 'Visa' : newBrand === 'elo' ? 'Elo' : 'Mastercard';
                                    const digits = card.last4 || (card.name ? card.name.match(/\d{4}/)?.[0] : null) || '4520';
                                    handleUpdateCard(card.id, {
                                      brand: newBrand,
                                      name: `${brandLabel} Final ${digits}`,
                                    });
                                  }}
                                  className="w-full px-2 py-1 text-xs font-bold bg-white dark:bg-stone-900 text-zinc-900 dark:text-stone-100 border border-zinc-300 dark:border-stone-600 rounded-lg focus:ring-2 focus:ring-zinc-900/20 outline-hidden shadow-2xs cursor-pointer"
                                >
                                  <option value="mastercard">Mastercard</option>
                                  <option value="visa">Visa</option>
                                  <option value="elo">Elo</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-zinc-700 dark:text-stone-300 mb-0.5">
                                  Identificador / Final
                                </label>
                                <input
                                  type="text"
                                  value={card.name}
                                  onChange={(e) => {
                                    const newName = e.target.value;
                                    const matchDigits = newName.match(/\d{4}/)?.[0];
                                    handleUpdateCard(card.id, { 
                                      name: newName,
                                      ...(matchDigits ? { last4: matchDigits } : {})
                                    });
                                  }}
                                  placeholder="Ex: Mastercard Final 4520"
                                  className="w-full px-2 py-1 text-xs font-bold bg-white dark:bg-stone-900 text-zinc-900 dark:text-stone-100 border border-zinc-300 dark:border-stone-600 rounded-lg focus:ring-2 focus:ring-zinc-900/20 outline-hidden shadow-2xs font-mono"
                                />
                              </div>
                            </div>

                            {/* Funcionário Responsável: Dropdown com Módulo RH */}
                            <div>
                              <label className="block text-[10px] font-bold text-zinc-700 dark:text-stone-300 mb-0.5 flex items-center gap-1">
                                <UserCheck className="w-3 h-3 text-zinc-600 dark:text-stone-400" />
                                <span>Funcionário Responsável / Módulo RH</span>
                              </label>
                              <select
                                value={card.responsibleEmployeeId}
                                onChange={(e) => {
                                  const emp = availableEmployees.find((x) => x.id === e.target.value);
                                  const empName = emp?.name || '';
                                  const empRole = emp?.role || 'Motorista';
                                  handleUpdateCard(card.id, {
                                    responsibleEmployeeId: e.target.value,
                                    responsibleEmployeeName: empName,
                                    responsavel_cartao_id: e.target.value,
                                    titular_nome: empName.toUpperCase(),
                                    responsavel_funcao: empRole,
                                  });
                                }}
                                className="w-full px-2 py-1 text-xs font-bold bg-white dark:bg-stone-900 text-zinc-900 dark:text-stone-100 border border-zinc-300 dark:border-stone-600 rounded-lg focus:ring-2 focus:ring-zinc-900/20 outline-hidden shadow-2xs cursor-pointer truncate"
                              >
                                <option value="">-- Selecione o Funcionário Responsável --</option>
                                {availableEmployees.map((emp) => (
                                  <option key={emp.id} value={emp.id}>
                                    {emp.name} {emp.role ? `(${emp.role})` : ''}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Nome no Plástico do Cartão (Titularidade) e Função / Cargo */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              <div>
                                <label className="block text-[10px] font-bold text-zinc-700 dark:text-stone-300 mb-0.5 flex items-center justify-between">
                                  <span>Nome no Plástico (Titularidade)</span>
                                  <span className="text-[9px] text-zinc-400 font-normal">Ao vivo</span>
                                </label>
                                <input
                                  type="text"
                                  value={card.titular_nome || card.responsibleEmployeeName || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    handleUpdateCard(card.id, {
                                      titular_nome: val.toUpperCase(),
                                      responsibleEmployeeName: val,
                                    });
                                  }}
                                  placeholder="Ex: AUDIRLEI REOLAN"
                                  className="w-full px-2 py-1 text-xs font-black bg-white dark:bg-stone-900 text-zinc-900 dark:text-stone-100 border border-zinc-300 dark:border-stone-600 rounded-lg focus:ring-2 focus:ring-zinc-900/20 outline-hidden shadow-2xs uppercase font-mono tracking-wide"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-zinc-700 dark:text-stone-300 mb-0.5">
                                  Função / Cargo do Portador
                                </label>
                                <input
                                  type="text"
                                  value={card.responsavel_funcao || 'Motorista'}
                                  onChange={(e) => {
                                    handleUpdateCard(card.id, {
                                      responsavel_funcao: e.target.value,
                                    });
                                  }}
                                  placeholder="Ex: Motorista"
                                  className="w-full px-2 py-1 text-xs font-bold bg-white dark:bg-stone-900 text-zinc-900 dark:text-stone-100 border border-zinc-300 dark:border-stone-600 rounded-lg focus:ring-2 focus:ring-zinc-900/20 outline-hidden shadow-2xs"
                                />
                              </div>
                            </div>

                            {/* Grid: Limite Total e Limite Utilizado */}
                            <div className="grid grid-cols-2 gap-1.5">
                              <div>
                                <label className="block text-[10px] font-bold text-zinc-700 dark:text-stone-300 mb-0.5">
                                  Limite Total (R$)
                                </label>
                                <div className="relative">
                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500 font-bold text-[10px] pointer-events-none select-none">
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
                                    className="w-full pl-6 pr-1.5 py-1 text-xs font-bold bg-white dark:bg-stone-900 text-zinc-900 dark:text-stone-100 border border-zinc-300 dark:border-stone-600 rounded-lg focus:ring-2 focus:ring-zinc-900/20 outline-hidden shadow-2xs font-mono"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-zinc-700 dark:text-stone-300 mb-0.5 flex items-center justify-between">
                                  <span>Limite Utilizado (R$)</span>
                                  {cardExpenses > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateCard(card.id, { usedLimit: cardExpenses })}
                                      className="text-[9px] text-zinc-700 dark:text-stone-300 hover:underline flex items-center gap-0.5 cursor-pointer font-bold"
                                      title="Copiar soma de despesas abertas no sistema"
                                    >
                                      <RefreshCw className="w-2.5 h-2.5" />
                                      <span>{formatCurrencyBRL(cardExpenses)}</span>
                                    </button>
                                  )}
                                </label>
                                <div className="relative">
                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500 font-bold text-[10px] pointer-events-none select-none">
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
                                    className="w-full pl-6 pr-1.5 py-1 text-xs font-bold bg-white dark:bg-stone-900 text-zinc-900 dark:text-stone-100 border border-zinc-300 dark:border-stone-600 rounded-lg focus:ring-2 focus:ring-zinc-900/20 outline-hidden shadow-2xs font-mono"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Vencimento e Botão de Provisionamento */}
                            <div className="pt-1 border-t border-zinc-200 dark:border-stone-700 flex items-center justify-between gap-1.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-zinc-600 dark:text-stone-400 flex items-center gap-1 shrink-0">
                                  <Calendar className="w-3 h-3 text-zinc-500" />
                                  <span>Venc.:</span>
                                </span>
                                <select
                                  value={card.dueDay || 10}
                                  onChange={(e) => handleUpdateCard(card.id, { dueDay: Number(e.target.value) })}
                                  className="px-1.5 py-0.5 text-xs font-bold bg-white dark:bg-stone-900 text-zinc-900 dark:text-stone-100 border border-zinc-300 dark:border-stone-600 rounded-md focus:ring-2 focus:ring-zinc-900/20 outline-hidden shadow-2xs cursor-pointer font-mono"
                                >
                                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                                    <option key={day} value={day}>
                                      Dia {String(day).padStart(2, '0')}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleCloseAndProvisionInvoice(card)}
                                  disabled={card.usedLimit <= 0}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer active:scale-98 ${
                                    card.usedLimit > 0
                                      ? 'bg-zinc-900 hover:bg-black dark:bg-stone-700 dark:hover:bg-stone-600 text-white'
                                      : 'bg-zinc-100 text-zinc-400 dark:bg-stone-800 dark:text-stone-500 border border-zinc-200 dark:border-stone-700 cursor-not-allowed'
                                  }`}
                                  title={
                                    card.usedLimit > 0
                                      ? `Provisionar fatura de ${formatCurrencyBRL(card.usedLimit)} no Contas a Pagar`
                                      : 'Não há limite utilizado para provisionar fatura'
                                  }
                                >
                                  <Zap className="w-3 h-3 text-amber-300" />
                                  <span>Fechar Fatura</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => toggleCardExpansion(cardKey)}
                                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white transition shadow-xs cursor-pointer"
                                >
                                  <Check className="w-3 h-3 stroke-[3]" />
                                  <span>Concluir</span>
                                </button>
                              </div>
                            </div>

                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* RODAPÉ DO MODAL: Ações e Resumo Geral */}
          <div className="px-4 sm:px-5 py-2.5 flex items-center justify-between border-t border-slate-300 dark:border-stone-800 bg-gradient-to-b from-slate-100 via-slate-50 to-slate-200 dark:from-stone-900 dark:via-stone-850 dark:to-stone-900 rounded-b-2xl shrink-0">
            <div className="hidden sm:flex items-center space-x-3 text-xs text-slate-600 dark:text-stone-400 font-medium">
              <span>Saldo: <strong className={numericBalance < 0 ? 'text-rose-600 font-bold' : 'text-slate-900 dark:text-stone-100 font-bold'}>{formatCurrencyBRL(numericBalance)}</strong></span>
              <span>•</span>
              <span>Disponível: <strong className="text-emerald-700 dark:text-emerald-400 font-bold">{formatCurrencyBRL(totalAvailable)}</strong></span>
              <span>•</span>
              <span>Cartões: <strong className="text-slate-900 dark:text-stone-100 font-bold">{corporateCards.length}</strong></span>
            </div>

            <div className="flex items-center justify-end gap-2 ml-auto">
              {saveSuccessMessage && (
                <div 
                  id="badge-sucesso-salvamento-conta"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 text-xs font-bold animate-in fade-in zoom-in-95 duration-150 shadow-2xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Alterações Salvas com Sucesso!</span>
                </div>
              )}

              <button
                type="button"
                id="btn-sair-modal-conta"
                onClick={onClose}
                className="px-3.5 py-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-stone-700 text-slate-700 dark:text-stone-300 bg-white dark:bg-stone-800 hover:bg-slate-100 dark:hover:bg-stone-700 cursor-pointer transition shadow-2xs min-h-[32px]"
                title="Fechar janela"
              >
                Sair
              </button>

              <button
                type="button"
                id="btn-cancelar-modal-conta"
                onClick={onClose}
                className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-white dark:bg-stone-800 border border-slate-300 dark:border-stone-700 text-slate-700 dark:text-stone-300 hover:bg-slate-100 dark:hover:bg-stone-700 cursor-pointer transition shadow-2xs min-h-[32px]"
              >
                Cancelar
              </button>

              <button
                type="submit"
                id="btn-salvar-conta-bancaria"
                className="px-5 py-1.5 text-xs sm:text-sm font-bold rounded-lg bg-gradient-to-b from-emerald-600 via-emerald-700 to-emerald-800 hover:from-emerald-500 hover:to-emerald-700 text-white shadow-sm border border-emerald-500/50 cursor-pointer transition active:scale-98 flex items-center space-x-1.5 min-h-[32px]"
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>Salvar Alterações</span>
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
};
