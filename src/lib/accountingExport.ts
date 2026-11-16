import JSZip from 'jszip';
import {
  CompanyProfile,
  DocumentoEntradaRecord,
  Expense,
  NotaSaidaRecord,
} from '../types';
import type { FiscalDocumentRecord } from '../components/nfe/FiscalDocumentTypeView';
import type { MdfeRecord } from '../components/nfe/MdfeView';
import { getMediaFromIndexedDB, saveMediaToIndexedDB } from './imageStorage';
import { CFOP_TIPO_LABELS, getStoredCfopCatalog } from './cfopCatalog';
import { formatCurrencyBRL, formatDateBR } from './storage';
import {
  buildSystemPrintFooterHtml,
  formatSystemSupportPhoneMask,
  resolveSubscriberPrintHeader,
} from './printIdentity';
import { matchesCompetence } from '../components/financial/CompetenceSelector';

export const CONTADOR_CONFIG_STORAGE_KEY = 'agrocontrol_contador_config';

export interface ContadorConfig {
  escritorioNome: string;
  email: string;
  whatsapp: string;
  crcObservacoes: string;
  updatedAt?: string;
}

const DEFAULT_CONTADOR_CONFIG: ContadorConfig = {
  escritorioNome: '',
  email: '',
  whatsapp: '',
  crcObservacoes: '',
};

export function getStoredContadorConfig(): ContadorConfig {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { ...DEFAULT_CONTADOR_CONFIG };
    }
    const raw = localStorage.getItem(CONTADOR_CONFIG_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONTADOR_CONFIG };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_CONTADOR_CONFIG };
    return {
      escritorioNome: typeof parsed.escritorioNome === 'string' ? parsed.escritorioNome : '',
      email: typeof parsed.email === 'string' ? parsed.email : '',
      whatsapp: typeof parsed.whatsapp === 'string' ? parsed.whatsapp : '',
      crcObservacoes: typeof parsed.crcObservacoes === 'string' ? parsed.crcObservacoes : '',
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : undefined,
    };
  } catch {
    return { ...DEFAULT_CONTADOR_CONFIG };
  }
}

export function saveStoredContadorConfig(config: ContadorConfig): ContadorConfig {
  const normalized: ContadorConfig = {
    escritorioNome: (config.escritorioNome || '').trim(),
    email: (config.email || '').trim(),
    whatsapp: formatSystemSupportPhoneMask(config.whatsapp || ''),
    crcObservacoes: (config.crcObservacoes || '').trim(),
    updatedAt: new Date().toISOString(),
  };
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(CONTADOR_CONFIG_STORAGE_KEY, JSON.stringify(normalized));
      window.dispatchEvent(new CustomEvent('agrocontrol_contador_config_updated', { detail: normalized }));
    }
  } catch (e) {
    console.warn('Erro ao salvar configurações do contador:', e);
  }
  return normalized;
}

export function cleanCnpjDigits(value?: string | null): string {
  return String(value || '').replace(/\D/g, '');
}

export function formatCpfCnpjDisplay(value?: string | null): string {
  const digits = cleanCnpjDigits(value);
  if (digits.length === 14) {
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }
  if (digits.length === 11) {
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  }
  return String(value || '').trim();
}

/**
 * Identifica se um tipo de documento representa documento fiscal eletrônico oficial
 * passível de escrituração contábil (NF-e, CT-e, NFS-e, NFC-e, MDF-e).
 */
export function isOfficialFiscalDocumentType(tipo?: string | null): boolean {
  const t = String(tipo || '').trim().toLowerCase();
  if (!t) return false;

  // Bloqueia explicitamente documentos não-fiscais / controle interno
  if (
    t.includes('recibo') ||
    t.includes('não fiscal') ||
    t.includes('nao fiscal') ||
    t.includes('sem valor fiscal') ||
    t.includes('interno') ||
    t.includes('romaneio') ||
    t.includes('avulsa') ||
    t.includes('pedido de compra') ||
    t.includes('pedido_compra') ||
    t === 'outros'
  ) {
    return false;
  }

  // Nota de Produtor manual sem referência eletrônica também fica fora por padrão (pode ser marcada manualmente)
  if (t.includes('nota de produtor') && !t.includes('nf-e') && !t.includes('nfp-e')) {
    return false;
  }

  return (
    t.includes('nf-e') ||
    t.includes('nfe') ||
    t.includes('nota fiscal') ||
    t.includes('xml') ||
    t.includes('ct-e') ||
    t.includes('cte') ||
    t.includes('nfs-e') ||
    t.includes('nfse') ||
    t.includes('nfc-e') ||
    t.includes('nfce') ||
    t.includes('mdf-e') ||
    t.includes('mdfe')
  );
}

export interface ClassificationResult {
  enviarContador: boolean;
  autoDecision: boolean;
  reason: string;
  isOfficialFiscalDoc: boolean;
  isCnpjDivergent: boolean;
}

/**
 * Regra Automática Inteligente para Documentos de Entrada (XML ou Manual):
 * - Compara CNPJ do destinatário com CNPJ da empresa cadastrada.
 * - Se CNPJ bater (ou não informado em entrada manual de NF oficial) E for documento fiscal oficial -> true.
 * - Se for Não Fiscal / Recibo / Nota Avulsa / Romaneio / Cupom sem valor fiscal OU CNPJ destinatário divergente -> false.
 */
export function classifyEntryEnviarContador(params: {
  documentType?: string | null;
  recipientCnpj?: string | null;
  companyCnpj?: string | null;
  isXml?: boolean;
  explicitFlag?: boolean;
}): ClassificationResult {
  const isOfficialFiscalDoc = Boolean(params.isXml) || isOfficialFiscalDocumentType(params.documentType);
  const recDigits = cleanCnpjDigits(params.recipientCnpj);
  const compDigits = cleanCnpjDigits(params.companyCnpj);
  const isCnpjDivergent = Boolean(recDigits && compDigits && recDigits !== compDigits);

  const autoDecision = isOfficialFiscalDoc && !isCnpjDivergent;
  const enviarContador =
    typeof params.explicitFlag === 'boolean' ? params.explicitFlag : autoDecision;

  let reason = 'Fiscal CNPJ da Empresa — Vai ao Contador';
  if (!enviarContador) {
    if (typeof params.explicitFlag === 'boolean' && params.explicitFlag === false && autoDecision) {
      reason = 'Desmarcado manualmente para controle interno';
    } else if (isCnpjDivergent) {
      reason = `CNPJ Destinatário (${formatCpfCnpjDisplay(recDigits)}) diverge do CNPJ da empresa (${formatCpfCnpjDisplay(compDigits)})`;
    } else if (!isOfficialFiscalDoc) {
      reason = `Documento não fiscal / interno (${params.documentType || 'Sem valor fiscal'})`;
    } else {
      reason = 'Apenas Controle Interno (Não irá no pacote do Contador)';
    }
  } else if (typeof params.explicitFlag === 'boolean' && params.explicitFlag === true && !autoDecision) {
    reason = 'Incluído manualmente no fechamento contábil';
  }

  return {
    enviarContador,
    autoDecision,
    reason,
    isOfficialFiscalDoc,
    isCnpjDivergent,
  };
}

/**
 * Regra Automática Inteligente para Documentos de Saída:
 * - NF-e (Venda, Remessa, Retorno), NFS-e, CT-e, NFC-e, MDF-e -> true por padrão.
 * - Recibo / Não Fiscal / Interno -> false por padrão.
 */
