import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Plus, Search, Filter, Fuel, Wrench, AlertTriangle, 
  CheckCircle2, Clock, Truck, Shield, Calendar, Edit3, Trash2,
  Table as TableIcon, LayoutGrid, Users, Gauge, Box, Eye, TrendingUp,
  Receipt, DollarSign, Printer, RefreshCw, X, Link2, Check,
  Share2, ArrowUpDown, ChevronDown, Sparkles, Building, Weight,
  SlidersHorizontal, Layers, Pencil, Package, Save, Lock, Settings
} from 'lucide-react';
import { Machinery, FuelLog, MaintenanceLog, Employee, ServiceOrder, SilageOrder, CompanyProfile, PreventiveGroupItem, InventoryItem, MaintenanceSubgroup, MaintenanceCategoryDefinition } from '../../types';
import { PrintPreviewModal } from '../common/PrintPreviewModal';
import { generateFleetListHtml, generateFleetWhatsAppText, syncFleetMeters, formatCurrencyBRL } from './fleetPrintUtils';
import { PrintDocumentOptions } from '../../lib/printService';
import { VehicleCategoriesModal } from './VehicleCategoriesModal';
import { MaintenanceCategoriesModal } from './MaintenanceCategoriesModal';
import { 
  getStoredVehicleSystemCategories, 
  saveStoredVehicleSystemCategories,
  getStoredVehicleOwnershipRegimes, 
  getStoredCompanyProfile, 
  getStoredMachineries, 
  getStoredEmployees,
  getStoredPreventiveGroupPlans,
  saveStoredPreventiveGroupPlans,
  getStoredInventory,
  getStoredMaintenanceCategories,
  saveStoredMaintenanceCategories,
  DEFAULT_PREVENTIVE_PLANS_BY_CATEGORY,
  MAINTENANCE_SUBGROUPS,
  inferMaintenanceSubgroup
} from '../../lib/storage';
import { fetchGestaoFrotas, fetchCloudFuelLogs, patchGestaoFrotaMeter, isSupabaseConfigured, toValidUUID } from '../../lib/supabaseService';
import { supabase } from '../../lib/supabaseClient';

export interface FleetVehiclesViewProps {
  machineries: Machinery[];
  fuelLogs: FuelLog[];
  maintenanceLogs: MaintenanceLog[];
  employees?: Employee[];
  services?: ServiceOrder[];
  orders?: SilageOrder[];
  companyProfile?: CompanyProfile;
  onSaveMachineries?: (machineries: Machinery[]) => void;
  onOpenNewVehicle: () => void;
  onEditVehicle: (vehicle: Machinery) => void;
  onDeleteVehicle: (id: string) => void;
  onNewFuelForVehicle: (vehicleId: string) => void;
  onNewMaintenanceForVehicle: (vehicleId: string) => void;
  onOpenHistory: (vehicle: Machinery) => void;
}

