import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  X, 
  Wrench, 
  Save, 
  DollarSign, 
  Calendar, 
  AlertTriangle, 
  MapPin, 
  UserCheck, 
  Building2, 
  Truck, 
  FileText, 
  CreditCard, 
  Plus, 
  Trash2, 
  Package, 
  ShoppingCart, 
  Search,
  Barcode,
  CheckCircle2, 
  HelpCircle,
  Clock,
  Sparkles,
  ExternalLink,
  Layers,
  FileCheck2,
  Tag,
  Settings2,
  Users,
  Hammer,
  ChevronDown,
  ChevronUp,
  Receipt,
  ArrowRight,
  CheckCheck
} from 'lucide-react';
import { 
  MaintenanceLog, 
  Machinery, 
  Expense, 
  InventoryItem, 
  Supplier, 
  Employee,
  CompanyProfile,
  MaintenanceLocation,
  MaintenanceExecutorType,
  MaintenancePartItem,
  MaintenanceLaborItem,
  MaintenanceLaborPeriod,
  MaintenanceNfeLink,
  MaintenanceFinancialConditions,
  PaymentMethod,
  MaintenanceCategoryDefinition
} from '../../types';
import { 
  formatCurrencyBRL, 
  getStoredMaintenanceCategories, 
  saveStoredMaintenanceCategories,
  getStoredEmployees,
  getStoredInventory,
  saveStoredInventory
} from '../../lib/storage';
import { MaintenanceCategoriesModal } from './MaintenanceCategoriesModal';
import { ProductSearchModal } from './ProductSearchModal';
import { NfeInstallmentsModal, NfeDetailedInstallment } from '../nfe/NfeInstallmentsModal';

export const parseCleanPriceNumber = (val: any): number => {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  let str = String(val).trim().replace(/[R$\s]/g, '');
  if (!str) return 0;
  if (str.includes(',') && str.includes('.')) {
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');
    if (lastComma > lastDot) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
};

export type DefaultOsPriceType = 'venda' | 'custo' | 'atacado' | 'promocional';

export const getPriceForProductByRule = (
  stockItem: InventoryItem | null | undefined,
  priceType: DefaultOsPriceType,
  fallbackCost: number = 0
): number => {
  if (!stockItem) return fallbackCost;
  const baseCost = parseCleanPriceNumber(stockItem.unitCost || fallbackCost);
  if (!baseCost || baseCost <= 0) return 0;

  switch (priceType) {
    case 'custo':
      return baseCost;
    case 'venda': {
      const profitMargin = stockItem.profitMargin ?? 30;
      return (stockItem.salePrice !== undefined && stockItem.salePrice > 0)
        ? parseCleanPriceNumber(stockItem.salePrice)
        : Math.round(baseCost * (1 + profitMargin / 100) * 100) / 100;
    }
    case 'atacado': {
      const wholesaleMargin = stockItem.wholesaleMargin ?? 15;
      return (stockItem.wholesalePrice !== undefined && stockItem.wholesalePrice > 0)
        ? parseCleanPriceNumber(stockItem.wholesalePrice)
        : Math.round(baseCost * (1 + wholesaleMargin / 100) * 100) / 100;
    }
    case 'promocional': {
      const promoMargin = stockItem.promoMargin ?? 10;
      return (stockItem.promoPrice !== undefined && stockItem.promoPrice > 0)
        ? parseCleanPriceNumber(stockItem.promoPrice)
        : Math.round(baseCost * (1 + promoMargin / 100) * 100) / 100;
    }
    default:
      return baseCost;
  }
};

interface MaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    log: MaintenanceLog, 
    options: {
      createExpense: boolean;
      deductStock: boolean;
      createPurchaseRequest: boolean;
      skipAccountsPayableDreOnly?: boolean;
    }
  ) => void;
  editingLog: MaintenanceLog | null;
  machineries: Machinery[];
  inventory?: InventoryItem[];
  suppliers?: Supplier[];
  employees?: Employee[];
  companyProfile?: CompanyProfile;
}

