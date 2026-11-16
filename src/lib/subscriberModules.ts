import type { CompanyProfile } from '../types';
import type {
  Subscriber,
  SubscriberModulesConfig,
  SubscriberSegmentProfile,
} from '../types/masterAdmin';

export const SUBSCRIBER_MODULES_STORAGE_KEY = 'agrocontrol_subscriber_modules';
export const IMPERSONATED_MODULES_STORAGE_KEY = 'agrocontrol_impersonated_modules';
export const SUBSCRIBER_MODULES_UPDATED_EVENT = 'agrocontrol_subscriber_modules_updated';

export interface SidebarModuleOption {
  id: string;
  label: string;
  description: string;
  alwaysEnabled?: boolean;
}

export const SIDEBAR_MODULE_OPTIONS: SidebarModuleOption[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Visão geral executiva e indicadores principais',
    alwaysEnabled: true,
  },
  {
    id: 'servicos',
    label: 'Prestação de Serviços',
    description: 'Ordens de corte, colheita, tratores, máquinas e apontamentos',
  },
  {
    id: 'venda',
    label: 'Venda (PDV)',
    description: 'Frente de caixa PDV, cupom, trocas e vendas diretas',
  },
  {
    id: 'estoque',
    label: 'Estoque',
    description: 'Catálogo de produtos, preços, etiquetas e movimentação',
  },
  {
    id: 'almoxarifado',
    label: 'Almoxarifado',
    description: 'Peças, insumos internos, pneus, cotações e compras',
  },
  {
    id: 'financeiro',
    label: 'Financeiro',
    description: 'Contas a receber/pagar, bancos, boletos CNAB, cheques e DRE',
  },
  {
    id: 'despesas',
    label: 'Despesas',
    description: 'Lançamentos de despesas operacionais e administrativas',
  },
  {
    id: 'fiscal',
    label: 'Fiscal & Notas',
    description: 'NF-e, NFC-e, CT-e, NFS-e, MDF-e, XMLs e envio ao contador',
  },
  {
    id: 'rh',
    label: 'RH',
    description: 'Colaboradores, folha de pagamento, férias, faltas e crachás',
  },
  {
    id: 'relatorios',
    label: 'Relatórios',
    description: 'Relatórios gerenciais, exportações e análises por safra',
  },
  {
    id: 'clientes',
    label: 'Clientes',
    description: 'Cadastro de clientes, limites de crédito e histórico',
  },
  {
    id: 'fornecedores',
    label: 'Fornecedores & Transportadoras',
    description: 'Cadastro de fornecedores, transportadoras e veículos terceiros',
  },
  {
    id: 'frotas',
    label: 'Gestão de Frota',
    description: 'Veículos, máquinas, abastecimentos, manutenções e pneus',
  },
  {
    id: 'cadastros_base',
    label: 'Cadastros & Configurações',
    description: 'Centros de custo, plano de contas, formas de pagamento e permissões',
  },
  {
    id: 'configuracoes',
    label: 'Dados da Empresa',
    description: 'Perfil fiscal da empresa, certificado A1, logotipo e backup',
    alwaysEnabled: true,
  },
];

export const ALL_SIDEBAR_MODULE_IDS: string[] = SIDEBAR_MODULE_OPTIONS.map((m) => m.id);
export const ALWAYS_ACCESSIBLE_MODULE_IDS: string[] = ['dashboard', 'configuracoes'];

export interface SegmentPresetDef {
  id: SubscriberSegmentProfile;
  label: string;
  shortLabel: string;
  description: string;
  modules: string[];
}

