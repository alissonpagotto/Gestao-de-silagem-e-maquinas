import { useEffect, useState, useCallback } from 'react';
import { ASO_EXAM_OPTIONS, ASO_EXAM_PURPOSES, AsoExamOption } from '../components/employees/asoGuideUtils';

export const AUXILIARY_REGISTRIES_UPDATED_EVENT = 'agrocontrol_auxiliary_registries_updated';

export const AUXILIARY_STORAGE_KEYS = {
  UNIDADES_MEDIDA: 'agrocontrol_unidades_medida',
  ALMOXARIFADO_SETORES: 'agrocontrol_almoxarifado_setores',
  TIPOS_COMBUSTIVEL: 'agrocontrol_tipos_combustivel',
  TIPOS_OCORRENCIAS_FALTAS: 'agrocontrol_tipos_ocorrencias_faltas',
  TIPOS_AFASTAMENTO: 'agrocontrol_tipos_afastamento',
  TIPOS_ATESTADOS: 'agrocontrol_tipos_atestados',
  ASO_FINALIDADES: 'agrocontrol_aso_finalidades',
  ASO_EXAMES: 'agrocontrol_aso_exames',
  MARCAS_PNEUS: 'colaca_silagem_marcas_pneus',
  TROCAS_MOTIVOS: 'agrocontrol_trocas_motivos',
  RH_REG_TYPES: 'silagem_facil_custom_reg_types_v3',
  RH_ROLES: 'silagem_facil_custom_roles_v3',
  RH_CONTRACT_TYPES: 'silagem_facil_custom_contract_types_v1',
  PLACAS_TERCEIROS: 'agrocontrol_placas_terceiros',
} as const;

export const AUXILIARY_EVENTS = {
  ALL_UPDATED: AUXILIARY_REGISTRIES_UPDATED_EVENT,
  UNIDADES_UPDATED: 'agrocontrol_unidades_medida_updated',
  SETORES_ALMOX_UPDATED: 'agrocontrol_almoxarifado_setores_updated',
  COMBUSTIVEL_UPDATED: 'agrocontrol_tipos_combustivel_updated',
  OCORRENCIAS_UPDATED: 'agrocontrol_tipos_ocorrencias_faltas_updated',
  AFASTAMENTO_UPDATED: 'agrocontrol_tipos_afastamento_updated',
  ATESTADOS_UPDATED: 'agrocontrol_tipos_atestados_updated',
  ASO_FINALIDADES_UPDATED: 'agrocontrol_aso_finalidades_updated',
  ASO_EXAMES_UPDATED: 'agrocontrol_aso_exames_updated',
  MARCAS_PNEUS_UPDATED: 'agrocontrol_marcas_pneus_updated',
  TROCAS_MOTIVOS_UPDATED: 'agrocontrol_trocas_motivos_updated',
  RH_REG_TYPES_UPDATED: 'silagem_reg_types_updated',
  RH_ROLES_UPDATED: 'silagem_roles_updated',
  RH_CONTRACT_TYPES_UPDATED: 'silagem_contract_types_updated',
  PRODUCT_CLASSIFICATION_UPDATED: 'agrocontrol_produto_classificacao_updated',
  PLACAS_TERCEIROS_UPDATED: 'agrocontrol_placas_terceiros_updated',
} as const;

export interface KeyLabelAuxItem {
  id: string;
  label: string;
}

export const DEFAULT_UNIDADES_MEDIDA: string[] = [
  'UN',
  'KG',
  'LT',
  'GALÃO',
  'GL',
  'SC',
  'M',
  'M2',
  'CX',
  'PAR',
  'TON',
  'ROLO',
  'DOSES',
  'HORAS',
];

export const DEFAULT_ALMOXARIFADO_SETORES: string[] = [
  '01 - PEÇAS & MANUTENÇÃO',
  '02 - LUBRIFICANTES & FILTROS',
  '03 - LONAS & INSUMOS SILAGEM',
  '04 - PNEUS & RODAGEM',
  '05 - FERRAMENTAS & EPIs',
  '06 - ELÉTRICA & HIDRÁULICA',
  'PRESTAÇÃO DE SERVIÇOS',
];

