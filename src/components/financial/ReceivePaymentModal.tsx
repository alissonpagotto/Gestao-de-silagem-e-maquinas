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
  Sparkles
} from 'lucide-react';
import { 
  BankAccount, 
  PaymentMethod, 
  FinanceiroCheque, 
  ClienteCredito,
  CompanyProfile 
} from '../../types';
import { formatCurrencyBRL, formatDateBR, getStoredClients, getActiveCompanyId } from '../../lib/storage';
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
}

interface ReceivePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ReceivableItem | null;
  bankAccounts?: BankAccount[];
  companyProfile?: CompanyProfile;
  onSuccess?: (details: {
    itemId: string;
    itemType: string;
    paymentMethod: PaymentMethod;
    paidAmount: number;
    receiptDate: string;
    cheque?: FinanceiroCheque;
    creditoGerado?: number;
  }) => void;
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

  // Dados Específicos para Cheque
  const [chequeBanco, setChequeBanco] = useState('001 - Banco do Brasil');
  const [chequeBancoCodigo, setChequeBancoCodigo] = useState('001');
  const [chequeNumero, setChequeNumero] = useState('');
  const [chequeEmitenteNome, setChequeEmitenteNome] = useState('');
  const [chequeEmitenteDoc, setChequeEmitenteDoc] = useState('');
  const [chequeVencimento, setChequeVencimento] = useState(today);
  const [chequeValor, setChequeValor] = useState<number>(0);

  // Upload e Captura de Imagem do Cheque
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successToast, setSuccessToast] = useState('');

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setPaymentMethod('pix');
    setNotes('');
    setIsSubmitting(false);
    setSelectedFile(null);
    setPreviewUrl('');
    setUploadedImageUrl('');

    const accountTotal = Number(item.totalAmount) || 0;
    setReceivedAmount(accountTotal);
    setChequeValor(accountTotal);

    // Pré-preenche dados do emitente do cheque
    setChequeEmitenteNome(item.clientName || '');
    setChequeEmitenteDoc(resolvedClient?.cpfCnpj || '');
    setChequeNumero('');
    setChequeBanco('001 - Banco do Brasil');
    setChequeBancoCodigo('001');
    setChequeVencimento(item.dueDate || item.date || today);

    // Seleciona primeira conta bancária se houver
    if (bankAccounts.length > 0) {
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

  // Validação matemática do Cheque (Troco em Crédito)
  const isCheque = paymentMethod === 'cheque';
  const diferencaCheque = useMemo(() => {
    if (!isCheque) return 0;
    const valorComparado = valorComAbatimento;
    return Number((chequeValor - valorComparado).toFixed(2));
  }, [isCheque, chequeValor, valorComAbatimento]);

  const chequeGeraCredito = isCheque && diferencaCheque > 0.009;

  // Gerenciador de Arquivo do Cheque (Câmera ou Upload)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);

    // Dispara upload em segundo plano para o bucket cheques-imagens
    setIsUploading(true);
    setErrorMessage('');
    try {
      const activeCid = companyProfile?.id || getActiveCompanyId();
      const uploadRes = await uploadChequeImagem(file, activeCid, file.name);
      if (uploadRes && uploadRes.publicUrl) {
        setUploadedImageUrl(uploadRes.publicUrl);
      }
    } catch (err: any) {
      console.warn('Erro ao enviar imagem do cheque:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemovePhoto = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl('');
    setUploadedImageUrl('');
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Submissão da Baixa / Quitação
  const handleConfirm = async () => {
    if (!item) return;
    setErrorMessage('');

    if (isCheque) {
      if (!chequeBanco.trim()) {
        setErrorMessage('Por favor, informe o Banco do Cheque.');
        return;
      }
      if (!chequeNumero.trim()) {
        setErrorMessage('Por favor, informe o Número do Cheque.');
        return;
      }
      if (!chequeEmitenteNome.trim()) {
        setErrorMessage('Por favor, informe o Nome do Emitente.');
        return;
      }
      if (!chequeVencimento) {
        setErrorMessage('Por favor, informe a Data de Vencimento do Cheque.');
        return;
      }
      if (chequeValor <= 0) {
        setErrorMessage('O valor do cheque deve ser maior que zero.');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const activeCid = toValidUUID(companyProfile?.id || getActiveCompanyId());
      let finalImageUrl = uploadedImageUrl;

      // Se há um arquivo selecionado e ainda não tem URL remota, realiza o upload agora
      if (isCheque && selectedFile && !finalImageUrl) {
        setIsUploading(true);
        const uploadRes = await uploadChequeImagem(selectedFile, activeCid, selectedFile.name);
        if (uploadRes && uploadRes.publicUrl) {
          finalImageUrl = uploadRes.publicUrl;
          setUploadedImageUrl(finalImageUrl);
        }
        setIsUploading(false);
      }

      let savedCheque: FinanceiroCheque | undefined;

      // 1. Se foi recebido em Cheque: grava na tabela public.financeiro_cheques
      if (isCheque) {
        const chequeId = toValidUUID();
        const chequePayload: Partial<FinanceiroCheque> = {
          id: chequeId,
          company_id: activeCid,
          cliente_id: targetClientId ? toValidUUID(targetClientId) : null,
          cliente_nome: item.clientName,
          banco: chequeBanco,
          numero_cheque: chequeNumero.trim(),
          emitente_nome: chequeEmitenteNome.trim(),
          emitente_documento: chequeEmitenteDoc.trim(),
          data_vencimento: chequeVencimento,
          valor: chequeValor,
          imagem_url: finalImageUrl || '',
          status: 'EM_NOSSO_PODER',
          created_at: new Date().toISOString()
        };

        const resCheque = await saveFinanceiroCheque(chequePayload);
        savedCheque = resCheque.data || (chequePayload as FinanceiroCheque);

        // 2. Regra de Negócio: Cheque com Valor Maior -> Gera Crédito Automático
        if (chequeGeraCredito) {
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

      // 3. Se utilizou créditos disponíveis do cliente, marca os créditos anteriores como UTILIZADOS
      if (useAvailableCredit && availableCredits.length > 0) {
        for (const cred of availableCredits) {
          await updateClienteCreditoStatus(cred.id, 'UTILIZADO', activeCid);
        }
      }

      // Feedback de Sucesso
      setSuccessToast('Conta baixada com sucesso!');

      if (onSuccess) {
        onSuccess({
          itemId: item.id,
          itemType: item.type,
          paymentMethod,
          paidAmount: isCheque ? chequeValor : (receivedAmount || valorComAbatimento),
          receiptDate,
          cheque: savedCheque,
          creditoGerado: chequeGeraCredito ? diferencaCheque : undefined
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
        className="relative w-full max-w-2xl bg-white dark:bg-stone-900 border border-slate-400 dark:border-stone-700 rounded-2xl shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9),inset_-1px_-1px_0px_rgba(0,0,0,0.15)] overflow-hidden overflow-y-hidden my-auto text-slate-900 dark:text-stone-100 flex flex-col max-h-[92vh]"
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
                Valor Devido da Conta
              </span>
              <div className="text-xl sm:text-2xl font-black text-black font-['Outfit']">
                {formatCurrencyBRL(valorContaOriginal)}
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

          {/* 1. SELETOR FORMA DE PAGAMENTO (COM CHEQUE EM DESTAQUE) */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-black mb-1.5">
              Forma de Pagamento <span className="text-rose-600">*</span>
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {[
                { id: 'dinheiro', label: 'Dinheiro', icon: Wallet },
                { id: 'pix', label: 'PIX', icon: Sparkles },
                { id: 'cartao_credito', label: 'Cartão Crédito', icon: CreditCard },
                { id: 'cartao_debito', label: 'Cartão Débito', icon: CreditCard },
                { id: 'transferencia', label: 'TED / DOC', icon: Landmark },
                { id: 'cheque', label: 'Cheque', icon: FileText, highlight: true }
              ].map((opt) => {
                const Icon = opt.icon;
                const isSelected = paymentMethod === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPaymentMethod(opt.id as PaymentMethod)}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition cursor-pointer ${
                      isSelected
                        ? opt.highlight
                          ? 'border-sky-600 bg-sky-50 text-sky-950 font-black shadow-xs ring-2 ring-sky-500'
                          : 'border-emerald-600 bg-emerald-50 text-emerald-950 font-black shadow-xs ring-2 ring-emerald-500'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-black font-semibold'
                    }`}
                  >
                    <Icon className={`w-4 h-4 mb-1 ${isSelected ? (opt.highlight ? 'text-sky-700' : 'text-emerald-700') : 'text-slate-600'}`} />
                    <span className="text-[11px] leading-tight">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* BLOCO ESPECÍFICO DINÂMICO: FORMULÁRIO DO CHEQUE */}
          {isCheque && (
            <div className="border border-sky-300 bg-sky-50/40 rounded-2xl p-3.5 sm:p-4 space-y-3.5">
              <div className="flex items-center justify-between border-b border-sky-200 pb-2">
                <div className="flex items-center space-x-2">
                  <div className="p-1 rounded bg-sky-600 text-white">
                    <FileText className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-wider text-sky-950">
                    Dados do Cheque Recebido
                  </span>
                </div>
                <span className="text-[10px] font-bold text-sky-800 bg-sky-100 border border-sky-300 px-2 py-0.5 rounded-full">
                  Status Inicial: Em Nosso Poder
                </span>
              </div>

              {/* Grid 1: Banco e Número do Cheque */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-black mb-1">
                    Banco do Cheque <span className="text-rose-600">*</span>
                  </label>
                  <BankCombobox
                    value={chequeBanco}
                    bankCode={chequeBancoCodigo}
                    onChange={(bName, bCode) => {
                      setChequeBanco(bName);
                      if (bCode) setChequeBancoCodigo(bCode);
                    }}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-black mb-1">
                    Número do Cheque <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 000421"
                    value={chequeNumero}
                    onChange={(e) => setChequeNumero(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-black font-semibold outline-none focus:ring-2 focus:ring-sky-600"
                  />
                </div>
              </div>

              {/* Grid 2: Emitente e CPF/CNPJ */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-black mb-1">
                    Nome do Emitente <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Nome completo do titular que assinou"
                    value={chequeEmitenteNome}
                    onChange={(e) => setChequeEmitenteNome(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-black font-semibold outline-none focus:ring-2 focus:ring-sky-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-black mb-1">
                    CPF ou CNPJ do Emitente
                  </label>
                  <input
                    type="text"
                    placeholder="000.000.000-00 ou 00.000.000/0000-00"
                    value={chequeEmitenteDoc}
                    onChange={(e) => setChequeEmitenteDoc(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-black font-semibold outline-none focus:ring-2 focus:ring-sky-600"
                  />
                </div>
              </div>

              {/* Grid 3: Data de Vencimento / Bom Para e Valor do Cheque */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-black mb-1">
                    Data de Vencimento / "Bom para" <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="date"
                    value={chequeVencimento}
                    onChange={(e) => setChequeVencimento(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-black font-semibold outline-none focus:ring-2 focus:ring-sky-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-black mb-1">
                    Valor de Face do Cheque (R$) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={chequeValor || ''}
                    onChange={(e) => setChequeValor(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-black font-black text-base outline-none focus:ring-2 focus:ring-sky-600"
                  />
                </div>
              </div>

              {/* 3. INTERFACE DE COMPARAÇÃO DE VALORES (AVISO DE CRÉDITO) */}
              {chequeGeraCredito && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-950 flex items-start space-x-2.5 shadow-2xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-relaxed">
                    <span className="font-black text-emerald-900 block text-xs">
                      Troco em Crédito Automático Detectado:
                    </span>
                    Atenção: O valor do cheque é maior que a dívida. Um crédito de{' '}
                    <strong className="text-emerald-900 font-black font-['Outfit'] text-xs">
                      {formatCurrencyBRL(diferencaCheque)}
                    </strong>{' '}
                    será gerado automaticamente para a próxima compra deste cliente.
                  </div>
                </div>
              )}

              {/* 2. BOTÃO DE ACESSO À CÂMERA / COMPONENTE DE UPLOAD */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-black mb-1.5">
                  Anexar Imagem / Foto do Cheque Físico
                </label>

                {/* Input escondido para Câmera (Mobile / Tablet) com capture="environment" */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {/* Input escondido para Seleção de Arquivo (Desktop / Galeria) */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/jpg,application/pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {!previewUrl ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* Botão 1: Abrir Câmera */}
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="flex items-center justify-center space-x-2 px-3 py-2.5 rounded-xl border border-sky-400 bg-white hover:bg-sky-50 text-sky-900 font-bold transition cursor-pointer shadow-2xs active:scale-95"
                    >
                      <Camera className="w-4 h-4 text-sky-700" />
                      <span>Tirar Foto (Câmera)</span>
                    </button>

                    {/* Botão 2: Selecionar Arquivo do Computador / Galeria */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center justify-center space-x-2 px-3 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-black font-bold transition cursor-pointer shadow-2xs active:scale-95"
                    >
                      <Upload className="w-4 h-4 text-slate-700" />
                      <span>Selecionar Arquivo</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-2.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-950">
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-lg overflow-hidden border border-emerald-400 bg-white shrink-0 flex items-center justify-center">
                        <img
                          src={previewUrl}
                          alt="Preview do Cheque"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[11px] font-black text-emerald-900 block truncate">
                          {selectedFile?.name || 'cheque_digitalizado.jpg'}
                        </span>
                        <span className="text-[10px] text-emerald-800 font-semibold block">
                          {isUploading ? 'Fazendo upload para o Supabase...' : 'Imagem anexada e pronta para o banco'}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="p-1.5 rounded-lg text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                      title="Remover foto e tirar outra"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
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
              <span>Total do Cheque: <strong className="text-black font-bold font-['Outfit']">{formatCurrencyBRL(chequeValor)}</strong></span>
            ) : (
              <span>Total a Liquidar: <strong className="text-black font-bold font-['Outfit']">{formatCurrencyBRL(valorComAbatimento)}</strong></span>
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
              disabled={isSubmitting || isUploading}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition cursor-pointer shadow-xs flex items-center space-x-1.5 active:scale-95 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Gravando...' : 'Confirmar Recebimento'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
