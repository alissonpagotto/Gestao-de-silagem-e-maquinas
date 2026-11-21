export type LabelSizePreset =
  // 1. Folha A4 (210 x 297 mm — Padrão Pimaco / Colacril)
  | 'a4_126_a4349'
  | 'a4_96_a4348'
  | 'a4_65_a4351'
  | 'a4_44_a4350'
  | 'a4_33_a4355'
  | 'a4_30_a4356'
  | 'a4_24_a4360'
  | 'a4_22_a4354'
  | 'a4_18_a4361'
  | 'a4_16_a4362'
  | 'a4_14_a4363'
  | 'a4_10_a4367'
  | 'a4_8_a4368'
  | 'a4_4_a4372'
  | 'a4_2_a4373'
  | 'a4_1_a4375'
  // 2. Folha Carta / Letter (215,9 x 279,4 mm — Padrão Pimaco 6080/6180)
  | 'carta_80_6087'
  | 'carta_60_6089'
  | 'carta_30_6080'
  | 'carta_20_6081'
  | 'carta_14_6082'
  | 'carta_10_6083'
  | 'carta_6_6084'
  | 'carta_4_6085'
  // 3. Impressoras Térmicas (Rolos Contínuos)
  | 'termica_gondola_60x30'
  | 'termica_padrao_40x25'
  | 'termica_media_50x40'
  | 'termica_grande_100x50'
  | 'termica_dupla_40x25'
  | 'termica_dupla_37x30'
  | 'termica_tripla_33x22'
  | 'termica_mini_15x50'
  // Personalizados (inline e salvos)
  | 'custom_inline'
  | `custom_${string}`
  // Compatibilidade legada
  | 'a4_4x15_61x19'
  | 'a4_4x12_47x25'
  | 'a4_3x10_70x30'
  | 'a4_2x10_99x29'
  | 'a4_2x7_102x38'
  | 'gondola_100x35'
  | 'gondola_80x30'
  | 'termica_60x40'
  | 'a4_grade';

export type CustomPaperType = 'a4' | 'carta' | 'termica';

export interface CustomLabelDraft {
  id?: string;
  name: string;
  paperType: CustomPaperType;
  labelWidthMm: number;
  labelHeightMm: number;
  cols: number;
  rows: number;
  marginTopMm: number;
  marginLeftMm: number;
  colGapMm: number;
  rowGapMm: number;
}

export interface LabelPresetConfig {
  id: LabelSizePreset;
  name: string;
  category: 'a4' | 'carta' | 'termica';
  categoryLabel: string;
  isCustom?: boolean;
  // Dimensões físicas da página (mm)
  pageWidthMm: number;
  pageHeightMm: number;
  // Dimensões físicas da etiqueta (mm)
  labelWidthMm: number;
  labelHeightMm: number;
  widthMm: number;
  heightMm: number;
  // Grade
  cols: number;
  columns: number;
  rows: number;
  // Calibração milimétrica de margens e espaçamentos
  marginTopMm: number;
  marginLeftMm: number;
  colGapMm: number;
  rowGapMm: number;
  gapXMm: number;
  gapYMm: number;
  paddingTopMm: number;
  paddingLeftMm: number;
  pageSize: string;
  totalPerSheet?: number;
  description: string;
  badge: string;
}

const A4_CATEGORY_LABEL = 'Grupo 1 — Folha A4 (210 × 297 mm — Padrão Pimaco / Colacril)';
const CARTA_CATEGORY_LABEL = 'Grupo 2 — Folha Carta / Letter (215,9 × 279,4 mm — Padrão Pimaco 6080/6180)';
const THERMAL_CATEGORY_LABEL = 'Grupo 3 — Impressoras Térmicas (Rolos Contínuos — Largura × Altura)';

function createA4Preset(params: {
  id: LabelSizePreset;
  name: string;
  cols: number;
  rows: number;
  labelWidthMm: number;
  labelHeightMm: number;
  colGapMm: number;
  rowGapMm?: number;
  marginTopMm?: number;
  marginLeftMm?: number;
}): LabelPresetConfig {
  const pageWidthMm = 210;
  const pageHeightMm = 297;
  const rowGapMm = params.rowGapMm ?? 0;
  const totalGridWidth = params.cols * params.labelWidthMm + (params.cols - 1) * params.colGapMm;
  const totalGridHeight = params.rows * params.labelHeightMm + (params.rows - 1) * rowGapMm;
  const marginTopMm = params.marginTopMm ?? Number(((pageHeightMm - totalGridHeight) / 2).toFixed(2));
  const marginLeftMm = params.marginLeftMm ?? Number(((pageWidthMm - totalGridWidth) / 2).toFixed(2));
  const totalPerSheet = params.cols * params.rows;

  return {
    id: params.id,
    name: params.name,
    category: 'a4',
    categoryLabel: A4_CATEGORY_LABEL,
    pageWidthMm,
    pageHeightMm,
    labelWidthMm: params.labelWidthMm,
    labelHeightMm: params.labelHeightMm,
    widthMm: params.labelWidthMm,
    heightMm: params.labelHeightMm,
    cols: params.cols,
    columns: params.cols,
    rows: params.rows,
    marginTopMm,
    marginLeftMm,
    colGapMm: params.colGapMm,
    rowGapMm,
    gapXMm: params.colGapMm,
    gapYMm: rowGapMm,
    paddingTopMm: marginTopMm,
    paddingLeftMm: marginLeftMm,
    pageSize: 'A4 portrait',
    totalPerSheet,
    description: `${totalPerSheet} etiquetas/folha • ${params.labelWidthMm}×${params.labelHeightMm}mm • ${params.cols}×${params.rows}`,
    badge: `A4 ${params.cols}×${params.rows} (${totalPerSheet} un)`,
  };
}

