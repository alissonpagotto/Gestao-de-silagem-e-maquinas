export interface CompanyProfile {
  companyId?: string; // ID da Empresa para sincronização multi-dispositivo
  corporateName: string; // Razão Social (ex: silagemteste02)
  tradeName: string; // Nome Fantasia (ex: Silagem Teste 02)
  cnpjCpf: string; // CNPJ / CPF (ex: 578.722.222-2)
  stateRegistration?: string; // Inscrição Estadual
  phone: string; // Telefone de Contato (ex: (22) 22222-2888)
  email: string; // E-mail Comercial (ex: silagemteste02@gmail.com)
  loginEmail?: string; // E-mail de Login
  zipCode: string; // CEP (ex: 85680-000)
  address: string; // Endereço (ex: sem estrada)
  number: string; // Número (ex: sn)
  neighborhood: string; // Bairro (ex: sem bairro)
  city: string; // Cidade (ex: Boa Esperança do Iguaçu)
  state: string; // Estado UF (ex: PR)
  logoUrl?: string; // Logotipo da Empresa (data URL or image URL)
  activitySector?: string; // GESTÃO AGRÍCOLA
  representativeName?: string; // Nome do Representante Responsável
  representativeCpf?: string; // CPF do Representante Responsável
  bankName?: string; // Nome do Banco
  bankAgency?: string; // Agência
  bankAccount?: string; // Conta Corrente
  pixKeyType?: 'cnpj' | 'cpf' | 'email' | 'telefone' | 'aleatoria' | string; // Tipo de Chave PIX
  pixKey?: string; // Chave PIX
}

export type ExpenseStatus = 'pago' | 'pendente' | 'atrasado' | 'agendado';

export type PaymentMethod = 
  | 'pix' 
  | 'boleto' 
  | 'cartao_credito' 
  | 'cartao_debito' 
  | 'transferencia' 
  | 'dinheiro' 
  | 'safra_prazo';

export interface ExpenseCategory {
  id: string;
  name: string;
  color: string;
  icon?: string;
  description?: string;
  isCustom?: boolean;
}

export interface CostCenter {
  id: string;
  name: string;
  type: 'safra' | 'maquinario' | 'talhao' | 'instalacao' | 'geral';
}

export interface Expense {
  id: string;
  companyId?: string; // ID da Empresa
  description: string;
  amount: number;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  dueDate: string; // YYYY-MM-DD
  paymentDate?: string; // YYYY-MM-DD
  status: ExpenseStatus;
  paymentMethod: PaymentMethod;
  supplier: string;
  costCenterId?: string;
  costCenterName?: string;
  machineryId?: string;
  machineryName?: string;
  employeeId?: string;
  employeeName?: string;
  teamId?: string;
  teamName?: string;
  employeeApportionment?: string;
  invoiceNumber?: string;
  receiptUrl?: string; // Data URL or filename
  receiptName?: string;
  notes?: string;
  quantity?: number;
  unit?: string; // 'litros', 'horas', 'unidades', 'sc', 'kg', etc.
  unitPrice?: number;
  nfeItems?: any[]; // Array completo de itens/sub-produtos da NF-e (cProd, xProd, qCom, vUnCom, vProd, etc.)
  isRecurring?: boolean;
  accessKey?: string;
  installmentsCount?: number;
  expenseIds?: string[];
  paidByEmployeeId?: string; // ID do funcionário que realizou o pagamento
  paidByEmployeeName?: string; // Nome do funcionário que realizou o pagamento
  bankAccountId?: string; // ID da conta bancária de onde o saldo foi debitado
  bankAccountName?: string; // Nome da conta bancária debitada
  creditSupplier?: string; // Fornecedor / Instituição do Crédito informada na baixa
  corporateCardId?: string; // ID do cartão corporativo vinculado
  corporateCardName?: string; // Nome/Identificador do cartão corporativo
  paymentAuthenticationCode?: string; // Código de autenticação / comprovante
  date?: string; // YYYY-MM-DD (compatibilidade)
  createdAt: string;
}

