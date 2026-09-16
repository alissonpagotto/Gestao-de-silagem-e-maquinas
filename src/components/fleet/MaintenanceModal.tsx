import React, { useState, useEffect, useMemo } from 'react';
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
    }
  ) => void;
  editingLog: MaintenanceLog | null;
  machineries: Machinery[];
  inventory?: InventoryItem[];
  suppliers?: Supplier[];
  employees?: Employee[];
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
              (inv.name && item.description && inv.name.trim().toLowerCase() === item.description.trim().toLowerCase()) ||
              (inv.code && item.description && inv.code.trim().toLowerCase() === item.description.trim().toLowerCase())
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
      if (editingLog.financialConditions) {
        setCreateExpense(editingLog.financialConditions.createAccountsPayable);
        setPaymentTerm(editingLog.financialConditions.paymentTerm);
        setPaymentMethod(editingLog.financialConditions.paymentMethod);
        setFirstDueDate(editingLog.financialConditions.firstDueDate);
        setFinancialSupplier(editingLog.financialConditions.supplierName || '');
        setExpenseGenerated(!!editingLog.financialConditions.createAccountsPayable);
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
            (inv.code && itemToRemove.description && inv.code.trim().toLowerCase() === itemToRemove.description.trim().toLowerCase()) ||
            (inv.name && itemToRemove.description && inv.name.trim().toLowerCase() === itemToRemove.description.trim().toLowerCase())
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

  // Itens por categoria
  const externalPartsCount = partsItems.filter(p => p.origin === 'externo_compra').length;
  const internalPartsCount = partsItems.filter(p => p.origin === 'almoxarifado_interno').length;
  const recoveredPartsCount = partsItems.filter(p => p.origin === 'recuperada_externa').length;

  const executeSave = (options?: {
    markAsCompleted?: boolean;
    redirectToFinance?: boolean;
    triggerExpense?: boolean;
  }): boolean => {
    if (!machineryId || !description.trim()) {
      alert('Por favor, selecione o veículo e insira a descrição da Ordem de Serviço.');
      return false;
    }

    const isMarkingCompleted = !!options?.markAsCompleted;
    const isTriggeringExpense = !!options?.triggerExpense;
    const shouldGoToFinance = !!options?.redirectToFinance;

    const targetStatus = isMarkingCompleted ? 'concluida' : status;
    const todayIso = new Date().toISOString().split('T')[0];
    const targetCompletionDate = isMarkingCompleted
      ? (completionDate.trim() || todayIso)
      : (completionDate.trim() || undefined);

    if (isMarkingCompleted) {
      setStatus('concluida');
      if (!completionDate.trim()) {
        setCompletionDate(todayIso);
      }
    }

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
          (inv.code && part.description && inv.code.trim().toLowerCase() === part.description.trim().toLowerCase()) ||
          (inv.name && part.description && inv.name.trim().toLowerCase() === part.description.trim().toLowerCase())
        );

        if (targetIdx !== -1) {
          const currentQty = Number(updatedStock[targetIdx].quantity) || 0;
          const newQty = Math.max(0, currentQty - qty);
          updatedStock[targetIdx] = {
            ...updatedStock[targetIdx],
            quantity: newQty,
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
      date,
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
      description: description.trim(),
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
        paymentTerm,
        paymentMethod,
        firstDueDate: (installments.length > 0 && installments[0]?.dueDate) ? installments[0].dueDate : firstDueDate,
        installmentsCount: installments.length > 0 ? installments.length : 1,
        supplierName: financialSupplier.trim() || finalMechanicName || workshopOrMechanic.trim(),
        notes: `OS ${osNumber} - ${machName}`,
        installments: installments.length > 0 ? installments : undefined,
      } : (editingLog?.financialConditions || undefined),
    };

    // REGRA DE OURO:
    // createExpense é estritamente isTriggeringExpense.
    // Ao clicar em "Salvar Ordem de Serviço", isTriggeringExpense é false.
    // Os dados são salvos sem fechar o modal e sem enviar ao Contas a Pagar.
    onSave(log, {
      createExpense: isTriggeringExpense && grandTotal > 0,
      deductStock: true,
      createPurchaseRequest: generatePurchaseRequest || (targetStatus === 'aguardando_pecas' && externalPartsCount > 0),
    });

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
    } else if (shouldGoToFinance) {
      setActiveTab('fiscal_financeiro');
      setCreateExpense(true);
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

  // Mapeamento dinâmico de cores vibrantes e alto contraste para o Status da Ordem
  const getStatusSelectStyle = (currentStatus: string) => {
    switch (currentStatus) {
      case 'aguardando_pecas':
        return 'bg-purple-100 text-purple-900 border-purple-400 dark:bg-purple-950/80 dark:text-purple-200 dark:border-purple-500 ring-1 ring-purple-400/40 shadow-xs font-bold';
      case 'em_andamento':
        return 'bg-amber-100 text-amber-950 border-amber-400 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-500 ring-1 ring-amber-400/40 shadow-xs font-bold';
      case 'concluida':
        return 'bg-emerald-100 text-emerald-950 border-emerald-400 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-500 ring-1 ring-emerald-400/40 shadow-xs font-bold';
      case 'agendada':
        return 'bg-blue-100 text-blue-950 border-blue-300 dark:bg-blue-950/70 dark:text-blue-200 dark:border-blue-500 font-bold shadow-xs';
      case 'cancelada':
        return 'bg-rose-100 text-rose-950 border-rose-300 dark:bg-rose-950/70 dark:text-rose-200 dark:border-rose-500 font-bold shadow-xs';
      default:
        return 'bg-blue-50 text-blue-900 border-blue-200 dark:bg-stone-800 dark:text-stone-100 dark:border-stone-700 font-bold';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-0 overflow-hidden">
      <div 
        className="bg-white dark:bg-stone-900 w-[95%] max-w-[95%] h-screen max-h-screen flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150 overflow-hidden border-x sm:border border-blue-900/40 dark:border-stone-800 mx-auto"
        role="dialog"
        aria-modal="true"
      >
        {/* Header Superior em Azul Vibrante #0963cb / bg-blue-800 */}
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-blue-900/70 dark:border-stone-800 bg-blue-800 dark:bg-stone-900 text-white shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-700 dark:bg-blue-950/60 text-white flex items-center justify-center border border-blue-600/50 dark:border-stone-700">
              <Wrench className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm sm:text-base font-bold text-white font-['Outfit']">
                  {editingLog ? `Editar OS: ${editingLog.osNumber || editingLog.id}` : 'Nova Ordem de Serviço (OS)'}
                </h3>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-blue-900/80 text-blue-100 border border-blue-600/50 dark:bg-stone-800 dark:text-stone-100 dark:border-stone-700">
                  {osNumber}
                </span>
              </div>
              <p className="text-[11px] text-blue-200 dark:text-stone-300 font-medium">
                Manutenção na Roça, Estrada ou Oficina • Baixa de Estoque • NF-e • Contas a Pagar
              </p>
            </div>
          </div>
          {/* Canto superior direito: Seletor Global de Status da OS + Botão Fechar */}
          <div className="flex items-center space-x-2.5 sm:space-x-3">
            <div className="flex items-center space-x-1.5 bg-blue-900/60 dark:bg-stone-800/80 px-2 py-1 rounded-lg border border-blue-700/60 dark:border-stone-700 shadow-2xs">
              <span className="text-[10.5px] font-bold text-blue-100 dark:text-stone-300 uppercase tracking-wider whitespace-nowrap hidden sm:inline">
                Status:
              </span>
              <select
                id="maintenance-status-select"
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className={`px-2 py-0.5 border rounded-md text-xs font-bold transition-all duration-150 cursor-pointer focus:ring-2 focus:ring-white/30 focus:outline-hidden shadow-xs ${getStatusSelectStyle(status)}`}
                title="Status da Ordem de Serviço (Fixo em todas as abas)"
              >
                <option value="em_andamento" className="bg-white text-amber-950 dark:bg-stone-900 dark:text-amber-300 font-bold">⏳ Em Andamento</option>
                <option value="concluida" className="bg-white text-emerald-950 dark:bg-stone-900 dark:text-emerald-300 font-bold">✓ Concluída (Liberado)</option>
                <option value="aguardando_pecas" className="bg-white text-purple-950 dark:bg-stone-900 dark:text-purple-300 font-bold">📦 Aguardando Peças</option>
                <option value="agendada" className="bg-white text-blue-950 dark:bg-stone-900 dark:text-blue-300 font-bold">📅 Agendada</option>
                <option value="cancelada" className="bg-white text-rose-950 dark:bg-stone-900 dark:text-rose-300 font-bold">✕ Cancelada</option>
              </select>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-blue-200 hover:text-white dark:text-stone-400 dark:hover:text-stone-200 rounded-lg hover:bg-blue-700/50 dark:hover:bg-stone-800 transition cursor-pointer"
              title="Fechar janela"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        {/* Subtabs de Navegação do Formulário (3 Abas Unificadas) */}
        <div className="flex items-center border-b border-stone-200 dark:border-stone-800 px-5 bg-stone-50 dark:bg-stone-900 overflow-x-auto gap-2 shrink-0">
          <button
            type="button"
            id="tab-diagnostico-equipe-local"
            onClick={() => setActiveTab('geral')}
            className={`py-2 px-3 text-xs font-bold border-b-2 transition whitespace-nowrap flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'geral'
                ? 'border-blue-600 text-blue-700 bg-white dark:bg-stone-800 dark:text-sky-400 font-bold shadow-2xs'
                : 'border-transparent text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>1. Diagnóstico, Equipe & Local</span>
            {laborItems.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[9px] bg-blue-100 text-blue-800 font-bold">
                {laborItems.length} {laborItems.length === 1 ? 'mecânico' : 'mecânicos'}
              </span>
            )}
          </button>

          <button
            type="button"
            id="tab-pecas-estoque"
            onClick={() => setActiveTab('pecas')}
            className={`py-2 px-3 text-xs font-bold border-b-2 transition whitespace-nowrap flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'pecas'
                ? 'border-blue-600 text-blue-700 bg-white dark:bg-stone-800 dark:text-sky-400 font-bold shadow-2xs'
                : 'border-transparent text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>2. Peças & Estoque</span>
            {partsItems.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[9px] bg-blue-100 text-blue-800 font-bold">
                {partsItems.length}
              </span>
            )}
          </button>

          <button
            type="button"
            id="tab-nfe-financeiro"
            onClick={() => setActiveTab('fiscal_financeiro')}
            className={`py-2 px-3 text-xs font-bold border-b-2 transition whitespace-nowrap flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'fiscal_financeiro'
                ? 'border-blue-600 text-blue-700 bg-white dark:bg-stone-800 dark:text-sky-400 font-bold shadow-2xs'
                : 'border-transparent text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>3. NF-e & Financeiro</span>
            {(hasNfe || createExpense) && (
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            )}
          </button>
        </div>

        {/* Form Body com Estrutura Flexível: Topo e Base Fixos, Centro Rolável */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[#b0d2ed] dark:bg-stone-950">
          
          {/* Conteúdo Central com Rolagem Vertical Independente */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4 flex flex-col bg-[#b0d2ed] dark:bg-stone-950">

            {/* Banner de Feedback de Ação */}
            {feedbackBanner && (
              <div className={`p-3 rounded-xl border flex items-center justify-between transition-all duration-200 shadow-xs ${
                feedbackBanner.type === 'billed'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200'
                  : feedbackBanner.type === 'finalize'
                  ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-200'
                  : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100'
              }`}>
                <div className="flex items-center space-x-2.5">
                  {feedbackBanner.type === 'billed' ? (
                    <CheckCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : feedbackBanner.type === 'finalize' ? (
                    <Receipt className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
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
              <div className="space-y-2 flex flex-col">
                {/* Bloco 1: Identificação da OS e Veículo */}
                <div className="p-2.5 bg-[#dcf3ff] dark:bg-stone-900 rounded-xl border border-blue-200 dark:border-stone-800 shadow-2xs">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {/* Número da OS */}
                    <div>
                      <label className="block text-[10.5px] font-bold text-stone-700 dark:text-stone-300 mb-0.5 truncate">
                        Número da OS
                      </label>
                      <input
                        type="text"
                        value={osNumber}
                        onChange={(e) => setOsNumber(e.target.value)}
                        className="w-full px-2 py-1 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-mono font-bold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-[#8da7eb] focus:border-[#8da7eb]"
                        placeholder="OS-2026-0001"
                        required
                      />
                    </div>

                    {/* Data da Abertura */}
                    <div>
                      <label className="block text-[10.5px] font-bold text-stone-700 dark:text-stone-300 mb-0.5 truncate">
                        Abertura *
                      </label>
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full px-2 py-1 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-semibold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-[#8da7eb] focus:border-[#8da7eb]"
                        required
                      />
                    </div>

                    {/* Previsão de Término */}
                    <div>
                      <label className="block text-[10.5px] font-bold text-stone-700 dark:text-stone-300 mb-0.5 truncate">
                        Previsão Término
                      </label>
                      <input
                        type="date"
                        value={completionDate}
                        onChange={(e) => setCompletionDate(e.target.value)}
                        className="w-full px-2 py-1 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-semibold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-[#8da7eb] focus:border-[#8da7eb]"
                      />
                    </div>

                    {/* Veículo / Máquina */}
                    <div>
                      <label className="block text-[10.5px] font-bold text-stone-700 dark:text-stone-300 mb-0.5 truncate">
                        Máquina *
                      </label>
                      <select
                        value={machineryId}
                        onChange={(e) => handleMachineryChange(e.target.value)}
                        className="w-full px-2 py-1 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-semibold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-[#8da7eb] focus:border-[#8da7eb] cursor-pointer"
                        required
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
                <div className="p-2.5 bg-[#dcf3ff] dark:bg-stone-900 rounded-xl border border-blue-200 dark:border-stone-800 shadow-2xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10.5px] font-bold text-stone-700 dark:text-stone-300 mb-0.5 truncate">
                        Horímetro / KM Atual
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formatThousand(currentHourMeterOrKm)}
                        onChange={(e) => handleThousandInput(e.target.value, setCurrentHourMeterOrKm)}
                        placeholder="Ex: 5.000"
                        className="w-full px-2 py-1 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-semibold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-[#8da7eb] focus:border-[#8da7eb]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10.5px] font-bold text-stone-700 dark:text-stone-300 mb-0.5 truncate">
                        Próxima Revisão (h/KM)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formatThousand(nextServiceDue)}
                        onChange={(e) => handleThousandInput(e.target.value, setNextServiceDue)}
                        placeholder="Ex: 6.000"
                        className="w-full px-2 py-1 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-semibold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-[#8da7eb] focus:border-[#8da7eb]"
                      />
                    </div>
                  </div>
                </div>

                {/* Bloco 3: Tipo de Manutenção e Categoria */}
                <div className="p-2.5 bg-[#dcf3ff] dark:bg-stone-900 rounded-xl border border-blue-200 dark:border-stone-800 space-y-1.5 shadow-2xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10.5px] font-bold text-stone-700 dark:text-stone-300 mb-0.5">
                        Tipo de Manutenção
                      </label>
                      <div className="grid grid-cols-2 gap-1">
                        {[
                          { id: 'preventiva', label: 'Preventiva' },
                          { id: 'corretiva', label: 'Corretiva' },
                          { id: 'preditiva', label: 'Preditiva' },
                          { id: 'reforma_entressafra', label: 'Entressafra' },
                        ].map((t) => (
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
                            className={`py-1 px-1.5 text-[10.5px] font-bold rounded-lg border text-center transition cursor-pointer ${
                              type === t.id || (t.id === 'reforma_entressafra' && (type as any) === 'revisao_periodica')
                                ? 'ring-2 ring-blue-500 bg-blue-600 text-white border-blue-600 shadow-xs font-bold'
                                : 'bg-stone-50 dark:bg-stone-800 border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="block text-[10.5px] font-bold text-stone-700 dark:text-stone-300">
                          Categoria do Serviço
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsCategoriesModalOpen(true)}
                          className="text-[10px] text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-bold flex items-center space-x-1 hover:underline cursor-pointer"
                          title="Gerenciar, incluir, editar ou excluir categorias de serviço"
                        >
                          <Tag className="w-2.5 h-2.5" />
                          <span>Gerenciar</span>
                        </button>
                      </div>
                      <div className="flex items-center space-x-1">
                        <select
                          value={serviceCategory}
                          onChange={(e) => setServiceCategory(e.target.value)}
                          className="flex-1 px-2 py-1 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-semibold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-blue-500 cursor-pointer"
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
                          className="p-1 border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg text-blue-600 dark:text-blue-400 transition cursor-pointer shrink-0"
                          title="Incluir, editar ou excluir categorias"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {(serviceCategory === 'Outro' || serviceCategory === 'Outro (Personalizado)') && (
                    <div>
                      <label className="block text-[10.5px] font-bold text-stone-700 dark:text-stone-300 mb-0.5">
                        Especifique a Categoria
                      </label>
                      <input
                        type="text"
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        placeholder="Ex: Regulagem de Rotor de Craqueador"
                        className="w-full px-2 py-1 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-semibold text-stone-900 dark:text-stone-100"
                      />
                    </div>
                  )}
                </div>

                {/* Bloco 4: Descrição do Problema / Diagnóstico */}
                <div className="p-2.5 bg-[#dcf3ff] dark:bg-stone-900 rounded-xl border border-blue-200 dark:border-stone-800 shadow-2xs">
                  <label className="block text-[10.5px] font-bold text-stone-700 dark:text-stone-300 mb-0.5">
                    Descrição do Diagnóstico / Serviço Executado *
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ex: Troca de óleo da caixa de transmissão e substituição de 4 facas do rotor da ensiladeira que empenaram no talhão 3..."
                    rows={2}
                    className="w-full px-2 py-1 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-blue-500 resize-none"
                    required
                  />
                </div>

                {/* Bloco 5: Local da Manutenção */}
                <div className="p-2.5 bg-[#dcf3ff] dark:bg-stone-900 rounded-xl border border-blue-200 dark:border-stone-800 space-y-1 shadow-2xs">
                  <div className="flex items-center space-x-1.5">
                    <MapPin className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                    <h4 className="text-[10.5px] font-bold text-stone-800 dark:text-stone-100 uppercase tracking-wider">
                      Local da Manutenção
                    </h4>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {[
                      {
                        id: 'roca',
                        title: 'Roça (Campo)',
                        subtitle: 'Lavoura/Silagem',
                        color: 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
                      },
                      {
                        id: 'estrada',
                        title: 'Estrada',
                        subtitle: 'Socorro Vicinal',
                        color: 'border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300',
                      },
                      {
                        id: 'oficina_interna',
                        title: 'Oficina Interna',
                        subtitle: 'Nosso Barracão',
                        color: 'border-blue-600 bg-blue-600 text-white font-bold shadow-xs',
                      },
                      {
                        id: 'oficina_externa',
                        title: 'Oficina Externa',
                        subtitle: 'Concessionária/3º',
                        color: 'border-purple-500 bg-purple-50 text-purple-900 dark:bg-purple-950/40 dark:text-purple-300',
                      },
                    ].map((loc) => (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => setLocation(loc.id as any)}
                        className={`py-1.5 px-2 rounded-lg border text-center transition cursor-pointer ${
                          location === loc.id
                            ? `${loc.color} ring-2 ring-blue-500 font-bold shadow-xs`
                            : 'bg-stone-50 dark:bg-stone-800 border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100'
                        }`}
                      >
                        <span className={`text-xs font-bold block truncate ${location === loc.id && loc.id === 'oficina_interna' ? 'text-white' : ''}`}>{loc.title}</span>
                        <span className={`text-[9px] block truncate ${location === loc.id && loc.id === 'oficina_interna' ? 'text-blue-100' : 'text-stone-500 dark:text-stone-400'}`}>{loc.subtitle}</span>
                      </button>
                    ))}
                  </div>

                  <div>
                    <input
                      type="text"
                      value={locationDetails}
                      onChange={(e) => setLocationDetails(e.target.value)}
                      placeholder={
                        location === 'roca' 
                          ? 'Ponto de referência: Ex: Fazenda Santa Maria - Talhão 08'
                          : location === 'estrada'
                          ? 'Ponto de referência: Ex: BR-163 KM 210 sentido Toledo'
                          : location === 'oficina_interna'
                          ? 'Ponto de referência: Ex: Box 2 do Barracão Principal'
                          : 'Ponto de referência: Ex: Oficina Diesel Power - Toledo/PR'
                      }
                      className="w-full px-2.5 py-1 h-8 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Bloco 6: Modalidade de Execução do Serviço */}
                <div className="p-2.5 bg-[#dcf3ff] dark:bg-stone-900 rounded-xl border border-blue-200 dark:border-stone-800 space-y-1 shadow-2xs">
                  <div className="flex items-center space-x-1.5">
                    <UserCheck className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                    <h4 className="text-[10.5px] font-bold text-stone-800 dark:text-stone-100 uppercase tracking-wider">
                      Modalidade de Execução
                    </h4>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {[
                      { id: 'equipe_propria', label: 'Equipe Própria', desc: 'Operador/Equipe' },
                      { id: 'mecanico_interno', label: 'Mecânica Interna', desc: 'Mecânicos base' },
                      { id: 'mecanico_campo', label: 'Socorro Campo', desc: 'Terceiro roça' },
                      { id: 'mecanica_terceirizada', label: 'Oficina Externa', desc: 'Concessionária' },
                    ].map((ex) => (
                      <button
                        key={ex.id}
                        type="button"
                        onClick={() => handleExecutorTypeChange(ex.id as any)}
                        className={`py-1.5 px-2 rounded-lg border text-center transition cursor-pointer ${
                          executorType === ex.id
                            ? 'border-blue-600 bg-blue-600 text-white font-bold ring-2 ring-blue-500 shadow-xs'
                            : 'bg-stone-50 dark:bg-stone-800 border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100'
                        }`}
                      >
                        <span className={`text-xs font-bold block truncate ${executorType === ex.id ? 'text-white' : ''}`}>{ex.label}</span>
                        <span className={`text-[9px] block truncate ${executorType === ex.id ? 'text-blue-100' : 'text-stone-500'}`}>{ex.desc}</span>
                      </button>
                    ))}
                  </div>

                  {(executorType === 'mecanico_campo' || executorType === 'mecanica_terceirizada') && (
                    <div>
                      <input
                        type="text"
                        value={workshopOrMechanic}
                        onChange={(e) => setWorkshopOrMechanic(e.target.value)}
                        placeholder="Nome da Oficina Externa ou Prestador Socorro Terceiro *"
                        className="w-full px-2.5 py-1 h-8 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-semibold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* --- COLUNA DA DIREITA: EXCLUSIVAMENTE MÃO DE OBRA INTERNA (MECÂNICOS) --- */}
              <div className="flex flex-col h-full min-h-0 space-y-2">
                {/* Bloco 1: MÃO DE OBRA INTERNA (MECÂNICOS) NO TOPO DIREITO */}
                <div className="p-3 bg-[#2a93ff] dark:bg-stone-900 rounded-2xl border border-blue-400/60 dark:border-stone-800 space-y-2.5 shadow-md flex-1 flex flex-col min-h-[580px] lg:min-h-0">
                  <div className="flex items-center justify-between shrink-0">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 rounded-md bg-white/20 text-white flex items-center justify-center">
                        <Users className="w-3.5 h-3.5" />
                      </div>
                      <h4 className="text-xs font-black text-white uppercase tracking-wider">
                        Mão de Obra Interna (Mecânicos)
                      </h4>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddLaborItem}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-sm border border-blue-300/40 transition active:scale-95 cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Mecânico</span>
                    </button>
                  </div>

                  {/* Lista dinâmica com amplo espaço vertical e scrollbar refinada */}
                  {laborItems.length === 0 ? (
                    <div className="flex-1 min-h-[280px] py-6 px-3 text-center border border-dashed border-blue-300/50 dark:border-stone-800 bg-white/10 dark:bg-stone-800/30 rounded-xl flex flex-col items-center justify-center space-y-1.5">
                      <Users className="w-6 h-6 text-white/70 dark:text-stone-400" />
                      <p className="text-xs text-white dark:text-stone-300 font-medium">
                        Nenhum mecânico listado nesta Ordem de Serviço.
                      </p>
                      <button
                        type="button"
                        onClick={handleAddLaborItem}
                        className="mt-1 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-sm border border-blue-300/40"
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
                            className="p-3 bg-white dark:bg-stone-800/90 rounded-xl border border-stone-200 dark:border-stone-700/80 space-y-2 shadow-2xs transition-all hover:border-blue-300 dark:hover:border-blue-700"
                          >
                            {/* Cabeçalho do Card do Mecânico */}
                            <div className="flex items-center justify-between pb-1 border-b border-stone-100 dark:border-stone-700/50">
                              <span className="text-[11px] font-bold text-stone-800 dark:text-stone-200 uppercase tracking-wider font-mono flex items-center space-x-1.5">
                                <span className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center text-[10px] font-black shadow-2xs">
                                  #{index + 1}
                                </span>
                                <span>Mecânico #{index + 1}</span>
                              </span>

                              <button
                                type="button"
                                onClick={() => handleRemoveLaborItem(index)}
                                className="p-1 text-stone-400 hover:text-rose-600 rounded-md hover:bg-rose-50 dark:hover:bg-stone-700 transition cursor-pointer"
                                title="Remover mecânico"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Grid com Seleção de Funcionário, Data, Horas, Valor/h e Subtotal */}
                            <div className="grid grid-cols-12 gap-2 items-end">
                              {/* Selecionar Funcionário */}
                              <div className="col-span-12 sm:col-span-4">
                                <label className="block text-[10px] font-bold text-stone-600 dark:text-stone-400 mb-1">
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
                                  className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-semibold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs"
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
                                    className="w-full mt-1 px-2 py-1 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-md text-[11px] text-stone-900 dark:text-stone-100"
                                  />
                                )}
                              </div>

                              {/* Data do Lançamento */}
                              <div className="col-span-6 sm:col-span-2">
                                <label className="block text-[10px] font-bold text-stone-600 dark:text-stone-400 mb-1 text-center">
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
                                  className="w-full px-2 py-1.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-semibold text-center text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs"
                                />
                              </div>

                              {/* Horas (Total Calculado - Readonly) */}
                              <div className="col-span-3 sm:col-span-2">
                                <label className="block text-[10px] font-bold text-stone-600 dark:text-stone-400 mb-1 text-center">
                                  Horas
                                </label>
                                <input
                                  type="text"
                                  readOnly
                                  value={`${itemHoursDisplay}h`}
                                  placeholder="0,00h"
                                  title="Total de horas calculado pelos turnos do Apontamento de Ponto"
                                  className="w-full px-2 py-1.5 bg-amber-50 dark:bg-stone-900 border border-amber-300 dark:border-amber-700/60 rounded-lg text-xs font-black text-center text-amber-950 dark:text-amber-300 cursor-not-allowed select-none shadow-2xs"
                                />
                              </div>

                              {/* Valor da Hora */}
                              <div className="col-span-3 sm:col-span-2">
                                <label className="block text-[10px] font-bold text-stone-600 dark:text-stone-400 mb-1 text-right">
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
                                  className="w-full px-2 py-1.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-bold text-right text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-blue-500 shadow-2xs font-mono"
                                />
                              </div>

                              {/* Subtotal */}
                              <div className="col-span-12 sm:col-span-2">
                                <label className="block text-[10px] font-bold text-stone-600 dark:text-stone-400 mb-1 text-right">
                                  Subtotal
                                </label>
                                <div className="px-2 py-1.5 bg-blue-50 dark:bg-blue-950/60 rounded-lg text-xs font-black text-blue-700 dark:text-blue-300 font-mono text-right truncate border border-blue-200 dark:border-blue-800 shadow-2xs">
                                  {formatCurrencyBRL(item.totalCost || 0)}
                                </div>
                              </div>
                            </div>

                            {/* Bloco Acordeom Recolhível de Apontamento de Ponto */}
                            <div className="mt-1.5 pt-1.5 border-t border-stone-100 dark:border-stone-700/60">
                              <div
                                onClick={() => toggleLaborPonto(itemKey)}
                                className="flex items-center justify-between p-2 rounded-lg bg-stone-50 hover:bg-stone-100 dark:bg-stone-900/60 dark:hover:bg-stone-900 border border-stone-200/80 dark:border-stone-700/60 cursor-pointer transition-colors select-none"
                              >
                                <div className="flex items-center space-x-2">
                                  <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                  <span className="text-[10.5px] font-bold text-stone-800 dark:text-stone-200 uppercase tracking-wider">
                                    Apontamento de Ponto
                                  </span>
                                  {recordedPeriodsCount > 0 && (
                                    <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                      {recordedPeriodsCount} {recordedPeriodsCount === 1 ? 'turno' : 'turnos'} ({itemHoursDisplay}h)
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center space-x-1 text-stone-500 dark:text-stone-400">
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
                                    <span className="text-[10px] text-stone-500 dark:text-stone-400">
                                      Lançamento detalhado de horários trabalhados (Entrada e Saída)
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleAddLaborPeriod(index)}
                                      className="inline-flex items-center space-x-1 px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded-md shadow-xs border border-blue-500 transition active:scale-95 cursor-pointer"
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
                                          className="flex flex-wrap items-center justify-between gap-1.5 p-1.5 bg-stone-50 dark:bg-stone-900/80 rounded-md border border-stone-200 dark:border-stone-700 text-xs shadow-2xs"
                                        >
                                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                                            <span className="text-[10px] font-mono font-bold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-950/70 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                                              Turno #{pNum}
                                            </span>

                                            {/* Entrada N */}
                                            <div className="flex items-center space-x-1">
                                              <label 
                                                htmlFor={`labor-${index}-start-${pIdx}`} 
                                                className="text-[9.5px] font-bold text-stone-700 dark:text-stone-300 whitespace-nowrap"
                                              >
                                                Entrada:
                                              </label>
                                              <input
                                                id={`labor-${index}-start-${pIdx}`}
                                                type="time"
                                                value={period.startTime || ''}
                                                onChange={(e) => handleUpdateLaborPeriod(index, pIdx, 'startTime', e.target.value)}
                                                className="px-1.5 py-0.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded text-xs font-semibold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                              />
                                            </div>

                                            <span className="text-stone-400 text-xs font-bold">às</span>

                                            {/* Saída N */}
                                            <div className="flex items-center space-x-1">
                                              <label 
                                                htmlFor={`labor-${index}-end-${pIdx}`} 
                                                className="text-[9.5px] font-bold text-stone-700 dark:text-stone-300 whitespace-nowrap"
                                              >
                                                Saída:
                                              </label>
                                              <input
                                                id={`labor-${index}-end-${pIdx}`}
                                                type="time"
                                                value={period.endTime || ''}
                                                onChange={(e) => handleUpdateLaborPeriod(index, pIdx, 'endTime', e.target.value)}
                                                className="px-1.5 py-0.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded text-xs font-semibold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                              />
                                            </div>
                                          </div>

                                          {/* Duração calculada e botão remover período */}
                                          <div className="flex items-center space-x-1.5 ml-auto">
                                            {period.startTime && period.endTime ? (
                                              <span className="px-1.5 py-0.5 rounded text-[10.5px] font-mono font-bold bg-emerald-100 text-emerald-950 dark:bg-emerald-950/80 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800">
                                                {formatPeriodDuration(period.startTime, period.endTime)} ({periodHours.toFixed(2).replace('.', ',')}h)
                                              </span>
                                            ) : (
                                              <span className="text-[10px] text-stone-400 italic">
                                                Preencha horários
                                              </span>
                                            )}

                                            {(item.periods && item.periods.length > 1) && (
                                              <button
                                                type="button"
                                                onClick={() => handleRemoveLaborPeriod(index, pIdx)}
                                                className="p-1 text-stone-400 hover:text-rose-600 rounded hover:bg-rose-50 dark:hover:bg-stone-700 transition cursor-pointer"
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
                  <div className="mt-auto shrink-0 p-3 bg-[#091ecb] rounded-xl border border-slate-800 text-white flex items-center justify-between shadow-md">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-600/30 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/40">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white block leading-tight">
                          Total Mão de Obra
                        </span>
                        <div className="flex items-center space-x-2 mt-0.5">
                          <span className="text-[11px] text-slate-400">
                            {laborItems.length} {laborItems.length === 1 ? 'mecânico' : 'mecânicos'}
                          </span>
                          <span className="text-slate-600">•</span>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-950 text-blue-300 border border-blue-800/80">
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
                  <h4 className="text-xs font-bold text-stone-800 dark:text-stone-100 uppercase tracking-wider flex items-center space-x-2">
                    <span>Peças, Insumos & Serviços de Recuperação</span>
                  </h4>
                  <p className="text-xs text-stone-500">
                    Registre peças do estoque interno, compras novas ou peças enviadas para recuperação externa (torno, retífica, solda).
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Seletor Dropdown de Preço Padrão da OS */}
                  <div className="flex items-center space-x-1.5 bg-stone-50 dark:bg-stone-800/80 px-2.5 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 shadow-2xs">
                    <Tag className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span className="text-[11px] font-bold text-stone-700 dark:text-stone-300 whitespace-nowrap">
                      Preço Padrão da OS:
                    </span>
                    <select
                      value={defaultPriceType}
                      onChange={(e) => handleDefaultPriceTypeChange(e.target.value as DefaultOsPriceType)}
                      className="text-xs font-bold bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 border border-stone-300 dark:border-stone-600 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs"
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
                    onClick={handleAddPartItem}
                    className="inline-flex items-center space-x-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-xs border border-blue-400/40 transition active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar Peça / Serviço</span>
                  </button>
                </div>
              </div>

              {/* Tabela / Grid de Peças Horizontal Compacta (Padrão ERP Clássico) */}
              {partsItems.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900/30 rounded-xl space-y-3">
                  <Package className="w-8 h-8 mx-auto text-stone-400" />
                  <p className="text-xs text-stone-600 dark:text-stone-400 font-medium">
                    Nenhum produto ou serviço lançado nesta Ordem de Serviço.
                  </p>
                  <div className="flex justify-center gap-3">
                    <button
                      type="button"
                      onClick={handleAddPartItem}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs border border-blue-400/40"
                    >
                      + Adicionar Produto / Peça (Linha)
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden bg-white dark:bg-stone-900 shadow-2xs min-h-[440px]">
                  <div className="flex-1 overflow-x-auto overflow-y-auto">
                    <table className="w-full text-left border-collapse table-fixed min-w-[840px]">
                      <colgroup>
                        <col className="w-[8%]" />
                        <col className="w-[34%]" />
                        <col className="w-[18%]" />
                        <col className="w-[18%]" />
                        <col className="w-[9%]" />
                        <col className="w-[9%]" />
                        <col className="w-[4%]" />
                      </colgroup>
                      <thead>
                        <tr className="bg-stone-100 dark:bg-stone-800/90 border-b border-stone-200 dark:border-stone-700 text-[10px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider select-none sticky top-0 z-10">
                          <th className="py-2.5 px-3">NUM. (ID)</th>
                          <th className="py-2.5 px-3">DESCRIÇÃO</th>
                          <th className="py-2.5 px-3">ORIGEM</th>
                          <th className="py-2.5 px-3">VALOR UNITÁRIO</th>
                          <th className="py-2.5 px-3 text-center">QTDE</th>
                          <th className="py-2.5 px-3 text-right">TOTAL</th>
                          <th className="py-2.5 px-2 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60 text-xs">
                        {partsItems.map((item, index) => {
                          const stockItem = item.inventoryItemId 
                            ? allInventoryList.find(inv => inv.id === item.inventoryItemId) 
                            : allInventoryList.find(inv => 
                                (inv.name && item.description && inv.name.trim().toLowerCase() === item.description.trim().toLowerCase()) ||
                                (inv.code && item.description && inv.code.trim().toLowerCase() === item.description.trim().toLowerCase())
                              ) || null;
                          const displayCode = stockItem?.code || (item.inventoryItemId ? item.inventoryItemId.slice(0, 8).toUpperCase() : `#${String(index + 1).padStart(3, '0')}`);

                          // Opções de preços sincronizadas com o Estoque e Margens Comerciais
                          const baseUnitCost = (stockItem?.unitCost !== undefined && stockItem.unitCost > 0)
                            ? stockItem.unitCost
                            : (item.unitCost || 0);

                          const costPriceVal = baseUnitCost;

                          const profitMarginVal = stockItem?.profitMargin ?? 30;
                          const salePriceVal = (stockItem?.salePrice !== undefined && stockItem.salePrice > 0)
                            ? stockItem.salePrice
                            : (baseUnitCost > 0 ? Math.round(baseUnitCost * (1 + profitMarginVal / 100) * 100) / 100 : 0);

                          const wholesaleMarginVal = stockItem?.wholesaleMargin ?? 15;
                          const wholesalePriceVal = (stockItem?.wholesalePrice !== undefined && stockItem.wholesalePrice > 0)
                            ? stockItem.wholesalePrice
                            : (baseUnitCost > 0 ? Math.round(baseUnitCost * (1 + wholesaleMarginVal / 100) * 100) / 100 : 0);

                          const promoMarginVal = stockItem?.promoMargin ?? 10;
                          const promoPriceVal = (stockItem?.promoPrice !== undefined && stockItem.promoPrice > 0)
                            ? stockItem.promoPrice
                            : (baseUnitCost > 0 ? Math.round(baseUnitCost * (1 + promoMarginVal / 100) * 100) / 100 : 0);

                          const rowPriceOptions = [
                            {
                              key: 'custo',
                              name: 'Valor de Custo',
                              detail: stockItem?.unitCost ? 'Custo padrão do estoque' : 'Custo base cadastrado',
                              value: costPriceVal,
                              badge: 'Custo',
                              badgeClass: 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-300 dark:border-stone-700',
                            },
                            {
                              key: 'venda',
                              name: 'Preço Final / Venda',
                              detail: stockItem?.salePrice ? `Margem: +${profitMarginVal}% (tabela fixa)` : `Margem padrão: +${profitMarginVal}%`,
                              value: salePriceVal,
                              badge: 'Venda Final',
                              badgeClass: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
                            },
                            {
                              key: 'atacado',
                              name: 'Preço de Atacado',
                              detail: stockItem?.wholesalePrice ? `Margem: +${wholesaleMarginVal}% (atacado)` : `Margem atacado: +${wholesaleMarginVal}%`,
                              value: wholesalePriceVal,
                              badge: 'Atacado',
                              badgeClass: 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800',
                            },
                            {
                              key: 'promocional',
                              name: 'Preço Promocional',
                              detail: stockItem?.promoPrice ? `Margem: +${promoMarginVal}% (promocional)` : `Margem promo: +${promoMarginVal}%`,
                              value: promoPriceVal,
                              badge: 'Promocional',
                              badgeClass: 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800',
                            },
                          ];

                          // Itens correspondentes para autocomplete rápido inline
                          const autocompleteMatches = (autocompleteIndex === index && item.description.trim().length >= 2)
                            ? allInventoryList.filter(inv => 
                                inv.name.toLowerCase().includes(item.description.toLowerCase()) ||
                                (inv.code && inv.code.toLowerCase().includes(item.description.toLowerCase()))
                              ).slice(0, 6)
                            : [];

                          return (
                            <tr 
                              key={item.id || index}
                              data-baixado={item.stockDeducted ? "true" : "false"}
                              className={`item-row transition-colors hover:bg-stone-50/80 dark:hover:bg-stone-800/40 ${
                                item.stockDeducted ? 'item-salvo' : 'item-pendente-baixa'
                              } ${
                                item.origin === 'recuperada_externa'
                                  ? 'bg-purple-50/30 dark:bg-purple-950/10'
                                  : item.origin === 'externo_compra'
                                  ? 'bg-amber-50/20 dark:bg-amber-950/10'
                                  : 'bg-white dark:bg-stone-900'
                              }`}
                            >
                              {/* 1. Num. (ID) */}
                              <td className="py-2 px-3 align-middle font-mono text-[11px] font-semibold text-stone-600 dark:text-stone-400 whitespace-nowrap">
                                <div className="flex items-center space-x-1.5">
                                  <span className="bg-stone-100 dark:bg-stone-800 px-1.5 py-0.5 rounded border border-stone-200 dark:border-stone-700">
                                    {displayCode}
                                  </span>
                                  {item.stockDeducted ? (
                                    <span 
                                      className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                                      title="Item baixado no almoxarifado"
                                    >
                                      Baixado
                                    </span>
                                  ) : (
                                    <span 
                                      className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                                      title="Item novo - baixa pendente ao salvar"
                                    >
                                      Novo
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* 2. Descrição (com Autocomplete, Busca Rápida e Botão de Lupa Modal F4/Enter) */}
                              <td className="py-2 px-3 align-middle relative">
                                <div className="space-y-1">
                                  <div className="relative flex items-center">
                                    <input
                                      type="text"
                                      value={item.description}
                                      onChange={(e) => {
                                        handleUpdatePartItem(index, { description: e.target.value });
                                        setAutocompleteIndex(index);
                                      }}
                                      onFocus={() => setAutocompleteIndex(index)}
                                      onBlur={() => {
                                        // Fechar autocomplete com atraso para permitir clique nos itens
                                        setTimeout(() => {
                                          if (autocompleteIndex === index) {
                                            setAutocompleteIndex(null);
                                          }
                                        }, 250);

                                        // Reconhecimento inteligente se digitado código ou nome exato do estoque
                                        const text = item.description.trim().toLowerCase();
                                        if (text && (item.origin === 'almoxarifado_interno' || !item.origin)) {
                                          const matched = allInventoryList.find(inv => 
                                            (inv.code && inv.code.trim().toLowerCase() === text) ||
                                            (inv.name && inv.name.trim().toLowerCase() === text)
                                          );
                                          if (matched && (!item.inventoryItemId || item.unitCost === 0)) {
                                            handleUpdatePartItem(index, {
                                              inventoryItemId: matched.id,
                                              description: matched.name,
                                              unit: matched.unit || 'un',
                                              unitCost: getPriceForProductByRule(matched, defaultPriceType),
                                              origin: 'almoxarifado_interno'
                                            });
                                          }
                                        }
                                      }}
                                      onKeyDown={(e) => {
                                        // Tecla F4 ou Enter com campo vazio abre a busca avançada por modal
                                        if (e.key === 'F4' || (e.key === 'Enter' && !item.description.trim())) {
                                          e.preventDefault();
                                          handleOpenProductSearch(index, item.description);
                                        }
                                      }}
                                      placeholder="Digite o código ou nome da peça (F4 busca modal)..."
                                      className="w-full pl-2.5 pr-8 py-1 text-xs rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-stone-400"
                                      required
                                    />
                                    {/* Botão de Lupa para abrir Modal de Busca Avançada */}
                                    <button
                                      type="button"
                                      onClick={() => handleOpenProductSearch(index, item.description)}
                                      className="absolute right-1 p-1 text-stone-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-stone-700 rounded transition cursor-pointer"
                                      title="Abrir Consulta Avançada de Produtos (F4)"
                                    >
                                      <Search className="w-3.5 h-3.5" />
                                    </button>
                                  </div>

                                  {/* Pop-up de Autocomplete Inteligente ao digitar */}
                                  {autocompleteMatches.length > 0 && (
                                    <div className="absolute left-3 right-3 top-9 z-50 bg-white dark:bg-stone-800 rounded-lg shadow-xl border border-stone-200 dark:border-stone-700 divide-y divide-stone-100 dark:divide-stone-700 overflow-hidden">
                                      <div className="px-2 py-1 bg-stone-50 dark:bg-stone-800/90 text-[10px] font-bold text-stone-500 uppercase tracking-wider flex justify-between items-center">
                                        <span>Sugestões Rápidas do Estoque</span>
                                        <button
                                          type="button"
                                          onClick={() => handleOpenProductSearch(index, item.description)}
                                          className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                                        >
                                          Ver todas (F4) →
                                        </button>
                                      </div>
                                      {autocompleteMatches.map((match) => (
                                        <div
                                          key={match.id}
                                          onMouseDown={() => {
                                            handleUpdatePartItem(index, {
                                              inventoryItemId: match.id,
                                              description: match.name,
                                              unit: match.unit || 'un',
                                              unitCost: getPriceForProductByRule(match, defaultPriceType),
                                              origin: 'almoxarifado_interno',
                                            });
                                            setAutocompleteIndex(null);
                                          }}
                                          className="px-2.5 py-1.5 text-xs hover:bg-blue-50 dark:hover:bg-stone-700/60 cursor-pointer flex items-center justify-between transition-colors"
                                        >
                                          <div className="truncate pr-2">
                                            <span className="font-mono text-[10px] font-bold text-stone-500 mr-1.5">
                                              [{match.code || match.id.slice(0, 6).toUpperCase()}]
                                            </span>
                                            <span className="font-medium text-stone-900 dark:text-stone-100">
                                              {match.name}
                                            </span>
                                          </div>
                                          <div className="text-right whitespace-nowrap pl-2">
                                            <span className="font-mono font-bold text-stone-800 dark:text-stone-200">
                                              {formatCurrencyBRL(getPriceForProductByRule(match, defaultPriceType))}
                                            </span>
                                            <span className="text-[10px] text-stone-400 ml-1.5 font-mono">
                                              ({match.quantity} {match.unit})
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </td>

                              {/* 3. Origem (Coluna Oficial Integrada na Linha) */}
                              <td className="py-2 px-3 align-middle">
                                <div className="space-y-1">
                                  <select
                                    value={item.origin || 'almoxarifado_interno'}
                                    onChange={(e) => handleUpdatePartItem(index, { origin: e.target.value as any })}
                                    className={`w-full text-xs font-semibold py-1.5 px-2 rounded-lg border cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors shadow-2xs ${
                                      item.origin === 'recuperada_externa'
                                        ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-200'
                                        : item.origin === 'externo_compra'
                                        ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                                        : 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200'
                                    }`}
                                  >
                                    <option value="almoxarifado_interno">Estoque Interno</option>
                                    <option value="externo_compra">Compra Nova</option>
                                    <option value="recuperada_externa">Torno / Recuperada</option>
                                  </select>

                                  {item.origin === 'externo_compra' && (
                                    <input
                                      type="text"
                                      placeholder="Fornecedor..."
                                      value={item.supplierName || ''}
                                      onChange={(e) => handleUpdatePartItem(index, { supplierName: e.target.value })}
                                      className="w-full text-[10px] px-2 py-0.5 rounded border border-amber-200 dark:border-amber-900/60 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 focus:outline-none placeholder:text-stone-400"
                                      title="Fornecedor ou Autopeça"
                                    />
                                  )}

                                  {item.origin === 'recuperada_externa' && (
                                    <input
                                      type="text"
                                      placeholder="Oficina / Torno..."
                                      value={item.serviceProvider || item.supplierName || ''}
                                      onChange={(e) => handleUpdatePartItem(index, { 
                                        serviceProvider: e.target.value,
                                        supplierName: e.target.value
                                      })}
                                      className="w-full text-[10px] px-2 py-0.5 rounded border border-purple-200 dark:border-purple-900/60 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 focus:outline-none placeholder:text-stone-400"
                                      title="Tornearia ou oficina externa"
                                    />
                                  )}

                                  {item.origin === 'almoxarifado_interno' && stockItem && (
                                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-medium block truncate">
                                      Saldo: {stockItem.quantity} {stockItem.unit}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* 4. Valor Unitário (Input Unificado com Edição Manual e Seta Dropdown Embutida para Tabela de Preços) */}
                              <td className="py-2 px-3 align-middle">
                                <div className="relative flex items-center rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 shadow-2xs focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500 transition-colors">
                                  <span className="text-[11px] text-stone-400 pl-2 mr-0.5 font-mono font-medium select-none shrink-0">
                                    R$
                                  </span>
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
                                    title="Digite o valor unitário manualmente ou use a seta ao lado para escolher na tabela de preços"
                                    className="w-full min-w-0 text-xs font-mono text-right bg-transparent text-stone-900 dark:text-stone-100 font-bold focus:outline-none py-1.5 pr-1.5"
                                  />

                                  {/* Botão de seta embutido nativamente no canto direito para seleção da Tabela de Preços */}
                                  <div
                                    className="relative shrink-0 flex items-center justify-center border-l border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/80 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors rounded-r-lg px-2 py-1.5 cursor-pointer group"
                                    title="Tabela de Preços (Custo, Venda, Atacado, Promocional)"
                                  >
                                    <ChevronDown className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400 group-hover:text-stone-800 dark:group-hover:text-stone-200 pointer-events-none transition-colors" />
                                    <select
                                      value=""
                                      onChange={(e) => {
                                        const selectedKey = e.target.value;
                                        const matchedOpt = rowPriceOptions.find(opt => opt.key === selectedKey);
                                        if (matchedOpt) {
                                          setUnitCostRawInputs(prev => {
                                            const copy = { ...prev };
                                            delete copy[item.id];
                                            return copy;
                                          });
                                          handleUpdatePartItem(index, { unitCost: matchedOpt.value });
                                        }
                                      }}
                                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-xs"
                                      title="Selecione um preço na Tabela de Preços"
                                    >
                                      <option value="" disabled>Selecione da Tabela de Preços...</option>
                                      {rowPriceOptions.map(opt => (
                                        <option key={opt.key} value={opt.key}>
                                          {opt.name}: {formatCurrencyBRL(opt.value)}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                              </td>

                              {/* 5. Qtde */}
                              <td className="py-2 px-3 align-middle text-center">
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
                                    className="w-16 px-1 py-1 text-xs font-mono font-bold text-center rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                  <span className="text-[11px] font-medium text-stone-500 uppercase">
                                    {item.unit || 'un'}
                                  </span>
                                </div>
                              </td>

                              {/* 6. Total (Obrigatoriamente alinhado à direita para leitura financeira) */}
                              <td className="py-2 px-3 align-middle text-right font-mono">
                                <span className="text-xs font-bold text-stone-900 dark:text-stone-100 whitespace-nowrap">
                                  {formatCurrencyBRL(item.totalCost || 0)}
                                </span>
                              </td>

                              {/* 7. Ações (Exclusão rápida) */}
                              <td className="py-2 px-2 align-middle text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemovePartItem(index)}
                                  className="p-1 text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded transition cursor-pointer"
                                  title="Excluir item da lista"
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
              <div className="mt-auto shrink-0 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl px-3.5 py-2.5 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                  {/* 1. Mão de Obra Avulsa / Terceira */}
                  <div className="flex items-center space-x-2">
                    <label className="text-[11px] font-bold text-stone-700 dark:text-stone-300 whitespace-nowrap">
                      Mão de Obra Avulsa:
                    </label>
                    <div className="inline-flex items-center bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-md px-2 py-0.5 shadow-2xs focus-within:ring-1 focus-within:ring-blue-500">
                      <span className="text-[11px] text-stone-400 font-mono font-medium mr-1 select-none">R$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={laborCost}
                        onChange={(e) => setLaborCost(e.target.value)}
                        placeholder="0,00"
                        className="w-20 py-0.5 text-xs font-mono font-bold text-right bg-transparent text-stone-900 dark:text-stone-100 focus:outline-none"
                        title="Custo adicional avulso de mão de obra (além da interna da Aba 1)"
                      />
                    </div>
                    {laborItems.length > 0 && (
                      <span className="text-[10px] text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800 font-medium whitespace-nowrap">
                        + R$ {totalInternalLaborCalculated.toFixed(2)} interna
                      </span>
                    )}
                  </div>

                  {/* 2. Discriminação dos Subtotais */}
                  <div className="hidden lg:flex items-center space-x-3 text-[11px] text-stone-600 dark:text-stone-400 border-l border-r border-stone-200 dark:border-stone-700 px-3">
                    <div>
                      <span>Peças Novas / Estoque: </span>
                      <strong className="font-mono text-stone-900 dark:text-stone-100">
                        {formatCurrencyBRL(
                          partsItems
                            .filter(p => p.origin !== 'recuperada_externa')
                            .reduce((acc, p) => acc + (p.totalCost || 0), 0)
                        )}
                      </strong>
                    </div>
                    {totalRecoveredExternalCost > 0 && (
                      <div>
                        <span className="text-purple-600 dark:text-purple-400">Recuperação / Torno: </span>
                        <strong className="font-mono text-purple-700 dark:text-purple-300">
                          {formatCurrencyBRL(totalRecoveredExternalCost)}
                        </strong>
                      </div>
                    )}
                  </div>

                  {/* Custo Total Consolidado da OS */}
                  <div className="flex items-center space-x-2 ml-auto">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 whitespace-nowrap">
                      Custo Consolidado:
                    </span>
                    <span className="text-base font-black text-blue-800 dark:text-blue-300 font-['Outfit'] font-mono">
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
              <div className="p-4 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white rounded-2xl border border-blue-700/60 shadow-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/15">
                  <div className="flex items-center space-x-2.5">
                    <Receipt className="w-5 h-5 text-blue-200" />
                    <div>
                      <h3 className="text-sm font-black text-white tracking-wide">
                        Consolidado da Ordem de Serviço ({osNumber || 'Sem Número'})
                      </h3>
                      <p className="text-[11px] text-blue-100 font-medium">
                        Valores consolidados de peças, insumos e mão de obra prontos para faturamento
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] text-blue-100 font-bold">Status:</span>
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                      status === 'concluida'
                        ? 'bg-emerald-100 text-emerald-950 border border-emerald-300'
                        : 'bg-amber-100 text-amber-950 border border-amber-300'
                    }`}>
                      {status === 'concluida' ? 'OS Concluída' : 'OS Em Andamento'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
                  <div className="p-3 bg-white/10 dark:bg-stone-900/70 rounded-xl border border-white/15 dark:border-stone-700 shadow-2xs">
                    <span className="block text-[11px] text-blue-100 dark:text-stone-400 font-semibold">Peças & Insumos ({partsItems.length} itens)</span>
                    <span className="text-sm sm:text-base font-black text-white">
                      {formatCurrencyBRL(totalPartsCalculated)}
                    </span>
                  </div>

                  <div className="p-3 bg-white/10 dark:bg-stone-900/70 rounded-xl border border-white/15 dark:border-stone-700 shadow-2xs">
                    <span className="block text-[11px] text-blue-100 dark:text-stone-400 font-semibold">Mão de Obra ({laborItems.length} mecânicos)</span>
                    <span className="text-sm sm:text-base font-black text-white">
                      {formatCurrencyBRL(totalLaborCalculated)}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-950/80 text-white rounded-xl border border-blue-400/30 shadow-xs">
                    <span className="block text-[11px] text-blue-200 font-semibold">Total a Faturar na OS</span>
                    <span className="text-base sm:text-lg font-black text-emerald-400">
                      {formatCurrencyBRL(grandTotal)}
                    </span>
                  </div>
                </div>
              </div>

              {/* FLUXO B: VÍNCULO DE NF-E */}
              <div className="p-4 bg-white dark:bg-stone-800/80 rounded-2xl border border-stone-200 dark:border-stone-800 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-[#5075d6] dark:text-blue-400" />
                    <h4 className="text-xs font-bold text-stone-800 dark:text-stone-100 uppercase tracking-wider">
                      Integração Fiscal: Vincular Nota Fiscal (NF-e)
                    </h4>
                  </div>

                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasNfe}
                      onChange={(e) => setHasNfe(e.target.checked)}
                      className="w-4 h-4 text-[#5075d6] rounded focus:ring-[#8da7eb]"
                    />
                    <span className="text-xs font-bold text-stone-700 dark:text-stone-300">
                      Possui NF-e Vinculada
                    </span>
                  </label>
                </div>

                {hasNfe && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div>
                      <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-400 mb-1">
                        Número da NF-e
                      </label>
                      <input
                        type="text"
                        value={nfeNumber}
                        onChange={(e) => setNfeNumber(e.target.value)}
                        placeholder="Ex: 000.045.892"
                        className="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-xs font-mono font-bold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-[#8da7eb]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-400 mb-1">
                        Série
                      </label>
                      <input
                        type="text"
                        value={nfeSeries}
                        onChange={(e) => setNfeSeries(e.target.value)}
                        placeholder="Ex: 1"
                        className="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-[#8da7eb]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-400 mb-1">
                        Data de Emissão da Nota
                      </label>
                      <input
                        type="date"
                        value={nfeIssueDate}
                        onChange={(e) => setNfeIssueDate(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-[#8da7eb]"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-400 mb-1">
                        Chave de Acesso (44 dígitos)
                      </label>
                      <input
                        type="text"
                        maxLength={44}
                        value={nfeAccessKey}
                        onChange={(e) => setNfeAccessKey(e.target.value)}
                        placeholder="41260800000000000000550010000458921000458920"
                        className="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-xs font-mono text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-[#8da7eb]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-400 mb-1">
                        Fornecedor / Razão Social
                      </label>
                      <input
                        type="text"
                        value={nfeSupplierName}
                        onChange={(e) => setNfeSupplierName(e.target.value)}
                        placeholder="Ex: TratorPeças do Iguaçu Ltda"
                        className="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-[#8da7eb]"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* INTEGRAÇÃO FINANCEIRA: CONTAS A PAGAR */}
              <div className="p-4 bg-white dark:bg-stone-800/80 rounded-2xl border border-stone-200 dark:border-stone-800 space-y-4 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CreditCard className="w-4 h-4 text-[#5075d6] dark:text-blue-400" />
                    <h4 className="text-xs font-bold text-stone-800 dark:text-stone-100 uppercase tracking-wider">
                      Integração Financeira: Gerar Lançamento no Contas a Pagar
                    </h4>
                  </div>

                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createExpense}
                      onChange={(e) => setCreateExpense(e.target.checked)}
                      className="w-4 h-4 text-[#5075d6] rounded focus:ring-[#8da7eb]"
                    />
                    <span className="text-xs font-bold text-stone-700 dark:text-stone-300">
                      Lançar no Financeiro
                    </span>
                  </label>
                </div>

                {createExpense && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    {/* 1º Lugar: Forma de Pagamento */}
                    <div>
                      <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-400 mb-1">
                        Forma de Pagamento
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as any)}
                        className="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-xs font-bold text-stone-900 dark:text-stone-100 cursor-pointer focus:ring-2 focus:ring-[#8da7eb]"
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
                      <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-400 mb-1">
                        1º Vencimento
                      </label>
                      <input
                        type="date"
                        value={firstDueDate}
                        onChange={(e) => setFirstDueDate(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-stone-100 font-semibold focus:ring-2 focus:ring-[#8da7eb]"
                      />
                    </div>

                    {/* 3º Lugar: Condição / Prazo de Pagamento: Card Indicador e Botão Detalhamento de Parcelas */}
                    <div>
                      <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-400 mb-1 flex items-center justify-between">
                        <span>Condição / Prazo de Pagamento</span>
                        <span className="text-[10px] font-extrabold text-[#0963cb] dark:text-blue-400">
                          {installments.length > 1 ? `${installments.length}x Parcelas` : (installments.length === 1 ? '1x Parcela' : 'À Vista')}
                        </span>
                      </label>
                      <div className="flex items-center justify-between gap-2 p-1.5 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl min-h-[38px] shadow-2xs">
                        <div className="min-w-0 flex-1 px-1.5">
                          <p className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
                            {installments.length > 0 
                              ? `${installments.length}x de ${formatCurrencyBRL(installments[0]?.amount || (grandTotal / installments.length))}`
                              : `1x de ${formatCurrencyBRL(grandTotal)}`}
                          </p>
                          <p className="text-[10px] text-stone-500 dark:text-stone-400 truncate">
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
                          className="px-2.5 py-1.5 bg-[#0963cb] hover:bg-[#0752a8] text-white rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer shadow-2xs shrink-0"
                          title="Abrir Janela de Detalhamento de Parcelas da OS"
                        >
                          <Layers className="w-3.5 h-3.5" />
                          <span>Detalhamento de Parcelas</span>
                        </button>
                      </div>
                    </div>

                    {/* Fornecedor para o Financeiro */}
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-400 mb-1">
                        Credor / Fornecedor do Pagamento
                      </label>
                      <input
                        type="text"
                        value={financialSupplier || workshopOrMechanic}
                        onChange={(e) => setFinancialSupplier(e.target.value)}
                        placeholder="Nome da Oficina ou Fornecedor de Peças"
                        className="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-xs font-semibold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-[#8da7eb]"
                      />
                    </div>

                    {/* Botão e Ação Direta de Faturamento no Contas a Pagar */}
                    <div className="sm:col-span-3 pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 dark:border-stone-700">
                      <div>
                        {expenseGenerated ? (
                          <div className="inline-flex items-center space-x-2 text-emerald-700 dark:text-emerald-300 font-bold text-xs bg-emerald-100/80 dark:bg-emerald-950/60 px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-700">
                            <CheckCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            <span>Lançamento Confirmado no Contas a Pagar</span>
                          </div>
                        ) : (
                          <p className="text-xs text-stone-600 dark:text-stone-400">
                            Pronto para gerar despesa no valor de <strong className="text-stone-900 dark:text-stone-100">{formatCurrencyBRL(grandTotal)}</strong>
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        id="btn-confirmar-faturamento-contas-pagar"
                        onClick={() => {
                          setCreateExpense(true);
                          executeSave({ triggerExpense: true, markAsCompleted: true });
                        }}
                        className="inline-flex items-center space-x-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md transition active:scale-95 cursor-pointer"
                      >
                        <CreditCard className="w-4 h-4" />
                        <span>Confirmar Faturamento & Lançar no Contas a Pagar</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* FLUXO A: SOLICITAÇÃO DE COMPRA / COTAÇÃO */}
              <div className="p-4 bg-amber-50/70 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-900/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ShoppingCart className="w-4 h-4 text-amber-600" />
                    <div>
                      <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider">
                        Fluxo de Compras: Gerar Solicitação de Cotação
                      </h4>
                      <p className="text-[11px] text-amber-700 dark:text-amber-400">
                        Gera pedido no setor de compras para cotar e encomendar as peças externas.
                      </p>
                    </div>
                  </div>

                  <input
                    type="checkbox"
                    checked={generatePurchaseRequest}
                    onChange={(e) => setGeneratePurchaseRequest(e.target.checked)}
                    className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                  />
                </div>

                {generatePurchaseRequest && (
                  <div className="pt-2">
                    <label className="block text-[11px] font-bold text-amber-900 dark:text-amber-200 mb-1">
                      Nível de Urgência da Cotação / Compra
                    </label>
                    <select
                      value={purchaseUrgency}
                      onChange={(e) => setPurchaseUrgency(e.target.value as any)}
                      className="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-amber-300 dark:border-amber-800 rounded-xl text-xs font-bold text-stone-900 dark:text-stone-100 cursor-pointer"
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
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Observações Gerais / Histórico
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Peça substituída com garantia de 90 dias da concessionária..."
                  rows={2}
                  className="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-xs sm:text-sm text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-[#8da7eb]"
                />
              </div>
            </div>
          )}
          </div>

          {/* Rodapé Azul Fixo da OS */}
          <div className="shrink-0 bg-blue-800 dark:bg-stone-900 border-t border-blue-900/70 dark:border-stone-800 px-5 py-3 text-white flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg z-20">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-200 dark:text-stone-400">
                  Total Geral da OS:
                </span>
                <span className="text-lg sm:text-xl font-black text-white font-['Outfit'] tracking-tight">
                  {formatCurrencyBRL(grandTotal)}
                </span>
              </div>

              {/* Sub-totais discriminados */}
              <div className="hidden md:flex items-center space-x-2 text-[11px] text-blue-100 dark:text-stone-400 bg-blue-900/60 dark:bg-stone-800/80 px-2.5 py-1 rounded-lg border border-blue-700/60 dark:border-stone-700 shadow-2xs">
                <span>Peças: <strong className="text-white font-mono">{formatCurrencyBRL(totalPartsCalculated)}</strong></span>
                <span>•</span>
                <span>M. Obra: <strong className="text-white font-mono">{formatCurrencyBRL(totalLaborCalculated)}</strong></span>
              </div>

              {saveSuccess && (
                <span className="inline-flex items-center space-x-1.5 px-3 py-1 bg-emerald-100 border border-emerald-400 text-emerald-950 rounded-lg text-xs font-bold animate-in fade-in duration-150">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  <span>OS Salva com Sucesso!</span>
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                type="button"
                id="btn-cancelar-os"
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl border border-blue-400/40 bg-blue-900/50 hover:bg-blue-700/60 text-blue-100 hover:text-white text-xs font-bold transition cursor-pointer shadow-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="btn-sair-fechar-os"
                onClick={onClose}
                className="inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-xl border border-blue-300/40 bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition cursor-pointer shadow-xs"
                title="Fechar formulário de Ordem de Serviço"
              >
                <X className="w-3.5 h-3.5 text-blue-100" />
                <span>Sair / Fechar</span>
              </button>

              {/* 1. Botão Verde: Salva estado atual sem fechar e sem enviar ao Contas a Pagar */}
              <button
                type="button"
                id="btn-salvar-os"
                onClick={() => executeSave({ triggerExpense: false })}
                className="inline-flex items-center justify-center space-x-2 px-5 py-2 text-white text-xs font-bold rounded-xl shadow-md transition active:scale-95 cursor-pointer bg-emerald-600 hover:bg-emerald-500 border border-emerald-400/40"
                title="Salva o estado atual das peças, quantidades e mão de obra mantendo os itens na tela sem gerar despesa financeira"
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
                  className="inline-flex items-center justify-center space-x-2 px-5 py-2 text-white text-xs font-bold rounded-xl shadow-md transition active:scale-95 cursor-pointer bg-blue-600 hover:bg-blue-500 border border-blue-400/50"
                  title="Avançar para a aba 2. Peças & Estoque"
                >
                  <span>Incluir peças</span>
                  <ArrowRight className="w-3.5 h-3.5 text-white" />
                </button>
              ) : (
                <button
                  type="button"
                  id="btn-fechar-e-faturar-os"
                  onClick={() => {
                    setStatus('concluida');
                    executeSave({ markAsCompleted: true, redirectToFinance: true, triggerExpense: false });
                  }}
                  className="inline-flex items-center justify-center space-x-2 px-5 py-2 text-white text-xs font-bold rounded-xl shadow-md transition active:scale-95 cursor-pointer bg-blue-600 hover:bg-blue-500 border border-blue-400/50"
                  title="Conclui a manutenção, salva o estado final e abre a Aba 3 para faturamento e formas de pagamento"
                >
                  <Receipt className="w-4 h-4 text-white" />
                  <span>Fechar OS e faturar</span>
                  <ArrowRight className="w-3.5 h-3.5 text-white" />
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