export const DEFAULT_TIPOS_COMBUSTIVEL: string[] = [
  'Diesel S10',
  'Diesel S500',
  'Arla 32 (Granel/Litro)',
  'Arla 32 (Galão 20L)',
  'Gasolina Comum',
  'Etanol',
];

export const DEFAULT_TIPOS_OCORRENCIAS_FALTAS: KeyLabelAuxItem[] = [
  { id: 'injustificada', label: 'Falta Injustificada' },
  { id: 'justificada', label: 'Falta Justificada' },
  { id: 'suspensao', label: 'Suspensão Disciplinar' },
  { id: 'atraso', label: 'Atraso / Saída Antecipada' },
];

export const DEFAULT_TIPOS_AFASTAMENTO: string[] = [
  'Atestado Médico',
  'Acidente de Trabalho (CAT)',
  'Auxílio Doença / INSS',
  'Licença Maternidade/Paternidade',
  'Licença Não Remunerada',
  'Outro',
];

export const DEFAULT_TIPOS_ATESTADOS: string[] = [
  'Atestado Médico',
  'Atestado Odontológico',
  'Declaração de Horas',
  'Acompanhamento Familiar',
  'Licença Maternidade/Paternidade',
  'Outro',
];

export const DEFAULT_TROCA_MOTIVOS_LIST: string[] = [
  'Defeito de Fabricação',
  'Garantia',
  'Peça / Produto Enviado Errado (Divergência no Pedido)',
  'Especificação / Aplicação Incompatível',
  'Tamanho / Modelo Incorreto',
  'Desistência / Troca Comercial',
  'Avaria no Transporte',
];

export const DEFAULT_TIRE_BRANDS_LIST: string[] = [
  'MICHELIN',
  'PIRELLI',
  'BRIDGESTONE',
  'GOODYEAR',
  'FIRESTONE',
  'CONTINENTAL',
  'DUNLOP',
  'TRELLEBORG',
  'ALLIANCE',
  'OUTRO',
];

export const DEFAULT_RH_REG_TYPES: string[] = [
  'Agenciador',
  'Auxiliar',
  'Diarista / Safrista',
  'Funcionário',
  'Mecanico Especialista',
  'Motorista Terceirizado',
  'Prestador de Serviço',
];

export const DEFAULT_RH_ROLES: string[] = [
  'Administrador Geral',
  'Administrador',
  'Recepcionista',
  'Financeiro',
  'Auxiliar Financeiro',
  'Analista de RH',
  'Motorista',
  'Motorista de Caminhão',
  'Agenciador',
  'Gerente Operacional',
  'Operador de Forrageira',
  'Operador de trator',
  'Operador de Máquinas',
  'Auxiliar de produção',
  'Mecanico',
  'Mecanico interno',
  'Mecânico Especialista',
];

export const DEFAULT_RH_CONTRACT_TYPES: string[] = [
  'Registrado (CLT)',
  'Prestador de Serviço (PJ)',
  'Contrato Temporário',
  'Diarista/Informal',
];

export function dispatchAuxiliaryRegistryChange(customEventName?: string, detail?: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    if (customEventName) {
      window.dispatchEvent(new CustomEvent(customEventName, { detail }));
    }
    window.dispatchEvent(new CustomEvent(AUXILIARY_REGISTRIES_UPDATED_EVENT, { detail }));
    window.dispatchEvent(new Event('storage'));
  } catch {
    // ignore dispatch failure
  }
}

function readStringArray(key: string, defaults: string[], upperCase = false): string[] {
  try {
    if (typeof localStorage === 'undefined') return [...defaults];
    const raw = localStorage.getItem(key);
    if (!raw) return [...defaults];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return [...defaults];
    const seen = new Set<string>();
    const result: string[] = [];
    for (const item of parsed) {
      const clean = String(item || '').trim();
      if (!clean) continue;
      const val = upperCase ? clean.toUpperCase() : clean;
      const k = String(val ?? '').toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        result.push(val);
      }
    }
    return result.length > 0 ? result : [...defaults];
  } catch {
    return [...defaults];
  }
}

