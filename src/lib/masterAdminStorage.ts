import { 
  Subscriber, 
  SiteConfig, 
  PlanDefinition, 
  AdminSettings, 
  SubscriberStatus 
} from '../types/masterAdmin';
import { CompanyProfile } from '../types';
import { getStoredCompanyProfile, saveStoredCompanyProfile } from './storage';

// Chaves de armazenamento localStorage
const STORAGE_KEYS = {
  SUBSCRIBERS: 'silagem_master_subscribers_v1',
  SITE_CONFIG: 'silagem_master_site_config_v1',
  PLANS: 'silagem_master_plans_v1',
  SETTINGS: 'silagem_master_settings_v1',
};

// ==========================================
// 1. DADOS INICIAIS DO SITE (LANDING PAGE)
// ==========================================
export const DEFAULT_SITE_CONFIG: SiteConfig = {
  heroTitle: 'Gestão Inteligente para Prestadores de Silagem e Grãos',
  heroSubtitle: 'O ERP definitivo para controle de frotas agrícolas, ordens de serviço, pesagens, operadores e lucratividade safra a safra.',
  heroPrimaryBtnText: 'Começar Teste Grátis de 7 Dias',
  heroSecondaryBtnText: 'Ver Demonstração ao Vivo',
  heroBackgroundImage: '/image.png',

  featuresSectionTitle: 'Recursos Projetados para o Campo',
  featuresSectionSubtitle: 'Controle total da sua operação agrícola na ponta dos dedos, online e no celular dos operadores.',

  feature1Title: 'Agenda & Escala de Frotas em Tempo Real',
  feature1Desc: 'Distribua ensiladeiras, caminhões e tratores por fazenda com cálculo de rendimento por hora e prevenção de conflitos de horário.',

  feature2Title: 'Apontamento em Campo via WhatsApp',
  feature2Desc: 'Links exclusivos para operadores registrarem ordens de corte, pesagens de cargas e compactação sem necessidade de login complexo.',

  feature3Title: 'DRE & Lucratividade por Cliente e Máquina',
  feature3Desc: 'Saiba exatamente o consumo de diesel, horas trabalhadas, custo de manutenção e o lucro real de cada serviço prestado.',

  feature4Title: 'Gestão Completa de Manutenção & Pneus',
  feature4Desc: 'Controle rigoroso de rodízio de eixos, reformas, OS de oficina, abastecimentos e revisões preventivas por horímetro e km.',
};

// ==========================================
// 2. DADOS INICIAIS DE PLANOS
// ==========================================
export const DEFAULT_PLANS: PlanDefinition[] = [
  {
    id: 'plano-essencial',
    name: 'Produtor Essencial',
    description: 'Ideal para prestadores de serviço individuais ou pequenas equipes com até 2 frotas.',
    price: 189.00,
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
    price: 389.00,
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
    price: 749.00,
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
export const DEFAULT_SUBSCRIBERS: Subscriber[] = [
  {
    id: 'sub-001',
    name: 'Agropecuária Santa Fé Ltda',
    responsibleEmail: 'marcos.gerencia@santafeagro.com.br',
    password: '••••••••',
    trialUntil: '2026-10-30',
    cpfCnpj: '14.285.932/0001-44',
    stateRegistration: '124.582.901.112',
    phone: '(16) 99871-4420',
    cep: '14010-060',
    street: 'Avenida Presidente Vargas',
    number: '1450',
    neighborhood: 'Jardim América',
    city: 'Ribeirão Preto',
    state: 'SP',
    planId: 'plano-pro',
    planName: 'Frota Pro',
    monthlyValue: 389.00,
    status: 'ativa',
    createdAt: '2026-07-15T10:30:00.000Z',
    updatedAt: '2026-09-10T14:20:00.000Z',
  },
  {
    id: 'sub-002',
    name: 'Colheitas & Silagem do Cerrado',
    responsibleEmail: 'roberto@cerradosilagem.agr.br',
    password: '••••••••',
    trialUntil: '2026-09-28',
    cpfCnpj: '28.910.450/0001-89',
    stateRegistration: '10.554.890-1',
    phone: '(64) 99230-1188',
    cep: '75901-020',
    street: 'Rua das Acácias',
    number: '310',
    neighborhood: 'Setor Industrial',
    city: 'Rio Verde',
    state: 'GO',
    planId: 'plano-pro',
    planName: 'Frota Pro',
    monthlyValue: 389.00,
    status: 'ativa',
    createdAt: '2026-08-01T09:15:00.000Z',
    updatedAt: '2026-09-12T11:00:00.000Z',
  },
  {
    id: 'sub-003',
    name: 'Fazenda Boa Esperança - João Pedro Silva',
    responsibleEmail: 'joaopedro.silagem@gmail.com',
    password: '••••••••',
    trialUntil: '2026-09-24',
    cpfCnpj: '054.892.118-20',
    stateRegistration: 'ISENTO',
    phone: '(34) 99182-7733',
    cep: '38400-100',
    street: 'Rodovia Municipal KM 14',
    number: 'S/N',
    neighborhood: 'Zona Rural',
    city: 'Uberlândia',
    state: 'MG',
    planId: 'plano-essencial',
    planName: 'Produtor Essencial',
    monthlyValue: 189.00,
    status: 'trial',
    createdAt: '2026-09-10T08:00:00.000Z',
    updatedAt: '2026-09-10T08:00:00.000Z',
  },
  {
    id: 'sub-004',
    name: 'Cooperativa Agrícola Sul Catarinense',
    responsibleEmail: 'diretoria@coopersul.coop.br',
    password: '••••••••',
    trialUntil: '2026-11-15',
    cpfCnpj: '83.450.912/0001-02',
    stateRegistration: '254.890.113',
    phone: '(49) 98844-5511',
    cep: '89801-000',
    street: 'Rua Fernando Machado',
    number: '820',
    neighborhood: 'Centro',
    city: 'Chapecó',
    state: 'SC',
    planId: 'plano-enterprise',
    planName: 'Agro Enterprise',
    monthlyValue: 749.00,
    status: 'ativa',
    createdAt: '2026-06-20T14:40:00.000Z',
    updatedAt: '2026-09-15T16:30:00.000Z',
  },
  {
    id: 'sub-005',
    name: 'Tratores & Ensilagem Pioneiro',
    responsibleEmail: 'contato@pioneirosilagem.com.br',
    password: '••••••••',
    trialUntil: '2026-08-30',
    cpfCnpj: '19.782.330/0001-15',
    stateRegistration: '098.441.229.001',
    phone: '(44) 99770-3344',
    cep: '87013-010',
    street: 'Avenida Brasil',
    number: '2500',
    neighborhood: 'Zona 01',
    city: 'Maringá',
    state: 'PR',
    planId: 'plano-pro',
    planName: 'Frota Pro',
    monthlyValue: 389.00,
    status: 'inadimplente',
    createdAt: '2026-05-10T11:20:00.000Z',
    updatedAt: '2026-09-02T10:15:00.000Z',
  },
  {
    id: 'sub-006',
    name: 'AgroServiços Vale do Paranapanema',
    responsibleEmail: 'financeiro@agrovaleparanapanema.com',
    password: '••••••••',
    trialUntil: '2026-07-20',
    cpfCnpj: '32.190.441/0001-63',
    stateRegistration: '189.774.200.119',
    phone: '(18) 99650-8899',
    cep: '19800-010',
    street: 'Rua Floriano Peixoto',
    number: '430',
    neighborhood: 'Vila Operária',
    city: 'Assis',
    state: 'SP',
    planId: 'plano-essencial',
    planName: 'Produtor Essencial',
    monthlyValue: 189.00,
    status: 'cancelada',
    createdAt: '2026-04-12T09:00:00.000Z',
    updatedAt: '2026-07-22T15:00:00.000Z',
  }
];

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
  ]
};

