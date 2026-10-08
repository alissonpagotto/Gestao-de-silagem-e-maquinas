import React, { useState, useEffect, useMemo } from 'react';
import { 
  Wrench, 
  Printer, 
  Save, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  ArrowLeft, 
  Clock, 
  Building2, 
  Truck, 
  FileText, 
  Eye, 
  Check, 
  Search,
  Filter,
  X,
  Pencil
} from 'lucide-react';
import { TireItem, Supplier, CompanyProfile, InventoryItem, Expense } from '../../types';
import { 
  formatDateBR, 
  formatCurrencyBRL, 
  getStoredCompanyProfile,
  getStoredStockServices,
  getServicesFromStockLocalStorage,
  getBorrachariaServicesFromStock,
  saveStoredStockServices,
  normalizeStockServiceName,
  DEFAULT_STOCK_SERVICES,
  STOCK_SERVICES_STORAGE_KEY,
  STOCK_PRODUCTS_STORAGE_KEY,
  getStoredTireInventory,
  saveStoredTireInventory,
  getStoredTiresInReform,
  saveStoredTiresInReform,
  getStoredInventory,
  saveStoredInventory,
  STORAGE_KEYS
} from '../../lib/storage';

export interface TireReformOrder {
  id: string;
  orderNumber: string;
  createdAt: string;
  supplierId?: string;
  supplierName: string;
  supplierCnpj?: string;
  supplierPhone?: string;
  driverName?: string;
  expectedReturnDate?: string;
  status: 'Aguardando Retorno / Nota' | 'Concluído' | 'Cancelado';
  tires: {
    id: string;
    fireNumber: string;
    brand: string;
    model?: string;
    size?: string;
    treadDepthMm?: number;
    vehiclePlate?: string;
    vehicleName?: string;
    notes?: string;
    motivo_reforma?: string;
    servico?: string;
    valorUnitario?: number;
  }[];
  totalTires: number;
  totalValor?: number;
  notes?: string;
}

export { 
  DEFAULT_STOCK_SERVICES,
  STOCK_SERVICES_STORAGE_KEY,
  normalizeStockServiceName
};

export const DEFAULT_TIRE_REFORM_SERVICES = DEFAULT_STOCK_SERVICES;
export const TIRE_REFORM_SERVICES_STORAGE_KEY = STOCK_SERVICES_STORAGE_KEY;

export function getStoredReformServices(): string[] {
  return getStoredStockServices();
}

export function saveStoredReformServices(services: string[]): void {
  saveStoredStockServices(services);
}

export function formatCurrencyPtBr(value: number): string {
  return (value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export const REFORM_ORDERS_STORAGE_KEY = 'colaca_silagem_pedidos_reforma_ativos';
export const PENDING_REFORM_TIRES_KEY = 'colaca_silagem_pneus_aguardando_pedido';
export const SUPPLIERS_STORAGE_KEY = 'colaca_silagem_fornecedores';

export function getStoredReformOrders(): TireReformOrder[] {
  try {
    const raw = localStorage.getItem(REFORM_ORDERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Erro ao carregar pedidos de reforma ativos:', e);
  }
  return [];
}

export function saveStoredReformOrders(orders: TireReformOrder[]): void {
  try {
    localStorage.setItem(REFORM_ORDERS_STORAGE_KEY, JSON.stringify(orders));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('colaca_silagem_pedidos_reforma_updated', { detail: orders }));
    }
  } catch (e) {
    console.warn('Erro ao salvar pedidos de reforma:', e);
  }
}

export function getStoredPendingReformTires(): TireItem[] {
  try {
    const raw = localStorage.getItem(PENDING_REFORM_TIRES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Erro ao carregar pneus aguardando pedido:', e);
  }
  return [];
}

export function getStoredReformSuppliers(): Supplier[] {
  try {
    const raw = localStorage.getItem(SUPPLIERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    const standardRaw = localStorage.getItem('silagem_facil_clean_v1_suppliers');
    if (standardRaw) {
      const parsedStd = JSON.parse(standardRaw);
      if (Array.isArray(parsedStd) && parsedStd.length > 0) return parsedStd;
    }
  } catch (e) {
    console.warn('Erro ao carregar fornecedores:', e);
  }
  return [
    { id: 'sup_rec_1', name: 'Bandag Recapagens & Pneus Ltda', tradeName: 'Bandag Recapadora', category: 'Pneus & Recapagem', cnpjOrCpf: '12.345.678/0001-90', phone: '(44) 3622-1020' },
    { id: 'sup_rec_2', name: 'Tipler Reforma de Pneus Agrícolas e Rodoviários', tradeName: 'Tipler Recapagem', category: 'Pneus & Recapagem', cnpjOrCpf: '23.456.789/0001-01', phone: '(44) 3649-5500' },
    { id: 'sup_rec_3', name: 'Vipal Pneus & Reformadora Regional', tradeName: 'Vipal Reformadora', category: 'Pneus & Recapagem', cnpjOrCpf: '34.567.890/0001-12', phone: '(44) 3624-8899' },
  ];
}

/**
 * AÇÃO 2: ATUALIZAR O STATUS DO PNEU NA FROTA E RETORNAR AO ESTOQUE
 * - Varre a chave 'colaca_silagem_frotas_pneus_estoque' e muda o status dos pneus vinculados
 *   a este pedido de "Em Reforma" para "Disponível (Estoque)".
 * - Incrementa a quantidade física destes pneus no estoque global para que eles "brotem"
 *   reativamente na tela de frotas prontos para serem montados novamente nos eixos do caminhão ou da forrageira.
 */
export function efetivarRetornoPneusEstoque(order: TireReformOrder): void {
  try {
    const orderTireIds = new Set(order.tires.map(t => t.id));
    const orderFireNumbers = new Set(order.tires.map(t => (t.fireNumber || '').trim().toUpperCase()).filter(Boolean));

    // 1. Atualiza pneus na chave 'colaca_silagem_frotas_pneus_estoque'
    let fleetTires: TireItem[] = [];
    try {
      const raw = localStorage.getItem('colaca_silagem_frotas_pneus_estoque') || localStorage.getItem(STORAGE_KEYS.TIRE_INVENTORY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) fleetTires = parsed;
      }
    } catch (_) {}

    fleetTires = fleetTires.map(tire => {
      const fn = (tire.fireNumber || '').trim().toUpperCase();
      if (orderTireIds.has(tire.id) || (fn && orderFireNumbers.has(fn))) {
        return {
          ...tire,
          status: 'Disponível (Estoque)' as any,
          statusName: 'Disponível (Estoque)',
          position: 'estoque' as const,
          positionName: 'Estoque Geral',
          vehicleId: undefined,
          vehiclePlate: undefined,
          vehicleName: undefined,
          motivo_reforma: undefined,
          servico_reforma: undefined,
          retreadCount: ((tire.retreadCount || tire.reformedCount || 0) + 1),
          reformedCount: ((tire.reformedCount || tire.retreadCount || 0) + 1),
          treadDepthMm: tire.treadDepthMm && tire.treadDepthMm > 0 ? tire.treadDepthMm : 15,
          updatedAt: new Date().toISOString()
        };
      }
      return tire;
    });

    // Garante que todos os pneus da ordem estejam presentes no estoque
    for (const ot of order.tires) {
      const fn = (ot.fireNumber || '').trim().toUpperCase();
      const alreadyPresent = fleetTires.some(t => t.id === ot.id || (fn && (t.fireNumber || '').trim().toUpperCase() === fn));
      if (!alreadyPresent) {
        fleetTires.push({
          id: ot.id || `pneu_ret_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          fireNumber: ot.fireNumber || `#${Math.floor(1000 + Math.random() * 9000)}`,
          brand: ot.brand || 'Michelin',
          model: ot.model || 'X MultiWay 3D',
          size: ot.size || '295/80 R 22.5',
          treadDepthMm: ot.treadDepthMm && ot.treadDepthMm > 0 ? ot.treadDepthMm : 15,
          position: 'estoque',
          positionName: 'Estoque Geral',
          status: 'Disponível (Estoque)',
          statusName: 'Disponível (Estoque)',
          retreadCount: 1,
          reformedCount: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    }

    // Salva o estoque de pneus no LocalStorage
    saveStoredTireInventory(fleetTires);

    // 2. Remove os pneus retornados da lista de pendentes e em reforma
    try {
      const rawPending = localStorage.getItem(PENDING_REFORM_TIRES_KEY);
      if (rawPending) {
        const list = JSON.parse(rawPending);
        if (Array.isArray(list)) {
          const remaining = list.filter(t => !orderTireIds.has(t.id) && !orderFireNumbers.has((t.fireNumber || '').trim().toUpperCase()));
          localStorage.setItem(PENDING_REFORM_TIRES_KEY, JSON.stringify(remaining));
        }
      }
    } catch (_) {}

    try {
      const inReform = getStoredTiresInReform();
      const remainingInReform = inReform.filter(t => !orderTireIds.has(t.id) && !orderFireNumbers.has((t.fireNumber || '').trim().toUpperCase()));
      saveStoredTiresInReform(remainingInReform);
    } catch (_) {}

    // 3. Incrementa a quantidade física no estoque global de produtos
    try {
      const inventory = getStoredInventory();
      let inventoryChanged = false;
      for (const tire of order.tires) {
        const tireBrand = (tire.brand || '').toLowerCase().trim();
        const tireSize = (tire.size || '').toLowerCase().trim();
        let matchedProd = inventory.find(p => {
          const pName = (p.nome_comercial || p.name || p.nome || '').toLowerCase();
          const isTireCat = p.category?.toLowerCase() === 'pneus' || p.categoria?.toLowerCase() === 'pneus';
          return isTireCat && (pName.includes(tireBrand) || (tireSize && pName.includes(tireSize)));
        });
        if (!matchedProd) {
          matchedProd = inventory.find(p => p.category?.toLowerCase() === 'pneus' || p.categoria?.toLowerCase() === 'pneus');
        }
        if (matchedProd) {
          matchedProd.quantity = (Number(matchedProd.quantity) || 0) + 1;
          inventoryChanged = true;
        }
      }
      if (inventoryChanged) {
        saveStoredInventory(inventory);
      }
    } catch (errInv) {
      console.warn('Erro ao incrementar produtos no estoque global:', errInv);
    }

    // 4. Dispara eventos para atualização instantânea na interface
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tire_inventory_updated', { detail: fleetTires }));
      window.dispatchEvent(new CustomEvent('silagem_tire_inventory_updated', { detail: fleetTires }));
      window.dispatchEvent(new CustomEvent('colaca_silagem_frotas_pneus_updated', { detail: fleetTires }));
    }
  } catch (err) {
    console.error('Erro ao efetivar retorno de pneus no estoque:', err);
  }
}

/**
 * AÇÃO 3: LANÇAMENTO AUTOMÁTICO NO CONTAS A PAGAR (FINANCEIRO)
 * - Gera o registro de despesa correspondente na chave 'colaca_silagem_financeiro_contas_pagar',
 *   jogando o valor total como uma duplicata provisionada em nome do Fornecedor/Recapadora
 *   com base na data atual de fechamento.
 */
export function lancarContasPagarRetornoReforma(order: TireReformOrder): void {
  try {
    const today = new Date().toISOString().split('T')[0];
    const orderSum = order.totalValor !== undefined && order.totalValor !== null && order.totalValor > 0
      ? order.totalValor
      : order.tires.reduce((acc, t) => acc + (t.valorUnitario || 0), 0);

    const payableRecord = {
      id: `pagar_reforma_${order.id}_${Date.now()}`,
      pedido_reforma_id: order.id,
      numero_ordem: order.orderNumber,
      numero_documento: order.orderNumber,
      fornecedor: order.supplierName,
      fornecedor_nome: order.supplierName,
      fornecedor_id: order.supplierId,
      descricao: `Retorno Pedido de Reforma ${order.orderNumber} - ${order.supplierName}`,
      valor: orderSum,
      valor_total: orderSum,
      valor_parcela: orderSum,
      numero_parcela: '01/01',
      tipo_documento: 'NOTA',
      data_emissao: today,
      data_vencimento: order.expectedReturnDate || today,
      status: 'provisionada', // Duplicata provisionada em nome do Fornecedor/Recapadora
      status_pago: false,
      centro_custo: 'Recapagem e Reforma de Pneus',
      categoria: 'Manutenção de Frotas / Pneus',
      tipo_despesa: 'Manutenção de Frotas / Pneus',
      created_at: new Date().toISOString(),
    };

    // 1. Salva na chave solicitada 'colaca_silagem_financeiro_contas_pagar'
    try {
      const rawPayables = localStorage.getItem('colaca_silagem_financeiro_contas_pagar');
      const list = rawPayables ? JSON.parse(rawPayables) : [];
      const filtered = Array.isArray(list) ? list.filter((p: any) => p.pedido_reforma_id !== order.id && p.numero_ordem !== order.orderNumber) : [];
      const updatedPayables = [payableRecord, ...filtered];
      localStorage.setItem('colaca_silagem_financeiro_contas_pagar', JSON.stringify(updatedPayables));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('financeiro_contas_pagar_updated', { detail: updatedPayables }));
      }
    } catch (e) {
      console.warn('Erro ao salvar em colaca_silagem_financeiro_contas_pagar:', e);
    }

    // 2. Sincroniza também na chave de despesas gerais para relatórios e dashboards
    try {
      const rawExpenses = localStorage.getItem(STORAGE_KEYS.EXPENSES);
      const expenses: Expense[] = rawExpenses ? JSON.parse(rawExpenses) : [];
      const expenseItem: Expense = {
        id: payableRecord.id,
        description: payableRecord.descricao,
        amount: orderSum,
        categoryId: 'cat_frotas_pneus',
        categoryName: 'Manutenção de Frotas / Pneus',
        categoryColor: '#f59e0b',
        dueDate: payableRecord.data_vencimento,
        status: 'pendente',
        paymentMethod: 'boleto',
        supplier: order.supplierName,
        invoiceNumber: order.orderNumber,
        notes: `Duplicata provisionada ref. fechamento ${order.orderNumber} (${order.supplierName})`,
        createdAt: new Date().toISOString()
      };
      const filteredExp = expenses.filter(e => e.id !== payableRecord.id && (!e.invoiceNumber || e.invoiceNumber !== order.orderNumber));
      const newExpenses = [expenseItem, ...filteredExp];
      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(newExpenses));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('expenses_updated', { detail: newExpenses }));
      }
    } catch (e) {
      console.warn('Erro ao sincronizar despesa no EXPENSES:', e);
    }
  } catch (err) {
    console.error('Erro ao lançar contas a pagar do retorno de reforma:', err);
  }
}

