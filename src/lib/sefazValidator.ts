import { CompanyProfile, NotaSaidaRecord, TrocaDevolucaoItem, TrocaDevolucaoRecord } from '../types';
import { cleanDigits } from './formatters';
import { resolveDestinatarioDanfe } from './danfeOficialHtml';
import { getStoredCompanyProfile, getStoredInventory } from './storage';

const VALID_UFS = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]);

const DEVOLUCAO_CFOPS = new Set([
  '1201', '1202', '1203', '1204', '1410', '1411', '1553', '1660', '1661', '1662',
  '2201', '2202', '2203', '2204', '2410', '2411', '2553', '2660', '2661', '2662',
  '5201', '5202', '5208', '5209', '5210', '5410', '5411', '5412', '5413', '5553', '5556', '5660', '5661', '5662',
  '6201', '6202', '6208', '6209', '6210', '6410', '6411', '6412', '6413', '6553', '6556', '6660', '6661', '6662',
]);

export type SefazValidationGroup = 'emitente' | 'destinatario' | 'itens' | 'devolucao';

export interface SefazValidationIssue {
  group: SefazValidationGroup;
  code: string;
  field: string;
  message: string;
  hint?: string;
}

export interface SefazValidationResult {
  valid: boolean;
  issues: SefazValidationIssue[];
  resolvedSummary: {
    ufEmitente: string;
    crt: string;
    isDevolucao: boolean;
    chaveReferenciadaDigits: string;
  };
}

export function isValidCpf(raw?: string | null): boolean {
  const digits = cleanDigits(raw || '');
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(digits[i]) * (10 - i);
  }
  let check1 = 11 - (sum % 11);
  if (check1 >= 10) check1 = 0;
  if (check1 !== Number(digits[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += Number(digits[i]) * (11 - i);
  }
  let check2 = 11 - (sum % 11);
  if (check2 >= 10) check2 = 0;
  return check2 === Number(digits[10]);
}

export function isValidCnpj(raw?: string | null): boolean {
  const digits = cleanDigits(raw || '');
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(digits[i]) * w1[i];
  }
  const r1 = sum % 11;
  const d1 = r1 < 2 ? 0 : 11 - r1;
  if (d1 !== Number(digits[12])) return false;

  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += Number(digits[i]) * w2[i];
  }
  const r2 = sum % 11;
  const d2 = r2 < 2 ? 0 : 11 - r2;
  return d2 === Number(digits[13]);
}

export function isValidCpfCnpj(raw?: string | null): {
  valid: boolean;
  type?: 'CPF' | 'CNPJ';
  digits: string;
} {
  const digits = cleanDigits(raw || '');
  if (digits.length === 11) {
    return { valid: isValidCpf(digits), type: 'CPF', digits };
  }
  if (digits.length === 14) {
    return { valid: isValidCnpj(digits), type: 'CNPJ', digits };
  }
  return { valid: false, digits };
}

export function resolveCrtFromProfile(
  profile?: Partial<CompanyProfile> | null
): { crt: '1' | '2' | '3' | ''; label: string } {
  if (profile?.crt === '1') return { crt: '1', label: '1 - Simples Nacional' };
  if (profile?.crt === '2') return { crt: '2', label: '2 - Simples Nacional (Excesso)' };
  if (profile?.crt === '3') return { crt: '3', label: '3 - Regime Normal' };

  const reg = String(profile?.regimeTributario || '').trim().toLowerCase();
  if (!reg) return { crt: '', label: '' };
  if (reg.includes('excesso') || reg.startsWith('2')) {
    return { crt: '2', label: '2 - Simples Nacional (Excesso)' };
  }
  if (reg.includes('simples') || reg.startsWith('1')) {
    return { crt: '1', label: '1 - Simples Nacional' };
  }
  if (
    reg.includes('presumido') ||
    reg.includes('real') ||
    reg.includes('normal') ||
    reg.startsWith('3')
  ) {
    return { crt: '3', label: '3 - Regime Normal' };
  }
  return { crt: '', label: '' };
}

function isBlankOrDash(raw?: string | null): boolean {
  const t = String(raw || '').trim();
  return !t || t === '-' || t === '—' || t.toUpperCase() === 'NÃO INFORMADO' || t.toUpperCase() === 'NAO INFORMADO';
}

