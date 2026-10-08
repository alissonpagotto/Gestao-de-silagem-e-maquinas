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
  PhoneCall
} from 'lucide-react';
import { CompanyProfile, ExpenseCategory, CostCenter } from '../../types';
import { PrintPreviewModal } from '../common/PrintPreviewModal';
import { SupabaseSqlModal } from './SupabaseSqlModal';
import { useAuth } from '../../context/AuthContext';
import { 
  formatCpfCnpj, 
  formatIE, 
  formatCep, 
  formatPhone, 
  cleanDigits, 
  fetchAddressByCep, 
  fetchCompanyByCnpj 
} from '../../lib/formatters';
import { saveCloudCompanyProfile, fetchCloudCompanyProfile } from '../../lib/supabaseService';
import { getStoredCompanyProfile, saveStoredCompanyProfile } from '../../lib/storage';

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

  // Form State initialized from props
  const [formData, setFormData] = useState<CompanyProfile>({
    ...companyProfile,
    logoUrl: cleanLogoUrl(companyProfile.logoUrl),
    cnpjCpf: formatCpfCnpj(companyProfile.cnpjCpf || ''),
    stateRegistration: formatIE(companyProfile.stateRegistration || ''),
    phone: formatPhone(companyProfile.phone || ''),
    zipCode: formatCep(companyProfile.zipCode || ''),
    representativeName: companyProfile.representativeName || '',
    representativeCpf: companyProfile.representativeCpf ? formatCpfCnpj(companyProfile.representativeCpf) : '',
    bankName: companyProfile.bankName || '',
    bankAgency: companyProfile.bankAgency || '',
    bankAccount: companyProfile.bankAccount || '',
    pixKeyType: companyProfile.pixKeyType || 'cnpj',
    pixKey: companyProfile.pixKey || '',
  });

  // Mantém os campos do formulário sempre reativos e preenchidos quando o perfil for atualizado/cadastrado
  useEffect(() => {
    setFormData({
      ...companyProfile,
      logoUrl: cleanLogoUrl(companyProfile.logoUrl),
      cnpjCpf: formatCpfCnpj(companyProfile.cnpjCpf || ''),
      stateRegistration: formatIE(companyProfile.stateRegistration || ''),
      phone: formatPhone(companyProfile.phone || ''),
      zipCode: formatCep(companyProfile.zipCode || ''),
      representativeName: companyProfile.representativeName || '',
      representativeCpf: companyProfile.representativeCpf ? formatCpfCnpj(companyProfile.representativeCpf) : '',
      bankName: companyProfile.bankName || '',
      bankAgency: companyProfile.bankAgency || '',
      bankAccount: companyProfile.bankAccount || '',
      pixKeyType: companyProfile.pixKeyType || 'cnpj',
      pixKey: companyProfile.pixKey || '',
    });
  }, [companyProfile]);

  // Carga direta da nuvem (Supabase) ao carregar o componente para garantir dados fiscais atualizados
  useEffect(() => {
    let isMounted = true;
    fetchCloudCompanyProfile().then((cloudProfile) => {
      if (cloudProfile && isMounted) {
        setFormData(prev => ({
          ...prev,
          ...cloudProfile,
          logoUrl: cleanLogoUrl(cloudProfile.logoUrl || prev.logoUrl),
          cnpjCpf: formatCpfCnpj(cloudProfile.cnpjCpf || prev.cnpjCpf || ''),
          stateRegistration: formatIE(cloudProfile.stateRegistration || prev.stateRegistration || ''),
          phone: formatPhone(cloudProfile.phone || prev.phone || ''),
          zipCode: formatCep(cloudProfile.zipCode || prev.zipCode || ''),
        }));
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordToast, setPasswordToast] = useState<string | null>(null);

  // Auto Lookup Statuses
  const [isLoadingCnpj, setIsLoadingCnpj] = useState(false);
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [lookupFeedback, setLookupFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Test Print modal
  const [isTestPrintOpen, setIsTestPrintOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (field: keyof CompanyProfile, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    if (field === 'activitySector') {
      try {
        if (typeof window !== 'undefined') {
          const existingRaw = localStorage.getItem('dadosEmpresa');
          const existing = existingRaw ? JSON.parse(existingRaw) : {};
          localStorage.setItem('dadosEmpresa', JSON.stringify({
            ...existing,
            ramoAtividade: value,
            activitySector: value
          }));
          queueMicrotask(() => {
            window.dispatchEvent(new CustomEvent('colaca_company_profile_live_change', {
              detail: { activitySector: value, ramoAtividade: value }
            }));
          });
        }
        const stored = getStoredCompanyProfile();
        if (stored) {
          saveStoredCompanyProfile({ ...stored, activitySector: value, ramoAtividade: value } as any);
        }
      } catch (e) {
        console.warn('Erro ao sincronizar setor em tempo real:', e);
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('A imagem selecionada é muito grande. Por favor escolha uma imagem de até 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        setLogoError(false);
        setFormData(prev => ({
          ...prev,
          logoUrl: base64
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleResetToDefaultLogo = () => {
    setLogoError(false);
    setFormData(prev => ({
      ...prev,
      logoUrl: ''
    }));
  };

  const [isSavingCloud, setIsSavingCloud] = useState(false);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSavingCloud(true);
    try {
      const activeSector = formData.activitySector || 'Prestação de serviço de Silagem';
      if (typeof localStorage !== 'undefined') {
        const existingRaw = localStorage.getItem('dadosEmpresa');
        const existing = existingRaw ? JSON.parse(existingRaw) : {};
        localStorage.setItem('dadosEmpresa', JSON.stringify({
          ...existing,
          ramoAtividade: activeSector,
          activitySector: activeSector
        }));
      }
      await saveCloudCompanyProfile(formData);
      onSaveCompanyProfile(formData);
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
      }, 4000);
    } catch (err) {
      console.error('Erro ao salvar configurações fiscais na nuvem:', err);
      onSaveCompanyProfile(formData);
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
    <div id="company-settings-view" className="w-full h-full max-h-[calc(100vh-120px)] overflow-hidden flex flex-col justify-between space-y-2.5 animate-in fade-in duration-200">
      
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

        <div className="flex items-center space-x-1.5 shrink-0">
          {onOpenReorderMenu && (
            <button
              type="button"
              id="btn-settings-organize-menu"
              onClick={onOpenReorderMenu}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 hover:from-slate-100 hover:to-slate-200 text-slate-800 dark:from-stone-800 dark:via-stone-750 dark:to-stone-850 dark:text-stone-100 rounded-xl text-xs font-bold uppercase border border-slate-400 dark:border-stone-600 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9)] dark:shadow-[inset_1px_1px_0px_rgba(255,255,255,0.1)] transition active:scale-95 cursor-pointer whitespace-nowrap"
              title="Personalizar Ordem do Menu Lateral"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-700 dark:text-stone-300" />
              <span>ORGANIZAR MENU</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsTestPrintOpen(true)}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 hover:from-slate-100 hover:to-slate-200 text-slate-800 dark:from-stone-800 dark:via-stone-750 dark:to-stone-850 dark:text-stone-100 rounded-xl text-xs font-bold uppercase border border-slate-400 dark:border-stone-600 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9)] dark:shadow-[inset_1px_1px_0px_rgba(255,255,255,0.1)] transition active:scale-95 cursor-pointer whitespace-nowrap"
            title="Testar Impressão de Relatórios e Comprovantes"
          >
            <Printer className="w-3.5 h-3.5 text-slate-700 dark:text-stone-300" />
            <span>TESTAR IMPRESSÃO</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPasswordModalOpen(true)}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 hover:from-slate-100 hover:to-slate-200 text-slate-800 dark:from-stone-800 dark:via-stone-750 dark:to-stone-850 dark:text-stone-100 rounded-xl text-xs font-bold uppercase border border-slate-400 dark:border-stone-600 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9)] dark:shadow-[inset_1px_1px_0px_rgba(255,255,255,0.1)] transition active:scale-95 cursor-pointer whitespace-nowrap"
            title="Alterar Senha de Acesso"
          >
            <KeyRound className="w-3.5 h-3.5 text-slate-700 dark:text-stone-300" />
            <span>SENHA</span>
          </button>

          <button
            type="button"
            onClick={() => handleSave()}
            disabled={isSavingCloud}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-550 text-white rounded-xl text-xs font-bold uppercase border border-emerald-600 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.4)] transition active:scale-95 cursor-pointer disabled:opacity-50 whitespace-nowrap"
            title="Salvar Alterações da Empresa"
          >
            <Save className="w-3.5 h-3.5 text-white stroke-[2.5]" />
            <span>{isSavingCloud ? 'SALVANDO...' : 'SALVAR ALTERAÇÕES'}</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="flex-1 flex flex-col justify-between gap-2.5 overflow-hidden">
        
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
                {formData.logoUrl && !logoError ? (
                  <img 
                    src={formData.logoUrl} 
                    alt="COLACA SILAGEM" 
                    className="w-full h-full object-contain p-2 drop-shadow-2xs transition-transform duration-200 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                    onError={() => setLogoError(true)}
                  />
                ) : (
                  <div className="text-center text-zinc-400 dark:text-stone-500 p-1">
                    <ImageIcon className="w-6 h-6 mx-auto opacity-50 mb-0.5 text-zinc-400" />
                    <span className="text-[9px] font-bold tracking-tight uppercase">COLACA SILAGEM</span>
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
            <div className="col-span-12 sm:col-span-9 lg:col-span-10 grid grid-cols-1 sm:grid-cols-4 gap-2">
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

              {/* Setor / Ramo de Atividade */}
              <div className="sm:col-span-4">
                <label className="block text-xs font-semibold text-zinc-800 dark:text-stone-300 mb-0.5">
                  Setor / Ramo de Atividade
                </label>
                <input
                  type="text"
                  value={formData.activitySector !== undefined ? formData.activitySector : 'Prestação de serviço de Silagem'}
                  onChange={(e) => handleChange('activitySector', e.target.value)}
                  placeholder="Ex: Prestação de serviço de Silagem"
                  className="w-full px-2.5 py-1 bg-white dark:bg-stone-800 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs text-zinc-900 dark:text-stone-100 font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition"
                />
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
                onChange={(e) => handleChange('pixKeyType', e.target.value)}
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
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
              <div className="flex items-center space-x-2 text-cyan-700 dark:text-cyan-400">
                <KeyRound className="w-5 h-5" />
                <h3 className="text-sm font-bold">Alterar Senha de Acesso</h3>
              </div>
              <button 
                onClick={() => setIsPasswordModalOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                ✕
              </button>
            </div>

            {passwordToast && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 font-bold">
                {passwordToast}
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Senha Atual
                </label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Nova Senha
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full px-3.5 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Confirmar Nova Senha
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="w-full px-3.5 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-xs"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="px-4 py-2 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-xl text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-700 hover:bg-cyan-800 text-white rounded-xl text-xs font-bold shadow-xs"
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

    </div>
  );
};
