import { 
  Expense, 
  ExpenseCategory, 
  CostCenter, 
  Client, 
  SilageOrder, 
  Machinery, 
  CropSeason,
  Employee,
  FleetTeam,
  CompanyProfile,
  Supplier,
  InventoryItem,
  ServiceOrder,
  FuelLog,
  MaintenanceLog,
  BankAccount,
  BankTransaction,
  ThirdPartySettlement,
  BrokerSettlement,
  PayrollRecord,
  VacationRecord,
  LeaveRecord,
  SalaryAdvance,
  MedicalCertificateRecord,
  AbsenceRecord,
  TerminationRecord,
  VehicleTypeDefinition,
  TireRotationLog,
  TireItem,
  MaintenancePurchaseRequest,
  MaintenanceCategoryDefinition,
  ServiceAppointment,
  DocumentoEntradaRecord,
  DocumentoEntradaItem,
  TanqueCombustivel,
  FinanceiroCheque,
  ClienteCredito
} from '../types';
import { 
  INITIAL_VEHICLE_TYPES, 
  INITIAL_TIRE_INVENTORY, 
  INITIAL_TIRES_IN_REFORM, 
  INITIAL_TIRES_DISCARDED,
  getStoredAxleConfigurations,
  saveStoredAxleConfigurations,
  StoredAxleConfigOption
} from './tireAndAxlePresets';
import {
  INITIAL_EXPENSES,
  INITIAL_CATEGORIES,
  INITIAL_COST_CENTERS,
  INITIAL_CLIENTS,
  INITIAL_ORDERS,
  INITIAL_MACHINERIES,
  INITIAL_SEASONS,
  INITIAL_EMPLOYEES,
  INITIAL_FLEET_TEAMS,
  INITIAL_COMPANY_PROFILE,
  INITIAL_SUPPLIERS,
  INITIAL_INVENTORY,
  INITIAL_SERVICES,
  INITIAL_FUEL_LOGS,
  INITIAL_MAINTENANCE_LOGS,
  INITIAL_BANK_ACCOUNTS,
  INITIAL_SETTLEMENTS
} from './initialData';
import { DEFAULT_INITIAL_APPOINTMENTS, findAppointmentByIdOrNumber } from './defaultAppointments';
export { DEFAULT_INITIAL_APPOINTMENTS, findAppointmentByIdOrNumber };

const STORAGE_KEYS = {
  EXPENSES: 'silagem_facil_clean_v1_expenses',
  CATEGORIES: 'silagem_facil_clean_v1_categories',
  COST_CENTERS: 'silagem_facil_clean_v1_cost_centers',
  CLIENTS: 'silagem_facil_clean_v1_clients',
  ORDERS: 'silagem_facil_clean_v1_orders',
  MACHINERIES: 'silagem_facil_clean_v1_machineries',
  SEASONS: 'silagem_facil_clean_v1_seasons',
  EMPLOYEES: 'silagem_facil_clean_v1_employees',
  FLEET_TEAMS: 'silagem_facil_clean_v1_fleet_teams',
  COMPANY_PROFILE: 'silagem_facil_clean_v1_company_profile',
  SUPPLIERS: 'silagem_facil_clean_v1_suppliers',
  INVENTORY: 'silagem_facil_clean_v1_inventory',
  SERVICES: 'silagem_facil_clean_v1_services',
  FUEL_LOGS: 'silagem_facil_clean_v1_fuel_logs',
  MAINTENANCE_LOGS: 'silagem_facil_clean_v1_maintenance_logs',
  SETTINGS: 'silagem_facil_clean_v1_settings',
  SUPPLIER_CATEGORIES: 'silagem_facil_clean_v1_supplier_categories',
  INVENTORY_CATEGORIES: 'silagem_facil_clean_v1_inventory_categories',
  SERVICE_TYPES: 'silagem_facil_clean_v1_service_types',
  SILAGE_PRODUCT_TYPES: 'silagem_facil_clean_v1_silage_product_types',
  CATTLE_TYPES: 'silagem_facil_clean_v1_cattle_types',
  EMPLOYEE_ROLES: 'silagem_facil_clean_v1_employee_roles',
  MACHINERY_TYPES: 'silagem_facil_clean_v1_machinery_types',
  BANK_ACCOUNTS: 'silagem_facil_clean_v1_bank_accounts',
  BANK_TRANSACTIONS: 'silagem_facil_clean_v1_bank_transactions',
  SETTLEMENTS: 'silagem_facil_clean_v1_settlements',
  BROKER_SETTLEMENTS: 'silagem_facil_clean_v1_broker_settlements',
  PAYROLLS: 'silagem_facil_clean_v1_payrolls',
  VACATIONS: 'silagem_facil_clean_v1_vacations',
  LEAVES: 'silagem_facil_clean_v1_leaves',
  SALARY_ADVANCES: 'silagem_facil_clean_v1_salary_advances',
  MEDICAL_CERTIFICATES: 'silagem_facil_clean_v1_medical_certificates',
  ABSENCES: 'silagem_facil_clean_v1_absences',
  TERMINATIONS: 'silagem_facil_clean_v1_terminations',
  VEHICLE_TYPES: 'silagem_facil_clean_v1_vehicle_types',
  TIRE_ROTATION_LOGS: 'silagem_facil_clean_v1_tire_rotation_logs',
  TIRE_INVENTORY: 'silagem_facil_clean_v1_tire_inventory',
  TIRES_IN_REFORM: 'silagem_facil_clean_v1_tires_in_reform',
  TIRES_DISCARDED: 'silagem_facil_clean_v1_tires_discarded',
  MAINTENANCE_PURCHASE_REQUESTS: 'silagem_facil_clean_v1_maintenance_purchase_requests',
  MAINTENANCE_CATEGORIES: 'silagem_facil_clean_v1_maintenance_categories',
  VEHICLE_SYSTEM_CATEGORIES: 'silagem_facil_clean_v1_vehicle_system_categories',
  VEHICLE_OWNERSHIP_REGIMES: 'silagem_facil_clean_v1_vehicle_ownership_regimes',
  APPOINTMENTS: 'silagem_facil_clean_v1_service_appointments',
  MANUAL_ENTRY_DOCUMENT_TYPES: 'silagem_facil_clean_v1_manual_entry_doc_types',
  TANQUES_COMBUSTIVEL: 'silagem_facil_clean_v1_tanques_combustivel',
  FINANCEIRO_CHEQUES: 'silagem_facil_clean_v1_financeiro_cheques',
  CLIENTE_CREDITOS: 'silagem_facil_clean_v1_cliente_creditos',
  DRAFT_NOTA_ATIVA: 'colaca_silagem_rascunho_nota_ativa',
};

export const CANONICAL_TANK_UUIDS = {
  S10: 'a9e3de9c-a6af-439a-9eca-fed6810d5f4f',
  S500: '2e3dee71-28fe-41b0-ac4e-de301f5e8db4',
  ARLA: '02e88be3-87c7-4832-af0f-6d6ece1dce7a',
} as const;

export const CANONICAL_FUEL_PROD_UUIDS = {
  S10: 'e2688a0e-15ae-4112-a832-d054b00ba4b7',
  S500: '48becfd9-c7e8-4d7e-bd55-fc5dc02db2ff',
  ARLA_GRANEL: 'f20bfadc-4165-4a43-9c12-99d2971442c6',
  ARLA_GALAO: '337558c6-0ebb-4bb2-a92f-029cab1eee17',
} as const;

const LEGACY_FUEL_PROD_UUID_MAP: Record<string, string> = {
  '2593d6b8-b84a-4688-91a2-f0de63b05e43': CANONICAL_FUEL_PROD_UUIDS.S10,
  '2593d6b8-b592-458a-a73c-647151f49781': CANONICAL_FUEL_PROD_UUIDS.S10,
  '31ea18d8-2783-426b-abb0-42828226e7ce': CANONICAL_FUEL_PROD_UUIDS.S500,
  '657fcbea-143a-44bd-af25-91b0b19f3118': CANONICAL_FUEL_PROD_UUIDS.ARLA_GRANEL,
  '216acaf8-fc6b-425b-9c3a-da5aeac3e710': CANONICAL_FUEL_PROD_UUIDS.ARLA_GALAO,
};

const STORAGE_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeTankIdToUUID(rawId?: string, tipoOuNome?: string): string {
  const id = String(rawId || '').trim();
  if (STORAGE_UUID_REGEX.test(id)) return id.toLowerCase();
  const text = `${id} ${tipoOuNome || ''}`.toLowerCase();
  if (text.includes('s500') || text.includes('comum')) return CANONICAL_TANK_UUIDS.S500;
  if (text.includes('arla')) return CANONICAL_TANK_UUIDS.ARLA;
  return CANONICAL_TANK_UUIDS.S10;
}

export function normalizeFuelProdIdToUUID(rawId?: string, nome?: string): string {
  const id = String(rawId || '').trim().toLowerCase();
  if (LEGACY_FUEL_PROD_UUID_MAP[id]) return LEGACY_FUEL_PROD_UUID_MAP[id];
  if (STORAGE_UUID_REGEX.test(id)) return id;
  const text = `${id} ${nome || ''}`.toLowerCase();
  if (text.includes('galao') || text.includes('galão') || text.includes('20l')) return CANONICAL_FUEL_PROD_UUIDS.ARLA_GALAO;
  if (text.includes('arla')) return CANONICAL_FUEL_PROD_UUIDS.ARLA_GRANEL;
  if (text.includes('s500') || text.includes('comum')) return CANONICAL_FUEL_PROD_UUIDS.S500;
  return CANONICAL_FUEL_PROD_UUIDS.S10;
}

export const DEFAULT_TANQUES_COMBUSTIVEL: TanqueCombustivel[] = [
  {
    id: CANONICAL_TANK_UUIDS.S10,
    nome: 'Tanque Principal Diesel S10',
    tipo_combustivel: 'Diesel S10',
    produto_id: CANONICAL_FUEL_PROD_UUIDS.S10,
    produtoId: CANONICAL_FUEL_PROD_UUIDS.S10,
    capacidade_total: 15000,
    quantidade_atual: 0,
    localizacao: 'Pátio Central / Barracão de Abastecimento'
  },
  {
    id: CANONICAL_TANK_UUIDS.S500,
    nome: 'Tanque Secundário Diesel S500',
    tipo_combustivel: 'Diesel S500',
    produto_id: CANONICAL_FUEL_PROD_UUIDS.S500,
    produtoId: CANONICAL_FUEL_PROD_UUIDS.S500,
    capacidade_total: 10000,
    quantidade_atual: 0,
    localizacao: 'Oficina / Setor Agrícola'
  },
  {
    id: CANONICAL_TANK_UUIDS.ARLA,
    nome: 'Tanque Arla 32',
    tipo_combustivel: 'Arla 32',
    produto_id: CANONICAL_FUEL_PROD_UUIDS.ARLA_GRANEL,
    produtoId: CANONICAL_FUEL_PROD_UUIDS.ARLA_GRANEL,
    capacidade_total: 1000,
    quantidade_atual: 0,
    localizacao: 'Barracão de Abastecimento / Oficina'
  }
];

