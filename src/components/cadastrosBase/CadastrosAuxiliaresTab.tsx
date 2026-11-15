import React, { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Building2,
  CreditCard,
  Database,
  Edit3,
  FileSpreadsheet,
  Fuel,
  Layers,
  Package,
  Plus,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  Truck,
  Users,
  Wrench,
  X,
  Check,
  Tag,
} from 'lucide-react';
import {
  CfopCatalogEntry,
  Lc116ServiceCodeEntry,
  MaintenanceCategoryDefinition,
  TanqueCombustivel,
  VehicleTypeDefinition,
} from '../../types';
import {
  ClientSelectOption,
  DEFAULT_CATTLE_TYPES,
  DEFAULT_INVENTORY_CATEGORIES,
  DEFAULT_MANUAL_ENTRY_DOCUMENT_TYPES,
  DEFAULT_SERVICE_TYPES,
  DEFAULT_SILAGE_PRODUCT_TYPES,
  DEFAULT_STOCK_SERVICES,
  DEFAULT_VEHICLE_OWNERSHIP_REGIMES,
  DEFAULT_VEHICLE_SYSTEM_CATEGORIES,
  getStoredAtividadesCatalog,
  getStoredCattleTypes,
  getStoredClientServicesCatalog,
  getStoredCrmStatusCatalog,
  getStoredInventoryCategories,
  getStoredMaintenanceCategories,
  getStoredManualEntryDocumentTypes,
  getStoredServiceTypes,
  getStoredSilageProductTypes,
  getStoredStockServices,
  getStoredSupplierCategoriesCatalog,
  getStoredTanquesCombustivel,
  getStoredVehicleOwnershipRegimes,
  getStoredVehicleSystemCategories,
  getStoredVehicleTypes,
  saveStoredAtividadesCatalog,
  saveStoredCattleTypes,
  saveStoredClientServicesCatalog,
  saveStoredCrmStatusCatalog,
  saveStoredInventoryCategories,
  saveStoredMaintenanceCategories,
  saveStoredManualEntryDocumentTypes,
  saveStoredServiceTypes,
  saveStoredSilageProductTypes,
  saveStoredStockServices,
  saveStoredSupplierCategoriesCatalog,
  saveStoredTanquesCombustivel,
  saveStoredVehicleOwnershipRegimes,
  saveStoredVehicleSystemCategories,
  saveStoredVehicleTypes,
  STOCK_CATEGORIES_STORAGE_KEY,
  STORAGE_KEYS,
} from '../../lib/storage';
import {
  AUXILIARY_STORAGE_KEYS,
  DEFAULT_ALMOXARIFADO_SETORES,
  DEFAULT_RH_CONTRACT_TYPES,
  DEFAULT_RH_REG_TYPES,
  DEFAULT_RH_ROLES,
  DEFAULT_TIRE_BRANDS_LIST,
  DEFAULT_TIPOS_AFASTAMENTO,
  DEFAULT_TIPOS_ATESTADOS,
  DEFAULT_TIPOS_COMBUSTIVEL,
  DEFAULT_TIPOS_OCORRENCIAS_FALTAS,
  DEFAULT_TROCA_MOTIVOS_LIST,
  DEFAULT_UNIDADES_MEDIDA,
  dispatchAuxiliaryRegistryChange,
  getStoredAlmoxarifadoSetores,
  getStoredAsoExames,
  getStoredAsoFinalidades,
  getStoredAuxTireBrands,
  getStoredAuxTrocaMotivos,
  getStoredRhContractTypes,
  getStoredRhRegTypes,
  getStoredRhRoles,
  getStoredTiposAfastamento,
  getStoredTiposAtestados,
  getStoredTiposCombustivel,
  getStoredTiposOcorrenciasFaltas,
  getStoredUnidadesMedida,
  KeyLabelAuxItem,
  saveStoredAlmoxarifadoSetores,
  saveStoredAsoExames,
  saveStoredAsoFinalidades,
  saveStoredAuxTireBrands,
  saveStoredAuxTrocaMotivos,
  saveStoredRhContractTypes,
  saveStoredRhRegTypes,
  saveStoredRhRoles,
  saveStoredTiposAfastamento,
  saveStoredTiposAtestados,
  saveStoredTiposCombustivel,
  saveStoredTiposOcorrenciasFaltas,
  saveStoredUnidadesMedida,
  getStoredPlacasTerceiros,
  ThirdPartyPlateEntry,
  useAuxiliarySyncVersion,
} from '../../lib/auxiliaryRegistries';
import {
  DEFAULT_PRODUCT_BRANDS,
  DEFAULT_PRODUCT_GROUPS,
  DEFAULT_PRODUCT_VARIATIONS,
  DEFAULT_TIPO_PRODUTO_OPTIONS,
  getStoredProductBrands,
  getStoredProductGroups,
  getStoredProductVariations,
  getStoredTipoProdutoOptions,
  getSuggestedSubgroupsForGroup,
  saveProductBrandsList,
  saveProductGroupsList,
  saveProductSubgroupsList,
  saveProductVariationsList,
  saveTipoProdutoOptionsList,
} from '../inventory/productClassificationStorage';
import {
  CFOP_CATALOG_STORAGE_KEY,
  getStoredCfopCatalog,
  getStoredLc116ServiceCodes,
  LC116_SERVICE_CODES_STORAGE_KEY,
  saveStoredCfopCatalog,
  saveStoredLc116ServiceCodes,
} from '../../lib/cfopCatalog';
import { useGlobalPaymentMethods } from '../../lib/paymentMethodsStorage';
import {
  getStoredCargosPermissoes,
  getStoredCentrosCusto,
  getStoredPlanoContas,
} from '../../lib/cadastrosBaseStorage';
import { ASO_EXAM_OPTIONS, ASO_EXAM_PURPOSES } from '../employees/asoGuideUtils';
import { CategoryOptionsManagerModal } from '../common/CategoryOptionsManagerModal';
import { ClassificationListManagerModal } from '../inventory/ClassificationListManagerModal';
import { ClientOptionsManagerModal } from '../crm/ClientOptionsManagerModal';
import { PaymentMethodsManagerModal } from '../common/PaymentMethodsManager';
import { MaintenanceCategoriesModal } from '../fleet/MaintenanceCategoriesModal';
import { VehicleTypesConfigModal } from '../fleet/VehicleTypesConfigModal';
import { CfopManagerModal } from '../nfe/CfopManagerModal';
import { Lc116ServiceCodeManagerModal } from '../nfe/Lc116ServiceCodeManagerModal';
import { PlacasTerceirosManagerModal } from '../nfe/PlacasTerceirosManagerModal';

export type AuxModuleCategory =
  | 'all'
  | 'financeiro'
  | 'estoque'
  | 'frota'
  | 'rh'
  | 'crm';

type StringModalConfig = {
  id: string;
  mode: 'category' | 'classification';
  title: string;
  subtitle: string;
  placeholder: string;
  items: string[];
  defaultItems?: string[];
  onSave: (items: string[]) => void;
};

type ClientOptionsModalConfig = {
  id: string;
  title: string;
  subtitle: string;
  inputLabel: string;
  inputPlaceholder: string;
  items: ClientSelectOption[];
  onSave: (items: ClientSelectOption[]) => void;
};

type KeyLabelModalConfig = {
  id: string;
  title: string;
  subtitle: string;
  items: KeyLabelAuxItem[];
  defaultItems: KeyLabelAuxItem[];
  onSave: (items: KeyLabelAuxItem[]) => void;
};

interface AuxRegistryCard {
  id: string;
  module: Exclude<AuxModuleCategory, 'all'>;
  title: string;
  description: string;
  storageKey: string;
  count: number;
  preview: string[];
  actionLabel: string;
  onOpen: () => void;
  secondaryTab?: {
    label: string;
    tab: 'cargos_permissoes' | 'plano_contas' | 'formas_pagamento' | 'centros_custo';
  };
}

interface CadastrosAuxiliaresTabProps {
  onNavigateTab?: (tab: 'cargos_permissoes' | 'plano_contas' | 'formas_pagamento' | 'centros_custo') => void;
}

const MODULE_TABS: Array<{ id: AuxModuleCategory; label: string; icon: React.ReactNode }> = [
  { id: 'all', label: 'Todos os Módulos', icon: <Database className="w-3.5 h-3.5" /> },
  { id: 'financeiro', label: 'Financeiro & Fiscal', icon: <CreditCard className="w-3.5 h-3.5" /> },
  { id: 'estoque', label: 'Estoque & Almoxarifado', icon: <Package className="w-3.5 h-3.5" /> },
  { id: 'frota', label: 'Frotas & Manutenção', icon: <Truck className="w-3.5 h-3.5" /> },
  { id: 'rh', label: 'RH & Equipe', icon: <Users className="w-3.5 h-3.5" /> },
  { id: 'crm', label: 'Clientes, Fornecedores & Serviços', icon: <Building2 className="w-3.5 h-3.5" /> },
];

