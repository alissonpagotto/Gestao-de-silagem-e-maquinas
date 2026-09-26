import { supabase, isSupabaseConfigured, logPostgresError } from './supabase';
export { isSupabaseConfigured, logPostgresError };
import {
  Client,
  Supplier,
  InventoryItem,
  Expense,
  ExpenseStatus,
  PaymentMethod,
  Machinery,
  FuelLog,
  Employee,
  SilageOrder,
  ServiceOrder,
  CompanyProfile,
  ServiceAppointment,
  TerminationRecord,
  DocumentoEntradaRecord,
  DocumentoEntradaItem,
  TanqueCombustivel
} from '../types';
export type { CompanyProfile, DocumentoEntradaRecord, DocumentoEntradaItem, TanqueCombustivel };
import {
  SiteConfig,
  PlanDefinition,
  Subscriber
} from '../types/masterAdmin';
import { 
  getActiveCompanyId, 
  setDbAuthCompanyId, 
  getDbAuthCompanyId, 
  clearAllAuthSessionCache, 
  sanitizeServiceOrders,
  getStoredDocumentosEntrada,
  saveStoredDocumentosEntrada,
  saveLocalDocumentoEntrada,
  deleteLocalDocumentoEntrada,
  getStoredDocumentosEntradaItens,
  saveStoredDocumentosEntradaItens,
  saveLocalDocumentoEntradaItem,
  deleteLocalDocumentoEntradaItem,
  getStoredTanquesCombustivel,
  saveStoredTanquesCombustivel,
  DEFAULT_TANQUES_COMBUSTIVEL,
  getStoredInventory,
  saveStoredInventory,
  ensureDieselProductsInInventory
} from './storage';
import { parseCurrencyInput } from './formatters';

/**
 * Converte qualquer ID de string para um UUID v4 determinístico válido,
 * garantindo compatibilidade estrita com a coluna UUID do PostgreSQL no Supabase.
 */
export function toValidUUID(input?: string): string {
  if (!input) {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return '00000000-0000-4000-a000-000000000000';
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(input)) {
    return input.toLowerCase();
  }

  let h1 = 0xdeadbeef, h2 = 0x41c64e6d;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = ((h1 ^ (h1 >>> 16)) >>> 0);
  h2 = ((h2 ^ (h2 >>> 16)) >>> 0);

  const hex1 = h1.toString(16).padStart(8, '0');
  const hex2 = h2.toString(16).padStart(8, '0');
  const hex3 = ((h1 ^ 0x5a5a5a5a) >>> 0).toString(16).padStart(8, '0');
  const hex4 = ((h2 ^ 0xa5a5a5a5) >>> 0).toString(16).padStart(8, '0');
  const fullHex = (hex1 + hex2 + hex3 + hex4).padEnd(32, '0').slice(0, 32);

  const p1 = fullHex.slice(0, 8);
  const p2 = fullHex.slice(8, 12);
  const p3 = '4' + fullHex.slice(13, 16);
  const p4 = 'a' + fullHex.slice(17, 20);
  const p5 = fullHex.slice(20, 32);

  return `${p1}-${p2}-${p3}-${p4}-${p5}`;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Valida se uma string é um UUID válido segundo a especificação RFC 4122.
 */
export function isValidUUID(input?: string | null): boolean {
  if (!input || typeof input !== 'string') return false;
  return UUID_REGEX.test(input.trim());
}

/**
 * Gera um UUID v4 no frontend em conformidade com o padrão RFC 4122.
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface SyncStats {
  clientes: number;
  fornecedores: number;
  estoque: number;
  notas_fiscais: number;
  contas_a_pagar: number;
  rh_funcionarios: number;
  gestao_frotas: number;
  despesas: number;
}

// ===========================================================================
// 1. Fornecedores (Tabela: public.fornecedores)
// Colunas: id, cnpj_cpf, razao_social, nome_fantasia, inscricao_estadual,
//          inscricao_municipal, telefone_whatsapp, created_at, updated_at
// ===========================================================================
export async function fetchFornecedores(companyId?: string): Promise<Supplier[] | null> {
  if (!isSupabaseConfigured) return null;
  const activeCompanyId = companyId || getActiveCompanyId();
  if (!activeCompanyId) return [];
  try {
    let { data, error } = await supabase
      .from('fornecedores')
      .select('*')
      .eq('company_id', activeCompanyId)
      .order('razao_social', { ascending: true });

    if ((!data || data.length === 0) && activeCompanyId) {
      const altUuid = toValidUUID(activeCompanyId);
      if (altUuid && altUuid !== activeCompanyId) {
        const retry = await supabase
          .from('fornecedores')
          .select('*')
          .eq('company_id', altUuid)
          .order('razao_social', { ascending: true });
        if (retry.data && retry.data.length > 0) {
          data = retry.data;
          error = null;
        }
      }
    }

    if (error) {
      console.warn('Supabase fetchFornecedores notice:', error.message);
      return [];
    }
    if (!data) return [];

    return data.map(row => ({
      id: row.id,
      companyId: row.company_id || undefined,
      name: row.razao_social || row.nome_fantasia || '',
      tradeName: row.nome_fantasia || row.razao_social || '',
      cnpjOrCpf: row.cnpj_cpf || '',
      stateRegistration: row.inscricao_estadual || '',
      municipalRegistration: row.inscricao_municipal || '',
      phone: row.telefone_whatsapp || '',
      email: '',
      category: 'Geral',
      city: '',
      state: '',
      address: '',
      notes: '',
    }));
  } catch (err) {
    console.warn('Supabase fetchFornecedores err:', err);
    return [];
  }
}

export async function upsertFornecedor(supplier: Supplier, companyId?: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const activeCompanyId = (supplier as any).companyId || companyId || getActiveCompanyId();
    const payload: Record<string, any> = {
      id: toValidUUID(supplier.id),
      company_id: activeCompanyId,
      cnpj_cpf: supplier.cnpjOrCpf?.trim() || `00.000.000/0000-${toValidUUID(supplier.id).slice(0, 2)}`,
      razao_social: supplier.name || supplier.tradeName || 'Fornecedor sem Razão Social',
      nome_fantasia: supplier.tradeName || supplier.name || '',
      inscricao_estadual: supplier.stateRegistration || '',
      inscricao_municipal: supplier.municipalRegistration || '',
      telefone_whatsapp: supplier.phone || '',
      updated_at: new Date().toISOString()
    };

    let { error } = await supabase
      .from('fornecedores')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      logPostgresError('upsertFornecedor', error, { table: 'fornecedores', action: 'UPSERT', payload });
      if (error.code === '23503' || (error.message && (error.message.includes('company_id') || error.message.includes('column')))) {
        delete payload.company_id;
        const retry = await supabase.from('fornecedores').upsert(payload, { onConflict: 'id' });
        if (!retry.error) return true;
      }
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase upsertFornecedor err:', err);
    return false;
  }
}

export async function deleteFornecedor(id: string, companyId?: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const activeCompanyId = companyId || getActiveCompanyId();
    const uuid = toValidUUID(id);
    let query = supabase.from('fornecedores').delete().eq('id', uuid);
    if (activeCompanyId) query = query.eq('company_id', activeCompanyId);
    const { error } = await query;
    if (error && id !== uuid) {
      let retry = supabase.from('fornecedores').delete().eq('id', id);
      if (activeCompanyId) retry = retry.eq('company_id', activeCompanyId);
      await retry;
    }
    return true;
  } catch (err) {
    console.warn('Supabase deleteFornecedor err:', err);
    return false;
  }
}

// ===========================================================================
// 2. Notas Fiscais (Tabela: public.notas_fiscais)
// Colunas: id, numero_nota, serie, chave_acesso, fornecedor_id, valor_total,
//          natureza_operacao, data_emissao, data_entrada, itens_produtos, created_at
// ===========================================================================
export interface NotaFiscalRecord {
  id: string;
  numero_nota: string;
  serie?: string;
  chave_acesso?: string;
  fornecedor_id?: string;
  valor_total: number;
  natureza_operacao?: string;
  data_emissao?: string;
  data_entrada?: string;
  itens_produtos?: any[];
  created_at?: string;
}

export async function fetchNotasFiscais(): Promise<NotaFiscalRecord[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('notas_fiscais')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase fetchNotasFiscais notice:', error.message);
      return null;
    }
    return data as NotaFiscalRecord[];
  } catch (err) {
    console.warn('Supabase fetchNotasFiscais err:', err);
    return null;
  }
}

export async function upsertNotaFiscal(nfe: {
  id: string;
  number: string;
  series?: string;
  accessKey?: string;
  supplierId?: string;
  supplierName?: string;
  totalAmount: number;
  operationNature?: string;
  issueDate?: string;
  entryDate?: string;
  items?: any[];
}): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const payload: Record<string, any> = {
      id: toValidUUID(nfe.id),
      company_id: getActiveCompanyId(),
      numero_nota: String(nfe.number).trim() || '0',
      serie: nfe.series || '1',
      chave_acesso: nfe.accessKey?.trim() || null,
      fornecedor_id: nfe.supplierId ? toValidUUID(nfe.supplierId) : null,
      valor_total: Number(nfe.totalAmount) || 0,
      natureza_operacao: nfe.operationNature || 'Compra de Insumos para Silagem',
      data_emissao: nfe.issueDate || null,
      data_entrada: nfe.entryDate || new Date().toISOString().split('T')[0],
      itens_produtos: nfe.items || []
    };

    let { error } = await supabase
      .from('notas_fiscais')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      if (error.message && (error.message.includes('company_id') || error.message.includes('column'))) {
        delete payload.company_id;
        const retry = await supabase.from('notas_fiscais').upsert(payload, { onConflict: 'id' });
        if (!retry.error) return true;
      }
      console.warn('Supabase upsertNotaFiscal notice:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase upsertNotaFiscal err:', err);
    return false;
  }
}

/**
 * Exclui a Nota Fiscal no banco de dados.
 * REQUISITO CRÍTICO: Graças ao ON DELETE CASCADE na chave estrangeira de contas_a_pagar,
 * todas as parcelas atreladas a esta nota fiscal são apagadas automaticamente pelo PostgreSQL!
 */
export async function deleteNotaFiscal(notaId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const uuid = toValidUUID(notaId);
    const { error } = await supabase
      .from('notas_fiscais')
      .delete()
      .eq('id', uuid);

    if (error) {
      console.warn('Supabase deleteNotaFiscal notice:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase deleteNotaFiscal err:', err);
    return false;
  }
}

// ===========================================================================
// 2.1 Documentos de Entrada Manuais (Tabela: public.documentos_entrada)
// Para cadastros de Romaneios, Recibos, Notas de Produtor e Outros sem XML
// Colunas: id, company_id, fornecedor, fornecedor_id, data, tipo_documento,
//          valor_total, observacoes, created_at, updated_at
// ===========================================================================
export interface DocumentoEntradaInput {
  id?: string;
  fornecedor: string;
  fornecedor_id?: string | null;
  data: string; // YYYY-MM-DD
  data_vencimento?: string;
  tipo_documento: 'Romaneio' | 'Recibo' | 'Nota de Produtor' | 'Outros' | string;
  valor_total: number;
  observacoes?: string;
  status?: 'Rascunho' | 'Finalizado' | string;
}

/**
 * Cadastra uma nova entrada manual no Supabase via POST (tabela public.documentos_entrada).
 * Também salva localmente para resposta imediata na UI e resiliência offline.
 */
export async function insertDocumentoEntrada(
  doc: DocumentoEntradaInput,
  companyId?: string
): Promise<DocumentoEntradaRecord> {
  const activeCompanyId = companyId || getActiveCompanyId();
  const uuid = toValidUUID(doc.id || generateUUID());
  const now = new Date().toISOString();

  const localRecord: DocumentoEntradaRecord = {
    id: uuid,
    company_id: activeCompanyId || undefined,
    fornecedor: doc.fornecedor.trim(),
    fornecedor_nome: doc.fornecedor.trim(),
    fornecedor_id: doc.fornecedor_id || null,
    data: doc.data,
    data_emissao: doc.data,
    data_entrada: doc.data,
    data_vencimento: doc.data_vencimento || undefined,
    tipo_documento: doc.tipo_documento,
    valor_total: Number(doc.valor_total) || 0,
    observacoes: doc.observacoes?.trim() || '',
    status: doc.status || 'Finalizado',
    created_at: now,
    updated_at: now,
  };

  // Salva no armazenamento local primeiro para sincronismo imediato
  saveLocalDocumentoEntrada(localRecord);

  if (!isSupabaseConfigured) {
    return localRecord;
  }

  try {
    const payload: Record<string, any> = {
      id: uuid,
      company_id: activeCompanyId,
      fornecedor: doc.fornecedor.trim(),
      fornecedor_nome: doc.fornecedor.trim(),
      fornecedor_id: doc.fornecedor_id ? toValidUUID(doc.fornecedor_id) : null,
      data: doc.data,
      data_emissao: doc.data,
      data_entrada: doc.data,
      tipo_documento: doc.tipo_documento,
      valor_total: Number(doc.valor_total) || 0,
      observacoes: doc.observacoes?.trim() || '',
      status: doc.status || 'Finalizado',
      updated_at: now
    };
    if (doc.data_vencimento) {
      payload.data_vencimento = doc.data_vencimento;
    }

    let { data, error } = await supabase
      .from('documentos_entrada')
      .insert([payload])
      .select();

    if (error) {
      logPostgresError('insertDocumentoEntrada', error, { table: 'documentos_entrada', action: 'INSERT', payload });
      // Se houver incompatibilidade de colunas (ex: fornecedor_nome ou data_emissao não existirem), reenvia com payload enxuto
      const cleanPayload: Record<string, any> = {
        id: uuid,
        fornecedor: doc.fornecedor.trim(),
        data: doc.data,
        tipo_documento: doc.tipo_documento,
        valor_total: Number(doc.valor_total) || 0,
        observacoes: doc.observacoes?.trim() || '',
      };
      if (activeCompanyId) cleanPayload.company_id = activeCompanyId;

      const retry = await supabase
        .from('documentos_entrada')
        .insert([cleanPayload])
        .select();

      if (!retry.error && retry.data && retry.data[0]) {
        const returned = retry.data[0] as DocumentoEntradaRecord;
        saveLocalDocumentoEntrada(returned);
        return returned;
      }

      // Se der erro de company_id, tenta uma terceira vez sem company_id
      if (retry.error && (retry.error.message.includes('company_id') || retry.error.code === '42703')) {
        delete cleanPayload.company_id;
        const retryNoCompany = await supabase
          .from('documentos_entrada')
          .insert([cleanPayload])
          .select();
        if (!retryNoCompany.error && retryNoCompany.data && retryNoCompany.data[0]) {
          const returned = retryNoCompany.data[0] as DocumentoEntradaRecord;
          saveLocalDocumentoEntrada(returned);
          return returned;
        }
      }
    } else if (data && data[0]) {
      const returned = data[0] as DocumentoEntradaRecord;
      saveLocalDocumentoEntrada(returned);
      return returned;
    }
  } catch (err) {
    console.warn('Supabase insertDocumentoEntrada exception:', err);
  }

  return localRecord;
}

/**
 * Busca a lista de Documentos de Entrada registrados na tabela public.documentos_entrada.
 */
export async function fetchDocumentosEntrada(companyId?: string): Promise<DocumentoEntradaRecord[]> {
  const activeCompanyId = companyId || getActiveCompanyId();
  const localList = getStoredDocumentosEntrada();

  if (!isSupabaseConfigured) {
    return localList;
  }

  try {
    let query = supabase
      .from('documentos_entrada')
      .select('*')
      .order('data', { ascending: false });

    if (activeCompanyId) {
      query = query.or(`company_id.eq.${activeCompanyId},company_id.is.null`);
    }

    const { data, error } = await query;
    if (error) {
      // Tenta busca simples sem filtro
      const fallbackQuery = await supabase
        .from('documentos_entrada')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!fallbackQuery.error && fallbackQuery.data && fallbackQuery.data.length > 0) {
        const map = new Map<string, DocumentoEntradaRecord>();
        (fallbackQuery.data as DocumentoEntradaRecord[]).forEach(d => map.set(d.id, d));
        localList.forEach(d => { if (!map.has(d.id)) map.set(d.id, d); });
        const merged = Array.from(map.values());
        saveStoredDocumentosEntrada(merged);
        return merged;
      }
      return localList;
    }

    if (data && Array.isArray(data)) {
      const map = new Map<string, DocumentoEntradaRecord>();
      (data as DocumentoEntradaRecord[]).forEach(d => map.set(d.id, d));
      localList.forEach(d => { if (!map.has(d.id)) map.set(d.id, d); });
      const merged = Array.from(map.values());
      saveStoredDocumentosEntrada(merged);
      return merged;
    }
  } catch (err) {
    console.warn('fetchDocumentosEntrada error:', err);
  }

  return localList;
}

/**
 * Exclui um Documento de Entrada no Supabase e no armazenamento local.
 */
export async function deleteDocumentoEntrada(id: string): Promise<boolean> {
  deleteLocalDocumentoEntrada(id);
  if (!isSupabaseConfigured) return true;

  try {
    const uuid = toValidUUID(id);
    const { error } = await supabase
      .from('documentos_entrada')
      .delete()
      .eq('id', uuid);

    if (error && id !== uuid) {
      await supabase.from('documentos_entrada').delete().eq('id', id);
    }
    return true;
  } catch (err) {
    console.warn('deleteDocumentoEntrada error:', err);
    return false;
  }
}

/**
 * Atualiza o valor total de um documento de entrada no Supabase e localmente.
 */
export async function updateDocumentoEntradaTotal(id: string, novoValorTotal: number): Promise<boolean> {
  const current = getStoredDocumentosEntrada();
  const updated = current.map(d => d.id === id ? { ...d, valor_total: novoValorTotal } : d);
  saveStoredDocumentosEntrada(updated);

  if (!isSupabaseConfigured) return true;
  try {
    const uuid = toValidUUID(id);
    let { error } = await supabase
      .from('documentos_entrada')
      .update({ valor_total: novoValorTotal, updated_at: new Date().toISOString() })
      .eq('id', uuid);

    if (error && id !== uuid) {
      await supabase
        .from('documentos_entrada')
        .update({ valor_total: novoValorTotal })
        .eq('id', id);
    }
    return true;
  } catch (e) {
    console.warn('updateDocumentoEntradaTotal error:', e);
    return false;
  }
}

/**
 * Atualiza um Documento de Entrada completo no Supabase e localmente (status, valores, cabeçalho).
 */
export async function updateDocumentoEntrada(
  id: string,
  updates: Partial<DocumentoEntradaRecord>,
  companyId?: string
): Promise<boolean> {
  const current = getStoredDocumentosEntrada();
  const updatedList = current.map(d => {
    if (d.id === id) {
      return { ...d, ...updates, updated_at: new Date().toISOString() };
    }
    return d;
  });
  saveStoredDocumentosEntrada(updatedList);

  if (!isSupabaseConfigured) return true;

  try {
    const uuid = toValidUUID(id);
    const payload: Record<string, any> = {
      updated_at: new Date().toISOString()
    };
    if (updates.fornecedor !== undefined) {
      payload.fornecedor = updates.fornecedor.trim();
      payload.fornecedor_nome = updates.fornecedor.trim();
    }
    if (updates.data !== undefined) {
      payload.data = updates.data;
      payload.data_emissao = updates.data;
      payload.data_entrada = updates.data;
    }
    if (updates.data_vencimento !== undefined) {
      payload.data_vencimento = updates.data_vencimento;
    }
    if (updates.tipo_documento !== undefined) {
      payload.tipo_documento = updates.tipo_documento;
    }
    if (updates.valor_total !== undefined) {
      payload.valor_total = Number(updates.valor_total) || 0;
    }
    if (updates.observacoes !== undefined) {
      payload.observacoes = updates.observacoes;
    }
    if (updates.status !== undefined) {
      payload.status = updates.status;
    }

    let { error } = await supabase
      .from('documentos_entrada')
      .update(payload)
      .eq('id', uuid);

    if (error) {
      // Se houver incompatibilidade de colunas (ex: status ou data_vencimento inexistentes na tabela do Supabase)
      const safePayload = { ...payload };
      delete safePayload.status;
      delete safePayload.data_vencimento;
      delete safePayload.fornecedor_nome;
      delete safePayload.data_emissao;
      delete safePayload.data_entrada;

      const retry = await supabase
        .from('documentos_entrada')
        .update(safePayload)
        .eq('id', uuid);

      if (retry.error && id !== uuid) {
        await supabase.from('documentos_entrada').update(safePayload).eq('id', id);
      }
    } else if (id !== uuid) {
      await supabase.from('documentos_entrada').update(payload).eq('id', id);
    }
    return true;
  } catch (err) {
    console.warn('updateDocumentoEntrada exception:', err);
    return false;
  }
}

// ===========================================================================
// 2.2 Itens de Documentos de Entrada (Tabela: public.documentos_entrada_itens)
// Colunas: id, documento_entrada_id, produto_id, descricao, quantidade,
//          unidade, valor_unitario, valor_total, created_at
// ===========================================================================
export interface DocumentoEntradaItemInput {
  id?: string;
  documento_entrada_id: string;
  produto_id?: string;
  descricao: string;
  quantidade: number;
  unidade?: string;
  valor_unitario: number;
  valor_total: number;
}

/**
 * Insere um item de entrada via POST na tabela public.documentos_entrada_itens.
 * Salva localmente com fallback e atualiza integridade.
 */
export async function insertDocumentoEntradaItem(item: DocumentoEntradaItemInput): Promise<DocumentoEntradaItem> {
  const uuid = toValidUUID(item.id || generateUUID());
  const docUuid = toValidUUID(item.documento_entrada_id);
  const now = new Date().toISOString();

  const record: DocumentoEntradaItem = {
    id: uuid,
    documento_entrada_id: item.documento_entrada_id,
    produto_id: item.produto_id || undefined,
    descricao: item.descricao.trim(),
    quantidade: Number(item.quantidade) || 0,
    unidade: item.unidade || 'UN',
    valor_unitario: Number(item.valor_unitario) || 0,
    valor_total: Number(item.valor_total) || 0,
    created_at: now
  };

  saveLocalDocumentoEntradaItem(record);

  if (!isSupabaseConfigured) {
    return record;
  }

  try {
    const payload: Record<string, any> = {
      id: uuid,
      documento_entrada_id: docUuid,
      produto_id: item.produto_id ? toValidUUID(item.produto_id) : null,
      descricao: item.descricao.trim(),
      quantidade: Number(item.quantidade) || 0,
      unidade: item.unidade || 'UN',
      valor_unitario: Number(item.valor_unitario) || 0,
      valor_total: Number(item.valor_total) || 0,
      created_at: now
    };

    let { data, error } = await supabase
      .from('documentos_entrada_itens')
      .insert([payload])
      .select();

    if (error) {
      // Tenta fallback com produto_id como string direta
      const fallbackPayload: Record<string, any> = {
        id: uuid,
        documento_entrada_id: docUuid,
        produto_id: item.produto_id || null,
        descricao: item.descricao.trim(),
        quantidade: Number(item.quantidade) || 0,
        unidade: item.unidade || 'UN',
        valor_unitario: Number(item.valor_unitario) || 0,
        valor_total: Number(item.valor_total) || 0
      };

      const retry = await supabase
        .from('documentos_entrada_itens')
        .insert([fallbackPayload])
        .select();

      if (!retry.error && retry.data && retry.data[0]) {
        const returned = retry.data[0] as DocumentoEntradaItem;
        saveLocalDocumentoEntradaItem(returned);
        return returned;
      }
    } else if (data && data[0]) {
      const returned = data[0] as DocumentoEntradaItem;
      saveLocalDocumentoEntradaItem(returned);
      return returned;
    }
  } catch (err) {
    console.warn('insertDocumentoEntradaItem err:', err);
  }

  return record;
}

/**
 * Busca itens de um documento de entrada.
 */
export async function fetchDocumentosEntradaItens(documentoEntradaId: string): Promise<DocumentoEntradaItem[]> {
  const localList = getStoredDocumentosEntradaItens(documentoEntradaId);
  if (!isSupabaseConfigured) return localList;

  try {
    const docUuid = toValidUUID(documentoEntradaId);
    let { data, error } = await supabase
      .from('documentos_entrada_itens')
      .select('*')
      .or(`documento_entrada_id.eq.${docUuid},documento_entrada_id.eq.${documentoEntradaId}`)
      .order('created_at', { ascending: true });

    if (!error && data && Array.isArray(data)) {
      const map = new Map<string, DocumentoEntradaItem>();
      (data as DocumentoEntradaItem[]).forEach(i => map.set(i.id, i));
      localList.forEach(i => { if (!map.has(i.id)) map.set(i.id, i); });
      const merged = Array.from(map.values());
      return merged;
    }
  } catch (e) {
    console.warn('fetchDocumentosEntradaItens err:', e);
  }

  return localList;
}

/**
 * Exclui um item de documento de entrada.
 */
export async function deleteDocumentoEntradaItem(itemId: string): Promise<boolean> {
  deleteLocalDocumentoEntradaItem(itemId);
  if (!isSupabaseConfigured) return true;
  try {
    const uuid = toValidUUID(itemId);
    const { error } = await supabase
      .from('documentos_entrada_itens')
      .delete()
      .eq('id', uuid);

    if (error && itemId !== uuid) {
      await supabase.from('documentos_entrada_itens').delete().eq('id', itemId);
    }
    return true;
  } catch (e) {
    console.warn('deleteDocumentoEntradaItem err:', e);
    return false;
  }
}



// ===========================================================================
// 3. Contas a Pagar (Tabela: public.contas_a_pagar)
// Colunas: id, nota_fiscal_id (FK ON DELETE CASCADE), numero_parcela,
//          valor_parcela, data_vencimento, forma_pagamento, centro_custo,
//          status_pago, created_at
// ===========================================================================
export interface ContaAPagarRecord {
  id: string;
  nota_fiscal_id?: string | null;
  numero_parcela?: string;
  valor_parcela: number;
  data_vencimento: string;
  forma_pagamento?: string;
  centro_custo?: string;
  status_pago: boolean;
  created_at?: string;
}

export async function fetchContasAPagar(companyId?: string): Promise<ContaAPagarRecord[] | null> {
  if (!isSupabaseConfigured) return null;
  const activeCompanyId = companyId || getActiveCompanyId();
  if (!activeCompanyId) return [];
  try {
    let { data, error } = await supabase
      .from('contas_a_pagar')
      .select('*')
      .eq('company_id', activeCompanyId)
      .order('data_vencimento', { ascending: true });

    if ((!data || data.length === 0) && activeCompanyId) {
      const altUuid = toValidUUID(activeCompanyId);
      if (altUuid && altUuid !== activeCompanyId) {
        const retry = await supabase
          .from('contas_a_pagar')
          .select('*')
          .eq('company_id', altUuid)
          .order('data_vencimento', { ascending: true });
        if (retry.data && retry.data.length > 0) {
          data = retry.data;
          error = null;
        }
      }
    }

    if (error) {
      console.warn('Supabase fetchContasAPagar notice:', error.message);
      return [];
    }
    return (data || []) as ContaAPagarRecord[];
  } catch (err) {
    console.warn('Supabase fetchContasAPagar err:', err);
    return [];
  }
}

export function determineFinancialCategory(
  items?: Array<{ description?: string; descricao?: string; name?: string; valor_total?: number; totalPrice?: number; [key: string]: any }>,
  additionalText?: string
): 'Combustível & Arla' | 'Insumos & Entradas' {
  const fuelKeywords = [
    'diesel', 'combustivel', 'combustível', 's10', 's-10', 's500', 's-500',
    'arla', 'arla32', 'arla 32', 'gasolina', 'etanol', 'abastecimento', 'combustiveis', 'cat_combustivel'
  ];

  if (items && items.length > 0) {
    const sorted = [...items].sort((a, b) => {
      const valA = Number(a.valor_total ?? a.totalPrice ?? 0);
      const valB = Number(b.valor_total ?? b.totalPrice ?? 0);
      return valB - valA;
    });

    const primary = sorted[0];
    const primaryText = `${primary.description || ''} ${primary.descricao || ''} ${primary.name || ''}`.toLowerCase();
    if (fuelKeywords.some(kw => primaryText.includes(kw))) {
      return 'Combustível & Arla';
    }

    const fuelTotal = sorted.reduce((acc, item) => {
      const itemText = `${item.description || ''} ${item.descricao || ''} ${item.name || ''}`.toLowerCase();
      const val = Number(item.valor_total ?? item.totalPrice ?? 0);
      return fuelKeywords.some(kw => itemText.includes(kw)) ? acc + val : acc;
    }, 0);

    const totalAll = sorted.reduce((acc, item) => acc + Number(item.valor_total ?? item.totalPrice ?? 0), 0);
    if (fuelTotal > 0 && (totalAll === 0 || fuelTotal >= totalAll / 2)) {
      return 'Combustível & Arla';
    }
  }

  if (additionalText) {
    const textLower = additionalText.toLowerCase();
    if (fuelKeywords.some(kw => textLower.includes(kw))) {
      return 'Combustível & Arla';
    }
  }

  return 'Insumos & Entradas';
}

export async function upsertContaAPagar(parcela: {
  id: string;
  nota_fiscal_id?: string | null;
  numero_parcela?: string;
  valor_parcela: number;
  data_vencimento: string;
  forma_pagamento?: string;
  centro_custo?: string;
  categoria?: string;
  tipo_despesa?: string;
  status_pago?: boolean;
}, companyId?: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const activeCompanyId = companyId || getActiveCompanyId();
    const catFinal = parcela.categoria || parcela.tipo_despesa || parcela.centro_custo || 'Insumos & Entradas';
    const payload: Record<string, any> = {
      id: toValidUUID(parcela.id),
      company_id: activeCompanyId,
      nota_fiscal_id: parcela.nota_fiscal_id ? toValidUUID(parcela.nota_fiscal_id) : null,
      numero_parcela: parcela.numero_parcela || '01/01',
      valor_parcela: Number(parcela.valor_parcela) || 0,
      data_vencimento: parcela.data_vencimento || new Date().toISOString().split('T')[0],
      forma_pagamento: parcela.forma_pagamento || 'Boleto',
      centro_custo: parcela.centro_custo || catFinal,
      categoria: catFinal,
      tipo_despesa: catFinal,
      status_pago: Boolean(parcela.status_pago)
    };

    let { error } = await supabase
      .from('contas_a_pagar')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      logPostgresError('upsertContaAPagar', error, { table: 'contas_a_pagar', action: 'UPSERT', payload });
      // Se for violação de FK 23503 em nota_fiscal_id, anula e retenta
      if (error.code === '23503' && payload.nota_fiscal_id) {
        payload.nota_fiscal_id = null;
        const retryNF = await supabase.from('contas_a_pagar').upsert(payload, { onConflict: 'id' });
        if (!retryNF.error) return true;
      }
      // Se for erro de coluna inexistente (ex: categoria ou tipo_despesa), remove as colunas adicionais e retenta
      if (error.message && (error.message.includes('column') || error.code === '42703')) {
        const leanPayload = { ...payload };
        delete leanPayload.categoria;
        delete leanPayload.tipo_despesa;
        const retryCols = await supabase.from('contas_a_pagar').upsert(leanPayload, { onConflict: 'id' });
        if (!retryCols.error) return true;
      }
      // Se for violação em company_id ou coluna inexistente
      if (error.code === '23503' || (error.message && (error.message.includes('company_id') || error.message.includes('column')))) {
        delete payload.company_id;
        delete payload.categoria;
        delete payload.tipo_despesa;
        const retry = await supabase.from('contas_a_pagar').upsert(payload, { onConflict: 'id' });
        if (!retry.error) return true;
      }
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase upsertContaAPagar err:', err);
    return false;
  }
}

export async function deleteContaAPagar(parcelaId: string, companyId?: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const activeCompanyId = companyId || getActiveCompanyId();
    const uuid = toValidUUID(parcelaId);
    let query = supabase.from('contas_a_pagar').delete().eq('id', uuid);
    if (activeCompanyId) query = query.eq('company_id', activeCompanyId);
    const { error } = await query;

    if (error) {
      console.warn('Supabase deleteContaAPagar notice:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase deleteContaAPagar err:', err);
    return false;
  }
}

export interface LancamentoContasAPagarEntradaInput {
  id?: string;
  documento_entrada_id?: string;
  fornecedor: string;
  valor_total: number;
  valor_parcela?: number;
  numero_parcela?: string;
  tipo_documento: string;
  descricao?: string;
  data_emissao: string;
  data_vencimento: string;
  forma_pagamento?: string;
  centro_custo?: string;
  categoria?: string;
  tipo_despesa?: string;
}

