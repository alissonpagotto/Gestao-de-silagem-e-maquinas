import { 
  Subscriber, 
  SiteConfig, 
  PlanDefinition, 
  AdminSettings, 
  SubscriberStatus,
  MasterSession
} from '../types/masterAdmin';
import { CompanyProfile } from '../types';
import { getStoredCompanyProfile, saveStoredCompanyProfile } from './storage';
import {
  fetchCloudSiteConfig,
  upsertCloudSiteConfig,
  fetchCloudPlans,
  upsertCloudPlan,
  deleteCloudPlan,
  fetchCloudSubscribers,
  deleteCloudSubscriber
} from './supabaseService';

// Chaves de armazenamento localStorage principais e padronizadas
export const AGROCONTROL_SITE_SETTINGS_KEY = 'agrocontrol_site_settings';
export const AGROCONTROL_PLANS_DATA_KEY = 'agrocontrol_plans_data';
export const LANDING_PAGE_SETTINGS_KEY = 'landingPageSettings';

export const STORAGE_KEYS = {
  SUBSCRIBERS: 'silagem_master_subscribers_v2',
  SITE_SETTINGS: 'agrocontrol_site_settings',
  LEGACY_SITE_CONFIG: 'silagem_master_site_config_v1',
  LEGACY_LANDING_PAGE_SETTINGS: 'landingPageSettings',
  PLANS: 'agrocontrol_plans_data',
  LEGACY_PLANS: 'silagem_master_plans_v1',
  SETTINGS: 'silagem_master_settings_v1',
  MASTER_SESSION: 'silagem_master_session_v1',
};

// ==========================================
// 1. DADOS INICIAIS DO SITE (LANDING PAGE)
// ==========================================
export const DEFAULT_SITE_CONFIG: SiteConfig = {
  allow_free_trial: true, // Por padrão, teste grátis ativo
  hero_badge_text: 'A plataforma nº 1 em prestação de serviços de silagem e colheita',
  heroTitle: 'Gestão Inteligente para Prestadores de Silagem e Grãos',
  heroSubtitle: 'O ERP definitivo para controle de frotas agrícolas, ordens de serviço, pesagens, operadores e lucratividade safra a safra.',
  heroPrimaryBtnText: 'Começar Teste Grátis de 7 Dias',
  heroSecondaryBtnText: 'Conhecer Funcionalidades',
  heroBackgroundImage: '/image.png',
  hero_video_url: '',
  hero_overlay_opacity: 75, // Padrão equilibrado de 75%

  featuresSectionTitle: 'Recursos Projetados para o Campo',
  featuresSectionSubtitle: 'Controle total da sua operação agrícola na ponta dos dedos, online e no celular dos operadores.',
  featuresHighlightImage: '',

  features_tabs: [
    {
      id: 'tab-rotina-colheita',
      title: 'Logística & Escala de Frotas',
      iconName: 'Tractor',
      description: 'Distribua ensiladeiras, caminhões e tratores por fazenda com cálculo de rendimento por hora e prevenção de ociosidade.',
      bullets: [
        'Planejamento de rotas e frentes de corte por fazenda e cliente',
        'Controle de horímetro, consumo de diesel e tempo de deslocamento',
        'Prevenção de conflitos de cronograma e previsão de término de corte'
      ],
      imageUrl: '/image.png'
    },
    {
      id: 'tab-apontamento-campo',
      title: 'Apontamentos no Campo (WhatsApp)',
      iconName: 'PhoneCall',
      description: 'Envie links exclusivos para os operadores registrarem cargas, pesagens e compactação sem exigir login ou senhas complexas.',
      bullets: [
        'Link direto no WhatsApp do motorista ou operador de máquina',
        'Registro de pesagem com foto do ticket e identificação do talhão',
        'Sincronização imediata com o painel central da fazenda'
      ],
      imageUrl: '/image.png'
    },
    {
      id: 'tab-dre-lucro',
      title: 'DRE & Lucratividade por Cliente',
      iconName: 'TrendingUp',
      description: 'Saiba o custo real por hectare, tonelada ou hora trabalhada, identificando as frotas e contratos mais rentáveis.',
      bullets: [
        'DRE automatizado por ordem de serviço e cliente atendido',
        'Rateio preciso de manutenções, peças e combustível',
        'Exportação de relatórios gerenciais e comprovantes em PDF'
      ],
      imageUrl: '/image.png'
    }
  ],

  feature1Title: 'Agenda & Escala de Frotas em Tempo Real',
  feature1Desc: 'Distribua ensiladeiras, caminhões e tratores por fazenda com cálculo de rendimento por hora e prevenção de conflitos de horário.',

  feature2Title: 'Apontamento em Campo via WhatsApp',
  feature2Desc: 'Links exclusivos para operadores registrarem ordens de corte, pesagens de cargas e compactação sem necessidade de login complexo.',

  feature3Title: 'DRE & Lucratividade por Cliente e Máquina',
  feature3Desc: 'Saiba exatamente o consumo de diesel, horas trabalhadas, custo de manutenção e o lucro real de cada serviço prestado.',

  feature4Title: 'Gestão Completa de Manutenção & Pneus',
  feature4Desc: 'Controle rigoroso de rodízio de eixos, reformas, OS de oficina, abastecimentos e revisões preventivas por horímetro e km.',

  pricing_tag: 'Investimento Transparente',
  pricing_title: 'Escolha o plano ideal para a sua operação',
  pricing_subtitle: 'Cancele ou altere seu plano a qualquer momento com total liberdade.',

  footer_copyright: 'AgroControl • Silagem Fácil Pro © 2026',
  footer_signup_url: '',
  footer_login_url: '',
};