function saveStringArray(key: string, items: string[], eventName: string, upperCase = false): string[] {
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const item of items) {
    const raw = String(item || '').trim();
    if (!raw) continue;
    const val = upperCase ? raw.toUpperCase() : raw;
    const k = String(val ?? '').toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      cleaned.push(val);
    }
  }
  try {
    localStorage.setItem(key, JSON.stringify(cleaned));
  } catch {
    // ignore
  }
  dispatchAuxiliaryRegistryChange(eventName, cleaned);
  return cleaned;
}

function readKeyLabelArray(key: string, defaults: KeyLabelAuxItem[]): KeyLabelAuxItem[] {
  try {
    if (typeof localStorage === 'undefined') return defaults.map((d) => ({ ...d }));
    const raw = localStorage.getItem(key);
    if (!raw) return defaults.map((d) => ({ ...d }));
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return defaults.map((d) => ({ ...d }));
    const result: KeyLabelAuxItem[] = [];
    const seen = new Set<string>();
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const label = String((item as any).label || '').trim();
      const id = String((item as any).id || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]+/g, '_') || String(label ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_');
      if (!label || !id || seen.has(id)) continue;
      seen.add(id);
      result.push({ id, label });
    }
    return result.length > 0 ? result : defaults.map((d) => ({ ...d }));
  } catch {
    return defaults.map((d) => ({ ...d }));
  }
}

function saveKeyLabelArray(key: string, items: KeyLabelAuxItem[], eventName: string): KeyLabelAuxItem[] {
  const seen = new Set<string>();
  const cleaned: KeyLabelAuxItem[] = [];
  for (const item of items) {
    const label = String(item?.label || '').trim();
    if (!label) continue;
    const rawId = String(item?.id || '').trim() || String(label ?? '').toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    const id = String(rawId ?? '').toLowerCase().replace(/[^a-z0-9_]+/g, '_') || `item_${cleaned.length + 1}`;
    if (seen.has(id)) continue;
    seen.add(id);
    cleaned.push({ id, label });
  }
  try {
    localStorage.setItem(key, JSON.stringify(cleaned));
  } catch {
    // ignore
  }
  dispatchAuxiliaryRegistryChange(eventName, cleaned);
  return cleaned;
}

// Unidades de Medida
export const getStoredUnidadesMedida = (): string[] =>
  readStringArray(AUXILIARY_STORAGE_KEYS.UNIDADES_MEDIDA, DEFAULT_UNIDADES_MEDIDA, true);
export const saveStoredUnidadesMedida = (items: string[]): string[] =>
  saveStringArray(AUXILIARY_STORAGE_KEYS.UNIDADES_MEDIDA, items, AUXILIARY_EVENTS.UNIDADES_UPDATED, true);

// Setores / Endereçamento Físico de Almoxarifado
export const getStoredAlmoxarifadoSetores = (): string[] =>
  readStringArray(AUXILIARY_STORAGE_KEYS.ALMOXARIFADO_SETORES, DEFAULT_ALMOXARIFADO_SETORES, true);
export const saveStoredAlmoxarifadoSetores = (items: string[]): string[] =>
  saveStringArray(AUXILIARY_STORAGE_KEYS.ALMOXARIFADO_SETORES, items, AUXILIARY_EVENTS.SETORES_ALMOX_UPDATED, true);

// Tipos de Combustíveis
export const getStoredTiposCombustivel = (): string[] =>
  readStringArray(AUXILIARY_STORAGE_KEYS.TIPOS_COMBUSTIVEL, DEFAULT_TIPOS_COMBUSTIVEL, false);
export const saveStoredTiposCombustivel = (items: string[]): string[] =>
  saveStringArray(AUXILIARY_STORAGE_KEYS.TIPOS_COMBUSTIVEL, items, AUXILIARY_EVENTS.COMBUSTIVEL_UPDATED, false);

