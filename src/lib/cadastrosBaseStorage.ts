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

// Cargos oficiais consolidados e categorizados por Setor
export const INITIAL_CARGOS_PERMISSOES: CargoPermissao[] = [
  // 1. DIRETORIA & ADMINISTRATIVO
  {
    id: 'cargo-admin',
    nome: 'Administrador Geral',
    setor: 'DIRETORIA & ADMINISTRATIVO',
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
    id: 'cargo-administrador',
    nome: 'Administrador',
    setor: 'DIRETORIA & ADMINISTRATIVO',
    descricao: 'Acesso corporativo às configurações da empresa e cadastros base.',
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
    id: 'cargo-recepcionista',
    nome: 'Recepcionista',
    setor: 'DIRETORIA & ADMINISTRATIVO',
    descricao: 'Atendimento geral, recepção e parametrizações cadastrais.',
    permissoes: {
      financeiro: false,
      frotas: false,
      rh: false,
      estoque: false,
      empresa: true,
    },
    createdAt: '2026-01-01T00:00:00.000Z',
  },

  // 2. FINANCEIRO & CONTABILIDADE
  {
    id: 'cargo-financeiro',
    nome: 'Financeiro',
    setor: 'FINANCEIRO & CONTABILIDADE',
    descricao: 'Contas a pagar/receber, conciliação bancária, fluxo de caixa e DRE.',
    permissoes: {
      financeiro: true,
      frotas: false,
      rh: false,
      estoque: false,
      empresa: false,
    },
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'cargo-aux-fin',
    nome: 'Auxiliar Financeiro',
    setor: 'FINANCEIRO & CONTABILIDADE',
    descricao: 'Contas a pagar, a receber, conciliação, notas e apoio fiscal.',
    permissoes: {
      financeiro: true,
      frotas: false,
      rh: false,
      estoque: true,
      empresa: false,
    },
    createdAt: '2026-01-01T00:00:00.000Z',
  },

  // 3. TRANSPORTE & LOGÍSTICA
  {
    id: 'cargo-motorista',
    nome: 'Motorista',
    setor: 'TRANSPORTE & LOGÍSTICA',
    descricao: 'Condução de caminhões e veículos, registros de viagem e frota.',
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
    id: 'cargo-motorista-caminhao',
    nome: 'Motorista de Caminhão',
    setor: 'TRANSPORTE & LOGÍSTICA',
    descricao: 'Transporte pesado de forragem, transbordo e fretes rodoviários.',
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
    id: 'cargo-agenciador',
    nome: 'Agenciador',
    setor: 'TRANSPORTE & LOGÍSTICA',
    descricao: 'Intermediação e agenciamento de transporte e frentes de silagem.',
    permissoes: {
      financeiro: false,
      frotas: true,
      rh: false,
      estoque: false,
      empresa: false,
    },
    createdAt: '2026-01-01T00:00:00.000Z',
  },

  // 4. CAMPO & SILAGEM
  {
    id: 'cargo-gerente-op',
    nome: 'Gerente Operacional',
    setor: 'CAMPO & SILAGEM',
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
    id: 'cargo-op-forrageira',
    nome: 'Operador de Forrageira',
    setor: 'CAMPO & SILAGEM',
    descricao: 'Operação de colhedoras e ensiladeiras autopropelidas de forragem.',
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
    id: 'cargo-op-trator',
    nome: 'Operador de trator',
    setor: 'CAMPO & SILAGEM',
    descricao: 'Operação de tratores agrícolas para compactação e apoio de silagem.',
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
    setor: 'CAMPO & SILAGEM',
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
    id: 'cargo-aux-producao',
    nome: 'Auxiliar de produção',
    setor: 'CAMPO & SILAGEM',
    descricao: 'Apoio operacional no campo, fechamento de silos e lonamento.',
    permissoes: {
      financeiro: false,
      frotas: true,
      rh: false,
      estoque: false,
      empresa: false,
    },
    createdAt: '2026-01-01T00:00:00.000Z',
  },

  // 5. OFICINA & MANUTENÇÃO
  {
    id: 'cargo-mecanico',
    nome: 'Mecanico',
    setor: 'OFICINA & MANUTENÇÃO',
    descricao: 'Manutenção preventiva e corretiva de máquinas agrícolas e frotas.',
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
    id: 'cargo-mecanico-interno',
    nome: 'Mecanico interno',
    setor: 'OFICINA & MANUTENÇÃO',
    descricao: 'Serviços mecânicos internos e manutenção de pátio na oficina mecânica.',
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
    id: 'cargo-mecanico-especialista',
    nome: 'Mecânico Especialista',
    setor: 'OFICINA & MANUTENÇÃO',
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

  // 6. RECURSOS HUMANOS
  {
    id: 'cargo-rh',
    nome: 'Analista de RH',
    setor: 'RECURSOS HUMANOS',
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

/**
 * Consolida e higieniza a lista de cargos:
 * 1. Remove duplicidades exatas e aliases obsoletos (como 'Escritorio').
 * 2. Garante a inclusão de todos os cargos oficiais da INITIAL_CARGOS_PERMISSOES.
 * 3. Garante que TODO cargo possua setor oficial em caixa alta mapeado.
 * 4. Resolve IDs canônicos para evitar colisões herdadas do LocalStorage (ex: cargo-motorista, cargo-mecanico).
 * 5. Garante unicidade estrita de IDs e nomes.
 */
export function consolidateCargosList(existingList: CargoPermissao[]): CargoPermissao[] {
  const norm = (s: string) => (s || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const result: CargoPermissao[] = [];
  const seenKeys = new Set<string>();
  const seenIds = new Set<string>();

  // Mapeia nomes para seus IDs canônicos oficiais e resolve colisões herdadas do localStorage
  const getCanonicalId = (cleanNome: string, currentId?: string): string => {
    const k = norm(cleanNome);
    if (k === 'administrador geral') return 'cargo-admin';
    if (k === 'administrador') return 'cargo-administrador';
    if (k === 'recepcionista') return 'cargo-recepcionista';
    if (k === 'financeiro') return 'cargo-financeiro';
    if (k === 'auxiliar financeiro') return 'cargo-aux-fin';
    if (k === 'motorista de caminhao') return 'cargo-motorista-caminhao';
    if (k === 'motorista') return 'cargo-motorista';
    if (k === 'agenciador') return 'cargo-agenciador';
    if (k === 'gerente operacional') return 'cargo-gerente-op';
    if (k === 'operador de forrageira') return 'cargo-op-forrageira';
    if (k === 'operador de trator') return 'cargo-op-trator';
    if (k === 'operador de maquinas') return 'cargo-operador';
    if (k === 'auxiliar de producao') return 'cargo-aux-producao';
    if (k === 'mecanico especialista') return 'cargo-mecanico-especialista';
    if (k === 'mecanico interno') return 'cargo-mecanico-interno';
    if (k === 'mecanico') return 'cargo-mecanico';
    if (k === 'analista de rh') return 'cargo-rh';

    if (currentId) {
      if (currentId === 'cargo-motorista' && k !== 'motorista') {
        return k.includes('caminh') ? 'cargo-motorista-caminhao' : 'cargo-motorista-outro';
      }
      if (currentId === 'cargo-mecanico' && k !== 'mecanico') {
        return k.includes('especial') ? 'cargo-mecanico-especialista' : (k.includes('intern') ? 'cargo-mecanico-interno' : 'cargo-mecanico-outro');
      }
      return currentId;
    }
    return `cargo-${k.replace(/[^a-z0-9]+/g, '-')}`;
  };

  const getCanonicalSetor = (name: string, currentSetor?: string): string => {
    if (currentSetor && currentSetor.trim() && currentSetor.toUpperCase() !== 'GERAL') {
      return currentSetor.trim().toUpperCase();
    }
    const k = norm(name);
    if (k.includes('admin') || k.includes('recepc') || k.includes('diretor')) return 'DIRETORIA & ADMINISTRATIVO';
    if (k.includes('finan') || k.includes('contab')) return 'FINANCEIRO & CONTABILIDADE';
    if (k.includes('rh') || k.includes('recursos') || k.includes('pessoal')) return 'RECURSOS HUMANOS';
    if (k.includes('motor') || k.includes('agenc') || k.includes('transp') || k.includes('caminh')) return 'TRANSPORTE & LOGÍSTICA';
    if (k.includes('mecan') || k.includes('oficina') || k.includes('manuten')) return 'OFICINA & MANUTENÇÃO';
    return 'CAMPO & SILAGEM';
  };

  const ensureUniqueId = (candidateId: string): string => {
    let id = candidateId;
    let counter = 1;
    while (seenIds.has(id)) {
      id = `${candidateId}-${counter++}`;
    }
    seenIds.add(id);
    return id;
  };

  // 1. Processa registros já salvos no LocalStorage (mantém dados e permissões personalizadas)
  (existingList || []).forEach(item => {
    if (!item || !item.nome) return;
    const cleanNome = item.nome.trim();
    const key = norm(cleanNome);

    // Elimina explicitamente o termo obsoleto 'escritorio'
    if (key === 'escritorio') return;

    if (!seenKeys.has(key)) {
      seenKeys.add(key);

      const candidateId = getCanonicalId(cleanNome, item.id);
      const uniqueId = ensureUniqueId(candidateId);

      result.push({
        ...item,
        id: uniqueId,
        nome: cleanNome,
        setor: getCanonicalSetor(cleanNome, item.setor),
        permissoes: item.permissoes || {
          financeiro: false,
          frotas: true,
          rh: false,
          estoque: false,
          empresa: false,
        },
      });
    }
  });

  // 2. Insere automaticamente todos os cargos oficiais complementares faltantes
  INITIAL_CARGOS_PERMISSOES.forEach(official => {
    const key = norm(official.nome);
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      const uniqueId = ensureUniqueId(official.id);
      result.push({ ...official, id: uniqueId });
    } else {
      // Se já existia, atualiza o setor para o padrão formal caso estivesse vazio ou genérico
      const existing = result.find(r => norm(r.nome) === key);
      if (existing && (!existing.setor || existing.setor === 'Geral')) {
        existing.setor = official.setor;
      }
    }
  });

  // 3. Garantia final de unicidade absoluta de IDs
  const finalSeenIds = new Set<string>();
  result.forEach((item, idx) => {
    if (finalSeenIds.has(item.id)) {
      item.id = `${item.id}-${idx}`;
    }
    finalSeenIds.add(item.id);
  });

  // 4. ORDEM ALFABÉTICA COMPULSÓRIA (PADRÃO DO SISTEMA): De A a Z pelo nome
  return result.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function getStoredCargosPermissoes(): CargoPermissao[] {
  try {
    const raw = localStorage.getItem(CADASTROS_STORAGE_KEYS.CARGOS_PERMISSOES);
    let parsed: CargoPermissao[] = [];
    if (raw) {
      try {
        const json = JSON.parse(raw);
        if (Array.isArray(json)) parsed = json;
      } catch {}
    }

    const consolidated = consolidateCargosList(parsed);
    const jsonStr = JSON.stringify(consolidated);
    if (!raw || raw !== jsonStr) {
      try {
        localStorage.setItem(CADASTROS_STORAGE_KEYS.CARGOS_PERMISSOES, jsonStr);
      } catch {}
    }
    return consolidated;
  } catch (err) {
    console.error('Erro ao ler cargos_permissoes do localStorage:', err);
    saveStoredCargosPermissoes(INITIAL_CARGOS_PERMISSOES);
    return INITIAL_CARGOS_PERMISSOES;
  }
}

export function saveStoredCargosPermissoes(cargos: CargoPermissao[]): void {
  try {
    const consolidated = consolidateCargosList(cargos);
    localStorage.setItem(CADASTROS_STORAGE_KEYS.CARGOS_PERMISSOES, JSON.stringify(consolidated));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('colaca_silagem_cargos_updated', { detail: consolidated }));
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

  // 1. Prioriza correspondência EXATA por nome ou ID
  let found = cargos.find(c => {
    const cNome = c.nome.trim().toLowerCase();
    const cId = c.id.toLowerCase();
    return cNome === cleanRole || cId === cleanRole || cNome === primaryRole || cId === primaryRole;
  });

  // 2. Se não encontrar exato, busca pelo nome mais específico (ordem decrescente de caracteres)
  if (!found) {
    const sortedByLen = [...cargos].sort((a, b) => b.nome.length - a.nome.length);
    found = sortedByLen.find(c => {
      const cNome = c.nome.trim().toLowerCase();
      return cleanRole === cNome || cleanRole.includes(cNome) || cNome.includes(cleanRole);
    });
  }

  const isAdminRole = cleanRole.includes('admin') || cleanRole.includes('diretor') || (found && found.nome.toLowerCase().includes('admin'));

  if (found) {
    return {
      cargoId: found.id,
      permissions: isAdminRole ? { ...DEFAULT_ADMIN_PERMISSIONS, ...found.permissoes } : { ...found.permissoes },
      setor: found.setor,
    };
  }

  // Fallback para cargos comuns se não encontrar o registro exato
  if (isAdminRole) {
    return { permissions: { ...DEFAULT_ADMIN_PERMISSIONS }, setor: 'DIRETORIA & ADMINISTRATIVO' };
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
