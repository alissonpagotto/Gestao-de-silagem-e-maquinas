import { Employee } from '../../types';

/**
 * Tabela oficial ISO/IEC 15417 de padrões de barras/espaços Code 128 (valores 0 a 106).
 * Cada entrada (0..105) possui 6 larguras alternadas (barra, espaço, barra, espaço, barra, espaço) somando 11 módulos.
 * O símbolo STOP (106) possui 7 larguras somando 13 módulos.
 */
const CODE128_PATTERNS: readonly string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213', // 0-9
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132', // 10-19
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211', // 20-29
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313', // 30-39
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331', // 40-49
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111', // 50-59
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214', // 60-69
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', // 70-79
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141', // 80-89
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141', // 90-99
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112', // 100-106 (104=Start B, 105=Start C, 106=Stop)
];

export interface Code128Bar {
  x: number;
  width: number;
}

export interface Code128EncodedResult {
  bars: Code128Bar[];
  totalWidth: number;
  quietZone: number;
}

/**
 * Codifica uma string ASCII (32..127) no padrão Code 128 Set B com dígito verificador Mod 103
 * e zonas de silêncio (quiet zones) laterais de 10 módulos para leitura confiável por scanners.
 */
export function encodeCode128B(rawValue: string): Code128EncodedResult {
  const sanitized = (rawValue || '')
    .split('')
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code >= 32 && code <= 127;
    })
    .join('') || '00000';

  const startCode = 104; // Start Code B
  const symbolValues: number[] = [startCode];
  let checksum = startCode;

  for (let i = 0; i < sanitized.length; i++) {
    const val = sanitized.charCodeAt(i) - 32;
    symbolValues.push(val);
    checksum += val * (i + 1);
  }

  symbolValues.push(checksum % 103); // Check character
  symbolValues.push(106); // Stop symbol

  const quietZone = 10;
  let cursor = quietZone;
  const bars: Code128Bar[] = [];

  for (const sym of symbolValues) {
    const pattern = CODE128_PATTERNS[sym] || '';
    for (let j = 0; j < pattern.length; j++) {
      const w = Number(pattern[j]);
      if (j % 2 === 0) {
        // Índice par = barra preta
        bars.push({ x: cursor, width: w });
      }
      cursor += w;
    }
  }

  return {
    bars,
    totalWidth: cursor + quietZone,
    quietZone,
  };
}

export function sanitizeBadgeDigits(value?: string | null): string {
  return String(value || '').replace(/\D/g, '').slice(0, 6);
}

export function isValidBadgeRegistrationNumber(value?: string | null): boolean {
  const clean = String(value || '').trim();
  return /^\d{4,6}$/.test(clean);
}

/**
 * Fórmula oficial do Número de Registro / Crachá:
 * [3 primeiros dígitos do CPF] + [2 dígitos sequenciais com zero à esquerda, ex: 01, 02...]
 */
export function generateBadgeRegistrationNumber(cpf: string | undefined, sequenceNumber: number): string {
  const cpfDigits = String(cpf || '').replace(/\D/g, '');
  const prefix = cpfDigits.length >= 3 ? cpfDigits.slice(0, 3) : '000';
  const seq = Math.max(1, Math.floor(sequenceNumber || 1));
  const suffix = String(seq).padStart(2, '0');
  return `${prefix}${suffix}`.slice(0, 6);
}

export function getEmployeeBadgeNumber(emp: Partial<Employee> | null | undefined, fallbackIndex = 1): string {
  if (!emp) return generateBadgeRegistrationNumber(undefined, fallbackIndex);
  const existing = sanitizeBadgeDigits(
    emp.badgeRegistrationNumber ||
      emp.numero_registro ||
      (emp as any).badge_registration_number
  );
  if (isValidBadgeRegistrationNumber(existing)) return existing;
  return generateBadgeRegistrationNumber(emp.cpf, fallbackIndex);
}

/**
 * Garante retrocompatibilidade preenchendo automaticamente o Número de Registro (5 dígitos)
 * para colaboradores já cadastrados que ainda não possuam o código, preservando códigos existentes.
 */
export function backfillEmployeesBadgeNumbers(employees: Employee[]): {
  updated: Employee[];
  changed: boolean;
} {
  if (!Array.isArray(employees) || employees.length === 0) {
    return { updated: employees || [], changed: false };
  }

  const usedNumbers = new Set<string>();
  employees.forEach((emp) => {
    const existing = sanitizeBadgeDigits(
      emp?.badgeRegistrationNumber ||
        emp?.numero_registro ||
        (emp as any)?.badge_registration_number
    );
    if (isValidBadgeRegistrationNumber(existing)) {
      usedNumbers.add(existing);
    }
  });

  let changed = false;
  const updated = employees.map((emp, idx) => {
    if (!emp) return emp;
    const rawExisting = sanitizeBadgeDigits(
      emp.badgeRegistrationNumber ||
        emp.numero_registro ||
        (emp as any).badge_registration_number
    );

    if (isValidBadgeRegistrationNumber(rawExisting)) {
      if (emp.badgeRegistrationNumber !== rawExisting || emp.numero_registro !== rawExisting) {
        changed = true;
        return {
          ...emp,
          badgeRegistrationNumber: rawExisting,
          numero_registro: rawExisting,
        };
      }
      return emp;
    }

    let seq = idx + 1;
    let candidate = generateBadgeRegistrationNumber(emp.cpf, seq);
    while (usedNumbers.has(candidate) && seq < 999) {
      seq += 1;
      candidate = generateBadgeRegistrationNumber(emp.cpf, seq);
    }
    usedNumbers.add(candidate);
    changed = true;

    return {
      ...emp,
      badgeRegistrationNumber: candidate,
      numero_registro: candidate,
    };
  });

  return { updated, changed };
}
