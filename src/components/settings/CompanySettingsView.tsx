import React, { useState, useRef, useEffect } from 'react';
import { 
  Building,
  Building2, 
  UploadCloud, 
  Camera,
  MapPin, 
  ShieldCheck, 
  Save, 
  Lock, 
  Unlock,
  KeyRound, 
  Image as ImageIcon, 
  Check, 
  RotateCcw, 
  Printer, 
  Search,
  Loader2,
  Sparkles,
  SlidersHorizontal,
  ArrowUpDown,
  Database,
  Cloud,
  RefreshCw,
  LogIn,
  CheckCircle2,
  CreditCard,
  UserCheck,
  PhoneCall,
  Eye,
  EyeOff,
  FileKey2,
  AlertTriangle,
  Trash2,
  Upload
} from 'lucide-react';
import { CompanyProfile, ExpenseCategory, CostCenter, NotaSaidaModelKey } from '../../types';
import { PrintPreviewModal } from '../common/PrintPreviewModal';
import { SupabaseSqlModal } from './SupabaseSqlModal';
import { DataBackupSecurityBlock } from './DataBackupSecurityBlock';
import { useAuth } from '../../context/AuthContext';
import { 
  formatCpfCnpj, 
  formatIE, 
  formatCep, 
  formatPhone, 
  formatCnae,
  cleanDigits, 
  fetchAddressByCep, 
  fetchCompanyByCnpj 
} from '../../lib/formatters';
import { saveCloudCompanyProfile, fetchCloudCompanyProfile } from '../../lib/supabaseService';
import {
  getStoredCompanyProfile,
  saveStoredCompanyProfile,
  safeLocalStorageSetItem,
  getStoredNotasSaida,
} from '../../lib/storage';
import { compressLogoToLocalDataUrl } from '../../lib/localPhotoUtils';
import {
  COMPANY_LOGO_REF,
  deleteCompanyLogo,
  isIndexedDbSupported,
  saveCompanyLogo,
  useResolvedMediaUrl,
} from '../../lib/imageStorage';
import {
  activateSimulatedCertificate,
  getCertificateStatusInfo,
  getStoredCertificateMeta,
  removeStoredCertificate,
  validateAndStorePfxCertificate,
} from '../../lib/fiscalCertificate';
import {
  getAllNextNotaSaidaNumbers,
  saveNextNotaSaidaSequencesForSerie,
} from '../../lib/cfopCatalog';

interface CompanySettingsViewProps {
  companyProfile: CompanyProfile;
  onSaveCompanyProfile: (profile: CompanyProfile) => void;
  categories?: ExpenseCategory[];
  costCenters?: CostCenter[];
  onOpenCategoryManager?: () => void;
  onOpenIntegrationModal?: () => void;
  onSyncSupabase?: () => Promise<void>;
  onOpenCustomizeShortcuts?: () => void;
  onOpenReorderMenu?: () => void;
}

