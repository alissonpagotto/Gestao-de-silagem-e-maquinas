import { identifyBankCode } from './BankLogoIcon';

export interface BankTheme {
  code: string;
  bankName: string;
  bgCard: string;
  borderCard: string;
  hoverBorder: string;
  textPrimary: string;
  textSecondary: string;
  accentBar: string;
  accentTag: string;
  innerCardBg: string;
  badgeBg: string;
  brandColor: string;
}

const DEFAULT_THEME: BankTheme = {
  code: '',
  bankName: 'Conta Bancária',
  bgCard: 'bg-white dark:bg-stone-900',
  borderCard: 'border-slate-200 dark:border-stone-700',
  hoverBorder: 'hover:border-slate-300 dark:hover:border-stone-600',
  textPrimary: 'text-slate-900 dark:text-stone-100',
  textSecondary: 'text-slate-500 dark:text-stone-400',
  accentBar: '#0963cb',
  accentTag: 'bg-slate-100 text-slate-700 border-slate-200',
  innerCardBg: 'bg-slate-50/90 dark:bg-stone-800/80 border-slate-200/80 dark:border-stone-700',
  badgeBg: 'bg-slate-100 text-slate-700 border-slate-200',
  brandColor: '#0963cb',
};

const BANK_THEMES: Record<string, BankTheme> = {
  // 001 - Banco do Brasil: Fundo amarelo corporativo suave com bordas e contrastes azul escuro
  '001': {
    code: '001',
    bankName: 'Banco do Brasil',
    bgCard: 'bg-amber-50 dark:bg-amber-950/25',
    borderCard: 'border-blue-900/35 dark:border-blue-700/60',
    hoverBorder: 'hover:border-blue-900/70 dark:hover:border-blue-600',
    textPrimary: 'text-blue-950 dark:text-amber-100',
    textSecondary: 'text-blue-900/80 dark:text-amber-200/75',
    accentBar: '#003882',
    accentTag: 'bg-blue-100 text-blue-950 border-blue-300',
    innerCardBg: 'bg-white/95 dark:bg-stone-900/90 border-blue-200/80 dark:border-blue-900/50',
    badgeBg: 'bg-blue-100/90 text-blue-950 border-blue-300/80 font-bold',
    brandColor: '#003882',
  },

  // 104 - Caixa Econômica Federal: Fundo azul institucional claro
  '104': {
    code: '104',
    bankName: 'Caixa Econômica Federal',
    bgCard: 'bg-sky-100/85 dark:bg-sky-950/30',
    borderCard: 'border-sky-300/90 dark:border-sky-800/70',
    hoverBorder: 'hover:border-sky-400 dark:hover:border-sky-600',
    textPrimary: 'text-sky-950 dark:text-sky-100',
    textSecondary: 'text-sky-900/80 dark:text-sky-200/75',
    accentBar: '#0066B3',
    accentTag: 'bg-sky-200/80 text-sky-950 border-sky-300',
    innerCardBg: 'bg-white/95 dark:bg-stone-900/90 border-sky-200/90 dark:border-sky-900/50',
    badgeBg: 'bg-sky-200/80 text-sky-950 border-sky-300/80',
    brandColor: '#0066B3',
  },

  // 341 - Itaú Unibanco: Fundo laranja suave elegante
  '341': {
    code: '341',
    bankName: 'Itaú Unibanco',
    bgCard: 'bg-orange-50 dark:bg-orange-950/25',
    borderCard: 'border-orange-300/80 dark:border-orange-800/60',
    hoverBorder: 'hover:border-orange-400 dark:hover:border-orange-700',
    textPrimary: 'text-amber-950 dark:text-orange-100',
    textSecondary: 'text-amber-900/80 dark:text-orange-200/75',
    accentBar: '#EC7000',
    accentTag: 'bg-orange-200/70 text-amber-950 border-orange-300/80',
    innerCardBg: 'bg-white/95 dark:bg-stone-900/90 border-orange-200/90 dark:border-orange-900/50',
    badgeBg: 'bg-orange-100 text-amber-950 border-orange-300/70',
    brandColor: '#EC7000',
  },

  // 133 - Cresol: Fundo grafite premium / verde escuro suave
  '133': {
    code: '133',
    bankName: 'Cresol',
    bgCard: 'bg-emerald-50/90 dark:bg-emerald-950/25',
    borderCard: 'border-emerald-300/80 dark:border-emerald-800/60',
    hoverBorder: 'hover:border-emerald-400 dark:hover:border-emerald-700',
    textPrimary: 'text-emerald-950 dark:text-emerald-100',
    textSecondary: 'text-emerald-800/80 dark:text-emerald-200/75',
    accentBar: '#006837',
    accentTag: 'bg-emerald-200/70 text-emerald-950 border-emerald-300/80',
    innerCardBg: 'bg-white/95 dark:bg-stone-900/90 border-emerald-200/90 dark:border-emerald-900/50',
    badgeBg: 'bg-emerald-100 text-emerald-950 border-emerald-300/70',
    brandColor: '#006837',
  },

  // 756 - Sicoob: Fundo verde oliva/musgo suave
  '756': {
    code: '756',
    bankName: 'Sicoob',
    bgCard: 'bg-teal-50 dark:bg-teal-950/25',
    borderCard: 'border-teal-300/80 dark:border-teal-800/60',
    hoverBorder: 'hover:border-teal-400 dark:hover:border-teal-700',
    textPrimary: 'text-teal-950 dark:text-teal-100',
    textSecondary: 'text-teal-800/80 dark:text-teal-200/75',
    accentBar: '#003641',
    accentTag: 'bg-teal-200/70 text-teal-950 border-teal-300/80',
    innerCardBg: 'bg-white/95 dark:bg-stone-900/90 border-teal-200/90 dark:border-teal-900/50',
    badgeBg: 'bg-teal-100 text-teal-950 border-teal-300/70',
    brandColor: '#003641',
  },

  // 748 / 074 - Sicredi: Fundo verde limão característico cooperativo
  '748': {
    code: '748',
    bankName: 'Sicredi',
    bgCard: 'bg-emerald-50 dark:bg-emerald-950/25',
    borderCard: 'border-green-300/80 dark:border-green-800/60',
    hoverBorder: 'hover:border-green-400 dark:hover:border-green-700',
    textPrimary: 'text-green-950 dark:text-green-100',
    textSecondary: 'text-green-800/80 dark:text-green-200/75',
    accentBar: '#00843D',
    accentTag: 'bg-green-200/70 text-green-950 border-green-300/80',
    innerCardBg: 'bg-white/95 dark:bg-stone-900/90 border-green-200/90 dark:border-green-900/50',
    badgeBg: 'bg-green-100 text-green-950 border-green-300/70',
    brandColor: '#00843D',
  },

  '074': {
    code: '074',
    bankName: 'Sicredi',
    bgCard: 'bg-emerald-50 dark:bg-emerald-950/25',
    borderCard: 'border-green-300/80 dark:border-green-800/60',
    hoverBorder: 'hover:border-green-400 dark:hover:border-green-700',
    textPrimary: 'text-green-950 dark:text-green-100',
    textSecondary: 'text-green-800/80 dark:text-green-200/75',
    accentBar: '#00843D',
    accentTag: 'bg-green-200/70 text-green-950 border-green-300/80',
    innerCardBg: 'bg-white/95 dark:bg-stone-900/90 border-green-200/90 dark:border-green-900/50',
    badgeBg: 'bg-green-100 text-green-950 border-green-300/70',
    brandColor: '#00843D',
  },

  // 260 - Nubank: Fundo roxo suave elegante
  '260': {
    code: '260',
    bankName: 'Nubank',
    bgCard: 'bg-purple-50 dark:bg-purple-950/25',
    borderCard: 'border-purple-300/80 dark:border-purple-800/60',
    hoverBorder: 'hover:border-purple-400 dark:hover:border-purple-700',
    textPrimary: 'text-purple-950 dark:text-purple-100',
    textSecondary: 'text-purple-800/80 dark:text-purple-200/75',
    accentBar: '#820AD1',
    accentTag: 'bg-purple-200/70 text-purple-950 border-purple-300/80',
    innerCardBg: 'bg-white/95 dark:bg-stone-900/90 border-purple-200/90 dark:border-purple-900/50',
    badgeBg: 'bg-purple-100 text-purple-950 border-purple-300/70',
    brandColor: '#820AD1',
  },

  // 237 - Bradesco: Fundo vermelho suave institucional
  '237': {
    code: '237',
    bankName: 'Bradesco',
    bgCard: 'bg-rose-50/90 dark:bg-rose-950/25',
    borderCard: 'border-rose-300/80 dark:border-rose-800/60',
    hoverBorder: 'hover:border-rose-400 dark:hover:border-rose-700',
    textPrimary: 'text-rose-950 dark:text-rose-100',
    textSecondary: 'text-rose-800/75 dark:text-rose-200/70',
    accentBar: '#CC092F',
    accentTag: 'bg-rose-200/70 text-rose-950 border-rose-300/80',
    innerCardBg: 'bg-white/95 dark:bg-stone-900/90 border-rose-200/90 dark:border-rose-900/50',
    badgeBg: 'bg-rose-100 text-rose-950 border-rose-300/70',
    brandColor: '#CC092F',
  },

  // 033 - Santander: Fundo vermelho claro suave
  '033': {
    code: '033',
    bankName: 'Santander',
    bgCard: 'bg-red-50/90 dark:bg-red-950/25',
    borderCard: 'border-red-300/80 dark:border-red-800/60',
    hoverBorder: 'hover:border-red-400 dark:hover:border-red-700',
    textPrimary: 'text-red-950 dark:text-red-100',
    textSecondary: 'text-red-800/75 dark:text-red-200/70',
    accentBar: '#EA1D25',
    accentTag: 'bg-red-200/70 text-red-950 border-red-300/80',
    innerCardBg: 'bg-white/95 dark:bg-stone-900/90 border-red-200/90 dark:border-red-900/50',
    badgeBg: 'bg-red-100 text-red-950 border-red-300/70',
    brandColor: '#EA1D25',
  },

  // 077 - Inter: Fundo laranja claro moderno
  '077': {
    code: '077',
    bankName: 'Banco Inter',
    bgCard: 'bg-orange-50/90 dark:bg-orange-950/25',
    borderCard: 'border-orange-300/80 dark:border-orange-800/60',
    hoverBorder: 'hover:border-orange-400 dark:hover:border-orange-700',
    textPrimary: 'text-orange-950 dark:text-orange-100',
    textSecondary: 'text-orange-800/75 dark:text-orange-200/70',
    accentBar: '#FF7A00',
    accentTag: 'bg-orange-200/70 text-orange-950 border-orange-300/80',
    innerCardBg: 'bg-white/95 dark:bg-stone-900/90 border-orange-200/90 dark:border-orange-900/50',
    badgeBg: 'bg-orange-100 text-orange-950 border-orange-300/70',
    brandColor: '#FF7A00',
  },

  // 041 - Banrisul: Fundo azul claro corporativo com bordas e contrastes azul
  '041': {
    code: '041',
    bankName: 'Banrisul',
    bgCard: 'bg-blue-50/90 dark:bg-blue-950/25',
    borderCard: 'border-blue-300/80 dark:border-blue-800/60',
    hoverBorder: 'hover:border-blue-400 dark:hover:border-blue-700',
    textPrimary: 'text-blue-950 dark:text-blue-100',
    textSecondary: 'text-blue-900/80 dark:text-blue-200/75',
    accentBar: '#004F9F',
    accentTag: 'bg-blue-200/70 text-blue-950 border-blue-300/80',
    innerCardBg: 'bg-white/95 dark:bg-stone-900/90 border-blue-200/90 dark:border-blue-900/50',
    badgeBg: 'bg-blue-100 text-blue-950 border-blue-300/70',
    brandColor: '#004F9F',
  },

  // 336 - C6 Bank: Fundo grafite escuro/preto fosco com textos em branco
  '336': {
    code: '336',
    bankName: 'C6 Bank',
    bgCard: 'bg-zinc-900 dark:bg-zinc-950',
    borderCard: 'border-zinc-700 dark:border-zinc-800',
    hoverBorder: 'hover:border-zinc-500 dark:hover:border-zinc-600',
    textPrimary: 'text-white dark:text-zinc-100',
    textSecondary: 'text-zinc-300 dark:text-zinc-400',
    accentBar: '#18181B',
    accentTag: 'bg-zinc-800 text-zinc-100 border-zinc-700',
    innerCardBg: 'bg-zinc-800/95 dark:bg-zinc-900/95 border-zinc-700/80 dark:border-zinc-800',
    badgeBg: 'bg-zinc-800 text-zinc-100 border-zinc-700',
    brandColor: '#242424',
  },

  // 290 - PagBank: Fundo verde e amarelo suave
  '290': {
    code: '290',
    bankName: 'PagBank',
    bgCard: 'bg-emerald-50/85 dark:bg-emerald-950/25',
    borderCard: 'border-emerald-300/80 dark:border-emerald-800/60',
    hoverBorder: 'hover:border-emerald-400 dark:hover:border-emerald-700',
    textPrimary: 'text-emerald-950 dark:text-emerald-100',
    textSecondary: 'text-emerald-800/80 dark:text-emerald-200/75',
    accentBar: '#00A868',
    accentTag: 'bg-amber-100 text-emerald-950 border-amber-300',
    innerCardBg: 'bg-white/95 dark:bg-stone-900/90 border-emerald-200/90 dark:border-emerald-900/50',
    badgeBg: 'bg-emerald-100 text-emerald-950 border-emerald-300/70',
    brandColor: '#00A868',
  },

  // 422 - Safra: Fundo azul-marinho premium sólido com textos em branco/dourado
  '422': {
    code: '422',
    bankName: 'Banco Safra',
    bgCard: 'bg-slate-900 dark:bg-slate-950',
    borderCard: 'border-amber-600/40 dark:border-amber-500/40',
    hoverBorder: 'hover:border-amber-400 dark:hover:border-amber-400',
    textPrimary: 'text-amber-100 dark:text-amber-50',
    textSecondary: 'text-slate-300 dark:text-slate-400',
    accentBar: '#B99B58',
    accentTag: 'bg-slate-800 text-amber-200 border-amber-600/40',
    innerCardBg: 'bg-slate-800/95 dark:bg-slate-900/95 border-amber-600/30 dark:border-amber-500/30',
    badgeBg: 'bg-slate-800 text-amber-300 border-amber-600/50 font-bold',
    brandColor: '#B99B58',
  },

  // 004 - Banco do Nordeste: Fundo branco ou creme suave
  '004': {
    code: '004',
    bankName: 'Banco do Nordeste',
    bgCard: 'bg-amber-50/70 dark:bg-stone-900/80',
    borderCard: 'border-orange-300/80 dark:border-orange-800/60',
    hoverBorder: 'hover:border-orange-400 dark:hover:border-orange-700',
    textPrimary: 'text-orange-950 dark:text-orange-100',
    textSecondary: 'text-orange-900/80 dark:text-orange-200/75',
    accentBar: '#B5121B',
    accentTag: 'bg-orange-100 text-orange-950 border-orange-300',
    innerCardBg: 'bg-white/95 dark:bg-stone-900/90 border-orange-200/90 dark:border-orange-900/50',
    badgeBg: 'bg-orange-100 text-orange-950 border-orange-300/70',
    brandColor: '#B5121B',
  },

  // 085 - Ailos: Fundo azul petróleo/teal suave
  '085': {
    code: '085',
    bankName: 'Ailos',
    bgCard: 'bg-teal-50 dark:bg-teal-950/25',
    borderCard: 'border-teal-300/80 dark:border-teal-800/60',
    hoverBorder: 'hover:border-teal-400 dark:hover:border-teal-700',
    textPrimary: 'text-teal-950 dark:text-teal-100',
    textSecondary: 'text-teal-800/80 dark:text-teal-200/75',
    accentBar: '#00857C',
    accentTag: 'bg-teal-200/70 text-teal-950 border-teal-300/80',
    innerCardBg: 'bg-white/95 dark:bg-stone-900/90 border-teal-200/90 dark:border-teal-900/50',
    badgeBg: 'bg-teal-100 text-teal-950 border-teal-300/70',
    brandColor: '#00857C',
  },

  // 136 - Unicred: Fundo verde escuro ou dourado suave corporativo
  '136': {
    code: '136',
    bankName: 'Unicred',
    bgCard: 'bg-emerald-50/90 dark:bg-emerald-950/25',
    borderCard: 'border-emerald-300/80 dark:border-emerald-800/60',
    hoverBorder: 'hover:border-emerald-400 dark:hover:border-emerald-700',
    textPrimary: 'text-emerald-950 dark:text-emerald-100',
    textSecondary: 'text-emerald-800/80 dark:text-emerald-200/75',
    accentBar: '#005544',
    accentTag: 'bg-amber-100/90 text-emerald-950 border-amber-300',
    innerCardBg: 'bg-white/95 dark:bg-stone-900/90 border-emerald-200/90 dark:border-emerald-900/50',
    badgeBg: 'bg-emerald-100 text-emerald-950 border-emerald-300/70',
    brandColor: '#005544',
  },

  // 099 - Caixa Físico Sede: Fundo cinza claro neutro de sistema (ex: bg-gray-100)
  '099': {
    code: '099',
    bankName: 'Caixa Físico Sede',
    bgCard: 'bg-gray-100 dark:bg-stone-900/70',
    borderCard: 'border-gray-300 dark:border-stone-700',
    hoverBorder: 'hover:border-gray-400 dark:hover:border-stone-600',
    textPrimary: 'text-gray-900 dark:text-stone-100',
    textSecondary: 'text-gray-600 dark:text-stone-400',
    accentBar: '#475569',
    accentTag: 'bg-gray-200/80 text-gray-800 border-gray-300',
    innerCardBg: 'bg-white/95 dark:bg-stone-900/90 border-gray-200 dark:border-stone-800',
    badgeBg: 'bg-gray-200/80 text-gray-800 border-gray-300 font-bold',
    brandColor: '#475569',
  },
};

/**
 * Retorna dinamicamente o tema visual completo (cores, bordas, contrastes e realces)
 * a partir do código do banco, nome ou tipo de conta
 */
export function getBankTheme(code?: string, name?: string, accountType?: string): BankTheme {
  try {
    if (accountType === 'caixa_fisico') {
      return BANK_THEMES['099'] || DEFAULT_THEME;
    }

    const identifiedId = identifyBankCode(code, name);
    if (identifiedId && BANK_THEMES[identifiedId]) {
      return BANK_THEMES[identifiedId];
    }

    // Alias especial para Sicredi (074 -> 748)
    if (code === '074' || (name && name.toLowerCase().includes('sicredi'))) {
      return BANK_THEMES['748'];
    }

    return DEFAULT_THEME;
  } catch (_) {
    return DEFAULT_THEME;
  }
}