function createCartaPreset(params: {
  id: LabelSizePreset;
  name: string;
  cols: number;
  rows: number;
  labelWidthMm: number;
  labelHeightMm: number;
  marginTopMm?: number;
  marginLeftMm?: number;
  colGapMm?: number;
  rowGapMm?: number;
}): LabelPresetConfig {
  const pageWidthMm = 215.9;
  const pageHeightMm = 279.4;
  const colGapMm =
    params.colGapMm ??
    (params.cols >= 4 ? 7.6 : params.cols === 3 ? 3.18 : params.cols === 2 ? 4.8 : 0);
  const rowGapMm = params.rowGapMm ?? 0;
  const totalGridWidth =
    params.cols * params.labelWidthMm + Math.max(0, params.cols - 1) * colGapMm;
  const totalGridHeight =
    params.rows * params.labelHeightMm + Math.max(0, params.rows - 1) * rowGapMm;
  const marginTopMm =
    params.marginTopMm ?? Number(((pageHeightMm - totalGridHeight) / 2).toFixed(2));
  const marginLeftMm =
    params.marginLeftMm ?? Number(((pageWidthMm - totalGridWidth) / 2).toFixed(2));
  const totalPerSheet = params.cols * params.rows;

  return {
    id: params.id,
    name: params.name,
    category: 'carta',
    categoryLabel: CARTA_CATEGORY_LABEL,
    pageWidthMm,
    pageHeightMm,
    labelWidthMm: params.labelWidthMm,
    labelHeightMm: params.labelHeightMm,
    widthMm: params.labelWidthMm,
    heightMm: params.labelHeightMm,
    cols: params.cols,
    columns: params.cols,
    rows: params.rows,
    marginTopMm,
    marginLeftMm,
    colGapMm,
    rowGapMm,
    gapXMm: colGapMm,
    gapYMm: rowGapMm,
    paddingTopMm: marginTopMm,
    paddingLeftMm: marginLeftMm,
    pageSize: 'letter portrait',
    totalPerSheet,
    description: `${totalPerSheet} etiquetas/folha Carta • ${params.labelWidthMm}×${params.labelHeightMm}mm • ${params.cols}×${params.rows}`,
    badge: `Carta ${params.cols}×${params.rows} (${totalPerSheet} un)`,
  };
}