export interface Client {
  id: string;
  companyId?: string; // ID da Empresa
  name: string;
  farmName: string;
  cpfCnpj?: string;
  stateRegistration?: string;
  zipCode?: string;
  address?: string;
  neighborhood?: string;
  city: string;
  state: string;
  phone: string;
  email?: string;
  areaHectares?: number;
  accessRoute?: string;
  cattleType: 'leite' | 'corte' | 'misto' | 'confinamento' | 'outro';
  headCount?: number;
  monthlyDemandTons?: number;
  status: 'lead' | 'contatado' | 'proposta' | 'cliente_ativo' | 'inativo';
  notes?: string;
  totalPurchasedTons?: number;
  totalSpent?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface ClientFormSubmission {
  id: string;
  name: string;
  farmName: string;
  cpfCnpj?: string;
  stateRegistration?: string;
  phone: string;
  email?: string;
  zipCode?: string;
  address?: string;
  neighborhood?: string;
  city: string;
  state: string;
  cattleType: 'leite' | 'corte' | 'misto' | 'confinamento' | 'outro';
  headCount?: number;
  monthlyDemandTons?: number;
  notes?: string;
  submittedAt: string;
  status: 'pendente' | 'importado';
}

export interface SilageOrder {
  id: string;
  orderNumber?: string;
  clientId: string;
  clientName: string;
  farmName: string;
  productType: 'Milho Grão Úmido' | 'Milho Planta Inteira' | 'Sorgo Forrageiro' | 'Capiaçu' | 'Aveia / Azevém';
  tons: number;
  pricePerTon: number;
  totalAmount: number;
  deliveryDate: string;
  freightType: 'CIF' | 'FOB';
  freightCost?: number;
  status: 'orcamento' | 'confirmado' | 'em_entrega' | 'entregue' | 'cancelado';
  paymentStatus: 'pendente' | 'parcial' | 'pago';
  machineryId?: string;
  machineryPlateOrName?: string;
  driverId?: string;
  driverName?: string;
  notes?: string;
  createdAt: string;
}

export interface Machinery {
  id: string;
  companyId?: string; // ID da Empresa
  name: string;
  model: string;
  brand: string;
  year?: number;
  renavam?: string; // RENAVAM
  color?: string; // Cor do veículo
  fleetNumber?: string; // Nº da Frota / Prefixo / Código Interno
  ownership?: 'proprio' | 'terceirizado' | 'alugado' | 'arrendado' | string; // Propriedade / Regime
  capacityM3?: number; // Capacidade de Carga / Caçamba em m³
  hourMeter?: number; // Horímetro atual
  currentKm?: number; // Odômetro KM atual
  averageConsumptionLitersPerHour?: number; // Média de consumo calculada em Litros/Hora (L/h)
  averageConsumptionKmPerLiter?: number; // Média de consumo calculada em Km/Litro (km/L)
  licensePlateOrSerial?: string;
  status: 'operacional' | 'em_manutencao' | 'parado' | 'disponivel';
  lastMaintenanceDate?: string;
  operatorOrDriver?: string; // Responsável / Motoristas (texto compilado para compatibilidade)
  assignedDriverIds?: string[]; // IDs dos motoristas/operadores vinculados da lista de funcionários
  assignedDrivers?: string[]; // Nomes dos motoristas/operadores vinculados
  revisionStatus?: string; // Revisão
  reaisNotes?: string;
  accumulatedCost?: number; // Acumulado R$
  categoryType?: 'caminhao' | 'ensiladeira' | 'forrageira' | 'trator' | 'onibus' | 'utilitario' | 'reboque' | 'outro' | string;
  fuelCapacityLiters?: number;
  currentFuelPercentage?: number;
  purchaseDate?: string;
  notes?: string;
  totalFuelExpenses?: number;
  totalMaintenanceExpenses?: number;
  vehicleTypeId?: string;
  customAxleConfig?: VehicleAxleConfig;
  installedTires?: TireItem[];
  lastTireRotationDate?: string;
  lastTireRotationKm?: number;
  lastTireRotationHourMeter?: number;

  // Composição e Vínculo de Reboque
  compositionType?: 'veiculo_simples' | 'cavalo' | 'reboque' | 'outro'; // 'Cavalo', 'Reboque', 'Veículo Simples'
  hasCoupledTrailer?: boolean; // Este veículo possui reboque vinculado?
  trailerPlate?: string; // Placa do Reboque
  trailerModel?: string; // Modelo do Reboque
  coupledTrailerType?: string; // Tipo de Reboque acoplado (ex: Caçamba, Graneleiro, Silagem, Basculante, Baú)
  trailerType?: string; // Tipo de Reboque quando o veículo é Reboque (Prancha, Baú, Graneleiro, Basculante, Sider)
  trailerAxlesCount?: number; // Quantidade de Eixos do reboque
  trailerCapacityLoadKg?: number; // Capacidade de Carga do Reboque (kg)
  trailerCapacityM3?: number; // Capacidade Volumétrica do Reboque (m³)
  coupledTrailerId?: string; // ID do reboque engatado (quando selecionado)
  coupledTrailerName?: string; // Placa / Identificação do reboque engatado (compatibilidade)
  vehicleTypeDetailed?: string; // Truck, Bi-trem, Rodotrem, Cavalo Mecânico, etc.

  // Controle de Peso
  taraWeightKg?: number; // Tara (kg) - Peso do veículo vazio
  capacityLoadKg?: number; // Lotação (kg) - Capacidade de carga útil máxima
  grossWeightKg?: number; // PBT (kg) - Peso Bruto Total = Tara + Lotação

  // Identificação e Série (focado em tratores e ensiladeiras sem RENAVAM)
  serialNumber?: string; // Nº de Série do Chassi / Fabricante (totalmente editável)

  // Propriedade & No Nome de Quem
  ownerName?: string; // Razão Social / Nome de quem está no documento
  ownerDocument?: string; // CNPJ ou CPF do titular do documento
  secondaryOwnerName?: string; // Segundo Proprietário / Sócio (se houver)
  secondaryOwnerDocument?: string; // CNPJ ou CPF do segundo titular

  // Controle de Compra, Nota Fiscal e Financiamento
  purchaseInvoiceNumber?: string; // Número da Nota Fiscal de Compra
  purchaseInvoiceKey?: string; // Chave de Acesso da NF-e
  purchaseValue?: number; // Valor de Compra do Veículo (R$)
  purchaseSupplier?: string; // Fornecedor / Concessionária / Vendedor
  purchaseInvoiceAttachment?: { name: string; url?: string; uploadedAt?: string };
  isFinancedOrInstallments?: boolean; // Compra parcelada / Financiamento
  installmentsCount?: number; // Quantidade de parcelas
  installmentValue?: number; // Valor de cada parcela (R$)
  firstInstallmentDueDate?: string; // Data de vencimento da 1ª parcela
  financialInstitution?: string; // Banco ou Instituição Financeira
  installmentsGenerated?: boolean; // Indicador se as parcelas já foram incluídas no Contas a Pagar
  purchaseInstallmentRows?: any[]; // Linhas detalhadas de parcelas confirmadas no modal de compra/financiamento
  purchaseInstallmentIntervalDays?: number; // Intervalo de dias selecionado (ex: 30 = Mensal, 90 = Trimestral, 180 = Semestral, 365 = Anual)

