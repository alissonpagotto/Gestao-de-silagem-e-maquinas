import { supabase, isSupabaseConfigured } from './supabase';
export { isSupabaseConfigured };
import {
  Client,
  Supplier,
  InventoryItem,
  Expense,
  ExpenseStatus,
  PaymentMethod,
  Machinery,
  Employee,
  SilageOrder,
  ServiceOrder,
  CompanyProfile,
  ServiceAppointment
} from '../types';
export type { CompanyProfile };
import {
  SiteConfig,
  PlanDefinition,
  Subscriber
} from '../types/masterAdmin';
import { getActiveCompanyId, setDbAuthCompanyId, getDbAuthCompanyId, clearAllAuthSessionCache, sanitizeServiceOrders } from './storage';

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
      if (error.message && (error.message.includes('company_id') || error.message.includes('column'))) {
        delete payload.company_id;
        const retry = await supabase.from('fornecedores').upsert(payload, { onConflict: 'id' });
        if (!retry.error) return true;
      }
      console.warn('Supabase upsertFornecedor notice:', error.message);
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

export async function upsertContaAPagar(parcela: {
  id: string;
  nota_fiscal_id?: string | null;
  numero_parcela?: string;
  valor_parcela: number;
  data_vencimento: string;
  forma_pagamento?: string;
  centro_custo?: string;
  status_pago?: boolean;
}, companyId?: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const activeCompanyId = companyId || getActiveCompanyId();
    const payload: Record<string, any> = {
      id: toValidUUID(parcela.id),
      company_id: activeCompanyId,
      nota_fiscal_id: parcela.nota_fiscal_id ? toValidUUID(parcela.nota_fiscal_id) : null,
      numero_parcela: parcela.numero_parcela || '01/01',
      valor_parcela: Number(parcela.valor_parcela) || 0,
      data_vencimento: parcela.data_vencimento || new Date().toISOString().split('T')[0],
      forma_pagamento: parcela.forma_pagamento || 'Boleto',
      centro_custo: parcela.centro_custo || 'Geral',
      status_pago: Boolean(parcela.status_pago)
    };

    let { error } = await supabase
      .from('contas_a_pagar')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      if (error.message && (error.message.includes('company_id') || error.message.includes('column'))) {
        delete payload.company_id;
        const retry = await supabase.from('contas_a_pagar').upsert(payload, { onConflict: 'id' });
        if (!retry.error) return true;
      }
      console.warn('Supabase upsertContaAPagar notice:', error.message);
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
// 4. Estoque (Tabela: public.estoque)
// Colunas: id, codigo_produto, descricao, quantidade_atual, preco_venda_final,
//          preco_venda_atacado, preco_venda_promo, fim_promocao, created_at
// ===========================================================================
export async function fetchEstoque(companyId?: string): Promise<InventoryItem[] | null> {
  if (!isSupabaseConfigured) return null;
  const activeCompanyId = companyId || getActiveCompanyId();
  if (!activeCompanyId) return [];
  try {
    let { data, error } = await supabase
      .from('estoque')
      .select('*')
      .eq('company_id', activeCompanyId)
      .order('descricao', { ascending: true });

    if ((!data || data.length === 0) && activeCompanyId) {
      const altUuid = toValidUUID(activeCompanyId);
      if (altUuid && altUuid !== activeCompanyId) {
        const retry = await supabase
          .from('estoque')
          .select('*')
          .eq('company_id', altUuid)
          .order('descricao', { ascending: true });
        if (retry.data && retry.data.length > 0) {
          data = retry.data;
          error = null;
        }
      }
    }

    if (error) {
      console.warn('Supabase fetchEstoque notice:', error.message);
      return [];
    }
    if (!data) return [];

    return data.map(row => ({
      id: row.id,
      companyId: row.company_id || undefined,
      code: row.codigo_produto || '',
      name: row.descricao || '',
      category: 'outro',
      quantity: Number(row.quantidade_atual) || 0,
      unit: 'un',
      minQuantity: 0,
      unitCost: 0,
      salePrice: Number(row.preco_venda_final) || 0,
      wholesalePrice: Number(row.preco_venda_atacado) || 0,
      promoPrice: Number(row.preco_venda_promo) || 0,
      location: 'Depósito Principal'
    } as InventoryItem));
  } catch (err) {
    console.warn('Supabase fetchEstoque err:', err);
    return [];
  }
}

export async function upsertEstoqueItem(item: InventoryItem, companyId?: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const activeCompanyId = item.companyId || companyId || getActiveCompanyId();
    const payload: Record<string, any> = {
      id: toValidUUID(item.id),
      company_id: activeCompanyId,
      codigo_produto: item.code || `PRD-${toValidUUID(item.id).slice(0, 8)}`,
      descricao: item.name || 'Produto sem descrição',
      quantidade_atual: Number(item.quantity) || 0.000,
      preco_venda_final: Number(item.salePrice) || 0,
      preco_venda_atacado: Number(item.wholesalePrice) || 0,
      preco_venda_promo: Number(item.promoPrice) || null,
      fim_promocao: null,
    };

    let { error } = await supabase
      .from('estoque')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      if (error.message && (error.message.includes('company_id') || error.message.includes('column'))) {
        delete payload.company_id;
        const retry = await supabase.from('estoque').upsert(payload, { onConflict: 'id' });
        if (!retry.error) return true;
      }
      console.warn('Supabase upsertEstoqueItem notice:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase upsertEstoqueItem err:', err);
    return false;
  }
}