export function classifySaidaEnviarContador(params: {
  tipoDocumento?: string | null;
  explicitFlag?: boolean;
}): ClassificationResult {
  const isOfficialFiscalDoc = isOfficialFiscalDocumentType(params.tipoDocumento);
  const autoDecision = isOfficialFiscalDoc;
  const enviarContador =
    typeof params.explicitFlag === 'boolean' ? params.explicitFlag : autoDecision;

  let reason = 'Fiscal CNPJ da Empresa — Vai ao Contador';
  if (!enviarContador) {
    if (!isOfficialFiscalDoc) {
      reason = `Documento não fiscal / interno (${params.tipoDocumento || 'Recibo / Interno'})`;
    } else {
      reason = 'Desmarcado manualmente pelo usuário';
    }
  } else if (typeof params.explicitFlag === 'boolean' && params.explicitFlag === true && !autoDecision) {
    reason = 'Incluído manualmente no fechamento contábil';
  }

  return {
    enviarContador,
    autoDecision,
    reason,
    isOfficialFiscalDoc,
    isCnpjDivergent: false,
  };
}

// ============================================================================
// PERSISTÊNCIA DE XML ORIGINAL NO INDEXEDDB (AgroControlMediaDB)
// ============================================================================

export function buildFiscalXmlStorageKey(idOrAccessKey: string): string {
  const clean = String(idOrAccessKey || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!clean) return '';
  return clean.startsWith('fiscal_xml_') ? clean : `fiscal_xml_${clean}`;
}

export async function saveRawFiscalXml(idOrAccessKey: string, xmlContent: string): Promise<string | undefined> {
  const key = buildFiscalXmlStorageKey(idOrAccessKey);
  if (!key || !xmlContent || !xmlContent.trim()) return undefined;
  const ok = await saveMediaToIndexedDB(key, xmlContent.trim());
  return ok ? key : undefined;
}

export async function loadRawFiscalXml(candidates: Array<string | undefined | null>): Promise<string | undefined> {
  const tried = new Set<string>();
  for (const raw of candidates) {
    const val = String(raw || '').trim();
    if (!val) continue;
    const keysToTry = [val, buildFiscalXmlStorageKey(val)].filter(Boolean);
    for (const k of keysToTry) {
      if (tried.has(k)) continue;
      tried.add(k);
      const found = await getMediaFromIndexedDB(k);
      if (found && found.trim().startsWith('<')) {
        return found;
      }
    }
  }
  return undefined;
}

// ============================================================================
// MODELO UNIFICADO DE AUDITORIA & EXPORTAÇÃO CONTÁBIL
// ============================================================================

export type AccountingSourceKind = 'xml_expense' | 'manual_doc' | 'legacy_fiscal' | 'mdfe' | 'nota_saida';
export type AccountingDocCategory = 'nfe' | 'cte' | 'nfse' | 'nfce' | 'mdfe' | 'outros';

export interface AccountingDocItem {
  id: string;
  sourceKind: AccountingSourceKind;
  direction: 'entrada' | 'saida';
  docCategory: AccountingDocCategory;
  tipoLabel: string;
  numero: string;
  serie: string;
  dataEmissao: string;
  parteNome: string;
  parteCnpjCpf: string;
  recipientCnpj?: string;
  cfop: string;
  statusSefaz: string;
  isCanceledOrDraft: boolean;
  valorTotal: number;
  accessKey: string;
  xmlStorageKey?: string;
  hasOriginalXml: boolean;
  enviarContador: boolean;
  autoDecision: boolean;
  exclusionReason: string;
  isCnpjDivergent: boolean;
  isOfficialFiscalDoc: boolean;
  rawExpense?: Expense;
  rawManualDoc?: DocumentoEntradaRecord;
  rawLegacyFiscalDoc?: FiscalDocumentRecord;
  rawMdfeDoc?: MdfeRecord;
  rawNotaSaida?: NotaSaidaRecord;
}

export function inferDocCategoryFromType(tipo?: string | null): AccountingDocCategory {
  const t = String(tipo || '').toLowerCase();
  if (t.includes('ct-e') || t.includes('cte')) return 'cte';
  if (t.includes('nfs-e') || t.includes('nfse')) return 'nfse';
  if (t.includes('nfc-e') || t.includes('nfce') || t.includes('nfe_c')) return 'nfce';
  if (t.includes('mdf-e') || t.includes('mdfe')) return 'mdfe';
  if (t.includes('nf-e') || t.includes('nfe') || t.includes('nota fiscal') || t.includes('xml')) return 'nfe';
  return 'outros';
}

export function extractCfopFromNotesOrItems(
  explicitCfop?: string | null,
  items?: any[],
  direction: 'entrada' | 'saida' = 'entrada',
  docCategory: AccountingDocCategory = 'nfe',
  natureza?: string | null
): string {
  const cleanExplicit = cleanCnpjDigits(explicitCfop);
  if (cleanExplicit.length === 4) return cleanExplicit;

  if (Array.isArray(items)) {
    for (const it of items) {
      const c = cleanCnpjDigits(it?.cfop);
      if (c.length === 4) return c;
    }
  }

  if (docCategory === 'nfse') return 'ISSQN';
  if (docCategory === 'cte') return direction === 'saida' ? '5352' : '1352';
  if (docCategory === 'mdfe') return 'MDF-e';

  const nat = String(natureza || '').toLowerCase();
  if (direction === 'entrada') {
    if (nat.includes('combust')) return '1653';
    if (nat.includes('imobilizado')) return '1551';
    if (nat.includes('consumo')) return '1556';
    if (nat.includes('devolu')) return '1202';
    if (nat.includes('retorno')) return '1916';
    if (nat.includes('bonifica') || nat.includes('amostra')) return '1910';
    return '1102';
  }
  if (nat.includes('remessa')) return '5915';
  if (nat.includes('retorno') || nat.includes('devolu')) return '5916';
  return '5102';
}

function normalizeIsoDateForComparison(dateStr?: string | null): string {
  if (!dateStr) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.slice(0, 10);
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const [dd, mm, yyyy] = dateStr.split('/');
    return `${yyyy}-${mm}-${dd}`;
  }
  return String(dateStr);
}