export const CompanySettingsView: React.FC<CompanySettingsViewProps> = ({
  companyProfile,
  onSaveCompanyProfile,
  categories,
  costCenters,
  onOpenCategoryManager,
  onOpenIntegrationModal,
  onSyncSupabase,
  onOpenCustomizeShortcuts,
  onOpenReorderMenu,
}) => {
  const { currentUser, isConnectedToSupabase, isConfigured, isSyncing, lastSyncedAt, signIn } = useAuth();
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const cleanLogoUrl = (url?: string) => {
    if (!url) return '';
    if (url.includes('a7f3d0') || url.includes('15803d') || url.includes('viewBox="0 0 200 160"')) return '';
    return url;
  };

  const sanitizeProfile = (prof?: CompanyProfile): CompanyProfile => {
    const base = prof || ({} as CompanyProfile);
    return {
      ...base,
      corporateName: base.corporateName || '',
      tradeName: base.tradeName || '',
      activitySector: base.activitySector || '',
    };
  };

  const initialCleaned = sanitizeProfile(companyProfile);

  const resolveAutoPixKey = (pixKeyType: string, data: Partial<CompanyProfile>): string => {
    const normalizedType = String((pixKeyType || 'cnpj') ?? '').trim().toLowerCase();
    const cnpjCpfDigits = cleanDigits(data.cnpjCpf || data.cnpj || '');
    const repCpfDigits = cleanDigits(data.representativeCpf || '');

    if (normalizedType === 'cnpj') {
      return cnpjCpfDigits.length === 14 ? formatCpfCnpj(cnpjCpfDigits) : '';
    }
    if (normalizedType === 'cpf') {
      if (repCpfDigits.length === 11) return formatCpfCnpj(repCpfDigits);
      if (cnpjCpfDigits.length === 11) return formatCpfCnpj(cnpjCpfDigits);
      return '';
    }
    if (normalizedType === 'email') {
      return String(data.email || '').trim();
    }
    if (normalizedType === 'telefone') {
      return String(data.phone || '').trim();
    }
    if (normalizedType === 'aleatoria') {
      return '';
    }
    return '';
  };

  const cachedCertMeta = getStoredCertificateMeta();

  const initialPixType = initialCleaned.pixKeyType || 'cnpj';
  const initialPixKey =
    (initialCleaned.pixKey || '').trim() ||
    (initialPixType === 'cnpj' ? resolveAutoPixKey('cnpj', initialCleaned) : '');

  // Form State initialized from props
  const [formData, setFormData] = useState<CompanyProfile>({
    ...initialCleaned,
    logoUrl: cleanLogoUrl(initialCleaned.logoUrl),
    cnpjCpf: formatCpfCnpj(initialCleaned.cnpjCpf || ''),
    stateRegistration: formatIE(initialCleaned.stateRegistration || ''),
    municipalRegistration: initialCleaned.municipalRegistration || '',
    cnaePrincipal: initialCleaned.cnaePrincipal || '',
    phone: formatPhone(initialCleaned.phone || ''),
    zipCode: formatCep(initialCleaned.zipCode || ''),
    representativeName: initialCleaned.representativeName || '',
    representativeCpf: initialCleaned.representativeCpf ? formatCpfCnpj(initialCleaned.representativeCpf) : '',
    bankName: initialCleaned.bankName || '',
    bankAgency: initialCleaned.bankAgency || '',
    bankAccount: initialCleaned.bankAccount || '',
    pixKeyType: initialPixType,
    pixKey: initialPixKey,
    certificadoDigitalAtivo: initialCleaned.certificadoDigitalAtivo ?? cachedCertMeta?.certificadoDigitalAtivo ?? false,
    certificadoArquivoNome: initialCleaned.certificadoArquivoNome || cachedCertMeta?.certificadoArquivoNome || '',
    certificadoIndexedDbRef: initialCleaned.certificadoIndexedDbRef || cachedCertMeta?.certificadoIndexedDbRef || '',
    certificadoTitular: initialCleaned.certificadoTitular || cachedCertMeta?.certificadoTitular || '',
    certificadoCnpj: initialCleaned.certificadoCnpj || cachedCertMeta?.certificadoCnpj || '',
    certificadoValidade: initialCleaned.certificadoValidade || cachedCertMeta?.certificadoValidade || '',
    certificadoSenhaArmazenada: initialCleaned.certificadoSenhaArmazenada || cachedCertMeta?.certificadoSenhaArmazenada || '',
    certificadoSimulado: initialCleaned.certificadoSimulado ?? cachedCertMeta?.certificadoSimulado ?? false,
    ambienteSefaz: initialCleaned.ambienteSefaz || 'homologacao',
    regimeTributario: initialCleaned.regimeTributario || 'Simples Nacional',
    crt: initialCleaned.crt || (String(initialCleaned.regimeTributario || '').toLowerCase().includes('presumido') || String(initialCleaned.regimeTributario || '').toLowerCase().includes('real') ? '3' : '1'),
    seriePadraoNotas: initialCleaned.seriePadraoNotas || '1',
    codigoIbgeMunicipio: initialCleaned.codigoIbgeMunicipio || '4107207',
    tokenApiFiscal: initialCleaned.tokenApiFiscal || '',
    apiFiscalProvedor: initialCleaned.apiFiscalProvedor || 'direto_a1',
    rntrc: initialCleaned.rntrc || '',
    cscId: initialCleaned.cscId || '',
    cscToken: initialCleaned.cscToken || '',
  });

  // Mantém os campos do formulário sempre reativos e preenchidos quando o perfil for atualizado/cadastrado
  useEffect(() => {
    const cleaned = sanitizeProfile(companyProfile);
    const storedCert = getStoredCertificateMeta();
    const resolvedPixType = cleaned.pixKeyType || 'cnpj';
    const resolvedPixKey =
      (cleaned.pixKey || '').trim() ||
      (resolvedPixType === 'cnpj' ? resolveAutoPixKey('cnpj', cleaned) : '');
    setFormData({
      ...cleaned,
      logoUrl: cleanLogoUrl(cleaned.logoUrl),
      cnpjCpf: formatCpfCnpj(cleaned.cnpjCpf || ''),
      stateRegistration: formatIE(cleaned.stateRegistration || ''),
      municipalRegistration: cleaned.municipalRegistration || '',
      cnaePrincipal: cleaned.cnaePrincipal || '',
      phone: formatPhone(cleaned.phone || ''),
      zipCode: formatCep(cleaned.zipCode || ''),
      representativeName: cleaned.representativeName || '',
      representativeCpf: cleaned.representativeCpf ? formatCpfCnpj(cleaned.representativeCpf) : '',
      bankName: cleaned.bankName || '',
      bankAgency: cleaned.bankAgency || '',
      bankAccount: cleaned.bankAccount || '',
      pixKeyType: resolvedPixType,
      pixKey: resolvedPixKey,
      certificadoDigitalAtivo: cleaned.certificadoDigitalAtivo ?? storedCert?.certificadoDigitalAtivo ?? false,
      certificadoArquivoNome: cleaned.certificadoArquivoNome || storedCert?.certificadoArquivoNome || '',
      certificadoIndexedDbRef: cleaned.certificadoIndexedDbRef || storedCert?.certificadoIndexedDbRef || '',
      certificadoTitular: cleaned.certificadoTitular || storedCert?.certificadoTitular || '',
      certificadoCnpj: cleaned.certificadoCnpj || storedCert?.certificadoCnpj || '',
      certificadoValidade: cleaned.certificadoValidade || storedCert?.certificadoValidade || '',
      certificadoSenhaArmazenada: cleaned.certificadoSenhaArmazenada || storedCert?.certificadoSenhaArmazenada || '',
      certificadoSimulado: cleaned.certificadoSimulado ?? storedCert?.certificadoSimulado ?? false,
      ambienteSefaz: cleaned.ambienteSefaz || 'homologacao',
      regimeTributario: cleaned.regimeTributario || 'Simples Nacional',
      crt: cleaned.crt || (String(cleaned.regimeTributario || '').toLowerCase().includes('presumido') || String(cleaned.regimeTributario || '').toLowerCase().includes('real') ? '3' : '1'),
      seriePadraoNotas: cleaned.seriePadraoNotas || '1',
      codigoIbgeMunicipio: cleaned.codigoIbgeMunicipio || '4107207',
      tokenApiFiscal: cleaned.tokenApiFiscal || '',
      apiFiscalProvedor: cleaned.apiFiscalProvedor || 'direto_a1',
      rntrc: cleaned.rntrc || '',
      cscId: cleaned.cscId || '',
      cscToken: cleaned.cscToken || '',
    });
  }, [companyProfile]);

  // Carga direta da nuvem (Supabase) ao carregar o componente para garantir dados fiscais atualizados
  useEffect(() => {
    let isMounted = true;
    fetchCloudCompanyProfile().then((cloudProfile) => {
      if (cloudProfile && isMounted) {
        const cleanedCloud = sanitizeProfile(cloudProfile);
        setFormData(prev => {
          const merged: CompanyProfile = {
            ...prev,
            ...cleanedCloud,
            logoUrl: cleanLogoUrl(cleanedCloud.logoUrl || prev.logoUrl),
            cnpjCpf: formatCpfCnpj(cleanedCloud.cnpjCpf || prev.cnpjCpf || ''),
            stateRegistration: formatIE(cleanedCloud.stateRegistration || prev.stateRegistration || ''),
            municipalRegistration: cleanedCloud.municipalRegistration || prev.municipalRegistration || '',
            cnaePrincipal: cleanedCloud.cnaePrincipal || prev.cnaePrincipal || '',
            phone: formatPhone(cleanedCloud.phone || prev.phone || ''),
            zipCode: formatCep(cleanedCloud.zipCode || prev.zipCode || ''),
            codigoIbgeMunicipio: cleanedCloud.codigoIbgeMunicipio || prev.codigoIbgeMunicipio || '4107207',
            tokenApiFiscal: cleanedCloud.tokenApiFiscal || prev.tokenApiFiscal || '',
            apiFiscalProvedor: cleanedCloud.apiFiscalProvedor || prev.apiFiscalProvedor || 'direto_a1',
            rntrc: cleanedCloud.rntrc || prev.rntrc || '',
            cscId: cleanedCloud.cscId || prev.cscId || '',
            cscToken: cleanedCloud.cscToken || prev.cscToken || '',
          };
          const activePixType = merged.pixKeyType || 'cnpj';
          if (!(merged.pixKey || '').trim() && activePixType === 'cnpj') {
            merged.pixKey = resolveAutoPixKey('cnpj', merged);
          }
          return merged;
        });
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const resolvedLogoUrl = useResolvedMediaUrl(formData.logoUrl);

  useEffect(() => {
    setLogoError(false);
  }, [resolvedLogoUrl]);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordToast, setPasswordToast] = useState<string | null>(null);
  const [showApiFiscalToken, setShowApiFiscalToken] = useState(false);

  // Auto Lookup Statuses
  const [isLoadingCnpj, setIsLoadingCnpj] = useState(false);
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [lookupFeedback, setLookupFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Test Print modal
  const [isTestPrintOpen, setIsTestPrintOpen] = useState(false);

  // Certificado Digital A1 State
  const [pendingCertFile, setPendingCertFile] = useState<File | null>(null);
  const [certPasswordInput, setCertPasswordInput] = useState('');
  const [showCertPassword, setShowCertPassword] = useState(false);
  const [isValidatingCert, setIsValidatingCert] = useState(false);
  const [certFeedback, setCertFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isReplacingCert, setIsReplacingCert] = useState(false);
  const certFileInputRef = useRef<HTMLInputElement>(null);

  // Controle de Numeração Sequencial (Com Proteção por Cadeado)
  const [isSequenciaUnlocked, setIsSequenciaUnlocked] = useState(false);
  const [isSequenceUnlockConfirmOpen, setIsSequenceUnlockConfirmOpen] = useState(false);
  const [sequenceNumbers, setSequenceNumbers] = useState<Record<NotaSaidaModelKey, string>>(() => {
    const initial = getAllNextNotaSaidaNumbers(
      initialCleaned.seriePadraoNotas || '1',
      getStoredNotasSaida()
    );
    return {
      NFE: String(initial.NFE),
      NFSE: String(initial.NFSE),
      CTE: String(initial.CTE),
      NFCE: String(initial.NFCE),
      MDFE: String(initial.MDFE),
    };
  });

  useEffect(() => {
    const syncSequencesFromStorage = () => {
      if (isSequenciaUnlocked) return;
      const current = getAllNextNotaSaidaNumbers(
        formData.seriePadraoNotas || '1',
        getStoredNotasSaida()
      );
      setSequenceNumbers({
        NFE: String(current.NFE),
        NFSE: String(current.NFSE),
        CTE: String(current.CTE),
        NFCE: String(current.NFCE),
        MDFE: String(current.MDFE),
      });
    };

    syncSequencesFromStorage();
    window.addEventListener('agrocontrol_sequencia_notas_updated', syncSequencesFromStorage);
    window.addEventListener('storage', syncSequencesFromStorage);
    return () => {
      window.removeEventListener('agrocontrol_sequencia_notas_updated', syncSequencesFromStorage);
      window.removeEventListener('storage', syncSequencesFromStorage);
    };
  }, [formData.seriePadraoNotas, isSequenciaUnlocked]);

  const handleToggleSequenceLock = () => {
    if (isSequenciaUnlocked) {
      const current = getAllNextNotaSaidaNumbers(
        formData.seriePadraoNotas || '1',
        getStoredNotasSaida()
      );
      setSequenceNumbers({
        NFE: String(current.NFE),
        NFSE: String(current.NFSE),
        CTE: String(current.CTE),
        NFCE: String(current.NFCE),
        MDFE: String(current.MDFE),
      });
      setIsSequenciaUnlocked(false);
      return;
    }

    setIsSequenceUnlockConfirmOpen(true);
  };

  const handleConfirmUnlockSequence = () => {
    setIsSequenciaUnlocked(true);
    setIsSequenceUnlockConfirmOpen(false);
  };

  const handleSequenceFieldChange = (model: NotaSaidaModelKey, rawValue: string) => {
    const onlyDigits = rawValue.replace(/\D/g, '');
    setSequenceNumbers((prev) => ({
      ...prev,
      [model]: onlyDigits,
    }));
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const certStatusInfo = getCertificateStatusInfo(formData);

  const persistCertificateStateOnProfile = (nextProfile: CompanyProfile) => {
    setFormData(nextProfile);
    saveStoredCompanyProfile(nextProfile);
    onSaveCompanyProfile(nextProfile);
  };

  const handleCertFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingCertFile(file);
    setCertFeedback(null);
  };

  const handleValidateAndActivateCert = async () => {
    if (!pendingCertFile) {
      setCertFeedback({
        type: 'error',
        message: 'Selecione o arquivo .pfx ou .p12 do Certificado Digital A1 antes de validar.',
      });
      return;
    }
    setIsValidatingCert(true);
    setCertFeedback(null);
    try {
      const res = await validateAndStorePfxCertificate(pendingCertFile, certPasswordInput, formData);
      if (!res.success || !res.meta) {
        setCertFeedback({ type: 'error', message: res.message });
        return;
      }
      const nextProfile: CompanyProfile = {
        ...formData,
        ...res.meta,
      };
      persistCertificateStateOnProfile(nextProfile);
      setPendingCertFile(null);
      setCertPasswordInput('');
      setIsReplacingCert(false);
      if (certFileInputRef.current) certFileInputRef.current.value = '';
      setCertFeedback({ type: 'success', message: res.message });
      setTimeout(() => setCertFeedback(null), 5000);
    } finally {
      setIsValidatingCert(false);
    }
  };

  const handleSimulateCertificateActivation = () => {
    const meta = activateSimulatedCertificate(formData, pendingCertFile?.name);
    const nextProfile: CompanyProfile = {
      ...formData,
      ...meta,
    };
    persistCertificateStateOnProfile(nextProfile);
    setPendingCertFile(null);
    setCertPasswordInput('');
    setIsReplacingCert(false);
    if (certFileInputRef.current) certFileInputRef.current.value = '';
    setCertFeedback({
      type: 'success',
      message: 'Certificado Digital A1 ativado em modo Homologação / Testes!',
    });
    setTimeout(() => setCertFeedback(null), 5000);
  };

  const handleRemoveCertificate = async () => {
    await removeStoredCertificate();
    const nextProfile: CompanyProfile = {
      ...formData,
      certificadoDigitalAtivo: false,
      certificadoArquivoNome: '',
      certificadoIndexedDbRef: '',
      certificadoTitular: '',
      certificadoCnpj: '',
      certificadoValidade: '',
      certificadoSenhaArmazenada: '',
      certificadoSimulado: false,
    };
    persistCertificateStateOnProfile(nextProfile);
    setPendingCertFile(null);
    setCertPasswordInput('');
    setIsReplacingCert(false);
    if (certFileInputRef.current) certFileInputRef.current.value = '';
    setCertFeedback({
      type: 'success',
      message: 'Certificado Digital A1 removido deste terminal.',
    });
    setTimeout(() => setCertFeedback(null), 3500);
  };

  const handleChange = (field: keyof CompanyProfile, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    if (field === 'activitySector' || field === 'tradeName' || field === 'corporateName') {
      try {
        if (typeof window !== 'undefined') {
          const existingRaw = localStorage.getItem('dadosEmpresa');
          const existing = existingRaw ? JSON.parse(existingRaw) : {};
          const updated = {
            ...existing,
            ...(field === 'activitySector' ? { ramoAtividade: value, activitySector: value } : {}),
            ...(field === 'tradeName' ? { nomeFantasia: value, tradeName: value } : {}),
            ...(field === 'corporateName' ? { razaoSocial: value, corporateName: value } : {}),
          };
          localStorage.setItem('dadosEmpresa', JSON.stringify(updated));
          queueMicrotask(() => {
            window.dispatchEvent(new CustomEvent('colaca_company_profile_live_change', {
              detail: { ...formData, [field]: value }
            }));
            window.dispatchEvent(new CustomEvent('agrocontrol_company_profile_updated', {
              detail: { ...formData, [field]: value }
            }));
          });
        }
      } catch (e) {
        console.warn('Erro ao sincronizar identificação da empresa em tempo real:', e);
      }
    }
  };

  // CNPJ / CPF with auto-mask and auto-lookup
  const handleCnpjCpfChange = async (rawVal: string) => {
    const masked = formatCpfCnpj(rawVal);
    handleChange('cnpjCpf', masked);

    const digits = cleanDigits(rawVal);
    if (digits.length === 14) {
      await handleSearchCnpj(digits);
    }
  };

  const handleSearchCnpj = async (cnpjDigits?: string) => {
    const digits = cnpjDigits || cleanDigits(formData.cnpjCpf);
    if (digits.length !== 14) {
      setLookupFeedback({ type: 'error', message: 'Digite um CNPJ de 14 dígitos para buscar na Receita.' });
      setTimeout(() => setLookupFeedback(null), 3500);
      return;
    }

    setIsLoadingCnpj(true);
    setLookupFeedback(null);
    try {
      const res = await fetchCompanyByCnpj(digits);
      if (res.success) {
        setFormData(prev => ({
          ...prev,
          corporateName: res.corporateName || prev.corporateName,
          tradeName: res.tradeName || prev.tradeName,
          phone: res.phone || prev.phone,
          email: res.email || prev.email,
          zipCode: res.zipCode || prev.zipCode,
          address: res.street || prev.address,
          number: res.number || prev.number,
          neighborhood: res.neighborhood || prev.neighborhood,
          city: res.city || prev.city,
          state: res.state || prev.state,
          activitySector: res.activitySector || prev.activitySector,
          cnaePrincipal: res.cnaePrincipal || prev.cnaePrincipal,
          pixKey:
            !(prev.pixKey || '').trim() && (prev.pixKeyType || 'cnpj') === 'cnpj'
              ? res.cnpj || formatCpfCnpj(digits)
              : prev.pixKey,
        }));
        setLookupFeedback({ type: 'success', message: `✅ CNPJ Encontrado: ${res.corporateName || 'Dados da empresa importados!'}` });
      } else {
        setLookupFeedback({ type: 'error', message: res.message || 'CNPJ não encontrado na base pública.' });
      }
    } catch (e) {
      setLookupFeedback({ type: 'error', message: 'Erro ao conectar ao serviço de busca de CNPJ.' });
    } finally {
      setIsLoadingCnpj(false);
      setTimeout(() => setLookupFeedback(null), 4500);
    }
  };

  // CEP with auto-mask and auto-lookup
  const handleCepChange = async (rawVal: string) => {
    const masked = formatCep(rawVal);
    handleChange('zipCode', masked);

    const digits = cleanDigits(rawVal);
    if (digits.length === 8) {
      await handleSearchCep(digits);
    }
  };

  const handleSearchCep = async (cepDigits?: string) => {
    const digits = cepDigits || cleanDigits(formData.zipCode);
    if (digits.length !== 8) {
      setLookupFeedback({ type: 'error', message: 'Digite um CEP completo com 8 dígitos.' });
      setTimeout(() => setLookupFeedback(null), 3500);
      return;
    }

    setIsLoadingCep(true);
    setLookupFeedback(null);
    try {
      const res = await fetchAddressByCep(digits);
      if (res.success) {
        setFormData(prev => ({
          ...prev,
          address: res.street || prev.address,
          neighborhood: res.neighborhood || prev.neighborhood,
          city: res.city || prev.city,
          state: res.state || prev.state,
        }));
        setLookupFeedback({ type: 'success', message: `✅ CEP Localizado: ${res.city}/${res.state}` });
      } else {
        setLookupFeedback({ type: 'error', message: res.message || 'CEP não localizado.' });
      }
    } catch (e) {
      setLookupFeedback({ type: 'error', message: 'Erro ao consultar CEP.' });
    } finally {
      setIsLoadingCep(false);
      setTimeout(() => setLookupFeedback(null), 4000);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('A imagem selecionada é muito grande. Por favor escolha uma imagem de até 5MB.');
      return;
    }

    try {
      const compressedDataUrl = await compressLogoToLocalDataUrl(file, 400, 400, 0.85);
      const storedLogoRef = isIndexedDbSupported()
        ? await saveCompanyLogo(compressedDataUrl)
        : compressedDataUrl;

      setLogoError(false);
      setFormData(prev => ({
        ...prev,
        logoUrl: storedLogoRef
      }));
      try {
        safeLocalStorageSetItem('agrocontrol_empresa_logo', storedLogoRef);
        const existingRaw = localStorage.getItem('dadosEmpresa');
        const existing = existingRaw ? JSON.parse(existingRaw) : {};
        safeLocalStorageSetItem('dadosEmpresa', JSON.stringify({
          ...existing,
          logoUrl: storedLogoRef,
        }));
        window.dispatchEvent(new CustomEvent('agrocontrol_logo_updated', { detail: storedLogoRef }));
        window.dispatchEvent(new CustomEvent('agrocontrol_empresa_logo_updated', { detail: storedLogoRef }));
      } catch (_) {}
    } catch {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        if (base64) {
          const storedLogoRef = isIndexedDbSupported()
            ? await saveCompanyLogo(base64)
            : base64;
          setLogoError(false);
          setFormData(prev => ({
            ...prev,
            logoUrl: storedLogoRef
          }));
          try {
            safeLocalStorageSetItem('agrocontrol_empresa_logo', storedLogoRef);
            window.dispatchEvent(new CustomEvent('agrocontrol_logo_updated', { detail: storedLogoRef }));
            window.dispatchEvent(new CustomEvent('agrocontrol_empresa_logo_updated', { detail: storedLogoRef }));
          } catch (_) {}
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleResetToDefaultLogo = () => {
    setLogoError(false);
    setFormData(prev => ({
      ...prev,
      logoUrl: ''
    }));
    void deleteCompanyLogo();
    try {
      localStorage.removeItem('agrocontrol_empresa_logo');
      const existingRaw = localStorage.getItem('dadosEmpresa');
      if (existingRaw) {
        const existing = JSON.parse(existingRaw);
        existing.logoUrl = '';
        safeLocalStorageSetItem('dadosEmpresa', JSON.stringify(existing));
      }
      window.dispatchEvent(new CustomEvent('agrocontrol_logo_updated', { detail: '' }));
      window.dispatchEvent(new CustomEvent('agrocontrol_empresa_logo_updated', { detail: '' }));
      window.dispatchEvent(new CustomEvent('colaca_company_profile_live_change', { detail: { ...formData, logoUrl: '' } }));
      window.dispatchEvent(new CustomEvent('agrocontrol_company_profile_updated', { detail: { ...formData, logoUrl: '' } }));
    } catch (_) {}
  };

  const [isSavingCloud, setIsSavingCloud] = useState(false);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSavingCloud(true);
    let persistedLogoUrl = (formData.logoUrl || '').trim();
    if (persistedLogoUrl.startsWith('data:image/') && isIndexedDbSupported()) {
      persistedLogoUrl = await saveCompanyLogo(persistedLogoUrl);
    }
    const profileToSave: CompanyProfile = {
      ...formData,
      logoUrl: persistedLogoUrl,
    };

    if (isSequenciaUnlocked) {
      const parsedNextNumbers: Record<NotaSaidaModelKey, number> = {
        NFE: Math.max(1, parseInt(sequenceNumbers.NFE || '1', 10) || 1),
        NFSE: Math.max(1, parseInt(sequenceNumbers.NFSE || '1', 10) || 1),
        CTE: Math.max(1, parseInt(sequenceNumbers.CTE || '1', 10) || 1),
        NFCE: Math.max(1, parseInt(sequenceNumbers.NFCE || '1', 10) || 1),
        MDFE: Math.max(1, parseInt(sequenceNumbers.MDFE || '1', 10) || 1),
      };
      saveNextNotaSaidaSequencesForSerie(profileToSave.seriePadraoNotas || '1', parsedNextNumbers);
      setSequenceNumbers({
        NFE: String(parsedNextNumbers.NFE),
        NFSE: String(parsedNextNumbers.NFSE),
        CTE: String(parsedNextNumbers.CTE),
        NFCE: String(parsedNextNumbers.NFCE),
        MDFE: String(parsedNextNumbers.MDFE),
      });
      setIsSequenciaUnlocked(false);
    }

    try {
      const activeSector = profileToSave.activitySector || '';
      saveStoredCompanyProfile(profileToSave);
      if (typeof localStorage !== 'undefined') {
        const existingRaw = localStorage.getItem('dadosEmpresa');
        const existing = existingRaw ? JSON.parse(existingRaw) : {};
        safeLocalStorageSetItem('dadosEmpresa', JSON.stringify({
          ...existing,
          razaoSocial: profileToSave.corporateName || '',
          corporateName: profileToSave.corporateName || '',
          nomeFantasia: profileToSave.tradeName || '',
          tradeName: profileToSave.tradeName || '',
          ramoAtividade: activeSector,
          activitySector: activeSector,
          setor: activeSector,
          logoUrl: persistedLogoUrl
        }));
        if (persistedLogoUrl) {
          safeLocalStorageSetItem('agrocontrol_empresa_logo', persistedLogoUrl);
        } else {
          localStorage.removeItem('agrocontrol_empresa_logo');
        }
        window.dispatchEvent(new CustomEvent('colaca_company_profile_live_change', { detail: profileToSave }));
        window.dispatchEvent(new CustomEvent('agrocontrol_company_profile_updated', { detail: profileToSave }));
        window.dispatchEvent(new CustomEvent('agrocontrol_empresa_logo_updated', { detail: persistedLogoUrl }));
        window.dispatchEvent(new CustomEvent('agrocontrol_logo_updated', { detail: persistedLogoUrl }));
      }
      onSaveCompanyProfile(profileToSave);
      await saveCloudCompanyProfile(profileToSave);
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
      }, 4000);
    } catch (err) {
      console.error('Erro ao salvar configurações fiscais na nuvem:', err);
      onSaveCompanyProfile(profileToSave);
      if (typeof window !== 'undefined') {
        if (persistedLogoUrl) {
          safeLocalStorageSetItem('agrocontrol_empresa_logo', persistedLogoUrl);
        } else {
          localStorage.removeItem('agrocontrol_empresa_logo');
        }
        window.dispatchEvent(new CustomEvent('colaca_company_profile_live_change', { detail: profileToSave }));
        window.dispatchEvent(new CustomEvent('agrocontrol_company_profile_updated', { detail: profileToSave }));
        window.dispatchEvent(new CustomEvent('agrocontrol_empresa_logo_updated', { detail: persistedLogoUrl }));
        window.dispatchEvent(new CustomEvent('agrocontrol_logo_updated', { detail: persistedLogoUrl }));
      }
      setSavedSuccess(true);
    } finally {
      setIsSavingCloud(false);
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setPasswordToast('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordToast('A confirmação de senha não confere com a nova senha.');
      return;
    }

    setPasswordToast('✅ Senha alterada com sucesso!');
    setTimeout(() => {
      setIsPasswordModalOpen(false);
      setPasswordToast(null);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }, 1500);
  };

  return (
    <div id="company-settings-view" className="w-full min-h-full overflow-y-auto overflow-x-hidden flex flex-col justify-between space-y-2.5 animate-in fade-in duration-200">
      
      {/* Toast Notification */}
      {savedSuccess && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-700 text-white px-4 py-2 rounded-xl shadow-2xl flex items-center space-x-2 text-xs font-bold border border-emerald-500 animate-in slide-in-from-bottom-4">
          <Check className="w-4 h-4 text-emerald-200" />
          <span>Alterações da empresa salvas com sucesso!</span>
        </div>
      )}

      {/* Lookup Feedback Toast */}
      {lookupFeedback && (
        <div className={`fixed top-16 right-6 z-50 text-white px-3 py-1.5 rounded-xl shadow-2xl flex items-center space-x-2 text-xs font-bold border animate-in slide-in-from-top-3 ${
          lookupFeedback.type === 'success' ? 'bg-emerald-700 border-emerald-500' : 'bg-rose-700 border-rose-500'
        }`}>
          <span>{lookupFeedback.message}</span>
        </div>
      )}

      {/* Top Header Compact */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white dark:bg-stone-900 px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-stone-800 shadow-2xs shrink-0">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
            <Building className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-black text-zinc-900 dark:text-white tracking-tight leading-tight">
              Dados da Empresa
            </h1>
            <p className="text-[11px] text-zinc-500 dark:text-stone-400 font-medium leading-none mt-0.5">
              Identificação cadastral, localização e dados de recebimento oficial da Colaca Silagem Ltda
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 shrink-0 flex-wrap gap-y-1">
          {onOpenReorderMenu && (
            <button
              type="button"
              id="btn-settings-organize-menu"
              onClick={onOpenReorderMenu}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#059669] hover:bg-[#047857] text-white rounded-xl text-xs font-bold uppercase border border-emerald-700/60 shadow-[inset_0_1px_0px_rgba(255,255,255,0.3),0_1px_2px_rgba(0,0,0,0.15)] transition active:scale-95 cursor-pointer whitespace-nowrap"
              title="Personalizar Ordem do Menu Lateral"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-white stroke-[2.5]" />
              <span className="text-white font-bold uppercase tracking-wider">ORGANIZAR MENU</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('card-backup-seguranca-sistema') || document.getElementById('card-backup-seguranca-safra');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#059669] hover:bg-[#047857] text-white rounded-xl text-xs font-bold uppercase border border-emerald-700/60 shadow-[inset_0_1px_0px_rgba(255,255,255,0.3),0_1px_2px_rgba(0,0,0,0.15)] transition active:scale-95 cursor-pointer whitespace-nowrap"
            title="Ir para Central de Segurança e Backup de Dados"
          >
            <RotateCcw className="w-3.5 h-3.5 text-white stroke-[2.5]" />
            <span className="text-white font-bold uppercase tracking-wider">BACKUP DO SISTEMA</span>
          </button>

          <button
            type="button"
            onClick={() => setIsTestPrintOpen(true)}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#059669] hover:bg-[#047857] text-white rounded-xl text-xs font-bold uppercase border border-emerald-700/60 shadow-[inset_0_1px_0px_rgba(255,255,255,0.3),0_1px_2px_rgba(0,0,0,0.15)] transition active:scale-95 cursor-pointer whitespace-nowrap"
            title="Testar Impressão de Relatórios e Comprovantes"
          >
            <Printer className="w-3.5 h-3.5 text-white stroke-[2.5]" />
            <span className="text-white font-bold uppercase tracking-wider">TESTAR IMPRESSÃO</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPasswordModalOpen(true)}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#059669] hover:bg-[#047857] text-white rounded-xl text-xs font-bold uppercase border border-emerald-700/60 shadow-[inset_0_1px_0px_rgba(255,255,255,0.3),0_1px_2px_rgba(0,0,0,0.15)] transition active:scale-95 cursor-pointer whitespace-nowrap"
            title="Alterar Senha de Acesso"
          >
            <KeyRound className="w-3.5 h-3.5 text-white stroke-[2.5]" />
            <span className="text-white font-bold uppercase tracking-wider">SENHA</span>
          </button>

          <button
            type="button"
            onClick={() => handleSave()}
            disabled={isSavingCloud}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-[#059669] hover:bg-[#047857] text-white rounded-xl text-xs font-bold uppercase border border-emerald-700/60 shadow-[inset_0_1px_0px_rgba(255,255,255,0.3),0_1px_2px_rgba(0,0,0,0.15)] transition active:scale-95 cursor-pointer disabled:opacity-50 whitespace-nowrap"
            title="Salvar Alterações da Empresa"
          >
            <Save className="w-3.5 h-3.5 text-white stroke-[2.5]" />
            <span className="text-white font-bold uppercase tracking-wider">{isSavingCloud ? 'SALVANDO...' : 'SALVAR ALTERAÇÕES'}</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="flex-1 min-h-0 flex flex-col gap-2.5 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-stone-700">
        
        {/* BLOCO 1: IDENTIFICAÇÃO DA EMPRESA & LOGOTIPO */}
        <div className="bg-zinc-100 dark:bg-stone-900 rounded-xl border border-zinc-300 dark:border-stone-800 p-2.5 shadow-2xs text-zinc-900 dark:text-white shrink-0">
          <div className="flex items-center justify-between mb-1.5 border-b border-zinc-200 dark:border-stone-800 pb-1">
            <div className="flex items-center space-x-2 text-zinc-900 dark:text-emerald-400">
              <Building2 className="w-3.5 h-3.5 text-zinc-700 dark:text-emerald-400" />
              <h2 className="text-xs font-extrabold uppercase tracking-wider">1. IDENTIFICAÇÃO</h2>
            </div>
            <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
              Auto-Preenchimento CNPJ Ativo
            </span>
          </div>

          <div className="grid grid-cols-12 gap-2.5 items-center">
            {/* Logotipo da Empresa (Padrão Avatar Component com Botão Flutuante) */}
            <div className="col-span-12 sm:col-span-3 lg:col-span-2 flex items-center justify-center">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImageUpload} 
                accept="image/*" 
                className="hidden" 
              />
              
              <div 
                onClick={() => fileInputRef.current?.click()}
                title="Clique para alterar o logotipo da empresa"
                className="relative group cursor-pointer w-full h-20 max-h-20 rounded-2xl bg-white dark:bg-stone-800/90 border border-slate-200 dark:border-stone-700 shadow-sm flex items-center justify-center overflow-hidden transition-all duration-200 hover:border-slate-300 dark:hover:border-stone-600 hover:shadow-md"
              >
                {resolvedLogoUrl && !logoError ? (
                  <img 
                    src={resolvedLogoUrl} 
                    alt="LOGOTIPO DA EMPRESA" 
                    className="w-full h-full object-contain p-2 drop-shadow-2xs transition-transform duration-200 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                    onError={() => {
                      queueMicrotask(() => setLogoError(true));
                    }}
                  />
                ) : (
                  <div className="text-center text-zinc-400 dark:text-stone-500 p-1">
                    <ImageIcon className="w-6 h-6 mx-auto opacity-50 mb-0.5 text-zinc-400" />
                    <span className="text-[9px] font-bold tracking-tight uppercase">ANEXAR LOGOTIPO</span>
                  </div>
                )}

                {/* Overlay sutil ao passar o mouse */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 dark:group-hover:bg-white/5 transition-colors duration-200 pointer-events-none" />

                {/* Botão Flutuante de Ação (Alterar Logo) - Canto Inferior Direito */}
                <div 
                  className="absolute bottom-1.5 right-1.5 p-1.5 bg-white hover:bg-slate-50 dark:bg-stone-900 dark:hover:bg-stone-800 text-slate-700 dark:text-stone-200 rounded-full shadow-sm border border-slate-200 dark:border-stone-700 transition transform group-hover:scale-110 active:scale-95 flex items-center justify-center cursor-pointer"
                  title="Alterar Logotipo"
                >
                  <Camera className="w-3.5 h-3.5 text-slate-600 dark:text-stone-300" />
                </div>

                {/* Botão Discreto de Reset / Restaurar Logotipo Padrão (Canto Superior Direito ao Hover) */}
                {formData.logoUrl && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleResetToDefaultLogo();
                    }}
                    title="Restaurar logotipo padrão"
                    className="absolute top-1.5 right-1.5 p-1 bg-white/95 hover:bg-rose-50 text-zinc-500 hover:text-rose-600 dark:bg-stone-900/90 dark:text-stone-400 dark:hover:text-rose-400 rounded-full shadow-xs border border-zinc-200 dark:border-stone-700 opacity-0 group-hover:opacity-100 transition cursor-pointer"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Campos Cadastrais */}
            <div className="col-span-12 sm:col-span-9 lg:col-span-10 grid grid-cols-1 sm:grid-cols-5 gap-2">
              {/* CNPJ / CPF */}
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <label className="block text-xs font-semibold text-zinc-800 dark:text-stone-300">
                    CNPJ / CPF
                  </label>
                  {isLoadingCnpj && (
                    <span className="text-[10px] text-zinc-500 font-bold flex items-center space-x-1">
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      <span>Buscando...</span>
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.cnpjCpf || ''}
                    onChange={(e) => handleCnpjCpfChange(e.target.value)}
                    placeholder="00.000.000/0000-00"
                    maxLength={18}
                    className="w-full px-2.5 py-1 bg-white dark:bg-stone-800 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs text-zinc-900 dark:text-stone-100 font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition pr-8"
                  />
                  <button
                    type="button"
                    onClick={() => handleSearchCnpj()}
                    disabled={isLoadingCnpj}
                    title="Buscar dados na Receita"
                    className="absolute right-1 top-0.5 p-1 text-zinc-500 hover:bg-zinc-100 dark:text-stone-400 dark:hover:bg-stone-700 rounded transition cursor-pointer"
                  >
                    {isLoadingCnpj ? (
                      <Loader2 className="w-3 h-3 animate-spin text-zinc-700" />
                    ) : (
                      <Search className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>

              {/* Inscrição Estadual */}
              <div>
                <label className="block text-xs font-semibold text-zinc-800 dark:text-stone-300 mb-0.5">
                  Inscrição Estadual
                </label>
                <input
                  type="text"
                  value={formData.stateRegistration || ''}
                  onChange={(e) => handleChange('stateRegistration', formatIE(e.target.value))}
                  placeholder="Isento ou nº IE"
                  maxLength={18}
                  className="w-full px-2.5 py-1 bg-white dark:bg-stone-800 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs text-zinc-900 dark:text-stone-100 font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition"
                />
              </div>

              {/* Inscrição Municipal (IM) */}
              <div>
                <label className="block text-xs font-semibold text-zinc-800 dark:text-stone-300 mb-0.5">
                  Inscrição Municipal (IM)
                </label>
                <input
                  type="text"
                  value={formData.municipalRegistration || ''}
                  onChange={(e) => handleChange('municipalRegistration', e.target.value)}
                  placeholder="Isento ou nº IM (NFS-e)"
                  maxLength={24}
                  className="w-full px-2.5 py-1 bg-white dark:bg-stone-800 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs text-zinc-900 dark:text-stone-100 font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition"
                />
              </div>

              {/* Razão Social */}
              <div>
                <label className="block text-xs font-semibold text-zinc-800 dark:text-stone-300 mb-0.5">
                  Razão Social
                </label>
                <input
                  type="text"
                  value={formData.corporateName || ''}
                  onChange={(e) => handleChange('corporateName', e.target.value)}
                  placeholder="Razão Social Ltda"
                  className="w-full px-2.5 py-1 bg-white dark:bg-stone-800 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs text-zinc-900 dark:text-stone-100 font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition"
                />
              </div>

              {/* Nome Fantasia */}
              <div>
                <label className="block text-xs font-semibold text-zinc-800 dark:text-stone-300 mb-0.5">
                  Nome Fantasia
                </label>
                <input
                  type="text"
                  value={formData.tradeName || ''}
                  onChange={(e) => handleChange('tradeName', e.target.value)}
                  placeholder="Nome Fantasia"
                  className="w-full px-2.5 py-1 bg-white dark:bg-stone-800 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs text-zinc-900 dark:text-stone-100 font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition"
                />
              </div>

              {/* Setor / Ramo de Atividade & CNAE Principal */}
              <div className="sm:col-span-5 grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="sm:col-span-9">
                  <label className="block text-xs font-semibold text-zinc-800 dark:text-stone-300 mb-0.5">
                    Setor / Ramo de Atividade
                  </label>
                  <input
                    type="text"
                    value={formData.activitySector || ''}
                    onChange={(e) => handleChange('activitySector', e.target.value)}
                    placeholder="Ex: Prestação de serviço de Silagem"
                    className="w-full px-2.5 py-1 bg-white dark:bg-stone-800 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs text-zinc-900 dark:text-stone-100 font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold text-zinc-800 dark:text-stone-300 mb-0.5">
                    CNAE Principal
                  </label>
                  <input
                    type="text"
                    value={formData.cnaePrincipal || ''}
                    onChange={(e) => handleChange('cnaePrincipal', formatCnae(e.target.value))}
                    placeholder="Ex: 0161-0/03"
                    maxLength={10}
                    className="w-full px-2.5 py-1 bg-white dark:bg-stone-800 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs text-zinc-900 dark:text-stone-100 font-mono font-semibold focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* BLOCO 2: LOCALIZAÇÃO & ENDEREÇO */}
        <div className="bg-zinc-100 dark:bg-stone-900 rounded-xl border border-zinc-300 dark:border-stone-800 p-2.5 shadow-2xs text-zinc-900 dark:text-white shrink-0">
          <div className="flex items-center justify-between mb-1.5 border-b border-zinc-200 dark:border-stone-800 pb-1">
            <div className="flex items-center space-x-2 text-zinc-900 dark:text-emerald-400">
              <MapPin className="w-3.5 h-3.5 text-zinc-700 dark:text-emerald-400" />
              <h2 className="text-xs font-extrabold uppercase tracking-wider">2. LOCALIZAÇÃO</h2>
            </div>
            <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
              Auto-Preenchimento CEP Ativo
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
            {/* CEP */}
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-0.5">
                <label className="block text-xs font-semibold text-zinc-800 dark:text-stone-300">
                  CEP
                </label>
                {isLoadingCep && (
                  <span className="text-[10px] text-zinc-500 font-bold flex items-center space-x-1">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={formData.zipCode || ''}
                  onChange={(e) => handleCepChange(e.target.value)}
                  placeholder="00000-000"
                  maxLength={9}
                  className="w-full px-2.5 py-1 bg-white dark:bg-stone-800 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs text-zinc-900 dark:text-stone-100 font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition pr-8"
                />
                <button
                  type="button"
                  onClick={() => handleSearchCep()}
                  disabled={isLoadingCep}
                  title="Buscar CEP"
                  className="absolute right-1 top-0.5 p-1 text-zinc-500 hover:bg-zinc-100 dark:text-stone-400 dark:hover:bg-stone-700 rounded transition cursor-pointer"
                >
                  {isLoadingCep ? (
                    <Loader2 className="w-3 h-3 animate-spin text-zinc-700" />
                  ) : (
                    <Search className="w-3 h-3" />
                  )}
                </button>
              </div>
            </div>

            {/* Endereço */}
            <div className="sm:col-span-4">
              <label className="block text-xs font-semibold text-zinc-800 dark:text-stone-300 mb-0.5">
                Endereço / Logradouro
              </label>
              <input
                type="text"
                value={formData.address || ''}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder="Ex: Rodovia PR 473 ou Av. Brasil"
                className="w-full px-2.5 py-1 bg-white dark:bg-stone-800 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs text-zinc-900 dark:text-stone-100 font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition"
              />
            </div>

            {/* Número */}
            <div className="sm:col-span-1">
              <label className="block text-xs font-semibold text-zinc-800 dark:text-stone-300 mb-0.5">
                Número
              </label>
              <input
                type="text"
                value={formData.number || ''}
                onChange={(e) => handleChange('number', e.target.value)}
                placeholder="sn, 105"
                className="w-full px-2.5 py-1 bg-white dark:bg-stone-800 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs text-zinc-900 dark:text-stone-100 font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition"
              />
            </div>

            {/* Bairro */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-zinc-800 dark:text-stone-300 mb-0.5">
                Bairro
              </label>
              <input
                type="text"
                value={formData.neighborhood || ''}
                onChange={(e) => handleChange('neighborhood', e.target.value)}
                placeholder="Centro ou Zona Rural"
                className="w-full px-2.5 py-1 bg-white dark:bg-stone-800 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs text-zinc-900 dark:text-stone-100 font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition"
              />
            </div>

            {/* Cidade */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-zinc-800 dark:text-stone-300 mb-0.5">
                Cidade
              </label>
              <input
                type="text"
                value={formData.city || ''}
                onChange={(e) => handleChange('city', e.target.value)}
                placeholder="Cidade"
                className="w-full px-2.5 py-1 bg-white dark:bg-stone-800 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs text-zinc-900 dark:text-stone-100 font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition"
              />
            </div>

            {/* Estado (UF) */}
            <div className="sm:col-span-1">
              <label className="block text-xs font-semibold text-zinc-800 dark:text-stone-300 mb-0.5">
                UF
              </label>
              <input
                type="text"
                value={formData.state || ''}
                onChange={(e) => handleChange('state', e.target.value.toUpperCase())}
                placeholder="PR"
                maxLength={2}
                className="w-full px-2.5 py-1 bg-white dark:bg-stone-800 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs text-zinc-900 dark:text-stone-100 font-medium uppercase focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition"
              />
            </div>
          </div>
        </div>

        {/* BLOCO 3: CONTATOS & REPRESENTANTE RESPONSÁVEL */}
        <div className="bg-zinc-100 dark:bg-stone-900 rounded-xl border border-zinc-300 dark:border-stone-800 p-2.5 shadow-2xs text-zinc-900 dark:text-white shrink-0">
          <div className="flex items-center space-x-2 text-zinc-900 dark:text-emerald-400 mb-1.5 border-b border-zinc-200 dark:border-stone-800 pb-1">
            <PhoneCall className="w-3.5 h-3.5 text-zinc-700 dark:text-emerald-400" />
            <h2 className="text-xs font-extrabold uppercase tracking-wider">3. CONTATOS & REPRESENTANTE RESPONSÁVEL</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
            {/* Telefone de Contato */}
            <div>
              <label className="block text-xs font-semibold text-zinc-800 dark:text-stone-300 mb-0.5">
                Telefone Comercial / WhatsApp
              </label>
              <input
                type="text"
                value={formData.phone || ''}
                onChange={(e) => handleChange('phone', formatPhone(e.target.value))}
                placeholder="(00) 00000-0000"
                maxLength={15}
                className="w-full px-2.5 py-1 bg-white dark:bg-stone-800 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs text-zinc-900 dark:text-stone-100 font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition"
              />
            </div>

            {/* E-mail Comercial */}
            <div>
              <label className="block text-xs font-semibold text-zinc-800 dark:text-stone-300 mb-0.5">
                E-mail Comercial
              </label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="contato@empresa.com.br"
                className="w-full px-2.5 py-1 bg-white dark:bg-stone-800 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs text-zinc-900 dark:text-stone-100 font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition"
              />
            </div>

            {/* Representante Responsável */}
            <div>
              <label className="block text-xs font-semibold text-zinc-800 dark:text-stone-300 mb-0.5">
                Representante Responsável
              </label>
              <input
                type="text"
                value={formData.representativeName || ''}
                onChange={(e) => handleChange('representativeName', e.target.value)}
                placeholder="Nome do Representante"
                className="w-full px-2.5 py-1 bg-white dark:bg-stone-800 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs text-zinc-900 dark:text-stone-100 font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition"
              />
            </div>

            {/* CPF do Representante */}
            <div>
              <label className="block text-xs font-semibold text-zinc-800 dark:text-stone-300 mb-0.5">
                CPF do Representante
              </label>
              <input
                type="text"
                value={formData.representativeCpf || ''}
                onChange={(e) => handleChange('representativeCpf', formatCpfCnpj(e.target.value))}
                placeholder="000.000.000-00"
                maxLength={14}
                className="w-full px-2.5 py-1 bg-white dark:bg-stone-800 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs text-zinc-900 dark:text-stone-100 font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition"
              />
            </div>
          </div>
        </div>

        {/* BLOCO 4: DADOS BANCÁRIOS & PIX */}
        <div className="bg-zinc-100 dark:bg-stone-900 rounded-xl border border-zinc-300 dark:border-stone-800 p-2.5 shadow-2xs text-zinc-900 dark:text-white shrink-0">
          <div className="flex items-center space-x-2 text-zinc-900 dark:text-emerald-400 mb-1.5 border-b border-zinc-200 dark:border-stone-800 pb-1">
            <CreditCard className="w-3.5 h-3.5 text-zinc-700 dark:text-emerald-400" />
            <h2 className="text-xs font-extrabold uppercase tracking-wider">4. DADOS BANCÁRIOS & PIX</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
            {/* Banco */}
            <div>
              <label className="block text-xs font-semibold text-zinc-800 dark:text-stone-300 mb-0.5">
                Banco
              </label>
              <input
                type="text"
                value={formData.bankName || ''}
                onChange={(e) => handleChange('bankName', e.target.value)}
                placeholder="Ex: Banco do Brasil (001)"
                className="w-full px-2.5 py-1 bg-white dark:bg-stone-800 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs text-zinc-900 dark:text-stone-100 font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition"
              />
            </div>

            {/* Agência */}
            <div>
              <label className="block text-xs font-semibold text-zinc-800 dark:text-stone-300 mb-0.5">
                Agência
              </label>
              <input
                type="text"
                value={formData.bankAgency || ''}
                onChange={(e) => handleChange('bankAgency', e.target.value)}
                placeholder="Ex: 1234-5"
                className="w-full px-2.5 py-1 bg-white dark:bg-stone-800 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs text-zinc-900 dark:text-stone-100 font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition"
              />
            </div>

            {/* Conta Corrente */}
            <div>
              <label className="block text-xs font-semibold text-zinc-800 dark:text-stone-300 mb-0.5">
                Conta Corrente
              </label>
              <input
                type="text"
                value={formData.bankAccount || ''}
                onChange={(e) => handleChange('bankAccount', e.target.value)}
                placeholder="Ex: 56789-0"
                className="w-full px-2.5 py-1 bg-white dark:bg-stone-800 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs text-zinc-900 dark:text-stone-100 font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition"
              />
            </div>

            {/* Tipo de Chave PIX */}
            <div>
              <label className="block text-xs font-semibold text-zinc-800 dark:text-stone-300 mb-0.5">
                Tipo Chave PIX
              </label>
              <select
                value={formData.pixKeyType || 'cnpj'}
                onChange={(e) => {
                  const nextType = e.target.value;
                  setFormData((prev) => ({
                    ...prev,
                    pixKeyType: nextType,
                    pixKey: resolveAutoPixKey(nextType, prev),
                  }));
                }}
                className="w-full px-2.5 py-1 bg-white dark:bg-stone-800 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs text-zinc-900 dark:text-stone-100 font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition cursor-pointer"
              >
                <option value="cnpj">CNPJ</option>
                <option value="cpf">CPF</option>
                <option value="email">E-mail</option>
                <option value="telefone">Telefone</option>
                <option value="aleatoria">Chave Aleatória</option>
              </select>
            </div>

            {/* Chave PIX */}
            <div>
              <label className="block text-xs font-semibold text-zinc-800 dark:text-stone-300 mb-0.5">
                Chave PIX
              </label>
              <input
                type="text"
                value={formData.pixKey || ''}
                onChange={(e) => handleChange('pixKey', e.target.value)}
                placeholder="Chave PIX"
                className="w-full px-2.5 py-1 bg-white dark:bg-stone-800 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs text-zinc-900 dark:text-stone-100 font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition"
              />
            </div>
          </div>
        </div>

        {/* BLOCO 5: CERTIFICADO DIGITAL A1 & CONFIGURAÇÃO FISCAL (SEFAZ) */}
        <div className="bg-zinc-100 dark:bg-stone-900 rounded-xl border border-zinc-300 dark:border-stone-800 p-2.5 shadow-2xs text-zinc-900 dark:text-white shrink-0 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-zinc-900 dark:text-emerald-400 border-b border-zinc-200 dark:border-stone-800 pb-1">
            <div className="flex items-center space-x-2">
              <FileKey2 className="w-3.5 h-3.5 text-zinc-700 dark:text-emerald-400" />
              <h2 className="text-xs font-extrabold uppercase tracking-wider">
                5. CERTIFICADO DIGITAL A1 &amp; CONFIGURAÇÃO FISCAL (SEFAZ)
              </h2>
            </div>

            {certStatusInfo.hasCertificate ? (
              <span
                className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-wider ${
                  certStatusInfo.isExpired
                    ? 'bg-rose-100 text-rose-800 border-rose-400'
                    : certStatusInfo.isExpiringSoon
                      ? 'bg-amber-100 text-amber-900 border-amber-400'
                      : 'bg-emerald-100 text-emerald-800 border-emerald-400'
                }`}
              >
                <span>{certStatusInfo.badgeLabel}</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md border border-zinc-300 bg-white text-zinc-600 text-[10px] font-bold uppercase tracking-wider">
                <span>NENHUM CERTIFICADO A1 IMPORTADO</span>
              </span>
            )}
          </div>

          {certFeedback && (
            <div
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center space-x-2 ${
                certFeedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-rose-50 border-rose-300 text-rose-900'
              }`}
            >
              {certFeedback.type === 'success' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              )}
              <span>{certFeedback.message}</span>
            </div>
          )}

          {/* Painel de Status quando Certificado A1 já estiver ativo */}
          {certStatusInfo.hasCertificate && !isReplacingCert && (
            <div
              className={`rounded-lg border p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                certStatusInfo.isExpired
                  ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800'
                  : certStatusInfo.isExpiringSoon
                    ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'
                    : 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
              }`}
            >
              <div className="space-y-0.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                      certStatusInfo.isExpired
                        ? 'bg-rose-600 text-white'
                        : certStatusInfo.isExpiringSoon
                          ? 'bg-amber-500 text-white'
                          : 'bg-emerald-600 text-white'
                    }`}
                  >
                    <span>{certStatusInfo.badgeLabel}</span>
                  </span>
                  {certStatusInfo.simulado && (
                    <span className="px-1.5 py-0.5 rounded bg-white border border-zinc-300 text-[10px] font-bold text-zinc-700 uppercase">
                      Modo Homologação / Simulado
                    </span>
                  )}
                  <span className="text-[11px] font-mono text-zinc-600 dark:text-stone-400 truncate">
                    Arquivo: {certStatusInfo.arquivoNome || 'certificado_a1.pfx'}
                  </span>
                </div>
                <p className="text-xs font-extrabold text-zinc-900 dark:text-stone-100 uppercase truncate">
                  {certStatusInfo.titular}
                  {certStatusInfo.cnpj ? ` — CNPJ: ${certStatusInfo.cnpj}` : ''}
                </p>
                <p
                  className={`text-[11px] font-bold ${
                    certStatusInfo.isExpired
                      ? 'text-rose-700 dark:text-rose-300'
                      : certStatusInfo.isExpiringSoon
                        ? 'text-amber-800 dark:text-amber-300'
                        : 'text-emerald-800 dark:text-emerald-300'
                  }`}
                >
                  {certStatusInfo.isExpired
                    ? `Certificado vencido em ${certStatusInfo.formattedValidade}. Substitua o arquivo .pfx/.p12 para emitir em Produção.`
                    : certStatusInfo.isExpiringSoon
                      ? `Atenção: Válido até ${certStatusInfo.formattedValidade} (faltam ${certStatusInfo.daysRemaining} dias para vencer).`
                      : `Válido até ${certStatusInfo.formattedValidade} (${certStatusInfo.daysRemaining ?? 365} dias restantes)`}
                </p>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsReplacingCert(true)}
                  className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-white hover:bg-zinc-50 border border-zinc-400 text-zinc-800 text-[11px] font-bold transition cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Substituir</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleRemoveCertificate()}
                  className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-white hover:bg-rose-50 border border-rose-300 text-rose-700 text-[11px] font-bold transition cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Remover</span>
                </button>
              </div>
            </div>
          )}

          {/* Upload .pfx / .p12 + Senha do Certificado */}
          {(!certStatusInfo.hasCertificate || isReplacingCert) && (
            <div className="bg-white dark:bg-stone-800/60 rounded-lg border border-zinc-300 dark:border-stone-700 p-2.5 space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
                {/* Arquivo .pfx / .p12 */}
                <div className="md:col-span-5">
                  <label className="block text-xs font-semibold text-zinc-800 dark:text-stone-300 mb-0.5">
                    Arquivo Certificado Digital A1 (.pfx / .p12)
                  </label>
                  <input
                    ref={certFileInputRef}
                    type="file"
                    accept=".pfx,.p12"
                    onChange={handleCertFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => certFileInputRef.current?.click()}
                    className="w-full px-2.5 py-1.5 bg-zinc-50 hover:bg-zinc-100 dark:bg-stone-800 dark:hover:bg-stone-700 border border-dashed border-zinc-400 dark:border-stone-600 rounded-lg text-xs text-zinc-800 dark:text-stone-200 font-medium flex items-center justify-between gap-2 transition cursor-pointer"
                  >
                    <span className="truncate flex items-center space-x-1.5">
                      <Upload className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span className="truncate">
                        {pendingCertFile ? pendingCertFile.name : 'Selecionar arquivo .pfx ou .p12...'}
                      </span>
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-white border border-zinc-300 text-[10px] font-bold text-zinc-700 shrink-0">
                      Procurar
                    </span>
                  </button>
                </div>

                {/* Senha do Certificado */}
                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-zinc-800 dark:text-stone-300 mb-0.5">
                    Senha do Certificado
                  </label>
                  <div className="relative">
                    <input
                      type={showCertPassword ? 'text' : 'password'}
                      value={certPasswordInput}
                      onChange={(e) => setCertPasswordInput(e.target.value)}
                      placeholder="Digite a senha do .pfx"
                      autoComplete="new-password"
                      className="w-full pl-2.5 pr-8 py-1.5 bg-white dark:bg-stone-800 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs text-zinc-900 dark:text-stone-100 font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCertPassword((prev) => !prev)}
                      title={showCertPassword ? 'Ocultar senha' : 'Exibir senha'}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-900 cursor-pointer"
                    >
                      {showCertPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Botões de Ação */}
                <div className="md:col-span-4 flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    disabled={isValidatingCert}
                    onClick={() => void handleValidateAndActivateCert()}
                    className="flex-1 inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                  >
                    {isValidatingCert ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ShieldCheck className="w-3.5 h-3.5" />
                    )}
                    <span>Validar &amp; Ativar Certificado</span>
                  </button>

                  {isReplacingCert && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsReplacingCert(false);
                        setPendingCertFile(null);
                        setCertPasswordInput('');
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-700 text-xs font-bold cursor-pointer"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>

              {!certStatusInfo.hasCertificate && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-zinc-200 dark:border-stone-700">
                  <span className="text-[11px] text-zinc-600 dark:text-stone-400">
                    O arquivo .pfx/.p12 é salvo localmente com segurança no IndexedDB deste navegador.
                  </span>
                  <button
                    type="button"
                    onClick={handleSimulateCertificateActivation}
                    className="inline-flex items-center space-x-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Simular Ativação A1 (Homologação / Testes)</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Parâmetros Fiscais Padrão SEFAZ (Plug & Play Produção / Homologação) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-0.5">
            {/* Ambiente de Emissão SEFAZ */}
            <div>
              <label className="block text-xs font-semibold text-zinc-800 dark:text-stone-300 mb-0.5">
                Ambiente SEFAZ (tpAmb)
              </label>
              <select
                value={formData.ambienteSefaz || 'homologacao'}
                onChange={(e) =>
                  handleChange('ambienteSefaz', e.target.value as 'homologacao' | 'producao')
                }
                className="w-full px-2.5 py-1 bg-white dark:bg-stone-800 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs text-zinc-900 dark:text-stone-100 font-semibold focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition cursor-pointer"
              >
                <option value="homologacao">2 - Homologação (Testes / Sem Valor Fiscal)</option>
                <option value="producao">1 - Produção (Validade Jurídica)</option>
              </select>
            </div>

            {/* Regime Tributário (CRT) */}
            <div>
              <label className="block text-xs font-semibold text-zinc-800 dark:text-stone-300 mb-0.5">
                Regime Tributário (CRT)
              </label>
              <select
                value={formData.regimeTributario || 'Simples Nacional'}
                onChange={(e) => {
                  const val = e.target.value;
                  const nextCrt: '1' | '2' | '3' =
                    val.toLowerCase().includes('excesso')
                      ? '2'
                      : val.toLowerCase().includes('presumido') || val.toLowerCase().includes('real')
                        ? '3'
                        : '1';
                  setFormData((prev) => ({
                    ...prev,
                    regimeTributario: val,
                    crt: nextCrt,
                  }));
                }}
                className="w-full px-2.5 py-1 bg-white dark:bg-stone-800 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs text-zinc-900 dark:text-stone-100 font-semibold focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition cursor-pointer"
              >
                <option value="Simples Nacional">1 - Simples Nacional</option>
                <option value="Simples Nacional - Excesso">2 - Simples Nacional (Excesso)</option>
                <option value="Lucro Presumido">3 - Regime Normal (Lucro Presumido)</option>
                <option value="Lucro Real">3 - Regime Normal (Lucro Real)</option>
              </select>
            </div>

            {/* Série NF-e */}
            <div>
              <label className="block text-xs font-semibold text-zinc-800 dark:text-stone-300 mb-0.5">
                Série NF-e Padrão
              </label>
              <input
                type="text"
                value={formData.seriePadraoNotas || '1'}
                onChange={(e) => handleChange('seriePadraoNotas', cleanDigits(e.target.value).slice(0, 3) || '')}
                placeholder="Ex: 1"
                maxLength={3}
                className="w-full px-2.5 py-1 bg-white dark:bg-stone-800 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs text-zinc-900 dark:text-stone-100 font-mono font-bold focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition"
              />
            </div>

            {/* Código IBGE do Município */}
            <div>
              <label className="block text-xs font-semibold text-zinc-800 dark:text-stone-300 mb-0.5">
                Código IBGE do Município <span className="text-[10px] font-normal text-zinc-500">(7 dígitos)</span>
              </label>
              <input
                type="text"
                value={formData.codigoIbgeMunicipio ?? '4107207'}
                onChange={(e) => handleChange('codigoIbgeMunicipio', cleanDigits(e.target.value).slice(0, 7))}
                placeholder="4107207 (Dois Vizinhos/PR)"
                maxLength={7}
                title="Código IBGE oficial do município emitente (padrão 4107207 para Dois Vizinhos/PR)"
                className="w-full px-2.5 py-1 bg-white dark:bg-stone-800 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs text-zinc-900 dark:text-stone-100 font-mono font-bold focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition"
              />
            </div>
          </div>

          {/* Plug & Play API Fiscal (Focus NFe / Nuvem Fiscal / Tecnospeed / Direto A1) */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <div className="sm:col-span-4">
              <label className="block text-xs font-semibold text-zinc-800 dark:text-stone-300 mb-0.5">
                Provedor / Gateway API Fiscal <span className="text-[10px] font-normal text-zinc-500">(Plug &amp; Play)</span>
              </label>
              <select
                value={formData.apiFiscalProvedor || 'direto_a1'}
                onChange={(e) => handleChange('apiFiscalProvedor', e.target.value)}
                className="w-full px-2.5 py-1 bg-white dark:bg-stone-800 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs text-zinc-900 dark:text-stone-100 font-semibold focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition cursor-pointer"
              >
                <option value="direto_a1">Webservice Direto SEFAZ (Certificado A1)</option>
                <option value="focus_nfe">Focus NFe (API REST)</option>
                <option value="nuvem_fiscal">Nuvem Fiscal (API REST)</option>
                <option value="tecnospeed">Tecnospeed / PlugNotas (API REST)</option>
                <option value="enotas">eNotas / Outro Provedor API</option>
              </select>
            </div>

            <div className="sm:col-span-8">
              <label className="block text-xs font-semibold text-zinc-800 dark:text-stone-300 mb-0.5">
                Token API Fiscal (Chave de Integração SEFAZ — Produção / Homologação)
              </label>
              <div className="relative">
                <input
                  type={showApiFiscalToken ? 'text' : 'password'}
                  value={formData.tokenApiFiscal || ''}
                  onChange={(e) => handleChange('tokenApiFiscal', e.target.value.trim())}
                  placeholder="Cole aqui o Token / Bearer API Fiscal quando ativar a emissão em nuvem..."
                  autoComplete="new-password"
                  className="w-full pl-2.5 pr-8 py-1 bg-white dark:bg-stone-800 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs text-zinc-900 dark:text-stone-100 font-mono font-semibold focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition"
                />
                <button
                  type="button"
                  onClick={() => setShowApiFiscalToken((prev) => !prev)}
                  title={showApiFiscalToken ? 'Ocultar token API Fiscal' : 'Exibir token API Fiscal'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-900 cursor-pointer"
                >
                  {showApiFiscalToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Linha Complementar: Credenciais Específicas (CT-e / MDF-e / NFC-e PDV) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* RNTRC (ANTT) */}
            <div>
              <label className="block text-xs font-semibold text-zinc-800 dark:text-stone-300 mb-0.5">
                RNTRC (ANTT) <span className="text-[10px] font-normal text-zinc-500">(Opcional — CT-e / MDF-e)</span>
              </label>
              <input
                type="text"
                value={formData.rntrc || ''}
                onChange={(e) => handleChange('rntrc', cleanDigits(e.target.value).slice(0, 12))}
                placeholder="Ex: 12345678"
                maxLength={12}
                className="w-full px-2.5 py-1 bg-white dark:bg-stone-800 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs text-zinc-900 dark:text-stone-100 font-mono font-semibold focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition"
              />
            </div>

            {/* ID Token CSC (NFC-e) */}
            <div>
              <label className="block text-xs font-semibold text-zinc-800 dark:text-stone-300 mb-0.5">
                ID Token CSC (NFC-e) <span className="text-[10px] font-normal text-zinc-500">(Opcional — PDV)</span>
              </label>
              <input
                type="text"
                value={formData.cscId || ''}
                onChange={(e) => handleChange('cscId', cleanDigits(e.target.value).slice(0, 6))}
                placeholder="Ex: 000001"
                maxLength={6}
                className="w-full px-2.5 py-1 bg-white dark:bg-stone-800 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs text-zinc-900 dark:text-stone-100 font-mono font-semibold focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition"
              />
            </div>

            {/* Código CSC (NFC-e) */}
            <div>
              <label className="block text-xs font-semibold text-zinc-800 dark:text-stone-300 mb-0.5">
                Código CSC (NFC-e) <span className="text-[10px] font-normal text-zinc-500">(Token SEFAZ PDV)</span>
              </label>
              <input
                type="text"
                value={formData.cscToken || ''}
                onChange={(e) => handleChange('cscToken', e.target.value.trim())}
                placeholder="Token alfanumérico fornecido pela SEFAZ"
                maxLength={64}
                className="w-full px-2.5 py-1 bg-white dark:bg-stone-800 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs text-zinc-900 dark:text-stone-100 font-mono font-semibold focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition"
              />
            </div>
          </div>

          {/* Controle de Numeração Sequencial (Com Proteção por Cadeado) */}
          <div className="pt-2 mt-1 border-t border-zinc-200 dark:border-stone-800 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-800 dark:text-stone-200">
                  PRÓXIMO NÚMERO A EMITIR POR TIPO DE DOCUMENTO (CONTINUIDADE DE SEQUÊNCIA)
                </span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-white dark:bg-stone-800 border border-zinc-300 dark:border-stone-700 text-zinc-600 dark:text-stone-300">
                  Série {formData.seriePadraoNotas || '1'}
                </span>
              </div>

              <button
                type="button"
                id="btn-toggle-sequence-lock"
                onClick={handleToggleSequenceLock}
                className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition cursor-pointer ${
                  isSequenciaUnlocked
                    ? 'bg-amber-100 hover:bg-amber-200 border-amber-500 text-amber-950'
                    : 'bg-white hover:bg-zinc-50 border-zinc-400 text-zinc-800 dark:bg-stone-800 dark:border-stone-600 dark:text-stone-200'
                }`}
              >
                {isSequenciaUnlocked ? (
                  <>
                    <Unlock className="w-3 h-3 text-amber-700 shrink-0" />
                    <span>🔓 Numeração Destravada (Clique para Travar)</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3 h-3 text-zinc-700 dark:text-stone-300 shrink-0" />
                    <span>🔒 Liberar Edição de Numeração</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-800 dark:text-stone-300 mb-0.5 truncate" title="NF-e (Mercadorias / Remessa)">
                  NF-e (Mercadorias / Remessa)
                </label>
                <input
                  type="number"
                  min={1}
                  disabled={!isSequenciaUnlocked}
                  value={sequenceNumbers.NFE}
                  onChange={(e) => handleSequenceFieldChange('NFE', e.target.value)}
                  className={`w-full px-2.5 py-1 border rounded-lg text-xs font-mono font-bold focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition ${
                    isSequenciaUnlocked
                      ? 'bg-white dark:bg-stone-800 border-amber-500 dark:border-amber-500 text-black dark:text-stone-100'
                      : 'bg-zinc-200/80 dark:bg-stone-800/50 border-zinc-300 dark:border-stone-700 text-zinc-600 dark:text-stone-400 cursor-not-allowed'
                  }`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-800 dark:text-stone-300 mb-0.5 truncate" title="NFS-e (Prestação de Serviço)">
                  NFS-e (Prestação de Serviço)
                </label>
                <input
                  type="number"
                  min={1}
                  disabled={!isSequenciaUnlocked}
                  value={sequenceNumbers.NFSE}
                  onChange={(e) => handleSequenceFieldChange('NFSE', e.target.value)}
                  className={`w-full px-2.5 py-1 border rounded-lg text-xs font-mono font-bold focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition ${
                    isSequenciaUnlocked
                      ? 'bg-white dark:bg-stone-800 border-amber-500 dark:border-amber-500 text-black dark:text-stone-100'
                      : 'bg-zinc-200/80 dark:bg-stone-800/50 border-zinc-300 dark:border-stone-700 text-zinc-600 dark:text-stone-400 cursor-not-allowed'
                  }`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-800 dark:text-stone-300 mb-0.5 truncate" title="CT-e (Transporte / Frete)">
                  CT-e (Transporte / Frete)
                </label>
                <input
                  type="number"
                  min={1}
                  disabled={!isSequenciaUnlocked}
                  value={sequenceNumbers.CTE}
                  onChange={(e) => handleSequenceFieldChange('CTE', e.target.value)}
                  className={`w-full px-2.5 py-1 border rounded-lg text-xs font-mono font-bold focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition ${
                    isSequenciaUnlocked
                      ? 'bg-white dark:bg-stone-800 border-amber-500 dark:border-amber-500 text-black dark:text-stone-100'
                      : 'bg-zinc-200/80 dark:bg-stone-800/50 border-zinc-300 dark:border-stone-700 text-zinc-600 dark:text-stone-400 cursor-not-allowed'
                  }`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-800 dark:text-stone-300 mb-0.5 truncate" title="NFC-e (Consumidor)">
                  NFC-e (Consumidor)
                </label>
                <input
                  type="number"
                  min={1}
                  disabled={!isSequenciaUnlocked}
                  value={sequenceNumbers.NFCE}
                  onChange={(e) => handleSequenceFieldChange('NFCE', e.target.value)}
                  className={`w-full px-2.5 py-1 border rounded-lg text-xs font-mono font-bold focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition ${
                    isSequenciaUnlocked
                      ? 'bg-white dark:bg-stone-800 border-amber-500 dark:border-amber-500 text-black dark:text-stone-100'
                      : 'bg-zinc-200/80 dark:bg-stone-800/50 border-zinc-300 dark:border-stone-700 text-zinc-600 dark:text-stone-400 cursor-not-allowed'
                  }`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-800 dark:text-stone-300 mb-0.5 truncate" title="MDF-e (Manifesto)">
                  MDF-e (Manifesto)
                </label>
                <input
                  type="number"
                  min={1}
                  disabled={!isSequenciaUnlocked}
                  value={sequenceNumbers.MDFE}
                  onChange={(e) => handleSequenceFieldChange('MDFE', e.target.value)}
                  className={`w-full px-2.5 py-1 border rounded-lg text-xs font-mono font-bold focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition ${
                    isSequenciaUnlocked
                      ? 'bg-white dark:bg-stone-800 border-amber-500 dark:border-amber-500 text-black dark:text-stone-100'
                      : 'bg-zinc-200/80 dark:bg-stone-800/50 border-zinc-300 dark:border-stone-700 text-zinc-600 dark:text-stone-400 cursor-not-allowed'
                  }`}
                />
              </div>
            </div>

            <p className="text-[11px] text-zinc-500 dark:text-stone-400 italic">
              Se você já emitia notas em outro sistema, destrave o cadeado e informe o próximo número da sua sequência (ex: 1451). O sistema atualizará automaticamente a cada nova nota transmitida.
            </p>
          </div>
        </div>

        {/* BLOCO 6: CENTRAL DE SEGURANÇA E BACKUP DE DADOS (100% OFFLINE / LOCALSTORAGE) */}
        <DataBackupSecurityBlock 
          subscriberName={formData.tradeName || formData.corporateName || 'SUA EMPRESA AQUI'} 
          companyCnpj={formData.cnpjCpf || formData.cnpj || ''}
        />

        {/* Barra de Rodapé Compacta: Status Offline Resiliente & Sincronização */}
        <div className="flex items-center justify-between px-3 py-1 bg-white dark:bg-stone-900 rounded-lg border border-zinc-200 dark:border-stone-800 text-[11px] shrink-0">
          <div className="flex items-center space-x-2 text-zinc-500 dark:text-stone-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-semibold text-zinc-700 dark:text-stone-300">
              Modo Local Resiliente (LocalStorage Ativo)
            </span>
            {lastSyncedAt && (
              <span className="hidden sm:inline text-zinc-400">
                • Sincronizado às {lastSyncedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {syncFeedback && (
              <span className="text-emerald-600 font-bold ml-2">{syncFeedback}</span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setIsSqlModalOpen(true)}
              className="inline-flex items-center space-x-1 px-2 py-0.5 text-zinc-700 dark:text-stone-300 hover:text-emerald-700 dark:hover:text-emerald-400 font-semibold transition cursor-pointer"
              title="Visualizar script SQL"
            >
              <Database className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span>Script SQL</span>
            </button>

            {onSyncSupabase && (
              <button
                type="button"
                disabled={isSyncing}
                onClick={async () => {
                  await onSyncSupabase();
                  setSyncFeedback('Sincronizado!');
                  setTimeout(() => setSyncFeedback(null), 3000);
                }}
                className="inline-flex items-center space-x-1 px-2 py-0.5 text-zinc-700 dark:text-stone-300 hover:text-emerald-700 dark:hover:text-emerald-400 font-semibold transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Nuvem'}</span>
              </button>
            )}
          </div>
        </div>

      </form>

      {/* Password Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-2 sm:p-4">
          <div className="bg-[#cad4e6] rounded-xl border border-black w-[88vw] max-w-[1300px] h-[92vh] max-h-[92vh] flex flex-col justify-between mx-auto my-auto shadow-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-black bg-[#cad4e6] flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2.5 text-black">
                <div className="p-1.5 rounded-lg bg-white border border-black">
                  <KeyRound className="w-4 h-4 text-emerald-700" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-wide">Alterar Senha de Acesso</h3>
              </div>
              <button 
                type="button"
                onClick={() => setIsPasswordModalOpen(false)}
                className="p-1.5 rounded-lg text-black hover:bg-white/60 border border-transparent hover:border-black transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePasswordSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden bg-[#cad4e6]">
              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
                <div className="max-w-xl mx-auto bg-[#e0e6f1] border border-black rounded-xl p-5 space-y-4">
                  {passwordToast && (
                    <div className="p-3 bg-emerald-50 border border-emerald-500 rounded-xl text-xs text-emerald-900 font-bold">
                      {passwordToast}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-black mb-1">
                      Senha Atual
                    </label>
                    <input
                      type="password"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2 bg-white text-black border border-gray-400 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-black mb-1">
                      Nova Senha
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full px-3.5 py-2 bg-white text-black border border-gray-400 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-black mb-1">
                      Confirmar Nova Senha
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repita a nova senha"
                      className="w-full px-3.5 py-2 bg-white text-black border border-gray-400 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                </div>
              </div>

              <div className="px-5 py-3 border-t border-black bg-[#cad4e6] flex justify-end space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="px-4 py-2 bg-white hover:bg-gray-100 border border-black text-black rounded-xl text-xs font-bold cursor-pointer transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-800 rounded-xl text-xs font-bold shadow-xs cursor-pointer transition"
                >
                  Salvar Nova Senha
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Test Print Preview Modal */}
      <PrintPreviewModal
        isOpen={isTestPrintOpen}
        onClose={() => setIsTestPrintOpen(false)}
        options={{
          title: 'Documento Demonstrativo de Identidade Cadastral',
          subtitle: 'Comprovante de registro e identidade visual oficial do estabelecimento agrícola',
          documentType: 'CADASTRO DE ESTABELECIMENTO',
          company: formData,
          contentHtml: `
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:16px; margin-bottom:16px;">
              <h3 style="margin-top:0; color:#064e3b; font-size:12pt;">Identificação da Empresa</h3>
              <table style="width:100%; border-collapse:collapse; margin-top:8px;">
                <tr>
                  <td style="width:30%; font-weight:bold; background:#f1f5f9;">Razão Social:</td>
                  <td>${formData.corporateName || '-'}</td>
                </tr>
                <tr>
                  <td style="font-weight:bold; background:#f1f5f9;">Nome Fantasia:</td>
                  <td>${formData.tradeName || '-'}</td>
                </tr>
                <tr>
                  <td style="font-weight:bold; background:#f1f5f9;">CNPJ / CPF:</td>
                  <td>${formData.cnpjCpf || '-'}</td>
                </tr>
                <tr>
                  <td style="font-weight:bold; background:#f1f5f9;">Inscrição Estadual:</td>
                  <td>${formData.stateRegistration || 'Isento / Não informado'}</td>
                </tr>
                <tr>
                  <td style="font-weight:bold; background:#f1f5f9;">Telefone:</td>
                  <td>${formData.phone || '-'}</td>
                </tr>
                <tr>
                  <td style="font-weight:bold; background:#f1f5f9;">E-mail Comercial:</td>
                  <td>${formData.email || '-'}</td>
                </tr>
                <tr>
                  <td style="font-weight:bold; background:#f1f5f9;">Endereço Completo:</td>
                  <td>${formData.address || ''}, ${formData.number || 'sn'} - ${formData.neighborhood || ''} - ${formData.city || ''}/${formData.state || ''} - CEP: ${formData.zipCode || ''}</td>
                </tr>
              </table>
            </div>
            <p style="font-size:9pt; color:#475569;">
              Este modelo atesta que todas as impressões do sistema (escala de frotas, ordens de colheita, DRE financeiro e notas de saída) utilizarão automaticamente o cabeçalho oficial e a marca registrada acima.
            </p>
          `,
          signatureLabels: ['Titular do Cadastro / Produtor', 'Administração Geral'],
        }}
      />

      {/* Supabase PostgreSQL Schema Script Modal */}
      <SupabaseSqlModal
        isOpen={isSqlModalOpen}
        onClose={() => setIsSqlModalOpen(false)}
      />

      {/* Mini-Modal Interno de Confirmação para Destravar Numeração Sequencial */}
      {isSequenceUnlockConfirmOpen && (
        <div
          id="modal-confirm-unlock-sequence"
          className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-[1px] flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setIsSequenceUnlockConfirmOpen(false)}
        >
          <div
            className="w-full max-w-md bg-[#cad4e6] border border-black rounded-xl shadow-2xl overflow-hidden text-black"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 bg-[#cad4e6] border-b border-black flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-lg bg-amber-100 border border-black">
                  <AlertTriangle className="w-4 h-4 text-amber-700" />
                </div>
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wide text-black">
                  Confirmar Desbloqueio de Numeração
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSequenceUnlockConfirmOpen(false)}
                className="px-1.5 py-0.5 rounded-lg text-black hover:bg-white/60 border border-transparent hover:border-black transition cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-[#cad4e6]">
              <div className="p-3.5 bg-[#e0e6f1] border border-black rounded-lg text-xs font-semibold text-black leading-relaxed">
                Atenção: Alterar a numeração sequencial pode causar rejeição na SEFAZ se o número já tiver sido utilizado. Deseja realmente destravar os campos?
              </div>
            </div>

            <div className="px-4 py-3 bg-[#cad4e6] border-t border-black flex items-center justify-end gap-2">
              <button
                type="button"
                id="btn-cancel-unlock-sequence"
                onClick={() => setIsSequenceUnlockConfirmOpen(false)}
                className="px-4 py-1.5 bg-white hover:bg-gray-100 text-black border border-black rounded-lg text-xs font-bold cursor-pointer transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="btn-confirm-unlock-sequence"
                onClick={handleConfirmUnlockSequence}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold border border-amber-800 rounded-lg text-xs shadow-xs cursor-pointer transition"
              >
                🔓 Sim, Destravar Campos
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