export const FleetVehiclesView: React.FC<FleetVehiclesViewProps> = ({
  machineries = [],
  fuelLogs = [],
  maintenanceLogs = [],
  employees = [],
  services = [],
  orders = [],
  companyProfile,
  onSaveMachineries,
  onOpenNewVehicle,
  onEditVehicle,
  onDeleteVehicle,
  onNewFuelForVehicle,
  onNewMaintenanceForVehicle,
  onOpenHistory,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');
  const [selectedStatus, setSelectedStatus] = useState<string>('todos');
  const [selectedOwnership, setSelectedOwnership] = useState<string>('todos');
  const [selectedComposition, setSelectedComposition] = useState<string>('todos');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Print Preview Modal States
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printOptions, setPrintOptions] = useState<PrintDocumentOptions | null>(null);

  // Sync Meter Feedback Banner
  const [syncBanner, setSyncBanner] = useState<{ type: 'success' | 'info'; message: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Quick Meter Reading Modal
  const [quickMeterVehicle, setQuickMeterVehicle] = useState<Machinery | null>(null);
  const [quickHourMeter, setQuickHourMeter] = useState('');
  const [quickKm, setQuickKm] = useState('');
  const [quickMeterFeedback, setQuickMeterFeedback] = useState<string | null>(null);

  // Sub-aba ativa: 'frota' (VEÍCULOS & MÁQUINAS) ou 'tipos_trocas' (TIPOS DE TROCAS / PLANO PREVENTIVO)
  const [vehicleSubTab, setVehicleSubTab] = useState<'frota' | 'tipos_trocas'>('frota');

  // Estados da Matriz de Parametrização "TIPOS DE TROCAS" (Regras do Grupo / Plano Preventivo)
  const [preventivePlans, setPreventivePlans] = useState<Record<string, PreventiveGroupItem[]>>(() => getStoredPreventiveGroupPlans());
  const [selectedGroupCategory, setSelectedGroupCategory] = useState<string>('COLHEITADEIRA');
  const [filterSubgroup, setFilterSubgroup] = useState<string>('TODOS OS SUBGRUPOS');
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>(() => getStoredInventory());
  const [ruleSubgroup, setRuleSubgroup] = useState<MaintenanceSubgroup>('FILTROS');
  const [inventorySearchQuery, setInventorySearchQuery] = useState('');
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<InventoryItem | null>(null);
  const [ruleIntervalHoursKm, setRuleIntervalHoursKm] = useState<number | ''>(250);
  const [ruleStandardQty, setRuleStandardQty] = useState<number | ''>(28);
  const [ruleUnit, setRuleUnit] = useState('L');
  const [ruleNotes, setRuleNotes] = useState('');
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [isInventoryDropdownOpen, setIsInventoryDropdownOpen] = useState(false);
  const [preventiveFeedback, setPreventiveFeedback] = useState<{ type: 'success' | 'info'; message: string } | null>(null);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [systemCategories, setSystemCategories] = useState<string[]>(() => getStoredVehicleSystemCategories());
  const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState(false);
  const inventoryDropdownRef = useRef<HTMLDivElement>(null);

  // Sincronização em tempo real de categorias de veículos
  useEffect(() => {
    const handleCategoriesUpdated = () => {
      const fresh = getStoredVehicleSystemCategories();
      setSystemCategories(fresh);
    };
    window.addEventListener('agrocontrol_categorias_veiculos_updated', handleCategoriesUpdated);
    window.addEventListener('silagem_vehicle_categories_updated', handleCategoriesUpdated);
    window.addEventListener('storage', handleCategoriesUpdated);
    return () => {
      window.removeEventListener('agrocontrol_categorias_veiculos_updated', handleCategoriesUpdated);
      window.removeEventListener('silagem_vehicle_categories_updated', handleCategoriesUpdated);
      window.removeEventListener('storage', handleCategoriesUpdated);
    };
  }, []);

  // Subgrupos de Manutenção dinâmicos sincronizados com 'agrocontrol_servicos_categorias' da OS
  const [maintenanceCategories, setMaintenanceCategories] = useState<MaintenanceCategoryDefinition[]>(() => getStoredMaintenanceCategories());

  // Sincronização em tempo real dos subgrupos cadastrados na OS ou pelo sistema
  useEffect(() => {
    const handleMaintenanceCategoriesSync = () => {
      setMaintenanceCategories(getStoredMaintenanceCategories());
    };
    window.addEventListener('agrocontrol_servicos_categorias_updated', handleMaintenanceCategoriesSync);
    window.addEventListener('maintenance_categories_updated', handleMaintenanceCategoriesSync);
    window.addEventListener('storage', handleMaintenanceCategoriesSync);
    return () => {
      window.removeEventListener('agrocontrol_servicos_categorias_updated', handleMaintenanceCategoriesSync);
      window.removeEventListener('maintenance_categories_updated', handleMaintenanceCategoriesSync);
      window.removeEventListener('storage', handleMaintenanceCategoriesSync);
    };
  }, []);

  // Estado e handler para o Modal de Gerenciamento de Subgrupos de Manutenção
  const [isMaintenanceCategoriesModalOpen, setIsMaintenanceCategoriesModalOpen] = useState(false);

  const handleSaveMaintenanceCategories = (updated: MaintenanceCategoryDefinition[]) => {
    const sorted = [...updated].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' }));
    setMaintenanceCategories(sorted);
    saveStoredMaintenanceCategories(sorted);
  };

  const handleSaveCategories = (updated: string[]) => {
    const sorted = [...updated]
      .map(c => c.trim().toUpperCase())
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
    setSystemCategories(sorted);
    saveStoredVehicleSystemCategories(sorted);
  };

  // Estados para Edição / Associação Direta Inline no Grid
  const [inlineEditingRuleId, setInlineEditingRuleId] = useState<string | null>(null);
  const [inlineSubgroup, setInlineSubgroup] = useState<MaintenanceSubgroup>('FILTROS');
  const [inlineSearchQuery, setInlineSearchQuery] = useState('');
  const [inlineSelectedProduct, setInlineSelectedProduct] = useState<InventoryItem | null>(null);
  const [inlineInterval, setInlineInterval] = useState<number | ''>(250);
  const [inlineQty, setInlineQty] = useState<number | ''>(1);
  const [inlineUnit, setInlineUnit] = useState('UN');
  const [inlineDropdownOpen, setInlineDropdownOpen] = useState(false);
  const inlineDropdownRef = useRef<HTMLDivElement>(null);

  // Sincronização em tempo real de planos preventivos
  useEffect(() => {
    const handlePlansUpdated = (e: any) => {
      if (e?.detail && typeof e.detail === 'object') {
        setPreventivePlans(e.detail);
      } else {
        setPreventivePlans(getStoredPreventiveGroupPlans());
      }
    };
    window.addEventListener('agrocontrol_plano_preventivo_grupos_updated', handlePlansUpdated);
    window.addEventListener('storage', handlePlansUpdated);
    return () => {
      window.removeEventListener('agrocontrol_plano_preventivo_grupos_updated', handlePlansUpdated);
      window.removeEventListener('storage', handlePlansUpdated);
    };
  }, []);

  // Recarrega inventário do almoxarifado e subgrupos da OS quando a sub-aba for aberta
  useEffect(() => {
    if (vehicleSubTab === 'tipos_trocas') {
      setInventoryList(getStoredInventory());
      setMaintenanceCategories(getStoredMaintenanceCategories());
    }
  }, [vehicleSubTab]);

  // Fechar dropdown de autocomplete ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (inventoryDropdownRef.current && !inventoryDropdownRef.current.contains(event.target as Node)) {
        setIsInventoryDropdownOpen(false);
      }
      if (inlineDropdownRef.current && !inlineDropdownRef.current.contains(event.target as Node)) {
        setInlineDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Lista normalizada e desduplicada de grupos/categorias disponíveis
  const availableGroupCategories = useMemo(() => {
    const canonicalOrder = ['COLHEITADEIRA', 'FORRAGEIRA', 'TRATOR', 'CAMINHÃO', 'MÁQUINAS PESADAS'];
    const aliasMap: Record<string, string> = {
      'CAMINHAO': 'CAMINHÃO',
      'CAMINHAO TRATOR': 'CAMINHÃO',
      'CAMINHÃO TRATOR': 'CAMINHÃO',
      'MAQUINAS_PESADAS': 'MÁQUINAS PESADAS',
      'MAQUINAS PESADAS': 'MÁQUINAS PESADAS',
      'ENSILADEIRA': 'FORRAGEIRA',
      'ENSILADEIRA AUTOPROPELIDA': 'FORRAGEIRA',
      'TRATOR AGRICOLA': 'TRATOR',
      'TRATOR AGRÍCOLA': 'TRATOR',
    };

    const normalizeStr = (s: string) => s.toUpperCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/_/g, ' ')
      .trim();

    const fromPlans = Object.keys(preventivePlans || {});
    const fromSysCategories = systemCategories.length > 0 ? systemCategories : getStoredVehicleSystemCategories();

    const set = new Set<string>();
    canonicalOrder.forEach(c => set.add(c));

    [...fromPlans, ...fromSysCategories.map(c => c.toUpperCase())].forEach(raw => {
      const trimmed = (raw || '').trim().toUpperCase();
      if (!trimmed) return;
      if (aliasMap[trimmed]) {
        set.add(aliasMap[trimmed]);
      } else {
        const norm = normalizeStr(trimmed);
        const matchedCanonical = canonicalOrder.find(co => normalizeStr(co) === norm);
        if (matchedCanonical) {
          set.add(matchedCanonical);
        } else {
          set.add(trimmed);
        }
      }
    });

    return Array.from(set).filter(Boolean);
  }, [preventivePlans, systemCategories]);

  // Itens configurados para a categoria ativa
  const currentCategoryRules = useMemo<PreventiveGroupItem[]>(() => {
    const upperCat = selectedGroupCategory.toUpperCase();
    if (preventivePlans[upperCat] && Array.isArray(preventivePlans[upperCat]) && preventivePlans[upperCat].length > 0) {
      return preventivePlans[upperCat];
    }
    const aliasKey = upperCat === 'CAMINHÃO' ? 'CAMINHAO' : (upperCat === 'MÁQUINAS PESADAS' ? 'MAQUINAS_PESADAS' : upperCat);
    if (preventivePlans[aliasKey] && Array.isArray(preventivePlans[aliasKey]) && preventivePlans[aliasKey].length > 0) {
      return preventivePlans[aliasKey];
    }
    return DEFAULT_PREVENTIVE_PLANS_BY_CATEGORY[upperCat] || DEFAULT_PREVENTIVE_PLANS_BY_CATEGORY[aliasKey] || [];
  }, [preventivePlans, selectedGroupCategory]);

  // Lista dinâmica e unificada de subgrupos de manutenção sincronizada com 'agrocontrol_servicos_categorias'
  const availableMaintenanceSubgroups = useMemo(() => {
    const set = new Set<string>();
    
    // Subgrupos mantidos na chave 'agrocontrol_servicos_categorias' da OS
    (maintenanceCategories || []).forEach(cat => {
      const name = (cat.name || '').trim().toUpperCase();
      if (name) set.add(name);
    });

    // Subgrupos eventualmente já gravados em regras existentes
    (currentCategoryRules || []).forEach(r => {
      if (r.SUBGRUPO && typeof r.SUBGRUPO === 'string') {
        const trimmed = r.SUBGRUPO.trim().toUpperCase();
        if (trimmed) set.add(trimmed);
      }
    });

    if (set.size === 0) {
      ['FILTROS', 'ÓLEOS E LUBRIFICANTES', 'FLUIDOS E ADITIVOS', 'COMPONENTES E SERVIÇOS MECÂNICOS'].forEach(s => set.add(s));
    }

    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [maintenanceCategories, currentCategoryRules]);

  // Função utilitária para comparação insensível de strings de subgrupos
  const normalizeSubgroupStr = (s?: string) => {
    return (s || '')
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[&]/g, 'E')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Agrupamento estrito por Subgrupos dinâmicos em ordem alfabética (Reflete barras divisórias da matriz)
  const groupedRulesBySubgroup = useMemo(() => {
    const rules = currentCategoryRules;
    const groups: { subgroup: string; rules: PreventiveGroupItem[] }[] = [];

    availableMaintenanceSubgroups.forEach(subgroup => {
      const targetNorm = normalizeSubgroupStr(subgroup);
      const matchingRules = rules.filter(r => {
        const rawGroup = r.SUBGRUPO ? r.SUBGRUPO : inferMaintenanceSubgroup(r.ITEM_NOME, r.SUBGRUPO);
        return normalizeSubgroupStr(rawGroup) === targetNorm;
      });
      if (matchingRules.length > 0) {
        groups.push({ subgroup, rules: matchingRules });
      }
    });

    // Itens que eventualmente não deram match em nenhum dos subgrupos conhecidos
    const matchedIds = new Set(groups.flatMap(g => g.rules.map(r => r.id)));
    const leftover = rules.filter(r => !matchedIds.has(r.id));
    if (leftover.length > 0) {
      leftover.forEach(item => {
        const rawGroup = (item.SUBGRUPO || 'OUTRO (PERSONALIZADO)').toUpperCase();
        const existing = groups.find(g => normalizeSubgroupStr(g.subgroup) === normalizeSubgroupStr(rawGroup));
        if (existing) {
          existing.rules.push(item);
        } else {
          groups.push({ subgroup: rawGroup, rules: [item] });
        }
      });
    }

    return groups.sort((a, b) => a.subgroup.localeCompare(b.subgroup, 'pt-BR'));
  }, [currentCategoryRules, availableMaintenanceSubgroups]);

  // Filtragem composta por subgrupo de manutenção (respeita exceção "TODOS OS SUBGRUPOS")
  const filteredGroupedRules = useMemo(() => {
    if (!filterSubgroup || filterSubgroup === 'TODOS' || filterSubgroup === 'TODOS OS SUBGRUPOS') {
      return groupedRulesBySubgroup;
    }
    const targetFilterNorm = normalizeSubgroupStr(filterSubgroup);
    return groupedRulesBySubgroup.filter(g => normalizeSubgroupStr(g.subgroup) === targetFilterNorm);
  }, [groupedRulesBySubgroup, filterSubgroup]);

  const filteredRulesCount = useMemo(() => {
    return filteredGroupedRules.reduce((acc, g) => acc + g.rules.length, 0);
  }, [filteredGroupedRules]);

  // Autocomplete real de produtos do almoxarifado buscando síncronamente na chave 'agrocontrol_produtos'
  const inventoryAutocompleteResults = useMemo(() => {
    if (!inventorySearchQuery.trim()) return [];
    const q = inventorySearchQuery.toLowerCase().trim();
    let currentStockList = inventoryList;
    try {
      const raw = localStorage.getItem('agrocontrol_produtos');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) currentStockList = parsed;
      }
    } catch {
      // fallback
    }
    return currentStockList.filter(item => {
      const anyItem = item as any;
      const name = String(anyItem.nome_comercial || item.name || '').toLowerCase();
      const code = String(item.code || anyItem.codigo || '').toLowerCase();
      const cat = String(anyItem.categoria || item.category || '').toLowerCase();
      return name.includes(q) || code.includes(q) || cat.includes(q);
    }).slice(0, 8);
  }, [inventorySearchQuery, inventoryList]);

  // Autocomplete real de produtos do almoxarifado (Edição Inline no Grid)
  const inlineAutocompleteResults = useMemo(() => {
    if (!inlineSearchQuery.trim()) return [];
    const q = inlineSearchQuery.toLowerCase().trim();
    return inventoryList.filter(item => {
      const anyItem = item as any;
      const name = String(anyItem.nome_comercial || item.name || '').toLowerCase();
      const code = String(item.code || anyItem.codigo || '').toLowerCase();
      const cat = String(anyItem.categoria || item.category || '').toLowerCase();
      return name.includes(q) || code.includes(q) || cat.includes(q);
    }).slice(0, 8);
  }, [inlineSearchQuery, inventoryList]);

  // Selecionar produto do autocomplete (Formulário Superior)
  const handleSelectInventoryItem = (item: InventoryItem) => {
    const anyItem = item as any;
    setSelectedInventoryItem(item);
    const resolvedName = (anyItem.nome_comercial || item.name || '').toUpperCase();
    setInventorySearchQuery(resolvedName);
    const resolvedUnit = (item.unit || anyItem.unidade_medida || 'UN').toUpperCase();
    setRuleUnit(resolvedUnit);
    // Sugere subgrupo automaticamente com base no nome do produto
    setRuleSubgroup(inferMaintenanceSubgroup(resolvedName));
    setIsInventoryDropdownOpen(false);
  };

  // Iniciar edição de uma regra existente (no formulário superior)
  const handleStartEditRule = (rule: PreventiveGroupItem) => {
    setEditingRuleId(rule.id);
    const resolvedSubgroup = (rule.SUBGRUPO as MaintenanceSubgroup) || inferMaintenanceSubgroup(rule.ITEM_NOME, rule.SUBGRUPO);
    setRuleSubgroup(resolvedSubgroup);
    setInventorySearchQuery(rule.ITEM_NOME);
    setRuleIntervalHoursKm(rule.INTERVALO_HORAS_KM);
    setRuleStandardQty(rule.QUANTIDADE_PADRAO);
    setRuleUnit(rule.unidade || 'UN');
    setRuleNotes(rule.observacoes || '');
    if (rule.PRODUTO_ID) {
      const linked = inventoryList.find(i => i.id === rule.PRODUTO_ID) || null;
      setSelectedInventoryItem(linked);
    } else {
      const linkedByName = inventoryList.find(i => ((i as any).nome_comercial || i.name || '').toUpperCase() === rule.ITEM_NOME.toUpperCase());
      setSelectedInventoryItem(linkedByName || null);
    }
    setIsInventoryDropdownOpen(false);
  };

  // Abertura do Modal de Cadastro Inteligente (+ CADASTRAR ITEM)
  const handleOpenCreateRuleModal = () => {
    setEditingRuleId(null);
    if (filterSubgroup && filterSubgroup !== 'TODOS OS SUBGRUPOS') {
      setRuleSubgroup(filterSubgroup);
    } else {
      setRuleSubgroup(availableMaintenanceSubgroups[0] || 'FILTROS');
    }
    setInventorySearchQuery('');
    setSelectedInventoryItem(null);
    setRuleIntervalHoursKm(250);
    setRuleStandardQty(1);
    setRuleUnit('UN');
    setRuleNotes('');
    setIsInventoryDropdownOpen(false);
    setIsItemModalOpen(true);
  };

  // Abertura do Modal para Edição da Regra
  const handleOpenEditRuleModal = (rule: PreventiveGroupItem) => {
    setEditingRuleId(rule.id);
    const resolvedSubgroup = rule.SUBGRUPO || inferMaintenanceSubgroup(rule.ITEM_NOME, rule.SUBGRUPO);
    setRuleSubgroup(resolvedSubgroup);
    setInventorySearchQuery((rule.PRODUTO_NOME_ESTOQUE || rule.ITEM_NOME).toUpperCase());
    setRuleIntervalHoursKm(rule.INTERVALO_HORAS_KM);
    setRuleStandardQty(rule.QUANTIDADE_PADRAO);
    setRuleUnit(rule.unidade || 'UN');
    setRuleNotes(rule.observacoes || '');
    if (rule.PRODUTO_ID) {
      const linked = inventoryList.find(i => i.id === rule.PRODUTO_ID) || null;
      if (linked) {
        setSelectedInventoryItem(linked);
      } else {
        setSelectedInventoryItem({
          id: rule.PRODUTO_ID,
          name: rule.PRODUTO_NOME_ESTOQUE || rule.ITEM_NOME,
          unitCost: rule.CUSTO_UNITARIO || 0,
          unit: rule.unidade || 'UN',
          quantity: 0
        } as any);
      }
    } else {
      setSelectedInventoryItem(null);
    }
    setIsInventoryDropdownOpen(false);
    setIsItemModalOpen(true);
  };

  // Cancelar edição no formulário ou fechar modal
  const handleCancelEditRule = () => {
    setEditingRuleId(null);
    setRuleSubgroup(availableMaintenanceSubgroups[0] || 'FILTROS');
    setInventorySearchQuery('');
    setSelectedInventoryItem(null);
    setRuleIntervalHoursKm(250);
    setRuleStandardQty(1);
    setRuleUnit('UN');
    setRuleNotes('');
    setIsInventoryDropdownOpen(false);
    setIsItemModalOpen(false);
  };

  // Iniciar Edição Direta Inline no Grid
  const handleStartInlineEdit = (rule: PreventiveGroupItem) => {
    setInlineEditingRuleId(rule.id);
    const resolvedSubgroup = (rule.SUBGRUPO as MaintenanceSubgroup) || inferMaintenanceSubgroup(rule.ITEM_NOME, rule.SUBGRUPO);
    setInlineSubgroup(resolvedSubgroup);
    setInlineSearchQuery(rule.ITEM_NOME);
    setInlineInterval(rule.INTERVALO_HORAS_KM);
    setInlineQty(rule.QUANTIDADE_PADRAO);
    setInlineUnit(rule.unidade || 'UN');
    if (rule.PRODUTO_ID) {
      const linked = inventoryList.find(i => i.id === rule.PRODUTO_ID) || null;
      setInlineSelectedProduct(linked);
    } else {
      const linkedByName = inventoryList.find(i => ((i as any).nome_comercial || i.name || '').toUpperCase() === rule.ITEM_NOME.toUpperCase());
      setInlineSelectedProduct(linkedByName || null);
    }
    setInlineDropdownOpen(false);
  };

  // Selecionar produto no Autocomplete Inline do Grid
  const handleSelectInlineProduct = (item: InventoryItem) => {
    const anyItem = item as any;
    setInlineSelectedProduct(item);
    const resolvedName = (anyItem.nome_comercial || item.name || '').toUpperCase();
    setInlineSearchQuery(resolvedName);
    const resolvedUnit = (item.unit || anyItem.unidade_medida || 'UN').toUpperCase();
    setInlineUnit(resolvedUnit);
    setInlineSubgroup(inferMaintenanceSubgroup(resolvedName));
    setInlineDropdownOpen(false);
  };

  // Cancelar Edição Inline do Grid
  const handleCancelInlineEdit = () => {
    setInlineEditingRuleId(null);
    setInlineSearchQuery('');
    setInlineSelectedProduct(null);
    setInlineDropdownOpen(false);
  };

  // Salvar Edição Inline do Grid diretamente na regra
  const handleSaveInlineEdit = (ruleId: string) => {
    const itemName = inlineSearchQuery.trim().toUpperCase();
    if (!itemName) {
      setPreventiveFeedback({ type: 'info', message: 'INFORME O NOME DO INSUMO OU SELECIONE UM PRODUTO DO ALMOXARIFADO.' });
      setTimeout(() => setPreventiveFeedback(null), 3000);
      return;
    }
    const interval = typeof inlineInterval === 'number' && inlineInterval > 0 ? inlineInterval : 250;
    const qty = typeof inlineQty === 'number' && inlineQty > 0 ? inlineQty : 1;
    const unit = (inlineSelectedProduct?.unit || (inlineSelectedProduct as any)?.unidade_medida || inlineUnit || 'UN').toUpperCase();

    const upperCat = selectedGroupCategory.toUpperCase();
    const currentRules = currentCategoryRules;
    const updatedRules = currentRules.map(r => r.id === ruleId ? {
      ...r,
      CATEGORIA: upperCat,
      SUBGRUPO: inlineSubgroup,
      PRODUTO_ID: inlineSelectedProduct?.id || r.PRODUTO_ID,
      ITEM_NOME: itemName,
      INTERVALO_HORAS_KM: interval,
      QUANTIDADE_PADRAO: qty,
      unidade: unit,
    } : r);

    const updatedPlans = {
      ...preventivePlans,
      [upperCat]: updatedRules,
    };
    setPreventivePlans(updatedPlans);
    saveStoredPreventiveGroupPlans(updatedPlans);

    handleCancelInlineEdit();
    setPreventiveFeedback({
      type: 'success',
      message: `VÍNCULO E REGRAS ATUALIZADOS COM SUCESSO NO GRUPO ${upperCat}!`
    });
    setTimeout(() => setPreventiveFeedback(null), 3000);
  };

  // Salvar / Adicionar regra na matriz da categoria ativa
  const handleSavePreventiveRule = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const itemName = inventorySearchQuery.trim().toUpperCase();
    if (!itemName) {
      setPreventiveFeedback({ type: 'info', message: 'INFORME O NOME DO INSUMO OU SELECIONE UM PRODUTO DO ALMOXARIFADO.' });
      setTimeout(() => setPreventiveFeedback(null), 3000);
      return;
    }
    const interval = typeof ruleIntervalHoursKm === 'number' && ruleIntervalHoursKm > 0 ? ruleIntervalHoursKm : 250;
    const qty = typeof ruleStandardQty === 'number' && ruleStandardQty > 0 ? ruleStandardQty : 1;
    const unit = (selectedInventoryItem?.unit || (selectedInventoryItem as any)?.unidade_medida || ruleUnit || 'UN').toUpperCase();

    const selectedAny = selectedInventoryItem as any;
    const selectedProdId = selectedInventoryItem?.id;
    const selectedProdNome = selectedInventoryItem
      ? String(selectedAny?.nome_comercial || selectedInventoryItem.name || itemName).toUpperCase()
      : undefined;
    const selectedProdCusto = selectedInventoryItem
      ? Number(selectedAny?.unitPrice || selectedInventoryItem.unitCost || selectedAny?.preco_custo || selectedAny?.custo_unitario || selectedAny?.valor_unitario || 0)
      : undefined;

    const upperCat = selectedGroupCategory.toUpperCase();
    const currentRules = currentCategoryRules;
    let updatedRules: PreventiveGroupItem[];

    if (editingRuleId) {
      updatedRules = currentRules.map(r => {
        if (r.id === editingRuleId) {
          const finalProdId = selectedProdId !== undefined ? selectedProdId : r.PRODUTO_ID;
          const finalProdNome = selectedProdNome !== undefined ? selectedProdNome : r.PRODUTO_NOME_ESTOQUE;
          const finalCusto = selectedProdCusto !== undefined ? selectedProdCusto : r.CUSTO_UNITARIO;

          return {
            ...r,
            CATEGORIA: upperCat,
            SUBGRUPO: ruleSubgroup,
            ITEM_NOME: itemName,
            PRODUTO_ID: finalProdId,
            PRODUTO_NOME_ESTOQUE: finalProdNome,
            CUSTO_UNITARIO: finalCusto,
            INTERVALO_HORAS_KM: interval,
            QUANTIDADE_PADRAO: qty,
            unidade: unit,
            observacoes: ruleNotes.trim() || undefined,
          };
        }
        return r;
      });
    } else {
      const newRule: PreventiveGroupItem = {
        id: `prev_${upperCat.toLowerCase().slice(0, 4)}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        CATEGORIA: upperCat,
        SUBGRUPO: ruleSubgroup,
        PRODUTO_ID: selectedProdId,
        PRODUTO_NOME_ESTOQUE: selectedProdNome,
        CUSTO_UNITARIO: selectedProdCusto,
        ITEM_NOME: itemName,
        INTERVALO_HORAS_KM: interval,
        QUANTIDADE_PADRAO: qty,
        unidade: unit,
        observacoes: ruleNotes.trim() || undefined,
      };
      updatedRules = [...currentRules, newRule];
    }

    const updatedPlans = {
      ...preventivePlans,
      [upperCat]: updatedRules,
    };
    setPreventivePlans(updatedPlans);
    saveStoredPreventiveGroupPlans(updatedPlans);

    handleCancelEditRule();
    setIsItemModalOpen(false);
    setPreventiveFeedback({
      type: 'success',
      message: `REGRA "${itemName}" SALVA COM SUCESSO NO GRUPO ${upperCat}!`
    });
    setTimeout(() => setPreventiveFeedback(null), 3500);
  };

  // Excluir regra
  const handleDeletePreventiveRule = (ruleId: string) => {
    const upperCat = selectedGroupCategory.toUpperCase();
    const updatedRules = currentCategoryRules.filter(r => r.id !== ruleId);
    const updatedPlans = {
      ...preventivePlans,
      [upperCat]: updatedRules,
    };
    setPreventivePlans(updatedPlans);
    saveStoredPreventiveGroupPlans(updatedPlans);
    setPreventiveFeedback({
      type: 'success',
      message: `ITEM REMOVIDO DO GRUPO ${upperCat}.`
    });
    setTimeout(() => setPreventiveFeedback(null), 3000);
  };


  // Filter machineries
  const availableCategories = useMemo(() => {
    const fromStorage = getStoredVehicleSystemCategories();
    const fromMachines = (machineries || []).filter(Boolean).map(m => m.categoryType).filter(Boolean) as string[];
    const set = new Set([...fromStorage, ...fromMachines]);
    return Array.from(set);
  }, [machineries]);

  const availableRegimes = useMemo(() => {
    const fromStorage = getStoredVehicleOwnershipRegimes();
    const fromMachines = (machineries || []).filter(Boolean).map(m => m.ownership).filter(Boolean) as string[];
    const set = new Set([
      ...fromStorage,
      ...fromMachines.map(o => {
        if (!o) return 'Próprio';
        const oLower = String(o).toLowerCase();
        if (oLower === 'proprio' || oLower.includes('próprio')) return 'Próprio';
        if (oLower === 'terceirizado' || oLower.includes('terceir')) return 'De Terceiros';
        if (oLower === 'alugado' || oLower.includes('alug')) return 'Alugado / Locação';
        if (oLower === 'arrendado' || oLower.includes('arrend')) return 'Arrendado / Financiado';
        return String(o);
      })
    ]);
    return Array.from(set);
  }, [machineries]);

  const getOwnershipBadge = (ownership?: string) => {
    const own = String(ownership || 'Próprio');
    const ownLower = own.toLowerCase();
    
    if (ownLower === 'proprio' || ownLower.includes('próprio') || ownLower.includes('proprio')) {
      return {
        label: ownLower === 'proprio' ? 'Próprio' : own,
        className: 'bg-emerald-50 text-[#000000] dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
      };
    }
    if (ownLower === 'terceirizado' || ownLower.includes('terceir')) {
      return {
        label: ownLower === 'terceirizado' ? 'De Terceiros' : own,
        className: 'bg-amber-50 text-[#000000] dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
      };
    }
    if (ownLower === 'alugado' || ownLower.includes('alug') || ownLower.includes('locaç') || ownLower.includes('locac')) {
      return {
        label: ownLower === 'alugado' ? 'Alugado' : own,
        className: 'bg-blue-50 text-[#000000] dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800'
      };
    }
    if (ownLower === 'arrendado' || ownLower.includes('arrend') || ownLower.includes('financ')) {
      return {
        label: ownLower === 'arrendado' ? 'Arrendado' : own,
        className: 'bg-purple-50 text-[#000000] dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300 dark:border-purple-800'
      };
    }
    return {
      label: own,
      className: 'bg-stone-100 text-[#000000] dark:bg-stone-800 dark:text-stone-300 border border-stone-300 dark:border-stone-700'
    };
  };

  // Helper para identificar a Categoria do Veículo e formatar a tag visual verde/destaque
  const getVehicleCategoryTag = (vehicle: Machinery) => {
    if (!vehicle) {
      return {
        label: 'NÃO DEFINIDO',
        style: 'bg-emerald-100 text-emerald-950 dark:bg-emerald-950/70 dark:text-emerald-200 border-emerald-300/90 dark:border-emerald-700'
      };
    }

    // Leitura dinâmica prioritária da propriedade real vinda do LocalStorage (conforme especificação estrita: {veiculo.categoriaVeiculo || veiculo.categoria || 'NÃO DEFINIDO'})
    const directCat = (vehicle as any).categoriaVeiculo || (vehicle as any).categoria;
    let label = 'NÃO DEFINIDO';

    if (directCat && typeof directCat === 'string' && directCat.trim()) {
      const trimmed = directCat.trim();
      const isAkt = Boolean(
        (vehicle.licensePlateOrSerial && vehicle.licensePlateOrSerial.toUpperCase().includes('AKT')) ||
        (vehicle.model && vehicle.model.toUpperCase().includes('AKT'))
      );
      if (isAkt && trimmed.toUpperCase().includes('CAÇAMBA')) {
        label = 'TRAÇÃO CAMINHÃO TRATOR (CAVALO)';
      } else {
        label = trimmed.toUpperCase();
      }
    } else {
      const rawCategory = (
        vehicle.categoryType ||
        (vehicle as any).categoria_veiculo ||
        (vehicle as any).category_type ||
        (vehicle as any).category ||
        vehicle.tipo ||
        ''
      );
      const lower = String(rawCategory).trim().toLowerCase();
      if (lower === 'cavalo' || vehicle.compositionType === 'cavalo' || (vehicle.licensePlateOrSerial && vehicle.licensePlateOrSerial.toUpperCase().includes('AKT')) || (vehicle.model && vehicle.model.toUpperCase().includes('AKT'))) {
        label = 'TRAÇÃO CAMINHÃO TRATOR (CAVALO)';
      } else if (lower === 'forrageira' || lower === 'ensiladeira' || (vehicle.model && vehicle.model.toUpperCase().includes('JAGUAR')) || (vehicle.name && vehicle.name.toUpperCase().includes('JAGUAR'))) {
        label = 'ENSILADEIRA AUTOPROPELIDA';
      } else if (lower === 'caminhao' || lower === 'caminhão') {
        label = 'CAMINHÃO (BASCULANTE / GRANELEIRO)';
      } else if (lower === 'trator') {
        label = 'TRATOR AGRÍCOLA';
      } else if (lower === 'reboque') {
        label = 'REBOQUE';
      } else if (lower === 'utilitario') {
        label = 'VEÍCULO UTILITÁRIO / APOIO';
      } else if (lower === 'onibus') {
        label = 'ÔNIBUS / VAN DE EQUIPE';
      } else if (lower === 'implemento') {
        label = 'IMPLEMENTO';
      } else if (rawCategory && typeof rawCategory === 'string' && rawCategory.trim() && lower !== 'veiculo') {
        label = rawCategory.trim().toUpperCase();
      } else if (vehicle.vehicleTypeDetailed) {
        label = String(vehicle.vehicleTypeDetailed).trim().toUpperCase();
      } else if (vehicle.trailerType) {
        label = `REBOQUE ${String(vehicle.trailerType).trim().toUpperCase()}`;
      }
    }

    return {
      label,
      style: 'bg-emerald-100 text-emerald-950 dark:bg-emerald-950/70 dark:text-emerald-200 border-emerald-300/90 dark:border-emerald-700'
    };
  };

  const filteredVehicles = useMemo(() => {
    const list = Array.isArray(machineries) ? machineries : [];
    const term = (searchTerm || '').trim().toLowerCase();

    return list.filter((m) => {
      if (!m) return false;

      const mName = String(m.name || '').toLowerCase();
      const mModel = String(m.model || '').toLowerCase();
      const mFleet = String(m.fleetNumber || '').toLowerCase();
      const mPlate = String(m.licensePlateOrSerial || '').toLowerCase();
      const mSerial = String(m.serialNumber || '').toLowerCase();
      const mCategory = String(m.categoryType || '').toLowerCase();
      const mDriver = String(m.operatorOrDriver || '').toLowerCase();
      const mRenavam = String(m.renavam || '').toLowerCase();
      const mBrand = String(m.brand || '').toLowerCase();
      const mOwner = String(m.ownerName || '').toLowerCase();
      const mDoc = String(m.ownerDocument || '').toLowerCase();
      const mDetailed = String(m.vehicleTypeDetailed || '').toLowerCase();

      const matchSearch =
        !term ||
        mName.includes(term) ||
        mModel.includes(term) ||
        mFleet.includes(term) ||
        mPlate.includes(term) ||
        mSerial.includes(term) ||
        mCategory.includes(term) ||
        mDriver.includes(term) ||
        mRenavam.includes(term) ||
        mBrand.includes(term) ||
        mOwner.includes(term) ||
        mDoc.includes(term) ||
        mDetailed.includes(term);

      const catLower = String(m.categoryType || '').toLowerCase();
      const selLower = String(selectedCategory || 'todos').toLowerCase();
      const matchCategory =
        selectedCategory === 'todos' ||
        m.categoryType === selectedCategory ||
        catLower === selLower ||
        (selectedCategory === 'caminhao' && (catLower.includes('caminh') || catLower === 'caminhao')) ||
        (selectedCategory === 'ensiladeira' && (catLower.includes('ensilad') || catLower.includes('forrageir') || catLower.includes('colhedor') || catLower === 'ensiladeira' || catLower === 'forrageira')) ||
        (selectedCategory === 'trator' && (catLower.includes('trator') || catLower === 'trator')) ||
        (selectedCategory === 'pa_carregadeira' && (catLower.includes('carregadeira') || catLower.includes('esteira'))) ||
        (selectedCategory === 'camionete' && (catLower.includes('camionete') || catLower.includes('utilit') || catLower.includes('picape'))) ||
        (selectedCategory === 'reboque' && (catLower.includes('reboque') || catLower.includes('carreta') || catLower.includes('transbordo') || m.compositionType === 'reboque')) ||
        (selectedCategory === 'onibus' && (catLower.includes('onibus') || catLower.includes('ônibus') || catLower.includes('van')));
      const matchStatus = selectedStatus === 'todos' || m.status === selectedStatus;
      
      const ownLower = String(m.ownership || 'próprio').toLowerCase();
      const selOwnLower = String(selectedOwnership || 'todos').toLowerCase();
      const matchOwnership = 
        selectedOwnership === 'todos' || 
        m.ownership === selectedOwnership ||
        ownLower === selOwnLower ||
        (selOwnLower.includes('próprio') && (ownLower === 'proprio' || ownLower.includes('proprio') || !m.ownership)) ||
        (selOwnLower.includes('terceir') && (ownLower === 'terceirizado' || ownLower.includes('terceir'))) ||
        (selOwnLower.includes('alug') && (ownLower === 'alugado' || ownLower.includes('alug'))) ||
        (selOwnLower.includes('arrend') && (ownLower === 'arrendado' || ownLower.includes('arrend')));

      // FILTRO SEGURO 100% LOCAL (REACT MEMORY) PARA "TODAS COMPOSIÇÕES"
      // Não injeta nenhum parâmetro na requisição do Supabase
      const isReboqueItem = 
        m.compositionType === 'reboque' ||
        catLower.includes('reboque') ||
        catLower.includes('carreta') ||
        catLower.includes('transbordo') ||
        catLower.includes('implemento');

      const isCavaloItem = 
        m.compositionType === 'cavalo' || 
        m.hasCoupledTrailer === true ||
        Boolean(m.coupledTrailerId || m.reboque_vinculado_id || m.trailerPlate);

      const matchComposition = 
        selectedComposition === 'todos' ||
        (selectedComposition === 'cavalo' && isCavaloItem) ||
        (selectedComposition === 'reboque' && isReboqueItem) ||
        (selectedComposition === 'veiculo_simples' && !isCavaloItem && !isReboqueItem);

      return matchSearch && matchCategory && matchStatus && matchOwnership && matchComposition;
    });
  }, [machineries, searchTerm, selectedCategory, selectedStatus, selectedOwnership, selectedComposition]);

  const getVehicleTotalFuel = (machId: string) => {
    return fuelLogs
      .filter((f) => f.machineryId === machId)
      .reduce((sum, f) => sum + (f.totalAmount || 0), 0);
  };

  const getVehicleTotalMaintenance = (machId: string) => {
    return maintenanceLogs
      .filter((m) => m.machineryId === machId)
      .reduce((sum, m) => sum + (m.totalCost || 0), 0);
  };

  const formatCurrencyBRL = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Open Print Modal Handler
  const handleOpenPrint = () => {
    const activeCompany = companyProfile || getStoredCompanyProfile();

    const filterParts: string[] = [];
    if (selectedCategory && selectedCategory !== 'todos') {
      filterParts.push(`Categoria: ${selectedCategory}`);
    }
    if (selectedStatus && selectedStatus !== 'todos') {
      filterParts.push(`Status: ${selectedStatus}`);
    }
    if (searchTerm) {
      filterParts.push(`Busca: "${searchTerm}"`);
    }
    const filterSub = filterParts.length > 0 ? ` • ${filterParts.join(' | ')}` : '';

    const html = generateFleetListHtml(filteredVehicles, activeCompany, {
      category: selectedCategory,
      status: selectedStatus,
      search: searchTerm,
    });
    const waText = generateFleetWhatsAppText(filteredVehicles, activeCompany);

    setPrintOptions({
      title: 'RELATÓRIO EXECUTIVO DA FROTA & VEÍCULOS',
      subtitle: `Listagem com Detalhamento Cadastral, Pesos e Medidores (${filteredVehicles.length} unidades)${filterSub}`,
      company: activeCompany,
      contentHtml: html,
      orientation: 'landscape',
      showSignatures: true,
      signatureLabels: ['Gestão de Frotas & Logística', 'Diretoria / Gerência Geral'],
      whatsappText: waText,
    });
    setIsPrintModalOpen(true);
  };

  const onSaveMachineriesRef = React.useRef(onSaveMachineries);
  onSaveMachineriesRef.current = onSaveMachineries;

  // Fallback e restauração resiliente imediata de veículos se a lista estiver zerada
  React.useEffect(() => {
    if ((!machineries || machineries.length === 0) && onSaveMachineriesRef.current) {
      try {
        const stored = getStoredMachineries();
        if (stored && Array.isArray(stored) && stored.length > 0) {
          onSaveMachineriesRef.current(stored);
        }
      } catch (err) {
        console.warn('Aviso discreto ao restaurar frota do cache local:', err);
      }
    }
  }, [machineries?.length]);

  // Controle para evitar loops infinitos de requisição:
  // Só dispara a busca de dados (.select()) uma única vez ao carregar a página ou quando o ID do assinante mudar
  const lastFetchedSubscriberIdRef = React.useRef<string | null>(null);
  const isFetchingVehiclesRef = React.useRef<boolean>(false);

  // Sincronização em tempo real de frotas (multi-dispositivos) escutando 'veiculos_maquinas'
  React.useEffect(() => {
    if (!isSupabaseConfigured) return;

    let isMounted = true;
    let debounceTimer: any = null;

    const debouncedSync = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        try {
          const fresh = await fetchGestaoFrotas(companyProfile?.id);
          // EVITAR TRAVAMENTO DE TELA E SUMIÇO DA TABELA:
          // Apenas atualiza o estado se fresh trouxer registros válidos.
          // Se o banco retornar vazio ou erro, mantém os dados anteriores carregados.
          if (isMounted && fresh && Array.isArray(fresh) && fresh.length > 0 && onSaveMachineriesRef.current) {
            onSaveMachineriesRef.current(fresh);
          }
        } catch (err) {
          console.warn('Aviso seguro: sincronização de frotas manteve dados locais:', err);
        }
      }, 500);
    };

    // 3. EVITAR REQUISIÇÕES EM LOOP:
    // Dispara a busca principal no Supabase (.select()) estritamente UMA ÚNICA VEZ
    // ao carregar o componente ou quando o ID do assinante / company_id realmente mudar
    const currentSubscriberId = companyProfile?.id || '__default__';
    if (lastFetchedSubscriberIdRef.current !== currentSubscriberId && !isFetchingVehiclesRef.current) {
      lastFetchedSubscriberIdRef.current = currentSubscriberId;
      isFetchingVehiclesRef.current = true;

      fetchGestaoFrotas(companyProfile?.id)
        .then(fresh => {
          isFetchingVehiclesRef.current = false;
          if (isMounted && fresh && Array.isArray(fresh) && fresh.length > 0 && onSaveMachineriesRef.current) {
            onSaveMachineriesRef.current(fresh);
          }
        })
        .catch(err => {
          isFetchingVehiclesRef.current = false;
          console.warn('Aviso discreto: mantendo frotas anteriores após erro no Supabase:', err);
        });
    }

    const channelId = `fleet_vehicles_rt_${companyProfile?.id || 'all'}`;
    const existingChannels = supabase.getChannels?.() || [];
    for (const ch of existingChannels) {
      if (ch.topic === channelId || ch.topic === `realtime:${channelId}`) {
        try { supabase.removeChannel(ch); } catch (_) {}
      }
    }

    // 1. Conexão Realtime ouvindo tabela correta 'veiculos_maquinas'
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'veiculos_maquinas' },
        () => {
          debouncedSync();
        }
      )
      .subscribe();

    const handleForceSync = () => {
      debouncedSync();
    };
    window.addEventListener('silagem_force_rest_sync', handleForceSync);

    // 2. TRAVA DE SEGURANÇA CONTRA CONSUMO EM SEGUNDO PLANO (CLEANUP FUNCTION):
    // Fecha a conexão do canal Realtime imediatamente assim que o usuário mudar de aba ou desmontar
    return () => {
      isMounted = false;
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener('silagem_force_rest_sync', handleForceSync);
      try {
        supabase.removeChannel(channel); // Desliga a tomada ao sair da aba
      } catch (_) {}
    };
  }, [companyProfile?.id]);

  // Automated Meter Synchronization Handler via direct HTTP REST
  const handleSyncMeters = async () => {
    setIsSyncing(true);
    setSyncBanner({
      type: 'info',
      message: 'Consultando banco de dados via REST para sincronizar leituras e frotas...'
    });

    try {
      let currentMachines = [...machineries];
      let currentFuel = [...fuelLogs];

      // 1. Busca forçada via REST das tabelas no Supabase
      if (isSupabaseConfigured) {
        try {
          const [remoteMachines, remoteFuel] = await Promise.all([
            fetchGestaoFrotas(companyProfile?.id),
            fetchCloudFuelLogs(companyProfile?.id)
          ]);

          if (remoteMachines && remoteMachines.length > 0) {
            const remoteMap = new Map(remoteMachines.map(m => [m.id, m]));
            currentMachines = currentMachines.map(local => {
              const remote = remoteMap.get(local.id);
              if (remote) {
                remoteMap.delete(local.id);
                return {
                  ...local,
                  ...remote,
                  hourMeter: Math.max(local.hourMeter || 0, remote.hourMeter || 0),
                  currentKm: Math.max(local.currentKm || 0, remote.currentKm || 0),
                  horimetro_ou_km_atual: Math.max(local.horimetro_ou_km_atual || 0, remote.horimetro_ou_km_atual || 0),
                };
              }
              return local;
            });
            for (const [, rm] of remoteMap) {
              currentMachines.push(rm);
            }
          }

          if (remoteFuel && Array.isArray(remoteFuel) && remoteFuel.length > 0) {
            const fuelMap = new Map(currentFuel.map(f => [f.id, f]));
            remoteFuel.forEach(f => fuelMap.set(f.id, f));
            currentFuel = Array.from(fuelMap.values());
          }
        } catch (fetchErr) {
          console.warn('Aviso ao consultar Supabase via REST:', fetchErr);
        }
      }

      // 2. Calcula os odômetros/horímetros com base nas leituras dos abastecimentos, ordens e manutenções
      const { updatedMachineries, updatedCount } = syncFleetMeters(
        currentMachines,
        currentFuel,
        maintenanceLogs,
        services,
        orders
      );

      // 3. Atualiza estado e banco de dados via PATCH com apenas colunas numéricas válidas
      if (onSaveMachineries) {
        onSaveMachineries(updatedMachineries);
      }

      // 3.1 Dispara PATCH direto com apenas as colunas numéricas válidas no Supabase
      if (isSupabaseConfigured && updatedCount > 0) {
        const patchPromises = updatedMachineries.map(m => {
          const isByKm = m.controlBy === 'km' || m.controla_por === 'km';
          const meterNum = isByKm ? (m.currentKm || 0) : (m.hourMeter || 0);
          return patchGestaoFrotaMeter(m.id, meterNum, companyProfile?.id);
        });
        await Promise.allSettled(patchPromises);
      }

      // 4. Notifica o restante da aplicação para recarregar módulos via REST
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('silagem_force_rest_sync'));
      }

      if (updatedCount > 0) {
        setSyncBanner({
          type: 'success',
          message: `Sincronização via REST concluída! ${updatedCount} veículo(s) tiveram suas leituras atualizadas com sucesso a partir do banco de dados.`
        });
      } else {
        setSyncBanner({
          type: 'success',
          message: `Sincronização via REST com o Supabase concluída! Todas as leituras e ${updatedMachineries.length} veículos estão 100% atualizados.`
        });
      }
    } catch (err: any) {
      console.error('Erro na sincronização de leituras:', err);
      setSyncBanner({
        type: 'info',
        message: 'Sincronização local concluída. Verifique a conectividade de rede.'
      });
    } finally {
      setIsSyncing(false);
      setTimeout(() => {
        setSyncBanner(null);
      }, 7000);
    }
  };

  // Quick Meter Reading Handler
  const handleOpenQuickMeter = (vehicle: Machinery) => {
    setQuickMeterVehicle(vehicle);
    setQuickHourMeter(vehicle.hourMeter ? String(vehicle.hourMeter) : '');
    setQuickKm(vehicle.currentKm ? String(vehicle.currentKm) : '');
    setQuickMeterFeedback(null);
  };

  const handleSaveQuickMeter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickMeterVehicle) return;

    const parsedHour = quickHourMeter.trim() ? parseFloat(quickHourMeter.replace(',', '.')) : (quickMeterVehicle.hourMeter || 0);
    const parsedKm = quickKm.trim() ? parseFloat(quickKm.replace(',', '.')) : (quickMeterVehicle.currentKm || 0);

    const safeHour = isNaN(parsedHour) ? 0 : Math.max(0, parsedHour);
    const safeKm = isNaN(parsedKm) ? 0 : Math.max(0, parsedKm);

    const isByKm = quickMeterVehicle.controlBy === 'km' || quickMeterVehicle.controla_por === 'km';
    const effectiveMeter = isByKm ? safeKm : safeHour;

    const updatedVehicle: Machinery = {
      ...quickMeterVehicle,
      hourMeter: safeHour,
      currentKm: safeKm,
      horimetro_ou_km_atual: effectiveMeter,
    };

    // 1. Atualiza lista de máquinas no estado
    if (onSaveMachineries) {
      const updatedMachineries = machineries.map(m => m.id === quickMeterVehicle.id ? updatedVehicle : m);
      onSaveMachineries(updatedMachineries);
    }

    // 2. Dispara PATCH limpo no Supabase com apenas a coluna numérica horimetro_ou_km_atual
    try {
      await patchGestaoFrotaMeter(quickMeterVehicle.id, effectiveMeter, companyProfile?.id);
    } catch (patchErr) {
      console.warn('Aviso ao atualizar leitura do veículo via PATCH:', patchErr);
    }

    setQuickMeterFeedback('✅ Leitura atualizada com sucesso!');
    setTimeout(() => {
      setQuickMeterVehicle(null);
      setQuickMeterFeedback(null);
    }, 1200);
  };

  return (
    <div className="w-full h-full flex flex-col min-h-0 overflow-hidden space-y-2">

      {/* Sub-abas de Navegação: VEÍCULOS & MÁQUINAS | TIPOS DE TROCAS (100% Fixo / Âncora) */}
      <div className="shrink-0 flex items-center justify-between flex-wrap gap-2 pb-1 border-b border-stone-200 dark:border-stone-800">
        <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-2xs">
          <button
            type="button"
            id="subtab-btn-veiculos"
            onClick={() => setVehicleSubTab('frota')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-2 transition cursor-pointer select-none ${
              vehicleSubTab === 'frota'
                ? 'bg-[#0963cb] text-white shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>VEÍCULOS & MÁQUINAS</span>
            <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
              vehicleSubTab === 'frota' ? 'bg-white/20 text-white' : 'bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
            }`}>
              {machineries.length}
            </span>
          </button>

          <button
            type="button"
            id="subtab-btn-tipos-trocas"
            onClick={() => setVehicleSubTab('tipos_trocas')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-2 transition cursor-pointer select-none ${
              vehicleSubTab === 'tipos_trocas'
                ? 'bg-[#0963cb] text-white shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800'
            }`}
          >
            <Wrench className="w-3.5 h-3.5 text-amber-500" />
            <span>CADASTRO REVISÕES PERIÓDICAS</span>
            <span className={`px-1.5 py-0.2 rounded text-[9.5px] font-black ${
              vehicleSubTab === 'tipos_trocas'
                ? 'bg-emerald-400 text-emerald-950'
                : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
            }`}>
              REGRAS DO GRUPO
            </span>
          </button>
        </div>

        {vehicleSubTab === 'frota' && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setVehicleSubTab('tipos_trocas')}
              className="px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 hover:bg-amber-100 text-xs font-bold uppercase transition flex items-center space-x-1.5 cursor-pointer shadow-2xs"
              title="Configurar matriz de manutenção preventiva para cada grupo de veículos"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-600" />
              <span>CONFIGURAR REGRAS DO GRUPO</span>
            </button>
          </div>
        )}
      </div>

      {vehicleSubTab === 'tipos_trocas' ? (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden space-y-2 animate-in fade-in duration-200">
          
          {/* Feedback Banner */}
          {preventiveFeedback && (
            <div className={`shrink-0 p-2.5 rounded-xl flex items-center justify-between border transition-all ${
              preventiveFeedback.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 text-emerald-900 dark:text-emerald-200'
                : 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 text-blue-900 dark:text-blue-200'
            }`}>
              <div className="flex items-center space-x-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <p className="text-xs font-black uppercase tracking-wider">{preventiveFeedback.message}</p>
              </div>
              <button onClick={() => setPreventiveFeedback(null)} className="p-1 hover:bg-black/5 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Barra de Filtros Superior (SLIM DESIGN PRO) */}
          <div className="flex items-end gap-3 w-full bg-slate-50 dark:bg-stone-900 p-3 border border-slate-300 dark:border-stone-800 rounded-lg shadow-sm shrink-0">
            
            {/* Div do Select: SELECIONE A CATEGORIA (com botão de engrenagem nativo) */}
            <div className="flex flex-col gap-1">
              <label 
                htmlFor="filter-group-category" 
                className="text-[11px] font-bold text-slate-600 dark:text-stone-400 uppercase leading-none"
              >
                SELECIONE A CATEGORIA
              </label>
              <div className="flex items-center gap-1">
                <select
                  id="filter-group-category"
                  value={selectedGroupCategory.toUpperCase()}
                  onChange={(e) => {
                    setSelectedGroupCategory(e.target.value.toUpperCase());
                    handleCancelEditRule();
                  }}
                  className="h-[34px] bg-white dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded px-2 text-xs font-bold uppercase focus:outline-none min-w-[200px] sm:min-w-[240px] text-stone-800 dark:text-stone-200 cursor-pointer shadow-2xs"
                >
                  {availableGroupCategories.map((cat) => (
                    <option key={cat} value={cat.toUpperCase()} className="uppercase">
                      {cat.toUpperCase()}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  id="btn-gerenciar-categorias-preventivo"
                  onClick={() => setIsCategoriesModalOpen(true)}
                  className="h-[34px] w-[34px] flex items-center justify-center bg-slate-200 hover:bg-slate-300 dark:bg-stone-800 dark:hover:bg-stone-700 border border-slate-400 dark:border-stone-600 rounded text-slate-700 dark:text-stone-200 transition-colors shadow-sm cursor-pointer shrink-0"
                  title="EDITAR LISTA DE CATEGORIAS"
                >
                  <Settings className="w-4 h-4 text-slate-700 dark:text-stone-300" />
                </button>
              </div>
            </div>

            {/* Div do Select: SUBGRUPO DE MANUTENÇÃO (com botão de engrenagem nativo) */}
            <div className="flex flex-col gap-1">
              <label 
                htmlFor="filter-maintenance-subgroup" 
                className="text-[11px] font-bold text-slate-600 dark:text-stone-400 uppercase leading-none"
              >
                SUBGRUPO DE MANUTENÇÃO
              </label>
              <div className="flex items-center gap-1">
                <select
                  id="filter-maintenance-subgroup"
                  value={filterSubgroup}
                  onChange={(e) => setFilterSubgroup(e.target.value)}
                  className="h-[34px] bg-white dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded px-2 text-xs font-bold uppercase focus:outline-none min-w-[200px] sm:min-w-[240px] text-stone-800 dark:text-stone-200 cursor-pointer shadow-2xs"
                >
                  <option value="TODOS OS SUBGRUPOS">TODOS OS SUBGRUPOS</option>
                  {availableMaintenanceSubgroups.map((sg) => (
                    <option key={sg} value={sg} className="uppercase">
                      {sg}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  id="btn-gerenciar-subgrupos-preventivo"
                  onClick={() => setIsMaintenanceCategoriesModalOpen(true)}
                  className="h-[34px] w-[34px] flex items-center justify-center bg-slate-200 hover:bg-slate-300 dark:bg-stone-800 dark:hover:bg-stone-700 border border-slate-400 dark:border-stone-600 rounded text-slate-700 dark:text-stone-200 transition-colors shadow-sm cursor-pointer shrink-0"
                  title="GERENCIAR LISTA DE SUBGRUPOS"
                >
                  <Settings className="w-4 h-4 text-slate-700 dark:text-stone-300" />
                </button>
              </div>
            </div>

            {/* Botão Mestre Verde: + CADASTRAR ITEM (h-[34px] self-end) */}
            <button
              type="button"
              id="btn-cadastrar-item-plano"
              onClick={handleOpenCreateRuleModal}
              className="h-[34px] self-end bg-[#059669] hover:bg-emerald-700 text-white font-bold px-4 text-xs rounded transition-colors tracking-wider shadow flex items-center justify-center gap-1 cursor-pointer select-none whitespace-nowrap uppercase"
              title="Cadastrar novo item no plano preventivo deste grupo"
            >
              + CADASTRAR ITEM
            </button>

          </div>

          {/* Card Mestre de Parametrização para a Categoria Selecionada (100% Fixo com Grid Rolável Interno) */}
          <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-stone-900 rounded-lg border border-slate-300 dark:border-stone-800 shadow-sm overflow-hidden w-full">
            
            {/* Header da Categoria Selecionada */}
            <div className="shrink-0 p-3 bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800">
              <div className="flex items-center gap-2 w-full pb-1">
                <span className="text-sm font-bold text-slate-800 dark:text-stone-100 uppercase">{selectedGroupCategory.toUpperCase()}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100/90 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-500/80 uppercase">
                  {filterSubgroup && filterSubgroup !== 'TODOS OS SUBGRUPOS'
                    ? `${filteredRulesCount} DE ${currentCategoryRules.length} REGRAS (${filterSubgroup})`
                    : `${currentCategoryRules.length} REGRAS ATIVAS`}
                </span>
              </div>

              <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                Estes insumos e intervalos de fábrica alimentarão automaticamente o bloco "ITENS RECOMENDADOS" na Nova Ordem de Manutenção.
              </p>
            </div>

            {/* Tabela de Regras Ativas da Categoria (ROLAGEM EXCLUSIVA DO GRID INTERNO) */}
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-stone-800 shadow-2xs">
                  <tr className="bg-slate-100/95 dark:bg-stone-800/95 text-stone-800 dark:text-stone-200 text-[10.5px] uppercase font-black tracking-wider border-b border-stone-200 dark:border-stone-700">
                    <th className="py-2.5 px-3">PRODUTO / INSUMO / FLUIDO</th>
                    <th className="py-2.5 px-3 text-center">INTERVALO DE FÁBRICA</th>
                    <th className="py-2.5 px-3 text-center">QUANTIDADE PADRÃO</th>
                    <th className="py-2.5 px-3 text-center">VÍNCULO COM ALMOXARIFADO</th>
                    <th className="py-2.5 px-3 text-right">AÇÕES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                  {filteredGroupedRules.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-stone-400 dark:text-stone-500 font-bold uppercase text-xs">
                        {filterSubgroup && filterSubgroup !== 'TODOS OS SUBGRUPOS'
                          ? `NENHUM ITEM PREVENTIVO CONFIGURADO NO SUBGRUPO "${filterSubgroup}" PARA ESTA CATEGORIA`
                          : 'NENHUM ITEM PREVENTIVO CONFIGURADO PARA ESTA CATEGORIA'}
                      </td>
                    </tr>
                  ) : (
                    filteredGroupedRules.map((group) => (
                      <React.Fragment key={group.subgroup}>
                        {/* Cabeçalho Cinza Compacto para Cada Subgrupo Ativo */}
                        <tr className="bg-slate-200/90 dark:bg-stone-800 text-stone-800 dark:text-stone-200 border-y border-slate-300 dark:border-stone-700 font-black text-[11px] uppercase tracking-wider select-none">
                          <td colSpan={5} className="py-1.5 px-3">
                            <div className="flex items-center space-x-2">
                              <span>📁 {group.subgroup}</span>
                              <span className="text-[10px] text-stone-600 dark:text-stone-400 font-mono font-bold">
                                ({group.rules.length} {group.rules.length === 1 ? 'ITEM' : 'ITENS'})
                              </span>
                            </div>
                          </td>
                        </tr>

                        {group.rules.map((rule, idx) => {
                          const isLinked = Boolean(rule.PRODUTO_ID && String(rule.PRODUTO_ID).trim());
                          const linkedItem = isLinked ? inventoryList.find(i => i.id === rule.PRODUTO_ID) : null;
                          
                          const cost = linkedItem 
                            ? Number((linkedItem as any).unitPrice || linkedItem.unitCost || (linkedItem as any).preco_custo || (linkedItem as any).custo_unitario || (linkedItem as any).valor_unitario || 0) 
                            : Number(rule.CUSTO_UNITARIO || 0);
                          const linkedName = linkedItem 
                            ? ((linkedItem as any).nome_comercial || linkedItem.name || '').toUpperCase() 
                            : (rule.PRODUTO_NOME_ESTOQUE || rule.ITEM_NOME).toUpperCase();
                          const linkedStock = linkedItem ? Number(linkedItem.quantity ?? (linkedItem as any).currentStock ?? 0) : 0;
                          const linkedUnit = linkedItem ? (linkedItem.unit || (linkedItem as any).unidade_medida || 'UN').toUpperCase() : (rule.unidade || 'UN');

                          const isInlineEditing = inlineEditingRuleId === rule.id;

                          return (
                            <React.Fragment key={rule.id || idx}>
                              {/* Linha Normal do Item */}
                              <tr 
                                className={`hover:bg-slate-50/80 dark:hover:bg-stone-800/60 transition ${
                                  isInlineEditing
                                    ? 'bg-sky-50/60 dark:bg-sky-950/30'
                                    : idx % 2 === 0 ? 'bg-white dark:bg-stone-900' : 'bg-slate-50/40 dark:bg-stone-850/40'
                                }`}
                              >
                                <td className="py-2.5 px-3 font-bold text-stone-900 dark:text-stone-100 uppercase">
                                  <div className="flex items-center space-x-2">
                                    <span>{rule.ITEM_NOME}</span>
                                    {isLinked && (
                                      <span className="text-[9px] font-mono font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 px-1.5 py-0.5 rounded">
                                        {formatCurrencyBRL(cost)}/{rule.unidade || 'UN'}
                                      </span>
                                    )}
                                  </div>
                                  {rule.observacoes && (
                                    <p className="text-[10px] text-stone-400 font-normal mt-0.5">{rule.observacoes}</p>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono font-bold text-stone-700 dark:text-stone-300 text-xs">
                                  A CADA {rule.INTERVALO_HORAS_KM.toLocaleString('pt-BR')} H/KM
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono font-black text-emerald-800 dark:text-emerald-400 text-xs">
                                  {rule.QUANTIDADE_PADRAO} {rule.unidade || 'UN'}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  {isLinked ? (
                                    <span 
                                      className="inline-flex items-center space-x-1 px-2.5 py-1 rounded text-[10.5px] font-bold uppercase bg-emerald-100/90 text-emerald-900 border border-emerald-500/80 shadow-2xs max-w-[320px] truncate"
                                      title={`VÍNCULO COM ALMOXARIFADO: ${linkedName} - ${formatCurrencyBRL(cost)} | SALDO: ${linkedStock.toFixed(2)} ${linkedUnit}`}
                                    >
                                      <span className="truncate">
                                        📦 {linkedName} - {formatCurrencyBRL(cost)}
                                      </span>
                                    </span>
                                  ) : (
                                    <span 
                                      className="inline-flex items-center space-x-1 px-2.5 py-1 rounded text-[10px] font-bold uppercase bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                                      title="Item sem amarração direta no almoxarifado. Clique no lápis para vincular agora."
                                    >
                                      <span>⚠️ PENDENTE DE VÍNCULO</span>
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  <div className="flex items-center justify-end space-x-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditRuleModal(rule)}
                                      className="p-1.5 rounded-lg border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-slate-700 dark:text-stone-300 hover:bg-slate-100 dark:hover:bg-stone-700 transition cursor-pointer"
                                      title="Editar insumo ou vincular com almoxarifado"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeletePreventiveRule(rule.id)}
                                      className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900 transition cursor-pointer"
                                      title="Excluir esta regra"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>

                              {/* Linha de Edição Direta Inline no Grid (Quando Aberta) */}
                              {isInlineEditing && (
                                <tr className="bg-sky-50/90 dark:bg-sky-950/50 border-y-2 border-sky-400 dark:border-sky-600 animate-in fade-in">
                                  <td colSpan={5} className="p-3">
                                    <div className="space-y-2.5">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-black uppercase text-sky-950 dark:text-sky-200 flex items-center space-x-1.5 tracking-wider">
                                          <Pencil className="w-3.5 h-3.5 text-sky-600" />
                                          <span>VINCULAR OU ATUALIZAR INSUMO NO ESTOQUE (EDIÇÃO DIRETA NO GRID)</span>
                                        </span>
                                        <button
                                          type="button"
                                          onClick={handleCancelInlineEdit}
                                          className="text-[10.5px] font-bold text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 uppercase underline cursor-pointer"
                                        >
                                          CANCELAR
                                        </button>
                                      </div>

                                      <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
                                        {/* Subgrupo */}
                                        <div className="md:col-span-3">
                                          <label className="block text-[10px] font-bold text-stone-700 dark:text-stone-300 mb-0.5 uppercase">
                                            SUBGRUPO *
                                          </label>
                                          <select
                                            value={inlineSubgroup}
                                            onChange={(e) => setInlineSubgroup(e.target.value)}
                                            className="w-full px-2.5 py-1.5 rounded-lg border border-sky-300 dark:border-sky-700 bg-white dark:bg-stone-900 text-xs font-bold uppercase text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                                          >
                                            {availableMaintenanceSubgroups.map((sg) => (
                                              <option key={sg} value={sg} className="uppercase">
                                                {sg}
                                              </option>
                                            ))}
                                          </select>
                                        </div>

                                        {/* Produto com Autocomplete Real */}
                                        <div className="md:col-span-4 relative" ref={inlineDropdownRef}>
                                          <label className="block text-[10px] font-bold text-stone-700 dark:text-stone-300 mb-0.5 uppercase">
                                            BUSCAR PRODUTO NO ALMOXARIFADO *
                                          </label>
                                          <div className="relative">
                                            <input
                                              type="text"
                                              placeholder="Digite o nome ou código do produto..."
                                              value={inlineSearchQuery}
                                              onChange={(e) => {
                                                setInlineSearchQuery(e.target.value);
                                                setInlineSelectedProduct(null);
                                                setInlineDropdownOpen(true);
                                              }}
                                              onFocus={() => {
                                                if (inlineSearchQuery.trim()) {
                                                  setInlineDropdownOpen(true);
                                                }
                                              }}
                                              className="w-full px-2.5 py-1.5 rounded-lg border border-sky-300 dark:border-sky-700 bg-white dark:bg-stone-900 text-xs font-bold uppercase text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                                            />
                                            <Package className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400 pointer-events-none" />
                                          </div>

                                          {/* Autocomplete Dropdown */}
                                          {inlineDropdownOpen && inlineAutocompleteResults.length > 0 && (
                                            <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl shadow-xl z-50 max-h-52 overflow-y-auto divide-y divide-stone-100 dark:divide-stone-800">
                                              <div className="px-3 py-1 bg-slate-100 dark:bg-stone-800 text-[10px] font-black uppercase text-slate-600 dark:text-stone-400">
                                                PRODUTOS ENCONTRADOS:
                                              </div>
                                              {inlineAutocompleteResults.map((item) => {
                                                const anyItem = item as any;
                                                const name = (anyItem.nome_comercial || item.name || '').toUpperCase();
                                                const cost = Number(anyItem.unitPrice || item.unitCost || anyItem.preco_custo || anyItem.custo_unitario || 0);
                                                const unit = (item.unit || anyItem.unidade_medida || 'UN').toUpperCase();
                                                const stock = Number(item.quantity ?? anyItem.currentStock ?? 0);
                                                return (
                                                  <button
                                                    key={item.id}
                                                    type="button"
                                                    onClick={() => handleSelectInlineProduct(item)}
                                                    className="w-full text-left px-3 py-1.5 hover:bg-sky-100/70 dark:hover:bg-stone-800 transition flex items-center justify-between gap-2 cursor-pointer"
                                                  >
                                                    <div className="min-w-0">
                                                      <p className="text-xs font-bold text-stone-900 dark:text-stone-100 uppercase truncate">
                                                        {name}
                                                      </p>
                                                      <p className="text-[10px] text-stone-500 font-medium">
                                                        Cód: {item.code || anyItem.codigo || 'S/N'} • Categoria: {anyItem.categoria || item.category || 'GERAL'}
                                                      </p>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                      <span className="text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-400 block">
                                                        {formatCurrencyBRL(cost)}
                                                      </span>
                                                      <span className="text-[9.5px] text-stone-400 font-bold block">
                                                        Saldo: {stock.toFixed(2)} {unit}
                                                      </span>
                                                    </div>
                                                  </button>
                                                );
                                              })}
                                            </div>
                                          )}

                                          {inlineSelectedProduct && (
                                            <div className="mt-1 flex items-center space-x-1.5 text-[9.5px] text-emerald-800 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">
                                              <Check className="w-3 h-3 text-emerald-600" />
                                              <span>VINCULADO: CÓD {inlineSelectedProduct.code || (inlineSelectedProduct as any).codigo || inlineSelectedProduct.id.slice(0, 6)} • ESTOQUE: {Number(inlineSelectedProduct.quantity ?? (inlineSelectedProduct as any).currentStock ?? 0).toFixed(2)} {inlineUnit}</span>
                                            </div>
                                          )}
                                        </div>

                                        {/* Intervalo */}
                                        <div className="md:col-span-2">
                                          <label className="block text-[10px] font-bold text-stone-700 dark:text-stone-300 mb-0.5 uppercase">
                                            INTERVALO *
                                          </label>
                                          <div className="flex items-center space-x-1">
                                            <input
                                              type="number"
                                              min="1"
                                              value={inlineInterval}
                                              onChange={(e) => setInlineInterval(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                                              className="w-full px-2 py-1.5 rounded-lg border border-sky-300 dark:border-sky-700 bg-white dark:bg-stone-900 text-xs font-mono font-bold text-center focus:outline-none focus:ring-2 focus:ring-sky-500"
                                            />
                                            <span className="text-[10px] font-bold text-stone-500">H/KM</span>
                                          </div>
                                        </div>

                                        {/* Quantidade e Unidade */}
                                        <div className="md:col-span-2">
                                          <label className="block text-[10px] font-bold text-stone-700 dark:text-stone-300 mb-0.5 uppercase">
                                            QTD PADRÃO *
                                          </label>
                                          <div className="flex items-center space-x-1">
                                            <input
                                              type="number"
                                              min="0.1"
                                              step="any"
                                              value={inlineQty}
                                              onChange={(e) => setInlineQty(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                              className="w-full px-2 py-1.5 rounded-lg border border-sky-300 dark:border-sky-700 bg-white dark:bg-stone-900 text-xs font-mono font-bold text-center focus:outline-none focus:ring-2 focus:ring-sky-500"
                                            />
                                            <select
                                              value={inlineUnit}
                                              onChange={(e) => setInlineUnit(e.target.value.toUpperCase())}
                                              className="px-1.5 py-1.5 rounded-lg border border-sky-300 dark:border-sky-700 bg-white dark:bg-stone-900 text-xs font-bold uppercase focus:outline-none focus:ring-2 focus:ring-sky-500"
                                            >
                                              <option value="L">L</option>
                                              <option value="UN">UN</option>
                                              <option value="KG">KG</option>
                                              <option value="CX">CX</option>
                                              <option value="PC">PC</option>
                                              <option value="M">M</option>
                                            </select>
                                          </div>
                                        </div>

                                        {/* Botão de Salvar Amarração */}
                                        <div className="md:col-span-1">
                                          <button
                                            type="button"
                                            onClick={() => handleSaveInlineEdit(rule.id)}
                                            className="w-full py-1.5 px-2 rounded-lg bg-[#059669] hover:bg-[#047857] text-white text-xs font-black uppercase tracking-wider shadow-sm transition flex items-center justify-center space-x-1 cursor-pointer active:scale-95"
                                            title="Salvar alterações deste insumo"
                                          >
                                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                            <span className="hidden xl:inline">SALVAR</span>
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Rodapé com botão de salvar consolidação */}
            <div className="shrink-0 p-3 bg-stone-50 dark:bg-stone-850 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between flex-wrap gap-2">
              <span className="text-[11px] text-stone-500 dark:text-stone-400 font-bold uppercase">
                CHAVE LOCALSTORAGE: agrocontrol_plano_preventivo_grupos
              </span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    saveStoredPreventiveGroupPlans(preventivePlans);
                    setPreventiveFeedback({
                      type: 'success',
                      message: `MATRIZ PREVENTIVA CONSOLIDADA COM SUCESSO NO BANCO LOCAL!`
                    });
                    setTimeout(() => setPreventiveFeedback(null), 3000);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-xs font-black uppercase tracking-wider shadow-sm transition flex items-center space-x-1.5 cursor-pointer active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  <span>SALVAR ALTERAÇÕES NA MATRIZ</span>
                </button>
              </div>
            </div>

          </div>

          {/* Modal de Cadastro Compacto Intelligent Flow (SLIM DESIGN PRO) */}
          {isItemModalOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-150">
              <div className="w-full max-w-md bg-[#edf4ff] dark:bg-stone-900 border border-slate-400 dark:border-stone-700 rounded-lg shadow-2xl p-4 flex flex-col gap-3 max-h-[92vh] overflow-y-auto">
                
                {/* Header do Modal */}
                <div className="flex items-center justify-between border-b border-slate-300 dark:border-stone-700 pb-2">
                  <div className="flex items-center space-x-2">
                    <Wrench className="w-4 h-4 text-[#059669]" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
                      {editingRuleId ? 'EDITAR ITEM RECOMENDADO' : '+ CADASTRAR ITEM NO PLANO'}
                    </h4>
                  </div>
                  <button 
                    type="button"
                    onClick={handleCancelEditRule} 
                    className="p-1 hover:bg-slate-200 dark:hover:bg-stone-800 rounded text-slate-500 hover:text-slate-800 dark:hover:text-stone-200 transition cursor-pointer"
                    title="FECHAR"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Form / Conteúdo */}
                <form onSubmit={handleSavePreventiveRule} className="flex flex-col gap-3">
                  
                  {/* CATEGORIA ATIVA (READ-ONLY DISABLED) */}
                  <div>
                    <label className="block text-[10.5px] font-bold uppercase text-slate-700 dark:text-stone-300 mb-1">
                      CATEGORIA ATIVA
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        readOnly
                        disabled
                        value={selectedGroupCategory.toUpperCase()}
                        className="w-full px-3 py-1.5 rounded border border-slate-300 dark:border-stone-700 bg-slate-100 dark:bg-stone-800 text-slate-700 dark:text-stone-300 text-xs font-bold uppercase cursor-not-allowed select-none pl-8"
                      />
                      <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  {/* SUBGRUPO DE MANUTENÇÃO (READ-ONLY DISABLED OU SELETOR SE FOR 'TODOS OS SUBGRUPOS') */}
                  <div>
                    <label className="block text-[10.5px] font-bold uppercase text-slate-700 dark:text-stone-300 mb-1">
                      SUBGRUPO DE MANUTENÇÃO
                    </label>
                    {filterSubgroup && filterSubgroup !== 'TODOS OS SUBGRUPOS' ? (
                      <div className="relative">
                        <input
                          type="text"
                          readOnly
                          disabled
                          value={filterSubgroup.toUpperCase()}
                          className="w-full px-3 py-1.5 rounded border border-slate-300 dark:border-stone-700 bg-slate-100 dark:bg-stone-800 text-slate-700 dark:text-stone-300 text-xs font-bold uppercase cursor-not-allowed select-none pl-8"
                        />
                        <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    ) : (
                      <select
                        value={ruleSubgroup}
                        onChange={(e) => setRuleSubgroup(e.target.value)}
                        className="w-full px-3 py-1.5 rounded border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-slate-800 dark:text-stone-200 text-xs font-bold uppercase focus:ring-2 focus:ring-[#0963cb] focus:outline-none cursor-pointer"
                      >
                        {availableMaintenanceSubgroups.map((sg) => (
                          <option key={sg} value={sg} className="uppercase">
                            {sg}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* PRODUTO DO ESTOQUE COM AUTOCOMPLETE REAL */}
                  <div className="relative" ref={inventoryDropdownRef}>
                    <label className="block text-[10.5px] font-bold uppercase text-slate-700 dark:text-stone-300 mb-1">
                      PRODUTO DO ESTOQUE <span className="text-rose-600">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder="DIGITE O NOME OU CÓDIGO DO PRODUTO..."
                        value={inventorySearchQuery}
                        onChange={(e) => {
                          setInventorySearchQuery(e.target.value.toUpperCase());
                          setSelectedInventoryItem(null);
                          setIsInventoryDropdownOpen(true);
                        }}
                        onFocus={() => {
                          if (inventorySearchQuery.trim()) {
                            setIsInventoryDropdownOpen(true);
                          }
                        }}
                        className="w-full px-3 py-1.5 rounded border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-slate-800 dark:text-stone-100 text-xs font-bold uppercase focus:ring-2 focus:ring-[#0963cb] focus:outline-none pr-8"
                      />
                      <Package className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>

                    {/* Dropdown de Autocomplete com Estoque Real da Chave agrocontrol_produtos */}
                    {isInventoryDropdownOpen && inventoryAutocompleteResults.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-stone-800">
                        <div className="px-3 py-1 bg-slate-100 dark:bg-stone-800 text-[9.5px] font-black uppercase text-slate-600 dark:text-stone-400">
                          PRODUTOS NO ALMOXARIFADO:
                        </div>
                        {inventoryAutocompleteResults.map((item) => {
                          const anyItem = item as any;
                          const name = (anyItem.nome_comercial || item.name || '').toUpperCase();
                          const cost = Number(anyItem.unitPrice || item.unitCost || anyItem.preco_custo || anyItem.custo_unitario || anyItem.valor_unitario || 0);
                          const displayId = anyItem.codigo_produto || item.code || anyItem.codigo || item.id;
                          const unit = (item.unit || anyItem.unidade_medida || 'UN').toUpperCase();
                          const stock = Number(item.quantity ?? anyItem.currentStock ?? anyItem.quantidade_atual ?? 0);
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleSelectInventoryItem(item)}
                              className="w-full text-left px-3 py-2 hover:bg-sky-50 dark:hover:bg-stone-800 transition flex items-center justify-between gap-2 cursor-pointer border-b border-slate-100 dark:border-stone-800 last:border-b-0"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-slate-800 dark:text-stone-100 uppercase truncate">
                                  #{displayId} - {name} - {formatCurrencyBRL(cost)}
                                </p>
                                <p className="text-[10px] text-slate-500 font-medium">
                                  CAT: {anyItem.categoria || item.category || 'GERAL'} • SALDO: {stock.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {unit}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-400 block">
                                  {formatCurrencyBRL(cost)}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Vínculo Ativo */}
                    {selectedInventoryItem && (
                      <div className="mt-1 flex items-center space-x-1.5 text-[10px] text-emerald-800 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>VÍNCULO COM ESTOQUE: #{ (selectedInventoryItem as any).codigo_produto || selectedInventoryItem.code || (selectedInventoryItem as any).codigo || selectedInventoryItem.id } - { ((selectedInventoryItem as any).nome_comercial || selectedInventoryItem.name || '').toUpperCase() } • CUSTO: {formatCurrencyBRL(Number((selectedInventoryItem as any).unitPrice || selectedInventoryItem.unitCost || (selectedInventoryItem as any).preco_custo || 0))}</span>
                      </div>
                    )}
                  </div>

                  {/* INTERVALO DE TROCA E QUANTIDADE PADRÃO */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* INTERVALO DE TROCA */}
                    <div>
                      <label className="block text-[10.5px] font-bold uppercase text-slate-700 dark:text-stone-300 mb-1">
                        INTERVALO DE TROCA <span className="text-rose-600">*</span>
                      </label>
                      <div className="flex items-center space-x-1">
                        <input
                          type="number"
                          required
                          min="1"
                          step="1"
                          placeholder="250"
                          value={ruleIntervalHoursKm}
                          onChange={(e) => setRuleIntervalHoursKm(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                          className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-slate-800 dark:text-stone-100 text-xs font-mono font-bold text-center focus:ring-2 focus:ring-[#0963cb] focus:outline-none"
                        />
                        <span className="text-[11px] font-bold text-slate-500 shrink-0">H/KM</span>
                      </div>
                    </div>

                    {/* QUANTIDADE PADRÃO */}
                    <div>
                      <label className="block text-[10.5px] font-bold uppercase text-slate-700 dark:text-stone-300 mb-1">
                        QUANTIDADE PADRÃO <span className="text-rose-600">*</span>
                      </label>
                      <div className="flex items-center space-x-1">
                        <input
                          type="number"
                          required
                          min="0.1"
                          step="any"
                          placeholder="1"
                          value={ruleStandardQty}
                          onChange={(e) => setRuleStandardQty(e.target.value === '' ? '' : parseFloat(e.target.value))}
                          className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-slate-800 dark:text-stone-100 text-xs font-mono font-bold text-center focus:ring-2 focus:ring-[#0963cb] focus:outline-none"
                        />
                        <select
                          value={ruleUnit}
                          onChange={(e) => setRuleUnit(e.target.value.toUpperCase())}
                          className="px-2 py-1.5 rounded border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-slate-800 dark:text-stone-100 text-xs font-bold uppercase focus:ring-2 focus:ring-[#0963cb] focus:outline-none shrink-0 cursor-pointer"
                        >
                          <option value="L">L</option>
                          <option value="UN">UN</option>
                          <option value="KG">KG</option>
                          <option value="CX">CX</option>
                          <option value="PC">PC</option>
                          <option value="M">M</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* OBSERVAÇÕES DO INSUMO (OPCIONAL) */}
                  <div>
                    <label className="block text-[10.5px] font-bold uppercase text-slate-700 dark:text-stone-300 mb-1">
                      OBSERVAÇÕES DO INSUMO (OPCIONAL)
                    </label>
                    <input
                      type="text"
                      placeholder="EX: UTILIZAR PREFERENCIALMENTE ÓLEO GENUÍNO HOMOLOGADO"
                      value={ruleNotes}
                      onChange={(e) => setRuleNotes(e.target.value.toUpperCase())}
                      className="w-full px-3 py-1.5 rounded border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-slate-800 dark:text-stone-100 text-xs font-medium uppercase focus:ring-2 focus:ring-[#0963cb] focus:outline-none"
                    />
                  </div>

                  {/* Footer do Modal com Botões */}
                  <div className="pt-2 border-t border-slate-300 dark:border-stone-700 flex items-center justify-end space-x-2">
                    <button
                      type="button"
                      onClick={handleCancelEditRule}
                      className="px-3.5 py-1.5 rounded bg-white dark:bg-stone-800 hover:bg-slate-100 dark:hover:bg-stone-700 text-slate-700 dark:text-stone-300 border border-slate-300 dark:border-stone-700 text-xs font-bold uppercase transition cursor-pointer"
                    >
                      CANCELAR
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded bg-[#059669] hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-black uppercase tracking-wider shadow transition flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>💾 SALVAR REGRA</span>
                    </button>
                  </div>

                </form>

              </div>
            </div>
          )}


        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">

        {/* Synchronization Feedback Banner */}
        {syncBanner && (
          <div className={`p-4 rounded-2xl flex items-center justify-between border transition-all ${
            syncBanner.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200'
          }`}>
            <div className="flex items-center space-x-3">
              {syncBanner.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
              )}
              <p className="text-xs sm:text-sm font-semibold">{syncBanner.message}</p>
            </div>
            <button
              onClick={() => setSyncBanner(null)}
              className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

      {/* Header & Filter Controls */}
      <div className="bg-white dark:bg-stone-900 p-4 sm:p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs space-y-4">
        
        {/* Top bar: Search + Actions */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          
          {/* Lado Esquerdo: Search Input */}
          <div className="flex flex-1 items-center gap-2 max-w-2xl min-w-0">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                type="text"
                placeholder="Buscar por placa, modelo, nº de série, titular, CPF/CNPJ, tipo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800/60 text-stone-900 dark:text-stone-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-sky-600 focus:bg-white dark:focus:bg-stone-800 shadow-inner"
              />
            </div>
          </div>

          {/* Lado Direito: CADASTRAR VEÍCULO, Imprimir Lista, Sincronizar Leituras, View Toggle */}
          <div className="flex items-center flex-wrap gap-2 shrink-0">
            
            {/* Botão + CADASTRAR VEÍCULO (Padrão Verde Oficial AgroControl: bg-[#059669]) */}
            <button
              type="button"
              id="btn-cadastrar-veiculo"
              onClick={onOpenNewVehicle}
              title="CADASTRAR NOVO VEÍCULO OU MÁQUINA NA FROTA"
              className="px-3.5 py-1.5 rounded-xl bg-[#059669] hover:bg-[#047857] border border-emerald-700/60 text-white text-xs font-bold uppercase shadow-[inset_0_1px_0px_rgba(255,255,255,0.3),0_1px_2px_rgba(0,0,0,0.15)] transition flex items-center space-x-1.5 shrink-0 cursor-pointer active:scale-95 whitespace-nowrap"
            >
              <Plus className="w-4 h-4 text-white stroke-[2.5]" />
              <span className="text-white font-bold uppercase tracking-wider">+ CADASTRAR VEÍCULO</span>
            </button>

            {/* Botão Imprimir Lista de Veículos (3D Metálico) */}
            <button
              onClick={handleOpenPrint}
              title="Visualizar e Imprimir Lista Completa da Frota em A4"
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 dark:from-stone-800 dark:via-stone-750 dark:to-stone-850 border border-slate-400 dark:border-stone-600 text-slate-800 dark:text-stone-100 hover:text-slate-900 text-xs font-bold uppercase shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9)] dark:shadow-[inset_1px_1px_0px_rgba(255,255,255,0.1)] transition flex items-center space-x-1.5 cursor-pointer active:scale-95 whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5 text-slate-700 dark:text-stone-300" />
              <span>IMPRIMIR LISTA</span>
            </button>

            {/* Botão Sincronizar Odômetro & Horímetro (3D Metálico) */}
            <button
              onClick={handleSyncMeters}
              disabled={isSyncing}
              title="Sincronizar Odômetro & Horímetro com os últimos abastecimentos e manutenções"
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 dark:from-stone-800 dark:via-stone-750 dark:to-stone-850 border border-slate-400 dark:border-stone-600 text-slate-800 dark:text-stone-100 hover:text-slate-900 text-xs font-bold uppercase shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9)] dark:shadow-[inset_1px_1px_0px_rgba(255,255,255,0.1)] transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 active:scale-95 whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-700 dark:text-stone-300 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">SINCRONIZAR LEITURAS</span>
              <span className="sm:hidden">SINCRONIZAR</span>
            </button>

            {/* View toggle (Tabela / Cards) */}
            <div className="flex items-center bg-stone-100 dark:bg-stone-800 p-0.5 rounded-xl border border-stone-200 dark:border-stone-700">
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-stone-700 text-sky-600 shadow-xs'
                    : 'text-stone-500 hover:text-stone-900 dark:hover:text-white'
                }`}
                title="Visualização em Tabela"
              >
                <TableIcon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-stone-700 text-sky-600 shadow-xs'
                    : 'text-stone-500 hover:text-stone-900 dark:hover:text-white'
                }`}
                title="Visualização em Cards"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>

        </div>

        {/* Filter Bar (Categorias, Composição, Propriedade, Status) */}
        <div className="flex items-center flex-wrap gap-2 pt-2 border-t border-stone-100 dark:border-stone-800 text-xs font-semibold">
          
          <span className="text-stone-400 dark:text-stone-500 text-[11px] font-bold uppercase tracking-wider flex items-center space-x-1 mr-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Filtros:</span>
          </span>

          {/* Categoria / Tipo */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-sky-600 cursor-pointer"
          >
            <option value="todos">Todos os Tipos / Categorias</option>
            {availableCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Composição: Cavalo, Reboque, Simples */}
          <select
            value={selectedComposition}
            onChange={(e) => setSelectedComposition(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-sky-600 cursor-pointer"
          >
            <option value="todos">Todas Composições</option>
            <option value="cavalo">Cavalos Mecânicos</option>
            <option value="reboque">Reboques & Carretas</option>
            <option value="veiculo_simples">Veículos Simples / Tratores</option>
          </select>

          {/* Propriedade: Todos os Regimes */}
          <select
            value={selectedOwnership}
            onChange={(e) => setSelectedOwnership(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-sky-600 cursor-pointer"
          >
            <option value="todos">Todos os Regimes de Posse</option>
            {availableRegimes.map((reg) => (
              <option key={reg} value={reg}>
                {reg}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-sky-600 cursor-pointer"
          >
            <option value="todos">Todos os Status</option>
            <option value="operacional">Operacional</option>
            <option value="disponivel">Disponível</option>
            <option value="em_manutencao">Em Manutenção</option>
            <option value="parado">Parado</option>
          </select>

          {/* Reset Filters */}
          {(selectedCategory !== 'todos' || selectedComposition !== 'todos' || selectedOwnership !== 'todos' || selectedStatus !== 'todos' || searchTerm) && (
            <button
              onClick={() => {
                setSelectedCategory('todos');
                setSelectedComposition('todos');
                setSelectedOwnership('todos');
                setSelectedStatus('todos');
                setSearchTerm('');
              }}
              className="text-stone-500 hover:text-rose-600 dark:hover:text-rose-400 text-xs underline cursor-pointer ml-auto"
            >
              Limpar Filtros
            </button>
          )}

          <div className="ml-auto text-stone-400 text-xs font-mono">
            {filteredVehicles.length} de {machineries.length} cadastrados
          </div>

        </div>

      </div>

      {/* Vehicles Table View */}
      {viewMode === 'table' ? (
        <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 rounded-2xl border border-blue-200/80 dark:border-stone-800 overflow-hidden shadow-xs text-black dark:text-white">
          <div className="w-full overflow-x-auto lg:overflow-x-hidden">
            <table className="w-full text-left text-xs sm:text-sm table-fixed">
              <colgroup>
                <col className="w-[11%]" />
                <col className="w-[18%]" />
                <col className="w-[11%]" />
                <col className="w-[11%]" />
                <col className="w-[10%]" />
                <col className="w-[11%]" />
                <col className="w-[10%]" />
                <col className="w-[9%]" />
                <col className="w-[9%]" />
              </colgroup>
              <thead className="bg-[#87AFE3] dark:bg-stone-900 text-xs font-black text-black dark:text-white uppercase tracking-wider border-b-2 border-blue-200/80 dark:border-stone-800">
                <tr>
                  <th className="py-1.5 px-2 xl:px-2.5 text-black dark:text-white font-black truncate">CÓDIGO / FROTA</th>
                  <th className="py-1.5 px-2 xl:px-2.5 text-black dark:text-white font-black truncate">TIPO & MODELO</th>
                  <th className="py-1.5 px-2 xl:px-2.5 text-black dark:text-white font-black truncate">PROPRIEDADE</th>
                  <th className="py-1.5 px-2 xl:px-2.5 text-black dark:text-white font-black truncate">PESOS & CARGA</th>
                  <th className="py-1.5 px-2 xl:px-2.5 text-black dark:text-white font-black truncate">HORÍMETRO / KM</th>
                  <th className="py-1.5 px-2 xl:px-2.5 text-black dark:text-white font-black truncate">MOTORISTA</th>
                  <th className="py-1.5 px-2 xl:px-2.5 text-black dark:text-white font-black truncate">CUSTO TOTAL</th>
                  <th className="py-1.5 px-2 xl:px-2.5 text-black dark:text-white font-black truncate">STATUS</th>
                  <th className="py-1.5 px-2 xl:px-2.5 text-right text-black dark:text-white font-black truncate">AÇÕES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-200/60 dark:divide-stone-800/60 font-medium bg-[#87AFE3] dark:bg-stone-900 text-black dark:text-white">
                {filteredVehicles.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-4 text-center text-xs font-semibold text-stone-600 dark:text-stone-300 uppercase">
                      NENHUM REGISTRO ENCONTRADO
                    </td>
                  </tr>
                ) : (
                  filteredVehicles.map((vehicle) => {
                    const totalFuel = getVehicleTotalFuel(vehicle.id);
                    const totalMaint = getVehicleTotalMaintenance(vehicle.id);
                    const totalCost = totalFuel + totalMaint;
                    const employeePool = (employees && employees.length > 0) ? employees : getStoredEmployees();
                    let driversList = vehicle.assignedDrivers && vehicle.assignedDrivers.length > 0
                      ? vehicle.assignedDrivers
                      : (vehicle.operatorOrDriver ? vehicle.operatorOrDriver.split(',').map(s => s.trim()).filter(Boolean) : []);
                    if (driversList.length === 0 && (vehicle.assignedDriverIds?.length || (vehicle as any).user_id || (vehicle as any).driver_id)) {
                      const candidateIds = vehicle.assignedDriverIds && vehicle.assignedDriverIds.length > 0
                        ? vehicle.assignedDriverIds
                        : [((vehicle as any).driver_id || (vehicle as any).user_id)];
                      const resolved = candidateIds
                        .map(id => employeePool.find(e => e.id === id || String(e.id) === String(id) || toValidUUID(e.id) === toValidUUID(id))?.name)
                        .filter(Boolean) as string[];
                      if (resolved.length > 0) {
                        driversList = resolved;
                      }
                    }

                    const isCavalo = vehicle.compositionType === 'cavalo';
                    const isReboque = vehicle.compositionType === 'reboque' || (vehicle.categoryType || '').trim().toLowerCase() === 'reboque';
                    const hasCoupledTrailer = vehicle.hasCoupledTrailer === false
                      ? false
                      : Boolean(vehicle.hasCoupledTrailer && (vehicle.coupledTrailerId || vehicle.reboque_vinculado_id || vehicle.trailerPlate || vehicle.coupledTrailerName));

                    const coupledMach = (vehicle.coupledTrailerId || vehicle.reboque_vinculado_id)
                      ? machineries.find(m => m.id === (vehicle.coupledTrailerId || vehicle.reboque_vinculado_id) || toValidUUID(m.id) === toValidUUID(vehicle.coupledTrailerId || vehicle.reboque_vinculado_id))
                      : null;

                    const trailerPlateDisplay = vehicle.trailerPlate || coupledMach?.licensePlateOrSerial || coupledMach?.placa_ou_serie || (vehicle.coupledTrailerName && vehicle.coupledTrailerName.includes('-') ? vehicle.coupledTrailerName.split('-')[0].trim() : (vehicle.coupledTrailerName || ''));
                    const trailerModelDisplay = vehicle.trailerModel || coupledMach?.model || coupledMach?.modelo || coupledMach?.name || (vehicle.coupledTrailerName && vehicle.coupledTrailerName.includes('-') ? vehicle.coupledTrailerName.split('-').slice(1).join('-').trim() : (vehicle.coupledTrailerName || ''));
                    const pbt = (vehicle.taraWeightKg && vehicle.capacityLoadKg)
                      ? (vehicle.taraWeightKg + vehicle.capacityLoadKg)
                      : vehicle.grossWeightKg;
                    const categoryTag = getVehicleCategoryTag(vehicle);

                    return (
                      <tr key={vehicle.id} className="even:bg-[#f2f2f2] odd:bg-white dark:even:bg-stone-800/50 dark:odd:bg-stone-900 hover:bg-slate-200/60 dark:hover:bg-stone-800 transition border-b border-slate-200 dark:border-stone-800">
                        
                        {/* Identificação / Placa / Nº Série */}
                        <td className="py-1 px-2 xl:px-2.5 align-top">
                          <div className="flex flex-col space-y-1">
                            {vehicle.fleetNumber && (
                              <span className="inline-flex items-center text-[10px] font-black text-[#000000] dark:text-blue-200 bg-blue-100 dark:bg-blue-900/60 border border-blue-300 dark:border-blue-700 px-1.5 py-0.5 rounded w-fit">
                                Frota: {vehicle.fleetNumber}
                              </span>
                            )}
                            <span className="font-black text-[#000000] dark:text-stone-100 font-mono text-xs px-2 py-0.5 bg-stone-100 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-md w-fit shadow-2xs">
                              {vehicle.licensePlateOrSerial || '--'}
                            </span>
                            {vehicle.serialNumber && (
                              <span className="inline-flex items-center text-[10px] font-bold text-[#000000] dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 px-1.5 py-0.5 rounded w-fit">
                                Série: {vehicle.serialNumber}
                              </span>
                            )}
                            {vehicle.renavam && (
                              <span className="text-[10px] text-[#000000] dark:text-stone-400 font-mono font-medium truncate">
                                REN: {vehicle.renavam}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Veículo & Composição com Categoria em Destaque */}
                        <td className="py-1 px-2 xl:px-2.5 align-top">
                          {/* 3. Tag de Categoria do Veículo (logo acima do modelo e ano) */}
                          <div className="mb-0.5">
                            <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-black uppercase tracking-wider border shadow-2xs ${categoryTag.style}`}>
                              {categoryTag.label}
                            </span>
                          </div>

                          <div className="font-bold text-stone-900 dark:text-stone-100 uppercase text-xs sm:text-sm leading-tight break-words">
                            {(vehicle.model || vehicle.name || '').replace(/^(AGR[IÍ]COLA\s*[-–—:]*\s*)/i, '').trim().toUpperCase()}
                          </div>
                          <div className="text-[11px] text-stone-700 dark:text-stone-300 flex flex-wrap items-center gap-1 mt-0.5 uppercase">
                            {vehicle.brand && <span className="font-semibold">{vehicle.brand.replace(/^(AGR[IÍ]COLA\s*[-–—:]*\s*)/i, '').trim().toUpperCase()}</span>}
                            {vehicle.year && <span className="normal-case font-medium">• Ano {vehicle.year}</span>}
                          </div>

                          {/* Badges de Composição e Reboque Vinculado */}
                          <div className="mt-0.5 flex flex-wrap items-center gap-1">
                            {isCavalo && (
                              <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.2 rounded bg-purple-50 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800 uppercase">
                                🚛 Cavalo
                              </span>
                            )}
                            {isReboque && (
                              <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 uppercase">
                                🛞 Reboque{vehicle.trailerType ? `: ${vehicle.trailerType.toUpperCase()}` : ''}
                              </span>
                            )}
                            {hasCoupledTrailer && (
                              <div className="inline-flex flex-wrap items-center gap-1 text-[10px] font-extrabold px-1.5 py-0.2 rounded-md bg-sky-50 text-sky-950 dark:bg-sky-950/70 dark:text-sky-200 border border-sky-300 dark:border-sky-800 shadow-2xs">
                                <span>🔗</span>
                                <span className="font-bold text-sky-900 dark:text-sky-300">Reboque:</span>
                                {trailerPlateDisplay && (
                                  <span className="font-mono bg-white dark:bg-stone-900 px-1 py-0.2 rounded border border-sky-200 dark:border-sky-800 text-[#000000] dark:text-sky-100 font-black uppercase">
                                    {trailerPlateDisplay.toUpperCase()}
                                  </span>
                                )}
                                {trailerModelDisplay && (
                                  <span className="font-semibold text-stone-800 dark:text-stone-300 uppercase truncate max-w-[100px]">
                                    {trailerModelDisplay.toUpperCase()}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Propriedade & Titular (No Nome de Quem) */}
                        <td className="py-1 px-2 xl:px-2.5 align-top break-words">
                          <div className="space-y-1">
                            {(() => {
                              const badge = getOwnershipBadge(vehicle.ownership);
                              return (
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border text-[#000000] dark:text-inherit ${badge.className}`}>
                                  {badge.label}
                                </span>
                              );
                            })()}
                            
                            {vehicle.ownerName ? (
                              <div className="text-xs">
                                <div className="font-bold text-[#000000] dark:text-stone-200 leading-tight break-words">
                                  {vehicle.ownerName}
                                </div>
                                {vehicle.ownerDocument && (
                                  <div className="text-[10px] text-stone-600 dark:text-stone-400 font-mono font-medium truncate">
                                    Doc: {vehicle.ownerDocument}
                                  </div>
                                )}
                                {vehicle.secondaryOwnerName && (
                                  <div className="text-[10px] text-stone-700 dark:text-stone-400 font-medium truncate">
                                    Sócio: {vehicle.secondaryOwnerName}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-[11px] text-stone-600 dark:text-stone-400 italic">
                                Titular da empresa
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Pesos: Tara, Lotação e PBT */}
                        <td className="py-1 px-2 xl:px-2.5 align-top">
                          <div className="space-y-0.5 text-xs text-[#000000] dark:text-stone-200">
                            {vehicle.taraWeightKg ? (
                              <div className="truncate">
                                <span className="text-stone-700 dark:text-stone-400 text-[10px] uppercase font-bold">Tara:</span>{' '}
                                <strong className="font-mono text-[#000000] dark:text-stone-100">{vehicle.taraWeightKg.toLocaleString('pt-BR')} kg</strong>
                              </div>
                            ) : null}
                            {vehicle.capacityLoadKg ? (
                              <div className="truncate">
                                <span className="text-stone-700 dark:text-stone-400 text-[10px] uppercase font-bold">Lot:</span>{' '}
                                <strong className="font-mono text-[#000000] dark:text-stone-100">{vehicle.capacityLoadKg.toLocaleString('pt-BR')} kg</strong>
                              </div>
                            ) : null}
                            {vehicle.capacityM3 ? (
                              <div className="font-bold truncate">
                                <span className="text-stone-700 dark:text-stone-400 text-[10px] uppercase font-bold">Vol:</span>{' '}
                                <strong className="font-mono text-[#000000] dark:text-sky-300 font-black">{vehicle.capacityM3} m³</strong>
                              </div>
                            ) : null}
                            {pbt ? (
                              <div className="font-bold truncate">
                                <span className="text-stone-700 dark:text-stone-400 text-[10px] uppercase font-bold">PBT:</span>{' '}
                                <span className="font-mono text-[#000000] dark:text-stone-100 font-bold">{pbt.toLocaleString('pt-BR')} kg</span>
                              </div>
                            ) : null}
                            {!vehicle.taraWeightKg && !vehicle.capacityLoadKg && !vehicle.capacityM3 && !pbt && (
                              <span className="text-stone-500 dark:text-stone-400 italic text-[11px]">--</span>
                            )}
                          </div>
                        </td>

                        {/* Horímetro / KM com Ação de Leitura Rápida */}
                        <td className="py-1 px-2 xl:px-2.5 align-top">
                          <div className="space-y-0.5 font-mono text-xs">
                            {vehicle.hourMeter !== undefined && vehicle.hourMeter > 0 && (
                              <div className="font-bold text-[#000000] dark:text-amber-400 flex items-center space-x-1 truncate">
                                <Clock className="w-3 h-3 text-[#000000] dark:text-amber-400 shrink-0" />
                                <span className="text-[#000000] dark:text-amber-400">{vehicle.hourMeter.toLocaleString('pt-BR')} h</span>
                              </div>
                            )}
                            {vehicle.currentKm !== undefined && vehicle.currentKm > 0 && (
                              <div className="font-bold text-[#000000] dark:text-emerald-400 flex items-center space-x-1 truncate">
                                <Gauge className="w-3 h-3 text-[#000000] dark:text-emerald-400 shrink-0" />
                                <span className="text-[#000000] dark:text-emerald-400">{vehicle.currentKm.toLocaleString('pt-BR')} km</span>
                              </div>
                            )}
                            {vehicle.currentFuelPercentage !== undefined && (
                              <div className="flex items-center space-x-1.5 text-[10px] mt-0.5" title={`Nível do Tanque: ${vehicle.currentFuelPercentage}%`}>
                                <Fuel className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                <span className="font-bold text-slate-800 dark:text-slate-200">{vehicle.currentFuelPercentage}%</span>
                                <div className="w-10 h-1.5 bg-black/10 dark:bg-stone-700 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full ${vehicle.currentFuelPercentage <= 20 ? 'bg-rose-500' : vehicle.currentFuelPercentage < 50 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                                    style={{ width: `${Math.min(100, Math.max(0, vehicle.currentFuelPercentage))}%` }} 
                                  />
                                </div>
                              </div>
                            )}
                            {!vehicle.hourMeter && !vehicle.currentKm && (
                              <span className="text-stone-500 dark:text-stone-400">--</span>
                            )}
                            
                            <button
                              onClick={() => handleOpenQuickMeter(vehicle)}
                              className="text-[10px] font-black text-[#000000] hover:text-stone-700 dark:text-sky-400 dark:hover:text-sky-300 hover:underline flex items-center space-x-1 mt-1 cursor-pointer"
                              title="Lançar nova leitura rápida de Horímetro ou KM"
                            >
                              <span className="text-[#000000] dark:text-sky-400">Atualizar</span>
                            </button>
                          </div>
                        </td>

                        {/* Motoristas Atribuídos */}
                        <td className="py-1 px-2 xl:px-2.5 align-top break-words">
                          {driversList.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {driversList.map((drv, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center text-xs font-bold px-2 py-0.5 bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 rounded uppercase break-words"
                                >
                                  👤 {drv.toUpperCase()}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-stone-400 dark:text-stone-500 text-xs italic uppercase">SEM MOTORISTA FIXO</span>
                          )}
                        </td>

                        {/* Custos Acumulados */}
                        <td className="py-1 px-2 xl:px-2.5 align-top">
                          <div className="font-bold text-[#000000] dark:text-stone-100 font-['Outfit'] text-xs sm:text-sm">
                            {formatCurrencyBRL(totalCost)}
                          </div>
                          <div className="text-[10px] text-[#000000] dark:text-stone-400 font-semibold">
                            Comb: {formatCurrencyBRL(totalFuel)}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-1 px-2 xl:px-2.5 align-top">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                            vehicle.status === 'operacional'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200'
                              : vehicle.status === 'em_manutencao'
                              ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200'
                              : vehicle.status === 'parado'
                              ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200'
                              : 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300 border border-stone-300'
                          }`}>
                            {vehicle.status === 'operacional' ? 'Operacional' :
                             vehicle.status === 'em_manutencao' ? 'Manutenção' :
                             vehicle.status === 'parado' ? 'Parado' : 'Disponível'}
                          </span>
                        </td>

                        {/* Ações */}
                        <td className="py-1 px-2 xl:px-2.5 text-right align-top">
                          <div className="flex items-center justify-end space-x-1">
                            
                            {/* Histórico & Lucro do Veículo */}
                            <button
                              onClick={() => onOpenHistory(vehicle)}
                              title="Acessar Histórico, Proventos & Lucro do Veículo"
                              className="p-1.5 text-pink-600 hover:text-pink-700 bg-pink-50 hover:bg-pink-100 dark:bg-pink-950/70 dark:text-pink-300 dark:hover:bg-pink-900/80 rounded-lg border border-pink-300 dark:border-pink-800 transition cursor-pointer shadow-2xs hover:scale-105"
                            >
                              <TrendingUp className="w-3.5 h-3.5 text-pink-600 dark:text-pink-400" />
                            </button>

                            {/* Abastecimento */}
                            <button
                              onClick={() => onNewFuelForVehicle(vehicle.id)}
                              title="Lançar Abastecimento"
                              className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/60 rounded-lg transition cursor-pointer"
                            >
                              <Fuel className="w-3.5 h-3.5" />
                            </button>

                            {/* Oficina */}
                            <button
                              onClick={() => onNewMaintenanceForVehicle(vehicle.id)}
                              title="Lançar Manutenção"
                              className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-lg transition cursor-pointer"
                            >
                              <Wrench className="w-3.5 h-3.5" />
                            </button>

                            {/* Editar */}
                            <button
                              onClick={() => onEditVehicle(vehicle)}
                              title="Editar Veículo"
                              className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            {/* Excluir */}
                            <button
                              onClick={() => onDeleteVehicle(vehicle.id)}
                              title="Excluir Veículo"
                              className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>

                          </div>
                        </td>

                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Vehicles Grid Card View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVehicles.map((vehicle) => {
            const totalFuel = getVehicleTotalFuel(vehicle.id);
            const totalMaint = getVehicleTotalMaintenance(vehicle.id);
            const totalCost = totalFuel + totalMaint;
            let driversList = vehicle.assignedDrivers && vehicle.assignedDrivers.length > 0
              ? vehicle.assignedDrivers
              : (vehicle.operatorOrDriver ? vehicle.operatorOrDriver.split(',').map(s => s.trim()).filter(Boolean) : []);
            if (driversList.length === 0 && (vehicle.assignedDriverIds?.length || (vehicle as any).user_id || (vehicle as any).driver_id)) {
              const candidateIds = vehicle.assignedDriverIds && vehicle.assignedDriverIds.length > 0
                ? vehicle.assignedDriverIds
                : [((vehicle as any).driver_id || (vehicle as any).user_id)];
              const resolved = candidateIds
                .map(id => employees.find(e => e.id === id || toValidUUID(e.id) === toValidUUID(id))?.name)
                .filter(Boolean) as string[];
              if (resolved.length > 0) {
                driversList = resolved;
              }
            }

            const isCavalo = vehicle.compositionType === 'cavalo';
            const isReboque = vehicle.compositionType === 'reboque' || (vehicle.categoryType || '').trim().toLowerCase() === 'reboque';
            const hasCoupledTrailer = vehicle.hasCoupledTrailer === false
              ? false
              : Boolean(vehicle.hasCoupledTrailer && (vehicle.coupledTrailerId || vehicle.reboque_vinculado_id || vehicle.trailerPlate || vehicle.coupledTrailerName));

            const coupledMach = (vehicle.coupledTrailerId || vehicle.reboque_vinculado_id)
              ? machineries.find(m => m.id === (vehicle.coupledTrailerId || vehicle.reboque_vinculado_id) || toValidUUID(m.id) === toValidUUID(vehicle.coupledTrailerId || vehicle.reboque_vinculado_id))
              : null;

            const trailerPlateDisplay = vehicle.trailerPlate || coupledMach?.licensePlateOrSerial || coupledMach?.placa_ou_serie || (vehicle.coupledTrailerName && vehicle.coupledTrailerName.includes('-') ? vehicle.coupledTrailerName.split('-')[0].trim() : (vehicle.coupledTrailerName || ''));
            const trailerModelDisplay = vehicle.trailerModel || coupledMach?.model || coupledMach?.modelo || coupledMach?.name || (vehicle.coupledTrailerName && vehicle.coupledTrailerName.includes('-') ? vehicle.coupledTrailerName.split('-').slice(1).join('-').trim() : (vehicle.coupledTrailerName || ''));
            const pbt = (vehicle.taraWeightKg && vehicle.capacityLoadKg)
              ? (vehicle.taraWeightKg + vehicle.capacityLoadKg)
              : vehicle.grossWeightKg;

            return (
              <div
                key={vehicle.id}
                className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-5 shadow-xs hover:border-sky-300 dark:hover:border-sky-700 transition flex flex-col justify-between space-y-4"
              >
                <div>
                  
                  {/* Top Bar: Plate + Status + Ownership */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      {vehicle.fleetNumber && (
                        <span className="font-mono text-xs font-black px-2 py-1 bg-blue-100 dark:bg-blue-900/60 text-[#000000] dark:text-blue-200 border border-blue-300 dark:border-blue-700 rounded-lg shadow-2xs">
                          #{vehicle.fleetNumber}
                        </span>
                      )}
                      <span className="font-black text-[#000000] dark:text-stone-100 font-mono text-sm px-2.5 py-1 bg-stone-100 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg shadow-2xs">
                        {vehicle.licensePlateOrSerial || '--'}
                      </span>
                      {(() => {
                        const badge = getOwnershipBadge(vehicle.ownership);
                        return (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border text-[#000000] dark:text-inherit ${badge.className}`}>
                            {badge.label}
                          </span>
                        );
                      })()}
                    </div>

                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${
                      vehicle.status === 'operacional'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200'
                        : vehicle.status === 'em_manutencao'
                        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200'
                        : 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300 border border-stone-300'
                    }`}>
                      {vehicle.status}
                    </span>
                  </div>

                  {/* Serial Number if tractor / machine */}
                  {vehicle.serialNumber && (
                    <div className="mt-2">
                      <span className="inline-flex items-center text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 px-2 py-0.5 rounded-md">
                        Nº Série: {vehicle.serialNumber}
                      </span>
                    </div>
                  )}

                  {/* Category Tag */}
                  {(() => {
                    const catTag = getVehicleCategoryTag(vehicle);
                    return (
                      <div className="mt-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border shadow-2xs ${catTag.style}`}>
                          {catTag.label}
                        </span>
                      </div>
                    );
                  })()}

                  {/* Title & Brand */}
                  <div className="mt-1.5 flex items-start justify-between">
                    <div>
                      <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 uppercase">
                        {(vehicle.model || vehicle.name || '').toUpperCase()}
                      </h3>
                      <p className="text-xs text-stone-500 dark:text-stone-400 uppercase">
                        <span className="font-semibold">{(vehicle.brand || 'Agrícola').toUpperCase()}</span> {vehicle.year ? <span className="normal-case">• Ano {vehicle.year}</span> : ''}
                        {vehicle.vehicleTypeDetailed ? ` • ${vehicle.vehicleTypeDetailed.toUpperCase()}` : ''}
                      </p>
                    </div>
                    {vehicle.capacityM3 !== undefined && vehicle.capacityM3 > 0 && (
                      <span className="px-2 py-1 bg-sky-50 dark:bg-sky-950/60 text-[#000000] dark:text-sky-300 text-xs font-black rounded-lg border border-sky-200 dark:border-sky-800 shrink-0">
                        {vehicle.capacityM3} m³
                      </span>
                    )}
                  </div>

                  {/* Composition Tags & Reboque Vinculado */}
                  {(isCavalo || isReboque || hasCoupledTrailer) && (
                    <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                      {isCavalo && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200">
                          🚛 Cavalo Mecânico
                        </span>
                      )}
                      {isReboque && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200">
                          🛞 Reboque{vehicle.trailerType ? `: ${vehicle.trailerType}` : ''}{vehicle.trailerAxlesCount ? ` (${vehicle.trailerAxlesCount} ${vehicle.trailerAxlesCount === 1 ? 'eixo' : 'eixos'})` : ''}
                        </span>
                      )}
                      {hasCoupledTrailer && (
                        <div className="w-full mt-1 p-2 rounded-lg bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase text-sky-900 dark:text-sky-200 flex items-center gap-1">
                              <span>🔗</span> Reboque Vinculado:
                            </span>
                            {trailerPlateDisplay && (
                              <span className="font-mono font-black text-[11px] bg-white dark:bg-stone-900 px-1.5 py-0.5 rounded border border-sky-300 text-sky-950 dark:text-sky-100">
                                {trailerPlateDisplay}
                              </span>
                            )}
                          </div>
                          {trailerModelDisplay && (
                            <div className="mt-1 text-[11px] font-semibold text-stone-800 dark:text-stone-200 uppercase">
                              {trailerModelDisplay.toUpperCase()}
                            </div>
                          )}
                          {(vehicle.trailerCapacityLoadKg || vehicle.trailerCapacityM3) && (
                            <div className="mt-0.5 text-[10px] text-stone-600 dark:text-stone-400">
                              Capacidade: {vehicle.trailerCapacityLoadKg ? `${vehicle.trailerCapacityLoadKg.toLocaleString('pt-BR')} kg` : ''}
                              {vehicle.trailerCapacityLoadKg && vehicle.trailerCapacityM3 ? ' • ' : ''}
                              {vehicle.trailerCapacityM3 ? `${vehicle.trailerCapacityM3} m³` : ''}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Owner Section (No Nome de Quem) */}
                  {vehicle.ownerName && (
                    <div className="mt-2.5 p-2 rounded-lg bg-stone-50 dark:bg-stone-800/60 border border-stone-100 dark:border-stone-800 text-[11px]">
                      <div className="text-stone-400 text-[10px] font-bold uppercase">No Nome de:</div>
                      <div className="font-bold text-stone-900 dark:text-stone-100">{vehicle.ownerName}</div>
                      {vehicle.ownerDocument && (
                        <div className="text-stone-500 font-mono text-[10px]">CPF/CNPJ: {vehicle.ownerDocument}</div>
                      )}
                    </div>
                  )}

                  {/* Technical Specs List */}
                  <div className="mt-3 pt-3 border-t border-stone-100 dark:border-stone-800 space-y-2 text-xs">
                    
                    {/* Weights (Tara / Lotação / PBT) */}
                    {(vehicle.taraWeightKg || vehicle.capacityLoadKg || pbt) && (
                      <div className="flex items-center justify-between text-[11px] bg-stone-50/70 dark:bg-stone-800/40 p-1.5 rounded-lg">
                        <span className="text-stone-500 font-semibold flex items-center space-x-1">
                          <Weight className="w-3 h-3 text-stone-400" />
                          <span>Pesos:</span>
                        </span>
                        <div className="text-right font-mono font-bold text-stone-800 dark:text-stone-200 space-x-2">
                          {vehicle.taraWeightKg && <span>Tara: {vehicle.taraWeightKg.toLocaleString('pt-BR')}kg</span>}
                          {vehicle.capacityLoadKg && <span>Lot: {vehicle.capacityLoadKg.toLocaleString('pt-BR')}kg</span>}
                          {pbt && <span className="text-sky-700 dark:text-sky-300">PBT: {pbt.toLocaleString('pt-BR')}kg</span>}
                        </div>
                      </div>
                    )}

                    {/* Motoristas */}
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-stone-500 flex items-center space-x-1">
                        <Users className="w-3.5 h-3.5" />
                        <span>Motoristas:</span>
                      </span>
                      <div className="text-right">
                        {driversList.length > 0 ? (
                          <div className="flex flex-wrap justify-end gap-1">
                            {driversList.map((drv, i) => (
                              <span key={i} className="font-semibold text-blue-700 dark:text-blue-300 text-[11px]">
                                {drv}{i < driversList.length - 1 ? ',' : ''}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-stone-400 italic text-[11px]">Não atribuído</span>
                        )}
                      </div>
                    </div>

                    {/* Odômetro / Horímetro + Quick update */}
                    <div className="flex items-center justify-between">
                      <span className="text-stone-500">Horímetro / KM:</span>
                      <div className="flex items-center space-x-2">
                        <div className="text-right font-mono font-bold text-stone-900 dark:text-stone-100">
                          {vehicle.hourMeter ? `${vehicle.hourMeter.toLocaleString('pt-BR')} h` : ''}
                          {vehicle.hourMeter && vehicle.currentKm ? ' | ' : ''}
                          {vehicle.currentKm ? `${vehicle.currentKm.toLocaleString('pt-BR')} km` : ''}
                          {!vehicle.hourMeter && !vehicle.currentKm ? '--' : ''}
                        </div>
                        <button
                          onClick={() => handleOpenQuickMeter(vehicle)}
                          title="Lançar Leitura Rápida"
                          className="p-1 rounded hover:bg-stone-200 dark:hover:bg-stone-700 text-sky-600 transition"
                        >
                          <Gauge className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Custos Acumulados */}
                    <div className="flex items-center justify-between">
                      <span className="text-stone-600 dark:text-stone-400 font-medium">Custos Acumulados:</span>
                      <span className="font-bold text-[#000000] dark:text-stone-100 font-['Outfit']">
                        {formatCurrencyBRL(totalCost)}
                      </span>
                    </div>

                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                    <button
                      onClick={() => onOpenHistory(vehicle)}
                      className="px-2.5 py-1.5 bg-pink-50 hover:bg-pink-100 text-pink-700 dark:bg-pink-950/70 dark:text-pink-300 border border-pink-300 dark:border-pink-800 rounded-lg text-xs font-bold flex items-center space-x-1 transition cursor-pointer shadow-xs"
                      title="Histórico & Lucro do Veículo"
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>Histórico</span>
                    </button>
                    <button
                      onClick={() => onNewFuelForVehicle(vehicle.id)}
                      className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 rounded-lg text-xs font-bold flex items-center space-x-1 transition cursor-pointer"
                    >
                      <Fuel className="w-3.5 h-3.5" />
                      <span>Abastecer</span>
                    </button>
                    <button
                      onClick={() => onNewMaintenanceForVehicle(vehicle.id)}
                      className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 rounded-lg text-xs font-bold flex items-center space-x-1 transition cursor-pointer"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span>Oficina</span>
                    </button>
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => onEditVehicle(vehicle)}
                      className="p-1.5 text-stone-500 hover:text-stone-900 dark:hover:text-white rounded-lg transition cursor-pointer"
                      title="Editar"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDeleteVehicle(vehicle.id)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg transition cursor-pointer"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      </div>
      )}

      {/* Quick Meter Reading Modal */}
      {quickMeterVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
              <div>
                <h3 className="font-bold text-base text-stone-900 dark:text-stone-100 flex items-center space-x-2">
                  <Gauge className="w-5 h-5 text-sky-600" />
                  <span>Atualizar Leitura do Medidor</span>
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                  <span className="uppercase font-semibold">{(quickMeterVehicle.model || quickMeterVehicle.name || '').toUpperCase()}</span> • Placa: {(quickMeterVehicle.licensePlateOrSerial || quickMeterVehicle.serialNumber || '--').toUpperCase()}
                </p>
              </div>
              <button
                onClick={() => setQuickMeterVehicle(null)}
                className="p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {quickMeterFeedback ? (
              <div className="p-4 rounded-xl bg-emerald-50 text-emerald-800 font-bold text-sm text-center border border-emerald-200">
                {quickMeterFeedback}
              </div>
            ) : (
              <form onSubmit={handleSaveQuickMeter} className="space-y-4">
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1 flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      <span>Horímetro Atual (h)</span>
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="Ex: 1450.5"
                      value={quickHourMeter}
                      onChange={(e) => setQuickHourMeter(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-mono font-bold focus:ring-2 focus:ring-sky-600"
                    />
                    <span className="text-[10px] text-stone-400">Tratores, Ensiladeiras, Pás</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1 flex items-center space-x-1">
                      <Gauge className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Odômetro Atual (km)</span>
                    </label>
                    <input
                      type="number"
                      step="1"
                      placeholder="Ex: 85200"
                      value={quickKm}
                      onChange={(e) => setQuickKm(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-mono font-bold focus:ring-2 focus:ring-sky-600"
                    />
                    <span className="text-[10px] text-stone-400">Caminhões, Camionetes</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setQuickMeterVehicle(null)}
                    className="px-4 py-2 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 text-xs font-bold hover:bg-stone-100 dark:hover:bg-stone-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-md shadow-sky-600/20"
                  >
                    Salvar Leitura
                  </button>
                </div>

              </form>
            )}

          </div>
        </div>
      )}

      {/* Modal Nativo de Gerenciamento de Categorias de Veículos */}
      <VehicleCategoriesModal
        isOpen={isCategoriesModalOpen}
        onClose={() => setIsCategoriesModalOpen(false)}
        categories={systemCategories}
        onSaveCategories={handleSaveCategories}
        onSelectCategory={(cat) => {
          setSelectedGroupCategory(cat);
          setIsCategoriesModalOpen(false);
        }}
      />

      {/* Modal Nativo de Gerenciamento de Subgrupos de Manutenção */}
      <MaintenanceCategoriesModal
        isOpen={isMaintenanceCategoriesModalOpen}
        onClose={() => setIsMaintenanceCategoriesModalOpen(false)}
        categories={maintenanceCategories}
        onSaveCategories={handleSaveMaintenanceCategories}
        onSelectCategory={(catName) => {
          setFilterSubgroup(catName.toUpperCase());
          setIsMaintenanceCategoriesModalOpen(false);
        }}
      />

      {/* Print Preview Modal */}
      {printOptions && (
        <PrintPreviewModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          options={printOptions}
        />
      )}

    </div>
  );
};