function isIeIsentaText(raw?: string | null): boolean {
  const norm = String(raw || '').trim().toUpperCase();
  return norm === 'ISENTO' || norm === 'ISENTA' || norm === 'ISENTO DE IE';
}

function isValidIeDigits(raw?: string | null): boolean {
  const digits = cleanDigits(raw || '');
  return digits.length >= 2 && digits.length <= 14 && !/^0+$/.test(digits);
}

function splitCityUfSafe(raw?: string | null): { cidade: string; uf: string } {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return { cidade: '', uf: '' };
  const m = trimmed.match(/^(.*?)[\/\-]\s*([A-Za-z]{2})$/);
  if (m) {
    return { cidade: m[1].trim(), uf: m[2].trim().toUpperCase() };
  }
  return { cidade: trimmed, uf: '' };
}

function extractCepDigits(raw?: string | null): string {
  const m = String(raw || '').match(/\b(\d{5})-?(\d{3})\b/);
  if (m) return `${m[1]}${m[2]}`;
  const d = cleanDigits(raw || '');
  return d.length === 8 ? d : '';
}

function inferBairroFromAddressLine(address?: string | null): string {
  const text = String(address || '').trim();
  if (!text) return '';
  // Ex: "AV BRASIL, 120 - CENTRO - CEP 85660-000" ou "RUA X, Nº 10, BAIRRO CENTRO"
  const parts = text.split(/\s*[-|,]\s*/).map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    if (/^BAIRRO\b/i.test(part)) {
      return part.replace(/^BAIRRO\s*:?\s*/i, '').trim();
    }
    if (/^ZONA\s+RURAL\b/i.test(part) || /^CENTRO\b/i.test(part) || /^DISTRITO\b/i.test(part)) {
      return part;
    }
  }
  // Se houver ao menos 3 segmentos separados por vírgula/traço (Rua, Nº, Bairro) sem ser CEP
  if (parts.length >= 3) {
    const candidate = parts[2];
    if (candidate && !/^CEP\b/i.test(candidate) && !/^\d{5}-?\d{3}$/.test(candidate)) {
      return candidate;
    }
  }
  return '';
}

export interface PreSefazItemInput {
  codigo?: string;
  descricao?: string;
  ncm?: string;
  cfop?: string;
  csosnCst?: string;
  unidade?: string;
  quantidade?: number;
  valorUnitario?: number;
  inventoryItemId?: string;
  productId?: string;
}

export interface PreSefazValidateInput {
  companyProfile?: Partial<CompanyProfile> | null;
  tipoDocumento?: string;
  isDevolucao?: boolean;
  nfeFinalidade?: string;
  nfeCfop?: string;
  chaveNfeReferenciada?: string;
  destinatario: {
    id?: string;
    nome?: string;
    cpfCnpj?: string;
    ie?: string;
    indicadorIe?: '1' | '2' | '9' | string;
    endereco?: string;
    bairro?: string;
    municipio?: string;
    uf?: string;
    cidadeUf?: string;
    cep?: string;
    isConsumidorAvulso?: boolean;
    preferTipo?: 'cliente' | 'fornecedor';
    numeroOrigem?: string;
  };
  itens: PreSefazItemInput[];
}

export function resolveInventoryNcmForItem(item: {
  inventoryItemId?: string;
  productId?: string;
  codigo?: string;
  descricao?: string;
  ncm?: string;
}): string {
  const direct = cleanDigits(item.ncm || '');
  if (direct.length === 8 && direct !== '00000000') return direct;

  const inventory = getStoredInventory();
  const targetId = String(item.inventoryItemId || item.productId || '').trim();
  const targetCode = String(item.codigo || '').trim().toLowerCase();
  const targetDesc = String(item.descricao || '').trim().toLowerCase();

  const matched = inventory.find((inv) => {
    if (targetId && String(inv.id) === targetId) return true;
    const invCode = String(inv.code || inv.codigo_produto || '').trim().toLowerCase();
    if (targetCode && invCode && invCode === targetCode) return true;
    const invName = String(inv.name || inv.nome_comercial || inv.nome || '').trim().toLowerCase();
    if (targetDesc && invName && invName === targetDesc) return true;
    return false;
  });

  if (matched) {
    const found = cleanDigits(matched.ncm || matched.codigo_ncm || '');
    if (found.length === 8 && found !== '00000000') return found;
  }

  return direct;
}

