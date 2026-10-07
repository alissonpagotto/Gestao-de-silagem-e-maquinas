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
 * Compilação do algoritmo oficial PIX BR Code (Padrão Banco Central Bacen - Mandatório nas 3 telas):
 * - Higienização da Chave: dígitos puros
 * - Bloco Base Inicial: "00020126"
 * - Merchant Account: "580014br.gov.bcb.pix01" + comprimento_da_chave + chaveLimpa
 * - Código de Categoria: "52040000"
 * - Moeda: "5303986"
 * - Valor Líquido Dinâmico: "54" + comprimento_do_valor + liquidoApurado (separador ponto)
 * - País: "5802BR"
 * - Nome do Funcionário: "59" + comprimento_do_nome + nomeCompletoFuncionario (CAIXA ALTA e sem acentos)
 * - Cidade do Beneficiário: "6009DOIS VIZINHOS"
 * - Campo Adicional (TxID padrão): "62070503***"
 * - Cálculo do Checksum CRC16: "6304" + 4 caracteres hexadecimais do cálculo CRC16
 */
export function buildOfficialPixBrCode(
  rawPixKey: string,
  liquidoApurado: number,
  nomeCompletoFuncionario = 'COLABORADOR'
): string {
  const trimmed = (rawPixKey || '').trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('000201')) return trimmed;

  // Higienização da Chave: remove parênteses, traços, pontos ou espaços, deixando apenas dígitos puros
  let chaveLimpa = trimmed.replace(/[\s().-]/g, '').trim();
  const digitsOnly = chaveLimpa.replace(/\D/g, '');
  if (digitsOnly.length >= 10 && !chaveLimpa.includes('@')) {
    chaveLimpa = digitsOnly;
  }

  // Bloco Base Inicial: "00020126"
  const blocoBase = '00020126';

  // Merchant Account (Chave Pix): "580014br.gov.bcb.pix01" + comprimento_da_chave + chaveLimpa
  const compChave = String(chaveLimpa.length).padStart(2, '0');
  const merchantAccount = `580014br.gov.bcb.pix01${compChave}${chaveLimpa}`;

  // Código de Categoria (Merchant Category Code): "52040000"
  const codCategoria = '52040000';

  // Moeda (Currency Real): "5303986"
  const moeda = '5303986';

  // Valor Líquido Dinâmico: "54" + comprimento_do_valor + liquidoApurado
  const valorStr = Number(liquidoApurado || 0).toFixed(2);
  const compValor = String(valorStr.length).padStart(2, '0');
  const valorBloco = `54${compValor}${valorStr}`;

  // País (Country Code): "5802BR"
  const pais = '5802BR';

  // Nome do Funcionário: "59" + comprimento_do_nome + nomeCompletoFuncionario (CAIXA ALTA e sem acentos)
  const nomeLimpo = (nomeCompletoFuncionario || 'COLABORADOR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .trim()
    .slice(0, 25) || 'COLABORADOR';
  const compNome = String(nomeLimpo.length).padStart(2, '0');
  const nomeBloco = `59${compNome}${nomeLimpo}`;

  // Cidade do Beneficiário: "6009DOIS VIZINHOS"
  const cidade = '6009DOIS VIZINHOS';

  // Campo Adicional (TxID padrão): "62070503***"
  const campoAdicional = '62070503***';

  // Cálculo do Checksum CRC16
  const payloadSemCrc = `${blocoBase}${merchantAccount}${codCategoria}${moeda}${valorBloco}${pais}${nomeBloco}${cidade}${campoAdicional}6304`;
  const checksum = crc16Ccitt(payloadSemCrc);

  return `${payloadSemCrc}${checksum}`;
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
  _cityArg?: string,
  _txIdArg?: string
): string {
  let pixKey = '';
  let amount = 0;
  let beneficiary = 'COLABORADOR';

  if (typeof paramsOrKey === 'object' && paramsOrKey !== null) {
    pixKey = paramsOrKey.pixKey || '';
    amount = Number(paramsOrKey.amount || 0);
    beneficiary = paramsOrKey.beneficiaryName || paramsOrKey.receiverName || paramsOrKey.merchantName || 'COLABORADOR';
  } else if (typeof paramsOrKey === 'string') {
    pixKey = paramsOrKey;
    amount = Number(amountArg || 0);
    beneficiary = receiverNameArg || 'COLABORADOR';
  }

  return buildOfficialPixBrCode(pixKey, amount, beneficiary);
}

/**
 * Gera URL de imagem estática do QR Code para renderização instantânea em tela e impressão
 */
export function getPixQrCodeUrl(pixPayload: string, size = 180): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=2&format=png&data=${encodeURIComponent(pixPayload)}`;
}