export const MaintenanceModal: React.FC<MaintenanceModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingLog,
  machineries,
  inventory = [],
  suppliers = [],
  employees = [],
  companyProfile,
}) => {
  // Active subtab inside modal for clean navigation
  const [activeTab, setActiveTab] = useState<'geral' | 'pecas' | 'fiscal_financeiro'>('geral');

  // --- DADOS GERAIS ---
  const [osNumber, setOsNumber] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [completionDate, setCompletionDate] = useState('');
  const [machineryId, setMachineryId] = useState('');
  const [type, setType] = useState<MaintenanceLog['type']>('preventiva');
  const [serviceCategory, setServiceCategory] = useState<string>('Troca de Óleo & Filtros');
  const [customCategory, setCustomCategory] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<MaintenanceLog['status']>('em_andamento');
  const [currentHourMeterOrKm, setCurrentHourMeterOrKm] = useState('');
  const [nextServiceDue, setNextServiceDue] = useState('');
  const [notes, setNotes] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [currentOsId, setCurrentOsId] = useState<string>(editingLog?.id || '');
  const [expenseGenerated, setExpenseGenerated] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'save' | 'finalize' | 'billed';
    message: string;
  } | null>(null);

  // --- CATEGORIAS DE SERVIÇO DINÂMICAS ---
  const [categoriesList, setCategoriesList] = useState<MaintenanceCategoryDefinition[]>([]);
  const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState(false);

  useEffect(() => {
    setCategoriesList(getStoredMaintenanceCategories());
  }, [isOpen]);

  const handleSaveCategories = (updated: MaintenanceCategoryDefinition[]) => {
    const sorted = [...updated].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' }));
    setCategoriesList(sorted);
    saveStoredMaintenanceCategories(sorted);
  };

  // Lista de categorias de serviço estritamente em ordem alfabética (com "Revisão (entressafra)" garantida)
  const sortedCategories = useMemo(() => {
    const list = [...categoriesList];
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

    // Desduplicar por nome normalizado
    const seen = new Set<string>();
    const deduplicated: MaintenanceCategoryDefinition[] = [];
    for (const item of list) {
      const normalized = (item.name || '').trim().toLowerCase();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        deduplicated.push(item);
      }
    }

    return deduplicated.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' }));
  }, [categoriesList]);

  // --- CONFIGURAÇÃO GLOBAL DE PREÇO PADRÃO DA OS ---
  const [defaultPriceType, setDefaultPriceType] = useState<DefaultOsPriceType>(() => {
    try {
      const saved = localStorage.getItem('crm_os_default_price_type');
      if (saved === 'custo' || saved === 'venda' || saved === 'atacado' || saved === 'promocional') {
        return saved;
      }
    } catch (e) {
      // ignore
    }
    return 'venda';
  });

  // --- CARREGAMENTO GLOBAL E SINCRONIZAÇÃO DE FUNCIONÁRIOS E ESTOQUE ---
  const [storedEmployees, setStoredEmployees] = useState<Employee[]>([]);
  const [storedInventory, setStoredInventory] = useState<InventoryItem[]>([]);

  useEffect(() => {
    if (isOpen) {
      setStoredEmployees(getStoredEmployees());
      setStoredInventory(getStoredInventory());
    }
  }, [isOpen]);

  useEffect(() => {
    if (inventory && inventory.length > 0) {
      setStoredInventory(inventory);
    }
  }, [inventory]);

  // Lista consolidada de itens de estoque (prioriza o estado mais recente em storedInventory)
  const allInventoryList = useMemo(() => {
    if (storedInventory.length > 0) return storedInventory;
    if (inventory && inventory.length > 0) return inventory;
    return getStoredInventory();
  }, [inventory, storedInventory]);

  // Alteração do Preço Padrão da OS: salva preferência e recalcula itens da tabela automaticamente
  const handleDefaultPriceTypeChange = (newType: DefaultOsPriceType) => {
    setDefaultPriceType(newType);
    try {
      localStorage.setItem('crm_os_default_price_type', newType);
    } catch (e) {
      // ignore
    }

    setPartsItems(prev => prev.map(item => {
      if (item.origin === 'almoxarifado_interno' || !item.origin) {
        const stockItem = item.inventoryItemId 
          ? allInventoryList.find(inv => inv.id === item.inventoryItemId) 
          : allInventoryList.find(inv => 
              (inv.name && item.description && String(inv.name).trim().toLowerCase() === String(item.description).trim().toLowerCase()) ||
              (inv.code !== undefined && inv.code !== null && item.description && String(inv.code).trim().toLowerCase() === String(item.description).trim().toLowerCase())
            );
        if (stockItem) {
          const newPrice = getPriceForProductByRule(stockItem, newType);
          const qty = Number(item.quantity) || 1;
          return {
            ...item,
            unitCost: newPrice,
            totalCost: Math.round(qty * newPrice * 100) / 100
          };
        }
      }
      return item;
    }));
  };

  // Lista consolidada de todos os funcionários (via props ou localStorage)
  const allEmployeesList = useMemo(() => {
    if (employees && employees.length > 0) return employees;
    if (storedEmployees.length > 0) return storedEmployees;
    return getStoredEmployees();
  }, [employees, storedEmployees]);

  // Filtragem de mecânicos e prestadores de manutenção:
  // Funcionários ativos cujo Cargo ou Tipo de Cadastro corresponda a Mecânico, Mecânico Especialista, Auxiliar ou Prestador de Serviço
  const mechanicEmployees = useMemo(() => {
    // 1. Filtrar funcionários ativos (não inativos e active !== false)
    const activeList = allEmployeesList.filter(
      emp => emp.status !== 'inativo' && emp.active !== false
    );

    const normalize = (str?: string) => 
      (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

    // 2. Filtra por Tipo de Cadastro ou Cargo/Função: "Mecanico Especialista", "Auxiliar" ou prestadores de serviço de manutenção
    const filtered = activeList.filter(emp => {
      const role = normalize(emp.role);
      const reg = normalize(emp.registrationType);
      
      const isMechanic = role.includes('mecanic') || reg.includes('mecanic');
      const isAuxiliar = role.includes('auxiliar') || reg.includes('auxiliar');
      const isMaintenanceProvider = 
        (reg.includes('prestador') || role.includes('prestador')) && 
        (role.includes('manutenc') || reg.includes('manutenc') || role.includes('mecanic') || reg.includes('oficina') || role.includes('servico'));
      const isGeneralMaintenance = role.includes('manutenc') || reg.includes('manutenc');

      return isMechanic || isAuxiliar || isMaintenanceProvider || isGeneralMaintenance;
    });

    // Se houver funcionários filtrados específicos, retorna a lista filtrada; 
    // Caso a base não tenha ainda funcionários com esses cargos específicos, exibe todos os funcionários ativos para garantir opções no Select
    return filtered.length > 0 ? filtered : activeList;
  }, [allEmployeesList]);

  // --- LOCAL DA MANUTENÇÃO ---
  const [location, setLocation] = useState<MaintenanceLocation>('oficina_interna');
  const [locationDetails, setLocationDetails] = useState('');

  // --- RESPONSÁVEL PELA EXECUÇÃO (EXECUTANTE) ---
  const [executorType, setExecutorType] = useState<MaintenanceExecutorType>('equipe_propria');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [workshopOrMechanic, setWorkshopOrMechanic] = useState('Mecânica Interna / Própria');

  // --- PEÇAS & INSUMOS ---
  const [partsItems, setPartsItems] = useState<MaintenancePartItem[]>([]);
  const [partsCostManual, setPartsCostManual] = useState('');
  const [usePartsItemList, setUsePartsItemList] = useState(true);
  const [isProductSearchOpen, setIsProductSearchOpen] = useState(false);
  const [activeSearchRowIndex, setActiveSearchRowIndex] = useState<number | null>(null);
  const [activeSearchInitialQuery, setActiveSearchInitialQuery] = useState('');
  const [autocompleteIndex, setAutocompleteIndex] = useState<number | null>(null);
  const [unitCostRawInputs, setUnitCostRawInputs] = useState<Record<string, string>>({});

  // --- BARRA HORIZONTAL RÁPIDA DE ENTRADA (LÓGICA PDV NA SEÇÃO DE PEÇAS DA OS) ---
  const [osPartInputQtde, setOsPartInputQtde] = useState<string>('1');
  const [osPartSearchQuery, setOsPartSearchQuery] = useState<string>('');
  const [osPartSelectedProduct, setOsPartSelectedProduct] = useState<InventoryItem | null>(null);
  const [osPartInputUnitCost, setOsPartInputUnitCost] = useState<string>('');
  const [isOsPartDropdownOpen, setIsOsPartDropdownOpen] = useState<boolean>(false);
  const [osPartHighlightedIndex, setOsPartHighlightedIndex] = useState<number>(0);
  const osPartSearchContainerRef = useRef<HTMLDivElement>(null);
  const osPartSearchInputRef = useRef<HTMLInputElement>(null);
  const osPartQtyInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        osPartSearchContainerRef.current &&
        !osPartSearchContainerRef.current.contains(event.target as Node)
      ) {
        setIsOsPartDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- MÃO DE OBRA (LISTA DINÂMICA DE MECÂNICOS & AVULSO) ---
  const [laborItems, setLaborItems] = useState<MaintenanceLaborItem[]>([]);
  const [laborCost, setLaborCost] = useState('');
  const [expandedLaborPonto, setExpandedLaborPonto] = useState<Record<string, boolean>>({});

  const toggleLaborPonto = (key: string) => {
    setExpandedLaborPonto(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // --- INTEGRAÇÃO FISCAL (NF-e) ---
  const [hasNfe, setHasNfe] = useState(false);
  const [nfeNumber, setNfeNumber] = useState('');
  const [nfeSeries, setNfeSeries] = useState('');
  const [nfeAccessKey, setNfeAccessKey] = useState('');
  const [nfeIssueDate, setNfeIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [nfeSupplierName, setNfeSupplierName] = useState('');
  const [nfeTotalAmount, setNfeTotalAmount] = useState('');

  // --- INTEGRAÇÃO FINANCEIRA (CONTAS A PAGAR) ---
  const [createExpense, setCreateExpense] = useState(true);
  const [skipAccountsPayableDreOnly, setSkipAccountsPayableDreOnly] = useState(false);
  const [paymentTerm, setPaymentTerm] = useState<MaintenanceFinancialConditions['paymentTerm']>('a_vista');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('boleto');
  const [firstDueDate, setFirstDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [financialSupplier, setFinancialSupplier] = useState('');
  const [installments, setInstallments] = useState<NfeDetailedInstallment[]>([]);
  const [isInstallmentsModalOpen, setIsInstallmentsModalOpen] = useState(false);

  // --- SOLICITAÇÃO DE COMPRA (FLUXO A) ---
  const [generatePurchaseRequest, setGeneratePurchaseRequest] = useState(false);
  const [purchaseUrgency, setPurchaseUrgency] = useState<'baixa' | 'media' | 'alta' | 'urgente_veiculo_parado'>('alta');

  // Preenchimento no carregamento/edição
  useEffect(() => {
    if (editingLog) {
      setOsNumber(editingLog.osNumber || `OS-${editingLog.id.slice(-5).toUpperCase()}`);
      setDate(editingLog.date);
      setCompletionDate(editingLog.completionDate || '');
      setMachineryId(editingLog.machineryId);
      setType(editingLog.type === 'revisao_periodica' ? 'reforma_entressafra' : editingLog.type);
      setServiceCategory(editingLog.serviceCategory);
      setDescription(editingLog.description);
      setStatus(editingLog.status);
      setCurrentHourMeterOrKm(String(editingLog.currentHourMeterOrKm || ''));
      setNextServiceDue(editingLog.nextServiceDueHourMeterOrKm ? String(editingLog.nextServiceDueHourMeterOrKm) : '');
      setNotes(editingLog.notes || '');

      // Local e Executante
      setLocation(editingLog.location || 'oficina_interna');
      setLocationDetails(editingLog.locationDetails || '');
      setExecutorType(editingLog.executorType || 'equipe_propria');
      setWorkshopOrMechanic(editingLog.workshopOrMechanic || editingLog.executorName || 'Mecânica Interna / Própria');

      // Peças (com marcação de controle de baixa prévia)
      if (editingLog.partsItems && editingLog.partsItems.length > 0) {
        setPartsItems(editingLog.partsItems.map(p => ({
          ...p,
          stockDeducted: p.stockDeducted ?? (editingLog.stockDeducted ? true : false)
        })));
        setUsePartsItemList(true);
      } else {
        setPartsItems([]);
        setPartsCostManual(editingLog.partsCost ? String(editingLog.partsCost) : '');
        setUsePartsItemList(true);
      }
      setUnitCostRawInputs({});
      setOsPartInputQtde('1');
      setOsPartSearchQuery('');
      setOsPartSelectedProduct(null);
      setOsPartInputUnitCost('');
      setIsOsPartDropdownOpen(false);

      // Mão de Obra
      if (editingLog.laborItems && editingLog.laborItems.length > 0) {
        const defaultDateStr = editingLog.date || new Date().toISOString().split('T')[0];
        setLaborItems(editingLog.laborItems.map((item, i) => {
          const periods = item.periods && item.periods.length > 0
            ? item.periods
            : [{ id: `p_${Date.now()}_${i}_1`, startTime: '', endTime: '' }];
          return {
            ...item,
            date: item.date || item.dataLancamento || defaultDateStr,
            dataLancamento: item.dataLancamento || item.date || defaultDateStr,
            periods,
          };
        }));
        const internalLaborSum = editingLog.laborItems.reduce((acc, curr) => acc + (curr.totalCost || 0), 0);
        const diff = (editingLog.laborCost || 0) - internalLaborSum;
        setLaborCost(diff > 0.01 ? String(Math.round(diff * 100) / 100) : '');
      } else {
        setLaborItems([]);
        setLaborCost(editingLog.laborCost ? String(editingLog.laborCost) : '');
      }

      // NF-e
      if (editingLog.nfeLink && (editingLog.nfeLink.nfeNumber || editingLog.nfeLink.nfeAccessKey)) {
        setHasNfe(true);
        setNfeNumber(editingLog.nfeLink.nfeNumber || '');
        setNfeSeries(editingLog.nfeLink.nfeSeries || '');
        setNfeAccessKey(editingLog.nfeLink.nfeAccessKey || '');
        setNfeIssueDate(editingLog.nfeLink.issueDate || editingLog.date);
        setNfeSupplierName(editingLog.nfeLink.supplierName || '');
        setNfeTotalAmount(editingLog.nfeLink.totalNfeAmount ? String(editingLog.nfeLink.totalNfeAmount) : '');
      } else {
        setHasNfe(false);
      }

      // Financeiro
      const isDreOnlyInitial = Boolean(
        editingLog.skipAccountsPayableDreOnly || 
        editingLog.financialConditions?.skipAccountsPayableDreOnly
      );
      setSkipAccountsPayableDreOnly(isDreOnlyInitial);

      if (editingLog.financialConditions) {
        setCreateExpense(isDreOnlyInitial ? false : editingLog.financialConditions.createAccountsPayable);
        setPaymentTerm(editingLog.financialConditions.paymentTerm);
        setPaymentMethod(editingLog.financialConditions.paymentMethod);
        setFirstDueDate(editingLog.financialConditions.firstDueDate);
        setFinancialSupplier(editingLog.financialConditions.supplierName || '');
        setExpenseGenerated(!isDreOnlyInitial && !!editingLog.financialConditions.createAccountsPayable);
        if (editingLog.financialConditions.installments && editingLog.financialConditions.installments.length > 0) {
          setInstallments(editingLog.financialConditions.installments as NfeDetailedInstallment[]);
        } else {
          setInstallments([]);
        }
      } else {
        setCreateExpense(false);
        setExpenseGenerated(false);
        setInstallments([]);
      }

      setCurrentOsId(editingLog.id);
    } else {
      // Novo registro
      const newOsId = `maint_${Date.now()}`;
      setCurrentOsId(newOsId);
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      const year = new Date().getFullYear();
      setOsNumber(`OS-${year}-${randomNum}`);
      setDate(new Date().toISOString().split('T')[0]);
      setCompletionDate('');
      if (machineries.length > 0) {
        setMachineryId(machineries[0].id);
        if (machineries[0].hourMeter) {
          setCurrentHourMeterOrKm(String(machineries[0].hourMeter));
        } else if (machineries[0].currentKm) {
          setCurrentHourMeterOrKm(String(machineries[0].currentKm));
        }
      }
      setType('preventiva');
      setServiceCategory('Troca de Óleo & Filtros');
      setDescription('');
      setStatus('em_andamento');
      setLocation('oficina_interna');
      setLocationDetails('');
      setExecutorType('equipe_propria');
      setWorkshopOrMechanic('Mecânica Interna / Própria');
      setPartsItems([]);
      setPartsCostManual('');
      setUsePartsItemList(true);
      setUnitCostRawInputs({});
      setOsPartInputQtde('1');
      setOsPartSearchQuery('');
      setOsPartSelectedProduct(null);
      setOsPartInputUnitCost('');
      setIsOsPartDropdownOpen(false);
      setLaborItems([]);
      setLaborCost('');
      setNextServiceDue('');
      setNotes('');
      setHasNfe(false);
      setNfeNumber('');
      setNfeSeries('');
      setNfeAccessKey('');
      setNfeSupplierName('');
      setNfeTotalAmount('');
      setSkipAccountsPayableDreOnly(false);
      setCreateExpense(false);
      setExpenseGenerated(false);
      setPaymentTerm('a_vista');
      setPaymentMethod('boleto');
      setFirstDueDate(new Date().toISOString().split('T')[0]);
      setFinancialSupplier('');
      setGeneratePurchaseRequest(false);
      setPurchaseUrgency('alta');
    }
    setSaveSuccess(false);
    setFeedbackBanner(null);
  }, [editingLog, isOpen, machineries]);

  // Máscara visual de milhar em tempo real (padrão pt-BR, ex: 5000 vira "5.000"; 12550 vira "12.550")
  const formatThousand = (val: string | number | undefined): string => {
    if (val === undefined || val === null || val === '') return '';
    const digits = String(val).replace(/\D/g, '');
    if (!digits) return '';
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  // Tratamento do input (onChange): remove qualquer caractere não numérico mantendo no estado apenas o número limpo
  const handleThousandInput = (raw: string, setter: (val: string) => void) => {
    const digitsOnly = raw.replace(/\D/g, '');
    setter(digitsOnly);
  };

  // Atualiza veículo e odômetro sugerido
  const handleMachineryChange = (id: string) => {
    setMachineryId(id);
    const mach = machineries.find(m => m.id === id);
    if (mach) {
      if (mach.hourMeter !== undefined && mach.hourMeter !== null) {
        const h = Number(mach.hourMeter);
        setCurrentHourMeterOrKm(!isNaN(h) && h > 0 ? String(h) : '');
      } else if (mach.currentKm !== undefined && mach.currentKm !== null) {
        const k = Number(mach.currentKm);
        setCurrentHourMeterOrKm(!isNaN(k) && k > 0 ? String(k) : '');
      }
      if (mach.assignedDrivers && mach.assignedDrivers.length > 0) {
        setWorkshopOrMechanic(`Operador: ${mach.assignedDrivers.join(', ')}`);
      }
    }
  };

  // Atualização dinâmica do responsável pela execução
  const handleExecutorTypeChange = (newType: MaintenanceExecutorType) => {
    setExecutorType(newType);
    if (newType === 'equipe_propria') {
      const selectedMach = machineries.find(m => m.id === machineryId);
      if (selectedMach?.assignedDrivers?.length) {
        setWorkshopOrMechanic(`Equipe Própria (${selectedMach.assignedDrivers.join(', ')})`);
      } else {
        setWorkshopOrMechanic('Equipe Própria / Motorista');
      }
    } else if (newType === 'mecanico_interno') {
      setWorkshopOrMechanic('Mecânico Interno da Empresa');
    } else if (newType === 'mecanico_campo') {
      setWorkshopOrMechanic('Mecânico Terceiro em Campo (Socorro)');
    } else if (newType === 'mecanica_terceirizada') {
      setWorkshopOrMechanic('Oficina Especializada / Concessionária');
    }
  };

  // --- MÃO DE OBRA INTERNA: CÁLCULO DE PERÍODOS DE PONTO (ENTRADA & SAÍDA) ---
  // Função que calcula a diferença de tempo de cada período preenchido (Saída menos Entrada)
  const calculatePeriodHours = (startTime?: string, endTime?: string): number => {
    if (!startTime || !endTime) return 0;
    const [startH, startM] = startTime.split(':').map(val => parseInt(val, 10));
    const [endH, endM] = endTime.split(':').map(val => parseInt(val, 10));
    if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) return 0;

    const startTotalMinutes = startH * 60 + startM;
    const endTotalMinutes = endH * 60 + endM;

    let diffMinutes = endTotalMinutes - startTotalMinutes;
    if (diffMinutes < 0) {
      // Caso cruze a meia-noite (turno noturno)
      diffMinutes += 24 * 60;
    }
    return Math.round((diffMinutes / 60) * 100) / 100;
  };

  const formatPeriodDuration = (startTime?: string, endTime?: string): string => {
    if (!startTime || !endTime) return '--';
    const hoursDecimal = calculatePeriodHours(startTime, endTime);
    if (hoursDecimal <= 0) return '0h';
    const totalMinutes = Math.round(hoursDecimal * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const handleAddLaborItem = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const newItem: MaintenanceLaborItem = {
      id: `labor_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      employeeId: '',
      mechanicName: '',
      description: 'Mão de Obra / Manutenção',
      executorType: 'mecanico_interno',
      hours: 0,
      hourlyRate: 0,
      totalCost: 0,
      date: todayStr,
      dataLancamento: todayStr,
      periods: [
        { id: `p_${Date.now()}_1`, startTime: '', endTime: '' }
      ],
    };
    setLaborItems(prev => [...prev, newItem]);
  };

  const handleAddLaborPeriod = (laborIndex: number) => {
    setLaborItems(prev => {
      const updated = [...prev];
      const item = { ...updated[laborIndex] };
      const periods = item.periods && item.periods.length > 0 
        ? [...item.periods] 
        : [{ id: `p_${Date.now()}_1`, startTime: '', endTime: '' }];

      periods.push({
        id: `p_${Date.now()}_${periods.length + 1}`,
        startTime: '',
        endTime: '',
      });

      item.periods = periods;
      updated[laborIndex] = item;
      return updated;
    });
  };

  const handleRemoveLaborPeriod = (laborIndex: number, periodIndex: number) => {
    setLaborItems(prev => {
      const updated = [...prev];
      const item = { ...updated[laborIndex] };
      if (!item.periods) return prev;

      const periods = item.periods.filter((_, idx) => idx !== periodIndex);
      if (periods.length === 0) {
        periods.push({ id: `p_${Date.now()}_1`, startTime: '', endTime: '' });
      }
      item.periods = periods;

      // Recalcula soma dos intervalos válidos daquele funcionário
      let totalCalculatedHours = 0;
      periods.forEach(p => {
        if (p.startTime && p.endTime) {
          totalCalculatedHours += calculatePeriodHours(p.startTime, p.endTime);
        }
      });
      totalCalculatedHours = Math.round(totalCalculatedHours * 100) / 100;
      item.hours = totalCalculatedHours;

      const rate = typeof item.hourlyRate === 'number' ? item.hourlyRate : (parseFloat(String(item.hourlyRate || 0)) || 0);
      item.totalCost = Math.round(totalCalculatedHours * rate * 100) / 100;

      updated[laborIndex] = item;
      return updated;
    });
  };

  const handleUpdateLaborPeriod = (
    laborIndex: number,
    periodIndex: number,
    field: 'startTime' | 'endTime',
    value: string
  ) => {
    setLaborItems(prev => {
      const updated = [...prev];
      const item = { ...updated[laborIndex] };
      const periods = item.periods ? [...item.periods] : [{ id: `p_${Date.now()}_1`, startTime: '', endTime: '' }];

      if (!periods[periodIndex]) {
        periods[periodIndex] = { id: `p_${Date.now()}_${periodIndex + 1}`, startTime: '', endTime: '' };
      }

      periods[periodIndex] = {
        ...periods[periodIndex],
        [field]: value,
      };

      item.periods = periods;

      // LÓGICA DE CÁLCULO AUTOMÁTICO (JAVASCRIPT):
      // Calcula automaticamente a diferença de tempo de cada período preenchido (Saída menos Entrada),
      // soma todos os intervalos válidos daquele funcionário e atualiza instantaneamente o campo "Horas" (Total)
      // e o "Subtotal (R$)" da linha dele.
      let totalCalculatedHours = 0;
      periods.forEach(p => {
        if (p.startTime && p.endTime) {
          totalCalculatedHours += calculatePeriodHours(p.startTime, p.endTime);
        }
      });

      totalCalculatedHours = Math.round(totalCalculatedHours * 100) / 100;
      item.hours = totalCalculatedHours;

      const rate = typeof item.hourlyRate === 'number' ? item.hourlyRate : (parseFloat(String(item.hourlyRate || 0)) || 0);
      item.totalCost = Math.round(totalCalculatedHours * rate * 100) / 100;

      updated[laborIndex] = item;
      return updated;
    });
  };

  const handleUpdateLaborItem = (index: number, updates: Partial<MaintenanceLaborItem>) => {
    setLaborItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index], ...updates };

      if (updates.employeeId !== undefined) {
        const emp = allEmployeesList.find(e => e.id === updates.employeeId);
        if (emp) {
          item.mechanicName = emp.name;
          if (!item.hourlyRate || item.hourlyRate === 0) {
            if ((emp as any).hourlyRate) {
              item.hourlyRate = parseFloat(String((emp as any).hourlyRate)) || 0;
            } else if ((emp as any).dailyRate) {
              item.hourlyRate = Math.round(((parseFloat(String((emp as any).dailyRate)) || 0) / 8) * 100) / 100;
            } else if (emp.commissionPerHour && emp.commissionPerHour > 0) {
              item.hourlyRate = parseFloat(String(emp.commissionPerHour)) || 0;
            }
          }
        }
      }

      // Sincroniza date e dataLancamento se um deles for atualizado
      if (updates.date !== undefined && updates.dataLancamento === undefined) {
        item.dataLancamento = updates.date;
      } else if (updates.dataLancamento !== undefined && updates.date === undefined) {
        item.date = updates.dataLancamento;
      }

      const hours = typeof item.hours === 'number' ? item.hours : (parseFloat(String(item.hours || 0)) || 0);
      const rate = typeof item.hourlyRate === 'number' ? item.hourlyRate : (parseFloat(String(item.hourlyRate || 0)) || 0);
      item.totalCost = Math.round(hours * rate * 100) / 100;
      updated[index] = item;
      return updated;
    });
  };

  const handleRemoveLaborItem = (index: number) => {
    setLaborItems(prev => prev.filter((_, i) => i !== index));
  };

  // Adicionar item de peça à lista
  const handleAddPartItem = () => {
    setUsePartsItemList(true);
    const newItem: MaintenancePartItem = {
      id: `part_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      description: '',
      origin: 'almoxarifado_interno',
      quantity: 1,
      unit: 'un',
      unitCost: 0,
      totalCost: 0,
      stockDeducted: false,
    };
    setPartsItems(prev => [...prev, newItem]);
  };

  const handleUpdatePartItem = (index: number, updates: Partial<MaintenancePartItem>) => {
    setUsePartsItemList(true);
    setPartsItems(prev => {
      const updated = [...prev];
      const current = updated[index];
      if (!current) return prev;

      const item = { ...current, ...updates };
      
      // Se mudou para recuperada externa: desvincula de qualquer item de estoque
      if (updates.origin === 'recuperada_externa') {
        item.inventoryItemId = undefined;
        if (!item.quantity) item.quantity = 1;
      }

      // Se selecionou do almoxarifado interno, puxa nome, unidade e preço padrão configurado
      if (updates.inventoryItemId) {
        const stockItem = allInventoryList.find(i => i.id === updates.inventoryItemId);
        if (stockItem) {
          item.description = stockItem.name;
          item.unit = stockItem.unit || 'un';
          if (updates.unitCost === undefined) {
            item.unitCost = getPriceForProductByRule(stockItem, defaultPriceType);
          }
        }
      }

      // Se for recuperada externa e atualizou externalServiceCost
      if (item.origin === 'recuperada_externa') {
        if (updates.externalServiceCost !== undefined) {
          const cost = parseCleanPriceNumber(updates.externalServiceCost);
          item.externalServiceCost = cost;
          item.unitCost = cost;
        }
      }

      const qty = parseCleanPriceNumber(item.quantity);
      const cost = parseCleanPriceNumber(item.unitCost);
      item.quantity = qty;
      item.unitCost = cost;
      item.totalCost = Math.round(qty * cost * 100) / 100;

      updated[index] = item;
      return updated;
    });
  };

  // Abrir Modal Avançado de Busca de Peças / Produtos
  const handleOpenProductSearch = (index: number, initialQuery = '') => {
    setActiveSearchRowIndex(index);
    setActiveSearchInitialQuery(initialQuery);
    setIsProductSearchOpen(true);
  };

  // Selecionar produto a partir do Modal aplicando automaticamente o Preço Padrão da OS
  const handleSelectProductFromModal = (product: InventoryItem) => {
    if (activeSearchRowIndex !== null && partsItems[activeSearchRowIndex]) {
      const calculatedPrice = getPriceForProductByRule(product, defaultPriceType);
      handleUpdatePartItem(activeSearchRowIndex, {
        inventoryItemId: product.id,
        description: product.name,
        unit: product.unit || 'un',
        unitCost: calculatedPrice,
        origin: 'almoxarifado_interno',
      });
    }
    setActiveSearchRowIndex(null);
  };

  // --- LÓGICA PDV HORIZONTAL NA SEÇÃO DE PEÇAS DA OS (INTEGRADA A 'colaca_silagem_estoque_produtos') ---
  const osPartSearchResults = useMemo(() => {
    if (!osPartSearchQuery.trim()) return [];
    const q = osPartSearchQuery.toLowerCase().trim();
    // Prioriza busca dinâmica integrada à tabela do estoque
    return allInventoryList.filter(item => {
      const anyItem = item as any;
      const name = String(item.nome_comercial || item.name || '').toLowerCase();
      const code = String(item.code || anyItem.codigo || '').toLowerCase();
      const barcode = String(item.barcode || anyItem.codigo_barras || '').toLowerCase();
      const cat = String(item.categoria || item.category || anyItem.tipo_item || '').toLowerCase();
      return name.includes(q) || code.includes(q) || barcode.includes(q) || cat.includes(q);
    }).slice(0, 10);
  }, [osPartSearchQuery, allInventoryList]);

  const handleSelectOsPartSuggestion = (item: InventoryItem) => {
    setOsPartSelectedProduct(item);
    setOsPartSearchQuery(String(item.nome_comercial || item.name || '').toUpperCase());
    const priceVal = getPriceForProductByRule(item, defaultPriceType);
    setOsPartInputUnitCost(priceVal > 0 ? priceVal.toFixed(2).replace('.', ',') : '0,00');
    setIsOsPartDropdownOpen(false);
  };

  const handleInsertOsPart = () => {
    const rawDesc = osPartSearchQuery.trim();
    if (!rawDesc && !osPartSelectedProduct) return;

    const qty = Math.max(0.01, parseCleanPriceNumber(osPartInputQtde) || 1);
    const unitCost = parseCleanPriceNumber(osPartInputUnitCost);

    // Se o usuário digitou ou deu Enter direto, busca correspondência inteligente por código ou nome
    const resolvedProduct = osPartSelectedProduct || allInventoryList.find(inv => {
      const anyInv = inv as any;
      const q = rawDesc.toLowerCase();
      return (inv.code && String(inv.code).toLowerCase() === q) ||
             (anyInv.codigo && String(anyInv.codigo).toLowerCase() === q) ||
             (inv.barcode && String(inv.barcode).toLowerCase() === q) ||
             (anyInv.codigo_barras && String(anyInv.codigo_barras).toLowerCase() === q) ||
             (inv.name && String(inv.name).toLowerCase() === q) ||
             (inv.nome_comercial && String(inv.nome_comercial).toLowerCase() === q);
    });

    const finalDescription = resolvedProduct
      ? String(resolvedProduct.nome_comercial || resolvedProduct.name || rawDesc).trim().toUpperCase()
      : rawDesc.toUpperCase();

    const finalUnit = resolvedProduct?.unit || resolvedProduct?.unidade_medida || 'un';
    const totalCost = Math.round(qty * unitCost * 100) / 100;

    const newItem: MaintenancePartItem = {
      id: `part_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      inventoryItemId: resolvedProduct?.id,
      description: finalDescription,
      origin: 'almoxarifado_interno',
      quantity: qty,
      unit: finalUnit,
      unitCost: unitCost,
      totalCost: totalCost,
      stockDeducted: false,
    };

    setUsePartsItemList(true);
    setPartsItems(prev => [...prev, newItem]);

    // Limpa campos superiores para a próxima busca
    setOsPartInputQtde('1');
    setOsPartSearchQuery('');
    setOsPartSelectedProduct(null);
    setOsPartInputUnitCost('');
    setIsOsPartDropdownOpen(false);
    osPartSearchInputRef.current?.focus();
  };

  const resolvePartDisplayCode = (item: MaintenancePartItem, index: number) => {
    const stockItem = item.inventoryItemId 
      ? allInventoryList.find(inv => inv.id === item.inventoryItemId) 
      : allInventoryList.find(inv => 
          (inv.name && item.description && String(inv.name).trim().toLowerCase() === String(item.description).trim().toLowerCase()) ||
          (inv.code !== undefined && inv.code !== null && item.description && String(inv.code).trim().toLowerCase() === String(item.description).trim().toLowerCase())
        );
    return stockItem?.code || (stockItem as any)?.codigo || (item.inventoryItemId ? item.inventoryItemId.slice(0, 8).toUpperCase() : `#${String(index + 1).padStart(3, '0')}`);
  };

  const resolvePartCategory = (item: MaintenancePartItem) => {
    const stockItem = item.inventoryItemId 
      ? allInventoryList.find(inv => inv.id === item.inventoryItemId) 
      : allInventoryList.find(inv => 
          (inv.name && item.description && String(inv.name).trim().toLowerCase() === String(item.description).trim().toLowerCase()) ||
          (inv.code !== undefined && inv.code !== null && item.description && String(inv.code).trim().toLowerCase() === String(item.description).trim().toLowerCase())
        );
    if (stockItem) {
      return String(stockItem.categoria || stockItem.category || stockItem.tipo_item || 'ESTOQUE').toUpperCase();
    }
    if (item.origin === 'recuperada_externa') return 'SERVIÇO EXTERNO';
    if (item.origin === 'externo_compra') return 'COMPRA NOVA';
    return 'PEÇAS & SERVIÇOS';
  };

  const handleRemovePartItem = (index: number) => {
    const itemToRemove = partsItems[index];
    // Se o item já havia sido baixado do estoque interno, devolve o saldo ao estoque
    if (itemToRemove && itemToRemove.stockDeducted && (itemToRemove.origin === 'almoxarifado_interno' || !itemToRemove.origin)) {
      const qtyToRestore = parseCleanPriceNumber(itemToRemove.quantity);
      if (qtyToRestore > 0) {
        const currentStored = getStoredInventory();
        const baseStock = currentStored.length > 0 ? currentStored : (inventory && inventory.length > 0 ? inventory : []);
        if (baseStock.length > 0) {
          const updatedStock = [...baseStock];
          const targetIdx = updatedStock.findIndex(inv => 
            (itemToRemove.inventoryItemId && inv.id === itemToRemove.inventoryItemId) ||
            (inv.code !== undefined && inv.code !== null && itemToRemove.description && String(inv.code).trim().toLowerCase() === String(itemToRemove.description).trim().toLowerCase()) ||
            (inv.name && itemToRemove.description && String(inv.name).trim().toLowerCase() === String(itemToRemove.description).trim().toLowerCase())
          );
          if (targetIdx !== -1) {
            updatedStock[targetIdx] = {
              ...updatedStock[targetIdx],
              quantity: (Number(updatedStock[targetIdx].quantity) || 0) + qtyToRestore,
              updatedAt: new Date().toISOString()
            };
            saveStoredInventory(updatedStock);
            setStoredInventory(updatedStock);
          }
        }
      }
    }
    setPartsItems(prev => prev.filter((_, i) => i !== index));
  };

  // Cálculo total de peças
  const totalPartsCalculated = (usePartsItemList || partsItems.length > 0)
    ? partsItems.reduce((acc, curr) => acc + (Number(curr.totalCost) || 0), 0)
    : (parseCleanPriceNumber(partsCostManual) || 0);

  const totalStockPartsCost = partsItems
    .filter(p => p.origin === 'almoxarifado_interno')
    .reduce((acc, curr) => acc + (Number(curr.totalCost) || 0), 0);

  const totalExternalPartsCost = partsItems
    .filter(p => p.origin === 'externo_compra')
    .reduce((acc, curr) => acc + (Number(curr.totalCost) || 0), 0);

  const totalRecoveredExternalCost = partsItems
    .filter(p => p.origin === 'recuperada_externa')
    .reduce((acc, curr) => acc + (Number(curr.totalCost) || 0), 0);

  // Mão de Obra
  const totalInternalLaborCalculated = laborItems.reduce((acc, curr) => acc + (Number(curr.totalCost) || 0), 0);
  const totalInternalHoursCalculated = Math.round(laborItems.reduce((acc, curr) => acc + (parseFloat(String(curr.hours || 0)) || 0), 0) * 100) / 100;
  const additionalLabor = parseCleanPriceNumber(laborCost);
  const totalLaborCalculated = totalInternalLaborCalculated + additionalLabor;

  const grandTotal = totalPartsCalculated + totalLaborCalculated;

  const currentMach = machineries.find(m => m.id === machineryId);
  const currentMachName = currentMach 
    ? (currentMach.licensePlateOrSerial ? `[${currentMach.licensePlateOrSerial}] ${currentMach.name || currentMach.model}` : (currentMach.name || currentMach.model || 'Veículo'))
    : 'Veículo';

  // Itens por categoria
  const externalPartsCount = partsItems.filter(p => p.origin === 'externo_compra').length;
  const internalPartsCount = partsItems.filter(p => p.origin === 'almoxarifado_interno').length;
  const recoveredPartsCount = partsItems.filter(p => p.origin === 'recuperada_externa').length;

  const executeSave = (options?: {
    markAsCompleted?: boolean;
    redirectToFinance?: boolean;
    triggerExpense?: boolean;
    closeOnSave?: boolean;
  }): boolean => {
    const todayIso = new Date().toISOString().split('T')[0];
    const isMarkingCompleted = Boolean(options?.markAsCompleted || activeTab === 'fiscal_financeiro');
    const targetStatus = isMarkingCompleted ? 'concluida' : status;
    const shouldGoToFinance = Boolean(options?.redirectToFinance);

    // Fallbacks inteligentes de data de conclusão para não travar a OS
    let finalCompletionDate = completionDate.trim();
    if (!finalCompletionDate && isMarkingCompleted) {
      finalCompletionDate = todayIso;
      setCompletionDate(todayIso);
    }
    const targetCompletionDate = finalCompletionDate || (isMarkingCompleted ? todayIso : undefined);

    if (isMarkingCompleted) {
      setStatus('concluida');
    }

    if (!machineryId) {
      setFeedbackBanner({
        type: 'save',
        message: 'Por favor, selecione o Veículo / Máquina da Ordem de Serviço na Aba 1.'
      });
      setActiveTab('geral');
      return false;
    }

    const effectiveDescription = description.trim() || `Ordem de Serviço ${osNumber || ''} - Manutenção de Frota`.trim();
    const effectiveDate = date.trim() || todayIso;

    const isDreOnly = Boolean(skipAccountsPayableDreOnly);
    const isTriggeringExpense = isDreOnly ? false : Boolean(options?.triggerExpense);

    const selectedMach = machineries.find(m => m.id === machineryId);
    const machName = selectedMach 
      ? (selectedMach.licensePlateOrSerial ? `[${selectedMach.licensePlateOrSerial}] ${selectedMach.name || selectedMach.model}` : selectedMach.name)
      : 'Veículo';

    // Determinar resumo de origem das peças
    let partsOriginSummary: MaintenanceLog['partsOriginSummary'] = 'sem_pecas';
    if (usePartsItemList && partsItems.length > 0) {
      if ((externalPartsCount > 0 || recoveredPartsCount > 0) && internalPartsCount > 0) {
        partsOriginSummary = 'misto';
      } else if (externalPartsCount > 0 || recoveredPartsCount > 0) {
        partsOriginSummary = 'externo';
      } else if (internalPartsCount > 0) {
        partsOriginSummary = 'almoxarifado';
      }
    } else if (totalPartsCalculated > 0) {
      partsOriginSummary = 'externo';
    }

    let finalMechanicName = workshopOrMechanic.trim();
    if ((!finalMechanicName || finalMechanicName === 'Mecânica Interna / Própria') && laborItems.length > 0) {
      finalMechanicName = laborItems.map(l => l.mechanicName).filter(Boolean).join(', ');
    }

    // Tratamento rigoroso numérico antes de persistir (previne NaN e string pura)
    const rawMeter = typeof currentHourMeterOrKm === 'number' 
      ? currentHourMeterOrKm 
      : parseInt(String(currentHourMeterOrKm).replace(/\D/g, ''), 10);
    const parsedCurrentHourMeter = !isNaN(rawMeter) && isFinite(rawMeter) ? Number(rawMeter) : 0;

    const rawNext = typeof nextServiceDue === 'number'
      ? nextServiceDue
      : parseInt(String(nextServiceDue).replace(/\D/g, ''), 10);
    const parsedNextServiceDue = !isNaN(rawNext) && isFinite(rawNext) && String(nextServiceDue).trim() !== ''
      ? Number(rawNext)
      : undefined;

    const idToUse = currentOsId || editingLog?.id || `maint_${Date.now()}`;
    if (!currentOsId) {
      setCurrentOsId(idToUse);
    }

    // 1. BAIXA NATIVA E AUTOMÁTICA NO ESTOQUE (COM CONTROLE POR LINHA CONTRA BAIXA DUPLICADA)
    const currentStored = getStoredInventory();
    const baseStock = currentStored.length > 0 ? currentStored : (inventory && inventory.length > 0 ? inventory : []);
    let updatedStock = [...baseStock];
    let hasNewDeductions = false;

    // LÓGICA DO LOOP:
    // Quando o usuário clica em "Salvar Ordem de Serviço", o script verifica cada linha.
    // Se a linha já estiver marcada como "baixada" (part.stockDeducted === true), o sistema APENAS a ignora e pula para a próxima.
    // O cálculo de subtração no estoque só é executado nas linhas novas que ainda não possuem essa marcação.
    // Assim que a linha nova for processada e salva com sucesso, marca-a imediatamente como "baixada".
    const processedPartsItems: MaintenancePartItem[] = partsItems.map(part => {
      // REGRA: Se a linha já estiver marcada como baixada, o sistema deve APENAS ignorá-la e pular para a próxima.
      if (part.stockDeducted) {
        return part;
      }

      // Executa cálculo de subtração no estoque apenas nas linhas novas de almoxarifado interno
      const isInternal = part.origin === 'almoxarifado_interno' || !part.origin;
      const qty = parseCleanPriceNumber(part.quantity);

      if (isInternal && qty > 0 && updatedStock.length > 0) {
        const targetIdx = updatedStock.findIndex(inv => 
          (part.inventoryItemId && inv.id === part.inventoryItemId) ||
          (inv.code !== undefined && inv.code !== null && part.description && String(inv.code).trim().toLowerCase() === String(part.description).trim().toLowerCase()) ||
          (inv.name && part.description && String(inv.name).trim().toLowerCase() === String(part.description).trim().toLowerCase())
        );

        if (targetIdx !== -1) {
          const currentQty = Number(updatedStock[targetIdx].quantidade_atual ?? updatedStock[targetIdx].quantity) || 0;
          const newQty = Math.max(0, Number((currentQty - qty).toFixed(2)));
          updatedStock[targetIdx] = {
            ...updatedStock[targetIdx],
            quantity: newQty,
            quantidade_atual: newQty,
            updatedAt: new Date().toISOString()
          };
          hasNewDeductions = true;

          // Assim que a linha nova for processada e salva com sucesso, marca-a imediatamente como "baixada"
          return {
            ...part,
            stockDeducted: true,
          };
        }
      }

      // Para linhas novas externas ou sem registro direto no inventário físico
      return {
        ...part,
        stockDeducted: true,
      };
    });

    if (hasNewDeductions) {
      saveStoredInventory(updatedStock);
      setStoredInventory(updatedStock);
    }

    // Atualiza imediatamente o estado da tabela de produtos para refletir as linhas como baixadas
    setPartsItems(processedPartsItems);

    const log: MaintenanceLog = {
      id: idToUse,
      osNumber: osNumber.trim() || `OS-${Date.now().toString().slice(-6)}`,
      date: effectiveDate,
      completionDate: targetCompletionDate,
      machineryId,
      machineryPlateOrName: machName,
      type,
      serviceCategory: (serviceCategory === 'Outro' || serviceCategory === 'Outro (Personalizado)') && customCategory.trim() ? customCategory.trim() : serviceCategory,
      location,
      locationDetails: locationDetails.trim() || undefined,
      executorType,
      executorName: finalMechanicName || workshopOrMechanic.trim() || 'Mecânica Interna',
      workshopOrMechanic: finalMechanicName || workshopOrMechanic.trim() || 'Mecânica Interna',
      description: effectiveDescription,
      partsOriginSummary,
      partsItems: usePartsItemList ? processedPartsItems : undefined,
      laborItems: laborItems.length > 0 ? laborItems : undefined,
      partsCost: totalPartsCalculated,
      laborCost: totalLaborCalculated,
      totalCost: grandTotal,
      currentHourMeterOrKm: parsedCurrentHourMeter,
      nextServiceDueHourMeterOrKm: parsedNextServiceDue,
      status: targetStatus,
      stockDeducted: true,
      skipAccountsPayableDreOnly: isDreOnly,
      notes: notes.trim() || undefined,
      createdAt: editingLog ? editingLog.createdAt : new Date().toISOString(),
      nfeLink: hasNfe ? {
        nfeNumber: nfeNumber.trim() || undefined,
        nfeSeries: nfeSeries.trim() || undefined,
        nfeAccessKey: nfeAccessKey.trim() || undefined,
        issueDate: nfeIssueDate,
        supplierName: nfeSupplierName.trim() || financialSupplier.trim() || undefined,
        totalNfeAmount: parseFloat(nfeTotalAmount) || grandTotal,
      } : undefined,
      financialConditions: isTriggeringExpense ? {
        createAccountsPayable: true,
        skipAccountsPayableDreOnly: false,
        paymentTerm,
        paymentMethod,
        firstDueDate: (installments.length > 0 && installments[0]?.dueDate) ? installments[0].dueDate : firstDueDate,
        installmentsCount: installments.length > 0 ? installments.length : 1,
        supplierName: financialSupplier.trim() || finalMechanicName || workshopOrMechanic.trim(),
        notes: `OS ${osNumber} - ${machName}`,
        installments: installments.length > 0 ? installments : undefined,
      } : (isDreOnly ? {
        createAccountsPayable: false,
        skipAccountsPayableDreOnly: true,
        paymentTerm: 'a_vista',
        paymentMethod: 'outro' as any,
        firstDueDate: effectiveDate,
        supplierName: 'Almoxarifado Interno',
        notes: `OS ${osNumber} - ${machName} (Lançamento Gerencial DRE / Abatimento de Estoque)`,
      } : (editingLog?.financialConditions || undefined)),
    };

    // REGRA DE OURO:
    // createExpense é estritamente isTriggeringExpense (desativado quando skipAccountsPayableDreOnly estiver ativo).
    onSave(log, {
      createExpense: isTriggeringExpense && grandTotal > 0,
      deductStock: true,
      createPurchaseRequest: generatePurchaseRequest || (targetStatus === 'aguardando_pecas' && externalPartsCount > 0),
      skipAccountsPayableDreOnly: isDreOnly,
    });

    if (options?.closeOnSave) {
      setSaveSuccess(true);
      setFeedbackBanner({
        type: 'save',
        message: 'Ordem de Serviço Concluída (Liberada) com sucesso!'
      });
      setTimeout(() => {
        onClose();
      }, 400);
      return true;
    }

    if (isTriggeringExpense) {
      setExpenseGenerated(true);
      setSaveSuccess(true);
      setFeedbackBanner({
        type: 'billed',
        message: 'Faturamento confirmado! Lançamento gerado com sucesso no Contas a Pagar.'
      });
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3500);
    } else if (isDreOnly && isMarkingCompleted) {
      setSaveSuccess(true);
      setFeedbackBanner({
        type: 'billed',
        message: 'OS Concluída! Custo lançado com sucesso no DRE e estoque físico baixado.'
      });
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3500);
    } else if (shouldGoToFinance) {
      setActiveTab('fiscal_financeiro');
      setFeedbackBanner({
        type: 'finalize',
        message: 'OS Finalizada como Concluída! Defina as condições de pagamento abaixo para faturar.'
      });
    } else {
      setSaveSuccess(true);
      setFeedbackBanner({
        type: 'save',
        message: 'Ordem de Serviço salva com sucesso! Os itens continuam disponíveis para novas adições.'
      });
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3500);
    }

    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSave({ triggerExpense: false });
  };

  // Mapeamento dinâmico de cores e alto contraste para o Status da Ordem
  const getStatusSelectStyle = (currentStatus: string) => {
    switch (currentStatus) {
      case 'aguardando_pecas':
        return 'bg-purple-100 text-purple-900 border-purple-400 font-bold shadow-xs';
      case 'em_andamento':
        return 'bg-amber-100 text-amber-950 border-amber-400 font-bold shadow-xs';
      case 'concluida':
        return 'bg-emerald-100 text-emerald-950 border-emerald-400 font-bold shadow-xs';
      case 'agendada':
        return 'bg-zinc-100 text-zinc-900 border-zinc-300 font-bold shadow-xs';
      case 'cancelada':
        return 'bg-rose-100 text-rose-950 border-rose-300 font-bold shadow-xs';
      default:
        return 'bg-zinc-100 text-zinc-900 border-zinc-300 font-bold shadow-xs';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 backdrop-blur-xs p-2 sm:p-4 overflow-hidden overflow-y-hidden">
      <div 
        className="bg-white dark:bg-stone-900 w-[95%] max-w-[95%] max-h-[94vh] flex flex-col rounded-2xl shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9),inset_-1px_-1px_0px_rgba(0,0,0,0.15)] animate-in fade-in zoom-in-95 duration-150 overflow-hidden border border-slate-400 dark:border-stone-700 mx-auto"
        role="dialog"
        aria-modal="true"
      >
        {/* Header - Moldura Metálica 3D Acetinada */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 border-b border-slate-400 dark:border-stone-700 bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 dark:from-stone-900 dark:via-stone-850 dark:to-stone-900 text-slate-800 dark:text-stone-100 shrink-0 rounded-t-2xl shadow-xs">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/80 dark:bg-stone-800 text-slate-800 dark:text-stone-100 flex items-center justify-center border border-slate-300 dark:border-stone-700 shadow-2xs shrink-0">
              <Wrench className="w-4 h-4 text-slate-700 dark:text-stone-200" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-stone-100">
                  {editingLog ? `EDITAR OS: ${editingLog.osNumber || editingLog.id}` : 'NOVA ORDEM DE SERVIÇO (OS)'}
                </h3>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-200 text-slate-800 border border-slate-300">
                  {osNumber}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-stone-400 font-medium">
                Manutenção na Roça, Estrada ou Oficina • Baixa de Estoque • NF-e • Contas a Pagar
              </p>
            </div>
          </div>
          {/* Canto superior direito: Seletor Global de Status da OS + Botão Fechar */}
          <div className="flex items-center space-x-2.5 sm:space-x-3">
            <div className="flex items-center space-x-1.5 bg-slate-100 dark:bg-stone-800 px-2 py-0.5 rounded-lg border border-slate-300 dark:border-stone-700 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-600 dark:text-stone-400 uppercase tracking-wider whitespace-nowrap hidden sm:inline">
                Status:
              </span>
              <select
                id="maintenance-status-select"
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className={`px-2 py-0.5 border rounded-md text-xs font-bold transition-all duration-150 cursor-pointer focus:ring-1 focus:ring-slate-400 focus:outline-hidden shadow-xs ${getStatusSelectStyle(status)}`}
                title="Status da Ordem de Serviço (Fixo em todas as abas)"
              >
                <option value="em_andamento" className="bg-white text-amber-950 font-bold">⏳ Em Andamento</option>
                <option value="concluida" className="bg-white text-emerald-950 font-bold">✓ Concluída (Liberado)</option>
                <option value="aguardando_pecas" className="bg-white text-purple-950 font-bold">📦 Aguardando Peças</option>
                <option value="agendada" className="bg-white text-zinc-900 font-bold">📅 Agendada</option>
                <option value="cancelada" className="bg-white text-rose-950 font-bold">✕ Cancelada</option>
              </select>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-300/60 dark:text-stone-400 dark:hover:text-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
              title="Fechar janela"
            >
              <X className="w-4 h-4 text-slate-700 dark:text-stone-200" />
            </button>
          </div>
        </div>

        {/* Subtabs de Navegação do Formulário (3 Abas Unificadas - Barra em Cinza Gelo bg-zinc-200) */}
        <div 
          aria-label="Abas de Manutenção"
          className="flex items-center gap-1.5 p-1.5 bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 dark:from-stone-900 dark:via-stone-850 dark:to-stone-900 border-b border-slate-400 dark:border-stone-700 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9),inset_-1px_-1px_0px_rgba(0,0,0,0.15)] dark:shadow-[inset_1px_1px_0px_rgba(255,255,255,0.08),inset_-1px_-1px_0px_rgba(0,0,0,0.3)] overflow-x-auto shrink-0"
        >
          <button
            type="button"
            id="tab-diagnostico-equipe-local"
            onClick={() => setActiveTab('geral')}
            className={`py-1.5 px-3 text-xs font-bold transition rounded-lg whitespace-nowrap flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'geral'
                ? 'bg-white text-zinc-900 dark:bg-stone-800 dark:text-white shadow-xs border border-zinc-400 dark:border-stone-600'
                : 'text-zinc-700 dark:text-stone-400 hover:text-zinc-900 dark:hover:text-stone-200 hover:bg-zinc-300/60 dark:hover:bg-stone-800/60'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>1. Diagnóstico, Equipe & Local</span>
            {laborItems.length > 0 && (
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                activeTab === 'geral' ? 'bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200' : 'bg-zinc-300 text-zinc-800 dark:bg-stone-700 dark:text-stone-300'
              }`}>
                {laborItems.length} {laborItems.length === 1 ? 'mecânico' : 'mecânicos'}
              </span>
            )}
          </button>

          <button
            type="button"
            id="tab-pecas-estoque"
            onClick={() => setActiveTab('pecas')}
            className={`py-1.5 px-3 text-xs font-bold transition rounded-lg whitespace-nowrap flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'pecas'
                ? 'bg-white text-zinc-900 dark:bg-stone-800 dark:text-white shadow-xs border border-zinc-400 dark:border-stone-600'
                : 'text-zinc-700 dark:text-stone-400 hover:text-zinc-900 dark:hover:text-stone-200 hover:bg-zinc-300/60 dark:hover:bg-stone-800/60'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>2. Peças & Estoque</span>
            {partsItems.length > 0 && (
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                activeTab === 'pecas' ? 'bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200' : 'bg-zinc-300 text-zinc-800 dark:bg-stone-700 dark:text-stone-300'
              }`}>
                {partsItems.length}
              </span>
            )}
          </button>

          <button
            type="button"
            id="tab-nfe-financeiro"
            onClick={() => setActiveTab('fiscal_financeiro')}
            className={`py-1.5 px-3 text-xs font-bold transition rounded-lg whitespace-nowrap flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'fiscal_financeiro'
                ? 'bg-white text-zinc-900 dark:bg-stone-800 dark:text-white shadow-xs border border-zinc-400 dark:border-stone-600'
                : 'text-zinc-700 dark:text-stone-400 hover:text-zinc-900 dark:hover:text-stone-200 hover:bg-zinc-300/60 dark:hover:bg-stone-800/60'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>3. NF-e & Financeiro</span>
            {(hasNfe || createExpense) && (
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            )}
          </button>
        </div>

        {/* Form Body com Estrutura Flexível: Topo e Base Fixos, Centro Rolável em Cinza Claro (bg-zinc-100) */}
        <form onSubmit={handleSubmit} noValidate className="flex-1 flex flex-col min-h-0 overflow-hidden bg-zinc-100">
          
          {/* Conteúdo Central com Rolagem Vertical Independente */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4 flex flex-col bg-zinc-100">

            {/* Banner de Feedback de Ação */}
            {feedbackBanner && (
              <div className={`p-3 rounded-xl border flex items-center justify-between transition-all duration-200 shadow-xs ${
                feedbackBanner.type === 'billed'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200'
                  : feedbackBanner.type === 'finalize'
                  ? 'bg-zinc-900 border-zinc-700 text-zinc-100'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-950'
              }`}>
                <div className="flex items-center space-x-2.5">
                  {feedbackBanner.type === 'billed' ? (
                    <CheckCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                  ) : feedbackBanner.type === 'finalize' ? (
                    <Receipt className="w-5 h-5 text-zinc-300 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  )}
                  <span className="text-xs font-bold">{feedbackBanner.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFeedbackBanner(null)}
                  className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 p-1 cursor-pointer"
                  title="Fechar mensagem"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          
          {/* ======================================================== */}
          {/* ABA 1 UNIFICADA: DIAGNÓSTICO, EQUIPE & LOCAL (2 COLUNAS) */}
          {/* ======================================================== */}
          {activeTab === 'geral' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 sm:gap-3.5 animate-in fade-in duration-150 items-stretch flex-1 min-h-0">
              
              {/* --- COLUNA DA ESQUERDA: DADOS DO VEÍCULO, AFERIÇÃO, DIAGNÓSTICO, LOCAL E EXECUÇÃO --- */}
              <div className="space-y-2.5 flex flex-col">
                {/* Bloco 1: Identificação da OS e Veículo */}
                <div className="p-3 bg-white rounded-xl border border-zinc-300 shadow-2xs">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {/* Número da OS */}
                    <div>
                      <label className="block text-[10.5px] font-bold text-zinc-700 mb-0.5 truncate">
                        Número da OS
                      </label>
                      <input
                        type="text"
                        value={osNumber}
                        onChange={(e) => setOsNumber(e.target.value)}
                        className="w-full px-2 py-1.5 bg-white border border-zinc-300 rounded-lg text-xs font-mono font-bold text-zinc-900 focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700"
                        placeholder="OS-2026-0001"
                      />
                    </div>

                    {/* Data da Abertura */}
                    <div>
                      <label className="block text-[10.5px] font-bold text-zinc-700 mb-0.5 truncate">
                        Abertura *
                      </label>
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full px-2 py-1.5 bg-white border border-zinc-300 rounded-lg text-xs font-semibold text-zinc-900 focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700"
                      />
                    </div>

                    {/* Previsão de Término */}
                    <div>
                      <label className="block text-[10.5px] font-bold text-zinc-700 mb-0.5 truncate">
                        Previsão Término
                      </label>
                      <input
                        type="date"
                        value={completionDate}
                        onChange={(e) => setCompletionDate(e.target.value)}
                        className="w-full px-2 py-1.5 bg-white border border-zinc-300 rounded-lg text-xs font-semibold text-zinc-900 focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700"
                      />
                    </div>

                    {/* Veículo / Máquina */}
                    <div>
                      <label className="block text-[10.5px] font-bold text-zinc-700 mb-0.5 truncate">
                        Máquina *
                      </label>
                      <select
                        value={machineryId}
                        onChange={(e) => handleMachineryChange(e.target.value)}
                        className="w-full px-2 py-1.5 bg-white border border-zinc-300 rounded-lg text-xs font-semibold text-zinc-900 focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700 cursor-pointer"
                      >
                        <option value="">Selecione...</option>
                        {machineries.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.licensePlateOrSerial ? `[${m.licensePlateOrSerial}] ` : ''}
                            {m.name || m.model} ({m.categoryType || 'Equipamento'})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Bloco 2: Aferição e Controle (Horímetro e Próxima Revisão) */}
                <div className="p-3 bg-white rounded-xl border border-zinc-300 shadow-2xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10.5px] font-bold text-zinc-700 mb-0.5 truncate">
                        Horímetro / KM Atual
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formatThousand(currentHourMeterOrKm)}
                        onChange={(e) => handleThousandInput(e.target.value, setCurrentHourMeterOrKm)}
                        placeholder="Ex: 5.000"
                        className="w-full px-2 py-1.5 bg-white border border-zinc-300 rounded-lg text-xs font-semibold text-zinc-900 focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700"
                      />
                    </div>

                    <div>
                      <label className="block text-[10.5px] font-bold text-zinc-700 mb-0.5 truncate">
                        Próxima Revisão (h/KM)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formatThousand(nextServiceDue)}
                        onChange={(e) => handleThousandInput(e.target.value, setNextServiceDue)}
                        placeholder="Ex: 6.000"
                        className="w-full px-2 py-1.5 bg-white border border-zinc-300 rounded-lg text-xs font-semibold text-zinc-900 focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700"
                      />
                    </div>
                  </div>
                </div>

                {/* Bloco 3: Tipo de Manutenção e Categoria */}
                <div className="p-3 bg-white rounded-xl border border-zinc-300 space-y-2 shadow-2xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10.5px] font-bold text-zinc-700 mb-1">
                        Tipo de Manutenção
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { id: 'preventiva', label: 'Preventiva' },
                          { id: 'corretiva', label: 'Corretiva' },
                          { id: 'preditiva', label: 'Preditiva' },
                          { id: 'reforma_entressafra', label: 'Entressafra' },
                        ].map((t) => {
                          const isActive = type === t.id || (t.id === 'reforma_entressafra' && (type as any) === 'revisao_periodica');
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => {
                                const selectedType = t.id as any;
                                setType(selectedType);
                                if (selectedType === 'reforma_entressafra') {
                                  setServiceCategory('Revisão (entressafra)');
                                }
                              }}
                              className={`py-1.5 px-1.5 text-[10.5px] rounded-lg border text-center transition cursor-pointer ${
                                isActive
                                  ? 'border-zinc-800 bg-zinc-100 text-zinc-950 font-bold ring-1 ring-zinc-800 shadow-xs'
                                  : 'bg-zinc-50 border-zinc-300 text-zinc-700 hover:bg-zinc-100 font-medium'
                              }`}
                            >
                              {t.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[10.5px] font-bold text-zinc-700">
                          Categoria do Serviço
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsCategoriesModalOpen(true)}
                          className="text-[10px] text-zinc-700 hover:text-zinc-950 font-bold flex items-center space-x-1 hover:underline cursor-pointer"
                          title="Gerenciar, incluir, editar ou excluir categorias de serviço"
                        >
                          <Tag className="w-2.5 h-2.5" />
                          <span>Gerenciar</span>
                        </button>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <select
                          value={serviceCategory}
                          onChange={(e) => setServiceCategory(e.target.value)}
                          className="flex-1 px-2 py-1.5 bg-white border border-zinc-300 rounded-lg text-xs font-semibold text-zinc-900 focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700 cursor-pointer"
                        >
                          {sortedCategories.map((cat) => (
                            <option key={cat.id} value={cat.name}>
                              {cat.name}
                            </option>
                          ))}
                          {!sortedCategories.some(c => c.name === serviceCategory) && serviceCategory && (
                            <option value={serviceCategory}>{serviceCategory}</option>
                          )}
                        </select>

                        <button
                          type="button"
                          onClick={() => setIsCategoriesModalOpen(true)}
                          className="p-1.5 border border-zinc-300 bg-white hover:bg-zinc-100 rounded-lg text-zinc-700 transition cursor-pointer shrink-0"
                          title="Incluir, editar ou excluir categorias"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {(serviceCategory === 'Outro' || serviceCategory === 'Outro (Personalizado)') && (
                    <div>
                      <label className="block text-[10.5px] font-bold text-zinc-700 mb-0.5">
                        Especifique a Categoria
                      </label>
                      <input
                        type="text"
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        placeholder="Ex: Regulagem de Rotor de Craqueador"
                        className="w-full px-2 py-1.5 bg-white border border-zinc-300 rounded-lg text-xs font-semibold text-zinc-900 focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700"
                      />
                    </div>
                  )}
                </div>

                {/* Bloco 4: Descrição do Problema / Diagnóstico */}
                <div className="p-3 bg-white rounded-xl border border-zinc-300 shadow-2xs">
                  <label className="block text-[10.5px] font-bold text-zinc-700 mb-1">
                    Descrição do Diagnóstico / Serviço Executado *
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ex: Troca de óleo da caixa de transmissão e substituição de 4 facas do rotor da ensiladeira que empenaram no talhão 3..."
                    rows={2}
                    className="w-full px-2.5 py-1.5 bg-white border border-zinc-300 rounded-lg text-xs text-zinc-900 focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700 resize-none"
                  />
                </div>

                {/* Bloco 5: Local da Manutenção */}
                <div className="p-3 bg-white rounded-xl border border-zinc-300 space-y-2 shadow-2xs">
                  <div className="flex items-center space-x-1.5">
                    <MapPin className="w-3.5 h-3.5 text-zinc-700" />
                    <h4 className="text-[10.5px] font-bold text-zinc-800 uppercase tracking-wider">
                      Local da Manutenção
                    </h4>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {[
                      {
                        id: 'roca',
                        title: 'Roça (Campo)',
                        subtitle: 'Lavoura/Silagem',
                      },
                      {
                        id: 'estrada',
                        title: 'Estrada',
                        subtitle: 'Socorro Vicinal',
                      },
                      {
                        id: 'oficina_interna',
                        title: 'Oficina Interna',
                        subtitle: 'Nosso Barracão',
                      },
                      {
                        id: 'oficina_externa',
                        title: 'Oficina Externa',
                        subtitle: 'Concessionária/3º',
                      },
                    ].map((loc) => {
                      const isActive = location === loc.id;
                      return (
                        <button
                          key={loc.id}
                          type="button"
                          onClick={() => setLocation(loc.id as any)}
                          className={`py-1.5 px-2 rounded-lg border text-center transition cursor-pointer ${
                            isActive
                              ? 'border-zinc-800 bg-zinc-100 text-zinc-950 font-bold ring-1 ring-zinc-800 shadow-xs'
                              : 'bg-zinc-50 border-zinc-300 text-zinc-700 hover:bg-zinc-100'
                          }`}
                        >
                          <span className={`text-xs font-bold block truncate ${isActive ? 'text-zinc-950' : 'text-zinc-700'}`}>{loc.title}</span>
                          <span className={`text-[9px] block truncate ${isActive ? 'text-zinc-600 font-semibold' : 'text-zinc-500'}`}>{loc.subtitle}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div>
                    <input
                      type="text"
                      value={locationDetails}
                      onChange={(e) => setLocationDetails(e.target.value)}
                      placeholder={
                        location === 'roca' 
                          ? 'Ponto de referência: Ex: Talhão ou coordenadas da propriedade'
                          : location === 'estrada'
                          ? 'Ponto de referência: Ex: BR-163 KM 210 sentido Toledo'
                          : location === 'oficina_interna'
                          ? 'Ponto de referência: Ex: Box 2 do Barracão Principal'
                          : 'Ponto de referência: Ex: Oficina Diesel Power - Toledo/PR'
                      }
                      className="w-full px-2.5 py-1.5 h-8 bg-white border border-zinc-300 rounded-lg text-xs text-zinc-900 focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700"
                    />
                  </div>
                </div>

                {/* Bloco 6: Modalidade de Execução do Serviço */}
                <div className="p-3 bg-white rounded-xl border border-zinc-300 space-y-2 shadow-2xs">
                  <div className="flex items-center space-x-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-zinc-700" />
                    <h4 className="text-[10.5px] font-bold text-zinc-800 uppercase tracking-wider">
                      Modalidade de Execução
                    </h4>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {[
                      { id: 'equipe_propria', label: 'Equipe Própria', desc: 'Operador/Equipe' },
                      { id: 'mecanico_interno', label: 'Mecânica Interna', desc: 'Mecânicos base' },
                      { id: 'mecanico_campo', label: 'Socorro Campo', desc: 'Terceiro roça' },
                      { id: 'mecanica_terceirizada', label: 'Oficina Externa', desc: 'Concessionária' },
                    ].map((ex) => {
                      const isActive = executorType === ex.id;
                      return (
                        <button
                          key={ex.id}
                          type="button"
                          onClick={() => handleExecutorTypeChange(ex.id as any)}
                          className={`py-1.5 px-2 rounded-lg border text-center transition cursor-pointer ${
                            isActive
                              ? 'border-zinc-800 bg-zinc-100 text-zinc-950 font-bold ring-1 ring-zinc-800 shadow-xs'
                              : 'bg-zinc-50 border-zinc-300 text-zinc-700 hover:bg-zinc-100'
                          }`}
                        >
                          <span className={`text-xs font-bold block truncate ${isActive ? 'text-zinc-950' : 'text-zinc-700'}`}>{ex.label}</span>
                          <span className={`text-[9px] block truncate ${isActive ? 'text-zinc-600 font-semibold' : 'text-zinc-500'}`}>{ex.desc}</span>
                        </button>
                      );
                    })}
                  </div>

                  {(executorType === 'mecanico_campo' || executorType === 'mecanica_terceirizada') && (
                    <div>
                      <input
                        type="text"
                        value={workshopOrMechanic}
                        onChange={(e) => setWorkshopOrMechanic(e.target.value)}
                        placeholder="Nome da Oficina Externa ou Prestador Socorro Terceiro *"
                        className="w-full px-2.5 py-1.5 h-8 bg-white border border-zinc-300 rounded-lg text-xs font-semibold text-zinc-900 focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* --- COLUNA DA DIREITA: EXCLUSIVAMENTE MÃO DE OBRA INTERNA (MECÂNICOS) --- */}
              <div className="flex flex-col h-full min-h-0 space-y-2">
                {/* Bloco 1: MÃO DE OBRA INTERNA (MECÂNICOS) NO TOPO DIREITO */}
                <div className="p-3.5 bg-white rounded-2xl border border-zinc-300 space-y-2.5 shadow-2xs flex-1 flex flex-col min-h-[580px] lg:min-h-0">
                  <div className="flex items-center justify-between shrink-0">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 rounded-md bg-zinc-100 text-zinc-700 flex items-center justify-center border border-zinc-200">
                        <Users className="w-3.5 h-3.5" />
                      </div>
                      <h4 className="text-xs font-black text-zinc-800 uppercase tracking-wider">
                        Mão de Obra Interna (Mecânicos)
                      </h4>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddLaborItem}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95 cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Mecânico</span>
                    </button>
                  </div>

                  {/* Lista dinâmica com amplo espaço vertical e scrollbar refinada */}
                  {laborItems.length === 0 ? (
                    <div className="flex-1 min-h-[280px] py-6 px-3 text-center border border-dashed border-zinc-300 bg-zinc-50 rounded-xl flex flex-col items-center justify-center space-y-1.5">
                      <Users className="w-6 h-6 text-zinc-400" />
                      <p className="text-xs text-zinc-600 font-medium">
                        Nenhum mecânico listado nesta Ordem de Serviço.
                      </p>
                      <button
                        type="button"
                        onClick={handleAddLaborItem}
                        className="mt-1 px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
                      >
                        + Adicionar Mão de Obra
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 flex-1 min-h-0 overflow-y-auto pr-1">
                      {laborItems.map((item, index) => {
                        const itemKey = item.id || String(index);
                        const isPontoExpanded = !!expandedLaborPonto[itemKey];
                        const recordedPeriodsCount = (item.periods || []).filter(p => p.startTime && p.endTime).length;
                        const itemHoursDisplay = (item.hours !== undefined && item.hours !== null ? Number(item.hours) : 0).toFixed(2).replace('.', ',');

                        return (
                          <div
                            key={itemKey}
                            className="p-3 bg-zinc-50 rounded-xl border border-zinc-300 space-y-2 shadow-2xs transition-all hover:border-zinc-400"
                          >
                            {/* Cabeçalho do Card do Mecânico */}
                            <div className="flex items-center justify-between pb-1 border-b border-zinc-200">
                              <span className="text-[11px] font-bold text-zinc-800 uppercase tracking-wider font-mono flex items-center space-x-1.5">
                                <span className="w-5 h-5 rounded-md bg-zinc-900 text-white flex items-center justify-center text-[10px] font-black shadow-2xs">
                                  #{index + 1}
                                </span>
                                <span>Mecânico #{index + 1}</span>
                              </span>

                              <button
                                type="button"
                                onClick={() => handleRemoveLaborItem(index)}
                                className="p-1 text-zinc-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition cursor-pointer"
                                title="Remover mecânico"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Grid com Seleção de Funcionário, Data, Horas, Valor/h e Subtotal */}
                            <div className="grid grid-cols-12 gap-2 items-end">
                              {/* Selecionar Funcionário */}
                              <div className="col-span-12 sm:col-span-4">
                                <label className="block text-[10px] font-bold text-zinc-600 mb-1">
                                  Funcionário / Mecânico
                                </label>
                                <select
                                  value={item.employeeId || ''}
                                  onChange={(e) => {
                                    const selectedId = e.target.value;
                                    const found = allEmployeesList.find(emp => emp.id === selectedId);
                                    handleUpdateLaborItem(index, { 
                                      employeeId: selectedId,
                                      mechanicName: found ? found.name : (selectedId ? item.mechanicName : '')
                                    });
                                  }}
                                  className="w-full px-2.5 py-1.5 bg-white border border-zinc-300 rounded-lg text-xs font-semibold text-zinc-900 focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700 cursor-pointer shadow-2xs"
                                >
                                  <option value="">Selecione funcionário...</option>
                                  {mechanicEmployees.map((emp) => (
                                    <option key={emp.id} value={emp.id}>
                                      {emp.name} {emp.role ? `(${emp.role})` : ''}
                                    </option>
                                  ))}
                                  {item.employeeId && !mechanicEmployees.some(e => e.id === item.employeeId) && (
                                    <option value={item.employeeId}>
                                      {allEmployeesList.find(e => e.id === item.employeeId)?.name || item.mechanicName || 'Funcionário selecionado'}
                                    </option>
                                  )}
                                </select>
                                {(!item.employeeId || !allEmployeesList.some(e => e.id === item.employeeId)) && (
                                  <input
                                    type="text"
                                    value={item.mechanicName || ''}
                                    onChange={(e) => handleUpdateLaborItem(index, { mechanicName: e.target.value })}
                                    placeholder="Ou nome avulso..."
                                    className="w-full mt-1 px-2 py-1 bg-white border border-zinc-300 rounded-md text-[11px] text-zinc-900"
                                  />
                                )}
                              </div>

                              {/* Data do Lançamento */}
                              <div className="col-span-6 sm:col-span-2">
                                <label className="block text-[10px] font-bold text-zinc-600 mb-1 text-center">
                                  Data
                                </label>
                                <input
                                  type="date"
                                  value={item.dataLancamento || item.date || new Date().toISOString().split('T')[0]}
                                  onChange={(e) => handleUpdateLaborItem(index, { 
                                    dataLancamento: e.target.value,
                                    date: e.target.value 
                                  })}
                                  title="Data da execução das horas"
                                  className="w-full px-2 py-1.5 bg-white border border-zinc-300 rounded-lg text-xs font-semibold text-center text-zinc-900 focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700 cursor-pointer shadow-2xs"
                                />
                              </div>

                              {/* Horas (Total Calculado - Readonly) */}
                              <div className="col-span-3 sm:col-span-2">
                                <label className="block text-[10px] font-bold text-zinc-600 mb-1 text-center">
                                  Horas
                                </label>
                                <input
                                  type="text"
                                  readOnly
                                  value={`${itemHoursDisplay}h`}
                                  placeholder="0,00h"
                                  title="Total de horas calculado pelos turnos do Apontamento de Ponto"
                                  className="w-full px-2 py-1.5 bg-zinc-100 border border-zinc-300 rounded-lg text-xs font-black text-center text-zinc-900 cursor-not-allowed select-none shadow-2xs font-mono"
                                />
                              </div>

                              {/* Valor da Hora */}
                              <div className="col-span-3 sm:col-span-2">
                                <label className="block text-[10px] font-bold text-zinc-600 mb-1 text-right">
                                  $/hora
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={item.hourlyRate !== undefined && item.hourlyRate !== null ? item.hourlyRate : ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    handleUpdateLaborItem(index, { hourlyRate: val === '' ? 0 : (parseFloat(val) || 0) });
                                  }}
                                  placeholder="R$/h"
                                  title="Valor da Hora (R$)"
                                  className="w-full px-2 py-1.5 bg-white border border-zinc-300 rounded-lg text-xs font-bold text-right text-zinc-900 focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700 shadow-2xs font-mono"
                                />
                              </div>

                              {/* Subtotal */}
                              <div className="col-span-12 sm:col-span-2">
                                <label className="block text-[10px] font-bold text-zinc-600 mb-1 text-right">
                                  Subtotal
                                </label>
                                <div className="px-2 py-1.5 bg-zinc-100 rounded-lg text-xs font-black text-zinc-900 font-mono text-right truncate border border-zinc-300 shadow-2xs">
                                  {formatCurrencyBRL(item.totalCost || 0)}
                                </div>
                              </div>
                            </div>

                            {/* Bloco Acordeom Recolhível de Apontamento de Ponto */}
                            <div className="mt-1.5 pt-1.5 border-t border-zinc-200">
                              <div
                                onClick={() => toggleLaborPonto(itemKey)}
                                className="flex items-center justify-between p-2 rounded-lg bg-zinc-100 hover:bg-zinc-200/80 border border-zinc-300 cursor-pointer transition-colors select-none text-zinc-800"
                              >
                                <div className="flex items-center space-x-2">
                                  <Clock className="w-3.5 h-3.5 text-zinc-700" />
                                  <span className="text-[10.5px] font-bold text-zinc-800 uppercase tracking-wider">
                                    Apontamento de Ponto
                                  </span>
                                  {recordedPeriodsCount > 0 && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold bg-zinc-200 text-zinc-800 border border-zinc-300">
                                      {recordedPeriodsCount} {recordedPeriodsCount === 1 ? 'turno' : 'turnos'} ({itemHoursDisplay}h)
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center space-x-1 text-zinc-600">
                                  <span className="text-[10px] font-semibold">
                                    {isPontoExpanded ? 'Recolher' : 'Expandir ponto'}
                                  </span>
                                  {isPontoExpanded ? (
                                    <ChevronUp className="w-3.5 h-3.5" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  )}
                                </div>
                              </div>

                              {/* Conteúdo Expandido dos Turnos */}
                              {isPontoExpanded && (
                                <div className="mt-2 space-y-1.5 pl-1 pr-1 pb-1 animate-in fade-in-50 duration-150">
                                  <div className="flex items-center justify-between pb-1">
                                    <span className="text-[10px] text-zinc-600">
                                      Lançamento detalhado de horários trabalhados (Entrada e Saída)
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleAddLaborPeriod(index)}
                                      className="inline-flex items-center space-x-1 px-2 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-white text-[10px] font-bold rounded-md shadow-xs transition active:scale-95 cursor-pointer"
                                      title="Adiciona novo turno/intervalo"
                                    >
                                      <Plus className="w-3 h-3" />
                                      <span>+ Adicionar Período</span>
                                    </button>
                                  </div>

                                  {/* Linhas de Turnos */}
                                  <div className="space-y-1">
                                    {(item.periods && item.periods.length > 0 
                                      ? item.periods 
                                      : [{ id: `p_${item.id || index}_1`, startTime: '', endTime: '' }]
                                    ).map((period, pIdx) => {
                                      const pNum = pIdx + 1;
                                      const periodHours = calculatePeriodHours(period.startTime, period.endTime);
                                      return (
                                        <div
                                          key={period.id || pIdx}
                                          className="flex flex-wrap items-center justify-between gap-1.5 p-1.5 bg-white rounded-md border border-zinc-300 text-xs shadow-2xs"
                                        >
                                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                                            <span className="text-[10px] font-mono font-bold text-zinc-800 bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-300">
                                              Turno #{pNum}
                                            </span>

                                            {/* Entrada N */}
                                            <div className="flex items-center space-x-1">
                                              <label 
                                                htmlFor={`labor-${index}-start-${pIdx}`} 
                                                className="text-[9.5px] font-bold text-zinc-700 whitespace-nowrap"
                                              >
                                                Entrada:
                                              </label>
                                              <input
                                                id={`labor-${index}-start-${pIdx}`}
                                                type="time"
                                                value={period.startTime || ''}
                                                onChange={(e) => handleUpdateLaborPeriod(index, pIdx, 'startTime', e.target.value)}
                                                className="px-1.5 py-0.5 bg-zinc-50 border border-zinc-300 rounded text-xs font-semibold text-zinc-900 focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700 cursor-pointer"
                                              />
                                            </div>

                                            <span className="text-zinc-400 text-xs font-bold">às</span>

                                            {/* Saída N */}
                                            <div className="flex items-center space-x-1">
                                              <label 
                                                htmlFor={`labor-${index}-end-${pIdx}`} 
                                                className="text-[9.5px] font-bold text-zinc-700 whitespace-nowrap"
                                              >
                                                Saída:
                                              </label>
                                              <input
                                                id={`labor-${index}-end-${pIdx}`}
                                                type="time"
                                                value={period.endTime || ''}
                                                onChange={(e) => handleUpdateLaborPeriod(index, pIdx, 'endTime', e.target.value)}
                                                className="px-1.5 py-0.5 bg-zinc-50 border border-zinc-300 rounded text-xs font-semibold text-zinc-900 focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700 cursor-pointer"
                                              />
                                            </div>
                                          </div>

                                          {/* Duração calculada e botão remover período */}
                                          <div className="flex items-center space-x-1.5 ml-auto">
                                            {period.startTime && period.endTime ? (
                                              <span className="px-1.5 py-0.5 rounded text-[10.5px] font-mono font-bold bg-zinc-100 text-zinc-900 border border-zinc-300">
                                                {formatPeriodDuration(period.startTime, period.endTime)} ({periodHours.toFixed(2).replace('.', ',')}h)
                                              </span>
                                            ) : (
                                              <span className="text-[10px] text-zinc-400 italic">
                                                Preencha horários
                                              </span>
                                            )}

                                            {(item.periods && item.periods.length > 1) && (
                                              <button
                                                type="button"
                                                onClick={() => handleRemoveLaborPeriod(index, pIdx)}
                                                className="p-1 text-zinc-400 hover:text-rose-600 rounded hover:bg-rose-50 transition cursor-pointer"
                                                title={`Excluir Período ${pNum}`}
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Card de Consolidação / Rodapé Escuro da Mão de Obra */}
                  <div className="mt-auto shrink-0 p-3 bg-zinc-900 rounded-xl border border-zinc-800 text-white flex items-center justify-between shadow-md">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-300 flex items-center justify-center shrink-0 border border-zinc-700">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white block leading-tight">
                          Total Mão de Obra
                        </span>
                        <div className="flex items-center space-x-2 mt-0.5">
                          <span className="text-[11px] text-zinc-400">
                            {laborItems.length} {laborItems.length === 1 ? 'mecânico' : 'mecânicos'}
                          </span>
                          <span className="text-zinc-600">•</span>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-800 text-zinc-200 border border-zinc-700">
                            {totalInternalHoursCalculated.toFixed(2).replace('.', ',')}h
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-sm sm:text-base font-black text-white font-mono tracking-tight">
                        {formatCurrencyBRL(totalInternalLaborCalculated)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ======================================================== */}
          {/* ABA 2: PEÇAS & ESTOQUE (MULTI-ORIGEM) */}
          {/* ======================================================== */}
          {activeTab === 'pecas' && (
            <div className="min-h-full flex-1 flex flex-col justify-between space-y-3 animate-in fade-in duration-150">
              <div className="flex-1 flex flex-col space-y-3 min-h-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center space-x-2">
                    <span>Peças, Insumos & Serviços de Recuperação</span>
                  </h4>
                  <p className="text-xs text-zinc-600">
                    Registre peças do estoque interno, compras novas ou peças enviadas para recuperação externa (torno, retífica, solda).
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Seletor Dropdown de Preço Padrão da OS */}
                  <div className="flex items-center space-x-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-zinc-300 shadow-2xs">
                    <Tag className="w-3.5 h-3.5 text-zinc-700 shrink-0" />
                    <span className="text-[11px] font-bold text-zinc-700 whitespace-nowrap">
                      Preço Padrão da OS:
                    </span>
                    <select
                      value={defaultPriceType}
                      onChange={(e) => handleDefaultPriceTypeChange(e.target.value as DefaultOsPriceType)}
                      className="text-xs font-bold bg-zinc-50 text-zinc-900 border border-zinc-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700 cursor-pointer shadow-2xs"
                      title="Selecione qual tabela de preço será preenchida automaticamente ao adicionar itens na OS"
                    >
                      <option value="venda">Preço de Venda (Final)</option>
                      <option value="custo">Preço de Custo</option>
                      <option value="atacado">Preço de Atacado</option>
                      <option value="promocional">Preço Promocional</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      osPartSearchInputRef.current?.focus();
                      osPartSearchInputRef.current?.select();
                    }}
                    className="inline-flex items-center space-x-1.5 px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar Peça / Serviço</span>
                  </button>
                </div>
              </div>

              {/* ============================================================== */}
              {/* 1. CONJUNTO DE INPUTS DE ENTRADA SUPERIOR (LÓGICA PDV HORIZONTAL) */}
              {/* ============================================================== */}
              <div className="bg-slate-50 dark:bg-stone-800/60 p-2.5 rounded-xl border border-slate-300 dark:border-stone-700 shadow-2xs shrink-0">
                <div className="grid grid-cols-12 gap-2 items-end">
                  
                  {/* Input [ QTDE * ] */}
                  <div className="col-span-3 sm:col-span-1">
                    <label className="block text-[10px] sm:text-[11px] font-black uppercase text-slate-600 dark:text-stone-400 tracking-wider mb-1 text-center">
                      QTDE *
                    </label>
                    <input
                      ref={osPartQtyInputRef}
                      type="text"
                      inputMode="decimal"
                      value={osPartInputQtde}
                      onChange={(e) => setOsPartInputQtde(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleInsertOsPart();
                        }
                      }}
                      className="w-full text-center px-1.5 py-1.5 rounded-xl border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-black text-slate-900 dark:text-white shadow-2xs focus:ring-2 focus:ring-sky-500 outline-none transition"
                      placeholder="1"
                    />
                  </div>

                  {/* Input [ 🔍 PESQUISAR PRODUTO / PEÇA / SERVIÇO ] */}
                  <div ref={osPartSearchContainerRef} className="col-span-9 sm:col-span-6 relative">
                    <label className="block text-[10px] sm:text-[11px] font-black uppercase text-slate-600 dark:text-stone-400 tracking-wider mb-1 flex items-center justify-between">
                      <span className="flex items-center space-x-1.5">
                        <Search className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                        <span>PESQUISAR PRODUTO / PEÇA / SERVIÇO</span>
                      </span>
                    </label>

                    <div className="relative">
                      <input
                        ref={osPartSearchInputRef}
                        type="text"
                        value={osPartSearchQuery}
                        onFocus={() => {
                          if (osPartSearchQuery.trim().length > 0 || osPartSearchResults.length > 0) {
                            setIsOsPartDropdownOpen(true);
                          }
                        }}
                        onClick={() => {
                          if (osPartSearchResults.length > 0) {
                            setIsOsPartDropdownOpen(true);
                          }
                        }}
                        onChange={(e) => {
                          const val = e.target.value;
                          setOsPartSearchQuery(val);
                          setOsPartSelectedProduct(null);
                          setIsOsPartDropdownOpen(true);
                          setOsPartHighlightedIndex(0);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            setIsOsPartDropdownOpen(true);
                            setOsPartHighlightedIndex((prev) => Math.min(osPartSearchResults.length - 1, prev + 1));
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            setOsPartHighlightedIndex((prev) => Math.max(0, prev - 1));
                          } else if (e.key === 'Enter') {
                            e.preventDefault();
                            setIsOsPartDropdownOpen(false);
                            if (isOsPartDropdownOpen && osPartSearchResults.length > 0 && osPartHighlightedIndex >= 0 && osPartSearchResults[osPartHighlightedIndex]) {
                              handleSelectOsPartSuggestion(osPartSearchResults[osPartHighlightedIndex]);
                            } else {
                              handleInsertOsPart();
                            }
                          } else if (e.key === 'Escape') {
                            setIsOsPartDropdownOpen(false);
                          }
                        }}
                        placeholder="DIGITE O NOME, CÓDIGO OU CÓDIGO DE BARRAS..."
                        className="w-full pl-3 pr-9 py-1.5 rounded-xl border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-bold text-slate-900 dark:text-white uppercase shadow-2xs focus:ring-2 focus:ring-sky-500 outline-none transition placeholder:normal-case placeholder:font-medium placeholder:text-slate-400"
                      />
                      <Barcode className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>

                    {/* Dropdown 100% Oculto por padrão, abrindo só ao focar/digitar */}
                    {isOsPartDropdownOpen && osPartSearchResults.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-xl shadow-2xl max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-stone-800 scrollbar-none">
                        {osPartSearchResults.map((prod, idx) => {
                          const displayName = String(prod.nome_comercial || prod.name || '').toUpperCase();
                          const internalCode = prod.code || (prod as any).codigo || prod.id.slice(0, 6).toUpperCase();
                          const catName = String(prod.categoria || prod.category || prod.tipo_item || 'ESTOQUE').toUpperCase();
                          const salePrice = Number(prod.salePrice ?? prod.preco_venda_varejo ?? getPriceForProductByRule(prod, defaultPriceType) ?? prod.unitCost ?? 0);
                          const isHighlighted = idx === osPartHighlightedIndex;

                          return (
                            <button
                              key={prod.id}
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleSelectOsPartSuggestion(prod);
                              }}
                              className={`w-full px-3 py-2 text-left transition flex items-center justify-between gap-2.5 cursor-pointer ${
                                isHighlighted
                                  ? 'bg-sky-100 dark:bg-sky-950/60'
                                  : 'hover:bg-sky-50/80 dark:hover:bg-sky-950/30'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center space-x-2">
                                  <span className="font-bold text-xs text-slate-900 dark:text-stone-100 truncate">
                                    {displayName}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500 dark:text-stone-400 mt-0.5">
                                  <span className="font-mono font-bold text-slate-700 dark:text-stone-300 bg-slate-100 dark:bg-stone-800 px-1.5 py-0.2 rounded">
                                    CÓD: {internalCode}
                                  </span>
                                  <span className="inline-flex items-center space-x-1 px-1.5 py-0.2 rounded bg-slate-100 dark:bg-stone-800 font-semibold text-slate-600 dark:text-stone-300 uppercase text-[9px]">
                                    <Tag className="w-2.5 h-2.5 text-slate-400" />
                                    <span>{catName}</span>
                                  </span>
                                  {prod.quantity !== undefined && (
                                    <span className="text-[10px] text-slate-500 font-mono">
                                      Saldo: {prod.quantity} {prod.unit || 'un'}
                                    </span>
                                  )}
                                  {salePrice > 0 && (
                                    <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                      {formatCurrencyBRL(salePrice)}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 shrink-0 uppercase bg-sky-50 dark:bg-sky-950/50 px-2 py-1 rounded-md border border-sky-200 dark:border-sky-800">
                                Selecionar
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Input [ PREÇO UNITÁRIO (R$) ] */}
                  <div className="col-span-6 sm:col-span-2">
                    <label className="block text-[10px] sm:text-[11px] font-black uppercase text-slate-600 dark:text-stone-400 tracking-wider mb-1">
                      PREÇO UNITÁRIO (R$)
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-2.5 text-[11px] font-mono font-bold text-slate-400 pointer-events-none select-none">
                        R$
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={osPartInputUnitCost}
                        onChange={(e) => setOsPartInputUnitCost(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleInsertOsPart();
                          }
                        }}
                        placeholder="0,00"
                        className="w-full pl-8 pr-2.5 py-1.5 rounded-xl border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-mono font-bold text-slate-900 dark:text-white shadow-2xs focus:ring-2 focus:ring-sky-500 outline-none transition text-right"
                      />
                    </div>
                  </div>

                  {/* Botão [ + ADICIONAR ITEM (ENTER) ] */}
                  <div className="col-span-6 sm:col-span-3">
                    <button
                      type="button"
                      onClick={() => {
                        setIsOsPartDropdownOpen(false);
                        handleInsertOsPart();
                      }}
                      className="w-full h-[33px] inline-flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-bold text-white uppercase rounded-xl bg-gradient-to-b from-sky-500 via-sky-600 to-sky-700 hover:from-sky-400 hover:to-sky-600 border border-sky-400/80 shadow-[inset_0_1px_0px_rgba(255,255,255,0.3),0_1px_2px_rgba(0,0,0,0.15)] transition cursor-pointer active:scale-95 shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>+ ADICIONAR ITEM (ENTER)</span>
                    </button>
                  </div>

                </div>
              </div>

              {/* ============================================================== */}
              {/* 2. GRADE CENTRAL DE ITENS LANÇADOS NA OS (SLIM BLUE/WHITE)      */}
              {/* ============================================================== */}
              {partsItems.length === 0 ? (
                <div className="p-10 text-center border-2 border-dashed border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-900 rounded-xl space-y-2.5">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-stone-800 text-slate-400 flex items-center justify-center mx-auto shadow-2xs">
                    <Package className="w-5 h-5 text-slate-500 dark:text-stone-400" />
                  </div>
                  <p className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-stone-300">
                    NENHUM PRODUTO OU SERVIÇO LANÇADO NESTA ORDEM DE SERVIÇO. BUSQUE E INSIRA OS ITENS ACIMA.
                  </p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col border border-slate-300 dark:border-stone-700 rounded-xl overflow-hidden bg-white dark:bg-stone-900 shadow-2xs min-h-[300px] max-h-[440px]">
                  <div className="flex-1 overflow-x-auto overflow-y-auto scrollbar-none">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 dark:bg-stone-800/90 border-b border-slate-300 dark:border-stone-700 text-slate-700 dark:text-stone-300 uppercase text-[10px] font-bold tracking-wider sticky top-0 z-10">
                        <tr>
                          <th className="py-2.5 px-3 w-[12%] whitespace-nowrap">CÓDIGO/ID</th>
                          <th className="py-2.5 px-3 w-[36%]">DESCRIÇÃO DO PRODUTO/PEÇA</th>
                          <th className="py-2.5 px-3 w-[16%] whitespace-nowrap">CATEGORIA</th>
                          <th className="py-2.5 px-3 text-center w-[10%] whitespace-nowrap">QTDE</th>
                          <th className="py-2.5 px-3 text-right w-[12%] whitespace-nowrap">VALOR UNITÁRIO (R$)</th>
                          <th className="py-2.5 px-3 text-right w-[10%] whitespace-nowrap">VALOR TOTAL (R$)</th>
                          <th className="py-2.5 px-2 text-center w-[4%] whitespace-nowrap">AÇÃO</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/70 dark:divide-stone-800">
                        {partsItems.map((item, index) => {
                          const displayCode = resolvePartDisplayCode(item, index);
                          const categoryName = resolvePartCategory(item);

                          return (
                            <tr
                              key={item.id || index}
                              className="hover:bg-sky-50/40 dark:hover:bg-stone-800/40 transition"
                            >
                              {/* [CÓDIGO/ID] */}
                              <td className="py-2 px-3 align-middle whitespace-nowrap">
                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 dark:bg-stone-800 text-slate-800 dark:text-stone-200 font-mono text-[11px] font-bold border border-slate-200 dark:border-stone-700">
                                  {displayCode}
                                </span>
                              </td>

                              {/* [DESCRIÇÃO DO PRODUTO/PEÇA] */}
                              <td className="py-2 px-3 align-middle">
                                <div className="font-bold text-slate-900 dark:text-stone-100 text-xs leading-snug break-words">
                                  {item.description.toUpperCase()}
                                </div>
                                {item.unit && (
                                  <span className="text-[10px] text-slate-500 dark:text-stone-400 font-mono uppercase">
                                    ({item.unit})
                                  </span>
                                )}
                              </td>

                              {/* [CATEGORIA] */}
                              <td className="py-2 px-3 align-middle whitespace-nowrap">
                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-sky-50 dark:bg-sky-950/50 text-sky-800 dark:text-sky-300 font-bold text-[10px] border border-sky-200 dark:border-sky-800 uppercase tracking-wide">
                                  <Tag className="w-2.5 h-2.5 mr-1 text-sky-600 dark:text-sky-400" />
                                  {categoryName}
                                </span>
                              </td>

                              {/* [QTDE] */}
                              <td className="py-2 px-3 align-middle text-center whitespace-nowrap">
                                <div className="flex items-center justify-center space-x-1">
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={item.quantity === 0 ? '' : item.quantity}
                                    onChange={(e) => {
                                      const parsed = parseCleanPriceNumber(e.target.value);
                                      handleUpdatePartItem(index, { quantity: parsed });
                                    }}
                                    placeholder="1"
                                    className="w-14 px-1.5 py-1 text-xs font-mono font-bold text-center rounded-lg border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-sky-500 shadow-2xs"
                                  />
                                </div>
                              </td>

                              {/* [VALOR UNITÁRIO (R$)] */}
                              <td className="py-2 px-3 align-middle text-right whitespace-nowrap">
                                <div className="relative inline-flex items-center justify-end">
                                  <span className="text-[10px] text-slate-400 mr-1 font-mono select-none">R$</span>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={
                                      unitCostRawInputs[item.id] !== undefined
                                        ? unitCostRawInputs[item.id]
                                        : (item.unitCost === 0 ? '' : item.unitCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
                                    }
                                    onChange={(e) => {
                                      const raw = e.target.value;
                                      setUnitCostRawInputs(prev => ({ ...prev, [item.id]: raw }));
                                      const parsed = parseCleanPriceNumber(raw);
                                      handleUpdatePartItem(index, { unitCost: parsed });
                                    }}
                                    onBlur={() => {
                                      setUnitCostRawInputs(prev => {
                                        const copy = { ...prev };
                                        delete copy[item.id];
                                        return copy;
                                      });
                                    }}
                                    placeholder="0,00"
                                    className="w-24 text-right px-2 py-1 text-xs font-mono font-bold rounded-lg border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-sky-500 shadow-2xs"
                                  />
                                </div>
                              </td>

                              {/* [VALOR TOTAL (R$)] */}
                              <td className="py-2 px-3 align-middle text-right whitespace-nowrap font-mono">
                                <span className="text-xs font-black text-slate-900 dark:text-stone-100">
                                  {formatCurrencyBRL(item.totalCost || (item.quantity * item.unitCost))}
                                </span>
                              </td>

                              {/* [AÇÃO] */}
                              <td className="py-2 px-2 align-middle text-center whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => handleRemovePartItem(index)}
                                  className="p-1.5 rounded-lg text-rose-600 hover:text-rose-700 dark:text-rose-400 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 border border-rose-300/80 transition cursor-pointer active:scale-95 inline-flex items-center justify-center shadow-2xs"
                                  title="Remover peça da OS"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              </div>

              {/* FAIXA HORIZONTAL COMPACTA DE RESUMO (Mão de Obra Avulsa, Resumo de Custos e Baixa no Estoque) */}
              <div className="mt-auto shrink-0 bg-white border border-zinc-300 rounded-xl px-3.5 py-2.5 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                  {/* 1. Mão de Obra Avulsa / Terceira */}
                  <div className="flex items-center space-x-2">
                    <label className="text-[11px] font-bold text-zinc-700 whitespace-nowrap">
                      Mão de Obra Avulsa:
                    </label>
                    <div className="inline-flex items-center bg-zinc-50 border border-zinc-300 rounded-md px-2 py-0.5 shadow-2xs focus-within:ring-2 focus-within:ring-zinc-700/20 focus-within:border-zinc-700">
                      <span className="text-[11px] text-zinc-400 font-mono font-medium mr-1 select-none">R$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={laborCost}
                        onChange={(e) => setLaborCost(e.target.value)}
                        placeholder="0,00"
                        className="w-20 py-0.5 text-xs font-mono font-bold text-right bg-transparent text-zinc-900 focus:outline-none"
                        title="Custo adicional avulso de mão de obra (além da interna da Aba 1)"
                      />
                    </div>
                    {laborItems.length > 0 && (
                      <span className="text-[10px] text-zinc-800 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-300 font-medium whitespace-nowrap">
                        + R$ {totalInternalLaborCalculated.toFixed(2)} interna
                      </span>
                    )}
                  </div>

                  {/* 2. Discriminação dos Subtotais */}
                  <div className="hidden lg:flex items-center space-x-3 text-[11px] text-zinc-600 border-l border-r border-zinc-200 px-3">
                    <div>
                      <span>Peças Novas / Estoque: </span>
                      <strong className="font-mono text-zinc-900">
                        {formatCurrencyBRL(
                          partsItems
                            .filter(p => p.origin !== 'recuperada_externa')
                            .reduce((acc, p) => acc + (p.totalCost || 0), 0)
                        )}
                      </strong>
                    </div>
                    {totalRecoveredExternalCost > 0 && (
                      <div>
                        <span className="text-zinc-600">Recuperação / Torno: </span>
                        <strong className="font-mono text-zinc-900">
                          {formatCurrencyBRL(totalRecoveredExternalCost)}
                        </strong>
                      </div>
                    )}
                  </div>

                  {/* Custo Total Consolidado da OS */}
                  <div className="flex items-center space-x-2 ml-auto">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 whitespace-nowrap">
                      Custo Consolidado:
                    </span>
                    <span className="text-base font-black text-zinc-900 font-['Outfit'] font-mono">
                      {formatCurrencyBRL(grandTotal)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* ABA 3: FISCAL (NF-E), COMPRAS & FINANCEIRO (CONTAS A PAGAR) */}
          {/* ======================================================== */}
          {activeTab === 'fiscal_financeiro' && (
            <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-150">
              
              {/* RESUMO CONSOLIDADO DA ORDEM DE SERVIÇO PARA FATURAMENTO */}
              <div className="p-4 bg-zinc-900 text-white rounded-2xl border border-zinc-800 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
                  <div className="flex items-center space-x-2.5">
                    <Receipt className="w-5 h-5 text-zinc-300" />
                    <div>
                      <h3 className="text-sm font-black text-white tracking-wide">
                        Consolidado da Ordem de Serviço ({osNumber || 'Sem Número'})
                      </h3>
                      <p className="text-[11px] text-zinc-400 font-medium">
                        Valores consolidados de peças, insumos e mão de obra prontos para faturamento
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] text-zinc-400 font-bold">Status:</span>
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                      status === 'concluida'
                        ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/70'
                        : 'bg-zinc-800 text-zinc-200 border border-zinc-700'
                    }`}>
                      {status === 'concluida' ? 'OS Concluída' : 'OS Em Andamento'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
                  <div className="p-3 bg-zinc-800/80 rounded-xl border border-zinc-700 shadow-2xs">
                    <span className="block text-[11px] text-zinc-400 font-semibold">Peças & Insumos ({partsItems.length} itens)</span>
                    <span className="text-sm sm:text-base font-black text-white font-mono">
                      {formatCurrencyBRL(totalPartsCalculated)}
                    </span>
                  </div>

                  <div className="p-3 bg-zinc-800/80 rounded-xl border border-zinc-700 shadow-2xs">
                    <span className="block text-[11px] text-zinc-400 font-semibold">Mão de Obra ({laborItems.length} mecânicos)</span>
                    <span className="text-sm sm:text-base font-black text-white font-mono">
                      {formatCurrencyBRL(totalLaborCalculated)}
                    </span>
                  </div>

                  <div className="p-3 bg-zinc-950 text-white rounded-xl border border-zinc-700 shadow-xs">
                    <span className="block text-[11px] text-zinc-300 font-semibold">Total a Faturar na OS</span>
                    <span className="text-base sm:text-lg font-black text-emerald-400 font-mono">
                      {formatCurrencyBRL(grandTotal)}
                    </span>
                  </div>
                </div>
              </div>

              {/* FLUXO B: VÍNCULO DE NF-E */}
              <div className="p-4 bg-white rounded-2xl border border-zinc-300 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-zinc-700" />
                    <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                      Integração Fiscal: Vincular Nota Fiscal (NF-e)
                    </h4>
                  </div>

                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasNfe}
                      onChange={(e) => setHasNfe(e.target.checked)}
                      className="w-4 h-4 text-zinc-900 rounded focus:ring-zinc-700"
                    />
                    <span className="text-xs font-bold text-zinc-800">
                      Possui NF-e Vinculada
                    </span>
                  </label>
                </div>

                {hasNfe && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div>
                      <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                        Número da NF-e
                      </label>
                      <input
                        type="text"
                        value={nfeNumber}
                        onChange={(e) => setNfeNumber(e.target.value)}
                        placeholder="Ex: 000.045.892"
                        className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-xl text-xs font-mono font-bold text-zinc-900 focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                        Série
                      </label>
                      <input
                        type="text"
                        value={nfeSeries}
                        onChange={(e) => setNfeSeries(e.target.value)}
                        placeholder="Ex: 1"
                        className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-xl text-xs text-zinc-900 focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                        Data de Emissão da Nota
                      </label>
                      <input
                        type="date"
                        value={nfeIssueDate}
                        onChange={(e) => setNfeIssueDate(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-xl text-xs text-zinc-900 focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700 cursor-pointer"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                        Chave de Acesso (44 dígitos)
                      </label>
                      <input
                        type="text"
                        maxLength={44}
                        value={nfeAccessKey}
                        onChange={(e) => setNfeAccessKey(e.target.value)}
                        placeholder="41260800000000000000550010000458921000458920"
                        className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-xl text-xs font-mono text-zinc-900 focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                        Fornecedor / Razão Social
                      </label>
                      <input
                        type="text"
                        value={nfeSupplierName}
                        onChange={(e) => setNfeSupplierName(e.target.value)}
                        placeholder="Ex: TratorPeças do Iguaçu Ltda"
                        className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-xl text-xs text-zinc-900 focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* INTEGRAÇÃO FINANCEIRA: CONTAS A PAGAR */}
              <div className="p-4 bg-white rounded-2xl border border-zinc-300 space-y-4 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CreditCard className="w-4 h-4 text-zinc-700" />
                    <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                      Integração Financeira: Gerar Lançamento no Contas a Pagar
                    </h4>
                  </div>

                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createExpense}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setCreateExpense(checked);
                        if (checked) {
                          setSkipAccountsPayableDreOnly(false);
                        }
                      }}
                      className="w-4 h-4 text-zinc-900 rounded focus:ring-zinc-700 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-zinc-800">
                      Lançar no Financeiro
                    </span>
                  </label>
                </div>

                {createExpense && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    {/* 1º Lugar: Forma de Pagamento */}
                    <div>
                      <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                        Forma de Pagamento
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as any)}
                        className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-xl text-xs font-bold text-zinc-900 cursor-pointer focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700"
                      >
                        <option value="boleto">Boleto Bancário</option>
                        <option value="pix">PIX / Transferência</option>
                        <option value="cartao_credito">Cartão de Crédito</option>
                        <option value="dinheiro">Dinheiro em Espécie</option>
                        <option value="safra_prazo">Cheque / Safra</option>
                      </select>
                    </div>

                    {/* 2º Lugar: 1º Vencimento */}
                    <div>
                      <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                        1º Vencimento
                      </label>
                      <input
                        type="date"
                        value={firstDueDate}
                        onChange={(e) => setFirstDueDate(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-xl text-xs text-zinc-900 font-semibold focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700 cursor-pointer"
                      />
                    </div>

                    {/* 3º Lugar: Condição / Prazo de Pagamento: Card Indicador e Botão Detalhamento de Parcelas */}
                    <div>
                      <label className="block text-[11px] font-bold text-zinc-700 mb-1 flex items-center justify-between">
                        <span>Condição / Prazo de Pagamento</span>
                        <span className="text-[10px] font-extrabold text-zinc-900">
                          {installments.length > 1 ? `${installments.length}x Parcelas` : (installments.length === 1 ? '1x Parcela' : 'À Vista')}
                        </span>
                      </label>
                      <div className="flex items-center justify-between gap-2 p-1.5 bg-zinc-50 border border-zinc-300 rounded-xl min-h-[38px] shadow-2xs">
                        <div className="min-w-0 flex-1 px-1.5">
                          <p className="text-xs font-bold text-zinc-900 truncate">
                            {installments.length > 0 
                              ? `${installments.length}x de ${formatCurrencyBRL(installments[0]?.amount || (grandTotal / installments.length))}`
                              : `1x de ${formatCurrencyBRL(grandTotal)}`}
                          </p>
                          <p className="text-[10px] text-zinc-500 truncate">
                            {installments.length > 1 
                              ? installments.map(i => `${i.daysInterval || 0}d`).join(' / ')
                              : (firstDueDate ? `Venc: ${firstDueDate.split('-').reverse().join('/')}` : 'À vista')}
                          </p>
                        </div>
                        <button
                          type="button"
                          id="btn-detalhamento-parcelas-os"
                          onClick={() => {
                            if (grandTotal <= 0) {
                              setFeedbackBanner({
                                type: 'save',
                                message: 'Adicione itens de peças ou mão de obra para calcular o Total da OS antes de detalhar parcelas.'
                              });
                              setTimeout(() => setFeedbackBanner(null), 3500);
                              return;
                            }
                            setIsInstallmentsModalOpen(true);
                          }}
                          className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs shrink-0"
                          title="Abrir Janela de Detalhamento de Parcelas da OS"
                        >
                          <Layers className="w-3.5 h-3.5" />
                          <span>Detalhamento de Parcelas</span>
                        </button>
                      </div>
                    </div>

                    {/* Fornecedor para o Financeiro */}
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                        Credor / Fornecedor do Pagamento
                      </label>
                      <input
                        type="text"
                        value={financialSupplier || workshopOrMechanic}
                        onChange={(e) => setFinancialSupplier(e.target.value)}
                        placeholder="Nome da Oficina ou Fornecedor de Peças"
                        className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-xl text-xs font-semibold text-zinc-900 focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700"
                      />
                    </div>

                    {/* Botão e Ação Direta de Faturamento no Contas a Pagar */}
                    <div className="sm:col-span-3 pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200">
                      <div>
                        {expenseGenerated ? (
                          <div className="inline-flex items-center space-x-2 text-emerald-800 font-bold text-xs bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-300">
                            <CheckCheck className="w-4 h-4 text-emerald-600" />
                            <span>Lançamento Confirmado no Contas a Pagar</span>
                          </div>
                        ) : (
                          <p className="text-xs text-zinc-600">
                            Pronto para gerar despesa no valor de <strong className="text-zinc-900">{formatCurrencyBRL(grandTotal)}</strong>
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        id="btn-confirmar-faturamento-contas-pagar"
                        onClick={() => {
                          setCreateExpense(true);
                          executeSave({ triggerExpense: true, markAsCompleted: true, closeOnSave: true });
                        }}
                        className="inline-flex items-center space-x-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
                      >
                        <CreditCard className="w-4 h-4" />
                        <span>Confirmar Faturamento & Concluir OS</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* REGRA FISCAL / FINANCEIRA: NÃO GERAR CONTAS A PAGAR (ABATIMENTO DIRETO DE ESTOQUE / LANÇAMENTO DRE) */}
              <div className="p-4 bg-rose-50/80 dark:bg-rose-950/30 rounded-2xl border border-rose-300 dark:border-rose-900/60 space-y-3 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-2">
                    <Receipt className="w-4 h-4 text-rose-700 dark:text-rose-400" />
                    <h4 className="text-xs font-bold text-rose-950 dark:text-rose-200 uppercase tracking-wider">
                      Compensação Contábil Direta / DRE (Sem Contas a Pagar)
                    </h4>
                  </div>

                  <label className="flex items-center space-x-2 cursor-pointer bg-white/90 dark:bg-stone-900 px-3 py-1.5 rounded-xl border border-rose-300 dark:border-rose-800 shadow-2xs">
                    <input
                      type="checkbox"
                      id="chk-nao-gerar-contas-pagar"
                      checked={skipAccountsPayableDreOnly}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setSkipAccountsPayableDreOnly(checked);
                        if (checked) {
                          setCreateExpense(false);
                        }
                      }}
                      className="w-4 h-4 text-rose-600 rounded focus:ring-rose-500 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-rose-950 dark:text-rose-100">
                      Não gerar Contas a Pagar (Abatimento Direto de Estoque / Lançamento DRE)
                    </span>
                  </label>
                </div>

                <p className="text-[11.5px] text-rose-900/90 dark:text-rose-200/90 font-medium leading-relaxed">
                  Marque esta opção se as peças desta OS já foram pagas/lançadas via Nota Fiscal de Entrada. O sistema irá registrar o custo do insumo diretamente no DRE da empresa e no histórico do veículo, sem gerar duplicidade financeira no Contas a Pagar.
                </p>

                {skipAccountsPayableDreOnly && (
                  <div className="p-3 bg-white dark:bg-stone-900 rounded-xl border border-rose-300 dark:border-rose-800 space-y-2 mt-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center space-x-2 text-rose-800 dark:text-rose-300 text-xs font-bold">
                        <CheckCircle2 className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                        <span>Abatimento Direto de Estoque & Lançamento DRE Ativo</span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-rose-100 text-rose-900 border border-rose-300">
                        Total OS: {formatCurrencyBRL(grandTotal)}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-600 dark:text-stone-300 leading-snug">
                      Ao concluir esta OS, o custo total de <strong>{formatCurrencyBRL(grandTotal)}</strong> será registrado na categoria <strong>"Manutenção de Frotas"</strong> no DRE gerencial da empresa e somado ao custo operacional acumulado do veículo <strong>{currentMachName}</strong>, efetuando a baixa real e definitiva dos insumos no almoxarifado (<code className="text-[10px] font-mono bg-zinc-100 px-1 py-0.5 rounded">public.estoque_produtos</code>) sem gerar duplicidade financeira no Contas a Pagar.
                    </p>
                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        id="btn-concluir-os-dre-aba3"
                        onClick={() => {
                          executeSave({ markAsCompleted: true, triggerExpense: false, closeOnSave: true });
                        }}
                        className="inline-flex items-center space-x-2 px-5 py-2.5 bg-rose-700 hover:bg-rose-600 text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
                      >
                        <CheckCheck className="w-4 h-4" />
                        <span>Concluir OS (Liberada) com Lançamento DRE</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* FLUXO A: SOLICITAÇÃO DE COMPRA / COTAÇÃO */}
              <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-300 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ShoppingCart className="w-4 h-4 text-zinc-700" />
                    <div>
                      <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                        Fluxo de Compras: Gerar Solicitação de Cotação
                      </h4>
                      <p className="text-[11px] text-zinc-600">
                        Gera pedido no setor de compras para cotar e encomendar as peças externas.
                      </p>
                    </div>
                  </div>

                  <input
                    type="checkbox"
                    checked={generatePurchaseRequest}
                    onChange={(e) => setGeneratePurchaseRequest(e.target.checked)}
                    className="w-4 h-4 text-zinc-900 rounded focus:ring-zinc-700"
                  />
                </div>

                {generatePurchaseRequest && (
                  <div className="pt-2">
                    <label className="block text-[11px] font-bold text-zinc-800 mb-1">
                      Nível de Urgência da Cotação / Compra
                    </label>
                    <select
                      value={purchaseUrgency}
                      onChange={(e) => setPurchaseUrgency(e.target.value as any)}
                      className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-xl text-xs font-bold text-zinc-900 cursor-pointer focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700"
                    >
                      <option value="urgente_veiculo_parado">🚨 Urgente - Veículo Parado na Roça/Estrada</option>
                      <option value="alta">⚡ Alta - Necessário para a Frente de Colheita</option>
                      <option value="media">⚖ Média - Preventiva Programada</option>
                      <option value="baixa">☕ Baixa - Reposição de Almoxarifado</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Observações Internas */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Observações Gerais / Histórico
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Peça substituída com garantia de 90 dias da concessionária..."
                  rows={2}
                  className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-xl text-xs sm:text-sm text-zinc-900 focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700"
                />
              </div>
            </div>
          )}
          </div>

          {/* Rodapé Fixo da OS */}
          <div className="shrink-0 bg-zinc-800 border-t border-zinc-700 px-5 py-3 text-white flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg z-20">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Total Geral da OS:
                </span>
                <span className="text-lg sm:text-xl font-black text-white font-['Outfit'] font-mono tracking-tight">
                  {formatCurrencyBRL(grandTotal)}
                </span>
              </div>

              {/* Sub-totais discriminados */}
              <div className="hidden md:flex items-center space-x-2 text-[11px] text-zinc-300 bg-zinc-900/80 px-2.5 py-1 rounded-lg border border-zinc-700 shadow-2xs">
                <span>Peças: <strong className="text-white font-mono">{formatCurrencyBRL(totalPartsCalculated)}</strong></span>
                <span>•</span>
                <span>M. Obra: <strong className="text-white font-mono">{formatCurrencyBRL(totalLaborCalculated)}</strong></span>
              </div>

              {saveSuccess && (
                <span className="inline-flex items-center space-x-1.5 px-3 py-1 bg-emerald-950/80 border border-emerald-700 text-emerald-300 rounded-lg text-xs font-bold animate-in fade-in duration-150">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>OS Salva com Sucesso!</span>
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                type="button"
                id="btn-cancelar-os"
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl border border-zinc-600 bg-zinc-700/60 hover:bg-zinc-700 text-zinc-200 hover:text-white text-xs font-bold transition cursor-pointer shadow-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="btn-sair-fechar-os"
                onClick={onClose}
                className="inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-xl border border-zinc-600 bg-zinc-700/60 hover:bg-zinc-700 text-zinc-200 hover:text-white text-xs font-bold transition cursor-pointer shadow-xs"
                title="Fechar formulário de Ordem de Serviço"
              >
                <X className="w-3.5 h-3.5 text-zinc-300" />
                <span>Sair / Fechar</span>
              </button>

              {/* 1. Botão Verde: Salva estado atual sem fechar e sem enviar ao Contas a Pagar (ou Conclui na Aba 3) */}
              <button
                type="button"
                id="btn-salvar-os"
                onClick={() => {
                  if (activeTab === 'fiscal_financeiro') {
                    executeSave({
                      markAsCompleted: true,
                      triggerExpense: !skipAccountsPayableDreOnly && createExpense,
                      closeOnSave: true
                    });
                  } else {
                    executeSave({ triggerExpense: false });
                  }
                }}
                className="inline-flex items-center justify-center space-x-2 px-5 py-2 text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95 cursor-pointer bg-emerald-600 hover:bg-emerald-500 border border-emerald-500"
                title={activeTab === 'fiscal_financeiro' ? 'Concluir a Ordem de Serviço, liberar o veículo e fechar o formulário' : 'Salva o estado atual das peças, quantidades e mão de obra mantendo os itens na tela sem gerar despesa financeira'}
              >
                {saveSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-white animate-pulse" />
                    <span>Salva com Sucesso!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Salvar Ordem de Serviço</span>
                  </>
                )}
              </button>

              {/* 2. Botão de Destaque: Navegação contextual entre abas mantendo o mesmo estilo visual */}
              {activeTab === 'geral' ? (
                <button
                  type="button"
                  id="btn-incluir-pecas-os"
                  onClick={() => {
                    setActiveTab('pecas');
                  }}
                  className="inline-flex items-center justify-center space-x-2 px-5 py-2 text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95 cursor-pointer bg-zinc-900 hover:bg-zinc-950 border border-zinc-700"
                  title="Avançar para a aba 2. Peças & Estoque"
                >
                  <span>Incluir peças</span>
                  <ArrowRight className="w-3.5 h-3.5 text-white" />
                </button>
              ) : activeTab === 'pecas' ? (
                <button
                  type="button"
                  id="btn-fechar-e-faturar-os"
                  onClick={() => {
                    setActiveTab('fiscal_financeiro');
                  }}
                  className="inline-flex items-center justify-center space-x-2 px-5 py-2 text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95 cursor-pointer bg-zinc-900 hover:bg-zinc-950 border border-zinc-700"
                  title="Avançar para a Aba 3 (Fiscal, Financeiro e Fechamento)"
                >
                  <Receipt className="w-4 h-4 text-white" />
                  <span>Avançar para Fechamento</span>
                  <ArrowRight className="w-3.5 h-3.5 text-white" />
                </button>
              ) : (
                <button
                  type="button"
                  id="btn-concluir-liberar-os"
                  onClick={() => {
                    executeSave({
                      markAsCompleted: true,
                      triggerExpense: !skipAccountsPayableDreOnly && createExpense,
                      closeOnSave: true
                    });
                  }}
                  className={`inline-flex items-center justify-center space-x-2 px-5 py-2 text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95 cursor-pointer border ${
                    skipAccountsPayableDreOnly
                      ? 'bg-rose-700 hover:bg-rose-600 border-rose-600'
                      : 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500'
                  }`}
                  title="Conclui a manutenção, altera o status para Concluída (Liberada), efetua a baixa real no estoque e fecha a janela com sucesso"
                >
                  <CheckCheck className="w-4 h-4 text-white" />
                  <span>Concluir OS (Liberada)</span>
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* Modal de Gerenciamento de Categorias de Serviço */}
      <MaintenanceCategoriesModal
        isOpen={isCategoriesModalOpen}
        onClose={() => setIsCategoriesModalOpen(false)}
        categories={categoriesList}
        onSaveCategories={handleSaveCategories}
        onSelectCategory={(catName) => {
          setServiceCategory(catName);
        }}
      />

      {/* Modal de Busca Avançada de Produtos / Peças no Estoque (F4 / Enter) */}
      <ProductSearchModal
        isOpen={isProductSearchOpen}
        onClose={() => {
          setIsProductSearchOpen(false);
          setActiveSearchRowIndex(null);
        }}
        inventory={allInventoryList}
        initialQuery={activeSearchInitialQuery}
        onSelectProduct={handleSelectProductFromModal}
      />

      {/* Janela Modal de Detalhamento de Parcelas da OS */}
      <NfeInstallmentsModal
        isOpen={isInstallmentsModalOpen}
        onClose={() => setIsInstallmentsModalOpen(false)}
        invoiceNumber={osNumber || 'OS'}
        supplierName={financialSupplier.trim() || workshopOrMechanic.trim() || 'Oficina Mecânica'}
        issueDate={date || new Date().toISOString().split('T')[0]}
        totalAmount={grandTotal}
        initialInstallmentsCount={installments.length > 0 ? installments.length : 1}
        initialDetailedInstallments={installments.length > 0 ? installments : undefined}
        defaultPaymentMethod={paymentMethod}
        suggestedCategory="cat_manutencao"
        customTitle="Detalhamento de Parcelas da OS"
        customSubtitle={`OS Nº ${osNumber || 'Sem número'} • Fornecedor / Oficina: ${financialSupplier.trim() || workshopOrMechanic.trim() || 'Oficina Mecânica'}`}
        totalLabel="Total a Faturar na OS"
        onConfirmAndSave={(detailedInstallments) => {
          setInstallments(detailedInstallments);
          if (detailedInstallments.length > 0 && detailedInstallments[0].dueDate) {
            setFirstDueDate(detailedInstallments[0].dueDate);
          }
          if (detailedInstallments.length > 1) {
            setPaymentTerm('personalizado');
          } else {
            setPaymentTerm('a_vista');
          }
          setIsInstallmentsModalOpen(false);
          setFeedbackBanner({
            type: 'billed',
            message: `${detailedInstallments.length} parcela(s) configurada(s) com sucesso na OS.`
          });
          setTimeout(() => setFeedbackBanner(null), 3000);
        }}
      />
    </div>
  );
};
