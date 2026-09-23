import React, { useState, useMemo } from 'react';
import { 
  Plus, Search, Filter, Fuel, Wrench, AlertTriangle, 
  CheckCircle2, Clock, Truck, Shield, Calendar, Edit3, Trash2,
  Table as TableIcon, LayoutGrid, Users, Gauge, Box, Eye, TrendingUp,
  Receipt, DollarSign, Printer, RefreshCw, X, Link2, Check,
  Share2, ArrowUpDown, ChevronDown, Sparkles, Building, Weight
} from 'lucide-react';
import { Machinery, FuelLog, MaintenanceLog, Employee, ServiceOrder, SilageOrder, CompanyProfile } from '../../types';
import { PrintPreviewModal } from '../common/PrintPreviewModal';
import { generateFleetListHtml, generateFleetWhatsAppText, syncFleetMeters } from './fleetPrintUtils';
import { PrintDocumentOptions } from '../../lib/printService';
import { getStoredVehicleSystemCategories, getStoredVehicleOwnershipRegimes, getStoredCompanyProfile } from '../../lib/storage';
import { fetchGestaoFrotas, fetchCloudFuelLogs, isSupabaseConfigured } from '../../lib/supabaseService';

interface FleetVehiclesViewProps {
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
  machineries,
  fuelLogs,
  maintenanceLogs,
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

  // Filter machineries
  const availableCategories = useMemo(() => {
    const fromStorage = getStoredVehicleSystemCategories();
    const fromMachines = machineries.map(m => m.categoryType).filter(Boolean) as string[];
    const set = new Set([...fromStorage, ...fromMachines]);
    return Array.from(set);
  }, [machineries]);

  const availableRegimes = useMemo(() => {
    const fromStorage = getStoredVehicleOwnershipRegimes();
    const fromMachines = machineries.map(m => m.ownership).filter(Boolean) as string[];
    const set = new Set([
      ...fromStorage,
      ...fromMachines.map(o => {
        if (o === 'proprio') return 'Próprio';
        if (o === 'terceirizado') return 'De Terceiros';
        if (o === 'alugado') return 'Alugado / Locação';
        if (o === 'arrendado') return 'Arrendado / Financiado';
        return o;
      })
    ]);
    return Array.from(set);
  }, [machineries]);

