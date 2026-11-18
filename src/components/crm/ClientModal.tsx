import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  X, 
  ChevronDown, 
  Search, 
  Loader2, 
  CheckCircle2, 
  Check,
  Share2, 
  MessageSquare, 
  Mail, 
  Copy, 
  Inbox,
  ExternalLink,
  UserCheck,
  Receipt,
  ShoppingBag,
  Calendar,
  DollarSign,
  Settings,
  Printer,
  User,
  Camera,
  Wallet,
  ShieldAlert,
  Users,
  Plus,
  Trash2,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Save
} from 'lucide-react';
import { AuthorizedBuyer, Client, ClientFormSubmission } from '../../types';
import { 
  formatCpfCnpj, 
  formatCep, 
  formatPhone, 
  cleanDigits, 
  fetchAddressByCep, 
  fetchCompanyByCnpj,
  formatCurrencyBRL,
  formatarMoeda,
  desformatarMoeda
} from '../../lib/formatters';
import { 
  getClientSubmissions, 
  findSubmissionByDocument, 
  markSubmissionImported 
} from '../../lib/clientSubmissions';
import { isValidUUID, generateUUID } from '../../lib/supabaseService';
import { 
  ClientSelectOption,
  getStoredClients,
  saveStoredClients,
  ensureSequentialClientCodes,
  getNextClientCode,
  syncClientCodeCounter,
  getStoredAtividadesCatalog,
  saveStoredAtividadesCatalog,
  getStoredCrmStatusCatalog,
  saveStoredCrmStatusCatalog,
  getStoredClientServicesCatalog,
  saveStoredClientServicesCatalog,
  addAtividadeIfNew, 
  DEFAULT_ATIVIDADES 
} from '../../lib/storage';
import {
  useResolvedMediaUrl,
  saveClientAvatar,
  deleteClientAvatar,
} from '../../lib/imageStorage';
import { useConfirm } from '../../context/ConfirmContext';
import { ClientOptionsManagerModal } from './ClientOptionsManagerModal';
import { printClientRegistrationA4 } from './clientPrintUtils';
import { ReverseCepModal } from '../common/ReverseCepModal';
import { useModalUnsavedGuard } from '../../lib/modalUnsavedGuard';

export const ATIVIDADES_PADRAO = DEFAULT_ATIVIDADES;

const normalizeSearchText = (text: string): string =>
  String(text ?? '').toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

export type ActivityProfileMode = 'neutro' | 'pecuaria' | 'lavoura' | 'universal';

export const getActivityProfileMode = (atividadeStr: string): ActivityProfileMode => {
  const norm = normalizeSearchText(atividadeStr);
  if (!norm) return 'neutro';

  if (
    norm.includes('gado') ||
    /\bpecuaria\b/.test(norm) ||
    norm.includes('confinamento') ||
    norm.includes('suinocultura') ||
    norm.includes('avicultura') ||
    norm.includes('piscicultura') ||
    norm.includes('equinos')
  ) {
    return 'pecuaria';
  }

  if (
    norm.includes('graos') ||
    norm.includes('lavoura') ||
    norm.includes('fruticultura') ||
    norm.includes('silvicultura')
  ) {
    return 'lavoura';
  }

  return 'universal';
};

interface SearchableClientComboboxProps {
  options: ClientSelectOption[];
  value: string;
  matchBy: 'label' | 'id';
  onChange: (option: ClientSelectOption) => void;
  placeholder: string;
  emptyOptionsMessage: string;
}