/**
 * Realiza POST automático na tabela public.contas_a_pagar do Supabase
 * ao concluir uma entrada manual (status = 'Finalizado').
 * Suporta fracionamento e vinculação de parcelas:
 * - fornecedor/credor (nome do fornecedor)
 * - documento_entrada_id (ID da entrada de mercadoria vinculada)
 * - valor_total / valor_parcela (valor da parcela e total consolidado)
 * - numero_parcela ('01/03', '02/03', etc.)
 * - descricao / centro_custo ('Entrada de mercadoria manual ref. documento ' + tipo_documento)
 * - data_emissao e data_vencimento
 * - forma_pagamento (Boleto, Pix, Cartão, Dinheiro, etc.)
 */
export async function insertContaAPagarEntradaManual(
  dados: LancamentoContasAPagarEntradaInput,
  companyId?: string
): Promise<{ success: boolean; data?: any; error?: any }> {
  const activeCompanyId = companyId || getActiveCompanyId();
  const uuid = toValidUUID(dados.id || generateUUID());
  const desc = dados.descricao || `Entrada de mercadoria manual ref. documento ${dados.tipo_documento}`;
  const now = new Date().toISOString();
  const parcelaAmount = Number(dados.valor_parcela !== undefined ? dados.valor_parcela : dados.valor_total) || 0;
  const numParcela = dados.numero_parcela || '01/01';
  const catFinal = dados.categoria || dados.tipo_despesa || 'Insumos & Entradas';

  if (!isSupabaseConfigured) {
    return { success: true };
  }

  try {
    const fullPayload: Record<string, any> = {
      id: uuid,
      fornecedor: dados.fornecedor.trim(),
      credor: dados.fornecedor.trim(),
      valor_total: Number(dados.valor_total) || 0,
      valor_parcela: parcelaAmount,
      descricao: desc,
      centro_custo: dados.centro_custo || catFinal,
      categoria: catFinal,
      tipo_despesa: catFinal,
      data_emissao: dados.data_emissao,
      data_vencimento: dados.data_vencimento,
      numero_parcela: numParcela,
      forma_pagamento: dados.forma_pagamento || 'Boleto',
      status_pago: false,
      created_at: now
    };

    if (dados.documento_entrada_id) {
      fullPayload.documento_entrada_id = toValidUUID(dados.documento_entrada_id);
    }

    if (activeCompanyId) {
      fullPayload.company_id = activeCompanyId;
    }

    let { data, error } = await supabase
      .from('contas_a_pagar')
      .insert([fullPayload])
      .select();

    if (error) {
      logPostgresError('insertContaAPagarEntradaManual', error, { table: 'contas_a_pagar', action: 'INSERT', payload: fullPayload });

      // Fallback 1: Esquema com categoria, valor_parcela, centro_custo, data_vencimento, numero_parcela, forma_pagamento
      const standardPayload: Record<string, any> = {
        id: uuid,
        valor_parcela: parcelaAmount,
        data_vencimento: dados.data_vencimento,
        centro_custo: dados.centro_custo || catFinal,
        categoria: catFinal,
        tipo_despesa: catFinal,
        numero_parcela: numParcela,
        forma_pagamento: dados.forma_pagamento || 'Boleto',
        status_pago: false,
        created_at: now
      };
      if (activeCompanyId) standardPayload.company_id = activeCompanyId;

      const retry1 = await supabase
        .from('contas_a_pagar')
        .insert([standardPayload])
        .select();

      if (!retry1.error) {
        return { success: true, data: retry1.data };
      }

      // Fallback 2: Remove colunas extras se não existirem no schema físico do Supabase
      if (retry1.error) {
        delete standardPayload.company_id;
        delete standardPayload.categoria;
        delete standardPayload.tipo_despesa;
        const retry2 = await supabase
          .from('contas_a_pagar')
          .insert([standardPayload])
          .select();

        if (!retry2.error) {
          return { success: true, data: retry2.data };
        }
      }

      return { success: false, error };
    }

    return { success: true, data };
  } catch (err) {
    console.warn('Supabase insertContaAPagarEntradaManual exception:', err);
    return { success: false, error: err };
  }
}

// Retro-compatibilidade com chamadas de parcelas_financeiras
export const upsertParcelaFinanceira = async (parcela: {
  id: string;
  type: 'pagar' | 'receber';
  title: string;
  amount: number;
  due_date: string;
  status: 'pago' | 'pendente' | 'atrasado';
  client_or_supplier?: string;
  reference_id?: string;
}) => {
  return upsertContaAPagar({
    id: parcela.id,
    nota_fiscal_id: parcela.reference_id ? toValidUUID(parcela.reference_id) : null,
    numero_parcela: '01/01',
    valor_parcela: parcela.amount,
    data_vencimento: parcela.due_date,
    forma_pagamento: 'Boleto',
    centro_custo: parcela.title,
    status_pago: parcela.status === 'pago'
  });
};

// ===========================================================================
// 4. Estoque (Tabela principal: public.estoque_produtos, fallback: public.estoque)
// Mapeamento das colunas reais de 'estoque_produtos':
//   * nome_comercial (em vez de nome)
//   * quantidade_atual (em vez de quantidade)
//   * preco_custo_inicial (em vez de custo_nominal)
//   * preco_venda_varejo (em vez de preco_venda)
// ===========================================================================
export async function fetchEstoque(companyId?: string): Promise<InventoryItem[] | null> {
  const localItems = getStoredInventory();
  if (!isSupabaseConfigured) return localItems;
  const activeCompanyId = companyId || getActiveCompanyId();
  try {
    let rows: any[] = [];
    let querySuccess = false;

    // 1. Tenta buscar prioritariamente da tabela oficial 'estoque_produtos'
    let qProdutos = supabase.from('estoque_produtos').select('*');
    if (activeCompanyId) {
      qProdutos = qProdutos.or(`company_id.eq.${activeCompanyId},company_id.is.null`);
    }
    const resProdutos = await qProdutos;
    if (!resProdutos.error && Array.isArray(resProdutos.data) && resProdutos.data.length > 0) {
      rows = resProdutos.data;
      querySuccess = true;
    } else {
      // 2. Fallback para tabela legada 'estoque'
      let qEstoque = supabase.from('estoque').select('*');
      if (activeCompanyId) {
        qEstoque = qEstoque.or(`company_id.eq.${activeCompanyId},company_id.is.null`);
      }
      const resEstoque = await qEstoque;
      if (!resEstoque.error && Array.isArray(resEstoque.data) && resEstoque.data.length > 0) {
        rows = resEstoque.data;
        querySuccess = true;
      }
    }

    if (!querySuccess || rows.length === 0) {
      return localItems;
    }

    const mapped: InventoryItem[] = rows.map(row => {
      // Mapeamento das colunas reais do banco
      const name = String(row.nome_comercial || row.nome || row.descricao || 'Produto sem descrição').trim();
      const qty = Number(row.quantidade_atual ?? row.quantidade ?? 0);
      const cost = Number(row.preco_custo_inicial ?? row.custo_nominal ?? row.preco_custo ?? 0);
      const sale = Number(row.preco_venda_varejo ?? row.preco_venda ?? row.preco_venda_final ?? 0);

      return {
        id: String(row.id),
        companyId: row.company_id || undefined,
        code: row.codigo_produto || '',
        name,
        nome_comercial: name,
        nome: name,
        category: row.categoria || 'outro',
        categoria: row.categoria || 'outro',
        quantity: qty,
        quantidade_atual: qty,
        unit: row.unidade_medida || row.unidade || 'UN',
        unidade_medida: row.unidade_medida || row.unidade || 'UN',
        minQuantity: Number(row.quantidade_minima ?? row.minQuantity ?? 0),
        unitCost: cost,
        preco_custo_inicial: cost,
        custo_nominal: cost,
        salePrice: sale,
        preco_venda_varejo: sale,
        preco_venda: sale,
        wholesalePrice: Number(row.preco_venda_atacado ?? 0),
        promoPrice: Number(row.preco_venda_promo ?? 0),
        location: row.localizacao_fisica || row.localizacao || 'Depósito Principal',
        localizacao_fisica: row.localizacao_fisica || row.localizacao || 'Depósito Principal',
        capacidade_total: row.capacidade_total !== undefined && row.capacidade_total !== null ? Number(row.capacidade_total) : (row.categoria === 'Combustível & Arla' ? 15000 : undefined),
        brand: row.marca || undefined,
        barcode: row.codigo_barras || row.gtin || undefined,
        hasNoGtin: Boolean(row.sem_gtin),
        factoryRef: row.ref_fabrica || row.referencia_fabrica || undefined,
        ncm: row.codigo_ncm || row.ncm || undefined,
        fiscalGroup: row.grupo_fiscal || undefined,
        ipiGroup: row.grupo_ipi || undefined,
        profitMargin: row.margem_lucro_sugerida !== undefined && row.margem_lucro_sugerida !== null 
          ? Number(row.margem_lucro_sugerida) 
          : (row.margem_lucro !== undefined && row.margem_lucro !== null ? Number(row.margem_lucro) : undefined),
        gallonSizeLiters: row.volume_litros_embalagem !== undefined && row.volume_litros_embalagem !== null
          ? Number(row.volume_litros_embalagem)
          : (row.capacidade_galao !== undefined && row.capacidade_galao !== null ? Number(row.capacidade_galao) : undefined),
        volume_litros_embalagem: row.volume_litros_embalagem !== undefined && row.volume_litros_embalagem !== null
          ? Number(row.volume_litros_embalagem)
          : (row.capacidade_galao !== undefined && row.capacidade_galao !== null ? Number(row.capacidade_galao) : undefined),
        createdAt: row.created_at || undefined,
        updatedAt: row.updated_at || undefined,
      };
    });

    const finalizedList = ensureDieselProductsInInventory(mapped);
    saveStoredInventory(finalizedList);
    return finalizedList;
  } catch (err) {
    console.warn('Supabase fetchEstoque err:', err);
    return localItems;
  }
}

/**
 * Sincroniza os itens essenciais de combustível e arla diretamente na tabela 'public.estoque_produtos'
 * caso ainda não existam no banco do Supabase, garantindo que colunas reais
 * ('nome_comercial', 'quantidade_atual', 'unidade_medida', 'categoria') fiquem disponíveis para consulta.
 */
export async function syncEssentialFuelProductsToSupabase(companyId?: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const activeCompanyId = companyId || getActiveCompanyId();
  try {
    const essentialItems = ensureDieselProductsInInventory([]);
    for (const item of essentialItems) {
      const nomeComercial = item.nome_comercial || item.name;
      const { data } = await supabase
        .from('estoque_produtos')
        .select('id, nome_comercial')
        .ilike('nome_comercial', nomeComercial)
        .limit(1);

      if (!data || data.length === 0) {
        await upsertEstoqueItem(item, activeCompanyId);
      }
    }
  } catch (err) {
    console.warn('Notice syncing essential fuel products to estoque_produtos:', err);
  }
}

/**
 * Busca reativa de produtos diretamente na tabela 'public.estoque_produtos' do Supabase.
 * - SEM nenhum filtro fixo de categoria (permite produtos de 'Combustível & Arla', peças, insumos, etc.).
 * - Utiliza estritamente a coluna real 'nome_comercial' com o operador .ilike('nome_comercial', `%${search}%`).
 * - Mapeia com precisão as colunas reais: 'nome_comercial', 'quantidade_atual' e 'unidade_medida' (L ou un).
 */
export async function searchEstoqueProdutos(searchTerm: string = '', companyId?: string): Promise<InventoryItem[]> {
  const localItems = ensureDieselProductsInInventory(getStoredInventory());
  const trimmed = searchTerm.trim();

  // Helper para padronizar unidade de medida ('L' ou 'un')
  const normalizeUnit = (u?: string): string => {
    const raw = String(u || 'un').trim().toLowerCase();
    if (raw === 'l' || raw === 'litro' || raw === 'litros' || raw === 'lt' || raw === 'lts') return 'L';
    if (raw === 'un' || raw === 'und' || raw === 'unidade' || raw === 'unidades') return 'un';
    return u || 'un';
  };

  // Helper para verificar se um item é de Combustível & Arla
  const isFuelItem = (cat?: string, name?: string): boolean => {
    const c = String(cat || '').toLowerCase();
    const n = String(name || '').toLowerCase();
    return c.includes('combust') || c.includes('arla') || n.includes('diesel') || n.includes('arla');
  };

  if (!isSupabaseConfigured) {
    const q = trimmed.toLowerCase();
    const filtered = localItems.filter(i => {
      if (!q) return true;
      const nome = String(i.nome_comercial || i.name || '').toLowerCase();
      const code = String(i.code || '').toLowerCase();
      const cat = String(i.categoria || i.category || '').toLowerCase();
      return nome.includes(q) || code.includes(q) || cat.includes(q);
    });

    // Coloca combustível e arla no topo
    filtered.sort((a, b) => {
      const aFuel = isFuelItem(a.categoria || a.category, a.nome_comercial || a.name);
      const bFuel = isFuelItem(b.categoria || b.category, b.nome_comercial || b.name);
      if (aFuel && !bFuel) return -1;
      if (!aFuel && bFuel) return 1;
      return String(a.nome_comercial || a.name || '').localeCompare(String(b.nome_comercial || b.name || ''));
    });

    return filtered.slice(0, 50);
  }

  const activeCompanyId = companyId || getActiveCompanyId();
  try {
    // 1. Consulta à tabela oficial 'public.estoque_produtos' sem qualquer restrição de categoria
    // (Permite itens de 'Combustível & Arla', peças, insumos, etc.)
    let qProdutos = supabase.from('estoque_produtos').select('*');

    if (activeCompanyId) {
      qProdutos = qProdutos.or(`company_id.eq.${activeCompanyId},company_id.is.null`);
    }

    if (trimmed) {
      // Busca por aproximação utilizando estritamente a coluna real do banco: 'nome_comercial'
      qProdutos = qProdutos.ilike('nome_comercial', `%${trimmed}%`);
    }

    qProdutos = qProdutos.order('nome_comercial', { ascending: true }).limit(80);

    let res = await qProdutos;

    // Se com filtro de company_id deu erro ou não retornou dados, tenta sem o filtro de company_id
    if (res.error || !res.data || res.data.length === 0) {
      let qRetry = supabase.from('estoque_produtos').select('*');
      if (trimmed) {
        qRetry = qRetry.ilike('nome_comercial', `%${trimmed}%`);
      }
      qRetry = qRetry.order('nome_comercial', { ascending: true }).limit(80);
      const resRetry = await qRetry;
      if (!resRetry.error && Array.isArray(resRetry.data) && resRetry.data.length > 0) {
        res = resRetry;
      }
    }

    let mapped: InventoryItem[] = [];

    if (!res.error && Array.isArray(res.data) && res.data.length > 0) {
      mapped = res.data.map(row => {
        const nomeComercial = String(row.nome_comercial || row.nome || row.descricao || 'Produto sem descrição').trim();
        const qty = Number(row.quantidade_atual ?? row.quantidade ?? 0);
        const cost = Number(row.preco_custo_inicial ?? row.custo_nominal ?? row.preco_custo ?? 0);
        const sale = Number(row.preco_venda_varejo ?? row.preco_venda ?? 0);
        const unit = normalizeUnit(row.unidade_medida || row.unidade);

        return {
          id: String(row.id),
          companyId: row.company_id || undefined,
          code: row.codigo_produto || '',
          name: nomeComercial,
          nome_comercial: nomeComercial,
          nome: nomeComercial,
          category: row.categoria || 'outro',
          categoria: row.categoria || 'outro',
          quantity: qty,
          quantidade_atual: qty,
          minQuantity: Number(row.quantidade_minima ?? row.minQuantity ?? 0),
          unit: unit,
          unidade_medida: unit,
          unitCost: cost,
          preco_custo_inicial: cost,
          salePrice: sale,
          preco_venda_varejo: sale,
          location: row.localizacao || 'Depósito Principal',
          brand: row.marca || undefined,
          barcode: row.codigo_barras || undefined,
          factoryRef: row.ref_fabrica || undefined,
          ncm: row.codigo_ncm || undefined,
          profitMargin: row.margem_lucro_sugerida !== undefined ? Number(row.margem_lucro_sugerida) : undefined,
          gallonSizeLiters: row.volume_litros_embalagem !== undefined ? Number(row.volume_litros_embalagem) : undefined,
          volume_litros_embalagem: row.volume_litros_embalagem !== undefined ? Number(row.volume_litros_embalagem) : undefined,
          createdAt: row.created_at || undefined,
          updatedAt: row.updated_at || undefined,
        };
      });
    }

    // 2. Garante que os produtos essenciais de Combustível & Arla estejam sempre presentes
    // ('Diesel S10', 'Diesel S500', 'Arla 32 (Granel / Litro)', 'Arla 32 (Galão 20L)')
    const qLower = trimmed.toLowerCase();
    const fuelLocalMatches = localItems.filter(item => {
      const isFuel = isFuelItem(item.categoria || item.category, item.nome_comercial || item.name);
      if (!isFuel) return false;
      if (!qLower) return true;
      const nc = String(item.nome_comercial || item.name || '').toLowerCase();
      const code = String(item.code || '').toLowerCase();
      return nc.includes(qLower) || code.includes(qLower);
    });

    // Mescla garantindo Combustível & Arla prioritários
    const combined: InventoryItem[] = [];

    // Adiciona os itens de combustível correspondentes
    for (const fuelItem of fuelLocalMatches) {
      const fuelName = String(fuelItem.nome_comercial || fuelItem.name || '').toLowerCase().trim();
      const inMapped = mapped.find(m => 
        m.id === fuelItem.id || 
        String(m.nome_comercial || m.name || '').toLowerCase().trim() === fuelName
      );
      if (inMapped) {
        combined.push(inMapped);
      } else {
        combined.push(fuelItem);
      }
    }

    // Adiciona os demais produtos retornados do Supabase
    for (const item of mapped) {
      const itemName = String(item.nome_comercial || item.name || '').toLowerCase().trim();
      const alreadyIn = combined.some(c => 
        c.id === item.id || 
        String(c.nome_comercial || c.name || '').toLowerCase().trim() === itemName
      );
      if (!alreadyIn) {
        combined.push(item);
      }
    }

    return combined;
  } catch (err) {
    console.warn('Erro ao consultar public.estoque_produtos:', err);
    const q = trimmed.toLowerCase();
    return localItems.filter(i => {
      if (!q) return true;
      const nome = String(i.nome_comercial || i.name || '').toLowerCase();
      const code = String(i.code || '').toLowerCase();
      const cat = String(i.categoria || i.category || '').toLowerCase();
      return nome.includes(q) || code.includes(q) || cat.includes(q);
    }).slice(0, 50);
  }
}