export const SEGMENT_PRESETS: Record<SubscriberSegmentProfile, SegmentPresetDef> = {
  completo: {
    id: 'completo',
    label: 'Completo (Full ERP)',
    shortLabel: 'Completo (Full ERP)',
    description: 'Habilita todos os módulos do sistema.',
    modules: [...ALL_SIDEBAR_MODULE_IDS],
  },
  comercio_varejo: {
    id: 'comercio_varejo',
    label: 'Comércio, Mercado, Padaria & Varejo',
    shortLabel: 'Comércio & Varejo',
    description:
      'Habilita Dashboard, Venda (PDV), Estoque, Financeiro, Despesas, Fiscal & Notas, Clientes, Fornecedores & Transportadoras, RH, Relatórios e Cadastros & Configurações (oculta Prestação de Serviços, Almoxarifado e Gestão de Frota).',
    modules: [
      'dashboard',
      'venda',
      'estoque',
      'financeiro',
      'despesas',
      'fiscal',
      'clientes',
      'fornecedores',
      'rh',
      'relatorios',
      'cadastros_base',
      'configuracoes',
    ],
  },
  transportadora_logistica: {
    id: 'transportadora_logistica',
    label: 'Transportadora & Logística',
    shortLabel: 'Transportadora & Logística',
    description:
      'Habilita Dashboard, Fiscal & Notas, Gestão de Frota, Almoxarifado, Financeiro, Despesas, Clientes, Fornecedores & Transportadoras, RH, Relatórios e Cadastros & Configurações (oculta Venda (PDV), Estoque e Prestação de Serviços).',
    modules: [
      'dashboard',
      'fiscal',
      'frotas',
      'almoxarifado',
      'financeiro',
      'despesas',
      'clientes',
      'fornecedores',
      'rh',
      'relatorios',
      'cadastros_base',
      'configuracoes',
    ],
  },
  servicos_operacoes: {
    id: 'servicos_operacoes',
    label: 'Prestação de Serviços & Operações',
    shortLabel: 'Prestação de Serviços',
    description:
      'Habilita todos os módulos operacionais (Prestação de Serviços, Gestão de Frota, Estoque, Almoxarifado, Financeiro, Despesas, Fiscal & Notas, RH, Clientes, Fornecedores & Transportadoras, Relatórios e Cadastros & Configurações).',
    modules: [
      'dashboard',
      'servicos',
      'frotas',
      'estoque',
      'almoxarifado',
      'financeiro',
      'despesas',
      'fiscal',
      'rh',
      'clientes',
      'fornecedores',
      'relatorios',
      'cadastros_base',
      'configuracoes',
    ],
  },
  personalizado: {
    id: 'personalizado',
    label: 'Personalizado (Seleção Manual)',
    shortLabel: 'Personalizado',
    description:
      'Permite marcar ou desmarcar manualmente exatamente quais módulos ficarão visíveis no menu lateral.',
    modules: [...ALL_SIDEBAR_MODULE_IDS],
  },
};

export const SEGMENT_PRESET_LIST: SegmentPresetDef[] = [
  SEGMENT_PRESETS.completo,
  SEGMENT_PRESETS.comercio_varejo,
  SEGMENT_PRESETS.transportadora_logistica,
  SEGMENT_PRESETS.servicos_operacoes,
  SEGMENT_PRESETS.personalizado,
];

export function isValidSegmentProfile(val: unknown): val is SubscriberSegmentProfile {
  return (
    val === 'completo' ||
    val === 'comercio_varejo' ||
    val === 'transportadora_logistica' ||
    val === 'servicos_operacoes' ||
    val === 'personalizado'
  );
}

export function normalizeEnabledModules(modules?: string[] | null): string[] {
  const validSet = new Set(ALL_SIDEBAR_MODULE_IDS);
  const input = Array.isArray(modules) ? modules : [];
  const filtered = input
    .map((id) => String(id || '').trim())
    .filter((id) => validSet.has(id));

  const unique = new Set<string>(filtered);
  // Dashboard e Dados da Empresa sempre permanecem acessíveis
  ALWAYS_ACCESSIBLE_MODULE_IDS.forEach((reqId) => unique.add(reqId));

  // Mantém ordenação previsível conforme ALL_SIDEBAR_MODULE_IDS
  return ALL_SIDEBAR_MODULE_IDS.filter((id) => unique.has(id));
}

export function resolveSegmentModulesConfig(
  segmentProfile?: unknown,
  enabledModules?: string[] | null
): SubscriberModulesConfig {
  const segment: SubscriberSegmentProfile = isValidSegmentProfile(segmentProfile)
    ? segmentProfile
    : 'completo';

  if (segment === 'personalizado') {
    const customList =
      Array.isArray(enabledModules) && enabledModules.length > 0
        ? normalizeEnabledModules(enabledModules)
        : [...ALL_SIDEBAR_MODULE_IDS];
    return {
      segmentProfile: 'personalizado',
      enabledModules: customList,
    };
  }

  return {
    segmentProfile: segment,
    enabledModules: normalizeEnabledModules(SEGMENT_PRESETS[segment].modules),
  };
}

export function getSegmentLabel(segmentProfile?: unknown): string {
  if (isValidSegmentProfile(segmentProfile)) {
    return SEGMENT_PRESETS[segmentProfile].label;
  }
  return SEGMENT_PRESETS.completo.label;
}

export function getSegmentShortLabel(segmentProfile?: unknown): string {
  if (isValidSegmentProfile(segmentProfile)) {
    return SEGMENT_PRESETS[segmentProfile].shortLabel;
  }
  return SEGMENT_PRESETS.completo.shortLabel;
}