// Tipos de Ocorrências & Faltas (RH)
export const getStoredTiposOcorrenciasFaltas = (): KeyLabelAuxItem[] =>
  readKeyLabelArray(AUXILIARY_STORAGE_KEYS.TIPOS_OCORRENCIAS_FALTAS, DEFAULT_TIPOS_OCORRENCIAS_FALTAS);
export const saveStoredTiposOcorrenciasFaltas = (items: KeyLabelAuxItem[]): KeyLabelAuxItem[] =>
  saveKeyLabelArray(AUXILIARY_STORAGE_KEYS.TIPOS_OCORRENCIAS_FALTAS, items, AUXILIARY_EVENTS.OCORRENCIAS_UPDATED);

// Tipos de Afastamentos (RH)
export const getStoredTiposAfastamento = (): string[] =>
  readStringArray(AUXILIARY_STORAGE_KEYS.TIPOS_AFASTAMENTO, DEFAULT_TIPOS_AFASTAMENTO, false);
export const saveStoredTiposAfastamento = (items: string[]): string[] =>
  saveStringArray(AUXILIARY_STORAGE_KEYS.TIPOS_AFASTAMENTO, items, AUXILIARY_EVENTS.AFASTAMENTO_UPDATED, false);

// Tipos de Atestados & Declarações (RH)
export const getStoredTiposAtestados = (): string[] =>
  readStringArray(AUXILIARY_STORAGE_KEYS.TIPOS_ATESTADOS, DEFAULT_TIPOS_ATESTADOS, false);
export const saveStoredTiposAtestados = (items: string[]): string[] =>
  saveStringArray(AUXILIARY_STORAGE_KEYS.TIPOS_ATESTADOS, items, AUXILIARY_EVENTS.ATESTADOS_UPDATED, false);

// Finalidades de Guia ASO
export const getStoredAsoFinalidades = (): string[] =>
  readStringArray(AUXILIARY_STORAGE_KEYS.ASO_FINALIDADES, [...ASO_EXAM_PURPOSES], false);
export const saveStoredAsoFinalidades = (items: string[]): string[] =>
  saveStringArray(AUXILIARY_STORAGE_KEYS.ASO_FINALIDADES, items, AUXILIARY_EVENTS.ASO_FINALIDADES_UPDATED, false);

// Tipos de Exames ASO
export const getStoredAsoExames = (): AsoExamOption[] =>
  readKeyLabelArray(AUXILIARY_STORAGE_KEYS.ASO_EXAMES, ASO_EXAM_OPTIONS);
export const saveStoredAsoExames = (items: AsoExamOption[]): AsoExamOption[] =>
  saveKeyLabelArray(AUXILIARY_STORAGE_KEYS.ASO_EXAMES, items, AUXILIARY_EVENTS.ASO_EXAMES_UPDATED);

// Marcas de Pneus
export const getStoredAuxTireBrands = (): string[] =>
  readStringArray(AUXILIARY_STORAGE_KEYS.MARCAS_PNEUS, DEFAULT_TIRE_BRANDS_LIST, true);
export const saveStoredAuxTireBrands = (items: string[]): string[] =>
  saveStringArray(AUXILIARY_STORAGE_KEYS.MARCAS_PNEUS, items, AUXILIARY_EVENTS.MARCAS_PNEUS_UPDATED, true);

// Motivos de Trocas e Devoluções
export const getStoredAuxTrocaMotivos = (): string[] =>
  readStringArray(AUXILIARY_STORAGE_KEYS.TROCAS_MOTIVOS, DEFAULT_TROCA_MOTIVOS_LIST, false);
export const saveStoredAuxTrocaMotivos = (items: string[]): string[] =>
  saveStringArray(AUXILIARY_STORAGE_KEYS.TROCAS_MOTIVOS, items, AUXILIARY_EVENTS.TROCAS_MOTIVOS_UPDATED, false);

// Tipos de Vínculo Contratual (RH)
export const getStoredRhRegTypes = (): string[] =>
  readStringArray(AUXILIARY_STORAGE_KEYS.RH_REG_TYPES, DEFAULT_RH_REG_TYPES, false);
