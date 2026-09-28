export type LabelSizePreset = 
  // 1. Folhas A4
  | 'a4_4x15_61x19'
  | 'a4_4x12_47x25'
  | 'a4_3x10_70x30'
  | 'a4_2x10_99x29'
  | 'a4_2x7_102x38'
  // 2. Impressoras Térmicas
  | 'termica_gondola_60x30'
  | 'termica_padrao_40x25'
  | 'termica_media_50x40'
  | 'termica_grande_100x50'
  | 'termica_dupla_37x30'
  | 'termica_tripla_33x22'
  | 'termica_mini_15x50'
  // Compatibilidade legada
  | 'gondola_100x35'
  | 'gondola_80x30'
  | 'termica_60x40'
  | 'a4_grade';

export interface LabelPresetConfig {
  id: LabelSizePreset;
  name: string;
  category: 'a4' | 'termica';
  categoryLabel: string;
  columns: number;
  rows?: number;
  widthMm: number;
  heightMm: number;
  gapXMm: number;
  gapYMm: number;
  paddingTopMm: number;
  paddingLeftMm: number;
  paddingRightMm?: number;
  paddingBottomMm?: number;
  pageSize: string;
  totalPerSheet?: number;
  description: string;
  badge: string;
}

export const A4_PRESETS: LabelPresetConfig[] = [
  {
    id: 'a4_4x15_61x19',
    name: 'A4 - 4 Colunas x 15 Linhas (61.0mm x 19.0mm - Ex: Pimaco 6182)',
    category: 'a4',
    categoryLabel: '1. IMPRESSORAS COMUNS (Folhas Adesivas A4 - Grades com Margens)',
    columns: 4,
    rows: 15,
    widthMm: 61.0,
    heightMm: 19.0,
    gapXMm: 3.0,
    gapYMm: 3.0,
    paddingTopMm: 10.0,
    paddingLeftMm: 5.0,
    paddingRightMm: 5.0,
    paddingBottomMm: 10.0,
    pageSize: 'A4',
    totalPerSheet: 60,
    description: '60 etiquetas por folha • Formato 61.0mm x 19.0mm',
    badge: '4x15 (60 un)'
  },
  {
    id: 'a4_4x12_47x25',
    name: 'A4 - 4 Colunas x 12 Linhas (46.7mm x 25.4mm - Ex: Pimaco 6187)',
    category: 'a4',
    categoryLabel: '1. IMPRESSORAS COMUNS (Folhas Adesivas A4 - Grades com Margens)',
    columns: 4,
    rows: 12,
    widthMm: 46.7,
    heightMm: 25.4,
    gapXMm: 3.0,
    gapYMm: 3.0,
    paddingTopMm: 10.0,
    paddingLeftMm: 5.0,
    paddingRightMm: 5.0,
    paddingBottomMm: 10.0,
    pageSize: 'A4',
    totalPerSheet: 48,
    description: '48 etiquetas por folha • Formato 46.7mm x 25.4mm',
    badge: '4x12 (48 un)'
  },
  {
    id: 'a4_3x10_70x30',
    name: 'A4 - 3 Colunas x 10 Linhas (70.0mm x 29.7mm - Ex: Pimaco 6281)',
    category: 'a4',
    categoryLabel: '1. IMPRESSORAS COMUNS (Folhas Adesivas A4 - Grades com Margens)',
    columns: 3,
    rows: 10,
    widthMm: 70.0,
    heightMm: 29.7,
    gapXMm: 3.0,
    gapYMm: 3.0,
    paddingTopMm: 10.0,
    paddingLeftMm: 5.0,
    paddingRightMm: 5.0,
    paddingBottomMm: 10.0,
    pageSize: 'A4',
    totalPerSheet: 30,
    description: '30 etiquetas por folha • Formato 70.0mm x 29.7mm',
    badge: '3x10 (30 un)'
  },
  {
    id: 'a4_2x10_99x29',
    name: 'A4 - 2 Colunas x 10 Linhas (99.0mm x 28.9mm - Ex: Pimaco 6180)',
    category: 'a4',
    categoryLabel: '1. IMPRESSORAS COMUNS (Folhas Adesivas A4 - Grades com Margens)',
    columns: 2,
    rows: 10,
    widthMm: 99.0,
    heightMm: 28.9,
    gapXMm: 3.0,
    gapYMm: 3.0,
    paddingTopMm: 10.0,
    paddingLeftMm: 5.0,
    paddingRightMm: 5.0,
    paddingBottomMm: 10.0,
    pageSize: 'A4',
    totalPerSheet: 20,
    description: '20 etiquetas por folha • Formato 99.0mm x 28.9mm',
    badge: '2x10 (20 un)'
  },
  {
    id: 'a4_2x7_102x38',
    name: 'A4 - 2 Colunas x 7 Linhas  (101.6mm x 38.1mm - Ex: Pimaco 6181)',
    category: 'a4',
    categoryLabel: '1. IMPRESSORAS COMUNS (Folhas Adesivas A4 - Grades com Margens)',
    columns: 2,
    rows: 7,
    widthMm: 101.6,
    heightMm: 38.1,
    gapXMm: 3.0,
    gapYMm: 3.0,
    paddingTopMm: 10.0,
    paddingLeftMm: 5.0,
    paddingRightMm: 5.0,
    paddingBottomMm: 10.0,
    pageSize: 'A4',
    totalPerSheet: 14,
    description: '14 etiquetas por folha • Formato 101.6mm x 38.1mm',
    badge: '2x7 (14 un)'
  }
];