export const A4_PRESETS: LabelPresetConfig[] = [
  createA4Preset({
    id: 'a4_126_a4349',
    name: 'A4 — 126 Etiquetas (A4349 / A4249 • 26,0 × 15,0 mm • 7 col × 18 lin)',
    cols: 7,
    rows: 18,
    labelWidthMm: 26.0,
    labelHeightMm: 15.0,
    colGapMm: 2.5,
  }),
  createA4Preset({
    id: 'a4_96_a4348',
    name: 'A4 — 96 Etiquetas (A4348 / A4248 • 31,0 × 17,0 mm • 6 col × 16 lin)',
    cols: 6,
    rows: 16,
    labelWidthMm: 31.0,
    labelHeightMm: 17.0,
    colGapMm: 2.5,
  }),
  createA4Preset({
    id: 'a4_65_a4351',
    name: 'A4 — 65 Etiquetas (A4351 / A4251 • 38,2 × 21,2 mm • 5 col × 13 lin)',
    cols: 5,
    rows: 13,
    labelWidthMm: 38.2,
    labelHeightMm: 21.2,
    colGapMm: 2.5,
  }),
  createA4Preset({
    id: 'a4_44_a4350',
    name: 'A4 — 44 Etiquetas (A4350 / A4250 • 48,5 × 25,4 mm • 4 col × 11 lin)',
    cols: 4,
    rows: 11,
    labelWidthMm: 48.5,
    labelHeightMm: 25.4,
    colGapMm: 2.5,
  }),
  createA4Preset({
    id: 'a4_33_a4355',
    name: 'A4 — 33 Etiquetas (A4355 / A4255 • 63,5 × 25,4 mm • 3 col × 11 lin)',
    cols: 3,
    rows: 11,
    labelWidthMm: 63.5,
    labelHeightMm: 25.4,
    colGapMm: 2.5,
  }),
  createA4Preset({
    id: 'a4_30_a4356',
    name: 'A4 — 30 Etiquetas (A4356 / A4256 • 66,7 × 25,4 mm • 3 col × 10 lin)',
    cols: 3,
    rows: 10,
    labelWidthMm: 66.7,
    labelHeightMm: 25.4,
    colGapMm: 2.5,
  }),
  createA4Preset({
    id: 'a4_24_a4360',
    name: 'A4 — 24 Etiquetas (A4360 / A4260 • 63,5 × 33,9 mm • 3 col × 8 lin)',
    cols: 3,
    rows: 8,
    labelWidthMm: 63.5,
    labelHeightMm: 33.9,
    colGapMm: 2.5,
  }),
  createA4Preset({
    id: 'a4_22_a4354',
    name: 'A4 — 22 Etiquetas (A4354 / A4254 • 99,0 × 25,4 mm • 2 col × 11 lin)',
    cols: 2,
    rows: 11,
    labelWidthMm: 99.0,
    labelHeightMm: 25.4,
    colGapMm: 2.0,
  }),
  createA4Preset({
    id: 'a4_18_a4361',
    name: 'A4 — 18 Etiquetas (A4361 / A4261 • 63,5 × 46,5 mm • 3 col × 6 lin)',
    cols: 3,
    rows: 6,
    labelWidthMm: 63.5,
    labelHeightMm: 46.5,
    colGapMm: 2.5,
  }),
  createA4Preset({
    id: 'a4_16_a4362',
    name: 'A4 — 16 Etiquetas (A4362 / A4262 • 99,0 × 33,9 mm • 2 col × 8 lin)',
    cols: 2,
    rows: 8,
    labelWidthMm: 99.0,
    labelHeightMm: 33.9,
    colGapMm: 2.0,
  }),
  createA4Preset({
    id: 'a4_14_a4363',
    name: 'A4 — 14 Etiquetas (A4363 / A4263 • 99,0 × 38,1 mm • 2 col × 7 lin)',
    cols: 2,
    rows: 7,
    labelWidthMm: 99.0,
    labelHeightMm: 38.1,
    colGapMm: 2.0,
  }),
  createA4Preset({
    id: 'a4_10_a4367',
    name: 'A4 — 10 Etiquetas (A4367 / A4267 • 99,0 × 55,0 mm • 2 col × 5 lin)',
    cols: 2,
    rows: 5,
    labelWidthMm: 99.0,
    labelHeightMm: 55.0,
    colGapMm: 2.0,
  }),
  createA4Preset({
    id: 'a4_8_a4368',
    name: 'A4 — 8 Etiquetas (A4368 / A4268 • 99,0 × 67,7 mm • 2 col × 4 lin)',
    cols: 2,
    rows: 4,
    labelWidthMm: 99.0,
    labelHeightMm: 67.7,
    colGapMm: 2.0,
  }),
  createA4Preset({
    id: 'a4_4_a4372',
    name: 'A4 — 4 Etiquetas (A4372 / A4272 • 99,0 × 138,5 mm • 2 col × 2 lin)',
    cols: 2,
    rows: 2,
    labelWidthMm: 99.0,
    labelHeightMm: 138.5,
    colGapMm: 2.0,
  }),
  createA4Preset({
    id: 'a4_2_a4373',
    name: 'A4 — 2 Etiquetas (A4373 / A4273 • 199,6 × 138,5 mm • 1 col × 2 lin)',
    cols: 1,
    rows: 2,
    labelWidthMm: 199.6,
    labelHeightMm: 138.5,
    colGapMm: 0,
  }),
  createA4Preset({
    id: 'a4_1_a4375',
    name: 'A4 — 1 Etiqueta (A4375 / A4275 • 199,6 × 288,5 mm • Folha Inteira)',
    cols: 1,
    rows: 1,
    labelWidthMm: 199.6,
    labelHeightMm: 288.5,
    colGapMm: 0,
  }),
];

export const CARTA_PRESETS: LabelPresetConfig[] = [
  createCartaPreset({
    id: 'carta_80_6087',
    name: 'Carta — 80 Etiquetas (6087 / 6187 • 44,45 × 12,7 mm • 4 col × 20 lin)',
    cols: 4,
    rows: 20,
    labelWidthMm: 44.45,
    labelHeightMm: 12.7,
    colGapMm: 7.6,
    rowGapMm: 0,
  }),
  createCartaPreset({
    id: 'carta_60_6089',
    name: 'Carta — 60 Etiquetas (6089 / 6189 • 44,45 × 16,93 mm • 4 col × 15 lin)',
    cols: 4,
    rows: 15,
    labelWidthMm: 44.45,
    labelHeightMm: 16.93,
    colGapMm: 7.6,
    rowGapMm: 0,
  }),
  createCartaPreset({
    id: 'carta_30_6080',
    name: 'Carta — 30 Etiquetas (6080 / 6180 • 66,7 × 25,4 mm • 3 col × 10 lin)',
    cols: 3,
    rows: 10,
    labelWidthMm: 66.7,
    labelHeightMm: 25.4,
    colGapMm: 3.18,
    rowGapMm: 0,
  }),
  createCartaPreset({
    id: 'carta_20_6081',
    name: 'Carta — 20 Etiquetas (6081 / 6181 • 101,6 × 25,4 mm • 2 col × 10 lin)',
    cols: 2,
    rows: 10,
    labelWidthMm: 101.6,
    labelHeightMm: 25.4,
    colGapMm: 4.8,
    rowGapMm: 0,
  }),
  createCartaPreset({
    id: 'carta_14_6082',
    name: 'Carta — 14 Etiquetas (6082 / 6182 • 101,6 × 33,9 mm • 2 col × 7 lin)',
    cols: 2,
    rows: 7,
    labelWidthMm: 101.6,
    labelHeightMm: 33.9,
    colGapMm: 4.8,
    rowGapMm: 0,
  }),
  createCartaPreset({
    id: 'carta_10_6083',
    name: 'Carta — 10 Etiquetas (6083 / 6183 • 101,6 × 50,8 mm • 2 col × 5 lin)',
    cols: 2,
    rows: 5,
    labelWidthMm: 101.6,
    labelHeightMm: 50.8,
    colGapMm: 4.8,
    rowGapMm: 0,
  }),
  createCartaPreset({
    id: 'carta_6_6084',
    name: 'Carta — 6 Etiquetas (6084 / 6184 • 101,6 × 84,7 mm • 2 col × 3 lin)',
    cols: 2,
    rows: 3,
    labelWidthMm: 101.6,
    labelHeightMm: 84.7,
    colGapMm: 4.8,
    rowGapMm: 0,
  }),
  createCartaPreset({
    id: 'carta_4_6085',
    name: 'Carta — 4 Etiquetas (6085 / 6185 • 101,6 × 127,0 mm • 2 col × 2 lin)',
    cols: 2,
    rows: 2,
    labelWidthMm: 101.6,
    labelHeightMm: 127.0,
    colGapMm: 4.8,
    rowGapMm: 0,
  }),
];

