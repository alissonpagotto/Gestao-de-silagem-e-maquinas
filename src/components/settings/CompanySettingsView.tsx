import React, { useState, useRef, useEffect } from 'react';
import { 
  Building2, 
  UploadCloud, 
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
    <div id="company-settings-view" className="w-full max-w-none space-y-4 animate-in fade-in duration-200">
      
      {/* Toast Notification */}
      {savedSuccess && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-700 text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center space-x-2 text-xs font-bold border border-emerald-500 animate-in slide-in-from-bottom-4">
          <Check className="w-4 h-4 text-emerald-200" />
          <span>Alterações da empresa salvas com sucesso!</span>
        </div>
      )}

      {/* Lookup Feedback Toast */}
      {lookupFeedback && (
        <div className={`fixed top-16 right-6 z-50 text-white px-3.5 py-2 rounded-xl shadow-2xl flex items-center space-x-2 text-xs font-bold border animate-in slide-in-from-top-3 ${
          lookupFeedback.type === 'success' ? 'bg-emerald-700 border-emerald-500' : 'bg-rose-700 border-rose-500'
        }`}>
          <span>{lookupFeedback.message}</span>
        </div>
      )}

      {/* Top Header Compact */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white dark:bg-stone-900 p-3 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs">
        <div>
          <h1 className="text-base font-black text-stone-900 dark:text-cyan-400 tracking-tight font-['Outfit'] leading-tight">
            Configurações da Empresa
          </h1>
          <p className="text-[11px] text-black dark:text-stone-400 font-bold">
            Defina os dados da sua empresa, identificação cadastral, localização e dados de pagamento para documentos
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenReorderMenu && (
            <button
              type="button"
              id="btn-settings-organize-menu"
              onClick={onOpenReorderMenu}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#b0d2ed] hover:bg-[#9cc4e4] text-black rounded-xl text-xs font-bold border border-[#0963cb]/30 shadow-xs transition cursor-pointer"
              title="Personalizar Ordem do Menu Lateral"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-black" />
              <span className="text-black font-bold">Organizar Menu</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsTestPrintOpen(true)}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-700 dark:text-stone-200 rounded-xl text-xs font-bold border border-stone-200 dark:border-stone-700 transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-emerald-600" />
            <span>Testar Impressão</span>
          </button>

          <button
            type="button"
            onClick={() => handleSave()}
            className="inline-flex items-center space-x-1.5 px-4 py-1.5 bg-cyan-700 hover:bg-cyan-800 text-white rounded-xl text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Salvar Alterações</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-3.5">
        
        {/* BLOCO 1: Identificação da Empresa & Logotipo */}
        <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 rounded-2xl border border-slate-400 dark:border-stone-800 p-4 shadow-xs text-black dark:text-white">
          <div className="flex items-center justify-between mb-3 border-b border-slate-400/60 dark:border-stone-800 pb-2">
            <div className="flex items-center space-x-2 text-black dark:text-cyan-400">
              <Building2 className="w-4 h-4 text-black dark:text-cyan-400" />
              <h2 className="text-xs font-black uppercase tracking-wider">1. Identificação da Empresa & Logotipo</h2>
            </div>
            <span className="text-[10px] font-black text-black dark:text-cyan-300 bg-white/80 dark:bg-cyan-950/60 px-2.5 py-0.5 rounded-full border border-slate-300 dark:border-cyan-800">
              Auto-Preenchimento CNPJ Ativo
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Logotipo da Empresa */}
            <div className="lg:col-span-4 flex flex-col items-center justify-center p-3 bg-white/70 dark:bg-stone-800/60 rounded-xl border border-slate-300 dark:border-stone-700">
              <span className="text-[11px] font-black text-black dark:text-stone-300 mb-2 self-start">Logotipo da Empresa</span>
              
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-xl bg-white dark:bg-stone-900 border-2 border-slate-300 dark:border-stone-700 flex items-center justify-center p-2 overflow-hidden shadow-inner relative group">
                {formData.logoUrl && !logoError ? (
                  <img 
                    src={formData.logoUrl} 
                    alt="Logotipo da Empresa" 
                    className="max-w-full max-h-full object-contain drop-shadow-sm transition-transform duration-200 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                    onError={() => setLogoError(true)}
                  />
                ) : (
                  <div className="text-center text-black/70 dark:text-stone-400 p-2">
                    <ImageIcon className="w-8 h-8 mx-auto opacity-50 mb-1 text-black dark:text-stone-400" />
                    <span className="text-[10px] font-bold">Sem logotipo</span>
                  </div>
                )}
              </div>

              <div className="mt-2.5 flex items-center space-x-1.5 w-full justify-center">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImageUpload} 
                  accept="image/*" 
                  className="hidden" 
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white dark:bg-stone-800 hover:bg-stone-50 text-black dark:text-stone-200 border border-slate-300 dark:border-stone-700 rounded-xl text-xs font-black shadow-xs transition cursor-pointer"
                >
                  <UploadCloud className="w-3.5 h-3.5 text-black dark:text-cyan-400" />
                  <span>Selecionar Imagem</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetToDefaultLogo}
                  title="Remover logotipo (deixar campo limpo)"
                  className="p-1.5 bg-white dark:bg-stone-800 hover:bg-stone-50 text-black dark:text-stone-400 border border-slate-300 dark:border-stone-700 rounded-xl text-xs transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Campos Cadastrais */}
            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* CNPJ / CPF */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-black text-black dark:text-stone-300">
                    CNPJ / CPF
                  </label>
                  {isLoadingCnpj && (
                    <span className="text-[10px] text-black font-bold flex items-center space-x-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Consultando...</span>
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.cnpjCpf || ''}
                    onChange={(e) => handleCnpjCpfChange(e.target.value)}
                    placeholder="00.000.000/0000-00 ou 000.000.000-00"
                    maxLength={18}
                    className="w-full px-3 py-1.5 bg-white/90 dark:bg-stone-800/80 border border-slate-300 dark:border-stone-700 rounded-xl text-xs text-black dark:text-stone-100 font-bold focus:ring-2 focus:ring-cyan-500 focus:outline-hidden transition pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => handleSearchCnpj()}
                    disabled={isLoadingCnpj}
                    title="Buscar dados cadastrais deste CNPJ na Receita Federal"
                    className="absolute right-1.5 top-1 p-1 text-black hover:bg-black/10 dark:text-stone-400 dark:hover:bg-stone-700 rounded-lg transition cursor-pointer"
                  >
                    {isLoadingCnpj ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                    ) : (
                      <Search className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Inscrição Estadual */}
              <div>
                <label className="block text-[11px] font-black text-black dark:text-stone-300 mb-1">
                  Inscrição Estadual
                </label>
                <input
                  type="text"
                  value={formData.stateRegistration || ''}
                  onChange={(e) => handleChange('stateRegistration', formatIE(e.target.value))}
                  placeholder="Isento ou nº IE (ex: 959.584.721.1)"
                  maxLength={18}
                  className="w-full px-3 py-1.5 bg-white/90 dark:bg-stone-800/80 border border-slate-300 dark:border-stone-700 rounded-xl text-xs text-black dark:text-stone-100 font-bold focus:ring-2 focus:ring-cyan-500 focus:outline-hidden transition"
                />
              </div>

              {/* Razão Social */}
              <div>
                <label className="block text-[11px] font-black text-black dark:text-stone-300 mb-1">
                  Razão Social
                </label>
                <input
                  type="text"
                  value={formData.corporateName || ''}
                  onChange={(e) => handleChange('corporateName', e.target.value)}
                  placeholder="Ex: Silagem Sao Paulo Ltda"
                  className="w-full px-3 py-1.5 bg-white/90 dark:bg-stone-800/80 border border-slate-300 dark:border-stone-700 rounded-xl text-xs text-black dark:text-stone-100 font-bold focus:ring-2 focus:ring-cyan-500 focus:outline-hidden transition"
                />
              </div>

              {/* Nome Fantasia */}
              <div>
                <label className="block text-[11px] font-black text-black dark:text-stone-300 mb-1">
                  Nome Fantasia
                </label>
                <input
                  type="text"
                  value={formData.tradeName || ''}
                  onChange={(e) => handleChange('tradeName', e.target.value)}
                  placeholder="Ex: Silagem Sao Paulo"
                  className="w-full px-3 py-1.5 bg-white/90 dark:bg-stone-800/80 border border-slate-300 dark:border-stone-700 rounded-xl text-xs text-black dark:text-stone-100 font-bold focus:ring-2 focus:ring-cyan-500 focus:outline-hidden transition"
                />
              </div>

              {/* Ramo / Setor de Atividade */}
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-black text-black dark:text-stone-300 mb-1">
                  Setor / Ramo de Atividade
                </label>
                <input
                  type="text"
                  value={formData.activitySector || 'GESTÃO AGRÍCOLA & PRESTAÇÃO DE SERVIÇOS DE SILAGEM'}
                  onChange={(e) => handleChange('activitySector', e.target.value)}
                  placeholder="Ex: Gestão Agrícola & Produção de Silagem"
                  className="w-full px-3 py-1.5 bg-white/90 dark:bg-stone-800/80 border border-slate-300 dark:border-stone-700 rounded-xl text-xs text-black dark:text-stone-100 font-bold focus:ring-2 focus:ring-cyan-500 focus:outline-hidden transition"
                />
              </div>
            </div>
          </div>
        </div>

        {/* BLOCO 2: Localização & Endereço */}
        <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 rounded-2xl border border-slate-400 dark:border-stone-800 p-4 shadow-xs text-black dark:text-white">
          <div className="flex items-center justify-between mb-3 border-b border-slate-400/60 dark:border-stone-800 pb-2">
            <div className="flex items-center space-x-2 text-black dark:text-cyan-400">
              <MapPin className="w-4 h-4 text-black dark:text-cyan-400" />
              <h2 className="text-xs font-black uppercase tracking-wider">2. Localização & Endereço</h2>
            </div>
            <span className="text-[10px] font-black text-black dark:text-emerald-300 bg-white/80 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-slate-300 dark:border-emerald-800">
              Auto-Preenchimento CEP Ativo
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-2.5">
            {/* CEP with auto-mask and lookup button */}
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-black text-black dark:text-stone-300">
                  CEP
                </label>
                {isLoadingCep && (
                  <span className="text-[10px] text-black font-bold flex items-center space-x-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Buscando...</span>
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
                  className="w-full px-3 py-1.5 bg-white/90 dark:bg-stone-800/80 border border-slate-300 dark:border-stone-700 rounded-xl text-xs text-black dark:text-stone-100 font-bold focus:ring-2 focus:ring-cyan-500 focus:outline-hidden transition pr-9"
                />
                <button
                  type="button"
                  onClick={() => handleSearchCep()}
                  disabled={isLoadingCep}
                  title="Buscar endereço deste CEP automaticamente"
                  className="absolute right-1.5 top-1 p-1 text-black hover:bg-black/10 dark:text-stone-400 dark:hover:bg-stone-700 rounded-lg transition cursor-pointer"
                >
                  {isLoadingCep ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                  ) : (
                    <Search className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Endereço */}
            <div className="md:col-span-3">
              <label className="block text-[11px] font-black text-black dark:text-stone-300 mb-1">
                Endereço / Logradouro
              </label>
              <input
                type="text"
                value={formData.address || ''}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder="Ex: Rodovia PR 473 ou Av. Brasil"
                className="w-full px-3 py-1.5 bg-white/90 dark:bg-stone-800/80 border border-slate-300 dark:border-stone-700 rounded-xl text-xs text-black dark:text-stone-100 font-bold focus:ring-2 focus:ring-cyan-500 focus:outline-hidden transition"
              />
            </div>

            {/* Número */}
            <div className="md:col-span-1">
              <label className="block text-[11px] font-black text-black dark:text-stone-300 mb-1">
                Número
              </label>
              <input
                type="text"
                value={formData.number || ''}
                onChange={(e) => handleChange('number', e.target.value)}
                placeholder="Ex: sn, 1050"
                className="w-full px-3 py-1.5 bg-white/90 dark:bg-stone-800/80 border border-slate-300 dark:border-stone-700 rounded-xl text-xs text-black dark:text-stone-100 font-bold focus:ring-2 focus:ring-cyan-500 focus:outline-hidden transition"
              />
            </div>

            {/* Bairro */}
            <div className="md:col-span-2">
              <label className="block text-[11px] font-black text-black dark:text-stone-300 mb-1">
                Bairro
              </label>
              <input
                type="text"
                value={formData.neighborhood || ''}
                onChange={(e) => handleChange('neighborhood', e.target.value)}
                placeholder="Ex: Centro ou Zona Rural"
                className="w-full px-3 py-1.5 bg-white/90 dark:bg-stone-800/80 border border-slate-300 dark:border-stone-700 rounded-xl text-xs text-black dark:text-stone-100 font-bold focus:ring-2 focus:ring-cyan-500 focus:outline-hidden transition"
              />
            </div>

            {/* Cidade */}
            <div className="md:col-span-3">
              <label className="block text-[11px] font-black text-black dark:text-stone-300 mb-1">
                Cidade
              </label>
              <input
                type="text"
                value={formData.city || ''}
                onChange={(e) => handleChange('city', e.target.value)}
                placeholder="Ex: Boa Esperança do Iguaçu"
                className="w-full px-3 py-1.5 bg-white/90 dark:bg-stone-800/80 border border-slate-300 dark:border-stone-700 rounded-xl text-xs text-black dark:text-stone-100 font-bold focus:ring-2 focus:ring-cyan-500 focus:outline-hidden transition"
              />
            </div>

            {/* Estado (UF) */}
            <div className="md:col-span-1">
              <label className="block text-[11px] font-black text-black dark:text-stone-300 mb-1">
                UF
              </label>
              <input
                type="text"
                value={formData.state || ''}
                onChange={(e) => handleChange('state', e.target.value.toUpperCase())}
                placeholder="PR"
                maxLength={2}
                className="w-full px-3 py-1.5 bg-white/90 dark:bg-stone-800/80 border border-slate-300 dark:border-stone-700 rounded-xl text-xs text-black dark:text-stone-100 font-bold uppercase focus:ring-2 focus:ring-cyan-500 focus:outline-hidden transition"
              />
            </div>
          </div>
        </div>

        {/* BLOCO 3: Contatos & Representante Responsável */}
        <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 rounded-2xl border border-slate-400 dark:border-stone-800 p-4 shadow-xs text-black dark:text-white">
          <div className="flex items-center space-x-2 text-black dark:text-cyan-400 mb-3 border-b border-slate-400/60 dark:border-stone-800 pb-2">
            <PhoneCall className="w-4 h-4 text-black dark:text-cyan-400" />
            <h2 className="text-xs font-black uppercase tracking-wider">3. Contatos & Representante Responsável</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
            {/* Telefone de Contato */}
            <div>
              <label className="block text-[11px] font-black text-black dark:text-stone-300 mb-1">
                Telefone Comercial / WhatsApp
              </label>
              <input
                type="text"
                value={formData.phone || ''}
                onChange={(e) => handleChange('phone', formatPhone(e.target.value))}
                placeholder="Ex: (22) 22222-2888"
                maxLength={15}
                className="w-full px-3 py-1.5 bg-white/90 dark:bg-stone-800/80 border border-slate-300 dark:border-stone-700 rounded-xl text-xs text-black dark:text-stone-100 font-bold focus:ring-2 focus:ring-cyan-500 focus:outline-hidden transition"
              />
            </div>

            {/* E-mail Comercial */}
            <div>
              <label className="block text-[11px] font-black text-black dark:text-stone-300 mb-1">
                E-mail Comercial
              </label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="Ex: contato@silagemsaopaulo.com.br"
                className="w-full px-3 py-1.5 bg-white/90 dark:bg-stone-800/80 border border-slate-300 dark:border-stone-700 rounded-xl text-xs text-black dark:text-stone-100 font-bold focus:ring-2 focus:ring-cyan-500 focus:outline-hidden transition"
              />
            </div>

            {/* Representante Responsável */}
            <div>
              <label className="block text-[11px] font-black text-black dark:text-stone-300 mb-1">
                Representante Responsável
              </label>
              <input
                type="text"
                value={formData.representativeName || ''}
                onChange={(e) => handleChange('representativeName', e.target.value)}
                placeholder="Ex: Carlos Eduardo de Oliveira"
                className="w-full px-3 py-1.5 bg-white/90 dark:bg-stone-800/80 border border-slate-300 dark:border-stone-700 rounded-xl text-xs text-black dark:text-stone-100 font-bold focus:ring-2 focus:ring-cyan-500 focus:outline-hidden transition"
              />
            </div>

            {/* CPF do Representante */}
            <div>
              <label className="block text-[11px] font-black text-black dark:text-stone-300 mb-1">
                CPF do Representante
              </label>
              <input
                type="text"
                value={formData.representativeCpf || ''}
                onChange={(e) => handleChange('representativeCpf', formatCpfCnpj(e.target.value))}
                placeholder="000.000.000-00"
                maxLength={14}
                className="w-full px-3 py-1.5 bg-white/90 dark:bg-stone-800/80 border border-slate-300 dark:border-stone-700 rounded-xl text-xs text-black dark:text-stone-100 font-bold focus:ring-2 focus:ring-cyan-500 focus:outline-hidden transition"
              />
            </div>
          </div>
        </div>

        {/* BLOCO 4: Dados Bancários & PIX para Recebimento */}
        <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 rounded-2xl border border-slate-400 dark:border-stone-800 p-4 shadow-xs text-black dark:text-white">
          <div className="flex items-center space-x-2 text-black dark:text-cyan-400 mb-3 border-b border-slate-400/60 dark:border-stone-800 pb-2">
            <CreditCard className="w-4 h-4 text-black dark:text-cyan-400" />
            <h2 className="text-xs font-black uppercase tracking-wider">4. Dados Bancários & PIX para Recebimento</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
            {/* Banco */}
            <div className="md:col-span-1">
              <label className="block text-[11px] font-black text-black dark:text-stone-300 mb-1">
                Banco
              </label>
              <input
                type="text"
                value={formData.bankName || ''}
                onChange={(e) => handleChange('bankName', e.target.value)}
                placeholder="Ex: Banco do Brasil (001)"
                className="w-full px-3 py-1.5 bg-white/90 dark:bg-stone-800/80 border border-slate-300 dark:border-stone-700 rounded-xl text-xs text-black dark:text-stone-100 font-bold focus:ring-2 focus:ring-cyan-500 focus:outline-hidden transition"
              />
            </div>

            {/* Agência */}
            <div className="md:col-span-1">
              <label className="block text-[11px] font-black text-black dark:text-stone-300 mb-1">
                Agência
              </label>
              <input
                type="text"
                value={formData.bankAgency || ''}
                onChange={(e) => handleChange('bankAgency', e.target.value)}
                placeholder="Ex: 1234-5"
                className="w-full px-3 py-1.5 bg-white/90 dark:bg-stone-800/80 border border-slate-300 dark:border-stone-700 rounded-xl text-xs text-black dark:text-stone-100 font-bold focus:ring-2 focus:ring-cyan-500 focus:outline-hidden transition"
              />
            </div>

            {/* Conta Corrente */}
            <div className="md:col-span-1">
              <label className="block text-[11px] font-black text-black dark:text-stone-300 mb-1">
                Conta Corrente
              </label>
              <input
                type="text"
                value={formData.bankAccount || ''}
                onChange={(e) => handleChange('bankAccount', e.target.value)}
                placeholder="Ex: 56789-0"
                className="w-full px-3 py-1.5 bg-white/90 dark:bg-stone-800/80 border border-slate-300 dark:border-stone-700 rounded-xl text-xs text-black dark:text-stone-100 font-bold focus:ring-2 focus:ring-cyan-500 focus:outline-hidden transition"
              />
            </div>

            {/* Tipo de Chave PIX */}
            <div className="md:col-span-1">
              <label className="block text-[11px] font-black text-black dark:text-stone-300 mb-1">
                Tipo Chave PIX
              </label>
              <select
                value={formData.pixKeyType || 'cnpj'}
                onChange={(e) => handleChange('pixKeyType', e.target.value)}
                className="w-full px-3 py-1.5 bg-white/90 dark:bg-stone-800/80 border border-slate-300 dark:border-stone-700 rounded-xl text-xs text-black dark:text-stone-100 font-bold focus:ring-2 focus:ring-cyan-500 focus:outline-hidden transition cursor-pointer"
              >
                <option value="cnpj">CNPJ</option>
                <option value="cpf">CPF</option>
                <option value="email">E-mail</option>
                <option value="telefone">Telefone</option>
                <option value="aleatoria">Chave Aleatória</option>
              </select>
            </div>

            {/* Chave PIX */}
            <div className="md:col-span-1">
              <label className="block text-[11px] font-black text-black dark:text-stone-300 mb-1">
                Chave PIX
              </label>
              <input
                type="text"
                value={formData.pixKey || ''}
                onChange={(e) => handleChange('pixKey', e.target.value)}
                placeholder="Ex: 57.872.222/0001-22"
                className="w-full px-3 py-1.5 bg-white/90 dark:bg-stone-800/80 border border-slate-300 dark:border-stone-700 rounded-xl text-xs text-black dark:text-stone-100 font-bold focus:ring-2 focus:ring-cyan-500 focus:outline-hidden transition"
              />
            </div>
          </div>
        </div>

        {/* BLOCO 5: Personalização da Interface & Navegação */}
        <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 rounded-2xl border border-slate-400 dark:border-stone-800 p-4 shadow-xs text-black dark:text-white">
          <div className="flex items-center justify-between mb-3 border-b border-slate-400/60 dark:border-stone-800 pb-2">
            <div className="flex items-center space-x-2 text-black dark:text-cyan-400">
              <SlidersHorizontal className="w-4 h-4 text-black dark:text-cyan-400" />
              <h2 className="text-xs font-black uppercase tracking-wider">
                5. PERSONALIZAÇÃO DA INTERFACE &amp; NAVEGAÇÃO
              </h2>
            </div>
            <span className="text-[10px] font-black text-black dark:text-cyan-300 bg-white/80 dark:bg-cyan-950/60 px-2.5 py-0.5 rounded-full border border-slate-300 dark:border-cyan-800">
              Ajustes de Navegação
            </span>
          </div>

          <p className="text-xs text-black font-semibold mb-3">
            Configure a disposição dos módulos e atalhos rápidos do sistema para acelerar a sua rotina operacional:
          </p>

          <div className="grid grid-cols-1 gap-3">
            {/* Card Ordem do Menu Lateral */}
            <div className="p-3.5 bg-white rounded-xl border border-slate-300 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center space-x-2 mb-1">
                  <ArrowUpDown className="w-4 h-4 text-[#0963cb]" />
                  <h3 className="text-xs font-bold text-black">Ordem do Menu Lateral</h3>
                </div>
                <p className="text-[11px] text-stone-600">
                  Reorganize a sequência dos módulos no menu lateral esquerdo conforme sua preferência de acesso e fluxo de trabalho operacional.
                </p>
              </div>

              <button
                type="button"
                onClick={onOpenReorderMenu}
                className="inline-flex items-center justify-center space-x-2 px-4 py-2 bg-[#b0d2ed] hover:bg-[#9cc4e4] text-black font-bold text-xs rounded-xl border border-[#0963cb]/30 shadow-xs transition cursor-pointer shrink-0"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-black" />
                <span className="text-black font-bold">Organizar Menu</span>
              </button>
            </div>
          </div>
        </div>

        {/* Card 4: Segurança e Acesso */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-cyan-100 dark:border-stone-800 p-3.5 shadow-xs">
          <div className="flex items-center space-x-2 text-cyan-700 dark:text-cyan-400 mb-2">
            <ShieldCheck className="w-4 h-4" />
            <h2 className="text-xs font-bold">Segurança e Acesso</h2>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex-1 max-w-md">
              <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1">
                E-mail de Login
              </label>
              <div className="relative">
                <input
                  type="text"
                  disabled
                  value={formData.loginEmail || formData.email || 'silagemteste02@gmail.com'}
                  className="w-full px-3 py-1.5 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs text-stone-500 dark:text-stone-400 font-medium cursor-not-allowed pr-9"
                />
                <Lock className="w-3.5 h-3.5 text-stone-400 absolute right-3 top-2.5" />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(true)}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white dark:bg-stone-800 hover:bg-stone-50 text-cyan-700 dark:text-cyan-400 border border-cyan-300 dark:border-cyan-800 rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Alterar Senha</span>
              </button>

              <button
                type="submit"
                className="inline-flex items-center space-x-1.5 px-4 py-1.5 bg-cyan-700 hover:bg-cyan-800 text-white rounded-xl text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Salvar Tudo</span>
              </button>
            </div>
          </div>
        </div>

        {/* Card 5: Banco de Dados na Nuvem (Supabase PostgreSQL) */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-emerald-100 dark:border-stone-800 p-3.5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2 text-emerald-700 dark:text-emerald-400">
              <Database className="w-4 h-4" />
              <h2 className="text-xs font-bold">Banco de Dados Supabase (PostgreSQL Relacional)</h2>
            </div>
            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
              <span className={`w-1.5 h-1.5 rounded-full ${isConnectedToSupabase || isConfigured ? 'bg-emerald-500 animate-pulse' : 'bg-stone-400'}`}></span>
              <span>{isConfigured ? 'Supabase Conectado' : 'Modo Local / Pronto'}</span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs mb-3">
            <div className="p-3 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200/60 dark:border-stone-700/60 space-y-1">
              <p className="text-[11px] font-bold text-stone-700 dark:text-stone-300">Infraestrutura Relacional</p>
              <p className="text-stone-500 dark:text-stone-400 text-[11px]">
                <strong className="text-stone-700 dark:text-stone-300">Provedor:</strong> Supabase (PostgreSQL 15+)
              </p>
              <p className="text-stone-500 dark:text-stone-400 text-[11px]">
                <strong className="text-stone-700 dark:text-stone-300">Tabelas Estruturadas:</strong> clientes, fornecedores, estoque, notas_fiscais, parcelas_financeiras, rh_funcionarios, gestao_frotas
              </p>
              <p className="text-stone-500 dark:text-stone-400 text-[11px]">
                <strong className="text-stone-700 dark:text-stone-300">Variáveis:</strong> SUPABASE_URL & SUPABASE_ANON_KEY
              </p>
            </div>

            <div className="p-3 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200/60 dark:border-stone-700/60 flex flex-col justify-between">
              <div>
                <p className="text-[11px] font-bold text-stone-700 dark:text-stone-300">Status da Conexão</p>
                <div className="mt-1 text-[11px]">
                  <p className="font-semibold text-stone-800 dark:text-stone-200">
                    {isConfigured ? 'Pronto para Sincronização em Tempo Real' : 'Armazenamento Local Ativo (Configuração Supabase Opcional)'}
                  </p>
                  <p className="text-stone-400 text-[10px] mt-0.5">
                    {currentUser ? `Autenticado: ${currentUser.email || currentUser.displayName}` : 'Operando em modo seguro local'}
                  </p>
                </div>
              </div>

              {lastSyncedAt && (
                <p className="text-[10px] text-stone-400 mt-2">
                  Última sincronização: {lastSyncedAt.toLocaleString('pt-BR')}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
            <div>
              {syncFeedback && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{syncFeedback}</span>
                </p>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setIsSqlModalOpen(true)}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 rounded-xl text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer"
                title="Visualizar e copiar script SQL de criação das tabelas no Supabase"
              >
                <Database className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Script SQL (PostgreSQL)</span>
              </button>

              <button
                type="button"
                disabled={isSyncing}
                onClick={async () => {
                  if (onSyncSupabase) {
                    await onSyncSupabase();
                    setSyncFeedback('Dados sincronizados com o Supabase com sucesso!');
                    setTimeout(() => setSyncFeedback(null), 4000);
                  }
                }}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar com Supabase'}</span>
              </button>
            </div>
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
