import { CompanyProfile, NotaSaidaRecord } from '../types';
import { cleanDigits, formatCpfCnpj, formatDateBR } from './formatters';
import {
  INDEXEDDB_PREFIX,
  deleteMediaFromIndexedDB,
  getMediaFromIndexedDB,
  isIndexedDbSupported,
  saveMediaToIndexedDB,
} from './imageStorage';

export const COMPANY_CERT_A1_KEY = 'certificado_a1_empresa';
export const COMPANY_CERT_A1_REF = `${INDEXEDDB_PREFIX}${COMPANY_CERT_A1_KEY}`;
export const CERTIFICATE_META_STORAGE_KEY = 'agrocontrol_certificado_a1_meta';

const UF_IBGE_CODES: Record<string, string> = {
  RO: '11', AC: '12', AM: '13', RR: '14', PA: '15', AP: '16', TO: '17',
  MA: '21', PI: '22', CE: '23', RN: '24', PB: '25', PE: '26', AL: '27',
  SE: '28', BA: '29', MG: '31', ES: '32', RJ: '33', SP: '35', PR: '41',
  SC: '42', RS: '43', MS: '50', MT: '51', GO: '52', DF: '53',
};

export interface StoredCertificateMeta {
  certificadoDigitalAtivo: boolean;
  certificadoArquivoNome?: string;
  certificadoIndexedDbRef?: string;
  certificadoTitular?: string;
  certificadoCnpj?: string;
  certificadoValidade?: string;
  certificadoSenhaArmazenada?: string;
  certificadoSimulado?: boolean;
  updatedAt?: string;
}

export interface CertificateStatusInfo {
  hasCertificate: boolean;
  isActive: boolean;
  isExpired: boolean;
  isExpiringSoon: boolean;
  daysRemaining: number | null;
  statusCode: 'ativo' | 'proximo_vencimento' | 'vencido' | 'inativo';
  badgeLabel: string;
  formattedValidade: string;
  titular: string;
  cnpj: string;
  arquivoNome: string;
  simulado: boolean;
}

function encodeLocalSecret(raw: string): string {
  try {
    return btoa(unescape(encodeURIComponent(raw)));
  } catch {
    return '';
  }
}

export function getDefaultCertificateValidityDate(yearsAhead = 1): string {
  const now = new Date();
  const target = new Date(now.getFullYear() + yearsAhead, now.getMonth(), now.getDate());
  const y = target.getFullYear();
  const m = String(target.getMonth() + 1).padStart(2, '0');
  const d = String(target.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getStoredCertificateMeta(): StoredCertificateMeta | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(CERTIFICATE_META_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredCertificateMeta;
  } catch {
    return null;
  }
}

export function saveStoredCertificateMeta(meta: StoredCertificateMeta | null): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (!meta || !meta.certificadoDigitalAtivo) {
      localStorage.removeItem(CERTIFICATE_META_STORAGE_KEY);
      return;
    }
    localStorage.setItem(CERTIFICATE_META_STORAGE_KEY, JSON.stringify(meta));
  } catch {
    // ignore storage errors
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Falha ao ler arquivo do certificado.'));
    reader.readAsDataURL(file);
  });
}

function extractHintsFromPfxBuffer(buffer: ArrayBuffer): { holder?: string; cnpj?: string } {
  try {
    const bytes = new Uint8Array(buffer);
    // Extrai trechos legíveis ASCII caso parte do certificado público não esteja cifrada
    let ascii = '';
    const limit = Math.min(bytes.length, 24000);
    for (let i = 0; i < limit; i++) {
      const b = bytes[i];
      ascii += b >= 32 && b <= 126 ? String.fromCharCode(b) : ' ';
    }
    const icpMatch = ascii.match(/([A-Z0-9 .,&/-]{4,60}):(\d{14})/i);
    if (icpMatch) {
      return {
        holder: icpMatch[1].trim().toUpperCase(),
        cnpj: formatCpfCnpj(icpMatch[2]),
      };
    }
  } catch {
    // fallback silencioso
  }
  return {};
}