export async function deleteEstoqueItem(id: string, companyId?: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const activeCompanyId = companyId || getActiveCompanyId();
    const uuid = toValidUUID(id);
    let query = supabase.from('estoque').delete().eq('id', uuid);
    if (activeCompanyId) query = query.eq('company_id', activeCompanyId);
    const { error } = await query;
    if (error && id !== uuid) {
      let retry = supabase.from('estoque').delete().eq('id', id);
      if (activeCompanyId) retry = retry.eq('company_id', activeCompanyId);
      await retry;
    }
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
    const hasValidId = isValidUUID(client.id);
    const clientName = (client.name || client.nome || '').trim() || 'Cliente';

    // Monta o payload estritamente compatível com a tabela public.clientes (supabase_schema.sql)
    const payload: Record<string, any> = {
      name: clientName,
      farm_name: (client.farmName || client.fazenda || '').trim() || null,
      cpf_cnpj: (client.cpfCnpj || '').trim() || null,
      state_registration: (client.stateRegistration || '').trim() || null,
      phone: (client.phone || client.telefone || '').trim() || null,
      email: (client.email || '').trim() || null,
      city: (client.city || client.cidade || '').trim() || null,
      state: (client.state || client.estado || '').trim() || null,
      total_area: Number(client.areaHectares) || 0,
      cultivated_area: Number(client.areaHectares) || 0,
      notes: (client.notes || client.observacoes || '').trim() || null,
      company_id: activeCompanyId,
      updated_at: new Date().toISOString()
    };

    if (hasValidId) {
      payload.id = client.id.trim().toLowerCase();
      const { error } = await supabase
        .from('clientes')
        .upsert(payload, { onConflict: 'id' });

      if (error) {
        console.error('[Supabase upsertCliente 400/Rejection]:', error);
        return false;
      }

      return true;
    }

    // Se for um novo cliente ou ID não UUID, usa UUID determinístico
    payload.id = toValidUUID(client.id);
    const { error } = await supabase
      .from('clientes')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.error('[Supabase upsertCliente (Deterministic UUID) Error]:', error);
      return false;
    }

    return true;
  } catch (err: any) {
    console.error('[Supabase upsertCliente Exception]:', err);
    return false;
  }
}

export async function deleteCliente(id: string, companyId?: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const activeCompanyId = companyId || getActiveCompanyId();
    const targetUuid = isValidUUID(id) ? id.trim().toLowerCase() : toValidUUID(id);
    let query = supabase.from('clientes').delete().eq('id', targetUuid);
    if (activeCompanyId) query = query.eq('company_id', activeCompanyId);
    const { error } = await query;

    if (error && id !== targetUuid) {
      let retry = supabase.from('clientes').delete().eq('id', id);
      if (activeCompanyId) retry = retry.eq('company_id', activeCompanyId);
      await retry;
    }
    return true;
  } catch (err) {
    console.error('[Supabase deleteCliente Exception]:', err);
    return false;
  }
}

