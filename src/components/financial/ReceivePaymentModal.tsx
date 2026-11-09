import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  X, 
  Check, 
  AlertCircle, 
  Calendar, 
  Landmark, 
  CreditCard, 
  DollarSign, 
  FileText,
  Wallet,
  Clock,
  Camera,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  Trash2,
  HelpCircle,
  Building2,
  ArrowRight,
  Sparkles,
  WalletCards,
  Layers,
  CalendarClock,
  Percent,
  Copy,
  Lock,
  Eye
} from 'lucide-react';
import { 
  BankAccount, 
  PaymentMethod, 
  FinanceiroCheque, 
  ClienteCredito,
  CompanyProfile 
} from '../../types';
import { 
  formatCurrencyBRL, 
  formatDateBR, 
  getStoredClients, 
  getActiveCompanyId,
  getStoredFinanceiroCheques,
  saveStoredFinanceiroCheques
} from '../../lib/storage';
import { 
  uploadChequeImagem, 
  saveFinanceiroCheque, 
  saveClienteCredito, 
  fetchClienteCreditos,
  updateClienteCreditoStatus,
  toValidUUID
} from '../../lib/supabaseService';
import { BRAZILIAN_BANKS } from './brazilianBanks';
import { BankCombobox } from './BankCombobox';

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
}

interface ReceivePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ReceivableItem | null;
  bankAccounts?: BankAccount[];
  companyProfile?: CompanyProfile;
  onSuccess?: (details: ReceivePaymentSuccessDetails) => void;
}