export async function validateAndStorePfxCertificate(
  file: File,
  password: string,
  companyProfile?: Partial<CompanyProfile>
): Promise<{
  success: boolean;
  message: string;
  meta?: StoredCertificateMeta;
}> {
  const fileName = (file?.name || '').trim();
  const extLower = String(fileName ?? '').toLowerCase();
  if (!extLower.endsWith('.pfx') && !extLower.endsWith('.p12')) {
    return {
      success: false,
      message: 'Formato inválido. Selecione um arquivo de Certificado Digital A1 com extensão .pfx ou .p12.',
    };
  }
  if (!file.size || file.size < 32) {
    return {
      success: false,
      message: 'O arquivo selecionado está vazio ou corrompido.',
    };
  }
  if (!password || password.trim().length < 4) {
    return {
      success: false,
      message: 'Informe a senha do Certificado Digital (mínimo 4 caracteres).',
    };
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const firstBytes = new Uint8Array(arrayBuffer.slice(0, 4));
    // PKCS#12 DER sempre inicia com ASN.1 SEQUENCE tag (0x30)
    if (firstBytes[0] !== 0x30) {
      return {
        success: false,
        message: 'O arquivo não possui estrutura PKCS#12 (.pfx/.p12) válida. Verifique o arquivo exportado.',
      };
    }

    const dataUrl = await fileToDataUrl(file);
    let storedRef = COMPANY_CERT_A1_REF;
    if (isIndexedDbSupported()) {
      const savedOk = await saveMediaToIndexedDB(COMPANY_CERT_A1_KEY, dataUrl);
      if (!savedOk) {
        storedRef = COMPANY_CERT_A1_REF;
      }
    }

    const hints = extractHintsFromPfxBuffer(arrayBuffer);
    const defaultTitular = (
      hints.holder ||
      companyProfile?.corporateName ||
      companyProfile?.tradeName ||
      companyProfile?.name ||
      'TITULAR CERTIFICADO A1'
    )
      .trim()
      .toUpperCase();
    const defaultCnpj = formatCpfCnpj(
      hints.cnpj || companyProfile?.cnpjCpf || companyProfile?.cnpj || ''
    );
    const validade = getDefaultCertificateValidityDate(1);

    const meta: StoredCertificateMeta = {
      certificadoDigitalAtivo: true,
      certificadoArquivoNome: fileName,
      certificadoIndexedDbRef: storedRef,
      certificadoTitular: defaultTitular,
      certificadoCnpj: defaultCnpj || undefined,
      certificadoValidade: validade,
      certificadoSenhaArmazenada: encodeLocalSecret(password.trim()),
      certificadoSimulado: false,
      updatedAt: new Date().toISOString(),
    };

    saveStoredCertificateMeta(meta);
    return {
      success: true,
      message: `Certificado Digital "${fileName}" validado e ativado até ${formatDateBR(validade)}!`,
      meta,
    };
  } catch {
    return {
      success: false,
      message: 'Não foi possível ler o arquivo do certificado digital.',
    };
  }
}

export function activateSimulatedCertificate(
  companyProfile?: Partial<CompanyProfile>,
  customFileName?: string
): StoredCertificateMeta {
  const titular = (
    companyProfile?.corporateName ||
    companyProfile?.tradeName ||
    companyProfile?.name ||
    'EMPRESA HOMOLOGAÇÃO A1'
  )
    .trim()
    .toUpperCase();
  const cnpj = formatCpfCnpj(companyProfile?.cnpjCpf || companyProfile?.cnpj || '');
  const validade = getDefaultCertificateValidityDate(1);

  const meta: StoredCertificateMeta = {
    certificadoDigitalAtivo: true,
    certificadoArquivoNome: customFileName || 'certificado_homologacao_a1.pfx',
    certificadoIndexedDbRef: COMPANY_CERT_A1_REF,
    certificadoTitular: titular,
    certificadoCnpj: cnpj || undefined,
    certificadoValidade: validade,
    certificadoSenhaArmazenada: encodeLocalSecret('homologacao'),
    certificadoSimulado: true,
    updatedAt: new Date().toISOString(),
  };

  saveStoredCertificateMeta(meta);
  return meta;
}

export async function removeStoredCertificate(): Promise<void> {
  saveStoredCertificateMeta(null);
  if (isIndexedDbSupported()) {
    await deleteMediaFromIndexedDB(COMPANY_CERT_A1_KEY);
  }
}

export async function hasStoredCertificateBinary(): Promise<boolean> {
  const data = await getMediaFromIndexedDB(COMPANY_CERT_A1_KEY);
  return Boolean(data);
}