export function validateNfePreSefaz(input: PreSefazValidateInput): SefazValidationResult {
  const issues: SefazValidationIssue[] = [];
  const profile = input.companyProfile || getStoredCompanyProfile() || ({} as Partial<CompanyProfile>);
  const docTypeLower = String(input.tipoDocumento || 'NF-e').toLowerCase();
  const isNfce = docTypeLower.includes('nfc-e') || docTypeLower.includes('nfce');

  // =========================================================================
  // 1. EMITENTE (Dados da Empresa)
  // =========================================================================
  const emitCnpjRaw = profile.cnpjCpf || profile.cnpj || '';
  const emitCnpjDigits = cleanDigits(emitCnpjRaw);
  if (emitCnpjDigits.length !== 14 || !isValidCnpj(emitCnpjDigits)) {
    issues.push({
      group: 'emitente',
      code: 'Rejeição 207/CNPJ Emitente',
      field: 'Emitente — CNPJ',
      message:
        emitCnpjDigits.length === 0
          ? 'CNPJ do Emitente não cadastrado em Dados da Empresa.'
          : `CNPJ do Emitente inválido (${emitCnpjRaw} — exige 14 dígitos com DV válido).`,
      hint: 'Acesse Cadastros & Configurações → Dados da Empresa e informe o CNPJ completo de 14 dígitos.',
    });
  }

  const emitIeRaw = String(profile.stateRegistration || '').trim();
  if (!emitIeRaw || (!isIeIsentaText(emitIeRaw) && !isValidIeDigits(emitIeRaw))) {
    issues.push({
      group: 'emitente',
      code: 'Rejeição 209/IE Emitente',
      field: 'Emitente — Inscrição Estadual (IE)',
      message:
        'Inscrição Estadual do Emitente não preenchida (informe o número da IE ou marque como "ISENTO").',
      hint: 'Preencha a Inscrição Estadual em Dados da Empresa.',
    });
  }

  const crtResolved = resolveCrtFromProfile(profile);
  if (!crtResolved.crt) {
    issues.push({
      group: 'emitente',
      code: 'Rejeição 225/Schema CRT',
      field: 'Emitente — Regime Tributário (CRT)',
      message: 'Regime Tributário (CRT) não configurado em Dados da Empresa.',
      hint: 'Selecione Simples Nacional (CRT 1/2) ou Regime Normal (CRT 3) na aba Dados da Empresa.',
    });
  }

  const emitCity = String(profile.city || '').trim();
  const emitUf = String(profile.state || '').trim().toUpperCase();
  if (!emitCity || !VALID_UFS.has(emitUf)) {
    const missingEmitLoc: string[] = [];
    if (!emitCity) missingEmitLoc.push('Município');
    if (!VALID_UFS.has(emitUf)) missingEmitLoc.push('UF (2 letras)');
    issues.push({
      group: 'emitente',
      code: 'Rejeição 225/Endereço Emitente',
      field: 'Emitente — Município / UF',
      message: `Emitente sem ${missingEmitLoc.join(' e ')} cadastrado(s) em Dados da Empresa.`,
      hint: 'Informe a Cidade e a UF oficial (ex: Dois Vizinhos / PR) em Dados da Empresa.',
    });
  }

  // =========================================================================
  // 2. DESTINATÁRIO (Cliente ou Fornecedor)
  // =========================================================================
  const explicitCityUf = splitCityUfSafe(input.destinatario.cidadeUf);
  const resolvedDest = resolveDestinatarioDanfe({
    id: input.destinatario.id,
    nome: input.destinatario.nome,
    cpfCnpj: input.destinatario.cpfCnpj,
    ie: input.destinatario.ie,
    endereco: input.destinatario.endereco,
    bairro: input.destinatario.bairro,
    cep: input.destinatario.cep || extractCepDigits(input.destinatario.endereco),
    municipio: input.destinatario.municipio || explicitCityUf.cidade,
    uf: input.destinatario.uf || explicitCityUf.uf,
    cidadeUf: input.destinatario.cidadeUf,
    preferTipo: input.destinatario.preferTipo,
    chaveNfeReferenciada: input.chaveNfeReferenciada,
    numeroOrigem: input.destinatario.numeroOrigem,
  });

  const destNome = !isBlankOrDash(input.destinatario.nome)
    ? String(input.destinatario.nome || '').trim()
    : !isBlankOrDash(resolvedDest.nomeRazaoSocial)
      ? resolvedDest.nomeRazaoSocial
      : '';

  const destDocRaw = !isBlankOrDash(input.destinatario.cpfCnpj)
    ? String(input.destinatario.cpfCnpj || '').trim()
    : !isBlankOrDash(resolvedDest.cnpjCpf)
      ? resolvedDest.cnpjCpf
      : '';
  const destDocCheck = isValidCpfCnpj(destDocRaw);

  const skipStrictDestForNfce = isNfce && Boolean(input.destinatario.isConsumidorAvulso);

  if (!destNome || destNome.length < 2) {
    issues.push({
      group: 'destinatario',
      code: 'Rejeição 225/Schema Destinatário',
      field: 'Destinatário — Nome / Razão Social',
      message: 'Nome ou Razão Social do Destinatário não informado.',
    });
  }

  if (!skipStrictDestForNfce) {
    if (!destDocCheck.valid) {
      issues.push({
        group: 'destinatario',
        code: 'Rejeição 208/CPF-CNPJ Destinatário',
        field: 'Destinatário — CPF / CNPJ',
        message:
          destDocCheck.digits.length === 0
            ? `Destinatário "${destNome || 'não identificado'}" sem CPF (11 dígitos) ou CNPJ (14 dígitos).`
            : `CPF/CNPJ do Destinatário inválido (${destDocRaw} — informe CPF de 11 dígitos ou CNPJ de 14 dígitos válido).`,
        hint: 'Atualize o CPF/CNPJ no formulário da nota ou no cadastro do Cliente/Fornecedor.',
      });
    }

    const destLogradouro = !isBlankOrDash(input.destinatario.endereco)
      ? String(input.destinatario.endereco || '').trim()
      : !isBlankOrDash(resolvedDest.endereco)
        ? resolvedDest.endereco
        : '';

    const destBairro = !isBlankOrDash(input.destinatario.bairro)
      ? String(input.destinatario.bairro || '').trim()
      : !isBlankOrDash(resolvedDest.bairro)
        ? resolvedDest.bairro
        : inferBairroFromAddressLine(destLogradouro);

    const destMunicipio = !isBlankOrDash(input.destinatario.municipio || explicitCityUf.cidade)
      ? String(input.destinatario.municipio || explicitCityUf.cidade).trim()
      : !isBlankOrDash(resolvedDest.municipio)
        ? resolvedDest.municipio
        : '';

    const destUf = String(
      input.destinatario.uf || explicitCityUf.uf || resolvedDest.uf || ''
    )
      .trim()
      .toUpperCase();

    const destCepDigits =
      extractCepDigits(input.destinatario.cep) ||
      extractCepDigits(resolvedDest.cep) ||
      extractCepDigits(destLogradouro);

    const missingAddrParts: string[] = [];
    if (!destLogradouro) missingAddrParts.push('Logradouro');
    if (!destBairro) missingAddrParts.push('Bairro');
    if (!destMunicipio) missingAddrParts.push('Município');
    if (!VALID_UFS.has(destUf)) missingAddrParts.push('UF');
    if (destCepDigits.length !== 8) missingAddrParts.push('CEP (8 dígitos)');

    if (missingAddrParts.length > 0) {
      issues.push({
        group: 'destinatario',
        code: 'Rejeição 225/Schema Endereço',
        field: 'Destinatário — Endereço Completo',
        message: `Destinatário "${destNome || 'não identificado'}" sem ${missingAddrParts.join(', ')}.`,
        hint: 'Complete o endereço (Logradouro, Bairro, Município, UF e CEP de 8 dígitos) no cadastro do cliente/fornecedor ou nos campos do destinatário.',
      });
    }

    // Indicador de IE (1 = Contribuinte com IE, 2 = Isento, 9 = Não Contribuinte)
    const rawIndIe = String(input.destinatario.indicadorIe || '').trim();
    const rawDestIeForm = String(input.destinatario.ie || '').trim();
    const resolvedDestIe = !isBlankOrDash(rawDestIeForm)
      ? rawDestIeForm
      : !isBlankOrDash(resolvedDest.ie)
        ? resolvedDest.ie
        : '';

    const effectiveIndIe: '1' | '2' | '9' | '' =
      rawIndIe === '1' || rawIndIe === '2' || rawIndIe === '9'
        ? rawIndIe
        : isValidIeDigits(resolvedDestIe)
          ? '1'
          : isIeIsentaText(resolvedDestIe)
            ? '2'
            : destDocCheck.type === 'CPF'
              ? '9'
              : '';

    if (!effectiveIndIe) {
      issues.push({
        group: 'destinatario',
        code: 'Rejeição 232/indIEDest',
        field: 'Destinatário — Indicador de IE',
        message:
          'Indicador de IE do Destinatário não definido (informe Contribuinte com IE, Isento ou Não Contribuinte).',
        hint: 'Selecione Contribuinte (informando a IE), Isento ou Não Contribuinte no campo do destinatário.',
      });
    } else if (effectiveIndIe === '1' && !isValidIeDigits(resolvedDestIe)) {
      issues.push({
        group: 'destinatario',
        code: 'Rejeição 232/IE Destinatário',
        field: 'Destinatário — Inscrição Estadual (Contribuinte)',
        message:
          'Destinatário marcado como Contribuinte de ICMS, mas sem número válido de Inscrição Estadual (IE).',
        hint: 'Informe a IE numérica do destinatário ou altere o Indicador de IE para Isento / Não Contribuinte.',
      });
    }
  }

  // =========================================================================
  // 3. ITENS / PRODUTOS
  // =========================================================================
  const items = Array.isArray(input.itens) ? input.itens : [];
  if (items.length === 0) {
    issues.push({
      group: 'itens',
      code: 'Rejeição 225/Schema Itens',
      field: 'Itens / Produtos',
      message: 'A NF-e deve possuir ao menos 1 produto/item válido para transmissão à SEFAZ.',
    });
  } else {
    const defaultCsosn = crtResolved.crt === '3' ? '00' : '102';
    items.forEach((item, idx) => {
      const label = (item.descricao || '').trim() || `Item #${idx + 1}`;
      const codigo = String(item.codigo || '').trim();
      const descricao = String(item.descricao || '').trim();
      const ncmDigits = resolveInventoryNcmForItem(item);
      const cfopDigits = cleanDigits(item.cfop || input.nfeCfop || '');
      const csosnRaw = cleanDigits(item.csosnCst || defaultCsosn);
      const unidade = String(item.unidade || '').trim();
      const quantidade = Number(item.quantidade || 0);
      const valorUnitario = Number(item.valorUnitario || 0);

      if (!codigo) {
        issues.push({
          group: 'itens',
          code: 'Rejeição 225/Schema cProd',
          field: `Item ${idx + 1} — Código`,
          message: `Produto "${label}" sem Código interno informado.`,
        });
      }

      if (!descricao) {
        issues.push({
          group: 'itens',
          code: 'Rejeição 225/Schema xProd',
          field: `Item ${idx + 1} — Descrição`,
          message: `Item #${idx + 1} sem Descrição comercial preenchida.`,
        });
      }

      if (ncmDigits.length !== 8 || ncmDigits === '00000000') {
        issues.push({
          group: 'itens',
          code: 'Rejeição 225/Schema NCM',
          field: `Item ${idx + 1} — NCM (8 dígitos)`,
          message: `Produto "${label}" sem NCM válido de 8 dígitos${
            ncmDigits ? ` (atual: "${ncmDigits}")` : ''
          }.`,
          hint: 'Informe um código NCM válido de 8 dígitos numéricos (ex: 84339090, 23099090).',
        });
      }

      if (cfopDigits.length !== 4 || !/^[123567]\d{3}$/.test(cfopDigits)) {
        issues.push({
          group: 'itens',
          code: 'Rejeição 528/CFOP',
          field: `Item ${idx + 1} — CFOP (4 dígitos)`,
          message: `Produto "${label}" com CFOP inválido ou ausente (exige 4 dígitos numéricos válidos, ex: 5102 ou 5202).`,
        });
      }

      const validCsosn =
        (crtResolved.crt === '3' && csosnRaw.length === 2) ||
        (crtResolved.crt !== '3' && (csosnRaw.length === 3 || csosnRaw.length === 2));
      if (!validCsosn) {
        issues.push({
          group: 'itens',
          code: 'Rejeição 225/Schema CSOSN/CST',
          field: `Item ${idx + 1} — CSOSN / CST`,
          message: `Produto "${label}" sem código CSOSN (3 dígitos) ou CST (2 dígitos) válido.`,
        });
      }

      if (!unidade) {
        issues.push({
          group: 'itens',
          code: 'Rejeição 225/Schema uCom',
          field: `Item ${idx + 1} — Unidade Comercial`,
          message: `Produto "${label}" sem Unidade Comercial (ex: UN, KG, SC, LT).`,
        });
      }

      if (!(quantidade > 0)) {
        issues.push({
          group: 'itens',
          code: 'Rejeição 629/qCom',
          field: `Item ${idx + 1} — Quantidade`,
          message: `Produto "${label}" com Quantidade inválida (deve ser maior que zero).`,
        });
      }

      if (!(valorUnitario > 0)) {
        issues.push({
          group: 'itens',
          code: 'Rejeição 629/vUnCom',
          field: `Item ${idx + 1} — Valor Unitário`,
          message: `Produto "${label}" com Valor Unitário inválido (deve ser maior que R$ 0,00).`,
        });
      }
    });
  }

  // =========================================================================
  // 4. REGRA ESPECÍFICA DE DEVOLUÇÃO (finNFe = 4)
  // =========================================================================
  const finalidadeLower = String(input.nfeFinalidade || '').toLowerCase();
  const headerCfopDigits = cleanDigits(input.nfeCfop || '');
  const anyItemDevolucaoCfop = items.some((it) => DEVOLUCAO_CFOPS.has(cleanDigits(it.cfop || '')));
  const isDevolucao = Boolean(
    input.isDevolucao ||
      finalidadeLower.includes('devolu') ||
      finalidadeLower.trim() === '4' ||
      DEVOLUCAO_CFOPS.has(headerCfopDigits) ||
      anyItemDevolucaoCfop
  );

  const rawRefKey = String(input.chaveNfeReferenciada || '').trim();
  const refKeyDigits = cleanDigits(rawRefKey);
  const refKeyHasLetters = /[a-zA-Z]/.test(rawRefKey);

  if (isDevolucao) {
    if (!rawRefKey) {
      issues.push({
        group: 'devolucao',
        code: 'Rejeição 267/finNFe=4',
        field: 'Devolução — Chave NF-e Referenciada (44 dígitos)',
        message:
          'NF-e de Devolução (finNFe = 4) exige obrigatoriamente a Chave de Acesso da NF-e Referenciada com exatamente 44 dígitos numéricos.',
        hint: 'Informe os 44 dígitos da NF-e original de compra ou venda que está sendo devolvida.',
      });
    } else if (refKeyHasLetters) {
      issues.push({
        group: 'devolucao',
        code: 'Rejeição 267/finNFe=4',
        field: 'Devolução — Chave NF-e Referenciada (44 dígitos)',
        message: `Chave de Acesso da NF-e Referenciada contém letras ou caracteres inválidos ("${rawRefKey.slice(0, 32)}..."). Informe apenas 44 dígitos numéricos.`,
        hint: 'Remova letras ou textos e informe exclusivamente os 44 números da chave de acesso.',
      });
    } else if (refKeyDigits.length !== 44) {
      issues.push({
        group: 'devolucao',
        code: 'Rejeição 267/finNFe=4',
        field: 'Devolução — Chave NF-e Referenciada (44 dígitos)',
        message: `Chave de Acesso da NF-e Referenciada incompleta ou inválida: informados ${refKeyDigits.length} de 44 dígitos numéricos obrigatórios.`,
        hint: 'Confira a chave de 44 dígitos no DANFE ou XML da nota fiscal de origem.',
      });
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    resolvedSummary: {
      ufEmitente: VALID_UFS.has(emitUf) ? emitUf : 'PR',
      crt: crtResolved.crt || '1',
      isDevolucao,
      chaveReferenciadaDigits: refKeyDigits,
    },
  };
}

export function validateNotaSaidaPreSefaz(
  nota: NotaSaidaRecord,
  companyProfile?: Partial<CompanyProfile> | null
): SefazValidationResult {
  const docLower = String(nota.tipoDocumento || '').toLowerCase();
  const isNfeOrNfce = docLower.includes('nf-e') || docLower.includes('nfe') || docLower.includes('nfc-e') || docLower.includes('nfce');
  const profile = companyProfile || getStoredCompanyProfile();

  // Para NFS-e, CT-e ou MDF-e, valida apenas Emitente básico (não bloqueia por NCM/CSOSN de NF-e)
  if (!isNfeOrNfce) {
    const emitUf = String(profile?.state || 'PR').trim().toUpperCase();
    return {
      valid: true,
      issues: [],
      resolvedSummary: {
        ufEmitente: VALID_UFS.has(emitUf) ? emitUf : 'PR',
        crt: resolveCrtFromProfile(profile).crt || '1',
        isDevolucao: false,
        chaveReferenciadaDigits: '',
      },
    };
  }

  const crtResolved = resolveCrtFromProfile(profile);
  const defaultCsosn = crtResolved.crt === '3' ? '00' : '102';
  const isRetornoOrDevolucao =
    String(nota.nfeFinalidade || '').toLowerCase().includes('devolu') ||
    DEVOLUCAO_CFOPS.has(cleanDigits(nota.nfeCfop || ''));

  const mappedItems: PreSefazItemInput[] = (nota.itens || []).map((it, idx) => ({
    codigo: it.codigo || String(idx + 1).padStart(3, '0'),
    descricao: it.descricao,
    ncm: it.ncm,
    cfop: it.cfop || nota.nfeCfop,
    csosnCst: it.csosnCst || defaultCsosn,
    unidade: it.unidade,
    quantidade: it.quantidade,
    valorUnitario: it.valorUnitario,
    inventoryItemId: it.inventoryItemId,
  }));

  return validateNfePreSefaz({
    companyProfile: profile,
    tipoDocumento: nota.tipoDocumento,
    isDevolucao: isRetornoOrDevolucao,
    nfeFinalidade: nota.nfeFinalidade,
    nfeCfop: nota.nfeCfop,
    chaveNfeReferenciada: nota.nfeReferenciada,
    destinatario: {
      id: nota.destinatarioId,
      nome: nota.destinatarioNome,
      cpfCnpj: nota.destinatarioCpfCnpj,
      ie: nota.destinatarioIe,
      indicadorIe: nota.destinatarioIndicadorIe,
      endereco: nota.destinatarioEndereco,
      bairro: nota.destinatarioBairro,
      cep: nota.destinatarioCep,
      cidadeUf: nota.destinatarioCidadeUf,
      isConsumidorAvulso: nota.isConsumidorAvulso,
      preferTipo: isRetornoOrDevolucao ? 'fornecedor' : 'cliente',
    },
    itens: mappedItems,
  });
}

export function validateDevolucaoPreSefaz(params: {
  record: Pick<
    TrocaDevolucaoRecord,
    | 'envolvidoId'
    | 'envolvidoNome'
    | 'envolvidoDocumento'
    | 'envolvidoTipo'
    | 'tipoOperacao'
    | 'numeroVendaOuNotaOrigem'
  >;
  itens: TrocaDevolucaoItem[];
  cfopDevolucao: string;
  chaveNfeReferenciada: string;
  companyProfile?: Partial<CompanyProfile> | null;
  itensNcmOverride?: Record<string, string>;
  itensCsosnOverride?: Record<string, string>;
}): SefazValidationResult {
  const profile = params.companyProfile || getStoredCompanyProfile();
  const isFornecedor =
    params.record.envolvidoTipo === 'fornecedor' ||
    params.record.tipoOperacao === 'devolucao_fornecedor';
  const crtResolved = resolveCrtFromProfile(profile);
  const defaultCsosn = crtResolved.crt === '3' ? '00' : '102';
  const cfopClean = cleanDigits(params.cfopDevolucao);

  const mappedItems: PreSefazItemInput[] = (params.itens || []).map((it, idx) => ({
    codigo: it.productCode || String(idx + 1).padStart(3, '0'),
    descricao: it.productName,
    ncm: params.itensNcmOverride?.[it.id] ?? it.ncm,
    cfop: it.cfop || cfopClean,
    csosnCst: params.itensCsosnOverride?.[it.id] ?? it.csosnCst ?? defaultCsosn,
    unidade: it.unit || 'UN',
    quantidade: it.quantity,
    valorUnitario: it.unitPrice,
    productId: it.productId,
  }));

  return validateNfePreSefaz({
    companyProfile: profile,
    tipoDocumento: 'NF-e',
    isDevolucao: true,
    nfeFinalidade: '4 - Devolução de mercadoria',
    nfeCfop: cfopClean,
    chaveNfeReferenciada: params.chaveNfeReferenciada,
    destinatario: {
      id: params.record.envolvidoId,
      nome: params.record.envolvidoNome,
      cpfCnpj: params.record.envolvidoDocumento,
      preferTipo: isFornecedor ? 'fornecedor' : 'cliente',
      numeroOrigem: params.record.numeroVendaOuNotaOrigem,
    },
    itens: mappedItems,
  });
}
