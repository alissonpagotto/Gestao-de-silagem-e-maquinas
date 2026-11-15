import { BankAccount, CompanyProfile, ServiceOrder, SilageOrder, NotaSaidaRecord } from '../types';
import { cleanDigits } from '../lib/formatters';
import { formatDateBR } from '../lib/storage';
import { resolveBeneficiaryDefaults, resolveBoletoBankMeta } from './boletoUtils';

export type BoletoRegistroStatus = 'AGUARDANDO_REMESSA' | 'ENVIADO_BANCO' | 'LIQUIDADO';
export type CnabStandard = 'CNAB_240' | 'CNAB_400';

export interface BoletoEmitidoRecord {
  id: string;
  contaReceberId: string;
  contaReceberTipo?: string;
  parcela: string;
  parcelaNumero?: number;
  totalParcelas?: number;
  nossoNumero: string;
  numeroDocumento: string;
  clienteNome: string;
  clienteCpfCnpj: string;
  clienteEndereco: string;
  bancoCodigo: string;
  bancoNome?: string;
  agencia: string;
  conta: string;
  carteira: string;
  vencimento: string; // YYYY-MM-DD
  dataEmissao?: string; // YYYY-MM-DD
  valor: number;
  multa: number;
  juros: number;
  desconto: number;
  linhaDigitavel?: string;
  codigoBarras?: string;
  statusRegistro: BoletoRegistroStatus;
  remessaId?: string;
  remessaArquivo?: string;
  dataEnvioRemessa?: string;
  dataLiquidacao?: string;
  valorPago?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CnabRemessaHistoryRecord {
  id: string;
  fileName: string;
  standard: CnabStandard;
  bankAccountId: string;
  bankCode: string;
  bankName: string;
  convenio: string;
  sequencialArquivo: number;
  boletosCount: number;
  totalAmount: number;
  boletoIds: string[];
  createdAt: string;
}

export type CnabOcorrenciaTipo =
  | 'LIQUIDACAO'
  | 'ENTRADA_CONFIRMADA'
  | 'BAIXADO'
  | 'REJEITADO'
  | 'OUTRO';

export interface CnabRetornoParsedRow {
  id: string;
  standard: CnabStandard;
  nossoNumero: string;
  numeroDocumento: string;
  identificacaoEmpresa?: string;
  clienteNome: string;
  vencimento: string; // YYYY-MM-DD
  dataOcorrencia: string; // YYYY-MM-DD
  dataCredito: string; // YYYY-MM-DD
  valorTitulo: number;
  valorPago: number;
  jurosMulta: number;
  desconto: number;
  ocorrenciaCodigo: string;
  ocorrenciaDescricao: string;
  ocorrenciaTipo: CnabOcorrenciaTipo;
  matchedBoletoId?: string;
  matchedContaReceberId?: string;
  matchedContaReceberTipo?: string;
  alreadyLiquidated?: boolean;
}

export interface CnabRetornoParseResult {
  standard: CnabStandard;
  bankCode: string;
  bankName: string;
  fileName?: string;
  rows: CnabRetornoParsedRow[];
  totalLiquidacoes: number;
  totalValorPago: number;
}

export interface OpenReceivableLookupItem {
  id: string;
  type: 'Venda de Silagem' | 'Prestação de Serviço' | 'Nota Fiscal de Saída';
  clientName: string;
  documentHint: string;
  dueDate: string;
  amount: number;
  status: 'pendente' | 'pago';
}

export const BOLETOS_EMITIDOS_STORAGE_KEY = 'agrocontrol_boletos_emitidos';
export const CNAB_REMESSAS_HISTORY_KEY = 'agrocontrol_cnab_remessas_historico';
export const CNAB_SEQ_STORAGE_KEY = 'agrocontrol_cnab_sequencial';
export const BOLETOS_EMITIDOS_UPDATED_EVENT = 'agrocontrol_boletos_emitidos_updated';

// ============================================================================
// PERSISTÊNCIA LOCALSTORAGE (agrocontrol_boletos_emitidos & histórico)
// ============================================================================

export function getStoredBoletosEmitidos(): BoletoEmitidoRecord[] {
  try {
    const raw = localStorage.getItem(BOLETOS_EMITIDOS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item === 'object' && item.id);
  } catch {
    return [];
  }
}

export function saveStoredBoletosEmitidos(records: BoletoEmitidoRecord[]): void {
  try {
    localStorage.setItem(BOLETOS_EMITIDOS_STORAGE_KEY, JSON.stringify(records));
    window.dispatchEvent(new CustomEvent(BOLETOS_EMITIDOS_UPDATED_EVENT));
  } catch (err) {
    console.warn('Erro ao salvar boletos emitidos no localStorage:', err);
  }
}

export function upsertBoletosEmitidos(
  incoming: Array<
    Omit<BoletoEmitidoRecord, 'id' | 'createdAt' | 'updatedAt' | 'statusRegistro'> & {
      id?: string;
      statusRegistro?: BoletoRegistroStatus;
    }
  >
): BoletoEmitidoRecord[] {
  const existing = getStoredBoletosEmitidos();
  const nowIso = new Date().toISOString();
  const updatedList = [...existing];
  const touchedRecords: BoletoEmitidoRecord[] = [];

  incoming.forEach((item, idx) => {
    const itemNnDigits = cleanDigits(item.nossoNumero || '');
    const itemDocUpper = (item.numeroDocumento || '').trim().toUpperCase();

    const matchIndex = updatedList.findIndex((rec) => {
      if (item.id && rec.id === item.id) return true;
      const recNnDigits = cleanDigits(rec.nossoNumero || '');
      if (
        item.contaReceberId &&
        rec.contaReceberId === item.contaReceberId &&
        rec.parcela === item.parcela
      ) {
        return true;
      }
      if (
        itemNnDigits &&
        recNnDigits &&
        itemNnDigits === recNnDigits &&
        (rec.numeroDocumento || '').trim().toUpperCase() === itemDocUpper
      ) {
        return true;
      }
      return false;
    });

    if (matchIndex >= 0) {
      const current = updatedList[matchIndex];
      const nextStatus: BoletoRegistroStatus =
        current.statusRegistro === 'LIQUIDADO'
          ? 'LIQUIDADO'
          : item.statusRegistro || current.statusRegistro || 'AGUARDANDO_REMESSA';

      const merged: BoletoEmitidoRecord = {
        ...current,
        ...item,
        id: current.id,
        statusRegistro: nextStatus,
        createdAt: current.createdAt || nowIso,
        updatedAt: nowIso,
      };
      updatedList[matchIndex] = merged;
      touchedRecords.push(merged);
    } else {
      const created: BoletoEmitidoRecord = {
        ...item,
        id:
          item.id ||
          `bol_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 7)}`,
        statusRegistro: item.statusRegistro || 'AGUARDANDO_REMESSA',
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      updatedList.unshift(created);
      touchedRecords.push(created);
    }
  });

  saveStoredBoletosEmitidos(updatedList);
  return touchedRecords;
}

export function markBoletosStatus(
  boletoIds: string[],
  statusRegistro: BoletoRegistroStatus,
  extra?: Partial<BoletoEmitidoRecord>
): BoletoEmitidoRecord[] {
  if (!boletoIds || boletoIds.length === 0) return getStoredBoletosEmitidos();
  const idSet = new Set(boletoIds);
  const nowIso = new Date().toISOString();
  const updated = getStoredBoletosEmitidos().map((b) =>
    idSet.has(b.id)
      ? {
          ...b,
          ...extra,
          statusRegistro,
          updatedAt: nowIso,
        }
      : b
  );
  saveStoredBoletosEmitidos(updated);
  return updated;
}

export function getStoredCnabRemessas(): CnabRemessaHistoryRecord[] {
  try {
    const raw = localStorage.getItem(CNAB_REMESSAS_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendCnabRemessaHistory(entry: CnabRemessaHistoryRecord): void {
  try {
    const list = getStoredCnabRemessas();
    const updated = [entry, ...list].slice(0, 100);
    localStorage.setItem(CNAB_REMESSAS_HISTORY_KEY, JSON.stringify(updated));
  } catch {}
}

function getNextCnabSequencial(): number {
  try {
    const raw = localStorage.getItem(CNAB_SEQ_STORAGE_KEY);
    const current = parseInt(raw || '0', 10) || 0;
    const next = current + 1;
    localStorage.setItem(CNAB_SEQ_STORAGE_KEY, String(next));
    return next;
  } catch {
    return Math.floor(Date.now() % 999999) + 1;
  }
}

// ============================================================================
// UTILITÁRIOS POSICIONAIS CNAB 240 / CNAB 400
// ============================================================================

const normalizeAscii = (value?: string | null): string => {
  if (!value) return '';
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
};

const padAlpha = (value: string | number | undefined | null, length: number): string => {
  const clean = normalizeAscii(value == null ? '' : String(value));
  return clean.slice(0, length).padEnd(length, ' ');
};

const padNum = (value: string | number | undefined | null, length: number): string => {
  const digits = cleanDigits(value == null ? '' : String(value));
  if (digits.length >= length) return digits.slice(-length);
  return digits.padStart(length, '0');
};

const formatMoneyCents = (amount: number, length: number): string => {
  const cents = Math.max(0, Math.round((Number(amount) || 0) * 100));
  return String(cents).slice(-length).padStart(length, '0');
};

const formatIsoToDDMMAAAA = (iso?: string): string => {
  const match = (iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}${match[2]}${match[1]}`;
  const now = new Date();
  return `${String(now.getDate()).padStart(2, '0')}${String(now.getMonth() + 1).padStart(
    2,
    '0'
  )}${now.getFullYear()}`;
};

const formatIsoToDDMMAA = (iso?: string): string => {
  const ddmmaaaa = formatIsoToDDMMAAAA(iso);
  return `${ddmmaaaa.slice(0, 4)}${ddmmaaaa.slice(6, 8)}`;
};

const parseDDMMAAAAtoIso = (raw: string): string => {
  const digits = cleanDigits(raw);
  if (digits.length !== 8 || digits === '00000000') {
    return new Date().toISOString().split('T')[0];
  }
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  return `${yyyy}-${mm}-${dd}`;
};

const parseDDMMAAtoIso = (raw: string): string => {
  const digits = cleanDigits(raw);
  if (digits.length !== 6 || digits === '000000') {
    return new Date().toISOString().split('T')[0];
  }
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yy = Number(digits.slice(4, 6));
  const yyyy = yy >= 80 ? `19${String(yy).padStart(2, '0')}` : `20${String(yy).padStart(2, '0')}`;
  return `${yyyy}-${mm}-${dd}`;
};

const parseCentsToNumber = (raw: string): number => {
  const digits = cleanDigits(raw);
  if (!digits) return 0;
  return Number((Number(digits) / 100).toFixed(2));
};

const splitAgency = (raw?: string): { code: string; dv: string } => {
  const parts = String(raw || '0001').split('-');
  const code = padNum(parts[0] || '0001', 5);
  const dv = parts[1] ? normalizeAscii(parts[1]).slice(0, 1) || '0' : ' ';
  return { code, dv };
};

const splitAccount = (raw?: string): { number: string; dv: string } => {
  const parts = String(raw || '000001').split('-');
  const numDigits = cleanDigits(parts[0] || '');
  if (parts.length > 1) {
    return {
      number: padNum(numDigits, 12),
      dv: normalizeAscii(parts[1]).slice(0, 1) || '0',
    };
  }
  if (numDigits.length >= 2) {
    return {
      number: padNum(numDigits.slice(0, -1), 12),
      dv: numDigits.slice(-1),
    };
  }
  return { number: padNum(numDigits || '1', 12), dv: '0' };
};

const getNowHHMMSS = (): string => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(
    2,
    '0'
  )}${String(now.getSeconds()).padStart(2, '0')}`;
};

export function triggerTextFileDownload(fileName: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=iso-8859-1' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ============================================================================
// GERADOR DE ARQUIVO REMESSA (.REM) — CNAB 240 E CNAB 400
// ============================================================================

export interface GenerateCnabRemessaParams {
  boletos: BoletoEmitidoRecord[];
  standard: CnabStandard;
  bankAccount?: BankAccount | null;
  companyProfile?: CompanyProfile | null;
  convenio?: string;
}

export interface GenerateCnabRemessaResult {
  fileName: string;
  content: string;
  standard: CnabStandard;
  sequencialArquivo: number;
  boletosCount: number;
  totalAmount: number;
}

export function generateCnabRemessaFile(
  params: GenerateCnabRemessaParams
): GenerateCnabRemessaResult {
  const { boletos, standard, bankAccount, companyProfile, convenio } = params;
  const bankMeta = resolveBoletoBankMeta(bankAccount);
  const beneficiary = resolveBeneficiaryDefaults(companyProfile);
  const companyDigits = cleanDigits(beneficiary.cnpj);
  const tipoInscricao = companyDigits.length > 11 ? '2' : '1';
  const sequencialArquivo = getNextCnabSequencial();

  const agency = splitAgency(bankAccount?.agency || companyProfile?.bankAgency || boletos[0]?.agencia);
  const account = splitAccount(
    bankAccount?.accountNumber || companyProfile?.bankAccount || boletos[0]?.conta
  );
  const convenioStr = padAlpha(convenio || account.number.slice(-6), 20);
  const todayIso = new Date().toISOString().split('T')[0];
  const dateDDMMAAAA = formatIsoToDDMMAAAA(todayIso);
  const dateDDMMAA = formatIsoToDDMMAA(todayIso);
  const hhmmss = getNowHHMMSS();

  const totalAmount = Number(
    boletos.reduce((acc, b) => acc + (Number(b.valor) || 0), 0).toFixed(2)
  );

  if (standard === 'CNAB_240') {
    const lines: string[] = [];

    // 1. HEADER DE ARQUIVO (Registro 0 — 240 posições)
    const headerArquivo =
      padNum(bankMeta.code, 3) + // 001-003 Banco
      '0000' + // 004-007 Lote
      '0' + // 008 Tipo Registro
      padAlpha('', 9) + // 009-017 Uso FEBRABAN
      tipoInscricao + // 018 Tipo Inscricao
      padNum(companyDigits, 14) + // 019-032 CNPJ/CPF
      convenioStr + // 033-052 Convênio
      agency.code + // 053-057 Agência
      agency.dv + // 058 DV Agência
      account.number + // 059-070 Conta
      account.dv + // 071 DV Conta
      ' ' + // 072 DV Ag/Conta
      padAlpha(beneficiary.nome, 30) + // 073-102 Nome Empresa
      padAlpha(bankMeta.shortName, 30) + // 103-132 Nome Banco
      padAlpha('', 10) + // 133-142 Uso FEBRABAN
      '1' + // 143 Código Remessa (1 = Remessa)
      dateDDMMAAAA + // 144-151 Data Geração
      hhmmss + // 152-157 Hora Geração
      padNum(sequencialArquivo, 6) + // 158-163 NSA
      '103' + // 164-166 Versão Layout
      '01600' + // 167-171 Densidade
      padAlpha('REMESSA', 20) + // 172-191 Reservado Banco
      padAlpha('AGROCONTROL', 20) + // 192-211 Reservado Empresa
      padAlpha('', 29); // 212-240 Uso FEBRABAN
    lines.push(headerArquivo.slice(0, 240).padEnd(240, ' '));

    // 2. HEADER DE LOTE (Registro 1 — 240 posições)
    const headerLote =
      padNum(bankMeta.code, 3) + // 001-003 Banco
      '0001' + // 004-007 Lote 0001
      '1' + // 008 Tipo Registro
      'R' + // 009 Tipo Operação (R = Remessa)
      '01' + // 010-011 Tipo Serviço (01 = Cobrança)
      '  ' + // 012-013 Uso FEBRABAN
      '060' + // 014-016 Versão Layout Lote
      ' ' + // 017 Uso FEBRABAN
      tipoInscricao + // 018 Tipo Inscrição
      padNum(companyDigits, 15) + // 019-033 CNPJ/CPF
      convenioStr + // 034-053 Convênio
      agency.code + // 054-058 Agência
      agency.dv + // 059 DV Agência
      account.number + // 060-071 Conta
      account.dv + // 072 DV Conta
      ' ' + // 073 DV Ag/Conta
      padAlpha(beneficiary.nome, 30) + // 074-103 Nome Empresa
      padAlpha('MENSAGEM BOLETO AGROCONTROL', 40) + // 104-143 Mensagem 1
      padAlpha('', 40) + // 144-183 Mensagem 2
      padNum(sequencialArquivo, 8) + // 184-191 Número Remessa
      dateDDMMAAAA + // 192-199 Data Gravação
      '00000000' + // 200-207 Data Crédito
      padAlpha('', 33); // 208-240 Uso FEBRABAN
    lines.push(headerLote.slice(0, 240).padEnd(240, ' '));

    let loteSeq = 0;

    boletos.forEach((b) => {
      const pagadorDigits = cleanDigits(b.clienteCpfCnpj);
      const pagadorTipo = pagadorDigits.length > 11 ? '2' : '1';
      const vencDDMMAAAA = formatIsoToDDMMAAAA(b.vencimento);
      const emissaoDDMMAAAA = formatIsoToDDMMAAAA(b.dataEmissao || todayIso);
      const jurosDia = Number((((Number(b.valor) || 0) * (Number(b.juros) || 0)) / 100).toFixed(2));
      const hasDesconto = (Number(b.desconto) || 0) > 0;
      const hasMulta = (Number(b.multa) || 0) > 0;

      // Segmento P
      loteSeq += 1;
      const segP =
        padNum(bankMeta.code, 3) + // 001-003 Banco
        '0001' + // 004-007 Lote
        '3' + // 008 Tipo Registro (3 = Detalhe)
        padNum(loteSeq, 5) + // 009-013 Sequencial Lote
        'P' + // 014 Segmento P
        ' ' + // 015 Uso FEBRABAN
        '01' + // 016-017 Código Movimento (01 = Entrada de Títulos)
        agency.code + // 018-022 Agência
        agency.dv + // 023 DV Agência
        account.number + // 024-035 Conta
        account.dv + // 036 DV Conta
        ' ' + // 037 DV Ag/Conta
        padAlpha(cleanDigits(b.nossoNumero) || b.nossoNumero, 20) + // 038-057 Nosso Número
        padNum(b.carteira || bankMeta.defaultCarteira, 1) + // 058 Carteira
        '1' + // 059 Cadastramento (1 = Cobrança Registrada)
        '1' + // 060 Tipo Documento
        '2' + // 061 Emissão Boleto (2 = Cliente)
        '2' + // 062 Distribuição
        padAlpha(b.numeroDocumento, 15) + // 063-077 Nº Documento
        vencDDMMAAAA + // 078-085 Vencimento
        formatMoneyCents(b.valor, 15) + // 086-100 Valor Nominal
        '00000' + // 101-105 Agência Cobradora
        ' ' + // 106 DV Ag Cobradora
        '02' + // 107-108 Espécie Título (02 = DM)
        'N' + // 109 Aceite
        emissaoDDMMAAAA + // 110-117 Data Emissão
        (jurosDia > 0 ? '1' : '3') + // 118 Código Juros Mora (1 = Valor por Dia, 3 = Isento)
        (jurosDia > 0 ? vencDDMMAAAA : '00000000') + // 119-126 Data Juros
        formatMoneyCents(jurosDia, 15) + // 127-141 Juros Mora por Dia
        (hasDesconto ? '1' : '0') + // 142 Código Desconto
        (hasDesconto ? vencDDMMAAAA : '00000000') + // 143-150 Data Desconto
        formatMoneyCents(b.desconto, 15) + // 151-165 Valor Desconto
        formatMoneyCents(0, 15) + // 166-180 IOF
        formatMoneyCents(0, 15) + // 181-195 Abatimento
        padAlpha(b.contaReceberId || b.id, 25) + // 196-220 Identificação do Título na Empresa
        '3' + // 221 Código Protesto (3 = Não Protestar)
        '00' + // 222-223 Prazo Protesto
        '1' + // 224 Código Baixa
        '030' + // 225-227 Prazo Baixa
        '09' + // 228-229 Moeda (09 = Real)
        '0000000000' + // 230-239 Contrato
        ' '; // 240 Uso FEBRABAN
      lines.push(segP.slice(0, 240).padEnd(240, ' '));

      // Segmento Q
      loteSeq += 1;
      const segQ =
        padNum(bankMeta.code, 3) + // 001-003 Banco
        '0001' + // 004-007 Lote
        '3' + // 008 Tipo Registro
        padNum(loteSeq, 5) + // 009-013 Sequencial Lote
        'Q' + // 014 Segmento Q
        ' ' + // 015 Uso FEBRABAN
        '01' + // 016-017 Código Movimento
        pagadorTipo + // 018 Tipo Inscrição Pagador
        padNum(pagadorDigits, 15) + // 019-033 CPF/CNPJ Pagador
        padAlpha(b.clienteNome, 40) + // 034-073 Nome Pagador
        padAlpha(b.clienteEndereco || 'ENDERECO NAO INFORMADO', 40) + // 074-113 Endereço
        padAlpha('CENTRO', 15) + // 114-128 Bairro
        '00000000' + // 129-136 CEP
        padAlpha('CIDADE', 15) + // 137-151 Cidade
        'MT' + // 152-153 UF
        '0' + // 154 Tipo Inscrição Avalista
        padNum(0, 15) + // 155-169 Inscrição Avalista
        padAlpha('', 40) + // 170-209 Nome Avalista
        '000' + // 210-212 Banco Correspondente
        padAlpha('', 20) + // 213-232 Nosso Número Banco Correspondente
        padAlpha('', 8); // 233-240 Uso FEBRABAN
      lines.push(segQ.slice(0, 240).padEnd(240, ' '));

      // Segmento R (Multa / Instruções)
      loteSeq += 1;
      const segR =
        padNum(bankMeta.code, 3) + // 001-003 Banco
        '0001' + // 004-007 Lote
        '3' + // 008 Tipo Registro
        padNum(loteSeq, 5) + // 009-013 Sequencial Lote
        'R' + // 014 Segmento R
        ' ' + // 015 Uso FEBRABAN
        '01' + // 016-017 Código Movimento
        '0' + // 018 Desconto 2
        '00000000' + // 019-026 Data Desconto 2
        formatMoneyCents(0, 15) + // 027-041 Valor Desconto 2
        '0' + // 042 Desconto 3
        '00000000' + // 043-050 Data Desconto 3
        formatMoneyCents(0, 15) + // 051-065 Valor Desconto 3
        (hasMulta ? '2' : '0') + // 066 Código Multa (2 = Percentual)
        (hasMulta ? vencDDMMAAAA : '00000000') + // 067-074 Data Multa
        formatMoneyCents(b.multa, 15) + // 075-089 Percentual/Valor Multa
        padAlpha('', 10) + // 090-099 Informação ao Pagador
        padAlpha(`PARCELA ${b.parcela}`, 40) + // 100-139 Mensagem 3
        padAlpha('', 40) + // 140-179 Mensagem 4
        padAlpha('', 20) + // 180-199 Uso FEBRABAN
        '00000000' + // 200-207 Cod Ocorrencia Pagador
        '000' + // 208-210 Banco Debito
        '00000' + // 211-215 Ag Debito
        ' ' + // 216 DV Ag
        '000000000000' + // 217-228 Conta Debito
        ' ' + // 229 DV Conta
        ' ' + // 230 DV Ag/Conta
        '0' + // 231 Aviso Débito
        padAlpha('', 9); // 232-240 Uso FEBRABAN
      lines.push(segR.slice(0, 240).padEnd(240, ' '));
    });

    // 4. TRAILER DE LOTE (Registro 5 — 240 posições)
    const qtdRegistrosLote = loteSeq + 2; // Header Lote + Detalhes + Trailer Lote
    const trailerLote =
      padNum(bankMeta.code, 3) +
      '0001' +
      '5' +
      padAlpha('', 9) +
      padNum(qtdRegistrosLote, 6) +
      padNum(boletos.length, 6) +
      formatMoneyCents(totalAmount, 17) +
      padNum(0, 6) +
      formatMoneyCents(0, 17) +
      padNum(0, 6) +
      formatMoneyCents(0, 17) +
      padNum(0, 6) +
      formatMoneyCents(0, 17) +
      padAlpha('', 8) +
      padAlpha('', 117);
    lines.push(trailerLote.slice(0, 240).padEnd(240, ' '));

    // 5. TRAILER DE ARQUIVO (Registro 9 — 240 posições)
    const totalRegistrosArquivo = lines.length + 1;
    const trailerArquivo =
      padNum(bankMeta.code, 3) +
      '9999' +
      '9' +
      padAlpha('', 9) +
      padNum(1, 6) +
      padNum(totalRegistrosArquivo, 6) +
      padNum(0, 6) +
      padAlpha('', 205);
    lines.push(trailerArquivo.slice(0, 240).padEnd(240, ' '));

    const fileName = `REM_${bankMeta.code}_CNAB240_${todayIso.replace(/-/g, '')}_${padNum(
      sequencialArquivo,
      4
    )}.REM`;

    return {
      fileName,
      content: lines.join('\r\n') + '\r\n',
      standard,
      sequencialArquivo,
      boletosCount: boletos.length,
      totalAmount,
    };
  }

  // CNAB 400 (400 posições por linha)
  const lines: string[] = [];
  let seq400 = 1;

  // HEADER (Tipo 0)
  const header400 =
    '0' + // 001 Tipo Registro
    '1' + // 002 Operação (1 = Remessa)
    padAlpha('REMESSA', 7) + // 003-009 Literal Remessa
    '01' + // 010-011 Código Serviço
    padAlpha('COBRANCA', 15) + // 012-026 Literal Serviço
    padAlpha(convenio || account.number.slice(-7), 20) + // 027-046 Código Empresa / Convênio
    padAlpha(beneficiary.nome, 30) + // 047-076 Nome Empresa
    padNum(bankMeta.code, 3) + // 077-079 Código Banco
    padAlpha(bankMeta.shortName, 15) + // 080-094 Nome Banco
    dateDDMMAA + // 095-100 Data Gravação
    padAlpha('', 8) + // 101-108 Brancos
    'MX' + // 109-110 Identificação Sistema
    padNum(sequencialArquivo, 7) + // 111-117 Nº Sequencial Remessa
    padAlpha('', 277) + // 118-394 Brancos
    padNum(seq400, 6); // 395-400 Sequencial Registro
  lines.push(header400.slice(0, 400).padEnd(400, ' '));

  // DETALHE (Tipo 1)
  boletos.forEach((b) => {
    seq400 += 1;
    const pagadorDigits = cleanDigits(b.clienteCpfCnpj);
    const pagadorTipo = pagadorDigits.length > 11 ? '02' : '01';
    const vencDDMMAA = formatIsoToDDMMAA(b.vencimento);
    const emissaoDDMMAA = formatIsoToDDMMAA(b.dataEmissao || todayIso);
    const jurosDia = Number((((Number(b.valor) || 0) * (Number(b.juros) || 0)) / 100).toFixed(2));

    const det400 =
      '1' + // 001 Tipo Registro
      (tipoInscricao === '2' ? '02' : '01') + // 002-003 Tipo Inscrição Empresa
      padNum(companyDigits, 14) + // 004-017 CNPJ/CPF Empresa
      padNum(agency.code, 4) + // 018-021 Agência
      '00' + // 022-023 Zeros
      padNum(account.number, 5) + // 024-028 Conta
      padAlpha(account.dv, 1) + // 029 DV Conta
      padAlpha('', 4) + // 030-033 Brancos
      '0000' + // 034-037 Instrução Cancelada
      padAlpha(b.contaReceberId || b.id, 25) + // 038-062 Uso da Empresa (Controle)
      padNum(cleanDigits(b.nossoNumero), 8) + // 063-070 Nosso Número
      padNum(0, 13) + // 071-083 Qtde Moeda Variável
      padNum(b.carteira || bankMeta.defaultCarteira, 3) + // 084-086 Carteira
      padAlpha('', 21) + // 087-107 Uso do Banco
      'I' + // 108 Carteira Código
      '01' + // 109-110 Ocorrência (01 = Remessa)
      padAlpha(b.numeroDocumento, 10) + // 111-120 Seu Número / Nº Documento
      vencDDMMAA + // 121-126 Vencimento
      formatMoneyCents(b.valor, 13) + // 127-139 Valor Título
      padNum(bankMeta.code, 3) + // 140-142 Banco Cobrador
      '00000' + // 143-147 Agência Depositária
      '01' + // 148-149 Espécie (01 = DM)
      'N' + // 150 Aceite
      emissaoDDMMAA + // 151-156 Data Emissão
      '00' + // 157-158 Instrução 1
      '00' + // 159-160 Instrução 2
      formatMoneyCents(jurosDia, 13) + // 161-173 Juros Mora por Dia
      (b.desconto > 0 ? vencDDMMAA : '000000') + // 174-179 Data Limite Desconto
      formatMoneyCents(b.desconto, 13) + // 180-192 Valor Desconto
      formatMoneyCents(0, 13) + // 193-205 IOF
      formatMoneyCents(0, 13) + // 206-218 Abatimento
      pagadorTipo + // 219-220 Tipo Inscrição Pagador
      padNum(pagadorDigits, 14) + // 221-234 CPF/CNPJ Pagador
      padAlpha(b.clienteNome, 40) + // 235-274 Nome Pagador
      padAlpha(b.clienteEndereco || 'ENDERECO NAO INFORMADO', 40) + // 275-314 Endereço Pagador
      padAlpha(`PARC ${b.parcela}`, 12) + // 315-326 Mensagem / Bairro
      '00000000' + // 327-334 CEP
      padAlpha('AGROCONTROL', 60) + // 335-394 Sacador / Avalista
      padNum(seq400, 6); // 395-400 Sequencial
    lines.push(det400.slice(0, 400).padEnd(400, ' '));
  });

  // TRAILER (Tipo 9)
  seq400 += 1;
  const trailer400 =
    '9' + // 001 Tipo Registro
    padAlpha('', 393) + // 002-394 Brancos
    padNum(seq400, 6); // 395-400 Sequencial
  lines.push(trailer400.slice(0, 400).padEnd(400, ' '));

  const fileName = `REM_${bankMeta.code}_CNAB400_${todayIso.replace(/-/g, '')}_${padNum(
    sequencialArquivo,
    4
  )}.REM`;

  return {
    fileName,
    content: lines.join('\r\n') + '\r\n',
    standard,
    sequencialArquivo,
    boletosCount: boletos.length,
    totalAmount,
  };
}

// ============================================================================
// LEITOR / PARSER INTELIGENTE DE ARQUIVO RETORNO (.RET) — CNAB 240 E CNAB 400
// ============================================================================

export function buildOpenReceivablesLookup(
  orders: SilageOrder[] = [],
  services: ServiceOrder[] = [],
  notasSaida: NotaSaidaRecord[] = []
): OpenReceivableLookupItem[] {
  const list: OpenReceivableLookupItem[] = [];

  orders.forEach((o) => {
    list.push({
      id: o.id,
      type: 'Venda de Silagem',
      clientName: o.clientName,
      documentHint: o.orderNumber || o.id.slice(-6).toUpperCase(),
      dueDate: o.dueDate || o.deliveryDate || o.date || '',
      amount: Number(o.totalAmount) || 0,
      status: o.paymentStatus === 'pago' ? 'pago' : 'pendente',
    });
  });

  services
    .filter(
      (s) =>
        s.status === 'faturado' ||
        s.billingStatus === 'faturado' ||
        !!s.billedAt ||
        (s.status === 'finalizado' && !!s.billedAt)
    )
    .forEach((s) => {
      list.push({
        id: s.id,
        type: 'Prestação de Serviço',
        clientName: s.clientName,
        documentHint: s.orderNumber || s.id.slice(-6).toUpperCase(),
        dueDate: s.dueDate || s.date || s.startDate || '',
        amount: Number(s.totalAmount) || 0,
        status: s.status === 'finalizado' || s.paymentStatus === 'pago' ? 'pago' : 'pendente',
      });
    });

  notasSaida
    .filter((n) => n.lancarContasReceber && n.status !== 'CANCELADA' && n.status !== 'RASCUNHO')
    .forEach((n) => {
      list.push({
        id: n.id,
        type: 'Nota Fiscal de Saída',
        clientName: n.destinatarioNome || 'Cliente NF',
        documentHint: `${n.numero || ''}`.trim() || n.id.slice(-6).toUpperCase(),
        dueDate: n.dataVencimento || n.dataEmissao || '',
        amount: Number(n.valorTotal) || 0,
        status: n.receberStatus === 'pago' ? 'pago' : 'pendente',
      });
    });

  return list;
}

const mapOcorrenciaCodigo = (
  code: string
): { descricao: string; tipo: CnabOcorrenciaTipo } => {
  const norm = padNum(code, 2);
  switch (norm) {
    case '06':
      return { descricao: '06 - Liquidação Normal', tipo: 'LIQUIDACAO' };
    case '15':
      return { descricao: '15 - Liquidação em Cartório', tipo: 'LIQUIDACAO' };
    case '17':
      return { descricao: '17 - Liquidação após Baixa / Título não Registrado', tipo: 'LIQUIDACAO' };
    case '02':
      return { descricao: '02 - Entrada Confirmada', tipo: 'ENTRADA_CONFIRMADA' };
    case '09':
      return { descricao: '09 - Baixado / Comandado', tipo: 'BAIXADO' };
    case '10':
      return { descricao: '10 - Baixado conforme Instruções', tipo: 'BAIXADO' };
    case '03':
      return { descricao: '03 - Entrada Rejeitada', tipo: 'REJEITADO' };
    case '26':
      return { descricao: '26 - Instrução Rejeitada', tipo: 'REJEITADO' };
    default:
      return { descricao: `${norm} - Ocorrência Bancária`, tipo: 'OUTRO' };
  }
};

function findMatchingBoletoAndReceivable(
  nossoNumero: string,
  numeroDocumento: string,
  identificacaoEmpresa: string,
  boletos: BoletoEmitidoRecord[],
  openReceivables: OpenReceivableLookupItem[]
): {
  boleto?: BoletoEmitidoRecord;
  receivable?: OpenReceivableLookupItem;
} {
  const nnDigits = cleanDigits(nossoNumero);
  const nnNoZeros = nnDigits.replace(/^0+/, '');
  const docNorm = normalizeAscii(numeroDocumento);
  const empNorm = normalizeAscii(identificacaoEmpresa);

  const matchedBoleto = boletos.find((b) => {
    const bNnDigits = cleanDigits(b.nossoNumero);
    const bNnNoZeros = bNnDigits.replace(/^0+/, '');
    const bDocNorm = normalizeAscii(b.numeroDocumento);

    if (nnNoZeros && bNnNoZeros && (bNnNoZeros === nnNoZeros || bNnNoZeros.endsWith(nnNoZeros) || nnNoZeros.endsWith(bNnNoZeros))) {
      return true;
    }
    if (docNorm && bDocNorm && bDocNorm === docNorm) {
      return true;
    }
    if (empNorm && (b.id === empNorm || b.contaReceberId === empNorm)) {
      return true;
    }
    return false;
  });

  if (matchedBoleto) {
    const rec = openReceivables.find((r) => r.id === matchedBoleto.contaReceberId);
    return { boleto: matchedBoleto, receivable: rec };
  }

  const matchedRec = openReceivables.find((r) => {
    const hintNorm = normalizeAscii(r.documentHint);
    const idNorm = normalizeAscii(r.id);
    if (empNorm && (idNorm === empNorm || hintNorm === empNorm)) return true;
    if (docNorm && hintNorm && (docNorm === hintNorm || docNorm.startsWith(`${hintNorm}/`))) {
      return true;
    }
    return false;
  });

  return { receivable: matchedRec };
}

export function parseCnabRetornoContent(
  content: string,
  boletos: BoletoEmitidoRecord[],
  openReceivables: OpenReceivableLookupItem[],
  fileName?: string
): CnabRetornoParseResult {
  const rawLines = content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((l) => l.trim().length > 0);

  if (rawLines.length === 0) {
    throw new Error('O arquivo retorno selecionado está vazio.');
  }

  const firstLine = rawLines[0];
  const isCnab240 =
    firstLine.length <= 260 &&
    firstLine.length >= 200 &&
    (firstLine[7] === '0' || rawLines.some((l) => l.length >= 200 && l.length <= 260 && l[7] === '3'));

  const rows: CnabRetornoParsedRow[] = [];

  if (isCnab240) {
    const bankCode = padNum(firstLine.slice(0, 3), 3);
    const bankNameFromHeader = firstLine.slice(102, 132).trim();
    const bankName = bankNameFromHeader || resolveBoletoBankMeta({ bankCode } as BankAccount).shortName;

    for (let i = 0; i < rawLines.length; i++) {
      const segT = rawLines[i].padEnd(240, ' ');
      if (segT[7] !== '3' || segT[13] !== 'T') continue;

      const segU =
        i + 1 < rawLines.length && rawLines[i + 1][7] === '3' && rawLines[i + 1][13] === 'U'
          ? rawLines[i + 1].padEnd(240, ' ')
          : null;
      if (segU) i += 1;

      const ocorrenciaCodigo = padNum(segT.slice(15, 17), 2);
      const ocorrenciaInfo = mapOcorrenciaCodigo(ocorrenciaCodigo);
      const nossoNumero = segT.slice(37, 57).trim();
      const numeroDocumento = segT.slice(58, 73).trim();
      const vencimento = parseDDMMAAAAtoIso(segT.slice(73, 81));
      const valorTitulo = parseCentsToNumber(segT.slice(81, 96));
      const identificacaoEmpresa = segT.slice(105, 130).trim();
      const nomePagadorSegT = segT.slice(148, 188).trim();

      const jurosMulta = segU ? parseCentsToNumber(segU.slice(17, 32)) : 0;
      const desconto = segU ? parseCentsToNumber(segU.slice(32, 47)) : 0;
      const valorPagoSegU = segU ? parseCentsToNumber(segU.slice(77, 92)) : 0;
      const valorPago =
        ocorrenciaInfo.tipo === 'LIQUIDACAO'
          ? valorPagoSegU > 0
            ? valorPagoSegU
            : Math.max(0, Number((valorTitulo + jurosMulta - desconto).toFixed(2)))
          : valorPagoSegU;
      const dataOcorrencia = segU
        ? parseDDMMAAAAtoIso(segU.slice(137, 145))
        : new Date().toISOString().split('T')[0];
      const dataCredito = segU
        ? parseDDMMAAAAtoIso(segU.slice(145, 153))
        : dataOcorrencia;

      const { boleto, receivable } = findMatchingBoletoAndReceivable(
        nossoNumero,
        numeroDocumento,
        identificacaoEmpresa,
        boletos,
        openReceivables
      );

      rows.push({
        id: `ret_240_${i}_${cleanDigits(nossoNumero) || i}`,
        standard: 'CNAB_240',
        nossoNumero: nossoNumero || boleto?.nossoNumero || '-',
        numeroDocumento: numeroDocumento || boleto?.numeroDocumento || '-',
        identificacaoEmpresa,
        clienteNome:
          boleto?.clienteNome ||
          receivable?.clientName ||
          nomePagadorSegT ||
          'PAGADOR NÃO IDENTIFICADO',
        vencimento: boleto?.vencimento || vencimento,
        dataOcorrencia,
        dataCredito,
        valorTitulo: valorTitulo > 0 ? valorTitulo : boleto?.valor || receivable?.amount || 0,
        valorPago,
        jurosMulta,
        desconto,
        ocorrenciaCodigo,
        ocorrenciaDescricao: ocorrenciaInfo.descricao,
        ocorrenciaTipo: ocorrenciaInfo.tipo,
        matchedBoletoId: boleto?.id,
        matchedContaReceberId: boleto?.contaReceberId || receivable?.id,
        matchedContaReceberTipo: boleto?.contaReceberTipo || receivable?.type,
        alreadyLiquidated:
          boleto?.statusRegistro === 'LIQUIDADO' ||
          (!boleto && receivable?.status === 'pago'),
      });
    }

    const liqRows = rows.filter((r) => r.ocorrenciaTipo === 'LIQUIDACAO');
    return {
      standard: 'CNAB_240',
      bankCode,
      bankName,
      fileName,
      rows,
      totalLiquidacoes: liqRows.length,
      totalValorPago: Number(
        liqRows.reduce((acc, r) => acc + (Number(r.valorPago) || 0), 0).toFixed(2)
      ),
    };
  }

  // CNAB 400
  const headerPadded = firstLine.padEnd(400, ' ');
  const bankCode = padNum(headerPadded.slice(76, 79), 3);
  const bankName =
    headerPadded.slice(79, 94).trim() ||
    resolveBoletoBankMeta({ bankCode } as BankAccount).shortName;

  rawLines.forEach((rawLine, idx) => {
    const line = rawLine.padEnd(400, ' ');
    if (line[0] !== '1') return;

    const identificacaoEmpresa = line.slice(37, 62).trim();
    const nossoNumero = line.slice(62, 70).trim() || line.slice(62, 82).trim();
    const ocorrenciaCodigo = padNum(line.slice(108, 110), 2);
    const ocorrenciaInfo = mapOcorrenciaCodigo(ocorrenciaCodigo);
    const dataOcorrencia = parseDDMMAAtoIso(line.slice(110, 116));
    const numeroDocumento = line.slice(116, 126).trim();
    const vencimento = parseDDMMAAtoIso(line.slice(146, 152));
    const valorTitulo = parseCentsToNumber(line.slice(152, 165));
    const desconto = parseCentsToNumber(line.slice(240, 253));
    const valorPagoRaw = parseCentsToNumber(line.slice(253, 266));
    const jurosMulta = parseCentsToNumber(line.slice(266, 279));
    const dataCredito = parseDDMMAAtoIso(line.slice(295, 301));
    const nomePagador400 = line.slice(324, 364).trim();

    const valorPago =
      ocorrenciaInfo.tipo === 'LIQUIDACAO'
        ? valorPagoRaw > 0
          ? valorPagoRaw
          : Math.max(0, Number((valorTitulo + jurosMulta - desconto).toFixed(2)))
        : valorPagoRaw;

    const { boleto, receivable } = findMatchingBoletoAndReceivable(
      nossoNumero,
      numeroDocumento,
      identificacaoEmpresa,
      boletos,
      openReceivables
    );

    rows.push({
      id: `ret_400_${idx}_${cleanDigits(nossoNumero) || idx}`,
      standard: 'CNAB_400',
      nossoNumero: nossoNumero || boleto?.nossoNumero || '-',
      numeroDocumento: numeroDocumento || boleto?.numeroDocumento || '-',
      identificacaoEmpresa,
      clienteNome:
        boleto?.clienteNome ||
        receivable?.clientName ||
        nomePagador400 ||
        'PAGADOR NÃO IDENTIFICADO',
      vencimento: boleto?.vencimento || vencimento,
      dataOcorrencia,
      dataCredito,
      valorTitulo: valorTitulo > 0 ? valorTitulo : boleto?.valor || receivable?.amount || 0,
      valorPago,
      jurosMulta,
      desconto,
      ocorrenciaCodigo,
      ocorrenciaDescricao: ocorrenciaInfo.descricao,
      ocorrenciaTipo: ocorrenciaInfo.tipo,
      matchedBoletoId: boleto?.id,
      matchedContaReceberId: boleto?.contaReceberId || receivable?.id,
      matchedContaReceberTipo: boleto?.contaReceberTipo || receivable?.type,
      alreadyLiquidated:
        boleto?.statusRegistro === 'LIQUIDADO' ||
        (!boleto && receivable?.status === 'pago'),
    });
  });

  const liqRows = rows.filter((r) => r.ocorrenciaTipo === 'LIQUIDACAO');
  return {
    standard: 'CNAB_400',
    bankCode,
    bankName,
    fileName,
    rows,
    totalLiquidacoes: liqRows.length,
    totalValorPago: Number(
      liqRows.reduce((acc, r) => acc + (Number(r.valorPago) || 0), 0).toFixed(2)
    ),
  };
}

// ============================================================================
// SIMULADOR DE ARQUIVO RETORNO (.RET) PARA TESTE COM DADOS REAIS DO SISTEMA
// ============================================================================

export function generateSampleCnabRetornoContent(
  boletos: BoletoEmitidoRecord[],
  openReceivables: OpenReceivableLookupItem[],
  bankAccount?: BankAccount | null,
  companyProfile?: CompanyProfile | null,
  standard: CnabStandard = 'CNAB_240'
): { fileName: string; content: string } {
  const bankMeta = resolveBoletoBankMeta(bankAccount);
  const beneficiary = resolveBeneficiaryDefaults(companyProfile);
  const companyDigits = cleanDigits(beneficiary.cnpj);
  const tipoInscricao = companyDigits.length > 11 ? '2' : '1';
  const agency = splitAgency(bankAccount?.agency || companyProfile?.bankAgency);
  const account = splitAccount(bankAccount?.accountNumber || companyProfile?.bankAccount);
  const todayIso = new Date().toISOString().split('T')[0];
  const dateDDMMAAAA = formatIsoToDDMMAAAA(todayIso);
  const dateDDMMAA = formatIsoToDDMMAA(todayIso);
  const hhmmss = getNowHHMMSS();

  // Prioriza boletos emitidos ainda não liquidados; se não houver, usa títulos em aberto do Contas a Receber
  const pendingBoletos = boletos.filter((b) => b.statusRegistro !== 'LIQUIDADO');
  const sampleTargets: Array<{
    nossoNumero: string;
    numeroDocumento: string;
    identificacaoEmpresa: string;
    clienteNome: string;
    vencimento: string;
    valorTitulo: number;
    valorPago: number;
    jurosMulta: number;
    desconto: number;
    ocorrencia: '06' | '02';
  }> = [];

  if (pendingBoletos.length > 0) {
    pendingBoletos.slice(0, 5).forEach((b, idx) => {
      const isLiq = idx < 4; // maioria liquidada
      const juros = isLiq && idx === 1 ? Number((b.valor * 0.02).toFixed(2)) : 0;
      const desc = isLiq && idx === 2 && b.desconto > 0 ? b.desconto : 0;
      const pago = isLiq ? Number((b.valor + juros - desc).toFixed(2)) : 0;
      sampleTargets.push({
        nossoNumero: b.nossoNumero,
        numeroDocumento: b.numeroDocumento,
        identificacaoEmpresa: b.contaReceberId || b.id,
        clienteNome: b.clienteNome,
        vencimento: b.vencimento,
        valorTitulo: b.valor,
        valorPago: pago,
        jurosMulta: juros,
        desconto: desc,
        ocorrencia: isLiq ? '06' : '02',
      });
    });
  } else {
    const openOnly = openReceivables.filter((r) => r.status === 'pendente');
    openOnly.slice(0, 4).forEach((r, idx) => {
      sampleTargets.push({
        nossoNumero: `${String(100001 + idx).padStart(8, '0')}`,
        numeroDocumento: r.documentHint,
        identificacaoEmpresa: r.id,
        clienteNome: r.clientName,
        vencimento: r.dueDate || todayIso,
        valorTitulo: r.amount,
        valorPago: r.amount,
        jurosMulta: 0,
        desconto: 0,
        ocorrencia: '06',
      });
    });
  }

  if (sampleTargets.length === 0) {
    sampleTargets.push({
      nossoNumero: '00090001',
      numeroDocumento: 'DOC-DEMO-01',
      identificacaoEmpresa: 'DEMO-01',
      clienteNome: 'FAZENDA MODELO AGROCONTROL LTDA',
      vencimento: todayIso,
      valorTitulo: 1850,
      valorPago: 1850,
      jurosMulta: 0,
      desconto: 0,
      ocorrencia: '06',
    });
  }

  if (standard === 'CNAB_240') {
    const lines: string[] = [];

    const headerArq =
      padNum(bankMeta.code, 3) +
      '0000' +
      '0' +
      padAlpha('', 9) +
      tipoInscricao +
      padNum(companyDigits, 14) +
      padAlpha(account.number.slice(-6), 20) +
      agency.code +
      agency.dv +
      account.number +
      account.dv +
      ' ' +
      padAlpha(beneficiary.nome, 30) +
      padAlpha(bankMeta.shortName, 30) +
      padAlpha('', 10) +
      '2' + // 2 = Retorno
      dateDDMMAAAA +
      hhmmss +
      '000001' +
      '103' +
      '01600' +
      padAlpha('RETORNO', 20) +
      padAlpha('SIMULADO', 20) +
      padAlpha('', 29);
    lines.push(headerArq.slice(0, 240).padEnd(240, ' '));

    const headerLote =
      padNum(bankMeta.code, 3) +
      '0001' +
      '1' +
      'T' + // T = Retorno
      '01' +
      '  ' +
      '060' +
      ' ' +
      tipoInscricao +
      padNum(companyDigits, 15) +
      padAlpha(account.number.slice(-6), 20) +
      agency.code +
      agency.dv +
      account.number +
      account.dv +
      ' ' +
      padAlpha(beneficiary.nome, 30) +
      padAlpha('', 80) +
      '00000001' +
      dateDDMMAAAA +
      dateDDMMAAAA +
      padAlpha('', 33);
    lines.push(headerLote.slice(0, 240).padEnd(240, ' '));

    let seq = 0;
    sampleTargets.forEach((t) => {
      seq += 1;
      const segT =
        padNum(bankMeta.code, 3) +
        '0001' +
        '3' +
        padNum(seq, 5) +
        'T' +
        ' ' +
        t.ocorrencia +
        agency.code +
        agency.dv +
        account.number +
        account.dv +
        ' ' +
        padAlpha(cleanDigits(t.nossoNumero) || t.nossoNumero, 20) +
        '1' +
        padAlpha(t.numeroDocumento, 15) +
        formatIsoToDDMMAAAA(t.vencimento) +
        formatMoneyCents(t.valorTitulo, 15) +
        padNum(bankMeta.code, 3) +
        agency.code +
        agency.dv +
        padAlpha(t.identificacaoEmpresa, 25) +
        '09' +
        '1' +
        padNum(0, 15) +
        padAlpha(t.clienteNome, 40) +
        padAlpha('', 10) +
        formatMoneyCents(0, 15) +
        padAlpha('', 27);
      lines.push(segT.slice(0, 240).padEnd(240, ' '));

      seq += 1;
      const segU =
        padNum(bankMeta.code, 3) +
        '0001' +
        '3' +
        padNum(seq, 5) +
        'U' +
        ' ' +
        t.ocorrencia +
        formatMoneyCents(t.jurosMulta, 15) +
        formatMoneyCents(t.desconto, 15) +
        formatMoneyCents(0, 15) +
        formatMoneyCents(0, 15) +
        formatMoneyCents(t.valorPago, 15) +
        formatMoneyCents(t.valorPago, 15) +
        formatMoneyCents(0, 15) +
        formatMoneyCents(0, 15) +
        dateDDMMAAAA +
        dateDDMMAAAA +
        padAlpha('', 87);
      lines.push(segU.slice(0, 240).padEnd(240, ' '));
    });

    const trailerLote =
      padNum(bankMeta.code, 3) +
      '0001' +
      '5' +
      padAlpha('', 9) +
      padNum(seq + 2, 6) +
      padAlpha('', 217);
    lines.push(trailerLote.slice(0, 240).padEnd(240, ' '));

    const trailerArq =
      padNum(bankMeta.code, 3) +
      '9999' +
      '9' +
      padAlpha('', 9) +
      '000001' +
      padNum(lines.length + 1, 6) +
      padAlpha('', 211);
    lines.push(trailerArq.slice(0, 240).padEnd(240, ' '));

    return {
      fileName: `RET_SIMULADO_${bankMeta.code}_CNAB240_${todayIso.replace(/-/g, '')}.RET`,
      content: lines.join('\r\n') + '\r\n',
    };
  }

  // CNAB 400 Retorno Simulado
  const lines: string[] = [];
  let seq400 = 1;
  const header400 =
    '0' +
    '2' + // 2 = Retorno
    padAlpha('RETORNO', 7) +
    '01' +
    padAlpha('COBRANCA', 15) +
    padAlpha(account.number.slice(-7), 20) +
    padAlpha(beneficiary.nome, 30) +
    padNum(bankMeta.code, 3) +
    padAlpha(bankMeta.shortName, 15) +
    dateDDMMAA +
    padAlpha('', 8) +
    'MX' +
    '0000001' +
    padAlpha('', 277) +
    padNum(seq400, 6);
  lines.push(header400.slice(0, 400).padEnd(400, ' '));

  sampleTargets.forEach((t) => {
    seq400 += 1;
    const det =
      '1' +
      (tipoInscricao === '2' ? '02' : '01') +
      padNum(companyDigits, 14) +
      padNum(agency.code, 4) +
      '00' +
      padNum(account.number, 5) +
      padAlpha(account.dv, 1) +
      padAlpha('', 8) +
      padAlpha(t.identificacaoEmpresa, 25) +
      padNum(cleanDigits(t.nossoNumero), 8) +
      padAlpha('', 38) +
      t.ocorrencia +
      dateDDMMAA +
      padAlpha(t.numeroDocumento, 10) +
      padAlpha('', 20) +
      formatIsoToDDMMAA(t.vencimento) +
      formatMoneyCents(t.valorTitulo, 13) +
      padNum(bankMeta.code, 3) +
      '00000' +
      '01' +
      formatMoneyCents(0, 13) +
      padAlpha('', 52) +
      formatMoneyCents(t.desconto, 13) +
      formatMoneyCents(t.valorPago, 13) +
      formatMoneyCents(t.jurosMulta, 13) +
      formatMoneyCents(0, 13) +
      '   ' +
      dateDDMMAA +
      padAlpha('', 23) +
      padAlpha(t.clienteNome, 40) +
      padAlpha('', 30) +
      padNum(seq400, 6);
    lines.push(det.slice(0, 400).padEnd(400, ' '));
  });

  seq400 += 1;
  const trailer400 = '9' + padAlpha('', 393) + padNum(seq400, 6);
  lines.push(trailer400.slice(0, 400).padEnd(400, ' '));

  return {
    fileName: `RET_SIMULADO_${bankMeta.code}_CNAB400_${todayIso.replace(/-/g, '')}.RET`,
    content: lines.join('\r\n') + '\r\n',
  };
}

export function formatBoletoDueShort(iso?: string): string {
  return iso ? formatDateBR(iso) : '-';
}