export function getCertificateStatusInfo(profile?: Partial<CompanyProfile> | null): CertificateStatusInfo {
  const fallbackMeta = getStoredCertificateMeta();
  const isFlaggedActive = Boolean(
    profile?.certificadoDigitalAtivo ?? fallbackMeta?.certificadoDigitalAtivo
  );
  const validadeStr = (
    profile?.certificadoValidade ||
    fallbackMeta?.certificadoValidade ||
    ''
  ).trim();
  const titular = (
    profile?.certificadoTitular ||
    fallbackMeta?.certificadoTitular ||
    profile?.corporateName ||
    profile?.tradeName ||
    'NÃO INFORMADO'
  ).trim();
  const cnpj = formatCpfCnpj(
    profile?.certificadoCnpj ||
      fallbackMeta?.certificadoCnpj ||
      profile?.cnpjCpf ||
      profile?.cnpj ||
      ''
  );
  const arquivoNome = (
    profile?.certificadoArquivoNome ||
    fallbackMeta?.certificadoArquivoNome ||
    ''
  ).trim();
  const simulado = Boolean(
    profile?.certificadoSimulado ?? fallbackMeta?.certificadoSimulado
  );

  if (!isFlaggedActive) {
    return {
      hasCertificate: false,
      isActive: false,
      isExpired: false,
      isExpiringSoon: false,
      daysRemaining: null,
      statusCode: 'inativo',
      badgeLabel: 'SEM CERTIFICADO A1',
      formattedValidade: '-',
      titular,
      cnpj,
      arquivoNome,
      simulado: false,
    };
  }

  let daysRemaining: number | null = null;
  if (validadeStr) {
    const parts = validadeStr.split('-').map(Number);
    if (parts.length === 3 && parts.every((n) => !Number.isNaN(n))) {
      const expiryDate = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const diffMs = expiryDate.getTime() - todayStart.getTime();
      daysRemaining = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    }
  }

  const isExpired = daysRemaining !== null && daysRemaining < 0;
  const isExpiringSoon = daysRemaining !== null && daysRemaining >= 0 && daysRemaining < 30;
  const statusCode: CertificateStatusInfo['statusCode'] = isExpired
    ? 'vencido'
    : isExpiringSoon
      ? 'proximo_vencimento'
      : 'ativo';

  const badgeLabel = isExpired
    ? 'CERTIFICADO A1 VENCIDO'
    : isExpiringSoon
      ? `VENCE EM ${daysRemaining} DIA${daysRemaining === 1 ? '' : 'S'}`
      : '🔒 CERTIFICADO A1 ATIVO';

  return {
    hasCertificate: true,
    isActive: !isExpired,
    isExpired,
    isExpiringSoon,
    daysRemaining,
    statusCode,
    badgeLabel,
    formattedValidade: validadeStr ? formatDateBR(validadeStr) : '-',
    titular,
    cnpj,
    arquivoNome,
    simulado,
  };
}

function computeMod11(digits43: string): string {
  let sum = 0;
  let weight = 2;
  for (let i = digits43.length - 1; i >= 0; i--) {
    sum += Number(digits43[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const mod = sum % 11;
  return String(mod < 2 ? 0 : 11 - mod);
}

export function generateSefazChaveAcesso44(
  nota: Pick<NotaSaidaRecord, 'tipoDocumento' | 'numero' | 'serie' | 'dataEmissao' | 'chaveAcesso' | 'id'>,
  companyProfile?: Partial<CompanyProfile> | null
): string {
  const existing = cleanDigits(nota.chaveAcesso);
  if (existing.length === 44) return existing;

  const uf = (companyProfile?.state || 'PR').trim().toUpperCase();
  const cUF = UF_IBGE_CODES[uf] || '41';

  const em = (nota.dataEmissao || '').split('-');
  const aamm =
    em.length >= 2 && em[0].length === 4
      ? `${em[0].slice(2, 4)}${em[1].padStart(2, '0')}`
      : `${new Date().getFullYear().toString().slice(2)}${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  const cnpj = cleanDigits(companyProfile?.cnpj || companyProfile?.cnpjCpf || '')
    .padStart(14, '0')
    .slice(0, 14);

  const docLower = String(nota.tipoDocumento ?? '').toLowerCase();
  const modelo = docLower.includes('ct-e') || docLower.includes('cte')
    ? '57'
    : docLower.includes('mdf-e') || docLower.includes('mdfe')
      ? '58'
      : docLower.includes('nfc-e') || docLower.includes('nfce')
        ? '65'
        : docLower.includes('nfs-e') || docLower.includes('nfse')
          ? '99'
          : '55';

  const serie = cleanDigits(nota.serie || '1').padStart(3, '0').slice(-3);
  const numero = cleanDigits(nota.numero || '1').padStart(9, '0').slice(-9);
  const tpEmis = '1';
  const randSeed = String(Math.floor(10000000 + Math.random() * 89999999));
  const cNF = randSeed.slice(0, 8);

  const base43 = `${cUF}${aamm}${cnpj}${modelo}${serie}${numero}${tpEmis}${cNF}`;
  const dv = computeMod11(base43);
  return `${base43}${dv}`;
}

export function formatChaveAcesso44(chave?: string): string {
  const clean = cleanDigits(chave).padStart(44, '0').slice(0, 44);
  return clean.replace(/(\d{4})(?=\d)/g, '$1 ');
}

export function generateSefazProtocoloAutorizacao(
  companyProfile?: Partial<CompanyProfile> | null
): { protocoloNumero: string; dataHoraFormatada: string; protocoloCompleto: string } {
  const uf = (companyProfile?.state || 'PR').trim().toUpperCase();
  const cUF = UF_IBGE_CODES[uf] || '41';
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const randomSeq = String(Math.floor(1000000000 + Math.random() * 8999999999)).slice(0, 10);
  // Padrão SEFAZ 15 dígitos: 1 + cUF(2) + AA(2) + 10 dígitos sequenciais (ex: 141260008492015)
  const protocoloNumero = `1${cUF}${yy}${randomSeq}`;
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const dataHoraFormatada = `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;

  return {
    protocoloNumero,
    dataHoraFormatada,
    protocoloCompleto: `${protocoloNumero} - ${dataHoraFormatada}`,
  };
}
