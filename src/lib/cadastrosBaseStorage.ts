import { 
  CargoPermissao, 
  RolePermissions, 
  CostCenter, 
  PlanoContasEFormasData, 
  SimulatedUserSession 
} from '../types';
import { getStoredEmployees, saveStoredEmployees } from './storage';

export type { SimulatedUserSession };

export const CADASTROS_STORAGE_KEYS = {
  CENTROS_CUSTO: 'colaca_silagem_centros_custo',
  PLANO_CONTAS: 'colaca_silagem_plano_contas',
  CARGOS_PERMISSOES: 'colaca_silagem_cargos_permissoes',
  FUNCIONARIOS: 'colaca_silagem_funcionarios',
  ACTIVE_SESSION: 'colaca_silagem_active_session',
};

// Permissões padrão completas
export const DEFAULT_ADMIN_PERMISSIONS: RolePermissions = {
  financeiro: true,
  frotas: true,
  rh: true,
  estoque: true,
  empresa: true,
};

// Cargos iniciais de referência
export const INITIAL_CARGOS_PERMISSOES: CargoPermissao[] = [
  {
    id: 'cargo-admin',
    nome: 'Administrador Geral',
    setor: 'Diretoria & Administrativo',
    descricao: 'Acesso irrestrito a todas as operações, dados financeiros e cadastrais.',
    permissoes: {
      financeiro: true,
      frotas: true,
      rh: true,
      estoque: true,
      empresa: true,
    },
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'cargo-gerente-op',
    nome: 'Gerente Operacional',
    setor: 'Operações de Campo',
    descricao: 'Gestão de equipes de colheita, máquinas, estoques e recursos humanos operacionais.',
    permissoes: {
      financeiro: false,
      frotas: true,
      rh: true,
      estoque: true,
      empresa: false,
    },
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'cargo-motorista',
    nome: 'Motorista de Caminhão',
    setor: 'Transporte & Logística',
    descricao: 'Acesso restrito ao módulo de frotas e apontamentos de veículos e viagens.',
    permissoes: {
      financeiro: false,
      frotas: true,
      rh: false,
      estoque: false,
      empresa: false,
    },
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'cargo-operador',
    nome: 'Operador de Máquinas',
    setor: 'Campo & Silagem',
    descricao: 'Operação de colhedoras, tratores e acompanhamento de manutenção de frota.',
    permissoes: {
      financeiro: false,
      frotas: true,
      rh: false,
      estoque: false,
      empresa: false,
    },
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'cargo-aux-fin',
    nome: 'Auxiliar Financeiro',
    setor: 'Financeiro & Contabilidade',
    descricao: 'Contas a pagar, a receber, fluxo de caixa, conciliação e DRE.',
    permissoes: {
      financeiro: true,
      frotas: false,
      rh: false,
      estoque: true,
      empresa: false,
    },
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'cargo-mecanico',
    nome: 'Mecânico Especialista',
    setor: 'Oficina & Manutenção',
    descricao: 'Ordens de serviço de veículos, solicitações de peças e almoxarifado.',
    permissoes: {
      financeiro: false,
      frotas: true,
      rh: false,
      estoque: true,
      empresa: false,
    },
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'cargo-rh',
    nome: 'Analista de RH',
    setor: 'Recursos Humanos',
    descricao: 'Gestão da folha de pagamento, férias, atestados, faltas e fichas cadastrais.',
    permissoes: {
      financeiro: false,
      frotas: false,
      rh: true,
      estoque: false,
      empresa: false,
    },
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

// Centros de custo iniciais
export const INITIAL_CENTROS_CUSTO: CostCenter[] = [
  { id: 'cc-sede', name: 'Sede Administrativa', type: 'administrativo', active: true },
  { id: 'cc-lavoura', name: 'Lavoura - Safra Milho', type: 'operacional', active: true },
  { id: 'cc-frota', name: 'Frota & Transporte', type: 'operacional', active: true },
  { id: 'cc-oficina', name: 'Oficina Mecânica', type: 'manutencao', active: true },
  { id: 'cc-colheita', name: 'Campo - Ensilagem e Colheita', type: 'operacional', active: true },
];

// Plano de Contas & Formas padrão
export const INITIAL_PLANO_CONTAS_E_FORMAS: PlanoContasEFormasData = {
  categorias: [
    { id: 'cat-rec-1', codigo: '1.01', nome: 'Serviços Prestados de Silagem', tipo: 'receita', descricao: 'Prestação de serviços de corte e compactação', ativo: true },
    { id: 'cat-rec-2', codigo: '1.02', nome: 'Venda de Silagem Pronta', tipo: 'receita', descricao: 'Venda de excedente ou silagem ensacada', ativo: true },
    { id: 'cat-rec-3', codigo: '1.03', nome: 'Fretes & Locações de Equipamentos', tipo: 'receita', descricao: 'Transporte terceirizado e locações', ativo: true },
    { id: 'cat-desp-1', codigo: '2.01', nome: 'Combustíveis e Lubrificantes', tipo: 'despesa', descricao: 'Diesel S10, gasolina, óleos hidráulicos e graxas', ativo: true },
    { id: 'cat-desp-2', codigo: '2.02', nome: 'Manutenção Preventiva e Corretiva', tipo: 'despesa', descricao: 'Peças, serviços mecânicos e torno', ativo: true },
    { id: 'cat-desp-3', codigo: '2.03', nome: 'Folha de Pagamento & Salários', tipo: 'despesa', descricao: 'Salários base, diárias e comissões', ativo: true },
    { id: 'cat-desp-4', codigo: '2.04', nome: 'Pneus, Rodagem & Reformas', tipo: 'despesa', descricao: 'Pneus novos, recapagens e vulcanizações', ativo: true },
    { id: 'cat-desp-5', codigo: '2.05', nome: 'Encargos, Tributos & Licenciamento', tipo: 'despesa', descricao: 'IPVA, seguro, taxas rodoviárias e impostos', ativo: true },
    { id: 'cat-desp-6', codigo: '2.06', nome: 'Almoxarifado & Insumos Operacionais', tipo: 'despesa', descricao: 'Lonas de silagem, inoculantes, EPIs e ferramentas', ativo: true },
    { id: 'cat-desp-7', codigo: '2.07', nome: 'Despesas Administrativas & Escritório', tipo: 'despesa', descricao: 'Software, internet, contabilidade e materiais', ativo: true },
  ],
  formasPagamento: [
    { id: 'fp-pix', codigo: 'PIX', nome: 'PIX Instantâneo', tipo: 'pix', prazoDias: 0, taxaPercentual: 0, ativo: true },
    { id: 'fp-boleto', codigo: 'BOL', nome: 'Boleto Bancário', tipo: 'boleto', prazoDias: 30, taxaPercentual: 1.5, ativo: true },
    { id: 'fp-ted', codigo: 'TED', nome: 'Transferência Bancária (TED/DOC)', tipo: 'transferencia', prazoDias: 0, taxaPercentual: 0, ativo: true },
    { id: 'fp-cartao-cred', codigo: 'CC', nome: 'Cartão de Crédito Corporativo', tipo: 'cartao_credito', prazoDias: 30, taxaPercentual: 2.9, ativo: true },
    { id: 'fp-dinheiro', codigo: 'DIN', nome: 'Dinheiro em Espécie', tipo: 'dinheiro', prazoDias: 0, taxaPercentual: 0, ativo: true },
    { id: 'fp-cheque-vista', codigo: 'CHQ-V', nome: 'Cheque à Vista', tipo: 'cheque', prazoDias: 0, taxaPercentual: 0, ativo: true },
    { id: 'fp-cheque-pre', codigo: 'CHQ-P', nome: 'Cheque Pré-datado', tipo: 'cheque', prazoDias: 30, taxaPercentual: 0, ativo: true },
  ],
};

/* =========================================================
   1. CARGOS, SETORES & PERMISSÕES
   ========================================================= */

export function getStoredCargosPermissoes(): CargoPermissao[] {
  try {
    const raw = localStorage.getItem(CADASTROS_STORAGE_KEYS.CARGOS_PERMISSOES);
    if (!raw) {
      saveStoredCargosPermissoes(INITIAL_CARGOS_PERMISSOES);
      return INITIAL_CARGOS_PERMISSOES;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      saveStoredCargosPermissoes(INITIAL_CARGOS_PERMISSOES);
      return INITIAL_CARGOS_PERMISSOES;
    }
    return parsed;
  } catch (err) {
    console.error('Erro ao ler cargos_permissoes do localStorage:', err);
    return INITIAL_CARGOS_PERMISSOES;
  }
}

export function saveStoredCargosPermissoes(cargos: CargoPermissao[]): void {
  try {
    localStorage.setItem(CADASTROS_STORAGE_KEYS.CARGOS_PERMISSOES, JSON.stringify(cargos));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('colaca_silagem_cargos_updated', { detail: cargos }));
    }
  } catch (err) {
    console.error('Erro ao salvar cargos_permissoes no localStorage:', err);
  }
}

