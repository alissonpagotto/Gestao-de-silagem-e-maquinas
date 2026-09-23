import React, { useState } from 'react';
import { 
  Gauge, 
  Car, 
  UserCheck, 
  Users, 
  Fuel, 
  Wrench, 
  Layers,
  TrendingUp,
  RotateCcw
} from 'lucide-react';
import { Machinery, Employee, FleetTeam, FuelLog, MaintenanceLog, Expense, CompanyProfile, ServiceOrder, SilageOrder, VehicleTypeDefinition, TireRotationLog, InventoryItem, Supplier, MaintenancePurchaseRequest } from '../../types';
import { FleetDashboard } from './FleetDashboard';
import { FleetVehiclesView } from './FleetVehiclesView';
import { FleetDriversView } from './FleetDriversView';
import { FleetTeamView } from './FleetTeamView';
import { FleetFuelView } from './FleetFuelView';
import { FleetMaintenanceView } from './FleetMaintenanceView';
import { FleetTireRotationView } from './FleetTireRotationView';
import { VehicleModal } from './VehicleModal';
import { FuelModal } from './FuelModal';
import { MaintenanceModal } from './MaintenanceModal';
import { VehicleHistoryModal } from './VehicleHistoryModal';
import { updateVehicleWithCalculatedMetrics } from '../../lib/fleetMetrics';
import { upsertGestaoFrota } from '../../lib/supabaseService';
import { useConfirm } from '../../context/ConfirmContext';
import { 
  getStoredVehicleTypes, 
  saveStoredVehicleTypes, 
  getStoredTireRotationLogs, 
  saveStoredTireRotationLogs,
  getStoredPurchaseRequests,
  saveStoredPurchaseRequests,
  getStoredInventory,
  saveStoredInventory
} from '../../lib/storage';

export type FleetSubTab = 'painel' | 'veiculos' | 'motoristas' | 'equipe' | 'combustivel' | 'manutencoes' | 'rodizio';


interface FleetModuleProps {
  machineries: Machinery[];
  employees: Employee[];
  teams?: FleetTeam[];
  fuelLogs: FuelLog[];
  maintenanceLogs: MaintenanceLog[];
  expenses: Expense[];
  inventory?: InventoryItem[];
  suppliers?: Supplier[];
  services?: ServiceOrder[];
  orders?: SilageOrder[];
  companyProfile?: CompanyProfile;
  initialSubTab?: FleetSubTab;
  onSaveMachineries: (machineries: Machinery[]) => void;
  onSaveEmployees: (employees: Employee[]) => void;
  onSaveTeams?: (teams: FleetTeam[]) => void;
  onSaveFuelLogs: (logs: FuelLog[]) => void;
  onSaveMaintenanceLogs: (logs: MaintenanceLog[]) => void;
  onSaveInventory?: (inventory: InventoryItem[]) => void;
  onSaveServices?: (services: ServiceOrder[]) => void;
  onSaveOrders?: (orders: SilageOrder[]) => void;
  onAddExpense?: (expense: any) => void;
}