function createThermalPreset(params: {
  id: LabelSizePreset;
  name: string;
  cols: number;
  widthMm: number;
  heightMm: number;
  gapXMm?: number;
  rowGapMm?: number;
  marginLeftMm?: number;
  marginTopMm?: number;
  pageWidthMm?: number;
  pageHeightMm?: number;
  pageSize?: string;
  description: string;
  badge: string;
}): LabelPresetConfig {
  const marginLeftMm = params.marginLeftMm ?? 0;
  const marginTopMm = params.marginTopMm ?? 0;
  const gapXMm = params.gapXMm ?? (params.cols > 1 ? 3.0 : 0);
  const rowGapMm = params.rowGapMm ?? 3.0;
  const totalWidth =
    params.pageWidthMm ??
    Number((marginLeftMm * 2 + params.cols * params.widthMm + Math.max(0, params.cols - 1) * gapXMm).toFixed(2));
  const totalHeight = params.pageHeightMm ?? params.heightMm;
  const pageSize = params.pageSize ?? `${totalWidth}mm ${totalHeight}mm`;
  return {
    id: params.id,
    name: params.name,
    category: 'termica',
    categoryLabel: THERMAL_CATEGORY_LABEL,
    pageWidthMm: totalWidth,
    pageHeightMm: totalHeight,
    labelWidthMm: params.widthMm,
    labelHeightMm: params.heightMm,
    widthMm: params.widthMm,
    heightMm: params.heightMm,
    cols: params.cols,
    columns: params.cols,
    rows: 1,
    marginTopMm,
    marginLeftMm,
    colGapMm: gapXMm,
    rowGapMm,
    gapXMm,
    gapYMm: rowGapMm,
    paddingTopMm: marginTopMm,
    paddingLeftMm: marginLeftMm,
    pageSize,
    description: params.description,
    badge: params.badge,
  };
}

export const THERMAL_PRESETS: LabelPresetConfig[] = [
  createThermalPreset({
    id: 'termica_gondola_60x30',
    name: 'Térmica Gôndola - 1 Coluna (60mm x 30mm - Padrão)',
    cols: 1,
    widthMm: 60.0,
    heightMm: 30.0,
    gapXMm: 0,
    rowGapMm: 3.0,
    pageSize: '60mm 30mm',
    description: 'Rolo térmico contínuo 1 coluna • 60mm x 30mm',
    badge: '1 Col (60x30)',
  }),
  createThermalPreset({
    id: 'termica_padrao_40x25',
    name: 'Térmica Padrão - 1 Coluna (40mm x 25mm)',
    cols: 1,
    widthMm: 40.0,
    heightMm: 25.0,
    gapXMm: 0,
    rowGapMm: 3.0,
    pageSize: '40mm 25mm',
    description: 'Rolo térmico compacto • 40mm x 25mm',
    badge: '1 Col (40x25)',
  }),
  createThermalPreset({
    id: 'termica_media_50x40',
    name: 'Térmica Média - 1 Coluna (50mm x 40mm)',
    cols: 1,
    widthMm: 50.0,
    heightMm: 40.0,
    gapXMm: 0,
    rowGapMm: 3.0,
    pageSize: '50mm 40mm',
    description: 'Rolo térmico médio • 50mm x 40mm',
    badge: '1 Col (50x40)',
  }),
  createThermalPreset({
    id: 'termica_grande_100x50',
    name: 'Térmica Grande - 1 Coluna (100mm x 50mm - Caixas grandes)',
    cols: 1,
    widthMm: 100.0,
    heightMm: 50.0,
    gapXMm: 0,
    rowGapMm: 3.0,
    pageSize: '100mm 50mm',
    description: 'Rolo térmico para caixas e fardos • 100mm x 50mm',
    badge: '1 Col (100x50)',
  }),
  createThermalPreset({
    id: 'termica_dupla_40x25',
    name: 'Térmica Dupla - 2 Colunas Lado a Lado (40mm x 25mm cada)',
    cols: 2,
    widthMm: 40.0,
    heightMm: 25.0,
    marginLeftMm: 1.0,
    gapXMm: 3.0,
    rowGapMm: 3.0,
    pageWidthMm: 85.0,
    pageHeightMm: 25.0,
    pageSize: '85mm 25mm',
    description: 'Rolo 85mm com 2 colunas lado a lado • 40mm x 25mm cada',
    badge: '2 Col (40x25)',
  }),
  createThermalPreset({
    id: 'termica_dupla_37x30',
    name: 'Térmica Dupla - 2 Colunas Lado a Lado (37mm x 30mm cada)',
    cols: 2,
    widthMm: 37.0,
    heightMm: 30.0,
    gapXMm: 3.0,
    rowGapMm: 3.0,
    pageSize: '77mm 30mm',
    description: 'Rolo com 2 colunas lado a lado • 37mm x 30mm cada',
    badge: '2 Col (37x30)',
  }),
  createThermalPreset({
    id: 'termica_tripla_33x22',
    name: 'Térmica Tripla - 3 Colunas Lado a Lado (33mm x 22mm cada)',
    cols: 3,
    widthMm: 33.0,
    heightMm: 22.0,
    gapXMm: 3.0,
    rowGapMm: 3.0,
    pageSize: '105mm 22mm',
    description: 'Rolo com 3 colunas lado a lado • 33mm x 22mm cada',
    badge: '3 Col (33x22)',
  }),
  createThermalPreset({
    id: 'termica_mini_15x50',
    name: 'Térmica Mini - 5 Colunas Lado a Lado (15mm x 50mm cada)',
    cols: 5,
    widthMm: 15.0,
    heightMm: 50.0,
    gapXMm: 3.0,
    rowGapMm: 3.0,
    pageSize: '87mm 50mm',
    description: 'Rolo com 5 colunas verticais • 15mm x 50mm cada',
    badge: '5 Col (15x50)',
  }),
];