export function getStoredTanquesCombustivel(): TanqueCombustivel[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TANQUES_COMBUSTIVEL);
    if (!raw) return DEFAULT_TANQUES_COMBUSTIVEL;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      let needsSave = false;
      const sanitized = parsed.map(t => {
        const cleanId = normalizeTankIdToUUID(t.id, `${t.tipo_combustivel || ''} ${t.nome || ''}`);
        const cleanProdId = t.produto_id || t.produtoId
          ? normalizeFuelProdIdToUUID(t.produto_id || t.produtoId, `${t.tipo_combustivel || ''} ${t.nome || ''}`)
          : normalizeFuelProdIdToUUID('', `${t.tipo_combustivel || ''} ${t.nome || ''}`);
        if (cleanId !== t.id || cleanProdId !== t.produto_id) {
          needsSave = true;
        }
        let qtd = Number(t.quantidade_atual ?? 0);
        if ((t.id === 'tanque_diesel_s10' || cleanId === CANONICAL_TANK_UUIDS.S10) && qtd === 11200) {
          qtd = 0;
          needsSave = true;
        }
        if ((t.id === 'tanque_diesel_s500' || cleanId === CANONICAL_TANK_UUIDS.S500) && qtd === 6500) {
          qtd = 0;
          needsSave = true;
        }
        let cap = Number(t.capacidade_total ?? 15000);
        let nome = t.nome || 'Tanque de Combustível';
        if ((t.id === 'tanque_arla_32' || cleanId === CANONICAL_TANK_UUIDS.ARLA) && (cap === 5000 || !cap)) {
          cap = 1000;
          nome = 'Tanque Arla 32';
          needsSave = true;
        }
        return {
          ...t,
          id: cleanId,
          nome,
          capacidade_total: cap,
          quantidade_atual: qtd,
          produto_id: cleanProdId,
          produtoId: cleanProdId,
        };
      });

      // Garante que o tanque de Arla 32 sempre exista
      const hasArla = sanitized.some(t => 
        t.id === CANONICAL_TANK_UUIDS.ARLA || 
        t.tipo_combustivel?.toLowerCase().includes('arla') || 
        t.nome?.toLowerCase().includes('arla')
      );
      if (!hasArla) {
        needsSave = true;
        sanitized.push({
          id: CANONICAL_TANK_UUIDS.ARLA,
          nome: 'Tanque Arla 32',
          tipo_combustivel: 'Arla 32',
          produto_id: CANONICAL_FUEL_PROD_UUIDS.ARLA_GRANEL,
          produtoId: CANONICAL_FUEL_PROD_UUIDS.ARLA_GRANEL,
          capacidade_total: 1000,
          quantidade_atual: 0,
          localizacao: 'Barracão de Abastecimento / Oficina'
        });
      }

      if (needsSave) {
        try {
          localStorage.setItem(STORAGE_KEYS.TANQUES_COMBUSTIVEL, JSON.stringify(sanitized));
        } catch {}
      }

      return sanitized;
    }
    return DEFAULT_TANQUES_COMBUSTIVEL;
  } catch (e) {
    console.error('Failed to load tanques_combustivel', e);
    return DEFAULT_TANQUES_COMBUSTIVEL;
  }
}

export function saveStoredTanquesCombustivel(tanques: TanqueCombustivel[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.TANQUES_COMBUSTIVEL, JSON.stringify(tanques));
  } catch (e) {
    console.error('Failed to save tanques_combustivel', e);
  }
}

export function getStoredExpenses(): Expense[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.EXPENSES);
    if (!raw) return INITIAL_EXPENSES;
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load expenses', e);
    return INITIAL_EXPENSES;
  }
}

let lastSavedExpensesJson = '';

export function saveStoredExpenses(expenses: Expense[]): void {
  try {
    const json = JSON.stringify(expenses);
    if (json === lastSavedExpensesJson) return;
    lastSavedExpensesJson = json;
    localStorage.setItem(STORAGE_KEYS.EXPENSES, json);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('silagem_expenses_updated', { detail: expenses }));
    }
  } catch (e) {
    console.error('Failed to save expenses', e);
  }
}

export function getStoredCategories(): ExpenseCategory[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    if (!raw) return INITIAL_CATEGORIES;
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load categories', e);
    return INITIAL_CATEGORIES;
  }
}

export function saveStoredCategories(categories: ExpenseCategory[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
  } catch (e) {
    console.error('Failed to save categories', e);
  }
}

export function getStoredCostCenters(): CostCenter[] {
  try {
    let raw = localStorage.getItem('colaca_silagem_centros_custo');
    if (!raw) {
      raw = localStorage.getItem(STORAGE_KEYS.COST_CENTERS);
    }
    if (!raw) return INITIAL_COST_CENTERS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return INITIAL_COST_CENTERS;
    return parsed;
  } catch (e) {
    return INITIAL_COST_CENTERS;
  }
}

export function saveStoredCostCenters(centers: CostCenter[]): void {
  try {
    const json = JSON.stringify(centers);
    localStorage.setItem(STORAGE_KEYS.COST_CENTERS, json);
    localStorage.setItem('colaca_silagem_centros_custo', json);
  } catch (e) {
    console.error('Failed to save cost centers', e);
  }
}

export function saveActiveNfeDraft(draft: any): void {
  try {
    if (!draft) return;
    localStorage.setItem(STORAGE_KEYS.DRAFT_NOTA_ATIVA, JSON.stringify(draft));
  } catch (e) {
    console.error('Failed to save active NFe draft', e);
  }
}

export function clearActiveNfeDraft(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.DRAFT_NOTA_ATIVA);
  } catch (e) {
    console.error('Failed to clear active NFe draft', e);
  }
}

export function getActiveNfeDraft(): any | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DRAFT_NOTA_ATIVA);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to get active NFe draft', e);
    return null;
  }
}

export function getStoredClients(): Client[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CLIENTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Higienização de clientes de teste/mock legados
    const cleaned = parsed.filter(c => {
      if (!c || typeof c !== 'object') return false;
      const name = (c.name || '').toLowerCase();
      const farm = (c.farmName || '').toLowerCase();
      const isMock = ['agrícola silveira', 'agricola silveira', 'fazenda santa maria', 'agropecuária santa fé', 'agropecuaria santa fe'].some(fake =>
        name.includes(fake) || farm.includes(fake)
      );
      const isMockId = c.id && String(c.id).startsWith('mock_');
      return !isMock && !isMockId;
    });
    if (cleaned.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch (e) {
    return [];
  }
}

export function saveStoredClients(clients: Client[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(clients));
  } catch (e) {
    console.error('Failed to save clients', e);
  }
}

export function getStoredOrders(): SilageOrder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ORDERS);
    if (!raw) return INITIAL_ORDERS;
    return JSON.parse(raw);
  } catch (e) {
    return INITIAL_ORDERS;
  }
}

export function saveStoredOrders(orders: SilageOrder[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
  } catch (e) {
    console.error('Failed to save orders', e);
  }
}

export function getStoredMachineries(): Machinery[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MACHINERIES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Higienização segura preservando todos os cadastros do usuário
    const cleaned = parsed.filter(m => {
      if (!m || typeof m !== 'object') return false;
      const isMockId = ['veh_forr_05_2023', 'veh_colh_02_2022', 'veh_trator_jd_6110', 'veh_evd_2j61'].includes(m.id);
      return !isMockId;
    }).map(m => {
      const img = m.imageUrl || m.photoUrl;
      if (img && (img.includes('wix_mp.com') || img.includes('wix_mp') || img.includes('static.wixstatic.com') || img.includes('/_upload/') || img.includes('/upload/') || (img.startsWith('blob:') && typeof window !== 'undefined' && !window.location.href.includes(img)))) {
        return { ...m, imageUrl: undefined, photoUrl: undefined, foto_url: undefined };
      }
      return m;
    });
    if (cleaned.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEYS.MACHINERIES, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch (e) {
    return [];
  }
}

export function saveStoredMachineries(machines: Machinery[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.MACHINERIES, JSON.stringify(machines));
  } catch (e) {
    console.error('Failed to save machineries', e);
  }
}

export function getStoredSeasons(): CropSeason[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SEASONS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Higienização de safras de teste/mock legadas
    const cleaned = parsed.filter(s => {
      if (!s || typeof s !== 'object') return false;
      const name = (s.name || '').toLowerCase();
      const crop = (s.cropType || '').toLowerCase();
      const isMock = ['safra 2026/2027', 'silagem de milho', 'c chácara + oton', '2026/2027'].some(fake => 
        name.includes(fake) || crop.includes(fake)
      );
      const isMockId = ['season-001', 'season-002', 'safra-001'].includes(s.id);
      return !isMock && !isMockId;
    });
    if (cleaned.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEYS.SEASONS, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch (e) {
    return [];
  }
}

export function saveStoredSeasons(seasons: CropSeason[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SEASONS, JSON.stringify(seasons));
  } catch (e) {
    console.error('Failed to save seasons', e);
  }
}

export function getStoredEmployees(): Employee[] {
  try {
    let raw = localStorage.getItem(STORAGE_KEYS.EMPLOYEES);
    if (!raw) {
      raw = localStorage.getItem('colaca_silagem_funcionarios');
    }
    if (!raw) return INITIAL_EMPLOYEES;
    const parsed: Employee[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return INITIAL_EMPLOYEES;
    let modified = false;

    // Filtra colaboradores excluídos e registros antigos/duplicados sem dados essenciais
    const filtered = parsed.filter(emp => {
      if (!emp || !emp.name || emp.name.trim() === '') return false;
      const st = String(emp.status || '').toLowerCase();
      if (st === 'excluido' || st === 'inativo' || emp.active === false) {
        modified = true;
        return false;
      }
      // Ignora o registro antigo/duplicado de ALISSON PAG sem CPF
      if (emp.id === 'ab80e2fa-5094-43b3-83bf-c34047bf1b42' || (emp.name.trim().toUpperCase() === 'ALISSON PAG' && !emp.cpf)) {
        modified = true;
        return false;
      }
      return true;
    });

    const cleaned = filtered.map(emp => {
      const p = emp.photoUrl || (emp as any).foto_url;
      if (p && (p.includes('wix_mp.com') || p.includes('wix_mp') || p.includes('static.wixstatic.com') || (p.startsWith('blob:') && typeof window !== 'undefined' && !window.location.href.includes(p)))) {
        modified = true;
        return { ...emp, photoUrl: undefined, foto_url: undefined };
      }
      return emp;
    });
    if (modified || cleaned.length !== parsed.length) {
      const cleanJson = JSON.stringify(cleaned);
      localStorage.setItem(STORAGE_KEYS.EMPLOYEES, cleanJson);
      localStorage.setItem('colaca_silagem_funcionarios', cleanJson);
    }
    return cleaned;
  } catch (e) {
    return INITIAL_EMPLOYEES;
  }
}

export function saveStoredEmployees(employees: Employee[]): void {
  try {
    const json = JSON.stringify(employees);
    localStorage.setItem(STORAGE_KEYS.EMPLOYEES, json);
    localStorage.setItem('colaca_silagem_funcionarios', json);
  } catch (e) {
    console.error('Failed to save employees', e);
  }
}

export function getStoredFleetTeams(): FleetTeam[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.FLEET_TEAMS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Higienização de frentes/equipes de teste legadas
    const cleaned = parsed.filter(t => {
      if (!t || typeof t !== 'object') return false;
      const name = (t.name || '').toLowerCase();
      const mName = (t.machineryName || '').toLowerCase();
      const isMock = ['maq 10', 'jf maq1', 'john deere maq 10', 'maq 02', 'maq 03', 'maq 04', 'maq 05', 'claas 870', 'claas 860', 'jf c120'].some(fake =>
        name.includes(fake) || mName.includes(fake)
      );
      const isMockId = ['team-01', 'team-02', 'team_maq_02', 'team_maq_03', 'team_maq_04', 'team_maq_05'].includes(t.id);
      return !isMock && !isMockId;
    });
    if (cleaned.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEYS.FLEET_TEAMS, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch (e) {
    return [];
  }
}

export function saveStoredFleetTeams(teams: FleetTeam[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.FLEET_TEAMS, JSON.stringify(teams));
  } catch (e) {
    console.error('Failed to save fleet teams', e);
  }
}

export function resetAllSystemData(): void {
  console.warn('[Segurança] Ação de zerar dados do sistema desativada para proteção contra perda de dados.');
}

export function getStoredSuppliers(): Supplier[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SUPPLIERS);
    if (!raw) return INITIAL_SUPPLIERS;
    return JSON.parse(raw);
  } catch (e) {
    return INITIAL_SUPPLIERS;
  }
}

export function saveStoredSuppliers(suppliers: Supplier[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SUPPLIERS, JSON.stringify(suppliers));
  } catch (e) {
    console.error('Failed to save suppliers', e);
  }
}