// ==========================================
// 2. DADOS INICIAIS DE PLANOS (PADRÃO ATUALIZADO: R$ 195,00 / R$ 295,00 / R$ 495,00)
// ==========================================
export const DEFAULT_PLANS: PlanDefinition[] = [
  {
    id: 'plano-essencial',
    name: 'Produtor Essencial',
    description: 'Ideal para prestadores de serviço individuais ou pequenas equipes com até 2 frotas.',
    price: 195.00,
    billingCycle: 'mensal',
    badge: undefined,
    isFeatured: false,
    isActive: true,
    displayOrder: 1,
    limits: {
      maxUsers: 3,
      maxMachineries: 5,
      maxClients: 50,
      storageLimitGb: 2,
    },
    featuresText: `Até 5 máquinas e caminhões cadastrados\n3 usuários simultâneos no painel\nAgenda logística com cálculo de rendimento\nLinks de campo para WhatsApp\nRelatórios financeiros e DRE básico\nSuporte padrão via WhatsApp`,
    checkoutUrl: 'https://pay.kiwify.com.br/exemplo-essencial',
  },
  {
    id: 'plano-pro',
    name: 'Frota Pro',
    description: 'A solução mais completa para empresas de silagem com equipes múltiplas e alta demanda.',
    price: 295.00,
    billingCycle: 'mensal',
    badge: 'Mais Escolhido',
    isFeatured: true,
    isActive: true,
    displayOrder: 2,
    limits: {
      maxUsers: 10,
      maxMachineries: 25,
      maxClients: 300,
      storageLimitGb: 10,
    },
    featuresText: `Até 25 veículos e maquinários com rastreio de placas\n10 usuários com controle de permissões por função\nGestão avançada de pneus, eixos e manutenções\nEmissão de romaneios, pedidos e recibos em PDF\nDRE por máquina e análise de consumo de diesel\nSincronização em nuvem e suporte prioritário`,
    checkoutUrl: 'https://pay.kiwify.com.br/exemplo-pro',
  },
  {
    id: 'plano-enterprise',
    name: 'Agro Enterprise',
    description: 'Para grandes frotas, cooperativas e operações agrícolas de alta escala.',
    price: 495.00,
    billingCycle: 'mensal',
    badge: 'Máxima Performance',
    isFeatured: false,
    isActive: true,
    displayOrder: 3,
    limits: {
      maxUsers: 'unlimited',
      maxMachineries: 'unlimited',
      maxClients: 'unlimited',
      storageLimitGb: 50,
    },
    featuresText: `Frotas e maquinários ilimitados\nUsuários e operadores ilimitados\nIntegração direta via Webhooks e API\nGestão fiscal e financeira com contas bancárias múltiplas\nTreinamento dedicado para toda a equipe\nGerente de conta exclusivo e SLA de suporte`,
    checkoutUrl: 'https://pay.kiwify.com.br/exemplo-enterprise',
  }
];

// ==========================================
// 3. DADOS INICIAIS DE ASSINANTES (SUBSCRIBERS)
// ==========================================
export const DEFAULT_SUBSCRIBERS: Subscriber[] = [];

