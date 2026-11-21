import { cleanDigits, formatCpfCnpj } from './formatters';
import {
  formatDateBR,
  getStoredClients,
  getStoredDocumentosEntrada,
  getStoredExpenses,
  getStoredFiscalRecords,
  getStoredNotasSaida,
  getStoredSuppliers,
} from './storage';
import { Client, Supplier } from '../types';

export interface DanfeOficialItem {
  codigo: string;
  descricao: string;
  ncm: string;
  csosnCst: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorDesconto: number;
  valorTotal: number;
  baseIcms: number;
  valorIcms: number;
  valorIpi: number;
  aliquotaIcms: number;
  aliquotaIpi: number;
}

export interface DanfeOficialPagamento {
  descricao: string;
  valor: number;
}

export interface DanfeOficialInput {
  numero: string;
  serie?: string;
  tipoOperacao: '0' | '1';
  chaveAcesso: string;
  naturezaOperacao: string;
  protocoloAutorizacao: string;
  dataEmissao: string;
  dataSaida?: string;
  horaSaida?: string;
  isHomologacao?: boolean;
  emitente: {
    razaoSocial: string;
    cnpjCpf: string;
    ie: string;
    ieSt?: string;
    endereco: string;
    bairro: string;
    municipio: string;
    uf: string;
    cep: string;
    fone: string;
    logoUrl?: string;
  };
  destinatario: {
    nomeRazaoSocial: string;
    cnpjCpf: string;
    endereco: string;
    bairro: string;
    cep: string;
    municipio: string;
    uf: string;
    fone: string;
    ie: string;
  };
  pagamentos: DanfeOficialPagamento[];
  totais: {
    baseCalculoIcms: number;
    valorIcms: number;
    baseCalculoIcmsSt: number;
    valorIcmsSt: number;
    valorTotalProdutos: number;
    valorFrete: number;
    valorSeguro: number;
    desconto: number;
    outrasDespesas: number;
    valorIpi: number;
    valorTotalNota: number;
  };
  transportador: {
    nomeRazaoSocial: string;
    fretePorConta: string;
    codigoAntt?: string;
    placaVeiculo?: string;
    veiculoUf?: string;
    cnpjCpf?: string;
    endereco?: string;
    municipio?: string;
    uf?: string;
    ie?: string;
  };
  itens: DanfeOficialItem[];
  informacoesComplementares: string;
  options?: {
    isPreview?: boolean;
    autoPrint?: boolean;
    hideToolbar?: boolean;
    documentTitle?: string;
  };
}

const escapeHtml = (value?: string | number | null): string => {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

export const formatNumeroNfe9 = (rawNumero?: string | null): string => {
  const digits = cleanDigits(rawNumero || '1')
    .padStart(9, '0')
    .slice(-9);
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}`;
};

export const formatChaveAcesso44 = (rawKey?: string | null): string => {
  const digits = cleanDigits(rawKey || '')
    .padStart(44, '0')
    .slice(0, 44);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
};

export const formatNumBR = (value?: number | null, minDec = 2, maxDec = 2): string => {
  const num = Number(value) || 0;
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: minDec,
    maximumFractionDigits: maxDec,
  });
};

export const formatCurrencyDanfeBR = (value?: number | null): string => {
  return `R$ ${formatNumBR(value, 2, 2)}`;
};

const CODE128_PATTERNS: string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

export function generateCode128CSvgDanfe(digits44: string): string {
  const clean = cleanDigits(digits44).padStart(44, '0').slice(0, 44);
  const symbols: number[] = [105];
  let checksum = 105;

  for (let i = 0; i < 44; i += 2) {
    const pairVal = parseInt(clean.slice(i, i + 2), 10) || 0;
    const pos = i / 2 + 1;
    symbols.push(pairVal);
    checksum += pairVal * pos;
  }

  symbols.push(checksum % 103);
  symbols.push(106);

  const quietZone = 8;
  let x = quietZone;
  const height = 40;
  const rects: string[] = [];

  for (const sym of symbols) {
    const pattern = CODE128_PATTERNS[sym] || CODE128_PATTERNS[0];
    for (let j = 0; j < pattern.length; j++) {
      const w = parseInt(pattern[j], 10);
      if (j % 2 === 0) {
        rects.push(`<rect x="${x}" y="0" width="${w}" height="${height}" fill="#000000" />`);
      }
      x += w;
    }
  }

  const totalWidth = x + quietZone;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${height}" width="100%" height="34" preserveAspectRatio="none" style="display:block;">${rects.join('')}</svg>`;
}

const UF_IBGE: Record<string, string> = {
  RO: '11', AC: '12', AM: '13', RR: '14', PA: '15', AP: '16', TO: '17',
  MA: '21', PI: '22', CE: '23', RN: '24', PB: '25', PE: '26', AL: '27',
  SE: '28', BA: '29', MG: '31', ES: '32', RJ: '33', SP: '35', PR: '41',
  SC: '42', RS: '43', MS: '50', MT: '51', GO: '52', DF: '53',
};

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

