import type {
  CostCenter,
  DocumentoEntradaRecord,
  Expense,
  PaymentMethod,
} from '../types';
import type { FiscalDocumentRecord } from '../components/nfe/FiscalDocumentTypeView';
import {
  getActiveCompanyId,
  getDeletedDocumentoEntradaIds,
  getStoredCostCenters,
  getStoredDocumentosEntrada,
  getStoredExpenses,
  isCorruptedOrGhostDocumento,
  saveCompanyDespesas,
  saveStoredExpenses,
} from './storage';
import { determineFinancialCategory, toValidUUID } from './supabaseService';

export interface ReconcileFiscalCandidate {
  id: string;
  source: 'fiscal_record' | 'documento_entrada' | 'legacy_fiscal';
  invoiceNumber: string;
  invoiceDigits: string;
  accessKey?: string;
  supplier: string;
  supplierToken: string;
  amount: number;
  issueDate: string;
  dueDate: string;
  entryDate?: string;
  description?: string;
  categoryId?: string;
  categoryName?: string;
  categoryColor?: string;
  costCenterId?: string;
  costCenterName?: string;
  paymentMethod?: PaymentMethod | string;
  operationNature?: string;
  transactionType?: string;
  notes?: string;
  nfeItems?: any[];
  createdAt?: string;
  installments?: Array<{
    number?: string;
    dueDate?: string;
    amount?: number;
    paymentMethod?: string;
  }>;
}

export function normalizeFiscalInvoiceDigits(raw?: string): string {
  const digits = String(raw ?? '').replace(/\D/g, '').trim();
  if (!digits) return '';
  return digits.replace(/^0+/, '') || '0';
}