export const FleetModule: React.FC<FleetModuleProps> = ({
  machineries,
  employees,
  teams = [],
  fuelLogs,
  maintenanceLogs,
  expenses,
  inventory = [],
  suppliers = [],
  services = [],
  orders = [],
  companyProfile,
  initialSubTab,
  onSaveMachineries,
  onSaveEmployees,
  onSaveTeams,
  onSaveFuelLogs,
  onSaveMaintenanceLogs,
  onSaveInventory,
  onSaveServices,
  onSaveOrders,
  onAddExpense,
}) => {
  const { confirm } = useConfirm();
  const [activeSubTab, setActiveSubTab] = useState<FleetSubTab>(initialSubTab || 'painel');

  // Vehicle Types configuration & Tire Rotation Logs state
  const [vehicleTypes, setVehicleTypes] = useState<VehicleTypeDefinition[]>(() => getStoredVehicleTypes());
  const [tireRotationLogs, setTireRotationLogs] = useState<TireRotationLog[]>(() => getStoredTireRotationLogs());
  
  // Maintenance Purchase Requests state
  const [purchaseRequests, setPurchaseRequests] = useState<MaintenancePurchaseRequest[]>(() => getStoredPurchaseRequests());

  const handleSavePurchaseRequests = (updated: MaintenancePurchaseRequest[]) => {
    setPurchaseRequests(updated);
    saveStoredPurchaseRequests(updated);
  };

  const handleSaveVehicleTypes = (updated: VehicleTypeDefinition[]) => {
    setVehicleTypes(updated);
    saveStoredVehicleTypes(updated);
  };

  const handleSaveTireRotationLogs = (updated: TireRotationLog[]) => {
    setTireRotationLogs(updated);
    saveStoredTireRotationLogs(updated);
  };

  // Modals state
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Machinery | null>(null);

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyVehicle, setHistoryVehicle] = useState<Machinery | null>(null);

  const [isFuelModalOpen, setIsFuelModalOpen] = useState(false);
  const [editingFuelLog, setEditingFuelLog] = useState<FuelLog | null>(null);
  const [selectedFuelVehicleId, setSelectedFuelVehicleId] = useState<string | null>(null);

  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false);
  const [editingMaintenanceLog, setEditingMaintenanceLog] = useState<MaintenanceLog | null>(null);

  // --- VEHICLES HANDLERS ---
  const handleOpenNewVehicle = () => {
    setEditingVehicle(null);
    setIsVehicleModalOpen(true);
  };

  const handleEditVehicle = (v: Machinery) => {
    setEditingVehicle(v);
    setIsVehicleModalOpen(true);
  };

  const handleOpenHistory = (v: Machinery) => {
    setHistoryVehicle(v);
    setIsHistoryModalOpen(true);
  };

  const handleDeleteVehicle = async (id: string) => {
    const v = machineries.find(m => m.id === id);
    const label = v?.licensePlateOrSerial ? `${v.name} (${v.licensePlateOrSerial})` : v?.name || 'este veículo';
    const isConfirmed = await confirm({
      title: 'Excluir Veículo da Frota',
      message: `Deseja realmente remover ${label} do sistema de frotas?`,
      confirmLabel: 'Sim, Excluir',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });
    if (isConfirmed) {
      onSaveMachineries(machineries.filter(m => m.id !== id));
    }
  };


  const handleAddService = (newService: Partial<ServiceOrder>) => {
    const created: ServiceOrder = {
      id: `srv_${Date.now()}`,
      orderNumber: newService.orderNumber || `OS-${Math.floor(1000 + Math.random() * 9000)}`,
      clientName: newService.clientName || 'Cliente Agrícola',
      farmName: newService.farmName,
      serviceType: newService.serviceType || 'Ensilagem',
      areaHectares: newService.areaHectares,
      tonsEstimated: newService.tonsEstimated,
      ratePerUnit: newService.ratePerUnit || 0,
      totalAmount: newService.totalAmount || 0,
      startDate: newService.startDate || new Date().toISOString().split('T')[0],
      status: (newService.status as any) || 'concluido',
      machineryId: newService.machineryId,
      machineryAssigned: newService.machineryAssigned,
      operatorAssigned: newService.operatorAssigned,
      fuelCostAllocated: newService.fuelCostAllocated,
      driverCostAllocated: newService.driverCostAllocated,
      notes: newService.notes,
    };
    if (onSaveServices) {
      onSaveServices([...services, created]);
    }
  };

  const handleSaveVehicle = (vehicleData: Partial<Machinery>) => {
    if (editingVehicle) {
      let updatedMergedVehicle: Machinery | null = null;
      const updated = machineries.map(m => {
        if (m.id === editingVehicle.id) {
          const merged = { ...m, ...vehicleData } as Machinery;
          const calculated = updateVehicleWithCalculatedMetrics(merged, fuelLogs);
          updatedMergedVehicle = calculated;
          return calculated;
        }
        return m;
      });
      onSaveMachineries(updated);
      if (updatedMergedVehicle) {
        upsertGestaoFrota(updatedMergedVehicle).catch(console.error);
      }
    } else {
      const newVehicle: Machinery = {
        ...vehicleData,
        id: `mach_${Date.now()}`,
        name: vehicleData.name || vehicleData.model || 'Novo Veículo',
        model: vehicleData.model || 'Modelo',
        brand: vehicleData.brand || 'Agrícola',
        categoryType: vehicleData.categoryType || 'forrageira',
        status: vehicleData.status || 'disponivel',
        ownership: vehicleData.ownership || 'proprio',
        licensePlateOrSerial: vehicleData.licensePlateOrSerial || '',
        fleetNumber: vehicleData.fleetNumber || '',
        renavam: vehicleData.renavam,
        color: vehicleData.color,
        capacityM3: vehicleData.capacityM3,
        year: vehicleData.year,
        operatorOrDriver: vehicleData.operatorOrDriver || '',
        assignedDriverIds: vehicleData.assignedDriverIds || [],
        assignedDrivers: vehicleData.assignedDrivers || [],
        hourMeter: vehicleData.hourMeter || 0,
        currentKm: vehicleData.currentKm,
        averageConsumptionLitersPerHour: vehicleData.averageConsumptionLitersPerHour,
        averageConsumptionKmPerLiter: vehicleData.averageConsumptionKmPerLiter,
        fuelCapacityLiters: vehicleData.fuelCapacityLiters || 0,
        currentFuelPercentage: vehicleData.currentFuelPercentage || 100,
        purchaseDate: vehicleData.purchaseDate || new Date().toISOString().split('T')[0],
        totalFuelExpenses: 0,
        totalMaintenanceExpenses: 0,
        notes: vehicleData.notes || '',
      };
      onSaveMachineries([newVehicle, ...machineries]);
      upsertGestaoFrota(newVehicle).catch(console.error);
    }
    setIsVehicleModalOpen(false);
  };

  // --- FUEL HANDLERS ---
  const handleOpenNewFuel = (vehicleId?: unknown) => {
    setEditingFuelLog(null);
    const cleanId = typeof vehicleId === 'string' ? vehicleId : null;
    setSelectedFuelVehicleId(cleanId);
    setIsFuelModalOpen(true);
  };

  const handleEditFuel = (log: FuelLog) => {
    setEditingFuelLog(log);
    setIsFuelModalOpen(true);
  };

  const handleDeleteFuel = async (id: string) => {
    const isConfirmed = await confirm({
      title: 'Excluir Abastecimento',
      message: 'Deseja realmente excluir este registro de abastecimento de combustível?',
      confirmLabel: 'Sim, Excluir',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });
    if (!isConfirmed) return;

    const remainingLogs = fuelLogs.filter(f => f.id !== id);
    onSaveFuelLogs(remainingLogs);
    // Recalculate machinery metrics with remaining logs
    const updatedMachineries = machineries.map(m => updateVehicleWithCalculatedMetrics(m, remainingLogs));
    onSaveMachineries(updatedMachineries);
  };


  const handleSaveFuel = (fuelLog: FuelLog, createExpense: boolean) => {
    const updatedFuelLogs = editingFuelLog
      ? fuelLogs.map(f => (f.id === editingFuelLog.id ? fuelLog : f))
      : [fuelLog, ...fuelLogs];
    
    onSaveFuelLogs(updatedFuelLogs);

    // Update vehicle's hourMeter, currentKm, fuel expenses, and calculated averages
    const targetVehicle = machineries.find(m => m.id === fuelLog.machineryId);
    if (targetVehicle) {
      const updatedMachineries = machineries.map(m => {
        if (m.id === targetVehicle.id) {
          const updatedWithLogs = updateVehicleWithCalculatedMetrics(m, updatedFuelLogs);
          const tankCap = Number((m as any).tank_capacity ?? (m as any).tankCapacity ?? m.fuelCapacityLiters ?? 0);
          let newFuelLevel = m.currentFuelPercentage;
          if (tankCap > 0 && fuelLog.liters > 0) {
            const prevPercent = (m.currentFuelPercentage !== undefined && m.currentFuelPercentage !== null)
              ? Math.max(0, Math.min(100, Number(m.currentFuelPercentage)))
              : 50;
            const prevLiters = (prevPercent / 100) * tankCap;
            const nextLiters = Math.min(tankCap, prevLiters + fuelLog.liters);
            newFuelLevel = Math.round((nextLiters / tankCap) * 100);
          }
          return {
            ...updatedWithLogs,
            currentFuelPercentage: newFuelLevel,
            totalFuelExpenses: (m.totalFuelExpenses || 0) + (editingFuelLog ? 0 : fuelLog.totalAmount),
          };
        }
        return m;
      });
      onSaveMachineries(updatedMachineries);
    }

    // Automatically create expense in finance if requested
    if (createExpense && onAddExpense && !editingFuelLog) {
      onAddExpense({
        date: fuelLog.date,
        category: 'Combustível',
        description: `Abastecimento ${fuelLog.fuelType} - ${fuelLog.machineryPlateOrName} (${fuelLog.liters}L)`,
        amount: fuelLog.totalAmount,
        paymentMethod: 'pix',
        supplier: fuelLog.supplierStation || 'Posto de Combustível',
        status: 'pago',
        notes: `Lançamento automático de frotas. Motorista: ${fuelLog.driverOrOperator || 'N/A'}`,
      });
    }
  };

  // --- MAINTENANCE HANDLERS ---
  const handleOpenNewMaintenance = (vehicleId?: string) => {
    setEditingMaintenanceLog(null);
    setIsMaintenanceModalOpen(true);
  };

  const handleEditMaintenance = (log: MaintenanceLog) => {
    setEditingMaintenanceLog(log);
    setIsMaintenanceModalOpen(true);
  };

  const handleDeleteMaintenance = async (id: string) => {
    const isConfirmed = await confirm({
      title: 'Excluir Ordem de Manutenção',
      message: 'Deseja realmente excluir esta ordem de serviço/manutenção?',
      confirmLabel: 'Sim, Excluir',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });
    if (isConfirmed) {
      onSaveMaintenanceLogs(maintenanceLogs.filter(m => m.id !== id));
    }
  };


  const handleUpdateMaintenanceStatus = (id: string, newStatus: MaintenanceLog['status']) => {
    const updated = maintenanceLogs.map(m => (m.id === id ? { ...m, status: newStatus } : m));
    onSaveMaintenanceLogs(updated);
  };

  const handleSaveMaintenance = (
    log: MaintenanceLog, 
    flags?: { createExpense?: boolean; deductStock?: boolean; createPurchaseRequest?: boolean }
  ) => {
    const shouldCreateExpense = flags?.createExpense ?? false;
    const shouldDeductStock = flags?.deductStock ?? true;
    const shouldCreatePurchase = flags?.createPurchaseRequest ?? false;

    const existingIdx = maintenanceLogs.findIndex(m => m.id === log.id);
    if (existingIdx !== -1) {
      const updated = [...maintenanceLogs];
      updated[existingIdx] = log;
      onSaveMaintenanceLogs(updated);
    } else if (editingMaintenanceLog) {
      const updated = maintenanceLogs.map(m => (m.id === editingMaintenanceLog.id ? log : m));
      onSaveMaintenanceLogs(updated);
    } else {
      onSaveMaintenanceLogs([log, ...maintenanceLogs]);
    }
    setEditingMaintenanceLog(log);

    // Update vehicle status and maintenance expenses
    const targetVehicle = machineries.find(m => m.id === log.machineryId);
    if (targetVehicle) {
      const existingIdx = maintenanceLogs.findIndex(m => m.id === log.id);
      const prevExpense = (existingIdx !== -1 && maintenanceLogs[existingIdx]) ? (maintenanceLogs[existingIdx].totalCost || 0) : 0;
      const expenseDiff = log.totalCost - prevExpense;
      const updatedVehicle: Machinery = {
        ...targetVehicle,
        status: log.status === 'em_andamento' ? 'em_manutencao' : targetVehicle.status,
        totalMaintenanceExpenses: Math.max(0, (targetVehicle.totalMaintenanceExpenses || 0) + expenseDiff),
      };
      onSaveMachineries(machineries.map(m => m.id === targetVehicle.id ? updatedVehicle : m));
    }

    // 1. Sincronização e Baixa Automática no Almoxarifado Interno
    if (shouldDeductStock && onSaveInventory) {
      const latestInventory = getStoredInventory();
      if (latestInventory && latestInventory.length > 0) {
        onSaveInventory(latestInventory);
      } else if (log.partsItems && log.partsItems.length > 0) {
        const internalParts = log.partsItems.filter(p => !p.stockDeducted && (p.origin === 'almoxarifado_interno' || !p.origin));
        if (internalParts.length > 0 && inventory.length > 0) {
          let updatedInventory = [...inventory];
          internalParts.forEach(part => {
            const idx = updatedInventory.findIndex(
              i => (part.inventoryItemId && i.id === part.inventoryItemId) || 
                   (part.description && i.code && i.code.trim().toLowerCase() === part.description.trim().toLowerCase()) ||
                   (part.description && i.name.trim().toLowerCase() === part.description.trim().toLowerCase())
            );
            if (idx !== -1) {
              const currentItem = updatedInventory[idx];
              const newQty = Math.max(0, currentItem.quantity - (Number(part.quantity) || 1));
              updatedInventory[idx] = {
                ...currentItem,
                quantity: newQty,
                updatedAt: new Date().toISOString()
              };
            }
          });
          saveStoredInventory(updatedInventory);
          onSaveInventory(updatedInventory);
        }
      }
    }

    // 2. Automatically create purchase request for external parts
    if (shouldCreatePurchase && log.partsItems && log.partsItems.length > 0) {
      const externalParts = log.partsItems.filter(p => p.origin === 'externo_compra' || p.requiresPurchase);
      if (externalParts.length > 0) {
        const newRequest: MaintenancePurchaseRequest = {
          id: `purch_${Date.now()}`,
          osId: log.id,
          osNumber: log.osNumber,
          vehicleId: log.machineryId,
          vehiclePlateOrName: log.machineryPlateOrName,
          status: 'cotacao',
          urgency: log.status === 'em_andamento' ? 'urgente_veiculo_parado' : 'alta',
          items: externalParts.map(p => ({
            description: p.description,
            quantity: p.quantity,
            unit: p.unit,
            estimatedUnitCost: p.unitCost,
            suggestedSupplier: p.supplierName
          })),
          notes: `Gerado via OS ${log.osNumber || log.id}. Local: ${log.location === 'roca' ? 'Roça / Campo' : log.location === 'estrada' ? 'Estrada / Socorro' : 'Oficina'}`,
          createdAt: new Date().toISOString()
        };
        handleSavePurchaseRequests([newRequest, ...purchaseRequests]);
      }
    }

    // 3. Automatically create expense in finance (Contas a Pagar) if requested
    if (shouldCreateExpense && onAddExpense && log.totalCost > 0) {
      const cond = log.financialConditions;
      const nfe = log.nfeLink;

      if (cond?.installments && cond.installments.length >= 1) {
        const totalLines = cond.installments.length;
        const osIdClean = log.osNumber || log.id;
        const baseExpenseId = `exp_os_${osIdClean.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;

        // Inicia rigorosamente a partir da Linha 1 (Item 1 / Parcela 1) com índice 0
        const installmentExpenses = cond.installments.map((inst, idx) => {
          const parcelNum = inst.number || String(idx + 1).padStart(2, '0');
          const methodKey = (inst.paymentMethodLabel?.toLowerCase().includes('pix') ? 'pix' :
                            inst.paymentMethodLabel?.toLowerCase().includes('cart') ? 'cartao_credito' :
                            inst.paymentMethodLabel?.toLowerCase().includes('dinheiro') ? 'dinheiro' :
                            cond.paymentMethod || 'boleto') as any;

          const desc = totalLines > 1
            ? `OS ${osIdClean} [${log.serviceCategory}] - ${log.machineryPlateOrName} (Parcela ${parcelNum}/${totalLines})`
            : `OS ${osIdClean} [${log.serviceCategory}] - ${log.machineryPlateOrName}`;

          const instId = totalLines > 1 ? `${baseExpenseId}_parc_${idx + 1}` : baseExpenseId;

          return {
            id: instId,
            date: log.date,
            category: 'Manutenção de Máquinas',
            description: desc,
            amount: Number(inst.amount) || 0,
            paymentMethod: methodKey,
            dueDate: inst.dueDate || log.date,
            supplier: nfe?.supplierName || cond.supplierName || log.workshopOrMechanic || 'Oficina Mecânica',
            invoiceNumber: totalLines > 1 ? `${osIdClean} (${parcelNum}/${totalLines})` : osIdClean,
            status: 'pendente' as const,
            notes: `Parcela ${parcelNum}/${totalLines} de OS de frotas. Prazo: ${inst.daysInterval || 0} dias. Executante: ${log.workshopOrMechanic || 'Oficina'}`,
            createdAt: new Date().toISOString(),
          };
        });

        // Grava o conjunto completo de parcelas garantindo a persistência íntegra da primeira à última linha
        onAddExpense(installmentExpenses);
      } else {
        const singleDueDate = cond?.firstDueDate || log.date;

        onAddExpense({
          date: log.date,
          category: 'Manutenção de Máquinas',
          description: `OS ${log.osNumber || log.id} [${log.serviceCategory}] - ${log.machineryPlateOrName}${nfe?.nfeNumber ? ` (NF-e ${nfe.nfeNumber})` : ''}`,
          amount: log.totalCost,
          paymentMethod: cond?.paymentMethod || 'boleto',
          dueDate: singleDueDate,
          supplier: nfe?.supplierName || cond?.supplierName || log.workshopOrMechanic || 'Oficina Mecânica',
          invoiceNumber: nfe?.nfeNumber || log.osNumber,
          status: cond?.paymentTerm === 'a_vista' ? 'pago' : 'pendente',
          notes: `Lançamento automático de OS de frotas. Local: ${log.location}. Condição: ${cond?.paymentTerm || 'À Vista'}. Executante: ${log.workshopOrMechanic}`,
        });
      }
    }
  };

  return (
    <div id="fleet-management-module" className="w-full space-y-5 sm:space-y-6">
      
      {/* 1. Modern Horizontal Sub-Tabs Bar (Floating Card with #87AFE3 in Day Mode) */}
      <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 rounded-xl border border-slate-400 dark:border-stone-800 p-1.5 shadow-xs flex items-center overflow-x-auto gap-1.5 scrollbar-none text-black dark:text-white">
        
        {/* Tab 1: PAINEL */}
        <button
          type="button"
          onClick={() => setActiveSubTab('painel')}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition whitespace-nowrap cursor-pointer ${
            activeSubTab === 'painel'
              ? 'bg-sky-600 text-white shadow-xs shadow-sky-600/30'
              : 'text-black dark:text-stone-300 hover:text-black dark:hover:text-white hover:bg-black/10 dark:hover:bg-slate-700'
          }`}
        >
          <Gauge className="w-4 h-4 shrink-0" strokeWidth={2} />
          <span>Painel Frotas</span>
        </button>

        {/* Tab 2: VEÍCULOS */}
        <button
          type="button"
          onClick={() => setActiveSubTab('veiculos')}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition whitespace-nowrap cursor-pointer ${
            activeSubTab === 'veiculos'
              ? 'bg-sky-600 text-white shadow-xs shadow-sky-600/30'
              : 'text-black dark:text-stone-300 hover:text-black dark:hover:text-white hover:bg-black/10 dark:hover:bg-slate-700'
          }`}
        >
          <Car className="w-4 h-4 shrink-0" strokeWidth={2} />
          <span>Veículos</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold transition ${
            activeSubTab === 'veiculos'
              ? 'bg-white/20 text-white border border-white/30'
              : 'bg-white/80 dark:bg-slate-800 text-black dark:text-white border border-slate-300 dark:border-slate-600'
          }`}>
            {machineries.length}
          </span>
        </button>

        {/* Tab 3: MOTORISTAS */}
        <button
          type="button"
          onClick={() => setActiveSubTab('motoristas')}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition whitespace-nowrap cursor-pointer ${
            activeSubTab === 'motoristas'
              ? 'bg-sky-600 text-white shadow-xs shadow-sky-600/30'
              : 'text-black dark:text-stone-300 hover:text-black dark:hover:text-white hover:bg-black/10 dark:hover:bg-slate-700'
          }`}
        >
          <UserCheck className="w-4 h-4 shrink-0" strokeWidth={2} />
          <span>Motoristas</span>
        </button>

        {/* Tab 4: EQUIPE */}
        <button
          type="button"
          onClick={() => setActiveSubTab('equipe')}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition whitespace-nowrap cursor-pointer ${
            activeSubTab === 'equipe'
              ? 'bg-sky-600 text-white shadow-xs shadow-sky-600/30'
              : 'text-black dark:text-stone-300 hover:text-black dark:hover:text-white hover:bg-black/10 dark:hover:bg-slate-700'
          }`}
        >
          <Users className="w-4 h-4 shrink-0" strokeWidth={2} />
          <span>Equipe</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold transition ${
            activeSubTab === 'equipe'
              ? 'bg-white/20 text-white border border-white/30'
              : 'bg-white/80 dark:bg-slate-800 text-black dark:text-white border border-slate-300 dark:border-slate-600'
          }`}>
            {employees.length}
          </span>
        </button>

        {/* Tab 5: COMBUSTÍVEL */}
        <button
          type="button"
          onClick={() => setActiveSubTab('combustivel')}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition whitespace-nowrap cursor-pointer ${
            activeSubTab === 'combustivel'
              ? 'bg-sky-600 text-white shadow-xs shadow-sky-600/30'
              : 'text-black dark:text-stone-300 hover:text-black dark:hover:text-white hover:bg-black/10 dark:hover:bg-slate-700'
          }`}
        >
          <Fuel className="w-4 h-4 shrink-0" strokeWidth={2} />
          <span>Combustível</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold transition ${
            activeSubTab === 'combustivel'
              ? 'bg-white/20 text-white border border-white/30'
              : 'bg-white/80 dark:bg-slate-800 text-black dark:text-white border border-slate-300 dark:border-slate-600'
          }`}>
            {fuelLogs.length}
          </span>
        </button>

        {/* Tab 6: MANUTENÇÕES */}
        <button
          type="button"
          onClick={() => setActiveSubTab('manutencoes')}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition whitespace-nowrap cursor-pointer ${
            activeSubTab === 'manutencoes'
              ? 'bg-sky-600 text-white shadow-xs shadow-sky-600/30'
              : 'text-black dark:text-stone-300 hover:text-black dark:hover:text-white hover:bg-black/10 dark:hover:bg-slate-700'
          }`}
        >
          <Wrench className="w-4 h-4 shrink-0" strokeWidth={2} />
          <span>Manutenções</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold transition ${
            activeSubTab === 'manutencoes'
              ? 'bg-white/20 text-white border border-white/30'
              : 'bg-white/80 dark:bg-slate-800 text-black dark:text-white border border-slate-300 dark:border-slate-600'
          }`}>
            {maintenanceLogs.length}
          </span>
        </button>

        {/* Tab 7: RODÍZIO DE PNEUS */}
        <button
          type="button"
          id="fleet-subtab-rodizio"
          onClick={() => setActiveSubTab('rodizio')}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition whitespace-nowrap cursor-pointer ${
            activeSubTab === 'rodizio'
              ? 'bg-sky-600 text-white shadow-xs shadow-sky-600/30'
              : 'text-black dark:text-stone-300 hover:text-black dark:hover:text-white hover:bg-black/10 dark:hover:bg-slate-700'
          }`}
        >
          <RotateCcw className="w-4 h-4 shrink-0" strokeWidth={2} />
          <span>Rodízio de Pneus</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold transition ${
            activeSubTab === 'rodizio'
              ? 'bg-white/20 text-white border border-white/30'
              : 'bg-white/80 dark:bg-slate-800 text-black dark:text-white border border-slate-300 dark:border-slate-600'
          }`}>
            {tireRotationLogs.length}
          </span>
        </button>

      </div>

      {/* Subtab Contents */}
      {activeSubTab === 'painel' && (
        <FleetDashboard
          machineries={machineries}
          employees={employees}
          fuelLogs={fuelLogs}
          maintenanceLogs={maintenanceLogs}
          expenses={expenses}
          onNavigateSubtab={(tab) => setActiveSubTab(tab)}
          onOpenNewVehicle={handleOpenNewVehicle}
          onOpenNewFuel={() => handleOpenNewFuel()}
          onOpenNewMaintenance={() => handleOpenNewMaintenance()}
        />
      )}

      {activeSubTab === 'veiculos' && (
        <FleetVehiclesView
          machineries={machineries}
          fuelLogs={fuelLogs}
          maintenanceLogs={maintenanceLogs}
          employees={employees}
          services={services}
          orders={orders}
          companyProfile={companyProfile}
          onSaveMachineries={onSaveMachineries}
          onOpenNewVehicle={handleOpenNewVehicle}
          onEditVehicle={handleEditVehicle}
          onDeleteVehicle={handleDeleteVehicle}
          onNewFuelForVehicle={(vId) => handleOpenNewFuel(vId)}
          onNewMaintenanceForVehicle={(vId) => handleOpenNewMaintenance(vId)}
          onOpenHistory={handleOpenHistory}
        />
      )}

      {activeSubTab === 'motoristas' && (
        <FleetDriversView
          employees={employees}
          machineries={machineries}
          onSaveEmployees={onSaveEmployees}
          onNavigateToVehicle={(vId) => {
            setActiveSubTab('veiculos');
          }}
        />
      )}

      {activeSubTab === 'equipe' && (
        <FleetTeamView
          employees={employees}
          machineries={machineries}
          teams={teams}
          companyProfile={companyProfile}
          onSaveEmployees={onSaveEmployees}
          onSaveTeams={onSaveTeams}
        />
      )}

      {activeSubTab === 'combustivel' && (
        <FleetFuelView
          fuelLogs={fuelLogs}
          machineries={machineries}
          employees={employees}
          onOpenNewFuel={() => handleOpenNewFuel()}
          onEditFuel={handleEditFuel}
          onDeleteFuel={handleDeleteFuel}
        />
      )}

      {activeSubTab === 'manutencoes' && (
        <FleetMaintenanceView
          maintenanceLogs={maintenanceLogs}
          machineries={machineries}
          companyProfile={companyProfile}
          purchaseRequests={purchaseRequests}
          onSavePurchaseRequests={handleSavePurchaseRequests}
          onOpenNewMaintenance={() => handleOpenNewMaintenance()}
          onEditMaintenance={handleEditMaintenance}
          onDeleteMaintenance={handleDeleteMaintenance}
          onUpdateStatus={handleUpdateMaintenanceStatus}
        />
      )}

      {activeSubTab === 'rodizio' && (
        <FleetTireRotationView
          machineries={machineries}
          vehicleTypes={vehicleTypes}
          onSaveVehicleTypes={handleSaveVehicleTypes}
          tireRotationLogs={tireRotationLogs}
          onSaveTireRotationLogs={handleSaveTireRotationLogs}
          onSaveMachineries={onSaveMachineries}
          onAddMaintenanceLog={(newLog) => {
            handleSaveMaintenance(newLog as MaintenanceLog, { createExpense: false });
          }}
          onAddExpense={onAddExpense}
        />
      )}

      {/* Modals */}
      <VehicleModal
        isOpen={isVehicleModalOpen}
        onClose={() => setIsVehicleModalOpen(false)}
        onSave={handleSaveVehicle}
        editingVehicle={editingVehicle}
        employees={employees}
        fuelLogs={fuelLogs}
        maintenanceLogs={maintenanceLogs}
        machineries={machineries}
        expenses={expenses}
        services={services}
        orders={orders}
        onAddExpense={onAddExpense}
      />

      <FuelModal
        isOpen={isFuelModalOpen}
        onClose={() => {
          setIsFuelModalOpen(false);
          setSelectedFuelVehicleId(null);
        }}
        onSave={handleSaveFuel}
        editingLog={editingFuelLog}
        machineries={machineries}
        employees={employees}
        fuelLogs={fuelLogs}
        initialMachineryId={selectedFuelVehicleId || undefined}
      />

      <MaintenanceModal
        isOpen={isMaintenanceModalOpen}
        onClose={() => {
          setIsMaintenanceModalOpen(false);
          setEditingMaintenanceLog(null);
        }}
        onSave={handleSaveMaintenance}
        editingLog={editingMaintenanceLog}
        machineries={machineries}
        employees={employees}
        inventory={inventory}
        suppliers={suppliers}
        companyProfile={companyProfile}
      />

      {/* Vehicle History & Profitability Modal */}
      {historyVehicle && (
        <VehicleHistoryModal
          isOpen={isHistoryModalOpen}
          onClose={() => {
            setIsHistoryModalOpen(false);
            setHistoryVehicle(null);
          }}
          vehicle={historyVehicle}
          machinery={historyVehicle}
          services={services}
          orders={orders}
          fuelLogs={fuelLogs}
          maintenanceLogs={maintenanceLogs}
          expenses={expenses}
          employees={employees}
          onAddService={handleAddService}
          onAddExpense={onAddExpense}
        />
      )}

    </div>
  );
};