  // 4. Controle Patrimonial, Impostos & Taxas (FIPE, IPVA & Licenciamento)
  fipeValue?: number; // Valor Comercial Tabela FIPE (R$)
  ipvaBaseValue?: number; // Valor Base para IPVA (R$) (Valor Venal)
  ipvaRatePercent?: number; // Alíquota IPVA (%) (Ex: 1%, 2%, 4%)
  ipvaTotalAmount?: number; // Valor Total IPVA (R$) = Valor Base * (Alíquota / 100)
  ipvaInstallmentsCount?: number; // Qtd. Parcelas IPVA (1 a 5)
  ipvaFinancialStatus?: 'pendente' | 'lancado'; // Status de lançamento no Contas a Pagar
  ipvaLastLaunchDate?: string; // Data do último lançamento automático no Contas a Pagar
  ipvaExpenseIds?: string[]; // IDs das despesas geradas no Contas a Pagar
  licensingValue?: number; // Valor do Licenciamento Anual (R$)
  licensingFinancialStatus?: 'pendente' | 'lancado'; // Status de lançamento no Contas a Pagar
  licensingLastLaunchDate?: string; // Data do último lançamento automático no Contas a Pagar
  licensingExpenseId?: string; // ID da despesa gerada no Contas a Pagar
}

export interface EmployeeAttachment {
  name: string;
  url?: string;
  fileData?: string; // base64 or object URL
  uploadedAt?: string;
  size?: number;
}

export type EmployeeRole = 
  | 'Administrador'
  | 'Agenciador'
  | 'Auxiliar de produção'
  | 'Escritorio'
  | 'Financeiro'
  | 'Mecanico'
  | 'Mecanico especialista'
  | 'Mecanico interno'
  | 'Motorista'
  | 'Operador de Forrageira'
  | 'Operador de maquinas'
  | 'Operador de trator'
  | 'Recepcionista'
  | 'Operador de Ensiladeira'
  | 'Operador de forrageira'
  | 'Tratorista'
  | 'Motorista de Caminhão'
  | 'Auxiliar'
  | 'Mecanico Especialista'
  | 'mecanico_especialista'
  | 'Mecânico'
  | string;

export type Cargo = EmployeeRole;

export type EmployeeRegistrationType = 
  | 'Agenciador'
  | 'Auxiliar'
  | 'Diarista / Safrista'
  | 'Funcionário' 
  | 'Mecanico Especialista'
  | 'Motorista Terceirizado'
  | 'Prestador de Serviço' 
  | 'Motorista' 
  | 'mecanico_especialista' 
  | string;

export interface Employee {
  id: string;
  companyId?: string; // ID da Empresa
  name: string;
  registrationType?: EmployeeRegistrationType;
  role: EmployeeRole | string; // 'Operador de Ensiladeira', 'Tratorista', 'Motorista de Caminhão', 'Mecânico', etc.
  roles?: string[]; // Array de múltiplos cargos selecionados (suporte a multi-select)
  cpf?: string;
  rg?: string; // Número do RG
  birthDate?: string; // Data de Nascimento
  pis?: string; // Número do PIS
  photoUrl?: string; // Foto de perfil
  phone: string;
  baseSalary?: number; // Salário Base (R$)
  contractType?: 'Registrado (CLT)' | 'Diarista / Safrista' | 'PJ / Prestador de Serviço' | 'Autônomo' | 'Comissionado' | string;
  admissionDate?: string; // Data de Admissão
  terminationDate?: string; // Data de Demissão
  active?: boolean; // Funcionário ativo (toggle)
  receivesCommission?: boolean; // Recebe comissão (toggle)
  commissionPerHour?: number; // Por hora (R$/h)
  commissionPerAlqueire?: number; // Por alqueire (R$/alq)
  commissionPerHectare?: number; // Por hectare (R$/ha)
  brokerCommissionType?: 'Porcentagem (%) sobre o valor do pedido' | 'Porcentagem (%) sobre a produção' | 'Valor Fixo por contrato/pedido' | string; // Tipo de comissão do agenciador
  brokerCommissionValue?: number; // Valor/Percentual da comissão do agenciador
  actingRegion?: string; // Região de Atuação (específico para Agenciador)
  cnhNumber?: string;
  cnhCategory?: string; // 'A', 'B', 'C', 'D', 'E', 'AB', 'AC', 'AD', 'AE'
  cnhExpiration?: string; // YYYY-MM-DD
  cnhUpgradeDT?: boolean; // Opção para "Melhorar categoria (DT)"
  cnhUpgradeCategory?: string; // Ex: 'A', 'A + C', 'A + D', 'A + E', 'C', 'D', 'E'
  status: 'ativo' | 'ferias' | 'afastado' | 'inativo';
  salary?: number;
  teamId?: string; // ID da equipe à qual pertence (ex: 'team_maq_02')
  
  // Informações Financeiras / Pagamento
  paymentLocation?: string; // Local de Recebimento
  bankPixKey?: string; // Banco / Chave PIX
  bankAgency?: string; // Agência (Ag.)
  bankAccount?: string; // Conta Corrente (C.C.)