export const CadastrosAuxiliaresTab: React.FC<CadastrosAuxiliaresTabProps> = ({ onNavigateTab }) => {
  const syncVersion = useAuxiliarySyncVersion();
  const { allMethods: globalPaymentMethods } = useGlobalPaymentMethods();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModule, setSelectedModule] = useState<AuxModuleCategory>('all');

  // Modais especializados
  const [stringModal, setStringModal] = useState<StringModalConfig | null>(null);
  const [clientModal, setClientModal] = useState<ClientOptionsModalConfig | null>(null);
  const [keyLabelModal, setKeyLabelModal] = useState<KeyLabelModalConfig | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isCfopModalOpen, setIsCfopModalOpen] = useState(false);
  const [isLc116ModalOpen, setIsLc116ModalOpen] = useState(false);
  const [isMaintenanceCatsModalOpen, setIsMaintenanceCatsModalOpen] = useState(false);
  const [isVehicleTypesModalOpen, setIsVehicleTypesModalOpen] = useState(false);
  const [isSubgroupsModalOpen, setIsSubgroupsModalOpen] = useState(false);
  const [isTanksModalOpen, setIsTanksModalOpen] = useState(false);
  const [isPlacasTerceirosModalOpen, setIsPlacasTerceirosModalOpen] = useState(false);

  // Estado dos modais inline (Subgrupos por Grupo, Key-Label e Tanques)
  const [selectedSubgroupGroup, setSelectedSubgroupGroup] = useState<string>('__geral__');
  const [newSubgroupName, setNewSubgroupName] = useState('');
  const [newKeyLabelText, setNewKeyLabelText] = useState('');
  const [editingKeyLabelId, setEditingKeyLabelId] = useState<string | null>(null);
  const [editingKeyLabelValue, setEditingKeyLabelValue] = useState('');
  const [tanksDraft, setTanksDraft] = useState<TanqueCombustivel[]>([]);

  // Leituras reativas de todas as listas auxiliares
  const snapshot = useMemo(() => {
    void syncVersion;
    const cfops: CfopCatalogEntry[] = getStoredCfopCatalog();
    const lc116: Lc116ServiceCodeEntry[] = getStoredLc116ServiceCodes();
    const manualDocTypes = getStoredManualEntryDocumentTypes();
    const chartAccounts = getStoredPlanoContas().categorias;
    const costCenters = getStoredCentrosCusto();

    const inventoryCats = getStoredInventoryCategories();
    const productTypes = getStoredTipoProdutoOptions();
    const productGroups = getStoredProductGroups();
    const productSubgroups = getSuggestedSubgroupsForGroup('__geral__');
    const productVariations = getStoredProductVariations();
    const productBrands = getStoredProductBrands();
    const units = getStoredUnidadesMedida();
    const warehouseSectors = getStoredAlmoxarifadoSetores();
    const stockServices = getStoredStockServices();
    const silageProductTypes = getStoredSilageProductTypes();
    const trocaMotivos = getStoredAuxTrocaMotivos();

    const maintenanceCats: MaintenanceCategoryDefinition[] = getStoredMaintenanceCategories();
    const vehicleSystemCats = getStoredVehicleSystemCategories();
    const vehicleTypes: VehicleTypeDefinition[] = getStoredVehicleTypes();
    const ownershipRegimes = getStoredVehicleOwnershipRegimes();
    const fuelTypes = getStoredTiposCombustivel();
    const tireBrands = getStoredAuxTireBrands();
    const fuelTanks: TanqueCombustivel[] = getStoredTanquesCombustivel();
    const placasTerceiros: ThirdPartyPlateEntry[] = getStoredPlacasTerceiros();

    const cargos = getStoredCargosPermissoes();
    const rhRoles = getStoredRhRoles();
    const rhRegTypes = getStoredRhRegTypes();
    const rhContractTypes = getStoredRhContractTypes();
    const absenceTypes = getStoredTiposOcorrenciasFaltas();
    const leaveTypes = getStoredTiposAfastamento();
    const atestadoTypes = getStoredTiposAtestados();
    const asoPurposes = getStoredAsoFinalidades();
    const asoExams = getStoredAsoExames();

    const clientActivities = getStoredAtividadesCatalog();
    const crmStatuses = getStoredCrmStatusCatalog();
    const clientInterestServices = getStoredClientServicesCatalog();
    const cattleTypes = getStoredCattleTypes();
    const supplierCategories = getStoredSupplierCategoriesCatalog();
    const serviceTypes = getStoredServiceTypes();

    return {
      cfops,
      lc116,
      manualDocTypes,
      chartAccounts,
      costCenters,
      inventoryCats,
      productTypes,
      productGroups,
      productSubgroups,
      productVariations,
      productBrands,
      units,
      warehouseSectors,
      stockServices,
      silageProductTypes,
      trocaMotivos,
      maintenanceCats,
      vehicleSystemCats,
      vehicleTypes,
      ownershipRegimes,
      fuelTypes,
      tireBrands,
      fuelTanks,
      placasTerceiros,
      cargos,
      rhRoles,
      rhRegTypes,
      rhContractTypes,
      absenceTypes,
      leaveTypes,
      atestadoTypes,
      asoPurposes,
      asoExams,
      clientActivities,
      crmStatuses,
      clientInterestServices,
      cattleTypes,
      supplierCategories,
      serviceTypes,
    };
  }, [syncVersion]);

  const cards: AuxRegistryCard[] = useMemo(() => {
    const activePaymentMethods = globalPaymentMethods.filter((m) => m.ativo !== false);
    return [
      // ===================== FINANCEIRO & FISCAL =====================
      {
        id: 'formas_pagamento',
        module: 'financeiro',
        title: 'Formas de Pagamento & Recebimento (Global)',
        description:
          'Lista única sincronizada em Vendas (PDV), Prestação de Serviços, Despesas, Notas de Entrada, Frota (Abastecimento/Manutenção) e Adiantamentos RH.',
        storageKey: 'agrocontrol_formas_pagamento',
        count: activePaymentMethods.length,
        preview: activePaymentMethods.slice(0, 5).map((m) => m.nome),
        actionLabel: 'Gerenciar Formas',
        onOpen: () => setIsPaymentModalOpen(true),
        secondaryTab: onNavigateTab
          ? { label: 'Abrir Aba Completa', tab: 'formas_pagamento' }
          : undefined,
      },
      {
        id: 'cfop_catalog',
        module: 'financeiro',
        title: 'Catálogo CFOP (NF-e / Saída & Entrada)',
        description:
          'Códigos Fiscais de Operações e Prestações usados na emissão de notas fiscais, vendas, remessas e devoluções.',
        storageKey: CFOP_CATALOG_STORAGE_KEY,
        count: snapshot.cfops.length,
        preview: snapshot.cfops.slice(0, 4).map((c) => `${c.codigo} - ${c.descricao.slice(0, 22)}`),
        actionLabel: 'Gerenciar CFOPs',
        onOpen: () => setIsCfopModalOpen(true),
      },
      {
        id: 'lc116_codes',
        module: 'financeiro',
        title: 'Códigos de Serviço Municipal (LC 116/03)',
        description:
          'Lista auxiliar de enquadramento tributário municipal para emissão de NFS-e de prestação de serviços.',
        storageKey: LC116_SERVICE_CODES_STORAGE_KEY,
        count: snapshot.lc116.length,
        preview: snapshot.lc116.slice(0, 4).map((c) => `${c.codigo} - ${c.descricao.slice(0, 22)}`),
        actionLabel: 'Gerenciar Códigos',
        onOpen: () => setIsLc116ModalOpen(true),
      },
      {
        id: 'manual_doc_types',
        module: 'financeiro',
        title: 'Tipos de Documentos de Entrada Manual',
        description:
          'Opções exibidas no lançamento de Notas & Entradas (NF-e, CT-e, Romaneio, Nota de Produtor, etc.).',
        storageKey: STORAGE_KEYS.MANUAL_ENTRY_DOCUMENT_TYPES,
        count: snapshot.manualDocTypes.length,
        preview: snapshot.manualDocTypes.slice(0, 5),
        actionLabel: 'Editar Lista',
        onOpen: () =>
          setStringModal({
            id: 'manual_doc_types',
            mode: 'category',
            title: 'Tipos de Documentos de Entrada',
            subtitle: 'Sincronizado com o módulo Notas & Entradas Manuais',
            placeholder: 'Ex: Guia de Trânsito, Recibo Rural...',
            items: snapshot.manualDocTypes,
            defaultItems: DEFAULT_MANUAL_ENTRY_DOCUMENT_TYPES,
            onSave: (items) => saveStoredManualEntryDocumentTypes(items),
          }),
      },
      {
        id: 'plano_contas_link',
        module: 'financeiro',
        title: 'Plano de Contas & Categorias Financeiras',
        description:
          'Classificação contábil e gerencial de receitas, despesas operacionais, custos diretos e DRE.',
        storageKey: 'colaca_silagem_plano_contas',
        count: snapshot.chartAccounts.length,
        preview: snapshot.chartAccounts.slice(0, 4).map((c) => c.nome),
        actionLabel: 'Gerenciar Plano de Contas',
        onOpen: () => onNavigateTab?.('plano_contas'),
      },
      {
        id: 'centros_custo_link',
        module: 'financeiro',
        title: 'Centros de Custo Operacionais',
        description:
          'Unidades gerenciais, fazendas, frentes de silagem e departamentos para rateio de custos.',
        storageKey: 'colaca_silagem_centros_custo',
        count: snapshot.costCenters.length,
        preview: snapshot.costCenters.slice(0, 4).map((c) => c.name),
        actionLabel: 'Gerenciar Centros',
        onOpen: () => onNavigateTab?.('centros_custo'),
      },

      // ===================== ESTOQUE & ALMOXARIFADO =====================
      {
        id: 'inventory_categories',
        module: 'estoque',
        title: 'Categorias de Estoque & Mão de Obra',
        description:
          'Categorias principais do cadastro de produtos, entradas por XML, requisições de almoxarifado e pneus.',
        storageKey: STOCK_CATEGORIES_STORAGE_KEY,
        count: snapshot.inventoryCats.length,
        preview: snapshot.inventoryCats.slice(0, 5),
        actionLabel: 'Gerenciar Categorias',
        onOpen: () =>
          setStringModal({
            id: 'inventory_categories',
            mode: 'category',
            title: 'Categorias de Estoque',
            subtitle: 'Sincronizado com Estoque, Almoxarifado e Notas de Entrada',
            placeholder: 'Ex: FERRAGENS E PARAFUSOS',
            items: snapshot.inventoryCats,
            defaultItems: DEFAULT_INVENTORY_CATEGORIES,
            onSave: (items) => saveStoredInventoryCategories(items),
          }),
      },
      {
        id: 'product_types',
        module: 'estoque',
        title: 'Tipos de Produto (Classificação Fiscal/Uso)',
        description:
          'Define a natureza do item no formulário de produtos (Revenda, Peça, Insumo, Consumo, Serviço).',
        storageKey: 'agrocontrol_produto_tipos_v2',
        count: snapshot.productTypes.length,
        preview: snapshot.productTypes.slice(0, 4),
        actionLabel: 'Editar Tipos',
        onOpen: () =>
          setStringModal({
            id: 'product_types',
            mode: 'classification',
            title: 'Tipos de Produto',
            subtitle: 'Sincronizado com o cadastro de Produtos do Estoque',
            placeholder: 'Ex: Ativo Imobilizado',
            items: snapshot.productTypes,
            defaultItems: DEFAULT_TIPO_PRODUTO_OPTIONS,
            onSave: (items) => saveTipoProdutoOptionsList(items),
          }),
      },
      {
        id: 'product_groups',
        module: 'estoque',
        title: 'Grupos de Produtos',
        description:
          'Agrupamentos de peças e insumos (Filtros, Rolamentos, Hidráulica, Sementes, Lonas, etc.).',
        storageKey: 'agrocontrol_produto_grupos_v2',
        count: snapshot.productGroups.length,
        preview: snapshot.productGroups.slice(0, 5),
        actionLabel: 'Editar Grupos',
        onOpen: () =>
          setStringModal({
            id: 'product_groups',
            mode: 'classification',
            title: 'Grupos de Produtos',
            subtitle: 'Sincronizado com o cadastro de Produtos do Estoque',
            placeholder: 'Ex: Injeção Eletrônica',
            items: snapshot.productGroups,
            defaultItems: DEFAULT_PRODUCT_GROUPS,
            onSave: (items) => saveProductGroupsList(items),
          }),
      },
      {
        id: 'product_subgroups',
        module: 'estoque',
        title: 'Subgrupos de Produtos (por Grupo)',
        description:
          'Subdivisões vinculadas a cada Grupo de Produto no cadastro detalhado de mercadorias.',
        storageKey: 'agrocontrol_produto_subgrupos_map_v2',
        count: snapshot.productSubgroups.length,
        preview: snapshot.productSubgroups.slice(0, 5),
        actionLabel: 'Gerenciar Subgrupos',
        onOpen: () => {
          setSelectedSubgroupGroup('__geral__');
          setNewSubgroupName('');
          setIsSubgroupsModalOpen(true);
        },
      },
      {
        id: 'product_variations',
        module: 'estoque',
        title: 'Variações & Especificações Técnicas',
        description:
          'Atributos auxiliares de produtos (Voltagem 12V/24V, Rosca Fina/Grossa, Lado Direito/Esquerdo, etc.).',
        storageKey: 'agrocontrol_produto_variacoes_v2',
        count: snapshot.productVariations.length,
        preview: snapshot.productVariations.slice(0, 5),
        actionLabel: 'Editar Variações',
        onOpen: () =>
          setStringModal({
            id: 'product_variations',
            mode: 'classification',
            title: 'Variações & Especificações',
            subtitle: 'Sincronizado com o cadastro de Produtos do Estoque',
            placeholder: 'Ex: Bitola 3/4"',
            items: snapshot.productVariations,
            defaultItems: DEFAULT_PRODUCT_VARIATIONS,
            onSave: (items) => saveProductVariationsList(items),
          }),
      },
      {
        id: 'product_brands',
        module: 'estoque',
        title: 'Marcas Comerciais de Produtos',
        description:
          'Fabricantes disponíveis no cadastro de produtos e filtros do estoque.',
        storageKey: 'agrocontrol_produto_marcas_v2',
        count: snapshot.productBrands.length,
        preview: snapshot.productBrands.slice(0, 5),
        actionLabel: 'Editar Marcas',
        onOpen: () =>
          setStringModal({
            id: 'product_brands',
            mode: 'classification',
            title: 'Marcas de Produtos',
            subtitle: 'Sincronizado com o cadastro de Produtos do Estoque',
            placeholder: 'Ex: Claas, Krone, Valtra...',
            items: snapshot.productBrands,
            defaultItems: DEFAULT_PRODUCT_BRANDS,
            onSave: (items) => saveProductBrandsList(items),
          }),
      },
      {
        id: 'units_of_measure',
        module: 'estoque',
        title: 'Unidades de Medida (UN, KG, LT, TON...)',
        description:
          'Siglas de unidade usadas no cadastro de produtos, entradas fiscais e requisições de almoxarifado.',
        storageKey: AUXILIARY_STORAGE_KEYS.UNIDADES_MEDIDA,
        count: snapshot.units.length,
        preview: snapshot.units.slice(0, 6),
        actionLabel: 'Editar Unidades',
        onOpen: () =>
          setStringModal({
            id: 'units_of_measure',
            mode: 'category',
            title: 'Unidades de Medida',
            subtitle: 'Sincronizado com o campo Unidade de Medida no Estoque',
            placeholder: 'Ex: BALDE, BOMBONA, HA',
            items: snapshot.units,
            defaultItems: DEFAULT_UNIDADES_MEDIDA,
            onSave: (items) => saveStoredUnidadesMedida(items),
          }),
      },
      {
        id: 'warehouse_sectors',
        module: 'estoque',
        title: 'Setores / Endereçamento Físico (Almoxarifado)',
        description:
          'Corredores, prateleiras e setores físicos sugeridos para guarda de peças e insumos.',
        storageKey: AUXILIARY_STORAGE_KEYS.ALMOXARIFADO_SETORES,
        count: snapshot.warehouseSectors.length,
        preview: snapshot.warehouseSectors.slice(0, 4),
        actionLabel: 'Editar Setores',
        onOpen: () =>
          setStringModal({
            id: 'warehouse_sectors',
            mode: 'category',
            title: 'Setores do Almoxarifado',
            subtitle: 'Sincronizado com o campo Localização Física / Setor do Estoque',
            placeholder: 'Ex: 07 - CORREDOR B / PRATELEIRA 2',
            items: snapshot.warehouseSectors,
            defaultItems: DEFAULT_ALMOXARIFADO_SETORES,
            onSave: (items) => saveStoredAlmoxarifadoSetores(items),
          }),
      },
      {
        id: 'stock_services',
        module: 'estoque',
        title: 'Serviços Padrão de Estoque / Mão de Obra',
        description:
          'Lista de serviços internos/oficina vinculados ao catálogo do almoxarifado e OS de manutenção.',
        storageKey: 'colaca_silagem_servicos_estoque',
        count: snapshot.stockServices.length,
        preview: snapshot.stockServices.slice(0, 4),
        actionLabel: 'Editar Serviços',
        onOpen: () =>
          setStringModal({
            id: 'stock_services',
            mode: 'category',
            title: 'Serviços Padrão de Estoque / Oficina',
            subtitle: 'Sincronizado com Ordens de Serviço e Catálogo de Serviços no Estoque',
            placeholder: 'Ex: REVISÃO ELÉTRICA COMPLETA',
            items: snapshot.stockServices,
            defaultItems: DEFAULT_STOCK_SERVICES,
            onSave: (items) => saveStoredStockServices(items),
          }),
      },
      {
        id: 'silage_product_types',
        module: 'estoque',
        title: 'Tipos de Produto de Silagem (Venda / PDV)',
        description:
          'Culturas e tipos de silagem disponíveis nas vendas diretas e contratos de fornecimento.',
        storageKey: STORAGE_KEYS.SILAGE_PRODUCT_TYPES,
        count: snapshot.silageProductTypes.length,
        preview: snapshot.silageProductTypes.slice(0, 5),
        actionLabel: 'Editar Produtos',
        onOpen: () =>
          setStringModal({
            id: 'silage_product_types',
            mode: 'category',
            title: 'Tipos de Produto de Silagem',
            subtitle: 'Sincronizado com o módulo de Vendas (PDV) e Contratos',
            placeholder: 'Ex: Silagem de Trigo / Aveia',
            items: snapshot.silageProductTypes,
            defaultItems: DEFAULT_SILAGE_PRODUCT_TYPES,
            onSave: (items) => saveStoredSilageProductTypes(items),
          }),
      },
      {
        id: 'troca_motivos',
        module: 'estoque',
        title: 'Motivos de Trocas & Devoluções (Vendas)',
        description:
          'Justificativas padronizadas no registro de trocas e devoluções comerciais.',
        storageKey: AUXILIARY_STORAGE_KEYS.TROCAS_MOTIVOS,
        count: snapshot.trocaMotivos.length,
        preview: snapshot.trocaMotivos.slice(0, 4),
        actionLabel: 'Editar Motivos',
        onOpen: () =>
          setStringModal({
            id: 'troca_motivos',
            mode: 'category',
            title: 'Motivos de Trocas & Devoluções',
            subtitle: 'Sincronizado com o modal Nova Troca / Devolução no módulo Venda',
            placeholder: 'Ex: Divergência de Lote',
            items: snapshot.trocaMotivos,
            defaultItems: DEFAULT_TROCA_MOTIVOS_LIST,
            onSave: (items) => saveStoredAuxTrocaMotivos(items),
          }),
      },

      // ===================== FROTAS & MANUTENÇÃO =====================
      {
        id: 'maintenance_categories',
        module: 'frota',
        title: 'Categorias de Manutenção (Oficina / OS)',
        description:
          'Especialidades de manutenção usadas nas Ordens de Serviço da frota com cores e descrições.',
        storageKey: STORAGE_KEYS.MAINTENANCE_CATEGORIES,
        count: snapshot.maintenanceCats.length,
        preview: snapshot.maintenanceCats.slice(0, 4).map((c) => c.name),
        actionLabel: 'Gerenciar Categorias',
        onOpen: () => setIsMaintenanceCatsModalOpen(true),
      },
      {
        id: 'vehicle_system_categories',
        module: 'frota',
        title: 'Categorias de Veículos & Máquinas',
        description:
          'Classes operacionais de ativos (Trator Agrícola, Ensiladeira, Caminhão, Implemento, etc.).',
        storageKey: STORAGE_KEYS.VEHICLE_SYSTEM_CATEGORIES,
        count: snapshot.vehicleSystemCats.length,
        preview: snapshot.vehicleSystemCats.slice(0, 4),
        actionLabel: 'Editar Categorias',
        onOpen: () =>
          setStringModal({
            id: 'vehicle_system_categories',
            mode: 'category',
            title: 'Categorias de Veículos & Máquinas',
            subtitle: 'Sincronizado com o cadastro de Máquinas e Frota',
            placeholder: 'Ex: EMPILHADEIRA / GUINDAUTO',
            items: snapshot.vehicleSystemCats,
            defaultItems: DEFAULT_VEHICLE_SYSTEM_CATEGORIES,
            onSave: (items) => saveStoredVehicleSystemCategories(items),
          }),
      },
      {
        id: 'vehicle_types_config',
        module: 'frota',
        title: 'Tipos de Veículos, Eixos & Planos Preventivos',
        description:
          'Configuração estrutural de rodagem (eixos/pneus) e planos de manutenção preventiva por tipo.',
        storageKey: STORAGE_KEYS.VEHICLE_TYPES,
        count: snapshot.vehicleTypes.length,
        preview: snapshot.vehicleTypes.slice(0, 4).map((v) => v.name),
        actionLabel: 'Configurar Tipos & Eixos',
        onOpen: () => setIsVehicleTypesModalOpen(true),
      },
      {
        id: 'vehicle_ownership_regimes',
        module: 'frota',
        title: 'Regimes de Posse / Propriedade de Veículos',
        description:
          'Vínculo patrimonial das máquinas e caminhões (Próprio, Terceiros, Alugado, Financiado).',
        storageKey: STORAGE_KEYS.VEHICLE_OWNERSHIP_REGIMES,
        count: snapshot.ownershipRegimes.length,
        preview: snapshot.ownershipRegimes,
        actionLabel: 'Editar Regimes',
        onOpen: () =>
          setStringModal({
            id: 'vehicle_ownership_regimes',
            mode: 'category',
            title: 'Regimes de Propriedade de Veículos',
            subtitle: 'Sincronizado com o cadastro de Frota e Máquinas',
            placeholder: 'Ex: Consórcio Contemplado',
            items: snapshot.ownershipRegimes,
            defaultItems: DEFAULT_VEHICLE_OWNERSHIP_REGIMES,
            onSave: (items) => saveStoredVehicleOwnershipRegimes(items),
          }),
      },
      {
        id: 'fuel_types',
        module: 'frota',
        title: 'Tipos de Combustíveis & Arla',
        description:
          'Lista de combustíveis disponíveis para abastecimentos externos e internos da frota.',
        storageKey: AUXILIARY_STORAGE_KEYS.TIPOS_COMBUSTIVEL,
        count: snapshot.fuelTypes.length,
        preview: snapshot.fuelTypes,
        actionLabel: 'Editar Combustíveis',
        onOpen: () =>
          setStringModal({
            id: 'fuel_types',
            mode: 'category',
            title: 'Tipos de Combustíveis & Arla',
            subtitle: 'Sincronizado com o modal de Abastecimento de Frota',
            placeholder: 'Ex: Diesel S10 Aditivado',
            items: snapshot.fuelTypes,
            defaultItems: DEFAULT_TIPOS_COMBUSTIVEL,
            onSave: (items) => saveStoredTiposCombustivel(items),
          }),
      },
      {
        id: 'tire_brands',
        module: 'frota',
        title: 'Marcas de Pneus (Frota & Estoque)',
        description:
          'Fabricantes de pneus exibidos no cadastro de estoque de pneus e movimentação de eixos.',
        storageKey: AUXILIARY_STORAGE_KEYS.MARCAS_PNEUS,
        count: snapshot.tireBrands.length,
        preview: snapshot.tireBrands.slice(0, 6),
        actionLabel: 'Editar Marcas',
        onOpen: () =>
          setStringModal({
            id: 'tire_brands',
            mode: 'category',
            title: 'Marcas de Pneus',
            subtitle: 'Sincronizado com Cadastro de Pneus no Estoque e Gestão de Frota',
            placeholder: 'Ex: PIRELLI, XBRI, LINGLONG',
            items: snapshot.tireBrands,
            defaultItems: DEFAULT_TIRE_BRANDS_LIST,
            onSave: (items) => saveStoredAuxTireBrands(items),
          }),
      },
      {
        id: 'fuel_tanks',
        module: 'frota',
        title: 'Tanques de Combustível da Fazenda',
        description:
          'Reservatórios internos (Diesel S10, S500, Arla 32), capacidades nominais e saldos atuais.',
        storageKey: STORAGE_KEYS.TANQUES_COMBUSTIVEL,
        count: snapshot.fuelTanks.length,
        preview: snapshot.fuelTanks.map((t) => `${t.nome} (${t.capacidade_total} L)`),
        actionLabel: 'Configurar Tanques',
        onOpen: () => {
          setTanksDraft(snapshot.fuelTanks.map((t) => ({ ...t })));
          setIsTanksModalOpen(true);
        },
      },
      {
        id: 'placas_terceiros',
        module: 'frota',
        title: '🚚 Placas & Veículos de Terceiros (Transportadoras)',
        description:
          'Placas de caminhões e transportadoras terceirizadas memorizadas automaticamente ao emitir NF-e de venda, remessa ou retorno.',
        storageKey: AUXILIARY_STORAGE_KEYS.PLACAS_TERCEIROS,
        count: snapshot.placasTerceiros.length,
        preview: snapshot.placasTerceiros
          .slice(0, 5)
          .map((p) => `${p.placa}${p.uf ? ` (${p.uf})` : ''}${p.transportadoraNome ? ` - ${p.transportadoraNome.slice(0, 18)}` : ''}`),
        actionLabel: 'Gerenciar Placas',
        onOpen: () => setIsPlacasTerceirosModalOpen(true),
      },

      // ===================== RH & EQUIPE =====================
      {
        id: 'cargos_permissoes_link',
        module: 'rh',
        title: 'Cargos & Permissões de Acesso (RBAC)',
        description:
          'Perfis de usuário, níveis hierárquicos e permissões granulares por módulo/aba.',
        storageKey: 'agrocontrol_cargos',
        count: snapshot.cargos.length,
        preview: snapshot.cargos.slice(0, 4).map((c) => c.nome),
        actionLabel: 'Gerenciar Perfis RBAC',
        onOpen: () => onNavigateTab?.('cargos_permissoes'),
      },
      {
        id: 'rh_roles_aux',
        module: 'rh',
        title: 'Cargos / Funções Operacionais (Formulário RH)',
        description:
          'Opções do seletor de Cargo/Função na ficha cadastral de colaboradores e motoristas.',
        storageKey: AUXILIARY_STORAGE_KEYS.RH_ROLES,
        count: snapshot.rhRoles.length,
        preview: snapshot.rhRoles.slice(0, 5),
        actionLabel: 'Editar Funções',
        onOpen: () =>
          setStringModal({
            id: 'rh_roles_aux',
            mode: 'category',
            title: 'Cargos / Funções Operacionais (RH)',
            subtitle: 'Sincronizado com o cadastro de Colaboradores no RH',
            placeholder: 'Ex: Técnico Agrícola',
            items: snapshot.rhRoles,
            defaultItems: DEFAULT_RH_ROLES,
            onSave: (items) => saveStoredRhRoles(items),
          }),
      },
      {
        id: 'rh_reg_types',
        module: 'rh',
        title: 'Tipos de Vínculo Contratual (RH)',
        description:
          'Classificações de registro de equipe (Funcionário, Agenciador, Safrista, Prestador, etc.).',
        storageKey: AUXILIARY_STORAGE_KEYS.RH_REG_TYPES,
        count: snapshot.rhRegTypes.length,
        preview: snapshot.rhRegTypes.slice(0, 5),
        actionLabel: 'Editar Vínculos',
        onOpen: () =>
          setStringModal({
            id: 'rh_reg_types',
            mode: 'category',
            title: 'Tipos de Vínculo Contratual',
            subtitle: 'Sincronizado com o cadastro de Colaboradores no RH',
            placeholder: 'Ex: Estagiário / Aprendiz',
            items: snapshot.rhRegTypes,
            defaultItems: DEFAULT_RH_REG_TYPES,
            onSave: (items) => saveStoredRhRegTypes(items),
          }),
      },
      {
        id: 'rh_contract_types',
        module: 'rh',
        title: 'Modalidades / Tipos de Contrato (RH)',
        description:
          'Formas de contratação exibidas no perfil salarial do colaborador (CLT, PJ, Temporário, etc.).',
        storageKey: AUXILIARY_STORAGE_KEYS.RH_CONTRACT_TYPES,
        count: snapshot.rhContractTypes.length,
        preview: snapshot.rhContractTypes,
        actionLabel: 'Editar Modalidades',
        onOpen: () =>
          setStringModal({
            id: 'rh_contract_types',
            mode: 'category',
            title: 'Modalidades de Contrato (RH)',
            subtitle: 'Sincronizado com o cadastro de Colaboradores no RH',
            placeholder: 'Ex: Contrato por Safra Determinada',
            items: snapshot.rhContractTypes,
            defaultItems: DEFAULT_RH_CONTRACT_TYPES,
            onSave: (items) => saveStoredRhContractTypes(items),
          }),
      },
      {
        id: 'rh_absence_types',
        module: 'rh',
        title: 'Tipos de Ocorrências & Faltas (RH)',
        description:
          'Motivos de faltas, atrasos e suspensões lançados no controle de frequência do RH.',
        storageKey: AUXILIARY_STORAGE_KEYS.TIPOS_OCORRENCIAS_FALTAS,
        count: snapshot.absenceTypes.length,
        preview: snapshot.absenceTypes.map((o) => o.label),
        actionLabel: 'Editar Ocorrências',
        onOpen: () =>
          setKeyLabelModal({
            id: 'rh_absence_types',
            title: 'Tipos de Ocorrências & Faltas',
            subtitle: 'Sincronizado com o modal de Lançamento de Faltas no RH',
            items: snapshot.absenceTypes,
            defaultItems: DEFAULT_TIPOS_OCORRENCIAS_FALTAS,
            onSave: (items) => saveStoredTiposOcorrenciasFaltas(items),
          }),
      },
      {
        id: 'rh_leave_types',
        module: 'rh',
        title: 'Tipos de Afastamentos (INSS / Licenças)',
        description:
          'Categorias usadas na aba de Afastamentos do RH (CAT, Auxílio-Doença, Licenças, etc.).',
        storageKey: AUXILIARY_STORAGE_KEYS.TIPOS_AFASTAMENTO,
        count: snapshot.leaveTypes.length,
        preview: snapshot.leaveTypes,
        actionLabel: 'Editar Afastamentos',
        onOpen: () =>
          setStringModal({
            id: 'rh_leave_types',
            mode: 'category',
            title: 'Tipos de Afastamentos (RH)',
            subtitle: 'Sincronizado com a aba Afastamentos do RH',
            placeholder: 'Ex: Licença Gala / Nojo',
            items: snapshot.leaveTypes,
            defaultItems: DEFAULT_TIPOS_AFASTAMENTO,
            onSave: (items) => saveStoredTiposAfastamento(items),
          }),
      },
      {
        id: 'rh_atestado_types',
        module: 'rh',
        title: 'Tipos de Atestados & Declarações',
        description:
          'Classificações disponíveis na aba Atestados do RH e nos filtros de ocorrências médicas.',
        storageKey: AUXILIARY_STORAGE_KEYS.TIPOS_ATESTADOS,
        count: snapshot.atestadoTypes.length,
        preview: snapshot.atestadoTypes,
        actionLabel: 'Editar Atestados',
        onOpen: () =>
          setStringModal({
            id: 'rh_atestado_types',
            mode: 'category',
            title: 'Tipos de Atestados & Declarações',
            subtitle: 'Sincronizado com a aba Atestados do RH',
            placeholder: 'Ex: Declaração de Comparecimento Escolar',
            items: snapshot.atestadoTypes,
            defaultItems: DEFAULT_TIPOS_ATESTADOS,
            onSave: (items) => saveStoredTiposAtestados(items),
          }),
      },
      {
        id: 'rh_aso_purposes',
        module: 'rh',
        title: 'Finalidades de Encaminhamento ASO',
        description:
          'Tipos de exames ocupacionais na emissão de Guias ASO (Admissional, Periódico, Retorno, etc.).',
        storageKey: AUXILIARY_STORAGE_KEYS.ASO_FINALIDADES,
        count: snapshot.asoPurposes.length,
        preview: snapshot.asoPurposes,
        actionLabel: 'Editar Finalidades',
        onOpen: () =>
          setStringModal({
            id: 'rh_aso_purposes',
            mode: 'category',
            title: 'Finalidades de Encaminhamento ASO',
            subtitle: 'Sincronizado com a Guia de Encaminhamento ASO no RH',
            placeholder: 'Ex: Avaliação Complementar NR-35',
            items: snapshot.asoPurposes,
            defaultItems: [...ASO_EXAM_PURPOSES],
            onSave: (items) => saveStoredAsoFinalidades(items),
          }),
      },
      {
        id: 'rh_aso_exams',
        module: 'rh',
        title: 'Exames Ocupacionais da Guia ASO',
        description:
          'Lista de exames médicos/clínicos selecionáveis ao emitir uma Guia de Encaminhamento ASO.',
        storageKey: AUXILIARY_STORAGE_KEYS.ASO_EXAMES,
        count: snapshot.asoExams.length,
        preview: snapshot.asoExams.slice(0, 5).map((e) => e.label),
        actionLabel: 'Editar Exames ASO',
        onOpen: () =>
          setKeyLabelModal({
            id: 'rh_aso_exams',
            title: 'Exames Ocupacionais da Guia ASO',
            subtitle: 'Sincronizado com o modal de Guia de Encaminhamento ASO no RH',
            items: snapshot.asoExams,
            defaultItems: ASO_EXAM_OPTIONS,
            onSave: (items) => saveStoredAsoExames(items),
          }),
      },

      // ===================== CLIENTES, FORNECEDORES & SERVIÇOS =====================
      {
        id: 'client_activities',
        module: 'crm',
        title: 'Atividades Agropecuárias de Clientes',
        description:
          'Segmentos produtivos no cadastro de Clientes & Fazendas (Gado de Leite, Corte, Grãos, etc.).',
        storageKey: 'agrocontrol_atividades_catalog',
        count: snapshot.clientActivities.length,
        preview: snapshot.clientActivities.slice(0, 5).map((a) => a.label),
        actionLabel: 'Gerenciar Atividades',
        onOpen: () =>
          setClientModal({
            id: 'client_activities',
            title: 'Atividades Agropecuárias de Clientes',
            subtitle: 'Sincronizado com o módulo de Clientes & Fazendas',
            inputLabel: 'Nova atividade agropecuária',
            inputPlaceholder: 'Ex: Suinocultura / Avicultura',
            items: snapshot.clientActivities,
            onSave: (updated) => {
              saveStoredAtividadesCatalog(updated);
              dispatchAuxiliaryRegistryChange('agrocontrol_atividades_updated', updated);
            },
          }),
      },
      {
        id: 'crm_statuses',
        module: 'crm',
        title: 'Status do Funil CRM (Clientes)',
        description:
          'Estágios comerciais da carteira de clientes (Lead, Em Negociação, Cliente Ativo, VIP, etc.).',
        storageKey: 'agrocontrol_crm_status_catalog',
        count: snapshot.crmStatuses.length,
        preview: snapshot.crmStatuses.slice(0, 5).map((s) => s.label),
        actionLabel: 'Gerenciar Status CRM',
        onOpen: () =>
          setClientModal({
            id: 'crm_statuses',
            title: 'Status do Funil CRM',
            subtitle: 'Sincronizado com o cadastro e funil de Clientes',
            inputLabel: 'Novo status CRM',
            inputPlaceholder: 'Ex: Contrato Renovado',
            items: snapshot.crmStatuses,
            onSave: (updated) => {
              saveStoredCrmStatusCatalog(updated);
              dispatchAuxiliaryRegistryChange('agrocontrol_crm_status_updated', updated);
            },
          }),
      },
      {
        id: 'client_interest_services',
        module: 'crm',
        title: 'Serviços de Interesse (Clientes)',
        description:
          'Tags de serviços demandados marcadas na ficha de cada cliente (Corte, Colheita, Silagem, etc.).',
        storageKey: 'agrocontrol_servicos_interesse_catalog',
        count: snapshot.clientInterestServices.length,
        preview: snapshot.clientInterestServices.slice(0, 5).map((s) => s.label),
        actionLabel: 'Gerenciar Serviços',
        onOpen: () =>
          setClientModal({
            id: 'client_interest_services',
            title: 'Serviços de Interesse (Clientes)',
            subtitle: 'Sincronizado com a ficha cadastral de Clientes',
            inputLabel: 'Novo serviço de interesse',
            inputPlaceholder: 'Ex: Adubação em Taxa Variável',
            items: snapshot.clientInterestServices,
            onSave: (updated) => {
              saveStoredClientServicesCatalog(updated);
              dispatchAuxiliaryRegistryChange('agrocontrol_servicos_interesse_updated', updated);
            },
          }),
      },
      {
        id: 'cattle_types',
        module: 'crm',
        title: 'Tipos de Gado / Rebanho',
        description:
          'Classificação do perfil pecuário vinculado aos clientes e propriedades rurais.',
        storageKey: STORAGE_KEYS.CATTLE_TYPES,
        count: snapshot.cattleTypes.length,
        preview: snapshot.cattleTypes,
        actionLabel: 'Editar Tipos de Gado',
        onOpen: () =>
          setStringModal({
            id: 'cattle_types',
            mode: 'category',
            title: 'Tipos de Gado / Rebanho',
            subtitle: 'Sincronizado com o perfil pecuário de Clientes',
            placeholder: 'Ex: Recria a Pasto',
            items: snapshot.cattleTypes,
            defaultItems: DEFAULT_CATTLE_TYPES,
            onSave: (items) => saveStoredCattleTypes(items),
          }),
      },
      {
        id: 'supplier_categories',
        module: 'crm',
        title: 'Categorias de Fornecedores',
        description:
          'Segmentação dos fornecedores (Peças, Combustível, Oficina Terceirizada, Insumos, etc.).',
        storageKey: 'agrocontrol_fornecedor_categorias_catalog',
        count: snapshot.supplierCategories.length,
        preview: snapshot.supplierCategories.slice(0, 5).map((c) => c.label),
        actionLabel: 'Gerenciar Categorias',
        onOpen: () =>
          setClientModal({
            id: 'supplier_categories',
            title: 'Categorias de Fornecedores',
            subtitle: 'Sincronizado com o módulo de Fornecedores',
            inputLabel: 'Nova categoria de fornecedor',
            inputPlaceholder: 'Ex: Borracharia / Recapagem',
            items: snapshot.supplierCategories,
            onSave: (updated) => {
              saveStoredSupplierCategoriesCatalog(updated);
              dispatchAuxiliaryRegistryChange('agrocontrol_fornecedor_categorias_updated', updated);
            },
          }),
      },
      {
        id: 'service_types',
        module: 'crm',
        title: 'Tipos de Serviços Prestados (Campo / Lavoura)',
        description:
          'Catálogo base de serviços agrícolas utilizados em agendas, orçamentos e prestação de serviços.',
        storageKey: STORAGE_KEYS.SERVICE_TYPES,
        count: snapshot.serviceTypes.length,
        preview: snapshot.serviceTypes.slice(0, 5),
        actionLabel: 'Editar Serviços',
        onOpen: () =>
          setStringModal({
            id: 'service_types',
            mode: 'category',
            title: 'Tipos de Serviços Prestados',
            subtitle: 'Sincronizado com Agenda, Orçamentos e Prestação de Serviços',
            placeholder: 'Ex: Gradagem & Subsolagem',
            items: snapshot.serviceTypes,
            defaultItems: DEFAULT_SERVICE_TYPES,
            onSave: (items) => saveStoredServiceTypes(items),
          }),
      },
    ];
  }, [globalPaymentMethods, onNavigateTab, snapshot]);

  const filteredCards = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return cards.filter((card) => {
      if (selectedModule !== 'all' && card.module !== selectedModule) return false;
      if (!q) return true;
      return (
        card.title.toLowerCase().includes(q) ||
        card.description.toLowerCase().includes(q) ||
        card.storageKey.toLowerCase().includes(q) ||
        card.preview.some((p) => p.toLowerCase().includes(q))
      );
    });
  }, [cards, searchTerm, selectedModule]);

  const totalRecordsCount = useMemo(
    () => cards.reduce((acc, c) => acc + c.count, 0),
    [cards]
  );

  // Handlers Subgrupos por Grupo
  const activeSubgroupsList = useMemo(
    () => getSuggestedSubgroupsForGroup(selectedSubgroupGroup),
    [selectedSubgroupGroup, syncVersion]
  );

  const handleAddSubgroup = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newSubgroupName.trim();
    if (!clean) return;
    if (activeSubgroupsList.some((s) => s.toLowerCase() === clean.toLowerCase())) return;
    saveProductSubgroupsList(selectedSubgroupGroup, [...activeSubgroupsList, clean]);
    setNewSubgroupName('');
  };

  const handleRemoveSubgroup = (item: string) => {
    saveProductSubgroupsList(
      selectedSubgroupGroup,
      activeSubgroupsList.filter((s) => s !== item)
    );
  };

  // Handlers KeyLabel Modal (Ocorrências RH & Exames ASO)
  const handleAddKeyLabel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyLabelModal) return;
    const label = newKeyLabelText.trim();
    if (!label) return;
    const id =
      label
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || `item_${Date.now()}`;
    if (keyLabelModal.items.some((i) => i.id === id || i.label.toLowerCase() === label.toLowerCase())) {
      return;
    }
    const updated = [...keyLabelModal.items, { id, label }];
    keyLabelModal.onSave(updated);
    setKeyLabelModal({ ...keyLabelModal, items: updated });
    setNewKeyLabelText('');
  };

  const handleSaveKeyLabelEdit = (id: string) => {
    if (!keyLabelModal) return;
    const label = editingKeyLabelValue.trim();
    if (!label) return;
    const updated = keyLabelModal.items.map((item) =>
      item.id === id ? { ...item, label } : item
    );
    keyLabelModal.onSave(updated);
    setKeyLabelModal({ ...keyLabelModal, items: updated });
    setEditingKeyLabelId(null);
    setEditingKeyLabelValue('');
  };

  const handleDeleteKeyLabel = (id: string) => {
    if (!keyLabelModal) return;
    const updated = keyLabelModal.items.filter((item) => item.id !== id);
    keyLabelModal.onSave(updated);
    setKeyLabelModal({ ...keyLabelModal, items: updated });
  };

  const handleResetKeyLabel = () => {
    if (!keyLabelModal) return;
    const defaults = keyLabelModal.defaultItems.map((d) => ({ ...d }));
    keyLabelModal.onSave(defaults);
    setKeyLabelModal({ ...keyLabelModal, items: defaults });
  };

  // Handlers Tanques
  const handleSaveTanks = () => {
    saveStoredTanquesCombustivel(tanksDraft);
    setIsTanksModalOpen(false);
  };

  const getModuleBadge = (mod: Exclude<AuxModuleCategory, 'all'>) => {
    switch (mod) {
      case 'financeiro':
        return { label: 'Financeiro & Fiscal', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
      case 'estoque':
        return { label: 'Estoque & Almoxarifado', cls: 'bg-amber-100 text-amber-800 border-amber-300' };
      case 'frota':
        return { label: 'Frotas & Manutenção', cls: 'bg-blue-100 text-blue-800 border-blue-300' };
      case 'rh':
        return { label: 'RH & Equipe', cls: 'bg-purple-100 text-purple-800 border-purple-300' };
      case 'crm':
        return { label: 'Clientes & Serviços', cls: 'bg-cyan-100 text-cyan-800 border-cyan-300' };
    }
  };

  return (
    <div className="space-y-3">
      {/* Cabeçalho Informativo + Indicadores */}
      <div className="bg-white dark:bg-stone-950 border border-slate-300 dark:border-stone-700 rounded-lg p-3 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          <div className="flex items-start gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-600/15 border border-emerald-500/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400 shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">
                Central de Cadastros Auxiliares & Tabelas de Apoio
              </h2>
              <p className="text-xs text-slate-600 dark:text-stone-400">
                Todas as listas auxiliares, seletores e catálogos de suporte do AgroControl com{' '}
                <strong className="text-emerald-700 dark:text-emerald-400">
                  sincronização bidirecional instantânea
                </strong>{' '}
                com os formulários de origem.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-stone-900 border border-slate-300 dark:border-stone-700 text-center">
              <div className="text-[10px] font-bold uppercase text-slate-500">Tabelas Conectadas</div>
              <div className="text-sm font-black text-slate-900 dark:text-white">{cards.length}</div>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 text-center">
              <div className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400">
                Opções Ativas
              </div>
              <div className="text-sm font-black text-emerald-800 dark:text-emerald-300">
                {totalRecordsCount}
              </div>
            </div>
          </div>
        </div>

        {/* Busca + Filtros por Módulo */}
        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-stone-800 flex flex-col md:flex-row gap-2.5 md:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar tabela auxiliar, módulo, chave ou termo..."
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                title="Limpar busca"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {MODULE_TABS.map((tab) => {
              const active = selectedModule === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedModule(tab.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide border transition cursor-pointer ${
                    active
                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-stone-900 dark:hover:bg-stone-800 text-slate-700 dark:text-stone-300 border-slate-300 dark:border-stone-700'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Grid de Cards das Tabelas Auxiliares */}
      {filteredCards.length === 0 ? (
        <div className="bg-white dark:bg-stone-950 border border-slate-300 dark:border-stone-700 rounded-lg p-8 text-center">
          <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-700 dark:text-stone-300">
            Nenhuma tabela auxiliar encontrada para "{searchTerm}".
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setSelectedModule('all');
            }}
            className="mt-2 px-3 py-1 text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
          >
            Mostrar todas as tabelas ({cards.length})
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
          {filteredCards.map((card) => {
            const badge = getModuleBadge(card.module);
            return (
              <div
                key={card.id}
                className="bg-white dark:bg-stone-950 border border-slate-300 dark:border-stone-700 rounded-lg p-3 shadow-xs flex flex-col justify-between gap-2.5 hover:border-emerald-500/70 transition"
              >
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wide ${badge.cls}`}
                    >
                      {badge.label}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 dark:bg-stone-900 border border-slate-300 dark:border-stone-700 text-[10px] font-black text-slate-800 dark:text-stone-200">
                      {card.count} {card.count === 1 ? 'item' : 'itens'}
                    </span>
                  </div>

                  <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white leading-snug">
                    {card.title}
                  </h3>
                  <p className="text-[11px] text-slate-600 dark:text-stone-400 leading-relaxed">
                    {card.description}
                  </p>

                  {card.preview.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {card.preview.map((item, idx) => (
                        <span
                          key={`${card.id}_prev_${idx}`}
                          className="inline-block max-w-[180px] truncate px-1.5 py-0.5 rounded bg-slate-100 dark:bg-stone-900 border border-slate-200 dark:border-stone-800 text-[10px] font-medium text-slate-700 dark:text-stone-300"
                          title={item}
                        >
                          {item}
                        </span>
                      ))}
                      {card.count > card.preview.length && (
                        <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                          +{card.count - card.preview.length}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-stone-800 flex items-center justify-between gap-2">
                  <span
                    className="text-[10px] font-mono text-slate-400 truncate max-w-[160px]"
                    title={card.storageKey}
                  >
                    {card.storageKey}
                  </span>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {card.secondaryTab && (
                      <button
                        type="button"
                        onClick={() => onNavigateTab?.(card.secondaryTab!.tab)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 dark:border-stone-700 bg-slate-100 hover:bg-slate-200 dark:bg-stone-900 dark:hover:bg-stone-800 text-[11px] font-bold text-slate-700 dark:text-stone-200 cursor-pointer"
                        title={card.secondaryTab.label}
                      >
                        <ArrowUpRight className="w-3 h-3" />
                        <span>Aba</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={card.onOpen}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-xs cursor-pointer transition"
                    >
                      <Settings className="w-3 h-3" />
                      <span>{card.actionLabel}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===================== MODAIS INTEGRADOS ===================== */}

      {/* 1. Modal genérico de Categorias Simples */}
      {stringModal && stringModal.mode === 'category' && (
        <CategoryOptionsManagerModal
          isOpen={true}
          onClose={() => setStringModal(null)}
          title={stringModal.title}
          subtitle={stringModal.subtitle}
          items={stringModal.items}
          defaultItems={stringModal.defaultItems}
          placeholder={stringModal.placeholder}
          zIndexClass="z-[9999]"
          onSaveItems={(updated) => {
            stringModal.onSave(updated);
            setStringModal((prev) => (prev ? { ...prev, items: updated } : null));
          }}
        />
      )}

      {/* 2. Modal de Classificação de Produtos */}
      {stringModal && stringModal.mode === 'classification' && (
        <ClassificationListManagerModal
          isOpen={true}
          onClose={() => setStringModal(null)}
          title={stringModal.title}
          subtitle={stringModal.subtitle}
          items={stringModal.items}
          defaultItems={stringModal.defaultItems}
          placeholder={stringModal.placeholder}
          zIndexClass="z-[9999]"
          onSaveItems={(updated) => {
            stringModal.onSave(updated);
            setStringModal((prev) => (prev ? { ...prev, items: updated } : null));
          }}
        />
      )}

      {/* 3. Modal de Opções CRM / Clientes / Fornecedores */}
      {clientModal && (
        <ClientOptionsManagerModal
          isOpen={true}
          onClose={() => setClientModal(null)}
          title={clientModal.title}
          subtitle={clientModal.subtitle}
          inputLabel={clientModal.inputLabel}
          inputPlaceholder={clientModal.inputPlaceholder}
          items={clientModal.items}
          zIndexClass="z-[9999]"
          onSave={(updated) => {
            clientModal.onSave(updated);
            setClientModal((prev) => (prev ? { ...prev, items: updated } : null));
          }}
        />
      )}

      {/* 4. Modal Global de Formas de Pagamento */}
      <PaymentMethodsManagerModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        zIndexClass="z-[9999]"
      />

      {/* 5. Catálogo CFOP */}
      <CfopManagerModal
        isOpen={isCfopModalOpen}
        onClose={() => setIsCfopModalOpen(false)}
        catalog={snapshot.cfops}
        onSaveCatalog={(updated) => {
          saveStoredCfopCatalog(updated);
          dispatchAuxiliaryRegistryChange('agrocontrol_cfop_updated', updated);
        }}
      />

      {/* 6. Códigos LC 116/03 */}
      <Lc116ServiceCodeManagerModal
        isOpen={isLc116ModalOpen}
        onClose={() => setIsLc116ModalOpen(false)}
        codes={snapshot.lc116}
        onSaveCodes={(updated) => {
          saveStoredLc116ServiceCodes(updated);
          dispatchAuxiliaryRegistryChange('agrocontrol_codigos_lc116_updated', updated);
        }}
      />

      {/* 7. Categorias de Manutenção */}
      <MaintenanceCategoriesModal
        isOpen={isMaintenanceCatsModalOpen}
        onClose={() => setIsMaintenanceCatsModalOpen(false)}
        categories={snapshot.maintenanceCats}
        onSaveCategories={(updated) => saveStoredMaintenanceCategories(updated)}
      />

      {/* 8. Tipos de Veículos, Eixos & Preventivas */}
      <VehicleTypesConfigModal
        isOpen={isVehicleTypesModalOpen}
        onClose={() => setIsVehicleTypesModalOpen(false)}
        vehicleTypes={snapshot.vehicleTypes}
        onSaveVehicleTypes={(updated) => saveStoredVehicleTypes(updated)}
      />

      {/* 9. Modal Dedicado: Subgrupos por Grupo de Produto */}
      {isSubgroupsModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-950 w-full max-w-lg rounded-xl border border-slate-300 dark:border-stone-700 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
            <div className="px-4 py-3 bg-slate-100 dark:bg-stone-900 border-b border-slate-200 dark:border-stone-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-600" />
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase">
                    Subgrupos de Produtos por Grupo
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Selecione o grupo e gerencie os subgrupos disponíveis no Estoque
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSubgroupsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600 dark:text-stone-400 mb-1">
                  Grupo Vinculado
                </label>
                <select
                  value={selectedSubgroupGroup}
                  onChange={(e) => setSelectedSubgroupGroup(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="__geral__">Lista Geral (Todos os Subgrupos)</option>
                  {snapshot.productGroups.map((g) => (
                    <option key={g} value={g}>
                      Grupo: {g}
                    </option>
                  ))}
                </select>
              </div>

              <form onSubmit={handleAddSubgroup} className="flex gap-2">
                <input
                  type="text"
                  value={newSubgroupName}
                  onChange={(e) => setNewSubgroupName(e.target.value)}
                  placeholder="Novo subgrupo para este grupo..."
                  className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-lg"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar</span>
                </button>
              </form>

              <div className="border border-slate-200 dark:border-stone-800 rounded-lg divide-y divide-slate-200 dark:divide-stone-800 max-h-64 overflow-y-auto">
                {activeSubgroupsList.length === 0 ? (
                  <p className="p-4 text-xs text-slate-500 text-center">
                    Nenhum subgrupo cadastrado para este grupo.
                  </p>
                ) : (
                  activeSubgroupsList.map((sub) => (
                    <div
                      key={sub}
                      className="px-3 py-2 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-stone-900"
                    >
                      <span className="font-semibold text-slate-800 dark:text-stone-200">{sub}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSubgroup(sub)}
                        className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                        title="Remover subgrupo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="px-4 py-2.5 bg-slate-50 dark:bg-stone-900 border-t border-slate-200 dark:border-stone-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsSubgroupsModalOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-bold cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10. Modal Dedicado: Listas Key-Label (Ocorrências RH & Exames ASO) */}
      {keyLabelModal && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-950 w-full max-w-lg rounded-xl border border-slate-300 dark:border-stone-700 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
            <div className="px-4 py-3 bg-slate-100 dark:bg-stone-900 border-b border-slate-200 dark:border-stone-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-purple-600" />
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase">
                    {keyLabelModal.title}
                  </h3>
                  <p className="text-[11px] text-slate-500">{keyLabelModal.subtitle}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setKeyLabelModal(null);
                  setEditingKeyLabelId(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto">
              <form onSubmit={handleAddKeyLabel} className="flex gap-2">
                <input
                  type="text"
                  value={newKeyLabelText}
                  onChange={(e) => setNewKeyLabelText(e.target.value)}
                  placeholder="Descrição da nova opção..."
                  className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-lg"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Incluir</span>
                </button>
              </form>

              <div className="border border-slate-200 dark:border-stone-800 rounded-lg divide-y divide-slate-200 dark:divide-stone-800 max-h-64 overflow-y-auto">
                {keyLabelModal.items.map((item) => (
                  <div
                    key={item.id}
                    className="px-3 py-2 flex items-center justify-between gap-2 text-xs hover:bg-slate-50 dark:hover:bg-stone-900"
                  >
                    {editingKeyLabelId === item.id ? (
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          type="text"
                          value={editingKeyLabelValue}
                          onChange={(e) => setEditingKeyLabelValue(e.target.value)}
                          className="flex-1 px-2 py-1 text-xs border border-emerald-500 rounded bg-white dark:bg-stone-900"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveKeyLabelEdit(item.id)}
                          className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                          title="Salvar"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div>
                          <span className="font-semibold text-slate-800 dark:text-stone-200">
                            {item.label}
                          </span>
                          <span className="ml-2 text-[10px] font-mono text-slate-400">
                            ({item.id})
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingKeyLabelId(item.id);
                              setEditingKeyLabelValue(item.label);
                            }}
                            className="p-1 text-slate-500 hover:text-indigo-600 rounded cursor-pointer"
                            title="Editar"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteKeyLabel(item.id)}
                            className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="px-4 py-2.5 bg-slate-50 dark:bg-stone-900 border-t border-slate-200 dark:border-stone-800 flex items-center justify-between">
              <button
                type="button"
                onClick={handleResetKeyLabel}
                className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restaurar Padrões</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setKeyLabelModal(null);
                  setEditingKeyLabelId(null);
                }}
                className="px-4 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-bold cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 11. Modal Dedicado: Tanques de Combustível da Fazenda */}
      {isTanksModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-950 w-full max-w-2xl rounded-xl border border-slate-300 dark:border-stone-700 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
            <div className="px-4 py-3 bg-slate-100 dark:bg-stone-900 border-b border-slate-200 dark:border-stone-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Fuel className="w-4 h-4 text-amber-600" />
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase">
                    Configuração dos Tanques de Combustível da Fazenda
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Ajuste nome, combustível, capacidade máxima (L) e localização dos tanques internos
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTanksModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto">
              {tanksDraft.map((tank, idx) => (
                <div
                  key={tank.id}
                  className="p-3 rounded-lg border border-slate-200 dark:border-stone-800 bg-slate-50 dark:bg-stone-900/60 grid grid-cols-1 sm:grid-cols-2 gap-2.5"
                >
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                      Nome do Tanque
                    </label>
                    <input
                      type="text"
                      value={tank.nome}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTanksDraft((prev) =>
                          prev.map((t, i) => (i === idx ? { ...t, nome: val } : t))
                        );
                      }}
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                      Tipo de Combustível
                    </label>
                    <input
                      type="text"
                      value={tank.tipo_combustivel}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTanksDraft((prev) =>
                          prev.map((t, i) => (i === idx ? { ...t, tipo_combustivel: val } : t))
                        );
                      }}
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                      Capacidade Nominal (Litros)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={tank.capacidade_total}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        setTanksDraft((prev) =>
                          prev.map((t, i) => (i === idx ? { ...t, capacidade_total: val } : t))
                        );
                      }}
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                      Localização / Ponto de Abastecimento
                    </label>
                    <input
                      type="text"
                      value={tank.localizacao || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTanksDraft((prev) =>
                          prev.map((t, i) => (i === idx ? { ...t, localizacao: val } : t))
                        );
                      }}
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="px-4 py-2.5 bg-slate-50 dark:bg-stone-900 border-t border-slate-200 dark:border-stone-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsTanksModalOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveTanks}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Salvar Tanques</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 12. Modal Dedicado: Placas & Veículos de Terceiros (Transportadoras) */}
      <PlacasTerceirosManagerModal
        isOpen={isPlacasTerceirosModalOpen}
        onClose={() => setIsPlacasTerceirosModalOpen(false)}
      />
    </div>
  );
};
