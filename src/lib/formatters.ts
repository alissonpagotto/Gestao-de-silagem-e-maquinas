/**
 * Comprehensive Brazilian Input Masks, Formatters, Currency Utilities & APIs
 * Silagem Fácil Pro - Gestão Agrícola
 */

// ==========================================
// 1. CPF / CNPJ Dynamic Masking & Sanitizing
// ==========================================

export function cleanDigits(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  return String(value).replace(/\D/g, '');
}

/**
 * Dynamically formats CPF (000.000.000-00) or CNPJ (00.000.000/0000-00)
 */
export function formatCpfCnpj(value: string | undefined | null): string {
  const digits = cleanDigits(value).slice(0, 14);
  if (!digits) return '';

  // CPF: Up to 11 digits
  if (digits.length <= 11) {
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
  }

  // CNPJ: 12 to 14 digits
  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
}

// ==========================================
// 2. Inscrição Estadual (IE) Masking
// ==========================================

export function formatIE(value: string | undefined | null): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (/^isento$/i.test(trimmed)) return 'ISENTO';

  const digits = cleanDigits(value).slice(0, 14);
  if (!digits) return value.toUpperCase();

  // Standard progressive formatting with dots and dash
  if (digits.length <= 8) {
    return digits;
  }
  if (digits.length === 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 8)}-${digits.slice(8)}`;
  }
  if (digits.length <= 12) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}.${digits.slice(9)}`;
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}.${digits.slice(8, 11)}-${digits.slice(11, 14)}`;
}

// ==========================================
// 3. CEP Masking (00000-000)
// ==========================================

export function formatCep(value: string | undefined | null): string {
  const digits = cleanDigits(value).slice(0, 8);
  if (!digits) return '';
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
}

// ==========================================
// 4. Telefone / Celular Masking
// ==========================================

export function formatPhone(value: string | undefined | null): string {
  const digits = cleanDigits(value).slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

// ==========================================
// 4.1 Data Brasileira (DD/MM/AAAA)
// ==========================================

export function formatDateBR(dateString: string | undefined | null): string {
  if (!dateString) return '-';
  try {
    const clean = dateString.split('T')[0];
    const parts = clean.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return new Date(dateString).toLocaleDateString('pt-BR');
  } catch {
    return String(dateString);
  }
}

// ==========================================
// 5. Moeda BRL (R$ 0,00) Formatting & Parsing
// ==========================================

export function formatCurrencyBRL(value: number | undefined | null): string {
  const num = typeof value === 'number' && !isNaN(value) ? value : 0;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num);
}

/**
 * Format string or number into currency formatted input value like "1.250,50" or "R$ 1.250,50"
 */
export function formatCurrencyInputDisplay(value: number | string | undefined | null, includePrefix = false): string {
  if (value === undefined || value === null || value === '') return includePrefix ? 'R$ 0,00' : '0,00';
  let num: number;
  if (typeof value === 'number') {
    num = isNaN(value) ? 0 : value;
  } else {
    num = parseCurrencyInput(value);
  }
  const formatted = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
  return includePrefix ? `R$ ${formatted}` : formatted;
}

/**
 * Parses user input like "R$ 3.400,00", "R$ 1.200,00", "3400", "1200", "3.400,50", "3400,00" into a clean numeric float.
 * Removes "R$", whitespace, thousands separators, and converts decimal commas to dots.
 * Guaranteed never to return NaN.
 */
export function parseCurrencyToFloat(value: string | number | undefined | null): number {
  if (value === undefined || value === null || value === '') return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;

  let str = String(value).trim();
  if (!str) return 0;

  // Remove "R$" and spaces
  str = str.replace(/[R$\s]/g, '');
  if (!str) return 0;

  // If format contains both '.' and ',', standard Brazilian format: "3.400,50" -> "3400.50"
  if (str.includes('.') && str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',')) {
    // e.g. "3400,50" -> "3400.50"
    str = str.replace(',', '.');
  } else if (str.includes('.')) {
    // Check if dot is thousands separator or decimal point
    const dotCount = (str.match(/\./g) || []).length;
    if (dotCount > 1) {
      str = str.replace(/\./g, '');
    } else {
      const parts = str.split('.');
      if (parts.length === 2 && parts[1].length === 3) {
        str = parts[0] + parts[1];
      }
    }
  }

  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Backward compatibility alias for parseCurrencyToFloat
 */
export const parseCurrencyInput = parseCurrencyToFloat;

/**
 * Real-time currency input mask for Brazilian standard (BRL - R$).
 * Formats values dynamically while typing, supporting both raw numbers (3400 -> "R$ 3.400,00")
 * and progressive keystrokes (e.g., typing digits and commas).
 */
export function maskCurrencyBRLInput(value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'number') {
    if (isNaN(value)) return '';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }

  const str = String(value).trim();
  if (!str) return '';

  // Clean out R$ and whitespace
  const clean = str.replace(/[R$\s]/g, '');
  if (!clean) return '';

  const hasComma = clean.includes(',');
  const hasDotAsDecimal = !hasComma && clean.includes('.') && clean.indexOf('.') === clean.lastIndexOf('.') && (clean.length - clean.indexOf('.') <= 3);

  if (hasComma || hasDotAsDecimal) {
    const separator = hasComma ? ',' : '.';
    const parts = clean.split(separator);
    const intDigits = parts[0].replace(/\D/g, '');
    const decDigits = parts[1] ? parts[1].replace(/\D/g, '').slice(0, 2) : '';

    const intVal = intDigits ? parseInt(intDigits, 10) : 0;
    const formattedInt = new Intl.NumberFormat('pt-BR').format(intVal);

    if (clean.endsWith(',') || clean.endsWith('.')) {
      return `R$ ${formattedInt},`;
    }
    return `R$ ${formattedInt},${decDigits}`;
  }

  // Pure integer digits
  const digits = clean.replace(/\D/g, '');
  if (!digits) return '';
  const num = parseInt(digits, 10);
  const formatted = new Intl.NumberFormat('pt-BR').format(num);
  return `R$ ${formatted}`;
}

/**
 * Ensures a valid two-decimal BRL string on input blur (e.g. "R$ 3.400" -> "R$ 3.400,00")
 */
export function formatCurrencyBRLOnBlur(value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === '') return '';
  const num = parseCurrencyToFloat(value);
  if (num === 0 && (String(value).trim() === '' || String(value).trim() === '0')) return '';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num);
}

/**
 * Live typing currency mask: as user types digits, shifts cents
 * e.g., typing '1' -> '0,01', '12' -> '0,12', '125' -> '1,25', '1250' -> '12,50', '125000' -> '1.250,00'
 */
export function maskCurrencyLive(value: string | number): string {
  const digits = cleanDigits(value);
  if (!digits) return '';
  const cents = parseInt(digits, 10);
  const floatVal = cents / 100;
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(floatVal);
}

/**
 * Função de máscara monetária: formata o valor em tempo real para BRL deslocando casas decimais
 * - "1" -> "0,01"
 * - "10" -> "0,10"
 * - "100" -> "1,00"
 * - "150000" -> "1.500,00"
 */
export function formatarMoeda(valor: string | number | undefined | null): string {
  if (valor === undefined || valor === null) return '';
  const apenasDigitos = String(valor).replace(/\D/g, '');
  if (!apenasDigitos) return '';
  const centavos = Number(apenasDigitos) / 100;
  return centavos.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Converte a string formatada em moeda BRL de volta para número puro (float)
 */
export function desformatarMoeda(valorFormatado: string | undefined | null): number {
  if (!valorFormatado) return 0;
  const apenasDigitos = String(valorFormatado).replace(/\D/g, '');
  if (!apenasDigitos) return 0;
  return Number(apenasDigitos) / 100;
}

// ==========================================
// 6. Online CEP Lookup (ViaCEP + BrasilAPI)
// ==========================================

export interface CepLookupResult {
  success: boolean;
  cep?: string;
  street?: string; // Logradouro
  neighborhood?: string; // Bairro
  city?: string; // Cidade / Município
  state?: string; // UF
  message?: string;
}

export async function fetchAddressByCep(cep: string): Promise<CepLookupResult> {
  const digits = cleanDigits(cep);
  if (digits.length !== 8) {
    return { success: false, message: 'CEP deve ter 8 dígitos.' };
  }

  // Strategy 1: ViaCEP
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (!data.erro) {
        return {
          success: true,
          cep: formatCep(data.cep || digits),
          street: data.logradouro || '',
          neighborhood: data.bairro || '',
          city: data.localidade || '',
          state: data.uf || '',
        };
      }
    }
  } catch (err) {
    console.warn('ViaCEP lookup failed, trying BrasilAPI...', err);
  }

  // Strategy 2: BrasilAPI Fallback
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`https://brasilapi.com.br/api/cep/v1/${digits}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      return {
        success: true,
        cep: formatCep(data.cep || digits),
        street: data.street || '',
        neighborhood: data.neighborhood || '',
        city: data.city || '',
        state: data.state || '',
      };
    }
  } catch (err) {
    console.warn('BrasilAPI CEP lookup failed:', err);
  }

  return { success: false, message: 'CEP não encontrado ou serviço temporariamente indisponível.' };
}

