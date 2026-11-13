export const DEFAULT_TIPO_PRODUTO_OPTIONS: string[] = [
  'Mercadoria para Revenda',
  'Peça de Reposição / Manutenção',
  'Insumo Agrícola',
  'Material de Uso e Consumo',
  'Combustível / Lubrificante',
  'Serviço / Mão de Obra',
];

export const DEFAULT_PRODUCT_GROUPS: string[] = [
  'Filtros',
  'Rolamentos',
  'Correias',
  'Hidráulica',
  'Defensivos',
  'Pneus e Rodagem',
  'Lubrificantes',
  'Elétrica e Ignição',
  'Sementes e Insumos',
  'Lonas e Embalagens',
  'Freios e Suspensão',
  'Motor e Transmissão',
  'Ferramentas',
];

export const DEFAULT_SUBGROUPS_BY_GROUP: Record<string, string[]> = {
  filtros: [
    'Filtro de Óleo',
    'Filtro de Ar',
    'Filtro de Combustível',
    'Filtro Hidráulico',
    'Filtro Separador de Água',
    'Filtro de Cabine',
  ],
  rolamentos: [
    'Rolamento de Esferas',
    'Rolamento Cônico',
    'Rolamento de Rolos',
    'Mancal / Bucha',
    'Retentor',
  ],
  correias: [
    'Correia Dentada',
    'Correia em V',
    'Correia Poly-V',
    'Tensor / Esticador',
    'Polia',
  ],
  hidraulica: [
    'Mangueira Hidráulica',
    'Conexão / Terminal',
    'Bomba Hidráulica',
    'Cilindro / Pistão',
    'Comando Hidráulico',
    'Kit Reparo / Vedação',
  ],
  defensivos: [
    'Herbicida',
    'Fungicida',
    'Inseticida',
    'Adjuvante / Espalhante',
    'Tratamento de Sementes',
  ],
  'pneus e rodagem': [
    'Pneu Agrícola',
    'Pneu Carga / Caminhão',
    'Câmara de Ar',
    'Protetor de Aro',
    'Bico / Válvula',
  ],
  lubrificantes: [
    'Óleo de Motor',
    'Óleo Hidráulico',
    'Óleo de Transmissão',
    'Graxa',
    'Fluido de Freio / Arrefecimento',
  ],
  'eletrica e ignicao': [
    'Bateria',
    'Alternador',
    'Motor de Partida',
    'Sensor / Chicote',
    'Lâmpada / Farol',
    'Fusível / Relé',
  ],
  'sementes e insumos': [
    'Semente de Milho',
    'Semente de Sorgo',
    'Inoculante',
    'Adubo / Fertilizante',
    'Pastagem / Forrageira',
  ],
  'lonas e embalagens': [
    'Lona Preta / Dupla Face',
    'Filme Stretch',
    'Rede / Fio Enfardadeira',
    'Saco para Silagem',
  ],
  'freios e suspensao': [
    'Lona / Pastilha de Freio',
    'Tambor / Disco de Freio',
    'Cuíca / Câmara de Freio',
    'Feixe de Molas / Feixo',
    'Amortecedor',
  ],
  'motor e transmissao': [
    'Kit Embreagem',
    'Cruzeta / Cardan',
    'Bico Injetor / Bomba',
    'Junta / Vedação',
    'Faca / Rotor',
  ],
  ferramentas: [
    'Chave / Soquete',
    'Ferramenta Elétrica',
    'EPI / Segurança',
    'Parafuso / Fixador',
  ],
};

export const DEFAULT_PRODUCT_VARIATIONS: string[] = [
  'Voltagem 12V',
  'Voltagem 24V',
  'Rosca Fina',
  'Rosca Grossa',
  'Lado Direito (LD)',
  'Lado Esquerdo (LE)',
  'Dianteiro',
  'Traseiro',
  'Tamanho P',
  'Tamanho M',
  'Tamanho G',
  'Tamanho GG',
  'Cor Azul',
  'Cor Preta',
  'Standard (STD)',
  'Alta Pressão',
];

export const DEFAULT_PRODUCT_BRANDS: string[] = [
  'John Deere',
  'Michelin',
  'Pirelli',
  'Bosch',
  'Stihl',
  'Vonder',
  'New Holland',
  'Case IH',
  'Massey Ferguson',
  'Valtra',
  'Bridgestone',
  'Goodyear',
  'Donaldson',
  'Tecfil',
  'Gates',
  'SKF',
];

const STORAGE_KEYS = {
  TIPOS: 'agrocontrol_produto_tipos_v2',
  GRUPOS: 'agrocontrol_produto_grupos_v2',
  SUBGRUPOS_MAP: 'agrocontrol_produto_subgrupos_map_v2',
  VARIACOES: 'agrocontrol_produto_variacoes_v2',
  MARCAS: 'agrocontrol_produto_marcas_v2',
  // Chaves legadas para migração transparente
  LEGACY_TIPOS: 'agrocontrol_produto_tipos',
  LEGACY_GRUPOS: 'agrocontrol_produto_grupos',
  LEGACY_SUBGRUPOS_MAP: 'agrocontrol_produto_subgrupos_map',
  LEGACY_VARIACOES: 'agrocontrol_produto_variacoes',
};