// ==========================================
// 4. DADOS INICIAIS DE CONFIGURAÇÕES GERAIS
// ==========================================
export const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  webhookKiwify: 'https://api.agrocontrol.agr.br/webhooks/kiwify',
  webhookCakto: 'https://api.agrocontrol.agr.br/webhooks/cakto',
  webhookPerfectPay: 'https://api.agrocontrol.agr.br/webhooks/perfectpay',
  superAdminEmails: [
    'alisson1pagotto@gmail.com',
    'admin@agrocontrol.com.br',
    'diretoria@silagemfacil.com.br'
  ],
  masterPassword: 'AgroControl@Master2026'
};

// ==========================================
// 5. MÉTODOS DE LEITURA E GRAVAÇÃO
// ==========================================

export const COLACA_SILAGEM_SUBSCRIBER: Subscriber = {
  id: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
  name: 'COLACA SILAGEM LTDA',
  responsibleEmail: 'colacasilagem@gmail.com',
  phone: '(44) 99999-0000',
  cpfCnpj: '',
  cep: '',
  street: '',
  number: '',
  neighborhood: '',
  city: 'Maringá',
  state: 'PR',
  planId: 'essencial',
  planName: 'Produtor Essencial',
  monthlyValue: 195.00,
  status: 'trial',
  trialUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  createdAt: '2026-03-01T10:00:00.000Z',
  updatedAt: new Date().toISOString(),
};

export function getStoredSubscribers(): Subscriber[] {
  try {
    // Limpeza retroativa de chave legada caso ainda resida em cache do navegador
    if (typeof localStorage !== 'undefined' && localStorage.getItem('silagem_master_subscribers_v1')) {
      localStorage.removeItem('silagem_master_subscribers_v1');
    }

    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.SUBSCRIBERS) : null;
    if (raw === null) {
      // Primeira inicialização absoluta (quando não há nada no storage)
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.SUBSCRIBERS, JSON.stringify([COLACA_SILAGEM_SUBSCRIBER]));
      }
      return [COLACA_SILAGEM_SUBSCRIBER];
    }

    let parsed: any[] = [];
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = [];
    }

    if (!Array.isArray(parsed)) {
      parsed = [];
    }

    // Filtrar quaisquer resquícios das 6 empresas simuladas
    const cleaned: Subscriber[] = parsed.filter(
      (sub: any) =>
        sub &&
        !['sub-001', 'sub-002', 'sub-003', 'sub-004', 'sub-005', 'sub-006'].includes(sub.id) &&
        !['Agropecuária Santa Fé Ltda', 'Colheitas & Silagem do Cerrado', 'Fazenda Boa Esperança - João Pedro Silva', 'Cooperativa Agrícola Sul Catarinense', 'Tratores & Ensilagem Pioneiro', 'AgroServiços Vale do Paranapanema'].includes(sub.name)
    );

    return cleaned;
  } catch (e) {
    console.error('Failed to load subscribers:', e);
    return [];
  }
}

export function saveStoredSubscribers(subscribers: Subscriber[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SUBSCRIBERS, JSON.stringify(subscribers));
    notifyDataChanged();
  } catch (e) {
    console.error('Failed to save subscribers:', e);
  }
}