/* =========================================================
   2. CENTROS DE CUSTO
   ========================================================= */

export function getStoredCentrosCusto(): CostCenter[] {
  try {
    const raw = localStorage.getItem(CADASTROS_STORAGE_KEYS.CENTROS_CUSTO);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    // Fallback para chave legado se houver
    const legacy = localStorage.getItem('silagem_facil_clean_v1_cost_centers');
    if (legacy) {
      const parsedLegacy = JSON.parse(legacy);
      if (Array.isArray(parsedLegacy) && parsedLegacy.length > 0) {
        saveStoredCentrosCusto(parsedLegacy);
        return parsedLegacy;
      }
    }
    saveStoredCentrosCusto(INITIAL_CENTROS_CUSTO);
    return INITIAL_CENTROS_CUSTO;
  } catch (err) {
    console.error('Erro ao ler centros_custo do localStorage:', err);
    return INITIAL_CENTROS_CUSTO;
  }
}

export function saveStoredCentrosCusto(centers: CostCenter[]): void {
  try {
    const json = JSON.stringify(centers);
    localStorage.setItem(CADASTROS_STORAGE_KEYS.CENTROS_CUSTO, json);
    localStorage.setItem('silagem_facil_clean_v1_cost_centers', json);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('colaca_silagem_centros_updated', { detail: centers }));
    }
  } catch (err) {
    console.error('Erro ao salvar centros_custo:', err);
  }
}