export function ensureDieselProductsInInventory(items: InventoryItem[]): InventoryItem[] {
  const currentList = (Array.isArray(items) ? items : []).map(item => {
    const rawId = String(item?.id || '').trim();
    const mappedId = LEGACY_FUEL_PROD_UUID_MAP[rawId.toLowerCase()] || rawId;
    return {
      ...item,
      id: mappedId,
      code: item?.code !== undefined && item?.code !== null ? String(item.code) : '',
      codigo_produto: item?.codigo_produto !== undefined && item?.codigo_produto !== null ? String(item.codigo_produto) : undefined,
      barcode: item?.barcode !== undefined && item?.barcode !== null ? String(item.barcode) : undefined,
      codigo_barras: item?.codigo_barras !== undefined && item?.codigo_barras !== null ? String(item.codigo_barras) : undefined,
      name: String(item?.name || item?.nome_comercial || item?.nome || ''),
      nome_comercial: item?.nome_comercial ? String(item.nome_comercial) : String(item?.name || item?.nome || ''),
    };
  });
  const tanks = getStoredTanquesCombustivel();
  const tankS10 = tanks.find(t => t.id === CANONICAL_TANK_UUIDS.S10 || t.id === 'tanque_diesel_s10' || t.tipo_combustivel?.toLowerCase().includes('s10'));
  const tankS500 = tanks.find(t => t.id === CANONICAL_TANK_UUIDS.S500 || t.id === 'tanque_diesel_s500' || t.tipo_combustivel?.toLowerCase().includes('s500'));
  const tankArla = tanks.find(t => t.id === CANONICAL_TANK_UUIDS.ARLA || t.id === 'tanque_arla_32' || t.tipo_combustivel?.toLowerCase().includes('arla') || t.nome.toLowerCase().includes('arla'));

  // Helper para ler estritamente o saldo do próprio item de estoque (permitindo 0 sem fallback para tanques)
  const extractProductQty = (item: any): number => {
    const raw = item?.quantidade_atual ?? item?.estoque_atual ?? item?.quantidade ?? item?.quantity;
    if (raw === undefined || raw === null || raw === '') return 0;
    const num = Number(raw);
    return isNaN(num) ? 0 : num;
  };

  // Helper para ler o preço/custo cadastrado do item (priorizando valores > 0 em qualquer coluna de preço/custo)
  const extractProductCost = (item: any, fallbackPrice: number = 0): number => {
    const candidates = [
      item?.custo_nominal,
      item?.preco_custo_inicial,
      item?.preco_custo,
      item?.custo_com_imposto,
      item?.unitCost,
      item?.unit_cost,
      item?.custo,
      item?.valor_unitario,
      item?.preco_venda_varejo,
      item?.preco_venda,
      item?.preco_venda_final,
      item?.salePrice,
      item?.preco,
    ];
    for (const c of candidates) {
      if (c !== undefined && c !== null && c !== '') {
        const n = typeof c === 'number' ? c : parseFloat(String(c).replace(',', '.'));
        if (!isNaN(n) && n > 0) return n;
      }
    }
    return fallbackPrice;
  };

  const extractProductSale = (item: any): number => {
    const candidates = [
      item?.preco_venda_varejo,
      item?.preco_venda,
      item?.preco_venda_final,
      item?.salePrice,
    ];
    for (const c of candidates) {
      if (c !== undefined && c !== null && c !== '') {
        const n = typeof c === 'number' ? c : parseFloat(String(c).replace(',', '.'));
        if (!isNaN(n) && n > 0) return n;
      }
    }
    return 0;
  };

  // 1. Verifica Diesel S10
  const s10Idx = currentList.findIndex(i => 
    i.id === 'prod_diesel_s10' ||
    i.id === CANONICAL_FUEL_PROD_UUIDS.S10 ||
    (i.name && i.name.toLowerCase().includes('diesel s10')) ||
    (i.nome_comercial && i.nome_comercial.toLowerCase().includes('diesel s10'))
  );

  if (s10Idx >= 0) {
    const existing = currentList[s10Idx];
    const effectiveQty = extractProductQty(existing);
    const effectiveCost = extractProductCost(existing, 5.85);
    const effectiveSale = extractProductSale(existing);
    const validId = STORAGE_UUID_REGEX.test(String(existing.id || '')) ? existing.id : CANONICAL_FUEL_PROD_UUIDS.S10;

    currentList[s10Idx] = {
      ...existing,
      id: validId,
      name: 'Diesel S10',
      nome_comercial: 'Diesel S10',
      category: 'Combustível & Arla',
      categoria: 'Combustível & Arla',
      unit: 'L',
      unidade_medida: 'L',
      quantity: effectiveQty,
      quantidade_atual: effectiveQty,
      unitCost: effectiveCost,
      preco_custo_inicial: effectiveCost,
      custo_nominal: effectiveCost,
      salePrice: effectiveSale,
      preco_venda_varejo: effectiveSale,
      preco_venda: effectiveSale,
      location: existing.localizacao_fisica || existing.location || 'Tanque Fazenda (Pátio Central)',
      localizacao_fisica: existing.localizacao_fisica || existing.location || 'Tanque Fazenda (Pátio Central)',
      capacidade_total: existing.capacidade_total || (tankS10?.capacidade_total || 15000),
    };
  } else {
    currentList.unshift({
      id: CANONICAL_FUEL_PROD_UUIDS.S10,
      code: 'COMB-S10',
      codigo_produto: 'COMB-S10',
      barcode: '',
      codigo_barras: '',
      name: 'Diesel S10',
      nome: 'Diesel S10',
      nome_comercial: 'Diesel S10',
      category: 'Combustível & Arla',
      categoria: 'Combustível & Arla',
      quantity: 0,
      quantidade_atual: 0,
      unit: 'L',
      unidade_medida: 'L',
      minQuantity: 2000,
      unitCost: 5.85,
      preco_custo_inicial: 5.85,
      custo_nominal: 5.85,
      salePrice: 0,
      preco_venda_varejo: 0,
      preco_venda: 0,
      profitMargin: 0,
      location: 'Tanque Fazenda (Pátio Central)',
      localizacao_fisica: 'Tanque Fazenda (Pátio Central)',
      capacidade_total: tankS10?.capacidade_total || 15000,
    } as any);
  }

  // 2. Verifica Diesel S500
  const s500Idx = currentList.findIndex(i => 
    i.id === 'prod_diesel_s500' ||
    i.id === CANONICAL_FUEL_PROD_UUIDS.S500 ||
    (i.name && i.name.toLowerCase().includes('diesel s500')) ||
    (i.nome_comercial && i.nome_comercial.toLowerCase().includes('diesel s500'))
  );

  if (s500Idx >= 0) {
    const existing = currentList[s500Idx];
    const effectiveQty = extractProductQty(existing);
    const effectiveCost = extractProductCost(existing, 5.60);
    const effectiveSale = extractProductSale(existing);
    const validId = STORAGE_UUID_REGEX.test(String(existing.id || '')) ? existing.id : CANONICAL_FUEL_PROD_UUIDS.S500;

    currentList[s500Idx] = {
      ...existing,
      id: validId,
      name: 'Diesel S500',
      nome_comercial: 'Diesel S500',
      category: 'Combustível & Arla',
      categoria: 'Combustível & Arla',
      unit: 'L',
      unidade_medida: 'L',
      quantity: effectiveQty,
      quantidade_atual: effectiveQty,
      unitCost: effectiveCost,
      preco_custo_inicial: effectiveCost,
      custo_nominal: effectiveCost,
      salePrice: effectiveSale,
      preco_venda_varejo: effectiveSale,
      preco_venda: effectiveSale,
      location: existing.localizacao_fisica || existing.location || 'Tanque Fazenda (Oficina)',
      localizacao_fisica: existing.localizacao_fisica || existing.location || 'Tanque Fazenda (Oficina)',
      capacidade_total: existing.capacidade_total || (tankS500?.capacidade_total || 10000),
    };
  } else {
    const insertPos = currentList.findIndex(i => i.name === 'Diesel S10') + 1;
    currentList.splice(insertPos > 0 ? insertPos : 1, 0, {
      id: CANONICAL_FUEL_PROD_UUIDS.S500,
      code: 'COMB-S500',
      codigo_produto: 'COMB-S500',
      barcode: '',
      codigo_barras: '',
      name: 'Diesel S500',
      nome: 'Diesel S500',
      nome_comercial: 'Diesel S500',
      category: 'Combustível & Arla',
      categoria: 'Combustível & Arla',
      quantity: 0,
      quantidade_atual: 0,
      unit: 'L',
      unidade_medida: 'L',
      minQuantity: 1500,
      unitCost: 5.60,
      preco_custo_inicial: 5.60,
      custo_nominal: 5.60,
      salePrice: 0,
      preco_venda_varejo: 0,
      preco_venda: 0,
      profitMargin: 0,
      location: 'Tanque Fazenda (Oficina)',
      localizacao_fisica: 'Tanque Fazenda (Oficina)',
      capacidade_total: tankS500?.capacidade_total || 10000,
    } as any);
  }

  // Helper para distinguir Arla Galão 20L (Almoxarifado) vs Arla Granel/Litro (Tanque 1000L)
  const isGalaoItem = (i: InventoryItem) => {
    const idStr = String(i.id || '').toLowerCase();
    const codeStr = String(i.code || i.codigo_produto || '').toLowerCase();
    const fullName = `${i.nome_comercial || ''} ${i.name || ''} ${i.nome || ''}`.toLowerCase();
    if (fullName.includes('granel') || fullName.includes('litro') || idStr.includes('granel') || codeStr.includes('granel')) {
      return false;
    }
    return (
      idStr === 'prod_arla_32_galao_20l' ||
      idStr === CANONICAL_FUEL_PROD_UUIDS.ARLA_GALAO ||
      idStr.includes('galao') ||
      codeStr.includes('gal') ||
      (fullName.includes('arla') && (fullName.includes('galão') || fullName.includes('galao') || fullName.includes('20l') || fullName.includes('20 l') || fullName.includes('bombona')))
    );
  };

  // 3. Verifica 'Arla 32 (Granel/Litro)' - Vinculado ao Tanque Arla 32 (1.000L)
  const arlaGranelIdx = currentList.findIndex(i => {
    if (isGalaoItem(i)) return false;
    const idStr = String(i.id || '').toLowerCase();
    const fullName = `${i.nome_comercial || ''} ${i.name || ''} ${i.nome || ''}`.toLowerCase();
    return idStr === 'prod_arla_32_granel' || idStr === 'prod_arla_32' || idStr === CANONICAL_FUEL_PROD_UUIDS.ARLA_GRANEL || fullName.includes('arla');
  });

  if (arlaGranelIdx >= 0) {
    const existing = currentList[arlaGranelIdx];
    const effectiveQty = extractProductQty(existing);
    const effectiveCost = extractProductCost(existing, 3.20);
    const effectiveSale = extractProductSale(existing);
    const safeGranelId = (STORAGE_UUID_REGEX.test(String(existing.id || '')) && existing.id !== CANONICAL_FUEL_PROD_UUIDS.ARLA_GALAO)
      ? existing.id
      : CANONICAL_FUEL_PROD_UUIDS.ARLA_GRANEL;

    currentList[arlaGranelIdx] = {
      ...existing,
      id: safeGranelId,
      name: 'Arla 32 (Granel/Litro)',
      nome: 'Arla 32 (Granel/Litro)',
      nome_comercial: 'Arla 32 (Granel/Litro)',
      category: 'Combustível & Arla',
      categoria: 'Combustível & Arla',
      unit: 'L',
      unidade_medida: 'L',
      quantity: effectiveQty,
      quantidade_atual: effectiveQty,
      unitCost: effectiveCost,
      preco_custo_inicial: effectiveCost,
      custo_nominal: effectiveCost,
      salePrice: effectiveSale,
      preco_venda_varejo: effectiveSale,
      preco_venda: effectiveSale,
      location: existing.localizacao_fisica || existing.location || 'Tanque Arla (Barracão)',
      localizacao_fisica: existing.localizacao_fisica || existing.location || 'Tanque Arla (Barracão)',
      capacidade_total: existing.capacidade_total || (tankArla?.capacidade_total || 1000),
    };
  } else {
    const insertPos = currentList.findIndex(i => i.name === 'Diesel S500') + 1;
    currentList.splice(insertPos > 0 ? insertPos : currentList.length, 0, {
      id: CANONICAL_FUEL_PROD_UUIDS.ARLA_GRANEL,
      code: 'ARLA-GRANEL',
      codigo_produto: 'ARLA-GRANEL',
      barcode: '',
      codigo_barras: '',
      name: 'Arla 32 (Granel/Litro)',
      nome: 'Arla 32 (Granel/Litro)',
      nome_comercial: 'Arla 32 (Granel/Litro)',
      category: 'Combustível & Arla',
      categoria: 'Combustível & Arla',
      quantity: 0,
      quantidade_atual: 0,
      unit: 'L',
      unidade_medida: 'L',
      minQuantity: 100,
      unitCost: 3.20,
      preco_custo_inicial: 3.20,
      custo_nominal: 3.20,
      salePrice: 0,
      preco_venda_varejo: 0,
      preco_venda: 0,
      profitMargin: 0,
      location: 'Tanque Arla (Barracão)',
      localizacao_fisica: 'Tanque Arla (Barracão)',
      capacidade_total: tankArla?.capacidade_total || 1000,
    } as any);
  }

  // Re-localiza o índice do Arla Granel após eventual inserção
  const finalGranelIdx = currentList.findIndex(i => (i.nome_comercial || i.name) === 'Arla 32 (Granel/Litro)');
  const granelId = finalGranelIdx >= 0 ? currentList[finalGranelIdx].id : CANONICAL_FUEL_PROD_UUIDS.ARLA_GRANEL;

  // 4. Verifica 'Arla 32 (Galão 20L)' - Vinculado ao Almoxarifado Principal (por unidade)
  const arlaGalaoIdx = currentList.findIndex((i, idx) => idx !== finalGranelIdx && isGalaoItem(i));

  if (arlaGalaoIdx >= 0) {
    const existing = currentList[arlaGalaoIdx];
    const effectiveGalaoQty = extractProductQty(existing);
    const effectiveGalaoCost = extractProductCost(existing, 65.00);
    const effectiveGalaoSale = extractProductSale(existing);
    const safeGalaoId = (STORAGE_UUID_REGEX.test(String(existing.id || '')) && existing.id !== granelId)
      ? existing.id
      : CANONICAL_FUEL_PROD_UUIDS.ARLA_GALAO;
    currentList[arlaGalaoIdx] = {
      ...existing,
      id: safeGalaoId,
      name: 'Arla 32 (Galão 20L)',
      nome: 'Arla 32 (Galão 20L)',
      nome_comercial: 'Arla 32 (Galão 20L)',
      category: 'Combustível & Arla',
      categoria: 'Combustível & Arla',
      unit: 'un',
      unidade_medida: 'un',
      gallonSizeLiters: existing.gallonSizeLiters || 20,
      volume_litros_embalagem: existing.volume_litros_embalagem || 20,
      quantity: effectiveGalaoQty,
      quantidade_atual: effectiveGalaoQty,
      unitCost: effectiveGalaoCost,
      preco_custo_inicial: effectiveGalaoCost,
      custo_nominal: effectiveGalaoCost,
      salePrice: effectiveGalaoSale,
      preco_venda_varejo: effectiveGalaoSale,
      preco_venda: effectiveGalaoSale,
      location: existing.location || 'Almoxarifado Principal',
      localizacao_fisica: existing.localizacao_fisica || existing.location || 'Almoxarifado Principal',
    };
  } else {
    currentList.push({
      id: CANONICAL_FUEL_PROD_UUIDS.ARLA_GALAO,
      code: 'ARLA-GAL20L',
      codigo_produto: 'ARLA-GAL20L',
      barcode: '',
      codigo_barras: '',
      name: 'Arla 32 (Galão 20L)',
      nome: 'Arla 32 (Galão 20L)',
      nome_comercial: 'Arla 32 (Galão 20L)',
      category: 'Combustível & Arla',
      categoria: 'Combustível & Arla',
      quantity: 0,
      quantidade_atual: 0,
      unit: 'un',
      unidade_medida: 'un',
      minQuantity: 5,
      unitCost: 65.00,
      preco_custo_inicial: 65.00,
      custo_nominal: 65.00,
      salePrice: 0,
      preco_venda_varejo: 0,
      preco_venda: 0,
      profitMargin: 0,
      gallonSizeLiters: 20,
      volume_litros_embalagem: 20,
      location: 'Almoxarifado Principal',
    } as any);
  }

  return currentList;
}