export function getStoredSiteConfig(): SiteConfig {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_SITE_CONFIG;
    // Tenta ler prioritariamente da chave centralizada e padronizada 'agrocontrol_site_settings'
    const raw = 
      localStorage.getItem(AGROCONTROL_SITE_SETTINGS_KEY) || 
      localStorage.getItem(STORAGE_KEYS.LEGACY_LANDING_PAGE_SETTINGS) || 
      localStorage.getItem(STORAGE_KEYS.LEGACY_SITE_CONFIG);

    if (!raw) {
      const defStr = JSON.stringify(DEFAULT_SITE_CONFIG);
      localStorage.setItem(AGROCONTROL_SITE_SETTINGS_KEY, defStr);
      localStorage.setItem(STORAGE_KEYS.LEGACY_LANDING_PAGE_SETTINGS, defStr);
      localStorage.setItem(STORAGE_KEYS.LEGACY_SITE_CONFIG, defStr);
      return DEFAULT_SITE_CONFIG;
    }
    const parsed = JSON.parse(raw);
    return {
      allow_free_trial: parsed.allow_free_trial !== undefined ? Boolean(parsed.allow_free_trial) : (DEFAULT_SITE_CONFIG.allow_free_trial ?? true),
      hero_badge_text: parsed.hero_badge_text !== undefined ? parsed.hero_badge_text : (DEFAULT_SITE_CONFIG.hero_badge_text || 'A plataforma nº 1 em prestação de serviços de silagem e colheita'),
      heroTitle: parsed.heroTitle || DEFAULT_SITE_CONFIG.heroTitle,
      heroSubtitle: parsed.heroSubtitle || DEFAULT_SITE_CONFIG.heroSubtitle,
      heroPrimaryBtnText: parsed.heroPrimaryBtnText || DEFAULT_SITE_CONFIG.heroPrimaryBtnText,
      heroSecondaryBtnText: parsed.heroSecondaryBtnText || DEFAULT_SITE_CONFIG.heroSecondaryBtnText,
      heroBackgroundImage: parsed.heroBackgroundImage || DEFAULT_SITE_CONFIG.heroBackgroundImage || '/image.png',
      hero_video_url: parsed.hero_video_url !== undefined ? parsed.hero_video_url : (DEFAULT_SITE_CONFIG.hero_video_url || ''),
      hero_overlay_opacity: parsed.hero_overlay_opacity !== undefined && parsed.hero_overlay_opacity !== null ? Number(parsed.hero_overlay_opacity) : (DEFAULT_SITE_CONFIG.hero_overlay_opacity ?? 75),
      featuresSectionTitle: parsed.featuresSectionTitle || DEFAULT_SITE_CONFIG.featuresSectionTitle,
      featuresSectionSubtitle: parsed.featuresSectionSubtitle || DEFAULT_SITE_CONFIG.featuresSectionSubtitle,
      featuresHighlightImage: parsed.featuresHighlightImage || '',
      features_tabs: Array.isArray(parsed.features_tabs) && parsed.features_tabs.length > 0 ? parsed.features_tabs : DEFAULT_SITE_CONFIG.features_tabs,
      feature1Title: parsed.feature1Title || DEFAULT_SITE_CONFIG.feature1Title,
      feature1Desc: parsed.feature1Desc || DEFAULT_SITE_CONFIG.feature1Desc,
      feature2Title: parsed.feature2Title || DEFAULT_SITE_CONFIG.feature2Title,
      feature2Desc: parsed.feature2Desc || DEFAULT_SITE_CONFIG.feature2Desc,
      feature3Title: parsed.feature3Title || DEFAULT_SITE_CONFIG.feature3Title,
      feature3Desc: parsed.feature3Desc || DEFAULT_SITE_CONFIG.feature3Desc,
      feature4Title: parsed.feature4Title || DEFAULT_SITE_CONFIG.feature4Title,
      feature4Desc: parsed.feature4Desc || DEFAULT_SITE_CONFIG.feature4Desc,
      pricing_tag: parsed.pricing_tag || DEFAULT_SITE_CONFIG.pricing_tag || 'Investimento Transparente',
      pricing_title: parsed.pricing_title || DEFAULT_SITE_CONFIG.pricing_title || 'Escolha o plano ideal para a sua operação',
      pricing_subtitle: parsed.pricing_subtitle || DEFAULT_SITE_CONFIG.pricing_subtitle || 'Cancele ou altere seu plano a qualquer momento com total liberdade.',
      footer_copyright: parsed.footer_copyright || DEFAULT_SITE_CONFIG.footer_copyright || 'AgroControl • Silagem Fácil Pro © 2026',
      footer_signup_url: parsed.footer_signup_url || '',
      footer_login_url: parsed.footer_login_url || '',
    };
  } catch (e) {
    console.error('Failed to load site config:', e);
    return DEFAULT_SITE_CONFIG;
  }
}

export function saveStoredSiteConfig(config: SiteConfig): void {
  try {
    if (typeof localStorage !== 'undefined') {
      const serialized = JSON.stringify(config);
      // Salva obrigatoriamente na chave principal 'agrocontrol_site_settings' e nas chaves legadas para compatibilidade total
      localStorage.setItem(AGROCONTROL_SITE_SETTINGS_KEY, serialized);
      localStorage.setItem(STORAGE_KEYS.LEGACY_LANDING_PAGE_SETTINGS, serialized);
      localStorage.setItem(STORAGE_KEYS.LEGACY_SITE_CONFIG, serialized);
    }
    notifyDataChanged(config);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('agrocontrol_site_settings_updated', { detail: config }));
      window.dispatchEvent(new CustomEvent('landing_page_settings_updated', { detail: config }));
      // Disparo forçado de evento 'storage' para listeners que escutam window.addEventListener('storage', ...)
      try {
        window.dispatchEvent(new Event('storage'));
      } catch (e) {
        // Fallback silencioso
      }
    }
    // Persistência em Nuvem (Supabase)
    upsertCloudSiteConfig(config).catch(err => {
      console.warn('Notice saving site config to cloud:', err);
    });
  } catch (e) {
    console.error('Failed to save site config:', e);
  }
}

