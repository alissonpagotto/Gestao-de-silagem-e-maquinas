import React, { useState, useEffect } from 'react';
import { 
  X, 
  Settings, 
  Plus, 
  Trash2, 
  Edit2, 
  Pencil,
  Check, 
  Layers, 
  CircleDot, 
  Info,
  CheckCircle2,
  Car,
  AlertTriangle
} from 'lucide-react';
import { VehicleTypeDefinition, VehicleAxleConfig, PreventiveGroupItem, InventoryItem } from '../../types';
import { 
  StoredAxleConfigOption,
  getStoredAxleConfigurations,
  saveStoredAxleConfigurations,
  buildDynamicAxleConfig
} from '../../lib/tireAndAxlePresets';
import { 
  getStoredInventory, 
  getStoredPreventiveGroupPlans, 
  saveStoredPreventiveGroupPlans,
  DEFAULT_PREVENTIVE_PLANS_BY_CATEGORY 
} from '../../lib/storage';

interface VehicleTypesConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicleTypes: VehicleTypeDefinition[];
  onSaveVehicleTypes: (types: VehicleTypeDefinition[]) => void;
}

export const VehicleTypesConfigModal: React.FC<VehicleTypesConfigModalProps> = ({
  isOpen,
  onClose,
  vehicleTypes,
  onSaveVehicleTypes,
}) => {
  const [typesList, setTypesList] = useState<VehicleTypeDefinition[]>(vehicleTypes);
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [typeName, setTypeName] = useState('');
  const [typeDescription, setTypeDescription] = useState('');

  // Lista dinâmica de configurações de eixos lida do LocalStorage ('colaca_silagem_configuracoes_eixos_base')
  const [axleConfigsList, setAxleConfigsList] = useState<StoredAxleConfigOption[]>(() => getStoredAxleConfigurations());
  const [selectedPresetKey, setSelectedPresetKey] = useState<string>(() => {
    const list = getStoredAxleConfigurations();
    return list[0]?.key || 'caminhao_trucado_3e_10r';
  });

  // Modal interno de inclusão / edição de configuração de eixos
  const [isAxleModalOpen, setIsAxleModalOpen] = useState(false);
  const [editingAxleKey, setEditingAxleKey] = useState<string | null>(null);
  const [axleFormName, setAxleFormName] = useState('');
  const [axleFormAxles, setAxleFormAxles] = useState<number>(2);
  const [axleFormTires, setAxleFormTires] = useState<number>(4);

  // Confirmação de segurança na exclusão de configuração de eixo
  const [confirmDeleteAxleConfig, setConfirmDeleteAxleConfig] = useState<StoredAxleConfigOption | null>(null);
  // Confirmação de segurança na exclusão de tipo de veículo
  const [confirmDeleteVehicleType, setConfirmDeleteVehicleType] = useState<VehicleTypeDefinition | null>(null);

  // Estados para o PLANO PREVENTIVO DO GRUPO (Fluidos, Filtros & Revisões)
  const [preventivePlanItems, setPreventivePlanItems] = useState<PreventiveGroupItem[]>([]);
  const [prevSearchQuery, setPrevSearchQuery] = useState('');
  const [prevSelectedProduct, setPrevSelectedProduct] = useState<InventoryItem | null>(null);
  const [prevIntervalHoursKm, setPrevIntervalHoursKm] = useState<number | ''>(250);
  const [prevStandardQty, setPrevStandardQty] = useState<number | ''>(1);
  const [prevUnit, setPrevUnit] = useState('UN');
  const [isPrevDropdownOpen, setIsPrevDropdownOpen] = useState(false);
  const [allInventoryItems, setAllInventoryItems] = useState<InventoryItem[]>(() => getStoredInventory());

  useEffect(() => {
    setAllInventoryItems(getStoredInventory());
  }, [isOpen]);

  const productSearchResults = React.useMemo(() => {
    if (!prevSearchQuery.trim()) return [];
    const q = prevSearchQuery.toLowerCase().trim();
    return allInventoryItems.filter(item => {
      const anyItem = item as any;
      const name = String(item.nome_comercial || item.name || '').toLowerCase();
      const code = String(item.code || anyItem.codigo || '').toLowerCase();
      const cat = String(item.categoria || item.category || '').toLowerCase();
      return name.includes(q) || code.includes(q) || cat.includes(q);
    }).slice(0, 8);
  }, [prevSearchQuery, allInventoryItems]);

  const handleSelectProduct = (prod: InventoryItem) => {
    setPrevSelectedProduct(prod);
    setPrevSearchQuery(String(prod.nome_comercial || prod.name || '').toUpperCase());
    setPrevUnit(String(prod.unit || prod.unidade_medida || 'UN').toUpperCase());
    setIsPrevDropdownOpen(false);
  };

  const handleAddPreventiveRule = () => {
    const rawName = prevSearchQuery.trim().toUpperCase();
    if (!rawName) return;
    const interval = typeof prevIntervalHoursKm === 'number' && prevIntervalHoursKm > 0 ? prevIntervalHoursKm : 250;
    const qty = typeof prevStandardQty === 'number' && prevStandardQty > 0 ? prevStandardQty : 1;
    const unit = prevSelectedProduct?.unit || prevSelectedProduct?.unidade_medida || prevUnit || 'UN';

    const newItem: PreventiveGroupItem = {
      id: `prev_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      PRODUTO_ID: prevSelectedProduct?.id,
      ITEM_NOME: rawName,
      INTERVALO_HORAS_KM: interval,
      QUANTIDADE_PADRAO: qty,
      unidade: unit.toUpperCase(),
    };

    setPreventivePlanItems(prev => [...prev, newItem]);
    setPrevSearchQuery('');
    setPrevSelectedProduct(null);
    setPrevIntervalHoursKm(250);
    setPrevStandardQty(1);
    setPrevUnit('UN');
    setIsPrevDropdownOpen(false);
  };

  const handleRemovePreventiveRule = (index: number) => {
    setPreventivePlanItems(prev => prev.filter((_, i) => i !== index));
  };

  // Alerta / Toast discreto de feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sincroniza typesList quando a prop vehicleTypes mudar
  useEffect(() => {
    setTypesList(vehicleTypes);
  }, [vehicleTypes]);

  // Sincronização reativa de configurações de eixos
  useEffect(() => {
    const handleAxleSync = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setAxleConfigsList(e.detail);
      } else {
        setAxleConfigsList(getStoredAxleConfigurations());
      }
    };
    window.addEventListener('colaca_silagem_configuracoes_eixos_updated', handleAxleSync);
    return () => window.removeEventListener('colaca_silagem_configuracoes_eixos_updated', handleAxleSync);
  }, []);

  // Auto-dismiss do feedback toast
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 3200);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Garante que selectedPresetKey tenha um valor válido
  useEffect(() => {
    if (axleConfigsList.length > 0 && !axleConfigsList.some((c) => c.key === selectedPresetKey)) {
      setSelectedPresetKey(axleConfigsList[0].key);
    }
  }, [axleConfigsList, selectedPresetKey]);

  const currentSelectedAxleConfig = axleConfigsList.find((p) => p.key === selectedPresetKey) || axleConfigsList[0];

  // Iniciar inclusão de Tipo de Veículo
  const handleStartCreate = () => {
    setEditingTypeId('new');
    setTypeName('');
    setTypeDescription('');
    setPreventivePlanItems([]);
    setPrevSearchQuery('');
    setPrevSelectedProduct(null);
    if (axleConfigsList.length > 0) {
      setSelectedPresetKey(axleConfigsList[0].key);
    }
  };

  // Iniciar edição de Tipo de Veículo
  const handleStartEdit = (t: VehicleTypeDefinition) => {
    setEditingTypeId(t.id);
    setTypeName(t.name);
    setTypeDescription(t.description || '');

    // Carrega regras preventivas existentes ou padrões do grupo
    const upperName = t.name.toUpperCase();
    const storedPlans = getStoredPreventiveGroupPlans();
    const existingRules = t.PLANO_PREVENTIVO_GRUPO && t.PLANO_PREVENTIVO_GRUPO.length > 0
      ? t.PLANO_PREVENTIVO_GRUPO
      : (storedPlans[upperName] || DEFAULT_PREVENTIVE_PLANS_BY_CATEGORY[upperName] || []);
    setPreventivePlanItems(existingRules);
    setPrevSearchQuery('');
    setPrevSelectedProduct(null);

    // Busca correspondência de configuração de eixos por código, nome ou (eixos + pneus)
    const matched = axleConfigsList.find(
      (p) =>
        p && t?.defaultAxleConfig && (
          p.key === t.defaultAxleConfig.code ||
          String(p.label || '').toLowerCase() === String(t.defaultAxleConfig.name || '').toLowerCase() ||
          (p.totalAxles === t.defaultAxleConfig.totalAxles && p.totalTires === t.defaultAxleConfig.totalTires)
        )
    );
    if (matched) {
      setSelectedPresetKey(matched.key);
    } else if (axleConfigsList.length > 0) {
      setSelectedPresetKey(axleConfigsList[0].key);
    }
  };

  // Salvar Tipo de Veículo (grava em 'colaca_silagem_tipos_veiculos', 'agrocontrol_tipos_veiculos_planos' e no estado)
  const handleSaveItem = () => {
    if (!typeName.trim()) return;

    const chosenPreset = axleConfigsList.find((p) => p.key === selectedPresetKey) || axleConfigsList[0];
    const upperName = typeName.trim().toUpperCase();

    if (editingTypeId === 'new') {
      const newType: VehicleTypeDefinition = {
        id: `vt_${Date.now()}`,
        name: typeName.trim(),
        categoryKey: 'personalizado',
        defaultAxleConfig: chosenPreset.config,
        description: typeDescription.trim(),
        isCustom: true,
        PLANO_PREVENTIVO_GRUPO: preventivePlanItems,
      };
      const updated = [...typesList, newType];
      setTypesList(updated);
      onSaveVehicleTypes(updated);
      localStorage.setItem('colaca_silagem_tipos_veiculos', JSON.stringify(updated));
      localStorage.setItem('agrocontrol_frotas_tipos', JSON.stringify(updated));

      // Sincroniza plano preventivo no mapa centralizado
      const allPlans = getStoredPreventiveGroupPlans();
      allPlans[upperName] = preventivePlanItems;
      saveStoredPreventiveGroupPlans(allPlans);

      setToastMessage(`Tipo de veículo "${newType.name}" salvo com sucesso!`);
    } else if (editingTypeId) {
      const updated = typesList.map((t) => {
        if (t.id === editingTypeId) {
          return {
            ...t,
            name: typeName.trim(),
            categoryKey: t.categoryKey || 'personalizado',
            description: typeDescription.trim(),
            defaultAxleConfig: chosenPreset.config,
            PLANO_PREVENTIVO_GRUPO: preventivePlanItems,
          };
        }
        return t;
      });
      setTypesList(updated);
      onSaveVehicleTypes(updated);
      localStorage.setItem('colaca_silagem_tipos_veiculos', JSON.stringify(updated));
      localStorage.setItem('agrocontrol_frotas_tipos', JSON.stringify(updated));

      // Sincroniza plano preventivo no mapa centralizado
      const allPlans = getStoredPreventiveGroupPlans();
      allPlans[upperName] = preventivePlanItems;
      saveStoredPreventiveGroupPlans(allPlans);

      setToastMessage('Tipo de veículo atualizado com sucesso!');
    }

    setEditingTypeId(null);
    setTypeName('');
    setTypeDescription('');
    setPreventivePlanItems([]);
  };

  // Solicitar exclusão de Tipo de Veículo
  const handleRequestDeleteType = (t: VehicleTypeDefinition) => {
    if (typesList.length <= 1) {
      alert('Atenção: É necessário manter ao menos um tipo de veículo cadastrado.');
      return;
    }
    setConfirmDeleteVehicleType(t);
  };

  // Confirmar exclusão de Tipo de Veículo
  const handleConfirmDeleteType = () => {
    if (!confirmDeleteVehicleType) return;
    const updated = typesList.filter((t) => t.id !== confirmDeleteVehicleType.id);
    setTypesList(updated);
    onSaveVehicleTypes(updated);
    localStorage.setItem('colaca_silagem_tipos_veiculos', JSON.stringify(updated));
    setToastMessage(`Tipo "${confirmDeleteVehicleType.name}" removido com sucesso!`);
    setConfirmDeleteVehicleType(null);
  };

  // ========================================================
  // AÇÕES DE CONFIGURAÇÃO DE EIXOS (PLUS / PENCIL / TRASH2)
  // ========================================================

  // Abrir modal de Nova Configuração
  const handleOpenNewAxleConfig = () => {
    setEditingAxleKey(null);
    setAxleFormName('');
    setAxleFormAxles(2);
    setAxleFormTires(4);
    setIsAxleModalOpen(true);
  };

  // Abrir modal para Editar Configuração Selecionada
  const handleOpenEditCurrentAxleConfig = () => {
    const current = currentSelectedAxleConfig;
    if (!current) return;
    setEditingAxleKey(current.key);
    setAxleFormName(current.label.toUpperCase());
    setAxleFormAxles(current.totalAxles);
    setAxleFormTires(current.totalTires);
    setIsAxleModalOpen(true);
  };

  // Salvar Configuração de Eixo (Nova ou Editada)
  const handleSaveAxleConfig = () => {
    const cleanName = axleFormName.trim().toUpperCase();
    if (!cleanName) return;

    const safeAxles = Math.max(1, Math.min(12, Number(axleFormAxles) || 1));
    const safeTires = Math.max(safeAxles * 2, Math.min(48, Number(axleFormTires) || safeAxles * 2));

    if (editingAxleKey) {
      // Editar existente
      const updatedConfigs = axleConfigsList.map((item) => {
        if (item.key === editingAxleKey) {
          const dynamicConfig = buildDynamicAxleConfig(safeAxles, safeTires, cleanName, cleanName);
          dynamicConfig.code = item.key;
          dynamicConfig.name = cleanName;
          return {
            ...item,
            label: cleanName,
            totalAxles: safeAxles,
            totalTires: safeTires,
            config: dynamicConfig,
          };
        }
        return item;
      });

      setAxleConfigsList(updatedConfigs);
      saveStoredAxleConfigurations(updatedConfigs);

      // Atualiza também os tipos de veículos que usavam essa configuração
      const updatedTypes = typesList.map((t) => {
        if (t.defaultAxleConfig.code === editingAxleKey) {
          const found = updatedConfigs.find((u) => u.key === editingAxleKey);
          if (found) {
            return { ...t, defaultAxleConfig: found.config };
          }
        }
        return t;
      });
      setTypesList(updatedTypes);
      onSaveVehicleTypes(updatedTypes);
      localStorage.setItem('colaca_silagem_tipos_veiculos', JSON.stringify(updatedTypes));

      setToastMessage(`Configuração "${cleanName}" atualizada com sucesso!`);
    } else {
      // Inserir nova configuração
      const newKey = `axle_cfg_${Date.now()}`;
      const dynamicConfig = buildDynamicAxleConfig(safeAxles, safeTires, cleanName, cleanName);
      dynamicConfig.code = newKey;
      dynamicConfig.name = cleanName;

      const newOption: StoredAxleConfigOption = {
        key: newKey,
        label: cleanName,
        totalAxles: safeAxles,
        totalTires: safeTires,
        config: dynamicConfig,
        isCustom: true,
      };

      const updatedConfigs = [...axleConfigsList, newOption];
      setAxleConfigsList(updatedConfigs);
      saveStoredAxleConfigurations(updatedConfigs);
      setSelectedPresetKey(newKey);
      setToastMessage(`Configuração "${cleanName}" cadastrada com sucesso!`);
    }

    setIsAxleModalOpen(false);
  };

  // Solicitar exclusão com trava de segurança
  const handleRequestDeleteAxleConfig = () => {
    if (axleConfigsList.length <= 1) {
      alert('Atenção: É necessário manter ao menos uma configuração de eixos cadastrada na lista.');
      return;
    }
    const current = currentSelectedAxleConfig;
    if (current) {
      setConfirmDeleteAxleConfig(current);
    }
  };

  // Confirmar exclusão de Configuração de Eixo
  const handleConfirmDeleteAxleConfig = () => {
    if (!confirmDeleteAxleConfig) return;

    const remaining = axleConfigsList.filter((c) => c.key !== confirmDeleteAxleConfig.key);
    setAxleConfigsList(remaining);
    saveStoredAxleConfigurations(remaining);

    if (selectedPresetKey === confirmDeleteAxleConfig.key) {
      setSelectedPresetKey(remaining[0]?.key || '');
    }

    setToastMessage(`Configuração "${confirmDeleteAxleConfig.label}" excluída com sucesso!`);
    setConfirmDeleteAxleConfig(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-stone-900 rounded-2xl max-w-3xl w-full border border-stone-200 dark:border-stone-800 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden relative">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/80 dark:bg-stone-800/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 font-['Outfit']">
                Tipos de Veículos &amp; Configuração de Eixos
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Personalize os tipos de frota e a quantidade padrão de eixos e pneus
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Discrete Toast Alert */}
        {toastMessage && (
          <div className="mx-5 mt-3 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center justify-between animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{toastMessage}</span>
            </div>
            <button 
              type="button" 
              onClick={() => setToastMessage(null)}
              className="text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-300 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Content (Slim design sem barra de rolagem externa indesejada) */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 scrollbar-none">
          
          {/* Form Create / Edit Superior */}
          {editingTypeId !== null ? (
            <div className="p-4 rounded-xl border border-sky-200 dark:border-sky-900/60 bg-sky-50/40 dark:bg-sky-950/20 space-y-3.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-sky-700 dark:text-sky-400">
                  {editingTypeId === 'new' ? 'Novo Tipo de Veículo' : 'Editar Tipo de Veículo'}
                </h4>
                <button
                  type="button"
                  onClick={() => setEditingTypeId(null)}
                  className="text-xs text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 font-medium"
                >
                  Cancelar
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Nome do Tipo de Veículo *
                  </label>
                  <input
                    type="text"
                    value={typeName}
                    onChange={(e) => setTypeName(e.target.value)}
                    placeholder="Ex: Caminhão Roll-on, Trator 8R, etc."
                    className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-stone-700 dark:text-stone-300">
                      Configuração de Eixos &amp; Pneus *
                    </label>
                    <span className="text-[10px] text-stone-500 dark:text-stone-400 font-medium">
                      {currentSelectedAxleConfig?.totalAxles || 0} Eixos • {currentSelectedAxleConfig?.totalTires || 0} Pneus
                    </span>
                  </div>

                  {/* Dropdown com os botões de ação rápida [Plus], [Pencil] e [Trash2] ao lado direito */}
                  <div className="flex items-center gap-1.5">
                    <select
                      value={selectedPresetKey}
                      onChange={(e) => setSelectedPresetKey(e.target.value)}
                      className="flex-1 min-w-0 px-3 py-2 text-xs font-semibold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                    >
                      {axleConfigsList.map((p) => (
                        <option key={p.key} value={p.key}>
                          {p.label}
                        </option>
                      ))}
                    </select>

                    {/* Container horizontal com as ações rápidas */}
                    <div className="flex items-center gap-1 shrink-0 bg-stone-100 dark:bg-stone-800/80 p-1 rounded-lg border border-stone-200 dark:border-stone-700">
                      <button
                        type="button"
                        onClick={handleOpenNewAxleConfig}
                        className="p-1.5 rounded-md text-stone-600 dark:text-stone-300 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-white dark:hover:bg-stone-700 transition shadow-2xs cursor-pointer"
                        title="Nova Configuração de Eixo (+)"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenEditCurrentAxleConfig}
                        disabled={axleConfigsList.length === 0}
                        className="p-1.5 rounded-md text-stone-600 dark:text-stone-300 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-white dark:hover:bg-stone-700 transition shadow-2xs disabled:opacity-40 cursor-pointer"
                        title="Editar Configuração Selecionada"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={handleRequestDeleteAxleConfig}
                        disabled={axleConfigsList.length <= 1}
                        className="p-1.5 rounded-md text-stone-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-white dark:hover:bg-stone-700 transition shadow-2xs disabled:opacity-40 cursor-pointer"
                        title="Excluir Configuração da Lista"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Descrição / Notas
                </label>
                <input
                  type="text"
                  value={typeDescription}
                  onChange={(e) => setTypeDescription(e.target.value)}
                  placeholder="Ex: Utilizado para transporte pesado de biomassa"
                  className="w-full px-3 py-2 text-xs font-normal rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                />
              </div>

              {/* SEÇÃO MICRO TABELA: PLANO PREVENTIVO DO GRUPO (REGRAS DE FÁBRICA / REVISÕES) */}
              <div className="p-3.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-3">
                <div className="flex items-center justify-between border-b border-emerald-200 dark:border-emerald-800/60 pb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm">📋</span>
                    <div>
                      <h5 className="text-xs font-black uppercase tracking-wider text-emerald-900 dark:text-emerald-300">
                        PLANO PREVENTIVO DO GRUPO (FLUIDOS, FILTROS &amp; REVISÕES)
                      </h5>
                      <p className="text-[10.5px] text-emerald-700 dark:text-emerald-400 font-medium">
                        Regras de fábrica vinculadas aos produtos do estoque (chave &apos;agrocontrol_produtos&apos;).
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700">
                    {preventivePlanItems.length} REGRA(S) ATIVA(S)
                  </span>
                </div>

                {/* Formulário Superior de Inclusão com Autocomplete Real */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                  {/* Campo 1: Autocomplete Produto / Nome */}
                  <div className="sm:col-span-5 relative">
                    <label className="block text-[10.5px] font-bold uppercase text-emerald-950 dark:text-emerald-200 mb-1">
                      ITEM / PRODUTO DO ESTOQUE *
                    </label>
                    <input
                      type="text"
                      value={prevSearchQuery}
                      onChange={(e) => {
                        setPrevSearchQuery(e.target.value.toUpperCase());
                        setIsPrevDropdownOpen(true);
                        setPrevSelectedProduct(null);
                      }}
                      onFocus={() => setIsPrevDropdownOpen(true)}
                      placeholder="DIGITE O NOME OU CÓDIGO (EX: ÓLEO 15W40)..."
                      className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs uppercase placeholder:text-stone-400"
                    />

                    {/* Dropdown de Sugestões Autocomplete */}
                    {isPrevDropdownOpen && productSearchResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-white dark:bg-stone-800 border border-emerald-300 dark:border-emerald-700 rounded-lg shadow-xl max-h-48 overflow-y-auto divide-y divide-stone-100 dark:divide-stone-700">
                        {productSearchResults.map((prod) => (
                          <button
                            key={prod.id}
                            type="button"
                            onClick={() => handleSelectProduct(prod)}
                            className="w-full text-left p-2 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 flex items-center justify-between text-xs cursor-pointer transition"
                          >
                            <div className="min-w-0 pr-2">
                              <p className="font-bold text-stone-900 dark:text-stone-100 uppercase truncate">
                                {prod.nome_comercial || prod.name}
                              </p>
                              <p className="text-[10px] text-stone-500 dark:text-stone-400">
                                {prod.code ? `Cód: ${prod.code} • ` : ''}Cat: {prod.categoria || prod.category || 'Geral'}
                              </p>
                            </div>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 shrink-0 uppercase">
                              {prod.unit || 'UN'}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Campo 2: Intervalo (Horas / KM) */}
                  <div className="sm:col-span-3">
                    <label className="block text-[10.5px] font-bold uppercase text-emerald-950 dark:text-emerald-200 mb-1">
                      INTERVALO (H / KM) *
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={prevIntervalHoursKm}
                      onChange={(e) => setPrevIntervalHoursKm(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="Ex: 250"
                      className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                    />
                  </div>

                  {/* Campo 3: Quantidade Padrão */}
                  <div className="sm:col-span-2">
                    <label className="block text-[10.5px] font-bold uppercase text-emerald-950 dark:text-emerald-200 mb-1">
                      QTD PADRÃO *
                    </label>
                    <div className="flex items-center">
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={prevStandardQty}
                        onChange={(e) => setPrevStandardQty(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="Ex: 38"
                        className="w-full px-2 py-1.5 text-xs font-bold rounded-l-lg border border-r-0 border-emerald-300 dark:border-emerald-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                      />
                      <span className="px-2 py-1.5 bg-emerald-100 dark:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-700 rounded-r-lg text-[10px] font-bold text-emerald-900 dark:text-emerald-200 uppercase">
                        {prevUnit}
                      </span>
                    </div>
                  </div>

                  {/* Botão Incluir Regra */}
                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={handleAddPreventiveRule}
                      disabled={!prevSearchQuery.trim()}
                      className="w-full py-1.5 px-3 text-xs font-bold uppercase rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white shadow-2xs transition cursor-pointer flex items-center justify-center space-x-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>INCLUIR</span>
                    </button>
                  </div>
                </div>

                {/* Micro Tabela Zebrada com os Itens do Grupo */}
                <div className="border border-emerald-200 dark:border-emerald-800/60 rounded-lg overflow-hidden bg-white dark:bg-stone-900">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-emerald-100/70 dark:bg-emerald-950/60 border-b border-emerald-200 dark:border-emerald-800/60 text-emerald-950 dark:text-emerald-200 text-[10px] uppercase font-black tracking-wider">
                        <th className="py-1 px-3">ITEM / FLUIDO RECOMENDADO</th>
                        <th className="py-1 px-2.5 text-center">INTERVALO</th>
                        <th className="py-1 px-2.5 text-center">QTD PADRÃO</th>
                        <th className="py-1 px-2 text-center">VÍNCULO ESTOQUE</th>
                        <th className="py-1 px-2 text-right">AÇÕES</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-100 dark:divide-emerald-900/30">
                      {preventivePlanItems.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-3 px-3 text-center text-xs text-stone-500 dark:text-stone-400 italic">
                            Nenhuma regra preventiva personalizada cadastrada. O sistema aplicará os intervalos padrão da fábrica.
                          </td>
                        </tr>
                      ) : (
                        preventivePlanItems.map((rule, idx) => (
                          <tr key={rule.id || idx} className={idx % 2 === 0 ? 'bg-white dark:bg-stone-900' : 'bg-emerald-50/30 dark:bg-stone-850'}>
                            <td className="py-1 px-3 font-bold text-stone-900 dark:text-stone-100 uppercase text-xs whitespace-nowrap">
                              {rule.ITEM_NOME}
                            </td>
                            <td className="py-1 px-2.5 text-center font-bold text-stone-700 dark:text-stone-300 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-[10px]">
                                {rule.INTERVALO_HORAS_KM} H/KM
                              </span>
                            </td>
                            <td className="py-1 px-2.5 text-center font-bold text-emerald-800 dark:text-emerald-300 whitespace-nowrap">
                              {rule.QUANTIDADE_PADRAO} {rule.unidade || 'UN'}
                            </td>
                            <td className="py-1 px-2 text-center whitespace-nowrap">
                              {rule.PRODUTO_ID ? (
                                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.2 rounded">
                                  PRODUTO VINCULADO
                                </span>
                              ) : (
                                <span className="text-[9px] font-semibold text-stone-500 bg-stone-100 dark:bg-stone-800 px-1.5 py-0.2 rounded">
                                  DESCRITIVO LIVRE
                                </span>
                              )}
                            </td>
                            <td className="py-1 px-2 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleRemovePreventiveRule(idx)}
                                className="p-1 rounded text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
                                title="Remover regra preventiva do grupo"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleSaveItem}
                  disabled={!typeName.trim()}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white shadow-xs transition cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Salvar Tipo de Veículo</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-between items-center">
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Tipos disponíveis no cadastro ({typesList.length})
              </p>
              <button
                type="button"
                onClick={handleStartCreate}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-sky-600 hover:bg-sky-700 text-white shadow-xs transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Adicionar Tipo</span>
              </button>
            </div>
          )}

          {/* List of Types */}
          <div className="border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden divide-y divide-stone-200 dark:divide-stone-800">
            {typesList.map((t) => (
              <div
                key={t.id}
                className="p-3.5 flex items-center justify-between hover:bg-stone-50 dark:hover:bg-stone-800/40 transition gap-3"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                      {t.name}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                      {t.defaultAxleConfig.totalAxles} Eixos • {t.defaultAxleConfig.totalTires} Pneus
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      {(t.PLANO_PREVENTIVO_GRUPO?.length ?? (getStoredPreventiveGroupPlans()[t.name.toUpperCase()]?.length || DEFAULT_PREVENTIVE_PLANS_BY_CATEGORY[t.name.toUpperCase()]?.length || 0))} REGRAS PREVENTIVAS
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                    {t.description || t.defaultAxleConfig.name}
                  </p>
                </div>

                <div className="flex items-center space-x-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleStartEdit(t)}
                    className="p-1.5 rounded-lg text-stone-500 hover:text-sky-600 hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
                    title="Editar"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRequestDeleteType(t)}
                    className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                    title="Excluir"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/40 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:text-stone-900 transition cursor-pointer"
          >
            Concluir
          </button>
        </div>

        {/* ========================================================
            MODAL INTERNO: NOVA / EDITAR CONFIGURAÇÃO DE EIXOS
            ======================================================== */}
        {isAxleModalOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-2xs animate-in fade-in duration-150">
            <div className="bg-white dark:bg-stone-900 rounded-xl max-w-md w-full border border-stone-200 dark:border-stone-800 shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded-lg bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                    <Settings className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                    {editingAxleKey ? 'Editar Configuração de Eixos' : 'Nova Configuração de Eixos'}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAxleModalOpen(false)}
                  className="p-1 rounded-md text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Nome Identificador da Configuração *
                  </label>
                  <input
                    type="text"
                    value={axleFormName}
                    onChange={(e) => setAxleFormName(e.target.value.toUpperCase())}
                    placeholder="Ex: CAMINHÃO BITRUCK (4 EIXOS / 12 RODAS)"
                    className="w-full px-3 py-2 text-xs font-semibold uppercase rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                    autoFocus
                  />
                  <p className="text-[10px] text-stone-400 mt-1">
                    Digitado automaticamente em caixa alta (maiúsculas).
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                      Quantidade de Eixos *
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={axleFormAxles}
                      onChange={(e) => setAxleFormAxles(Math.max(1, Math.min(12, parseInt(e.target.value) || 1)))}
                      className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                      Quantidade Total de Pneus/Rodas *
                    </label>
                    <input
                      type="number"
                      min={2}
                      max={48}
                      value={axleFormTires}
                      onChange={(e) => setAxleFormTires(Math.max(2, Math.min(48, parseInt(e.target.value) || 2)))}
                      className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                    />
                  </div>
                </div>

                {/* Resumo visual da configuração */}
                <div className="p-2.5 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900/60 flex items-center justify-between text-xs">
                  <span className="text-sky-700 dark:text-sky-300 font-medium">
                    Estrutura Calculada:
                  </span>
                  <span className="font-bold text-sky-900 dark:text-sky-100">
                    {axleFormAxles} Eixos • {axleFormTires} Pneus
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-stone-200 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsAxleModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-medium rounded-lg text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveAxleConfig}
                  disabled={!axleFormName.trim()}
                  className="inline-flex items-center space-x-1.5 px-4 py-1.5 text-xs font-bold rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white shadow-xs transition cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Salvar Configuração</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DE CONFIGURAÇÃO DE EIXOS
            ======================================================== */}
        {confirmDeleteAxleConfig && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-2xs animate-in fade-in duration-150">
            <div className="bg-white dark:bg-stone-900 rounded-xl max-w-sm w-full border border-stone-200 dark:border-stone-800 shadow-2xl p-5 space-y-3.5 animate-in zoom-in-95 duration-150">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="text-center space-y-1">
                <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                  Excluir Configuração de Eixos?
                </h4>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Tem certeza que deseja excluir permanentemente a configuração <span className="font-bold text-stone-800 dark:text-stone-200">"{confirmDeleteAxleConfig.label}"</span>?
                </p>
              </div>
              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-stone-200 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteAxleConfig(null)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteAxleConfig}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Excluir</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DE TIPO DE VEÍCULO
            ======================================================== */}
        {confirmDeleteVehicleType && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-2xs animate-in fade-in duration-150">
            <div className="bg-white dark:bg-stone-900 rounded-xl max-w-sm w-full border border-stone-200 dark:border-stone-800 shadow-2xl p-5 space-y-3.5 animate-in zoom-in-95 duration-150">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="text-center space-y-1">
                <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                  Excluir Tipo de Veículo?
                </h4>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Tem certeza que deseja excluir o tipo <span className="font-bold text-stone-800 dark:text-stone-200">"{confirmDeleteVehicleType.name}"</span>?
                </p>
              </div>
              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-stone-200 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteVehicleType(null)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteType}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Excluir</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