  // Anexos de Retorno e Documentos
  admissionExamDoc?: EmployeeAttachment; // Exame Admissional
  experienceContractDoc?: EmployeeAttachment; // Contrato de Experiência
  generalDocs?: EmployeeAttachment; // Documentos Gerais (RE + CNH)
  signedRegistrationDoc?: EmployeeAttachment; // Cadastro Assinado (Ficha com assinatura)
}

export interface FleetTeam {
  id: string;
  name: string; // Ex: 'Maq 02', 'Maq 03', 'Maq 04', 'Maq 05', 'Equipe Silagem 01'
  headerBgColor: string; // Cor do cabeçalho da coluna
  columnBgColor: string; // Cor de fundo da coluna
  borderColor?: string;
  machineryId?: string; // Máquina vinculada (opcional)
  machineryName?: string;
  leaderId?: string; // Líder / Encarregado
  notes?: string;
  order?: number;
  createdAt?: string;
}

export interface SupplierFormSubmission {
  id: string;
  name: string;
  tradeName?: string;
  category: string;
  cnpjOrCpf?: string;
  stateRegistration?: string;
  municipalRegistration?: string;
  phone: string;
  email?: string;
  zipCode?: string;
  address?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  notes?: string;
  submittedAt: string;
  status: 'pendente' | 'importado';
}

export interface Supplier {
  id: string;
  name: string;
  tradeName?: string;
  category: string; // 'Combustível', 'Peças & Oficinas', 'Sementes & Insumos', 'Lonas & Embalagens'
  cnpjOrCpf?: string;
  stateRegistration?: string;
  municipalRegistration?: string;
  phone: string;
  email?: string;
  zipCode?: string;
  address?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface InventoryItem {
  id: string;
  companyId?: string; // ID da Empresa
  name: string;
  category: 'combustivel' | 'lona_embalagem' | 'inoculante' | 'sementes' | 'adubo' | 'pecas' | 'outro';
  quantity: number;
  unit: string;
  minQuantity: number;
  unitCost: number;
  location?: string;
  code?: string;
  fiscalName?: string;
  barcode?: string;
  profitMargin?: number;
  salePrice?: number;
  wholesaleMargin?: number; // % Atac. (Margem de lucro para Atacado)
  wholesalePrice?: number; // Preço de Venda em Atacado (V. Atacado)
  promoMargin?: number; // % Promo. (Margem de lucro para Promoção)
  promoPrice?: number; // Preço Promocional (V. Promo)
  maxQuantity?: number;
}

export interface ServiceOrder {
  id: string;
  orderNumber?: string;
  clientName: string;
  clientId?: string;
  farmName?: string;
  serviceType: 'Ensilagem' | 'Colheita' | 'Plantio' | 'Pulverização' | 'Preparo de Solo' | 'Compactação de Silo' | 'Transporte / Frete' | string;
  serviceTab?: string;
  areaHectares?: number;
  tonsEstimated?: number;
  densityKg?: number; // Peso por m³ (Kg) da silagem para cubagem
  weightPerM3Kg?: number; // Peso por m³ (Kg)
  ratePerUnit: number;
  totalAmount: number;
  startDate: string;
  completionDate?: string;
  status: 'agendado' | 'em_andamento' | 'concluido' | 'cancelado';
  machineryId?: string;
  machineryAssigned?: string;
  operatorId?: string;
  operatorAssigned?: string;
  driverId?: string;
  driverName?: string;
  fuelCostAllocated?: number;
  driverCostAllocated?: number;
  notes?: string;

  // Serviços de Máquinas Pesadas e Transporte / Fretes
  equipmentCategory?: 'pesadas' | 'caminhoes';
  machineSpecificType?: string;
  machineHours?: number;
  machineHourlyRate?: number;
  truckBillingMode?: 'horas' | 'cargas_km' | 'somente_km' | 'km' | 'cargas' | 'viagem';
  truckServiceHours?: number;
  truckServiceHourlyRate?: number;
  truckServiceLoads?: number;
  truckServiceRatePerLoad?: number;
  truckServiceKmAdditional?: number;
  truckServiceRatePerKm?: number;
  truckServiceTotalKm?: number;
  truckServiceRateOnlyKm?: number;
  truckServiceTrips?: number;
  truckServiceRatePerTrip?: number;
  freightMaterialType?: string;
  freightOrigin?: string;
  freightDestination?: string;
  freightDriverId?: string;
  freightDriverName?: string;
  machineTotalAmount?: number;

  // Unidade de Área e Valores Base
  areaUnit?: 'hectares' | 'alqueires' | 'hora';
  areaQuantity?: number;
  ratePerAreaUnit?: number;
  baseServiceAmount?: number;
  subtotalArea?: number;

  // Trator / Máquina
  tractorId?: string;
  tractorName?: string;
  tractorOperatorId?: string;
  tractorOperatorName?: string;
  tractorSecondOperatorId?: string;
  tractorSecondOperatorName?: string;
  tractorCalculationMode?: 'horas' | 'area';
  tractorBillingMode?: 'horas' | 'area';
  tractorHours?: number;
  tractorRatePerHour?: number;
  tractorTotalAmount?: number;
  tractorOperatorCommissionMode?: 'horas' | 'area' | 'livre';
  tractorOperatorHours?: number;
  tractorOperatorCommissionRate?: number;
  tractorOperatorCommission?: number;
  tractorOperatorCommissionP1?: number;
  tractorOperatorCommissionP2?: number;

  // Forrageira / Ensiladeira
  forageHarvesterId?: string;
  forageHarvesterName?: string;
  forageOperatorId?: string;
  forageOperatorName?: string;
  forageSecondOperatorId?: string;
  forageSecondOperatorName?: string;
  forageDrumHours?: number; // Hora do Tambor (H)
  forageEngineHours?: number; // Hora do Motor (H)
  forageCommissionMode?: 'tambor' | 'motor' | 'area' | 'livre'; // Modalidade de comissão da forrageira
  forageCommissionBase?: number; // Base livre da comissão da forrageira
  forageCommissionRate?: number; // Taxa R$ da comissão da forrageira
  forageRatePerHour?: number;
  forageTotalAmount?: number;
  forageOperatorCommission?: number;
  forageOperatorCommissionP1?: number;
  forageOperatorCommissionP2?: number;

  // Frotas / Caminhões
  trucks?: ServiceTruckItem[];
  truckFleetPercentage?: number; // % de distribuição para frotas/caminhões (ex: 10%)
  truckFleetTotalDistributed?: number;
  truckFleetHourlyTotal?: number; // Total cobrado do cliente por horas de frotas (quando Hectares)
  trucksTotalKmAdditional?: number;

  // Frete Prancha
  fretePrancha?: number;
  flatbedFreight?: number;

  // Consumo de Combustível e Alimentação
  fuelEntries?: ServiceFuelEntry[];
  totalFuelCost?: number;
  mealExpenses?: ServiceMealExpense[];
  totalMealCost?: number;

  // Agenciador / Intermediação
  brokerId?: string;
  brokerName?: string;
  brokerCommissionType?: string;
  brokerCommissionRate?: number;
  brokerCommissionAmount?: number;