// Aliases explícitos para clareza semântica
export const getStoredLandingSettings = getStoredSiteConfig;
export const saveStoredLandingSettings = saveStoredSiteConfig;

export function getStoredPlans(): PlanDefinition[] {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_PLANS;
    // Tenta ler prioritariamente da chave global padronizada 'agrocontrol_plans_data' com fallback para legada
    const raw = localStorage.getItem(AGROCONTROL_PLANS_DATA_KEY) || localStorage.getItem(STORAGE_KEYS.LEGACY_PLANS);
    if (!raw) {
      const defStr = JSON.stringify(DEFAULT_PLANS);
      localStorage.setItem(AGROCONTROL_PLANS_DATA_KEY, defStr);
      localStorage.setItem(STORAGE_KEYS.LEGACY_PLANS, defStr);
      return DEFAULT_PLANS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Se houver planos antigos legados armazenados no browser do usuário com preços antigos (ex: 189, 389, 749, 159, 279),
      // e não foram customizados manualmente com outros valores, atualizar para os novos padrões (195, 295, 495)
      const hasOldOutdatedPrices = parsed.some(p => 
        (p.id === 'plano-essencial' && (p.price === 189 || p.price === 159.9 || p.price === 159)) ||
        (p.id === 'plano-pro' && (p.price === 389 || p.price === 279)) ||
        (p.id === 'plano-enterprise' && (p.price === 749 || p.price === 699))
      );
      if (hasOldOutdatedPrices) {
        const updated = parsed.map(p => {
          if (p.id === 'plano-essencial' && (p.price === 189 || p.price === 159.9 || p.price === 159)) return { ...p, price: 195.00 };
          if (p.id === 'plano-pro' && (p.price === 389 || p.price === 279)) return { ...p, price: 295.00 };
          if (p.id === 'plano-enterprise' && (p.price === 749 || p.price === 699)) return { ...p, price: 495.00 };
          return p;
        });
        const defStr = JSON.stringify(updated);
        localStorage.setItem(AGROCONTROL_PLANS_DATA_KEY, defStr);
        localStorage.setItem(STORAGE_KEYS.LEGACY_PLANS, defStr);
        return updated;
      }
      return parsed;
    }
    return DEFAULT_PLANS;
  } catch (e) {
    console.error('Failed to load plans:', e);
    return DEFAULT_PLANS;
  }
}

export { sanitizePlanId } from './supabaseService';

export function saveStoredPlans(plans: PlanDefinition[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      const serialized = JSON.stringify(plans);
      // Salva obrigatoriamente na chave padronizada e unificada
      localStorage.setItem(AGROCONTROL_PLANS_DATA_KEY, serialized);
      localStorage.setItem(STORAGE_KEYS.LEGACY_PLANS, serialized);
    }
    notifyDataChanged(plans);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('agrocontrol_plans_updated', { detail: plans }));
      // Disparo forçado de evento 'storage' para listeners que escutam window.addEventListener('storage', ...)
      try {
        window.dispatchEvent(new Event('storage'));
      } catch (e) {
        // Fallback silencioso
      }
    }
    // Persistência em Nuvem resiliente (Supabase)
    (async () => {
      for (const p of plans) {
        try {
          await upsertCloudPlan(p);
        } catch (planErr) {
          console.warn(`Aviso ao persistir plano ${p.id} no Supabase:`, planErr);
        }
      }
    })();
  } catch (e) {
    console.error('Failed to save plans:', e);
  }
}

let publicLandingInFlight: Promise<{ siteConfig: SiteConfig; plans: PlanDefinition[] }> | null = null;
let lastPublicLandingFetch = 0;
let lastPublicLandingResult: { siteConfig: SiteConfig; plans: PlanDefinition[] } | null = null;

/**
 * Busca pública exclusiva para visitantes e landing page (planos e configurações de site),
 * garantindo acesso sem restrições ou bloqueios em qualquer dispositivo.
 * Inclui deduplicação em voo e cooldown para evitar ERR_INSUFFICIENT_RESOURCES.
 */