  const getOwnershipBadge = (ownership?: string) => {
    const own = ownership || 'Próprio';
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
    const raw = (vehicle.categoryType || '').trim();
    const detailed = (vehicle.vehicleTypeDetailed || '').trim();
    const trailerType = (vehicle.trailerType || '').trim();
    const compType = vehicle.compositionType || '';

    // Se possui reboque detalhado
    if (trailerType && (raw.toLowerCase().includes('reboque') || compType === 'reboque')) {
      return {
        label: `REBOQUE ${trailerType.toUpperCase()}`,
        style: 'bg-emerald-100 text-emerald-950 dark:bg-emerald-950/70 dark:text-emerald-200 border-emerald-300/90 dark:border-emerald-700'
      };
    }

    // Se o tipo detalhado foi informado no cadastro
    if (detailed) {
      const detUpper = detailed.toUpperCase();
      const detLower = detailed.toLowerCase();
      if (detLower.includes('caminh') || detLower.includes('caçamba') || detLower.includes('cacamba') || detLower.includes('basculante') || detLower.includes('graneleiro')) {
        const fullLabel = detUpper.includes('CAMINHÃO') ? detUpper : `CAMINHÃO ${detUpper}`;
        return {
          label: fullLabel,
          style: 'bg-emerald-100 text-emerald-950 dark:bg-emerald-950/70 dark:text-emerald-200 border-emerald-300/90 dark:border-emerald-700'
        };
      }
      if (detLower.includes('reboque') || detLower.includes('carreta') || detLower.includes('cocho')) {
        const fullLabel = detUpper.includes('REBOQUE') ? detUpper : `REBOQUE ${detUpper}`;
        return {
          label: fullLabel,
          style: 'bg-emerald-100 text-emerald-950 dark:bg-emerald-950/70 dark:text-emerald-200 border-emerald-300/90 dark:border-emerald-700'
        };
      }
      return {
        label: detUpper,
        style: 'bg-emerald-100 text-emerald-950 dark:bg-emerald-950/70 dark:text-emerald-200 border-emerald-300/90 dark:border-emerald-700'
      };
    }

    // Identificação por tipo principal cadastrado
    const catLower = raw.toLowerCase();
    if (catLower.includes('caminh') || catLower === 'caminhao') {
      if (catLower.includes('basculante') || catLower.includes('graneleiro') || catLower.includes('silagem') || catLower.includes('caçamba') || catLower.includes('cacamba')) {
        return {
          label: 'CAMINHÃO CAÇAMBA',
          style: 'bg-emerald-100 text-emerald-950 dark:bg-emerald-950/70 dark:text-emerald-200 border-emerald-300/90 dark:border-emerald-700'
        };
      }
      return {
        label: 'CAMINHÃO CAÇAMBA',
        style: 'bg-emerald-100 text-emerald-950 dark:bg-emerald-950/70 dark:text-emerald-200 border-emerald-300/90 dark:border-emerald-700'
      };
    }
    if (catLower.includes('ensilad') || catLower.includes('forrageir') || catLower.includes('colhedor') || catLower === 'forrageira') {
      return {
        label: 'FORRAGEIRA',
        style: 'bg-emerald-100 text-emerald-950 dark:bg-emerald-950/70 dark:text-emerald-200 border-emerald-300/90 dark:border-emerald-700'
      };
    }
    if (catLower.includes('trator') || catLower === 'trator') {
      return {
        label: 'TRATOR AGRÍCOLA',
        style: 'bg-emerald-100 text-emerald-950 dark:bg-emerald-950/70 dark:text-emerald-200 border-emerald-300/90 dark:border-emerald-700'
      };
    }
    if (catLower.includes('reboque') || compType === 'reboque' || catLower.includes('carreta')) {
      return {
        label: 'REBOQUE COCHO',
        style: 'bg-emerald-100 text-emerald-950 dark:bg-emerald-950/70 dark:text-emerald-200 border-emerald-300/90 dark:border-emerald-700'
      };
    }
    if (catLower.includes('cavalo')) {
      return {
        label: 'CAVALO MECÂNICO',
        style: 'bg-emerald-100 text-emerald-950 dark:bg-emerald-950/70 dark:text-emerald-200 border-emerald-300/90 dark:border-emerald-700'
      };
    }
    if (catLower.includes('utilit') || catLower === 'utilitario') {
      return {
        label: 'VEÍCULO UTILITÁRIO',
        style: 'bg-emerald-100 text-emerald-950 dark:bg-emerald-950/70 dark:text-emerald-200 border-emerald-300/90 dark:border-emerald-700'
      };
    }
    if (catLower.includes('onibus') || catLower.includes('ônibus') || catLower.includes('van')) {
      return {
        label: 'ÔNIBUS / VAN',
        style: 'bg-emerald-100 text-emerald-950 dark:bg-emerald-950/70 dark:text-emerald-200 border-emerald-300/90 dark:border-emerald-700'
      };
    }
    if (catLower.includes('implemento')) {
      return {
        label: 'IMPLEMENTO AGRÍCOLA',
        style: 'bg-emerald-100 text-emerald-950 dark:bg-emerald-950/70 dark:text-emerald-200 border-emerald-300/90 dark:border-emerald-700'
      };
    }

    if (raw) {
      return {
        label: raw.toUpperCase(),
        style: 'bg-emerald-100 text-emerald-950 dark:bg-emerald-950/70 dark:text-emerald-200 border-emerald-300/90 dark:border-emerald-700'
      };
    }

    return {
      label: 'EQUIPAMENTO',
      style: 'bg-emerald-100 text-emerald-950 dark:bg-emerald-950/70 dark:text-emerald-200 border-emerald-300/90 dark:border-emerald-700'
    };
  };