export const CUSTOM_LABELS_STORAGE_KEY = 'agrocontrol_custom_labels';
const CUSTOM_CATEGORY_LABEL = '⭐ Meus Modelos Personalizados';

export const DEFAULT_CUSTOM_LABEL_DRAFT: CustomLabelDraft = {
  name: 'Etiqueta Personalizada 60×30',
  paperType: 'a4',
  labelWidthMm: 60.0,
  labelHeightMm: 30.0,
  cols: 3,
  rows: 9,
  marginTopMm: 13.5,
  marginLeftMm: 12.0,
  colGapMm: 3.0,
  rowGapMm: 0,
};

function clampNumber(val: unknown, fallback: number, min: number, max: number): number {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Number(Math.min(max, Math.max(min, num)).toFixed(2));
}

export function computeCenteredSheetMargins(
  paperType: 'a4' | 'carta',
  labelWidthMm: number,
  labelHeightMm: number,
  cols: number,
  rows: number,
  colGapMm: number = 0,
  rowGapMm: number = 0
): { marginTopMm: number; marginLeftMm: number } {
  const sheetW = paperType === 'carta' ? 215.9 : 210;
  const sheetH = paperType === 'carta' ? 279.4 : 297;
  const contentW = cols * labelWidthMm + Math.max(0, cols - 1) * colGapMm;
  const contentH = rows * labelHeightMm + Math.max(0, rows - 1) * rowGapMm;
  return {
    marginLeftMm: Number(Math.max(0, (sheetW - contentW) / 2).toFixed(2)),
    marginTopMm: Number(Math.max(0, (sheetH - contentH) / 2).toFixed(2)),
  };
}

export function buildCustomLabelPreset(
  draft: CustomLabelDraft,
  idOverride?: LabelSizePreset
): LabelPresetConfig {
  const paperType: CustomPaperType =
    draft.paperType === 'carta' || draft.paperType === 'termica' ? draft.paperType : 'a4';
  const labelWidthMm = clampNumber(draft.labelWidthMm, 60, 10, 215);
  const labelHeightMm = clampNumber(draft.labelHeightMm, 30, 8, 297);
  const cols = Math.round(clampNumber(draft.cols, 1, 1, 20));
  const rows = paperType === 'termica' ? Math.round(clampNumber(draft.rows, 1, 1, 20)) : Math.round(clampNumber(draft.rows, 1, 1, 40));
  const marginTopMm = clampNumber(draft.marginTopMm, 0, 0, 100);
  const marginLeftMm = clampNumber(draft.marginLeftMm, 0, 0, 100);
  const colGapMm = clampNumber(draft.colGapMm, 0, 0, 50);
  const rowGapMm = clampNumber(draft.rowGapMm, 0, 0, 50);

  const rawName = (draft.name || '').trim();
  const displayName = rawName || `Personalizada ${labelWidthMm}×${labelHeightMm} mm`;

  let pageWidthMm = 210;
  let pageHeightMm = 297;
  let pageSize = 'A4 portrait';
  let totalPerSheet: number | undefined = cols * rows;
  let badge = `Personalizada ${cols}×${rows} (${cols * rows} un)`;
  let description = `${cols * rows} etiquetas/folha A4 • ${labelWidthMm}×${labelHeightMm}mm • ${cols}×${rows}`;

  if (paperType === 'carta') {
    pageWidthMm = 215.9;
    pageHeightMm = 279.4;
    pageSize = 'letter portrait';
    badge = `Personalizada Carta ${cols}×${rows} (${cols * rows} un)`;
    description = `${cols * rows} etiquetas/folha Carta • ${labelWidthMm}×${labelHeightMm}mm • ${cols}×${rows}`;
  } else if (paperType === 'termica') {
    pageWidthMm = Number((marginLeftMm * 2 + cols * labelWidthMm + Math.max(0, cols - 1) * colGapMm).toFixed(2));
    pageHeightMm = Number((marginTopMm * 2 + rows * labelHeightMm + Math.max(0, rows - 1) * rowGapMm).toFixed(2));
    pageSize = `${pageWidthMm}mm ${pageHeightMm}mm`;
    totalPerSheet = rows > 1 ? cols * rows : undefined;
    badge = `Personalizada Térmica ${cols}×${rows} (${labelWidthMm}×${labelHeightMm})`;
    description = `Rolo térmico ${cols} col × ${rows} lin • ${labelWidthMm}×${labelHeightMm}mm`;
  }

  const presetId: LabelSizePreset =
    idOverride || (draft.id && draft.id.startsWith('custom_') ? (draft.id as LabelSizePreset) : 'custom_inline');

  return {
    id: presetId,
    name: `${displayName} (${labelWidthMm} × ${labelHeightMm} mm • ${cols} col × ${rows} lin)`,
    category: paperType,
    categoryLabel: CUSTOM_CATEGORY_LABEL,
    isCustom: true,
    pageWidthMm,
    pageHeightMm,
    labelWidthMm,
    labelHeightMm,
    widthMm: labelWidthMm,
    heightMm: labelHeightMm,
    cols,
    columns: cols,
    rows,
    marginTopMm,
    marginLeftMm,
    colGapMm,
    rowGapMm,
    gapXMm: colGapMm,
    gapYMm: rowGapMm,
    paddingTopMm: marginTopMm,
    paddingLeftMm: marginLeftMm,
    pageSize,
    totalPerSheet,
    description,
    badge,
  };
}