export async function fetchPublicLandingData(): Promise<{
  siteConfig: SiteConfig;
  plans: PlanDefinition[];
}> {
  const now = Date.now();
  if (lastPublicLandingResult && now - lastPublicLandingFetch < 5000) {
    return lastPublicLandingResult;
  }
  if (publicLandingInFlight) {
    return publicLandingInFlight;
  }

  publicLandingInFlight = (async () => {
    try {
      const [siteResult, plansResult] = await Promise.allSettled([
        fetchCloudSiteConfig(),
        fetchCloudPlans(),
      ]);

      let resolvedSite = getStoredSiteConfig();
      if (siteResult.status === 'fulfilled' && siteResult.value) {
        resolvedSite = siteResult.value;
        if (typeof localStorage !== 'undefined') {
          const serialized = JSON.stringify(resolvedSite);
          localStorage.setItem(AGROCONTROL_SITE_SETTINGS_KEY, serialized);
          localStorage.setItem(STORAGE_KEYS.LEGACY_LANDING_PAGE_SETTINGS, serialized);
          localStorage.setItem(STORAGE_KEYS.LEGACY_SITE_CONFIG, serialized);
        }
      }

      let resolvedPlans = getStoredPlans();
      if (plansResult.status === 'fulfilled' && plansResult.value && plansResult.value.length > 0) {
        resolvedPlans = plansResult.value;
        if (typeof localStorage !== 'undefined') {
          const serialized = JSON.stringify(resolvedPlans);
          localStorage.setItem(AGROCONTROL_PLANS_DATA_KEY, serialized);
          localStorage.setItem(STORAGE_KEYS.LEGACY_PLANS, serialized);
        }
      }

      const result = {
        siteConfig: resolvedSite,
        plans: resolvedPlans,
      };
      lastPublicLandingFetch = Date.now();
      lastPublicLandingResult = result;
      return result;
    } catch (err) {
      console.warn('Notice fetching public landing data:', err);
      return {
        siteConfig: getStoredSiteConfig(),
        plans: getStoredPlans(),
      };
    } finally {
      publicLandingInFlight = null;
    }
  })();

  return publicLandingInFlight;
}

let syncMasterInFlight: Promise<{ siteConfig: SiteConfig; plans: PlanDefinition[]; subscribers: Subscriber[] }> | null = null;
let lastSyncMasterFetch = 0;
let lastSyncMasterResult: { siteConfig: SiteConfig; plans: PlanDefinition[]; subscribers: Subscriber[] } | null = null;

/**
 * Sincroniza em segundo plano os dados mestres (SiteConfig, Planos e Assinantes)
 * com o banco de dados centralizado Supabase.
 * Usa Promise.allSettled, deduplicação em voo (in-flight) e cooldown para prevenir
 * loops infinitos e exaustão de conexões HTTP (ERR_INSUFFICIENT_RESOURCES).
 */
export async function syncMasterAdminFromCloud(): Promise<{
  siteConfig: SiteConfig;
  plans: PlanDefinition[];
  subscribers: Subscriber[];
}> {
  const now = Date.now();
  if (lastSyncMasterResult && now - lastSyncMasterFetch < 5000) {
    return lastSyncMasterResult;
  }
  if (syncMasterInFlight) {
    return syncMasterInFlight;
  }

  syncMasterInFlight = (async () => {
    try {
      const [siteResult, plansResult, subsResult] = await Promise.allSettled([
        fetchCloudSiteConfig(),
        fetchCloudPlans(),
        fetchCloudSubscribers(),
      ]);

      const cloudSite = siteResult.status === 'fulfilled' ? siteResult.value : null;
      const cloudPlans = plansResult.status === 'fulfilled' ? plansResult.value : null;
      const cloudSubs = subsResult.status === 'fulfilled' ? subsResult.value : null;

      let resolvedSite = getStoredSiteConfig();
      if (cloudSite) {
        resolvedSite = cloudSite;
        if (typeof localStorage !== 'undefined') {
          const serialized = JSON.stringify(cloudSite);
          localStorage.setItem(AGROCONTROL_SITE_SETTINGS_KEY, serialized);
          localStorage.setItem(STORAGE_KEYS.LEGACY_LANDING_PAGE_SETTINGS, serialized);
          localStorage.setItem(STORAGE_KEYS.LEGACY_SITE_CONFIG, serialized);
        }
      }

      let resolvedPlans = getStoredPlans();
      if (cloudPlans && cloudPlans.length > 0) {
        resolvedPlans = cloudPlans;
        if (typeof localStorage !== 'undefined') {
          const serialized = JSON.stringify(cloudPlans);
          localStorage.setItem(AGROCONTROL_PLANS_DATA_KEY, serialized);
          localStorage.setItem(STORAGE_KEYS.LEGACY_PLANS, serialized);
        }
      }

      let resolvedSubs = getStoredSubscribers();
      if (cloudSubs && cloudSubs.length > 0) {
        resolvedSubs = cloudSubs;
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEYS.SUBSCRIBERS, JSON.stringify(cloudSubs));
        }
      }

      const result = {
        siteConfig: resolvedSite,
        plans: resolvedPlans,
        subscribers: resolvedSubs,
      };

      lastSyncMasterFetch = Date.now();
      lastSyncMasterResult = result;
      return result;
    } catch (err) {
      console.warn('Notice syncing master admin from cloud:', err);
      return {
        siteConfig: getStoredSiteConfig(),
        plans: getStoredPlans(),
        subscribers: getStoredSubscribers(),
      };
    } finally {
      syncMasterInFlight = null;
    }
  })();

  return syncMasterInFlight;
}

