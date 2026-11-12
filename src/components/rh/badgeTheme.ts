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
}

export const BADGE_THEME_STORAGE_KEY = 'agrocontrol_cracha_theme';

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
};

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
