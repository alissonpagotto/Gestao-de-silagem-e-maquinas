import { BankAccount, Client, CompanyProfile } from '../types';
import { cleanDigits, formatCpfCnpj } from '../lib/formatters';
import { formatCurrencyBRL, formatDateBR } from '../lib/storage';
import { findBankByQuery } from '../components/financial/brazilianBanks';

export interface BoletoBankMeta {
  code: string;
  dv: string;
  codeWithDv: string;
  shortName: string;
  fullName: string;
  color: string;
  defaultCarteira: string;
  localPagamento: string;
}

const BOLETO_BANKS_BY_CODE: Record<string, BoletoBankMeta> = {
  '001': {
    code: '001',
    dv: '9',
    codeWithDv: '001-9',
    shortName: 'BANCO DO BRASIL',
    fullName: 'Banco do Brasil S.A.',
    color: '#003882',
    defaultCarteira: '17',
    localPagamento: 'PAGÁVEL EM QUALQUER BANCO ATÉ O VENCIMENTO',
  },
  '033': {
    code: '033',
    dv: '7',
    codeWithDv: '033-7',
    shortName: 'SANTANDER',
    fullName: 'Banco Santander (Brasil) S.A.',
    color: '#ea1d25',
    defaultCarteira: '101',
    localPagamento: 'PAGÁVEL PREFERENCIALMENTE NO BANCO SANTANDER',
  },
  '041': {
    code: '041',
    dv: '8',
    codeWithDv: '041-8',
    shortName: 'BANRISUL',
    fullName: 'Banco do Estado do Rio Grande do Sul S.A.',
    color: '#004f9f',
    defaultCarteira: '1',
    localPagamento: 'PAGÁVEL EM QUALQUER BANCO ATÉ O VENCIMENTO',
  },
  '077': {
    code: '077',
    dv: '9',
    codeWithDv: '077-9',
    shortName: 'BANCO INTER',
    fullName: 'Banco Inter S.A.',
    color: '#ff7a00',
    defaultCarteira: '112',
    localPagamento: 'PAGÁVEL EM QUALQUER BANCO ATÉ O VENCIMENTO',
  },
  '085': {
    code: '085',
    dv: '0',
    codeWithDv: '085-0',
    shortName: 'AILOS',
    fullName: 'Cooperativa Central de Crédito - Ailos',
    color: '#00857c',
    defaultCarteira: '1',
    localPagamento: 'PAGÁVEL PREFERENCIALMENTE NAS COOPERATIVAS DO SISTEMA AILOS',
  },
  '104': {
    code: '104',
    dv: '0',
    codeWithDv: '104-0',
    shortName: 'CAIXA',
    fullName: 'Caixa Econômica Federal',
    color: '#0066b3',
    defaultCarteira: 'RG',
    localPagamento: 'PREFERENCIALMENTE NAS CASAS LOTÉRICAS ATÉ O VALOR LIMITE',
  },
  '133': {
    code: '133',
    dv: '3',
    codeWithDv: '133-3',
    shortName: 'CRESOL',
    fullName: 'Sistema Cresol Cooperativas de Crédito',
    color: '#006837',
    defaultCarteira: '09',
    localPagamento: 'PAGÁVEL EM QUALQUER BANCO ATÉ O VENCIMENTO',
  },
  '136': {
    code: '136',
    dv: '8',
    codeWithDv: '136-8',
    shortName: 'UNICRED',
    fullName: 'Unicred do Brasil',
    color: '#005544',
    defaultCarteira: '21',
    localPagamento: 'PAGÁVEL EM QUALQUER BANCO ATÉ O VENCIMENTO',
  },
  '237': {
    code: '237',
    dv: '2',
    codeWithDv: '237-2',
    shortName: 'BRADESCO',
    fullName: 'Banco Bradesco S.A.',
    color: '#cc092f',
    defaultCarteira: '09',
    localPagamento: 'PAGÁVEL PREFERENCIALMENTE NA REDE BRADESCO OU BRADESCO EXPRESSO',
  },
  '260': {
    code: '260',
    dv: '4',
    codeWithDv: '260-4',
    shortName: 'NUBANK',
    fullName: 'Nu Pagamentos S.A.',
    color: '#820ad1',
    defaultCarteira: '1',
    localPagamento: 'PAGÁVEL EM QUALQUER BANCO ATÉ O VENCIMENTO',
  },
  '341': {
    code: '341',
    dv: '7',
    codeWithDv: '341-7',
    shortName: 'ITAÚ',
    fullName: 'Itaú Unibanco S.A.',
    color: '#ec7000',
    defaultCarteira: '109',
    localPagamento: 'ATÉ O VENCIMENTO PAGUE PREFERENCIALMENTE NO ITAÚ',
  },
  '422': {
    code: '422',
    dv: '7',
    codeWithDv: '422-7',
    shortName: 'SAFRA',
    fullName: 'Banco Safra S.A.',
    color: '#b99b58',
    defaultCarteira: '1',
    localPagamento: 'PAGÁVEL EM QUALQUER BANCO ATÉ O VENCIMENTO',
  },
  '748': {
    code: '748',
    dv: 'X',
    codeWithDv: '748-X',
    shortName: 'SICREDI',
    fullName: 'Banco Cooperativo Sicredi S.A.',
    color: '#00843d',
    defaultCarteira: '1',
    localPagamento: 'PAGÁVEL PREFERENCIALMENTE NAS COOPERATIVAS DE CRÉDITO DO SICREDI',
  },
  '756': {
    code: '756',
    dv: '0',
    codeWithDv: '756-0',
    shortName: 'SICOOB',
    fullName: 'Banco Cooperativo Sicoob S.A.',
    color: '#003641',
    defaultCarteira: '1',
    localPagamento: 'PAGÁVEL EM QUALQUER BANCO ATÉ O VENCIMENTO',
  },
};