export function getStoredAdminSettings(): AdminSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_ADMIN_SETTINGS));
      return DEFAULT_ADMIN_SETTINGS;
    }
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_ADMIN_SETTINGS, ...parsed };
  } catch (e) {
    console.error('Failed to load admin settings:', e);
    return DEFAULT_ADMIN_SETTINGS;
  }
}

export function saveStoredAdminSettings(settings: AdminSettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    notifyDataChanged();
  } catch (e) {
    console.error('Failed to save admin settings:', e);
  }
}

export function getStoredMasterSession(): MasterSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS.MASTER_SESSION) || localStorage.getItem(STORAGE_KEYS.MASTER_SESSION);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (session && typeof session.email === 'string') {
      return session;
    }
    return null;
  } catch (e) {
    console.error('Failed to load master session:', e);
    return null;
  }
}

export function saveStoredMasterSession(session: MasterSession): void {
  try {
    const serialized = JSON.stringify(session);
    sessionStorage.setItem(STORAGE_KEYS.MASTER_SESSION, serialized);
    localStorage.setItem(STORAGE_KEYS.MASTER_SESSION, serialized);
    localStorage.setItem('silagem_master_authenticated', 'true');
    notifyDataChanged();
  } catch (e) {
    console.error('Failed to save master session:', e);
  }
}

export function clearStoredMasterSession(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEYS.MASTER_SESSION);
    localStorage.removeItem(STORAGE_KEYS.MASTER_SESSION);
    localStorage.removeItem('silagem_master_authenticated');
    notifyDataChanged();
  } catch (e) {
    console.error('Failed to clear master session:', e);
  }
}

// Disparo de evento global para reatividade instantânea entre telas
function notifyDataChanged(detail?: any) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('master_admin_data_changed', { detail }));
    window.dispatchEvent(new CustomEvent('landing_page_settings_updated', { detail }));
  }
}

// ==========================================
// 6. CÁLCULO DE MÉTRICAS EM TEMPO REAL
// ==========================================

export interface MasterAdminMetrics {
  totalSubscribers: number;
  activeSubscribers: number;
  trialSubscribers: number;
  suspendedSubscribers: number;
  estimatedMrr: number;
}

export function computeMasterMetrics(subscribers?: Subscriber[] | null): MasterAdminMetrics {
  const list = Array.isArray(subscribers) ? subscribers.filter(Boolean) : [];
  const totalSubscribers = list.length;
  const activeSubscribers = list.filter(s => (s?.status || '').toLowerCase() === 'ativa').length;
  const trialSubscribers = list.filter(s => (s?.status || '').toLowerCase() === 'trial').length;
  // Suspensas e inadimplentes
  const suspendedSubscribers = list.filter(s => {
    const st = (s?.status || '').toLowerCase();
    return st === 'suspensa' || st === 'inadimplente';
  }).length;

  // Soma dinâmica do MRR Estimado (APENAS assinantes com status "ativa" somam no faturamento recorrente. Clientes em trial permanecem com MRR R$ 0,00)
  const estimatedMrr = list
    .filter(s => (s?.status || '').toLowerCase() === 'ativa')
    .reduce((sum, s) => sum + (Number(s?.monthlyValue) || 0), 0);

  return {
    totalSubscribers,
    activeSubscribers,
    trialSubscribers,
    suspendedSubscribers,
    estimatedMrr
  };
}

// ==========================================
// 7. REGISTRO AUTOMATIZADO DE NOVOS ASSINANTES
// ==========================================

export interface CreateSubscriberPayload {
  id?: string;
  name: string;
  tradeName?: string;
  responsibleEmail: string;
  password?: string;
  phone: string;
  cpfCnpj: string;
  stateRegistration?: string;
  cep: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  representativeName?: string;
  representativeCpf?: string;
  planId?: string;
  monthlyValue?: number;
  status?: SubscriberStatus;
  trialDays?: number;
}