export const ensureFuelAndArlaProductsInInventory = ensureDieselProductsInInventory;

export function getStoredInventory(): InventoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.INVENTORY);
    if (!raw) return ensureDieselProductsInInventory(INITIAL_INVENTORY);
    const parsed = JSON.parse(raw);
    return ensureDieselProductsInInventory(Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_INVENTORY);
  } catch (e) {
    return ensureDieselProductsInInventory(INITIAL_INVENTORY);
  }
}

export function saveStoredInventory(items: InventoryItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(items));
  } catch (e) {
    console.error('Failed to save inventory', e);
  }
}

/**
 * Higienização estrita de ordens de serviço:
 * Localiza e remove por completo qualquer registro de teste/mock legado,
 * em especial o registro nº '4001' vinculado ao cliente 'JUCA (JUCA SILVA)',
 * equipamento 'TRATOR ESTEIRA - KIKI TRATOR ESTEIRA', '10 h' e 'R$ 3.500,00'.
 */
export function sanitizeServiceOrders(services: ServiceOrder[]): ServiceOrder[] {
  if (!Array.isArray(services)) return [];
  return services.filter((s) => {
    if (!s || typeof s !== 'object') return false;
    const client = (s.clientName || '').toLowerCase();
    const farm = (s.farmName || '').toLowerCase();
    const tractor = (s.tractorName || '').toLowerCase();
    const machinery = (s.machineryAssigned || '').toLowerCase();
    const orderNum = String(s.orderNumber || '').trim();
    const sId = String(s.id || '').trim().toLowerCase();
    const notes = String(s.notes || '').toLowerCase();
    const dateStr = String(s.date || '').trim();

    const isMock =
      client.includes('juca') ||
      farm.includes('juca') ||
      tractor.includes('kiki') ||
      tractor.includes('trotor esteira') ||
      tractor.includes('trator esteira') ||
      machinery.includes('kiki') ||
      machinery.includes('trator esteira') ||
      notes.includes('juca') ||
      notes.includes('kiki') ||
      sId.includes('1790021832494') ||
      sId.includes('4001') ||
      orderNum === '4001' ||
      orderNum === '#4001' ||
      orderNum.includes('4001') ||
      ((dateStr.includes('2026-09-21') || dateStr.includes('21/09/2026')) && 
        (client.includes('juca') || tractor.includes('kiki') || s.tractorHours === 10 || s.totalAmount === 3500)) ||
      ((s.tractorHours === 10 || s.areaQuantity === 10) && (s.totalAmount === 3500 || s.ratePerUnit === 350)) ||
      (orderNum === '#001' && (client.includes('juca') || tractor.includes('kiki') || s.tractorHours === 10 || s.totalAmount === 3500));

    return !isMock;
  });
}

export function getStoredServices(): ServiceOrder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SERVICES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const cleaned = sanitizeServiceOrders(parsed);
    if (cleaned.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch (e) {
    return [];
  }
}

let lastSavedServicesJson = '';

export function saveStoredServices(services: ServiceOrder[]): void {
  try {
    const cleaned = sanitizeServiceOrders(services);
    const json = JSON.stringify(cleaned);
    if (json === lastSavedServicesJson) return;
    lastSavedServicesJson = json;
    localStorage.setItem(STORAGE_KEYS.SERVICES, json);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('silagem_services_updated', { detail: cleaned }));
    }
  } catch (e) {
    console.error('Failed to save services', e);
  }
}

export function getStoredAppointments(): ServiceAppointment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.APPOINTMENTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Higienização de agendamentos de teste/mock legados
    const cleaned = parsed.filter(a => {
      if (!a || typeof a !== 'object') return false;
      const cName = (a.clientName || '').toLowerCase();
      const fName = (a.farmName || '').toLowerCase();
      const machName = (a.primaryMachineryPrefix || a.primaryMachineryModel || '').toLowerCase();
      const isMock = ['santa maria', 'agrícola silveira', 'agricola silveira', 'chácara + oton', 'chacara + oton'].some(fake =>
        cName.includes(fake) || fName.includes(fake) || machName.includes(fake)
      );
      const isMockId = ['appt-initial-01', 'appt-initial-02', 'appt-001', 'appt-002'].includes(a.id);
      return !isMock && !isMockId;
    });
    if (cleaned.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch (e) {
    return [];
  }
}

let lastSavedAppointmentsJson = '';

export function saveStoredAppointments(appointments: ServiceAppointment[]): void {
  try {
    const json = JSON.stringify(appointments);
    if (json === lastSavedAppointmentsJson) return;
    lastSavedAppointmentsJson = json;
    localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, json);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('silagem_appointments_updated', { detail: appointments }));
    }
  } catch (e) {
    console.error('Failed to save appointments', e);
  }
}


export function getStoredFuelLogs(): FuelLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.FUEL_LOGS);
    if (!raw) return INITIAL_FUEL_LOGS;
    return JSON.parse(raw);
  } catch (e) {
    return INITIAL_FUEL_LOGS;
  }
}

export function saveStoredFuelLogs(logs: FuelLog[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.FUEL_LOGS, JSON.stringify(logs));
  } catch (e) {
    console.error('Failed to save fuel logs', e);
  }
}

export function getStoredMaintenanceLogs(): MaintenanceLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MAINTENANCE_LOGS);
    if (raw === null) return INITIAL_MAINTENANCE_LOGS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return INITIAL_MAINTENANCE_LOGS;
    return parsed;
  } catch (e) {
    return INITIAL_MAINTENANCE_LOGS;
  }
}

let lastSavedMaintenanceLogsJson = '';

export function saveStoredMaintenanceLogs(logs: MaintenanceLog[]): void {
  try {
    const json = JSON.stringify(logs);
    if (json === lastSavedMaintenanceLogsJson) return;
    lastSavedMaintenanceLogsJson = json;
    localStorage.setItem(STORAGE_KEYS.MAINTENANCE_LOGS, json);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('silagem_maintenance_updated', { detail: logs }));
    }
  } catch (e) {
    console.error('Failed to save maintenance logs', e);
  }
}

export function getStoredCompanyProfile(): CompanyProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.COMPANY_PROFILE);
    if (!raw) return INITIAL_COMPANY_PROFILE;
    const parsed = JSON.parse(raw);
    const profile = { ...INITIAL_COMPANY_PROFILE, ...parsed };
    // Remove o logotipo padrão do carrinho/trator verde legado ou caminhos 404 de /_upload/ ou /upload/ para manter o perfil limpo
    if (
      profile.logoUrl &&
      (profile.logoUrl.includes('a7f3d0') ||
        profile.logoUrl.includes('15803d') ||
        profile.logoUrl.includes('viewBox="0 0 200 160"') ||
        profile.logoUrl.startsWith('/upload/') ||
        profile.logoUrl.startsWith('/_upload/') ||
        profile.logoUrl.includes('/_upload/') ||
        profile.logoUrl.includes('/upload/'))
    ) {
      profile.logoUrl = '';
    }
    return profile;
  } catch (e) {
    return INITIAL_COMPANY_PROFILE;
  }
}

// Gerenciamento e Cache do company_id resolvido do banco de dados remoto
let memoryDbAuthCompanyId: string | null = null;

export function setDbAuthCompanyId(companyId: string | null): void {
  memoryDbAuthCompanyId = companyId && companyId.trim() ? companyId.trim() : null;
  if (typeof localStorage !== 'undefined') {
    if (companyId && companyId.trim()) {
      localStorage.setItem('supabase_auth_company_id', companyId.trim());
      localStorage.setItem('authenticated_user_company_id', companyId.trim());
    } else {
      localStorage.removeItem('supabase_auth_company_id');
      localStorage.removeItem('authenticated_user_company_id');
    }
  }
}

export function getDbAuthCompanyId(): string | null {
  if (memoryDbAuthCompanyId && memoryDbAuthCompanyId.trim()) {
    return memoryDbAuthCompanyId.trim();
  }
  if (typeof localStorage !== 'undefined') {
    const stored = (localStorage.getItem('supabase_auth_company_id') || localStorage.getItem('authenticated_user_company_id') || '').trim();
    if (stored) return stored;
  }
  return null;
}

/**
 * Limpa o cache estrito de autenticação e impersonação de sessão.
 * NUNCA apaga dados de negócios (clientes, ordens, máquinas, despesas, estoque, serviços).
 * Os dados operacionais pertencem ao assinante e permanecem preservados em disco/localStorage e na nuvem.
 */
