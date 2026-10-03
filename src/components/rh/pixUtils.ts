import { Employee } from '../../types';
import { formatEmployeeBankDeposit } from './payrollHelpers';

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
 * Identifica se a forma de pagamento / depósito do colaborador é via PIX
 */
export function hasEmployeePixPayment(
  emp?: Partial<Employee> | null,
  depositStr?: string
): boolean {
  if (!emp) return false;

  const deposit = (depositStr || formatEmployeeBankDeposit(emp)).toLowerCase();
  const paymentLoc = (emp.paymentLocation || (emp as any).local_recebimento || '').toLowerCase();
  const pixKeyField = (emp.bankPixKey || (emp as any).banco_chave_pix || '').toLowerCase();
  const account = (emp.bankAccount || (emp as any).conta_corrente || '').toLowerCase();

  // 1. Se contiver expressamente o termo "PIX"
  if (
    deposit.includes('pix') ||
    paymentLoc.includes('pix') ||
    pixKeyField.includes('pix') ||
    account.includes('pix')
  ) {
    return true;
  }

  // 2. Se houver chave PIX preenchida (e-mail, chave aleatória, celular ou CPF válido fora do nome de banco)
  const rawKey = (emp.bankPixKey || (emp as any).banco_chave_pix || '').trim();
  const standardBanks = ['banco do brasil', 'bradesco', 'itau', 'caixa', 'santander', 'sicoob', 'sicredi'];
  if (rawKey && !standardBanks.includes(rawKey.toLowerCase())) {
    // E-mail
    if (rawKey.includes('@')) return true;
    // Chave Aleatória (UUID)
    if (/^[0-9a-fA-F-]{32,36}$/.test(rawKey)) return true;
    // Celular com DDD (+55 ou apenas DDD e número)
    if (/^\+?55\d{10,11}$/.test(rawKey.replace(/\D/g, '')) || /^\(?\d{2}\)?\s?9?\d{4}-?\d{4}$/.test(rawKey)) return true;
    // CPF/CNPJ como chave
    const digits = rawKey.replace(/\D/g, '');
    if (digits.length === 11 || digits.length === 14) return true;
  }

  // 3. Se for conta bancária tradicional sem menção a PIX (Ex: "Banco do Brasil Ag: 0000 Cc: 00000-0")
  return false;
}

/**
 * Extrai a chave PIX do colaborador
 */
export function getEmployeePixKey(emp?: Partial<Employee> | null): string {
  if (!emp) return '';

  const rawKey = (emp.bankPixKey || (emp as any).banco_chave_pix || '').trim();
  const standardBanks = ['banco do brasil', 'bradesco', 'itau', 'caixa', 'santander', 'sicoob', 'sicredi'];

  // 1. Se campo bankPixKey tem chave real e não é apenas nome de banco tradicional
  if (rawKey && !standardBanks.includes(rawKey.toLowerCase())) {
    return rawKey.replace(/^chave\s*pix[:\s-]*/i, '').replace(/^pix[:\s-]*/i, '').trim();
  }

  // 2. Se campo conta_corrente contiver e-mail ou formato de chave PIX
  const account = (emp.bankAccount || (emp as any).conta_corrente || '').trim();
  if (account.includes('@') || /^[0-9a-fA-F-]{32,36}$/.test(account)) {
    return account.replace(/^pix[:\s-]*/i, '').trim();
  }

  // 3. Se forma de pagamento for PIX e não houver chave digitada, utiliza o CPF do colaborador (padrão CLT)
  const paymentLoc = (emp.paymentLocation || (emp as any).local_recebimento || '').toLowerCase();
  if (paymentLoc.includes('pix') || rawKey.toLowerCase().includes('pix') || account.toLowerCase().includes('pix')) {
    if (emp.cpf) {
      const cleanCpf = emp.cpf.replace(/\D/g, '');
      if (cleanCpf.length === 11) return cleanCpf;
    }
  }

  return rawKey || (emp.cpf ? emp.cpf.replace(/\D/g, '') : '');
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
export function getPixQrCodeUrl(pixPayload: string, size = 160): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=2&format=png&data=${encodeURIComponent(pixPayload)}`;
}