/**
 * Cadastra um novo assinante gerando registro nas tabelas do Admin Mestre
 * e auto-preenchendo o perfil da empresa (CompanyProfile) para o ERP Gestão de Silagem.
 */
export function registerNewSubscriber(payload: CreateSubscriberPayload): { subscriber: Subscriber; companyProfile: CompanyProfile } {
  const subscribers = getStoredSubscribers();
  const plans = getStoredPlans();

  // 1. Identificar o plano selecionado pelo ID ou fallback para plano ativo/destaque
  const selectedPlan = (payload.planId ? plans.find(p => p.id === payload.planId) : null) || 
                       plans.find(p => p.isFeatured && p.isActive) || 
                       plans.find(p => p.isActive) || 
                       plans[0] || {
                         id: 'pro',
                         name: 'Frota Pro',
                         price: 295.00
                       };

  // 2. Definir expiração do Trial (Padrão 7 dias conforme solicitado)
  const trialDays = payload.trialDays !== undefined ? payload.trialDays : 7;
  const trialDate = new Date();
  trialDate.setDate(trialDate.getDate() + trialDays);
  const trialUntil = trialDate.toISOString().split('T')[0];

  // 3. Status inicial (TRIAL como padrão, ou ATIVA se vier com pagamento aprovado)
  const status: SubscriberStatus = payload.status || 'trial';

  // 4. Utiliza o ID do Supabase Auth se fornecido, ou gera ID único
  const id = payload.id || `sub-${Date.now().toString(36)}-${Math.floor(1000 + Math.random() * 9000)}`;

  const newSubscriber: Subscriber = {
    id,
    name: payload.name.trim(),
    responsibleEmail: payload.responsibleEmail.trim().toLowerCase(),
    password: payload.password || '••••••••',
    trialUntil,
    cpfCnpj: payload.cpfCnpj.trim(),
    stateRegistration: payload.stateRegistration?.trim() || '',
    phone: payload.phone.trim(),
    cep: payload.cep.trim(),
    street: payload.street.trim(),
    number: payload.number.trim() || 'S/N',
    neighborhood: payload.neighborhood.trim(),
    city: payload.city.trim(),
    state: payload.state.trim().toUpperCase(),
    planId: selectedPlan.id,
    planName: selectedPlan.name,
    monthlyValue: Number(selectedPlan.price) || 0,
    status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // 5. Inserir no topo da lista e salvar no Admin Mestre
  const updatedSubscribers = [
    newSubscriber,
    ...subscribers.filter(s => s.id !== id && s.responsibleEmail.toLowerCase() !== newSubscriber.responsibleEmail.toLowerCase())
  ];
  saveStoredSubscribers(updatedSubscribers);

  // 6. Conectar ao Perfil da Empresa (Configurações da Empresa / Perfil do Produtor)
  const currentCompany = getStoredCompanyProfile();
  const updatedCompany: CompanyProfile = {
    ...currentCompany,
    corporateName: payload.name.trim(),
    tradeName: (payload.tradeName || payload.name).trim(),
    cnpjCpf: payload.cpfCnpj.trim(),
    stateRegistration: payload.stateRegistration?.trim() || '',
    phone: payload.phone.trim(),
    email: payload.responsibleEmail.trim().toLowerCase(),
    loginEmail: payload.responsibleEmail.trim().toLowerCase(),
    representativeName: (payload.representativeName || payload.name).trim(),
    representativeCpf: payload.representativeCpf?.trim() || '',
    zipCode: payload.cep.trim(),
    address: payload.street.trim(),
    number: payload.number.trim() || 'S/N',
    neighborhood: payload.neighborhood.trim(),
    city: payload.city.trim(),
    state: payload.state.trim().toUpperCase(),
    activitySector: currentCompany.activitySector || 'GESTÃO AGRÍCOLA',
  };

  saveStoredCompanyProfile(updatedCompany);

  // 7. Persistir sessão ativa para o novo cliente no navegador
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('silagem_client_session', 'active');
      localStorage.setItem('silagem_active_subscriber_id', newSubscriber.id);
      localStorage.setItem('silagem_active_subscriber_email', newSubscriber.responsibleEmail);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('silagem_company_profile_updated', { detail: updatedCompany }));
    }
  } catch (e) {
    console.error('Failed to set active subscriber session:', e);
  }

  return { subscriber: newSubscriber, companyProfile: updatedCompany };
}