function parseModulesConfigRaw(raw: string | null): SubscriberModulesConfig | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!isValidSegmentProfile(parsed.segmentProfile) && !Array.isArray(parsed.enabledModules)) {
      return null;
    }
    const resolved = resolveSegmentModulesConfig(parsed.segmentProfile, parsed.enabledModules);
    return {
      ...resolved,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : undefined,
    };
  } catch {
    return null;
  }
}

export function dispatchModulesUpdatedEvent(config?: SubscriberModulesConfig | null): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(SUBSCRIBER_MODULES_UPDATED_EVENT, { detail: config }));
  } catch {}
}

export function getStoredActiveAccountModulesConfig(): SubscriberModulesConfig {
  try {
    if (typeof localStorage === 'undefined') {
      return resolveSegmentModulesConfig('completo');
    }
    const parsed = parseModulesConfigRaw(localStorage.getItem(SUBSCRIBER_MODULES_STORAGE_KEY));
    if (parsed) return parsed;
  } catch {}
  return resolveSegmentModulesConfig('completo');
}

export function saveStoredActiveAccountModulesConfig(
  input: Pick<SubscriberModulesConfig, 'segmentProfile' | 'enabledModules'>
): SubscriberModulesConfig {
  const resolved = resolveSegmentModulesConfig(input.segmentProfile, input.enabledModules);
  const payload: SubscriberModulesConfig = {
    ...resolved,
    updatedAt: new Date().toISOString(),
  };

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SUBSCRIBER_MODULES_STORAGE_KEY, JSON.stringify(payload));
    }
  } catch (err) {
    console.error('Erro ao salvar módulos ativos da conta no localStorage:', err);
  }

  dispatchModulesUpdatedEvent(payload);
  return payload;
}

export function setImpersonatedModulesConfig(
  input: Pick<SubscriberModulesConfig, 'segmentProfile' | 'enabledModules'> | null
): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (!input) {
      localStorage.removeItem(IMPERSONATED_MODULES_STORAGE_KEY);
      dispatchModulesUpdatedEvent(getStoredActiveAccountModulesConfig());
      return;
    }
    const resolved = resolveSegmentModulesConfig(input.segmentProfile, input.enabledModules);
    const payload: SubscriberModulesConfig = {
      ...resolved,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(IMPERSONATED_MODULES_STORAGE_KEY, JSON.stringify(payload));
    dispatchModulesUpdatedEvent(payload);
  } catch (err) {
    console.error('Erro ao aplicar módulos de personificação:', err);
  }
}

function findSubscriberInLocalStorageByIdOrEmail(
  id?: string | null,
  email?: string | null
): Subscriber | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem('silagem_master_subscribers_v2');
    if (!raw) return null;
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return null;
    const cleanId = String(id || '').trim();
    const cleanEmail = String(email || '').trim().toLowerCase();
    return (
      list.find(
        (s: any) =>
          s &&
          ((cleanId && String(s.id || '').trim() === cleanId) ||
            (cleanEmail && String(s.responsibleEmail || '').trim().toLowerCase() === cleanEmail))
      ) || null
    );
  } catch {
    return null;
  }
}

/**
 * Resolve a configuração efetiva de módulos ativos no ERP em execução:
 * 1. Durante personificação pelo Master Admin, usa o perfil do assinante personificado.
 * 2. Para conta ativa normal, lê `agrocontrol_subscriber_modules` (ou faz fallback ao perfil/assinante).
 */