export function normalizeClassificationKey(value?: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    const clean = String(raw || '').trim();
    if (!clean) continue;
    const key = normalizeClassificationKey(clean);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(clean);
    }
  }
  return result;
}

function readStoredArrayRaw(key: string): string[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? dedupeStrings(parsed.map((v) => String(v || '').trim()))
      : null;
  } catch {
    return null;
  }
}

function writeStoredArray(key: string, values: string[]): string[] {
  const cleaned = dedupeStrings(values);
  try {
    localStorage.setItem(key, JSON.stringify(cleaned));
  } catch {}
  return cleaned;
}

function readExistingProductsFromStorage(): any[] {
  try {
    const raw =
      localStorage.getItem('agrocontrol_produtos') ||
      localStorage.getItem('colaca_silagem_estoque_produtos') ||
      localStorage.getItem('silagem_facil_clean_v1_inventory');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function findMatchingOption(options: string[], value?: string | null): string {
  const clean = String(value || '').trim();
  if (!clean) return '';
  const targetKey = normalizeClassificationKey(clean);
  return options.find((opt) => normalizeClassificationKey(opt) === targetKey) || clean;
}

// =========================================================================
// 1. TIPO DE PRODUTO
// =========================================================================
export function getStoredTipoProdutoOptions(): string[] {
  const saved = readStoredArrayRaw(STORAGE_KEYS.TIPOS);
  if (saved !== null) return saved;

  const legacy = readStoredArrayRaw(STORAGE_KEYS.LEGACY_TIPOS) || [];
  const fromProducts = readExistingProductsFromStorage()
    .map((p) => String(p?.tipo_produto || '').trim())
    .filter(Boolean);
  return writeStoredArray(STORAGE_KEYS.TIPOS, [
    ...DEFAULT_TIPO_PRODUTO_OPTIONS,
    ...legacy,
    ...fromProducts,
  ]);
}

export function saveTipoProdutoOptionsList(items: string[]): string[] {
  return writeStoredArray(STORAGE_KEYS.TIPOS, items);
}

export function saveCustomTipoProdutoOption(value: string): string[] {
  const clean = value.trim();
  const current = getStoredTipoProdutoOptions();
  if (!clean) return current;
  return writeStoredArray(STORAGE_KEYS.TIPOS, [...current, clean]);
}

// =========================================================================
// 2. GRUPO
// =========================================================================
export function getStoredProductGroups(): string[] {
  const saved = readStoredArrayRaw(STORAGE_KEYS.GRUPOS);
  if (saved !== null) return saved;

  const legacy = readStoredArrayRaw(STORAGE_KEYS.LEGACY_GRUPOS) || [];
  const fromProducts = readExistingProductsFromStorage()
    .map((p) => String(p?.grupo || '').trim())
    .filter(Boolean);
  return writeStoredArray(STORAGE_KEYS.GRUPOS, [
    ...DEFAULT_PRODUCT_GROUPS,
    ...legacy,
    ...fromProducts,
  ]);
}

export function saveProductGroupsList(items: string[]): string[] {
  return writeStoredArray(STORAGE_KEYS.GRUPOS, items);
}

export function saveCustomProductGroup(value: string): string[] {
  const clean = value.trim();
  const current = getStoredProductGroups();
  if (!clean) return current;
  return writeStoredArray(STORAGE_KEYS.GRUPOS, [...current, clean]);
}

// =========================================================================
// 3. SUBGRUPO (Vinculado ao Grupo ou Geral)
// =========================================================================
function readSubgroupMap(storageKey: string): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeSubgroupMap(map: Record<string, string[]>): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SUBGRUPOS_MAP, JSON.stringify(map));
  } catch {}
}

export function getDefaultSubgroupsForGroup(grupo?: string): string[] {
  const normGrupo = normalizeClassificationKey(grupo);
  if (!normGrupo) {
    return dedupeStrings(Object.values(DEFAULT_SUBGROUPS_BY_GROUP).flat());
  }
  const matchedKey = Object.keys(DEFAULT_SUBGROUPS_BY_GROUP).find(
    (k) => k === normGrupo || k.includes(normGrupo) || normGrupo.includes(k)
  );
  if (matchedKey) {
    return [...DEFAULT_SUBGROUPS_BY_GROUP[matchedKey]];
  }
  return dedupeStrings(Object.values(DEFAULT_SUBGROUPS_BY_GROUP).flat());
}