export function resolveBoletoBankMeta(account?: BankAccount | null): BoletoBankMeta {
  const rawCode = cleanDigits(account?.bankCode || '');
  const normalizedCode = rawCode === '074' ? '748' : rawCode.slice(0, 3).padStart(3, '0');
  if (rawCode && BOLETO_BANKS_BY_CODE[normalizedCode]) {
    return BOLETO_BANKS_BY_CODE[normalizedCode];
  }

  const matchedBank = findBankByQuery(account?.bankName || account?.name, account?.bankCode);
  if (matchedBank && BOLETO_BANKS_BY_CODE[matchedBank.code]) {
    return BOLETO_BANKS_BY_CODE[matchedBank.code];
  }

  if (matchedBank) {
    return {
      code: matchedBank.code,
      dv: '0',
      codeWithDv: `${matchedBank.code}-0`,
      shortName: matchedBank.shortName.toUpperCase(),
      fullName: matchedBank.name,
      color: matchedBank.color,
      defaultCarteira: '109',
      localPagamento: 'PAGÁVEL EM QUALQUER BANCO ATÉ O VENCIMENTO',
    };
  }

  return BOLETO_BANKS_BY_CODE['748'];
}

export function formatBoletoCurrencyValue(value: number): string {
  const num = Number(value) || 0;
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function addDaysIsoDate(baseIso: string, days: number): string {
  const safeDays = Math.trunc(Number(days) || 0);
  const match = (baseIso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  const baseUtc = match
    ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : Date.now();
  const target = new Date(baseUtc + safeDays * 86400000);
  const y = target.getUTCFullYear();
  const m = String(target.getUTCMonth() + 1).padStart(2, '0');
  const d = String(target.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function computeFebrabanDueFactor(dueDateStr: string): string {
  if (!dueDateStr) return '0000';
  const match = dueDateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '0000';
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const targetUtc = Date.UTC(year, month - 1, day);
  const baseUtc = Date.UTC(1997, 9, 7); // 1997-10-07
  const diffDays = Math.floor((targetUtc - baseUtc) / 86400000);
  if (diffDays <= 0) return '0000';
  // Ciclo FEBRABAN após 22/02/2025 (10000 -> reinicia em 1000)
  const factor = diffDays >= 10000 ? 1000 + ((diffDays - 10000) % 9000) : diffDays;
  return String(Math.max(0, factor)).padStart(4, '0').slice(-4);
}

export function calcModulo10(numStr: string): string {
  const digits = cleanDigits(numStr);
  let sum = 0;
  let weight = 2;
  for (let i = digits.length - 1; i >= 0; i--) {
    let prod = Number(digits[i]) * weight;
    if (prod > 9) prod = Math.floor(prod / 10) + (prod % 10);
    sum += prod;
    weight = weight === 2 ? 1 : 2;
  }
  const rem = sum % 10;
  return rem === 0 ? '0' : String(10 - rem);
}

export function calcModulo11Barcode(numStr43: string): string {
  const digits = cleanDigits(numStr43);
  let sum = 0;
  let weight = 2;
  for (let i = digits.length - 1; i >= 0; i--) {
    sum += Number(digits[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const rem = sum % 11;
  const dv = 11 - rem;
  if (dv === 0 || dv === 10 || dv === 11) return '1';
  return String(dv);
}

export interface FebrabanBoletoCalcParams {
  bankCode: string;
  agency?: string;
  accountNumber?: string;
  carteira?: string;
  nossoNumero: string;
  dueDate: string;
  amount: number;
}

export interface FebrabanBoletoCalculated {
  barcode: string; // 44 digits
  linhaDigitavel: string; // formatted 47 digits
  linhaDigitavelDigits: string; // raw 47 digits
  fatorVencimento: string;
  valorCodigoBarras: string;
  dacGeral: string;
  nossoNumeroFormatted: string;
  agenciaCodigoCedente: string;
}

export function calculateFebrabanBoletoData(
  params: FebrabanBoletoCalcParams
): FebrabanBoletoCalculated {
  const bankDigits = cleanDigits(params.bankCode || '748')
    .padStart(3, '0')
    .slice(0, 3);
  const moeda = '9'; // Real
  const fatorVencimento = computeFebrabanDueFactor(params.dueDate);
  const cents = Math.max(0, Math.round((Number(params.amount) || 0) * 100));
  const valorCodigoBarras = String(cents).padStart(10, '0').slice(-10);

  const carteiraDigits = cleanDigits(params.carteira || '109')
    .padStart(3, '0')
    .slice(-3);
  const agenciaDigits = cleanDigits(params.agency || '0001')
    .padStart(4, '0')
    .slice(-4);
  const contaDigits = cleanDigits(params.accountNumber || '000001')
    .padStart(7, '0')
    .slice(-7);
  const nossoDigits = cleanDigits(params.nossoNumero || '1')
    .padStart(10, '0')
    .slice(-10);

  // Campo Livre de exatamente 25 posições (Carteira 3 + Nosso Número 10 + Agência 4 + Conta 7 + DAC 1)
  const base24 = `${carteiraDigits}${nossoDigits}${agenciaDigits}${contaDigits}`;
  const campoLivreDac = calcModulo10(base24);
  const campoLivre = `${base24}${campoLivreDac}`.slice(0, 25);

  const barcode43 = `${bankDigits}${moeda}${fatorVencimento}${valorCodigoBarras}${campoLivre}`;
  const dacGeral = calcModulo11Barcode(barcode43);
  const barcode = `${bankDigits}${moeda}${dacGeral}${fatorVencimento}${valorCodigoBarras}${campoLivre}`;

  // Campos da Linha Digitável FEBRABAN (47 dígitos)
  const campo1Base = `${bankDigits}${moeda}${campoLivre.slice(0, 5)}`;
  const campo1Dv = calcModulo10(campo1Base);
  const campo1 = `${campo1Base.slice(0, 5)}.${campo1Base.slice(5)}${campo1Dv}`;

  const campo2Base = campoLivre.slice(5, 15);
  const campo2Dv = calcModulo10(campo2Base);
  const campo2 = `${campo2Base.slice(0, 5)}.${campo2Base.slice(5)}${campo2Dv}`;

  const campo3Base = campoLivre.slice(15, 25);
  const campo3Dv = calcModulo10(campo3Base);
  const campo3 = `${campo3Base.slice(0, 5)}.${campo3Base.slice(5)}${campo3Dv}`;

  const campo4 = dacGeral;
  const campo5 = `${fatorVencimento}${valorCodigoBarras}`;

  const linhaDigitavel = `${campo1} ${campo2} ${campo3} ${campo4} ${campo5}`;
  const linhaDigitavelDigits = cleanDigits(linhaDigitavel);

  const rawAcc = (params.accountNumber || '00000-0').trim();
  const formattedAcc = rawAcc.includes('-')
    ? rawAcc
    : rawAcc.length > 1
    ? `${rawAcc.slice(0, -1)}-${rawAcc.slice(-1)}`
    : rawAcc;
  const agenciaCodigoCedente = `${agenciaDigits} / ${formattedAcc}`;
  const nnClean = cleanDigits(params.nossoNumero || '00000001').padStart(8, '0').slice(-9);
  const nossoNumeroFormatted = `${nnClean.slice(0, -1)}-${nnClean.slice(-1)}`;

  return {
    barcode,
    linhaDigitavel,
    linhaDigitavelDigits,
    fatorVencimento,
    valorCodigoBarras,
    dacGeral,
    nossoNumeroFormatted,
    agenciaCodigoCedente,
  };
}

// ============================================================================
// INTERLEAVED 2 OF 5 (ITF-25) VECTOR BARCODE GENERATOR (PADRÃO FEBRABAN)
// ============================================================================
const I2OF5_PATTERNS: Record<string, string> = {
  '0': '00110',
  '1': '10001',
  '2': '01001',
  '3': '11000',
  '4': '00101',
  '5': '10100',
  '6': '01100',
  '7': '00011',
  '8': '10010',
  '9': '01010',
};

export interface I2of5BarRect {
  x: number;
  width: number;
}

export interface I2of5BarcodeLayout {
  viewBoxWidth: number;
  height: number;
  bars: I2of5BarRect[];
}

export function generateI2of5BarcodeLayout(rawDigits: string): I2of5BarcodeLayout {
  let digits = cleanDigits(rawDigits);
  if (digits.length % 2 !== 0) {
    digits = `0${digits}`;
  }
  if (!digits) {
    digits = '0'.repeat(44);
  }

  const NARROW = 2;
  const WIDE = 5;
  const HEIGHT = 56;
  const QUIET = 12;

  let x = QUIET;
  const bars: I2of5BarRect[] = [];

  // Start pattern: Narrow Bar, Narrow Space, Narrow Bar, Narrow Space
  bars.push({ x, width: NARROW });
  x += NARROW + NARROW;
  bars.push({ x, width: NARROW });
  x += NARROW + NARROW;

  for (let i = 0; i < digits.length; i += 2) {
    const p1 = I2OF5_PATTERNS[digits[i]] || I2OF5_PATTERNS['0'];
    const p2 = I2OF5_PATTERNS[digits[i + 1]] || I2OF5_PATTERNS['0'];
    for (let j = 0; j < 5; j++) {
      const barW = p1[j] === '1' ? WIDE : NARROW;
      const spaceW = p2[j] === '1' ? WIDE : NARROW;
      bars.push({ x, width: barW });
      x += barW + spaceW;
    }
  }

  // Stop pattern: Wide Bar, Narrow Space, Narrow Bar
  bars.push({ x, width: WIDE });
  x += WIDE + NARROW;
  bars.push({ x, width: NARROW });
  x += NARROW;

  return {
    viewBoxWidth: x + QUIET,
    height: HEIGHT,
    bars,
  };
}

export function generateI2of5SvgString(rawDigits: string, heightPx = 54): string {
  const layout = generateI2of5BarcodeLayout(rawDigits);
  const rects = layout.bars
    .map(
      (b) =>
        `<rect x="${b.x}" y="0" width="${b.width}" height="${layout.height}" fill="#000000" />`
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.viewBoxWidth} ${layout.height}" width="100%" height="${heightPx}" preserveAspectRatio="none" style="display:block;">${rects}</svg>`;
}

export interface BoletoDocumentInput {
  bankMeta: BoletoBankMeta;
  agenciaCodigoCedente: string;
  beneficiarioNome: string;
  beneficiarioCnpj: string;
  beneficiarioEndereco: string;
  pagadorNome: string;
  pagadorDocumento: string;
  pagadorEndereco: string;
  nossoNumero: string;
  numeroDocumento: string;
  especieDoc: string;
  aceite: 'N' | 'S';
  carteira: string;
  dataDocumento: string; // YYYY-MM-DD
  dataVencimento: string; // YYYY-MM-DD
  valorDocumento: number;
  valorDesconto: number;
  descontoCondicao?: 'ate_vencimento' | 'antecipado_data' | 'abatimento_direto';
  multaPercent: number;
  jurosDiaPercent: number;
  instrucoes: string;
  demonstrativoParcela?: string;
  linhaDigitavel: string;
  barcode: string;
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

export function formatCompanyFullAddress(company?: CompanyProfile | null): string {
  if (!company) return '';
  const parts: string[] = [];
  if (company.address) {
    parts.push(`${company.address}${company.number ? `, ${company.number}` : ''}`);
  }
  if (company.neighborhood) parts.push(company.neighborhood);
  const cityState = [company.city, company.state].filter(Boolean).join(' / ');
  if (cityState) parts.push(cityState);
  const cep = company.zipCode || company.cep;
  if (cep) parts.push(`CEP: ${cep}`);
  return parts.join(' - ');
}

export function formatClientFullAddress(client?: Client | null): string {
  if (!client) return 'Endereço não cadastrado';
  const parts: string[] = [];
  if (client.address) {
    parts.push(
      `${client.address}${client.addressNumber ? `, ${client.addressNumber}` : ''}${
        client.addressComplement ? ` (${client.addressComplement})` : ''
      }`
    );
  } else if (client.farmName) {
    parts.push(`Fazenda / Propriedade: ${client.farmName}`);
  }
  if (client.neighborhood) parts.push(client.neighborhood);
  const cityState = [client.city || client.cidade, client.state || client.estado]
    .filter(Boolean)
    .join(' / ');
  if (cityState) parts.push(cityState);
  if (client.zipCode) parts.push(`CEP: ${client.zipCode}`);
  return parts.filter(Boolean).join(' - ') || 'Endereço não cadastrado';
}

export function generateNextNossoNumero(seed?: string | number): string {
  const digits = cleanDigits(String(seed || ''));
  const suffix = digits.slice(-4).padStart(4, '0');
  const now = new Date();
  const year2 = String(now.getFullYear()).slice(-2);
  const month2 = String(now.getMonth() + 1).padStart(2, '0');
  const rand2 = String(Math.floor(10 + Math.random() * 89));
  return `${year2}${month2}${suffix}${rand2}`.slice(0, 10);
}

export function incrementNossoNumero(baseNossoNumero: string, offset: number): string {
  const digits = cleanDigits(baseNossoNumero || '') || '00000001';
  const safeOffset = Math.max(0, Math.trunc(Number(offset) || 0));
  if (safeOffset === 0) return digits;
  const targetLen = Math.max(digits.length, 8);
  try {
    const nextVal = BigInt(digits) + BigInt(safeOffset);
    return nextVal.toString().padStart(targetLen, '0').slice(-Math.max(targetLen, 10));
  } catch {
    const num = (parseInt(digits.slice(-9), 10) || 1) + safeOffset;
    return String(num).padStart(targetLen, '0');
  }
}

function buildBoletoSheetInnerHtml(doc: BoletoDocumentInput): string {
  const barcodeSvg = generateI2of5SvgString(doc.barcode, 52);
  const valorFormatado = formatCurrencyBRL(doc.valorDocumento);
  const descontoFormatado =
    doc.valorDesconto > 0 ? formatCurrencyBRL(doc.valorDesconto) : 'R$ 0,00';
  const valorCobradoAbatimento =
    doc.descontoCondicao === 'abatimento_direto' && doc.valorDesconto > 0
      ? formatCurrencyBRL(Math.max(0, doc.valorDocumento - doc.valorDesconto))
      : '&nbsp;';
  const dataDocBr = formatDateBR(doc.dataDocumento);
  const dataVencBr = formatDateBR(doc.dataVencimento);
  const instrucoesHtml = escapeHtml(doc.instrucoes).replace(/\n/g, '<br/>');

  return `<div class="sheet">
    <!-- RECIBO DO PAGADOR -->
    <div class="section-tag">
      <span>Recibo do Pagador</span>
      <span>${escapeHtml(doc.demonstrativoParcela || 'Cobrança Bancária Registrada')}</span>
    </div>
    <div class="bank-header">
      <div class="bank-name">
        <span class="bank-badge" style="background:${escapeHtml(doc.bankMeta.color)};">${escapeHtml(doc.bankMeta.code)}</span>
        <span>${escapeHtml(doc.bankMeta.shortName)}</span>
      </div>
      <div class="bank-code">${escapeHtml(doc.bankMeta.codeWithDv)}</div>
      <div class="linha-digitavel">${escapeHtml(doc.linhaDigitavel)}</div>
    </div>
    <table class="boleto-grid">
      <tr>
        <td colspan="4">
          <span class="lbl">Beneficiário / Cedente</span>
          <span class="val">${escapeHtml(doc.beneficiarioNome)} — CNPJ/CPF: ${escapeHtml(doc.beneficiarioCnpj)}</span>
        </td>
        <td colspan="2">
          <span class="lbl">Agência / Código do Beneficiário</span>
          <span class="val val-right">${escapeHtml(doc.agenciaCodigoCedente)}</span>
        </td>
      </tr>
      <tr>
        <td colspan="2">
          <span class="lbl">Pagador</span>
          <span class="val">${escapeHtml(doc.pagadorNome)}</span>
        </td>
        <td>
          <span class="lbl">Nº do Documento</span>
          <span class="val">${escapeHtml(doc.numeroDocumento)}</span>
        </td>
        <td>
          <span class="lbl">Nosso Número</span>
          <span class="val">${escapeHtml(doc.nossoNumero)}</span>
        </td>
        <td>
          <span class="lbl">Vencimento</span>
          <span class="val val-right">${escapeHtml(dataVencBr)}</span>
        </td>
        <td>
          <span class="lbl">(=) Valor do Documento</span>
          <span class="val val-right">${escapeHtml(valorFormatado)}</span>
        </td>
      </tr>
    </table>

    <div class="cut-line"><span>Corte na linha pontilhada • Autenticação Mecânica</span></div>

    <!-- FICHA DE COMPENSAÇÃO -->
    <div class="section-tag">
      <span>Ficha de Compensação</span>
      <span>Padrão FEBRABAN 240/400</span>
    </div>
    <div class="bank-header">
      <div class="bank-name">
        <span class="bank-badge" style="background:${escapeHtml(doc.bankMeta.color)};">${escapeHtml(doc.bankMeta.code)}</span>
        <span>${escapeHtml(doc.bankMeta.shortName)}</span>
      </div>
      <div class="bank-code">${escapeHtml(doc.bankMeta.codeWithDv)}</div>
      <div class="linha-digitavel">${escapeHtml(doc.linhaDigitavel)}</div>
    </div>
    <table class="boleto-grid">
      <tr>
        <td colspan="5">
          <span class="lbl">Local de Pagamento</span>
          <span class="val">${escapeHtml(doc.bankMeta.localPagamento)}</span>
        </td>
        <td>
          <span class="lbl">Vencimento</span>
          <span class="val val-right" style="font-size:11px;">${escapeHtml(dataVencBr)}</span>
        </td>
      </tr>
      <tr>
        <td colspan="5">
          <span class="lbl">Beneficiário / Cedente (${escapeHtml(doc.beneficiarioCnpj)})</span>
          <span class="val">${escapeHtml(doc.beneficiarioNome)}${doc.beneficiarioEndereco ? ` — ${escapeHtml(doc.beneficiarioEndereco)}` : ''}</span>
        </td>
        <td>
          <span class="lbl">Agência / Código do Beneficiário</span>
          <span class="val val-right">${escapeHtml(doc.agenciaCodigoCedente)}</span>
        </td>
      </tr>
      <tr>
        <td>
          <span class="lbl">Data do Documento</span>
          <span class="val">${escapeHtml(dataDocBr)}</span>
        </td>
        <td>
          <span class="lbl">Nº do Documento</span>
          <span class="val">${escapeHtml(doc.numeroDocumento)}</span>
        </td>
        <td>
          <span class="lbl">Espécie Doc.</span>
          <span class="val">${escapeHtml(doc.especieDoc)}</span>
        </td>
        <td>
          <span class="lbl">Aceite</span>
          <span class="val">${escapeHtml(doc.aceite)}</span>
        </td>
        <td>
          <span class="lbl">Data Processamento</span>
          <span class="val">${escapeHtml(dataDocBr)}</span>
        </td>
        <td>
          <span class="lbl">Nosso Número</span>
          <span class="val val-right">${escapeHtml(doc.nossoNumero)}</span>
        </td>
      </tr>
      <tr>
        <td>
          <span class="lbl">Uso do Banco</span>
          <span class="val">&nbsp;</span>
        </td>
        <td>
          <span class="lbl">Carteira</span>
          <span class="val">${escapeHtml(doc.carteira)}</span>
        </td>
        <td>
          <span class="lbl">Espécie</span>
          <span class="val">R$</span>
        </td>
        <td>
          <span class="lbl">Quantidade</span>
          <span class="val">&nbsp;</span>
        </td>
        <td>
          <span class="lbl">(x) Valor</span>
          <span class="val">&nbsp;</span>
        </td>
        <td>
          <span class="lbl">(=) Valor do Documento</span>
          <span class="val val-right" style="font-size:11px;">${escapeHtml(valorFormatado)}</span>
        </td>
      </tr>
      <tr>
        <td colspan="5" rowspan="4" style="height:82px;">
          <span class="lbl">Instruções (Texto de Responsabilidade do Beneficiário)</span>
          <span class="val" style="font-weight:600;line-height:1.35;">${instrucoesHtml}</span>
        </td>
        <td>
          <span class="lbl">(-) Desconto / Abatimento</span>
          <span class="val val-right">${escapeHtml(descontoFormatado)}</span>
        </td>
      </tr>
      <tr>
        <td>
          <span class="lbl">(+) Mora / Multa</span>
          <span class="val val-right">&nbsp;</span>
        </td>
      </tr>
      <tr>
        <td>
          <span class="lbl">(+) Outros Acréscimos</span>
          <span class="val val-right">&nbsp;</span>
        </td>
      </tr>
      <tr>
        <td>
          <span class="lbl">(=) Valor Cobrado</span>
          <span class="val val-right">${valorCobradoAbatimento}</span>
        </td>
      </tr>
      <tr>
        <td colspan="6">
          <span class="lbl">Pagador</span>
          <span class="val">${escapeHtml(doc.pagadorNome)} — CPF/CNPJ: ${escapeHtml(doc.pagadorDocumento || 'Não informado')}</span>
          <span class="val" style="font-weight:500;font-size:9px;margin-top:2px;">${escapeHtml(doc.pagadorEndereco)}</span>
        </td>
      </tr>
    </table>

    <div class="barcode-area">
      <div class="barcode-svg">${barcodeSvg}</div>
      <div class="auth-box">Autenticação Mecânica — Ficha de Compensação</div>
    </div>
  </div>`;
}

export function buildBoletosBatchPrintHtml(docs: BoletoDocumentInput[]): string {
  const safeDocs = docs.length > 0 ? docs : [];
  const firstDoc = safeDocs[0];
  const titleText =
    safeDocs.length > 1 && firstDoc
      ? `Carnê de Boletos (${safeDocs.length} Parcelas) - ${firstDoc.pagadorNome}`
      : firstDoc
      ? `Boleto Bancário ${firstDoc.numeroDocumento} - ${firstDoc.pagadorNome}`
      : 'Boleto Bancário FEBRABAN';

  const sheetsHtml = safeDocs
    .map(
      (doc) => `<div class="sheet-page">${buildBoletoSheetInnerHtml(doc)}</div>`
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(titleText)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      margin: 0;
      padding: 12px;
      font-family: Arial, Helvetica, sans-serif;
      color: #000000;
      background: #ffffff;
      font-size: 10px;
    }
    .sheet-page {
      page-break-after: always;
      break-after: page;
      break-inside: avoid;
      page-break-inside: avoid;
      margin-bottom: 24px;
    }
    .sheet-page:last-child {
      page-break-after: auto;
      break-after: auto;
      margin-bottom: 0;
    }
    @media print {
      body {
        padding: 0;
      }
      .sheet-page {
        margin-bottom: 0;
      }
    }
    .sheet {
      width: 100%;
      max-width: 760px;
      margin: 0 auto;
    }
    .section-tag {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #333333;
      margin-bottom: 3px;
      display: flex;
      justify-content: space-between;
    }
    .bank-header {
      display: flex;
      align-items: flex-end;
      border-bottom: 2px solid #000000;
      padding-bottom: 4px;
      margin-bottom: 0;
    }
    .bank-name {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 900;
      padding-right: 10px;
      border-right: 2px solid #000000;
      white-space: nowrap;
    }
    .bank-badge {
      display: inline-block;
      padding: 2px 6px;
      color: #ffffff;
      font-weight: 900;
      font-size: 11px;
      border-radius: 3px;
    }
    .bank-code {
      font-size: 16px;
      font-weight: 900;
      padding: 0 12px;
      border-right: 2px solid #000000;
      white-space: nowrap;
      font-family: "Courier New", monospace;
    }
    .linha-digitavel {
      flex: 1;
      text-align: right;
      font-size: 12.5px;
      font-weight: 900;
      font-family: "Courier New", monospace;
      letter-spacing: 0.02em;
      padding-left: 8px;
    }
    table.boleto-grid {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    table.boleto-grid td {
      border: 1px solid #000000;
      padding: 3px 5px;
      vertical-align: top;
    }
    .lbl {
      display: block;
      font-size: 7.5px;
      text-transform: uppercase;
      color: #222222;
      margin-bottom: 2px;
    }
    .val {
      display: block;
      font-size: 10px;
      font-weight: 700;
      color: #000000;
      word-break: break-word;
    }
    .val-right {
      text-align: right;
      font-weight: 900;
    }
    .cut-line {
      border-top: 1px dashed #000000;
      margin: 14px 0;
      position: relative;
      text-align: right;
    }
    .cut-line span {
      background: #ffffff;
      padding: 0 6px;
      font-size: 8px;
      font-weight: 700;
      position: relative;
      top: -6px;
    }
    .barcode-area {
      margin-top: 8px;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }
    .barcode-svg {
      flex: 1;
      max-width: 460px;
    }
    .auth-box {
      width: 210px;
      text-align: right;
      font-size: 8px;
      border-top: 1px solid #000000;
      padding-top: 3px;
    }
  </style>
</head>
<body>
  ${sheetsHtml}
  <script>
    (function(){
      function go(){
        setTimeout(function(){
          try { window.focus(); window.print(); } catch(e) {}
        }, 250);
      }
      if (document.readyState === 'complete') go();
      else window.onload = go;
    })();
  </script>
</body>
</html>`;
}

export function buildBoletoPrintHtml(doc: BoletoDocumentInput): string {
  return buildBoletosBatchPrintHtml([doc]);
}

export function openBoletosBatchPrintWindow(docs: BoletoDocumentInput[]): boolean {
  if (!docs || docs.length === 0) return false;
  const html = buildBoletosBatchPrintHtml(docs);
  try {
    const win = window.open('', '_blank', 'width=920,height=840');
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
      try {
        win.focus();
      } catch {}
      return true;
    }
  } catch {
    // fallback para iframe oculto
  }

  try {
    let iframe = document.getElementById('boleto-print-iframe') as HTMLIFrameElement | null;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'boleto-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);
    }
    const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!iframeDoc) return false;
    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();
    setTimeout(() => {
      try {
        iframe?.contentWindow?.focus();
        iframe?.contentWindow?.print();
      } catch {}
    }, 320);
    return true;
  } catch {
    return false;
  }
}

export function openBoletoPrintWindow(doc: BoletoDocumentInput): boolean {
  return openBoletosBatchPrintWindow([doc]);
}

export function buildBoletoShareMessage(doc: BoletoDocumentInput): string {
  const valorBr = formatCurrencyBRL(doc.valorDocumento);
  const vencBr = formatDateBR(doc.dataVencimento);
  return [
    `Olá ${doc.pagadorNome}, segue os dados do seu Boleto Bancário para pagamento:`,
    ``,
    `• Beneficiário: ${doc.beneficiarioNome} (${doc.beneficiarioCnpj})`,
    `• Banco Emissor: ${doc.bankMeta.codeWithDv} - ${doc.bankMeta.shortName}`,
    `• Documento / Ref.: ${doc.numeroDocumento}${doc.demonstrativoParcela ? ` (${doc.demonstrativoParcela})` : ''}`,
    `• Vencimento: ${vencBr}`,
    `• Valor do Boleto: ${valorBr}`,
    ``,
    `Linha Digitável (Copie e cole no app do seu banco):`,
    `${doc.linhaDigitavel}`,
  ].join('\n');
}

export function buildBoletosBatchShareMessage(docs: BoletoDocumentInput[]): string {
  if (!docs || docs.length === 0) return '';
  if (docs.length === 1) return buildBoletoShareMessage(docs[0]);

  const first = docs[0];
  const totalAmount = docs.reduce((acc, d) => acc + (Number(d.valorDocumento) || 0), 0);
  const headerLines = [
    `Olá ${first.pagadorNome}, segue o resumo completo do seu Carnê com *${docs.length} Boletos Bancários* para pagamento:`,
    ``,
    `• Beneficiário: ${first.beneficiarioNome} (${first.beneficiarioCnpj})`,
    `• Banco Emissor: ${first.bankMeta.codeWithDv} - ${first.bankMeta.shortName}`,
    `• Quantidade de Parcelas: ${docs.length}x`,
    `• Valor Total do Carnê: ${formatCurrencyBRL(totalAmount)}`,
  ];

  const parcelBlocks = docs.map((doc, idx) => {
    const label = doc.demonstrativoParcela || `Parcela ${idx + 1}/${docs.length}`;
    return [
      ``,
      `----------------------------------------`,
      `📌 ${label} — Doc: ${doc.numeroDocumento}`,
      `• Vencimento: ${formatDateBR(doc.dataVencimento)}`,
      `• Valor: ${formatCurrencyBRL(doc.valorDocumento)}`,
      `• Linha Digitável:`,
      `${doc.linhaDigitavel}`,
    ].join('\n');
  });

  return [
    ...headerLines,
    ...parcelBlocks,
    ``,
    `Copie e cole a Linha Digitável correspondente no aplicativo do seu banco para efetuar o pagamento.`,
  ].join('\n');
}

export function buildBoletoWhatsAppUrl(doc: BoletoDocumentInput, phone?: string): string {
  return buildBoletosBatchWhatsAppUrl([doc], phone);
}

export function buildBoletosBatchWhatsAppUrl(docs: BoletoDocumentInput[], phone?: string): string {
  const digits = cleanDigits(phone || '');
  const fullPhone =
    digits.length >= 10 && digits.length <= 11
      ? `55${digits}`
      : digits.length >= 12
      ? digits
      : '';
  const text = encodeURIComponent(buildBoletosBatchShareMessage(docs));
  return fullPhone
    ? `https://wa.me/${fullPhone}?text=${text}`
    : `https://wa.me/?text=${text}`;
}

export function buildBoletoMailtoUrl(doc: BoletoDocumentInput, email?: string): string {
  return buildBoletosBatchMailtoUrl([doc], email);
}

export function buildBoletosBatchMailtoUrl(docs: BoletoDocumentInput[], email?: string): string {
  if (!docs || docs.length === 0) return 'mailto:';
  if (docs.length === 1) {
    const doc = docs[0];
    const subject = encodeURIComponent(
      `Boleto Bancário ${doc.numeroDocumento} - Vencimento ${formatDateBR(doc.dataVencimento)} (${formatCurrencyBRL(doc.valorDocumento)})`
    );
    const body = encodeURIComponent(buildBoletoShareMessage(doc));
    const target = (email || '').trim();
    return `mailto:${encodeURIComponent(target)}?subject=${subject}&body=${body}`;
  }

  const first = docs[0];
  const totalAmount = docs.reduce((acc, d) => acc + (Number(d.valorDocumento) || 0), 0);
  const subject = encodeURIComponent(
    `Carnê de Boletos Bancários (${docs.length} Parcelas) - ${first.pagadorNome} - Total ${formatCurrencyBRL(totalAmount)}`
  );
  const body = encodeURIComponent(buildBoletosBatchShareMessage(docs));
  const target = (email || '').trim();
  return `mailto:${encodeURIComponent(target)}?subject=${subject}&body=${body}`;
}

export function resolveBeneficiaryDefaults(company?: CompanyProfile | null) {
  const nome =
    company?.corporateName ||
    company?.tradeName ||
    company?.name ||
    company?.companyName ||
    'EMPRESA BENEFICIÁRIA';
  const rawDoc = company?.cnpjCpf || company?.cnpj || '';
  const docFormatted = rawDoc ? formatCpfCnpj(rawDoc) : 'Não informado';
  const endereco = formatCompanyFullAddress(company);
  return {
    nome: nome.toUpperCase(),
    cnpj: docFormatted,
    endereco,
  };
}
