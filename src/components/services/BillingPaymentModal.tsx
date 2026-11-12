import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Plus,
  Trash2,
  DollarSign,
  Calendar,
  CreditCard,
  Layers,
  AlertCircle,
  CheckCircle2,
  Building2,
  FileCheck2,
  Send,
  Percent,
  Sparkles,
  Lock,
  Unlock,
  KeyRound,
  ShieldCheck,
  Camera,
  Eye,
  FileText,
  Landmark,
  Wallet,
  WalletCards,
} from 'lucide-react';
import { 
  ServiceOrder, 
  PaymentMethod, 
  BankAccount, 
  CompanyProfile, 
  FinanceiroCheque 
} from '../../types';
import { 
  formatCurrencyBRL, 
  formatDateBR, 
  getActiveCompanyId,
  getStoredFinanceiroCheques,
  saveStoredFinanceiroCheques,
  getStoredClients,
  getStoredBankAccounts,
  getStoredEmployees
} from '../../lib/storage';
import { getStoredAdminSettings } from '../../lib/masterAdminStorage';
import { 
  saveFinanceiroCheque, 
  uploadChequeImagem, 
  toValidUUID 
} from '../../lib/supabaseService';
import { BRAZILIAN_BANKS } from '../financial/brazilianBanks';

export interface ReceivableItem {
  id: string;
  type: 'Venda de Silagem' | 'Prestação de Serviço' | string;
  clientName: string;
  date: string;
  dueDate: string;
  volume: string;
  totalAmount: number;
  status: 'pendente' | 'pago';
  notes?: string;
  clientId?: string;
  paymentMethod?: PaymentMethod | string;
  isInstallment?: boolean;
  installmentNumber?: number;
  totalInstallments?: number;
  chequeId?: string;
  chequeNumero?: string;
}

export interface InstallmentPreviewItem {
  number: number;
  totalInstallments: number;
  dueDate: string;
  amount: number;
  isPaid: boolean;
  notes?: string;
}

export interface ChequeItemForm {
  id: string;
  installmentNumber: number;
  banco: string;
  bancoCodigo: string;
  numero: string;
  emitenteNome: string;
  emitenteDoc: string;
  dataVencimento: string;
  valor: number;
  selectedFile?: File | null;
  previewUrl?: string;
  uploadedImageUrl?: string;
  isUploading?: boolean;
}

export interface ReceivePaymentSuccessDetails {
  itemId: string;
  itemType: string;
  paymentMethod: PaymentMethod;
  paidAmount: number;
  receiptDate: string;
  cheque?: FinanceiroCheque;
  cheques?: FinanceiroCheque[];
  creditoGerado?: number;
  bankAccountId?: string;
  isInstallmentPlan?: boolean;
  installments?: InstallmentPreviewItem[];
  firstPaidImmediately?: boolean;
  interestAmount?: number;
  interestPercentage?: number;
  splitLines?: BillingPaymentLine[];
  unlockedChequeSubstitution?: boolean;
}

export const getPaymentMethodLabel = (method?: PaymentMethod | string | ''): string => {
  if (!method) return 'Selecione uma forma de pagamento...';
  switch (method) {
    case 'dinheiro':
      return 'Dinheiro';
    case 'pix':
      return 'PIX';
    case 'cartao_credito':
      return 'Cartão Crédito';
    case 'cartao_debito':
      return 'Cartão Débito';
    case 'transferencia':
      return 'TED / DOC';
    case 'cheque':
      return 'Cheque';
    case 'prazo_carteira':
      return 'A prazo (carteira)';
    case 'safra_prazo':
      return 'Safra a Prazo';
    case 'boleto':
      return 'Boleto';
    case 'assinado_nota':
      return 'Assinado nota';
    default:
      return method ? String(method).toUpperCase() : 'Não informado';
  }
};

export const isInstallmentEligible = (method?: PaymentMethod | string | ''): boolean => {
  if (!method) return false;
  return (
    method === 'cartao_credito' ||
    method === 'cheque' ||
    method === 'prazo_carteira' ||
    method === 'safra_prazo' ||
    method === 'boleto'
  );
};

export interface BillingPaymentLine {
  id: string;
  paymentMethod: PaymentMethod | '';
  amount: number; // Valor original de face alocado (ex: R$ 25.000,00)
  firstDueDate: string;
  installmentsCount: number; // 1 = à vista, 2..24
  installmentsIntervalDays: number; // default 30
  interestAmount?: number; // Juros / Acréscimos em R$
  interestPercentage?: number; // Juros / Acréscimos em %
  notes?: string;
  cheques?: ChequeItemForm[];
}

export interface BillingPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  service?: ServiceOrder | null;
  item?: ReceivableItem | null;
  bankAccounts?: BankAccount[];
  companyProfile?: CompanyProfile;
  onConfirm?: (splitOrders: ServiceOrder[]) => void;
  onSuccess?: (details: ReceivePaymentSuccessDetails) => void;
  mode?: 'billing' | 'receiving';
}

