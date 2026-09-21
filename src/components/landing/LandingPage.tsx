import React, { useState, useEffect } from 'react';
import { 
  Check, 
  ArrowRight, 
  Sparkles, 
  ShieldCheck, 
  Layers, 
  Clock, 
  Users, 
  TrendingUp, 
  Wrench, 
  ExternalLink,
  Lock,
  ChevronRight,
  Tractor,
  Smartphone,
  PhoneCall,
  Menu,
  X,
  Play,
  Video
} from 'lucide-react';
import { SiteConfig, PlanDefinition } from '../../types/masterAdmin';
import { 
  getStoredSiteConfig, 
  getStoredLandingSettings, 
  getStoredPlans, 
  DEFAULT_SITE_CONFIG,
  DEFAULT_PLANS,
  AGROCONTROL_SITE_SETTINGS_KEY,
  AGROCONTROL_PLANS_DATA_KEY,
  LANDING_PAGE_SETTINGS_KEY,
  syncMasterAdminFromCloud,
  fetchPublicLandingData
} from '../../lib/masterAdminStorage';
import { 
  fetchCloudSiteConfig, 
  subscribeToCloudTable 
} from '../../lib/supabaseService';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { formatCurrencyBRL } from '../../lib/formatters';

/**
 * Mapeamento resiliente de planos retornados diretamente do Supabase (.select('*'))
 * Mapeia os campos: name, price, features e status (além de description, badge, is_featured, display_order)
 */
function mapSupabasePlan(row: any): PlanDefinition {
  // 1. Mapeamento de Features (Array JSON, string quebra-de-linha ou texto)
  let featuresText = '';
  if (Array.isArray(row.features)) {
    featuresText = row.features.join('\n');
  } else if (typeof row.features === 'string') {
    try {
      const parsed = JSON.parse(row.features);
      if (Array.isArray(parsed)) {
        featuresText = parsed.join('\n');
      } else {
        featuresText = row.features;
      }
    } catch {
      featuresText = row.features;
    }
  } else if (row.features_text) {
    featuresText = String(row.features_text);
  }

  // 2. Mapeamento de Status / Ativo (campo 'status' = 'active'/'ativo' ou 'is_active' boolean)
  let isActive = true;
  if (row.status !== undefined && row.status !== null) {
    const s = String(row.status).toLowerCase().trim();
    isActive = s === 'active' || s === 'ativo' || s === 'true' || s === '1';
  } else if (row.is_active !== undefined && row.is_active !== null) {
    isActive = Boolean(row.is_active);
  }

  // 3. Mapeamento de Preço (price, valor, preco)
  const price = Number(
    row.price !== undefined && row.price !== null
      ? row.price
      : (row.valor !== undefined && row.valor !== null ? row.valor : (row.preco || 0))
  ) || 0;

  // 4. Mapeamento de Nome (name, nome, title)
  const name = String(row.name || row.nome || row.title || 'Plano');

  return {
    id: String(row.id || name.toLowerCase().replace(/\s+/g, '-')),
    name,
    description: String(row.description || row.descricao || ''),
    price,
    billingCycle: (String(row.billing_cycle || row.billingCycle || 'mensal').toLowerCase() === 'anual' ? 'anual' : 'mensal') as 'mensal' | 'anual',
    badge: row.badge ? String(row.badge) : undefined,
    isFeatured: Boolean(row.is_featured ?? row.isFeatured ?? false),
    isActive,
    displayOrder: Number(row.display_order ?? row.displayOrder ?? 1),
    limits: typeof row.limits === 'object' && row.limits ? row.limits : {
      maxUsers: 5,
      maxMachineries: 10,
      maxClients: 100,
      storageLimitGb: 5,
    },
    featuresText: featuresText || 'Acesso completo ao sistema\nSuporte técnico dedicado\nAtualizações inclusas',
    checkoutUrl: String(row.checkout_url || row.checkoutUrl || ''),
  };
}

/**
 * Converte URLs de vídeo (YouTube, Vimeo, MP4 direto) em formato compatível para modal lightbox
 */
function parseEmbedVideoUrl(url?: string): { type: 'youtube' | 'vimeo' | 'html5' | 'iframe' | 'empty'; url: string } {
  if (!url || !url.trim()) {
    return { type: 'empty', url: '' };
  }
  const clean = url.trim();

  // YouTube: watch?v=..., youtu.be/..., shorts/..., embed/...
  const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/i;
  const ytMatch = clean.match(ytRegex);
  if (ytMatch && ytMatch[1]) {
    return {
      type: 'youtube',
      url: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?autoplay=1&rel=0&modestbranding=1`,
    };
  }

  // Vimeo: vimeo.com/123456789
  const vimeoRegex = /vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|video\/|)(\d+)/i;
  const vimeoMatch = clean.match(vimeoRegex);
  if (vimeoMatch && vimeoMatch[3]) {
    return {
      type: 'vimeo',
      url: `https://player.vimeo.com/video/${vimeoMatch[3]}?autoplay=1`,
    };
  }

  // Vídeo direto (.mp4, .webm, .ogg, .mov)
  if (/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(clean)) {
    return {
      type: 'html5',
      url: clean,
    };
  }

  // Link genérico com protocolo
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    return {
      type: 'iframe',
      url: clean,
    };
  }

  return { type: 'empty', url: '' };
}