  // Fechamento e DRE da Operação
  totalExpenses?: number; // Total Geral Despesas (comissões e custos adicionais)
  estimatedProfit?: number; // Resultado Final (Lucro Estimado)
}

export interface ServiceFuelEntry {
  vehicleId: string;
  vehicleType: 'forrageira' | 'trator' | 'caminhao' | 'outro';
  vehicleName: string;
  liters: number | '';
  pricePerLiter: number | '';
  subtotal: number;
}

export interface ServiceMealExpense {
  id: string;
  description: string; // ex: 'Café da manhã', 'Almoço', 'Janta', 'Diária'
  date: string; // YYYY-MM-DD
  amount: number | '';
}

export type FreightCommissionMode = 'km' | 'horas' | 'tonelada_carga' | 'toneladas' | 'cargas' | 'viagem' | 'livre';

export interface ServiceTruckItem {
  id: string;
  machineryId?: string;
  truckName?: string;
  ownership?: string; // 'proprio' | 'terceirizado' | 'alugado' | 'arrendado'
  plate?: string;
  primaryDriverId?: string;
  primaryDriverName?: string;
  secondaryDriverId?: string;
  secondaryDriverName?: string;
  capacityM3?: number;
  tripLoads?: number; // Nº de Cargas / Viagens
  totalM3?: number; // Calculado (Capacidade x Cargas)
  driverHours?: number; // Horas motorista
  driverHourSource?: 'tambor' | 'motor' | 'manual'; // 'Usar Tambor' / 'Usar Motor'
  additionalKm?: number; // KM Adicional (quando Alqueires)
  ratePerKm?: number; // R$ / KM
  totalAdditionalKm?: number; // Total Adicional KM (calculado)
  truckHours?: number; // Horas Trabalhadas do Caminhão (modalidade Hectares)
  truckHourlyRate?: number; // Valor por Hora (R$) do Caminhão cobrado do cliente (modalidade Hectares)
  truckTotalCost?: number; // Custo calculado: Horas Trabalhadas * Valor por Hora
  driverCommissionMode?: FreightCommissionMode; // Regra de Frete: 'km' | 'horas' | 'tonelada_carga' | 'viagem' | 'livre'
  driverCommissionBase?: number | ''; // Base da comissão de frete
  driverCommissionRate?: number; // R$/km, R$/hora, R$/ton-carga, R$/viagem
  driverCommission?: number; // Valor total da comissão de frete do motorista
  distributedValue?: number; // Valor proporcional m³ da distribuição da frota
  ratioPercent?: number; // % de participação no volume total da frota
}

export interface CropSeason {
  id: string;
  name: string; // Ex: "Safra Verão 2025/2026"
  crop: string; // "Milho", "Sorgo"
  plantedHectares: number;
  estimatedTons: number;
  harvestedTons?: number;
  status: 'planejamento' | 'plantio' | 'desenvolvimento' | 'colheita' | 'finalizada';
  startDate: string;
  endDate?: string;
}

export interface FuelLog {
  id: string;
  date: string; // YYYY-MM-DD
  machineryId: string;
  machineryPlateOrName: string;
  fuelType: 'Diesel S10' | 'Diesel Comum' | 'Arla 32' | 'Gasolina' | 'Etanol';
  liters: number;
  pricePerLiter: number;
  totalAmount: number;
  currentHourMeterOrKm: number;
  previousHourMeterOrKm?: number;
  currentKm?: number;
  previousKm?: number;
  currentHourMeter?: number;
  previousHourMeter?: number;
  averageCalculated?: number; // km/L ou L/h geral
  averageKmPerLiter?: number; // Média calculada desta abastecida em km/L
  averageLitersPerHour?: number; // Média calculada desta abastecida em L/h
  driverOrOperator?: string;
  driverIds?: string[];
  supplierStation?: string; // Posto / Fazenda
  notes?: string;
  expenseId?: string; // Linked financial expense
  createdAt: string;
}

export type MaintenanceLocation = 'estrada' | 'roca' | 'oficina_interna' | 'oficina_externa';

export interface MaintenanceCategoryDefinition {
  id: string;
  name: string;
  description?: string;
  color?: string;
  isSystem?: boolean;
}

export type MaintenanceExecutorType = 
  | 'equipe_propria' 
  | 'mecanico_interno' 
  | 'mecanico_campo' 
  | 'mecanica_terceirizada';

export interface MaintenancePartItem {
  id: string;
  description: string;
  origin: 'almoxarifado_interno' | 'externo_compra' | 'recuperada_externa';
  inventoryItemId?: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  supplierId?: string;
  supplierName?: string;
  serviceProvider?: string;
  invoiceNumber?: string;
  requiresPurchase?: boolean;
  serviceDescription?: string;
  externalServiceCost?: number;
  stockDeducted?: boolean; // Controle interno para evitar baixa duplicada no estoque
}

export interface MaintenanceLaborPeriod {
  id: string;
  startTime: string; // Ex: "08:00"
  endTime: string;   // Ex: "12:00"
}

export interface MaintenanceLaborItem {
  id: string;
  description?: string;
  employeeId?: string;
  executorType?: MaintenanceExecutorType;
  mechanicName?: string;
  hours?: number;
  hourlyRate?: number;
  totalCost: number;
  date?: string; // Data em que as horas foram trabalhadas
  dataLancamento?: string; // Data do lançamento das horas
  periods?: MaintenanceLaborPeriod[]; // Múltiplos períodos de Entrada e Saída
}

export interface MaintenanceNfeLink {
  nfeNumber?: string;
  nfeSeries?: string;
  nfeAccessKey?: string;
  issueDate?: string;
  supplierCnpj?: string;
  supplierName?: string;
  totalNfeAmount?: number;
  xmlFileName?: string;
}

export interface MaintenanceFinancialConditions {
  createAccountsPayable: boolean;
  paymentTerm: 'a_vista' | '15_dias' | '30_dias' | '30_60_dias' | '30_60_90_dias' | 'safra_prazo' | 'personalizado';
  paymentMethod: PaymentMethod;
  installmentsCount?: number;
  firstDueDate: string;
  supplierName?: string;
  notes?: string;
  installments?: Array<{
    id: string;
    number: string;
    amount: number;
    daysInterval: number;
    dueDate: string;
    paymentMethodCode: string;
    paymentMethodLabel: string;
    creditAccount: string;
    debitAccount: string;
    observations: string;
    documentFileUrl?: string;
    documentFileName?: string;
  }>;
}

export interface MaintenancePurchaseRequest {
  id: string;
  osId: string;
  osNumber?: string;
  vehicleId?: string;
  vehiclePlateOrName: string;
  status: 'cotacao' | 'aprovado' | 'comprado' | 'entregue';
  urgency: 'baixa' | 'media' | 'alta' | 'urgente_veiculo_parado';
  items: {
    description: string;
    quantity: number;
    unit: string;
    estimatedCost?: number;
    estimatedUnitCost?: number;
    suggestedSupplier?: string;
  }[];
  requestedBy?: string;
  notes?: string;
  createdAt: string;
}

export interface MaintenanceLog {
  id: string;
  osNumber?: string; // Ex: OS-2026-0012
  date: string; // YYYY-MM-DD
  completionDate?: string; // Previsão de Término / Conclusão (Data)
  machineryId: string;
  machineryPlateOrName: string;
  type: 'preventiva' | 'corretiva' | 'preditiva' | 'revisao_periodica' | 'reforma_entressafra';
  serviceCategory: 
    | 'Troca de Óleo & Filtros'
    | 'Facas & Contra-Faca (Ensiladeira)'
    | 'Pneus, Rodas & Esteiras'
    | 'Motor & Transmissão'
    | 'Sistema Hidráulico'
    | 'Freios & Embreagem'
    | 'Elétrica & Ar-Condicionado'
    | 'Solda, Funilaria & Estrutura'
    | 'Outro'
    | string;
  location?: MaintenanceLocation; // Estrada, Roça (Campo), Oficina Interna, Oficina Externa
  locationDetails?: string; // ex: Fazenda Boa Vista - Talhão 4
  executorType?: MaintenanceExecutorType; // Interno: Equipe Própria / Mecânico Interno; Externo: Mecânico em Campo / Mecânica Terceirizada
  executorName?: string; // Nome do mecânico/operador/oficina
  description: string;
  workshopOrMechanic: string;
  partsOriginSummary?: 'almoxarifado' | 'externo' | 'misto' | 'sem_pecas';
  partsItems?: MaintenancePartItem[];
  laborItems?: MaintenanceLaborItem[];
  partsCost: number;
  laborCost: number;
  totalCost: number;
  currentHourMeterOrKm: number;
  nextServiceDueHourMeterOrKm?: number;
  status: 'concluida' | 'em_andamento' | 'agendada' | 'aguardando_pecas' | 'cancelada';
  nfeLink?: MaintenanceNfeLink;
  financialConditions?: MaintenanceFinancialConditions;
  purchaseRequestId?: string;
  stockDeducted?: boolean;
  expenseIds?: string[];
  notes?: string;
  expenseId?: string;
  createdAt: string;
}

export interface CorporateCard {
  id: string;
  name: string; // Ex: "Visa Final 4321"
  responsibleEmployeeId: string; // Funcionário Responsável (Módulo RH)
  responsibleEmployeeName: string; // Nome do Funcionário
  totalLimit: number; // Limite Total do Cartão (R$)
  usedLimit: number; // Limite Utilizado / Saldo Devedor Atual (R$)
  dueDay: number; // Dia de Vencimento da Fatura (1 a 31)
  closingDay?: number; // Dia de Fechamento da Fatura (1 a 31, opcional)
  status?: 'ativo' | 'bloqueado' | 'cancelado';
  lastInvoiceProvisionedAt?: string;
  notes?: string;
}

export interface BankAccount {
  id: string;
  name: string;
  bankName: string;
  bankCode?: string;
  accountType: 'corrente' | 'poupanca' | 'aplicacao' | 'caixa_fisico';
  agency?: string;
  accountNumber?: string;
  accountDigit?: string;
  balance: number;
  overdraftLimit?: number;
  pixKey?: string;
  pixKeyType?: 'cpf' | 'cnpj' | 'phone' | 'email' | 'random';
  color?: string;
  corporateCards?: CorporateCard[];
}

export interface BankTransaction {
  id: string;
  bankAccountId: string;
  bankAccountName?: string;
  date: string; // YYYY-MM-DD
  description: string;
  type: 'entrada' | 'saida'; // entrada (crédito) ou saída (débito)
  amount: number;
  category?: string;
  sourceType?: 'despesa' | 'receita' | 'transferencia' | 'manual' | 'ofx' | 'ajuste' | 'baixa_pagamento';
  sourceId?: string;
  expenseId?: string;
  paidByEmployeeId?: string;
  paidByEmployeeName?: string;
  documentNumber?: string;
  notes?: string;
  balanceAfter?: number;
  createdAt?: string;
}

export interface ThirdPartySettlement {
  id: string;
  thirdPartyName: string;
  role: 'Freteiro / Caminhão' | 'Operador Terceirizado' | 'Prestador de Serviço' | 'Aluguel de Máquina';
  date: string;
  description: string;
  tons?: number;
  trips?: number;
  hours?: number;
  rate: number;
  totalAmount: number;
  deductions?: number;
  netAmount: number;
  status: 'pendente' | 'pago' | 'parcial';
  machineryPlateOrName?: string;
  phone?: string;
  notes?: string;
  orderId?: string; // Pedido de silagem / OS vinculado
  truckId?: string; // ID do caminhão no pedido
  orderNumber?: string;
  orderClientName?: string;
  createdAt?: string;
}

export interface BrokerSettlement {
  id: string;
  brokerId: string; // ID do colaborador Agenciador
  brokerName: string; // Nome do Agenciador (UPPERCASE)
  actingRegion?: string; // Região de Atuação (ex: SUDOESTE DO PARANÁ)
  date: string; // Data do lançamento / acerto (YYYY-MM-DD)
  referenceMonth?: string; // MM/YYYY (ex: 09/2026)
  orderId?: string; // Pedido de silagem vinculado (opcional)
  orderClientName?: string; // Nome do cliente/produtor
  description: string; // Descrição do contrato / pedido agenciado
  
