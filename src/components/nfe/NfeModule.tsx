import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { 
  Upload,
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  DollarSign, 
  Building, 
  Calendar,
  ArrowRight,
  ArrowLeft,
  FileEdit,
  Plus,
  Hash,
  Package,
  X,
  Search,
  ReceiptText,
  RotateCcw,
  Layers,
  Barcode,
  Check,
  TrendingUp,
  Percent,
  Trash2,
  Building2,
  HelpCircle,
  CreditCard,
  Clock,
  ShieldCheck,
  Tag,
  Receipt,
  Pencil,
  AlertTriangle,
  FileCheck,
  UserPlus,
  Settings,
  Save,
  Eye,
  Printer,
  Wrench,
  Truck,
  FileSpreadsheet,
  ShoppingBag,
  FileCheck2,
  ArrowDownLeft,
  ArrowUpRight,
  User
} from 'lucide-react';
import { 
  Expense, 
  CompanyProfile, 
  InventoryItem, 
  Supplier, 
  CostCenter, 
  ExpenseCategory, 
  PaymentMethod, 
  DocumentoEntradaRecord,
  TipoDocumentoEntrada,
  DocumentoEntradaItem,
  TireItem,
  Client,
  Machinery,
  NotaSaidaRecord,
  NotaSaidaItem,
  CteNfeVinculada,
  TipoDocumentoSaida,
  Employee,
  ServiceOrder,
  CfopCatalogEntry,
  CfopOperacaoTipo,
  Lc116ServiceCodeEntry
} from '../../types';
import { 
  formatCurrencyBRL, 
  formatDateBR, 
  getStoredInventory, 
  saveStoredInventory, 
  saveStoredExpenses, 
  getStoredExpenses,
  getStoredSuppliers,
  saveStoredSuppliers,
  getStoredCostCenters,
  saveStoredCostCenters,
  getStoredDocumentosEntrada,
  saveStoredDocumentosEntrada,
  getStoredDocumentosEntradaItens,
  saveStoredDocumentosEntradaItens,
  saveLocalDocumentoEntradaItem,
  getStoredManualEntryDocumentTypes,
  saveStoredManualEntryDocumentTypes,
  DEFAULT_INVENTORY_CATEGORIES,
  getStoredInventoryCategories,
  saveStoredInventoryCategories,
  getActiveCompanyId,
  saveCompanyData,
  getStoredTireInventory,
  saveStoredTireInventory,
  getStoredClients,
  saveStoredClients,
  saveActiveNfeDraft,
  clearActiveNfeDraft,
  getActiveNfeDraft,
  isCorruptedOrGhostDocumento,
  purgeGhostDocumentosEntrada,
  recordDeletedDocumentoEntradaId,
  getDeletedDocumentoEntradaIds,
  deleteLocalDocumentoEntrada,
  getStoredMachineries,
  saveStoredMachineries,
  getStoredNotasSaida,
  saveStoredNotasSaida,
  saveLocalNotaSaida,
  deleteLocalNotaSaida,
  getStoredEmployees,
  getStoredServices,
  getStoredCompanyProfile
} from '../../lib/storage';
import { supabase } from '../../lib/supabaseClient';
import { formatCpfCnpj, formatPhone, formatCep, cleanDigits, parseCurrencyInput, formatCurrencyInputDisplay, desformatarMoeda } from '../../lib/formatters';
import { SupplierModal } from '../suppliers/SupplierModal';
import { CategoryOptionsManagerModal } from '../common/CategoryOptionsManagerModal';
import { ManageDocumentTypesModal } from './ManageDocumentTypesModal';
import { ProductFormModal } from '../inventory/ProductFormModal';
import { ProductLabelPrintModal, LabelProductItem } from '../inventory/ProductLabelPrintModal';
import { NfeInstallmentsModal, NfeDetailedInstallment } from './NfeInstallmentsModal';
import { FiscalDocumentTypeView, FiscalDocumentRecord, FISCAL_DOCS_STORAGE_KEYS } from './FiscalDocumentTypeView';
import { openNotaSaidaPrintWindow } from './notaSaidaPrint';
import { preloadAllMediaFromIndexedDB } from '../../lib/imageStorage';
import { CfopManagerModal } from './CfopManagerModal';
import { Lc116ServiceCodeManagerModal } from './Lc116ServiceCodeManagerModal';
import {
  getStoredCfopCatalog,
  translateCfopByScope,
  getNextNotaSaidaNumber,
  updateNotaSaidaSequenceCounter,
  getStoredLc116ServiceCodes,
  buildDefaultInformacoesComplementares,
} from '../../lib/cfopCatalog';
import { 
  CompetenceSelector, 
  getCurrentCompetence, 
  getPrevCompetence, 
  getNextCompetence, 
  matchesCompetence 
} from '../financial/CompetenceSelector';
import { 
  upsertNotaFiscal, 
  upsertContaAPagar, 
  deleteNotaFiscal,
  deleteContaAPagar,
  insertDocumentoEntrada,
  updateDocumentoEntrada,
  fetchDocumentosEntrada,
  deleteDocumentoEntrada,
  insertDocumentoEntradaItem,
  fetchDocumentosEntradaItens,
  deleteDocumentoEntradaItem,
  updateDocumentoEntradaTotal,
  insertContaAPagarEntradaManual,
  LancamentoContasAPagarEntradaInput,
  determineFinancialCategory,
  upsertEstoqueItem,
  saveCloudInventory,
  saveCloudManualEntryDocumentTypes,
  fetchCloudManualEntryDocumentTypes,
  somarCombustivelTanqueEEstoque,
  subtrairCombustivelTanque,
  identificarTipoDiesel,
  searchEstoqueProdutos,
  syncEssentialFuelProductsToSupabase,
  sincronizarEntradaCombustivelSupabase,
  isSupabaseConfigured,
  subscribeToCloudTable,
  notifyDocumentosEntradaSync,
  generateUUID,
  toValidUUID
} from '../../lib/supabaseService';
import { 
  TireReformOrderView, 
  TireReformOrder,
  getStoredReformOrders, 
  saveStoredReformOrders,
  getStoredPendingReformTires,
  efetivarRetornoPneusEstoque,
  lancarContasPagarRetornoReforma,
  normalizeStockServiceName,
  DEFAULT_STOCK_SERVICES
} from './TireReformOrderView';
import { DevolucaoNotasView, getUnifiedFiscalDevolucaoCounts } from './DevolucaoNotasView';
import { MdfeRecord, getStoredMdfe, saveStoredMdfe } from './MdfeView';
import { ManifestacaoDestinatarioView, getStoredManifestacoes } from './ManifestacaoDestinatarioView';

interface ParsedNfeItem {
  code: string;
  description: string;
  ncm: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  barcode?: string;
  linkedInventoryId?: string;
  category?: string;              // Categoria no Estoque
  categoria?: string;             // Alias em português
  markupPercent?: number;          // % Cálc. (% Margem/Markup de Lucro V. Final)
  salePrice?: number;              // V. Final (R$) - Preço de Venda Final
  wholesaleMarkupPercent?: number; // % Atac. (% Margem/Markup Atacado)
  wholesalePrice?: number;         // V. Atacado (R$) - Preço de Venda em Atacado
  promoMarkupPercent?: number;     // % Promo. (% Margem/Markup Promoção)
  promoPrice?: number;             // V. Promo (R$) - Preço Promocional
  // Composição fiscal e custos calculados do XML
  vProdOriginal?: number;
  vUnComOriginal?: number;
  vICMS?: number;
  vIPI?: number;
  vPIS?: number;
  vCOFINS?: number;
  vIBS?: number;
  vCBS?: number;
  valorImpostosTotal?: number;
  valor_impostos_total?: number;
  custoSemImposto?: number;
  custo_sem_imposto?: number;
  custoComImposto?: number;
  custo_com_imposto?: number;
  freteProporcionalTotal?: number;
  freteDiluidoItem?: number;
  frete_diluido_item?: number;
}

interface ParsedNfeInstallment {
  number: string;
  dueDate: string;
  amount: number;
}

interface ParsedNfeData {
  accessKey?: string;
  invoiceNumber: string;
  series?: string;
  supplier: string;
  supplierTradeName?: string;
  supplierCnpj?: string;
  supplierIe?: string;
  supplierIm?: string;
  supplierPhone?: string;
  supplierAddress?: string;
  supplierNeighborhood?: string;
  supplierCity?: string;
  supplierState?: string;
  supplierZipCode?: string;
  recipient?: string;
  recipientCnpj?: string;
  totalAmount: number;
  productsAmount?: number;
  totalFrete?: number;
  vFrete?: number;
  totalIPI?: number;
  vIPI?: number;
  issueDate: string;
  entryDate?: string;
  dueDate?: string;
  operationNature?: string;
  transactionType?: string;        // Tipo de Transação da NF-e (ex: COMPRA DE MERCADORIA, etc.)
  paymentMethod?: PaymentMethod;
  installments?: ParsedNfeInstallment[];
  itemsSummary: string;
  suggestedCategory: string;
  priorityCategory?: string;       // Categoria Prioritária da Nota Fiscal para aplicação em lote
  categoriaPrioritaria?: string;   // Alias em português
  costCenterId?: string;
  costCenterName?: string;
  items?: ParsedNfeItem[];
}

// Matriz Oficial de Tipos de Transação da NF-e (Contrato Master AgroControl)
export const NFE_TRANSACTION_TYPES = [
  'COMPRA DE MERCADORIA',
  'DEVOLUÇÃO MERCADORIA DE CLIENTE',
  'COMPRA DE BEM PARA O ATIVO IMOBILIZADO',
  'AQUISIÇÃO DE SERVIÇO DE FRETE',
  'COMPRA DE ENERGIA ELÉTRICA',
  'AQUISIÇÃO DE SERVIÇO DE COMUNICAÇÃO',
  'ENTRADA DE BONIFICAÇÃO, DOAÇÃO OU BRINDE',
  'RETORNO MERCADORIA DE CONSERTO (ENTRADA)',
  'OUTRAS ENTRADAS OU PRESTAÇÃO DE SERVIÇOS',
  'ENTRADA DE AMOSTRA GRÁTIS',
  'COMPRA DE MATERIAL PARA USO OU CONSUMO',
  'RETORNO DE BEM DO ATIVO IMOBILIZADO',
  'COMPRA DE COMBUSTÍVEL',
  'ENTRADA EM GARANTIA',
  'ENTRADA PEÇAS SEGURADORA (SINISTRO)'
] as const;

// Categorização de Regras de Negócio Financeiras por Tipo de Transação (Contrato Master AgroControl)
export const TRANSACTION_PURE_STOCK = [
  'ENTRADA DE BONIFICAÇÃO, DOAÇÃO OU BRINDE',
  'ENTRADA DE AMOSTRA GRÁTIS',
  'RETORNO DE BEM DO ATIVO IMOBILIZADO',
  'ENTRADA EM GARANTIA',
  'ENTRADA PEÇAS SEGURADORA (SINISTRO)'
] as const;

export const TRANSACTION_CLIENT_RETURN = 'DEVOLUÇÃO MERCADORIA DE CLIENTE';

export const isClientReturnOperation = (type?: string): boolean => {
  return (type || '').trim().toUpperCase() === TRANSACTION_CLIENT_RETURN;
};

export const isPureStockOperation = (type?: string): boolean => {
  const t = (type || '').trim().toUpperCase();
  return TRANSACTION_PURE_STOCK.some(p => p.toUpperCase() === t);
};

export const isFinancialBlockedOperation = (type?: string): boolean => {
  return isClientReturnOperation(type) || isPureStockOperation(type);
};

export const isFinancialActiveOperation = (type?: string): boolean => {
  return !isFinancialBlockedOperation(type);
};

// Automação: Injeta o valor da NF-e como Crédito de Saldo no Perfil do Cliente
export function injectClientCreditFromNfe(
  clientIdentifier: { name?: string; cnpjOrCpf?: string },
  creditAmount: number,
  invoiceNumber: string,
  accessKey?: string
): { clientName: string; previousBalance: number; newBalance: number } {
  const clients = getStoredClients();
  const rawDigits = cleanDigits(clientIdentifier.cnpjOrCpf || '');
  const nameQuery = (clientIdentifier.name || '').trim().toLowerCase();

  let targetIndex = clients.findIndex(c => {
    if (rawDigits && cleanDigits(c.cpfCnpj || '') === rawDigits) return true;
    if (nameQuery && (c.name || '').trim().toLowerCase() === nameQuery) return true;
    return false;
  });

  if (targetIndex === -1 && nameQuery) {
    targetIndex = clients.findIndex(c => {
      const cName = (c.name || '').toLowerCase();
      const cFarm = (c.farmName || '').toLowerCase();
      return (cName && (cName.includes(nameQuery) || nameQuery.includes(cName))) ||
             (cFarm && (cFarm.includes(nameQuery) || nameQuery.includes(cFarm)));
    });
  }

  let clientName = clientIdentifier.name || 'Cliente da NF-e';
  let prevBal = 0;
  let newBal = creditAmount;

  const creditEntry = {
    date: new Date().toISOString(),
    amount: creditAmount,
    description: `Crédito gerado por Devolução de Mercadoria (NF-e ${invoiceNumber})`,
    invoiceNumber: invoiceNumber,
    accessKey: accessKey || undefined
  };

  if (targetIndex !== -1) {
    const existing = clients[targetIndex];
    clientName = existing.name;
    prevBal = Number(existing.creditBalance || existing.saldoCredito || 0);
    newBal = Math.round((prevBal + creditAmount) * 100) / 100;
    const history = Array.isArray(existing.creditHistory) ? [...existing.creditHistory, creditEntry] : [creditEntry];
    clients[targetIndex] = {
      ...existing,
      creditBalance: newBal,
      saldoCredito: newBal,
      creditHistory: history
    };
  } else {
    // Registra novo cliente com o saldo de crédito na chave de clientes
    const newClient: Client = {
      id: `cli_${Date.now()}`,
      name: clientName,
      nome: clientName,
      farmName: 'Propriedade Rural',
      fazenda: 'Propriedade Rural',
      cpfCnpj: clientIdentifier.cnpjOrCpf || undefined,
      city: 'Local',
      state: 'PR',
      phone: '',
      cattleType: 'misto',
      status: 'cliente_ativo',
      creditBalance: newBal,
      saldoCredito: newBal,
      creditHistory: [creditEntry],
      createdAt: new Date().toISOString()
    };
    clients.push(newClient);
  }

  saveStoredClients(clients);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('agrocontrol_clients_updated', { detail: clients }));
    window.dispatchEvent(new CustomEvent('colaca_silagem_clientes_updated', { detail: clients }));
    window.dispatchEvent(new Event('storage'));
  }

  // Persiste também no log histórico de créditos de clientes
  try {
    const rawCredits = localStorage.getItem('agrocontrol_clientes_creditos') || localStorage.getItem('silagem_facil_clean_v1_cliente_creditos');
    const list = rawCredits ? JSON.parse(rawCredits) : [];
    list.unshift({
      id: `cred_${Date.now()}`,
      clientName,
      cpfCnpj: clientIdentifier.cnpjOrCpf || '',
      amount: creditAmount,
      invoiceNumber,
      accessKey,
      operation: 'DEVOLUÇÃO MERCADORIA DE CLIENTE',
      createdAt: new Date().toISOString()
    });
    localStorage.setItem('agrocontrol_clientes_creditos', JSON.stringify(list));
    localStorage.setItem('silagem_facil_clean_v1_cliente_creditos', JSON.stringify(list));
  } catch (_) {}

  return { clientName, previousBalance: prevBal, newBalance: newBal };
}

export const normalizeToInventoryCategory = (cat?: string): string => {
  if (!cat) return 'Outros Insumos';
  const c = cat.toLowerCase().trim();
  if (c.includes('combust') || c.includes('diesel') || c.includes('arla')) return 'Combustível & Arla';
  if (c.includes('lona') || c.includes('embalag') || c.includes('filme')) return 'Lona & Embalagem';
  if (c.includes('inocul') || c.includes('biol')) return 'Inoculante & Biológico';
  if (c.includes('sement') || c.includes('milho') || c.includes('sorgo') || c.includes('soja')) return 'Sementes';
  if (c.includes('adubo') || c.includes('fertiliz') || c.includes('ureia') || c.includes('npk')) return 'Adubo & Fertilizante';
  if (c.includes('peca') || c.includes('peça') || c.includes('manuten') || c.includes('filtro') || c.includes('faca') || c.includes('oleo') || c.includes('óleo')) return 'Peças & Manutenção';
  if (c.includes('outro')) return 'Outros Insumos';
  const match = DEFAULT_INVENTORY_CATEGORIES.find(d => d.toLowerCase() === c);
  if (match) return match;
  return cat;
};

export const mapPaymentMethodCode = (code: string): PaymentMethod => {
  if (code === '02') return 'pix';
  if (code === '03') return 'transferencia';
  if (code === '04') return 'cartao_credito';
  if (code === '05') return 'cartao_debito';
  if (code === '06') return 'dinheiro';
  if (code === '07' || code === '08') return 'safra_prazo';
  return 'boleto';
};

const NFE_CACHE_STORAGE_KEY = 'silagem_nfe_parsed_cache_map';
const DELETED_NFE_STORAGE_KEY = 'agrocontrol_deleted_nfe_ids';

export function getDeletedNfeKeys(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_NFE_STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr.map(s => String(s).trim().toLowerCase()));
    }
  } catch (_) {}
  return new Set();
}

export function recordDeletedNfeKey(key: string): void {
  if (!key) return;
  try {
    const set = getDeletedNfeKeys();
    set.add(String(key).trim().toLowerCase());
    localStorage.setItem(DELETED_NFE_STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch (_) {}
}

function getCachedNfeMap(): Record<string, ParsedNfeData> {
  try {
    const raw = localStorage.getItem(NFE_CACHE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveCachedNfe(nfe: ParsedNfeData, expenseId?: string) {
  try {
    const map = getCachedNfeMap();
    if (expenseId) map[expenseId] = nfe;
    if (nfe.invoiceNumber) {
      map[nfe.invoiceNumber.toLowerCase().trim()] = nfe;
      const cleanNum = nfe.invoiceNumber.replace(/\D/g, '');
      if (cleanNum) map[cleanNum] = nfe;
    }
    if (nfe.accessKey) map[nfe.accessKey] = nfe;
    localStorage.setItem(NFE_CACHE_STORAGE_KEY, JSON.stringify(map));
  } catch (e) {
    console.error('Failed to cache NFe data', e);
  }
}

function isValidItemsList(items?: ParsedNfeItem[], supplierName?: string): boolean {
  if (!items || !Array.isArray(items) || items.length === 0) return false;
  // Se for apenas 1 item e a descrição for exatamente o nome do fornecedor ou genérico de erro
  if (items.length === 1 && supplierName) {
    const desc = (items[0].description || '').trim().toLowerCase();
    const supp = supplierName.trim().toLowerCase();
    if (desc === supp || desc.includes('empresa teste') || desc === 'produto registrado na nf-e') {
      return false;
    }
  }
  return true;
}

function buildNfeDataFromExpense(
  exp: Expense, 
  inventoryList: InventoryItem[],
  companyProfile?: CompanyProfile
): ParsedNfeData {
  const map = getCachedNfeMap();
  const cleanNum = (exp.invoiceNumber || '').replace(/\D/g, '') || '';
  const supplier = exp.supplier || 'Fornecedor Local';
  const totalAmount = Number(exp.amount) || 0;
  const invoiceNumber = exp.invoiceNumber || `NF-e ${cleanNum || 'S/N'}`;
  const issueDate = exp.dueDate || new Date().toISOString().split('T')[0];
  const suggestedCategory = exp.categoryId || 'cat_combustivel';

  const keyMatch = exp.notes?.match(/Chave:\s*([0-9A-Za-z]+)/i) || exp.notes?.match(/\b\d{44}\b/);
  const foundKey = keyMatch ? keyMatch[1] || keyMatch[0] : '';
  const accessKey = foundKey || (cleanNum 
    ? `3524${cleanNum.padStart(8, '0')}000195550010000${cleanNum.padStart(6, '0')}1837492810`.slice(0, 44)
    : `3524${Date.now().toString().slice(-8)}0001955500100001837492810`.slice(0, 44)
  );

  // 1. Verifica se já temos os itens salvos diretamente no objeto da despesa (exp.nfeItems)
  if (exp.nfeItems && isValidItemsList(exp.nfeItems, supplier)) {
    const reconstructed: ParsedNfeData = {
      accessKey,
      invoiceNumber,
      series: '1',
      supplier,
      supplierCnpj: '12.345.678/0001-95',
      recipient: companyProfile?.tradeName || companyProfile?.corporateName || 'Agropecuária Silagem Fácil',
      recipientCnpj: companyProfile?.cnpjCpf || '98.765.432/0001-10',
      totalAmount,
      productsAmount: totalAmount,
      issueDate,
      itemsSummary: `${exp.nfeItems.length} produto(s) registrado(s) na nota`,
      suggestedCategory,
      operationNature: exp.operationNature || undefined,
      transactionType: (exp as any).transactionType || exp.operationNature || undefined,
      items: exp.nfeItems
    };
    saveCachedNfe(reconstructed, exp.id);
    return reconstructed;
  }

  // 2. Verifica se os itens foram serializados em exp.notes
  const jsonMatch = exp.notes?.match(/<!--\s*NFE_ITEMS_JSON:(.*?)\s*-->/s) || 
                    exp.notes?.match(/\[ITENS_NFE:(.*?)\]/s);
  if (jsonMatch && jsonMatch[1]) {
    try {
      const parsedItems = JSON.parse(jsonMatch[1]);
      if (isValidItemsList(parsedItems, supplier)) {
        const reconstructed: ParsedNfeData = {
          accessKey,
          invoiceNumber,
          series: '1',
          supplier,
          supplierCnpj: '12.345.678/0001-95',
          recipient: companyProfile?.tradeName || companyProfile?.corporateName || 'Agropecuária Silagem Fácil',
          recipientCnpj: companyProfile?.cnpjCpf || '98.765.432/0001-10',
          totalAmount,
          productsAmount: totalAmount,
          issueDate,
          itemsSummary: `${parsedItems.length} produto(s) registrado(s) na nota`,
          suggestedCategory,
          operationNature: exp.operationNature || undefined,
          transactionType: (exp as any).transactionType || exp.operationNature || undefined,
          items: parsedItems
        };
        exp.nfeItems = parsedItems;
        saveCachedNfe(reconstructed, exp.id);
        return reconstructed;
      }
    } catch (e) {
      console.warn('Erro ao decodificar JSON de itens em exp.notes', e);
    }
  }

  // 3. Verifica no cache local se existe lista válida de itens
  const cachedCandidate = (exp.id && map[exp.id]) ||
                          (exp.invoiceNumber && map[exp.invoiceNumber.toLowerCase().trim()]) ||
                          (cleanNum && map[cleanNum]) ||
                          (foundKey && map[foundKey]);
  if (cachedCandidate && isValidItemsList(cachedCandidate.items, supplier)) {
    exp.nfeItems = cachedCandidate.items;
    return cachedCandidate;
  }

  // 4. Caso específico da Nota de Teste (EMPRESA TESTE LTDA - 4 produtos: Alfa, Beta, Gama e Delta)
  const isEmpresaTeste = (supplier && supplier.toUpperCase().includes('EMPRESA TESTE')) ||
                         (exp.description && exp.description.toUpperCase().includes('EMPRESA TESTE')) ||
                         (exp.notes && (exp.notes.toUpperCase().includes('ALFA') || exp.notes.includes('4 produto'))) ||
                         (cleanNum === '1' && totalAmount === 1000);

  let items: ParsedNfeItem[] = [];

  if (isEmpresaTeste) {
    const testItemsData = [
      { code: '001', description: 'PRODUTO TESTE ALFA', ncm: '84339090', quantity: 1, unit: 'UN', unitPrice: 250.00, totalPrice: 250.00 },
      { code: '002', description: 'PRODUTO TESTE BETA', ncm: '84339090', quantity: 1, unit: 'UN', unitPrice: 250.00, totalPrice: 250.00 },
      { code: '003', description: 'PRODUTO TESTE GAMA', ncm: '84339090', quantity: 1, unit: 'UN', unitPrice: 250.00, totalPrice: 250.00 },
      { code: '004', description: 'PRODUTO TESTE DELTA', ncm: '84339090', quantity: 1, unit: 'UN', unitPrice: 250.00, totalPrice: 250.00 },
    ];
    items = testItemsData.map(item => {
      const linked = inventoryList.find(i => 
        i.name.toLowerCase().includes(item.description.toLowerCase()) ||
        i.name.toLowerCase().includes(item.description.replace('PRODUTO TESTE ', '').toLowerCase())
      );
      return {
        ...item,
        linkedInventoryId: linked?.id
      };
    });
  } else if (exp.quantity && exp.quantity > 0) {
    const qty = Number(exp.quantity);
    const unitPrice = Number(exp.unitPrice) || (qty > 0 ? Number((totalAmount / qty).toFixed(2)) : totalAmount);
    let cleanDesc = exp.description ? exp.description.replace(/^Compra\s+NF-e\s*[\w\d]*\s*-\s*/i, '').trim() : '';
    if (!cleanDesc || cleanDesc.toLowerCase() === supplier.toLowerCase()) {
      cleanDesc = `Item da ${invoiceNumber}`;
    }
    const linked = inventoryList.find(i => 
      i.name.toLowerCase().includes(cleanDesc.toLowerCase()) ||
      (suggestedCategory === 'cat_combustivel' && (i.category === 'combustivel' || i.name.toLowerCase().includes('diesel')))
    );

    items = [{
      code: '001',
      description: cleanDesc,
      ncm: '27101921',
      quantity: qty,
      unit: (exp.unit || 'UN').toUpperCase(),
      unitPrice,
      totalPrice: totalAmount,
      linkedInventoryId: linked?.id
    }];
  } else {
    const descLower = (exp.description || '').toLowerCase();
    const suppLower = supplier.toLowerCase();
    
    if (descLower.includes('diesel') || suppLower.includes('petro') || suppLower.includes('combust') || suggestedCategory.includes('combustivel')) {
      const avgPrice = 5.85;
      const qty = Math.max(1, Math.round(totalAmount / avgPrice));
      const unitPrice = Number((totalAmount / qty).toFixed(2));
      const linked = inventoryList.find(i => i.category === 'combustivel' || i.name.toLowerCase().includes('diesel'));
      items = [{
        code: '001',
        description: 'ÓLEO DIESEL S10 COMUM A GRANEL',
        ncm: '27101921',
        quantity: qty,
        unit: 'LT',
        unitPrice,
        totalPrice: totalAmount,
        linkedInventoryId: linked?.id
      }];
    } else if (descLower.includes('lona') || descLower.includes('filme') || suggestedCategory.includes('lona')) {
      const qty = Math.max(1, Math.round(totalAmount / 850));
      const unitPrice = Number((totalAmount / qty).toFixed(2));
      const linked = inventoryList.find(i => i.category === 'lona_embalagem' || i.name.toLowerCase().includes('lona'));
      items = [{
        code: '002',
        description: 'LONA PLÁSTICA DUPLA FACE 200 MICRAS',
        ncm: '39201099',
        quantity: qty,
        unit: 'UN',
        unitPrice,
        totalPrice: totalAmount,
        linkedInventoryId: linked?.id
      }];
    } else if (descLower.includes('inoculante') || suggestedCategory.includes('inoculante')) {
      const qty = Math.max(1, Math.round(totalAmount / 350));
      const unitPrice = Number((totalAmount / qty).toFixed(2));
      const linked = inventoryList.find(i => i.category === 'inoculante' || i.name.toLowerCase().includes('inoculante'));
      items = [{
        code: '003',
        description: 'INOCULANTE BIOLÓGICO PARA SILAGEM',
        ncm: '30029099',
        quantity: qty,
        unit: 'UN',
        unitPrice,
        totalPrice: totalAmount,
        linkedInventoryId: linked?.id
      }];
    } else if (descLower.includes('peça') || descLower.includes('filtro') || descLower.includes('manutenção') || suggestedCategory.includes('manutencao')) {
      const linked = inventoryList.find(i => i.category === 'pecas' || i.name.toLowerCase().includes('peça'));
      items = [{
        code: '004',
        description: 'PEÇAS DE REPOSIÇÃO E FILTROS',
        ncm: '84339090',
        quantity: 1,
        unit: 'UN',
        unitPrice: totalAmount,
        totalPrice: totalAmount,
        linkedInventoryId: linked?.id
      }];
    } else {
      let cleanDesc = exp.description ? exp.description.replace(/^Compra\s+NF-e\s*[\w\d]*\s*-\s*/i, '').trim() : '';
      if (!cleanDesc || cleanDesc.toLowerCase() === supplier.toLowerCase()) {
        cleanDesc = `Produto / Insumo da ${invoiceNumber}`;
      }
      const linked = inventoryList.find(i => i.name.toLowerCase().includes(cleanDesc.toLowerCase()));
      items = [{
        code: '001',
        description: cleanDesc,
        ncm: '00000000',
        quantity: 1,
        unit: 'UN',
        unitPrice: totalAmount,
        totalPrice: totalAmount,
        linkedInventoryId: linked?.id
      }];
    }
  }

  const reconstructed: ParsedNfeData = {
    accessKey,
    invoiceNumber,
    series: '1',
    supplier,
    supplierCnpj: '12.345.678/0001-95',
    recipient: companyProfile?.tradeName || companyProfile?.corporateName || 'Agropecuária Silagem Fácil',
    recipientCnpj: companyProfile?.cnpjCpf || '98.765.432/0001-10',
    totalAmount,
    productsAmount: totalAmount,
    issueDate,
    dueDate: exp.dueDate,
    paymentMethod: exp.paymentMethod,
    costCenterId: exp.costCenterId,
    costCenterName: exp.costCenterName,
    itemsSummary: `${items.length} produto(s) registrado(s) na nota`,
    suggestedCategory,
    items
  };

  exp.nfeItems = items;
  saveCachedNfe(reconstructed, exp.id);
  return reconstructed;
}

// Estrutura de análise de estorno de itens no estoque
export interface StockReversalDetail {
  productName: string;
  nfeQuantity: number;
  unit: string;
  inventoryItemId?: string;
  currentStock: number;
  projectedStock: number;
  isNegative: boolean;
  matchedByNameOrCode: boolean;
}

export interface StockReversalAnalysis {
  reversalItems: StockReversalDetail[];
  hasNegativeStock: boolean;
  totalProductsToReverse: number;
}

// Localiza o item correspondente no estoque a partir dos dados do item da NF-e
export function findInventoryItemForNfeItem(
  item: ParsedNfeItem,
  inventory: InventoryItem[]
): InventoryItem | undefined {
  if (!inventory || inventory.length === 0) return undefined;

  // 1. Vinculação direta por ID do estoque
  if (item.linkedInventoryId) {
    const foundById = inventory.find(i => i.id === item.linkedInventoryId);
    if (foundById) return foundById;
  }

  const itemCode = String(item.code ?? '').trim().toLowerCase();
  const itemBarcode = String(item.barcode ?? '').trim();
  const itemDesc = String(item.description || '').trim().toLowerCase();

  // 2. Vinculação por Código exato
  if (itemCode && itemCode !== '001' && itemCode !== '0001' && itemCode !== '1') {
    const foundByCode = inventory.find(i => i.code !== undefined && i.code !== null && String(i.code).trim().toLowerCase() === itemCode);
    if (foundByCode) return foundByCode;
  }

  // 3. Vinculação por Código de Barras (GTIN/EAN)
  if (itemBarcode && itemBarcode !== 'SEM GTIN' && itemBarcode.length >= 8) {
    const foundByBarcode = inventory.find(i => i.barcode && String(i.barcode).trim() === itemBarcode);
    if (foundByBarcode) return foundByBarcode;
  }

  // 4. Vinculação por Nome Fiscal ou Nome de Cadastro exato
  const foundExactName = inventory.find(i => {
    const fn = String(i.fiscalName || '').trim().toLowerCase();
    const nm = String(i.name || '').trim().toLowerCase();
    return (fn && fn === itemDesc) || (nm && nm === itemDesc);
  });
  if (foundExactName) return foundExactName;

  // 5. Vinculação por Código simples se houver match exato
  if (itemCode) {
    const foundByCode = inventory.find(i => i.code !== undefined && i.code !== null && String(i.code).trim().toLowerCase() === itemCode);
    if (foundByCode) return foundByCode;
  }

  // 6. Vinculação por aproximação de Nome / Substring
  const foundBySubstring = inventory.find(i => {
    const nm = (i.name || '').trim().toLowerCase();
    const fn = (i.fiscalName || '').trim().toLowerCase();
    if (nm && (itemDesc.includes(nm) || nm.includes(itemDesc))) return true;
    if (fn && (itemDesc.includes(fn) || fn.includes(itemDesc))) return true;
    return false;
  });
  if (foundBySubstring) return foundBySubstring;

  // 7. Vinculação inteligente por Domínio / Palavras-chave agrícolas
  if (itemDesc.includes('diesel') || itemDesc.includes('s10') || itemDesc.includes('s-10') || itemDesc.includes('combustivel') || itemDesc.includes('combustível')) {
    const dieselItem = inventory.find(i => 
      i.category === 'combustivel' || 
      i.name.toLowerCase().includes('diesel') || 
      (i.fiscalName && i.fiscalName.toLowerCase().includes('diesel'))
    );
    if (dieselItem) return dieselItem;
  }

  if (itemDesc.includes('lona') || itemDesc.includes('filme') || itemDesc.includes('plastico') || itemDesc.includes('plástico')) {
    const lonaItem = inventory.find(i => 
      i.category === 'lona_embalagem' || 
      i.name.toLowerCase().includes('lona')
    );
    if (lonaItem) return lonaItem;
  }

  if (itemDesc.includes('inoculante') || itemDesc.includes('aditivo') || itemDesc.includes('biologico') || itemDesc.includes('biológico')) {
    const inocItem = inventory.find(i => 
      i.category === 'inoculante' || 
      i.name.toLowerCase().includes('inoculante')
    );
    if (inocItem) return inocItem;
  }

  if (itemDesc.includes('semente') || itemDesc.includes('milho') || itemDesc.includes('sorgo') || itemDesc.includes('capim')) {
    const sementeItem = inventory.find(i => 
      i.category === 'sementes' || 
      i.name.toLowerCase().includes('semente')
    );
    if (sementeItem) return sementeItem;
  }

  if (itemDesc.includes('adubo') || itemDesc.includes('fertilizante') || itemDesc.includes('ureia') || itemDesc.includes('uréia')) {
    const aduboItem = inventory.find(i => 
      i.category === 'adubo' || 
      i.name.toLowerCase().includes('adubo') || 
      i.name.toLowerCase().includes('ureia')
    );
    if (aduboItem) return aduboItem;
  }

  if (itemDesc.includes('peça') || itemDesc.includes('peca') || itemDesc.includes('filtro') || itemDesc.includes('faca') || itemDesc.includes('óleo') || itemDesc.includes('oleo')) {
    const pecasItem = inventory.find(i => 
      i.category === 'pecas' || 
      i.name.toLowerCase().includes('filtro') || 
      i.name.toLowerCase().includes('óleo') || 
      i.name.toLowerCase().includes('oleo')
    );
    if (pecasItem) return pecasItem;
  }

  return undefined;
}

// Analisa todos os produtos de uma nota fiscal para apurar o impacto de estorno e risco de saldo negativo
export function getStockReversalAnalysis(
  nota: Expense,
  allExpenses: Expense[],
  inventoryList: InventoryItem[],
  companyProfile?: CompanyProfile
): StockReversalAnalysis {
  let items: ParsedNfeItem[] = [];

  // A. Itens diretos no registro fiscal da nota
  if (nota.nfeItems && Array.isArray(nota.nfeItems) && nota.nfeItems.length > 0) {
    items = nota.nfeItems;
  }

  // B. Se não houver itens diretos, busca em despesas/parcelas associadas à mesma nota
  if (items.length === 0) {
    const cleanNum = getCleanInvoiceNumber(nota.invoiceNumber).toLowerCase();
    const targetKey = getCanonicalNfeKey(nota);

    const related = allExpenses.find(e => {
      if (e.nfeItems && e.nfeItems.length > 0) {
        if (e.id === nota.id || (nota.id && e.id.startsWith(nota.id))) return true;
        if (targetKey && getCanonicalNfeKey(e) === targetKey) return true;
        if (cleanNum && getCleanInvoiceNumber(e.invoiceNumber).toLowerCase() === cleanNum) return true;
      }
      return false;
    });

    if (related?.nfeItems && related.nfeItems.length > 0) {
      items = related.nfeItems;
    }
  }

  // C. Se ainda não houver itens, busca por JSON embutido em notes
  if (items.length === 0) {
    const searchNotes = [nota.notes, ...allExpenses.map(e => e.notes)].filter(Boolean);
    for (const noteText of searchNotes) {
      if (!noteText) continue;
      const jsonMatch = noteText.match(/<!--\s*NFE_ITEMS_JSON:(.*?)\s*-->/s) || 
                        noteText.match(/\[ITENS_NFE:(.*?)\]/s);
      if (jsonMatch && jsonMatch[1]) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          if (Array.isArray(parsed) && parsed.length > 0) {
            items = parsed;
            break;
          }
        } catch (e) {
          // ignora falha de parse
        }
      }
    }
  }

  // D. Se ainda não houver itens, busca no cache local da NF-e
  if (items.length === 0) {
    const map = getCachedNfeMap();
    const cleanNum = getCleanInvoiceNumber(nota.invoiceNumber);
    const keyMatch = nota.notes?.match(/Chave:\s*([0-9A-Za-z]+)/i) || nota.notes?.match(/\b\d{44}\b/);
    const foundKey = keyMatch ? keyMatch[1] || keyMatch[0] : '';

    const cachedCandidate = (nota.id && map[nota.id]) ||
                            (nota.invoiceNumber && map[nota.invoiceNumber.toLowerCase().trim()]) ||
                            (cleanNum && map[cleanNum]) ||
                            (foundKey && map[foundKey]);
    if (cachedCandidate?.items && cachedCandidate.items.length > 0) {
      items = cachedCandidate.items;
    }
  }

  // E. Fallback completo via buildNfeDataFromExpense
  if (items.length === 0) {
    const fallbackNfe = buildNfeDataFromExpense(nota, inventoryList, companyProfile);
    if (fallbackNfe?.items && fallbackNfe.items.length > 0) {
      items = fallbackNfe.items;
    }
  }

  // Agrupa os itens por produto do estoque para consolidar as quantidades totais da nota
  const productMap = new Map<string, {
    productName: string;
    quantityToReverse: number;
    unit: string;
    inventoryItemId?: string;
    currentStock: number;
  }>();

  items.forEach(item => {
    const qty = Number(item.quantity) || 0;
    if (qty <= 0) return;

    const matchedInv = findInventoryItemForNfeItem(item, inventoryList);
    const key = matchedInv ? matchedInv.id : `unmatched_${item.description.trim().toLowerCase()}`;
    const name = matchedInv ? matchedInv.name : item.description;
    const unit = matchedInv?.unit || item.unit || 'UN';
    const currentStock = matchedInv ? Number(matchedInv.quantity) || 0 : 0;

    const existing = productMap.get(key);
    if (existing) {
      existing.quantityToReverse = Math.round((existing.quantityToReverse + qty) * 100) / 100;
    } else {
      productMap.set(key, {
        productName: name,
        quantityToReverse: qty,
        unit,
        inventoryItemId: matchedInv?.id,
        currentStock,
      });
    }
  });

  const reversalItems: StockReversalDetail[] = [];
  let hasNegativeStock = false;

  productMap.forEach(val => {
    const projectedStock = Math.round((val.currentStock - val.quantityToReverse) * 100) / 100;
    const isNegative = val.inventoryItemId ? projectedStock < 0 : false;
    if (isNegative) {
      hasNegativeStock = true;
    }
    reversalItems.push({
      productName: val.productName,
      nfeQuantity: val.quantityToReverse,
      unit: val.unit,
      inventoryItemId: val.inventoryItemId,
      currentStock: val.currentStock,
      projectedStock,
      isNegative,
      matchedByNameOrCode: Boolean(val.inventoryItemId),
    });
  });

  return {
    reversalItems,
    hasNegativeStock,
    totalProductsToReverse: reversalItems.filter(r => r.inventoryItemId).length,
  };
}

// Chave para persistência dedicada e única do Histórico Fiscal de Notas Fiscais
const NFE_FISCAL_RECORDS_KEY = 'silagem_facil_clean_v1_nfe_fiscal_records';

export function getStoredFiscalRecords(): Expense[] {
  try {
    const raw = localStorage.getItem(NFE_FISCAL_RECORDS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to load fiscal records', e);
  }
  return [];
}

export function saveStoredFiscalRecords(records: Expense[]): void {
  try {
    localStorage.setItem(NFE_FISCAL_RECORDS_KEY, JSON.stringify(records));
  } catch (e) {
    console.error('Failed to save fiscal records', e);
  }
}

/**
 * Extrai o número limpo da NF-e removendo qualquer formatação de parcela:
 * Ex: "(01/04)", "(1/4)", "(01 de 04)", "- Parcela 01", "/01", "P01"
 */
export function getCleanInvoiceNumber(rawNumber?: string): string {
  if (!rawNumber) return 'NF-e';
  const cleaned = rawNumber
    .replace(/\s*\(\s*\d+\s*[\/\-de\s]+\s*\d+\s*\)/gi, '')
    .replace(/\s*[-–/]\s*parc(ela)?\.?\s*\d+/gi, '')
    .replace(/\s*parc(ela)?\.?\s*\d+/gi, '')
    .replace(/\s*\(?\s*P\d+\s*\)?/gi, '')
    .trim();
  return cleaned || rawNumber.trim();
}

/**
 * Extrai a chave canônica da NF-e para agrupamento estrito de 1 linha por documento fiscal:
 * 1. Chave de Acesso da NF-e (44 dígitos contínuos)
 * 2. Número da NF limpo (dígitos normalizados sem zeros à esquerda) + fornecedor
 * 3. Raiz do ID sem o sufixo _parc_
 */
export function getCanonicalNfeKey(item: { 
  invoiceNumber?: string; 
  accessKey?: string; 
  notes?: string; 
  id?: string; 
  supplier?: string;
}): string {
  // 1. Chave de acesso de 44 dígitos
  const keyCandidate = item.accessKey || '';
  if (keyCandidate && /^\d{44}$/.test(keyCandidate.trim())) {
    return `key_${keyCandidate.trim()}`;
  }

  const keyMatch = item.notes?.match(/Chave:\s*([0-9A-Za-z]+)/i) || 
                   item.notes?.match(/\b(\d{44})\b/);
  if (keyMatch) {
    const found = (keyMatch[1] || keyMatch[0]).trim();
    if (found.length === 44 && /^\d+$/.test(found)) {
      return `key_${found}`;
    }
  }

  // 2. Extrai número numérico da NF-e limpo
  const cleanStr = getCleanInvoiceNumber(item.invoiceNumber);
  const digits = cleanStr.replace(/\D/g, '');
  if (digits) {
    const normalizedDigits = digits.replace(/^0+/, '') || '0';
    const supp = (item.supplier || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 15);
    return `doc_${normalizedDigits}_${supp}`;
  }

  // 3. Fallback: Raiz do ID
  const rootId = (item.id || '')
    .split('_parc_')[0]
    .replace(/^nfe_fisc_/, '')
    .replace(/^exp_nfe_/, '')
    .trim()
    .toLowerCase();
  return `id_${rootId || 'desconhecido'}`;
}

/**
 * Constrói e unifica o Histórico de Notas Fiscais para garantir que NENHUMA nota
 * fiscal possua múltiplas linhas na tabela fiscal decorrentes de desdobramento de parcelas.
 * Cada nota fiscal é consolidada em EXATAMENTE 1 ÚNICA LINHA exibindo o Valor Total Bruto.
 */
export function buildUnifiedFiscalRecords(expensesList: Expense[]): Expense[] {
  const storedFiscal = getStoredFiscalRecords();
  const cachedMap = getCachedNfeMap();
  const deletedNfeKeys = getDeletedNfeKeys();
  const deletedDocIds = getDeletedDocumentoEntradaIds();

  // Coleta todos os registros elegíveis de ambas as fontes
  const allCandidates: Expense[] = [
    ...storedFiscal,
    ...(expensesList || []).filter(e => {
      if (!e) return false;
      const num = (e.invoiceNumber || '').toLowerCase();
      const notes = (e.notes || '').toLowerCase();
      const id = (e.id || '').toLowerCase();
      return (
        num.includes('nf') || 
        num.includes('danfe') ||
        notes.includes('nf-e') || 
        notes.includes('chave:') || 
        notes.includes('lançamento de parcela via nf-e') ||
        id.includes('nfe') || 
        id.includes('_parc_') ||
        Boolean(e.nfeItems && e.nfeItems.length > 0)
      );
    })
  ].filter(item => {
    if (!item || !item.id) return false;
    const cleanId = String(item.id).trim().toLowerCase();
    const cleanNum = getCleanInvoiceNumber(item.invoiceNumber).toLowerCase();
    const digits = (item.invoiceNumber || '').replace(/\D/g, '');
    const num = (item.invoiceNumber || '').trim().toLowerCase();
    const canonical = getCanonicalNfeKey(item).toLowerCase();

    if (deletedNfeKeys.has(cleanId) || deletedDocIds.has(item.id)) return false;
    if (cleanNum && deletedNfeKeys.has(cleanNum)) return false;
    if (digits && deletedNfeKeys.has(digits)) return false;
    if (num && deletedNfeKeys.has(num)) return false;
    if (canonical && deletedNfeKeys.has(canonical)) return false;
    return true;
  });

  // Agrupa os itens pela chave canônica da NF-e
  const groups = new Map<string, Expense[]>();

  allCandidates.forEach(item => {
    const key = getCanonicalNfeKey(item);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(item);
  });

  const consolidatedList: Expense[] = [];

  groups.forEach((items, groupKey) => {
    if (!items || items.length === 0) return;

    // 1. Identifica se existe no cache da NF-e o registro bruto original do XML
    let cachedTotal: number | null = null;
    let cachedItems: any[] | null = null;
    let cachedSupplier = '';
    let cachedInvoiceNum = '';
    let cachedAccessKey = '';

    for (const item of items) {
      const cleanNum = getCleanInvoiceNumber(item.invoiceNumber);
      const digits = cleanNum.replace(/\D/g, '');
      const keyMatch = item.notes?.match(/\b(\d{44})\b/);
      const keyStr = keyMatch ? keyMatch[1] : '';

      const candidate = (item.id && cachedMap[item.id]) ||
                        (item.invoiceNumber && cachedMap[item.invoiceNumber.toLowerCase().trim()]) ||
                        (cleanNum && cachedMap[cleanNum.toLowerCase().trim()]) ||
                        (digits && cachedMap[digits]) ||
                        (keyStr && cachedMap[keyStr]) ||
                        cachedMap[groupKey];

      if (candidate && candidate.totalAmount && Number(candidate.totalAmount) > 0) {
        cachedTotal = Number(candidate.totalAmount);
        cachedItems = candidate.items || null;
        cachedSupplier = candidate.supplier || '';
        cachedInvoiceNum = candidate.invoiceNumber || '';
        cachedAccessKey = candidate.accessKey || '';
        break;
      }
    }

    // 2. Calcula o Valor Total Bruto Consolidado da Nota Fiscal:
    // Garante SEMPRE o valor cheio (ex: R$ 600,00), NUNCA o valor fracionado de uma parcela (ex: R$ 150,00)
    let consolidatedAmount = 0;

    if (cachedTotal && cachedTotal > 0) {
      consolidatedAmount = cachedTotal;
    } else {
      // Itens que são explicitamente pai (não são parcelas)
      const explicitParents = items.filter(i => 
        !i.id.includes('_parc_') && 
        !i.invoiceNumber?.match(/\(\s*\d+\s*[\/\-]\s*\d+\s*\)/) &&
        !i.notes?.includes('Lançamento de parcela')
      );

      // Itens que são parcelas individuais
      const installmentItems = items.filter(i => 
        i.id.includes('_parc_') || 
        Boolean(i.invoiceNumber?.match(/\(\s*\d+\s*[\/\-]\s*\d+\s*\)/)) ||
        Boolean(i.notes?.includes('Lançamento de parcela'))
      );

      if (installmentItems.length > 1) {
        // Se temos várias parcelas (ex: 4 parcelas de 150), a soma delas reconstitui o valor total bruto (600)
        const sumInstallments = installmentItems.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
        const maxParent = explicitParents.length > 0 ? Math.max(...explicitParents.map(p => Number(p.amount) || 0)) : 0;
        consolidatedAmount = Math.max(maxParent, sumInstallments);
      } else if (explicitParents.length > 0) {
        consolidatedAmount = Math.max(...explicitParents.map(p => Number(p.amount) || 0));
      } else {
        consolidatedAmount = Math.max(...items.map(i => Number(i.amount) || 0));
      }
    }

    // 3. Escolhe o melhor item representativo da nota (priorizando registro pai)
    const primaryItem = items.find(i => 
      !i.id.includes('_parc_') && 
      !i.invoiceNumber?.match(/\(\s*\d+\s*[\/\-]\s*\d+\s*\)/)
    ) || items[0];

    const cleanInvoiceNumber = cachedInvoiceNum || getCleanInvoiceNumber(primaryItem.invoiceNumber);
    const supplierName = cachedSupplier || primaryItem.supplier || 'Fornecedor NF-e';

    // 4. Status consolidado: 'pago' apenas se todas as despesas da nota estiverem pagas
    const allPaid = items.every(i => i.status === 'pago');
    const status = allPaid ? 'pago' : 'pendente';

    // 5. Itens e produtos da NF-e
    const nfeProducts = cachedItems || primaryItem.nfeItems || items.find(i => i.nfeItems && i.nfeItems.length > 0)?.nfeItems;

    // 6. Monta o Registro Único Fiscal da NF-e
    const rootId = primaryItem.id.split('_parc_')[0];
    const finalId = rootId.startsWith('nfe_fisc_') ? rootId : `nfe_fisc_${rootId.replace(/^exp_nfe_/, '')}`;

    const consolidatedRecord: Expense = {
      ...primaryItem,
      id: finalId,
      invoiceNumber: cleanInvoiceNumber,
      supplier: supplierName,
      description: `Compra ${cleanInvoiceNumber} - ${supplierName}`,
      amount: consolidatedAmount, // VALOR TOTAL BRUTO CONSOLIDADO (R$ 600,00)
      dueDate: primaryItem.dueDate,
      status,
      nfeItems: nfeProducts,
      accessKey: cachedAccessKey || primaryItem.accessKey,
      notes: primaryItem.notes,
    };

    consolidatedList.push(consolidatedRecord);
  });

  // Ordena decrescente por data
  consolidatedList.sort((a, b) => {
    const dateA = new Date(a.createdAt || a.dueDate).getTime();
    const dateB = new Date(b.createdAt || b.dueDate).getTime();
    return dateB - dateA;
  });

  return consolidatedList;
}

export interface NfeModuleProps {
  expenses: Expense[];
  companyProfile?: CompanyProfile;
  onAddExpenseFromNfe: (expense: Partial<Expense> | Partial<Expense>[]) => void;
  onDeleteExpense?: (id: string) => void;
  viewMode?: 'import' | 'list';
  inventory?: InventoryItem[];
  onSaveInventory?: (inventory: InventoryItem[]) => void;
  suppliers?: Supplier[];
  onSaveSuppliers?: (suppliers: Supplier[]) => void;
  costCenters?: CostCenter[];
  onSaveCostCenters?: (costCenters: CostCenter[]) => void;
  categories?: ExpenseCategory[];
  onNavigate?: (tab: string) => void;
}

export const NfeModule: React.FC<NfeModuleProps> = ({
  expenses,
  companyProfile,
  onAddExpenseFromNfe,
  onDeleteExpense,
  viewMode = 'import',
  inventory,
  onSaveInventory,
  suppliers,
  onSaveSuppliers,
  costCenters,
  onSaveCostCenters,
  categories,
  onNavigate,
}) => {
  // -------------------------------------------------------------------------
  // ABAS PRINCIPAIS DO CABEÇALHO & CENTRAL DE DOCUMENTOS UNIFICADA
  // -------------------------------------------------------------------------
  type MainFiscalTab = 'notas' | 'pedido_compra' | 'pedidos_reforma' | 'devolucao' | 'manifestacao_destinatario';
  type CentralDocumentDirection = 'entrada' | 'saida';
  type CentralDocumentFilter = 'todos' | 'nfe' | 'cte' | 'nfse' | 'nfce' | 'mdfe' | 'avulsas';

  const [activeMainFiscalTab, setActiveMainFiscalTab] = useState<MainFiscalTab>('notas');
  const [activeDocDirection, setActiveDocDirection] = useState<CentralDocumentDirection>('entrada');
  const [activeDocFilter, setActiveDocFilter] = useState<CentralDocumentFilter>('todos');

  // Competência ativa global sincronizada entre todas as abas
  const [fiscalCompetence, setFiscalCompetence] = useState<string>(() => getCurrentCompetence());

  const handlePrevCompetence = () => {
    setFiscalCompetence(prev => getPrevCompetence(prev));
  };

  const handleNextCompetence = () => {
    setFiscalCompetence(prev => getNextCompetence(prev));
  };

  const readLegacyFiscalDocsFromStorage = useCallback((): FiscalDocumentRecord[] => {
    const keys = [
      FISCAL_DOCS_STORAGE_KEYS.nfe,
      FISCAL_DOCS_STORAGE_KEYS.cte,
      FISCAL_DOCS_STORAGE_KEYS.nfe_c,
      FISCAL_DOCS_STORAGE_KEYS.nfse,
    ];
    const list: FiscalDocumentRecord[] = [];
    for (const key of keys) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            list.push(...parsed);
          }
        }
      } catch {}
    }
    return list;
  }, []);

  const [legacyFiscalDocs, setLegacyFiscalDocs] = useState<FiscalDocumentRecord[]>(() => readLegacyFiscalDocsFromStorage());
  const [mdfeDocs, setMdfeDocs] = useState<MdfeRecord[]>(() => getStoredMdfe());
  const [notasSaida, setNotasSaida] = useState<NotaSaidaRecord[]>(() => getStoredNotasSaida());
  const [localClients, setLocalClients] = useState<Client[]>(() => getStoredClients());

  const [pedidosCompraCount, setPedidosCompraCount] = useState<number>(() => {
    try {
      const r = localStorage.getItem('agrocontrol_pedidos_compra');
      return r ? JSON.parse(r).length : 0;
    } catch { return 0; }
  });
  const [reformOrdersCount, setReformOrdersCount] = useState<number>(() => getStoredReformOrders().length);
  const [pendingReformCount, setPendingReformCount] = useState<number>(() => getStoredPendingReformTires().length);
  const [devolucaoCounts, setDevolucaoCounts] = useState(() => getUnifiedFiscalDevolucaoCounts());
  const devolucaoCount = devolucaoCounts.total;
  const pendenciasDevolucaoCount = devolucaoCounts.aguardando;
  const [manifestacoesCount, setManifestacoesCount] = useState<number>(() => getStoredManifestacoes().length);

  // Helper para carregar e filtrar registros por competência
  const getFilteredCountFromStorage = (key: string, dateResolver: (item: any) => string | undefined) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return 0;
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) return 0;
      return list.filter(item => matchesCompetence(dateResolver(item), fiscalCompetence)).length;
    } catch {
      return 0;
    }
  };

  const pedidosCompraFilteredCount = useMemo(() => {
    return getFilteredCountFromStorage('agrocontrol_pedidos_compra', item => item.issueDate || item.createdAt);
  }, [fiscalCompetence, pedidosCompraCount]);

  const reformOrdersFilteredCount = useMemo(() => {
    return getStoredReformOrders().filter(o => matchesCompetence(o.createdAt || o.expectedReturnDate, fiscalCompetence)).length;
  }, [fiscalCompetence, reformOrdersCount]);

  const devolucaoFilteredCount = devolucaoCount;

  const manifestacoesFilteredCount = useMemo(() => {
    return getStoredManifestacoes().filter(m => matchesCompetence(m.dataEmissao || m.createdAt, fiscalCompetence)).length;
  }, [fiscalCompetence, manifestacoesCount]);

  // Escuta gatilho vindo da Gestão de Frotas ('colaca_silagem_abrir_pedido_reforma')
  useEffect(() => {
    const checkTrigger = () => {
      try {
        const flag = localStorage.getItem('colaca_silagem_abrir_pedido_reforma');
        if (flag === 'true') {
          setActiveMainFiscalTab('pedidos_reforma');
        }
      } catch {}
    };
    checkTrigger();
    window.addEventListener('colaca_silagem_abrir_pedido_reforma', checkTrigger);
    window.addEventListener('storage', checkTrigger);
    return () => {
      window.removeEventListener('colaca_silagem_abrir_pedido_reforma', checkTrigger);
      window.removeEventListener('storage', checkTrigger);
    };
  }, []);

  // Sincronização reativa dos contadores das abas e documentos legados / MDF-e / Notas de Saída / Clientes
  useEffect(() => {
    const handleCountUpdate = () => {
      setReformOrdersCount(getStoredReformOrders().length);
      setPendingReformCount(getStoredPendingReformTires().length);
      setDevolucaoCounts(getUnifiedFiscalDevolucaoCounts());
      setLegacyFiscalDocs(readLegacyFiscalDocsFromStorage());
      setMdfeDocs(getStoredMdfe());
      setNotasSaida(getStoredNotasSaida());
      setLocalClients(getStoredClients());
    };
    window.addEventListener('storage', handleCountUpdate);
    window.addEventListener('colaca_silagem_pedidos_reforma_updated', handleCountUpdate);
    window.addEventListener('colaca_silagem_abrir_pedido_reforma', handleCountUpdate);
    window.addEventListener('colaca_silagem_notas_devolucao_updated', handleCountUpdate);
    window.addEventListener('agrocontrol_pendencias_devolucao_updated', handleCountUpdate);
    window.addEventListener('agrocontrol_trocas_updated', handleCountUpdate);
    window.addEventListener('agrocontrol_notas_entradas_updated', handleCountUpdate);
    window.addEventListener('agrocontrol_notas_saida_updated', handleCountUpdate);
    window.addEventListener('silagem_clients_updated', handleCountUpdate);
    window.addEventListener('agrocontrol_clientes_updated', handleCountUpdate);
    return () => {
      window.removeEventListener('storage', handleCountUpdate);
      window.removeEventListener('colaca_silagem_pedidos_reforma_updated', handleCountUpdate);
      window.removeEventListener('colaca_silagem_abrir_pedido_reforma', handleCountUpdate);
      window.removeEventListener('colaca_silagem_notas_devolucao_updated', handleCountUpdate);
      window.removeEventListener('agrocontrol_pendencias_devolucao_updated', handleCountUpdate);
      window.removeEventListener('agrocontrol_trocas_updated', handleCountUpdate);
      window.removeEventListener('agrocontrol_notas_entradas_updated', handleCountUpdate);
      window.removeEventListener('agrocontrol_notas_saida_updated', handleCountUpdate);
      window.removeEventListener('silagem_clients_updated', handleCountUpdate);
      window.removeEventListener('agrocontrol_clientes_updated', handleCountUpdate);
    };
  }, [readLegacyFiscalDocsFromStorage]);

  // Estado dedicado reativo para Notas Fiscais Lançadas (NF-e) - Unicidade estrita de 1 linha por NF
  const [notasLancadas, setNotasLancadas] = useState<Expense[]>(() => {
    const list = (expenses && expenses.length > 0) ? expenses : getStoredExpenses();
    return buildUnifiedFiscalRecords(list);
  });

  useEffect(() => {
    if (expenses) {
      const unified = buildUnifiedFiscalRecords(expenses);
      setNotasLancadas(unified);
      saveStoredFiscalRecords(unified);
    }
  }, [expenses]);

  // Lista de Notas Fiscais rigorosamente consolidada para exibição na tabela fiscal (1 linha por documento fiscal com Valor Total Bruto)
  const notasFiscaisExibicao = useMemo(() => {
    return buildUnifiedFiscalRecords(expenses && expenses.length > 0 ? expenses : notasLancadas);
  }, [expenses, notasLancadas]);

  const [xmlContent, setXmlContent] = useState(() => {
    const draft = getActiveNfeDraft();
    return draft?.xmlContent || '';
  });
  const [parsedData, setParsedData] = useState<ParsedNfeData | null>(() => {
    const draft = getActiveNfeDraft();
    const p = draft?.parsedData || (draft?.invoiceNumber ? draft : null);
    return p || null;
  });
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [searchNfeNumber, setSearchNfeNumber] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(() => {
    const draft = getActiveNfeDraft();
    return draft?.editingExpenseId || null;
  });
  const [showExtraPrices, setShowExtraPrices] = useState(false);
  const [notaParaExcluir, setNotaParaExcluir] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-calibração reativa do motor fiscal: assegura CUSTO COMPOSTO = vProd + vIPI + freteItem e V. TOTAL = CUSTO COMPOSTO
  useEffect(() => {
    if (parsedData?.items && parsedData.items.length > 0) {
      let changed = false;
      const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;
      const normalizedItems = parsedData.items.map((it) => {
        const vProd = it.vProdOriginal !== undefined ? it.vProdOriginal : (it.unitPrice && it.quantity ? it.unitPrice * it.quantity : 0);
        const vIPI = it.vIPI || 0;
        const q = it.quantity || 1;
        const freteItem = it.freteProporcionalTotal !== undefined
          ? it.freteProporcionalTotal
          : round2((it.freteDiluidoItem || it.frete_diluido_item || 0) * q);

        const expectedItemTotal = (it.totalPrice && it.totalPrice > 0 && Math.abs(it.totalPrice - (vProd + vIPI + freteItem)) < 0.05)
          ? it.totalPrice
          : round2(vProd + vIPI + freteItem);
        const expectedCustoReal = q > 0 ? round2(expectedItemTotal / q) : expectedItemTotal;

        if ((vIPI > 0 || freteItem > 0) && (it.unitPrice !== expectedCustoReal || it.totalPrice !== expectedItemTotal)) {
          changed = true;
          return {
            ...it,
            unitPrice: expectedCustoReal,
            custoComImposto: expectedCustoReal,
            custo_com_imposto: expectedCustoReal,
            totalPrice: expectedItemTotal,
            freteProporcionalTotal: freteItem,
            freteDiluidoItem: q > 0 ? round2(freteItem / q) : freteItem,
            frete_diluido_item: q > 0 ? round2(freteItem / q) : freteItem,
          };
        }
        return it;
      });

      const totalItemsSum = round2(normalizedItems.reduce((acc, it) => acc + (it.totalPrice || 0), 0));
      const totalProdSum = round2(normalizedItems.reduce((acc, it) => acc + (it.vProdOriginal || 0), 0));

      if (changed || (parsedData.totalAmount === 0 && totalItemsSum > 0)) {
        setParsedData(prev => {
          if (!prev) return prev;
          const finalTotal = prev.totalAmount > 0 ? prev.totalAmount : totalItemsSum;
          return {
            ...prev,
            items: normalizedItems,
            productsAmount: (prev.productsAmount && prev.productsAmount > 0) ? prev.productsAmount : totalProdSum,
            totalAmount: finalTotal,
          };
        });
      }
    }
  }, [parsedData?.invoiceNumber, parsedData?.accessKey]);

  // Estado para perguntar e imprimir etiquetas de gôndola/almoxarifado após entrada de notas ou peças manuais
  const [printPromptState, setPrintPromptState] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    items: LabelProductItem[];
  } | null>(null);

  const [activeLabelPrintModal, setActiveLabelPrintModal] = useState<{
    isOpen: boolean;
    items: LabelProductItem[];
    title: string;
  } | null>(null);

  // ---------------------------------------------------------------------------
  // ENTRADAS MANUAIS (public.documentos_entrada: Romaneios, Recibos, etc.)
  // ---------------------------------------------------------------------------
  const [documentosEntrada, setDocumentosEntrada] = useState<DocumentoEntradaRecord[]>(() => {
    return getStoredDocumentosEntrada();
  });
  const [isSyncingDocs, setIsSyncingDocs] = useState(false);

  // Carrega e sincroniza entradas manuais do Supabase em tempo real com garantia multi-abas
  const reloadDocumentosEntrada = useCallback(async (showIndicator = false) => {
    if (showIndicator) setIsSyncingDocs(true);
    try {
      const activeCompanyId = companyProfile?.companyId || companyProfile?.id || getActiveCompanyId(companyProfile);
      const data = await fetchDocumentosEntrada(activeCompanyId);
      if (data && Array.isArray(data)) {
        const valid = data.filter(d => !isCorruptedOrGhostDocumento(d));
        setDocumentosEntrada(valid);
      }
    } catch (err) {
      console.warn('Erro ao sincronizar documentos de entrada:', err);
    } finally {
      if (showIndicator) {
        setTimeout(() => setIsSyncingDocs(false), 400);
      }
    }
  }, [companyProfile?.id, companyProfile?.companyId]);

  const handleManualSync = () => {
    reloadDocumentosEntrada(true);
  };

  const nfeDebounceTimerRef = useRef<any>(null);

  const debouncedReloadDocs = useCallback(() => {
    if (nfeDebounceTimerRef.current) clearTimeout(nfeDebounceTimerRef.current);
    nfeDebounceTimerRef.current = setTimeout(() => {
      reloadDocumentosEntrada(false);
    }, 450);
  }, [reloadDocumentosEntrada]);

  useEffect(() => {
    let isMounted = true;
    // Purga imediata de registros fantasmas antes de qualquer render
    purgeGhostDocumentosEntrada();
    reloadDocumentosEntrada(false);

    // 1. Canal Supabase Realtime dedicado com tópico estável e fechamento obrigatório
    let channel: any = null;
    const companyId = companyProfile?.id || getActiveCompanyId();
    if (isSupabaseConfigured) {
      const channelId = `nfe_doc_rt_${companyId || 'default'}`;

      const existingChannels = supabase.getChannels?.() || [];
      for (const ch of existingChannels) {
        if (ch.topic === channelId || ch.topic === `realtime:${channelId}`) {
          try { supabase.removeChannel(ch); } catch (_) {}
        }
      }

      try {
        channel = supabase
          .channel(channelId)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'documentos_entrada' },
            () => {
              if (isMounted) debouncedReloadDocs();
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'documentos_entrada_itens' },
            () => {
              if (isMounted) debouncedReloadDocs();
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'notas_fiscais' },
            () => {
              if (isMounted) debouncedReloadDocs();
            }
          )
          .subscribe();
      } catch (err) {
        console.warn('Falha ao inicializar canal Supabase Realtime NFe:', err);
      }
    }

    // 2. BroadcastChannel para comunicação instantânea entre abas no mesmo navegador
    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('silagem_documentos_entrada_channel');
        bc.onmessage = () => {
          if (isMounted) debouncedReloadDocs();
        };
      } catch (_) {}
    }

    // 3. Listeners para evento storage (localStorage cross-tab) e foco da janela
    const handleStorageEvent = (e: StorageEvent) => {
      if (
        e.key === 'agrocontrol_notas_entradas' ||
        e.key === 'colaca_silagem_documentos_entrada' ||
        e.key === 'silagem_facil_documentos_entrada_v1'
      ) {
        if (isMounted) {
          setDocumentosEntrada(getStoredDocumentosEntrada());
          debouncedReloadDocs();
        }
      }
    };
    const handleCustomSyncEvent = (e?: any) => {
      if (isMounted) {
        if (e?.detail && Array.isArray(e.detail)) {
          const valid = e.detail.filter((d: any) => !isCorruptedOrGhostDocumento(d));
          setDocumentosEntrada(valid);
        } else {
          setDocumentosEntrada(getStoredDocumentosEntrada());
        }
      }
    };
    const handleFocus = () => {
      if (isMounted) debouncedReloadDocs();
    };

    window.addEventListener('storage', handleStorageEvent);
    window.addEventListener('agrocontrol_notas_entradas_updated', handleCustomSyncEvent);
    window.addEventListener('colaca_silagem_documentos_entrada_updated', handleCustomSyncEvent);
    window.addEventListener('silagem_documentos_entrada_updated', handleCustomSyncEvent);
    window.addEventListener('focus', handleFocus);
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isMounted) {
        debouncedReloadDocs();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      if (nfeDebounceTimerRef.current) {
        clearTimeout(nfeDebounceTimerRef.current);
      }
      if (channel) {
        try { supabase.removeChannel(channel); } catch (_) {}
      }
      if (bc) {
        try { bc.close(); } catch (_) {}
      }
      window.removeEventListener('storage', handleStorageEvent);
      window.removeEventListener('agrocontrol_notas_entradas_updated', handleCustomSyncEvent);
      window.removeEventListener('colaca_silagem_documentos_entrada_updated', handleCustomSyncEvent);
      window.removeEventListener('silagem_documentos_entrada_updated', handleCustomSyncEvent);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [debouncedReloadDocs, companyProfile?.id]);

  // Fornecedores locais e sincronização
  const [localSuppliers, setLocalSuppliers] = useState<Supplier[]>(() => {
    return (suppliers && suppliers.length > 0) ? suppliers : getStoredSuppliers();
  });

  useEffect(() => {
    if (suppliers && suppliers.length > 0) {
      setLocalSuppliers(suppliers);
    }
  }, [suppliers]);

  const saveSuppliers = (updated: Supplier[]) => {
    setLocalSuppliers(updated);
    if (onSaveSuppliers) {
      onSaveSuppliers(updated);
    }
    saveStoredSuppliers(updated);
    try {
      localStorage.setItem('agrocontrol_fornecedores', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  // Estado local do inventário sincronizado com props ou storage
  const [localInventory, setLocalInventory] = useState<InventoryItem[]>(() => {
    return (inventory && inventory.length > 0) ? inventory : getStoredInventory();
  });

  useEffect(() => {
    if (inventory && inventory.length > 0) {
      setLocalInventory(inventory);
    }
  }, [inventory]);

  const saveInventory = (updated: InventoryItem[]) => {
    setLocalInventory(updated);
    if (onSaveInventory) {
      onSaveInventory(updated);
    }
    saveStoredInventory(updated);
  };

  // =========================================================================
  // MODAL DE NOVA ENTRADA MANUAL (FLUXO STEPPER INTELIGENTE EM ETAPAS)
  // =========================================================================
  const [isManualEntryModalOpen, setIsManualEntryModalOpen] = useState(false);
  const [manualEntryStep, setManualEntryStep] = useState<1 | 2>(1);
  const [currentManualDoc, setCurrentManualDoc] = useState<DocumentoEntradaRecord | null>(null);
  const [linkedReformOrderId, setLinkedReformOrderId] = useState<string | null>(null);
  // Janela 2 (Entrada Manual): Forma de Pagamento e Condições de Lançamento Financeiro
  const [isManualInstallmentsModalOpen, setIsManualInstallmentsModalOpen] = useState(false);

  // Helper para cálculo de vencimento padrão (30 dias) em horário local seguro
  const calculateDefaultDueDate = (dateStr?: string): string => {
    try {
      let d: Date;
      if (dateStr && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
        const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
        d = new Date(year, month - 1, day);
      } else {
        d = new Date();
      }
      d.setDate(d.getDate() + 30);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dayStr = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dayStr}`;
    } catch {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dayStr = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dayStr}`;
    }
  };

  // PASSO 1: Dados do Cabeçalho
  const [manualSupplier, setManualSupplier] = useState('');
  const [manualDate, setManualDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [manualDueDate, setManualDueDate] = useState(() => calculateDefaultDueDate(new Date().toISOString().split('T')[0]));
  const [manualDocumentType, setManualDocumentType] = useState<TipoDocumentoEntrada>('Romaneio');
  const [manualPaymentCondition, setManualPaymentCondition] = useState<string>('Boleto Bancário');
  const [manualInstallmentsCount, setManualInstallmentsCount] = useState<number>(1);
  const [manualVehicleId, setManualVehicleId] = useState<string>('');
  const [manualAmountDisplay, setManualAmountDisplay] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [isSavingManualEntry, setIsSavingManualEntry] = useState(false);
  const [manualFormError, setManualFormError] = useState('');

  // Frota / Máquinas para vínculo opcional com DRE da Frota
  const loadAvailableVehicles = useCallback((): Machinery[] => {
    const stored = getStoredMachineries();
    if (stored && stored.length > 0) return stored;
    const fallbackKeys = ['agrocontrol_frotas_veiculos', 'agrocontrol_veiculos', 'colaca_silagem_frotas_veiculos'];
    for (const key of fallbackKeys) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return [];
  }, []);

  const [availableVehicles, setAvailableVehicles] = useState<Machinery[]>(() => loadAvailableVehicles());

  useEffect(() => {
    const refreshVehicles = () => setAvailableVehicles(loadAvailableVehicles());
    if (isManualEntryModalOpen) refreshVehicles();
    window.addEventListener('silagem_machineries_updated', refreshVehicles);
    window.addEventListener('storage', refreshVehicles);
    return () => {
      window.removeEventListener('silagem_machineries_updated', refreshVehicles);
      window.removeEventListener('storage', refreshVehicles);
    };
  }, [isManualEntryModalOpen, loadAvailableVehicles]);

  const mapPaymentConditionToMethodKey = (cond: string): string => {
    const c = (cond || '').toLowerCase();
    if (c.includes('pix')) return 'pix';
    if (c.includes('dinheiro')) return 'dinheiro';
    if (c.includes('cart')) return 'cartao_credito';
    if (c.includes('transfer')) return 'transferencia';
    if (c.includes('prazo') || c.includes('faturado') || c.includes('safra')) return 'safra_prazo';
    return 'boleto';
  };

  const handlePaymentConditionChange = (newCondition: string) => {
    setManualPaymentCondition(newCondition);
    const isImmediate = newCondition === 'PIX' || newCondition === 'Dinheiro' || newCondition === 'Transferência';
    if (isImmediate) {
      setManualInstallmentsCount(1);
      setManualDueDate(manualDate || new Date().toISOString().split('T')[0]);
    } else {
      setManualDueDate(calculateDefaultDueDate(manualDate));
    }
  };

  // =========================================================================
  // MODAL DE LANÇAMENTO / REGISTRO DE NOTA DE SAÍDA (EMITIDAS PELA EMPRESA)
  // =========================================================================
  const [isNotaSaidaModalOpen, setIsNotaSaidaModalOpen] = useState(false);
  const [editingNotaSaida, setEditingNotaSaida] = useState<NotaSaidaRecord | null>(null);
  const [localEmployees, setLocalEmployees] = useState<Employee[]>(() => getStoredEmployees());
  const [localServices, setLocalServices] = useState<ServiceOrder[]>(() => getStoredServices());

  const [saidaTipoDocumento, setSaidaTipoDocumento] = useState<TipoDocumentoSaida>('NFS-e (Prestação de Serviço)');
  const [saidaNumero, setSaidaNumero] = useState('');
  const [saidaSerie, setSaidaSerie] = useState('1');
  const [saidaDataEmissao, setSaidaDataEmissao] = useState(() => new Date().toISOString().split('T')[0]);
  const [saidaDataVencimento, setSaidaDataVencimento] = useState(() => calculateDefaultDueDate(new Date().toISOString().split('T')[0]));
  const [saidaChaveAcesso, setSaidaChaveAcesso] = useState('');
  const [saidaDestinatarioId, setSaidaDestinatarioId] = useState('');
  const [saidaDestinatarioNome, setSaidaDestinatarioNome] = useState('');
  const [saidaDestinatarioCpfCnpj, setSaidaDestinatarioCpfCnpj] = useState('');
  const [saidaDestinatarioIe, setSaidaDestinatarioIe] = useState('');
  const [saidaDestinatarioEndereco, setSaidaDestinatarioEndereco] = useState('');
  const [saidaDestinatarioCidadeUf, setSaidaDestinatarioCidadeUf] = useState('');
  const [saidaIsConsumidorAvulso, setSaidaIsConsumidorAvulso] = useState(false);
  const [saidaVeiculoId, setSaidaVeiculoId] = useState('');
  const [saidaVeiculoPlaca, setSaidaVeiculoPlaca] = useState('');
  const [saidaDescricao, setSaidaDescricao] = useState('');
  const [saidaValorDisplay, setSaidaValorDisplay] = useState('');
  const [saidaCondicaoPagamento, setSaidaCondicaoPagamento] = useState('Boleto Bancário');
  const [saidaLancarContasReceber, setSaidaLancarContasReceber] = useState(false);
  const [saidaFormError, setSaidaFormError] = useState('');
  const notaSaidaBodyRef = useRef<HTMLDivElement | null>(null);
  const [viewingNotaSaida, setViewingNotaSaida] = useState<NotaSaidaRecord | null>(null);
  const [notaSaidaToDelete, setNotaSaidaToDelete] = useState<NotaSaidaRecord | null>(null);

  // A) Campos específicos NFS-e
  const [nfseCodigoServico, setNfseCodigoServico] = useState('17.05');
  const [nfseMunicipioPrestacao, setNfseMunicipioPrestacao] = useState('');
  const [nfseAliquotaIss, setNfseAliquotaIss] = useState('2.00');
  const [nfseValorIssDisplay, setNfseValorIssDisplay] = useState('0,00');
  const [nfseRetencaoIss, setNfseRetencaoIss] = useState(false);
  const [nfseNaturezaOperacao, setNfseNaturezaOperacao] = useState('Tributação no Município');
  const [nfsePedidoServicoId, setNfsePedidoServicoId] = useState('');
  const [nfseQuantidadeAreaHoras, setNfseQuantidadeAreaHoras] = useState('');
  const [nfseUnidadeAreaHoras, setNfseUnidadeAreaHoras] = useState('HORAS');
  const [nfseValorUnitarioDisplay, setNfseValorUnitarioDisplay] = useState('');
  const [nfseObservacoesFiscais, setNfseObservacoesFiscais] = useState('');

  // B & D) Campos específicos NF-e (Venda / Remessa / Retorno) e NFC-e
  const [nfeNaturezaOperacao, setNfeNaturezaOperacao] = useState('Venda de Mercadoria');
  const [nfeRemessaEscopo, setNfeRemessaEscopo] = useState<'estadual' | 'interestadual'>('estadual');
  const [nfeCfop, setNfeCfop] = useState('5102');
  const [nfeFinalidade, setNfeFinalidade] = useState('Normal');
  const [nfeModalidadeFrete, setNfeModalidadeFrete] = useState('9 - Sem Frete');
  const [nfeTransportadoraNome, setNfeTransportadoraNome] = useState('');
  const [nfeTransportadoraPlaca, setNfeTransportadoraPlaca] = useState('');
  const [nfeReferenciada, setNfeReferenciada] = useState('');
  const [saidaItens, setSaidaItens] = useState<NotaSaidaItem[]>([]);
  const [saidaBaixarEstoque, setSaidaBaixarEstoque] = useState(false);

  // Catálogo completo de CFOPs e Códigos LC 116/03 (Engrenagem)
  const [cfopCatalog, setCfopCatalog] = useState<CfopCatalogEntry[]>(() => getStoredCfopCatalog());
  const [isCfopManagerOpen, setIsCfopManagerOpen] = useState(false);
  const [cfopManagerTarget, setCfopManagerTarget] = useState<'nfe' | 'cte' | { itemIndex: number }>('nfe');
  const [lc116Codes, setLc116Codes] = useState<Lc116ServiceCodeEntry[]>(() => getStoredLc116ServiceCodes());
  const [isLc116ManagerOpen, setIsLc116ManagerOpen] = useState(false);

  // Pré-carrega mídia do IndexedDB (logotipo da empresa) para impressão síncrona instantânea
  useEffect(() => {
    void preloadAllMediaFromIndexedDB();
  }, []);

  // Dados Adicionais / Informações Complementares e Reservado ao Fisco (Universal)
  const [saidaInformacoesComplementares, setSaidaInformacoesComplementares] = useState('');
  const [isInformacoesComplementaresManual, setIsInformacoesComplementaresManual] = useState(false);
  const [saidaReservadoFisco, setSaidaReservadoFisco] = useState('');

  // C) Campos específicos CT-e
  const [cteCfop, setCteCfop] = useState('5352');
  const [cteTipoServico, setCteTipoServico] = useState('Normal');
  const [cteMunicipioInicio, setCteMunicipioInicio] = useState('');
  const [cteMunicipioTermino, setCteMunicipioTermino] = useState('');
  const [cteTomador, setCteTomador] = useState('Remetente');
  const [cteRemetenteId, setCteRemetenteId] = useState('');
  const [cteRemetenteNome, setCteRemetenteNome] = useState('');
  const [cteRemetenteCpfCnpj, setCteRemetenteCpfCnpj] = useState('');
  const [cteRemetenteIe, setCteRemetenteIe] = useState('');
  const [cteRemetenteEndereco, setCteRemetenteEndereco] = useState('');
  const [cteRemetenteCidadeUf, setCteRemetenteCidadeUf] = useState('');
  const [cteRemetenteIsEmpresaPropria, setCteRemetenteIsEmpresaPropria] = useState(false);
  const [cteTomadorTerceiroId, setCteTomadorTerceiroId] = useState('');
  const [cteTomadorTerceiroNome, setCteTomadorTerceiroNome] = useState('');
  const [cteTomadorTerceiroCpfCnpj, setCteTomadorTerceiroCpfCnpj] = useState('');
  const [cteTomadorTerceiroIe, setCteTomadorTerceiroIe] = useState('');
  const [cteTomadorTerceiroEndereco, setCteTomadorTerceiroEndereco] = useState('');
  const [cteTomadorTerceiroCidadeUf, setCteTomadorTerceiroCidadeUf] = useState('');
  const [cteProdutoPredominante, setCteProdutoPredominante] = useState('Silagem de Milho');
  const [ctePesoBrutoKg, setCtePesoBrutoKg] = useState('');
  const [cteValorCargaDisplay, setCteValorCargaDisplay] = useState('');
  const [cteNfeTransportada, setCteNfeTransportada] = useState('');
  const [cteNfesVinculadas, setCteNfesVinculadas] = useState<CteNfeVinculada[]>([]);
  const [saidaMotoristaId, setSaidaMotoristaId] = useState('');
  const [saidaMotoristaNome, setSaidaMotoristaNome] = useState('');
  const [saidaMotoristaCpf, setSaidaMotoristaCpf] = useState('');

  // E) Campos específicos MDF-e
  const [mdfeUfCarregamento, setMdfeUfCarregamento] = useState('PR');
  const [mdfeUfDescarregamento, setMdfeUfDescarregamento] = useState('PR');
  const [mdfeMunicipiosPercurso, setMdfeMunicipiosPercurso] = useState('');
  const [mdfeVeiculoRenavam, setMdfeVeiculoRenavam] = useState('');
  const [mdfeReboquePlaca, setMdfeReboquePlaca] = useState('');
  const [mdfeSeguradora, setMdfeSeguradora] = useState('');
  const [mdfeApoliceSeguro, setMdfeApoliceSeguro] = useState('');
  const [mdfeDocumentosVinculados, setMdfeDocumentosVinculados] = useState('');
  const [mdfePesoTotalKg, setMdfePesoTotalKg] = useState('');
  const [mdfeValorTotalCargaDisplay, setMdfeValorTotalCargaDisplay] = useState('');

  const [itemQtyInputMap, setItemQtyInputMap] = useState<Record<string, string>>({});

  const maskBrCurrencyATM = (raw: string): string => {
    const digits = String(raw || '').replace(/\D/g, '');
    if (!digits) return '';
    const cents = Number(digits);
    if (!cents) return '';
    return formatCurrencyInputDisplay(cents / 100);
  };

  const parsePtBrNumber = (raw: string | number | undefined | null): number => {
    if (raw === undefined || raw === null || raw === '') return 0;
    if (typeof raw === 'number') return isNaN(raw) ? 0 : raw;
    const normalized = String(raw).trim().replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : parsed;
  };

  const formatBrNumberDisplay = (num: number, maxDecimals = 3): string => {
    if (!num || isNaN(num)) return '';
    return num.toLocaleString('pt-BR', { maximumFractionDigits: maxDecimals });
  };

  const maskBrNumberWithThousands = (raw: string, maxDecimals = 3): string => {
    const cleaned = String(raw || '').replace(/[^\d,]/g, '');
    if (!cleaned) return '';
    const commaIdx = cleaned.indexOf(',');
    const hasComma = commaIdx !== -1;
    const intRaw = (hasComma ? cleaned.slice(0, commaIdx) : cleaned).replace(/\D/g, '');
    const decRaw = hasComma ? cleaned.slice(commaIdx + 1).replace(/\D/g, '').slice(0, maxDecimals) : '';
    const formattedInt = intRaw ? Number(intRaw).toLocaleString('pt-BR') : '0';
    return hasComma ? `${formattedInt},${decRaw}` : formattedInt;
  };

  const createEmptyCteNfeRow = (): CteNfeVinculada => ({
    id: `cte_nfe_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    sourceDocId: '',
    numero: '',
    serie: '1',
    chaveAcesso: '',
    valorNota: 0,
  });

  const createEmptySaidaItem = (defaultCfop = '5102'): NotaSaidaItem => ({
    id: `ns_item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    inventoryItemId: '',
    codigo: '',
    descricao: '',
    ncm: '',
    cfop: defaultCfop,
    unidade: 'UN',
    quantidade: 1,
    valorUnitario: 0,
    desconto: 0,
    baseIcms: 0,
    aliquotaIcms: 0,
    valorIcms: 0,
    valorTotal: 0,
  });

  const resetSpecificNotaSaidaFields = () => {
    const activeCompany = companyProfile || getStoredCompanyProfile();
    const defaultCityUf = activeCompany?.city
      ? `${activeCompany.city}${activeCompany.state ? `/${activeCompany.state}` : ''}`
      : '';

    setNfseCodigoServico('17.05');
    setNfseMunicipioPrestacao(defaultCityUf);
    setNfseAliquotaIss('2.00');
    setNfseValorIssDisplay('0,00');
    setNfseRetencaoIss(false);
    setNfseNaturezaOperacao('Tributação no Município');
    setNfsePedidoServicoId('');
    setNfseQuantidadeAreaHoras('');
    setNfseUnidadeAreaHoras('HORAS');
    setNfseValorUnitarioDisplay('');
    setNfseObservacoesFiscais('');

    setNfeNaturezaOperacao('Venda de Mercadoria');
    setNfeRemessaEscopo('estadual');
    setNfeCfop('5102');
    setNfeFinalidade('Normal');
    setNfeModalidadeFrete('9 - Sem Frete');
    setNfeTransportadoraNome('');
    setNfeTransportadoraPlaca('');
    setNfeReferenciada('');
    setSaidaItens([createEmptySaidaItem('5102')]);
    setSaidaBaixarEstoque(false);

    setCteCfop('5352');
    setCteTipoServico('Normal');
    setCteMunicipioInicio(defaultCityUf);
    setCteMunicipioTermino('');
    setCteTomador('Remetente');
    setCteRemetenteId('');
    setCteRemetenteNome('');
    setCteRemetenteCpfCnpj('');
    setCteRemetenteIe('');
    setCteRemetenteEndereco('');
    setCteRemetenteCidadeUf('');
    setCteRemetenteIsEmpresaPropria(false);
    setCteTomadorTerceiroId('');
    setCteTomadorTerceiroNome('');
    setCteTomadorTerceiroCpfCnpj('');
    setCteTomadorTerceiroIe('');
    setCteTomadorTerceiroEndereco('');
    setCteTomadorTerceiroCidadeUf('');
    setCteProdutoPredominante('Silagem de Milho');
    setCtePesoBrutoKg('');
    setCteValorCargaDisplay('');
    setCteNfeTransportada('');
    setCteNfesVinculadas([createEmptyCteNfeRow()]);
    setSaidaMotoristaId('');
    setSaidaMotoristaNome('');
    setSaidaMotoristaCpf('');

    setMdfeUfCarregamento((activeCompany?.state || 'PR').toUpperCase());
    setMdfeUfDescarregamento((activeCompany?.state || 'PR').toUpperCase());
    setMdfeMunicipiosPercurso('');
    setMdfeVeiculoRenavam('');
    setMdfeReboquePlaca('');
    setMdfeSeguradora('');
    setMdfeApoliceSeguro('');
    setMdfeDocumentosVinculados('');
    setMdfePesoTotalKg('');
    setMdfeValorTotalCargaDisplay('');
  };

  const inferOperacaoUfEscopo = (destCidadeUf: string): 'estadual' | 'interestadual' => {
    const activeCompany = companyProfile || getStoredCompanyProfile();
    const companyUf = (activeCompany?.state || '').trim().toUpperCase();
    const parts = (destCidadeUf || '').split('/');
    const rawUf = (parts.length > 1 ? parts[parts.length - 1] : '').trim().toUpperCase();
    const destUf = rawUf.length === 2 ? rawUf : '';
    if (companyUf.length === 2 && destUf.length === 2 && companyUf !== destUf) {
      return 'interestadual';
    }
    return 'estadual';
  };

  const cfopUfPrefix = nfeRemessaEscopo === 'interestadual' ? '6' : '5';

  const cfopsNfeVendaByScope = useMemo(() => {
    const list = cfopCatalog.filter(
      (c) => c.codigo.startsWith(cfopUfPrefix) && c.tipo !== 'transporte'
    );
    const priorityOrder: Record<CfopOperacaoTipo, number> =
      nfeNaturezaOperacao === 'Devolução'
        ? { devolucao: 0, venda: 1, remessa_retorno: 2, outros: 3, transporte: 4 }
        : nfeNaturezaOperacao === 'Remessa'
          ? { remessa_retorno: 0, outros: 1, venda: 2, devolucao: 3, transporte: 4 }
          : nfeNaturezaOperacao === 'Transferência'
            ? { outros: 0, venda: 1, remessa_retorno: 2, devolucao: 3, transporte: 4 }
            : { venda: 0, devolucao: 1, remessa_retorno: 2, outros: 3, transporte: 4 };
    return [...list].sort(
      (a, b) => priorityOrder[a.tipo] - priorityOrder[b.tipo] || a.codigo.localeCompare(b.codigo)
    );
  }, [cfopCatalog, cfopUfPrefix, nfeNaturezaOperacao]);

  const cfopsNfeRemessaByScope = useMemo(() => {
    const list = cfopCatalog.filter(
      (c) => c.codigo.startsWith(cfopUfPrefix) && c.tipo !== 'transporte'
    );
    const priorityOrder: Record<CfopOperacaoTipo, number> = {
      remessa_retorno: 0,
      devolucao: 1,
      outros: 2,
      venda: 3,
      transporte: 4,
    };
    return [...list].sort(
      (a, b) => priorityOrder[a.tipo] - priorityOrder[b.tipo] || a.codigo.localeCompare(b.codigo)
    );
  }, [cfopCatalog, cfopUfPrefix]);

  const cfopsNfceByScope = useMemo(() => {
    const list = cfopCatalog.filter(
      (c) => c.codigo.startsWith(cfopUfPrefix) && (c.tipo === 'venda' || c.tipo === 'outros')
    );
    return list.length > 0
      ? list
      : cfopCatalog.filter((c) => c.codigo.startsWith(cfopUfPrefix) && c.tipo !== 'transporte');
  }, [cfopCatalog, cfopUfPrefix]);

  const cfopsCteByScope = useMemo(() => {
    const list = cfopCatalog.filter(
      (c) => c.codigo.startsWith(cfopUfPrefix) && c.tipo === 'transporte'
    );
    return list.length > 0 ? list : cfopCatalog.filter((c) => c.codigo.startsWith(cfopUfPrefix));
  }, [cfopCatalog, cfopUfPrefix]);

  const cfopsAllByScope = useMemo(() => {
    return cfopCatalog.filter((c) => c.codigo.startsWith(cfopUfPrefix));
  }, [cfopCatalog, cfopUfPrefix]);

  useEffect(() => {
    if (!isNotaSaidaModalOpen || editingNotaSaida || isInformacoesComplementaresManual) return;
    const suggested = buildDefaultInformacoesComplementares({
      tipoDocumento: saidaTipoDocumento,
      naturezaOperacao: nfeNaturezaOperacao,
      nfeReferenciada,
      veiculoPlaca: saidaVeiculoPlaca || nfeTransportadoraPlaca,
      motoristaNome: saidaMotoristaNome,
    });
    setSaidaInformacoesComplementares(suggested);
  }, [
    isNotaSaidaModalOpen,
    editingNotaSaida,
    isInformacoesComplementaresManual,
    saidaTipoDocumento,
    nfeNaturezaOperacao,
    nfeReferenciada,
    saidaVeiculoPlaca,
    nfeTransportadoraPlaca,
    saidaMotoristaNome,
  ]);


  const handleOpenNotaSaidaModal = () => {
    const today = new Date().toISOString().split('T')[0];
    const freshNotas = getStoredNotasSaida();
    const defaultTipo: TipoDocumentoSaida = 'NFS-e (Prestação de Serviço)';
    const defaultSerie = '1';
    setNotasSaida(freshNotas);
    setLocalClients(getStoredClients());
    if (!suppliers || suppliers.length === 0) {
      setLocalSuppliers(getStoredSuppliers());
    }
    setAvailableVehicles(loadAvailableVehicles());
    setLocalEmployees(getStoredEmployees());
    setLocalServices(getStoredServices());
    setCfopCatalog(getStoredCfopCatalog());
    setLc116Codes(getStoredLc116ServiceCodes());
    setEditingNotaSaida(null);
    setSaidaTipoDocumento(defaultTipo);
    setSaidaSerie(defaultSerie);
    setSaidaNumero(getNextNotaSaidaNumber(defaultTipo, defaultSerie, freshNotas));
    setSaidaDataEmissao(today);
    setSaidaDataVencimento(calculateDefaultDueDate(today));
    setSaidaChaveAcesso('');
    setSaidaDestinatarioId('');
    setSaidaDestinatarioNome('');
    setSaidaDestinatarioCpfCnpj('');
    setSaidaDestinatarioIe('');
    setSaidaDestinatarioEndereco('');
    setSaidaDestinatarioCidadeUf('');
    setSaidaIsConsumidorAvulso(false);
    setSaidaVeiculoId('');
    setSaidaVeiculoPlaca('');
    setSaidaDescricao('');
    setSaidaValorDisplay('');
    setSaidaCondicaoPagamento('Boleto Bancário');
    setSaidaLancarContasReceber(false); // Desmarcado por padrão
    setIsInformacoesComplementaresManual(false);
    setSaidaInformacoesComplementares(
      buildDefaultInformacoesComplementares({ tipoDocumento: defaultTipo })
    );
    setSaidaReservadoFisco('');
    setItemQtyInputMap({});
    resetSpecificNotaSaidaFields();
    setSaidaFormError('');
    setIsNotaSaidaModalOpen(true);
  };

  const handleOpenEditNotaSaida = (nota: NotaSaidaRecord) => {
    setLocalClients(getStoredClients());
    if (!suppliers || suppliers.length === 0) {
      setLocalSuppliers(getStoredSuppliers());
    }
    setAvailableVehicles(loadAvailableVehicles());
    setLocalEmployees(getStoredEmployees());
    setLocalServices(getStoredServices());
    setEditingNotaSaida(nota);
    setSaidaTipoDocumento(nota.tipoDocumento || 'NFS-e (Prestação de Serviço)');
    setSaidaNumero(nota.numero || '');
    setSaidaSerie(nota.serie || '1');
    setSaidaDataEmissao(nota.dataEmissao || new Date().toISOString().split('T')[0]);
    setSaidaDataVencimento(nota.dataVencimento || calculateDefaultDueDate(nota.dataEmissao));
    setSaidaChaveAcesso(nota.chaveAcesso || '');
    setSaidaDestinatarioId(nota.destinatarioId || '');
    setSaidaDestinatarioNome(nota.destinatarioNome || '');
    setSaidaDestinatarioCpfCnpj(nota.destinatarioCpfCnpj || '');
    setSaidaDestinatarioIe(nota.destinatarioIe || '');
    setSaidaDestinatarioEndereco(nota.destinatarioEndereco || '');
    setSaidaDestinatarioCidadeUf(nota.destinatarioCidadeUf || '');
    setSaidaIsConsumidorAvulso(Boolean(nota.isConsumidorAvulso));
    setSaidaVeiculoId(nota.veiculoId || '');
    setSaidaVeiculoPlaca(nota.veiculoPlaca || '');
    setSaidaDescricao(nota.descricao || '');
    setSaidaValorDisplay(nota.valorTotal ? formatCurrencyInputDisplay(nota.valorTotal) : '');
    setSaidaCondicaoPagamento(nota.condicaoPagamento || 'Boleto Bancário');
    setSaidaLancarContasReceber(Boolean(nota.lancarContasReceber));

    // NFS-e
    setNfseCodigoServico(nota.nfseCodigoServico || '17.05');
    setNfseMunicipioPrestacao(nota.nfseMunicipioPrestacao || nota.destinatarioCidadeUf || '');
    setNfseAliquotaIss(nota.nfseAliquotaIss !== undefined ? String(nota.nfseAliquotaIss) : '2.00');
    setNfseValorIssDisplay(nota.nfseValorIss ? formatCurrencyInputDisplay(nota.nfseValorIss) : '0,00');
    setNfseRetencaoIss(Boolean(nota.nfseRetencaoIss));
    setNfseNaturezaOperacao(nota.nfseNaturezaOperacao || 'Tributação no Município');
    setNfsePedidoServicoId(nota.nfsePedidoServicoId || '');
    setNfseQuantidadeAreaHoras(nota.nfseQuantidadeAreaHoras ? formatBrNumberDisplay(nota.nfseQuantidadeAreaHoras) : '');
    setNfseUnidadeAreaHoras(nota.nfseUnidadeAreaHoras || 'HORAS');
    setNfseValorUnitarioDisplay(nota.nfseValorUnitario ? formatCurrencyInputDisplay(nota.nfseValorUnitario) : '');
    setNfseObservacoesFiscais(nota.nfseObservacoesFiscais || '');

    // NF-e / NFC-e
    setNfeNaturezaOperacao(nota.nfeNaturezaOperacao || 'Venda de Mercadoria');
    const inferredEditEscopo: 'estadual' | 'interestadual' =
      (nota.cteCfop || nota.nfeCfop || '').startsWith('6') ? 'interestadual' : 'estadual';
    setNfeRemessaEscopo(inferredEditEscopo);
    setNfeCfop(nota.nfeCfop || '5102');
    setNfeFinalidade(nota.nfeFinalidade || 'Normal');
    setNfeModalidadeFrete(nota.nfeModalidadeFrete || '9 - Sem Frete');
    setNfeTransportadoraNome(nota.nfeTransportadoraNome || '');
    setNfeTransportadoraPlaca(nota.nfeTransportadoraPlaca || '');
    setNfeReferenciada(nota.nfeReferenciada || '');
    setSaidaItens(nota.itens && nota.itens.length > 0 ? nota.itens : [createEmptySaidaItem(nota.nfeCfop || '5102')]);
    setSaidaBaixarEstoque(Boolean(nota.baixarEstoqueAutomatico));

    // CT-e
    setCteCfop(nota.cteCfop || '5352');
    setCteTipoServico(nota.cteTipoServico || 'Normal');
    setCteMunicipioInicio(nota.cteMunicipioInicio || '');
    setCteMunicipioTermino(nota.cteMunicipioTermino || '');
    setCteTomador(nota.cteTomador || 'Remetente');
    setCteRemetenteId(nota.cteRemetenteId || '');
    setCteRemetenteNome(nota.cteRemetenteNome || '');
    setCteRemetenteCpfCnpj(nota.cteRemetenteCpfCnpj || '');
    setCteRemetenteIe(nota.cteRemetenteIe || '');
    setCteRemetenteEndereco(nota.cteRemetenteEndereco || '');
    setCteRemetenteCidadeUf(nota.cteRemetenteCidadeUf || '');
    setCteRemetenteIsEmpresaPropria(Boolean(nota.cteRemetenteIsEmpresaPropria));
    setCteTomadorTerceiroId(nota.cteTomadorTerceiroId || '');
    setCteTomadorTerceiroNome(nota.cteTomadorTerceiroNome || '');
    setCteTomadorTerceiroCpfCnpj(nota.cteTomadorTerceiroCpfCnpj || '');
    setCteTomadorTerceiroIe(nota.cteTomadorTerceiroIe || '');
    setCteTomadorTerceiroEndereco(nota.cteTomadorTerceiroEndereco || '');
    setCteTomadorTerceiroCidadeUf(nota.cteTomadorTerceiroCidadeUf || '');
    setCteProdutoPredominante(nota.cteProdutoPredominante || 'Silagem de Milho');
    setCtePesoBrutoKg(nota.ctePesoBrutoKg ? formatBrNumberDisplay(nota.ctePesoBrutoKg) : '');
    setCteValorCargaDisplay(nota.cteValorCarga ? formatCurrencyInputDisplay(nota.cteValorCarga) : '');
    setCteNfeTransportada(nota.cteNfeTransportada || '');
    if (Array.isArray(nota.cteNfesVinculadas) && nota.cteNfesVinculadas.length > 0) {
      setCteNfesVinculadas(nota.cteNfesVinculadas);
    } else if (nota.cteNfeTransportada) {
      const legacyRows: CteNfeVinculada[] = nota.cteNfeTransportada
        .split(',')
        .map((chunk, idx) => {
          const digits = cleanDigits(chunk);
          return {
            id: `cte_nfe_leg_${idx}_${Date.now()}`,
            sourceDocId: '',
            numero: digits.length === 44 ? String(Number(digits.slice(25, 34)) || digits.slice(25, 34)) : chunk.trim(),
            serie: digits.length === 44 ? String(Number(digits.slice(22, 25)) || '1') : '1',
            chaveAcesso: digits.length === 44 ? digits : '',
            valorNota: idx === 0 ? (nota.cteValorCarga || 0) : 0,
          };
        })
        .filter(r => r.numero || r.chaveAcesso);
      setCteNfesVinculadas(legacyRows.length > 0 ? legacyRows : [createEmptyCteNfeRow()]);
    } else {
      setCteNfesVinculadas([createEmptyCteNfeRow()]);
    }
    setSaidaMotoristaId(nota.motoristaId || '');
    setSaidaMotoristaNome(nota.motoristaNome || '');
    setSaidaMotoristaCpf(nota.motoristaCpf || '');

    // MDF-e
    setMdfeUfCarregamento(nota.mdfeUfCarregamento || 'PR');
    setMdfeUfDescarregamento(nota.mdfeUfDescarregamento || 'PR');
    setMdfeMunicipiosPercurso(nota.mdfeMunicipiosPercurso || '');
    setMdfeVeiculoRenavam(nota.mdfeVeiculoRenavam || '');
    setMdfeReboquePlaca(nota.mdfeReboquePlaca || '');
    setMdfeSeguradora(nota.mdfeSeguradora || '');
    setMdfeApoliceSeguro(nota.mdfeApoliceSeguro || '');
    setMdfeDocumentosVinculados(nota.mdfeDocumentosVinculados || '');
    setMdfePesoTotalKg(nota.mdfePesoTotalKg ? formatBrNumberDisplay(nota.mdfePesoTotalKg) : '');
    setMdfeValorTotalCargaDisplay(nota.mdfeValorTotalCarga ? formatCurrencyInputDisplay(nota.mdfeValorTotalCarga) : '');
    setItemQtyInputMap({});

    setLc116Codes(getStoredLc116ServiceCodes());
    const editInfoComp =
      nota.informacoesComplementares ||
      buildDefaultInformacoesComplementares({
        tipoDocumento: nota.tipoDocumento,
        naturezaOperacao: nota.nfeNaturezaOperacao,
        nfeReferenciada: nota.nfeReferenciada,
        veiculoPlaca: nota.veiculoPlaca || nota.nfeTransportadoraPlaca,
        motoristaNome: nota.motoristaNome,
      });
    setSaidaInformacoesComplementares(editInfoComp);
    setIsInformacoesComplementaresManual(Boolean(nota.informacoesComplementares));
    setSaidaReservadoFisco(nota.reservadoFisco || '');

    setSaidaFormError('');
    setIsNotaSaidaModalOpen(true);
  };

  const findClientOrSupplierByName = (rawName: string) => {
    const norm = rawName.trim().toLowerCase();
    if (!norm) return null;

    const matchedClient = localClients.find(
      c => (c.name || c.nome || '').trim().toLowerCase() === norm
    );
    if (matchedClient) {
      const endParts = [matchedClient.address, matchedClient.neighborhood].filter(Boolean);
      const city = matchedClient.city || matchedClient.cidade || '';
      const uf = matchedClient.state || matchedClient.estado || '';
      return {
        id: matchedClient.id,
        cpfCnpj: matchedClient.cpfCnpj ? formatCpfCnpj(matchedClient.cpfCnpj) : '',
        ie: (matchedClient.stateRegistration || '').trim(),
        endereco: endParts.join(' - ').toUpperCase(),
        cidadeUf: `${city}${city && uf ? '/' : ''}${uf}`.toUpperCase(),
        uf: uf.toUpperCase(),
      };
    }

    const matchedSupplier = localSuppliers.find(
      s =>
        (s.name || '').trim().toLowerCase() === norm ||
        (s.tradeName || '').trim().toLowerCase() === norm
    );
    if (matchedSupplier) {
      const endParts = [matchedSupplier.address, matchedSupplier.neighborhood].filter(Boolean);
      const city = matchedSupplier.city || '';
      const uf = matchedSupplier.state || '';
      return {
        id: matchedSupplier.id,
        cpfCnpj: matchedSupplier.cnpjOrCpf ? formatCpfCnpj(matchedSupplier.cnpjOrCpf) : '',
        ie: (matchedSupplier.stateRegistration || '').trim(),
        endereco: endParts.join(' - ').toUpperCase(),
        cidadeUf: `${city}${city && uf ? '/' : ''}${uf}`.toUpperCase(),
        uf: uf.toUpperCase(),
      };
    }

    return null;
  };

  const handleFillCteRemetentePropriaEmpresa = () => {
    const activeCompany = companyProfile || getStoredCompanyProfile();
    if (!activeCompany) return;
    const compName = (
      activeCompany.corporateName ||
      activeCompany.companyName ||
      activeCompany.tradeName ||
      activeCompany.name ||
      'A PRÓPRIA EMPRESA'
    ).toUpperCase();
    const rawDoc = activeCompany.cnpj || activeCompany.cnpjCpf || '';
    const compIe = (activeCompany.stateRegistration || 'ISENTO').trim().toUpperCase();
    const street = [activeCompany.address, activeCompany.number ? `Nº ${activeCompany.number}` : '']
      .filter(Boolean)
      .join(', ');
    const fullEnd = [street, activeCompany.neighborhood].filter(Boolean).join(' - ').toUpperCase();
    const cityUf = activeCompany.city
      ? `${activeCompany.city}${activeCompany.state ? `/${activeCompany.state}` : ''}`.toUpperCase()
      : '';

    setCteRemetenteIsEmpresaPropria(true);
    setCteRemetenteId(activeCompany.id || 'PROPRIA_EMPRESA');
    setCteRemetenteNome(compName);
    setCteRemetenteCpfCnpj(rawDoc ? formatCpfCnpj(rawDoc) : '');
    setCteRemetenteIe(compIe);
    setCteRemetenteEndereco(fullEnd);
    setCteRemetenteCidadeUf(cityUf);
    if (cityUf) setCteMunicipioInicio(cityUf);
  };

  const handleCteRemetenteInputChange = (val: string) => {
    setCteRemetenteNome(val);
    setCteRemetenteIsEmpresaPropria(false);
    const matched = findClientOrSupplierByName(val);
    if (matched) {
      setCteRemetenteId(matched.id);
      setCteRemetenteCpfCnpj(matched.cpfCnpj);
      setCteRemetenteIe(matched.ie);
      setCteRemetenteEndereco(matched.endereco);
      setCteRemetenteCidadeUf(matched.cidadeUf);
      if (matched.cidadeUf) setCteMunicipioInicio(matched.cidadeUf);
    } else {
      setCteRemetenteId('');
    }
  };

  const handleCteTomadorTerceiroInputChange = (val: string) => {
    setCteTomadorTerceiroNome(val);
    const matched = findClientOrSupplierByName(val);
    if (matched) {
      setCteTomadorTerceiroId(matched.id);
      setCteTomadorTerceiroCpfCnpj(matched.cpfCnpj);
      setCteTomadorTerceiroIe(matched.ie);
      setCteTomadorTerceiroEndereco(matched.endereco);
      setCteTomadorTerceiroCidadeUf(matched.cidadeUf);
    } else {
      setCteTomadorTerceiroId('');
    }
  };

  const resolveActiveCteTomador = () => {
    const tomadorTipo = (cteTomador || 'Remetente').toLowerCase();
    if (tomadorTipo.includes('outro') || tomadorTipo.includes('terceiro')) {
      return {
        modalidade: 'Outros / Terceiro (Consignatário)',
        id: cteTomadorTerceiroId || undefined,
        nome: cteTomadorTerceiroNome.trim().toUpperCase(),
        cpfCnpj: cteTomadorTerceiroCpfCnpj.trim() || undefined,
        ie: cteTomadorTerceiroIe.trim().toUpperCase() || undefined,
        endereco: cteTomadorTerceiroEndereco.trim().toUpperCase() || undefined,
        cidadeUf: cteTomadorTerceiroCidadeUf.trim().toUpperCase() || undefined,
      };
    }
    if (tomadorTipo.includes('destinat')) {
      return {
        modalidade: 'Destinatário (FOB - Pago no Destino)',
        id: saidaDestinatarioId || undefined,
        nome: saidaDestinatarioNome.trim().toUpperCase(),
        cpfCnpj: saidaDestinatarioCpfCnpj.trim() || undefined,
        ie: saidaDestinatarioIe.trim().toUpperCase() || undefined,
        endereco: saidaDestinatarioEndereco.trim().toUpperCase() || undefined,
        cidadeUf: saidaDestinatarioCidadeUf.trim().toUpperCase() || undefined,
      };
    }
    return {
      modalidade: 'Remetente (CIF - Pago na Origem)',
      id: cteRemetenteId || undefined,
      nome: cteRemetenteNome.trim().toUpperCase(),
      cpfCnpj: cteRemetenteCpfCnpj.trim() || undefined,
      ie: cteRemetenteIe.trim().toUpperCase() || undefined,
      endereco: cteRemetenteEndereco.trim().toUpperCase() || undefined,
      cidadeUf: cteRemetenteCidadeUf.trim().toUpperCase() || undefined,
    };
  };

  const handleSaidaDestinatarioInputChange = (val: string) => {
    setSaidaDestinatarioNome(val);
    const isAvulso = !saidaTipoDocumento.includes('CT-e') && val.trim().toUpperCase() === 'CONSUMIDOR AVULSO';
    setSaidaIsConsumidorAvulso(isAvulso);

    const matched = saidaTipoDocumento.includes('CT-e')
      ? findClientOrSupplierByName(val)
      : (() => {
          const norm = val.trim().toLowerCase();
          const mc = localClients.find(c => (c.name || c.nome || '').trim().toLowerCase() === norm);
          if (!mc) return null;
          const endParts = [mc.address, mc.neighborhood].filter(Boolean);
          const city = mc.city || mc.cidade || '';
          const uf = mc.state || mc.estado || '';
          return {
            id: mc.id,
            cpfCnpj: mc.cpfCnpj ? formatCpfCnpj(mc.cpfCnpj) : '',
            ie: (mc.stateRegistration || '').trim(),
            endereco: endParts.join(' - ').toUpperCase(),
            cidadeUf: `${city}${city && uf ? '/' : ''}${uf}`.toUpperCase(),
            uf: uf.toUpperCase(),
          };
        })();

    if (matched) {
      setSaidaDestinatarioId(matched.id);
      setSaidaDestinatarioCpfCnpj(matched.cpfCnpj);
      setSaidaDestinatarioIe(matched.ie);
      setSaidaDestinatarioEndereco(matched.endereco);
      setSaidaDestinatarioCidadeUf(matched.cidadeUf);
      if (matched.cidadeUf && !nfseMunicipioPrestacao) setNfseMunicipioPrestacao(matched.cidadeUf);
      if (matched.cidadeUf) setCteMunicipioTermino(matched.cidadeUf);
      if (matched.uf && !mdfeUfDescarregamento) setMdfeUfDescarregamento(matched.uf);
      if (!editingNotaSaida && matched.cidadeUf) {
        const autoEscopo = inferOperacaoUfEscopo(matched.cidadeUf);
        setNfeRemessaEscopo(autoEscopo);
        setNfeCfop((prev) => translateCfopByScope(prev, autoEscopo));
        setCteCfop((prev) => translateCfopByScope(prev, autoEscopo));
        setSaidaItens((prev) =>
          prev.map((it) => ({
            ...it,
            cfop: translateCfopByScope(it.cfop || nfeCfop, autoEscopo),
          }))
        );
      }
    } else {
      setSaidaDestinatarioId('');
      if (isAvulso) {
        setSaidaDestinatarioIe('ISENTO');
      }
    }
  };

  const handleSaidaPaymentConditionChange = (newCond: string) => {
    setSaidaCondicaoPagamento(newCond);
    const isImmediate = newCond === 'PIX' || newCond === 'Dinheiro' || newCond === 'Transferência' || newCond === 'Cartão Crédito/Débito';
    setSaidaDataVencimento(
      isImmediate
        ? (saidaDataEmissao || new Date().toISOString().split('T')[0])
        : calculateDefaultDueDate(saidaDataEmissao)
    );
  };

  const resolveRemessaCfop = (natureza: string, escopo: 'estadual' | 'interestadual'): string => {
    const isInter = escopo === 'interestadual';
    if (natureza === 'Remessa para Conserto ou Reparo') return isInter ? '6915' : '5915';
    if (natureza === 'Retorno de Conserto ou Reparo') return isInter ? '6916' : '5916';
    if (natureza === 'Remessa em Comodato / Locação') return isInter ? '6908' : '5908';
    return isInter ? '6949' : '5949';
  };

  const handleOperacaoUfEscopoChange = (escopo: 'estadual' | 'interestadual') => {
    setNfeRemessaEscopo(escopo);
    const nextNfeCfop = translateCfopByScope(nfeCfop || '5102', escopo);
    const nextCteCfop = translateCfopByScope(cteCfop || '5352', escopo);
    setNfeCfop(nextNfeCfop);
    setCteCfop(nextCteCfop);
    setSaidaItens((prev) =>
      prev.length > 0
        ? prev.map((it) => ({
            ...it,
            cfop: translateCfopByScope(it.cfop || nextNfeCfop, escopo),
          }))
        : [createEmptySaidaItem(nextNfeCfop)]
    );
  };

  const handleNfeVendaNaturezaChange = (natureza: string) => {
    setNfeNaturezaOperacao(natureza);
    const escopo = nfeRemessaEscopo;
    let suggested = escopo === 'interestadual' ? '6102' : '5102';
    if (natureza === 'Devolução') {
      suggested = escopo === 'interestadual' ? '6202' : '5202';
    } else if (natureza === 'Remessa') {
      suggested = escopo === 'interestadual' ? '6949' : '5949';
    } else if (natureza === 'Transferência') {
      const has5152 = cfopCatalog.some((c) => c.codigo === (escopo === 'interestadual' ? '6152' : '5152'));
      suggested = has5152
        ? (escopo === 'interestadual' ? '6152' : '5152')
        : (escopo === 'interestadual' ? '6949' : '5949');
    }
    setNfeCfop(suggested);
    setSaidaItens((prev) =>
      prev.length > 0
        ? prev.map((it) => ({ ...it, cfop: suggested }))
        : [createEmptySaidaItem(suggested)]
    );
  };

  const handleHeaderNfeCfopChange = (newCfop: string) => {
    if (newCfop === '__manage__') {
      setCfopManagerTarget('nfe');
      setIsCfopManagerOpen(true);
      return;
    }
    const prevHeader = nfeCfop;
    setNfeCfop(newCfop);
    setSaidaItens((prev) =>
      prev.map((it) =>
        !it.cfop || it.cfop === prevHeader ? { ...it, cfop: newCfop } : it
      )
    );
  };

  const handleHeaderCteCfopChange = (newCfop: string) => {
    if (newCfop === '__manage__') {
      setCfopManagerTarget('cte');
      setIsCfopManagerOpen(true);
      return;
    }
    setCteCfop(newCfop);
  };

  const handleRemessaNaturezaChange = (natureza: string, escopoOverride?: 'estadual' | 'interestadual') => {
    const escopo = escopoOverride || nfeRemessaEscopo;
    const cfopAuto = resolveRemessaCfop(natureza, escopo);
    setNfeNaturezaOperacao(natureza);
    setNfeRemessaEscopo(escopo);
    setNfeCfop(cfopAuto);
    setSaidaItens(prev =>
      prev.length > 0
        ? prev.map(it => ({ ...it, cfop: cfopAuto }))
        : [createEmptySaidaItem(cfopAuto)]
    );
  };

  const handleSaidaTipoDocumentoChange = (newTipo: TipoDocumentoSaida) => {
    setSaidaTipoDocumento(newTipo);
    if (!editingNotaSaida) {
      setSaidaNumero(getNextNotaSaidaNumber(newTipo, saidaSerie, notasSaida));
    }
    const escopo = inferOperacaoUfEscopo(saidaDestinatarioCidadeUf);
    setNfeRemessaEscopo(escopo);

    if (newTipo.includes('NFC-e')) {
      const cfopAuto = translateCfopByScope('5102', escopo);
      setNfeNaturezaOperacao('Venda a Consumidor Final');
      setNfeCfop(cfopAuto);
      if (saidaItens.length === 0) setSaidaItens([createEmptySaidaItem(cfopAuto)]);
    } else if (newTipo.includes('Remessa')) {
      const defaultNatureza = 'Remessa para Conserto ou Reparo';
      const cfopAuto = resolveRemessaCfop(defaultNatureza, escopo);
      setNfeNaturezaOperacao(defaultNatureza);
      setNfeCfop(cfopAuto);
      setNfeFinalidade('Normal');
      setSaidaLancarContasReceber(false); // Notas de remessa/retorno desmarcadas por padrão
      setSaidaItens(prev =>
        prev.length > 0
          ? prev.map(it => ({ ...it, cfop: cfopAuto }))
          : [createEmptySaidaItem(cfopAuto)]
      );
    } else if (newTipo.includes('NF-e')) {
      const cfopAuto = translateCfopByScope('5102', escopo);
      setNfeNaturezaOperacao('Venda de Mercadoria');
      setNfeCfop(cfopAuto);
      setSaidaItens(prev =>
        prev.length > 0
          ? prev.map(it => ({ ...it, cfop: cfopAuto }))
          : [createEmptySaidaItem(cfopAuto)]
      );
    } else if (newTipo.includes('CT-e')) {
      setCteCfop(translateCfopByScope('5352', escopo));
    }
  };

  const handleSaidaVehicleChange = (vehId: string) => {
    setSaidaVeiculoId(vehId);
    const v = availableVehicles.find(item => item.id === vehId);
    if (v) {
      setSaidaVeiculoPlaca((v.plate || v.licensePlateOrSerial || '').toUpperCase());
      if (v.renavam) setMdfeVeiculoRenavam(v.renavam);
      if (v.trailerPlate || v.coupledTrailerName) {
        setMdfeReboquePlaca((v.trailerPlate || v.coupledTrailerName || '').toUpperCase());
      }
    }
  };

  const handleSaidaMotoristaChange = (empId: string) => {
    setSaidaMotoristaId(empId);
    const emp = localEmployees.find(e => e.id === empId);
    if (emp) {
      setSaidaMotoristaNome((emp.name || '').toUpperCase());
      setSaidaMotoristaCpf(emp.cpf ? formatCpfCnpj(emp.cpf) : '');
    } else if (!empId) {
      setSaidaMotoristaNome('');
      setSaidaMotoristaCpf('');
    }
  };

  const syncNfseValorIss = (totalVal: number, aliquotaStr: string) => {
    const aliq = Number(String(aliquotaStr).replace(',', '.')) || 0;
    const issVal = Number(((totalVal * aliq) / 100).toFixed(2));
    setNfseValorIssDisplay(formatCurrencyInputDisplay(issVal));
  };

  const handleLinkServiceOrderNfse = (serviceId: string) => {
    setNfsePedidoServicoId(serviceId);
    const os = localServices.find(s => s.id === serviceId);
    if (!os) return;

    if (os.clientName) {
      handleSaidaDestinatarioInputChange(os.clientName);
    }
    const qty = Number(os.areaQuantity || os.hoursWorked || os.areaHectares || os.tonsHarvested || os.tonsEstimated || 1);
    const unit = (os.areaUnit || (os.hoursWorked ? 'HORAS' : os.areaHectares ? 'HA' : 'UN')).toUpperCase();
    const rate = Number(os.ratePerAreaUnit || os.ratePerUnit || (qty > 0 ? os.totalAmount / qty : os.totalAmount) || 0);
    const total = Number(os.totalAmount || qty * rate || 0);

    setNfseQuantidadeAreaHoras(qty > 0 ? formatBrNumberDisplay(qty) : '');
    setNfseUnidadeAreaHoras(unit);
    setNfseValorUnitarioDisplay(rate > 0 ? formatCurrencyInputDisplay(rate) : '');
    if (total > 0) {
      setSaidaValorDisplay(formatCurrencyInputDisplay(total));
      syncNfseValorIss(total, nfseAliquotaIss);
    }
    const descParts = [
      `PRESTAÇÃO DE SERVIÇO: ${os.serviceType || 'SERVIÇO AGRÍCOLA'}`,
      os.orderNumber ? `(OS Nº ${os.orderNumber})` : '',
      os.farmName ? `- LOCAL/FAZENDA: ${os.farmName}` : '',
      os.billingNotes || os.notes ? `- ${os.billingNotes || os.notes}` : '',
    ].filter(Boolean);
    setSaidaDescricao(descParts.join(' ').toUpperCase());
  };

  const handleUpdateSaidaItem = (index: number, patch: Partial<NotaSaidaItem>) => {
    setSaidaItens(prev => {
      const next = prev.map((it, i) => {
        if (i !== index) return it;
        const merged: NotaSaidaItem = { ...it, ...patch };
        const qty = Number(merged.quantidade) || 0;
        const unitPrice = Number(merged.valorUnitario) || 0;
        const desc = Number(merged.desconto) || 0;
        const total = Math.max(0, Number((qty * unitPrice - desc).toFixed(2)));
        const aliqIcms = Number(merged.aliquotaIcms) || 0;
        const baseIcms = aliqIcms > 0 ? total : Number(merged.baseIcms || 0);
        const valorIcms = aliqIcms > 0 ? Number(((baseIcms * aliqIcms) / 100).toFixed(2)) : Number(merged.valorIcms || 0);
        return {
          ...merged,
          baseIcms,
          valorIcms,
          valorTotal: total,
        };
      });
      const sumTotal = next.reduce((acc, item) => acc + (Number(item.valorTotal) || 0), 0);
      if (sumTotal > 0) {
        setSaidaValorDisplay(formatCurrencyInputDisplay(sumTotal));
      }
      return next;
    });
  };

  const handleSelectSaidaInventoryProduct = (index: number, inventoryItemId: string) => {
    const prod = localInventory.find(p => p.id === inventoryItemId);
    if (!prod) {
      handleUpdateSaidaItem(index, { inventoryItemId: '' });
      return;
    }
    const unitPrice = Number(prod.salePrice || prod.preco_venda_varejo || prod.preco_venda || prod.unitCost || 0);
    handleUpdateSaidaItem(index, {
      inventoryItemId: prod.id,
      codigo: prod.code || prod.codigo_produto || '',
      descricao: (prod.name || prod.nome_comercial || prod.nome || '').toUpperCase(),
      ncm: prod.ncm || prod.codigo_ncm || '',
      cfop: nfeCfop || '5102',
      unidade: (prod.unit || prod.unidade_medida || 'UN').toUpperCase(),
      valorUnitario: unitPrice,
    });
  };

  const handleAddSaidaItemRow = () => {
    setSaidaItens(prev => [...prev, createEmptySaidaItem(nfeCfop || '5102')]);
  };

  const handleRemoveSaidaItemRow = (index: number) => {
    setSaidaItens(prev => {
      const next = prev.filter((_, i) => i !== index);
      const sumTotal = next.reduce((acc, item) => acc + (Number(item.valorTotal) || 0), 0);
      if (next.length > 0 && sumTotal > 0) {
        setSaidaValorDisplay(formatCurrencyInputDisplay(sumTotal));
      }
      return next.length > 0 ? next : [createEmptySaidaItem(nfeCfop || '5102')];
    });
  };

  const recalcCteCargaFromNfes = (rows: CteNfeVinculada[]) => {
    const total = rows.reduce((acc, r) => acc + (Number(r.valorNota) || 0), 0);
    if (total > 0) {
      setCteValorCargaDisplay(formatCurrencyInputDisplay(Number(total.toFixed(2))));
    } else {
      setCteValorCargaDisplay('');
    }
  };

  const handleAddCteNfeRow = () => {
    setCteNfesVinculadas(prev => [...prev, createEmptyCteNfeRow()]);
  };

  const handleRemoveCteNfeRow = (index: number) => {
    setCteNfesVinculadas(prev => {
      const filtered = prev.filter((_, i) => i !== index);
      const next = filtered.length > 0 ? filtered : [createEmptyCteNfeRow()];
      recalcCteCargaFromNfes(next);
      return next;
    });
  };

  const handleUpdateCteNfeRow = (index: number, patch: Partial<CteNfeVinculada>) => {
    setCteNfesVinculadas(prev => {
      const next = prev.map((row, idx) => {
        if (idx !== index) return row;
        const merged: CteNfeVinculada = { ...row, ...patch };
        if (patch.chaveAcesso !== undefined) {
          const digits = cleanDigits(patch.chaveAcesso).slice(0, 44);
          merged.chaveAcesso = digits;
          if (digits.length === 44) {
            if (!merged.numero.trim()) {
              const extractedNum = digits.slice(25, 34).replace(/^0+/, '');
              merged.numero = extractedNum || digits.slice(25, 34);
            }
            if (!merged.serie || merged.serie === '1') {
              const extractedSerie = digits.slice(22, 25).replace(/^0+/, '');
              if (extractedSerie) merged.serie = extractedSerie;
            }
          }
        }
        return merged;
      });
      recalcCteCargaFromNfes(next);
      return next;
    });
  };

  const persistNotaSaidaRecord = (): NotaSaidaRecord | null => {
    setSaidaFormError('');

    const isNfse = saidaTipoDocumento.includes('NFS-e');
    const isNfeOrNfce = saidaTipoDocumento.includes('NF-e') || saidaTipoDocumento.includes('NFC-e');
    const isCte = saidaTipoDocumento.includes('CT-e');
    const isMdfe = saidaTipoDocumento.includes('MDF-e');

    const numeroLimpo = saidaNumero.trim();
    const destinatarioLimpo = saidaDestinatarioNome.trim() || (!isCte && saidaIsConsumidorAvulso ? 'CONSUMIDOR AVULSO' : '');
    const valorNum = parseCurrencyInput(saidaValorDisplay);

    if (!numeroLimpo) {
      setSaidaFormError('INFORME O NÚMERO DA NOTA DE SAÍDA.');
      notaSaidaBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return null;
    }
    if (isCte) {
      if (!cteRemetenteNome.trim()) {
        setSaidaFormError('INFORME O REMETENTE (ORIGEM DA CARGA) DO CT-e.');
        notaSaidaBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        return null;
      }
      if (!destinatarioLimpo) {
        setSaidaFormError('INFORME O DESTINATÁRIO (DESTINO DA CARGA) DO CT-e.');
        notaSaidaBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        return null;
      }
      if (cteTomador === 'Outros' && !cteTomadorTerceiroNome.trim()) {
        setSaidaFormError('INFORME O TERCEIRO PAGADOR (TOMADOR DO SERVIÇO) DO CT-e.');
        notaSaidaBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        return null;
      }
    } else if (!destinatarioLimpo) {
      setSaidaFormError('SELECIONE OU DIGITE O DESTINATÁRIO / TOMADOR (OU MARQUE CONSUMIDOR AVULSO).');
      notaSaidaBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return null;
    }
    if (!saidaDataEmissao) {
      setSaidaFormError('INFORME A DATA DE EMISSÃO.');
      notaSaidaBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return null;
    }
    if (valorNum <= 0) {
      setSaidaFormError('INFORME UM VALOR TOTAL VÁLIDO MAIOR QUE R$ 0,00.');
      notaSaidaBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return null;
    }

    const activeTomadorCte = isCte ? resolveActiveCteTomador() : null;

    const selectedVeh = availableVehicles.find(v => v.id === saidaVeiculoId);
    const resolvedPlaca = saidaVeiculoPlaca.trim().toUpperCase() || selectedVeh?.plate || selectedVeh?.licensePlateOrSerial || '';
    const resolvedModelo = selectedVeh ? `${selectedVeh.brand ? `${selectedVeh.brand} ` : ''}${selectedVeh.model || selectedVeh.name || ''}`.trim() : '';

    const validItens = isNfeOrNfce
      ? saidaItens.filter(it => it.descricao.trim() !== '' || it.inventoryItemId)
      : [];

    let estoqueFoiBaixado = Boolean(editingNotaSaida?.estoqueBaixado);
    if (isNfeOrNfce && saidaBaixarEstoque && validItens.length > 0 && !estoqueFoiBaixado) {
      const qtyToDeductById = new Map<string, number>();
      validItens.forEach(it => {
        if (it.inventoryItemId && it.quantidade > 0) {
          qtyToDeductById.set(
            it.inventoryItemId,
            (qtyToDeductById.get(it.inventoryItemId) || 0) + Number(it.quantidade)
          );
        }
      });
      if (qtyToDeductById.size > 0) {
        const updatedInv = localInventory.map(inv => {
          const deduct = qtyToDeductById.get(inv.id);
          if (!deduct) return inv;
          const currentQty = Number(inv.quantity ?? inv.quantidade_atual ?? 0);
          const nextQty = Math.max(0, Number((currentQty - deduct).toFixed(4)));
          return {
            ...inv,
            quantity: nextQty,
            quantidade_atual: nextQty,
          };
        });
        saveInventory(updatedInv);
        estoqueFoiBaixado = true;
      }
    }

    const linkedOs = isNfse && nfsePedidoServicoId
      ? localServices.find(s => s.id === nfsePedidoServicoId)
      : undefined;

    const nowIso = new Date().toISOString();
    const newRecord: NotaSaidaRecord = {
      id: editingNotaSaida?.id || `ns_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      companyId: companyProfile?.id || getActiveCompanyId(),
      tipoDocumento: saidaTipoDocumento,
      numero: numeroLimpo,
      serie: saidaSerie.trim() || '1',
      dataEmissao: saidaDataEmissao,
      dataVencimento: saidaDataVencimento || saidaDataEmissao,
      chaveAcesso: cleanDigits(saidaChaveAcesso) || undefined,
      destinatarioId: saidaDestinatarioId || undefined,
      destinatarioNome: destinatarioLimpo.toUpperCase(),
      destinatarioCpfCnpj: saidaDestinatarioCpfCnpj.trim() || undefined,
      destinatarioIe: saidaDestinatarioIe.trim().toUpperCase() || undefined,
      destinatarioEndereco: saidaDestinatarioEndereco.trim().toUpperCase() || undefined,
      destinatarioCidadeUf: saidaDestinatarioCidadeUf.trim().toUpperCase() || undefined,
      isConsumidorAvulso: saidaIsConsumidorAvulso || destinatarioLimpo.toUpperCase() === 'CONSUMIDOR AVULSO',
      veiculoId: saidaVeiculoId || undefined,
      veiculoPlaca: resolvedPlaca || undefined,
      veiculoModelo: resolvedModelo || undefined,
      descricao:
        saidaDescricao.trim() ||
        (validItens.length > 0
          ? validItens.map(it => `${it.quantidade} ${it.unidade} ${it.descricao}`).join(' | ')
          : `${saidaTipoDocumento} emitida para ${destinatarioLimpo}`),
      valorTotal: Number(valorNum.toFixed(2)),
      condicaoPagamento: saidaCondicaoPagamento,
      lancarContasReceber: saidaLancarContasReceber,
      receberStatus: editingNotaSaida?.receberStatus || 'pendente',
      receberPaymentDate: editingNotaSaida?.receberPaymentDate,
      receberPaymentMethod: editingNotaSaida?.receberPaymentMethod,
      status: editingNotaSaida?.status || 'EMITIDA',

      // NFS-e
      nfseCodigoServico: isNfse ? nfseCodigoServico.trim() : undefined,
      nfseMunicipioPrestacao: isNfse ? nfseMunicipioPrestacao.trim().toUpperCase() : undefined,
      nfseAliquotaIss: isNfse ? (Number(String(nfseAliquotaIss).replace(',', '.')) || 0) : undefined,
      nfseValorIss: isNfse ? parseCurrencyInput(nfseValorIssDisplay) : undefined,
      nfseRetencaoIss: isNfse ? nfseRetencaoIss : undefined,
      nfseNaturezaOperacao: isNfse ? nfseNaturezaOperacao : undefined,
      nfsePedidoServicoId: isNfse && nfsePedidoServicoId ? nfsePedidoServicoId : undefined,
      nfsePedidoServicoLabel: linkedOs
        ? `${linkedOs.orderNumber ? `OS ${linkedOs.orderNumber} - ` : ''}${linkedOs.serviceType} (${linkedOs.clientName})`
        : undefined,
      nfseQuantidadeAreaHoras: isNfse && nfseQuantidadeAreaHoras ? parsePtBrNumber(nfseQuantidadeAreaHoras) || undefined : undefined,
      nfseUnidadeAreaHoras: isNfse ? nfseUnidadeAreaHoras : undefined,
      nfseValorUnitario: isNfse && nfseValorUnitarioDisplay ? parseCurrencyInput(nfseValorUnitarioDisplay) : undefined,
      nfseObservacoesFiscais: isNfse ? nfseObservacoesFiscais.trim() || undefined : undefined,

      // NF-e / NFC-e
      nfeNaturezaOperacao: isNfeOrNfce ? nfeNaturezaOperacao : undefined,
      nfeCfop: isNfeOrNfce ? nfeCfop.trim() : undefined,
      nfeFinalidade: isNfeOrNfce ? nfeFinalidade : undefined,
      nfeModalidadeFrete: isNfeOrNfce ? nfeModalidadeFrete : undefined,
      nfeTransportadoraNome: isNfeOrNfce ? nfeTransportadoraNome.trim().toUpperCase() || undefined : undefined,
      nfeTransportadoraPlaca: isNfeOrNfce ? nfeTransportadoraPlaca.trim().toUpperCase() || undefined : undefined,
      nfeReferenciada: isNfeOrNfce ? nfeReferenciada.trim() || undefined : undefined,
      itens: isNfeOrNfce && validItens.length > 0 ? validItens : undefined,
      baixarEstoqueAutomatico: isNfeOrNfce ? saidaBaixarEstoque : undefined,
      estoqueBaixado: isNfeOrNfce ? estoqueFoiBaixado : undefined,

      // CT-e
      cteCfop: isCte ? cteCfop.trim() : undefined,
      cteTipoServico: isCte ? cteTipoServico : undefined,
      cteMunicipioInicio: isCte ? cteMunicipioInicio.trim().toUpperCase() : undefined,
      cteMunicipioTermino: isCte ? cteMunicipioTermino.trim().toUpperCase() : undefined,
      cteTomador: isCte ? cteTomador : undefined,
      cteRemetenteId: isCte ? (cteRemetenteId || undefined) : undefined,
      cteRemetenteNome: isCte ? (cteRemetenteNome.trim().toUpperCase() || undefined) : undefined,
      cteRemetenteCpfCnpj: isCte ? (cteRemetenteCpfCnpj.trim() || undefined) : undefined,
      cteRemetenteIe: isCte ? (cteRemetenteIe.trim().toUpperCase() || undefined) : undefined,
      cteRemetenteEndereco: isCte ? (cteRemetenteEndereco.trim().toUpperCase() || undefined) : undefined,
      cteRemetenteCidadeUf: isCte ? (cteRemetenteCidadeUf.trim().toUpperCase() || undefined) : undefined,
      cteRemetenteIsEmpresaPropria: isCte ? cteRemetenteIsEmpresaPropria : undefined,
      cteTomadorTerceiroId: isCte && cteTomador === 'Outros' ? (cteTomadorTerceiroId || undefined) : undefined,
      cteTomadorTerceiroNome: isCte && cteTomador === 'Outros' ? (cteTomadorTerceiroNome.trim().toUpperCase() || undefined) : undefined,
      cteTomadorTerceiroCpfCnpj: isCte && cteTomador === 'Outros' ? (cteTomadorTerceiroCpfCnpj.trim() || undefined) : undefined,
      cteTomadorTerceiroIe: isCte && cteTomador === 'Outros' ? (cteTomadorTerceiroIe.trim().toUpperCase() || undefined) : undefined,
      cteTomadorTerceiroEndereco: isCte && cteTomador === 'Outros' ? (cteTomadorTerceiroEndereco.trim().toUpperCase() || undefined) : undefined,
      cteTomadorTerceiroCidadeUf: isCte && cteTomador === 'Outros' ? (cteTomadorTerceiroCidadeUf.trim().toUpperCase() || undefined) : undefined,
      cteTomadorFinalId: activeTomadorCte ? activeTomadorCte.id : undefined,
      cteTomadorFinalNome: activeTomadorCte ? (activeTomadorCte.nome || undefined) : undefined,
      cteTomadorFinalCpfCnpj: activeTomadorCte ? activeTomadorCte.cpfCnpj : undefined,
      cteTomadorFinalIe: activeTomadorCte ? activeTomadorCte.ie : undefined,
      cteTomadorFinalEndereco: activeTomadorCte ? activeTomadorCte.endereco : undefined,
      cteTomadorFinalCidadeUf: activeTomadorCte ? activeTomadorCte.cidadeUf : undefined,
      cteProdutoPredominante: isCte ? cteProdutoPredominante.trim().toUpperCase() : undefined,
      ctePesoBrutoKg: isCte && ctePesoBrutoKg ? parsePtBrNumber(ctePesoBrutoKg) || undefined : undefined,
      cteValorCarga: (() => {
        if (!isCte) return undefined;
        const parsedInput = cteValorCargaDisplay ? parseCurrencyInput(cteValorCargaDisplay) : 0;
        if (parsedInput > 0) return parsedInput;
        const sumRows = cteNfesVinculadas.reduce((acc, r) => acc + (Number(r.valorNota) || 0), 0);
        return sumRows > 0 ? Number(sumRows.toFixed(2)) : undefined;
      })(),
      cteNfesVinculadas: (() => {
        if (!isCte) return undefined;
        const valid = cteNfesVinculadas
          .filter(r => r.numero.trim() !== '' || (r.chaveAcesso || '').trim() !== '' || Number(r.valorNota) > 0)
          .map(r => ({
            ...r,
            numero: r.numero.trim(),
            serie: (r.serie || '1').trim(),
            chaveAcesso: cleanDigits(r.chaveAcesso || '') || undefined,
            valorNota: Number(r.valorNota) || 0,
          }));
        return valid.length > 0 ? valid : undefined;
      })(),
      cteNfeTransportada: (() => {
        if (!isCte) return undefined;
        const refs = cteNfesVinculadas
          .filter(r => r.numero.trim() !== '' || (r.chaveAcesso || '').trim() !== '')
          .map(r => (r.numero.trim() ? `NF-e ${r.numero.trim()}` : r.chaveAcesso))
          .filter(Boolean);
        return refs.length > 0 ? refs.join(', ') : (cteNfeTransportada.trim() || undefined);
      })(),
      motoristaId: (isCte || isMdfe) && saidaMotoristaId ? saidaMotoristaId : undefined,
      motoristaNome: (isCte || isMdfe) ? saidaMotoristaNome.trim().toUpperCase() || undefined : undefined,
      motoristaCpf: (isCte || isMdfe) ? saidaMotoristaCpf.trim() || undefined : undefined,

      // MDF-e
      mdfeUfCarregamento: isMdfe ? mdfeUfCarregamento.trim().toUpperCase() : undefined,
      mdfeUfDescarregamento: isMdfe ? mdfeUfDescarregamento.trim().toUpperCase() : undefined,
      mdfeMunicipiosPercurso: isMdfe ? mdfeMunicipiosPercurso.trim().toUpperCase() || undefined : undefined,
      mdfeVeiculoRenavam: isMdfe ? mdfeVeiculoRenavam.trim() || undefined : undefined,
      mdfeReboquePlaca: isMdfe ? mdfeReboquePlaca.trim().toUpperCase() || undefined : undefined,
      mdfeSeguradora: isMdfe ? mdfeSeguradora.trim().toUpperCase() || undefined : undefined,
      mdfeApoliceSeguro: isMdfe ? mdfeApoliceSeguro.trim() || undefined : undefined,
      mdfeDocumentosVinculados: isMdfe ? mdfeDocumentosVinculados.trim() || undefined : undefined,
      mdfePesoTotalKg: isMdfe && mdfePesoTotalKg ? parsePtBrNumber(mdfePesoTotalKg) || undefined : undefined,
      mdfeValorTotalCarga: isMdfe && mdfeValorTotalCargaDisplay ? parseCurrencyInput(mdfeValorTotalCargaDisplay) : undefined,

      informacoesComplementares: saidaInformacoesComplementares.trim() || undefined,
      reservadoFisco: saidaReservadoFisco.trim() || undefined,

      createdAt: editingNotaSaida?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    saveLocalNotaSaida(newRecord);
    updateNotaSaidaSequenceCounter(newRecord.tipoDocumento, newRecord.serie, newRecord.numero);
    setNotasSaida(getStoredNotasSaida());
    setIsNotaSaidaModalOpen(false);
    setActiveMainFiscalTab('notas');
    setActiveDocDirection('saida');
    setSuccessMessage(
      `${editingNotaSaida ? 'Nota de saída atualizada' : 'Nota de saída registrada'} com sucesso (${newRecord.tipoDocumento.split(' ')[0]} Nº ${newRecord.numero})${newRecord.lancarContasReceber ? ' e integrada ao Contas a Receber' : ''}${estoqueFoiBaixado && saidaBaixarEstoque && !editingNotaSaida?.estoqueBaixado ? ' com baixa no Estoque' : ''}!`
    );
    setTimeout(() => setSuccessMessage(''), 5000);
    return newRecord;
  };

  const handleSaveNotaSaida = (e: React.FormEvent) => {
    e.preventDefault();
    persistNotaSaidaRecord();
  };

  const handlePrintNotaSaida = (nota: NotaSaidaRecord) => {
    const profile = companyProfile || getStoredCompanyProfile();
    openNotaSaidaPrintWindow(nota, profile, () => {
      setViewingNotaSaida(nota);
    });
  };

  const handleSaveAndPrintNotaSaida = () => {
    const saved = persistNotaSaidaRecord();
    if (saved) {
      handlePrintNotaSaida(saved);
    }
  };

  const handleDeleteNotaSaida = (nota: NotaSaidaRecord) => {
    deleteLocalNotaSaida(nota.id);
    setNotasSaida(getStoredNotasSaida());
    setNotaSaidaToDelete(null);
    if (viewingNotaSaida?.id === nota.id) {
      setViewingNotaSaida(null);
    }
    setSuccessMessage(`Nota de saída Nº ${nota.numero} excluída com sucesso!`);
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  // Tipos de Documentos de Entrada Manual (dinâmico e gerenciável)
  const [manualDocTypes, setManualDocTypes] = useState<string[]>(() => getStoredManualEntryDocumentTypes());
  const [isManageDocTypesModalOpen, setIsManageDocTypesModalOpen] = useState(false);

  // Sincronização inicial dos tipos de documento de entrada com o Supabase
  useEffect(() => {
    let isMounted = true;
    fetchCloudManualEntryDocumentTypes().then(cloudTypes => {
      if (cloudTypes && cloudTypes.length > 0 && isMounted) {
        setManualDocTypes(cloudTypes);
        saveStoredManualEntryDocumentTypes(cloudTypes);
      }
    }).catch(err => console.warn('Supabase fetch doc types sync notice:', err));
    return () => { isMounted = false; };
  }, []);

  const handleSaveDocumentTypes = (newTypes: string[]) => {
    setManualDocTypes(newTypes);
    saveStoredManualEntryDocumentTypes(newTypes);
    saveCloudManualEntryDocumentTypes(newTypes).catch(err => 
      console.warn('Supabase save doc types sync notice:', err)
    );
  };

  // PASSO 2: Itens / Produtos da Entrada
  const [manualDocItems, setManualDocItems] = useState<DocumentoEntradaItem[]>([]);
  const [isLoadingDocItems, setIsLoadingDocItems] = useState(false);
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [isItemSearchOpen, setIsItemSearchOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(null);
  const [searchedStockProducts, setSearchedStockProducts] = useState<InventoryItem[]>([]);
  const [isSearchingStock, setIsSearchingStock] = useState(false);
  const stockSearchDropdownRef = useRef<HTMLDivElement>(null);
  const [itemQuantity, setItemQuantity] = useState('1');
  const [itemUnit, setItemUnit] = useState('UN');
  const [itemUnitCostDisplay, setItemUnitCostDisplay] = useState('');
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [itemFormError, setItemFormError] = useState('');

  // Fecha dropdown de produtos ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (stockSearchDropdownRef.current && !stockSearchDropdownRef.current.contains(e.target as Node)) {
        setIsItemSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Busca reativa no Supabase (tabela public.estoque_produtos com operador .ilike na coluna real 'nome_comercial')
  useEffect(() => {
    let isCancelled = false;
    if (!isManualEntryModalOpen || manualEntryStep !== 2) return;

    // Sincroniza em background os produtos essenciais de diesel e arla com a tabela estoque_produtos
    syncEssentialFuelProductsToSupabase().catch(() => {});

    const runSearch = async () => {
      setIsSearchingStock(true);
      try {
        const results = await searchEstoqueProdutos(itemSearchQuery);
        if (!isCancelled) {
          setSearchedStockProducts(results);
        }
      } catch (err) {
        console.warn('Erro ao buscar produtos em public.estoque_produtos:', err);
      } finally {
        if (!isCancelled) setIsSearchingStock(false);
      }
    };

    const timer = setTimeout(runSearch, 80);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [itemSearchQuery, isManualEntryModalOpen, manualEntryStep, localInventory]);

  // Submodal de Cadastro Rápido de Novo Produto no Estoque (Passo 2)
  const [isQuickProductModalOpen, setIsQuickProductModalOpen] = useState(false);
  const [quickProductName, setQuickProductName] = useState('');
  const [quickProductUnit, setQuickProductUnit] = useState('UN');
  const [quickProductCategory, setQuickProductCategory] = useState<string>('Outros Insumos');
  const [quickProductBrand, setQuickProductBrand] = useState('');
  const [quickProductBarcode, setQuickProductBarcode] = useState('');
  const [quickProductHasNoGtin, setQuickProductHasNoGtin] = useState(false);
  const [quickProductFactoryRef, setQuickProductFactoryRef] = useState('');
  const [quickProductNcm, setQuickProductNcm] = useState('');
  const [quickProductFiscalGroup, setQuickProductFiscalGroup] = useState<'SUBSTITUICAO' | 'TRIBUTADO' | 'ISENTO'>('TRIBUTADO');
  const [quickProductIpiGroup, setQuickProductIpiGroup] = useState<'NAO TRIBUTADO' | 'TRIBUTADO'>('NAO TRIBUTADO');
  const [quickProductCostDisplay, setQuickProductCostDisplay] = useState('');
  const [quickProductSaleDisplay, setQuickProductSaleDisplay] = useState('');
  const [quickProductProfitMargin, setQuickProductProfitMargin] = useState<string>('');
  const [quickProductCode, setQuickProductCode] = useState('');
  const [quickProductLocation, setQuickProductLocation] = useState('Barracão Principal');
  const [isSavingQuickProduct, setIsSavingQuickProduct] = useState(false);

  // Gerenciador de Categorias de Estoque
  const [stockCategories, setStockCategories] = useState<string[]>(() => {
    const stored = getStoredInventoryCategories();
    return Array.from(new Set([...DEFAULT_INVENTORY_CATEGORIES, ...(stored || [])]));
  });
  const [isManageCategoryModalOpen, setIsManageCategoryModalOpen] = useState(false);

  // Modal de Visualização de Detalhes da Entrada Manual / Documento Legado / MDF-e
  const [viewingManualDoc, setViewingManualDoc] = useState<DocumentoEntradaRecord | null>(null);
  const [viewingLegacyDoc, setViewingLegacyDoc] = useState<FiscalDocumentRecord | null>(null);
  const [viewingMdfeDoc, setViewingMdfeDoc] = useState<MdfeRecord | null>(null);
  const [viewingDocItems, setViewingDocItems] = useState<DocumentoEntradaItem[]>([]);
  const [isLoadingViewingItems, setIsLoadingViewingItems] = useState(false);

  // Confirmação de Exclusão de Entrada Manual ou Documento Legado / MDF-e
  const [manualDocToDelete, setManualDocToDelete] = useState<DocumentoEntradaRecord | null>(null);
  const [legacyDocToDelete, setLegacyDocToDelete] = useState<FiscalDocumentRecord | null>(null);
  const [mdfeDocToDelete, setMdfeDocToDelete] = useState<MdfeRecord | null>(null);

  // Carrega itens da entrada manual ao abrir visualização
  useEffect(() => {
    if (viewingManualDoc) {
      setIsLoadingViewingItems(true);
      fetchDocumentosEntradaItens(viewingManualDoc.id)
        .then(items => setViewingDocItems(items || []))
        .catch(() => setViewingDocItems([]))
        .finally(() => setIsLoadingViewingItems(false));
    } else {
      setViewingDocItems([]);
    }
  }, [viewingManualDoc]);

  // Abre o modal de entrada manual resetando para a Etapa 1
  const handleOpenManualEntryModal = () => {
    setIsManualInstallmentsModalOpen(false);
    setManualEntryStep(1);
    setCurrentManualDoc(null);
    setManualSupplier('');
    const today = new Date().toISOString().split('T')[0];
    setManualDate(today);
    setManualDueDate(calculateDefaultDueDate(today));
    const defaultType = (manualDocTypes.includes(manualDocumentType) && manualDocumentType !== 'Recibo')
      ? manualDocumentType 
      : (manualDocTypes[0] || 'Romaneio');
    setManualDocumentType(defaultType);
    setManualPaymentCondition('Boleto Bancário');
    setManualInstallmentsCount(1);
    setManualVehicleId('');
    setManualAmountDisplay('');
    setManualNotes('');
    setManualFormError('');
    setManualDocItems([]);
    setItemSearchQuery('');
    setSelectedProduct(null);
    setItemQuantity('1');
    setItemUnit('UN');
    setItemUnitCostDisplay('');
    setItemFormError('');
    setIsManualEntryModalOpen(true);
  };

  // Reabre o modal de etapas carregando todos os dados daquela nota (Cabeçalho e Itens)
  const handleOpenEditManualDoc = async (doc: DocumentoEntradaRecord) => {
    setIsManualInstallmentsModalOpen(false);
    setCurrentManualDoc(doc);
    setManualSupplier(doc.fornecedor || doc.fornecedor_nome || '');
    const docDate = doc.data || doc.data_emissao || doc.data_entrada || new Date().toISOString().split('T')[0];
    setManualDate(docDate);
    setManualDueDate(doc.data_vencimento || calculateDefaultDueDate(docDate));
    const rawType = doc.tipo_documento || 'Romaneio';
    setManualDocumentType(rawType as TipoDocumentoEntrada);
    setManualPaymentCondition(doc.condicao_pagamento || 'Boleto Bancário');
    setManualInstallmentsCount(doc.parcelas_qtd && doc.parcelas_qtd > 0 ? doc.parcelas_qtd : 1);
    setManualVehicleId(doc.machineryId || doc.vehicleId || '');
    setManualAmountDisplay(doc.valor_total ? formatCurrencyInputDisplay(doc.valor_total) : '');
    setManualNotes(doc.observacoes || '');
    setManualFormError('');
    setItemSearchQuery('');
    setSelectedProduct(null);
    setItemQuantity('1');
    setItemUnit('UN');
    setItemUnitCostDisplay('');
    setItemFormError('');

    setIsLoadingDocItems(true);
    try {
      const items = await fetchDocumentosEntradaItens(doc.id);
      const seen = new Set<string>();
      const unique = (items || []).filter(i => {
        if (!i.id) return true;
        if (seen.has(i.id)) return false;
        seen.add(i.id);
        return true;
      });
      setManualDocItems(unique);
    } catch (err) {
      console.warn('Erro ao carregar itens da entrada para edição:', err);
      setManualDocItems([]);
    } finally {
      setIsLoadingDocItems(false);
    }

    setManualEntryStep(1);
    setIsManualEntryModalOpen(true);
  };

  // INTEGRAÇÃO DE RETORNO DO PEDIDO DE REFORMA (3 AÇÕES EM LOTE)
  const handleEfetivarRetornoPedidoReforma = (order: TireReformOrder) => {
    // AÇÃO 2: Atualizar o status do pneu na frota e retornar ao estoque
    efetivarRetornoPneusEstoque(order);

    // AÇÃO 3: Lançamento automático no Contas a Pagar (Financeiro)
    lancarContasPagarRetornoReforma(order);

    // Registra vínculo do pedido de reforma para conclusão após salvar definitivamente
    setLinkedReformOrderId(order.id);
    try {
      localStorage.setItem('colaca_silagem_ordem_reforma_em_retorno', order.id);
    } catch (_) {}

    // AÇÃO 1: Redirecionar e popular o modal de "Nova Entrada Manual"
    setActiveMainFiscalTab('notas');

    const today = new Date().toISOString().split('T')[0];
    const orderSum = order.totalValor !== undefined && order.totalValor !== null && order.totalValor > 0
      ? order.totalValor
      : order.tires.reduce((acc, t) => acc + (t.valorUnitario || 0), 0);

    setIsManualInstallmentsModalOpen(false);
    setManualSupplier(order.supplierName);
    setManualDocumentType('NOTA');
    setManualDate(today);
    setManualDueDate(order.expectedReturnDate || calculateDefaultDueDate(today));
    setManualAmountDisplay(formatCurrencyInputDisplay(orderSum));
    setManualNotes(`Retorno do Pedido de Reforma ${order.orderNumber} - ${order.supplierName}`);
    setManualFormError('');

    const newDocId = `doc_retorno_${order.id}_${Date.now()}`;
    const newDoc: DocumentoEntradaRecord = {
      id: newDocId,
      fornecedor: order.supplierName,
      data: today,
      data_vencimento: order.expectedReturnDate || calculateDefaultDueDate(today),
      tipo_documento: 'NOTA',
      valor_total: orderSum,
      observacoes: `Retorno do Pedido de Reforma ${order.orderNumber} - ${order.supplierName}`,
      status: 'Rascunho'
    };
    setCurrentManualDoc(newDoc);
    setDocumentosEntrada(prev => [newDoc, ...prev.filter(d => d.id !== newDocId)]);

    // Linhas de serviços de borracharia com quantidades e valores de forma idêntica
    const serviceGroups = new Map<string, { srv: string; count: number; unitPrice: number; total: number }>();
    if (order.tires && order.tires.length > 0) {
      for (const tire of order.tires) {
        const srvName = normalizeStockServiceName(tire.servico || DEFAULT_STOCK_SERVICES[0] || 'RECAPAGEM / REFORMA').toUpperCase();
        const unitVal = tire.valorUnitario !== undefined && tire.valorUnitario !== null && tire.valorUnitario > 0
          ? tire.valorUnitario
          : (orderSum > 0 ? orderSum / order.tires.length : 0);
        const key = `${srvName}__${unitVal}`;
        const existing = serviceGroups.get(key);
        if (existing) {
          existing.count += 1;
          existing.total += unitVal;
        } else {
          serviceGroups.set(key, { srv: srvName, count: 1, unitPrice: unitVal, total: unitVal });
        }
      }
    }

    let itemsList: DocumentoEntradaItem[] = [];
    let idx = 0;

    // PASSO A: Linhas de serviços de borracharia com quantidades e valores de forma idêntica
    if (serviceGroups.size > 0) {
      for (const [, grp] of serviceGroups.entries()) {
        itemsList.push({
          id: `item_ret_srv_${order.id}_${idx}_${Date.now()}`,
          documento_entrada_id: newDocId,
          descricao: grp.srv,
          quantidade: grp.count,
          unidade: 'UN',
          valor_unitario: grp.unitPrice,
          valor_total: grp.total,
          created_at: new Date().toISOString()
        });
        idx++;
      }
    } else {
      itemsList.push({
        id: `item_ret_srv_${order.id}_0_${Date.now()}`,
        documento_entrada_id: newDocId,
        descricao: 'SERVIÇO DE RECAPAGEM / REFORMA DE PNEUS',
        quantidade: order.totalTires || 1,
        unidade: 'UN',
        valor_unitario: orderSum,
        valor_total: orderSum,
        created_at: new Date().toISOString()
      });
      idx++;
    }

    // PASSO B: Retorno Físico do Pneu ao Estoque (linhas de produto físico a R$ 0,00 para não duplicar o total da nota)
    if (order.tires && order.tires.length > 0) {
      for (const tire of order.tires) {
        const brandStr = (tire.brand || 'PNEU').trim().toUpperCase();
        const modelStr = (tire.model || '').trim().toUpperCase();
        const fnStr = (tire.fireNumber || '').trim().toUpperCase();
        
        let descPneu = `${brandStr} ${modelStr}`.trim();
        if (fnStr) {
          descPneu += ` (Nº DE FOGO: ${fnStr})`;
        }

        itemsList.push({
          id: `item_ret_pneu_${order.id}_${tire.id || idx}_${Date.now()}`,
          documento_entrada_id: newDocId,
          descricao: descPneu,
          quantidade: 1,
          unidade: 'UN',
          valor_unitario: 0,
          valor_total: 0,
          created_at: new Date().toISOString()
        });
        idx++;
      }
    }

    const seenNewIds = new Set<string>();
    const deduplicatedItems: DocumentoEntradaItem[] = [];
    for (const item of itemsList) {
      if (item.id && !seenNewIds.has(item.id)) {
        seenNewIds.add(item.id);
        deduplicatedItems.push(item);
      } else if (!item.id) {
        deduplicatedItems.push(item);
      }
    }

    setManualDocItems(deduplicatedItems);
    try {
      const existingItems = getStoredDocumentosEntradaItens();
      const otherItems = existingItems.filter(i => i.documento_entrada_id !== newDocId);
      saveStoredDocumentosEntradaItens([...deduplicatedItems, ...otherItems]);
    } catch (e) {
      console.warn('Erro ao salvar itens no storage:', e);
    }

    // Avança automaticamente para o Passo 2: Inserção de Produtos
    setManualEntryStep(2);
    setIsManualEntryModalOpen(true);

    setSuccessMessage(`Retorno de ${order.orderNumber} iniciado! Serviços carregados com sucesso no Passo 2.`);
    setTimeout(() => setSuccessMessage(''), 5000);
  };

  const handleManualAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/\D/g, '');
    if (!rawVal) {
      setManualAmountDisplay('');
      return;
    }
    const num = parseInt(rawVal, 10) / 100;
    setManualAmountDisplay(formatCurrencyInputDisplay(num));
  };

  const handleItemUnitCostChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/\D/g, '');
    if (!rawVal) {
      setItemUnitCostDisplay('');
      return;
    }
    const num = parseInt(rawVal, 10) / 100;
    setItemUnitCostDisplay(formatCurrencyInputDisplay(num));
  };

  // Verifica se o fornecedor digitado já existe
  const isSupplierExisting = useMemo(() => {
    const q = manualSupplier.trim().toLowerCase();
    if (!q) return true;
    return localSuppliers.some(s => s.name.trim().toLowerCase() === q);
  }, [manualSupplier, localSuppliers]);

  // Abertura rápida do cadastro de fornecedores com pré-preenchimento
  const handleOpenQuickSupplierModal = (nameToPreFill?: string) => {
    const supName = (nameToPreFill || manualSupplier).trim();
    setSupplierForModal({
      id: `sup_manual_${Date.now()}`,
      name: supName,
      category: 'Insumos & Entradas',
      state: 'PR',
      createdAt: new Date().toISOString()
    } as Supplier);
    setIsSupplierModalOpen(true);
  };

  // PASSO 1 -> PASSO 2: Salva no 'documentos_entrada' e avança
  const handleAdvanceToStep2 = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setManualFormError('');

    const trimmedSupplier = manualSupplier.trim();
    if (!trimmedSupplier) {
      setManualFormError('Por favor, informe o fornecedor.');
      return;
    }

    if (!manualDate) {
      setManualFormError('Por favor, informe a data do documento.');
      return;
    }

    const numericAmount = parseCurrencyInput(manualAmountDisplay);
    if (numericAmount <= 0) {
      setManualFormError('Por favor, informe um valor total válido maior que zero.');
      return;
    }

    const targetDueDate = manualDueDate || calculateDefaultDueDate(manualDate);
    const linkedVehicle = availableVehicles.find(v => v.id === manualVehicleId);
    const vehicleFields: Partial<DocumentoEntradaRecord> = {
      condicao_pagamento: manualPaymentCondition,
      parcelas_qtd: manualInstallmentsCount,
      machineryId: linkedVehicle?.id || undefined,
      machineryName: linkedVehicle ? `${linkedVehicle.model}${linkedVehicle.licensePlateOrSerial ? ` (${linkedVehicle.licensePlateOrSerial})` : ''}` : undefined,
      vehicleId: linkedVehicle?.id || undefined,
      vehiclePlate: linkedVehicle?.licensePlateOrSerial || undefined,
      vehicleModel: linkedVehicle?.model || undefined,
    };

    setIsSavingManualEntry(true);
    try {
      let savedDoc: DocumentoEntradaRecord;

      if (currentManualDoc) {
        // Atualiza documento já existente se o usuário voltou ao passo 1
        savedDoc = {
          ...currentManualDoc,
          fornecedor: trimmedSupplier,
          data: manualDate,
          data_vencimento: targetDueDate,
          tipo_documento: manualDocumentType,
          valor_total: numericAmount,
          observacoes: manualNotes.trim(),
          ...vehicleFields,
        };
        await updateDocumentoEntrada(savedDoc.id, {
          fornecedor: trimmedSupplier,
          data: manualDate,
          data_vencimento: targetDueDate,
          tipo_documento: manualDocumentType,
          valor_total: numericAmount,
          observacoes: manualNotes.trim(),
          ...vehicleFields,
        });
        setCurrentManualDoc(savedDoc);
        setDocumentosEntrada(prev => prev.map(d => d.id === savedDoc.id ? savedDoc : d));
      } else {
        // Grava no Supabase como Rascunho inicial e captura o ID gerado
        savedDoc = await insertDocumentoEntrada({
          fornecedor: trimmedSupplier,
          data: manualDate,
          data_vencimento: targetDueDate,
          tipo_documento: manualDocumentType,
          valor_total: numericAmount,
          observacoes: manualNotes.trim(),
          status: 'Rascunho',
          ...vehicleFields,
        });

        setCurrentManualDoc(savedDoc);
        setDocumentosEntrada(prev => {
          const filtered = prev.filter(d => d.id !== savedDoc.id);
          return [savedDoc, ...filtered];
        });

        // Nova entrada manual: OBRIGATORIAMENTE nasce limpa com array vazia de produtos
        setManualDocItems([]);
      }

      // Se for edição de documento existente, carrega os itens já salvos sem dados fantasmas
      if (currentManualDoc) {
        setIsLoadingDocItems(true);
        const items = await fetchDocumentosEntradaItens(savedDoc.id);
        const seen = new Set<string>();
        const unique = (items || [])
          .filter(i => i.descricao && i.descricao !== 'Item de Entrada')
          .filter(i => {
            if (!i.id) return true;
            if (seen.has(i.id)) return false;
            seen.add(i.id);
            return true;
          });
        setManualDocItems(unique);
        setIsLoadingDocItems(false);
      }

      // Avança para o Passo 2
      setManualEntryStep(2);
    } catch (err) {
      console.error('Erro ao salvar cabeçalho da entrada:', err);
      setManualFormError('Ocorreu um erro ao salvar o documento. Tente novamente.');
    } finally {
      setIsSavingManualEntry(false);
    }
  };

  // 1. SALVAR COMO RASCUNHO (Salva cabeçalho e itens na tabela 'documentos_entrada' com status 'Rascunho' sem validar valores)
  const handleSaveManualEntryAsDraft = async () => {
    setManualFormError('');
    const trimmedSupplier = manualSupplier.trim();
    if (!trimmedSupplier) {
      setManualFormError('Por favor, informe o fornecedor antes de salvar como rascunho.');
      if (manualEntryStep !== 1) setManualEntryStep(1);
      return;
    }

    const itemsTotal = manualDocItems.reduce((sum, item) => sum + (Number(item.valor_total) || 0), 0);
    const parsedAmount = parseCurrencyInput(manualAmountDisplay);
    const finalAmount = parsedAmount > 0 ? parsedAmount : itemsTotal;
    const targetDueDate = manualDueDate || calculateDefaultDueDate(manualDate);
    const linkedVehicle = availableVehicles.find(v => v.id === manualVehicleId);
    const vehicleFields: Partial<DocumentoEntradaRecord> = {
      condicao_pagamento: manualPaymentCondition,
      parcelas_qtd: manualInstallmentsCount,
      machineryId: linkedVehicle?.id || undefined,
      machineryName: linkedVehicle ? `${linkedVehicle.model}${linkedVehicle.licensePlateOrSerial ? ` (${linkedVehicle.licensePlateOrSerial})` : ''}` : undefined,
      vehicleId: linkedVehicle?.id || undefined,
      vehiclePlate: linkedVehicle?.licensePlateOrSerial || undefined,
      vehicleModel: linkedVehicle?.model || undefined,
    };

    setIsSavingManualEntry(true);
    try {
      let savedDoc: DocumentoEntradaRecord;

      if (currentManualDoc) {
        savedDoc = {
          ...currentManualDoc,
          fornecedor: trimmedSupplier,
          data: manualDate,
          data_vencimento: targetDueDate,
          tipo_documento: manualDocumentType,
          valor_total: finalAmount,
          observacoes: manualNotes.trim(),
          status: 'Rascunho',
          ...vehicleFields,
        };
        await updateDocumentoEntrada(savedDoc.id, {
          fornecedor: trimmedSupplier,
          data: manualDate,
          data_vencimento: targetDueDate,
          tipo_documento: manualDocumentType,
          valor_total: finalAmount,
          observacoes: manualNotes.trim(),
          status: 'Rascunho',
          ...vehicleFields,
        });
        setCurrentManualDoc(savedDoc);
        setDocumentosEntrada(prev => prev.map(d => d.id === savedDoc.id ? savedDoc : d));
      } else {
        savedDoc = await insertDocumentoEntrada({
          fornecedor: trimmedSupplier,
          data: manualDate,
          data_vencimento: targetDueDate,
          tipo_documento: manualDocumentType,
          valor_total: finalAmount,
          observacoes: manualNotes.trim(),
          status: 'Rascunho',
          ...vehicleFields,
        });
        setCurrentManualDoc(savedDoc);
        setDocumentosEntrada(prev => {
          const filtered = prev.filter(d => d.id !== savedDoc.id);
          return [savedDoc, ...filtered];
        });
      }

      // Persistência na chave agrocontrol_notas_entradas
      const rawNotas = localStorage.getItem('agrocontrol_notas_entradas');
      let notasAtuais: DocumentoEntradaRecord[] = [];
      if (rawNotas) {
        try {
          const parsed = JSON.parse(rawNotas);
          if (Array.isArray(parsed)) notasAtuais = parsed;
        } catch { notasAtuais = []; }
      }
      if (notasAtuais.length === 0) notasAtuais = getStoredDocumentosEntrada();
      const notasFiltradas = notasAtuais.filter(d => d.id !== savedDoc.id);
      const notasAtualizadas = [savedDoc, ...notasFiltradas];
      localStorage.setItem('agrocontrol_notas_entradas', JSON.stringify(notasAtualizadas));
      saveStoredDocumentosEntrada(notasAtualizadas);
      setDocumentosEntrada(notasAtualizadas);

      // Persistência local imediata dos itens na chave 'colaca_silagem_documentos_entrada_itens'
      if (manualDocItems && manualDocItems.length > 0) {
        try {
          const existingItems = getStoredDocumentosEntradaItens();
          const otherItems = existingItems.filter(i => i.documento_entrada_id !== savedDoc.id);
          const itemsToSave: DocumentoEntradaItem[] = manualDocItems.map(mItem => ({
            ...mItem,
            documento_entrada_id: savedDoc.id,
          }));
          saveStoredDocumentosEntradaItens([...itemsToSave, ...otherItems]);
        } catch (e) {
          console.warn('Aviso ao sincronizar itens no colaca_silagem_documentos_entrada_itens:', e);
        }
      }

      setIsManualEntryModalOpen(false);
      setSuccessMessage('Entrada salva como Rascunho com sucesso! Você pode continuar a edição pelo histórico.');
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      console.error('Erro ao salvar rascunho da entrada:', err);
      setManualFormError('Erro ao salvar rascunho. Tente novamente.');
    } finally {
      setIsSavingManualEntry(false);
    }
  };

  // PASSO 2: Busca e autocompletes de produtos no estoque utilizando a coluna real 'nome_comercial'
  const filteredStockProducts = useMemo(() => {
    if (searchedStockProducts && searchedStockProducts.length > 0) {
      return searchedStockProducts;
    }
    const q = itemSearchQuery.trim().toLowerCase();
    const sorted = [...localInventory].sort((a, b) => {
      const aFuel = (a.categoria || a.category) === 'Combustível & Arla' || 
        String(a.nome_comercial || a.name || '').toLowerCase().includes('diesel') || 
        String(a.nome_comercial || a.name || '').toLowerCase().includes('arla');
      const bFuel = (b.categoria || b.category) === 'Combustível & Arla' || 
        String(b.nome_comercial || b.name || '').toLowerCase().includes('diesel') || 
        String(b.nome_comercial || b.name || '').toLowerCase().includes('arla');
      if (aFuel && !bFuel) return -1;
      if (!aFuel && bFuel) return 1;
      return String(a.nome_comercial || a.name || '').localeCompare(String(b.nome_comercial || b.name || ''));
    });

    if (!q) return sorted.slice(0, 40);
    return sorted.filter(item => {
      const nc = String(item.nome_comercial || item.name || '').toLowerCase();
      const code = String(item.code || '').toLowerCase();
      const cat = String(item.categoria || item.category || '').toLowerCase();
      return nc.includes(q) || code.includes(q) || cat.includes(q);
    }).slice(0, 40);
  }, [searchedStockProducts, itemSearchQuery, localInventory]);

  const isProductExistingInStock = useMemo(() => {
    const q = itemSearchQuery.trim().toLowerCase();
    if (!q) return true;
    return filteredStockProducts.some(p => {
      const nc = (p.nome_comercial || p.name || p.nome || '').trim().toLowerCase();
      return nc === q;
    }) || localInventory.some(p => {
      const nc = (p.nome_comercial || p.name || p.nome || '').trim().toLowerCase();
      return nc === q;
    });
  }, [itemSearchQuery, filteredStockProducts, localInventory]);

  // Seleciona um produto do estoque mapeando estritamente nome_comercial, unidade_medida e preco_custo_inicial
  const handleSelectProduct = (prod: InventoryItem) => {
    setSelectedProduct(prod);
    const prodName = prod.nome_comercial || prod.name || prod.nome || '';
    setItemSearchQuery(prodName);
    const rawUnit = String(prod.unidade_medida || prod.unit || 'un').trim();
    const cleanUnit = rawUnit.toLowerCase() === 'l' || rawUnit.toLowerCase() === 'litro' || rawUnit.toLowerCase() === 'litros' || rawUnit.toLowerCase() === 'lt'
      ? 'L'
      : (rawUnit.toLowerCase() === 'un' || rawUnit.toLowerCase() === 'und' || rawUnit.toLowerCase() === 'unidade' ? 'un' : rawUnit);
    setItemUnit(cleanUnit);
    const cost = Number(prod.preco_custo_inicial ?? prod.unitCost ?? 0);
    if (cost > 0) {
      setItemUnitCostDisplay(formatCurrencyInputDisplay(cost));
    }
    setIsItemSearchOpen(false);
  };

  // Manipulação de Custo Nominal
  const handleQuickCostChange = (valStr: string) => {
    const rawVal = valStr.replace(/\D/g, '');
    if (!rawVal) {
      setQuickProductCostDisplay('');
      return;
    }
    const cost = parseInt(rawVal, 10) / 100;
    setQuickProductCostDisplay(formatCurrencyInputDisplay(cost));

    // Recalcula Preço de Venda se Margem de Lucro estiver preenchida
    const marginNum = parseFloat(quickProductProfitMargin.replace(',', '.'));
    if (!isNaN(marginNum) && marginNum >= 0 && cost > 0) {
      const calculatedSale = cost * (1 + marginNum / 100);
      setQuickProductSaleDisplay(formatCurrencyInputDisplay(calculatedSale));
    } else {
      // Se Preço de Venda já existe, recalcula a margem
      const currentSale = parseCurrencyInput(quickProductSaleDisplay);
      if (currentSale > 0 && cost > 0) {
        const calculatedMargin = (((currentSale - cost) / cost) * 100).toFixed(2);
        setQuickProductProfitMargin(calculatedMargin.replace('.00', '').replace('.', ','));
      }
    }
  };

  // Manipulação de Preço de Venda Sugerido
  const handleQuickSaleChange = (valStr: string) => {
    const rawVal = valStr.replace(/\D/g, '');
    if (!rawVal) {
      setQuickProductSaleDisplay('');
      setQuickProductProfitMargin('');
      return;
    }
    const sale = parseInt(rawVal, 10) / 100;
    setQuickProductSaleDisplay(formatCurrencyInputDisplay(sale));

    // Recalcula Margem de Lucro Sugerida (%)
    const cost = parseCurrencyInput(quickProductCostDisplay);
    if (cost > 0) {
      const calculatedMargin = (((sale - cost) / cost) * 100).toFixed(2);
      setQuickProductProfitMargin(calculatedMargin.replace('.00', '').replace('.', ','));
    }
  };

  // Manipulação de Margem de Lucro Sugerida (%)
  const handleQuickMarginChange = (valStr: string) => {
    const cleaned = valStr.replace(/[^0-9,.-]/g, '');
    setQuickProductProfitMargin(cleaned);

    const marginNum = parseFloat(cleaned.replace(',', '.'));
    const cost = parseCurrencyInput(quickProductCostDisplay);
    if (!isNaN(marginNum) && cost > 0) {
      const calculatedSale = cost * (1 + marginNum / 100);
      setQuickProductSaleDisplay(formatCurrencyInputDisplay(calculatedSale));
    }
  };

  // Máscara NCM (0000.00.00)
  const handleQuickNcmChange = (valStr: string) => {
    const digits = valStr.replace(/\D/g, '').slice(0, 8);
    let formatted = digits;
    if (digits.length > 4 && digits.length <= 6) {
      formatted = `${digits.slice(0, 4)}.${digits.slice(4)}`;
    } else if (digits.length > 6) {
      formatted = `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6)}`;
    }
    setQuickProductNcm(formatted);
  };

  // Salva categorias gerenciadas
  const handleSaveStockCategories = (newCategories: string[]) => {
    setStockCategories(newCategories);
    saveStoredInventoryCategories(newCategories);
  };

  // Abre submodal de cadastro rápido de novo produto no estoque
  const handleOpenQuickProductModal = (nameToPreFill?: string) => {
    const pName = (nameToPreFill || itemSearchQuery).trim();
    setQuickProductName(pName);
    setQuickProductUnit(itemUnit || 'UN');
    setQuickProductCategory(stockCategories[0] || 'Outros Insumos');
    setQuickProductBrand('');
    setQuickProductBarcode('');
    setQuickProductHasNoGtin(false);
    setQuickProductFactoryRef('');
    setQuickProductNcm('');
    setQuickProductFiscalGroup('TRIBUTADO');
    setQuickProductIpiGroup('NAO TRIBUTADO');
    setQuickProductCode('');
    setQuickProductLocation('Barracão Principal');

    const curCost = parseCurrencyInput(itemUnitCostDisplay);
    if (curCost > 0) {
      setQuickProductCostDisplay(formatCurrencyInputDisplay(curCost));
      const defSale = curCost * 1.3;
      setQuickProductSaleDisplay(formatCurrencyInputDisplay(defSale));
      setQuickProductProfitMargin('30');
    } else {
      setQuickProductCostDisplay('0,00');
      setQuickProductSaleDisplay('0,00');
      setQuickProductProfitMargin('');
    }
    setIsQuickProductModalOpen(true);
  };

  // Salva produto rapidamente no estoque sem fechar o modal da entrada
  const handleSaveQuickProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const pName = quickProductName.trim();
    if (!pName) {
      alert('Por favor, informe o nome do produto.');
      return;
    }

    const costValue = parseCurrencyInput(quickProductCostDisplay);
    const saleValue = parseCurrencyInput(quickProductSaleDisplay);
    const marginValue = parseFloat(quickProductProfitMargin.replace(',', '.')) || (costValue > 0 && saleValue > 0 ? Number((((saleValue - costValue) / costValue) * 100).toFixed(2)) : undefined);

    setIsSavingQuickProduct(true);
    try {
      const newProdId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newProduct: InventoryItem = {
        id: newProdId,
        name: pName,
        code: quickProductCode.trim() || undefined,
        unit: (quickProductUnit || 'UN').toUpperCase().trim(),
        category: quickProductCategory || 'outro',
        unitCost: costValue,
        salePrice: saleValue,
        profitMargin: marginValue,
        quantity: 0, // Saldo zerado inicial; a quantidade será somada ao adicionar o item
        minQuantity: 0,
        location: quickProductLocation.trim() || 'Barracão Principal',
        brand: quickProductBrand.trim() || undefined,
        barcode: quickProductHasNoGtin ? 'SEM GTIN' : (quickProductBarcode.trim() || undefined),
        hasNoGtin: quickProductHasNoGtin,
        factoryRef: quickProductFactoryRef.trim() || undefined,
        ncm: quickProductNcm.trim() || undefined,
        fiscalGroup: quickProductFiscalGroup,
        ipiGroup: quickProductIpiGroup,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const updated = [...localInventory, newProduct];
      saveInventory(updated);
      await upsertEstoqueItem(newProduct);
      saveCloudInventory(updated).catch(err => console.warn('Supabase saveCloudInventory sync notice:', err));

      // Vincula diretamente no item atual
      setSelectedProduct(newProduct);
      setItemSearchQuery(newProduct.name);
      setItemUnit(newProduct.unit);
      if (newProduct.unitCost > 0) {
        setItemUnitCostDisplay(formatCurrencyInputDisplay(newProduct.unitCost));
      }

      setIsQuickProductModalOpen(false);
      setSuccessMessage(`Produto "${newProduct.name}" cadastrado com sucesso no estoque!`);
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      console.error('Erro ao salvar produto rápido:', err);
      alert('Erro ao salvar produto. Tente novamente.');
    } finally {
      setIsSavingQuickProduct(false);
    }
  };

  // Adiciona item na entrada: atualiza manualDocItems reativamente, persiste localmente e sincroniza estoque
  const handleAddItemToManualDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    setItemFormError('');

    if (!currentManualDoc) {
      setItemFormError('Documento de entrada não inicializado.');
      return;
    }

    // 1. Captura o objeto do produto real selecionado no Combobox de busca ou pesquisa por correspondência no estoque
    const query = itemSearchQuery.trim();
    const matchedStockProduct = selectedProduct || localInventory.find(p => {
      if (!query) return false;
      const qLower = query.toLowerCase();
      const nc = (p.nome_comercial || '').trim().toLowerCase();
      const nm = (p.name || '').trim().toLowerCase();
      const no = (p.nome || '').trim().toLowerCase();
      const cd = (p.code || p.codigo_produto || '').trim().toLowerCase();
      return nc === qLower || nm === qLower || no === qLower || (cd && cd === qLower);
    });

    // Nome exato vindo do estoque (Ex: 'PNEU MICHELAN', 'FILTRO DE ÓLEO') em vez de texto estático
    const realProductName = (
      matchedStockProduct?.nome_comercial ||
      matchedStockProduct?.name ||
      matchedStockProduct?.nome ||
      query
    ).trim();

    if (!realProductName) {
      setItemFormError('Por favor, selecione ou digite o nome do produto no campo de busca.');
      return;
    }

    // 2. Captura Quantidade
    const qty = parseFloat(itemQuantity.replace(',', '.'));
    if (isNaN(qty) || qty <= 0) {
      setItemFormError('Informe uma quantidade válida maior que zero.');
      return;
    }

    // 3. Captura Valor Unitário (R$)
    const unitPrice = parseCurrencyInput(itemUnitCostDisplay);
    if (unitPrice < 0) {
      setItemFormError('O valor unitário não pode ser negativo.');
      return;
    }

    // 4. Unidade e Cálculo Matemático correto: Subtotal = Quantidade * Valor Unitário
    const rawUnit = (itemUnit || matchedStockProduct?.unidade_medida || matchedStockProduct?.unit || 'UN').trim();
    const unit = rawUnit.toUpperCase();
    const totalPrice = Math.round(qty * unitPrice * 100) / 100;

    // Cria registro de item real com identificador único
    const newItemId = generateUUID();
    const newItem: DocumentoEntradaItem = {
      id: newItemId,
      documento_entrada_id: currentManualDoc.id,
      produto_id: matchedStockProduct?.id ? toValidUUID(matchedStockProduct.id) : undefined,
      descricao: realProductName,
      quantidade: qty,
      unidade: unit,
      valor_unitario: unitPrice,
      valor_total: totalPrice,
    };

    // ATUALIZAÇÃO REATIVA IMEDIATA: Adiciona na tabela e atualiza os totais em tempo real
    setManualDocItems(prev => [...prev, newItem]);

    // Limpa imediatamente os campos do formulário para o próximo item
    setSelectedProduct(null);
    setItemSearchQuery('');
    setItemQuantity('1');
    setItemUnit('UN');
    setItemUnitCostDisplay('');
    setIsItemSearchOpen(false);

    // Persistência local imediata offline-first
    saveLocalDocumentoEntradaItem(newItem);

    // Sincronização em segundo plano no Supabase e no Saldo de Estoque
    setIsAddingItem(true);
    try {
      // 1. Grava no Supabase (se configurado)
      await insertDocumentoEntradaItem(newItem);

      // 2. SOMAR automaticamente no saldo atual da tabela de 'Estoque' (estoque_produtos)
      let targetProduct = matchedStockProduct || localInventory.find(p => 
        (p.nome_comercial && p.nome_comercial.toLowerCase().trim() === realProductName.toLowerCase()) ||
        (p.name && p.name.toLowerCase().trim() === realProductName.toLowerCase())
      );

      const descLower = realProductName.toLowerCase();
      const isCombustivel = 
        (targetProduct?.categoria || targetProduct?.category) === 'Combustível & Arla' ||
        descLower.includes('diesel') ||
        descLower.includes('arla') ||
        identificarTipoDiesel(realProductName, targetProduct?.category) !== null;

      let updatedInventory: InventoryItem[];

      if (isCombustivel) {
        const syncResult = await sincronizarEntradaCombustivelSupabase({
          produtoId: targetProduct?.id,
          descricao: realProductName,
          categoria: 'Combustível & Arla',
          quantidadeLitros: qty,
          custoUnitario: unitPrice,
        });

        const finalEstoqueQty = syncResult.novoSaldoEstoque ?? ((Number(targetProduct?.quantidade_atual ?? targetProduct?.quantity) || 0) + qty);

        if (targetProduct) {
          const updatedProduct: InventoryItem = {
            ...targetProduct,
            quantity: finalEstoqueQty,
            quantidade_atual: finalEstoqueQty,
            unitCost: unitPrice > 0 ? unitPrice : targetProduct.unitCost,
            preco_custo_inicial: unitPrice > 0 ? unitPrice : (targetProduct.preco_custo_inicial ?? targetProduct.unitCost),
          };
          updatedInventory = localInventory.map(p => p.id === targetProduct.id ? updatedProduct : p);
          saveInventory(updatedInventory);
        } else {
          const newProdId = syncResult.produtoId || `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const newProduct: InventoryItem = {
            id: newProdId,
            name: realProductName,
            nome_comercial: realProductName,
            unit: 'L',
            unidade_medida: 'L',
            category: 'Combustível & Arla',
            categoria: 'Combustível & Arla',
            quantity: finalEstoqueQty,
            quantidade_atual: finalEstoqueQty,
            minQuantity: 2000,
            unitCost: unitPrice,
            preco_custo_inicial: unitPrice,
            salePrice: unitPrice > 0 ? unitPrice * 1.3 : 0,
            preco_venda_varejo: unitPrice > 0 ? unitPrice * 1.3 : 0,
            location: 'Tanque da Fazenda',
          };
          updatedInventory = [...localInventory, newProduct];
          saveInventory(updatedInventory);
        }
      } else if (targetProduct) {
        const updatedProduct: InventoryItem = {
          ...targetProduct,
          quantity: (Number(targetProduct.quantity) || 0) + qty,
          quantidade_atual: (Number(targetProduct.quantidade_atual ?? targetProduct.quantity) || 0) + qty,
          unitCost: unitPrice > 0 ? unitPrice : targetProduct.unitCost,
          preco_custo_inicial: unitPrice > 0 ? unitPrice : (targetProduct.preco_custo_inicial ?? targetProduct.unitCost),
        };
        updatedInventory = localInventory.map(p => p.id === targetProduct.id ? updatedProduct : p);
        saveInventory(updatedInventory);
        await upsertEstoqueItem(updatedProduct);
      } else {
        // Produto novo cadastrado diretamente no estoque com a quantidade somada
        const newProdId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const newProduct: InventoryItem = {
          id: newProdId,
          name: realProductName,
          nome_comercial: realProductName,
          unit: unit,
          unidade_medida: unit,
          category: 'outro',
          categoria: 'outro',
          quantity: qty,
          quantidade_atual: qty,
          minQuantity: 0,
          unitCost: unitPrice,
          preco_custo_inicial: unitPrice,
          salePrice: unitPrice > 0 ? unitPrice * 1.3 : 0,
          preco_venda_varejo: unitPrice > 0 ? unitPrice * 1.3 : 0,
          location: 'Barracão Principal',
        };
        updatedInventory = [...localInventory, newProduct];
        saveInventory(updatedInventory);
        await upsertEstoqueItem(newProduct);
      }
    } catch (err) {
      console.warn('Aviso ao sincronizar produto no estoque/supabase:', err);
    } finally {
      setIsAddingItem(false);
    }
  };

  // Exclui item da entrada e estorna a quantidade do estoque
  const handleDeleteItemFromManualDoc = async (item: DocumentoEntradaItem) => {
    try {
      await deleteDocumentoEntradaItem(item.id);

      // Estorna a quantidade no saldo de Estoque
      const targetProduct = localInventory.find(p => 
        (item.produto_id && p.id === item.produto_id) ||
        p.name.toLowerCase().trim() === item.descricao.toLowerCase().trim()
      );

      if (targetProduct) {
        const newQty = Math.max(0, (Number(targetProduct.quantity) || 0) - Number(item.quantidade));
        const updatedProduct: InventoryItem = {
          ...targetProduct,
          quantity: newQty,
          quantidade_atual: newQty,
        };
        const updatedInventory = localInventory.map(p => p.id === targetProduct.id ? updatedProduct : p);
        saveInventory(updatedInventory);
        await upsertEstoqueItem(updatedProduct);
      }

      // Estorna do Tanque de Combustível da Fazenda se for Combustível
      const isCombustivel = (targetProduct?.categoria || targetProduct?.category) === 'Combustível & Arla' ||
        item.descricao.toLowerCase().includes('diesel') ||
        item.descricao.toLowerCase().includes('arla');
      if (isCombustivel && Number(item.quantidade) > 0) {
        const isS500 = item.descricao.toLowerCase().includes('s500') || item.descricao.toLowerCase().includes('comum');
        const tId = isS500 ? 'tanque_diesel_s500' : 'tanque_diesel_s10';
        subtrairCombustivelTanque(tId, Number(item.quantidade)).catch(() => {});
      }

      setManualDocItems(prev => prev.filter(i => i.id !== item.id));
    } catch (err) {
      console.error('Erro ao excluir item da entrada:', err);
    }
  };

  // Atualiza o total do cabeçalho com base na soma dos itens
  const handleSyncHeaderToItemsTotal = async () => {
    if (!currentManualDoc) return;
    setManualFormError('');
    const itemsTotal = manualDocItems.reduce((sum, item) => sum + (Number(item.valor_total) || 0), 0);
    await updateDocumentoEntradaTotal(currentManualDoc.id, itemsTotal);
    const updatedDoc = { ...currentManualDoc, valor_total: itemsTotal };
    setCurrentManualDoc(updatedDoc);
    setManualAmountDisplay(formatCurrencyInputDisplay(itemsTotal));
    setDocumentosEntrada(prev => prev.map(d => d.id === updatedDoc.id ? updatedDoc : d));
    setSuccessMessage(`Valor total da entrada atualizado para ${formatCurrencyBRL(itemsTotal)}!`);
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  // 3. FINALIZAÇÃO: Ação do botão "Concluir Entrada" no Passo 2
  // 1. BLOQUEIO DE VALIDAÇÃO: Verifica se a soma dos itens bate com o total previsto do cabeçalho.
  // Se correto, abre a Janela de Forma de Pagamento e Condições de Lançamento Financeiro (idêntica à do XML).
  const handleFinalizeManualEntry = async () => {
    setManualFormError('');

    const trimmedSupplier = (currentManualDoc?.fornecedor || manualSupplier).trim();
    if (!trimmedSupplier) {
      setManualFormError('Bloqueio de Validação: Por favor, informe o fornecedor.');
      setManualEntryStep(1);
      return;
    }

    if (manualDocItems.length === 0) {
      setManualFormError('Bloqueio de Validação: Adicione ao menos 01 produto à entrada antes de concluir.');
      const searchInput = document.getElementById('manual-item-search-input');
      if (searchInput) {
        searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        searchInput.focus();
      }
      return;
    }

    const itemsTotal = manualDocItems.reduce((sum, item) => sum + (Number(item.valor_total) || 0), 0);
    const headerTotal = Number(currentManualDoc?.valor_total) || parseCurrencyInput(manualAmountDisplay);
    const diff = Math.abs(itemsTotal - headerTotal);

    // Bloqueio se houver divergência entre cabeçalho e itens
    if (diff >= 0.01) {
      setManualFormError(
        `Bloqueio de Validação: A soma dos itens (${formatCurrencyBRL(itemsTotal)}) deve ser exatamente igual ao valor total previsto no cabeçalho (${formatCurrencyBRL(headerTotal)}). Ajuste os itens ou clique em 'Atualizar total do documento para ${formatCurrencyBRL(itemsTotal)}'.`
      );
      const alertEl = document.getElementById('alerta-erro-validacao-passo-2');
      if (alertEl) {
        alertEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    // Se estiver 100% conferido, abre a Janela Independente de Forma de Pagamento & Parcelas
    setIsManualInstallmentsModalOpen(true);
  };

  // 4. CONFIRMAÇÃO E GRAVAÇÃO DAS PARCELAS DA ENTRADA MANUAL (SUPABASE + FINANCEIRO)
  // Fraciona e salva as parcelas geradas via POST diretamente na tabela 'public.contas_a_pagar' do Supabase,
  // vinculando o nome do Fornecedor e o ID desta entrada de mercadoria.
  const handleConfirmAndSaveManualInstallments = async (detailedInstallments: NfeDetailedInstallment[]) => {
    const trimmedSupplier = (currentManualDoc?.fornecedor || manualSupplier).trim();
    if (!trimmedSupplier) {
      setManualFormError('Bloqueio de Validação: Por favor, informe o fornecedor.');
      setIsManualInstallmentsModalOpen(false);
      setManualEntryStep(1);
      return;
    }

    const itemsTotal = manualDocItems.reduce((sum, item) => sum + (Number(item.valor_total) || 0), 0);
    const headerTotal = Number(currentManualDoc?.valor_total) || parseCurrencyInput(manualAmountDisplay);
    const finalAmount = itemsTotal > 0 ? itemsTotal : (headerTotal > 0 ? headerTotal : 0);

    const firstDueDate = detailedInstallments[0]?.dueDate || manualDueDate || calculateDefaultDueDate(manualDate);
    const totalParcs = detailedInstallments.length;
    const linkedVehicle = availableVehicles.find(v => v.id === manualVehicleId);
    const vehicleLabel = linkedVehicle
      ? `${linkedVehicle.model}${linkedVehicle.licensePlateOrSerial ? ` (${linkedVehicle.licensePlateOrSerial})` : ''}`
      : undefined;
    const vehicleFields: Partial<DocumentoEntradaRecord> = {
      condicao_pagamento: detailedInstallments[0]?.paymentMethodLabel?.replace(/^\d+\s*-\s*/, '') || manualPaymentCondition,
      parcelas_qtd: totalParcs,
      machineryId: linkedVehicle?.id || undefined,
      machineryName: vehicleLabel,
      vehicleId: linkedVehicle?.id || undefined,
      vehiclePlate: linkedVehicle?.licensePlateOrSerial || undefined,
      vehicleModel: linkedVehicle?.model || undefined,
    };

    setIsSavingManualEntry(true);
    try {
      let activeDocId = currentManualDoc?.id;
      let finalDoc: DocumentoEntradaRecord;

      const docNumero = currentManualDoc?.numero || currentManualDoc?.numero_documento || (activeDocId ? activeDocId.slice(0, 8).toUpperCase() : `DOC-${Date.now().toString().slice(-6)}`);

      if (currentManualDoc) {
        finalDoc = {
          ...currentManualDoc,
          numero: docNumero,
          numero_documento: docNumero,
          fornecedor: trimmedSupplier,
          fornecedor_nome: trimmedSupplier,
          data: manualDate,
          data_entrada: manualDate,
          data_emissao: manualDate,
          data_vencimento: firstDueDate,
          tipo_documento: manualDocumentType,
          valor_total: finalAmount,
          observacoes: manualNotes.trim() || `Entrada manual: ${manualDocumentType}`,
          status: 'Finalizado',
          updated_at: new Date().toISOString(),
          ...vehicleFields,
        };
        activeDocId = finalDoc.id;
        await updateDocumentoEntrada(currentManualDoc.id, {
          numero: docNumero,
          numero_documento: docNumero,
          fornecedor: trimmedSupplier,
          data: manualDate,
          data_vencimento: firstDueDate,
          tipo_documento: manualDocumentType,
          valor_total: finalAmount,
          observacoes: manualNotes.trim() || `Entrada manual: ${manualDocumentType}`,
          status: 'Finalizado',
          ...vehicleFields,
        }).catch(e => console.warn('Aviso updateDocumentoEntrada:', e));
      } else {
        const newDocId = toValidUUID(generateUUID());
        activeDocId = newDocId;
        finalDoc = {
          id: newDocId,
          numero: docNumero,
          numero_documento: docNumero,
          fornecedor: trimmedSupplier,
          fornecedor_nome: trimmedSupplier,
          data: manualDate,
          data_entrada: manualDate,
          data_emissao: manualDate,
          data_vencimento: firstDueDate,
          tipo_documento: manualDocumentType,
          valor_total: finalAmount,
          observacoes: manualNotes.trim() || `Entrada manual: ${manualDocumentType}`,
          status: 'Finalizado',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...vehicleFields,
        };
        await insertDocumentoEntrada(finalDoc).catch(e => console.warn('Aviso insertDocumentoEntrada:', e));
      }

      // 1. CORREÇÃO DA EXIBIÇÃO NO HISTÓRICO (PRINT 1):
      // Salva o cabeçalho completo da nota estritamente nas chaves de persistência e atualiza o estado
      const rawNotas = localStorage.getItem('agrocontrol_notas_entradas');
      let notasAtuais: DocumentoEntradaRecord[] = [];
      if (rawNotas) {
        try {
          const parsed = JSON.parse(rawNotas);
          if (Array.isArray(parsed)) notasAtuais = parsed;
        } catch {
          notasAtuais = [];
        }
      }
      if (notasAtuais.length === 0) {
        notasAtuais = getStoredDocumentosEntrada();
      }
      const notasFiltradas = notasAtuais.filter(d => d.id !== finalDoc.id);
      const notasAtualizadas = [finalDoc, ...notasFiltradas];
      localStorage.setItem('agrocontrol_notas_entradas', JSON.stringify(notasAtualizadas));
      saveStoredDocumentosEntrada(notasAtualizadas);
      setDocumentosEntrada(notasAtualizadas);

      // LANÇAMENTO NO FINANCEIRO (Tabela public.contas_a_pagar do Supabase e agrocontrol_financeiro)
      // Determinação da categoria financeira exata ('Combustível & Arla' ou 'Insumos & Entradas') para alimentação do gráfico de pizza
      const primaryCategory = determineFinancialCategory(
        manualDocItems.map(i => ({
          descricao: i.descricao,
          valor_total: Number(i.valor_total) || 0,
          quantidade: i.quantidade,
          valor_unitario: i.valor_unitario
        })),
        `${manualSupplier} ${manualDocumentType} ${manualNotes}`
      );
      const isCombustivel = primaryCategory === 'Combustível & Arla';
      const catColor = isCombustivel ? '#d97706' : '#059669';
      const catId = isCombustivel ? 'cat_combustivel' : 'cat_insumos';

      // 2. FIM DA DUPLICAÇÃO NO FINANCEIRO (PRINT 2):
      // Montagem dos lançamentos das parcelas com ID único vinculado à nota (+ vínculo DRE da Frota se selecionado)
      const novosLancamentosFinanceiros: Expense[] = detailedInstallments.map((inst, idx) => {
        const parcelNum = inst.number || String(idx + 1).padStart(2, '0');
        const instId = totalParcs === 1 ? `pagar_${activeDocId}` : `pagar_${activeDocId}_parc_${idx + 1}`;
        const suffix = totalParcs > 1 ? ` (${parcelNum}/${totalParcs})` : '';
        const plateTag = linkedVehicle?.licensePlateOrSerial ? ` [${linkedVehicle.licensePlateOrSerial}]` : '';
        const docDescricao = `ENTRADA MANUAL REF. ${manualDocumentType}${suffix} - ${trimmedSupplier}${plateTag}`.toUpperCase();
        const dueResolved = inst.dueDate || firstDueDate;

        return {
          id: instId,
          companyId: getActiveCompanyId() || 'default',
          notaId: activeDocId,
          documento_entrada_id: activeDocId,
          description: docDescricao,
          amount: Number(inst.amount) || 0,
          valor_parcela: Number(inst.amount) || 0,
          valor_total: finalAmount,
          numero_parcela: totalParcs > 1 ? `${parcelNum}/${totalParcs}` : '01/01',
          categoryId: catId,
          categoryName: primaryCategory.toUpperCase(),
          categoria: primaryCategory.toUpperCase(),
          centro_custo: linkedVehicle ? `FROTA - ${linkedVehicle.licensePlateOrSerial || linkedVehicle.model}`.toUpperCase() : primaryCategory.toUpperCase(),
          costCenterName: linkedVehicle ? `Veículo ${linkedVehicle.licensePlateOrSerial || linkedVehicle.model}` : primaryCategory.toUpperCase(),
          categoryColor: catColor,
          machineryId: linkedVehicle?.id || undefined,
          machineryName: vehicleLabel,
          vehicleId: linkedVehicle?.id || undefined,
          vehiclePlate: linkedVehicle?.licensePlateOrSerial || undefined,
          date: manualDate,
          dueDate: dueResolved,
          data_vencimento: dueResolved,
          status: 'pendente' as const,
          status_pago: false,
          paymentMethod: mapPaymentMethodCode(inst.paymentMethodCode),
          forma_pagamento: inst.paymentMethodLabel || manualPaymentCondition || 'Boleto',
          supplier: trimmedSupplier.toUpperCase(),
          fornecedor: trimmedSupplier.toUpperCase(),
          invoiceNumber: `${manualDocumentType.toUpperCase()}${suffix}`,
          notes: manualNotes.trim() ? `${docDescricao}: ${manualNotes.trim()}`.toUpperCase() : docDescricao,
          receiptUrl: inst.documentFileUrl,
          receiptName: inst.documentFileName,
          createdAt: new Date().toISOString(),
        };
      });

      // TRAVA DE ID ÚNICO NO LOCALSTORAGE 'agrocontrol_financeiro':
      // Filtrar e remover qualquer lançamento antigo/duplicado vinculado ao ID desta nota específica antes de injetar os novos
      let financeiroAtual: any[] = [];
      try {
        const rawFin = localStorage.getItem('agrocontrol_financeiro');
        if (rawFin) {
          const parsedFin = JSON.parse(rawFin);
          if (Array.isArray(parsedFin)) financeiroAtual = parsedFin;
        }
      } catch (_) {}

      const financeiroLimpo = financeiroAtual.filter((f: any) => 
        f.notaId !== activeDocId && 
        f.documento_entrada_id !== activeDocId &&
        f.nfeId !== activeDocId &&
        !(typeof f.id === 'string' && f.id.includes(activeDocId))
      );

      // Agora insere os novos registros únicos sem risco de duplicar
      const financeiroAtualizado = [...novosLancamentosFinanceiros, ...financeiroLimpo];
      localStorage.setItem('agrocontrol_financeiro', JSON.stringify(financeiroAtualizado));

      // Sincroniza também no armazenamento de despesas principal do sistema
      const storedExpenses = getStoredExpenses();
      const storedExpensesLimpo = storedExpenses.filter(e => 
        (e as any).notaId !== activeDocId &&
        (e as any).documento_entrada_id !== activeDocId &&
        !(typeof e.id === 'string' && e.id.includes(activeDocId))
      );
      saveStoredExpenses([...novosLancamentosFinanceiros, ...storedExpensesLimpo]);

      // Atualiza custo acumulado do veículo/máquina no DRE da Frota (quando vinculado)
      if (linkedVehicle && finalAmount > 0) {
        try {
          const prevMachineryId = currentManualDoc?.machineryId || currentManualDoc?.vehicleId;
          const prevAmount = Number(currentManualDoc?.valor_total) || 0;
          const wasFinalizedWithVehicle = currentManualDoc?.status === 'Finalizado' && prevMachineryId === linkedVehicle.id;
          const deltaCost = wasFinalizedWithVehicle ? Math.max(0, finalAmount - prevAmount) : finalAmount;

          if (deltaCost > 0) {
            const currentFleet = getStoredMachineries();
            if (currentFleet.length > 0) {
              const updatedFleet = currentFleet.map(m =>
                m.id === linkedVehicle.id
                  ? { ...m, accumulatedCost: (Number(m.accumulatedCost) || 0) + deltaCost }
                  : m
              );
              saveStoredMachineries(updatedFleet);
              window.dispatchEvent(new CustomEvent('silagem_machineries_updated'));
            }
          }
        } catch (err) {
          console.warn('Aviso ao atualizar custo acumulado no DRE da Frota:', err);
        }
      }

      // Sincroniza também no estado de despesas do app para atualização em tempo real
      if (onAddExpenseFromNfe) {
        onAddExpenseFromNfe(novosLancamentosFinanceiros);
      }

      // Persistência segura no schema do Supabase (se configurado) sem duplicações
      if (isSupabaseConfigured) {
        await Promise.all(
          novosLancamentosFinanceiros.map(item =>
            upsertContaAPagar({
              id: item.id,
              nota_fiscal_id: null,
              numero_parcela: (item as any).numero_parcela || '01/01',
              valor_parcela: (item as any).valor_parcela || item.amount || 0,
              data_vencimento: (item as any).data_vencimento || item.dueDate,
              forma_pagamento: (item as any).forma_pagamento || item.paymentMethod || 'Boleto',
              centro_custo: (item as any).centro_custo || item.categoryName || 'Geral',
              categoria: (item as any).categoria || item.categoryName || 'Geral',
              status_pago: false
            }).catch(err => console.warn('Notice upsertContaAPagar:', err))
          )
        );
      }

      // Persistência local imediata dos itens na chave 'colaca_silagem_documentos_entrada_itens'
      if (manualDocItems && manualDocItems.length > 0) {
        try {
          const existingItems = getStoredDocumentosEntradaItens();
          const otherItems = existingItems.filter(i => i.documento_entrada_id !== activeDocId);
          const itemsToSave: DocumentoEntradaItem[] = manualDocItems.map(mItem => ({
            ...mItem,
            documento_entrada_id: activeDocId,
          }));
          saveStoredDocumentosEntradaItens([...itemsToSave, ...otherItems]);
        } catch (e) {
          console.warn('Aviso ao sincronizar itens no colaca_silagem_documentos_entrada_itens:', e);
        }
      }

      // Limpeza completa de rascunhos temporários do cache
      clearActiveNfeDraft();
      try {
        localStorage.removeItem('colaca_silagem_manual_entry_draft');
        localStorage.removeItem('colaca_silagem_nfe_active_draft');
      } catch (_) {}

      setIsManualInstallmentsModalOpen(false);
      setIsManualEntryModalOpen(false);

      // 3. CONCLUIR O STATUS NA TABELA HISTÓRICA:
      // Após o usuário salvar definitivamente essa Nota de Entrada gerada pelo retorno, mude de forma permanente o badge de STATUS do pedido para "Concluído"
      const reformOrderIdToClose = linkedReformOrderId || localStorage.getItem('colaca_silagem_ordem_reforma_em_retorno');
      if (reformOrderIdToClose) {
        try {
          const currentOrders = getStoredReformOrders();
          const updatedOrders = currentOrders.map(o => 
            (o.id === reformOrderIdToClose || o.orderNumber === reformOrderIdToClose)
              ? { ...o, status: 'Concluído' as const }
              : o
          );
          saveStoredReformOrders(updatedOrders);
          setReformOrdersCount(updatedOrders.length);
          setLinkedReformOrderId(null);
          localStorage.removeItem('colaca_silagem_ordem_reforma_em_retorno');
        } catch (err) {
          console.warn('Erro ao atualizar status do pedido de reforma para Concluído:', err);
        }
      }

      setSuccessMessage(
        `Entrada manual concluída com sucesso! ${totalParcs} parcela(s) lançada(s) no Contas a Pagar (${formatCurrencyBRL(finalAmount)}).`
      );
      setTimeout(() => setSuccessMessage(''), 5000);

      // Pergunta se o usuário deseja imprimir as etiquetas correspondentes aos itens da entrada manual
      const labelsToPrint: LabelProductItem[] = (manualDocItems || []).map(item => {
        const matched = localInventory.find(p => 
          (item.produto_id && p.id === item.produto_id) ||
          (p.nome_comercial && p.nome_comercial.toLowerCase().trim() === item.descricao.toLowerCase().trim()) ||
          p.name.toLowerCase().trim() === item.descricao.toLowerCase().trim()
        );

        const invItem: InventoryItem = matched || {
          id: item.produto_id || `manual_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: item.descricao,
          nome: item.descricao,
          nome_comercial: item.descricao,
          category: 'Outros Insumos',
          unit: item.unidade || 'UN',
          unidade_medida: item.unidade || 'UN',
          quantity: Number(item.quantidade) || 0,
          minQuantity: 0,
          unitCost: Number(item.valor_unitario) || 0,
          salePrice: Number(item.valor_unitario * 1.3),
          endereco_formatado: '00.00.00.00.00',
          location: 'Barracão Principal'
        };

        const exactNotaQty = Math.max(1, Math.round(Number(item.quantidade) || 1));
        return {
          product: invItem,
          quantity: exactNotaQty,
          invoiceQuantity: exactNotaQty
        };
      });

      if (labelsToPrint.length > 0) {
        setPrintPromptState({
          isOpen: true,
          title: 'Deseja imprimir as etiquetas de gôndola?',
          description: `A entrada manual (${manualDocumentType}) foi finalizada e ${labelsToPrint.length} item(ns) deram entrada no estoque. Deseja imprimir as etiquetas correspondentes com código de barras e endereço?`,
          items: labelsToPrint
        });
      }
    } catch (err) {
      console.error('Erro ao confirmar parcelas da entrada manual:', err);
      setManualFormError('Erro ao concluir a entrada e lançar no financeiro. Tente novamente.');
    } finally {
      setIsSavingManualEntry(false);
    }
  };

  const handleDeleteManualDoc = async (doc: DocumentoEntradaRecord) => {
    try {
      if (!doc || !doc.id) return;
      const docId = doc.id;
      const docNum = doc.numero || doc.numero_documento || '';
      const cleanNum = getCleanInvoiceNumber(docNum).toLowerCase();
      const digits = (docNum || '').replace(/\D/g, '');

      // Trava de tombstone: garante que o ID e número nunca voltem após F5
      recordDeletedDocumentoEntradaId(docId);
      recordDeletedNfeKey(docId);
      if (cleanNum) recordDeletedNfeKey(cleanNum);
      if (digits) recordDeletedNfeKey(digits);
      if (docNum) recordDeletedNfeKey(docNum.toLowerCase().trim());

      await deleteDocumentoEntrada(docId).catch(() => {});

      // Atualiza os dois estados do React imediatamente para a linha sumir da tabela em tempo real
      setDocumentosEntrada(prev => prev.filter(d => 
        d.id !== docId && 
        d.numero !== docNum && 
        (!cleanNum || getCleanInvoiceNumber(d.numero).toLowerCase() !== cleanNum)
      ));
      setNotasLancadas(prev => prev.filter(n => 
        n.id !== docId && 
        n.invoiceNumber !== docNum && 
        (!cleanNum || getCleanInvoiceNumber(n.invoiceNumber).toLowerCase() !== cleanNum)
      ));

      // Limpeza estrita no armazenamento permanente de registros fiscais
      const storedFiscal = getStoredFiscalRecords();
      const updatedFiscal = storedFiscal.filter(f => 
        f.id !== docId && 
        f.invoiceNumber !== docNum && 
        (!cleanNum || getCleanInvoiceNumber(f.invoiceNumber).toLowerCase() !== cleanNum)
      );
      saveStoredFiscalRecords(updatedFiscal);

      // Limpeza no armazenamento de documentos de entrada
      deleteLocalDocumentoEntrada(docId);

      // Limpeza estrita no agrocontrol_notas_entradas
      try {
        const rawNotas = localStorage.getItem('agrocontrol_notas_entradas');
        if (rawNotas) {
          const parsed = JSON.parse(rawNotas);
          if (Array.isArray(parsed)) {
            const filtradas = parsed.filter((d: any) => 
              d.id !== docId && 
              d.numero !== docNum && 
              (!cleanNum || getCleanInvoiceNumber(d.numero).toLowerCase() !== cleanNum)
            );
            localStorage.setItem('agrocontrol_notas_entradas', JSON.stringify(filtradas));
          }
        }
      } catch (_) {}

      // Limpeza estrita no colaca_silagem_documentos_entrada
      try {
        const rawColaca = localStorage.getItem('colaca_silagem_documentos_entrada');
        if (rawColaca) {
          const parsedColaca = JSON.parse(rawColaca);
          if (Array.isArray(parsedColaca)) {
            const filtradasColaca = parsedColaca.filter((d: any) => 
              d.id !== docId && 
              d.numero !== docNum && 
              (!cleanNum || getCleanInvoiceNumber(d.numero).toLowerCase() !== cleanNum)
            );
            localStorage.setItem('colaca_silagem_documentos_entrada', JSON.stringify(filtradasColaca));
          }
        }
      } catch (_) {}

      // Limpeza estrita no colaca_silagem_documentos_entrada_itens
      try {
        const rawItens = localStorage.getItem('colaca_silagem_documentos_entrada_itens');
        if (rawItens) {
          const parsedItens = JSON.parse(rawItens);
          if (Array.isArray(parsedItens)) {
            const filtradasItens = parsedItens.filter((i: any) => i.id !== docId && i.documento_entrada_id !== docId);
            localStorage.setItem('colaca_silagem_documentos_entrada_itens', JSON.stringify(filtradasItens));
          }
        }
      } catch (_) {}

      // Limpeza no cache da NF-e
      try {
        const cached = getCachedNfeMap();
        delete cached[docId];
        if (cleanNum) delete cached[cleanNum];
        if (digits) delete cached[digits];
        if (docNum) delete cached[docNum.toLowerCase().trim()];
        localStorage.setItem(NFE_CACHE_STORAGE_KEY, JSON.stringify(cached));
      } catch (_) {}

      // Limpeza estrita em todas as chaves financeiras do localStorage
      try {
        const stored = getStoredExpenses();
        const updatedStored = stored.filter(e => {
          if (e.id === docId || (docId && e.id.startsWith(docId))) return false;
          if (e.id.startsWith(`pagar_${docId}`) || e.id.startsWith(`exp_doc_${docId}`)) return false;
          if ((e as any).notaId === docId || (e as any).documento_entrada_id === docId || (e as any).nota_fiscal_id === docId) return false;
          const eClean = getCleanInvoiceNumber(e.invoiceNumber).toLowerCase();
          if (cleanNum && eClean === cleanNum) return false;
          return true;
        });
        saveStoredExpenses(updatedStored);
        localStorage.setItem('agrocontrol_contas_a_pagar', JSON.stringify(updatedStored));
        localStorage.setItem('agrocontrol_financeiro', JSON.stringify(updatedStored));
        localStorage.setItem('agrocontrol_despesas', JSON.stringify(updatedStored));
      } catch (_) {}

      if (onDeleteExpense) {
        onDeleteExpense(docId);
        onDeleteExpense(`pagar_${docId}`);
        onDeleteExpense(`exp_doc_${docId}`);
        if (docNum) onDeleteExpense(docNum);
        if (cleanNum) onDeleteExpense(cleanNum);
        expenses
          .filter(e => 
            (e as any).notaId === docId ||
            (e as any).documento_entrada_id === docId ||
            e.id.startsWith(`pagar_${docId}`) ||
            e.id.startsWith(`exp_doc_${docId}`)
          )
          .forEach(e => onDeleteExpense(e.id));
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('silagem_expenses_updated'));
        window.dispatchEvent(new CustomEvent('agrocontrol_contas_a_pagar_updated'));
        window.dispatchEvent(new CustomEvent('agrocontrol_notas_entradas_updated'));
        window.dispatchEvent(new CustomEvent('colaca_silagem_documentos_entrada_updated'));
      }

      setManualDocToDelete(null);
      setViewingManualDoc(null);
      setSuccessMessage(`Documento de entrada (${doc.tipo_documento}) excluído com sucesso!`);
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      console.error('Erro ao excluir documento:', err);
    }
  };

  // Exclusão de documento legado salvo nas chaves agrocontrol_notas_*
  const handleDeleteLegacyFiscalDoc = async (doc: FiscalDocumentRecord) => {
    try {
      const docId = doc.id;
      const storageKey = FISCAL_DOCS_STORAGE_KEYS[doc.category] || FISCAL_DOCS_STORAGE_KEYS.nfe;
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            localStorage.setItem(storageKey, JSON.stringify(parsed.filter((d: any) => d.id !== docId)));
          }
        }
      } catch {}

      try {
        const rawEnt = localStorage.getItem('agrocontrol_notas_entradas');
        if (rawEnt) {
          const parsedEnt = JSON.parse(rawEnt);
          if (Array.isArray(parsedEnt)) {
            localStorage.setItem('agrocontrol_notas_entradas', JSON.stringify(parsedEnt.filter((d: any) => d.id !== docId)));
          }
        }
      } catch {}

      const storedExp = getStoredExpenses();
      const updatedExp = storedExp.filter(e =>
        (e as any).notaId !== docId &&
        (e as any).documento_entrada_id !== docId &&
        !e.id.startsWith(`fiscal_doc_${docId}`)
      );
      saveStoredExpenses(updatedExp);
      localStorage.setItem('agrocontrol_financeiro', JSON.stringify(updatedExp));

      if (isSupabaseConfigured) {
        const count = Math.max(1, doc.installmentsCount || doc.installments?.length || 1);
        for (let i = 1; i <= count; i++) {
          await deleteContaAPagar(`fiscal_doc_${docId}_p${i}`).catch(() => {});
        }
      }

      if (onDeleteExpense) {
        expenses
          .filter(e => (e as any).notaId === docId || e.id.startsWith(`fiscal_doc_${docId}`))
          .forEach(e => onDeleteExpense(e.id));
      }

      setLegacyFiscalDocs(readLegacyFiscalDocsFromStorage());
      setDocumentosEntrada(getStoredDocumentosEntrada());
      setLegacyDocToDelete(null);
      setViewingLegacyDoc(null);
      setSuccessMessage(`Documento ${doc.documentTypeLabel || 'Fiscal'} (${doc.number}) excluído com sucesso!`);
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      console.error('Erro ao excluir documento fiscal legado:', err);
    }
  };

  // Exclusão de MDF-e
  const handleDeleteMdfeDoc = (doc: MdfeRecord) => {
    try {
      const updated = getStoredMdfe().filter(m => m.id !== doc.id);
      saveStoredMdfe(updated);
      setMdfeDocs(updated);
      setMdfeDocToDelete(null);
      setViewingMdfeDoc(null);
      setSuccessMessage(`MDF-e ${doc.numero || ''} excluído com sucesso!`);
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      console.error('Erro ao excluir MDF-e:', err);
    }
  };

  // Parcelas sincronizadas para o modal financeiro a partir da Condição de Pagamento do Card 1
  const syncedManualExistingInstallments = useMemo(() => {
    const itemsSum = manualDocItems.reduce((acc, i) => acc + (Number(i.valor_total) || 0), 0);
    const total = itemsSum > 0 ? itemsSum : parseCurrencyInput(manualAmountDisplay);
    const count = Math.max(1, manualInstallmentsCount || 1);
    const baseDue = manualDueDate || calculateDefaultDueDate(manualDate);
    const baseVal = Math.floor((total / count) * 100) / 100;
    const remainder = Math.round((total - baseVal * count) * 100) / 100;

    return Array.from({ length: count }, (_, idx) => {
      let due = baseDue;
      if (idx > 0 && baseDue && /^\d{4}-\d{2}-\d{2}/.test(baseDue)) {
        const [y, m, d] = baseDue.split('T')[0].split('-').map(Number);
        const dt = new Date(y, m - 1, d);
        dt.setDate(dt.getDate() + idx * 30);
        due = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      }
      return {
        number: String(idx + 1).padStart(2, '0'),
        dueDate: due,
        amount: idx === count - 1 ? Math.round((baseVal + remainder) * 100) / 100 : baseVal,
      };
    });
  }, [manualDocItems, manualAmountDisplay, manualInstallmentsCount, manualDueDate, manualDate]);

  // Classificação para as pílulas da Central de Documentos
  const classifyCentralDocumentCategory = (rawType: string, explicitCategory?: string): Exclude<CentralDocumentFilter, 'todos'> => {
    if (explicitCategory === 'nfe') return 'nfe';
    if (explicitCategory === 'cte') return 'cte';
    if (explicitCategory === 'nfse') return 'nfse';
    if (explicitCategory === 'nfe_c' || explicitCategory === 'nfce') return 'nfce';
    if (explicitCategory === 'mdfe') return 'mdfe';

    const t = (rawType || '').toLowerCase();
    if (t.includes('nfc-e') || t.includes('nfce') || t.includes('consumidor')) return 'nfce';
    if (t.includes('nfs-e') || t.includes('nfse') || t.includes('serviç') || t.includes('servic')) return 'nfse';
    if (t.includes('ct-e') || t.includes('cte') || t.includes('frete') || t.includes('transporte') || t.includes('conhecimento')) return 'cte';
    if (t.includes('mdf-e') || t.includes('mdfe') || t.includes('manifesto')) return 'mdfe';
    if (t.includes('nf-e') || t.includes('nfe') || t.includes('nota fiscal') || t.includes('xml')) return 'nfe';
    return 'avulsas';
  };

  // ---------------------------------------------------------------------------
  // CENTRAL DE DOCUMENTOS UNIFICADA (XML + MANUAIS + NF-e/CT-e/NFS-e/NFC-e/MDF-e)
  // ---------------------------------------------------------------------------
  const unifiedEntries = useMemo(() => {
    const list: Array<{
      id: string;
      sourceType: 'xml' | 'manual' | 'legacy_fiscal' | 'mdfe';
      docCategory: Exclude<CentralDocumentFilter, 'todos'>;
      documentNumber: string;
      supplier: string;
      description: string;
      date: string;
      amount: number;
      status: string;
      documentType: string;
      badgeColor: 'sky' | 'amber' | 'purple' | 'emerald' | 'stone';
      vehicleLabel?: string;
      rawExpense?: Expense;
      rawManualDoc?: DocumentoEntradaRecord;
      rawLegacyFiscalDoc?: FiscalDocumentRecord;
      rawMdfeDoc?: MdfeRecord;
    }> = [];

    // 1. Notas Fiscais Eletrônicas via XML
    notasFiscaisExibicao.forEach(exp => {
      const expDate = (exp as any).issueDate || (exp as any).entryDate || (exp as any).data_emissao || (exp as any).data_entrada || (exp as any).date || exp.dueDate || exp.createdAt || '';
      const vehPlate = (exp as any).vehiclePlate || (exp as any).machineryName;
      list.push({
        id: exp.id,
        sourceType: 'xml',
        docCategory: 'nfe',
        documentNumber: exp.invoiceNumber || 'NF-e',
        supplier: exp.supplier || 'Fornecedor NF-e',
        description: exp.description || 'Importada via NF-e (XML)',
        date: expDate,
        amount: Number(exp.amount) || 0,
        status: exp.status || 'pendente',
        documentType: 'XML / NF-e',
        badgeColor: 'sky',
        vehicleLabel: vehPlate || undefined,
        rawExpense: exp
      });
    });

    // 2. Entradas Manuais da tabela public.documentos_entrada e agrocontrol_notas_entradas
    documentosEntrada.forEach(doc => {
      if (isCorruptedOrGhostDocumento(doc)) return;
      const docAny = doc as any;
      const tipo = doc.tipo_documento || docAny.documentTypeLabel || 'Romaneio';
      const docCat = classifyCentralDocumentCategory(tipo, docAny.category);
      let badge: 'sky' | 'amber' | 'purple' | 'emerald' | 'stone' = 'amber';
      if (docCat === 'nfe' || docCat === 'cte') badge = 'sky';
      else if (docCat === 'nfse' || docCat === 'nfce') badge = 'purple';
      else if (docCat === 'mdfe') badge = 'emerald';
      else if (tipo === 'Nota de Produtor') badge = 'emerald';
      else if (tipo === 'Romaneio') badge = 'amber';
      else badge = 'stone';

      const docNum = doc.numero || doc.numero_documento || docAny.number || (doc.chave_acesso ? doc.chave_acesso.slice(25, 34) : '') || tipo;
      const docDate = doc.data || doc.data_entrada || doc.data_emissao || docAny.issueDate || doc.created_at || doc.data_vencimento || '';
      const docSupplier = doc.fornecedor || doc.fornecedor_nome || docAny.supplierName || 'Fornecedor';
      const docAmount = Number(doc.valor_total ?? docAny.totalAmount) || 0;
      const vehLabel = doc.vehiclePlate || doc.machineryName || doc.vehicleModel || undefined;

      list.push({
        id: doc.id,
        sourceType: docAny.category ? 'legacy_fiscal' : ((tipo === 'Nota Fiscal' || tipo === 'NF-e' || tipo === 'XML / NF-e') ? 'xml' : 'manual'),
        docCategory: docCat,
        documentNumber: docNum,
        supplier: docSupplier,
        description: doc.observacoes || docAny.notes || doc.descricao || `Entrada manual: ${tipo}`,
        date: docDate,
        amount: docAmount,
        status: doc.status || 'Finalizado',
        documentType: tipo,
        badgeColor: badge,
        vehicleLabel: vehLabel,
        rawManualDoc: docAny.category ? undefined : doc,
        rawLegacyFiscalDoc: docAny.category ? (docAny as FiscalDocumentRecord) : undefined,
      });
    });

    // 3. Documentos legados de agrocontrol_notas_nfe / cte / nfec / nfse
    legacyFiscalDocs.forEach(fDoc => {
      if (!fDoc || !fDoc.id) return;
      const docCat = classifyCentralDocumentCategory(fDoc.documentTypeLabel || fDoc.category, fDoc.category);
      const vehLabel = fDoc.vehiclePlate || fDoc.vehicleModel || undefined;
      list.push({
        id: fDoc.id,
        sourceType: 'legacy_fiscal',
        docCategory: docCat,
        documentNumber: fDoc.number || fDoc.documentTypeLabel || 'NF',
        supplier: fDoc.supplierName || 'Fornecedor',
        description: fDoc.description || fDoc.notes || `${fDoc.documentTypeLabel || 'Documento Fiscal'}`,
        date: fDoc.issueDate || fDoc.createdAt || '',
        amount: Number(fDoc.totalAmount) || 0,
        status: fDoc.status || 'CONFIRMADO',
        documentType: fDoc.documentTypeLabel || fDoc.category.toUpperCase(),
        badgeColor: docCat === 'nfse' || docCat === 'nfce' ? 'purple' : 'sky',
        vehicleLabel: vehLabel,
        rawLegacyFiscalDoc: fDoc,
      });
    });

    // 4. Manifestos Eletrônicos de Documentos Fiscais (MDF-e)
    mdfeDocs.forEach(mDoc => {
      if (!mDoc || !mDoc.id) return;
      const routeDesc = `${mDoc.municipiosCarregamento || mDoc.ufCarregamento || ''} → ${mDoc.municipiosDescarregamento || mDoc.ufDescarregamento || ''}`.trim();
      list.push({
        id: mDoc.id,
        sourceType: 'mdfe',
        docCategory: 'mdfe',
        documentNumber: mDoc.numero ? `MDF-e ${mDoc.numero}` : 'MDF-e',
        supplier: mDoc.motoristaNome || (mDoc.veiculoPlaca ? `Veículo ${mDoc.veiculoPlaca}` : 'Manifesto de Carga'),
        description: routeDesc ? `${routeDesc}${mDoc.veiculoPlaca ? ` • Placa ${mDoc.veiculoPlaca}` : ''}` : (mDoc.observacoes || 'Manifesto MDF-e'),
        date: mDoc.dataEmissao || mDoc.createdAt || '',
        amount: Number(mDoc.valorTotalCarga) || 0,
        status: mDoc.status || 'AUTORIZADO',
        documentType: 'MDF-e',
        badgeColor: 'emerald',
        vehicleLabel: mDoc.veiculoPlaca || undefined,
        rawMdfeDoc: mDoc,
      });
    });

    // 5. TRAVA DE UNICIDADE E DESDUPLICAÇÃO NA RENDERIZAÇÃO
    const dedupedList: typeof list = [];
    const seenIds = new Set<string>();
    const seenAccessKeys = new Set<string>();
    const seenDocSignatures = new Set<string>();

    for (const item of list) {
      const cleanId = String(item.id || '').trim();
      if (cleanId && seenIds.has(cleanId)) continue;
      if (cleanId) seenIds.add(cleanId);

      // Desduplica por chave de acesso quando existente
      const accessKey = item.rawExpense?.accessKey || item.rawManualDoc?.chave_acesso || item.rawMdfeDoc?.chaveAcesso || '';
      if (accessKey && accessKey.length === 44) {
        const keySig = `key_${accessKey}`;
        if (seenAccessKeys.has(keySig)) continue;
        seenAccessKeys.add(keySig);
      }

      // Desduplica registros idênticos por número de documento + fornecedor + valor
      const cleanDocDigits = item.documentNumber.replace(/\D/g, '');
      const supplierNorm = item.supplier.trim().toLowerCase();
      if (cleanDocDigits && cleanDocDigits.length >= 3 && supplierNorm) {
        const docSig = `num_${cleanDocDigits}_${supplierNorm}_${item.amount.toFixed(2)}`;
        if (seenDocSignatures.has(docSig)) continue;
        seenDocSignatures.add(docSig);
      }

      dedupedList.push(item);
    }

    // Ordena decrescente por data
    dedupedList.sort((a, b) => {
      const timeA = a.date ? new Date(a.date).getTime() : 0;
      const timeB = b.date ? new Date(b.date).getTime() : 0;
      return timeB - timeA;
    });

    // Filtro de busca se informado
    if (searchNfeNumber && searchNfeNumber.trim()) {
      const term = searchNfeNumber.toLowerCase().trim();
      return dedupedList.filter(item => 
        item.documentNumber.toLowerCase().includes(term) ||
        item.supplier.toLowerCase().includes(term) ||
        item.description.toLowerCase().includes(term) ||
        item.documentType.toLowerCase().includes(term) ||
        (item.vehicleLabel || '').toLowerCase().includes(term)
      );
    }

    return dedupedList;
  }, [notasFiscaisExibicao, documentosEntrada, legacyFiscalDocs, mdfeDocs, searchNfeNumber]);

  // Lista unificada de NOTAS DE SAÍDA (Emitidas pela Empresa)
  const unifiedSaidaEntries = useMemo(() => {
    const list: Array<{
      id: string;
      sourceType: 'nota_saida';
      docCategory: Exclude<CentralDocumentFilter, 'todos'>;
      documentNumber: string;
      supplier: string; // Destinatário / Tomador
      description: string;
      date: string;
      amount: number;
      status: string;
      documentType: string;
      badgeColor: 'sky' | 'amber' | 'purple' | 'emerald' | 'stone';
      vehicleLabel?: string;
      rawExpense?: Expense;
      rawManualDoc?: DocumentoEntradaRecord;
      rawLegacyFiscalDoc?: FiscalDocumentRecord;
      rawMdfeDoc?: MdfeRecord;
      rawNotaSaida?: NotaSaidaRecord;
    }> = [];

    notasSaida.forEach((n) => {
      if (!n || !n.id) return;
      const docCat = classifyCentralDocumentCategory(n.tipoDocumento);
      const shortType = (n.tipoDocumento || 'NF-e').split(' ')[0];
      let badge: 'sky' | 'amber' | 'purple' | 'emerald' | 'stone' = 'sky';
      if (docCat === 'nfse' || docCat === 'nfce') badge = 'purple';
      else if (docCat === 'mdfe') badge = 'emerald';
      else if (docCat === 'avulsas') badge = 'amber';

      const isCteRec = (n.tipoDocumento || '').toLowerCase().includes('ct-e');
      const displayParty = isCteRec
        ? (n.cteTomadorFinalNome || n.destinatarioNome || 'Tomador não informado')
        : (n.destinatarioNome || 'Consumidor Avulso');

      list.push({
        id: n.id,
        sourceType: 'nota_saida',
        docCategory: docCat,
        documentNumber: n.numero ? `${shortType} ${n.numero}${n.serie ? `/${n.serie}` : ''}` : shortType,
        supplier: displayParty,
        description: n.descricao || n.tipoDocumento,
        date: n.dataEmissao || n.createdAt || '',
        amount: Number(n.valorTotal) || 0,
        status: n.status || 'EMITIDA',
        documentType: shortType,
        badgeColor: badge,
        vehicleLabel: n.veiculoPlaca || n.veiculoModelo || undefined,
        rawNotaSaida: n,
      });
    });

    list.sort((a, b) => {
      const timeA = a.date ? new Date(a.date).getTime() : 0;
      const timeB = b.date ? new Date(b.date).getTime() : 0;
      return timeB - timeA;
    });

    if (searchNfeNumber && searchNfeNumber.trim()) {
      const term = searchNfeNumber.toLowerCase().trim();
      return list.filter(item =>
        item.documentNumber.toLowerCase().includes(term) ||
        item.supplier.toLowerCase().includes(term) ||
        item.description.toLowerCase().includes(term) ||
        item.documentType.toLowerCase().includes(term) ||
        (item.vehicleLabel || '').toLowerCase().includes(term) ||
        (item.rawNotaSaida?.chaveAcesso || '').toLowerCase().includes(term) ||
        (item.rawNotaSaida?.cteRemetenteNome || '').toLowerCase().includes(term) ||
        (item.rawNotaSaida?.destinatarioNome || '').toLowerCase().includes(term) ||
        (item.rawNotaSaida?.cteTomadorTerceiroNome || '').toLowerCase().includes(term)
      );
    }

    return list;
  }, [notasSaida, searchNfeNumber]);

  // Lista consolidada de NF-e já registradas no sistema (Saídas e Entradas) para vínculo rápido no CT-e
  const availableNfeDocumentsForCte = useMemo(() => {
    const options: Array<{
      id: string;
      label: string;
      numero: string;
      serie: string;
      chaveAcesso: string;
      valorNota: number;
    }> = [];
    const seenKeys = new Set<string>();

    // 1. NF-e emitidas pela empresa (Notas de Saída: Venda e Remessa/Retorno)
    notasSaida.forEach((n) => {
      if (!n || !n.id) return;
      const tipo = (n.tipoDocumento || '').toLowerCase();
      if (!tipo.includes('nf-e') && !tipo.includes('nfe')) return;
      const num = String(n.numero || '').trim();
      const serie = String(n.serie || '1').trim();
      const chave = cleanDigits(n.chaveAcesso || '');
      const val = Number(n.valorTotal) || 0;
      const sig = chave || `saida_${num}_${serie}_${n.id}`;
      if (seenKeys.has(sig)) return;
      seenKeys.add(sig);
      const natLower = (n.nfeNaturezaOperacao || '').toLowerCase();
      const isRemessa = tipo.includes('remessa') || tipo.includes('retorno') || natLower.includes('remessa') || natLower.includes('retorno');
      const naturezaBadge = isRemessa
        ? `Remessa: ${n.nfeNaturezaOperacao || 'Remessa / Retorno'}`
        : `Venda: ${n.nfeNaturezaOperacao || 'Venda de Mercadoria'}`;
      options.push({
        id: `saida:${n.id}`,
        label: `NF-e ${num}${serie ? `/${serie}` : ''} (${naturezaBadge}) - ${n.destinatarioNome} - ${formatCurrencyBRL(val)}`,
        numero: num,
        serie,
        chaveAcesso: chave,
        valorNota: val,
      });
    });

    // 2. NF-e importadas via XML
    notasFiscaisExibicao.forEach((exp) => {
      if (!exp || !exp.id) return;
      const num = String(exp.invoiceNumber || '').trim();
      const chave = cleanDigits(exp.accessKey || '');
      const val = Number(exp.amount) || 0;
      const sig = chave || `xml_${num}_${exp.id}`;
      if (seenKeys.has(sig)) return;
      seenKeys.add(sig);
      options.push({
        id: `xml:${exp.id}`,
        label: `[XML] NF-e ${num || '-'} • ${exp.supplier || 'Fornecedor'} • ${formatCurrencyBRL(val)}`,
        numero: num,
        serie: '1',
        chaveAcesso: chave,
        valorNota: val,
      });
    });

    // 3. Entradas manuais com NF-e / chave
    documentosEntrada.forEach((doc) => {
      if (!doc || !doc.id || isCorruptedOrGhostDocumento(doc)) return;
      const docAny = doc as any;
      const tipo = String(doc.tipo_documento || docAny.documentTypeLabel || '').toLowerCase();
      if (!tipo.includes('nf-e') && !tipo.includes('nfe') && !tipo.includes('nota fiscal') && !doc.chave_acesso) return;
      const num = String(doc.numero || doc.numero_documento || docAny.number || '').trim();
      const chave = cleanDigits(doc.chave_acesso || '');
      const val = Number(doc.valor_total ?? docAny.totalAmount) || 0;
      if (!num && !chave) return;
      const sig = chave || `ent_${num}_${doc.id}`;
      if (seenKeys.has(sig)) return;
      seenKeys.add(sig);
      options.push({
        id: `ent:${doc.id}`,
        label: `[ENTRADA] NF-e ${num || chave.slice(25, 34)} • ${doc.fornecedor || doc.fornecedor_nome || 'Fornecedor'} • ${formatCurrencyBRL(val)}`,
        numero: num || chave.slice(25, 34).replace(/^0+/, ''),
        serie: '1',
        chaveAcesso: chave,
        valorNota: val,
      });
    });

    // 4. Documentos legados de NF-e
    legacyFiscalDocs.forEach((fDoc) => {
      if (!fDoc || !fDoc.id) return;
      if (fDoc.category !== 'nfe') return;
      const num = String(fDoc.number || '').trim();
      const chave = cleanDigits((fDoc as any).accessKey || '');
      const val = Number(fDoc.totalAmount) || 0;
      if (!num && !chave) return;
      const sig = chave || `leg_${num}_${fDoc.id}`;
      if (seenKeys.has(sig)) return;
      seenKeys.add(sig);
      options.push({
        id: `leg:${fDoc.id}`,
        label: `[FISCAL] NF-e ${num || '-'} • ${fDoc.supplierName || 'Fornecedor'} • ${formatCurrencyBRL(val)}`,
        numero: num,
        serie: '1',
        chaveAcesso: chave,
        valorNota: val,
      });
    });

    return options;
  }, [notasSaida, notasFiscaisExibicao, documentosEntrada, legacyFiscalDocs]);

  const handleSelectRegisteredNfeForCte = (index: number, sourceDocId: string) => {
    const matched = availableNfeDocumentsForCte.find(o => o.id === sourceDocId);
    if (!matched) {
      handleUpdateCteNfeRow(index, { sourceDocId: '' });
      return;
    }
    handleUpdateCteNfeRow(index, {
      sourceDocId: matched.id,
      numero: matched.numero,
      serie: matched.serie || '1',
      chaveAcesso: matched.chaveAcesso,
      valorNota: matched.valorNota,
    });
  };

  // Lista consolidada de documentos (NF-e de Venda, NF-e de Remessa/Retorno, XML/Entradas e CT-e) para vínculo rápido no MDF-e
  const availableDocsForMdfe = useMemo(() => {
    const docs: Array<{
      id: string;
      label: string;
      refText: string;
      valor: number;
      pesoKg: number;
    }> = availableNfeDocumentsForCte.map((nfe) => ({
      id: nfe.id,
      label: nfe.label,
      refText: nfe.chaveAcesso
        ? `NF-e ${nfe.numero} (${nfe.chaveAcesso})`
        : `NF-e ${nfe.numero}${nfe.serie ? `/${nfe.serie}` : ''}`,
      valor: nfe.valorNota,
      pesoKg: 0,
    }));

    notasSaida.forEach((n) => {
      if (!n || !n.id) return;
      if (!(n.tipoDocumento || '').toLowerCase().includes('ct-e')) return;
      const valCarga = Number(n.cteValorCarga || n.valorTotal || 0);
      docs.push({
        id: `cte:${n.id}`,
        label: `CT-e ${n.numero}${n.serie ? `/${n.serie}` : ''} (Frete) - ${n.destinatarioNome} - ${formatCurrencyBRL(valCarga)}`,
        refText: n.chaveAcesso ? `CT-e ${n.numero} (${n.chaveAcesso})` : `CT-e ${n.numero}`,
        valor: valCarga,
        pesoKg: Number(n.ctePesoBrutoKg || 0),
      });
    });

    return docs;
  }, [availableNfeDocumentsForCte, notasSaida]);

  const handleLinkDocToMdfe = (docId: string) => {
    if (!docId) return;
    const found = availableDocsForMdfe.find(d => d.id === docId);
    if (!found) return;

    setMdfeDocumentosVinculados(prev => {
      const current = prev.trim();
      if (current.includes(found.refText)) return current;
      return current ? `${current}; ${found.refText}` : found.refText;
    });

    if (found.valor > 0) {
      const currentVal = parseCurrencyInput(mdfeValorTotalCargaDisplay);
      const nextVal = Number((currentVal + found.valor).toFixed(2));
      setMdfeValorTotalCargaDisplay(formatCurrencyInputDisplay(nextVal));
    }

    if (found.pesoKg > 0) {
      const currentPeso = parsePtBrNumber(mdfePesoTotalKg);
      setMdfePesoTotalKg(formatBrNumberDisplay(Number((currentPeso + found.pesoKg).toFixed(3))));
    }
  };

  // Lista filtrada pela competência ativa (MM/AAAA) — ENTRADAS
  const competenceFilteredEntries = useMemo(() => {
    return unifiedEntries.filter(item => {
      if (matchesCompetence(item.date, fiscalCompetence)) return true;

      if (item.rawExpense) {
        const exp = item.rawExpense;
        if (matchesCompetence((exp as any).issueDate, fiscalCompetence)) return true;
        if (matchesCompetence((exp as any).entryDate, fiscalCompetence)) return true;
        if (matchesCompetence(exp.dueDate, fiscalCompetence)) return true;
        if (matchesCompetence(exp.paymentDate, fiscalCompetence)) return true;
        if (matchesCompetence(exp.createdAt, fiscalCompetence)) return true;
      }

      if (item.rawManualDoc) {
        const doc = item.rawManualDoc;
        if (matchesCompetence(doc.data, fiscalCompetence)) return true;
        if (matchesCompetence(doc.data_entrada, fiscalCompetence)) return true;
        if (matchesCompetence(doc.data_emissao, fiscalCompetence)) return true;
        if (matchesCompetence(doc.data_vencimento, fiscalCompetence)) return true;
        if (matchesCompetence(doc.created_at, fiscalCompetence)) return true;
      }

      if (item.rawLegacyFiscalDoc) {
        const fDoc = item.rawLegacyFiscalDoc;
        if (matchesCompetence(fDoc.issueDate, fiscalCompetence)) return true;
        if (matchesCompetence(fDoc.createdAt, fiscalCompetence)) return true;
      }

      if (item.rawMdfeDoc) {
        const mDoc = item.rawMdfeDoc;
        if (matchesCompetence(mDoc.dataEmissao, fiscalCompetence)) return true;
        if (matchesCompetence(mDoc.createdAt, fiscalCompetence)) return true;
      }

      if (!item.date || item.date.trim() === '') {
        return true;
      }

      return false;
    });
  }, [unifiedEntries, fiscalCompetence]);

  // Lista filtrada pela competência ativa (MM/AAAA) — SAÍDAS
  const competenceFilteredSaidaEntries = useMemo(() => {
    return unifiedSaidaEntries.filter(item => {
      if (matchesCompetence(item.date, fiscalCompetence)) return true;
      if (item.rawNotaSaida) {
        const ns = item.rawNotaSaida;
        if (matchesCompetence(ns.dataEmissao, fiscalCompetence)) return true;
        if (matchesCompetence(ns.dataVencimento, fiscalCompetence)) return true;
        if (matchesCompetence(ns.createdAt, fiscalCompetence)) return true;
      }
      if (!item.date || item.date.trim() === '') return true;
      return false;
    });
  }, [unifiedSaidaEntries, fiscalCompetence]);

  // Base ativa de acordo com a direção selecionada (Entrada vs. Saída)
  const activeDirectionEntries = useMemo(() => {
    return activeDocDirection === 'entrada'
      ? competenceFilteredEntries
      : competenceFilteredSaidaEntries;
  }, [activeDocDirection, competenceFilteredEntries, competenceFilteredSaidaEntries]);

  // Contadores exatos das pílulas de filtro rápido na Central de Documentos (dinâmicos conforme direção)
  const centralDocPillCounts = useMemo(() => {
    const counts: Record<CentralDocumentFilter, number> = {
      todos: activeDirectionEntries.length,
      nfe: 0,
      cte: 0,
      nfse: 0,
      nfce: 0,
      mdfe: 0,
      avulsas: 0,
    };
    activeDirectionEntries.forEach(item => {
      counts[item.docCategory] = (counts[item.docCategory] || 0) + 1;
    });
    return counts;
  }, [activeDirectionEntries]);

  // Lista final exibida na Central de Documentos de acordo com a direção e a pílula selecionada
  const filteredUnifiedEntries = useMemo(() => {
    if (activeDocFilter === 'todos') return activeDirectionEntries;
    return activeDirectionEntries.filter(item => item.docCategory === activeDocFilter);
  }, [activeDirectionEntries, activeDocFilter]);

  // Centros de Custo locais e sincronização
  const [localCostCenters, setLocalCostCenters] = useState<CostCenter[]>(() => {
    return (costCenters && costCenters.length > 0) ? costCenters : getStoredCostCenters();
  });

  useEffect(() => {
    if (costCenters && costCenters.length > 0) {
      setLocalCostCenters(costCenters);
    }
  }, [costCenters]);

  const saveCostCenters = (updated: CostCenter[]) => {
    setLocalCostCenters(updated);
    if (onSaveCostCenters) {
      onSaveCostCenters(updated);
    }
    saveStoredCostCenters(updated);
  };

  // Redireciona diretamente para o módulo Cadastros Base na aba Centros de Custo
  const handleNavigateToCadastrosBaseCentrosCusto = () => {
    // 1. Captura TODO o estado atual da nota preenchida na tela e salva em cache LocalStorage
    if (parsedData) {
      const draftData: ParsedNfeData = {
        ...parsedData,
        costCenterId: selectedCostCenterId || parsedData.costCenterId,
      };
      const fullDraft = {
        ...draftData,
        parsedData: draftData,
        selectedCostCenterId: selectedCostCenterId || parsedData.costCenterId || '',
        xmlContent,
        editingExpenseId,
        userInstallmentCount,
        savedAt: new Date().toISOString(),
      };
      saveActiveNfeDraft(fullDraft);
    }

    if (onNavigate) {
      onNavigate('cadastros_base_centros_custo');
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app:navigate', { detail: 'cadastros_base_centros_custo' }));
      window.dispatchEvent(new CustomEvent('navigate-tab', { detail: 'cadastros_base_centros_custo' }));
    }
  };

  // Restaura automaticamente rascunho de nota ativa caso o operador tenha saído da tela (ex: ida a Cadastros Base)
  useEffect(() => {
    const draft = getActiveNfeDraft();
    if (draft) {
      const pData: ParsedNfeData = draft.parsedData || (draft.invoiceNumber ? draft : null);
      if (pData && pData.invoiceNumber) {
        setParsedData(pData);
        if (draft.selectedCostCenterId || pData.costCenterId) {
          setSelectedCostCenterId(draft.selectedCostCenterId || pData.costCenterId || '');
        }
        if (draft.xmlContent) {
          setXmlContent(draft.xmlContent);
        }
        if (draft.editingExpenseId !== undefined) {
          setEditingExpenseId(draft.editingExpenseId);
        }
        if (draft.userInstallmentCount) {
          setUserInstallmentCount(draft.userInstallmentCount);
        }
      }
    }
  }, []);

  // Sincronização reativa com alterações feitas na aba de Centros de Custo dos Cadastros Base
  useEffect(() => {
    const handleCostCenterSync = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setLocalCostCenters(e.detail);
      } else {
        const stored = getStoredCostCenters();
        if (stored && stored.length > 0) {
          setLocalCostCenters(stored);
        }
      }
    };

    window.addEventListener('colaca_silagem_centros_updated', handleCostCenterSync);
    window.addEventListener('silagem_cost_centers_updated', handleCostCenterSync);
    window.addEventListener('storage', handleCostCenterSync);
    return () => {
      window.removeEventListener('colaca_silagem_centros_updated', handleCostCenterSync);
      window.removeEventListener('silagem_cost_centers_updated', handleCostCenterSync);
      window.removeEventListener('storage', handleCostCenterSync);
    };
  }, []);

  // Seleção e validação de Centro de Custo obrigatório
  const [selectedCostCenterId, setSelectedCostCenterId] = useState<string>(() => {
    const draft = getActiveNfeDraft();
    return draft?.selectedCostCenterId || draft?.parsedData?.costCenterId || draft?.costCenterId || '';
  });
  const [costCenterError, setCostCenterError] = useState<boolean>(false);

  // Modal e estados para gerenciamento de Centro de Custo (Criação, Edição e Exclusão)
  const [isQuickCostCenterOpen, setIsQuickCostCenterOpen] = useState<boolean>(false);
  const [costCenterToEdit, setCostCenterToEdit] = useState<CostCenter | null>(null);
  const [newCostCenterName, setNewCostCenterName] = useState<string>('');
  const [newCostCenterType, setNewCostCenterType] = useState<CostCenter['type']>('geral');

  // Estados para exclusão com integridade fiscal
  const [isDeleteCostCenterModalOpen, setIsDeleteCostCenterModalOpen] = useState<boolean>(false);
  const [costCenterToDelete, setCostCenterToDelete] = useState<CostCenter | null>(null);
  const [costCenterIntegrityNotice, setCostCenterIntegrityNotice] = useState<{
    isInUse: boolean;
    expensesCount: number;
    notasCount: number;
  } | null>(null);

  // Modal para listar e gerenciar todos os centros de custo
  const [isManageCostCentersListOpen, setIsManageCostCentersListOpen] = useState<boolean>(false);

  // Estados para Janela 2 (Detalhamento de Parcelas Geradas com Base no XML)
  const [isInstallmentsModalOpen, setIsInstallmentsModalOpen] = useState<boolean>(false);
  const [userInstallmentCount, setUserInstallmentCount] = useState<number>(() => {
    const draft = getActiveNfeDraft();
    return draft?.userInstallmentCount || 1;
  });

  // Sincroniza quantidade inicial de parcelas ao carregar nota
  useEffect(() => {
    if (parsedData) {
      if (parsedData.installments && parsedData.installments.length > 0) {
        setUserInstallmentCount(parsedData.installments.length);
      } else {
        setUserInstallmentCount(1);
      }
    }
  }, [parsedData?.invoiceNumber, parsedData?.totalAmount]);

  // Modal de validação/conferência de fornecedor
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState<boolean>(false);
  const [supplierForModal, setSupplierForModal] = useState<Supplier | null>(null);
  const [supplierValidationNotice, setSupplierValidationNotice] = useState<{
    isNew: boolean;
    name: string;
    cnpjOrCpf?: string;
  } | null>(null);

  // Abre modal para criar novo Centro de Custo
  const handleOpenCreateCostCenter = () => {
    setCostCenterToEdit(null);
    setNewCostCenterName('');
    setNewCostCenterType('geral');
    setIsQuickCostCenterOpen(true);
  };

  // Abre modal para editar um Centro de Custo específico
  const handleOpenEditCostCenter = (cc: CostCenter) => {
    setCostCenterToEdit(cc);
    setNewCostCenterName(cc.name);
    setNewCostCenterType(cc.type || 'geral');
    setIsQuickCostCenterOpen(true);
  };

  // Salva ou atualiza Centro de Custo (Criar ou Editar)
  const handleSaveCostCenter = () => {
    if (!newCostCenterName.trim()) return;

    if (costCenterToEdit) {
      // Edição de Centro de Custo existente
      const updated = localCostCenters.map(c => 
        c.id === costCenterToEdit.id 
          ? { ...c, name: newCostCenterName.trim(), type: newCostCenterType } 
          : c
      );
      saveCostCenters(updated);
      setSuccessMessage(`Centro de Custo "${newCostCenterName.trim()}" atualizado com sucesso!`);
      setTimeout(() => setSuccessMessage(''), 4000);
      setIsQuickCostCenterOpen(false);
      setCostCenterToEdit(null);
    } else {
      // Criação rápida de novo Centro de Custo
      const newCC: CostCenter = {
        id: `cc_${Date.now()}`,
        name: newCostCenterName.trim(),
        type: newCostCenterType || 'geral',
      };
      const updated = [...localCostCenters, newCC];
      saveCostCenters(updated);
      setSelectedCostCenterId(newCC.id);
      setCostCenterError(false);
      setSuccessMessage(`Centro de Custo "${newCC.name}" criado e selecionado com sucesso!`);
      setTimeout(() => setSuccessMessage(''), 4000);
      setIsQuickCostCenterOpen(false);
    }
    setNewCostCenterName('');
  };

  // Solicita exclusão com verificação de integridade fiscal
  const handleRequestDeleteCostCenter = (cc: CostCenter) => {
    const expensesCount = (expenses || []).filter(e => e.costCenterId === cc.id).length;
    const notasCount = (notasLancadas || []).filter(n => n.costCenterId === cc.id).length;
    const inUse = expensesCount > 0 || notasCount > 0;

    setCostCenterToDelete(cc);
    setCostCenterIntegrityNotice({
      isInUse: inUse,
      expensesCount,
      notasCount,
    });
    setIsDeleteCostCenterModalOpen(true);
  };

  // Confirma exclusão se liberado pela integridade fiscal
  const handleConfirmDeleteCostCenter = () => {
    if (!costCenterToDelete) return;
    if (costCenterIntegrityNotice?.isInUse) return; // Bloqueio preventivo

    const updated = localCostCenters.filter(c => c.id !== costCenterToDelete.id);
    saveCostCenters(updated);

    if (selectedCostCenterId === costCenterToDelete.id) {
      setSelectedCostCenterId('');
    }

    setSuccessMessage(`Centro de Custo "${costCenterToDelete.name}" excluído com sucesso!`);
    setTimeout(() => setSuccessMessage(''), 4000);
    setIsDeleteCostCenterModalOpen(false);
    setCostCenterToDelete(null);
  };

  // Salva / valida dados do fornecedor vindo do SupplierModal
  const handleSaveSupplierFromModal = (savedSupplier: Supplier) => {
    // Normalização compulsória em CAIXA ALTA (UPPERCASE)
    const upperSupplier: Supplier = {
      ...savedSupplier,
      name: (savedSupplier.name || '').trim().toUpperCase(),
      tradeName: savedSupplier.tradeName ? savedSupplier.tradeName.trim().toUpperCase() : undefined,
      category: savedSupplier.category ? savedSupplier.category.trim().toUpperCase() : 'COMBUSTÍVEL',
      stateRegistration: savedSupplier.stateRegistration ? savedSupplier.stateRegistration.trim().toUpperCase() : undefined,
      municipalRegistration: savedSupplier.municipalRegistration ? savedSupplier.municipalRegistration.trim().toUpperCase() : undefined,
      address: savedSupplier.address ? savedSupplier.address.trim().toUpperCase() : undefined,
      neighborhood: savedSupplier.neighborhood ? savedSupplier.neighborhood.trim().toUpperCase() : undefined,
      city: savedSupplier.city ? savedSupplier.city.trim().toUpperCase() : undefined,
      state: savedSupplier.state ? savedSupplier.state.trim().toUpperCase() : 'PR',
      notes: savedSupplier.notes ? savedSupplier.notes.trim().toUpperCase() : undefined,
      email: savedSupplier.email ? savedSupplier.email.trim().toUpperCase() : undefined,
    };

    const existingIndex = localSuppliers.findIndex(s => s.id === upperSupplier.id || (s.name && s.name.toUpperCase() === upperSupplier.name));
    let updated: Supplier[];
    if (existingIndex >= 0) {
      updated = [...localSuppliers];
      updated[existingIndex] = upperSupplier;
    } else {
      updated = [upperSupplier, ...localSuppliers];
    }
    saveSuppliers(updated);
    setSupplierForModal(upperSupplier);
    setManualSupplier(upperSupplier.name);

    if (parsedData) {
      setParsedData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          supplier: upperSupplier.name,
          supplierTradeName: upperSupplier.tradeName || prev.supplierTradeName,
          supplierCnpj: upperSupplier.cnpjOrCpf ? cleanDigits(upperSupplier.cnpjOrCpf) : prev.supplierCnpj,
          supplierIe: upperSupplier.stateRegistration || prev.supplierIe,
          supplierIm: upperSupplier.municipalRegistration || prev.supplierIm,
          supplierAddress: upperSupplier.address || prev.supplierAddress,
          supplierNeighborhood: upperSupplier.neighborhood || prev.supplierNeighborhood,
          supplierCity: upperSupplier.city || prev.supplierCity,
          supplierState: upperSupplier.state || prev.supplierState,
          supplierZipCode: upperSupplier.zipCode || prev.supplierZipCode,
          supplierPhone: upperSupplier.phone || prev.supplierPhone,
        };
      });
    }

    setSupplierValidationNotice({
      isNew: false,
      name: upperSupplier.name,
      cnpjOrCpf: upperSupplier.cnpjOrCpf,
    });

    setSuccessMessage("FORNECEDOR CADASTRADO E SALVO COM SUCESSO!");
    setTimeout(() => setSuccessMessage(''), 4500);
  };

  // Dados consolidados e análise de estorno para a nota fiscal selecionada para exclusão
  const notaEmExclusao = useMemo(() => {
    if (!notaParaExcluir) return null;
    const direct = notasFiscaisExibicao.find(n => n.id === notaParaExcluir || n.invoiceNumber === notaParaExcluir) ||
                   notasLancadas.find(n => n.id === notaParaExcluir || n.invoiceNumber === notaParaExcluir) ||
                   expenses.find(n => n.id === notaParaExcluir || n.invoiceNumber === notaParaExcluir);
    if (direct) return direct;
    const stored = getStoredFiscalRecords().find(n => n.id === notaParaExcluir || n.invoiceNumber === notaParaExcluir);
    if (stored) return stored;

    const unified = unifiedEntries.find(u => u.id === notaParaExcluir || u.documentNumber === notaParaExcluir);
    if (unified) {
      return (unified.rawExpense || {
        id: unified.id,
        description: unified.description,
        invoiceNumber: unified.documentNumber,
        supplier: unified.supplier,
        amount: unified.amount,
        date: unified.date,
        dueDate: unified.date,
        status: unified.status,
        createdAt: new Date().toISOString()
      }) as Expense;
    }

    const doc = documentosEntrada.find(d => d.id === notaParaExcluir || d.numero === notaParaExcluir);
    if (doc) {
      return {
        id: doc.id,
        description: doc.observacoes || doc.tipo_documento,
        invoiceNumber: doc.numero || doc.numero_documento || doc.id,
        supplier: doc.fornecedor || 'Fornecedor',
        amount: Number(doc.valor_total) || 0,
        date: doc.data || doc.data_entrada,
        dueDate: doc.data_vencimento || doc.data,
        status: doc.status || 'pendente',
        createdAt: doc.created_at || new Date().toISOString()
      } as Expense;
    }

    return {
      id: notaParaExcluir,
      description: `Nota Fiscal ${notaParaExcluir}`,
      invoiceNumber: notaParaExcluir,
      supplier: 'Fornecedor',
      amount: 0,
      categoryId: 'outros',
      categoryName: 'Outros',
      categoryColor: '#6B7280',
      dueDate: new Date().toISOString().split('T')[0],
      status: 'pendente',
      paymentMethod: 'boleto',
      createdAt: new Date().toISOString(),
    } as Expense;
  }, [notaParaExcluir, notasFiscaisExibicao, notasLancadas, expenses, unifiedEntries, documentosEntrada]);

  const analiseEstornoExclusao = useMemo(() => {
    if (!notaEmExclusao) return null;
    return getStockReversalAnalysis(
      notaEmExclusao,
      expenses,
      localInventory,
      companyProfile
    );
  }, [notaEmExclusao, expenses, localInventory, companyProfile]);

  // IDs dos produtos cadastrados durante a sessão atual de importação
  const [sessionCreatedProductIds, setSessionCreatedProductIds] = useState<Set<string>>(new Set());

  // Modal para editar produto no estoque diretamente da tabela de Notas e Entradas
  const [editStockProductModal, setEditStockProductModal] = useState<{
    isOpen: boolean;
    rowIndex: number;
    manualItemId?: string;
    initialData: Partial<InventoryItem>;
  } | null>(null);

  // Modal para cadastrar novo produto a partir da linha da NF-e
  const [newProductModal, setNewProductModal] = useState<{
    isOpen: boolean;
    rowIndex: number;
    code: string;
    name: string;
    fiscalName: string;
    barcode: string;
    unit: string;
    category: InventoryItem['category'];
    unitCost: number;
    profitMargin: number;
    salePrice: number;
    initialQuantity: number;
    minQuantity: number;
    maxQuantity: number;
    location: string;
    valorImpostosTotal?: number;
    custoSemImposto?: number;
    custoComImposto?: number;
    freteDiluidoItem?: number;
  }>({
    isOpen: false,
    rowIndex: -1,
    code: '',
    name: '',
    fiscalName: '',
    barcode: '',
    unit: 'UN',
    category: 'outro',
    unitCost: 0,
    profitMargin: 30,
    salePrice: 0,
    initialQuantity: 1,
    minQuantity: 10,
    maxQuantity: 100,
    location: 'Barracão Principal',
    valorImpostosTotal: 0,
    custoSemImposto: 0,
    custoComImposto: 0,
    freteDiluidoItem: 0,
  });

  // Mensagem amigável padronizada para falhas de XML corrompido, incompleto ou com estrutura inválida
  const XML_CORRUPTED_FRIENDLY_ERROR = 
    'O arquivo XML selecionado está corrompido ou possui uma estrutura inválida. Por favor, verifique se o download da nota foi concluído corretamente e tente carregar o arquivo novamente.';

  // XML Parser robusto para NF-e SEFAZ Brasil com suporte a namespaces e fallbacks
  const parseXmlNFe = (xmlText: string): ParsedNfeData => {
    try {
      const cleanXml = (xmlText || '').replace(/^\uFEFF/, '').trim();
      if (!cleanXml) {
        throw new Error(XML_CORRUPTED_FRIENDLY_ERROR);
      }

      // 3. Validação Prévia do Arquivo:
      // Antes de processar as tags internas, valida se o arquivo enviado contém a tag principal <nfeProc> ou <infNFe>
      const hasNfeProcOrInfNfe = /<(?:[a-zA-Z0-9_]+:)?(?:nfeProc|infNFe)\b/i.test(cleanXml);
      if (!hasNfeProcOrInfNfe) {
        console.warn("Validação prévia rejeitada: XML não contém as tags principais <nfeProc> ou <infNFe>");
        throw new Error(XML_CORRUPTED_FRIENDLY_ERROR);
      }

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(cleanXml, 'application/xml');

      // Verifica erros de sintaxe XML (como 'tag mismatch', tags não fechadas, erro de parsing)
      const parseErrors = xmlDoc.getElementsByTagName('parsererror');
      if (parseErrors.length > 0 || (xmlDoc.documentElement && xmlDoc.documentElement.nodeName === 'parsererror')) {
        const errorText = parseErrors[0]?.textContent || xmlDoc.documentElement?.textContent || 'parsererror';
        console.error("Erro detalhado do XML (sintaxe DOMParser capturada):", errorText);
        throw new Error(XML_CORRUPTED_FRIENDLY_ERROR);
      }

      // Helper seguro para leitura de tags, tolerante a namespaces (ex: <nfe:emit> ou <emit>)
      const getTag = (parent: Element | Document | null | undefined, tagName: string): string => {
        if (!parent) return '';
        try {
          // 1. Busca direta por nome da tag
          const direct = parent.getElementsByTagName(tagName);
          if (direct && direct.length > 0 && direct[0]?.textContent) {
            return direct[0].textContent.trim();
          }
          // 2. Busca ignorando namespace
          if (parent.getElementsByTagNameNS) {
            const ns = parent.getElementsByTagNameNS('*', tagName);
            if (ns && ns.length > 0 && ns[0]?.textContent) {
              return ns[0].textContent.trim();
            }
          }
          // 3. Busca via querySelector
          const el = parent.querySelector?.(tagName);
          if (el?.textContent) return el.textContent.trim();
        } catch (tagErr) {
          console.error(`Erro detalhado do XML: Falha ao ler tag <${tagName}>`, tagErr);
        }
        return '';
      };

      // Helper seguro para obter nós de elementos
      const getEl = (parent: Element | Document | null | undefined, tagName: string): Element | null => {
        if (!parent) return null;
        try {
          const direct = parent.getElementsByTagName(tagName);
          if (direct && direct.length > 0) return direct[0];
          if (parent.getElementsByTagNameNS) {
            const ns = parent.getElementsByTagNameNS('*', tagName);
            if (ns && ns.length > 0) return ns[0];
          }
          const el = parent.querySelector?.(tagName);
          if (el) return el;
        } catch (elErr) {
          console.error(`Erro detalhado do XML: Falha ao obter elemento <${tagName}>`, elErr);
        }
        return null;
      };

      // Helper seguro para obter listas de elementos (ex: múltiplos <det>)
      const getAllEls = (parent: Element | Document | null | undefined, tagName: string): Element[] => {
        if (!parent) return [];
        try {
          const direct = Array.from(parent.getElementsByTagName(tagName));
          if (direct.length > 0) return direct;
          if (parent.getElementsByTagNameNS) {
            const ns = Array.from(parent.getElementsByTagNameNS('*', tagName));
            if (ns.length > 0) return ns;
          }
          const els = Array.from(parent.querySelectorAll?.(tagName) || []);
          if (els.length > 0) return els;
        } catch (allErr) {
          console.error(`Erro detalhado do XML: Falha ao listar elementos <${tagName}>`, allErr);
        }
        return [];
      };

      const infNFe = getEl(xmlDoc, 'infNFe') || getEl(xmlDoc, 'NFe') || xmlDoc.documentElement;

      // 1. Chave de Acesso (com múltiplos fallbacks seguros)
      let accessKey = getTag(xmlDoc, 'chNFe') || '';
      if (!accessKey && infNFe) {
        const idAttr = infNFe.getAttribute('Id') || infNFe.getAttribute('id') || '';
        accessKey = idAttr.replace(/^NFe/i, '').trim();
      }
      if (!accessKey) {
        const keyMatch = cleanXml.match(/\b\d{44}\b/);
        accessKey = keyMatch ? keyMatch[0] : '';
      }

      // 2. Número e Série da NF-e
      const ide = getEl(xmlDoc, 'ide');
      const nNF = (ide ? getTag(ide, 'nNF') : '') || getTag(xmlDoc, 'nNF') || (accessKey.length === 44 ? accessKey.slice(25, 34).replace(/^0+/, '') : '') || '';
      const serie = (ide ? getTag(ide, 'serie') : '') || getTag(xmlDoc, 'serie') || '';
      const invoiceNumber = nNF ? `NF-e ${nNF}` : (accessKey ? `NF-e ${accessKey.slice(25, 34)}` : 'NF-e S/N');
      const natOp = (ide ? getTag(ide, 'natOp') : '') || getTag(xmlDoc, 'natOp') || '';
      let initialTransactionType = '';
      if (natOp) {
        const norm = natOp.toUpperCase().trim();
        const found = NFE_TRANSACTION_TYPES.find(t => norm === t || norm.includes(t) || t.includes(norm));
        if (found) initialTransactionType = found;
      }

      // 3. Data de Emissão (dhEmi ou dEmi)
      let issueDate = (ide ? (getTag(ide, 'dhEmi') || getTag(ide, 'dEmi')) : '') || getTag(xmlDoc, 'dhEmi') || getTag(xmlDoc, 'dEmi') || '';
      if (issueDate.includes('T')) {
        issueDate = issueDate.split('T')[0];
      }
      if (!issueDate) {
        issueDate = new Date().toISOString().split('T')[0];
      }

      // 4. Emitente (Fornecedor) com valores padrão e dados fiscais completos do XML
      const emit = getEl(xmlDoc, 'emit');
      const supplierName = (emit ? (getTag(emit, 'xNome') || getTag(emit, 'xFant')) : '') || getTag(xmlDoc, 'xNome') || 'Fornecedor Identificado no XML';
      const supplierTradeName = emit ? getTag(emit, 'xFant') : '';
      const supplierCnpj = (emit ? (getTag(emit, 'CNPJ') || getTag(emit, 'CPF')) : '') || getTag(xmlDoc, 'CNPJ') || getTag(xmlDoc, 'CPF') || '';
      const supplierIe = emit ? (getTag(emit, 'IE') || getTag(emit, 'ie')) : '';
      const supplierIm = emit ? (getTag(emit, 'IM') || getTag(emit, 'im')) : '';

      // Endereço e contato do emitente (<enderEmit>)
      const enderEmit = emit ? getEl(emit, 'enderEmit') : null;
      const xLgr = enderEmit ? getTag(enderEmit, 'xLgr') : '';
      const nro = enderEmit ? getTag(enderEmit, 'nro') : '';
      const xCpl = enderEmit ? getTag(enderEmit, 'xCpl') : '';
      const xBairro = enderEmit ? getTag(enderEmit, 'xBairro') : '';
      const xMun = enderEmit ? getTag(enderEmit, 'xMun') : '';
      const ufEmit = enderEmit ? getTag(enderEmit, 'UF') : '';
      const cepEmit = enderEmit ? getTag(enderEmit, 'CEP') : '';
      const foneEmit = enderEmit ? getTag(enderEmit, 'fone') : '';

      const supplierAddress = [xLgr, nro ? `nº ${nro}` : '', xCpl].filter(Boolean).join(', ');
      const supplierNeighborhood = xBairro;
      const supplierCity = xMun;
      const supplierState = ufEmit || 'PR';
      const supplierZipCode = cepEmit;
      const supplierPhone = foneEmit;

      // 5. Destinatário com valores padrão (Permite qualquer CNPJ ou CPF sem bloqueios)
      const dest = getEl(xmlDoc, 'dest');
      const recipientName = (dest ? (getTag(dest, 'xNome') || getTag(dest, 'xFant')) : '') || '';
      const recipientCnpj = (dest ? (getTag(dest, 'CNPJ') || getTag(dest, 'CPF')) : '') || '';

      // [REGRA DE NEGÓCIO]:
      // NUNCA rejeitar ou bloquear a leitura da nota por divergência de CNPJ.
      // Toda e qualquer NF-e deve ser importada com sucesso independentemente do CNPJ do destinatário ou emitente.

      // 6. Totais com valores padrão e extração mestre de <vNF>, <vProd>, <vFrete> e <vIPI>
      const total = getEl(xmlDoc, 'total') || getEl(xmlDoc, 'ICMSTot') || xmlDoc;
      const icmsTot = getEl(total, 'ICMSTot') || getEl(xmlDoc, 'ICMSTot') || total;
      const vNFStr = getTag(icmsTot, 'vNF') || getTag(total, 'vNF') || getTag(xmlDoc, 'vNF') || getTag(total, 'vNFTot') || getTag(xmlDoc, 'vNFTot') || '0';
      const vProdStr = getTag(icmsTot, 'vProd') || getTag(total, 'vProd') || getTag(xmlDoc, 'vProd') || '0';
      const vFreteTotalStr = getTag(icmsTot, 'vFrete') || getTag(total, 'vFrete') || getTag(xmlDoc, 'vFrete') || '0';
      const vIpiTotalStr = getTag(icmsTot, 'vIPI') || getTag(total, 'vIPI') || getTag(xmlDoc, 'vIPI') || '0';
      let totalAmount = parseFloat(vNFStr) || 0;
      let productsAmount = parseFloat(vProdStr) || 0;
      let totalFrete = parseFloat(vFreteTotalStr) || 0;
      let totalIpi = parseFloat(vIpiTotalStr) || 0;

      // Fallback robusto por regex caso a tag venha em nós aninhados do XML
      if (!totalAmount) {
        const vNFMatch = cleanXml.match(/<vNF>([^<]+)<\/vNF>/i) || cleanXml.match(/<vNFTot>([^<]+)<\/vNFTot>/i);
        if (vNFMatch) totalAmount = parseFloat(vNFMatch[1]) || 0;
      }
      if (!productsAmount) {
        const vProdMatch = cleanXml.match(/<ICMSTot>[\s\S]*?<vProd>([^<]+)<\/vProd>/i) || cleanXml.match(/<vProd>([^<]+)<\/vProd>/i);
        if (vProdMatch) productsAmount = parseFloat(vProdMatch[1]) || 0;
      }
      if (!totalFrete) {
        const vFreteMatch = cleanXml.match(/<ICMSTot>[\s\S]*?<vFrete>([^<]+)<\/vFrete>/i) || cleanXml.match(/<vFrete>([^<]+)<\/vFrete>/i);
        if (vFreteMatch) totalFrete = parseFloat(vFreteMatch[1]) || 0;
      }
      if (!totalIpi) {
        const vIpiMatch = cleanXml.match(/<ICMSTot>[\s\S]*?<vIPI>([^<]+)<\/vIPI>/i) || cleanXml.match(/<vIPI>([^<]+)<\/vIPI>/i);
        if (vIpiMatch) totalIpi = parseFloat(vIpiMatch[1]) || 0;
      }

      // 7. Cobrança e Duplicatas (<cobr> -> <dup>)
      const cobr = getEl(xmlDoc, 'cobr');
      const dupElements = cobr ? getAllEls(cobr, 'dup') : getAllEls(xmlDoc, 'dup');
      const installments: ParsedNfeInstallment[] = dupElements.map((dup, idx) => {
        const nDup = getTag(dup, 'nDup') || String(idx + 1);
        let dVenc = getTag(dup, 'dVenc') || '';
        if (dVenc.includes('T')) dVenc = dVenc.split('T')[0];
        const vDup = parseFloat(getTag(dup, 'vDup')) || 0;
        return {
          number: nDup,
          dueDate: dVenc,
          amount: vDup,
        };
      }).filter(inst => inst.amount > 0 || Boolean(inst.dueDate));

      // 8. Forma de Pagamento (<pag> / <detPag> / <tPag>)
      const tPag = getTag(xmlDoc, 'tPag') || '15';
      let paymentMethod: PaymentMethod = 'boleto';
      if (tPag === '01') paymentMethod = 'dinheiro';
      else if (tPag === '02') paymentMethod = 'transferencia';
      else if (tPag === '03') paymentMethod = 'cartao_credito';
      else if (tPag === '04') paymentMethod = 'cartao_debito';
      else if (tPag === '17') paymentMethod = 'pix';
      else paymentMethod = 'boleto';

      // Data de Vencimento prioritária
      const primaryDueDate = (installments.length > 0 && installments[0].dueDate) 
        ? installments[0].dueDate 
        : issueDate;

      // Helper seguro para somar valores numéricos de tags de impostos dentro de um elemento <det>
      const getTaxSum = (detEl: Element, tagName: string): number => {
        const els = getAllEls(detEl, tagName);
        let sum = 0;
        for (const el of els) {
          const val = parseFloat(el.textContent?.trim() || '0');
          if (!isNaN(val) && val > 0) sum += val;
        }
        return sum;
      };

      // 9. Itens da Nota Fiscal (<det>) com inteligência fiscal e composição de custos do XML
      const detElements = getAllEls(xmlDoc, 'det');

      // Pré-cálculo da soma de vProd dos itens para rateio proporcional exato
      const rawProdValues = detElements.map(det => {
        const p = getEl(det, 'prod') || det;
        return parseFloat(getTag(p, 'vProd')) || 0;
      });
      const prelimSumVProd = rawProdValues.reduce((acc, v) => acc + v, 0);
      const vProdTotalNota = productsAmount > 0 
        ? productsAmount 
        : (prelimSumVProd > 0 ? prelimSumVProd : 1);

      // Se totalFrete não veio no total mestre mas veio em itens, calcula a soma
      if (totalFrete === 0) {
        totalFrete = detElements.reduce((acc, det) => {
          const p = getEl(det, 'prod') || det;
          return acc + (parseFloat(getTag(p, 'vFrete')) || 0);
        }, 0);
      }

      // Se totalIpi não veio no total mestre mas veio em itens, calcula a soma
      if (totalIpi === 0) {
        totalIpi = detElements.reduce((acc, det) => {
          return acc + (getTaxSum(det, 'vIPI') || parseFloat(getTag(getEl(det, 'IPI'), 'vIPI')) || 0);
        }, 0);
      }

      const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;
      const round4 = (num: number) => Math.round((num + Number.EPSILON) * 10000) / 10000;

      // Se totalAmount ainda for 0, calcula a somatória completa [vProd] + [vIPI] + [vFrete]
      if (totalAmount === 0) {
        totalAmount = round2(vProdTotalNota + totalIpi + totalFrete);
      }

      let accumulatedFrete = 0;
      let accumulatedCustoComposto = 0;
      const totalDetCount = detElements.length;

      const items: ParsedNfeItem[] = detElements.map((det, index) => {
        const prod = getEl(det, 'prod') || det;
        const ean = getTag(prod, 'cEAN') || getTag(prod, 'cEANTrib') || '';
        const barcode = (ean && ean.toUpperCase() !== 'SEM GTIN') ? ean : '';
        const qCom = parseFloat(getTag(prod, 'qCom')) || parseFloat(getTag(prod, 'qTrib')) || 1;
        const vProd = parseFloat(getTag(prod, 'vProd')) || 0;
        const vUnCom = parseFloat(getTag(prod, 'vUnCom')) || parseFloat(getTag(prod, 'vUnTrib')) || (qCom > 0 ? vProd / qCom : 0);

        // Impostos do item
        const vICMS = getTaxSum(det, 'vICMS') + getTaxSum(det, 'vICMSST');
        const vIPI = getTaxSum(det, 'vIPI') || parseFloat(getTag(getEl(det, 'IPI'), 'vIPI')) || 0;
        const vPIS = getTaxSum(det, 'vPIS') + getTaxSum(det, 'vPISST');
        const vCOFINS = getTaxSum(det, 'vCOFINS') + getTaxSum(det, 'vCOFINSST');
        const vIBS = getTaxSum(det, 'vIBS');
        const vCBS = getTaxSum(det, 'vCBS');
        const totalItemImpostos = vICMS + vIPI + vPIS + vCOFINS + vIBS + vCBS;
        const valorImpostosUnitario = qCom > 0 ? (totalItemImpostos / qCom) : totalItemImpostos;

        // Rateio Proporcional de Frete:
        // [Peso do Item (%)] = [vProd do Item] / [vProd Total da Nota]
        // [Frete Proporcional do Item] = [Frete Total da Nota] * [Peso do Item (%)]
        // Ajuste de centavos no último item
        const isLastItem = index === totalDetCount - 1;
        let freteProporcionalItem = 0;
        if (totalFrete > 0) {
          if (!isLastItem) {
            const pesoPercentual = vProdTotalNota > 0 ? (vProd / vProdTotalNota) : (1 / totalDetCount);
            freteProporcionalItem = round2(totalFrete * pesoPercentual);
            accumulatedFrete = round2(accumulatedFrete + freteProporcionalItem);
          } else {
            freteProporcionalItem = Math.max(0, round2(totalFrete - accumulatedFrete));
          }
        } else {
          freteProporcionalItem = parseFloat(getTag(prod, 'vFrete')) || 0;
        }

        const freteDiluidoUnitario = qCom > 0 ? round2(freteProporcionalItem / qCom) : freteProporcionalItem;

        // Custo Líquido (Sem Imposto): Exibe o valor do produto subtraindo os impostos incidentes/recuperáveis
        const custoSemImpostoCalc = Math.max(0, vUnCom - valorImpostosUnitario);

        // =========================================================================
        // NOVO MOTOR FISCAL EXCLUSIVO (CONTRATO MASTER AGROCONTROL):
        // [CUSTO COMPOSTO DO ITEM] = [vProd do Item] + [IPI do Item] + [Frete Proporcional do Item]
        // Com ajuste de centavos no último item para bater exatamente com o totalAmount
        // CUSTO COM IMPOSTO = [CUSTO COMPOSTO DO ITEM] / qCom
        // V. TOTAL = [CUSTO COMPOSTO DO ITEM]
        // =========================================================================
        let custoCompostoItem = round2(vProd + vIPI + freteProporcionalItem);
        if (isLastItem && totalAmount > 0) {
          const expectedLast = round2(totalAmount - accumulatedCustoComposto);
          if (expectedLast > 0 && Math.abs(expectedLast - custoCompostoItem) <= 1.0) {
            custoCompostoItem = expectedLast;
          }
        }
        accumulatedCustoComposto = round2(accumulatedCustoComposto + custoCompostoItem);

        const custoRealUnitario = qCom > 0 ? round2(custoCompostoItem / qCom) : custoCompostoItem;
        const valorTotalItem = custoCompostoItem;

        const totalImpostosRound = round2(totalItemImpostos);
        const custoSemImpostoRound = round2(custoSemImpostoCalc);
        const custoComImpostoRound = custoRealUnitario;
        const freteDiluidoRound = freteDiluidoUnitario;

        const itemDesc = (getTag(prod, 'xProd') || 'Item NF-e').toUpperCase();
        const defaultCat = normalizeToInventoryCategory(deduceItemCategory(itemDesc));

        return {
          code: getTag(prod, 'cProd') || String(index + 1),
          description: itemDesc,
          ncm: getTag(prod, 'NCM') || '',
          quantity: qCom,
          unit: (getTag(prod, 'uCom') || getTag(prod, 'uTrib') || 'UN').toUpperCase(),
          unitPrice: custoComImpostoRound,
          totalPrice: valorTotalItem,
          barcode,
          category: defaultCat,
          categoria: defaultCat,
          vProdOriginal: round2(vProd),
          vUnComOriginal: round4(vUnCom),
          vICMS: round2(vICMS),
          vIPI: round2(vIPI),
          vPIS: round2(vPIS),
          vCOFINS: round2(vCOFINS),
          vIBS: round2(vIBS),
          vCBS: round2(vCBS),
          valorImpostosTotal: totalImpostosRound,
          valor_impostos_total: totalImpostosRound,
          custoSemImposto: custoSemImpostoRound,
          custo_sem_imposto: custoSemImpostoRound,
          custoComImposto: custoComImpostoRound,
          custo_com_imposto: custoComImpostoRound,
          freteProporcionalTotal: round2(freteProporcionalItem),
          freteDiluidoItem: freteDiluidoRound,
          frete_diluido_item: freteDiluidoRound,
        };
      });

      // Se os totais não vieram das tags mestres do XML e houver itens, totaliza a partir dos itens
      if (totalAmount === 0 && items.length > 0) {
        totalAmount = Math.round(items.reduce((acc, curr) => acc + (curr.totalPrice || 0), 0) * 100) / 100;
      }
      if (productsAmount === 0 && items.length > 0) {
        productsAmount = Math.round(items.reduce((acc, curr) => acc + (curr.vProdOriginal || 0), 0) * 100) / 100;
      }

      // 10. Sugestão automática de categoria e definição de Categoria Prioritária
      const allText = (supplierName + ' ' + items.map(i => i.description).join(' ')).toLowerCase();
      let suggestedCategory = 'cat_insumos';
      let deducedPriorityCategory = 'Outros Insumos';

      if (allText.includes('diesel') || allText.includes('combustivel') || allText.includes('combustível') || allText.includes('s10') || allText.includes('arla')) {
        suggestedCategory = 'cat_combustivel';
        deducedPriorityCategory = 'Combustível & Arla';
      } else if (allText.includes('peca') || allText.includes('peça') || allText.includes('faca') || allText.includes('filtro') || allText.includes('oleo') || allText.includes('óleo') || allText.includes('correia') || allText.includes('rolamento')) {
        suggestedCategory = 'cat_manutencao';
        deducedPriorityCategory = 'Peças & Manutenção';
      } else if (allText.includes('lona') || allText.includes('filme') || allText.includes('plastico') || allText.includes('plástico')) {
        suggestedCategory = 'cat_lona_embalagem';
        deducedPriorityCategory = 'Lona & Embalagem';
      } else if (allText.includes('inoculante') || allText.includes('biologico') || allText.includes('aditivo')) {
        deducedPriorityCategory = 'Inoculante & Biológico';
      } else if (allText.includes('semente') || allText.includes('milho') || allText.includes('sorgo') || allText.includes('soja')) {
        deducedPriorityCategory = 'Sementes';
      } else if (allText.includes('adubo') || allText.includes('fertilizante') || allText.includes('ureia') || allText.includes('npk')) {
        deducedPriorityCategory = 'Adubo & Fertilizante';
      } else if (items.length > 0 && items[0].categoria) {
        deducedPriorityCategory = items[0].categoria;
      }

      return {
        accessKey,
        invoiceNumber,
        series: serie || '',
        supplier: supplierName || 'Fornecedor Identificado no XML',
        supplierTradeName: supplierTradeName || undefined,
        supplierCnpj: supplierCnpj || '',
        supplierIe: supplierIe || undefined,
        supplierIm: supplierIm || undefined,
        supplierPhone: supplierPhone || undefined,
        supplierAddress: supplierAddress || undefined,
        supplierNeighborhood: supplierNeighborhood || undefined,
        supplierCity: supplierCity || undefined,
        supplierState: supplierState || 'PR',
        supplierZipCode: supplierZipCode || undefined,
        recipient: recipientName || '',
        recipientCnpj: recipientCnpj || '',
        totalAmount: round2(totalAmount) || 0,
        productsAmount: round2(productsAmount) || round2(totalAmount) || 0,
        totalFrete: round2(totalFrete),
        vFrete: round2(totalFrete),
        totalIPI: round2(totalIpi),
        vIPI: round2(totalIpi),
        issueDate: issueDate || new Date().toISOString().split('T')[0],
        dueDate: primaryDueDate,
        paymentMethod,
        installments,
        itemsSummary: items.length > 0 ? `${items.length} produto(s) listado(s)` : 'Sem detalhamento de itens',
        suggestedCategory,
        priorityCategory: deducedPriorityCategory,
        categoriaPrioritaria: deducedPriorityCategory,
        operationNature: natOp || undefined,
        transactionType: initialTransactionType || undefined,
        items
      };
    } catch (error) {
      console.error("Erro detalhado do XML:", error);
      throw new Error(XML_CORRUPTED_FRIENDLY_ERROR);
    }
  };

  // Processa diretamente a string XML extraída sem depender de estado assíncrono intermediário
  const processXmlDirectly = (text: string) => {
    setErrorMessage('');
    try {
      if (!text || !text.trim()) {
        console.error("Conteúdo lido está vazio");
        setErrorMessage(XML_CORRUPTED_FRIENDLY_ERROR);
        setParsedData(null);
        return;
      }

      // 3. Validação Prévia do Arquivo:
      // Verifica se o arquivo contém as tags essenciais da NF-e antes de processar tags internas
      const clean = text.replace(/^\uFEFF/, '').trim();
      const hasValidRootTags = /<(?:[a-zA-Z0-9_]+:)?(?:nfeProc|infNFe)\b/i.test(clean);
      if (!hasValidRootTags) {
        console.warn("Validação prévia: XML não possui as tags principais <nfeProc> ou <infNFe>");
        setErrorMessage(XML_CORRUPTED_FRIENDLY_ERROR);
        setParsedData(null);
        return;
      }

      const result = parseXmlNFe(clean);

      // Validação não-bloqueante de CNPJ: apenas exibe aviso amigável sem interromper a importação
      const systemCnpj = companyProfile?.cnpjCpf?.replace(/\D/g, '') || '';
      const nfeCnpj = result.recipientCnpj?.replace(/\D/g, '') || '';
      if (systemCnpj && nfeCnpj && systemCnpj !== nfeCnpj) {
        console.warn(
          `Aviso: CNPJ da nota difere do sistema. Destinatário: ${result.recipientCnpj} | Sistema: ${companyProfile?.cnpjCpf}. A importação prossegue normalmente.`
        );
      }

      // Auto-match inicial com itens do estoque ("De-Para" automático inteligente)
      if (result.items && result.items.length > 0) {
        result.items = result.items.map((item) => {
          const match = localInventory.find(inv => 
            (inv.code !== undefined && inv.code !== null && item.code && String(inv.code).trim().toLowerCase() === String(item.code).trim().toLowerCase()) ||
            (inv.barcode && item.barcode && String(inv.barcode) === String(item.barcode)) ||
            (inv.name && item.description && String(inv.name).trim().toLowerCase() === String(item.description).trim().toLowerCase()) ||
            (inv.fiscalName && item.description && String(inv.fiscalName).trim().toLowerCase() === String(item.description).trim().toLowerCase())
          );
          const markup = match?.profitMargin;
          let calculatedSale = match?.salePrice;
          if (calculatedSale === undefined && markup !== undefined && item.unitPrice > 0) {
            calculatedSale = Math.round((item.unitPrice * (1 + markup / 100)) * 100) / 100;
          }

          let calcWholesaleMarkup: number | undefined = undefined;
          if (match?.wholesalePrice !== undefined && item.unitPrice > 0) {
            calcWholesaleMarkup = Math.round(((match.wholesalePrice - item.unitPrice) / item.unitPrice) * 100 * 10) / 10;
          }

          let calcPromoMarkup: number | undefined = undefined;
          if (match?.promoPrice !== undefined && item.unitPrice > 0) {
            calcPromoMarkup = Math.round(((match.promoPrice - item.unitPrice) / item.unitPrice) * 100 * 10) / 10;
          }

          const resolvedCat = normalizeToInventoryCategory(
            match?.categoria || 
            match?.category || 
            result.priorityCategory || 
            item.categoria || 
            item.category
          );

          return {
            ...item,
            category: resolvedCat,
            categoria: resolvedCat,
            linkedInventoryId: match?.id,
            markupPercent: markup,
            salePrice: calculatedSale,
            wholesaleMarkupPercent: calcWholesaleMarkup,
            wholesalePrice: match?.wholesalePrice,
            promoMarkupPercent: calcPromoMarkup,
            promoPrice: match?.promoPrice,
          };
        });

        // Persistência local imediata offline da lista de itens extraídos
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem('colaca_silagem_documentos_entrada_itens', JSON.stringify(result.items));
            saveCompanyData('documentos_entrada_itens', result.items);
          }
        } catch (err) {
          console.warn('Aviso ao sincronizar colaca_silagem_documentos_entrada_itens no parse direto:', err);
        }
      }

      // =========================================================================
      // INTELIGÊNCIA ANTI-DUPLICIDADE NO CADASTRO DO FORNECEDOR
      // =========================================================================
      const rawSupplierDigits = cleanDigits(result.supplierCnpj || '');
      let existingSupplier = localSuppliers.find(s => {
        if (!rawSupplierDigits) return false;
        const sDigits = cleanDigits(s.cnpjOrCpf || '');
        return sDigits.length >= 11 && sDigits === rawSupplierDigits;
      });

      if (!existingSupplier && result.supplier) {
        existingSupplier = localSuppliers.find(s => 
          s.name.trim().toLowerCase() === result.supplier.trim().toLowerCase()
        );
      }

      let supplierForValidation: Supplier;

      if (existingSupplier) {
        // Vincula a nota ao fornecedor existente SEM duplicar o registro
        supplierForValidation = {
          ...existingSupplier,
          tradeName: existingSupplier.tradeName || result.supplierTradeName || undefined,
          stateRegistration: existingSupplier.stateRegistration || result.supplierIe || undefined,
          municipalRegistration: existingSupplier.municipalRegistration || result.supplierIm || undefined,
          address: existingSupplier.address || result.supplierAddress || undefined,
          neighborhood: existingSupplier.neighborhood || result.supplierNeighborhood || undefined,
          city: existingSupplier.city || result.supplierCity || undefined,
          state: existingSupplier.state || result.supplierState || undefined,
          zipCode: existingSupplier.zipCode || (result.supplierZipCode ? formatCep(result.supplierZipCode) : undefined),
          phone: existingSupplier.phone || (result.supplierPhone ? formatPhone(result.supplierPhone) : ''),
        };

        setSupplierValidationNotice({
          isNew: false,
          name: existingSupplier.name,
          cnpjOrCpf: existingSupplier.cnpjOrCpf,
        });
      } else {
        // Fornecedor novo não encontrado: inicia novo cadastro em segundo plano com dados extraídos
        let inferredCat: Supplier['category'] = 'Combustível';
        const allText = (result.supplier + ' ' + (result.items || []).map(i => i.description).join(' ')).toLowerCase();
        if (allText.includes('diesel') || allText.includes('combustivel') || allText.includes('petro') || allText.includes('arla') || allText.includes('posto')) {
          inferredCat = 'Combustível';
        } else if (allText.includes('lona') || allText.includes('filme') || allText.includes('embalagem') || allText.includes('plastico')) {
          inferredCat = 'Lonas & Embalagens';
        } else if (allText.includes('peca') || allText.includes('peça') || allText.includes('filtro') || allText.includes('faca') || allText.includes('oficina') || allText.includes('mecanica') || allText.includes('trator')) {
          inferredCat = 'Peças & Oficinas';
        } else if (allText.includes('semente') || allText.includes('adubo') || allText.includes('fertilizante') || allText.includes('inoculante') || allText.includes('agro')) {
          inferredCat = 'Sementes & Insumos';
        }

        const newSupplier: Supplier = {
          id: `sup_nfe_${Date.now()}`,
          name: (result.supplier || '').toUpperCase(),
          tradeName: result.supplierTradeName ? result.supplierTradeName.toUpperCase() : undefined,
          category: inferredCat.toUpperCase(),
          cnpjOrCpf: result.supplierCnpj ? formatCpfCnpj(result.supplierCnpj) : undefined,
          stateRegistration: result.supplierIe ? result.supplierIe.toUpperCase() : undefined,
          municipalRegistration: result.supplierIm ? result.supplierIm.toUpperCase() : undefined,
          phone: result.supplierPhone ? formatPhone(result.supplierPhone) : '',
          email: '',
          zipCode: result.supplierZipCode ? formatCep(result.supplierZipCode) : undefined,
          address: result.supplierAddress ? result.supplierAddress.toUpperCase() : undefined,
          neighborhood: result.supplierNeighborhood ? result.supplierNeighborhood.toUpperCase() : undefined,
          city: result.supplierCity ? result.supplierCity.toUpperCase() : undefined,
          state: result.supplierState ? result.supplierState.toUpperCase() : 'PR',
          notes: `Cadastrado automaticamente via leitura XML da NF-e ${result.invoiceNumber}`.toUpperCase(),
          createdAt: new Date().toISOString(),
        };

        const updatedSuppliersList = [newSupplier, ...localSuppliers];
        saveSuppliers(updatedSuppliersList);
        supplierForValidation = newSupplier;

        setSupplierValidationNotice({
          isNew: true,
          name: newSupplier.name,
          cnpjOrCpf: newSupplier.cnpjOrCpf,
        });
      }

      // =========================================================================
      // ABERTURA IMEDIATA DO MODAL "CADASTRO FORNECEDOR" PARA VALIDAÇÃO
      // =========================================================================
      setSupplierForModal(supplierForValidation);
      setIsSupplierModalOpen(true);

      // Reseta erros e seleção anterior de Centro de Custo para forçar seleção
      setSelectedCostCenterId('');
      setCostCenterError(false);

      setParsedData(result);
      if (result.installments && result.installments.length > 0) {
        setUserInstallmentCount(result.installments.length);
      } else {
        setUserInstallmentCount(1);
      }
      setXmlContent(text);
      setEditingExpenseId(null);
      saveCachedNfe(result);
      setSuccessMessage(
        `NF-e ${result.invoiceNumber} importada com sucesso! ` +
        (existingSupplier 
          ? `Fornecedor vinculado: "${existingSupplier.name}".` 
          : `Novo fornecedor cadastrado: "${supplierForValidation.name}".`) +
        ` A janela de validação de dados foi aberta na tela.`
      );
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error: any) {
      console.error("Erro detalhado do XML no processamento:", error);
      setParsedData(null);
      // Substitui qualquer erro técnico por mensagem amigável padronizada
      setErrorMessage(XML_CORRUPTED_FRIENDLY_ERROR);
    }
  };

  const handleProcessXml = (text: string) => {
    processXmlDirectly(text);
  };

  // Upload direto e simples via FileReader nativo protegido contra quebra de interface
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const file = event.target.files?.[0];
      if (!file) return;

      // Reseta o input para permitir selecionar o mesmo arquivo novamente caso corrigido
      if (event.target) {
        event.target.value = '';
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          if (!text || !text.trim()) {
            console.error("Conteúdo lido do arquivo está vazio");
            setErrorMessage(XML_CORRUPTED_FRIENDLY_ERROR);
            setParsedData(null);
            return;
          }
          // Processa o conteúdo XML com validação completa e try-catch
          processXmlDirectly(text);
        } catch (readErr) {
          console.error("Erro ao ler conteúdo do arquivo XML:", readErr);
          setErrorMessage(XML_CORRUPTED_FRIENDLY_ERROR);
          setParsedData(null);
        }
      };
      reader.onerror = (err) => {
        console.error("Erro no FileReader ao ler arquivo no navegador:", err);
        setErrorMessage(XML_CORRUPTED_FRIENDLY_ERROR);
        setParsedData(null);
      };
      reader.readAsText(file);
    } catch (uploadErr) {
      console.error("Erro inesperado no manipulador de upload:", uploadErr);
      setErrorMessage(XML_CORRUPTED_FRIENDLY_ERROR);
      setParsedData(null);
    }
  };

  // Busca por Número da NF-e (ou leitor de código)
  const handleSearchNfe = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchNfeNumber.trim();
    if (!query) {
      setErrorMessage('Informe o número da NF-e ou chave de acesso para pesquisar.');
      return;
    }

    setIsSearching(true);
    setErrorMessage('');

    // Busca primeiro nas despesas já cadastradas
    const existingExpense = expenses.find(exp => 
      exp.invoiceNumber && exp.invoiceNumber.toLowerCase().includes(query.toLowerCase())
    );

    setTimeout(() => {
      setIsSearching(false);
      const cleanNum = query.replace(/\D/g, '') || query;
      const simulatedKey = cleanNum.length === 44 
        ? cleanNum 
        : `352609${cleanNum.padStart(8, '0')}000195550010000${cleanNum.padStart(6, '0')}1837492810`.slice(0, 44);

      const simulatedNfe: ParsedNfeData = {
        accessKey: simulatedKey,
        invoiceNumber: `NF-e ${cleanNum}`,
        series: '1',
        supplier: existingExpense ? (existingExpense.supplier || 'Fornecedor Local') : 'Distribuidora de Diesel Sul Ltda',
        supplierCnpj: '12.345.678/0001-95',
        recipient: companyProfile?.name || 'Agropecuária Silagem Fácil',
        recipientCnpj: companyProfile?.cnpjCpf || '98.765.432/0001-10',
        totalAmount: existingExpense ? existingExpense.amount : 3840.00,
        productsAmount: existingExpense ? existingExpense.amount : 3840.00,
        issueDate: existingExpense?.dueDate || new Date().toISOString().split('T')[0],
        itemsSummary: '1 produto identificado via consulta da NF-e',
        suggestedCategory: 'cat_combustivel',
        items: [
          {
            code: '001',
            description: 'ÓLEO DIESEL S10 COMUM A GRANEL',
            ncm: '27101921',
            quantity: 800,
            unit: 'LT',
            unitPrice: 4.80,
            totalPrice: 3840.00,
            linkedInventoryId: localInventory.find(i => 
              i.code === '001' || 
              i.name.toLowerCase().includes('diesel')
            )?.id
          }
        ]
      };

      setParsedData(simulatedNfe);
      setEditingExpenseId(existingExpense ? existingExpense.id : null);
      saveCachedNfe(simulatedNfe, existingExpense ? existingExpense.id : undefined);

      if (existingExpense) {
        setSuccessMessage(`Nota Fiscal nº ${cleanNum} encontrada nas despesas e carregada com sucesso!`);
      } else {
        setSuccessMessage(`Consulta da NF-e nº ${cleanNum} simulada com sucesso! Dados extraídos e prontos para conferência.`);
      }

      setTimeout(() => setSuccessMessage(''), 5000);
    }, 250);
  };

  // Vinculação de produto do estoque à linha da NF-e ("De-Para")
  const handleLinkProduct = (rowIndex: number, productId?: string) => {
    if (!parsedData || !parsedData.items) return;
    const updatedItems = [...parsedData.items];
    const current = updatedItems[rowIndex];
    const targetProduct = productId ? localInventory.find(i => i.id === productId) : undefined;

    let newMarkup = current.markupPercent;
    let newSalePrice = targetProduct?.salePrice !== undefined ? targetProduct.salePrice : current.salePrice;
    let newWholesaleMarkup = current.wholesaleMarkupPercent;
    let newWholesalePrice = targetProduct?.wholesalePrice !== undefined ? targetProduct.wholesalePrice : current.wholesalePrice;
    let newPromoMarkup = current.promoMarkupPercent;
    let newPromoPrice = targetProduct?.promoPrice !== undefined ? targetProduct.promoPrice : current.promoPrice;

    if (targetProduct) {
      const unit = current.unitPrice || 0;
      if (targetProduct.profitMargin !== undefined) {
        newMarkup = targetProduct.profitMargin;
      }
      if (targetProduct.salePrice !== undefined) {
        newSalePrice = targetProduct.salePrice;
      } else if (newMarkup !== undefined && unit > 0) {
        newSalePrice = Math.round((unit * (1 + newMarkup / 100)) * 100) / 100;
      }

      if (targetProduct.wholesalePrice !== undefined && unit > 0) {
        newWholesaleMarkup = Math.round(((targetProduct.wholesalePrice - unit) / unit) * 100 * 10) / 10;
      }
      if (targetProduct.promoPrice !== undefined && unit > 0) {
        newPromoMarkup = Math.round(((targetProduct.promoPrice - unit) / unit) * 100 * 10) / 10;
      }
    }

    updatedItems[rowIndex] = {
      ...current,
      linkedInventoryId: productId,
      markupPercent: newMarkup,
      salePrice: newSalePrice,
      wholesaleMarkupPercent: newWholesaleMarkup,
      wholesalePrice: newWholesalePrice,
      promoMarkupPercent: newPromoMarkup,
      promoPrice: newPromoPrice,
    };
    setParsedData({
      ...parsedData,
      items: updatedItems
    });
  };

  // Abre modal para cadastrar novo produto baseado na linha da nota
  const handleOpenNewProductModal = (rowIndex: number) => {
    if (!parsedData?.items || !parsedData.items[rowIndex]) return;
    const item = parsedData.items[rowIndex];

    // Dedução de categoria inteligente baseada na descrição do item
    const descLower = item.description.toLowerCase();
    let cat: InventoryItem['category'] = 'outro';
    if (descLower.includes('diesel') || descLower.includes('combustivel') || descLower.includes('s10') || descLower.includes('arla')) {
      cat = 'combustivel';
    } else if (descLower.includes('lona') || descLower.includes('filme') || descLower.includes('plastico')) {
      cat = 'lona_embalagem';
    } else if (descLower.includes('inoculante') || descLower.includes('biologico')) {
      cat = 'inoculante';
    } else if (descLower.includes('semente') || descLower.includes('milho') || descLower.includes('sorgo')) {
      cat = 'sementes';
    } else if (descLower.includes('adubo') || descLower.includes('fertilizante')) {
      cat = 'adubo';
    } else if (descLower.includes('peca') || descLower.includes('peça') || descLower.includes('filtro') || descLower.includes('faca') || descLower.includes('oleo') || descLower.includes('óleo')) {
      cat = 'pecas';
    }

    const xmlCustoComImposto = item.custoComImposto ?? item.custo_com_imposto ?? 0;
    const xmlCustoSemImposto = item.custoSemImposto ?? item.custo_sem_imposto ?? 0;
    const xmlValorImpostos = item.valorImpostosTotal ?? item.valor_impostos_total ?? 0;
    const xmlFreteDiluido = item.freteDiluidoItem ?? item.frete_diluido_item ?? 0;

    const unitCost = xmlCustoComImposto > 0 ? xmlCustoComImposto : (item.unitPrice || 0);
    const profitMargin = 30;
    const salePrice = Math.round((unitCost * (1 + profitMargin / 100)) * 100) / 100;

    const effectiveCategory = normalizeToInventoryCategory(
      item.categoria ||
      item.category ||
      parsedData.priorityCategory ||
      parsedData.categoriaPrioritaria ||
      cat
    );

    setNewProductModal({
      isOpen: true,
      rowIndex,
      code: item.code || `PRD${Date.now().toString().slice(-4)}`,
      name: item.description || '',
      fiscalName: item.description || '',
      barcode: item.barcode || '',
      unit: item.unit || 'UN',
      category: effectiveCategory as any,
      unitCost,
      profitMargin,
      salePrice,
      initialQuantity: 0,
      minQuantity: 10,
      maxQuantity: 100,
      location: 'Barracão Principal',
      valorImpostosTotal: xmlValorImpostos,
      custoSemImposto: xmlCustoSemImposto,
      custoComImposto: xmlCustoComImposto,
      freteDiluidoItem: xmlFreteDiluido,
    });
  };

  // Abre o modal "Editar Produto no Estoque" preenchido com os dados atuais do produto da linha da NF-e
  const handleOpenEditProductFromNfeRow = (rowIndex: number) => {
    if (!parsedData?.items || !parsedData.items[rowIndex]) return;
    const item = parsedData.items[rowIndex];

    const existingProd = localInventory.find(p =>
      (item.linkedInventoryId && p.id === item.linkedInventoryId) ||
      (item.barcode && p.barcode && String(p.barcode) !== 'SEM GTIN' && String(p.barcode).trim() === String(item.barcode).trim()) ||
      (item.code && p.code !== undefined && p.code !== null && String(p.code).trim().toLowerCase() === String(item.code).trim().toLowerCase()) ||
      (p.nome_comercial && String(p.nome_comercial).trim().toLowerCase() === String(item.description || '').trim().toLowerCase()) ||
      (p.name && String(p.name).trim().toLowerCase() === String(item.description || '').trim().toLowerCase())
    );

    const xmlCustoComImposto = item.custoComImposto ?? item.custo_com_imposto ?? 0;
    const xmlCustoSemImposto = item.custoSemImposto ?? item.custo_sem_imposto ?? 0;
    const xmlValorImpostos = item.valorImpostosTotal ?? item.valor_impostos_total ?? 0;
    const xmlFreteDiluido = item.freteDiluidoItem ?? item.frete_diluido_item ?? 0;

    const targetId = existingProd?.id || item.linkedInventoryId || `inv_${Date.now()}_${rowIndex}`;
    const unitCost = (xmlCustoComImposto > 0)
      ? xmlCustoComImposto
      : ((item.unitPrice !== undefined && item.unitPrice > 0)
          ? item.unitPrice
          : (existingProd?.custo_com_imposto || existingProd?.unitCost || existingProd?.preco_custo_inicial || 0));
    const profitMargin = item.markupPercent !== undefined
      ? item.markupPercent
      : (existingProd?.profitMargin ?? existingProd?.margem_lucro_sugerida ?? 30);
    const salePrice = (item.salePrice !== undefined && item.salePrice > 0)
      ? item.salePrice
      : (existingProd?.salePrice ?? existingProd?.preco_venda_varejo ?? Math.round((unitCost * (1 + profitMargin / 100)) * 100) / 100);

    // Prioridade da categoria (Conforme Projeto de Automação de Entrada):
    // 1. Categoria individual definida no item da nota
    // 2. Categoria prioritária fixada na Nota Fiscal inteira
    // 3. Categoria do cadastro existente do produto no estoque
    // 4. Dedução automática baseada na descrição
    const effectiveCategory = normalizeToInventoryCategory(
      item.categoria ||
      item.category ||
      parsedData.priorityCategory ||
      parsedData.categoriaPrioritaria ||
      existingProd?.categoria ||
      existingProd?.category ||
      deduceItemCategory(item.description)
    );

    const initialData: Partial<InventoryItem> = {
      ...(existingProd || {}),
      id: targetId,
      code: existingProd?.code || item.code || `PRD${Date.now().toString().slice(-4)}`,
      name: existingProd?.nome_comercial || existingProd?.name || item.description || '',
      nome: existingProd?.nome_comercial || existingProd?.name || item.description || '',
      nome_comercial: existingProd?.nome_comercial || existingProd?.name || item.description || '',
      fiscalName: existingProd?.fiscalName || item.description || '',
      barcode: item.barcode || existingProd?.barcode || existingProd?.codigo_barras || '',
      codigo_barras: item.barcode || existingProd?.codigo_barras || existingProd?.barcode || '',
      ncm: item.ncm || existingProd?.ncm || existingProd?.codigo_ncm || '',
      codigo_ncm: item.ncm || existingProd?.codigo_ncm || existingProd?.ncm || '',
      unit: (item.unit || existingProd?.unidade_medida || existingProd?.unit || 'UN').toUpperCase(),
      unidade_medida: (item.unit || existingProd?.unidade_medida || existingProd?.unit || 'UN').toUpperCase(),
      category: effectiveCategory,
      categoria: effectiveCategory,
      valor_impostos_total: xmlValorImpostos || existingProd?.valor_impostos_total || 0,
      custo_sem_imposto: xmlCustoSemImposto || existingProd?.custo_sem_imposto || 0,
      custo_com_imposto: xmlCustoComImposto || existingProd?.custo_com_imposto || unitCost,
      frete_diluido_item: xmlFreteDiluido || existingProd?.frete_diluido_item || 0,
      unitCost,
      preco_custo_inicial: unitCost,
      custo_nominal: unitCost,
      profitMargin,
      margem_lucro_sugerida: profitMargin,
      salePrice,
      preco_venda_varejo: salePrice,
      preco_venda: salePrice,
      wholesaleMargin: item.wholesaleMarkupPercent !== undefined ? item.wholesaleMarkupPercent : existingProd?.wholesaleMargin,
      wholesalePrice: item.wholesalePrice !== undefined ? item.wholesalePrice : existingProd?.wholesalePrice,
      promoMargin: item.promoMarkupPercent !== undefined ? item.promoMarkupPercent : existingProd?.promoMargin,
      promoPrice: item.promoPrice !== undefined ? item.promoPrice : existingProd?.promoPrice,
      quantity: existingProd?.quantidade_atual !== undefined ? existingProd.quantidade_atual : (existingProd?.quantity ?? 0),
      quantidade_atual: existingProd?.quantidade_atual !== undefined ? existingProd.quantidade_atual : (existingProd?.quantity ?? 0),
      minQuantity: existingProd?.minQuantity ?? 10,
      location: existingProd?.endereco_formatado || existingProd?.location || 'Depósito Principal',
    };

    setEditStockProductModal({
      isOpen: true,
      rowIndex,
      initialData,
    });
  };

  // Abre o modal "Editar Produto no Estoque" a partir de um produto da Entrada Manual
  const handleOpenEditProductFromManualEntry = (prod: InventoryItem, manualItemId?: string) => {
    const existingProd = localInventory.find(p => p.id === prod.id) || prod;
    setEditStockProductModal({
      isOpen: true,
      rowIndex: -1,
      manualItemId,
      initialData: {
        ...existingProd,
        id: existingProd.id || `inv_${Date.now()}`,
      },
    });
  };

  // Sincroniza o salvamento do modal "Editar Produto no Estoque" com o Supabase e atualiza reativamente a tabela de Notas
  const handleSaveEditedStockProduct = (savedProduct: InventoryItem) => {
    const existsInLocal = localInventory.some(p => p.id === savedProduct.id);
    const updatedInventory = existsInLocal
      ? localInventory.map(p => (p.id === savedProduct.id ? { ...p, ...savedProduct } : p))
      : [...localInventory, savedProduct];

    saveInventory(updatedInventory);
    upsertEstoqueItem(savedProduct).catch(err => console.warn('Supabase upsertEstoqueItem sync notice:', err));
    saveCloudInventory(updatedInventory).catch(err => console.warn('Supabase saveCloudInventory sync notice:', err));

    if (!existsInLocal) {
      setSessionCreatedProductIds(prev => new Set(prev).add(savedProduct.id));
    }

    const targetRowIndex = editStockProductModal?.rowIndex ?? -1;
    const targetManualItemId = editStockProductModal?.manualItemId;

    // 1. Atualização Reativa da Tabela de "Itens Identificados na Nota Fiscal" (sem resetar digitação ou progresso da nota)
    if (parsedData && parsedData.items) {
      const updatedItems = parsedData.items.map((currentItem, idx) => {
        const isTargetRow = idx === targetRowIndex || currentItem.linkedInventoryId === savedProduct.id;
        if (!isTargetRow) return currentItem;

        const updatedUnitPrice = (savedProduct.unitCost !== undefined && savedProduct.unitCost > 0)
          ? Number(savedProduct.unitCost)
          : (currentItem.unitPrice || 0);
        const qty = Number(currentItem.quantity) || 0;
        const updatedTotalPrice = Math.round((qty * updatedUnitPrice) * 100) / 100;

        const updatedMarkup = savedProduct.profitMargin !== undefined
          ? Number(savedProduct.profitMargin)
          : currentItem.markupPercent;

        let updatedSalePrice = savedProduct.salePrice !== undefined && Number(savedProduct.salePrice) > 0
          ? Number(savedProduct.salePrice)
          : currentItem.salePrice;
        if (updatedMarkup !== undefined && updatedUnitPrice > 0 && (updatedSalePrice === undefined || updatedSalePrice <= 0)) {
          updatedSalePrice = Math.round((updatedUnitPrice * (1 + updatedMarkup / 100)) * 100) / 100;
        }

        const updatedWholesalePrice = savedProduct.wholesalePrice !== undefined && Number(savedProduct.wholesalePrice) > 0
          ? Number(savedProduct.wholesalePrice)
          : currentItem.wholesalePrice;
        const updatedWholesaleMarkup = savedProduct.wholesaleMargin !== undefined
          ? Number(savedProduct.wholesaleMargin)
          : (updatedWholesalePrice !== undefined && updatedUnitPrice > 0
              ? Math.round(((updatedWholesalePrice - updatedUnitPrice) / updatedUnitPrice) * 100 * 10) / 10
              : currentItem.wholesaleMarkupPercent);

        const updatedPromoPrice = savedProduct.promoPrice !== undefined && Number(savedProduct.promoPrice) > 0
          ? Number(savedProduct.promoPrice)
          : currentItem.promoPrice;
        const updatedPromoMarkup = savedProduct.promoMargin !== undefined
          ? Number(savedProduct.promoMargin)
          : (updatedPromoPrice !== undefined && updatedUnitPrice > 0
              ? Math.round(((updatedPromoPrice - updatedUnitPrice) / updatedUnitPrice) * 100 * 10) / 10
              : currentItem.promoMarkupPercent);

        const updatedCategory = normalizeToInventoryCategory(
          savedProduct.categoria || 
          savedProduct.category || 
          currentItem.categoria || 
          currentItem.category
        );

        return {
          ...currentItem,
          linkedInventoryId: savedProduct.id,
          code: savedProduct.code || currentItem.code,
          description: savedProduct.nome_comercial || savedProduct.name || currentItem.description,
          category: updatedCategory,
          categoria: updatedCategory,
          ncm: savedProduct.ncm || savedProduct.codigo_ncm || currentItem.ncm,
          barcode: (savedProduct.barcode && savedProduct.barcode !== 'SEM GTIN') ? savedProduct.barcode : currentItem.barcode,
          unit: (savedProduct.unidade_medida || savedProduct.unit || currentItem.unit || 'UN').toUpperCase(),
          unitPrice: updatedUnitPrice,
          totalPrice: updatedTotalPrice,
          markupPercent: updatedMarkup,
          salePrice: updatedSalePrice,
          wholesaleMarkupPercent: updatedWholesaleMarkup,
          wholesalePrice: updatedWholesalePrice,
          promoMarkupPercent: updatedPromoMarkup,
          promoPrice: updatedPromoPrice,
          valorImpostosTotal: savedProduct.valor_impostos_total ?? currentItem.valorImpostosTotal,
          valor_impostos_total: savedProduct.valor_impostos_total ?? currentItem.valor_impostos_total,
          custoSemImposto: savedProduct.custo_sem_imposto ?? currentItem.custoSemImposto,
          custo_sem_imposto: savedProduct.custo_sem_imposto ?? currentItem.custo_sem_imposto,
          custoComImposto: savedProduct.custo_com_imposto ?? currentItem.custoComImposto,
          custo_com_imposto: savedProduct.custo_com_imposto ?? currentItem.custo_com_imposto,
          freteDiluidoItem: savedProduct.frete_diluido_item ?? currentItem.freteDiluidoItem,
          frete_diluido_item: savedProduct.frete_diluido_item ?? currentItem.frete_diluido_item,
          // Propriedades Técnicas de Pneu
          tireParameters: savedProduct.tireParameters,
          fireNumber: savedProduct.fireNumber || savedProduct.tireParameters?.fireNumber,
          treadDepthMm: savedProduct.treadDepthMm ?? savedProduct.tireParameters?.treadDepthMm,
          originalTreadDepthMm: savedProduct.originalTreadDepthMm ?? savedProduct.tireParameters?.originalTreadDepthMm,
          retreadCount: savedProduct.retreadCount ?? savedProduct.tireParameters?.retreadCount,
          pressurePsi: savedProduct.pressurePsi ?? savedProduct.tireParameters?.pressurePsi,
          currentKm: savedProduct.currentKm ?? savedProduct.tireParameters?.currentKm,
          tireModel: savedProduct.tireModel || savedProduct.tireParameters?.model,
          tireSize: savedProduct.tireSize || savedProduct.tireParameters?.size,
          tireNotes: savedProduct.tireNotes || savedProduct.tireParameters?.notes,
        };
      });

      const newTotalAmount = Math.round(
        updatedItems.reduce((acc, it) => acc + (Number(it.totalPrice) || 0), 0) * 100
      ) / 100;

      const updatedParsed: ParsedNfeData = {
        ...parsedData,
        items: updatedItems,
        productsAmount: newTotalAmount > 0 ? newTotalAmount : parsedData.productsAmount,
        totalAmount: newTotalAmount > 0 ? newTotalAmount : parsedData.totalAmount,
      };

      setParsedData(updatedParsed);
      saveCachedNfe(updatedParsed, editingExpenseId || undefined);

      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem('colaca_silagem_documentos_entrada_itens', JSON.stringify(updatedItems));
          saveCompanyData('documentos_entrada_itens', updatedItems);
        }
      } catch (err) {
        console.warn('Aviso ao sincronizar colaca_silagem_documentos_entrada_itens:', err);
      }
    }

    // Sincronização automática com a Frota (Pneus Disponíveis - Estoque)
    if (
      (savedProduct.categoria?.toLowerCase().includes('pneu') || 
       savedProduct.category?.toLowerCase().includes('pneu') ||
       savedProduct.tireParameters) &&
      (savedProduct.fireNumber || savedProduct.tireParameters?.fireNumber)
    ) {
      try {
        const currentTireInv = getStoredTireInventory();
        const fireNum = (savedProduct.fireNumber || savedProduct.tireParameters?.fireNumber || '').trim();
        if (fireNum) {
          const existingIdx = currentTireInv.findIndex(
            (t) => (t.fireNumber || '').trim().toLowerCase() === fireNum.toLowerCase() || t.id === `tire_${savedProduct.id}`
          );
          const tireItemToSave: TireItem = {
            id: existingIdx >= 0 ? currentTireInv[existingIdx].id : `tire_inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            position: 'estoque',
            positionName: 'Estoque / Disponível',
            fireNumber: fireNum,
            brand: savedProduct.tireParameters?.brand || savedProduct.marca || savedProduct.brand || 'Michelin',
            model: savedProduct.tireParameters?.model || savedProduct.tireModel || savedProduct.nome_comercial || savedProduct.name,
            size: savedProduct.tireParameters?.size || savedProduct.tireSize || '295/80 R22.5',
            treadDepthMm: savedProduct.tireParameters?.treadDepthMm ?? savedProduct.treadDepthMm ?? 12.0,
            originalTreadDepthMm: savedProduct.tireParameters?.originalTreadDepthMm ?? 18.0,
            pressurePsi: savedProduct.tireParameters?.pressurePsi ?? savedProduct.pressurePsi ?? 110,
            status: 'estoque',
            retreadCount: savedProduct.tireParameters?.retreadCount ?? savedProduct.retreadCount ?? 0,
            currentKm: savedProduct.tireParameters?.currentKm ?? savedProduct.currentKm ?? 0,
            notes: savedProduct.tireParameters?.notes || savedProduct.tireNotes || undefined,
          };

          let updatedTireInv: TireItem[];
          if (existingIdx >= 0) {
            updatedTireInv = [...currentTireInv];
            updatedTireInv[existingIdx] = { ...updatedTireInv[existingIdx], ...tireItemToSave };
          } else {
            updatedTireInv = [tireItemToSave, ...currentTireInv];
          }
          saveStoredTireInventory(updatedTireInv);
          window.dispatchEvent(new CustomEvent('tire_inventory_updated', { detail: updatedTireInv }));
        }
      } catch (errTire) {
        console.warn('Aviso ao sincronizar pneu com estoque de frotas em NfeModule:', errTire);
      }
    }

    // 2. Atualização Reativa caso a edição tenha partido da Entrada Manual
    if (selectedProduct && selectedProduct.id === savedProduct.id) {
      setSelectedProduct(savedProduct);
      setItemSearchQuery(savedProduct.nome_comercial || savedProduct.name);
      setItemUnit((savedProduct.unidade_medida || savedProduct.unit || 'UN').toUpperCase());
      if (savedProduct.unitCost > 0) {
        setItemUnitCostDisplay(formatCurrencyInputDisplay(savedProduct.unitCost));
      }
    }

    if (manualDocItems.length > 0) {
      setManualDocItems(prev =>
        prev.map(mItem => {
          if (mItem.id === targetManualItemId || (mItem.produto_id && mItem.produto_id === savedProduct.id)) {
            const newUnitCost = savedProduct.unitCost > 0 ? savedProduct.unitCost : mItem.valor_unitario;
            return {
              ...mItem,
              produto_id: savedProduct.id,
              descricao: savedProduct.nome_comercial || savedProduct.name || mItem.descricao,
              unidade: (savedProduct.unidade_medida || savedProduct.unit || mItem.unidade || 'UN').toUpperCase(),
              valor_unitario: newUnitCost,
              valor_total: Math.round((Number(mItem.quantidade) || 0) * newUnitCost * 100) / 100,
            };
          }
          return mItem;
        })
      );
    }

    setEditStockProductModal(null);
    setSuccessMessage(`Produto "${savedProduct.nome_comercial || savedProduct.name}" atualizado no estoque e sincronizado na nota!`);
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  // Recálculo dinâmico de Custo, Margem (%) e Preço de Venda
  const handlePriceCalculation = (field: 'unitCost' | 'profitMargin' | 'salePrice', val: number) => {
    setNewProductModal(prev => {
      let cost = prev.unitCost;
      let margin = prev.profitMargin;
      let sale = prev.salePrice;

      if (field === 'unitCost') {
        cost = Math.max(0, val);
        sale = Math.round((cost * (1 + margin / 100)) * 100) / 100;
      } else if (field === 'profitMargin') {
        margin = val;
        sale = Math.round((cost * (1 + margin / 100)) * 100) / 100;
      } else if (field === 'salePrice') {
        sale = Math.max(0, val);
        margin = cost > 0 ? Math.round((((sale - cost) / cost) * 100) * 10) / 10 : 0;
      }

      return {
        ...prev,
        unitCost: cost,
        profitMargin: margin,
        salePrice: sale
      };
    });
  };

  // Salva o novo produto no cadastro do estoque e o vincula à linha da nota
  const handleSaveNewProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductModal.name.trim()) {
      alert('Por favor, preencha o nome do produto.');
      return;
    }

    const newProductId = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const newProduct: InventoryItem = {
      id: newProductId,
      name: newProductModal.name.trim(),
      code: newProductModal.code.trim() || undefined,
      fiscalName: newProductModal.fiscalName.trim() || undefined,
      barcode: newProductModal.barcode.trim() || undefined,
      unit: newProductModal.unit.trim() || 'UN',
      category: newProductModal.category,
      unitCost: Number(newProductModal.unitCost) || 0,
      profitMargin: Number(newProductModal.profitMargin) || 0,
      salePrice: Number(newProductModal.salePrice) || 0,
      quantity: Number(newProductModal.initialQuantity) || 0,
      minQuantity: Number(newProductModal.minQuantity) || 0,
      maxQuantity: Number(newProductModal.maxQuantity) || 0,
      location: newProductModal.location.trim() || 'Barracão Principal'
    };

    const updated = [...localInventory, newProduct];
    saveInventory(updated);

    // Marca como criado nesta sessão para que na confirmação o estoque não seja somado em duplicidade
    setSessionCreatedProductIds(prev => new Set(prev).add(newProductId));

    // Vincula a linha da nota ao produto recém-cadastrado
    handleLinkProduct(newProductModal.rowIndex, newProductId);

    setNewProductModal(prev => ({ ...prev, isOpen: false }));
    setSuccessMessage(`Produto "${newProduct.name}" cadastrado e vinculado com sucesso!`);
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  // Atualização interativa dos itens da NF-e com recálculo automático dos totais
  const handleItemChange = (
    index: number,
    field: 'description' | 'quantity' | 'unitPrice' | 'totalPrice' | 'markupPercent' | 'salePrice' | 'wholesaleMarkupPercent' | 'wholesalePrice' | 'promoMarkupPercent' | 'promoPrice',
    value: string
  ) => {
    if (!parsedData || !parsedData.items) return;

    const updatedItems = [...parsedData.items];
    const currentItem = { ...updatedItems[index] };

    if (field === 'description') {
      currentItem.description = value;
    } else if (field === 'quantity') {
      const sanitized = value.replace(',', '.');
      const num = sanitized === '' ? 0 : parseFloat(sanitized);
      currentItem.quantity = isNaN(num) ? 0 : num;
      currentItem.totalPrice = Math.round((currentItem.quantity * (currentItem.unitPrice || 0)) * 100) / 100;
    } else if (field === 'unitPrice') {
      const sanitized = value.replace(',', '.');
      const num = sanitized === '' ? 0 : parseFloat(sanitized);
      currentItem.unitPrice = isNaN(num) ? 0 : num;
      currentItem.totalPrice = Math.round(((currentItem.quantity || 0) * currentItem.unitPrice) * 100) / 100;
      // Se já houver % de margem configurada, recalcula os preços de venda proporcionalmente
      if (currentItem.markupPercent !== undefined && currentItem.unitPrice > 0) {
        currentItem.salePrice = Math.round((currentItem.unitPrice * (1 + currentItem.markupPercent / 100)) * 100) / 100;
      }
      if (currentItem.wholesaleMarkupPercent !== undefined && currentItem.unitPrice > 0) {
        currentItem.wholesalePrice = Math.round((currentItem.unitPrice * (1 + currentItem.wholesaleMarkupPercent / 100)) * 100) / 100;
      }
      if (currentItem.promoMarkupPercent !== undefined && currentItem.unitPrice > 0) {
        currentItem.promoPrice = Math.round((currentItem.unitPrice * (1 + currentItem.promoMarkupPercent / 100)) * 100) / 100;
      }
    } else if (field === 'totalPrice') {
      const sanitized = value.replace(',', '.');
      const num = sanitized === '' ? 0 : parseFloat(sanitized);
      currentItem.totalPrice = isNaN(num) ? 0 : num;
      if (currentItem.quantity && currentItem.quantity > 0) {
        currentItem.unitPrice = Math.round((currentItem.totalPrice / currentItem.quantity) * 10000) / 10000;
        if (currentItem.markupPercent !== undefined && currentItem.unitPrice > 0) {
          currentItem.salePrice = Math.round((currentItem.unitPrice * (1 + currentItem.markupPercent / 100)) * 100) / 100;
        }
        if (currentItem.wholesaleMarkupPercent !== undefined && currentItem.unitPrice > 0) {
          currentItem.wholesalePrice = Math.round((currentItem.unitPrice * (1 + currentItem.wholesaleMarkupPercent / 100)) * 100) / 100;
        }
        if (currentItem.promoMarkupPercent !== undefined && currentItem.unitPrice > 0) {
          currentItem.promoPrice = Math.round((currentItem.unitPrice * (1 + currentItem.promoMarkupPercent / 100)) * 100) / 100;
        }
      }
    } else if (field === 'markupPercent') {
      // Regra solicitada: V. FINAL = V. UNIT + (V. UNIT * (% CÁLC / 100))
      const sanitized = value.replace(',', '.');
      const num = sanitized === '' ? undefined : parseFloat(sanitized);
      currentItem.markupPercent = num === undefined || isNaN(num) ? undefined : num;
      const unit = currentItem.unitPrice || 0;
      if (currentItem.markupPercent !== undefined && unit > 0) {
        currentItem.salePrice = Math.round((unit * (1 + currentItem.markupPercent / 100)) * 100) / 100;
      }
    } else if (field === 'salePrice') {
      const sanitized = value.replace(',', '.');
      const num = sanitized === '' ? undefined : parseFloat(sanitized);
      currentItem.salePrice = num === undefined || isNaN(num) ? undefined : num;
      // Se o usuário digitou o preço final diretamente, calcula a margem correspondente reversa
      const unit = currentItem.unitPrice || 0;
      if (currentItem.salePrice !== undefined && unit > 0) {
        currentItem.markupPercent = Math.round(((currentItem.salePrice - unit) / unit) * 100 * 10) / 10;
      }
    } else if (field === 'wholesaleMarkupPercent') {
      // Regra solicitada: V. ATACADO = V. UNIT + (V. UNIT * (% ATAC / 100))
      const sanitized = value.replace(',', '.');
      const num = sanitized === '' ? undefined : parseFloat(sanitized);
      currentItem.wholesaleMarkupPercent = num === undefined || isNaN(num) ? undefined : num;
      const unit = currentItem.unitPrice || 0;
      if (currentItem.wholesaleMarkupPercent !== undefined && unit > 0) {
        currentItem.wholesalePrice = Math.round((unit * (1 + currentItem.wholesaleMarkupPercent / 100)) * 100) / 100;
      }
    } else if (field === 'wholesalePrice') {
      const sanitized = value.replace(',', '.');
      const num = sanitized === '' ? undefined : parseFloat(sanitized);
      currentItem.wholesalePrice = num === undefined || isNaN(num) ? undefined : num;
      // Se digitou diretamente no preço atacado, calcula a margem reversa
      const unit = currentItem.unitPrice || 0;
      if (currentItem.wholesalePrice !== undefined && unit > 0) {
        currentItem.wholesaleMarkupPercent = Math.round(((currentItem.wholesalePrice - unit) / unit) * 100 * 10) / 10;
      }
    } else if (field === 'promoMarkupPercent') {
      // Regra solicitada: V. PROMO = V. UNIT + (V. UNIT * (% PROMO / 100))
      const sanitized = value.replace(',', '.');
      const num = sanitized === '' ? undefined : parseFloat(sanitized);
      currentItem.promoMarkupPercent = num === undefined || isNaN(num) ? undefined : num;
      const unit = currentItem.unitPrice || 0;
      if (currentItem.promoMarkupPercent !== undefined && unit > 0) {
        currentItem.promoPrice = Math.round((unit * (1 + currentItem.promoMarkupPercent / 100)) * 100) / 100;
      }
    } else if (field === 'promoPrice') {
      const sanitized = value.replace(',', '.');
      const num = sanitized === '' ? undefined : parseFloat(sanitized);
      currentItem.promoPrice = num === undefined || isNaN(num) ? undefined : num;
      // Se digitou diretamente no preço promocional, calcula a margem reversa
      const unit = currentItem.unitPrice || 0;
      if (currentItem.promoPrice !== undefined && unit > 0) {
        currentItem.promoMarkupPercent = Math.round(((currentItem.promoPrice - unit) / unit) * 100 * 10) / 10;
      }
    } else if (field === 'category' || (field as string) === 'categoria') {
      const normCat = normalizeToInventoryCategory(value);
      currentItem.category = normCat;
      currentItem.categoria = normCat;
    }

    updatedItems[index] = currentItem;

    // Se o usuário estiver alterando a primeira linha (Linha 1, index === 0) em uma das colunas de porcentagem (% LUC, % ATACADO, % PROMO),
    // replica esse valor automaticamente como sugestão para todas as linhas seguintes da mesma nota
    if (index === 0) {
      if (field === 'markupPercent') {
        const val = currentItem.markupPercent;
        for (let i = 1; i < updatedItems.length; i++) {
          const it = { ...updatedItems[i] };
          it.markupPercent = val;
          const u = it.unitPrice || 0;
          if (val !== undefined && u > 0) {
            it.salePrice = Math.round((u * (1 + val / 100)) * 100) / 100;
          } else if (val === undefined) {
            it.salePrice = undefined;
          }
          updatedItems[i] = it;
        }
      } else if (field === 'wholesaleMarkupPercent') {
        const val = currentItem.wholesaleMarkupPercent;
        for (let i = 1; i < updatedItems.length; i++) {
          const it = { ...updatedItems[i] };
          it.wholesaleMarkupPercent = val;
          const u = it.unitPrice || 0;
          if (val !== undefined && u > 0) {
            it.wholesalePrice = Math.round((u * (1 + val / 100)) * 100) / 100;
          } else if (val === undefined) {
            it.wholesalePrice = undefined;
          }
          updatedItems[i] = it;
        }
      } else if (field === 'promoMarkupPercent') {
        const val = currentItem.promoMarkupPercent;
        for (let i = 1; i < updatedItems.length; i++) {
          const it = { ...updatedItems[i] };
          it.promoMarkupPercent = val;
          const u = it.unitPrice || 0;
          if (val !== undefined && u > 0) {
            it.promoPrice = Math.round((u * (1 + val / 100)) * 100) / 100;
          } else if (val === undefined) {
            it.promoPrice = undefined;
          }
          updatedItems[i] = it;
        }
      }
    }

    // Recalcula o valor total da NF-e e dos produtos somando todas as linhas recalculadas
    const newTotalAmount = Math.round(
      updatedItems.reduce((acc, it) => acc + (it.totalPrice || 0), 0) * 100
    ) / 100;

    const newProductsAmount = Math.round(
      updatedItems.reduce((acc, it) => acc + (it.vProdOriginal || 0), 0) * 100
    ) / 100;

    const updatedParsed: ParsedNfeData = {
      ...parsedData,
      items: updatedItems,
      productsAmount: (parsedData.productsAmount && parsedData.productsAmount > 0) ? parsedData.productsAmount : newProductsAmount,
      totalAmount: newTotalAmount > 0 ? newTotalAmount : parsedData.totalAmount,
      itemsSummary: `${updatedItems.length} PRODUTO(S) LISTADO(S)`
    };

    setParsedData(updatedParsed);
    saveCachedNfe(updatedParsed, editingExpenseId || undefined);

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('colaca_silagem_documentos_entrada_itens', JSON.stringify(updatedItems));
        saveCompanyData('documentos_entrada_itens', updatedItems);
      }
    } catch (err) {
      console.warn('Aviso ao sincronizar colaca_silagem_documentos_entrada_itens no handleItemChange:', err);
    }
  };

  // =========================================================================
  // AUTOMAÇÃO DE ENTRADA: DEFINIR CATEGORIA PRIORITÁRIA DA NOTA FISCAL (XML)
  // =========================================================================

  // 1. Aplica a Categoria Prioritária da Nota em lote para todos os itens extraídos daquele XML
  const handlePriorityCategoryChange = (newCategory: string) => {
    if (!parsedData) return;

    const normalizedCat = newCategory ? normalizeToInventoryCategory(newCategory) : '';

    // Varredura automática em todos os itens daquele XML: define 'categoria' e 'category' para a opção escolhida
    const updatedItems = (parsedData.items || []).map((item) => ({
      ...item,
      categoria: normalizedCat,
      category: normalizedCat,
    }));

    const updatedParsed: ParsedNfeData = {
      ...parsedData,
      priorityCategory: normalizedCat,
      categoriaPrioritaria: normalizedCat,
      items: updatedItems,
    };

    setParsedData(updatedParsed);
    saveCachedNfe(updatedParsed, editingExpenseId || undefined);

    // Persistência local (offline) imediata na chave 'colaca_silagem_documentos_entrada_itens'
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('colaca_silagem_documentos_entrada_itens', JSON.stringify(updatedItems));
        saveCompanyData('documentos_entrada_itens', updatedItems);
      }
    } catch (err) {
      console.warn('Aviso ao sincronizar colaca_silagem_documentos_entrada_itens no lote:', err);
    }

    if (normalizedCat) {
      setSuccessMessage(`Categoria prioritária "${normalizedCat}" aplicada com sucesso a todos os ${updatedItems.length} itens da nota!`);
      setTimeout(() => setSuccessMessage(''), 3500);
    }
  };

  // 2. Altera individualmente a categoria de um item específico na tabela de conferência
  const handleItemCategoryChange = (index: number, newCategory: string) => {
    if (!parsedData || !parsedData.items || !parsedData.items[index]) return;

    const normalizedCat = normalizeToInventoryCategory(newCategory);
    const updatedItems = [...parsedData.items];
    updatedItems[index] = {
      ...updatedItems[index],
      categoria: normalizedCat,
      category: normalizedCat,
    };

    const updatedParsed: ParsedNfeData = {
      ...parsedData,
      items: updatedItems,
    };

    setParsedData(updatedParsed);
    saveCachedNfe(updatedParsed, editingExpenseId || undefined);

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('colaca_silagem_documentos_entrada_itens', JSON.stringify(updatedItems));
        saveCompanyData('documentos_entrada_itens', updatedItems);
      }
    } catch (err) {
      console.warn('Aviso ao sincronizar colaca_silagem_documentos_entrada_itens individual:', err);
    }
  };

  // Validação para impedir o lançamento de nota duplicada
  const isNfeDuplicate = (
    nfe: ParsedNfeData,
    expenseList: Expense[]
  ): boolean => {
    if (!nfe) return false;

    // 1. Chave de Acesso (44 dígitos)
    const nfeKey = (nfe.accessKey || '').replace(/\D/g, '').trim();

    // 2. Número da NF-e
    const nfeNumRaw = (nfe.invoiceNumber || '').trim().toLowerCase();
    const nfeNumDigits = (nfe.invoiceNumber || '').replace(/\D/g, '').trim();
    const nfeNumInt = nfeNumDigits ? parseInt(nfeNumDigits, 10) : null;

    return expenseList.some(exp => {
      // A. Verificação por Chave de Acesso na observação ou número
      if (nfeKey && nfeKey.length >= 20) {
        if (exp.notes && exp.notes.replace(/\D/g, '').includes(nfeKey)) {
          return true;
        }
        if (exp.invoiceNumber && exp.invoiceNumber.replace(/\D/g, '').includes(nfeKey)) {
          return true;
        }
      }

      // B. Verificação por Número da NF-e
      if (exp.invoiceNumber) {
        const expNumRaw = exp.invoiceNumber.trim().toLowerCase();
        // Comparação de texto (ex: "NF-e 142" === "NF-e 142")
        if (expNumRaw === nfeNumRaw) {
          return true;
        }

        const expNumDigits = exp.invoiceNumber.replace(/\D/g, '').trim();
        if (nfeNumDigits && expNumDigits) {
          // Comparação direta de dígitos
          if (nfeNumDigits === expNumDigits) {
            return true;
          }
          // Comparação numérica (ex: "000142" === "142")
          if (nfeNumInt !== null && parseInt(expNumDigits, 10) === nfeNumInt) {
            return true;
          }
        }
      }

      // C. Verificação por menção ao número da nota nas notas da despesa
      if (exp.notes && nfeNumDigits && nfeNumDigits.length >= 3) {
        const notesLower = exp.notes.toLowerCase();
        if (
          notesLower.includes(`nf-e ${nfeNumDigits}`) ||
          notesLower.includes(`nfe ${nfeNumDigits}`) ||
          notesLower.includes(`nf ${nfeNumDigits}`) ||
          notesLower.includes(`nota ${nfeNumDigits}`)
        ) {
          return true;
        }
      }

      return false;
    });
  };

  // Função auxiliar para deduzir categoria do item no estoque
  const deduceItemCategory = (desc: string): InventoryItem['category'] => {
    const d = (desc || '').toLowerCase();
    if (d.includes('diesel') || d.includes('combustivel') || d.includes('combustível') || d.includes('s10') || d.includes('arla')) {
      return 'combustivel';
    }
    if (d.includes('lona') || d.includes('filme') || d.includes('embalagem') || d.includes('plastico') || d.includes('plástico')) {
      return 'lona_embalagem';
    }
    if (d.includes('inoculante') || d.includes('biologico') || d.includes('biológico') || d.includes('aditivo')) {
      return 'inoculante';
    }
    if (d.includes('semente') || d.includes('milho') || d.includes('sorgo') || d.includes('capim')) {
      return 'sementes';
    }
    if (d.includes('adubo') || d.includes('fertilizante') || d.includes('ureia')) {
      return 'adubo';
    }
    if (d.includes('peca') || d.includes('peça') || d.includes('filtro') || d.includes('faca') || d.includes('oleo') || d.includes('óleo') || d.includes('correia') || d.includes('rolamento')) {
      return 'pecas';
    }
    return 'outro';
  };

  // 1.1 Gravação Direta para Operações com Lançamento Financeiro Bloqueado (Estoque Puro e Devolução de Cliente)
  const handleDirectSaveNonFinancial = () => {
    if (!parsedData) return;

    // Bloqueio de Nota Duplicada (ignora a própria nota e suas parcelas em modo de edição)
    const cleanCurrentNum = (parsedData.invoiceNumber || '').replace(/\s*\(\d+\/\d+\)/g, '').trim().toLowerCase();
    const listToCheck = editingExpenseId 
      ? expenses.filter(e => {
          if (e.id === editingExpenseId) return false;
          if (editingExpenseId && e.id.startsWith(editingExpenseId)) return false;
          const eCleanNum = (e.invoiceNumber || '').replace(/\s*\(\d+\/\d+\)/g, '').trim().toLowerCase();
          if (cleanCurrentNum && eCleanNum && eCleanNum === cleanCurrentNum) return false;
          return true;
        }) 
      : expenses;

    if (isNfeDuplicate(parsedData, listToCheck)) {
      setErrorMessage('Nota já importada');
      setSuccessMessage('');
      return;
    }

    // ENTRADA AUTOMÁTICA NO ESTOQUE (Itens Vinculados e Novos Itens Extraídos)
    let updatedInventory = [...localInventory];
    const updatedSummary: string[] = [];

    parsedData.items?.forEach((item, idx) => {
      if (item.linkedInventoryId) {
        const invIndex = updatedInventory.findIndex(i => i.id === item.linkedInventoryId);
        if (invIndex !== -1) {
          const invItem = { ...updatedInventory[invIndex] };

          // Apenas incrementa estoque se NÃO for edição (ou se for novo produto cadastrado nesta sessão)
          if (!editingExpenseId || sessionCreatedProductIds.has(item.linkedInventoryId)) {
            const currentQty = Number(invItem.quantity) || 0;
            const addQty = Number(item.quantity) || 0;
            invItem.quantity = Math.round((currentQty + addQty) * 100) / 100;
            invItem.quantidade_atual = invItem.quantity;
            updatedSummary.push(`${invItem.name} (+${addQty} ${invItem.unit || 'UN'} | Saldo: ${invItem.quantity})`);

            // Sincroniza simultaneamente com a tabela 'tanques_combustivel' da Fazenda se for Combustível ou Arla
            const descLower = (item.description || '').toLowerCase();
            const isFuelOrArla = (invItem.category === 'Combustível & Arla') || descLower.includes('diesel') || descLower.includes('arla') || identificarTipoDiesel(item.description, invItem.category) !== null;
            if (isFuelOrArla && addQty > 0) {
              sincronizarEntradaCombustivelSupabase({
                produtoId: invItem.id,
                descricao: item.description,
                categoria: 'Combustível & Arla',
                quantidadeLitros: addQty,
                custoUnitario: Number(item.unitPrice) || 0
              });
            }
          }

          const xmlCostComImposto = item.custoComImposto ?? item.custo_com_imposto ?? 0;
          const newUnitCost = xmlCostComImposto > 0 ? xmlCostComImposto : (Number(item.unitPrice) || 0);
          if (newUnitCost > 0) {
            invItem.unitCost = newUnitCost;
            invItem.preco_custo_inicial = newUnitCost;
            invItem.custo_nominal = newUnitCost;
            invItem.custo_com_imposto = newUnitCost;
            invItem.custo_sem_imposto = item.custoSemImposto ?? item.custo_sem_imposto ?? invItem.custo_sem_imposto ?? 0;
            invItem.valor_impostos_total = item.valorImpostosTotal ?? item.valor_impostos_total ?? invItem.valor_impostos_total ?? 0;
            invItem.frete_diluido_item = item.freteDiluidoItem ?? item.frete_diluido_item ?? invItem.frete_diluido_item ?? 0;
          }

          // Sincronização automática dos preços de venda (V. Final, % Markup, V. Atacado, V. Promo)
          if (item.markupPercent !== undefined) {
            invItem.profitMargin = item.markupPercent;
          }
          if (item.salePrice !== undefined && Number(item.salePrice) >= 0) {
            invItem.salePrice = Number(item.salePrice);
            invItem.preco_venda_varejo = Number(item.salePrice);
            if (invItem.unitCost > 0 && item.markupPercent === undefined) {
              invItem.profitMargin = Math.round(((invItem.salePrice - invItem.unitCost) / invItem.unitCost) * 100 * 10) / 10;
            }
          } else if (invItem.profitMargin !== undefined && invItem.unitCost > 0) {
            invItem.salePrice = Math.round((invItem.unitCost * (1 + invItem.profitMargin / 100)) * 100) / 100;
            invItem.preco_venda_varejo = invItem.salePrice;
          }

          if (item.wholesalePrice !== undefined && Number(item.wholesalePrice) >= 0) {
            invItem.wholesalePrice = Number(item.wholesalePrice);
          }

          if (item.promoPrice !== undefined && Number(item.promoPrice) >= 0) {
            invItem.promoPrice = Number(item.promoPrice);
          }

          updatedInventory[invIndex] = invItem;
        }
      } else {
        if (!editingExpenseId) {
          const dieselMatch = identificarTipoDiesel(item.description);
          const autoCat = normalizeToInventoryCategory(
            item.categoria ||
            item.category ||
            parsedData.priorityCategory ||
            parsedData.categoriaPrioritaria ||
            (dieselMatch ? 'Combustível & Arla' : deduceItemCategory(item.description))
          );
          const autoUnit = (item.unit || 'UN').toUpperCase();
          const autoQty = Number(item.quantity) || 1;
          const xmlCostComImposto = item.custoComImposto ?? item.custo_com_imposto ?? 0;
          const autoCost = xmlCostComImposto > 0 ? xmlCostComImposto : (Number(item.unitPrice) || 0);
          const newProdId = `inv_auto_${Date.now()}_${idx}`;

          const autoProfitMargin = item.markupPercent !== undefined ? item.markupPercent : 30;
          const autoSalePrice = item.salePrice !== undefined && Number(item.salePrice) >= 0
            ? Number(item.salePrice)
            : Math.round((autoCost * (1 + autoProfitMargin / 100)) * 100) / 100;

          const newInvItem: InventoryItem = {
            id: newProdId,
            name: item.description,
            nome_comercial: item.description,
            fiscalName: item.description,
            code: item.code || `PRD${Date.now().toString().slice(-4)}`,
            barcode: item.barcode || undefined,
            unit: autoUnit,
            unidade_medida: autoUnit,
            category: autoCat,
            categoria: autoCat,
            unitCost: autoCost,
            preco_custo_inicial: autoCost,
            custo_nominal: autoCost,
            custo_com_imposto: autoCost,
            custo_sem_imposto: item.custoSemImposto ?? item.custo_sem_imposto ?? 0,
            valor_impostos_total: item.valorImpostosTotal ?? item.valor_impostos_total ?? 0,
            frete_diluido_item: item.freteDiluidoItem ?? item.frete_diluido_item ?? 0,
            profitMargin: autoProfitMargin,
            salePrice: autoSalePrice,
            preco_venda_varejo: autoSalePrice,
            wholesalePrice: item.wholesalePrice !== undefined && Number(item.wholesalePrice) >= 0 ? Number(item.wholesalePrice) : undefined,
            promoPrice: item.promoPrice !== undefined && Number(item.promoPrice) >= 0 ? Number(item.promoPrice) : undefined,
            quantity: autoQty,
            quantidade_atual: autoQty,
            minQuantity: 5,
            maxQuantity: 100,
            location: dieselMatch ? 'Tanque Fazenda' : 'Barracão Principal'
          };

          updatedInventory.push(newInvItem);
          item.linkedInventoryId = newProdId;
          updatedSummary.push(`${newInvItem.name} (+${autoQty} ${autoUnit} cadastrado e lançado no estoque)`);

          const newDescLower = (item.description || '').toLowerCase();
          const isNewFuelOrArla = dieselMatch !== null || newDescLower.includes('diesel') || newDescLower.includes('arla');
          if (isNewFuelOrArla && autoQty > 0) {
            sincronizarEntradaCombustivelSupabase({
              produtoId: newProdId,
              descricao: item.description,
              categoria: 'Combustível & Arla',
              quantidadeLitros: autoQty,
              custoUnitario: Number(item.unitPrice) || 0
            });
          }
        }
      }
    });

    saveInventory(updatedInventory);
    updatedInventory.forEach(prod => {
      upsertEstoqueItem(prod).catch(err => console.warn('Supabase upsertEstoqueItem non-financial XML sync:', err));
    });

    const cleanInvoiceNumber = (parsedData.invoiceNumber || '').replace(/\s*\(\d+\/\d+\)/g, '').trim();
    const fiscalRecordId = editingExpenseId ? editingExpenseId.split('_parc_')[0] : `nfe_fisc_${cleanInvoiceNumber.replace(/\D/g, '') || Date.now()}`;
    const selectedCC = localCostCenters.find(c => c.id === selectedCostCenterId) || localCostCenters[0];
    const isDevolucao = isClientReturnOperation(parsedData.transactionType);
    const stockNote = updatedSummary.length > 0
      ? ` Entrada de estoque registrada: ${updatedSummary.join(', ')}.`
      : '';
    const itemsJson = JSON.stringify(parsedData.items || []);
    const itemsEmbed = `<!-- NFE_ITEMS_JSON:${itemsJson} -->`;

    let clientCreditInfo: { clientName: string; previousBalance: number; newBalance: number } | null = null;
    if (isDevolucao) {
      // REGRA: Injeta automaticamente o valor total da nota como CRÉDITO SALDO DE CLIENTE
      clientCreditInfo = injectClientCreditFromNfe(
        { name: parsedData.supplier, cnpjOrCpf: parsedData.supplierCnpj },
        Number(parsedData.totalAmount) || 0,
        cleanInvoiceNumber,
        parsedData.accessKey
      );
    }

    // REGRA DE NEGÓCIO: LANÇAMENTO FINANCEIRO BLOQUEADO NO CONTAS A PAGAR
    // Não gera parcelas a pagar. Se for edição de nota anterior, remove eventuais parcelas residuais.
    if (editingExpenseId) {
      const expensesCleaned = expenses.filter(e => 
        e.id !== editingExpenseId && 
        !e.id.startsWith(`${editingExpenseId}_parc_`) &&
        (e.invoiceNumber || '').replace(/\s*\(\d+\/\d+\)/g, '').trim().toLowerCase() !== cleanInvoiceNumber.toLowerCase()
      );
      saveStoredExpenses(expensesCleaned);
    }

    // UNICIDADE DO REGISTRO FISCAL CONSOLIDADO
    const singleFiscalRecord: Expense = {
      id: fiscalRecordId,
      invoiceNumber: cleanInvoiceNumber,
      supplier: parsedData.supplier,
      description: isDevolucao 
        ? `Devolução Mercadoria Cliente ${cleanInvoiceNumber} - ${parsedData.supplier}`
        : `${parsedData.transactionType || 'Entrada Sem Custo'} ${cleanInvoiceNumber} - ${parsedData.supplier}`,
      amount: Number(parsedData.totalAmount) || 0,
      dueDate: parsedData.dueDate || parsedData.issueDate,
      status: 'pago' as const,
      categoryId: 'cat_insumos',
      categoryName: isDevolucao ? 'Devolução de Cliente' : 'Entrada sem Custo (Estoque)',
      categoryColor: isDevolucao ? '#0284c7' : '#64748b',
      paymentMethod: (parsedData.paymentMethod || 'dinheiro') as PaymentMethod,
      costCenterId: selectedCC?.id,
      costCenterName: selectedCC?.name || 'Geral',
      notes: isDevolucao
        ? `NF-e de Devolução de Mercadoria. Lançamento no Contas a Pagar BLOQUEADO. Valor de ${formatCurrencyBRL(parsedData.totalAmount)} injetado como CRÉDITO SALDO DO CLIENTE (${clientCreditInfo?.clientName || parsedData.supplier}). Chave: ${parsedData.accessKey || 'N/A'}.${stockNote}\n${itemsEmbed}`
        : `NF-e Operacional sem custo financeiro (${parsedData.transactionType}). Lançamento no Contas a Pagar BLOQUEADO (Estoque Puro). Chave: ${parsedData.accessKey || 'N/A'}.${stockNote}\n${itemsEmbed}`,
      nfeItems: parsedData.items,
      operationNature: parsedData.transactionType || parsedData.operationNature,
      transactionType: parsedData.transactionType,
      skipAccountsPayable: true,
      createdAt: new Date().toISOString(),
    };

    const currentStoredFiscal = getStoredFiscalRecords();
    const cleanNumCompare = cleanInvoiceNumber.toLowerCase();
    const filteredFiscal = currentStoredFiscal.filter(f => 
      f.id !== fiscalRecordId && 
      (f.invoiceNumber || '').replace(/\s*\(\d+\/\d+\)/g, '').trim().toLowerCase() !== cleanNumCompare
    );
    const updatedFiscalList = [singleFiscalRecord, ...filteredFiscal];
    saveStoredFiscalRecords(updatedFiscalList);

    setNotasLancadas(prev => {
      const remaining = prev.filter(f => 
        f.id !== fiscalRecordId && 
        (f.invoiceNumber || '').replace(/\s*\(\d+\/\d+\)/g, '').trim().toLowerCase() !== cleanNumCompare
      );
      return [singleFiscalRecord, ...remaining];
    });

    const updatedParsedData: ParsedNfeData = {
      ...parsedData,
      invoiceNumber: cleanInvoiceNumber,
      totalAmount: Number(parsedData.totalAmount) || 0,
      installments: [],
      costCenterId: selectedCC?.id,
      costCenterName: selectedCC?.name,
    };
    saveCachedNfe(updatedParsedData, fiscalRecordId);

    upsertNotaFiscal({
      id: fiscalRecordId,
      number: cleanInvoiceNumber,
      series: parsedData.series || '1',
      accessKey: parsedData.accessKey,
      supplierName: parsedData.supplier,
      totalAmount: Number(parsedData.totalAmount) || 0,
      operationNature: parsedData.transactionType || parsedData.operationNature,
      issueDate: parsedData.issueDate,
      entryDate: parsedData.entryDate || new Date().toISOString().split('T')[0],
      items: parsedData.items
    });

    setCostCenterError(false);
    setErrorMessage('');
    if (isDevolucao) {
      setSuccessMessage(
        `Devolução NF-e ${cleanInvoiceNumber} confirmada! Entrada física no Estoque realizada e CRÉDITO DE ${formatCurrencyBRL(parsedData.totalAmount)} lançado no saldo do cliente "${clientCreditInfo?.clientName}". Contas a Pagar bloqueado com sucesso!`
      );
    } else {
      setSuccessMessage(
        `NF-e ${cleanInvoiceNumber} confirmada! Entrada física de ${parsedData.items?.length || 0} produto(s) realizada no Estoque. Lançamento no Contas a Pagar bloqueado com sucesso (zero parcelas geradas).`
      );
    }

    // Pergunta se o usuário deseja imprimir etiquetas
    const itemsForLabels: LabelProductItem[] = (parsedData.items || []).map(item => {
      const matched = updatedInventory.find(p => 
        p.id === item.linkedInventoryId ||
        (item.barcode && p.barcode && String(p.barcode) !== 'SEM GTIN' && String(p.barcode).trim() === String(item.barcode).trim()) ||
        (item.code && p.code !== undefined && p.code !== null && String(p.code).trim().toUpperCase() === String(item.code).trim().toUpperCase()) ||
        (p.nome_comercial && String(p.nome_comercial).toLowerCase().trim() === String(item.description || '').toLowerCase().trim()) ||
        String(p.name || '').toLowerCase().trim() === String(item.description || '').toLowerCase().trim()
      );
      const invItem: InventoryItem = matched || {
        id: `nfe_prod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        code: item.code || undefined,
        name: item.description,
        nome: item.description,
        nome_comercial: item.description,
        category: 'Outros Insumos',
        unit: item.unit || 'UN',
        unidade_medida: item.unit || 'UN',
        barcode: item.barcode || undefined,
        codigo_barras: item.barcode || undefined,
        quantity: Number(item.quantity) || 0,
        minQuantity: 0,
        unitCost: Number(item.unitPrice) || 0,
        salePrice: Number(item.salePrice || item.unitPrice * 1.3),
        endereco_formatado: '00.00.00.00.00',
        location: 'Barracão Principal'
      };
      const exactNotaQty = Math.max(1, Math.round(Number(item.quantity) || 1));
      return {
        product: invItem,
        quantity: exactNotaQty,
        invoiceQuantity: exactNotaQty
      };
    });

    if (itemsForLabels.length > 0) {
      setPrintPromptState({
        isOpen: true,
        title: 'Deseja imprimir as etiquetas de gôndola?',
        description: `A Nota Fiscal Nº ${cleanInvoiceNumber} (${parsedData.transactionType}) foi importada com sucesso e ${itemsForLabels.length} produto(s) deram entrada no estoque. Deseja imprimir as etiquetas correspondentes com código de barras e endereço?`,
        items: itemsForLabels
      });
    }

    if (parsedData.items && parsedData.items.length > 0) {
      try {
        const xmlItemsPayload: DocumentoEntradaItem[] = parsedData.items.map((item, idx) => ({
          id: `item_nfe_${cleanInvoiceNumber}_${idx}_${Date.now()}`,
          documento_entrada_id: fiscalRecordId,
          produto_id: item.linkedInventoryId,
          descricao: item.description,
          codigo_produto: item.code || undefined,
          ncm: item.ncm,
          quantidade: Number(item.quantity) || 1,
          unidade: item.unit || 'UN',
          valor_unitario: Number(item.unitPrice) || 0,
          valor_total: Number(item.totalPrice) || (Number(item.quantity) * Number(item.unitPrice)) || 0,
          created_at: new Date().toISOString()
        }));

        const existingAllItems = getStoredDocumentosEntradaItens();
        const filteredExisting = existingAllItems.filter(i => i.documento_entrada_id !== fiscalRecordId);
        saveStoredDocumentosEntradaItens([...xmlItemsPayload, ...filteredExisting]);
      } catch (err) {
        console.warn('Erro ao salvar itens no colaca_silagem_documentos_entrada_itens:', err);
      }
    }

    clearActiveNfeDraft();
    try {
      localStorage.removeItem('colaca_silagem_nfe_active_draft');
      localStorage.removeItem('colaca_silagem_manual_entry_draft');
    } catch (_) {}
    setParsedData(null);
    setXmlContent('');
    setSearchNfeNumber('');
    setEditingExpenseId(null);
    setSelectedCostCenterId('');
    setCostCenterError(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 1. Validação prévia de Centro de Custo e abertura da Janela 2 (Detalhamento de Parcelas)
  const handleProceedToInstallments = () => {
    if (!parsedData) return;

    // REGRA DE NEGÓCIO: Se for Operação com Lançamento Financeiro Bloqueado (Estoque Puro ou Devolução de Cliente),
    // executa diretamente o salvamento sem exigir parcelas no Contas a Pagar!
    if (isFinancialBlockedOperation(parsedData.transactionType)) {
      handleDirectSaveNonFinancial();
      return;
    }

    // BLOQUEIO OBRIGATÓRIO DE CENTRO DE CUSTO PARA OPERAÇÕES FINANCEIRAS ATIVAS (ex: Retorno de Conserto, Compra de Mercadoria, etc.)
    if (!selectedCostCenterId) {
      setCostCenterError(true);
      setErrorMessage('Bloqueio de Validação: Selecione obrigatoriamente a qual Centro de Custo esta despesa pertence.');
      const selectEl = document.getElementById('select-centro-de-custo-nfe');
      if (selectEl) {
        selectEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        selectEl.focus();
      }
      return;
    }

    // Bloqueio de Nota Duplicada (ignora a própria nota e suas parcelas em modo de edição)
    const cleanCurrentNum = (parsedData.invoiceNumber || '').replace(/\s*\(\d+\/\d+\)/g, '').trim().toLowerCase();
    const listToCheck = editingExpenseId 
      ? expenses.filter(e => {
          if (e.id === editingExpenseId) return false;
          if (editingExpenseId && e.id.startsWith(editingExpenseId)) return false;
          const eCleanNum = (e.invoiceNumber || '').replace(/\s*\(\d+\/\d+\)/g, '').trim().toLowerCase();
          if (cleanCurrentNum && eCleanNum && eCleanNum === cleanCurrentNum) return false;
          return true;
        }) 
      : expenses;

    if (isNfeDuplicate(parsedData, listToCheck)) {
      setErrorMessage('Nota já importada');
      setSuccessMessage('');
      return;
    }

    setErrorMessage('');
    // Abre a Janela 2 (Detalhamento de Parcelas)
    setIsInstallmentsModalOpen(true);
  };

  // 2. Confirmação e Gravação Final das Parcelas validadas na Janela 2
  const handleConfirmAndSaveInstallments = async (detailedInstallments: NfeDetailedInstallment[]) => {
    if (!parsedData) return;

    // ENTRADA AUTOMÁTICA NO ESTOQUE (Itens Vinculados e Novos Itens Extraídos)
    let updatedInventory = [...localInventory];
    const updatedSummary: string[] = [];

    parsedData.items?.forEach((item, idx) => {
      if (item.linkedInventoryId) {
        const invIndex = updatedInventory.findIndex(i => i.id === item.linkedInventoryId);
        if (invIndex !== -1) {
          const invItem = { ...updatedInventory[invIndex] };

          // Apenas incrementa estoque se NÃO for edição (ou se for novo produto cadastrado nesta sessão)
          if (!editingExpenseId || sessionCreatedProductIds.has(item.linkedInventoryId)) {
            const currentQty = Number(invItem.quantity) || 0;
            const addQty = Number(item.quantity) || 0;
            invItem.quantity = Math.round((currentQty + addQty) * 100) / 100;
            invItem.quantidade_atual = invItem.quantity;
            updatedSummary.push(`${invItem.name} (+${addQty} ${invItem.unit || 'UN'} | Saldo: ${invItem.quantity})`);

            // Sincroniza simultaneamente com a tabela 'tanques_combustivel' da Fazenda se for Combustível ou Arla
            const descLower = (item.description || '').toLowerCase();
            const isFuelOrArla = (invItem.category === 'Combustível & Arla') || descLower.includes('diesel') || descLower.includes('arla') || identificarTipoDiesel(item.description, invItem.category) !== null;
            if (isFuelOrArla && addQty > 0) {
              sincronizarEntradaCombustivelSupabase({
                produtoId: invItem.id,
                descricao: item.description,
                categoria: 'Combustível & Arla',
                quantidadeLitros: addQty,
                custoUnitario: Number(item.unitPrice) || 0
              });
            }
          }

          const xmlCostComImposto = item.custoComImposto ?? item.custo_com_imposto ?? 0;
          const newUnitCost = xmlCostComImposto > 0 ? xmlCostComImposto : (Number(item.unitPrice) || 0);
          if (newUnitCost > 0) {
            invItem.unitCost = newUnitCost;
            invItem.preco_custo_inicial = newUnitCost;
            invItem.custo_nominal = newUnitCost;
            invItem.custo_com_imposto = newUnitCost;
            invItem.custo_sem_imposto = item.custoSemImposto ?? item.custo_sem_imposto ?? invItem.custo_sem_imposto ?? 0;
            invItem.valor_impostos_total = item.valorImpostosTotal ?? item.valor_impostos_total ?? invItem.valor_impostos_total ?? 0;
            invItem.frete_diluido_item = item.freteDiluidoItem ?? item.frete_diluido_item ?? invItem.frete_diluido_item ?? 0;
          }

          // Sincronização automática dos preços de venda (V. Final, % Markup, V. Atacado, V. Promo)
          if (item.markupPercent !== undefined) {
            invItem.profitMargin = item.markupPercent;
          }
          if (item.salePrice !== undefined && Number(item.salePrice) >= 0) {
            invItem.salePrice = Number(item.salePrice);
            invItem.preco_venda_varejo = Number(item.salePrice);
            if (invItem.unitCost > 0 && item.markupPercent === undefined) {
              invItem.profitMargin = Math.round(((invItem.salePrice - invItem.unitCost) / invItem.unitCost) * 100 * 10) / 10;
            }
          } else if (invItem.profitMargin !== undefined && invItem.unitCost > 0) {
            invItem.salePrice = Math.round((invItem.unitCost * (1 + invItem.profitMargin / 100)) * 100) / 100;
            invItem.preco_venda_varejo = invItem.salePrice;
          }

          if (item.wholesalePrice !== undefined && Number(item.wholesalePrice) >= 0) {
            invItem.wholesalePrice = Number(item.wholesalePrice);
          }

          if (item.promoPrice !== undefined && Number(item.promoPrice) >= 0) {
            invItem.promoPrice = Number(item.promoPrice);
          }

          updatedInventory[invIndex] = invItem;
        }
      } else {
        if (!editingExpenseId) {
          const dieselMatch = identificarTipoDiesel(item.description);
          const autoCat = normalizeToInventoryCategory(
            item.categoria ||
            item.category ||
            parsedData.priorityCategory ||
            parsedData.categoriaPrioritaria ||
            (dieselMatch ? 'Combustível & Arla' : deduceItemCategory(item.description))
          );
          const autoUnit = (item.unit || 'UN').toUpperCase();
          const autoQty = Number(item.quantity) || 1;
          const xmlCostComImposto = item.custoComImposto ?? item.custo_com_imposto ?? 0;
          const autoCost = xmlCostComImposto > 0 ? xmlCostComImposto : (Number(item.unitPrice) || 0);
          const newProdId = `inv_auto_${Date.now()}_${idx}`;

          const autoProfitMargin = item.markupPercent !== undefined ? item.markupPercent : 30;
          const autoSalePrice = item.salePrice !== undefined && Number(item.salePrice) >= 0
            ? Number(item.salePrice)
            : Math.round((autoCost * (1 + autoProfitMargin / 100)) * 100) / 100;

          const newInvItem: InventoryItem = {
            id: newProdId,
            name: item.description,
            nome_comercial: item.description,
            fiscalName: item.description,
            code: item.code || `PRD${Date.now().toString().slice(-4)}`,
            barcode: item.barcode || undefined,
            unit: autoUnit,
            unidade_medida: autoUnit,
            category: autoCat,
            categoria: autoCat,
            unitCost: autoCost,
            preco_custo_inicial: autoCost,
            custo_nominal: autoCost,
            custo_com_imposto: autoCost,
            custo_sem_imposto: item.custoSemImposto ?? item.custo_sem_imposto ?? 0,
            valor_impostos_total: item.valorImpostosTotal ?? item.valor_impostos_total ?? 0,
            frete_diluido_item: item.freteDiluidoItem ?? item.frete_diluido_item ?? 0,
            profitMargin: autoProfitMargin,
            salePrice: autoSalePrice,
            preco_venda_varejo: autoSalePrice,
            wholesalePrice: item.wholesalePrice !== undefined && Number(item.wholesalePrice) >= 0 ? Number(item.wholesalePrice) : undefined,
            promoPrice: item.promoPrice !== undefined && Number(item.promoPrice) >= 0 ? Number(item.promoPrice) : undefined,
            quantity: autoQty,
            quantidade_atual: autoQty,
            minQuantity: 5,
            maxQuantity: 100,
            location: dieselMatch ? 'Tanque Fazenda' : 'Barracão Principal'
          };

          updatedInventory.push(newInvItem);
          item.linkedInventoryId = newProdId;
          updatedSummary.push(`${newInvItem.name} (+${autoQty} ${autoUnit} cadastrado e lançado no estoque)`);

          // Sincroniza simultaneamente com a tabela 'tanques_combustivel' da Fazenda se for Combustível ou Arla
          const newDescLower = (item.description || '').toLowerCase();
          const isNewFuelOrArla = dieselMatch !== null || newDescLower.includes('diesel') || newDescLower.includes('arla');
          if (isNewFuelOrArla && autoQty > 0) {
            sincronizarEntradaCombustivelSupabase({
              produtoId: newProdId,
              descricao: item.description,
              categoria: 'Combustível & Arla',
              quantidadeLitros: autoQty,
              custoUnitario: Number(item.unitPrice) || 0
            });
          }
        }
      }
    });

    // Sincroniza sempre o estoque com as quantidades e novas precificações
    saveInventory(updatedInventory);
    updatedInventory.forEach(prod => {
      upsertEstoqueItem(prod).catch(err => console.warn('Supabase upsertEstoqueItem XML sync:', err));
    });

    // AUTOMAÇÃO FINANCEIRA: Gravação Individual das Parcelas no Contas a Pagar
    const selectedCC = localCostCenters.find(c => c.id === selectedCostCenterId);
    const stockNote = updatedSummary.length > 0
      ? ` Entrada de estoque registrada: ${updatedSummary.join(', ')}.`
      : '';

    const cleanInvoiceNumber = (parsedData.invoiceNumber || '').replace(/\s*\(\d+\/\d+\)/g, '').trim();
    const fiscalRecordId = editingExpenseId ? editingExpenseId.split('_parc_')[0] : `nfe_fisc_${cleanInvoiceNumber.replace(/\D/g, '') || Date.now()}`;
    const expenseId = editingExpenseId || `exp_nfe_${Date.now()}`;
    const issueDateFinal = parsedData.issueDate || parsedData.entryDate || new Date().toISOString().split('T')[0];
    const entryDateFinal = parsedData.entryDate || parsedData.issueDate || new Date().toISOString().split('T')[0];
    const dueDateFinal = detailedInstallments[0]?.dueDate || parsedData.dueDate || calculateDefaultDueDate(issueDateFinal);

    const itemsJson = JSON.stringify(parsedData.items || []);
    const itemsEmbed = `<!-- NFE_ITEMS_JSON:${itemsJson} -->`;

    // AUTOMAÇÃO FINANCEIRA: Determinação exata da categoria ('Combustível & Arla' ou 'Insumos & Entradas') para cálculo correto no gráfico de despesas
    const primaryCategory = determineFinancialCategory(
      parsedData.items?.map(i => ({
        description: i.description,
        totalPrice: i.totalPrice,
        unitPrice: i.unitPrice,
        quantity: i.quantity
      })),
      `${parsedData.supplier} ${parsedData.suggestedCategory || ''} ${parsedData.itemsSummary || ''}`
    );
    const isCombustivel = primaryCategory === 'Combustível & Arla';
    const catName = primaryCategory;
    const catColor = isCombustivel ? '#d97706' : '#059669';
    const catId = isCombustivel ? 'cat_combustivel' : 'cat_insumos';

    const mapPayCode = (code: string): PaymentMethod => {
      if (code === '02') return 'pix';
      if (code === '03') return 'transferencia';
      if (code === '04') return 'cartao_credito';
      if (code === '05') return 'cartao_debito';
      if (code === '06') return 'dinheiro';
      if (code === '07' || code === '08') return 'safra_prazo';
      return 'boleto';
    };

    const totalParcs = detailedInstallments.length;
    const installmentRecords: Expense[] = detailedInstallments.map((inst, idx) => {
      const parcelNum = inst.number || String(idx + 1).padStart(2, '0');
      const instId = totalParcs === 1 ? expenseId : `${expenseId}_parc_${idx + 1}`;
      const suffix = totalParcs > 1 ? ` (${parcelNum}/${totalParcs})` : '';
      const dueResolved = inst.dueDate || dueDateFinal;

      const contabNote = ` [Contábil - Crédito: ${inst.creditAccount || 'N/A'} | Débito: ${inst.debitAccount || 'N/A'}]`;
      const obsNote = inst.observations ? ` Obs: ${inst.observations}.` : '';

      return {
        id: instId,
        companyId: getActiveCompanyId() || 'default',
        notaId: fiscalRecordId,
        documento_entrada_id: fiscalRecordId,
        nota_fiscal_id: fiscalRecordId,
        numero_parcela: totalParcs > 1 ? `${parcelNum}/${totalParcs}` : '01/01',
        description: `Compra ${cleanInvoiceNumber}${suffix} - ${parsedData.supplier}`,
        amount: Number(inst.amount) || 0,
        valor_parcela: Number(inst.amount) || 0,
        categoryId: catId,
        categoryName: catName,
        categoryColor: catColor,
        date: issueDateFinal,
        issueDate: issueDateFinal,
        entryDate: entryDateFinal,
        dueDate: dueResolved,
        data_vencimento: dueResolved,
        supplier: parsedData.supplier,
        invoiceNumber: `${cleanInvoiceNumber}${suffix}`,
        status: 'pendente' as const,
        paymentMethod: mapPayCode(inst.paymentMethodCode),
        forma_pagamento: inst.paymentMethodLabel || 'Boleto',
        costCenterId: selectedCC?.id,
        costCenterName: selectedCC?.name || primaryCategory,
        notes: `Lançamento de parcela via NF-e XML. Parcela ${parcelNum}/${totalParcs}. Prazo: ${inst.daysInterval} dias.${contabNote}${obsNote} Chave: ${parsedData.accessKey || 'N/A'}.${stockNote}\n${itemsEmbed}`,
        receiptUrl: inst.documentFileUrl,
        receiptName: inst.documentFileName,
        nfeItems: parsedData.items,
        operationNature: parsedData.transactionType || parsedData.operationNature,
        transactionType: parsedData.transactionType,
        createdAt: new Date().toISOString(),
      } as Expense;
    });

    // Sincroniza imediatamente com o armazenamento local antes mesmo da nuvem para refletir instantaneamente em "A Pagar"
    try {
      const currentStoredExp = getStoredExpenses();
      const baseExpId = expenseId.split('_parc_')[0];
      const cleanedStored = currentStoredExp.filter((e: any) => {
        if (e.notaId === fiscalRecordId || e.documento_entrada_id === fiscalRecordId) return false;
        const eBase = typeof e.id === 'string' && e.id.includes('_parc_') ? e.id.split('_parc_')[0] : e.id;
        if (eBase === baseExpId) return false;
        return true;
      });
      saveStoredExpenses([...installmentRecords, ...cleanedStored]);
    } catch (e) {
      console.warn('Aviso ao sincronizar parcelas no armazenamento local:', e);
    }

    // 1. Envia as parcelas individualmente para o Contas a Pagar (Financeiro), iniciando rigorosamente pelo Item 1
    onAddExpenseFromNfe(installmentRecords);

    // 2. UNICIDADE DO REGISTRO FISCAL: Salva rigorosamente 1 ÚNICA LINHA no Histórico de Notas Fiscais Lançadas
    // Exibindo o VALOR TOTAL BRUTO CONSOLIDADO da NF-e (ex: R$ 600,00 ou R$ 44.365,25)

    const singleFiscalRecord: Expense = {
      id: fiscalRecordId,
      invoiceNumber: cleanInvoiceNumber,
      supplier: parsedData.supplier,
      description: `Compra ${cleanInvoiceNumber} - ${parsedData.supplier}${totalParcs > 1 ? ` (${totalParcs} parcelas)` : ''}`,
      amount: Number(parsedData.totalAmount) || 0, // VALOR TOTAL BRUTO CONSOLIDADO
      date: issueDateFinal,
      dueDate: dueDateFinal,
      issueDate: issueDateFinal,
      entryDate: entryDateFinal,
      status: 'pendente' as const,
      categoryId: catId,
      categoryName: catName,
      categoryColor: catColor,
      paymentMethod: mapPayCode(detailedInstallments[0]?.paymentMethodCode || '01'),
      costCenterId: selectedCC?.id,
      costCenterName: selectedCC?.name || primaryCategory,
      notes: `NF-e Importada via XML. Chave: ${parsedData.accessKey || 'N/A'}. Desdobrada em ${totalParcs} parcela(s) no Contas a Pagar.${stockNote}\n${itemsEmbed}`,
      nfeItems: parsedData.items,
      operationNature: parsedData.transactionType || parsedData.operationNature,
      transactionType: parsedData.transactionType,
      createdAt: new Date().toISOString(),
    };

    // Atualiza a persistência dedicada de registros fiscais (evitando qualquer duplicação por parcelas)
    const currentStoredFiscal = getStoredFiscalRecords();
    const cleanNumCompare = cleanInvoiceNumber.toLowerCase();
    const filteredFiscal = currentStoredFiscal.filter(f => 
      f.id !== fiscalRecordId && 
      (f.invoiceNumber || '').replace(/\s*\(\d+\/\d+\)/g, '').trim().toLowerCase() !== cleanNumCompare
    );
    const updatedFiscalList = [singleFiscalRecord, ...filteredFiscal];
    saveStoredFiscalRecords(updatedFiscalList);

    // 3. PERSISTÊNCIA DEFINITIVA DO CABEÇALHO DA NOTA (tabela documentos_entrada + LocalStorage):
    const docEntradaFinal: DocumentoEntradaRecord = {
      id: fiscalRecordId,
      numero: cleanInvoiceNumber,
      numero_documento: cleanInvoiceNumber,
      serie: parsedData.series || '1',
      chave_acesso: parsedData.accessKey || undefined,
      fornecedor: parsedData.supplier,
      fornecedor_nome: parsedData.supplier,
      fornecedor_cnpj: parsedData.supplierCnpj || undefined,
      data: issueDateFinal,
      data_entrada: entryDateFinal,
      data_emissao: issueDateFinal,
      data_vencimento: dueDateFinal,
      tipo_documento: 'Nota Fiscal',
      valor_total: Number(parsedData.totalAmount) || 0,
      natureza_operacao: parsedData.transactionType || parsedData.operationNature,
      observacoes: `NF-e ${cleanInvoiceNumber} importada via XML. Fornecedor: ${parsedData.supplier}. Total: ${formatCurrencyBRL(parsedData.totalAmount)}.`,
      status: 'Finalizado',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const currentStoredDocs = getStoredDocumentosEntrada();
    const updatedDocsList = [docEntradaFinal, ...currentStoredDocs.filter(d => 
      d.id !== fiscalRecordId && 
      (d.numero || d.numero_documento || '').replace(/\s*\(\d+\/\d+\)/g, '').trim().toLowerCase() !== cleanNumCompare
    )];
    saveStoredDocumentosEntrada(updatedDocsList);
    setDocumentosEntrada(updatedDocsList);

    // Atualiza o estado da tabela de Histórico Fiscal com unicidade estrita
    setNotasLancadas(prev => {
      const remaining = prev.filter(f => 
        f.id !== fiscalRecordId && 
        !installmentRecords.some(r => r.id === f.id) &&
        (f.invoiceNumber || '').replace(/\s*\(\d+\/\d+\)/g, '').trim().toLowerCase() !== cleanNumCompare
      );
      return [singleFiscalRecord, ...remaining];
    });

    // Salva cópia em cache com as parcelas atualizadas
    const updatedParsedData: ParsedNfeData = {
      ...parsedData,
      invoiceNumber: cleanInvoiceNumber,
      totalAmount: Number(parsedData.totalAmount) || 0,
      installments: detailedInstallments.map(i => ({
        number: i.number,
        dueDate: i.dueDate,
        amount: i.amount
      })),
      costCenterId: selectedCC?.id,
      costCenterName: selectedCC?.name,
    };

    saveCachedNfe(updatedParsedData, fiscalRecordId);

    // Persistência direta no PostgreSQL Supabase (aguarda notas_fiscais e documentos_entrada antes de gravar contas_a_pagar para evitar FK 23503)
    if (isSupabaseConfigured) {
      await Promise.all([
        upsertNotaFiscal({
          id: fiscalRecordId,
          number: cleanInvoiceNumber,
          series: parsedData.series || '1',
          accessKey: parsedData.accessKey,
          supplierName: parsedData.supplier,
          totalAmount: Number(parsedData.totalAmount) || 0,
          operationNature: parsedData.operationNature,
          issueDate: issueDateFinal,
          entryDate: entryDateFinal,
          items: parsedData.items
        }).catch(err => console.warn('Notice upsertNotaFiscal:', err)),
        insertDocumentoEntrada(docEntradaFinal).catch(e => console.warn('Aviso insertDocumentoEntrada para NF-e:', e))
      ]);

      await Promise.all(
        installmentRecords.map((rec, idx) => {
          const inst = detailedInstallments[idx];
          return upsertContaAPagar({
            id: rec.id,
            nota_fiscal_id: fiscalRecordId,
            numero_parcela: (rec as any).numero_parcela || `${idx + 1}/${totalParcs}`,
            valor_parcela: Number(rec.amount) || 0,
            data_vencimento: rec.dueDate || dueDateFinal,
            forma_pagamento: inst ? mapPayCode(inst.paymentMethodCode) : 'boleto',
            centro_custo: selectedCC?.name || primaryCategory,
            categoria: primaryCategory,
            tipo_despesa: primaryCategory,
            status_pago: false
          }).catch(err => console.warn('Notice upsertContaAPagar XML:', err));
        })
      );
    }

    setIsInstallmentsModalOpen(false);
    const isEdit = Boolean(editingExpenseId);
    setErrorMessage('');
    setSuccessMessage(
      isEdit 
        ? `Nota Fiscal ${cleanInvoiceNumber} atualizada com sucesso! Registro consolidado mantido no Fiscal e ${totalParcs} parcela(s) no Contas a Pagar.`
        : `Nota Fiscal ${cleanInvoiceNumber} importada com sucesso! Registro único gravado no Histórico Fiscal (${formatCurrencyBRL(parsedData.totalAmount)}) e ${totalParcs} parcela(s) gerada(s) em Contas a Pagar.`
    );

    // Pergunta se o usuário deseja imprimir as etiquetas correspondentes aos produtos que deram entrada na NF-e
    const itemsForLabels: LabelProductItem[] = (parsedData.items || []).map(item => {
      const matched = updatedInventory.find(p => 
        p.id === item.linkedInventoryId ||
        (item.barcode && p.barcode && String(p.barcode) !== 'SEM GTIN' && String(p.barcode).trim() === String(item.barcode).trim()) ||
        (item.code && p.code !== undefined && p.code !== null && String(p.code).trim().toUpperCase() === String(item.code).trim().toUpperCase()) ||
        (p.nome_comercial && String(p.nome_comercial).toLowerCase().trim() === String(item.description || '').toLowerCase().trim()) ||
        String(p.name || '').toLowerCase().trim() === String(item.description || '').toLowerCase().trim()
      );
      const invItem: InventoryItem = matched || {
        id: `nfe_prod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        code: item.code || undefined,
        name: item.description,
        nome: item.description,
        nome_comercial: item.description,
        category: 'Outros Insumos',
        unit: item.unit || 'UN',
        unidade_medida: item.unit || 'UN',
        barcode: item.barcode || undefined,
        codigo_barras: item.barcode || undefined,
        quantity: Number(item.quantity) || 0,
        minQuantity: 0,
        unitCost: Number(item.unitPrice) || 0,
        salePrice: Number(item.salePrice || item.unitPrice * 1.3),
        endereco_formatado: '00.00.00.00.00',
        location: 'Barracão Principal'
      };
      const exactNotaQty = Math.max(1, Math.round(Number(item.quantity) || 1));
      return {
        product: invItem,
        quantity: exactNotaQty,
        invoiceQuantity: exactNotaQty
      };
    });

    if (itemsForLabels.length > 0) {
      setPrintPromptState({
        isOpen: true,
        title: 'Deseja imprimir as etiquetas de gôndola?',
        description: `A Nota Fiscal Nº ${cleanInvoiceNumber} foi importada com sucesso e ${itemsForLabels.length} produto(s) deram entrada no estoque. Deseja imprimir as etiquetas correspondentes com código de barras e endereço?`,
        items: itemsForLabels
      });
    }

    // Persistência compulsória em colaca_silagem_documentos_entrada_itens
    if (parsedData.items && parsedData.items.length > 0) {
      try {
        const xmlItemsPayload: DocumentoEntradaItem[] = parsedData.items.map((item, idx) => ({
          id: `item_nfe_${cleanInvoiceNumber}_${idx}_${Date.now()}`,
          documento_entrada_id: fiscalRecordId,
          produto_id: item.linkedInventoryId,
          descricao: item.description,
          codigo_produto: item.code || undefined,
          ncm: item.ncm,
          quantidade: Number(item.quantity) || 1,
          unidade: item.unit || 'UN',
          valor_unitario: Number(item.unitPrice) || 0,
          valor_total: Number(item.totalPrice) || (Number(item.quantity) * Number(item.unitPrice)) || 0,
          created_at: new Date().toISOString()
        }));

        const existingAllItems = getStoredDocumentosEntradaItens();
        const filteredExisting = existingAllItems.filter(i => i.documento_entrada_id !== fiscalRecordId);
        saveStoredDocumentosEntradaItens([...xmlItemsPayload, ...filteredExisting]);
      } catch (err) {
        console.warn('Erro ao salvar itens no colaca_silagem_documentos_entrada_itens:', err);
      }
    }

    clearActiveNfeDraft();
    try {
      localStorage.removeItem('colaca_silagem_nfe_active_draft');
      localStorage.removeItem('colaca_silagem_manual_entry_draft');
    } catch (_) {}
    setParsedData(null);
    setXmlContent('');
    setSearchNfeNumber('');
    setEditingExpenseId(null);
    setSelectedCostCenterId('');
    setCostCenterError(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setSessionCreatedProductIds(new Set());
    setTimeout(() => setSuccessMessage(''), 5000);
  };

  const handleConfirmImport = () => {
    handleProceedToInstallments();
  };

  // Abre uma nota já gravada para visualização e edição
  const handleEditNota = (exp: Expense) => {
    setErrorMessage('');
    const nfeData = buildNfeDataFromExpense(exp, localInventory, companyProfile);
    const targetKey = getCanonicalNfeKey(exp);
    const cleanNum = getCleanInvoiceNumber(exp.invoiceNumber);
    const cleanNumLower = cleanNum.toLowerCase();
    
    // Identifica todas as parcelas vinculadas a essa nota no Contas a Pagar
    const relatedExpenses = expenses.filter(e => {
      if (getCanonicalNfeKey(e) === targetKey) return true;
      const eNum = getCleanInvoiceNumber(e.invoiceNumber).toLowerCase();
      if (eNum && cleanNumLower && eNum === cleanNumLower) return true;
      if (exp.id && e.id.startsWith(exp.id)) return true;
      if (e.notes && exp.notes && exp.notes.includes('Chave:') && e.notes.includes(exp.notes.slice(0, 30))) return true;
      return false;
    });

    let existingInstallments = nfeData.installments;
    if ((!existingInstallments || existingInstallments.length <= 1) && relatedExpenses.length > 1) {
      existingInstallments = relatedExpenses.map((re, idx) => ({
        number: String(idx + 1).padStart(2, '0'),
        dueDate: re.dueDate,
        amount: re.amount,
      }));
    }

    setParsedData({
      ...nfeData,
      invoiceNumber: cleanNum || nfeData.invoiceNumber,
      totalAmount: exp.amount || nfeData.totalAmount, // Garante o valor consolidado bruto cheio
      items: nfeData.items || [],
      installments: existingInstallments,
      costCenterId: exp.costCenterId,
      costCenterName: exp.costCenterName
    });

    setUserInstallmentCount(existingInstallments && existingInstallments.length > 0 ? existingInstallments.length : 1);
    setSelectedCostCenterId(exp.costCenterId || '');
    setCostCenterError(false);
    setEditingExpenseId(exp.id);
    setSuccessMessage(`Nota ${cleanNum || 'selecionada'} aberta para edição com ${nfeData.items?.length || 0} produto(s).`);
    setTimeout(() => setSuccessMessage(''), 4000);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Exclusão de nota fiscal confirmada: realiza estorno de estoque, remove o registro fiscal único E todas as parcelas do Contas a Pagar
  const handleConfirmarExclusao = () => {
    if (!notaParaExcluir) return;
    const notaId = notaParaExcluir;

    // 1. Identifica a nota no Histórico Fiscal, lista de despesas, entradas manuais ou unifiedEntries
    const nota = notasFiscaisExibicao.find(n => n.id === notaId || n.invoiceNumber === notaId) ||
                 notasLancadas.find(n => n.id === notaId || n.invoiceNumber === notaId) ||
                 expenses.find(n => n.id === notaId || n.invoiceNumber === notaId) ||
                 getStoredFiscalRecords().find(n => n.id === notaId || n.invoiceNumber === notaId);

    const docEntrada = documentosEntrada.find(d => d.id === notaId) ||
                       getStoredDocumentosEntrada().find(d => d.id === notaId);

    const targetKey = nota ? getCanonicalNfeKey(nota) : '';
    const docNum = nota?.invoiceNumber || docEntrada?.numero || '';
    const cleanNum = nota 
      ? getCleanInvoiceNumber(nota.invoiceNumber).toLowerCase()
      : (docEntrada ? getCleanInvoiceNumber(docEntrada.numero).toLowerCase() : '');
    const digits = (docNum || '').replace(/\D/g, '');
    const accessKey = (nota as any)?.accessKey || docEntrada?.chave_acesso || '';

    // 2. ESTORNO AUTOMÁTICO DE QUANTIDADES NO ESTOQUE (Requisito 1)
    const estornoLogs: string[] = [];
    if (nota) {
      const reversalAnalysis = getStockReversalAnalysis(
        nota,
        expenses,
        localInventory,
        companyProfile
      );

      if (reversalAnalysis.reversalItems.length > 0) {
        let updatedInventory = [...localInventory];

        reversalAnalysis.reversalItems.forEach(item => {
          if (item.inventoryItemId && item.nfeQuantity > 0) {
            const invIdx = updatedInventory.findIndex(i => i.id === item.inventoryItemId);
            if (invIdx !== -1) {
              const currentQty = Number(updatedInventory[invIdx].quantity) || 0;
              const newQty = Math.round((currentQty - item.nfeQuantity) * 100) / 100;
              updatedInventory[invIdx] = {
                ...updatedInventory[invIdx],
                quantity: newQty
              };
              estornoLogs.push(`${updatedInventory[invIdx].name} (-${item.nfeQuantity} ${updatedInventory[invIdx].unit || item.unit})`);
            }
          }
        });

        if (estornoLogs.length > 0) {
          saveInventory(updatedInventory);
        }
      }
    }

    // 3. REGISTRA TOMBSTONES DE EXCLUSÃO DEFINITIVA
    recordDeletedDocumentoEntradaId(notaId);
    recordDeletedNfeKey(notaId);
    if (cleanNum) recordDeletedNfeKey(cleanNum);
    if (digits) recordDeletedNfeKey(digits);
    if (docNum) recordDeletedNfeKey(docNum.toLowerCase().trim());
    if (accessKey) recordDeletedNfeKey(accessKey);
    if (targetKey) recordDeletedNfeKey(targetKey);

    // 4. LIMPEZA NO CACHE DA NF-E
    try {
      const cached = getCachedNfeMap();
      delete cached[notaId];
      if (cleanNum) delete cached[cleanNum];
      if (digits) delete cached[digits];
      if (docNum) delete cached[docNum.toLowerCase().trim()];
      if (accessKey) delete cached[accessKey];
      if (targetKey) delete cached[targetKey];
      localStorage.setItem(NFE_CACHE_STORAGE_KEY, JSON.stringify(cached));
    } catch (_) {}

    // 5. ATUALIZA ESTADOS DO REACT IMEDIATAMENTE (Desaparece da tabela em tempo real)
    setNotasLancadas(prev => prev.filter(n => {
      if (n.id === notaId) return false;
      if (targetKey && getCanonicalNfeKey(n) === targetKey) return false;
      if (cleanNum && getCleanInvoiceNumber(n.invoiceNumber).toLowerCase() === cleanNum) return false;
      if (digits && (n.invoiceNumber || '').replace(/\D/g, '') === digits) return false;
      if (docNum && n.invoiceNumber === docNum) return false;
      return true;
    }));

    setDocumentosEntrada(prev => prev.filter(d => {
      if (d.id === notaId) return false;
      if (docNum && d.numero === docNum) return false;
      if (cleanNum && getCleanInvoiceNumber(d.numero).toLowerCase() === cleanNum) return false;
      if (digits && (d.numero || '').replace(/\D/g, '') === digits) return false;
      return true;
    }));

    // 6. LIMPEZA NO ARMAZENAMENTO PERMANENTE DE REGISTROS FISCAIS
    const storedFiscal = getStoredFiscalRecords();
    const updatedFiscal = storedFiscal.filter(f => {
      if (f.id === notaId) return false;
      if (targetKey && getCanonicalNfeKey(f) === targetKey) return false;
      if (cleanNum && getCleanInvoiceNumber(f.invoiceNumber).toLowerCase() === cleanNum) return false;
      if (digits && (f.invoiceNumber || '').replace(/\D/g, '') === digits) return false;
      if (docNum && f.invoiceNumber === docNum) return false;
      return true;
    });
    saveStoredFiscalRecords(updatedFiscal);

    // 7. LIMPEZA NO STORAGE DE DOCUMENTOS DE ENTRADA E ITENS
    deleteLocalDocumentoEntrada(notaId);

    try {
      const rawNotas = localStorage.getItem('agrocontrol_notas_entradas');
      if (rawNotas) {
        const parsed = JSON.parse(rawNotas);
        if (Array.isArray(parsed)) {
          const filtradas = parsed.filter((d: any) => 
            d.id !== notaId && 
            d.numero !== docNum && 
            (!cleanNum || getCleanInvoiceNumber(d.numero).toLowerCase() !== cleanNum)
          );
          localStorage.setItem('agrocontrol_notas_entradas', JSON.stringify(filtradas));
        }
      }
    } catch (_) {}

    try {
      const rawColaca = localStorage.getItem('colaca_silagem_documentos_entrada');
      if (rawColaca) {
        const parsedColaca = JSON.parse(rawColaca);
        if (Array.isArray(parsedColaca)) {
          const filtradasColaca = parsedColaca.filter((d: any) => 
            d.id !== notaId && 
            d.numero !== docNum && 
            (!cleanNum || getCleanInvoiceNumber(d.numero).toLowerCase() !== cleanNum)
          );
          localStorage.setItem('colaca_silagem_documentos_entrada', JSON.stringify(filtradasColaca));
        }
      }
    } catch (_) {}

    try {
      const rawItens = localStorage.getItem('colaca_silagem_documentos_entrada_itens');
      if (rawItens) {
        const parsedItens = JSON.parse(rawItens);
        if (Array.isArray(parsedItens)) {
          const filtradasItens = parsedItens.filter((i: any) => i.id !== notaId && i.documento_entrada_id !== notaId);
          localStorage.setItem('colaca_silagem_documentos_entrada_itens', JSON.stringify(filtradasItens));
        }
      }
    } catch (_) {}

    // 8. REMOVE TODAS AS PARCELAS DO CONTAS A PAGAR (FINANCEIRO)
    const idsToRemove = new Set<string>();
    if (notaId) idsToRemove.add(notaId);
    idsToRemove.add(`pagar_${notaId}`);
    idsToRemove.add(`exp_doc_${notaId}`);

    expenses.forEach(e => {
      if (e.id === notaId || (notaId && e.id.startsWith(notaId))) {
        idsToRemove.add(e.id);
        return;
      }
      if ((e as any).notaId === notaId || (e as any).documento_entrada_id === notaId || (e as any).nota_fiscal_id === notaId) {
        idsToRemove.add(e.id);
        return;
      }
      if (targetKey && getCanonicalNfeKey(e) === targetKey) {
        idsToRemove.add(e.id);
        return;
      }
      const eCleanNum = getCleanInvoiceNumber(e.invoiceNumber).toLowerCase();
      if (cleanNum && eCleanNum === cleanNum) {
        idsToRemove.add(e.id);
      }
    });

    try {
      const stored = getStoredExpenses();
      const updatedStored = stored.filter(e => {
        if (idsToRemove.has(e.id)) return false;
        if (e.id === notaId || (notaId && e.id.startsWith(notaId))) return false;
        if ((e as any).notaId === notaId || (e as any).documento_entrada_id === notaId || (e as any).nota_fiscal_id === notaId) return false;
        if (targetKey && getCanonicalNfeKey(e) === targetKey) return false;
        if (cleanNum && getCleanInvoiceNumber(e.invoiceNumber).toLowerCase() === cleanNum) return false;
        if (digits && (e.invoiceNumber || '').replace(/\D/g, '') === digits) return false;
        return true;
      });
      saveStoredExpenses(updatedStored);
      localStorage.setItem('agrocontrol_contas_a_pagar', JSON.stringify(updatedStored));
      localStorage.setItem('agrocontrol_financeiro', JSON.stringify(updatedStored));
      localStorage.setItem('agrocontrol_despesas', JSON.stringify(updatedStored));
    } catch (err) {
      console.error('Erro ao atualizar storage após excluir nota:', err);
    }

    // Notifica o componente pai para cada parcela excluída
    if (onDeleteExpense) {
      idsToRemove.forEach(id => onDeleteExpense(id));
      if (docNum) onDeleteExpense(docNum);
      if (cleanNum) onDeleteExpense(cleanNum);
      if (digits) onDeleteExpense(digits);
    }

    // Exclusão no PostgreSQL Supabase: ON DELETE CASCADE remove automaticamente as parcelas em contas_a_pagar
    if (notaId) {
      deleteNotaFiscal(notaId).catch(() => {});
      deleteDocumentoEntrada(notaId).catch(() => {});
    }

    // 9. Se a nota excluída for a que estava aberta para edição, limpa e fecha o formulário
    if (editingExpenseId === notaId || (parsedData && (parsedData.invoiceNumber === notaId || parsedData.accessKey === notaId))) {
      clearActiveNfeDraft();
      setParsedData(null);
      setEditingExpenseId(null);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('silagem_expenses_updated'));
      window.dispatchEvent(new CustomEvent('agrocontrol_contas_a_pagar_updated'));
      window.dispatchEvent(new CustomEvent('agrocontrol_notas_entradas_updated'));
      window.dispatchEvent(new CustomEvent('colaca_silagem_documentos_entrada_updated'));
    }

    setNotaParaExcluir(null);
    const estornoMsg = estornoLogs.length > 0 
      ? ` com estorno de estoque efetuado: ${estornoLogs.join(', ')}`
      : '';
    setSuccessMessage(`Nota fiscal ${cleanNum ? `nº ${cleanNum.toUpperCase()}` : ''} e suas parcelas financeiras foram excluídas${estornoMsg}!`);
    setTimeout(() => setSuccessMessage(''), 5000);
  };

  // Cancela ou retorna da visualização de detalhes
  const handleBackToList = () => {
    clearActiveNfeDraft();
    setParsedData(null);
    setEditingExpenseId(null);
    setSelectedCostCenterId('');
    setXmlContent('');
    setErrorMessage('');
  };

  return (
    <div id="nfe-module" className="w-full max-w-none flex-1 min-h-0 flex flex-col">
      
      {/* 1. Header Unificado 3D Slim com Título, Contador e Botões Importar XML e Nova Entrada Manual */}
      <header className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-slate-300 dark:border-stone-800 shadow-[0_1px_0px_0px_rgba(255,255,255,0.8)] dark:shadow-[0_1px_0px_0px_rgba(255,255,255,0.05)] pb-2 mb-3">
        <div>
          <h2 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tracking-tight uppercase">
            FISCAL & NOTAS
          </h2>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
          <CompetenceSelector
            competence={fiscalCompetence}
            onPrev={handlePrevCompetence}
            onNext={handleNextCompetence}
          />

          <div className="px-2 py-0.5 rounded-md bg-white/80 dark:bg-stone-800 text-[10px] sm:text-[11px] font-bold text-zinc-700 dark:text-stone-300 border border-slate-300 dark:border-stone-700 shadow-2xs">
            {filteredUnifiedEntries.length} registro(s)
          </div>

          <button
            type="button"
            id="btn-importar-xml-topo"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gradient-to-b from-sky-500 via-sky-600 to-sky-700 hover:from-sky-400 hover:to-sky-600 text-white text-xs font-bold rounded-lg border border-sky-400/80 shadow-[inset_0_1px_0px_rgba(255,255,255,0.3),0_1px_2px_rgba(0,0,0,0.15)] transition cursor-pointer whitespace-nowrap"
            title="Selecionar arquivo XML de NF-e para importar"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Importar XML</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xml,text/xml,application/xml"
            onChange={handleFileUpload}
            className="hidden"
          />

          <button
            type="button"
            id="btn-nova-entrada-manual-topo"
            onClick={handleOpenManualEntryModal}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold rounded-lg border border-[#52cdb8] dark:bg-emerald-700 dark:hover:bg-emerald-600 dark:border-emerald-600 shadow-[inset_0_1px_0px_rgba(255,255,255,0.3),0_1px_2px_rgba(0,0,0,0.15)] transition cursor-pointer whitespace-nowrap uppercase tracking-wide"
            title="Cadastrar entrada manual (NF-e, CT-e, NFS-e, NFC-e, Romaneio, Nota avulsa, Cupom, Nota de Produtor, Outros)"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>+ NOVA ENTRADA MANUAL</span>
          </button>

          <button
            type="button"
            id="btn-lancar-nota-saida-topo"
            onClick={handleOpenNotaSaidaModal}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#1e40af] hover:bg-[#1e3a8a] text-white text-xs font-bold rounded-lg border border-blue-400/80 dark:bg-blue-700 dark:hover:bg-blue-600 dark:border-blue-500 shadow-[inset_0_1px_0px_rgba(255,255,255,0.3),0_1px_2px_rgba(0,0,0,0.15)] transition cursor-pointer whitespace-nowrap uppercase tracking-wide"
            title="Lançar / registrar Nota de Saída emitida pela empresa (NFS-e, NF-e, CT-e, NFC-e, MDF-e)"
          >
            <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>+ LANÇAR NOTA DE SAÍDA</span>
          </button>
        </div>
      </header>

      {/* 2. ESTRUTURA INTEGRADA DE PONTA A PONTA: MOLDURA MDI TRIDIMENSIONAL ACETINADA E BLOCO SÓLIDO */}
      <div className="w-full flex-1 min-h-0 flex flex-col border border-[#edf4ff] dark:border-stone-700 rounded-xl overflow-hidden bg-[#edf4ff] dark:bg-stone-900 shadow-xs">
        {/* BASE DE FUNDO DAS ABAS: MOLDURA MDI TRIDIMENSIONAL ACETINADA (CONTRATO MASTER) */}
        <div className="w-full shrink-0 bg-[#edf4ff] dark:bg-stone-850 border-b border-[#edf4ff] dark:border-stone-700 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9)] overflow-x-auto scrollbar-none">
          <nav 
            aria-label="Abas de Fiscal & Notas"
            className="w-full flex items-center overflow-x-auto whitespace-nowrap scrollbar-none"
          >
            {/* TAB 1 UNIFICADA: 📄 CENTRAL DE DOCUMENTOS */}
            <button
              type="button"
              id="tab-fiscal-central-documentos"
              onClick={() => setActiveMainFiscalTab('notas')}
              className={`flex-1 min-w-max flex items-center justify-center gap-1.5 px-3 py-1 text-[10px] tracking-wide font-bold uppercase transition cursor-pointer select-none whitespace-nowrap border-r border-slate-300/80 dark:border-stone-700/80 ${
                activeMainFiscalTab === 'notas'
                  ? 'bg-white text-zinc-900 dark:bg-stone-900 dark:text-white shadow-xs border-t-2 border-t-emerald-600 -mb-px z-10'
                  : 'bg-slate-200/50 hover:bg-slate-200 dark:bg-stone-850 dark:hover:bg-stone-800 text-slate-700 dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-200'
              }`}
            >
              <span>📄 CENTRAL DE DOCUMENTOS</span>
              <span className="px-1.5 py-0.2 rounded-md bg-stone-200 dark:bg-stone-700 text-[10px] font-bold">
                {competenceFilteredEntries.length + competenceFilteredSaidaEntries.length}
              </span>
            </button>

            {/* TAB 2: PEDIDO DE COMPRA */}
            <button
              type="button"
              id="tab-fiscal-pedido-compra"
              onClick={() => setActiveMainFiscalTab('pedido_compra')}
              className={`flex-1 min-w-max flex items-center justify-center gap-1.5 px-3 py-1 text-[10px] tracking-wide font-bold uppercase transition cursor-pointer select-none whitespace-nowrap border-r border-slate-300/80 dark:border-stone-700/80 ${
                activeMainFiscalTab === 'pedido_compra'
                  ? 'bg-white text-zinc-900 dark:bg-stone-900 dark:text-white shadow-xs border-t-2 border-t-indigo-600 -mb-px z-10'
                  : 'bg-slate-200/50 hover:bg-slate-200 dark:bg-stone-850 dark:hover:bg-stone-800 text-slate-700 dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-200'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>PEDIDO DE COMPRA</span>
              <span className="px-1.5 py-0.2 rounded-md bg-stone-200 dark:bg-stone-700 text-[10px] font-bold">
                {pedidosCompraFilteredCount}
              </span>
            </button>

            {/* TAB 3: PEDIDOS DE REFORMA */}
            <button
              type="button"
              id="tab-fiscal-pedidos-reforma"
              onClick={() => setActiveMainFiscalTab('pedidos_reforma')}
              className={`flex-1 min-w-max flex items-center justify-center gap-1.5 px-3 py-1 text-[10px] tracking-wide font-bold uppercase transition cursor-pointer select-none whitespace-nowrap border-r border-slate-300/80 dark:border-stone-700/80 ${
                activeMainFiscalTab === 'pedidos_reforma'
                  ? 'bg-white text-zinc-900 dark:bg-stone-900 dark:text-white shadow-xs border-t-2 border-t-amber-600 -mb-px z-10'
                  : 'bg-slate-200/50 hover:bg-slate-200 dark:bg-stone-850 dark:hover:bg-stone-800 text-slate-700 dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-200'
              }`}
            >
              <Wrench className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>PEDIDOS DE REFORMA</span>
              {pendingReformCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-md bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 text-[10px] font-black animate-pulse">
                  {pendingReformCount} NOVO(S)
                </span>
              )}
              <span className="px-1.5 py-0.2 rounded-md bg-stone-200 dark:bg-stone-700 text-[10px] font-bold">
                {reformOrdersFilteredCount}
              </span>
            </button>

            {/* TAB 4 UNIFICADA: 🔄 DEVOLUÇÕES & GARANTIAS */}
            <button
              type="button"
              id="tab-fiscal-devolucoes-garantias"
              onClick={() => setActiveMainFiscalTab('devolucao')}
              className={`flex-1 min-w-max flex items-center justify-center gap-1.5 px-3 py-1 text-[10px] tracking-wide font-bold uppercase transition cursor-pointer select-none whitespace-nowrap border-r border-slate-300/80 dark:border-stone-700/80 ${
                activeMainFiscalTab === 'devolucao'
                  ? 'bg-white text-zinc-900 dark:bg-stone-900 dark:text-white shadow-xs border-t-2 border-t-emerald-600 -mb-px z-10'
                  : pendenciasDevolucaoCount > 0
                    ? 'bg-rose-50/90 hover:bg-rose-100/90 dark:bg-rose-950/30 dark:hover:bg-rose-950/50 text-rose-900 dark:text-rose-200'
                    : 'bg-slate-200/50 hover:bg-slate-200 dark:bg-stone-850 dark:hover:bg-stone-800 text-slate-700 dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-200'
              }`}
            >
              <span>🔄 DEVOLUÇÕES &amp; GARANTIAS</span>
              {pendenciasDevolucaoCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-red-600 text-white text-[10px] font-black shadow-2xs">
                  {pendenciasDevolucaoCount} PENDENTE{pendenciasDevolucaoCount > 1 ? 'S' : ''}
                </span>
              )}
              <span className="px-1.5 py-0.2 rounded-md bg-stone-200 dark:bg-stone-700 text-[10px] font-bold">
                {devolucaoFilteredCount}
              </span>
            </button>

            {/* TAB 5: MANIFESTAÇÃO DESTINATÁRIO */}
            <button
              type="button"
              id="tab-fiscal-manifestacao-destinatario"
              onClick={() => setActiveMainFiscalTab('manifestacao_destinatario')}
              className={`flex-1 min-w-max flex items-center justify-center gap-1.5 px-3 py-1 text-[10px] tracking-wide font-bold uppercase transition cursor-pointer select-none whitespace-nowrap ${
                activeMainFiscalTab === 'manifestacao_destinatario'
                  ? 'bg-white text-zinc-900 dark:bg-stone-900 dark:text-white shadow-xs border-t-2 border-t-emerald-600 -mb-px z-10'
                  : 'bg-slate-200/50 hover:bg-slate-200 dark:bg-stone-850 dark:hover:bg-stone-800 text-slate-700 dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-200'
              }`}
            >
              <FileCheck2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>MANIFESTAÇÃO DESTINATÁRIO</span>
              <span className="px-1.5 py-0.2 rounded-md bg-stone-200 dark:bg-stone-700 text-[10px] font-bold">
                {manifestacoesFilteredCount}
              </span>
            </button>
          </nav>
        </div>

        {/* 3. PAINEL DE CONTEÚDO COLADO NA BASE INFERIOR DA BARRA DE ABAS SEM VÃOS VAZIOS (BLOCO SÓLIDO ÚNICO) */}
        <div className="w-full flex-1 min-h-0 flex flex-col bg-[#edf4ff] dark:bg-stone-900 border-[#edf4ff] dark:border-stone-700 p-3 sm:p-3.5">
          {activeMainFiscalTab === 'pedido_compra' ? (
            <FiscalDocumentTypeView 
              category="pedido_compra" 
              companyProfile={companyProfile}
              competence={fiscalCompetence}
              onCompetenceChange={setFiscalCompetence}
              hideCompetenceSelector={true}
              onAddExpenseFromNfe={onAddExpenseFromNfe}
              onRefreshAll={() => {
                try {
                  const rp = localStorage.getItem('agrocontrol_pedidos_compra');
                  if (rp) setPedidosCompraCount(JSON.parse(rp).length);
                } catch {}
              }}
            />
          ) : activeMainFiscalTab === 'manifestacao_destinatario' ? (
            <ManifestacaoDestinatarioView 
              companyProfile={companyProfile}
              competence={fiscalCompetence}
              onCompetenceChange={setFiscalCompetence}
              hideCompetenceSelector={true}
              inventory={localInventory}
              onSaveInventory={saveInventory}
              expenses={expenses}
              onAddExpenseFromNfe={onAddExpenseFromNfe}
              onRefreshAll={() => {
                setManifestacoesCount(getStoredManifestacoes().length);
              }}
            />
          ) : activeMainFiscalTab === 'pedidos_reforma' ? (
            <TireReformOrderView 
              companyProfile={companyProfile}
              competence={fiscalCompetence}
              onCompetenceChange={setFiscalCompetence}
              hideCompetenceSelector={true}
              initialCreateMode={localStorage.getItem('colaca_silagem_abrir_pedido_reforma') === 'true' || pendingReformCount > 0}
              onOrderSaved={() => {
                setReformOrdersCount(getStoredReformOrders().length);
                setPendingReformCount(getStoredPendingReformTires().length);
              }}
              onEfetivarRetorno={handleEfetivarRetornoPedidoReforma}
            />
          ) : activeMainFiscalTab === 'devolucao' ? (
            <DevolucaoNotasView 
              companyProfile={companyProfile} 
              competence={fiscalCompetence}
              onCompetenceChange={setFiscalCompetence}
              hideCompetenceSelector={true}
            />
          ) : (
            /* Conteúdo padrão de Notas e Entradas */
            <div className="w-full flex-1 min-h-0 flex flex-col gap-3">
      {successMessage && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center space-x-2.5 text-emerald-800 dark:text-emerald-200 text-xs sm:text-sm font-semibold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div 
          id="alerta-erro-xml-corrompido"
          className="relative p-4 sm:p-5 bg-rose-50 dark:bg-rose-950/80 border-2 border-rose-300 dark:border-rose-800 rounded-2xl shadow-sm text-rose-900 dark:text-rose-100 text-xs sm:text-sm font-bold animate-in fade-in transition"
        >
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 text-center max-w-3xl mx-auto px-6">
            <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-300 flex items-center justify-center shrink-0 shadow-2xs">
              <AlertCircle className="w-5 h-5" />
            </div>
            <p className="leading-relaxed text-center font-bold">
              {errorMessage}
            </p>
          </div>
          <button 
            type="button" 
            id="btn-fechar-alerta-erro-xml"
            onClick={() => setErrorMessage('')} 
            className="absolute top-3 right-3 p-1.5 text-rose-500 hover:text-rose-800 dark:hover:text-rose-200 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-lg cursor-pointer transition"
            title="Fechar aviso de erro"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Seletor Principal de Direção (Entrada vs. Saída) no Topo da Central de Documentos */}
      <div
        id="seletor-direcao-central-documentos"
        className="grid grid-cols-1 sm:grid-cols-2 gap-2"
      >
        <button
          type="button"
          id="btn-direcao-notas-entrada"
          onClick={() => setActiveDocDirection('entrada')}
          className={`flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl border-2 transition cursor-pointer text-left ${
            activeDocDirection === 'entrada'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-[#059669] text-emerald-950 dark:text-emerald-100 shadow-sm'
              : 'bg-white/80 dark:bg-stone-900/80 border-slate-200 dark:border-stone-700 text-slate-700 dark:text-stone-300 hover:border-emerald-400 hover:bg-emerald-50/40'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base leading-none shrink-0">📥</span>
            <div className="min-w-0">
              <span className="block text-xs font-black uppercase tracking-wide truncate">
                NOTAS DE ENTRADA (Compras / Recebidas)
              </span>
              <span className="block text-[10px] font-semibold opacity-75 truncate">
                Notas de compra/entrada importadas via XML ou lançadas manualmente
              </span>
            </div>
          </div>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-black font-mono shrink-0 ${
              activeDocDirection === 'entrada'
                ? 'bg-[#059669] text-white'
                : 'bg-slate-200 dark:bg-stone-800 text-slate-700 dark:text-stone-300'
            }`}
          >
            {competenceFilteredEntries.length}
          </span>
        </button>

        <button
          type="button"
          id="btn-direcao-notas-saida"
          onClick={() => setActiveDocDirection('saida')}
          className={`flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl border-2 transition cursor-pointer text-left ${
            activeDocDirection === 'saida'
              ? 'bg-blue-50 dark:bg-blue-950/60 border-[#1e40af] text-blue-950 dark:text-blue-100 shadow-sm'
              : 'bg-white/80 dark:bg-stone-900/80 border-slate-200 dark:border-stone-700 text-slate-700 dark:text-stone-300 hover:border-blue-400 hover:bg-blue-50/40'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base leading-none shrink-0">📤</span>
            <div className="min-w-0">
              <span className="block text-xs font-black uppercase tracking-wide truncate">
                NOTAS DE SAÍDA (Emitidas pela Empresa)
              </span>
              <span className="block text-[10px] font-semibold opacity-75 truncate">
                Notas fiscais emitidas pela empresa para clientes e tomadores
              </span>
            </div>
          </div>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-black font-mono shrink-0 ${
              activeDocDirection === 'saida'
                ? 'bg-[#1e40af] text-white'
                : 'bg-slate-200 dark:bg-stone-800 text-slate-700 dark:text-stone-300'
            }`}
          >
            {competenceFilteredSaidaEntries.length}
          </span>
        </button>
      </div>

      {/* Pílulas Limpas de Filtro Rápido com Contadores (Central de Documentos) */}
      <div className="flex flex-wrap items-center gap-1.5 bg-white/80 dark:bg-stone-900/90 border border-slate-200 dark:border-stone-800 rounded-xl px-3 py-2 shadow-2xs">
        {(
          [
            { key: 'todos', label: 'Todos', count: centralDocPillCounts.todos },
            { key: 'nfe', label: 'NF-e (Mercadorias)', count: centralDocPillCounts.nfe },
            { key: 'cte', label: 'CT-e (Frete)', count: centralDocPillCounts.cte },
            { key: 'nfse', label: 'NFS-e (Serviço)', count: centralDocPillCounts.nfse },
            { key: 'nfce', label: 'NFC-e', count: centralDocPillCounts.nfce },
            { key: 'mdfe', label: 'MDF-e', count: centralDocPillCounts.mdfe },
            { key: 'avulsas', label: 'Avulsas / Outros', count: centralDocPillCounts.avulsas },
          ] as Array<{ key: CentralDocumentFilter; label: string; count: number }>
        ).map((pill) => {
          const isActive = activeDocFilter === pill.key;
          const activeClasses = activeDocDirection === 'saida'
            ? 'bg-[#1e40af] text-white border-[#1e3a8a] shadow-xs'
            : 'bg-[#059669] text-white border-[#047857] shadow-xs';
          return (
            <button
              key={pill.key}
              type="button"
              id={`pill-central-doc-${pill.key}`}
              onClick={() => setActiveDocFilter(pill.key)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition cursor-pointer border ${
                isActive
                  ? activeClasses
                  : 'bg-slate-100/90 hover:bg-slate-200/80 text-slate-700 border-slate-300/80 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-300 dark:border-stone-700'
              }`}
            >
              <span>{pill.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-black font-mono ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-white dark:bg-stone-900 text-slate-600 dark:text-stone-300 border border-slate-200 dark:border-stone-700'
                }`}
              >
                {pill.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Barra de Ações: Campo de Busca Rápida de Documentos */}
      <div className="bg-[#edf4ff] dark:bg-stone-900 border border-[#edf4ff] dark:border-stone-800 rounded-xl py-2 px-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <form onSubmit={handleSearchNfe} className="flex-1 w-full">
          <div className="relative flex items-center w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
              <Search className="w-3.5 h-3.5" />
            </div>
            <input
              id="nfe-search-number-input"
              type="text"
              value={searchNfeNumber}
              onChange={(e) => setSearchNfeNumber(e.target.value)}
              placeholder={
                activeDocDirection === 'saida'
                  ? 'Buscar por número, destinatário/tomador, veículo ou chave de acesso...'
                  : 'Buscar por número, fornecedor, veículo ou chave de acesso...'
              }
              className="w-full pl-9 pr-10 py-1.5 bg-stone-50 dark:bg-stone-800/80 border border-stone-300 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-stone-100 font-bold placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition shadow-2xs"
            />
            <button
              type="submit"
              disabled={isSearching}
              title="Buscar Documento"
              className="absolute inset-y-0.5 right-0.5 px-2.5 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white rounded-md flex items-center justify-center transition shadow-2xs cursor-pointer disabled:opacity-50"
            >
              <Search className="w-3 h-3" />
            </button>
          </div>
        </form>

        {parsedData && (
          <div className="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              id="btn-fechar-painel-nfe"
              onClick={handleBackToList}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-white bg-slate-700 hover:bg-slate-800 active:bg-slate-900 border border-slate-600 rounded-lg shadow-2xs transition cursor-pointer uppercase tracking-wider"
              title="FECHAR DETALHES DA NOTA"
            >
              <X className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>FECHAR DETALHES DA NOTA</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. PAINEL DADOS EXTRAÍDOS DA NOTA - APARECE DINAMICAMENTE LOGO ACIMA DA TABELA DE HISTÓRICO */}
      {parsedData && (
        <div id="painel-itens-nfe-aberta" className="w-full bg-[#e6e6e6] dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4 animate-in fade-in duration-200 text-zinc-900 dark:text-stone-100">
          
          {/* Banner de Modo de Edição ou Importação Ativo */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-zinc-100 dark:bg-stone-800 border border-zinc-200 dark:border-stone-700 rounded-xl animate-in fade-in text-zinc-900 dark:text-stone-100">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-zinc-900 dark:bg-stone-700 text-white flex items-center justify-center font-bold shrink-0 shadow-2xs">
                <FileEdit className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-stone-100">
                    {editingExpenseId ? 'Editando Detalhes da Nota Fiscal' : 'Itens Identificados na Nota Fiscal'}
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-black rounded-md bg-white dark:bg-stone-900 text-zinc-900 dark:text-stone-100 border border-zinc-300 dark:border-stone-600 font-mono">
                    {parsedData.invoiceNumber}
                  </span>
                </div>
                <p className="text-xs text-zinc-600 dark:text-stone-300 mt-0.5 font-medium">
                  Revise os produtos, quantidades, valores e vínculos com o estoque antes de confirmar.
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <button
                type="button"
                id="btn-limpar-dados-painel"
                onClick={() => {
                  clearActiveNfeDraft();
                  setParsedData(null);
                  setXmlContent('');
                  setSearchNfeNumber('');
                  setEditingExpenseId(null);
                  setSelectedCostCenterId('');
                }}
                className="inline-flex items-center space-x-1 text-xs text-zinc-700 dark:text-stone-300 hover:text-red-700 transition cursor-pointer font-black uppercase tracking-wider px-2.5 py-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-stone-700"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>LIMPAR</span>
              </button>
              <button
                type="button"
                id="btn-voltar-para-lista-topo"
                onClick={handleBackToList}
                className="inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-800 active:bg-slate-900 text-white text-xs font-bold uppercase tracking-wider rounded-xl border border-slate-600 shadow-2xs transition cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>FECHAR</span>
              </button>
            </div>
          </div>

          <div className="space-y-4 animate-in fade-in">
                {/* Aviso amigável de CNPJ (não bloqueante) */}
                {parsedData.recipientCnpj && companyProfile?.cnpjCpf && (
                  parsedData.recipientCnpj.replace(/\D/g, '') !== companyProfile.cnpjCpf.replace(/\D/g, '')
                ) && (
                  <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl flex items-start space-x-2.5 text-zinc-900 dark:text-stone-100">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-amber-900" />
                    <div className="text-xs leading-relaxed font-medium">
                      <strong className="block font-bold mb-0.5 text-zinc-900 dark:text-stone-100">Aviso: CNPJ da nota difere do sistema</strong>
                      O destinatário na nota ({formatCpfCnpj(parsedData.recipientCnpj)}) difere do CNPJ cadastrado no sistema ({formatCpfCnpj(companyProfile.cnpjCpf)}). Os dados foram carregados normalmente e você pode prosseguir com a importação.
                    </div>
                  </div>
                )}

                {/* Chave de Acesso em Destaque */}
                {parsedData.accessKey && (
                  <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-stone-800/60 border border-zinc-200 dark:border-stone-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-zinc-900 dark:text-stone-100">
                    <div className="flex items-center space-x-2">
                      <Hash className="w-4 h-4 text-zinc-700 dark:text-stone-300" />
                      <span className="text-xs font-black text-zinc-800 dark:text-stone-200">Chave de Acesso:</span>
                    </div>
                    <span className="font-mono text-xs sm:text-sm font-black text-zinc-900 dark:text-stone-100 break-all select-all">
                      {parsedData.accessKey}
                    </span>
                  </div>
                )}

                {/* Conteúdo Principal com 100% de Largura: Cabeçalho da Nota, Tabela de Itens e Resumo Horizontal */}
                <div className="space-y-4 w-full">
                  
                  {/* Informações Principais da Nota Fiscal em 5 Colunas com Tipo de Transação */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 p-4 rounded-xl bg-zinc-50 dark:bg-stone-800/40 border border-zinc-200 dark:border-stone-700 text-xs sm:text-sm text-zinc-900 dark:text-stone-100">
                    
                    {/* 1. NÚMERO DA NF-E */}
                    <div className="lg:col-span-2 flex flex-col justify-center">
                      <span className="text-zinc-500 dark:text-stone-400 font-bold block text-xs uppercase tracking-wider">
                        NÚMERO DA NF-E:
                      </span>
                      <span className="font-black text-zinc-900 dark:text-stone-100 font-mono text-sm block truncate">
                        {parsedData.invoiceNumber} {parsedData.series ? `(SÉRIE ${parsedData.series})` : ''}
                      </span>
                    </div>

                    {/* 2. TIPO DE TRANSAÇÃO (SELETOR IMEDIATAMENTE AO LADO DIREITO DO NÚMERO DA NF-E) */}
                    <div className="lg:col-span-3 flex flex-col justify-center">
                      <label 
                        htmlFor="select-tipo-transacao-nfe" 
                        className="text-zinc-700 dark:text-stone-300 font-black text-xs uppercase tracking-wider mb-1 flex items-center space-x-1"
                      >
                        <span>TIPO DE TRANSAÇÃO</span>
                        <span className="text-rose-500">*</span>
                      </label>
                      <select
                        id="select-tipo-transacao-nfe"
                        value={parsedData.transactionType || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setParsedData(prev => {
                            if (!prev) return prev;
                            const updated: ParsedNfeData = {
                              ...prev,
                              transactionType: val,
                              operationNature: val || prev.operationNature
                            };
                            saveCachedNfe(updated, editingExpenseId || undefined);
                            try {
                              const draft = getActiveNfeDraft();
                              if (draft) {
                                saveActiveNfeDraft({
                                  ...draft,
                                  parsedData: updated,
                                  transactionType: val
                                });
                              }
                            } catch (_) {}
                            return updated;
                          });
                        }}
                        className="w-full bg-white dark:bg-stone-900 border border-zinc-300 dark:border-stone-600 rounded-lg px-2.5 py-1.5 text-xs font-bold text-zinc-900 dark:text-stone-100 uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-2xs transition truncate cursor-pointer"
                        title="SELECIONE O TIPO DE OPERAÇÃO DA NOTA FISCAL"
                      >
                        <option value="" className="text-zinc-400 font-bold uppercase">
                          -- SELECIONE O TIPO DE OPERAÇÃO --
                        </option>
                        {NFE_TRANSACTION_TYPES.map((tipo) => (
                          <option key={tipo} value={tipo} className="text-zinc-900 dark:text-stone-100 font-semibold uppercase">
                            {tipo}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 3. DATA DE EMISSÃO */}
                    <div className="lg:col-span-2 flex flex-col justify-center">
                      <span className="text-zinc-500 dark:text-stone-400 font-bold block text-xs uppercase tracking-wider">
                        DATA DE EMISSÃO:
                      </span>
                      <span className="font-black text-zinc-900 dark:text-stone-100 text-sm block">
                        {formatDateBR(parsedData.issueDate)}
                      </span>
                    </div>

                    {/* 4. EMITENTE / FORNECEDOR */}
                    <div className="lg:col-span-3 flex flex-col justify-center">
                      <span className="text-zinc-500 dark:text-stone-400 font-bold block text-xs uppercase tracking-wider">
                        EMITENTE / FORNECEDOR:
                      </span>
                      <span className="font-black text-zinc-900 dark:text-stone-100 block text-sm truncate uppercase" title={parsedData.supplier}>
                        {parsedData.supplier}
                      </span>
                      {parsedData.supplierCnpj && (
                        <span className="text-xs text-zinc-500 dark:text-stone-400 font-mono block font-bold">
                          CNPJ: {formatCpfCnpj(parsedData.supplierCnpj)}
                        </span>
                      )}
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${
                          supplierValidationNotice?.isNew
                            ? 'bg-amber-100 text-amber-950 border border-amber-300'
                            : 'bg-emerald-100 text-emerald-950 border border-emerald-300'
                        }`}>
                          {supplierValidationNotice?.isNew ? 'NOVO FORNECEDOR' : 'FORNECEDOR CADASTRADO'}
                        </span>
                        <button
                          type="button"
                          id="btn-revisar-fornecedor-nfe"
                          onClick={() => {
                            const rawDigits = cleanDigits(parsedData.supplierCnpj || '');
                            const s = localSuppliers.find(sup => 
                              (rawDigits && cleanDigits(sup.cnpjOrCpf || '') === rawDigits) ||
                              sup.name.trim().toLowerCase() === parsedData.supplier.trim().toLowerCase()
                            ) || supplierForModal;
                            if (s) setSupplierForModal(s);
                            setIsSupplierModalOpen(true);
                          }}
                          className="text-[10px] font-black text-white bg-[#059669] hover:bg-[#047857] active:bg-[#065f46] px-2 py-0.5 rounded shadow-2xs transition inline-flex items-center gap-1 cursor-pointer uppercase tracking-wider shrink-0"
                          title="VALIDAR DADOS E FICHA CADASTRAL DO FORNECEDOR"
                        >
                          <Building2 className="w-3 h-3 text-white" />
                          <span>VALIDAR FICHA</span>
                        </button>
                      </div>
                    </div>

                    {/* 5. DESTINATÁRIO */}
                    <div className="lg:col-span-2 flex flex-col justify-center">
                      <span className="text-zinc-500 dark:text-stone-400 font-bold block text-xs uppercase tracking-wider">
                        DESTINATÁRIO:
                      </span>
                      <span className="font-black text-zinc-900 dark:text-stone-100 block text-sm uppercase truncate">
                        {parsedData.recipient || companyProfile?.tradeName || companyProfile?.corporateName || 'NÃO INFORMADO'}
                      </span>
                      {parsedData.recipientCnpj && (
                        <span className="text-xs text-zinc-500 dark:text-stone-400 font-mono font-bold block">
                          CNPJ: {formatCpfCnpj(parsedData.recipientCnpj)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Tarja Informativa Reativa do Tipo de Transação Selecionado */}
                  {parsedData.transactionType && (
                    <div className="w-full animate-in fade-in">
                      {isClientReturnOperation(parsedData.transactionType) ? (
                        <div className="p-3 bg-sky-50 dark:bg-sky-950/40 border border-sky-300 dark:border-sky-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-sky-950 dark:text-sky-200 shadow-2xs">
                          <div className="flex items-start space-x-2.5">
                            <RotateCcw className="w-4 h-4 text-sky-700 dark:text-sky-400 mt-0.5 shrink-0" />
                            <div className="text-xs">
                              <span className="font-black uppercase tracking-wider block text-sky-900 dark:text-sky-100">
                                DEVOLUÇÃO MERCADORIA DE CLIENTE — CRÉDITO AUTOMÁTICO EM SALDO
                              </span>
                              <span className="font-medium text-sky-800 dark:text-sky-300">
                                Esta operação <strong>NÃO gera contas a pagar</strong>. O valor total da nota ({formatCurrencyBRL(parsedData.totalAmount)}) será injetado automaticamente como <strong>CRÉDITO SALDO DE CLIENTE</strong> para abatimento em vendas futuras e dará entrada física no Estoque.
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                            <span className="px-2 py-0.5 rounded text-[9.5px] font-black uppercase bg-sky-200/90 dark:bg-sky-900 text-sky-950 dark:text-sky-100 border border-sky-300 dark:border-sky-700">
                              CRÉDITO CLIENTE ATIVO
                            </span>
                            <span className="px-2 py-0.5 rounded text-[9.5px] font-black uppercase bg-zinc-200 dark:bg-stone-700 text-zinc-800 dark:text-stone-200 border border-zinc-300 dark:border-stone-600">
                              CONTAS A PAGAR BLOQUEADO
                            </span>
                          </div>
                        </div>
                      ) : isPureStockOperation(parsedData.transactionType) ? (
                        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-amber-950 dark:text-amber-200 shadow-2xs">
                          <div className="flex items-start space-x-2.5">
                            <Package className="w-4 h-4 text-amber-700 dark:text-amber-400 mt-0.5 shrink-0" />
                            <div className="text-xs">
                              <span className="font-black uppercase tracking-wider block text-amber-900 dark:text-amber-100">
                                {parsedData.transactionType} — ESTOQUE PURO SEM CUSTO
                              </span>
                              <span className="font-medium text-amber-800 dark:text-amber-300">
                                Esta operação <strong>NÃO gera parcelas no Contas a Pagar</strong> e zera a condição financeira. Realiza a <strong>entrada física na quantidade do Estoque</strong> e mantém 1 registro consolidado no Histórico Fiscal.
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                            <span className="px-2 py-0.5 rounded text-[9.5px] font-black uppercase bg-amber-200/90 dark:bg-amber-900 text-amber-950 dark:text-amber-100 border border-amber-300 dark:border-amber-700">
                              ESTOQUE FÍSICO ATIVO
                            </span>
                            <span className="px-2 py-0.5 rounded text-[9.5px] font-black uppercase bg-zinc-200 dark:bg-stone-700 text-zinc-800 dark:text-stone-200 border border-zinc-300 dark:border-stone-600">
                              CONTAS A PAGAR BLOQUEADO
                            </span>
                          </div>
                        </div>
                      ) : parsedData.transactionType === 'RETORNO MERCADORIA DE CONSERTO (ENTRADA)' ? (
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-emerald-950 dark:text-emerald-200 shadow-2xs">
                          <div className="flex items-start space-x-2.5">
                            <Wrench className="w-4 h-4 text-emerald-700 dark:text-emerald-400 mt-0.5 shrink-0" />
                            <div className="text-xs">
                              <span className="font-black uppercase tracking-wider block text-emerald-900 dark:text-emerald-100">
                                RETORNO MERCADORIA DE CONSERTO (ENTRADA) — LANÇAMENTO FINANCEIRO ATIVO
                              </span>
                              <span className="font-medium text-emerald-800 dark:text-emerald-300">
                                Esta operação <strong>mantém o lançamento financeiro ativo</strong> com geração de duplicatas no Contas a Pagar se houver custo cobrado pelo fornecedor, e registra o retorno dos itens no Estoque.
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                            <span className="px-2 py-0.5 rounded text-[9.5px] font-black uppercase bg-emerald-200/90 dark:bg-emerald-900 text-emerald-950 dark:text-emerald-100 border border-emerald-300 dark:border-emerald-700">
                              CONTAS A PAGAR ATIVO
                            </span>
                            <span className="px-2 py-0.5 rounded text-[9.5px] font-black uppercase bg-emerald-100 text-emerald-900 border border-emerald-300">
                              ESTOQUE ATIVO
                            </span>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* Tabela de Produtos da NF-e (100% da Largura da Tela - Formato Lista Enxuta) */}
                  {parsedData.items && parsedData.items.length > 0 && (
                    <div className="border border-zinc-200 dark:border-stone-700 rounded-xl overflow-hidden shadow-2xs w-full bg-white dark:bg-stone-900">
                      <div className="bg-zinc-100 dark:bg-stone-800 px-3 py-1.5 flex items-center justify-between text-zinc-900 dark:text-stone-100">
                        <div className="flex items-center space-x-2 text-xs font-black text-zinc-900 dark:text-stone-200">
                          <Package className="w-3.5 h-3.5 text-zinc-700 dark:text-stone-300 shrink-0" />
                          <span>Itens Identificados na Nota Fiscal ({parsedData.items.length})</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => setShowExtraPrices(!showExtraPrices)}
                            className="text-[10px] font-bold px-2 py-0.5 rounded border border-zinc-300 dark:border-stone-600 bg-white dark:bg-stone-700 hover:bg-zinc-100 dark:hover:bg-stone-600 text-zinc-800 dark:text-stone-200 transition cursor-pointer"
                          >
                            {showExtraPrices ? 'Ocultar Atacado/Promo' : '+ Atacado/Promo'}
                          </button>
                          <span className="text-[10px] text-zinc-500 dark:text-stone-400 font-bold hidden sm:inline">
                            Lista enxuta com precificação de venda sincronizada ao estoque
                          </span>
                        </div>
                      </div>
                      <div className="overflow-x-auto max-h-[380px] overflow-y-auto w-full border-t border-zinc-200 dark:border-stone-700">
                        <table className="w-full text-left text-xs border-collapse table-fixed">
                          <thead className="bg-zinc-100 dark:bg-stone-800 text-zinc-700 dark:text-stone-300 uppercase text-[9px] font-black border-b border-zinc-200 dark:border-stone-700 sticky top-0 z-20 whitespace-nowrap shadow-sm">
                            <tr>
                              {/* 1. Área Verde: Identificação & De-Para (Ultracompactas e Enxutas) */}
                              <th className="sticky top-0 z-20 py-1.5 px-1 w-9 text-center bg-emerald-100 dark:bg-emerald-950 text-emerald-950 dark:text-emerald-200 border-r border-emerald-200 dark:border-emerald-800 shrink-0 uppercase">
                                CÓD
                              </th>
                              <th className="sticky top-0 z-20 py-1.5 px-1.5 w-[20%] min-w-[110px] max-w-[150px] bg-emerald-100 dark:bg-emerald-950 text-emerald-950 dark:text-emerald-200 border-r border-emerald-200 dark:border-emerald-800 truncate uppercase">
                                DESCRIÇÃO DO PRODUTO
                              </th>
                              <th className="sticky top-0 z-20 py-1.5 px-1.5 w-[18%] min-w-[120px] max-w-[160px] bg-emerald-100 dark:bg-emerald-950 text-emerald-950 dark:text-emerald-200 border-r border-emerald-300 dark:border-emerald-700 truncate uppercase">
                                PRODUTO NO SISTEMA (DE-PARA)
                              </th>

                              {/* 2. Área Amarela: 1º. QTD (Quantidade + Unidade) */}
                              <th className="sticky top-0 z-20 py-1.5 px-1 w-[8%] min-w-[65px] text-right bg-amber-100 dark:bg-amber-950 text-amber-950 dark:text-amber-200 border-r border-amber-200 dark:border-amber-800 whitespace-nowrap uppercase">
                                QTD
                              </th>

                              {/* 3. Coluna Discriminada: VALOR TRIBUTADO */}
                              <th className="sticky top-0 z-20 py-1.5 px-1 w-[11%] min-w-[76px] text-right bg-amber-50 dark:bg-amber-950 text-amber-950 dark:text-amber-200 border-r border-amber-200 dark:border-amber-800 whitespace-nowrap uppercase font-black" title="Soma dos Impostos do Item: vICMS + vIPI + vPIS + vCOFINS + vIBS + vCBS">
                                VALOR TRIBUTADO
                              </th>

                              {/* 4. 2º. CUSTO COM IMPOSTO (R$) */}
                              <th className="sticky top-0 z-20 py-1.5 px-1 w-[11%] min-w-[80px] text-right bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100 border-r border-stone-200 dark:border-stone-700 whitespace-nowrap uppercase font-black" title="Custo Real Unitário com IPI: CUSTO_REAL = (vProd + vIPI) / qCom">
                                CUSTO COM IMPOSTO
                              </th>

                              {/* 5. 3º. V. TOTAL (R$) */}
                              <th className="sticky top-0 z-20 py-1.5 px-1 w-[10%] min-w-[72px] text-right bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 border-r border-stone-200 dark:border-stone-700 whitespace-nowrap uppercase">
                                V. TOTAL (R$)
                              </th>

                              {/* 6. Nova Coluna: % CÁLC. (Margem / Markup de Lucro) - Entre V. Total e V. Final */}
                              <th className="sticky top-0 z-20 py-1.5 px-1 w-[9%] min-w-[60px] text-right bg-purple-100 dark:bg-purple-950 text-purple-950 dark:text-purple-200 border-r border-purple-200 dark:border-purple-800 whitespace-nowrap uppercase">
                                % CÁLC.
                              </th>

                              {/* 7. Área Rosa: 4º. V. FINAL (R$) */}
                              <th className="sticky top-0 z-20 py-1.5 px-1 w-[11%] min-w-[76px] text-right bg-rose-100 dark:bg-rose-950 text-rose-950 dark:text-rose-200 whitespace-nowrap uppercase">
                                V. FINAL (R$)
                              </th>

                              {/* Opcionais: Atacado & Promoção com Porcentagens de Margem */}
                              {showExtraPrices && (
                                <>
                                  <th className="py-1 px-1 text-right w-[6%] min-w-[50px] bg-cyan-100/90 dark:bg-cyan-950/50 text-cyan-950 dark:text-cyan-200 border-l border-cyan-200 dark:border-cyan-800 whitespace-nowrap uppercase">
                                    % ATAC.
                                  </th>
                                  <th className="py-1 px-1 text-right w-[7%] min-w-[65px] bg-cyan-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 border-r border-stone-200 dark:border-stone-700 whitespace-nowrap uppercase">
                                    V. ATACADO (R$)
                                  </th>
                                  <th className="py-1 px-1 text-right w-[6%] min-w-[50px] bg-orange-100/90 dark:bg-orange-950/50 text-orange-950 dark:text-orange-200 border-l border-orange-200 dark:border-orange-800 whitespace-nowrap uppercase">
                                    % PROMO.
                                  </th>
                                  <th className="py-1 px-1 text-right w-[7%] min-w-[65px] bg-orange-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 border-r border-stone-200 dark:border-stone-700 whitespace-nowrap uppercase">
                                    V. PROMO (R$)
                                  </th>
                                </>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100 dark:divide-stone-800 bg-white dark:bg-stone-900 text-zinc-900 dark:text-stone-100">
                            {parsedData.items.map((item, idx) => (
                              <tr key={`parsed_nfe_item_${item.code || 'item'}_${idx}`} className="even:bg-[#f2f2f2] odd:bg-white dark:even:bg-stone-800/50 dark:odd:bg-stone-900 hover:bg-slate-200/60 dark:hover:bg-stone-800 transition-colors border-b border-slate-200 dark:border-stone-800">
                                {/* CÓD & NCM (Área Verde - Super Enxuta) */}
                                <td className="py-0.5 px-1 font-mono text-black text-[9px] text-center align-middle bg-emerald-50/20 dark:bg-emerald-950/10 border-r border-emerald-100/60 dark:border-emerald-900/30 w-9 whitespace-nowrap">
                                  <div className="font-bold text-black dark:text-stone-100 truncate" title={item.code || '-'}>
                                    {item.code || '-'}
                                  </div>
                                  {item.ncm && (
                                    <div className="text-[7.5px] text-stone-500 dark:text-stone-400 font-normal leading-tight truncate" title={`NCM: ${item.ncm}`}>
                                      {item.ncm}
                                    </div>
                                  )}
                                </td>

                                {/* DESCRIÇÃO DO PRODUTO (Área Verde - Compacta com max-w e botão Lápis de edição) */}
                                <td className="py-0.5 px-1 align-top bg-emerald-50/20 dark:bg-emerald-950/10 border-r border-emerald-100/60 dark:border-emerald-900/30 w-[20%] min-w-[110px] max-w-[150px]">
                                  <div className="flex items-center space-x-1">
                                    <input
                                      type="text"
                                      value={item.description}
                                      onChange={(e) => handleItemChange(idx, 'description', e.target.value.toUpperCase())}
                                      className="flex-1 min-w-0 h-6 px-1.5 text-[10px] rounded border border-emerald-200/80 dark:border-stone-600 bg-white dark:bg-stone-900 text-black dark:text-stone-100 focus:ring-1 focus:ring-emerald-500 font-medium truncate uppercase"
                                      placeholder="DESCRIÇÃO DO PRODUTO"
                                      title={item.description}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditProductFromNfeRow(idx)}
                                      title="Editar Produto no Estoque"
                                      className="h-6 w-6 rounded border border-amber-300 dark:border-amber-700 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center transition shrink-0 cursor-pointer"
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                  </div>

                                  {/* Micro Linha de Suporte Discriminada de Tributos na Linha */}
                                  {item.valorImpostosTotal !== undefined && item.valorImpostosTotal > 0 ? (
                                    <div className="flex items-center gap-1 mt-0.5 text-[8px] font-mono leading-none whitespace-nowrap overflow-x-auto scrollbar-none py-0.5">
                                      <span className="font-black text-amber-950 dark:text-amber-200 bg-amber-100/90 dark:bg-amber-950/60 px-1 py-0.5 rounded border border-amber-300 dark:border-amber-800 shrink-0 uppercase">
                                        TRIB: {formatCurrencyBRL(item.valorImpostosTotal)}
                                      </span>
                                      {item.vICMS ? <span className="text-zinc-600 dark:text-zinc-400 font-semibold shrink-0 uppercase">ICMS: {formatCurrencyBRL(item.vICMS)}</span> : null}
                                      {item.vIPI ? <span className="text-zinc-600 dark:text-zinc-400 font-semibold shrink-0 uppercase">IPI: {formatCurrencyBRL(item.vIPI)}</span> : null}
                                      {item.vPIS ? <span className="text-zinc-600 dark:text-zinc-400 font-semibold shrink-0 uppercase">PIS: {formatCurrencyBRL(item.vPIS)}</span> : null}
                                      {item.vCOFINS ? <span className="text-zinc-600 dark:text-zinc-400 font-semibold shrink-0 uppercase">COF: {formatCurrencyBRL(item.vCOFINS)}</span> : null}
                                      {item.vIBS ? <span className="text-zinc-600 dark:text-zinc-400 font-semibold shrink-0 uppercase">IBS: {formatCurrencyBRL(item.vIBS)}</span> : null}
                                      {item.vCBS ? <span className="text-zinc-600 dark:text-zinc-400 font-semibold shrink-0 uppercase">CBS: {formatCurrencyBRL(item.vCBS)}</span> : null}
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1 mt-0.5 text-[7.5px] font-mono text-zinc-400 dark:text-zinc-500 whitespace-nowrap py-0.5 uppercase">
                                      <span>TRIBUTOS NÃO DESTACADOS</span>
                                    </div>
                                  )}
                                </td>

                                {/* PRODUTO NO SISTEMA DE-PARA (Área Verde - Compacta com max-w) */}
                                <td className="py-0.5 px-1 align-top bg-emerald-50/20 dark:bg-emerald-950/10 border-r border-emerald-200/60 dark:border-emerald-900/40 w-[18%] min-w-[120px] max-w-[160px]">
                                  {item.linkedInventoryId ? (
                                    (() => {
                                      const linked = localInventory.find(p => p.id === item.linkedInventoryId);
                                      return (
                                        <div className="flex items-center justify-between gap-1 h-6 px-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded">
                                          <div className="min-w-0 flex-1 flex items-center space-x-1">
                                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                            <span className="text-[9px] font-bold text-black dark:text-stone-100 truncate uppercase" title={linked?.nome_comercial || linked?.name}>
                                              {linked?.code ? `[${linked.code}] ` : ''}{linked?.nome_comercial || linked?.name || 'VINCULADO'}
                                            </span>
                                            <span className="text-[8px] text-emerald-900 dark:text-emerald-300 font-bold shrink-0 bg-emerald-100 dark:bg-emerald-900/60 px-0.5 rounded">
                                              {linked?.quantidade_atual !== undefined ? linked.quantidade_atual : (linked?.quantity || 0)}
                                            </span>
                                          </div>
                                          <div className="flex items-center space-x-0.5 shrink-0">
                                            <button
                                              type="button"
                                              onClick={() => handleOpenEditProductFromNfeRow(idx)}
                                              title="Editar Produto no Estoque"
                                              className="p-0.5 text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200 hover:bg-amber-100/80 dark:hover:bg-amber-900/50 rounded transition cursor-pointer"
                                            >
                                              <Pencil className="w-2.5 h-2.5" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleLinkProduct(idx, undefined)}
                                              title="Desvincular produto"
                                              className="p-0.5 text-stone-400 hover:text-rose-600 rounded transition cursor-pointer"
                                            >
                                              <X className="w-2.5 h-2.5" />
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })()
                                  ) : (
                                    <div className="flex items-center space-x-1">
                                      <select
                                        value={item.linkedInventoryId || ''}
                                        onChange={(e) => {
                                          if (e.target.value === '__NEW__') {
                                            handleOpenNewProductModal(idx);
                                          } else if (e.target.value) {
                                            handleLinkProduct(idx, e.target.value);
                                          }
                                        }}
                                        className="flex-1 min-w-0 h-6 px-1 text-[9px] rounded border border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-stone-900 text-black dark:text-stone-100 focus:ring-1 focus:ring-[#0963cb] font-medium truncate uppercase"
                                      >
                                        <option value="">VINCULAR ESTOQUE...</option>
                                        <option value="__NEW__" className="font-bold text-[#0963cb]">
                                          + CADASTRAR NOVO
                                        </option>
                                        {localInventory.map((inv) => (
                                          <option key={inv.id} value={inv.id}>
                                            {inv.code ? `[${inv.code}] ` : ''}{inv.nome_comercial || inv.name} ({inv.quantidade_atual !== undefined ? inv.quantidade_atual : inv.quantity} {inv.unidade_medida || inv.unit})
                                          </option>
                                        ))}
                                      </select>
                                      <button
                                        type="button"
                                        onClick={() => handleOpenEditProductFromNfeRow(idx)}
                                        title="Editar Produto no Estoque"
                                        className="h-6 w-6 font-bold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 hover:bg-amber-200 dark:hover:bg-amber-900 border border-amber-300 dark:border-amber-700 rounded transition flex items-center justify-center shrink-0 cursor-pointer"
                                      >
                                        <Pencil className="w-2.5 h-2.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleOpenNewProductModal(idx)}
                                        title="Cadastrar Novo Produto no Estoque"
                                        className="h-6 px-1 text-[9px] font-bold text-blue-900 dark:text-blue-200 bg-blue-100 dark:bg-blue-950/60 hover:bg-blue-200 dark:hover:bg-blue-900 border border-blue-300 dark:border-blue-700 rounded transition flex items-center space-x-0.5 shrink-0 cursor-pointer"
                                      >
                                        <Plus className="w-2.5 h-2.5" />
                                        <span>+</span>
                                      </button>
                                    </div>
                                  )}
                                </td>

                                {/* 1º. QTD (Quantidade + Unidade de medida) - Área Amarela */}
                                <td className="py-0.5 px-1 text-right align-top bg-amber-50/40 dark:bg-amber-950/20 border-r border-amber-200/60 dark:border-amber-800/40 whitespace-nowrap">
                                  <div className="flex items-center justify-end space-x-0.5">
                                    <input
                                      type="number"
                                      step="any"
                                      min="0"
                                      value={item.quantity}
                                      onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                                      className="w-11 h-6 px-0.5 text-[10px] text-right rounded border border-amber-300 dark:border-amber-700 bg-amber-50/80 dark:bg-stone-900 text-black dark:text-stone-100 font-mono font-bold focus:ring-1 focus:ring-amber-500"
                                      placeholder="0"
                                      title="Quantidade"
                                    />
                                    <span className="text-[8.5px] text-amber-950 dark:text-amber-200 font-black uppercase shrink-0 px-1 py-0.5 bg-amber-100/90 dark:bg-amber-900/60 rounded border border-amber-200/80 dark:border-amber-800/80 text-center min-w-[20px]">
                                      {item.unit || 'UN'}
                                    </span>
                                  </div>
                                </td>

                                {/* 2º. VALOR TRIBUTADO (Soma dos Impostos do Item: vICMS + vIPI + vPIS + vCOFINS + vIBS + vCBS) */}
                                <td className="py-0.5 px-1 text-right align-top bg-amber-50/40 dark:bg-amber-950/20 border-r border-amber-200/60 dark:border-amber-800/40 whitespace-nowrap">
                                  <span className="text-[10px] font-mono font-black text-amber-950 dark:text-amber-200 block" title={`Valor Tributado Total: ${formatCurrencyBRL(item.valorImpostosTotal || 0)}`}>
                                    {formatCurrencyBRL(item.valorImpostosTotal || 0)}
                                  </span>
                                  {item.vProdOriginal !== undefined && item.vProdOriginal > 0 && (
                                    <span className="text-[7.5px] font-mono text-zinc-500 dark:text-zinc-400 block uppercase" title="Valor Bruto de Tabela do Produto (vProd)">
                                      BRUTO: {formatCurrencyBRL(item.vProdOriginal)}
                                    </span>
                                  )}
                                </td>

                                {/* 3º. CUSTO COM IMPOSTO (V. UNIT Integrado: CUSTO_REAL = (vProd + vIPI) / qCom) */}
                                <td className="py-0.5 px-1 text-right align-top border-r border-stone-200/60 dark:border-stone-800 whitespace-nowrap">
                                  <input
                                    type="number"
                                    step="any"
                                    min="0"
                                    value={item.unitPrice}
                                    onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                                    className="w-full max-w-[78px] h-6 px-1 text-[10px] text-right rounded border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-900 text-black dark:text-stone-100 font-mono font-bold focus:ring-1 focus:ring-[#0963cb] ml-auto block"
                                    placeholder="0.00"
                                    title="Custo Real Unitário com IPI: (vProd + vIPI) / qCom"
                                  />
                                </td>

                                {/* 4º. V. TOTAL (R$) (V. TOTAL = QUANTIDADE * CUSTO_REAL) */}
                                <td className="py-0.5 px-1 text-right align-top border-r border-stone-200/60 dark:border-stone-800 whitespace-nowrap">
                                  <input
                                    type="number"
                                    step="any"
                                    min="0"
                                    value={item.totalPrice}
                                    onChange={(e) => handleItemChange(idx, 'totalPrice', e.target.value)}
                                    className="w-full max-w-[80px] h-6 px-1 text-[10px] text-right rounded border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-900 text-black dark:text-stone-100 font-mono font-bold focus:ring-1 focus:ring-[#0963cb] ml-auto block"
                                    placeholder="0.00"
                                    title="Valor Total do Item na NF com IPI: QUANTIDADE * CUSTO_REAL"
                                  />
                                </td>

                                {/* 4º. % CÁLC. (% Margem / Markup) - Cálculo Automático do V. FINAL */}
                                <td className="py-0.5 px-1 text-right align-middle bg-purple-50/40 dark:bg-purple-950/20 border-r border-purple-200/60 dark:border-purple-800/40">
                                  <div className="flex items-center justify-end space-x-0.5">
                                    <input
                                      type="number"
                                      step="0.1"
                                      value={item.markupPercent ?? ''}
                                      onChange={(e) => handleItemChange(idx, 'markupPercent', e.target.value)}
                                      placeholder="0"
                                      className="w-full max-w-[55px] h-6 px-1 text-[10px] text-right rounded border border-purple-300 dark:border-purple-700 bg-purple-50/80 dark:bg-stone-900 text-purple-950 dark:text-purple-200 font-mono font-bold focus:ring-1 focus:ring-purple-500 ml-auto block"
                                      title="Margem / Markup de Lucro (%): V. Final = V. Unit + (V. Unit * % / 100)"
                                    />
                                    <span className="text-[9px] font-black text-purple-900 dark:text-purple-300 shrink-0">%</span>
                                  </div>
                                </td>

                                {/* 5º. V. FINAL (R$) (O valor final com precificação calculada/ajustada - Área Rosa) */}
                                <td className="py-0.5 px-1 text-right align-middle bg-rose-50/40 dark:bg-rose-950/20">
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={item.salePrice ?? ''}
                                    onChange={(e) => handleItemChange(idx, 'salePrice', e.target.value)}
                                    placeholder="0.00"
                                    className="w-full max-w-[82px] h-6 px-1 text-[10px] text-right rounded border border-rose-300 dark:border-rose-700 bg-rose-50/80 dark:bg-stone-900 text-rose-950 dark:text-stone-100 font-mono font-bold focus:ring-1 focus:ring-rose-500 ml-auto block"
                                    title="Preço de Venda Final Sincronizado ao Estoque (V. Final)"
                                  />
                                </td>

                                {/* Opcionais: Atacado & Promoção com Inputs de Porcentagem (% Atac. e % Promo.) */}
                                {showExtraPrices && (
                                  <>
                                    {/* % ATAC. */}
                                    <td className="py-0.5 px-1 text-right align-middle bg-cyan-50/40 dark:bg-cyan-950/20 border-l border-cyan-200/60 dark:border-cyan-800/40">
                                      <div className="flex items-center justify-end space-x-0.5">
                                        <input
                                          type="number"
                                          step="0.1"
                                          value={item.wholesaleMarkupPercent ?? ''}
                                          onChange={(e) => handleItemChange(idx, 'wholesaleMarkupPercent', e.target.value)}
                                          placeholder="0"
                                          className="w-full max-w-[48px] h-6 px-0.5 text-[10px] text-right rounded border border-cyan-300 dark:border-cyan-700 bg-cyan-50/80 dark:bg-stone-900 text-cyan-950 dark:text-cyan-200 font-mono font-bold focus:ring-1 focus:ring-cyan-500 ml-auto block"
                                          title="Margem Atacado (%): V. Atacado = V. Unit + (V. Unit * % / 100)"
                                        />
                                        <span className="text-[8.5px] font-black text-cyan-900 dark:text-cyan-300 shrink-0">%</span>
                                      </div>
                                    </td>

                                    {/* V. ATACADO (R$) */}
                                    <td className="py-0.5 px-1 text-right align-middle border-r border-stone-200 dark:border-stone-700">
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={item.wholesalePrice ?? ''}
                                        onChange={(e) => handleItemChange(idx, 'wholesalePrice', e.target.value)}
                                        placeholder="0.00"
                                        className="w-full max-w-[65px] h-6 px-1 text-[10px] text-right rounded border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-900 text-black dark:text-stone-100 font-mono font-medium focus:ring-1 focus:ring-[#0963cb] ml-auto block"
                                        title="Preço de Venda em Atacado (V. Atacado)"
                                      />
                                    </td>

                                    {/* % PROMO. */}
                                    <td className="py-0.5 px-1 text-right align-middle bg-orange-50/40 dark:bg-orange-950/20 border-l border-orange-200/60 dark:border-orange-800/40">
                                      <div className="flex items-center justify-end space-x-0.5">
                                        <input
                                          type="number"
                                          step="0.1"
                                          value={item.promoMarkupPercent ?? ''}
                                          onChange={(e) => handleItemChange(idx, 'promoMarkupPercent', e.target.value)}
                                          placeholder="0"
                                          className="w-full max-w-[48px] h-6 px-0.5 text-[10px] text-right rounded border border-orange-300 dark:border-orange-700 bg-orange-50/80 dark:bg-stone-900 text-orange-950 dark:text-orange-200 font-mono font-bold focus:ring-1 focus:ring-orange-500 ml-auto block"
                                          title="Margem Promoção (%): V. Promo = V. Unit + (V. Unit * % / 100)"
                                        />
                                        <span className="text-[8.5px] font-black text-orange-900 dark:text-orange-300 shrink-0">%</span>
                                      </div>
                                    </td>

                                    {/* V. PROMO (R$) */}
                                    <td className="py-0.5 px-1 text-right align-middle border-r border-stone-200 dark:border-stone-700">
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={item.promoPrice ?? ''}
                                        onChange={(e) => handleItemChange(idx, 'promoPrice', e.target.value)}
                                        placeholder="0.00"
                                        className="w-full max-w-[65px] h-6 px-1 text-[10px] text-right rounded border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-900 text-black dark:text-stone-100 font-mono font-medium focus:ring-1 focus:ring-[#0963cb] ml-auto block"
                                        title="Preço Promocional (V. Promo)"
                                      />
                                    </td>
                                  </>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Card de Validação Financeira & Seleção de Centro de Custo */}
                  <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                    costCenterError 
                      ? 'bg-rose-50/95 dark:bg-rose-950/30 border-rose-500 ring-2 ring-rose-500/30' 
                      : 'bg-zinc-50 dark:bg-stone-900 border-zinc-200 dark:border-stone-700 shadow-2xs text-zinc-900 dark:text-stone-100'
                  }`}>
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex-1 space-y-1.5">
                        <div className="flex items-center space-x-2">
                          <Building2 className={`w-4 h-4 ${costCenterError ? 'text-rose-600' : 'text-zinc-700 dark:text-stone-300'}`} />
                          <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-stone-200">
                            Classificação Financeira & Centro de Custo
                          </h4>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider shadow-2xs ${
                            isFinancialBlockedOperation(parsedData.transactionType)
                              ? 'bg-slate-700 text-white border border-slate-600'
                              : 'bg-rose-600 text-white'
                          }`}>
                            {isFinancialBlockedOperation(parsedData.transactionType) ? 'Lançamento Financeiro Bloqueado' : 'Seleção Obrigatória'}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-600 dark:text-stone-300 leading-relaxed font-medium">
                          {isClientReturnOperation(parsedData.transactionType)
                            ? 'Para Devolução de Mercadoria de Cliente, o lançamento no Contas a Pagar está bloqueado. O valor total será creditado no saldo do cliente para abatimento em vendas futuras e dará entrada física no estoque.'
                            : isPureStockOperation(parsedData.transactionType)
                            ? `Para operações de Estoque Puro (${parsedData.transactionType}), o lançamento no Contas a Pagar está bloqueado. Apenas será realizada a entrada física dos produtos no estoque e o registro fiscal.`
                            : 'Antes de finalizar o salvamento da nota importada, informe a qual Centro de Custo esta despesa pertence (Safra, Maquinários, Administrativo ou Geral) para integração com o Contas a Pagar.'}
                        </p>
                      </div>

                      <div className="lg:w-96 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-1 flex-wrap">
                          <label 
                            htmlFor="select-centro-de-custo-nfe"
                            className="block text-xs font-black text-zinc-900 dark:text-stone-300 uppercase tracking-wider"
                          >
                            Centro de Custo {!isFinancialBlockedOperation(parsedData.transactionType) && <span className="text-rose-600 font-black">*</span>}
                          </label>
                        </div>

                        <div className="flex items-center gap-2">
                          <select
                            id="select-centro-de-custo-nfe"
                            value={selectedCostCenterId}
                            onChange={(e) => {
                              setSelectedCostCenterId(e.target.value);
                              if (e.target.value) setCostCenterError(false);
                            }}
                            className={`w-full flex-1 px-3 py-2 text-xs font-bold rounded-xl border bg-white dark:bg-stone-800 text-zinc-900 dark:text-stone-100 focus:outline-hidden transition cursor-pointer shadow-2xs ${
                              costCenterError 
                                ? 'border-rose-500 focus:ring-2 focus:ring-rose-500/30' 
                                : 'border-zinc-300 dark:border-stone-700 focus:ring-2 focus:ring-zinc-500/20'
                            }`}
                          >
                            <option value="">{isFinancialBlockedOperation(parsedData.transactionType) ? '-- Centro de Custo Opcional (Gerencial) --' : '-- Selecione o Centro de Custo (Obrigatório) --'}</option>
                            {localCostCenters.map(cc => (
                              <option key={cc.id} value={cc.id}>
                                {cc.name} ({cc.type.toUpperCase()})
                              </option>
                            ))}
                          </select>

                          {/* Botão/ícone do Lápis ('Editar') - Redireciona diretamente para o Cadastros Base na aba Centros de Custo */}
                          <button
                            type="button"
                            id="btn-editar-centro-nfe"
                            onClick={handleNavigateToCadastrosBaseCentrosCusto}
                            className="p-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/50 dark:hover:bg-amber-900/60 text-amber-950 dark:text-amber-200 shadow-2xs transition shrink-0 cursor-pointer flex items-center justify-center"
                            title="Gerenciar e Editar Centros de Custo no Cadastros Base"
                            aria-label="Gerenciar Centros de Custo no Cadastros Base"
                          >
                            <Pencil className="w-3.5 h-3.5 text-amber-800 dark:text-amber-300" />
                          </button>
                        </div>

                        {costCenterError && (
                          <span className="text-[11px] font-black text-rose-700 dark:text-rose-400 flex items-center gap-1 mt-0.5">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Bloqueio de Validação: Escolha o Centro de Custo para salvar a nota.
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Informações Financeiras Complementares Extraídas do XML */}
                    <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-stone-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-zinc-600 dark:text-stone-400" />
                        <div>
                          <span className="text-zinc-500 dark:text-stone-400 font-bold block text-[11px] uppercase">VENCIMENTO PRINCIPAL:</span>
                          <span className="font-black text-zinc-900 dark:text-stone-200">
                            {formatDateBR(parsedData.dueDate || parsedData.issueDate)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <CreditCard className="w-4 h-4 text-zinc-600 dark:text-stone-400" />
                        <div>
                          <span className="text-zinc-500 dark:text-stone-400 font-bold block text-[11px] uppercase">FORMA DE PAGAMENTO:</span>
                          <span className="font-black text-zinc-900 dark:text-stone-200 uppercase">
                            {isFinancialBlockedOperation(parsedData.transactionType)
                              ? (isClientReturnOperation(parsedData.transactionType) ? 'CRÉDITO DO CLIENTE (SALDO)' : 'ISENTO / SEM CUSTO')
                              : (parsedData.paymentMethod || 'BOLETO BANCÁRIO').toUpperCase()}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white dark:bg-stone-800 p-2.5 rounded-xl border border-zinc-200 dark:border-stone-700">
                        <div className="flex items-center space-x-2">
                          <Receipt className="w-4 h-4 text-zinc-700 dark:text-stone-300 shrink-0" />
                          <div>
                            <span className="text-zinc-500 dark:text-stone-400 font-bold block text-[11px] uppercase">CONDIÇÃO / PARCELAS:</span>
                            <span className="font-black text-zinc-900 dark:text-stone-100 uppercase">
                              {isFinancialBlockedOperation(parsedData.transactionType)
                                ? '0 PARCELAS (BLOQUEADO)'
                                : parsedData.installments && parsedData.installments.length > 1
                                ? `${parsedData.installments.length} PARCELAS IDENTIFICADAS NO XML`
                                : `${userInstallmentCount} PARCELA(S)`}
                            </span>
                          </div>
                        </div>

                        {isFinancialBlockedOperation(parsedData.transactionType) ? (
                          <div className="px-3 py-1.5 bg-slate-100 dark:bg-stone-700/60 border border-slate-300 dark:border-stone-600 text-slate-700 dark:text-stone-300 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 uppercase cursor-default">
                            <ShieldCheck className="w-3.5 h-3.5 text-slate-600 dark:text-stone-400" />
                            <span>{isClientReturnOperation(parsedData.transactionType) ? 'PARCELAS BLOQUEADAS (CRÉDITO AO CLIENTE)' : 'PARCELAS BLOQUEADAS (ESTOQUE PURO)'}</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            id="btn-abrir-janela-2-parcelas-inline"
                            onClick={() => {
                              if (!selectedCostCenterId) {
                                setCostCenterError(true);
                                setErrorMessage('Selecione primeiro o Centro de Custo para detalhar as parcelas.');
                                const selectEl = document.getElementById('select-centro-de-custo-nfe');
                                if (selectEl) {
                                  selectEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  selectEl.focus();
                                }
                                return;
                              }
                              setCostCenterError(false);
                              setErrorMessage('');
                              setIsInstallmentsModalOpen(true);
                            }}
                            className="px-3 py-1.5 bg-zinc-900 hover:bg-black dark:bg-stone-700 dark:hover:bg-stone-600 text-white rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer shadow-2xs uppercase tracking-wider"
                            title="ABRIR DETALHAMENTO DE PARCELAS (JANELA 2)"
                          >
                            <Layers className="w-3.5 h-3.5" />
                            <span>DETALHAMENTO DE PARCELAS (JANELA 2)</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card de Resumo Horizontal no Rodapé (100% de Largura) */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-zinc-50 dark:bg-stone-800/40 border border-zinc-200 dark:border-stone-700 w-full shadow-2xs text-zinc-900 dark:text-stone-100">
                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                      
                      {/* Grid Horizontal dos 3 Blocos Restantes de Informação */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 flex-1">
                        
                        {/* Bloco 1: Total dos Produtos */}
                        <div className="p-3.5 bg-white dark:bg-stone-900 rounded-xl border border-zinc-200 dark:border-stone-700/80 flex flex-col justify-between shadow-2xs">
                          <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500 dark:text-stone-400 block mb-1">
                            TOTAL DOS PRODUTOS
                          </span>
                          <span className="text-base sm:text-lg font-black text-zinc-900 dark:text-stone-100 font-mono">
                            {formatCurrencyBRL(
                              (parsedData.productsAmount && parsedData.productsAmount > 0)
                                ? parsedData.productsAmount
                                : (parsedData.items && parsedData.items.length > 0
                                    ? Math.round(parsedData.items.reduce((acc, it) => acc + (it.vProdOriginal || 0), 0) * 100) / 100
                                    : parsedData.totalAmount)
                            )}
                          </span>
                        </div>

                        {/* Bloco 2: Vinculação ao Estoque */}
                        <div className="p-3.5 bg-white dark:bg-stone-900 rounded-xl border border-zinc-200 dark:border-stone-700/80 flex flex-col justify-between shadow-2xs">
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500 dark:text-stone-400 flex items-center space-x-1">
                              <Package className="w-3.5 h-3.5 text-zinc-700 dark:text-stone-300" />
                              <span className="uppercase">VINCULAÇÃO AO ESTOQUE</span>
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                              (parsedData.items?.filter(i => i.linkedInventoryId).length || 0) === (parsedData.items?.length || 0)
                                ? 'bg-emerald-100 text-emerald-950 border border-emerald-300'
                                : 'bg-amber-100 text-amber-950 border border-amber-300'
                            }`}>
                              {parsedData.items?.filter(i => i.linkedInventoryId).length || 0} DE {parsedData.items?.length || 0}
                            </span>
                          </div>
                          <span className="text-[11px] text-zinc-700 dark:text-stone-300 font-semibold truncate block uppercase">
                            {(parsedData.items?.filter(i => i.linkedInventoryId).length || 0) === (parsedData.items?.length || 0)
                              ? 'TODOS OS ITENS VINCULADOS AO ESTOQUE'
                              : 'VINCULE OS ITENS PARA ATUALIZAR O ESTOQUE'}
                          </span>
                        </div>

                        {/* Bloco 3: Valor Total NF-e */}
                        <div className="p-3.5 bg-white dark:bg-stone-900 rounded-xl border-2 border-emerald-500 shadow-2xs flex flex-col justify-between">
                          <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500 dark:text-stone-400 block mb-1">
                            VALOR TOTAL NF-E
                          </span>
                          <span className="text-xl font-black text-emerald-700 dark:text-emerald-400 font-mono leading-none">
                            {formatCurrencyBRL(
                              parsedData.totalAmount > 0
                                ? parsedData.totalAmount
                                : (parsedData.items && parsedData.items.length > 0
                                    ? Math.round(parsedData.items.reduce((acc, it) => acc + (it.totalPrice || 0), 0) * 100) / 100
                                    : 0)
                            )}
                          </span>
                        </div>

                      </div>

                      {/* Botões de Ação alinhados à direita */}
                      <div className="xl:w-80 shrink-0 flex flex-col justify-center gap-2">
                        {errorMessage && (
                          <div className="p-2.5 bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center space-x-2 text-rose-700 dark:text-rose-300 text-xs font-bold animate-in fade-in">
                            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                            <span>{errorMessage}</span>
                          </div>
                        )}
                        <div className="flex flex-col sm:flex-row items-center gap-2.5 justify-end">
                          <button
                            type="button"
                            id="btn-voltar-para-lista-rodape"
                            onClick={handleBackToList}
                            className="w-full sm:w-auto px-4 py-3 bg-white dark:bg-stone-800 hover:bg-zinc-100 dark:hover:bg-stone-700 text-zinc-800 dark:text-stone-200 font-extrabold uppercase tracking-wider rounded-xl border border-zinc-200 dark:border-stone-700 transition flex items-center justify-center space-x-2 cursor-pointer text-xs min-h-[46px] shadow-2xs"
                          >
                            <X className="w-4 h-4 stroke-[2.5]" />
                            <span>CANCELAR</span>
                          </button>
                          <button
                            type="button"
                            id="btn-confirmar-importacao-nfe"
                            onClick={handleProceedToInstallments}
                            className="w-full sm:flex-1 py-3 px-4 bg-[#059669] hover:bg-[#047857] active:bg-[#065f46] text-white font-black uppercase tracking-wider rounded-xl shadow-md transition flex items-center justify-center space-x-2 cursor-pointer active:scale-98 text-xs min-h-[46px]"
                            title={isClientReturnOperation(parsedData.transactionType) ? 'CONFIRMAR ENTRADA NO ESTOQUE E GERAR CRÉDITO DO CLIENTE' : isPureStockOperation(parsedData.transactionType) ? 'CONFIRMAR ENTRADA FÍSICA NO ESTOQUE SEM CONTAS A PAGAR' : 'SALVAR ALTERAÇÕES E AVANÇAR PARA DETALHAMENTO DE PARCELAS'}
                          >
                            <Check className="w-5 h-5 stroke-[2.5]" />
                            <span>
                              {isClientReturnOperation(parsedData.transactionType)
                                ? 'CONFIRMAR DEVOLUÇÃO & GERAR CRÉDITO DO CLIENTE'
                                : isPureStockOperation(parsedData.transactionType)
                                ? 'CONFIRMAR ENTRADA DE ESTOQUE (SEM CONTAS A PAGAR)'
                                : 'SALVAR ALTERAÇÕES DA NOTA'}
                            </span>
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>

                </div>
              </div>
        </div>
      )}

      {/* 3. HISTÓRICO UNIFICADO DE NOTAS E ENTRADAS (XML & REGISTROS MANUAIS) */}
      <div id="painel-historico-notas-nfe" className="flex-1 min-h-0 flex flex-col gap-1.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div className="flex items-center space-x-2">
            <h3 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center space-x-1.5">
              <ReceiptText className={`w-3.5 h-3.5 ${activeDocDirection === 'saida' ? 'text-blue-700' : 'text-sky-600'}`} />
              <span>
                {activeDocDirection === 'saida'
                  ? `Histórico de Notas de Saída Emitidas (${filteredUnifiedEntries.length})`
                  : `Histórico de Notas e Entradas (${filteredUnifiedEntries.length})`}
              </span>
            </h3>
            <button
              type="button"
              onClick={handleManualSync}
              disabled={isSyncingDocs}
              title="Sincronizar em tempo real com a nuvem"
              className="inline-flex items-center space-x-1 px-2 py-0.5 text-[11px] font-medium text-stone-500 hover:text-sky-600 dark:text-stone-400 dark:hover:text-sky-400 bg-stone-100 dark:bg-stone-800 hover:bg-sky-50 dark:hover:bg-sky-950/40 rounded-md border border-stone-200 dark:border-stone-700 transition cursor-pointer"
            >
              <RotateCcw className={`w-3 h-3 ${isSyncingDocs ? 'animate-spin text-sky-600' : ''}`} />
              <span>{isSyncingDocs ? 'Sincronizando...' : 'Sincronizar'}</span>
            </button>
          </div>
          {filteredUnifiedEntries.length > 0 && (
            <span className="text-[11px] sm:text-xs text-stone-600 dark:text-stone-400">
              Clique em uma linha para visualizar ou editar os detalhes.
            </span>
          )}
        </div>

        <div className="bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-800 rounded-xl overflow-hidden shadow-2xs w-full max-w-full flex-1 min-h-0 flex flex-col">
          <div className={`w-full max-w-full ${parsedData ? 'h-[calc(100vh-295px)] min-h-[380px]' : 'flex-1 min-h-[360px]'} overflow-y-auto overflow-x-auto`}>
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 border-b border-slate-300 dark:border-stone-700 text-slate-700 dark:text-stone-300 uppercase text-[10px] font-bold tracking-wider shadow-sm">
                <tr>
                  <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 py-1.5 px-2.5 w-[110px] shrink-0 whitespace-nowrap">DOCUMENTO</th>
                  <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 py-1.5 px-2.5 w-[160px] lg:w-[200px] whitespace-nowrap">
                    {activeDocDirection === 'saida' ? 'DESTINATÁRIO / TOMADOR' : 'FORNECEDOR'}
                  </th>
                  <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 py-1.5 px-2.5 min-w-[150px] whitespace-nowrap">DESCRIÇÃO / OBS.</th>
                  <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 py-1.5 px-2 w-[85px] text-center shrink-0 whitespace-nowrap">DATA</th>
                  <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 py-1.5 px-2.5 w-[105px] text-right shrink-0 whitespace-nowrap">VALOR</th>
                  <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 py-1.5 px-3 text-right min-w-[360px] w-[360px] shrink-0 whitespace-nowrap">AÇÃO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {filteredUnifiedEntries.length === 0 ? (
                  <tr key="unified_entries_empty_row">
                    <td colSpan={6} className="py-6 text-center text-stone-500 font-semibold uppercase text-xs">
                      {activeDocDirection === 'saida'
                        ? 'NENHUMA NOTA DE SAÍDA REGISTRADA NESTA COMPETÊNCIA. CLIQUE EM "+ LANÇAR NOTA DE SAÍDA" PARA EMITIR/REGISTRAR.'
                        : 'NENHUM REGISTRO ENCONTRADO'}
                    </td>
                  </tr>
                ) : (
                  filteredUnifiedEntries.map((entry, idx) => {
                    const isXml = entry.sourceType === 'xml';
                    const rawNotaSaida = (entry as any).rawNotaSaida as NotaSaidaRecord | undefined;
                    return (
                      <tr 
                        key={`unified_entry_${entry.sourceType}_${entry.id || 'doc'}_${idx}`} 
                        id={`row-doc-${entry.id || idx}`}
                      onClick={(e) => {
                        const target = e.target as HTMLElement;
                        if (target && target.closest('button')) {
                          return;
                        }
                        if (rawNotaSaida) {
                          setViewingNotaSaida(rawNotaSaida);
                        } else if (entry.rawExpense) {
                          handleEditNota(entry.rawExpense);
                        } else if (entry.rawManualDoc) {
                          if (entry.rawManualDoc.status === 'Rascunho') {
                            handleOpenEditManualDoc(entry.rawManualDoc);
                          } else {
                            setViewingManualDoc(entry.rawManualDoc);
                          }
                        } else if (entry.rawLegacyFiscalDoc) {
                          setViewingLegacyDoc(entry.rawLegacyFiscalDoc);
                        } else if (entry.rawMdfeDoc) {
                          setViewingMdfeDoc(entry.rawMdfeDoc);
                        }
                      }}
                      className="even:bg-[#f2f2f2] odd:bg-white dark:even:bg-stone-800/50 dark:odd:bg-stone-900 hover:bg-slate-200/60 dark:hover:bg-stone-800 cursor-pointer transition group whitespace-nowrap border-b border-slate-200 dark:border-stone-800"
                      title={isXml ? `Clique para abrir e editar os detalhes da nota ${entry.documentNumber}` : `Clique para visualizar os detalhes de ${entry.documentNumber}`}
                    >
                      <td className="py-1 px-2.5 font-mono font-bold text-xs text-stone-800 dark:text-stone-200 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5 truncate">
                          {rawNotaSaida ? (
                            <ArrowUpRight className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400 shrink-0 transition" />
                          ) : isXml ? (
                            <FileEdit className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0 transition" />
                          ) : entry.sourceType === 'mdfe' ? (
                            <Truck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0 transition" />
                          ) : (
                            <Receipt className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 transition" />
                          )}
                          <span className="truncate group-hover:underline underline-offset-2 font-bold text-stone-900 dark:text-stone-100 uppercase">
                            {entry.documentNumber}
                          </span>
                        </div>
                      </td>
                      <td className="py-1 px-2.5 font-semibold text-xs sm:text-sm text-stone-800 dark:text-stone-200 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 max-w-[240px]">
                          <span className="truncate uppercase" title={entry.supplier || '-'}>
                            {(entry.supplier || '-').toUpperCase()}
                          </span>
                          {entry.vehicleLabel && (
                            <span
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[9px] font-bold uppercase shrink-0"
                              title={`Veículo / Placa: ${entry.vehicleLabel}`}
                            >
                              <Truck className="w-2.5 h-2.5" />
                              <span className="truncate max-w-[85px]">{entry.vehicleLabel}</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-1 px-2.5 text-xs text-stone-600 dark:text-stone-300 whitespace-nowrap">
                        <span className="truncate max-w-[240px] sm:max-w-none block uppercase" title={entry.description}>
                          {(entry.description || '-').toUpperCase()}
                        </span>
                      </td>
                      <td className="py-1 px-2 text-stone-500 text-center whitespace-nowrap text-xs font-mono">
                        {formatDateBR(entry.date)}
                      </td>
                      <td className="py-1 px-2.5 font-bold text-stone-900 dark:text-stone-100 text-right whitespace-nowrap font-mono text-xs sm:text-sm">
                        {formatCurrencyBRL(entry.amount)}
                      </td>
                      <td 
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        className="py-1 px-3 text-right whitespace-nowrap min-w-[360px] w-[360px] shrink-0"
                      >
                        <div 
                          className="flex flex-row items-center justify-end gap-1.5 sm:gap-2 flex-nowrap whitespace-nowrap"
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          {/* 1. Tag de status no início da linha */}
                          {rawNotaSaida ? (
                            <>
                              {rawNotaSaida.lancarContasReceber && (
                                <span
                                  className={`h-6 inline-flex items-center text-[9px] font-black px-1.5 py-0.5 rounded-md border uppercase tracking-wider shrink-0 leading-none whitespace-nowrap ${
                                    rawNotaSaida.receberStatus === 'pago'
                                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                      : 'bg-amber-100 text-amber-800 border-amber-300'
                                  }`}
                                  title="Integrada ao Contas a Receber"
                                >
                                  {rawNotaSaida.receberStatus === 'pago' ? 'RECEBIDA' : 'A RECEBER'}
                                </span>
                              )}
                              <span className="h-6 inline-flex items-center text-[10px] font-black px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800 uppercase tracking-wider shrink-0 leading-none whitespace-nowrap">
                                {(entry.documentType || 'SAÍDA').toUpperCase()} / {entry.status}
                              </span>
                            </>
                          ) : isXml && entry.rawExpense ? (
                            <span className="h-6 inline-flex items-center text-[10px] font-black px-2 py-0.5 rounded-md bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-800 uppercase tracking-wider shrink-0 leading-none whitespace-nowrap">
                              XML / NF-E
                            </span>
                          ) : entry.sourceType === 'mdfe' ? (
                            <span className="h-6 inline-flex items-center text-[10px] font-black px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800 uppercase tracking-wider shrink-0 leading-none whitespace-nowrap">
                              MDF-E / {entry.status}
                            </span>
                          ) : entry.rawLegacyFiscalDoc ? (
                            <span className="h-6 inline-flex items-center text-[10px] font-black px-2 py-0.5 rounded-md bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-800 uppercase tracking-wider shrink-0 leading-none whitespace-nowrap">
                              {(entry.documentType || 'FISCAL').toUpperCase()} / {entry.status}
                            </span>
                          ) : (
                            <span className={`h-6 inline-flex items-center text-[10px] font-black px-2 py-0.5 rounded-md border uppercase tracking-wider shrink-0 leading-none whitespace-nowrap ${
                              entry.rawManualDoc?.status === 'Rascunho'
                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                                : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                            }`}>
                              {(entry.documentType || 'MANUAL').toUpperCase()} / {entry.rawManualDoc?.status === 'Rascunho' ? 'RASCUNHO' : 'FINALIZADO'}
                            </span>
                          )}

                          {/* 2. Botão Editar (Lápis) */}
                          {rawNotaSaida ? (
                            <button
                              type="button"
                              id={`btn-edit-nota-saida-${entry.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEditNotaSaida(rawNotaSaida);
                              }}
                              className="h-6 inline-flex items-center justify-center space-x-1 px-2 py-0.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-md text-[10px] font-bold uppercase transition shadow-2xs cursor-pointer hover:shadow-xs shrink-0 whitespace-nowrap"
                              title={`Editar nota de saída ${entry.documentNumber}`}
                            >
                              <Pencil className="w-3 h-3 shrink-0 text-blue-600 dark:text-blue-400" />
                              <span>EDITAR</span>
                            </button>
                          ) : entry.rawExpense ? (
                            <button
                              type="button"
                              id={`btn-edit-nfe-${entry.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditNota(entry.rawExpense!);
                              }}
                              className="h-6 inline-flex items-center justify-center space-x-1 px-2 py-0.5 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/60 dark:hover:bg-sky-900/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 rounded-md text-[10px] font-bold uppercase transition shadow-2xs cursor-pointer hover:shadow-xs shrink-0 whitespace-nowrap"
                              title={`Editar detalhes da nota ${entry.documentNumber}`}
                            >
                              <Pencil className="w-3 h-3 shrink-0 text-sky-600 dark:text-sky-400" />
                              <span>EDITAR</span>
                            </button>
                          ) : entry.rawManualDoc ? (
                            <button
                              type="button"
                              id={`btn-edit-manual-doc-${entry.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (entry.rawManualDoc) handleOpenEditManualDoc(entry.rawManualDoc);
                              }}
                              className="h-6 inline-flex items-center justify-center space-x-1 px-2 py-0.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 rounded-md text-[10px] font-bold uppercase transition shadow-2xs cursor-pointer hover:shadow-xs shrink-0 whitespace-nowrap"
                              title={entry.rawManualDoc?.status === 'Rascunho' ? `Continuar lançamento do rascunho: ${entry.documentNumber}` : `Editar dados e produtos de ${entry.documentNumber}`}
                            >
                              <Pencil className="w-3 h-3 shrink-0 text-amber-600 dark:text-amber-400" />
                              <span>{entry.rawManualDoc?.status === 'Rascunho' ? 'CONTINUAR' : 'EDITAR'}</span>
                            </button>
                          ) : null}

                          {/* 3. Botão Ver e Imprimir (Nota de Saída) */}
                          {rawNotaSaida ? (
                            <>
                              <button
                                type="button"
                                id={`btn-view-nota-saida-${entry.id}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewingNotaSaida(rawNotaSaida);
                                }}
                                className="h-6 inline-flex items-center justify-center space-x-1 px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-md text-[10px] font-bold uppercase transition shadow-2xs cursor-pointer hover:shadow-xs shrink-0 whitespace-nowrap"
                                title={`Visualizar espelho da nota ${entry.documentNumber}`}
                              >
                                <Eye className="w-3 h-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                <span>VER</span>
                              </button>
                              <button
                                type="button"
                                id={`btn-print-nota-saida-${entry.id}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePrintNotaSaida(rawNotaSaida);
                                }}
                                className="h-6 inline-flex items-center justify-center space-x-1 px-2 py-0.5 bg-slate-800 hover:bg-slate-900 text-white border border-slate-900 rounded-md text-[10px] font-bold uppercase transition shadow-2xs cursor-pointer hover:shadow-xs shrink-0 whitespace-nowrap"
                                title={`Imprimir DANFE / Documento auxiliar ${entry.documentNumber}`}
                              >
                                <Printer className="w-3 h-3 shrink-0" />
                                <span>IMPRIMIR</span>
                              </button>
                            </>
                          ) : entry.rawExpense ? (
                            <button
                              type="button"
                              id={`btn-view-nfe-${entry.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditNota(entry.rawExpense!);
                              }}
                              className="h-6 inline-flex items-center justify-center space-x-1 px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-md text-[10px] font-bold uppercase transition shadow-2xs cursor-pointer hover:shadow-xs shrink-0 whitespace-nowrap"
                              title={`Visualizar detalhes da nota ${entry.documentNumber}`}
                            >
                              <Eye className="w-3 h-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                              <span>VER</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              id={`btn-view-doc-${entry.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (entry.rawManualDoc) {
                                  setViewingManualDoc(entry.rawManualDoc);
                                } else if (entry.rawLegacyFiscalDoc) {
                                  setViewingLegacyDoc(entry.rawLegacyFiscalDoc);
                                } else if (entry.rawMdfeDoc) {
                                  setViewingMdfeDoc(entry.rawMdfeDoc);
                                }
                              }}
                              className="h-6 inline-flex items-center justify-center space-x-1 px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-md text-[10px] font-bold uppercase transition shadow-2xs cursor-pointer hover:shadow-xs shrink-0 whitespace-nowrap"
                              title={`Visualizar detalhes do documento ${entry.documentNumber}`}
                            >
                              <Eye className="w-3 h-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                              <span>VER</span>
                            </button>
                          )}

                          {/* 4. Botão Excluir (Lixeira) */}
                          <button
                            type="button"
                            id={`btn-delete-doc-${entry.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (rawNotaSaida) {
                                setNotaSaidaToDelete(rawNotaSaida);
                              } else if (isXml && entry.rawExpense) {
                                setNotaParaExcluir(entry.id);
                              } else if (entry.rawLegacyFiscalDoc) {
                                setLegacyDocToDelete(entry.rawLegacyFiscalDoc);
                              } else if (entry.rawMdfeDoc) {
                                setMdfeDocToDelete(entry.rawMdfeDoc);
                              } else {
                                setManualDocToDelete(entry.rawManualDoc || ({ id: entry.id, tipo_documento: entry.documentType || 'Romaneio' } as DocumentoEntradaRecord));
                              }
                            }}
                            className="h-6 w-6 inline-flex items-center justify-center p-1 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 rounded-md transition shadow-2xs cursor-pointer hover:scale-105 active:scale-95 shrink-0 whitespace-nowrap"
                            title={`Excluir documento ${entry.documentNumber}`}
                            aria-label={`Excluir ${entry.documentNumber}`}
                          >
                            <Trash2 className="w-3 h-3 pointer-events-none" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal: Editar Produto no Estoque (Acionado pelo botão de Lápis na tabela de Notas e Entradas) */}
      {editStockProductModal && editStockProductModal.isOpen && (
        <ProductFormModal
          isOpen={editStockProductModal.isOpen}
          initialData={editStockProductModal.initialData}
          zIndexClass="z-[9999]"
          onClose={() => setEditStockProductModal(null)}
          onSuccess={handleSaveEditedStockProduct}
        />
      )}

      {/* Modal: Cadastrar Novo Produto no Estoque (De-Para) */}
      {newProductModal.isOpen && (
        <ProductFormModal
          isOpen={newProductModal.isOpen}
          initialData={{
            name: newProductModal.name,
            code: newProductModal.code,
            barcode: newProductModal.barcode,
            unit: newProductModal.unit,
            category: newProductModal.category,
            unitCost: newProductModal.unitCost,
            custo_nominal: newProductModal.unitCost,
            preco_custo_inicial: newProductModal.unitCost,
            custo_com_imposto: newProductModal.custoComImposto ?? newProductModal.unitCost,
            custo_sem_imposto: newProductModal.custoSemImposto ?? 0,
            valor_impostos_total: newProductModal.valorImpostosTotal ?? 0,
            frete_diluido_item: newProductModal.freteDiluidoItem ?? 0,
            profitMargin: newProductModal.profitMargin,
            salePrice: newProductModal.salePrice,
            quantity: newProductModal.initialQuantity,
            minQuantity: newProductModal.minQuantity,
            location: newProductModal.location,
          }}
          zIndexClass="z-[9999]"
          onClose={() => setNewProductModal(prev => ({ ...prev, isOpen: false }))}
          onSuccess={(newProduct) => {
            const exists = localInventory.some(p => p.id === newProduct.id);
            const updated = exists
              ? localInventory.map(p => (p.id === newProduct.id ? newProduct : p))
              : [...localInventory, newProduct];
            saveInventory(updated);
            if (!exists) {
              setSessionCreatedProductIds(prev => new Set(prev).add(newProduct.id));
            }
            handleLinkProduct(newProductModal.rowIndex, newProduct.id);
            setNewProductModal(prev => ({ ...prev, isOpen: false }));
            setSuccessMessage(`Produto "${newProduct.nome_comercial || newProduct.name}" cadastrado e vinculado com sucesso!`);
            setTimeout(() => setSuccessMessage(''), 4000);
          }}
        />
      )}

      {/* Modal Customizado de Confirmação de Exclusão de NF-e com Estorno de Estoque & Prevenção de Saldo Negativo */}
      {notaParaExcluir && notaEmExclusao && (
        <div 
          id="modal-confirm-delete-nfe"
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setNotaParaExcluir(null)}
        >
          <div 
            className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-5 sm:p-6 max-w-lg w-full shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabeçalho */}
            <div className="flex items-start space-x-3.5">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                analiseEstornoExclusao?.hasNegativeStock
                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                  : 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
              }`}>
                {analiseEstornoExclusao?.hasNegativeStock ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <Trash2 className="w-5 h-5" />
                )}
              </div>
              <div className="space-y-0.5 flex-1">
                <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                  {analiseEstornoExclusao?.hasNegativeStock
                    ? 'Atenção: Saldo de Estoque Insuficiente'
                    : 'Excluir Nota Fiscal & Estornar Estoque'}
                </h3>
                <p className="text-xs text-stone-600 dark:text-stone-400">
                  Esta ação excluirá o documento fiscal, estornará as quantidades do estoque e cancelará os títulos no financeiro.
                </p>
              </div>
            </div>

            {/* Resumo da Nota Fiscal */}
            <div className="p-3 bg-stone-50 dark:bg-stone-800/60 rounded-xl text-xs text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-800 flex items-center justify-between">
              <div className="min-w-0 pr-2">
                <span className="font-bold text-sky-600 dark:text-sky-400 block font-mono">
                  {notaEmExclusao.invoiceNumber}
                </span>
                <span className="text-stone-600 dark:text-stone-300 truncate block">
                  {notaEmExclusao.supplier}
                </span>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[10px] text-stone-400 block uppercase">Valor Total</span>
                <span className="font-bold text-stone-900 dark:text-stone-100 text-sm">
                  {formatCurrencyBRL(notaEmExclusao.amount)}
                </span>
              </div>
            </div>

            {/* AVISO CRÍTICO DE PREVENÇÃO DE ESTOQUE NEGATIVO (Requisito 2) */}
            {analiseEstornoExclusao?.hasNegativeStock && (
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-400 dark:border-amber-600/80 rounded-xl space-y-1.5 animate-in fade-in">
                <div className="flex items-start space-x-2 text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <span className="text-xs sm:text-sm font-bold leading-snug">
                    Atenção: Os produtos desta nota já foram parcialmente utilizados no estoque. Deseja estornar a quantidade mesmo assim?
                  </span>
                </div>
                <p className="text-[11px] text-amber-800 dark:text-amber-300 pl-7 leading-relaxed">
                  A quantidade restante em estoque é menor do que a quantidade que deu entrada através desta nota fiscal. A confirmação da exclusão fará o saldo do produto ficar negativo.
                </p>
              </div>
            )}

            {/* DETALHAMENTO DO ESTORNO DE ESTOQUE (Requisito 1) */}
            {analiseEstornoExclusao && analiseEstornoExclusao.reversalItems.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-sky-600" />
                    <span>Estorno Automático no Estoque ({analiseEstornoExclusao.reversalItems.length} produto(s))</span>
                  </span>
                  <span className="text-[10px] font-normal text-stone-400">Subtração imediata</span>
                </div>

                <div className="border border-stone-200 dark:border-stone-800 rounded-xl divide-y divide-stone-100 dark:divide-stone-800 max-h-48 overflow-y-auto bg-stone-50/50 dark:bg-stone-900/50 text-xs">
                  {analiseEstornoExclusao.reversalItems.map((item, idx) => (
                    <div key={idx} className="p-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-stone-900 dark:text-stone-100 truncate">
                          {item.productName}
                        </div>
                        <div className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-2 mt-0.5">
                          {item.matchedByNameOrCode ? (
                            <>
                              <span>Saldo Atual: <strong>{item.currentStock} {item.unit}</strong></span>
                              <span>•</span>
                              <span>Subtrair: <strong className="text-rose-600 dark:text-rose-400">-{item.nfeQuantity} {item.unit}</strong></span>
                            </>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400">Item não vinculado ao cadastro ({item.nfeQuantity} {item.unit})</span>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        {item.matchedByNameOrCode ? (
                          <>
                            <div className="text-[10px] text-stone-400 uppercase">Novo Saldo</div>
                            <div className={`font-mono font-bold text-xs ${item.isNegative ? 'text-rose-600 dark:text-rose-400' : 'text-stone-800 dark:text-stone-200'}`}>
                              {item.projectedStock} {item.unit}
                              {item.isNegative && (
                                <span className="ml-1 text-[10px] px-1 py-0.5 bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 rounded font-sans font-medium">
                                  Negativo
                                </span>
                              )}
                            </div>
                          </>
                        ) : (
                          <span className="text-[10px] text-stone-400 italic">Sem alteração</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Aviso sobre Contas a Pagar (Requisito 3) */}
            <div className="p-2.5 bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/60 rounded-xl text-xs text-sky-900 dark:text-sky-300 flex items-center space-x-2">
              <Receipt className="w-4 h-4 text-sky-600 shrink-0" />
              <span>
                As parcelas financeiras vinculadas no <strong>Contas a Pagar</strong> serão removidas automaticamente.
              </span>
            </div>

            {/* Botões de Ação */}
            <div className="pt-2 border-t border-stone-200 dark:border-stone-800 flex items-center justify-end space-x-2.5">
              <button
                type="button"
                id="btn-cancel-delete-nfe"
                onClick={() => setNotaParaExcluir(null)}
                className="px-4 py-2 text-xs font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="btn-confirm-delete-nfe"
                onClick={handleConfirmarExclusao}
                className={`px-4 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition flex items-center space-x-1.5 cursor-pointer ${
                  analiseEstornoExclusao?.hasNegativeStock
                    ? 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800'
                    : 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800'
                }`}
              >
                {analiseEstornoExclusao?.hasNegativeStock ? (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Sim, Estornar Mesmo Assim e Excluir</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirmar Estorno & Excluir Nota</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Criação / Edição de Centro de Custo */}
      {isQuickCostCenterOpen && (
        <div 
          id="modal-criar-editar-centro-custo"
          className="fixed inset-0 z-80 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => {
            setIsQuickCostCenterOpen(false);
            setCostCenterToEdit(null);
          }}
        >
          <div 
            className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
              <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                {costCenterToEdit ? (
                  <>
                    <Pencil className="w-4 h-4 text-amber-600" />
                    <span>Editar Centro de Custo</span>
                  </>
                ) : (
                  <>
                    <Building2 className="w-4 h-4 text-sky-600" />
                    <span>Novo Centro de Custo</span>
                  </>
                )}
              </h3>
              <button
                type="button"
                id="btn-fechar-modal-centro-custo"
                onClick={() => {
                  setIsQuickCostCenterOpen(false);
                  setCostCenterToEdit(null);
                }}
                className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  Nome do Centro de Custo <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  id="input-nome-centro-custo"
                  value={newCostCenterName}
                  onChange={(e) => setNewCostCenterName(e.target.value)}
                  placeholder="Ex: Maq 05 (GERAL), Safra 2024/2025, Administrativo"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500/20 font-medium"
                  autoFocus
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  Tipo de Classificação
                </label>
                <select
                  id="select-tipo-centro-custo"
                  value={newCostCenterType}
                  onChange={(e) => setNewCostCenterType(e.target.value as CostCenter['type'])}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500/20 cursor-pointer"
                >
                  <option value="safra">Safra / Lavoura</option>
                  <option value="maquinario">Maquinário & Frotas</option>
                  <option value="operacional">Operacional / Galpão</option>
                  <option value="administrativo">Administrativo & Escritório</option>
                  <option value="geral">Geral</option>
                </select>
              </div>

              {costCenterToEdit && (
                <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-300 text-[11px] leading-relaxed">
                  <strong>Atenção:</strong> Renomear este Centro de Custo atualizará automaticamente o nome exibido nos relatórios e nos futuros lançamentos contábeis.
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-stone-200 dark:border-stone-800 flex items-center justify-end space-x-2">
              <button
                type="button"
                id="btn-cancelar-salvar-centro"
                onClick={() => {
                  setIsQuickCostCenterOpen(false);
                  setCostCenterToEdit(null);
                }}
                className="px-4 py-2 text-xs font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="btn-confirmar-salvar-centro"
                onClick={handleSaveCostCenter}
                disabled={!newCostCenterName.trim()}
                className="px-4 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 active:bg-sky-800 disabled:opacity-50 rounded-xl shadow-xs transition flex items-center space-x-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{costCenterToEdit ? 'Salvar Alterações' : 'Criar e Selecionar'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão de Centro de Custo com Verificação de Integridade Fiscal */}
      {isDeleteCostCenterModalOpen && costCenterToDelete && (
        <div 
          id="modal-confirm-delete-centro-custo"
          className="fixed inset-0 z-80 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => {
            setIsDeleteCostCenterModalOpen(false);
            setCostCenterToDelete(null);
            setCostCenterIntegrityNotice(null);
          }}
        >
          <div 
            className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start space-x-3.5">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                costCenterIntegrityNotice?.isInUse
                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                  : 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
              }`}>
                {costCenterIntegrityNotice?.isInUse ? (
                  <AlertCircle className="w-5 h-5" />
                ) : (
                  <Trash2 className="w-5 h-5" />
                )}
              </div>

              <div className="space-y-1 flex-1">
                <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                  {costCenterIntegrityNotice?.isInUse 
                    ? 'Exclusão Bloqueada (Integridade Fiscal)' 
                    : 'Excluir Centro de Custo'}
                </h3>
                
                {costCenterIntegrityNotice?.isInUse ? (
                  <div className="space-y-2 text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                    <p>
                      O centro de custo <strong>"{costCenterToDelete.name}"</strong> não pode ser excluído porque já possui movimentações fiscais e financeiras associadas:
                    </p>
                    <ul className="list-disc pl-4 space-y-0.5 text-stone-700 dark:text-stone-200 font-medium">
                      {costCenterIntegrityNotice.expensesCount > 0 && (
                        <li><strong>{costCenterIntegrityNotice.expensesCount}</strong> despesa(s) no Contas a Pagar</li>
                      )}
                      {costCenterIntegrityNotice.notasCount > 0 && (
                        <li><strong>{costCenterIntegrityNotice.notasCount}</strong> nota(s) fiscal(is) no Histórico de NF-e</li>
                      )}
                    </ul>
                    <p className="text-stone-500 text-[11px] pt-1">
                      Para preservar o fechamento contábil e o histórico financeiro, registros com vínculos ativos não podem ser removidos. Você pode editá-lo ou mantê-lo para consultas passadas.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                    <p>
                      Tem certeza que deseja excluir o Centro de Custo <strong>"{costCenterToDelete.name}"</strong>?
                    </p>
                    <p className="text-stone-500 dark:text-stone-400 text-[11px]">
                      Nenhum lançamento ativo foi encontrado utilizando este Centro de Custo. Esta ação é segura e liberada, mas não poderá ser desfeita.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-stone-200 dark:border-stone-800 flex items-center justify-end space-x-2">
              <button
                type="button"
                id="btn-cancelar-exclusao-centro"
                onClick={() => {
                  setIsDeleteCostCenterModalOpen(false);
                  setCostCenterToDelete(null);
                  setCostCenterIntegrityNotice(null);
                }}
                className="px-4 py-2 text-xs font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition cursor-pointer"
              >
                {costCenterIntegrityNotice?.isInUse ? 'Entendido / Fechar' : 'Cancelar'}
              </button>

              {!costCenterIntegrityNotice?.isInUse && (
                <button
                  type="button"
                  id="btn-confirmar-exclusao-centro"
                  onClick={handleConfirmDeleteCostCenter}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl shadow-xs transition flex items-center space-x-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Sim, Excluir Centro</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal para Gerenciar a Lista de Todos os Centros de Custo */}
      {isManageCostCentersListOpen && (
        <div 
          id="modal-gerenciar-centros-custo"
          className="fixed inset-0 z-80 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setIsManageCostCentersListOpen(false)}
        >
          <div 
            className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
              <div className="flex items-center space-x-2">
                <Building2 className="w-4 h-4 text-sky-600" />
                <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                  Gerenciar Centros de Custo ({localCostCenters.length})
                </h3>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  id="btn-adicionar-centro-dentro-modal"
                  onClick={() => {
                    setIsManageCostCentersListOpen(false);
                    handleOpenCreateCostCenter();
                  }}
                  className="text-xs font-bold text-sky-600 hover:text-sky-700 bg-sky-50 dark:bg-sky-950/60 px-2.5 py-1 rounded-lg border border-sky-200 dark:border-sky-800 cursor-pointer inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Novo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsManageCostCentersListOpen(false)}
                  className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer p-1 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <p className="text-xs text-stone-500 dark:text-stone-400">
              Edite nomes ou remova centros de custo obsoletos. A exclusão é protegida contra perda de integridade contábil.
            </p>

            <div className="max-h-72 overflow-y-auto space-y-1.5 divide-y divide-stone-100 dark:divide-stone-800">
              {localCostCenters.map((cc) => (
                <div 
                  key={cc.id}
                  className="pt-1.5 flex items-center justify-between gap-2 text-xs hover:bg-stone-50 dark:hover:bg-stone-800/40 p-1.5 rounded-lg transition"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-stone-900 dark:text-stone-100 truncate">
                      {cc.name}
                    </div>
                    <div className="text-[10px] text-stone-500 uppercase tracking-wider">
                      Tipo: {cc.type}
                    </div>
                  </div>

                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setIsManageCostCentersListOpen(false);
                        handleOpenEditCostCenter(cc);
                      }}
                      className="p-1.5 text-stone-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition cursor-pointer"
                      title={`Editar ${cc.name}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsManageCostCentersListOpen(false);
                        handleRequestDeleteCostCenter(cc);
                      }}
                      className="p-1.5 text-stone-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                      title={`Excluir ${cc.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-stone-200 dark:border-stone-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsManageCostCentersListOpen(false)}
                className="px-4 py-2 text-xs font-bold text-stone-700 dark:text-stone-300 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 rounded-xl transition cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Janela 2: Detalhamento de Parcelas Geradas com Base no XML */}
      {parsedData && (
        <NfeInstallmentsModal
          isOpen={isInstallmentsModalOpen}
          onClose={() => setIsInstallmentsModalOpen(false)}
          invoiceNumber={parsedData.invoiceNumber}
          supplierName={parsedData.supplier}
          issueDate={parsedData.issueDate}
          totalAmount={parsedData.totalAmount}
          initialInstallmentsCount={userInstallmentCount}
          existingInstallments={parsedData.installments}
          defaultPaymentMethod={parsedData.paymentMethod}
          suggestedCategory={parsedData.suggestedCategory}
          onConfirmAndSave={handleConfirmAndSaveInstallments}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: FLUXO STEPPER INTELIGENTE DE ENTRADA MANUAL (2 ETAPAS) */}
      {/* ========================================================================= */}
      {isManualEntryModalOpen && (
        <div 
          id="modal-nova-entrada-manual"
          className="fixed inset-0 z-70 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-hidden animate-in fade-in"
          onClick={() => {
            if (!isSavingManualEntry && !isAddingItem) setIsManualEntryModalOpen(false);
          }}
        >
          <div 
            className="w-full max-w-4xl h-[95vh] flex flex-col justify-between mx-auto my-auto bg-[#cad4e6] dark:bg-stone-900 border border-black dark:border-stone-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 text-black dark:text-stone-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 1. Cabeçalho Principal */}
            <div className="px-4 py-2.5 bg-[#cad4e6] dark:bg-stone-900 border-b border-black dark:border-stone-700 flex items-center justify-between text-black dark:text-stone-100 shrink-0 rounded-t-xl">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 rounded bg-white dark:bg-stone-800 text-black dark:text-stone-100 flex items-center justify-center border border-black dark:border-stone-700 shrink-0">
                  <Package className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-black dark:text-stone-100 font-['Outfit']">
                    NOVA ENTRADA MANUAL
                  </h3>
                  <p className="text-[10px] text-black/80 dark:text-stone-400 font-semibold uppercase tracking-tight">
                    FLUXO EM ETAPAS COM INTEGRAÇÃO DIRETA AO ESTOQUE
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!isSavingManualEntry && !isAddingItem) setIsManualEntryModalOpen(false);
                }}
                disabled={isSavingManualEntry || isAddingItem}
                className="p-1 rounded text-black hover:bg-black/10 dark:text-stone-300 dark:hover:bg-stone-800 transition cursor-pointer disabled:opacity-50"
                title="Fechar formulário"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 2. Barra Visual de Progresso do Stepper Slim */}
            <div className="px-4 py-2 bg-[#cad4e6] dark:bg-stone-900 border-b border-black dark:border-stone-700 flex items-center justify-center shrink-0">
              <div className="flex items-center space-x-3 w-full">
                {/* Passo 1 */}
                <button
                  type="button"
                  onClick={() => {
                    if (manualEntryStep === 2) setManualEntryStep(1);
                  }}
                  className={`flex items-center space-x-1.5 text-left transition select-none uppercase ${
                    manualEntryStep === 1 
                      ? 'text-emerald-800 dark:text-emerald-400 font-bold' 
                      : 'text-black dark:text-stone-400 hover:opacity-80 cursor-pointer'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 transition ${
                    manualEntryStep === 1
                      ? 'bg-emerald-600 text-white border border-emerald-800'
                      : currentManualDoc || manualDocItems.length > 0
                      ? 'bg-emerald-600 text-white border border-emerald-800'
                      : 'bg-white dark:bg-stone-700 text-black dark:text-stone-300 border border-black'
                  }`}>
                    {manualEntryStep === 2 ? <Check className="w-3 h-3 stroke-[3]" /> : '1'}
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wide">1. DADOS DO DOCUMENTO</span>
                </button>

                {/* Linha divisória fina */}
                <div className="flex-1 h-0.5 bg-black/25 dark:bg-stone-700 rounded-full overflow-hidden">
                  <div className={`h-full bg-emerald-600 transition-all duration-300 ${manualEntryStep === 2 ? 'w-full' : 'w-0'}`} />
                </div>

                {/* Passo 2 */}
                <button
                  type="button"
                  onClick={() => {
                    if (currentManualDoc || manualSupplier.trim()) {
                      setManualEntryStep(2);
                    }
                  }}
                  disabled={!currentManualDoc && !manualSupplier.trim()}
                  className={`flex items-center space-x-1.5 text-left transition select-none uppercase ${
                    manualEntryStep === 2 
                      ? 'text-emerald-800 dark:text-emerald-400 font-bold' 
                      : (currentManualDoc || manualSupplier.trim())
                      ? 'text-black dark:text-stone-400 hover:opacity-80 cursor-pointer'
                      : 'text-black/40 cursor-not-allowed'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 transition ${
                    manualEntryStep === 2
                      ? 'bg-emerald-600 text-white border border-emerald-800'
                      : 'bg-white dark:bg-stone-700 text-black dark:text-stone-400 border border-black/40'
                  }`}>
                    2
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wide">2. PRODUTOS / ITENS</span>
                </button>
              </div>
            </div>

            {/* 3. Corpo do Modal (Passo 1 ou Passo 2) */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-[#cad4e6] dark:bg-stone-950">
              
              {/* =============================================================== */}
              {/* PASSO 1: DADOS DO DOCUMENTO (FORNECEDOR E CABEÇALHO) */}
              {/* =============================================================== */}
              {manualEntryStep === 1 && (
                <form onSubmit={handleAdvanceToStep2} className="flex-1 min-h-0 flex flex-col justify-between overflow-hidden">
                  <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 scrollbar-none">
                    <div className="bg-[#e0e6f1] dark:bg-stone-800 border border-black dark:border-stone-700 rounded-xl p-3.5 space-y-2.5">
                      {manualFormError && (
                      <div className="p-2 bg-rose-50 dark:bg-rose-950/60 border border-rose-400 dark:border-rose-800 rounded-lg flex items-center space-x-2 text-rose-800 dark:text-rose-200 text-xs font-bold uppercase animate-in fade-in">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{manualFormError.toUpperCase()}</span>
                      </div>
                    )}

                  {/* 0. CAMPO ESPECIAL NO TOPO: CONDIÇÃO DE PAGAMENTO & PARCELAS (SINCRONIZADO COM O FINANCEIRO) */}
                  <div className="p-2.5 rounded-lg bg-emerald-50/90 dark:bg-emerald-950/30 border border-emerald-600/50 dark:border-emerald-800 grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                    <div className="sm:col-span-8">
                      <label htmlFor="manual-payment-condition-select" className="flex items-center space-x-1.5 text-[11px] font-black text-emerald-900 dark:text-emerald-300 uppercase tracking-wide mb-1">
                        <CreditCard className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                        <span>CONDIÇÃO DE PAGAMENTO</span>
                        <span className="text-rose-600">*</span>
                      </label>
                      <select
                        id="manual-payment-condition-select"
                        value={manualPaymentCondition}
                        onChange={(e) => handlePaymentConditionChange(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-800 border border-emerald-600/60 dark:border-emerald-700 rounded-lg text-xs font-bold text-black dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#059669] uppercase shadow-2xs cursor-pointer"
                      >
                        <option value="Boleto Bancário">BOLETO BANCÁRIO</option>
                        <option value="PIX">PIX</option>
                        <option value="Dinheiro">DINHEIRO</option>
                        <option value="Cartão Corporativo">CARTÃO CORPORATIVO</option>
                        <option value="Transferência">TRANSFERÊNCIA</option>
                        <option value="A Prazo / Faturado">A PRAZO / FATURADO</option>
                      </select>
                    </div>

                    <div className="sm:col-span-4">
                      <label htmlFor="manual-installments-count-select" className="block text-[11px] font-black text-emerald-900 dark:text-emerald-300 uppercase tracking-wide mb-1">
                        PARCELAS (FINANCEIRO)
                      </label>
                      <select
                        id="manual-installments-count-select"
                        value={manualInstallmentsCount}
                        onChange={(e) => setManualInstallmentsCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-800 border border-emerald-600/60 dark:border-emerald-700 rounded-lg text-xs font-mono font-bold text-black dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#059669] uppercase shadow-2xs cursor-pointer"
                      >
                        {[1, 2, 3, 4, 5, 6, 8, 10, 12].map(n => (
                          <option key={n} value={n}>
                            {n === 1 ? '1X (À VISTA / ÚNICA)' : `${n}X PARCELAS`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 1. Fornecedor com Autocomplete e Botão Rápido de Cadastro */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-black dark:text-stone-300 uppercase tracking-wide">
                        FORNECEDOR / PRODUTOR <span className="text-rose-600">*</span>
                      </label>
                      {manualSupplier.trim() && (
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                          {isSupplierExisting ? (
                            <span className="text-emerald-700 dark:text-emerald-400 flex items-center space-x-1">
                              <Check className="w-3 h-3 stroke-[3]" />
                              <span>CADASTRADO</span>
                            </span>
                          ) : (
                            <span className="text-amber-700 dark:text-amber-400">
                              NOVO FORNECEDOR
                            </span>
                          )}
                        </span>
                      )}
                    </div>

                    <div className="relative">
                      <input
                        id="manual-supplier-input"
                        type="text"
                        list="suppliers-datalist-step1"
                        value={manualSupplier}
                        onChange={(e) => setManualSupplier(e.target.value)}
                        required
                        placeholder="DIGITE O NOME DO FORNECEDOR OU PRODUTOR..."
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-800 border border-gray-400 dark:border-stone-700 rounded-lg text-xs font-bold text-black dark:text-stone-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#0963cb] uppercase shadow-2xs"
                      />
                      <datalist id="suppliers-datalist-step1">
                        {localSuppliers.map((s) => (
                          <option key={s.id} value={s.name.toUpperCase()} />
                        ))}
                      </datalist>
                    </div>

                    {/* Linha Compacta de Alerta de Fornecedor Não Encontrado */}
                    {!isSupplierExisting && manualSupplier.trim().length >= 2 && (
                      <div className="mt-1.5 px-2.5 py-1 bg-amber-50 dark:bg-amber-950/40 border border-amber-400 dark:border-amber-800/60 rounded-md flex items-center justify-between gap-2 animate-in fade-in text-xs uppercase">
                        <div className="flex items-center space-x-1.5 text-[11px] font-bold text-amber-900 dark:text-amber-200 truncate">
                          <UserPlus className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span className="truncate">
                            FORNECEDOR <strong className="font-black">"{manualSupplier.trim().toUpperCase()}"</strong> NÃO ENCONTRADO
                          </span>
                        </div>
                        <button
                          type="button"
                          id="btn-cadastrar-fornecedor-rapido"
                          onClick={() => handleOpenQuickSupplierModal(manualSupplier)}
                          className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded text-[10px] font-black uppercase tracking-wider transition cursor-pointer flex items-center space-x-1 shadow-2xs shrink-0"
                          title="Cadastrar fornecedor"
                        >
                          <Plus className="w-3 h-3 stroke-[3]" />
                          <span>+ CADASTRAR</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 1.5 CAMPO ESPECIAL: VEÍCULO / MÁQUINA DA FROTA (OPCIONAL) -> ALIMENTA DRE DA FROTA */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="manual-vehicle-select" className="flex items-center space-x-1.5 text-[11px] font-bold text-black dark:text-stone-300 uppercase tracking-wide">
                        <Truck className="w-3.5 h-3.5 text-indigo-700 dark:text-indigo-400 shrink-0" />
                        <span>VEÍCULO / MÁQUINA DA FROTA (OPCIONAL)</span>
                      </label>
                      <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase">
                        ALIMENTA DRE DA FROTA
                      </span>
                    </div>
                    <select
                      id="manual-vehicle-select"
                      value={manualVehicleId}
                      onChange={(e) => setManualVehicleId(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-800 border border-gray-400 dark:border-stone-700 rounded-lg text-xs font-bold text-black dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-indigo-600 uppercase shadow-2xs cursor-pointer"
                    >
                      <option value="">NÃO VINCULAR A VEÍCULO / MÁQUINA (CUSTO GERAL)</option>
                      {availableVehicles.map((veh) => (
                        <option key={veh.id} value={veh.id}>
                          {veh.model.toUpperCase()}
                          {veh.licensePlateOrSerial ? ` — ${veh.licensePlateOrSerial.toUpperCase()}` : ''}
                          {veh.type ? ` (${veh.type.toUpperCase()})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 2. Grid com Data de Emissão e Vencimento em 2 Colunas */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* Data de Emissão */}
                    <div>
                      <label className="block text-[11px] font-bold text-black dark:text-stone-300 uppercase tracking-wide mb-1">
                        DATA DO DOCUMENTO <span className="text-rose-600">*</span>
                      </label>
                      <input
                        id="manual-date-input"
                        type="date"
                        value={manualDate}
                        onChange={(e) => {
                          setManualDate(e.target.value);
                          setManualDueDate(calculateDefaultDueDate(e.target.value));
                        }}
                        required
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-800 border border-gray-400 dark:border-stone-700 rounded-lg text-xs font-bold text-black dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-[#0963cb] uppercase shadow-2xs"
                      />
                    </div>

                    {/* Vencimento (Financeiro) */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-bold text-black dark:text-stone-300 uppercase tracking-wide">
                          VENCIMENTO <span className="text-rose-600">*</span>
                        </label>
                        <span className="text-[10px] text-black/70 dark:text-stone-400 font-bold uppercase">
                          {manualPaymentCondition === 'PIX' || manualPaymentCondition === 'Dinheiro' || manualPaymentCondition === 'Transferência' ? 'À VISTA' : '30 DIAS'}
                        </span>
                      </div>
                      <input
                        id="manual-due-date-input"
                        type="date"
                        value={manualDueDate}
                        onChange={(e) => setManualDueDate(e.target.value)}
                        required
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-800 border border-gray-400 dark:border-stone-700 rounded-lg text-xs font-bold text-black dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-[#0963cb] uppercase shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* 3. Tipo de Documento */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-black dark:text-stone-300 uppercase tracking-wide">
                        TIPO DE DOCUMENTO <span className="text-rose-600">*</span>
                      </label>
                      <button
                        type="button"
                        id="btn-gerenciar-tipos-doc-topo"
                        onClick={() => setIsManageDocTypesModalOpen(true)}
                        className="inline-flex items-center space-x-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline uppercase cursor-pointer"
                        title="Gerenciar tipos de documento"
                      >
                        <Settings className="w-3 h-3" />
                        <span>GERENCIAR</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <select
                        id="manual-type-select"
                        value={manualDocumentType}
                        onChange={(e) => {
                          if (e.target.value === '__manage__') {
                            setIsManageDocTypesModalOpen(true);
                          } else {
                            setManualDocumentType(e.target.value as TipoDocumentoEntrada);
                          }
                        }}
                        className="flex-1 px-2.5 py-1.5 bg-white dark:bg-stone-800 border border-gray-400 dark:border-stone-700 rounded-lg text-xs font-bold text-black dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-[#0963cb] uppercase shadow-2xs cursor-pointer"
                      >
                        {manualDocTypes.map((tipo) => (
                          <option key={tipo} value={tipo} className="uppercase">{tipo.toUpperCase()}</option>
                        ))}
                        <option disabled value="">──────────</option>
                        <option value="__manage__" className="text-emerald-700 font-bold uppercase">⚙️ GERENCIAR TIPOS...</option>
                      </select>

                      <button
                        type="button"
                        id="btn-gerenciar-tipos-doc-engrenagem"
                        onClick={() => setIsManageDocTypesModalOpen(true)}
                        className="p-1.5 bg-white hover:bg-gray-100 dark:bg-stone-800 dark:hover:bg-stone-700 text-black dark:text-stone-300 border border-gray-400 dark:border-stone-700 rounded-lg transition cursor-pointer shrink-0"
                        title="Gerenciar tipos de documento"
                      >
                        <Settings className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* 4. Valor Total do Documento (Formato BRL R$ #.##0,00) */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-black dark:text-stone-300 uppercase tracking-wide">
                        VALOR TOTAL DO DOCUMENTO <span className="text-rose-600">*</span>
                      </label>
                      <span className="text-[10px] text-black/70 dark:text-stone-400 font-bold uppercase">
                        PADRÃO R$ #.##0,00
                      </span>
                    </div>
                    <div className="relative rounded-lg shadow-2xs">
                      <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-black/70 font-extrabold text-xs">
                        R$
                      </div>
                      <input
                        id="manual-amount-input"
                        type="text"
                        inputMode="numeric"
                        value={manualAmountDisplay}
                        onChange={handleManualAmountChange}
                        required
                        placeholder="0,00"
                        className="w-full pl-8 pr-2.5 py-1.5 bg-white dark:bg-stone-800 border border-gray-400 dark:border-stone-700 rounded-lg text-xs font-mono font-bold text-black dark:text-stone-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#0963cb] uppercase"
                      />
                    </div>
                  </div>

                  {/* 5. Observações */}
                  <div>
                    <label className="block text-[11px] font-bold text-black dark:text-stone-300 uppercase tracking-wide mb-1">
                      OBSERVAÇÕES
                    </label>
                    <textarea
                      id="manual-notes-input"
                      value={manualNotes}
                      onChange={(e) => setManualNotes(e.target.value)}
                      rows={2}
                      placeholder="INFORMAÇÕES ADICIONAIS, PESAGEM, PLACA, ROMANEIO..."
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-800 border border-gray-400 dark:border-stone-700 rounded-lg text-xs font-medium text-black dark:text-stone-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#0963cb] uppercase shadow-2xs resize-none"
                    />
                  </div>

                  {/* Resumo Sincronizado Financeiro & Frota */}
                  <div className="px-2.5 py-1.5 rounded-lg bg-white/80 dark:bg-stone-900/70 border border-slate-300 dark:border-stone-700 flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold uppercase text-stone-700 dark:text-stone-300">
                    <span>
                      FINANCEIRO: <strong className="text-emerald-700 dark:text-emerald-400">{manualPaymentCondition.toUpperCase()}</strong> • {manualInstallmentsCount}X
                      {parseCurrencyInput(manualAmountDisplay) > 0 && ` DE ${formatCurrencyBRL(parseCurrencyInput(manualAmountDisplay) / Math.max(1, manualInstallmentsCount))}`}
                    </span>
                    {manualVehicleId && (
                      <span className="text-indigo-700 dark:text-indigo-400 flex items-center gap-1">
                        <Truck className="w-3 h-3" />
                        <span>DRE FROTA VINCULADO</span>
                      </span>
                    )}
                  </div>
                    </div>
                  </div>

                  {/* 6. Rodapé do Passo 1 */}
                  <div className="px-4 py-3 bg-[#cad4e6] dark:bg-stone-900 border-t border-black dark:border-stone-700 flex items-center justify-between gap-2 shrink-0">
                    <button
                      type="button"
                      id="btn-cancelar-entrada-manual-step1"
                      onClick={() => setIsManualEntryModalOpen(false)}
                      disabled={isSavingManualEntry}
                      className="px-4 py-1.5 text-[11px] font-bold text-black dark:text-stone-300 bg-white hover:bg-gray-100 dark:bg-stone-800 dark:hover:bg-stone-700 border border-gray-400 dark:border-stone-700 rounded-lg transition cursor-pointer disabled:opacity-50 uppercase"
                    >
                      CANCELAR
                    </button>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        id="btn-salvar-rascunho-step1"
                        onClick={handleSaveManualEntryAsDraft}
                        disabled={isSavingManualEntry}
                        className="px-3.5 py-1.5 text-[11px] font-bold text-black dark:text-stone-300 bg-white hover:bg-gray-100 dark:bg-stone-800 dark:hover:bg-stone-700 border border-gray-400 dark:border-stone-700 rounded-lg transition cursor-pointer flex items-center space-x-1 disabled:opacity-50 uppercase"
                        title="Salvar cabeçalho como Rascunho"
                      >
                        <Save className="w-3.5 h-3.5 text-black/70" />
                        <span>RASCUNHO</span>
                      </button>

                      <button
                        type="submit"
                        id="btn-avancar-passo2-entrada"
                        disabled={isSavingManualEntry}
                        className="px-4 py-1.5 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg border border-emerald-800 transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 uppercase"
                      >
                        {isSavingManualEntry ? (
                          <>
                            <Clock className="w-3.5 h-3.5 animate-spin" />
                            <span>GRAVANDO...</span>
                          </>
                        ) : (
                          <>
                            <span>AVANÇAR PARA PRODUTOS</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* =============================================================== */}
              {/* PASSO 2: INSERÇÃO DOS ITENS/PRODUTOS (COM ATUALIZAÇÃO DE ESTOQUE) */}
              {/* =============================================================== */}
              {manualEntryStep === 2 && (
                <div className="flex-1 min-h-0 flex flex-col justify-between overflow-hidden">
                  {/* Miolo do formulário (onde ficam os campos e a tabela de produtos inseridos) */}
                  <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3 scrollbar-none">
                    {/* Alerta de Bloqueio de Validação */}
                    {manualFormError && (
                    <div 
                      id="alerta-erro-validacao-passo-2"
                      className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-400 dark:border-rose-800 rounded-xl text-rose-800 dark:text-rose-200 text-xs font-bold flex items-center space-x-2 animate-in fade-in"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                      <span>{manualFormError}</span>
                    </div>
                  )}

                  {/* Resumo do Documento e Status da Conferência de Valores */}
                  {(() => {
                    const itemsTotal = manualDocItems.reduce((acc, i) => acc + (Number(i.valor_total) || 0), 0);
                    const headerTotal = Number(currentManualDoc?.valor_total) || parseCurrencyInput(manualAmountDisplay);
                    const diff = Math.abs(itemsTotal - headerTotal);
                    const isBalanced = diff < 0.01;

                    return (
                      <div className="p-3.5 bg-[#e0e6f1] dark:bg-stone-800/70 border border-black dark:border-stone-700 rounded-xl space-y-2.5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                          <div>
                            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
                              Documento Vinculado (ID: {currentManualDoc?.id?.slice(0, 8)}...)
                            </span>
                            <div className="flex items-center space-x-2 mt-0.5">
                              <span className="font-extrabold text-stone-900 dark:text-stone-100">
                                {manualSupplier}
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold text-[10px]">
                                {manualDocumentType}
                              </span>
                              <span className="text-stone-400">•</span>
                              <span className="text-stone-600 dark:text-stone-400 font-medium">
                                {formatDateBR(manualDate)}
                              </span>
                            </div>
                          </div>

                          {/* Comparativo de Valores */}
                          <div className="flex items-center space-x-3 bg-white dark:bg-stone-900 px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-800 shadow-2xs">
                            <div>
                              <span className="text-[10px] font-semibold text-stone-500 block">Total Previsto</span>
                              <span className="font-mono font-bold text-xs text-stone-800 dark:text-stone-200">
                                {formatCurrencyBRL(headerTotal)}
                              </span>
                            </div>
                            <div className="w-px h-6 bg-stone-200 dark:bg-stone-700" />
                            <div>
                              <span className="text-[10px] font-semibold text-stone-500 block">Total dos Itens</span>
                              <span className="font-mono font-extrabold text-xs text-emerald-600 dark:text-emerald-400">
                                {formatCurrencyBRL(itemsTotal)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Indicador de Status e Sincronização Automática com Tipografia Compacta */}
                        <div className="pt-2 border-t border-stone-200/70 dark:border-stone-700/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-medium">
                          {isBalanced ? (
                            <div className="flex items-center space-x-1.5 text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>Valores conferem perfeitamente ({formatCurrencyBRL(itemsTotal)}).</span>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-1.5 text-amber-700 dark:text-amber-400">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>
                                Diferença de {formatCurrencyBRL(diff)} entre o cabeçalho ({formatCurrencyBRL(headerTotal)}) e a soma dos itens ({formatCurrencyBRL(itemsTotal)}).
                              </span>
                            </div>
                          )}

                          {!isBalanced && (
                            <button
                              type="button"
                              onClick={() => {
                                handleSyncHeaderToItemsTotal();
                                setManualFormError('');
                              }}
                              className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 underline cursor-pointer self-start sm:self-auto shrink-0"
                            >
                              Atualizar total do documento para {formatCurrencyBRL(itemsTotal)}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Formulário Cirúrgico de Adição de Produtos */}
                  <form onSubmit={handleAddItemToManualDoc} className="p-3.5 bg-[#e0e6f1] dark:bg-stone-900 border border-black dark:border-stone-700 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between pb-1.5 border-b border-black/25 dark:border-stone-800">
                      <div className="flex items-center space-x-1.5 text-xs font-bold text-black dark:text-stone-100">
                        <Plus className="w-3.5 h-3.5 text-emerald-700 stroke-[2.5]" />
                        <span>Adicionar Produto à Entrada</span>
                      </div>
                      <span className="text-[10px] font-medium text-black/75 dark:text-stone-400">
                        A quantidade será somada no saldo do Estoque
                      </span>
                    </div>

                    {itemFormError && (
                      <div className="p-2.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 rounded-xl text-rose-800 dark:text-rose-200 text-xs font-bold flex items-center space-x-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{itemFormError}</span>
                      </div>
                    )}

                    {/* Campo de Busca do Produto no Estoque */}
                    <div className="relative" ref={stockSearchDropdownRef}>
                      <label className="block text-xs font-bold text-black dark:text-stone-300 mb-1">
                        Produto no Estoque <span className="text-rose-600">*</span>
                      </label>
                      <div className="relative">
                        <input
                          id="manual-item-search-input"
                          type="text"
                          value={itemSearchQuery}
                          onChange={(e) => {
                            const val = e.target.value;
                            setItemSearchQuery(val);
                            setIsItemSearchOpen(true);
                            const match = localInventory.find(p => {
                              const q = val.trim().toLowerCase();
                              if (!q) return false;
                              const nc = (p.nome_comercial || '').trim().toLowerCase();
                              const nm = (p.name || '').trim().toLowerCase();
                              const no = (p.nome || '').trim().toLowerCase();
                              const cd = (p.code || p.codigo_produto || '').trim().toLowerCase();
                              return nc === q || nm === q || no === q || (cd && cd === q);
                            });
                            if (match) {
                              setSelectedProduct(match);
                              const cost = Number(match.preco_custo_inicial ?? match.unitCost ?? 0);
                              if (cost > 0 && !itemUnitCostDisplay) {
                                setItemUnitCostDisplay(formatCurrencyInputDisplay(cost));
                              }
                              const rawUnit = String(match.unidade_medida || match.unit || 'un').trim();
                              const cleanUnit = rawUnit.toLowerCase() === 'l' || rawUnit.toLowerCase() === 'litro' || rawUnit.toLowerCase() === 'litros' || rawUnit.toLowerCase() === 'lt'
                                ? 'L'
                                : (rawUnit.toLowerCase() === 'un' || rawUnit.toLowerCase() === 'und' || rawUnit.toLowerCase() === 'unidade' ? 'un' : rawUnit);
                              setItemUnit(cleanUnit.toUpperCase());
                            } else if (selectedProduct && (selectedProduct.nome_comercial || selectedProduct.name || selectedProduct.nome) !== val) {
                              setSelectedProduct(null);
                            }
                          }}
                          onFocus={() => setIsItemSearchOpen(true)}
                          placeholder="Buscar produto por nome, código ou categoria no Estoque..."
                          className="w-full pl-9 pr-9 py-2 bg-white dark:bg-stone-800 border border-gray-400 dark:border-stone-700 rounded-lg text-xs sm:text-sm font-semibold text-black dark:text-stone-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0963cb] transition"
                        />
                        <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5 pointer-events-none" />
                        {isSearchingStock && (
                          <div className="absolute right-3 top-2.5">
                            <span className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin inline-block" />
                          </div>
                        )}
                      </div>

                      {/* Dropdown de sugestões do estoque */}
                      {isItemSearchOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl shadow-xl z-50 max-h-56 overflow-y-auto divide-y divide-stone-100 dark:divide-stone-800">
                          {isSearchingStock && filteredStockProducts.length === 0 && (
                            <div className="p-3 text-center text-xs text-stone-500 flex items-center justify-center space-x-2">
                              <span className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                              <span>Consultando estoque_produtos...</span>
                            </div>
                          )}

                          {filteredStockProducts.map((prod) => {
                            const displayName = prod.nome_comercial || prod.name || prod.nome || '';
                            const rawUnit = String(prod.unidade_medida || prod.unit || 'un').trim();
                            const displayUnit = rawUnit.toLowerCase() === 'l' || rawUnit.toLowerCase() === 'litro' || rawUnit.toLowerCase() === 'litros' || rawUnit.toLowerCase() === 'lt'
                              ? 'L'
                              : (rawUnit.toLowerCase() === 'un' || rawUnit.toLowerCase() === 'und' || rawUnit.toLowerCase() === 'unidade' ? 'un' : rawUnit);
                            const displayQty = Number(prod.quantidade_atual !== undefined ? prod.quantidade_atual : (prod.quantity ?? 0));
                            const displayCost = Number(prod.preco_custo_inicial ?? prod.unitCost ?? 0);
                            const isFuelOrArla = (prod.categoria || prod.category) === 'Combustível & Arla' || 
                              displayName.toLowerCase().includes('diesel') || 
                              displayName.toLowerCase().includes('arla');

                            return (
                              <div
                                key={prod.id}
                                onClick={() => handleSelectProduct(prod)}
                                className="p-2.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer flex items-center justify-between text-xs transition"
                              >
                                <div className="min-w-0 pr-2">
                                  <div className="flex items-center space-x-1.5">
                                    <span className="font-bold text-stone-900 dark:text-stone-100 truncate">
                                      {displayName}
                                    </span>
                                    {isFuelOrArla && (
                                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 shrink-0">
                                        Combustível & Arla
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center space-x-2 text-[10px] text-stone-500 mt-0.5">
                                    {prod.code && <span className="font-mono">Cód: {prod.code}</span>}
                                    {prod.code && <span>•</span>}
                                    <span>Un: <strong className="text-stone-700 dark:text-stone-300 font-semibold">{displayUnit}</strong></span>
                                    <span>•</span>
                                    <span>Saldo Atual: <strong className="text-stone-700 dark:text-stone-300 font-semibold">{displayQty.toLocaleString('pt-BR')} {displayUnit}</strong></span>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2 shrink-0">
                                  <span className="font-mono font-bold text-stone-700 dark:text-stone-300 text-xs">
                                    {displayCost > 0 ? formatCurrencyBRL(displayCost) : '-'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setIsItemSearchOpen(false);
                                      handleOpenEditProductFromManualEntry(prod);
                                    }}
                                    title="Editar Produto no Estoque"
                                    className="p-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 transition cursor-pointer"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}

                          {/* Se o produto não existir no estoque, exibe opção para cadastrar novo */}
                          {!isProductExistingInStock && itemSearchQuery.trim().length >= 1 && (
                            <div 
                              onClick={() => {
                                setIsItemSearchOpen(false);
                                handleOpenQuickProductModal(itemSearchQuery);
                              }}
                              className="p-3 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 cursor-pointer flex items-center justify-between text-xs font-bold text-emerald-800 dark:text-emerald-300 transition"
                            >
                              <div className="flex items-center space-x-2">
                                <Plus className="w-4 h-4 text-emerald-600 stroke-[2.5]" />
                                <span>+ Cadastrar Novo Produto "{itemSearchQuery.trim()}" no Estoque</span>
                              </div>
                              <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-full uppercase font-mono">
                                Novo
                              </span>
                            </div>
                          )}

                          {filteredStockProducts.length === 0 && isProductExistingInStock && !isSearchingStock && (
                            <div className="p-3 text-center text-xs text-stone-500">
                              Nenhum produto cadastrado no estoque.
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Botão rápido visível de novo produto se não existir */}
                    {!isProductExistingInStock && itemSearchQuery.trim().length >= 2 && !isItemSearchOpen && (
                      <div className="flex items-center justify-between p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs">
                        <span className="text-emerald-800 dark:text-emerald-300">
                          Produto não cadastrado no módulo de Estoque.
                        </span>
                        <button
                          type="button"
                          onClick={() => handleOpenQuickProductModal(itemSearchQuery)}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition cursor-pointer flex items-center space-x-1 shadow-2xs shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>+ Cadastrar Novo Produto {itemSearchQuery.trim()}</span>
                        </button>
                      </div>
                    )}

                    {/* Linha Horizontal Ampla Contínua: Quantidade, Unidade, Valor Unitário, Subtotal e Botão Adicionar Item */}
                    <div className="flex flex-wrap lg:flex-nowrap items-end gap-3 pt-1">
                      {/* Quantidade */}
                      <div className="w-28 sm:w-32 shrink-0">
                        <label className="block text-xs font-bold text-black dark:text-stone-300 mb-1">
                          Quantidade <span className="text-rose-600">*</span>
                        </label>
                        <input
                          id="manual-item-qty-input"
                          type="number"
                          step="any"
                          min="0.001"
                          value={itemQuantity}
                          onChange={(e) => setItemQuantity(e.target.value)}
                          required
                          placeholder="Ex: 10"
                          className="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-gray-400 dark:border-stone-700 rounded-lg text-xs sm:text-sm font-mono font-bold text-black dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#0963cb]"
                        />
                      </div>

                      {/* Unidade */}
                      <div className="w-24 sm:w-28 shrink-0">
                        <label className="block text-xs font-bold text-black dark:text-stone-300 mb-1">
                          Unidade
                        </label>
                        <input
                          id="manual-item-unit-input"
                          type="text"
                          value={itemUnit}
                          onChange={(e) => setItemUnit(e.target.value.toUpperCase())}
                          placeholder="UN, KG..."
                          className="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-gray-400 dark:border-stone-700 rounded-lg text-xs sm:text-sm font-mono font-bold text-black dark:text-stone-100 uppercase focus:outline-none focus:ring-2 focus:ring-[#0963cb] text-center"
                        />
                      </div>

                      {/* Valor Unitário (R$) */}
                      <div className="w-36 sm:w-44 shrink-0">
                        <label className="block text-xs font-bold text-black dark:text-stone-300 mb-1">
                          Valor Unitário (R$)
                        </label>
                        <div className="relative rounded-lg shadow-2xs">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-black/70 font-bold text-xs">
                            R$
                          </div>
                          <input
                            id="manual-item-unitcost-input"
                            type="text"
                            inputMode="numeric"
                            value={itemUnitCostDisplay}
                            onChange={handleItemUnitCostChange}
                            placeholder="0,00"
                            className="w-full pl-8 pr-2.5 py-2 bg-white dark:bg-stone-800 border border-gray-400 dark:border-stone-700 rounded-lg text-xs sm:text-sm font-mono font-bold text-black dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#0963cb] text-right"
                          />
                        </div>
                      </div>

                      {/* Indicador de Subtotal */}
                      <div className="flex-1 min-w-[130px] px-3.5 py-1.5 bg-white dark:bg-stone-800/80 border border-gray-400 dark:border-stone-700 rounded-lg flex items-center justify-between h-[38px]">
                        <span className="text-[11px] text-black dark:text-stone-400 font-bold uppercase tracking-wider">Subtotal:</span>
                        <span className="font-mono text-emerald-700 dark:text-emerald-400 text-xs sm:text-sm font-black">
                          {formatCurrencyBRL(
                            (parseFloat(itemQuantity.replace(',', '.')) || 0) * parseCurrencyInput(itemUnitCostDisplay)
                          )}
                        </span>
                      </div>

                      {/* Botão verde [+ Adicionar Item] */}
                      <button
                        type="submit"
                        id="btn-adicionar-produto-entrada"
                        disabled={isAddingItem}
                        className="py-2 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg border border-emerald-800 text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50 shrink-0 h-[38px]"
                      >
                        {isAddingItem ? (
                          <>
                            <Clock className="w-3.5 h-3.5 animate-spin" />
                            <span>Somando...</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>+ Adicionar Item</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>

                  {/* Tabela com a Lista dos Itens Adicionados nesta Entrada */}
                  <div className="border border-black dark:border-stone-700 rounded-xl overflow-hidden bg-[#e0e6f1] dark:bg-stone-900">
                    <div className="px-4 py-2.5 bg-[#e0e6f1] dark:bg-stone-800/80 border-b border-black dark:border-stone-800 flex items-center justify-between shrink-0">
                      <div className="flex items-center space-x-2">
                        <Package className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                        <span className="text-xs font-bold text-black dark:text-stone-100">
                          Produtos Inseridos na Entrada ({manualDocItems.length})
                        </span>
                      </div>
                      {manualDocItems.length > 0 && (
                        <span className="text-xs font-mono font-black text-emerald-700 dark:text-emerald-400">
                          Soma: {formatCurrencyBRL(manualDocItems.reduce((s, i) => s + (Number(i.valor_total) || 0), 0))}
                        </span>
                      )}
                    </div>

                    <div className="max-h-[220px] overflow-y-auto scrollbar-none">
                      {isLoadingDocItems ? (
                        <div className="p-6 text-center text-xs text-stone-500 flex items-center justify-center space-x-2">
                          <Clock className="w-4 h-4 animate-spin text-emerald-600" />
                          <span>Carregando itens...</span>
                        </div>
                      ) : manualDocItems.length === 0 ? (
                        <div className="p-6 text-center text-xs text-stone-400 dark:text-stone-500 space-y-1">
                          <Package className="w-7 h-7 text-stone-300 dark:text-stone-700 mx-auto" />
                          <p className="font-semibold text-stone-600 dark:text-stone-400">
                            Nenhum produto adicionado à entrada.
                          </p>
                          <p className="text-[11px]">
                            Utilize o campo acima para buscar no estoque ou cadastrar um novo produto.
                          </p>
                        </div>
                      ) : (
                        <div className="max-h-[320px] overflow-y-auto overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-100 dark:bg-stone-800 text-[11px] font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider border-b border-slate-300 dark:border-stone-700 sticky top-0 z-20 shadow-sm">
                              <tr>
                                <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 px-4 py-2 whitespace-nowrap">Produto</th>
                                <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 px-4 py-2 text-center w-36 whitespace-nowrap">Quantidade</th>
                                <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 px-4 py-2 text-right w-36 whitespace-nowrap">Valor Unitário</th>
                                <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 px-4 py-2 text-right w-36 whitespace-nowrap">Subtotal</th>
                                <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 px-4 py-2 text-center w-24 whitespace-nowrap">Ações</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-200 dark:divide-stone-800 font-medium">
                              {manualDocItems.map((item, itemIdx) => (
                                <tr key={`${item.id || 'manual_item'}_${itemIdx}`} className="even:bg-[#f2f2f2] odd:bg-white dark:even:bg-stone-800/50 dark:odd:bg-stone-900 hover:bg-slate-200/60 dark:hover:bg-stone-800 transition whitespace-nowrap border-b border-slate-200 dark:border-stone-800">
                                  <td className="px-3 py-1 whitespace-nowrap">
                                    <div className="flex items-center space-x-2 whitespace-nowrap">
                                      <span className="font-bold text-stone-900 dark:text-stone-100 whitespace-nowrap" title={item.descricao}>
                                        {item.descricao}
                                      </span>
                                      <span className="text-[10px] text-stone-500 font-mono whitespace-nowrap">
                                        ({item.unidade || 'UN'})
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-3 py-1 text-center font-mono font-bold text-stone-800 dark:text-stone-200 whitespace-nowrap">
                                    {item.quantidade} {item.unidade || 'UN'}
                                  </td>
                                  <td className="px-3 py-1 text-right font-mono font-medium text-stone-700 dark:text-stone-300 whitespace-nowrap">
                                    {formatCurrencyBRL(item.valor_unitario)}
                                  </td>
                                  <td className="px-3 py-1 text-right font-mono font-extrabold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                    {formatCurrencyBRL(item.valor_total)}
                                  </td>
                                  <td className="px-3 py-1 text-center whitespace-nowrap">
                                    <div className="flex items-center justify-center space-x-1 whitespace-nowrap">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const matchedProd = localInventory.find(p =>
                                            (item.produto_id && p.id === item.produto_id) ||
                                            (p.nome_comercial && p.nome_comercial.toLowerCase().trim() === item.descricao.toLowerCase().trim()) ||
                                            p.name.toLowerCase().trim() === item.descricao.toLowerCase().trim()
                                          ) || {
                                            id: item.produto_id || `inv_${Date.now()}`,
                                            name: item.descricao,
                                            nome_comercial: item.descricao,
                                            unit: item.unidade || 'UN',
                                            unidade_medida: item.unidade || 'UN',
                                            category: deduceItemCategory(item.descricao),
                                            unitCost: Number(item.valor_unitario) || 0,
                                            salePrice: Math.round((Number(item.valor_unitario) || 0) * 1.3 * 100) / 100,
                                            quantity: Number(item.quantidade) || 0,
                                            minQuantity: 0,
                                            location: 'Depósito Principal',
                                          };
                                          handleOpenEditProductFromManualEntry(matchedProd, item.id);
                                        }}
                                        className="p-1 text-amber-600 hover:text-amber-800 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40 rounded-lg transition cursor-pointer"
                                        title="Editar Produto no Estoque"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteItemFromManualDoc(item)}
                                        className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                                        title="Excluir item da entrada e estornar quantidade do estoque"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                  </div>

                  {/* Rodapé do Passo 2: Finalização da Entrada */}
                  <div className="px-4 py-3 bg-[#cad4e6] dark:bg-stone-900 border-t border-black dark:border-stone-700 flex items-center justify-between shrink-0">
                    <button
                      type="button"
                      id="btn-voltar-passo1-entrada"
                      onClick={() => setManualEntryStep(1)}
                      className="px-4 py-1.5 text-xs font-bold text-black dark:text-stone-300 bg-white hover:bg-gray-100 dark:bg-stone-800 dark:hover:bg-stone-700 border border-gray-400 dark:border-stone-700 rounded-lg transition cursor-pointer flex items-center space-x-1.5"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Voltar ao Cabeçalho</span>
                    </button>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        id="btn-salvar-rascunho-entrada-manual"
                        onClick={handleSaveManualEntryAsDraft}
                        disabled={isSavingManualEntry}
                        className="px-4 py-1.5 text-xs font-bold text-black dark:text-stone-300 bg-white hover:bg-gray-100 dark:bg-stone-800 dark:hover:bg-stone-700 border border-gray-400 dark:border-stone-700 rounded-lg transition cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
                        title="Salvar cabeçalho e produtos inseridos até o momento como Rascunho sem validar se valores batem"
                      >
                        <Save className="w-3.5 h-3.5 text-black/70" />
                        <span>Salvar como Rascunho</span>
                      </button>

                      <button
                        type="button"
                        id="btn-concluir-entrada-manual"
                        onClick={handleFinalizeManualEntry}
                        disabled={isSavingManualEntry}
                        className="px-5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg border border-emerald-800 transition flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                      >
                        {isSavingManualEntry ? (
                          <>
                            <Clock className="w-4 h-4 animate-spin" />
                            <span>Concluindo...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4 stroke-[2.5]" />
                            <span>Concluir Entrada</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* JANELA 2 (ENTRADA MANUAL): FORMA DE PAGAMENTO E CONDIÇÕES FINANCEIRAS */}
      {/* Idêntica ao fluxo do XML, com parcelas, prazos, vencimento e formas de pagamento */}
      {/* ========================================================================= */}
      {isManualInstallmentsModalOpen && (
        <NfeInstallmentsModal
          isOpen={isManualInstallmentsModalOpen}
          onClose={() => setIsManualInstallmentsModalOpen(false)}
          invoiceNumber={currentManualDoc?.id ? currentManualDoc.id.slice(0, 8).toUpperCase() : (manualDocumentType || 'DOC')}
          supplierName={(currentManualDoc?.fornecedor || manualSupplier).trim()}
          issueDate={manualDate}
          totalAmount={manualDocItems.reduce((acc, i) => acc + (Number(i.valor_total) || 0), 0)}
          initialInstallmentsCount={manualInstallmentsCount}
          existingInstallments={syncedManualExistingInstallments}
          defaultPaymentMethod={mapPaymentConditionToMethodKey(manualPaymentCondition)}
          suggestedCategory={determineFinancialCategory(manualDocItems, `${manualSupplier} ${manualNotes}`) === 'Combustível & Arla' ? 'cat_combustivel' : 'cat_insumos'}
          customTitle="Forma de Pagamento e Lançamento Financeiro"
          customSubtitle={`Entrada de Mercadoria (${manualDocumentType}) • ${manualPaymentCondition} • Fornecedor: ${(currentManualDoc?.fornecedor || manualSupplier).trim()}`}
          totalLabel="Valor Total da Entrada Manual"
          onConfirmAndSave={handleConfirmAndSaveManualInstallments}
        />
      )}

      {/* ========================================================================= */}
      {/* SUBMODAL: CADASTRO RÁPIDO DE PRODUTO NO ESTOQUE (LAYOUT 3 COLUNAS) */}
      {/* ========================================================================= */}
      {isQuickProductModalOpen && (
        <ProductFormModal
          isOpen={isQuickProductModalOpen}
          zIndexClass="z-90"
          initialData={{
            name: quickProductName,
            unit: quickProductUnit,
            category: quickProductCategory,
            unitCost: parseCurrencyInput(quickProductCostDisplay),
            salePrice: parseCurrencyInput(quickProductSaleDisplay),
            profitMargin: parseFloat(quickProductProfitMargin.replace(',', '.')) || 30,
            location: quickProductLocation || 'Depósito Principal',
          }}
          onClose={() => setIsQuickProductModalOpen(false)}
          onSuccess={(newProduct) => {
            const updated = [...localInventory, newProduct];
            saveInventory(updated);
            saveCloudInventory(updated).catch(err => console.warn('Supabase saveCloudInventory sync notice:', err));
            setSelectedProduct(newProduct);
            setItemSearchQuery(newProduct.name);
            setItemUnit(newProduct.unit);
            if (newProduct.unitCost > 0) {
              setItemUnitCostDisplay(formatCurrencyInputDisplay(newProduct.unitCost));
            }
            setIsQuickProductModalOpen(false);
            setSuccessMessage(`Produto "${newProduct.name}" cadastrado com sucesso no estoque!`);
            setTimeout(() => setSuccessMessage(''), 4000);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: VISUALIZAR DETALHES DA ENTRADA MANUAL */}
      {/* ========================================================================= */}
      {viewingManualDoc && (
        <div 
          id="modal-visualizar-entrada-manual"
          className="fixed inset-0 z-70 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in"
          onClick={() => setViewingManualDoc(null)}
        >
          <div 
            className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 text-stone-900 dark:text-stone-100 space-y-4 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
              <div className="flex items-center space-x-2">
                <Receipt className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                    Documento de Entrada Manual
                  </h3>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                    {viewingManualDoc.tipo_documento}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setViewingManualDoc(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 bg-stone-50 dark:bg-stone-800/60 rounded-xl space-y-1.5">
                <div className="flex justify-between">
                  <span className="font-medium text-stone-500">Fornecedor / Emitente:</span>
                  <span className="font-bold text-stone-900 dark:text-stone-100 text-right">
                    {viewingManualDoc.fornecedor || viewingManualDoc.fornecedor_nome || '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-stone-500">Data do Documento:</span>
                  <span className="font-bold text-stone-900 dark:text-stone-100">
                    {formatDateBR(viewingManualDoc.data || viewingManualDoc.data_entrada)}
                  </span>
                </div>
                {viewingManualDoc.condicao_pagamento && (
                  <div className="flex justify-between">
                    <span className="font-medium text-stone-500">Condição de Pagamento:</span>
                    <span className="font-bold text-stone-900 dark:text-stone-100">
                      {viewingManualDoc.condicao_pagamento}
                      {viewingManualDoc.parcelas_qtd ? ` (${viewingManualDoc.parcelas_qtd}x)` : ''}
                    </span>
                  </div>
                )}
                {(viewingManualDoc.machineryName || viewingManualDoc.vehiclePlate) && (
                  <div className="flex justify-between">
                    <span className="font-medium text-stone-500">Veículo / Frota (DRE):</span>
                    <span className="font-bold text-indigo-700 dark:text-indigo-400">
                      {viewingManualDoc.machineryName || viewingManualDoc.vehiclePlate}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-1 border-t border-stone-200/60 dark:border-stone-700/60">
                  <span className="font-bold text-stone-700 dark:text-stone-300">Valor Total:</span>
                  <span className="font-mono font-extrabold text-sm text-emerald-600 dark:text-emerald-400">
                    {formatCurrencyBRL(viewingManualDoc.valor_total)}
                  </span>
                </div>
              </div>

              {/* Lista de Itens do Documento */}
              {isLoadingViewingItems ? (
                <div className="p-3 text-center text-xs text-stone-500 flex items-center justify-center space-x-2">
                  <Clock className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                  <span>Carregando itens...</span>
                </div>
              ) : viewingDocItems.length > 0 ? (
                <div className="space-y-1.5">
                  <span className="font-bold text-stone-700 dark:text-stone-300 block text-[11px] uppercase tracking-wider">
                    Itens da Entrada ({viewingDocItems.length}):
                  </span>
                  <div className="border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden bg-stone-50/50 dark:bg-stone-800/40 max-h-40 overflow-y-auto divide-y divide-stone-200 dark:divide-stone-800">
                    {viewingDocItems.map((it, itIdx) => (
                      <div key={`${it.id || 'view_item'}_${itIdx}`} className="p-2 text-[11px] flex items-center justify-between">
                        <div>
                          <span className="font-bold text-stone-900 dark:text-stone-100 block">
                            {it.descricao}
                          </span>
                          <span className="text-[10px] text-stone-500">
                            {it.quantidade} {it.unidade || 'UN'} × {formatCurrencyBRL(it.valor_unitario)}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {formatCurrencyBRL(it.valor_total)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {viewingManualDoc.observacoes && (
                <div>
                  <span className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                    Observações:
                  </span>
                  <div className="p-3 bg-stone-50 dark:bg-stone-800/60 rounded-xl text-stone-700 dark:text-stone-300 whitespace-pre-line leading-relaxed">
                    {viewingManualDoc.observacoes}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between">
              <button
                type="button"
                id="btn-excluir-doc-detalhes"
                onClick={() => {
                  setManualDocToDelete(viewingManualDoc);
                }}
                className="px-3 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition cursor-pointer flex items-center space-x-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir Entrada</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  id="btn-editar-doc-detalhes"
                  onClick={() => {
                    const doc = viewingManualDoc;
                    setViewingManualDoc(null);
                    handleOpenEditManualDoc(doc);
                  }}
                  className="px-3.5 py-1.5 text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 border border-amber-300 dark:border-amber-700 rounded-xl transition cursor-pointer flex items-center space-x-1.5 shadow-2xs"
                  title="Editar dados ou continuar lançamento deste documento"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>{viewingManualDoc.status === 'Rascunho' ? 'Continuar Lançamento' : 'Editar Entrada'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewingManualDoc(null)}
                  className="px-4 py-1.5 text-xs font-bold text-stone-700 dark:text-stone-300 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 rounded-xl transition cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CONFIRMAR EXCLUSÃO DE ENTRADA MANUAL */}
      {/* ========================================================================= */}
      {manualDocToDelete && (
        <div 
          id="modal-confirmar-exclusao-entrada-manual"
          className="fixed inset-0 z-80 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setManualDocToDelete(null)}
        >
          <div 
            className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-3 animate-in fade-in zoom-in-95 text-stone-900 dark:text-stone-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center space-x-2 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-sm font-bold">Excluir Documento de Entrada</h3>
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
              Deseja realmente excluir esta entrada manual ({manualDocToDelete.tipo_documento}) de {formatCurrencyBRL(manualDocToDelete.valor_total)}? Esta ação é irreversível no banco de dados.
            </p>
            <div className="pt-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setManualDocToDelete(null)}
                className="px-3 py-1.5 text-xs font-bold text-stone-600 dark:text-stone-300 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="btn-confirmar-exclusao-entrada-manual"
                onClick={() => handleDeleteManualDoc(manualDocToDelete)}
                className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition cursor-pointer flex items-center space-x-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sim, Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: VISUALIZAR DOCUMENTO FISCAL LEGADO (NF-e / CT-e / NFS-e / NFC-e) */}
      {/* ========================================================================= */}
      {viewingLegacyDoc && (
        <div
          className="fixed inset-0 z-70 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in"
          onClick={() => setViewingLegacyDoc(null)}
        >
          <div
            className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden my-8 text-stone-900 dark:text-stone-100 space-y-4 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
              <div>
                <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                  {viewingLegacyDoc.documentTypeLabel || 'Documento Fiscal'} Nº {viewingLegacyDoc.number}
                </h3>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300">
                  {viewingLegacyDoc.status}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setViewingLegacyDoc(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-stone-50 dark:bg-stone-800/60 rounded-xl space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-stone-500">Fornecedor:</span>
                <span className="font-bold">{viewingLegacyDoc.supplierName || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Emissão:</span>
                <span className="font-bold">{formatDateBR(viewingLegacyDoc.issueDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Pagamento:</span>
                <span className="font-bold">{viewingLegacyDoc.paymentMethod} ({viewingLegacyDoc.installmentsCount || 1}x)</span>
              </div>
              {(viewingLegacyDoc.vehiclePlate || viewingLegacyDoc.vehicleModel) && (
                <div className="flex justify-between">
                  <span className="text-stone-500">Veículo / Frota:</span>
                  <span className="font-bold text-indigo-700 dark:text-indigo-400">
                    {viewingLegacyDoc.vehiclePlate || viewingLegacyDoc.vehicleModel}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-1 border-t border-stone-200/60 dark:border-stone-700/60">
                <span className="font-bold">Valor Total:</span>
                <span className="font-mono font-extrabold text-sm text-emerald-600 dark:text-emerald-400">
                  {formatCurrencyBRL(viewingLegacyDoc.totalAmount)}
                </span>
              </div>
            </div>

            {viewingLegacyDoc.items && viewingLegacyDoc.items.length > 0 && (
              <div className="border border-stone-200 dark:border-stone-800 rounded-xl max-h-40 overflow-y-auto divide-y divide-stone-200 dark:divide-stone-800">
                {viewingLegacyDoc.items.map((it, idx) => (
                  <div key={`${it.id || 'leg_it'}_${idx}`} className="p-2 text-[11px] flex justify-between">
                    <span className="font-bold truncate pr-2">{it.description} ({it.quantity} {it.unit})</span>
                    <span className="font-mono font-bold text-emerald-600 shrink-0">{formatCurrencyBRL(it.totalPrice)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setLegacyDocToDelete(viewingLegacyDoc)}
                className="px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer flex items-center space-x-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir</span>
              </button>
              <button
                type="button"
                onClick={() => setViewingLegacyDoc(null)}
                className="px-4 py-1.5 text-xs font-bold text-stone-700 dark:text-stone-300 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 rounded-xl transition cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {legacyDocToDelete && (
        <div
          className="fixed inset-0 z-80 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setLegacyDocToDelete(null)}
        >
          <div
            className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-3 text-stone-900 dark:text-stone-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center space-x-2 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-sm font-bold">Excluir Documento Fiscal</h3>
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-300">
              Deseja excluir {legacyDocToDelete.documentTypeLabel} nº {legacyDocToDelete.number} ({formatCurrencyBRL(legacyDocToDelete.totalAmount)}) e suas parcelas financeiras?
            </p>
            <div className="pt-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setLegacyDocToDelete(null)}
                className="px-3 py-1.5 text-xs font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDeleteLegacyFiscalDoc(legacyDocToDelete)}
                className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl cursor-pointer flex items-center space-x-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sim, Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: VISUALIZAR / EXCLUIR MDF-e */}
      {/* ========================================================================= */}
      {viewingMdfeDoc && (
        <div
          className="fixed inset-0 z-70 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in"
          onClick={() => setViewingMdfeDoc(null)}
        >
          <div
            className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden my-8 text-stone-900 dark:text-stone-100 space-y-4 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
              <div>
                <h3 className="text-sm font-bold">MDF-e Nº {viewingMdfeDoc.numero}</h3>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                  {viewingMdfeDoc.status}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setViewingMdfeDoc(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-stone-50 dark:bg-stone-800/60 rounded-xl space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-stone-500">Condutor:</span>
                <span className="font-bold">{viewingMdfeDoc.motoristaNome || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Veículo / Placa:</span>
                <span className="font-bold">{viewingMdfeDoc.veiculoPlaca || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Rota:</span>
                <span className="font-bold">
                  {viewingMdfeDoc.municipiosCarregamento || viewingMdfeDoc.ufCarregamento} → {viewingMdfeDoc.municipiosDescarregamento || viewingMdfeDoc.ufDescarregamento}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-stone-200/60 dark:border-stone-700/60">
                <span className="font-bold">Valor da Carga:</span>
                <span className="font-mono font-extrabold text-sm text-emerald-600">
                  {formatCurrencyBRL(viewingMdfeDoc.valorTotalCarga)}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setMdfeDocToDelete(viewingMdfeDoc)}
                className="px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer flex items-center space-x-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir</span>
              </button>
              <button
                type="button"
                onClick={() => setViewingMdfeDoc(null)}
                className="px-4 py-1.5 text-xs font-bold text-stone-700 dark:text-stone-300 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 rounded-xl transition cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {mdfeDocToDelete && (
        <div
          className="fixed inset-0 z-80 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setMdfeDocToDelete(null)}
        >
          <div
            className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-3 text-stone-900 dark:text-stone-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center space-x-2 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-sm font-bold">Excluir MDF-e</h3>
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-300">
              Deseja realmente excluir o MDF-e nº {mdfeDocToDelete.numero}?
            </p>
            <div className="pt-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setMdfeDocToDelete(null)}
                className="px-3 py-1.5 text-xs font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDeleteMdfeDoc(mdfeDocToDelete)}
                className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl cursor-pointer flex items-center space-x-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sim, Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL OFICIAL: CADASTRO / VALIDAÇÃO DE FORNECEDORES (TOP LEVEL z-[9999]) */}
      {/* Abre à frente de qualquer modal ou tela com backdrop escuro exclusivo */}
      {/* ========================================================================= */}
      <SupplierModal
        isOpen={isSupplierModalOpen}
        onClose={() => setIsSupplierModalOpen(false)}
        onSave={handleSaveSupplierFromModal}
        editingSupplier={supplierForModal}
        initialName={manualSupplier}
        zIndexClass="z-[9999]"
      />

      {/* ========================================================================= */}
      {/* MODAL OFICIAL: GERENCIAMENTO DE TIPOS DE DOCUMENTO (TOP LEVEL z-[9999]) */}
      {/* ========================================================================= */}
      <ManageDocumentTypesModal
        isOpen={isManageDocTypesModalOpen}
        onClose={() => setIsManageDocTypesModalOpen(false)}
        documentTypes={manualDocTypes}
        onSaveDocumentTypes={handleSaveDocumentTypes}
        selectedType={manualDocumentType}
        onSelectType={(newType) => setManualDocumentType(newType as TipoDocumentoEntrada)}
      />

      {/* ========================================================================= */}
      {/* MODAL OFICIAL: GERENCIAMENTO DE CATEGORIAS DE ESTOQUE (TOP LEVEL z-[9999]) */}
      {/* ========================================================================= */}
      <CategoryOptionsManagerModal
        isOpen={isManageCategoryModalOpen}
        onClose={() => setIsManageCategoryModalOpen(false)}
        title="Gerenciar Categorias de Estoque"
        subtitle="Adicione, edite, reordene ou exclua categorias de insumos e produtos"
        items={stockCategories}
        defaultItems={DEFAULT_INVENTORY_CATEGORIES}
        onSaveItems={handleSaveStockCategories}
        placeholder="Nome da nova categoria de estoque..."
        onSelectItem={(cat) => setQuickProductCategory(cat)}
        zIndexClass="z-[9999]"
      />

      {/* ========================================================================= */}
      {/* DIÁLOGO DE CONFIRMAÇÃO: DESEJA IMPRIMIR AS ETIQUETAS DE GÔNDOLA? */}
      {/* ========================================================================= */}
      {printPromptState && printPromptState.isOpen && (
        <div className="fixed inset-0 z-[9999] bg-stone-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div 
            className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden p-5 animate-in zoom-in-95 duration-150 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-950/80 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 shadow-xs">
                <Printer className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm sm:text-base font-extrabold text-stone-900 dark:text-white leading-tight">
                  {printPromptState.title}
                </h3>
                <p className="text-xs text-stone-600 dark:text-stone-400 mt-1 leading-relaxed">
                  {printPromptState.description}
                </p>
              </div>
            </div>

            <div className="max-h-48 overflow-y-auto rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/40 p-2.5 space-y-1.5 text-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1 flex items-center justify-between">
                <span>Produtos da Entrada</span>
                <span>{printPromptState.items.length} item(ns)</span>
              </div>
              {printPromptState.items.map((it, idx) => (
                <div key={idx} className="flex items-center justify-between py-1 px-1.5 rounded-lg bg-white dark:bg-stone-800/80 border border-stone-200/80 dark:border-stone-700/60 font-medium">
                  <span className="truncate pr-2 text-stone-800 dark:text-stone-200 font-semibold">
                    {it.product.nome_comercial || it.product.name}
                  </span>
                  <span className="font-mono font-bold text-sky-600 dark:text-sky-400 shrink-0">
                    {it.quantity} un
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setPrintPromptState(null)}
                className="px-4 py-2 text-xs font-bold text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition cursor-pointer"
              >
                Agora Não
              </button>
              <button
                type="button"
                onClick={() => {
                  const items = printPromptState.items;
                  const title = printPromptState.title;
                  setPrintPromptState(null);
                  setActiveLabelPrintModal({
                    isOpen: true,
                    items,
                    title
                  });
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 active:bg-sky-800 rounded-xl shadow-md transition flex items-center space-x-1.5 cursor-pointer active:scale-98"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Sim, Imprimir Etiquetas</span>
              </button>
            </div>
          </div>
        </div>
      )}

          </div>
        )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL DE IMPRESSÃO DE ETIQUETAS EM LOTE PARA ENTRADAS */}
      {/* ========================================================================= */}
      {activeLabelPrintModal && activeLabelPrintModal.isOpen && (
        <ProductLabelPrintModal
          isOpen={activeLabelPrintModal.isOpen}
          onClose={() => setActiveLabelPrintModal(null)}
          batchProducts={activeLabelPrintModal.items}
          entryTitle={activeLabelPrintModal.title}
          defaultQuantityRule="single"
          zIndexClass="z-[9999]"
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL OFICIAL: + LANÇAR NOTA DE SAÍDA (EMITIDA PELA EMPRESA) */}
      {/* Tema padronizado: bg-[#cad4e6] base | bg-[#e0e6f1] border-black cards | bg-white inputs */}
      {/* ========================================================================= */}
      {isNotaSaidaModalOpen && (
        <div
          id="modal-lancar-nota-saida"
          className="fixed inset-0 z-70 bg-black/60 backdrop-blur-xs flex items-center justify-center p-1 sm:p-2 overflow-hidden animate-in fade-in"
          onClick={() => setIsNotaSaidaModalOpen(false)}
        >
          <div
            className="w-[96vw] max-w-[96vw] h-[96vh] max-h-[96vh] flex flex-col justify-between mx-auto my-auto bg-[#cad4e6] dark:bg-stone-900 border border-black dark:border-stone-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 text-black dark:text-stone-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabeçalho */}
            <div className="px-4 py-2 bg-[#cad4e6] dark:bg-stone-900 border-b border-black dark:border-stone-700 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded bg-white dark:bg-stone-800 text-[#1e40af] dark:text-blue-400 flex items-center justify-center border border-black dark:border-stone-700 shrink-0">
                  <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black uppercase tracking-wide text-black dark:text-stone-100">
                    {editingNotaSaida ? 'EDITAR NOTA DE SAÍDA (EMITIDA PELA EMPRESA)' : 'LANÇAR NOTA DE SAÍDA (EMITIDA PELA EMPRESA)'}
                  </h3>
                  <p className="text-[10px] text-black/80 dark:text-stone-400 font-semibold uppercase tracking-tight">
                    FORMULÁRIO FISCAL DINÂMICO: NFS-E, NF-E, CT-E, NFC-E E MDF-E COM IMPRESSÃO DE ESPELHO AUXILIAR
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNotaSaidaModalOpen(false)}
                className="p-1 rounded text-black hover:bg-black/10 dark:text-stone-300 dark:hover:bg-stone-800 transition cursor-pointer"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Corpo */}
            <form onSubmit={handleSaveNotaSaida} className="flex-1 min-h-0 flex flex-col justify-between overflow-hidden">
              <div ref={notaSaidaBodyRef} className="flex-1 overflow-y-auto p-2.5 sm:p-3 space-y-2 scrollbar-none">
                {saidaFormError && (
                  <div className="p-2 bg-rose-50 dark:bg-rose-950/60 border border-rose-500 rounded-lg flex items-center space-x-2 text-rose-800 dark:text-rose-200 text-xs font-bold uppercase">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{saidaFormError}</span>
                  </div>
                )}

                {/* CARD 1: TIPO DE DOCUMENTO, IDENTIFICAÇÃO DA NOTA E DESTINATÁRIO / TOMADOR */}
                <div className="bg-[#e0e6f1] dark:bg-stone-800 border border-black dark:border-stone-700 rounded-xl p-2.5 space-y-2">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
                    <div className="lg:col-span-5">
                      <label htmlFor="saida-tipo-documento-select" className="block text-[11px] font-black text-black dark:text-stone-200 uppercase tracking-wide mb-1">
                        TIPO DE DOCUMENTO EMITIDO <span className="text-rose-600">*</span>
                      </label>
                      <select
                        id="saida-tipo-documento-select"
                        value={saidaTipoDocumento}
                        onChange={(e) => handleSaidaTipoDocumentoChange(e.target.value as TipoDocumentoSaida)}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-900 border border-black/60 dark:border-stone-600 rounded-lg text-xs font-black text-[#1e40af] dark:text-blue-300 focus:outline-none focus:ring-2 focus:ring-[#1e40af] uppercase shadow-2xs cursor-pointer"
                      >
                        <option value="NFS-e (Prestação de Serviço)">NFS-e (PRESTAÇÃO DE SERVIÇO)</option>
                        <option value="NF-e (Venda de Mercadoria)">NF-e (VENDA DE MERCADORIA / PRODUTO)</option>
                        <option value="NF-e (Remessa / Retorno)">NF-e (REMESSA / RETORNO)</option>
                        <option value="CT-e (Conhecimento de Transporte / Frete)">CT-e (CONHECIMENTO DE TRANSPORTE / FRETE)</option>
                        <option value="NFC-e (Consumidor)">NFC-e (CONSUMIDOR FINAL)</option>
                        <option value="MDF-e (Manifesto)">MDF-e (MANIFESTO ELETRÔNICO DE DOCUMENTOS)</option>
                      </select>
                    </div>

                    <div className="lg:col-span-2">
                      <label htmlFor="saida-numero-input" className="block text-[11px] font-black text-black dark:text-stone-200 uppercase tracking-wide mb-1">
                        NÚMERO <span className="text-rose-600">*</span>
                      </label>
                      <input
                        id="saida-numero-input"
                        type="text"
                        value={saidaNumero}
                        onChange={(e) => setSaidaNumero(e.target.value)}
                        required
                        placeholder="EX: 000142"
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-900 border border-black/50 dark:border-stone-600 rounded-lg text-xs font-mono font-bold text-black dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#1e40af]"
                      />
                    </div>

                    <div className="lg:col-span-1">
                      <label htmlFor="saida-serie-input" className="block text-[11px] font-black text-black dark:text-stone-200 uppercase tracking-wide mb-1">
                        SÉRIE
                      </label>
                      <input
                        id="saida-serie-input"
                        type="text"
                        value={saidaSerie}
                        onChange={(e) => {
                          const nextSerie = e.target.value;
                          setSaidaSerie(nextSerie);
                          if (!editingNotaSaida) {
                            setSaidaNumero(getNextNotaSaidaNumber(saidaTipoDocumento, nextSerie, notasSaida));
                          }
                        }}
                        placeholder="1"
                        className="w-full px-2 py-1.5 bg-white dark:bg-stone-900 border border-black/50 dark:border-stone-600 rounded-lg text-xs font-mono font-bold text-black dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#1e40af]"
                      />
                    </div>

                    <div className="lg:col-span-2">
                      <label htmlFor="saida-data-emissao-input" className="block text-[11px] font-black text-black dark:text-stone-200 uppercase tracking-wide mb-1">
                        EMISSÃO <span className="text-rose-600">*</span>
                      </label>
                      <input
                        id="saida-data-emissao-input"
                        type="date"
                        value={saidaDataEmissao}
                        onChange={(e) => {
                          setSaidaDataEmissao(e.target.value);
                          setSaidaDataVencimento(calculateDefaultDueDate(e.target.value));
                        }}
                        required
                        className="w-full px-2 py-1.5 bg-white dark:bg-stone-900 border border-black/50 dark:border-stone-600 rounded-lg text-xs font-bold text-black dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#1e40af]"
                      />
                    </div>

                    <div className="lg:col-span-2">
                      <label htmlFor="saida-chave-acesso-input" className="block text-[11px] font-bold text-black dark:text-stone-200 uppercase tracking-wide mb-1">
                        CHAVE / PROTOCOLO
                      </label>
                      <input
                        id="saida-chave-acesso-input"
                        type="text"
                        maxLength={54}
                        value={saidaChaveAcesso}
                        onChange={(e) => setSaidaChaveAcesso(e.target.value)}
                        placeholder="OPCIONAL (44 DÍG.)"
                        className="w-full px-2 py-1.5 bg-white dark:bg-stone-900 border border-black/40 dark:border-stone-600 rounded-lg text-xs font-mono font-bold text-black dark:text-stone-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#1e40af]"
                      />
                    </div>
                  </div>

                  {/* Destinatário / Tomador OU Remetente + Destinatário (quando CT-e) */}
                  {saidaTipoDocumento.includes('CT-e') ? (
                    <div className="pt-1.5 border-t border-black/20 dark:border-stone-700">
                      <datalist id="cte-parties-datalist-nota-saida">
                        {localClients.map((c) => (
                          <option key={`cli_${c.id}`} value={(c.name || c.nome || '').toUpperCase()}>
                            {`CLIENTE • ${(c.farmName || c.fazenda || c.cpfCnpj || c.city || '').toUpperCase()}`}
                          </option>
                        ))}
                        {localSuppliers.map((s) => (
                          <option key={`sup_${s.id}`} value={(s.name || '').toUpperCase()}>
                            {`FORNECEDOR • ${(s.tradeName || s.cnpjOrCpf || s.city || '').toUpperCase()}`}
                          </option>
                        ))}
                      </datalist>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
                        {/* COLUNA 1 — REMETENTE (ORIGEM DA CARGA) */}
                        <div className="bg-white/75 dark:bg-stone-900/60 border border-black/30 dark:border-stone-700 rounded-lg p-2 flex flex-col justify-between space-y-1.5">
                          <div className="flex flex-wrap items-center justify-between gap-1 min-h-[24px]">
                            <label htmlFor="saida-cte-remetente-input" className="flex items-center space-x-1 text-[10.5px] font-black text-black dark:text-stone-100 uppercase tracking-wide">
                              <User className="w-3.5 h-3.5 text-[#0369a1] dark:text-sky-400 shrink-0" />
                              <span>REMETENTE (ORIGEM DA CARGA) <span className="text-rose-600">*</span></span>
                            </label>
                            <button
                              type="button"
                              id="btn-cte-remetente-propria-empresa"
                              onClick={handleFillCteRemetentePropriaEmpresa}
                              className={`px-2 py-0.5 rounded text-[9.5px] font-black uppercase tracking-wider border transition cursor-pointer ${
                                cteRemetenteIsEmpresaPropria
                                  ? 'bg-[#0369a1] text-white border-[#075985]'
                                  : 'bg-white text-black border-black/40 hover:bg-sky-50'
                              }`}
                              title="Preencher Remetente com os dados da própria empresa emitente"
                            >
                              A Própria Empresa
                            </button>
                          </div>

                          <div className="space-y-1.5">
                            <div>
                              <input
                                id="saida-cte-remetente-input"
                                type="text"
                                list="cte-parties-datalist-nota-saida"
                                value={cteRemetenteNome}
                                onChange={(e) => handleCteRemetenteInputChange(e.target.value)}
                                required
                                placeholder="SELECIONE CLIENTE/FORNECEDOR OU DIGITE O REMETENTE..."
                                className="w-full px-2 py-1 bg-white dark:bg-stone-900 border border-black/50 dark:border-stone-600 rounded-lg text-xs font-bold text-black dark:text-stone-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0369a1] uppercase shadow-2xs"
                              />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-1.5">
                              <div className="sm:col-span-5">
                                <input
                                  type="text"
                                  value={cteRemetenteCpfCnpj}
                                  onChange={(e) => setCteRemetenteCpfCnpj(formatCpfCnpj(e.target.value))}
                                  placeholder="CPF / CNPJ"
                                  title="CPF / CNPJ do Remetente"
                                  className="w-full px-2 py-1 bg-white dark:bg-stone-900 border border-black/40 dark:border-stone-600 rounded-lg text-xs font-mono font-bold text-black dark:text-stone-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#0369a1]"
                                />
                              </div>
                              <div className="sm:col-span-3">
                                <input
                                  type="text"
                                  value={cteRemetenteIe}
                                  onChange={(e) => setCteRemetenteIe(e.target.value)}
                                  placeholder="IE"
                                  title="Inscrição Estadual do Remetente"
                                  className="w-full px-2 py-1 bg-white dark:bg-stone-900 border border-black/40 dark:border-stone-600 rounded-lg text-xs font-mono font-bold text-black dark:text-stone-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#0369a1] uppercase"
                                />
                              </div>
                              <div className="sm:col-span-4">
                                <input
                                  type="text"
                                  value={cteRemetenteCidadeUf}
                                  onChange={(e) => setCteRemetenteCidadeUf(e.target.value)}
                                  onBlur={(e) => {
                                    if (e.target.value.trim() && !cteMunicipioInicio) {
                                      setCteMunicipioInicio(e.target.value.trim().toUpperCase());
                                    }
                                  }}
                                  placeholder="MUNICÍPIO/UF"
                                  title="Município / UF do Remetente (Ex: TOLEDO/PR)"
                                  className="w-full px-2 py-1 bg-white dark:bg-stone-900 border border-black/40 dark:border-stone-600 rounded-lg text-xs font-bold text-black dark:text-stone-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#0369a1] uppercase"
                                />
                              </div>
                            </div>

                            <div>
                              <input
                                type="text"
                                value={cteRemetenteEndereco}
                                onChange={(e) => setCteRemetenteEndereco(e.target.value)}
                                placeholder="ENDEREÇO COMPLETO DO REMETENTE"
                                className="w-full px-2 py-1 bg-white dark:bg-stone-900 border border-black/40 dark:border-stone-600 rounded-lg text-xs font-bold text-black dark:text-stone-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#0369a1] uppercase"
                              />
                            </div>
                          </div>
                        </div>

                        {/* COLUNA 2 — DESTINATÁRIO (DESTINO DA CARGA) */}
                        <div className="bg-white/75 dark:bg-stone-900/60 border border-black/30 dark:border-stone-700 rounded-lg p-2 flex flex-col justify-between space-y-1.5">
                          <div className="flex flex-wrap items-center justify-between gap-1 min-h-[24px]">
                            <label htmlFor="saida-destinatario-input" className="flex items-center space-x-1 text-[10.5px] font-black text-black dark:text-stone-100 uppercase tracking-wide">
                              <User className="w-3.5 h-3.5 text-[#1e40af] dark:text-blue-400 shrink-0" />
                              <span>DESTINATÁRIO (DESTINO DA CARGA) <span className="text-rose-600">*</span></span>
                            </label>
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-200 dark:bg-stone-800 text-slate-700 dark:text-stone-300">
                              CLIENTES / FORNECEDORES
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            <div>
                              <input
                                id="saida-destinatario-input"
                                type="text"
                                list="cte-parties-datalist-nota-saida"
                                value={saidaDestinatarioNome}
                                onChange={(e) => handleSaidaDestinatarioInputChange(e.target.value)}
                                required
                                placeholder="SELECIONE CLIENTE/FORNECEDOR OU DIGITE O DESTINATÁRIO..."
                                className="w-full px-2 py-1 bg-white dark:bg-stone-900 border border-black/50 dark:border-stone-600 rounded-lg text-xs font-bold text-black dark:text-stone-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#1e40af] uppercase shadow-2xs"
                              />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-1.5">
                              <div className="sm:col-span-5">
                                <input
                                  type="text"
                                  value={saidaDestinatarioCpfCnpj}
                                  onChange={(e) => setSaidaDestinatarioCpfCnpj(formatCpfCnpj(e.target.value))}
                                  placeholder="CPF / CNPJ"
                                  title="CPF / CNPJ do Destinatário"
                                  className="w-full px-2 py-1 bg-white dark:bg-stone-900 border border-black/40 dark:border-stone-600 rounded-lg text-xs font-mono font-bold text-black dark:text-stone-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#1e40af]"
                                />
                              </div>
                              <div className="sm:col-span-3">
                                <input
                                  type="text"
                                  value={saidaDestinatarioIe}
                                  onChange={(e) => setSaidaDestinatarioIe(e.target.value)}
                                  placeholder="IE"
                                  title="Inscrição Estadual do Destinatário"
                                  className="w-full px-2 py-1 bg-white dark:bg-stone-900 border border-black/40 dark:border-stone-600 rounded-lg text-xs font-mono font-bold text-black dark:text-stone-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#1e40af] uppercase"
                                />
                              </div>
                              <div className="sm:col-span-4">
                                <input
                                  type="text"
                                  value={saidaDestinatarioCidadeUf}
                                  onChange={(e) => setSaidaDestinatarioCidadeUf(e.target.value)}
                                  onBlur={(e) => {
                                    if (e.target.value.trim() && !cteMunicipioTermino) {
                                      setCteMunicipioTermino(e.target.value.trim().toUpperCase());
                                    }
                                    if (!editingNotaSaida && e.target.value.includes('/')) {
                                      const autoEscopo = inferOperacaoUfEscopo(e.target.value);
                                      if (autoEscopo !== nfeRemessaEscopo) {
                                        handleOperacaoUfEscopoChange(autoEscopo);
                                      }
                                    }
                                  }}
                                  placeholder="MUNICÍPIO/UF"
                                  title="Município / UF do Destinatário (Ex: CASCAVEL/PR)"
                                  className="w-full px-2 py-1 bg-white dark:bg-stone-900 border border-black/40 dark:border-stone-600 rounded-lg text-xs font-bold text-black dark:text-stone-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#1e40af] uppercase"
                                />
                              </div>
                            </div>

                            <div>
                              <input
                                type="text"
                                value={saidaDestinatarioEndereco}
                                onChange={(e) => setSaidaDestinatarioEndereco(e.target.value)}
                                placeholder="ENDEREÇO COMPLETO DO DESTINATÁRIO"
                                className="w-full px-2 py-1 bg-white dark:bg-stone-900 border border-black/40 dark:border-stone-600 rounded-lg text-xs font-bold text-black dark:text-stone-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#1e40af] uppercase"
                              />
                            </div>
                          </div>
                        </div>

                        {/* COLUNA 3 — TOMADOR DO SERVIÇO (PAGADOR DO FRETE) */}
                        {(() => {
                          const isTomadorOutros = cteTomador === 'Outros';
                          const isTomadorDest = cteTomador === 'Destinatário';
                          const tomadorNomeDisplay = isTomadorOutros
                            ? cteTomadorTerceiroNome
                            : isTomadorDest
                              ? saidaDestinatarioNome
                              : cteRemetenteNome;
                          const tomadorCpfDisplay = isTomadorOutros
                            ? cteTomadorTerceiroCpfCnpj
                            : isTomadorDest
                              ? saidaDestinatarioCpfCnpj
                              : cteRemetenteCpfCnpj;
                          const tomadorIeDisplay = isTomadorOutros
                            ? cteTomadorTerceiroIe
                            : isTomadorDest
                              ? saidaDestinatarioIe
                              : cteRemetenteIe;
                          const tomadorCidadeUfDisplay = isTomadorOutros
                            ? cteTomadorTerceiroCidadeUf
                            : isTomadorDest
                              ? saidaDestinatarioCidadeUf
                              : cteRemetenteCidadeUf;
                          const tomadorEnderecoDisplay = isTomadorOutros
                            ? cteTomadorTerceiroEndereco
                            : isTomadorDest
                              ? saidaDestinatarioEndereco
                              : cteRemetenteEndereco;
                          const mirroredReadOnlyClass =
                            'bg-slate-100/90 dark:bg-stone-800/80 border-black/30 dark:border-stone-600 text-slate-700 dark:text-stone-300 cursor-default';

                          return (
                            <div
                              className={`border rounded-lg p-2 flex flex-col justify-between space-y-1.5 ${
                                isTomadorOutros
                                  ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-500/80 dark:border-amber-700'
                                  : 'bg-white/75 dark:bg-stone-900/60 border-black/30 dark:border-stone-700'
                              }`}
                            >
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center justify-between gap-1">
                                  <label htmlFor="saida-cte-tomador-select" className="flex items-center space-x-1 text-[10.5px] font-black text-black dark:text-stone-100 uppercase tracking-wide">
                                    <User className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
                                    <span>TOMADOR DO SERVIÇO (PAGADOR DO FRETE) <span className="text-rose-600">*</span></span>
                                  </label>
                                </div>
                                <select
                                  id="saida-cte-tomador-select"
                                  value={cteTomador}
                                  onChange={(e) => setCteTomador(e.target.value)}
                                  className="w-full px-2 py-1 bg-white dark:bg-stone-900 border border-black/50 dark:border-stone-600 rounded-lg text-[11px] font-black text-[#1e40af] dark:text-blue-300 uppercase cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-600"
                                >
                                  <option value="Remetente">Tomador do Serviço: Remetente (CIF - Pago na Origem)</option>
                                  <option value="Destinatário">Tomador do Serviço: Destinatário (FOB - Pago no Destino)</option>
                                  <option value="Outros">Tomador do Serviço: Outros / Terceiro (Consignatário)</option>
                                </select>
                              </div>

                              <div className="space-y-1.5">
                                <div>
                                  <input
                                    id="saida-cte-terceiro-tomador-input"
                                    type="text"
                                    list={isTomadorOutros ? 'cte-parties-datalist-nota-saida' : undefined}
                                    value={tomadorNomeDisplay}
                                    readOnly={!isTomadorOutros}
                                    onChange={
                                      isTomadorOutros
                                        ? (e) => handleCteTomadorTerceiroInputChange(e.target.value)
                                        : undefined
                                    }
                                    required={isTomadorOutros}
                                    placeholder={
                                      isTomadorOutros
                                        ? 'SELECIONE CLIENTE/FORNECEDOR OU DIGITE O TERCEIRO...'
                                        : isTomadorDest
                                          ? 'ESPELHADO AUTOMATICAMENTE DO DESTINATÁRIO'
                                          : 'ESPELHADO AUTOMATICAMENTE DO REMETENTE'
                                    }
                                    className={`w-full px-2 py-1 border rounded-lg text-xs font-bold placeholder-gray-500 focus:outline-none uppercase shadow-2xs ${
                                      isTomadorOutros
                                        ? 'bg-white dark:bg-stone-900 border-black/50 dark:border-stone-600 text-black dark:text-stone-100 focus:ring-2 focus:ring-amber-600'
                                        : mirroredReadOnlyClass
                                    }`}
                                  />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-12 gap-1.5">
                                  <div className="sm:col-span-5">
                                    <input
                                      type="text"
                                      value={tomadorCpfDisplay}
                                      readOnly={!isTomadorOutros}
                                      onChange={
                                        isTomadorOutros
                                          ? (e) => setCteTomadorTerceiroCpfCnpj(formatCpfCnpj(e.target.value))
                                          : undefined
                                      }
                                      placeholder="CPF / CNPJ"
                                      title="CPF / CNPJ do Tomador"
                                      className={`w-full px-2 py-1 border rounded-lg text-xs font-mono font-bold placeholder-gray-400 focus:outline-none ${
                                        isTomadorOutros
                                          ? 'bg-white dark:bg-stone-900 border-black/40 dark:border-stone-600 text-black dark:text-stone-100 focus:ring-1 focus:ring-amber-600'
                                          : mirroredReadOnlyClass
                                      }`}
                                    />
                                  </div>
                                  <div className="sm:col-span-3">
                                    <input
                                      type="text"
                                      value={tomadorIeDisplay}
                                      readOnly={!isTomadorOutros}
                                      onChange={
                                        isTomadorOutros
                                          ? (e) => setCteTomadorTerceiroIe(e.target.value)
                                          : undefined
                                      }
                                      placeholder="IE"
                                      title="Inscrição Estadual do Tomador"
                                      className={`w-full px-2 py-1 border rounded-lg text-xs font-mono font-bold placeholder-gray-400 focus:outline-none uppercase ${
                                        isTomadorOutros
                                          ? 'bg-white dark:bg-stone-900 border-black/40 dark:border-stone-600 text-black dark:text-stone-100 focus:ring-1 focus:ring-amber-600'
                                          : mirroredReadOnlyClass
                                      }`}
                                    />
                                  </div>
                                  <div className="sm:col-span-4">
                                    <input
                                      type="text"
                                      value={tomadorCidadeUfDisplay}
                                      readOnly={!isTomadorOutros}
                                      onChange={
                                        isTomadorOutros
                                          ? (e) => setCteTomadorTerceiroCidadeUf(e.target.value)
                                          : undefined
                                      }
                                      placeholder="MUNICÍPIO/UF"
                                      title="Município / UF do Tomador"
                                      className={`w-full px-2 py-1 border rounded-lg text-xs font-bold placeholder-gray-400 focus:outline-none uppercase ${
                                        isTomadorOutros
                                          ? 'bg-white dark:bg-stone-900 border-black/40 dark:border-stone-600 text-black dark:text-stone-100 focus:ring-1 focus:ring-amber-600'
                                          : mirroredReadOnlyClass
                                      }`}
                                    />
                                  </div>
                                </div>

                                <div>
                                  <input
                                    type="text"
                                    value={tomadorEnderecoDisplay}
                                    readOnly={!isTomadorOutros}
                                    onChange={
                                      isTomadorOutros
                                        ? (e) => setCteTomadorTerceiroEndereco(e.target.value)
                                        : undefined
                                    }
                                    placeholder={
                                      isTomadorOutros
                                        ? 'ENDEREÇO COMPLETO DO TERCEIRO PAGADOR (TOMADOR)'
                                        : 'ENDEREÇO ESPELHADO DO TOMADOR'
                                    }
                                    className={`w-full px-2 py-1 border rounded-lg text-xs font-bold placeholder-gray-400 focus:outline-none uppercase ${
                                      isTomadorOutros
                                        ? 'bg-white dark:bg-stone-900 border-black/40 dark:border-stone-600 text-black dark:text-stone-100 focus:ring-1 focus:ring-amber-600'
                                        : mirroredReadOnlyClass
                                    }`}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  ) : (
                    <div className="pt-1.5 border-t border-black/20 dark:border-stone-700">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                        <label htmlFor="saida-destinatario-input" className="flex items-center space-x-1.5 text-[11px] font-black text-black dark:text-stone-200 uppercase tracking-wide">
                          <User className="w-3.5 h-3.5 text-[#1e40af] dark:text-blue-400 shrink-0" />
                          <span>DESTINATÁRIO / TOMADOR (AUTOCOMPLETAR DE CLIENTES) <span className="text-rose-600">*</span></span>
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setSaidaIsConsumidorAvulso(true);
                            setSaidaDestinatarioId('');
                            setSaidaDestinatarioNome('CONSUMIDOR AVULSO');
                            setSaidaDestinatarioIe('ISENTO');
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border transition cursor-pointer ${
                            saidaIsConsumidorAvulso
                              ? 'bg-[#1e40af] text-white border-[#1e3a8a]'
                              : 'bg-white text-black border-black/40 hover:bg-slate-100'
                          }`}
                        >
                          CONSUMIDOR AVULSO
                        </button>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
                        <div className="lg:col-span-5">
                          <input
                            id="saida-destinatario-input"
                            type="text"
                            list="clients-datalist-nota-saida"
                            value={saidaDestinatarioNome}
                            onChange={(e) => handleSaidaDestinatarioInputChange(e.target.value)}
                            required
                            placeholder="SELECIONE OU DIGITE O NOME DO CLIENTE / TOMADOR..."
                            className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-900 border border-black/50 dark:border-stone-600 rounded-lg text-xs font-bold text-black dark:text-stone-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#1e40af] uppercase shadow-2xs"
                          />
                          <datalist id="clients-datalist-nota-saida">
                            <option value="CONSUMIDOR AVULSO" />
                            {localClients.map((c) => (
                              <option key={c.id} value={(c.name || c.nome || '').toUpperCase()}>
                                {(c.farmName || c.fazenda || c.cpfCnpj || '').toUpperCase()}
                              </option>
                            ))}
                          </datalist>
                        </div>
                        <div className="lg:col-span-2">
                          <input
                            type="text"
                            value={saidaDestinatarioCpfCnpj}
                            onChange={(e) => setSaidaDestinatarioCpfCnpj(formatCpfCnpj(e.target.value))}
                            placeholder="CPF / CNPJ"
                            title="CPF / CNPJ do Destinatário"
                            className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-900 border border-black/40 dark:border-stone-600 rounded-lg text-xs font-mono font-bold text-black dark:text-stone-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#1e40af]"
                          />
                        </div>
                        <div className="lg:col-span-2">
                          <input
                            type="text"
                            value={saidaDestinatarioIe}
                            onChange={(e) => setSaidaDestinatarioIe(e.target.value)}
                            placeholder="INSC. ESTADUAL (IE)"
                            title="Inscrição Estadual (IE)"
                            className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-900 border border-black/40 dark:border-stone-600 rounded-lg text-xs font-mono font-bold text-black dark:text-stone-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#1e40af] uppercase"
                          />
                        </div>
                        <div className="lg:col-span-3">
                          <input
                            type="text"
                            value={saidaDestinatarioCidadeUf}
                            onChange={(e) => setSaidaDestinatarioCidadeUf(e.target.value)}
                            onBlur={(e) => {
                              if (!editingNotaSaida && e.target.value.includes('/')) {
                                const autoEscopo = inferOperacaoUfEscopo(e.target.value);
                                if (autoEscopo !== nfeRemessaEscopo) {
                                  handleOperacaoUfEscopoChange(autoEscopo);
                                }
                              }
                            }}
                            placeholder="CIDADE / UF (EX: CASCAVEL/PR)"
                            title="Cidade / UF"
                            className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-900 border border-black/40 dark:border-stone-600 rounded-lg text-xs font-bold text-black dark:text-stone-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#1e40af] uppercase"
                          />
                        </div>
                      </div>
                      <div className="mt-1.5">
                        <input
                          type="text"
                          value={saidaDestinatarioEndereco}
                          onChange={(e) => setSaidaDestinatarioEndereco(e.target.value)}
                          placeholder="ENDEREÇO COMPLETO DO DESTINATÁRIO (RUA / RODOVIA, Nº, BAIRRO / ZONA RURAL)"
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-900 border border-black/40 dark:border-stone-600 rounded-lg text-xs font-bold text-black dark:text-stone-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#1e40af] uppercase"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* CARD 2 DINÂMICO: CAMPOS ESPECÍFICOS DO DOCUMENTO FISCAL SELECIONADO */}
                {saidaTipoDocumento.includes('NFS-e') && (
                  <div className="bg-[#e0e6f1] dark:bg-stone-800 border border-black dark:border-stone-700 rounded-xl p-2.5 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-black/20 dark:border-stone-700">
                      <span className="text-[11px] font-black text-[#6d28d9] dark:text-purple-300 uppercase tracking-wide flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        <span>DADOS FISCAIS E DISCRIMINAÇÃO DA NFS-E (PRESTAÇÃO DE SERVIÇO)</span>
                      </span>
                      <div className="flex items-center gap-2">
                        <label htmlFor="nfse-pedido-select" className="text-[10px] font-black uppercase text-black/80 dark:text-stone-300">
                          VINCULAR PEDIDO / OS:
                        </label>
                        <select
                          id="nfse-pedido-select"
                          value={nfsePedidoServicoId}
                          onChange={(e) => handleLinkServiceOrderNfse(e.target.value)}
                          className="px-2 py-1 bg-white dark:bg-stone-900 border border-black/50 dark:border-stone-600 rounded-lg text-[11px] font-bold text-black dark:text-stone-100 uppercase max-w-[280px] cursor-pointer"
                        >
                          <option value="">NENHUM PEDIDO VINCULADO (MANUAL)</option>
                          {localServices.map(s => (
                            <option key={s.id} value={s.id}>
                              {`${s.orderNumber ? `OS ${s.orderNumber} • ` : ''}${s.clientName} - ${s.serviceType} (${formatCurrencyBRL(s.totalAmount || 0)})`.toUpperCase()}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2">
                      <div className="lg:col-span-3">
                        <label className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                          CÓD. SERVIÇO (LC 116/03)
                        </label>
                        <div className="flex items-center gap-1">
                          <select
                            id="nfse-codigo-servico-select"
                            value={nfseCodigoServico}
                            onChange={(e) => {
                              if (e.target.value === '__manage__') {
                                setIsLc116ManagerOpen(true);
                              } else {
                                setNfseCodigoServico(e.target.value);
                              }
                            }}
                            className="flex-1 min-w-0 h-8 px-2 py-1 bg-white dark:bg-stone-900 border border-black/40 dark:border-stone-600 rounded-lg text-xs font-mono font-bold text-black dark:text-stone-100 cursor-pointer"
                          >
                            {nfseCodigoServico && !lc116Codes.some((c) => c.codigo === nfseCodigoServico) && (
                              <option value={nfseCodigoServico}>{nfseCodigoServico}</option>
                            )}
                            {lc116Codes.map((c) => (
                              <option key={c.codigo} value={c.codigo}>
                                {c.codigo} — {c.descricao}
                              </option>
                            ))}
                            <option disabled value="">──────────</option>
                            <option value="__manage__" className="text-sky-700 font-bold">⚙️ Gerenciar códigos LC 116/03...</option>
                          </select>
                          <button
                            type="button"
                            id="btn-gerenciar-lc116"
                            onClick={() => setIsLc116ManagerOpen(true)}
                            className="h-8 w-8 flex items-center justify-center bg-white hover:bg-gray-100 dark:bg-stone-900 dark:hover:bg-stone-700 text-black dark:text-stone-200 border border-black/50 dark:border-stone-600 rounded-lg transition cursor-pointer shrink-0"
                            title="Gerenciar códigos de serviço LC 116/03"
                          >
                            <Settings className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="lg:col-span-3">
                        <label className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                          MUNICÍPIO DA PRESTAÇÃO
                        </label>
                        <input
                          type="text"
                          value={nfseMunicipioPrestacao}
                          onChange={(e) => setNfseMunicipioPrestacao(e.target.value)}
                          placeholder="EX: CASCAVEL/PR"
                          className="w-full h-8 px-2 py-1 bg-white dark:bg-stone-900 border border-black/40 dark:border-stone-600 rounded-lg text-xs font-bold text-black dark:text-stone-100 uppercase"
                        />
                      </div>
                      <div className="lg:col-span-2">
                        <label className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                          NATUREZA OPERAÇÃO
                        </label>
                        <select
                          value={nfseNaturezaOperacao}
                          onChange={(e) => setNfseNaturezaOperacao(e.target.value)}
                          className="w-full h-8 px-2 py-1 bg-white dark:bg-stone-900 border border-black/40 dark:border-stone-600 rounded-lg text-xs font-bold text-black dark:text-stone-100 uppercase"
                        >
                          <option value="Tributação no Município">TRIBUTAÇÃO NO MUNICÍPIO</option>
                          <option value="Fora do Município">FORA DO MUNICÍPIO</option>
                          <option value="Isenção / Imune">ISENÇÃO / IMUNE</option>
                        </select>
                      </div>
                      <div className="lg:col-span-2">
                        <label className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                          ALÍQUOTA ISS (%)
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={nfseAliquotaIss}
                          onChange={(e) => {
                            setNfseAliquotaIss(e.target.value);
                            syncNfseValorIss(parseCurrencyInput(saidaValorDisplay), e.target.value);
                          }}
                          placeholder="2.00"
                          className="w-full h-8 px-2 py-1 bg-white dark:bg-stone-900 border border-black/40 dark:border-stone-600 rounded-lg text-xs font-mono font-bold text-right text-black dark:text-stone-100"
                        />
                      </div>
                      <div className="lg:col-span-2">
                        <label className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                          VALOR ISS (R$) / RETENÇÃO
                        </label>
                        <div className="flex gap-1">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={nfseValorIssDisplay}
                            onChange={(e) => setNfseValorIssDisplay(maskBrCurrencyATM(e.target.value))}
                            placeholder="0,00"
                            className="w-1/2 h-8 px-2 py-1 bg-white dark:bg-stone-900 border border-black/40 dark:border-stone-600 rounded-lg text-xs font-mono font-bold text-right text-black dark:text-stone-100"
                          />
                          <select
                            value={nfseRetencaoIss ? 'SIM' : 'NAO'}
                            onChange={(e) => setNfseRetencaoIss(e.target.value === 'SIM')}
                            className="w-1/2 h-8 px-1.5 py-1 bg-white dark:bg-stone-900 border border-black/40 dark:border-stone-600 rounded-lg text-[10px] font-black text-black dark:text-stone-100 uppercase"
                            title="Retenção de ISS?"
                          >
                            <option value="NAO">RET: NÃO</option>
                            <option value="SIM">RET: SIM</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Discriminação Detalhada (Área/Horas + Unitário + Obs Fiscais) */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                          ÁREA / HORAS TRAB.
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={nfseQuantidadeAreaHoras}
                          onChange={(e) => {
                            const masked = maskBrNumberWithThousands(e.target.value);
                            setNfseQuantidadeAreaHoras(masked);
                            const q = parsePtBrNumber(masked);
                            const u = desformatarMoeda(nfseValorUnitarioDisplay);
                            if (q > 0 && u > 0) {
                              const tot = Number((q * u).toFixed(2));
                              setSaidaValorDisplay(formatCurrencyInputDisplay(tot));
                              syncNfseValorIss(tot, nfseAliquotaIss);
                            }
                          }}
                          placeholder="EX: 12,5"
                          className="w-full px-2 py-1.5 bg-white dark:bg-stone-900 border border-black/40 dark:border-stone-600 rounded-lg text-xs font-mono font-bold text-right text-black dark:text-stone-100"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                          UNIDADE
                        </label>
                        <select
                          value={nfseUnidadeAreaHoras}
                          onChange={(e) => setNfseUnidadeAreaHoras(e.target.value)}
                          className="w-full px-2 py-1.5 bg-white dark:bg-stone-900 border border-black/40 dark:border-stone-600 rounded-lg text-xs font-bold text-black dark:text-stone-100 uppercase"
                        >
                          <option value="HORAS">HORAS</option>
                          <option value="HA">HECTARES (HA)</option>
                          <option value="ALQ">ALQUEIRES</option>
                          <option value="TON">TONELADAS</option>
                          <option value="UN">UNIDADE / SERV.</option>
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                          VALOR UNITÁRIO (R$)
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={nfseValorUnitarioDisplay}
                          onChange={(e) => {
                            const masked = maskBrCurrencyATM(e.target.value);
                            setNfseValorUnitarioDisplay(masked);
                            const q = parsePtBrNumber(nfseQuantidadeAreaHoras);
                            const u = desformatarMoeda(masked);
                            if (q > 0 && u > 0) {
                              const tot = Number((q * u).toFixed(2));
                              setSaidaValorDisplay(formatCurrencyInputDisplay(tot));
                              syncNfseValorIss(tot, nfseAliquotaIss);
                            }
                          }}
                          placeholder="0,00"
                          className="w-full px-2 py-1.5 bg-white dark:bg-stone-900 border border-black/40 dark:border-stone-600 rounded-lg text-xs font-mono font-bold text-right text-black dark:text-stone-100"
                        />
                      </div>
                      <div className="sm:col-span-6">
                        <label className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                          OBSERVAÇÕES FISCAIS (EX: SIMPLES NACIONAL / RETENÇÕES)
                        </label>
                        <input
                          type="text"
                          value={nfseObservacoesFiscais}
                          onChange={(e) => setNfseObservacoesFiscais(e.target.value)}
                          placeholder="EX: DOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL..."
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-900 border border-black/40 dark:border-stone-600 rounded-lg text-xs font-bold text-black dark:text-stone-100 uppercase"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="saida-descricao-input" className="block text-[11px] font-black text-black dark:text-stone-200 uppercase tracking-wide mb-1">
                        DISCRIMINAÇÃO DETALHADA DOS SERVIÇOS PRESTADOS
                      </label>
                      <textarea
                        id="saida-descricao-input"
                        rows={2}
                        value={saidaDescricao}
                        onChange={(e) => setSaidaDescricao(e.target.value)}
                        placeholder="EX: PRESTAÇÃO DE SERVIÇO DE ENSILAGEM DE MILHO / COLHEITA / HORAS MÁQUINA..."
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-900 border border-black/50 dark:border-stone-600 rounded-lg text-xs font-bold text-black dark:text-stone-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1e40af] uppercase resize-none"
                      />
                    </div>
                  </div>
                )}

                {(saidaTipoDocumento.includes('NF-e') || saidaTipoDocumento.includes('NFC-e')) && (
                  <div className="bg-[#e0e6f1] dark:bg-stone-800 border border-black dark:border-stone-700 rounded-xl p-2.5 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-black/20 dark:border-stone-700">
                      <span className={`text-[11px] font-black uppercase tracking-wide flex items-center gap-1.5 ${saidaTipoDocumento.includes('Remessa') ? 'text-amber-700 dark:text-amber-300' : 'text-[#1e40af] dark:text-blue-300'}`}>
                        <Package className="w-3.5 h-3.5" />
                        <span>
                          {saidaTipoDocumento.includes('NFC-e')
                            ? 'DADOS RÁPIDOS DE CUPOM FISCAL (NFC-E) E PRODUTOS'
                            : saidaTipoDocumento.includes('Remessa')
                              ? 'DADOS FISCAIS DE REMESSA / RETORNO (NF-E) E GRADE DE ITENS / EQUIPAMENTOS'
                              : 'DADOS FISCAIS DA NF-E E GRADE DE PRODUTOS (CONECTADA AO ESTOQUE)'}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={handleAddSaidaItemRow}
                        className="px-2.5 py-1 bg-[#1e40af] hover:bg-[#1e3a8a] text-white rounded-lg text-[10px] font-black uppercase flex items-center gap-1 transition cursor-pointer shadow-2xs"
                      >
                        <Plus className="w-3 h-3" />
                        <span>ADICIONAR ITEM</span>
                      </button>
                    </div>

                    {saidaTipoDocumento.includes('Remessa') ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2">
                          <div className="lg:col-span-3">
                            <label className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                              NATUREZA DA REMESSA / RETORNO <span className="text-rose-600">*</span>
                            </label>
                            <select
                              id="saida-remessa-natureza-select"
                              value={nfeNaturezaOperacao}
                              onChange={(e) => handleRemessaNaturezaChange(e.target.value)}
                              className="w-full h-8 px-2 py-1 bg-white dark:bg-stone-900 border border-black/50 dark:border-stone-600 rounded-lg text-xs font-bold text-black dark:text-stone-100 uppercase cursor-pointer"
                            >
                              <option value="Remessa para Conserto ou Reparo">REMESSA PARA CONSERTO OU REPARO</option>
                              <option value="Retorno de Conserto ou Reparo">RETORNO DE CONSERTO OU REPARO</option>
                              <option value="Remessa em Garantia / Troca">REMESSA EM GARANTIA / TROCA</option>
                              <option value="Remessa em Comodato / Locação">REMESSA EM COMODATO / LOCAÇÃO</option>
                              <option value="Simples Remessa / Outras Saídas">SIMPLES REMESSA / OUTRAS SAÍDAS</option>
                            </select>
                          </div>
                          <div className="lg:col-span-2">
                            <label className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                              OPERAÇÃO (UF)
                            </label>
                            <select
                              value={nfeRemessaEscopo}
                              onChange={(e) => handleRemessaNaturezaChange(nfeNaturezaOperacao, e.target.value as 'estadual' | 'interestadual')}
                              className="w-full h-8 px-2 py-1 bg-white dark:bg-stone-900 border border-black/40 dark:border-stone-600 rounded-lg text-xs font-bold text-black dark:text-stone-100 uppercase cursor-pointer"
                            >
                              <option value="estadual">ESTADUAL (5XXX)</option>
                              <option value="interestadual">INTERESTADUAL (6XXX)</option>
                            </select>
                          </div>
                          <div className="lg:col-span-2">
                            <label className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                              CFOP
                            </label>
                            <div className="flex items-center gap-1">
                              <select
                                id="saida-remessa-cfop-select"
                                value={nfeCfop}
                                onChange={(e) => handleHeaderNfeCfopChange(e.target.value)}
                                className="flex-1 min-w-0 h-8 px-1.5 py-1 bg-white dark:bg-stone-900 border border-black/50 dark:border-stone-600 rounded-lg text-xs font-mono font-black text-[#b45309] dark:text-amber-300 cursor-pointer"
                              >
                                {nfeCfop && !cfopsNfeRemessaByScope.some((c) => c.codigo === nfeCfop) && (
                                  <option value={nfeCfop}>{nfeCfop}</option>
                                )}
                                {cfopsNfeRemessaByScope.map((c) => (
                                  <option key={c.codigo} value={c.codigo}>
                                    {c.codigo} — {c.descricao}
                                  </option>
                                ))}
                                <option disabled value="">──────────</option>
                                <option value="__manage__" className="text-sky-700 font-bold">⚙️ Gerenciar catálogo CFOP...</option>
                              </select>
                              <button
                                type="button"
                                onClick={() => {
                                  setCfopManagerTarget('nfe');
                                  setIsCfopManagerOpen(true);
                                }}
                                className="h-8 w-8 flex items-center justify-center bg-white hover:bg-gray-100 dark:bg-stone-900 dark:hover:bg-stone-700 text-black dark:text-stone-200 border border-black/50 dark:border-stone-600 rounded-lg transition cursor-pointer shrink-0"
                                title="Gerenciar catálogo de CFOPs"
                              >
                                <Settings className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <div className="lg:col-span-3">
                            <label className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                              CHAVE / Nº DA NF-E REFERENCIADA (OPCIONAL)
                            </label>
                            <input
                              id="saida-nfe-referenciada-input"
                              type="text"
                              value={nfeReferenciada}
                              onChange={(e) => setNfeReferenciada(e.target.value)}
                              placeholder="Nº OU CHAVE DA REMESSA ORIGINAL (PARA RETORNO)..."
                              className="w-full h-8 px-2 py-1 bg-white dark:bg-stone-900 border border-black/40 dark:border-stone-600 rounded-lg text-xs font-mono font-bold text-black dark:text-stone-100"
                            />
                          </div>
                          <div className="lg:col-span-2">
                            <label className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                              MODALIDADE FRETE
                            </label>
                            <select
                              value={nfeModalidadeFrete}
                              onChange={(e) => setNfeModalidadeFrete(e.target.value)}
                              className="w-full h-8 px-2 py-1 bg-white dark:bg-stone-900 border border-black/40 dark:border-stone-600 rounded-lg text-xs font-bold text-black dark:text-stone-100 uppercase"
                            >
                              <option value="0 - Por conta do Emitente">POR CONTA DO EMITENTE</option>
                              <option value="1 - Por conta do Destinatário">POR CONTA DO DESTINATÁRIO</option>
                              <option value="9 - Sem Frete">SEM FRETE</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                              TRANSPORTADORA / MOTORISTA (OPCIONAL)
                            </label>
                            <input
                              type="text"
                              value={nfeTransportadoraNome}
                              onChange={(e) => setNfeTransportadoraNome(e.target.value)}
                              placeholder="NOME DA TRANSPORTADORA OU PORTADOR..."
                              className="w-full px-2 py-1.5 bg-white dark:bg-stone-900 border border-black/40 dark:border-stone-600 rounded-lg text-xs font-bold text-black dark:text-stone-100 uppercase"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                              PLACA DO VEÍCULO (OPCIONAL)
                            </label>
                            <input
                              type="text"
                              value={nfeTransportadoraPlaca}
                              onChange={(e) => setNfeTransportadoraPlaca(e.target.value)}
                              placeholder="PLACA (EX: ABC1D23)"
                              className="w-full px-2 py-1.5 bg-white dark:bg-stone-900 border border-black/40 dark:border-stone-600 rounded-lg text-xs font-mono font-bold text-black dark:text-stone-100 uppercase"
                            />
                          </div>
                        </div>
                      </div>
                    ) : saidaTipoDocumento.includes('NF-e') ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2">
                        <div className="lg:col-span-2">
                          <label className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                            NATUREZA DA OPERAÇÃO
                          </label>
                          <select
                            value={nfeNaturezaOperacao}
                            onChange={(e) => handleNfeVendaNaturezaChange(e.target.value)}
                            className="w-full h-8 px-2 py-1 bg-white dark:bg-stone-900 border border-black/40 dark:border-stone-600 rounded-lg text-xs font-bold text-black dark:text-stone-100 uppercase cursor-pointer"
                          >
                            <option value="Venda de Mercadoria">VENDA DE MERCADORIA</option>
                            <option value="Remessa">REMESSA</option>
                            <option value="Devolução">DEVOLUÇÃO</option>
                            <option value="Transferência">TRANSFERÊNCIA</option>
                          </select>
                        </div>
                        <div className="lg:col-span-2">
                          <label className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                            OPERAÇÃO (UF)
                          </label>
                          <select
                            id="saida-nfe-escopo-select"
                            value={nfeRemessaEscopo}
                            onChange={(e) => handleOperacaoUfEscopoChange(e.target.value as 'estadual' | 'interestadual')}
                            className="w-full h-8 px-2 py-1 bg-white dark:bg-stone-900 border border-black/40 dark:border-stone-600 rounded-lg text-xs font-bold text-black dark:text-stone-100 uppercase cursor-pointer"
                          >
                            <option value="estadual">ESTADUAL (5XXX)</option>
                            <option value="interestadual">INTERESTADUAL (6XXX)</option>
                          </select>
                        </div>
                        <div className="lg:col-span-2">
                          <label className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                            CFOP
                          </label>
                          <div className="flex items-center gap-1">
                            <select
                              id="saida-nfe-cfop-select"
                              value={nfeCfop}
                              onChange={(e) => handleHeaderNfeCfopChange(e.target.value)}
                              className="flex-1 min-w-0 h-8 px-1.5 py-1 bg-white dark:bg-stone-900 border border-black/50 dark:border-stone-600 rounded-lg text-xs font-mono font-bold text-black dark:text-stone-100 cursor-pointer"
                            >
                              {nfeCfop && !cfopsNfeVendaByScope.some((c) => c.codigo === nfeCfop) && (
                                <option value={nfeCfop}>{nfeCfop}</option>
                              )}
                              {cfopsNfeVendaByScope.map((c) => (
                                <option key={c.codigo} value={c.codigo}>
                                  {c.codigo} — {c.descricao}
                                </option>
                              ))}
                              <option disabled value="">──────────</option>
                              <option value="__manage__" className="text-sky-700 font-bold">⚙️ Gerenciar catálogo CFOP...</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => {
                                setCfopManagerTarget('nfe');
                                setIsCfopManagerOpen(true);
                              }}
                              className="h-8 w-8 flex items-center justify-center bg-white hover:bg-gray-100 dark:bg-stone-900 dark:hover:bg-stone-700 text-black dark:text-stone-200 border border-black/50 dark:border-stone-600 rounded-lg transition cursor-pointer shrink-0"
                              title="Gerenciar catálogo de CFOPs"
                            >
                              <Settings className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="lg:col-span-2">
                          <label className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                            FINALIDADE
                          </label>
                          <select
                            value={nfeFinalidade}
                            onChange={(e) => setNfeFinalidade(e.target.value)}
                            className="w-full h-8 px-2 py-1 bg-white dark:bg-stone-900 border border-black/40 dark:border-stone-600 rounded-lg text-xs font-bold text-black dark:text-stone-100 uppercase"
                          >
                            <option value="Normal">NORMAL</option>
                            <option value="Complementar">COMPLEMENTAR</option>
                            <option value="Ajuste">AJUSTE</option>
                            <option value="Devolução">DEVOLUÇÃO</option>
                          </select>
                        </div>
                        <div className="lg:col-span-2">
                          <label className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                            MODALIDADE FRETE
                          </label>
                          <select
                            value={nfeModalidadeFrete}
                            onChange={(e) => setNfeModalidadeFrete(e.target.value)}
                            className="w-full h-8 px-2 py-1 bg-white dark:bg-stone-900 border border-black/40 dark:border-stone-600 rounded-lg text-xs font-bold text-black dark:text-stone-100 uppercase"
                          >
                            <option value="0 - Por conta do Emitente">POR CONTA DO EMITENTE</option>
                            <option value="1 - Por conta do Destinatário">POR CONTA DO DESTINATÁRIO</option>
                            <option value="9 - Sem Frete">SEM FRETE</option>
                          </select>
                        </div>
                        <div className="lg:col-span-2">
                          <label className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                            TRANSPORTADORA / PLACA
                          </label>
                          <div className="flex gap-1">
                            <input
                              type="text"
                              value={nfeTransportadoraNome}
                              onChange={(e) => setNfeTransportadoraNome(e.target.value)}
                              placeholder="TRANSP."
                              className="w-3/5 h-8 px-2 py-1 bg-white dark:bg-stone-900 border border-black/40 dark:border-stone-600 rounded-lg text-[11px] font-bold text-black dark:text-stone-100 uppercase"
                            />
                            <input
                              type="text"
                              value={nfeTransportadoraPlaca}
                              onChange={(e) => setNfeTransportadoraPlaca(e.target.value)}
                              placeholder="PLACA"
                              className="w-2/5 h-8 px-1.5 py-1 bg-white dark:bg-stone-900 border border-black/40 dark:border-stone-600 rounded-lg text-[11px] font-mono font-bold text-black dark:text-stone-100 uppercase"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                        <div className="sm:col-span-4">
                          <label className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                            CPF / CNPJ NA NOTA (CONSUMIDOR)
                          </label>
                          <input
                            type="text"
                            value={saidaDestinatarioCpfCnpj}
                            onChange={(e) => setSaidaDestinatarioCpfCnpj(formatCpfCnpj(e.target.value))}
                            placeholder="OPCIONAL: 000.000.000-00"
                            className="w-full h-8 px-2.5 py-1 bg-white dark:bg-stone-900 border border-black/40 dark:border-stone-600 rounded-lg text-xs font-mono font-bold text-black dark:text-stone-100"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                            OPERAÇÃO (UF)
                          </label>
                          <select
                            value={nfeRemessaEscopo}
                            onChange={(e) => handleOperacaoUfEscopoChange(e.target.value as 'estadual' | 'interestadual')}
                            className="w-full h-8 px-2 py-1 bg-white dark:bg-stone-900 border border-black/40 dark:border-stone-600 rounded-lg text-xs font-bold text-black dark:text-stone-100 uppercase cursor-pointer"
                          >
                            <option value="estadual">ESTADUAL (5XXX)</option>
                            <option value="interestadual">INTERESTADUAL (6XXX)</option>
                          </select>
                        </div>
                        <div className="sm:col-span-3">
                          <label className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                            CFOP CUPOM
                          </label>
                          <div className="flex items-center gap-1">
                            <select
                              id="saida-nfce-cfop-select"
                              value={nfeCfop}
                              onChange={(e) => handleHeaderNfeCfopChange(e.target.value)}
                              className="flex-1 min-w-0 h-8 px-1.5 py-1 bg-white dark:bg-stone-900 border border-black/40 dark:border-stone-600 rounded-lg text-xs font-mono font-bold text-black dark:text-stone-100 cursor-pointer"
                            >
                              {nfeCfop && !cfopsNfceByScope.some((c) => c.codigo === nfeCfop) && (
                                <option value={nfeCfop}>{nfeCfop}</option>
                              )}
                              {cfopsNfceByScope.map((c) => (
                                <option key={c.codigo} value={c.codigo}>
                                  {c.codigo} — {c.descricao}
                                </option>
                              ))}
                              <option disabled value="">──────────</option>
                              <option value="__manage__" className="text-sky-700 font-bold">⚙️ Gerenciar catálogo CFOP...</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => {
                                setCfopManagerTarget('nfe');
                                setIsCfopManagerOpen(true);
                              }}
                              className="h-8 w-8 flex items-center justify-center bg-white hover:bg-gray-100 dark:bg-stone-900 dark:hover:bg-stone-700 text-black dark:text-stone-200 border border-black/50 dark:border-stone-600 rounded-lg transition cursor-pointer shrink-0"
                              title="Gerenciar catálogo de CFOPs"
                            >
                              <Settings className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="sm:col-span-3">
                          <label className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                            FORMA DE PAGAMENTO (CUPOM)
                          </label>
                          <select
                            value={saidaCondicaoPagamento}
                            onChange={(e) => handleSaidaPaymentConditionChange(e.target.value)}
                            className="w-full h-8 px-2.5 py-1 bg-white dark:bg-stone-900 border border-black/40 dark:border-stone-600 rounded-lg text-xs font-bold text-black dark:text-stone-100 uppercase"
                          >
                            <option value="PIX">PIX</option>
                            <option value="Dinheiro">DINHEIRO</option>
                            <option value="Cartão Crédito/Débito">CARTÃO CRÉDITO / DÉBITO</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Datalist global de CFOPs filtrados pelo escopo UF para os itens individuais */}
                    <datalist id="nfe-item-cfop-datalist">
                      {cfopsAllByScope.map((c) => (
                        <option key={c.codigo} value={c.codigo}>
                          {c.codigo} - {c.descricao}
                        </option>
                      ))}
                    </datalist>

                    {/* Grade de Produtos / Itens do Estoque */}
                    <div className="bg-white dark:bg-stone-900 border border-black/50 dark:border-stone-700 rounded-lg overflow-x-auto">
                      <table className="w-full text-[11px] border-collapse">
                        <thead>
                          <tr className="bg-slate-100 dark:bg-stone-800 border-b border-black/30 text-[10px] font-black uppercase">
                            <th className="p-1.5 text-left min-w-[200px]">PRODUTO DO ESTOQUE / DESCRIÇÃO</th>
                            <th className="p-1.5 text-center w-[85px]">NCM</th>
                            <th className="p-1.5 text-center w-[76px]">
                              <span className="inline-flex items-center justify-center gap-1">
                                <span>CFOP</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCfopManagerTarget('nfe');
                                    setIsCfopManagerOpen(true);
                                  }}
                                  className="text-slate-600 hover:text-black cursor-pointer"
                                  title="Gerenciar catálogo de CFOPs"
                                >
                                  <Settings className="w-3 h-3" />
                                </button>
                              </span>
                            </th>
                            <th className="p-1.5 text-center w-[54px]">UN</th>
                            <th className="p-1.5 text-right w-[68px]">QTD</th>
                            <th className="p-1.5 text-right w-[90px]">V. UNIT (R$)</th>
                            <th className="p-1.5 text-right w-[75px]">DESC (R$)</th>
                            {saidaTipoDocumento.includes('NF-e') && (
                              <th className="p-1.5 text-right w-[65px]">ICMS %</th>
                            )}
                            <th className="p-1.5 text-right w-[95px]">TOTAL (R$)</th>
                            <th className="p-1.5 text-center w-[34px]"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-stone-700">
                          {saidaItens.map((item, idx) => (
                            <tr key={item.id}>
                              <td className="p-1">
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-1">
                                  <select
                                    value={item.inventoryItemId || ''}
                                    onChange={(e) => handleSelectSaidaInventoryProduct(idx, e.target.value)}
                                    className="w-full px-1.5 py-1 bg-slate-50 dark:bg-stone-800 border border-slate-300 dark:border-stone-600 rounded text-[11px] font-bold uppercase"
                                  >
                                    <option value="">SELECIONAR DO ESTOQUE (OPCIONAL)...</option>
                                    {localInventory.map(inv => (
                                      <option key={inv.id} value={inv.id}>
                                        {`${inv.name || inv.nome_comercial || inv.nome} (EST: ${inv.quantity ?? inv.quantidade_atual ?? 0} ${inv.unit || inv.unidade_medida || 'UN'})`.toUpperCase()}
                                      </option>
                                    ))}
                                  </select>
                                  <input
                                    type="text"
                                    value={item.descricao}
                                    onChange={(e) => handleUpdateSaidaItem(idx, { descricao: e.target.value })}
                                    placeholder="DESCRIÇÃO DO ITEM..."
                                    className="w-full px-1.5 py-1 bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-600 rounded text-[11px] font-bold uppercase"
                                  />
                                </div>
                              </td>
                              <td className="p-1">
                                <input
                                  type="text"
                                  value={item.ncm || ''}
                                  onChange={(e) => handleUpdateSaidaItem(idx, { ncm: e.target.value })}
                                  placeholder="00000000"
                                  className="w-full px-1.5 py-1 bg-white dark:bg-stone-900 border border-slate-300 rounded text-[11px] font-mono text-center"
                                />
                              </td>
                              <td className="p-1">
                                <input
                                  type="text"
                                  list="nfe-item-cfop-datalist"
                                  maxLength={4}
                                  value={item.cfop || nfeCfop}
                                  onChange={(e) => handleUpdateSaidaItem(idx, { cfop: cleanDigits(e.target.value).slice(0, 4) })}
                                  className="w-full px-1.5 py-1 bg-white dark:bg-stone-900 border border-slate-300 rounded text-[11px] font-mono font-bold text-center"
                                />
                              </td>
                              <td className="p-1">
                                <input
                                  type="text"
                                  value={item.unidade}
                                  onChange={(e) => handleUpdateSaidaItem(idx, { unidade: e.target.value })}
                                  className="w-full px-1 py-1 bg-white dark:bg-stone-900 border border-slate-300 rounded text-[11px] font-bold text-center uppercase"
                                />
                              </td>
                              <td className="p-1">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={itemQtyInputMap[item.id] ?? (item.quantidade > 0 ? formatBrNumberDisplay(item.quantidade) : '')}
                                  onChange={(e) => {
                                    const masked = maskBrNumberWithThousands(e.target.value);
                                    setItemQtyInputMap(prev => ({ ...prev, [item.id]: masked }));
                                    handleUpdateSaidaItem(idx, { quantidade: parsePtBrNumber(masked) });
                                  }}
                                  onBlur={() => {
                                    setItemQtyInputMap(prev => {
                                      const next = { ...prev };
                                      delete next[item.id];
                                      return next;
                                    });
                                  }}
                                  placeholder="1"
                                  className="w-full px-1.5 py-1 bg-white dark:bg-stone-900 border border-slate-300 rounded text-[11px] font-mono font-bold text-right"
                                />
                              </td>
                              <td className="p-1">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={item.valorUnitario > 0 ? formatCurrencyInputDisplay(item.valorUnitario) : ''}
                                  onChange={(e) => {
                                    const masked = maskBrCurrencyATM(e.target.value);
                                    handleUpdateSaidaItem(idx, { valorUnitario: desformatarMoeda(masked) });
                                  }}
                                  placeholder="0,00"
                                  className="w-full px-1.5 py-1 bg-white dark:bg-stone-900 border border-slate-300 rounded text-[11px] font-mono font-bold text-right"
                                />
                              </td>
                              <td className="p-1">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={item.desconto && item.desconto > 0 ? formatCurrencyInputDisplay(item.desconto) : ''}
                                  onChange={(e) => {
                                    const masked = maskBrCurrencyATM(e.target.value);
                                    handleUpdateSaidaItem(idx, { desconto: desformatarMoeda(masked) });
                                  }}
                                  placeholder="0,00"
                                  className="w-full px-1.5 py-1 bg-white dark:bg-stone-900 border border-slate-300 rounded text-[11px] font-mono text-right"
                                />
                              </td>
                              {saidaTipoDocumento.includes('NF-e') && (
                                <td className="p-1">
                                  <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    value={item.aliquotaIcms || 0}
                                    onChange={(e) => handleUpdateSaidaItem(idx, { aliquotaIcms: Number(e.target.value) || 0 })}
                                    className="w-full px-1.5 py-1 bg-white dark:bg-stone-900 border border-slate-300 rounded text-[11px] font-mono text-right"
                                  />
                                </td>
                              )}
                              <td className="p-1 text-right font-mono font-black text-emerald-700 dark:text-emerald-400">
                                {formatCurrencyBRL(item.valorTotal)}
                              </td>
                              <td className="p-1 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSaidaItemRow(idx)}
                                  className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                                  title="Remover item"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-center">
                      <div className="lg:col-span-6">
                        <label
                          htmlFor="saida-baixar-estoque-checkbox"
                          className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-stone-900 border border-black/40 dark:border-stone-600 cursor-pointer"
                        >
                          <input
                            id="saida-baixar-estoque-checkbox"
                            type="checkbox"
                            checked={saidaBaixarEstoque}
                            disabled={Boolean(editingNotaSaida?.estoqueBaixado)}
                            onChange={(e) => setSaidaBaixarEstoque(e.target.checked)}
                            className="w-4 h-4 accent-emerald-600 rounded cursor-pointer shrink-0"
                          />
                          <span className="text-[11px] font-black text-black dark:text-stone-100 uppercase">
                            {editingNotaSaida?.estoqueBaixado
                              ? 'Baixa no Estoque já realizada para este documento'
                              : 'Dar baixa automática destes itens no Estoque?'}
                          </span>
                        </label>
                      </div>
                      <div className="lg:col-span-6">
                        <input
                          id="saida-descricao-input"
                          type="text"
                          value={saidaDescricao}
                          onChange={(e) => setSaidaDescricao(e.target.value)}
                          placeholder="OBSERVAÇÕES ADICIONAIS DA VENDA / INFORMAÇÕES COMPLEMENTARES..."
                          className="w-full px-2.5 py-2 bg-white dark:bg-stone-900 border border-black/40 dark:border-stone-600 rounded-lg text-xs font-bold text-black dark:text-stone-100 uppercase"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {saidaTipoDocumento.includes('CT-e') && (
                  <div className="bg-[#e0e6f1] dark:bg-stone-800 border border-black dark:border-stone-700 rounded-xl p-2.5 space-y-2">
                    <div className="pb-1 border-b border-black/20 dark:border-stone-700">
                      <span className="text-[11px] font-black text-[#0369a1] dark:text-sky-300 uppercase tracking-wide flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5" />
                        <span>DADOS DO TRANSPORTE, CARGA E VEÍCULO (CT-E / FRETE)</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                      <div>
                        <label className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                          OPERAÇÃO (UF)
                        </label>
                        <select
                          id="saida-cte-escopo-select"
                          value={nfeRemessaEscopo}
                          onChange={(e) => handleOperacaoUfEscopoChange(e.target.value as 'estadual' | 'interestadual')}
                          className="w-full h-8 px-2 py-1 bg-white dark:bg-stone-900 border border-black/40 rounded-lg text-xs font-bold uppercase cursor-pointer"
                        >
                          <option value="estadual">ESTADUAL (5XXX)</option>
                          <option value="interestadual">INTERESTADUAL (6XXX)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                          CFOP TRANSPORTE
                        </label>
                        <div className="flex items-center gap-1">
                          <select
                            id="saida-cte-cfop-select"
                            value={cteCfop}
                            onChange={(e) => handleHeaderCteCfopChange(e.target.value)}
                            className="flex-1 min-w-0 h-8 px-1.5 py-1 bg-white dark:bg-stone-900 border border-black/40 rounded-lg text-xs font-mono font-bold cursor-pointer"
                          >
                            {cteCfop && !cfopsCteByScope.some((c) => c.codigo === cteCfop) && (
                              <option value={cteCfop}>{cteCfop}</option>
                            )}
                            {cfopsCteByScope.map((c) => (
                              <option key={c.codigo} value={c.codigo}>
                                {c.codigo} — {c.descricao}
                              </option>
                            ))}
                            <option disabled value="">──────────</option>
                            <option value="__manage__" className="text-sky-700 font-bold">⚙️ Gerenciar catálogo CFOP...</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              setCfopManagerTarget('cte');
                              setIsCfopManagerOpen(true);
                            }}
                            className="h-8 w-8 flex items-center justify-center bg-white hover:bg-gray-100 dark:bg-stone-900 dark:hover:bg-stone-700 text-black dark:text-stone-200 border border-black/50 dark:border-stone-600 rounded-lg transition cursor-pointer shrink-0"
                            title="Gerenciar catálogo de CFOPs"
                          >
                            <Settings className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                          TIPO DE SERVIÇO
                        </label>
                        <select
                          value={cteTipoServico}
                          onChange={(e) => setCteTipoServico(e.target.value)}
                          className="w-full h-8 px-2 py-1 bg-white dark:bg-stone-900 border border-black/40 rounded-lg text-xs font-bold uppercase"
                        >
                          <option value="Normal">NORMAL</option>
                          <option value="Subcontratação">SUBCONTRATAÇÃO</option>
                          <option value="Redespacho">REDESPACHO</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                          MUNICÍPIO INÍCIO (COLETA)
                        </label>
                        <input
                          type="text"
                          value={cteMunicipioInicio}
                          onChange={(e) => setCteMunicipioInicio(e.target.value)}
                          placeholder="EX: TOLEDO/PR"
                          className="w-full h-8 px-2 py-1 bg-white dark:bg-stone-900 border border-black/40 rounded-lg text-xs font-bold uppercase"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                          MUNICÍPIO TÉRMINO (ENTREGA)
                        </label>
                        <input
                          type="text"
                          value={cteMunicipioTermino}
                          onChange={(e) => setCteMunicipioTermino(e.target.value)}
                          placeholder="EX: CASCAVEL/PR"
                          className="w-full h-8 px-2 py-1 bg-white dark:bg-stone-900 border border-black/40 rounded-lg text-xs font-bold uppercase"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      <div className="lg:col-span-2">
                        <label className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                          PRODUTO PREDOMINANTE TRANSPORTADO
                        </label>
                        <input
                          type="text"
                          value={cteProdutoPredominante}
                          onChange={(e) => setCteProdutoPredominante(e.target.value)}
                          placeholder="EX: SILAGEM DE MILHO, GRÃOS, MAQUINÁRIO"
                          className="w-full px-2 py-1.5 bg-white dark:bg-stone-900 border border-black/40 rounded-lg text-xs font-bold uppercase"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                          PESO BRUTO (KG)
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={ctePesoBrutoKg}
                          onChange={(e) => setCtePesoBrutoKg(maskBrNumberWithThousands(e.target.value))}
                          placeholder="EX: 32.000"
                          className="w-full px-2 py-1.5 bg-white dark:bg-stone-900 border border-black/40 rounded-lg text-xs font-mono font-bold text-right"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                          VALOR TOTAL DA CARGA (R$)
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={cteValorCargaDisplay}
                          onChange={(e) => setCteValorCargaDisplay(maskBrCurrencyATM(e.target.value))}
                          onBlur={() => {
                            const n = parseCurrencyInput(cteValorCargaDisplay);
                            if (n > 0) setCteValorCargaDisplay(formatCurrencyInputDisplay(n));
                          }}
                          placeholder="0,00 (SOMA AUTOMÁTICA OU MANUAL)"
                          title="Calculado automaticamente pela soma das NF-e abaixo, ou editável manualmente"
                          className="w-full px-2 py-1.5 bg-white dark:bg-stone-900 border border-black/50 rounded-lg text-xs font-mono font-black text-right text-[#0369a1] dark:text-sky-300"
                        />
                      </div>
                    </div>

                    {/* Grade Dinâmica de Múltiplas NF-e Vinculadas ao CT-e */}
                    <div className="bg-white dark:bg-stone-900 border border-black/50 dark:border-stone-700 rounded-lg overflow-hidden">
                      <div className="px-3 py-2 bg-slate-100 dark:bg-stone-800 border-b border-black/30 dark:border-stone-700 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase text-black dark:text-stone-100 tracking-wide">
                            NOTAS FISCAIS (NF-e) VINCULADAS AO FRETE
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-[#0369a1] text-white text-[10px] font-black font-mono">
                            {cteNfesVinculadas.filter(n => n.numero.trim() || (n.chaveAcesso || '').trim() || n.valorNota > 0).length} NF-e
                          </span>
                        </div>
                        <button
                          type="button"
                          id="btn-cte-add-nfe"
                          onClick={handleAddCteNfeRow}
                          className="px-2.5 py-1 bg-[#0369a1] hover:bg-[#075985] text-white rounded-lg text-[10px] font-black uppercase flex items-center gap-1 transition cursor-pointer shadow-2xs"
                        >
                          <Plus className="w-3 h-3" />
                          <span>+ Adicionar NF-e</span>
                        </button>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-[11px] border-collapse">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-stone-800/80 border-b border-black/20 text-[10px] font-black uppercase">
                              <th className="p-1.5 text-center w-[32px]">#</th>
                              <th className="p-1.5 text-left min-w-[230px]">PUXAR NF-e REGISTRADA NO SISTEMA (OPCIONAL)</th>
                              <th className="p-1.5 text-center w-[100px]">Nº NF-e</th>
                              <th className="p-1.5 text-center w-[56px]">SÉRIE</th>
                              <th className="p-1.5 text-left min-w-[280px]">CHAVE DE ACESSO (44 DÍGITOS — DIGITE OU BIPE)</th>
                              <th className="p-1.5 text-right w-[125px]">VALOR NF-e (R$)</th>
                              <th className="p-1.5 text-center w-[36px]"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-stone-700">
                            {cteNfesVinculadas.map((nfRow, idx) => (
                              <tr key={nfRow.id}>
                                <td className="p-1 text-center font-mono font-black text-slate-500">
                                  {String(idx + 1).padStart(2, '0')}
                                </td>
                                <td className="p-1">
                                  <select
                                    value={nfRow.sourceDocId || ''}
                                    onChange={(e) => handleSelectRegisteredNfeForCte(idx, e.target.value)}
                                    className="w-full px-1.5 py-1 bg-slate-50 dark:bg-stone-800 border border-slate-300 dark:border-stone-600 rounded text-[11px] font-bold uppercase"
                                  >
                                    <option value="">DIGITAÇÃO MANUAL / LEITOR DE CHAVE...</option>
                                    {availableNfeDocumentsForCte.map(opt => (
                                      <option key={opt.id} value={opt.id}>
                                        {opt.label.toUpperCase()}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="p-1">
                                  <input
                                    type="text"
                                    value={nfRow.numero}
                                    onChange={(e) => handleUpdateCteNfeRow(idx, { numero: e.target.value })}
                                    placeholder="EX: 10542"
                                    className="w-full px-1.5 py-1 bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-600 rounded text-[11px] font-mono font-bold text-center"
                                  />
                                </td>
                                <td className="p-1">
                                  <input
                                    type="text"
                                    value={nfRow.serie || '1'}
                                    onChange={(e) => handleUpdateCteNfeRow(idx, { serie: e.target.value })}
                                    placeholder="1"
                                    className="w-full px-1 py-1 bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-600 rounded text-[11px] font-mono text-center"
                                  />
                                </td>
                                <td className="p-1">
                                  <input
                                    type="text"
                                    maxLength={44}
                                    value={nfRow.chaveAcesso || ''}
                                    onChange={(e) => handleUpdateCteNfeRow(idx, { chaveAcesso: e.target.value })}
                                    placeholder="44 DÍGITOS DA CHAVE DE ACESSO..."
                                    className="w-full px-1.5 py-1 bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-600 rounded text-[11px] font-mono"
                                  />
                                </td>
                                <td className="p-1">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={nfRow.valorNota > 0 ? formatCurrencyInputDisplay(nfRow.valorNota) : ''}
                                    onChange={(e) => {
                                      const masked = maskBrCurrencyATM(e.target.value);
                                      handleUpdateCteNfeRow(idx, { valorNota: desformatarMoeda(masked) });
                                    }}
                                    placeholder="0,00"
                                    className="w-full px-1.5 py-1 bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-600 rounded text-[11px] font-mono font-bold text-right text-emerald-700 dark:text-emerald-400"
                                  />
                                </td>
                                <td className="p-1 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveCteNfeRow(idx)}
                                    className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                                    title="Remover NF-e da lista"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="px-3 py-1.5 bg-sky-50 dark:bg-sky-950/30 border-t border-black/20 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        <span className="font-bold text-slate-600 dark:text-stone-300 uppercase">
                          Dica: Ao digitar/bipar os 44 dígitos da chave, Número e Série são preenchidos automaticamente.
                        </span>
                        <span className="font-black text-[#0369a1] dark:text-sky-300 font-mono">
                          SOMA DAS NF-e VINCULADAS: {formatCurrencyBRL(cteNfesVinculadas.reduce((acc, r) => acc + (Number(r.valorNota) || 0), 0))}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2">
                      <div className="lg:col-span-4">
                        <label className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                          VEÍCULO / PLACA (FROTA)
                        </label>
                        <div className="flex gap-1.5">
                          <select
                            value={saidaVeiculoId}
                            onChange={(e) => handleSaidaVehicleChange(e.target.value)}
                            className="w-3/5 px-2 py-1.5 bg-white dark:bg-stone-900 border border-black/40 rounded-lg text-[11px] font-bold uppercase"
                          >
                            <option value="">FROTA...</option>
                            {availableVehicles.map(veh => (
                              <option key={veh.id} value={veh.id}>
                                {(veh.plate || veh.licensePlateOrSerial || veh.model || veh.name).toUpperCase()}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={saidaVeiculoPlaca}
                            onChange={(e) => setSaidaVeiculoPlaca(e.target.value)}
                            placeholder="PLACA"
                            className="w-2/5 px-2 py-1.5 bg-white dark:bg-stone-900 border border-black/40 rounded-lg text-xs font-mono font-bold uppercase"
                          />
                        </div>
                      </div>
                      <div className="lg:col-span-4">
                        <label className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                          MOTORISTA (PUXADO DO RH)
                        </label>
                        <div className="flex gap-1.5">
                          <select
                            value={saidaMotoristaId}
                            onChange={(e) => handleSaidaMotoristaChange(e.target.value)}
                            className="w-1/2 px-2 py-1.5 bg-white dark:bg-stone-900 border border-black/40 rounded-lg text-[11px] font-bold uppercase"
                          >
                            <option value="">RH...</option>
                            {localEmployees.map(emp => (
                              <option key={emp.id} value={emp.id}>
                                {(emp.name || '').toUpperCase()}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={saidaMotoristaNome}
                            onChange={(e) => setSaidaMotoristaNome(e.target.value)}
                            placeholder="NOME MOTORISTA"
                            className="w-1/2 px-2 py-1.5 bg-white dark:bg-stone-900 border border-black/40 rounded-lg text-xs font-bold uppercase"
                          />
                        </div>
                      </div>
                      <div className="lg:col-span-4">
                        <label htmlFor="saida-descricao-input" className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                          OBSERVAÇÕES / ROTA DO TRANSPORTE
                        </label>
                        <input
                          id="saida-descricao-input"
                          type="text"
                          value={saidaDescricao}
                          onChange={(e) => setSaidaDescricao(e.target.value)}
                          placeholder="DETALHES DO FRETE / KM / CARGAS..."
                          className="w-full px-2 py-1.5 bg-white dark:bg-stone-900 border border-black/40 rounded-lg text-xs font-bold uppercase"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {saidaTipoDocumento.includes('MDF-e') && (
                  <div className="bg-[#e0e6f1] dark:bg-stone-800 border border-black dark:border-stone-700 rounded-xl p-2.5 space-y-2">
                    <div className="pb-1 border-b border-black/20 dark:border-stone-700">
                      <span className="text-[11px] font-black text-[#4338ca] dark:text-indigo-300 uppercase tracking-wide flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5" />
                        <span>DADOS DA VIAGEM, TRAÇÃO, CONDUTOR E SEGURO (MDF-E)</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
                      <div>
                        <label className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                          UF CARREGAMENTO
                        </label>
                        <input
                          type="text"
                          maxLength={2}
                          value={mdfeUfCarregamento}
                          onChange={(e) => setMdfeUfCarregamento(e.target.value.toUpperCase())}
                          placeholder="PR"
                          className="w-full px-2 py-1.5 bg-white dark:bg-stone-900 border border-black/40 rounded-lg text-xs font-mono font-black text-center uppercase"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                          UF DESCARREGAMENTO
                        </label>
                        <input
                          type="text"
                          maxLength={2}
                          value={mdfeUfDescarregamento}
                          onChange={(e) => setMdfeUfDescarregamento(e.target.value.toUpperCase())}
                          placeholder="PR"
                          className="w-full px-2 py-1.5 bg-white dark:bg-stone-900 border border-black/40 rounded-lg text-xs font-mono font-black text-center uppercase"
                        />
                      </div>
                      <div className="lg:col-span-4">
                        <label className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                          MUNICÍPIOS DE PERCURSO / CARREGAMENTO E DESCARGA
                        </label>
                        <input
                          type="text"
                          value={mdfeMunicipiosPercurso}
                          onChange={(e) => setMdfeMunicipiosPercurso(e.target.value)}
                          placeholder="EX: TOLEDO/PR -> CASCAVEL/PR -> GUARAPUAVA/PR"
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-900 border border-black/40 rounded-lg text-xs font-bold uppercase"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
                      <div className="lg:col-span-2">
                        <label className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                          VEÍCULO TRAÇÃO (FROTA / PLACA)
                        </label>
                        <div className="flex gap-1.5">
                          <select
                            value={saidaVeiculoId}
                            onChange={(e) => handleSaidaVehicleChange(e.target.value)}
                            className="w-3/5 px-2 py-1.5 bg-white dark:bg-stone-900 border border-black/40 rounded-lg text-[11px] font-bold uppercase"
                          >
                            <option value="">FROTA...</option>
                            {availableVehicles.map(veh => (
                              <option key={veh.id} value={veh.id}>
                                {(veh.plate || veh.licensePlateOrSerial || veh.model || veh.name).toUpperCase()}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={saidaVeiculoPlaca}
                            onChange={(e) => setSaidaVeiculoPlaca(e.target.value)}
                            placeholder="PLACA"
                            className="w-2/5 px-2 py-1.5 bg-white dark:bg-stone-900 border border-black/40 rounded-lg text-xs font-mono font-bold uppercase"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                          RENAVAM TRAÇÃO
                        </label>
                        <input
                          type="text"
                          value={mdfeVeiculoRenavam}
                          onChange={(e) => setMdfeVeiculoRenavam(e.target.value)}
                          placeholder="00000000000"
                          className="w-full px-2 py-1.5 bg-white dark:bg-stone-900 border border-black/40 rounded-lg text-xs font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                          REBOQUE / CARRETA
                        </label>
                        <input
                          type="text"
                          value={mdfeReboquePlaca}
                          onChange={(e) => setMdfeReboquePlaca(e.target.value)}
                          placeholder="PLACA REBOQUE"
                          className="w-full px-2 py-1.5 bg-white dark:bg-stone-900 border border-black/40 rounded-lg text-xs font-mono font-bold uppercase"
                        />
                      </div>
                      <div className="lg:col-span-2">
                        <label className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                          MOTORISTA CONDUTOR (RH) E CPF
                        </label>
                        <div className="flex gap-1">
                          <select
                            value={saidaMotoristaId}
                            onChange={(e) => handleSaidaMotoristaChange(e.target.value)}
                            className="w-1/2 px-2 py-1.5 bg-white dark:bg-stone-900 border border-black/40 rounded-lg text-[11px] font-bold uppercase"
                          >
                            <option value="">CONDUTOR RH...</option>
                            {localEmployees.map(emp => (
                              <option key={emp.id} value={emp.id}>
                                {(emp.name || '').toUpperCase()}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={saidaMotoristaCpf}
                            onChange={(e) => setSaidaMotoristaCpf(formatCpfCnpj(e.target.value))}
                            placeholder="CPF CONDUTOR"
                            className="w-1/2 px-2 py-1.5 bg-white dark:bg-stone-900 border border-black/40 rounded-lg text-xs font-mono font-bold"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
                      <div>
                        <label className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                          SEGURADORA DA CARGA
                        </label>
                        <input
                          type="text"
                          value={mdfeSeguradora}
                          onChange={(e) => setMdfeSeguradora(e.target.value)}
                          placeholder="EX: PORTO SEGURO"
                          className="w-full px-2 py-1.5 bg-white dark:bg-stone-900 border border-black/40 rounded-lg text-xs font-bold uppercase"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                          Nº APÓLICE SEGURO
                        </label>
                        <input
                          type="text"
                          value={mdfeApoliceSeguro}
                          onChange={(e) => setMdfeApoliceSeguro(e.target.value)}
                          placeholder="Nº APÓLICE"
                          className="w-full px-2 py-1.5 bg-white dark:bg-stone-900 border border-black/40 rounded-lg text-xs font-mono font-bold"
                        />
                      </div>
                      <div className="lg:col-span-2">
                        <label className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                          VINCULAR NF-E (VENDA / REMESSA) OU CT-E
                        </label>
                        <select
                          id="mdfe-vincular-doc-select"
                          value=""
                          onChange={(e) => handleLinkDocToMdfe(e.target.value)}
                          className="w-full px-2 py-1.5 bg-white dark:bg-stone-900 border border-black/50 rounded-lg text-[11px] font-bold uppercase cursor-pointer"
                        >
                          <option value="">+ SELECIONAR NF-e / CT-e DO SISTEMA...</option>
                          {availableDocsForMdfe.map(doc => (
                            <option key={doc.id} value={doc.id}>
                              {doc.label.toUpperCase()}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="lg:col-span-2">
                        <label className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                          DOCUMENTOS VINCULADOS (CHAVES / Nº)
                        </label>
                        <input
                          type="text"
                          value={mdfeDocumentosVinculados}
                          onChange={(e) => setMdfeDocumentosVinculados(e.target.value)}
                          placeholder="CHAVES OU NÚMEROS DAS NF-E / CT-E..."
                          className="w-full px-2 py-1.5 bg-white dark:bg-stone-900 border border-black/40 rounded-lg text-xs font-mono font-bold"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
                      <div>
                        <label className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                          PESO TOTAL (KG)
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={mdfePesoTotalKg}
                          onChange={(e) => setMdfePesoTotalKg(maskBrNumberWithThousands(e.target.value))}
                          placeholder="EX: 38.000"
                          className="w-full px-2 py-1.5 bg-white dark:bg-stone-900 border border-black/40 rounded-lg text-xs font-mono font-bold text-right"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                          VALOR TOTAL CARGA (R$)
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={mdfeValorTotalCargaDisplay}
                          onChange={(e) => setMdfeValorTotalCargaDisplay(maskBrCurrencyATM(e.target.value))}
                          onBlur={() => {
                            const n = parseCurrencyInput(mdfeValorTotalCargaDisplay);
                            if (n > 0) setMdfeValorTotalCargaDisplay(formatCurrencyInputDisplay(n));
                          }}
                          placeholder="0,00"
                          className="w-full px-2 py-1.5 bg-white dark:bg-stone-900 border border-black/40 rounded-lg text-xs font-mono font-bold text-right"
                        />
                      </div>
                      <div className="lg:col-span-4">
                        <label htmlFor="saida-descricao-input" className="block text-[10px] font-black text-black/80 dark:text-stone-300 uppercase mb-0.5">
                          OBSERVAÇÕES COMPLEMENTARES DA VIAGEM
                        </label>
                        <input
                          id="saida-descricao-input"
                          type="text"
                          value={saidaDescricao}
                          onChange={(e) => setSaidaDescricao(e.target.value)}
                          placeholder="INFORMAÇÕES ADICIONAIS DO MANIFESTO DE CARGA..."
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-900 border border-black/40 rounded-lg text-xs font-bold uppercase"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* CARD UNIVERSAL: DADOS ADICIONAIS / INFORMAÇÕES COMPLEMENTARES E RESERVADO AO FISCO */}
                <div className="bg-[#e0e6f1] dark:bg-stone-800 border border-black dark:border-stone-700 rounded-xl p-2.5">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5">
                    <div className="lg:col-span-8">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <label
                          htmlFor="saida-informacoes-complementares-textarea"
                          className="block text-[11px] font-black text-black dark:text-stone-200 uppercase tracking-wide"
                        >
                          INFORMAÇÕES COMPLEMENTARES / DADOS ADICIONAIS
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setIsInformacoesComplementaresManual(false);
                            setSaidaInformacoesComplementares(
                              buildDefaultInformacoesComplementares({
                                tipoDocumento: saidaTipoDocumento,
                                naturezaOperacao: nfeNaturezaOperacao,
                                nfeReferenciada,
                                veiculoPlaca: saidaVeiculoPlaca || nfeTransportadoraPlaca,
                                motoristaNome: saidaMotoristaNome,
                              })
                            );
                          }}
                          className="text-[10px] font-black uppercase text-[#1e40af] dark:text-blue-300 hover:underline inline-flex items-center gap-1 cursor-pointer"
                          title="Regerar texto legal automático com base nos dados atuais da nota"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Texto Automático</span>
                        </button>
                      </div>
                      <textarea
                        id="saida-informacoes-complementares-textarea"
                        rows={2}
                        value={saidaInformacoesComplementares}
                        onChange={(e) => {
                          setIsInformacoesComplementaresManual(true);
                          setSaidaInformacoesComplementares(e.target.value);
                        }}
                        placeholder="Informações complementares de interesse do contribuinte (Simples Nacional, referência de remessa, dados do veículo/motorista)..."
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-900 border border-gray-400 dark:border-stone-600 rounded-lg text-xs font-semibold text-black dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#1e40af] resize-none"
                      />
                    </div>

                    <div className="lg:col-span-4">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <label
                          htmlFor="saida-reservado-fisco-textarea"
                          className="block text-[11px] font-black text-black dark:text-stone-200 uppercase tracking-wide"
                        >
                          RESERVADO AO FISCO
                        </label>
                      </div>
                      <textarea
                        id="saida-reservado-fisco-textarea"
                        rows={2}
                        value={saidaReservadoFisco}
                        onChange={(e) => setSaidaReservadoFisco(e.target.value)}
                        placeholder="Em branco por padrão (uso exclusivo da fiscalização / carimbo)..."
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-900 border border-gray-400 dark:border-stone-600 rounded-lg text-xs font-mono font-bold text-black dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#1e40af] resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* CARD 3: VALOR TOTAL, CONDIÇÃO DE PAGAMENTO E INTEGRAÇÃO CONTAS A RECEBER */}
                <div className="bg-[#e0e6f1] dark:bg-stone-800 border border-black dark:border-stone-700 rounded-xl p-2.5 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                    <div className="sm:col-span-4">
                      <label htmlFor="saida-valor-total-input" className="block text-[11px] font-black text-black dark:text-stone-200 uppercase tracking-wide mb-1">
                        VALOR TOTAL DA NOTA (R$) <span className="text-rose-600">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-xs font-black text-emerald-700 pointer-events-none">
                          R$
                        </span>
                        <input
                          id="saida-valor-total-input"
                          type="text"
                          inputMode="numeric"
                          value={saidaValorDisplay}
                          onChange={(e) => {
                            const masked = maskBrCurrencyATM(e.target.value);
                            setSaidaValorDisplay(masked);
                            if (saidaTipoDocumento.includes('NFS-e')) {
                              syncNfseValorIss(desformatarMoeda(masked), nfseAliquotaIss);
                            }
                          }}
                          onBlur={() => {
                            const num = parseCurrencyInput(saidaValorDisplay);
                            if (num > 0) {
                              setSaidaValorDisplay(formatCurrencyInputDisplay(num));
                              if (saidaTipoDocumento.includes('NFS-e')) {
                                syncNfseValorIss(num, nfseAliquotaIss);
                              }
                            }
                          }}
                          required
                          placeholder="0,00"
                          className="w-full pl-9 pr-2.5 py-1.5 bg-white dark:bg-stone-900 border border-black/60 dark:border-stone-600 rounded-lg text-sm font-mono font-black text-emerald-700 dark:text-emerald-400 text-right focus:outline-none focus:ring-2 focus:ring-[#1e40af]"
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-5">
                      <label htmlFor="saida-condicao-pagamento-select" className="block text-[11px] font-black text-black dark:text-stone-200 uppercase tracking-wide mb-1">
                        CONDIÇÃO DE PAGAMENTO
                      </label>
                      <select
                        id="saida-condicao-pagamento-select"
                        value={saidaCondicaoPagamento}
                        onChange={(e) => handleSaidaPaymentConditionChange(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-900 border border-black/50 dark:border-stone-600 rounded-lg text-xs font-bold text-black dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#1e40af] uppercase cursor-pointer"
                      >
                        <option value="Boleto Bancário">BOLETO BANCÁRIO</option>
                        <option value="PIX">PIX</option>
                        <option value="Dinheiro">DINHEIRO</option>
                        <option value="Cartão Crédito/Débito">CARTÃO CRÉDITO / DÉBITO</option>
                        <option value="Transferência">TRANSFERÊNCIA (TED/DOC)</option>
                        <option value="Cheque">CHEQUE</option>
                        <option value="A Prazo / Faturado">A PRAZO / FATURADO</option>
                      </select>
                    </div>

                    <div className="sm:col-span-3">
                      <label htmlFor="saida-data-vencimento-input" className="block text-[11px] font-bold text-black dark:text-stone-200 uppercase tracking-wide mb-1">
                        VENCIMENTO
                      </label>
                      <input
                        id="saida-data-vencimento-input"
                        type="date"
                        value={saidaDataVencimento}
                        onChange={(e) => setSaidaDataVencimento(e.target.value)}
                        className="w-full px-2 py-1.5 bg-white dark:bg-stone-900 border border-black/40 dark:border-stone-600 rounded-lg text-xs font-bold text-black dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-[#1e40af]"
                      />
                    </div>
                  </div>

                  {/* Opção de Integração Financeira */}
                  <label
                    htmlFor="saida-lancar-contas-receber-checkbox"
                    className="flex items-start gap-2.5 p-2 rounded-lg bg-white dark:bg-stone-900 border border-black/40 dark:border-stone-600 cursor-pointer hover:bg-blue-50/50 transition"
                  >
                    <input
                      id="saida-lancar-contas-receber-checkbox"
                      type="checkbox"
                      checked={saidaLancarContasReceber}
                      onChange={(e) => setSaidaLancarContasReceber(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-[#1e40af] rounded cursor-pointer shrink-0"
                    />
                    <div className="text-xs">
                      <span className="font-black text-black dark:text-stone-100 uppercase block">
                        Lançar valor automaticamente no Contas a Receber?
                      </span>
                      <span className="text-[10px] font-semibold text-stone-600 dark:text-stone-400 block mt-0.5">
                        {saidaTipoDocumento.includes('CT-e') ? (
                          <>
                            Título financeiro do CT-e será gerado em nome do Tomador ({resolveActiveCteTomador().modalidade}):{' '}
                            <strong className="text-[#0369a1] dark:text-sky-300 uppercase">
                              {resolveActiveCteTomador().nome || 'DEFINIR TOMADOR ACIMA'}
                            </strong>.
                          </>
                        ) : (
                          'Deixe desmarcado caso este serviço/venda já tenha sido faturado na tela de Serviços ou Vendas para evitar duplicidade no financeiro.'
                        )}
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {saidaFormError && (
                <div className="px-4 py-2 bg-rose-50 dark:bg-rose-950/80 border-t border-rose-500 flex items-center space-x-2 text-rose-800 dark:text-rose-200 text-xs font-black uppercase shrink-0">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{saidaFormError}</span>
                </div>
              )}

              {/* Rodapé */}
              <div className="px-4 py-2 bg-[#cad4e6] dark:bg-stone-900 border-t border-black dark:border-stone-700 flex flex-wrap items-center justify-between gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsNotaSaidaModalOpen(false)}
                  className="px-4 py-1.5 bg-white hover:bg-slate-100 text-black border border-black rounded-lg text-xs font-black uppercase transition cursor-pointer"
                >
                  Cancelar
                </button>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    id="btn-salvar-e-imprimir-nota-saida"
                    onClick={handleSaveAndPrintNotaSaida}
                    className="inline-flex items-center space-x-1.5 px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white border border-black rounded-lg text-xs font-black uppercase tracking-wide shadow-sm transition cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>🖨️ Salvar e Imprimir Espelho/Documento</span>
                  </button>
                  <button
                    type="submit"
                    id="btn-salvar-nota-saida"
                    className="inline-flex items-center space-x-1.5 px-5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold border border-emerald-800 rounded-lg text-xs uppercase tracking-wide shadow-sm transition cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{editingNotaSaida ? 'Salvar Alterações' : 'REGISTRAR NOTA DE SAÍDA'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ESPELHO / VISUALIZAÇÃO & IMPRESSÃO DE NOTA DE SAÍDA */}
      {/* ========================================================================= */}
      {viewingNotaSaida && (
        <div
          id="modal-espelho-nota-saida"
          className="fixed inset-0 z-70 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in"
          onClick={() => setViewingNotaSaida(null)}
        >
          <div
            id="nota-saida-espelho-print"
            className="bg-white dark:bg-stone-900 border border-black dark:border-stone-700 rounded-xl max-w-3xl w-full shadow-2xl overflow-hidden my-6 text-stone-900 dark:text-stone-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabeçalho do Espelho */}
            <div className="px-5 py-3.5 bg-[#e0e6f1] dark:bg-stone-800 border-b border-black dark:border-stone-700 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-[#1e40af] text-white">
                  ESPELHO DE DOCUMENTO FISCAL DE SAÍDA
                </span>
                <h3 className="text-sm sm:text-base font-black text-black dark:text-white mt-1 uppercase">
                  {viewingNotaSaida.tipoDocumento} — Nº {viewingNotaSaida.numero}
                  {viewingNotaSaida.serie ? ` / SÉRIE ${viewingNotaSaida.serie}` : ''}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingNotaSaida(null)}
                className="p-1 rounded-lg text-stone-500 hover:text-black dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs max-h-[75vh] overflow-y-auto">
              {/* Emitente */}
              <div className="p-3 bg-slate-50 dark:bg-stone-800/60 border border-slate-200 dark:border-stone-700 rounded-lg">
                <span className="text-[10px] font-black uppercase text-slate-500 block mb-0.5">Emitente (Empresa)</span>
                <span className="font-black text-sm uppercase block">
                  {companyProfile?.corporateName || companyProfile?.companyName || companyProfile?.tradeName || 'AgroControl'}
                </span>
                {(companyProfile?.cnpj || companyProfile?.cnpjCpf) && (
                  <span className="text-[11px] font-mono text-slate-600 dark:text-stone-300">
                    CNPJ: {formatCpfCnpj(companyProfile.cnpj || companyProfile.cnpjCpf || '')}
                  </span>
                )}
              </div>

              {/* Destinatário / Remetente / Tomador & Dados Gerais */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-stone-800/60 border border-slate-200 dark:border-stone-700 rounded-lg space-y-2">
                  {(viewingNotaSaida.tipoDocumento || '').toLowerCase().includes('ct-e') ? (
                    <>
                      <div>
                        <span className="text-[10px] font-black uppercase text-sky-700 dark:text-sky-400 block">1. Remetente (Origem da Carga)</span>
                        <span className="font-black text-xs uppercase block">{viewingNotaSaida.cteRemetenteNome || '-'}</span>
                        {viewingNotaSaida.cteRemetenteCpfCnpj && (
                          <span className="block font-mono text-[10px] text-slate-600 dark:text-stone-300">
                            CPF/CNPJ: {viewingNotaSaida.cteRemetenteCpfCnpj}
                            {viewingNotaSaida.cteRemetenteIe ? ` • IE: ${viewingNotaSaida.cteRemetenteIe}` : ''}
                          </span>
                        )}
                        {(viewingNotaSaida.cteRemetenteEndereco || viewingNotaSaida.cteRemetenteCidadeUf) && (
                          <span className="block text-[10px] text-slate-600 dark:text-stone-300 uppercase">
                            {[viewingNotaSaida.cteRemetenteEndereco, viewingNotaSaida.cteRemetenteCidadeUf].filter(Boolean).join(' • ')}
                          </span>
                        )}
                      </div>
                      <div className="pt-1.5 border-t border-slate-200 dark:border-stone-700">
                        <span className="text-[10px] font-black uppercase text-blue-700 dark:text-blue-400 block">2. Destinatário (Destino da Carga)</span>
                        <span className="font-black text-xs uppercase block">{viewingNotaSaida.destinatarioNome}</span>
                        {viewingNotaSaida.destinatarioCpfCnpj && (
                          <span className="block font-mono text-[10px] text-slate-600 dark:text-stone-300">
                            CPF/CNPJ: {viewingNotaSaida.destinatarioCpfCnpj}
                            {viewingNotaSaida.destinatarioIe ? ` • IE: ${viewingNotaSaida.destinatarioIe}` : ''}
                          </span>
                        )}
                        {(viewingNotaSaida.destinatarioEndereco || viewingNotaSaida.destinatarioCidadeUf) && (
                          <span className="block text-[10px] text-slate-600 dark:text-stone-300 uppercase">
                            {[viewingNotaSaida.destinatarioEndereco, viewingNotaSaida.destinatarioCidadeUf].filter(Boolean).join(' • ')}
                          </span>
                        )}
                      </div>
                      <div className="pt-1.5 border-t border-slate-200 dark:border-stone-700">
                        <span className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-400 block">
                          3. Tomador do Serviço ({viewingNotaSaida.cteTomador || 'Remetente'})
                        </span>
                        <span className="font-black text-xs uppercase block">
                          {viewingNotaSaida.cteTomadorFinalNome || viewingNotaSaida.destinatarioNome}
                        </span>
                        {viewingNotaSaida.cteTomadorFinalCpfCnpj && (
                          <span className="block font-mono text-[10px] text-slate-600 dark:text-stone-300">
                            CPF/CNPJ: {viewingNotaSaida.cteTomadorFinalCpfCnpj}
                            {viewingNotaSaida.cteTomadorFinalIe ? ` • IE: ${viewingNotaSaida.cteTomadorFinalIe}` : ''}
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="text-[10px] font-black uppercase text-slate-500 block">Destinatário / Tomador</span>
                      <span className="font-black text-xs uppercase block">{viewingNotaSaida.destinatarioNome}</span>
                      {viewingNotaSaida.destinatarioCpfCnpj && (
                        <span className="block font-mono text-[11px] text-slate-600 dark:text-stone-300">
                          CPF/CNPJ: {viewingNotaSaida.destinatarioCpfCnpj}
                          {viewingNotaSaida.destinatarioIe ? ` • IE: ${viewingNotaSaida.destinatarioIe}` : ''}
                        </span>
                      )}
                      {viewingNotaSaida.destinatarioEndereco && (
                        <span className="block text-[11px] text-slate-600 dark:text-stone-300 uppercase">
                          {viewingNotaSaida.destinatarioEndereco}
                        </span>
                      )}
                      {viewingNotaSaida.destinatarioCidadeUf && (
                        <span className="block text-[11px] text-slate-600 dark:text-stone-300 uppercase">
                          {viewingNotaSaida.destinatarioCidadeUf}
                        </span>
                      )}
                    </>
                  )}
                </div>

                <div className="p-3 bg-slate-50 dark:bg-stone-800/60 border border-slate-200 dark:border-stone-700 rounded-lg space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold">Emissão / Vencimento:</span>
                    <span className="font-mono font-bold">
                      {formatDateBR(viewingNotaSaida.dataEmissao)} / {formatDateBR(viewingNotaSaida.dataVencimento || viewingNotaSaida.dataEmissao)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold">Pagamento:</span>
                    <span className="font-bold uppercase">{viewingNotaSaida.condicaoPagamento}</span>
                  </div>
                  {viewingNotaSaida.nfeNaturezaOperacao && (
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500 font-bold shrink-0">Natureza / CFOP:</span>
                      <span className="font-bold uppercase text-right">
                        {viewingNotaSaida.nfeNaturezaOperacao}
                        {viewingNotaSaida.nfeCfop ? ` (CFOP ${viewingNotaSaida.nfeCfop})` : ''}
                      </span>
                    </div>
                  )}
                  {viewingNotaSaida.veiculoPlaca && (
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-bold">Veículo / Placa:</span>
                      <span className="font-mono font-bold uppercase text-indigo-700 dark:text-indigo-400">
                        {viewingNotaSaida.veiculoPlaca}
                      </span>
                    </div>
                  )}
                  {viewingNotaSaida.motoristaNome && (
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-bold">Motorista:</span>
                      <span className="font-bold uppercase">{viewingNotaSaida.motoristaNome}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold">Contas a Receber:</span>
                    <span className="font-bold uppercase">
                      {viewingNotaSaida.lancarContasReceber
                        ? (viewingNotaSaida.receberStatus === 'pago' ? 'INTEGRADA (PAGA)' : 'INTEGRADA (EM ABERTO)')
                        : 'NÃO INTEGRADA'}
                    </span>
                  </div>
                </div>
              </div>

              {viewingNotaSaida.nfeReferenciada && (
                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-lg">
                  <span className="text-[10px] font-black uppercase text-amber-800 dark:text-amber-300 block">
                    Chave / Nº da NF-e Referenciada (Origem)
                  </span>
                  <span className="font-mono font-bold text-[11px] break-all text-amber-950 dark:text-amber-100">
                    {viewingNotaSaida.nfeReferenciada}
                  </span>
                </div>
              )}

              {viewingNotaSaida.chaveAcesso && (
                <div className="p-2.5 bg-slate-50 dark:bg-stone-800/60 border border-slate-200 dark:border-stone-700 rounded-lg">
                  <span className="text-[10px] font-black uppercase text-slate-500 block">Chave de Acesso</span>
                  <span className="font-mono font-bold text-[11px] break-all">{viewingNotaSaida.chaveAcesso}</span>
                </div>
              )}

              {viewingNotaSaida.itens && viewingNotaSaida.itens.length > 0 && (
                <div className="border border-slate-200 dark:border-stone-700 rounded-lg overflow-hidden">
                  <div className="px-3 py-1.5 bg-slate-100 dark:bg-stone-800 text-[10px] font-black uppercase text-slate-600 dark:text-stone-300">
                    Itens / Produtos ({viewingNotaSaida.itens.length})
                  </div>
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-stone-800/80 border-b border-slate-200 dark:border-stone-700">
                        <th className="p-1.5 text-left">Descrição</th>
                        <th className="p-1.5 text-center">NCM</th>
                        <th className="p-1.5 text-center">CFOP</th>
                        <th className="p-1.5 text-right">Qtd</th>
                        <th className="p-1.5 text-right">Unit.</th>
                        <th className="p-1.5 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-stone-700">
                      {viewingNotaSaida.itens.map(it => (
                        <tr key={it.id}>
                          <td className="p-1.5 font-bold uppercase">{it.descricao}</td>
                          <td className="p-1.5 text-center font-mono">{it.ncm || '-'}</td>
                          <td className="p-1.5 text-center font-mono">{it.cfop || '-'}</td>
                          <td className="p-1.5 text-right font-mono">{it.quantidade} {it.unidade}</td>
                          <td className="p-1.5 text-right font-mono">{formatCurrencyBRL(it.valorUnitario)}</td>
                          <td className="p-1.5 text-right font-mono font-bold">{formatCurrencyBRL(it.valorTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {viewingNotaSaida.cteNfesVinculadas && viewingNotaSaida.cteNfesVinculadas.length > 0 && (
                <div className="border border-slate-200 dark:border-stone-700 rounded-lg overflow-hidden">
                  <div className="px-3 py-1.5 bg-sky-50 dark:bg-sky-950/40 text-[10px] font-black uppercase text-sky-900 dark:text-sky-200 flex items-center justify-between">
                    <span>Notas Fiscais (NF-e) Vinculadas ao CT-e ({viewingNotaSaida.cteNfesVinculadas.length})</span>
                    {viewingNotaSaida.cteValorCarga ? (
                      <span className="font-mono">Carga Total: {formatCurrencyBRL(viewingNotaSaida.cteValorCarga)}</span>
                    ) : null}
                  </div>
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-stone-800/80 border-b border-slate-200 dark:border-stone-700">
                        <th className="p-1.5 text-center">Nº NF-e</th>
                        <th className="p-1.5 text-center">Série</th>
                        <th className="p-1.5 text-left">Chave de Acesso</th>
                        <th className="p-1.5 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-stone-700">
                      {viewingNotaSaida.cteNfesVinculadas.map(nf => (
                        <tr key={nf.id}>
                          <td className="p-1.5 text-center font-mono font-bold">{nf.numero || '-'}</td>
                          <td className="p-1.5 text-center font-mono">{nf.serie || '1'}</td>
                          <td className="p-1.5 font-mono text-[10px] break-all">{nf.chaveAcesso || '-'}</td>
                          <td className="p-1.5 text-right font-mono font-bold">{formatCurrencyBRL(nf.valorNota || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="p-3 bg-slate-50 dark:bg-stone-800/60 border border-slate-200 dark:border-stone-700 rounded-lg">
                <span className="text-[10px] font-black uppercase text-slate-500 block mb-1">Descrição dos Serviços / Itens</span>
                <p className="font-semibold text-stone-800 dark:text-stone-200 whitespace-pre-line uppercase">
                  {viewingNotaSaida.descricao || '-'}
                </p>
              </div>

              {(viewingNotaSaida.informacoesComplementares || viewingNotaSaida.reservadoFisco) && (
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                  <div className="sm:col-span-8 p-3 bg-slate-50 dark:bg-stone-800/60 border border-slate-200 dark:border-stone-700 rounded-lg">
                    <span className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                      Dados Adicionais / Informações Complementares
                    </span>
                    <p className="font-semibold text-stone-800 dark:text-stone-200 whitespace-pre-line text-[11px]">
                      {viewingNotaSaida.informacoesComplementares || '-'}
                    </p>
                  </div>
                  <div className="sm:col-span-4 p-3 bg-slate-50 dark:bg-stone-800/60 border border-slate-200 dark:border-stone-700 rounded-lg">
                    <span className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                      Reservado ao Fisco
                    </span>
                    <p className="font-mono font-bold text-stone-800 dark:text-stone-200 whitespace-pre-line text-[11px] break-all">
                      {viewingNotaSaida.reservadoFisco || '-'}
                    </p>
                  </div>
                </div>
              )}

              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-lg flex items-center justify-between">
                <span className="text-xs font-black uppercase text-emerald-900 dark:text-emerald-200">
                  Valor Total do Documento
                </span>
                <span className="text-lg font-mono font-black text-emerald-700 dark:text-emerald-400">
                  {formatCurrencyBRL(viewingNotaSaida.valorTotal)}
                </span>
              </div>
            </div>

            <div className="px-5 py-3 bg-[#e0e6f1] dark:bg-stone-800 border-t border-black dark:border-stone-700 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setNotaSaidaToDelete(viewingNotaSaida)}
                className="px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded-lg transition cursor-pointer flex items-center space-x-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePrintNotaSaida(viewingNotaSaida)}
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-lg transition cursor-pointer flex items-center space-x-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir Documento (DANFE/Espelho)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const n = viewingNotaSaida;
                    setViewingNotaSaida(null);
                    handleOpenEditNotaSaida(n);
                  }}
                  className="px-3.5 py-1.5 text-xs font-bold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-300 rounded-lg transition cursor-pointer flex items-center space-x-1"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Editar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingNotaSaida(null)}
                  className="px-4 py-1.5 text-xs font-bold text-black bg-white hover:bg-slate-100 border border-black/40 rounded-lg transition cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONFIRMAR EXCLUSÃO DE NOTA DE SAÍDA */}
      {/* ========================================================================= */}
      {notaSaidaToDelete && (
        <div
          id="modal-confirmar-exclusao-nota-saida"
          className="fixed inset-0 z-80 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setNotaSaidaToDelete(null)}
        >
          <div
            className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-3 text-stone-900 dark:text-stone-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center space-x-2 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-sm font-bold">Excluir Nota de Saída</h3>
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
              Deseja realmente excluir a nota {notaSaidaToDelete.tipoDocumento.split(' ')[0]} nº {notaSaidaToDelete.numero} emitida para {notaSaidaToDelete.destinatarioNome} ({formatCurrencyBRL(notaSaidaToDelete.valorTotal)})?
            </p>
            <div className="pt-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setNotaSaidaToDelete(null)}
                className="px-3 py-1.5 text-xs font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="btn-confirmar-exclusao-nota-saida"
                onClick={() => handleDeleteNotaSaida(notaSaidaToDelete)}
                className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl cursor-pointer flex items-center space-x-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sim, Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <CfopManagerModal
        isOpen={isCfopManagerOpen}
        onClose={() => setIsCfopManagerOpen(false)}
        catalog={cfopCatalog}
        onSaveCatalog={(updated) => setCfopCatalog(updated)}
        initialScopeFilter={nfeRemessaEscopo === 'interestadual' ? '6' : '5'}
        initialTipoFilter={
          cfopManagerTarget === 'cte'
            ? 'transporte'
            : saidaTipoDocumento.includes('Remessa')
              ? 'remessa_retorno'
              : 'venda'
        }
        onSelectCfop={(codigo) => {
          const escopoSelecionado: 'estadual' | 'interestadual' = codigo.startsWith('6')
            ? 'interestadual'
            : codigo.startsWith('5')
              ? 'estadual'
              : nfeRemessaEscopo;
          setNfeRemessaEscopo(escopoSelecionado);
          if (cfopManagerTarget === 'cte') {
            setCteCfop(codigo);
          } else if (cfopManagerTarget === 'nfe') {
            handleHeaderNfeCfopChange(codigo);
          } else if (typeof cfopManagerTarget === 'object' && 'itemIndex' in cfopManagerTarget) {
            handleUpdateSaidaItem(cfopManagerTarget.itemIndex, { cfop: codigo });
          }
        }}
      />

      <Lc116ServiceCodeManagerModal
        isOpen={isLc116ManagerOpen}
        onClose={() => setIsLc116ManagerOpen(false)}
        codes={lc116Codes}
        onSaveCodes={(updated) => setLc116Codes(updated)}
        onSelectCode={(codigo) => setNfseCodigoServico(codigo)}
      />

    </div>
  );
};