export const ReceivePaymentModal: React.FC<ReceivePaymentModalProps> = ({
  isOpen,
  onClose,
  item,
  bankAccounts = [],
  companyProfile,
  onSuccess
}) => {
  const today = new Date().toISOString().split('T')[0];

  // Dados Básicos de Recebimento
  const [receiptDate, setReceiptDate] = useState(today);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [notes, setNotes] = useState('');
  const [receivedAmount, setReceivedAmount] = useState<number>(0);

  // Crédito do Cliente Disponível
  const [availableCredits, setAvailableCredits] = useState<ClienteCredito[]>([]);
  const [useAvailableCredit, setUseAvailableCredit] = useState(false);

  // Grade Dinâmica de Cheques por Parcela
  const [chequesList, setChequesList] = useState<ChequeItemForm[]>([]);

  // Metadados de Cheque Pré-Cadastrado (Read-Only)
  const [preloadedCheque, setPreloadedCheque] = useState<FinanceiroCheque | null>(null);
  const [showChequeZoomModal, setShowChequeZoomModal] = useState(false);

  // Opções de Parcelamento
  const [installmentsCount, setInstallmentsCount] = useState<number>(1);
  const [installmentsIntervalDays, setInstallmentsIntervalDays] = useState<number>(30);
  const [firstPaidImmediately, setFirstPaidImmediately] = useState<boolean>(false);

  // Ajustes Financeiros (Juros / Acréscimos)
  const [interestAmount, setInterestAmount] = useState<number | ''>('');
  const [interestPercentage, setInterestPercentage] = useState<number | ''>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successToast, setSuccessToast] = useState('');

  // Identificação do Cliente
  const resolvedClient = useMemo(() => {
    if (!item?.clientName) return null;
    const clients = getStoredClients();
    const cleanSearch = item.clientName.trim().toLowerCase();
    return clients.find(c => (c.name || '').trim().toLowerCase() === cleanSearch) || null;
  }, [item?.clientName]);

  const targetClientId = useMemo(() => {
    if (item?.clientId) return item.clientId;
    if (resolvedClient?.id) return String(resolvedClient.id);
    return null;
  }, [item?.clientId, resolvedClient]);

  // Carrega créditos prévios do cliente quando o modal abre
  useEffect(() => {
    if (!isOpen || !targetClientId) {
      setAvailableCredits([]);
      setUseAvailableCredit(false);
      return;
    }

    let isMounted = true;
    const loadCredits = async () => {
      try {
        const credits = await fetchClienteCreditos(targetClientId, companyProfile?.id);
        if (isMounted) {
          const avail = credits.filter(c => c.status === 'DISPONIVEL' && Number(c.valor_credito) > 0);
          setAvailableCredits(avail);
        }
      } catch (err) {
        console.warn('Erro ao carregar créditos do cliente:', err);
      }
    };
    loadCredits();

    return () => {
      isMounted = false;
    };
  }, [isOpen, targetClientId, companyProfile?.id]);

  // Sincroniza formulário ao abrir o modal
  useEffect(() => {
    if (!isOpen || !item) return;

    setErrorMessage('');
    setSuccessToast('');
    setReceiptDate(today);
    setNotes('');
    setIsSubmitting(false);

    // Reset Parcelamento e Juros
    setInstallmentsCount(1);
    setInstallmentsIntervalDays(30);
    setFirstPaidImmediately(false);
    setInterestAmount('');
    setInterestPercentage('');

    const accountTotal = Number(item.totalAmount) || 0;
    setReceivedAmount(accountTotal);

    // 1. Identifica se o título foi originado de um parcelamento ou lançamento em Cheque
    const isChequeOrigin = 
      item.paymentMethod === 'cheque' ||
      Boolean(item.chequeId) ||
      Boolean(item.chequeNumero) ||
      /cheque/i.test(item.notes || '') ||
      /cheque/i.test(item.volume || '');

    let foundCheque: FinanceiroCheque | null = null;
    if (isChequeOrigin) {
      try {
        const storedChqs = getStoredFinanceiroCheques();
        const chqMatch = (item.notes || '').match(/cheque\s+n[ºo°]?\s*[:\.]?\s*(\w+)/i);
        const extractedNumero = chqMatch ? chqMatch[1] : undefined;

        // Busca prioritária por ID do cheque ou número do cheque
        foundCheque = storedChqs.find(sc => {
          if (item.chequeId && sc.id === item.chequeId) return true;
          if (item.chequeNumero && (sc.numero_cheque === item.chequeNumero || sc.numeroCheque === item.chequeNumero)) return true;
          if (extractedNumero && (sc.numero_cheque === extractedNumero || sc.numeroCheque === extractedNumero)) return true;
          if (sc.ordem_id && sc.ordem_id === item.id) return true;
          return false;
        }) || null;

        // Fallback: busca por cliente e valor idêntico
        if (!foundCheque) {
          foundCheque = storedChqs.find(sc => {
            const sameClient = (sc.cliente_nome || sc.clienteNome || sc.emitente_nome || '').toLowerCase().includes(item.clientName.toLowerCase()) ||
                               item.clientName.toLowerCase().includes((sc.cliente_nome || sc.clienteNome || '').toLowerCase());
            const sameVal = Math.abs(Number(sc.valor) - accountTotal) < 0.05;
            return sameClient && sameVal;
          }) || null;
        }
      } catch (err) {
        console.warn('Erro ao carregar cheque vinculado:', err);
      }
    }

    setPreloadedCheque(foundCheque);

    // 2. Se for originado de Cheque, força o método para Cheque e trava
    if (isChequeOrigin || foundCheque) {
      setPaymentMethod('cheque');
    } else {
      setPaymentMethod('pix');
    }

    // Inicializa lista de cheques com 1 folha padrão
    const initialCheque: ChequeItemForm = {
      id: `chq_${Date.now()}_0`,
      installmentNumber: 1,
      banco: foundCheque?.banco || '001 - Banco do Brasil',
      bancoCodigo: foundCheque?.banco ? foundCheque.banco.substring(0, 3) : '001',
      numero: foundCheque?.numero_cheque || foundCheque?.numeroCheque || item.chequeNumero || '',
      emitenteNome: foundCheque?.emitente_nome || foundCheque?.emitenteNome || item.clientName || '',
      emitenteDoc: foundCheque?.emitente_documento || foundCheque?.emitenteDocumento || resolvedClient?.cpfCnpj || '',
      dataVencimento: foundCheque?.data_vencimento || foundCheque?.dataVencimento || item.dueDate || item.date || today,
      valor: Number(foundCheque?.valor) || accountTotal,
      selectedFile: null,
      previewUrl: foundCheque?.imagem_url || foundCheque?.imagemUrl || '',
      uploadedImageUrl: foundCheque?.imagem_url || foundCheque?.imagemUrl || '',
      isUploading: false
    };
    setChequesList([initialCheque]);

    // Seleciona conta bancária de destino: se o cheque já tinha uma conta vinculada ou primeira conta
    if (foundCheque?.conta_bancaria_destino_id) {
      setSelectedBankAccountId(foundCheque.conta_bancaria_destino_id);
    } else if (bankAccounts.length > 0) {
      setSelectedBankAccountId(bankAccounts[0].id);
    } else {
      setSelectedBankAccountId('');
    }
  }, [isOpen, item, resolvedClient, bankAccounts, today]);

  // Total de crédito disponível acumulado do cliente
  const totalClientCredit = useMemo(() => {
    return availableCredits.reduce((acc, c) => acc + (Number(c.valor_credito) || 0), 0);
  }, [availableCredits]);

  // Valor a Pagar considerando abatimento de crédito disponível
  const valorContaOriginal = Number(item?.totalAmount) || 0;
  const valorComAbatimento = useMemo(() => {
    if (!useAvailableCredit || totalClientCredit <= 0) return valorContaOriginal;
    return Math.max(0, valorContaOriginal - totalClientCredit);
  }, [useAvailableCredit, totalClientCredit, valorContaOriginal]);

  // Juros e Valor Total Atualizado
  const numericInterest = typeof interestAmount === 'number' ? interestAmount : 0;
  const valorTotalAtualizado = useMemo(() => {
    return Number((valorComAbatimento + numericInterest).toFixed(2));
  }, [valorComAbatimento, numericInterest]);

  // Manipuladores bidirecionais de Juros / Acréscimos
  const handleInterestAmountChange = (valStr: string) => {
    if (valStr === '' || valStr === undefined) {
      setInterestAmount('');
      setInterestPercentage('');
      return;
    }
    const val = parseFloat(valStr);
    if (isNaN(val) || val < 0) {
      setInterestAmount('');
      setInterestPercentage('');
      return;
    }
    setInterestAmount(val);
    const base = valorComAbatimento;
    if (base > 0) {
      const pct = Number(((val / base) * 100).toFixed(2));
      setInterestPercentage(pct);
    } else {
      setInterestPercentage(0);
    }
  };

  const handleInterestPercentageChange = (valStr: string) => {
    if (valStr === '' || valStr === undefined) {
      setInterestAmount('');
      setInterestPercentage('');
      return;
    }
    const val = parseFloat(valStr);
    if (isNaN(val) || val < 0) {
      setInterestAmount('');
      setInterestPercentage('');
      return;
    }
    setInterestPercentage(val);
    const base = valorComAbatimento;
    const amt = Number(((base * val) / 100).toFixed(2));
    setInterestAmount(amt);
  };

  const isCheque = paymentMethod === 'cheque';

  // Identifica se o título já veio com folha de cheque pré-cadastrada (travado em cheque e read-only)
  const isPreRegisteredCheque = useMemo(() => {
    if (!item) return false;
    if (item.paymentMethod === 'cheque') return true;
    if (item.chequeId || item.chequeNumero) return true;
    if (/cheque/i.test(item.notes || '') || /cheque/i.test(item.volume || '')) return true;
    return Boolean(preloadedCheque);
  }, [item, preloadedCheque]);

  // Bloco de Parcelamento Permitido Apenas para Cartão Crédito, Cheque e A Prazo (Carteira)
  const isInstallmentEligible = 
    paymentMethod === 'cartao_credito' || 
    paymentMethod === 'cheque' || 
    paymentMethod === 'prazo_carteira' || 
    paymentMethod === 'safra_prazo';

  const singleChequeFaceValue = chequesList[0]?.valor ?? valorTotalAtualizado;
  const singleChequeDueDate = chequesList[0]?.dataVencimento || item?.dueDate || item?.date || receiptDate || today;

  // Prévia em tempo real das parcelas calculadas com tratamento de centavos
  const previewInstallments: InstallmentPreviewItem[] = useMemo(() => {
    // Quando parcelado (>1x), divide com precisão a dívida total atualizada
    const totalToDivide = (isCheque && installmentsCount <= 1) ? singleChequeFaceValue : valorTotalAtualizado;

    if (!isInstallmentEligible || installmentsCount <= 1) {
      return [{
        number: 1,
        totalInstallments: 1,
        dueDate: isCheque ? singleChequeDueDate : receiptDate,
        amount: totalToDivide,
        isPaid: true
      }];
    }

    const totalCents = Math.round(totalToDivide * 100);
    const count = Math.max(1, Math.min(24, installmentsCount));
    const baseCents = Math.floor(totalCents / count);
    const remainderCents = totalCents - (baseCents * count);

    const items: InstallmentPreviewItem[] = [];
    const baseDateStr = receiptDate || today;

    // Helper para cálculo seguro de data somando dias corridos
    const computeDate = (baseStr: string, addDays: number): string => {
      const parts = baseStr.split('-').map(Number);
      const dt = new Date(parts[0] || 2026, (parts[1] || 1) - 1, (parts[2] || 1) + addDays);
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const d = String(dt.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    for (let i = 1; i <= count; i++) {
      // Ajusta resíduo de centavos na primeira parcela para garantir fechamento de 100% do título
      const cents = i === 1 ? baseCents + remainderCents : baseCents;
      const amount = cents / 100;

      let daysOffset = 0;
      let isPaid = false;

      if (firstPaidImmediately) {
        daysOffset = (i - 1) * installmentsIntervalDays;
        isPaid = i === 1;
      } else {
        daysOffset = i * installmentsIntervalDays;
        isPaid = false;
      }

      const dueDate = computeDate(baseDateStr, daysOffset);

      items.push({
        number: i,
        totalInstallments: count,
        dueDate,
        amount,
        isPaid
      });
    }

    return items;
  }, [isInstallmentEligible, installmentsCount, isCheque, singleChequeFaceValue, singleChequeDueDate, valorTotalAtualizado, receiptDate, today, installmentsIntervalDays, firstPaidImmediately]);

  // Sincroniza dinamicamente a grade de cheques com a quantidade e valores das parcelas
  useEffect(() => {
    if (!isOpen || !item || !isCheque) return;

    const count = Math.max(1, installmentsCount);

    setChequesList(prev => {
      const newList: ChequeItemForm[] = [];

      for (let i = 0; i < count; i++) {
        const inst = previewInstallments[i];
        const existing = prev[i];
        const prevInNew = newList[i - 1] || prev[0];

        const targetAmount = inst ? inst.amount : (count === 1 ? (existing?.valor || valorTotalAtualizado) : 0);
        const targetDueDate = inst ? inst.dueDate : (existing?.dataVencimento || item.dueDate || item.date || today);

        if (existing) {
          newList.push({
            ...existing,
            installmentNumber: i + 1,
            // Trava o valor de face na parcela calculada quando for parcelado (>1)
            valor: count > 1 ? targetAmount : existing.valor,
            // Herda a data calculada da parcela por padrão
            dataVencimento: count > 1 ? (inst?.dueDate || existing.dataVencimento) : existing.dataVencimento
          });
        } else {
          newList.push({
            id: `chq_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
            installmentNumber: i + 1,
            banco: prevInNew?.banco || '001 - Banco do Brasil',
            bancoCodigo: prevInNew?.bancoCodigo || '001',
            numero: '',
            emitenteNome: prevInNew?.emitenteNome || item.clientName || '',
            emitenteDoc: prevInNew?.emitenteDoc || resolvedClient?.cpfCnpj || '',
            dataVencimento: targetDueDate,
            valor: targetAmount,
            selectedFile: null,
            previewUrl: '',
            uploadedImageUrl: '',
            isUploading: false
          });
        }
      }

      return newList;
    });
  }, [isOpen, item?.id, isCheque, installmentsCount, previewInstallments, valorTotalAtualizado]);

  // Total acumulado de todos os cheques
  const totalChequesValor = useMemo(() => {
    return Number(chequesList.reduce((acc, c) => acc + (Number(c.valor) || 0), 0).toFixed(2));
  }, [chequesList]);

  // Validação matemática do Cheque (Troco em Crédito para pagamento único)
  const diferencaCheque = useMemo(() => {
    if (!isCheque) return 0;
    const valorComparado = valorTotalAtualizado;
    return Number((totalChequesValor - valorComparado).toFixed(2));
  }, [isCheque, totalChequesValor, valorTotalAtualizado]);

  const chequeGeraCredito = isCheque && installmentsCount <= 1 && diferencaCheque > 0.009;
  const isAnyChequeUploading = isCheque && chequesList.some(c => Boolean(c.isUploading));

  // Atualizador de campo individual de cheque
  const handleUpdateChequeField = (index: number, field: keyof ChequeItemForm, value: any) => {
    setChequesList(prev => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index], [field]: value };
      }
      return next;
    });
  };

  const handleUpdateChequeBank = (index: number, bankName: string, bankCode?: string) => {
    setChequesList(prev => {
      const next = [...prev];
      if (next[index]) {
        next[index] = {
          ...next[index],
          banco: bankName,
          bancoCodigo: bankCode || next[index].bancoCodigo
        };
      }
      return next;
    });
  };

  // Ação Rápida: "📋 Clonar dados para o próximo cheque"
  const handleCloneChequeToNext = (index: number) => {
    if (index >= chequesList.length - 1) return;
    const current = chequesList[index];

    if (!current.banco && !current.emitenteNome && !current.emitenteDoc) {
      setErrorMessage(`Preencha o Banco ou Emitente do Cheque ${index + 1} antes de clonar.`);
      return;
    }

    setChequesList(prev => {
      const next = [...prev];
      const target = next[index + 1];
      if (target) {
        next[index + 1] = {
          ...target,
          banco: current.banco,
          bancoCodigo: current.bancoCodigo,
          emitenteNome: current.emitenteNome,
          emitenteDoc: current.emitenteDoc
          // Número do cheque permanece em branco / inalterado para entrada do novo número de folha
        };
      }
      return next;
    });

    setSuccessToast(`📋 Dados clonados com sucesso para o Cheque ${index + 2}! Informe o número da folha.`);
    setTimeout(() => setSuccessToast(''), 3000);
  };

  // Gerenciador de Arquivo do Cheque (Câmera ou Upload) por folha
  const handleChequeFileChange = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const localUrl = URL.createObjectURL(file);
    setChequesList(prev => {
      const next = [...prev];
      if (next[index]) {
        next[index] = {
          ...next[index],
          selectedFile: file,
          previewUrl: localUrl,
          isUploading: true
        };
      }
      return next;
    });

    try {
      const activeCid = companyProfile?.id || getActiveCompanyId();
      const uploadRes = await uploadChequeImagem(file, activeCid, file.name);
      if (uploadRes && uploadRes.publicUrl) {
        setChequesList(prev => {
          const next = [...prev];
          if (next[index]) {
            next[index] = {
              ...next[index],
              uploadedImageUrl: uploadRes.publicUrl,
              isUploading: false
            };
          }
          return next;
        });
      } else {
        setChequesList(prev => {
          const next = [...prev];
          if (next[index]) next[index].isUploading = false;
          return next;
        });
      }
    } catch (err) {
      console.warn('Erro ao enviar imagem do cheque:', err);
      setChequesList(prev => {
        const next = [...prev];
        if (next[index]) next[index].isUploading = false;
        return next;
      });
    }
  };

  const handleRemoveChequePhoto = (index: number) => {
    setChequesList(prev => {
      const next = [...prev];
      const chq = next[index];
      if (chq) {
        if (chq.previewUrl && chq.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(chq.previewUrl);
        }
        next[index] = {
          ...chq,
          selectedFile: null,
          previewUrl: '',
          uploadedImageUrl: '',
          isUploading: false
        };
      }
      return next;
    });
    const camEl = document.getElementById(`camera-input-${index}`) as HTMLInputElement | null;
    const fileEl = document.getElementById(`file-input-${index}`) as HTMLInputElement | null;
    if (camEl) camEl.value = '';
    if (fileEl) fileEl.value = '';
  };

  // Submissão da Baixa / Quitação
  const handleConfirm = async () => {
    if (!item) return;
    setErrorMessage('');

    // 1. Tratamento específico para Títulos Originados de Cheques Pré-Cadastrados
    if (isPreRegisteredCheque) {
      setIsSubmitting(true);
      try {
        const storedChqs = getStoredFinanceiroCheques();
        let targetChq = preloadedCheque;
        const foundIdx = storedChqs.findIndex(sc => 
          (preloadedCheque && sc.id === preloadedCheque.id) ||
          (item.chequeId && sc.id === item.chequeId) ||
          (item.chequeNumero && (sc.numero_cheque === item.chequeNumero || sc.numeroCheque === item.chequeNumero)) ||
          (sc.ordem_id && sc.ordem_id === item.id)
        );

        if (foundIdx >= 0) {
          storedChqs[foundIdx] = {
            ...storedChqs[foundIdx],
            status: 'COMPENSADO',
            data_compensacao: receiptDate,
            conta_bancaria_destino_id: selectedBankAccountId || storedChqs[foundIdx].conta_bancaria_destino_id,
            updated_at: new Date().toISOString()
          };
          saveStoredFinanceiroCheques(storedChqs);
          targetChq = storedChqs[foundIdx];
          await saveFinanceiroCheque(targetChq);
        } else if (preloadedCheque) {
          targetChq = {
            ...preloadedCheque,
            status: 'COMPENSADO',
            data_compensacao: receiptDate,
            conta_bancaria_destino_id: selectedBankAccountId || preloadedCheque.conta_bancaria_destino_id,
            updated_at: new Date().toISOString()
          };
          await saveFinanceiroCheque(targetChq);
        }

        window.dispatchEvent(new CustomEvent('financeiro_cheques_updated', { detail: targetChq }));

        // Se utilizou créditos disponíveis do cliente, marca como UTILIZADO
        if (useAvailableCredit && availableCredits.length > 0) {
          const activeCid = toValidUUID(companyProfile?.id || getActiveCompanyId());
          for (const cred of availableCredits) {
            await updateClienteCreditoStatus(cred.id, 'UTILIZADO', activeCid);
          }
        }

        setSuccessToast('Folha de cheque compensada e conta baixada com sucesso!');

        if (onSuccess) {
          onSuccess({
            itemId: item.id,
            itemType: item.type,
            paymentMethod: 'cheque',
            paidAmount: Number(targetChq?.valor) || valorTotalAtualizado,
            receiptDate,
            cheque: targetChq || undefined,
            cheques: targetChq ? [targetChq] : undefined,
            bankAccountId: selectedBankAccountId,
            isInstallmentPlan: false,
            firstPaidImmediately: true,
            interestAmount: numericInterest > 0 ? numericInterest : undefined,
            interestPercentage: typeof interestPercentage === 'number' && interestPercentage > 0 ? interestPercentage : undefined
          });
        }

        setTimeout(() => {
          setIsSubmitting(false);
          onClose();
        }, 700);
        return;
      } catch (err: any) {
        console.error('Erro ao compensar cheque vinculado:', err);
        setErrorMessage(err.message || 'Erro ao compensar cheque. Tente novamente.');
        setIsSubmitting(false);
        return;
      }
    }

    if (isCheque) {
      if (chequesList.length === 0) {
        setErrorMessage('Nenhum cheque configurado para efetuar a baixa.');
        return;
      }

      for (let i = 0; i < chequesList.length; i++) {
        const chq = chequesList[i];
        const label = chequesList.length > 1 ? `Cheque ${i + 1}/${chequesList.length}` : 'Cheque';
        if (!chq.banco.trim()) {
          setErrorMessage(`Por favor, informe o Banco no ${label}.`);
          return;
        }
        if (!chq.numero.trim()) {
          setErrorMessage(`Por favor, informe o Número no ${label}.`);
          return;
        }
        if (!chq.emitenteNome.trim()) {
          setErrorMessage(`Por favor, informe o Nome do Emitente no ${label}.`);
          return;
        }
        if (!chq.dataVencimento) {
          setErrorMessage(`Por favor, informe a Data de Vencimento no ${label}.`);
          return;
        }
        if (chq.valor <= 0) {
          setErrorMessage(`O valor do ${label} deve ser maior que zero.`);
          return;
        }
      }
    }

    setIsSubmitting(true);

    try {
      const activeCid = toValidUUID(companyProfile?.id || getActiveCompanyId());
      const savedCheques: FinanceiroCheque[] = [];

      // 1. Se foi recebido em Cheque: grava todas as folhas na tabela public.financeiro_cheques
      if (isCheque) {
        for (let i = 0; i < chequesList.length; i++) {
          const chq = chequesList[i];
          let finalImageUrl = chq.uploadedImageUrl || '';

          if (chq.selectedFile && !finalImageUrl) {
            try {
              const uploadRes = await uploadChequeImagem(chq.selectedFile, activeCid, chq.selectedFile.name);
              if (uploadRes && uploadRes.publicUrl) {
                finalImageUrl = uploadRes.publicUrl;
              }
            } catch (err) {
              console.warn('Erro ao subir imagem pendente:', err);
            }
          }

          const chequeId = toValidUUID();
          const chequePayload: Partial<FinanceiroCheque> = {
            id: chequeId,
            company_id: activeCid,
            companyId: activeCid,
            cliente_id: targetClientId ? toValidUUID(targetClientId) : null,
            clienteId: targetClientId ? toValidUUID(targetClientId) : null,
            cliente_nome: item.clientName,
            clienteNome: item.clientName,
            banco: chq.banco,
            numero_cheque: chq.numero.trim(),
            numeroCheque: chq.numero.trim(),
            emitente_nome: chq.emitenteNome.trim(),
            emitenteNome: chq.emitenteNome.trim(),
            emitente_documento: chq.emitenteDoc.trim(),
            emitenteDocumento: chq.emitenteDoc.trim(),
            data_vencimento: chq.dataVencimento,
            dataVencimento: chq.dataVencimento,
            valor: chq.valor,
            imagem_url: finalImageUrl,
            imagemUrl: finalImageUrl,
            status: 'EM_NOSSO_PODER',
            created_at: new Date().toISOString()
          };

          const resCheque = await saveFinanceiroCheque(chequePayload);
          const saved = resCheque.data || (chequePayload as FinanceiroCheque);
          savedCheques.push(saved);

          // 2. Se for cheque único e tiver troco em crédito
          if (installmentsCount <= 1 && chequeGeraCredito && i === 0) {
            const creditoPayload: Partial<ClienteCredito> = {
              id: toValidUUID(),
              company_id: activeCid,
              cliente_id: targetClientId ? toValidUUID(targetClientId) : toValidUUID(),
              cliente_nome: item.clientName,
              cheque_origem_id: chequeId,
              valor_credito: diferencaCheque,
              status: 'DISPONIVEL',
              created_at: new Date().toISOString()
            };
            await saveClienteCredito(creditoPayload);
          }
        }
      }

      // 3. Se utilizou créditos disponíveis do cliente, marca os créditos anteriores como UTILIZADOS
      if (useAvailableCredit && availableCredits.length > 0) {
        for (const cred of availableCredits) {
          await updateClienteCreditoStatus(cred.id, 'UTILIZADO', activeCid);
        }
      }

      // 4. Se for parcelamento ativo:
      const isInstallmentActive = isInstallmentEligible && installmentsCount > 1;

      // Feedback de Sucesso
      setSuccessToast(isInstallmentActive ? `Parcelamento em ${installmentsCount}x gerado com sucesso!` : 'Conta baixada com sucesso!');

      if (onSuccess) {
        onSuccess({
          itemId: item.id,
          itemType: item.type,
          paymentMethod,
          paidAmount: isCheque ? totalChequesValor : valorTotalAtualizado,
          receiptDate,
          cheque: savedCheques[0],
          cheques: savedCheques,
          creditoGerado: chequeGeraCredito ? diferencaCheque : undefined,
          bankAccountId: selectedBankAccountId,
          isInstallmentPlan: isInstallmentActive,
          installments: isInstallmentActive ? previewInstallments : undefined,
          firstPaidImmediately: isInstallmentActive ? firstPaidImmediately : true,
          interestAmount: numericInterest > 0 ? numericInterest : undefined,
          interestPercentage: typeof interestPercentage === 'number' && interestPercentage > 0 ? interestPercentage : undefined
        });
      }

      setTimeout(() => {
        setIsSubmitting(false);
        onClose();
      }, 700);

    } catch (err: any) {
      console.error('Erro ao efetivar quitação:', err);
      setErrorMessage(err.message || 'Erro ao registrar baixa de pagamento. Tente novamente.');
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-zinc-950/70 backdrop-blur-xs overflow-hidden overflow-y-hidden">
      <div 
        id="receive-payment-modal-container"
        className="relative w-full max-w-4xl lg:max-w-5xl bg-white dark:bg-stone-900 border border-slate-400 dark:border-stone-700 rounded-2xl shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9),inset_-1px_-1px_0px_rgba(0,0,0,0.15)] overflow-hidden overflow-y-hidden my-auto text-slate-900 dark:text-stone-100 flex flex-col max-h-[92vh]"
      >
        {/* CABEÇALHO - Moldura Metálica 3D Acetinada */}
        <div className="px-4 sm:px-5 py-2.5 bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 dark:from-stone-900 dark:via-stone-850 dark:to-stone-900 border-b border-slate-400 dark:border-stone-700 text-slate-800 dark:text-stone-100 flex items-center justify-between shrink-0 rounded-t-2xl">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/80 dark:bg-stone-800 text-slate-800 dark:text-stone-100 flex items-center justify-center border border-slate-300 dark:border-stone-700 shadow-2xs shrink-0">
              <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-stone-100 truncate">
                BAIXAR / QUITAR CONTA A RECEBER
              </h2>
              <p className="text-[11px] text-slate-600 dark:text-stone-400 font-medium truncate">
                {item.type} • {item.clientName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-300/60 dark:text-stone-400 dark:hover:text-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
            title="Fechar janela"
          >
            <X className="w-4 h-4 text-slate-700 dark:text-stone-200" />
          </button>
        </div>

        {/* CORPO DO FORMULÁRIO COM ROLAGEM */}
        <div className="p-3 sm:p-4 overflow-y-auto space-y-2.5 text-xs max-h-[80vh] scrollbar-none">
          
          {/* MENSAGEM DE ERRO OU SUCESSO */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successToast && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-black flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successToast}</span>
            </div>
          )}

          {/* CARD DE DETALHES DO TÍTULO A RECEBER */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-black/70 block">
                Valor Devido da Conta {numericInterest > 0 && <span className="text-amber-700 font-bold ml-1">(Original: {formatCurrencyBRL(valorContaOriginal)})</span>}
              </span>
              <div className="text-xl sm:text-2xl font-black text-black font-['Outfit'] flex items-baseline gap-2">
                <span>{formatCurrencyBRL(valorTotalAtualizado)}</span>
                {numericInterest > 0 && (
                  <span className="text-xs text-amber-700 font-bold">
                    (+{formatCurrencyBRL(numericInterest)} juros)
                  </span>
                )}
              </div>
              <div className="text-[11px] text-black/70 font-semibold mt-0.5">
                Vencimento: <span className="font-bold text-black">{formatDateBR(item.dueDate || item.date)}</span>
                {item.volume && ` • Volume: ${item.volume}`}
              </div>
            </div>

            {/* SE HOUVER CRÉDITO ANTERIOR DISPONÍVEL DO CLIENTE */}
            {totalClientCredit > 0 && (
              <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-2.5 sm:max-w-xs text-emerald-950 shadow-2xs">
                <div className="flex items-center space-x-1.5 font-black text-[11px] text-emerald-800">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Crédito Disponível do Cliente</span>
                </div>
                <div className="text-base font-black text-emerald-900 font-['Outfit'] mt-0.5">
                  {formatCurrencyBRL(totalClientCredit)}
                </div>
                <label className="flex items-center space-x-1.5 mt-1.5 cursor-pointer text-[11px] font-bold text-emerald-900">
                  <input
                    type="checkbox"
                    checked={useAvailableCredit}
                    onChange={(e) => setUseAvailableCredit(e.target.checked)}
                    className="w-3.5 h-3.5 text-emerald-600 rounded border-emerald-300 focus:ring-emerald-500"
                  />
                  <span>Usar Crédito Disponível como Desconto</span>
                </label>
              </div>
            )}
          </div>

          {/* GRID COM DATA DE RECEBIMENTO E CONTA BANCÁRIA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-black mb-1">
                Data do Recebimento <span className="text-rose-600">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={receiptDate}
                  onChange={(e) => setReceiptDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-black font-semibold outline-none focus:ring-2 focus:ring-sky-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-black mb-1">
                Conta Bancária de Depósito / Caixa
              </label>
              <select
                value={selectedBankAccountId}
                onChange={(e) => setSelectedBankAccountId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-black font-semibold outline-none focus:ring-2 focus:ring-sky-600"
              >
                <option value="">Caixa Geral da Empresa</option>
                {bankAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.bankName} - Ag: {acc.agency} / Cc: {acc.accountNumber})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 1. SELETOR FORMA DE PAGAMENTO (COM CHEQUE E A PRAZO EM DESTAQUE) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-black dark:text-stone-200">
                Forma de Pagamento <span className="text-rose-600">*</span>
              </label>
              {isPreRegisteredCheque && (
                <span className="flex items-center space-x-1 text-[10px] font-black text-amber-900 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 px-2.5 py-0.5 rounded-full">
                  <Lock className="w-3 h-3 text-amber-700 dark:text-amber-400" />
                  <span>Travado em Cheque (Faturamento)</span>
                </span>
              )}
            </div>

            {/* Aviso informativo de travamento */}
            {isPreRegisteredCheque && (
              <div className="mb-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-200 text-xs font-medium flex items-center justify-between gap-2 shadow-2xs">
                <div className="flex items-center space-x-2">
                  <div className="p-1 rounded-md bg-amber-600 text-white shrink-0">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-amber-900 dark:text-amber-200 block text-[11px] uppercase tracking-wider">
                      Título Originado de Folha de Cheque no Faturamento
                    </span>
                    <span className="text-[11px] text-amber-800 dark:text-amber-300">
                      A forma de pagamento está vinculada à folha de cheque já registrada na <strong>Custódia de Cheques</strong>.
                    </span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-200/80 dark:bg-amber-900 text-amber-950 dark:text-amber-100 border border-amber-400 shrink-0">
                  🔒 Travado
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {[
                { id: 'dinheiro', label: 'Dinheiro', icon: Wallet },
                { id: 'pix', label: 'PIX', icon: Sparkles },
                { id: 'cartao_credito', label: 'Cartão Crédito', icon: CreditCard, highlight: true },
                { id: 'cartao_debito', label: 'Cartão Débito', icon: CreditCard },
                { id: 'transferencia', label: 'TED / DOC', icon: Landmark },
                { id: 'cheque', label: 'Cheque', icon: FileText, highlight: true },
                { id: 'prazo_carteira', label: 'A prazo (carteira)', icon: WalletCards, highlight: true }
              ].map((opt) => {
                const Icon = opt.icon;
                const isSelected = paymentMethod === opt.id;
                const isLockedOther = isPreRegisteredCheque && opt.id !== 'cheque';
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={isLockedOther}
                    onClick={() => {
                      if (isLockedOther) return;
                      const nextMethod = opt.id as PaymentMethod;
                      setPaymentMethod(nextMethod);
                      if (nextMethod !== 'cartao_credito' && nextMethod !== 'cheque' && nextMethod !== 'prazo_carteira' && nextMethod !== 'safra_prazo') {
                        setInstallmentsCount(1);
                      }
                    }}
                    title={isLockedOther ? 'Título gerado via Cheque (Forma de pagamento travada na baixa)' : undefined}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition ${
                      isLockedOther ? 'opacity-35 cursor-not-allowed bg-slate-100 dark:bg-stone-800 border-slate-200 dark:border-stone-700 text-slate-400' : 'cursor-pointer'
                    } ${
                      isSelected
                        ? opt.id === 'prazo_carteira'
                          ? 'border-amber-600 bg-amber-50 text-amber-950 font-black shadow-xs ring-2 ring-amber-500'
                          : opt.highlight
                          ? 'border-sky-600 bg-sky-50 text-sky-950 font-black shadow-xs ring-2 ring-sky-500'
                          : 'border-emerald-600 bg-emerald-50 text-emerald-950 font-black shadow-xs ring-2 ring-emerald-500'
                        : isLockedOther ? '' : 'border-slate-200 bg-white hover:bg-slate-50 text-black font-semibold'
                    }`}
                  >
                    <Icon className={`w-4 h-4 mb-1 ${
                      isSelected 
                        ? opt.id === 'prazo_carteira' ? 'text-amber-700' : opt.highlight ? 'text-sky-700' : 'text-emerald-700' 
                        : 'text-slate-600'
                    }`} />
                    <span className="text-[11px] leading-tight flex items-center justify-center gap-1">
                      <span>{opt.label}</span>
                      {opt.id === 'cheque' && isPreRegisteredCheque && (
                        <Lock className="w-2.5 h-2.5 text-sky-700 dark:text-sky-400 shrink-0" />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. AJUSTES FINANCEIROS (OPCIONAL) - JUROS / ACRÉSCIMOS */}
          <div className="border border-slate-200 dark:border-stone-700 bg-slate-50/70 dark:bg-stone-850/50 rounded-2xl p-3.5 sm:p-4 space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-stone-700 pb-2">
              <div className="flex items-center space-x-2">
                <div className="p-1 rounded bg-amber-600 text-white">
                  <Percent className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-stone-100">
                  Ajustes Financeiros (Opcional)
                </span>
              </div>
              {numericInterest > 0 ? (
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-black text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 px-2.5 py-0.5 rounded-full">
                    + {formatCurrencyBRL(numericInterest)} ({interestPercentage || ((numericInterest / (valorComAbatimento || 1)) * 100).toFixed(2)}%)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setInterestAmount('');
                      setInterestPercentage('');
                    }}
                    className="text-[11px] font-bold text-slate-500 hover:text-rose-600 dark:text-stone-400 dark:hover:text-rose-400 cursor-pointer underline"
                    title="Remover juros"
                  >
                    Limpar
                  </button>
                </div>
              ) : (
                <span className="text-[10px] font-bold text-slate-500 dark:text-stone-400">
                  Sem acréscimos aplicados
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Juros / Acréscimos (R$) */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-black dark:text-stone-200 mb-1">
                  Juros / Acréscimos (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-bold text-slate-500 dark:text-stone-400">
                    R$
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={interestAmount}
                    onChange={(e) => handleInterestAmountChange(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 dark:border-stone-600 rounded-xl bg-white dark:bg-stone-900 text-black dark:text-white font-bold outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <span className="text-[10px] text-slate-500 dark:text-stone-400 mt-0.5 block">
                  Valor absoluto somado ao saldo a receber
                </span>
              </div>

              {/* Juros / Acréscimos (%) */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-black dark:text-stone-200 mb-1">
                  Juros / Acréscimos (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={interestPercentage}
                    onChange={(e) => handleInterestPercentageChange(e.target.value)}
                    className="w-full pl-3 pr-8 py-2 text-xs border border-slate-300 dark:border-stone-600 rounded-xl bg-white dark:bg-stone-900 text-black dark:text-white font-bold outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="absolute right-3 top-2 text-xs font-bold text-slate-500 dark:text-stone-400">
                    %
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 dark:text-stone-400 mt-0.5 block">
                  Taxa percentual calculada sobre a base ({formatCurrencyBRL(valorComAbatimento)})
                </span>
              </div>
            </div>
          </div>

          {/* 3. BLOCO CONDICIONAL DE PARCELAMENTO (CARTÃO CRÉDITO, CHEQUE, A PRAZO CARTEIRA) */}
          {isInstallmentEligible && !isPreRegisteredCheque && (
            <div className="border border-sky-300 dark:border-stone-700 bg-sky-50/50 dark:bg-stone-850/60 rounded-2xl p-3.5 sm:p-4 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between border-b border-sky-200 dark:border-stone-700 pb-2">
                <div className="flex items-center space-x-2">
                  <div className="p-1 rounded bg-sky-700 text-white">
                    <Layers className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-wider text-sky-950 dark:text-stone-100">
                    Opções de Parcelamento
                  </span>
                </div>
                <span className="text-[10px] font-bold text-sky-800 dark:text-stone-300 bg-sky-100 dark:bg-stone-800 border border-sky-200 dark:border-stone-700 px-2 py-0.5 rounded-full">
                  {installmentsCount > 1 
                    ? `${installmentsCount}x de ${formatCurrencyBRL(valorTotalAtualizado / installmentsCount)}` 
                    : 'À Vista (1x)'}
                </span>
              </div>

              {/* Grid: Quantidade de Parcelas, Intervalo entre Parcelas e Entrada */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Quantidade de Parcelas */}
                <div>
                  <label className="block text-[11px] font-bold text-black dark:text-stone-200 mb-1">
                    QUANTIDADE DE PARCELAS
                  </label>
                  <select
                    value={installmentsCount}
                    onChange={(e) => setInstallmentsCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-stone-600 rounded-xl bg-white dark:bg-stone-900 text-black dark:text-white font-bold outline-none focus:ring-2 focus:ring-sky-600 cursor-pointer"
                  >
                    <option value={1}>1x (À vista - Sem parcelar)</option>
                    {Array.from({ length: 11 }, (_, i) => i + 2).map((num) => (
                      <option key={num} value={num}>
                        {num}x parcelas ({formatCurrencyBRL(valorTotalAtualizado / num)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Intervalo entre Parcelas (Dias) */}
                <div>
                  <label className="block text-[11px] font-bold text-black dark:text-stone-200 mb-1">
                    INTERVALO ENTRE PARCELAS (DIAS)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="365"
                      disabled={installmentsCount <= 1}
                      value={installmentsIntervalDays}
                      onChange={(e) => setInstallmentsIntervalDays(Math.max(1, parseInt(e.target.value) || 30))}
                      className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-stone-600 rounded-xl bg-white dark:bg-stone-900 text-black dark:text-white font-bold outline-none focus:ring-2 focus:ring-sky-600 disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-stone-800"
                    />
                    <span className="absolute right-3 top-2 text-[10px] text-slate-500 font-bold">dias</span>
                  </div>
                </div>

                {/* 1ª Parcela recebida hoje como Entrada */}
                <div className="flex flex-col justify-end">
                  <label className={`flex items-center space-x-2 p-2 rounded-xl border transition cursor-pointer text-xs font-bold ${
                    firstPaidImmediately && installmentsCount > 1
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200' 
                      : 'bg-white dark:bg-stone-900 border-slate-300 dark:border-stone-600 text-slate-700 dark:text-stone-300'
                  } ${installmentsCount <= 1 ? 'opacity-50 pointer-events-none' : ''}`}>
                    <input
                      type="checkbox"
                      checked={firstPaidImmediately && installmentsCount > 1}
                      disabled={installmentsCount <= 1}
                      onChange={(e) => setFirstPaidImmediately(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                    />
                    <span className="text-[11px] leading-tight">
                      1ª Parcela recebida hoje (Entrada)
                    </span>
                  </label>
                </div>
              </div>

              {/* Tabela / Preview de Parcelas em Tempo Real */}
              {installmentsCount > 1 && (
                <div className="mt-2 space-y-1.5 pt-2 border-t border-sky-200 dark:border-stone-700">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-stone-300 px-1">
                    <span className="uppercase tracking-wide">PRÉVIA DAS PARCELAS ({previewInstallments.length} PARCELAS)</span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-black">
                      Total: {formatCurrencyBRL(previewInstallments.reduce((sum, p) => sum + p.amount, 0))}
                    </span>
                  </div>
                  <div className="bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-700 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-stone-800 max-h-44 overflow-y-auto">
                    {previewInstallments.map((inst) => (
                      <div 
                        key={inst.number} 
                        className={`flex items-center justify-between px-3 py-2 text-xs transition ${
                          inst.isPaid 
                            ? 'bg-emerald-50/70 dark:bg-emerald-950/20 text-emerald-950 dark:text-emerald-200' 
                            : 'hover:bg-slate-50 dark:hover:bg-stone-800 text-slate-800 dark:text-stone-200'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5">
                          <span className="w-6 h-6 rounded-md bg-slate-100 dark:bg-stone-800 font-black text-slate-700 dark:text-stone-300 flex items-center justify-center text-[10px] shrink-0">
                            {inst.number}ª
                          </span>
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white">
                              Parcela {inst.number}/{inst.totalInstallments}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-stone-400 ml-2">
                              Vencimento: <strong className="text-slate-800 dark:text-stone-200">{formatDateBR(inst.dueDate)}</strong>
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className="font-black font-['Outfit'] text-slate-900 dark:text-white">
                            {formatCurrencyBRL(inst.amount)}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            inst.isPaid
                              ? 'bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                              : 'bg-sky-50 border-sky-200 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300'
                          }`}>
                            {inst.isPaid ? 'Recebido (Entrada)' : 'A Receber'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* BLOCO ESPECÍFICO: GRADE DE CHEQUES RECEBIDOS OU METADADOS READ-ONLY */}
          {isCheque && (
            <div className="space-y-3">
              {isPreRegisteredCheque ? (
                /* MODO READ-ONLY: METADADOS DA FOLHA DE CHEQUE VINCULADA */
                <div className="border border-sky-300 dark:border-stone-700 bg-sky-50/60 dark:bg-stone-850/60 rounded-2xl p-3.5 sm:p-4 space-y-3.5 shadow-2xs">
                  {/* Cabeçalho */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-200 dark:border-stone-700 pb-2.5">
                    <div className="flex items-center space-x-2">
                      <div className="p-1.5 rounded-lg bg-sky-700 text-white shadow-2xs">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-black uppercase tracking-wider text-sky-950 dark:text-stone-100 flex items-center gap-1.5">
                          <span>Dados da Folha de Cheque Vinculada (Custódia)</span>
                          <Lock className="w-3.5 h-3.5 text-sky-700 dark:text-sky-400" />
                        </span>
                        <span className="text-[11px] text-slate-600 dark:text-stone-400">
                          Metadados importados automaticamente do faturamento / custódia
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-black text-sky-900 dark:text-sky-300 bg-sky-100 dark:bg-stone-800 border border-sky-300 dark:border-stone-700 px-2.5 py-1 rounded-full uppercase tracking-wider">
                        Status: {preloadedCheque?.status === 'COMPENSADO' ? 'Compensado' : preloadedCheque?.status === 'DEVOLVIDO' ? 'Devolvido' : 'Em Carteira / Em Nosso Poder'}
                      </span>
                    </div>
                  </div>

                  {/* Grade de Dados Read-only */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {/* Banco */}
                    <div className="bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-700 rounded-xl p-2.5 shadow-2xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-stone-400 block mb-0.5">
                        Banco de Origem
                      </span>
                      <div className="flex items-center space-x-2 text-xs font-black text-slate-900 dark:text-white">
                        <Landmark className="w-3.5 h-3.5 text-sky-700 shrink-0" />
                        <span className="truncate">{preloadedCheque?.banco || 'Banco do Brasil (001)'}</span>
                      </div>
                    </div>

                    {/* Número do Cheque */}
                    <div className="bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-700 rounded-xl p-2.5 shadow-2xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-stone-400 block mb-0.5">
                        Número do Cheque
                      </span>
                      <div className="text-xs font-black text-slate-900 dark:text-white font-mono">
                        {preloadedCheque?.numero_cheque || preloadedCheque?.numeroCheque || item.chequeNumero || '---'}
                      </div>
                    </div>

                    {/* Valor de Face */}
                    <div className="bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-700 rounded-xl p-2.5 shadow-2xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-stone-400 block mb-0.5">
                        Valor de Face do Cheque
                      </span>
                      <div className="text-sm font-black text-emerald-700 dark:text-emerald-400 font-['Outfit']">
                        {formatCurrencyBRL(preloadedCheque?.valor || item.totalAmount)}
                      </div>
                    </div>

                    {/* Nome do Emitente */}
                    <div className="bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-700 rounded-xl p-2.5 shadow-2xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-stone-400 block mb-0.5">
                        Nome do Emitente
                      </span>
                      <div className="text-xs font-black text-slate-900 dark:text-white truncate">
                        {preloadedCheque?.emitente_nome || preloadedCheque?.emitenteNome || item.clientName}
                      </div>
                    </div>

                    {/* CPF/CNPJ */}
                    <div className="bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-700 rounded-xl p-2.5 shadow-2xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-stone-400 block mb-0.5">
                        CPF / CNPJ do Emitente
                      </span>
                      <div className="text-xs font-bold text-slate-800 dark:text-stone-200 font-mono">
                        {preloadedCheque?.emitente_documento || preloadedCheque?.emitenteDocumento || resolvedClient?.cpfCnpj || '---'}
                      </div>
                    </div>

                    {/* Vencimento / Bom Para */}
                    <div className="bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-700 rounded-xl p-2.5 shadow-2xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-stone-400 block mb-0.5">
                        Data de Vencimento / "Bom Para"
                      </span>
                      <div className="text-xs font-black text-slate-900 dark:text-white flex items-center space-x-1.5">
                        <Calendar className="w-3.5 h-3.5 text-sky-700 shrink-0" />
                        <span>{formatDateBR(preloadedCheque?.data_vencimento || preloadedCheque?.dataVencimento || item.dueDate)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Foto / Anexo da Folha Física */}
                  <div className="bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-700 rounded-xl p-3 flex items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center space-x-3">
                      {(preloadedCheque?.imagem_url || preloadedCheque?.imagemUrl) ? (
                        <div 
                          onClick={() => setShowChequeZoomModal(true)}
                          className="w-16 h-10 rounded-lg overflow-hidden border border-slate-300 dark:border-stone-600 cursor-pointer hover:opacity-85 transition shrink-0 group relative shadow-2xs"
                        >
                          <img 
                            src={preloadedCheque?.imagem_url || preloadedCheque?.imagemUrl} 
                            alt="Cheque" 
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                            <Eye className="w-4 h-4 text-white" />
                          </div>
                        </div>
                      ) : (
                        <div className="w-12 h-10 rounded-lg bg-slate-100 dark:bg-stone-800 border border-slate-200 dark:border-stone-700 flex items-center justify-center text-slate-400 shrink-0">
                          <ImageIcon className="w-5 h-5" />
                        </div>
                      )}
                      <div>
                        <span className="text-[11px] font-bold text-slate-900 dark:text-white block">
                          {(preloadedCheque?.imagem_url || preloadedCheque?.imagemUrl) 
                            ? 'Comprovante / Imagem da Folha Física Anexada' 
                            : 'Nenhuma foto anexada no faturamento'}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-stone-400">
                          {(preloadedCheque?.imagem_url || preloadedCheque?.imagemUrl) 
                            ? 'Clique para ampliar e auditar os dados da lâmina' 
                            : 'O documento foi registrado sem anexo de foto'}
                        </span>
                      </div>
                    </div>

                    {(preloadedCheque?.imagem_url || preloadedCheque?.imagemUrl) && (
                      <button
                        type="button"
                        onClick={() => setShowChequeZoomModal(true)}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/60 dark:hover:bg-sky-900 text-sky-900 dark:text-sky-300 border border-sky-300 dark:border-sky-700 text-xs font-bold transition cursor-pointer shrink-0"
                      >
                        <Eye className="w-3.5 h-3.5 text-sky-700 dark:text-sky-400" />
                        <span>Visualizar Imagem da Folha</span>
                      </button>
                    )}
                  </div>

                  {/* Informação sobre Baixa e Compensação */}
                  <div className="p-2.5 rounded-xl bg-sky-100/70 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-[11px] text-sky-900 dark:text-sky-300 flex items-start space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-sky-700 dark:text-sky-400 shrink-0 mt-0.5" />
                    <span>
                      Os metadados desta folha foram recuperados da <strong>Custódia de Cheques</strong> e estão travados para alteração nesta etapa. Ao confirmar a baixa, o cheque será automaticamente compensado e o valor creditado na Conta Bancária de destino.
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  {/* Topo Geral da Seção de Cheques */}
                  <div className="flex items-center justify-between border-b border-sky-300 dark:border-stone-700 pb-2">
                    <div className="flex items-center space-x-2">
                      <div className="p-1 rounded bg-sky-700 text-white shadow-2xs">
                        <FileText className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-black uppercase tracking-wider text-sky-950 dark:text-stone-100">
                        {chequesList.length > 1
                          ? `Dados dos Cheques Recebidos (${chequesList.length} Folhas)`
                          : 'Dados do Cheque Recebido'}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-sky-800 dark:text-stone-300 bg-sky-100 dark:bg-stone-800 border border-sky-200 dark:border-stone-700 px-2 py-0.5 rounded-full">
                      Status Inicial: Em Nosso Poder
                    </span>
                  </div>

              {/* Se houver mais de 1 parcela, exibe mini-chips de navegação/status das folhas */}
              {chequesList.length > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {chequesList.map((chq, idx) => {
                    const isComplete = Boolean(chq.numero.trim() && chq.banco.trim() && chq.emitenteNome.trim());
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          document.getElementById(`cheque-card-${idx}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition flex items-center space-x-1.5 shrink-0 cursor-pointer ${
                          isComplete
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300'
                            : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-300'
                        }`}
                      >
                        <span>{isComplete ? '✓' : '⚠️'}</span>
                        <span>Cheque {idx + 1}/{chequesList.length} ({formatCurrencyBRL(chq.valor)})</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Grade Sequencial de Blocos de Cheque */}
              {chequesList.map((chq, index) => (
                <div
                  key={chq.id || index}
                  id={`cheque-card-${index}`}
                  className="border border-sky-300 dark:border-stone-700 bg-sky-50/50 dark:bg-stone-850/60 rounded-2xl p-3.5 sm:p-4 space-y-3.5 transition shadow-2xs"
                >
                  {/* Cabeçalho Individual do Bloco de Cheque */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-200 dark:border-stone-700 pb-2.5">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 rounded-md bg-sky-700 text-white flex items-center justify-center font-black text-xs shadow-2xs">
                        {index + 1}
                      </div>
                      <div>
                        <span className="text-xs font-black uppercase tracking-wider text-sky-950 dark:text-stone-100">
                          {chequesList.length > 1
                            ? `Cheque ${index + 1}/${chequesList.length} (${formatCurrencyBRL(chq.valor)})`
                            : `Cheque (${formatCurrencyBRL(chq.valor)})`}
                        </span>
                        <span className="text-[11px] text-slate-600 dark:text-stone-400 font-medium ml-2">
                          • Vencimento Parcela: <strong className="text-slate-800 dark:text-stone-200">{formatDateBR(chq.dataVencimento)}</strong>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {/* Ação Rápida: "📋 Clonar dados para o próximo cheque" */}
                      {index < chequesList.length - 1 && (
                        <button
                          type="button"
                          onClick={() => handleCloneChequeToNext(index)}
                          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-white dark:bg-stone-800 hover:bg-sky-100 dark:hover:bg-sky-900/50 text-sky-900 dark:text-sky-200 border border-sky-300 dark:border-sky-700 text-[11px] font-bold transition shadow-2xs cursor-pointer active:scale-95"
                          title="Copiar Banco, Emitente e CPF/CNPJ para o próximo cheque"
                        >
                          <Copy className="w-3.5 h-3.5 text-sky-700 dark:text-sky-400" />
                          <span>📋 Clonar dados para o próximo cheque</span>
                        </button>
                      )}
                      <span className="text-[10px] font-bold text-sky-800 dark:text-stone-300 bg-sky-100 dark:bg-stone-800 border border-sky-200 dark:border-stone-700 px-2 py-0.5 rounded-full">
                        Em Nosso Poder
                      </span>
                    </div>
                  </div>

                  {/* Grid 1: Banco e Número do Cheque */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-black dark:text-stone-200 mb-1">
                        Banco do Cheque <span className="text-rose-600">*</span>
                      </label>
                      <BankCombobox
                        value={chq.banco}
                        bankCode={chq.bancoCodigo}
                        onChange={(bName, bCode) => handleUpdateChequeBank(index, bName, bCode)}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-black dark:text-stone-200 mb-1">
                        Número do Cheque <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder={`Ex: ${String(420 + index + 1).padStart(6, '0')}`}
                        value={chq.numero}
                        onChange={(e) => handleUpdateChequeField(index, 'numero', e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-stone-600 rounded-xl bg-white dark:bg-stone-900 text-black dark:text-white font-semibold outline-none focus:ring-2 focus:ring-sky-600"
                      />
                    </div>
                  </div>

                  {/* Grid 2: Emitente e CPF/CNPJ */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-black dark:text-stone-200 mb-1">
                        Nome do Emitente <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Nome completo do titular que assinou"
                        value={chq.emitenteNome}
                        onChange={(e) => handleUpdateChequeField(index, 'emitenteNome', e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-stone-600 rounded-xl bg-white dark:bg-stone-900 text-black dark:text-white font-semibold outline-none focus:ring-2 focus:ring-sky-600"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-black dark:text-stone-200 mb-1">
                        CPF ou CNPJ do Emitente
                      </label>
                      <input
                        type="text"
                        placeholder="000.000.000-00 ou 00.000.000/0000-00"
                        value={chq.emitenteDoc}
                        onChange={(e) => handleUpdateChequeField(index, 'emitenteDoc', e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-stone-600 rounded-xl bg-white dark:bg-stone-900 text-black dark:text-white font-semibold outline-none focus:ring-2 focus:ring-sky-600"
                      />
                    </div>
                  </div>

                  {/* Grid 3: Data de Vencimento / Bom Para e Valor do Cheque */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-bold text-black dark:text-stone-200">
                          Data de Vencimento / "Bom para" <span className="text-rose-600">*</span>
                        </label>
                        {previewInstallments[index]?.dueDate && (
                          <span className="text-[10px] text-slate-500 dark:text-stone-400">
                            Calculado: {formatDateBR(previewInstallments[index].dueDate)}
                          </span>
                        )}
                      </div>
                      <input
                        type="date"
                        value={chq.dataVencimento}
                        onChange={(e) => handleUpdateChequeField(index, 'dataVencimento', e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-stone-600 rounded-xl bg-white dark:bg-stone-900 text-black dark:text-white font-semibold outline-none focus:ring-2 focus:ring-sky-600"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-bold text-black dark:text-stone-200">
                          Valor de Face do Cheque (R$) <span className="text-rose-600">*</span>
                        </label>
                        {installmentsCount > 1 ? (
                          <span className="text-[10px] text-sky-800 dark:text-stone-300 bg-sky-100 dark:bg-stone-800 border border-sky-200 dark:border-stone-700 px-1.5 py-0.2 rounded font-bold">
                            Travado na Parcela {index + 1}
                          </span>
                        ) : null}
                      </div>
                      {installmentsCount > 1 ? (
                        <input
                          type="text"
                          readOnly
                          disabled
                          value={formatCurrencyBRL(chq.valor)}
                          className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-stone-600 rounded-xl bg-slate-100 dark:bg-stone-800 text-slate-900 dark:text-stone-100 font-black text-sm cursor-not-allowed outline-none select-none"
                        />
                      ) : (
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0,00"
                          value={chq.valor || ''}
                          onChange={(e) => handleUpdateChequeField(index, 'valor', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-stone-600 rounded-xl bg-white dark:bg-stone-900 text-black dark:text-white font-black text-sm outline-none focus:ring-2 focus:ring-sky-600"
                        />
                      )}
                    </div>
                  </div>

                  {/* Anexo / Imagem do Cheque Individual */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-black dark:text-stone-200 mb-1.5">
                      Anexar Imagem / Foto do Cheque Físico {chequesList.length > 1 ? `(${index + 1}/${chequesList.length})` : ''}
                    </label>

                    <input
                      id={`camera-input-${index}`}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => handleChequeFileChange(index, e)}
                    />

                    <input
                      id={`file-input-${index}`}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/jpg,application/pdf"
                      className="hidden"
                      onChange={(e) => handleChequeFileChange(index, e)}
                    />

                    {!chq.previewUrl && !chq.uploadedImageUrl ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => document.getElementById(`camera-input-${index}`)?.click()}
                          className="flex items-center justify-center space-x-2 px-3 py-2 rounded-xl border border-sky-400 dark:border-stone-600 bg-white dark:bg-stone-900 hover:bg-sky-50 dark:hover:bg-stone-800 text-sky-900 dark:text-sky-300 font-bold transition cursor-pointer shadow-2xs active:scale-95 text-xs"
                        >
                          <Camera className="w-3.5 h-3.5 text-sky-700 dark:text-sky-400" />
                          <span>Tirar Foto (Câmera)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => document.getElementById(`file-input-${index}`)?.click()}
                          className="flex items-center justify-center space-x-2 px-3 py-2 rounded-xl border border-slate-300 dark:border-stone-600 bg-white dark:bg-stone-900 hover:bg-slate-50 dark:hover:bg-stone-800 text-black dark:text-white font-bold transition cursor-pointer shadow-2xs active:scale-95 text-xs"
                        >
                          <Upload className="w-3.5 h-3.5 text-slate-700 dark:text-stone-400" />
                          <span>Selecionar Arquivo</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between p-2.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-200">
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <div className="w-10 h-10 rounded-lg overflow-hidden border border-emerald-400 dark:border-emerald-700 bg-white dark:bg-stone-800 shrink-0 flex items-center justify-center">
                            <img
                              src={chq.previewUrl || chq.uploadedImageUrl}
                              alt={`Preview Cheque ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <span className="text-[11px] font-black text-emerald-900 dark:text-emerald-300 block truncate">
                              {chq.selectedFile?.name || `cheque_${index + 1}.jpg`}
                            </span>
                            <span className="text-[10px] text-emerald-800 dark:text-emerald-400 font-semibold block">
                              {chq.isUploading ? 'Enviando imagem...' : 'Imagem anexada e vinculada à folha'}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveChequePhoto(index)}
                          className="p-1.5 rounded-lg text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition cursor-pointer"
                          title="Remover foto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Alerta de Troco em Crédito Automático (para recebimento em cheque à vista) */}
              {chequeGeraCredito && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl text-emerald-950 dark:text-emerald-200 flex items-start space-x-2.5 shadow-2xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-relaxed">
                    <span className="font-black text-emerald-900 dark:text-emerald-300 block text-xs">
                      Troco em Crédito Automático Detectado:
                    </span>
                    Atenção: O valor do cheque é maior que a dívida. Um crédito de{' '}
                    <strong className="text-emerald-900 dark:text-emerald-300 font-black font-['Outfit'] text-xs">
                      {formatCurrencyBRL(diferencaCheque)}
                    </strong>{' '}
                    será gerado automaticamente para a próxima compra deste cliente.
                  </div>
                </div>
              )}
                </>
              )}
            </div>
          )}

          {/* CAMPO DE OBSERVAÇÕES ADICIONAIS */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-black mb-1">
              Observações do Caixa / Quitação (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ex: Recebido no escritório central, entregue pelo produtor"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-black outline-none focus:ring-2 focus:ring-sky-600"
            />
          </div>

        </div>

        {/* RODAPÉ COM AÇÕES */}
        <div className="px-4 sm:px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-black/70 font-semibold">
            {isCheque ? (
              <span>
                {installmentsCount > 1 ? (
                  <>Total dos Cheques ({chequesList.length} folhas): <strong className="text-black font-bold font-['Outfit']">{formatCurrencyBRL(totalChequesValor)}</strong></>
                ) : (
                  <>Total do Cheque: <strong className="text-black font-bold font-['Outfit']">{formatCurrencyBRL(totalChequesValor)}</strong></>
                )}
              </span>
            ) : isInstallmentEligible && installmentsCount > 1 ? (
              <span>
                Total Parcelado ({installmentsCount}x){numericInterest > 0 ? ' com Juros' : ''}:{' '}
                <strong className="text-black font-bold font-['Outfit']">{formatCurrencyBRL(valorTotalAtualizado)}</strong>
              </span>
            ) : (
              <span>
                Total a Liquidar{numericInterest > 0 ? ' com Juros' : ''}:{' '}
                <strong className="text-black font-bold font-['Outfit']">{formatCurrencyBRL(valorTotalAtualizado)}</strong>
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-black font-bold text-xs transition cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              disabled={isSubmitting || isAnyChequeUploading}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition cursor-pointer shadow-xs flex items-center space-x-1.5 active:scale-95 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Gravando...' : isInstallmentEligible && installmentsCount > 1 ? 'Confirmar Parcelamento / Baixa' : 'Confirmar Recebimento'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal Zoom do Cheque Vinculado */}
      {showChequeZoomModal && (preloadedCheque?.imagem_url || preloadedCheque?.imagemUrl) && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative max-w-3xl w-full bg-white dark:bg-stone-900 rounded-2xl overflow-hidden border border-slate-300 dark:border-stone-700 p-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-stone-700 mb-3">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-sky-600" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Folha de Cheque Nº {preloadedCheque?.numero_cheque || preloadedCheque?.numeroCheque} - {preloadedCheque?.banco}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowChequeZoomModal(false)}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-stone-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center justify-center bg-slate-950/10 dark:bg-black/40 rounded-xl overflow-hidden max-h-[70vh] p-2">
              <img 
                src={preloadedCheque?.imagem_url || preloadedCheque?.imagemUrl} 
                alt="Cheque ampliado" 
                className="max-h-[68vh] w-auto object-contain rounded-lg shadow-md"
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-stone-400">
              <span>Emitente: <strong className="text-slate-800 dark:text-stone-200">{preloadedCheque?.emitente_nome || preloadedCheque?.emitenteNome}</strong></span>
              <span>Valor: <strong className="text-emerald-700 dark:text-emerald-400 font-bold">{formatCurrencyBRL(preloadedCheque?.valor || 0)}</strong></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
