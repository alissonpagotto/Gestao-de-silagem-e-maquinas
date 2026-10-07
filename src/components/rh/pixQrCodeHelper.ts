import QRCode from 'qrcode';
import { Employee } from '../../types';
import { getStoredEmployees } from '../../lib/storage';
import { normalizePixKeyForBacen } from './pixUtils';

/**
 * Utilitário de cálculo CRC-16 (padrão CCITT-FALSE / Polinômio 0x1021)
 * Utilizado para autenticar a integridade do payload do Banco Central (PIX EMV).
 */
export function crc16(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}

function emvField(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
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
  liquidoCalculado: number,
  nomeCompletoFuncionario = 'COLABORADOR'
): string {
  if (!rawPixKey) return '';
  const trimmed = rawPixKey.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('000201')) return trimmed;

  const cleanKey = normalizePixKeyForBacen(trimmed);
  if (!cleanKey) return '';

  const cleanName = (nomeCompletoFuncionario || 'COLABORADOR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .trim()
    .slice(0, 25) || 'COLABORADOR';

  const merchantAccount = emvField('00', 'br.gov.bcb.pix') + emvField('01', cleanKey);
  const valorStr = Number(liquidoCalculado || 0).toFixed(2);

  const payloadSemCrc =
    emvField('00', '01') +
    emvField('26', merchantAccount) +
    emvField('52', '0000') +
    emvField('53', '986') +
    emvField('54', valorStr) +
    emvField('58', 'BR') +
    emvField('59', cleanName) +
    emvField('60', 'DOIS VIZINHOS') +
    emvField('62', emvField('05', '***')) +
    '6304';

  const checksum = crc16(payloadSemCrc);
  return `${payloadSemCrc}${checksum}`;
}

/**
 * Gera a string oficial do Pix no padrão BR Code (EMVCo) do Banco Central do Brasil.
 * Permite leitura nativa em qualquer aplicativo bancário (Nubank, Banco do Brasil, Sicredi, Itaú, etc.).
 */
export function generatePixPayload(
  pixKey: string,
  amount: number,
  receiverName = 'COLABORADOR',
  _city = 'DOIS VIZINHOS',
  _txid = '***'
): string {
  return buildOfficialPixBrCode(pixKey, amount, receiverName);
}

/**
 * Busca resiliente de chave Pix de um colaborador:
 * 1. Prioriza 'chavePix' e 'pixKey' explícitos
 * 2. Verifica 'bankAccount' (onde é digitado o valor do input "Chave Pix: E-mail" ou chave pix geral)
 * 3. Verifica 'bankPixKey' (caso tenha sido preenchido com chave pix)
 * 4. Faz busca cruzada no LocalStorage em 'colaca_silagem_funcionarios' e 'silagem_facil_clean_v1_employees'
 */
