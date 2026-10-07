import { Employee } from '../../types';

/**
 * Remove acentos e caracteres especiais para compatibilidade com o padrão EMV BACEN
 */
export function sanitizePixText(text: string, maxLength: number): string {
  if (!text) return '';
  const clean = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .trim()
    .toUpperCase();
  return clean.slice(0, maxLength);
}

/**
 * Cálculo do checksum CRC16-CCITT (Polinômio 0x1021, Init 0xFFFF) padrão Bacen
 */
export function crc16Ccitt(str: string): string {
  let crc = 0xffff;
  for (let c = 0; c < str.length; c++) {
    crc ^= str.charCodeAt(c) << 8;
    for (let i = 0; i < 8; i++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Formata um campo no formato TLV (Tag-Length-Value) do padrão EMV
 */
export function emv(id: string, value: string): string {
  const len = String(value.length).padStart(2, '0');
  return id + len + value;
}

/**
 * Busca o colaborador no LocalStorage ('colaca_silagem_funcionarios' ou 'silagem_facil_clean_v1_employees')
 */
export function findEmployeeFromStorage(idOrNameOrCpf?: string): Employee | null {
  if (!idOrNameOrCpf) return null;
  const search = idOrNameOrCpf.trim().toLowerCase();
  const searchDigits = idOrNameOrCpf.replace(/\D/g, '');

  const searchInList = (list: any[]): Employee | null => {
    if (!Array.isArray(list)) return null;
    return (
      list.find(
        e =>
          (e.id && String(e.id) === idOrNameOrCpf) ||
          (e.name && e.name.toLowerCase() === search) ||
          (searchDigits.length >= 10 && e.cpf && e.cpf.replace(/\D/g, '') === searchDigits)
      ) || null
    );
  };

  // 1. Tenta carregar de colaca_silagem_funcionarios
  try {
    const rawColaca = localStorage.getItem('colaca_silagem_funcionarios');
    if (rawColaca) {
      const parsed = JSON.parse(rawColaca);
      const found = searchInList(parsed);
      if (found) return found;
    }
  } catch {}

  // 2. Tenta carregar de silagem_facil_clean_v1_employees
  try {
    const rawV1 = localStorage.getItem('silagem_facil_clean_v1_employees');
    if (rawV1) {
      const parsed = JSON.parse(rawV1);
      const found = searchInList(parsed);
      if (found) return found;
    }
  } catch {}

  return null;
}

/**
 * Normaliza a chave PIX estritamente conforme o padrão oficial do BACEN para iniciação de pagamento:
 * - CPF: exatamente 11 dígitos numéricos (sem pontos e traços)
 * - CNPJ: exatamente 14 dígitos numéricos (sem pontos, barras e traços)
 * - Celular: formato internacional com DDI +55 e DDD (ex: +5527999998888)
 * - E-mail: minúsculas e sem espaços
 * - Chave Aleatória: trimmed
 */
export function normalizePixKeyForBacen(key: string, keyType?: string): string {
  if (!key) return '';
  const raw = key.trim();

  // Se já for payload BR Code completo
  if (raw.startsWith('000201')) return raw;

  // Se for email
  if (raw.includes('@') || keyType?.toUpperCase().includes('MAIL')) {
    return raw.trim().toLowerCase();
  }

  // Se for chave aleatória UUID
  if (/^[0-9a-fA-F-]{32,36}$/.test(raw) || keyType?.toUpperCase().includes('ALEAT')) {
    return raw.trim();
  }

  const digits = raw.replace(/\D/g, '');

  // Se o tipo for explicitamente Celular/Telefone
  if (
    keyType?.toUpperCase().includes('CEL') ||
    keyType?.toUpperCase().includes('TEL') ||
    keyType?.toUpperCase().includes('FONE')
  ) {
    if (raw.startsWith('+55')) {
      return `+55${raw.slice(3).replace(/\D/g, '')}`;
    }
    if (digits.length === 10 || digits.length === 11) {
      return `+55${digits}`;
    }
    if (digits.length === 12 || digits.length === 13) {
      return `+${digits}`;
    }
  }

  // Se o tipo for explicitamente CPF
  if (keyType?.toUpperCase().includes('CPF')) {
    return digits.slice(0, 11);
  }

  // Detecção automática quando não há keyType:
  if (digits.length === 11) {
    // Se tiver formatação típica de celular ou começar com '+'
    if (raw.includes('(') || raw.includes('+') || (raw.startsWith('9') && !raw.includes('.'))) {
      return `+55${digits}`;
    }
    // Caso padrão para 11 dígitos numéricos: CPF
    return digits;
  }

  if (digits.length === 10) {
    // Telefone fixo com DDD
    return `+55${digits}`;
  }

  if (digits.length === 14) {
    // CNPJ
    return digits;
  }

  return raw;
}

/**
 * Extrai a chave PIX do colaborador (lê o campo de Chave Pix / E-mail / Celular / Aleatória / CPF)
 */
export function getEmployeePixKey(emp?: Partial<Employee> | null): string {
  if (!emp) return '';

  // 1. Chave explícita em propriedades chavePix / pixKey
  const directPix = (
    emp.chavePix ||
    (emp as any).chave_pix ||
    emp.pixKey ||
    (emp as any).pix_key ||
    ''
  ).trim();

  if (directPix) {
    return directPix.replace(/^chave\s*pix[:\s-]*/i, '').replace(/^pix[:\s-]*/i, '').trim();
  }

  // 2. Campo bankAccount (onde o usuário digita no input "Conta Corrente (C.C.) / Chave Pix")
  const bankAccount = (emp.bankAccount || (emp as any).conta_corrente || '').trim();
  if (bankAccount) {
    // Se for e-mail
    if (bankAccount.includes('@')) {
      return bankAccount.replace(/^pix[:\s-]*/i, '').trim();
    }
    // Se for chave aleatória UUID
    if (/^[0-9a-fA-F-]{32,36}$/.test(bankAccount)) {
      return bankAccount.replace(/^pix[:\s-]*/i, '').trim();
    }
    // Se contiver o prefixo "pix"
    if (/pix/i.test(bankAccount)) {
      return bankAccount.replace(/^chave\s*pix[:\s-]*/i, '').replace(/^pix[:\s-]*/i, '').trim();
    }
    // Se tiver telefone ou CPF/CNPJ
    const digits = bankAccount.replace(/\D/g, '');
    if (digits.length === 11 || digits.length === 14 || /^\+?55\d{10,11}$/.test(digits)) {
      return bankAccount.replace(/^chave\s*pix[:\s-]*/i, '').replace(/^pix[:\s-]*/i, '').trim();
    }
    // Qualquer texto que não seja apenas placeholder "00000-0"
    if (bankAccount !== '00000-0' && bankAccount !== '0000-0' && bankAccount !== '000-0' && !/^\d{4,6}-\d$/.test(bankAccount)) {
      return bankAccount.replace(/^chave\s*pix[:\s-]*/i, '').replace(/^pix[:\s-]*/i, '').trim();
    }
  }

  // 3. Campo bankPixKey (onde pode estar a chave Pix direta ou Banco)
  const bankPixKey = (emp.bankPixKey || (emp as any).banco_chave_pix || '').trim();
  const knownBanks = [
    'banco do brasil', 'bradesco', 'itau', 'itaú', 'caixa', 'caixa econômica', 'caixa economica',
    'santander', 'sicoob', 'sicredi', 'nubank', 'inter', 'banco inter', 'c6', 'c6 bank', 'banestes',
    'safra', 'banco safra', 'btg', 'original', 'pagbank', 'mercado pago'
  ];

  if (bankPixKey && !knownBanks.includes(bankPixKey.toLowerCase())) {
    return bankPixKey.replace(/^chave\s*pix[:\s-]*/i, '').replace(/^pix[:\s-]*/i, '').trim();
  }

  // 4. Se Forma de Recebimento ou Local de Recebimento contiver "PIX", fallback para o CPF ou Celular do colaborador
  const paymentLoc = (emp.paymentLocation || (emp as any).local_recebimento || '').toLowerCase();
  if (paymentLoc.includes('pix') || bankPixKey.toLowerCase().includes('pix')) {
    if (emp.cpf) {
      const cleanCpf = emp.cpf.replace(/\D/g, '');
      if (cleanCpf.length === 11) return cleanCpf;
    }
    if (emp.phone) {
      const cleanPhone = emp.phone.replace(/\D/g, '');
      if (cleanPhone.length >= 10) return cleanPhone;
    }
  }

  return '';
}

/**
 * Identifica se o colaborador possui chave PIX cadastrada para gerar o QR Code
 */
export function hasEmployeePixPayment(emp?: Partial<Employee> | null): boolean {
  if (!emp) return false;
  const key = getEmployeePixKey(emp);
  return Boolean(key && key.trim().length > 0);
}

/**
 * Gera a string do PIX Copia e Cola no padrão oficial BACEN (EMV QRCPS-MPM).
 * Suporta assinatura por objeto ou argumentos posicionais para compatibilidade ampla.
 */
export function generatePixPayload(
  paramsOrKey: {
    pixKey: string;
    amount?: number;
    merchantName?: string;
    receiverName?: string;
    beneficiaryName?: string;
    merchantCity?: string;
    city?: string;
    txId?: string;
    keyType?: string;
  } | string,
  amountArg?: number,
  receiverNameArg?: string,
  cityArg?: string,
  txIdArg?: string
): string {
  let pixKey = '';
  let amount: number | undefined;
  let beneficiary = 'COLABORADOR';
  let city = 'BRASIL';
  let txId = '***';
  let keyType: string | undefined;

  if (typeof paramsOrKey === 'object' && paramsOrKey !== null) {
    pixKey = paramsOrKey.pixKey || '';
    amount = paramsOrKey.amount;
    beneficiary = paramsOrKey.beneficiaryName || paramsOrKey.receiverName || paramsOrKey.merchantName || 'COLABORADOR';
    city = paramsOrKey.city || paramsOrKey.merchantCity || 'BRASIL';
    txId = paramsOrKey.txId || '***';
    keyType = paramsOrKey.keyType;
  } else if (typeof paramsOrKey === 'string') {
    pixKey = paramsOrKey;
    amount = amountArg;
    beneficiary = receiverNameArg || 'COLABORADOR';
    city = cityArg || 'BRASIL';
    txId = txIdArg || '***';
  }

  const trimmedKey = (pixKey || '').trim();
  if (!trimmedKey) return '';

  // Se a chave já for um payload BR Code completo
  if (trimmedKey.startsWith('000201')) {
    return trimmedKey;
  }

  const cleanKey = normalizePixKeyForBacen(trimmedKey, keyType);
  const cleanName = sanitizePixText(beneficiary, 25) || 'COLABORADOR';
  const cleanCity = sanitizePixText(city, 15) || 'BRASIL';
  const cleanTxId = sanitizePixText(txId, 25) || '***';

  // 00: Payload Format Indicator (01)
  const payloadFormat = emv('00', '01');

  // 01: Point of Initiation Method -> 12 (dinâmico com valor pré-definido) se amount > 0, ou 11
  const pointOfInit = emv('01', amount !== undefined && amount > 0 ? '12' : '11');

  // 26: Merchant Account Information
  const gui = emv('00', 'br.gov.bcb.pix');
  const keyTag = emv('01', cleanKey);
  const accountInfo = emv('26', gui + keyTag);

  // 52: Merchant Category Code (0000)
  const mcc = emv('52', '0000');

  // 53: Transaction Currency (986 = BRL)
  const currency = emv('53', '986');

  // 54: Transaction Amount
  let amountTag = '';
  if (amount !== undefined && amount > 0) {
    amountTag = emv('54', amount.toFixed(2));
  }

  // 58: Country Code (BR)
  const country = emv('58', 'BR');

  // 59: Merchant Name (Beneficiário)
  const nameTag = emv('59', cleanName);

  // 60: Merchant City
  const cityTag = emv('60', cleanCity);

  // 62: Additional Data Field (TxID)
  const txTag = emv('05', cleanTxId);
  const addData = emv('62', txTag);

  // Montagem do payload sem CRC (ID 63 com tamanho 04)
  const rawPayload = payloadFormat + pointOfInit + accountInfo + mcc + currency + amountTag + country + nameTag + cityTag + addData + '6304';

  // Adiciona o CRC16 final calculado pelo algoritmo oficial Bacen
  const crc = crc16Ccitt(rawPayload);
  return rawPayload + crc;
}

/**
 * Gera URL de imagem estática do QR Code para renderização instantânea em tela e impressão
 */
export function getPixQrCodeUrl(pixPayload: string, size = 180): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=2&format=png&data=${encodeURIComponent(pixPayload)}`;
}
