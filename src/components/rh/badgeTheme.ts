export type BadgeStyleTemplate = 'classic' | 'modern_agro' | 'minimal_clean';
export type BadgeSizePreset = 'pvc_54x86' | 'medium_70x100' | 'large_85x120';

export interface BadgeDimensions {
  id: BadgeSizePreset;
  label: string;
  shortLabel: string;
  description: string;
  widthMm: number;
  heightMm: number;
  columnsPerA4Row: number;
  gapMm: number;
  scaleFactor: number;
}

export const BADGE_SIZE_PRESETS: Record<BadgeSizePreset, BadgeDimensions> = {
  pvc_54x86: {
    id: 'pvc_54x86',
    label: 'Padrão PVC (54mm × 86mm)',
    shortLabel: '54mm × 86mm',
    description: 'Tamanho cartão padrão',
    widthMm: 54,
    heightMm: 86,
    columnsPerA4Row: 3,
    gapMm: 8,
    scaleFactor: 1,
  },
  medium_70x100: {
    id: 'medium_70x100',
    label: 'Médio / Credencial (70mm × 100mm)',
    shortLabel: '70mm × 100mm',
    description: 'Ideal para leitura à distância',
    widthMm: 70,
    heightMm: 100,
    columnsPerA4Row: 2,
    gapMm: 10,
    scaleFactor: 1.22,
  },
  large_85x120: {
    id: 'large_85x120',
    label: 'Grande / Visível (85mm × 120mm)',
    shortLabel: '85mm × 120mm',
    description: 'Formato ampliado para plastificação',
    widthMm: 85,
    heightMm: 120,
    columnsPerA4Row: 2,
    gapMm: 8,
    scaleFactor: 1.48,
  },
};

export interface BadgeThemeConfig {
  style: BadgeStyleTemplate;
  size: BadgeSizePreset;
  headerColor: string;
  bodyBgColor: string;
  textColor: string;
  accentColor: string;
  showLogo: boolean;
  showCpf: boolean;
  showAdmissionDate: boolean;
  headerSubtitle: string;
  companyNameFontSize: number;
  employeeNameFontSize: number;
  // 6. Verso do Crachá
  showBackCorporateName: boolean;
  showBackCnpj: boolean;
  showBackIe: boolean;
  showBackAddress: boolean;
  showBackPhone: boolean;
  showBackEmergencyContact: boolean;
  showBackSignatureLine: boolean;
  backNoticeText: string;
}

export const BADGE_THEME_STORAGE_KEY = 'agrocontrol_cracha_theme';

export const COMPANY_FONT_MIN = 8;
export const COMPANY_FONT_MAX = 18;
export const EMPLOYEE_FONT_MIN = 9;
export const EMPLOYEE_FONT_MAX = 20;

export const DEFAULT_BADGE_BACK_NOTICE =
  'Este crachá é de uso estritamente pessoal e intransferível, devendo ser portado em local visível durante o expediente. Em caso de perda, extravio ou desligamento, comunicar e devolver imediatamente ao setor de Recursos Humanos.';

export const DEFAULT_BADGE_THEME: BadgeThemeConfig = {
  style: 'classic',
  size: 'pvc_54x86',
  headerColor: '#064e3b',
  bodyBgColor: '#ffffff',
  textColor: '#0f172a',
  accentColor: '#059669',
  showLogo: true,
  showCpf: true,
  showAdmissionDate: true,
  headerSubtitle: '',
  companyNameFontSize: 11,
  employeeNameFontSize: 12,
  showBackCorporateName: true,
  showBackCnpj: true,
  showBackIe: true,
  showBackAddress: true,
  showBackPhone: true,
  showBackEmergencyContact: true,
  showBackSignatureLine: true,
  backNoticeText: DEFAULT_BADGE_BACK_NOTICE,
};

export function clampFontSize(val: unknown, min: number, max: number, fallback: number): number {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.round(num)));
}

export function getBadgeDimensions(size?: BadgeSizePreset): BadgeDimensions {
  if (size && BADGE_SIZE_PRESETS[size]) {
    return BADGE_SIZE_PRESETS[size];
  }
  return BADGE_SIZE_PRESETS.pvc_54x86;
}