export const THERMAL_PRESETS: LabelPresetConfig[] = [
  {
    id: 'termica_gondola_60x30',
    name: 'Térmica Gôndola - 1 Coluna (60mm x 30mm - Padrão do print anterior)',
    category: 'termica',
    categoryLabel: '2. IMPRESSORAS TÉRMICAS (Rolos - Largura x Altura)',
    columns: 1,
    widthMm: 60.0,
    heightMm: 30.0,
    gapXMm: 0,
    gapYMm: 0,
    paddingTopMm: 0,
    paddingLeftMm: 0,
    pageSize: '60mm 30mm',
    description: 'Rolo térmico contínuo 1 coluna • 60mm x 30mm',
    badge: '1 Col (60x30)'
  },
  {
    id: 'termica_padrao_40x25',
    name: 'Térmica Padrão   - 1 Coluna (40mm x 25mm)',
    category: 'termica',
    categoryLabel: '2. IMPRESSORAS TÉRMICAS (Rolos - Largura x Altura)',
    columns: 1,
    widthMm: 40.0,
    heightMm: 25.0,
    gapXMm: 0,
    gapYMm: 0,
    paddingTopMm: 0,
    paddingLeftMm: 0,
    pageSize: '40mm 25mm',
    description: 'Rolo térmico compacto • 40mm x 25mm',
    badge: '1 Col (40x25)'
  },
  {
    id: 'termica_media_50x40',
    name: 'Térmica Média     - 1 Coluna (50mm x 40mm)',
    category: 'termica',
    categoryLabel: '2. IMPRESSORAS TÉRMICAS (Rolos - Largura x Altura)',
    columns: 1,
    widthMm: 50.0,
    heightMm: 40.0,
    gapXMm: 0,
    gapYMm: 0,
    paddingTopMm: 0,
    paddingLeftMm: 0,
    pageSize: '50mm 40mm',
    description: 'Rolo térmico médio • 50mm x 40mm',
    badge: '1 Col (50x40)'
  },
  {
    id: 'termica_grande_100x50',
    name: 'Térmica Grande    - 1 Coluna (100mm x 50mm - Ideal para caixas grandes)',
    category: 'termica',
    categoryLabel: '2. IMPRESSORAS TÉRMICAS (Rolos - Largura x Altura)',
    columns: 1,
    widthMm: 100.0,
    heightMm: 50.0,
    gapXMm: 0,
    gapYMm: 0,
    paddingTopMm: 0,
    paddingLeftMm: 0,
    pageSize: '100mm 50mm',
    description: 'Rolo térmico para caixas e fardos • 100mm x 50mm',
    badge: '1 Col (100x50)'
  },
  {
    id: 'termica_dupla_37x30',
    name: 'Térmica Dupla     - 2 Colunas Lado a Lado (37mm x 30mm cada)',
    category: 'termica',
    categoryLabel: '2. IMPRESSORAS TÉRMICAS (Rolos - Largura x Altura)',
    columns: 2,
    widthMm: 37.0,
    heightMm: 30.0,
    gapXMm: 2.0,
    gapYMm: 0,
    paddingTopMm: 0,
    paddingLeftMm: 0,
    pageSize: '76mm 30mm',
    description: 'Rolo com 2 colunas lado a lado • 37mm x 30mm cada',
    badge: '2 Col (37x30)'
  },
  {
    id: 'termica_tripla_33x22',
    name: 'Térmica Tripla    - 3 Colunas Lado a Lado (33mm x 22mm cada)',
    category: 'termica',
    categoryLabel: '2. IMPRESSORAS TÉRMICAS (Rolos - Largura x Altura)',
    columns: 3,
    widthMm: 33.0,
    heightMm: 22.0,
    gapXMm: 2.0,
    gapYMm: 0,
    paddingTopMm: 0,
    paddingLeftMm: 0,
    pageSize: '103mm 22mm',
    description: 'Rolo com 3 colunas lado a lado • 33mm x 22mm cada',
    badge: '3 Col (33x22)'
  },
  {
    id: 'termica_mini_15x50',
    name: 'Térmica Mini      - 5 Colunas Lado a Lado (15mm x 50mm cada)',
    category: 'termica',
    categoryLabel: '2. IMPRESSORAS TÉRMICAS (Rolos - Largura x Altura)',
    columns: 5,
    widthMm: 15.0,
    heightMm: 50.0,
    gapXMm: 1.5,
    gapYMm: 0,
    paddingTopMm: 0,
    paddingLeftMm: 0,
    pageSize: '82mm 50mm',
    description: 'Rolo com 5 colunas verticais • 15mm x 50mm cada',
    badge: '5 Col (15x50)'
  }
];