export interface TireReformOrderViewProps {
  companyProfile?: CompanyProfile;
  initialCreateMode?: boolean;
  onOrderSaved?: (order: TireReformOrder) => void;
  onEfetivarRetorno?: (order: TireReformOrder) => void;
}

export const TireReformOrderView: React.FC<TireReformOrderViewProps> = ({
  companyProfile,
  initialCreateMode = false,
  onOrderSaved,
  onEfetivarRetorno,
}) => {
  const [orders, setOrders] = useState<TireReformOrder[]>(() => getStoredReformOrders());
  const [isCreatingNewOrder, setIsCreatingNewOrder] = useState<boolean>(initialCreateMode);
  const [editingOrder, setEditingOrder] = useState<TireReformOrder | null>(null);
  const [selectedOrderForView, setSelectedOrderForView] = useState<TireReformOrder | null>(null);

  // Fornecedores
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => getStoredReformSuppliers());
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [customSupplierName, setCustomSupplierName] = useState<string>('');

  // Estoque unificado: Filtra EXCLUSIVAMENTE serviços de borracharia da chave 'colaca_silagem_estoque_produtos'
  const [borrachariaStockItems, setBorrachariaStockItems] = useState<InventoryItem[]>(() => getBorrachariaServicesFromStock());

  const borrachariaServicesList = useMemo(() => {
    return borrachariaStockItems.map(item => {
      const name = normalizeStockServiceName(item.nome_comercial || item.name || item.nome || '');
      const price = 
        item.salePrice !== undefined && item.salePrice > 0 ? item.salePrice :
        item.preco_venda_varejo !== undefined && item.preco_venda_varejo > 0 ? item.preco_venda_varejo :
        item.preco_venda !== undefined && item.preco_venda > 0 ? item.preco_venda :
        (item as any).valorFinal !== undefined && (item as any).valorFinal > 0 ? (item as any).valorFinal :
        (item as any).precoVenda !== undefined && (item as any).precoVenda > 0 ? (item as any).precoVenda :
        (item.unitCost !== undefined && item.profitMargin !== undefined && item.unitCost > 0
          ? Math.round(item.unitCost * (1 + item.profitMargin / 100) * 100) / 100
          : (item.unitCost || 0));
      return {
        id: item.id,
        name,
        price,
      };
    });
  }, [borrachariaStockItems]);

  // Pneus em buffer para a nova ordem com serviço de borracharia e preço automático puxado do estoque
  const [pendingTires, setPendingTires] = useState<TireItem[]>(() => {
    const rawTires = getStoredPendingReformTires();
    const stockItems = getBorrachariaServicesFromStock();
    const defaultSrv = stockItems[0] ? normalizeStockServiceName(stockItems[0].nome_comercial || stockItems[0].name || '') : 'SERVIÇO DE RECAPAGEM DE PNEU';

    return rawTires.map(t => {
      const srvName = normalizeStockServiceName(t.servico_reforma || defaultSrv).toUpperCase();
      const matched = stockItems.find(s => normalizeStockServiceName(s.nome_comercial || s.name || s.nome || '').toUpperCase() === srvName);
      const stockPrice = matched ? (matched.salePrice || matched.preco_venda_varejo || matched.preco_venda || (matched as any).valorFinal || (matched as any).precoVenda || 0) : 0;
      const finalPrice = t.valor_reforma !== undefined && t.valor_reforma > 0 ? t.valor_reforma : (t.reformCost && t.reformCost > 0 ? t.reformCost : stockPrice);

      return {
        ...t,
        servico_reforma: srvName,
        valor_reforma: finalPrice,
        reformCost: finalPrice,
      };
    });
  });
  const [driverName, setDriverName] = useState<string>('');
  const [expectedReturnDate, setExpectedReturnDate] = useState<string>('');
  const [orderNotes, setOrderNotes] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [orderSavedToast, setOrderSavedToast] = useState<boolean>(false);
  const [orderForPrint, setOrderForPrint] = useState<TireReformOrder | null>(null);
  const [popupBlockedWarning, setPopupBlockedWarning] = useState<boolean>(false);

  // Limpeza de estado após impressão da página
  useEffect(() => {
    const handleAfterPrint = () => {
      setOrderForPrint(null);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  const company = useMemo(() => companyProfile || getStoredCompanyProfile(), [companyProfile]);

  // Soma automática em lote de todos os valores unitários preenchidos nos pneus da lista
  const totalPendingValue = useMemo(() => {
    return pendingTires.reduce((acc, t) => acc + (t.valor_reforma || t.reformCost || 0), 0);
  }, [pendingTires]);

  // Sincroniza quando houver gatilho de novo pedido vindo da frota ou atualização de serviços
  useEffect(() => {
    const handleTrigger = (e: any) => {
      const tires: TireItem[] = e?.detail?.tires || getStoredPendingReformTires();
      const stockItems = getBorrachariaServicesFromStock();
      const defaultSrv = stockItems[0] ? normalizeStockServiceName(stockItems[0].nome_comercial || stockItems[0].name || '') : 'SERVIÇO DE RECAPAGEM DE PNEU';

      if (tires && tires.length > 0) {
        setPendingTires(tires.map(t => {
          const srvName = normalizeStockServiceName(t.servico_reforma || defaultSrv).toUpperCase();
          const matched = stockItems.find(s => normalizeStockServiceName(s.nome_comercial || s.name || s.nome || '').toUpperCase() === srvName);
          const stockPrice = matched ? (matched.salePrice || matched.preco_venda_varejo || matched.preco_venda || (matched as any).valorFinal || (matched as any).precoVenda || 0) : 0;
          const finalPrice = t.valor_reforma !== undefined && t.valor_reforma > 0 ? t.valor_reforma : (t.reformCost && t.reformCost > 0 ? t.reformCost : stockPrice);

          return {
            ...t,
            servico_reforma: srvName,
            valor_reforma: finalPrice,
            reformCost: finalPrice,
          };
        }));
      }
      setIsCreatingNewOrder(true);
    };

    const handleServicesSync = () => {
      setBorrachariaStockItems(getBorrachariaServicesFromStock());
    };

    const handleStorage = (event?: StorageEvent) => {
      setOrders(getStoredReformOrders());
      setSuppliers(getStoredReformSuppliers());
      setBorrachariaStockItems(getBorrachariaServicesFromStock());
      const pTires = getStoredPendingReformTires();
      if (pTires.length > 0) {
        setPendingTires(pTires.map(t => ({
          ...t,
          servico_reforma: normalizeStockServiceName(t.servico_reforma || DEFAULT_STOCK_SERVICES[0]).toUpperCase(),
          valor_reforma: t.valor_reforma !== undefined ? t.valor_reforma : (t.reformCost || 0),
        })));
      }
    };

    window.addEventListener('colaca_silagem_abrir_pedido_reforma', handleTrigger);
    window.addEventListener('colaca_silagem_servicos_estoque_updated', handleServicesSync);
    window.addEventListener('colaca_silagem_estoque_produtos_updated', handleServicesSync);
    window.addEventListener('colaca_silagem_pedidos_reforma_updated', handleStorage);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('colaca_silagem_abrir_pedido_reforma', handleTrigger);
      window.removeEventListener('colaca_silagem_servicos_estoque_updated', handleServicesSync);
      window.removeEventListener('colaca_silagem_estoque_produtos_updated', handleServicesSync);
      window.removeEventListener('colaca_silagem_pedidos_reforma_updated', handleStorage);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Efetivar retorno do pedido de reforma (Regra de Negócio 2 e 3)
  const handleEfetivarRetorno = (order: TireReformOrder) => {
    // 1. AÇÃO 2: Atualizar pneus na frota e estoque
    efetivarRetornoPneusEstoque(order);

    // 2. AÇÃO 3: Lançamento automático no Contas a Pagar (Financeiro)
    lancarContasPagarRetornoReforma(order);

    // 3. AÇÃO 1: Redirecionar e popular o modal de Nova Entrada Manual
    if (onEfetivarRetorno) {
      onEfetivarRetorno(order);
    } else {
      // Fallback local: Marca como Concluído caso chamado isoladamente
      const updated = orders.map(o => o.id === order.id ? { ...o, status: 'Concluído' as const } : o);
      setOrders(updated);
      saveStoredReformOrders(updated);
      setSuccessMessage(`Retorno de ${order.orderNumber} efetivado com sucesso! Pneus devolvidos ao estoque.`);
      setTimeout(() => setSuccessMessage(''), 4000);
    }
  };

  // Seleção automática do primeiro fornecedor de recapagem se disponível
  useEffect(() => {
    if (suppliers.length > 0 && !selectedSupplierId) {
      const recap = suppliers.find(s => (s.category || '').toLowerCase().includes('pneu') || (s.name || '').toLowerCase().includes('recap'));
      setSelectedSupplierId(recap ? recap.id : suppliers[0].id);
    }
  }, [suppliers, selectedSupplierId]);

  // Remove um pneu específico da lista de envio
  const handleRemoveTireFromPending = (tireId: string) => {
    const updated = pendingTires.filter(t => t.id !== tireId);
    setPendingTires(updated);
    if (!editingOrder) {
      localStorage.setItem(PENDING_REFORM_TIRES_KEY, JSON.stringify(updated));
    }
  };

  // Reabrir pedido para edição (Requisito 2)
  const handleStartEditOrder = (orderToEdit: TireReformOrder) => {
    // 1. Recupera o objeto atualizado diretamente do LocalStorage para consistência
    const stored = getStoredReformOrders();
    const targetOrder = stored.find(o => o.id === orderToEdit.id) || orderToEdit;

    setEditingOrder(targetOrder);

    // 2. Injeta fornecedor
    if (targetOrder.supplierId) {
      setSelectedSupplierId(targetOrder.supplierId);
      setCustomSupplierName('');
    } else {
      const match = suppliers.find(s => (s.tradeName || s.name).toUpperCase() === targetOrder.supplierName.toUpperCase());
      if (match) {
        setSelectedSupplierId(match.id);
        setCustomSupplierName('');
      } else {
        setSelectedSupplierId('outro');
        setCustomSupplierName(targetOrder.supplierName);
      }
    }

    // 3. Injeta motorista, previsão e notas
    setDriverName(targetOrder.driverName || '');
    setExpectedReturnDate(targetOrder.expectedReturnDate || '');
    setOrderNotes(targetOrder.notes || '');

    // 4. Injeta lista de pneus reativamente com serviços e valores
    const mappedTires: TireItem[] = targetOrder.tires.map((t, idx) => ({
      id: t.id || `pneu_edit_${idx}_${Date.now()}`,
      fireNumber: t.fireNumber,
      brand: t.brand,
      model: t.model,
      size: t.size || '295/80 R 22.5',
      position: 'reforma',
      positionName: 'Em Reforma / Recapagem',
      status: 'reforma',
      treadDepthMm: t.treadDepthMm || 0,
      vehiclePlate: t.vehiclePlate,
      vehicleName: t.vehicleName,
      notes: t.notes || t.motivo_reforma || '',
      motivo_reforma: t.motivo_reforma || t.notes || '',
      servico_reforma: normalizeStockServiceName(t.servico || DEFAULT_STOCK_SERVICES[0]).toUpperCase(),
      valor_reforma: t.valorUnitario !== undefined ? t.valorUnitario : 0,
      reformCost: t.valorUnitario !== undefined ? t.valorUnitario : 0,
    }));

    setPendingTires(mappedTires);
    setIsCreatingNewOrder(true);
    setErrorMessage('');
    setSuccessMessage('');
  };

  // Cancela formulário e volta ao histórico
  const handleCancelForm = () => {
    setIsCreatingNewOrder(false);
    setEditingOrder(null);
    setDriverName('');
    setExpectedReturnDate('');
    setOrderNotes('');
    setCustomSupplierName('');
    // Reseta pendingTires para os pneus realmente pendentes no LocalStorage
    const rawTires = getStoredPendingReformTires();
    setPendingTires(rawTires.map(t => ({
      ...t,
      servico_reforma: normalizeStockServiceName(t.servico_reforma || DEFAULT_STOCK_SERVICES[0]).toUpperCase(),
      valor_reforma: t.valor_reforma !== undefined ? t.valor_reforma : (t.reformCost || 0),
    })));
  };

  // Atualiza o serviço selecionado para um pneu específico e puxa automaticamente o preço do estoque (V. FINAL)
  const handleUpdateTireService = (tireId: string, servico: string) => {
    const upperServico = normalizeStockServiceName(servico).toUpperCase();

    // Localiza o serviço de borracharia na lista de estoque e captura o preço de venda configurado
    const matchedStockItem = borrachariaServicesList.find(s => s.name.toUpperCase() === upperServico);
    const autoPrice = matchedStockItem !== undefined ? (matchedStockItem.price ?? 0) : undefined;

    const updated = pendingTires.map(t => {
      if (t.id === tireId) {
        return {
          ...t,
          servico_reforma: upperServico,
          ...(autoPrice !== undefined ? { valor_reforma: autoPrice, reformCost: autoPrice } : {})
        };
      }
      return t;
    });

    setPendingTires(updated);
    if (!editingOrder) {
      try {
        localStorage.setItem(PENDING_REFORM_TIRES_KEY, JSON.stringify(updated));
      } catch {}
    }

    // Foco automático e seleção do campo de valor unitário
    setTimeout(() => {
      const valorInput = document.getElementById(`valor-unitario-${tireId}`) as HTMLInputElement | null;
      if (valorInput) {
        valorInput.focus();
        valorInput.select();
      }
    }, 40);
  };

  // Atualiza o valor unitário digitado para um pneu específico
  const handleUpdateTireValor = (tireId: string, raw: string) => {
    const cleanDigits = raw.replace(/\D/g, '');
    const floatVal = cleanDigits ? Number(cleanDigits) / 100 : 0;
    const updated = pendingTires.map(t => t.id === tireId ? { ...t, valor_reforma: floatVal, reformCost: floatVal } : t);
    setPendingTires(updated);
    if (!editingOrder) {
      try {
        localStorage.setItem(PENDING_REFORM_TIRES_KEY, JSON.stringify(updated));
      } catch {}
    }
  };

  // Atualiza o motivo/problema relatado
  const handleUpdateTireMotivo = (tireId: string, motivo: string) => {
    const upperMotivo = motivo.toUpperCase();
    const updated = pendingTires.map(t => t.id === tireId ? { ...t, motivo_reforma: upperMotivo } : t);
    setPendingTires(updated);
    if (!editingOrder) {
      try {
        localStorage.setItem(PENDING_REFORM_TIRES_KEY, JSON.stringify(updated));
      } catch {}
    }
  };

  // Aplica serviço em lote para todos os pneus pendentes e puxa o preço automático do estoque
  const handleApplyBatchService = (serviceToApply: string) => {
    if (!serviceToApply) return;
    const upper = normalizeStockServiceName(serviceToApply).toUpperCase();
    const matchedStockItem = borrachariaServicesList.find(s => s.name.toUpperCase() === upper);
    const autoPrice = matchedStockItem !== undefined ? (matchedStockItem.price ?? 0) : undefined;

    const updated = pendingTires.map(t => ({
      ...t,
      servico_reforma: upper,
      ...(autoPrice !== undefined ? { valor_reforma: autoPrice, reformCost: autoPrice } : {})
    }));
    setPendingTires(updated);
    if (!editingOrder) {
      try {
        localStorage.setItem(PENDING_REFORM_TIRES_KEY, JSON.stringify(updated));
      } catch {}
    }
  };

  // Salvar Ordem de Envio de Reforma (Criação ou Edição)
  const handleSaveOrder = () => {
    if (pendingTires.length === 0) {
      setErrorMessage('Nenhum pneu acumulado para a ordem de reforma.');
      return;
    }

    const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);
    const finalSupplierName = selectedSupplier ? (selectedSupplier.tradeName || selectedSupplier.name) : customSupplierName.trim();

    if (!finalSupplierName) {
      setErrorMessage('Por favor, selecione ou informe o Fornecedor / Recapadora.');
      return;
    }

    const totalValor = pendingTires.reduce((acc, t) => acc + (t.valor_reforma || t.reformCost || 0), 0);

    const tiresPayload = pendingTires.map(t => ({
      id: t.id,
      fireNumber: t.fireNumber.toUpperCase(),
      brand: t.brand.toUpperCase(),
      model: t.model ? t.model.toUpperCase() : undefined,
      size: (t.size || '295/80 R 22.5').toUpperCase(),
      vehiclePlate: t.vehiclePlate ? t.vehiclePlate.toUpperCase() : undefined,
      vehicleName: t.vehicleName ? t.vehicleName.toUpperCase() : undefined,
      notes: (t.motivo_reforma || t.notes || '').toUpperCase(),
      motivo_reforma: t.motivo_reforma ? t.motivo_reforma.toUpperCase() : undefined,
      servico: normalizeStockServiceName(t.servico_reforma || DEFAULT_STOCK_SERVICES[0]).toUpperCase(),
      valorUnitario: t.valor_reforma !== undefined ? t.valor_reforma : (t.reformCost || 0),
    }));

    if (editingOrder) {
      // MODO EDIÇÃO: Atualiza o registro existente mantendo número, status e data originais
      const updatedOrder: TireReformOrder = {
        ...editingOrder,
        supplierId: selectedSupplierId || undefined,
        supplierName: finalSupplierName.toUpperCase(),
        supplierCnpj: selectedSupplier?.cnpjOrCpf,
        supplierPhone: selectedSupplier?.phone,
        driverName: driverName.trim() ? driverName.trim().toUpperCase() : undefined,
        expectedReturnDate: expectedReturnDate || undefined,
        tires: tiresPayload,
        totalTires: pendingTires.length,
        totalValor,
        notes: orderNotes.trim() ? orderNotes.trim().toUpperCase() : undefined,
      };

      const updatedOrders = orders.map(o => o.id === editingOrder.id ? updatedOrder : o);
      setOrders(updatedOrders);
      saveStoredReformOrders(updatedOrders);

      setEditingOrder(null);
      setIsCreatingNewOrder(false);
      setSelectedOrderForView(updatedOrder);
      setSuccessMessage(`Pedido ${editingOrder.orderNumber} atualizado com sucesso! Total: R$ ${formatCurrencyPtBr(totalValor)}`);
      setErrorMessage('');

      if (onOrderSaved) {
        onOrderSaved(updatedOrder);
      }

      setTimeout(() => {
        setSuccessMessage('');
      }, 4000);
      return;
    }

    // MODO CRIAÇÃO: Novo pedido
    const nextNumber = String(orders.length + 1).padStart(3, '0');
    const orderNumber = `REF-${new Date().getFullYear()}-${nextNumber}`;

    const newOrder: TireReformOrder = {
      id: `ped_ref_${Date.now()}`,
      orderNumber,
      createdAt: new Date().toISOString(),
      supplierId: selectedSupplierId || undefined,
      supplierName: finalSupplierName.toUpperCase(),
      supplierCnpj: selectedSupplier?.cnpjOrCpf,
      supplierPhone: selectedSupplier?.phone,
      driverName: driverName.trim() ? driverName.trim().toUpperCase() : undefined,
      expectedReturnDate: expectedReturnDate || undefined,
      status: 'Aguardando Retorno / Nota',
      tires: tiresPayload,
      totalTires: pendingTires.length,
      totalValor,
      notes: orderNotes.trim() ? orderNotes.trim().toUpperCase() : undefined,
    };

    const updatedOrders = [newOrder, ...orders];
    setOrders(updatedOrders);
    saveStoredReformOrders(updatedOrders);

    // Limpa a chave de pneus aguardando pedido conforme requisito
    localStorage.removeItem(PENDING_REFORM_TIRES_KEY);
    localStorage.removeItem('colaca_silagem_abrir_pedido_reforma');
    setPendingTires([]);

    setIsCreatingNewOrder(false);
    setSelectedOrderForView(newOrder);
    setSuccessMessage(`Pedido ${orderNumber} registrado com sucesso com status "Aguardando Retorno / Nota"! Total: R$ ${formatCurrencyPtBr(totalValor)}`);
    setErrorMessage('');

    if (onOrderSaved) {
      onOrderSaved(newOrder);
    }

    setTimeout(() => {
      setSuccessMessage('');
    }, 4000);
  };

  // Atualiza o serviço de um pneu diretamente na ordem visualizada
  const handleUpdateViewedOrderTireService = (tireId: string, newService: string) => {
    if (!selectedOrderForView) return;
    const upperService = normalizeStockServiceName(newService).toUpperCase();
    const matchedStockItem = borrachariaServicesList.find(s => s.name.toUpperCase() === upperService);
    const autoPrice = matchedStockItem !== undefined ? (matchedStockItem.price ?? 0) : undefined;

    const updatedTires = selectedOrderForView.tires.map(t => {
      if (t.id === tireId) {
        return {
          ...t,
          servico: upperService,
          valorUnitario: autoPrice !== undefined ? autoPrice : t.valorUnitario,
        };
      }
      return t;
    });

    const newTotalValor = updatedTires.reduce((acc, t) => acc + (t.valorUnitario || 0), 0);
    setSelectedOrderForView({
      ...selectedOrderForView,
      tires: updatedTires,
      totalValor: newTotalValor,
    });
  };

  // Atualiza o valor unitário de um pneu diretamente na ordem visualizada
  const handleUpdateViewedOrderTireValor = (tireId: string, rawValue: string) => {
    if (!selectedOrderForView) return;
    const cleanDigits = rawValue.replace(/\D/g, '');
    const floatVal = cleanDigits ? Number(cleanDigits) / 100 : 0;

    const updatedTires = selectedOrderForView.tires.map(t => {
      if (t.id === tireId) {
        return {
          ...t,
          valorUnitario: floatVal,
        };
      }
      return t;
    });

    const newTotalValor = updatedTires.reduce((acc, t) => acc + (t.valorUnitario || 0), 0);
    setSelectedOrderForView({
      ...selectedOrderForView,
      tires: updatedTires,
      totalValor: newTotalValor,
    });
  };

  // Atualiza o motivo/observação do pneu diretamente na ordem visualizada
  const handleUpdateViewedOrderTireMotivo = (tireId: string, newMotivo: string) => {
    if (!selectedOrderForView) return;
    const upperMotivo = newMotivo.toUpperCase();
    const updatedTires = selectedOrderForView.tires.map(t => {
      if (t.id === tireId) {
        return {
          ...t,
          motivo_reforma: upperMotivo,
        };
      }
      return t;
    });

    setSelectedOrderForView({
      ...selectedOrderForView,
      tires: updatedTires,
    });
  };

  // Salva a ordem visualizada consolidando alterações na grade de pneus na chave 'colaca_silagem_pedidos_reforma_ativos' (Requisito 1)
  const handleSaveViewedOrder = () => {
    if (!selectedOrderForView) return;

    const newTotalValor = selectedOrderForView.tires.reduce((acc, t) => acc + (t.valorUnitario || 0), 0);
    const orderToSave: TireReformOrder = {
      ...selectedOrderForView,
      totalValor: newTotalValor,
    };

    const updatedOrders = orders.map(o => o.id === orderToSave.id ? orderToSave : o);
    setOrders(updatedOrders);
    saveStoredReformOrders(updatedOrders);

    if (onOrderSaved) {
      onOrderSaved(orderToSave);
    }

    setOrderSavedToast(true);
    setSuccessMessage('Ordem salva com sucesso!');
    setTimeout(() => {
      setOrderSavedToast(false);
      setSuccessMessage('');
    }, 4000);
  };

  // Excluir permanentemente pedido de reforma
  const handleDeleteOrder = (orderToDelete: TireReformOrder) => {
    const confirmed = window.confirm('Deseja excluir permanentemente este pedido de reforma?');
    if (!confirmed) return;

    const updatedOrders = orders.filter(o => o.id !== orderToDelete.id);
    setOrders(updatedOrders);
    saveStoredReformOrders(updatedOrders);

    // Se estiver visualizando a ordem excluída, fecha o modal
    if (selectedOrderForView?.id === orderToDelete.id) {
      setSelectedOrderForView(null);
    }

    setSuccessMessage(`Pedido ${orderToDelete.orderNumber} excluído com sucesso!`);
    setTimeout(() => {
      setSuccessMessage('');
    }, 4000);
  };

  // Impressão da Ficha A4 com Logotipo, Assinatura e Total em R$ (Bypass de Sandbox/Iframe)
  const handlePrint = (orderToPrint?: TireReformOrder) => {
    const targetOrder = orderToPrint || selectedOrderForView || orderForPrint;
    if (targetOrder) {
      setOrderForPrint(targetOrder);
    }
    setPopupBlockedWarning(false);

    // Timeout para sincronização com o ciclo de renderização do React e DOM de #area-impressao-ordem
    setTimeout(() => {
      try {
        const areaElement = document.getElementById('area-impressao-ordem');
        const printContent = areaElement ? areaElement.innerHTML : '';
        const printWindow = window.open('', '_blank');

        if (printWindow) {
          printWindow.document.write(`
            <html>
              <head>
                <meta charset="utf-8" />
                <title>ORDEM DE REFORMA - COLAÇA SILAGEM</title>
                <script src="https://tailwindcss.com"></script>
                <script src="https://cdn.tailwindcss.com"></script>
                <style>
                  @media print { 
                    body { margin: 0; } 
                    @page { size: A4 portrait; margin: 12mm 10mm; } 
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                  }
                  body {
                    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    text-transform: uppercase;
                  }
                </style>
              </head>
              <body class="bg-white p-6 uppercase" onload="window.print();">
                ${printContent || ''}
              </body>
            </html>
          `);
          printWindow.document.close();
        } else {
          // Bloqueador de pop-ups ativo no navegador
          setPopupBlockedWarning(true);
        }
      } catch (err) {
        console.warn('FALHA AO ABRIR JANELA DE IMPRESSÃO:', err);
        setPopupBlockedWarning(true);
      }
    }, 120);
  };

  const handlePrintOrder = handlePrint;

  // Ordem ativa para a folha de impressão A4
  const activeOrderForPrint = orderForPrint || selectedOrderForView || (orders.length > 0 ? orders[0] : null);

  // Filtragem da lista histórica de ordens
  const filteredOrders = useMemo(() => {
    if (!searchTerm.trim()) return orders;
    const term = searchTerm.toLowerCase();
    return orders.filter(o => 
      o.orderNumber.toLowerCase().includes(term) ||
      o.supplierName.toLowerCase().includes(term) ||
      o.tires.some(t => t.fireNumber.toLowerCase().includes(term))
    );
  }, [orders, searchTerm]);

  return (
    <div className="w-full relative">
      {/* Container de tela interativo - Ocultado estritamente na impressão */}
      <div className="w-full space-y-4 print:hidden">
      
      {/* Alerta de Pop-up Bloqueado */}
      {popupBlockedWarning && (
        <div className="p-3.5 bg-amber-500/10 dark:bg-amber-500/20 border-2 border-amber-500 rounded-xl flex items-center justify-between space-x-3 text-amber-950 dark:text-amber-200 text-xs font-black tracking-wide animate-in fade-in shadow-xs uppercase">
          <div className="flex items-center space-x-2.5">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>ATENÇÃO: ATIVE AS JANELAS POP-UP PARA ESTE SITE PARA IMPRIMIR</span>
          </div>
          <button
            type="button"
            onClick={() => setPopupBlockedWarning(false)}
            className="p-1 hover:bg-amber-500/20 rounded-lg text-amber-800 dark:text-amber-200 transition cursor-pointer"
            title="FECHAR AVISO"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Alertas */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 rounded-xl flex items-center space-x-2 text-emerald-800 dark:text-emerald-200 text-xs font-bold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 rounded-xl flex items-center space-x-2 text-rose-800 dark:text-rose-200 text-xs font-bold animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ========================================================
          MODO 1: FORMULÁRIO DE PEDIDO DE ENTRADA DE REFORMA (PASSO 2)
          ======================================================== */}
      {isCreatingNewOrder ? (
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm p-4 sm:p-5 space-y-4 animate-in fade-in">
          
          {/* Header do Formulário */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800 gap-2">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center font-bold shadow-xs shrink-0">
                <Wrench className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-stone-900 dark:text-stone-100 font-['Outfit']">
                  {editingOrder ? `Editar Pedido de Reforma (${editingOrder.orderNumber})` : 'Pedido de Entrada de Reforma (Envio à Recapadora)'}
                </h3>
                <p className="text-[11px] text-stone-500 font-medium">
                  {editingOrder
                    ? `Editando dados e valores dos ${pendingTires.length} pneus do pedido ${editingOrder.orderNumber}`
                    : `${pendingTires.length} ${pendingTires.length === 1 ? 'pneu selecionado' : 'pneus selecionados'} da frota aguardando emissão da ordem`
                  }
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleCancelForm}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 text-xs font-semibold transition cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Voltar ao Histórico</span>
              </button>
            </div>
          </div>

          {/* Cabeçalho do Pedido: Dropdown Select para escolher o Fornecedor / Recapadora */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
            
            <div className="sm:col-span-6">
              <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1">
                Fornecedor / Recapadora <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                >
                  <option value="">Selecione a Recapadora...</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.tradeName || s.name} {s.cnpjOrCpf ? `(${s.cnpjOrCpf})` : ''}
                    </option>
                  ))}
                  <option value="outro">+ Outro Fornecedor / Digitar Nome</option>
                </select>
              </div>

              {selectedSupplierId === 'outro' && (
                <div className="mt-2">
                  <input
                    type="text"
                    placeholder="DIGITE A RAZÃO SOCIAL DA RECAPADORA..."
                    value={customSupplierName}
                    onChange={(e) => setCustomSupplierName(e.target.value.toUpperCase())}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-amber-300 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-amber-500 uppercase"
                  />
                </div>
              )}
            </div>

            <div className="sm:col-span-3">
              <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1">
                Motorista / Responsável pelo Envio
              </label>
              <input
                type="text"
                placeholder="EX: JOÃO DA SILVA"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-amber-500 uppercase"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1">
                Previsão de Retorno da Recapagem
              </label>
              <input
                type="date"
                value={expectedReturnDate}
                onChange={(e) => setExpectedReturnDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

          </div>

          {/* Corpo: Tabela indexada listando todos os pneus que o usuário arrastou da frota */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-black text-stone-800 dark:text-stone-200 uppercase tracking-wider">
                  Relação Indexada de Pneus para Reforma ({pendingTires.length})
                </h4>
                <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                  Selecione o serviço a fazer e informe o valor unitário individual de cada carcaça
                </p>
              </div>

              {pendingTires.length > 0 && (
                <div className="flex items-center space-x-1.5 self-end sm:self-auto">
                  <span className="text-[10px] font-bold text-stone-500 uppercase">Aplicar serviço a todos:</span>
                  <select
                    onChange={(e) => {
                      if (e.target.value) handleApplyBatchService(e.target.value);
                    }}
                    defaultValue=""
                    className="text-[10px] font-bold py-1 px-2 max-w-[240px] truncate rounded-lg border border-amber-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 outline-none uppercase cursor-pointer"
                  >
                    <option value="" disabled>SELECIONAR EM LOTE...</option>
                    {borrachariaServicesList.map((s) => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="border border-stone-200 dark:border-stone-700 rounded-xl overflow-hidden shadow-2xs">
              <div className="max-h-[340px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-[11px] font-black uppercase sticky top-0 z-10 border-b border-stone-200 dark:border-stone-700">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-3 w-24">Nº de Fogo</th>
                      <th className="py-2.5 px-3">Marca / Modelo</th>
                      <th className="py-2.5 px-3 w-28">Medida</th>
                      <th className="py-2.5 px-3 w-28">Veículo / Placa</th>
                      <th className="py-2.5 px-3 min-w-[140px]">Problema / Observação</th>
                      <th className="py-2.5 px-3 w-64 min-w-[220px] max-w-[280px]">Serviço a Fazer</th>
                      <th className="py-2.5 px-3 w-36 text-right">Valor Unitário (R$)</th>
                      <th className="py-2.5 px-3 w-12 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                    {pendingTires.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-6 text-center text-xs text-stone-400 font-medium">
                          Nenhum pneu acumulado. Retorne à Gestão de Frotas e arraste os pneus para a caixa de Reforma.
                        </td>
                      </tr>
                    ) : (
                      pendingTires.map((t, idx) => (
                        <tr key={t.id} className="hover:bg-amber-50/40 dark:hover:bg-amber-950/20 transition">
                          <td className="py-2 px-3 text-center font-bold text-stone-500">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-3 font-mono font-black text-stone-900 dark:text-stone-100">
                            {t.fireNumber}
                          </td>
                          <td className="py-2 px-3 font-semibold text-stone-700 dark:text-stone-300">
                            {t.brand} {t.model || ''}
                          </td>
                          <td className="py-2 px-3 font-mono font-black text-amber-700 dark:text-amber-400">
                            {t.size || '295/80 R 22.5'}
                          </td>
                          <td className="py-2 px-3 font-bold text-stone-700 dark:text-stone-300">
                            {t.vehiclePlate || t.vehicleName || 'Frota Geral'}
                          </td>
                          <td className="py-2 px-3 text-xs">
                            <input
                              type="text"
                              value={t.motivo_reforma || ''}
                              onChange={(e) => handleUpdateTireMotivo(t.id, e.target.value)}
                              placeholder="Ex: Descolou a banda..."
                              className="w-full px-2 py-1 text-xs border border-stone-300 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-1 focus:ring-amber-500 uppercase"
                            />
                          </td>
                          <td className="py-2 px-3 w-64 min-w-[220px] max-w-[280px]">
                            <select
                              value={normalizeStockServiceName(t.servico_reforma || borrachariaServicesList[0]?.name || DEFAULT_STOCK_SERVICES[0])}
                              onChange={(e) => handleUpdateTireService(t.id, e.target.value)}
                              title={normalizeStockServiceName(t.servico_reforma || borrachariaServicesList[0]?.name || DEFAULT_STOCK_SERVICES[0])}
                              className="w-full px-2 py-1 text-xs font-bold border border-amber-300 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-1 focus:ring-amber-500 uppercase cursor-pointer truncate"
                            >
                              {borrachariaServicesList.map((srv) => (
                                <option key={srv.id} value={srv.name} className="py-1 text-xs">{srv.name}</option>
                              ))}
                              {t.servico_reforma && !borrachariaServicesList.some(s => s.name === normalizeStockServiceName(t.servico_reforma)) && (
                                <option value={normalizeStockServiceName(t.servico_reforma)} className="py-1 text-xs">
                                  {normalizeStockServiceName(t.servico_reforma)}
                                </option>
                              )}
                            </select>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <div className="relative">
                              <span className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-stone-400 font-bold text-xs">
                                R$
                              </span>
                              <input
                                id={`valor-unitario-${t.id}`}
                                type="text"
                                inputMode="numeric"
                                value={t.valor_reforma !== undefined && t.valor_reforma !== null && t.valor_reforma > 0 ? formatCurrencyPtBr(t.valor_reforma) : (t.reformCost ? formatCurrencyPtBr(t.reformCost) : '')}
                                onChange={(e) => handleUpdateTireValor(t.id, e.target.value)}
                                placeholder="0,00"
                                className="w-full pl-7 pr-2 py-1 text-xs font-mono font-bold text-right border border-stone-300 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-1 focus:ring-amber-500"
                              />
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveTireFromPending(t.id)}
                              className="text-stone-400 hover:text-rose-600 p-1 cursor-pointer transition"
                              title="Remover deste pedido de envio"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {pendingTires.length > 0 && (
                    <tfoot className="bg-amber-50/70 dark:bg-amber-950/40 border-t-2 border-stone-200 dark:border-stone-700 font-black text-xs">
                      <tr>
                        <td colSpan={5} className="py-2.5 px-3 uppercase text-stone-700 dark:text-stone-300">
                          QUANTIDADE TOTAL: <span className="font-black text-amber-800 dark:text-amber-300">{pendingTires.length} PNEU(S)</span>
                        </td>
                        <td colSpan={2} className="py-2.5 px-3 text-right uppercase text-amber-900 dark:text-amber-200 font-black">
                          TOTAL EM R$:
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-sm text-stone-950 dark:text-white">
                          R$ {formatCurrencyPtBr(totalPendingValue)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1">
              Observações Gerais do Pedido
            </label>
            <input
              type="text"
              placeholder="INSTRUÇÕES PARA A RECAPADORA (EX: TIPO DE DESENHO DA BANDA, PRAZO DE ENTREGA URGENTE)..."
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value.toUpperCase())}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-amber-500 uppercase"
            />
          </div>

          {/* Botões do Formulário de Pedido */}
          <div className="pt-3 border-t border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            
            <div className="text-xs text-stone-500 font-medium">
              💡 Ao salvar, o documento fica registrado com o status <strong className="text-amber-600">"Aguardando Retorno / Nota"</strong>.
            </div>

            <div className="flex items-center space-x-2.5">
              
              {/* Botão Imprimir Ficha / Pedido de Envio (Requisito 2) */}
              <button
                type="button"
                id="btn-imprimir-pedido-envio"
                onClick={() => {
                  const selSup = suppliers.find(s => s.id === selectedSupplierId);
                  const totalValor = pendingTires.reduce((acc, t) => acc + (t.valor_reforma || t.reformCost || 0), 0);
                  const tempOrder: TireReformOrder = {
                    id: 'temp_print',
                    orderNumber: `REF-${new Date().getFullYear()}-PRÉVIA`,
                    createdAt: new Date().toISOString(),
                    supplierName: selSup ? (selSup.tradeName || selSup.name).toUpperCase() : (customSupplierName ? customSupplierName.toUpperCase() : 'RECAPADORA'),
                    supplierCnpj: selSup?.cnpjOrCpf,
                    supplierPhone: selSup?.phone,
                    driverName: driverName.trim() ? driverName.trim().toUpperCase() : undefined,
                    expectedReturnDate,
                    status: 'Aguardando Retorno / Nota',
                    tires: pendingTires.map(t => ({
                      id: t.id,
                      fireNumber: t.fireNumber.toUpperCase(),
                      brand: t.brand.toUpperCase(),
                      model: t.model ? t.model.toUpperCase() : undefined,
                      size: (t.size || '295/80 R 22.5').toUpperCase(),
                      vehiclePlate: t.vehiclePlate ? t.vehiclePlate.toUpperCase() : undefined,
                      vehicleName: t.vehicleName ? t.vehicleName.toUpperCase() : undefined,
                      notes: (t.motivo_reforma || t.notes || '').toUpperCase(),
                      motivo_reforma: t.motivo_reforma ? t.motivo_reforma.toUpperCase() : undefined,
                      servico: normalizeStockServiceName(t.servico_reforma || DEFAULT_STOCK_SERVICES[0]).toUpperCase(),
                      valorUnitario: t.valor_reforma !== undefined ? t.valor_reforma : (t.reformCost || 0),
                    })),
                    totalTires: pendingTires.length,
                    totalValor,
                    notes: orderNotes.trim() ? orderNotes.trim().toUpperCase() : undefined,
                  };
                  handlePrintOrder(tempOrder);
                }}
                disabled={pendingTires.length === 0}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-stone-300 dark:border-stone-700 text-stone-800 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer disabled:opacity-50"
              >
                <Printer className="w-4 h-4 text-stone-600" />
                <span>🖨️ Imprimir Pedido de Envio</span>
              </button>

              {/* Botão Salvar Ordem */}
              <button
                type="button"
                id="btn-salvar-pedido-reforma"
                onClick={handleSaveOrder}
                disabled={pendingTires.length === 0}
                className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-black rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-stone-950 shadow-md transition cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{editingOrder ? 'Salvar Alterações' : 'Salvar Pedido de Reforma'}</span>
              </button>

            </div>

          </div>

        </div>
      ) : (
        /* ========================================================
           MODO 2: TABELA HISTÓRICA DE PEDIDOS DE REFORMA
           ======================================================== */
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm p-4 space-y-3">
          
          {/* Header da Tabela Histórica */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-stone-200 dark:border-stone-800">
            <div>
              <h3 className="text-sm font-black text-stone-900 dark:text-stone-100 font-['Outfit']">
                Histórico de Pedidos de Reforma de Pneus
              </h3>
              <p className="text-[11px] text-stone-500">
                Acompanhamento de ordens de remessa e status de retorno da recapadora
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  placeholder="Buscar ordem, recapadora..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none w-48 sm:w-56"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditingOrder(null);
                  setDriverName('');
                  setExpectedReturnDate('');
                  setOrderNotes('');
                  setCustomSupplierName('');
                  const rawTires = getStoredPendingReformTires();
                  setPendingTires(rawTires.map(t => ({
                    ...t,
                    servico_reforma: normalizeStockServiceName(t.servico_reforma || DEFAULT_STOCK_SERVICES[0]).toUpperCase(),
                    valor_reforma: t.valor_reforma !== undefined ? t.valor_reforma : (t.reformCost || 0),
                  })));
                  setIsCreatingNewOrder(true);
                }}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-stone-950 text-xs font-black shadow-xs transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Novo Pedido de Reforma</span>
              </button>
            </div>
          </div>

          {/* Tabela de Ordens */}
          <div className="border border-stone-200 dark:border-stone-700 rounded-xl overflow-hidden shadow-2xs">
            <div className="max-h-[420px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-[11px] font-black uppercase sticky top-0 z-10 border-b border-stone-200 dark:border-stone-700">
                  <tr>
                    <th className="py-2.5 px-3">Nº do Pedido</th>
                    <th className="py-2.5 px-3">Data de Envio</th>
                    <th className="py-2.5 px-3">Fornecedor / Recapadora</th>
                    <th className="py-2.5 px-3 text-center">Qtd. Pneus</th>
                    <th className="py-2.5 px-3 text-right">Valor Total (R$)</th>
                    <th className="py-2.5 px-3">Pneus (Nº de Fogo)</th>
                    <th className="py-2.5 px-3">Motorista</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-xs text-stone-400 font-medium">
                        Nenhum pedido de reforma registrado. Use a Gestão de Frotas para arrastar pneus e gerar uma nova ordem.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => {
                      const orderSum = order.totalValor !== undefined && order.totalValor !== null
                        ? order.totalValor
                        : order.tires.reduce((acc, t) => acc + (t.valorUnitario || 0), 0);

                      return (
                        <tr key={order.id} className="hover:bg-stone-50 dark:hover:bg-stone-800/60 transition">
                          <td className="py-2.5 px-3 font-mono font-black text-amber-700 dark:text-amber-400">
                            {order.orderNumber}
                          </td>
                          <td className="py-2.5 px-3 text-stone-600 dark:text-stone-400">
                            {formatDateBR(order.createdAt)}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-stone-800 dark:text-stone-200">
                            {order.supplierName}
                          </td>
                          <td className="py-2.5 px-3 text-center font-black">
                            <span className="px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-[11px]">
                              {order.totalTires}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-black text-stone-900 dark:text-stone-100 text-xs">
                            {orderSum > 0 ? `R$ ${formatCurrencyPtBr(orderSum)}` : '-'}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-stone-700 dark:text-stone-300 max-w-[180px] truncate" title={order.tires.map(t => t.fireNumber).join(', ')}>
                            {order.tires.map(t => t.fireNumber).join(', ')}
                          </td>
                          <td className="py-2.5 px-3 text-stone-600 dark:text-stone-400">
                            {order.driverName || '-'}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black ${
                              order.status === 'Concluído'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-amber-100 text-amber-900 border border-amber-300'
                            }`}>
                              {order.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex flex-row items-center justify-end gap-1.5 sm:gap-2">
                              {order.status === 'Concluído' ? (
                                <button
                                  type="button"
                                  disabled
                                  className="p-1.5 text-stone-300 dark:text-stone-600 cursor-not-allowed opacity-40 rounded-lg"
                                  title="Pedido Concluído - Bloqueado contra novas edições"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleStartEditOrder(order)}
                                  className="p-1.5 text-stone-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition cursor-pointer"
                                  title="Editar Pedido de Reforma"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setSelectedOrderForView(order)}
                                className="p-1.5 text-stone-500 hover:text-stone-900 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition cursor-pointer"
                                title="Visualizar Detalhes do Pedido"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePrintOrder(order)}
                                className="p-1.5 text-stone-500 hover:text-stone-900 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition cursor-pointer"
                                title="Imprimir Pedido de Envio (Ficha A4)"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>

                              {/* Botão de Excluir Pedido com ícone de Lixeira (Trash2) */}
                              <button
                                type="button"
                                id={`btn-excluir-pedido-${order.id}`}
                                onClick={() => handleDeleteOrder(order)}
                                className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition cursor-pointer"
                                title="Excluir permanentemente este pedido de reforma"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>

                              {order.status !== 'Concluído' ? (
                                <button
                                  type="button"
                                  id={`btn-efetivar-retorno-${order.id}`}
                                  onClick={() => handleEfetivarRetorno(order)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold rounded-md transition cursor-pointer whitespace-nowrap shadow-2xs hover:shadow-xs"
                                  title="Efetivar retorno do pedido de reforma"
                                >
                                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                  <span>Efetivar retorno do pedido de reforma</span>
                                </button>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-md">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                  <span>Concluído</span>
                                </span>
                              )}
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

        </div>
      )}

      {/* Modal de Visualização da Ordem de Envio de Reforma */}
      {selectedOrderForView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/60 backdrop-blur-xs animate-in fade-in print:hidden">
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95">
            
            {/* Header do Modal */}
            <div className="flex items-center justify-between p-4 border-b border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-800/50">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center font-bold shrink-0">
                  <FileText className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-black text-stone-900 dark:text-stone-100 uppercase tracking-wide">
                      ORDEM DE ENVIO DE PNEUS PARA REFORMA
                    </h3>
                    <span className="font-mono text-xs font-black text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/80 px-2 py-0.5 rounded-md">
                      {selectedOrderForView.orderNumber}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500">
                    Emissão: {formatDateBR(selectedOrderForView.createdAt)} • Status: <strong className="text-amber-600">{selectedOrderForView.status}</strong>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedOrderForView(null)}
                className="p-1.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Alerta de Pop-up Bloqueado dentro do Modal */}
            {popupBlockedWarning && (
              <div className="mx-4 mt-3 p-3 bg-amber-500/10 dark:bg-amber-500/20 border-2 border-amber-500 rounded-xl flex items-center justify-between space-x-2 text-amber-950 dark:text-amber-200 text-xs font-black tracking-wide animate-in fade-in uppercase">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>ATENÇÃO: ATIVE AS JANELAS POP-UP PARA ESTE SITE PARA IMPRIMIR</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPopupBlockedWarning(false)}
                  className="p-1 hover:bg-amber-500/20 rounded-lg text-amber-800 dark:text-amber-200"
                  title="FECHAR AVISO"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Informações da Ordem */}
            <div className="p-4 space-y-3 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50">
                  <span className="text-[10px] font-bold text-stone-500 uppercase block mb-0.5">Destinatário / Recapadora</span>
                  <p className="font-black text-stone-900 dark:text-stone-100">{selectedOrderForView.supplierName}</p>
                  {selectedOrderForView.supplierCnpj && (
                    <p className="text-[11px] text-stone-500">CNPJ: {selectedOrderForView.supplierCnpj}</p>
                  )}
                  {selectedOrderForView.supplierPhone && (
                    <p className="text-[11px] text-stone-500">Tel: {selectedOrderForView.supplierPhone}</p>
                  )}
                </div>

                <div className="p-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50">
                  <span className="text-[10px] font-bold text-stone-500 uppercase block mb-0.5">Transporte & Retorno</span>
                  <p className="font-bold text-stone-900 dark:text-stone-100">
                    Motorista: {selectedOrderForView.driverName || 'Motorista da Frota'}
                  </p>
                  <p className="text-[11px] text-stone-500">
                    Previsão de Retorno: {formatDateBR(selectedOrderForView.expectedReturnDate)}
                  </p>
                </div>
              </div>

              {/* Tabela de Itens Enviados */}
              <div className="border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-[10px] font-black uppercase border-b border-stone-200 dark:border-stone-800">
                    <tr>
                      <th className="py-2 px-2.5 w-10 text-center">#</th>
                      <th className="py-2 px-2.5 w-24">Nº de Fogo</th>
                      <th className="py-2 px-2.5">Marca / Modelo</th>
                      <th className="py-2 px-2.5 w-24">Medida</th>
                      <th className="py-2 px-2.5 w-24">Veículo Origem</th>
                      <th className="py-2 px-2.5">Problema / Observação</th>
                      <th className="py-2 px-2.5 w-44">Serviço a Fazer</th>
                      <th className="py-2 px-2.5 w-28 text-right">Valor Unitário</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                    {selectedOrderForView.tires.map((t, idx) => (
                      <tr key={t.id || idx} className="hover:bg-stone-50 dark:hover:bg-stone-800/40">
                        <td className="py-2 px-2.5 text-center font-bold text-stone-400">{idx + 1}</td>
                        <td className="py-2 px-2.5 font-mono font-black text-stone-900 dark:text-stone-100">{t.fireNumber}</td>
                        <td className="py-2 px-2.5 font-semibold text-stone-800 dark:text-stone-200">{t.brand} {t.model || ''}</td>
                        <td className="py-2 px-2.5 font-mono text-amber-700 dark:text-amber-400 font-bold">{t.size || '295/80 R 22.5'}</td>
                        <td className="py-2 px-2.5 text-stone-600 dark:text-stone-400">{t.vehiclePlate || t.vehicleName || 'Frota'}</td>
                        <td className="py-2 px-2.5 text-stone-700 dark:text-stone-300 font-medium">
                          <input
                            type="text"
                            value={t.motivo_reforma || t.notes || ''}
                            onChange={(e) => handleUpdateViewedOrderTireMotivo(t.id, e.target.value)}
                            placeholder="Problema / Motivo..."
                            className="w-full px-2 py-1 text-xs border border-stone-200 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-1 focus:ring-emerald-500 uppercase"
                          />
                        </td>
                        <td className="py-2 px-2.5 font-bold text-stone-900 dark:text-stone-100 text-[11px] uppercase">
                          <select
                            value={normalizeStockServiceName(t.servico || borrachariaServicesList[0]?.name || DEFAULT_STOCK_SERVICES[0])}
                            onChange={(e) => handleUpdateViewedOrderTireService(t.id, e.target.value)}
                            className="w-full px-2 py-1 text-xs font-bold border border-stone-200 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-1 focus:ring-emerald-500 uppercase cursor-pointer truncate"
                          >
                            {borrachariaServicesList.map((srv) => (
                              <option key={srv.id} value={srv.name}>{srv.name}</option>
                            ))}
                            {t.servico && !borrachariaServicesList.some(s => s.name === normalizeStockServiceName(t.servico)) && (
                              <option value={normalizeStockServiceName(t.servico)}>
                                {normalizeStockServiceName(t.servico)}
                              </option>
                            )}
                          </select>
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono font-black text-stone-900 dark:text-stone-100">
                          <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-1.5 flex items-center pointer-events-none text-stone-400 font-bold text-xs">
                              R$
                            </span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={t.valorUnitario !== undefined && t.valorUnitario !== null && t.valorUnitario > 0 ? formatCurrencyPtBr(t.valorUnitario) : ''}
                              onChange={(e) => handleUpdateViewedOrderTireValor(t.id, e.target.value)}
                              placeholder="0,00"
                              className="w-full pl-6 pr-1.5 py-1 text-xs font-mono font-bold text-right border border-stone-200 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-amber-50/70 dark:bg-amber-950/40 border-t-2 border-stone-200 dark:border-stone-800 font-black text-xs">
                    <tr>
                      <td colSpan={5} className="py-2 px-2.5 uppercase text-stone-700 dark:text-stone-300">
                        QUANTIDADE TOTAL: <strong className="text-amber-800 dark:text-amber-300">{selectedOrderForView.totalTires} PNEU(S)</strong>
                      </td>
                      <td colSpan={2} className="py-2 px-2.5 text-right uppercase text-amber-900 dark:text-amber-200 font-black">
                        TOTAL EM R$:
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono font-black text-sm text-stone-950 dark:text-white">
                        R$ {formatCurrencyPtBr(selectedOrderForView.totalValor !== undefined ? selectedOrderForView.totalValor : selectedOrderForView.tires.reduce((acc, t) => acc + (t.valorUnitario || 0), 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {selectedOrderForView.notes && (
                <div className="p-2.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/40 text-xs">
                  <span className="font-bold text-stone-500 uppercase text-[10px] block mb-0.5">Observações da Ordem:</span>
                  <p className="text-stone-800 dark:text-stone-200">{selectedOrderForView.notes}</p>
                </div>
              )}
            </div>

            {/* Footer do Modal */}
            <div className="p-3 border-t border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-800/50 flex flex-row items-center justify-between gap-2 overflow-y-hidden shrink-0">
              <div className="flex items-center space-x-2">
                <span className="text-xs text-stone-500">
                  Total Acumulado: <strong className="font-mono text-stone-900 dark:text-stone-100">R$ {formatCurrencyPtBr(selectedOrderForView.totalValor !== undefined ? selectedOrderForView.totalValor : selectedOrderForView.tires.reduce((acc, t) => acc + (t.valorUnitario || 0), 0))}</strong>
                </span>
                {orderSavedToast && (
                  <span className="inline-flex items-center space-x-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800 animate-in fade-in">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Ordem salva com sucesso!</span>
                  </span>
                )}
              </div>

              <div className="flex flex-row items-center justify-end gap-2 shrink-0">
                {/* Botão Sair (Requisito 2) */}
                <button
                  type="button"
                  id="btn-sair-ordem-reforma"
                  onClick={() => setSelectedOrderForView(null)}
                  className="border border-gray-300 dark:border-stone-700 text-gray-700 dark:text-stone-300 bg-white dark:bg-stone-800 hover:bg-gray-50 dark:hover:bg-stone-700 px-4 py-1.5 rounded-lg text-sm font-medium transition cursor-pointer"
                >
                  Sair
                </button>

                {/* Botão Salvar Ordem (Requisito 1) */}
                <button
                  type="button"
                  id="btn-salvar-ordem-reforma"
                  onClick={handleSaveViewedOrder}
                  className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium px-4 py-1.5 rounded-lg text-sm shadow-xs transition cursor-pointer inline-flex items-center space-x-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>Salvar Ordem</span>
                </button>

                {/* Botão Efetivar Retorno no Modal */}
                {selectedOrderForView.status !== 'Concluído' && (
                  <button
                    type="button"
                    id="btn-efetivar-retorno-modal"
                    onClick={() => {
                      const toReturn = selectedOrderForView;
                      setSelectedOrderForView(null);
                      handleEfetivarRetorno(toReturn);
                    }}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-sm font-bold shadow-xs transition cursor-pointer"
                    title="Efetivar retorno do pedido de reforma"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Efetivar Retorno</span>
                  </button>
                )}

                {/* Botão Editar Pedido */}
                {selectedOrderForView.status === 'Concluído' ? (
                  <button
                    type="button"
                    disabled
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-800 text-stone-400 dark:text-stone-600 text-sm font-bold cursor-not-allowed opacity-50"
                    title="Pedido Concluído - Bloqueado contra edições"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Editar Pedido</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    id="btn-editar-pedido-reforma"
                    onClick={() => {
                      const toEdit = selectedOrderForView;
                      setSelectedOrderForView(null);
                      handleStartEditOrder(toEdit);
                    }}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-sm font-bold transition cursor-pointer"
                    title="Editar dados e valores deste pedido"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Editar Pedido</span>
                  </button>
                )}

                {/* Botão Imprimir Pedido */}
                <button
                  type="button"
                  id="btn-imprimir-pedido-reforma-modal"
                  onClick={() => handlePrintOrder(selectedOrderForView)}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-stone-950 text-sm font-bold shadow-xs transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir Pedido (A4)</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      </div>

      {/* =========================================================================
          ESTILOS DEDICADOS PARA IMPRESSÃO EM FOLHA A4 RETRATO (@media print)
          ========================================================================= */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 15mm 10mm 15mm 10mm;
          }

          html, body {
            background: #ffffff !important;
            background-color: #ffffff !important;
            color: #111827 !important;
            width: 100% !important;
            height: auto !important;
            min-height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          aside,
          nav,
          header,
          footer,
          .sidebar,
          .navbar,
          .topbar,
          .ai-studio-sidebar,
          .no-print,
          button,
          #btn-sair-ordem-reforma,
          #btn-salvar-ordem-reforma,
          #btn-efetivar-retorno-modal,
          #btn-editar-pedido-reforma,
          #btn-imprimir-pedido-reforma-modal {
            display: none !important;
          }

          .fixed.inset-0 {
            display: none !important;
            position: static !important;
            background: transparent !important;
            backdrop-filter: none !important;
          }

          #printable-tire-reform-order,
          #area-impressao-ordem {
            display: block !important;
            visibility: visible !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #111827 !important;
          }

          #printable-tire-reform-order *,
          #area-impressao-ordem * {
            visibility: visible !important;
          }
        }
      `}</style>

      {/* =========================================================================
          FOLHA A4 PROFISSIONAL DE IMPRESSÃO - ORDEM DE ENVIO DE PNEUS PARA REFORMA
          Identificador padronizado: area-impressao-ordem (Strings 100% em UPPERCASE)
          ========================================================================= */}
      {activeOrderForPrint && (
        <div id="area-impressao-ordem" className="hidden print:block w-full bg-white text-stone-900 font-sans p-0 m-0 uppercase">
          
          {/* CABEÇALHO CORPORATIVO */}
          <div className="border-b-2 border-stone-800 pb-3 mb-4">
            <div className="flex items-start justify-between gap-4">
              {/* Logotipo & Dados da Empresa Emitente */}
              <div className="flex items-center space-x-3.5">
                {company.logoUrl ? (
                  <div className="w-16 h-16 max-w-[70px] max-h-[70px] border border-stone-300 rounded-lg p-1 flex items-center justify-center shrink-0 bg-white">
                    <img
                      src={company.logoUrl}
                      alt={(company.tradeName || 'LOGO').toUpperCase()}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-stone-100 border border-stone-300 flex items-center justify-center text-stone-700 shrink-0">
                    <Building2 className="w-7 h-7 stroke-[2]" />
                  </div>
                )}
                <div>
                  <h1 className="text-lg font-black text-stone-950 uppercase tracking-tight">
                    {(company.tradeName || 'COLAÇA SILAGEM LTDA').toUpperCase()}
                  </h1>
                  {company.corporateName && company.corporateName !== company.tradeName && (
                    <p className="text-[11px] font-semibold text-stone-700 uppercase">
                      {company.corporateName.toUpperCase()}
                    </p>
                  )}
                  <div className="text-[10px] text-stone-500 font-medium space-x-1.5 mt-0.5 uppercase">
                    {company.cnpj && <span>CNPJ: <strong className="font-mono text-stone-700">{company.cnpj}</strong></span>}
                    {company.phone && <span>• TEL: {company.phone}</span>}
                    {(company.city || company.state) && (
                      <span>• {[company.city, company.state].filter(Boolean).join(' / ').toUpperCase()}</span>
                    )}
                  </div>
                  {company.address && (
                    <div className="text-[10px] text-stone-400 mt-0.5 uppercase">
                      {company.address.toUpperCase()}{company.number ? `, Nº ${company.number}` : ''}
                    </div>
                  )}
                </div>
              </div>

              {/* Título da Ordem & Número do Pedido */}
              <div className="text-right border-l-2 border-stone-300 pl-4 shrink-0">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 block">
                  ORDEM DE ENVIO DE PNEUS PARA REFORMA
                </span>
                <div className="text-xl font-mono font-black text-stone-950 tracking-tight mt-0.5">
                  {activeOrderForPrint.orderNumber.toUpperCase()}
                </div>
                <div className="text-[11px] text-stone-600 mt-1 uppercase">
                  <span>DATA DE EMISSÃO: <strong className="text-stone-950">{formatDateBR(activeOrderForPrint.createdAt)}</strong></span>
                </div>
                {activeOrderForPrint.expectedReturnDate && (
                  <div className="text-[11px] text-stone-600 uppercase">
                    <span>PREVISÃO DE RETORNO: <strong className="text-amber-800">{formatDateBR(activeOrderForPrint.expectedReturnDate)}</strong></span>
                  </div>
                )}
                <div className="text-[10px] text-stone-500 mt-0.5 uppercase">
                  STATUS: <strong className="uppercase font-bold text-stone-800">{activeOrderForPrint.status.toUpperCase()}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* DADOS DO DESTINATÁRIO (RECAPADORA) & TRANSPORTE */}
          <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
            {/* Destinatário / Recapadora */}
            <div className="border border-stone-300 rounded-lg p-2.5 bg-stone-50/70">
              <span className="text-[10px] font-black uppercase tracking-wider text-stone-500 block mb-1">
                DESTINATÁRIO / RECAPADORA
              </span>
              <div className="text-sm font-black text-stone-950 uppercase">
                {activeOrderForPrint.supplierName.toUpperCase()}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-1 text-[11px] text-stone-700">
                <div>
                  <span className="text-stone-500 text-[10px] block uppercase">CNPJ / CPF:</span>
                  <strong className="font-mono">{activeOrderForPrint.supplierCnpj || '-'}</strong>
                </div>
                <div>
                  <span className="text-stone-500 text-[10px] block uppercase">TELEFONE / CONTATO:</span>
                  <strong>{activeOrderForPrint.supplierPhone || '-'}</strong>
                </div>
              </div>
            </div>

            {/* Transporte & Logística */}
            <div className="border border-stone-300 rounded-lg p-2.5 bg-stone-50/70">
              <span className="text-[10px] font-black uppercase tracking-wider text-stone-500 block mb-1">
                TRANSPORTE & LOGÍSTICA
              </span>
              <div className="text-xs text-stone-800">
                <span className="text-stone-500 text-[10px] block uppercase">MOTORISTA RESPONSÁVEL:</span>
                <strong className="text-stone-950 uppercase font-black">
                  {(activeOrderForPrint.driverName || 'MOTORISTA DA FROTA').toUpperCase()}
                </strong>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-1 text-[11px] text-stone-700">
                <div>
                  <span className="text-stone-500 text-[10px] block uppercase">PREVISÃO DE RETORNO:</span>
                  <strong>{formatDateBR(activeOrderForPrint.expectedReturnDate) || 'A COMBINAR'}</strong>
                </div>
                <div>
                  <span className="text-stone-500 text-[10px] block uppercase">FINALIDADE:</span>
                  <strong className="uppercase">RECAPAGEM / REFORMA</strong>
                </div>
              </div>
            </div>
          </div>

          {/* TABELA DE PNEUS ENVIADOS */}
          <div className="border border-stone-400 rounded-lg overflow-hidden mb-4">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-stone-200 text-stone-900 font-black uppercase text-[10px] border-b-2 border-stone-400">
                <tr>
                  <th className="py-1.5 px-2 text-center w-8 border-r border-stone-300">#</th>
                  <th className="py-1.5 px-2 w-24 border-r border-stone-300">Nº DE FOGO</th>
                  <th className="py-1.5 px-2 border-r border-stone-300">MARCA / MODELO</th>
                  <th className="py-1.5 px-2 w-24 border-r border-stone-300">MEDIDA</th>
                  <th className="py-1.5 px-2 w-24 border-r border-stone-300">VEÍCULO ORIGEM</th>
                  <th className="py-1.5 px-2 border-r border-stone-300">MOTIVO / PROBLEMA</th>
                  <th className="py-1.5 px-2 w-36 border-r border-stone-300">SERVIÇO SOLICITADO</th>
                  <th className="py-1.5 px-2 w-28 text-right">VALOR UNITÁRIO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-300 text-[11px]">
                {activeOrderForPrint.tires.map((t, idx) => (
                  <tr key={t.id || idx}>
                    <td className="py-1.5 px-2 text-center font-bold text-stone-500 border-r border-stone-300">{idx + 1}</td>
                    <td className="py-1.5 px-2 font-mono font-black text-stone-950 border-r border-stone-300">{t.fireNumber.toUpperCase()}</td>
                    <td className="py-1.5 px-2 font-bold text-stone-900 border-r border-stone-300 uppercase">{t.brand.toUpperCase()} {(t.model || '').toUpperCase()}</td>
                    <td className="py-1.5 px-2 font-mono text-stone-700 border-r border-stone-300 uppercase">{t.size ? t.size.toUpperCase() : '295/80 R 22.5'}</td>
                    <td className="py-1.5 px-2 text-stone-800 border-r border-stone-300 uppercase">{(t.vehiclePlate || t.vehicleName || 'ESTOQUE').toUpperCase()}</td>
                    <td className="py-1.5 px-2 text-stone-700 border-r border-stone-300 uppercase text-[10px]">{(t.motivo_reforma || t.notes || 'DESGASTE / RECAPAGEM').toUpperCase()}</td>
                    <td className="py-1.5 px-2 font-bold text-stone-950 border-r border-stone-300 uppercase text-[10px]">{(t.servico || 'RECAPAGEM / REFORMA').toUpperCase()}</td>
                    <td className="py-1.5 px-2 text-right font-mono font-bold text-stone-950">R$ {formatCurrencyPtBr(t.valorUnitario || 0)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-stone-100 border-t-2 border-stone-400 font-black text-xs">
                <tr>
                  <td colSpan={5} className="py-2 px-2.5 uppercase text-stone-800 border-r border-stone-300">
                    QUANTIDADE TOTAL: <strong className="text-stone-950">{activeOrderForPrint.totalTires} PNEU(S)</strong>
                  </td>
                  <td colSpan={2} className="py-2 px-2.5 text-right uppercase text-stone-800 border-r border-stone-300 font-bold">
                    VALOR TOTAL DO PEDIDO:
                  </td>
                  <td className="py-2 px-2.5 text-right font-mono font-black text-sm text-stone-950">
                    R$ {formatCurrencyPtBr(activeOrderForPrint.totalValor !== undefined ? activeOrderForPrint.totalValor : activeOrderForPrint.tires.reduce((acc, t) => acc + (t.valorUnitario || 0), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* OBSERVAÇÕES DA ORDEM */}
          {activeOrderForPrint.notes && (
            <div className="mb-4 p-2.5 border border-stone-300 rounded-lg bg-stone-50/60 text-xs">
              <span className="text-[10px] font-black uppercase text-stone-500 block mb-0.5">
                OBSERVAÇÕES / INSTRUÇÕES ESPECIAIS:
              </span>
              <p className="text-stone-800 uppercase font-medium">{activeOrderForPrint.notes.toUpperCase()}</p>
            </div>
          )}

          {/* BLOCO DE ASSINATURAS */}
          <div className="mt-8 pt-4 border-t border-stone-300 break-inside-avoid">
            <div className="grid grid-cols-2 gap-8 text-center text-xs">
              <div>
                <div className="border-t-2 border-stone-800 pt-2 mx-6">
                  <div className="font-black text-stone-950 uppercase">RESPONSÁVEL PELO ENVIO / FROTA</div>
                  <div className="text-[11px] text-stone-600 mt-1 uppercase">ASSINATURA E DATA: ____/____/________</div>
                </div>
              </div>
              <div>
                <div className="border-t-2 border-stone-800 pt-2 mx-6">
                  <div className="font-black text-stone-950 uppercase">RECEBIDO POR (RECAPADORA)</div>
                  <div className="text-[11px] text-stone-600 mt-1 uppercase">NOME LEGÍVEL / ASSINATURA / DATA: ____/____/________</div>
                </div>
              </div>
            </div>

            {/* Rodapé institucional */}
            <div className="mt-6 pt-2 border-t border-stone-200 flex items-center justify-between text-[9px] text-stone-400 uppercase">
              <span>DOCUMENTO GERADO AUTOMATICAMENTE PELO SISTEMA AGROCONTROL • COLAÇA SILAGEM</span>
              <span>EMISSÃO: {new Date().toLocaleDateString('pt-BR')} ÀS {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} • FOLHA 1 DE 1</span>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};