const SearchableClientCombobox: React.FC<SearchableClientComboboxProps> = ({
  options,
  value,
  matchBy,
  onChange,
  placeholder,
  emptyOptionsMessage,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(() => {
    const valNorm = String(value ?? '').trim().toLowerCase();
    if (!valNorm) return undefined;
    return options.find(
      (opt) =>
        (matchBy === 'id' ? String(opt.id ?? '').toLowerCase() === valNorm : String(opt.label ?? '').toLowerCase() === valNorm) ||
        String(opt.label ?? '').toLowerCase() === valNorm
    );
  }, [options, value, matchBy]);

  const selectedLabel = selectedOption?.label || '';

  const filteredOptions = useMemo(() => {
    const q = normalizeSearchText(query);
    if (!q) return options;
    return options.filter(
      (opt) =>
        normalizeSearchText(opt.label).includes(q) ||
        (opt.group && normalizeSearchText(opt.group).includes(q))
    );
  }, [options, query]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [query, isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (opt: ClientSelectOption) => {
    onChange(opt);
    setIsOpen(false);
    setQuery('');
    inputRef.current?.blur();
  };

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0">
      <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        value={isOpen ? query : selectedLabel}
        placeholder={isOpen ? (selectedLabel || placeholder) : (options.length === 0 ? emptyOptionsMessage : placeholder)}
        onFocus={() => {
          setIsOpen(true);
          setQuery('');
        }}
        onClick={() => {
          if (!isOpen) {
            setIsOpen(true);
            setQuery('');
          }
        }}
        onChange={(e) => {
          if (!isOpen) setIsOpen(true);
          setQuery(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!isOpen) setIsOpen(true);
            setHighlightedIndex((prev) =>
              filteredOptions.length > 0 ? (prev + 1) % filteredOptions.length : 0
            );
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (!isOpen) setIsOpen(true);
            setHighlightedIndex((prev) =>
              filteredOptions.length > 0
                ? (prev - 1 + filteredOptions.length) % filteredOptions.length
                : 0
            );
          } else if (e.key === 'Enter') {
            if (isOpen) {
              e.preventDefault();
              e.stopPropagation();
              const target = filteredOptions[highlightedIndex];
              if (target) handleSelect(target);
            }
          } else if (e.key === 'Escape') {
            setIsOpen(false);
            setQuery('');
          }
        }}
        className="w-full h-[34px] pl-8 pr-7 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-600 cursor-text truncate"
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => {
          if (isOpen) {
            setIsOpen(false);
            setQuery('');
          } else {
            setIsOpen(true);
            setQuery('');
            inputRef.current?.focus();
          }
        }}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-black p-0.5 cursor-pointer"
        title="Abrir lista de opções"
      >
        <ChevronDown className={`w-4 h-4 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white border border-black rounded-xl shadow-2xl z-40 py-1 animate-in fade-in duration-100">
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-600 font-medium text-center">
              {options.length === 0 ? emptyOptionsMessage : `Nenhuma opção encontrada para "${query}"`}
            </div>
          ) : (
            filteredOptions.map((opt, idx) => {
              const isSelected = selectedOption?.id === opt.id;
              const isHighlighted = idx === highlightedIndex;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(opt);
                  }}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between gap-2 transition cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-50 text-emerald-900 font-bold'
                      : isHighlighted
                      ? 'bg-slate-100 text-black font-medium'
                      : 'text-slate-900 hover:bg-slate-50 font-medium'
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {opt.group && (
                    <span className="text-[9.5px] font-bold uppercase tracking-wide text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                      {opt.group}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export const mapCattleTypeToAtividade = (type?: string): string => {
  if (!type) return 'Gado de Leite';
  const lower = String(type ?? '').toLowerCase();
  if (lower === 'leite') return 'Gado de Leite';
  if (lower === 'confinamento') return 'Pecuária de Corte / Confinamento';
  if (lower === 'misto') return 'Gado Misto';
  if (lower === 'corte') return 'Pecuária de Corte / Confinamento';
  if (lower === 'outro') return 'Outras Atividades';
  return type;
};

export const mapAtividadeToCattleType = (act: string): 'leite' | 'corte' | 'misto' | 'confinamento' | 'outro' => {
  const upper = (act || '').toUpperCase();
  if (upper.includes('LEITE')) return 'leite';
  if (upper.includes('CONFINAMENTO')) return 'confinamento';
  if (upper.includes('MISTO')) return 'misto';
  if (upper.includes('CORTE') || upper.includes('CRIA') || upper.includes('RECRU') || upper.includes('RECRIA')) return 'corte';
  return 'outro';
};

const compressClientAvatarFile = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo de imagem.'));
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const img = new Image();
      img.onerror = () => reject(new Error('Arquivo selecionado não é uma imagem válida.'));
      img.onload = () => {
        const MAX_SIZE = 300;
        const w = img.naturalWidth || img.width || MAX_SIZE;
        const h = img.naturalHeight || img.height || MAX_SIZE;
        const scale = Math.min(1, MAX_SIZE / Math.max(w, h));
        const targetW = Math.max(1, Math.round(w * scale));
        const targetH = Math.max(1, Math.round(h * scale));

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Não foi possível processar a imagem.'));
          return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetW, targetH);
        ctx.drawImage(img, 0, 0, targetW, targetH);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });

const inferPersonTypeFromDoc = (doc?: string, savedType?: 'PF' | 'PJ'): 'PF' | 'PJ' => {
  if (savedType === 'PF' || savedType === 'PJ') return savedType;
  const digits = cleanDigits(doc || '');
  return digits.length > 11 ? 'PJ' : 'PF';
};

export interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (client: Client) => void;
  onSuccess?: (client: Client) => void;
  editingClient?: Client | null;
  initialName?: string;
  zIndexClass?: string;
  clientsList?: Client[];
  onDeleteClient?: (clientId: string) => Promise<boolean | void> | void;
}

export const ClientModal: React.FC<ClientModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onSuccess,
  editingClient,
  initialName = '',
  zIndexClass = 'z-[70]',
  clientsList,
  onDeleteClient,
}) => {
  const { confirm } = useConfirm();
  const [code, setCode] = useState<string>('');
  const [personType, setPersonType] = useState<'PF' | 'PJ'>('PF');
  const [name, setName] = useState('');
  const [farmName, setFarmName] = useState('');
  const [isFarmNameManuallyEdited, setIsFarmNameManuallyEdited] = useState(false);
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [stateRegistration, setStateRegistration] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [address, setAddress] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [addressComplement, setAddressComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('PR');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [secondaryContact, setSecondaryContact] = useState('');
  const [email, setEmail] = useState('');
  const [contribuinteIcms, setContribuinteIcms] = useState('');
  const [cattleType, setCattleType] = useState<string>('outro');
  const [atividade, setAtividade] = useState<string>('');
  const [atividadesCatalog, setAtividadesCatalog] = useState<ClientSelectOption[]>(() => getStoredAtividadesCatalog());
  const [crmStatusCatalog, setCrmStatusCatalog] = useState<ClientSelectOption[]>(() => getStoredCrmStatusCatalog());
  const [clientServicesCatalog, setClientServicesCatalog] = useState<ClientSelectOption[]>(() => getStoredClientServicesCatalog());
  const [activeOptionManager, setActiveOptionManager] = useState<'atividade' | 'status' | 'servicos' | null>(null);
  const [headCount, setHeadCount] = useState<string>('');
  const [monthlyDemandTons, setMonthlyDemandTons] = useState<string>('');
  const [interestedServices, setInterestedServices] = useState<string[]>([]);
  const [creditLimitInput, setCreditLimitInput] = useState<string>('');
  const [preferredPaymentTerm, setPreferredPaymentTerm] = useState<string>('');
  const [defaultPriceTable, setDefaultPriceTable] = useState<'custo' | 'venda' | 'atacado' | 'promocional' | ''>('');
  const [blockOverdueCredit, setBlockOverdueCredit] = useState<boolean>(false);
  const [authorizedBuyers, setAuthorizedBuyers] = useState<AuthorizedBuyer[]>([]);
  const [newBuyerName, setNewBuyerName] = useState('');
  const [newBuyerDocPhone, setNewBuyerDocPhone] = useState('');
  const [newBuyerRole, setNewBuyerRole] = useState('');
  const [status, setStatus] = useState<string>('cliente_ativo');
  const [notes, setNotes] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [pendingAvatarDataUrl, setPendingAvatarDataUrl] = useState<string | null>(null);
  const [avatarRemoved, setAvatarRemoved] = useState<boolean>(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const resolvedStoredAvatarUrl = useResolvedMediaUrl(avatarRemoved ? undefined : avatarUrl);
  const previewAvatarUrl = pendingAvatarDataUrl || (avatarRemoved ? undefined : resolvedStoredAvatarUrl);

  const activeAtividades = useMemo(
    () => atividadesCatalog.filter((item) => item.active),
    [atividadesCatalog]
  );

  const activeCrmStatuses = useMemo(
    () => crmStatusCatalog.filter((item) => item.active),
    [crmStatusCatalog]
  );

  const activeClientServices = useMemo(
    () => clientServicesCatalog.filter((item) => item.active),
    [clientServicesCatalog]
  );

  const activityProfile = useMemo(
    () => getActivityProfileMode(atividade),
    [atividade]
  );

  const complementaryFieldConfig = useMemo(() => {
    if (activityProfile === 'neutro') {
      return {
        label1: 'PORTE / CAPACIDADE OPERACIONAL',
        placeholder1: 'Ex: Porte, rebanho, área ou equipe...',
        label2: 'POTENCIAL / DEMANDA ESTIMADA',
        placeholder2: 'Ex: Volume mensal ou faturamento...',
      };
    }
    if (activityProfile === 'pecuaria') {
      return {
        label1: 'Nº DE CABEÇAS / ANIMAIS',
        placeholder1: 'Ex: 150',
        label2: 'DEMANDA ESTIMADA (TON/MÊS)',
        placeholder2: 'Ex: 45',
      };
    }
    if (activityProfile === 'lavoura') {
      return {
        label1: 'ÁREA CULTIVADA (HA / ALQ.)',
        placeholder1: 'Ex: 120 ha',
        label2: 'DEMANDA / VOLUME ESTIMADO',
        placeholder2: 'Ex: 300 ton/safra',
      };
    }
    return {
      label1: 'PORTE / CAPACIDADE (FROTA OU EQUIPE)',
      placeholder1: 'Ex: 15 veículos, 30 func., Loja matriz...',
      label2: 'POTENCIAL DE COMPRA MENSAL (R$)',
      placeholder2: 'Ex: R$ 15.000,00',
    };
  }, [activityProfile]);

  // Sincronização reativa de catálogos de Atividades, Status CRM e Serviços de Interesse
  useEffect(() => {
    const syncAtividades = () => {
      setAtividadesCatalog(getStoredAtividadesCatalog());
    };
    const syncStatuses = () => {
      setCrmStatusCatalog(getStoredCrmStatusCatalog());
    };
    const syncServices = () => {
      setClientServicesCatalog(getStoredClientServicesCatalog());
    };
    const syncAll = () => {
      syncAtividades();
      syncStatuses();
      syncServices();
    };
    window.addEventListener('agrocontrol_atividades_updated', syncAtividades);
    window.addEventListener('agrocontrol_crm_status_updated', syncStatuses);
    window.addEventListener('agrocontrol_servicos_interesse_updated', syncServices);
    window.addEventListener('storage', syncAll);
    return () => {
      window.removeEventListener('agrocontrol_atividades_updated', syncAtividades);
      window.removeEventListener('agrocontrol_crm_status_updated', syncStatuses);
      window.removeEventListener('agrocontrol_servicos_interesse_updated', syncServices);
      window.removeEventListener('storage', syncAll);
    };
  }, []);

  // Lookup loading states
  const [isLoadingCnpj, setIsLoadingCnpj] = useState(false);
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [isReverseCepOpen, setIsReverseCepOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [currentClient, setCurrentClient] = useState<Client | null>(editingClient || null);
  const [localClientsSnapshot, setLocalClientsSnapshot] = useState<Client[]>(() => {
    try {
      const raw = localStorage.getItem('agrocontrol_clientes');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return ensureSequentialClientCodes(parsed).items;
        }
      }
    } catch {
      // ignore
    }
    return getStoredClients();
  });

  // Share & external form state
  const [isShareDropdownOpen, setIsShareDropdownOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [pendingSubmissions, setPendingSubmissions] = useState<ClientFormSubmission[]>([]);
  const [isImportDropdownOpen, setIsImportDropdownOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'cadastro' | 'financeiro' | 'historico'>('cadastro');
  const [historicoSearch, setHistoricoSearch] = useState('');

  const clientGuard = useModalUnsavedGuard({
    isOpen,
    resetKey: currentClient?.id || editingClient?.id || (isOpen ? 'new' : 'closed'),
    snapshot: [
      code,
      personType,
      name,
      farmName,
      cpfCnpj,
      stateRegistration,
      zipCode,
      address,
      addressNumber,
      addressComplement,
      neighborhood,
      city,
      state,
      phone,
      birthDate,
      secondaryContact,
      email,
      contribuinteIcms,
      cattleType,
      atividade,
      headCount,
      monthlyDemandTons,
      interestedServices,
      creditLimitInput,
      preferredPaymentTerm,
      defaultPriceTable,
      blockOverdueCredit,
      authorizedBuyers,
      status,
      notes,
      pendingAvatarDataUrl,
      avatarRemoved,
    ],
  });

  const handleAttemptClose = () => {
    clientGuard.confirmClose(onClose);
  };

  useEffect(() => {
    const refreshClientsSnapshot = () => {
      try {
        const raw = localStorage.getItem('agrocontrol_clientes');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setLocalClientsSnapshot(ensureSequentialClientCodes(parsed).items);
            return;
          }
        }
      } catch {
        // ignore
      }
      setLocalClientsSnapshot(getStoredClients());
    };
    if (isOpen) refreshClientsSnapshot();
    window.addEventListener('agrocontrol_clientes_updated', refreshClientsSnapshot);
    window.addEventListener('storage', refreshClientsSnapshot);
    return () => {
      window.removeEventListener('agrocontrol_clientes_updated', refreshClientsSnapshot);
      window.removeEventListener('storage', refreshClientsSnapshot);
    };
  }, [isOpen]);

  const navigableClients = useMemo(() => {
    const source = Array.isArray(clientsList) && clientsList.length > 0
      ? clientsList
      : localClientsSnapshot;
    return ensureSequentialClientCodes(source).items;
  }, [clientsList, localClientsSnapshot]);

  // Refresh pending client submissions when modal is opened
  useEffect(() => {
    if (isOpen) {
      setActiveTab('cadastro');
      setHistoricoSearch('');
      try {
        const subs = getClientSubmissions();
        setPendingSubmissions(subs.filter(s => s.status === 'pendente'));
      } catch (err) {
        console.error(err);
      }
    }
  }, [isOpen]);

  const getFormUrl = () => {
    if (typeof window === 'undefined') return '';
    const base = window.location.origin + window.location.pathname;
    return `${base}?ficha=cliente`;
  };

  const handleShareWhatsApp = () => {
    const link = getFormUrl();
    const message = `Olá! Por favor, preencha seus dados cadastrais no AgroControl através deste link: ${link}`;
    const targetDigits = cleanDigits(phone);
    const url = targetDigits.length >= 10
      ? `https://api.whatsapp.com/send?phone=55${targetDigits}&text=${encodeURIComponent(message)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;

    window.open(url, '_blank', 'noopener,noreferrer');
    setIsShareDropdownOpen(false);
    setFeedback({ type: 'success', message: 'Abrindo WhatsApp com o link do formulário...' });
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleShareEmail = () => {
    const link = getFormUrl();
    const subject = encodeURIComponent('Ficha Cadastral de Cliente - AgroControl');
    const body = encodeURIComponent(
      `Olá!\n\nPor favor, preencha seus dados cadastrais no link seguro abaixo para agilizarmos seu atendimento, pedidos e emissão de documentos fiscais:\n\n${link}\n\nAtenciosamente,\nEquipe Comercial`
    );
    const mailto = email ? `mailto:${email}?subject=${subject}&body=${body}` : `mailto:?subject=${subject}&body=${body}`;
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
      setFeedback({ type: 'success', message: 'Link da ficha copiado para a área de transferência!' });
      setTimeout(() => setFeedback(null), 3500);
    } catch {
      setFeedback({ type: 'error', message: 'Não foi possível copiar o link automaticamente.' });
    }
    setIsShareDropdownOpen(false);
  };

  const applySubmission = (submission: ClientFormSubmission) => {
    const incomingName = submission.nome || submission.name;
    const incomingFarm = submission.fazenda || submission.farmName;
    if (incomingName) setName(incomingName);
    if (incomingFarm) setFarmName(incomingFarm);
    const resolvedName = incomingName || name;
    const resolvedFarm = incomingFarm || farmName;
    setIsFarmNameManuallyEdited(Boolean(resolvedFarm && resolvedFarm !== resolvedName));
    if (submission.cpfCnpj) {
      setCpfCnpj(formatCpfCnpj(submission.cpfCnpj));
      setPersonType(inferPersonTypeFromDoc(submission.cpfCnpj));
    }
    if (submission.stateRegistration) setStateRegistration(submission.stateRegistration);
    if (submission.birthDate) setBirthDate(submission.birthDate);
    if (submission.phone) setPhone(formatPhone(submission.phone));
    if (submission.secondaryContact) setSecondaryContact(submission.secondaryContact);
    if (submission.email) setEmail(submission.email);
    if (submission.zipCode) setZipCode(formatCep(submission.zipCode));
    if (submission.address) setAddress(submission.address);
    if (submission.addressNumber) setAddressNumber(submission.addressNumber);
    if (submission.addressComplement) setAddressComplement(submission.addressComplement);
    if (submission.neighborhood) setNeighborhood(submission.neighborhood);
    if (submission.city) setCity(submission.city);
    if (submission.state) setState(submission.state);
    if (submission.contribuinteIcms) setContribuinteIcms(submission.contribuinteIcms);
    if ((submission as any).atividade) {
      const act = String((submission as any).atividade).trim().toUpperCase();
      setAtividade(act);
      setCattleType(mapAtividadeToCattleType(act));
    } else if (submission.cattleType) {
      setCattleType(submission.cattleType);
      setAtividade(mapCattleTypeToAtividade(submission.cattleType));
    }
    if (submission.headCount) setHeadCount(submission.headCount.toString());
    if (submission.monthlyDemandTons) setMonthlyDemandTons(submission.monthlyDemandTons.toString());
    if (typeof submission.creditLimit === 'number' && submission.creditLimit > 0) {
      setCreditLimitInput(`R$ ${formatarMoeda(Math.round(submission.creditLimit * 100))}`);
    }
    if (submission.preferredPaymentTerm) setPreferredPaymentTerm(submission.preferredPaymentTerm);
    if (submission.notes) setNotes(submission.notes);

    markSubmissionImported(submission.id);
    setPendingSubmissions(prev => prev.filter(s => s.id !== submission.id));
    setIsImportDropdownOpen(false);

    setFeedback({
      type: 'success',
      message: `✅ Ficha respondida pelo cliente "${submission.name}" importada com sucesso!`
    });
    setTimeout(() => setFeedback(null), 4500);
  };

  const resolveAtividadeLabel = (raw?: string): string => {
    const trimmed = (raw || '').trim();
    if (!trimmed) return '';
    const catalog = getStoredAtividadesCatalog();
    const match = catalog.find(
      (item) => String(item.label ?? '').toLowerCase() === String(trimmed ?? '').toLowerCase() || String(item.id ?? '').toLowerCase() === String(trimmed ?? '').toLowerCase()
    );
    return match ? match.label : trimmed;
  };

  const loadClientIntoForm = (target: Client | null, fallbackInitialName = '') => {
    if (target) {
      setCurrentClient(target);
      const matchedInNav = navigableClients.find((c) => c.id === target.id);
      const resolvedCode =
        target.code ||
        target.codigo ||
        matchedInNav?.code ||
        matchedInNav?.codigo ||
        getNextClientCode(navigableClients);
      setCode(resolvedCode);
      const clientName = target.nome || target.name;
      const clientFarm = target.fazenda || target.farmName;
      setPersonType(inferPersonTypeFromDoc(target.cpfCnpj, target.personType));
      setName(clientName);
      setFarmName(clientFarm);
      setIsFarmNameManuallyEdited(Boolean(clientFarm && clientFarm !== clientName));
      setCpfCnpj(formatCpfCnpj(target.cpfCnpj || ''));
      setStateRegistration(target.stateRegistration || '');
      setZipCode(formatCep(target.zipCode || ''));
      setAddress(target.address || '');
      setAddressNumber(target.addressNumber || '');
      setAddressComplement(target.addressComplement || '');
      setNeighborhood(target.neighborhood || '');
      setCity(target.city);
      setState(target.state);
      setPhone(formatPhone(target.phone));
      setBirthDate(target.birthDate || '');
      setSecondaryContact(target.secondaryContact || '');
      setEmail(target.email || '');
      setContribuinteIcms(target.contribuinteIcms || '');
      const rawAtividade = (target as any).atividade
        ? String((target as any).atividade).trim()
        : (target.cattleType && target.cattleType !== 'outro'
            ? mapCattleTypeToAtividade(target.cattleType)
            : '');
      const resolvedAtividade = resolveAtividadeLabel(rawAtividade);
      setAtividade(resolvedAtividade);
      setCattleType(mapAtividadeToCattleType(resolvedAtividade));
      setHeadCount(
        target.porteCapacidade ||
          (target.headCount ? target.headCount.toString() : '')
      );
      setMonthlyDemandTons(
        target.potencialCompraMensal ||
          (target.monthlyDemandTons ? target.monthlyDemandTons.toString() : '')
      );
      const savedServices = target.interestedServices || target.servicosInteresse || [];
      setInterestedServices(Array.isArray(savedServices) ? savedServices : []);
      setCreditLimitInput(
        typeof target.creditLimit === 'number' && target.creditLimit > 0
          ? `R$ ${formatarMoeda(Math.round(target.creditLimit * 100))}`
          : ''
      );
      setPreferredPaymentTerm(target.preferredPaymentTerm || '');
      setDefaultPriceTable(target.defaultPriceTable || '');
      setBlockOverdueCredit(Boolean(target.blockOverdueCredit));
      setAuthorizedBuyers(Array.isArray(target.authorizedBuyers) ? target.authorizedBuyers : []);
      setNewBuyerName('');
      setNewBuyerDocPhone('');
      setNewBuyerRole('');
      setAvatarUrl(target.avatarUrl || '');
      setPendingAvatarDataUrl(null);
      setAvatarRemoved(false);
      setStatus(target.status || 'cliente_ativo');
      setNotes(target.notes || '');
    } else {
      setCurrentClient(null);
      setCode(getNextClientCode(navigableClients));
      setPersonType('PF');
      setName(fallbackInitialName || '');
      setFarmName('');
      setIsFarmNameManuallyEdited(false);
      setCpfCnpj('');
      setStateRegistration('');
      setZipCode('');
      setAddress('');
      setAddressNumber('');
      setAddressComplement('');
      setNeighborhood('');
      setCity('');
      setState('PR');
      setPhone('');
      setBirthDate('');
      setSecondaryContact('');
      setEmail('');
      setContribuinteIcms('');
      setAtividade('');
      setCattleType('outro');
      setHeadCount('');
      setMonthlyDemandTons('');
      setInterestedServices([]);
      setCreditLimitInput('');
      setPreferredPaymentTerm('');
      setDefaultPriceTable('');
      setBlockOverdueCredit(false);
      setAuthorizedBuyers([]);
      setNewBuyerName('');
      setNewBuyerDocPhone('');
      setNewBuyerRole('');
      setAvatarUrl('');
      setPendingAvatarDataUrl(null);
      setAvatarRemoved(false);
      const currentActiveStatuses = getStoredCrmStatusCatalog().filter((i) => i.active);
      const defaultStatus =
        currentActiveStatuses.find((i) => i.id === 'cliente_ativo')?.id ||
        currentActiveStatuses[0]?.id ||
        '';
      setStatus(defaultStatus);
      setNotes('');
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    loadClientIntoForm(editingClient || null, initialName);
    setFeedback(null);
  }, [editingClient, isOpen, initialName]);

  // Handle CNPJ / CPF dynamic typing and auto search + auto PF/PJ detection
  const handleCpfCnpjChange = async (val: string) => {
    const formatted = formatCpfCnpj(val);
    setCpfCnpj(formatted);
    const digits = cleanDigits(val);
    setPersonType(digits.length > 11 ? 'PJ' : 'PF');
    if (digits.length === 11 || digits.length === 14) {
      await searchCnpj(digits);
    }
  };

  const searchCnpj = async (cnpjDigits?: string) => {
    const digits = cnpjDigits || cleanDigits(cpfCnpj);
    if (!digits) {
      setFeedback({ type: 'error', message: 'Digite o CPF ou CNPJ para buscar.' });
      setTimeout(() => setFeedback(null), 3000);
      return;
    }

    // 1. Prioridade: Buscar nas fichas externas preenchidas pelo cliente
    const matchedSubmission = findSubmissionByDocument(digits);
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
        if (res.success) {
          const nextName = res.corporateName && !name ? res.corporateName : name;
          const nextFarm = res.tradeName && !farmName ? res.tradeName : farmName;
          if (res.corporateName && !name) setName(res.corporateName);
          if (res.tradeName && !farmName) setFarmName(res.tradeName);
          if (nextFarm && nextFarm !== nextName) {
            setIsFarmNameManuallyEdited(true);
          }
          if (res.phone && !phone) setPhone(formatPhone(res.phone));
          if (res.email && !email) setEmail(res.email);
          if (res.zipCode) setZipCode(formatCep(res.zipCode));
          if (res.street) setAddress(res.street);
          if (res.number) setAddressNumber(String(res.number));
          if (res.neighborhood) setNeighborhood(res.neighborhood);
          if (res.city) setCity(res.city);
          if (res.state) setState(res.state);
          setFeedback({ type: 'success', message: `✅ Dados preenchidos via Receita Federal: ${res.corporateName}` });
        } else {
          setFeedback({ type: 'error', message: res.message || 'CNPJ não encontrado na Receita.' });
        }
      } catch {
        setFeedback({ type: 'error', message: 'Falha ao consultar CNPJ na Receita Federal.' });
      } finally {
        setIsLoadingCnpj(false);
        setTimeout(() => setFeedback(null), 3500);
      }
      return;
    }

    // Se for 11 dígitos (CPF) e não encontrou ficha respondida
    if (digits.length === 11) {
      setFeedback({ type: 'error', message: 'Nenhuma ficha externa respondida encontrada para este CPF.' });
      setTimeout(() => setFeedback(null), 3000);
      return;
    }

    setFeedback({ type: 'error', message: 'Digite 11 dígitos para CPF ou 14 para CNPJ.' });
    setTimeout(() => setFeedback(null), 3000);
  };

  // Handle CEP dynamic typing and auto search
  const handleCepChange = async (val: string) => {
    const formatted = formatCep(val);
    setZipCode(formatted);
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
        if (res.street) setAddress(res.street);
        if (res.neighborhood) setNeighborhood(res.neighborhood);
        if (res.city) setCity(res.city);
        if (res.state) setState(res.state);
        setFeedback({ type: 'success', message: `✅ Endereço preenchido: ${res.city}/${res.state}` });
      } else {
        setFeedback({ type: 'error', message: res.message || 'CEP não encontrado.' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Falha ao consultar CEP.' });
    } finally {
      setIsLoadingCep(false);
      setTimeout(() => setFeedback(null), 3500);
    }
  };

  // Auto calculate estimated monthly demand based on livestock head count (exclusivo para Pecuária)
  const handleHeadCountChange = (countStr: string) => {
    setHeadCount(countStr);
    if (activityProfile === 'pecuaria') {
      const count = parseInt(countStr, 10);
      if (!isNaN(count) && count > 0) {
        const upper = (atividade || '').toUpperCase();
        const factor = upper.includes('LEITE') ? 0.55 : upper.includes('CONFINAMENTO') ? 0.45 : 0.40;
        setMonthlyDemandTons((count * factor).toFixed(0));
      }
    }
  };

  const handleField2Change = (val: string) => {
    if (activityProfile === 'universal') {
      const formatted = formatarMoeda(val);
      setMonthlyDemandTons(formatted ? `R$ ${formatted}` : '');
    } else {
      setMonthlyDemandTons(val);
    }
  };

  const toggleInterestedService = (serviceLabel: string) => {
    setInterestedServices((prev) =>
      prev.includes(serviceLabel)
        ? prev.filter((item) => item !== serviceLabel)
        : [...prev, serviceLabel]
    );
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const compressed = await compressClientAvatarFile(file);
      setPendingAvatarDataUrl(compressed);
      setAvatarRemoved(false);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Não foi possível processar a foto selecionada.',
      });
      setTimeout(() => setFeedback(null), 3500);
    }
  };

  const handleRemoveAvatar = () => {
    setPendingAvatarDataUrl(null);
    setAvatarRemoved(true);
  };

  const handleAddAuthorizedBuyer = () => {
    const trimmedName = newBuyerName.trim();
    if (!trimmedName) {
      setFeedback({ type: 'error', message: 'Informe o nome da pessoa autorizada antes de adicionar.' });
      setTimeout(() => setFeedback(null), 3000);
      return;
    }
    const buyer: AuthorizedBuyer = {
      id: `auth_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: trimmedName,
      documentOrPhone: newBuyerDocPhone.trim() || undefined,
      relationshipOrRole: newBuyerRole.trim() || undefined,
    };
    setAuthorizedBuyers((prev) => [...prev, buyer]);
    setNewBuyerName('');
    setNewBuyerDocPhone('');
    setNewBuyerRole('');
  };

  const handleRemoveAuthorizedBuyer = (buyerId: string) => {
    setAuthorizedBuyers((prev) => prev.filter((b) => b.id !== buyerId));
  };

  const activeClient = currentClient;
  const currentRecordIndex = useMemo(() => {
    if (!activeClient) return -1;
    return navigableClients.findIndex((c) => c.id === activeClient.id);
  }, [navigableClients, activeClient]);

  // Carregamento reativo do Histórico de Compras a partir de 'agrocontrol_vendas'
  const clientPurchases = useMemo(() => {
    if (!activeClient) return [];
    try {
      const raw = localStorage.getItem('agrocontrol_vendas') || 
                  localStorage.getItem('agrocontrol_pdv_vendas') || 
                  localStorage.getItem('colaca_silagem_vendas_pdv') || 
                  '[]';
      const parsed = JSON.parse(raw);
      const allSales: any[] = Array.isArray(parsed) ? parsed : [];
      
      const rawServices = localStorage.getItem('colaca_silagem_services') || localStorage.getItem('silagem_facil_clean_v1_services') || '[]';
      let allServices: any[] = [];
      try {
        const parsedServices = JSON.parse(rawServices);
        allServices = Array.isArray(parsedServices) ? parsedServices : [];
      } catch {}

      const cleanClientCpf = cleanDigits(activeClient.cpfCnpj || (activeClient as any).document || '');
      const clientNameNorm = String((activeClient.nome || activeClient.name) ?? '').trim().toLowerCase();
      const clientFarmNorm = String((activeClient.fazenda || activeClient.farmName) ?? '').trim().toLowerCase();
      const clientId = activeClient.id;

      // Filtrar vendas de 'agrocontrol_vendas'
      const matchedSales = allSales.filter((s: any) => {
        const saleClientId = s.clientId;
        const saleClientCpf = cleanDigits(s.clienteCpfCnpj || s.cpfCnpj || '');
        const saleClientName = String((s.cliente || s.clientName || s.client) ?? '').trim().toLowerCase();
        const saleFarmName = String((s.fazenda || s.farmName) ?? '').trim().toLowerCase();

        return (clientId && saleClientId === clientId) ||
               (cleanClientCpf && saleClientCpf && cleanClientCpf === saleClientCpf) ||
               (clientNameNorm && saleClientName && (saleClientName === clientNameNorm || saleClientName.includes(clientNameNorm) || clientNameNorm.includes(saleClientName))) ||
               (clientFarmNorm && saleFarmName && clientFarmNorm === saleFarmName);
      });

      // Evitar duplicidades com contratos ou ordens de serviços já cadastradas
      const existingOrders = new Set(
        matchedSales.flatMap((s: any) => [
          String(s.id || ''),
          String(s.orderNumber || ''),
          String(s.numeroPedido || ''),
          String(s.numeroVenda || ''),
          `srv_${s.id}`
        ]).filter(Boolean)
      );

      const matchedServices = allServices.filter((srv: any) => {
        const srvId = String(srv.id || '');
        const cleanSrvId = srvId.replace(/^srv_/, '');
        const srvOrder = String(srv.orderNumber || '');

        if (existingOrders.has(srvId) || existingOrders.has(cleanSrvId) || (srvOrder && existingOrders.has(srvOrder))) {
          return false;
        }

        const srvClientId = srv.clientId;
        const srvClientName = String((srv.clientName || srv.cliente) ?? '').trim().toLowerCase();
        const srvFarmName = String((srv.farmName || srv.fazenda) ?? '').trim().toLowerCase();

        return (clientId && srvClientId === clientId) ||
               (cleanClientCpf && cleanDigits(srv.clientCpfCnpj || srv.cpfCnpj || '') === cleanClientCpf) ||
               (clientNameNorm && srvClientName && (srvClientName === clientNameNorm || srvClientName.includes(clientNameNorm))) ||
               (clientFarmNorm && srvFarmName && clientFarmNorm === srvFarmName);
      }).map((srv: any) => ({
        id: srv.id,
        orderNumber: srv.orderNumber || `CTR-${srv.id.slice(-5)}`,
        data: srv.startDate || srv.date,
        date: srv.startDate || srv.date,
        hora: '12:00',
        cliente: srv.clientName,
        fazenda: srv.farmName,
        valorLiquido: srv.totalAmount || srv.ratePerUnit || 0,
        totalLiquido: srv.totalAmount || srv.ratePerUnit || 0,
        status: srv.status === 'concluido' ? 'concluido' : 'pendente',
        formaPagamento: 'prazo',
        forma: 'CONTRATO / FATURAMENTO A PRAZO',
        itens: [{
          id: srv.id,
          codigo: 'CTR-01',
          descricao: srv.serviceType || 'Serviço de Silagem & Colheita',
          unidade: srv.areaUnit || (srv.tonsEstimated ? 'TON' : 'UN'),
          quantidade: srv.areaQuantity || srv.tonsEstimated || 1,
          precoUnitario: srv.ratePerUnit || srv.totalAmount || 0,
          totalLiquido: srv.totalAmount || 0
        }],
        qtdItens: srv.areaQuantity || srv.tonsEstimated || 1
      }));

      const combined = [...matchedSales, ...matchedServices];

      // 1. FIM DA DUPLICIDADE NO HISTÓRICO DE COMPRAS DO CLIENTE (PRINT 3):
      // Trava anti-duplicação mandatória por ID antes de renderizar a tabela na tela do cliente:
      const historicoUnico = combined;
      const historicoFiltrado = historicoUnico.filter((venda, index, self) => 
        self.findIndex(v => {
          const vCleanId = String(v.id || '').replace(/^srv_/, '');
          const vendaCleanId = String(venda.id || '').replace(/^srv_/, '');
          const vOrder = String(v.orderNumber || v.numeroPedido || '').trim();
          const vendaOrder = String(venda.orderNumber || venda.numeroPedido || '').trim();
          return (v.id === venda.id) || (vCleanId && vCleanId === vendaCleanId) || (vOrder && vendaOrder && vOrder === vendaOrder);
        }) === index
      );

      return historicoFiltrado.sort((a, b) => {
        const dateA = new Date(a.data || a.date || a.criadoEm || 0).getTime();
        const dateB = new Date(b.data || b.date || b.criadoEm || 0).getTime();
        return dateB - dateA;
      });
    } catch (e) {
      console.warn('Erro ao carregar histórico de compras do cliente:', e);
      return [];
    }
  }, [activeClient, isOpen]);

  // Filtro de busca textual no histórico com trava anti-duplicação mandatória
  const filteredPurchases = useMemo(() => {
    const list = !historicoSearch.trim() ? clientPurchases : (() => {
      const q = String(historicoSearch ?? '').toLowerCase().trim();
      return clientPurchases.filter(p => {
        const order = String(p.orderNumber || p.numeroPedido || p.id || '').toLowerCase();
        const forma = String(p.forma || p.formaPagamento || '').toLowerCase();
        const dateStr = String(p.data || p.date || '').toLowerCase();
        const hasItem = Array.isArray(p.itens) && p.itens.some((it: any) => 
          String(it.descricao || '').toLowerCase().includes(q) ||
          String(it.codigo || '').toLowerCase().includes(q)
        );
        return order.includes(q) || forma.includes(q) || dateStr.includes(q) || hasItem;
      });
    })();
    return list.filter((venda, index, self) => self.findIndex(v => v.id === venda.id) === index);
  }, [clientPurchases, historicoSearch]);

  const totalGasto = useMemo(() => {
    return clientPurchases.reduce((acc, p) => acc + (Number(p.valorLiquido ?? p.totalLiquido ?? p.totalAmount ?? 0)), 0);
  }, [clientPurchases]);

  const ticketMedio = clientPurchases.length > 0 ? totalGasto / clientPurchases.length : 0;

  const dataUltimaCompra = useMemo(() => {
    if (clientPurchases.length === 0) return '—';
    const rawDate = clientPurchases[0].data || clientPurchases[0].date;
    if (!rawDate) return '—';
    try {
      const [y, m, d] = rawDate.split('T')[0].split('-');
      if (y && m && d) return `${d}/${m}/${y}`;
      return rawDate;
    } catch {
      return rawDate;
    }
  }, [clientPurchases]);

  const handleNameChange = (newName: string) => {
    const shouldMirror = !isFarmNameManuallyEdited || farmName === '' || farmName === name;
    setName(newName);
    if (shouldMirror) {
      setFarmName(newName);
      setIsFarmNameManuallyEdited(false);
    }
  };

  const handleFarmNameChange = (newFarmName: string) => {
    setFarmName(newFarmName);
    if (newFarmName === '' || newFarmName === name) {
      setIsFarmNameManuallyEdited(false);
    } else {
      setIsFarmNameManuallyEdited(true);
    }
  };

  const handleCancel = () => {
    loadClientIntoForm(activeClient || null, initialName);
    clientGuard.resetDirty();
    setFeedback({ type: 'error', message: 'Alterações não salvas foram descartadas.' });
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleNewRecord = () => {
    loadClientIntoForm(null, '');
    setActiveTab('cadastro');
    setFeedback({ type: 'success', message: 'Formulário pronto para cadastrar um novo cliente.' });
    setTimeout(() => setFeedback(null), 2500);
  };

  const handleNavigateRecord = (direction: 'first' | 'prev' | 'next' | 'last') => {
    if (navigableClients.length === 0) return;
    let targetIndex = 0;
    if (direction === 'first') {
      targetIndex = 0;
    } else if (direction === 'last') {
      targetIndex = navigableClients.length - 1;
    } else if (direction === 'prev') {
      targetIndex = currentRecordIndex <= 0 ? 0 : currentRecordIndex - 1;
    } else if (direction === 'next') {
      targetIndex =
        currentRecordIndex < 0
          ? 0
          : Math.min(navigableClients.length - 1, currentRecordIndex + 1);
    }
    const targetClient = navigableClients[targetIndex];
    if (targetClient) {
      loadClientIntoForm(targetClient);
      setFeedback(null);
    }
  };

  const handleDeleteRecord = async () => {
    if (!activeClient) return;
    const deletedId = activeClient.id;

    if (onDeleteClient) {
      const result = await onDeleteClient(deletedId);
      if (result === false) return;
    } else {
      const isConfirmed = await confirm({
        title: 'Excluir Cliente',
        message: `Deseja realmente excluir "${activeClient.nome || activeClient.name}" do cadastro?`,
        confirmLabel: 'Sim, Excluir',
        cancelLabel: 'Cancelar',
        variant: 'danger',
      });
      if (!isConfirmed) return;
      void deleteClientAvatar(deletedId);
    }

    // Sincronizar localStorage e snapshot local
    try {
      const remaining = navigableClients.filter((c) => c.id !== deletedId);
      setLocalClientsSnapshot(remaining);
      saveStoredClients(remaining);
      const rawAgro = localStorage.getItem('agrocontrol_clientes');
      if (rawAgro) {
        const parsedAgro = JSON.parse(rawAgro);
        if (Array.isArray(parsedAgro)) {
          const nextAgro = parsedAgro.filter((c: any) => c.id !== deletedId);
          localStorage.setItem('agrocontrol_clientes', JSON.stringify(nextAgro));
          window.dispatchEvent(new CustomEvent('agrocontrol_clientes_updated', { detail: nextAgro }));
        }
      }
    } catch (err) {
      console.warn('Erro ao remover cliente do localStorage:', err);
    }

    const remainingList = navigableClients.filter((c) => c.id !== deletedId);
    if (remainingList.length > 0) {
      const nextIdx = Math.min(Math.max(0, currentRecordIndex), remainingList.length - 1);
      loadClientIntoForm(remainingList[nextIdx]);
      setFeedback({ type: 'success', message: 'Cliente excluído. Exibindo próximo registro.' });
      setTimeout(() => setFeedback(null), 3000);
    } else {
      onClose();
    }
  };

  const handleCreditLimitChange = (val: string) => {
    const formatted = formatarMoeda(val);
    setCreditLimitInput(formatted ? `R$ ${formatted}` : '');
  };

  const saveClientData = async () => {
    if (isSaving) return;
    if (!name.trim() || !farmName.trim()) {
      setActiveTab('cadastro');
      setFeedback({ type: 'error', message: 'Preencha o nome do cliente e o nome fantasia / estabelecimento.' });
      setTimeout(() => setFeedback(null), 4000);
      return;
    }

    setIsSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const isUpdating = Boolean(activeClient);
      const clientId = (activeClient && isValidUUID(activeClient.id))
        ? activeClient.id
        : (activeClient?.id || generateUUID());

      let persistedAvatarUrl = avatarRemoved ? '' : avatarUrl;
      if (pendingAvatarDataUrl) {
        persistedAvatarUrl = await saveClientAvatar(clientId, pendingAvatarDataUrl);
      } else if (avatarRemoved && activeClient?.avatarUrl) {
        await deleteClientAvatar(clientId);
        persistedAvatarUrl = '';
      }

      const finalAtividade = atividade.trim();
      const mappedCattle = finalAtividade ? mapAtividadeToCattleType(finalAtividade) : 'outro';
      const parsedCreditLimit = creditLimitInput ? desformatarMoeda(creditLimitInput) : 0;
      const finalStatus = status || activeCrmStatuses[0]?.id || 'cliente_ativo';

      // Inclusão permanente de novos termos no catálogo de atividades do LocalStorage
      if (finalAtividade) {
        addAtividadeIfNew(finalAtividade);
      }

      const parsedHeadCountNum = (() => {
        const m = headCount.trim().match(/^(\d+)/);
        return m ? parseInt(m[1], 10) : undefined;
      })();
      const parsedField2Num = (() => {
        if (!monthlyDemandTons.trim()) return undefined;
        if (monthlyDemandTons.includes('R$') || monthlyDemandTons.includes(',')) {
          const val = desformatarMoeda(monthlyDemandTons);
          return val > 0 ? val : undefined;
        }
        const m = monthlyDemandTons.trim().match(/^(\d+(?:\.\d+)?)/);
        return m ? parseFloat(m[1]) : undefined;
      })();

      const finalCode = (
        code ||
        activeClient?.code ||
        activeClient?.codigo ||
        getNextClientCode(navigableClients)
      ).trim();

      const client: Client = {
        id: clientId,
        code: finalCode,
        codigo: finalCode,
        personType,
        avatarUrl: persistedAvatarUrl || undefined,
        name: name.trim(),
        nome: name.trim(),
        farmName: farmName.trim(),
        fazenda: farmName.trim(),
        cpfCnpj: cpfCnpj.trim() || undefined,
        stateRegistration: stateRegistration.trim() || undefined,
        birthDate: birthDate.trim() || undefined,
        zipCode: zipCode.trim() || undefined,
        address: address.trim() || undefined,
        addressNumber: addressNumber.trim() || undefined,
        addressComplement: addressComplement.trim() || undefined,
        neighborhood: neighborhood.trim() || undefined,
        city: city.trim() || 'Região',
        state: state.trim() || 'PR',
        phone: phone.trim(),
        secondaryContact: secondaryContact.trim() || undefined,
        email: email.trim() || undefined,
        contribuinteIcms: contribuinteIcms.trim() || undefined,
        cattleType: mappedCattle,
        atividade: finalAtividade || undefined,
        headCount: parsedHeadCountNum,
        monthlyDemandTons: parsedField2Num,
        porteCapacidade: headCount.trim() || undefined,
        potencialCompraMensal: monthlyDemandTons.trim() || undefined,
        interestedServices: interestedServices.length > 0 ? interestedServices : undefined,
        servicosInteresse: interestedServices.length > 0 ? interestedServices : undefined,
        creditLimit: parsedCreditLimit > 0 ? parsedCreditLimit : undefined,
        preferredPaymentTerm: preferredPaymentTerm.trim() || undefined,
        defaultPriceTable: defaultPriceTable || undefined,
        blockOverdueCredit: Boolean(blockOverdueCredit),
        authorizedBuyers: authorizedBuyers.length > 0 ? authorizedBuyers : undefined,
        status: finalStatus,
        notes: notes.trim() || undefined,
        totalPurchasedTons: activeClient?.totalPurchasedTons || 0,
        totalSpent: activeClient?.totalSpent || 0,
        createdAt: activeClient?.createdAt || nowIso,
        updatedAt: isUpdating ? nowIso : undefined,
      };

      syncClientCodeCounter(finalCode, navigableClients);

      // Sincronização direta e reativa na chave oficial 'agrocontrol_clientes' do LocalStorage
      try {
        const rawAgro = localStorage.getItem('agrocontrol_clientes') || '[]';
        const parsedAgro = JSON.parse(rawAgro);
        if (Array.isArray(parsedAgro)) {
          const idx = parsedAgro.findIndex((c: any) => c.id === client.id);
          if (idx >= 0) {
            parsedAgro[idx] = { ...parsedAgro[idx], ...client, atividade: finalAtividade };
          } else {
            parsedAgro.unshift({ ...client, atividade: finalAtividade });
          }
          const normalizedAgro = ensureSequentialClientCodes(parsedAgro).items;
          saveStoredClients(normalizedAgro);
          setLocalClientsSnapshot(normalizedAgro);
          window.dispatchEvent(new CustomEvent('agrocontrol_clientes_updated', { detail: normalizedAgro }));
        }
      } catch (err) {
        console.warn('Erro ao persistir agrocontrol_clientes:', err);
      }

      setCode(finalCode);
      setAvatarUrl(persistedAvatarUrl);
      setPendingAvatarDataUrl(null);
      setAvatarRemoved(false);
      setCurrentClient(client);

      if (onSuccess) {
        onSuccess(client);
      }
      if (onSave) {
        onSave(client);
      }

      // Modal remains OPEN without closing automatically!
      setFeedback({
        type: 'success',
        message: isUpdating ? 'Cliente atualizado com sucesso!' : 'Cliente salvo com sucesso!',
      });
      setTimeout(() => {
        setFeedback(null);
      }, 4000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void saveClientData();
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
    const parsedHeadCountNum = (() => {
      const m = headCount.trim().match(/^(\d+)/);
      return m ? parseInt(m[1], 10) : undefined;
    })();
    const parsedField2Num = (() => {
      if (!monthlyDemandTons.trim()) return undefined;
      if (monthlyDemandTons.includes('R$') || monthlyDemandTons.includes(',')) {
        const val = desformatarMoeda(monthlyDemandTons);
        return val > 0 ? val : undefined;
      }
      const m = monthlyDemandTons.trim().match(/^(\d+(?:\.\d+)?)/);
      return m ? parseFloat(m[1]) : undefined;
    })();
    const parsedCreditLimit = creditLimitInput ? desformatarMoeda(creditLimitInput) : 0;

    void printClientRegistrationA4({
      id: activeClient?.id || '',
      code: code || activeClient?.code || activeClient?.codigo || undefined,
      personType,
      avatarUrl: pendingAvatarDataUrl || (avatarRemoved ? undefined : avatarUrl || undefined),
      name: name.trim(),
      nome: name.trim(),
      farmName: farmName.trim(),
      fazenda: farmName.trim(),
      cpfCnpj: cpfCnpj.trim() || undefined,
      stateRegistration: stateRegistration.trim() || undefined,
      birthDate: birthDate.trim() || undefined,
      phone: phone.trim(),
      secondaryContact: secondaryContact.trim() || undefined,
      email: email.trim() || undefined,
      contribuinteIcms: contribuinteIcms.trim() || undefined,
      zipCode: zipCode.trim() || undefined,
      address: address.trim() || undefined,
      addressNumber: addressNumber.trim() || undefined,
      addressComplement: addressComplement.trim() || undefined,
      neighborhood: neighborhood.trim() || undefined,
      city: city.trim(),
      state: state.trim(),
      atividade: atividade.trim() || undefined,
      headCount: parsedHeadCountNum,
      monthlyDemandTons: parsedField2Num,
      porteCapacidade: headCount.trim() || undefined,
      potencialCompraMensal: monthlyDemandTons.trim() || undefined,
      status: status || undefined,
      creditLimit: parsedCreditLimit > 0 ? parsedCreditLimit : undefined,
      preferredPaymentTerm: preferredPaymentTerm.trim() || undefined,
      defaultPriceTable: defaultPriceTable || undefined,
      blockOverdueCredit: Boolean(blockOverdueCredit),
      authorizedBuyers: authorizedBuyers.length > 0 ? authorizedBuyers : undefined,
      interestedServices: interestedServices.length > 0 ? interestedServices : undefined,
      servicosInteresse: interestedServices.length > 0 ? interestedServices : undefined,
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
    <div className={`fixed inset-0 ${zIndexClass} flex items-center justify-center p-2 sm:p-4 bg-black/60 overflow-hidden`} style={{ backgroundColor: 'rgba(0, 0, 0, 0.60)' }}>
      <div className="w-[88vw] max-w-[1300px] h-[92vh] max-h-[92vh] flex flex-col justify-between mx-auto my-auto bg-[#cad4e6] border border-black rounded-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header - Tema Oficial #cad4e6 + border-black */}
        <div className="px-4 sm:px-5 py-2.5 bg-[#cad4e6] border-b border-black text-slate-900 flex items-center justify-between relative shrink-0 rounded-t-lg">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white text-slate-900 flex items-center justify-center border border-black shadow-2xs shrink-0">
              <UserCheck className="w-4 h-4 text-slate-900" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-900">
                {activeClient ? 'EDITAR CLIENTE' : 'NOVO CLIENTE'}
              </h3>
              <p className="text-[11px] text-slate-800 font-medium">
                Cadastro completo, financeiro & crédito, foto e histórico comercial
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Botão Imprimir Ficha */}
            <button
              type="button"
              onClick={handlePrintFicha}
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-900 text-[11px] font-bold transition cursor-pointer border border-black shadow-2xs"
              title="Imprimir Ficha Cadastral do Cliente (A4)"
            >
              <Printer className="w-3.5 h-3.5 text-slate-900" />
              <span className="uppercase">Imprimir Ficha</span>
            </button>

            {/* Botão Enviar Ficha com Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsShareDropdownOpen(!isShareDropdownOpen)}
                className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-900 text-[11px] font-bold transition cursor-pointer border border-black shadow-2xs"
                title="Enviar link do formulário de cadastro em branco para o cliente"
              >
                <Share2 className="w-3.5 h-3.5 text-slate-900" />
                <span className="uppercase">Enviar Ficha</span>
                <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${isShareDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {isShareDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setIsShareDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-64 bg-white text-stone-900 rounded-xl shadow-2xl border border-stone-200 z-20 overflow-hidden py-1.5 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3.5 py-1.5 border-b border-stone-100 bg-stone-50/70">
                      <p className="text-[10px] font-bold text-stone-600 uppercase tracking-wider">
                        Compartilhar Ficha em Branco
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleShareWhatsApp}
                      className="w-full px-3.5 py-2.5 text-left text-xs sm:text-sm font-medium hover:bg-emerald-50 text-stone-800 hover:text-emerald-900 flex items-center space-x-2.5 transition cursor-pointer"
                    >
                      <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
                        <MessageSquare className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1">
                        <span className="font-bold block">Enviar por WhatsApp</span>
                        <span className="text-[10px] text-stone-500 block">Link pronto com mensagem</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={handleShareEmail}
                      className="w-full px-3.5 py-2.5 text-left text-xs sm:text-sm font-medium hover:bg-blue-50 text-stone-800 hover:text-blue-900 flex items-center space-x-2.5 transition cursor-pointer"
                    >
                      <div className="w-6 h-6 rounded-full bg-blue-100 text-[#0963cb] flex items-center justify-center flex-shrink-0">
                        <Mail className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1">
                        <span className="font-bold block">Enviar por E-mail</span>
                        <span className="text-[10px] text-stone-500 block">Dispara via seu cliente de e-mail</span>
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

            {/* Fechar Modal */}
            <button
              onClick={handleAttemptClose}
              className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-900 border border-black transition cursor-pointer"
              title="Fechar janela"
            >
              <X className="w-4 h-4 text-slate-900" />
            </button>
          </div>
        </div>

        {/* Feedback message */}
        {feedback && (
          <div className={`px-5 py-2 text-xs sm:text-sm font-bold text-white flex items-center justify-between shadow-xs transition ${
            feedback.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
          }`}>
            <div className="flex items-center space-x-2">
              {feedback.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-100 flex-shrink-0" />}
              <span>{feedback.message}</span>
            </div>
            <button 
              type="button"
              onClick={() => setFeedback(null)} 
              className="text-white/80 hover:text-white px-2 py-0.5 rounded-sm hover:bg-white/20 transition cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Sub-Aba Navigation: DADOS CADASTRAIS vs FINANCEIRO & CRÉDITO vs HISTÓRICO DE COMPRAS */}
        <div className="flex flex-wrap items-center px-4 sm:px-5 bg-[#cad4e6] border-b border-black gap-2 pt-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('cadastro')}
            className={`px-3.5 sm:px-4 py-1.5 text-xs font-bold uppercase rounded-t-lg border-t border-x transition flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'cadastro'
                ? 'bg-[#e0e6f1] text-slate-900 border-black -mb-px pb-2 shadow-xs'
                : 'bg-[#cad4e6] hover:bg-[#dce3f0] text-slate-800 border-transparent hover:text-black'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-slate-900" />
            <span>DADOS CADASTRAIS</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('financeiro')}
            className={`px-3.5 sm:px-4 py-1.5 text-xs font-bold uppercase rounded-t-lg border-t border-x transition flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'financeiro'
                ? 'bg-[#e0e6f1] text-slate-900 border-black -mb-px pb-2 shadow-xs'
                : 'bg-[#cad4e6] hover:bg-[#dce3f0] text-slate-800 border-transparent hover:text-black'
            }`}
          >
            <Wallet className="w-3.5 h-3.5 text-slate-900" />
            <span>FINANCEIRO & CRÉDITO</span>
            {blockOverdueCredit && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-rose-600 text-white uppercase">
                Trava
              </span>
            )}
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
            <Receipt className="w-3.5 h-3.5 text-emerald-700" />
            <span>HISTÓRICO DE COMPRAS</span>
            <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              activeTab === 'historico' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-900 border border-gray-400'
            }`}>
              {clientPurchases.length}
            </span>
          </button>
        </div>

        {/* Corpo Principal com Rolagem Suave Oculta */}
        {activeTab === 'cadastro' && (
        <form id="client-modal-form" onSubmit={handleSubmit} className="p-3 sm:p-4 space-y-2.5 bg-[#cad4e6] overflow-y-auto scrollbar-none flex-1 text-slate-900">
          
          {/* Card 1: Identificação (PF/PJ + Auto-Busca + Foto IndexedDB) & Contato Principal */}
          <div className="bg-[#e0e6f1] p-3 sm:p-3.5 rounded-xl border border-black shadow-2xs space-y-2.5">
            {/* Barra Superior do Card 1: Seletor PF / PJ */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-slate-400/70">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-900 uppercase tracking-wider">
                  TIPO DE CADASTRO:
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
                    <span className={`w-2.5 h-2.5 rounded-full border flex items-center justify-center ${
                      personType === 'PF' ? 'border-white bg-emerald-400' : 'border-slate-500 bg-white'
                    }`} />
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
                    <span className={`w-2.5 h-2.5 rounded-full border flex items-center justify-center ${
                      personType === 'PJ' ? 'border-white bg-emerald-400' : 'border-slate-500 bg-white'
                    }`} />
                    <span>Pessoa Jurídica</span>
                  </button>
                </div>
              </div>
              <span className="text-[10px] font-semibold text-slate-700">
                Detecção automática ao digitar CPF (11 dígitos) ou CNPJ (14 dígitos)
              </span>
            </div>

            <div className="flex flex-col lg:flex-row gap-3 items-stretch">
              {/* Campos Principais (Esquerda) */}
              <div className="flex-1 min-w-0 space-y-2.5">
                {/* Linha 1: Código Sequencial, CPF/CNPJ (Auto-Busca), Nome do Cliente, Nome Fantasia / Estabelecimento */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1 truncate">
                      CÓDIGO
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={code}
                      title="Código sequencial automático do cliente"
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
                              className="text-[10px] font-bold bg-zinc-800 hover:bg-zinc-700 text-white px-2 py-0.5 rounded-md transition flex items-center space-x-1 cursor-pointer shadow-xs uppercase"
                              title="Fichas preenchidas online aguardando importação"
                            >
                              <Inbox className="w-3 h-3 text-amber-300" />
                              <span>{pendingSubmissions.length} FICHA{pendingSubmissions.length > 1 ? 'S' : ''}</span>
                            </button>

                            {isImportDropdownOpen && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setIsImportDropdownOpen(false)} />
                                <div className="absolute left-0 mt-1 w-64 bg-white text-stone-900 rounded-xl shadow-xl border border-black z-20 overflow-hidden py-1">
                                  <div className="px-3 py-1.5 border-b border-stone-200 bg-stone-50">
                                    <p className="text-[10px] font-bold text-stone-700 uppercase">Fichas Online Recebidas</p>
                                  </div>
                                  <div className="max-h-48 overflow-y-auto divide-y divide-stone-200">
                                    {pendingSubmissions.map(sub => (
                                      <button
                                        key={sub.id}
                                        type="button"
                                        onClick={() => applySubmission(sub)}
                                        className="w-full px-3 py-2 text-left hover:bg-zinc-100 transition flex flex-col cursor-pointer"
                                      >
                                        <div className="flex items-center justify-between">
                                          <span className="font-bold text-xs text-stone-900">{sub.name}</span>
                                          <span className="text-[10px] text-stone-500">{sub.city}/{sub.state}</span>
                                        </div>
                                        <span className="text-[11px] text-stone-600 font-medium">{sub.farmName}</span>
                                        <span className="text-[10px] text-zinc-700">{sub.cpfCnpj || sub.phone}</span>
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
                        value={cpfCnpj}
                        onChange={(e) => handleCpfCnpjChange(e.target.value)}
                        placeholder={personType === 'PJ' ? '00.000.000/0000-00' : '000.000.000-00'}
                        maxLength={18}
                        className="w-full px-3 py-1.5 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-600 pr-8"
                      />
                      <button
                        type="button"
                        onClick={() => searchCnpj()}
                        disabled={isLoadingCnpj}
                        title="Buscar dados deste CNPJ na Receita ou importar ficha do cliente"
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-700 hover:text-black rounded-md transition cursor-pointer"
                      >
                        <Search className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="col-span-1 md:col-span-4">
                    <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1 truncate">
                      {personType === 'PJ' ? 'RAZÃO SOCIAL / RESPONSÁVEL' : 'NOME DO CLIENTE / RESPONSÁVEL'} <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-600"
                    />
                  </div>

                  <div className="col-span-1 md:col-span-3">
                    <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1 truncate">
                      NOME FANTASIA / ESTABELECIMENTO <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={farmName}
                      onChange={(e) => handleFarmNameChange(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-600"
                    />
                  </div>
                </div>

                {/* Linha 2: RG/IE, Data de Nascimento, WhatsApp / Telefone, E-mail Principal / Fiscal, Contato Secundário */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-2.5">
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1 truncate">
                      {personType === 'PJ' ? 'INSCRIÇÃO ESTADUAL' : 'RG / IDENTIDADE'}
                    </label>
                    <input
                      type="text"
                      value={stateRegistration}
                      onChange={(e) => setStateRegistration(e.target.value)}
                      placeholder={personType === 'PJ' ? 'IE ou Isento' : 'Nº do RG'}
                      className="w-full px-3 py-1.5 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-600"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1 truncate">
                      DATA DE NASCIMENTO
                    </label>
                    <input
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-600"
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
                      E-MAIL PRINCIPAL / FISCAL
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="cliente@email.com — usado para envio de notas e boletos"
                      className="w-full px-3 py-1.5 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-600"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1 truncate">
                      CONTATO SECUNDÁRIO / RESPONSÁVEL
                    </label>
                    <input
                      type="text"
                      value={secondaryContact}
                      onChange={(e) => setSecondaryContact(e.target.value)}
                      placeholder="Nome e telefone de contato alternativo..."
                      className="w-full px-3 py-1.5 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-600"
                    />
                  </div>
                </div>
              </div>

              {/* Bloco Compacto da Foto / Avatar do Cliente (Canto Direito do Card 1) */}
              <div className="lg:w-32 shrink-0 flex flex-row lg:flex-col items-center justify-between lg:justify-center gap-2 bg-white border border-black rounded-xl p-2 shadow-2xs">
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarFileChange}
                  className="hidden"
                />
                <div
                  onClick={() => avatarInputRef.current?.click()}
                  title="Clique para selecionar ou alterar a foto do cliente"
                  className="w-16 h-16 lg:w-20 lg:h-20 rounded-xl border border-gray-400 bg-[#e0e6f1] overflow-hidden flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-slate-600 transition shrink-0"
                >
                  {previewAvatarUrl ? (
                    <img
                      src={previewAvatarUrl}
                      alt="Foto do cliente"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-600 px-1 text-center">
                      <User className="w-6 h-6 text-slate-700" />
                      <span className="text-[9px] font-bold uppercase mt-0.5 leading-tight">Sem Foto</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col w-full gap-1">
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="w-full px-2 py-1 rounded-lg bg-[#cad4e6] hover:bg-[#b8c6de] text-slate-900 border border-black text-[10px] font-bold uppercase flex items-center justify-center gap-1 transition cursor-pointer"
                  >
                    <Camera className="w-3 h-3 shrink-0" />
                    <span>{previewAvatarUrl ? 'Alterar' : 'Foto'}</span>
                  </button>
                  {previewAvatarUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      className="w-full px-2 py-0.5 rounded-lg bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 text-[9.5px] font-bold uppercase transition cursor-pointer"
                    >
                      Remover
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: CEP, Endereço, Número, Complemento, Cidade e UF */}
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
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Rua, Avenida, Linha ou Estrada..."
                  className="w-full px-3 py-1.5 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-600"
                />
              </div>

              <div className="col-span-1 md:col-span-2">
                <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1 truncate">
                  NÚMERO / S/N
                </label>
                <input
                  type="text"
                  value={addressNumber}
                  onChange={(e) => setAddressNumber(e.target.value)}
                  placeholder="Ex: 120 ou S/N"
                  className="w-full px-3 py-1.5 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-600"
                />
              </div>

              <div className="col-span-1 md:col-span-3">
                <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1 truncate">
                  COMPLEMENTO / REF.
                </label>
                <input
                  type="text"
                  value={addressComplement}
                  onChange={(e) => setAddressComplement(e.target.value)}
                  placeholder="Sala 02, Galpão, Km 05..."
                  className="w-full px-3 py-1.5 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-600"
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
                  onChange={(e) => setNeighborhood(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-600"
                />
              </div>

              <div className="col-span-1 md:col-span-5">
                <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">
                  CIDADE
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-600"
                />
              </div>

              <div className="col-span-1 md:col-span-2">
                <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">
                  UF / ESTADO
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

          {/* Card 3: Atividade / Segmento & Demanda (Campos Adaptáveis) */}
          <div className="bg-[#e0e6f1] p-3 sm:p-3.5 rounded-xl border border-black shadow-2xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">
                  ATIVIDADE / SEGMENTO
                </label>
                <div className="flex items-center gap-1.5">
                  <SearchableClientCombobox
                    options={activeAtividades}
                    value={atividade}
                    matchBy="label"
                    placeholder="Digite para buscar ou selecione a atividade..."
                    emptyOptionsMessage="Nenhuma opção ativa (clique na engrenagem)"
                    onChange={(opt) => {
                      setAtividade(opt.label);
                      setCattleType(mapAtividadeToCattleType(opt.label));
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setActiveOptionManager('atividade')}
                    className="h-[34px] w-[34px] flex items-center justify-center bg-white hover:bg-slate-100 text-black border border-gray-400 rounded-xl transition cursor-pointer shrink-0"
                    title="Gerenciar opções de Atividade / Segmento"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1 truncate">
                  {complementaryFieldConfig.label1}
                </label>
                <input
                  type={activityProfile === 'pecuaria' ? 'number' : 'text'}
                  value={headCount}
                  onChange={(e) => handleHeadCountChange(e.target.value)}
                  placeholder={complementaryFieldConfig.placeholder1}
                  className="w-full px-3 py-1.5 text-xs sm:text-sm rounded-xl border border-gray-400 bg-white text-black placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-600 font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1 truncate">
                  {complementaryFieldConfig.label2}
                </label>
                <input
                  type={activityProfile === 'pecuaria' ? 'number' : 'text'}
                  inputMode={activityProfile === 'universal' ? 'numeric' : undefined}
                  value={monthlyDemandTons}
                  onChange={(e) => handleField2Change(e.target.value)}
                  placeholder={complementaryFieldConfig.placeholder2}
                  className="w-full px-3 py-1.5 text-xs sm:text-sm rounded-xl border border-gray-400 bg-white text-black placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-600 font-medium"
                />
              </div>
            </div>
          </div>

          {/* Card 4: Comercial / CRM, Contribuinte ICMS, Serviços de Interesse & Observações */}
          <div className="bg-[#e0e6f1] p-3 sm:p-3.5 rounded-xl border border-black shadow-2xs space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-2.5 sm:gap-3">
              <div className="md:col-span-6">
                <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">
                  STATUS NO FUNIL CRM
                </label>
                <div className="flex items-center gap-1.5">
                  <SearchableClientCombobox
                    options={activeCrmStatuses}
                    value={status}
                    matchBy="id"
                    placeholder="Buscar ou selecionar status..."
                    emptyOptionsMessage="Nenhum status ativo (clique na engrenagem)"
                    onChange={(opt) => setStatus(opt.id)}
                  />
                  <button
                    type="button"
                    onClick={() => setActiveOptionManager('status')}
                    className="h-[34px] w-[34px] flex items-center justify-center bg-white hover:bg-slate-100 text-black border border-gray-400 rounded-xl transition cursor-pointer shrink-0"
                    title="Gerenciar opções de Status no Funil CRM"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="md:col-span-6">
                <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">
                  CONTRIBUINTE ICMS
                </label>
                <div className="relative">
                  <select
                    value={contribuinteIcms}
                    onChange={(e) => setContribuinteIcms(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-600 appearance-none pr-8 cursor-pointer"
                  >
                    <option value="">Opcional / Não definido</option>
                    <option value="Não Contribuinte (Isento / PF)">Não Contribuinte (Isento / PF)</option>
                    <option value="Contribuinte ICMS (Com IE)">Contribuinte ICMS (Com IE)</option>
                    <option value="Produtor Rural">Produtor Rural</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-black absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Serviços / Operações de Interesse (Múltipla Escolha) */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-1.5">
                  <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider">
                    SERVIÇOS / OPERAÇÕES DE INTERESSE (MARQUE UM OU MAIS)
                  </label>
                  <button
                    type="button"
                    onClick={() => setActiveOptionManager('servicos')}
                    className="w-5 h-5 flex items-center justify-center bg-white hover:bg-slate-100 text-black border border-gray-400 rounded-md transition cursor-pointer shrink-0"
                    title="Gerenciar opções de Serviços / Operações de Interesse"
                  >
                    <Settings className="w-3 h-3" />
                  </button>
                </div>
                {interestedServices.length > 0 && (
                  <span className="text-[10px] font-bold text-emerald-800 uppercase">
                    {interestedServices.length} {interestedServices.length === 1 ? 'selecionado' : 'selecionados'}
                  </span>
                )}
              </div>

              {activeClientServices.length === 0 ? (
                <div className="px-3 py-1.5 rounded-xl border border-gray-400 bg-white text-xs text-slate-600 font-medium">
                  Nenhum serviço ativo na lista. Clique na engrenagem acima para ativar ou cadastrar.
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {activeClientServices.map((srv) => {
                    const isChecked = interestedServices.includes(srv.label);
                    return (
                      <button
                        key={srv.id}
                        type="button"
                        onClick={() => toggleInterestedService(srv.label)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] border transition cursor-pointer select-none ${
                          isChecked
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-800 font-bold shadow-2xs'
                            : 'bg-white hover:bg-slate-50 text-slate-900 border-gray-400 font-semibold'
                        }`}
                      >
                        <span
                          className={`w-3.5 h-3.5 rounded flex items-center justify-center border shrink-0 ${
                            isChecked
                              ? 'bg-white text-emerald-700 border-white'
                              : 'bg-white border-gray-400'
                          }`}
                        >
                          {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </span>
                        <span>{srv.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">
                OBSERVAÇÕES COMERCIAIS / PREFERÊNCIAS
              </label>
              <textarea
                rows={1}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-600 resize-none h-10 sm:h-11 leading-snug"
              />
            </div>
          </div>

        </form>
        )}

        {activeTab === 'financeiro' && (
          <div className="p-3 sm:p-4 space-y-3 bg-[#cad4e6] overflow-y-auto scrollbar-none flex-1 text-slate-900">
            {/* Card 1: Limite de Crédito, Prazo Preferencial, Tabela de Preço Padrão (PDV) & Trava de Inadimplência */}
            <div className="bg-[#e0e6f1] p-3.5 sm:p-4 rounded-xl border border-black shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-400/70 pb-2">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-slate-900" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    PARÂMETROS FINANCEIROS, CRÉDITO & TABELA DE PREÇO NO PDV
                  </h4>
                </div>
                <span className="text-[10px] font-semibold text-slate-700">
                  Integrado automaticamente ao módulo de Venda (PDV)
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">
                    LIMITE DE CRÉDITO (R$)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={creditLimitInput}
                    onChange={(e) => handleCreditLimitChange(e.target.value)}
                    placeholder="R$ 0,00"
                    className="w-full px-3 py-2 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">
                    CONDIÇÃO / PRAZO PREFERENCIAL
                  </label>
                  <div className="relative">
                    <select
                      value={preferredPaymentTerm}
                      onChange={(e) => setPreferredPaymentTerm(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-600 appearance-none pr-8 cursor-pointer"
                    >
                      <option value="">Opcional / Padrão</option>
                      <option value="À Vista">À Vista</option>
                      <option value="7 Dias">7 Dias</option>
                      <option value="14 Dias">14 Dias</option>
                      <option value="15 Dias">15 Dias</option>
                      <option value="30 Dias">30 Dias</option>
                      <option value="30/60 Dias">30/60 Dias</option>
                      <option value="30/60/90 Dias">30/60/90 Dias</option>
                      <option value="Faturado / Personalizado">Faturado / Personalizado</option>
                      {preferredPaymentTerm &&
                        !['À Vista', '7 Dias', '14 Dias', '15 Dias', '30 Dias', '30/60 Dias', '30/60/90 Dias', 'Faturado / Personalizado'].includes(preferredPaymentTerm) && (
                          <option value={preferredPaymentTerm}>{preferredPaymentTerm}</option>
                        )}
                    </select>
                    <ChevronDown className="w-4 h-4 text-black absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">
                    TABELA DE PREÇO PADRÃO (PDV)
                  </label>
                  <div className="relative">
                    <select
                      value={defaultPriceTable}
                      onChange={(e) =>
                        setDefaultPriceTable(
                          e.target.value as 'custo' | 'venda' | 'atacado' | 'promocional' | ''
                        )
                      }
                      className="w-full px-3 py-2 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-600 appearance-none pr-8 cursor-pointer"
                    >
                      <option value="">Nenhuma / Padrão do PDV</option>
                      <option value="custo">1 - PC (Custo)</option>
                      <option value="venda">2 - PF (Final)</option>
                      <option value="atacado">3 - PA (Atacado)</option>
                      <option value="promocional">4 - PP (Promo)</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-black absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Checkbox de Segurança: Bloqueio de Vendas a Prazo por Parcelas Vencidas */}
              <div className="pt-1">
                <label className="inline-flex items-start sm:items-center gap-2.5 p-2.5 rounded-xl bg-white border border-gray-400 cursor-pointer hover:bg-slate-50 transition w-full">
                  <input
                    type="checkbox"
                    checked={blockOverdueCredit}
                    onChange={(e) => setBlockOverdueCredit(e.target.checked)}
                    className="w-4 h-4 mt-0.5 sm:mt-0 rounded border-gray-500 text-rose-600 focus:ring-rose-500 cursor-pointer shrink-0"
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    <ShieldAlert className={`w-4 h-4 shrink-0 ${blockOverdueCredit ? 'text-rose-600' : 'text-slate-600'}`} />
                    <span className="text-xs font-bold text-slate-900">
                      Bloquear novas vendas a prazo quando houver parcelas vencidas (Inadimplente)
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Card 2: Pessoas Autorizadas a Comprar / Retirar na Conta */}
            <div className="bg-[#e0e6f1] p-3.5 sm:p-4 rounded-xl border border-black shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-400/70 pb-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-900" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    PESSOAS AUTORIZADAS A COMPRAR / RETIRAR NA CONTA
                  </h4>
                </div>
                <span className="text-[10px] font-bold text-slate-800 uppercase">
                  {authorizedBuyers.length} {authorizedBuyers.length === 1 ? 'autorizado' : 'autorizados'}
                </span>
              </div>

              {/* Linha de Adição Rápida */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                <div className="md:col-span-5">
                  <label className="block text-[10px] font-bold text-slate-900 uppercase tracking-wider mb-1">
                    NOME DA PESSOA AUTORIZADA
                  </label>
                  <input
                    type="text"
                    value={newBuyerName}
                    onChange={(e) => setNewBuyerName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddAuthorizedBuyer();
                      }
                    }}
                    placeholder="Ex: João da Silva"
                    className="w-full px-3 py-1.5 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-600"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-[10px] font-bold text-slate-900 uppercase tracking-wider mb-1">
                    CPF / TELEFONE
                  </label>
                  <input
                    type="text"
                    value={newBuyerDocPhone}
                    onChange={(e) => setNewBuyerDocPhone(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddAuthorizedBuyer();
                      }
                    }}
                    placeholder="CPF ou WhatsApp"
                    className="w-full px-3 py-1.5 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-600"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-[10px] font-bold text-slate-900 uppercase tracking-wider mb-1">
                    PARENTESCO / CARGO
                  </label>
                  <input
                    type="text"
                    value={newBuyerRole}
                    onChange={(e) => setNewBuyerRole(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddAuthorizedBuyer();
                      }
                    }}
                    placeholder="Ex: Filho, Gerente, Motorista"
                    className="w-full px-3 py-1.5 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-600"
                  />
                </div>

                <div className="md:col-span-1">
                  <button
                    type="button"
                    onClick={handleAddAuthorizedBuyer}
                    className="w-full h-[34px] px-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 border border-black font-bold text-xs uppercase flex items-center justify-center gap-1 transition cursor-pointer shadow-2xs"
                    title="Adicionar pessoa autorizada"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span className="md:hidden">Adicionar</span>
                  </button>
                </div>
              </div>

              {/* Lista de Pessoas Autorizadas */}
              {authorizedBuyers.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-400 px-3 py-3 text-xs text-slate-600 font-medium text-center">
                  Nenhuma pessoa autorizada cadastrada. Utilize os campos acima para incluir compradores ou portadores autorizados.
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-400 overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 border-b border-gray-300 text-[10px] font-bold uppercase text-slate-900">
                        <th className="py-2 px-3">Nome Completo</th>
                        <th className="py-2 px-3">CPF / Telefone</th>
                        <th className="py-2 px-3">Parentesco / Cargo</th>
                        <th className="py-2 px-3 text-right w-16">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {authorizedBuyers.map((buyer) => (
                        <tr key={buyer.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-bold text-slate-900">{buyer.name}</td>
                          <td className="py-2 px-3 text-slate-800">{buyer.documentOrPhone || '—'}</td>
                          <td className="py-2 px-3 text-slate-800">{buyer.relationshipOrRole || '—'}</td>
                          <td className="py-2 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveAuthorizedBuyer(buyer.id)}
                              className="p-1 text-rose-700 hover:bg-rose-50 rounded-md transition cursor-pointer"
                              title="Remover autorizado"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'historico' && (
          <div className="p-3.5 sm:p-5 space-y-3 bg-[#cad4e6] overflow-y-auto flex-1 min-h-0 flex flex-col justify-start text-slate-900">
            <div className="space-y-3">
              {/* 4 Cards de Resumo */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-[#e0e6f1] p-3 rounded-xl border border-black shadow-2xs">
                  <div className="flex items-center justify-between text-slate-800 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider">Total Comprado</span>
                    <DollarSign className="w-3.5 h-3.5 text-emerald-700" />
                  </div>
                  <p className="text-base sm:text-lg font-black text-emerald-800">
                    {formatCurrencyBRL(totalGasto)}
                  </p>
                </div>

                <div className="bg-[#e0e6f1] p-3 rounded-xl border border-black shadow-2xs">
                  <div className="flex items-center justify-between text-slate-800 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider">Pedidos / Vendas</span>
                    <Receipt className="w-3.5 h-3.5 text-slate-900" />
                  </div>
                  <p className="text-base sm:text-lg font-black text-slate-900">
                    {clientPurchases.length}
                  </p>
                </div>

                <div className="bg-[#e0e6f1] p-3 rounded-xl border border-black shadow-2xs">
                  <div className="flex items-center justify-between text-slate-800 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider">Ticket Médio</span>
                    <ShoppingBag className="w-3.5 h-3.5 text-blue-700" />
                  </div>
                  <p className="text-base sm:text-lg font-black text-blue-800">
                    {formatCurrencyBRL(ticketMedio)}
                  </p>
                </div>

                <div className="bg-[#e0e6f1] p-3 rounded-xl border border-black shadow-2xs">
                  <div className="flex items-center justify-between text-slate-800 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider">Última Compra</span>
                    <Calendar className="w-3.5 h-3.5 text-amber-700" />
                  </div>
                  <p className="text-base sm:text-lg font-black text-slate-900">
                    {dataUltimaCompra}
                  </p>
                </div>
              </div>

              {/* Barra de Filtro / Busca */}
              <div className="bg-[#e0e6f1] p-2.5 rounded-xl border border-black shadow-2xs flex items-center justify-between gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={historicoSearch}
                    onChange={(e) => setHistoricoSearch(e.target.value)}
                    placeholder="Buscar por número do pedido, produto, serviço ou forma de pagamento..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-gray-400 bg-white text-xs text-black placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-600"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-600 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  {historicoSearch && (
                    <button
                      type="button"
                      onClick={() => setHistoricoSearch('')}
                      className="text-xs text-slate-600 hover:text-black absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <span className="text-[11px] font-bold text-slate-900 whitespace-nowrap">
                  {filteredPurchases.length} {filteredPurchases.length === 1 ? 'registro' : 'registros'}
                </span>
              </div>

              {/* Tabela de Vendas */}
              {filteredPurchases.length === 0 ? (
                <div className="bg-[#e0e6f1] p-8 rounded-xl border border-black text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-white border border-black text-slate-700 mx-auto flex items-center justify-center">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Nenhuma compra registrada no histórico do PDV
                  </p>
                  <p className="text-[11px] text-slate-800 max-w-md mx-auto">
                    As vendas de balcão e contratos emitidos para este cliente através do Frente de Caixa serão sincronizados automaticamente nesta tela.
                  </p>
                </div>
              ) : (
                <div className="bg-[#e0e6f1] p-2 rounded-xl border border-black overflow-hidden shadow-2xs">
                  <div className="bg-white rounded-lg border border-gray-400 overflow-x-auto max-h-[46vh]">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 z-10 bg-slate-100">
                        <tr className="border-b border-gray-400 text-[10px] font-bold text-slate-900 uppercase tracking-wider">
                          <th className="py-2.5 px-3">Nº Pedido</th>
                          <th className="py-2.5 px-3">Data & Hora</th>
                          <th className="py-2.5 px-3">Itens / Produtos Adquiridos</th>
                          <th className="py-2.5 px-3">Pagamento</th>
                          <th className="py-2.5 px-3 text-right">Total Líquido</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 text-xs">
                        {filteredPurchases.map((sale: any) => {
                          const orderId = sale.orderNumber || sale.id;
                          const dateDisplay = (() => {
                            const rawDate = sale.data || sale.date;
                            if (!rawDate) return '—';
                            try {
                              const [y, m, d] = rawDate.split('T')[0].split('-');
                              const timePart = sale.hora || sale.time || '';
                              return `${d}/${m}/${y}${timePart ? ` • ${timePart}` : ''}`;
                            } catch {
                              return rawDate;
                            }
                          })();
                          const valorNum = Number(sale.valorLiquido ?? sale.totalLiquido ?? sale.totalAmount ?? 0);
                          const isPrazo = sale.formaPagamento === 'prazo' || sale.status === 'pendente';
                          const itemsList = Array.isArray(sale.itens) ? sale.itens : [];

                          return (
                            <tr key={orderId} className="hover:bg-slate-50 transition">
                              <td className="py-2.5 px-3 font-mono font-bold text-[11px] text-zinc-900 whitespace-nowrap">
                                <span className="px-1.5 py-0.5 rounded bg-zinc-100 border border-zinc-300">
                                  {orderId}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-[11px] text-zinc-700 whitespace-nowrap font-medium">
                                {dateDisplay}
                              </td>
                              <td className="py-2.5 px-3">
                                {itemsList.length > 0 ? (
                                  <div className="space-y-1">
                                    {itemsList.map((it: any, idx: number) => (
                                      <div key={idx} className="flex items-center space-x-1.5 text-[11px] text-zinc-800">
                                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                        <span className="font-bold text-zinc-900">{it.quantidade} {it.unidade || 'UN'}</span>
                                        <span className="text-zinc-500">•</span>
                                        <span className="truncate max-w-xs">{it.descricao || 'Produto/Serviço'}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-zinc-500 italic">Venda PDV balcão</span>
                                )}
                                {Array.isArray(sale.fretes) && sale.fretes.length > 0 && (
                                  <div className="mt-1 text-[10px] text-blue-700 font-semibold flex items-center space-x-1">
                                    <span>+ Frete Vinculado: {sale.fretes.map((f: any) => f.veiculoIdentificacao).join(', ')}</span>
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-[11px] text-zinc-800 font-medium">
                                <div className="truncate max-w-[150px]">
                                  {sale.forma || sale.formaPagamento || 'À VISTA'}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-right font-black text-xs text-zinc-900 whitespace-nowrap">
                                {formatCurrencyBRL(valorNum)}
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                  isPrazo 
                                    ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                                    : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                }`}>
                                  {isPrazo ? 'A PRAZO / PENDENTE' : 'CONCLUÍDO / PAGO'}
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
                disabled={navigableClients.length === 0 || currentRecordIndex === 0}
                title="Primeiro cliente"
                className="px-2 py-1.5 text-slate-900 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed border-r border-slate-300 transition cursor-pointer flex items-center gap-1 text-[10px] font-bold uppercase"
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Primeiro</span>
              </button>
              <button
                type="button"
                onClick={() => handleNavigateRecord('prev')}
                disabled={navigableClients.length === 0 || currentRecordIndex === 0}
                title="Cliente anterior"
                className="px-2 py-1.5 text-slate-900 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed border-r border-slate-300 transition cursor-pointer flex items-center gap-1 text-[10px] font-bold uppercase"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Anterior</span>
              </button>
              <span className="px-2.5 py-1 text-[10px] font-bold text-slate-800 bg-slate-50 border-r border-slate-300 whitespace-nowrap">
                {currentRecordIndex >= 0
                  ? `${currentRecordIndex + 1} / ${navigableClients.length}`
                  : `Novo (${navigableClients.length})`}
              </span>
              <button
                type="button"
                onClick={() => handleNavigateRecord('next')}
                disabled={
                  navigableClients.length === 0 ||
                  (currentRecordIndex >= 0 && currentRecordIndex >= navigableClients.length - 1)
                }
                title="Próximo cliente"
                className="px-2 py-1.5 text-slate-900 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed border-r border-slate-300 transition cursor-pointer flex items-center gap-1 text-[10px] font-bold uppercase"
              >
                <span className="hidden sm:inline">Próximo</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleNavigateRecord('last')}
                disabled={
                  navigableClients.length === 0 ||
                  currentRecordIndex === navigableClients.length - 1
                }
                title="Último cliente"
                className="px-2 py-1.5 text-slate-900 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer flex items-center gap-1 text-[10px] font-bold uppercase"
              >
                <span className="hidden sm:inline">Último</span>
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10.5px] text-slate-800 uppercase">
              <span className="inline-flex items-center space-x-1">
                <span className="font-bold text-slate-900">CADASTRO:</span>
                <span>{activeClient ? (formatDateTimeBR(activeClient.createdAt) || '—') : formatDateTimeBR(new Date().toISOString())}</span>
              </span>
              {activeClient?.updatedAt && (
                <>
                  <span className="text-slate-600 hidden sm:inline">•</span>
                  <span className="inline-flex items-center space-x-1">
                    <span className="font-bold text-slate-900">ALTERADO:</span>
                    <span>{formatDateTimeBR(activeClient.updatedAt)}</span>
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Direita: Ações Rápidas [➕ Novo] [🖨️ Imprimir Ficha] [🗑️ Excluir] [Cancelar] [Sair] [💾 SALVAR CLIENTE] */}
          <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={handleNewRecord}
              title="Limpar formulário e iniciar novo cliente"
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

            {activeClient && (
              <button
                type="button"
                onClick={() => void handleDeleteRecord()}
                title="Excluir este cliente"
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
              onClick={handleAttemptClose}
              title="Fechar janela de cadastro"
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-[11px] sm:text-xs font-bold shadow-2xs transition cursor-pointer border border-black uppercase"
            >
              Sair
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={() => void saveClientData()}
              className="px-4 sm:px-5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-60 text-white text-[11px] sm:text-xs font-bold shadow-xs transition cursor-pointer border border-emerald-800 uppercase inline-flex items-center gap-1.5"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{activeClient ? 'ATUALIZAR CLIENTE' : 'SALVAR CLIENTE'}</span>
            </button>
          </div>
        </div>

      </div>

      {/* Sub-modal Gerenciador: Atividade / Segmento */}
      <ClientOptionsManagerModal
        isOpen={activeOptionManager === 'atividade'}
        onClose={() => setActiveOptionManager(null)}
        title="Gerenciar Opções de Atividade / Segmento"
        subtitle="Marque quais ramos de atuação aparecem no seletor ou cadastre novas opções"
        inputLabel="Incluir Nova Atividade / Ramo de Atuação"
        inputPlaceholder="Ex: Transportadora, Supermercado, Agroindústria..."
        items={atividadesCatalog}
        onSave={(updatedCatalog, newlyAdded, renamedLabels) => {
          const saved = saveStoredAtividadesCatalog(updatedCatalog);
          setAtividadesCatalog(saved);
          const nextActive = saved.filter((i) => i.active);
          if (newlyAdded && newlyAdded.active) {
            setAtividade(newlyAdded.label);
            setCattleType(mapAtividadeToCattleType(newlyAdded.label));
          } else if (renamedLabels && atividade && renamedLabels[atividade]) {
            const nextLabel = renamedLabels[atividade];
            setAtividade(nextLabel);
            setCattleType(mapAtividadeToCattleType(nextLabel));
          } else if (
            atividade &&
            !nextActive.some((i) => String(i.label ?? '').toLowerCase() === String(atividade ?? '').trim().toLowerCase())
          ) {
            const fallback = nextActive[0]?.label || '';
            setAtividade(fallback);
            setCattleType(mapAtividadeToCattleType(fallback));
          }
        }}
        zIndexClass="z-[9999]"
      />

      {/* Sub-modal Gerenciador: Status no Funil CRM */}
      <ClientOptionsManagerModal
        isOpen={activeOptionManager === 'status'}
        onClose={() => setActiveOptionManager(null)}
        title="Gerenciar Opções de Status no Funil CRM"
        subtitle="Marque quais estágios comerciais/financeiros aparecem no seletor ou cadastre novos"
        inputLabel="Incluir Novo Status / Estágio no Funil"
        inputPlaceholder="Ex: Aguardando Análise de Crédito, Cliente Premium..."
        items={crmStatusCatalog}
        onSave={(updatedCatalog, newlyAdded) => {
          const saved = saveStoredCrmStatusCatalog(updatedCatalog);
          setCrmStatusCatalog(saved);
          const nextActive = saved.filter((i) => i.active);
          if (newlyAdded && newlyAdded.active) {
            setStatus(newlyAdded.id);
          } else if (
            status &&
            !nextActive.some(
              (i) =>
                String(i.id ?? '').toLowerCase() === String(status ?? '').trim().toLowerCase() ||
                String(i.label ?? '').toLowerCase() === String(status ?? '').trim().toLowerCase()
            )
          ) {
            setStatus(nextActive[0]?.id || '');
          }
        }}
        zIndexClass="z-[9999]"
      />

      {/* Sub-modal Gerenciador: Serviços / Operações de Interesse */}
      <ClientOptionsManagerModal
        isOpen={activeOptionManager === 'servicos'}
        onClose={() => setActiveOptionManager(null)}
        title="Gerenciar Serviços / Operações de Interesse"
        subtitle="Cadastre, edite ou oculte os tipos de serviços e operações exibidos no cadastro"
        inputLabel="Incluir Novo Serviço / Operação"
        inputPlaceholder="Ex: Ensacamento, Consultoria Técnica, Locação..."
        items={clientServicesCatalog}
        onSave={(updatedCatalog, newlyAdded, renamedLabels) => {
          const saved = saveStoredClientServicesCatalog(updatedCatalog);
          setClientServicesCatalog(saved);
          setInterestedServices((prev) => {
            let next = prev.map((lbl) => (renamedLabels && renamedLabels[lbl] ? renamedLabels[lbl] : lbl));
            if (newlyAdded && newlyAdded.active && !next.includes(newlyAdded.label)) {
              next = [...next, newlyAdded.label];
            }
            return next;
          });
        }}
        zIndexClass="z-[9999]"
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
          if (res.street) setAddress(res.street);
          if (res.neighborhood) setNeighborhood(res.neighborhood);
          if (res.city) setCity(res.city);
          if (res.state) setState(res.state);
          setFeedback({
            type: 'success',
            message: `✅ CEP ${res.cep} preenchido (${res.city}/${res.state}).`,
          });
          setTimeout(() => setFeedback(null), 3500);
        }}
        zIndexClass="z-[10010]"
      />
    </div>
  );
};

// Aliases para uso unificado e flexível em outros módulos
export const NewClientModal = ClientModal;
export const UnifiedClientModal = ClientModal;
export default ClientModal;