export function clearAllAuthSessionCache(): void {
  setDbAuthCompanyId(null);
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('supabase_auth_company_id');
    localStorage.removeItem('authenticated_user_company_id');
    localStorage.removeItem('admin_impersonated_company_id');
    localStorage.removeItem('is_admin_impersonating');
    localStorage.removeItem('impersonated_subscriber_id');
    localStorage.removeItem('impersonated_subscriber_name');
    localStorage.removeItem('impersonated_subscriber_email');
    localStorage.removeItem('impersonated_subscriber_plan');
    localStorage.removeItem('silagem_active_subscriber_id');
    localStorage.removeItem('silagem_active_user_email');
    localStorage.removeItem('silagem_active_subscriber_email');
    localStorage.removeItem('silagem_client_session');
    localStorage.removeItem('current_company_id');
    localStorage.removeItem('user_role');
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('auth_session_cleared'));
    window.dispatchEvent(new CustomEvent('active_company_id_changed', { detail: { companyId: null } }));
  }
}

export const DEFAULT_ACTIVE_SUBSCRIBER_ID = 'e5b34cd7-aab4-4ce2-b5f0-45040c9ee7a4';

/**
 * Retorna o identificador único da empresa (company_id) para sincronização multi-dispositivo.
 * Permite que múltiplos aparelhos e funcionários da mesma fazenda compartilhem os mesmos dados na nuvem.
 * 
 * ORDEM DE PRIORIDADE ESTREITA:
 * 1º: ID de personificação do Admin Master (se aplicável).
 * 2º: O 'company_id' retornado pela consulta do perfil do usuário logado diretamente do banco de dados (Supabase).
 * 3º: Fallbacks estáticos/offline (apenas quando não autenticado).
 */
export function getActiveCompanyId(overrideProfile?: CompanyProfile | null): string {
  try {
    // 1º PRIORIDADE: ID de personificação do Admin Master (se aplicável)
    if (typeof localStorage !== 'undefined') {
      const adminImpersonatedId = (localStorage.getItem('admin_impersonated_company_id') || '').trim();
      if (adminImpersonatedId) {
        return adminImpersonatedId;
      }
      const isAdminImpersonating = localStorage.getItem('is_admin_impersonating') === 'true';
      const impersonatedId = (localStorage.getItem('impersonated_subscriber_id') || '').trim();
      if (isAdminImpersonating && impersonatedId) {
        return impersonatedId;
      }
      const currentCompanyId = (localStorage.getItem('current_company_id') || '').trim();
      if (isAdminImpersonating && currentCompanyId && currentCompanyId !== 'default' && currentCompanyId !== 'company_default_fazenda') {
        return currentCompanyId;
      }
      const impersonatedEmail = (localStorage.getItem('impersonated_subscriber_email') || '').trim().toLowerCase();
      if (isAdminImpersonating && impersonatedEmail && impersonatedEmail.includes('@')) {
        if (impersonatedEmail === 'csilagem@gmail.com') return DEFAULT_ACTIVE_SUBSCRIBER_ID;
        return `company_${impersonatedEmail.replace(/[^a-z0-9]/g, '_')}`;
      }
    }

    // 2º PRIORIDADE: O 'company_id' retornado pela consulta do perfil do usuário logado diretamente do banco de dados (Supabase)
    const dbAuthCompanyId = getDbAuthCompanyId();
    if (dbAuthCompanyId && dbAuthCompanyId.trim() && dbAuthCompanyId !== 'default' && dbAuthCompanyId !== 'company_default_fazenda') {
      return dbAuthCompanyId.trim();
    }

    // Se houver sessão de cliente ativa no navegador e identificador persistido da sessão
    if (typeof localStorage !== 'undefined') {
      const isClientSessionActive = localStorage.getItem('silagem_client_session') === 'active';
      const activeSubId = (localStorage.getItem('silagem_active_subscriber_id') || '').trim();
      if (isClientSessionActive && activeSubId && activeSubId !== 'default' && activeSubId !== 'usr_local' && activeSubId !== 'company_default_fazenda') {
        return activeSubId;
      }
      const curComp = (localStorage.getItem('current_company_id') || '').trim();
      if (curComp && curComp !== 'default' && curComp !== 'company_default_fazenda' && curComp !== 'usr_local') {
        return curComp;
      }
    }

    // Se houver companyId explícito no perfil fornecido como override (se não for default)
    if (overrideProfile?.companyId && overrideProfile.companyId.trim() && overrideProfile.companyId !== 'default' && overrideProfile.companyId !== 'default_company' && overrideProfile.companyId !== 'company_default_fazenda') {
      return overrideProfile.companyId.trim();
    }
    if (overrideProfile?.id && overrideProfile.id.trim() && overrideProfile.id !== 'default' && overrideProfile.id !== 'default_company' && overrideProfile.id !== 'company_default_fazenda') {
      return overrideProfile.id.trim();
    }

    // Se houver e-mail de usuário logado (permanece idêntico em qualquer aparelho para a mesma conta)
    if (typeof localStorage !== 'undefined') {
      const activeUserEmail = (localStorage.getItem('silagem_active_user_email') || localStorage.getItem('silagem_active_subscriber_email') || '').trim().toLowerCase();
      if (activeUserEmail && activeUserEmail.includes('@') && activeUserEmail !== 'usuario@silagem.com') {
        if (activeUserEmail === 'csilagem@gmail.com') return DEFAULT_ACTIVE_SUBSCRIBER_ID;
        return `company_${activeUserEmail.replace(/[^a-z0-9]/g, '_')}`;
      }
    }

    // Fallbacks para modo não-autenticado / demonstração local
    const profile = overrideProfile || getStoredCompanyProfile();
    if (profile?.companyId && profile.companyId.trim() && profile.companyId !== 'default' && profile.companyId !== 'default_company' && profile.companyId !== 'company_default_fazenda') {
      return profile.companyId.trim();
    }
    if (profile?.id && profile.id.trim() && profile.id !== 'default' && profile.id !== 'default_company' && profile.id !== 'company_default_fazenda') {
      return profile.id.trim();
    }
    const email = (profile?.loginEmail || profile?.email || '').trim().toLowerCase();
    if (email && email.includes('@') && email !== 'silagemteste02@gmail.com') {
      if (email === 'csilagem@gmail.com') return DEFAULT_ACTIVE_SUBSCRIBER_ID;
      return `company_${email.replace(/[^a-z0-9]/g, '_')}`;
    }
    if (profile?.cnpjCpf) {
      const clean = profile.cnpjCpf.replace(/\D/g, '');
      if (clean === '46097636000102') return DEFAULT_ACTIVE_SUBSCRIBER_ID;
      if (clean.length >= 8 && clean !== '5787222222') {
        return `company_${clean}`;
      }
    }
  } catch (e) {
    // Fallback silencioso
  }
  // Unificação obrigatória: se nenhuma sessão explícita estiver ativa, unifica no ID do assinante ativo da nuvem
  return DEFAULT_ACTIVE_SUBSCRIBER_ID;
}

export function saveStoredCompanyProfile(profile: CompanyProfile): void {
  try {
    localStorage.setItem(STORAGE_KEYS.COMPANY_PROFILE, JSON.stringify(profile));
  } catch (e) {
    console.error('Failed to save company profile', e);
  }
}

// Dynamic Categories Defaults
export const DEFAULT_SUPPLIER_CATEGORIES = [
  'Combustível & Arla',
  'Peças & Manutenção',
  'Sementes & Insumos',
  'Lonas & Embalagens',
  'Oficinas & Torneamento',
  'Alimentação & Refeições',
  'Arrendamento & Áreas',
  'Serviços Terceirizados',
  'Outros Fornecedores'
];

export const DEFAULT_INVENTORY_CATEGORIES = [
  'Combustível & Arla',
  'Lona & Embalagem',
  'Inoculante & Biológico',
  'Sementes',
  'Adubo & Fertilizante',
  'Peças & Manutenção',
  'Pneus',
  'Outros Insumos'
];

export const DEFAULT_SERVICE_TYPES = [
  'Ensilagem',
  'Colheita',
  'Compactação de Silo',
  'Transporte / Frete',
  'Plantio & Preparo',
  'Pulverização',
  'Trituração de Grão Úmido',
  'Outros Serviços'
];

export const DEFAULT_SILAGE_PRODUCT_TYPES = [
  'Milho Planta Inteira',
  'Milho Grão Úmido',
  'Sorgo Forrageiro',
  'Capiaçu',
  'Aveia / Azevém',
  'Cana com Ureia',
  'Feno / Pré-secado'
];

export const DEFAULT_CATTLE_TYPES = [
  'Gado de Leite',
  'Gado de Corte',
  'Confinamento Intensivo',
  'Pecuária Mista',
  'Ovinos / Caprinos',
  'Outra Atividade'
];

export const DEFAULT_EMPLOYEE_ROLES = [
  'Motorista de Caminhão',
  'Operador de Ensiladeira',
  'Tratorista de Compactação',
  'Tratorista de Corte',
  'Mecânico de Campo',
  'Ajudante Geral / Enlonamento',
  'Gerente Operacional'
];

export const DEFAULT_MACHINERY_TYPES = [
  'Caminhão Caçamba / Basculante',
  'Ensiladeira Autopropelida',
  'Ensiladeira de Arrasto',
  'Trator Agrícola',
  'Carreta / Reboque',
  'Utilitário / Caminhonete',
  'Ônibus / Transporte de Equipe'
];

// Helper helper function
function getStoredList<T = string>(key: string, defaultList: T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultList;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : defaultList;
  } catch {
    return defaultList;
  }
}

function saveStoredList<T = any>(key: string, list: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch (e) {
    console.error('Failed to save list for key ' + key, e);
  }
}

export const getStoredSupplierCategories = () => getStoredList(STORAGE_KEYS.SUPPLIER_CATEGORIES, DEFAULT_SUPPLIER_CATEGORIES);
export const saveStoredSupplierCategories = (list: string[]) => saveStoredList(STORAGE_KEYS.SUPPLIER_CATEGORIES, list);

export const getStoredInventoryCategories = () => {
  const list = getStoredList(STORAGE_KEYS.INVENTORY_CATEGORIES, DEFAULT_INVENTORY_CATEGORIES);
  if (!list.some(c => c.toLowerCase() === 'pneus' || c.toLowerCase() === 'pneu')) {
    return ['Pneus', ...list];
  }
  return list;
};
export const saveStoredInventoryCategories = (list: string[]) => saveStoredList(STORAGE_KEYS.INVENTORY_CATEGORIES, list);

export const getStoredServiceTypes = () => getStoredList(STORAGE_KEYS.SERVICE_TYPES, DEFAULT_SERVICE_TYPES);
export const saveStoredServiceTypes = (list: string[]) => saveStoredList(STORAGE_KEYS.SERVICE_TYPES, list);

export const getStoredSilageProductTypes = () => getStoredList(STORAGE_KEYS.SILAGE_PRODUCT_TYPES, DEFAULT_SILAGE_PRODUCT_TYPES);
export const saveStoredSilageProductTypes = (list: string[]) => saveStoredList(STORAGE_KEYS.SILAGE_PRODUCT_TYPES, list);

export const getStoredCattleTypes = () => getStoredList(STORAGE_KEYS.CATTLE_TYPES, DEFAULT_CATTLE_TYPES);
export const saveStoredCattleTypes = (list: string[]) => saveStoredList(STORAGE_KEYS.CATTLE_TYPES, list);

export const getStoredEmployeeRoles = () => getStoredList(STORAGE_KEYS.EMPLOYEE_ROLES, DEFAULT_EMPLOYEE_ROLES);
export const saveStoredEmployeeRoles = (list: string[]) => saveStoredList(STORAGE_KEYS.EMPLOYEE_ROLES, list);

export const getStoredMachineryTypes = () => getStoredList(STORAGE_KEYS.MACHINERY_TYPES, DEFAULT_MACHINERY_TYPES);
export const saveStoredMachineryTypes = (list: string[]) => saveStoredList(STORAGE_KEYS.MACHINERY_TYPES, list);

export const DEFAULT_VEHICLE_SYSTEM_CATEGORIES = [
  'Ensiladeira Autopropelida',
  'Caminhão (Basculante / Graneleiro)',
  'Trator Agrícola',
  'Reboque',
  'Veículo Utilitário / Apoio',
  'Ônibus / Van de Equipe',
  'Tração Caminhão Trator (Cavalo)',
  'Implemento'
];