  // Regra de comissão e cálculo
  commissionType: 'Porcentagem (%) sobre o valor do pedido' | 'Porcentagem (%) sobre a produção' | 'Valor Fixo por contrato/pedido' | string;
  commissionRate: number; // Taxa percentual (%) ou valor fixo (R$)
  baseValue: number; // Base de cálculo (R$)
  grossAmount: number; // Valor Bruto da Comissão (R$)
  deductions?: number; // Vales, adiantamentos ou descontos (R$)
  netAmount: number; // Valor Líquido a Repassar (R$)
  
  // Controle de Baixa / Pagamento
  status: 'pendente' | 'pago' | 'parcial';
  paymentDate?: string; // Data da baixa / repasse
  bankAccountId?: string; // Conta bancária de saída
  bankAccountName?: string;
  paymentMethod?: PaymentMethod | string;
  pixKey?: string;
  receiptNumber?: string;
  notes?: string;
  createdAt: string;
}

export interface PayrollRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  referenceMonth: string; // MM/YYYY (ex: '09/2026')
  baseSalary: number;
  overtimeHours?: number;
  overtimeAmount: number; // Horas extras / diárias de safra
  bonusAmount: number; // Insalubridade, bônus safra, etc.
  commissionAmount?: number; // Comissões variáveis apuradas no mês (silagem, colheita, horas trabalhadas ou produção)
  inssDiscount: number;
  advancesDiscount: number; // Vales e adiantamentos descontados
  otherDiscounts: number; // Faltas, atrasos, convênios
  netSalary: number;
  status: 'pendente' | 'pago';
  paymentDate?: string;
  notes?: string;
  createdAt: string;
}

export interface VacationRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  acquisitionPeriodStart?: string;
  acquisitionPeriodEnd?: string;
  startDate: string;
  endDate: string;
  daysCount: number; // 30, 20, etc.
  sellDaysCount: number; // Abono pecuniário (dias vendidos, ex: 10)
  baseSalary: number;
  oneThirdBonus: number; // 1/3 Constitucional
  pecuniaryAllowance: number; // Valor do abono pecuniário
  thirteenthAdvance: boolean; // Adiantamento de 50% do 13º
  thirteenthAmount?: number;
  totalAmount: number;
  status: 'agendado' | 'em_gozo' | 'concluido' | 'cancelado';
  notes?: string;
  createdAt: string;
}

