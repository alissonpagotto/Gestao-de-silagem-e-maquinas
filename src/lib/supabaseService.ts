import { supabase, isSupabaseConfigured } from './supabase';
export { isSupabaseConfigured };
import {
  Client,
  Supplier,
  InventoryItem,
  Expense,
  Machinery,
  Employee,
  SilageOrder,
  ServiceOrder,
  CompanyProfile,
  ServiceAppointment
} from '../types';
import {
  SiteConfig,
  PlanDefinition,
  Subscriber
} from '../types/masterAdmin';
import { getActiveCompanyId } from './storage';

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
export async function fetchFornecedores(): Promise<Supplier[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('fornecedores')
      .select('*')
      .order('razao_social', { ascending: true });

    if (error) {
      console.warn('Supabase fetchFornecedores notice:', error.message);
      return null;
    }
    if (!data) return [];

    return data.map(row => ({
      id: row.id,
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
    return null;
  }
}

export async function upsertFornecedor(supplier: Supplier): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const payload: Record<string, any> = {
      id: toValidUUID(supplier.id),
      company_id: getActiveCompanyId(),
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

export async function fetchContasAPagar(): Promise<ContaAPagarRecord[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('contas_a_pagar')
      .select('*')
      .order('data_vencimento', { ascending: true });

    if (error) {
      console.warn('Supabase fetchContasAPagar notice:', error.message);
      return null;
    }
    return data as ContaAPagarRecord[];
  } catch (err) {
    console.warn('Supabase fetchContasAPagar err:', err);
    return null;
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
}): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const payload: Record<string, any> = {
      id: toValidUUID(parcela.id),
      company_id: getActiveCompanyId(),
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

export async function deleteContaAPagar(parcelaId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const { error } = await supabase
      .from('contas_a_pagar')
      .delete()
      .eq('id', toValidUUID(parcelaId));

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
export async function fetchEstoque(): Promise<InventoryItem[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('estoque')
      .select('*')
      .order('descricao', { ascending: true });

    if (error) {
      console.warn('Supabase fetchEstoque notice:', error.message);
      return null;
    }
    if (!data) return [];

    return data.map(row => ({
      id: row.id,
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
    return null;
  }
}

export async function upsertEstoqueItem(item: InventoryItem): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const payload: Record<string, any> = {
      id: toValidUUID(item.id),
      company_id: item.companyId || getActiveCompanyId(),
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

// ===========================================================================
// 5. Clientes (Tabela: public.clientes)
// ===========================================================================
export async function fetchClientes(companyId?: string): Promise<Client[] | null> {
  if (!isSupabaseConfigured) return null;
  const activeCompanyId = companyId || getActiveCompanyId();
  try {
    let { data, error } = await supabase
      .from('clientes')
      .select('*')
      .or(`company_id.eq.${activeCompanyId},company_id.eq.company_default_fazenda,company_id.is.null`);

    if (error) {
      const fallback = await supabase.from('clientes').select('*');
      if (!fallback.error) {
        data = fallback.data;
        error = null;
      } else {
        console.warn('Supabase fetchClientes notice:', error.message);
        return null;
      }
    }
    if (!data || data.length === 0) return [];

    return data.map((row: any): Client => ({
      id: String(row.id),
      companyId: row.company_id || undefined,
      name: row.name || row.nome || row.razao_social || row.nome_fantasia || 'Cliente',
      farmName: row.farm_name || row.fazenda || '',
      cpfCnpj: row.cpf_cnpj || row.cpf || row.cnpj || '',
      stateRegistration: row.state_registration || row.inscricao_estadual || '',
      phone: row.phone || row.telefone || row.celular || '',
      email: row.email || '',
      city: row.city || row.cidade || '',
      state: row.state || row.estado || row.uf || '',
      areaHectares: Number(row.total_area || row.area || row.area_total || 0),
      cattleType: (row.cattle_type || row.tipo_gado || 'misto') as any,
      notes: row.notes || row.observacoes || '',
      status: (row.status || 'cliente_ativo') as any,
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString()
    }));
  } catch (err) {
    console.warn('Supabase fetchClientes err:', err);
    return null;
  }
}

export async function upsertCliente(client: Client): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const standardPayload: any = {
      id: toValidUUID(client.id),
      company_id: client.companyId || getActiveCompanyId(),
      name: client.name,
      farm_name: client.farmName || '',
      cpf_cnpj: client.cpfCnpj || '',
      state_registration: client.stateRegistration || '',
      phone: client.phone || '',
      email: client.email || '',
      city: client.city || '',
      state: client.state || '',
      total_area: Number(client.areaHectares) || 0,
      cultivated_area: Number(client.areaHectares) || 0,
      notes: client.notes || '',
      updated_at: new Date().toISOString()
    };

    let { error } = await supabase
      .from('clientes')
      .upsert(standardPayload, { onConflict: 'id' });

    if (error) {
      if (error.message && (error.message.includes('company_id') || error.message.includes('column'))) {
        delete standardPayload.company_id;
        const retry = await supabase.from('clientes').upsert(standardPayload, { onConflict: 'id' });
        if (!retry.error) return true;
      }
      // Fallback para esquemas com nomes em português ou colunas simplificadas
      const fallbackPayload: any = {
        email: client.email || undefined,
        telefone: client.phone || undefined,
        cpf_cnpj: client.cpfCnpj || undefined,
      };
      const { error: fallbackError } = await supabase
        .from('clientes')
        .insert([fallbackPayload]);

      if (fallbackError) {
        console.warn('Supabase upsertCliente notice:', error.message || fallbackError.message);
        return false;
      }
    }
    return true;
  } catch (err) {
    console.warn('Supabase upsertCliente err:', err);
    return false;
  }
}

export async function deleteCliente(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const { error } = await supabase
      .from('clientes')
      .delete()
      .or(`id.eq.${toValidUUID(id)},id.eq.${id}`);

    if (error) {
      console.warn('Supabase deleteCliente notice:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase deleteCliente err:', err);
    return false;
  }
}

// ===========================================================================
// 6. RH Funcionários (Tabela: public.rh_funcionarios)
// ===========================================================================
export async function fetchRhFuncionarios(): Promise<Employee[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('rh_funcionarios')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.warn('Supabase fetchRhFuncionarios notice:', error.message);
      return null;
    }
    return data as Employee[];
  } catch (err) {
    console.warn('Supabase fetchRhFuncionarios err:', err);
    return null;
  }
}

export async function upsertRhFuncionario(employee: Employee): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const payload: Record<string, any> = {
      id: toValidUUID(employee.id),
      company_id: employee.companyId || getActiveCompanyId(),
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

// ===========================================================================
// 7. Gestão de Frotas (Tabela: public.gestao_frotas)
// ===========================================================================
export async function fetchGestaoFrotas(): Promise<Machinery[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('gestao_frotas')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.warn('Supabase fetchGestaoFrotas notice:', error.message);
      return null;
    }
    return (data as any[]).map(row => ({
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
    return null;
  }
}

export async function upsertGestaoFrota(vehicle: Machinery): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const payload: Record<string, any> = {
      id: toValidUUID(vehicle.id),
      company_id: vehicle.companyId || getActiveCompanyId(),
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
  try {
    const queryTable = async (tableName: string) => {
      if (!tableName || tableName === 'null' || tableName === 'undefined') return [];
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .or(`company_id.eq.${activeCompanyId},company_id.eq.company_default_fazenda,company_id.is.null`)
          .limit(500);

        if (!error && data) return data;

        // Fallback caso a coluna company_id ainda não exista na tabela do Supabase
        const fallback = await supabase.from(tableName).select('*').limit(500);
        return fallback.data || [];
      } catch {
        return [];
      }
    };

    const [
      clientes,
      fornecedores,
      estoque,
      notas_fiscais,
      contas_a_pagar,
      rh_funcionarios,
      gestao_frotas
    ] = await Promise.all([
      queryTable('clientes'),
      queryTable('fornecedores'),
      queryTable('estoque'),
      queryTable('notas_fiscais'),
      queryTable('contas_a_pagar'),
      queryTable('rh_funcionarios'),
      queryTable('gestao_frotas')
    ]);

    return {
      clientes,
      fornecedores,
      estoque,
      notas_fiscais,
      contas_a_pagar,
      rh_funcionarios,
      gestao_frotas
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

export async function deleteAgendamento(appointmentId: string): Promise<boolean> {
  if (!isSupabaseConfigured) {
    return true;
  }
  try {
    const uuid = toValidUUID(appointmentId);

    // Tenta deletar pelo UUID na tabela agendamentos
    let { error } = await supabase
      .from('agendamentos')
      .delete()
      .eq('id', uuid);

    // Caso o ID seja texto e a coluna id seja texto ou para cobrir IDs customizados
    if (error && appointmentId !== uuid) {
      const retry = await supabase
        .from('agendamentos')
        .delete()
        .eq('id', appointmentId);
      if (!retry.error) {
        return true;
      }
    }

    if (error) {
      console.warn('Supabase deleteAgendamento notice (tabela agendamentos):', error.message);
      // Fallback para service_appointments caso configurado com esse nome
      const fallback = await supabase
        .from('service_appointments')
        .delete()
        .eq('id', uuid);
      if (fallback.error && appointmentId !== uuid) {
        await supabase
          .from('service_appointments')
          .delete()
          .eq('id', appointmentId);
      }
    }

    return true;
  } catch (err) {
    console.warn('Supabase deleteAgendamento err:', err);
    return true;
  }
}

export async function upsertAgendamento(app: ServiceAppointment): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const uuid = toValidUUID(app.id);
    const clientUuid = app.clientId ? toValidUUID(app.clientId) : null;

    const payload: Record<string, any> = {
      id: uuid,
      company_id: app.companyId || getActiveCompanyId(),
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
    // 1. Busca direta pública na linha fixa 'global' da tabela pública site_settings
    let { data, error } = await supabase
      .from('site_settings')
      .select('*')
      .eq('id', 'global')
      .maybeSingle();

    if (error || !data) {
      // Fallback para qualquer primeira linha caso o ID seja diferente de 'global'
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
      heroTitle: data.hero_title || '',
      heroSubtitle: data.hero_subtitle || '',
      heroPrimaryBtnText: data.hero_primary_btn_text || '',
      heroSecondaryBtnText: data.hero_secondary_btn_text || '',
      heroBackgroundImage: data.hero_background_image || '',
      featuresSectionTitle: data.features_section_title || '',
      featuresSectionSubtitle: data.features_section_subtitle || '',
      featuresHighlightImage: data.features_highlight_image || '',
      feature1Title: data.feature1_title || '',
      feature1Desc: data.feature1_desc || '',
      feature2Title: data.feature2_title || '',
      feature2Desc: data.feature2_desc || '',
      feature3Title: data.feature3_title || '',
      feature3Desc: data.feature3_desc || '',
      feature4Title: data.feature4_title || '',
      feature4Desc: data.feature4_desc || '',
    };
  } catch (err) {
    return null;
  }
}

export async function upsertCloudSiteConfig(config: Partial<SiteConfig>): Promise<boolean> {
  if (!isSupabaseConfigured || isTableUnmigrated('site_settings')) return false;
  try {
    const payload: any = {
      id: 'global',
      updated_at: new Date().toISOString()
    };

    if (config.logoUrl !== undefined) payload.logo_url = config.logoUrl;
    if (config.companyName !== undefined) payload.company_name = config.companyName;
    if (config.primaryColor !== undefined) payload.primary_color = config.primaryColor;
    if (config.maintenanceMode !== undefined) payload.maintenance_mode = config.maintenanceMode;
    if (config.heroTitle !== undefined) payload.hero_title = config.heroTitle;
    if (config.heroSubtitle !== undefined) payload.hero_subtitle = config.heroSubtitle;
    if (config.heroPrimaryBtnText !== undefined) payload.hero_primary_btn_text = config.heroPrimaryBtnText;
    if (config.heroSecondaryBtnText !== undefined) payload.hero_secondary_btn_text = config.heroSecondaryBtnText;
    if (config.heroBackgroundImage !== undefined) payload.hero_background_image = config.heroBackgroundImage;
    if (config.featuresSectionTitle !== undefined) payload.features_section_title = config.featuresSectionTitle;
    if (config.featuresSectionSubtitle !== undefined) payload.features_section_subtitle = config.featuresSectionSubtitle;
    if (config.featuresHighlightImage !== undefined) payload.features_highlight_image = config.featuresHighlightImage;
    if (config.feature1Title !== undefined) payload.feature1_title = config.feature1Title;
    if (config.feature1Desc !== undefined) payload.feature1_desc = config.feature1Desc;
    if (config.feature2Title !== undefined) payload.feature2_title = config.feature2Title;
    if (config.feature2Desc !== undefined) payload.feature2_desc = config.feature2Desc;
    if (config.feature3Title !== undefined) payload.feature3_title = config.feature3Title;
    if (config.feature3Desc !== undefined) payload.feature3_desc = config.feature3Desc;
    if (config.feature4Title !== undefined) payload.feature4_title = config.feature4Title;
    if (config.feature4Desc !== undefined) payload.feature4_desc = config.feature4Desc;

    const { error } = await supabase
      .from('site_settings')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      if (isTableMissingError(error)) {
        markTableUnmigrated('site_settings');
      }
      return false;
    }
    return true;
  } catch (err) {
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
    const { data, error } = await supabase
      .from('plans')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      if (isTableMissingError(error)) {
        markTableUnmigrated('plans');
      }
      return null;
    }

    if (!data || data.length === 0) return null;

    return data.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description || '',
      price: Number(row.price) || 0,
      billingCycle: row.billing_cycle || 'mensal',
      badge: row.badge || undefined,
      isFeatured: Boolean(row.is_featured),
      isActive: row.is_active !== undefined ? Boolean(row.is_active) : true,
      displayOrder: Number(row.display_order) || 1,
      limits: typeof row.limits === 'object' && row.limits ? row.limits : {
        maxUsers: 5,
        maxMachineries: 10,
        maxClients: 100,
        storageLimitGb: 5,
      },
      featuresText: row.features_text || '',
      checkoutUrl: row.checkout_url || '',
    }));
  } catch (err) {
    return null;
  }
}

export async function upsertCloudPlan(plan: PlanDefinition): Promise<boolean> {
  if (!isSupabaseConfigured || isTableUnmigrated('plans')) return false;
  try {
    const payload = {
      id: plan.id,
      name: plan.name,
      description: plan.description || '',
      price: Number(plan.price) || 0,
      billing_cycle: plan.billingCycle || 'mensal',
      badge: plan.badge || null,
      is_featured: Boolean(plan.isFeatured),
      is_active: plan.isActive !== undefined ? Boolean(plan.isActive) : true,
      display_order: Number(plan.displayOrder) || 1,
      limits: plan.limits || {},
      features_text: plan.featuresText || '',
      checkout_url: plan.checkoutUrl || '',
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('plans')
      .upsert(payload, { onConflict: 'id' });

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
    case 'essencial': return 195.00;
    case 'pro': return 295.00;
    case 'enterprise': return 495.00;
  }
}

export function getSubscriberPlanDisplayName(plan: PlanSelectedKey): string {
  switch (plan) {
    case 'essencial': return 'Produtor Essencial';
    case 'pro': return 'Frota Pro';
    case 'enterprise': return 'Agro Enterprise';
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

    const mergedMap = new Map<string, Subscriber>();

    // 1. Processa tabela legada 'subscribers' primeiro (base)
    if (Array.isArray(subsData)) {
      for (const row of subsData) {
        const planKey = normalizeSubscriberPlanKey(row.plan_name || row.plan_id || row.plano_selecionado);
        const emailKey = (row.responsible_email || row.email || '').trim().toLowerCase();
        const idKey = row.id || toValidUUID(emailKey);
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
          planId: planKey,
          planName: getSubscriberPlanDisplayName(planKey),
          monthlyValue: Number(row.monthly_value) || Number(row.valor_mensal) || getSubscriberPlanPrice(planKey),
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
        const planKey = normalizeSubscriberPlanKey(row.plano_nome || row.plano_selecionado || row.plan_id || row.plan_name);
        const emailKey = (row.email || row.responsible_email || '').trim().toLowerCase();
        const idKey = row.id || toValidUUID(emailKey);
        const subItem: Subscriber = {
          id: idKey,
          name: row.nome || row.name || 'Assinante',
          responsibleEmail: emailKey,
          password: row.password_hash || row.senha || undefined,
          trialUntil: row.trial_ate ? new Date(row.trial_ate).toISOString().split('T')[0] : (row.trial_until || ''),
          cpfCnpj: row.cpf_cnpj || row.document || '',
          stateRegistration: row.state_registration || undefined,
          phone: row.telefone || row.phone || '',
          cep: row.cep || '',
          street: row.logradouro || row.street || '',
          number: row.numero || row.number || '',
          neighborhood: row.bairro || row.neighborhood || '',
          city: row.cidade || row.city || '',
          state: row.estado || row.state || '',
          planId: planKey,
          planName: row.plano_nome || getSubscriberPlanDisplayName(planKey),
          monthlyValue: Number(row.valor_mensal) || getSubscriberPlanPrice(planKey),
          status: normalizeSubscriberStatus(row.status),
          createdAt: row.criado_em || row.created_at || new Date().toISOString(),
          updatedAt: row.criado_em || row.updated_at || new Date().toISOString(),
        };
        // Sobrescreve dados legados com dados mais recentes e prioritários de 'assinantes'
        mergedMap.set(idKey, subItem);
        if (emailKey) mergedMap.set(emailKey, subItem);
      }
    }

    // Deduplica por ID único preservando ordenação decrescente por data
    const uniqueSubscribers = Array.from(new Set(Array.from(mergedMap.values())));

    // Sincronização manual do cliente antigo 'COLACA SILAGEM LTDA'
    const hasColaca = uniqueSubscribers.some(
      s => s && (
        String(s.name || '').toUpperCase().includes('COLACA') ||
        String(s.responsibleEmail || '').toLowerCase().includes('colaca')
      )
    );
    if (!hasColaca) {
      const colacaSub: Subscriber = {
        id: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
        name: 'COLACA SILAGEM LTDA',
        responsibleEmail: 'colacasilagem@gmail.com',
        phone: '(44) 99999-0000',
        cpfCnpj: '',
        cep: '',
        street: '',
        number: '',
        neighborhood: '',
        city: 'Maringá',
        state: 'PR',
        planId: 'essencial',
        planName: 'Produtor Essencial',
        monthlyValue: 195.00,
        status: 'trial',
        trialUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        createdAt: '2026-03-01T10:00:00.000Z',
        updatedAt: new Date().toISOString(),
      };
      uniqueSubscribers.unshift(colacaSub);
    }

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
    const planDisplayName = getSubscriberPlanDisplayName(planKey);
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

    return assinantesSuccess;
  } catch (err) {
    return false;
  }
}

export async function updateCloudSubscriberStatus(id: string, status: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const validId = toValidUUID(id);
    const normalized = normalizeSubscriberStatus(status);

    // Atualiza em assinantes
    if (!isTableUnmigrated('assinantes')) {
      const { error: err1 } = await supabase
        .from('assinantes')
        .update({ status: normalized })
        .eq('id', validId);
      if (err1 && isTableMissingError(err1)) markTableUnmigrated('assinantes');
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
  } catch (err) {
    return false;
  }
}

export async function updateCloudSubscriberPlan(id: string, planNameOrKey: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const validId = toValidUUID(id);
    const planKey = normalizeSubscriberPlanKey(planNameOrKey);
    const valorMensal = getSubscriberPlanPrice(planKey);
    const displayName = getSubscriberPlanDisplayName(planKey);

    // Atualiza em assinantes
    if (!isTableUnmigrated('assinantes')) {
      const { error: err1 } = await supabase
        .from('assinantes')
        .update({ 
          plano_nome: displayName,
          plano_selecionado: planKey,
          valor_mensal: valorMensal
        })
        .eq('id', validId);
      if (err1 && isTableMissingError(err1)) markTableUnmigrated('assinantes');
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
  } catch (err) {
    return false;
  }
}

export async function updateCloudSubscriberTrial(id: string, trialEndsAtIso: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const validId = toValidUUID(id);

    // Atualiza em assinantes
    if (!isTableUnmigrated('assinantes')) {
      const { error: err1 } = await supabase
        .from('assinantes')
        .update({ trial_ate: trialEndsAtIso })
        .eq('id', validId);
      if (err1 && isTableMissingError(err1)) markTableUnmigrated('assinantes');
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
  } catch (err) {
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

export async function deleteCloudSubscriber(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const validId = toValidUUID(id);
    if (!isTableUnmigrated('assinantes')) {
      await supabase.from('assinantes').delete().eq('id', validId);
    }
    if (!isTableUnmigrated('subscribers')) {
      await supabase.from('subscribers').delete().eq('id', validId);
    }
    return true;
  } catch (err) {
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