export const getStoredVehicleSystemCategories = (): string[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.VEHICLE_SYSTEM_CATEGORIES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.VEHICLE_SYSTEM_CATEGORIES, JSON.stringify(DEFAULT_VEHICLE_SYSTEM_CATEGORIES));
      return DEFAULT_VEHICLE_SYSTEM_CATEGORIES;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(STORAGE_KEYS.VEHICLE_SYSTEM_CATEGORIES, JSON.stringify(DEFAULT_VEHICLE_SYSTEM_CATEGORIES));
      return DEFAULT_VEHICLE_SYSTEM_CATEGORIES;
    }

    // Se a lista gravada for a lista antiga padrão legada, atualiza para o novo padrão
    const legacyOld = [
      'Forrageira / Ensiladeira',
      'Ensiladeira Autopropelida',
      'Caminhão (Basculante / Silagem / Graneleiro)',
      'Trator Agrícola',
      'Transbordo / Reboque / Carreta',
      'Veículo Utilitário / Apoio',
      'Ônibus / Van de Equipe',
      'Outro Equipamento'
    ];
    const isExactLegacy = parsed.length === legacyOld.length && parsed.every(p => legacyOld.includes(p));
    if (isExactLegacy) {
      localStorage.setItem(STORAGE_KEYS.VEHICLE_SYSTEM_CATEGORIES, JSON.stringify(DEFAULT_VEHICLE_SYSTEM_CATEGORIES));
      return DEFAULT_VEHICLE_SYSTEM_CATEGORIES;
    }

    // Garante que todas as categorias padrão obrigatórias existam (seed), preservando categorias personalizadas do usuário
    let updated = [...parsed];
    let changed = false;
    DEFAULT_VEHICLE_SYSTEM_CATEGORIES.forEach(defCat => {
      const exists = updated.some(c => c.trim().toLowerCase() === defCat.trim().toLowerCase());
      if (!exists) {
        updated.push(defCat);
        changed = true;
      }
    });

    if (changed) {
      localStorage.setItem(STORAGE_KEYS.VEHICLE_SYSTEM_CATEGORIES, JSON.stringify(updated));
    }
    return updated;
  } catch (e) {
    console.error('Failed to load vehicle categories', e);
    return DEFAULT_VEHICLE_SYSTEM_CATEGORIES;
  }
};
export const saveStoredVehicleSystemCategories = (list: string[]) => saveStoredList(STORAGE_KEYS.VEHICLE_SYSTEM_CATEGORIES, list);

export const DEFAULT_VEHICLE_OWNERSHIP_REGIMES = [
  'Próprio',
  'De Terceiros',
  'Alugado / Locação',
  'Arrendado / Financiado'
];

export const getStoredVehicleOwnershipRegimes = () => getStoredList(STORAGE_KEYS.VEHICLE_OWNERSHIP_REGIMES, DEFAULT_VEHICLE_OWNERSHIP_REGIMES);
export const saveStoredVehicleOwnershipRegimes = (list: string[]) => saveStoredList(STORAGE_KEYS.VEHICLE_OWNERSHIP_REGIMES, list);

export interface CnhStatusReport {
  expiredCount: number;
  expiringIn60DaysCount: number;
  expiredEmployees: Employee[];
  expiringEmployees: Employee[];
  expired: Employee[];
  expiringSoon: Employee[];
  valid: Employee[];
}

export function checkCnhStatus(employees: Employee[]): CnhStatusReport {
  const today = new Date();
  const in60Days = new Date();
  in60Days.setDate(today.getDate() + 60);

  const expiredEmployees: Employee[] = [];
  const expiringEmployees: Employee[] = [];
  const validEmployees: Employee[] = [];

  employees.forEach((emp) => {
    if (!emp.cnhExpiration) {
      validEmployees.push(emp);
      return;
    }
    const expDate = new Date(emp.cnhExpiration);
    if (isNaN(expDate.getTime())) {
      validEmployees.push(emp);
      return;
    }

    if (expDate < today) {
      expiredEmployees.push(emp);
    } else if (expDate <= in60Days) {
      expiringEmployees.push(emp);
    } else {
      validEmployees.push(emp);
    }
  });

  return {
    expiredCount: expiredEmployees.length,
    expiringIn60DaysCount: expiringEmployees.length,
    expiredEmployees,
    expiringEmployees,
    expired: expiredEmployees,
    expiringSoon: expiringEmployees,
    valid: validEmployees,
  };
}

export interface BackupData {
  version: string;
  exportedAt: string;
  companyProfile?: CompanyProfile;
  expenses: Expense[];
  categories: ExpenseCategory[];
  costCenters: CostCenter[];
  clients: Client[];
  orders: SilageOrder[];
  machineries: Machinery[];
  seasons: CropSeason[];
}

export function exportFullBackup(): string {
  const data: BackupData = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    companyProfile: getStoredCompanyProfile(),
    expenses: getStoredExpenses(),
    categories: getStoredCategories(),
    costCenters: getStoredCostCenters(),
    clients: getStoredClients(),
    orders: getStoredOrders(),
    machineries: getStoredMachineries(),
    seasons: getStoredSeasons(),
  };
  return JSON.stringify(data, null, 2);
}

export function importFullBackup(jsonString: string): { success: boolean; message: string; count?: number } {
  try {
    const parsed = JSON.parse(jsonString);
    if (parsed.companyProfile) {
      saveStoredCompanyProfile(parsed.companyProfile);
    }
    if (parsed.expenses && Array.isArray(parsed.expenses)) {
      saveStoredExpenses(parsed.expenses);
    }
    if (parsed.categories && Array.isArray(parsed.categories)) {
      saveStoredCategories(parsed.categories);
    }
    if (parsed.costCenters && Array.isArray(parsed.costCenters)) {
      saveStoredCostCenters(parsed.costCenters);
    }
    if (parsed.clients && Array.isArray(parsed.clients)) {
      saveStoredClients(parsed.clients);
    }
    if (parsed.orders && Array.isArray(parsed.orders)) {
      saveStoredOrders(parsed.orders);
    }
    if (parsed.machineries && Array.isArray(parsed.machineries)) {
      saveStoredMachineries(parsed.machineries);
    }
    if (parsed.seasons && Array.isArray(parsed.seasons)) {
      saveStoredSeasons(parsed.seasons);
    }
    return {
      success: true,
      message: 'Dados importados com sucesso!',
      count: (parsed.expenses?.length || 0) + (parsed.clients?.length || 0),
    };
  } catch (err: any) {
    return {
      success: false,
      message: 'Erro ao processar JSON: ' + (err.message || 'Formato inválido'),
    };
  }
}

export function getStoredBankAccounts(): BankAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BANK_ACCOUNTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    const cId = getActiveCompanyId();
    const rawColacaScoped = localStorage.getItem(`colaca_silagem_financeiro_contas_${cId}`);
    if (rawColacaScoped) {
      const parsed = JSON.parse(rawColacaScoped);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    const rawColacaGlobal = localStorage.getItem('colaca_silagem_financeiro_contas');
    if (rawColacaGlobal) {
      const parsed = JSON.parse(rawColacaGlobal);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    return INITIAL_BANK_ACCOUNTS;
  } catch (e) {
    return INITIAL_BANK_ACCOUNTS;
  }
}

export function saveStoredBankAccounts(accounts: BankAccount[]): void {
  try {
    const json = JSON.stringify(accounts);
    localStorage.setItem(STORAGE_KEYS.BANK_ACCOUNTS, json);
    const cId = getActiveCompanyId();
    localStorage.setItem(`colaca_silagem_financeiro_contas_${cId}`, json);
    localStorage.setItem('colaca_silagem_financeiro_contas', json);
    saveCompanyData('financeiro_contas', accounts, cId);
  } catch (e) {
    console.error('Failed to save bank accounts', e);
  }
}

export function getStoredBankTransactions(): BankTransaction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BANK_TRANSACTIONS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

export function saveStoredBankTransactions(transactions: BankTransaction[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.BANK_TRANSACTIONS, JSON.stringify(transactions));
  } catch (e) {
    console.error('Failed to save bank transactions', e);
  }
}

export function getStoredSettlements(): ThirdPartySettlement[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTLEMENTS);
    if (!raw) return INITIAL_SETTLEMENTS;
    return JSON.parse(raw);
  } catch (e) {
    return INITIAL_SETTLEMENTS;
  }
}

let lastSavedSettlementsJson = '';

export function saveStoredSettlements(settlements: ThirdPartySettlement[]): void {
  try {
    const json = JSON.stringify(settlements);
    if (json === lastSavedSettlementsJson) return;
    lastSavedSettlementsJson = json;
    localStorage.setItem(STORAGE_KEYS.SETTLEMENTS, json);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('silagem_settlements_updated', { detail: settlements }));
    }
  } catch (e) {
    console.error('Failed to save settlements', e);
  }
}

export function getStoredBrokerSettlements(): BrokerSettlement[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BROKER_SETTLEMENTS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

export function saveStoredBrokerSettlements(settlements: BrokerSettlement[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.BROKER_SETTLEMENTS, JSON.stringify(settlements));
  } catch (e) {
    console.error('Failed to save broker settlements', e);
  }
}

// RH: Payrolls
export function getStoredPayrolls(): PayrollRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PAYROLLS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

export function saveStoredPayrolls(payrolls: PayrollRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PAYROLLS, JSON.stringify(payrolls));
  } catch (e) {
    console.error('Failed to save payrolls', e);
  }
}

// RH: Vacations
export const DEFAULT_INITIAL_VACATIONS: VacationRecord[] = [];

export function getStoredVacations(): VacationRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.VACATIONS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(v => v && v.id !== 'vac_alisson_pag_01' && v.employeeId !== 'ab80e2fa-5094-43b3-83bf-c34047bf1b42');
  } catch (e) {
    return [];
  }
}

export function saveStoredVacations(vacations: VacationRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.VACATIONS, JSON.stringify(vacations));
  } catch (e) {
    console.error('Failed to save vacations', e);
  }
}

// RH: Leaves
export function getStoredLeaves(): LeaveRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LEAVES);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

export function saveStoredLeaves(leaves: LeaveRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.LEAVES, JSON.stringify(leaves));
  } catch (e) {
    console.error('Failed to save leaves', e);
  }
}

// RH: Salary Advances
export function getStoredSalaryAdvances(): SalaryAdvance[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SALARY_ADVANCES);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

export function saveStoredSalaryAdvances(advances: SalaryAdvance[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SALARY_ADVANCES, JSON.stringify(advances));
  } catch (e) {
    console.error('Failed to save salary advances', e);
  }
}

// RH: Medical Certificates (Atestados)
export function getStoredMedicalCertificates(): MedicalCertificateRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MEDICAL_CERTIFICATES);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

export function saveStoredMedicalCertificates(certificates: MedicalCertificateRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.MEDICAL_CERTIFICATES, JSON.stringify(certificates));
  } catch (e) {
    console.error('Failed to save medical certificates', e);
  }
}

// RH: Absences (Faltas)
export function getStoredAbsences(): AbsenceRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ABSENCES);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

export function saveStoredAbsences(absences: AbsenceRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ABSENCES, JSON.stringify(absences));
  } catch (e) {
    console.error('Failed to save absences', e);
  }
}

// RH: Terminations (Rescisões)
export function getStoredTerminations(): TerminationRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TERMINATIONS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

let lastSavedTerminationsJson = '';

export function saveStoredTerminations(terminations: TerminationRecord[]): void {
  try {
    const json = JSON.stringify(terminations);
    if (json === lastSavedTerminationsJson) return;
    lastSavedTerminationsJson = json;
    localStorage.setItem(STORAGE_KEYS.TERMINATIONS, json);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('silagem_terminations_updated', { detail: terminations }));
    }
  } catch (e) {
    console.error('Failed to save terminations', e);
  }
}

// ==========================================
// VEÍCULOS & TIPOS DE EIXOS / RODÍZIO DE PNEUS
// ==========================================

export function getStoredVehicleTypes(): VehicleTypeDefinition[] {
  try {
    const raw = localStorage.getItem('colaca_silagem_tipos_veiculos') || localStorage.getItem(STORAGE_KEYS.VEHICLE_TYPES);
    if (!raw) return INITIAL_VEHICLE_TYPES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return INITIAL_VEHICLE_TYPES;
    return parsed;
  } catch (e) {
    console.error('Failed to load vehicle types', e);
    return INITIAL_VEHICLE_TYPES;
  }
}