export function normalizeHexColor(value: string | undefined, fallback: string): string {
  if (!value || typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase();
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed.toLowerCase()}`;
  return fallback;
}

export function isLightHexColor(hex: string): boolean {
  const clean = normalizeHexColor(hex, '#ffffff').replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62;
}

export function getStoredBadgeTheme(): BadgeThemeConfig {
  try {
    const raw = localStorage.getItem(BADGE_THEME_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_BADGE_THEME };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_BADGE_THEME };

    const validStyles: BadgeStyleTemplate[] = ['classic', 'modern_agro', 'minimal_clean'];
    const validSizes: BadgeSizePreset[] = ['pvc_54x86', 'medium_70x100', 'large_85x120'];
    return {
      style: validStyles.includes(parsed.style) ? parsed.style : DEFAULT_BADGE_THEME.style,
      size: validSizes.includes(parsed.size) ? parsed.size : DEFAULT_BADGE_THEME.size,
      headerColor: normalizeHexColor(parsed.headerColor, DEFAULT_BADGE_THEME.headerColor),
      bodyBgColor: normalizeHexColor(parsed.bodyBgColor, DEFAULT_BADGE_THEME.bodyBgColor),
      textColor: normalizeHexColor(parsed.textColor, DEFAULT_BADGE_THEME.textColor),
      accentColor: normalizeHexColor(parsed.accentColor, DEFAULT_BADGE_THEME.accentColor),
      showLogo: typeof parsed.showLogo === 'boolean' ? parsed.showLogo : DEFAULT_BADGE_THEME.showLogo,
      showCpf: typeof parsed.showCpf === 'boolean' ? parsed.showCpf : DEFAULT_BADGE_THEME.showCpf,
      showAdmissionDate:
        typeof parsed.showAdmissionDate === 'boolean'
          ? parsed.showAdmissionDate
          : DEFAULT_BADGE_THEME.showAdmissionDate,
      headerSubtitle:
        typeof parsed.headerSubtitle === 'string'
          ? parsed.headerSubtitle
          : DEFAULT_BADGE_THEME.headerSubtitle,
      companyNameFontSize: clampFontSize(
        parsed.companyNameFontSize,
        COMPANY_FONT_MIN,
        COMPANY_FONT_MAX,
        DEFAULT_BADGE_THEME.companyNameFontSize
      ),
      employeeNameFontSize: clampFontSize(
        parsed.employeeNameFontSize,
        EMPLOYEE_FONT_MIN,
        EMPLOYEE_FONT_MAX,
        DEFAULT_BADGE_THEME.employeeNameFontSize
      ),
      showBackCorporateName:
        typeof parsed.showBackCorporateName === 'boolean'
          ? parsed.showBackCorporateName
          : DEFAULT_BADGE_THEME.showBackCorporateName,
      showBackCnpj:
        typeof parsed.showBackCnpj === 'boolean'
          ? parsed.showBackCnpj
          : DEFAULT_BADGE_THEME.showBackCnpj,
      showBackIe:
        typeof parsed.showBackIe === 'boolean'
          ? parsed.showBackIe
          : DEFAULT_BADGE_THEME.showBackIe,
      showBackAddress:
        typeof parsed.showBackAddress === 'boolean'
          ? parsed.showBackAddress
          : DEFAULT_BADGE_THEME.showBackAddress,
      showBackPhone:
        typeof parsed.showBackPhone === 'boolean'
          ? parsed.showBackPhone
          : DEFAULT_BADGE_THEME.showBackPhone,
      showBackEmergencyContact:
        typeof parsed.showBackEmergencyContact === 'boolean'
          ? parsed.showBackEmergencyContact
          : DEFAULT_BADGE_THEME.showBackEmergencyContact,
      showBackSignatureLine:
        typeof parsed.showBackSignatureLine === 'boolean'
          ? parsed.showBackSignatureLine
          : DEFAULT_BADGE_THEME.showBackSignatureLine,
      backNoticeText:
        typeof parsed.backNoticeText === 'string'
          ? parsed.backNoticeText
          : DEFAULT_BADGE_THEME.backNoticeText,
    };
  } catch {
    return { ...DEFAULT_BADGE_THEME };
  }
}

export function saveStoredBadgeTheme(theme: BadgeThemeConfig): void {
  try {
    localStorage.setItem(BADGE_THEME_STORAGE_KEY, JSON.stringify(theme));
  } catch (err) {
    console.warn('Aviso ao salvar personalização do crachá:', err);
  }
}

export type BadgePaperSize =
  | 'a4_portrait'
  | 'a4_landscape'
  | 'a5_portrait'
  | 'pvc_card';

export interface BadgePaperOption {
  id: BadgePaperSize;
  label: string;
  shortLabel: string;
  description: string;
  marginMm: number;
}

export const BADGE_PAPER_STORAGE_KEY = 'agrocontrol_cracha_paper_size';

export const BADGE_PAPER_OPTIONS: Record<BadgePaperSize, BadgePaperOption> = {
  a4_portrait: {
    id: 'a4_portrait',
    label: 'A4 Retrato (210 × 297 mm) — Máximo Aproveitamento',
    shortLabel: 'A4 Retrato (3/pág.)',
    description: 'Acomoda 3 crachás Frente+Verso por folha (54×86mm)',
    marginMm: 6,
  },
  a4_landscape: {
    id: 'a4_landscape',
    label: 'A4 Paisagem (297 × 210 mm) — Crachás Grandes',
    shortLabel: 'A4 Paisagem',
    description: 'Ideal para tamanhos 70×100mm e 85×120mm em grade lado a lado',
    marginMm: 6,
  },
  a5_portrait: {
    id: 'a5_portrait',
    label: 'A5 (148 × 210 mm) — Meia Folha',
    shortLabel: 'A5 (2/pág.)',
    description: 'Acomoda 2 crachás Frente+Verso por página',
    marginMm: 6,
  },
  pvc_card: {
    id: 'pvc_card',
    label: 'Cartão PVC / Etiqueta Térmica (Tamanho Real do Crachá)',
    shortLabel: 'Cartão PVC / Térmica',
    description: '1 face por página (Pág. 1 = Frente, Pág. 2 = Verso) sem margens',
    marginMm: 0,
  },
};

export const BADGE_PAPER_ORDER: BadgePaperSize[] = [
  'a4_portrait',
  'a4_landscape',
  'a5_portrait',
  'pvc_card',
];

export function isValidBadgePaperSize(value: unknown): value is BadgePaperSize {
  return (
    value === 'a4_portrait' ||
    value === 'a4_landscape' ||
    value === 'a5_portrait' ||
    value === 'pvc_card'
  );
}

export function getStoredBadgePaperSize(): BadgePaperSize {
  try {
    const raw = localStorage.getItem(BADGE_PAPER_STORAGE_KEY);
    if (isValidBadgePaperSize(raw)) return raw;
    return 'a4_portrait';
  } catch {
    return 'a4_portrait';
  }
}

export function saveStoredBadgePaperSize(paperSize: BadgePaperSize): void {
  try {
    localStorage.setItem(BADGE_PAPER_STORAGE_KEY, paperSize);
  } catch (err) {
    console.warn('Aviso ao salvar formato de papel do crachá:', err);
  }
}