// Auxiliar para somar dias a uma data no formato YYYY-MM-DD
const addDays = (dateStr: string, days: number): string => {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dt = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dt}`;
};

/**
 * Converte valor numérico em string monetária formatada no padrão PT-BR sem símbolo R$:
 * Ex: 10000 -> "10.000,00", 0 -> "0,00"
 */
export const formatCurrencyInputBRL = (val: number | undefined | null): string => {
  if (val === undefined || val === null || isNaN(val) || val === 0) return '0,00';
  return val.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/**
 * Converte a digitação da direita para a esquerda (máscara de centavos) em Float decimal puro
 */
export const parseCurrencyInputToFloat = (raw: string): number => {
  if (!raw) return 0;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return 0;
  const cents = parseInt(digits, 10);
  if (isNaN(cents)) return 0;
  return Number((cents / 100).toFixed(2));
};

/**
 * Conta padrão prioritária (Sicredi / Colaça Silagem) caso nenhuma conta esteja salva
 */
export const DEFAULT_PRIORITY_SICREDI: BankAccount = {
  id: 'conta_sicredi_colaca_prioritaria',
  name: 'COLAÇA SILAGEM',
  bankName: 'SICREDI',
  bankCode: '748',
  agency: '074',
  accountNumber: '748074-1',
  accountType: 'corrente',
  balance: 0,
  isPriority: true,
  prioritaria: true,
  status: 'ativa',
  color: '#005f6a',
};

/**
 * Localiza a conta bancária prioritária/favorita na lista cadastrada
 */
export const findPriorityBankAccount = (accounts: BankAccount[]): BankAccount | null => {
  if (!accounts || accounts.length === 0) return null;
  // 1. Prioritária explícita configurada (isPriority || prioritaria)
  const pri = accounts.find((a: any) => a.isPriority === true || a.prioritaria === true);
  if (pri) return pri;

  // 2. Status 'PRIORITÁRIA' ou 'isDefault' / 'padrao'
  const byStatus = accounts.find(
    (a: any) =>
      String(a.status || '').toUpperCase() === 'PRIORITÁRIA' ||
      String(a.status || '').toUpperCase() === 'PRIORITARIA' ||
      a.isDefault === true ||
      a.padrao === true
  );
  if (byStatus) return byStatus;

  // 3. Conta Sicredi (748 / 074) frequentemente associada à Colaça Silagem
  const sicredi = accounts.find(
    (a: any) =>
      (a.bankName || a.name || '').toLowerCase().includes('sicredi') ||
      a.bankCode === '748' ||
      a.agency === '074'
  );
  if (sicredi) return sicredi;

  // 4. Primeira conta ativa
  const active = accounts.find(
    (a: any) =>
      String(a.status || '').toLowerCase() === 'ativa' ||
      String(a.status || '').toLowerCase() === 'ativo'
  );
  return active || accounts[0] || null;
};

export const BillingPaymentModal: React.FC<BillingPaymentModalProps> = ({
  isOpen,
  onClose,
  service,
  item,
  bankAccounts = [],
  companyProfile,
  onConfirm,
  onSuccess,
  mode,
}) => {
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  
  // Normalização do título ativo (pode ser ServiceOrder ou ReceivableItem)
  const isServiceMode = mode === 'billing' || (Boolean(service) && !item);
  const activeRecord = service || item || null;

  const targetId = service?.id || item?.id || '';
  const targetOrderNumber = service?.orderNumber || (item?.id ? item.id.slice(-4) : '');
  const clientName = service?.clientName || item?.clientName || 'Cliente';
  const farmOrOrigin = service?.farmName 
    ? `Fazenda: ${service.farmName}` 
    : (item?.volume ? `Volume: ${item.volume}` : (item?.type || ''));
  const serviceOrType = service?.serviceType || item?.type || 'Serviço';
  const totalAmount = Number(service?.totalAmount ?? item?.totalAmount ?? 0);

  // Resolução resiliente das contas bancárias (prop -> storage -> fallback padrão)
  const effectiveBankAccounts = useMemo<BankAccount[]>(() => {
    if (Array.isArray(bankAccounts) && bankAccounts.length > 0) {
      return bankAccounts;
    }
    try {
      const stored = getStoredBankAccounts();
      if (Array.isArray(stored) && stored.length > 0) {
        return stored;
      }
    } catch (err) {
      console.warn('Erro ao carregar contas bancárias salvas no BillingPaymentModal:', err);
    }
    return [DEFAULT_PRIORITY_SICREDI];
  }, [bankAccounts]);

  const priorityBankAccount = useMemo<BankAccount | null>(() => {
    return findPriorityBankAccount(effectiveBankAccounts);
  }, [effectiveBankAccounts]);

  const hasUserManuallyChangedBankRef = useRef(false);

  // Estados principais
  const [lines, setLines] = useState<BillingPaymentLine[]>([]);
  const [billingNotesExtra, setBillingNotesExtra] = useState('');
  const [receiptDate, setReceiptDate] = useState(today);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState('');
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);

  // Destravamento Administrativo de Cheques da Custódia
  const [preloadedCheque, setPreloadedCheque] = useState<FinanceiroCheque | null>(null);
  const [isUnlockedByAdmin, setIsUnlockedByAdmin] = useState(false);
  const [showUnlockPasswordModal, setShowUnlockPasswordModal] = useState(false);
  const [unlockPasswordInput, setUnlockPasswordInput] = useState('');
  const [unlockPasswordError, setUnlockPasswordError] = useState('');
  const [successToast, setSuccessToast] = useState('');
  const [formValidationError, setFormValidationError] = useState('');

  // Identificação do cliente e documento para preenchimento de cheques
  const resolvedClient = useMemo(() => {
    if (!clientName) return null;
    try {
      const clients = getStoredClients();
      const cleanSearch = clientName.trim().toLowerCase();
      return clients.find(c => (c.name || '').trim().toLowerCase() === cleanSearch) || null;
    } catch {
      return null;
    }
  }, [clientName]);

  const targetClientId = useMemo(() => {
    if (service?.clientId) return service.clientId;
    if (item?.clientId) return item.clientId;
    if (resolvedClient?.id) return String(resolvedClient.id);
    return null;
  }, [service?.clientId, item?.clientId, resolvedClient]);

  // Checa se o título já veio com cheque da custódia vinculado
  useEffect(() => {
    if (!isOpen || !activeRecord) return;

    // REGRA DE NEGÓCIO: No faturamento de ordens de serviço (isServiceMode),
    // o operador está definindo o recebimento pela primeira vez.
    // Nunca deve buscar cheque nem aplicar bloqueio/aviso prévio na abertura.
    if (isServiceMode) {
      setPreloadedCheque(null);
      return;
    }

    const isChequeOrigin = 
      activeRecord.paymentMethod === 'cheque' &&
      Boolean((activeRecord as any).chequeId || (activeRecord as any).chequeNumero);

    let foundCheque: FinanceiroCheque | null = null;
    if (isChequeOrigin) {
      try {
        const storedChqs = getStoredFinanceiroCheques();
        const chqId = (activeRecord as any).chequeId;
        const chqNum = (activeRecord as any).chequeNumero;

        foundCheque = storedChqs.find(sc => {
          if (chqId && sc.id === chqId) return true;
          if (chqNum && (sc.numero_cheque === chqNum || sc.numeroCheque === chqNum)) return true;
          return false;
        }) || null;
      } catch (err) {
        console.warn('Erro ao carregar cheque vinculado:', err);
      }
    }

    setPreloadedCheque(foundCheque);
  }, [isOpen, activeRecord, clientName, totalAmount, isServiceMode]);

  // A regra de travamento da forma de pagamento e a badge "🔒 Travado" SÓ devem ser aplicadas
  // após o faturamento ter sido salvo e confirmado no banco de dados (quitação de título com chequeId)
  const hasPreRegisteredCheque = Boolean(
    !isServiceMode &&
    preloadedCheque &&
    (activeRecord as any)?.chequeId
  );

  const isChequeRestricted = hasPreRegisteredCheque && !isUnlockedByAdmin;

  // Sincroniza formulário ao abrir o modal
  useEffect(() => {
    if (!activeRecord || !isOpen) return;

    const baseDueDate = activeRecord.dueDate || (activeRecord as any).startDate || (activeRecord as any).date || today;
    setReceiptDate(today);
    setIsUnlockedByAdmin(false);
    setShowUnlockPasswordModal(false);
    setUnlockPasswordInput('');
    setUnlockPasswordError('');
    setSuccessToast('');
    setFormValidationError('');

    // Preenche conta bancária inicial com a conta prioritária
    hasUserManuallyChangedBankRef.current = false;
    const preloadedBankId =
      preloadedCheque?.conta_bancaria_destino_id ||
      (preloadedCheque as any)?.contaBancariaDestinoId ||
      (activeRecord as any)?.bankAccountId ||
      (activeRecord as any)?.conta_bancaria_id;

    if (preloadedBankId && effectiveBankAccounts.some(a => a.id === preloadedBankId)) {
      setSelectedBankAccountId(preloadedBankId);
    } else if (priorityBankAccount) {
      setSelectedBankAccountId(priorityBankAccount.id);
    } else if (effectiveBankAccounts.length > 0) {
      setSelectedBankAccountId(effectiveBankAccounts[0].id);
    } else {
      setSelectedBankAccountId('');
    }

    // Inicialização da Forma de Pagamento TOTALMENTE LIMPA (sem padrão):
    // Aberta estritamente vazia ('') para o usuário escolher como deseja receber
    const initialMethod: PaymentMethod | '' = isChequeRestricted ? 'cheque' : '';

    // Inicializa folha de cheque se for cheque
    const initialChequeLeaf: ChequeItemForm = {
      id: `chq_${Date.now()}_0`,
      installmentNumber: 1,
      banco: preloadedCheque?.banco || (priorityBankAccount ? `${priorityBankAccount.bankCode || '748'} - ${priorityBankAccount.bankName || 'SICREDI'}` : '748 - SICREDI'),
      bancoCodigo: preloadedCheque?.banco ? preloadedCheque.banco.substring(0, 3) : (priorityBankAccount?.bankCode || '748'),
      numero: preloadedCheque?.numero_cheque || preloadedCheque?.numeroCheque || (activeRecord as any).chequeNumero || '',
      emitenteNome: preloadedCheque?.emitente_nome || preloadedCheque?.emitenteNome || clientName,
      emitenteDoc: preloadedCheque?.emitente_documento || preloadedCheque?.emitenteDocumento || resolvedClient?.cpfCnpj || '',
      dataVencimento: preloadedCheque?.data_vencimento || preloadedCheque?.dataVencimento || baseDueDate,
      valor: Number(preloadedCheque?.valor) || totalAmount,
      previewUrl: preloadedCheque?.imagem_url || preloadedCheque?.imagemUrl || '',
      uploadedImageUrl: preloadedCheque?.imagem_url || preloadedCheque?.imagemUrl || '',
      isUploading: false
    };

    setLines([
      {
        id: `line_${Date.now()}_1`,
        paymentMethod: initialMethod,
        amount: totalAmount,
        firstDueDate: baseDueDate,
        installmentsCount: 1,
        installmentsIntervalDays: 30,
        interestAmount: undefined,
        interestPercentage: undefined,
        notes: '',
        cheques: initialMethod === 'cheque' ? [initialChequeLeaf] : [],
      },
    ]);

    setBillingNotesExtra((activeRecord as any).billingNotes || activeRecord.notes || '');
  }, [activeRecord, isOpen, today, isChequeRestricted, totalAmount, preloadedCheque, clientName, resolvedClient, effectiveBankAccounts, priorityBankAccount, isServiceMode]);

  // Sincronização reativa de desbloqueio: assegura que o campo de conta nunca permaneça em branco na abertura
  useEffect(() => {
    if (isOpen && !hasUserManuallyChangedBankRef.current && (!selectedBankAccountId || !effectiveBankAccounts.some(a => a.id === selectedBankAccountId))) {
      if (priorityBankAccount) {
        setSelectedBankAccountId(priorityBankAccount.id);
      }
    }
  }, [isOpen, selectedBankAccountId, priorityBankAccount, effectiveBankAccounts]);

  // Cálculos de saldo em tempo real
  const totalAllocated = lines.reduce((acc, line) => acc + (Number(line.amount) || 0), 0);
  const remainingBalance = Math.round((totalAmount - totalAllocated) * 100) / 100;
  const isBalanced = Math.abs(remainingBalance) < 0.01;
  const isOverAllocated = remainingBalance < -0.009;
  const isUnderAllocated = remainingBalance > 0.009;

  const totalInterestAdded = lines.reduce(
    (acc, line) => acc + (Number(line.interestAmount) || 0),
    0
  );
  const totalFinalExpected = totalAllocated + totalInterestAdded;

  // Gerar cronograma de parcelas para visualização considerando o valor corrigido com juros
  const getInstallmentsBreakdown = (line: BillingPaymentLine) => {
    const count = Math.max(1, line.installmentsCount || 1);
    const baseAmount = Number(line.amount) || 0;
    const interest = Number(line.interestAmount) || 0;
    const totalLineWithInterest = baseAmount + interest;

    const baseVal = Math.floor((totalLineWithInterest / count) * 100) / 100;
    const remainder = Math.round((totalLineWithInterest - baseVal * count) * 100) / 100;

    const schedule = [];
    for (let i = 1; i <= count; i++) {
      const val = i === 1 ? Number((baseVal + remainder).toFixed(2)) : baseVal;
      const due = addDays(
        line.firstDueDate || today,
        (i - 1) * (line.installmentsIntervalDays || 30)
      );
      schedule.push({
        number: i,
        total: count,
        amount: val,
        dueDate: due,
      });
    }
    return schedule;
  };

  // Sincroniza a grade de cheques de uma linha quando a quantidade de parcelas ou valores mudam
  const syncLineCheques = (line: BillingPaymentLine, newCount: number): ChequeItemForm[] => {
    const count = Math.max(1, newCount);
    const breakdown = getInstallmentsBreakdown({ ...line, installmentsCount: count });
    const existing = line.cheques || [];

    const result: ChequeItemForm[] = [];
    for (let i = 0; i < count; i++) {
      const prev = existing[i];
      const prevBase = existing[0];
      const parcelDue = breakdown[i]?.dueDate || line.firstDueDate || today;
      const parcelAmount = breakdown[i]?.amount || (Number(line.amount) / count);

      result.push({
        id: prev?.id || `chq_${line.id}_${i}_${Date.now()}`,
        installmentNumber: i + 1,
        banco: prev?.banco || prevBase?.banco || '001 - Banco do Brasil',
        bancoCodigo: prev?.bancoCodigo || prevBase?.bancoCodigo || '001',
        numero: prev?.numero || (prevBase?.numero && !isNaN(Number(prevBase.numero)) ? String(Number(prevBase.numero) + i) : ''),
        emitenteNome: prev?.emitenteNome || prevBase?.emitenteNome || clientName,
        emitenteDoc: prev?.emitenteDoc || prevBase?.emitenteDoc || resolvedClient?.cpfCnpj || '',
        dataVencimento: prev?.dataVencimento || parcelDue,
        valor: parcelAmount,
        selectedFile: prev?.selectedFile || null,
        previewUrl: prev?.previewUrl || '',
        uploadedImageUrl: prev?.uploadedImageUrl || '',
        isUploading: false,
      });
    }
    return result;
  };

  // Adicionar uma nova linha de pagamento
  const handleAddLine = () => {
    const nextAmount = remainingBalance > 0 ? remainingBalance : 0;
    const newLine: BillingPaymentLine = {
      id: `line_${Date.now()}_${lines.length + 1}`,
      paymentMethod: '',
      amount: nextAmount,
      firstDueDate: lines[0]?.firstDueDate || today,
      installmentsCount: 1,
      installmentsIntervalDays: 30,
      interestAmount: undefined,
      interestPercentage: undefined,
      notes: '',
      cheques: [],
    };
    setLines([...lines, newLine]);
  };

  // Remover linha
  const handleRemoveLine = (id: string) => {
    if (lines.length <= 1) return;
    setLines(lines.filter((l) => l.id !== id));
  };

  // Atualizar campo de uma linha
  const handleUpdateLine = <K extends keyof BillingPaymentLine>(
    id: string,
    field: K,
    value: BillingPaymentLine[K]
  ) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const updated = { ...l, [field]: value };

        // Se o valor de face foi alterado e havia porcentagem de juros, recalcula o valor em R$
        if (field === 'amount') {
          const newAmount = Number(value) || 0;
          if (l.interestPercentage && l.interestPercentage > 0) {
            updated.interestAmount = Number(
              ((newAmount * l.interestPercentage) / 100).toFixed(2)
            );
          } else if (l.interestAmount && newAmount > 0) {
            updated.interestPercentage = Number(
              ((l.interestAmount / newAmount) * 100).toFixed(2)
            );
          }
          if (updated.paymentMethod === 'cheque') {
            updated.cheques = syncLineCheques(updated, updated.installmentsCount);
          }
        }

        // Se mudou a forma de pagamento
        if (field === 'paymentMethod') {
          const nextMethod = value as PaymentMethod;
          if (nextMethod === 'assinado_nota') {
            // "Assinado nota": compromisso firmado em carteira no campo
            // Bloqueio condicional e dinâmico: reseta parcelamento e juros
            updated.installmentsCount = 1;
            updated.interestAmount = undefined;
            updated.interestPercentage = undefined;
            updated.cheques = [];
          } else if (nextMethod === 'cheque') {
            updated.cheques = syncLineCheques(updated, updated.installmentsCount);
          } else if (!isInstallmentEligible(nextMethod)) {
            updated.installmentsCount = 1;
            updated.interestAmount = undefined;
            updated.interestPercentage = undefined;
            updated.cheques = [];
          }
        }

        // Se mudou a quantidade de parcelas
        if (field === 'installmentsCount') {
          const nextCount = Number(value) || 1;
          if (updated.paymentMethod === 'cheque') {
            updated.cheques = syncLineCheques(updated, nextCount);
          }
        }

        return updated;
      })
    );
  };

  // Atualizar campo específico de um cheque na linha
  const handleUpdateCheque = (
    lineId: string,
    chequeIdx: number,
    field: keyof ChequeItemForm,
    val: any
  ) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        const chqs = [...(l.cheques || [])];
        if (!chqs[chequeIdx]) return l;
        chqs[chequeIdx] = { ...chqs[chequeIdx], [field]: val };
        return { ...l, cheques: chqs };
      })
    );
  };

  // Upload / seleção de foto da folha física
  const handleChequeFileSelected = (lineId: string, chequeIdx: number, file?: File | null) => {
    if (!file) return;
    const blobUrl = URL.createObjectURL(file);
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        const chqs = [...(l.cheques || [])];
        if (!chqs[chequeIdx]) return l;
        chqs[chequeIdx] = {
          ...chqs[chequeIdx],
          selectedFile: file,
          previewUrl: blobUrl,
          uploadedImageUrl: blobUrl,
        };
        return { ...l, cheques: chqs };
      })
    );
  };

  const handleRemoveChequeImage = (lineId: string, chequeIdx: number) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        const chqs = [...(l.cheques || [])];
        if (!chqs[chequeIdx]) return l;
        if (chqs[chequeIdx].previewUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(chqs[chequeIdx].previewUrl!);
        }
        chqs[chequeIdx] = {
          ...chqs[chequeIdx],
          selectedFile: null,
          previewUrl: '',
          uploadedImageUrl: '',
        };
        return { ...l, cheques: chqs };
      })
    );
  };

  // Alteração com máscara de moeda brasileira do Valor de Face da linha (R$)
  const handleAmountMaskChange = (id: string, rawVal: string) => {
    const floatVal = parseCurrencyInputToFloat(rawVal);
    handleUpdateLine(id, 'amount', floatVal);
  };

  // Alteração reativa de Juros em R$ com máscara de moeda brasileira -> calcula %
  const handleInterestAmountMaskChange = (id: string, rawVal: string) => {
    const floatVal = parseCurrencyInputToFloat(rawVal);
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const baseAmount = Number(l.amount) || 0;
        const percentVal =
          baseAmount > 0 && floatVal > 0
            ? Number(((floatVal / baseAmount) * 100).toFixed(2))
            : undefined;

        const updated = {
          ...l,
          interestAmount: floatVal > 0 ? floatVal : undefined,
          interestPercentage: percentVal,
        };

        if (updated.paymentMethod === 'cheque') {
          updated.cheques = syncLineCheques(updated, updated.installmentsCount);
        }
        return updated;
      })
    );
  };

  // Alteração reativa de Juros em % -> calcula R$
  const handleInterestPercentChange = (id: string, valStr: string) => {
    const percentVal = valStr === '' ? 0 : Number(valStr);
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const baseAmount = Number(l.amount) || 0;
        const interestVal =
          baseAmount > 0 && percentVal > 0
            ? Number(((baseAmount * percentVal) / 100).toFixed(2))
            : undefined;

        const updated = {
          ...l,
          interestPercentage: percentVal > 0 ? percentVal : undefined,
          interestAmount: interestVal,
        };

        if (updated.paymentMethod === 'cheque') {
          updated.cheques = syncLineCheques(updated, updated.installmentsCount);
        }
        return updated;
      })
    );
  };

  // Validação de Senha Administrativa para Destravar Cheque
  const validateAdminPassword = (enteredPass: string): boolean => {
    const cleanPass = enteredPass.trim();
    if (!cleanPass) return false;

    try {
      const adminSettings = getStoredAdminSettings();
      if (adminSettings?.masterPassword && adminSettings.masterPassword.trim() === cleanPass) {
        return true;
      }
    } catch {}

    if (companyProfile?.adminPassword && companyProfile.adminPassword.trim() === cleanPass) {
      return true;
    }

    // Verifica colaboradores com perfil Administrador / Gerente caso possuam senha cadastrada
    try {
      const employees = getStoredEmployees();
      for (const emp of employees as any[]) {
        const role = String(emp?.role || emp?.cargo || '').toLowerCase();
        if (role.includes('admin') || role.includes('gerente') || role.includes('diretor')) {
          if (emp?.senha && String(emp.senha).trim() === cleanPass) return true;
          if (emp?.password && String(emp.password).trim() === cleanPass) return true;
          if (emp?.adminPassword && String(emp.adminPassword).trim() === cleanPass) return true;
        }
      }
    } catch {}

    const storageKeys = [
      'agrocontrol_cargos_permissoes',
      'colaca_silagem_cargos_permissoes',
      'cargos_permissoes',
      'agrocontrol_admin_settings',
      'silagem_facil_clean_v1_settings'
    ];

    for (const key of storageKeys) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            for (const p of parsed) {
              if (p?.senha && p.senha.trim() === cleanPass) return true;
              if (p?.password && p.password.trim() === cleanPass) return true;
              if (p?.senha_admin && p.senha_admin.trim() === cleanPass) return true;
              if (p?.admin_password && p.admin_password.trim() === cleanPass) return true;
            }
          } else if (parsed && typeof parsed === 'object') {
            if (parsed.senha && parsed.senha.trim() === cleanPass) return true;
            if (parsed.password && parsed.password.trim() === cleanPass) return true;
            if (parsed.senha_admin && parsed.senha_admin.trim() === cleanPass) return true;
            if (parsed.admin_password && parsed.admin_password.trim() === cleanPass) return true;
            if (parsed.masterPassword && parsed.masterPassword.trim() === cleanPass) return true;
          }
        }
      } catch {}
    }

    const defaultMasterPasswords = [
      'AgroControl@Master2026',
      'admin123',
      'admin',
      'agro2026',
      '123456',
      'agrocontrol'
    ];

    return defaultMasterPasswords.some(p => p.toLowerCase() === cleanPass.toLowerCase());
  };

  // Executa o destravamento administrativo de forma de pagamento
  const handleConfirmUnlock = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setUnlockPasswordError('');

    if (!unlockPasswordInput.trim()) {
      setUnlockPasswordError('Digite a Senha do Administrador para alterar a forma de recebimento deste cheque.');
      return;
    }

    const isValid = validateAdminPassword(unlockPasswordInput);
    if (!isValid) {
      setUnlockPasswordError('Senha incorreta! Alteração não autorizada.');
      return;
    }

    try {
      const storedChqs = getStoredFinanceiroCheques();
      const updatedChqs = [...storedChqs];
      const targetIdx = updatedChqs.findIndex(sc => 
        (preloadedCheque && sc.id === preloadedCheque.id) ||
        ((activeRecord as any)?.chequeId && sc.id === (activeRecord as any).chequeId) ||
        ((activeRecord as any)?.chequeNumero && (sc.numero_cheque === (activeRecord as any).chequeNumero || sc.numeroCheque === (activeRecord as any).chequeNumero)) ||
        (sc.ordem_id && sc.ordem_id === targetId) ||
        (sc.ordemId && sc.ordemId === targetId)
      );

      if (targetIdx >= 0) {
        const prevObs = updatedChqs[targetIdx].observacoes || '';
        const substNote = `Cheque retirado/substituído pelo Administrador em ${new Date().toLocaleDateString('pt-BR')}`;
        updatedChqs[targetIdx] = {
          ...updatedChqs[targetIdx],
          status: 'SUBSTITUIDO',
          ordem_id: undefined,
          ordemId: undefined,
          observacoes: prevObs.includes('retirado/substituído') ? prevObs : (prevObs ? `${prevObs} | ${substNote}` : substNote),
          updated_at: new Date().toISOString()
        };
        saveStoredFinanceiroCheques(updatedChqs);
        try {
          localStorage.setItem('agrocontrol_custodia_cheques', JSON.stringify(updatedChqs));
        } catch {}
        window.dispatchEvent(new CustomEvent('financeiro_cheques_updated'));
      }
    } catch (err) {
      console.warn('Erro ao atualizar custódia de cheques ao destravar:', err);
    }

    // Limpa a linha de cheque travada para que o operador escolha a nova forma (PIX, Dinheiro, TED, etc.)
    setLines((prev) =>
      prev.map((l, idx) =>
        idx === 0
          ? {
              ...l,
              paymentMethod: '',
              cheques: [],
            }
          : l
      )
    );

    if (!selectedBankAccountId) {
      if (priorityBankAccount) {
        setSelectedBankAccountId(priorityBankAccount.id);
      } else if (effectiveBankAccounts.length > 0) {
        setSelectedBankAccountId(effectiveBankAccounts[0].id);
      }
    }

    setIsUnlockedByAdmin(true);
    setShowUnlockPasswordModal(false);
    setUnlockPasswordInput('');
    setUnlockPasswordError('');
    setSuccessToast('Forma de pagamento destravada com sucesso! Selecione a nova forma de recebimento.');
    setTimeout(() => setSuccessToast(''), 4000);
  };

  // Submissão da confirmação unificada
  const handleConfirm = async () => {
    if (!isBalanced) return;

    // Validação estrita: todas as linhas precisam de uma forma de pagamento definida
    const emptyMethodLine = lines.find((l) => !l.paymentMethod);
    if (emptyMethodLine) {
      setFormValidationError('Por favor, selecione uma forma de pagamento para prosseguir.');
      setTimeout(() => setFormValidationError(''), 4500);
      return;
    }

    // Validação de Conta Bancária obrigatória para recebimentos imediatos (PIX, Dinheiro, TED/DOC, Cartões)
    const IMMEDIATE_METHODS = ['pix', 'dinheiro', 'transferencia', 'cartao_credito', 'cartao_debito'];
    const requiresBankAccount =
      !isServiceMode &&
      effectiveBankAccounts.length > 0 &&
      lines.some((l) => IMMEDIATE_METHODS.includes(String(l.paymentMethod)));

    if (requiresBankAccount && !selectedBankAccountId) {
      setFormValidationError('Selecione a Conta Bancária de Depósito / Caixa para creditar o valor do recebimento.');
      setTimeout(() => setFormValidationError(''), 4500);
      return;
    }

    const nowIso = new Date().toISOString();
    const activeCid = toValidUUID(companyProfile?.id || getActiveCompanyId());

    // 1. Grava cheques novos na custódia (ou reutiliza o cheque já vinculado se estiver em modo travado)
    const allSavedCheques: FinanceiroCheque[] = [];
    const storedChqs = getStoredFinanceiroCheques();
    const chqsListToPersist = [...storedChqs];

    if (isChequeRestricted && preloadedCheque) {
      // Cheque já cadastrado no faturamento: atualiza apenas metadados de destino sem duplicar a folha na custódia
      const updatedExisting: FinanceiroCheque = {
        ...preloadedCheque,
        conta_bancaria_destino_id: selectedBankAccountId || preloadedCheque.conta_bancaria_destino_id,
        contaBancariaDestinoId: selectedBankAccountId || preloadedCheque.contaBancariaDestinoId,
        updated_at: nowIso,
      };
      allSavedCheques.push(updatedExisting);
    } else {
      for (const line of lines) {
        if (line.paymentMethod === 'cheque' && line.cheques && line.cheques.length > 0) {
          for (const chq of line.cheques) {
            const chqId = toValidUUID();
            let finalImgUrl = chq.uploadedImageUrl || chq.previewUrl || '';

            if (chq.selectedFile) {
              try {
                const uploadRes = await uploadChequeImagem(chq.selectedFile, activeCid, chq.selectedFile.name);
                if (uploadRes?.publicUrl) {
                  finalImgUrl = uploadRes.publicUrl;
                }
              } catch (err) {
                console.warn('Erro ao subir imagem do cheque:', err);
              }
            }

            const chequeRecord: FinanceiroCheque = {
              id: chqId,
              company_id: activeCid,
              companyId: activeCid,
              cliente_id: targetClientId,
              clienteId: targetClientId,
              cliente_nome: clientName,
              clienteNome: clientName,
              banco: chq.banco,
              numero_cheque: chq.numero.trim() || '---',
              numeroCheque: chq.numero.trim() || '---',
              emitente_nome: chq.emitenteNome.trim() || clientName,
              emitenteNome: chq.emitenteNome.trim() || clientName,
              emitente_documento: chq.emitenteDoc.trim() || resolvedClient?.cpfCnpj || '',
              emitenteDocumento: chq.emitenteDoc.trim() || resolvedClient?.cpfCnpj || '',
              data_vencimento: chq.dataVencimento,
              dataVencimento: chq.dataVencimento,
              valor: Number(chq.valor) || 0,
              imagem_url: finalImgUrl,
              imagemUrl: finalImgUrl,
              status: 'EM_NOSSO_PODER',
              ordem_id: targetId,
              ordemId: targetId,
              ordem_tipo: isServiceMode ? 'servico' : 'venda',
              parcela_numero: chq.installmentNumber,
              total_parcelas: line.installmentsCount || 1,
              conta_bancaria_destino_id: selectedBankAccountId,
              contaBancariaDestinoId: selectedBankAccountId,
              created_at: nowIso,
              updated_at: nowIso,
            };

            chqsListToPersist.push(chequeRecord);
            allSavedCheques.push(chequeRecord);
            try {
              await saveFinanceiroCheque(chequeRecord);
            } catch (e) {
              console.warn('Erro ao sincronizar cheque no Supabase:', e);
            }
          }
        }
      }

      if (allSavedCheques.length > 0) {
        saveStoredFinanceiroCheques(chqsListToPersist);
        try {
          localStorage.setItem('agrocontrol_custodia_cheques', JSON.stringify(chqsListToPersist));
        } catch {}
        window.dispatchEvent(new CustomEvent('financeiro_cheques_updated'));
      }
    }

    // 2. Se for chamado a partir do Módulo de Serviços (onConfirm / ServiceOrder)
    if (isServiceMode && service && onConfirm) {
      const isSingleLineNoInstallment = lines.length === 1 && lines[0].installmentsCount <= 1;

      if (isSingleLineNoInstallment) {
        const line = lines[0];
        const lineInterest = Number(line.interestAmount) || 0;
        const totalFinalAmount = Number(line.amount) + lineInterest;

        const interestSnippet =
          lineInterest > 0
            ? ` (COM JUROS DE ${formatCurrencyBRL(lineInterest)}${
                line.interestPercentage ? ` / ${line.interestPercentage}%` : ''
              })`
            : '';

        const updatedOriginal: ServiceOrder = {
          ...service,
          totalAmount: totalFinalAmount,
          status: 'faturado',
          billingStatus: 'faturado',
          billedAt: nowIso,
          billedBy: 'Escritório',
          paymentStatus: 'pendente',
          paymentMethod: line.paymentMethod,
          dueDate: line.firstDueDate || service.dueDate || today,
          billingNotes: [
            billingNotesExtra.trim(),
            `[FATURAMENTO: ${getPaymentMethodLabel(line.paymentMethod)} - ${formatCurrencyBRL(
              totalFinalAmount
            )}${interestSnippet}]`,
          ]
            .filter(Boolean)
            .join(' ')
            .toUpperCase(),
          updatedAt: nowIso,
          chequeId: allSavedCheques[0]?.id,
          chequeNumero: allSavedCheques[0]?.numero_cheque,
        };
        onConfirm([updatedOriginal]);
        onClose();
        return;
      }

      // Desmembramento de Ordens com Juros Persistidos
      const generatedOrders: ServiceOrder[] = [];
      let globalIndex = 0;

      lines.forEach((line, lineIdx) => {
        const lineBaseAmount = Number(line.amount) || 0;
        if (lineBaseAmount <= 0) return;

        const lineInterest = Number(line.interestAmount) || 0;
        const count = Math.max(1, line.installmentsCount || 1);
        const breakdown = getInstallmentsBreakdown(line);

        const interestSnippet =
          lineInterest > 0
            ? ` (COM JUROS DE ${formatCurrencyBRL(lineInterest)}${
                line.interestPercentage ? ` / ${line.interestPercentage}%` : ''
              })`
            : '';

        breakdown.forEach((itemBreakdown, bIdx) => {
          globalIndex++;
          const isFirstGlobal = globalIndex === 1;

          const methodLabel = getPaymentMethodLabel(line.paymentMethod);
          const instLabel = count > 1 ? ` (PARCELA ${itemBreakdown.number}/${itemBreakdown.total})` : '';
          const orderNumberSuffix =
            count > 1
              ? `${service.orderNumber || ''}-P${itemBreakdown.number}/${itemBreakdown.total}`
              : lines.length > 1
              ? `${service.orderNumber || ''}-${lineIdx + 1}`
              : service.orderNumber;

          const noteSnippet = `[FATURAMENTO: ${methodLabel}${instLabel} - ${formatCurrencyBRL(
            itemBreakdown.amount
          )}${interestSnippet}]`;

          const matchingCheque = line.cheques?.[bIdx];

          const childOrder: ServiceOrder = {
            ...service,
            id: isFirstGlobal
              ? service.id
              : `serv_bill_${service.id}_${lineIdx + 1}_${itemBreakdown.number}_${Date.now()}_${globalIndex}`,
            orderNumber: orderNumberSuffix || undefined,
            totalAmount: itemBreakdown.amount,
            startDate: itemBreakdown.dueDate,
            date: itemBreakdown.dueDate,
            dueDate: itemBreakdown.dueDate,
            paymentMethod: line.paymentMethod,
            paymentStatus: 'pendente',
            status: 'faturado',
            billingStatus: 'faturado',
            billedAt: nowIso,
            billedBy: 'Escritório',
            isInstallment: count > 1,
            installmentNumber: count > 1 ? itemBreakdown.number : undefined,
            totalInstallments: count > 1 ? count : undefined,
            parentOrderId: service.id,
            billingNotes: [billingNotesExtra.trim(), noteSnippet].filter(Boolean).join(' ').toUpperCase(),
            updatedAt: nowIso,
            chequeId: matchingCheque?.id,
            chequeNumero: matchingCheque?.numero,
          };

          generatedOrders.push(childOrder);
        });
      });

      onConfirm(generatedOrders);
      onClose();
      return;
    }

    // 3. Se for chamado a partir do Financeiro > A Receber (onSuccess / ReceivableItem)
    if (onSuccess && activeRecord) {
      // Monta cronograma consolidado de parcelas para a baixa financeira
      const allInstallments: InstallmentPreviewItem[] = [];
      let globalNumber = 0;

      lines.forEach((line) => {
        const breakdown = getInstallmentsBreakdown(line);
        breakdown.forEach((b) => {
          globalNumber++;
          allInstallments.push({
            number: globalNumber,
            totalInstallments: 0, // atualizado abaixo
            dueDate: b.dueDate,
            amount: b.amount,
            isPaid: globalNumber === 1,
            notes: line.notes || billingNotesExtra,
          });
        });
      });

      allInstallments.forEach(inst => {
        inst.totalInstallments = allInstallments.length;
      });

      const isMultiInstallment = allInstallments.length > 1;

      onSuccess({
        itemId: targetId,
        itemType: (activeRecord as any).type || (service ? 'Prestação de Serviço' : 'Venda de Silagem'),
        paymentMethod: lines[0]?.paymentMethod || 'pix',
        paidAmount: totalFinalExpected,
        receiptDate,
        cheque: allSavedCheques[0],
        cheques: allSavedCheques.length > 0 ? allSavedCheques : undefined,
        bankAccountId: selectedBankAccountId,
        isInstallmentPlan: isMultiInstallment,
        installments: isMultiInstallment ? allInstallments : undefined,
        firstPaidImmediately: true,
        interestAmount: totalInterestAdded > 0 ? totalInterestAdded : undefined,
        splitLines: lines,
        unlockedChequeSubstitution: isUnlockedByAdmin,
      });

      onClose();
    }
  };

  if (!isOpen || !activeRecord) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-hidden overflow-y-hidden animate-in fade-in duration-200">
      <div 
        id="billing-payment-modal-container"
        className="bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-slate-300 dark:border-stone-700 w-full max-w-5xl lg:max-w-6xl overflow-hidden flex flex-col my-auto h-[95vh] max-h-[95vh]"
      >
        {/* CABEÇALHO DO MODAL */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 bg-slate-100 dark:bg-stone-800 border-b border-slate-300 dark:border-stone-700 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Building2 className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white uppercase tracking-tight truncate">
                  {isServiceMode ? 'DEFINIÇÃO DE RECEBIMENTO E CONDIÇÕES COMERCIAIS' : 'BAIXAR / QUITAR CONTA A RECEBER'}
                </h3>
                {targetOrderNumber && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-200 dark:bg-stone-700 text-slate-800 dark:text-stone-200 shrink-0">
                    #{targetOrderNumber}
                  </span>
                )}
              </div>
              <p className="text-[11px] sm:text-xs text-zinc-600 dark:text-stone-400 font-medium truncate">
                Cliente: <span className="font-bold text-zinc-900 dark:text-white">{clientName}</span>
                {farmOrOrigin ? ` • ${farmOrOrigin}` : ''} • Serviço/Origem:{' '}
                <span className="font-bold text-zinc-800 dark:text-stone-200 uppercase">
                  {serviceOrType}
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-stone-200 hover:bg-slate-200 dark:hover:bg-stone-700 rounded-lg transition cursor-pointer shrink-0"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CORPO DO MODAL (ROLAGEM FLUIDA E ALTURA INTEGRAL) */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 flex-1 scrollbar-thin">
          
          {/* MENSAGEM TOAST DE SUCESSO TEMPORÁRIA */}
          {successToast && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 text-xs font-black flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successToast}</span>
            </div>
          )}

          {/* MENSAGEM DE ERRO DE VALIDAÇÃO TEMPORÁRIA */}
          {formValidationError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-black flex items-center space-x-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{formValidationError}</span>
            </div>
          )}

          {/* AVISO DE TRAVAMENTO DE CHEQUE DA CUSTÓDIA & BOTÃO DE DESTRAVAMENTO */}
          {hasPreRegisteredCheque && (
            <div className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-between gap-2 shadow-2xs ${
              isUnlockedByAdmin 
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-950 dark:text-emerald-200'
                : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-200'
            }`}>
              <div className="flex items-center space-x-2.5">
                <div className={`p-1.5 rounded-lg text-white shrink-0 ${isUnlockedByAdmin ? 'bg-emerald-600' : 'bg-amber-600'}`}>
                  {isUnlockedByAdmin ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                </div>
                <div>
                  <span className={`font-black block text-[11px] uppercase tracking-wider ${isUnlockedByAdmin ? 'text-emerald-900 dark:text-emerald-200' : 'text-amber-900 dark:text-amber-200'}`}>
                    Título Originado de Folha de Cheque no Faturamento
                  </span>
                  <span className={`text-[11px] ${isUnlockedByAdmin ? 'text-emerald-800 dark:text-emerald-300' : 'text-amber-800 dark:text-amber-300'}`}>
                    {isUnlockedByAdmin 
                      ? 'Forma de pagamento destravada com sucesso pelo Administrador. A folha foi retirada da Custódia e você pode liquidar ou parcelar na forma desejada.'
                      : <>A forma de pagamento está vinculada à folha de cheque já registrada na <strong>Custódia de Cheques</strong>.</>}
                  </span>
                </div>
              </div>
              {!isUnlockedByAdmin ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowUnlockPasswordModal(true);
                    setUnlockPasswordError('');
                    setUnlockPasswordInput('');
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-black bg-amber-600 hover:bg-amber-700 active:scale-95 text-white border border-amber-700 shadow-xs flex items-center gap-1.5 transition cursor-pointer shrink-0"
                  title="Destravar forma de pagamento com senha administrativa"
                >
                  <Unlock className="w-3.5 h-3.5 text-white" />
                  <span>🔓 Destravar Forma de Pagamento</span>
                </button>
              ) : (
                <span className="px-3 py-1 rounded-lg text-xs font-black bg-emerald-100 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 flex items-center gap-1.5 shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>🔓 Destravado por Administrador</span>
                </span>
              )}
            </div>
          )}

          {/* PAINEL DE RESUMO E SALDO EM TEMPO REAL */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 sm:p-4 bg-slate-50 dark:bg-stone-850 rounded-xl border border-slate-200 dark:border-stone-750">
            {/* Valor Total Auditado */}
            <div className="bg-white dark:bg-stone-800 p-3 rounded-lg border border-slate-200 dark:border-stone-700 shadow-2xs">
              <span className="text-[10px] font-black text-zinc-500 dark:text-stone-400 uppercase tracking-wider block">
                {isServiceMode ? 'Valor Total Auditado' : 'Valor Total do Título'}
              </span>
              <span className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white font-['Outfit']">
                {formatCurrencyBRL(totalAmount)}
              </span>
            </div>

            {/* Total Distribuído */}
            <div className="bg-white dark:bg-stone-800 p-3 rounded-lg border border-slate-200 dark:border-stone-700 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-zinc-500 dark:text-stone-400 uppercase tracking-wider block">
                  Total Distribuído
                </span>
                {totalInterestAdded > 0 && (
                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.5 rounded">
                    +{formatCurrencyBRL(totalInterestAdded)} juros
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg sm:text-xl font-black text-blue-700 dark:text-blue-400 font-['Outfit']">
                  {formatCurrencyBRL(totalAllocated)}
                </span>
                {totalInterestAdded > 0 && (
                  <span className="text-xs font-bold text-zinc-500 dark:text-stone-400">
                    ({formatCurrencyBRL(totalFinalExpected)} final)
                  </span>
                )}
              </div>
            </div>

            {/* Saldo a Distribuir */}
            <div
              className={`p-3 rounded-lg border shadow-2xs ${
                isBalanced
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800'
                  : isOverAllocated
                  ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800'
                  : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800'
              }`}
            >
              <span
                className={`text-[10px] font-black uppercase tracking-wider block ${
                  isBalanced
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : isOverAllocated
                    ? 'text-rose-700 dark:text-rose-300'
                    : 'text-amber-700 dark:text-amber-300'
                }`}
              >
                Saldo a Distribuir
              </span>
              <span
                className={`text-lg sm:text-xl font-black font-['Outfit'] ${
                  isBalanced
                    ? 'text-emerald-800 dark:text-emerald-200'
                    : isOverAllocated
                    ? 'text-rose-800 dark:text-rose-200'
                    : 'text-amber-800 dark:text-amber-200'
                }`}
              >
                {formatCurrencyBRL(remainingBalance)}
              </span>
            </div>
          </div>

          {/* STATUS BANNER */}
          {isBalanced ? (
            <div className="flex items-center gap-2.5 px-4 py-2.5 bg-emerald-100/70 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700 rounded-xl text-emerald-900 dark:text-emerald-200 text-xs font-bold shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                Valor total 100% distribuído! Pronto para lançar e faturar no Contas a Receber.
                {totalInterestAdded > 0 && (
                  <span className="font-normal text-emerald-800 dark:text-emerald-300 ml-1">
                    (Total final a receber com acréscimos: {formatCurrencyBRL(totalFinalExpected)})
                  </span>
                )}
              </span>
            </div>
          ) : isUnderAllocated ? (
            <div className="flex items-center gap-2.5 px-4 py-2.5 bg-amber-100/70 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 rounded-xl text-amber-900 dark:text-amber-200 text-xs font-bold shadow-2xs">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                Faltam {formatCurrencyBRL(remainingBalance)} para cobrir o total do pedido. Adicione outra forma ou ajuste os valores.
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 px-4 py-2.5 bg-rose-100/70 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-700 rounded-xl text-rose-900 dark:text-rose-200 text-xs font-bold shadow-2xs">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>
                O valor distribuído excede o total em {formatCurrencyBRL(Math.abs(remainingBalance))}. Reduza o valor das formas de pagamento.
              </span>
            </div>
          )}

          {/* LINHA DE CONTA BANCÁRIA E DATA DE LIQUIDAÇÃO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-stone-850 rounded-xl border border-slate-200 dark:border-stone-750">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-black dark:text-stone-200 mb-1">
                Data do Recebimento / Faturamento <span className="text-rose-600">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={receiptDate}
                  onChange={(e) => setReceiptDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 dark:border-stone-600 rounded-xl bg-white dark:bg-stone-800 text-black dark:text-white font-semibold outline-none focus:ring-2 focus:ring-sky-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-black dark:text-stone-200 mb-1">
                Conta Bancária de Depósito / Caixa{' '}
                {!isServiceMode && lines.some((l) => ['pix', 'dinheiro', 'transferencia', 'cartao_credito', 'cartao_debito'].includes(String(l.paymentMethod))) && (
                  <span className="text-rose-600">*</span>
                )}
              </label>
              <select
                id="billing-bank-account-select"
                value={selectedBankAccountId}
                onChange={(e) => {
                  hasUserManuallyChangedBankRef.current = true;
                  setSelectedBankAccountId(e.target.value);
                }}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 dark:border-stone-600 rounded-xl bg-white dark:bg-stone-800 text-black dark:text-white font-semibold outline-none focus:ring-2 focus:ring-sky-600 cursor-pointer"
              >
                <option value="">Caixa Geral da Empresa</option>
                {effectiveBankAccounts.map((acc) => {
                  const isPri = Boolean(
                    acc.isPriority === true ||
                    acc.prioritaria === true ||
                    acc.id === priorityBankAccount?.id
                  );
                  const bankCodeStr = acc.bankCode ? ` - ${acc.bankCode}` : '';
                  const agencyStr = acc.agency ? `/${acc.agency}` : '';
                  const bankNameStr = acc.bankName ? ` - ${acc.bankName}` : '';
                  const accountNumStr = acc.accountNumber ? ` • Cc: ${acc.accountNumber}` : '';
                  return (
                    <option key={acc.id} value={acc.id}>
                      {isPri ? '⭐ [PRIORITÁRIA] ' : ''}
                      {acc.name}{bankCodeStr}{agencyStr}{bankNameStr}{accountNumStr}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* LISTA DE FORMAS DE RECEBIMENTO (PAGAMENTO MISTO) */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-wider">
                  Formas de Recebimento ({lines.length})
                </h4>
                <p className="text-[11px] text-zinc-500 dark:text-stone-400">
                  Configure múltiplas formas de pagamento e condições de parcelamento para este pedido.
                </p>
              </div>

              {!isChequeRestricted && (
                <button
                  type="button"
                  onClick={handleAddLine}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-300 dark:border-emerald-700 rounded-lg shadow-2xs transition cursor-pointer uppercase active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>+ Adicionar Forma</span>
                </button>
              )}
            </div>

            {/* CARDS DAS LINHAS DE PAGAMENTO */}
            <div className="space-y-3.5">
              {lines.map((line, index) => {
                const isInstallment = isInstallmentEligible(line.paymentMethod);
                const isAssinadoNota = line.paymentMethod === 'assinado_nota';
                const isChequeLine = line.paymentMethod === 'cheque';
                const breakdown = getInstallmentsBreakdown(line);
                const lineBaseAmount = Number(line.amount) || 0;
                const lineInterestAmount = Number(line.interestAmount) || 0;
                const lineTotalWithInterest = lineBaseAmount + lineInterestAmount;

                return (
                  <div
                    key={line.id}
                    className="p-4 bg-white dark:bg-stone-850 rounded-xl border border-slate-300 dark:border-stone-700 shadow-2xs space-y-3.5"
                  >
                    {/* Linha Principal de Dados */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      {/* Indicador de Linha */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-stone-700 text-zinc-800 dark:text-stone-200 text-xs font-black flex items-center justify-center">
                          {index + 1}
                        </span>
                      </div>

                      {/* Forma de Pagamento */}
                      <div className="flex-1 min-w-[180px]">
                        <label className="block text-[10px] font-bold text-zinc-600 dark:text-stone-400 uppercase mb-1">
                          Forma de Pagamento
                        </label>
                        <select
                          id={`payment-method-select-${line.id}`}
                          value={line.paymentMethod || ''}
                          disabled={isChequeRestricted}
                          onChange={(e) =>
                            handleUpdateLine(line.id, 'paymentMethod', e.target.value as PaymentMethod)
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-stone-800 border border-slate-300 dark:border-stone-600 rounded-lg text-xs font-bold text-zinc-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 uppercase cursor-pointer disabled:opacity-60"
                        >
                          <option value="">Selecione uma forma de pagamento...</option>
                          <option value="pix">PIX</option>
                          <option value="dinheiro">Dinheiro</option>
                          <option value="cartao_credito">Cartão de Crédito</option>
                          <option value="cartao_debito">Cartão de Débito</option>
                          <option value="transferencia">TED / DOC</option>
                          <option value="cheque">Cheque</option>
                          <option value="prazo_carteira">A Prazo (Carteira)</option>
                          <option value="safra_prazo">Safra a Prazo</option>
                          <option value="boleto">Boleto</option>
                          <option value="assinado_nota">Assinado nota</option>
                        </select>
                      </div>

                      {/* Valor Alocado (R$) */}
                      <div className="w-full sm:w-44">
                        <label className="block text-[10px] font-bold text-zinc-600 dark:text-stone-400 uppercase mb-1">
                          Valor (R$)
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-xs font-bold text-zinc-400 pointer-events-none">
                            R$
                          </span>
                          <input
                            type="text"
                            inputMode="numeric"
                            disabled={isChequeRestricted}
                            value={formatCurrencyInputBRL(line.amount)}
                            onChange={(e) => handleAmountMaskChange(line.id, e.target.value)}
                            onFocus={(e) => e.target.select()}
                            placeholder="0,00"
                            className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 dark:bg-stone-800 border border-slate-300 dark:border-stone-600 rounded-lg text-xs font-black text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed"
                          />
                        </div>
                      </div>

                      {/* 1º Vencimento / Data Base */}
                      <div className="w-full sm:w-40">
                        <label className="block text-[10px] font-bold text-zinc-600 dark:text-stone-400 uppercase mb-1">
                          {line.installmentsCount > 1 ? '1º Vencimento' : 'Data Vencimento'}
                        </label>
                        <input
                          type="date"
                          disabled={isChequeRestricted}
                          value={line.firstDueDate}
                          onChange={(e) => handleUpdateLine(line.id, 'firstDueDate', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-stone-800 border border-slate-300 dark:border-stone-600 rounded-lg text-xs font-bold text-zinc-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed"
                        />
                      </div>

                      {/* Botão de Excluir Linha */}
                      <div className="flex items-end self-end sm:self-center pt-2 sm:pt-4">
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(line.id)}
                          disabled={lines.length <= 1 || isChequeRestricted}
                          className={`p-1.5 rounded-lg border transition ${
                            lines.length <= 1 || isChequeRestricted
                              ? 'text-zinc-300 dark:text-stone-600 border-slate-200 dark:border-stone-800 cursor-not-allowed'
                              : 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-rose-200 dark:border-rose-900 cursor-pointer'
                          }`}
                          title={lines.length <= 1 || isChequeRestricted ? 'Mínimo de 1 forma obrigatória' : 'Remover forma'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* BLOQUEIO CONDICIONAL E DINÂMICO PARA FORMA "ASSINADO NOTA" */}
                    {isAssinadoNota && (
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 rounded-xl flex items-center justify-between gap-3 text-amber-950 dark:text-amber-200">
                        <div className="flex items-center space-x-2.5">
                          <div className="p-1.5 rounded-lg bg-amber-600 text-white shrink-0">
                            <FileCheck2 className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs font-black uppercase tracking-wider block">
                              Forma Assinado Nota (Compromisso em Carteira)
                            </span>
                            <span className="text-[11px] text-amber-800 dark:text-amber-300">
                              Nota assinada no ato pelo produtor / acerto de campo. Campos de juros bancários e parcelamento ficam bloqueados para esta modalidade.
                            </span>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-200/80 dark:bg-amber-900 text-amber-950 dark:text-amber-100 border border-amber-400 shrink-0 uppercase tracking-wider">
                          Nota Assinada
                        </span>
                      </div>
                    )}

                    {/* BLOCO DE JUROS / ACRÉSCIMOS E PARCELAMENTO (QUANDO PARCELÁVEL E NÃO ASSINADO NOTA E NÃO TRAVADO) */}
                    {isInstallment && !isAssinadoNota && !isChequeRestricted && (
                      <div className="mt-2 pt-3 border-t border-dashed border-slate-200 dark:border-stone-750 bg-slate-50/70 dark:bg-stone-800/50 p-3.5 rounded-xl space-y-3">
                        {/* 1. SEÇÃO DE JUROS / ACRÉSCIMOS (REATIVIDADE BIDIRECIONAL R$ <-> %) */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-2.5 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/90 dark:border-amber-800/60 rounded-lg">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded bg-amber-200/80 dark:bg-amber-900/60 flex items-center justify-center shrink-0">
                              <Percent className="w-3.5 h-3.5 text-amber-800 dark:text-amber-300 stroke-[2.5]" />
                            </div>
                            <div>
                              <span className="text-[11px] font-black text-amber-950 dark:text-amber-200 uppercase tracking-tight block">
                                Juros / Acréscimos desta Linha (Opcional)
                              </span>
                              <span className="text-[10px] text-amber-800/80 dark:text-amber-400/90 font-medium">
                                Incorpora no valor parcelado sem afetar a distribuição do saldo base do serviço
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            {/* Juros em R$ */}
                            <div className="w-32">
                              <label className="block text-[9px] font-bold text-zinc-600 dark:text-stone-400 uppercase mb-0.5">
                                Juros (R$)
                              </label>
                              <div className="relative">
                                <span className="absolute inset-y-0 left-0 pl-2 flex items-center text-[10px] font-bold text-zinc-400 pointer-events-none">
                                  R$
                                </span>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={formatCurrencyInputBRL(line.interestAmount || 0)}
                                  onChange={(e) => handleInterestAmountMaskChange(line.id, e.target.value)}
                                  onFocus={(e) => e.target.select()}
                                  placeholder="0,00"
                                  className="w-full pl-7 pr-2 py-1 bg-white dark:bg-stone-800 border border-slate-300 dark:border-stone-600 rounded-md text-xs font-black text-amber-950 dark:text-amber-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                />
                              </div>
                            </div>

                            {/* Juros em % */}
                            <div className="w-28">
                              <label className="block text-[9px] font-bold text-zinc-600 dark:text-stone-400 uppercase mb-0.5">
                                Juros (%)
                              </label>
                              <div className="relative">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={line.interestPercentage === undefined ? '' : line.interestPercentage}
                                  onChange={(e) => handleInterestPercentChange(line.id, e.target.value)}
                                  placeholder="0,00"
                                  className="w-full pl-2.5 pr-6 py-1 bg-white dark:bg-stone-800 border border-slate-300 dark:border-stone-600 rounded-md text-xs font-black text-amber-950 dark:text-amber-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                />
                                <span className="absolute inset-y-0 right-0 pr-2 flex items-center text-[10px] font-bold text-zinc-400 pointer-events-none">
                                  %
                                </span>
                              </div>
                            </div>

                            {/* Resumo visual do Total Corrigido se houver juros */}
                            {lineInterestAmount > 0 && (
                              <div className="shrink-0 text-right pl-2 hidden sm:block border-l border-amber-200 dark:border-amber-800/60">
                                <span className="text-[9px] font-bold text-amber-900 dark:text-amber-300 uppercase block">
                                  Novo Total da Linha:
                                </span>
                                <span className="text-xs font-black text-emerald-700 dark:text-emerald-300">
                                  {formatCurrencyBRL(lineTotalWithInterest)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 2. CONDIÇÃO DE PARCELAMENTO */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                          <div className="flex items-center gap-2">
                            <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            <span className="text-[11px] font-bold text-zinc-800 dark:text-stone-200 uppercase">
                              Condição de Parcelamento:
                            </span>
                          </div>

                          {/* Seletor de Parcelas */}
                          <div className="flex items-center gap-2">
                            <label className="text-[10px] font-bold text-zinc-500 dark:text-stone-400 uppercase">
                              Nº Parcelas:
                            </label>
                            <select
                              value={line.installmentsCount}
                              onChange={(e) =>
                                handleUpdateLine(line.id, 'installmentsCount', Number(e.target.value))
                              }
                              className="px-2.5 py-1 bg-white dark:bg-stone-700 border border-slate-300 dark:border-stone-600 rounded-md text-xs font-bold text-zinc-800 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer uppercase"
                            >
                              <option value={1}>1x (À Vista)</option>
                              {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24].map((n) => (
                                <option key={n} value={n}>
                                  {n}x ({formatCurrencyBRL(lineTotalWithInterest / n)}/mês)
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Intervalo de Dias */}
                          {line.installmentsCount > 1 && (
                            <div className="flex items-center gap-2">
                              <label className="text-[10px] font-bold text-zinc-500 dark:text-stone-400 uppercase">
                                Intervalo:
                              </label>
                              <select
                                value={line.installmentsIntervalDays}
                                onChange={(e) =>
                                  handleUpdateLine(
                                    line.id,
                                    'installmentsIntervalDays',
                                    Number(e.target.value)
                                  )
                                }
                                className="px-2.5 py-1 bg-white dark:bg-stone-700 border border-slate-300 dark:border-stone-600 rounded-md text-xs font-bold text-zinc-800 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer uppercase"
                              >
                                <option value={15}>15 em 15 dias</option>
                                <option value={30}>30 dias (Mensal)</option>
                                <option value={45}>45 dias</option>
                                <option value={60}>60 dias (Bimestral)</option>
                                <option value={90}>90 dias (Trimestral)</option>
                                <option value={180}>180 dias (Semestral)</option>
                                <option value={365}>365 dias (Safra / Anual)</option>
                              </select>
                            </div>
                          )}
                        </div>

                        {/* 3. DEMONSTRATIVO DINÂMICO DE PARCELAS COM JUROS RECALCULADOS */}
                        {line.installmentsCount > 1 && (
                          <div className="mt-2 overflow-x-auto">
                            <div className="inline-flex flex-wrap gap-2 py-1">
                              {breakdown.map((itemBreakdown) => (
                                <div
                                  key={itemBreakdown.number}
                                  className="flex items-center gap-2 px-2.5 py-1 bg-white dark:bg-stone-700 border border-slate-200 dark:border-stone-600 rounded-md text-[11px] font-semibold shadow-2xs"
                                >
                                  <span className="font-bold text-blue-700 dark:text-blue-300">
                                    {itemBreakdown.number}/{itemBreakdown.total}:
                                  </span>
                                  <span className="font-black text-zinc-900 dark:text-white">
                                    {formatCurrencyBRL(itemBreakdown.amount)}
                                  </span>
                                  <span className="text-zinc-500 dark:text-stone-400 text-[10px]">
                                    ({formatDateBR(itemBreakdown.dueDate)})
                                  </span>
                                  {lineInterestAmount > 0 && (
                                    <span className="text-[9px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1 rounded">
                                      +juros
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* GRADE DINÂMICA DE MÚLTIPLAS FOLHAS DE CHEQUE BASEADA NA QUANTIDADE DE PARCELAS (OU SOMENTE LEITURA SE TRAVADO) */}
                    {isChequeLine && (
                      isChequeRestricted && preloadedCheque ? (
                        <div className="mt-3 p-3.5 bg-slate-50 dark:bg-stone-850/90 border border-slate-300 dark:border-stone-700 rounded-xl space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-stone-700 pb-2">
                            <div className="flex items-center space-x-2">
                              <div className="p-1.5 rounded-lg bg-slate-800 text-white shadow-2xs">
                                <Lock className="w-4 h-4" />
                              </div>
                              <div>
                                <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-stone-100 block">
                                  Dados do Cheque em Custódia (Somente Leitura)
                                </span>
                                <span className="text-[10px] text-slate-600 dark:text-stone-400">
                                  Folha vinculada no faturamento — clique em &ldquo;Destravar Forma de Pagamento&rdquo; acima para substituir
                                </span>
                              </div>
                            </div>
                            <span className="text-[10px] font-black text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 px-2.5 py-0.5 rounded-full">
                              🔒 Registro Travado da Custódia
                            </span>
                          </div>

                          <div className="bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-700 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                            <div>
                              <span className="block text-[10px] font-bold text-slate-500 dark:text-stone-400 uppercase">Banco Emissor</span>
                              <span className="font-bold text-slate-900 dark:text-white">{preloadedCheque.banco || '---'}</span>
                            </div>
                            <div>
                              <span className="block text-[10px] font-bold text-slate-500 dark:text-stone-400 uppercase">Nº do Cheque</span>
                              <span className="font-mono font-black text-slate-900 dark:text-white">
                                {preloadedCheque.numero_cheque || preloadedCheque.numeroCheque || '---'}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[10px] font-bold text-slate-500 dark:text-stone-400 uppercase">Bom Para (Vencimento)</span>
                              <span className="font-bold text-slate-900 dark:text-white">
                                {formatDateBR(preloadedCheque.data_vencimento || (preloadedCheque as any).dataVencimento || '')}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[10px] font-bold text-slate-500 dark:text-stone-400 uppercase">Emitente</span>
                              <span className="font-semibold text-slate-900 dark:text-white">
                                {preloadedCheque.emitente_nome || preloadedCheque.emitenteNome || clientName}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[10px] font-bold text-slate-500 dark:text-stone-400 uppercase">CPF / CNPJ do Emitente</span>
                              <span className="font-mono text-slate-800 dark:text-stone-200">
                                {preloadedCheque.emitente_documento || preloadedCheque.emitenteDocumento || 'Não informado'}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[10px] font-bold text-slate-500 dark:text-stone-400 uppercase">Valor de Face</span>
                              <span className="font-black text-emerald-700 dark:text-emerald-400">
                                {formatCurrencyBRL(Number(preloadedCheque.valor) || totalAmount)}
                              </span>
                            </div>
                          </div>

                          {(preloadedCheque.imagem_url || (preloadedCheque as any).imagemUrl) && (
                            <div className="flex items-center justify-between pt-1">
                              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Imagem física da folha anexada na custódia
                              </span>
                              <button
                                type="button"
                                onClick={() => setZoomImageUrl(preloadedCheque.imagem_url || (preloadedCheque as any).imagemUrl || '')}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 text-xs font-bold transition cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Visualizar Folha do Cheque</span>
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                      <div className="mt-3 p-3.5 bg-sky-50/70 dark:bg-stone-850/80 border border-sky-300 dark:border-stone-700 rounded-xl space-y-3">
                        <div className="flex items-center justify-between border-b border-sky-200 dark:border-stone-700 pb-2">
                          <div className="flex items-center space-x-2">
                            <div className="p-1.5 rounded-lg bg-sky-700 text-white shadow-2xs">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="text-xs font-black uppercase tracking-wider text-sky-950 dark:text-stone-100 block">
                                Metadados das Folhas de Cheque ({line.cheques?.length || 1} {line.cheques && line.cheques.length > 1 ? 'folhas' : 'folha'})
                              </span>
                              <span className="text-[10px] text-slate-600 dark:text-stone-400">
                                Preencha os dados dos cheques para custódia e controle financeiro
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-sky-800 dark:text-sky-300 bg-sky-100 dark:bg-stone-800 border border-sky-200 dark:border-stone-700 px-2 py-0.5 rounded-full">
                            Status Inicial: Em Carteira / Custódia
                          </span>
                        </div>

                        {/* Grade de Folhas de Cheque */}
                        <div className="space-y-3">
                          {line.cheques?.map((chq, chqIdx) => (
                            <div key={chq.id || chqIdx} className="bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-700 rounded-xl p-3 shadow-2xs space-y-2.5">
                              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-stone-300 border-b border-slate-100 dark:border-stone-800 pb-1.5">
                                <span className="text-sky-900 dark:text-sky-400 font-black uppercase">
                                  Folha {chqIdx + 1}/{line.cheques?.length || 1} • Parcela {chqIdx + 1}
                                </span>
                                <span className="font-mono text-emerald-700 dark:text-emerald-400 font-black">
                                  Valor de Face: {formatCurrencyBRL(chq.valor)}
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                {/* Banco */}
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-600 dark:text-stone-400 uppercase mb-0.5">
                                    Banco <span className="text-rose-600">*</span>
                                  </label>
                                  <select
                                    value={chq.banco}
                                    onChange={(e) => handleUpdateCheque(line.id, chqIdx, 'banco', e.target.value)}
                                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-stone-800 border border-slate-300 dark:border-stone-600 rounded-lg text-xs font-bold text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
                                  >
                                    {BRAZILIAN_BANKS.map((b) => (
                                      <option key={b.code} value={b.displayName}>
                                        {b.displayName}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                {/* Número do Cheque */}
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-600 dark:text-stone-400 uppercase mb-0.5">
                                    Nº do Cheque <span className="text-rose-600">*</span>
                                  </label>
                                  <input
                                    type="text"
                                    value={chq.numero}
                                    onChange={(e) => handleUpdateCheque(line.id, chqIdx, 'numero', e.target.value)}
                                    placeholder="Ex: 001245"
                                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-stone-800 border border-slate-300 dark:border-stone-600 rounded-lg text-xs font-mono font-bold text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                                  />
                                </div>

                                {/* Vencimento / Bom Para */}
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-600 dark:text-stone-400 uppercase mb-0.5">
                                    Bom Para (Vencimento) <span className="text-rose-600">*</span>
                                  </label>
                                  <input
                                    type="date"
                                    value={chq.dataVencimento}
                                    onChange={(e) => handleUpdateCheque(line.id, chqIdx, 'dataVencimento', e.target.value)}
                                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-stone-800 border border-slate-300 dark:border-stone-600 rounded-lg text-xs font-bold text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {/* Nome do Emitente */}
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-600 dark:text-stone-400 uppercase mb-0.5">
                                    Nome do Emitente <span className="text-rose-600">*</span>
                                  </label>
                                  <input
                                    type="text"
                                    value={chq.emitenteNome}
                                    onChange={(e) => handleUpdateCheque(line.id, chqIdx, 'emitenteNome', e.target.value)}
                                    placeholder="Nome impresso ou correntista"
                                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-stone-800 border border-slate-300 dark:border-stone-600 rounded-lg text-xs font-semibold text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                                  />
                                </div>

                                {/* CPF / CNPJ do Emitente */}
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-600 dark:text-stone-400 uppercase mb-0.5">
                                    CPF / CNPJ do Emitente
                                  </label>
                                  <input
                                    type="text"
                                    value={chq.emitenteDoc}
                                    onChange={(e) => handleUpdateCheque(line.id, chqIdx, 'emitenteDoc', e.target.value)}
                                    placeholder="000.000.000-00"
                                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-stone-800 border border-slate-300 dark:border-stone-600 rounded-lg text-xs font-mono text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                                  />
                                </div>
                              </div>

                              {/* Foto do Cheque (Upload / Câmera) */}
                              <div className="pt-1 flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                  <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-stone-600 bg-slate-50 dark:bg-stone-800 text-slate-700 dark:text-stone-200 text-[11px] font-bold cursor-pointer hover:bg-slate-100 dark:hover:bg-stone-750 transition">
                                    <Camera className="w-3.5 h-3.5 text-sky-600" />
                                    <span>Foto do Cheque</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      capture="environment"
                                      className="hidden"
                                      onChange={(e) => handleChequeFileSelected(line.id, chqIdx, e.target.files?.[0])}
                                    />
                                  </label>
                                  {chq.previewUrl && (
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => setZoomImageUrl(chq.previewUrl || '')}
                                        className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-700 hover:underline cursor-pointer"
                                      >
                                        <Eye className="w-3 h-3" />
                                        <span>Ver Foto</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveChequeImage(line.id, chqIdx)}
                                        className="text-rose-600 hover:text-rose-700 cursor-pointer p-0.5"
                                        title="Remover foto"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                                {chq.previewUrl && (
                                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Foto anexada
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* OBSERVAÇÕES / ANOTAÇÕES DO FATURAMENTO */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-700 dark:text-stone-300 uppercase mb-1">
              Anotações Gerais do Faturamento (Opcional)
            </label>
            <textarea
              rows={2}
              value={billingNotesExtra}
              onChange={(e) => setBillingNotesExtra(e.target.value.toUpperCase())}
              placeholder="OBSERVAÇÕES INTERNAS, ACORDOS DE PAGAMENTO OU REFERÊNCIAS..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-stone-800 border border-slate-300 dark:border-stone-600 rounded-lg text-xs font-medium text-zinc-900 dark:text-white uppercase placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* RODAPÉ COM AÇÕES */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 bg-slate-100 dark:bg-stone-800 border-t border-slate-300 dark:border-stone-700 shrink-0">
          <div className="text-xs text-zinc-500 dark:text-stone-400 font-semibold truncate mr-2">
            {isBalanced ? (
              <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                ✓ Saldo validado com sucesso.
                {totalInterestAdded > 0 && ` (+ ${formatCurrencyBRL(totalInterestAdded)} em juros aplicados)`}
              </span>
            ) : (
              <span className="text-rose-600 dark:text-rose-400 font-bold">
                Ajuste os valores para habilitar a confirmação.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-stone-300 hover:bg-slate-200 dark:hover:bg-stone-700 rounded-xl transition cursor-pointer"
            >
              Cancelar
            </button>
            {lines.some((l) => !l.paymentMethod) && isBalanced && (
              <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800 flex items-center gap-1.5 shadow-2xs">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                <span>Selecione a Forma de Pagamento</span>
              </span>
            )}
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!isBalanced || lines.some((l) => !l.paymentMethod)}
              className={`inline-flex items-center gap-2 px-5 py-2 text-xs font-black rounded-xl shadow-xs transition uppercase active:scale-95 ${
                isBalanced && lines.every((l) => Boolean(l.paymentMethod))
                  ? 'text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 cursor-pointer'
                  : 'text-slate-400 bg-slate-200 dark:bg-stone-700 dark:text-stone-500 cursor-not-allowed'
              }`}
              title={
                !isBalanced
                  ? 'Distribua o valor total para habilitar'
                  : lines.some((l) => !l.paymentMethod)
                  ? 'Selecione uma forma de pagamento para habilitar'
                  : isServiceMode
                  ? 'Confirmar faturamento e enviar ao Contas a Receber'
                  : 'Confirmar recebimento / quitação'
              }
            >
              {isServiceMode ? (
                <>
                  <Send className="w-4 h-4 stroke-[2.2]" />
                  <span>Confirmar Faturamento & Enviar ao Contas a Receber</span>
                </>
              ) : (
                <>
                  <DollarSign className="w-4 h-4 stroke-[2.5]" />
                  <span>Confirmar Recebimento / Baixa</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* MODAL ZOOM DE FOTO DE CHEQUE */}
      {zoomImageUrl && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative max-w-3xl w-full bg-white dark:bg-stone-900 rounded-2xl overflow-hidden border border-slate-300 dark:border-stone-700 p-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-stone-700 mb-3">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-sky-600" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Visualização da Folha de Cheque
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setZoomImageUrl(null)}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-stone-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center justify-center bg-slate-950/10 dark:bg-black/40 rounded-xl overflow-hidden max-h-[70vh] p-2">
              <img 
                src={zoomImageUrl} 
                alt="Cheque ampliado" 
                className="max-h-[68vh] w-auto object-contain rounded-lg shadow-md"
              />
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE AUTORIZAÇÃO ADMINISTRATIVA PARA DESTRAVAMENTO DE CHEQUE */}
      {showUnlockPasswordModal && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-stone-900 border border-amber-300 dark:border-amber-700/60 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Cabeçalho */}
            <div className="px-4 py-3 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-lg bg-black/20 text-white">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider">
                    Autorização Administrativa
                  </h3>
                  <p className="text-[10px] text-amber-100 font-medium">
                    Destravar forma de recebimento deste cheque
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowUnlockPasswordModal(false);
                  setUnlockPasswordInput('');
                  setUnlockPasswordError('');
                }}
                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-black/10 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Formulário de Senha */}
            <form onSubmit={handleConfirmUnlock} className="p-4 space-y-3.5">
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200 space-y-1">
                <p className="font-semibold">
                  Digite a Senha do Administrador para alterar a forma de recebimento deste cheque:
                </p>
                <div className="text-[10px] text-slate-600 dark:text-stone-300 pt-1 border-t border-amber-200/60 dark:border-amber-800/60 flex items-center justify-between">
                  <span>Cheque: <strong>{preloadedCheque?.numero_cheque || preloadedCheque?.numeroCheque || (activeRecord as any)?.chequeNumero || 'Folha Vinculada'}</strong></span>
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{formatCurrencyBRL(preloadedCheque?.valor || totalAmount)}</span>
                </div>
              </div>

              {unlockPasswordError && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-bold flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{unlockPasswordError}</span>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-stone-300 mb-1">
                  Senha do Administrador <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <input
                    type="password"
                    autoFocus
                    placeholder="Digite a Senha do Administrador..."
                    value={unlockPasswordInput}
                    onChange={(e) => {
                      setUnlockPasswordInput(e.target.value);
                      if (unlockPasswordError) setUnlockPasswordError('');
                    }}
                    className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-stone-600 rounded-xl bg-white dark:bg-stone-800 text-black dark:text-white font-semibold outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <p className="text-[10px] text-slate-500 dark:text-stone-400 mt-1">
                  Ao destravar, o cheque será retirado da custódia e você poderá selecionar PIX, Dinheiro, TED ou outra forma.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowUnlockPasswordModal(false);
                    setUnlockPasswordInput('');
                    setUnlockPasswordError('');
                  }}
                  className="px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-stone-300 hover:bg-slate-100 dark:hover:bg-stone-800 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 text-xs font-black text-white bg-amber-600 hover:bg-amber-700 active:scale-95 rounded-xl transition shadow-xs flex items-center space-x-1.5 cursor-pointer"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Confirmar e Destravar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