export function saveStoredVehicleTypes(types: VehicleTypeDefinition[]): void {
  try {
    localStorage.setItem('colaca_silagem_tipos_veiculos', JSON.stringify(types));
    localStorage.setItem(STORAGE_KEYS.VEHICLE_TYPES, JSON.stringify(types));
  } catch (e) {
    console.error('Failed to save vehicle types', e);
  }
}

export { 
  getStoredAxleConfigurations, 
  saveStoredAxleConfigurations, 
  type StoredAxleConfigOption 
};

export function getStoredTireRotationLogs(): TireRotationLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TIRE_ROTATION_LOGS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load tire rotation logs', e);
    return [];
  }
}

export function saveStoredTireRotationLogs(logs: TireRotationLog[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.TIRE_ROTATION_LOGS, JSON.stringify(logs));
  } catch (e) {
    console.error('Failed to save tire rotation logs', e);
  }
}

export function getStoredTireInventory(): TireItem[] {
  try {
    let raw = localStorage.getItem('colaca_silagem_frotas_pneus_estoque');
    if (!raw) {
      raw = localStorage.getItem(STORAGE_KEYS.TIRE_INVENTORY);
    }
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(t => 
      t && 
      !['#0329', '#0294', '0329', '0294'].includes(t.fireNumber) &&
      !(t.model && ['X Multi Z', 'G:81', 'KMAX'].some(m => (t.model || '').toLowerCase().includes(m.toLowerCase()))) &&
      !t.id?.includes('mock')
    );
  } catch (e) {
    console.error('Failed to load tire inventory', e);
    return [];
  }
}

export function saveStoredTireInventory(items: TireItem[]): void {
  try {
    const json = JSON.stringify(items);
    localStorage.setItem(STORAGE_KEYS.TIRE_INVENTORY, json);
    localStorage.setItem('colaca_silagem_frotas_pneus_estoque', json);
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('silagem_tire_inventory_updated', { detail: items }));
      }, 0);
    }
  } catch (e) {
    console.error('Failed to save tire inventory', e);
  }
}

export function getStoredTiresInReform(): TireItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TIRES_IN_REFORM);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(t => 
      t && 
      !['#0329', '#0294', '0329', '0294'].includes(t.fireNumber) &&
      !t.id?.includes('mock')
    );
  } catch (e) {
    console.error('Failed to load tires in reform', e);
    return [];
  }
}

export function saveStoredTiresInReform(items: TireItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.TIRES_IN_REFORM, JSON.stringify(items));
  } catch (e) {
    console.error('Failed to save tires in reform', e);
  }
}

export function getStoredTiresDiscarded(): TireItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TIRES_DISCARDED);
    if (!raw) return INITIAL_TIRES_DISCARDED;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return INITIAL_TIRES_DISCARDED;
    return parsed;
  } catch (e) {
    console.error('Failed to load discarded tires', e);
    return INITIAL_TIRES_DISCARDED;
  }
}

export function saveStoredTiresDiscarded(items: TireItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.TIRES_DISCARDED, JSON.stringify(items));
  } catch (e) {
    console.error('Failed to save discarded tires', e);
  }
}

export function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value || 0);
}

export function formatDateBR(dateStr?: string): string {
  if (!dateStr) return '-';
  try {
    const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const parts = cleanDate.split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      if (year.length === 4) {
        return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
      }
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
}

export function getStoredPurchaseRequests(): MaintenancePurchaseRequest[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MAINTENANCE_PURCHASE_REQUESTS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load purchase requests', e);
    return [];
  }
}

export function saveStoredPurchaseRequests(requests: MaintenancePurchaseRequest[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.MAINTENANCE_PURCHASE_REQUESTS, JSON.stringify(requests));
  } catch (e) {
    console.error('Failed to save purchase requests', e);
  }
}

export const INITIAL_MAINTENANCE_CATEGORIES: MaintenanceCategoryDefinition[] = [
  { id: 'cat_arrefecimento_radiador', name: 'Arrefecimento & Radiador', description: 'Limpeza de colmeia de radiador, mangotes, bomba d’água e válvula termostática', color: '#0891b2', isSystem: true },
  { id: 'cat_diferencial_cardan', name: 'Diferencial & Cardan', description: 'Cruzetas, rolamentos de centro, coroa e pinhão', color: '#7c2d12', isSystem: true },
  { id: 'cat_eletrica_ar', name: 'Elétrica & Ar-Condicionado', description: 'Alternador, motor de partida, chicotes elétricos e recarga de gás', color: '#ca8a04', isSystem: true },
  { id: 'cat_facas_rotor', name: 'Facas & Contra-Faca (Ensiladeira)', description: 'Afiação, regulagem e substituição de facas, contra-faca e fundo de rotor', color: '#16a34a', isSystem: true },
  { id: 'cat_freios_embreagem', name: 'Freios & Embreagem', description: 'Pastilhas, lonas, cuícas de freio e atuadores de embreagem', color: '#9333ea', isSystem: true },
  { id: 'cat_injecao_bomba', name: 'Injeção & Bomba Injetora', description: 'Bicos injetores, bomba de alta pressão, filtros sedimentadores e sensores', color: '#b45309', isSystem: true },
  { id: 'cat_lubrificacao', name: 'Lubrificação & Engraxamento', description: 'Engraxamento geral de pinos, buchas e mancais', color: '#475569', isSystem: true },
  { id: 'cat_motor_transmissao', name: 'Motor & Transmissão (Câmbio)', description: 'Revisão e reparo de motor, embreagem, caixa e cardan', color: '#dc2626', isSystem: true },
  { id: 'cat_outro', name: 'Outro (Personalizado)', description: 'Serviços diversos e específicos', color: '#64748b', isSystem: true },
  { id: 'cat_plataforma_craqueador', name: 'Plataforma & Craqueador', description: 'Rolos quebradores de grãos, correntes recolhedoras e navalhas', color: '#059669', isSystem: true },
  { id: 'cat_pneus_rodas', name: 'Pneus, Rodas & Esteiras', description: 'Calibragem, conserto de furos, recapagem e alinhamento', color: '#ea580c', isSystem: true },
  { id: 'cat_revisao_entressafra', name: 'Revisão (entressafra)', description: 'Revisão geral completa realizada durante o período de entressafra', color: '#1e40af', isSystem: true },
  { id: 'cat_sistema_hidraulico', name: 'Sistema Hidráulico & Mangueiras', description: 'Cilindros, comandos, bombas hidráulicas e prensagem de mangueiras', color: '#2563eb', isSystem: true },
  { id: 'cat_solda_estrutura', name: 'Solda, Funilaria & Estrutura', description: 'Reforços de chassi, soldas em plataformas, caçambas e implementos', color: '#4f46e5', isSystem: true },
  { id: 'cat_suspensao_direcao', name: 'Suspensão & Direção', description: 'Molas, barras de direção, pivôs, terminais e amortecedores', color: '#0d9488', isSystem: true },
  { id: 'cat_oleo_filtros', name: 'Troca de Óleo & Filtros', description: 'Trocas periódicas de óleo de motor, transmissão, hidráulico e filtros', color: '#0284c7', isSystem: true },
];

export function getStoredMaintenanceCategories(): MaintenanceCategoryDefinition[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MAINTENANCE_CATEGORIES);
    let list: MaintenanceCategoryDefinition[] = [...INITIAL_MAINTENANCE_CATEGORIES];
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        list = parsed;
      }
    }
    // Garantir que a opção "Revisão (entressafra)" esteja presente mesmo com dados anteriores no localStorage
    const hasRevisaoEntressafra = list.some(
      c => c.name?.toLowerCase().trim() === 'revisão (entressafra)' || c.name?.toLowerCase().trim() === 'revisao (entressafra)'
    );
    if (!hasRevisaoEntressafra) {
      list.push({
        id: 'cat_revisao_entressafra',
        name: 'Revisão (entressafra)',
        description: 'Revisão geral completa realizada durante o período de entressafra',
        color: '#1e40af',
        isSystem: true
      });
    }
    // Ordenar estritamente em ordem alfabética
    return list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' }));
  } catch (e) {
    console.error('Failed to load maintenance categories', e);
    return [...INITIAL_MAINTENANCE_CATEGORIES].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' }));
  }
}

export function saveStoredMaintenanceCategories(categories: MaintenanceCategoryDefinition[]): void {
  try {
    const sorted = [...categories].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' }));
    localStorage.setItem(STORAGE_KEYS.MAINTENANCE_CATEGORIES, JSON.stringify(sorted));
  } catch (e) {
    console.error('Failed to save maintenance categories', e);
  }
}

// -------------------------------------------------------------
// SUBMISSÕES DE FORMULÁRIOS DE CAMPO (MODO OPERADOR EXTERNO)
// -------------------------------------------------------------
export interface FieldFormSubmission {
  id: string;
  appointmentId?: string;
  appointmentNumber?: string;
  formType: 'corte' | 'compactacao' | 'cargas';
  submittedAt: string;
  clientName: string;
  operatorOrDriver: string;
  machineryOrVehicle: string;
  formData: any;
  summaryText: string;
}

export const getStoredFieldSubmissions = (): FieldFormSubmission[] => {
  return getStoredList<FieldFormSubmission>('silagem_field_submissions', []);
};

export const saveStoredFieldSubmissions = (submissions: FieldFormSubmission[]): void => {
  saveStoredList('silagem_field_submissions', submissions);
};

export const addStoredFieldSubmission = (submission: FieldFormSubmission): void => {
  const current = getStoredFieldSubmissions();
  saveStoredFieldSubmissions([submission, ...current]);
};

export const updateAppointmentFieldReturn = (
  appointmentNumberOrId: string, 
  formType: 'corte' | 'compactacao' | 'cargas', 
  summary: string
): void => {
  try {
    const list = getStoredAppointments();
    const updated = list.map(appt => {
      if (appt.appointmentNumber === appointmentNumberOrId || appt.id === appointmentNumberOrId) {
        const timeNow = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const prefix = `\n[Retorno ${formType.toUpperCase()} às ${timeNow}]: ${summary}`;
        return {
          ...appt,
          fieldNotes: appt.fieldNotes ? `${appt.fieldNotes}${prefix}` : prefix.trim(),
        };
      }
      return appt;
    });
    saveStoredAppointments(updated);
  } catch (e) {
    console.error('Failed to update appointment field return', e);
  }
};

// -------------------------------------------------------------
// DOCUMENTOS DE ENTRADA (MÓDULO NOTAS & ENTRADAS MANUAIS)
// -------------------------------------------------------------
const STORAGE_KEY_DOCUMENTOS_ENTRADA = 'silagem_facil_documentos_entrada_v1';

export const getStoredDocumentosEntrada = (): DocumentoEntradaRecord[] => {
  return getStoredList<DocumentoEntradaRecord>(STORAGE_KEY_DOCUMENTOS_ENTRADA, []);
};

export const saveStoredDocumentosEntrada = (docs: DocumentoEntradaRecord[]): void => {
  saveStoredList(STORAGE_KEY_DOCUMENTOS_ENTRADA, docs);
};

export const saveLocalDocumentoEntrada = (doc: DocumentoEntradaRecord): void => {
  const current = getStoredDocumentosEntrada();
  const filtered = current.filter(d => d.id !== doc.id);
  saveStoredDocumentosEntrada([doc, ...filtered]);
};

export const deleteLocalDocumentoEntrada = (id: string): void => {
  const current = getStoredDocumentosEntrada();
  saveStoredDocumentosEntrada(current.filter(d => d.id !== id));
};

const STORAGE_KEY_DOCUMENTOS_ENTRADA_ITENS = 'silagem_facil_documentos_entrada_itens_v1';

export const getStoredDocumentosEntradaItens = (documentoEntradaId?: string): DocumentoEntradaItem[] => {
  const all = getStoredList<DocumentoEntradaItem>(STORAGE_KEY_DOCUMENTOS_ENTRADA_ITENS, []);
  if (documentoEntradaId) {
    return all.filter(i => i.documento_entrada_id === documentoEntradaId);
  }
  return all;
};

export const saveStoredDocumentosEntradaItens = (items: DocumentoEntradaItem[]): void => {
  saveStoredList(STORAGE_KEY_DOCUMENTOS_ENTRADA_ITENS, items);
};