// ==========================================
// 7. Online CNPJ Lookup (BrasilAPI + Fallback)
// ==========================================

export interface CnpjLookupResult {
  success: boolean;
  cnpj?: string;
  corporateName?: string; // Razão Social
  tradeName?: string; // Nome Fantasia
  phone?: string;
  email?: string;
  zipCode?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  status?: string;
  activitySector?: string;
  message?: string;
}

export async function fetchCompanyByCnpj(cnpj: string): Promise<CnpjLookupResult> {
  const digits = cleanDigits(cnpj);
  if (digits.length !== 14) {
    return { success: false, message: 'CNPJ deve ter 14 dígitos.' };
  }

  // Strategy 1: BrasilAPI
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      
      // Extract phone & format
      let phone = '';
      if (data.ddd_telefone_1) {
        phone = formatPhone(data.ddd_telefone_1);
      } else if (data.telefone) {
        phone = formatPhone(data.telefone);
      }

      return {
        success: true,
        cnpj: formatCpfCnpj(digits),
        corporateName: data.razao_social || '',
        tradeName: data.nome_fantasia || data.razao_social || '',
        phone,
        email: (data.email || '').toLowerCase(),
        zipCode: formatCep(data.cep || ''),
        street: data.logradouro ? `${data.descricao_tipo_de_logradouro ? data.descricao_tipo_de_logradouro + ' ' : ''}${data.logradouro}`.trim() : '',
        number: data.numero || '',
        complement: data.complemento || '',
        neighborhood: data.bairro || '',
        city: data.municipio || '',
        state: data.uf || '',
        status: data.descricao_situacao_cadastral || 'ATIVA',
        activitySector: data.cnae_fiscal_descricao || 'GESTÃO AGRÍCOLA',
      };
    }
  } catch (err) {
    console.warn('BrasilAPI CNPJ lookup failed, trying MinhaReceita...', err);
  }

  // Strategy 2: MinhaReceita.org Fallback
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`https://minhareceita.org/${digits}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      return {
        success: true,
        cnpj: formatCpfCnpj(digits),
        corporateName: data.razao_social || '',
        tradeName: data.nome_fantasia || data.razao_social || '',
        phone: formatPhone(data.ddd_telefone_1 || ''),
        email: (data.email || '').toLowerCase(),
        zipCode: formatCep(data.cep || ''),
        street: data.logradouro || '',
        number: data.numero || '',
        complement: data.complemento || '',
        neighborhood: data.bairro || '',
        city: data.municipio || '',
        state: data.uf || '',
        status: data.descricao_situacao_cadastral || 'ATIVA',
      };
    }
  } catch (err) {
    console.warn('MinhaReceita lookup failed:', err);
  }

  return { success: false, message: 'CNPJ não localizado na base pública da Receita Federal.' };
}