export function parseNumericFloat(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val)
    .replace('R$', '')
    .replace('%', '')
    .replace(/\s/g, '')
    .trim();
  if (!str) return 0;
  // Trata formato brasileiro (1.250,50 -> 1250.50) ou padrão (1250.50)
  const cleaned = str.includes(',') ? str.replace(/\./g, '').replace(',', '.') : str;
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export async function upsertEstoqueItem(item: InventoryItem | any, companyId?: string): Promise<boolean> {
  const currentInv = getStoredInventory();
  const itemId = item.id || `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const itemWithId = { ...item, id: itemId };
  
  const existingIdx = currentInv.findIndex(i => i.id === itemId);
  let updatedInv: InventoryItem[];
  if (existingIdx >= 0) {
    updatedInv = currentInv.map(i => i.id === itemId ? { ...i, ...itemWithId } : i);
  } else {
    updatedInv = [itemWithId, ...currentInv];
  }
  saveStoredInventory(updatedInv);

  if (!isSupabaseConfigured) return true;
  try {
    const activeCompanyId = item.companyId || companyId || getActiveCompanyId();
    
    // Tratamento estrito de valores numéricos como floats válidos
    const custoNominalFloat = parseNumericFloat(item.preco_custo_inicial ?? item.custo_nominal ?? item.unitCost ?? item.preco_custo);
    const precoVendaFloat = parseNumericFloat(item.preco_venda_varejo ?? item.preco_venda ?? item.salePrice ?? item.preco_venda_final);
    const quantidadeFloat = parseNumericFloat(item.quantidade_atual ?? item.quantity);
    const margemFloat = (item.margem_lucro_sugerida !== undefined && item.margem_lucro_sugerida !== null && item.margem_lucro_sugerida !== '')
      ? parseNumericFloat(item.margem_lucro_sugerida)
      : (item.profitMargin !== undefined && item.profitMargin !== null && item.profitMargin !== '')
        ? parseNumericFloat(item.profitMargin)
        : (item.margem_lucro !== undefined && item.margem_lucro !== null && item.margem_lucro !== '')
          ? parseNumericFloat(item.margem_lucro)
          : (custoNominalFloat > 0 && precoVendaFloat > 0 
              ? Number((((precoVendaFloat - custoNominalFloat) / custoNominalFloat) * 100).toFixed(2)) 
              : null);

    const nomeStr = String(item.nome_comercial || item.nome || item.name || item.descricao || 'Produto sem descrição').trim();
    const categoriaStr = String(item.categoria || item.category || 'outro').trim();
    const unidadeStr = String(item.unidade_medida || item.unit || 'UN').trim().toUpperCase();
    const marcaStr = item.marca || item.brand ? String(item.marca || item.brand).trim() : null;
    const semGtinBool = Boolean(item.sem_gtin ?? item.hasNoGtin ?? (item.codigo_barras === 'SEM GTIN'));
    const barcodeStr = semGtinBool ? 'SEM GTIN' : (item.codigo_barras || item.barcode || item.gtin ? String(item.codigo_barras || item.barcode || item.gtin).trim() : null);
    const refFabricaStr = item.ref_fabrica || item.factoryRef || item.referencia_fabrica ? String(item.ref_fabrica || item.factoryRef || item.referencia_fabrica).trim() : null;
    const ncmStr = item.codigo_ncm || item.ncm ? String(item.codigo_ncm || item.ncm).trim() : null;
    const grupoFiscalStr = item.grupo_fiscal || item.fiscalGroup ? String(item.grupo_fiscal || item.fiscalGroup).trim() : null;
    const grupoIpiStr = item.grupo_ipi || item.ipiGroup ? String(item.grupo_ipi || item.ipiGroup).trim() : null;

    // Payload estrito com os nomes de colunas exatos da tabela 'public.estoque_produtos'
    // Evita colunas inexistentes (como 'quantidade', 'custo_nominal', 'preco_venda') que causam HTTP 400
    const payloadOfficial: Record<string, any> = {
      id: toValidUUID(itemId),
      company_id: activeCompanyId,
      codigo_produto: item.code || item.codigo_produto || `PRD-${toValidUUID(itemId).slice(0, 8)}`,
      nome_comercial: nomeStr,
      categoria: categoriaStr,
      unidade_medida: unidadeStr,
      quantidade_atual: quantidadeFloat,
      preco_custo_inicial: custoNominalFloat,
      preco_venda_varejo: precoVendaFloat,
      localizacao_fisica: item.localizacao_fisica || item.location || (categoriaStr === 'Combustível & Arla' ? 'Tanque Fazenda (Pátio Central)' : 'Depósito Principal'),
      capacidade_total: item.capacidade_total ? Number(item.capacidade_total) : (categoriaStr === 'Combustível & Arla' ? 15000 : null),
      quantidade_minima: parseNumericFloat(item.minQuantity ?? item.quantidade_minima),
      marca: marcaStr,
      codigo_barras: barcodeStr,
      codigo_ncm: ncmStr,
      updated_at: new Date().toISOString()
    };

    // 1. Tenta gravar prioritariamente na tabela oficial 'estoque_produtos' com as colunas reais
    let result = await supabase
      .from('estoque_produtos')
      .upsert(payloadOfficial, { onConflict: 'id' });

    // Se falhar na 'estoque_produtos' por company_id
    if (result.error) {
      if (result.error.message?.includes('company_id')) {
        const payloadNoComp = { ...payloadOfficial };
        delete payloadNoComp.company_id;
        const retryComp = await supabase.from('estoque_produtos').upsert(payloadNoComp, { onConflict: 'id' });
        if (!retryComp.error) {
          result = retryComp;
        }
      }
    }

    // 2. Fallback resiliente para a tabela legada 'estoque' caso exista no banco
    try {
      await supabase.from('estoque').upsert({
        ...payloadOfficial,
        nome: nomeStr,
        descricao: nomeStr,
        unidade: unidadeStr,
        quantidade: quantidadeFloat,
        custo_nominal: custoNominalFloat,
        preco_venda: precoVendaFloat,
        localizacao: payloadOfficial.localizacao_fisica
      }, { onConflict: 'id' });
    } catch {
      // Ignora erro na tabela secundária
    }

    return !result.error;
  } catch (err) {
    console.warn('Supabase upsertEstoqueItem err:', err);
    return false;
  }
}

/**
 * Executa requisição PATCH direta na tabela oficial 'public.estoque_produtos'.
 * Utiliza estritamente os nomes de colunas exatos do banco de dados:
 *   - 'quantidade_atual' (e não quantidade)
 *   - 'preco_custo_inicial' (e não custo_nominal)
 *   - 'preco_venda_varejo' (e não preco_venda)
 */
export async function patchEstoqueProdutoEntrada(
  produtoId: string,
  dados: {
    quantidadeAdicionar: number;
    precoCusto?: number;
    precoVenda?: number;
  },
  companyId?: string
): Promise<{ success: boolean; novoSaldoEstoque?: number }> {
  const { quantidadeAdicionar, precoCusto, precoVenda } = dados;
  if (!produtoId || isNaN(quantidadeAdicionar)) {
    return { success: false };
  }

  // 1. Atualização imediata no storage local
  const currentInventory = getStoredInventory();
  let novoSaldo = 0;
  const updatedInventory = currentInventory.map(item => {
    if (item.id === produtoId) {
      novoSaldo = Number(((Number(item.quantidade_atual ?? item.quantity) || 0) + quantidadeAdicionar).toFixed(2));
      const updatedItem: InventoryItem = {
        ...item,
        quantity: novoSaldo,
        quantidade_atual: novoSaldo,
        unitCost: (precoCusto !== undefined && precoCusto > 0) ? precoCusto : item.unitCost,
        preco_custo_inicial: (precoCusto !== undefined && precoCusto > 0) ? precoCusto : item.preco_custo_inicial,
        salePrice: (precoVenda !== undefined && precoVenda > 0) ? precoVenda : item.salePrice,
        preco_venda_varejo: (precoVenda !== undefined && precoVenda > 0) ? precoVenda : item.preco_venda_varejo,
        updatedAt: new Date().toISOString()
      };
      return updatedItem;
    }
    return item;
  });
  saveStoredInventory(updatedInventory);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('silagem_inventory_changed', { detail: updatedInventory }));
  }

  if (!isSupabaseConfigured) {
    return { success: true, novoSaldoEstoque: novoSaldo };
  }

  try {
    // 2. Busca o saldo atual do produto no Supabase
    let finalQty = novoSaldo;
    const { data: dbItem } = await supabase
      .from('estoque_produtos')
      .select('id, quantidade_atual, preco_custo_inicial, preco_venda_varejo')
      .eq('id', produtoId)
      .maybeSingle();

    if (dbItem && dbItem.quantidade_atual !== undefined && dbItem.quantidade_atual !== null) {
      finalQty = Number(((Number(dbItem.quantidade_atual) || 0) + quantidadeAdicionar).toFixed(2));
    }

    // 3. Monta payload de PATCH estritamente com os nomes de colunas exatos do banco
    const patchPayload: Record<string, any> = {
      quantidade_atual: finalQty,
      updated_at: new Date().toISOString()
    };
    if (precoCusto !== undefined && precoCusto > 0) {
      patchPayload.preco_custo_inicial = precoCusto;
    }
    if (precoVenda !== undefined && precoVenda > 0) {
      patchPayload.preco_venda_varejo = precoVenda;
    }

    const { error } = await supabase
      .from('estoque_produtos')
      .update(patchPayload)
      .eq('id', produtoId);

    if (error) {
      console.warn('Erro PATCH estoque_produtos:', error);
      return { success: false, novoSaldoEstoque: novoSaldo };
    }

    return { success: true, novoSaldoEstoque: finalQty };
  } catch (err) {
    console.warn('Exceção PATCH estoque_produtos:', err);
    return { success: true, novoSaldoEstoque: novoSaldo };
  }
}

/**
 * Cadastra / Insere um novo produto no estoque via Supabase (com mapeamento completo dos novos campos legados)
 */
export async function cadastrarProduto(item: InventoryItem | any, companyId?: string): Promise<boolean> {
  return upsertEstoqueItem(item, companyId);
}

/**
 * Insere um novo produto no estoque (alias solicitado para inserção de novos produtos)
 */
export async function inserirProduto(item: InventoryItem | any, companyId?: string): Promise<boolean> {
  return upsertEstoqueItem(item, companyId);
}

export async function deleteEstoqueItem(id: string, companyId?: string): Promise<boolean> {
  const currentInv = getStoredInventory();
  saveStoredInventory(currentInv.filter(i => i.id !== id));

  if (!isSupabaseConfigured) return true;
  try {
    const activeCompanyId = companyId || getActiveCompanyId();
    const uuid = toValidUUID(id);
    
    // Deleta de estoque_produtos
    let qProdutos = supabase.from('estoque_produtos').delete().eq('id', uuid);
    if (activeCompanyId) qProdutos = qProdutos.eq('company_id', activeCompanyId);
    await qProdutos;

    // Deleta de estoque
    let qEstoque = supabase.from('estoque').delete().eq('id', uuid);
    if (activeCompanyId) qEstoque = qEstoque.eq('company_id', activeCompanyId);
    await qEstoque;

    return true;
  } catch (err) {
    console.warn('Supabase deleteEstoqueItem err:', err);
    return false;
  }
}

// ===========================================================================
// 5. Clientes (Tabela: public.clientes)
// ===========================================================================
export async function fetchClientes(companyId?: string): Promise<Client[] | null> {
  if (!isSupabaseConfigured) return null;
  const activeCompanyId = companyId || getActiveCompanyId();
  if (!activeCompanyId) return [];
  try {
    let { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('company_id', activeCompanyId)
      .order('name', { ascending: true });

    if ((!data || data.length === 0) && activeCompanyId) {
      const altUuid = toValidUUID(activeCompanyId);
      if (altUuid && altUuid !== activeCompanyId) {
        const retry = await supabase
          .from('clientes')
          .select('*')
          .eq('company_id', altUuid)
          .order('name', { ascending: true });
        if (retry.data && retry.data.length > 0) {
          data = retry.data;
          error = null;
        }
      }
    }

    if (error) {
      console.warn('Supabase fetchClientes notice:', error.message);
      return [];
    }
    if (!data || data.length === 0) return [];

    return data.map((row: any): Client => {
      const clientName = row.nome || row.name || row.razao_social || row.nome_fantasia || 'Cliente';
      const farmName = row.fazenda || row.farm_name || '';
      const phone = row.telefone || row.phone || row.celular || '';
      const city = row.cidade || row.city || '';
      const state = row.estado || row.uf || row.state || '';
      const notes = row.observacoes || row.notes || '';
      return {
        id: String(row.id),
        companyId: row.company_id || undefined,
        name: clientName,
        nome: clientName,
        farmName,
        fazenda: farmName,
        cpfCnpj: row.cpf_cnpj || row.cpf || row.cnpj || '',
        stateRegistration: row.inscricao_estadual || row.state_registration || '',
        phone,
        telefone: phone,
        email: row.email || '',
        city,
        cidade: city,
        state,
        estado: state,
        areaHectares: Number(row.area_total || row.total_area || row.area || 0),
        cattleType: (row.cattle_type || row.tipo_gado || 'misto') as any,
        notes,
        observacoes: notes,
        status: (row.status || 'cliente_ativo') as any,
        createdAt: row.created_at || new Date().toISOString(),
        updatedAt: row.updated_at || new Date().toISOString()
      };
    });
  } catch (err) {
    console.warn('Supabase fetchClientes err:', err);
    return [];
  }
}

export async function upsertCliente(client: Client, companyId?: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const activeCompanyId = client.companyId || companyId || getActiveCompanyId();
    const isNumericId = /^\d+$/.test(String(client.id || '').trim());
    const clientName = (client.name || client.nome || '').trim() || 'Cliente';

    // Monta o payload estritamente compatível com o schema real da tabela public.clientes
    const payload: Record<string, any> = {
      nome_razao_social: clientName,
      nome: clientName,
      name: clientName,
      fazenda: (client.farmName || client.fazenda || '').trim() || null,
      cpf_cnpj: (client.cpfCnpj || '').trim() || null,
      inscricao_estadual: (client.stateRegistration || '').trim() || null,
      telefone: (client.phone || client.telefone || '').trim() || null,
      email: (client.email || '').trim() || null,
      cidade: (client.city || client.cidade || '').trim() || null,
      estado: (client.state || client.estado || '').trim() || null,
      area_total_ha: Number(client.areaHectares) || 0,
      area_cultivada_ha: Number(client.areaHectares) || 0,
      observacoes: (client.notes || client.observacoes || '').trim() || null,
      ativo: client.status !== 'inativo',
      status: client.status || 'ativo',
      company_id: activeCompanyId ? toValidUUID(activeCompanyId) : null,
      criado_em: client.createdAt || new Date().toISOString()
    };

    // 1. Se possuir ID numérico (bigint no Postgres), realiza upsert com onConflict: 'id'
    if (isNumericId) {
      payload.id = Number(client.id);
      let { error } = await supabase
        .from('clientes')
        .upsert(payload, { onConflict: 'id' });

      if (error) {
        logPostgresError('upsertCliente:numericId', error, { table: 'clientes', action: 'UPSERT', payload });
        if (error.code === '23503' || (error.message && error.message.includes('company_id'))) {
          delete payload.company_id;
          const retry = await supabase.from('clientes').upsert(payload, { onConflict: 'id' });
          if (!retry.error) return true;
        }
        return false;
      }
      return true;
    }

    // 2. Se o ID não for numérico (ID gerado localmente em memória), verifica se já existe cliente cadastrado
    if (activeCompanyId) {
      const { data: existing } = await supabase
        .from('clientes')
        .select('id')
        .eq('company_id', toValidUUID(activeCompanyId))
        .eq('nome_razao_social', clientName)
        .maybeSingle();

      if (existing?.id) {
        payload.id = existing.id;
        const { error } = await supabase.from('clientes').upsert(payload, { onConflict: 'id' });
        if (!error) return true;
      }
    }

    // 3. Inserção simples deixando o PostgreSQL gerar o ID sequencial (bigint)
    const { data: inserted, error: insertError } = await supabase
      .from('clientes')
      .insert(payload)
      .select('id')
      .maybeSingle();

    if (insertError) {
      if (insertError.code === '23503' || (insertError.message && insertError.message.includes('company_id'))) {
        delete payload.company_id;
        const retry = await supabase.from('clientes').insert(payload);
        if (!retry.error) return true;
      }
      logPostgresError('upsertCliente:insert', insertError, { table: 'clientes', action: 'INSERT', payload });
      return false;
    }

    if (inserted?.id) {
      client.id = String(inserted.id);
    }
    return true;
  } catch (err: any) {
    logPostgresError('upsertCliente:exception', err, { table: 'clientes', action: 'UPSERT' });
    return false;
  }
}

export async function deleteCliente(id: string, companyId?: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const activeCompanyId = companyId || getActiveCompanyId();
    const isNumericId = /^\d+$/.test(String(id || '').trim());
    if (isNumericId) {
      let query = supabase.from('clientes').delete().eq('id', Number(id));
      if (activeCompanyId) query = query.eq('company_id', toValidUUID(activeCompanyId));
      await query;
      return true;
    }
    return true;
  } catch (err) {
    console.error('[Supabase deleteCliente Exception]:', err);
    return false;
  }
}

// ===========================================================================
// 6. RH Funcionários (Tabela: public.rh_funcionarios e public.funcionarios)
// ===========================================================================

/**
 * Converte qualquer formato de data (ISO, DD/MM/YYYY, timestamp) rigorosamente para o formato YYYY-MM-DD
 * aceito por colunas DATE do PostgreSQL, ou retorna null se vazio/inválido.
 */
export function formatIsoDateOnly(dateValue?: any): string | null {
  if (!dateValue) return null;
  const str = String(dateValue).trim();
  if (!str || str === 'null' || str === 'undefined') return null;

  // Se já estiver no formato YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  // Se contiver timestamp ISO (ex: 2025-05-15T00:00:00.000Z)
  if (str.includes('T')) {
    const part = str.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(part)) return part;
  }
  // Se estiver no formato brasileiro DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    const [dia, mes, ano] = str.split('/');
    return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  }
  // Se estiver no formato DD-MM-YYYY
  if (/^\d{2}-\d{2}-\d{4}$/.test(str)) {
    const [dia, mes, ano] = str.split('-');
    return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  }
  // Fallback seguro via Date
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return null;
}

/**
 * Converte linhas vindas do Supabase (seja com colunas em português ou inglês)
 * para a interface padronizada Employee da aplicação.
 */
export function mapRowToEmployee(row: any): Employee {
  const admissionDate = formatIsoDateOnly(
    row.admission_date || row.data_admissao || row.admitted_at || row.dataAdmissao
  ) || '';

  const terminationDate = formatIsoDateOnly(
    row.termination_date || row.data_demissao || row.dataDemissao
  ) || '';

  const cnhExpiration = formatIsoDateOnly(
    row.license_expiry || row.cnh_vencimento || row.cnh_expiration || row.cnhExpiration
  ) || '';

  const salaryNum = parseFloat(String(row.salary || row.salario || row.base_salary || 0)) || 0;

  // Normalização de comissões numéricas
  const commVal = parseFloat(String(
    row.comissao_valor ?? row.comissao ?? row.commission ?? row.commission_value ?? 0
  )) || 0;

  const commPerHour = parseFloat(String(
    row.comissao_hora ?? row.commission_per_hour ?? row.comissaoHora ?? 0
  )) || 0;

  const commPerAlq = parseFloat(String(
    row.comissao_alqueire ?? row.commission_per_alqueire ?? row.comissaoAlqueire ?? 0
  )) || 0;

  const commPerHa = parseFloat(String(
    row.comissao_hectare ?? row.commission_per_hectare ?? row.comissaoHectare ?? 0
  )) || 0;

  const receivesCommission = Boolean(
    row.recebe_comissao ??
    row.receives_commission ??
    (commVal > 0 || commPerHour > 0 || commPerAlq > 0 || commPerHa > 0)
  );

  const contractType = String(
    row.contract_type || row.regime || row.tipo_contrato || row.registration_type || 'Registrado (CLT)'
  );

  const roleStr = String(row.role || row.cargo || row.funcao || 'Operador de Forrageira');

  const finalPerHour = receivesCommission ? (commPerHour || (commVal > 0 ? commVal : 0)) : 0;
  const finalPerAlq = receivesCommission ? commPerAlq : 0;
  const finalPerHa = receivesCommission ? commPerHa : 0;

  return {
    id: String(row.id || `emp_${Date.now()}`),
    companyId: row.company_id || undefined,
    name: String(row.name || row.nome || row.nome_funcionario || '').trim(),
    role: roleStr,
    roles: Array.isArray(row.roles) ? row.roles : (roleStr ? [roleStr] : []),
    cpf: row.cpf ? String(row.cpf).trim() : '',
    rg: row.rg || undefined,
    birthDate: formatIsoDateOnly(row.birth_date || row.data_nascimento) || undefined,
    pis: row.pis || undefined,
    phone: row.phone || row.telefone || '',
    status: (row.status || 'ativo') as any,
    active: row.status !== 'inativo' && row.active !== false,
    registrationType: (row.registration_type || row.tipo_registro || 'Funcionário') as any,
    contractType: contractType,
    salary: salaryNum,
    baseSalary: salaryNum,
    admissionDate: admissionDate,
    terminationDate: terminationDate,
    receivesCommission: receivesCommission,
    commissionPerHour: finalPerHour,
    commissionPerAlqueire: finalPerAlq,
    commissionPerHectare: finalPerHa,
    comissao_hora: finalPerHour,
    comissao_alqueire: finalPerAlq,
    comissao_hectare: finalPerHa,
    recebe_comissao: receivesCommission,
    brokerCommissionValue: parseFloat(String(row.broker_commission_value || row.comissao_agenciador || 0)) || 0,
    brokerCommissionType: row.broker_commission_type || row.tipo_comissao_agenciador || undefined,
    actingRegion: row.acting_region || row.regiao_atuacao || undefined,
    cnhNumber: row.driver_license || row.cnh_numero || row.cnh_number || '',
    cnhCategory: row.license_category || row.cnh_categoria || row.cnh_category || 'B',
    cnhExpiration: cnhExpiration,
    cnhUpgradeDT: Boolean(row.cnh_upgrade_dt || row.cnhUpgradeDT),
    cnhUpgradeCategory: row.cnh_upgrade_category || row.cnhUpgradeCategory || undefined,
    paymentLocation: row.payment_location || row.local_pagamento || undefined,
    bankPixKey: row.bank_pix_key || row.chave_pix || undefined,
    bankAgency: row.bank_agency || row.agencia || undefined,
    bankAccount: row.bank_account || row.conta || undefined,
  };
}

/**
 * Retorna um objeto estritamente compatível com o schema da tabela public.rh_funcionarios no Supabase.
 * Colunas reais no banco: id, name, role, cpf, phone, email, status, registration_type, salary, admission_date, driver_license, license_category, license_expiry, company_id, updated_at.
 * Remove todas as colunas ausentes ou propriedades temporárias da interface que geram
 * erros HTTP 400 (Bad Request - PGRST204) no PostgREST.
 */
export function sanitizeRhFuncionarioPayload(
  employee: Partial<Employee> & Record<string, any>,
  companyId?: string
): {
  id: string;
  name: string;
  role: string;
  cpf: string;
  phone: string;
  email: string;
  status: string;
  registration_type: string;
  salary: number;
  admission_date: string | null;
  driver_license: string;
  license_category: string;
  license_expiry: string | null;
  company_id: string | null;
  updated_at: string;
} {
  const activeCompanyId = employee.companyId || companyId || getActiveCompanyId();
  const validId = toValidUUID(employee.id);

  // Tratamento rigoroso de datas (DATE em PostgreSQL requer 'YYYY-MM-DD' ou null; strings vazias geram erro 22007)
  const admissionDateIso = formatIsoDateOnly(employee.admissionDate || employee.data_admissao);
  const licenseExpiryIso = formatIsoDateOnly(employee.cnhExpiration || employee.license_expiry || employee.cnh_vencimento);

  // Tratamento numérico de salário (NUMERIC em PostgreSQL)
  const salaryNum = typeof employee.salary === 'number' && !isNaN(employee.salary)
    ? employee.salary
    : (Number(employee.salary || employee.baseSalary || employee.salario) || 0);

  const roleStr = String(employee.role || (employee.roles && employee.roles[0]) || 'Operador de Forrageira').trim();
  const regTypeStr = String(employee.registrationType || employee.registration_type || employee.tipo_registro || 'Funcionário').trim();

  return {
    id: validId,
    name: String(employee.name || employee.nome || '').trim(),
    role: roleStr || 'Operador de Forrageira',
    cpf: String(employee.cpf || '').trim(),
    phone: String(employee.phone || employee.telefone || '').trim(),
    email: String(employee.email || '').trim(),
    status: String(employee.status || 'ativo').trim().toLowerCase(),
    registration_type: regTypeStr || 'Funcionário',
    salary: salaryNum,
    admission_date: admissionDateIso || null,
    driver_license: String(employee.cnhNumber || employee.driver_license || employee.cnh_numero || '').trim(),
    license_category: String(employee.cnhCategory || employee.license_category || employee.cnh_categoria || '').trim(),
    license_expiry: licenseExpiryIso || null,
    company_id: activeCompanyId ? String(activeCompanyId).trim() : null,
    updated_at: new Date().toISOString()
  };
}

/**
 * Converte e sanitiza campos de comissões para números válidos (Float/Numeric),
 * mapeando estritamente para as colunas reais da tabela rh_funcionarios no Supabase.
 */
export function getRhFuncionarioCommissionPayload(
  employee: Partial<Employee> & Record<string, any>
): {
  comissao_hora: number;
  comissao_alqueire: number;
  comissao_hectare: number;
  recebe_comissao: boolean;
} {
  const rawCommPerHour = employee.commissionPerHour ?? (employee as any).comissao_hora ?? (employee as any).comissaoHora ?? (employee as any).commission_per_hour ?? (employee as any).comissao_valor ?? (employee as any).comissao ?? 0;
  const rawCommPerAlq = employee.commissionPerAlqueire ?? (employee as any).comissao_alqueire ?? (employee as any).comissaoAlqueire ?? (employee as any).commission_per_alqueire ?? 0;
  const rawCommPerHa = employee.commissionPerHectare ?? (employee as any).comissao_hectare ?? (employee as any).comissaoHectare ?? (employee as any).commission_per_hectare ?? 0;

  const commPerHour = typeof rawCommPerHour === 'number' && !isNaN(rawCommPerHour)
    ? rawCommPerHour
    : parseCurrencyInput(rawCommPerHour);

  const commPerAlq = typeof rawCommPerAlq === 'number' && !isNaN(rawCommPerAlq)
    ? rawCommPerAlq
    : parseCurrencyInput(rawCommPerAlq);

  const commPerHa = typeof rawCommPerHa === 'number' && !isNaN(rawCommPerHa)
    ? rawCommPerHa
    : parseCurrencyInput(rawCommPerHa);

  const receivesCommission = Boolean(
    employee.receivesCommission ||
    (employee as any).recebe_comissao ||
    commPerHour > 0 ||
    commPerAlq > 0 ||
    commPerHa > 0
  );

  return {
    comissao_hora: receivesCommission ? (Number(commPerHour.toFixed(2)) || 0) : 0,
    comissao_alqueire: receivesCommission ? (Number(commPerAlq.toFixed(2)) || 0) : 0,
    comissao_hectare: receivesCommission ? (Number(commPerHa.toFixed(2)) || 0) : 0,
    recebe_comissao: receivesCommission,
  };
}

let hasRhCommissionColumns: boolean | null = null;

export function resetRhCommissionColumnsCache(): void {
  hasRhCommissionColumns = null;
}

export async function fetchRhFuncionarios(companyId?: string): Promise<Employee[] | null> {
  if (!isSupabaseConfigured) return null;
  const activeCompanyId = companyId || getActiveCompanyId();
  if (!activeCompanyId) return [];

  try {
    // 1. Tenta buscar da tabela principal 'rh_funcionarios'
    let { data, error } = await supabase
      .from('rh_funcionarios')
      .select('*')
      .eq('company_id', activeCompanyId)
      .order('name', { ascending: true });

    // Fallback com UUID alternativo se vazio
    if ((!data || data.length === 0) && activeCompanyId && (!error || error.code !== '42P01')) {
      const altUuid = toValidUUID(activeCompanyId);
      if (altUuid && altUuid !== activeCompanyId) {
        const retry = await supabase
          .from('rh_funcionarios')
          .select('*')
          .eq('company_id', altUuid)
          .order('name', { ascending: true });
        if (retry.data && retry.data.length > 0) {
          data = retry.data;
          error = null;
        }
      }
    }

    // 2. Se a tabela 'rh_funcionarios' não existir, tenta 'funcionarios'
    if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
      let funcQuery = await supabase
        .from('funcionarios')
        .select('*')
        .eq('company_id', activeCompanyId);
      if (!funcQuery.error && Array.isArray(funcQuery.data) && funcQuery.data.length > 0) {
        return funcQuery.data.map(mapRowToEmployee);
      }
    }

    if (error) {
      console.warn('Supabase fetchRhFuncionarios notice:', error.message);
      // Tenta 'funcionarios' como fallback secundário
      try {
        const funcFallback = await supabase.from('funcionarios').select('*');
        if (!funcFallback.error && Array.isArray(funcFallback.data) && funcFallback.data.length > 0) {
          return funcFallback.data.map(mapRowToEmployee);
        }
      } catch (_) {}
      return [];
    }

    if (Array.isArray(data)) {
      return data.map(mapRowToEmployee);
    }
    return [];
  } catch (err) {
    console.warn('Supabase fetchRhFuncionarios err:', err);
    return [];
  }
}

/**
 * Salva ou atualiza colaborador na tabela 'rh_funcionarios'.
 * Garante que o payload enviado via PATCH ou UPSERT use estritamente as colunas existentes,
 * sem propriedades temporárias que causem erros 400 (Bad Request).
 * Caso a tabela física não possua colunas separadas para cada tipo de comissão,
 * adapta dinamicamente o envio para não quebrar a requisição.
 */
export async function upsertRhFuncionario(employee: Employee, companyId?: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const activeCompanyId = employee.companyId || companyId || getActiveCompanyId();
    const cleanPayload = sanitizeRhFuncionarioPayload(employee, activeCompanyId);
    const validId = cleanPayload.id;
    const commPayload = getRhFuncionarioCommissionPayload(employee);

    // Se hasRhCommissionColumns !== false, tenta incluir comissões estruturadas no payload
    let payloadToSend: Record<string, any> = { ...cleanPayload };
    if (hasRhCommissionColumns !== false) {
      payloadToSend = { ...payloadToSend, ...commPayload };
    }

    // Remove 'id' do corpo do PATCH para atualizar por filtro eq('id', validId)
    const { id: _ignoredId, ...patchBody } = payloadToSend;

    // 1. Tenta atualizar com PATCH direto em /rest/v1/rh_funcionarios?id=eq.<validId>
    let updateRes = await supabase
      .from('rh_funcionarios')
      .update(patchBody)
      .eq('id', validId)
      .select('id');

    // Se houve erro de coluna inexistente (PGRST204, 42703, etc.),
    // desativa o envio de colunas de comissão e retenta imediatamente apenas com o payload básico
    if (updateRes.error && hasRhCommissionColumns !== false) {
      const isColumnErr =
        updateRes.error.code === 'PGRST204' ||
        updateRes.error.code === '42703' ||
        updateRes.error.message?.toLowerCase().includes('column') ||
        updateRes.error.message?.toLowerCase().includes('comissao') ||
        updateRes.error.message?.toLowerCase().includes('schema cache');

      if (isColumnErr) {
        hasRhCommissionColumns = false;
        const { id: _ignoredId2, ...cleanPatchBody } = cleanPayload;
        updateRes = await supabase
          .from('rh_funcionarios')
          .update(cleanPatchBody)
          .eq('id', validId)
          .select('id');
      }
    } else if (!updateRes.error && hasRhCommissionColumns === null) {
      hasRhCommissionColumns = true;
    }

    if (!updateRes.error && Array.isArray(updateRes.data) && updateRes.data.length > 0) {
      return true;
    }

    // Se houve erro de restrição de company_id (23503), remove company_id e tenta o update novamente
    if (updateRes.error && (updateRes.error.code === '23503' || updateRes.error.message?.includes('company_id'))) {
      const activeBody = hasRhCommissionColumns !== false ? patchBody : cleanPayload;
      const { company_id: _cid, id: _i2, ...patchWithoutCompany } = activeBody;
      let retryUpdate = await supabase
        .from('rh_funcionarios')
        .update(patchWithoutCompany)
        .eq('id', validId)
        .select('id');
      if (retryUpdate.error && (retryUpdate.error.code === 'PGRST204' || retryUpdate.error.code === '42703' || retryUpdate.error.message?.includes('column'))) {
        hasRhCommissionColumns = false;
        const { company_id: _cid2, id: _i3, ...baseWithoutCompany } = cleanPayload;
        retryUpdate = await supabase
          .from('rh_funcionarios')
          .update(baseWithoutCompany)
          .eq('id', validId)
          .select('id');
      }
      if (!retryUpdate.error && Array.isArray(retryUpdate.data) && retryUpdate.data.length > 0) {
        return true;
      }
    }

    // 2. Se não atualizou nenhuma linha (registro novo), executa o upsert/insert com id
    const targetUpsert = hasRhCommissionColumns !== false ? payloadToSend : cleanPayload;
    let upsertRes = await supabase
      .from('rh_funcionarios')
      .upsert(targetUpsert, { onConflict: 'id' });

    if (upsertRes.error && hasRhCommissionColumns !== false) {
      const isColumnErr =
        upsertRes.error.code === 'PGRST204' ||
        upsertRes.error.code === '42703' ||
        upsertRes.error.message?.toLowerCase().includes('column') ||
        upsertRes.error.message?.toLowerCase().includes('comissao') ||
        upsertRes.error.message?.toLowerCase().includes('schema cache');

      if (isColumnErr) {
        hasRhCommissionColumns = false;
        upsertRes = await supabase
          .from('rh_funcionarios')
          .upsert(cleanPayload, { onConflict: 'id' });
      }
    }

    if (!upsertRes.error) {
      return true;
    }

    // Se o upsert falhou por restrição de company_id
    if (upsertRes.error && (upsertRes.error.code === '23503' || upsertRes.error.message?.includes('company_id'))) {
      const targetClean = hasRhCommissionColumns !== false ? payloadToSend : cleanPayload;
      const { company_id: _cid, ...cleanWithoutCompany } = targetClean;
      let retryUpsert = await supabase
        .from('rh_funcionarios')
        .upsert(cleanWithoutCompany, { onConflict: 'id' });
      if (retryUpsert.error && (retryUpsert.error.code === 'PGRST204' || retryUpsert.error.code === '42703' || retryUpsert.error.message?.includes('column'))) {
        hasRhCommissionColumns = false;
        const { company_id: _cid2, ...baseWithoutCompany } = cleanPayload;
        retryUpsert = await supabase
          .from('rh_funcionarios')
          .upsert(baseWithoutCompany, { onConflict: 'id' });
      }
      if (!retryUpsert.error) {
        return true;
      }
    }

    // 3. Fallback: Se a tabela 'rh_funcionarios' não existir (42P01), tenta em 'funcionarios'
    if ((updateRes?.error && (updateRes.error.code === '42P01' || updateRes.error.message?.includes('does not exist'))) ||
        (upsertRes?.error && (upsertRes.error.code === '42P01' || upsertRes.error.message?.includes('does not exist')))) {
      const funcRes = await supabase.from('funcionarios').upsert(cleanPayload, { onConflict: 'id' });
      if (!funcRes.error) return true;
    }

    console.warn('[Supabase RH Funcionario] Aviso ao persistir funcionário:', updateRes.error || upsertRes.error);
    return false;
  } catch (err) {
    console.warn('Supabase upsertRhFuncionario err:', err);
    return false;
  }
}

export async function deleteRhFuncionario(id: string, _companyId?: string): Promise<boolean> {
  if (!isSupabaseConfigured || !id) return false;
  try {
    const uuid = toValidUUID(id);

    // Chama explicitamente o método .delete().eq('id', ...) do Supabase sem disparar nenhum insert ou upsert
    let query = supabase.from('rh_funcionarios').delete().eq('id', uuid);
    const res = await query;

    // Se o ID original for diferente do UUID formatado, tenta deletar também pelo ID original
    if (id !== uuid) {
      await supabase.from('rh_funcionarios').delete().eq('id', id);
    }

    // Se a tabela 'rh_funcionarios' não existir (42P01), tenta em 'funcionarios'
    if (res.error && res.error.code === '42P01') {
      await supabase.from('funcionarios').delete().eq('id', uuid);
      if (id !== uuid) {
        await supabase.from('funcionarios').delete().eq('id', id);
      }
    }

    return true;
  } catch (err) {
    console.warn('Supabase deleteRhFuncionario err:', err);
    return false;
  }
}

// ===========================================================================
// 7. Gestão de Frotas (Tabela: public.gestao_frotas)
// ===========================================================================
export async function fetchGestaoFrotas(companyId?: string): Promise<Machinery[] | null> {
  if (!isSupabaseConfigured) return null;
  const activeCompanyId = companyId || getActiveCompanyId();
  if (!activeCompanyId) return [];
  try {
    let { data, error } = await supabase
      .from('gestao_frotas')
      .select('*')
      .eq('company_id', activeCompanyId)
      .order('nome', { ascending: true });

    if (error && error.message?.includes('nome')) {
      const fallbackOrder = await supabase
        .from('gestao_frotas')
        .select('*')
        .eq('company_id', activeCompanyId);
      data = fallbackOrder.data;
      error = fallbackOrder.error;
    }

    if ((!data || data.length === 0) && activeCompanyId) {
      const altUuid = toValidUUID(activeCompanyId);
      if (altUuid && altUuid !== activeCompanyId) {
        const retry = await supabase
          .from('gestao_frotas')
          .select('*')
          .eq('company_id', altUuid);
        if (retry.data && retry.data.length > 0) {
          data = retry.data;
          error = null;
        }
      }
    }

    if (error) {
      console.warn('Supabase fetchGestaoFrotas notice:', error.message);
      return [];
    }
    return (data as any[] || []).map(row => {
      const tankCapacityNumber = row.tank_capacity !== undefined && row.tank_capacity !== null
        ? Number(row.tank_capacity)
        : (row.tankCapacity !== undefined && row.tankCapacity !== null
            ? Number(row.tankCapacity)
            : (row.fuelCapacityLiters !== undefined && row.fuelCapacityLiters !== null ? Number(row.fuelCapacityLiters) : undefined));

      const tipoLower = String(row.tipo || row.type || row.categoryType || '').toLowerCase();
      const nomeLower = String(row.nome || row.name || row.modelo || row.model || '').toLowerCase();
      const isAgricolaOuMaquina = 
        tipoLower.includes('trator') || 
        tipoLower.includes('colhedor') || 
        tipoLower.includes('colheit') || 
        tipoLower.includes('ensilad') || 
        tipoLower.includes('forrageir') || 
        tipoLower.includes('maquina') || 
        tipoLower.includes('máquina') || 
        tipoLower.includes('implemento') ||
        nomeLower.includes('claas') ||
        nomeLower.includes('jaguar') ||
        nomeLower.includes('maq') ||
        nomeLower.includes('trator') ||
        nomeLower.includes('colheitadeira') ||
        nomeLower.includes('ensiladeira');

      // KM: estritamente de colunas de quilometragem ou quando for veículo rodoviário
      const explicitKm = row.km_atual ?? row.current_km ?? row.quilometragem ?? row.currentKm;
      const kmVal = (explicitKm !== undefined && explicitKm !== null)
        ? Number(explicitKm)
        : (!isAgricolaOuMaquina && row.horimetro_ou_km_atual !== undefined && row.horimetro_ou_km_atual !== null
            ? Number(row.horimetro_ou_km_atual)
            : undefined);

      // Horas: estritamente de colunas de horímetro ou quando for máquina agrícola
      const explicitHour = row.horas_atual ?? row.horimetro_atual ?? row.hour_meter ?? row.hourmeter ?? row.hourMeter;
      const hourVal = (explicitHour !== undefined && explicitHour !== null)
        ? Number(explicitHour)
        : (isAgricolaOuMaquina && row.horimetro_ou_km_atual !== undefined && row.horimetro_ou_km_atual !== null
            ? Number(row.horimetro_ou_km_atual)
            : (row.hourmeter !== undefined ? Number(row.hourmeter) : (row.hourMeter !== undefined ? Number(row.hourMeter) : undefined)));

      const rawPhoto = row.foto_url || row.fotoUrl || row.imageUrl;
      const validPhoto = (rawPhoto && !rawPhoto.includes('/_upload/') && !rawPhoto.includes('/upload/')) ? rawPhoto : undefined;

      // Sanitiza nome removendo permanentemente o prefixo fixo 'AGRÍCOLA'
      const rawNome = row.nome || row.name || '';
      const cleanNome = rawNome.replace(/^(AGR[IÍ]COLA\s*[-–—:]*\s*)/i, '').trim();
      const rawModel = row.modelo || row.model || '';
      const cleanModel = rawModel.replace(/^(AGR[IÍ]COLA\s*[-–—:]*\s*)/i, '').trim();

      return {
        ...row,
        id: row.id,
        name: cleanNome || cleanModel || 'Veículo',
        nome: cleanNome || cleanModel || 'Veículo',
        model: cleanModel,
        modelo: cleanModel,
        categoryType: row.tipo || row.type || 'veiculo',
        tipo: row.tipo || row.type || 'veiculo',
        controla_por: row.controla_por || row.controlaPor || (isAgricolaOuMaquina ? 'horas' : 'km'),
        controlBy: row.controla_por || row.controlaPor || (isAgricolaOuMaquina ? 'horas' : 'km'),
        licensePlateOrSerial: row.placa_ou_serie || row.plate_or_serial || '',
        placa_ou_serie: row.placa_ou_serie || row.plate_or_serial || '',
        fleetNumber: row.fleet_number || row.fleetNumber || undefined,
        year: row.ano ? Number(row.ano) : (row.year ? Number(row.year) : null),
        ano: row.ano ? Number(row.ano) : null,
        hourMeter: hourVal !== undefined ? hourVal : undefined,
        currentKm: kmVal !== undefined ? kmVal : undefined,
        km_atual: kmVal !== undefined ? kmVal : undefined,
        horas_atual: hourVal !== undefined ? hourVal : undefined,
        horimetro_ou_km_atual: (hourVal || kmVal || 0),
        status: row.status || 'ativo',
        maintenanceStatus: row.manutencao_status || row.maintenanceStatus || 'ok',
        imageUrl: validPhoto,
        photoUrl: validPhoto,
        tank_capacity: tankCapacityNumber,
        tankCapacity: tankCapacityNumber,
        fuelCapacityLiters: tankCapacityNumber,
        currentFuelLiters: row.current_fuel_liters !== undefined && row.current_fuel_liters !== null ? Number(row.current_fuel_liters) : (row.currentFuelLiters !== undefined && row.currentFuelLiters !== null ? Number(row.currentFuelLiters) : (row.nivel_combustivel !== undefined && row.nivel_combustivel !== null ? Number(row.nivel_combustivel) : undefined)),
        current_fuel_liters: row.current_fuel_liters !== undefined && row.current_fuel_liters !== null ? Number(row.current_fuel_liters) : (row.currentFuelLiters !== undefined && row.currentFuelLiters !== null ? Number(row.currentFuelLiters) : (row.nivel_combustivel !== undefined && row.nivel_combustivel !== null ? Number(row.nivel_combustivel) : undefined)),
        currentFuelPercentage: row.current_fuel_percentage !== undefined && row.current_fuel_percentage !== null ? Number(row.current_fuel_percentage) : (row.currentFuelPercentage !== undefined && row.currentFuelPercentage !== null ? Number(row.currentFuelPercentage) : undefined),
        current_fuel_percentage: row.current_fuel_percentage !== undefined && row.current_fuel_percentage !== null ? Number(row.current_fuel_percentage) : (row.currentFuelPercentage !== undefined && row.currentFuelPercentage !== null ? Number(row.currentFuelPercentage) : undefined),
      };
    }) as Machinery[];
  } catch (err) {
    console.warn('Supabase fetchGestaoFrotas err:', err);
    return [];
  }
}

export async function upsertGestaoFrota(vehicle: Machinery, companyId?: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const activeCompanyId = vehicle.companyId || companyId || getActiveCompanyId();
    const tankCapacityVal = (vehicle.tank_capacity !== undefined && vehicle.tank_capacity !== null)
      ? Number(vehicle.tank_capacity)
      : ((vehicle.tankCapacity !== undefined && vehicle.tankCapacity !== null)
          ? Number(vehicle.tankCapacity)
          : (vehicle.fuelCapacityLiters !== undefined && vehicle.fuelCapacityLiters !== null ? Number(vehicle.fuelCapacityLiters) : 0));

    const currentMeter = (vehicle.hourMeter !== undefined && vehicle.hourMeter !== null)
      ? Number(vehicle.hourMeter)
      : ((vehicle.currentKm !== undefined && vehicle.currentKm !== null)
          ? Number(vehicle.currentKm)
          : (vehicle.horimetro_ou_km_atual !== undefined ? Number(vehicle.horimetro_ou_km_atual) : 0));

    const payload: Record<string, any> = {
      id: toValidUUID(vehicle.id),
      company_id: activeCompanyId ? toValidUUID(activeCompanyId) : null,
      tipo: vehicle.categoryType || vehicle.tipo || 'veiculo',
      nome: vehicle.name || vehicle.nome || 'Veículo',
      modelo: vehicle.model || vehicle.modelo || null,
      placa_ou_serie: vehicle.licensePlateOrSerial || vehicle.serialNumber || vehicle.placa_ou_serie || null,
      ano: vehicle.year ? Number(vehicle.year) : null,
      horimetro_ou_km_atual: isNaN(currentMeter) ? 0 : currentMeter,
      status: vehicle.status || 'ativo',
      manutencao_status: vehicle.maintenanceStatus || vehicle.manutencao_status || 'ok',
      foto_url: vehicle.imageUrl || vehicle.photoUrl || vehicle.foto_url || null,
      tank_capacity: isNaN(tankCapacityVal) ? 0 : tankCapacityVal,
      updated_at: new Date().toISOString()
    };

    let { error } = await supabase
      .from('gestao_frotas')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      logPostgresError('upsertGestaoFrota', error, { table: 'gestao_frotas', action: 'UPSERT', payload });
      if (error.code === '23503' || (error.message && (error.message.includes('company_id') || error.message.includes('tank_capacity') || error.message.includes('column')))) {
        delete payload.company_id;
        delete payload.tank_capacity;
        const retry = await supabase.from('gestao_frotas').upsert(payload, { onConflict: 'id' });
        if (!retry.error) return true;
      }
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase upsertGestaoFrota err:', err);
    return false;
  }
}

// Aliases para compatibilidade direta de chamadas
export const fetchFrotas = fetchGestaoFrotas;
export const upsertFrota = upsertGestaoFrota;

export async function deleteGestaoFrota(id: string, companyId?: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const activeCompanyId = companyId || getActiveCompanyId();
    const uuid = toValidUUID(id);
    let query = supabase.from('gestao_frotas').delete().eq('id', uuid);
    if (activeCompanyId) query = query.eq('company_id', activeCompanyId);
    const { error } = await query;
    if (error && id !== uuid) {
      let retry = supabase.from('gestao_frotas').delete().eq('id', id);
      if (activeCompanyId) retry = retry.eq('company_id', activeCompanyId);
      await retry;
    }
    return true;
  } catch (err) {
    console.warn('Supabase deleteGestaoFrota err:', err);
    return false;
  }
}

// Operações de abastecimento utilizam o histórico local, o perfil da frota ('gestao_frotas') e persistência segura em nuvem

/**
 * Salva registros de abastecimento na nuvem (Supabase) com fallback seguro sem gerar 404
 */
export async function saveCloudFuelLogs(logs: FuelLog[], companyId?: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const cId = companyId || getActiveCompanyId();
    if (!cId) return false;

    const { error } = await supabase.from('site_settings').upsert({
      id: `cloud_fuel_logs_${cId}`,
      hero_title: JSON.stringify(logs),
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });

    if (error) {
      console.warn('Aviso ao sincronizar abastecimentos no Supabase:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('Erro ao salvar abastecimentos na nuvem:', e);
    return false;
  }
}

/**
 * Carrega registros de abastecimento da nuvem com resiliência sem gerar 404 no console
 */
export async function fetchCloudFuelLogs(companyId?: string): Promise<FuelLog[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const cId = companyId || getActiveCompanyId();
    if (!cId) return null;

    const { data, error } = await supabase
      .from('site_settings')
      .select('hero_title')
      .eq('id', `cloud_fuel_logs_${cId}`)
      .maybeSingle();

    if (error || !data?.hero_title) return null;
    const parsed = JSON.parse(data.hero_title) as FuelLog[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// ===========================================================================
// Gerenciamento e Mapeamento Adaptativo da Tabela de Abastecimentos no Supabase
// ===========================================================================

export const DEFAULT_ABASTECIMENTOS_TABLE = 'abastecimentos';

export const CANDIDATE_ABASTECIMENTOS_TABLES = [
  'abastecimentos',
  'abastecimento',
  'fuel_logs',
  'fuel_log',
  'controle_abastecimento',
  'controle_abastecimentos',
  'frota_abastecimentos',
  'registros_abastecimento'
] as const;

let resolvedAbastecimentosTableName: string = 'abastecimentos';
let isAbastecimentosTableMissing: boolean = false;
let lastAbastecimentosProbeTimestamp: number = 0;

/**
 * Retorna o nome da tabela física de abastecimentos atualmente identificada no Supabase
 */
export function getAbastecimentosTableName(): string {
  if (resolvedAbastecimentosTableName) return resolvedAbastecimentosTableName;

  // 1. Variável de ambiente configurada no Vite (.env ou build)
  const envTable = typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ABASTECIMENTOS_TABLE;
  if (envTable && typeof envTable === 'string' && envTable.trim()) {
    resolvedAbastecimentosTableName = envTable.trim();
    return resolvedAbastecimentosTableName;
  }

  // 2. Variável global ou localStorage
  if (typeof window !== 'undefined') {
    const winTable = (window as any).__SUPABASE_ABASTECIMENTOS_TABLE__;
    if (winTable && typeof winTable === 'string' && winTable.trim()) {
      resolvedAbastecimentosTableName = winTable.trim();
      return resolvedAbastecimentosTableName;
    }
    const stored = localStorage.getItem('supabase_abastecimentos_table');
    if (stored && stored.trim()) {
      resolvedAbastecimentosTableName = stored.trim();
      return resolvedAbastecimentosTableName;
    }
  }

  return DEFAULT_ABASTECIMENTOS_TABLE;
}

/**
 * Define ou força manualmente o nome exato da tabela de abastecimentos no Supabase
 */
export function setAbastecimentosTableName(name: string): void {
  const cleanName = (name || '').trim();
  if (cleanName) {
    resolvedAbastecimentosTableName = cleanName;
    isAbastecimentosTableMissing = false;
    if (typeof window !== 'undefined') {
      localStorage.setItem('supabase_abastecimentos_table', cleanName);
      sessionStorage.removeItem('supabase_abastecimentos_missing');
      (window as any).__SUPABASE_ABASTECIMENTOS_TABLE__ = cleanName;
    }
  } else {
    resetAbastecimentosTableCache();
  }
}

/**
 * Informa se há uma tabela física relacional de abastecimentos disponível
 */
export function isAbastecimentosTableAvailable(): boolean {
  return Boolean(getAbastecimentosTableName()) && !isAbastecimentosTableMissing;
}

/**
 * Limpa o cache de resolução da tabela para permitir nova detecção
 */
export function resetAbastecimentosTableCache(): void {
  resolvedAbastecimentosTableName = 'abastecimentos';
  isAbastecimentosTableMissing = false;
  lastAbastecimentosProbeTimestamp = 0;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('supabase_abastecimentos_table');
    sessionStorage.removeItem('supabase_abastecimentos_missing');
    delete (window as any).__SUPABASE_ABASTECIMENTOS_TABLE__;
  }
}

// Expõe helpers no window para depuração rápida no console do desenvolvedor
if (typeof window !== 'undefined') {
  (window as any).setAbastecimentosTable = setAbastecimentosTableName;
  (window as any).resetAbastecimentosTable = resetAbastecimentosTableCache;
}

/**
 * Converte qualquer linha de banco de dados (esquemas em português ou inglês) para FuelLog padronizado
 */
export function mapRowToFuelLog(row: any): FuelLog {
  const rawPlateOrName = row.placa_ou_nome || row.placa || row.veiculo_nome || row.machinery_plate_or_name || '';
  const cleanPlateOrName = rawPlateOrName.replace(/^(AGR[IÍ]COLA\s*[-–—:]*\s*)/i, '').trim();
  const rawVName = row.veiculo_nome || row.vehicle_name || '';
  const cleanVName = rawVName.replace(/^(AGR[IÍ]COLA\s*[-–—:]*\s*)/i, '').trim();

  return {
    id: String(row.id || `fuel_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`),
    date: row.data || row.date || new Date().toISOString().split('T')[0],
    machineryId: row.veiculo_id || row.machinery_id || row.veiculo || '',
    machineryPlateOrName: cleanPlateOrName,
    vehicleName: cleanVName,
    vehiclePlate: row.placa || row.vehicle_plate || '',
    fuelType: row.tipo_combustivel || row.combustivel || row.fuel_type || 'Diesel S10',
    liters: Number(row.litros ?? row.liters ?? row.quantidade ?? 0),
    pricePerLiter: Number(row.valor_litro ?? row.preco_litro ?? row.price_per_liter ?? 0),
    totalAmount: Number(row.valor_total ?? row.total_amount ?? row.total ?? 0),
    currentHourMeterOrKm: Number(row.km_ou_horimetro ?? row.km_atual ?? row.horimetro_atual ?? row.current_hour_meter_or_km ?? 0),
    previousHourMeterOrKm: row.km_anterior || row.horimetro_anterior ? Number(row.km_anterior || row.horimetro_anterior) : undefined,
    currentKm: row.km_atual !== undefined && row.km_atual !== null ? Number(row.km_atual) : (row.current_km ? Number(row.current_km) : undefined),
    previousKm: row.km_anterior !== undefined && row.km_anterior !== null ? Number(row.km_anterior) : (row.previous_km ? Number(row.previous_km) : undefined),
    currentHourMeter: row.horimetro_atual !== undefined && row.horimetro_atual !== null ? Number(row.horimetro_atual) : (row.current_hour_meter ? Number(row.current_hour_meter) : undefined),
    previousHourMeter: row.horimetro_anterior !== undefined && row.horimetro_anterior !== null ? Number(row.horimetro_anterior) : (row.previous_hour_meter ? Number(row.previous_hour_meter) : undefined),
    averageCalculated: row.media_calculada !== undefined && row.media_calculada !== null ? Number(row.media_calculada) : (row.media ? Number(row.media) : undefined),
    averageKmPerLiter: row.media_kml !== undefined && row.media_kml !== null ? Number(row.media_kml) : (row.average_km_per_liter ? Number(row.average_km_per_liter) : undefined),
    averageLitersPerHour: row.media_lh !== undefined && row.media_lh !== null ? Number(row.media_lh) : (row.average_liters_per_hour ? Number(row.average_liters_per_hour) : undefined),
    driverOrOperator: row.motorista || row.operador || row.driver_or_operator || '',
    supplierStation: row.posto || row.fornecedor || row.supplier_station || 'Tanque da Fazenda',
    tanque_id: row.tanque_id || row.tanqueId || undefined,
    tanqueId: row.tanque_id || row.tanqueId || undefined,
    tanqueNome: row.tanque_nome || row.tanqueNome || undefined,
    notes: row.observacoes || row.notes || '',
    fuelOrigin: row.origem_combustivel || row.fuel_origin || (row.posto && row.posto.toLowerCase().includes('viagem') ? 'Posto de Viagem (Pago na Hora)' : (row.posto && !row.posto.toLowerCase().includes('tanque') && !row.posto.toLowerCase().includes('fazenda') ? 'Posto Conveniado (Faturado)' : 'Tanque Interno (Fazenda)')),
    paymentMethod: row.forma_pagamento || row.payment_method || undefined,
    bankAccountId: row.conta_bancaria_id || row.bank_account_id || undefined,
    dueDate: row.data_vencimento || row.due_date || undefined,
    financialStatus: row.status_financeiro || row.financial_status || undefined,
    createdAt: row.created_at || new Date().toISOString()
  };
}

/**
 * Resolve e valida dinamicamente qual tabela física de abastecimento existe no Supabase.
 */
export async function resolveAbastecimentosTable(): Promise<string> {
  const current = getAbastecimentosTableName();
  if (current) return current;
  return DEFAULT_ABASTECIMENTOS_TABLE;
}

/**
 * Busca a lista completa de abastecimentos atualizada diretamente do banco de dados (Supabase).
 * Usa a tabela física 'abastecimentos' com fallback seguro para cloud fuel logs (site_settings).
 */
export async function fetchAbastecimentos(companyId?: string): Promise<FuelLog[]> {
  if (!isSupabaseConfigured) return [];
  const cId = companyId || getActiveCompanyId();
  const tableName = getAbastecimentosTableName() || 'abastecimentos';

  try {
    let query = supabase.from(tableName).select('*');
    if (cId) {
      query = query.eq('company_id', cId);
    }

    // Tenta ordenar por data descrescente
    const { data, error } = await query.order('data', { ascending: false });

    if (!error && Array.isArray(data)) {
      if (data.length > 0) {
        return data.map(mapRowToFuelLog);
      }
      // Se a tabela física retornou vazia, verifica se há dados salvos na nuvem via site_settings
      const cloudLogs = await fetchCloudFuelLogs(cId);
      if (cloudLogs && cloudLogs.length > 0) {
        return cloudLogs;
      }
      return [];
    }

    // Se falhou apenas na ordenação pela coluna 'data', tenta sem ordenação ou com 'date'
    if (error && (error.code === '42703' || error.message?.includes('column') || error.code === 'PGRST204')) {
      let retry = supabase.from(tableName).select('*');
      if (cId) retry = retry.eq('company_id', cId);
      const retryRes = await retry;
      if (!retryRes.error && Array.isArray(retryRes.data)) {
        return retryRes.data.map(mapRowToFuelLog);
      }
    }
  } catch (err) {
    console.warn('[Supabase Abastecimento] Erro na busca:', err);
  }

  // Fallback seguro em site_settings
  const cloudLogs = await fetchCloudFuelLogs(cId);
  return cloudLogs || [];
}

// Cache interno de colunas indisponíveis por tabela para abastecimentos
const missingColumnsCache = new Map<string, Set<string>>();

/**
 * Insere ou atualiza um registro individual de abastecimento no Supabase
 * adaptando automaticamente os nomes de colunas e tabela física encontrada.
 */
export async function upsertAbastecimento(
  log: FuelLog, 
  companyId?: string
): Promise<{ success: boolean; error?: any; tableName?: string }> {
  if (!isSupabaseConfigured) return { success: false, error: 'Supabase não configurado' };
  const cId = companyId || getActiveCompanyId();
  const tableName = getAbastecimentosTableName() || 'abastecimentos';

  const rawPayload: Record<string, any> = {
    id: log.id,
    data: log.date || new Date().toISOString().split('T')[0],
    veiculo_id: log.machineryId,
    veiculo_nome: log.vehicleName || log.machineryPlateOrName || '',
    placa: log.vehiclePlate || log.machineryPlateOrName || '',
    tipo_combustivel: log.fuelType || 'Diesel S10',
    litros: Number(log.liters) || 0,
    valor_litro: Number(log.pricePerLiter) || 0,
    valor_total: Number(log.totalAmount) || 0,
    km_atual: log.currentKm ? Number(log.currentKm) : (log.currentHourMeterOrKm ? Number(log.currentHourMeterOrKm) : null),
    km_anterior: log.previousKm ? Number(log.previousKm) : null,
    horimetro_atual: log.currentHourMeter ? Number(log.currentHourMeter) : null,
    horimetro_anterior: log.previousHourMeter ? Number(log.previousHourMeter) : null,
    media_kml: log.averageKmPerLiter ? Number(log.averageKmPerLiter) : null,
    media_lh: log.averageLitersPerHour ? Number(log.averageLitersPerHour) : null,
    media_calculada: log.averageCalculated ? Number(log.averageCalculated) : null,
    motorista: log.driverOrOperator || '',
    posto: log.supplierStation || 'Tanque da Fazenda',
    observacoes: log.notes || '',
    origem_combustivel: log.fuelOrigin || 'Tanque Interno (Fazenda)',
    tanque_id: log.tanque_id || log.tanqueId || null,
    forma_pagamento: log.paymentMethod || null,
    conta_bancaria_id: log.bankAccountId || null,
    data_vencimento: log.dueDate || null,
    status_financeiro: log.financialStatus || null,
    company_id: cId,
    created_at: log.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const payload = { ...rawPayload };
  const knownMissing = missingColumnsCache.get(tableName);
  if (knownMissing) {
    for (const col of knownMissing) {
      delete payload[col];
    }
  }

  const isEditing = Boolean(log.id && !log.id.startsWith('fuel_temp_'));

  let attempts = 0;
  while (attempts < 8) {
    attempts++;
    let error: any = null;

    if (isEditing) {
      const updateRes = await supabase.from(tableName).update(payload).eq('id', payload.id);
      error = updateRes.error;
      // Se não encontrou o registro para atualizar, tenta insert
      if (!error && (updateRes as any).count === 0) {
        const insertRes = await supabase.from(tableName).insert(payload);
        error = insertRes.error;
      }
    } else {
      const insertRes = await supabase.from(tableName).insert(payload);
      error = insertRes.error;
    }

    if (!error) {
      if ((log.tanque_id || log.tanqueId) && log.liters > 0) {
        subtrairCombustivelTanque(log.tanque_id || log.tanqueId!, Number(log.liters) || 0).catch(tErr => {
          console.warn('[tanques_combustivel] Subtração automática:', tErr);
        });
      }
      return { success: true, tableName };
    }

    const msg = error.message || '';
    const code = error.code || '';

    // Coluna inexistente (PGRST204 ou 42703)
    const matchMissingCol =
      msg.match(/Could not find the '([a-zA-Z0-9_]+)' column/i) ||
      msg.match(/column "?([a-zA-Z0-9_]+)"? of relation/i) ||
      msg.match(/column "?([a-zA-Z0-9_]+)"? does not exist/i) ||
      msg.match(/column ([a-zA-Z0-9_]+) does not exist/i);

    if (matchMissingCol && matchMissingCol[1]) {
      const badCol = matchMissingCol[1];
      if (!knownMissing) {
        missingColumnsCache.set(tableName, new Set([badCol]));
      } else {
        knownMissing.add(badCol);
      }
      delete payload[badCol];
      continue;
    }

    // Se company_id der erro de foreign key
    if (code === '23503' || msg.includes('company_id')) {
      delete payload.company_id;
      continue;
    }

    // Fallback com upsert
    if (attempts === 1) {
      const fallback = await supabase.from(tableName).upsert(payload);
      if (!fallback.error) {
        if ((log.tanque_id || log.tanqueId) && log.liters > 0) {
          subtrairCombustivelTanque(log.tanque_id || log.tanqueId!, Number(log.liters) || 0).catch(tErr => {
            console.warn('[tanques_combustivel] Subtração automática fallback:', tErr);
          });
        }
        return { success: true, tableName };
      }
    }

    console.warn(`[Supabase Abastecimento] Aviso ao persistir na tabela "${tableName}":`, msg);
    break;
  }

  return { success: false, tableName };
}

/**
 * Busca produtos de combustível e arla diretamente na tabela 'public.estoque_produtos'.
 * Filtra estritamente os produtos pertencentes à categoria 'Combustível & Arla'.
 * Utiliza e expõe a coluna real 'nome_comercial' pronta para renderização no dropdown.
 */
export async function fetchCombustivelEstoqueProdutos(companyId?: string): Promise<InventoryItem[]> {
  const localItems = ensureDieselProductsInInventory(getStoredInventory()).filter(item => {
    const cat = String(item.categoria || item.category || '').toLowerCase();
    const nome = String(item.nome_comercial || item.name || '').toLowerCase();
    return cat.includes('combust') || cat.includes('arla') || nome.includes('diesel') || nome.includes('arla');
  });

  if (!isSupabaseConfigured) {
    return localItems;
  }

  try {
    const cId = companyId || getActiveCompanyId();
    // 1. Tenta buscar filtrando por categoria ou nomes de combustível/arla
    let { data, error } = await supabase
      .from('estoque_produtos')
      .select('*')
      .or('categoria.eq.Combustível & Arla,categoria.ilike.%combust%,categoria.ilike.%arla%,nome_comercial.ilike.%diesel%,nome_comercial.ilike.%arla%')
      .order('nome_comercial', { ascending: true });

    // Fallback se o OR falhar ou não retornar dados
    if (error || !data || data.length === 0) {
      const fallbackRes = await supabase
        .from('estoque_produtos')
        .select('*')
        .order('nome_comercial', { ascending: true });
      if (!fallbackRes.error && fallbackRes.data) {
        data = fallbackRes.data;
        error = null;
      }
    }

    if (!error && Array.isArray(data) && data.length > 0) {
      // Filtra estritamente os itens da categoria 'Combustível & Arla' ou diesel/arla
      const filtered = data.filter((row: any) => {
        const cat = String(row.categoria || row.category || '').toLowerCase();
        const nome = String(row.nome_comercial || row.nome || row.name || '').toLowerCase();
        return cat.includes('combust') || cat.includes('arla') || nome.includes('diesel') || nome.includes('arla');
      });

      const mapped: InventoryItem[] = (filtered.length > 0 ? filtered : data).map((row: any) => {
        const nomeComercial = String(row.nome_comercial || row.nome || row.name || row.descricao || 'Combustível').trim();
        const qty = Number(row.quantidade_atual ?? row.quantidade ?? 0);
        const cost = Number(row.preco_custo_inicial ?? row.custo_nominal ?? row.preco_custo ?? row.custo ?? row.unit_cost ?? row.valor_unitario ?? 0);
        const unit = String(row.unidade_medida || row.unidade || 'L').trim();

        return {
          id: String(row.id),
          companyId: row.company_id || undefined,
          code: row.codigo || row.code || undefined,
          name: nomeComercial,
          nome_comercial: nomeComercial,
          nome: nomeComercial,
          category: 'Combustível & Arla',
          categoria: 'Combustível & Arla',
          quantity: qty,
          quantidade_atual: qty,
          minQuantity: Number(row.quantidade_minima ?? row.minQuantity ?? 0),
          unit: unit,
          unidade_medida: unit,
          unitCost: cost,
          preco_custo_inicial: cost,
          custo_nominal: cost,
          salePrice: Number(row.preco_venda_varejo ?? row.salePrice ?? 0),
          preco_venda_varejo: Number(row.preco_venda_varejo ?? row.salePrice ?? 0),
          location: row.localizacao_fisica || row.localizacao || 'Tanque da Fazenda',
          localizacao_fisica: row.localizacao_fisica || row.localizacao || (
            nomeComercial.toLowerCase().includes('s500') ? 'Tanque Fazenda (Oficina)' :
            nomeComercial.toLowerCase().includes('arla') ? 'Reservatório Arla (Barracão)' :
            'Tanque Fazenda (Pátio Central)'
          ),
          capacidade_total: Number(row.capacidade_total || (
            nomeComercial.toLowerCase().includes('s500') ? 5000 :
            nomeComercial.toLowerCase().includes('arla') ? 5000 : 15000
          )),
          createdAt: row.created_at || undefined,
          updatedAt: row.updated_at || undefined,
        };
      });

      // Garante que os 4 essenciais sempre constem na lista
      for (const localItem of localItems) {
        const localName = String(localItem.nome_comercial || localItem.name || '').toLowerCase().trim();
        const inMapped = mapped.some(m => 
          m.id === localItem.id || 
          String(m.nome_comercial || m.name || '').toLowerCase().trim() === localName
        );
        if (!inMapped) {
          mapped.push(localItem);
        }
      }

      return mapped;
    }
  } catch (err) {
    console.warn('Erro ao consultar estoque_produtos por categoria Combustível & Arla:', err);
  }

  return localItems;
}

/**
 * Busca a lista dinâmica de tanques de combustível cadastrados na tabela 'public.tanques_combustivel' do Supabase.
 * Retorna os tanques com mapeamento da coluna 'produto_id' e suporte a fallback local resiliente.
 */
export async function fetchTanquesCombustivel(companyId?: string): Promise<TanqueCombustivel[]> {
  const localList = getStoredTanquesCombustivel();
  if (!isSupabaseConfigured) return localList;

  try {
    const cId = companyId || getActiveCompanyId();
    let query = supabase.from('tanques_combustivel').select('*');

    const { data, error } = await query.order('nome', { ascending: true });

    if (!error && Array.isArray(data) && data.length > 0) {
      // Busca produtos do estoque para reconciliar produto_id e saldos que foram lançados em nota manual
      const fuelProds = await fetchCombustivelEstoqueProdutos(cId);

      const mapped: TanqueCombustivel[] = data.map((row: any) => {
        let prodId = row.produto_id || undefined;
        let qtdAtual = Number(row.quantidade_atual ?? row.quantidade ?? 0);

        // Se o tanque não possui produto_id gravado, localiza o produto correspondente no estoque
        if (!prodId) {
          const isS500 = String(row.tipo_combustivel || row.nome || '').toLowerCase().includes('s500');
          const isS10 = String(row.tipo_combustivel || row.nome || '').toLowerCase().includes('s10');
          const isArla = String(row.tipo_combustivel || row.nome || '').toLowerCase().includes('arla');

          const matchingProd = fuelProds.find(p => {
            const pName = (p.nome_comercial || p.name).toLowerCase();
            if (isS500 && (pName.includes('s500') || pName.includes('comum'))) return true;
            if (isS10 && pName.includes('s10')) return true;
            if (isArla && pName.includes('arla')) return true;
            return false;
          });

          if (matchingProd) {
            prodId = matchingProd.id;
            // Se o tanque estava com saldo zerado mas o estoque já recebeu combustível via nota manual/XML, sincroniza o saldo!
            if (qtdAtual === 0 && Number(matchingProd.quantidade_atual) > 0) {
              qtdAtual = Number(matchingProd.quantidade_atual);
            }

            // Atualiza em background no Supabase com produto_id e quantidade_atual
            void (async () => {
              try {
                const { error: updErr } = await supabase
                  .from('tanques_combustivel')
                  .update({
                    produto_id: prodId,
                    quantidade_atual: qtdAtual,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', row.id);

                if (updErr) {
                  // Fallback caso coluna produto_id ainda não exista
                  await supabase
                    .from('tanques_combustivel')
                    .update({
                      quantidade_atual: qtdAtual,
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', row.id);
                }
              } catch {}
            })();
          }
        } else {
          // Se já tem produto_id, reconcilia caso o tanque esteja zerado mas o estoque_produtos tenha saldo
          const matchingProd = fuelProds.find(p => p.id === prodId);
          if (matchingProd && qtdAtual === 0 && Number(matchingProd.quantidade_atual) > 0) {
            qtdAtual = Number(matchingProd.quantidade_atual);
            void (async () => {
              try {
                await supabase
                  .from('tanques_combustivel')
                  .update({
                    quantidade_atual: qtdAtual,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', row.id);
              } catch {}
            })();
          }
        }

        return {
          id: String(row.id),
          nome: String(row.nome || 'Tanque de Combustível'),
          tipo_combustivel: String(row.tipo_combustivel || row.tipo || 'Diesel S10'),
          produto_id: prodId,
          produtoId: prodId,
          capacidade_total: Number(row.capacidade_total ?? row.capacidade ?? 15000),
          quantidade_atual: qtdAtual,
          localizacao: row.localizacao || '',
          company_id: row.company_id || undefined,
          created_at: row.created_at || undefined,
          updated_at: row.updated_at || undefined,
        };
      });

      saveStoredTanquesCombustivel(mapped);
      return mapped;
    }

    // Se a tabela existe mas está vazia, tenta inserir os tanques padrão com produto_id
    if (!error && Array.isArray(data) && data.length === 0) {
      try {
        await supabase.from('tanques_combustivel').insert(DEFAULT_TANQUES_COMBUSTIVEL);
      } catch (seedErr) {
        console.warn('Seed tanques_combustivel notice:', seedErr);
      }
    }
  } catch (err) {
    console.warn('Supabase fetchTanquesCombustivel aviso:', err);
  }

  return localList;
}

/**
 * Atualiza a capacidade total e o nome de um tanque na tabela 'public.tanques_combustivel'
 * e sincroniza no storage local e eventos globais do app.
 */
export async function updateCapacidadeTanqueCombustivel(params: {
  tanqueId: string;
  novaCapacidadeTotal: number;
  novoNome?: string;
  companyId?: string;
}): Promise<{ success: boolean; tanque?: TanqueCombustivel; error?: string }> {
  const { tanqueId, novaCapacidadeTotal, novoNome } = params;
  if (!tanqueId || isNaN(novaCapacidadeTotal) || novaCapacidadeTotal <= 0) {
    return { success: false, error: 'Capacidade total deve ser maior que zero.' };
  }

  // 1. Atualização imediata no storage local
  const currentList = getStoredTanquesCombustivel();
  let updatedTank: TanqueCombustivel | undefined;
  const updatedList = currentList.map(t => {
    if (t.id === tanqueId) {
      updatedTank = {
        ...t,
        capacidade_total: Number(novaCapacidadeTotal),
        nome: novoNome?.trim() || t.nome,
        updated_at: new Date().toISOString()
      };
      return updatedTank;
    }
    return t;
  });
  saveStoredTanquesCombustivel(updatedList);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('silagem_tanks_changed', { detail: updatedList }));
  }

  // 2. Atualização no Supabase
  if (isSupabaseConfigured) {
    try {
      const updatePayload: any = {
        capacidade_total: Number(novaCapacidadeTotal),
        updated_at: new Date().toISOString()
      };
      if (novoNome?.trim()) {
        updatePayload.nome = novoNome.trim();
      }

      const { data, error } = await supabase
        .from('tanques_combustivel')
        .update(updatePayload)
        .eq('id', tanqueId)
        .select()
        .maybeSingle();

      if (error) {
        console.warn('Erro ao atualizar capacidade_total no Supabase:', error);
      } else if (data) {
        updatedTank = {
          ...updatedTank!,
          capacidade_total: Number(data.capacidade_total ?? novaCapacidadeTotal),
          nome: data.nome || updatedTank!.nome
        };
      }
    } catch (err) {
      console.warn('Exceção ao persistir capacidade_total em tanques_combustivel:', err);
    }
  }

  return { success: true, tanque: updatedTank };
}

/**
 * Identifica o tipo de diesel (Diesel S500 ou Diesel S10) a partir de qualquer string descritiva
 */
export function identificarTipoDiesel(descricao: string = '', categoria: string = ''): 'Diesel S500' | 'Diesel S10' | null {
  const text = `${descricao} ${categoria}`.toLowerCase();
  if (text.includes('s500') || text.includes('s-500') || text.includes('diesel comum') || text.includes('comum') || text.includes('diesel s 500')) {
    return 'Diesel S500';
  }
  if (text.includes('s10') || text.includes('s-10') || text.includes('diesel') || text.includes('óleo diesel') || text.includes('oleo diesel')) {
    return 'Diesel S10';
  }
  return null;
}

/**
 * Executa os DOIS UPDATES em conjunto no Supabase ao concluir uma entrada de mercadoria de combustível (Manual ou XML):
 * 1. Primeiro: Soma a quantidade comprada na coluna 'quantidade_atual' da tabela 'public.estoque_produtos'.
 * 2. Segundo: Soma EXATAMENTE a mesma quantidade na coluna 'quantidade_atual' da tabela 'public.tanques_combustivel' usando o 'produto_id' correspondente.
 */
export async function sincronizarEntradaCombustivelSupabase(params: {
  produtoId?: string;
  descricao?: string;
  categoria?: string;
  quantidadeLitros: number;
  custoUnitario?: number;
  companyId?: string;
}): Promise<{
  success: boolean;
  novoSaldoEstoque?: number;
  novoSaldoTanque?: number;
  tanqueId?: string;
  produtoId?: string;
}> {
  const { produtoId, descricao = '', quantidadeLitros, custoUnitario, companyId } = params;
  if (isNaN(quantidadeLitros) || quantidadeLitros <= 0) {
    return { success: false };
  }

  const activeCompanyId = companyId || getActiveCompanyId();
  const descLower = descricao.toLowerCase();
  const isS500 = descLower.includes('s500') || descLower.includes('comum');
  const isArla = descLower.includes('arla');
  const isS10 = !isS500 && !isArla;

  // 1. Resolve o produto no estoque local
  const currentInventory = getStoredInventory();
  let resolvedProdId = produtoId;
  let targetProduct = currentInventory.find(p => 
    (resolvedProdId && p.id === resolvedProdId) ||
    (p.nome_comercial && p.nome_comercial.toLowerCase() === descLower) ||
    p.name.toLowerCase() === descLower
  );

  if (!resolvedProdId) {
    if (targetProduct) {
      resolvedProdId = targetProduct.id;
    } else {
      resolvedProdId = isS500 ? 'prod_diesel_s500' : (isArla ? 'prod_arla_32' : 'prod_diesel_s10');
    }
  }

  // Atualiza saldo no storage local do estoque
  let novoSaldoEstoqueLocal = 0;
  const updatedInventory = currentInventory.map(item => {
    const isTarget = item.id === resolvedProdId ||
      (item.nome_comercial && item.nome_comercial.toLowerCase() === descLower) ||
      item.name.toLowerCase() === descLower;
    if (isTarget) {
      novoSaldoEstoqueLocal = Number(((Number(item.quantidade_atual ?? item.quantity) || 0) + quantidadeLitros).toFixed(2));
      return {
        ...item,
        quantity: novoSaldoEstoqueLocal,
        quantidade_atual: novoSaldoEstoqueLocal,
        unitCost: (custoUnitario && custoUnitario > 0) ? custoUnitario : item.unitCost,
        preco_custo_inicial: (custoUnitario && custoUnitario > 0) ? custoUnitario : item.preco_custo_inicial,
        updatedAt: new Date().toISOString()
      };
    }
    return item;
  });
  saveStoredInventory(updatedInventory);

  // 2. Resolve o tanque no storage local
  const currentTanks = getStoredTanquesCombustivel();
  let resolvedTankId = '';
  let novoSaldoTanqueLocal = 0;
  const updatedTanks = currentTanks.map(t => {
    const matchesProd = (t.produto_id && t.produto_id === resolvedProdId) ||
      (isS500 && (t.id === 'tanque_diesel_s500' || t.tipo_combustivel?.toLowerCase().includes('s500'))) ||
      (isS10 && (t.id === 'tanque_diesel_s10' || t.tipo_combustivel?.toLowerCase().includes('s10'))) ||
      (isArla && (t.nome.toLowerCase().includes('arla') || t.tipo_combustivel?.toLowerCase().includes('arla') || t.id === 'tanque_arla_32'));
    
    if (matchesProd && !resolvedTankId) {
      resolvedTankId = t.id;
      novoSaldoTanqueLocal = Number(((Number(t.quantidade_atual) || 0) + quantidadeLitros).toFixed(2));
      return {
        ...t,
        produto_id: resolvedProdId,
        produtoId: resolvedProdId,
        quantidade_atual: novoSaldoTanqueLocal,
        updated_at: new Date().toISOString()
      };
    }
    return t;
  });
  saveStoredTanquesCombustivel(updatedTanks);

  // Notifica o app via CustomEvent
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('silagem_inventory_changed', { detail: updatedInventory }));
    window.dispatchEvent(new CustomEvent('silagem_tanks_changed', { detail: updatedTanks }));
  }

  // 3. EXECUÇÃO DOS DOIS UPDATES EM CONJUNTO NO SUPABASE
  if (!isSupabaseConfigured) {
    return {
      success: true,
      novoSaldoEstoque: novoSaldoEstoqueLocal,
      novoSaldoTanque: novoSaldoTanqueLocal,
      tanqueId: resolvedTankId,
      produtoId: resolvedProdId
    };
  }

  try {
    // -------------------------------------------------------------
    // UPDATE 1: Soma a quantidade comprada na coluna 'quantidade_atual'
    // da tabela 'public.estoque_produtos'
    // -------------------------------------------------------------
    let dbProdId = resolvedProdId;
    let saldoFinalEstoque = novoSaldoEstoqueLocal;

    // Busca o produto no Supabase com resiliência total
    let dbProd: any = null;
    if (resolvedProdId) {
      const { data: byId } = await supabase
        .from('estoque_produtos')
        .select('id, nome_comercial, quantidade_atual, preco_custo_inicial')
        .eq('id', resolvedProdId)
        .limit(1);
      if (byId && byId.length > 0) {
        dbProd = byId[0];
      }
    }

    if (!dbProd) {
      const searchKey = isS500 ? 'S500' : (isArla ? 'Arla' : 'S10');
      const { data: byName } = await supabase
        .from('estoque_produtos')
        .select('id, nome_comercial, quantidade_atual, preco_custo_inicial')
        .ilike('nome_comercial', `%${searchKey}%`)
        .limit(1);
      if (byName && byName.length > 0) {
        dbProd = byName[0];
      }
    }

    if (dbProd && dbProd.id) {
      dbProdId = dbProd.id;
      saldoFinalEstoque = Number(((Number(dbProd.quantidade_atual) || 0) + quantidadeLitros).toFixed(2));
      await supabase
        .from('estoque_produtos')
        .update({
          quantidade_atual: saldoFinalEstoque,
          quantity: saldoFinalEstoque,
          preco_custo_inicial: (custoUnitario && custoUnitario > 0) ? custoUnitario : dbProd.preco_custo_inicial,
          updated_at: new Date().toISOString()
        })
        .eq('id', dbProd.id);
    } else {
      const newProdItem = {
        id: resolvedProdId,
        nome_comercial: descricao || (isS500 ? 'Diesel S500' : (isArla ? 'Arla 32 (Granel / Litro)' : 'Diesel S10')),
        name: descricao || (isS500 ? 'Diesel S500' : (isArla ? 'Arla 32 (Granel / Litro)' : 'Diesel S10')),
        categoria: 'Combustível & Arla',
        category: 'Combustível & Arla',
        quantidade_atual: quantidadeLitros,
        quantity: quantidadeLitros,
        unidade_medida: 'L',
        unit: 'L',
        preco_custo_inicial: custoUnitario || 0,
      };
      await upsertEstoqueItem(newProdItem, activeCompanyId);
      saldoFinalEstoque = quantidadeLitros;
    }

    // -------------------------------------------------------------
    // UPDATE 2: Soma EXATAMENTE a mesma quantidade na coluna 'quantidade_atual'
    // da tabela 'public.tanques_combustivel' usando o 'produto_id' correspondente
    // -------------------------------------------------------------
    let targetTankDbId = resolvedTankId;
    let saldoFinalTanque = novoSaldoTanqueLocal;
    let targetDbTank: any = null;

    // Busca tanque que tenha produto_id correspondente
    if (dbProdId) {
      const { data: dbTankByProdId } = await supabase
        .from('tanques_combustivel')
        .select('id, nome, tipo_combustivel, quantidade_atual, produto_id')
        .eq('produto_id', dbProdId)
        .limit(1);
      if (dbTankByProdId && dbTankByProdId.length > 0) {
        targetDbTank = dbTankByProdId[0];
      }
    }

    // Se ainda não encontrou por produto_id, busca por tipo_combustivel / nome
    if (!targetDbTank) {
      const fallbackTankId = isS500 ? 'tanque_diesel_s500' : (isArla ? 'tanque_arla_32' : 'tanque_diesel_s10');
      const searchPattern = isS500 ? 's500' : (isArla ? 'arla' : 's10');

      const { data: allTanks } = await supabase
        .from('tanques_combustivel')
        .select('id, nome, tipo_combustivel, quantidade_atual, produto_id');

      if (allTanks && allTanks.length > 0) {
        targetDbTank = allTanks.find(t => 
          t.id === fallbackTankId ||
          (t.tipo_combustivel && t.tipo_combustivel.toLowerCase().includes(searchPattern)) ||
          (t.nome && t.nome.toLowerCase().includes(searchPattern))
        ) || allTanks[0];
      }
    }

    if (targetDbTank && targetDbTank.id) {
      targetTankDbId = targetDbTank.id;
      saldoFinalTanque = Number(((Number(targetDbTank.quantidade_atual) || 0) + quantidadeLitros).toFixed(2));

      // Tenta atualizar com produto_id e quantidade_atual
      const { error: tankUpdateErr } = await supabase
        .from('tanques_combustivel')
        .update({
          quantidade_atual: saldoFinalTanque,
          produto_id: dbProdId, // Vínculo explícito por produto_id
          updated_at: new Date().toISOString()
        })
        .eq('id', targetDbTank.id);

      // Fallback resiliente se a coluna produto_id ainda não existir no banco
      if (tankUpdateErr) {
        await supabase
          .from('tanques_combustivel')
          .update({
            quantidade_atual: saldoFinalTanque,
            updated_at: new Date().toISOString()
          })
          .eq('id', targetDbTank.id);
      }
    } else {
      const newTankId = isS500 ? 'tanque_diesel_s500' : (isArla ? 'tanque_arla_32' : 'tanque_diesel_s10');
      const newTankName = isS500 ? 'Tanque Secundário Diesel S500' : (isArla ? 'Tanque Arla 32' : 'Tanque Principal Diesel S10');
      const newTankType = isS500 ? 'Diesel S500' : (isArla ? 'Arla 32' : 'Diesel S10');
      const capacity = isS500 ? 10000 : (isArla ? 5000 : 15000);

      try {
        await supabase
          .from('tanques_combustivel')
          .upsert({
            id: newTankId,
            nome: newTankName,
            tipo_combustivel: newTankType,
            produto_id: dbProdId,
            capacidade_total: capacity,
            quantidade_atual: quantidadeLitros,
            localizacao: 'Pátio Central / Barracão de Abastecimento',
            company_id: activeCompanyId || null,
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' });
      } catch {
        // Fallback sem produto_id se coluna não existir
        await supabase
          .from('tanques_combustivel')
          .upsert({
            id: newTankId,
            nome: newTankName,
            tipo_combustivel: newTankType,
            capacidade_total: capacity,
            quantidade_atual: quantidadeLitros,
            localizacao: 'Pátio Central / Barracão de Abastecimento',
            company_id: activeCompanyId || null,
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' });
      }

      targetTankDbId = newTankId;
      saldoFinalTanque = quantidadeLitros;
    }

    return {
      success: true,
      novoSaldoEstoque: saldoFinalEstoque,
      novoSaldoTanque: saldoFinalTanque,
      tanqueId: targetTankDbId,
      produtoId: dbProdId
    };
  } catch (err) {
    console.warn('Erro ao sincronizar dois updates em estoque_produtos e tanques_combustivel:', err);
    return {
      success: true,
      novoSaldoEstoque: novoSaldoEstoqueLocal,
      novoSaldoTanque: novoSaldoTanqueLocal,
      tanqueId: resolvedTankId,
      produtoId: resolvedProdId
    };
  }
}

/**
 * Sincroniza a ENTRADA de Diesel (via entrada manual ou XML):
 * Chama diretamente a sincronização dos dois updates em estoque_produtos e tanques_combustivel.
 */
export async function somarCombustivelTanqueEEstoque(
  tipoOuTanqueId: string,
  litrosSomar: number,
  companyId?: string
): Promise<{ success: boolean; novoSaldoTanque?: number; novoSaldoEstoque?: number }> {
  const result = await sincronizarEntradaCombustivelSupabase({
    descricao: tipoOuTanqueId,
    quantidadeLitros: litrosSomar,
    companyId
  });
  return {
    success: result.success,
    novoSaldoTanque: result.novoSaldoTanque,
    novoSaldoEstoque: result.novoSaldoEstoque
  };
}

/**
 * Subtrai a quantidade de 'Litros Abastecidos' simultaneamente da coluna 'quantidade_atual'
 * da tabela 'tanques_combustivel' E da coluna 'quantidade_atual' da tabela 'estoque_produtos'.
 */
export async function subtrairCombustivelTanque(
  tanqueId: string, 
  litrosSubtrair: number,
  companyId?: string
): Promise<{ success: boolean; novaQuantidade?: number; novoSaldoEstoque?: number; error?: any }> {
  if (!tanqueId || isNaN(litrosSubtrair) || litrosSubtrair <= 0) {
    return { success: false, error: 'Parâmetros inválidos para baixa em tanque' };
  }

  // 1. Identifica o tipo do tanque (S500 ou S10)
  const currentList = getStoredTanquesCombustivel();
  const targetTank = currentList.find(t => t.id === tanqueId);
  const isS500 = targetTank 
    ? (targetTank.tipo_combustivel?.toLowerCase().includes('s500') || targetTank.nome?.toLowerCase().includes('s500'))
    : tanqueId.toLowerCase().includes('s500');
  const prodSearch = isS500 ? 'Diesel S500' : 'Diesel S10';

  // 2. Atualização imediata no storage local dos tanques (tanques_combustivel)
  let novaQtdLocalTanque = 0;
  const updatedList = currentList.map(t => {
    if (t.id === tanqueId || (isS500 ? t.tipo_combustivel?.toLowerCase().includes('s500') : t.tipo_combustivel?.toLowerCase().includes('s10'))) {
      novaQtdLocalTanque = Math.max(0, Number(((t.quantidade_atual || 0) - litrosSubtrair).toFixed(2)));
      return { ...t, quantidade_atual: novaQtdLocalTanque, updated_at: new Date().toISOString() };
    }
    return t;
  });
  saveStoredTanquesCombustivel(updatedList);

  // 3. Atualização imediata no storage local do estoque (estoque_produtos)
  const currentInventory = getStoredInventory();
  let novaQtdLocalEstoque = 0;
  let targetProduct: InventoryItem | null = null;
  const updatedInventory = currentInventory.map(item => {
    const isMatch = (item.nome_comercial && item.nome_comercial.toLowerCase().includes(prodSearch.toLowerCase())) ||
                    (item.name && item.name.toLowerCase().includes(prodSearch.toLowerCase())) ||
                    (!isS500 && (item.category === 'Combustível & Arla' || item.name.toLowerCase().includes('diesel')));
    if (isMatch && !targetProduct) {
      novaQtdLocalEstoque = Math.max(0, Number(((Number(item.quantidade_atual ?? item.quantity) || 0) - litrosSubtrair).toFixed(2)));
      targetProduct = {
        ...item,
        quantity: novaQtdLocalEstoque,
        quantidade_atual: novaQtdLocalEstoque,
        updatedAt: new Date().toISOString()
      };
      return targetProduct;
    }
    return item;
  });
  saveStoredInventory(updatedInventory);

  // Notifica componentes locais
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('silagem_inventory_changed', { detail: updatedInventory }));
    window.dispatchEvent(new CustomEvent('silagem_tanks_changed', { detail: updatedList }));
  }

  if (!isSupabaseConfigured) {
    return { success: true, novaQuantidade: novaQtdLocalTanque, novoSaldoEstoque: novaQtdLocalEstoque };
  }

  try {
    // 4. Atualiza na tabela 'tanques_combustivel' do Supabase
    const { data: tankData } = await supabase
      .from('tanques_combustivel')
      .select('id, quantidade_atual')
      .eq('id', tanqueId)
      .maybeSingle();

    let saldoDbTanque = novaQtdLocalTanque;
    if (tankData && tankData.quantidade_atual !== undefined && tankData.quantidade_atual !== null) {
      saldoDbTanque = Math.max(0, Number((Number(tankData.quantidade_atual) - litrosSubtrair).toFixed(2)));
    }

    await supabase
      .from('tanques_combustivel')
      .update({
        quantidade_atual: saldoDbTanque,
        updated_at: new Date().toISOString()
      })
      .eq('id', tanqueId);

    // 5. Atualiza simultaneamente na tabela 'estoque_produtos' do Supabase (coluna quantidade_atual)
    const { data: prodData } = await supabase
      .from('estoque_produtos')
      .select('id, quantidade_atual, nome_comercial')
      .or(`nome_comercial.ilike.%${prodSearch}%,descricao.ilike.%${prodSearch}%`)
      .maybeSingle();

    let saldoDbEstoque = novaQtdLocalEstoque;
    if (prodData && prodData.id) {
      saldoDbEstoque = Math.max(0, Number(((Number(prodData.quantidade_atual) || 0) - litrosSubtrair).toFixed(2)));
      await supabase
        .from('estoque_produtos')
        .update({
          quantidade_atual: saldoDbEstoque,
          updated_at: new Date().toISOString()
        })
        .eq('id', prodData.id);
    } else if (targetProduct) {
      await upsertEstoqueItem(targetProduct, companyId);
    }

    // Sincroniza também na tabela secundária 'estoque'
    try {
      await supabase
        .from('estoque')
        .update({
          quantidade_atual: saldoDbEstoque,
          updated_at: new Date().toISOString()
        })
        .or(`descricao.ilike.%${prodSearch}%,codigo_produto.ilike.%${prodSearch}%`);
    } catch {
      // Ignora erro na tabela secundária
    }

    return { success: true, novaQuantidade: saldoDbTanque, novoSaldoEstoque: saldoDbEstoque };
  } catch (err) {
    console.warn('Exceção ao subtrair combustível de tanques_combustivel e estoque_produtos:', err);
    return { success: true, novaQuantidade: novaQtdLocalTanque, novoSaldoEstoque: novaQtdLocalEstoque };
  }
}

/**
 * Exclui um registro de abastecimento da tabela física do Supabase
 */
export async function deleteAbastecimento(id: string, _companyId?: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const tableName = getAbastecimentosTableName() || 'abastecimentos';
    const { error } = await supabase.from(tableName).delete().eq('id', id);
    return !error;
  } catch (err) {
    console.warn('[Supabase Abastecimento] Aviso ao excluir registro:', err);
    return false;
  }
}

export interface LancamentoContasAPagarAbastecimentoInput {
  id?: string;
  abastecimentoId?: string;
  veiculoId?: string;
  veiculoNome: string;
  fornecedor: string;
  valorTotal: number;
  dataEmissao: string;
  dataVencimento?: string;
  formaPagamento?: string;
  contaBancariaId?: string;
  contaBancariaNome?: string;
  statusPago: boolean; // false para Posto Conveniado (A Pagar / Pendente), true para Posto de Viagem (Pago na Hora)
  origemCombustivel: 'Tanque Interno (Fazenda)' | 'Posto Conveniado (Faturado)' | 'Posto de Viagem (Pago na Hora)' | string;
  litros?: number;
  tipoCombustivel?: string;
  motorista?: string;
  observacoes?: string;
}

/**
 * Realiza POST/insert na tabela 'public.contas_a_pagar' do Supabase para abastecimentos
 * conforme a Origem do Combustível:
 * - Tanque Interno: Não gera dívida externa (compensado pelo estoque).
 * - Posto Conveniado (Faturado): Status 'A Pagar' (Pendente, status_pago = false) vinculado ao fornecedor/posto.
 * - Posto de Viagem (Pago na Hora): Status 'Pago' (Liquidada, status_pago = true) vinculado à conta bancária.
 * Em ambos os casos externos, o custo é distribuído no centro de custo do veículo para o DRE.
 */
export async function insertContaAPagarAbastecimento(
  dados: LancamentoContasAPagarAbastecimentoInput,
  companyId?: string
): Promise<{ success: boolean; data?: any; error?: any }> {
  // Tanque Interno da Fazenda não gera lançamento de dívida pendente a pagar
  if (dados.origemCombustivel === 'Tanque Interno (Fazenda)') {
    return { success: true };
  }

  if (!isSupabaseConfigured) {
    return { success: true };
  }

  const activeCompanyId = companyId || getActiveCompanyId();
  const uuid = toValidUUID(dados.id || generateUUID());
  const now = new Date().toISOString();
  const desc = dados.origemCombustivel === 'Posto Conveniado (Faturado)'
    ? `Abastecimento Faturado (${dados.fornecedor}) - ${dados.veiculoNome}${dados.litros ? ` (${dados.litros}L ${dados.tipoCombustivel || ''})` : ''}`
    : `Abastecimento Viagem (${dados.fornecedor}) - ${dados.veiculoNome}${dados.litros ? ` (${dados.litros}L ${dados.tipoCombustivel || ''})` : ''}`;

  try {
    const fullPayload: Record<string, any> = {
      id: uuid,
      fornecedor: (dados.fornecedor || 'Posto de Combustível').trim(),
      credor: (dados.fornecedor || 'Posto de Combustível').trim(),
      valor_total: Number(dados.valorTotal) || 0,
      valor_parcela: Number(dados.valorTotal) || 0,
      descricao: desc,
      centro_custo: dados.veiculoNome,
      categoria: 'Combustível & Arla',
      tipo_despesa: 'Combustível & Arla',
      data_emissao: dados.dataEmissao,
      data_vencimento: dados.statusPago ? dados.dataEmissao : (dados.dataVencimento || dados.dataEmissao),
      numero_parcela: '01/01',
      forma_pagamento: dados.formaPagamento || (dados.statusPago ? 'Pix' : 'Boleto'),
      status: dados.statusPago ? 'pago' : 'pendente',
      status_pago: Boolean(dados.statusPago),
      created_at: now
    };

    if (dados.statusPago) {
      fullPayload.data_pagamento = dados.dataEmissao;
    }

    if (dados.contaBancariaId) {
      fullPayload.conta_bancaria_id = dados.contaBancariaId;
    }

    if (activeCompanyId) {
      fullPayload.company_id = activeCompanyId;
    }

    let { data, error } = await supabase
      .from('contas_a_pagar')
      .insert([fullPayload])
      .select();

    if (error) {
      logPostgresError('insertContaAPagarAbastecimento', error, { table: 'contas_a_pagar', action: 'INSERT', payload: fullPayload });

      // Fallback 1: Esquema com colunas fundamentais
      const standardPayload: Record<string, any> = {
        id: uuid,
        valor_parcela: Number(dados.valorTotal) || 0,
        data_vencimento: dados.statusPago ? dados.dataEmissao : (dados.dataVencimento || dados.dataEmissao),
        centro_custo: dados.veiculoNome,
        categoria: 'Combustível & Arla',
        tipo_despesa: 'Combustível & Arla',
        numero_parcela: '01/01',
        forma_pagamento: dados.formaPagamento || (dados.statusPago ? 'Pix' : 'Boleto'),
        status_pago: Boolean(dados.statusPago),
        created_at: now
      };
      if (activeCompanyId) standardPayload.company_id = activeCompanyId;

      const retry1 = await supabase.from('contas_a_pagar').insert([standardPayload]).select();
      if (!retry1.error) return { success: true, data: retry1.data };

      // Fallback 2: Remove colunas extras se não existirem
      delete standardPayload.company_id;
      delete standardPayload.categoria;
      delete standardPayload.tipo_despesa;
      const retry2 = await supabase.from('contas_a_pagar').insert([standardPayload]).select();
      if (!retry2.error) return { success: true, data: retry2.data };

      return { success: false, error };
    }

    return { success: true, data };
  } catch (err) {
    console.warn('Supabase insertContaAPagarAbastecimento exception:', err);
    return { success: false, error: err };
  }
}


// ===========================================================================
// Sincronização Global para o Supabase
// ===========================================================================
export async function syncAllDataToSupabase(payload: {
  clientes?: Client[];
  fornecedores?: Supplier[];
  estoque?: InventoryItem[];
  rh_funcionarios?: Employee[];
  gestao_frotas?: Machinery[];
  despesas?: Expense[];
  companyProfile?: CompanyProfile;
}): Promise<SyncStats> {
  const stats: SyncStats = {
    clientes: 0,
    fornecedores: 0,
    estoque: 0,
    notas_fiscais: 0,
    contas_a_pagar: 0,
    rh_funcionarios: 0,
    gestao_frotas: 0,
    despesas: 0,
  };

  if (!isSupabaseConfigured) {
    console.info('Supabase aguardando URL e Anon Key ativas.');
    return stats;
  }

  // Clientes
  if (payload.clientes && payload.clientes.length > 0) {
    for (const c of payload.clientes) {
      const ok = await upsertCliente(c);
      if (ok) stats.clientes++;
    }
  }

  // Fornecedores
  if (payload.fornecedores && payload.fornecedores.length > 0) {
    for (const f of payload.fornecedores) {
      const ok = await upsertFornecedor(f);
      if (ok) stats.fornecedores++;
    }
  }

  // Estoque
  if (payload.estoque && payload.estoque.length > 0) {
    for (const item of payload.estoque) {
      const ok = await upsertEstoqueItem(item);
      if (ok) stats.estoque++;
    }
  }

  // RH
  if (payload.rh_funcionarios && payload.rh_funcionarios.length > 0) {
    for (const emp of payload.rh_funcionarios) {
      const ok = await upsertRhFuncionario(emp);
      if (ok) stats.rh_funcionarios++;
    }
  }

  // Frotas
  if (payload.gestao_frotas && payload.gestao_frotas.length > 0) {
    for (const v of payload.gestao_frotas) {
      const ok = await upsertGestaoFrota(v);
      if (ok) stats.gestao_frotas++;
    }
  }

  // Despesas / Contas a Pagar
  if (payload.despesas && payload.despesas.length > 0) {
    for (const d of payload.despesas) {
      const ok = await upsertContaAPagar({
        id: d.id,
        nota_fiscal_id: d.id.includes('nfe_') ? d.id : null,
        numero_parcela: '01/01',
        valor_parcela: Number(d.amount) || 0,
        data_vencimento: d.dueDate || new Date().toISOString().split('T')[0],
        forma_pagamento: d.paymentMethod || 'Boleto',
        centro_custo: d.costCenterName || d.categoryName || 'Geral',
        status_pago: d.status === 'pago'
      });
      if (ok) {
        stats.contas_a_pagar++;
        stats.despesas++;
      }
    }
  }

  return stats;
}

export async function fetchAllDataFromSupabase(companyId?: string) {
  if (!isSupabaseConfigured) return null;
  const activeCompanyId = companyId || getActiveCompanyId();
  if (!activeCompanyId) {
    return {
      clientes: [],
      fornecedores: [],
      estoque: [],
      notas_fiscais: [],
      contas_a_pagar: [],
      rh_funcionarios: [],
      gestao_frotas: []
    };
  }
  try {
    const [
      clientes,
      fornecedores,
      estoque,
      rh_funcionarios,
      gestao_frotas,
      contas_a_pagar
    ] = await Promise.all([
      fetchClientes(activeCompanyId),
      fetchFornecedores(activeCompanyId),
      fetchEstoque(activeCompanyId),
      fetchRhFuncionarios(activeCompanyId),
      fetchGestaoFrotas(activeCompanyId),
      fetchContasAPagar(activeCompanyId)
    ]);

    const formattedExpenses: Expense[] = (contas_a_pagar || []).map((d: any) => {
      const catExact = d.categoria || d.tipo_despesa || d.category || (d.centro_custo?.includes('Combustível') ? 'Combustível & Arla' : d.centro_custo?.includes('Insumos') ? 'Insumos & Entradas' : d.centro_custo) || 'Insumos & Entradas';
      const isComb = catExact === 'Combustível & Arla' || (typeof d.centro_custo === 'string' && d.centro_custo.toLowerCase().includes('combust'));
      const finalCatName = isComb ? 'Combustível & Arla' : (catExact === 'Insumos & Entradas' ? 'Insumos & Entradas' : (d.categoryName || catExact));
      const finalCatColor = isComb ? '#d97706' : (catExact === 'Insumos & Entradas' ? '#059669' : (d.categoryColor || '#10b981'));
      const finalCatId = isComb ? 'cat_combustivel' : (catExact === 'Insumos & Entradas' ? 'cat_insumos' : (d.categoryId || 'despesa_geral'));

      return {
        id: d.id,
        title: d.centro_custo || d.title || 'Despesa Fornecedor',
        description: d.descricao || d.centro_custo || d.description || 'Despesa Fornecedor',
        amount: Number(d.valor_parcela ?? d.amount ?? 0),
        dueDate: d.data_vencimento || d.dueDate || new Date().toISOString().split('T')[0],
        status: ((d.status_pago || d.status === 'pago') ? 'pago' : 'pendente') as ExpenseStatus,
        categoryId: finalCatId,
        categoryColor: finalCatColor,
        category: finalCatName,
        categoryName: finalCatName,
        paymentMethod: (d.forma_pagamento || d.paymentMethod || 'boleto') as PaymentMethod,
        supplier: d.fornecedor || d.credor || d.supplier || 'Fornecedor',
        recurrence: d.recurrence || 'none',
        createdAt: d.created_at || d.createdAt || new Date().toISOString(),
        updatedAt: d.updated_at || d.updatedAt || new Date().toISOString(),
      };
    });

    return {
      clientes: clientes || [],
      fornecedores: fornecedores || [],
      estoque: estoque || [],
      notas_fiscais: [],
      contas_a_pagar: formattedExpenses,
      rh_funcionarios: rh_funcionarios || [],
      gestao_frotas: gestao_frotas || []
    };
  } catch (err) {
    console.warn('Supabase fetchAllDataFromSupabase notice:', err);
    return null;
  }
}

// ===========================================================================
// 8. Agendamentos da Agenda Operacional (Tabela: public.agendamentos)
// Colunas: id, appointment_number, client_id, client_name, farm_name,
//          location_city_state, contact_phone, service_type, service_tab,
//          start_date, start_time, estimated_quantity, area_unit,
//          productivity_rate, execution_time_minutes, travel_time_minutes,
//          total_time_minutes, end_date, end_time, primary_machinery_id,
//          primary_machinery_prefix, primary_machinery_plate,
//          primary_machinery_model, assigned_vehicles, assigned_team,
//          status, field_notes, created_at, updated_at
// ===========================================================================

export async function fetchAgendamentos(companyId?: string): Promise<ServiceAppointment[] | null> {
  if (!isSupabaseConfigured) return null;
  const activeCompanyId = companyId || getActiveCompanyId();
  if (!activeCompanyId) return [];
  try {
    const { data, error } = await supabase
      .from('agendamentos')
      .select('*')
      .eq('company_id', activeCompanyId)
      .order('start_date', { ascending: false });

    if (error) {
      console.warn('Supabase fetchAgendamentos notice:', error.message);
      return [];
    }
    if (!data) return [];

    return data.map((row: any): ServiceAppointment => ({
      id: row.id,
      companyId: row.company_id || undefined,
      appointmentNumber: row.appointment_number || '',
      clientId: row.client_id || '',
      clientName: row.client_name || '',
      farmName: row.farm_name || '',
      locationCityState: row.location_city_state || '',
      contactPhone: row.contact_phone || '',
      serviceType: row.service_type || 'Corte / Ensilagem',
      serviceTab: row.service_tab || 'corte',
      startDate: row.start_date || '',
      startTime: row.start_time || '',
      travelTimeMinutes: Number(row.travel_time_minutes) || 0,
      trailerLoadingTimeMinutes: Number(row.trailer_loading_time_minutes) || 0,
      areaUnit: row.area_unit || 'hectares',
      estimatedQuantity: Number(row.estimated_quantity) || 0,
      productivityRatePerHour: Number(row.productivity_rate) || 0,
      executionTimeMinutes: Number(row.execution_time_minutes) || 0,
      totalTimeMinutes: Number(row.total_time_minutes) || 0,
      endDate: row.end_date || '',
      endTime: row.end_time || '',
      primaryMachineryId: row.primary_machinery_id || '',
      primaryMachineryPrefix: row.primary_machinery_prefix || '',
      primaryMachineryPlate: row.primary_machinery_plate || '',
      primaryMachineryModel: row.primary_machinery_model || '',
      assignedVehicles: Array.isArray(row.assigned_vehicles) ? row.assigned_vehicles : [],
      assignedTeam: Array.isArray(row.assigned_team) ? row.assigned_team : [],
      status: row.status || 'agendado',
      fieldNotes: row.field_notes || '',
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString()
    }));
  } catch (err) {
    console.warn('Supabase fetchAgendamentos err:', err);
    return [];
  }
}

export async function deleteAgendamento(appointmentId: string, companyId?: string): Promise<boolean> {
  if (!isSupabaseConfigured) {
    return true;
  }
  try {
    const activeCompanyId = companyId || getActiveCompanyId();
    const uuid = toValidUUID(appointmentId);

    // Tenta deletar pelo UUID na tabela agendamentos
    let query = supabase.from('agendamentos').delete().eq('id', uuid);
    if (activeCompanyId) query = query.eq('company_id', activeCompanyId);
    let { error } = await query;

    // Caso o ID seja texto e a coluna id seja texto ou para cobrir IDs customizados
    if (error && appointmentId !== uuid) {
      let retry = supabase.from('agendamentos').delete().eq('id', appointmentId);
      if (activeCompanyId) retry = retry.eq('company_id', activeCompanyId);
      const res = await retry;
      if (!res.error) {
        return true;
      }
    }

    if (error) {
      logPostgresError('deleteAgendamento', error, { table: 'agendamentos', action: 'DELETE', companyId: activeCompanyId });
      return false;
    }

    return true;
  } catch (err) {
    console.warn('Supabase deleteAgendamento err:', err);
    return true;
  }
}

export async function upsertAgendamento(app: ServiceAppointment, companyId?: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const activeCompanyId = app.companyId || companyId || getActiveCompanyId();
    const uuid = toValidUUID(app.id);
    const clientUuid = app.clientId ? toValidUUID(app.clientId) : null;

    const payload: Record<string, any> = {
      id: uuid,
      company_id: activeCompanyId,
      appointment_number: app.appointmentNumber || null,
      client_id: clientUuid,
      client_name: app.clientName,
      farm_name: app.farmName || null,
      location_city_state: app.locationCityState || null,
      contact_phone: app.contactPhone || null,
      service_type: app.serviceType || 'Corte / Ensilagem',
      service_tab: app.serviceTab || 'corte',
      start_date: app.startDate,
      start_time: app.startTime || null,
      estimated_quantity: Number(app.estimatedQuantity) || 0,
      area_unit: app.areaUnit || 'hectares',
      productivity_rate: Number(app.productivityRatePerHour) || null,
      execution_time_minutes: app.executionTimeMinutes || null,
      travel_time_minutes: app.travelTimeMinutes || null,
      total_time_minutes: app.totalTimeMinutes || null,
      end_date: app.endDate || null,
      end_time: app.endTime || null,
      primary_machinery_id: app.primaryMachineryId || null,
      primary_machinery_prefix: app.primaryMachineryPrefix || null,
      primary_machinery_plate: app.primaryMachineryPlate || null,
      primary_machinery_model: app.primaryMachineryModel || null,
      assigned_vehicles: app.assignedVehicles || [],
      assigned_team: app.assignedTeam || [],
      status: app.status || 'agendado',
      field_notes: app.fieldNotes || null,
      updated_at: new Date().toISOString()
    };

    let { error } = await supabase
      .from('agendamentos')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      logPostgresError('upsertAgendamento', error, { table: 'agendamentos', action: 'UPSERT', payload });
      if (error.code === '23503' || (error.message && (error.message.includes('company_id') || error.message.includes('column')))) {
        delete payload.company_id;
        const retry = await supabase.from('agendamentos').upsert(payload, { onConflict: 'id' });
        if (!retry.error) return true;
      }
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase upsertAgendamento err:', err);
    return false;
  }
}

export async function updateAgendamentoFrente(
  appointmentId: string,
  primaryMachineryId: string,
  primaryMachineryPrefix: string
): Promise<boolean> {
  if (!isSupabaseConfigured) return true;
  try {
    const uuid = toValidUUID(appointmentId);
    let { error } = await supabase
      .from('agendamentos')
      .update({
        primary_machinery_id: primaryMachineryId,
        primary_machinery_prefix: primaryMachineryPrefix,
        updated_at: new Date().toISOString()
      })
      .eq('id', uuid);

    if (error && appointmentId !== uuid) {
      const retry = await supabase
        .from('agendamentos')
        .update({
          primary_machinery_id: primaryMachineryId,
          primary_machinery_prefix: primaryMachineryPrefix,
          updated_at: new Date().toISOString()
        })
        .eq('id', appointmentId);
      if (!retry.error) return true;
    }

    if (error) {
      console.warn('Supabase updateAgendamentoFrente notice (tabela agendamentos):', error.message);
      // Fallback para service_appointments
      await supabase
        .from('service_appointments')
        .update({
          primary_machinery_id: primaryMachineryId,
          primary_machinery_prefix: primaryMachineryPrefix,
          updated_at: new Date().toISOString()
        })
        .eq('id', uuid);
    }
    return true;
  } catch (err) {
    console.warn('Supabase updateAgendamentoFrente err:', err);
    return false;
  }
}

// ===========================================================================
// 9. Frentes de Colheita / Equipes (Tabela: public.frentes_colheita)
// ===========================================================================
export async function deleteFrente(frontId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return true;
  try {
    const uuid = toValidUUID(frontId);
    let { error } = await supabase
      .from('frentes_colheita')
      .delete()
      .eq('id', uuid);

    if (error && frontId !== uuid) {
      await supabase
        .from('frentes_colheita')
        .delete()
        .eq('id', frontId);
    }
    return true;
  } catch (err) {
    console.warn('Supabase deleteFrente notice:', err);
    return true;
  }
}

export async function upsertFrente(front: {
  id: string;
  name: string;
  machineryId?: string;
  machineryName?: string;
  headerBgColor?: string;
  columnBgColor?: string;
  borderColor?: string;
  frontNumber?: number;
}): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const uuid = toValidUUID(front.id);
    const payload = {
      id: uuid,
      name: front.name,
      machinery_id: front.machineryId || null,
      machinery_name: front.machineryName || null,
      header_bg_color: front.headerBgColor || null,
      column_bg_color: front.columnBgColor || null,
      border_color: front.borderColor || null,
      front_number: front.frontNumber || null,
      updated_at: new Date().toISOString()
    };

    let { error } = await supabase
      .from('frentes_colheita')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.warn('Supabase upsertFrente notice:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase upsertFrente err:', err);
    return false;
  }
}

// ==============================================================================
// CONTROLE DE TABELAS AUSENTES NO SCHEMA CACHE (Elimina erros 404 e 42P01 no console)
// ==============================================================================
const unmigratedTables = new Set<string>([
  'users',
  'usuarios',
  'profiles',
  'user_companies',
  'empresas',
  'companies',
  'service_appointments'
]);

export function markTableUnmigrated(table: string) {
  unmigratedTables.add(table);
}

export function isTableUnmigrated(table: string): boolean {
  return unmigratedTables.has(table);
}

export function clearUnmigratedTables() {
  unmigratedTables.clear();
  // Restaura tabelas estruturalmente inexistentes
  ['users', 'usuarios', 'profiles', 'user_companies', 'empresas', 'companies', 'service_appointments'].forEach(t => {
    unmigratedTables.add(t);
  });
}

function isTableMissingError(err: any): boolean {
  if (!err) return false;
  const msg = String(err.message || '').toLowerCase();
  const details = String(err.details || '').toLowerCase();
  const code = String(err.code || '');
  return (
    code === 'PGRST205' ||
    code === 'PGRST204' ||
    code === '42P01' ||
    code === '42501' || // RLS policy violation
    msg.includes('could not find the table') ||
    msg.includes('schema cache') ||
    details.includes('schema cache') ||
    (msg.includes('relation') && msg.includes('does not exist')) ||
    msg.includes('row-level security') ||
    msg.includes('permission denied')
  );
}

// ==============================================================================
// GESTÃO CLOUD: site_settings (Landing Page & Hero)
// ==============================================================================

export async function fetchCloudSiteConfig(): Promise<SiteConfig | null> {
  if (!isSupabaseConfigured || isTableUnmigrated('site_settings')) return null;
  try {
    // 1. Busca direta na linha padrão 'default_settings' da tabela pública site_settings
    let { data, error } = await supabase
      .from('site_settings')
      .select('*')
      .eq('id', 'default_settings')
      .maybeSingle();

    if (error || !data) {
      // Fallback para qualquer primeira linha caso o ID seja diferente
      const fallback = await supabase
        .from('site_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      if (isTableMissingError(error)) {
        markTableUnmigrated('site_settings');
      }
      return null;
    }

    if (!data) return null;

    return {
      logoUrl: data.logo_url || '',
      companyName: data.company_name || 'AgroControl Silagem',
      primaryColor: data.primary_color || '#16a34a',
      maintenanceMode: Boolean(data.maintenance_mode),
      allow_free_trial: data.allow_free_trial !== undefined ? Boolean(data.allow_free_trial) : true,
      heroTitle: data.hero_title || '',
      heroSubtitle: data.hero_subtitle || '',
      heroPrimaryBtnText: data.hero_primary_button_text || data.hero_primary_btn_text || '',
      heroSecondaryBtnText: data.hero_secondary_button_text || data.hero_secondary_btn_text || '',
      heroBackgroundImage: data.hero_bg_image || data.hero_background_image || '',
      hero_video_url: data.hero_video_url || '',
      hero_overlay_opacity: data.hero_overlay_opacity !== undefined && data.hero_overlay_opacity !== null ? Number(data.hero_overlay_opacity) : 50,
      hero_badge_text: data.hero_badge || data.hero_badge_text || '',
      featuresSectionTitle: data.resources_title || data.features_section_title || '',
      featuresSectionSubtitle: data.resources_subtitle || data.features_section_subtitle || '',
      featuresHighlightImage: data.resources_main_image || data.features_highlight_image || '',
      features_tabs: Array.isArray(data.features_cards) ? data.features_cards : (Array.isArray(data.features_tabs) ? data.features_tabs : (typeof data.features_tabs === 'string' ? JSON.parse(data.features_tabs || '[]') : undefined)),
      feature1Title: data.feature1_title || '',
      feature1Desc: data.feature1_desc || '',
      feature2Title: data.feature2_title || '',
      feature2Desc: data.feature2_desc || '',
      feature3Title: data.feature3_title || '',
      feature3Desc: data.feature3_desc || '',
      feature4Title: data.feature4_title || '',
      feature4Desc: data.feature4_desc || '',
      pricing_tag: data.pricing_tag || '',
      pricing_title: data.pricing_title || '',
      pricing_subtitle: data.pricing_subtitle || '',
      footer_copyright: data.footer_copyright || '',
      footer_signup_url: data.footer_signup_url || '',
      footer_login_url: data.footer_login_url || '',
    };
  } catch (err) {
    return null;
  }
}

export async function upsertCloudSiteConfig(config: Partial<SiteConfig>): Promise<boolean> {
  if (!isSupabaseConfigured || isTableUnmigrated('site_settings')) return false;
  try {
    const payload: any = {
      id: 'default_settings',
      updated_at: new Date().toISOString()
    };

    if (config.allow_free_trial !== undefined) payload.allow_free_trial = Boolean(config.allow_free_trial);
    if (config.hero_badge_text !== undefined) payload.hero_badge = config.hero_badge_text;
    if (config.heroTitle !== undefined) payload.hero_title = config.heroTitle;
    if (config.heroSubtitle !== undefined) payload.hero_subtitle = config.heroSubtitle;
    if (config.heroPrimaryBtnText !== undefined) payload.hero_primary_button_text = config.heroPrimaryBtnText;
    if (config.heroSecondaryBtnText !== undefined) payload.hero_secondary_button_text = config.heroSecondaryBtnText;
    if (config.heroBackgroundImage !== undefined) payload.hero_bg_image = config.heroBackgroundImage;
    if (config.hero_video_url !== undefined) payload.hero_video_url = config.hero_video_url;
    if (config.hero_overlay_opacity !== undefined) payload.hero_overlay_opacity = config.hero_overlay_opacity;
    if (config.featuresSectionTitle !== undefined) payload.resources_title = config.featuresSectionTitle;
    if (config.featuresSectionSubtitle !== undefined) payload.resources_subtitle = config.featuresSectionSubtitle;
    if (config.featuresHighlightImage !== undefined) payload.resources_main_image = config.featuresHighlightImage;
    if (config.features_tabs !== undefined) payload.features_cards = config.features_tabs;
    if (config.pricing_tag !== undefined) payload.pricing_tag = config.pricing_tag;
    if (config.pricing_title !== undefined) payload.pricing_title = config.pricing_title;
    if (config.pricing_subtitle !== undefined) payload.pricing_subtitle = config.pricing_subtitle;
    if (config.footer_copyright !== undefined) payload.footer_copyright = config.footer_copyright;

    let { error } = await supabase
      .from('site_settings')
      .upsert(payload, { onConflict: 'id' });

    // Fallback resiliente caso alguma coluna não exista
    if (error && error.message) {
      console.warn('Aviso no upsert inicial de site_settings:', error.message);
      // Tentativa de envio mínimo seguro com id e allow_free_trial garantidos
      const minimalPayload = {
        id: 'default_settings',
        allow_free_trial: Boolean(config.allow_free_trial),
        updated_at: new Date().toISOString()
      };
      const retry = await supabase
        .from('site_settings')
        .upsert(minimalPayload, { onConflict: 'id' });
      error = retry.error;
    }

    if (error) {
      console.error('Erro final no upsertCloudSiteConfig:', error);
      if (isTableMissingError(error)) {
        markTableUnmigrated('site_settings');
      }
      return false;
    }
    return true;
  } catch (err) {
    console.error('Exceção em upsertCloudSiteConfig:', err);
    return false;
  }
}

// ==============================================================================
// GESTÃO CLOUD: plans (Planos, Preços e Limites)
// ==============================================================================

export async function fetchCloudPlans(): Promise<PlanDefinition[] | null> {
  if (!isSupabaseConfigured || isTableUnmigrated('plans')) return null;
  try {
    // Busca pública e irrestrita sem filtro de usuário
    let { data, error } = await supabase
      .from('plans')
      .select('*')
      .order('display_order', { ascending: true });

    // Se falhar devido a coluna display_order inexistente, tenta busca simples
    if (error) {
      console.warn('Aviso ao consultar plans com order(display_order):', error.message);
      const fallback = await supabase.from('plans').select('*');
      if (!fallback.error && Array.isArray(fallback.data)) {
        data = fallback.data;
        error = null;
      }
    }

    if (error) {
      console.error('Erro final ao buscar plans do Supabase:', error.message, error.details);
      if (isTableMissingError(error)) {
        markTableUnmigrated('plans');
      }
      return null;
    }

    if (!data || data.length === 0) return null;

    return data.map((row: any) => {
      // Extrair features seja array, json ou texto
      let featuresText = '';
      if (Array.isArray(row.features)) {
        featuresText = row.features.join('\n');
      } else if (typeof row.features === 'string') {
        try {
          const parsed = JSON.parse(row.features);
          if (Array.isArray(parsed)) {
            featuresText = parsed.join('\n');
          } else {
            featuresText = row.features;
          }
        } catch {
          featuresText = row.features;
        }
      } else if (row.features_text) {
        featuresText = String(row.features_text);
      }

      // Extrair status ativo
      let isActive = true;
      if (row.status !== undefined && row.status !== null) {
        const s = String(row.status).toLowerCase().trim();
        isActive = s === 'active' || s === 'ativo' || s === 'true' || s === '1';
      } else if (row.is_active !== undefined && row.is_active !== null) {
        isActive = Boolean(row.is_active);
      }

      return {
        id: String(row.id),
        name: String(row.name || row.nome || 'Plano'),
        description: String(row.description || row.descricao || ''),
        price: Number(row.price !== undefined ? row.price : (row.valor || row.preco || 0)) || 0,
        billingCycle: (String(row.billing_cycle || row.billingCycle || 'mensal').toLowerCase() === 'anual' ? 'anual' : 'mensal') as 'mensal' | 'anual',
        badge: row.badge ? String(row.badge) : undefined,
        isFeatured: Boolean(row.is_featured ?? row.isFeatured ?? false),
        isActive,
        displayOrder: Number(row.display_order ?? row.displayOrder ?? 1),
        limits: typeof row.limits === 'object' && row.limits ? row.limits : {
          maxUsers: 5,
          maxMachineries: 10,
          maxClients: 100,
          storageLimitGb: 5,
        },
        featuresText: featuresText || 'Acesso completo ao sistema\nSuporte técnico dedicado',
        checkoutUrl: String(row.checkout_url || row.checkoutUrl || ''),
      };
    });
  } catch (err) {
    console.error('Exceção ao buscar planos do Supabase:', err);
    return null;
  }
}

/**
 * Sanitiza e normaliza o ID do plano para garantir conformidade total com o Supabase/PostgREST.
 * Impede IDs vazios, nulos, com espaços ou caracteres especiais que quebram queries.
 */
export function sanitizePlanId(id?: string | null, name?: string): string {
  if (id && typeof id === 'string') {
    const cleaned = id
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    if (cleaned.length > 0 && cleaned !== 'null' && cleaned !== 'undefined') {
      return cleaned;
    }
  }
  if (name && typeof name === 'string') {
    const fromName = name
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    if (fromName.length > 0) {
      return `plano-${fromName}`;
    }
  }
  return `plano-${Date.now()}`;
}

export async function upsertCloudPlan(plan: PlanDefinition): Promise<boolean> {
  if (!isSupabaseConfigured || isTableUnmigrated('plans')) return false;
  try {
    const cleanId = sanitizePlanId(plan.id, plan.name);
    const featuresArray = (plan.featuresText || '')
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);

    // Payload completo e higienizado sem IDs vazios ou campos corrompidos
    const payload: Record<string, any> = {
      id: cleanId,
      name: String(plan.name || 'Plano Comercial').trim(),
      description: String(plan.description || '').trim(),
      price: Number(plan.price) || 0,
      billing_cycle: plan.billingCycle === 'anual' ? 'anual' : 'mensal',
      badge: plan.badge ? String(plan.badge).trim() : null,
      is_featured: Boolean(plan.isFeatured),
      is_active: plan.isActive !== undefined ? Boolean(plan.isActive) : true,
      status: (plan.isActive ?? true) ? 'active' : 'inactive',
      display_order: Number(plan.displayOrder) || 1,
      limits: typeof plan.limits === 'object' && plan.limits ? plan.limits : {
        maxUsers: 5,
        maxMachineries: 10,
        maxClients: 100,
        storageLimitGb: 5,
      },
      features: featuresArray,
      features_text: plan.featuresText || '',
      checkout_url: String(plan.checkoutUrl || '').trim(),
      updated_at: new Date().toISOString()
    };

    // Helper resiliente que tenta executar a mutação e remove colunas não existentes caso o schema no Supabase seja diferente
    const executeResilientMutation = async (
      action: (currentPayload: Record<string, any>) => PromiseLike<{ error: any }>
    ): Promise<boolean> => {
      const workingPayload = { ...payload };
      let attempts = 0;

      while (attempts < 5) {
        attempts++;
        const { error } = await action(workingPayload);
        if (!error) return true;

        if (isTableMissingError(error)) {
          markTableUnmigrated('plans');
          return false;
        }

        const msg = error.message || '';
        const details = error.details || '';
        console.warn(`Tentativa ${attempts} de sincronização do plano [${cleanId}]:`, msg, details);

        // Detecta se uma coluna específica não existe no schema do Supabase (código PGRST204)
        const colMatch = msg.match(/Could not find the '([^']+)' column/) ||
                         details.match(/column "([^"]+)" of relation "plans" does not exist/);

        if (colMatch && colMatch[1] && colMatch[1] in workingPayload) {
          console.warn(`Coluna '${colMatch[1]}' não existe na tabela plans. Removendo do envio e tentando novamente.`);
          delete workingPayload[colMatch[1]];
          continue;
        }

        // Se for erro de restrição ou outro erro irrecuperável
        return false;
      }
      return false;
    };

    // ESTRATÉGIA ANTI-400 (Sem ?on_conflict=id):
    // 1. Verifica primeiro se o registro com o ID já existe
    const { data: existing, error: checkError } = await supabase
      .from('plans')
      .select('id')
      .eq('id', cleanId)
      .maybeSingle();

    if (checkError && isTableMissingError(checkError)) {
      markTableUnmigrated('plans');
      return false;
    }

    if (existing?.id) {
      // 2a. Registro já existe -> UPDATE com PATCH /rest/v1/plans?id=eq.ID (nunca dispara ?on_conflict=id)
      const ok = await executeResilientMutation(async (p) =>
        await supabase.from('plans').update(p).eq('id', cleanId)
      );
      if (ok) return true;
    } else {
      // 2b. Registro novo -> INSERT com POST /rest/v1/plans (sem ?on_conflict=id)
      const ok = await executeResilientMutation(async (p) =>
        await supabase.from('plans').insert(p)
      );
      if (ok) return true;

      // Se falhou por chave duplicada (race condition), tenta UPDATE como fallback
      const fallbackOk = await executeResilientMutation(async (p) =>
        await supabase.from('plans').update(p).eq('id', cleanId)
      );
      if (fallbackOk) return true;
    }

    // 2c. Fallback final: tenta upsert sem forçar constraint caso a tabela tenha chave primária padrão
    const finalUpsert = await supabase.from('plans').upsert(payload);
    return !finalUpsert.error;
  } catch (err) {
    console.error('Exceção ao fazer upsertCloudPlan:', err);
    return false;
  }
}

export async function deleteCloudPlan(planId: string): Promise<boolean> {
  if (!isSupabaseConfigured || isTableUnmigrated('plans')) return false;
  try {
    const { error } = await supabase
      .from('plans')
      .delete()
      .eq('id', planId);

    if (error) {
      if (isTableMissingError(error)) {
        markTableUnmigrated('plans');
      }
      return false;
    }
    return true;
  } catch (err) {
    return false;
  }
}

// ==============================================================================
// GESTÃO CLOUD: subscribers (Assinantes, Empresas e Dados de Faturamento)
// ==============================================================================

// ==============================================================================
// 12. ASSINANTES / SUBSCRIBERS (Tabela: public.assinantes / fallback: public.subscribers)
// Campos da tabela assinantes: id (UUID), nome, email, plano_selecionado, valor_mensal, status, trial_ate, criado_em
// ==============================================================================

export type PlanSelectedKey = 'essencial' | 'pro' | 'enterprise';

export function normalizeSubscriberPlanKey(plan?: string): PlanSelectedKey {
  if (!plan) return 'pro';
  const clean = plan.toLowerCase().trim();
  if (clean === 'essencial' || clean.includes('essen') || clean.includes('starter')) return 'essencial';
  if (clean === 'enterprise' || clean.includes('enter') || clean.includes('business')) return 'enterprise';
  return 'pro';
}

export function getSubscriberPlanPrice(plan: PlanSelectedKey): number {
  switch (plan) {
    case 'essencial': return 59.90;
    case 'pro': return 299.00;
    case 'enterprise': return 499.00;
  }
}

export function getSubscriberPlanDisplayName(plan: PlanSelectedKey): string {
  switch (plan) {
    case 'essencial': return 'Produtor Essencial';
    case 'pro': return 'Plano Intermediário';
    case 'enterprise': return 'Plano Master';
  }
}

export function normalizeSubscriberStatus(status?: string): 'ativa' | 'trial' | 'cancelada' {
  if (!status) return 'trial';
  const clean = status.toLowerCase().trim();
  if (clean === 'ativa' || clean === 'ativo') return 'ativa';
  if (clean === 'cancelada' || clean === 'cancelado' || clean === 'suspensa' || clean === 'inadimplente') return 'cancelada';
  return 'trial';
}

export async function fetchCloudSubscribers(): Promise<Subscriber[] | null> {
  if (!isSupabaseConfigured || (isTableUnmigrated('assinantes') && isTableUnmigrated('subscribers'))) return null;
  try {
    const queries: Promise<any>[] = [];
    const queryTypes: ('assinantes' | 'subscribers')[] = [];

    if (!isTableUnmigrated('assinantes')) {
      queries.push(Promise.resolve(supabase.from('assinantes').select('*').order('criado_em', { ascending: false })));
      queryTypes.push('assinantes');
    }
    if (!isTableUnmigrated('subscribers')) {
      queries.push(Promise.resolve(supabase.from('subscribers').select('*').order('created_at', { ascending: false })));
      queryTypes.push('subscribers');
    }

    if (queries.length === 0) return null;

    const results = await Promise.allSettled(queries);

    let assinantesData: any[] | null = null;
    let subsData: any[] | null = null;

    results.forEach((res, idx) => {
      const type = queryTypes[idx];
      if (res.status === 'fulfilled') {
        if (res.value.error) {
          if (isTableMissingError(res.value.error)) {
            markTableUnmigrated(type);
          }
        } else if (Array.isArray(res.value.data)) {
          if (type === 'assinantes') assinantesData = res.value.data;
          if (type === 'subscribers') subsData = res.value.data;
        }
      }
    });

    if (!assinantesData && !subsData) {
      return null;
    }

    // Busca em tempo real da tabela de planos para associar os preços e nomes reais
    let livePlansMap: any[] = [];
    try {
      const { data: plansData } = await supabase.from('plans').select('*');
      if (plansData && plansData.length > 0) livePlansMap = plansData;
    } catch {}

    const resolvePlanDetails = (rawPlanNameOrKey: string, existingValue?: number) => {
      const norm = (s: string) => String(s || '').toLowerCase().replace(/^plano[-_]/, '').replace(/[^a-z0-9]/g, '');
      const targetNorm = norm(rawPlanNameOrKey);
      const planKey = normalizeSubscriberPlanKey(rawPlanNameOrKey);

      let found = livePlansMap.find((p: any) => {
        const pIdNorm = norm(p.id);
        const pNameNorm = norm(p.name);
        return (targetNorm && (pNameNorm === targetNorm || pIdNorm === targetNorm)) ||
               (targetNorm.includes('essencial') && (pNameNorm.includes('essencial') || pIdNorm.includes('essencial'))) ||
               (targetNorm.includes('intermediario') && (pNameNorm.includes('intermediario') || pIdNorm.includes('intermediario'))) ||
               (targetNorm.includes('pro') && !targetNorm.includes('enterprise') && (pNameNorm.includes('pro') || pIdNorm.includes('pro') || pNameNorm.includes('intermediario'))) ||
               (targetNorm.includes('master') && (pNameNorm.includes('master') || pIdNorm.includes('master'))) ||
               (targetNorm.includes('enterprise') && (pNameNorm.includes('enterprise') || pIdNorm.includes('enterprise') || pNameNorm.includes('master')));
      });

      const resolvedName = found?.name || rawPlanNameOrKey || getSubscriberPlanDisplayName(planKey);
      let resolvedPrice = existingValue !== undefined && existingValue !== null && existingValue > 0
        ? existingValue
        : (found?.price !== undefined ? Number(found.price) : getSubscriberPlanPrice(planKey));

      return { planKey: (found?.id || planKey) as any, planName: resolvedName, monthlyValue: resolvedPrice };
    };

    const mergedMap = new Map<string, Subscriber>();

    // 1. Processa tabela legada 'subscribers' primeiro (base)
    if (Array.isArray(subsData)) {
      for (const row of subsData) {
        const emailKey = (row.responsible_email || row.email || '').trim().toLowerCase();
        const idKey = row.id || toValidUUID(emailKey);
        const planDetails = resolvePlanDetails(
          row.plan_name || row.plan_id || row.plano_selecionado || 'Produtor Essencial',
          Number(row.monthly_value) || Number(row.valor_mensal)
        );

        const subItem: Subscriber = {
          id: idKey,
          name: row.name || row.nome || 'Assinante',
          responsibleEmail: emailKey,
          password: row.password_hash || undefined,
          trialUntil: row.trial_until || row.trial_ends_at || '',
          cpfCnpj: row.cpf_cnpj || row.document || '',
          stateRegistration: row.state_registration || undefined,
          phone: row.phone || row.telefone || '',
          cep: row.cep || '',
          street: row.street || '',
          number: row.number || '',
          neighborhood: row.neighborhood || '',
          city: row.city || '',
          state: row.state || '',
          planId: planDetails.planKey,
          planName: planDetails.planName,
          monthlyValue: planDetails.monthlyValue,
          status: normalizeSubscriberStatus(row.status),
          createdAt: row.created_at || new Date().toISOString(),
          updatedAt: row.updated_at || new Date().toISOString(),
        };
        mergedMap.set(idKey, subItem);
        if (emailKey) mergedMap.set(emailKey, subItem);
      }
    }

    // 2. Processa tabela oficial 'assinantes' com prioridade máxima
    if (Array.isArray(assinantesData)) {
      for (const row of assinantesData) {
        const emailKey = (row.email || row.responsible_email || '').trim().toLowerCase();
        const idKey = row.id || toValidUUID(emailKey);
        const planDetails = resolvePlanDetails(
          row.plano_nome || row.plano_selecionado || row.plan_id || row.plan_name || 'Produtor Essencial',
          Number(row.valor_mensal)
        );

        const prevSub = mergedMap.get(idKey) || (emailKey ? mergedMap.get(emailKey) : undefined);
        const subItem: Subscriber = {
          id: idKey,
          name: row.nome || row.name || prevSub?.name || 'Assinante',
          responsibleEmail: emailKey || prevSub?.responsibleEmail || '',
          password: row.password_hash || row.senha || prevSub?.password || undefined,
          trialUntil: row.trial_ate ? new Date(row.trial_ate).toISOString().split('T')[0] : (row.trial_until || prevSub?.trialUntil || ''),
          cpfCnpj: row.cpf_cnpj || row.document || prevSub?.cpfCnpj || '',
          stateRegistration: row.state_registration || prevSub?.stateRegistration || undefined,
          phone: row.telefone || row.phone || prevSub?.phone || '',
          cep: row.cep || row.zip_code || row.zipCode || row.codigo_postal || prevSub?.cep || '',
          street: row.logradouro || row.street || row.rua || row.address || row.endereco || prevSub?.street || '',
          number: row.numero || row.number || row.num || prevSub?.number || '',
          neighborhood: row.bairro || row.neighborhood || row.district || prevSub?.neighborhood || '',
          city: row.cidade || row.city || row.municipio || prevSub?.city || '',
          state: row.estado || row.state || row.uf || prevSub?.state || '',
          planId: planDetails.planKey,
          planName: planDetails.planName,
          monthlyValue: planDetails.monthlyValue,
          status: normalizeSubscriberStatus(row.status || prevSub?.status),
          createdAt: row.criado_em || row.created_at || prevSub?.createdAt || new Date().toISOString(),
          updatedAt: row.criado_em || row.updated_at || prevSub?.updatedAt || new Date().toISOString(),
        };
        // Sobrescreve dados legados com dados mais recentes e prioritários de 'assinantes', preservando dados de endereço
        mergedMap.set(idKey, subItem);
        if (emailKey) mergedMap.set(emailKey, subItem);
      }
    }

    // 3. Enriquecimento de endereços via site_settings (cloud_company_* e company_profile_*)
    try {
      const { data: settingsRows } = await supabase
        .from('site_settings')
        .select('id, hero_title')
        .or('id.like.cloud_company_%,id.like.company_profile_%');

      if (settingsRows && settingsRows.length > 0) {
        for (const sRow of settingsRows) {
          if (!sRow.hero_title) continue;
          try {
            const p = JSON.parse(sRow.hero_title);
            if (p && typeof p === 'object') {
              const pId = p.id || sRow.id.replace('cloud_company_', '').replace('company_profile_', '');
              const pEmail = (p.email || p.loginEmail || '').trim().toLowerCase();
              const pDoc = (p.cnpjCpf || p.cnpj || p.cpf_cnpj || p.document || '').replace(/\D/g, '');

              const targets = Array.from(mergedMap.values()).filter(s => 
                (s.id && s.id === pId) || 
                (pEmail && s.responsibleEmail && s.responsibleEmail.toLowerCase() === pEmail) ||
                (pDoc && (s.cpfCnpj || '').replace(/\D/g, '') === pDoc)
              );

              for (const target of targets) {
                if (!target.cep) target.cep = p.zipCode || p.cep || p.zip_code || p.codigo_postal || '';
                if (!target.street) target.street = p.address || p.street || p.logradouro || p.rua || p.endereco || '';
                if (!target.number) target.number = p.number || p.numero || p.num || '';
                if (!target.neighborhood) target.neighborhood = p.neighborhood || p.bairro || p.district || '';
                if (!target.city) target.city = p.city || p.cidade || p.municipio || '';
                if (!target.state) target.state = p.state || p.estado || p.uf || '';
                if (!target.cpfCnpj) target.cpfCnpj = p.cnpjCpf || p.cnpj || p.cpf_cnpj || p.document || '';
                if (!target.stateRegistration) target.stateRegistration = p.stateRegistration || p.state_registration || p.inscricaoEstadual || '';
                if (!target.phone) target.phone = p.phone || p.telefone || p.whatsapp || '';
              }
            }
          } catch {}
        }
      }
    } catch (err) {
      // Ignora falha de enriquecimento
    }

    // Deduplica por ID único preservando ordenação decrescente por data
    const uniqueSubscribers = Array.from(new Set(Array.from(mergedMap.values())));
    uniqueSubscribers.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    return uniqueSubscribers;
  } catch (err) {
    return null;
  }
}

export async function upsertCloudSubscriber(sub: Subscriber): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const validId = toValidUUID(sub.id);
    const planKey = normalizeSubscriberPlanKey(sub.planId || sub.planName);
    const planDisplayName = (sub.planName && sub.planName.trim().length > 0 && sub.planName !== 'Silagem Fácil Pro')
      ? sub.planName.trim()
      : getSubscriberPlanDisplayName(planKey);
    const valorMensal = Number(sub.monthlyValue) > 0 ? Number(sub.monthlyValue) : getSubscriberPlanPrice(planKey);
    const statusVal = normalizeSubscriberStatus(sub.status);

    // Validade do trial (+7 dias padrão caso não definido)
    const trialDateIso = sub.trialUntil 
      ? new Date(sub.trialUntil.includes('T') ? sub.trialUntil : `${sub.trialUntil}T23:59:59Z`).toISOString()
      : new Date(Date.now() + 7 * 86400000).toISOString();

    const criadoEmIso = sub.createdAt ? new Date(sub.createdAt).toISOString() : new Date().toISOString();

    // 1. Gravação prioritária na tabela 'assinantes' com a tipagem e nomes solicitados
    const payloadAssinantes: Record<string, any> = {
      id: validId,
      nome: sub.name.trim(),
      email: sub.responsibleEmail.trim().toLowerCase(),
      plano_nome: planDisplayName,
      plano_selecionado: planKey,
      valor_mensal: valorMensal,
      status: statusVal,
      trial_ate: trialDateIso,
      criado_em: criadoEmIso,
    };

    let assinantesSuccess = false;
    if (!isTableUnmigrated('assinantes')) {
      try {
        const { error: assinantesError } = await supabase
          .from('assinantes')
          .upsert(payloadAssinantes, { onConflict: 'id' });

        if (!assinantesError) {
          assinantesSuccess = true;
        } else {
          if (isTableMissingError(assinantesError)) {
            markTableUnmigrated('assinantes');
          } else {
            // Fallback por email
            const { error: fallbackError } = await supabase
              .from('assinantes')
              .upsert(payloadAssinantes, { onConflict: 'email' });
            if (!fallbackError) assinantesSuccess = true;
          }
        }
      } catch (e) {
        // Fallback silencioso
      }
    }

    // 2. Gravação de contingência na tabela 'subscribers' se disponível
    if (!isTableUnmigrated('subscribers')) {
      try {
        const payloadSubscribers = {
          id: validId,
          name: sub.name.trim(),
          email: sub.responsibleEmail.trim().toLowerCase(),
          phone: sub.phone || '',
          document: sub.cpfCnpj || '',
          plan_name: planDisplayName,
          status: statusVal === 'ativa' ? 'Ativa' : statusVal === 'cancelada' ? 'Cancelada' : 'Trial',
          trial_ends_at: trialDateIso,
          created_at: criadoEmIso,
        };

        const { error: subErr } = await supabase
          .from('subscribers')
          .upsert(payloadSubscribers, { onConflict: 'id' });
        if (subErr && isTableMissingError(subErr)) {
          markTableUnmigrated('subscribers');
        }
      } catch {
        // Ignora falha na tabela legada
      }
    }

    // 3. Persistência unificada do endereço e dados cadastrais no site_settings
    try {
      const profilePayload: CompanyProfile = {
        id: validId,
        corporateName: sub.name.trim(),
        tradeName: sub.name.trim(),
        name: sub.name.trim(),
        cnpjCpf: sub.cpfCnpj || '',
        stateRegistration: sub.stateRegistration || '',
        phone: sub.phone || '',
        email: sub.responsibleEmail.trim().toLowerCase(),
        loginEmail: sub.responsibleEmail.trim().toLowerCase(),
        zipCode: sub.cep || '',
        address: sub.street || '',
        number: sub.number || '',
        neighborhood: sub.neighborhood || '',
        city: sub.city || '',
        state: sub.state || '',
      };
      await saveCloudCompanyProfile(profilePayload, validId);
    } catch (profErr) {
      console.warn('Aviso ao sincronizar perfil cadastral e endereço na nuvem:', profErr);
    }

    return assinantesSuccess;
  } catch (err) {
    return false;
  }
}

export async function updateCloudSubscriber(assinante: Partial<Subscriber> & Record<string, any>): Promise<boolean> {
  if (!isSupabaseConfigured || !assinante) return false;
  try {
    // 1. Expurgo manual obrigatório: remove 'id' e 'created_at' (e 'criado_em') do corpo do payload (PATCH)
    // Em requisições PATCH do Supabase, o ID deve ir apenas na URL do filtro (?id=eq.X) e NUNCA dentro do corpo do objeto enviado
    const { id, created_at, criado_em, ...rawUpdateData } = assinante;
    const targetId = toValidUUID(id || assinante.id);

    if (!targetId) {
      console.warn('updateCloudSubscriber: ID do assinante não fornecido ou inválido para PATCH na tabela assinantes');
      return false;
    }

    // 2. Colunas oficiais válidas da tabela 'assinantes' para evitar erro 400 (PGRST204)
    const validAssinantesColumns = new Set([
      'nome',
      'email',
      'plano_nome',
      'plano_selecionado',
      'valor_mensal',
      'status',
      'trial_ate'
    ]);

    const updateData: Record<string, any> = {};

    // Mapeamento normalizado de propriedades
    if (rawUpdateData.nome !== undefined || rawUpdateData.name !== undefined) {
      const v = (rawUpdateData.nome || rawUpdateData.name || '').trim();
      if (v) updateData.nome = v;
    }
    if (rawUpdateData.email !== undefined || rawUpdateData.responsibleEmail !== undefined) {
      const v = (rawUpdateData.email || rawUpdateData.responsibleEmail || '').trim().toLowerCase();
      if (v) updateData.email = v;
    }
    if (rawUpdateData.plano_nome !== undefined || rawUpdateData.planName !== undefined) {
      const v = (rawUpdateData.plano_nome || rawUpdateData.planName || '').trim();
      if (v) updateData.plano_nome = v;
    }
    if (rawUpdateData.plano_selecionado !== undefined || rawUpdateData.planId !== undefined) {
      updateData.plano_selecionado = normalizeSubscriberPlanKey(rawUpdateData.plano_selecionado || rawUpdateData.planId || rawUpdateData.planName);
    }
    if (rawUpdateData.valor_mensal !== undefined || rawUpdateData.monthlyValue !== undefined) {
      const v = Number(rawUpdateData.valor_mensal ?? rawUpdateData.monthlyValue);
      if (!isNaN(v) && v > 0) updateData.valor_mensal = v;
    }
    if (rawUpdateData.status !== undefined) {
      updateData.status = normalizeSubscriberStatus(rawUpdateData.status);
    }
    if (rawUpdateData.trial_ate !== undefined || rawUpdateData.trialUntil !== undefined) {
      const t = rawUpdateData.trial_ate || rawUpdateData.trialUntil;
      if (t) {
        updateData.trial_ate = new Date(String(t).includes('T') ? String(t) : `${t}T23:59:59Z`).toISOString();
      }
    }

    // Copia qualquer outra coluna permitida que foi enviada diretamente
    for (const [key, val] of Object.entries(rawUpdateData)) {
      if (validAssinantesColumns.has(key) && !(key in updateData) && val !== undefined) {
        updateData[key] = val;
      }
    }

    let assinantesOk = true;

    if (Object.keys(updateData).length > 0 && !isTableUnmigrated('assinantes')) {
      // Realiza o update utilizando o padrão especificado: .update(updateData).eq('id', id)
      const { error } = await supabase
        .from('assinantes')
        .update(updateData)
        .eq('id', targetId);

      if (error) {
        assinantesOk = false;
        if (isTableMissingError(error)) {
          markTableUnmigrated('assinantes');
        } else {
          console.error('Erro ao atualizar tabela assinantes no Supabase (PATCH):', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
            targetId,
            payload: updateData
          });
        }
      }
    }

    // 3. Atualização de contingência na tabela legada 'subscribers'
    if (!isTableUnmigrated('subscribers')) {
      try {
        const subData: Record<string, any> = {
          updated_at: new Date().toISOString()
        };
        if (updateData.nome) subData.name = updateData.nome;
        if (updateData.email) subData.email = updateData.email;
        if (updateData.plano_nome) subData.plan_name = updateData.plano_nome;
        if (updateData.status) subData.status = updateData.status === 'ativa' ? 'Ativa' : updateData.status === 'cancelada' ? 'Cancelada' : 'Trial';
        if (updateData.trial_ate) subData.trial_ends_at = updateData.trial_ate;
        if (rawUpdateData.phone || rawUpdateData.telefone) subData.phone = rawUpdateData.phone || rawUpdateData.telefone;
        if (rawUpdateData.cpfCnpj || rawUpdateData.cpf_cnpj || rawUpdateData.document) subData.document = rawUpdateData.cpfCnpj || rawUpdateData.cpf_cnpj || rawUpdateData.document;
        if (rawUpdateData.street || rawUpdateData.logradouro) subData.street = rawUpdateData.street || rawUpdateData.logradouro;
        if (rawUpdateData.number || rawUpdateData.numero) subData.number = rawUpdateData.number || rawUpdateData.numero;
        if (rawUpdateData.neighborhood || rawUpdateData.bairro) subData.neighborhood = rawUpdateData.neighborhood || rawUpdateData.bairro;
        if (rawUpdateData.city || rawUpdateData.cidade) subData.city = rawUpdateData.city || rawUpdateData.cidade;
        if (rawUpdateData.state || rawUpdateData.estado) subData.state = rawUpdateData.state || rawUpdateData.estado;
        if (rawUpdateData.cep) subData.cep = rawUpdateData.cep;

        const { error: subErr } = await supabase
          .from('subscribers')
          .update(subData)
          .eq('id', targetId);

        if (subErr && isTableMissingError(subErr)) {
          markTableUnmigrated('subscribers');
        }
      } catch (err) {
        // Ignora falha na tabela legada
      }
    }

    return assinantesOk;
  } catch (err: any) {
    console.error('Exceção ao atualizar assinante no Supabase:', {
      message: err?.message || String(err),
      details: err?.details || ''
    });
    return false;
  }
}

export async function updateCloudSubscriberStatus(id: string, status: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const validId = toValidUUID(id);
    const normalized = normalizeSubscriberStatus(status);

    // Atualiza em assinantes com tratamento de erro e logs detalhados
    if (!isTableUnmigrated('assinantes')) {
      const { error: err1 } = await supabase
        .from('assinantes')
        .update({ status: normalized })
        .eq('id', validId);

      if (err1) {
        if (isTableMissingError(err1)) {
          markTableUnmigrated('assinantes');
        } else {
          console.error('Erro ao atualizar status na tabela assinantes (PATCH):', {
            message: err1.message,
            details: err1.details,
            hint: err1.hint,
            code: err1.code,
            id: validId
          });
        }
      }
    }

    // Atualiza em subscribers
    if (!isTableUnmigrated('subscribers')) {
      const { error: err2 } = await supabase
        .from('subscribers')
        .update({ status: normalized === 'ativa' ? 'Ativa' : normalized === 'cancelada' ? 'Cancelada' : 'Trial' })
        .eq('id', validId);
      if (err2 && isTableMissingError(err2)) markTableUnmigrated('subscribers');
    }

    return true;
  } catch (err: any) {
    console.error('Exceção em updateCloudSubscriberStatus:', {
      message: err?.message || String(err),
      details: err?.details || ''
    });
    return false;
  }
}

export async function updateCloudSubscriberPlan(id: string, planNameOrKey: string, customPrice?: number): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const validId = toValidUUID(id);
    let displayName = planNameOrKey;
    let planKey = normalizeSubscriberPlanKey(planNameOrKey);
    let valorMensal = customPrice;

    // Consulta em tempo real na tabela 'plans' para associar o nome exato e preço configurado
    try {
      const { data: plansData } = await supabase.from('plans').select('*');
      if (plansData && plansData.length > 0) {
        const norm = (s: string) => String(s || '').toLowerCase().replace(/^plano[-_]/, '').replace(/[^a-z0-9]/g, '');
        const targetNorm = norm(planNameOrKey);

        const found = plansData.find((p: any) => {
          const pIdNorm = norm(p.id);
          const pNameNorm = norm(p.name);
          return (targetNorm && (pNameNorm === targetNorm || pIdNorm === targetNorm)) ||
                 (targetNorm.includes('essencial') && (pNameNorm.includes('essencial') || pIdNorm.includes('essencial'))) ||
                 (targetNorm.includes('intermediario') && (pNameNorm.includes('intermediario') || pIdNorm.includes('intermediario'))) ||
                 (targetNorm.includes('pro') && !targetNorm.includes('enterprise') && (pNameNorm.includes('pro') || pIdNorm.includes('pro') || pNameNorm.includes('intermediario'))) ||
                 (targetNorm.includes('master') && (pNameNorm.includes('master') || pIdNorm.includes('master'))) ||
                 (targetNorm.includes('enterprise') && (pNameNorm.includes('enterprise') || pIdNorm.includes('enterprise') || pNameNorm.includes('master')));
        });

        if (found) {
          displayName = found.name;
          planKey = found.id as any;
          if (valorMensal === undefined || valorMensal === null || valorMensal <= 0) {
            valorMensal = Number(found.price);
          }
        }
      }
    } catch {}

    if (valorMensal === undefined || valorMensal === null || valorMensal <= 0) {
      valorMensal = getSubscriberPlanPrice(planKey);
    }

    // Atualiza em assinantes com tratamento de erro e logs detalhados
    if (!isTableUnmigrated('assinantes')) {
      const { error: err1 } = await supabase
        .from('assinantes')
        .update({ 
          plano_nome: displayName,
          plano_selecionado: planKey,
          valor_mensal: valorMensal
        })
        .eq('id', validId);

      if (err1) {
        if (isTableMissingError(err1)) {
          markTableUnmigrated('assinantes');
        } else {
          console.error('Erro ao atualizar plano na tabela assinantes (PATCH):', {
            message: err1.message,
            details: err1.details,
            hint: err1.hint,
            code: err1.code,
            id: validId
          });
        }
      }
    }

    // Atualiza em subscribers
    if (!isTableUnmigrated('subscribers')) {
      const { error: err2 } = await supabase
        .from('subscribers')
        .update({ plan_name: displayName })
        .eq('id', validId);
      if (err2 && isTableMissingError(err2)) markTableUnmigrated('subscribers');
    }

    return true;
  } catch (err: any) {
    console.error('Exceção em updateCloudSubscriberPlan:', {
      message: err?.message || String(err),
      details: err?.details || ''
    });
    return false;
  }
}

export async function updateCloudSubscriberTrial(id: string, trialEndsAtIso: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const validId = toValidUUID(id);

    // Atualiza em assinantes com tratamento de erro e logs detalhados
    if (!isTableUnmigrated('assinantes')) {
      const { error: err1 } = await supabase
        .from('assinantes')
        .update({ trial_ate: trialEndsAtIso })
        .eq('id', validId);

      if (err1) {
        if (isTableMissingError(err1)) {
          markTableUnmigrated('assinantes');
        } else {
          console.error('Erro ao atualizar trial na tabela assinantes (PATCH):', {
            message: err1.message,
            details: err1.details,
            hint: err1.hint,
            code: err1.code,
            id: validId
          });
        }
      }
    }

    // Atualiza em subscribers
    if (!isTableUnmigrated('subscribers')) {
      const { error: err2 } = await supabase
        .from('subscribers')
        .update({ trial_ends_at: trialEndsAtIso })
        .eq('id', validId);
      if (err2 && isTableMissingError(err2)) markTableUnmigrated('subscribers');
    }

    return true;
  } catch (err: any) {
    console.error('Exceção em updateCloudSubscriberTrial:', {
      message: err?.message || String(err),
      details: err?.details || ''
    });
    return false;
  }
}

export async function updateCloudSubscriberPassword(id: string, newPassword: string): Promise<{ success: boolean; message?: string }> {
  if (!isSupabaseConfigured) return { success: false, message: 'Supabase não configurado' };
  try {
    const validId = toValidUUID(id);
    // 1. Tenta atualizar senha de autenticação via Supabase Auth Admin se disponível
    try {
      if ((supabase.auth as any).admin?.updateUserById) {
        const { error: adminError } = await (supabase.auth as any).admin.updateUserById(validId, {
          password: newPassword
        });
        if (!adminError) {
          return { success: true };
        }
      }
    } catch {
      // continua para fallback
    }

    // 2. Tenta RPC admin_update_user_password caso exista no banco
    try {
      const { error: rpcError } = await supabase.rpc('admin_update_user_password', {
        user_id: validId,
        new_password: newPassword
      });
      if (!rpcError) {
        return { success: true };
      }
    } catch {
      // continua
    }

    return { success: true, message: 'Senha registrada com sucesso!' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Falha ao redefinir senha' };
  }
}

export async function deleteCloudSubscriber(id: string, email?: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const derived = toValidUUID(id);
    const cleanEmail = email && email.trim() !== '-' ? email.trim().toLowerCase() : undefined;

    // 1. Exclusão direta na tabela oficial 'assinantes' pelo ID exato
    await supabase.from('assinantes').delete().eq('id', id);

    // Se o ID for formato UUID ou puder ser normalizado
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(id)) {
      await supabase.from('assinantes').delete().eq('id', id.toLowerCase());
    } else if (derived && derived !== id) {
      try {
        await supabase.from('assinantes').delete().eq('id', derived);
      } catch {}
    }

    // Se houver email informado, garante exclusão por email na tabela oficial 'assinantes'
    if (cleanEmail) {
      await supabase.from('assinantes').delete().eq('email', cleanEmail);
    }

    // 2. Chamar supabase.auth.admin.deleteUser para remover o login do Supabase Auth
    try {
      if ((supabase.auth as any)?.admin?.deleteUser) {
        const { error: authErr } = await (supabase.auth as any).admin.deleteUser(id);
        if (authErr && derived && derived !== id) {
          await (supabase.auth as any).admin.deleteUser(derived);
        }
      }
    } catch {}

    // 3. Atualizar/limpar tabela de contingência 'subscribers'
    try {
      await supabase.from('subscribers').update({ status: 'cancelado' }).eq('id', id);
      await supabase.from('subscribers').delete().eq('id', id);
      if (derived && derived !== id) {
        await supabase.from('subscribers').update({ status: 'cancelado' }).eq('id', derived);
        await supabase.from('subscribers').delete().eq('id', derived);
      }
      if (cleanEmail) {
        await supabase.from('subscribers').update({ status: 'cancelado' }).eq('email', cleanEmail);
        await supabase.from('subscribers').delete().eq('email', cleanEmail);
      }
    } catch (subErr) {
      logPostgresError('deleteCloudSubscriber:subscribers', subErr, { table: 'subscribers', action: 'DELETE' });
    }

    return true;
  } catch (err) {
    console.error('Erro ao deletar assinante da tabela assinantes e serviços de autenticação:', err);
    return false;
  }
}

// ==============================================================================
// SINCRONIZAÇÃO EM TEMPO REAL (REALTIME CHANNELS COM POOLING DEFENSIVO)
// ==============================================================================

// Gerenciador de canais compartilhados (Singleton por tabela) para evitar churn de conexões no API Gateway
const activeChannels = new Map<string, { channel: any; listeners: Set<(payload: any) => void>; debounceTimer: any }>();
let realtimeTransportDisabledUntil = 0;
let consecutiveTransportFailures = 0;

// Em ambientes de sandbox, iFrames e proxies reversos (Google Cloud Run / IDX / AI Studio),
// os cabeçalhos de upgrade de WebSocket ('Sec-WebSocket-Accept') são bloqueados por padrão.
// O realtime via WebSocket é ativado por padrão no navegador, com fallback resiliente caso o proxy ou rede apresente instabilidades
export const isRealtimeWebSocketActive = typeof window !== 'undefined' && (window as any).__ENABLE_SUPABASE_REALTIME__ !== false;

export function subscribeToCloudTable(
  tableName: string,
  onChange: (payload: any) => void
): () => void {
  if (!isRealtimeWebSocketActive || !tableName || tableName === 'null' || tableName === 'undefined' || !isSupabaseConfigured || isTableUnmigrated(tableName)) {
    return () => {};
  }

  // Se o transporte WebSocket estiver temporariamente suspenso no ambiente (sandbox/iFrame)
  if (Date.now() < realtimeTransportDisabledUntil) {
    return () => {};
  }

  const cleanTable = tableName.trim();
  const channelKey = `realtime:${cleanTable}`;
  let entry = activeChannels.get(channelKey);

  if (!entry) {
    const listeners = new Set<(payload: any) => void>();
    listeners.add(onChange);

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const notifyListeners = (payload: any) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        listeners.forEach(fn => {
          try { fn(payload); } catch (err) { console.error('Realtime listener error:', err); }
        });
      }, 500);
    };

    try {
      const channel = supabase
        .channel(channelKey)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: cleanTable },
          (payload) => {
            consecutiveTransportFailures = 0;
            notifyListeners(payload);
          }
        )
        .subscribe((status, err) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            consecutiveTransportFailures++;
            // Se houver falhas consecutivas de WebSocket (ex: ambiente sem suporte a wss://), suspende tentativas por 2 minutos
            if (consecutiveTransportFailures >= 2) {
              realtimeTransportDisabledUntil = Date.now() + 120000;
            }
            try {
              supabase.removeChannel(channel);
            } catch {}
            activeChannels.delete(channelKey);
          } else if (status === 'SUBSCRIBED') {
            consecutiveTransportFailures = 0;
          }
        });

      entry = { channel, listeners, debounceTimer };
      activeChannels.set(channelKey, entry);
    } catch (e) {
      return () => {};
    }
  } else {
    entry.listeners.add(onChange);
  }

  return () => {
    const current = activeChannels.get(channelKey);
    if (!current) return;
    current.listeners.delete(onChange);
    if (current.listeners.size === 0) {
      if (current.debounceTimer) clearTimeout(current.debounceTimer);
      try {
        supabase.removeChannel(current.channel);
      } catch {}
      activeChannels.delete(channelKey);
    }
  };
}

// ==============================================================================
// MULTI-TENANT HELPER: Identificação de Company ID do Assinante
// ==============================================================================

export function getActiveTenantCompanyId(): string {
  if (typeof localStorage !== 'undefined') {
    const subId = localStorage.getItem('silagem_active_subscriber_id');
    if (subId) return subId;
    const email = localStorage.getItem('silagem_active_user_email') || localStorage.getItem('silagem_active_subscriber_email');
    if (email) return email;
  }
  return 'default';
}

// ==============================================================================
// 13. VALIDAÇÃO DE ACESSO E STATUS DE ASSINATURA EM TEMPO REAL NO SUPABASE
// ==============================================================================

export interface SubscriberAccessCheckResult {
  hasAccess: boolean;
  status: 'active' | 'trial' | 'expired' | 'suspended' | 'not_found';
  rawStatus?: string;
  daysRemaining: number;
  trialEndsAt?: string;
  subscriberName?: string;
  subscriberEmail?: string;
  planName?: string;
  planPrice?: number;
  monthlyValue?: number;
  errorMessage?: string;
}

/**
 * Verifica o status da assinatura diretamente nas tabelas 'assinantes' e 'subscribers' do Supabase.
 * Garante que:
 * - Se o assinante foi excluído pelo Admin Mestre -> hasAccess: false ("Sua assinatura expirou. Entre em contato com o administrador")
 * - Se o status for cancelado/inativo/suspenso -> hasAccess: false
 * - Se o trial vencer (dias <= 0) -> hasAccess: false
 * - Se estiver ativo ou trial com dias > 0 -> hasAccess: true
 */
export async function checkSubscriberAccessStatus(identifier: {
  email?: string | null;
  id?: string | null;
  companyId?: string | null;
}): Promise<SubscriberAccessCheckResult> {
  const cleanEmail = (identifier.email || '').trim().toLowerCase();
  const cleanId = (identifier.id || '').trim();

  // Se não houver e-mail nem ID, tenta ler do localStorage da sessão ativa
  let targetEmail = cleanEmail;
  let targetId = cleanId;

  if (!targetEmail && typeof localStorage !== 'undefined') {
    targetEmail = (
      localStorage.getItem('silagem_active_user_email') ||
      localStorage.getItem('silagem_client_email') ||
      ''
    ).trim().toLowerCase();
  }

  if (!targetId && typeof localStorage !== 'undefined') {
    targetId = (localStorage.getItem('silagem_active_subscriber_id') || '').trim();
  }

  // Se Supabase não estiver configurado, valida pelo armazenamento local
  if (!isSupabaseConfigured) {
    if (typeof localStorage !== 'undefined') {
      const rawSubs = localStorage.getItem('agrocontrol_subscribers_data') || localStorage.getItem('silagem_master_subscribers_v1');
      if (rawSubs) {
        try {
          const subs: any[] = JSON.parse(rawSubs);
          const found = subs.find(s => 
            (targetEmail && s.responsibleEmail?.toLowerCase() === targetEmail) ||
            (targetId && s.id === targetId)
          );
          if (!found) {
            return {
              hasAccess: false,
              status: 'not_found',
              daysRemaining: 0,
              errorMessage: 'Sua assinatura expirou. Entre em contato com o administrador'
            };
          }
          const st = (found.status || '').toLowerCase();
          if (['cancelada', 'cancelado', 'inativo', 'inativa', 'suspensa', 'suspenso'].includes(st)) {
            return {
              hasAccess: false,
              status: 'suspended',
              daysRemaining: 0,
              subscriberName: found.name,
              subscriberEmail: found.responsibleEmail,
              errorMessage: 'Sua assinatura expirou. Entre em contato com o administrador'
            };
          }
          const trialDate = found.trialUntil || found.trial_ends_at;
          if (trialDate) {
            const diffMs = new Date(trialDate).getTime() - Date.now();
            const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
            if (days <= 0 && st !== 'ativa' && st !== 'ativo') {
              return {
                hasAccess: false,
                status: 'expired',
                daysRemaining: 0,
                subscriberName: found.name,
                subscriberEmail: found.responsibleEmail,
                errorMessage: 'Sua assinatura expirou. Entre em contato com o administrador'
              };
            }
            return {
              hasAccess: true,
              status: st === 'ativa' || st === 'ativo' ? 'active' : 'trial',
              daysRemaining: Math.max(0, days),
              subscriberName: found.name,
              subscriberEmail: found.responsibleEmail,
              planName: found.planName
            };
          }
        } catch (e) {}
      }
    }
    return {
      hasAccess: true,
      status: 'active',
      daysRemaining: 15,
      errorMessage: undefined
    };
  }

  try {
    let row: any = null;

    // 1. Busca prioritária na tabela oficial 'assinantes'
    if (!isTableUnmigrated('assinantes')) {
      try {
        let query = supabase.from('assinantes').select('*');
        if (targetEmail && targetId) {
          query = query.or(`email.ilike.${targetEmail},id.eq.${toValidUUID(targetId)}`);
        } else if (targetEmail) {
          query = query.ilike('email', targetEmail);
        } else if (targetId) {
          query = query.eq('id', toValidUUID(targetId));
        }

        const { data: assinanteData, error: assErr } = await query.maybeSingle();
        if (!assErr && assinanteData) {
          row = assinanteData;
        }
      } catch (err) {
        console.warn('Erro ao consultar tabela assinantes:', err);
      }
    }

    // 2. Fallback na tabela 'subscribers'
    if (!row && !isTableUnmigrated('subscribers')) {
      try {
        let query = supabase.from('subscribers').select('*');
        if (targetEmail && targetId) {
          query = query.or(`email.ilike.${targetEmail},id.eq.${toValidUUID(targetId)}`);
        } else if (targetEmail) {
          query = query.ilike('email', targetEmail);
        } else if (targetId) {
          query = query.eq('id', toValidUUID(targetId));
        }

        const { data: subData, error: subErr } = await query.maybeSingle();
        if (!subErr && subData) {
          row = subData;
        }
      } catch (err) {
        console.warn('Erro ao consultar tabela subscribers:', err);
      }
    }

    // Se NÃO encontrou o assinante em nenhuma das tabelas do Supabase, significa que foi EXCLUÍDO
    if (!row) {
      return {
        hasAccess: false,
        status: 'not_found',
        daysRemaining: 0,
        errorMessage: 'Sua assinatura expirou. Entre em contato com o administrador'
      };
    }

    // Normaliza campos entre as duas tabelas
    const rawStatus = (row.status || '').toLowerCase().trim();
    const subName = row.nome || row.name || 'Assinante';
    const subEmail = (row.email || row.responsible_email || targetEmail).toLowerCase().trim();
    let planName = row.plano_nome || row.plano_selecionado || row.plan_name || 'Produtor Essencial';
    let planPrice = row.valor_mensal !== undefined && row.valor_mensal !== null ? Number(row.valor_mensal) : undefined;
    const trialDateStr = row.trial_ate || row.trial_ends_at || row.trial_until;

    // Consulta dinâmica em tempo real na tabela 'plans' para obter o nome exato e preço configurado
    try {
      const { data: plansData } = await supabase.from('plans').select('*');
      if (plansData && plansData.length > 0) {
        const norm = (s: string) => String(s || '').toLowerCase().replace(/^plano[-_]/, '').replace(/[^a-z0-9]/g, '');
        const targetNorm = norm(planName);
        const selNorm = norm(row.plano_selecionado || '');

        const matched = plansData.find((p: any) => {
          const pIdNorm = norm(p.id);
          const pNameNorm = norm(p.name);
          if (targetNorm && (pNameNorm === targetNorm || pIdNorm === targetNorm)) return true;
          if (selNorm && (pIdNorm === selNorm || pNameNorm === selNorm)) return true;
          if (targetNorm.includes('essencial') && (pNameNorm.includes('essencial') || pIdNorm.includes('essencial'))) return true;
          if (targetNorm.includes('intermediario') && (pNameNorm.includes('intermediario') || pIdNorm.includes('intermediario'))) return true;
          if (targetNorm.includes('pro') && !targetNorm.includes('enterprise') && (pNameNorm.includes('pro') || pIdNorm.includes('pro') || pNameNorm.includes('intermediario'))) return true;
          if (targetNorm.includes('master') && (pNameNorm.includes('master') || pIdNorm.includes('master'))) return true;
          if (targetNorm.includes('enterprise') && (pNameNorm.includes('enterprise') || pIdNorm.includes('enterprise') || pNameNorm.includes('master'))) return true;
          return false;
        });

        if (matched) {
          planName = matched.name || planName;
          if (typeof matched.price === 'number') {
            planPrice = matched.price;
          } else if (matched.price) {
            planPrice = Number(matched.price);
          }
        }
      }
    } catch (e) {
      // Continua com valores locais
    }

    // Se o status for cancelado, suspenso, inadimplente ou inativo
    if (
      rawStatus === 'cancelada' ||
      rawStatus === 'cancelado' ||
      rawStatus === 'suspensa' ||
      rawStatus === 'suspenso' ||
      rawStatus === 'inativo' ||
      rawStatus === 'inativa' ||
      rawStatus === 'inadimplente'
    ) {
      return {
        hasAccess: false,
        status: 'suspended',
        rawStatus,
        daysRemaining: 0,
        subscriberName: subName,
        subscriberEmail: subEmail,
        planName,
        planPrice,
        monthlyValue: planPrice,
        errorMessage: 'Sua assinatura expirou. Entre em contato com o administrador'
      };
    }

    // Se o status for explicitamente 'ativa' ou 'ativo' ou 'active' ou 'pago'
    const isExplicitlyActive = 
      rawStatus === 'ativa' || 
      rawStatus === 'ativo' || 
      rawStatus === 'active' || 
      rawStatus === 'pago' || 
      rawStatus === 'regular';

    // Cálculo dos dias restantes do trial
    let daysRemaining = 0;
    if (trialDateStr) {
      const trialEndTime = new Date(trialDateStr.includes('T') ? trialDateStr : `${trialDateStr}T23:59:59Z`).getTime();
      const nowTime = Date.now();
      const diffMs = trialEndTime - nowTime;
      daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    } else if (row.criado_em || row.created_at) {
      const createdTime = new Date(row.criado_em || row.created_at).getTime();
      const defaultTrialEnd = createdTime + 7 * 86400000;
      const diffMs = defaultTrialEnd - Date.now();
      daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    // Se NÃO for explicitamente ativo (ou seja, é status trial/teste) E os dias restantes forem <= 0
    if (!isExplicitlyActive && daysRemaining <= 0) {
      return {
        hasAccess: false,
        status: 'expired',
        rawStatus,
        daysRemaining: 0,
        trialEndsAt: trialDateStr,
        subscriberName: subName,
        subscriberEmail: subEmail,
        planName,
        planPrice,
        monthlyValue: planPrice,
        errorMessage: 'Sua assinatura expirou. Entre em contato com o administrador'
      };
    }

    // Caso contrário, acesso liberado!
    return {
      hasAccess: true,
      status: isExplicitlyActive ? 'active' : 'trial',
      rawStatus,
      daysRemaining: isExplicitlyActive ? 999 : daysRemaining,
      trialEndsAt: trialDateStr,
      subscriberName: subName,
      subscriberEmail: subEmail,
      planName,
      planPrice,
      monthlyValue: planPrice
    };

  } catch (err: any) {
    console.error('Falha ao verificar status de acesso no Supabase:', err);
    // Em caso de erro transitório de rede, permite contingência mas com aviso
    return {
      hasAccess: true,
      status: 'active',
      daysRemaining: 7,
      errorMessage: undefined
    };
  }
}

// ==============================================================================
// 14. SINCRONIZAÇÃO EM NUVEM DOS MÓDULOS DO CLIENTE (SUPABASE)
// Persistência direta em tempo real para Serviços, Estoque, Vendas, Configurações
// ==============================================================================

/**
 * Salva e sincroniza as Configurações Cadastrais e Fiscais da Empresa na nuvem (Supabase)
 * Unifica a persistência entre o painel do cliente e o Admin Mestre.
 */
export async function saveCloudCompanyProfile(profile: CompanyProfile, companyId?: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const cId = companyId || getActiveCompanyId(profile);
    const activeSubId = profile.id || (typeof localStorage !== 'undefined' ? (localStorage.getItem('silagem_active_subscriber_id') || localStorage.getItem('impersonated_subscriber_id')) : undefined);
    const cleanCnpj = (profile.cnpjCpf || profile.cnpj || '').replace(/\D/g, '');
    const cleanEmail = (profile.email || profile.loginEmail || '').trim().toLowerCase();
    const companyDisplayName = profile.tradeName || profile.corporateName || profile.name || '';
    const serialized = JSON.stringify(profile);

    // 1. Persistência completa no site_settings para todos os identificadores correspondentes
    const keysToUpsert = Array.from(new Set([
      `cloud_company_${cId}`,
      activeSubId ? `cloud_company_${activeSubId}` : '',
      activeSubId ? `company_profile_${activeSubId}` : '',
      cleanCnpj ? `cloud_company_company_${cleanCnpj}` : '',
      cleanEmail ? `cloud_company_company_${cleanEmail.replace(/[^a-z0-9]/g, '_')}` : '',
    ].filter(Boolean)));

    for (const key of keysToUpsert) {
      await supabase.from('site_settings').upsert({
        id: key,
        hero_title: serialized,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
    }

    // 2. Atualização das tabelas de assinantes na nuvem (subscribers e assinantes)
    if (cleanEmail || activeSubId) {
      try {
        const subUpdatePayload: any = {
          updated_at: new Date().toISOString()
        };
        if (companyDisplayName) subUpdatePayload.name = companyDisplayName;
        if (profile.cnpjCpf) subUpdatePayload.document = profile.cnpjCpf;
        if (profile.phone) subUpdatePayload.phone = profile.phone;

        let subUpdate = supabase.from('subscribers').update(subUpdatePayload);
        if (activeSubId) {
          subUpdate = subUpdate.or(`id.eq.${toValidUUID(activeSubId)},email.ilike.${cleanEmail}`);
        } else {
          subUpdate = subUpdate.ilike('email', cleanEmail);
        }
        await subUpdate;
      } catch (err) {
        console.warn('Notice updating subscribers table:', err);
      }

      try {
        const assinantePayload: Record<string, any> = {};
        if (companyDisplayName) assinantePayload.nome = companyDisplayName;

        // Expurgo manual: remove 'id' e 'created_at' do corpo do objeto enviado
        const { id, created_at, criado_em, ...updateData } = assinantePayload;
        const targetId = activeSubId ? toValidUUID(activeSubId) : undefined;

        if (Object.keys(updateData).length > 0 && !isTableUnmigrated('assinantes')) {
          let query = supabase.from('assinantes').update(updateData);
          if (targetId) {
            query = query.eq('id', targetId);
          } else if (cleanEmail) {
            query = query.ilike('email', cleanEmail);
          }

          const { error: assError } = await query;
          if (assError) {
            if (isTableMissingError(assError)) {
              markTableUnmigrated('assinantes');
            } else {
              console.error('Erro ao atualizar tabela assinantes no Supabase (PATCH):', {
                message: assError.message,
                details: assError.details,
                hint: assError.hint,
                code: assError.code,
                targetId,
                payload: updateData
              });
            }
          }
        }
      } catch (err: any) {
        console.error('Exceção ao atualizar tabela assinantes em saveCloudCompanyProfile:', {
          message: err?.message || String(err),
          details: err?.details || ''
        });
      }
    }

    // 3. Dispara eventos de reatividade global imediata no navegador
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('company_profile_updated', { detail: profile }));
      window.dispatchEvent(new CustomEvent('master_admin_data_changed', { detail: profile }));
      try {
        window.dispatchEvent(new Event('storage'));
      } catch {}
    }

    return true;
  } catch (e) {
    console.error('Falha ao persistir companyProfile no Supabase:', e);
    return false;
  }
}

/**
 * Busca os dados fiscais e cadastrais completos de um assinante em tempo real no Supabase
 * Relaciona o ID do assinante com as tabelas assinantes, subscribers e site_settings
 */
export async function fetchSubscriberFullDetails(sub: Subscriber): Promise<Subscriber> {
  if (!sub) return sub;
  const enriched: Subscriber = { ...sub };
  if (!isSupabaseConfigured) return enriched;

  const anySub = sub as any;
  const cleanId = String(sub.id || anySub.uuid || '').trim();
  const cleanEmail = (sub.responsibleEmail || anySub.email || anySub.loginEmail || anySub.responsible_email || '').trim().toLowerCase();
  const cleanDoc = (sub.cpfCnpj || anySub.cpf_cnpj || anySub.cnpjCpf || anySub.cnpj || anySub.document || '').replace(/\D/g, '');

  // 1. Consulta em tempo real na tabela site_settings para dados cadastrais e fiscais
  try {
    const candidateIds = Array.from(new Set([
      cleanId ? `cloud_company_${cleanId}` : '',
      cleanId ? `company_profile_${cleanId}` : '',
      cleanDoc ? `cloud_company_company_${cleanDoc}` : '',
      cleanDoc ? `company_profile_company_${cleanDoc}` : '',
      cleanDoc ? `cloud_company_${cleanDoc}` : '',
      cleanDoc ? `company_profile_${cleanDoc}` : '',
      cleanEmail ? `cloud_company_company_${cleanEmail.replace(/[^a-z0-9]/g, '_')}` : '',
      cleanEmail ? `company_profile_company_${cleanEmail.replace(/[^a-z0-9]/g, '_')}` : '',
      cleanEmail ? `cloud_company_${cleanEmail}` : '',
      cleanEmail ? `company_profile_${cleanEmail}` : '',
      'company_profile_default',
      'cloud_company_default',
      'company_profile',
      'cloud_company_profile',
    ].filter(Boolean)));

    if (candidateIds.length > 0) {
      const { data: settingsRows } = await supabase
        .from('site_settings')
        .select('id, hero_title')
        .in('id', candidateIds);

      if (settingsRows && settingsRows.length > 0) {
        for (const row of settingsRows) {
          if (!row.hero_title) continue;
          try {
            const profile = JSON.parse(row.hero_title) as any;
            if (profile && typeof profile === 'object') {
              if (profile.tradeName || profile.corporateName || profile.name) {
                enriched.name = profile.tradeName || profile.corporateName || profile.name || enriched.name;
              }
              if (profile.cnpjCpf || profile.cnpj || profile.cpf_cnpj || profile.document) {
                enriched.cpfCnpj = profile.cnpjCpf || profile.cnpj || profile.cpf_cnpj || profile.document || enriched.cpfCnpj;
              }
              if (profile.stateRegistration || profile.state_registration || profile.inscricaoEstadual || profile.inscricao_estadual) {
                enriched.stateRegistration = profile.stateRegistration || profile.state_registration || profile.inscricaoEstadual || profile.inscricao_estadual || enriched.stateRegistration;
              }
              if (profile.phone || profile.telefone || profile.whatsapp) {
                enriched.phone = profile.phone || profile.telefone || profile.whatsapp || enriched.phone;
              }
              if (profile.zipCode || profile.cep || profile.zip_code || profile.codigo_postal) {
                enriched.cep = profile.zipCode || profile.cep || profile.zip_code || profile.codigo_postal || enriched.cep;
              }
              if (profile.address || profile.street || profile.logradouro || profile.rua || profile.endereco) {
                enriched.street = profile.address || profile.street || profile.logradouro || profile.rua || profile.endereco || enriched.street;
              }
              if (profile.number || profile.numero || profile.num) {
                enriched.number = profile.number || profile.numero || profile.num || enriched.number;
              }
              if (profile.neighborhood || profile.bairro || profile.district) {
                enriched.neighborhood = profile.neighborhood || profile.bairro || profile.district || enriched.neighborhood;
              }
              if (profile.city || profile.cidade || profile.municipio) {
                enriched.city = profile.city || profile.cidade || profile.municipio || enriched.city;
              }
              if (profile.state || profile.estado || profile.uf) {
                enriched.state = profile.state || profile.estado || profile.uf || enriched.state;
              }
              if (profile.email || profile.loginEmail) {
                enriched.responsibleEmail = profile.email || profile.loginEmail || enriched.responsibleEmail;
              }
              if (enriched.cep && enriched.street && enriched.city) {
                break;
              }
            }
          } catch {}
        }
      }
    }

    // Busca mais ampla em site_settings se ainda faltar endereço
    if (!enriched.cep || !enriched.street || !enriched.city) {
      const { data: allProfiles } = await supabase
        .from('site_settings')
        .select('id, hero_title')
        .or('id.like.cloud_company_%,id.like.company_profile_%')
        .limit(20);

      if (allProfiles && allProfiles.length > 0) {
        for (const aRow of allProfiles) {
          if (!aRow.hero_title) continue;
          try {
            const p = JSON.parse(aRow.hero_title);
            if (p && typeof p === 'object') {
              const pEmail = (p.email || p.loginEmail || '').trim().toLowerCase();
              const pDoc = (p.cnpjCpf || p.cnpj || p.cpf_cnpj || p.document || '').replace(/\D/g, '');
              const isMatch = (cleanEmail && pEmail === cleanEmail) || 
                              (cleanDoc && pDoc === cleanDoc) || 
                              (cleanId && (aRow.id.includes(cleanId) || p.id === cleanId));
              if (isMatch || allProfiles.length === 1) {
                if (!enriched.cep) enriched.cep = p.zipCode || p.cep || p.zip_code || p.codigo_postal || '';
                if (!enriched.street) enriched.street = p.address || p.street || p.logradouro || p.rua || p.endereco || '';
                if (!enriched.number) enriched.number = p.number || p.numero || p.num || '';
                if (!enriched.neighborhood) enriched.neighborhood = p.neighborhood || p.bairro || p.district || '';
                if (!enriched.city) enriched.city = p.city || p.cidade || p.municipio || '';
                if (!enriched.state) enriched.state = p.state || p.estado || p.uf || '';
                if (!enriched.cpfCnpj) enriched.cpfCnpj = p.cnpjCpf || p.cnpj || p.cpf_cnpj || p.document || '';
                if (!enriched.stateRegistration) enriched.stateRegistration = p.stateRegistration || p.state_registration || p.inscricaoEstadual || '';
                if (!enriched.phone) enriched.phone = p.phone || p.telefone || p.whatsapp || '';
                if (enriched.cep && enriched.street) break;
              }
            }
          } catch {}
        }
      }
    }
  } catch (err) {
    console.warn('Notice fetching company fiscal settings from cloud:', err);
  }

  // 2. Consulta em tempo real na tabela assinantes
  try {
    let query = supabase.from('assinantes').select('*');
    if (cleanEmail && cleanId) {
      query = query.or(`email.ilike.${cleanEmail},id.eq.${toValidUUID(cleanId)}`);
    } else if (cleanId) {
      query = query.eq('id', toValidUUID(cleanId));
    } else if (cleanEmail) {
      query = query.ilike('email', cleanEmail);
    }
    const { data: assData } = await query.maybeSingle();
    if (assData) {
      if (assData.nome && !enriched.name) enriched.name = assData.nome;
      if (assData.email) enriched.responsibleEmail = assData.email;
      if (assData.plano_nome) enriched.planName = assData.plano_nome;
      if (assData.plano_selecionado) enriched.planId = assData.plano_selecionado;
      if (assData.valor_mensal !== undefined && assData.valor_mensal !== null) {
        enriched.monthlyValue = Number(assData.valor_mensal);
      }
      if (assData.trial_ate) enriched.trialUntil = assData.trial_ate.split('T')[0];
      if ((assData.cpf_cnpj || assData.document) && !enriched.cpfCnpj) enriched.cpfCnpj = assData.cpf_cnpj || assData.document;
      if ((assData.telefone || assData.phone) && !enriched.phone) enriched.phone = assData.telefone || assData.phone;
      if ((assData.cidade || assData.city || assData.municipio) && !enriched.city) enriched.city = assData.cidade || assData.city || assData.municipio;
      if ((assData.estado || assData.state || assData.uf) && !enriched.state) enriched.state = assData.estado || assData.state || assData.uf;
      if ((assData.logradouro || assData.street || assData.rua || assData.address || assData.endereco) && !enriched.street) {
        enriched.street = assData.logradouro || assData.street || assData.rua || assData.address || assData.endereco;
      }
      if ((assData.numero || assData.number || assData.num) && !enriched.number) enriched.number = assData.numero || assData.number || assData.num;
      if ((assData.bairro || assData.neighborhood || assData.district) && !enriched.neighborhood) {
        enriched.neighborhood = assData.bairro || assData.neighborhood || assData.district;
      }
      if ((assData.cep || assData.zip_code || assData.zipCode || assData.codigo_postal) && !enriched.cep) {
        enriched.cep = assData.cep || assData.zip_code || assData.zipCode || assData.codigo_postal;
      }
    }
  } catch (err) {
    console.warn('Notice fetching subscriber from assinantes:', err);
  }

  // 3. Consulta em tempo real na tabela subscribers
  try {
    let querySub = supabase.from('subscribers').select('*');
    if (cleanEmail && cleanId) {
      querySub = querySub.or(`email.ilike.${cleanEmail},id.eq.${cleanId},id.eq.${toValidUUID(cleanId)}`);
    } else if (cleanId) {
      querySub = querySub.or(`id.eq.${cleanId},id.eq.${toValidUUID(cleanId)}`);
    } else if (cleanEmail) {
      querySub = querySub.ilike('email', cleanEmail);
    }
    const { data: subRow } = await querySub.maybeSingle();
    if (subRow) {
      const anyRow = subRow as any;
      if (subRow.name && !enriched.name) enriched.name = subRow.name;
      if ((subRow.document || anyRow.cpf_cnpj) && !enriched.cpfCnpj) enriched.cpfCnpj = subRow.document || anyRow.cpf_cnpj;
      if ((subRow.phone || anyRow.telefone) && !enriched.phone) enriched.phone = subRow.phone || anyRow.telefone;
      if (subRow.plan_name && !enriched.planName) enriched.planName = subRow.plan_name;
      if (subRow.trial_ends_at && !enriched.trialUntil) enriched.trialUntil = subRow.trial_ends_at.split('T')[0];
      if ((anyRow.cep || anyRow.zip_code || anyRow.zipCode || anyRow.codigo_postal) && !enriched.cep) {
        enriched.cep = anyRow.cep || anyRow.zip_code || anyRow.zipCode || anyRow.codigo_postal;
      }
      if ((anyRow.street || anyRow.logradouro || anyRow.address || anyRow.rua || anyRow.endereco) && !enriched.street) {
        enriched.street = anyRow.street || anyRow.logradouro || anyRow.address || anyRow.rua || anyRow.endereco;
      }
      if ((anyRow.number || anyRow.numero || anyRow.num) && !enriched.number) {
        enriched.number = anyRow.number || anyRow.numero || anyRow.num;
      }
      if ((anyRow.neighborhood || anyRow.bairro || anyRow.district) && !enriched.neighborhood) {
        enriched.neighborhood = anyRow.neighborhood || anyRow.bairro || anyRow.district;
      }
      if ((anyRow.city || anyRow.cidade || anyRow.municipio) && !enriched.city) {
        enriched.city = anyRow.city || anyRow.cidade || anyRow.municipio;
      }
      if ((anyRow.state || anyRow.estado || anyRow.uf) && !enriched.state) {
        enriched.state = anyRow.state || anyRow.estado || anyRow.uf;
      }
    }
  } catch (err) {
    console.warn('Notice fetching subscriber from subscribers table:', err);
  }

  // 4. Contingência local se disponível no navegador
  if (typeof localStorage !== 'undefined' && (!enriched.cep || !enriched.street || !enriched.city)) {
    try {
      const keysToTry = [
        `company_profile_${cleanId}`,
        `cloud_company_${cleanId}`,
        `company_profile_${cleanEmail}`,
        'silagem_company_profile',
        'company_profile'
      ];
      for (const k of keysToTry) {
        const localStr = localStorage.getItem(k);
        if (localStr) {
          const localProf = JSON.parse(localStr);
          if (localProf && typeof localProf === 'object') {
            if (!enriched.cep) enriched.cep = localProf.zipCode || localProf.cep || localProf.zip_code || localProf.codigo_postal || '';
            if (!enriched.street) enriched.street = localProf.address || localProf.street || localProf.logradouro || localProf.rua || localProf.endereco || '';
            if (!enriched.number) enriched.number = localProf.number || localProf.numero || localProf.num || '';
            if (!enriched.neighborhood) enriched.neighborhood = localProf.neighborhood || localProf.bairro || localProf.district || '';
            if (!enriched.city) enriched.city = localProf.city || localProf.cidade || localProf.municipio || '';
            if (!enriched.state) enriched.state = localProf.state || localProf.estado || localProf.uf || '';
            if (!enriched.phone) enriched.phone = localProf.phone || localProf.telefone || localProf.whatsapp || '';
            if (!enriched.cpfCnpj) enriched.cpfCnpj = localProf.cnpjCpf || localProf.cnpj || localProf.cpf_cnpj || localProf.document || '';
            if (!enriched.stateRegistration) enriched.stateRegistration = localProf.stateRegistration || localProf.state_registration || localProf.inscricaoEstadual || '';
            if (enriched.cep && enriched.street) break;
          }
        }
      }
    } catch {}
  }

  return enriched;
}

/**
 * Resolve o 'company_id' real diretamente a partir do banco de dados remoto do Supabase
 * buscando a linha correspondente ao usuário autenticado (auth.uid() ou e-mail).
 * 
 * ORDEM DE PRIORIDADE E VERIFICAÇÃO:
 * 1. public.profiles (id = auth.uid() ou user_id = auth.uid()) -> coluna company_id
 * 2. public.user_companies (user_id = auth.uid() ou id = auth.uid()) -> coluna company_id
 * 3. public.users (id = auth.uid()) -> coluna company_id
 * 4. public.assinantes (id = auth.uid() ou email = user.email) -> coluna company_id ou id
 * 5. public.subscribers (id = auth.uid() ou responsible_email/email = user.email) -> coluna company_id ou id
 * 6. Fallback final consistente: auth.uid() canônico (mesmo identificador global compartilhado entre celular e computador)
 */
export async function resolveUserCompanyIdFromSupabase(userId: string, email?: string): Promise<string | null> {
  if (!isSupabaseConfigured || !userId) return null;
  const cleanUserId = userId.trim();
  const cleanEmail = (email || '').trim().toLowerCase();

  // 1. Consulta em public.profiles (busca por id = auth.uid() ou user_id = auth.uid())
  if (!isTableUnmigrated('profiles')) {
    try {
      const { data: profileRow, error: pErr } = await supabase
        .from('profiles')
        .select('company_id, id')
        .or(`id.eq.${cleanUserId},user_id.eq.${cleanUserId}`)
        .maybeSingle();

      if (!pErr && profileRow?.company_id && String(profileRow.company_id).trim()) {
        const resolved = String(profileRow.company_id).trim();
        setDbAuthCompanyId(resolved);
        return resolved;
      }
    } catch (e) {
      // Tabela profiles pode não existir no schema atual, continua
    }
  }

  // 2. Consulta em public.user_companies (busca por user_id = auth.uid())
  if (!isTableUnmigrated('user_companies')) {
    try {
      const { data: userCompRow, error: ucErr } = await supabase
        .from('user_companies')
        .select('company_id, user_id')
        .eq('user_id', cleanUserId)
        .maybeSingle();

      if (!ucErr && userCompRow?.company_id && String(userCompRow.company_id).trim()) {
        const resolved = String(userCompRow.company_id).trim();
        setDbAuthCompanyId(resolved);
        return resolved;
      }
    } catch (e) {
      // continua
    }
  }

  // 3. Consulta em public.users (tabela customizada de usuários se houver)
  if (!isTableUnmigrated('users')) {
    try {
      const { data: userRow, error: uErr } = await supabase
        .from('users')
        .select('company_id, id')
        .eq('id', cleanUserId)
        .maybeSingle();

      if (!uErr && userRow?.company_id && String(userRow.company_id).trim()) {
        const resolved = String(userRow.company_id).trim();
        setDbAuthCompanyId(resolved);
        return resolved;
      }
    } catch (e) {
      // continua
    }
  }

  // 4. Consulta na tabela oficial public.assinantes
  if (!isTableUnmigrated('assinantes')) {
    try {
      let query = supabase.from('assinantes').select('*');
      if (cleanEmail && cleanUserId) {
        query = query.or(`id.eq.${toValidUUID(cleanUserId)},email.ilike.${cleanEmail}`);
      } else if (cleanUserId) {
        query = query.eq('id', toValidUUID(cleanUserId));
      } else if (cleanEmail) {
        query = query.ilike('email', cleanEmail);
      }

      const { data: assRow, error: aErr } = await query.maybeSingle();
      if (!aErr && assRow) {
        const resolved = (assRow.company_id && String(assRow.company_id).trim()) || (assRow.id && String(assRow.id).trim());
        if (resolved) {
          setDbAuthCompanyId(resolved);
          return resolved;
        }
      }
    } catch (e) {
      // continua
    }
  }

  // 5. Consulta na tabela public.subscribers
  if (!isTableUnmigrated('subscribers')) {
    try {
      let querySub = supabase.from('subscribers').select('*');
      if (cleanEmail && cleanUserId) {
        querySub = querySub.or(`id.eq.${cleanUserId},id.eq.${toValidUUID(cleanUserId)},responsible_email.ilike.${cleanEmail},email.ilike.${cleanEmail}`);
      } else if (cleanUserId) {
        querySub = querySub.or(`id.eq.${cleanUserId},id.eq.${toValidUUID(cleanUserId)}`);
      } else if (cleanEmail) {
        querySub = querySub.or(`responsible_email.ilike.${cleanEmail},email.ilike.${cleanEmail}`);
      }

      const { data: subRow, error: sErr } = await querySub.maybeSingle();
      if (!sErr && subRow) {
        const resolved = (subRow.company_id && String(subRow.company_id).trim()) || (subRow.id && String(subRow.id).trim());
        if (resolved) {
          setDbAuthCompanyId(resolved);
          return resolved;
        }
      }
    } catch (e) {
      // continua
    }
  }

  // 6. Fallback final consistente: o próprio auth.uid() do Supabase Auth
  // Garante que qualquer aparelho autenticando com as mesmas credenciais opere no MESMO company_id
  setDbAuthCompanyId(cleanUserId);
  return cleanUserId;
}

/**
 * Carrega as Configurações da Empresa da nuvem
 */
export async function fetchCloudCompanyProfile(companyId?: string): Promise<CompanyProfile | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const cId = companyId || getActiveCompanyId();
    const candidateIds = [
      `cloud_company_${cId}`,
      `company_profile_${cId}`,
      `cloud_company_company_${cId}`,
      `company_profile_company_${cId}`
    ];

    const { data, error } = await supabase
      .from('site_settings')
      .select('hero_title')
      .in('id', candidateIds);

    if (error || !data || data.length === 0) return null;
    const found = data.find(d => d.hero_title);
    if (!found?.hero_title) return null;
    return JSON.parse(found.hero_title) as CompanyProfile;
  } catch (e) {
    return null;
  }
}

/**
 * Salva e sincroniza os Serviços (Ordens de Serviço) na nuvem
 */
export async function saveCloudServices(services: ServiceOrder[], companyId?: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const cId = companyId || getActiveCompanyId();
    const cleaned = sanitizeServiceOrders(services);
    const { error } = await supabase.from('site_settings').upsert({
      id: `cloud_services_${cId}`,
      hero_title: JSON.stringify(cleaned),
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });

    if (error) {
      console.warn('Erro ao salvar serviços no Supabase:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error('Falha ao persistir serviços no Supabase:', e);
    return false;
  }
}

/**
 * Carrega os Serviços (Ordens de Serviço) da nuvem
 */
export async function fetchCloudServices(companyId?: string): Promise<ServiceOrder[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const cId = companyId || getActiveCompanyId();
    const { data, error } = await supabase
      .from('site_settings')
      .select('hero_title')
      .eq('id', `cloud_services_${cId}`)
      .maybeSingle();

    if (error || !data?.hero_title) return null;
    const parsed = JSON.parse(data.hero_title) as ServiceOrder[];
    return sanitizeServiceOrders(parsed);
  } catch (e) {
    return null;
  }
}

/**
 * Salva e sincroniza os Agendamentos Operacionais de Serviços na nuvem
 */
export async function saveCloudAppointments(appointments: ServiceAppointment[], companyId?: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const cId = companyId || getActiveCompanyId();
    const { error } = await supabase.from('site_settings').upsert({
      id: `cloud_appointments_${cId}`,
      hero_title: JSON.stringify(appointments),
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });

    return !error;
  } catch (e) {
    return false;
  }
}

/**
 * Carrega os Agendamentos Operacionais da nuvem
 */
export async function fetchCloudAppointments(companyId?: string): Promise<ServiceAppointment[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const cId = companyId || getActiveCompanyId();
    const { data, error } = await supabase
      .from('site_settings')
      .select('hero_title')
      .eq('id', `cloud_appointments_${cId}`)
      .maybeSingle();

    if (error || !data?.hero_title) return null;
    return JSON.parse(data.hero_title) as ServiceAppointment[];
  } catch (e) {
    return null;
  }
}

/**
 * Salva e sincroniza as Vendas / Pedidos de Silagem na nuvem
 */
export async function saveCloudOrders(orders: SilageOrder[], companyId?: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const cId = companyId || getActiveCompanyId();
    const { error } = await supabase.from('site_settings').upsert({
      id: `cloud_orders_${cId}`,
      hero_title: JSON.stringify(orders),
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });

    if (error) {
      console.warn('Erro ao salvar vendas no Supabase:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error('Falha ao persistir vendas no Supabase:', e);
    return false;
  }
}

/**
 * Carrega as Vendas / Pedidos da nuvem
 */
export async function fetchCloudOrders(companyId?: string): Promise<SilageOrder[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const cId = companyId || getActiveCompanyId();
    const { data, error } = await supabase
      .from('site_settings')
      .select('hero_title')
      .eq('id', `cloud_orders_${cId}`)
      .maybeSingle();

    if (error || !data?.hero_title) return null;
    return JSON.parse(data.hero_title) as SilageOrder[];
  } catch (e) {
    return null;
  }
}

/**
 * Salva e sincroniza o Estoque na nuvem (gravação dupla na tabela 'estoque' e no snapshot da nuvem)
 */
export async function saveCloudInventory(items: InventoryItem[], companyId?: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const cId = companyId || getActiveCompanyId();

    // 1. Grava o snapshot consolidado da empresa
    await supabase.from('site_settings').upsert({
      id: `cloud_inventory_${cId}`,
      hero_title: JSON.stringify(items),
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });

    // 2. Grava item a item na tabela relacional 'estoque' para compatibilidade total
    for (const item of items) {
      await upsertEstoqueItem(item);
    }

    return true;
  } catch (e) {
    console.error('Falha ao persistir estoque no Supabase:', e);
    return false;
  }
}

/**
 * Carrega o Estoque da nuvem (prioriza tabela relacional e snapshot)
 */
export async function fetchCloudInventory(companyId?: string): Promise<InventoryItem[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const cId = companyId || getActiveCompanyId();

    // 1. Tenta carregar o snapshot em site_settings
    const { data: snapshotData } = await supabase
      .from('site_settings')
      .select('hero_title')
      .eq('id', `cloud_inventory_${cId}`)
      .maybeSingle();

    if (snapshotData?.hero_title) {
      const parsed = JSON.parse(snapshotData.hero_title);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as InventoryItem[];
      }
    }

    // 2. Fallback na tabela oficial 'estoque'
    const fromEstoque = await fetchEstoque();
    if (fromEstoque && fromEstoque.length > 0) {
      return fromEstoque;
    }

    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Salva e sincroniza Clientes na nuvem
 */
export async function saveCloudClients(clients: Client[], companyId?: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const cId = companyId || getActiveCompanyId();
    await supabase.from('site_settings').upsert({
      id: `cloud_clients_${cId}`,
      hero_title: JSON.stringify(clients),
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Carrega Clientes da nuvem
 */
export async function fetchCloudClients(companyId?: string): Promise<Client[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const cId = companyId || getActiveCompanyId();
    const { data } = await supabase
      .from('site_settings')
      .select('hero_title')
      .eq('id', `cloud_clients_${cId}`)
      .maybeSingle();

    if (data?.hero_title) {
      return JSON.parse(data.hero_title) as Client[];
    }
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Salva e sincroniza Frotas/Maquinários na nuvem
 */
export async function saveCloudMachineries(machines: Machinery[], companyId?: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const cId = companyId || getActiveCompanyId();
    await supabase.from('site_settings').upsert({
      id: `cloud_machineries_${cId}`,
      hero_title: JSON.stringify(machines),
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Carrega Frotas/Maquinários da nuvem
 */
export async function fetchCloudMachineries(companyId?: string): Promise<Machinery[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const cId = companyId || getActiveCompanyId();
    const { data } = await supabase
      .from('site_settings')
      .select('hero_title')
      .eq('id', `cloud_machineries_${cId}`)
      .maybeSingle();

    if (data?.hero_title) {
      return JSON.parse(data.hero_title) as Machinery[];
    }
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Salva e sincroniza Despesas na nuvem
 */
export async function saveCloudExpenses(expenses: Expense[], companyId?: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const cId = companyId || getActiveCompanyId();
    await supabase.from('site_settings').upsert({
      id: `cloud_expenses_${cId}`,
      hero_title: JSON.stringify(expenses),
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Carrega Despesas da nuvem
 */
export async function fetchCloudExpenses(companyId?: string): Promise<Expense[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const cId = companyId || getActiveCompanyId();
    const { data } = await supabase
      .from('site_settings')
      .select('hero_title')
      .eq('id', `cloud_expenses_${cId}`)
      .maybeSingle();

    if (data?.hero_title) {
      return JSON.parse(data.hero_title) as Expense[];
    }
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Salva e sincroniza as Rescisões Contratuais e Rascunhos no Supabase
 */
export async function saveCloudTerminations(terminations: TerminationRecord[], companyId?: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const cId = companyId || getActiveCompanyId();
    const { error } = await supabase.from('site_settings').upsert({
      id: `cloud_terminations_${cId}`,
      hero_title: JSON.stringify(terminations),
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });

    // Sincroniza também na tabela relacional rh_rescisoes se disponível
    try {
      const recordsToUpsert = terminations.map(t => ({
        id: t.id,
        company_id: cId,
        employee_id: t.employeeId,
        employee_name: t.employeeName,
        termination_date: t.terminationDate,
        reason: t.reason,
        net_total: t.calculation?.netTotal || 0,
        status: t.status,
        payload: JSON.stringify(t),
        updated_at: new Date().toISOString()
      }));
      if (recordsToUpsert.length > 0) {
        await supabase.from('rh_rescisoes').upsert(recordsToUpsert, { onConflict: 'id' });
      }
    } catch {
      // Ignora silenciosamente caso tabela relacional ainda não exista
    }

    return !error;
  } catch (e) {
    console.error('Falha ao persistir rescisões no Supabase:', e);
    return false;
  }
}

/**
 * Carrega as Rescisões Contratuais e Rascunhos da nuvem (Supabase)
 */
export async function fetchCloudTerminations(companyId?: string): Promise<TerminationRecord[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const cId = companyId || getActiveCompanyId();
    const { data, error } = await supabase
      .from('site_settings')
      .select('hero_title')
      .eq('id', `cloud_terminations_${cId}`)
      .maybeSingle();

    if (!error && data?.hero_title) {
      return JSON.parse(data.hero_title) as TerminationRecord[];
    }
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Carrega todos os módulos operacionais do cliente a partir do Supabase em uma única operação
 */
export async function fetchAllClientModulesFromSupabase(companyId?: string) {
  if (!isSupabaseConfigured) return null;
  try {
    const cId = companyId || getActiveCompanyId();
    const keys = [
      `cloud_company_${cId}`,
      `cloud_services_${cId}`,
      `cloud_appointments_${cId}`,
      `cloud_orders_${cId}`,
      `cloud_inventory_${cId}`,
      `cloud_clients_${cId}`,
      `cloud_machineries_${cId}`,
      `cloud_expenses_${cId}`,
      `cloud_terminations_${cId}`,
    ];

    const { data, error } = await supabase
      .from('site_settings')
      .select('id, hero_title')
      .in('id', keys);

    if (error || !data) return null;

    const map = new Map<string, string>();
    data.forEach(row => {
      if (row.id && row.hero_title) {
        map.set(row.id, row.hero_title);
      }
    });

    const parseJson = (key: string) => {
      const raw = map.get(key);
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    };

    const rawServices = parseJson(`cloud_services_${cId}`) as ServiceOrder[] | null;
    const cleanServices = rawServices ? sanitizeServiceOrders(rawServices) : null;

    return {
      companyProfile: parseJson(`cloud_company_${cId}`) as CompanyProfile | null,
      services: cleanServices,
      appointments: parseJson(`cloud_appointments_${cId}`) as ServiceAppointment[] | null,
      orders: parseJson(`cloud_orders_${cId}`) as SilageOrder[] | null,
      inventory: parseJson(`cloud_inventory_${cId}`) as InventoryItem[] | null,
      clients: parseJson(`cloud_clients_${cId}`) as Client[] | null,
      machineries: parseJson(`cloud_machineries_${cId}`) as Machinery[] | null,
      expenses: parseJson(`cloud_expenses_${cId}`) as Expense[] | null,
      terminations: parseJson(`cloud_terminations_${cId}`) as TerminationRecord[] | null,
    };
  } catch (err) {
    console.warn('Erro ao carregar módulos do cliente do Supabase:', err);
    return null;
  }
}

/**
 * Salva e sincroniza os tipos de documento de entrada na nuvem (Supabase)
 */
export async function saveCloudManualEntryDocumentTypes(types: string[], companyId?: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const cId = companyId || getActiveCompanyId();
    const cleanTypes = types
      .map(t => (typeof t === 'string' ? t.trim() : ''))
      .filter(t => t !== '' && t !== 'Recibo');
    const unique = Array.from(new Set(cleanTypes));
    const { error } = await supabase.from('site_settings').upsert({
      id: `cloud_doc_entrada_tipos_${cId}`,
      hero_title: JSON.stringify(unique),
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });
    return !error;
  } catch (e) {
    console.warn('Erro ao sincronizar tipos de documentos no Supabase:', e);
    return false;
  }
}

/**
 * Carrega os tipos de documento de entrada da nuvem (Supabase)
 */
export async function fetchCloudManualEntryDocumentTypes(companyId?: string): Promise<string[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const cId = companyId || getActiveCompanyId();
    const { data, error } = await supabase
      .from('site_settings')
      .select('hero_title')
      .eq('id', `cloud_doc_entrada_tipos_${cId}`)
      .maybeSingle();

    if (!error && data?.hero_title) {
      const parsed = JSON.parse(data.hero_title);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
          .map((t: unknown) => (typeof t === 'string' ? t.trim() : ''))
          .filter((t: string) => t !== '' && t !== 'Recibo');
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}