export interface LeaveRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  type: 'Atestado Médico' | 'Acidente de Trabalho (CAT)' | 'Licença Maternidade/Paternidade' | 'Auxílio Doença / INSS' | 'Licença Não Remunerada' | 'Outro';
  startDate: string;
  endDate?: string;
  expectedReturnDate?: string;
  actualReturnDate?: string;
  daysCount: number;
  cid?: string;
  doctorName?: string;
  status: 'ativo' | 'finalizado';
  notes?: string;
  createdAt: string;
}

export interface SalaryAdvance {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  amount: number;
  paymentMethod: PaymentMethod;
  referenceMonth: string; // MM/YYYY (ex: '09/2026')
  status: 'pendente' | 'descontado';
  reason?: string;
  notes?: string;
  createdAt: string;
  // Campos de Parcelamento e Auditoria
  discountType?: 'Cota Única' | 'Parcelado';
  installmentNumber?: number; // ex: 1, 2, 3...
  totalInstallments?: number; // ex: 3
  installmentGroupId?: string;
  monthlyInterestRate?: number; // % juros ao mês
  totalAmountWithInterest?: number; // Valor total com juros
  responsibleUser?: string; // Auditoria: Responsável pelo lançamento
  attachmentName?: string; // Nome do arquivo do comprovante
  attachmentUrl?: string; // Base64 ou URL do comprovante (PDF ou Imagem)
}

export interface MedicalCertificateRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  type: 'Atestado Médico' | 'Atestado Odontológico' | 'Declaração de Horas' | 'Acompanhamento Familiar' | 'Licença Maternidade/Paternidade' | 'Outro';
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  expectedReturnDate?: string; // YYYY-MM-DD
  daysCount: number;
  hoursCount?: number;
  cid?: string;
  doctorName?: string;
  crmCro?: string;
  clinic?: string;
  status: 'homologado' | 'em_analise' | 'rejeitado';
  attachmentName?: string;
  notes?: string;
  createdAt: string;
}

export interface AbsenceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  date: string; // YYYY-MM-DD
  endDate?: string;
  daysCount: number;
  type: 'injustificada' | 'justificada' | 'atraso' | 'suspensao';
  discountPayroll: boolean;
  discountAmount?: number;
  referenceMonth: string; // MM/YYYY
  reason?: string;
  status: 'pendente' | 'justificada' | 'descontada' | 'abonada';
  notes?: string;
  createdAt: string;
}

// ==========================================
// MÓDULO DE PNEUS E RODÍZIO DA FROTA
// ==========================================

export type AxleTireType = 'single' | 'dual';
export type AxleFunction = 'direcional' | 'tracao' | 'truck_livre' | 'agricola_dianteiro' | 'agricola_traseiro' | 'reboque';

export interface AxleDefinition {
  axleNumber: number; // 1, 2, 3, etc.
  name: string; // "1º Eixo (Dianteiro/Direcional)", "2º Eixo (Tração)", etc.
  type: AxleTireType; // 'single' (2 pneus) ou 'dual' (4 pneus)
  function: AxleFunction;
  tirePositions: string[]; // ex: ['1E', '1D'] ou ['2EE', '2EI', '2DI', '2DD']
}

export interface VehicleAxleConfig {
  code: string;
  name: string;
  totalAxles: number;
  totalTires: number;
  axles: AxleDefinition[];
}

export interface VehicleTypeDefinition {
  id: string;
  name: string;
  categoryKey: string;
  defaultAxleConfig: VehicleAxleConfig;
  isCustom?: boolean;
  description?: string;
}

export type TireCondition = 'novo' | 'excelente' | 'bom' | 'atencao' | 'critico' | 'descarte';

export type TireStatus = 'em_uso' | 'estoque' | 'estepe' | 'reforma' | 'descartado';