export function extractDraftFromPreset(preset: LabelPresetConfig): CustomLabelDraft {
  // Remove sufixo automático de dimensões se vier de um modelo salvo
  const cleanName = preset.name.replace(/\s*\([^)]*mm\s*•[^)]*\)\s*$/, '').trim();
  return {
    id: preset.isCustom ? preset.id : undefined,
    name: cleanName || preset.name,
    paperType: preset.category,
    labelWidthMm: preset.labelWidthMm,
    labelHeightMm: preset.labelHeightMm,
    cols: preset.cols,
    rows: preset.rows,
    marginTopMm: preset.marginTopMm,
    marginLeftMm: preset.marginLeftMm,
    colGapMm: preset.colGapMm,
    rowGapMm: preset.rowGapMm,
  };
}

export function loadCustomLabelPresets(): LabelPresetConfig[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_LABELS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === 'object')
      .map((item, idx) => {
        const id: LabelSizePreset =
          typeof item.id === 'string' && item.id.startsWith('custom_') && item.id !== 'custom_inline'
            ? (item.id as LabelSizePreset)
            : (`custom_${Date.now()}_${idx}` as LabelSizePreset);
        const draft: CustomLabelDraft = {
          id,
          name: String(item.name || item.rawName || `Personalizada ${idx + 1}`).replace(/\s*\([^)]*mm\s*•[^)]*\)\s*$/, '').trim(),
          paperType: (item.paperType || item.category || 'a4') as CustomPaperType,
          labelWidthMm: Number(item.labelWidthMm ?? item.widthMm ?? 60),
          labelHeightMm: Number(item.labelHeightMm ?? item.heightMm ?? 30),
          cols: Number(item.cols ?? item.columns ?? 3),
          rows: Number(item.rows ?? 9),
          marginTopMm: Number(item.marginTopMm ?? item.paddingTopMm ?? 0),
          marginLeftMm: Number(item.marginLeftMm ?? item.paddingLeftMm ?? 0),
          colGapMm: Number(item.colGapMm ?? item.gapXMm ?? 0),
          rowGapMm: Number(item.rowGapMm ?? item.gapYMm ?? 0),
        };
        return buildCustomLabelPreset(draft, id);
      });
  } catch {
    return [];
  }
}

function persistCustomLabelDrafts(presets: LabelPresetConfig[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const serialized = presets.map((p) => ({
    id: p.id,
    name: p.name.replace(/\s*\([^)]*mm\s*•[^)]*\)\s*$/, '').trim(),
    paperType: p.category,
    labelWidthMm: p.labelWidthMm,
    labelHeightMm: p.labelHeightMm,
    cols: p.cols,
    rows: p.rows,
    marginTopMm: p.marginTopMm,
    marginLeftMm: p.marginLeftMm,
    colGapMm: p.colGapMm,
    rowGapMm: p.rowGapMm,
  }));
  window.localStorage.setItem(CUSTOM_LABELS_STORAGE_KEY, JSON.stringify(serialized));
}

export function saveCustomLabelPreset(draft: CustomLabelDraft): {
  saved: LabelPresetConfig;
  all: LabelPresetConfig[];
} {
  const existing = loadCustomLabelPresets();
  const newId: LabelSizePreset = `custom_${Date.now()}`;
  const saved = buildCustomLabelPreset(draft, newId);
  const all = [saved, ...existing];
  persistCustomLabelDrafts(all);
  return { saved, all };
}

export function deleteCustomLabelPreset(id: string): LabelPresetConfig[] {
  const existing = loadCustomLabelPresets();
  const filtered = existing.filter((p) => p.id !== id);
  persistCustomLabelDrafts(filtered);
  return filtered;
}

