import QRCode from 'qrcode';
import { CompanyProfile, NotaSaidaRecord } from '../../types';
import { formatDateBR, getStoredCompanyProfile } from '../../lib/storage';
import { formatCpfCnpj, cleanDigits } from '../../lib/formatters';
import {
  COMPANY_LOGO_REF,
  getCachedMediaUrl,
  isIndexedDbRef,
  resolveMediaUrlAsync,
} from '../../lib/imageStorage';
import {
  buildDefaultInformacoesComplementares,
  getStoredCfopCatalog,
  DEFAULT_CFOP_CATALOG,
} from '../../lib/cfopCatalog';

const escapeHtml = (value?: string | number | null): string => {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const formatBRLNumber = (value?: number | null): string => {
  const num = Number(value) || 0;
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// =========================================================================
// CODE 128C VECTOR SVG GENERATOR (PADRÃO OFICIAL SEFAZ - 44 DÍGITOS)
// =========================================================================
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

function generateCode128CSvg(digits44: string): string {
  const clean = cleanDigits(digits44).padStart(44, '0').slice(0, 44);
  const symbols: number[] = [105]; // Start Code C
  let checksum = 105;

  for (let i = 0; i < 44; i += 2) {
    const pairVal = parseInt(clean.slice(i, i + 2), 10);
    const pos = i / 2 + 1;
    symbols.push(pairVal);
    checksum += pairVal * pos;
  }

  const checkSymbol = checksum % 103;
  symbols.push(checkSymbol);
  symbols.push(106); // Stop

  const quietZone = 8;
  let x = quietZone;
  const height = 42;
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
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${height}" width="100%" height="36" preserveAspectRatio="none" style="display:block;">${rects.join('')}</svg>`;
}

function generateQrCodeSvg(text: string, sizePx = 64): string {
  try {
    const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
    const count = qr.modules.size;
    const margin = 2;
    const total = count + margin * 2;
    const rects: string[] = [];
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.modules.get(r, c)) {
          rects.push(`<rect x="${c + margin}" y="${r + margin}" width="1" height="1" fill="#000000" />`);
        }
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${sizePx}" height="${sizePx}" shape-rendering="crispEdges" style="display:block;background:#ffffff;">${rects.join('')}</svg>`;
  } catch {
    return '';
  }
}

function extractCepFromText(text?: string): string {
  if (!text) return '';
  const m = String(text).match(/\b(\d{5})-?(\d{3})\b/);
  return m ? `${m[1]}-${m[2]}` : '';
}

const UF_IBGE_CODES: Record<string, string> = {
  RO: '11', AC: '12', AM: '13', RR: '14', PA: '15', AP: '16', TO: '17',
  MA: '21', PI: '22', CE: '23', RN: '24', PB: '25', PE: '26', AL: '27',
  SE: '28', BA: '29', MG: '31', ES: '32', RJ: '33', SP: '35', PR: '41',
  SC: '42', RS: '43', MS: '50', MT: '51', GO: '52', DF: '53',
};

function computeSefazMod11(digits43: string): string {
  let sum = 0;
  let weight = 2;
  for (let i = digits43.length - 1; i >= 0; i--) {
    sum += Number(digits43[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const mod = sum % 11;
  return String(mod < 2 ? 0 : 11 - mod);
}

function resolveChaveAcesso44(
  nota: NotaSaidaRecord,
  companyProfile?: CompanyProfile
): { chave44: string; isInternalGenerated: boolean } {
  const existing = cleanDigits(nota.chaveAcesso);
  if (existing.length === 44) {
    return { chave44: existing, isInternalGenerated: false };
  }

  const uf = (companyProfile?.state || 'PR').trim().toUpperCase();
  const cUF = UF_IBGE_CODES[uf] || '41';
  const em = (nota.dataEmissao || '').split('-');
  const aamm =
    em.length >= 2 && em[0].length === 4
      ? `${em[0].slice(2, 4)}${em[1].padStart(2, '0')}`
      : `${new Date().getFullYear().toString().slice(2)}${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const cnpj = cleanDigits(companyProfile?.cnpj || companyProfile?.cnpjCpf || '').padStart(14, '0').slice(0, 14);
  const docLower = (nota.tipoDocumento || '').toLowerCase();
  const modelo = docLower.includes('ct-e') || docLower.includes('cte')
    ? '57'
    : docLower.includes('mdf-e') || docLower.includes('mdfe')
      ? '58'
      : docLower.includes('nfc-e') || docLower.includes('nfce')
        ? '65'
        : '55';
  const serie = cleanDigits(nota.serie || '1').padStart(3, '0').slice(-3);
  const numero = cleanDigits(nota.numero || '1').padStart(9, '0').slice(-9);
  const tpEmis = '1';
  const seedRaw = cleanDigits(`${nota.numero || '1'}${nota.id || '00000001'}`);
  const cNF = (seedRaw || '10203040').padStart(8, '1').slice(-8);

  const base43 = `${cUF}${aamm}${cnpj}${modelo}${serie}${numero}${tpEmis}${cNF}`;
  const dv = computeSefazMod11(base43);
  return { chave44: `${base43}${dv}`, isInternalGenerated: true };
}

function formatChaveAcessoGroups(chave44: string): string {
  const clean = cleanDigits(chave44).padStart(44, '0').slice(0, 44);
  return clean.replace(/(\d{4})(?=\d)/g, '$1 ');
}

function splitCityUf(cidadeUf?: string): { cidade: string; uf: string } {
  const raw = (cidadeUf || '').trim();
  if (!raw) return { cidade: '', uf: '' };
  const slashMatch = raw.match(/^(.*?)[\/\-]\s*([A-Za-z]{2})$/);
  if (slashMatch) {
    return {
      cidade: slashMatch[1].trim().toUpperCase(),
      uf: slashMatch[2].trim().toUpperCase(),
    };
  }
  return { cidade: raw.toUpperCase(), uf: '' };
}

interface SefazDocMeta {
  sigla: string;
  tituloCentro: string;
  subtituloCentro: string;
  portalConsulta: string;
}

function getSefazDocMeta(tipoDocumento: string): SefazDocMeta {
  const t = (tipoDocumento || '').toLowerCase();
  if (t.includes('ct-e') || t.includes('cte')) {
    return {
      sigla: 'CT-e',
      tituloCentro: 'DACTE',
      subtituloCentro: 'Documento Auxiliar do Conhecimento de Transporte Eletrônico',
      portalConsulta: 'Consulta de autenticidade no portal nacional do CT-e www.cte.fazenda.gov.br/portal ou no site da SEFAZ Autorizadora',
    };
  }
  if (t.includes('mdf-e') || t.includes('mdfe')) {
    return {
      sigla: 'MDF-e',
      tituloCentro: 'DAMDFE',
      subtituloCentro: 'Documento Auxiliar do Manifesto Eletrônico de Documentos Fiscais',
      portalConsulta: 'Consulta de autenticidade no portal nacional do MDF-e mdfe-portal.sefaz.rs.gov.br ou no site da SEFAZ Autorizadora',
    };
  }
  if (t.includes('nfs-e') || t.includes('nfse')) {
    return {
      sigla: 'NFS-e',
      tituloCentro: 'NFS-e',
      subtituloCentro: 'Documento Auxiliar da Nota Fiscal de Serviços Eletrônica',
      portalConsulta: 'Documento auxiliar de prestação de serviços — consulte a autenticidade no portal municipal da prefeitura emissora',
    };
  }
  if (t.includes('nfc-e') || t.includes('nfce')) {
    return {
      sigla: 'NFC-e',
      tituloCentro: 'DANFCE',
      subtituloCentro: 'Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica',
      portalConsulta: 'Consulta pela Chave de Acesso no portal da SEFAZ Estadual autorizadora',
    };
  }
  return {
    sigla: 'NF-e',
    tituloCentro: 'DANFE',
    subtituloCentro: 'Documento Auxiliar da Nota Fiscal Eletrônica',
    portalConsulta: 'Consulta de autenticidade no portal nacional da NF-e www.nfe.fazenda.gov.br/portal ou no site da SEFAZ Autorizadora',
  };
}

const OFFICIAL_HOMOLOGACAO_NOTICE = 'EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL';

function resolveIsHomologacaoAmbiente(companyProfile?: CompanyProfile): boolean {
  const stored = getStoredCompanyProfile();
  const ambiente = companyProfile?.ambienteSefaz ?? stored?.ambienteSefaz ?? 'homologacao';
  return ambiente !== 'producao';
}

function buildExpandableTableBox(
  colWidths: string[],
  headerRowHtml: string,
  bodyRowsHtml: string,
  isHomologacao = false
): string {
  const colgroup = `<colgroup>${colWidths.map((w) => `<col style="width:${w};" />`).join('')}</colgroup>`;
  const guides = colWidths
    .map((w, idx) => `<div style="flex:0 0 ${w};width:${w};box-sizing:border-box;${idx > 0 ? 'border-left:1px solid #000000;' : ''}"></div>`)
    .join('');

  return `
    <div class="sefaz-table-stretch-wrap">
      ${isHomologacao ? `<div class="homologacao-watermark" aria-hidden="true">${OFFICIAL_HOMOLOGACAO_NOTICE}</div>` : ''}
      <table class="sefaz-table">
        ${colgroup}
        <thead>${headerRowHtml}</thead>
        <tbody>${bodyRowsHtml}</tbody>
      </table>
      <div class="sefaz-col-guides">${guides}</div>
    </div>
  `;
}

function buildDacteHtml(
  nota: NotaSaidaRecord,
  companyProfile?: CompanyProfile,
  logoUrl?: string
): string {
  const tradeName =
    companyProfile?.tradeName ||
    companyProfile?.name ||
    companyProfile?.corporateName ||
    companyProfile?.companyName ||
    'AGROCONTROL';
  const corporateName =
    companyProfile?.corporateName || companyProfile?.companyName || tradeName;

  const companyCnpj = formatCpfCnpj(companyProfile?.cnpj || companyProfile?.cnpjCpf || '') || 'NÃO INFORMADO';
  const companyIe = companyProfile?.stateRegistration || 'ISENTO';
  const companyPhone = companyProfile?.phone || '-';
  const companyStreet = [
    companyProfile?.address,
    companyProfile?.number ? `Nº ${companyProfile.number}` : '',
  ]
    .filter(Boolean)
    .join(', ');
  const companyNeighborhood = companyProfile?.neighborhood || '';
  const companyCep = companyProfile?.zipCode || companyProfile?.cep || '-';
  const companyCityUf = companyProfile?.city
    ? `${companyProfile.city}${companyProfile?.state ? ` - ${companyProfile.state}` : ''}`
    : '-';
  const companyRntrc = (companyProfile?.rntrc || '').trim() || 'ISENTO / PRÓPRIO';

  const numeroFormatado = String(nota.numero || '000001').padStart(6, '0');
  const serieFormatada = String(nota.serie || '1');
  const { chave44, isInternalGenerated } = resolveChaveAcesso44(nota, companyProfile);
  const chaveFormatada = formatChaveAcessoGroups(chave44);
  const barcodeSvg = generateCode128CSvg(chave44);
  const isHomologacao = resolveIsHomologacaoAmbiente(companyProfile);
  const tpAmb = isHomologacao ? '2' : '1';
  const qrUrl = `https://dfe-portal.svrs.rs.gov.br/cte/qrCode?chCTe=${chave44}&tpAmb=${tpAmb}`;
  const qrCodeSvg = generateQrCodeSvg(qrUrl, 68);

  const createdDate = new Date(nota.createdAt || Date.now());
  const horaEmissao = createdDate.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const dataHoraEmissao = `${formatDateBR(nota.dataEmissao)} ${horaEmissao}`;

  const emissionYearShort = (nota.dataEmissao || '').slice(2, 4) || new Date().getFullYear().toString().slice(-2);
  const simulatedProtocol = `141${emissionYearShort}${cleanDigits(nota.numero || '1').padStart(9, '0')}`;
  const protocoloUso = nota.protocoloAutorizacao
    ? `${nota.protocoloAutorizacao}${isHomologacao ? ' (HOMOLOGAÇÃO)' : ''}`
    : !isInternalGenerated && nota.chaveAcesso
      ? `${simulatedProtocol} - ${dataHoraEmissao}${isHomologacao ? ' (HOMOLOGAÇÃO)' : ''}`
      : `${simulatedProtocol} - ${dataHoraEmissao} (CONTROLE INTERNO)`;

  const cfopPrincipal = (nota.cteCfop || '5352').trim();
  const catalog = getStoredCfopCatalog();
  const cfopEntry =
    catalog.find((c) => c.codigo === cfopPrincipal) ||
    DEFAULT_CFOP_CATALOG.find((c) => c.codigo === cfopPrincipal);
  const naturezaCfopTexto = cfopEntry
    ? `${cfopPrincipal} - ${cfopEntry.descricao.toUpperCase()}`
    : `${cfopPrincipal} - PRESTAÇÃO DE SERVIÇO DE TRANSPORTE`;

  // Documentos originários (NF-e vinculadas)
  const cteNfes =
    Array.isArray(nota.cteNfesVinculadas) && nota.cteNfesVinculadas.length > 0
      ? nota.cteNfesVinculadas
      : nota.cteNfeTransportada
        ? nota.cteNfeTransportada
            .split(',')
            .map((raw, idx) => ({
              id: `legacy_${idx}`,
              numero: raw.trim(),
              serie: '1',
              chaveAcesso: cleanDigits(raw).length === 44 ? cleanDigits(raw) : '',
              valorNota: idx === 0 ? nota.cteValorCarga || 0 : 0,
            }))
        : [];
  const somaNfesCte = cteNfes.reduce((acc, nf) => acc + (Number(nf.valorNota) || 0), 0);
  const valorCargaExibicao = nota.cteValorCarga && nota.cteValorCarga > 0 ? nota.cteValorCarga : somaNfesCte;

  // Remetente
  const isRemPropria = Boolean(nota.cteRemetenteIsEmpresaPropria);
  const remNome = nota.cteRemetenteNome || (isRemPropria ? corporateName : '') || nota.destinatarioNome || '-';
  const remCpfCnpj = nota.cteRemetenteCpfCnpj || (isRemPropria ? companyCnpj : '') || '-';
  const remIe = nota.cteRemetenteIe || (isRemPropria ? companyIe : '') || 'ISENTO';
  const remEndereco =
    nota.cteRemetenteEndereco ||
    (isRemPropria ? companyStreet : '') ||
    '-';
  const remBairro = isRemPropria ? companyNeighborhood || '-' : '-';
  const remCep = isRemPropria ? companyCep : extractCepFromText(remEndereco) || '-';
  const remFone = isRemPropria ? companyPhone : '-';
  const remCidadeUfRaw = nota.cteRemetenteCidadeUf || (isRemPropria ? companyCityUf : '') || '-';
  const { cidade: remCidade, uf: remUf } = splitCityUf(remCidadeUfRaw);

  // Destinatário
  const destNome = nota.destinatarioNome || '-';
  const destCpfCnpj = nota.destinatarioCpfCnpj || '-';
  const destIe = nota.destinatarioIe || 'ISENTO';
  const destEndereco = nota.destinatarioEndereco || '-';
  const destBairro = '-';
  const destCep = extractCepFromText(destEndereco) || '-';
  const destFone = '-';
  const { cidade: destCidade, uf: destUf } = splitCityUf(nota.destinatarioCidadeUf);

  // Início e Término da Prestação
  const inicioPrestacao = nota.cteMunicipioInicio || (remCidadeUfRaw !== '-' ? remCidadeUfRaw : companyCityUf) || '-';
  const terminoPrestacao = nota.cteMunicipioTermino || nota.destinatarioCidadeUf || '-';

  // Tomador do Serviço
  const tomadorTipoRaw = (nota.cteTomador || 'Remetente').toLowerCase();
  const isTomadorOutros = tomadorTipoRaw.includes('outro') || tomadorTipoRaw.includes('terceiro');
  const isTomadorDest = tomadorTipoRaw.includes('destinat');
  const tomadorTipoLabel = isTomadorOutros
    ? 'OUTROS / TERCEIRO'
    : isTomadorDest
      ? 'DESTINATÁRIO'
      : 'REMETENTE';

  const tomNome =
    nota.cteTomadorFinalNome ||
    (isTomadorOutros
      ? nota.cteTomadorTerceiroNome || '-'
      : isTomadorDest
        ? destNome
        : remNome);
  const tomCpfCnpj =
    nota.cteTomadorFinalCpfCnpj ||
    (isTomadorOutros
      ? nota.cteTomadorTerceiroCpfCnpj || '-'
      : isTomadorDest
        ? destCpfCnpj
        : remCpfCnpj);
  const tomIe =
    nota.cteTomadorFinalIe ||
    (isTomadorOutros
      ? nota.cteTomadorTerceiroIe || 'ISENTO'
      : isTomadorDest
        ? destIe
        : remIe);
  const tomEndereco =
    nota.cteTomadorFinalEndereco ||
    (isTomadorOutros
      ? nota.cteTomadorTerceiroEndereco || '-'
      : isTomadorDest
        ? destEndereco
        : remEndereco);
  const tomCidadeUf =
    nota.cteTomadorFinalCidadeUf ||
    (isTomadorOutros
      ? nota.cteTomadorTerceiroCidadeUf || '-'
      : isTomadorDest
        ? nota.destinatarioCidadeUf || '-'
        : remCidadeUfRaw);
  const { cidade: tomCidade, uf: tomUf } = splitCityUf(tomCidadeUf);
  const tomCep =
    !isTomadorOutros && !isTomadorDest && isRemPropria
      ? companyCep
      : extractCepFromText(tomEndereco) || '-';
  const tomFone = !isTomadorOutros && !isTomadorDest && isRemPropria ? companyPhone : '-';

  // Impostos (Simples Nacional ou Regime Normal)
  const isSimples = (companyProfile?.regimeTributario || 'Simples Nacional').toLowerCase().includes('simples');
  const classTrib = isSimples
    ? 'SN - OPTANTE PELO SIMPLES NACIONAL (CSOSN 102 / ICMS ISENTO OU NÃO TRIBUTADO)'
    : '00 - TRIBUTAÇÃO NORMAL DO ICMS';
  const itemsList = Array.isArray(nota.itens) ? nota.itens : [];
  const totalBaseIcms = itemsList.reduce((acc, it) => acc + (Number(it.baseIcms) || 0), 0);
  const totalValorIcms = itemsList.reduce((acc, it) => acc + (Number(it.valorIcms) || 0), 0);

  // Documentos originários distribuídos em 2 colunas oficiais (esquerda + direita)
  const docPairs: Array<{ left?: (typeof cteNfes)[number]; right?: (typeof cteNfes)[number] }> = [];
  if (cteNfes.length === 0) {
    docPairs.push({ left: undefined, right: undefined });
  } else {
    const half = Math.ceil(cteNfes.length / 2);
    for (let i = 0; i < half; i++) {
      docPairs.push({
        left: cteNfes[i],
        right: cteNfes[i + half],
      });
    }
  }

  const renderDocCols = (nf?: (typeof cteNfes)[number], isEmptyNotice?: boolean) => {
    if (!nf) {
      return isEmptyNotice
        ? `<td class="tc mono">-</td><td class="tc mono">-</td><td class="tc" style="font-size:6.5pt;">NENHUM DOCUMENTO ORIGINÁRIO INFORMADO</td>`
        : `<td class="tc mono">&nbsp;</td><td class="tc mono">&nbsp;</td><td>&nbsp;</td>`;
    }
    const chaveText = nf.chaveAcesso ? formatChaveAcessoGroups(nf.chaveAcesso) : 'CHAVE NÃO INFORMADA';
    return `
      <td class="tc mono">NF-e</td>
      <td class="tc mono bold">${escapeHtml(nf.numero || '-')}</td>
      <td class="mono" style="font-size:6.6pt;letter-spacing:0.1px;">${escapeHtml(chaveText)}</td>
    `;
  };

  const docOriginariosRows = docPairs
    .map(
      (pair, idx) => `
      <tr class="sefaz-data-row">
        ${renderDocCols(pair.left, idx === 0 && cteNfes.length === 0)}
        ${renderDocCols(pair.right, false)}
      </tr>
    `
    )
    .join('');

  // Observações completas (obs fiscais + notas referenciadas + motorista/veículo/RNTRC)
  const obsLines: string[] = [];
  const baseObs = (nota.informacoesComplementares || nota.observacoes || nota.descricao || '').trim();
  if (baseObs) obsLines.push(baseObs);
  if (cteNfes.length > 0) {
    const notasResumo = cteNfes
      .map((n) => `NF-e ${n.numero || '-'}${n.chaveAcesso ? ` (Chave: ${n.chaveAcesso})` : ''}`)
      .join('; ');
    if (!baseObs.includes(cteNfes[0]?.numero || '___')) {
      obsLines.push(`DOCUMENTOS REFERENCIADOS: ${notasResumo}.`);
    }
  }
  const rodoviarioObs = [
    `MOTORISTA: ${nota.motoristaNome || '-'}`,
    `CPF: ${nota.motoristaCpf ? formatCpfCnpj(nota.motoristaCpf) : '-'}`,
    `PLACA TRAÇÃO: ${nota.veiculoPlaca || '-'}`,
    `REBOQUE: ${nota.mdfeReboquePlaca || '-'}`,
    `RNTRC: ${companyRntrc}`,
  ].join(' | ');
  obsLines.push(rodoviarioObs);

  const usoExclusivoEmissorText = [
    'Documento emitido por ME ou EPP optante pelo Simples Nacional. Não gera direito a crédito fiscal de IPI/ICMS.',
    'Lei da Transparência Fiscal (Lei nº 12.741/2012): Valor aproximado dos tributos incidentes conforme tabela IBPT vigente.',
    `Forma/Condição de Pagamento: ${nota.condicaoPagamento || '-'} • Vencimento: ${formatDateBR(nota.dataVencimento || nota.dataEmissao)}.`,
  ].join('\n');

  const dacteColWidths = ['7%', '9%', '34%', '7%', '9%', '34%'];
  const dacteGuides = dacteColWidths
    .map((w, idx) => `<div style="flex:0 0 ${w};width:${w};box-sizing:border-box;${idx === 3 ? 'border-left:1.5px solid #000000;' : idx > 0 ? 'border-left:1px solid #000000;' : ''}"></div>`)
    .join('');

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>DACTE (CT-e) Nº ${escapeHtml(numeroFormatado)} - ${escapeHtml(corporateName)}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 0mm;
          }
          @media print {
            html, body {
              width: 100%;
              min-height: 297mm;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .sefaz-sheet {
              width: 210mm;
              min-height: 297mm;
              height: 297mm;
              margin: 0 auto !important;
              padding: 8mm !important;
              box-sizing: border-box;
              overflow: hidden;
              box-shadow: none !important;
            }
            .no-print { display: none !important; }
          }
          * { box-sizing: border-box; }
          html, body { width: 100%; margin: 0; padding: 0; }
          body {
            font-family: Arial, Helvetica, sans-serif;
            color: #000000;
            background: #e5e7eb;
            padding: 6mm 0 10mm 0;
            text-transform: uppercase;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .sefaz-sheet {
            width: 210mm;
            min-height: 297mm;
            height: 297mm;
            margin: 0 auto;
            padding: 8mm;
            box-sizing: border-box;
            background: #ffffff;
            box-shadow: 0 4px 18px rgba(0, 0, 0, 0.16);
            display: flex;
            flex-direction: column;
          }
          .sefaz-top-fixed { width: 100%; flex-shrink: 0; }
          .sefaz-middle-expand {
            width: 100%;
            flex: 1;
            display: flex;
            flex-direction: column;
            min-height: 0;
          }
          .sefaz-table-stretch-wrap {
            position: relative;
            overflow: hidden;
            width: 100%;
            flex: 1;
            display: flex;
            flex-direction: column;
            min-height: 0;
            border: 1px solid #000000;
          }
          .homologacao-banner {
            width: 100%;
            margin-top: -1px;
            padding: 2.5px 6px;
            border: 1px solid #000000;
            background: #fef2f2;
            color: #991b1b;
            text-align: center;
            font-size: 7.4pt;
            font-weight: 900;
            letter-spacing: 0.6px;
            line-height: 1.15;
          }
          .homologacao-watermark {
            position: absolute;
            top: 52%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-16deg);
            width: 120%;
            text-align: center;
            font-size: 13pt;
            font-weight: 900;
            letter-spacing: 0.8px;
            color: rgba(185, 28, 28, 0.16);
            pointer-events: none;
            user-select: none;
            z-index: 2;
            white-space: nowrap;
          }
          .homologacao-info-line {
            font-size: 6.6pt;
            font-weight: 900;
            color: #991b1b;
            letter-spacing: 0.3px;
            margin-bottom: 2px;
          }
          .sefaz-col-guides {
            flex: 1;
            display: flex;
            align-items: stretch;
            width: 100%;
            min-height: 4mm;
          }
          .sefaz-bottom-fixed {
            width: 100%;
            margin-top: auto;
            flex-shrink: 0;
          }
          table.sefaz-box-table {
            table-layout: fixed;
            width: 100%;
            border-collapse: collapse;
          }
          table.sefaz-box-table.no-top { margin-top: -1px; }
          table.sefaz-box-table td,
          table.sefaz-box-table th {
            border: 1px solid #000000;
            padding: 2px 4px;
            vertical-align: top;
            overflow: hidden;
          }
          .split-mid-right { border-right: 1.5px solid #000000 !important; }
          .highlight-cell { background: #f3f4f6; }
          .cut-line { border-bottom: 1px dashed #000000; margin: 2mm 0; }
          .sec-title {
            font-size: 6.2pt;
            font-weight: 900;
            letter-spacing: 0.25px;
            margin: 3px 0 1px 0;
            line-height: 1.1;
          }
          .lbl {
            display: block;
            font-size: 5.5pt;
            font-weight: 700;
            line-height: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            margin-bottom: 1.5px;
            color: #000000;
          }
          .val {
            display: block;
            font-size: 7.4pt;
            font-weight: 700;
            line-height: 1.15;
            color: #000000;
            word-break: break-word;
          }
          .val-sm {
            display: block;
            font-size: 6.8pt;
            font-weight: 700;
            line-height: 1.15;
            color: #000000;
            word-break: break-word;
          }
          .bold-lg { font-size: 8.8pt; font-weight: 900; }
          .mono { font-family: "Courier New", Courier, monospace; }
          .bold { font-weight: 700; }
          .tc { text-align: center; }
          .tr { text-align: right; }
          .hdr-logo {
            max-width: 52px;
            max-height: 48px;
            object-fit: contain;
            border: 1px solid #000000;
            padding: 2px;
            background: #ffffff;
            flex-shrink: 0;
          }
          table.sefaz-table {
            position: relative;
            z-index: 1;
            table-layout: fixed;
            width: 100%;
            border-collapse: collapse;
            border: none;
          }
          table.sefaz-table th {
            border-bottom: 1px solid #000000;
            border-left: 1px solid #000000;
            padding: 2px 3px;
            font-size: 5.8pt;
            font-weight: 900;
            line-height: 1.1;
            background: #f9fafb;
            text-align: center;
          }
          table.sefaz-table th:first-child,
          table.sefaz-table td:first-child { border-left: none; }
          table.sefaz-table th:nth-child(4),
          table.sefaz-table td:nth-child(4) { border-left: 1.5px solid #000000; }
          table.sefaz-table tr.sefaz-data-row td {
            border-left: 1px solid #000000;
            border-bottom: 1px solid #d1d5db;
            padding: 2px 3px;
            font-size: 6.8pt;
            line-height: 1.15;
            vertical-align: middle;
            word-break: break-word;
          }
          table.sefaz-table tr.sefaz-data-row td:first-child { border-left: none; }
          table.sefaz-table tr.sefaz-data-row td:nth-child(4) { border-left: 1.5px solid #000000; }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom:8px;display:flex;justify-content:flex-end;gap:8px;width:210mm;margin-left:auto;margin-right:auto;">
          <button onclick="window.focus();window.print()" style="padding:6px 14px;background:#111827;color:#fff;border:1px solid #000;border-radius:4px;font-weight:800;cursor:pointer;font-size:11px;">IMPRIMIR / SALVAR PDF</button>
          <button onclick="window.close()" style="padding:6px 14px;background:#f3f4f6;color:#000;border:1px solid #000;border-radius:4px;font-weight:800;cursor:pointer;font-size:11px;">FECHAR</button>
        </div>

        <div class="sefaz-sheet">
          <div class="sefaz-top-fixed">
            <!-- 1. CANHOTO SUPERIOR OFICIAL DO CT-e -->
            <table class="sefaz-box-table">
              <colgroup>
                <col style="width:22%" />
                <col style="width:16%" />
                <col style="width:26%" />
                <col style="width:20%" />
                <col style="width:16%" />
              </colgroup>
              <tr>
                <td colspan="4" style="padding:2.5px 5px;font-size:6pt;font-weight:700;line-height:1.2;">
                  DECLARO QUE RECEBI OS VOLUMES DESTE CONHECIMENTO EM PERFEITO ESTADO PELO QUE DOU POR CUMPRIDO O PRESENTE CONTRATO DE TRANSPORTE
                </td>
                <td rowspan="3" style="text-align:center;vertical-align:middle;padding:3px;">
                  <div style="font-size:9pt;font-weight:900;line-height:1.1;">CT-e</div>
                  <div style="font-size:7.5pt;font-weight:900;line-height:1.2;margin-top:2px;">Nº DOCUMENTO</div>
                  <div style="font-size:8.5pt;font-weight:900;font-family:'Courier New',monospace;line-height:1.15;">${escapeHtml(numeroFormatado)}</div>
                  <div style="font-size:7pt;font-weight:800;line-height:1.15;margin-top:1px;">SÉRIE ${escapeHtml(serieFormatada)}</div>
                </td>
              </tr>
              <tr>
                <td style="height:18px;"><span class="lbl">NOME</span><span class="val">&nbsp;</span></td>
                <td style="height:18px;"><span class="lbl">RG</span><span class="val">&nbsp;</span></td>
                <td rowspan="2" style="vertical-align:top;"><span class="lbl">ASSINATURA / CARIMBO</span><span class="val">&nbsp;</span></td>
                <td style="height:18px;"><span class="lbl">INÍCIO DA PRESTAÇÃO - DATA/HORA</span><span class="val">&nbsp;</span></td>
              </tr>
              <tr>
                <td colspan="2" style="height:16px;"><span class="lbl">EMITENTE</span><span class="val-sm">${escapeHtml(corporateName)}</span></td>
                <td style="height:16px;"><span class="lbl">TÉRMINO DA PRESTAÇÃO - DATA/HORA</span><span class="val">&nbsp;</span></td>
              </tr>
            </table>

            <div class="cut-line"></div>

            <!-- 2. CABEÇALHO OFICIAL DACTE (3 COLUNAS SEM CAIXINHA 0/1) -->
            <table class="sefaz-box-table">
              <colgroup>
                <col style="width:36%" />
                <col style="width:27%" />
                <col style="width:37%" />
              </colgroup>
              <tr>
                <!-- ESQUERDA: EMITENTE -->
                <td rowspan="4" style="padding:4px 5px;vertical-align:top;">
                  <div style="display:flex;align-items:flex-start;gap:6px;">
                    ${logoUrl ? `<img class="hdr-logo" src="${escapeHtml(logoUrl)}" alt="Logo Emitente" />` : ''}
                    <div style="flex:1;min-width:0;">
                      <span class="lbl">IDENTIFICAÇÃO DO EMITENTE</span>
                      <div style="font-size:8.2pt;font-weight:900;line-height:1.15;word-break:break-word;">${escapeHtml(corporateName)}</div>
                      ${corporateName.trim().toUpperCase() !== tradeName.trim().toUpperCase() ? `<div style="font-size:6.5pt;font-weight:700;line-height:1.1;">${escapeHtml(tradeName)}</div>` : ''}
                    </div>
                  </div>
                  <div style="font-size:6.6pt;line-height:1.25;margin-top:3px;word-break:break-word;">
                    <strong>ENDEREÇO:</strong> ${escapeHtml(companyStreet || '-')}${companyNeighborhood ? ` - ${escapeHtml(companyNeighborhood)}` : ''}<br/>
                    <strong>MUNICÍPIO/UF:</strong> ${escapeHtml(companyCityUf)} &nbsp; <strong>CEP:</strong> ${escapeHtml(companyCep)}<br/>
                    <strong>CNPJ:</strong> <span class="mono">${escapeHtml(companyCnpj)}</span> &nbsp; <strong>IE:</strong> <span class="mono">${escapeHtml(companyIe)}</span><br/>
                    <strong>FONE:</strong> <span class="mono">${escapeHtml(companyPhone)}</span>
                  </div>
                </td>

                <!-- CENTRO: DACTE / MODAL RODOVIÁRIO / MODELO 57 -->
                <td rowspan="4" style="padding:0;vertical-align:top;">
                  <div style="padding:3px 4px;text-align:center;border-bottom:1px solid #000000;">
                    <div style="font-size:12pt;font-weight:900;line-height:1.05;letter-spacing:0.6px;">DACTE</div>
                    <div style="font-size:5.6pt;font-weight:700;line-height:1.15;margin-top:1px;">DOCUMENTO AUXILIAR DO CONHECIMENTO DE TRANSPORTE ELETRÔNICO</div>
                  </div>
                  <div style="display:flex;border-bottom:1px solid #000000;">
                    <div style="flex:1;padding:2px 4px;text-align:center;font-size:7pt;font-weight:900;border-right:1px solid #000000;">MODAL RODOVIÁRIO</div>
                    <div style="width:42px;padding:2px 4px;text-align:center;font-size:6.5pt;font-weight:800;">FL 1/1</div>
                  </div>
                  <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
                    <colgroup><col style="width:18%" /><col style="width:16%" /><col style="width:28%" /><col style="width:38%" /></colgroup>
                    <tr>
                      <td style="border:none;border-bottom:1px solid #000000;border-right:1px solid #000000;padding:1.5px 2px;text-align:center;">
                        <span class="lbl">MODELO</span><span class="val-sm mono">57</span>
                      </td>
                      <td style="border:none;border-bottom:1px solid #000000;border-right:1px solid #000000;padding:1.5px 2px;text-align:center;">
                        <span class="lbl">SÉRIE</span><span class="val-sm mono">${escapeHtml(serieFormatada)}</span>
                      </td>
                      <td style="border:none;border-bottom:1px solid #000000;border-right:1px solid #000000;padding:1.5px 2px;text-align:center;">
                        <span class="lbl">NÚMERO</span><span class="val-sm mono">${escapeHtml(numeroFormatado)}</span>
                      </td>
                      <td style="border:none;border-bottom:1px solid #000000;padding:1.5px 2px;text-align:center;">
                        <span class="lbl">DATA E HORA EMISSÃO</span><span style="display:block;font-size:6pt;font-weight:700;line-height:1.1;" class="mono">${escapeHtml(dataHoraEmissao)}</span>
                      </td>
                    </tr>
                  </table>
                  <div style="padding:2.5px 4px;font-size:6pt;line-height:1.3;font-weight:700;">
                    <div>TIPO DO CT-E: <span class="bold">NORMAL</span></div>
                    <div>TIPO DO SERVIÇO: <span class="bold">${escapeHtml(nota.cteTipoServico || 'NORMAL')}</span></div>
                    <div>IND. CT-E GLOBALIZADO: <span class="bold">NÃO</span></div>
                  </div>
                </td>

                <!-- DIREITA: BARCODE + QR CODE + CHAVE + PROTOCOLO -->
                <td style="padding:3px 5px;">
                  <div style="display:flex;align-items:center;gap:6px;">
                    <div style="flex:1;min-width:0;">
                      <span class="lbl">CONTROLE DO FISCO — CÓDIGO DE BARRAS</span>
                      ${barcodeSvg}
                    </div>
                    ${qrCodeSvg ? `<div style="flex-shrink:0;border:1px solid #000000;padding:1px;background:#ffffff;">${qrCodeSvg}</div>` : ''}
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:2px 5px;">
                  <span class="lbl">CHAVE DE ACESSO</span>
                  <span class="val-sm mono tc" style="font-size:6.9pt;letter-spacing:0.1px;">${escapeHtml(chaveFormatada)}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:2px 5px;">
                  <span class="lbl">PROTOCOLO DE AUTORIZAÇÃO DE USO</span>
                  <span class="val-sm mono" style="font-size:6.8pt;">${escapeHtml(protocoloUso)}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:2px 5px;font-size:5.4pt;line-height:1.15;text-align:center;vertical-align:middle;">
                  CONSULTA DE AUTENTICIDADE NO PORTAL NACIONAL DO CT-E WWW.CTE.FAZENDA.GOV.BR/PORTAL OU NO SITE DA SEFAZ AUTORIZADORA
                </td>
              </tr>
            </table>

            ${isHomologacao ? `<div class="homologacao-banner">${OFFICIAL_HOMOLOGACAO_NOTICE}</div>` : ''}

            <!-- 3. FAIXA CFOP - NATUREZA DA OPERAÇÃO + INÍCIO E TÉRMINO DA PRESTAÇÃO -->
            <table class="sefaz-box-table no-top">
              <colgroup><col style="width:100%" /></colgroup>
              <tr>
                <td>
                  <span class="lbl">CFOP - NATUREZA DA OPERAÇÃO</span>
                  <span class="val">${escapeHtml(naturezaCfopTexto)}</span>
                </td>
              </tr>
            </table>
            <table class="sefaz-box-table no-top">
              <colgroup><col style="width:50%" /><col style="width:50%" /></colgroup>
              <tr>
                <td class="split-mid-right"><span class="lbl">INÍCIO DA PRESTAÇÃO</span><span class="val">${escapeHtml(inicioPrestacao)}</span></td>
                <td><span class="lbl">TÉRMINO DA PRESTAÇÃO</span><span class="val">${escapeHtml(terminoPrestacao)}</span></td>
              </tr>
            </table>

            <!-- 4. QUADROS DOS ENVOLVIDOS NO TRANSPORTE -->
            <!-- LINHA 1: REMETENTE | DESTINATÁRIO -->
            <table class="sefaz-box-table no-top" style="margin-top:2.5px;">
              <colgroup>
                <col style="width:32%" /><col style="width:18%" />
                <col style="width:32%" /><col style="width:18%" />
              </colgroup>
              <tr>
                <td colspan="2" class="split-mid-right" style="background:#f9fafb;"><span class="lbl">REMETENTE</span><span class="val-sm">${escapeHtml(remNome)}</span></td>
                <td colspan="2" style="background:#f9fafb;"><span class="lbl">DESTINATÁRIO</span><span class="val-sm">${escapeHtml(destNome)}</span></td>
              </tr>
              <tr>
                <td><span class="lbl">ENDEREÇO</span><span class="val-sm">${escapeHtml(remEndereco)}</span></td>
                <td class="split-mid-right"><span class="lbl">BAIRRO</span><span class="val-sm">${escapeHtml(remBairro)}</span></td>
                <td><span class="lbl">ENDEREÇO</span><span class="val-sm">${escapeHtml(destEndereco)}</span></td>
                <td><span class="lbl">BAIRRO</span><span class="val-sm">${escapeHtml(destBairro)}</span></td>
              </tr>
              <tr>
                <td><span class="lbl">MUNICÍPIO</span><span class="val-sm">${escapeHtml(remCidade || remCidadeUfRaw)}</span></td>
                <td class="split-mid-right"><span class="lbl">UF / CEP</span><span class="val-sm mono">${escapeHtml(remUf || '-')} • ${escapeHtml(remCep)}</span></td>
                <td><span class="lbl">MUNICÍPIO</span><span class="val-sm">${escapeHtml(destCidade || nota.destinatarioCidadeUf || '-')}</span></td>
                <td><span class="lbl">UF / CEP</span><span class="val-sm mono">${escapeHtml(destUf || '-')} • ${escapeHtml(destCep)}</span></td>
              </tr>
              <tr>
                <td><span class="lbl">CNPJ / CPF</span><span class="val-sm mono">${escapeHtml(remCpfCnpj)}</span></td>
                <td class="split-mid-right"><span class="lbl">INSCRIÇÃO ESTADUAL</span><span class="val-sm mono">${escapeHtml(remIe)}</span></td>
                <td><span class="lbl">CNPJ / CPF</span><span class="val-sm mono">${escapeHtml(destCpfCnpj)}</span></td>
                <td><span class="lbl">INSCRIÇÃO ESTADUAL</span><span class="val-sm mono">${escapeHtml(destIe)}</span></td>
              </tr>
              <tr>
                <td><span class="lbl">PAÍS</span><span class="val-sm">BRASIL</span></td>
                <td class="split-mid-right"><span class="lbl">FONE</span><span class="val-sm mono">${escapeHtml(remFone)}</span></td>
                <td><span class="lbl">PAÍS</span><span class="val-sm">BRASIL</span></td>
                <td><span class="lbl">FONE</span><span class="val-sm mono">${escapeHtml(destFone)}</span></td>
              </tr>
            </table>

            <!-- LINHA 2: EXPEDIDOR | RECEBEDOR (ESTRUTURA PADRÃO EM BRANCO/OPCIONAL) -->
            <table class="sefaz-box-table no-top">
              <colgroup>
                <col style="width:32%" /><col style="width:18%" />
                <col style="width:32%" /><col style="width:18%" />
              </colgroup>
              <tr>
                <td colspan="2" class="split-mid-right" style="background:#f9fafb;"><span class="lbl">EXPEDIDOR</span><span class="val-sm">-</span></td>
                <td colspan="2" style="background:#f9fafb;"><span class="lbl">RECEBEDOR</span><span class="val-sm">-</span></td>
              </tr>
              <tr>
                <td><span class="lbl">ENDEREÇO</span><span class="val-sm">-</span></td>
                <td class="split-mid-right"><span class="lbl">BAIRRO</span><span class="val-sm">-</span></td>
                <td><span class="lbl">ENDEREÇO</span><span class="val-sm">-</span></td>
                <td><span class="lbl">BAIRRO</span><span class="val-sm">-</span></td>
              </tr>
              <tr>
                <td><span class="lbl">MUNICÍPIO / UF / CEP</span><span class="val-sm">-</span></td>
                <td class="split-mid-right"><span class="lbl">PAÍS / FONE</span><span class="val-sm">-</span></td>
                <td><span class="lbl">MUNICÍPIO / UF / CEP</span><span class="val-sm">-</span></td>
                <td><span class="lbl">PAÍS / FONE</span><span class="val-sm">-</span></td>
              </tr>
              <tr>
                <td><span class="lbl">CNPJ / CPF</span><span class="val-sm">-</span></td>
                <td class="split-mid-right"><span class="lbl">INSCRIÇÃO ESTADUAL</span><span class="val-sm">-</span></td>
                <td><span class="lbl">CNPJ / CPF</span><span class="val-sm">-</span></td>
                <td><span class="lbl">INSCRIÇÃO ESTADUAL</span><span class="val-sm">-</span></td>
              </tr>
            </table>

            <!-- LINHA 3: TOMADOR DO SERVIÇO (LARGURA TOTAL) -->
            <table class="sefaz-box-table no-top">
              <colgroup>
                <col style="width:40%" /><col style="width:24%" /><col style="width:18%" /><col style="width:18%" />
              </colgroup>
              <tr>
                <td colspan="2" style="background:#f9fafb;"><span class="lbl">TOMADOR DO SERVIÇO (${escapeHtml(tomadorTipoLabel)})</span><span class="val-sm">${escapeHtml(tomNome)}</span></td>
                <td><span class="lbl">CNPJ / CPF</span><span class="val-sm mono">${escapeHtml(tomCpfCnpj)}</span></td>
                <td><span class="lbl">INSCRIÇÃO ESTADUAL</span><span class="val-sm mono">${escapeHtml(tomIe)}</span></td>
              </tr>
              <tr>
                <td><span class="lbl">ENDEREÇO</span><span class="val-sm">${escapeHtml(tomEndereco)}</span></td>
                <td><span class="lbl">MUNICÍPIO / UF</span><span class="val-sm">${escapeHtml(tomCidade || tomCidadeUf)}${tomUf ? ` - ${escapeHtml(tomUf)}` : ''}</span></td>
                <td><span class="lbl">CEP</span><span class="val-sm mono">${escapeHtml(tomCep)}</span></td>
                <td><span class="lbl">FONE</span><span class="val-sm mono">${escapeHtml(tomFone)}</span></td>
              </tr>
            </table>

            <!-- 5. DADOS DA CARGA, VALORES E IMPOSTOS -->
            <div class="sec-title">DADOS DA CARGA</div>
            <table class="sefaz-box-table">
              <colgroup><col style="width:28%" /><col style="width:24%" /><col style="width:18%" /><col style="width:14%" /><col style="width:16%" /></colgroup>
              <tr>
                <td><span class="lbl">PRODUTO PREDOMINANTE</span><span class="val-sm">${escapeHtml(nota.cteProdutoPredominante || '-')}</span></td>
                <td><span class="lbl">OUTRAS CARACTERÍSTICAS DA CARGA</span><span class="val-sm">${escapeHtml(nota.veiculoModelo || 'CARGA RODOVIÁRIA')}</span></td>
                <td><span class="lbl">VALOR TOTAL DA MERCADORIA</span><span class="val-sm tr mono">R$ ${formatBRLNumber(valorCargaExibicao)}</span></td>
                <td><span class="lbl">TIPO MEDIDA</span><span class="val-sm tc">KG</span></td>
                <td><span class="lbl">QTD / UN. MEDIDA (PESO BRUTO)</span><span class="val-sm tr mono">${nota.ctePesoBrutoKg ? `${Number(nota.ctePesoBrutoKg).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} KG` : '0,000 KG'}</span></td>
              </tr>
            </table>

            <div class="sec-title">VALORES DA PRESTAÇÃO DE SERVIÇO &amp; IMPOSTOS</div>
            <table class="sefaz-box-table">
              <colgroup><col style="width:54%" /><col style="width:23%" /><col style="width:23%" /></colgroup>
              <tr>
                <td>
                  <span class="lbl">COMPONENTES DO VALOR DA PRESTAÇÃO DE SERVIÇO</span>
                  <div style="display:flex;justify-content:space-between;font-size:7pt;font-weight:700;">
                    <span>SERVIÇO DE TRANSPORTE RODOVIÁRIO</span>
                    <span class="mono">R$ ${formatBRLNumber(nota.valorTotal)}</span>
                  </div>
                </td>
                <td><span class="lbl">VALOR TOTAL DA PRESTAÇÃO DO SERVIÇO</span><span class="val tr mono bold-lg">R$ ${formatBRLNumber(nota.valorTotal)}</span></td>
                <td class="highlight-cell"><span class="lbl">VALOR A RECEBER</span><span class="val tr mono bold-lg">R$ ${formatBRLNumber(nota.valorTotal)}</span></td>
              </tr>
            </table>
            <table class="sefaz-box-table no-top">
              <colgroup><col style="width:42%" /><col style="width:16%" /><col style="width:12%" /><col style="width:16%" /><col style="width:14%" /></colgroup>
              <tr>
                <td><span class="lbl">CLASSIFICAÇÃO TRIBUTÁRIA DO SERVIÇO</span><span class="val-sm">${escapeHtml(classTrib)}</span></td>
                <td><span class="lbl">BASE DE CÁLCULO</span><span class="val-sm tr mono">${formatBRLNumber(totalBaseIcms)}</span></td>
                <td><span class="lbl">AL. ICMS (%)</span><span class="val-sm tr mono">0,00%</span></td>
                <td><span class="lbl">VALOR ICMS</span><span class="val-sm tr mono">${formatBRLNumber(totalValorIcms)}</span></td>
                <td><span class="lbl">% RED. BC. CÁLC</span><span class="val-sm tr mono">0,00%</span></td>
              </tr>
            </table>
          </div>

          <!-- 6A. DOCUMENTOS ORIGINÁRIOS EM 2 COLUNAS (EXPANSÍVEL PARA OCUPAR 100% DA ALTURA DA PÁGINA A4) -->
          <div class="sefaz-middle-expand">
            <div class="sec-title">DOCUMENTOS ORIGINÁRIOS (NF-e VINCULADAS — ${cteNfes.length})</div>
            <div class="sefaz-table-stretch-wrap">
              ${isHomologacao ? `<div class="homologacao-watermark" aria-hidden="true">${OFFICIAL_HOMOLOGACAO_NOTICE}</div>` : ''}
              <table class="sefaz-table">
                <colgroup>${dacteColWidths.map((w) => `<col style="width:${w};" />`).join('')}</colgroup>
                <thead>
                  <tr>
                    <th>TIPO</th>
                    <th>NÚM. NOTA</th>
                    <th style="text-align:left;">CHAVE DE ACESSO NF-E</th>
                    <th>TIPO</th>
                    <th>NÚM. NOTA</th>
                    <th style="text-align:left;">CHAVE DE ACESSO NF-E</th>
                  </tr>
                </thead>
                <tbody>${docOriginariosRows}</tbody>
              </table>
              <div class="sefaz-col-guides">${dacteGuides}</div>
            </div>
          </div>

          <!-- 6B. OBSERVAÇÕES, MODAL RODOVIÁRIO E RODAPÉ OFICIAL -->
          <div class="sefaz-bottom-fixed">
            <div class="sec-title">OBSERVAÇÕES</div>
            <table class="sefaz-box-table">
              <colgroup><col style="width:100%" /></colgroup>
              <tr>
                <td style="min-height:36px;padding:3px 5px;">
                  ${isHomologacao ? `<div class="homologacao-info-line">${OFFICIAL_HOMOLOGACAO_NOTICE}</div>` : ''}
                  <div style="font-size:6.6pt;font-weight:700;line-height:1.25;white-space:pre-line;word-break:break-word;">${escapeHtml(obsLines.join('\n'))}</div>
                </td>
              </tr>
            </table>

            <div class="sec-title">INFORMAÇÕES ESPECÍFICAS DO MODAL RODOVIÁRIO</div>
            <table class="sefaz-box-table">
              <colgroup><col style="width:24%" /><col style="width:18%" /><col style="width:18%" /><col style="width:40%" /></colgroup>
              <tr>
                <td class="highlight-cell"><span class="lbl">RNTRC DA EMPRESA</span><span class="val mono">${escapeHtml(companyRntrc)}</span></td>
                <td><span class="lbl">PLACA TRAÇÃO</span><span class="val-sm mono">${escapeHtml(nota.veiculoPlaca || '-')}</span></td>
                <td><span class="lbl">PLACA REBOQUE</span><span class="val-sm mono">${escapeHtml(nota.mdfeReboquePlaca || '-')}</span></td>
                <td><span class="lbl">MOTORISTA / CPF</span><span class="val-sm">${escapeHtml(nota.motoristaNome || '-')} ${nota.motoristaCpf ? `(${escapeHtml(formatCpfCnpj(nota.motoristaCpf))})` : ''}</span></td>
              </tr>
            </table>

            <table class="sefaz-box-table no-top" style="margin-top:2.5px;">
              <colgroup><col style="width:65%" /><col style="width:35%" /></colgroup>
              <tr>
                <td style="height:44px;padding:3px 5px;">
                  <span class="lbl">USO EXCLUSIVO DO EMISSOR DO CT-e</span>
                  <div style="font-size:6.2pt;font-weight:600;line-height:1.25;white-space:pre-line;word-break:break-word;">${escapeHtml(usoExclusivoEmissorText)}</div>
                </td>
                <td style="height:44px;padding:3px 5px;">
                  <span class="lbl">RESERVADO AO FISCO</span>
                </td>
              </tr>
            </table>

            <div style="margin-top:2.5px;display:flex;justify-content:space-between;font-size:5.8pt;font-weight:700;line-height:1;">
              <span>AGROCONTROL • DACTE PADRÃO SEFAZ (MODELO 57)</span>
              <span>IMPRESSO EM: ${escapeHtml(new Date().toLocaleString('pt-BR'))}</span>
            </div>
          </div>
        </div>

        <script>
          (function () {
            var didPrint = false;
            function triggerPrint() {
              if (didPrint) return;
              didPrint = true;
              setTimeout(function () {
                try {
                  window.focus();
                  window.print();
                } catch (e) {
                  console.error('Erro ao acionar impressão:', e);
                }
              }, 250);
            }
            window.onload = triggerPrint;
            if (document.readyState === 'complete') {
              triggerPrint();
            }
          })();
        </script>
      </body>
    </html>
  `;
}

export function buildNotaSaidaHtml(
  nota: NotaSaidaRecord,
  companyProfile?: CompanyProfile,
  logoUrl?: string
): string {
  const docTypeLowerCheck = (nota.tipoDocumento || '').toLowerCase();
  if (docTypeLowerCheck.includes('ct-e') || docTypeLowerCheck.includes('cte')) {
    return buildDacteHtml(nota, companyProfile, logoUrl);
  }

  const tradeName =
    companyProfile?.tradeName ||
    companyProfile?.name ||
    companyProfile?.corporateName ||
    companyProfile?.companyName ||
    'AGROCONTROL';
  const corporateName =
    companyProfile?.corporateName || companyProfile?.companyName || tradeName;

  const companyCnpj = formatCpfCnpj(companyProfile?.cnpj || companyProfile?.cnpjCpf || '') || 'NÃO INFORMADO';
  const companyIe = companyProfile?.stateRegistration || 'ISENTO';
  const companyIeSt = '';
  const companyPhone = companyProfile?.phone || '';
  const companyStreet = [
    companyProfile?.address,
    companyProfile?.number ? `Nº ${companyProfile.number}` : '',
  ]
    .filter(Boolean)
    .join(', ');
  const companyNeighborhood = companyProfile?.neighborhood || '';
  const companyCep = companyProfile?.zipCode || companyProfile?.cep || '';
  const companyCityUf = companyProfile?.city
    ? `${companyProfile.city}${companyProfile?.state ? ` / ${companyProfile.state}` : ''}`
    : '';

  const docMeta = getSefazDocMeta(nota.tipoDocumento);
  const docTypeLower = (nota.tipoDocumento || '').toLowerCase();
  const isNfse = docTypeLower.includes('nfs-e') || docTypeLower.includes('nfse');
  const isCte = docTypeLower.includes('ct-e') || docTypeLower.includes('cte');
  const isMdfe = docTypeLower.includes('mdf-e') || docTypeLower.includes('mdfe');
  const isNfeOrNfce = !isNfse && !isCte && !isMdfe;
  const natLower = (nota.nfeNaturezaOperacao || '').toLowerCase();
  const nfeCfopDigits = cleanDigits(nota.nfeCfop || '');
  const isEntradaCfop = nfeCfopDigits.startsWith('1') || nfeCfopDigits.startsWith('2');
  const isDanfeRetorno =
    isNfeOrNfce &&
    (docTypeLower.includes('retorno') ||
      isEntradaCfop ||
      natLower.startsWith('retorno') ||
      (docTypeLower.includes('remessa') && natLower.startsWith('devolu')));
  const tipoOperacaoDanfe = isDanfeRetorno ? '0' : '1';

  const numeroFormatado = String(nota.numero || '000001').padStart(6, '0');
  const serieFormatada = String(nota.serie || '1');

  const { chave44, isInternalGenerated } = resolveChaveAcesso44(nota, companyProfile);
  const chaveFormatada = formatChaveAcessoGroups(chave44);
  const barcodeSvg = generateCode128CSvg(chave44);

  const isHomologacao = resolveIsHomologacaoAmbiente(companyProfile);
  const emissionYearShort = (nota.dataEmissao || '').slice(2, 4) || new Date().getFullYear().toString().slice(-2);
  const simulatedProtocol = `141${emissionYearShort}${cleanDigits(nota.numero || '1').padStart(9, '0')}`;
  const protocolTimestamp = `${formatDateBR(nota.dataEmissao)} ${new Date(nota.createdAt || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
  const protocoloUso = nota.protocoloAutorizacao
    ? `${nota.protocoloAutorizacao}${isHomologacao ? ' (HOMOLOGAÇÃO)' : ''}`
    : !isInternalGenerated && nota.chaveAcesso
      ? `${simulatedProtocol} - ${protocolTimestamp}${isHomologacao ? ' (HOMOLOGAÇÃO)' : ''}`
      : `${simulatedProtocol} - ${protocolTimestamp} (CONTROLE INTERNO)`;

  const naturezaOperacaoText = isCte
    ? `PRESTAÇÃO DE SERVIÇO DE TRANSPORTE (${nota.cteTipoServico || 'NORMAL'})`
    : isNfse
      ? (nota.nfseNaturezaOperacao || 'PRESTAÇÃO DE SERVIÇOS — TRIBUTAÇÃO NO MUNICÍPIO')
      : isMdfe
        ? 'MANIFESTO ELETRÔNICO DE DOCUMENTOS FISCAIS (TRANSPORTE DE CARGA)'
        : (nota.nfeNaturezaOperacao || 'VENDA DE MERCADORIA');

  const cfopPrincipal = isCte
    ? (nota.cteCfop || '5352')
    : isNfse
      ? (nota.nfseCodigoServico || '17.05')
      : isMdfe
        ? '5352 / 6352'
        : (nota.nfeCfop || '5102');

  const { cidade: destCidade, uf: destUf } = splitCityUf(nota.destinatarioCidadeUf);

  const itemsList = Array.isArray(nota.itens) ? nota.itens : [];
  const totalProdutos = itemsList.reduce((acc, it) => acc + (Number(it.valorTotal) || 0), 0);
  const totalBaseIcms = itemsList.reduce((acc, it) => acc + (Number(it.baseIcms) || 0), 0);
  const totalValorIcms = itemsList.reduce((acc, it) => acc + (Number(it.valorIcms) || 0), 0);
  const totalDescontos = itemsList.reduce((acc, it) => acc + (Number(it.desconto) || 0), 0);

  const fretePorContaLabel = nota.nfeModalidadeFrete || '9 - SEM OCORRÊNCIA DE TRANSPORTE';
  const transpPlaca = nota.nfeTransportadoraPlaca || nota.veiculoPlaca || '';
  const isPropriaTransp =
    Boolean(nota.nfeTransportadoraIsPropriaEmpresa) ||
    (Boolean(nota.nfeTransportadoraNome) &&
      (nota.nfeTransportadoraNome.trim().toUpperCase() === corporateName.trim().toUpperCase() ||
        nota.nfeTransportadoraNome.trim().toUpperCase() === tradeName.trim().toUpperCase()));
  const companyFullEndereco = [companyStreet, companyNeighborhood].filter(Boolean).join(' - ').toUpperCase();
  const transpNome =
    nota.nfeTransportadoraNome ||
    (isPropriaTransp ? corporateName.toUpperCase() : transpPlaca ? 'TRANSPORTE PRÓPRIO / FROTA' : 'SEM TRANSPORTADOR INFORMADO');
  const transpCnpjCpf = nota.nfeTransportadoraCpfCnpj
    ? formatCpfCnpj(nota.nfeTransportadoraCpfCnpj)
    : isPropriaTransp
      ? companyCnpj
      : '-';
  const transpIe = nota.nfeTransportadoraIe || (isPropriaTransp ? companyIe : '-');
  const transpEndereco = nota.nfeTransportadoraEndereco || (isPropriaTransp && companyFullEndereco ? companyFullEndereco : '-');
  const transpMunicipio =
    nota.nfeTransportadoraMunicipio || (isPropriaTransp && companyProfile?.city ? companyProfile.city.toUpperCase() : '-');
  const transpUf =
    nota.nfeTransportadoraUf || (isPropriaTransp && companyProfile?.state ? companyProfile.state.toUpperCase() : '-');
  const transpVeiculoUf =
    nota.nfeTransportadoraVeiculoUf ||
    nota.nfeTransportadoraUf ||
    (transpPlaca && isPropriaTransp ? (companyProfile?.state || destUf || '-').toUpperCase() : transpPlaca ? (destUf || companyProfile?.state || '-').toUpperCase() : '-');

  // =====================================================================
  // QUADROS ESPECÍFICOS POR TIPO DE DOCUMENTO (SEFAZ OFICIAL — TOPO / MIOLO / RODAPÉ)
  // =====================================================================
  let specificTopHtml = '';
  let specificMiddleHtml = '';
  let specificBottomTotalsHtml = '';

  if (isCte) {
    const cteNfes = Array.isArray(nota.cteNfesVinculadas) && nota.cteNfesVinculadas.length > 0
      ? nota.cteNfesVinculadas
      : (nota.cteNfeTransportada
          ? nota.cteNfeTransportada
              .split(',')
              .map((raw, idx) => ({
                id: `legacy_${idx}`,
                numero: raw.trim(),
                serie: '1',
                chaveAcesso: cleanDigits(raw).length === 44 ? cleanDigits(raw) : '',
                valorNota: idx === 0 ? (nota.cteValorCarga || 0) : 0,
              }))
          : []);
    const somaNfesCte = cteNfes.reduce((acc, nf) => acc + (Number(nf.valorNota) || 0), 0);
    const valorCargaExibicao = nota.cteValorCarga && nota.cteValorCarga > 0 ? nota.cteValorCarga : somaNfesCte;
    const remNome =
      nota.cteRemetenteNome ||
      (nota.cteRemetenteIsEmpresaPropria ? corporateName : '') ||
      nota.destinatarioNome ||
      '-';
    const remCidadeUf =
      nota.cteRemetenteCidadeUf ||
      (nota.cteRemetenteIsEmpresaPropria ? companyCityUf.toUpperCase() : '') ||
      '-';

    const tomadorTipoRaw = (nota.cteTomador || 'Remetente').toLowerCase();
    const isTomadorOutros = tomadorTipoRaw.includes('outro') || tomadorTipoRaw.includes('terceiro');
    const isTomadorDest = tomadorTipoRaw.includes('destinat');

    const tomadorNomeResolved =
      nota.cteTomadorFinalNome ||
      (isTomadorOutros
        ? (nota.cteTomadorTerceiroNome || '-')
        : isTomadorDest
          ? (nota.destinatarioNome || '-')
          : remNome);

    const tomadorShortPrefix = isTomadorOutros
      ? 'TOMADOR DO SERVIÇO: OUTROS / TERCEIRO (CONSIGNATÁRIO)'
      : isTomadorDest
        ? 'TOMADOR DO SERVIÇO: DESTINATÁRIO (FOB - PAGO NO DESTINO)'
        : 'TOMADOR DO SERVIÇO: REMETENTE (CIF - PAGO NA ORIGEM)';
    const tomadorLabel = `${tomadorShortPrefix} — ${tomadorNomeResolved}`;

    specificTopHtml = `
      <div class="sec-title">INÍCIO / TÉRMINO DA PRESTAÇÃO &amp; TOMADOR DO SERVIÇO</div>
      <table class="sefaz-box-table">
        <colgroup><col style="width:26%" /><col style="width:26%" /><col style="width:14%" /><col style="width:34%" /></colgroup>
        <tr>
          <td><span class="lbl">INÍCIO DA PRESTAÇÃO (ORIGEM)</span><span class="val">${escapeHtml(nota.cteMunicipioInicio || (remCidadeUf !== '-' ? remCidadeUf : '') || companyCityUf || '-')}</span></td>
          <td><span class="lbl">TÉRMINO DA PRESTAÇÃO (DESTINO)</span><span class="val">${escapeHtml(nota.cteMunicipioTermino || nota.destinatarioCidadeUf || '-')}</span></td>
          <td><span class="lbl">TIPO DE SERVIÇO</span><span class="val">${escapeHtml(nota.cteTipoServico || 'NORMAL')}</span></td>
          <td><span class="lbl">TOMADOR DO SERVIÇO</span><span class="val">${escapeHtml(tomadorLabel)}</span></td>
        </tr>
      </table>

      <div class="sec-title">DADOS DA CARGA &amp; MODAL RODOVIÁRIO</div>
      <table class="sefaz-box-table">
        <colgroup><col style="width:30%" /><col style="width:14%" /><col style="width:18%" /><col style="width:12%" /><col style="width:12%" /><col style="width:14%" /></colgroup>
        <tr>
          <td><span class="lbl">PRODUTO PREDOMINANTE</span><span class="val">${escapeHtml(nota.cteProdutoPredominante || '-')}</span></td>
          <td><span class="lbl">PESO BRUTO (KG)</span><span class="val tr">${nota.ctePesoBrutoKg ? `${Number(nota.ctePesoBrutoKg).toLocaleString('pt-BR')} KG` : '-'}</span></td>
          <td><span class="lbl">VALOR TOTAL DA CARGA (R$)</span><span class="val tr">${formatBRLNumber(valorCargaExibicao)}</span></td>
          <td><span class="lbl">PLACA TRAÇÃO</span><span class="val mono">${escapeHtml(nota.veiculoPlaca || '-')}</span></td>
          <td><span class="lbl">REBOQUE</span><span class="val mono">${escapeHtml(nota.mdfeReboquePlaca || '-')}</span></td>
          <td><span class="lbl">RNTRC</span><span class="val mono">ISENTO / PRÓPRIO</span></td>
        </tr>
      </table>
      <table class="sefaz-box-table no-top">
        <colgroup><col style="width:50%" /><col style="width:25%" /><col style="width:25%" /></colgroup>
        <tr>
          <td><span class="lbl">MOTORISTA CONDUTOR</span><span class="val">${escapeHtml(nota.motoristaNome || '-')}</span></td>
          <td><span class="lbl">CPF DO MOTORISTA</span><span class="val mono">${escapeHtml(nota.motoristaCpf ? formatCpfCnpj(nota.motoristaCpf) : '-')}</span></td>
          <td><span class="lbl">VEÍCULO / MODELO</span><span class="val">${escapeHtml(nota.veiculoModelo || '-')}</span></td>
        </tr>
      </table>
    `;

    const cteColWidths = ['11%', '7%', '12%', '54%', '16%'];
    const cteHeader = `
      <tr>
        <th style="text-align:center;">MODELO</th>
        <th style="text-align:center;">SÉRIE</th>
        <th style="text-align:center;">NÚMERO</th>
        <th style="text-align:left;">CHAVE DE ACESSO (44 DÍGITOS)</th>
        <th style="text-align:right;">VALOR NF-e (R$)</th>
      </tr>
    `;
    const cteRows =
      cteNfes.length > 0
        ? cteNfes
            .map(
              (nf) => `
            <tr class="sefaz-data-row">
              <td class="tc mono">55 - NF-e</td>
              <td class="tc mono">${escapeHtml(nf.serie || '1')}</td>
              <td class="tc mono bold">${escapeHtml(nf.numero || '-')}</td>
              <td class="mono" style="font-size:7.5pt;letter-spacing:0.25px;">${escapeHtml(nf.chaveAcesso ? formatChaveAcessoGroups(nf.chaveAcesso) : 'CHAVE NÃO INFORMADA')}</td>
              <td class="tr mono bold">${formatBRLNumber(nf.valorNota || 0)}</td>
            </tr>
          `
            )
            .join('')
        : `<tr class="sefaz-data-row"><td class="tc mono">-</td><td class="tc mono">-</td><td class="tc mono">-</td><td class="tc">NENHUM DOCUMENTO ORIGINÁRIO INFORMADO</td><td class="tr mono">-</td></tr>`;

    specificMiddleHtml = `
      <div class="sec-title">DOCUMENTOS ORIGINÁRIOS (NF-e VINCULADAS AO CT-e — ${cteNfes.length})</div>
      ${buildExpandableTableBox(cteColWidths, cteHeader, cteRows, isHomologacao)}
    `;

    specificBottomTotalsHtml = `
      <div class="sec-title">COMPONENTES DO VALOR DA PRESTAÇÃO E IMPOSTOS</div>
      <table class="sefaz-box-table">
        <colgroup><col style="width:20%" /><col style="width:20%" /><col style="width:15%" /><col style="width:20%" /><col style="width:25%" /></colgroup>
        <tr>
          <td><span class="lbl">FRETE VALOR (R$)</span><span class="val tr">${formatBRLNumber(nota.valorTotal)}</span></td>
          <td><span class="lbl">BASE DE CÁLCULO ICMS</span><span class="val tr">${formatBRLNumber(totalBaseIcms)}</span></td>
          <td><span class="lbl">ALÍQUOTA ICMS (%)</span><span class="val tr">0,00%</span></td>
          <td><span class="lbl">VALOR DO ICMS</span><span class="val tr">${formatBRLNumber(totalValorIcms)}</span></td>
          <td class="highlight-cell"><span class="lbl">VALOR TOTAL DO SERVIÇO (R$)</span><span class="val tr bold-lg">R$ ${formatBRLNumber(nota.valorTotal)}</span></td>
        </tr>
      </table>
      <table class="sefaz-box-table no-top">
        <colgroup><col style="width:50%" /><col style="width:25%" /><col style="width:25%" /></colgroup>
        <tr>
          <td><span class="lbl">CONDIÇÃO DE PAGAMENTO</span><span class="val">${escapeHtml(nota.condicaoPagamento)}</span></td>
          <td><span class="lbl">DATA DE VENCIMENTO</span><span class="val">${escapeHtml(formatDateBR(nota.dataVencimento || nota.dataEmissao))}</span></td>
          <td><span class="lbl">INTEGRAÇÃO FINANCEIRA</span><span class="val">${nota.lancarContasReceber ? 'CONTAS A RECEBER' : 'SOMENTE FISCAL'}</span></td>
        </tr>
      </table>
    `;
  } else if (isNfse) {
    const nfseComplementaryLines = [
      nota.nfsePedidoServicoLabel ? `PEDIDO / OS VINCULADO: ${nota.nfsePedidoServicoLabel}` : '',
      nota.nfseObservacoesFiscais ? nota.nfseObservacoesFiscais : '',
    ]
      .filter(Boolean)
      .join('\n');

    const servicosExtraLines = [
      nota.descricao || '-',
      nota.nfsePedidoServicoLabel ? `PEDIDO / OS VINCULADO: ${nota.nfsePedidoServicoLabel}` : '',
      nota.nfseObservacoesFiscais ? `OBSERVAÇÕES FISCAIS: ${nota.nfseObservacoesFiscais}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    specificTopHtml = `
      <div class="sec-title">DADOS DA PRESTAÇÃO DE SERVIÇOS (NFS-e)</div>
      <table class="sefaz-box-table">
        <colgroup><col style="width:26%" /><col style="width:28%" /><col style="width:30%" /><col style="width:16%" /></colgroup>
        <tr>
          <td><span class="lbl">CÓDIGO DO SERVIÇO (LC 116/03)</span><span class="val mono">${escapeHtml(nota.nfseCodigoServico || '17.05')}</span></td>
          <td><span class="lbl">MUNICÍPIO DA PRESTAÇÃO</span><span class="val">${escapeHtml(nota.nfseMunicipioPrestacao || nota.destinatarioCidadeUf || companyCityUf || '-')}</span></td>
          <td><span class="lbl">EXIGIBILIDADE / NATUREZA</span><span class="val">${escapeHtml(nota.nfseNaturezaOperacao || 'TRIBUTAÇÃO NO MUNICÍPIO')}</span></td>
          <td><span class="lbl">ISS RETIDO?</span><span class="val">${nota.nfseRetencaoIss ? 'SIM (RETIDO)' : 'NÃO'}</span></td>
        </tr>
      </table>
    `;

    const nfseColWidths = ['9%', '43%', '12%', '12%', '11%', '13%'];
    const nfseHeader = `
      <tr>
        <th style="text-align:center;">CÓD. LC 116</th>
        <th style="text-align:left;">DISCRIMINAÇÃO DO SERVIÇO PRESTADO</th>
        <th style="text-align:right;">QTD / UNID.</th>
        <th style="text-align:right;">V. UNIT. (R$)</th>
        <th style="text-align:right;">DESC. (R$)</th>
        <th style="text-align:right;">VALOR TOTAL (R$)</th>
      </tr>
    `;
    const nfseRows =
      itemsList.length > 0
        ? itemsList
            .map(
              (it) => `
          <tr class="sefaz-data-row">
            <td class="tc mono">${escapeHtml(it.codigoServico || nota.nfseCodigoServico || '17.05')}</td>
            <td class="bold">${escapeHtml(it.descricao || '-')}${it.codigo ? ` <span class="mono" style="font-weight:normal;color:#475569;">(CÓD: ${escapeHtml(it.codigo)})</span>` : ''}</td>
            <td class="tr mono">${Number(it.quantidade || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ${escapeHtml(it.unidade || 'UN')}</td>
            <td class="tr mono">${formatBRLNumber(it.valorUnitario || 0)}</td>
            <td class="tr mono">${formatBRLNumber(it.desconto || 0)}</td>
            <td class="tr mono bold">${formatBRLNumber(it.valorTotal || 0)}</td>
          </tr>
        `
            )
            .join('')
        : `
          <tr class="sefaz-data-row">
            <td class="tc mono">${escapeHtml(nota.nfseCodigoServico || '17.05')}</td>
            <td class="bold" style="white-space:pre-line;line-height:1.35;">${escapeHtml(servicosExtraLines)}</td>
            <td class="tr mono">${nota.nfseQuantidadeAreaHoras ? `${Number(nota.nfseQuantidadeAreaHoras).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ${escapeHtml(nota.nfseUnidadeAreaHoras || 'UN')}` : '1 UN'}</td>
            <td class="tr mono">${nota.nfseValorUnitario ? formatBRLNumber(nota.nfseValorUnitario) : formatBRLNumber(nota.valorTotal)}</td>
            <td class="tr mono">0,00</td>
            <td class="tr mono bold">${formatBRLNumber(nota.valorTotal)}</td>
          </tr>
        `;

    const nfseComplementaryBox =
      itemsList.length > 0 && nfseComplementaryLines
        ? `
      <table class="sefaz-box-table no-top">
        <colgroup><col style="width:100%" /></colgroup>
        <tr>
          <td>
            <span class="lbl">OBSERVAÇÕES FISCAIS / DISCRIMINAÇÃO COMPLEMENTAR DA NFS-e</span>
            <span class="val" style="white-space:pre-line;">${escapeHtml(nfseComplementaryLines)}</span>
          </td>
        </tr>
      </table>
    `
        : '';

    specificMiddleHtml = `
      <div class="sec-title">DISCRIMINAÇÃO DOS SERVIÇOS PRESTADOS${itemsList.length > 0 ? ` (${itemsList.length} ${itemsList.length === 1 ? 'SERVIÇO' : 'SERVIÇOS'})` : ''}</div>
      ${buildExpandableTableBox(nfseColWidths, nfseHeader, nfseRows, isHomologacao)}
      ${nfseComplementaryBox}
    `;

    const nfseBaseCalculo = nota.valorTotal > 0 ? nota.valorTotal : totalProdutos;
    const nfseValorIssCalc =
      nota.nfseValorIss !== undefined
        ? nota.nfseValorIss
        : Number(((nfseBaseCalculo * (nota.nfseAliquotaIss || 0)) / 100).toFixed(2));

    specificBottomTotalsHtml = `
      <div class="sec-title">CÁLCULO DO ISSQN, TOTAIS E COBRANÇA</div>
      <table class="sefaz-box-table">
        <colgroup><col style="width:20%" /><col style="width:20%" /><col style="width:20%" /><col style="width:18%" /><col style="width:22%" /></colgroup>
        <tr>
          <td><span class="lbl">BASE DE CÁLCULO (R$)</span><span class="val tr">${formatBRLNumber(nfseBaseCalculo)}</span></td>
          <td><span class="lbl">ALÍQUOTA ISS (%)</span><span class="val tr">${nota.nfseAliquotaIss !== undefined ? `${Number(nota.nfseAliquotaIss).toFixed(2)}%` : '0,00%'}</span></td>
          <td><span class="lbl">VALOR DO ISS (R$)</span><span class="val tr">${formatBRLNumber(nfseValorIssCalc)}</span></td>
          <td><span class="lbl">ISS RETIDO</span><span class="val tc">${nota.nfseRetencaoIss ? 'SIM' : 'NÃO'}</span></td>
          <td class="highlight-cell"><span class="lbl">VALOR TOTAL DA NFS-e</span><span class="val tr bold-lg">R$ ${formatBRLNumber(nota.valorTotal)}</span></td>
        </tr>
      </table>
      <table class="sefaz-box-table no-top">
        <colgroup><col style="width:45%" /><col style="width:25%" /><col style="width:30%" /></colgroup>
        <tr>
          <td><span class="lbl">CONDIÇÃO DE PAGAMENTO</span><span class="val">${escapeHtml(nota.condicaoPagamento)}</span></td>
          <td><span class="lbl">VENCIMENTO</span><span class="val">${escapeHtml(formatDateBR(nota.dataVencimento || nota.dataEmissao))}</span></td>
          <td><span class="lbl">CONTAS A RECEBER</span><span class="val">${nota.lancarContasReceber ? 'INTEGRADA' : 'NÃO INTEGRADA'}</span></td>
        </tr>
      </table>
    `;
  } else if (isMdfe) {
    const mdfeDocsList = (nota.mdfeDocumentosVinculados || '')
      .split(/[,;\n]+/)
      .map((d) => d.trim())
      .filter(Boolean);

    specificTopHtml = `
      <div class="sec-title">DADOS DO MANIFESTO DE CARGA &amp; PERCURSO (MDF-e)</div>
      <table class="sefaz-box-table">
        <colgroup><col style="width:20%" /><col style="width:20%" /><col style="width:60%" /></colgroup>
        <tr>
          <td><span class="lbl">UF CARREGAMENTO</span><span class="val tc">${escapeHtml(nota.mdfeUfCarregamento || '-')}</span></td>
          <td><span class="lbl">UF DESCARREGAMENTO</span><span class="val tc">${escapeHtml(nota.mdfeUfDescarregamento || '-')}</span></td>
          <td><span class="lbl">MUNICÍPIOS DE PERCURSO</span><span class="val">${escapeHtml(nota.mdfeMunicipiosPercurso || '-')}</span></td>
        </tr>
      </table>

      <div class="sec-title">MODAL RODOVIÁRIO — TRAÇÃO, CONDUTOR &amp; SEGURO</div>
      <table class="sefaz-box-table">
        <colgroup><col style="width:16%" /><col style="width:18%" /><col style="width:16%" /><col style="width:32%" /><col style="width:18%" /></colgroup>
        <tr>
          <td><span class="lbl">PLACA TRAÇÃO</span><span class="val mono">${escapeHtml(nota.veiculoPlaca || '-')}</span></td>
          <td><span class="lbl">RENAVAM</span><span class="val mono">${escapeHtml(nota.mdfeVeiculoRenavam || '-')}</span></td>
          <td><span class="lbl">PLACA REBOQUE</span><span class="val mono">${escapeHtml(nota.mdfeReboquePlaca || '-')}</span></td>
          <td><span class="lbl">MOTORISTA CONDUTOR</span><span class="val">${escapeHtml(nota.motoristaNome || '-')}</span></td>
          <td><span class="lbl">CPF CONDUTOR</span><span class="val mono">${escapeHtml(nota.motoristaCpf ? formatCpfCnpj(nota.motoristaCpf) : '-')}</span></td>
        </tr>
      </table>
      <table class="sefaz-box-table no-top">
        <colgroup><col style="width:55%" /><col style="width:45%" /></colgroup>
        <tr>
          <td><span class="lbl">SEGURADORA DA CARGA</span><span class="val">${escapeHtml(nota.mdfeSeguradora || '-')}</span></td>
          <td><span class="lbl">Nº APÓLICE DE SEGURO</span><span class="val mono">${escapeHtml(nota.mdfeApoliceSeguro || '-')}</span></td>
        </tr>
      </table>
    `;

    const mdfeColWidths = ['6%', '12%', '46%', '16%', '20%'];
    const mdfeHeader = `
      <tr>
        <th style="text-align:center;">ITEM</th>
        <th style="text-align:center;">TIPO DOC.</th>
        <th style="text-align:left;">NÚMERO / CHAVE DE ACESSO VINCULADA</th>
        <th style="text-align:center;">ORIGEM → DESTINO</th>
        <th style="text-align:left;">OBSERVAÇÃO / CARGA</th>
      </tr>
    `;
    const mdfeRows =
      mdfeDocsList.length > 0
        ? mdfeDocsList
            .map((docItem, idx) => {
              const docDigits = cleanDigits(docItem);
              const isKey44 = docDigits.length === 44;
              const isCteRef = docItem.toUpperCase().includes('CT-E') || (isKey44 && docDigits.slice(20, 22) === '57');
              return `
                <tr class="sefaz-data-row">
                  <td class="tc mono">${String(idx + 1).padStart(2, '0')}</td>
                  <td class="tc mono">${isCteRef ? '57 - CT-e' : '55 - NF-e'}</td>
                  <td class="mono bold" style="font-size:7.5pt;">${escapeHtml(isKey44 ? formatChaveAcessoGroups(docDigits) : docItem)}</td>
                  <td class="tc mono">${escapeHtml(nota.mdfeUfCarregamento || '-')} → ${escapeHtml(nota.mdfeUfDescarregamento || '-')}</td>
                  <td class="bold">${idx === 0 ? escapeHtml(nota.descricao || 'CARGA MANIFESTADA') : 'VINCULADO'}</td>
                </tr>
              `;
            })
            .join('')
        : `
          <tr class="sefaz-data-row">
            <td class="tc mono">01</td>
            <td class="tc mono">MDF-e</td>
            <td class="bold">${escapeHtml(nota.descricao || 'TRANSPORTE RODOVIÁRIO DE CARGA')}</td>
            <td class="tc mono">${escapeHtml(nota.mdfeUfCarregamento || '-')} → ${escapeHtml(nota.mdfeUfDescarregamento || '-')}</td>
            <td class="tc">-</td>
          </tr>
        `;

    specificMiddleHtml = `
      <div class="sec-title">DOCUMENTOS FISCAIS VINCULADOS / DISCRIMINAÇÃO DA CARGA (MDF-e)</div>
      ${buildExpandableTableBox(mdfeColWidths, mdfeHeader, mdfeRows, isHomologacao)}
    `;

    specificBottomTotalsHtml = `
      <div class="sec-title">TOTAIS DO MANIFESTO E CONDIÇÕES</div>
      <table class="sefaz-box-table">
        <colgroup><col style="width:18%" /><col style="width:18%" /><col style="width:24%" /><col style="width:18%" /><col style="width:22%" /></colgroup>
        <tr>
          <td><span class="lbl">QTD. DOCS VINCULADOS</span><span class="val tc mono">${mdfeDocsList.length || 1}</span></td>
          <td><span class="lbl">PESO BRUTO TOTAL (KG)</span><span class="val tr">${nota.mdfePesoTotalKg ? `${Number(nota.mdfePesoTotalKg).toLocaleString('pt-BR')} KG` : '-'}</span></td>
          <td><span class="lbl">CONDIÇÃO / PAGAMENTO</span><span class="val">${escapeHtml(nota.condicaoPagamento)}</span></td>
          <td><span class="lbl">VALOR FRETE / DOC (R$)</span><span class="val tr">R$ ${formatBRLNumber(nota.valorTotal)}</span></td>
          <td class="highlight-cell"><span class="lbl">VALOR TOTAL DA CARGA (R$)</span><span class="val tr bold-lg">R$ ${formatBRLNumber(nota.mdfeValorTotalCarga || nota.valorTotal)}</span></td>
        </tr>
      </table>
    `;
  } else {
    // NF-e / NFC-e / NF-e Remessa-Retorno
    const valorBaseCalc = totalBaseIcms > 0 ? totalBaseIcms : 0;
    const valorTotalProdCalculado = itemsList.length > 0 ? totalProdutos + totalDescontos : nota.valorTotal;

    specificTopHtml = `
      <div class="sec-title">TRANSPORTADOR / VOLUMES TRANSPORTADOS</div>
      <table class="sefaz-box-table">
        <colgroup><col style="width:36%" /><col style="width:20%" /><col style="width:10%" /><col style="width:10%" /><col style="width:6%" /><col style="width:18%" /></colgroup>
        <tr>
          <td><span class="lbl">RAZÃO SOCIAL / TRANSPORTADOR</span><span class="val">${escapeHtml(transpNome)}</span></td>
          <td><span class="lbl">FRETE POR CONTA</span><span class="val">${escapeHtml(fretePorContaLabel)}</span></td>
          <td><span class="lbl">CÓDIGO ANTT</span><span class="val">-</span></td>
          <td><span class="lbl">PLACA DO VEÍCULO</span><span class="val mono">${escapeHtml(transpPlaca || '-')}</span></td>
          <td><span class="lbl">UF</span><span class="val tc">${escapeHtml(transpVeiculoUf)}</span></td>
          <td><span class="lbl">CNPJ / CPF</span><span class="val mono">${escapeHtml(transpCnpjCpf)}</span></td>
        </tr>
      </table>
      <table class="sefaz-box-table no-top">
        <colgroup><col style="width:28%" /><col style="width:18%" /><col style="width:6%" /><col style="width:14%" /><col style="width:8%" /><col style="width:10%" /><col style="width:8%" /><col style="width:8%" /></colgroup>
        <tr>
          <td><span class="lbl">ENDEREÇO</span><span class="val">${escapeHtml(transpEndereco)}</span></td>
          <td><span class="lbl">MUNICÍPIO</span><span class="val">${escapeHtml(transpMunicipio)}</span></td>
          <td><span class="lbl">UF</span><span class="val tc">${escapeHtml(transpUf)}</span></td>
          <td><span class="lbl">INSCRIÇÃO ESTADUAL</span><span class="val">${escapeHtml(transpIe)}</span></td>
          <td><span class="lbl">QUANTIDADE</span><span class="val tc">${itemsList.length || 1}</span></td>
          <td><span class="lbl">ESPÉCIE</span><span class="val tc">VOLUMES</span></td>
          <td><span class="lbl">PESO BRUTO</span><span class="val tr">-</span></td>
          <td><span class="lbl">PESO LÍQUIDO</span><span class="val tr">-</span></td>
        </tr>
      </table>
    `;

    const nfeColWidths = ['7%', '26%', '8%', '7%', '5%', '4%', '6%', '9%', '9%', '7%', '7%', '5%'];
    const nfeHeader = `
      <tr>
        <th style="text-align:center;">CÓD.</th>
        <th style="text-align:left;">DESCRIÇÃO DO PRODUTO / SERVIÇO</th>
        <th style="text-align:center;">NCM/SH</th>
        <th style="text-align:center;">CST/CSOSN</th>
        <th style="text-align:center;">CFOP</th>
        <th style="text-align:center;">UN</th>
        <th style="text-align:right;">QTD</th>
        <th style="text-align:right;">V. UNIT</th>
        <th style="text-align:right;">V. TOTAL</th>
        <th style="text-align:right;">BC ICMS</th>
        <th style="text-align:right;">V. ICMS</th>
        <th style="text-align:right;">ALÍQ.</th>
      </tr>
    `;
    const nfeRows =
      itemsList.length > 0
        ? itemsList
            .map(
              (it, idx) => `
            <tr class="sefaz-data-row">
              <td class="tc mono">${escapeHtml(it.codigo || String(idx + 1).padStart(3, '0'))}</td>
              <td class="bold">${escapeHtml(it.descricao)}</td>
              <td class="tc mono">${escapeHtml(it.ncm || '00000000')}</td>
              <td class="tc mono">102</td>
              <td class="tc mono">${escapeHtml(it.cfop || nota.nfeCfop || '5102')}</td>
              <td class="tc">${escapeHtml(it.unidade || 'UN')}</td>
              <td class="tr mono">${Number(it.quantidade || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}</td>
              <td class="tr mono">${formatBRLNumber(it.valorUnitario)}</td>
              <td class="tr mono bold">${formatBRLNumber(it.valorTotal)}</td>
              <td class="tr mono">${formatBRLNumber(it.baseIcms || 0)}</td>
              <td class="tr mono">${formatBRLNumber(it.valorIcms || 0)}</td>
              <td class="tr mono">${Number(it.aliquotaIcms || 0).toFixed(1)}%</td>
            </tr>
          `
            )
            .join('')
        : `
          <tr class="sefaz-data-row">
            <td class="tc mono">001</td>
            <td class="bold">${escapeHtml(nota.descricao || nota.tipoDocumento)}</td>
            <td class="tc mono">00000000</td>
            <td class="tc mono">102</td>
            <td class="tc mono">${escapeHtml(nota.nfeCfop || '5102')}</td>
            <td class="tc">UN</td>
            <td class="tr mono">1</td>
            <td class="tr mono">${formatBRLNumber(nota.valorTotal)}</td>
            <td class="tr mono bold">${formatBRLNumber(nota.valorTotal)}</td>
            <td class="tr mono">0,00</td>
            <td class="tr mono">0,00</td>
            <td class="tr mono">0,0%</td>
          </tr>
        `;

    specificMiddleHtml = `
      <div class="sec-title">DADOS DOS PRODUTOS / SERVIÇOS</div>
      ${buildExpandableTableBox(nfeColWidths, nfeHeader, nfeRows, isHomologacao)}
    `;

    specificBottomTotalsHtml = `
      <div class="sec-title">CÁLCULO DO IMPOSTO &amp; TOTAIS DA NOTA</div>
      <table class="sefaz-box-table">
        <colgroup><col style="width:20%" /><col style="width:20%" /><col style="width:20%" /><col style="width:20%" /><col style="width:20%" /></colgroup>
        <tr>
          <td><span class="lbl">BASE DE CÁLCULO DO ICMS</span><span class="val tr">${formatBRLNumber(valorBaseCalc)}</span></td>
          <td><span class="lbl">VALOR DO ICMS</span><span class="val tr">${formatBRLNumber(totalValorIcms)}</span></td>
          <td><span class="lbl">BASE DE CÁLC. ICMS SUBST.</span><span class="val tr">0,00</span></td>
          <td><span class="lbl">VALOR DO ICMS SUBST.</span><span class="val tr">0,00</span></td>
          <td><span class="lbl">VALOR TOTAL DOS PRODUTOS</span><span class="val tr">${formatBRLNumber(valorTotalProdCalculado)}</span></td>
        </tr>
      </table>
      <table class="sefaz-box-table no-top">
        <colgroup><col style="width:16%" /><col style="width:16%" /><col style="width:16%" /><col style="width:18%" /><col style="width:14%" /><col style="width:20%" /></colgroup>
        <tr>
          <td><span class="lbl">VALOR DO FRETE</span><span class="val tr">0,00</span></td>
          <td><span class="lbl">VALOR DO SEGURO</span><span class="val tr">0,00</span></td>
          <td><span class="lbl">DESCONTO</span><span class="val tr">${formatBRLNumber(totalDescontos)}</span></td>
          <td><span class="lbl">OUTRAS DESP. ACESSÓRIAS</span><span class="val tr">0,00</span></td>
          <td><span class="lbl">VALOR DO IPI</span><span class="val tr">0,00</span></td>
          <td class="highlight-cell"><span class="lbl">VALOR TOTAL DA NOTA</span><span class="val tr bold-lg">${formatBRLNumber(nota.valorTotal)}</span></td>
        </tr>
      </table>
      <table class="sefaz-box-table no-top">
        <colgroup><col style="width:45%" /><col style="width:25%" /><col style="width:30%" /></colgroup>
        <tr>
          <td><span class="lbl">FATURA / CONDIÇÃO DE PAGAMENTO</span><span class="val">${escapeHtml(nota.condicaoPagamento)}</span></td>
          <td><span class="lbl">VENCIMENTO</span><span class="val">${escapeHtml(formatDateBR(nota.dataVencimento || nota.dataEmissao))}</span></td>
          <td><span class="lbl">VALOR LÍQUIDO / TOTAL</span><span class="val tr bold">R$ ${formatBRLNumber(nota.valorTotal)}</span></td>
        </tr>
      </table>
    `;
  }

  const infoComplementaresPrint =
    (nota.informacoesComplementares || '').trim() ||
    (nota.nfseObservacoesFiscais || '').trim() ||
    buildDefaultInformacoesComplementares({
      tipoDocumento: nota.tipoDocumento,
      naturezaOperacao: nota.nfeNaturezaOperacao,
      nfeReferenciada: nota.nfeReferenciada,
      veiculoPlaca: nota.veiculoPlaca || nota.nfeTransportadoraPlaca,
      motoristaNome: nota.motoristaNome,
      ativosImobilizados: itemsList.map((i) => i.fleetAssetLabel).filter((v): v is string => Boolean(v)),
    });

  const refTrimmed = (nota.nfeReferenciada || '').trim();
  const refDigitsOnly = cleanDigits(refTrimmed);
  const refDanfeDisplay = refDigitsOnly.length === 44 ? refDigitsOnly : refTrimmed;

  const extraRefText =
    isDanfeRetorno && refDanfeDisplay && !infoComplementaresPrint.includes(`NFe Ref.: ${refDanfeDisplay}`)
      ? `\nNFe Ref.: ${refDanfeDisplay}`
      : isNfeOrNfce && refTrimmed && !infoComplementaresPrint.includes(refTrimmed)
        ? `\nNFe Ref.: ${refDanfeDisplay}`
        : '';

  const fullInfoComplementares = `${infoComplementaresPrint}${extraRefText}`.trim();

  const reservadoFiscoPrint = (nota.reservadoFisco || '').trim();

  const partiesSectionHtml = isCte
    ? (() => {
        const remNome =
          nota.cteRemetenteNome ||
          (nota.cteRemetenteIsEmpresaPropria ? corporateName : '') ||
          nota.destinatarioNome ||
          '-';
        const remCpfCnpj =
          nota.cteRemetenteCpfCnpj ||
          (nota.cteRemetenteIsEmpresaPropria ? companyCnpj : '') ||
          'NÃO INFORMADO';
        const remIe =
          nota.cteRemetenteIe ||
          (nota.cteRemetenteIsEmpresaPropria ? companyIe : '') ||
          'ISENTO';
        const remEndereco =
          nota.cteRemetenteEndereco ||
          (nota.cteRemetenteIsEmpresaPropria
            ? [companyStreet, companyNeighborhood].filter(Boolean).join(' - ').toUpperCase()
            : '') ||
          '-';
        const remCidadeUf =
          nota.cteRemetenteCidadeUf ||
          (nota.cteRemetenteIsEmpresaPropria ? companyCityUf.toUpperCase() : '') ||
          '-';
        const { cidade: remCidade, uf: remUf } = splitCityUf(remCidadeUf);

        const tomadorTipoRaw = (nota.cteTomador || 'Remetente').toLowerCase();
        const isTomadorOutros = tomadorTipoRaw.includes('outro') || tomadorTipoRaw.includes('terceiro');
        const isTomadorDest = tomadorTipoRaw.includes('destinat');
        const tomadorModLabel = isTomadorOutros
          ? 'TOMADOR DO SERVIÇO: OUTROS / TERCEIRO (CONSIGNATÁRIO)'
          : isTomadorDest
            ? 'TOMADOR DO SERVIÇO: DESTINATÁRIO (FOB - PAGO NO DESTINO)'
            : 'TOMADOR DO SERVIÇO: REMETENTE (CIF - PAGO NA ORIGEM)';

        const tomNome =
          nota.cteTomadorFinalNome ||
          (isTomadorOutros
            ? (nota.cteTomadorTerceiroNome || '-')
            : isTomadorDest
              ? (nota.destinatarioNome || '-')
              : remNome);
        const tomCpfCnpj =
          nota.cteTomadorFinalCpfCnpj ||
          (isTomadorOutros
            ? (nota.cteTomadorTerceiroCpfCnpj || 'NÃO INFORMADO')
            : isTomadorDest
              ? (nota.destinatarioCpfCnpj || 'NÃO INFORMADO')
              : remCpfCnpj);
        const tomIe =
          nota.cteTomadorFinalIe ||
          (isTomadorOutros
            ? (nota.cteTomadorTerceiroIe || 'ISENTO')
            : isTomadorDest
              ? (nota.destinatarioIe || 'ISENTO')
              : remIe);
        const tomEndereco =
          nota.cteTomadorFinalEndereco ||
          (isTomadorOutros
            ? (nota.cteTomadorTerceiroEndereco || '-')
            : isTomadorDest
              ? (nota.destinatarioEndereco || '-')
              : remEndereco);
        const tomCidadeUf =
          nota.cteTomadorFinalCidadeUf ||
          (isTomadorOutros
            ? (nota.cteTomadorTerceiroCidadeUf || '-')
            : isTomadorDest
              ? (nota.destinatarioCidadeUf || '-')
              : remCidadeUf);
        const { cidade: tomCidade, uf: tomUf } = splitCityUf(tomCidadeUf);

        return `
          <div class="sec-title">1. REMETENTE (ORIGEM DA CARGA) &amp; 2. DESTINATÁRIO (DESTINO DA CARGA)</div>
          <table class="sefaz-box-table">
            <colgroup>
              <col style="width:39%" />
              <col style="width:11%" />
              <col style="width:39%" />
              <col style="width:11%" />
            </colgroup>
            <tr>
              <td colspan="2" class="split-mid-right"><span class="lbl">1. REMETENTE — NOME / RAZÃO SOCIAL</span><span class="val">${escapeHtml(remNome)}</span></td>
              <td colspan="2"><span class="lbl">2. DESTINATÁRIO — NOME / RAZÃO SOCIAL</span><span class="val">${escapeHtml(nota.destinatarioNome)}</span></td>
            </tr>
            <tr>
              <td><span class="lbl">CNPJ / CPF (REMETENTE)</span><span class="val mono">${escapeHtml(remCpfCnpj)}</span></td>
              <td class="split-mid-right"><span class="lbl">IE</span><span class="val mono">${escapeHtml(remIe)}</span></td>
              <td><span class="lbl">CNPJ / CPF (DESTINATÁRIO)</span><span class="val mono">${escapeHtml(nota.destinatarioCpfCnpj || 'NÃO INFORMADO')}</span></td>
              <td><span class="lbl">IE</span><span class="val mono">${escapeHtml(nota.destinatarioIe || 'ISENTO')}</span></td>
            </tr>
            <tr>
              <td colspan="2" class="split-mid-right"><span class="lbl">ENDEREÇO (REMETENTE)</span><span class="val">${escapeHtml(remEndereco)}</span></td>
              <td colspan="2"><span class="lbl">ENDEREÇO (DESTINATÁRIO)</span><span class="val">${escapeHtml(nota.destinatarioEndereco || '-')}</span></td>
            </tr>
            <tr>
              <td><span class="lbl">MUNICÍPIO (REMETENTE)</span><span class="val">${escapeHtml(remCidade || remCidadeUf)}</span></td>
              <td class="split-mid-right"><span class="lbl">UF</span><span class="val tc">${escapeHtml(remUf || '-')}</span></td>
              <td><span class="lbl">MUNICÍPIO (DESTINATÁRIO)</span><span class="val">${escapeHtml(destCidade || nota.destinatarioCidadeUf || '-')}</span></td>
              <td><span class="lbl">UF</span><span class="val tc">${escapeHtml(destUf || '-')}</span></td>
            </tr>
          </table>

          <div class="sec-title">3. ${escapeHtml(tomadorModLabel)} — PAGADOR DO FRETE</div>
          <table class="sefaz-box-table">
            <colgroup><col style="width:44%" /><col style="width:22%" /><col style="width:18%" /><col style="width:16%" /></colgroup>
            <tr>
              <td><span class="lbl">NOME / RAZÃO SOCIAL DO TOMADOR</span><span class="val">${escapeHtml(tomNome)}</span></td>
              <td><span class="lbl">CNPJ / CPF</span><span class="val mono">${escapeHtml(tomCpfCnpj)}</span></td>
              <td><span class="lbl">INSCRIÇÃO ESTADUAL</span><span class="val mono">${escapeHtml(tomIe)}</span></td>
              <td><span class="lbl">DATA DA EMISSÃO</span><span class="val tc">${escapeHtml(formatDateBR(nota.dataEmissao))}</span></td>
            </tr>
          </table>
          <table class="sefaz-box-table no-top">
            <colgroup><col style="width:56%" /><col style="width:34%" /><col style="width:10%" /></colgroup>
            <tr>
              <td><span class="lbl">ENDEREÇO</span><span class="val">${escapeHtml(tomEndereco)}</span></td>
              <td><span class="lbl">MUNICÍPIO</span><span class="val">${escapeHtml(tomCidade || tomCidadeUf)}</span></td>
              <td><span class="lbl">UF</span><span class="val tc">${escapeHtml(tomUf || '-')}</span></td>
            </tr>
          </table>
        `;
      })()
    : `
      <div class="sec-title">DESTINATÁRIO / REMETENTE</div>
      <table class="sefaz-box-table">
        <colgroup><col style="width:55%" /><col style="width:27%" /><col style="width:18%" /></colgroup>
        <tr>
          <td><span class="lbl">NOME / RAZÃO SOCIAL</span><span class="val">${escapeHtml(nota.destinatarioNome)}</span></td>
          <td><span class="lbl">CNPJ / CPF</span><span class="val mono">${escapeHtml(nota.destinatarioCpfCnpj || 'NÃO INFORMADO')}</span></td>
          <td><span class="lbl">DATA DA EMISSÃO</span><span class="val tc">${escapeHtml(formatDateBR(nota.dataEmissao))}</span></td>
        </tr>
      </table>
      <table class="sefaz-box-table no-top">
        <colgroup><col style="width:48%" /><col style="width:20%" /><col style="width:14%" /><col style="width:18%" /></colgroup>
        <tr>
          <td><span class="lbl">ENDEREÇO</span><span class="val">${escapeHtml(nota.destinatarioEndereco || '-')}</span></td>
          <td><span class="lbl">BAIRRO / DISTRITO</span><span class="val">-</span></td>
          <td><span class="lbl">CEP</span><span class="val mono">-</span></td>
          <td><span class="lbl">DATA DE SAÍDA / ENTRADA</span><span class="val tc">${escapeHtml(formatDateBR(nota.dataEmissao))}</span></td>
        </tr>
      </table>
      <table class="sefaz-box-table no-top">
        <colgroup><col style="width:42%" /><col style="width:20%" /><col style="width:8%" /><col style="width:30%" /></colgroup>
        <tr>
          <td><span class="lbl">MUNICÍPIO</span><span class="val">${escapeHtml(destCidade || nota.destinatarioCidadeUf || '-')}</span></td>
          <td><span class="lbl">FONE / FAX</span><span class="val mono">-</span></td>
          <td><span class="lbl">UF</span><span class="val tc">${escapeHtml(destUf || '-')}</span></td>
          <td><span class="lbl">INSCRIÇÃO ESTADUAL</span><span class="val mono">${escapeHtml(nota.destinatarioIe || 'ISENTO')}</span></td>
        </tr>
      </table>
    `;

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(docMeta.tituloCentro)} (${escapeHtml(docMeta.sigla)}) Nº ${escapeHtml(numeroFormatado)} - ${escapeHtml(corporateName)}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 0mm;
          }
          @media print {
            html, body {
              width: 100%;
              min-height: 297mm;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .sefaz-sheet {
              width: 210mm;
              min-height: 297mm;
              height: 297mm;
              margin: 0 auto !important;
              padding: 8mm 8mm !important;
              box-sizing: border-box;
              overflow: hidden;
              box-shadow: none !important;
            }
            .no-print { display: none !important; }
          }
          * { box-sizing: border-box; }
          html, body {
            width: 100%;
            margin: 0;
            padding: 0;
          }
          body {
            font-family: Arial, Helvetica, sans-serif;
            color: #000000;
            background: #e5e7eb;
            padding: 6mm 0 10mm 0;
            text-transform: uppercase;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .sefaz-sheet {
            width: 210mm;
            min-height: 297mm;
            height: 297mm;
            margin: 0 auto;
            padding: 8mm 8mm;
            box-sizing: border-box;
            background: #ffffff;
            box-shadow: 0 4px 18px rgba(0, 0, 0, 0.16);
            display: flex;
            flex-direction: column;
          }
          .sefaz-top-fixed {
            width: 100%;
            max-width: 100%;
            box-sizing: border-box;
            flex-shrink: 0;
          }
          .sefaz-middle-expand {
            width: 100%;
            max-width: 100%;
            box-sizing: border-box;
            flex: 1;
            display: flex;
            flex-direction: column;
            min-height: 0;
          }
          .sefaz-table-stretch-wrap {
            position: relative;
            overflow: hidden;
            width: 100%;
            max-width: 100%;
            box-sizing: border-box;
            flex: 1;
            display: flex;
            flex-direction: column;
            min-height: 0;
            border: 1px solid #000000;
          }
          .homologacao-banner {
            width: 100%;
            margin-top: -1px;
            padding: 2.5px 6px;
            border: 1px solid #000000;
            background: #fef2f2;
            color: #991b1b;
            text-align: center;
            font-size: 7.4pt;
            font-weight: 900;
            letter-spacing: 0.6px;
            line-height: 1.15;
          }
          .homologacao-watermark {
            position: absolute;
            top: 52%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-16deg);
            width: 120%;
            text-align: center;
            font-size: 13pt;
            font-weight: 900;
            letter-spacing: 0.8px;
            color: rgba(185, 28, 28, 0.16);
            pointer-events: none;
            user-select: none;
            z-index: 2;
            white-space: nowrap;
          }
          .homologacao-info-line {
            font-size: 6.8pt;
            font-weight: 900;
            color: #991b1b;
            letter-spacing: 0.3px;
            margin-bottom: 2px;
          }
          .sefaz-col-guides {
            flex: 1;
            display: flex;
            align-items: stretch;
            width: 100%;
            max-width: 100%;
            box-sizing: border-box;
            min-height: 6mm;
          }
          .sefaz-bottom-fixed {
            width: 100%;
            max-width: 100%;
            box-sizing: border-box;
            margin-top: auto;
            flex-shrink: 0;
          }
          /* QUADROS FIXOS NIVELADOS (TABLE-LAYOUT: FIXED) */
          table.sefaz-box-table {
            table-layout: fixed;
            width: 100%;
            max-width: 100%;
            box-sizing: border-box;
            border-collapse: collapse;
          }
          table.sefaz-box-table.no-top {
            margin-top: -1px;
          }
          table.sefaz-box-table td,
          table.sefaz-box-table th {
            border: 1px solid #000000;
            padding: 2.5px 4px;
            vertical-align: top;
            overflow: hidden;
          }
          .split-mid-right {
            border-right: 1.5px solid #000000 !important;
          }
          .highlight-cell {
            background: #f5f5f5;
          }
          .cut-line {
            border-bottom: 1px dashed #000000;
            margin: 2.5mm 0;
          }
          /* CABEÇALHO 3 COLUNAS */
          .hdr-emitente-wrap {
            display: flex;
            align-items: flex-start;
            gap: 6px;
          }
          .hdr-logo {
            max-width: 58px;
            max-height: 54px;
            object-fit: contain;
            border: 1px solid #000000;
            padding: 2px;
            background: #ffffff;
            flex-shrink: 0;
          }
          .hdr-title {
            font-size: 13pt;
            font-weight: 900;
            letter-spacing: 0.5px;
            line-height: 1.05;
          }
          .hdr-subtitle {
            font-size: 6pt;
            font-weight: 700;
            line-height: 1.15;
            margin: 2px 0;
          }
          .tipo-op-box {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
            margin: 2px auto;
            font-size: 6.2pt;
            font-weight: 700;
          }
          .tipo-op-num {
            border: 1px solid #000000;
            padding: 1px 6px;
            font-size: 9pt;
            font-weight: 900;
          }
          .sec-title {
            font-size: 6.5pt;
            font-weight: 900;
            letter-spacing: 0.3px;
            margin: 3.5px 0 1px 0;
            line-height: 1.1;
          }
          .lbl {
            display: block;
            font-size: 6pt;
            font-weight: 700;
            line-height: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            margin-bottom: 2px;
            color: #000000;
          }
          .val {
            display: block;
            font-size: 8.5pt;
            font-weight: bold;
            line-height: 1.15;
            color: #000000;
            word-break: break-word;
          }
          .bold-lg {
            font-size: 9pt;
            font-weight: 900;
          }
          .mono { font-family: "Courier New", Courier, monospace; }
          .bold { font-weight: 700; }
          .tc { text-align: center; }
          .tr { text-align: right; }
          /* TABELA CENTRAL DE ITENS / DOCUMENTOS */
          table.sefaz-table {
            position: relative;
            z-index: 1;
            table-layout: fixed;
            width: 100%;
            max-width: 100%;
            box-sizing: border-box;
            border-collapse: collapse;
            border: none;
          }
          table.sefaz-table th {
            border-bottom: 1px solid #000000;
            border-left: 1px solid #000000;
            border-top: none;
            border-right: none;
            padding: 2.5px 3px;
            font-size: 6pt;
            font-weight: 900;
            line-height: 1.1;
            background: #ffffff;
            text-align: center;
            overflow: hidden;
          }
          table.sefaz-table th:first-child,
          table.sefaz-table td:first-child {
            border-left: none;
          }
          table.sefaz-table tr.sefaz-data-row td {
            border-left: 1px solid #000000;
            border-bottom: 1px solid #cfcfcf;
            border-top: none;
            border-right: none;
            padding: 2.5px 3px;
            font-size: 7.5pt;
            line-height: 1.2;
            vertical-align: top;
            overflow: hidden;
            word-break: break-word;
          }
          table.sefaz-table tr.sefaz-data-row td:first-child {
            border-left: none;
          }
          /* DADOS ADICIONAIS RODAPÉ */
          .da-cell {
            height: 54px;
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom:8px;display:flex;justify-content:flex-end;gap:8px;width:210mm;margin-left:auto;margin-right:auto;">
          <button onclick="window.focus();window.print()" style="padding:6px 14px;background:#111827;color:#fff;border:1px solid #000;border-radius:4px;font-weight:800;cursor:pointer;font-size:11px;">IMPRIMIR / SALVAR PDF</button>
          <button onclick="window.close()" style="padding:6px 14px;background:#f3f4f6;color:#000;border:1px solid #000;border-radius:4px;font-weight:800;cursor:pointer;font-size:11px;">FECHAR</button>
        </div>

        <div class="sefaz-sheet">
          <div class="sefaz-top-fixed">
            <!-- 1. CANHOTO DESTACÁVEL NO TOPO -->
            <table class="sefaz-box-table">
              <colgroup><col style="width:22%" /><col style="width:60%" /><col style="width:18%" /></colgroup>
              <tr>
                <td colspan="2" style="padding:3px 5px;font-size:6.5pt;line-height:1.25;">
                  RECEBEMOS DE <strong>${escapeHtml(corporateName)}</strong> OS PRODUTOS / SERVIÇOS CONSTANTES NO DOCUMENTO AUXILIAR INDICADO AO LADO
                </td>
                <td rowspan="2" style="text-align:center;vertical-align:middle;padding:4px;">
                  <div style="font-size:9pt;font-weight:900;line-height:1.1;">${escapeHtml(docMeta.sigla)}</div>
                  <div style="font-size:8pt;font-weight:900;line-height:1.15;">Nº ${escapeHtml(numeroFormatado)}</div>
                  <div style="font-size:7pt;font-weight:700;line-height:1.1;">SÉRIE ${escapeHtml(serieFormatada)}</div>
                </td>
              </tr>
              <tr>
                <td style="height:24px;"><span class="lbl">DATA DE RECEBIMENTO</span><span class="val">&nbsp;</span></td>
                <td style="height:24px;"><span class="lbl">IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR</span><span class="val">&nbsp;</span></td>
              </tr>
            </table>

            <div class="cut-line"></div>

            <!-- 2. CABEÇALHO OFICIAL SEFAZ EM 3 COLUNAS -->
            <table class="sefaz-box-table">
              <colgroup><col style="width:42%" /><col style="width:20%" /><col style="width:38%" /></colgroup>
              <tr>
                <td rowspan="3" style="padding:4px 6px;vertical-align:top;">
                  <div class="hdr-emitente-wrap">
                    ${logoUrl ? `<img class="hdr-logo" src="${escapeHtml(logoUrl)}" alt="Logo Emitente" />` : ''}
                    <div style="flex:1;min-width:0;">
                      <span class="lbl">IDENTIFICAÇÃO DO EMITENTE</span>
                      <div style="font-size:8.5pt;font-weight:900;line-height:1.15;word-break:break-word;">${escapeHtml(corporateName)}</div>
                      ${corporateName.trim().toUpperCase() !== tradeName.trim().toUpperCase() ? `<div style="font-size:7pt;font-weight:700;line-height:1.15;">FANTASIA: ${escapeHtml(tradeName)}</div>` : ''}
                      <div style="font-size:7pt;line-height:1.2;margin-top:2px;word-break:break-word;">
                        ${escapeHtml(companyStreet || 'ENDEREÇO NÃO INFORMADO')}<br/>
                        ${companyNeighborhood ? `BAIRRO: ${escapeHtml(companyNeighborhood)} • ` : ''}${companyCep ? `CEP: ${escapeHtml(companyCep)}` : ''}<br/>
                        ${escapeHtml(companyCityUf)}${companyPhone ? ` • FONE: ${escapeHtml(companyPhone)}` : ''}
                      </div>
                    </div>
                  </div>
                </td>
                <td rowspan="3" style="padding:4px 5px;text-align:center;vertical-align:middle;">
                  <div class="hdr-title">${escapeHtml(docMeta.tituloCentro)}</div>
                  <div class="hdr-subtitle">${escapeHtml(docMeta.subtituloCentro)}</div>
                  <div class="tipo-op-box">
                    <div style="text-align:left;line-height:1.15;">0 - ENTRADA<br/>1 - SAÍDA</div>
                    <div class="tipo-op-num">${tipoOperacaoDanfe}</div>
                  </div>
                  <div style="line-height:1.18;margin-top:2px;">
                    <div style="font-size:8.5pt;font-weight:900;">Nº ${escapeHtml(numeroFormatado)}</div>
                    <div style="font-size:7.5pt;font-weight:800;">SÉRIE ${escapeHtml(serieFormatada)}</div>
                    <div style="font-size:6.5pt;font-weight:700;">FOLHA 1/1</div>
                  </div>
                </td>
                <td style="padding:4px 7px 3px 7px;">
                  ${barcodeSvg}
                </td>
              </tr>
              <tr>
                <td style="padding:2.5px 5px;">
                  <span class="lbl">CHAVE DE ACESSO</span>
                  <span class="val mono tc" style="font-size:7.2pt;letter-spacing:0.15px;">${escapeHtml(chaveFormatada)}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:2.5px 5px;font-size:5.8pt;line-height:1.2;text-align:center;vertical-align:middle;">
                  ${escapeHtml(docMeta.portalConsulta)}
                </td>
              </tr>
            </table>

            ${isHomologacao ? `<div class="homologacao-banner">${OFFICIAL_HOMOLOGACAO_NOTICE}</div>` : ''}

            <!-- 3. FAIXA NATUREZA DA OPERAÇÃO / CFOP / PROTOCOLO / IE / CNPJ -->
            <table class="sefaz-box-table no-top">
              <colgroup><col style="width:48%" /><col style="width:12%" /><col style="width:40%" /></colgroup>
              <tr>
                <td><span class="lbl">NATUREZA DA OPERAÇÃO</span><span class="val">${escapeHtml(naturezaOperacaoText)}</span></td>
                <td><span class="lbl">CFOP</span><span class="val mono tc">${escapeHtml(cfopPrincipal)}</span></td>
                <td><span class="lbl">PROTOCOLO DE AUTORIZAÇÃO DE USO</span><span class="val mono" style="font-size:7.2pt;">${escapeHtml(protocoloUso)}</span></td>
              </tr>
            </table>
            <table class="sefaz-box-table no-top">
              <colgroup><col style="width:34%" /><col style="width:33%" /><col style="width:33%" /></colgroup>
              <tr>
                <td><span class="lbl">INSCRIÇÃO ESTADUAL</span><span class="val mono">${escapeHtml(companyIe)}</span></td>
                <td><span class="lbl">INSC. ESTADUAL DO SUBST. TRIB.</span><span class="val mono">${escapeHtml(companyIeSt || '-')}</span></td>
                <td><span class="lbl">CNPJ DO EMITENTE</span><span class="val mono">${escapeHtml(companyCnpj)}</span></td>
              </tr>
            </table>

            <!-- 4. REMETENTE / DESTINATÁRIO / TOMADOR -->
            ${partiesSectionHtml}

            <!-- 5A. TOPO ESPECÍFICO DO DOCUMENTO -->
            ${specificTopHtml}
          </div>

          <!-- 5B. MIOLO EXPANSÍVEL (OCUPA 100% DO ESPAÇO LIVRE CENTRAL COM COLUNAS CONTÍNUAS) -->
          <div class="sefaz-middle-expand">
            ${specificMiddleHtml}
          </div>

          <!-- 6. RODAPÉ FIXO NA BASE DA FOLHA A4: TOTAIS / IMPOSTOS + DADOS ADICIONAIS -->
          <div class="sefaz-bottom-fixed">
            ${specificBottomTotalsHtml}

            <div class="sec-title">DADOS ADICIONAIS</div>
            <table class="sefaz-box-table">
              <colgroup><col style="width:65%" /><col style="width:35%" /></colgroup>
              <tr>
                <td class="da-cell">
                  <span class="lbl">INFORMAÇÕES COMPLEMENTARES</span>
                  ${isHomologacao ? `<div class="homologacao-info-line">${OFFICIAL_HOMOLOGACAO_NOTICE}</div>` : ''}
                  <div style="font-size:7pt;font-weight:600;line-height:1.3;white-space:pre-line;word-break:break-word;">${escapeHtml(fullInfoComplementares)}</div>
                </td>
                <td class="da-cell">
                  <span class="lbl">RESERVADO AO FISCO</span>
                  ${reservadoFiscoPrint ? `<div style="font-size:6.8pt;font-family:'Courier New',Courier,monospace;font-weight:700;line-height:1.3;white-space:pre-line;word-break:break-word;">${escapeHtml(reservadoFiscoPrint)}</div>` : ''}
                </td>
              </tr>
            </table>

            <div style="margin-top:2.5px;display:flex;justify-content:space-between;font-size:6pt;font-weight:700;line-height:1;">
              <span>AGROCONTROL • DOCUMENTO AUXILIAR PADRÃO SEFAZ</span>
              <span>IMPRESSO EM: ${escapeHtml(new Date().toLocaleString('pt-BR'))}</span>
            </div>
          </div>
        </div>

        <script>
          (function () {
            var didPrint = false;
            function triggerPrint() {
              if (didPrint) return;
              didPrint = true;
              setTimeout(function () {
                try {
                  window.focus();
                  window.print();
                } catch (e) {
                  console.error('Erro ao acionar impressão:', e);
                }
              }, 250);
            }
            window.onload = triggerPrint;
            if (document.readyState === 'complete') {
              triggerPrint();
            }
          })();
        </script>
      </body>
    </html>
  `;
}

function triggerHiddenIframePrint(html: string): boolean {
  try {
    let iframe = document.getElementById('nota-saida-print-iframe') as HTMLIFrameElement | null;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'nota-saida-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);
    }
    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) return false;
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      try {
        iframe?.contentWindow?.focus();
        iframe?.contentWindow?.print();
      } catch {
        // ignore if blocked by iframe sandbox
      }
    }, 300);
    return true;
  } catch {
    return false;
  }
}

function writeHtmlToPrintWindow(printWindow: Window, html: string): boolean {
  try {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    try {
      printWindow.focus();
    } catch {
      // ignore focus restrictions
    }
    return true;
  } catch (err) {
    console.warn('Erro ao escrever HTML na janela de impressão:', err);
    return false;
  }
}

export function openNotaSaidaPrintWindow(
  nota: NotaSaidaRecord,
  companyProfile?: CompanyProfile,
  onBlockedPopup?: () => void
): boolean {
  // 1. Abertura síncrona no clique para evitar bloqueio de pop-up
  let printWindow: Window | null = null;
  try {
    printWindow = window.open('', '_blank', 'width=950,height=800');
  } catch {
    printWindow = null;
  }

  const rawLogoRef = companyProfile?.logoUrl || COMPANY_LOGO_REF;
  const cachedLogo = getCachedMediaUrl(rawLogoRef);

  // 2. Caso a logo já esteja resolvida em memória (ou não seja IndexedDB), escreve sincronamente sem await
  if (cachedLogo || !isIndexedDbRef(rawLogoRef)) {
    const html = buildNotaSaidaHtml(nota, companyProfile, cachedLogo);
    if (printWindow && writeHtmlToPrintWindow(printWindow, html)) {
      return true;
    }

    // Fallback 1: Blob URL em nova guia
    try {
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      const blobWin = window.open(blobUrl, '_blank');
      if (blobWin) {
        try {
          blobWin.focus();
        } catch {
          // ignore
        }
        return true;
      }
    } catch {
      // continue to iframe fallback
    }

    // Fallback 2: Iframe oculto + callback para modal espelho
    const iframeStarted = triggerHiddenIframePrint(html);
    if (onBlockedPopup) onBlockedPopup();
    return iframeStarted;
  }

  // 3. Caso a logo ainda esteja no IndexedDB e não carregada no cache RAM, resolve com timeout curto
  const logoTimeout = new Promise<undefined>((resolve) => {
    setTimeout(() => resolve(undefined), 500);
  });

  Promise.race([
    resolveMediaUrlAsync(rawLogoRef).catch(() => undefined),
    logoTimeout,
  ]).then((resolvedLogo) => {
    const html = buildNotaSaidaHtml(nota, companyProfile, resolvedLogo);
    if (printWindow && !printWindow.closed && writeHtmlToPrintWindow(printWindow, html)) {
      return;
    }

    try {
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      const blobWin = window.open(blobUrl, '_blank');
      if (blobWin) {
        try {
          blobWin.focus();
        } catch {
          // ignore
        }
        return;
      }
    } catch {
      // continue to iframe fallback
    }

    triggerHiddenIframePrint(html);
    if (onBlockedPopup) onBlockedPopup();
  });

  return true;
}
