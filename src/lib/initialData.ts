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
  corporateName: '',
  tradeName: '',
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
  activitySector: '',
  logoUrl: '',
};

export const INITIAL_CATEGORIES: ExpenseCategory[] = [
  {
    id: 'cat_administrativo',
    name: 'ADMINISTRATIVO',
    color: '#475569',
    icon: 'Briefcase',
    description: 'Despesas de escritório, taxas, software e rotina administrativa',
  },
  {
    id: 'cat_alimentacao',
    name: 'ALIMENTAÇÃO',
    color: '#ea580c',
    icon: 'Utensils',
    description: 'Marmitas, refeições da equipe, café e água em campo',
  },
  {
    id: 'cat_arrendamento',
    name: 'ARRENDAMENTO',
    color: '#854d0e',
    icon: 'MapPin',
    description: 'Arrendamento de terras, pastos e áreas agrícolas',
  },
  {
    id: 'cat_borracharia',
    name: 'BORRACHARIA',
    color: '#334155',
    icon: 'CircleDot',
    description: 'Conserto de pneus, vulcanização e socorro borracheiro de frota',
  },
  {
    id: 'cat_comercial',
    name: 'COMERCIAL',
    color: '#2563eb',
    icon: 'ShoppingBag',
    description: 'Visitas técnicas, vendas, prospecção e representação comercial',
  },
  {
    id: 'cat_combustivel',
    name: 'COMBUSTÍVEL, ARLA / DIESEL',
    color: '#d97706',
    icon: 'Fuel',
    description: 'Óleo diesel S10, S500, Arla 32 e combustíveis para frota',
  },
  {
    id: 'cat_diarias',
    name: 'DIÁRIAS',
    color: '#0891b2',
    icon: 'Calendar',
    description: 'Diárias de campo, ajudantes avulsos e hospedagem operacional',
  },
  {
    id: 'cat_eletrica',
    name: 'ELÉTRICA',
    color: '#eab308',
    icon: 'Zap',
    description: 'Alternadores, baterias, chicotes, arranques e iluminação de máquinas',
  },
  {
    id: 'cat_embalagens',
    name: 'EMBALAGENS',
    color: '#0d9488',
    icon: 'Layers',
    description: 'Lonas para silo, fitas de vedação e sacos de ensilagem',
  },
  {
    id: 'cat_ferramentas',
    name: 'FERRAMENTAS',
    color: '#64748b',
    icon: 'Wrench',
    description: 'Ferramentas de bancada, chaves, solda e instrumentos de oficina',
  },
  {
    id: 'cat_frete',
    name: 'FRETE',
    color: '#7c3aed',
    icon: 'Truck',
    description: 'Transporte rodoviário de silagem, máquinas ou insumos',
  },
  {
    id: 'cat_insumos',
    name: 'INSUMOS AGRÍCOLAS',
    color: '#16a34a',
    icon: 'Sprout',
    description: 'Sementes, adubos, defensivos e inoculantes bacterianos',
  },
  {
    id: 'cat_manutencao',
    name: 'MANUTENÇÃO',
    color: '#dc2626',
    icon: 'Wrench',
    description: 'Manutenção preventiva, corretiva e mecânica pesada de frotas',
  },
  {
    id: 'cat_mao_de_obra',
    name: 'MÃO DE OBRA',
    color: '#0284c7',
    icon: 'Users',
    description: 'Salários de operadores, encargos e contratações operacionais',
  },
  {
    id: 'cat_outros',
    name: 'OUTRAS DESPESAS',
    color: '#6b7280',
    icon: 'CircleDot',
    description: 'Despesas eventuais e miudezas não classificadas',
  },
  {
    id: 'cat_pecas',
    name: 'PEÇAS',
    color: '#b91c1c',
    icon: 'Settings',
    description: 'Facas de ensiladeira, correias, rolamentos, filtros e peças de reposição',
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
export const INITIAL_INVENTORY: InventoryItem[] = [];
export const INITIAL_SERVICES: ServiceOrder[] = [];
export const INITIAL_FUEL_LOGS: FuelLog[] = [];
export const INITIAL_MAINTENANCE_LOGS: MaintenanceLog[] = [];
export const INITIAL_EXPENSES: Expense[] = [];
export const INITIAL_CLIENTS: Client[] = [];
export const INITIAL_ORDERS: SilageOrder[] = [];
export const INITIAL_BANK_ACCOUNTS: BankAccount[] = [];
export const INITIAL_SETTLEMENTS: ThirdPartySettlement[] = [];