export function normalizeSupplierToken(raw?: string): string {
  return String(raw ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function isGenericSupplier(raw?: string): boolean {
  const token = normalizeSupplierToken(raw);
  return (
    !token ||
    token === 'fornecedor' ||
    token === 'fornecedorni' ||
    token === 'fornecedornfe' ||
    token === 'fornecedorlocal'
  );
}

function extractCleanInvoiceNumber(raw?: string): string {
  if (!raw) return '';
  return String(raw)
    .replace(/\s*\(\s*\d+\s*[\/\-de\s]+\s*\d+\s*\)/gi, '')
    .replace(/\s*[-–/]\s*parc(ela)?\.?\s*\d+/gi, '')
    .replace(/\s*parc(ela)?\.?\s*\d+/gi, '')
    .replace(/\s*\(?\s*P\d+\s*\)?/gi, '')
    .trim();
}

function stripIdPrefixesAndSuffixes(rawId?: string): string {
  return String(rawId ?? '')
    .trim()
    .split('_parc_')[0]
    .replace(/^(nfe_fisc_|exp_nfe_sync_|exp_nfe_|pagar_|desp_nfe_|doc_nfe_)/, '')
    .toLowerCase();
}

function getExpenseNumericAmount(e: any): number {
  if (!e || typeof e !== 'object') return 0;
  if (typeof e.amount === 'number' && !isNaN(e.amount)) return e.amount;
  if (typeof e.valor_parcela === 'number' && !isNaN(e.valor_parcela)) return e.valor_parcela;
  if (typeof e.valor === 'number' && !isNaN(e.valor)) return e.valor;
  const parsed = parseFloat(
    String(e.amount ?? e.valor_parcela ?? e.valor ?? '0')
      .replace(/\./g, '')
      .replace(',', '.')
  );
  return isNaN(parsed) ? 0 : parsed;
}

function suppliersMatch(supA?: string, supB?: string): boolean {
  if (isGenericSupplier(supA) || isGenericSupplier(supB)) return true;
  const tokA = normalizeSupplierToken(supA);
  const tokB = normalizeSupplierToken(supB);
  if (!tokA || !tokB) return true;
  if (tokA === tokB) return true;
  const prefixA = tokA.slice(0, 8);
  const prefixB = tokB.slice(0, 8);
  return (
    (prefixA.length >= 4 && tokB.includes(prefixA)) ||
    (prefixB.length >= 4 && tokA.includes(prefixB))
  );
}

export function hasMatchingPayableForFiscalDoc(
  candidate: Pick<
    ReconcileFiscalCandidate,
    'id' | 'invoiceNumber' | 'invoiceDigits' | 'accessKey' | 'supplier' | 'amount' | 'issueDate'
  >,
  expensesList: Expense[]
): boolean {
  if (!Array.isArray(expensesList) || expensesList.length === 0) return false;

  const docId = String(candidate.id || '').trim();
  const docRoot = stripIdPrefixesAndSuffixes(docId);
  const docUuid = docId ? toValidUUID(docId) : '';
  const docAccessKey = String(candidate.accessKey || '').replace(/\D/g, '').trim();
  const docDigits = candidate.invoiceDigits || normalizeFiscalInvoiceDigits(candidate.invoiceNumber);
  const docCleanNum = extractCleanInvoiceNumber(candidate.invoiceNumber).toLowerCase();

  return expensesList.some((exp: any) => {
    if (!exp || !exp.id) return false;

    const amt = getExpenseNumericAmount(exp);
    const isSettledAbatido = exp.status === 'Liquidado / Abatido por Devolução';
    if (amt <= 0 && !isSettledAbatido) return false;

    const expId = String(exp.id || '').trim();
    const expRoot = stripIdPrefixesAndSuffixes(expId);
    const expNotaId = String(exp.notaId || '').trim();
    const expDocEntId = String(exp.documento_entrada_id || '').trim();
    const expNfId = String(exp.nota_fiscal_id || '').trim();

    if (docId) {
      if (
        expId === docId ||
        expNotaId === docId ||
        expDocEntId === docId ||
        expNfId === docId ||
        expId.startsWith(`${docId}_parc_`) ||
        expId.includes(docId)
      ) {
        return true;
      }
      if (
        docUuid &&
        (toValidUUID(expId) === docUuid ||
          (expNotaId && toValidUUID(expNotaId) === docUuid) ||
          (expDocEntId && toValidUUID(expDocEntId) === docUuid) ||
          (expNfId && toValidUUID(expNfId) === docUuid))
      ) {
        return true;
      }
    }

    if (docRoot && docRoot.length >= 4 && expRoot && expRoot === docRoot) {
      return true;
    }

    if (docAccessKey && docAccessKey.length === 44) {
      const expKey = String(exp.accessKey || '').replace(/\D/g, '').trim();
      if (expKey === docAccessKey) return true;
      if (typeof exp.notes === 'string' && exp.notes.replace(/\D/g, '').includes(docAccessKey)) {
        return true;
      }
    }

    const expCleanNum = extractCleanInvoiceNumber(exp.invoiceNumber).toLowerCase();
    const expDigits = normalizeFiscalInvoiceDigits(exp.invoiceNumber);
    if (docDigits && docDigits.length >= 3 && expDigits === docDigits) {
      if (suppliersMatch(candidate.supplier, exp.supplier || exp.fornecedor)) {
        return true;
      }
    }

    if (
      docCleanNum &&
      docCleanNum !== 'nf-e' &&
      docCleanNum !== 'nota fiscal' &&
      expCleanNum &&
      expCleanNum === docCleanNum &&
      suppliersMatch(candidate.supplier, exp.supplier || exp.fornecedor)
    ) {
      return true;
    }

    // Fallback para documentos manuais sem número numérico (ex: Romaneio/Recibo)
    if (!docDigits && candidate.issueDate && candidate.amount > 0) {
      const expDate = String(exp.date || exp.issueDate || exp.dueDate || '').split('T')[0];
      const candDate = String(candidate.issueDate || '').split('T')[0];
      if (
        expDate &&
        candDate &&
        expDate === candDate &&
        Math.abs(amt - candidate.amount) < 0.05 &&
        suppliersMatch(candidate.supplier, exp.supplier || exp.fornecedor)
      ) {
        return true;
      }
    }

    return false;
  });
}

function normalizePaymentMethod(raw?: string): PaymentMethod {
  const v = String(raw || '').toLowerCase().trim();
  if (v === 'pix' || v.includes('pix')) return 'pix';
  if (v === 'transferencia' || v.includes('transf') || v.includes('ted') || v.includes('doc')) {
    return 'transferencia';
  }
  if (v === 'cartao_credito' || v.includes('crédito') || v.includes('credito')) {
    return 'cartao_credito';
  }
  if (v === 'cartao_debito' || v.includes('débito') || v.includes('debito')) {
    return 'cartao_debito';
  }
  if (v === 'dinheiro' || v.includes('dinheiro') || v.includes('espécie')) {
    return 'dinheiro';
  }
  if (v === 'cheque' || v.includes('cheque')) return 'cheque';
  if (v === 'safra_prazo' || v.includes('safra')) return 'safra_prazo';
  return 'boleto';
}

function isCancelledOrDraftStatus(status?: string): boolean {
  const s = String(status || '').trim().toLowerCase();
  return (
    s === 'rascunho' ||
    s === 'cancelada' ||
    s === 'cancelado' ||
    s === 'compensado_estoque'
  );
}

function calculateFallbackDueDate(baseDate: string): string {
  const dateStr = String(baseDate || '').split('T')[0];
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (!isNaN(d.getTime())) {
      d.setDate(d.getDate() + 30);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;
    }
  }
  const fallback = new Date();
  fallback.setDate(fallback.getDate() + 30);
  return fallback.toISOString().split('T')[0];
}

export function reconcileMissingFiscalPayables(params: {
  currentExpenses?: Expense[];
  documentosEntrada?: DocumentoEntradaRecord[];
  fiscalRecords?: Expense[];
  legacyFiscalDocs?: FiscalDocumentRecord[];
  cachedNfeMap?: Record<string, any>;
  costCenters?: CostCenter[];
  deletedNfeKeys?: Set<string>;
  deletedDocIds?: Set<string>;
  isBlockedOperationFn?: (type?: string) => boolean;
}): {
  createdPayables: Expense[];
  nextExpenses: Expense[];
  reconciledDocIds: string[];
} {
  const storedExpenses = getStoredExpenses();
  const baseExpensesMap = new Map<string, Expense>();
  [...storedExpenses, ...(params.currentExpenses || [])].forEach((e) => {
    if (e && e.id) {
      baseExpensesMap.set(e.id, e);
    }
  });
  const allKnownExpenses = Array.from(baseExpensesMap.values());

  const deletedKeys = params.deletedNfeKeys || new Set<string>();
  const deletedDocIds = params.deletedDocIds || getDeletedDocumentoEntradaIds();
  const isBlocked =
    params.isBlockedOperationFn ||
    ((type?: string) => {
      const t = String(type || '').trim().toUpperCase();
      return (
        t === 'DEVOLUÇÃO MERCADORIA DE CLIENTE' ||
        t.includes('BONIFICAÇÃO') ||
        t.includes('AMOSTRA GRÁTIS') ||
        t.includes('GARANTIA') ||
        t.includes('SINISTRO') ||
        t.includes('ATIVO IMOBILIZADO')
      );
    });

  const isDeletedCandidate = (id?: string, num?: string, accessKey?: string): boolean => {
    const cleanId = String(id || '').trim().toLowerCase();
    const cleanNum = extractCleanInvoiceNumber(num).toLowerCase();
    const digits = normalizeFiscalInvoiceDigits(num);
    const key = String(accessKey || '').trim().toLowerCase();
    if (id && deletedDocIds.has(id)) return true;
    if (cleanId && deletedKeys.has(cleanId)) return true;
    if (cleanNum && deletedKeys.has(cleanNum)) return true;
    if (digits && deletedKeys.has(digits)) return true;
    if (key && deletedKeys.has(key)) return true;
    return false;
  };

  const candidates: ReconcileFiscalCandidate[] = [];
  const seenSignatures = new Set<string>();
  const cachedMap = params.cachedNfeMap || {};
  const availableCostCenters =
    params.costCenters && params.costCenters.length > 0
      ? params.costCenters
      : getStoredCostCenters();
  const defaultCC =
    availableCostCenters.find((c) => String(c.name || '').toLowerCase() === 'geral') ||
    availableCostCenters[0];

  const registerCandidate = (cand: ReconcileFiscalCandidate) => {
    if (!cand.id || cand.amount <= 0) return;
    if (isDeletedCandidate(cand.id, cand.invoiceNumber, cand.accessKey)) return;

    const idSig = `id_${cand.id.toLowerCase()}`;
    const keySig =
      cand.accessKey && cand.accessKey.replace(/\D/g, '').length === 44
        ? `key_${cand.accessKey.replace(/\D/g, '')}`
        : '';
    const numSig =
      cand.invoiceDigits && cand.invoiceDigits.length >= 3 && cand.supplierToken
        ? `num_${cand.invoiceDigits}_${cand.supplierToken.slice(0, 12)}`
        : '';

    if (seenSignatures.has(idSig)) return;
    if (keySig && seenSignatures.has(keySig)) return;
    if (numSig && seenSignatures.has(numSig)) return;

    seenSignatures.add(idSig);
    if (keySig) seenSignatures.add(keySig);
    if (numSig) seenSignatures.add(numSig);
    candidates.push(cand);
  };

  // 1. Registros fiscais consolidados (NF-e XML / Fiscal)
  const fiscalList = params.fiscalRecords || [];
  fiscalList.forEach((fr: any) => {
    if (!fr || !fr.id) return;
    if (fr.skipAccountsPayable || fr.isDreOnly) return;
    if (isCancelledOrDraftStatus(fr.status)) return;
    if (isBlocked(fr.transactionType || fr.operationNature)) return;
    const amt = getExpenseNumericAmount(fr);
    if (amt <= 0) return;

    const cleanNum = extractCleanInvoiceNumber(fr.invoiceNumber) || fr.invoiceNumber || 'NF-e';
    const digits = normalizeFiscalInvoiceDigits(cleanNum);
    const accessKeyMatch =
      fr.accessKey ||
      (typeof fr.notes === 'string' ? fr.notes.match(/\b(\d{44})\b/)?.[1] : undefined);
    const cached =
      cachedMap[fr.id] ||
      (cleanNum && cachedMap[cleanNum.toLowerCase()]) ||
      (digits && cachedMap[digits]) ||
      (accessKeyMatch && cachedMap[accessKeyMatch]);

    const issueDate =
      fr.issueDate ||
      fr.date ||
      fr.entryDate ||
      fr.dueDate ||
      (fr.createdAt ? String(fr.createdAt).split('T')[0] : new Date().toISOString().split('T')[0]);
    const dueDate = fr.dueDate || cached?.dueDate || calculateFallbackDueDate(issueDate);

    registerCandidate({
      id: fr.id,
      source: 'fiscal_record',
      invoiceNumber: cleanNum,
      invoiceDigits: digits,
      accessKey: accessKeyMatch,
      supplier: String(fr.supplier || cached?.supplier || 'Fornecedor NF-e').trim(),
      supplierToken: normalizeSupplierToken(fr.supplier || cached?.supplier),
      amount: amt,
      issueDate,
      dueDate,
      entryDate: fr.entryDate || issueDate,
      description: fr.description,
      categoryId: fr.categoryId,
      categoryName: fr.categoryName,
      categoryColor: fr.categoryColor,
      costCenterId: fr.costCenterId || cached?.costCenterId,
      costCenterName: fr.costCenterName || cached?.costCenterName,
      paymentMethod: fr.paymentMethod || cached?.paymentMethod || 'boleto',
      operationNature: fr.operationNature || cached?.operationNature,
      transactionType: fr.transactionType || cached?.transactionType,
      notes: fr.notes,
      nfeItems: fr.nfeItems || cached?.items,
      createdAt: fr.createdAt,
      installments: Array.isArray(cached?.installments) ? cached.installments : undefined,
    });
  });

  // 2. Documentos de Entrada (XML gravados em documentos_entrada + entradas manuais finalizadas)
  const docsEntrada = params.documentosEntrada || getStoredDocumentosEntrada();
  docsEntrada.forEach((doc: any) => {
    if (!doc || !doc.id || isCorruptedOrGhostDocumento(doc)) return;
    if (isCancelledOrDraftStatus(doc.status)) return;
    if (doc.skipAccountsPayable || doc.isDreOnly) return;
    if (isBlocked(doc.natureza_operacao || doc.operationNature || doc.transactionType)) return;
    const amt = Number(doc.valor_total ?? doc.totalAmount ?? 0);
    if (isNaN(amt) || amt <= 0) return;

    const rawNum =
      doc.numero ||
      doc.numero_documento ||
      doc.number ||
      (doc.chave_acesso ? doc.chave_acesso.slice(25, 34) : '') ||
      doc.tipo_documento ||
      'DOC';
    const cleanNum = extractCleanInvoiceNumber(String(rawNum));
    const digits = normalizeFiscalInvoiceDigits(cleanNum);
    const accessKey = doc.chave_acesso ? String(doc.chave_acesso).replace(/\D/g, '') : undefined;
    const cached =
      cachedMap[doc.id] ||
      (cleanNum && cachedMap[cleanNum.toLowerCase()]) ||
      (digits && cachedMap[digits]) ||
      (accessKey && cachedMap[accessKey]);

    const issueDate =
      doc.data_emissao ||
      doc.data ||
      doc.data_entrada ||
      (doc.created_at ? String(doc.created_at).split('T')[0] : new Date().toISOString().split('T')[0]);
    const dueDate =
      doc.data_vencimento || cached?.dueDate || calculateFallbackDueDate(issueDate);
    const supplier = String(doc.fornecedor || doc.fornecedor_nome || cached?.supplier || 'Fornecedor').trim();

    registerCandidate({
      id: doc.id,
      source: 'documento_entrada',
      invoiceNumber: cleanNum,
      invoiceDigits: digits,
      accessKey,
      supplier,
      supplierToken: normalizeSupplierToken(supplier),
      amount: amt,
      issueDate,
      dueDate,
      entryDate: doc.data_entrada || issueDate,
      description: doc.descricao || doc.observacoes,
      costCenterId: doc.costCenterId || cached?.costCenterId,
      costCenterName: doc.costCenterName || cached?.costCenterName,
      paymentMethod: doc.condicao_pagamento || cached?.paymentMethod || 'boleto',
      operationNature: doc.natureza_operacao || doc.operationNature,
      transactionType: doc.transactionType,
      notes: doc.observacoes,
      nfeItems: Array.isArray(doc.itens) ? doc.itens : cached?.items,
      createdAt: doc.created_at,
      installments: Array.isArray(cached?.installments) ? cached.installments : undefined,
    });
  });

  // 3. Documentos fiscais legados (agrocontrol_notas_nfe / cte / nfec / nfse)
  const legacyDocs = params.legacyFiscalDocs || [];
  legacyDocs.forEach((fDoc) => {
    if (!fDoc || !fDoc.id) return;
    if (fDoc.category === 'pedido_compra') return;
    if (isCancelledOrDraftStatus(fDoc.status)) return;
    const amt = Number(fDoc.netPayableAmount ?? fDoc.totalAmount ?? 0);
    if (isNaN(amt) || amt <= 0) return;

    const cleanNum = extractCleanInvoiceNumber(fDoc.number) || fDoc.documentTypeLabel || 'NF';
    const digits = normalizeFiscalInvoiceDigits(cleanNum);
    const issueDate =
      fDoc.issueDate ||
      (fDoc.createdAt ? String(fDoc.createdAt).split('T')[0] : new Date().toISOString().split('T')[0]);
    const firstDue =
      Array.isArray(fDoc.installments) && fDoc.installments[0]?.dueDate
        ? fDoc.installments[0].dueDate
        : calculateFallbackDueDate(issueDate);

    registerCandidate({
      id: fDoc.id,
      source: 'legacy_fiscal',
      invoiceNumber: cleanNum,
      invoiceDigits: digits,
      supplier: String(fDoc.supplierName || 'Fornecedor').trim(),
      supplierToken: normalizeSupplierToken(fDoc.supplierName),
      amount: amt,
      issueDate,
      dueDate: firstDue,
      description: fDoc.description,
      paymentMethod: fDoc.paymentMethod || 'boleto',
      notes: fDoc.notes,
      nfeItems: fDoc.items as any[],
      createdAt: fDoc.createdAt,
      installments: Array.isArray(fDoc.installments) ? fDoc.installments : undefined,
    });
  });

  const activeCompanyId = getActiveCompanyId() || 'default';
  const createdPayables: Expense[] = [];
  const reconciledDocIds: string[] = [];

  for (const cand of candidates) {
    if (hasMatchingPayableForFiscalDoc(cand, [...allKnownExpenses, ...createdPayables])) {
      continue;
    }

    const primaryCategory = determineFinancialCategory(
      cand.nfeItems,
      `${cand.supplier} ${cand.description || ''} ${cand.notes || ''}`
    );
    const isCombustivel = primaryCategory === 'Combustível & Arla';
    const categoryId = cand.categoryId || (isCombustivel ? 'cat_combustivel' : 'cat_insumos');
    const categoryName = cand.categoryName || primaryCategory;
    const categoryColor = cand.categoryColor || (isCombustivel ? '#d97706' : '#059669');
    const costCenterId = cand.costCenterId || defaultCC?.id;
    const costCenterName = cand.costCenterName || defaultCC?.name || primaryCategory;
    const payMethod = normalizePaymentMethod(String(cand.paymentMethod || 'boleto'));

    const validInstallments = (cand.installments || []).filter(
      (i) => Number(i?.amount || 0) > 0 && Boolean(i?.dueDate)
    );
    const instSum = validInstallments.reduce((acc, i) => acc + Number(i.amount || 0), 0);
    const useMultiInstallments =
      validInstallments.length > 0 && Math.abs(instSum - cand.amount) < 0.1;

    const baseSafeKey =
      cand.invoiceDigits && cand.invoiceDigits.length >= 3
        ? `nfe_${cand.invoiceDigits}_${cand.id.replace(/[^a-zA-Z0-9]/g, '').slice(-8)}`
        : cand.id.replace(/[^a-zA-Z0-9_-]/g, '');

    if (useMultiInstallments && validInstallments.length > 1) {
      const totalParcs = validInstallments.length;
      validInstallments.forEach((inst, idx) => {
        const parcelNum = inst.number || String(idx + 1).padStart(2, '0');
        const suffix = ` (${parcelNum}/${totalParcs})`;
        const dueResolved = inst.dueDate || cand.dueDate;
        const val = Number(inst.amount) || 0;
        createdPayables.push({
          id: `exp_sync_${baseSafeKey}_parc_${idx + 1}`,
          companyId: activeCompanyId,
          notaId: cand.id,
          documento_entrada_id: cand.id,
          nota_fiscal_id: cand.id,
          numero_parcela: `${parcelNum}/${totalParcs}`,
          description: `Compra ${cand.invoiceNumber}${suffix} - ${cand.supplier}`,
          amount: val,
          valor_parcela: val,
          categoryId,
          categoryName,
          categoryColor,
          date: cand.issueDate,
          issueDate: cand.issueDate,
          entryDate: cand.entryDate || cand.issueDate,
          dueDate: dueResolved,
          data_vencimento: dueResolved,
          supplier: cand.supplier,
          fornecedor: cand.supplier,
          invoiceNumber: `${cand.invoiceNumber}${suffix}`,
          status: 'pendente',
          paymentMethod: normalizePaymentMethod(inst.paymentMethod || payMethod),
          forma_pagamento: inst.paymentMethod || payMethod,
          costCenterId,
          costCenterName,
          accessKey: cand.accessKey,
          nfeItems: cand.nfeItems,
          operationNature: cand.operationNature,
          transactionType: cand.transactionType,
          notes:
            cand.notes ||
            `Título sincronizado automaticamente da NF-e ${cand.invoiceNumber}${suffix} (${cand.supplier}).`,
          createdAt: cand.createdAt || new Date().toISOString(),
        } as Expense);
      });
    } else {
      const singleDue =
        (useMultiInstallments ? validInstallments[0]?.dueDate : undefined) || cand.dueDate;
      createdPayables.push({
        id: `exp_sync_${baseSafeKey}`,
        companyId: activeCompanyId,
        notaId: cand.id,
        documento_entrada_id: cand.id,
        nota_fiscal_id: cand.id,
        numero_parcela: '01/01',
        description: cand.description || `Compra ${cand.invoiceNumber} - ${cand.supplier}`,
        amount: cand.amount,
        valor_parcela: cand.amount,
        categoryId,
        categoryName,
        categoryColor,
        date: cand.issueDate,
        issueDate: cand.issueDate,
        entryDate: cand.entryDate || cand.issueDate,
        dueDate: singleDue,
        data_vencimento: singleDue,
        supplier: cand.supplier,
        fornecedor: cand.supplier,
        invoiceNumber: cand.invoiceNumber,
        status: 'pendente',
        paymentMethod: payMethod,
        forma_pagamento: payMethod,
        costCenterId,
        costCenterName,
        accessKey: cand.accessKey,
        nfeItems: cand.nfeItems,
        operationNature: cand.operationNature,
        transactionType: cand.transactionType,
        notes:
          cand.notes ||
          `Título sincronizado automaticamente da NF-e ${cand.invoiceNumber} (${cand.supplier}).`,
        createdAt: cand.createdAt || new Date().toISOString(),
      } as Expense);
    }

    reconciledDocIds.push(cand.id);
  }

  if (createdPayables.length === 0) {
    return {
      createdPayables: [],
      nextExpenses: allKnownExpenses,
      reconciledDocIds: [],
    };
  }

  const nextExpenses = [...createdPayables, ...allKnownExpenses];
  saveStoredExpenses(nextExpenses);
  saveCompanyDespesas(nextExpenses, activeCompanyId);

  return {
    createdPayables,
    nextExpenses,
    reconciledDocIds,
  };
}