export function buildDeterministicChave44(params: {
  uf?: string;
  dataEmissao?: string;
  cnpj?: string;
  modelo?: string;
  serie?: string;
  numero?: string;
  seed?: string;
}): string {
  const cUF = UF_IBGE[(params.uf || 'PR').trim().toUpperCase()] || '41';
  const parts = (params.dataEmissao || '').split('-');
  const aamm =
    parts.length >= 2 && parts[0].length === 4
      ? `${parts[0].slice(2, 4)}${parts[1].padStart(2, '0')}`
      : `${new Date().getFullYear().toString().slice(2)}${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const cnpj = cleanDigits(params.cnpj || '').padStart(14, '0').slice(0, 14);
  const modelo = params.modelo || '55';
  const serie = cleanDigits(params.serie || '1').padStart(3, '0').slice(-3);
  const numero = cleanDigits(params.numero || '1').padStart(9, '0').slice(-9);
  const cNF = (cleanDigits(`${params.numero || '1'}${params.seed || '10203040'}`) || '10203040')
    .padStart(8, '1')
    .slice(-8);
  const base43 = `${cUF}${aamm}${cnpj}${modelo}${serie}${numero}1${cNF}`;
  return `${base43}${computeMod11(base43)}`;
}

export function formatDanfeTimestampBR(date = new Date()): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;
}

function formatZipDanfe(raw?: string | null): string {
  const digits = cleanDigits(raw || '');
  if (digits.length === 8) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  return String(raw || '').trim();
}

function extractCepDanfe(raw?: string | null): string {
  if (!raw) return '';
  const m = String(raw).match(/\b(\d{5})-?(\d{3})\b/);
  return m ? `${m[1]}-${m[2]}` : '';
}

function splitCityUfDanfe(raw?: string | null): { cidade: string; uf: string } {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return { cidade: '', uf: '' };
  const m = trimmed.match(/^(.*?)[\/\-]\s*([A-Za-z]{2})$/);
  if (m) {
    return { cidade: m[1].trim(), uf: m[2].trim().toUpperCase() };
  }
  return { cidade: trimmed, uf: '' };
}

function normalizeTextKey(raw?: string | null): string {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function pickNonBlank(...values: Array<string | undefined | null>): string {
  for (const v of values) {
    const t = String(v || '').trim();
    if (t && t !== '-' && t !== '—') return t;
  }
  return '';
}

export interface ResolveDestinatarioInput {
  id?: string;
  nome?: string;
  cpfCnpj?: string;
  ie?: string;
  endereco?: string;
  bairro?: string;
  cep?: string;
  municipio?: string;
  uf?: string;
  cidadeUf?: string;
  fone?: string;
  preferTipo?: 'cliente' | 'fornecedor';
  chaveNfeReferenciada?: string;
  numeroOrigem?: string;
}

export function resolveDestinatarioDanfe(
  params: ResolveDestinatarioInput
): DanfeOficialInput['destinatario'] {
  const clients = getStoredClients();
  const suppliers = getStoredSuppliers();

  let refNotaSaidaNome = '';
  let refNotaSaidaId = '';
  let refNotaSaidaDoc = '';
  let refNotaSaidaIe = '';
  let refNotaSaidaEnd = '';
  let refNotaSaidaCidadeUf = '';
  let refSupplierId = '';
  let refSupplierName = '';
  let refSupplierCnpj = '';

  const refKeyDigits = cleanDigits(params.chaveNfeReferenciada || '');
  const refNumDigits = cleanDigits(params.numeroOrigem || '').replace(/^0+/, '');

  if (refKeyDigits.length === 44 || refNumDigits) {
    const notasSaida = getStoredNotasSaida();
    const matchedSaida = notasSaida.find((n) => {
      const k = cleanDigits(n.chaveAcesso || '');
      const num = cleanDigits(n.numero || '').replace(/^0+/, '');
      return (
        (refKeyDigits.length === 44 && k === refKeyDigits) ||
        (refNumDigits && num && num === refNumDigits)
      );
    });
    if (matchedSaida) {
      refNotaSaidaNome = matchedSaida.destinatarioNome || '';
      refNotaSaidaId = matchedSaida.destinatarioId || '';
      refNotaSaidaDoc = matchedSaida.destinatarioCpfCnpj || '';
      refNotaSaidaIe = matchedSaida.destinatarioIe || '';
      refNotaSaidaEnd = matchedSaida.destinatarioEndereco || '';
      refNotaSaidaCidadeUf = matchedSaida.destinatarioCidadeUf || '';
    }

    const docsEntrada = getStoredDocumentosEntrada();
    const matchedDocEntrada = docsEntrada.find((d) => {
      const k = cleanDigits(d.chave_acesso || '');
      const num = cleanDigits(d.numero || d.numero_documento || '').replace(/^0+/, '');
      return (
        (refKeyDigits.length === 44 && k === refKeyDigits) ||
        (refNumDigits && num && num === refNumDigits)
      );
    });
    if (matchedDocEntrada) {
      refSupplierId = matchedDocEntrada.fornecedor_id || '';
      refSupplierName = matchedDocEntrada.fornecedor_nome || matchedDocEntrada.fornecedor || '';
      refSupplierCnpj = matchedDocEntrada.fornecedor_cnpj || '';
    }

    const expensesPool = [...getStoredFiscalRecords(), ...getStoredExpenses()];
    const matchedExp = expensesPool.find((e) => {
      const k = cleanDigits(e.accessKey || '');
      const num = cleanDigits(e.invoiceNumber || '').replace(/^0+/, '');
      return (
        (refKeyDigits.length === 44 && k === refKeyDigits) ||
        (refNumDigits && num && num === refNumDigits)
      );
    });
    if (matchedExp) {
      refSupplierId = refSupplierId || matchedExp.supplierId || matchedExp.fornecedorId || '';
      refSupplierName = refSupplierName || matchedExp.supplier || '';
    }
  }

  const candidateId = pickNonBlank(params.id, refNotaSaidaId, refSupplierId);
  const candidateDocDigits = cleanDigits(
    pickNonBlank(params.cpfCnpj, refNotaSaidaDoc, refSupplierCnpj)
  );
  const candidateNameKey = normalizeTextKey(
    pickNonBlank(params.nome, refNotaSaidaNome, refSupplierName)
  );

  const findSupplier = (): Supplier | undefined =>
    suppliers.find((s) => {
      if (candidateId && s.id === candidateId) return true;
      const sDoc = cleanDigits(s.cnpjOrCpf || '');
      if (candidateDocDigits.length >= 11 && sDoc === candidateDocDigits) return true;
      if (candidateNameKey) {
        const n1 = normalizeTextKey(s.name);
        const n2 = normalizeTextKey(s.tradeName);
        if (n1 === candidateNameKey || (n2 && n2 === candidateNameKey)) return true;
      }
      return false;
    });

  const findClient = (): Client | undefined =>
    clients.find((c) => {
      if (candidateId && c.id === candidateId) return true;
      const cDoc = cleanDigits(c.cpfCnpj || '');
      if (candidateDocDigits.length >= 11 && cDoc === candidateDocDigits) return true;
      if (candidateNameKey) {
        const n1 = normalizeTextKey(c.name || c.nome);
        const n2 = normalizeTextKey(c.farmName || c.fazenda);
        if (n1 === candidateNameKey || (n2 && n2 === candidateNameKey)) return true;
      }
      return false;
    });

  const matchedSupplier =
    params.preferTipo === 'fornecedor'
      ? findSupplier()
      : findSupplier();
  const matchedClient =
    params.preferTipo === 'cliente'
      ? findClient()
      : findClient();

  const entity =
    params.preferTipo === 'fornecedor'
      ? matchedSupplier || matchedClient
      : matchedClient || matchedSupplier;

  const isSupplierEntity = Boolean(
    entity && ('cnpjOrCpf' in entity || 'tradeName' in entity)
  );
  const sup = isSupplierEntity ? (entity as Supplier) : undefined;
  const cli = !isSupplierEntity && entity ? (entity as Client) : undefined;

  const entityStreet = sup
    ? [
        sup.address,
        sup.addressNumber ? `Nº ${sup.addressNumber}` : '',
        sup.addressComplement,
      ]
        .filter(Boolean)
        .join(', ')
    : cli
      ? [
          cli.address,
          cli.addressNumber ? `Nº ${cli.addressNumber}` : '',
          cli.addressComplement,
        ]
          .filter(Boolean)
          .join(', ')
      : '';

  const entityBairro = sup ? sup.neighborhood || '' : cli ? cli.neighborhood || '' : '';
  const entityCep = sup
    ? formatZipDanfe(sup.zipCode)
    : cli
      ? formatZipDanfe(cli.zipCode)
      : '';
  const entityMunicipio = sup
    ? sup.city || ''
    : cli
      ? cli.city || cli.cidade || ''
      : '';
  const entityUf = sup
    ? (sup.state || '').toUpperCase()
    : cli
      ? (cli.state || cli.estado || '').toUpperCase()
      : '';
  const entityFone = sup
    ? sup.phone || ''
    : cli
      ? cli.phone || cli.telefone || ''
      : '';
  const entityIe = sup
    ? sup.stateRegistration || ''
    : cli
      ? cli.stateRegistration || ''
      : '';
  const entityDoc = sup
    ? sup.cnpjOrCpf || ''
    : cli
      ? cli.cpfCnpj || ''
      : '';
  const entityNome = sup
    ? sup.name || sup.tradeName || ''
    : cli
      ? cli.name || cli.nome || ''
      : '';

  const explicitCityUf = splitCityUfDanfe(params.cidadeUf);
  const refCityUf = splitCityUfDanfe(refNotaSaidaCidadeUf);

  const enderecoFinal = pickNonBlank(params.endereco, refNotaSaidaEnd, entityStreet) || '-';
  const bairroFinal = pickNonBlank(params.bairro, entityBairro) || '-';
  const cepFinal =
    pickNonBlank(
      formatZipDanfe(params.cep),
      entityCep,
      extractCepDanfe(params.endereco),
      extractCepDanfe(refNotaSaidaEnd)
    ) || '-';
  const municipioFinal =
    pickNonBlank(params.municipio, explicitCityUf.cidade, entityMunicipio, refCityUf.cidade) ||
    '-';
  const ufFinal =
    pickNonBlank(params.uf, explicitCityUf.uf, entityUf, refCityUf.uf).toUpperCase() || '-';
  const foneFinal = pickNonBlank(params.fone, entityFone) || '-';
  const ieFinal = pickNonBlank(params.ie, refNotaSaidaIe, entityIe) || 'ISENTO';
  const docFinal = pickNonBlank(params.cpfCnpj, refNotaSaidaDoc, refSupplierCnpj, entityDoc);
  const nomeFinal = pickNonBlank(params.nome, entityNome, refNotaSaidaNome, refSupplierName) || '-';

  return {
    nomeRazaoSocial: nomeFinal,
    cnpjCpf: docFinal ? formatCpfCnpj(docFinal) || docFinal : 'NÃO INFORMADO',
    endereco: enderecoFinal,
    bairro: bairroFinal,
    cep: cepFinal,
    municipio: municipioFinal,
    uf: ufFinal,
    fone: foneFinal,
    ie: ieFinal,
  };
}

export function buildDanfeOficialNfeHtml(input: DanfeOficialInput): string {
  const isPreview = Boolean(input.options?.isPreview);
  const autoPrint = input.options?.autoPrint !== false && !isPreview;

  const numero9 = formatNumeroNfe9(input.numero);
  const serieFormatted = String(input.serie || '001').trim() || '001';
  const chave44 = cleanDigits(input.chaveAcesso).length === 44
    ? cleanDigits(input.chaveAcesso)
    : buildDeterministicChave44({
        uf: input.emitente.uf,
        cnpj: input.emitente.cnpjCpf,
        serie: serieFormatted,
        numero: input.numero,
      });
  const chaveFormatada = formatChaveAcesso44(chave44);
  const barcodeSvg = generateCode128CSvgDanfe(chave44);

  const dataEmissaoBR = input.dataEmissao.includes('/') ? input.dataEmissao : formatDateBR(input.dataEmissao);
  const dataSaidaBR = input.dataSaida
    ? (input.dataSaida.includes('/') ? input.dataSaida : formatDateBR(input.dataSaida))
    : dataEmissaoBR;
  const horaSaidaStr = (input.horaSaida || '').trim() || '—';

  const emitRazao = (input.emitente.razaoSocial || 'EMPRESA EMITENTE').trim();
  const emitCnpj = input.emitente.cnpjCpf
    ? formatCpfCnpj(input.emitente.cnpjCpf) || input.emitente.cnpjCpf
    : 'NÃO INFORMADO';
  const emitIe = (input.emitente.ie || '').trim() || 'ISENTO';
  const emitIeSt = (input.emitente.ieSt || '').trim();

  const emitLocationLine = [
    input.emitente.municipio && input.emitente.uf
      ? `${input.emitente.municipio} - ${input.emitente.uf}`
      : input.emitente.municipio || input.emitente.uf || '',
    input.emitente.cep ? `CEP: ${input.emitente.cep}` : '',
  ]
    .filter(Boolean)
    .join(' - ');

  const destNome = (input.destinatario.nomeRazaoSocial || '-').trim();
  const destCnpjCpf = input.destinatario.cnpjCpf
    ? formatCpfCnpj(input.destinatario.cnpjCpf) || input.destinatario.cnpjCpf
    : 'NÃO INFORMADO';

  const pagamentosList: DanfeOficialPagamento[] =
    Array.isArray(input.pagamentos) && input.pagamentos.length > 0
      ? input.pagamentos
      : [{ descricao: 'Sem Pagamento', valor: 0 }];

  const pagamentosRowsHtml = pagamentosList
    .map(
      (pg) => `
      <tr>
        <td style="font-size:9.5pt;font-weight:400;padding:2px 5px;">${escapeHtml(pg.descricao)}</td>
        <td class="tr mono" style="font-size:9.5pt;font-weight:400;padding:2px 5px;">${escapeHtml(formatCurrencyDanfeBR(pg.valor))}</td>
      </tr>`
    )
    .join('');

  // 14 colunas oficiais da grade DADOS DOS PRODUTOS / SERVIÇOS (soma exata = 100%)
  const colWidths = [
    '6%',    // 1. CÓDIGO PRODUTO
    '19.5%', // 2. DESCRIÇÃO DO PRODUTO / SERVIÇO
    '7%',    // 3. NCM/SH
    '6%',    // 4. CSOSN / CST
    '4.5%',  // 5. CFOP
    '4%',    // 6. UNID
    '5.5%',  // 7. QTDE.
    '7.5%',  // 8. VALOR UNITÁRIO
    '7.5%',  // 9. VALOR DESCONTO
    '7.5%',  // 10. VALOR TOTAL
    '7.5%',  // 11. BASE DE CÁLC. ICMS
    '6%',    // 12. VALOR ICMS
    '5%',    // 13. VALOR IPI
    '6.5%',  // 14. ALÍQ. % (ICMS / IPI)
  ];

  const colgroupHtml = `<colgroup>${colWidths.map((w) => `<col style="width:${w};" />`).join('')}</colgroup>`;
  const colGuidesHtml = colWidths
    .map(
      (w, idx) =>
        `<div style="flex:0 0 ${w};width:${w};box-sizing:border-box;${idx > 0 ? 'border-left:1px solid #000000;' : ''}"></div>`
    )
    .join('');

  const itemsRowsHtml =
    input.itens.length > 0
      ? input.itens
          .map(
            (it) => `
          <tr class="prod-row">
            <td class="tc mono">${escapeHtml(it.codigo || '001')}</td>
            <td class="tl">${escapeHtml(it.descricao)}</td>
            <td class="tc mono">${escapeHtml(it.ncm || '00000000')}</td>
            <td class="tc mono">${escapeHtml(it.csosnCst || '102')}</td>
            <td class="tc mono">${escapeHtml(cleanDigits(it.cfop || '') || it.cfop || '5102')}</td>
            <td class="tc">${escapeHtml(it.unidade || 'UN')}</td>
            <td class="tr mono">${formatNumBR(it.quantidade, 2, 3)}</td>
            <td class="tr mono">${formatNumBR(it.valorUnitario, 2, 2)}</td>
            <td class="tr mono">${formatNumBR(it.valorDesconto, 2, 2)}</td>
            <td class="tr mono">${formatNumBR(it.valorTotal, 2, 2)}</td>
            <td class="tr mono">${formatNumBR(it.baseIcms, 2, 2)}</td>
            <td class="tr mono">${formatNumBR(it.valorIcms, 2, 2)}</td>
            <td class="tr mono">${formatNumBR(it.valorIpi, 2, 2)}</td>
            <td class="tc mono">${formatNumBR(it.aliquotaIcms, 1, 2)} / ${formatNumBR(it.aliquotaIpi, 1, 2)}</td>
          </tr>`
          )
          .join('')
      : `
        <tr class="prod-row">
          <td class="tc mono">001</td>
          <td class="tl">MERCADORIA / PRODUTO CONFORME DOCUMENTO</td>
          <td class="tc mono">00000000</td>
          <td class="tc mono">102</td>
          <td class="tc mono">5102</td>
          <td class="tc">UN</td>
          <td class="tr mono">1,00</td>
          <td class="tr mono">${formatNumBR(input.totais.valorTotalNota, 2, 2)}</td>
          <td class="tr mono">0,00</td>
          <td class="tr mono">${formatNumBR(input.totais.valorTotalNota, 2, 2)}</td>
          <td class="tr mono">0,00</td>
          <td class="tr mono">0,00</td>
          <td class="tr mono">0,00</td>
          <td class="tc mono">0,0 / 0,0</td>
        </tr>`;

  const infoComplementaresText = (input.informacoesComplementares || '').trim();
  const homologacaoNote = input.isHomologacao
    ? 'EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL.'
    : '';
  const combinedInfoComplementares = [homologacaoNote, infoComplementaresText]
    .filter((v, idx, arr) => Boolean(v) && arr.indexOf(v) === idx)
    .join('\n');

  const docTitle = input.options?.documentTitle || `DANFE NF-e Nº ${numero9} - ${emitRazao}`;
  const printedAtBR = formatDanfeTimestampBR();

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(docTitle)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 4mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #000000;
      font-family: "Times New Roman", Times, Georgia, serif;
      font-weight: 400;
    }
    @media print {
      html, body {
        width: 100%;
        height: 100%;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
      }
      .no-print { display: none !important; }
      .danfe-sheet {
        width: 100% !important;
        max-width: none !important;
        min-height: 288mm !important;
        margin: 0 !important;
        padding: 0 !important;
        box-sizing: border-box !important;
        border: none !important;
        display: flex !important;
        flex-direction: column !important;
      }
    }
    .no-print {
      width: 100%;
      margin: 0 0 6px 0;
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    .btn-print {
      padding: 6px 14px;
      background: #000000;
      color: #ffffff;
      border: 1px solid #000000;
      font-weight: 400;
      font-size: 11px;
      cursor: pointer;
    }
    .btn-close {
      padding: 6px 14px;
      background: #ffffff;
      color: #000000;
      border: 1px solid #000000;
      font-weight: 400;
      font-size: 11px;
      cursor: pointer;
    }
    .preview-banner {
      width: 100%;
      margin: 0 0 6px 0;
      background: #ffffff;
      border: 1px solid #000000;
      color: #000000;
      padding: 5px 10px;
      font-size: 10px;
      font-weight: 400;
      text-align: center;
    }
    .danfe-sheet {
      width: 100%;
      min-height: 288mm;
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      background: #ffffff;
      display: flex;
      flex-direction: column;
    }
    .danfe-top {
      width: 100%;
      flex-shrink: 0;
    }
    .danfe-middle {
      width: 100%;
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .danfe-bottom {
      width: 100%;
      margin-top: auto;
      flex-shrink: 0;
    }
    table.danfe-box {
      width: 100%;
      table-layout: fixed;
      border-collapse: collapse;
      background: #ffffff;
    }
    table.danfe-box.no-top {
      margin-top: -1px;
    }
    table.danfe-box td,
    table.danfe-box th {
      border: 1px solid #000000;
      padding: 2px 4px;
      vertical-align: top;
      background: #ffffff;
      overflow: hidden;
      font-weight: 400;
    }
    .cut-line {
      width: 100%;
      border-bottom: 1px dashed #000000;
      margin: 2mm 0;
    }
    .sec-title {
      font-size: 6.5pt;
      font-weight: 400;
      letter-spacing: 0.2px;
      margin: 3px 0 1px 0;
      line-height: 1.1;
      color: #000000;
      text-transform: uppercase;
    }
    .lbl {
      display: block;
      font-size: 6.5pt;
      font-weight: 400;
      line-height: 1.05;
      text-transform: uppercase;
      color: #000000;
      margin-bottom: 1.5px;
      white-space: normal;
      overflow: visible;
      text-overflow: clip;
    }
    .val {
      display: block;
      font-size: 10pt;
      font-weight: 400;
      line-height: 1.15;
      color: #000000;
      word-break: break-word;
    }
    .val-sm {
      display: block;
      font-size: 9.5pt;
      font-weight: 400;
      line-height: 1.15;
      color: #000000;
      word-break: break-word;
    }
    .mono {
      font-family: "Times New Roman", Times, Georgia, serif;
      font-variant-numeric: tabular-nums;
    }
    .tc { text-align: center; }
    .tl { text-align: left; }
    .tr { text-align: right; }

    /* Cabeçalho Emitente / DANFE / Chave */
    .emit-flex {
      display: flex;
      align-items: flex-start;
      gap: 6px;
    }
    .emit-logo {
      max-width: 56px;
      max-height: 52px;
      object-fit: contain;
      background: #ffffff;
      flex-shrink: 0;
    }
    .danfe-title {
      font-size: 14pt;
      font-weight: 700;
      letter-spacing: 0.6px;
      line-height: 1.05;
      margin: 0;
    }
    .danfe-subtitle {
      font-size: 6.5pt;
      font-weight: 400;
      line-height: 1.15;
      margin: 2px 0 3px 0;
    }
    .tipo-op-wrap {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      margin: 2px auto 3px auto;
      font-size: 6.5pt;
      font-weight: 400;
    }
    .tipo-op-num {
      border: 1px solid #000000;
      padding: 1.5px 6px;
      font-size: 10pt;
      font-weight: 400;
      background: #ffffff;
    }

    /* Grade expansível de produtos */
    .prod-stretch-wrap {
      width: 100%;
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
      border: 1px solid #000000;
      background: #ffffff;
      overflow: hidden;
      box-sizing: border-box;
    }
    table.prod-table {
      width: 100%;
      table-layout: fixed;
      border-collapse: collapse;
      border: none;
      background: #ffffff;
    }
    table.prod-table th {
      border-bottom: 1px solid #000000;
      border-left: 1px solid #000000;
      border-top: none;
      border-right: none;
      padding: 2px 1.5px;
      font-size: 6.5pt;
      font-weight: 400;
      line-height: 1.12;
      white-space: normal;
      word-break: normal;
      text-align: center;
      vertical-align: middle;
      background: #ffffff;
      color: #000000;
      text-transform: uppercase;
      overflow: hidden;
    }
    table.prod-table th:first-child,
    table.prod-table td:first-child {
      border-left: none;
    }
    table.prod-table tr.prod-row td {
      border-left: 1px solid #000000;
      border-bottom: 1px solid #cccccc;
      border-top: none;
      border-right: none;
      padding: 2px 2.5px;
      font-size: 8.5pt;
      font-weight: 400;
      line-height: 1.18;
      vertical-align: top;
      background: #ffffff;
      color: #000000;
      word-break: break-word;
    }
    table.prod-table tr.prod-row td:first-child {
      border-left: none;
    }
    .prod-col-guides {
      flex: 1;
      display: flex;
      align-items: stretch;
      width: 100%;
      min-height: 10mm;
      background: #ffffff;
    }

    /* Dados Adicionais e Rodapé */
    .da-cell {
      height: 52px;
      background: #ffffff;
    }
    .danfe-footer {
      margin-top: 3px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 7pt;
      font-weight: 400;
      color: #000000;
      line-height: 1.1;
    }
  </style>
</head>
<body>
  ${
    isPreview
      ? `<div class="preview-banner">PRÉ-VISUALIZAÇÃO DO DANFE OFICIAL (NF-e MODELO 55) — PADRÃO SEFAZ</div>`
      : input.options?.hideToolbar
        ? ''
        : `<div class="no-print">
          <button class="btn-close" onclick="window.close()">Fechar</button>
          <button class="btn-print" onclick="window.focus();window.print()">Imprimir / Salvar PDF (DANFE)</button>
        </div>`
  }

  <div class="danfe-sheet">
    <!-- TOPO FIXO -->
    <div class="danfe-top">
      <!-- 1. CANHOTO SUPERIOR DESTACÁVEL -->
      <table class="danfe-box">
        <colgroup><col style="width:26%" /><col style="width:56%" /><col style="width:18%" /></colgroup>
        <tr>
          <td colspan="2" style="padding:3px 5px;font-size:7.5pt;font-weight:400;line-height:1.25;">
            Recebemos de ${escapeHtml(emitRazao)} os produtos e/ou serviços constantes da Nota Fiscal Eletrônica indicada ao lado. Emissão: ${escapeHtml(dataEmissaoBR)} Dest/Reme: ${escapeHtml(destNome)} Valor Total: ${escapeHtml(formatCurrencyDanfeBR(input.totais.valorTotalNota))}
          </td>
          <td rowspan="2" style="text-align:center;vertical-align:middle;padding:3px 4px;">
            <div style="font-size:10pt;font-weight:700;line-height:1.15;">NF-e</div>
            <div style="font-size:8.5pt;font-weight:400;line-height:1.2;">Nº ${escapeHtml(numero9)}</div>
            <div style="font-size:8pt;font-weight:400;line-height:1.15;">Série ${escapeHtml(serieFormatted)}</div>
          </td>
        </tr>
        <tr>
          <td style="height:22px;"><span class="lbl">DATA DO RECEBIMENTO</span></td>
          <td style="height:22px;"><span class="lbl">IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR</span></td>
        </tr>
      </table>

      <div class="cut-line"></div>

      <!-- 2. CABEÇALHO PRINCIPAL EM 3 COLUNAS -->
      <table class="danfe-box">
        <colgroup><col style="width:40%" /><col style="width:18%" /><col style="width:42%" /></colgroup>
        <tr>
          <td rowspan="3" style="padding:4px 5px;vertical-align:top;">
            <div class="emit-flex">
              ${input.emitente.logoUrl ? `<img class="emit-logo" src="${escapeHtml(input.emitente.logoUrl)}" alt="Logo" />` : ''}
              <div style="flex:1;min-width:0;">
                <div style="font-size:10pt;font-weight:700;line-height:1.15;margin-bottom:2px;word-break:break-word;">${escapeHtml(emitRazao)}</div>
                <div style="font-size:8.5pt;font-weight:400;line-height:1.22;word-break:break-word;">
                  ${escapeHtml(input.emitente.endereco || 'Endereço não informado')}<br/>
                  ${input.emitente.bairro ? `${escapeHtml(input.emitente.bairro)}<br/>` : ''}
                  ${emitLocationLine ? `${escapeHtml(emitLocationLine)}<br/>` : ''}
                  ${input.emitente.fone ? `Fone: ${escapeHtml(input.emitente.fone)}` : ''}
                </div>
              </div>
            </div>
          </td>
          <td rowspan="3" style="padding:4px;text-align:center;vertical-align:middle;">
            <p class="danfe-title">DANFE</p>
            <p class="danfe-subtitle">Documento Auxiliar da Nota Fiscal Eletrônica</p>
            <div class="tipo-op-wrap">
              <div style="text-align:left;line-height:1.15;">0 - ENTRADA<br/>1 - SAÍDA</div>
              <div class="tipo-op-num">${input.tipoOperacao}</div>
            </div>
            <div style="line-height:1.2;">
              <div style="font-size:9.5pt;font-weight:400;">Nº ${escapeHtml(numero9)}</div>
              <div style="font-size:8.5pt;font-weight:400;">Série ${escapeHtml(serieFormatted)}</div>
              <div style="font-size:7.5pt;font-weight:400;">Folha 1/1</div>
            </div>
          </td>
          <td style="padding:4px 6px 3px 6px;">
            ${barcodeSvg}
          </td>
        </tr>
        <tr>
          <td style="padding:2px 4px;">
            <span class="lbl">CHAVE DE ACESSO</span>
            <span class="val-sm mono tc" style="font-size:8.5pt;font-weight:700;letter-spacing:0.15px;white-space:nowrap;overflow:visible;">${escapeHtml(chaveFormatada)}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:2.5px 4px;font-size:6.5pt;font-weight:400;line-height:1.2;text-align:center;vertical-align:middle;">
            Consulta de autenticidade no portal nacional da NF-e www.nfe.fazenda.gov.br/portal ou no site da Sefaz autorizadora
          </td>
        </tr>
      </table>

      <!-- FAIXAS DE AUTORIZAÇÃO -->
      <table class="danfe-box no-top">
        <colgroup><col style="width:55%" /><col style="width:45%" /></colgroup>
        <tr>
          <td><span class="lbl">NATUREZA DA OPERAÇÃO</span><span class="val-sm">${escapeHtml(input.naturezaOperacao)}</span></td>
          <td>
            <span class="lbl">PROTOCOLO DE AUTORIZAÇÃO DE USO</span>
            <span class="val-sm mono" style="margin-top:1.5px;">${escapeHtml(input.protocoloAutorizacao)}</span>
            ${
              input.isHomologacao
                ? `<div style="margin-top:2px;"><span style="display:inline-block;padding:1px 4px;border:1px solid #000000;font-size:6pt;font-weight:400;letter-spacing:0.2px;line-height:1.15;white-space:nowrap;">HOMOLOGAÇÃO — SEM VALOR FISCAL</span></div>`
                : ''
            }
          </td>
        </tr>
      </table>
      <table class="danfe-box no-top">
        <colgroup><col style="width:34%" /><col style="width:33%" /><col style="width:33%" /></colgroup>
        <tr>
          <td><span class="lbl">INSCRIÇÃO ESTADUAL</span><span class="val-sm mono">${escapeHtml(emitIe)}</span></td>
          <td><span class="lbl">INSCRIÇÃO ESTADUAL DO SUBSTITUTO TRIBUTÁRIO</span><span class="val-sm mono">${escapeHtml(emitIeSt)}</span></td>
          <td><span class="lbl">CNPJ / CPF</span><span class="val-sm mono">${escapeHtml(emitCnpj)}</span></td>
        </tr>
      </table>

      <!-- 3A. DESTINATÁRIO / REMETENTE (3 LINHAS) -->
      <div class="sec-title">DESTINATÁRIO / REMETENTE</div>
      <table class="danfe-box">
        <colgroup><col style="width:58%" /><col style="width:24%" /><col style="width:18%" /></colgroup>
        <tr>
          <td><span class="lbl">NOME / RAZÃO SOCIAL</span><span class="val-sm">${escapeHtml(destNome)}</span></td>
          <td><span class="lbl">CNPJ / CPF</span><span class="val-sm mono">${escapeHtml(destCnpjCpf)}</span></td>
          <td><span class="lbl">DATA DA EMISSÃO</span><span class="val-sm tc mono">${escapeHtml(dataEmissaoBR)}</span></td>
        </tr>
      </table>
      <table class="danfe-box no-top">
        <colgroup><col style="width:48%" /><col style="width:20%" /><col style="width:14%" /><col style="width:18%" /></colgroup>
        <tr>
          <td><span class="lbl">ENDEREÇO</span><span class="val-sm">${escapeHtml(input.destinatario.endereco || '-')}</span></td>
          <td><span class="lbl">BAIRRO / DISTRITO</span><span class="val-sm">${escapeHtml(input.destinatario.bairro || '-')}</span></td>
          <td><span class="lbl">CEP</span><span class="val-sm mono">${escapeHtml(input.destinatario.cep || '-')}</span></td>
          <td><span class="lbl">DATA DA SAÍDA</span><span class="val-sm tc mono">${escapeHtml(dataSaidaBR)}</span></td>
        </tr>
      </table>
      <table class="danfe-box no-top">
        <colgroup><col style="width:38%" /><col style="width:6%" /><col style="width:18%" /><col style="width:20%" /><col style="width:18%" /></colgroup>
        <tr>
          <td><span class="lbl">MUNICÍPIO</span><span class="val-sm">${escapeHtml(input.destinatario.municipio || '-')}</span></td>
          <td><span class="lbl">UF</span><span class="val-sm tc">${escapeHtml(input.destinatario.uf || '-')}</span></td>
          <td><span class="lbl">TELEFONE / FAX</span><span class="val-sm mono">${escapeHtml(input.destinatario.fone || '-')}</span></td>
          <td><span class="lbl">INSCRIÇÃO ESTADUAL</span><span class="val-sm mono">${escapeHtml(input.destinatario.ie || 'ISENTO')}</span></td>
          <td><span class="lbl">HORA DA SAÍDA</span><span class="val-sm tc mono">${escapeHtml(horaSaidaStr)}</span></td>
        </tr>
      </table>

      <!-- 3B. PAGAMENTOS -->
      <div class="sec-title">PAGAMENTOS</div>
      <table class="danfe-box">
        <colgroup><col style="width:72%" /><col style="width:28%" /></colgroup>
        <tr>
          <th class="tl" style="font-size:6.5pt;font-weight:400;padding:2px 5px;text-transform:uppercase;">Descrição</th>
          <th class="tr" style="font-size:6.5pt;font-weight:400;padding:2px 5px;text-transform:uppercase;">Valor</th>
        </tr>
        ${pagamentosRowsHtml}
      </table>

      <!-- 3C. CÁLCULO DO IMPOSTO (11 CAMPOS EM 2 LINHAS) -->
      <div class="sec-title">CÁLCULO DO IMPOSTO</div>
      <table class="danfe-box">
        <colgroup><col style="width:20%" /><col style="width:20%" /><col style="width:20%" /><col style="width:20%" /><col style="width:20%" /></colgroup>
        <tr>
          <td><span class="lbl">BASE DE CÁLCULO DO ICMS</span><span class="val-sm tr mono">${formatNumBR(input.totais.baseCalculoIcms)}</span></td>
          <td><span class="lbl">VALOR DO ICMS</span><span class="val-sm tr mono">${formatNumBR(input.totais.valorIcms)}</span></td>
          <td><span class="lbl">BASE DE CÁLCULO DO ICMS SUBST.</span><span class="val-sm tr mono">${formatNumBR(input.totais.baseCalculoIcmsSt)}</span></td>
          <td><span class="lbl">VALOR DO ICMS SUBST.</span><span class="val-sm tr mono">${formatNumBR(input.totais.valorIcmsSt)}</span></td>
          <td><span class="lbl">VALOR TOTAL DOS PRODUTOS</span><span class="val-sm tr mono">${formatNumBR(input.totais.valorTotalProdutos)}</span></td>
        </tr>
      </table>
      <table class="danfe-box no-top">
        <colgroup><col style="width:16%" /><col style="width:16%" /><col style="width:15%" /><col style="width:19%" /><col style="width:14%" /><col style="width:20%" /></colgroup>
        <tr>
          <td><span class="lbl">VALOR DO FRETE</span><span class="val-sm tr mono">${formatNumBR(input.totais.valorFrete)}</span></td>
          <td><span class="lbl">VALOR DO SEGURO</span><span class="val-sm tr mono">${formatNumBR(input.totais.valorSeguro)}</span></td>
          <td><span class="lbl">DESCONTO</span><span class="val-sm tr mono">${formatNumBR(input.totais.desconto)}</span></td>
          <td><span class="lbl">OUTRAS DESPESAS ACESSÓRIAS</span><span class="val-sm tr mono">${formatNumBR(input.totais.outrasDespesas)}</span></td>
          <td><span class="lbl">VALOR DO IPI</span><span class="val-sm tr mono">${formatNumBR(input.totais.valorIpi)}</span></td>
          <td><span class="lbl">VALOR TOTAL DA NOTA</span><span class="val tr mono">${formatNumBR(input.totais.valorTotalNota)}</span></td>
        </tr>
      </table>

      <!-- 3D. TRANSPORTADOR / VOLUMES TRANSPORTADOS (2 LINHAS) -->
      <div class="sec-title">TRANSPORTADOR / VOLUMES TRANSPORTADOS</div>
      <table class="danfe-box">
        <colgroup><col style="width:36%" /><col style="width:20%" /><col style="width:10%" /><col style="width:11%" /><col style="width:5%" /><col style="width:18%" /></colgroup>
        <tr>
          <td><span class="lbl">NOME / RAZÃO SOCIAL</span><span class="val-sm">${escapeHtml(input.transportador.nomeRazaoSocial || '')}</span></td>
          <td><span class="lbl">FRETE POR CONTA</span><span class="val-sm">${escapeHtml(input.transportador.fretePorConta || '9 - SEM FRETE')}</span></td>
          <td><span class="lbl">CÓDIGO ANTT</span><span class="val-sm mono">${escapeHtml(input.transportador.codigoAntt || '')}</span></td>
          <td><span class="lbl">PLACA DO VEÍCULO</span><span class="val-sm mono">${escapeHtml(input.transportador.placaVeiculo || '')}</span></td>
          <td><span class="lbl">UF</span><span class="val-sm tc">${escapeHtml(input.transportador.veiculoUf || '')}</span></td>
          <td><span class="lbl">CNPJ / CPF</span><span class="val-sm mono">${escapeHtml(input.transportador.cnpjCpf || '')}</span></td>
        </tr>
      </table>
      <table class="danfe-box no-top">
        <colgroup><col style="width:48%" /><col style="width:26%" /><col style="width:6%" /><col style="width:20%" /></colgroup>
        <tr>
          <td><span class="lbl">ENDEREÇO</span><span class="val-sm">${escapeHtml(input.transportador.endereco || '')}</span></td>
          <td><span class="lbl">MUNICÍPIO</span><span class="val-sm">${escapeHtml(input.transportador.municipio || '')}</span></td>
          <td><span class="lbl">UF</span><span class="val-sm tc">${escapeHtml(input.transportador.uf || '')}</span></td>
          <td><span class="lbl">INSCRIÇÃO ESTADUAL</span><span class="val-sm mono">${escapeHtml(input.transportador.ie || '')}</span></td>
        </tr>
      </table>
    </div>

    <!-- 4. GRADE EXPANSÍVEL: DADOS DOS PRODUTOS / SERVIÇOS (14 COLUNAS OFICIAIS) -->
    <div class="danfe-middle">
      <div class="sec-title">DADOS DOS PRODUTOS / SERVIÇOS</div>
      <div class="prod-stretch-wrap">
        <table class="prod-table">
          ${colgroupHtml}
          <thead>
            <tr>
              <th>CÓDIGO<br/>PRODUTO</th>
              <th style="text-align:left;padding-left:4px;">DESCRIÇÃO DO PRODUTO /<br/>SERVIÇO</th>
              <th>NCM/SH</th>
              <th>CSOSN /<br/>CST</th>
              <th>CFOP</th>
              <th>UNID</th>
              <th style="text-align:right;padding-right:3px;">QTDE.</th>
              <th style="text-align:right;padding-right:3px;">VALOR<br/>UNITÁRIO</th>
              <th style="text-align:right;padding-right:3px;">VALOR<br/>DESCONTO</th>
              <th style="text-align:right;padding-right:3px;">VALOR<br/>TOTAL</th>
              <th style="text-align:right;padding-right:3px;">BASE DE<br/>CÁLC. ICMS</th>
              <th style="text-align:right;padding-right:3px;">VALOR<br/>ICMS</th>
              <th style="text-align:right;padding-right:3px;">VALOR<br/>IPI</th>
              <th>ALÍQ. %<br/>ICMS / IPI</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRowsHtml}
          </tbody>
        </table>
        <div class="prod-col-guides">${colGuidesHtml}</div>
      </div>
    </div>

    <!-- 5. DADOS ADICIONAIS + RODAPÉ -->
    <div class="danfe-bottom">
      <div class="sec-title">DADOS ADICIONAIS</div>
      <table class="danfe-box">
        <colgroup><col style="width:65%" /><col style="width:35%" /></colgroup>
        <tr>
          <td class="da-cell">
            <span class="lbl">INFORMAÇÕES COMPLEMENTARES</span>
            <div style="font-size:8.5pt;font-weight:400;line-height:1.25;white-space:pre-line;word-break:break-word;">${escapeHtml(combinedInfoComplementares)}</div>
          </td>
          <td class="da-cell">
            <span class="lbl">RESERVADO AO FISCO</span>
          </td>
        </tr>
      </table>

      <div class="danfe-footer">
        <span>DATA E HORA DA IMPRESSÃO: ${escapeHtml(printedAtBR)}</span>
        <span>Sistema AgroControl</span>
      </div>
    </div>
  </div>

  ${
    autoPrint
      ? `<script>
          (function () {
            var didPrint = false;
            function triggerPrint() {
              if (didPrint) return;
              didPrint = true;
              setTimeout(function () {
                try {
                  window.focus();
                  window.print();
                } catch (e) {}
              }, 250);
            }
            window.onload = triggerPrint;
            if (document.readyState === 'complete') {
              triggerPrint();
            }
          })();
        </script>`
      : ''
  }
</body>
</html>`;
}
