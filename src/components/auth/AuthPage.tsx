import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Mail, 
  Lock, 
  Phone, 
  MapPin, 
  Sparkles, 
  CheckCircle2, 
  ArrowRight, 
  ChevronLeft, 
  Loader2, 
  Eye, 
  EyeOff, 
  Search, 
  AlertCircle, 
  ShieldCheck, 
  Layers, 
  Tractor,
  Clock,
  UserCheck
} from 'lucide-react';
import { 
  formatCpfCnpj, 
  formatIE, 
  formatCep, 
  formatPhone, 
  cleanDigits, 
  fetchAddressByCep, 
  fetchCompanyByCnpj,
  formatCurrencyBRL 
} from '../../lib/formatters';
import { 
  registerNewSubscriber, 
  getStoredPlans, 
  getStoredSubscribers,
  getStoredSiteConfig,
  getStoredLandingSettings,
  DEFAULT_SITE_CONFIG,
  LANDING_PAGE_SETTINGS_KEY,
  AGROCONTROL_PLANS_DATA_KEY,
  AGROCONTROL_SITE_SETTINGS_KEY
} from '../../lib/masterAdminStorage';
import { PlanDefinition, SubscriberStatus, SiteConfig } from '../../types/masterAdmin';
import { CompanyProfile } from '../../types';
import { getStoredCompanyProfile } from '../../lib/storage';
import { useAuth } from '../../context/AuthContext';

interface AuthPageProps {
  onEnterApp: () => void;
  onOpenLandingPage: () => void;
  onCompanyCreated?: (profile: CompanyProfile) => void;
}

const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