export const ALL_PRESETS: LabelPresetConfig[] = [
  ...A4_PRESETS,
  ...CARTA_PRESETS,
  ...THERMAL_PRESETS,
];

export function getLabelPresetConfig(
  id: string,
  customPresets?: LabelPresetConfig[]
): LabelPresetConfig {
  // Aliases legados
  if (id === 'a4_4x15_61x19') return ALL_PRESETS.find((p) => p.id === 'a4_65_a4351') || A4_PRESETS[2];
  if (id === 'a4_4x12_47x25') return ALL_PRESETS.find((p) => p.id === 'a4_44_a4350') || A4_PRESETS[3];
  if (id === 'a4_3x10_70x30' || id === 'a4_grade') return ALL_PRESETS.find((p) => p.id === 'a4_30_a4356') || A4_PRESETS[5];
  if (id === 'a4_2x10_99x29') return ALL_PRESETS.find((p) => p.id === 'carta_20_6081') || CARTA_PRESETS[3];
  if (id === 'a4_2x7_102x38') return ALL_PRESETS.find((p) => p.id === 'a4_14_a4363') || A4_PRESETS[10];
  if (id === 'gondola_100x35') return ALL_PRESETS.find((p) => p.id === 'termica_grande_100x50') || THERMAL_PRESETS[0];
  if (id === 'gondola_80x30' || id === 'termica_60x40') return ALL_PRESETS.find((p) => p.id === 'termica_gondola_60x30') || THERMAL_PRESETS[0];

  if (id.startsWith('custom_') && id !== 'custom_inline') {
    const pool = customPresets ?? loadCustomLabelPresets();
    const customMatch = pool.find((p) => p.id === id);
    if (customMatch) return customMatch;
  }

  const found = ALL_PRESETS.find((p) => p.id === id);
  return found || THERMAL_PRESETS[0];
}

export interface LabelDesignMetrics {
  barcodeHeight: number;
  narrowWidth: number;
  codeFontSizePt: number;
  nameFontSizePt: number;
  addressCodeFontSizePt: number;
  addressLegendFontSizePt: number;
  priceFontSizePt: number;
  priceSymbolFontSizePt: number;
  priceUnitFontSizePt: number;
  headerMinMm: number;
  headerMaxMm: number;
  headerLines: 1 | 2;
  paddingMm: string;
  isNarrowVertical: boolean;
  isUltraCompact: boolean;
  isCompact: boolean;
}

/**
 * Retorna os parâmetros de escala e dimensões tipográficas calibrados por altura e largura física
 * para impedir qualquer estouro interno ou desalinhamento vertical na impressão.
 */
