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
 * Extrai a chave PIX do colaborador (lê o campo de Chave Pix / E-mail / Celular / Aleatória / CPF)
 */
export function getEmployeePixKey(emp?: Partial<Employee> | null): string {
  if (!emp) return '';

  // 1. Chave explícita em propriedades adicionais
  const directPix = (
    (emp as any).pixKey ||
    (emp as any).chavePix ||
    (emp as any).chave_pix ||
    (emp as any).pix_key ||
    ''
  ).trim();

  if (directPix) {
    return directPix.replace(/^chave\s*pix[:\s-]*/i, '').replace(/^pix[:\s-]*/i, '').trim();
  }

  // 2. Campo bankAccount (onde o usuário digita no input "Conta Corrente (C.C.) / Chave Pix" / "Chave Pix: E-mail")
  const bankAccount = (emp.bankAccount || (emp as any).conta_corrente || '').trim();
  if (bankAccount) {
    // Se for e-mail (ex: agrocontrolemaquinas@gmail.com)
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
    // Se tiver telefone (com DDD) ou CPF/CNPJ
    const digits = bankAccount.replace(/\D/g, '');
    if (digits.length === 11 || digits.length === 14 || /^\+?55\d{10,11}$/.test(digits)) {
      return bankAccount.replace(/^chave\s*pix[:\s-]*/i, '').replace(/^pix[:\s-]*/i, '').trim();
    }
    // Qualquer texto digitado no campo de conta que não seja apenas placeholder "00000-0"
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

  // 4. Se o usuário preencheu o banco (ex: Nubank) e digitou a conta/chave em bankAccount
  if (bankAccount && bankAccount !== '00000-0' && bankAccount !== '0000-0') {
    return bankAccount.replace(/^chave\s*pix[:\s-]*/i, '').replace(/^pix[:\s-]*/i, '').trim();
  }

  // 5. Se Forma de Recebimento ou Local de Recebimento contiver "PIX", fallback para o CPF do colaborador
  const paymentLoc = (emp.paymentLocation || (emp as any).local_recebimento || '').toLowerCase();
  if (paymentLoc.includes('pix') || bankPixKey.toLowerCase().includes('pix')) {
    if (emp.cpf) {
      const cleanCpf = emp.cpf.replace(/\D/g, '');
      if (cleanCpf.length === 11) return cleanCpf;
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
 * Gera a string do PIX Copia e Cola no padrão oficial BACEN (EMV QRCPS-MPM)
 */
export function generatePixPayload(params: {
  pixKey: string;
  amount?: number;
  merchantName?: string;
  merchantCity?: string;
  txId?: string;
}): string {
  const { pixKey, amount, merchantName = 'COLACA SILAGEM', merchantCity = 'COLATINA', txId = '***' } = params;

  // Se a chave já for um payload BR Code completo
  if (pixKey.startsWith('000201')) {
    return pixKey;
  }

  const cleanKey = pixKey.trim();
  const cleanName = sanitizePixText(merchantName, 25) || 'RECEBEDOR';
  const cleanCity = sanitizePixText(merchantCity, 15) || 'CIDADE';
  const cleanTxId = sanitizePixText(txId, 25) || '***';

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

  // 59: Merchant Name
  const nameTag = emv('59', cleanName);

  // 60: Merchant City
  const cityTag = emv('60', cleanCity);

  // 62: Additional Data Field (TxID)
  const txTag = emv('05', cleanTxId);
  const addData = emv('62', txTag);

  // 00: Payload Format Indicator (01)
  const payloadFormat = emv('00', '01');

  // Montagem do payload sem CRC (ID 63 com tamanho 04)
  const rawPayload = payloadFormat + accountInfo + mcc + currency + amountTag + country + nameTag + cityTag + addData + '6304';

  // Adiciona o CRC16 final
  const crc = crc16Ccitt(rawPayload);
  return rawPayload + crc;
}

/**
 * Gera URL de imagem estática do QR Code para renderização instantânea em tela e impressão
 */
export function getPixQrCodeUrl(pixPayload: string, size = 180): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=2&format=png&data=${encodeURIComponent(pixPayload)}`;
}
