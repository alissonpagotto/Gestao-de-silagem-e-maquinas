export interface BrazilianBank {
  code: string;
  displayName: string;
  shortName: string;
  name: string;
  color: string;
  aliases?: string[];
}

/**
 * Lista interna prioritária de instituições financeiras e cooperativas de crédito brasileiras
 * Contém os registros exatos solicitados e principais instituições do agronegócio e varejo
 */
export const BRAZILIAN_BANKS: BrazilianBank[] = [
  {
    code: '001',
    displayName: '001 - Banco do Brasil',
    shortName: 'Banco do Brasil',
    name: 'Banco do Brasil S.A.',
    color: '#003882',
    aliases: ['bb', 'banco brasil', 'brasil'],
  },
  {
    code: '104',
    displayName: '104 - Caixa Econômica Federal',
    shortName: 'Caixa Econômica Federal',
    name: 'Caixa Econômica Federal (CEF)',
    color: '#0066b3',
    aliases: ['cef', 'caixa', 'caixa federal', 'caixa economica'],
  },
  {
    code: '341',
    displayName: '341 - Itaú Unibanco',
    shortName: 'Itaú Unibanco',
    name: 'Itaú Unibanco S.A.',
    color: '#ec7000',
    aliases: ['itau', 'unibanco', 'itau unibanco'],
  },
  {
    code: '133',
    displayName: '133 - Cresol',
    shortName: 'Cresol',
    name: 'Confederação Cresol / Cresol Cooperativa',
    color: '#006837',
    aliases: ['cressol', 'cresol', 'cooperativa cresol', 'coop cresol', 'sistema cresol'],
  },
  {
    code: '756',
    displayName: '756 - Sicoob',
    shortName: 'Sicoob',
    name: 'Banco Cooperativo Sicoob S.A. / Sistema de Cooperativas de Crédito',
    color: '#003641',
    aliases: ['siccob', 'sicoob', 'banco sicoob', 'cooperativa sicoob', 'sicoob credito'],
  },
  {
    code: '748',
    displayName: '748 - Sicredi',
    shortName: 'Sicredi',
    name: 'Banco Cooperativo Sicredi S.A. / Sistema Sicredi',
    color: '#00843d',
    aliases: ['sicredi', 'sicred', 'banco sicredi', 'cooperativa sicredi'],
  },
  {
    code: '237',
    displayName: '237 - Bradesco',
    shortName: 'Bradesco',
    name: 'Banco Bradesco S.A.',
    color: '#cc092f',
    aliases: ['bradesco', 'banco bradesco', 'bradesco sa'],
  },
  {
    code: '033',
    displayName: '033 - Santander',
    shortName: 'Santander',
    name: 'Banco Santander (Brasil) S.A.',
    color: '#ea1d25',
    aliases: ['santander', 'banco santander', 'santander brasil'],
  },
  // Outras instituições populares adicionais
  {
    code: '260',
    displayName: '260 - Nubank',
    shortName: 'Nubank',
    name: 'Nu Pagamentos S.A. (Nubank)',
    color: '#820ad1',
    aliases: ['nu', 'nubank', 'nu pagamentos'],
  },
  {
    code: '077',
    displayName: '077 - Inter',
    shortName: 'Inter',
    name: 'Banco Inter S.A.',
    color: '#ff7a00',
    aliases: ['inter', 'banco inter'],
  },
  {
    code: '041',
    displayName: '041 - Banrisul',
    shortName: 'Banrisul',
    name: 'Banco do Estado do Rio Grande do Sul (Banrisul)',
    color: '#004f9f',
    aliases: ['banrisul'],
  },
  {
    code: '336',
    displayName: '336 - C6 Bank',
    shortName: 'C6 Bank',
    name: 'Banco C6 S.A.',
    color: '#242424',
    aliases: ['c6', 'c6 bank'],
  },
  {
    code: '290',
    displayName: '290 - PagBank',
    shortName: 'PagBank',
    name: 'PagBank / PagSeguro Internet S.A.',
    color: '#00a868',
    aliases: ['pagbank', 'pagseguro'],
  },
  {
    code: '422',
    displayName: '422 - Safra',
    shortName: 'Safra',
    name: 'Banco Safra S.A.',
    color: '#b99b58',
    aliases: ['safra', 'banco safra'],
  },
  {
    code: '004',
    displayName: '004 - Banco do Nordeste',
    shortName: 'Banco do Nordeste',
    name: 'Banco do Nordeste do Brasil (BNB)',
    color: '#b5121b',
    aliases: ['bnb', 'nordeste', 'banco do nordeste'],
  },
  {
    code: '085',
    displayName: '085 - Ailos',
    shortName: 'Ailos',
    name: 'Cooperativa Central de Crédito - Ailos / Viacredi',
    color: '#00857c',
    aliases: ['ailos', 'viacredi'],
  },
  {
    code: '136',
    displayName: '136 - Unicred',
    shortName: 'Unicred',
    name: 'Unicred do Brasil',
    color: '#005544',
    aliases: ['unicred'],
  },
  {
    code: '099',
    displayName: '099 - Caixa Físico / Sede',
    shortName: 'Caixa Sede',
    name: 'Caixa Físico / Espécie Sede',
    color: '#475569',
    aliases: ['caixa fisico', 'caixa sede', 'dinheiro', 'especie'],
  },
];

/**
 * Normaliza strings para busca insensível a maiúsculas, espaços e acentuação
 */
export function normalizeBankSearch(str?: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Verifica se um banco atende à busca (por código, nome, displayName ou aliases)
 */
export function bankMatchesQuery(bank: BrazilianBank, query: string): boolean {
  if (!query) return true;
  const clean = normalizeBankSearch(query);
  const digits = clean.replace(/\D/g, '');

  // Match por código numérico ex: 001, 1, 104, 133, 756, etc.
  if (digits && bank.code.includes(digits)) return true;
  if (digits && digits.length <= 3 && bank.code === digits.padStart(3, '0')) return true;

  // Match por texto no displayName, shortName ou name
  if (normalizeBankSearch(bank.displayName).includes(clean)) return true;
  if (normalizeBankSearch(bank.shortName).includes(clean)) return true;
  if (normalizeBankSearch(bank.name).includes(clean)) return true;

  // Match por aliases (ex: "cressol" para Cresol, "siccob" para Sicoob, "cef" para Caixa, "bb" para Banco do Brasil)
  if (bank.aliases && bank.aliases.some((alias) => normalizeBankSearch(alias).includes(clean) || clean.includes(normalizeBankSearch(alias)))) {
    return true;
  }

  return false;
}

/**
 * Encontra a instituição financeira exata ou mais próxima a partir de código ou texto
 */
export function findBankByQuery(query?: string, code?: string): BrazilianBank | undefined {
  if (code) {
    const cleanCode = code.trim().replace(/\D/g, '').padStart(3, '0');
    const byCode = BRAZILIAN_BANKS.find((b) => b.code === cleanCode);
    if (byCode) return byCode;
  }

  if (!query) return undefined;
  const clean = normalizeBankSearch(query);
  const digits = clean.replace(/\D/g, '');

  if (digits && digits.length <= 3) {
    const pad = digits.padStart(3, '0');
    const exactCode = BRAZILIAN_BANKS.find((b) => b.code === pad);
    if (exactCode) return exactCode;
  }

  return BRAZILIAN_BANKS.find((b) => bankMatchesQuery(b, query));
}