export const saveLocalDocumentoEntradaItem = (item: DocumentoEntradaItem): void => {
  const all = getStoredDocumentosEntradaItens();
  const filtered = all.filter(i => i.id !== item.id);
  saveStoredDocumentosEntradaItens([item, ...filtered]);
};

export const deleteLocalDocumentoEntradaItem = (id: string): void => {
  const all = getStoredDocumentosEntradaItens();
  saveStoredDocumentosEntradaItens(all.filter(i => i.id !== id));
};

// ==========================================
// TIPOS DE DOCUMENTOS DE ENTRADA MANUAL
// ==========================================

export const DEFAULT_MANUAL_ENTRY_DOCUMENT_TYPES: string[] = [
  'Romaneio',
  'Nota avulsa',
  'Cupom sem valor fiscal',
  'Nota de Produtor',
  'Outros'
];

export function getStoredManualEntryDocumentTypes(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MANUAL_ENTRY_DOCUMENT_TYPES);
    if (!raw) return [...DEFAULT_MANUAL_ENTRY_DOCUMENT_TYPES];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return [...DEFAULT_MANUAL_ENTRY_DOCUMENT_TYPES];
    // Remove permanentemente a opção 'Recibo' e strings vazias
    const filtered: string[] = parsed
      .map((t: unknown) => (typeof t === 'string' ? t.trim() : ''))
      .filter((t: string) => t !== '' && t !== 'Recibo');

    // Garante que todas as opções padrão do sistema estejam presentes
    DEFAULT_MANUAL_ENTRY_DOCUMENT_TYPES.forEach(def => {
      if (!filtered.includes(def)) {
        filtered.push(def);
      }
    });

    return filtered.length > 0 ? filtered : [...DEFAULT_MANUAL_ENTRY_DOCUMENT_TYPES];
  } catch (e) {
    console.error('Failed to load manual entry document types', e);
    return [...DEFAULT_MANUAL_ENTRY_DOCUMENT_TYPES];
  }
}

export function saveStoredManualEntryDocumentTypes(types: string[]): void {
  try {
    const clean = types
      .map(t => (typeof t === 'string' ? t.trim() : ''))
      .filter(t => t !== '' && t !== 'Recibo');
    // Salva a lista sem duplicados
    const unique = Array.from(new Set(clean));
    localStorage.setItem(STORAGE_KEYS.MANUAL_ENTRY_DOCUMENT_TYPES, JSON.stringify(unique));
  } catch (e) {
    console.error('Failed to save manual entry document types', e);
  }
}

export function getLastDayOfMonth(year: number, monthIndex0: number): string {
  // O dia 0 do mês seguinte é exatamente o último dia do mês atual na API nativa Date do JavaScript
  const lastDate = new Date(year, monthIndex0 + 1, 0);
  const y = lastDate.getFullYear();
  const m = String(lastDate.getMonth() + 1).padStart(2, '0');
  const d = String(lastDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function calculateDefaultDueDate(dateStr?: string, days = 30): string {
  try {
    if (!dateStr) {
      const now = new Date();
      now.setDate(now.getDate() + days);
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const dayStr = String(now.getDate()).padStart(2, '0');
      return `${y}-${m}-${dayStr}`;
    }
    const [year, month, day] = dateStr.split('-').map(Number);
    // Valida dia dentro do mês de origem para evitar overflow de dias
    const maxDaysInOrigin = new Date(year, month, 0).getDate();
    const safeDay = Math.min(day || 1, maxDaysInOrigin);
    const d = new Date(year, month - 1, safeDay);
    d.setDate(d.getDate() + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dayStr = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dayStr}`;
  } catch {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dayStr = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dayStr}`;
  }
}

// ==============================================================================
// GESTÃO LOCAL DE CHEQUES E CRÉDITOS DE CLIENTES
// ==============================================================================
export function getStoredFinanceiroCheques(): FinanceiroCheque[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.FINANCEIRO_CHEQUES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Erro ao ler cheques do storage local:', e);
    return [];
  }
}

let lastSavedChequesJson = '';

export function saveStoredFinanceiroCheques(cheques: FinanceiroCheque[]): void {
  try {
    const json = JSON.stringify(cheques);
    if (json === lastSavedChequesJson) return;
    lastSavedChequesJson = json;
    localStorage.setItem(STORAGE_KEYS.FINANCEIRO_CHEQUES, json);
  } catch (e) {
    console.error('Erro ao salvar cheques no storage local:', e);
  }
}

export function getStoredClienteCreditos(): ClienteCredito[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CLIENTE_CREDITOS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Erro ao ler créditos do cliente no storage local:', e);
    return [];
  }
}

export function saveStoredClienteCreditos(creditos: ClienteCredito[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CLIENTE_CREDITOS, JSON.stringify(creditos));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('silagem_cliente_creditos_updated', { detail: creditos }));
    }
  } catch (e) {
    console.error('Erro ao salvar créditos do cliente no storage local:', e);
  }
}

// ==============================================================================
// MODO OFFLINE / CONTINGÊNCIA 100% LOCAL (LOCALSTORAGE RESILIENTE POR EMPRESA)
// Chaves estritas no padrão: 'colaca_silagem_<tabela>' e 'colaca_silagem_<tabela>_<companyId>'
// ==============================================================================

export function getCompanyStorageKey(entity: string, companyId?: string): string {
  const cId = (companyId || getActiveCompanyId() || 'default').trim();
  return `colaca_silagem_${entity}_${cId}`;
}

export function saveCompanyData<T>(entity: string, data: T[], companyId?: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const cId = (companyId || getActiveCompanyId() || 'default').trim();
    const json = JSON.stringify(data);
    localStorage.setItem(`colaca_silagem_${entity}_${cId}`, json);
    localStorage.setItem(`colaca_silagem_${entity}`, json);
    window.dispatchEvent(new CustomEvent('silagem_local_offline_sync', { detail: { entity, companyId: cId } }));
  } catch (e) {
    console.error(`Erro ao gravar dados locais em colaca_silagem_${entity}:`, e);
  }
}

export function getCompanyData<T>(entity: string, fallbackGetter?: () => T[], companyId?: string): T[] {
  if (typeof window === 'undefined' || !window.localStorage) return fallbackGetter ? fallbackGetter() : [];
  try {
    const cId = (companyId || getActiveCompanyId() || 'default').trim();
    const rawScoped = localStorage.getItem(`colaca_silagem_${entity}_${cId}`);
    if (rawScoped) {
      const parsed = JSON.parse(rawScoped);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    const rawGlobal = localStorage.getItem(`colaca_silagem_${entity}`);
    if (rawGlobal) {
      const parsed = JSON.parse(rawGlobal);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    return fallbackGetter ? fallbackGetter() : [];
  } catch (e) {
    return fallbackGetter ? fallbackGetter() : [];
  }
}

// Entidades específicas com vinculação imediata à memória local do PC:
export const saveCompanyFrotas = (frotas: Machinery[], companyId?: string): void => {
  saveCompanyData('frotas', frotas, companyId);
  try { localStorage.setItem(STORAGE_KEYS.MACHINERIES, JSON.stringify(frotas)); } catch {}
};
export const getCompanyFrotas = (companyId?: string): Machinery[] => getCompanyData<Machinery>('frotas', getStoredMachineries, companyId);

export const saveCompanyFuncionarios = (funcionarios: Employee[], companyId?: string): void => {
  saveCompanyData('funcionarios', funcionarios, companyId);
  try { localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(funcionarios)); } catch {}
};
export const getCompanyFuncionarios = (companyId?: string): Employee[] => getCompanyData<Employee>('funcionarios', getStoredEmployees, companyId);

export const saveCompanyRhFolhas = (folhas: PayrollRecord[], companyId?: string): void => {
  saveCompanyData('rh_folhas', folhas, companyId);
  try { localStorage.setItem(STORAGE_KEYS.PAYROLLS, JSON.stringify(folhas)); } catch {}
};
export const getCompanyRhFolhas = (companyId?: string): PayrollRecord[] => getCompanyData<PayrollRecord>('rh_folhas', getStoredPayrolls, companyId);

export const saveCompanyRhFaltas = (faltas: AbsenceRecord[], companyId?: string): void => {
  saveCompanyData('rh_faltas', faltas, companyId);
  try { localStorage.setItem(STORAGE_KEYS.ABSENCES, JSON.stringify(faltas)); } catch {}
};
export const getCompanyRhFaltas = (companyId?: string): AbsenceRecord[] => getCompanyData<AbsenceRecord>('rh_faltas', getStoredAbsences, companyId);

export const saveCompanyRhFerias = (ferias: VacationRecord[], companyId?: string): void => {
  saveCompanyData('rh_ferias', ferias, companyId);
  try { localStorage.setItem(STORAGE_KEYS.VACATIONS, JSON.stringify(ferias)); } catch {}
};
export const getCompanyRhFerias = (companyId?: string): VacationRecord[] => getCompanyData<VacationRecord>('rh_ferias', getStoredVacations, companyId);

export const saveCompanyFornecedores = (fornecedores: Supplier[], companyId?: string): void => {
  saveCompanyData('fornecedores', fornecedores, companyId);
  try { localStorage.setItem(STORAGE_KEYS.SUPPLIERS, JSON.stringify(fornecedores)); } catch {}
};
export const getCompanyFornecedores = (companyId?: string): Supplier[] => getCompanyData<Supplier>('fornecedores', getStoredSuppliers, companyId);

export const saveCompanyClientes = (clientes: Client[], companyId?: string): void => {
  saveCompanyData('clientes', clientes, companyId);
  try { localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(clientes)); } catch {}
};
export const getCompanyClientes = (companyId?: string): Client[] => getCompanyData<Client>('clientes', getStoredClients, companyId);

export const saveCompanyDespesas = (despesas: Expense[], companyId?: string): void => {
  saveCompanyData('despesas', despesas, companyId);
  try { localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(despesas)); } catch {}
};
export const getCompanyDespesas = (companyId?: string): Expense[] => getCompanyData<Expense>('despesas', getStoredExpenses, companyId);

export const saveCompanyServicos = (servicos: ServiceOrder[], companyId?: string): void => {
  saveCompanyData('servicos', servicos, companyId);
  try { localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(servicos)); } catch {}
};
export const getCompanyServicos = (companyId?: string): ServiceOrder[] => getCompanyData<ServiceOrder>('servicos', getStoredServices, companyId);

export const saveCompanyEstoque = (itens: InventoryItem[], companyId?: string): void => {
  saveCompanyData('estoque', itens, companyId);
  try { localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(itens)); } catch {}
};
export const getCompanyEstoque = (companyId?: string): InventoryItem[] => getCompanyData<InventoryItem>('estoque', getStoredInventory, companyId);

export const saveCompanyAbastecimentos = (logs: FuelLog[], companyId?: string): void => {
  saveCompanyData('abastecimentos', logs, companyId);
  try { localStorage.setItem(STORAGE_KEYS.FUEL_LOGS, JSON.stringify(logs)); } catch {}
};
export const getCompanyAbastecimentos = (companyId?: string): FuelLog[] => getCompanyData<FuelLog>('abastecimentos', getStoredFuelLogs, companyId);

export const saveCompanyManutencoes = (manutencoes: MaintenanceLog[], companyId?: string): void => {
  saveCompanyData('manutencoes', manutencoes, companyId);
  try { localStorage.setItem(STORAGE_KEYS.MAINTENANCE_LOGS, JSON.stringify(manutencoes)); } catch {}
};
export const getCompanyManutencoes = (companyId?: string): MaintenanceLog[] => getCompanyData<MaintenanceLog>('manutencoes', getStoredMaintenanceLogs, companyId);

export const saveCompanyFinanceiroContas = (contas: BankAccount[], companyId?: string): void => {
  saveCompanyData('financeiro_contas', contas, companyId);
  try {
    const json = JSON.stringify(contas);
    localStorage.setItem(STORAGE_KEYS.BANK_ACCOUNTS, json);
    const cId = (companyId || getActiveCompanyId() || 'default').trim();
    localStorage.setItem(`colaca_silagem_financeiro_contas_${cId}`, json);
    localStorage.setItem('colaca_silagem_financeiro_contas', json);
  } catch {}
};
export const getCompanyFinanceiroContas = (companyId?: string): BankAccount[] => getCompanyData<BankAccount>('financeiro_contas', getStoredBankAccounts, companyId);