interface LandingPageProps {
  onEnterApp: () => void;
  onOpenMasterAdmin: () => void;
  onNavigateToAuth?: (planId?: string, mode?: 'signup' | 'login', trialParam?: boolean) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onEnterApp,
  onOpenMasterAdmin,
  onNavigateToAuth,
}) => {
  // Estado para controle do modal pop-up (lightbox) de vídeo demonstrativo
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);

  // Leitura dinâmica inicial buscando prioritariamente de agrocontrol_site_settings e agrocontrol_plans_data
  const [siteConfig, setSiteConfig] = useState<SiteConfig>(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = 
          localStorage.getItem('agrocontrol_site_settings') || 
          localStorage.getItem(AGROCONTROL_SITE_SETTINGS_KEY) || 
          localStorage.getItem(LANDING_PAGE_SETTINGS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          return { ...DEFAULT_SITE_CONFIG, ...parsed };
        }
      }
    } catch (e) {
      console.error('Erro ao ler agrocontrol_site_settings na inicialização:', e);
    }
    return getStoredSiteConfig();
  });

  const [plans, setPlans] = useState<PlanDefinition[]>(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = 
          localStorage.getItem('agrocontrol_plans_data') || 
          localStorage.getItem(AGROCONTROL_PLANS_DATA_KEY) || 
          localStorage.getItem('silagem_master_plans_v1');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      }
    } catch (e) {
      console.error('Erro ao ler agrocontrol_plans_data na inicialização:', e);
    }
    return getStoredPlans();
  });

  // Leitura Obrigatória na Landing Page Pública dentro de useEffect e sincronização em tempo real
  useEffect(() => {
    // 1. Busca obrigatória dos dados salvos nas chaves agrocontrol_site_settings e agrocontrol_plans_data
    const loadAllFromStorage = () => {
      try {
        if (typeof localStorage !== 'undefined') {
          // A) Configurações do site (Hero, títulos, textos, recursos, imagem de fundo)
          const rawSite = 
            localStorage.getItem('agrocontrol_site_settings') || 
            localStorage.getItem(AGROCONTROL_SITE_SETTINGS_KEY) || 
            localStorage.getItem(LANDING_PAGE_SETTINGS_KEY);
          if (rawSite) {
            const parsedSite = JSON.parse(rawSite);
            setSiteConfig({ ...DEFAULT_SITE_CONFIG, ...parsedSite });
          } else {
            setSiteConfig(getStoredSiteConfig());
          }

          // B) Lista de planos, preços e recursos
          const rawPlans = 
            localStorage.getItem('agrocontrol_plans_data') || 
            localStorage.getItem(AGROCONTROL_PLANS_DATA_KEY) || 
            localStorage.getItem('silagem_master_plans_v1');
          if (rawPlans) {
            const parsedPlans = JSON.parse(rawPlans);
            if (Array.isArray(parsedPlans) && parsedPlans.length > 0) {
              setPlans(parsedPlans);
            } else {
              setPlans(getStoredPlans());
            }
          } else {
            setPlans(getStoredPlans());
          }
        }
      } catch (err) {
        console.error('Erro ao recarregar dados do localStorage na Landing Page:', err);
        setSiteConfig(getStoredSiteConfig());
        setPlans(getStoredPlans());
      }
    };

    // Executa obrigatoriamente na montagem
    loadAllFromStorage();

    let isMounted = true;

    // 1. Busca Direta na tabela 'plans' do Supabase (.select('*')) com credenciais oficiais
    const fetchDirectPlansFromSupabase = async () => {
      try {
        let { data, error } = await supabase
          .from('plans')
          .select('*')
          .order('display_order', { ascending: true });

        // Se falhar por falta da coluna display_order, tenta select simples
        if (error) {
          const fallback = await supabase.from('plans').select('*');
          if (!fallback.error && Array.isArray(fallback.data)) {
            data = fallback.data;
            error = null;
          }
        }

        if (error) {
          console.warn('Aviso na busca direta de planos do Supabase:', error.message);
          return;
        }

        if (Array.isArray(data) && data.length > 0 && isMounted) {
          const mapped = data.map(mapSupabasePlan);
          setPlans(mapped);
          try {
            if (typeof localStorage !== 'undefined') {
              const serialized = JSON.stringify(mapped);
              localStorage.setItem('agrocontrol_plans_data', serialized);
              localStorage.setItem(AGROCONTROL_PLANS_DATA_KEY, serialized);
            }
          } catch (e) {
            console.error('Erro ao armazenar planos em cache local:', e);
          }
        }
      } catch (err) {
        console.warn('Erro ao consultar tabela plans diretamente:', err);
      }
    };

    // Executa a busca direta imediata na tabela 'plans' do Supabase
    fetchDirectPlansFromSupabase();

    // Sincronização direta pública complementar para configurações gerais (site_settings)
    fetchPublicLandingData().then((cloudData) => {
      if (!isMounted) return;
      if (cloudData.siteConfig) setSiteConfig(cloudData.siteConfig);
      if (cloudData.plans && cloudData.plans.length > 0) {
        setPlans((prev) => (prev && prev.length > 0 ? prev : cloudData.plans));
      }
    });

    // Assinatura Realtime Direta no Supabase na tabela 'plans'
    const plansChannel = supabase
      .channel(`public:landing_plans_feed_${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'plans' },
        () => {
          fetchDirectPlansFromSupabase();
        }
      )
      .subscribe();

    const unsubSite = subscribeToCloudTable('site_settings', () => {
      fetchCloudSiteConfig().then((freshSite) => {
        if (freshSite && isMounted) {
          setSiteConfig(freshSite);
        }
      });
    });

    // 2. CustomEvents da mesma janela (Master Admin alterado na mesma aba/janela)
    const handleSiteUpdated = (e: any) => {
      if (e?.detail) {
        setSiteConfig((prev) => ({ ...prev, ...e.detail }));
      } else {
        loadAllFromStorage();
      }
    };

    const handlePlansUpdated = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setPlans(e.detail);
      } else {
        loadAllFromStorage();
      }
    };

    const handleSync = (e?: any) => {
      if (e?.detail) {
        if (Array.isArray(e.detail)) {
          setPlans(e.detail);
        } else if (typeof e.detail === 'object') {
          setSiteConfig((prev) => ({ ...prev, ...e.detail }));
        }
      } else {
        loadAllFromStorage();
      }
    };

    // 3. Event listener para o evento nativo 'storage' da window (para sincronia instantânea entre abas ou chamadas dispatchEvent(new Event('storage')))
    const handleStorageChange = (e: StorageEvent | Event) => {
      const storageEvt = e as StorageEvent;
      // Se for disparo manual sem key definida, ou se for uma das chaves monitoradas
      if (!storageEvt.key) {
        loadAllFromStorage();
        return;
      }

      if (
        storageEvt.key === 'agrocontrol_site_settings' || 
        storageEvt.key === AGROCONTROL_SITE_SETTINGS_KEY ||
        storageEvt.key === LANDING_PAGE_SETTINGS_KEY || 
        storageEvt.key === 'silagem_master_site_config_v1'
      ) {
        if (storageEvt.newValue) {
          try {
            const parsed = JSON.parse(storageEvt.newValue);
            setSiteConfig((prev) => ({ ...prev, ...parsed }));
          } catch (err) {
            loadAllFromStorage();
          }
        } else {
          loadAllFromStorage();
        }
      } else if (
        storageEvt.key === 'agrocontrol_plans_data' || 
        storageEvt.key === AGROCONTROL_PLANS_DATA_KEY ||
        storageEvt.key === 'silagem_master_plans_v1'
      ) {
        if (storageEvt.newValue) {
          try {
            const parsed = JSON.parse(storageEvt.newValue);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setPlans(parsed);
              return;
            }
          } catch (err) {
            console.error('Erro ao processar storage event de planos:', err);
          }
        }
        loadAllFromStorage();
      }
    };

    window.addEventListener('agrocontrol_site_settings_updated', handleSiteUpdated);
    window.addEventListener('landing_page_settings_updated', handleSiteUpdated);
    window.addEventListener('agrocontrol_plans_updated', handlePlansUpdated);
    window.addEventListener('master_admin_data_changed', handleSync);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      isMounted = false;
      try {
        supabase.removeChannel(plansChannel);
      } catch {}
      unsubSite();
      window.removeEventListener('agrocontrol_site_settings_updated', handleSiteUpdated);
      window.removeEventListener('landing_page_settings_updated', handleSiteUpdated);
      window.removeEventListener('agrocontrol_plans_updated', handlePlansUpdated);
      window.removeEventListener('master_admin_data_changed', handleSync);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Controle de tecla Escape e bloqueio de scroll para o modal de vídeo lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isVideoModalOpen) {
        setIsVideoModalOpen(false);
      }
    };
    if (isVideoModalOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isVideoModalOpen]);

  // Objeto de Configuração Dinâmica com Fallbacks Protegidos (valores originais do agro)
  const [selectedFeatureTabId, setSelectedFeatureTabId] = useState<string>('');

  const allowFreeTrial = siteConfig?.allow_free_trial !== undefined 
    ? Boolean(siteConfig.allow_free_trial) 
    : (DEFAULT_SITE_CONFIG.allow_free_trial ?? true);

  const heroOverlayOpacity = siteConfig?.hero_overlay_opacity !== undefined && siteConfig?.hero_overlay_opacity !== null
    ? Math.max(0, Math.min(100, Number(siteConfig.hero_overlay_opacity)))
    : (DEFAULT_SITE_CONFIG.hero_overlay_opacity ?? 75);

  // Lógica dinâmica rigorosa para o texto do botão primário do Hero
  const rawHeroPrimary = (siteConfig?.heroPrimaryBtnText || '').trim();
  let computedHeroPrimaryBtnText = rawHeroPrimary;
  if (!allowFreeTrial) {
    if (!computedHeroPrimaryBtnText || /gr[áa]tis|teste/i.test(computedHeroPrimaryBtnText)) {
      computedHeroPrimaryBtnText = 'Começar Agora';
    }
  } else if (!computedHeroPrimaryBtnText) {
    computedHeroPrimaryBtnText = 'Começar Teste Grátis de 7 Dias';
  }

  // Lógica dinâmica para o subtítulo da tabela de preços
  let computedPricingSubtitle = siteConfig?.pricing_subtitle || DEFAULT_SITE_CONFIG.pricing_subtitle || '';
  if (!allowFreeTrial) {
    if (!computedPricingSubtitle || /gr[áa]tis|teste/i.test(computedPricingSubtitle)) {
      computedPricingSubtitle = 'Contratação imediata sem burocracia. Altere ou cancele seu plano a qualquer momento.';
    }
  } else if (!computedPricingSubtitle) {
    computedPricingSubtitle = 'Comece com 7 dias grátis de teste. Cancele ou altere de plano a qualquer momento sem burocracia.';
  }

  const currentSettings = {
    allowFreeTrial,
    heroBadgeText: siteConfig?.hero_badge_text || DEFAULT_SITE_CONFIG.hero_badge_text || 'A plataforma nº 1 em prestação de serviços de silagem e colheita',
    heroTitle: siteConfig?.heroTitle || DEFAULT_SITE_CONFIG.heroTitle,
    heroSubtitle: siteConfig?.heroSubtitle || DEFAULT_SITE_CONFIG.heroSubtitle,
    heroPrimaryBtnText: computedHeroPrimaryBtnText,
    heroSecondaryBtnText: siteConfig?.heroSecondaryBtnText || DEFAULT_SITE_CONFIG.heroSecondaryBtnText,
    heroBackgroundImage: siteConfig?.heroBackgroundImage || DEFAULT_SITE_CONFIG.heroBackgroundImage || '/image.png',
    heroVideoUrl: (siteConfig?.hero_video_url || DEFAULT_SITE_CONFIG.hero_video_url || '').trim(),
    heroOverlayOpacity,
    featuresSectionTitle: siteConfig?.featuresSectionTitle || DEFAULT_SITE_CONFIG.featuresSectionTitle,
    featuresSectionSubtitle: siteConfig?.featuresSectionSubtitle || DEFAULT_SITE_CONFIG.featuresSectionSubtitle,
    featuresHighlightImage: siteConfig?.featuresHighlightImage || '',
    featuresTabs: (Array.isArray(siteConfig?.features_tabs) && siteConfig.features_tabs.length > 0)
      ? siteConfig.features_tabs
      : (DEFAULT_SITE_CONFIG.features_tabs || []),
    feature1Title: siteConfig?.feature1Title || DEFAULT_SITE_CONFIG.feature1Title,
    feature1Desc: siteConfig?.feature1Desc || DEFAULT_SITE_CONFIG.feature1Desc,
    feature2Title: siteConfig?.feature2Title || DEFAULT_SITE_CONFIG.feature2Title,
    feature2Desc: siteConfig?.feature2Desc || DEFAULT_SITE_CONFIG.feature2Desc,
    feature3Title: siteConfig?.feature3Title || DEFAULT_SITE_CONFIG.feature3Title,
    feature3Desc: siteConfig?.feature3Desc || DEFAULT_SITE_CONFIG.feature3Desc,
    feature4Title: siteConfig?.feature4Title || DEFAULT_SITE_CONFIG.feature4Title,
    feature4Desc: siteConfig?.feature4Desc || DEFAULT_SITE_CONFIG.feature4Desc,
    pricingTag: siteConfig?.pricing_tag || DEFAULT_SITE_CONFIG.pricing_tag || 'Investimento Transparente',
    pricingTitle: siteConfig?.pricing_title || DEFAULT_SITE_CONFIG.pricing_title || 'Escolha o plano ideal para a sua operação',
    pricingSubtitle: computedPricingSubtitle,
    footerCopyright: siteConfig?.footer_copyright || DEFAULT_SITE_CONFIG.footer_copyright || 'AgroControl • Silagem Fácil Pro © 2026',
    footerSignupUrl: (siteConfig?.footer_signup_url || '').trim(),
    footerLoginUrl: (siteConfig?.footer_login_url || '').trim(),
  };

  // Filtrar apenas planos ativos (status ativo) e ordenar por displayOrder
  const candidatePlans = plans && plans.length > 0 ? plans : DEFAULT_PLANS;
  const filteredActivePlans = candidatePlans.filter(p => p.isActive);
  const activePlans = (filteredActivePlans.length > 0 ? filteredActivePlans : candidatePlans)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  // Auth Guard: Acessar o ERP com proteção e barreira de segurança
  const handleAccessErp = () => {
    const hasActiveSession = typeof localStorage !== 'undefined' && localStorage.getItem('silagem_client_session') === 'active';
    if (hasActiveSession) {
      onEnterApp();
    } else {
      if (onNavigateToAuth) {
        onNavigateToAuth(undefined, 'login');
      } else {
        try {
          window.history.pushState({}, '', '/auth?mode=login');
          window.dispatchEvent(new PopStateEvent('popstate'));
        } catch (e) {
          console.error(e);
        }
      }
    }
  };

  const handleStartPlan = (plan: PlanDefinition) => {
    const planId = plan.id;
    if (onNavigateToAuth) {
      onNavigateToAuth(planId, 'signup', allowFreeTrial);
    } else {
      try {
        const trialQuery = !allowFreeTrial ? '&trial=false' : '';
        window.history.pushState({}, '', `/auth?mode=signup&plan=${encodeURIComponent(planId)}${trialQuery}`);
        window.dispatchEvent(new PopStateEvent('popstate'));
      } catch (e) {
        console.error(e);
        handleAccessErp();
      }
    }
  };

  const handleCheckoutClick = (plan: PlanDefinition) => {
    handleStartPlan(plan);
  };

  const featureIcons = [
    <Tractor className="w-6 h-6 text-emerald-500" key="1" />,
    <Smartphone className="w-6 h-6 text-teal-500" key="2" />,
    <TrendingUp className="w-6 h-6 text-emerald-600" key="3" />,
    <Wrench className="w-6 h-6 text-amber-500" key="4" />,
  ];

  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 font-['Plus_Jakarta_Sans',sans-serif] selection:bg-emerald-500 selection:text-stone-950">
      
      {/* NAVBAR PÚBLICA */}
      <nav className="border-b border-stone-800/80 bg-stone-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-black text-base shadow-md shadow-emerald-950">
              AC
            </div>
            <div>
              <span className="text-base font-black tracking-tight text-white block">
                AgroControl
              </span>
              <span className="text-[10px] text-emerald-400 font-bold tracking-wider uppercase block -mt-1">
                Silagem Fácil Pro
              </span>
            </div>
          </div>

          {/* Links Desktop */}
          <div className="hidden md:flex items-center gap-6 text-xs font-bold text-stone-300">
            <a href="#recursos" className="hover:text-emerald-400 transition">
              Recursos
            </a>
            <a href="#planos" className="hover:text-emerald-400 transition">
              Planos & Preços
            </a>
            <a href="#depoimentos" className="hover:text-emerald-400 transition">
              Diferenciais
            </a>
          </div>

          {/* Ações Desktop / Tablet */}
          <div className="hidden sm:flex items-center gap-2.5">
            {onNavigateToAuth && (
              <button
                type="button"
                id="btn-nav-signup"
                onClick={() => onNavigateToAuth(undefined, 'signup', allowFreeTrial)}
                className="px-3.5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-stone-950 rounded-xl text-xs font-black transition cursor-pointer shadow-sm shadow-emerald-950 flex items-center gap-1.5 min-h-[44px]"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{currentSettings.allowFreeTrial ? 'Criar Conta (15d Grátis)' : 'Começar Agora'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleAccessErp}
              className="px-4 py-2 bg-stone-900 border border-stone-700 hover:bg-stone-800 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-sm shadow-emerald-950 flex items-center gap-1.5 min-h-[44px]"
              title="Acessar o ERP - Requer Login e Senha"
            >
              <span>Acessar o ERP</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Botão Hambúrguer Mobile/Tablet */}
          <div className="flex md:hidden items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
              className="p-2.5 rounded-xl bg-stone-900 border border-stone-800 text-stone-300 hover:text-white hover:bg-stone-800 transition cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Abrir Menu de Navegação"
            >
              {isMobileNavOpen ? <X className="w-5 h-5 text-white" /> : <Menu className="w-5 h-5 text-stone-300" />}
            </button>
          </div>
        </div>

        {/* Menu Retrátil Mobile */}
        {isMobileNavOpen && (
          <div className="md:hidden border-t border-stone-800 bg-stone-950/95 backdrop-blur-xl px-4 py-4 space-y-3 animate-in slide-in-from-top duration-200 shadow-2xl">
            <div className="flex flex-col space-y-1">
              <a
                href="#recursos"
                onClick={() => setIsMobileNavOpen(false)}
                className="px-3 py-2.5 rounded-xl text-sm font-bold text-stone-200 hover:bg-stone-900 hover:text-emerald-400 transition"
              >
                Recursos
              </a>
              <a
                href="#planos"
                onClick={() => setIsMobileNavOpen(false)}
                className="px-3 py-2.5 rounded-xl text-sm font-bold text-stone-200 hover:bg-stone-900 hover:text-emerald-400 transition"
              >
                Planos & Preços
              </a>
              <a
                href="#depoimentos"
                onClick={() => setIsMobileNavOpen(false)}
                className="px-3 py-2.5 rounded-xl text-sm font-bold text-stone-200 hover:bg-stone-900 hover:text-emerald-400 transition"
              >
                Diferenciais
              </a>
            </div>

            <div className="pt-2 border-t border-stone-800/80 flex flex-col gap-2">
              {onNavigateToAuth && (
                <button
                  type="button"
                  id="btn-mobile-nav-signup"
                  onClick={() => {
                    setIsMobileNavOpen(false);
                    onNavigateToAuth(undefined, 'signup', allowFreeTrial);
                  }}
                  className="w-full py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-stone-950 rounded-xl text-xs font-black transition cursor-pointer shadow-sm flex items-center justify-center gap-2 min-h-[44px]"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{currentSettings.allowFreeTrial ? 'Criar Conta (15d Grátis)' : 'Começar Agora'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsMobileNavOpen(false);
                  handleAccessErp();
                }}
                className="w-full py-3 px-4 bg-stone-900 border border-stone-700 hover:bg-stone-800 text-white rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-2 min-h-[44px]"
              >
                <span>Acessar o ERP</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* BLOCO HERO (COM IMAGEM DE GESTÃO DE SILAGEM TECNOLÓGICA E OVERLAY) */}
      <section className="relative min-h-[580px] md:min-h-[700px] lg:min-h-[760px] pt-16 pb-24 md:pt-24 md:pb-36 px-4 sm:px-6 overflow-hidden flex items-center justify-center">
        {/* Imagem de Fundo: Gestão Tecnológica no Campo (com corte inferior para mascarar texto IA artificial) */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
          <img
            src={currentSettings.heroBackgroundImage || '/image.png'}
            alt="AgroControl - Gestão Tecnológica de Silagem e Frotas"
            className="w-full h-[128%] sm:h-[134%] md:h-[140%] object-cover object-top -translate-y-[5%] sm:-translate-y-[7%] md:-translate-y-[9%] filter brightness-[0.85] contrast-[1.05]"
            referrerPolicy="no-referrer"
            onError={(e) => {
              if (e.currentTarget.src !== '/hero-silagem.jpg' && e.currentTarget.src !== '/image.png') {
                e.currentTarget.src = '/image.png';
              }
            }}
          />

          {/* 1. Camada Dinâmica de Escurecimento (Overlay) controlada diretamente pelo Painel Mestre (0% a 100%) */}
          <div 
            className="absolute inset-0 bg-stone-950 transition-opacity duration-300"
            style={{ opacity: (currentSettings.heroOverlayOpacity ?? 75) / 100 }}
          />

          {/* 2. Suave atenuação com gradiente para máxima legibilidade dos textos e botões */}
          <div 
            className="absolute inset-0 bg-gradient-to-b from-stone-950/75 via-transparent to-stone-950 transition-opacity duration-300 pointer-events-none"
            style={{ opacity: Math.max(0.15, (currentSettings.heroOverlayOpacity ?? 75) / 100) }}
          />

          {/* 3. Gradiente inferior espesso: oculta e corta 100% de qualquer texto IA artificial ou rodapés da imagem */}
          <div className="absolute inset-x-0 bottom-0 h-44 sm:h-52 md:h-64 bg-gradient-to-t from-stone-950 via-stone-950/95 to-transparent pointer-events-none" />

          {/* 4. Transição sutil com a barra de navegação no topo */}
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-stone-950/90 via-stone-950/40 to-transparent pointer-events-none" />

          {/* 5. Efeito glow temático esmeralda no centro */}
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-emerald-500/10 rounded-full blur-[90px] pointer-events-none" />
        </div>
        
        {/* Conteúdo Real em Destaque com Alto Contraste */}
        <div className="max-w-4xl mx-auto text-center space-y-6 relative z-10 pt-4 sm:pt-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-stone-900/90 border border-emerald-500/40 text-emerald-300 text-xs font-bold shadow-lg shadow-black/40 backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{currentSettings.heroBadgeText}</span>
          </div>

          {/* TÍTULO PRINCIPAL (H1) */}
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight leading-[1.14] drop-shadow-[0_4px_16px_rgba(0,0,0,0.85)]">
            {currentSettings.heroTitle}
          </h1>

          {/* SUBTÍTULO */}
          <p className="text-sm sm:text-lg md:text-xl text-stone-200 max-w-2xl mx-auto leading-relaxed font-normal drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]">
            {currentSettings.heroSubtitle}
          </p>

          {/* BOTÕES DO HERO */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-4">
            <button
              type="button"
              id="btn-hero-primary"
              onClick={() => {
                const target = plans.find(p => p.isFeatured && p.isActive) ||
                               plans.find(p => p.isActive && p.displayOrder === 2) ||
                               plans.find(p => p.isActive) ||
                               plans[0];
                const targetId = target?.id;
                if (onNavigateToAuth) {
                  onNavigateToAuth(targetId, 'signup', allowFreeTrial);
                } else {
                  try {
                    const trialQuery = !allowFreeTrial ? '&trial=false' : '';
                    window.history.pushState({}, '', targetId ? `/auth?mode=signup&plan=${encodeURIComponent(targetId)}${trialQuery}` : `/auth?mode=signup${trialQuery}`);
                    window.dispatchEvent(new PopStateEvent('popstate'));
                  } catch (e) {
                    console.error(e);
                    handleAccessErp();
                  }
                }
              }}
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-stone-950 font-black text-sm rounded-xl transition shadow-xl shadow-emerald-950/60 flex items-center justify-center gap-2 cursor-pointer transform hover:-translate-y-0.5"
            >
              <span>{currentSettings.heroPrimaryBtnText}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* BOTÃO CONHECER FUNCIONALIDADES (ABRE O LIGHTBOX DO VÍDEO DEMONSTRATIVO) */}
            <button
              type="button"
              id="btn-hero-conhecer-funcionalidades"
              onClick={() => setIsVideoModalOpen(true)}
              className="w-full sm:w-auto px-8 py-4 bg-stone-900/90 hover:bg-stone-800 text-stone-100 border border-stone-700/80 hover:border-emerald-500/50 font-bold text-sm rounded-xl transition backdrop-blur-md shadow-lg shadow-black/30 flex items-center justify-center gap-2.5 cursor-pointer group"
            >
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-stone-950 transition">
                <Play className="w-3 h-3 fill-current ml-0.5" />
              </div>
              <span>{currentSettings.heroSecondaryBtnText || 'Conhecer Funcionalidades'}</span>
            </button>
          </div>

          {/* Badges de Confiança */}
          <div className="pt-6 sm:pt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs font-semibold text-stone-300">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-900/70 border border-stone-800/80 backdrop-blur-sm shadow-sm">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" /> Sem fidelidade contratual
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-900/70 border border-stone-800/80 backdrop-blur-sm shadow-sm">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" /> Ativação imediata
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-900/70 border border-stone-800/80 backdrop-blur-sm shadow-sm">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" /> Suporte humanizado no WhatsApp
            </span>
          </div>
        </div>
      </section>

      {/* BLOCO RECURSOS / BENEFÍCIOS (4 CARTÕES CONECTADOS) */}
      <section id="recursos" className="py-16 md:py-24 bg-stone-900/50 border-y border-stone-800/80 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto space-y-12">
          
          {/* Cabeçalho de Recursos Dinâmico */}
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              {currentSettings.featuresSectionTitle}
            </h2>
            <p className="text-xs sm:text-sm text-stone-400">
              {currentSettings.featuresSectionSubtitle}
            </p>
          </div>

          {/* Imagem de Destaque dos Recursos (Seção Inferior) */}
          {currentSettings.featuresHighlightImage && currentSettings.featuresHighlightImage.trim() !== '' && (
            <div className="max-w-5xl mx-auto rounded-2xl sm:rounded-3xl overflow-hidden border border-stone-800 shadow-2xl bg-stone-900/60 p-2 sm:p-3 relative group">
              <div className="rounded-xl sm:rounded-2xl overflow-hidden relative">
                <img
                  src={currentSettings.featuresHighlightImage}
                  alt="Destaque de Recursos e Funcionalidades AgroControl"
                  className="w-full max-h-[520px] object-cover object-top transition duration-500 group-hover:scale-[1.01]"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-stone-950/60 via-transparent to-transparent pointer-events-none" />
              </div>
            </div>
          )}

          {/* Os 4 Cartões de Benefícios */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            
            {/* Card #1 */}
            <div className="bg-stone-900 border border-stone-800 p-6 rounded-2xl space-y-3 hover:border-emerald-500/50 transition">
              <div className="w-12 h-12 rounded-xl bg-emerald-950/60 border border-emerald-800/60 flex items-center justify-center">
                {featureIcons[0]}
              </div>
              <h3 className="text-base font-black text-white">
                {currentSettings.feature1Title}
              </h3>
              <p className="text-xs text-stone-400 leading-relaxed">
                {currentSettings.feature1Desc}
              </p>
            </div>

            {/* Card #2 */}
            <div className="bg-stone-900 border border-stone-800 p-6 rounded-2xl space-y-3 hover:border-teal-500/50 transition">
              <div className="w-12 h-12 rounded-xl bg-teal-950/60 border border-teal-800/60 flex items-center justify-center">
                {featureIcons[1]}
              </div>
              <h3 className="text-base font-black text-white">
                {currentSettings.feature2Title}
              </h3>
              <p className="text-xs text-stone-400 leading-relaxed">
                {currentSettings.feature2Desc}
              </p>
            </div>

            {/* Card #3 */}
            <div className="bg-stone-900 border border-stone-800 p-6 rounded-2xl space-y-3 hover:border-emerald-500/50 transition">
              <div className="w-12 h-12 rounded-xl bg-emerald-950/60 border border-emerald-800/60 flex items-center justify-center">
                {featureIcons[2]}
              </div>
              <h3 className="text-base font-black text-white">
                {currentSettings.feature3Title}
              </h3>
              <p className="text-xs text-stone-400 leading-relaxed">
                {currentSettings.feature3Desc}
              </p>
            </div>

            {/* Card #4 */}
            <div className="bg-stone-900 border border-stone-800 p-6 rounded-2xl space-y-3 hover:border-amber-500/50 transition">
              <div className="w-12 h-12 rounded-xl bg-amber-950/60 border border-amber-800/60 flex items-center justify-center">
                {featureIcons[3]}
              </div>
              <h3 className="text-base font-black text-white">
                {currentSettings.feature4Title}
              </h3>
              <p className="text-xs text-stone-400 leading-relaxed">
                {currentSettings.feature4Desc}
              </p>
            </div>
          </div>

          {/* Abas Interativas do Rodapé da Seção de Recursos (Configuráveis no Painel Mestre) */}
          {currentSettings.featuresTabs && currentSettings.featuresTabs.length > 0 && (() => {
            const activeTab = currentSettings.featuresTabs.find(t => t.id === selectedFeatureTabId) || currentSettings.featuresTabs[0];
            return (
              <div className="pt-8 border-t border-stone-800/80 space-y-6">
                <div className="text-center max-w-xl mx-auto">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                    Navegação Interativa de Recursos
                  </span>
                  <h3 className="text-lg sm:text-xl font-bold text-white mt-1">
                    Conheça a tecnologia em detalhes
                  </h3>
                </div>

                {/* Seletor de Abas */}
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {currentSettings.featuresTabs.map((tab) => {
                    const isSelected = activeTab.id === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setSelectedFeatureTabId(tab.id)}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer border ${
                          isSelected
                            ? 'bg-emerald-500 text-stone-950 border-emerald-400 shadow-md shadow-emerald-950/50 font-black'
                            : 'bg-stone-900 text-stone-300 border-stone-800 hover:border-stone-700 hover:text-white'
                        }`}
                      >
                        <Layers className={`w-3.5 h-3.5 ${isSelected ? 'text-stone-950' : 'text-emerald-400'}`} />
                        <span>{tab.title}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Conteúdo da Aba Ativa */}
                {activeTab && (
                  <div className="bg-stone-900/90 border border-stone-800 rounded-2xl p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center shadow-xl animate-in fade-in duration-200">
                    <div className="lg:col-span-7 space-y-4">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 text-xs font-bold">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{activeTab.title}</span>
                      </div>
                      <h4 className="text-xl sm:text-2xl font-black text-white">
                        {activeTab.title}
                      </h4>
                      <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">
                        {activeTab.description}
                      </p>
                      {activeTab.bullets && activeTab.bullets.length > 0 && (
                        <ul className="space-y-2 pt-2">
                          {activeTab.bullets.map((b, bIdx) => (
                            <li key={bIdx} className="flex items-start gap-2.5 text-xs text-stone-200 leading-snug">
                              <div className="w-4 h-4 rounded-full bg-emerald-950 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-800">
                                <Check className="w-2.5 h-2.5 text-emerald-400" />
                              </div>
                              <span>{b}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="lg:col-span-5 rounded-xl overflow-hidden border border-stone-800 shadow-2xl bg-stone-950 aspect-video relative group flex items-center justify-center">
                      <img
                        src={activeTab.imageUrl || '/image.png'}
                        alt={activeTab.title}
                        className="w-full h-full object-cover object-center group-hover:scale-105 transition duration-500"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.src = '/image.png';
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-stone-950/60 via-transparent to-transparent pointer-events-none" />
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </section>

      {/* SEÇÃO DE PLANOS & PREÇOS (DINÂMICA) */}
      <section id="planos" className="py-20 md:py-28 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto space-y-12">
          
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-black text-emerald-400 uppercase tracking-wider">
              {currentSettings.pricingTag}
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              {currentSettings.pricingTitle}
            </h2>
            <p className="text-xs sm:text-sm text-stone-400">
              {currentSettings.pricingSubtitle}
            </p>
          </div>

          {/* Cards dos Planos Ativos Ordenados (1 col mobile, 2 col tablet, 3 col desktop) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 items-stretch">
            {activePlans.map((plan) => {
              // Quebra as features linha por linha
              const features = plan.featuresText.split('\n').filter(Boolean);

              return (
                <div
                  key={plan.id}
                  className={`bg-stone-900 rounded-3xl p-6 sm:p-8 flex flex-col justify-between space-y-6 relative transition-all duration-200 ${
                    plan.isFeatured
                      ? 'border-2 border-emerald-500 shadow-2xl shadow-emerald-950/80 ring-1 ring-emerald-500/50 sm:-translate-y-2'
                      : 'border border-stone-800 hover:border-stone-700'
                  }`}
                >
                  {/* Badge de Destaque */}
                  {(plan.badge || plan.isFeatured) && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <span className="px-4 py-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-stone-950 text-xs font-black rounded-full uppercase tracking-wider shadow-md">
                        {plan.badge || 'Mais Escolhido'}
                      </span>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <h3 className="text-xl font-black text-white">
                        {plan.name}
                      </h3>
                      <p className="text-xs text-stone-400 mt-1 leading-relaxed">
                        {plan.description}
                      </p>
                    </div>

                    {/* Preço em Moeda Brasileira Padrão R$ #.##0,00 */}
                    <div className="py-3 border-y border-stone-800">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                          {formatCurrencyBRL(plan.price)}
                        </span>
                        <span className="text-xs text-stone-400 font-bold">/mês</span>
                      </div>
                      <span className="text-[11px] text-emerald-400 font-medium block mt-1">
                        Faturamento mensal no cartão ou Pix
                      </span>
                    </div>

                    {/* Features com ícone de check verde */}
                    <div className="space-y-2.5 pt-2">
                      <span className="text-[11px] font-black uppercase tracking-wider text-stone-400 block">
                        O que está incluído:
                      </span>
                      <ul className="space-y-2.5">
                        {features.map((feat, idx) => (
                          <li key={idx} className="flex items-start gap-2.5 text-xs text-stone-200 leading-snug">
                            <div className="w-4 h-4 rounded-full bg-emerald-950 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-800">
                              <Check className="w-3 h-3 text-emerald-400" />
                            </div>
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Botão COMEÇAR AGORA com passagem do plano respectivo */}
                  <div className="pt-4">
                    <button
                      type="button"
                      onClick={() => handleStartPlan(plan)}
                      className={`w-full py-3.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2 shadow-md ${
                        plan.isFeatured
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-stone-950 shadow-emerald-950/80'
                          : 'bg-stone-800 hover:bg-stone-700 text-white'
                      }`}
                    >
                      <span>COMEÇAR AGORA</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* RODAPÉ DO SITE PÚBLICO */}
      <footer className="border-t border-stone-800/80 bg-stone-950 py-12 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-stone-400">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-black text-xs">
              AC
            </div>
            <span className="font-bold text-stone-300">
              {currentSettings.footerCopyright}
            </span>
          </div>

          <div className="flex items-center gap-6">
            <button
              type="button"
              id="btn-footer-signup"
              onClick={() => {
                if (currentSettings.footerSignupUrl) {
                  window.open(currentSettings.footerSignupUrl, '_blank', 'noopener,noreferrer');
                } else if (onNavigateToAuth) {
                  onNavigateToAuth(undefined, 'signup', allowFreeTrial);
                }
              }}
              className="text-emerald-400 font-bold hover:underline transition cursor-pointer"
            >
              {currentSettings.allowFreeTrial ? 'Criar Conta (15 Dias Grátis)' : 'Começar Agora'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (currentSettings.footerLoginUrl) {
                  window.open(currentSettings.footerLoginUrl, '_blank', 'noopener,noreferrer');
                } else {
                  handleAccessErp();
                }
              }}
              className="hover:text-emerald-400 transition cursor-pointer"
            >
              Painel do Assinante (ERP)
            </button>
            <button
              type="button"
              onClick={onOpenMasterAdmin}
              className="hover:text-stone-200 transition cursor-pointer flex items-center gap-1 text-stone-500 hover:text-emerald-400"
              title="Acesso Administrativo Geral"
            >
              <Lock className="w-3 h-3" />
              <span>Admin Mestre</span>
            </button>
          </div>
        </div>
      </footer>

      {/* MODAL POP-UP (LIGHTBOX) DO VÍDEO DEMONSTRATIVO */}
      {isVideoModalOpen && (
        <div
          id="modal-video-lightbox"
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setIsVideoModalOpen(false)}
        >
          <div
            className="relative w-full max-w-4xl bg-stone-900 border border-stone-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabeçalho do Lightbox */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-stone-800 bg-stone-950/80">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Video className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-white leading-tight">
                    Demonstração do Sistema AgroControl
                  </h3>
                  <p className="text-[10px] text-stone-400">
                    Apresentação completa das rotinas operacionais e telemetria
                  </p>
                </div>
              </div>

              <button
                type="button"
                id="btn-close-video-modal"
                onClick={() => setIsVideoModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-stone-800/80 hover:bg-stone-700 text-stone-300 hover:text-white flex items-center justify-center transition cursor-pointer"
                title="Fechar (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Conteúdo do Vídeo */}
            <div className="relative aspect-video w-full bg-black flex items-center justify-center">
              {(() => {
                const parsedVideo = parseEmbedVideoUrl(currentSettings.heroVideoUrl);
                if (parsedVideo.type === 'youtube' || parsedVideo.type === 'vimeo' || parsedVideo.type === 'iframe') {
                  return (
                    <iframe
                      src={parsedVideo.url}
                      title="Vídeo Demonstrativo do AgroControl"
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  );
                }
                if (parsedVideo.type === 'html5') {
                  return (
                    <video
                      src={parsedVideo.url}
                      controls
                      autoPlay
                      className="w-full h-full object-contain"
                    />
                  );
                }
                return (
                  <div className="p-8 text-center max-w-md space-y-4">
                    <div className="w-14 h-14 mx-auto rounded-full bg-stone-800 flex items-center justify-center text-stone-400">
                      <Play className="w-6 h-6 ml-1 text-emerald-400" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-white">
                        Nenhum Vídeo Demonstrativo Configurado
                      </h4>
                      <p className="text-xs text-stone-400">
                        O administrador do sistema pode colar o link do YouTube, Vimeo ou arquivo de vídeo em <span className="text-emerald-400 font-semibold">Configurações do Site &gt; 1. Bloco Hero &gt; URL do Vídeo Demonstrativo</span>.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsVideoModalOpen(false)}
                      className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      Voltar para a Página
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