export const ALL_PRESETS: LabelPresetConfig[] = [...A4_PRESETS, ...THERMAL_PRESETS];

export function getLabelPresetConfig(id: string): LabelPresetConfig {
  // Aliases legados
  if (id === 'gondola_100x35') return ALL_PRESETS.find(p => p.id === 'termica_grande_100x50') || THERMAL_PRESETS[0];
  if (id === 'gondola_80x30' || id === 'termica_60x40') return ALL_PRESETS.find(p => p.id === 'termica_gondola_60x30') || THERMAL_PRESETS[0];
  if (id === 'a4_grade') return ALL_PRESETS.find(p => p.id === 'a4_3x10_70x30') || A4_PRESETS[2];

  const found = ALL_PRESETS.find(p => p.id === id);
  return found || THERMAL_PRESETS[0];
}

/**
 * Retorna os parâmetros de escala e dimensões tipográficas para cada modelo
 */
export function getLabelDesignMetrics(preset: LabelPresetConfig) {
  const isNarrowVertical = preset.widthMm <= 20; // Térmica mini 15x50
  const isCompact = preset.heightMm <= 22; // 19mm, 22mm
  const isMedium = preset.heightMm > 22 && preset.heightMm <= 32; // 25.4mm, 28.9mm, 29.7mm, 30mm
  const isLarge = preset.heightMm > 32; // 38.1mm, 40mm, 50mm

  if (isNarrowVertical) {
    return {
      barcodeHeight: 16,
      narrowWidth: 1.0,
      codeFontSizePt: 5.5,
      nameFontSizePt: 6.0,
      addressCodeFontSizePt: 8.5,
      addressLegendFontSizePt: 3.5,
      priceFontSizePt: 6.5,
      isNarrowVertical: true
    };
  }

  if (isCompact) {
    return {
      barcodeHeight: 14,
      narrowWidth: 1.2,
      codeFontSizePt: 6.0,
      nameFontSizePt: 6.5,
      addressCodeFontSizePt: 10.5,
      addressLegendFontSizePt: 4.0,
      priceFontSizePt: 6.5,
      isNarrowVertical: false
    };
  }

  if (isMedium) {
    return {
      barcodeHeight: 18,
      narrowWidth: 1.5,
      codeFontSizePt: 7.0,
      nameFontSizePt: 8.0,
      addressCodeFontSizePt: 13.5,
      addressLegendFontSizePt: 4.5,
      priceFontSizePt: 7.5,
      isNarrowVertical: false
    };
  }

  // isLarge
  return {
    barcodeHeight: 24,
    narrowWidth: 1.8,
    codeFontSizePt: 8.0,
    nameFontSizePt: 9.0,
    addressCodeFontSizePt: 16.5,
    addressLegendFontSizePt: 5.2,
    priceFontSizePt: 8.5,
    isNarrowVertical: false
  };
}