export function collectAccountingDocumentsForCompetence(params: {
  competence: string;
  companyProfile: CompanyProfile | null;
  notasFiscaisExibicao: Expense[];
  documentosEntrada: DocumentoEntradaRecord[];
  legacyFiscalDocs: FiscalDocumentRecord[];
  mdfeDocs: MdfeRecord[];
  notasSaida: NotaSaidaRecord[];
}): {
  allDocs: AccountingDocItem[];
  includedDocs: AccountingDocItem[];
  excludedDocs: AccountingDocItem[];
} {
  const {
    competence,
    companyProfile,
    notasFiscaisExibicao,
    documentosEntrada,
    legacyFiscalDocs,
    mdfeDocs,
    notasSaida,
  } = params;

  const companyCnpj = companyProfile?.cnpjCpf || '';
  const list: AccountingDocItem[] = [];
  const seenIds = new Set<string>();
  const seenAccessKeys = new Set<string>();
  const seenDocSignatures = new Set<string>();

  const registerIfUnique = (item: AccountingDocItem) => {
    const cleanId = String(item.id || '').trim();
    if (cleanId && seenIds.has(cleanId)) return;
    if (cleanId) seenIds.add(cleanId);

    const key = cleanCnpjDigits(item.accessKey);
    if (key.length === 44) {
      const kSig = `${item.direction}_${key}`;
      if (seenAccessKeys.has(kSig)) return;
      seenAccessKeys.add(kSig);
    }

    const digitsNum = cleanCnpjDigits(item.numero);
    const partyNorm = item.parteNome.trim().toLowerCase();
    if (digitsNum.length >= 2 && partyNorm) {
      const sig = `${item.direction}_${digitsNum}_${partyNorm}_${item.valorTotal.toFixed(2)}`;
      if (seenDocSignatures.has(sig)) return;
      seenDocSignatures.add(sig);
    }

    list.push(item);
  };

  // 1. Notas de Entrada via XML (Fiscal Records / Expenses)
  notasFiscaisExibicao.forEach((exp) => {
    const expDate =
      exp.issueDate ||
      exp.entryDate ||
      (exp as any).data_emissao ||
      (exp as any).data_entrada ||
      exp.date ||
      exp.dueDate ||
      exp.createdAt ||
      '';
    const inCompetence =
      matchesCompetence(expDate, competence) ||
      matchesCompetence(exp.issueDate, competence) ||
      matchesCompetence(exp.entryDate, competence);
    if (!inCompetence) return;

    const keyMatch =
      exp.accessKey ||
      exp.notes?.match(/Chave:\s*([0-9]{44})/)?.[1] ||
      exp.notes?.match(/\b\d{44}\b/)?.[0] ||
      '';
    const recipientCnpj = exp.recipientCnpj || exp.destinatarioCnpj || '';
    const classification = classifyEntryEnviarContador({
      documentType: 'NF-e',
      recipientCnpj,
      companyCnpj,
      isXml: true,
      explicitFlag: exp.enviarContador,
    });
    const cfop = extractCfopFromNotesOrItems(
      exp.cfop,
      exp.nfeItems,
      'entrada',
      'nfe',
      exp.transactionType || exp.operationNature
    );

    registerIfUnique({
      id: exp.id,
      sourceKind: 'xml_expense',
      direction: 'entrada',
      docCategory: 'nfe',
      tipoLabel: 'NF-e (XML)',
      numero: (exp.invoiceNumber || 'NF-e').replace(/^NF-e\s*/i, '').trim() || 'S/N',
      serie: '1',
      dataEmissao: normalizeIsoDateForComparison(expDate),
      parteNome: (exp.supplier || 'FORNECEDOR NF-E').toUpperCase(),
      parteCnpjCpf: '',
      recipientCnpj,
      cfop,
      statusSefaz: 'AUTORIZADA',
      isCanceledOrDraft: false,
      valorTotal: Number(exp.amount) || 0,
      accessKey: cleanCnpjDigits(keyMatch),
      xmlStorageKey: exp.xmlStorageKey,
      hasOriginalXml: Boolean(exp.xmlStorageKey || keyMatch),
      enviarContador: classification.enviarContador,
      autoDecision: classification.autoDecision,
      exclusionReason: classification.reason,
      isCnpjDivergent: classification.isCnpjDivergent,
      isOfficialFiscalDoc: classification.isOfficialFiscalDoc,
      rawExpense: exp,
    });
  });

  // 2. Documentos de Entrada (Manuais & Espelhos de XML)
  documentosEntrada.forEach((doc) => {
    if (!doc || !doc.id) return;
    const docAny = doc as any;
    const docDate =
      doc.data ||
      doc.data_emissao ||
      doc.data_entrada ||
      docAny.issueDate ||
      doc.data_vencimento ||
      doc.created_at ||
      '';
    const inCompetence =
      matchesCompetence(docDate, competence) ||
      matchesCompetence(doc.data_emissao, competence) ||
      matchesCompetence(doc.data_entrada, competence);
    if (!inCompetence) return;

    const tipo = doc.tipo_documento || docAny.documentTypeLabel || 'Romaneio';
    const isXmlMirror =
      tipo === 'Nota Fiscal' ||
      tipo === 'NF-e' ||
      tipo === 'XML / NF-e' ||
      Boolean(doc.chave_acesso && doc.chave_acesso.length === 44);
    const cat = inferDocCategoryFromType(tipo);
    const recipientCnpj = doc.destinatario_cnpj || '';
    const classification = classifyEntryEnviarContador({
      documentType: tipo,
      recipientCnpj,
      companyCnpj,
      isXml: isXmlMirror,
      explicitFlag: doc.enviarContador,
    });
    const cfop = extractCfopFromNotesOrItems(
      doc.cfop,
      doc.itens,
      'entrada',
      cat,
      doc.natureza_operacao
    );
    const docNum =
      doc.numero ||
      doc.numero_documento ||
      docAny.number ||
      (doc.chave_acesso ? doc.chave_acesso.slice(25, 34).replace(/^0+/, '') : '') ||
      'S/N';
    const isDraftOrCanceled =
      String(doc.status || '').toLowerCase() === 'rascunho' ||
      String(doc.status || '').toLowerCase().includes('cancel');

    registerIfUnique({
      id: doc.id,
      sourceKind: docAny.category ? 'legacy_fiscal' : 'manual_doc',
      direction: 'entrada',
      docCategory: cat,
      tipoLabel: tipo,
      numero: String(docNum),
      serie: doc.serie || '1',
      dataEmissao: normalizeIsoDateForComparison(docDate),
      parteNome: (doc.fornecedor || doc.fornecedor_nome || docAny.supplierName || 'FORNECEDOR').toUpperCase(),
      parteCnpjCpf: doc.fornecedor_cnpj || '',
      recipientCnpj,
      cfop,
      statusSefaz:
        String(doc.status || '').toLowerCase() === 'rascunho'
          ? 'RASCUNHO'
          : isXmlMirror
            ? 'AUTORIZADA'
            : (doc.status || 'FINALIZADO').toUpperCase(),
      isCanceledOrDraft: isDraftOrCanceled,
      valorTotal: Number(doc.valor_total ?? docAny.totalAmount) || 0,
      accessKey: cleanCnpjDigits(doc.chave_acesso),
      xmlStorageKey: doc.xmlStorageKey,
      hasOriginalXml: Boolean(doc.xmlStorageKey),
      enviarContador: classification.enviarContador,
      autoDecision: classification.autoDecision,
      exclusionReason: classification.reason,
      isCnpjDivergent: classification.isCnpjDivergent,
      isOfficialFiscalDoc: classification.isOfficialFiscalDoc,
      rawManualDoc: docAny.category ? undefined : doc,
      rawLegacyFiscalDoc: docAny.category ? (docAny as FiscalDocumentRecord) : undefined,
    });
  });

  // 3. Documentos Fiscais Legados (NF-e / CT-e / NFS-e / NFC-e / Pedido Compra)
  legacyFiscalDocs.forEach((fDoc) => {
    if (!fDoc || !fDoc.id) return;
    const fDate = fDoc.issueDate || fDoc.createdAt || '';
    if (!matchesCompetence(fDate, competence)) return;

    const tipo = fDoc.documentTypeLabel || fDoc.category.toUpperCase();
    const cat = inferDocCategoryFromType(tipo || fDoc.category);
    const classification = classifyEntryEnviarContador({
      documentType: fDoc.category === 'pedido_compra' ? 'Pedido de Compra' : tipo,
      companyCnpj,
      isXml: false,
      explicitFlag: fDoc.enviarContador,
    });
    const statusNorm = String(fDoc.status || 'CONFIRMADO').toUpperCase();
    const isDraftOrCanceled = statusNorm === 'PENDENTE' || statusNorm === 'CANCELADO';

    registerIfUnique({
      id: fDoc.id,
      sourceKind: 'legacy_fiscal',
      direction: 'entrada',
      docCategory: cat,
      tipoLabel: tipo,
      numero: fDoc.number || 'S/N',
      serie: fDoc.series || '1',
      dataEmissao: normalizeIsoDateForComparison(fDate),
      parteNome: (fDoc.supplierName || 'FORNECEDOR').toUpperCase(),
      parteCnpjCpf: fDoc.supplierCnpj || '',
      cfop: extractCfopFromNotesOrItems(fDoc.cfop, fDoc.items, 'entrada', cat, fDoc.description),
      statusSefaz: statusNorm,
      isCanceledOrDraft: isDraftOrCanceled,
      valorTotal: Number(fDoc.totalAmount) || 0,
      accessKey: '',
      hasOriginalXml: false,
      enviarContador: classification.enviarContador,
      autoDecision: classification.autoDecision,
      exclusionReason: classification.reason,
      isCnpjDivergent: classification.isCnpjDivergent,
      isOfficialFiscalDoc: classification.isOfficialFiscalDoc,
      rawLegacyFiscalDoc: fDoc,
    });
  });

  // 4. MDF-e
  mdfeDocs.forEach((mDoc) => {
    if (!mDoc || !mDoc.id) return;
    const mDate = mDoc.dataEmissao || mDoc.createdAt || '';
    if (!matchesCompetence(mDate, competence)) return;

    const classification = classifySaidaEnviarContador({
      tipoDocumento: 'MDF-e',
      explicitFlag: (mDoc as any).enviarContador,
    });
    const statusNorm = String(mDoc.status || 'AUTORIZADO').toUpperCase();

    registerIfUnique({
      id: mDoc.id,
      sourceKind: 'mdfe',
      direction: 'saida',
      docCategory: 'mdfe',
      tipoLabel: 'MDF-e',
      numero: String(mDoc.numero || 'S/N'),
      serie: String((mDoc as any).serie || '1'),
      dataEmissao: normalizeIsoDateForComparison(mDate),
      parteNome: (mDoc.motoristaNome || `VEÍCULO ${mDoc.veiculoPlaca || ''}`).trim().toUpperCase() || 'MANIFESTO DE CARGA',
      parteCnpjCpf: (mDoc as any).motoristaCpf || '',
      cfop: 'MDF-e',
      statusSefaz: statusNorm,
      isCanceledOrDraft: statusNorm.includes('RASCUNHO') || statusNorm.includes('CANCEL'),
      valorTotal: Number(mDoc.valorTotalCarga) || 0,
      accessKey: cleanCnpjDigits(mDoc.chaveAcesso),
      hasOriginalXml: false,
      enviarContador: classification.enviarContador,
      autoDecision: classification.autoDecision,
      exclusionReason: classification.reason,
      isCnpjDivergent: false,
      isOfficialFiscalDoc: true,
      rawMdfeDoc: mDoc,
    });
  });

  // 5. Notas de Saída Emitidas pela Empresa
  notasSaida.forEach((ns) => {
    if (!ns || !ns.id) return;
    const nsDate = ns.dataEmissao || ns.createdAt || '';
    const inCompetence =
      matchesCompetence(nsDate, competence) ||
      matchesCompetence(ns.dataVencimento, competence);
    if (!inCompetence) return;

    const cat = inferDocCategoryFromType(ns.tipoDocumento);
    const classification = classifySaidaEnviarContador({
      tipoDocumento: ns.tipoDocumento,
      explicitFlag: ns.enviarContador,
    });
    const isCte = cat === 'cte';
    const partyName = isCte
      ? (ns.cteTomadorFinalNome || ns.destinatarioNome || 'TOMADOR').toUpperCase()
      : (ns.destinatarioNome || 'CONSUMIDOR AVULSO').toUpperCase();
    const partyCnpj = isCte
      ? (ns.cteTomadorFinalCpfCnpj || ns.destinatarioCpfCnpj || '')
      : (ns.destinatarioCpfCnpj || '');
    const explicitCfop = isCte ? ns.cteCfop : ns.nfeCfop;
    const cfop = extractCfopFromNotesOrItems(
      explicitCfop,
      ns.itens,
      'saida',
      cat,
      ns.nfeNaturezaOperacao
    );
    const statusNorm = String(ns.status || 'EMITIDA').toUpperCase();
    const isDraftOrCanceled = statusNorm === 'RASCUNHO' || statusNorm === 'CANCELADA';

    registerIfUnique({
      id: ns.id,
      sourceKind: 'nota_saida',
      direction: 'saida',
      docCategory: cat,
      tipoLabel: (ns.tipoDocumento || 'NF-e').split(' ')[0],
      numero: String(ns.numero || 'S/N'),
      serie: String(ns.serie || '1'),
      dataEmissao: normalizeIsoDateForComparison(nsDate),
      parteNome: partyName,
      parteCnpjCpf: partyCnpj,
      cfop,
      statusSefaz: statusNorm,
      isCanceledOrDraft: isDraftOrCanceled,
      valorTotal: Number(ns.valorTotal) || 0,
      accessKey: cleanCnpjDigits(ns.chaveAcesso),
      xmlStorageKey: ns.xmlStorageKey,
      hasOriginalXml: Boolean(ns.xmlStorageKey),
      enviarContador: classification.enviarContador,
      autoDecision: classification.autoDecision,
      exclusionReason: classification.reason,
      isCnpjDivergent: false,
      isOfficialFiscalDoc: classification.isOfficialFiscalDoc,
      rawNotaSaida: ns,
    });
  });

  // Ordenação decrescente por data de emissão e número
  list.sort((a, b) => {
    const tA = a.dataEmissao ? new Date(a.dataEmissao).getTime() : 0;
    const tB = b.dataEmissao ? new Date(b.dataEmissao).getTime() : 0;
    if (tB !== tA) return tB - tA;
    return b.numero.localeCompare(a.numero, 'pt-BR', { numeric: true });
  });

  return {
    allDocs: list,
    includedDocs: list.filter((d) => d.enviarContador),
    excludedDocs: list.filter((d) => !d.enviarContador),
  };
}

