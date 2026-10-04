import QRCode from 'qrcode';
import { Employee } from '../../types';
import { getStoredEmployees } from '../../lib/storage';

/**
 * Utilitário de cálculo CRC-16 (padrão CCITT-FALSE / Polinômio 0x1021)
 * Utilizado para autenticar a integridade do payload do Banco Central (PIX EMV).
 */
function crc16(data: string): string {
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
 * Gera a string oficial do Pix no padrão BR Code (EMVCo) do Banco Central do Brasil.
 * Permite leitura nativa em qualquer aplicativo bancário (Nubank, Banco do Brasil, Sicredi, Itaú, etc.).
 */
export function generatePixPayload(
  pixKey: string,
  amount: number,
  receiverName = 'COLABORADOR',
  city = 'BRASIL',
  txid = '***'
): string {
  const cleanKey = (pixKey || '').trim();
  if (!cleanKey) return '';

  // GUI br.gov.bcb.pix + chave
  const gui = emvField('00', 'br.gov.bcb.pix');
  const pixKeyField = emvField('01', cleanKey);
  const merchantAccountInfo = emvField('26', `${gui}${pixKeyField}`);

  // Normalização sem acentos do Nome e Cidade
  const cleanName = (receiverName || 'COLABORADOR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .trim()
    .substring(0, 25) || 'COLABORADOR';

  const cleanCity = (city || 'BRASIL')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .trim()
    .substring(0, 15) || 'BRASIL';

  const payloadFormat = emvField('00', '01');
  const pointOfInit = emvField('01', '12'); // 12 = dinâmico / valor pré-definido
  const merchantCategory = emvField('52', '0000');
  const currency = emvField('53', '986'); // 986 = Real Brasileiro (BRL)
  const amountStr = amount > 0 ? emvField('54', amount.toFixed(2)) : '';
  const country = emvField('58', 'BR');
  const merchantNameField = emvField('59', cleanName);
  const merchantCityField = emvField('60', cleanCity);
  const additionalData = emvField('62', emvField('05', txid || '***'));

  const rawPayload = `${payloadFormat}${pointOfInit}${merchantAccountInfo}${merchantCategory}${currency}${amountStr}${country}${merchantNameField}${merchantCityField}${additionalData}6304`;
  const checksum = crc16(rawPayload);
  return `${rawPayload}${checksum}`;
}

/**
 * Busca resiliente de chave Pix de um colaborador:
 * 1. Prioriza 'bankAccount' (onde é digitado o valor do input "Chave Pix: E-mail" ou chave pix geral)
 * 2. Verifica 'bankPixKey' (caso tenha sido preenchido com chave pix)
 * 3. Faz busca cruzada no LocalStorage em 'colaca_silagem_funcionarios' e 'silagem_facil_clean_v1_employees'
 */
export function extractPixKeyFromEmployee(emp?: Partial<Employee> | null): string {
  if (!emp) return '';

  // 1. Campo bankAccount (onde fica o input "Conta Corrente (C.C.) / Chave Pix: E-mail")
  const account = (emp.bankAccount || '').trim();
  if (account && account !== '00000-0' && account !== '-' && account.toLowerCase() !== 'não informada') {
    return account;
  }

  // 2. Campo bankPixKey (pode conter a chave quando preenchido como chave pix em vez de apenas banco)
  const bankPix = (emp.bankPixKey || '').trim();
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

  // 3. Campo genérico pixKey
  if ((emp as any).pixKey && typeof (emp as any).pixKey === 'string') {
    const k = (emp as any).pixKey.trim();
    if (k) return k;
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
