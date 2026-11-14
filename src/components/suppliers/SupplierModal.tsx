import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Search,
  Loader2,
  ChevronDown,
  CheckCircle2,
  Share2,
  MessageSquare,
  Mail,
  Copy,
  Inbox,
  ExternalLink,
  Building2,
  Settings,
  Printer,
  Package,
  Calendar,
  DollarSign,
  Receipt,
  Plus,
  Trash2,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Save,
} from 'lucide-react';
import { Supplier, SupplierFormSubmission, DocumentoEntradaRecord, Expense } from '../../types';
import {
  formatCpfCnpj,
  formatIE,
  formatCep,
  formatPhone,
  cleanDigits,
  fetchAddressByCep,
  fetchCompanyByCnpj,
} from '../../lib/formatters';
import {
  getSupplierSubmissions,
  findSupplierSubmissionByDocument,
  markSupplierSubmissionImported,
} from '../../lib/supplierSubmissions';
import {
  ClientSelectOption,
  formatCurrencyBRL,
  getStoredSuppliers,
  saveStoredSuppliers,
  ensureSequentialSupplierCodes,
  getNextSupplierCode,
  syncSupplierCodeCounter,
  getStoredSupplierCategoriesCatalog,
  saveStoredSupplierCategoriesCatalog,
  getStoredDocumentosEntrada,
  getStoredExpenses,
  getStoredFiscalRecords,
} from '../../lib/storage';
import { useConfirm } from '../../context/ConfirmContext';
import { ClientOptionsManagerModal } from '../crm/ClientOptionsManagerModal';
import { printSupplierRegistrationA4 } from './supplierPrintUtils';
import { ReverseCepModal } from '../common/ReverseCepModal';

export interface SupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (supplier: Supplier) => void;
  initialName?: string;
  editingSupplier?: Supplier | null;
  zIndexClass?: string;
  suppliersList?: Supplier[];
  onDeleteSupplier?: (supplierId: string) => Promise<boolean | void> | void;
}

const inferSupplierPersonType = (doc?: string, savedType?: 'PF' | 'PJ'): 'PF' | 'PJ' => {
  if (savedType === 'PF' || savedType === 'PJ') return savedType;
  const digits = cleanDigits(doc || '');
  if (digits.length > 0 && digits.length <= 11) return 'PF';
  return 'PJ';
};

interface SupplierHistoryRow {
  id: string;
  docNumber: string;
  date: string;
  description: string;
  naturezaOrCategory: string;
  paymentInfo: string;
  totalValue: number;
  statusLabel: string;
  isPending: boolean;
  sourceLabel: 'NF-e / Entrada' | 'Despesa / Compra';
  itemsSummary: Array<{ descricao: string; quantidade: number; unidade?: string }>;
}