// ============================================================================
// GERADORES ESTRUTURADOS DE XML FISCAL (FALLBACK QUANDO SEM XML ORIGINAL)
// ============================================================================

function escapeXml(value?: string | number | null): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatXmlAmount(val?: number | null): string {
  return (Number(val) || 0).toFixed(2);
}

function buildIsoDateTimeBr(dateStr?: string): string {
  const clean = normalizeIsoDateForComparison(dateStr) || new Date().toISOString().slice(0, 10);
  return `${clean}T12:00:00-03:00`;
}

function generateDeterministic44Key(item: AccountingDocItem, companyCnpjDigits: string): string {
  if (item.accessKey && item.accessKey.length === 44) return item.accessKey;
  const uf = '41';
  const aamm = (item.dataEmissao || '2026-01-01').replace(/\D/g, '').slice(2, 6).padEnd(4, '0');
  const cnpj = (companyCnpjDigits || '00000000000000').padStart(14, '0').slice(0, 14);
  const mod = item.docCategory === 'nfce' ? '65' : item.docCategory === 'cte' ? '57' : item.docCategory === 'mdfe' ? '58' : '55';
  const serie = cleanCnpjDigits(item.serie || '1').padStart(3, '0').slice(-3);
  const nNF = cleanCnpjDigits(item.numero || '1').padStart(9, '0').slice(-9);
  const tpEmis = '1';
  const cNF = cleanCnpjDigits(item.id).padStart(8, '0').slice(-8);
  const base43 = `${uf}${aamm}${cnpj}${mod}${serie}${nNF}${tpEmis}${cNF}`.slice(0, 43).padEnd(43, '0');
  let sum = 0;
  let weight = 2;
  for (let i = base43.length - 1; i >= 0; i--) {
    sum += Number(base43[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const mod11 = sum % 11;
  const dv = mod11 === 0 || mod11 === 1 ? 0 : 11 - mod11;
  return `${base43}${dv}`;
}

export function buildStructuredFiscalXml(
  item: AccountingDocItem,
  companyProfile: CompanyProfile | null
): string {
  const subscriber = resolveSubscriberPrintHeader(companyProfile);
  const companyCnpj = cleanCnpjDigits(subscriber.cnpjCpf || companyProfile?.cnpjCpf || '');
  const partyDocDigits = cleanCnpjDigits(item.parteCnpjCpf);
  const chave44 = generateDeterministic44Key(item, companyCnpj);
  const nNFDigits = cleanCnpjDigits(item.numero) || '1';
  const serieDigits = cleanCnpjDigits(item.serie) || '1';
  const dhEmi = buildIsoDateTimeBr(item.dataEmissao);

  if (item.docCategory === 'cte') {
    const ns = item.rawNotaSaida;
    const prot = ns?.protocoloAutorizacao || `141${chave44.slice(2, 14)}`;
    return `<?xml version="1.0" encoding="UTF-8"?>
<cteProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/cte">
  <CTe xmlns="http://www.portalfiscal.inf.br/cte">
    <infCte Id="CTe${chave44}" versao="4.00">
      <ide>
        <cUF>41</cUF>
        <cCT>${chave44.slice(35, 43)}</cCT>
        <CFOP>${escapeXml(item.cfop || '5352')}</CFOP>
        <natOp>PRESTACAO DE SERVICO DE TRANSPORTE</natOp>
        <mod>57</mod>
        <serie>${escapeXml(serieDigits)}</serie>
        <nCT>${escapeXml(nNFDigits)}</nCT>
        <dhEmi>${escapeXml(dhEmi)}</dhEmi>
        <tpCTe>0</tpCTe>
        <tpAmb>${ns?.ambienteSefaz === 'producao' ? '1' : '2'}</tpAmb>
        <xMunIni>${escapeXml(ns?.cteMunicipioInicio || subscriber.cityState || 'MUNICIPIO ORIGEM')}</xMunIni>
        <xMunFim>${escapeXml(ns?.cteMunicipioTermino || 'MUNICIPIO DESTINO')}</xMunFim>
      </ide>
      <emit>
        <CNPJ>${escapeXml(companyCnpj || '00000000000000')}</CNPJ>
        <IE>${escapeXml(cleanCnpjDigits(subscriber.stateRegistration) || 'ISENTO')}</IE>
        <xNome>${escapeXml(subscriber.corporateName || subscriber.displayTitle)}</xNome>
      </emit>
      <rem>
        <xNome>${escapeXml(ns?.cteRemetenteNome || subscriber.displayTitle)}</xNome>
      </rem>
      <dest>
        <${partyDocDigits.length === 11 ? 'CPF' : 'CNPJ'}>${escapeXml(partyDocDigits || '00000000000000')}</${partyDocDigits.length === 11 ? 'CPF' : 'CNPJ'}>
        <xNome>${escapeXml(item.parteNome)}</xNome>
      </dest>
      <vPrest>
        <vTPrest>${formatXmlAmount(item.valorTotal)}</vTPrest>
        <vRec>${formatXmlAmount(item.valorTotal)}</vRec>
      </vPrest>
      <infCTeNorm>
        <infCarga>
          <vCarga>${formatXmlAmount(ns?.cteValorCarga || item.valorTotal)}</vCarga>
          <proPred>${escapeXml(ns?.cteProdutoPredominante || 'SILAGEM / CARGA AGRICOLA')}</proPred>
        </infCarga>
      </infCTeNorm>
    </infCte>
  </CTe>
  <protCTe versao="4.00">
    <infProt>
      <chCTe>${chave44}</chCTe>
      <dhRecbto>${escapeXml(dhEmi)}</dhRecbto>
      <nProt>${escapeXml(prot)}</nProt>
      <cStat>${item.isCanceledOrDraft ? '101' : '100'}</cStat>
      <xMotivo>${escapeXml(item.statusSefaz)}</xMotivo>
    </infProt>
  </protCTe>
</cteProc>`;
  }

  if (item.docCategory === 'nfse') {
    const ns = item.rawNotaSaida;
    const issRate = Number(ns?.nfseAliquotaIss ?? 2);
    const issValue = Number(ns?.nfseValorIss ?? (item.valorTotal * issRate) / 100);
    return `<?xml version="1.0" encoding="UTF-8"?>
<CompNfse xmlns="http://www.abrasf.org.br/nfse.xsd">
  <Nfse versao="2.04">
    <InfNfse>
      <Numero>${escapeXml(nNFDigits)}</Numero>
      <CodigoVerificacao>${escapeXml(chave44.slice(0, 9))}</CodigoVerificacao>
      <DataEmissao>${escapeXml(dhEmi)}</DataEmissao>
      <DeclaracaoPrestacaoServico>
        <Competencia>${escapeXml((item.dataEmissao || '').slice(0, 10))}</Competencia>
        <Servico>
          <Valores>
            <ValorServicos>${formatXmlAmount(item.valorTotal)}</ValorServicos>
            <ValorIss>${formatXmlAmount(issValue)}</ValorIss>
            <Aliquota>${issRate.toFixed(2)}</Aliquota>
          </Valores>
          <IssRetido>${ns?.nfseRetencaoIss ? '1' : '2'}</IssRetido>
          <ItemListaServico>${escapeXml(ns?.nfseCodigoServico || '17.05')}</ItemListaServico>
          <Discriminacao>${escapeXml(ns?.descricao || item.rawManualDoc?.observacoes || 'PRESTACAO DE SERVICO AGRICOLA')}</Discriminacao>
        </Servico>
        <Prestador>
          <CpfCnpj><Cnpj>${escapeXml(companyCnpj || '00000000000000')}</Cnpj></CpfCnpj>
          <RazaoSocial>${escapeXml(subscriber.corporateName || subscriber.displayTitle)}</RazaoSocial>
        </Prestador>
        <TomadorServico>
          <IdentificacaoTomador>
            <CpfCnpj><${partyDocDigits.length === 11 ? 'Cpf' : 'Cnpj'}>${escapeXml(partyDocDigits || '00000000000000')}</${partyDocDigits.length === 11 ? 'Cpf' : 'Cnpj'}></CpfCnpj>
          </IdentificacaoTomador>
          <RazaoSocial>${escapeXml(item.parteNome)}</RazaoSocial>
        </TomadorServico>
      </DeclaracaoPrestacaoServico>
    </InfNfse>
  </Nfse>
</CompNfse>`;
  }

  if (item.docCategory === 'mdfe') {
    const md = item.rawMdfeDoc;
    return `<?xml version="1.0" encoding="UTF-8"?>
<mdfeProc versao="3.00" xmlns="http://www.portalfiscal.inf.br/mdfe">
  <MDFe xmlns="http://www.portalfiscal.inf.br/mdfe">
    <infMDFe Id="MDFe${chave44}" versao="3.00">
      <ide>
        <cUF>41</cUF>
        <tpAmb>1</tpAmb>
        <mod>58</mod>
        <serie>${escapeXml(serieDigits)}</serie>
        <nMDF>${escapeXml(nNFDigits)}</nMDF>
        <dhEmi>${escapeXml(dhEmi)}</dhEmi>
        <UFIni>${escapeXml(md?.ufCarregamento || 'PR')}</UFIni>
        <UFFim>${escapeXml(md?.ufDescarregamento || 'PR')}</UFFim>
      </ide>
      <emit>
        <CNPJ>${escapeXml(companyCnpj || '00000000000000')}</CNPJ>
        <xNome>${escapeXml(subscriber.corporateName || subscriber.displayTitle)}</xNome>
      </emit>
      <tot>
        <vCarga>${formatXmlAmount(item.valorTotal)}</vCarga>
        <qCarga>${formatXmlAmount(md?.pesoBrutoTotalKg || 0)}</qCarga>
      </tot>
    </infMDFe>
  </MDFe>
</mdfeProc>`;
  }

  // NF-e / NFC-e estruturada
  const rawItems: any[] =
    item.rawNotaSaida?.itens ||
    item.rawExpense?.nfeItems ||
    item.rawManualDoc?.itens ||
    item.rawLegacyFiscalDoc?.items ||
    [];

  const detXml =
    rawItems.length > 0
      ? rawItems
          .map((it, idx) => {
            const desc = it.descricao || it.description || 'PRODUTO / MERCADORIA';
            const qty = Number(it.quantidade ?? it.quantity ?? 1) || 1;
            const unit = it.unidade || it.unit || 'UN';
            const unitVal = Number(it.valorUnitario ?? it.valor_unitario ?? it.unitPrice ?? item.valorTotal) || 0;
            const totalVal = Number(it.valorTotal ?? it.valor_total ?? it.totalPrice ?? qty * unitVal) || 0;
            const ncm = cleanCnpjDigits(it.ncm) || '00000000';
            const cfop = cleanCnpjDigits(it.cfop) || item.cfop || (item.direction === 'entrada' ? '1102' : '5102');
            const cProd = it.codigo || it.codigo_produto || it.code || String(idx + 1);
            return `      <det nItem="${idx + 1}">
        <prod>
          <cProd>${escapeXml(cProd)}</cProd>
          <xProd>${escapeXml(desc)}</xProd>
          <NCM>${escapeXml(ncm)}</NCM>
          <CFOP>${escapeXml(cfop)}</CFOP>
          <uCom>${escapeXml(unit)}</uCom>
          <qCom>${qty.toFixed(4)}</qCom>
          <vUnCom>${unitVal.toFixed(4)}</vUnCom>
          <vProd>${formatXmlAmount(totalVal)}</vProd>
        </prod>
        <imposto><ICMS><ICMSSN102><orig>0</orig><CSOSN>102</CSOSN></ICMSSN102></ICMS></imposto>
      </det>`;
          })
          .join('\n')
      : `      <det nItem="1">
        <prod>
          <cProd>1</cProd>
          <xProd>${escapeXml(item.rawManualDoc?.observacoes || item.rawExpense?.description || item.tipoLabel)}</xProd>
          <NCM>00000000</NCM>
          <CFOP>${escapeXml(item.cfop || (item.direction === 'entrada' ? '1102' : '5102'))}</CFOP>
          <uCom>UN</uCom>
          <qCom>1.0000</qCom>
          <vUnCom>${item.valorTotal.toFixed(4)}</vUnCom>
          <vProd>${formatXmlAmount(item.valorTotal)}</vProd>
        </prod>
        <imposto><ICMS><ICMSSN102><orig>0</orig><CSOSN>102</CSOSN></ICMSSN102></ICMS></imposto>
      </det>`;

  const isEntrada = item.direction === 'entrada';
  const emitNome = isEntrada ? item.parteNome : subscriber.corporateName || subscriber.displayTitle;
  const emitDoc = isEntrada ? partyDocDigits || '00000000000000' : companyCnpj || '00000000000000';
  const destNome = isEntrada ? subscriber.corporateName || subscriber.displayTitle : item.parteNome;
  const destDoc = isEntrada
    ? cleanCnpjDigits(item.recipientCnpj) || companyCnpj || '00000000000000'
    : partyDocDigits || '00000000000000';

  const mod = item.docCategory === 'nfce' ? '65' : '55';
  const natOp =
    item.rawNotaSaida?.nfeNaturezaOperacao ||
    item.rawExpense?.transactionType ||
    item.rawManualDoc?.natureza_operacao ||
    (isEntrada ? 'COMPRA DE MERCADORIA' : 'VENDA DE MERCADORIA');

  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe xmlns="http://www.portalfiscal.inf.br/nfe">
    <infNFe Id="NFe${chave44}" versao="4.00">
      <ide>
        <cUF>41</cUF>
        <cNF>${chave44.slice(35, 43)}</cNF>
        <natOp>${escapeXml(natOp)}</natOp>
        <mod>${mod}</mod>
        <serie>${escapeXml(serieDigits)}</serie>
        <nNF>${escapeXml(nNFDigits)}</nNF>
        <dhEmi>${escapeXml(dhEmi)}</dhEmi>
        <tpNF>${isEntrada ? '0' : '1'}</tpNF>
        <tpAmb>1</tpAmb>
      </ide>
      <emit>
        <${emitDoc.length === 11 ? 'CPF' : 'CNPJ'}>${escapeXml(emitDoc)}</${emitDoc.length === 11 ? 'CPF' : 'CNPJ'}>
        <xNome>${escapeXml(emitNome)}</xNome>
      </emit>
      <dest>
        <${destDoc.length === 11 ? 'CPF' : 'CNPJ'}>${escapeXml(destDoc)}</${destDoc.length === 11 ? 'CPF' : 'CNPJ'}>
        <xNome>${escapeXml(destNome)}</xNome>
      </dest>
${detXml}
      <total>
        <ICMSTot>
          <vProd>${formatXmlAmount(item.valorTotal)}</vProd>
          <vNF>${formatXmlAmount(item.valorTotal)}</vNF>
        </ICMSTot>
      </total>
    </infNFe>
  </NFe>
  <protNFe versao="4.00">
    <infProt>
      <tpAmb>1</tpAmb>
      <chNFe>${chave44}</chNFe>
      <dhRecbto>${escapeXml(dhEmi)}</dhRecbto>
      <nProt>${escapeXml(item.rawNotaSaida?.protocoloAutorizacao || `141${chave44.slice(2, 14)}`)}</nProt>
      <cStat>${item.isCanceledOrDraft ? '101' : '100'}</cStat>
      <xMotivo>${escapeXml(item.statusSefaz)}</xMotivo>
    </infProt>
  </protNFe>
</nfeProc>`;
}

export async function resolveAccountingDocumentXml(
  item: AccountingDocItem,
  companyProfile: CompanyProfile | null
): Promise<{
  xml: string;
  isOriginal: boolean;
  filename: string;
  folder: '01_XML_ENTRADAS' | '02_XML_SAIDAS_NFE' | '03_XML_CTE_NFSE_NFCE';
}> {
  const original = await loadRawFiscalXml([
    item.xmlStorageKey,
    item.accessKey,
    item.id,
    item.rawExpense?.id,
    item.rawManualDoc?.id,
    item.rawNotaSaida?.id,
  ]);

  let folder: '01_XML_ENTRADAS' | '02_XML_SAIDAS_NFE' | '03_XML_CTE_NFSE_NFCE' = '01_XML_ENTRADAS';
  if (item.docCategory === 'cte' || item.docCategory === 'nfse' || item.docCategory === 'nfce' || item.docCategory === 'mdfe') {
    folder = '03_XML_CTE_NFSE_NFCE';
  } else if (item.direction === 'saida') {
    folder = '02_XML_SAIDAS_NFE';
  } else {
    folder = '01_XML_ENTRADAS';
  }

  const safeNum = (item.numero || item.id).replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeTipo = item.docCategory.toUpperCase();
  const baseKey = item.accessKey && item.accessKey.length === 44 ? item.accessKey : `${safeTipo}_${safeNum}_S${item.serie || '1'}`;
  const filename = `${baseKey}.xml`;

  if (original) {
    return { xml: original, isOriginal: true, filename, folder };
  }
  return {
    xml: buildStructuredFiscalXml(item, companyProfile),
    isOriginal: false,
    filename,
    folder,
  };
}

// ============================================================================
// RESUMO POR CFOP & CSV CONTÁBIL
// ============================================================================

export interface CfopSummaryRow {
  cfop: string;
  descricao: string;
  tipo: string;
  qtdNotas: number;
  valorTotal: number;
}

export function buildCfopSummary(items: AccountingDocItem[]): CfopSummaryRow[] {
  const catalog = getStoredCfopCatalog();
  const catalogMap = new Map(catalog.map((c) => [c.codigo, c]));
  const grouped = new Map<string, CfopSummaryRow>();

  for (const item of items) {
    const cfopKey = (item.cfop || 'N/I').trim();
    const catEntry = catalogMap.get(cfopKey);
    const existing = grouped.get(cfopKey);
    const fallbackDesc =
      cfopKey === 'ISSQN'
        ? 'Prestação de Serviços (ISSQN / NFS-e)'
        : cfopKey === 'MDF-e'
          ? 'Manifesto Eletrônico de Documentos Fiscais'
          : cfopKey.startsWith('1') || cfopKey.startsWith('2')
            ? 'Entrada / Aquisição de Mercadoria ou Serviço'
            : cfopKey.startsWith('5') || cfopKey.startsWith('6')
              ? 'Saída / Prestação Tributada ou Remessa'
              : 'Operação Fiscal Diversa';
    const tipoLabel = catEntry
      ? CFOP_TIPO_LABELS[catEntry.tipo] || catEntry.tipo.toUpperCase()
      : item.direction === 'entrada'
        ? 'Entrada'
        : 'Saída';

    if (existing) {
      existing.qtdNotas += 1;
      existing.valorTotal = Number((existing.valorTotal + item.valorTotal).toFixed(2));
    } else {
      grouped.set(cfopKey, {
        cfop: cfopKey,
        descricao: catEntry?.descricao || fallbackDesc,
        tipo: tipoLabel,
        qtdNotas: 1,
        valorTotal: Number(item.valorTotal.toFixed(2)),
      });
    }
  }

  return Array.from(grouped.values()).sort((a, b) => a.cfop.localeCompare(b.cfop));
}

function escapeCsvCell(val: string | number): string {
  const str = String(val ?? '');
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildAccountingSummaryCsv(params: {
  competence: string;
  companyProfile: CompanyProfile | null;
  items: AccountingDocItem[];
}): string {
  const { competence, companyProfile, items } = params;
  const sub = resolveSubscriberPrintHeader(companyProfile);
  const cfopRows = buildCfopSummary(items);

  const lines: string[] = [];
  lines.push(`FECHAMENTO FISCAL CONTABIL;COMPETENCIA: ${competence}`);
  lines.push(`EMPRESA: ${escapeCsvCell(sub.displayTitle)};CNPJ: ${escapeCsvCell(sub.cnpjCpf)}`);
  lines.push('');
  lines.push('MOVIMENTO;TIPO;NUMERO;SERIE;DATA EMISSAO;EMITENTE / DESTINATARIO;CPF/CNPJ;CFOP;STATUS SEFAZ;ORIGEM XML;CHAVE DE ACESSO;VALOR (R$)');

  for (const doc of items) {
    lines.push(
      [
        doc.direction === 'entrada' ? 'ENTRADA' : 'SAIDA',
        escapeCsvCell(doc.tipoLabel),
        escapeCsvCell(doc.numero),
        escapeCsvCell(doc.serie),
        escapeCsvCell(formatDateBR(doc.dataEmissao)),
        escapeCsvCell(doc.parteNome),
        escapeCsvCell(doc.parteCnpjCpf || '-'),
        escapeCsvCell(doc.cfop),
        escapeCsvCell(doc.statusSefaz),
        doc.hasOriginalXml ? 'XML Original' : 'XML Estruturado Gerado',
        escapeCsvCell(doc.accessKey || '-'),
        formatCurrencyBRL(doc.valorTotal).replace('R$', '').trim(),
      ].join(';')
    );
  }

  lines.push('');
  lines.push('RESUMO POR CFOP / NATUREZA');
  lines.push('CFOP;DESCRICAO;TIPO;QTD NOTAS;VALOR CONTABIL TOTAL (R$)');
  for (const row of cfopRows) {
    lines.push(
      [
        escapeCsvCell(row.cfop),
        escapeCsvCell(row.descricao),
        escapeCsvCell(row.tipo),
        row.qtdNotas,
        formatCurrencyBRL(row.valorTotal).replace('R$', '').trim(),
      ].join(';')
    );
  }

  return '\uFEFF' + lines.join('\r\n');
}

export async function generateAccountingZipPackage(params: {
  competence: string;
  companyProfile: CompanyProfile | null;
  items: AccountingDocItem[];
}): Promise<{
  filename: string;
  xmlCount: number;
  originalCount: number;
  structuredCount: number;
}> {
  const { competence, companyProfile, items } = params;
  const zip = new JSZip();

  // Garante a criação das 3 pastas organizadas
  const dirEntradas = zip.folder('01_XML_ENTRADAS');
  const dirSaidasNfe = zip.folder('02_XML_SAIDAS_NFE');
  const dirCteNfseNfce = zip.folder('03_XML_CTE_NFSE_NFCE');

  let originalCount = 0;
  let structuredCount = 0;
  const usedNames = new Set<string>();

  for (const item of items) {
    const resolved = await resolveAccountingDocumentXml(item, companyProfile);
    if (resolved.isOriginal) originalCount += 1;
    else structuredCount += 1;

    let finalName = resolved.filename;
    const uniquePath = `${resolved.folder}/${finalName}`;
    if (usedNames.has(uniquePath)) {
      finalName = finalName.replace(/\.xml$/i, `_${item.id.slice(-4)}.xml`);
    }
    usedNames.add(`${resolved.folder}/${finalName}`);

    if (resolved.folder === '01_XML_ENTRADAS' && dirEntradas) {
      dirEntradas.file(finalName, resolved.xml);
    } else if (resolved.folder === '02_XML_SAIDAS_NFE' && dirSaidasNfe) {
      dirSaidasNfe.file(finalName, resolved.xml);
    } else if (dirCteNfseNfce) {
      dirCteNfseNfce.file(finalName, resolved.xml);
    }
  }

  const mmAaaa = competence.replace('/', '_');
  const csvContent = buildAccountingSummaryCsv({ competence, companyProfile, items });
  zip.file(`04_RESUMO_CONTABIL_${mmAaaa}.csv`, csvContent);

  const sub = resolveSubscriberPrintHeader(companyProfile);
  const cnpjDigits = cleanCnpjDigits(sub.cnpjCpf || companyProfile?.cnpjCpf || '') || 'EMPRESA';
  const zipFilename = `Fechamento_Fiscal_${cnpjDigits}_${mmAaaa}.zip`;

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = zipFilename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 500);

  return {
    filename: zipFilename,
    xmlCount: items.length,
    originalCount,
    structuredCount,
  };
}

// ============================================================================
// RELATÓRIO A4 DE FECHAMENTO CONTÁBIL (IMPRESSÃO / PDF)
// ============================================================================

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function printAccountingClosingReport(params: {
  competence: string;
  companyProfile: CompanyProfile | null;
  contadorConfig: ContadorConfig;
  items: AccountingDocItem[];
  excludedCount: number;
}): boolean {
  const { competence, companyProfile, contadorConfig, items, excludedCount } = params;
  const sub = resolveSubscriberPrintHeader(companyProfile);
  const cfopRows = buildCfopSummary(items);

  const entradas = items.filter((d) => d.direction === 'entrada');
  const saidasNfe = items.filter((d) => d.direction === 'saida' && d.docCategory === 'nfe');
  const cteNfseNfce = items.filter(
    (d) => d.docCategory === 'cte' || d.docCategory === 'nfse' || d.docCategory === 'nfce' || d.docCategory === 'mdfe'
  );
  const pendentesCanceladas = items.filter((d) => d.isCanceledOrDraft);

  const sumVal = (arr: AccountingDocItem[]) => arr.reduce((acc, d) => acc + (Number(d.valorTotal) || 0), 0);

  const rowsHtml = items
    .map(
      (doc) => `
      <tr>
        <td>${doc.direction === 'entrada' ? 'ENTRADA' : 'SAÍDA'}</td>
        <td>${escapeHtml(doc.tipoLabel)}</td>
        <td style="font-family:monospace;font-weight:700;">${escapeHtml(doc.numero)}/${escapeHtml(doc.serie)}</td>
        <td style="text-align:center;">${escapeHtml(formatDateBR(doc.dataEmissao))}</td>
        <td>${escapeHtml(doc.parteNome)}</td>
        <td style="text-align:center;font-family:monospace;">${escapeHtml(doc.cfop)}</td>
        <td style="text-align:center;">${escapeHtml(doc.statusSefaz)}</td>
        <td style="text-align:center;">${doc.hasOriginalXml ? 'XML Original' : 'Estruturado'}</td>
        <td style="text-align:right;font-family:monospace;font-weight:700;">${escapeHtml(formatCurrencyBRL(doc.valorTotal))}</td>
      </tr>`
    )
    .join('');

  const cfopHtml = cfopRows
    .map(
      (r) => `
      <tr>
        <td style="font-family:monospace;font-weight:700;text-align:center;">${escapeHtml(r.cfop)}</td>
        <td>${escapeHtml(r.descricao)}</td>
        <td>${escapeHtml(r.tipo)}</td>
        <td style="text-align:center;font-weight:700;">${r.qtdNotas}</td>
        <td style="text-align:right;font-family:monospace;font-weight:700;">${escapeHtml(formatCurrencyBRL(r.valorTotal))}</td>
      </tr>`
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Fechamento Fiscal Contábil - ${escapeHtml(competence)}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111827; font-size: 11px; margin: 0; padding: 0; }
    .header { border: 1.5px solid #000; padding: 10px 12px; background: #f8fafc; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
    .company-title { font-size: 15px; font-weight: 900; text-transform: uppercase; margin: 0 0 3px 0; }
    .meta { font-size: 10px; color: #334155; line-height: 1.4; }
    .badge-comp { border: 1.5px solid #000; background: #e0e7ff; color: #1e1b4b; padding: 6px 10px; font-weight: 900; font-size: 12px; text-align: center; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 10px; }
    .kpi { border: 1px solid #334155; padding: 7px 9px; background: #fff; }
    .kpi-label { font-size: 9px; font-weight: 800; text-transform: uppercase; color: #475569; }
    .kpi-val { font-size: 13px; font-weight: 900; margin-top: 3px; font-family: monospace; }
    .section-title { font-size: 11px; font-weight: 900; text-transform: uppercase; background: #e2e8f0; border: 1px solid #000; padding: 4px 8px; margin: 10px 0 0 0; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    th, td { border: 1px solid #64748b; padding: 4px 6px; font-size: 9.5px; }
    th { background: #f1f5f9; font-weight: 800; text-transform: uppercase; text-align: left; }
    .shield { border: 1px solid #047857; background: #ecfdf5; color: #064e3b; padding: 6px 8px; font-size: 9.5px; margin-bottom: 10px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company-title">${escapeHtml(sub.displayTitle)}</div>
      <div class="meta">
        ${sub.corporateName && sub.corporateName !== sub.displayTitle ? `Razão Social: <strong>${escapeHtml(sub.corporateName)}</strong><br/>` : ''}
        ${sub.cnpjCpf ? `CNPJ/CPF: <strong>${escapeHtml(sub.cnpjCpf)}</strong>` : ''} ${sub.stateRegistration ? ` • IE: <strong>${escapeHtml(sub.stateRegistration)}</strong>` : ''}<br/>
        ${sub.fullAddress ? `${escapeHtml(sub.fullAddress)}<br/>` : ''}
        ${contadorConfig.escritorioNome ? `Contabilidade Destinatária: <strong>${escapeHtml(contadorConfig.escritorioNome)}</strong>` : ''}
        ${contadorConfig.email ? ` • E-mail: ${escapeHtml(contadorConfig.email)}` : ''}
      </div>
    </div>
    <div class="badge-comp">
      FECHAMENTO CONTÁBIL<br/>
      COMPETÊNCIA ${escapeHtml(competence)}
    </div>
  </div>

  <div class="shield">
    Filtro Contábil Ativo: Somente documentos fiscais vinculados ao CNPJ da empresa constam neste fechamento (${excludedCount} lançamento(s) interno(s) / não fiscal(is) / outros CNPJs foram excluídos automaticamente).
  </div>

  <div class="kpis">
    <div class="kpi">
      <div class="kpi-label">Entradas (${entradas.length})</div>
      <div class="kpi-val">${escapeHtml(formatCurrencyBRL(sumVal(entradas)))}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Saídas NF-e (${saidasNfe.length})</div>
      <div class="kpi-val">${escapeHtml(formatCurrencyBRL(sumVal(saidasNfe)))}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">CT-e / NFS-e / NFC-e (${cteNfseNfce.length})</div>
      <div class="kpi-val">${escapeHtml(formatCurrencyBRL(sumVal(cteNfseNfce)))}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Rascunhos / Canceladas (${pendentesCanceladas.length})</div>
      <div class="kpi-val">${escapeHtml(formatCurrencyBRL(sumVal(pendentesCanceladas)))}</div>
    </div>
  </div>

  <div class="section-title">Resumo por CFOP &amp; Natureza de Operação</div>
  <table>
    <thead>
      <tr>
        <th style="width:70px;text-align:center;">CFOP</th>
        <th>Descrição</th>
        <th style="width:120px;">Tipo</th>
        <th style="width:70px;text-align:center;">Qtd Notas</th>
        <th style="width:120px;text-align:right;">Valor Total</th>
      </tr>
    </thead>
    <tbody>
      ${cfopHtml || '<tr><td colspan="5" style="text-align:center;">Nenhum CFOP apurado.</td></tr>'}
    </tbody>
  </table>

  <div class="section-title">Relação Completa de Documentos Fiscais do Lote (${items.length})</div>
  <table>
    <thead>
      <tr>
        <th style="width:65px;">Mov.</th>
        <th style="width:80px;">Tipo</th>
        <th style="width:75px;">Nº / Série</th>
        <th style="width:68px;text-align:center;">Data</th>
        <th>Emitente / Destinatário</th>
        <th style="width:55px;text-align:center;">CFOP</th>
        <th style="width:75px;text-align:center;">Status SEFAZ</th>
        <th style="width:75px;text-align:center;">XML</th>
        <th style="width:95px;text-align:right;">Valor (R$)</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="9" style="text-align:center;">Nenhum documento selecionado.</td></tr>'}
    </tbody>
  </table>

  ${buildSystemPrintFooterHtml({ extraRight: `Lote com ${items.length} XML(s)` })}
</body>
</html>`;

  const printWin = window.open('', '_blank', 'width=980,height=720');
  if (printWin) {
    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      try {
        printWin.print();
      } catch {
        // ignore
      }
    }, 350);
    return true;
  }

  // Fallback iframe oculto caso popup seja bloqueado no iframe
  try {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 300);
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}
