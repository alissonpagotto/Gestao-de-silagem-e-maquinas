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
  ThirdPartySettlement
} from '../types';

export const DEFAULT_FORAGE_HARVESTER_LOGO = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160" width="200" height="160"><rect width="200" height="160" rx="16" fill="%23a7f3d0"/><path d="M40 100 L75 45 L135 45 L165 75 L165 110 L40 110 Z" fill="%2315803d"/><path d="M75 45 L125 45 L145 75 L75 75 Z" fill="%2386efac" opacity="0.6"/><path d="M125 45 L155 20 L165 22 L135 50 Z" fill="%23ca8a04"/><circle cx="65" cy="115" r="24" fill="%231c1917" stroke="%23dc2626" stroke-width="4"/><circle cx="65" cy="115" r="10" fill="%23f8fafc"/><circle cx="145" cy="120" r="18" fill="%231c1917" stroke="%23dc2626" stroke-width="3"/><circle cx="145" cy="120" r="8" fill="%23f8fafc"/><path d="M15 95 L40 110 L25 125 L10 110 Z" fill="%23ca8a04"/><path d="M20 90 L35 90 L30 120 L15 120 Z" fill="%2316a34a"/></svg>`;

export const INITIAL_COMPANY_PROFILE: CompanyProfile = {
  corporateName: 'Silagem Fácil',
  tradeName: 'Gestão de Silagem',
  cnpjCpf: '',
  stateRegistration: '',
  phone: '',
  email: '',
  loginEmail: '',
  zipCode: '',
  address: '',
  number: '',
  neighborhood: '',
  city: '',
  state: 'PR',
  activitySector: 'GESTÃO AGRÍCOLA',
  logoUrl: DEFAULT_FORAGE_HARVESTER_LOGO,
};

export const INITIAL_CATEGORIES: ExpenseCategory[] = [
  {
    id: 'cat_combustivel',
    name: 'Combustível & Arla (Diesel)',
    color: '#d97706',
    icon: 'Fuel',
    description: 'Óleo diesel S10, S500 e aditivos para tratores e caminhões',
  },
  {
    id: 'cat_manutencao',
    name: 'Manutenção & Peças',
    color: '#dc2626',
    icon: 'Wrench',
    description: 'Reparos em ensiladeiras, facas, contra-facas, correias, filtros e mecânica',
  },
  {
    id: 'cat_insumos',
    name: 'Insumos Agrícolas',
    color: '#16a34a',
    icon: 'Sprout',
    description: 'Sementes de milho/sorgo, adubos, defensivos, inoculante bacteriano e lona',
  },
  {
    id: 'cat_mao_de_obra',
    name: 'Mão de Obra & Diárias',
    color: '#0284c7',
    icon: 'Users',
    description: 'Operadores de trator, diaristas de colheita/compactação, encargos e folha',
  },
  {
    id: 'cat_frete',
    name: 'Frete & Logística',
    color: '#7c3aed',
    icon: 'Truck',
    description: 'Transporte de silagem da lavoura ao silo ou entrega ao cliente',
  },
  {
    id: 'cat_alimentacao',
    name: 'Alimentação & Campo',
    color: '#ea580c',
    icon: 'Utensils',
    description: 'Marmitas, café, água e suporte à equipe em campo durante o corte',
  },
  {
    id: 'cat_lona_embalagem',
    name: 'Lona, Fita & Embalagens',
    color: '#0d9488',
    icon: 'Layers',
    description: 'Lonas dupla face 200 micras, fita adesiva de vedação e sacos de silagem',
  },
  {
    id: 'cat_arrendamento',
    name: 'Arrendamento & Terra',
    color: '#854d0e',
    icon: 'MapPin',
    description: 'Aluguel de terras para plantio de silagem e taxas rurais',
  },
  {
    id: 'cat_administrativo',
    name: 'Administrativo & Comercial',
    color: '#475569',
    icon: 'Briefcase',
    description: 'Despesas de escritório, software, visitas a clientes, telefonia e consultoria',
  },
  {
    id: 'cat_outros',
    name: 'Outras Despesas',
    color: '#6b7280',
    icon: 'CircleDot',
    description: 'Despesas eventuais e miudezas da operação',
  },
];

export const INITIAL_COST_CENTERS: CostCenter[] = [
  {
    id: 'cc_colheita',
    name: 'Frente de Colheita / Ensiladeiras',
    type: 'maquinario',
  },
  {
    id: 'cc_transporte',
    name: 'Transporte & Caminhões',
    type: 'maquinario',
  },
  {
    id: 'cc_compactacao',
    name: 'Compactação & Fechamento de Silo',
    type: 'maquinario',
  },
  {
    id: 'cc_oficina',
    name: 'Oficina & Manutenção Geral',
    type: 'geral',
  },
  {
    id: 'cc_administrativo',
    name: 'Administração & Base Operacional',
    type: 'geral',
  },
];

export const INITIAL_SEASONS: CropSeason[] = [
  {
    id: 'season_2026_2027',
    name: 'Safra 2026/2027',
    crop: 'Milho Silagem',
    plantedHectares: 0,
    estimatedTons: 0,
    status: 'colheita',
    startDate: '2026-08-01',
    endDate: '2027-07-31',
  }
];

// Clean Zeroed Arrays for Manual Entry
export const INITIAL_MACHINERIES: Machinery[] = [];
export const INITIAL_EMPLOYEES: Employee[] = [];
export const INITIAL_FLEET_TEAMS: FleetTeam[] = [];
export const INITIAL_SUPPLIERS: Supplier[] = [];
export const INITIAL_INVENTORY: InventoryItem[] = [];
export const INITIAL_SERVICES: ServiceOrder[] = [];
export const INITIAL_FUEL_LOGS: FuelLog[] = [];
export const INITIAL_MAINTENANCE_LOGS: MaintenanceLog[] = [];
export const INITIAL_EXPENSES: Expense[] = [];
export const INITIAL_CLIENTS: Client[] = [];
export const INITIAL_ORDERS: SilageOrder[] = [];
export const INITIAL_BANK_ACCOUNTS: BankAccount[] = [];
export const INITIAL_SETTLEMENTS: ThirdPartySettlement[] = [];
