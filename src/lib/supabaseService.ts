import { supabase, isSupabaseConfigured } from './supabase';
import {
  Client,
  Supplier,
  InventoryItem,
  Expense,
  Machinery,
  Employee,
  SilageOrder,
  ServiceOrder,
  CompanyProfile
} from '../types';

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
    const { error } = await supabase
      .from('fornecedores')
      .upsert({
        id: toValidUUID(supplier.id),
        cnpj_cpf: supplier.cnpjOrCpf?.trim() || `00.000.000/0000-${toValidUUID(supplier.id).slice(0, 2)}`,
        razao_social: supplier.name || supplier.tradeName || 'Fornecedor sem Razão Social',
        nome_fantasia: supplier.tradeName || supplier.name || '',
        inscricao_estadual: supplier.stateRegistration || '',
        inscricao_municipal: supplier.municipalRegistration || '',
        telefone_whatsapp: supplier.phone || '',
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    if (error) {
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
    const payload = {
      id: toValidUUID(nfe.id),
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

    const { error } = await supabase
      .from('notas_fiscais')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
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
    const { error } = await supabase
      .from('contas_a_pagar')
      .upsert({
        id: toValidUUID(parcela.id),
        nota_fiscal_id: parcela.nota_fiscal_id ? toValidUUID(parcela.nota_fiscal_id) : null,
        numero_parcela: parcela.numero_parcela || '01/01',
        valor_parcela: Number(parcela.valor_parcela) || 0,
        data_vencimento: parcela.data_vencimento || new Date().toISOString().split('T')[0],
        forma_pagamento: parcela.forma_pagamento || 'Boleto',
        centro_custo: parcela.centro_custo || 'Geral',
        status_pago: Boolean(parcela.status_pago)
      }, { onConflict: 'id' });

    if (error) {
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
    const { error } = await supabase
      .from('estoque')
      .upsert({
        id: toValidUUID(item.id),
        codigo_produto: item.code || `PRD-${toValidUUID(item.id).slice(0, 8)}`,
        descricao: item.name || 'Produto sem descrição',
        quantidade_atual: Number(item.quantity) || 0.000,
        preco_venda_final: Number(item.salePrice) || 0,
        preco_venda_atacado: Number(item.wholesalePrice) || 0,
        preco_venda_promo: Number(item.promoPrice) || null,
        fim_promocao: null,
      }, { onConflict: 'id' });

    if (error) {
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
export async function fetchClientes(): Promise<Client[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.warn('Supabase fetchClientes notice:', error.message);
      return null;
    }
    return data as Client[];
  } catch (err) {
    console.warn('Supabase fetchClientes err:', err);
    return null;
  }
}

export async function upsertCliente(client: Client): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const { error } = await supabase
      .from('clientes')
      .upsert({
        id: toValidUUID(client.id),
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
      }, { onConflict: 'id' });

    if (error) {
      console.warn('Supabase upsertCliente notice:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase upsertCliente err:', err);
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
    const { error } = await supabase
      .from('rh_funcionarios')
      .upsert({
        id: toValidUUID(employee.id),
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
      }, { onConflict: 'id' });

    if (error) {
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
      // Se a tabela remota ainda não tiver a coluna fleet_number, tenta salvar sem ela
      if (error.message && (error.message.includes('fleet_number') || error.message.includes('column') || error.message.includes('schema cache'))) {
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

export async function fetchAllDataFromSupabase() {
  if (!isSupabaseConfigured) return null;
  try {
    const [
      clientesRes,
      fornecedoresRes,
      estoqueRes,
      notasFiscaisRes,
      contasPagarRes,
      rhRes,
      frotasRes
    ] = await Promise.all([
      supabase.from('clientes').select('*').limit(500),
      supabase.from('fornecedores').select('*').limit(500),
      supabase.from('estoque').select('*').limit(500),
      supabase.from('notas_fiscais').select('*').limit(500),
      supabase.from('contas_a_pagar').select('*').limit(500),
      supabase.from('rh_funcionarios').select('*').limit(500),
      supabase.from('gestao_frotas').select('*').limit(500)
    ]);

    return {
      clientes: clientesRes.data || [],
      fornecedores: fornecedoresRes.data || [],
      estoque: estoqueRes.data || [],
      notas_fiscais: notasFiscaisRes.data || [],
      contas_a_pagar: contasPagarRes.data || [],
      rh_funcionarios: rhRes.data || [],
      gestao_frotas: frotasRes.data || []
    };
  } catch (err) {
    console.warn('Supabase fetchAllDataFromSupabase notice:', err);
    return null;
  }
}