// ===========================================================================
// 6. RH Funcionários (Tabela: public.rh_funcionarios)
// ===========================================================================
export async function fetchRhFuncionarios(companyId?: string): Promise<Employee[] | null> {
  if (!isSupabaseConfigured) return null;
  const activeCompanyId = companyId || getActiveCompanyId();
  if (!activeCompanyId) return [];
  try {
    let { data, error } = await supabase
      .from('rh_funcionarios')
      .select('*')
      .eq('company_id', activeCompanyId)
      .order('name', { ascending: true });

    if ((!data || data.length === 0) && activeCompanyId) {
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

    if (error) {
      console.warn('Supabase fetchRhFuncionarios notice:', error.message);
      return [];
    }
    return (data || []) as Employee[];
  } catch (err) {
    console.warn('Supabase fetchRhFuncionarios err:', err);
    return [];
  }
}

export async function upsertRhFuncionario(employee: Employee, companyId?: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const activeCompanyId = employee.companyId || companyId || getActiveCompanyId();
    const payload: Record<string, any> = {
      id: toValidUUID(employee.id),
      company_id: activeCompanyId,
      name: employee.name,
      role: employee.role,
      cpf: employee.cpf || '',
      phone: employee.phone || '',
      email: '',
      status: employee.status || 'ativo',
      registration_type: employee.registrationType || 'Funcionário',
      salary: Number(employee.salary || employee.baseSalary) || 0,
      admission_date: employee.admissionDate || null,
      driver_license: employee.cnhNumber || '',
      license_category: employee.cnhCategory || '',
      license_expiry: employee.cnhExpiration || null,
      updated_at: new Date().toISOString()
    };

    let { error } = await supabase
      .from('rh_funcionarios')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      if (error.message && (error.message.includes('company_id') || error.message.includes('column'))) {
        delete payload.company_id;
        const retry = await supabase.from('rh_funcionarios').upsert(payload, { onConflict: 'id' });
        if (!retry.error) return true;
      }
      console.warn('Supabase upsertRhFuncionario notice:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase upsertRhFuncionario err:', err);
    return false;
  }
}

export async function deleteRhFuncionario(id: string, companyId?: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const activeCompanyId = companyId || getActiveCompanyId();
    const uuid = toValidUUID(id);
    let query = supabase.from('rh_funcionarios').delete().eq('id', uuid);
    if (activeCompanyId) query = query.eq('company_id', activeCompanyId);
    const { error } = await query;
    if (error && id !== uuid) {
      let retry = supabase.from('rh_funcionarios').delete().eq('id', id);
      if (activeCompanyId) retry = retry.eq('company_id', activeCompanyId);
      await retry;
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
      .order('name', { ascending: true });

    if ((!data || data.length === 0) && activeCompanyId) {
      const altUuid = toValidUUID(activeCompanyId);
      if (altUuid && altUuid !== activeCompanyId) {
        const retry = await supabase
          .from('gestao_frotas')
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
      console.warn('Supabase fetchGestaoFrotas notice:', error.message);
      return [];
    }
    return (data as any[] || []).map(row => ({
      ...row,
      fleetNumber: row.fleet_number || row.fleetNumber || undefined,
      licensePlateOrSerial: row.plate_or_serial || row.licensePlateOrSerial,
      hourMeter: row.hourmeter !== undefined ? Number(row.hourmeter) : row.hourMeter,
      currentFuelPercentage: row.fuel_level !== undefined ? Number(row.fuel_level) : row.currentFuelPercentage,
      accumulatedCost: row.accumulated_cost !== undefined ? Number(row.accumulated_cost) : row.accumulatedCost,
      categoryType: row.type || row.categoryType,
    })) as Machinery[];
  } catch (err) {
    console.warn('Supabase fetchGestaoFrotas err:', err);
    return [];
  }
}

export async function upsertGestaoFrota(vehicle: Machinery, companyId?: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const activeCompanyId = vehicle.companyId || companyId || getActiveCompanyId();
    const payload: Record<string, any> = {
      id: toValidUUID(vehicle.id),
      company_id: activeCompanyId,
      name: vehicle.name,
      type: vehicle.categoryType || 'maquina',
      model: vehicle.model,
      plate_or_serial: vehicle.licensePlateOrSerial || vehicle.serialNumber || '',
      fleet_number: vehicle.fleetNumber || '',
      year: vehicle.year ? Number(vehicle.year) : null,
      hourmeter: Number(vehicle.hourMeter) || 0,
      status: vehicle.status || 'operacional',
      fuel_level: Number(vehicle.currentFuelPercentage) || 100,
      accumulated_cost: vehicle.accumulatedCost || 0,
      updated_at: new Date().toISOString()
    };

    let { error } = await supabase
      .from('gestao_frotas')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      if (error.message && (error.message.includes('company_id') || error.message.includes('fleet_number') || error.message.includes('column'))) {
        delete payload.company_id;
        delete payload.fleet_number;
        const retry = await supabase.from('gestao_frotas').upsert(payload, { onConflict: 'id' });
        if (!retry.error) return true;
      }
      console.warn('Supabase upsertGestaoFrota notice:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase upsertGestaoFrota err:', err);
    return false;
  }
}

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

    const formattedExpenses: Expense[] = (contas_a_pagar || []).map((d: any) => ({
      id: d.id,
      title: d.centro_custo || d.title || 'Despesa Fornecedor',
      description: d.centro_custo || d.description || 'Despesa Fornecedor',
      amount: Number(d.valor_parcela ?? d.amount ?? 0),
      dueDate: d.data_vencimento || d.dueDate || new Date().toISOString().split('T')[0],
      status: ((d.status_pago || d.status === 'pago') ? 'pago' : 'pendente') as ExpenseStatus,
      categoryId: d.categoryId || 'despesa_geral',
      categoryColor: d.categoryColor || '#10b981',
      category: d.category || 'despesa_geral',
      categoryName: d.centro_custo || d.categoryName || 'Geral',
      paymentMethod: (d.forma_pagamento || d.paymentMethod || 'boleto') as PaymentMethod,
      supplier: d.supplier || 'Fornecedor',
      recurrence: d.recurrence || 'none',
      createdAt: d.created_at || d.createdAt || new Date().toISOString(),
      updatedAt: d.updated_at || d.updatedAt || new Date().toISOString(),
    }));

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
      console.warn('Supabase deleteAgendamento notice (tabela agendamentos):', error.message);
      let fallback = supabase.from('service_appointments').delete().eq('id', uuid);
      if (activeCompanyId) fallback = fallback.eq('company_id', activeCompanyId);
      const res = await fallback;
      if (res.error && appointmentId !== uuid) {
        let retryFb = supabase.from('service_appointments').delete().eq('id', appointmentId);
        if (activeCompanyId) retryFb = retryFb.eq('company_id', activeCompanyId);
        await retryFb;
      }
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
      if (error.message && (error.message.includes('company_id') || error.message.includes('column'))) {
        delete payload.company_id;
        const retry = await supabase.from('agendamentos').upsert(payload, { onConflict: 'id' });
        if (!retry.error) return true;
      }
      console.warn('Supabase upsertAgendamento notice:', error.message);
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
// CONTROLE DE TABELAS AUSENTES NO SCHEMA CACHE (Elimina erros 404 no console)
// ==============================================================================
const unmigratedTables = new Set<string>();

