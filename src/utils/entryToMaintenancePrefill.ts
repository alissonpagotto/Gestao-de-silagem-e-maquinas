import {
  DocumentoEntradaItem,
  DocumentoEntradaRecord,
  Expense,
  InventoryItem,
  MaintenanceLog,
  MaintenancePartItem,
} from '../types';
import {
  getStoredDocumentosEntrada,
  getStoredDocumentosEntradaItens,
  getStoredExpenses,
  getStoredFiscalRecords,
} from '../lib/storage';

export const PENDING_MAINTENANCE_FROM_ENTRY_NFE_KEY = 'agrocontrol_pending_maintenance_from_entry_nfe';
export const OPEN_MAINTENANCE_FROM_ENTRY_NFE_EVENT = 'agrocontrol_open_maintenance_from_entry_nfe';

export interface PendingMaintenanceFromEntryNfePayload {
  mode: 'existing_os' | 'new_os';
  targetOsId?: string;
  documentoEntrada: DocumentoEntradaRecord;
  createdAt: string;
}

export interface ResolvedEntryInvoiceItem {
  id: string;
  documento_entrada_id: string;
  produto_id?: string;
  codigo_produto?: string;
  ncm?: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  valor_unitario: number;
  valor_total: number;
  matchedInventory?: InventoryItem;
}