/* =========================================================
   3. PLANO DE CONTAS & FORMAS DE PAGAMENTO
   ========================================================= */

export function getStoredPlanoContas(): PlanoContasEFormasData {
  try {
    const raw = localStorage.getItem(CADASTROS_STORAGE_KEYS.PLANO_CONTAS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.categorias) && Array.isArray(parsed.formasPagamento)) {
        return parsed;
      }
    }
    saveStoredPlanoContas(INITIAL_PLANO_CONTAS_E_FORMAS);
    return INITIAL_PLANO_CONTAS_E_FORMAS;
  } catch (err) {
    console.error('Erro ao ler plano_contas do localStorage:', err);
    return INITIAL_PLANO_CONTAS_E_FORMAS;
  }
}

export function saveStoredPlanoContas(data: PlanoContasEFormasData): void {
  try {
    localStorage.setItem(CADASTROS_STORAGE_KEYS.PLANO_CONTAS, JSON.stringify(data));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('colaca_silagem_plano_updated', { detail: data }));
    }
  } catch (err) {
    console.error('Erro ao salvar plano_contas:', err);
  }
}

/* =========================================================
   4. SESSÃO ATIVA & CONTROLE DE PERMISSÕES POR CARGO
   ========================================================= */

export const DEFAULT_ACTIVE_SESSION: SimulatedUserSession = {
  type: 'admin',
  name: 'Administrador do Sistema',
  cargoNome: 'Administrador Geral',
  setor: 'Diretoria',
  permissions: DEFAULT_ADMIN_PERMISSIONS,
};