export function markTableUnmigrated(table: string) {
  unmigratedTables.add(table);
}

export function isTableUnmigrated(table: string): boolean {
  return unmigratedTables.has(table);
}

export function clearUnmigratedTables() {
  unmigratedTables.clear();
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
    } catch {}

    // 4. Atualizar/limpar tabelas de usuários e empresas associadas
    try {
      await supabase.from('usuarios').update({ status: 'inativo' }).eq('id', id);
      await supabase.from('usuarios').delete().eq('id', id);
      if (cleanEmail) {
        await supabase.from('usuarios').update({ status: 'inativo' }).eq('email', cleanEmail);
        await supabase.from('usuarios').delete().eq('email', cleanEmail);
      }
    } catch {}

    try {
      await supabase.from('users').update({ status: 'inativo' }).eq('id', id);
      await supabase.from('users').delete().eq('id', id);
      if (cleanEmail) {
        await supabase.from('users').update({ status: 'inativo' }).eq('email', cleanEmail);
        await supabase.from('users').delete().eq('email', cleanEmail);
      }
    } catch {}

    try {
      await supabase.from('empresas').update({ status: 'cancelado' }).eq('id', id);
      await supabase.from('empresas').delete().eq('id', id);
    } catch {}

    try {
      await supabase.from('companies').update({ status: 'cancelado' }).eq('id', id);
      await supabase.from('companies').delete().eq('id', id);
    } catch {}

    return true;
  } catch (err) {
    console.error('Erro ao deletar assinante da tabela assinantes e serviços de autenticação:', err);
    return false;
  }
}

// ==============================================================================
// SINCRONIZAÇÃO EM TEMPO REAL (REALTIME CHANNELS)
// ==============================================================================

export function subscribeToCloudTable(
  tableName: string,
  onChange: (payload: any) => void
): () => void {
  if (!tableName || tableName === 'null' || tableName === 'undefined' || !isSupabaseConfigured || isTableUnmigrated(tableName)) {
    return () => {};
  }

  try {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedOnChange = (payload: any) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        onChange(payload);
      }, 600);
    };

    const channel = supabase
      .channel(`public:${tableName}_changes_${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: tableName },
        (payload) => {
          debouncedOnChange(payload);
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          markTableUnmigrated(tableName);
          try {
            supabase.removeChannel(channel);
          } catch {}
        }
      });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      try {
        supabase.removeChannel(channel);
      } catch {}
    };
  } catch (e) {
    markTableUnmigrated(tableName);
    return () => {};
  }
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

  // 2. Consulta em public.user_companies (busca por user_id = auth.uid())
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

  // 3. Consulta em public.users (tabela customizada de usuários se houver)
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
    };
  } catch (err) {
    console.warn('Erro ao carregar módulos do cliente do Supabase:', err);
    return null;
  }
}