export const saveStoredRhRegTypes = (items: string[]): string[] => {
  const sorted = [...items].map((s) => String(s || '').trim()).filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  return saveStringArray(AUXILIARY_STORAGE_KEYS.RH_REG_TYPES, sorted, AUXILIARY_EVENTS.RH_REG_TYPES_UPDATED, false);
};

// Cargos / Funções (RH - lista auxiliar do formulário de colaboradores)
export const getStoredRhRoles = (): string[] =>
  readStringArray(AUXILIARY_STORAGE_KEYS.RH_ROLES, DEFAULT_RH_ROLES, false);
export const saveStoredRhRoles = (items: string[]): string[] => {
  const sorted = [...items].map((s) => String(s || '').trim()).filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  return saveStringArray(AUXILIARY_STORAGE_KEYS.RH_ROLES, sorted, AUXILIARY_EVENTS.RH_ROLES_UPDATED, false);
};

// Tipos de Contrato (RH)
export const getStoredRhContractTypes = (): string[] =>
  readStringArray(AUXILIARY_STORAGE_KEYS.RH_CONTRACT_TYPES, DEFAULT_RH_CONTRACT_TYPES, false);
export const saveStoredRhContractTypes = (items: string[]): string[] =>
  saveStringArray(AUXILIARY_STORAGE_KEYS.RH_CONTRACT_TYPES, items, AUXILIARY_EVENTS.RH_CONTRACT_TYPES_UPDATED, false);

