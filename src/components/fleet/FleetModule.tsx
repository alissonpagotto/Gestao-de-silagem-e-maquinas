import React, { useState, useEffect, useRef } from 'react';
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
import { Machinery, Employee, FleetTeam, FuelLog, MaintenanceLog, Expense, CompanyProfile, ServiceOrder, SilageOrder, VehicleTypeDefinition, TireRotationLog, InventoryItem, Supplier, MaintenancePurchaseRequest, BankAccount } from '../../types';
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
import { 
  upsertGestaoFrota, 
  upsertVeiculoMaquina,
  deleteVeiculoMaquina,
  saveCloudFuelLogs, 
  saveCloudMachineries, 
  upsertAbastecimento, 
  deleteAbastecimento,
  insertContaAPagarAbastecimento,
  upsertEstoqueItem,
  subtrairCombustivelTanque,
  baixarEstoqueProdutosDefinitivoOS,
  deleteCloudMaintenanceLog,
  saveCloudMaintenanceLogs,
  upsertCloudMaintenanceLog,
  mapRowToMaintenanceLog
} from '../../lib/supabaseService';
import { useConfirm } from '../../context/ConfirmContext';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { 
  getStoredVehicleTypes, 
  saveStoredVehicleTypes, 
  getStoredTireRotationLogs, 
  saveStoredTireRotationLogs,
  getStoredPurchaseRequests,
  saveStoredPurchaseRequests,
  getStoredInventory,
  saveStoredInventory,
  getStoredBankAccounts,
  saveStoredBankAccounts,
  saveStoredMachineries,
  saveStoredMaintenanceLogs,
  getActiveCompanyId,
  calculateDefaultDueDate
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
  initialDraftMaintenanceLog?: MaintenanceLog | null;
  onClearInitialDraftMaintenanceLog?: () => void;
  onSaveMachineries: (machineries: Machinery[]) => void;
  onSaveEmployees: (employees: Employee[]) => void;
  onSaveTeams?: (teams: FleetTeam[]) => void;
  onSaveFuelLogs: (logs: FuelLog[]) => void;
  onSaveMaintenanceLogs: (logs: MaintenanceLog[]) => void;
  onSaveInventory?: (inventory: InventoryItem[]) => void;
  onSaveServices?: (services: ServiceOrder[]) => void;
  onSaveOrders?: (orders: SilageOrder[]) => void;
  onAddExpense?: (expense: any) => void;
  bankAccounts?: BankAccount[];
  onSaveBankAccounts?: (accounts: BankAccount[]) => void;
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
  initialDraftMaintenanceLog,
  onClearInitialDraftMaintenanceLog,
  onSaveMachineries,
  onSaveEmployees,
  onSaveTeams,
  onSaveFuelLogs,
  onSaveMaintenanceLogs,
  onSaveInventory,
  onSaveServices,
  onSaveOrders,
  onAddExpense,
  bankAccounts = [],
  onSaveBankAccounts,
}) => {
  const { confirm } = useConfirm();
  const { currentUser } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<FleetSubTab>(initialSubTab || 'painel');

  // Referência atualizada para callbacks reativos e listeners Realtime
  const maintenanceLogsRef = useRef(maintenanceLogs);
  maintenanceLogsRef.current = maintenanceLogs;

  // Listener em tempo real (Supabase Realtime) escutando eventos na tabela física oficial 'manutencoes'
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let isMounted = true;
    let activeChannel: any = null;

    const setupRealtime = async () => {
      let activeUid = currentUser?.id;
      if (!activeUid) {
        try {
          const { data: authData } = await supabase.auth.getUser();
          activeUid = authData?.user?.id;
        } catch (_) {}
      }
      if (!activeUid || !isMounted) return null;

      const channelId = `manutencoes_rt_sync_${activeUid}`;
      const existingChannels = supabase.getChannels?.() || [];
      for (const ch of existingChannels) {
        if (ch.topic === channelId || ch.topic === `realtime:${channelId}`) {
          try { supabase.removeChannel(ch); } catch (_) {}
        }
      }

      const channel = supabase
        .channel(channelId)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'manutencoes',
          },
          (payload: any) => {
            if (!isMounted) return;
            if (payload.eventType === 'DELETE') {
              const delId = payload.old?.id;
              if (delId) {
                const nextLogs = maintenanceLogsRef.current.filter(m => m.id !== delId);
                onSaveMaintenanceLogs(nextLogs);
                saveStoredMaintenanceLogs(nextLogs);
              }
            } else if (payload.eventType === 'INSERT' && payload.new) {
              const item = mapRowToMaintenanceLog(payload.new);
              if (item.id) {
                const current = maintenanceLogsRef.current;
                const exists = current.some(m => m.id === item.id);
                if (!exists) {
                  const nextLogs = [item, ...current];
                  onSaveMaintenanceLogs(nextLogs);
                  saveStoredMaintenanceLogs(nextLogs);
                }
              }
            } else if (payload.eventType === 'UPDATE' && payload.new) {
              const item = mapRowToMaintenanceLog(payload.new);
              if (item.id) {
                const nextLogs = maintenanceLogsRef.current.map(m => m.id === item.id ? { ...m, ...item } : m);
                onSaveMaintenanceLogs(nextLogs);
                saveStoredMaintenanceLogs(nextLogs);
              }
            }
          }
        )
        .on(
          'broadcast',
          { event: 'delete_manutencao' },
          (payload: any) => {
            if (!isMounted || !payload?.payload?.id) return;
            const delId = payload.payload.id;
            const nextLogs = maintenanceLogsRef.current.filter(m => m.id !== delId);
            onSaveMaintenanceLogs(nextLogs);
            saveStoredMaintenanceLogs(nextLogs);
          }
        )
        .subscribe();

      return channel;
    };

    setupRealtime().then((ch) => {
      if (!isMounted && ch) {
        try { supabase.removeChannel(ch); } catch (_) {}
      } else {
        activeChannel = ch;
      }
    });

    const handleLocalDeleteEvent = (e: any) => {
      const delId = e?.detail?.id;
      if (delId && isMounted) {
        const nextLogs = maintenanceLogsRef.current.filter(m => m.id !== delId);
        onSaveMaintenanceLogs(nextLogs);
        saveStoredMaintenanceLogs(nextLogs);
      }
    };

    window.addEventListener('silagem_maintenance_deleted', handleLocalDeleteEvent);

    return () => {
      isMounted = false;
      window.removeEventListener('silagem_maintenance_deleted', handleLocalDeleteEvent);
      if (activeChannel) {
        try { supabase.removeChannel(activeChannel); } catch (_) {}
      }
    };
  }, [currentUser?.id]);

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

  React.useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  React.useEffect(() => {
    if (initialDraftMaintenanceLog) {
      setActiveSubTab('manutencoes');
      setEditingMaintenanceLog(initialDraftMaintenanceLog);
      setIsMaintenanceModalOpen(true);
      if (onClearInitialDraftMaintenanceLog) {
        onClearInitialDraftMaintenanceLog();
      }
    }
  }, [initialDraftMaintenanceLog, onClearInitialDraftMaintenanceLog]);

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
      const nextList = machineries.filter(m => m.id !== id);
      onSaveMachineries(nextList);
      saveStoredMachineries(nextList);
      saveCloudMachineries(nextList).catch(console.error);
      deleteVeiculoMaquina(id).catch(err => console.warn('Aviso ao excluir veículo no banco:', err));
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

  const handleSaveVehicle = async (vehicleData: Partial<Machinery>) => {
    let savedTargetVehicle: Machinery | null = null;
    let updatedList: Machinery[] = [];

    if (editingVehicle) {
      updatedList = machineries.map(m => {
        if (m.id === editingVehicle.id) {
          const merged = { ...m, ...vehicleData } as Machinery;

          // Se o usuário desativou o reboque (switch NÃO), limpa estritamente todos os dados de vínculo
          if (!vehicleData.hasCoupledTrailer) {
            merged.hasCoupledTrailer = false;
            merged.coupledTrailerId = undefined;
            merged.reboque_vinculado_id = null;
            merged.reboque_id = null;
            merged.coupledTrailerName = undefined;
            merged.coupledTrailerType = undefined;
            merged.trailerPlate = undefined;
            merged.trailerModel = undefined;
            if (merged.compositionType === 'cavalo') {
              merged.compositionType = 'veiculo_simples';
            }
          } else {
            merged.hasCoupledTrailer = true;
            merged.reboque_vinculado_id = vehicleData.reboque_vinculado_id || vehicleData.coupledTrailerId || null;
            merged.coupledTrailerId = vehicleData.coupledTrailerId || vehicleData.reboque_vinculado_id || undefined;
            merged.trailerPlate = vehicleData.trailerPlate;
            merged.trailerModel = vehicleData.trailerModel;
            merged.coupledTrailerType = vehicleData.coupledTrailerType;
            merged.coupledTrailerName = vehicleData.coupledTrailerName;
          }

          const calculated = updateVehicleWithCalculatedMetrics(merged, fuelLogs);
          savedTargetVehicle = calculated;
          return calculated;
        }
        return m;
      });
      onSaveMachineries(updatedList);
      saveStoredMachineries(updatedList);
      saveCloudMachineries(updatedList).catch(console.error);
      if (savedTargetVehicle) {
        try {
          await upsertVeiculoMaquina(savedTargetVehicle);
        } catch (err) {
          console.error('Erro ao salvar veículo no Supabase veiculos_maquinas:', err);
        }
      }
    } else {
      const hasTrailer = Boolean(vehicleData.hasCoupledTrailer && vehicleData.coupledTrailerId);
      const newVehicle: Machinery = {
        ...vehicleData,
        id: vehicleData.id || `mach_${Date.now()}`,
        name: vehicleData.name || vehicleData.model || 'Novo Veículo',
        model: vehicleData.model || 'Modelo',
        brand: vehicleData.brand || 'Agrícola',
        categoryType: vehicleData.categoryType || 'forrageira',
        status: vehicleData.status || 'disponivel',
        ownership: vehicleData.ownership || 'proprio',
        licensePlateOrSerial: vehicleData.licensePlateOrSerial || '',
        fleetNumber: vehicleData.fleetNumber || '',
        numero_frota: (vehicleData as any).numero_frota ?? (vehicleData.fleetNumber ? parseInt(String(vehicleData.fleetNumber).replace(/\D/g, ''), 10) || null : null),
        fleet_number: (vehicleData as any).fleet_number ?? (vehicleData.fleetNumber ? parseInt(String(vehicleData.fleetNumber).replace(/\D/g, ''), 10) || null : null),
        renavam: vehicleData.renavam,
        renavam_int: (vehicleData as any).renavam_int ?? (vehicleData.renavam ? parseInt(String(vehicleData.renavam).replace(/\D/g, ''), 10) || null : null),
        ownerDocument: vehicleData.ownerDocument,
        owner_document_num: (vehicleData as any).owner_document_num ?? (vehicleData.ownerDocument ? parseInt(String(vehicleData.ownerDocument).replace(/\D/g, ''), 10) || null : null),
        cpf_cnpj: (vehicleData as any).cpf_cnpj ?? vehicleData.ownerDocument,
        cpf_cnpj_num: (vehicleData as any).cpf_cnpj_num ?? (vehicleData.ownerDocument ? parseInt(String(vehicleData.ownerDocument).replace(/\D/g, ''), 10) || null : null),
        color: vehicleData.color,
        capacityM3: vehicleData.capacityM3,
        numero_eixos: vehicleData.numero_eixos,
        quantidade_pneus: vehicleData.quantidade_pneus,
        numeroEixos: vehicleData.numero_eixos,
        quantidadePneus: vehicleData.quantidade_pneus,
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
        hasCoupledTrailer: hasTrailer,
        coupledTrailerId: hasTrailer ? (vehicleData.coupledTrailerId || vehicleData.reboque_vinculado_id || undefined) : undefined,
        reboque_vinculado_id: hasTrailer ? (vehicleData.reboque_vinculado_id || vehicleData.coupledTrailerId || null) : null,
        coupledTrailerName: hasTrailer ? vehicleData.coupledTrailerName : undefined,
        coupledTrailerType: hasTrailer ? vehicleData.coupledTrailerType : undefined,
        trailerPlate: hasTrailer ? vehicleData.trailerPlate : undefined,
        trailerModel: hasTrailer ? vehicleData.trailerModel : undefined,
        compositionType: vehicleData.compositionType || (hasTrailer ? 'cavalo' : 'veiculo_simples'),
      };
      const calculatedNew = updateVehicleWithCalculatedMetrics(newVehicle, fuelLogs);
      savedTargetVehicle = calculatedNew;
      updatedList = [calculatedNew, ...machineries];
      onSaveMachineries(updatedList);
      saveStoredMachineries(updatedList);
      saveCloudMachineries(updatedList).catch(console.error);
      try {
        await upsertVeiculoMaquina(calculatedNew);
      } catch (err) {
        console.error('Erro ao salvar novo veículo no Supabase veiculos_maquinas:', err);
      }
    }
    setIsVehicleModalOpen(false);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('silagem_force_rest_sync'));
    }
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
    saveCloudFuelLogs(remainingLogs).catch(err => console.warn('Supabase delete fuel sync:', err));
    deleteAbastecimento(id).catch(err => console.warn('Supabase delete fuel row sync:', err));
    // Recalculate machinery metrics with remaining logs
    const updatedMachineries = machineries.map(m => updateVehicleWithCalculatedMetrics(m, remainingLogs));
    onSaveMachineries(updatedMachineries);
  };


  const handleSaveFuel = (fuelLog: FuelLog, createExpense: boolean) => {
    const updatedFuelLogs = editingFuelLog
      ? fuelLogs.map(f => (f.id === editingFuelLog.id ? fuelLog : f))
      : [fuelLog, ...fuelLogs];
    
    onSaveFuelLogs(updatedFuelLogs);
    saveCloudFuelLogs(updatedFuelLogs).catch(err => console.warn('Supabase save fuel sync:', err));
    upsertAbastecimento(fuelLog).catch(err => console.warn('Supabase save fuel row sync:', err));

    // Update vehicle's hourMeter, currentKm, fuel expenses, tank levels, and calculated averages
    const targetVehicle = machineries.find(m => m.id === fuelLog.machineryId);
    if (targetVehicle) {
      const updatedMachineries = machineries.map(m => {
        if (m.id === targetVehicle.id) {
          const updatedWithLogs = updateVehicleWithCalculatedMetrics(m, updatedFuelLogs);
          const tankCap = Number((m as any).tank_capacity ?? (m as any).tankCapacity ?? m.fuelCapacityLiters ?? 0);
          
          let newFuelLevel = m.currentFuelPercentage;
          let newFuelLiters = m.currentFuelLiters;

          // Se o abastecimento calculou o novo nível com precisão
          if (fuelLog.currentFuelPercentage !== undefined && fuelLog.currentFuelPercentage !== null) {
            newFuelLevel = fuelLog.currentFuelPercentage;
            newFuelLiters = fuelLog.currentFuelLiters;
          } else if (tankCap > 0 && fuelLog.liters > 0) {
            const prevPercent = (m.currentFuelPercentage !== undefined && m.currentFuelPercentage !== null)
              ? Math.max(0, Math.min(100, Number(m.currentFuelPercentage)))
              : 50;
            const prevLiters = (prevPercent / 100) * tankCap;
            const nextLiters = Math.min(tankCap, prevLiters + fuelLog.liters);
            newFuelLevel = Math.round((nextLiters / tankCap) * 100);
            newFuelLiters = nextLiters;
          }

          // Atualiza horímetro e km mais recentes
          const updatedHourMeter = fuelLog.currentHourMeter && fuelLog.currentHourMeter > (m.hourMeter || 0)
            ? fuelLog.currentHourMeter
            : (updatedWithLogs.hourMeter || m.hourMeter);

          const updatedKm = fuelLog.currentKm && fuelLog.currentKm > (m.currentKm || 0)
            ? fuelLog.currentKm
            : (updatedWithLogs.currentKm || m.currentKm);

          return {
            ...updatedWithLogs,
            currentFuelPercentage: newFuelLevel,
            currentFuelLiters: newFuelLiters,
            hourMeter: updatedHourMeter,
            currentKm: updatedKm,
            totalFuelExpenses: (m.totalFuelExpenses || 0) + (editingFuelLog ? 0 : fuelLog.totalAmount),
          };
        }
        return m;
      });

      onSaveMachineries(updatedMachineries);

      // Persistência em nuvem (Supabase): salva o registro do veículo em gestao_frotas e o estado completo no site_settings
      const updatedTargetVehicle = updatedMachineries.find(m => m.id === targetVehicle.id);
      if (updatedTargetVehicle) {
        upsertGestaoFrota(updatedTargetVehicle).catch(err => {
          console.warn('Sincronização de veículo pós abastecimento no Supabase:', err);
        });
      }
      saveCloudMachineries(updatedMachineries).catch(err => {
        console.warn('Sincronização de frotas completas no Supabase:', err);
      });
    }

    // Automatically create expense and financial integration
    const origin = fuelLog.fuelOrigin || 'Tanque Interno (Fazenda)';

    if (!editingFuelLog && origin === 'Tanque Interno (Fazenda)') {
      const isArlaGalao = fuelLog.fuelType?.toLowerCase().includes('galão') || fuelLog.fuelType?.toLowerCase().includes('galao');
      const isArlaGranel = !isArlaGalao && (fuelLog.tanque_id?.toLowerCase().includes('arla') || fuelLog.fuelType?.toLowerCase().includes('arla'));
      const isS500 = !isArlaGalao && !isArlaGranel && (fuelLog.tanque_id?.toLowerCase().includes('s500') || fuelLog.fuelType?.toLowerCase().includes('s500'));

      // Baixa direta no tanque de combustível da fazenda (tabela tanques_combustivel)
      // IMPORTANTE: NÃO subtrai do tanque de 1.000L se for Arla em Galão (Almoxarifado)!
      if (!isArlaGalao && (fuelLog.tanque_id || fuelLog.tanqueId)) {
        const tId = fuelLog.tanque_id || fuelLog.tanqueId!;
        subtrairCombustivelTanque(tId, fuelLog.liters).catch(tErr => {
          console.warn('[tanques_combustivel] Erro ao subtrair:', tErr);
        });
      }

      // Baixa correspondente na tabela 'public.estoque_produtos' (por unidade se for Galão 20L no Almoxarifado Principal)
      const currentInventory = inventory && inventory.length > 0 ? inventory : getStoredInventory();
      const fuelItem = currentInventory.find(i => {
        if (fuelLog.produto_id && i.id === fuelLog.produto_id) return true;
        const nm = (i.nome_comercial || i.name || '').toLowerCase();
        if (isArlaGalao) return nm.includes('arla') && (nm.includes('galão') || nm.includes('galao'));
        if (isArlaGranel) return nm.includes('arla') && (nm.includes('granel') || (!nm.includes('galão') && !nm.includes('galao')));
        if (isS500) return nm.includes('s500') || nm.includes('comum');
        return nm.includes('s10') || nm.includes('diesel');
      });

      if (fuelItem) {
        const currentQty = Number(fuelItem.quantidade_atual ?? fuelItem.quantity ?? 0);
        // Se for galão 20L, a unidade é 'un': calcula quantos galões foram usados
        let amountToDeduct = fuelLog.liters;
        if (isArlaGalao) {
          amountToDeduct = fuelLog.liters >= 10 ? Math.max(1, Math.ceil(fuelLog.liters / 20)) : Math.max(1, Math.round(fuelLog.liters));
        }
        const newQty = Math.max(0, Number((currentQty - amountToDeduct).toFixed(2)));
        const updatedInventory = currentInventory.map(item => 
          item.id === fuelItem.id ? { 
            ...item, 
            quantity: newQty, 
            quantidade_atual: newQty, 
            updatedAt: new Date().toISOString() 
          } : item
        );
        if (onSaveInventory) {
          onSaveInventory(updatedInventory);
        }
        saveStoredInventory(updatedInventory);
        upsertEstoqueItem({ ...fuelItem, quantity: newQty, quantidade_atual: newQty }).catch(err => 
          console.warn('Supabase baixa estoque combustivel/arla sync:', err)
        );
      }
    }

    if (createExpense && onAddExpense && !editingFuelLog) {
      const rawMachName = targetVehicle
        ? (targetVehicle.licensePlateOrSerial ? `[${targetVehicle.licensePlateOrSerial}] - ${targetVehicle.model || targetVehicle.name}` : targetVehicle.name)
        : (fuelLog.machineryPlateOrName || 'Veículo');
      const machName = rawMachName.replace(/^(AGR[IÍ]COLA\s*[-–—:]*\s*)/i, '').trim();

      if (origin === 'Tanque Interno (Fazenda)') {
        const isArlaGalao = fuelLog.fuelType?.toLowerCase().includes('galão') || fuelLog.fuelType?.toLowerCase().includes('galao');

        // 3. Envia o custo para o DRE do veículo e registra no financeiro como compensado pelo estoque
        onAddExpense({
          id: `exp_fuel_${fuelLog.id}`,
          date: fuelLog.date,
          category: 'Combustível & Arla',
          description: isArlaGalao
            ? `Consumo Galão Arla 32 - ${machName} [Almoxarifado]`
            : `Abastecimento Tanque Interno - ${machName} (${fuelLog.liters}L) [Compensado pelo Estoque]`,
          amount: fuelLog.totalAmount,
          paymentMethod: 'outro',
          supplier: isArlaGalao ? 'Almoxarifado Principal' : 'Tanque da Fazenda (Estoque Interno)',
          status: 'compensado_estoque',
          costCenterId: targetVehicle?.id,
          costCenterName: machName,
          notes: isArlaGalao
            ? `Baixa no estoque do Almoxarifado Principal de Arla 32 (Galão 20L). Motorista: ${fuelLog.driverOrOperator || 'N/A'}`
            : `Baixa interna de ${fuelLog.liters}L no tanque da fazenda. Custo no DRE do veículo sem geração de dívida pendente a pagar. Motorista: ${fuelLog.driverOrOperator || 'N/A'}`,
        });
      } else if (origin === 'Posto Conveniado (Faturado)') {
        // 1. POST na tabela 'public.contas_a_pagar' com status 'A Pagar' (Pendente), vinculando ao Fornecedor/Posto selecionado
        insertContaAPagarAbastecimento({
          id: `cap_fuel_${fuelLog.id}`,
          abastecimentoId: fuelLog.id,
          veiculoId: targetVehicle?.id,
          veiculoNome: machName,
          fornecedor: fuelLog.supplierStation || 'Posto Conveniado',
          valorTotal: fuelLog.totalAmount,
          dataEmissao: fuelLog.date,
          dataVencimento: fuelLog.dueDate || calculateDefaultDueDate(fuelLog.date),
          formaPagamento: 'Boleto',
          statusPago: false,
          origemCombustivel: 'Posto Conveniado (Faturado)',
          litros: fuelLog.liters,
          tipoCombustivel: fuelLog.fuelType,
          motorista: fuelLog.driverOrOperator,
          observacoes: fuelLog.notes,
        }).catch(err => console.warn('Supabase insertContaAPagarAbastecimento faturado err:', err));

        // 2. Distribui o valor no custo do veículo associado para o DRE e cria lançamento faturado 'A Pagar' (Pendente)
        onAddExpense({
          id: `exp_fuel_${fuelLog.id}`,
          date: fuelLog.date,
          dueDate: fuelLog.dueDate || calculateDefaultDueDate(fuelLog.date),
          category: 'Combustível & Arla',
          description: `Abastecimento Faturado (${fuelLog.supplierStation}) - ${machName} (${fuelLog.liters}L)`,
          amount: fuelLog.totalAmount,
          paymentMethod: 'boleto',
          supplier: fuelLog.supplierStation || 'Posto Conveniado',
          status: 'pendente',
          costCenterId: targetVehicle?.id,
          costCenterName: machName,
          notes: `Abastecimento faturado em posto conveniado. A Pagar pendente no Contas a Pagar. Motorista: ${fuelLog.driverOrOperator || 'N/A'}`,
        });
      } else if (origin === 'Posto de Viagem (Pago na Hora)') {
        // 1. POST na tabela 'public.contas_a_pagar' com status 'Pago' (Liquidada)
        insertContaAPagarAbastecimento({
          id: `cap_fuel_${fuelLog.id}`,
          abastecimentoId: fuelLog.id,
          veiculoId: targetVehicle?.id,
          veiculoNome: machName,
          fornecedor: fuelLog.supplierStation || 'Posto de Viagem',
          valorTotal: fuelLog.totalAmount,
          dataEmissao: fuelLog.date,
          dataVencimento: fuelLog.date,
          formaPagamento: fuelLog.paymentMethod || 'Pix',
          contaBancariaId: fuelLog.bankAccountId,
          contaBancariaNome: fuelLog.bankAccountName,
          statusPago: true,
          origemCombustivel: 'Posto de Viagem (Pago na Hora)',
          litros: fuelLog.liters,
          tipoCombustivel: fuelLog.fuelType,
          motorista: fuelLog.driverOrOperator,
          observacoes: fuelLog.notes,
        }).catch(err => console.warn('Supabase insertContaAPagarAbastecimento viagem err:', err));

        // 2. Deduzindo o valor na hora da conta bancária escolhida
        if (fuelLog.bankAccountId) {
          const currentAccounts = bankAccounts && bankAccounts.length > 0 ? bankAccounts : getStoredBankAccounts();
          const updatedAccounts = currentAccounts.map(acc => 
            acc.id === fuelLog.bankAccountId
              ? { ...acc, balance: Number(((acc.balance || 0) - fuelLog.totalAmount).toFixed(2)) }
              : acc
          );
          saveStoredBankAccounts(updatedAccounts);
          if (onSaveBankAccounts) {
            onSaveBankAccounts(updatedAccounts);
          }
        }

        // 3. Vinculando o custo ao DRE do veículo e registrando lançamento liquidado 'Pago'
        const rawPayment = (fuelLog.paymentMethod || '').toLowerCase();
        const mappedPayment = rawPayment.includes('cart') ? 'cartao_debito' : (rawPayment.includes('dinh') ? 'dinheiro' : 'pix');

        onAddExpense({
          id: `exp_fuel_${fuelLog.id}`,
          date: fuelLog.date,
          dueDate: fuelLog.date,
          paymentDate: fuelLog.date,
          category: 'Combustível & Arla',
          description: `Abastecimento Viagem (${fuelLog.supplierStation || 'Posto de Viagem'}) - ${machName} (${fuelLog.liters}L)`,
          amount: fuelLog.totalAmount,
          paymentMethod: mappedPayment,
          supplier: fuelLog.supplierStation || 'Posto de Viagem',
          status: 'pago',
          costCenterId: targetVehicle?.id,
          costCenterName: machName,
          bankAccountId: fuelLog.bankAccountId,
          bankAccountName: fuelLog.bankAccountName,
          notes: `Pago na hora em posto de viagem. Débito realizado na conta: ${fuelLog.bankAccountName || 'Conta Bancária/Caixa'}. Motorista: ${fuelLog.driverOrOperator || 'N/A'}`,
        });
      }
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
      const activeUid = currentUser?.id;
      const cId = companyProfile?.id || getActiveCompanyId();

      // 1. Execução do Comando Físico no Supabase com amarração por usuário ativo
      await deleteCloudMaintenanceLog(id, activeUid, cId);

      // 2. Atualização Reativa e Sincronizada:
      // Remove o registro do estado local do componente
      const nextLogs = maintenanceLogs.filter(m => m.id !== id);
      onSaveMaintenanceLogs(nextLogs);
      saveStoredMaintenanceLogs(nextLogs);

      // Propaga evento local para sincronização em tempo real imediata
      window.dispatchEvent(new CustomEvent('silagem_maintenance_deleted', { detail: { id } }));
    }
  };


  const handleUpdateMaintenanceStatus = (id: string, newStatus: MaintenanceLog['status']) => {
    const updated = maintenanceLogs.map(m => (m.id === id ? { ...m, status: newStatus } : m));
    onSaveMaintenanceLogs(updated);
  };

  const handleSaveMaintenance = (
    log: MaintenanceLog, 
    flags?: { 
      createExpense?: boolean; 
      deductStock?: boolean; 
      createPurchaseRequest?: boolean;
      skipAccountsPayableDreOnly?: boolean;
    }
  ) => {
    const isDreOnly = Boolean(
      flags?.skipAccountsPayableDreOnly || 
      log.skipAccountsPayableDreOnly || 
      log.financialConditions?.skipAccountsPayableDreOnly
    );
    const shouldCreateExpense = isDreOnly ? false : (flags?.createExpense ?? false);
    const shouldDeductStock = flags?.deductStock ?? true;
    const shouldCreatePurchase = flags?.createPurchaseRequest ?? false;

    const existingIdx = maintenanceLogs.findIndex(m => m.id === log.id || (editingMaintenanceLog && m.id === editingMaintenanceLog.id));
    if (existingIdx !== -1) {
      const updated = [...maintenanceLogs];
      updated[existingIdx] = log;
      onSaveMaintenanceLogs(updated);
    } else {
      onSaveMaintenanceLogs([log, ...maintenanceLogs]);
    }
    setEditingMaintenanceLog(log);

    // Persiste imediatamente no Supabase (tabela 'public.frotas_manutencoes' e 'manutencoes')
    const activeCid = companyProfile?.id || getActiveCompanyId();
    const activeUid = currentUser?.id || currentUser?.uid;
    upsertCloudMaintenanceLog(log, activeCid, activeUid).catch(err => console.warn('Supabase upsertCloudMaintenanceLog notice:', err));
    window.dispatchEvent(new CustomEvent('silagem_maintenance_changed', { detail: log }));

    // Update vehicle status and maintenance expenses
    const targetVehicle = machineries.find(m => m.id === log.machineryId);
    if (targetVehicle) {
      const existingIdx = maintenanceLogs.findIndex(m => m.id === log.id);
      const prevExpense = (existingIdx !== -1 && maintenanceLogs[existingIdx]) ? (maintenanceLogs[existingIdx].totalCost || 0) : 0;
      const expenseDiff = (Number(log.totalCost) || 0) - prevExpense;
      const updatedVehicle: Machinery = {
        ...targetVehicle,
        status: log.status === 'concluida' ? 'operacional' : (log.status === 'em_andamento' ? 'em_manutencao' : targetVehicle.status),
        totalMaintenanceExpenses: Math.max(0, (targetVehicle.totalMaintenanceExpenses || 0) + expenseDiff),
      };
      onSaveMachineries(machineries.map(m => m.id === targetVehicle.id ? updatedVehicle : m));
    }

    // 1. Sincronização e Baixa Automática no Almoxarifado Interno
    if (shouldDeductStock) {
      const latestInventory = getStoredInventory();
      if (latestInventory && latestInventory.length > 0 && onSaveInventory) {
        onSaveInventory(latestInventory);
      }
      // Dispara o comando definitivo no Supabase ('public.estoque_produtos')
      if (log.partsItems && log.partsItems.length > 0) {
        baixarEstoqueProdutosDefinitivoOS(
          log.partsItems.map(p => ({
            produto_id: p.inventoryItemId || (p as any).produto_id,
            inventoryItemId: p.inventoryItemId,
            description: p.description,
            quantity: Number(p.quantity) || 1,
          }))
        ).catch(err => console.warn('Supabase baixarEstoqueProdutosDefinitivoOS notice:', err));
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

    // 3. Regra DRE sem Contas a Pagar (Abatimento Direto de Estoque)
    if (isDreOnly && onAddExpense && log.totalCost > 0) {
      const osIdClean = log.osNumber || log.id;
      const dreExpense: Expense = {
        id: `dre_maint_${osIdClean.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`,
        description: `OS ${osIdClean} [${log.serviceCategory}] - ${log.machineryPlateOrName} (Custo Direto Almoxarifado / DRE)`,
        amount: Number(log.totalCost) || 0,
        categoryId: 'cat_manutencao',
        categoryName: 'Manutenção de Frotas',
        categoryColor: '#6366f1',
        dueDate: log.date || new Date().toISOString().split('T')[0],
        paymentDate: log.date || new Date().toISOString().split('T')[0],
        status: 'compensado_estoque',
        paymentMethod: 'outro' as any,
        supplier: 'Almoxarifado Interno (NF-e Entrada)',
        costCenterId: targetVehicle?.id || log.machineryId,
        costCenterName: targetVehicle?.name || log.machineryPlateOrName,
        machineryId: targetVehicle?.id || log.machineryId,
        machineryName: targetVehicle?.licensePlateOrSerial || targetVehicle?.name || log.machineryPlateOrName,
        invoiceNumber: log.nfeLink?.nfeNumber || log.osNumber,
        notes: `Custo gerencial de manutenção DRE (peças com baixa física direta no estoque). Veículo: ${log.machineryPlateOrName}. Não gera lançamento a pagar no financeiro.`,
        isDreOnly: true,
        skipAccountsPayable: true,
        createdAt: new Date().toISOString(),
      };
      onAddExpense(dreExpense);
    }

    // 4. Automatically create expense in finance (Contas a Pagar) if requested (standard flow)
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
          onSaveMachineries={onSaveMachineries}
          companyProfile={companyProfile}
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
        suppliers={suppliers}
        bankAccounts={bankAccounts}
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