export const SupplierModal: React.FC<SupplierModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialName = '',
  editingSupplier = null,
  zIndexClass = 'z-[9999]',
  suppliersList,
  onDeleteSupplier,
}) => {
  const { confirm } = useConfirm();
  const [activeSupplier, setActiveSupplier] = useState<Supplier | null>(editingSupplier || null);
  const [registrationTimestamp, setRegistrationTimestamp] = useState<string>(new Date().toISOString());
  const [activeTab, setActiveTab] = useState<'cadastro' | 'historico'>('cadastro');
  const [historicoSearch, setHistoricoSearch] = useState('');

  const [localSuppliersSnapshot, setLocalSuppliersSnapshot] = useState<Supplier[]>(() =>
    getStoredSuppliers()
  );

  // Form states
  const [code, setCode] = useState('');
  const [personType, setPersonType] = useState<'PF' | 'PJ'>('PJ');
  const [cnpjOrCpf, setCnpjOrCpf] = useState('');
  const [name, setName] = useState(initialName);
  const [tradeName, setTradeName] = useState('');
  const [isTradeNameManuallyEdited, setIsTradeNameManuallyEdited] = useState(false);
  const [category, setCategory] = useState('');
  const [categoriesCatalog, setCategoriesCatalog] = useState<ClientSelectOption[]>(() =>
    getStoredSupplierCategoriesCatalog()
  );
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [stateRegistration, setStateRegistration] = useState('');
  const [municipalRegistration, setMunicipalRegistration] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [salespersonName, setSalespersonName] = useState('');
  const [salespersonPhone, setSalespersonPhone] = useState('');
  const [defaultPaymentTerm, setDefaultPaymentTerm] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [address, setAddress] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [addressComplement, setAddressComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('PR');
  const [notes, setNotes] = useState('');

  const activeCategories = useMemo(
    () => categoriesCatalog.filter((item) => item.active),
    [categoriesCatalog]
  );

  useEffect(() => {
    const syncCats = () => setCategoriesCatalog(getStoredSupplierCategoriesCatalog());
    window.addEventListener('agrocontrol_fornecedor_categorias_updated', syncCats);
    window.addEventListener('storage', syncCats);
    return () => {
      window.removeEventListener('agrocontrol_fornecedor_categorias_updated', syncCats);
      window.removeEventListener('storage', syncCats);
    };
  }, []);

  useEffect(() => {
    const refreshSnapshot = () => {
      setLocalSuppliersSnapshot(getStoredSuppliers());
    };
    if (isOpen) refreshSnapshot();
    window.addEventListener('storage', refreshSnapshot);
    return () => {
      window.removeEventListener('storage', refreshSnapshot);
    };
  }, [isOpen]);

  const navigableSuppliers = useMemo(() => {
    const source =
      Array.isArray(suppliersList) && suppliersList.length > 0
        ? suppliersList
        : localSuppliersSnapshot;
    return ensureSequentialSupplierCodes(source).items;
  }, [suppliersList, localSuppliersSnapshot]);

  const currentRecordIndex = useMemo(() => {
    if (!activeSupplier) return -1;
    return navigableSuppliers.findIndex((s) => s.id === activeSupplier.id);
  }, [navigableSuppliers, activeSupplier]);

  // Status and feedback
  const [isLoadingCnpj, setIsLoadingCnpj] = useState(false);
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [isReverseCepOpen, setIsReverseCepOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSuccessSaved, setIsSuccessSaved] = useState(false);

  // Share & external form state
  const [isShareDropdownOpen, setIsShareDropdownOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [pendingSubmissions, setPendingSubmissions] = useState<SupplierFormSubmission[]>([]);
  const [isImportDropdownOpen, setIsImportDropdownOpen] = useState(false);

  const getFormUrl = () => {
    if (typeof window === 'undefined') return '';
    const base = window.location.origin + window.location.pathname;
    return `${base}?ficha=fornecedor`;
  };

  const handleShareWhatsApp = () => {
    const link = getFormUrl();
    const message = `Olá! Por favor, preencha os dados cadastrais da sua empresa no AgroControl através deste link: ${link}`;
    const targetDigits = cleanDigits(phone);
    const url =
      targetDigits.length >= 10
        ? `https://api.whatsapp.com/send?phone=55${targetDigits}&text=${encodeURIComponent(message)}`
        : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;

    window.open(url, '_blank', 'noopener,noreferrer');
    setIsShareDropdownOpen(false);
    setFeedback({ type: 'success', message: 'Abrindo WhatsApp com o link do formulário...' });
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleShareEmail = () => {
    const link = getFormUrl();
    const subject = encodeURIComponent('Ficha Cadastral de Fornecedor / Parceiro - AgroControl');
    const body = encodeURIComponent(
      `Olá!\n\nPor favor, preencha seus dados cadastrais no link seguro abaixo para agilizarmos a emissão de ordens de compra e notas fiscais:\n\n${link}\n\nAtenciosamente,\nSetor de Suprimentos & Compras`
    );
    const mailto = email
      ? `mailto:${email}?subject=${subject}&body=${body}`
      : `mailto:?subject=${subject}&body=${body}`;
    window.location.href = mailto;
    setIsShareDropdownOpen(false);
    setFeedback({ type: 'success', message: 'Abrindo aplicativo de e-mail com o link do formulário...' });
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleCopyLink = async () => {
    const link = getFormUrl();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const input = document.createElement('input');
        input.value = link;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      setFeedback({ type: 'success', message: 'Link da ficha em branco copiado para a área de transferência!' });
      setTimeout(() => setFeedback(null), 3500);
    } catch {
      setFeedback({ type: 'error', message: 'Não foi possível copiar o link automaticamente.' });
    }
    setIsShareDropdownOpen(false);
  };

  const resolveCategoryValue = (raw?: string): string => {
    const trimmed = (raw || '').trim();
    if (!trimmed) return '';
    const catalog = getStoredSupplierCategoriesCatalog();
    const match = catalog.find(
      (c) => c.label.toLowerCase() === trimmed.toLowerCase() || c.id.toLowerCase() === trimmed.toLowerCase()
    );
    return match ? match.label : trimmed.toUpperCase();
  };

  const applySubmission = (submission: SupplierFormSubmission) => {
    const upperName = (submission.name || '').toUpperCase();
    const upperTrade = (submission.tradeName || '').toUpperCase();
    if (upperName) setName(upperName);
    if (upperTrade) {
      setTradeName(upperTrade);
      setIsTradeNameManuallyEdited(Boolean(upperTrade && upperTrade !== upperName));
    } else if (upperName && (!isTradeNameManuallyEdited || !tradeName)) {
      setTradeName(upperName);
      setIsTradeNameManuallyEdited(false);
    }
    if (submission.category) setCategory(resolveCategoryValue(submission.category));
    if (submission.cnpjOrCpf) {
      setCnpjOrCpf(formatCpfCnpj(submission.cnpjOrCpf));
      setPersonType(inferSupplierPersonType(submission.cnpjOrCpf));
    }
    if (submission.stateRegistration) setStateRegistration(submission.stateRegistration.toUpperCase());
    if (submission.municipalRegistration) setMunicipalRegistration(submission.municipalRegistration.toUpperCase());
    if (submission.phone) setPhone(formatPhone(submission.phone));
    if (submission.email) setEmail(submission.email.toUpperCase());
    if (submission.salespersonName) setSalespersonName(submission.salespersonName.toUpperCase());
    if (submission.salespersonPhone) setSalespersonPhone(formatPhone(submission.salespersonPhone));
    if (submission.defaultPaymentTerm) setDefaultPaymentTerm(submission.defaultPaymentTerm.toUpperCase());
    if (submission.zipCode) setZipCode(formatCep(submission.zipCode));
    if (submission.address) setAddress(submission.address.toUpperCase());
    if (submission.addressNumber) setAddressNumber(submission.addressNumber.toUpperCase());
    if (submission.addressComplement) setAddressComplement(submission.addressComplement.toUpperCase());
    if (submission.neighborhood) setNeighborhood(submission.neighborhood.toUpperCase());
    if (submission.city) setCity(submission.city.toUpperCase());
    if (submission.state) setState(submission.state.toUpperCase());
    if (submission.notes) setNotes(submission.notes.toUpperCase());

    markSupplierSubmissionImported(submission.id);
    setPendingSubmissions((prev) => prev.filter((s) => s.id !== submission.id));
    setIsImportDropdownOpen(false);

    setFeedback({
      type: 'success',
      message: `Ficha respondida pelo fornecedor "${submission.name.toUpperCase()}" importada com sucesso!`,
    });
    setTimeout(() => setFeedback(null), 4500);
  };

  const loadSupplierIntoForm = (sup: Supplier | null, fallbackName = '') => {
    if (sup) {
      setActiveSupplier(sup);
      const matchedInNav = navigableSuppliers.find((s) => s.id === sup.id);
      const resolvedCode =
        sup.code ||
        sup.codigo ||
        matchedInNav?.code ||
        matchedInNav?.codigo ||
        getNextSupplierCode(navigableSuppliers);
      setCode(resolvedCode);
      setPersonType(inferSupplierPersonType(sup.cnpjOrCpf, sup.personType));
      const upperName = (sup.name || '').toUpperCase();
      const upperTrade = (sup.tradeName || '').toUpperCase();
      setName(upperName);
      setTradeName(upperTrade);
      setIsTradeNameManuallyEdited(Boolean(upperTrade && upperTrade !== upperName));
      setCategory(resolveCategoryValue(sup.category));
      setCnpjOrCpf(sup.cnpjOrCpf ? formatCpfCnpj(sup.cnpjOrCpf) : '');
      setStateRegistration((sup.stateRegistration || '').toUpperCase());
      setMunicipalRegistration((sup.municipalRegistration || '').toUpperCase());
      setPhone(sup.phone ? formatPhone(sup.phone) : '');
      setEmail((sup.email || '').toUpperCase());
      setSalespersonName((sup.salespersonName || '').toUpperCase());
      setSalespersonPhone(sup.salespersonPhone ? formatPhone(sup.salespersonPhone) : '');
      setDefaultPaymentTerm((sup.defaultPaymentTerm || '').toUpperCase());
      setZipCode(sup.zipCode ? formatCep(sup.zipCode) : '');
      setAddress((sup.address || '').toUpperCase());
      setAddressNumber((sup.addressNumber || '').toUpperCase());
      setAddressComplement((sup.addressComplement || '').toUpperCase());
      setNeighborhood((sup.neighborhood || '').toUpperCase());
      setCity((sup.city || '').toUpperCase());
      setState((sup.state || 'PR').toUpperCase());
      setNotes((sup.notes || '').toUpperCase());
    } else {
      setActiveSupplier(null);
      setCode(getNextSupplierCode(navigableSuppliers));
      setPersonType('PJ');
      const upperInit = (fallbackName || '').toUpperCase();
      setName(upperInit);
      setTradeName(upperInit);
      setIsTradeNameManuallyEdited(false);
      setCategory('');
      setCnpjOrCpf('');
      setStateRegistration('');
      setMunicipalRegistration('');
      setPhone('');
      setEmail('');
      setSalespersonName('');
      setSalespersonPhone('');
      setDefaultPaymentTerm('');
      setZipCode('');
      setAddress('');
      setAddressNumber('');
      setAddressComplement('');
      setNeighborhood('');
      setCity('');
      setState('PR');
      setNotes('');
      setRegistrationTimestamp(new Date().toISOString());
    }
  };

  useEffect(() => {
    if (isOpen) {
      setIsSuccessSaved(false);
      setActiveTab('cadastro');
      setHistoricoSearch('');
      try {
        const subs = getSupplierSubmissions();
        setPendingSubmissions(subs.filter((s) => s.status === 'pendente'));
      } catch (err) {
        console.error(err);
      }

      loadSupplierIntoForm(editingSupplier || null, initialName);
      setFeedback(null);
    }
  }, [isOpen, editingSupplier, initialName]);

  const handleNameChange = (rawVal: string) => {
    const upperNew = rawVal.toUpperCase();
    const shouldMirror = !isTradeNameManuallyEdited || tradeName === '' || tradeName === name;
    setName(upperNew);
    if (shouldMirror) {
      setTradeName(upperNew);
      setIsTradeNameManuallyEdited(false);
    }
  };

  const handleTradeNameChange = (rawVal: string) => {
    const upperNew = rawVal.toUpperCase();
    setTradeName(upperNew);
    if (upperNew === '' || upperNew === name) {
      setIsTradeNameManuallyEdited(false);
    } else {
      setIsTradeNameManuallyEdited(true);
    }
  };

  const handleCnpjChange = async (val: string) => {
    const masked = formatCpfCnpj(val);
    setCnpjOrCpf(masked);
    const digits = cleanDigits(val);
    if (digits.length > 0) {
      setPersonType(digits.length > 11 ? 'PJ' : 'PF');
    }
    if (digits.length === 11 || digits.length === 14) {
      await searchCnpj(digits);
    }
  };

  const searchCnpj = async (cnpjDigits?: string) => {
    const digits = cnpjDigits || cleanDigits(cnpjOrCpf);
    if (!digits) {
      setFeedback({ type: 'error', message: 'Digite o CPF ou CNPJ para buscar.' });
      setTimeout(() => setFeedback(null), 3000);
      return;
    }

    // 1. Prioridade: Buscar nas fichas externas preenchidas pelo fornecedor
    const matchedSubmission = findSupplierSubmissionByDocument(digits);
    if (matchedSubmission) {
      applySubmission(matchedSubmission);
      return;
    }

    // 2. Se for 14 dígitos (CNPJ) e não estiver nas fichas, busca na Receita Federal
    if (digits.length === 14) {
      setIsLoadingCnpj(true);
      setFeedback(null);
      try {
        const res = await fetchCompanyByCnpj(digits);
        if (res && res.success) {
          const nextCorp = res.corporateName ? res.corporateName.toUpperCase() : name;
          const nextTrade = res.tradeName ? res.tradeName.toUpperCase() : tradeName;
          if (res.corporateName && !name) setName(nextCorp);
          if (res.tradeName && !tradeName) {
            setTradeName(nextTrade);
            setIsTradeNameManuallyEdited(Boolean(nextTrade && nextTrade !== nextCorp));
          } else if (res.corporateName && !name && (!isTradeNameManuallyEdited || !tradeName)) {
            setTradeName(nextCorp);
            setIsTradeNameManuallyEdited(false);
          }
          if (res.phone && !phone) setPhone(formatPhone(res.phone));
          if (res.email && !email) setEmail(res.email.toUpperCase());
          if (res.zipCode && !zipCode) setZipCode(formatCep(res.zipCode));
          if (res.street && !address) setAddress(res.street.toUpperCase());
          if (res.number && !addressNumber) setAddressNumber(String(res.number).toUpperCase());
          if (res.neighborhood && !neighborhood) setNeighborhood(res.neighborhood.toUpperCase());
          if (res.city && !city) setCity(res.city.toUpperCase());
          if (res.state && !state) setState(res.state.toUpperCase());
          setFeedback({ type: 'success', message: `Dados complementados: ${res.corporateName.toUpperCase()}` });
        }
      } catch {
        // Prossegue offline com os dados manuais
      } finally {
        setIsLoadingCnpj(false);
        setTimeout(() => setFeedback(null), 3000);
      }
      return;
    }

    if (digits.length === 11) {
      setFeedback({ type: 'error', message: 'Nenhuma ficha externa respondida encontrada para este CPF.' });
      setTimeout(() => setFeedback(null), 3000);
      return;
    }

    setFeedback({ type: 'error', message: 'Digite 11 dígitos para CPF ou 14 para CNPJ.' });
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleCepChange = async (val: string) => {
    const masked = formatCep(val);
    setZipCode(masked);
    const digits = cleanDigits(val);
    if (digits.length === 8) {
      await searchCep(digits);
    }
  };

  const searchCep = async (cepDigits?: string) => {
    const digits = cepDigits || cleanDigits(zipCode);
    if (digits.length !== 8) {
      setFeedback({ type: 'error', message: 'Digite um CEP completo com 8 dígitos.' });
      setTimeout(() => setFeedback(null), 3000);
      return;
    }

    setIsLoadingCep(true);
    setFeedback(null);
    try {
      const res = await fetchAddressByCep(digits);
      if (res.success) {
        if (res.street) setAddress(res.street.toUpperCase());
        if (res.neighborhood) setNeighborhood(res.neighborhood.toUpperCase());
        if (res.city) setCity(res.city.toUpperCase());
        if (res.state) setState(res.state.toUpperCase());
        setFeedback({ type: 'success', message: `CEP localizado: ${res.city.toUpperCase()}/${res.state.toUpperCase()}` });
      } else {
        setFeedback({ type: 'error', message: res.message || 'CEP não localizado.' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Erro ao consultar CEP.' });
    } finally {
      setIsLoadingCep(false);
      setTimeout(() => setFeedback(null), 3500);
    }
  };

  // Histórico de Compras / Notas de Entrada vinculadas ao Fornecedor
  const supplierPurchases = useMemo<SupplierHistoryRow[]>(() => {
    if (!activeSupplier) return [];
    try {
      const supId = String(activeSupplier.id || '').trim();
      const supCnpjDigits = cleanDigits(activeSupplier.cnpjOrCpf || '');
      const supNameNorm = (activeSupplier.name || '').trim().toLowerCase();
      const supTradeNorm = (activeSupplier.tradeName || '').trim().toLowerCase();

      const matchesSupplier = (
        recSupId?: string | null,
        recCnpj?: string | null,
        recName?: string | null
      ): boolean => {
        if (supId && recSupId && String(recSupId).trim() === supId) return true;
        const recDigits = cleanDigits(recCnpj || '');
        if (supCnpjDigits && recDigits && supCnpjDigits === recDigits) return true;
        const recNorm = (recName || '').trim().toLowerCase();
        if (!recNorm) return false;
        if (
          supNameNorm &&
          (recNorm === supNameNorm ||
            (supNameNorm.length >= 4 && (recNorm.includes(supNameNorm) || supNameNorm.includes(recNorm))))
        ) {
          return true;
        }
        if (
          supTradeNorm &&
          (recNorm === supTradeNorm ||
            (supTradeNorm.length >= 4 && (recNorm.includes(supTradeNorm) || supTradeNorm.includes(recNorm))))
        ) {
          return true;
        }
        return false;
      };

      const docsEntrada: DocumentoEntradaRecord[] = getStoredDocumentosEntrada();
      const matchedDocs = docsEntrada.filter((d) =>
        matchesSupplier(d.fornecedor_id, d.fornecedor_cnpj, d.fornecedor_nome || d.fornecedor)
      );

      const seenIds = new Set<string>();
      const seenAccessKeys = new Set<string>();
      const seenDocNumbers = new Set<string>();

      const rows: SupplierHistoryRow[] = [];

      for (const doc of matchedDocs) {
        const idStr = String(doc.id || '');
        if (idStr) seenIds.add(idStr);
        const keyStr = String(doc.chave_acesso || '').trim();
        if (keyStr) seenAccessKeys.add(keyStr);
        const docNum = String(doc.numero || doc.numero_documento || doc.id.slice(-6)).trim();
        if (docNum) seenDocNumbers.add(docNum.toLowerCase());

        const items = Array.isArray(doc.itens)
          ? doc.itens.map((it) => ({
              descricao: it.descricao || 'Item de entrada',
              quantidade: Number(it.quantidade || 1),
              unidade: it.unidade || 'UN',
            }))
          : [];

        rows.push({
          id: doc.id,
          docNumber: docNum ? `NF ${docNum}` : 'DOC ENTRADA',
          date: doc.data_emissao || doc.data || doc.data_entrada || '',
          description: doc.descricao || doc.natureza_operacao || doc.tipo_documento || 'Nota de Entrada',
          naturezaOrCategory: doc.tipo_documento || doc.natureza_operacao || 'Documento de Entrada',
          paymentInfo:
            doc.condicao_pagamento ||
            (doc.parcelas_qtd && doc.parcelas_qtd > 1 ? `${doc.parcelas_qtd}x Parcelado` : 'À Vista / Faturado'),
          totalValue: Number(doc.valor_total || 0),
          statusLabel: doc.status === 'Rascunho' ? 'RASCUNHO' : 'FINALIZADO',
          isPending: doc.status === 'Rascunho',
          sourceLabel: 'NF-e / Entrada',
          itemsSummary: items,
        });
      }

      const allExpenses: Expense[] = [...getStoredExpenses(), ...getStoredFiscalRecords()];
      for (const exp of allExpenses) {
        const expId = String(exp.id || '');
        if (!expId || seenIds.has(expId)) continue;

        const expAny = exp as any;
        const expAccessKey = String(expAny.accessKey || expAny.chave_acesso || '').trim();
        if (expAccessKey && seenAccessKeys.has(expAccessKey)) continue;

        const expInv = String(expAny.invoiceNumber || expAny.numero_nota || expAny.documentNumber || '').trim();
        if (expInv && seenDocNumbers.has(expInv.toLowerCase())) continue;

        const expSupId = expAny.supplierId || expAny.fornecedor_id || null;
        const expCnpj = expAny.supplierCnpj || expAny.fornecedor_cnpj || expAny.cnpj || null;
        const expSupName = exp.supplier || expAny.fornecedor || expAny.credor || '';

        if (!matchesSupplier(expSupId, expCnpj, expSupName)) continue;

        seenIds.add(expId);
        if (expAccessKey) seenAccessKeys.add(expAccessKey);
        if (expInv) seenDocNumbers.add(expInv.toLowerCase());

        const amountVal = Number((exp as any).amount ?? (exp as any).valor ?? 0);
        const isPaid = exp.status === 'pago' || exp.status === 'compensado_estoque';
        rows.push({
          id: expId,
          docNumber: expInv ? `DOC ${expInv}` : `DESP-${expId.slice(-5).toUpperCase()}`,
          date: exp.dueDate || exp.date || exp.createdAt || '',
          description: exp.description || 'Compra / Despesa lançada',
          naturezaOrCategory: exp.category || 'Compra / Despesa',
          paymentInfo:
            exp.paymentMethod ||
            (expAny.installments && expAny.installments > 1
              ? `${expAny.installments}x Parcelas`
              : expAny.totalInstallments && expAny.totalInstallments > 1
              ? `${expAny.totalInstallments}x Parcelas`
              : 'Conta a Pagar'),
          totalValue: amountVal,
          statusLabel: isPaid ? 'PAGO / LIQUIDADO' : 'PENDENTE / A PAGAR',
          isPending: !isPaid,
          sourceLabel: 'Despesa / Compra',
          itemsSummary: [],
        });
      }

      return rows.sort((a, b) => {
        const tA = a.date ? new Date(a.date).getTime() : 0;
        const tB = b.date ? new Date(b.date).getTime() : 0;
        return tB - tA;
      });
    } catch (err) {
      console.warn('Erro ao carregar histórico do fornecedor:', err);
      return [];
    }
  }, [activeSupplier, isOpen]);

  const filteredPurchases = useMemo(() => {
    const q = historicoSearch.trim().toLowerCase();
    if (!q) return supplierPurchases;
    return supplierPurchases.filter((row) => {
      const hasItem = row.itemsSummary.some((it) => it.descricao.toLowerCase().includes(q));
      return (
        row.docNumber.toLowerCase().includes(q) ||
        row.description.toLowerCase().includes(q) ||
        row.naturezaOrCategory.toLowerCase().includes(q) ||
        row.paymentInfo.toLowerCase().includes(q) ||
        row.date.toLowerCase().includes(q) ||
        hasItem
      );
    });
  }, [supplierPurchases, historicoSearch]);

  const totalComprado = useMemo(
    () => supplierPurchases.reduce((acc, row) => acc + (Number(row.totalValue) || 0), 0),
    [supplierPurchases]
  );

  const ticketMedio = supplierPurchases.length > 0 ? totalComprado / supplierPurchases.length : 0;

  const dataUltimaCompra = useMemo(() => {
    if (supplierPurchases.length === 0) return '—';
    const rawDate = supplierPurchases[0].date;
    if (!rawDate) return '—';
    try {
      const [y, m, d] = rawDate.split('T')[0].split('-');
      if (y && m && d) return `${d}/${m}/${y}`;
      return rawDate;
    } catch {
      return rawDate;
    }
  }, [supplierPurchases]);

  const handleCancel = () => {
    loadSupplierIntoForm(activeSupplier || null, initialName);
    setFeedback({
      type: 'error',
      message: activeSupplier
        ? 'Alterações revertidas para os dados salvos.'
        : 'Formulário limpo com sucesso.',
    });
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleNewRecord = () => {
    loadSupplierIntoForm(null, '');
    setActiveTab('cadastro');
    setFeedback({ type: 'success', message: 'Formulário pronto para cadastrar um novo fornecedor.' });
    setTimeout(() => setFeedback(null), 2500);
  };

  const handleNavigateRecord = (direction: 'first' | 'prev' | 'next' | 'last') => {
    if (navigableSuppliers.length === 0) return;
    let targetIndex = 0;
    if (direction === 'first') {
      targetIndex = 0;
    } else if (direction === 'last') {
      targetIndex = navigableSuppliers.length - 1;
    } else if (direction === 'prev') {
      targetIndex = currentRecordIndex <= 0 ? 0 : currentRecordIndex - 1;
    } else if (direction === 'next') {
      targetIndex =
        currentRecordIndex < 0
          ? 0
          : Math.min(navigableSuppliers.length - 1, currentRecordIndex + 1);
    }
    const targetSupplier = navigableSuppliers[targetIndex];
    if (targetSupplier) {
      loadSupplierIntoForm(targetSupplier);
      setFeedback(null);
    }
  };

  const handleDeleteRecord = async () => {
    if (!activeSupplier) return;
    const deletedId = activeSupplier.id;

    if (onDeleteSupplier) {
      const result = await onDeleteSupplier(deletedId);
      if (result === false) return;
    } else {
      const isConfirmed = await confirm({
        title: 'Excluir Fornecedor',
        message: `Deseja realmente excluir "${activeSupplier.name}" do cadastro?`,
        confirmLabel: 'Sim, Excluir',
        cancelLabel: 'Cancelar',
        variant: 'danger',
      });
      if (!isConfirmed) return;
    }

    try {
      const remaining = navigableSuppliers.filter((s) => s.id !== deletedId);
      setLocalSuppliersSnapshot(remaining);
      saveStoredSuppliers(remaining);
      window.dispatchEvent(new Event('storage'));
    } catch (err) {
      console.warn('Erro ao remover fornecedor do localStorage:', err);
    }

    const remainingList = navigableSuppliers.filter((s) => s.id !== deletedId);
    if (remainingList.length > 0) {
      const nextIdx = Math.min(Math.max(0, currentRecordIndex), remainingList.length - 1);
      loadSupplierIntoForm(remainingList[nextIdx]);
      setFeedback({ type: 'success', message: 'Fornecedor excluído. Exibindo próximo registro.' });
      setTimeout(() => setFeedback(null), 3000);
    } else {
      onClose();
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const upperName = name.trim().toUpperCase();
    if (!upperName) {
      setActiveTab('cadastro');
      setFeedback({ type: 'error', message: 'POR FAVOR, INFORME A RAZÃO SOCIAL OU NOME DO FORNECEDOR.' });
      setTimeout(() => setFeedback(null), 3500);
      return;
    }

    const now = new Date().toISOString();
    const isEditing = !!activeSupplier;
    const supplierId = activeSupplier?.id || `sup_${Date.now()}`;
    const finalCode = (
      code ||
      activeSupplier?.code ||
      activeSupplier?.codigo ||
      getNextSupplierCode(navigableSuppliers)
    ).trim();

    const upperTradeName = tradeName.trim() ? tradeName.trim().toUpperCase() : undefined;
    const upperCategory = category.trim() ? category.trim().toUpperCase() : '';
    const upperCnpjOrCpf = cnpjOrCpf.trim() ? cnpjOrCpf.trim().toUpperCase() : undefined;
    const upperStateReg = stateRegistration.trim() ? stateRegistration.trim().toUpperCase() : undefined;
    const upperMunReg = municipalRegistration.trim() ? municipalRegistration.trim().toUpperCase() : undefined;
    const upperPhone = phone.trim() ? phone.trim().toUpperCase() : '';
    const upperEmail = email.trim() ? email.trim().toUpperCase() : undefined;
    const upperSalespersonName = salespersonName.trim() ? salespersonName.trim().toUpperCase() : undefined;
    const upperSalespersonPhone = salespersonPhone.trim() ? salespersonPhone.trim().toUpperCase() : undefined;
    const upperDefaultPaymentTerm = defaultPaymentTerm.trim()
      ? defaultPaymentTerm.trim().toUpperCase()
      : undefined;
    const upperZip = zipCode.trim() ? zipCode.trim().toUpperCase() : undefined;
    const upperAddress = address.trim() ? address.trim().toUpperCase() : undefined;
    const upperAddressNumber = addressNumber.trim() ? addressNumber.trim().toUpperCase() : undefined;
    const upperAddressComplement = addressComplement.trim()
      ? addressComplement.trim().toUpperCase()
      : undefined;
    const upperNeighborhood = neighborhood.trim() ? neighborhood.trim().toUpperCase() : undefined;
    const upperCity = city.trim() ? city.trim().toUpperCase() : undefined;
    const upperState = state.trim() ? state.trim().toUpperCase() : 'PR';
    const upperNotes = notes.trim() ? notes.trim().toUpperCase() : undefined;

    const savedSupplier: Supplier = {
      id: supplierId,
      code: finalCode,
      codigo: finalCode,
      personType,
      name: upperName,
      tradeName: upperTradeName,
      category: upperCategory,
      cnpjOrCpf: upperCnpjOrCpf,
      stateRegistration: upperStateReg,
      municipalRegistration: upperMunReg,
      phone: upperPhone,
      email: upperEmail,
      salespersonName: upperSalespersonName,
      salespersonPhone: upperSalespersonPhone,
      defaultPaymentTerm: upperDefaultPaymentTerm,
      zipCode: upperZip,
      address: upperAddress,
      addressNumber: upperAddressNumber,
      addressComplement: upperAddressComplement,
      neighborhood: upperNeighborhood,
      city: upperCity,
      state: upperState,
      notes: upperNotes,
      createdAt: activeSupplier?.createdAt || registrationTimestamp,
      updatedAt: isEditing ? now : undefined,
    };

    syncSupplierCodeCounter(finalCode, navigableSuppliers);

    try {
      const currentSuppliers = getStoredSuppliers();
      const digitsNew = cleanDigits(savedSupplier.cnpjOrCpf || '');
      const existingIdx = currentSuppliers.findIndex(
        (s) =>
          s.id === savedSupplier.id ||
          (digitsNew && cleanDigits(s.cnpjOrCpf || '') === digitsNew) ||
          (s.name && s.name.trim().toUpperCase() === savedSupplier.name)
      );

      let updatedList: Supplier[];
      if (existingIdx >= 0) {
        updatedList = [...currentSuppliers];
        updatedList[existingIdx] = {
          ...currentSuppliers[existingIdx],
          ...savedSupplier,
        };
      } else {
        updatedList = [savedSupplier, ...currentSuppliers];
      }

      const normalized = ensureSequentialSupplierCodes(updatedList).items;
      saveStoredSuppliers(normalized);
      setLocalSuppliersSnapshot(normalized);
      window.dispatchEvent(new Event('storage'));
    } catch (err) {
      console.error('Erro na persistência de fornecedores no LocalStorage:', err);
    }

    onSave(savedSupplier);
    setCode(finalCode);
    setActiveSupplier(savedSupplier);

    setIsSuccessSaved(true);
    setFeedback({
      type: 'success',
      message: isEditing
        ? 'FORNECEDOR ATUALIZADO E SALVO COM SUCESSO!'
        : 'FORNECEDOR CADASTRADO E SALVO COM SUCESSO!',
    });

    // Se aberto a partir de fluxo inline (NF-e / Despesa, sem suppliersList), fecha automaticamente em 900ms;
    // Se aberto no módulo de Fornecedores (com suppliersList), permanece aberto para navegação/impressão/novo.
    if (!Array.isArray(suppliersList)) {
      setTimeout(() => {
        setIsSuccessSaved(false);
        onClose();
      }, 900);
    } else {
      setTimeout(() => {
        setIsSuccessSaved(false);
      }, 600);
      setTimeout(() => {
        setFeedback(null);
      }, 4000);
    }
  };

  const formatDateTimeBR = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return null;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch {
      return null;
    }
  };

  const handlePrintFicha = () => {
    void printSupplierRegistrationA4({
      id: activeSupplier?.id || '',
      code: code || activeSupplier?.code || activeSupplier?.codigo || undefined,
      personType,
      name: name.trim(),
      tradeName: tradeName.trim() || undefined,
      category: category.trim(),
      cnpjOrCpf: cnpjOrCpf.trim() || undefined,
      stateRegistration: stateRegistration.trim() || undefined,
      municipalRegistration: municipalRegistration.trim() || undefined,
      phone: phone.trim(),
      email: email.trim() || undefined,
      salespersonName: salespersonName.trim() || undefined,
      salespersonPhone: salespersonPhone.trim() || undefined,
      defaultPaymentTerm: defaultPaymentTerm.trim() || undefined,
      zipCode: zipCode.trim() || undefined,
      address: address.trim() || undefined,
      addressNumber: addressNumber.trim() || undefined,
      addressComplement: addressComplement.trim() || undefined,
      neighborhood: neighborhood.trim() || undefined,
      city: city.trim() || undefined,
      state: state.trim() || undefined,
      notes: notes.trim() || undefined,
    }).then((opened) => {
      if (!opened) {
        setFeedback({
          type: 'error',
          message: 'Permita pop-ups neste navegador para imprimir a ficha cadastral.',
        });
        setTimeout(() => setFeedback(null), 4000);
      }
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 ${zIndexClass} flex items-center justify-center p-2 sm:p-4 bg-zinc-950/70 backdrop-blur-xs overflow-hidden`}
    >
      <div className="w-full max-w-[80vw] max-h-[92vh] flex flex-col justify-between mx-auto my-auto bg-[#cad4e6] border border-black rounded-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header - Tema Oficial #cad4e6 + border-black */}
        <div className="px-4 sm:px-5 py-2.5 bg-[#cad4e6] text-slate-900 flex items-center justify-between border-b border-black relative rounded-t-lg shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white text-slate-900 flex items-center justify-center border border-black shadow-2xs shrink-0">
              <Building2 className="w-4 h-4 text-slate-900" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-900">
                {activeSupplier ? 'EDITAR FORNECEDOR' : 'CADASTRO DE FORNECEDOR'}
              </h3>
              <p className="text-[11px] text-slate-800 font-medium">
                {activeSupplier
                  ? `Gerenciamento de ficha comercial, dados fiscais e notas de entrada`
                  : 'Pessoa jurídica ou física, dados fiscais, bancários e contato'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Botão Imprimir Ficha */}
            <button
              type="button"
              onClick={handlePrintFicha}
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-900 text-[11px] font-bold transition cursor-pointer border border-black shadow-2xs"
              title="Imprimir Ficha Cadastral do Fornecedor (A4)"
            >
              <Printer className="w-3.5 h-3.5 text-slate-900" />
              <span className="uppercase">Imprimir Ficha</span>
            </button>

            {/* Botão Enviar Ficha em Branco com Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsShareDropdownOpen(!isShareDropdownOpen)}
                className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-900 text-[11px] font-bold transition cursor-pointer border border-black shadow-2xs"
                title="Enviar link do formulário de cadastro em branco para o fornecedor"
              >
                <Share2 className="w-3.5 h-3.5 text-slate-900" />
                <span className="uppercase">Enviar Ficha em Branco</span>
                <ChevronDown
                  className={`w-3 h-3 transition-transform duration-150 ${isShareDropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isShareDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsShareDropdownOpen(false)} />
                  <div className="absolute right-0 mt-2 w-64 bg-white text-zinc-900 rounded-xl shadow-2xl border border-black z-20 overflow-hidden py-1.5 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3.5 py-1.5 border-b border-zinc-200 bg-zinc-50">
                      <p className="text-[10px] font-bold text-zinc-700 uppercase tracking-wider">
                        Compartilhar Ficha de Fornecedor
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleShareWhatsApp}
                      className="w-full px-3.5 py-2.5 text-left text-xs sm:text-sm font-medium hover:bg-emerald-50 text-zinc-800 hover:text-emerald-900 flex items-center space-x-2.5 transition cursor-pointer"
                    >
                      <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
                        <MessageSquare className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1">
                        <span className="font-bold block">Enviar por WhatsApp</span>
                        <span className="text-[10px] text-zinc-500 block">Link pronto com mensagem</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={handleShareEmail}
                      className="w-full px-3.5 py-2.5 text-left text-xs sm:text-sm font-medium hover:bg-zinc-100 text-zinc-800 flex items-center space-x-2.5 transition cursor-pointer"
                    >
                      <div className="w-6 h-6 rounded-full bg-zinc-100 text-zinc-700 flex items-center justify-center flex-shrink-0">
                        <Mail className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1">
                        <span className="font-bold block">Enviar por E-mail</span>
                        <span className="text-[10px] text-zinc-500 block">Dispara via seu cliente de e-mail</span>
                      </div>
                    </button>

                    <div className="my-1 border-t border-stone-100" />

                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="w-full px-3.5 py-2 text-left text-xs font-medium hover:bg-stone-100 text-stone-700 flex items-center space-x-2.5 transition cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5 text-stone-500" />
                      <span>{copiedLink ? 'Link copiado!' : 'Copiar Link da Ficha'}</span>
                    </button>

                    <a
                      href={getFormUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full px-3.5 py-2 text-left text-xs font-medium hover:bg-stone-100 text-stone-700 flex items-center space-x-2.5 transition cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-stone-500" />
                      <span>Visualizar Ficha Externa</span>
                    </a>
                  </div>
                </>
              )}
            </div>

            {/* Fechar Modal no X */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-900 border border-black transition cursor-pointer"
              title="Fechar janela"
            >
              <X className="w-4 h-4 text-slate-900" />
            </button>
          </div>
        </div>

        {/* Feedback Toast */}
        {feedback && (
          <div
            className={`px-5 py-2.5 text-xs sm:text-sm font-black uppercase tracking-wide text-white flex items-center justify-between shadow-md transition animate-in fade-in slide-in-from-top-1 duration-150 shrink-0 ${
              feedback.type === 'success' ? 'bg-[#059669]' : 'bg-rose-600'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              {feedback.type === 'success' && (
                <CheckCircle2 className="w-5 h-5 text-white flex-shrink-0 animate-in zoom-in" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-white/80 hover:text-white px-2 py-0.5 rounded-sm hover:bg-white/20 transition cursor-pointer font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Sub-Abas Superiores - Tema Oficial #cad4e6 + border-black */}
        <div className="px-4 sm:px-5 pt-2 bg-[#cad4e6] border-b border-black flex items-center space-x-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('cadastro')}
            className={`px-3.5 sm:px-4 py-1.5 text-xs font-bold uppercase rounded-t-lg border-t border-x transition flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'cadastro'
                ? 'bg-[#e0e6f1] text-slate-900 border-black -mb-px pb-2 shadow-xs'
                : 'bg-[#cad4e6] hover:bg-[#dce3f0] text-slate-800 border-transparent hover:text-black'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-slate-900" />
            <span>DADOS CADASTRAIS</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('historico')}
            className={`px-3.5 sm:px-4 py-1.5 text-xs font-bold uppercase rounded-t-lg border-t border-x transition flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'historico'
                ? 'bg-[#e0e6f1] text-slate-900 border-black -mb-px pb-2 shadow-xs'
                : 'bg-[#cad4e6] hover:bg-[#dce3f0] text-slate-800 border-transparent hover:text-black'
            }`}
          >
            <Package className="w-3.5 h-3.5 text-emerald-700" />
            <span>HISTÓRICO DE COMPRAS / NOTAS</span>
            <span
              className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === 'historico'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-slate-900 border border-gray-400'
              }`}
            >
              {supplierPurchases.length}
            </span>
          </button>
        </div>

        {/* ABA 1: DADOS CADASTRAIS */}
        {activeTab === 'cadastro' && (
          <form
            id="supplier-modal-form"
            onSubmit={handleSubmit}
            className="p-3 sm:p-4 space-y-2.5 bg-[#cad4e6] overflow-y-auto scrollbar-none flex-1 text-slate-900"
          >
            {/* Card 1: Identificação (PF/PJ + Código + Auto-Busca + Contato Principal) */}
            <div className="bg-[#e0e6f1] p-3 sm:p-3.5 rounded-xl border border-black shadow-2xs space-y-2.5">
              {/* Barra Superior do Card 1: Seletor PF / PJ */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-slate-400/70">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-900 uppercase tracking-wider">
                    TIPO DE FORNECEDOR:
                  </span>
                  <div className="inline-flex items-center bg-white border border-black rounded-lg p-0.5 gap-0.5">
                    <button
                      type="button"
                      onClick={() => setPersonType('PF')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase transition flex items-center gap-1.5 cursor-pointer ${
                        personType === 'PF'
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'text-slate-800 hover:bg-slate-100'
                      }`}
                    >
                      <span
                        className={`w-2.5 h-2.5 rounded-full border flex items-center justify-center ${
                          personType === 'PF' ? 'border-white bg-emerald-400' : 'border-slate-500 bg-white'
                        }`}
                      />
                      <span>Pessoa Física</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPersonType('PJ')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase transition flex items-center gap-1.5 cursor-pointer ${
                        personType === 'PJ'
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'text-slate-800 hover:bg-slate-100'
                      }`}
                    >
                      <span
                        className={`w-2.5 h-2.5 rounded-full border flex items-center justify-center ${
                          personType === 'PJ' ? 'border-white bg-emerald-400' : 'border-slate-500 bg-white'
                        }`}
                      />
                      <span>Pessoa Jurídica</span>
                    </button>
                  </div>
                </div>
                <span className="text-[10px] font-semibold text-slate-700">
                  Detecção automática ao digitar CPF (11 dígitos) ou CNPJ (14 dígitos)
                </span>
              </div>

              {/* Linha 1: Código Sequencial, CNPJ/CPF (Auto-Busca), Razão Social / Nome, Nome Fantasia */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 sm:gap-3">
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1 truncate">
                    CÓDIGO
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={code}
                    title="Código sequencial automático do fornecedor"
                    className="w-full px-2.5 py-1.5 rounded-xl border border-gray-400 bg-slate-100 text-slate-900 text-xs sm:text-sm font-mono font-black tracking-wider text-center focus:outline-none cursor-default select-all"
                  />
                </div>

                <div className="col-span-1 md:col-span-3">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider truncate">
                      {personType === 'PJ' ? 'CNPJ (AUTO-BUSCA)' : 'CPF (AUTO-BUSCA)'}
                    </label>

                    <div className="flex items-center space-x-1.5">
                      {pendingSubmissions.length > 0 && (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setIsImportDropdownOpen(!isImportDropdownOpen)}
                            className="text-[10px] font-bold bg-zinc-900 hover:bg-zinc-800 text-white px-2 py-0.5 rounded-md transition flex items-center space-x-1 cursor-pointer shadow-xs uppercase"
                            title="Fichas preenchidas online aguardando importação"
                          >
                            <Inbox className="w-3 h-3 text-amber-300" />
                            <span>
                              {pendingSubmissions.length} FICHA{pendingSubmissions.length > 1 ? 'S' : ''}
                            </span>
                          </button>

                          {isImportDropdownOpen && (
                            <>
                              <div
                                className="fixed inset-0 z-10"
                                onClick={() => setIsImportDropdownOpen(false)}
                              />
                              <div className="absolute left-0 mt-1 w-64 bg-white text-zinc-900 rounded-xl shadow-xl border border-black z-20 overflow-hidden py-1">
                                <div className="px-3 py-1.5 border-b border-zinc-200 bg-zinc-50">
                                  <p className="text-[10px] font-bold text-zinc-700 uppercase">
                                    Fichas Online Recebidas
                                  </p>
                                </div>
                                <div className="max-h-48 overflow-y-auto divide-y divide-zinc-200">
                                  {pendingSubmissions.map((sub) => (
                                    <button
                                      key={sub.id}
                                      type="button"
                                      onClick={() => applySubmission(sub)}
                                      className="w-full px-3 py-2 text-left hover:bg-zinc-50 transition flex flex-col cursor-pointer"
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="font-bold text-xs text-zinc-900">{sub.name}</span>
                                        <span className="text-[10px] text-zinc-500">
                                          {sub.city}/{sub.state}
                                        </span>
                                      </div>
                                      <span className="text-[11px] text-zinc-600 font-medium">
                                        {sub.tradeName || sub.category}
                                      </span>
                                      <span className="text-[10px] text-zinc-500">
                                        {sub.cnpjOrCpf || sub.phone}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {isLoadingCnpj && (
                        <span className="text-[10px] text-slate-900 font-bold flex items-center space-x-1 uppercase">
                          <Loader2 className="w-3 h-3 animate-spin text-slate-900" />
                          <span>BUSCANDO...</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={cnpjOrCpf}
                      onChange={(e) => handleCnpjChange(e.target.value)}
                      placeholder={personType === 'PJ' ? '00.000.000/0000-00' : '000.000.000-00'}
                      maxLength={18}
                      className="w-full px-3 py-1.5 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-600 pr-8"
                    />
                    <button
                      type="button"
                      onClick={() => searchCnpj()}
                      disabled={isLoadingCnpj}
                      title="Buscar dados deste fornecedor na Receita ou importar ficha"
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-700 hover:text-black rounded-md transition cursor-pointer"
                    >
                      <Search className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Razão Social / Nome */}
                <div className="col-span-1 md:col-span-4">
                  <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1 truncate">
                    {personType === 'PJ' ? 'RAZÃO SOCIAL / NOME' : 'NOME COMPLETO / FORNECEDOR'}{' '}
                    <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium uppercase focus:outline-none focus:ring-2 focus:ring-slate-600"
                  />
                </div>

                <div className="col-span-1 md:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1 truncate">
                    {personType === 'PJ' ? 'NOME FANTASIA' : 'NOME FANTASIA / APELIDO'}
                  </label>
                  <input
                    type="text"
                    value={tradeName}
                    onChange={(e) => handleTradeNameChange(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium uppercase focus:outline-none focus:ring-2 focus:ring-slate-600"
                  />
                </div>
              </div>

              {/* Linha 2: Categoria Principal (com ⚙️), IE/RG, IM, WhatsApp / Telefone e E-mail Comercial / Fiscal */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-2.5 sm:gap-3">
                <div className="md:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1 truncate">
                    CATEGORIA PRINCIPAL
                  </label>
                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1 min-w-0">
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full h-[34px] px-3 text-xs sm:text-sm rounded-xl border border-gray-400 bg-white text-black focus:outline-none focus:ring-2 focus:ring-slate-600 font-medium appearance-none pr-8 cursor-pointer truncate"
                      >
                        <option value="">Selecione a categoria...</option>
                        {activeCategories.map((cat) => (
                          <option key={cat.id} value={cat.label}>
                            {cat.label}
                          </option>
                        ))}
                        {category &&
                          !activeCategories.some(
                            (cat) => cat.label.toLowerCase() === category.trim().toLowerCase()
                          ) && <option value={category}>{category}</option>}
                      </select>
                      <ChevronDown className="w-4 h-4 text-slate-700 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsCategoryManagerOpen(true)}
                      className="h-[34px] w-[34px] flex items-center justify-center bg-white hover:bg-slate-100 text-black border border-gray-400 rounded-xl transition cursor-pointer shrink-0"
                      title="Gerenciar opções de Categoria Principal"
                    >
                      <Settings className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1 truncate">
                    {personType === 'PJ' ? 'INSCRIÇÃO ESTADUAL (IE)' : 'RG / IDENTIDADE'}
                  </label>
                  <input
                    type="text"
                    value={stateRegistration}
                    onChange={(e) =>
                      setStateRegistration(
                        personType === 'PJ'
                          ? formatIE(e.target.value).toUpperCase()
                          : e.target.value.toUpperCase()
                      )
                    }
                    placeholder={personType === 'PJ' ? 'IE ou Isento' : 'Nº do RG'}
                    maxLength={18}
                    className="w-full px-3 py-1.5 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium uppercase placeholder:normal-case placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-600"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1 truncate">
                    INSCRIÇÃO MUNICIPAL (IM)
                  </label>
                  <input
                    type="text"
                    value={municipalRegistration}
                    onChange={(e) => setMunicipalRegistration(e.target.value.toUpperCase())}
                    maxLength={20}
                    className="w-full px-3 py-1.5 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium uppercase focus:outline-none focus:ring-2 focus:ring-slate-600"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1 truncate">
                    WHATSAPP / TELEFONE
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    maxLength={15}
                    placeholder="(00) 00000-0000"
                    className="w-full px-3 py-1.5 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-600"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1 truncate">
                    E-MAIL COMERCIAL / FISCAL
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value.toUpperCase())}
                    placeholder="fornecedor@empresa.com — pedidos/NF-e"
                    className="w-full px-3 py-1.5 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium uppercase placeholder:normal-case placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-600"
                  />
                </div>
              </div>
            </div>

            {/* Card 2: Endereço & Localização */}
            <div className="bg-[#e0e6f1] p-3 sm:p-3.5 rounded-xl border border-black shadow-2xs space-y-2.5">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 sm:gap-3">
                <div className="col-span-1 md:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider">
                      CEP
                    </label>
                    {isLoadingCep && (
                      <span className="text-[10px] text-slate-900 font-bold flex items-center space-x-1 uppercase">
                        <Loader2 className="w-3 h-3 animate-spin text-slate-900" />
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={zipCode}
                      onChange={(e) => handleCepChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && cleanDigits(zipCode).length === 8) {
                          e.preventDefault();
                          void searchCep();
                        }
                      }}
                      placeholder="00000-000"
                      maxLength={9}
                      className="w-full px-2.5 py-1.5 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-600 pr-7"
                    />
                    <button
                      type="button"
                      onClick={() => setIsReverseCepOpen(true)}
                      disabled={isLoadingCep}
                      title="Não sabe o CEP? Clique para buscar por Cidade e Rua"
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-slate-700 hover:text-black rounded-md transition cursor-pointer"
                    >
                      <Search className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="col-span-1 md:col-span-5">
                  <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">
                    ENDEREÇO / LOGRADOURO
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value.toUpperCase())}
                    placeholder="RUA, AVENIDA OU RODOVIA..."
                    className="w-full px-3 py-1.5 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium uppercase placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-600"
                  />
                </div>

                <div className="col-span-1 md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1 truncate">
                    NÚMERO / S/N
                  </label>
                  <input
                    type="text"
                    value={addressNumber}
                    onChange={(e) => setAddressNumber(e.target.value.toUpperCase())}
                    placeholder="EX: 120 OU S/N"
                    className="w-full px-3 py-1.5 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium uppercase placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-600"
                  />
                </div>

                <div className="col-span-1 md:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1 truncate">
                    COMPLEMENTO
                  </label>
                  <input
                    type="text"
                    value={addressComplement}
                    onChange={(e) => setAddressComplement(e.target.value.toUpperCase())}
                    placeholder="SALA, GALPÃO, KM 05..."
                    className="w-full px-3 py-1.5 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium uppercase placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-2.5 sm:gap-3">
                <div className="col-span-1 md:col-span-5">
                  <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">
                    BAIRRO / COMUNIDADE
                  </label>
                  <input
                    type="text"
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value.toUpperCase())}
                    className="w-full px-3 py-1.5 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium uppercase focus:outline-none focus:ring-2 focus:ring-slate-600"
                  />
                </div>

                <div className="col-span-1 md:col-span-5">
                  <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">
                    CIDADE
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value.toUpperCase())}
                    className="w-full px-3 py-1.5 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium uppercase focus:outline-none focus:ring-2 focus:ring-slate-600"
                  />
                </div>

                <div className="col-span-1 md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">
                    ESTADO (UF)
                  </label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value.toUpperCase())}
                    maxLength={2}
                    className="w-full px-3 py-1.5 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium uppercase focus:outline-none focus:ring-2 focus:ring-slate-600"
                  />
                </div>
              </div>
            </div>

            {/* Card 3: Contato Comercial, Condições & Observações */}
            <div className="bg-[#e0e6f1] p-3 sm:p-3.5 rounded-xl border border-black shadow-2xs space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-2.5 sm:gap-3">
                <div className="col-span-1 md:col-span-4">
                  <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">
                    NOME DO VENDEDOR / REPRESENTANTE
                  </label>
                  <input
                    type="text"
                    value={salespersonName}
                    onChange={(e) => setSalespersonName(e.target.value.toUpperCase())}
                    placeholder="EX: CARLOS SILVA"
                    className="w-full px-3 py-1.5 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium uppercase placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-600"
                  />
                </div>

                <div className="col-span-1 md:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">
                    WHATSAPP DIRETO DO VENDEDOR
                  </label>
                  <input
                    type="text"
                    value={salespersonPhone}
                    onChange={(e) => setSalespersonPhone(formatPhone(e.target.value))}
                    maxLength={15}
                    placeholder="(00) 00000-0000"
                    className="w-full px-3 py-1.5 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-600"
                  />
                </div>

                <div className="col-span-1 md:col-span-5">
                  <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">
                    CONDIÇÃO DE PAGAMENTO / PRAZO PADRÃO
                  </label>
                  <input
                    type="text"
                    value={defaultPaymentTerm}
                    onChange={(e) => setDefaultPaymentTerm(e.target.value.toUpperCase())}
                    placeholder="Ex: Boleto 28/56 dias, PIX à vista..."
                    className="w-full px-3 py-1.5 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium uppercase placeholder:normal-case placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">
                  OBSERVAÇÕES / DADOS BANCÁRIOS / PIX
                </label>
                <textarea
                  rows={1}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value.toUpperCase())}
                  placeholder="Banco, Agência, Conta, Chave PIX ou observações comerciais..."
                  className="w-full px-3 py-1.5 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium uppercase placeholder:normal-case placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-600 resize-none h-10 sm:h-11 leading-snug"
                />
              </div>
            </div>
          </form>
        )}

        {/* ABA 2: HISTÓRICO DE COMPRAS / NOTAS */}
        {activeTab === 'historico' && (
          <div className="p-3 sm:p-4 bg-[#cad4e6] overflow-y-auto scrollbar-none flex-1 flex flex-col space-y-3">
            {/* 4 Cards de Resumo */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
              <div className="bg-[#e0e6f1] p-3 rounded-xl border border-black shadow-2xs">
                <div className="flex items-center justify-between text-slate-900 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider">TOTAL COMPRADO</span>
                  <DollarSign className="w-3.5 h-3.5 text-emerald-700" />
                </div>
                <p className="text-base sm:text-lg font-black text-slate-950 truncate">
                  {formatCurrencyBRL(totalComprado)}
                </p>
              </div>

              <div className="bg-[#e0e6f1] p-3 rounded-xl border border-black shadow-2xs">
                <div className="flex items-center justify-between text-slate-900 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider">NOTAS / PEDIDOS</span>
                  <Package className="w-3.5 h-3.5 text-blue-700" />
                </div>
                <p className="text-base sm:text-lg font-black text-slate-950">
                  {supplierPurchases.length}
                </p>
              </div>

              <div className="bg-[#e0e6f1] p-3 rounded-xl border border-black shadow-2xs">
                <div className="flex items-center justify-between text-slate-900 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider">TICKET MÉDIO</span>
                  <Receipt className="w-3.5 h-3.5 text-amber-700" />
                </div>
                <p className="text-base sm:text-lg font-black text-slate-950 truncate">
                  {formatCurrencyBRL(ticketMedio)}
                </p>
              </div>

              <div className="bg-[#e0e6f1] p-3 rounded-xl border border-black shadow-2xs">
                <div className="flex items-center justify-between text-slate-900 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider">ÚLTIMA COMPRA</span>
                  <Calendar className="w-3.5 h-3.5 text-slate-700" />
                </div>
                <p className="text-base sm:text-lg font-black text-slate-950">
                  {dataUltimaCompra}
                </p>
              </div>
            </div>

            {/* Filtro de Busca no Histórico */}
            <div className="bg-[#e0e6f1] p-2.5 rounded-xl border border-black shadow-2xs flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={historicoSearch}
                  onChange={(e) => setHistoricoSearch(e.target.value)}
                  placeholder="Filtrar por nº da nota, produto, descrição, condição ou data..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-gray-400 bg-white text-black text-xs font-medium placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-600"
                />
              </div>
            </div>

            {/* Tabela de Notas de Entrada / Compras */}
            <div className="flex-1">
              {!activeSupplier ? (
                <div className="bg-[#e0e6f1] p-8 rounded-xl border border-black text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-white border border-black text-slate-700 mx-auto flex items-center justify-center">
                    <Package className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Salve o fornecedor primeiro para visualizar o histórico
                  </p>
                  <p className="text-[11px] text-slate-800 max-w-md mx-auto">
                    Após cadastrar o fornecedor, todas as notas de entrada e contas a pagar vinculadas aparecerão automaticamente aqui.
                  </p>
                </div>
              ) : filteredPurchases.length === 0 ? (
                <div className="bg-[#e0e6f1] p-8 rounded-xl border border-black text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-white border border-black text-slate-700 mx-auto flex items-center justify-center">
                    <Package className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Nenhuma nota ou compra registrada para este fornecedor
                  </p>
                  <p className="text-[11px] text-slate-800 max-w-md mx-auto">
                    As notas fiscais de entrada (NF-e / XML / Lançamento Manual) e compras lançadas no Contas a Pagar serão exibidas aqui.
                  </p>
                </div>
              ) : (
                <div className="bg-[#e0e6f1] p-2 rounded-xl border border-black overflow-hidden shadow-2xs">
                  <div className="bg-white rounded-lg border border-gray-400 overflow-x-auto max-h-[46vh]">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 z-10 bg-slate-100">
                        <tr className="border-b border-gray-400 text-[10px] font-bold text-slate-900 uppercase tracking-wider">
                          <th className="py-2.5 px-3">Nº Nota / Doc</th>
                          <th className="py-2.5 px-3">Data</th>
                          <th className="py-2.5 px-3">Descrição / Itens</th>
                          <th className="py-2.5 px-3">Condição / Origem</th>
                          <th className="py-2.5 px-3 text-right">Valor Total</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 text-xs">
                        {filteredPurchases.map((row) => {
                          const dateDisplay = (() => {
                            if (!row.date) return '—';
                            try {
                              const parts = row.date.split('T')[0].split('-');
                              if (parts.length === 3) {
                                return `${parts[2]}/${parts[1]}/${parts[0]}`;
                              }
                              return row.date;
                            } catch {
                              return row.date;
                            }
                          })();

                          return (
                            <tr key={row.id} className="hover:bg-slate-50 transition">
                              <td className="py-2.5 px-3 font-mono font-bold text-[11px] text-zinc-900 whitespace-nowrap">
                                <span className="px-1.5 py-0.5 rounded bg-zinc-100 border border-zinc-300">
                                  {row.docNumber}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-[11px] text-zinc-700 whitespace-nowrap font-medium">
                                {dateDisplay}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="font-bold text-zinc-900 text-[11px] truncate max-w-xs">
                                  {row.description}
                                </div>
                                {row.itemsSummary.length > 0 && (
                                  <div className="mt-1 space-y-0.5">
                                    {row.itemsSummary.slice(0, 3).map((it, idx) => (
                                      <div
                                        key={idx}
                                        className="flex items-center space-x-1.5 text-[10.5px] text-zinc-700"
                                      >
                                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                        <span className="font-bold text-zinc-900">
                                          {it.quantidade} {it.unidade || 'UN'}
                                        </span>
                                        <span className="text-zinc-400">•</span>
                                        <span className="truncate max-w-[240px]">{it.descricao}</span>
                                      </div>
                                    ))}
                                    {row.itemsSummary.length > 3 && (
                                      <span className="text-[10px] text-slate-600 font-semibold">
                                        + {row.itemsSummary.length - 3} item(ns) adicional(is)
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-[11px] text-zinc-800 font-medium">
                                <div className="truncate max-w-[160px] font-semibold">
                                  {row.paymentInfo}
                                </div>
                                <div className="text-[10px] text-slate-500">{row.sourceLabel}</div>
                              </td>
                              <td className="py-2.5 px-3 text-right font-black text-xs text-zinc-900 whitespace-nowrap">
                                {formatCurrencyBRL(row.totalValue)}
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                    row.isPending
                                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                      : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  }`}
                                >
                                  {row.statusLabel}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Rodapé Clássico de ERP Compartilhado (Navegação de Registros + Auditoria + Ações) */}
        <div className="px-4 sm:px-5 py-2.5 border-t border-black bg-[#cad4e6] flex flex-col xl:flex-row xl:items-center justify-between gap-2.5 shrink-0">
          {/* Esquerda: Navegação de Registros + Auditoria */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center bg-white border border-black rounded-lg overflow-hidden shadow-2xs">
              <button
                type="button"
                onClick={() => handleNavigateRecord('first')}
                disabled={navigableSuppliers.length === 0 || currentRecordIndex === 0}
                title="Primeiro fornecedor"
                className="px-2 py-1.5 text-slate-900 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed border-r border-slate-300 transition cursor-pointer flex items-center gap-1 text-[10px] font-bold uppercase"
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Primeiro</span>
              </button>
              <button
                type="button"
                onClick={() => handleNavigateRecord('prev')}
                disabled={navigableSuppliers.length === 0 || currentRecordIndex === 0}
                title="Fornecedor anterior"
                className="px-2 py-1.5 text-slate-900 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed border-r border-slate-300 transition cursor-pointer flex items-center gap-1 text-[10px] font-bold uppercase"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Anterior</span>
              </button>
              <span className="px-2.5 py-1 text-[10px] font-bold text-slate-800 bg-slate-50 border-r border-slate-300 whitespace-nowrap">
                {currentRecordIndex >= 0
                  ? `${currentRecordIndex + 1} / ${navigableSuppliers.length}`
                  : `Novo (${navigableSuppliers.length})`}
              </span>
              <button
                type="button"
                onClick={() => handleNavigateRecord('next')}
                disabled={
                  navigableSuppliers.length === 0 ||
                  (currentRecordIndex >= 0 && currentRecordIndex >= navigableSuppliers.length - 1)
                }
                title="Próximo fornecedor"
                className="px-2 py-1.5 text-slate-900 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed border-r border-slate-300 transition cursor-pointer flex items-center gap-1 text-[10px] font-bold uppercase"
              >
                <span className="hidden sm:inline">Próximo</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleNavigateRecord('last')}
                disabled={
                  navigableSuppliers.length === 0 ||
                  currentRecordIndex === navigableSuppliers.length - 1
                }
                title="Último fornecedor"
                className="px-2 py-1.5 text-slate-900 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer flex items-center gap-1 text-[10px] font-bold uppercase"
              >
                <span className="hidden sm:inline">Último</span>
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10.5px] text-slate-800 uppercase">
              <span className="inline-flex items-center space-x-1">
                <span className="font-bold text-slate-900">CADASTRO:</span>
                <span>
                  {activeSupplier?.createdAt
                    ? formatDateTimeBR(activeSupplier.createdAt) || '—'
                    : formatDateTimeBR(registrationTimestamp)}
                </span>
              </span>
              <span className="text-slate-600 hidden sm:inline">•</span>
              <span className="inline-flex items-center space-x-1">
                <span className="font-bold text-slate-900">ALTERADO:</span>
                <span>
                  {activeSupplier?.updatedAt
                    ? formatDateTimeBR(activeSupplier.updatedAt) || 'SEM ALTERAÇÕES'
                    : 'SEM ALTERAÇÕES'}
                </span>
              </span>
            </div>
          </div>

          {/* Direita: Ações Rápidas */}
          <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={handleNewRecord}
              title="Limpar formulário e iniciar novo fornecedor"
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-[11px] sm:text-xs font-bold shadow-2xs transition cursor-pointer border border-black uppercase inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Novo</span>
            </button>

            <button
              type="button"
              onClick={handlePrintFicha}
              title="Imprimir Ficha Cadastral A4"
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-[11px] sm:text-xs font-bold shadow-2xs transition cursor-pointer border border-black uppercase inline-flex items-center gap-1"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir Ficha</span>
            </button>

            {activeSupplier && (
              <button
                type="button"
                onClick={() => void handleDeleteRecord()}
                title="Excluir este fornecedor"
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-700 text-[11px] sm:text-xs font-bold shadow-2xs transition cursor-pointer border border-rose-600 uppercase inline-flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCancel}
              title="Descartar alterações não salvas"
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-[11px] sm:text-xs font-bold shadow-2xs transition cursor-pointer border border-black uppercase"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={onClose}
              title="Fechar janela de cadastro"
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-[11px] sm:text-xs font-bold shadow-2xs transition cursor-pointer border border-black uppercase"
            >
              Sair
            </button>

            <button
              type="button"
              disabled={isSuccessSaved}
              onClick={() => handleSubmit()}
              className={`px-4 sm:px-5 py-1.5 rounded-xl text-white text-[11px] sm:text-xs font-bold tracking-wider shadow-xs transition-all cursor-pointer uppercase inline-flex items-center justify-center gap-1.5 border border-emerald-800 ${
                isSuccessSaved
                  ? 'bg-emerald-600 ring-2 ring-emerald-300 ring-offset-2 scale-[1.02]'
                  : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800'
              }`}
            >
              {isSuccessSaved ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-white animate-in zoom-in duration-150" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>{activeSupplier ? 'ATUALIZAR FORNECEDOR' : 'SALVAR FORNECEDOR'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal Gerenciador de Categorias Principais do Fornecedor */}
      <ClientOptionsManagerModal
        isOpen={isCategoryManagerOpen}
        onClose={() => setIsCategoryManagerOpen(false)}
        title="Gerenciar Categorias de Fornecedores"
        subtitle="Marque quais categorias aparecem no seletor ou cadastre novas opções"
        inputLabel="Incluir Nova Categoria de Fornecedor"
        inputPlaceholder="Ex: Ferramentas & EPIs, Embalagens, Informática..."
        items={categoriesCatalog}
        onSave={(updatedCatalog, newlyAdded, renamedLabels) => {
          const saved = saveStoredSupplierCategoriesCatalog(updatedCatalog);
          setCategoriesCatalog(saved);
          const nextActive = saved.filter((i) => i.active);
          if (newlyAdded && newlyAdded.active) {
            setCategory(newlyAdded.label);
          } else if (renamedLabels && category) {
            const matchedKey = Object.keys(renamedLabels).find(
              (k) => k.toLowerCase() === category.trim().toLowerCase()
            );
            if (matchedKey) {
              setCategory(renamedLabels[matchedKey]);
            }
          } else if (
            category &&
            !nextActive.some((i) => i.label.toLowerCase() === category.trim().toLowerCase())
          ) {
            setCategory('');
          }
        }}
        zIndexClass="z-[10000]"
      />

      {/* Mini-Modal: Busca Reversa de CEP por Cidade e Rua */}
      <ReverseCepModal
        isOpen={isReverseCepOpen}
        onClose={() => setIsReverseCepOpen(false)}
        initialUf={state || 'PR'}
        initialCity={city}
        initialStreet={address}
        onSelectResult={(res) => {
          setZipCode(formatCep(res.cep));
          if (res.street) setAddress(res.street.toUpperCase());
          if (res.neighborhood) setNeighborhood(res.neighborhood.toUpperCase());
          if (res.city) setCity(res.city.toUpperCase());
          if (res.state) setState(res.state.toUpperCase());
          setFeedback({
            type: 'success',
            message: `CEP ${res.cep} preenchido (${res.city.toUpperCase()}/${res.state.toUpperCase()}).`,
          });
          setTimeout(() => setFeedback(null), 3500);
        }}
        zIndexClass="z-[10010]"
      />
    </div>
  );
};

export default SupplierModal;