export function getActiveUserSession(): SimulatedUserSession {
  try {
    const raw = localStorage.getItem(CADASTROS_STORAGE_KEYS.ACTIVE_SESSION);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.permissions) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Erro ao carregar active_session:', err);
  }
  return DEFAULT_ACTIVE_SESSION;
}

export function setActiveUserSession(session: SimulatedUserSession): void {
  try {
    localStorage.setItem(CADASTROS_STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(session));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('colaca_silagem_session_updated', { detail: session }));
    }
  } catch (err) {
    console.error('Erro ao salvar active_session:', err);
  }
}

export type ModulePermissionKey = 'financeiro' | 'frotas' | 'rh' | 'estoque' | 'empresa';

/**
 * Validação rigorosa de permissão do usuário ativo na sessão:
 * Se a permissão do módulo for explicitamente 'false', retorna false para interceptação.
 */
export function hasModulePermission(
  moduleKey: ModulePermissionKey, 
  customSession?: SimulatedUserSession
): boolean {
  const session = customSession || getActiveUserSession();
  if (session.type === 'admin') return true;

  if (session.permissions && typeof session.permissions[moduleKey] === 'boolean') {
    return session.permissions[moduleKey];
  }
  return true;
}

/**
 * Associa permissões ao funcionário com base no cargo cadastrado
 */
export function attachCargoPermissionsToEmployee(
  employeeRole: string,
  cargosList?: CargoPermissao[]
): { cargoId?: string; permissions: RolePermissions; setor?: string } {
  const cargos = cargosList || getStoredCargosPermissoes();
  const cleanRole = (employeeRole || '').trim().toLowerCase();
  const primaryRole = cleanRole.split(',')[0].trim();

  const found = cargos.find(c => {
    const cNome = c.nome.trim().toLowerCase();
    const cId = c.id.toLowerCase();
    return (
      cNome === cleanRole || 
      cId === cleanRole ||
      cNome === primaryRole ||
      cId === primaryRole ||
      cleanRole.includes(cNome)
    );
  });

  if (found) {
    return {
      cargoId: found.id,
      permissions: { ...found.permissoes },
      setor: found.setor,
    };
  }

  // Fallback para cargos comuns se não encontrar o registro exato
  if (cleanRole.includes('admin') || cleanRole.includes('diretor')) {
    return { permissions: { ...DEFAULT_ADMIN_PERMISSIONS }, setor: 'Administrativo' };
  }
  if (cleanRole.includes('motorista') || cleanRole.includes('caminhão') || cleanRole.includes('caminhao')) {
    return {
      permissions: { financeiro: false, frotas: true, rh: false, estoque: false, empresa: false },
      setor: 'Transporte',
    };
  }
  if (cleanRole.includes('trator') || cleanRole.includes('operador') || cleanRole.includes('ensiladeira') || cleanRole.includes('forrageira')) {
    return {
      permissions: { financeiro: false, frotas: true, rh: false, estoque: false, empresa: false },
      setor: 'Campo',
    };
  }
  if (cleanRole.includes('mecanic') || cleanRole.includes('mecânic')) {
    return {
      permissions: { financeiro: false, frotas: true, rh: false, estoque: true, empresa: false },
      setor: 'Oficina',
    };
  }
  if (cleanRole.includes('financeiro') || cleanRole.includes('contabil') || cleanRole.includes('contábil')) {
    return {
      permissions: { financeiro: true, frotas: false, rh: false, estoque: true, empresa: false },
      setor: 'Financeiro',
    };
  }

  // Padrão seguro: acesso a frotas básico
  return {
    permissions: { financeiro: false, frotas: true, rh: false, estoque: false, empresa: false },
    setor: 'Geral',
  };
}