export function getLabelDesignMetrics(preset: LabelPresetConfig): LabelDesignMetrics {
  const w = preset.labelWidthMm;
  const h = preset.labelHeightMm;

  const isNarrowVertical = w <= 20; // Térmica mini 15x50

  if (isNarrowVertical) {
    return {
      barcodeHeight: 11,
      narrowWidth: 0.65,
      codeFontSizePt: 4.0,
      nameFontSizePt: 4.5,
      addressCodeFontSizePt: 4.6,
      addressLegendFontSizePt: 2.0,
      priceFontSizePt: 5.5,
      priceSymbolFontSizePt: 3.6,
      priceUnitFontSizePt: 3.6,
      headerMinMm: 0,
      headerMaxMm: 5.5,
      headerLines: 2,
      paddingMm: '1.5mm 2mm',
      isNarrowVertical: true,
      isUltraCompact: true,
      isCompact: true,
    };
  }

  // Etiquetas ultra-baixas (<= 14mm: ex Carta 6087 44.45x12.7mm)
  if (h <= 14) {
    return {
      barcodeHeight: 6,
      narrowWidth: 0.7,
      codeFontSizePt: 3.8,
      nameFontSizePt: 4.0,
      addressCodeFontSizePt: 4.6,
      addressLegendFontSizePt: 2.0,
      priceFontSizePt: 5.0,
      priceSymbolFontSizePt: 3.2,
      priceUnitFontSizePt: 3.2,
      headerMinMm: 0,
      headerMaxMm: 2.3,
      headerLines: 1,
      paddingMm: '1.5mm 2mm',
      isNarrowVertical: false,
      isUltraCompact: true,
      isCompact: true,
    };
  }

  // Etiquetas muito baixas / estreitas (14mm < h <= 18mm: ex A4349 26x15mm, A4348 31x17mm, Carta 6089 44.45x16.93mm)
  if (h <= 18) {
    const isTinyWidth = w <= 32;
    return {
      barcodeHeight: isTinyWidth ? 6 : 7,
      narrowWidth: isTinyWidth ? 0.6 : 0.8,
      codeFontSizePt: isTinyWidth ? 3.8 : 4.5,
      nameFontSizePt: isTinyWidth ? 4.1 : 4.8,
      addressCodeFontSizePt: isTinyWidth ? 4.3 : 5.6,
      addressLegendFontSizePt: isTinyWidth ? 1.8 : 2.3,
      priceFontSizePt: isTinyWidth ? 4.6 : 5.8,
      priceSymbolFontSizePt: isTinyWidth ? 3.0 : 3.8,
      priceUnitFontSizePt: isTinyWidth ? 3.0 : 3.8,
      headerMinMm: 0,
      headerMaxMm: isTinyWidth ? 2.4 : 2.9,
      headerLines: 1,
      paddingMm: '1.5mm 2mm',
      isNarrowVertical: false,
      isUltraCompact: true,
      isCompact: true,
    };
  }

  // Etiquetas compactas (18mm < h <= 22.5mm: ex A4351 38.2x21.2mm, Térmica Tripla 33x22mm)
  if (h <= 22.5) {
    const isNarrow = w <= 40;
    return {
      barcodeHeight: 9,
      narrowWidth: isNarrow ? 0.75 : 0.9,
      codeFontSizePt: isNarrow ? 4.8 : 5.2,
      nameFontSizePt: isNarrow ? 5.0 : 5.4,
      addressCodeFontSizePt: isNarrow ? 5.8 : 7.0,
      addressLegendFontSizePt: 2.5,
      priceFontSizePt: isNarrow ? 6.0 : 7.0,
      priceSymbolFontSizePt: 4.0,
      priceUnitFontSizePt: 4.0,
      headerMinMm: 0,
      headerMaxMm: 4.2,
      headerLines: 2,
      paddingMm: '1.5mm 2mm',
      isNarrowVertical: false,
      isUltraCompact: false,
      isCompact: true,
    };
  }

  // Etiquetas médias (22.5mm < h <= 39mm: ex 25.4mm, 30mm, 33.9mm, 38.1mm)
  if (h <= 39) {
    const isWide = w >= 85;
    const isNarrow = w <= 52;
    const hRatio = Math.min(1, Math.max(0, (h - 24) / 14));
    return {
      barcodeHeight: Math.round(13 + hRatio * 5),
      narrowWidth: isNarrow ? 0.9 : 1.3,
      codeFontSizePt: Number(((isNarrow ? 6.0 : 7.0) + hRatio * 0.6).toFixed(1)),
      nameFontSizePt: Number(((isNarrow ? 5.6 : isWide ? 7.6 : 6.4) + hRatio * 0.6).toFixed(1)),
      addressCodeFontSizePt: Number(((isNarrow ? 7.6 : isWide ? 10.8 : 9.2) + hRatio * 0.8).toFixed(1)),
      addressLegendFontSizePt: isNarrow ? 3.0 : 3.8,
      priceFontSizePt: Number(((isNarrow ? 7.2 : isWide ? 10.5 : 8.4) + hRatio * 0.8).toFixed(1)),
      priceSymbolFontSizePt: isNarrow ? 4.5 : 5.6,
      priceUnitFontSizePt: isNarrow ? 4.5 : 5.6,
      headerMinMm: 3.8,
      headerMaxMm: h >= 33 ? 6.0 : 5.2,
      headerLines: 2,
      paddingMm: '1.5mm 2mm',
      isNarrowVertical: false,
      isUltraCompact: false,
      isCompact: false,
    };
  }

  // Etiquetas grandes (39mm < h <= 90mm: ex 46.5mm, 50.8mm, 55mm, 67.7mm, 84.7mm)
  if (h <= 90) {
    const isWide = w >= 90;
    const hRatio = Math.min(1, Math.max(0, (h - 40) / 45));
    return {
      barcodeHeight: Math.round(20 + hRatio * 10),
      narrowWidth: isWide ? 1.8 : 1.4,
      codeFontSizePt: Number(((isWide ? 8.8 : 7.8) + hRatio * 0.8).toFixed(1)),
      nameFontSizePt: Number(((isWide ? 9.6 : 8.4) + hRatio * 1.0).toFixed(1)),
      addressCodeFontSizePt: Number(((isWide ? 14.5 : 12.0) + hRatio * 1.5).toFixed(1)),
      addressLegendFontSizePt: 4.8,
      priceFontSizePt: Number(((isWide ? 14.0 : 11.2) + hRatio * 1.6).toFixed(1)),
      priceSymbolFontSizePt: 6.8,
      priceUnitFontSizePt: 6.8,
      headerMinMm: 6.0,
      headerMaxMm: Number((7.5 + hRatio * 3.0).toFixed(1)),
      headerLines: 2,
      paddingMm: '1.5mm 2mm',
      isNarrowVertical: false,
      isUltraCompact: false,
      isCompact: false,
    };
  }

  // Etiquetas extra grandes / pallet / folha inteira (h > 90mm: ex 127mm, 138.5mm, 288.5mm)
  return {
    barcodeHeight: h >= 200 ? 64 : 42,
    narrowWidth: w >= 150 ? 2.8 : 2.0,
    codeFontSizePt: h >= 200 ? 15.0 : 11.2,
    nameFontSizePt: h >= 200 ? 18.0 : 13.0,
    addressCodeFontSizePt: h >= 200 ? 26.0 : 18.5,
    addressLegendFontSizePt: h >= 200 ? 8.0 : 6.0,
    priceFontSizePt: h >= 200 ? 28.0 : 19.5,
    priceSymbolFontSizePt: h >= 200 ? 12.0 : 8.8,
    priceUnitFontSizePt: h >= 200 ? 12.0 : 8.8,
    headerMinMm: h >= 200 ? 18.0 : 11.0,
    headerMaxMm: h >= 200 ? 32.0 : 19.0,
    headerLines: 2,
    paddingMm: '1.5mm 2mm',
    isNarrowVertical: false,
    isUltraCompact: false,
    isCompact: false,
  };
}