export function getSuggestedSubgroupsForGroup(grupo?: string): string[] {
  const normGrupo = normalizeClassificationKey(grupo) || '__geral__';
  const map = readSubgroupMap(STORAGE_KEYS.SUBGRUPOS_MAP);
  if (Array.isArray(map[normGrupo])) {
    return dedupeStrings(map[normGrupo]);
  }

  const legacyMap = readSubgroupMap(STORAGE_KEYS.LEGACY_SUBGRUPOS_MAP);
  const existingProducts = readExistingProductsFromStorage();

  if (normGrupo === '__geral__') {
    const allDefaults = Object.values(DEFAULT_SUBGROUPS_BY_GROUP).flat();
    const allLegacy = Object.values(legacyMap).flat();
    const allFromProducts = existingProducts
      .map((p) => String(p?.subgrupo || '').trim())
      .filter(Boolean);
    const seeded = dedupeStrings([...allDefaults, ...allLegacy, ...allFromProducts]);
    map[normGrupo] = seeded;
    writeSubgroupMap(map);
    return seeded;
  }

  const matchedKey = Object.keys(DEFAULT_SUBGROUPS_BY_GROUP).find(
    (k) => k === normGrupo || k.includes(normGrupo) || normGrupo.includes(k)
  );
  const matchedDefaults = matchedKey ? DEFAULT_SUBGROUPS_BY_GROUP[matchedKey] : [];
  const matchedLegacy = Array.isArray(legacyMap[normGrupo]) ? legacyMap[normGrupo] : [];
  const matchedFromProducts = existingProducts
    .filter((p) => normalizeClassificationKey(p?.grupo) === normGrupo)
    .map((p) => String(p?.subgrupo || '').trim())
    .filter(Boolean);

  const combined = dedupeStrings([
    ...matchedDefaults,
    ...matchedLegacy,
    ...matchedFromProducts,
  ]);

  if (combined.length > 0) {
    map[normGrupo] = combined;
    writeSubgroupMap(map);
    return combined;
  }

  const fallbackAll = dedupeStrings([
    ...Object.values(DEFAULT_SUBGROUPS_BY_GROUP).flat(),
    ...Object.values(legacyMap).flat(),
    ...existingProducts.map((p) => String(p?.subgrupo || '').trim()).filter(Boolean),
  ]);
  return fallbackAll;
}

export function saveProductSubgroupsList(grupo: string, items: string[]): string[] {
  const normGrupo = normalizeClassificationKey(grupo) || '__geral__';
  const map = readSubgroupMap(STORAGE_KEYS.SUBGRUPOS_MAP);
  map[normGrupo] = dedupeStrings(items);
  writeSubgroupMap(map);
  return map[normGrupo];
}

export function saveCustomProductSubgroup(grupo: string, subgrupo: string): string[] {
  const cleanSub = subgrupo.trim();
  const current = getSuggestedSubgroupsForGroup(grupo);
  if (!cleanSub) return current;
  return saveProductSubgroupsList(grupo, [...current, cleanSub]);
}

// =========================================================================
// 4. VARIAÇÃO / ESPECIFICAÇÃO
// =========================================================================
export function getStoredProductVariations(): string[] {
  const saved = readStoredArrayRaw(STORAGE_KEYS.VARIACOES);
  if (saved !== null) return saved;

  const legacy = readStoredArrayRaw(STORAGE_KEYS.LEGACY_VARIACOES) || [];
  const fromProducts = readExistingProductsFromStorage()
    .map((p) => String(p?.variacao || '').trim())
    .filter(Boolean);
  return writeStoredArray(STORAGE_KEYS.VARIACOES, [
    ...DEFAULT_PRODUCT_VARIATIONS,
    ...legacy,
    ...fromProducts,
  ]);
}

export function saveProductVariationsList(items: string[]): string[] {
  return writeStoredArray(STORAGE_KEYS.VARIACOES, items);
}

export function saveCustomProductVariation(value: string): string[] {
  const clean = value.trim();
  const current = getStoredProductVariations();
  if (!clean) return current;
  return writeStoredArray(STORAGE_KEYS.VARIACOES, [...current, clean]);
}

// =========================================================================
// 5. MARCA
// =========================================================================
export function getStoredProductBrands(): string[] {
  const saved = readStoredArrayRaw(STORAGE_KEYS.MARCAS);
  if (saved !== null) return saved;

  const fromProducts = readExistingProductsFromStorage()
    .map((p) => String(p?.marca || p?.brand || '').trim())
    .filter((m) => Boolean(m) && m.toUpperCase() !== 'SELECIONE...');
  return writeStoredArray(STORAGE_KEYS.MARCAS, [
    ...DEFAULT_PRODUCT_BRANDS,
    ...fromProducts,
  ]);
}

export function saveProductBrandsList(items: string[]): string[] {
  return writeStoredArray(STORAGE_KEYS.MARCAS, items);
}

export function saveCustomProductBrand(value: string): string[] {
  const clean = value.trim();
  const current = getStoredProductBrands();
  if (!clean) return current;
  return writeStoredArray(STORAGE_KEYS.MARCAS, [...current, clean]);
}