export function getEffectiveModulesConfig(
  companyProfile?: CompanyProfile | null
): SubscriberModulesConfig {
  try {
    if (typeof localStorage !== 'undefined') {
      const isImpersonating =
        localStorage.getItem('is_admin_impersonating') === 'true' ||
        Boolean(localStorage.getItem(IMPERSONATED_MODULES_STORAGE_KEY));

      if (isImpersonating) {
        const impParsed = parseModulesConfigRaw(
          localStorage.getItem(IMPERSONATED_MODULES_STORAGE_KEY)
        );
        if (impParsed) return impParsed;

        const impId =
          localStorage.getItem('admin_impersonated_company_id') ||
          localStorage.getItem('impersonated_subscriber_id');
        const impEmail = localStorage.getItem('impersonated_subscriber_email');
        const matchedSub = findSubscriberInLocalStorageByIdOrEmail(impId, impEmail);
        if (matchedSub && (matchedSub.segmentProfile || matchedSub.enabledModules)) {
          return resolveSegmentModulesConfig(matchedSub.segmentProfile, matchedSub.enabledModules);
        }
      }

      const activeAccountRaw = localStorage.getItem(SUBSCRIBER_MODULES_STORAGE_KEY);
      const activeAccountParsed = parseModulesConfigRaw(activeAccountRaw);
      if (activeAccountParsed) {
        return activeAccountParsed;
      }

      // Fallback para o assinante logado caso agrocontrol_subscriber_modules ainda não tenha sido gravado
      const activeSubId = localStorage.getItem('silagem_active_subscriber_id');
      const activeEmail =
        localStorage.getItem('silagem_active_user_email') ||
        localStorage.getItem('silagem_active_subscriber_email') ||
        companyProfile?.email;
      const activeSub = findSubscriberInLocalStorageByIdOrEmail(activeSubId, activeEmail);
      if (activeSub && (activeSub.segmentProfile || activeSub.enabledModules)) {
        return resolveSegmentModulesConfig(activeSub.segmentProfile, activeSub.enabledModules);
      }
    }
  } catch {}

  if (companyProfile && (companyProfile.segmentProfile || companyProfile.enabledModules)) {
    return resolveSegmentModulesConfig(companyProfile.segmentProfile, companyProfile.enabledModules);
  }

  return resolveSegmentModulesConfig('completo');
}

/**
 * Mapeia qualquer tabId / sub-rota do ERP para o ID canônico de módulo do menu lateral.
 */
export function mapTabToCanonicalModuleId(tabId: string): string {
  const clean = String(tabId || '').trim().toLowerCase();
  if (!clean || clean === 'home' || clean === 'dashboard') return 'dashboard';
  if (clean === 'configuracoes' || clean === 'empresa') return 'configuracoes';
  if (clean === 'servicos') return 'servicos';
  if (clean === 'venda' || clean === 'vendas') return 'venda';
  if (clean === 'estoque') return 'estoque';
  if (clean === 'almoxarifado') return 'almoxarifado';
  if (
    clean === 'financeiro' ||
    clean === 'contas' ||
    clean === 'bancos' ||
    clean === 'pagar' ||
    clean === 'receber'
  ) {
    return 'financeiro';
  }
  if (clean === 'despesas') return 'despesas';
  if (
    clean === 'fiscal' ||
    clean === 'nfe' ||
    clean === 'documentos_entrada' ||
    clean === 'entradas' ||
    clean === 'nfe_importar' ||
    clean === 'nfe_notas'
  ) {
    return 'fiscal';
  }
  if (
    clean === 'rh' ||
    clean === 'funcionarios' ||
    clean === 'folha' ||
    clean === 'colaboradores'
  ) {
    return 'rh';
  }
  if (clean === 'relatorios' || clean === 'reports') return 'relatorios';
  if (clean === 'clientes' || clean === 'crm') return 'clientes';
  if (clean === 'fornecedores') return 'fornecedores';
  if (
    clean === 'frotas' ||
    clean === 'frota' ||
    clean === 'veiculos' ||
    clean === 'manutencoes' ||
    clean === 'combustivel' ||
    clean === 'motoristas' ||
    clean === 'equipe' ||
    clean === 'rodizio' ||
    clean === 'rodizio_pneus'
  ) {
    return 'frotas';
  }
  if (
    clean === 'cadastros_base' ||
    clean.startsWith('cadastros_base_') ||
    clean === 'centros_custo' ||
    clean === 'plano_contas' ||
    clean === 'cargos_permissoes'
  ) {
    return 'cadastros_base';
  }
  return clean;
}

export function isModuleEnabledForSubscriber(
  tabId: string,
  config?: SubscriberModulesConfig | null
): boolean {
  const raw = String(tabId || '').trim().toLowerCase();
  // Dashboard, Home, Dados da Empresa e tela de acesso restrito por cargo são sempre acessíveis no nível de segmento
  if (
    !raw ||
    raw === 'home' ||
    raw === 'dashboard' ||
    raw === 'configuracoes' ||
    raw === 'empresa' ||
    raw.startsWith('acesso_restrito_')
  ) {
    return true;
  }

  const canonical = mapTabToCanonicalModuleId(raw);
  if (ALWAYS_ACCESSIBLE_MODULE_IDS.includes(canonical)) {
    return true;
  }

  const effective = config || getEffectiveModulesConfig();
  const enabledList = Array.isArray(effective?.enabledModules)
    ? effective.enabledModules
    : ALL_SIDEBAR_MODULE_IDS;

  return enabledList.includes(canonical);
}