export function dispatchOpenMaintenanceFromEntryNfe(
  payload: PendingMaintenanceFromEntryNfePayload
): void {
  try {
    localStorage.setItem(PENDING_MAINTENANCE_FROM_ENTRY_NFE_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
  window.dispatchEvent(
    new CustomEvent<PendingMaintenanceFromEntryNfePayload>(
      OPEN_MAINTENANCE_FROM_ENTRY_NFE_EVENT,
      { detail: payload }
    )
  );
}

export function consumePendingMaintenanceFromEntryNfe(): PendingMaintenanceFromEntryNfePayload | null {
  try {
    const raw = localStorage.getItem(PENDING_MAINTENANCE_FROM_ENTRY_NFE_KEY);
    if (!raw) return null;
    localStorage.removeItem(PENDING_MAINTENANCE_FROM_ENTRY_NFE_KEY);
    const parsed = JSON.parse(raw);
    if (parsed && parsed.documentoEntrada) {
      return parsed as PendingMaintenanceFromEntryNfePayload;
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

export function getDocumentoEntradaNumber(doc: Partial<DocumentoEntradaRecord> | null | undefined): string {
  if (!doc) return '';
  return String(doc.numero || doc.numero_documento || doc.id?.slice(0, 8) || '').trim();
}

export function getDocumentoEntradaSupplier(doc: Partial<DocumentoEntradaRecord> | null | undefined): string {
  if (!doc) return 'Fornecedor N/I';
  return String(doc.fornecedor_nome || doc.fornecedor || 'Fornecedor N/I').trim();
}

export function getDocumentoEntradaDate(doc: Partial<DocumentoEntradaRecord> | null | undefined): string {
  if (!doc) return '';
  return String(doc.data_emissao || doc.data_entrada || doc.data || '').slice(0, 10);
}

export function getDocumentoEntradaTotal(doc: Partial<DocumentoEntradaRecord> | null | undefined): number {
  if (!doc) return 0;
  const val = Number(doc.valor_total);
  return isNaN(val) ? 0 : val;
}

export function isOpenMaintenanceOrder(log: MaintenanceLog): boolean {
  return (
    log.status === 'em_andamento' ||
    log.status === 'aguardando_pecas' ||
    log.status === 'agendada'
  );
}

export function isMaintenanceOrPartsInvoice(
  doc: Partial<DocumentoEntradaRecord> | null | undefined,
  transactionType?: string
): boolean {
  const haystack = [
    transactionType,
    doc?.natureza_operacao,
    doc?.tipo_documento,
    doc?.descricao,
    doc?.observacoes,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return (
    haystack.includes('peça') ||
    haystack.includes('peca') ||
    haystack.includes('insumo') ||
    haystack.includes('manuten') ||
    haystack.includes('uso e consumo') ||
    haystack.includes('oficina') ||
    haystack.includes('frota') ||
    haystack.includes('compra') ||
    haystack.includes('material') ||
    haystack.includes('reposi')
  );
}

const normalizeText = (v?: string | null): string =>
  String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

export function matchInventoryItemForEntryItem(
  item: {
    produto_id?: string;
    codigo_produto?: string;
    descricao?: string;
  },
  inventory: InventoryItem[]
): InventoryItem | undefined {
  if (!inventory || inventory.length === 0) return undefined;

  if (item.produto_id) {
    const byId = inventory.find((inv) => inv.id === item.produto_id);
    if (byId) return byId;
  }

  const codeClean = normalizeText(item.codigo_produto);
  if (codeClean) {
    const byCode = inventory.find(
      (inv) =>
        normalizeText(inv.code) === codeClean ||
        normalizeText((inv as any).codigo) === codeClean ||
        normalizeText(inv.barcode) === codeClean
    );
    if (byCode) return byCode;
  }

  const descClean = normalizeText(item.descricao);
  if (descClean) {
    const byName = inventory.find(
      (inv) =>
        normalizeText(inv.name) === descClean ||
        normalizeText((inv as any).nome) === descClean ||
        normalizeText(inv.nome_comercial) === descClean ||
        normalizeText(inv.fiscalName) === descClean
    );
    if (byName) return byName;
  }

  return undefined;
}

function parseEmbeddedNfeItemsFromNotes(notes?: string): any[] {
  if (!notes) return [];
  const match = notes.match(/<!--\s*NFE_ITEMS_JSON:([\s\S]*?)\s*-->/);
  if (!match || !match[1]) return [];
  try {
    const parsed = JSON.parse(match[1]);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getAllAvailableEntryDocuments(): DocumentoEntradaRecord[] {
  const docs = getStoredDocumentosEntrada();
  const seen = new Set<string>();
  const result: DocumentoEntradaRecord[] = [];

  for (const doc of docs) {
    if (!doc || !doc.id) continue;
    if (seen.has(doc.id)) continue;
    seen.add(doc.id);
    result.push(doc);
  }

  // Ordenar por data mais recente
  return result.sort((a, b) => {
    const da = new Date(a.created_at || getDocumentoEntradaDate(a) || 0).getTime();
    const db = new Date(b.created_at || getDocumentoEntradaDate(b) || 0).getTime();
    return db - da;
  });
}

export function resolveDocumentoEntradaItems(
  doc: DocumentoEntradaRecord,
  inventory: InventoryItem[]
): ResolvedEntryInvoiceItem[] {
  const rawItems: Array<Partial<DocumentoEntradaItem> & Record<string, any>> = [];

  // 1. Itens anexados diretamente ao documento
  if (Array.isArray(doc.itens) && doc.itens.length > 0) {
    rawItems.push(...doc.itens);
  }

  // 2. Itens salvos em colaca_silagem_documentos_entrada_itens
  if (rawItems.length === 0) {
    const storedItems = getStoredDocumentosEntradaItens(doc.id);
    if (storedItems.length > 0) {
      rawItems.push(...storedItems);
    }
  }

  // 3. Fallback via registros fiscais / despesas com nfeItems ou NFE_ITEMS_JSON embutido
  if (rawItems.length === 0) {
    const docNum = getDocumentoEntradaNumber(doc).toLowerCase();
    const fiscalRecords = getStoredFiscalRecords();
    const allExpenses = getStoredExpenses();
    const candidates: Expense[] = [...fiscalRecords, ...allExpenses];

    const matchedExp = candidates.find((exp: any) => {
      if (!exp) return false;
      if (exp.id === doc.id || exp.notaId === doc.id || exp.documento_entrada_id === doc.id) {
        return true;
      }
      const expNum = String(exp.invoiceNumber || '')
        .replace(/\s*\(\d+\/\d+\)/g, '')
        .trim()
        .toLowerCase();
      return Boolean(docNum && expNum && expNum === docNum);
    });

    if (matchedExp) {
      const embedded =
        Array.isArray(matchedExp.nfeItems) && matchedExp.nfeItems.length > 0
          ? matchedExp.nfeItems
          : parseEmbeddedNfeItemsFromNotes(matchedExp.notes);

      embedded.forEach((it: any, idx: number) => {
        const qty = Number(it.quantity ?? it.quantidade ?? it.qCom ?? 1) || 1;
        const unitCost =
          Number(
            it.custoComImposto ??
              it.custo_com_imposto ??
              it.unitPrice ??
              it.valor_unitario ??
              it.vUnCom ??
              0
          ) || 0;
        const total =
          Number(it.totalPrice ?? it.valor_total ?? it.vProd) || Number((qty * unitCost).toFixed(2));
        rawItems.push({
          id: it.id || `nfe_fallback_${doc.id}_${idx}`,
          documento_entrada_id: doc.id,
          produto_id: it.linkedInventoryId || it.produto_id,
          codigo_produto: it.code || it.cProd || it.codigo_produto,
          ncm: it.ncm,
          descricao: it.description || it.descricao || it.xProd || `Item ${idx + 1}`,
          quantidade: qty,
          unidade: it.unit || it.unidade || it.uCom || 'UN',
          valor_unitario: unitCost,
          valor_total: total,
        });
      });
    }
  }

  return rawItems.map((it, idx) => {
    const qty = Number(it.quantidade ?? it.quantity ?? 1) || 1;
    const unitCost = Number(it.valor_unitario ?? it.unitPrice ?? 0) || 0;
    const total = Number(it.valor_total ?? it.totalPrice) || Number((qty * unitCost).toFixed(2));
    const desc = String(it.descricao || it.description || `Item ${idx + 1}`).trim();
    const matchedInventory = matchInventoryItemForEntryItem(
      {
        produto_id: it.produto_id || it.linkedInventoryId,
        codigo_produto: it.codigo_produto || it.code,
        descricao: desc,
      },
      inventory
    );

    return {
      id: String(it.id || `entry_item_${doc.id}_${idx}`),
      documento_entrada_id: doc.id,
      produto_id: matchedInventory?.id || it.produto_id || it.linkedInventoryId,
      codigo_produto: it.codigo_produto || it.code || matchedInventory?.code,
      ncm: it.ncm,
      descricao: desc,
      quantidade: qty,
      unidade: String(it.unidade || it.unit || matchedInventory?.unit || 'UN').toUpperCase(),
      valor_unitario: unitCost > 0 ? unitCost : Number(matchedInventory?.unitCost || 0),
      valor_total: total,
      matchedInventory,
    };
  });
}

export function buildMaintenancePartFromEntryItem(
  item: ResolvedEntryInvoiceItem,
  qtyApplied: number,
  doc: DocumentoEntradaRecord
): MaintenancePartItem {
  const safeQty = Math.max(0.01, Math.round(qtyApplied * 100) / 100);
  const unitCost = Number(item.valor_unitario) || Number(item.matchedInventory?.unitCost) || 0;
  const totalCost = Math.round(safeQty * unitCost * 100) / 100;
  const invName = item.matchedInventory?.nome_comercial || item.matchedInventory?.name;
  const displayDescription = invName || item.descricao;
  const invoiceNum = getDocumentoEntradaNumber(doc);
  const supplierName = getDocumentoEntradaSupplier(doc);

  return {
    id: `part_nfe_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    description: displayDescription,
    origin: 'almoxarifado_interno',
    inventoryItemId: item.matchedInventory?.id || item.produto_id,
    quantity: safeQty,
    unit: item.unidade || item.matchedInventory?.unit || 'UN',
    unitCost,
    totalCost,
    supplierName,
    invoiceNumber: invoiceNum || undefined,
    stockDeducted: true, // Baixa proporcional executada imediatamente na importação para a OS
    financeiro_bloqueado: true, // Nota de entrada já contabilizada no Fiscal/Contas a Pagar
  };
}
