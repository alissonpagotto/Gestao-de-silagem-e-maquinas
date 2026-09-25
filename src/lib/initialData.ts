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

export const DEFAULT_FORAGE_HARVESTER_LOGO = '';

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
  logoUrl: '',
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

export const INITIAL_SEASONS: CropSeason[] = [];

// Clean Zeroed Arrays for Manual Entry
export const INITIAL_MACHINERIES: Machinery[] = [];
export const INITIAL_EMPLOYEES: Employee[] = [];
export const INITIAL_FLEET_TEAMS: FleetTeam[] = [];
export const INITIAL_SUPPLIERS: Supplier[] = [];
export const INITIAL_INVENTORY: InventoryItem[] = [
  {
    id: 'prod_diesel_s10',
    code: 'COMB-S10',
    name: 'Diesel S10',
    nome: 'Diesel S10',
    nome_comercial: 'Diesel S10',
    category: 'Combustível & Arla',
    categoria: 'Combustível & Arla',
    quantity: 11200,
    quantidade_atual: 11200,
    unit: 'L',
    unidade_medida: 'L',
    minQuantity: 2000,
    unitCost: 5.85,
    preco_custo_inicial: 5.85,
    custo_nominal: 5.85,
    salePrice: 6.50,
    preco_venda_varejo: 6.50,
    preco_venda: 6.50,
    profitMargin: 11.1,
    location: 'Tanque Fazenda (Pátio Central)',
  },
  {
    id: 'prod_diesel_s500',
    code: 'COMB-S500',
    name: 'Diesel S500',
    nome: 'Diesel S500',
    nome_comercial: 'Diesel S500',
    category: 'Combustível & Arla',
    categoria: 'Combustível & Arla',
    quantity: 6500,
    quantidade_atual: 6500,
    unit: 'L',
    unidade_medida: 'L',
    minQuantity: 1500,
    unitCost: 5.60,
    preco_custo_inicial: 5.60,
    custo_nominal: 5.60,
    salePrice: 6.20,
    preco_venda_varejo: 6.20,
    preco_venda: 6.20,
    profitMargin: 10.7,
    location: 'Tanque Fazenda (Oficina)',
  }
];
export const INITIAL_SERVICES: ServiceOrder[] = [];
export const INITIAL_FUEL_LOGS: FuelLog[] = [];
export const INITIAL_MAINTENANCE_LOGS: MaintenanceLog[] = [];
export const INITIAL_EXPENSES: Expense[] = [];
export const INITIAL_CLIENTS: Client[] = [];
export const INITIAL_ORDERS: SilageOrder[] = [];
export const INITIAL_BANK_ACCOUNTS: BankAccount[] = [];
export const INITIAL_SETTLEMENTS: ThirdPartySettlement[] = [];