export const AuthPage: React.FC<AuthPageProps> = ({
  onEnterApp,
  onOpenLandingPage,
  onCompanyCreated,
}) => {
  const { signIn, signUp } = useAuth();
  const [plans, setPlans] = useState<PlanDefinition[]>(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(AGROCONTROL_PLANS_DATA_KEY) || localStorage.getItem('silagem_master_plans_v1');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      }
    } catch (e) {
      console.error('Erro ao ler planos no AuthPage:', e);
    }
    return getStoredPlans();
  });
  const [siteConfig, setSiteConfig] = useState<SiteConfig>(() => getStoredLandingSettings());

  // Parâmetros da URL: ?mode=signup &plan=plano-pro &paid=true
  const [mode, setMode] = useState<'signup' | 'login'>(() => {
    if (typeof window === 'undefined') return 'signup';
    const params = new URLSearchParams(window.location.search);
    return params.get('mode') === 'login' ? 'login' : 'signup';
  });

  const [selectedPlanId, setSelectedPlanId] = useState<string>(() => {
    if (typeof window === 'undefined') return 'plano-pro';
    const params = new URLSearchParams(window.location.search);
    const planParam = params.get('plan');
    if (planParam) return planParam;
    return 'plano-pro';
  });

  const [isPrePaid, setIsPrePaid] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('paid') === 'true' || params.get('status') === 'pago';
  });

  // Atualiza parâmetros caso a URL mude e sincroniza alterações em tempo real do Master Admin
  useEffect(() => {
    const handleUrlChange = () => {
      const params = new URLSearchParams(window.location.search);
      const newMode = params.get('mode');
      if (newMode === 'login' || newMode === 'signup') {
        setMode(newMode);
      }
      const planParam = params.get('plan');
      if (planParam) {
        setSelectedPlanId(planParam);
      }
      const paidParam = params.get('paid') === 'true' || params.get('status') === 'pago';
      setIsPrePaid(paidParam);
    };

    const handleDataChange = (e?: any) => {
      if (e?.detail) {
        if (Array.isArray(e.detail)) {
          setPlans(e.detail);
        } else {
          setSiteConfig((prev) => ({ ...prev, ...e.detail }));
          setPlans(getStoredPlans());
        }
      } else {
        setSiteConfig(getStoredLandingSettings());
        setPlans(getStoredPlans());
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (
        e.key === AGROCONTROL_PLANS_DATA_KEY ||
        e.key === 'agrocontrol_plans_data' ||
        e.key === 'silagem_master_plans_v1' ||
        e.key === AGROCONTROL_SITE_SETTINGS_KEY ||
        e.key === 'agrocontrol_site_settings' ||
        e.key === LANDING_PAGE_SETTINGS_KEY || 
        e.key === 'silagem_master_site_config_v1'
      ) {
        handleDataChange();
      }
    };

    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('master_admin_data_changed', handleDataChange);
    window.addEventListener('agrocontrol_site_settings_updated', handleDataChange);
    window.addEventListener('landing_page_settings_updated', handleDataChange);
    window.addEventListener('agrocontrol_plans_updated', handleDataChange);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('master_admin_data_changed', handleDataChange);
      window.removeEventListener('agrocontrol_site_settings_updated', handleDataChange);
      window.removeEventListener('landing_page_settings_updated', handleDataChange);
      window.removeEventListener('agrocontrol_plans_updated', handleDataChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Dados do formulário de Cadastro (Sign-up)
  const [formData, setFormData] = useState({
    name: '',
    tradeName: '',
    responsibleName: '',
    responsibleEmail: '',
    password: '',
    phone: '',
    cpfCnpj: '',
    stateRegistration: '',
    cep: '',
    street: '',
    number: '',
    neighborhood: '',
    city: '',
    state: 'PR',
  });

  // Dados de Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Estados Visuais & Utilitários
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCnpj, setIsLoadingCnpj] = useState(false);
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Plano Ativo Selecionado
  const activePlan = plans.find(p => p.id === selectedPlanId) || 
                     plans.find(p => p.isFeatured && p.isActive) || 
                     plans.find(p => p.isActive) || 
                     plans[0];

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    if (formError) setFormError(null);
  };

  // Máscara e Busca Dinâmica de CNPJ
  const handleCpfCnpjChange = async (val: string) => {
    const masked = formatCpfCnpj(val);
    handleInputChange('cpfCnpj', masked);

    const digits = cleanDigits(val);
    if (digits.length === 14) {
      await handleLookupCnpj(digits);
    }
  };

  const handleLookupCnpj = async (digitsOverride?: string) => {
    const digits = digitsOverride || cleanDigits(formData.cpfCnpj);
    if (digits.length !== 14) return;

    setIsLoadingCnpj(true);
    try {
      const res = await fetchCompanyByCnpj(digits);
      if (res.success) {
        setFormData(prev => ({
          ...prev,
          name: res.corporateName || prev.name,
          tradeName: res.tradeName || res.corporateName || prev.tradeName,
          phone: res.phone ? formatPhone(res.phone) : prev.phone,
          responsibleEmail: res.email || prev.responsibleEmail,
          cep: res.zipCode ? formatCep(res.zipCode) : prev.cep,
          street: res.street || prev.street,
          number: res.number || prev.number,
          neighborhood: res.neighborhood || prev.neighborhood,
          city: res.city || prev.city,
          state: res.state || prev.state,
        }));
      }
    } catch (e) {
      console.warn('CNPJ auto lookup failed:', e);
    } finally {
      setIsLoadingCnpj(false);
    }
  };

  // Máscara e Busca Dinâmica de CEP
  const handleCepChange = async (val: string) => {
    const masked = formatCep(val);
    handleInputChange('cep', masked);

    const digits = cleanDigits(val);
    if (digits.length === 8) {
      setIsLoadingCep(true);
      try {
        const address = await fetchAddressByCep(digits);
        if (address) {
          setFormData(prev => ({
            ...prev,
            street: address.street || prev.street,
            neighborhood: address.neighborhood || prev.neighborhood,
            city: address.city || prev.city,
            state: address.state || prev.state,
          }));
        }
      } catch (e) {
        console.warn('CEP auto lookup failed:', e);
      } finally {
        setIsLoadingCep(false);
      }
    }
  };

  // Submissão do Cadastro (Sign-up)
  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validações Essenciais
    if (!formData.name.trim()) {
      setFormError('Por favor, informe a Razão Social ou Nome da Empresa.');
      return;
    }
    if (!formData.cpfCnpj.trim()) {
      setFormError('Por favor, informe o CPF ou CNPJ.');
      return;
    }
    if (!formData.responsibleEmail.trim() || !formData.responsibleEmail.includes('@')) {
      setFormError('Por favor, informe um e-mail válido para acesso.');
      return;
    }
    if (!formData.phone.trim()) {
      setFormError('Por favor, informe um telefone ou WhatsApp para contato.');
      return;
    }
    if (!formData.password || formData.password.length < 6) {
      setFormError('A senha de acesso deve ter no mínimo 6 caracteres.');
      return;
    }
    if (!formData.cep.trim() || !formData.city.trim()) {
      setFormError('Por favor, informe o CEP e a Cidade da empresa.');
      return;
    }

    setIsLoading(true);

    try {
      // Determina status: se veio pré-pago aprovado é 'ativa', caso contrário inicia como 'trial'
      const initialStatus: SubscriberStatus = isPrePaid ? 'ativa' : 'trial';

      // 1. Cadastra o assinante gerando o registro no Admin Mestre e salvando o CompanyProfile
      const result = registerNewSubscriber({
        name: formData.name.trim(),
        tradeName: formData.tradeName.trim() || formData.name.trim(),
        responsibleEmail: formData.responsibleEmail.trim().toLowerCase(),
        password: formData.password,
        phone: formData.phone.trim(),
        cpfCnpj: formData.cpfCnpj.trim(),
        stateRegistration: formData.stateRegistration.trim() || 'ISENTO',
        cep: formData.cep.trim(),
        street: formData.street.trim() || 'Endereço Comercial',
        number: formData.number.trim() || 'S/N',
        neighborhood: formData.neighborhood.trim() || 'Centro',
        city: formData.city.trim(),
        state: formData.state.trim().toUpperCase(),
        representativeName: formData.responsibleName.trim() || formData.name.trim(),
        planId: activePlan?.id || 'plano-pro',
        status: initialStatus,
        trialDays: 15,
      });

      // 2. Registra a conta no contexto de autenticação (Supabase ou Local)
      try {
        await signUp(
          formData.responsibleEmail.trim().toLowerCase(),
          formData.password,
          formData.name.trim()
        );
      } catch (authErr) {
        console.warn('Auth sign up notice:', authErr);
      }

      // 3. Notifica o estado do App sobre a nova empresa
      if (onCompanyCreated) {
        onCompanyCreated(result.companyProfile);
      }

      setSuccessMessage('Empresa e conta criadas com sucesso! Inicializando seu painel...');

      // 4. Redirecionamento suave para o ERP
      setTimeout(() => {
        onEnterApp();
      }, 1200);

    } catch (err: any) {
      console.error('Falha no cadastro:', err);
      setFormError(err.message || 'Ocorreu um erro ao realizar o cadastro. Tente novamente.');
      setIsLoading(false);
    }
  };

  // Submissão do Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const emailClean = loginEmail.trim().toLowerCase();

    if (!emailClean || !emailClean.includes('@')) {
      setFormError('Por favor, informe um e-mail válido.');
      return;
    }
    if (!loginPassword) {
      setFormError('Por favor, digite sua senha.');
      return;
    }

    setIsLoading(true);

    try {
      const subscribers = getStoredSubscribers();
      const existingSub = subscribers.find(s => s.responsibleEmail.toLowerCase() === emailClean);
      const company = getStoredCompanyProfile();
      const isCompanyEmail = (company.loginEmail || company.email)?.toLowerCase() === emailClean;

      let authSuccess = false;

      // 1. Tenta autenticar via Supabase
      try {
        await signIn(emailClean, loginPassword);
        authSuccess = true;
      } catch (supabaseErr) {
        console.warn('Tentativa via Supabase concluída com aviso:', supabaseErr);
      }

      // 2. Valida com a base de assinantes e perfil da empresa
      if (!authSuccess) {
        if (existingSub) {
          if (existingSub.password && existingSub.password !== '••••••••' && existingSub.password !== loginPassword) {
            setFormError('Senha incorreta para este usuário.');
            setIsLoading(false);
            return;
          }
          authSuccess = true;
        } else if (isCompanyEmail) {
          authSuccess = true;
        } else if (subscribers.length === 0) {
          authSuccess = true;
        }
      }

      if (!authSuccess) {
        setFormError('E-mail não cadastrado ou credenciais inválidas. Crie sua conta para começar.');
        setIsLoading(false);
        return;
      }

      // 3. Ativa a sessão segura no localStorage
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('silagem_client_session', 'active');
        localStorage.setItem('silagem_active_user_email', emailClean);
        if (existingSub) {
          localStorage.setItem('silagem_active_subscriber_id', existingSub.id);
        }
      }

      setSuccessMessage('Login efetuado com sucesso! Redirecionando para o ERP...');
      setTimeout(() => {
        onEnterApp();
      }, 700);

    } catch (err: any) {
      console.error('Erro de login:', err);
      setFormError(err.message || 'Credenciais inválidas. Verifique seu e-mail e senha.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen text-stone-100 font-['Plus_Jakarta_Sans',sans-serif] selection:bg-emerald-500 selection:text-stone-950 relative flex flex-col justify-between py-6 px-4 sm:px-6 bg-stone-950">
      
      {/* 1. IMAGEM DE FUNDO DINÂMICA (HERDADA DO HERO DA LANDING PAGE) */}
      <div 
        className="fixed inset-0 pointer-events-none select-none z-0 overflow-hidden bg-cover bg-center fixed"
        aria-hidden="true"
      >
        <img
          src={siteConfig.heroBackgroundImage || DEFAULT_SITE_CONFIG.heroBackgroundImage || '/image.png'}
          alt="AgroControl - Gestão de Silagem"
          className="w-full h-full object-cover object-center filter brightness-[0.75] contrast-[1.05]"
          referrerPolicy="no-referrer"
          onError={(e) => {
            if (e.currentTarget.src !== '/hero-silagem.jpg' && e.currentTarget.src !== '/image.png') {
              e.currentTarget.src = '/image.png';
            }
          }}
        />

        {/* 2. EFEITOS DE PROFUNDIDADE (FILTROS E OVERLAY DE VIDRO FUMÊ / GLASSMORPHISM) */}
        <div className="absolute inset-0 bg-black/60 bg-slate-950/70 backdrop-blur-sm backdrop-blur-[4px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-slate-950/65 to-slate-950/90" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-emerald-500/10 rounded-full blur-[110px] pointer-events-none" />
      </div>

      {/* CONTEÚDO PRINCIPAL (Z-10 PARA NAVEGAÇÃO E DIGITAÇÃO COM ALTO CONFORTO) */}
      <div className="relative z-10 flex flex-col justify-between min-h-screen">
        
        {/* BARRA SUPERIOR: VOLTAR E LOGO */}
        <div className="max-w-4xl w-full mx-auto flex items-center justify-between pb-6 border-b border-stone-800/80">
          <button
            type="button"
            onClick={onOpenLandingPage}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-stone-900/80 hover:bg-stone-800 border border-stone-800 text-xs font-bold text-stone-300 hover:text-emerald-400 transition cursor-pointer backdrop-blur-md shadow-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Voltar para o site</span>
          </button>

          <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-stone-900/80 border border-stone-800 backdrop-blur-md shadow-sm">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-black text-sm shadow-md">
              AC
            </div>
            <div className="text-left">
              <span className="text-xs font-black tracking-tight text-white block">
                AgroControl
              </span>
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block -mt-0.5">
                Silagem Fácil Pro
              </span>
            </div>
          </div>
        </div>

        {/* CONTAINER DO FORMULÁRIO */}
        <div className="max-w-4xl w-full mx-auto my-auto py-8">
          
          {/* CABEÇALHO DO MODO */}
          <div className="text-center space-y-2 mb-8">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-950/70 border border-emerald-800/70 text-emerald-400 text-xs font-black backdrop-blur-sm shadow-md">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{mode === 'signup' ? 'Teste Grátis de 15 Dias • Sem Compromisso' : 'Acesso Seguro ao Painel'}</span>
            </div>
            
            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight drop-shadow-sm">
              {mode === 'signup' ? 'Crie sua conta e comece agora' : 'Entre no seu painel de silagem'}
            </h1>
            
            <p className="text-xs sm:text-sm text-stone-300 max-w-lg mx-auto drop-shadow-sm">
              {mode === 'signup' 
                ? 'Preencha os dados da sua empresa agrícola para liberar o acesso instantâneo ao ERP Silagem Fácil.'
                : 'Informe seu e-mail e senha de responsável para acessar a gestão da sua frota e serviços.'
              }
            </p>

            {/* Alternador de Modo (Cadastrar vs Entrar) */}
            <div className="pt-3 flex justify-center">
              <div className="bg-stone-900/90 backdrop-blur-md p-1 rounded-2xl border border-stone-800/90 inline-flex shadow-lg shadow-black/40">
                <button
                  type="button"
                  onClick={() => { setMode('signup'); setFormError(null); }}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                    mode === 'signup' 
                      ? 'bg-emerald-600 text-white shadow-md' 
                      : 'text-stone-400 hover:text-white'
                  }`}
                >
                  Criar Nova Empresa (15d Grátis)
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('login'); setFormError(null); }}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                    mode === 'login' 
                      ? 'bg-emerald-600 text-white shadow-md' 
                      : 'text-stone-400 hover:text-white'
                  }`}
                >
                  Já Tenho Conta (Entrar)
                </button>
              </div>
            </div>
          </div>

          {/* FEEDBACKS (ERRO OU SUCESSO) */}
          {formError && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs font-bold flex items-center gap-3 shadow-xl backdrop-blur-md">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-6 p-4 rounded-2xl bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-xs font-bold flex items-center gap-3 shadow-xl backdrop-blur-md">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* MODO SIGN-UP: FORMULÁRIO COMPLETO */}
          {mode === 'signup' ? (
            <form onSubmit={handleSignUpSubmit} className="space-y-6">
              
              {/* SELETOR DE PLANO & TRIAL INCLUSO */}
              <div className="bg-stone-900/80 backdrop-blur-md border border-emerald-500/30 rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl shadow-black/60">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-950/80 border border-emerald-800/80 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block">
                        Plano Selecionado
                      </span>
                      <h3 className="text-base font-black text-white flex items-center gap-2">
                        <span>{activePlan?.name || 'Frota Pro'}</span>
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-400 text-[10px] font-black uppercase">
                          {isPrePaid ? 'Assinatura Ativa' : '15 Dias Grátis'}
                        </span>
                      </h3>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xl sm:text-2xl font-black text-emerald-400">
                      {formatCurrencyBRL(activePlan?.price || 295.00)}
                    </span>
                    <span className="text-xs text-stone-400 font-bold block">
                      /mês após o período de teste
                    </span>
                  </div>
                </div>

                {/* Opções de troca rápida de plano */}
                <div className="pt-3 border-t border-stone-800/80 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-stone-400 font-bold">Mudar plano:</span>
                  {plans.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPlanId(p.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        selectedPlanId === p.id 
                          ? 'bg-emerald-600 text-white font-black shadow-sm' 
                          : 'bg-stone-800/80 text-stone-300 hover:bg-stone-700'
                      }`}
                    >
                      {p.name} ({formatCurrencyBRL(p.price)}/mês)
                    </button>
                  ))}
                </div>
              </div>

              {/* SEÇÃO 1: DADOS DA EMPRESA AGRÍCOLA */}
              <div className="bg-stone-900/80 backdrop-blur-md border border-emerald-500/30 rounded-3xl p-5 sm:p-7 space-y-5 shadow-2xl shadow-black/60">
                <div className="flex items-center gap-2.5 pb-3 border-b border-stone-800/80">
                  <div className="p-1.5 rounded-lg bg-emerald-950/80 border border-emerald-800/60 text-emerald-400">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <h2 className="text-xs font-black uppercase tracking-wider text-stone-200">
                    1. Dados da Empresa / Produtor Rural
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Nome / Razão Social */}
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="block text-xs font-bold text-stone-300">
                      Razão Social / Nome da Empresa <span className="text-emerald-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      placeholder="Ex: Agropecuária Santa Fé Ltda ou Fazenda Boa Esperança"
                      className="w-full px-3.5 py-2.5 bg-stone-950/80 border border-stone-700/80 rounded-xl text-xs sm:text-sm text-white placeholder:text-stone-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
                    />
                  </div>

                  {/* Nome Fantasia */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-stone-300">
                      Nome Fantasia (Opcional)
                    </label>
                    <input
                      type="text"
                      value={formData.tradeName}
                      onChange={(e) => handleInputChange('tradeName', e.target.value)}
                      placeholder="Ex: Santa Fé Silagem"
                      className="w-full px-3.5 py-2.5 bg-stone-950/80 border border-stone-700/80 rounded-xl text-xs sm:text-sm text-white placeholder:text-stone-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
                    />
                  </div>

                  {/* CPF ou CNPJ com Busca Automática */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-stone-300">
                        CPF ou CNPJ <span className="text-emerald-400">*</span>
                      </label>
                      {cleanDigits(formData.cpfCnpj).length === 14 && (
                        <button
                          type="button"
                          onClick={() => handleLookupCnpj()}
                          disabled={isLoadingCnpj}
                          className="text-[11px] font-bold text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          {isLoadingCnpj ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Search className="w-3 h-3" />
                          )}
                          <span>Buscar na Receita</span>
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      required
                      value={formData.cpfCnpj}
                      onChange={(e) => handleCpfCnpjChange(e.target.value)}
                      placeholder="00.000.000/0000-00 ou CPF"
                      className="w-full px-3.5 py-2.5 bg-stone-950/80 border border-stone-700/80 rounded-xl text-xs sm:text-sm text-white placeholder:text-stone-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
                    />
                  </div>

                  {/* Inscrição Estadual */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-stone-300">
                      Inscrição Estadual (IE)
                    </label>
                    <input
                      type="text"
                      value={formData.stateRegistration}
                      onChange={(e) => handleInputChange('stateRegistration', formatIE(e.target.value))}
                      placeholder="Ex: 124.582.901.112 ou ISENTO"
                      className="w-full px-3.5 py-2.5 bg-stone-950/80 border border-stone-700/80 rounded-xl text-xs sm:text-sm text-white placeholder:text-stone-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
                    />
                  </div>

                  {/* Telefone / WhatsApp */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-stone-300">
                      WhatsApp / Telefone <span className="text-emerald-400">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={formData.phone}
                        onChange={(e) => handleInputChange('phone', formatPhone(e.target.value))}
                        placeholder="(00) 00000-0000"
                        className="w-full px-3.5 py-2.5 bg-stone-950/80 border border-stone-700/80 rounded-xl text-xs sm:text-sm text-white placeholder:text-stone-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition pl-10"
                      />
                      <Phone className="w-4 h-4 text-stone-500 absolute left-3.5 top-3 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>

              {/* SEÇÃO 2: DADOS DE ACESSO & RESPONSÁVEL */}
              <div className="bg-stone-900/80 backdrop-blur-md border border-emerald-500/30 rounded-3xl p-5 sm:p-7 space-y-5 shadow-2xl shadow-black/60">
                <div className="flex items-center gap-2.5 pb-3 border-b border-stone-800/80">
                  <div className="p-1.5 rounded-lg bg-emerald-950/80 border border-emerald-800/60 text-emerald-400">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <h2 className="text-xs font-black uppercase tracking-wider text-stone-200">
                    2. Dados do Responsável & Login de Acesso
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Nome do Responsável */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-stone-300">
                      Nome do Titular / Gestor
                    </label>
                    <input
                      type="text"
                      value={formData.responsibleName}
                      onChange={(e) => handleInputChange('responsibleName', e.target.value)}
                      placeholder="Ex: João da Silva"
                      className="w-full px-3.5 py-2.5 bg-stone-950/80 border border-stone-700/80 rounded-xl text-xs sm:text-sm text-white placeholder:text-stone-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
                    />
                  </div>

                  {/* E-mail de Acesso */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-stone-300">
                      E-mail de Login & Contato <span className="text-emerald-400">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        required
                        value={formData.responsibleEmail}
                        onChange={(e) => handleInputChange('responsibleEmail', e.target.value)}
                        placeholder="seu.email@empresa.com.br"
                        className="w-full px-3.5 py-2.5 bg-stone-950/80 border border-stone-700/80 rounded-xl text-xs sm:text-sm text-white placeholder:text-stone-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition pl-10"
                      />
                      <Mail className="w-4 h-4 text-stone-500 absolute left-3.5 top-3 pointer-events-none" />
                    </div>
                  </div>

                  {/* Senha */}
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="block text-xs font-bold text-stone-300">
                      Senha de Acesso ao ERP <span className="text-emerald-400">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={formData.password}
                        onChange={(e) => handleInputChange('password', e.target.value)}
                        placeholder="Crie uma senha forte (mínimo 6 caracteres)"
                        className="w-full px-3.5 py-2.5 bg-stone-950/80 border border-stone-700/80 rounded-xl text-xs sm:text-sm text-white placeholder:text-stone-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition pl-10 pr-10"
                      />
                      <Lock className="w-4 h-4 text-stone-500 absolute left-3.5 top-3 pointer-events-none" />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-3 text-stone-400 hover:text-white cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* SEÇÃO 3: ENDEREÇO COMPLETO */}
              <div className="bg-stone-900/80 backdrop-blur-md border border-emerald-500/30 rounded-3xl p-5 sm:p-7 space-y-5 shadow-2xl shadow-black/60">
                <div className="flex items-center gap-2.5 pb-3 border-b border-stone-800/80">
                  <div className="p-1.5 rounded-lg bg-emerald-950/80 border border-emerald-800/60 text-emerald-400">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <h2 className="text-xs font-black uppercase tracking-wider text-stone-200">
                    3. Localização & Endereço Completo
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* CEP com Busca Automática */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-stone-300">
                        CEP <span className="text-emerald-400">*</span>
                      </label>
                      {isLoadingCep && (
                        <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-bold">
                          <Loader2 className="w-3 h-3 animate-spin" /> Buscando...
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      required
                      value={formData.cep}
                      onChange={(e) => handleCepChange(e.target.value)}
                      placeholder="00000-000"
                      className="w-full px-3.5 py-2.5 bg-stone-950/80 border border-stone-700/80 rounded-xl text-xs sm:text-sm text-white placeholder:text-stone-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
                    />
                  </div>

                  {/* Logradouro / Rua */}
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="block text-xs font-bold text-stone-300">
                      Logradouro / Rua / Rodovia
                    </label>
                    <input
                      type="text"
                      value={formData.street}
                      onChange={(e) => handleInputChange('street', e.target.value)}
                      placeholder="Ex: Rodovia Municipal KM 14 ou Rua das Acácias"
                      className="w-full px-3.5 py-2.5 bg-stone-950/80 border border-stone-700/80 rounded-xl text-xs sm:text-sm text-white placeholder:text-stone-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
                    />
                  </div>

                  {/* Número */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-stone-300">
                      Número
                    </label>
                    <input
                      type="text"
                      value={formData.number}
                      onChange={(e) => handleInputChange('number', e.target.value)}
                      placeholder="Ex: 1450 ou S/N"
                      className="w-full px-3.5 py-2.5 bg-stone-950/80 border border-stone-700/80 rounded-xl text-xs sm:text-sm text-white placeholder:text-stone-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
                    />
                  </div>

                  {/* Bairro */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-stone-300">
                      Bairro / Zona
                    </label>
                    <input
                      type="text"
                      value={formData.neighborhood}
                      onChange={(e) => handleInputChange('neighborhood', e.target.value)}
                      placeholder="Ex: Zona Rural ou Centro"
                      className="w-full px-3.5 py-2.5 bg-stone-950/80 border border-stone-700/80 rounded-xl text-xs sm:text-sm text-white placeholder:text-stone-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
                    />
                  </div>

                  {/* Cidade */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-stone-300">
                      Cidade <span className="text-emerald-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.city}
                      onChange={(e) => handleInputChange('city', e.target.value)}
                      placeholder="Ex: Rio Verde, Ribeirão Preto..."
                      className="w-full px-3.5 py-2.5 bg-stone-950/80 border border-stone-700/80 rounded-xl text-xs sm:text-sm text-white placeholder:text-stone-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
                    />
                  </div>

                  {/* Estado (UF) */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-stone-300">
                      Estado (UF) <span className="text-emerald-400">*</span>
                    </label>
                    <select
                      value={formData.state}
                      onChange={(e) => handleInputChange('state', e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-stone-950/80 border border-stone-700/80 rounded-xl text-xs sm:text-sm text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
                    >
                      {BRAZILIAN_STATES.map(uf => (
                        <option key={uf} value={uf}>{uf}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* BOTÃO DE SUBMISSÃO DO CADASTRO */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-4 px-6 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-stone-950 font-black text-sm uppercase tracking-wider rounded-2xl transition shadow-xl shadow-emerald-950/60 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Criando sua empresa e ativando teste...</span>
                    </>
                  ) : (
                    <>
                      <span>Cadastrar e Iniciar Teste Grátis de 15 Dias</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="pt-4 flex items-center justify-center gap-4 text-[11px] text-stone-300">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Seus dados estão seguros
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-emerald-400" /> Sem fidelidade contratual
                  </span>
                </div>
              </div>
            </form>
          ) : (
            /* MODO LOGIN: ENTRAR */
            <form onSubmit={handleLoginSubmit} className="max-w-md mx-auto space-y-5 bg-stone-900/80 backdrop-blur-md border border-emerald-500/30 p-6 sm:p-8 rounded-3xl shadow-2xl shadow-black/60">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-stone-300">
                  E-mail de Acesso
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="seu.email@empresa.com.br"
                    className="w-full px-3.5 py-2.5 bg-stone-950/80 border border-stone-700/80 rounded-xl text-xs sm:text-sm text-white placeholder:text-stone-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition pl-10"
                    autoFocus
                  />
                  <Mail className="w-4 h-4 text-stone-500 absolute left-3.5 top-3 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-stone-300">
                  Sua Senha
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Digite sua senha"
                    className="w-full px-3.5 py-2.5 bg-stone-950/80 border border-stone-700/80 rounded-xl text-xs sm:text-sm text-white placeholder:text-stone-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition pl-10 pr-10"
                  />
                  <Lock className="w-4 h-4 text-stone-500 absolute left-3.5 top-3 pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-stone-400 hover:text-white cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition shadow-md shadow-emerald-950 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Entrando...</span>
                    </>
                  ) : (
                    <>
                      <span>Entrar no Painel do Assinante</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              <div className="pt-3 text-center">
                <button
                  type="button"
                  onClick={() => { setMode('signup'); setFormError(null); }}
                  className="text-xs text-stone-300 hover:text-emerald-400 transition cursor-pointer"
                >
                  Não tem uma conta ainda? <span className="text-emerald-400 font-bold underline">Cadastre-se com 15 dias grátis</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* RODAPÉ SIMPLES */}
        <div className="max-w-4xl w-full mx-auto text-center pt-6 border-t border-stone-800/80 text-xs text-stone-400">
          AgroControl • Silagem Fácil Pro © 2026 — Plataforma de Gestão Agrícola
        </div>
      </div>
    </div>
  );
};