// Placas & Veículos de Terceiros (Transportadoras)
export interface ThirdPartyPlateEntry {
  id: string;
  placa: string;
  uf?: string;
  transportadoraId?: string;
  transportadoraNome?: string;
  modeloVeiculo?: string;
  motoristaNome?: string;
  motoristaCpf?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const isTransportSupplierCategory = (category?: string): boolean => {
  const norm = String(category || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  if (!norm) return false;
  return norm.includes('transport') || norm.includes('frete');
};

export const normalizePlateCode = (raw: string): string =>
  String(raw || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 8);

export const getStoredPlacasTerceiros = (): ThirdPartyPlateEntry[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(AUXILIARY_STORAGE_KEYS.PLACAS_TERCEIROS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Map<string, ThirdPartyPlateEntry>();
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const placa = normalizePlateCode(item.placa || '');
      if (!placa) continue;
      seen.set(placa, {
        id: String(item.id || `pt_${placa}_${Date.now()}`),
        placa,
        uf: item.uf ? String(item.uf).trim().toUpperCase().slice(0, 2) : '',
        transportadoraId: item.transportadoraId ? String(item.transportadoraId).trim() : '',
        transportadoraNome: item.transportadoraNome ? String(item.transportadoraNome).trim().toUpperCase() : '',
        modeloVeiculo: item.modeloVeiculo ? String(item.modeloVeiculo).trim().toUpperCase() : '',
        motoristaNome: item.motoristaNome ? String(item.motoristaNome).trim().toUpperCase() : '',
        motoristaCpf: item.motoristaCpf ? String(item.motoristaCpf).trim() : '',
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      });
    }
    return Array.from(seen.values()).sort((a, b) => a.placa.localeCompare(b.placa, 'pt-BR'));
  } catch {
    return [];
  }
};

export const saveStoredPlacasTerceiros = (items: ThirdPartyPlateEntry[]): ThirdPartyPlateEntry[] => {
  const seen = new Map<string, ThirdPartyPlateEntry>();
  const nowIso = new Date().toISOString();
  for (const item of items) {
    const placa = normalizePlateCode(item?.placa || '');
    if (!placa) continue;
    seen.set(placa, {
      id: item.id || `pt_${placa}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      placa,
      uf: item.uf ? String(item.uf).trim().toUpperCase().slice(0, 2) : '',
      transportadoraId: item.transportadoraId ? String(item.transportadoraId).trim() : '',
      transportadoraNome: item.transportadoraNome ? String(item.transportadoraNome).trim().toUpperCase() : '',
      modeloVeiculo: item.modeloVeiculo ? String(item.modeloVeiculo).trim().toUpperCase() : '',
      motoristaNome: item.motoristaNome ? String(item.motoristaNome).trim().toUpperCase() : '',
      motoristaCpf: item.motoristaCpf ? String(item.motoristaCpf).trim() : '',
      createdAt: item.createdAt || nowIso,
      updatedAt: item.updatedAt || nowIso,
    });
  }
  const normalized = Array.from(seen.values()).sort((a, b) => a.placa.localeCompare(b.placa, 'pt-BR'));
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(AUXILIARY_STORAGE_KEYS.PLACAS_TERCEIROS, JSON.stringify(normalized));
      window.dispatchEvent(new CustomEvent(AUXILIARY_EVENTS.PLACAS_TERCEIROS_UPDATED, { detail: normalized }));
      window.dispatchEvent(new CustomEvent(AUXILIARY_REGISTRIES_UPDATED_EVENT));
    } catch {
      // ignore storage quota errors
    }
  }
  return normalized;
};

export const upsertThirdPartyPlate = (entry: {
  placa: string;
  uf?: string;
  transportadoraId?: string;
  transportadoraNome?: string;
  modeloVeiculo?: string;
  motoristaNome?: string;
  motoristaCpf?: string;
}): ThirdPartyPlateEntry[] => {
  const placa = normalizePlateCode(entry.placa);
  if (!placa || placa.length < 5) return getStoredPlacasTerceiros();
  const current = getStoredPlacasTerceiros();
  const existingIdx = current.findIndex((p) => normalizePlateCode(p.placa) === placa);
  const nowIso = new Date().toISOString();
  const nextItem: ThirdPartyPlateEntry = {
    id: existingIdx >= 0 ? current[existingIdx].id : `pt_${placa}_${Date.now()}`,
    placa,
    uf: (entry.uf || current[existingIdx]?.uf || '').trim().toUpperCase().slice(0, 2),
    transportadoraId: (entry.transportadoraId || current[existingIdx]?.transportadoraId || '').trim(),
    transportadoraNome: (entry.transportadoraNome || current[existingIdx]?.transportadoraNome || '').trim().toUpperCase(),
    modeloVeiculo: (entry.modeloVeiculo || current[existingIdx]?.modeloVeiculo || '').trim().toUpperCase(),
    motoristaNome: (entry.motoristaNome || current[existingIdx]?.motoristaNome || '').trim().toUpperCase(),
    motoristaCpf: (entry.motoristaCpf || current[existingIdx]?.motoristaCpf || '').trim(),
    createdAt: existingIdx >= 0 ? current[existingIdx].createdAt || nowIso : nowIso,
    updatedAt: nowIso,
  };
  const updated =
    existingIdx >= 0
      ? current.map((p, idx) => (idx === existingIdx ? nextItem : p))
      : [...current, nextItem];
  return saveStoredPlacasTerceiros(updated);
};

/**
 * Hook auxiliar para re-renderizar automaticamente sempre que qualquer lista auxiliar
 * ou janela de gerenciamento atualizar dados no localStorage.
 */
export function useAuxiliarySyncVersion(): number {
  const [version, setVersion] = useState(0);

  const bump = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const events = [
      ...Object.values(AUXILIARY_EVENTS),
      'storage',
      'colaca_silagem_categorias_estoque_updated',
      'colaca_silagem_servicos_estoque_updated',
      'agrocontrol_atividades_updated',
      'agrocontrol_crm_status_updated',
      'agrocontrol_servicos_interesse_updated',
      'agrocontrol_fornecedor_categorias_updated',
      'agrocontrol_categorias_veiculos_updated',
      'silagem_vehicle_categories_updated',
      'agrocontrol_formas_pagamento_updated',
      'colaca_silagem_plano_updated',
    ];
    events.forEach((ev) => window.addEventListener(ev, bump));
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, bump));
    };
  }, [bump]);

  return version;
}