export interface TireItem {
  id: string;
  position: string; // '1E', '1D', '2EE', '2EI', '2DI', '2DD', '3EE', '3EI', '3DI', '3DD', 'estoque', 'reforma', etc.
  positionName: string;
  fireNumber: string; // Código de Fogo / Matrícula (ex: 'P-104' ou '#0442')
  brand: string; // 'Michelin', 'Pirelli', 'Bridgestone', 'Goodyear', etc.
  model?: string;
  size?: string; // '295/80 R22.5', '710/70 R38', etc.
  treadDepthMm: number; // Sulco atual em mm (ex: 12.5)
  originalTreadDepthMm?: number; // Sulco original novo em mm (ex: 18.0)
  pressurePsi?: number; // Pressão em PSI (ex: 110)
  status: TireStatus;
  currentKm?: number;
  retreadCount?: number; // 0 = Novo, 1 = 1ª Recapagem, 2 = 2ª Recapagem
  installationKm?: number;
  installationHourMeter?: number;
  installationDate?: string;
  notes?: string;
  // Informações de Reforma / Recape
  reformWorkshop?: string;
  reformSentDate?: string;
  reformCost?: number;
  // Informações de Descarte / Baixa
  discardReason?: string;
  discardDate?: string;
  discardNotes?: string;
  discardedBy?: string;
}

export type RotationPatternType = 
  | 'mesmo_eixo'        // Inversão de lado no mesmo eixo (paralelo)
  | 'cruzado_x'          // Cruzado em X (Dianteira cruza com Traseira)
  | 'eixos_diferentes'   // Direto Frente <-> Traseira (mesmo lado)
  | 'tracao_duplo'       // Rodízio Interno x Externo nos eixos de tração
  | 'personalizado';     // Troca livre / manual

export interface TireMovement {
  tireId?: string;
  fireNumber: string;
  fromPosition: string;
  toPosition: string;
  treadDepthMm?: number;
}

export interface TireRotationLog {
  id: string;
  vehicleId: string;
  vehiclePlate: string;
  vehicleModel: string;
  date: string;
  kmAtRotation?: number;
  hourMeterAtRotation?: number;
  rotationType: RotationPatternType;
  rotationTypeName: string;
  operatorName?: string;
  serviceProvider?: string;
  cost?: number;
  tireMovements: TireMovement[];
  inspections?: { position: string; fireNumber: string; treadDepthMm: number; pressurePsi?: number }[];
  notes?: string;
  createdAt: string;
}

// ==============================================================================
// TIPOS: AGENDA DE SERVIÇOS AGRÍCOLAS
// ==============================================================================

export interface AgendaVehicleAssignment {
  machineryId: string;
  prefix: string; // Ex: "FOR-02" ou "Forrageira 02"
  plateOrSerial: string; // Ex: "Placa MTU-8920" ou "Série JD-8500"
  model: string;
  category: 'forrageira' | 'caminhao' | 'trator' | 'prancha' | 'outro';
  driverOrOperatorId?: string;
  driverOrOperatorName?: string;
}

export interface AgendaTeamMember {
  employeeId: string;
  employeeName: string;
  role: string; // Ex: "Operador de Forrageira", "Motorista", "Operador de Trator", "Encarregado"
  assignedVehiclePrefix?: string;
}

export interface ServiceAppointment {
  id: string;
  companyId?: string; // ID da Empresa
  appointmentNumber: string; // Ex: "AG-2026-001"
  clientId: string;
  clientName: string;
  farmName?: string;
  locationCityState?: string;
  contactPhone?: string;
  serviceType: 'Corte / Ensilagem' | 'Colheita' | 'Serviço de Trator' | 'Serviço de Máquina' | 'Frete / Transporte';
  serviceTab?: 'corte' | 'colheita' | 'trator' | 'maquina' | 'frete' | 'orcamento';
  startDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm (Horário de saída da base / início de deslocamento)

  // 1. Cálculo de Tempos Operacionais
  travelTimeMinutes: number; // Tempo de deslocamento rodoviário (minutos)
  trailerLoadingTimeMinutes: number; // Tempo de prancha / embarque e amarração (minutos)
  areaUnit: 'hectares' | 'alqueires' | 'horas';
  estimatedQuantity: number; // Quantidade de área ou horas a executar
  productivityRatePerHour: number; // Rendimento operacional estimado (ex: 1.5 ha/h, 0.6 alq/h, 1 h/h)
  executionTimeMinutes: number; // Tempo de execução estimado em minutos
  totalTimeMinutes: number; // Deslocamento + Prancha + Execução (minutos)
  endDate: string; // YYYY-MM-DD (Calculado a partir de startDate, startTime e totalTimeMinutes)
  endTime: string; // HH:mm (Calculado a partir de startTime e totalTimeMinutes)

  // 2. Veículos e Frotas rastreados estritamente por Placas/Prefixos
  primaryMachineryId?: string;
  primaryMachineryPrefix?: string;
  primaryMachineryPlate?: string;
  primaryMachineryModel?: string;
  frontId?: string;
  frontNumber?: number;

  assignedVehicles: AgendaVehicleAssignment[];
  assignedTeam: AgendaTeamMember[];

  // 3. Status e Vínculo com Corte / Serviço
  status: 'agendado' | 'em_deslocamento' | 'em_execucao' | 'concluido' | 'cancelado';
  generatedServiceOrderId?: string; // ID da ServiceOrder gerada automaticamente
  fieldNotes?: string;

  // 4. Retorno Real de Campo (Horários e Produção Real)
  realStartDate?: string; // Data real de início
  realStartTime?: string; // HH:mm real de início
  realEndDate?: string;   // Data real de término
  realEndTime?: string;   // HH:mm real de término
  realLoadsCount?: number; // Cargas reais contabilizadas
  realHourMeterStart?: number; // Horímetro inicial
  realHourMeterEnd?: number;   // Horímetro final
  realNotes?: string;          // Observações de campo retornadas

  createdAt: string;
  updatedAt?: string;
}



