import React, { useState, useMemo } from 'react';
import { 
  Package, 
  Plus, 
  Search, 
  AlertTriangle, 
  Fuel, 
  Layers, 
  Sprout, 
  Wrench, 
  Trash2, 
  Edit3,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
  History,
  X,
  MapPin,
  Tag,
  DollarSign,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { InventoryItem, MaintenanceLog, FuelLog } from '../../types';
import { 
  formatCurrencyBRL, 
  getStoredMaintenanceLogs, 
  getStoredFuelLogs 
} from '../../lib/storage';
import { useConfirm } from '../../context/ConfirmContext';

interface InventoryModuleProps {
  inventory: InventoryItem[];
  onSaveInventory: (inventory: InventoryItem[]) => void;
}

export const InventoryModule: React.FC<InventoryModuleProps> = ({
  inventory,
  onSaveInventory,
}) => {
  const { confirm } = useConfirm();
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [viewingItem, setViewingItem] = useState<InventoryItem | null>(null);

  // Form state (compartilhado entre cadastro e edição)
  const [name, setName] = useState('');
  const [category, setCategory] = useState<InventoryItem['category']>('combustivel');
  const [quantity, setQuantity] = useState<number | ''>(100);
  const [unit, setUnit] = useState('litros');
  const [minQuantity, setMinQuantity] = useState<number | ''>(50);
  const [unitCost, setUnitCost] = useState<number | ''>(6.20);
  const [location, setLocation] = useState('Barracão Principal');
  const [profitMargin, setProfitMargin] = useState<number | ''>(30);
  const [salePrice, setSalePrice] = useState<number | ''>(8.06);
  const [wholesaleMargin, setWholesaleMargin] = useState<number | ''>(15);
  const [wholesalePrice, setWholesalePrice] = useState<number | ''>(7.13);
  const [promoMargin, setPromoMargin] = useState<number | ''>(10);
  const [promoPrice, setPromoPrice] = useState<number | ''>(6.82);

  // Logs para histórico
  const maintenanceLogs = useMemo<MaintenanceLog[]>(() => {
    return getStoredMaintenanceLogs();
  }, [viewingItem]);

  const fuelLogs = useMemo<FuelLog[]>(() => {
    return getStoredFuelLogs();
  }, [viewingItem]);

  // Histórico de movimentações do item visualizado
  const itemMovements = useMemo(() => {
    if (!viewingItem) return [];

    const movements: {
      id: string;
      date: string;
      type: 'saida' | 'entrada';
      description: string;
      quantity: number;
      unit: string;
      cost?: number;
      ref?: string;
    }[] = [];

    // 1. Verificar saídas em Ordens de Manutenção (peças e insumos)
    maintenanceLogs.forEach((log) => {
      if (log.partsList && Array.isArray(log.partsList)) {
        log.partsList.forEach((part, pIdx) => {
          const matchById = part.inventoryItemId && part.inventoryItemId === viewingItem.id;
          const matchByName = part.description && part.description.toLowerCase().trim() === viewingItem.name.toLowerCase().trim();

          if (matchById || matchByName) {
            movements.push({
              id: `maint_${log.id}_${pIdx}`,
              date: log.date || (log.createdAt ? log.createdAt.split('T')[0] : 'Data n/d'),
              type: 'saida',
              description: `Aplicação em OS de Manutenção: ${log.orderNumber || log.title || 'Manutenção'}`,
              quantity: part.quantity || 1,
              unit: part.unit || viewingItem.unit,
              cost: part.totalCost || (part.quantity * (part.unitCost || viewingItem.unitCost)),
              ref: log.orderNumber ? `OS #${log.orderNumber}` : undefined,
            });
          }
        });
      }
    });

    // 2. Se for combustível (diesel), verificar abastecimentos
    if (viewingItem.category === 'combustivel' || viewingItem.name.toLowerCase().includes('diesel')) {
      fuelLogs.slice(0, 50).forEach((fuel) => {
        movements.push({
          id: `fuel_${fuel.id}`,
          date: fuel.date,
          type: 'saida',
          description: `Abastecimento de Frota: ${fuel.vehiclePlate || 'Veículo/Máquina'}`,
          quantity: fuel.liters,
          unit: 'L',
          cost: fuel.totalCost,
          ref: fuel.driverName ? `Motorista: ${fuel.driverName}` : undefined,
        });
      });
    }

    // Ordenar por data decrescente
    movements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return movements;
  }, [viewingItem, maintenanceLogs, fuelLogs]);

  const filteredItems = inventory.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalInventoryValue = inventory.reduce((acc, curr) => acc + (curr.quantity * curr.unitCost), 0);
  const lowStockCount = inventory.filter(item => item.quantity <= item.minQuantity).length;

  // Abrir Modal de Cadastro Limpo
  const handleOpenCreateModal = () => {
    setName('');
    setCategory('combustivel');
    setQuantity(100);
    setUnit('litros');
    setMinQuantity(50);
    setUnitCost(6.20);
    setLocation('Barracão Principal');
    setProfitMargin(30);
    setSalePrice(8.06);
    setWholesaleMargin(15);
    setWholesalePrice(7.13);
    setPromoMargin(10);
    setPromoPrice(6.82);
    setIsCreateModalOpen(true);
  };

  // Abrir Modal de Edição com dados preenchidos
  const handleOpenEditModal = (item: InventoryItem) => {
    setEditingItem(item);
    setName(item.name || '');
    setCategory(item.category || 'combustivel');
    setQuantity(item.quantity ?? 0);
    setUnit(item.unit || 'un');
    setMinQuantity(item.minQuantity ?? 0);
    const uCost = item.unitCost ?? 0;
    setUnitCost(uCost);
    setLocation(item.location || 'Barracão Principal');

    // Margem & Preço Final
    const pMargin = item.profitMargin !== undefined ? item.profitMargin : (uCost > 0 && item.salePrice ? Math.round(((item.salePrice - uCost) / uCost) * 100 * 10) / 10 : 30);
    setProfitMargin(pMargin);
    setSalePrice(item.salePrice !== undefined ? item.salePrice : (uCost > 0 ? Math.round(uCost * (1 + pMargin / 100) * 100) / 100 : ''));

    // Margem & Atacado
    const wMargin = item.wholesaleMargin !== undefined ? item.wholesaleMargin : (uCost > 0 && item.wholesalePrice ? Math.round(((item.wholesalePrice - uCost) / uCost) * 100 * 10) / 10 : 15);
    setWholesaleMargin(wMargin);
    setWholesalePrice(item.wholesalePrice !== undefined ? item.wholesalePrice : (uCost > 0 ? Math.round(uCost * (1 + wMargin / 100) * 100) / 100 : ''));

    // Margem & Promoção
    const prMargin = item.promoMargin !== undefined ? item.promoMargin : (uCost > 0 && item.promoPrice ? Math.round(((item.promoPrice - uCost) / uCost) * 100 * 10) / 10 : 10);
    setPromoMargin(prMargin);
    setPromoPrice(item.promoPrice !== undefined ? item.promoPrice : (uCost > 0 ? Math.round(uCost * (1 + prMargin / 100) * 100) / 100 : ''));
  };

  // Salvar Novo Item
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newItem: InventoryItem = {
      id: `inv_${Date.now()}`,
      name: name.trim(),
      category,
      quantity: Number(quantity) || 0,
      unit: unit.trim() || 'un',
      minQuantity: Number(minQuantity) || 0,
      unitCost: Number(unitCost) || 0,
      location: location.trim() || 'Barracão Principal',
      profitMargin: profitMargin !== '' ? Number(profitMargin) : undefined,
      salePrice: salePrice !== '' ? Number(salePrice) : undefined,
      wholesaleMargin: wholesaleMargin !== '' ? Number(wholesaleMargin) : undefined,
      wholesalePrice: wholesalePrice !== '' ? Number(wholesalePrice) : undefined,
      promoMargin: promoMargin !== '' ? Number(promoMargin) : undefined,
      promoPrice: promoPrice !== '' ? Number(promoPrice) : undefined,
    };

    onSaveInventory([...inventory, newItem]);
    setIsCreateModalOpen(false);
  };

  // Salvar Edição do Item Existente
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !name.trim()) return;

    const updatedItem: InventoryItem = {
      ...editingItem,
      name: name.trim(),
      category,
      quantity: Number(quantity) || 0,
      unit: unit.trim() || 'un',
      minQuantity: Number(minQuantity) || 0,
      unitCost: Number(unitCost) || 0,
      location: location.trim() || 'Barracão Principal',
      profitMargin: profitMargin !== '' ? Number(profitMargin) : undefined,
      salePrice: salePrice !== '' ? Number(salePrice) : undefined,
      wholesaleMargin: wholesaleMargin !== '' ? Number(wholesaleMargin) : undefined,
      wholesalePrice: wholesalePrice !== '' ? Number(wholesalePrice) : undefined,
      promoMargin: promoMargin !== '' ? Number(promoMargin) : undefined,
      promoPrice: promoPrice !== '' ? Number(promoPrice) : undefined,
    };

    const updatedInventory = inventory.map(item => 
      item.id === editingItem.id ? updatedItem : item
    );

    onSaveInventory(updatedInventory);
    setEditingItem(null);
  };

  const handleDelete = async (id: string) => {
    const item = inventory.find(i => i.id === id);
    const isConfirmed = await confirm({
      title: 'Excluir Item do Estoque',
      message: item?.name
        ? `Deseja realmente excluir o item "${item.name}" do estoque?`
        : 'Deseja realmente excluir este item do estoque?',
      confirmLabel: 'Sim, Excluir',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });
    if (isConfirmed) {
      onSaveInventory(inventory.filter(i => i.id !== id));
      if (viewingItem?.id === id) {
        setViewingItem(null);
      }
    }
  };

  // Atualização rápida de margens e precificação diretamente nas linhas da tabela de Estoque
  const handlePricingChange = (
    itemId: string,
    field: 'profitMargin' | 'salePrice' | 'wholesaleMargin' | 'wholesalePrice' | 'promoMargin' | 'promoPrice',
    rawVal: string
  ) => {
    const sanitized = rawVal.replace(',', '.');
    const num = sanitized === '' ? undefined : parseFloat(sanitized);
    const validNum = num === undefined || isNaN(num) ? undefined : num;

    const updated = inventory.map(item => {
      if (item.id !== itemId) return item;
      const copy: InventoryItem = { ...item };
      const unit = copy.unitCost || 0;

      if (field === 'profitMargin') {
        copy.profitMargin = validNum;
        if (validNum !== undefined && unit > 0) {
          copy.salePrice = Math.round((unit * (1 + validNum / 100)) * 100) / 100;
        }
      } else if (field === 'salePrice') {
        copy.salePrice = validNum;
        if (validNum !== undefined && unit > 0) {
          copy.profitMargin = Math.round(((validNum - unit) / unit) * 100 * 10) / 10;
        }
      } else if (field === 'wholesaleMargin') {
        copy.wholesaleMargin = validNum;
        if (validNum !== undefined && unit > 0) {
          copy.wholesalePrice = Math.round((unit * (1 + validNum / 100)) * 100) / 100;
        }
      } else if (field === 'wholesalePrice') {
        copy.wholesalePrice = validNum;
        if (validNum !== undefined && unit > 0) {
          copy.wholesaleMargin = Math.round(((validNum - unit) / unit) * 100 * 10) / 10;
        }
      } else if (field === 'promoMargin') {
        copy.promoMargin = validNum;
        if (validNum !== undefined && unit > 0) {
          copy.promoPrice = Math.round((unit * (1 + validNum / 100)) * 100) / 100;
        }
      } else if (field === 'promoPrice') {
        copy.promoPrice = validNum;
        if (validNum !== undefined && unit > 0) {
          copy.promoMargin = Math.round(((validNum - unit) / unit) * 100 * 10) / 10;
        }
      }

      return copy;
    });

    onSaveInventory(updated);
  };

  const getCategoryIcon = (cat: InventoryItem['category']) => {
    switch (cat) {
      case 'combustivel': return <Fuel className="w-4 h-4 text-amber-500" />;
      case 'lona_embalagem': return <Layers className="w-4 h-4 text-teal-500" />;
      case 'inoculante': return <Sprout className="w-4 h-4 text-emerald-500" />;
      case 'pecas': return <Wrench className="w-4 h-4 text-rose-500" />;
      default: return <Package className="w-4 h-4 text-sky-500" />;
    }
  };

  return (
    <div id="inventory-module" className="w-full max-w-none space-y-4 sm:space-y-5">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200 dark:border-stone-800 pb-2">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100 tracking-tight font-['Outfit']">
            Controle de Estoque & Insumos de Silagem
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            Monitoramento de diesel, lonas plásticas, inoculantes biológicos e peças sobressalentes
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-sky-600 hover:bg-sky-700 text-white shadow-xs transition active:scale-95 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Cadastrar Item no Estoque</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-lg p-2.5 flex items-center justify-between text-black dark:text-white">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-black dark:text-stone-300">
              Valor Total em Estoque
            </span>
            <div className="text-lg sm:text-xl font-black text-black dark:text-white font-['Outfit'] mt-0.5">
              {formatCurrencyBRL(totalInventoryValue)}
            </div>
            <p className="text-[10px] font-bold text-black/80 dark:text-stone-400 mt-0.5">{inventory.length} produtos cadastrados</p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-sky-950 text-blue-900 dark:text-sky-300 flex items-center justify-center">
            <Package className="w-4 h-4" />
          </div>
        </div>

        <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-lg p-2.5 flex items-center justify-between text-black dark:text-white">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-black dark:text-stone-300">
              Alertas de Estoque Mínimo
            </span>
            <div className="text-lg sm:text-xl font-black text-amber-950 dark:text-amber-300 font-['Outfit'] mt-0.5">
              {lowStockCount}
            </div>
            <p className="text-[10px] font-bold text-black/80 dark:text-stone-400 mt-0.5">Itens em nível crítico</p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>

        <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-lg p-2.5 flex items-center justify-between text-black dark:text-white">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-black dark:text-stone-300">
              Diesel em Tanque
            </span>
            <div className="text-lg sm:text-xl font-black text-black dark:text-white font-['Outfit'] mt-0.5">
              {inventory.find(i => i.category === 'combustivel')?.quantity || 0} L
            </div>
            <p className="text-[10px] font-bold text-black/80 dark:text-stone-400 mt-0.5">Óleo diesel S10 disponível</p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-stone-800 text-amber-900 dark:text-amber-300 flex items-center justify-center">
            <Fuel className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Buscar produto no estoque por nome ou categoria..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-sky-500 outline-none"
        />
      </div>

      {/* Inventory Table */}
      <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl overflow-hidden shadow-2xs text-black dark:text-white">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#87AFE3] dark:bg-stone-900 border-b-2 border-blue-200/80 dark:border-stone-800 text-black dark:text-white uppercase text-[10px] font-black tracking-wider whitespace-nowrap">
              <tr>
                {/* 1. ITEM & LOCAL */}
                <th className="py-1.5 px-2 text-black dark:text-white font-black w-[15%] min-w-[120px]">
                  ITEM & LOCAL
                </th>

                {/* 2. CATEGORIA */}
                <th className="py-1.5 px-2 text-black dark:text-white font-black w-[10%] min-w-[90px]">
                  CATEGORIA
                </th>

                {/* 3. QUANTIDADE */}
                <th className="py-1.5 px-2 text-right text-black dark:text-white font-black w-[8%] min-w-[70px]">
                  QUANTIDADE
                </th>

                {/* 4. CUSTO UNITÁRIO (R$) */}
                <th className="py-1.5 px-2 text-right text-black dark:text-white font-black w-[9%] min-w-[75px]">
                  CUSTO UNIT. (R$)
                </th>

                {/* 5. VALOR TOTAL (R$) */}
                <th className="py-1.5 px-2 text-right text-black dark:text-white font-black w-[9%] min-w-[80px]">
                  VALOR TOTAL (R$)
                </th>

                {/* 6. % CÁLC. */}
                <th className="py-1.5 px-1 text-right w-[6%] min-w-[55px] bg-purple-200/60 dark:bg-purple-950/40 text-purple-950 dark:text-purple-200 border-l border-purple-300/60 dark:border-purple-800">
                  % CÁLC.
                </th>

                {/* 7. V. FINAL (R$) */}
                <th className="py-1.5 px-1.5 text-right w-[8%] min-w-[75px] bg-rose-200/60 dark:bg-rose-950/40 text-rose-950 dark:text-rose-200">
                  V. FINAL (R$)
                </th>

                {/* 8. % ATAC. */}
                <th className="py-1.5 px-1 text-right w-[6%] min-w-[55px] bg-cyan-200/60 dark:bg-cyan-950/40 text-cyan-950 dark:text-cyan-200 border-l border-cyan-300/60 dark:border-cyan-800">
                  % ATAC.
                </th>

                {/* 9. V. ATACADO (R$) */}
                <th className="py-1.5 px-1.5 text-right w-[8%] min-w-[75px] bg-cyan-100/50 dark:bg-stone-800 text-stone-900 dark:text-stone-200">
                  V. ATACADO (R$)
                </th>

                {/* 10. % PROMO. */}
                <th className="py-1.5 px-1 text-right w-[6%] min-w-[55px] bg-orange-200/60 dark:bg-orange-950/40 text-orange-950 dark:text-orange-200 border-l border-orange-300/60 dark:border-orange-800">
                  % PROMO.
                </th>

                {/* 11. V. PROMO (R$) */}
                <th className="py-1.5 px-1.5 text-right w-[8%] min-w-[75px] bg-orange-100/50 dark:bg-stone-800 text-stone-900 dark:text-stone-200">
                  V. PROMO (R$)
                </th>

                {/* 12. AÇÕES */}
                <th className="py-1.5 px-2 text-right text-black dark:text-white font-black w-[7%] min-w-[75px]">
                  AÇÕES
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-200/60 dark:divide-stone-800 bg-[#87AFE3] dark:bg-stone-900 text-black dark:text-white">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-black/70 dark:text-stone-400 font-bold">
                    Nenhum item encontrado no estoque.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isLow = item.quantity <= item.minQuantity;
                  const itemTotal = item.quantity * item.unitCost;

                  // Valores de margem e precificação derivados/sincronizados
                  const curProfitMargin = item.profitMargin !== undefined 
                    ? item.profitMargin 
                    : (item.unitCost > 0 && item.salePrice ? Math.round(((item.salePrice - item.unitCost) / item.unitCost) * 100 * 10) / 10 : '');
                  
                  const curSalePrice = item.salePrice !== undefined 
                    ? item.salePrice 
                    : (item.unitCost > 0 && curProfitMargin !== '' ? Math.round(item.unitCost * (1 + Number(curProfitMargin) / 100) * 100) / 100 : '');

                  const curWholesaleMargin = item.wholesaleMargin !== undefined 
                    ? item.wholesaleMargin 
                    : (item.unitCost > 0 && item.wholesalePrice ? Math.round(((item.wholesalePrice - item.unitCost) / item.unitCost) * 100 * 10) / 10 : '');

                  const curWholesalePrice = item.wholesalePrice !== undefined 
                    ? item.wholesalePrice 
                    : (item.unitCost > 0 && curWholesaleMargin !== '' ? Math.round(item.unitCost * (1 + Number(curWholesaleMargin) / 100) * 100) / 100 : '');

                  const curPromoMargin = item.promoMargin !== undefined 
                    ? item.promoMargin 
                    : (item.unitCost > 0 && item.promoPrice ? Math.round(((item.promoPrice - item.unitCost) / item.unitCost) * 100 * 10) / 10 : '');

                  const curPromoPrice = item.promoPrice !== undefined 
                    ? item.promoPrice 
                    : (item.unitCost > 0 && curPromoMargin !== '' ? Math.round(item.unitCost * (1 + Number(curPromoMargin) / 100) * 100) / 100 : '');

                  return (
                    <tr key={item.id} className="hover:bg-blue-300/30 dark:hover:bg-stone-800/40 transition">
                      {/* 1. ITEM & LOCAL (Enxuto) */}
                      <td className="py-1 px-2">
                        <div className="font-black text-black dark:text-stone-100 text-xs truncate max-w-[170px]" title={item.name}>
                          {item.name}
                        </div>
                        <span className="text-[9.5px] font-bold text-black/70 dark:text-stone-400 block truncate max-w-[170px]">
                          {item.location || 'Geral'}
                        </span>
                      </td>

                      {/* 2. CATEGORIA (Compacta) */}
                      <td className="py-1 px-2">
                        <div className="flex items-center space-x-1 capitalize font-bold text-[11px] text-black dark:text-stone-200">
                          {getCategoryIcon(item.category)}
                          <span className="truncate max-w-[90px]">{item.category.replace('_', ' ')}</span>
                        </div>
                      </td>

                      {/* 3. QUANTIDADE */}
                      <td className="py-1 px-2 text-right">
                        <span className={`font-black font-mono text-xs ${isLow ? 'text-rose-950 dark:text-rose-400' : 'text-black dark:text-stone-100'}`}>
                          {item.quantity} {item.unit}
                        </span>
                        {isLow && (
                          <span className="block text-[8.5px] font-black text-rose-900 dark:text-rose-400">
                            Baixo!
                          </span>
                        )}
                      </td>

                      {/* 4. CUSTO UNITÁRIO (R$) */}
                      <td className="py-1 px-2 text-right font-black text-black dark:text-stone-300 font-mono text-xs">
                        {formatCurrencyBRL(item.unitCost)}
                      </td>

                      {/* 5. VALOR TOTAL (R$) */}
                      <td className="py-1 px-2 text-right font-black text-black dark:text-stone-100 font-mono text-xs">
                        {formatCurrencyBRL(itemTotal)}
                      </td>

                      {/* 6. % CÁLC. (Input Rápido de Margem de Lucro Padrão) */}
                      <td className="py-1 px-1 text-right align-middle bg-purple-50/40 dark:bg-purple-950/20 border-l border-purple-200/60 dark:border-purple-800/40">
                        <div className="flex items-center justify-end space-x-0.5">
                          <input
                            type="number"
                            step="0.1"
                            value={curProfitMargin}
                            onChange={(e) => handlePricingChange(item.id, 'profitMargin', e.target.value)}
                            placeholder="0"
                            className="w-full max-w-[46px] h-6 px-0.5 text-[10px] text-right rounded border border-purple-300 dark:border-purple-700 bg-purple-50/90 dark:bg-stone-900 text-purple-950 dark:text-purple-200 font-mono font-bold focus:ring-1 focus:ring-purple-500 ml-auto block"
                            title="Margem Padrão (%): V. Final = Custo + (Custo * % / 100)"
                          />
                          <span className="text-[8.5px] font-black text-purple-900 dark:text-purple-300 shrink-0">%</span>
                        </div>
                      </td>

                      {/* 7. V. FINAL (R$) (Preço de Venda Final com Ajuste Sincronizado) */}
                      <td className="py-1 px-1.5 text-right align-middle bg-rose-50/40 dark:bg-rose-950/20">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={curSalePrice}
                          onChange={(e) => handlePricingChange(item.id, 'salePrice', e.target.value)}
                          placeholder="0.00"
                          className="w-full max-w-[68px] h-6 px-1 text-[10px] text-right rounded border border-rose-300 dark:border-rose-700 bg-rose-50/90 dark:bg-stone-900 text-rose-950 dark:text-stone-100 font-mono font-bold focus:ring-1 focus:ring-rose-500 ml-auto block"
                          title="Preço de Venda Final (R$)"
                        />
                      </td>

                      {/* 8. % ATAC. (Input Rápido de Margem Atacado) */}
                      <td className="py-1 px-1 text-right align-middle bg-cyan-50/40 dark:bg-cyan-950/20 border-l border-cyan-200/60 dark:border-cyan-800/40">
                        <div className="flex items-center justify-end space-x-0.5">
                          <input
                            type="number"
                            step="0.1"
                            value={curWholesaleMargin}
                            onChange={(e) => handlePricingChange(item.id, 'wholesaleMargin', e.target.value)}
                            placeholder="0"
                            className="w-full max-w-[46px] h-6 px-0.5 text-[10px] text-right rounded border border-cyan-300 dark:border-cyan-700 bg-cyan-50/90 dark:bg-stone-900 text-cyan-950 dark:text-cyan-200 font-mono font-bold focus:ring-1 focus:ring-cyan-500 ml-auto block"
                            title="Margem Atacado (%): V. Atacado = Custo + (Custo * % / 100)"
                          />
                          <span className="text-[8.5px] font-black text-cyan-900 dark:text-cyan-300 shrink-0">%</span>
                        </div>
                      </td>

                      {/* 9. V. ATACADO (R$) */}
                      <td className="py-1 px-1.5 text-right align-middle">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={curWholesalePrice}
                          onChange={(e) => handlePricingChange(item.id, 'wholesalePrice', e.target.value)}
                          placeholder="0.00"
                          className="w-full max-w-[68px] h-6 px-1 text-[10px] text-right rounded border border-stone-300 dark:border-stone-600 bg-white/90 dark:bg-stone-900 text-black dark:text-stone-100 font-mono font-medium focus:ring-1 focus:ring-[#0963cb] ml-auto block"
                          title="Preço de Atacado (R$)"
                        />
                      </td>

                      {/* 10. % PROMO. (Input Rápido de Margem Promoção) */}
                      <td className="py-1 px-1 text-right align-middle bg-orange-50/40 dark:bg-orange-950/20 border-l border-orange-200/60 dark:border-orange-800/40">
                        <div className="flex items-center justify-end space-x-0.5">
                          <input
                            type="number"
                            step="0.1"
                            value={curPromoMargin}
                            onChange={(e) => handlePricingChange(item.id, 'promoMargin', e.target.value)}
                            placeholder="0"
                            className="w-full max-w-[46px] h-6 px-0.5 text-[10px] text-right rounded border border-orange-300 dark:border-orange-700 bg-orange-50/90 dark:bg-stone-900 text-orange-950 dark:text-orange-200 font-mono font-bold focus:ring-1 focus:ring-orange-500 ml-auto block"
                            title="Margem Promocional (%): V. Promo = Custo + (Custo * % / 100)"
                          />
                          <span className="text-[8.5px] font-black text-orange-900 dark:text-orange-300 shrink-0">%</span>
                        </div>
                      </td>

                      {/* 11. V. PROMO (R$) */}
                      <td className="py-1 px-1.5 text-right align-middle">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={curPromoPrice}
                          onChange={(e) => handlePricingChange(item.id, 'promoPrice', e.target.value)}
                          placeholder="0.00"
                          className="w-full max-w-[68px] h-6 px-1 text-[10px] text-right rounded border border-stone-300 dark:border-stone-600 bg-white/90 dark:bg-stone-900 text-black dark:text-stone-100 font-mono font-medium focus:ring-1 focus:ring-[#0963cb] ml-auto block"
                          title="Preço Promocional (R$)"
                        />
                      </td>

                      {/* 12. AÇÕES (Olho, Lápis, Lixeira) */}
                      <td className="py-1 px-2 text-right align-middle">
                        <div className="inline-flex items-center space-x-1.5 justify-end">
                          {/* 1. Botão Detalhes (Olho) */}
                          <button
                            type="button"
                            onClick={() => setViewingItem(item)}
                            className="p-1 text-blue-900/90 hover:text-blue-700 dark:text-sky-400 dark:hover:text-sky-300 hover:bg-blue-100/60 dark:hover:bg-sky-950/60 rounded transition cursor-pointer"
                            title="Ver detalhes completos do produto"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* 2. Botão Editar (Lápis) */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(item)}
                            className="p-1 text-amber-900/90 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 hover:bg-amber-100/60 dark:hover:bg-amber-950/60 rounded transition cursor-pointer"
                            title="Editar dados do produto"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* 3. Botão Excluir (Lixeira) */}
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            className="p-1 text-black/70 hover:text-rose-900 dark:text-stone-400 dark:hover:text-rose-400 hover:bg-rose-100/60 dark:hover:bg-rose-950/60 rounded transition cursor-pointer"
                            title="Excluir item"
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

      {/* Modal 1: Novo Item */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            
            {/* Header */}
            <div className="px-5 py-3.5 bg-[#009688] text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Package className="w-5 h-5" />
                <h3 className="text-base sm:text-lg font-bold tracking-tight">
                  Novo Item de Estoque
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-5 sm:p-6 space-y-4 max-h-[82vh] overflow-y-auto">
              <div>
                <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider mb-1">
                  NOME DO PRODUTO / INSUMO <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Lona Dupla Face 200 Micras"
                  className="w-full px-3.5 py-2 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#009688]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider mb-1">
                    CATEGORIA
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-3.5 py-2 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#009688]"
                  >
                    <option value="combustivel">Combustível (Diesel)</option>
                    <option value="lona_embalagem">Lona & Embalagens</option>
                    <option value="inoculante">Inoculante Bacteriano</option>
                    <option value="pecas">Peças & Facas</option>
                    <option value="sementes">Sementes & Adubos</option>
                    <option value="outro">Outro Insumo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider mb-1">
                    LOCALIZAÇÃO
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Ex: Barracão Principal"
                    className="w-full px-3.5 py-2 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#009688]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider mb-1">
                    UNIDADE
                  </label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="litros, rolos, doses, peças, un"
                    className="w-full px-3.5 py-2 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#009688]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider mb-1">
                    QUANTIDADE ATUAL
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3.5 py-2 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#009688]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider mb-1">
                    ESTOQUE MÍNIMO
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={minQuantity}
                    onChange={(e) => setMinQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3.5 py-2 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#009688]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider mb-1">
                    CUSTO UNITÁRIO (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={unitCost}
                    onChange={(e) => {
                      const costVal = e.target.value === '' ? '' : Number(e.target.value);
                      setUnitCost(costVal);
                      if (typeof costVal === 'number' && costVal > 0) {
                        if (profitMargin !== '') setSalePrice(Math.round(costVal * (1 + Number(profitMargin) / 100) * 100) / 100);
                        if (wholesaleMargin !== '') setWholesalePrice(Math.round(costVal * (1 + Number(wholesaleMargin) / 100) * 100) / 100);
                        if (promoMargin !== '') setPromoPrice(Math.round(costVal * (1 + Number(promoMargin) / 100) * 100) / 100);
                      }
                    }}
                    className="w-full px-3.5 py-2 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#009688]"
                  />
                </div>
              </div>

              {/* Seção de Precificação Sincronizada */}
              <div className="p-3 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-stone-700 dark:text-stone-300">
                    Precificação & Margens de Venda
                  </span>
                  <span className="text-[10px] text-stone-500">Cálculo Automático Baseado no Custo</span>
                </div>

                {/* Margem Padrão / Venda Final */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-purple-900 dark:text-purple-300 uppercase mb-1">
                      % Margem Padrão
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        value={profitMargin}
                        onChange={(e) => {
                          const marginVal = e.target.value === '' ? '' : Number(e.target.value);
                          setProfitMargin(marginVal);
                          if (marginVal !== '' && typeof unitCost === 'number' && unitCost > 0) {
                            setSalePrice(Math.round(unitCost * (1 + Number(marginVal) / 100) * 100) / 100);
                          }
                        }}
                        placeholder="30"
                        className="w-full pr-6 pl-2.5 py-1.5 bg-white dark:bg-stone-900 border border-purple-300 dark:border-purple-700 rounded-lg text-xs font-mono font-bold"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-purple-900">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-rose-900 dark:text-rose-300 uppercase mb-1">
                      V. Final (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={salePrice}
                      onChange={(e) => {
                        const priceVal = e.target.value === '' ? '' : Number(e.target.value);
                        setSalePrice(priceVal);
                        if (priceVal !== '' && typeof unitCost === 'number' && unitCost > 0) {
                          setProfitMargin(Math.round(((Number(priceVal) - unitCost) / unitCost) * 100 * 10) / 10);
                        }
                      }}
                      placeholder="0.00"
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-900 border border-rose-300 dark:border-rose-700 rounded-lg text-xs font-mono font-bold"
                    />
                  </div>
                </div>

                {/* Atacado */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-cyan-900 dark:text-cyan-300 uppercase mb-1">
                      % Margem Atacado
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        value={wholesaleMargin}
                        onChange={(e) => {
                          const marginVal = e.target.value === '' ? '' : Number(e.target.value);
                          setWholesaleMargin(marginVal);
                          if (marginVal !== '' && typeof unitCost === 'number' && unitCost > 0) {
                            setWholesalePrice(Math.round(unitCost * (1 + Number(marginVal) / 100) * 100) / 100);
                          }
                        }}
                        placeholder="15"
                        className="w-full pr-6 pl-2.5 py-1.5 bg-white dark:bg-stone-900 border border-cyan-300 dark:border-cyan-700 rounded-lg text-xs font-mono font-bold"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-cyan-900">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-stone-700 dark:text-stone-300 uppercase mb-1">
                      V. Atacado (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={wholesalePrice}
                      onChange={(e) => {
                        const priceVal = e.target.value === '' ? '' : Number(e.target.value);
                        setWholesalePrice(priceVal);
                        if (priceVal !== '' && typeof unitCost === 'number' && unitCost > 0) {
                          setWholesaleMargin(Math.round(((Number(priceVal) - unitCost) / unitCost) * 100 * 10) / 10);
                        }
                      }}
                      placeholder="0.00"
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-mono font-medium"
                    />
                  </div>
                </div>

                {/* Promoção */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-orange-900 dark:text-orange-300 uppercase mb-1">
                      % Margem Promoção
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        value={promoMargin}
                        onChange={(e) => {
                          const marginVal = e.target.value === '' ? '' : Number(e.target.value);
                          setPromoMargin(marginVal);
                          if (marginVal !== '' && typeof unitCost === 'number' && unitCost > 0) {
                            setPromoPrice(Math.round(unitCost * (1 + Number(marginVal) / 100) * 100) / 100);
                          }
                        }}
                        placeholder="10"
                        className="w-full pr-6 pl-2.5 py-1.5 bg-white dark:bg-stone-900 border border-orange-300 dark:border-orange-700 rounded-lg text-xs font-mono font-bold"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-orange-900">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-stone-700 dark:text-stone-300 uppercase mb-1">
                      V. Promo (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={promoPrice}
                      onChange={(e) => {
                        const priceVal = e.target.value === '' ? '' : Number(e.target.value);
                        setPromoPrice(priceVal);
                        if (priceVal !== '' && typeof unitCost === 'number' && unitCost > 0) {
                          setPromoMargin(Math.round(((Number(priceVal) - unitCost) / unitCost) * 100 * 10) / 10);
                        }
                      }}
                      placeholder="0.00"
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-mono font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Previsão de Valor Total */}
              <div className="p-3 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700/60 flex items-center justify-between text-xs">
                <span className="text-stone-500 dark:text-stone-400 font-medium">Subtotal Estimado em Estoque:</span>
                <span className="font-mono font-bold text-stone-900 dark:text-stone-100 text-sm">
                  {formatCurrencyBRL((Number(quantity) || 0) * (Number(unitCost) || 0))}
                </span>
              </div>

              {/* Footer */}
              <div className="flex justify-end space-x-3 pt-3 border-t border-stone-100 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 text-xs sm:text-sm font-semibold hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl bg-[#156f33] hover:bg-[#0e5224] text-white text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer"
                >
                  Salvar Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Editar Item (com campos preenchidos) */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            
            {/* Header */}
            <div className="px-5 py-3.5 bg-amber-600 dark:bg-amber-700 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Edit3 className="w-5 h-5" />
                <div>
                  <h3 className="text-base sm:text-lg font-bold tracking-tight">
                    Editar Item de Estoque
                  </h3>
                  <p className="text-[11px] text-amber-100">
                    Alteração de dados cadastrais e valores
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-5 sm:p-6 space-y-4 max-h-[82vh] overflow-y-auto">
              <div>
                <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider mb-1">
                  NOME DO PRODUTO / INSUMO <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Lona Dupla Face 200 Micras"
                  className="w-full px-3.5 py-2 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider mb-1">
                    CATEGORIA
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-3.5 py-2 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="combustivel">Combustível (Diesel)</option>
                    <option value="lona_embalagem">Lona & Embalagens</option>
                    <option value="inoculante">Inoculante Bacteriano</option>
                    <option value="pecas">Peças & Facas</option>
                    <option value="sementes">Sementes & Adubos</option>
                    <option value="outro">Outro Insumo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider mb-1">
                    LOCALIZAÇÃO
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Ex: Barracão Principal"
                    className="w-full px-3.5 py-2 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider mb-1">
                    UNIDADE
                  </label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="litros, rolos, doses, peças, un"
                    className="w-full px-3.5 py-2 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider mb-1">
                    QUANTIDADE ATUAL
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3.5 py-2 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider mb-1">
                    ESTOQUE MÍNIMO
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={minQuantity}
                    onChange={(e) => setMinQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3.5 py-2 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider mb-1">
                    CUSTO UNITÁRIO (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={unitCost}
                    onChange={(e) => {
                      const costVal = e.target.value === '' ? '' : Number(e.target.value);
                      setUnitCost(costVal);
                      if (typeof costVal === 'number' && costVal > 0) {
                        if (profitMargin !== '') setSalePrice(Math.round(costVal * (1 + Number(profitMargin) / 100) * 100) / 100);
                        if (wholesaleMargin !== '') setWholesalePrice(Math.round(costVal * (1 + Number(wholesaleMargin) / 100) * 100) / 100);
                        if (promoMargin !== '') setPromoPrice(Math.round(costVal * (1 + Number(promoMargin) / 100) * 100) / 100);
                      }
                    }}
                    className="w-full px-3.5 py-2 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Seção de Precificação Sincronizada */}
              <div className="p-3 bg-amber-50/50 dark:bg-stone-800/60 rounded-xl border border-amber-200/80 dark:border-stone-700/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-stone-700 dark:text-stone-300">
                    Precificação & Margens de Venda
                  </span>
                  <span className="text-[10px] text-stone-500">Cálculo Automático Baseado no Custo</span>
                </div>

                {/* Margem Padrão / Venda Final */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-purple-900 dark:text-purple-300 uppercase mb-1">
                      % Margem Padrão
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        value={profitMargin}
                        onChange={(e) => {
                          const marginVal = e.target.value === '' ? '' : Number(e.target.value);
                          setProfitMargin(marginVal);
                          if (marginVal !== '' && typeof unitCost === 'number' && unitCost > 0) {
                            setSalePrice(Math.round(unitCost * (1 + Number(marginVal) / 100) * 100) / 100);
                          }
                        }}
                        placeholder="30"
                        className="w-full pr-6 pl-2.5 py-1.5 bg-white dark:bg-stone-900 border border-purple-300 dark:border-purple-700 rounded-lg text-xs font-mono font-bold"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-purple-900">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-rose-900 dark:text-rose-300 uppercase mb-1">
                      V. Final (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={salePrice}
                      onChange={(e) => {
                        const priceVal = e.target.value === '' ? '' : Number(e.target.value);
                        setSalePrice(priceVal);
                        if (priceVal !== '' && typeof unitCost === 'number' && unitCost > 0) {
                          setProfitMargin(Math.round(((Number(priceVal) - unitCost) / unitCost) * 100 * 10) / 10);
                        }
                      }}
                      placeholder="0.00"
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-900 border border-rose-300 dark:border-rose-700 rounded-lg text-xs font-mono font-bold"
                    />
                  </div>
                </div>

                {/* Atacado */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-cyan-900 dark:text-cyan-300 uppercase mb-1">
                      % Margem Atacado
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        value={wholesaleMargin}
                        onChange={(e) => {
                          const marginVal = e.target.value === '' ? '' : Number(e.target.value);
                          setWholesaleMargin(marginVal);
                          if (marginVal !== '' && typeof unitCost === 'number' && unitCost > 0) {
                            setWholesalePrice(Math.round(unitCost * (1 + Number(marginVal) / 100) * 100) / 100);
                          }
                        }}
                        placeholder="15"
                        className="w-full pr-6 pl-2.5 py-1.5 bg-white dark:bg-stone-900 border border-cyan-300 dark:border-cyan-700 rounded-lg text-xs font-mono font-bold"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-cyan-900">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-stone-700 dark:text-stone-300 uppercase mb-1">
                      V. Atacado (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={wholesalePrice}
                      onChange={(e) => {
                        const priceVal = e.target.value === '' ? '' : Number(e.target.value);
                        setWholesalePrice(priceVal);
                        if (priceVal !== '' && typeof unitCost === 'number' && unitCost > 0) {
                          setWholesaleMargin(Math.round(((Number(priceVal) - unitCost) / unitCost) * 100 * 10) / 10);
                        }
                      }}
                      placeholder="0.00"
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-mono font-medium"
                    />
                  </div>
                </div>

                {/* Promoção */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-orange-900 dark:text-orange-300 uppercase mb-1">
                      % Margem Promoção
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        value={promoMargin}
                        onChange={(e) => {
                          const marginVal = e.target.value === '' ? '' : Number(e.target.value);
                          setPromoMargin(marginVal);
                          if (marginVal !== '' && typeof unitCost === 'number' && unitCost > 0) {
                            setPromoPrice(Math.round(unitCost * (1 + Number(marginVal) / 100) * 100) / 100);
                          }
                        }}
                        placeholder="10"
                        className="w-full pr-6 pl-2.5 py-1.5 bg-white dark:bg-stone-900 border border-orange-300 dark:border-orange-700 rounded-lg text-xs font-mono font-bold"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-orange-900">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-stone-700 dark:text-stone-300 uppercase mb-1">
                      V. Promo (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={promoPrice}
                      onChange={(e) => {
                        const priceVal = e.target.value === '' ? '' : Number(e.target.value);
                        setPromoPrice(priceVal);
                        if (priceVal !== '' && typeof unitCost === 'number' && unitCost > 0) {
                          setPromoMargin(Math.round(((Number(priceVal) - unitCost) / unitCost) * 100 * 10) / 10);
                        }
                      }}
                      placeholder="0.00"
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-mono font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Previsão de Valor Total */}
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800/50 flex items-center justify-between text-xs">
                <span className="text-amber-800 dark:text-amber-300 font-medium">Novo Valor Total em Estoque:</span>
                <span className="font-mono font-bold text-amber-950 dark:text-amber-100 text-sm">
                  {formatCurrencyBRL((Number(quantity) || 0) * (Number(unitCost) || 0))}
                </span>
              </div>

              {/* Footer */}
              <div className="flex justify-end space-x-3 pt-3 border-t border-stone-100 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 text-xs sm:text-sm font-semibold hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer flex items-center space-x-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Salvar Alterações</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Detalhes do Produto (Ficha Completa & Histórico de Movimentações) */}
      {viewingItem && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="px-5 py-4 bg-sky-700 dark:bg-sky-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/10 rounded-xl">
                  {getCategoryIcon(viewingItem.category)}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base sm:text-lg font-bold tracking-tight">
                      {viewingItem.name}
                    </h3>
                    {viewingItem.quantity <= viewingItem.minQuantity && (
                      <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded bg-rose-500 text-white">
                        Estoque Crítico
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-sky-100">
                    Ficha Técnica Completa & Histórico de Movimentações
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingItem(null)}
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition cursor-pointer"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
              
              {/* Grid de Informações Básicas do Item */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-800">
                  <div className="flex items-center space-x-1.5 text-[11px] font-bold text-stone-500 uppercase">
                    <Tag className="w-3.5 h-3.5" />
                    <span>Categoria</span>
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100 capitalize mt-1">
                    {viewingItem.category.replace('_', ' ')}
                  </div>
                </div>

                <div className="p-3 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-800">
                  <div className="flex items-center space-x-1.5 text-[11px] font-bold text-stone-500 uppercase">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Localização</span>
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100 mt-1 truncate">
                    {viewingItem.location || 'Barracão Principal'}
                  </div>
                </div>

                <div className="p-3 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-800">
                  <div className="flex items-center space-x-1.5 text-[11px] font-bold text-stone-500 uppercase">
                    <Package className="w-3.5 h-3.5" />
                    <span>Estoque Atual</span>
                  </div>
                  <div className={`text-xs sm:text-sm font-black mt-1 ${
                    viewingItem.quantity <= viewingItem.minQuantity 
                      ? 'text-rose-600 dark:text-rose-400' 
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}>
                    {viewingItem.quantity} {viewingItem.unit}
                  </div>
                </div>

                <div className="p-3 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-800">
                  <div className="flex items-center space-x-1.5 text-[11px] font-bold text-stone-500 uppercase">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Estoque Mínimo</span>
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-stone-800 dark:text-stone-200 mt-1">
                    {viewingItem.minQuantity} {viewingItem.unit}
                  </div>
                </div>
              </div>

              {/* Destaque Financeiro */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/20 rounded-xl border border-blue-200/80 dark:border-blue-900/40 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300">
                      Média de Custo Unitário
                    </span>
                    <div className="text-base sm:text-lg font-black text-blue-950 dark:text-blue-100 font-mono mt-0.5">
                      {formatCurrencyBRL(viewingItem.unitCost)}
                      <span className="text-xs font-normal text-stone-500 ml-1">/{viewingItem.unit}</span>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 flex items-center justify-center">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>

                <div className="p-3.5 bg-emerald-50/70 dark:bg-emerald-950/20 rounded-xl border border-emerald-200/80 dark:border-emerald-900/40 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                      Valor Total em Estoque
                    </span>
                    <div className="text-base sm:text-lg font-black text-emerald-950 dark:text-emerald-100 font-mono mt-0.5">
                      {formatCurrencyBRL(viewingItem.quantity * viewingItem.unitCost)}
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Precificação Sincronizada (Margens de Venda, Atacado e Promoção) */}
              <div className="p-3.5 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-800 space-y-2.5">
                <div className="text-[11px] font-black uppercase tracking-wider text-stone-700 dark:text-stone-300">
                  Tabela de Preços & Margens Sincronizadas
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {/* V. Final */}
                  <div className="p-2.5 rounded-lg bg-purple-50/80 dark:bg-purple-950/30 border border-purple-200/70 dark:border-purple-900/50">
                    <span className="text-[9.5px] font-bold text-purple-900 dark:text-purple-300 uppercase block">
                      Venda Final (% Padrão)
                    </span>
                    <div className="text-sm font-black text-purple-950 dark:text-purple-100 font-mono mt-0.5">
                      {viewingItem.salePrice !== undefined 
                        ? formatCurrencyBRL(viewingItem.salePrice) 
                        : (viewingItem.unitCost > 0 ? formatCurrencyBRL(viewingItem.unitCost * 1.3) : 'R$ 0,00')}
                    </div>
                    <span className="text-[9.5px] font-semibold text-purple-800 dark:text-purple-300">
                      Margem: +{viewingItem.profitMargin ?? (viewingItem.salePrice && viewingItem.unitCost > 0 ? Math.round(((viewingItem.salePrice - viewingItem.unitCost) / viewingItem.unitCost) * 100 * 10) / 10 : 30)}%
                    </span>
                  </div>

                  {/* V. Atacado */}
                  <div className="p-2.5 rounded-lg bg-cyan-50/80 dark:bg-cyan-950/30 border border-cyan-200/70 dark:border-cyan-900/50">
                    <span className="text-[9.5px] font-bold text-cyan-900 dark:text-cyan-300 uppercase block">
                      Atacado (% Atac.)
                    </span>
                    <div className="text-sm font-black text-cyan-950 dark:text-cyan-100 font-mono mt-0.5">
                      {viewingItem.wholesalePrice !== undefined 
                        ? formatCurrencyBRL(viewingItem.wholesalePrice) 
                        : (viewingItem.unitCost > 0 ? formatCurrencyBRL(viewingItem.unitCost * 1.15) : 'R$ 0,00')}
                    </div>
                    <span className="text-[9.5px] font-semibold text-cyan-800 dark:text-cyan-300">
                      Margem: +{viewingItem.wholesaleMargin ?? (viewingItem.wholesalePrice && viewingItem.unitCost > 0 ? Math.round(((viewingItem.wholesalePrice - viewingItem.unitCost) / viewingItem.unitCost) * 100 * 10) / 10 : 15)}%
                    </span>
                  </div>

                  {/* V. Promoção */}
                  <div className="p-2.5 rounded-lg bg-orange-50/80 dark:bg-orange-950/30 border border-orange-200/70 dark:border-orange-900/50">
                    <span className="text-[9.5px] font-bold text-orange-900 dark:text-orange-300 uppercase block">
                      Promoção (% Promo.)
                    </span>
                    <div className="text-sm font-black text-orange-950 dark:text-orange-100 font-mono mt-0.5">
                      {viewingItem.promoPrice !== undefined 
                        ? formatCurrencyBRL(viewingItem.promoPrice) 
                        : (viewingItem.unitCost > 0 ? formatCurrencyBRL(viewingItem.unitCost * 1.10) : 'R$ 0,00')}
                    </div>
                    <span className="text-[9.5px] font-semibold text-orange-800 dark:text-orange-300">
                      Margem: +{viewingItem.promoMargin ?? (viewingItem.promoPrice && viewingItem.unitCost > 0 ? Math.round(((viewingItem.promoPrice - viewingItem.unitCost) / viewingItem.unitCost) * 100 * 10) / 10 : 10)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Histórico Recente de Movimentações */}
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-1.5">
                  <div className="flex items-center space-x-1.5">
                    <History className="w-4 h-4 text-stone-500" />
                    <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100 uppercase tracking-wider">
                      Histórico Recente de Movimentações
                    </h4>
                  </div>
                  <span className="text-[11px] text-stone-500 dark:text-stone-400">
                    {itemMovements.length} registro(s) localizados
                  </span>
                </div>

                {itemMovements.length === 0 ? (
                  <div className="p-6 text-center border border-dashed border-stone-200 dark:border-stone-800 rounded-xl bg-stone-50/50 dark:bg-stone-800/20">
                    <Clock className="w-6 h-6 mx-auto text-stone-300 dark:text-stone-600 mb-1" />
                    <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">
                      Nenhuma saída recente registrada para este insumo em ordens de serviço ou abastecimento.
                    </p>
                    <p className="text-[10px] text-stone-400 mt-0.5">
                      As utilizações associadas a manutenções e frotas serão rastreadas automaticamente aqui.
                    </p>
                  </div>
                ) : (
                  <div className="border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden divide-y divide-stone-100 dark:divide-stone-800 text-xs">
                    {itemMovements.slice(0, 8).map((mov) => (
                      <div key={mov.id} className="p-3 hover:bg-stone-50 dark:hover:bg-stone-800/40 transition flex items-center justify-between gap-2">
                        <div className="flex items-center space-x-3">
                          <div className={`p-1.5 rounded-lg ${
                            mov.type === 'saida' 
                              ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400' 
                              : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                          }`}>
                            {mov.type === 'saida' ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                          </div>
                          <div>
                            <p className="font-semibold text-stone-800 dark:text-stone-200">{mov.description}</p>
                            <div className="flex items-center space-x-2 text-[10px] text-stone-500 dark:text-stone-400 mt-0.5">
                              <span className="flex items-center space-x-1">
                                <Calendar className="w-3 h-3" />
                                <span>{mov.date}</span>
                              </span>
                              {mov.ref && (
                                <>
                                  <span>•</span>
                                  <span>{mov.ref}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right whitespace-nowrap">
                          <span className="font-bold text-rose-600 dark:text-rose-400 font-mono">
                            -{mov.quantity} {mov.unit}
                          </span>
                          {mov.cost !== undefined && (
                            <p className="text-[10px] text-stone-500 dark:text-stone-400 font-mono">
                              {formatCurrencyBRL(mov.cost)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Footer com Botão Fechar Destacado e Atalho para Edição */}
            <div className="px-5 py-3.5 bg-stone-100 dark:bg-stone-800/90 border-t border-stone-200 dark:border-stone-700 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const target = viewingItem;
                  setViewingItem(null);
                  handleOpenEditModal(target);
                }}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/50 text-xs font-bold transition cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Editar este Item</span>
              </button>

              <button
                type="button"
                onClick={() => setViewingItem(null)}
                className="px-6 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer"
              >
                Fechar Ficha
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