  const filteredVehicles = useMemo(() => {
    return machineries.filter((m) => {
      const matchSearch =
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.fleetNumber && m.fleetNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (m.licensePlateOrSerial && m.licensePlateOrSerial.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (m.serialNumber && m.serialNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (m.categoryType && m.categoryType.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (m.operatorOrDriver && m.operatorOrDriver.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (m.renavam && m.renavam.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (m.brand && m.brand.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (m.ownerName && m.ownerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (m.ownerDocument && m.ownerDocument.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (m.vehicleTypeDetailed && m.vehicleTypeDetailed.toLowerCase().includes(searchTerm.toLowerCase()));

      const catLower = (m.categoryType || '').toLowerCase();
      const selLower = selectedCategory.toLowerCase();
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
      
      const ownLower = (m.ownership || 'próprio').toLowerCase();
      const selOwnLower = selectedOwnership.toLowerCase();
      const matchOwnership = 
        selectedOwnership === 'todos' || 
        m.ownership === selectedOwnership ||
        ownLower === selOwnLower ||
        (selOwnLower.includes('próprio') && (ownLower === 'proprio' || ownLower.includes('proprio') || !m.ownership)) ||
        (selOwnLower.includes('terceir') && (ownLower === 'terceirizado' || ownLower.includes('terceir'))) ||
        (selOwnLower.includes('alug') && (ownLower === 'alugado' || ownLower.includes('alug'))) ||
        (selOwnLower.includes('arrend') && (ownLower === 'arrendado' || ownLower.includes('arrend')));

      const matchComposition = 
        selectedComposition === 'todos' ||
        (selectedComposition === 'cavalo' && m.compositionType === 'cavalo') ||
        (selectedComposition === 'reboque' && (m.compositionType === 'reboque' || (m.categoryType || '').trim().toLowerCase() === 'reboque')) ||
        (selectedComposition === 'veiculo_simples' && (m.compositionType === 'veiculo_simples' || !m.compositionType));

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

      // 1. Busca forçada via REST das tabelas no Supabase (contornando falha de WebSocket)
      if (isSupabaseConfigured) {
        try {
          const [remoteMachines, remoteFuel] = await Promise.all([
            fetchGestaoFrotas(),
            fetchCloudFuelLogs()
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

      // 3. Atualiza estado e banco de dados
      if (onSaveMachineries) {
        onSaveMachineries(updatedMachineries);
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

  const handleSaveQuickMeter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickMeterVehicle) return;

    const parsedHour = quickHourMeter.trim() ? parseFloat(quickHourMeter.replace(',', '.')) : quickMeterVehicle.hourMeter;
    const parsedKm = quickKm.trim() ? parseFloat(quickKm.replace(',', '.')) : quickMeterVehicle.currentKm;

    const updatedVehicle: Machinery = {
      ...quickMeterVehicle,
      hourMeter: parsedHour !== undefined && !isNaN(parsedHour) ? parsedHour : quickMeterVehicle.hourMeter,
      currentKm: parsedKm !== undefined && !isNaN(parsedKm) ? parsedKm : quickMeterVehicle.currentKm,
    };

    onEditVehicle(updatedVehicle);
    setQuickMeterFeedback('✅ Leitura atualizada com sucesso!');
    setTimeout(() => {
      setQuickMeterVehicle(null);
      setQuickMeterFeedback(null);
    }, 1200);
  };

  return (
    <div className="space-y-6">
      
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
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          
          {/* Search Input */}
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              placeholder="Buscar por placa, modelo, nº de série, titular, CPF/CNPJ, tipo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800/60 text-stone-900 dark:text-stone-100 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-sky-600 focus:bg-white dark:focus:bg-stone-800 shadow-inner"
            />
          </div>

          {/* Action Buttons: Imprimir Lista, Sincronizar Leituras, Cadastrar */}
          <div className="flex items-center flex-wrap gap-2 sm:gap-2.5">
            
            {/* Botão Imprimir Lista de Veículos */}
            <button
              onClick={handleOpenPrint}
              title="Visualizar e Imprimir Lista Completa da Frota em A4"
              className="px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 hover:border-stone-400 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:text-stone-900 dark:hover:text-white text-xs sm:text-sm font-bold shadow-xs hover:shadow-sm transition flex items-center space-x-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-stone-600 dark:text-stone-300" />
              <span>Imprimir Lista</span>
            </button>

            {/* Botão Sincronizar Odômetro & Horímetro */}
            <button
              onClick={handleSyncMeters}
              disabled={isSyncing}
              title="Sincronizar Odômetro & Horímetro com os últimos abastecimentos e manutenções"
              className="px-3.5 py-2 rounded-xl border border-amber-300 dark:border-amber-800/80 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-200 text-xs sm:text-sm font-bold shadow-xs transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-amber-600 dark:text-amber-400 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sincronizar Leituras</span>
              <span className="sm:hidden">Sincronizar</span>
            </button>

            {/* View toggle (Tabela / Cards) */}
            <div className="flex items-center bg-stone-100 dark:bg-stone-800 p-1 rounded-xl border border-stone-200 dark:border-stone-700">
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-stone-700 text-sky-600 shadow-xs'
                    : 'text-stone-500 hover:text-stone-900 dark:hover:text-white'
                }`}
                title="Visualização em Tabela"
              >
                <TableIcon className="w-4 h-4" />
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
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>

            {/* Cadastrar Veículo */}
            <button
              onClick={onOpenNewVehicle}
              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-sky-600/20 transition flex items-center space-x-1.5 cursor-pointer ml-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar Veículo</span>
            </button>

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
                  <th className="py-2.5 px-2 xl:px-2.5 text-black dark:text-white font-black truncate">CÓDIGO / FROTA</th>
                  <th className="py-2.5 px-2 xl:px-2.5 text-black dark:text-white font-black truncate">TIPO & MODELO</th>
                  <th className="py-2.5 px-2 xl:px-2.5 text-black dark:text-white font-black truncate">PROPRIEDADE</th>
                  <th className="py-2.5 px-2 xl:px-2.5 text-black dark:text-white font-black truncate">PESOS & CARGA</th>
                  <th className="py-2.5 px-2 xl:px-2.5 text-black dark:text-white font-black truncate">HORÍMETRO / KM</th>
                  <th className="py-2.5 px-2 xl:px-2.5 text-black dark:text-white font-black truncate">MOTORISTA</th>
                  <th className="py-2.5 px-2 xl:px-2.5 text-black dark:text-white font-black truncate">CUSTO TOTAL</th>
                  <th className="py-2.5 px-2 xl:px-2.5 text-black dark:text-white font-black truncate">STATUS</th>
                  <th className="py-2.5 px-2 xl:px-2.5 text-right text-black dark:text-white font-black truncate">AÇÕES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-200/60 dark:divide-stone-800/60 font-medium bg-[#87AFE3] dark:bg-stone-900 text-black dark:text-white">
                {filteredVehicles.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-14 text-center text-stone-400">
                      Nenhum veículo encontrado com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredVehicles.map((vehicle) => {
                    const totalFuel = getVehicleTotalFuel(vehicle.id);
                    const totalMaint = getVehicleTotalMaintenance(vehicle.id);
                    const totalCost = totalFuel + totalMaint;
                    const driversList = vehicle.assignedDrivers && vehicle.assignedDrivers.length > 0
                      ? vehicle.assignedDrivers
                      : (vehicle.operatorOrDriver ? vehicle.operatorOrDriver.split(',').map(s => s.trim()) : []);

                    const isCavalo = vehicle.compositionType === 'cavalo';
                    const isReboque = vehicle.compositionType === 'reboque' || (vehicle.categoryType || '').trim().toLowerCase() === 'reboque';
                    const hasCoupledTrailer = Boolean(vehicle.hasCoupledTrailer || vehicle.trailerPlate || vehicle.coupledTrailerName || vehicle.coupledTrailerId);
                    const trailerPlateDisplay = vehicle.trailerPlate || (vehicle.coupledTrailerName && vehicle.coupledTrailerName.includes('-') ? vehicle.coupledTrailerName.split('-')[0].trim() : '');
                    const trailerModelDisplay = vehicle.trailerModel || (vehicle.coupledTrailerName && vehicle.coupledTrailerName.includes('-') ? vehicle.coupledTrailerName.split('-').slice(1).join('-').trim() : vehicle.coupledTrailerName);
                    const pbt = (vehicle.taraWeightKg && vehicle.capacityLoadKg)
                      ? (vehicle.taraWeightKg + vehicle.capacityLoadKg)
                      : vehicle.grossWeightKg;
                    const categoryTag = getVehicleCategoryTag(vehicle);

                    return (
                      <tr key={vehicle.id} className="hover:bg-stone-50/70 dark:hover:bg-stone-800/40 transition">
                        
                        {/* Identificação / Placa / Nº Série */}
                        <td className="py-2.5 px-2 xl:px-2.5 align-top">
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
                        <td className="py-2.5 px-2 xl:px-2.5 align-top">
                          {/* 3. Tag de Categoria do Veículo (logo acima do modelo e ano) */}
                          <div className="mb-1">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border shadow-2xs ${categoryTag.style}`}>
                              {categoryTag.label}
                            </span>
                          </div>

                          <div className="font-bold text-stone-900 dark:text-stone-100 uppercase text-xs sm:text-sm leading-tight break-words">
                            {(vehicle.model || vehicle.name || '').toUpperCase()}
                          </div>
                          <div className="text-[11px] text-stone-700 dark:text-stone-300 flex flex-wrap items-center gap-1 mt-0.5 uppercase">
                            <span className="font-semibold">{(vehicle.brand || 'Agrícola').toUpperCase()}</span>
                            {vehicle.year && <span className="normal-case font-medium">• Ano {vehicle.year}</span>}
                          </div>

                          {/* Badges de Composição e Reboque Vinculado */}
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            {isCavalo && (
                              <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800 uppercase">
                                🚛 Cavalo
                              </span>
                            )}
                            {isReboque && (
                              <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 uppercase">
                                🛞 Reboque{vehicle.trailerType ? `: ${vehicle.trailerType.toUpperCase()}` : ''}
                              </span>
                            )}
                            {hasCoupledTrailer && (
                              <div className="inline-flex flex-wrap items-center gap-1 text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-950 dark:bg-sky-950/70 dark:text-sky-200 border border-sky-300 dark:border-sky-800 shadow-2xs">
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
                        <td className="py-2.5 px-2 xl:px-2.5 align-top break-words">
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
                        <td className="py-2.5 px-2 xl:px-2.5 align-top">
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
                        <td className="py-2.5 px-2 xl:px-2.5 align-top">
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
                        <td className="py-2.5 px-2 xl:px-2.5 align-top break-words">
                          {driversList.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {driversList.map((drv, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 rounded break-words"
                                >
                                  👤 {drv}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-stone-500 dark:text-stone-400 text-xs italic">Sem motorista fixo</span>
                          )}
                        </td>

                        {/* Custos Acumulados */}
                        <td className="py-2.5 px-2 xl:px-2.5 align-top">
                          <div className="font-bold text-[#000000] dark:text-stone-100 font-['Outfit'] text-xs sm:text-sm">
                            {formatCurrencyBRL(totalCost)}
                          </div>
                          <div className="text-[10px] text-[#000000] dark:text-stone-400 font-semibold">
                            Comb: {formatCurrencyBRL(totalFuel)}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-2.5 px-2 xl:px-2.5 align-top">
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
                        <td className="py-2.5 px-2 xl:px-2.5 text-right align-top">
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
            const driversList = vehicle.assignedDrivers && vehicle.assignedDrivers.length > 0
              ? vehicle.assignedDrivers
              : (vehicle.operatorOrDriver ? vehicle.operatorOrDriver.split(',').map(s => s.trim()) : []);

            const isCavalo = vehicle.compositionType === 'cavalo';
            const isReboque = vehicle.compositionType === 'reboque' || (vehicle.categoryType || '').trim().toLowerCase() === 'reboque';
            const hasCoupledTrailer = Boolean(vehicle.hasCoupledTrailer || vehicle.trailerPlate || vehicle.coupledTrailerName || vehicle.coupledTrailerId);
            const trailerPlateDisplay = vehicle.trailerPlate || (vehicle.coupledTrailerName && vehicle.coupledTrailerName.includes('-') ? vehicle.coupledTrailerName.split('-')[0].trim() : '');
            const trailerModelDisplay = vehicle.trailerModel || (vehicle.coupledTrailerName && vehicle.coupledTrailerName.includes('-') ? vehicle.coupledTrailerName.split('-').slice(1).join('-').trim() : vehicle.coupledTrailerName);
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