// ==========================================
// 5. MÉTODOS DE LEITURA E GRAVAÇÃO
// ==========================================

export function getStoredSubscribers(): Subscriber[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SUBSCRIBERS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.SUBSCRIBERS, JSON.stringify(DEFAULT_SUBSCRIBERS));
      return DEFAULT_SUBSCRIBERS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_SUBSCRIBERS;
  } catch (e) {
    console.error('Failed to load subscribers:', e);
    return DEFAULT_SUBSCRIBERS;
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
    const raw = localStorage.getItem(STORAGE_KEYS.SITE_CONFIG);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.SITE_CONFIG, JSON.stringify(DEFAULT_SITE_CONFIG));
      return DEFAULT_SITE_CONFIG;
    }
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SITE_CONFIG, ...parsed };
  } catch (e) {
    console.error('Failed to load site config:', e);
    return DEFAULT_SITE_CONFIG;
  }
}

export function saveStoredSiteConfig(config: SiteConfig): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SITE_CONFIG, JSON.stringify(config));
    notifyDataChanged();
  } catch (e) {
    console.error('Failed to save site config:', e);
  }
}

export function getStoredPlans(): PlanDefinition[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PLANS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.PLANS, JSON.stringify(DEFAULT_PLANS));
      return DEFAULT_PLANS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_PLANS;
  } catch (e) {
    console.error('Failed to load plans:', e);
    return DEFAULT_PLANS;
  }
}

export function saveStoredPlans(plans: PlanDefinition[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PLANS, JSON.stringify(plans));
    notifyDataChanged();
  } catch (e) {
    console.error('Failed to save plans:', e);
  }
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

// Disparo de evento global para reatividade instantânea entre telas
function notifyDataChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('master_admin_data_changed'));
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

export function computeMasterMetrics(subscribers: Subscriber[]): MasterAdminMetrics {
  const totalSubscribers = subscribers.length;
  const activeSubscribers = subscribers.filter(s => s.status === 'ativa').length;
  const trialSubscribers = subscribers.filter(s => s.status === 'trial').length;
  // Suspensas e inadimplentes
  const suspendedSubscribers = subscribers.filter(s => s.status === 'suspensa' || s.status === 'inadimplente').length;

  // Soma dinâmica do MRR Estimado (apenas assinantes ATIVOS)
  const estimatedMrr = subscribers
    .filter(s => s.status === 'ativa')
    .reduce((sum, s) => sum + (Number(s.monthlyValue) || 0), 0);

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
                         id: 'plano-pro',
                         name: 'Frota Pro',
                         price: 389.00
                       };

  // 2. Definir expiração do Trial (Padrão 15 dias conforme solicitado)
  const trialDays = payload.trialDays !== undefined ? payload.trialDays : 15;
  const trialDate = new Date();
  trialDate.setDate(trialDate.getDate() + trialDays);
  const trialUntil = trialDate.toISOString().split('T')[0];

  // 3. Status inicial (TRIAL como padrão, ou ATIVA se vier com pagamento aprovado)
  const status: SubscriberStatus = payload.status || 'trial';

  // 4. Gerar ID único para o novo assinante
  const id = `sub-${Date.now().toString(36)}-${Math.floor(1000 + Math.random() * 9000)}`;

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