export function extractPixKeyFromEmployee(emp?: Partial<Employee> | null): string {
  if (!emp) return '';

  // 1. Chave explícita
  if (emp.chavePix && typeof emp.chavePix === 'string' && emp.chavePix.trim()) {
    return emp.chavePix.trim();
  }
  if ((emp as any).chave_pix && typeof (emp as any).chave_pix === 'string' && (emp as any).chave_pix.trim()) {
    return (emp as any).chave_pix.trim();
  }
  if (emp.pixKey && typeof emp.pixKey === 'string' && emp.pixKey.trim()) {
    return emp.pixKey.trim();
  }
  if ((emp as any).pix_key && typeof (emp as any).pix_key === 'string' && (emp as any).pix_key.trim()) {
    return (emp as any).pix_key.trim();
  }

  // 2. Campo bankAccount (onde fica o input "Conta Corrente (C.C.) / Chave Pix: E-mail")
  const account = (emp.bankAccount || (emp as any).conta_corrente || '').trim();
  if (account && account !== '00000-0' && account !== '-' && account.toLowerCase() !== 'não informada') {
    return account;
  }

  // 3. Campo bankPixKey (pode conter a chave quando preenchido como chave pix em vez de apenas banco)
  const bankPix = (emp.bankPixKey || (emp as any).banco_chave_pix || '').trim();
  if (bankPix) {
    if (
      bankPix.includes('@') ||
      /^[0-9a-fA-F-]{32,36}$/.test(bankPix) ||
      /^\d{11}$/.test(bankPix.replace(/\D/g, '')) ||
      /^\d{14}$/.test(bankPix.replace(/\D/g, ''))
    ) {
      return bankPix;
    }
  }

  // 4. Se Local de Recebimento contiver PIX, fallback para CPF ou Telefone
  const paymentLoc = (emp.paymentLocation || (emp as any).local_recebimento || '').toLowerCase();
  if (paymentLoc.includes('pix')) {
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
 * Localiza o colaborador a partir de id, nome ou CPF em listas fornecidas ou no LocalStorage,
 * incluindo a chave específica 'colaca_silagem_funcionarios' solicitada no projeto.
 */
export function resolveEmployeePixKey(
  identifierOrEmp: string | Partial<Employee> | null | undefined,
  providedList?: Employee[]
): string {
  if (!identifierOrEmp) return '';

  // Se já for um objeto com dados
  if (typeof identifierOrEmp === 'object') {
    const directKey = extractPixKeyFromEmployee(identifierOrEmp);
    if (directKey) return directKey;
    // Se o objeto não tiver a chave preenchida, continua a busca pelo ID/nome nas fontes
  }

  const lookupId = typeof identifierOrEmp === 'string' ? identifierOrEmp.trim() : (identifierOrEmp.id || identifierOrEmp.name || '');
  if (!lookupId) return '';

  // Lista agregada de todas as fontes disponíveis
  let allEmployees: Employee[] = [];

  // 1. Lista passada por prop
  if (Array.isArray(providedList) && providedList.length > 0) {
    allEmployees.push(...providedList);
  }

  // 2. LocalStorage: chave específica 'colaca_silagem_funcionarios'
  try {
    const rawColaca = localStorage.getItem('colaca_silagem_funcionarios');
    if (rawColaca) {
      const parsed = JSON.parse(rawColaca);
      if (Array.isArray(parsed)) allEmployees.push(...parsed);
    }
  } catch (e) {
    // Ignore JSON error
  }

  // 3. LocalStorage: chave canônica do storage
  try {
    const rawStorage = localStorage.getItem('silagem_facil_clean_v1_employees');
    if (rawStorage) {
      const parsed = JSON.parse(rawStorage);
      if (Array.isArray(parsed)) allEmployees.push(...parsed);
    }
  } catch (e) {
    // Ignore JSON error
  }

  // 4. getStoredEmployees()
  try {
    const stored = getStoredEmployees();
    if (Array.isArray(stored)) allEmployees.push(...stored);
  } catch (e) {
    // Ignore
  }

  // Procura por ID exato, ou CPF, ou Nome
  const match = allEmployees.find(e => {
    if (!e) return false;
    if (e.id && e.id === lookupId) return true;
    if (e.name && e.name.toLowerCase().trim() === lookupId.toLowerCase().trim()) return true;
    if (e.cpf && e.cpf.replace(/\D/g, '') === lookupId.replace(/\D/g, '')) return true;
    return false;
  });

  if (match) {
    return extractPixKeyFromEmployee(match);
  }

  return '';
}

/**
 * Gera um Data URL (base64 image/png) síncrono ou assíncrono para o QR Code
 */
export async function generateQrCodeDataUrl(payload: string): Promise<string> {
  if (!payload) return '';
  try {
    return await QRCode.toDataURL(payload, {
      width: 160,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    });
  } catch (err) {
    console.warn('[PIX QR Code] Erro ao gerar DataURL local, fallback para API:', err);
    return `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(payload)}`;
  }
}
