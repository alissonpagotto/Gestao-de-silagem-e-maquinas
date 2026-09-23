import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Car, 
  Save, 
  Plus, 
  AlertTriangle, 
  Clock, 
  Gauge, 
  Fuel, 
  Wrench, 
  UserCheck, 
  Users, 
  Layers, 
  Info,
  DollarSign,
  Tag,
  Check,
  FileText,
  Receipt,
  Truck,
  Building,
  CreditCard,
  Link2,
  Paperclip,
  CheckCircle2,
  Calendar,
  Weight,
  Printer,
  ShieldCheck,
  Landmark,
  CheckCircle,
  HelpCircle
} from 'lucide-react';
import { Machinery, Employee, FuelLog, MaintenanceLog, Expense, ServiceOrder, SilageOrder, PaymentMethod } from '../../types';
import { 
  formatCurrencyBRL, 
  formatDateBR, 
  getStoredVehicleSystemCategories, 
  saveStoredVehicleSystemCategories,
  getStoredVehicleOwnershipRegimes,
  saveStoredVehicleOwnershipRegimes,
  getStoredCompanyProfile,
  getStoredMachineries
} from '../../lib/storage';
import { calculateVehicleConsumptionMetrics } from '../../lib/fleetMetrics';
import { VehicleCategoriesModal } from './VehicleCategoriesModal';
import { VehicleOwnershipModal } from './VehicleOwnershipModal';
import { VehicleHistoryDreTab } from './VehicleHistoryDreTab';
import { PrintPreviewModal } from '../common/PrintPreviewModal';
import { CurrencyInput } from '../common/CurrencyInput';
import { formatarMoeda, desformatarMoeda } from '../../lib/formatters';
import { PrintDocumentOptions } from '../../lib/printService';
import { 
  generateVehicleRegistrationPrintHtml, 
  generateVehicleHistoryPrintHtml 
} from './vehiclePrintTemplates';
import { IpvaInstallmentsModal, IpvaInstallmentRow } from './IpvaInstallmentsModal';
import { LicensingLaunchModal, LicensingLaunchData } from './LicensingLaunchModal';
import { 
  VehiclePurchaseInstallmentsModal, 
  VehiclePurchaseInstallmentRow,
  detectIntervalFromInstallments
} from './VehiclePurchaseInstallmentsModal';

interface VehicleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (vehicle: Machinery) => void;
  editingVehicle: Machinery | null;
  employees: Employee[];
  fuelLogs?: FuelLog[];
  maintenanceLogs?: MaintenanceLog[];
  machineries?: Machinery[];
  expenses?: Expense[];
  services?: ServiceOrder[];
  orders?: SilageOrder[];
  onAddExpense?: (expense: any) => void;
}

export const VehicleModal: React.FC<VehicleModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingVehicle,
  employees,
  fuelLogs = [],
  maintenanceLogs = [],
  machineries = [],
  expenses,
  services,
  orders,
  onAddExpense,
}) => {
  // Active Tab: 'dados' (Dados do Veículo) vs 'historico' (Histórico do Veículo)
  const [activeTab, setActiveTab] = useState<'dados' | 'historico'>('dados');

  // Form Fields - Basic Identification
  const [fleetNumber, setFleetNumber] = useState('');
  const [plate, setPlate] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [renavam, setRenavam] = useState('');
  const [color, setColor] = useState('');
  const [categoryType, setCategoryType] = useState<string>('Ensiladeira Autopropelida');
  const [categoriesList, setCategoriesList] = useState<string[]>([]);
  const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState(false);
  
  // Detalhamento específico para quando o veículo é da categoria Reboque
  const [trailerType, setTrailerType] = useState('');
  const [trailerAxlesCount, setTrailerAxlesCount] = useState('');

  const isReboqueCategory = useMemo(() => {
    const norm = (categoryType || '').trim().toLowerCase();
    return norm === 'reboque' || norm === 'transbordo / reboque / carreta';
  }, [categoryType]);

  // Validação Estrita de Número de Frota (Proibido Repetir):
  // O sistema verifica se o número digitado já existe no banco de dados para outro veículo ativo.
  const isFleetNumberDuplicate = useMemo(() => {
    const trimmed = fleetNumber.trim().toLowerCase();
    if (!trimmed) return false;
    const allVehicles = machineries && machineries.length > 0 ? machineries : getStoredMachineries();
    return allVehicles.some((m) => {
      // Ignora o próprio veículo em caso de edição
      if (editingVehicle && m.id === editingVehicle.id) return false;
      // Ignora veículos com status inativo
      if ((m as any).status === 'inativo') return false;
      const otherFleet = (m.fleetNumber || '').trim().toLowerCase();
      return otherFleet === trimmed;
    });
  }, [fleetNumber, machineries, editingVehicle]);

  const [status, setStatus] = useState<Machinery['status']>('disponivel');
  const [ownership, setOwnership] = useState<string>('Próprio');
  const [regimesList, setRegimesList] = useState<string[]>([]);
  const [isRegimesModalOpen, setIsRegimesModalOpen] = useState(false);

  useEffect(() => {
    const loadedCats = getStoredVehicleSystemCategories();
    setCategoriesList(loadedCats);
    if (!editingVehicle && loadedCats.length > 0 && (!categoryType || categoryType === 'forrageira' || categoryType === 'Forrageira / Ensiladeira')) {
      setCategoryType(loadedCats[0]);
    }

    const loadedRegimes = getStoredVehicleOwnershipRegimes();
    setRegimesList(loadedRegimes);
    if (!editingVehicle && loadedRegimes.length > 0) {
      setOwnership(loadedRegimes[0]);
    }
  }, [isOpen]);

  const handleSaveCategories = (updated: string[]) => {
    setCategoriesList(updated);
    saveStoredVehicleSystemCategories(updated);
  };

  const handleSaveRegimes = (updated: string[]) => {
    setRegimesList(updated);
    saveStoredVehicleOwnershipRegimes(updated);
  };

  // Vínculo de Reboque & Bloco Dinâmico
  const [hasCoupledTrailer, setHasCoupledTrailer] = useState(false);
  const [trailerPlate, setTrailerPlate] = useState('');
  const [trailerModel, setTrailerModel] = useState('');
  const [coupledTrailerType, setCoupledTrailerType] = useState('');
  const [trailerCapacityLoadKg, setTrailerCapacityLoadKg] = useState('');
  const [trailerCapacityM3, setTrailerCapacityM3] = useState('');
  const [compositionType, setCompositionType] = useState<Machinery['compositionType']>('veiculo_simples');
  const [coupledTrailerId, setCoupledTrailerId] = useState('');
  const [coupledTrailerName, setCoupledTrailerName] = useState('');
  const [customTrailerText, setCustomTrailerText] = useState('');
  const [vehicleTypeDetailed, setVehicleTypeDetailed] = useState('');

  // Alternar vínculo de reboque e limpar campos quando desativado
  const handleToggleCoupledTrailer = (enabled: boolean) => {
    setHasCoupledTrailer(enabled);
    if (!enabled) {
      setTrailerPlate('');
      setTrailerModel('');
      setCoupledTrailerType('');
      setTrailerCapacityLoadKg('');
      setTrailerCapacityM3('');
      setCoupledTrailerId('');
      setCoupledTrailerName('');
      setCustomTrailerText('');
    }
  };

  // Preenchimento rápido a partir de reboque existente na frota
  const handleSelectCandidateTrailer = (trailerId: string) => {
    setCoupledTrailerId(trailerId);
    if (trailerId && trailerId !== 'outro') {
      const found = candidateTrailers.find(t => t.id === trailerId);
      if (found) {
        setTrailerPlate((found.licensePlateOrSerial || '').toUpperCase());
        setTrailerModel((found.model || found.name || '').toUpperCase());
        setCoupledTrailerType(found.trailerType || '');
        if (found.capacityLoadKg) {
          setTrailerCapacityLoadKg(String(found.capacityLoadKg));
        }
        if (found.capacityM3) {
          setTrailerCapacityM3(String(found.capacityM3));
        }
        setCoupledTrailerName(`${found.licensePlateOrSerial || ''} - ${(found.model || found.name || '').toUpperCase()}`.trim());
      }
    }
  };

  // Weights & Capacity
  const [taraWeightKg, setTaraWeightKg] = useState('');
  const [capacityLoadKg, setCapacityLoadKg] = useState('');
  const [capacityM3, setCapacityM3] = useState('');
  const [fuelCapacityLiters, setFuelCapacityLiters] = useState('');
  const [hourMeter, setHourMeter] = useState('');
  const [currentKm, setCurrentKm] = useState('');

  // Serial Number (especially tractors/machines without renavam)
  const [serialNumber, setSerialNumber] = useState('');

  // Ownership Details ("No Nome de Quem")
  const [ownerName, setOwnerName] = useState('');
  const [ownerDocument, setOwnerDocument] = useState('');
  const [showSecondaryOwner, setShowSecondaryOwner] = useState(false);
  const [secondaryOwnerName, setSecondaryOwnerName] = useState('');
  const [secondaryOwnerDocument, setSecondaryOwnerDocument] = useState('');

  // Purchase & Financing
  const [purchaseValue, setPurchaseValue] = useState('');
  const [purchaseInvoiceNumber, setPurchaseInvoiceNumber] = useState('');
  const [purchaseInvoiceKey, setPurchaseInvoiceKey] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [purchaseSupplier, setPurchaseSupplier] = useState('');
  const [purchaseAttachmentName, setPurchaseAttachmentName] = useState('');
  const [isFinanced, setIsFinanced] = useState(false);
  const [installmentsCount, setInstallmentsCount] = useState('');
  const [installmentValue, setInstallmentValue] = useState('');
  const [firstInstallmentDueDate, setFirstInstallmentDueDate] = useState('');
  const [financialInstitution, setFinancialInstitution] = useState('');
  const [generatePayables, setGeneratePayables] = useState(true);
  const [installmentsCreatedFeedback, setInstallmentsCreatedFeedback] = useState(false);

  // 4. Controle Patrimonial, Impostos & Taxas (FIPE, IPVA & Licenciamento)
  const [fipeValue, setFipeValue] = useState('');
  const [ipvaBaseValue, setIpvaBaseValue] = useState('');
  const [ipvaRatePercent, setIpvaRatePercent] = useState('2'); // Default 2% (comum em veículos utilitários/caminhões/agrícola)
  const [ipvaInstallmentsCount, setIpvaInstallmentsCount] = useState('1'); // 1x até 5x
  const [licensingValue, setLicensingValue] = useState('');
  const [ipvaFinancialStatus, setIpvaFinancialStatus] = useState<'pendente' | 'lancado'>('pendente');
  const [licensingFinancialStatus, setLicensingFinancialStatus] = useState<'pendente' | 'lancado'>('pendente');
  const [ipvaLastLaunchDate, setIpvaLastLaunchDate] = useState<string>('');
  const [licensingLastLaunchDate, setLicensingLastLaunchDate] = useState<string>('');
  const [isLaunchingIpva, setIsLaunchingIpva] = useState(false);
  const [isLaunchingLicensing, setIsLaunchingLicensing] = useState(false);
  const [isIpvaInstallmentsModalOpen, setIsIpvaInstallmentsModalOpen] = useState(false);
  const [isLicensingLaunchModalOpen, setIsLicensingLaunchModalOpen] = useState(false);
  const [isPurchaseInstallmentsModalOpen, setIsPurchaseInstallmentsModalOpen] = useState(false);
  const [savedPurchaseInstallmentRows, setSavedPurchaseInstallmentRows] = useState<VehiclePurchaseInstallmentRow[]>([]);
  const [purchaseInstallmentIntervalDays, setPurchaseInstallmentIntervalDays] = useState<number | null>(null);

  // Computed IPVA Total
  const computedIpvaTotal = useMemo(() => {
    const base = desformatarMoeda(ipvaBaseValue);
    const rate = parseFloat(ipvaRatePercent) || 0;
    if (base > 0 && rate > 0) {
      return (base * (rate / 100));
    }
    return 0;
  }, [ipvaBaseValue, ipvaRatePercent]);

  // Multiple Assigned Drivers / Operators
  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>([]);
  const [driverSearchQuery, setDriverSearchQuery] = useState('');

  // Revision & Notes
  const [revisionStatus, setRevisionStatus] = useState('');
  const [notes, setNotes] = useState('');

  // Candidate trailers from machineries (reboques, carretas, implementos)
  const candidateTrailers = useMemo(() => {
    return machineries.filter(m => 
      m.id !== editingVehicle?.id && 
      (m.compositionType === 'reboque' || m.categoryType === 'reboque' || m.categoryType === 'outro')
    );
  }, [machineries, editingVehicle]);

  // Calculate real-time consumption metrics from fuel logs
  const consumptionMetrics = useMemo(() => {
    if (!editingVehicle) {
      return {
        totalLiters: 0,
        totalFuelCost: 0,
        fuelLogsCount: 0,
        avgKmPerLiter: null,
        avgLitersPerHour: null,
      };
    }
    return calculateVehicleConsumptionMetrics(editingVehicle.id, fuelLogs);
  }, [editingVehicle, fuelLogs]);

  // Vehicle specific fuel logs
  const vehicleFuelLogs = useMemo(() => {
    if (!editingVehicle) return [];
    return fuelLogs
      .filter((f) => f.machineryId === editingVehicle.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [editingVehicle, fuelLogs]);

  // Vehicle specific maintenance logs
  const vehicleMaintenanceLogs = useMemo(() => {
    if (!editingVehicle) return [];
    return maintenanceLogs
      .filter((m) => m.machineryId === editingVehicle.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [editingVehicle, maintenanceLogs]);

  // Derived launch dates for IPVA and Licensing (checks local state, vehicle object, or expenses)
  const effectiveIpvaLaunchDate = useMemo(() => {
    if (ipvaLastLaunchDate) return ipvaLastLaunchDate;
    if (editingVehicle?.ipvaLastLaunchDate) return editingVehicle.ipvaLastLaunchDate;
    if (editingVehicle && expenses && expenses.length > 0) {
      const match = expenses.find(
        (e) => e.machineryId === editingVehicle.id && 
        (e.category === 'IPVA / Impostos de Frotas' || e.description?.toUpperCase().includes('IPVA'))
      );
      if (match?.dueDate) return match.dueDate;
    }
    return '';
  }, [ipvaLastLaunchDate, editingVehicle, expenses]);

  const effectiveLicensingLaunchDate = useMemo(() => {
    if (licensingLastLaunchDate) return licensingLastLaunchDate;
    if (editingVehicle?.licensingLastLaunchDate) return editingVehicle.licensingLastLaunchDate;
    if (editingVehicle && expenses && expenses.length > 0) {
      const match = expenses.find(
        (e) => e.machineryId === editingVehicle.id && 
        (e.category === 'Licenciamento / Taxas Detran' || e.description?.toUpperCase().includes('LICENCIAMENTO'))
      );
      if (match?.dueDate) return match.dueDate;
    }
    return '';
  }, [licensingLastLaunchDate, editingVehicle, expenses]);

  // Print Modal States
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printOptions, setPrintOptions] = useState<PrintDocumentOptions | null>(null);

  // Helper to compile the active/current vehicle object (merging form fields or editingVehicle)
  const buildCurrentVehicleSnapshot = (): Machinery => {
    const formattedModel = (model.trim() || plate.trim() || fleetNumber.trim() || serialNumber.trim() || 'Veículo / Equipamento').toUpperCase();
    const formattedBrand = (brand.trim() || 'Agrícola').toUpperCase();
    const formattedName = `${formattedBrand} ${formattedModel}`.trim();

    const selectedEmpObjects = activeEmployees.filter(emp => selectedDriverIds.includes(emp.id));
    const assignedNames = selectedEmpObjects.map(emp => emp.name);
    const compiledDriverString = assignedNames.join(', ');

    let finalCoupledName: string | undefined = undefined;
    if (hasCoupledTrailer) {
      const descParts = [trailerModel.trim().toUpperCase(), coupledTrailerType.trim()].filter(Boolean);
      const trailerDesc = descParts.join(' - ');
      if (trailerPlate.trim() && trailerDesc) {
        finalCoupledName = `${trailerPlate.trim().toUpperCase()} - ${trailerDesc}`;
      } else if (trailerPlate.trim()) {
        finalCoupledName = trailerPlate.trim().toUpperCase();
      } else if (trailerDesc) {
        finalCoupledName = trailerDesc;
      } else if (coupledTrailerName.trim()) {
        finalCoupledName = coupledTrailerName.trim().toUpperCase();
      } else {
        finalCoupledName = 'Reboque vinculado';
      }
    }

    const finalKmPerLiter = consumptionMetrics.avgKmPerLiter !== null 
      ? consumptionMetrics.avgKmPerLiter 
      : editingVehicle?.averageConsumptionKmPerLiter;

    const finalLitersPerHour = consumptionMetrics.avgLitersPerHour !== null 
      ? consumptionMetrics.avgLitersPerHour 
      : editingVehicle?.averageConsumptionLitersPerHour;

    const numInstallments = parseInt(installmentsCount, 10) || 0;
    const numInstallmentVal = desformatarMoeda(installmentValue);

    return {
      id: editingVehicle ? editingVehicle.id : `veh_${Date.now()}`,
      name: formattedName,
      model: formattedModel,
      brand: formattedBrand,
      year: year ? parseInt(year, 10) : undefined,
      renavam: renavam.trim() || undefined,
      color: color.trim() || undefined,
      fleetNumber: fleetNumber.trim() || undefined,
      categoryType: categoryType || 'forrageira',
      status: status || 'disponivel',
      ownership: ownership || 'proprio',
      compositionType: hasCoupledTrailer ? 'cavalo' : compositionType,
      hasCoupledTrailer,
      trailerPlate: hasCoupledTrailer ? (trailerPlate.trim().toUpperCase() || undefined) : undefined,
      trailerModel: hasCoupledTrailer ? (trailerModel.trim().toUpperCase() || undefined) : undefined,
      coupledTrailerType: hasCoupledTrailer ? (coupledTrailerType.trim() || undefined) : undefined,
      trailerCapacityLoadKg: hasCoupledTrailer && trailerCapacityLoadKg ? parseFloat(trailerCapacityLoadKg) : undefined,
      trailerCapacityM3: hasCoupledTrailer && trailerCapacityM3 ? parseFloat(trailerCapacityM3) : undefined,
      coupledTrailerId: hasCoupledTrailer ? (coupledTrailerId || undefined) : undefined,
      coupledTrailerName: finalCoupledName,
      vehicleTypeDetailed: vehicleTypeDetailed.trim() || undefined,
      taraWeightKg: taraWeightKg ? parseFloat(taraWeightKg) : undefined,
      capacityLoadKg: capacityLoadKg ? parseFloat(capacityLoadKg) : undefined,
      grossWeightKg: computedPbt > 0 ? computedPbt : undefined,
      serialNumber: serialNumber.trim() || undefined,
      ownerName: ownerName.trim() || undefined,
      ownerDocument: ownerDocument.trim() || undefined,
      secondaryOwnerName: secondaryOwnerName.trim() || undefined,
      secondaryOwnerDocument: secondaryOwnerDocument.trim() || undefined,
      purchaseValue: purchaseValue ? desformatarMoeda(purchaseValue) : undefined,
      purchaseInvoiceNumber: purchaseInvoiceNumber.trim() || undefined,
      purchaseInvoiceKey: purchaseInvoiceKey.trim() || undefined,
      purchaseDate: purchaseDate || undefined,
      purchaseSupplier: purchaseSupplier.trim() || undefined,
      purchaseInvoiceAttachment: purchaseAttachmentName ? { name: purchaseAttachmentName, uploadedAt: new Date().toISOString() } : undefined,
      isFinancedOrInstallments: isFinanced,
      installmentsCount: isFinanced && numInstallments > 0 ? numInstallments : undefined,
      installmentValue: isFinanced && numInstallmentVal > 0 ? numInstallmentVal : undefined,
      firstInstallmentDueDate: isFinanced ? firstInstallmentDueDate : undefined,
      financialInstitution: isFinanced ? financialInstitution.trim() : undefined,
      // 4. Controle Patrimonial, Impostos & Taxas
      fipeValue: fipeValue ? desformatarMoeda(fipeValue) : undefined,
      ipvaBaseValue: ipvaBaseValue ? desformatarMoeda(ipvaBaseValue) : undefined,
      ipvaRatePercent: ipvaRatePercent ? parseFloat(ipvaRatePercent) : undefined,
      ipvaTotalAmount: computedIpvaTotal > 0 ? computedIpvaTotal : undefined,
      ipvaInstallmentsCount: ipvaInstallmentsCount ? parseInt(ipvaInstallmentsCount, 10) : undefined,
      ipvaFinancialStatus,
      ipvaLastLaunchDate: effectiveIpvaLaunchDate || undefined,
      licensingValue: licensingValue ? desformatarMoeda(licensingValue) : undefined,
      licensingFinancialStatus,
      licensingLastLaunchDate: effectiveLicensingLaunchDate || undefined,
      capacityM3: capacityM3 ? parseFloat(capacityM3) : undefined,
      fuelCapacityLiters: fuelCapacityLiters ? parseFloat(fuelCapacityLiters) : undefined,
      tank_capacity: fuelCapacityLiters ? parseFloat(fuelCapacityLiters) : undefined,
      tankCapacity: fuelCapacityLiters ? parseFloat(fuelCapacityLiters) : undefined,
      licensePlateOrSerial: (plate.trim() || serialNumber.trim() || fleetNumber.trim()).toUpperCase(),
      hourMeter: hourMeter ? parseFloat(hourMeter) : (editingVehicle?.hourMeter || 0),
      currentKm: currentKm ? parseFloat(currentKm) : (editingVehicle?.currentKm || undefined),
      averageConsumptionKmPerLiter: finalKmPerLiter,
      averageConsumptionLitersPerHour: finalLitersPerHour,
      operatorOrDriver: compiledDriverString,
      assignedDriverIds: selectedDriverIds,
      assignedDrivers: assignedNames,
      revisionStatus: revisionStatus.trim() || 'Em dia',
      notes: notes.trim() || undefined,
      reaisNotes: notes.trim() || undefined,
      accumulatedCost: editingVehicle ? editingVehicle.accumulatedCost : 0,
      totalFuelExpenses: editingVehicle?.totalFuelExpenses || 0,
      totalMaintenanceExpenses: editingVehicle?.totalMaintenanceExpenses || 0,
      lastMaintenanceDate: editingVehicle?.lastMaintenanceDate || new Date().toISOString().split('T')[0],
      currentFuelPercentage: editingVehicle?.currentFuelPercentage || 100,
    };
  };

  // Handler for "Imprimir Cadastro"
  const handlePrintCadastro = () => {
    const currentVehicle = buildCurrentVehicleSnapshot();
    const company = getStoredCompanyProfile();

    const selectedEmpObjects = activeEmployees.filter(emp => selectedDriverIds.includes(emp.id));
    const assignedNames = selectedEmpObjects.map(emp => emp.name);

    const vehicleTitle = currentVehicle.fleetNumber 
      ? `FROTA Nº ${currentVehicle.fleetNumber} - ${currentVehicle.name || currentVehicle.model}`
      : `${currentVehicle.name || currentVehicle.model}`;

    const subtitle = `Placa/Série: ${currentVehicle.licensePlateOrSerial || '--'} | Categoria: ${currentVehicle.categoryType || 'Equipamento'} | Regime: ${currentVehicle.ownership || 'Próprio'}`;

    const contentHtml = generateVehicleRegistrationPrintHtml(currentVehicle, company, assignedNames);

    setPrintOptions({
      company,
      title: `FICHA CADASTRAL DO VEÍCULO / MÁQUINA`,
      subtitle: `${vehicleTitle} — ${subtitle}`,
      documentType: 'CADASTRO DE VEÍCULO',
      contentHtml,
      showSignatures: true,
      signatureLabels: ['Responsável pela Frota / Operação', 'Diretoria / Gerência Geral'],
      whatsappText: `🚜 *${company.tradeName?.toUpperCase() || 'SILAGEM ZÉ BUSCA-PÉ'}*\n📋 *FICHA CADASTRAL DO VEÍCULO*\n🚛 *Veículo:* ${vehicleTitle}\n🔢 *Placa/Série:* ${currentVehicle.licensePlateOrSerial || '--'}\n⚙️ *Status:* ${currentVehicle.status?.toUpperCase() || 'DISPONÍVEL'}\n\n_Documento gerado via Silagem Fácil Pro_`,
    });
    setIsPrintModalOpen(true);
  };

  // Handler for "Imprimir Histórico"
  const handlePrintHistorico = () => {
    const currentVehicle = buildCurrentVehicleSnapshot();
    const company = getStoredCompanyProfile();

    const vehicleTitle = currentVehicle.fleetNumber 
      ? `FROTA Nº ${currentVehicle.fleetNumber} - ${currentVehicle.name || currentVehicle.model}`
      : `${currentVehicle.name || currentVehicle.model}`;

    const subtitle = `Placa/Série: ${currentVehicle.licensePlateOrSerial || '--'} | Relatório Consolidado de Consumo, Manutenções & DRE`;

    const contentHtml = generateVehicleHistoryPrintHtml(
      currentVehicle,
      company,
      fuelLogs,
      maintenanceLogs,
      expenses,
      services,
      orders,
      employees
    );

    setPrintOptions({
      company,
      title: `RELATÓRIO HISTÓRICO, CONSUMO & DRE OPERACIONAL`,
      subtitle: `${vehicleTitle} — ${subtitle}`,
      documentType: 'HISTÓRICO & DRE DO VEÍCULO',
      contentHtml,
      showSignatures: true,
      signatureLabels: ['Encarregado de Manutenção / Abastecimento', 'Controladoria / Gestão Financeira'],
      whatsappText: `🚜 *${company.tradeName?.toUpperCase() || 'SILAGEM ZÉ BUSCA-PÉ'}*\n📊 *RELATÓRIO DE HISTÓRICO & DRE DO VEÍCULO*\n🚛 *Veículo:* ${vehicleTitle}\n🔢 *Placa/Série:* ${currentVehicle.licensePlateOrSerial || '--'}\n\n_Relatório consolidado via Silagem Fácil Pro_`,
    });
    setIsPrintModalOpen(true);
  };

  useEffect(() => {
    if (editingVehicle) {
      setFleetNumber(editingVehicle.fleetNumber || '');
      setPlate(editingVehicle.licensePlateOrSerial || '');
      setBrand((editingVehicle.brand || '').toUpperCase());
      setModel((editingVehicle.model || '').toUpperCase());
      setYear(editingVehicle.year ? String(editingVehicle.year) : '');
      setRenavam(editingVehicle.renavam || '');
      setColor(editingVehicle.color || '');
      const categoryMap: Record<string, string> = {
        forrageira: 'Ensiladeira Autopropelida',
        ensiladeira: 'Ensiladeira Autopropelida',
        caminhao: 'Caminhão (Basculante / Graneleiro)',
        trator: 'Trator Agrícola',
        reboque: 'Reboque',
        utilitario: 'Veículo Utilitário / Apoio',
        onibus: 'Ônibus / Van de Equipe',
        cavalo: 'Tração Caminhão Trator (Cavalo)',
        implemento: 'Implemento',
        outro: 'Outro Equipamento',
      };
      setCategoryType(
        editingVehicle.categoryType
          ? (categoryMap[editingVehicle.categoryType] || editingVehicle.categoryType)
          : (categoriesList[0] || 'Ensiladeira Autopropelida')
      );
      setStatus(editingVehicle.status || 'disponivel');
      const ownershipMap: Record<string, string> = {
        proprio: 'Próprio',
        terceirizado: 'De Terceiros',
        alugado: 'Alugado / Locação',
        arrendado: 'Arrendado / Financiado'
      };
      setOwnership(
        editingVehicle.ownership
          ? (ownershipMap[editingVehicle.ownership] || editingVehicle.ownership)
          : 'Próprio'
      );
      
      // Vínculo de Reboque & Composição
      const hasTrailer = Boolean(
        editingVehicle.hasCoupledTrailer ||
        editingVehicle.trailerPlate ||
        editingVehicle.trailerModel ||
        editingVehicle.coupledTrailerId ||
        editingVehicle.coupledTrailerName
      );
      setHasCoupledTrailer(hasTrailer);
      setTrailerPlate((editingVehicle.trailerPlate || '').toUpperCase());
      setTrailerModel((editingVehicle.trailerModel || '').toUpperCase());
      setCoupledTrailerType(editingVehicle.coupledTrailerType || '');
      setTrailerCapacityLoadKg(editingVehicle.trailerCapacityLoadKg !== undefined ? String(editingVehicle.trailerCapacityLoadKg) : '');
      setTrailerCapacityM3(editingVehicle.trailerCapacityM3 !== undefined ? String(editingVehicle.trailerCapacityM3) : '');
      setCompositionType(editingVehicle.compositionType || 'veiculo_simples');
      setCoupledTrailerId(editingVehicle.coupledTrailerId || '');
      setCoupledTrailerName(editingVehicle.coupledTrailerName || '');
      setCustomTrailerText('');
      setVehicleTypeDetailed(editingVehicle.vehicleTypeDetailed || '');

      // Detalhes específicos de Reboque
      setTrailerType(editingVehicle.trailerType || editingVehicle.trailerModel || '');
      setTrailerAxlesCount(editingVehicle.trailerAxlesCount !== undefined ? String(editingVehicle.trailerAxlesCount) : '');

      // Se for da categoria Reboque, desativa vínculo de reboque acoplado
      const isReboqueEdit = (editingVehicle.categoryType || '').trim().toLowerCase() === 'reboque' || (editingVehicle.categoryType || '').trim().toLowerCase() === 'transbordo / reboque / carreta';
      if (isReboqueEdit) {
        setHasCoupledTrailer(false);
        setCompositionType('reboque');
      }

      // Weights & capacities
      setTaraWeightKg(editingVehicle.taraWeightKg ? String(editingVehicle.taraWeightKg) : '');
      setCapacityLoadKg(editingVehicle.capacityLoadKg ? String(editingVehicle.capacityLoadKg) : '');
      setCapacityM3(editingVehicle.capacityM3 !== undefined ? String(editingVehicle.capacityM3) : '');
      const initialTank = (editingVehicle as any).tank_capacity ?? (editingVehicle as any).tankCapacity ?? editingVehicle.fuelCapacityLiters;
      setFuelCapacityLiters(initialTank !== undefined && initialTank !== null ? String(initialTank) : '');
      setHourMeter(editingVehicle.hourMeter !== undefined ? String(editingVehicle.hourMeter) : '');
      setCurrentKm(editingVehicle.currentKm !== undefined ? String(editingVehicle.currentKm) : '');

      // Serial
      setSerialNumber(editingVehicle.serialNumber || '');

      // Owner details
      setOwnerName(editingVehicle.ownerName || '');
      setOwnerDocument(editingVehicle.ownerDocument || '');
      setSecondaryOwnerName(editingVehicle.secondaryOwnerName || '');
      setSecondaryOwnerDocument(editingVehicle.secondaryOwnerDocument || '');
      setShowSecondaryOwner(Boolean(editingVehicle.secondaryOwnerName || editingVehicle.secondaryOwnerDocument));

      // Purchase & Financing
      setPurchaseValue(editingVehicle.purchaseValue ? formatarMoeda(Math.round(editingVehicle.purchaseValue * 100)) : '');
      setPurchaseInvoiceNumber(editingVehicle.purchaseInvoiceNumber || '');
      setPurchaseInvoiceKey(editingVehicle.purchaseInvoiceKey || '');
      setPurchaseDate(editingVehicle.purchaseDate || '');
      setPurchaseSupplier(editingVehicle.purchaseSupplier || '');
      setPurchaseAttachmentName(editingVehicle.purchaseInvoiceAttachment?.name || '');
      setIsFinanced(Boolean(editingVehicle.isFinancedOrInstallments));
      setInstallmentsCount(editingVehicle.installmentsCount ? String(editingVehicle.installmentsCount) : '');
      setInstallmentValue(editingVehicle.installmentValue ? formatarMoeda(Math.round(editingVehicle.installmentValue * 100)) : '');
      setFirstInstallmentDueDate(editingVehicle.firstInstallmentDueDate || '');
      setFinancialInstitution(editingVehicle.financialInstitution || '');
      setGeneratePayables(!editingVehicle.installmentsGenerated);

      // Carrega parcelas gravadas no veículo ou vinculadas no Contas a Pagar
      let loadedInstallments: VehiclePurchaseInstallmentRow[] = [];
      if (editingVehicle.purchaseInstallmentRows && editingVehicle.purchaseInstallmentRows.length > 0) {
        loadedInstallments = editingVehicle.purchaseInstallmentRows;
      } else if (expenses && expenses.length > 0) {
        const matched = expenses.filter(e => 
          e.machineryId === editingVehicle.id && 
          (e.category === 'Financiamento de Veículos / Frotas' || e.description?.includes('Compra/Financiamento') || e.description?.includes('Financiamento'))
        ).sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));

        if (matched.length > 0) {
          loadedInstallments = matched.map((exp, idx) => {
            const match = exp.description.match(/Parcela\s+(\d+)/i);
            const num = match ? match[1].padStart(2, '0') : String(idx + 1).padStart(2, '0');
            return {
              id: exp.id || `vinst_${idx}`,
              number: num,
              amount: exp.amount,
              daysInterval: 0,
              dueDate: exp.dueDate,
              paymentMethodCode: '04',
              paymentMethodLabel: '04 - Financiamento Bancário / CDC',
              creditAccount: '2.1.2.01 - Financiamentos Bancários a Pagar',
              debitAccount: '1.2.3.01 - Ativo Imobilizado: Veículos da Frota',
              observations: exp.notes || exp.description,
              documentFileUrl: exp.receiptUrl,
              documentFileName: exp.receiptName,
            };
          });
        }
      }

      setSavedPurchaseInstallmentRows(loadedInstallments);
      const effectiveInterval = editingVehicle.purchaseInstallmentIntervalDays ?? detectIntervalFromInstallments(loadedInstallments);
      setPurchaseInstallmentIntervalDays(effectiveInterval);
      
      // 4. Controle Patrimonial, Impostos & Taxas
      setFipeValue(editingVehicle.fipeValue !== undefined ? formatarMoeda(Math.round(editingVehicle.fipeValue * 100)) : '');
      setIpvaBaseValue(editingVehicle.ipvaBaseValue !== undefined ? formatarMoeda(Math.round(editingVehicle.ipvaBaseValue * 100)) : '');
      setIpvaRatePercent(editingVehicle.ipvaRatePercent !== undefined ? String(editingVehicle.ipvaRatePercent) : '2');
      setIpvaInstallmentsCount(editingVehicle.ipvaInstallmentsCount ? String(editingVehicle.ipvaInstallmentsCount) : '1');
      setLicensingValue(editingVehicle.licensingValue !== undefined ? formatarMoeda(Math.round(editingVehicle.licensingValue * 100)) : '');
      setIpvaFinancialStatus(editingVehicle.ipvaFinancialStatus || 'pendente');
      setLicensingFinancialStatus(editingVehicle.licensingFinancialStatus || 'pendente');
      setIpvaLastLaunchDate(editingVehicle.ipvaLastLaunchDate || '');
      setLicensingLastLaunchDate(editingVehicle.licensingLastLaunchDate || '');
      
      // Drivers
      if (editingVehicle.assignedDriverIds && editingVehicle.assignedDriverIds.length > 0) {
        setSelectedDriverIds(editingVehicle.assignedDriverIds);
      } else if (editingVehicle.operatorOrDriver) {
        const existingNames = editingVehicle.operatorOrDriver.split(',').map(s => s.trim().toLowerCase());
        const matchedIds = employees
          .filter(emp => existingNames.includes(emp.name.toLowerCase()))
          .map(emp => emp.id);
        setSelectedDriverIds(matchedIds);
      } else {
        setSelectedDriverIds([]);
      }

      setRevisionStatus(editingVehicle.revisionStatus || 'Em dia');
      setNotes(editingVehicle.notes || editingVehicle.reaisNotes || '');
      setActiveTab('dados');
    } else {
      // Defaults for new vehicle
      setFleetNumber('');
      setPlate('');
      setBrand('');
      setModel('');
      setYear(new Date().getFullYear().toString());
      setRenavam('');
      setColor('');
      setCategoryType(categoriesList[0] || 'Ensiladeira Autopropelida');
      setStatus('disponivel');
      setOwnership('proprio');

      setHasCoupledTrailer(false);
      setTrailerPlate('');
      setTrailerModel('');
      setCoupledTrailerType('');
      setTrailerCapacityLoadKg('');
      setTrailerCapacityM3('');
      setCompositionType('veiculo_simples');
      setCoupledTrailerId('');
      setCoupledTrailerName('');
      setCustomTrailerText('');
      setVehicleTypeDetailed('');

      setTrailerType('');
      setTrailerAxlesCount('');

      setTaraWeightKg('');
      setCapacityLoadKg('');
      setCapacityM3('');
      setFuelCapacityLiters('');
      setHourMeter('');
      setCurrentKm('');

      setSerialNumber('');

      setOwnerName('');
      setOwnerDocument('');
      setSecondaryOwnerName('');
      setSecondaryOwnerDocument('');
      setShowSecondaryOwner(false);

      setPurchaseValue('');
      setPurchaseInvoiceNumber('');
      setPurchaseInvoiceKey('');
      setPurchaseDate(new Date().toISOString().split('T')[0]);
      setPurchaseSupplier('');
      setPurchaseAttachmentName('');
      setIsFinanced(false);
      setInstallmentsCount('');
      setInstallmentValue('');
      setFirstInstallmentDueDate('');
      setFinancialInstitution('');
      setGeneratePayables(true);
      setInstallmentsCreatedFeedback(false);
      setSavedPurchaseInstallmentRows([]);
      setPurchaseInstallmentIntervalDays(null);

      // 4. Controle Patrimonial, Impostos & Taxas
      setFipeValue('');
      setIpvaBaseValue('');
      setIpvaRatePercent('2');
      setIpvaInstallmentsCount('1');
      setLicensingValue('');
      setIpvaFinancialStatus('pendente');
      setLicensingFinancialStatus('pendente');
      setIpvaLastLaunchDate('');
      setLicensingLastLaunchDate('');
      setIsLaunchingIpva(false);
      setIsLaunchingLicensing(false);

      setSelectedDriverIds([]);
      setRevisionStatus('Em dia');
      setNotes('');
      setActiveTab('dados');
    }
  }, [editingVehicle, isOpen, employees, expenses]);

  // Active employees available for driver/operator assignment
  const activeEmployees = useMemo(() => {
    return employees.filter(e => e.status !== 'inativo');
  }, [employees]);

  // Filtered employees by search
  const filteredEmployeeSuggestions = useMemo(() => {
    if (!driverSearchQuery.trim()) return [];
    return activeEmployees.filter(emp => 
      !selectedDriverIds.includes(emp.id) &&
      (emp.name.toLowerCase().includes(driverSearchQuery.toLowerCase()) ||
       emp.role.toLowerCase().includes(driverSearchQuery.toLowerCase()))
    );
  }, [activeEmployees, selectedDriverIds, driverSearchQuery]);

  const handleToggleDriver = (empId: string) => {
    if (selectedDriverIds.includes(empId)) {
      setSelectedDriverIds(selectedDriverIds.filter(id => id !== empId));
    } else {
      setSelectedDriverIds([...selectedDriverIds, empId]);
      setDriverSearchQuery('');
    }
  };

  const handleRemoveDriver = (empId: string) => {
    setSelectedDriverIds(selectedDriverIds.filter(id => id !== empId));
  };

  // Helper for PBT calculation
  const computedPbt = useMemo(() => {
    const tara = parseFloat(taraWeightKg) || 0;
    const lotacao = parseFloat(capacityLoadKg) || 0;
    return tara + lotacao;
  }, [taraWeightKg, capacityLoadKg]);

  // Suggest installment value if purchaseValue and count are entered
  const handleInstallmentsCountChange = (val: string) => {
    setInstallmentsCount(val);
    const count = parseInt(val, 10);
    const totalP = desformatarMoeda(purchaseValue);
    if (count > 0 && totalP > 0 && !installmentValue) {
      setInstallmentValue(formatarMoeda(Math.round((totalP / count) * 100)));
    }
  };

  // File upload simulation for purchase invoice
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPurchaseAttachmentName(file.name);
    }
  };

  // Abrir Modal de Parcelas Geradas para IPVA
  const handleLaunchIpva = () => {
    if (computedIpvaTotal <= 0) {
      alert('Informe o Valor Base Venal e a Alíquota do IPVA para calcular o valor antes de lançar.');
      return;
    }
    setIsIpvaInstallmentsModalOpen(true);
  };

  // Gravar Lançamentos das Parcelas do IPVA diretamente no Contas a Pagar
  const handleConfirmIpvaInstallments = (installments: IpvaInstallmentRow[]) => {
    if (!onAddExpense) {
      alert('Módulo financeiro indisponível para lançamento direto.');
      return;
    }

    const vName = `${brand.trim() || 'Veículo'} ${model.trim() || plate.trim() || 'Frota'}`.trim();
    const vIdentifier = (plate.trim() || serialNumber.trim() || fleetNumber.trim() || 'S/N').toUpperCase();
    const today = new Date();
    const currentYear = year ? parseInt(year, 10) : today.getFullYear();
    const vehicleId = editingVehicle?.id || `veh_${Date.now()}`;
    const totalLines = installments.length;

    installments.forEach((inst) => {
      const totalAmountWithInterest = Math.round((inst.amount + (inst.interest || 0)) * 100) / 100;
      const desc = totalLines > 1
        ? `IPVA ${currentYear} - Parcela ${inst.number}/${String(totalLines).padStart(2, '0')} - ${vName} (${vIdentifier})`
        : `IPVA ${currentYear} (Cota Única) - ${vName} (${vIdentifier})`;

      let notesText = inst.observations.trim();
      if (inst.interest > 0) {
        notesText += ` (Valor Base: R$ ${inst.amount.toFixed(2)} + Encargos/Juros: R$ ${inst.interest.toFixed(2)})`;
      }
      notesText += ` • Veículo: ${vName} (${vIdentifier}) • Exercício: ${currentYear}`;

      onAddExpense({
        description: desc,
        amount: totalAmountWithInterest,
        category: 'IPVA / Impostos de Frotas',
        dueDate: inst.dueDate,
        status: 'pendente',
        paymentMethod: 'boleto',
        supplier: 'SEFAZ / Detran - Secretaria da Fazenda',
        machineryId: vehicleId,
        machineryName: vName,
        notes: notesText,
      });
    });

    setIpvaFinancialStatus('lancado');
    setIpvaLastLaunchDate(today.toISOString().split('T')[0]);
    setIpvaInstallmentsCount(String(totalLines));
    setIsLaunchingIpva(true);
    setTimeout(() => setIsLaunchingIpva(false), 3000);
  };

  // Abrir modal de confirmação para Lançamento do Licenciamento (CRLV)
  const handleLaunchLicensing = () => {
    setIsLicensingLaunchModalOpen(true);
  };

  // Gravar Lançamento do Licenciamento diretamente no Contas a Pagar
  const handleConfirmLicensing = (data: LicensingLaunchData) => {
    if (!onAddExpense) {
      alert('Módulo financeiro indisponível para lançamento direto.');
      return;
    }

    const vName = `${brand.trim() || 'Veículo'} ${model.trim() || plate.trim() || 'Frota'}`.trim();
    const vIdentifier = (plate.trim() || serialNumber.trim() || fleetNumber.trim() || 'S/N').toUpperCase();
    const today = new Date();
    const currentYear = year ? parseInt(year, 10) : today.getFullYear();
    const vehicleId = editingVehicle?.id || `veh_${Date.now()}`;

    let notesText = data.observations?.trim() || `Taxa anual de licenciamento CRLV exercício ${currentYear} para o veículo ${vName} (${vIdentifier}).`;
    if (data.interestAmount > 0) {
      notesText += ` (Valor Base: R$ ${data.baseAmount.toFixed(2)} + Juros/Encargos: R$ ${data.interestAmount.toFixed(2)} = Total: R$ ${data.totalAmount.toFixed(2)})`;
    }

    onAddExpense({
      description: `Taxa de Licenciamento Anual ${currentYear} - ${vName} (${vIdentifier})`,
      amount: data.totalAmount,
      category: 'Licenciamento / Taxas Detran',
      dueDate: data.dueDate,
      status: 'pendente',
      paymentMethod: 'boleto',
      supplier: 'Detran - Departamento Estadual de Trânsito',
      machineryId: vehicleId,
      machineryName: vName,
      notes: notesText,
    });

    // Atualiza estado instantâneo para verde de sucesso
    setLicensingFinancialStatus('lancado');
    const todayStr = today.toISOString().split('T')[0];
    setLicensingLastLaunchDate(todayStr);
    if (data.baseAmount > 0) {
      setLicensingValue(formatarMoeda(Math.round(data.baseAmount * 100)));
    }
    setIsLaunchingLicensing(true);
    setTimeout(() => setIsLaunchingLicensing(false), 3000);
  };

  // Abrir Modal de Parcelas Geradas para Compra / Financiamento
  const handleOpenPurchaseInstallmentsModal = () => {
    const numVal = purchaseValue ? desformatarMoeda(purchaseValue) : 0;
    if (numVal <= 0) {
      alert('Por favor, preencha o "Valor de Compra (R$)" na seção Aquisição antes de abrir as parcelas.');
      return;
    }
    setIsPurchaseInstallmentsModalOpen(true);
  };

  // Gravar Lançamentos das Parcelas de Compra / Financiamento diretamente no Contas a Pagar
  const handleConfirmPurchaseInstallments = (
    instList: VehiclePurchaseInstallmentRow[],
    intervalDays: number | null = null
  ) => {
    if (!onAddExpense) {
      alert('Módulo financeiro indisponível para lançamento direto.');
      return;
    }

    const vName = `${brand.trim() || 'Veículo'} ${model.trim() || plate.trim() || 'Frota'}`.trim();
    const vIdentifier = (plate.trim() || serialNumber.trim() || fleetNumber.trim() || 'S/N').toUpperCase();
    const vehicleId = editingVehicle?.id || `veh_${Date.now()}`;
    const totalLines = instList.length;

    const installmentExpenses = instList.map((inst, idx) => {
      const desc = totalLines > 1
        ? `Parcela ${inst.number}/${String(totalLines).padStart(2, '0')} - Compra/Financiamento ${vName} (${vIdentifier})`
        : `Compra/Financiamento (Quitação) - ${vName} (${vIdentifier})`;

      let notesText = inst.observations.trim();
      notesText += ` [Contábil - Crédito: ${inst.creditAccount || 'N/A'} | Débito: ${inst.debitAccount || 'N/A'}]`;
      if (inst.daysInterval > 0) {
        notesText += ` • Prazo: ${inst.daysInterval} dias`;
      }
      notesText += ` • Veículo: ${vName} (${vIdentifier})`;
      if (purchaseInvoiceNumber.trim()) {
        notesText += ` • NF: ${purchaseInvoiceNumber.trim()}`;
      }

      let payMethod: PaymentMethod = 'boleto';
      if (inst.paymentMethodCode === '02') payMethod = 'pix';
      else if (inst.paymentMethodCode === '03') payMethod = 'transferencia';
      else if (inst.paymentMethodCode === '06') payMethod = 'cartao_credito';
      else if (inst.paymentMethodCode === '07') payMethod = 'safra_prazo';

      const instId = totalLines > 1 ? `exp_compra_${vehicleId}_parc_${idx + 1}` : `exp_compra_${vehicleId}`;

      return {
        id: instId,
        description: desc,
        amount: Number(inst.amount) || 0,
        category: 'Financiamento de Veículos / Frotas',
        dueDate: inst.dueDate,
        status: 'pendente' as const,
        paymentMethod: payMethod,
        supplier: financialInstitution.trim() || purchaseSupplier.trim() || ownerName.trim() || 'Banco / Concessionária',
        invoiceNumber: purchaseInvoiceNumber.trim() || undefined,
        machineryId: vehicleId,
        machineryName: vName,
        notes: notesText,
        receiptUrl: inst.documentFileUrl || undefined,
      };
    });

    onAddExpense(installmentExpenses);

    setSavedPurchaseInstallmentRows(instList);
    setPurchaseInstallmentIntervalDays(intervalDays);
    setInstallmentsCount(String(totalLines));
    if (instList[0]) {
      setInstallmentValue(formatarMoeda(Math.round(instList[0].amount * 100)));
      setFirstInstallmentDueDate(instList[0].dueDate);
    }
    setGeneratePayables(false); // Já lançou individualmente pelo modal
    setIsFinanced(true);
    setInstallmentsCreatedFeedback(true);
    setTimeout(() => setInstallmentsCreatedFeedback(false), 4000);
    setIsPurchaseInstallmentsModalOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isFleetNumberDuplicate) {
      alert('Este número de frota já está cadastrado em outro veículo. Escolha um número exclusivo.');
      return;
    }
    if (!plate.trim() && !serialNumber.trim() && !fleetNumber.trim()) {
      alert('Por favor, informe ao menos a Placa, o Nº de Série ou o Nº da Frota do veículo.');
      return;
    }

    const formattedModel = (model.trim() || plate.trim() || fleetNumber.trim() || serialNumber.trim()).toUpperCase();
    const formattedBrand = (brand.trim() || 'Agrícola').toUpperCase();
    const formattedName = `${formattedBrand} ${formattedModel}`.trim();

    // Compile driver names
    const selectedEmpObjects = activeEmployees.filter(emp => selectedDriverIds.includes(emp.id));
    const assignedNames = selectedEmpObjects.map(emp => emp.name);
    const compiledDriverString = assignedNames.join(', ');

    // Coupled trailer logic
    let finalCoupledId: string | undefined = undefined;
    let finalCoupledName: string | undefined = undefined;
    if (hasCoupledTrailer) {
      finalCoupledId = coupledTrailerId || undefined;
      const descParts = [trailerModel.trim(), coupledTrailerType.trim()].filter(Boolean);
      const trailerDesc = descParts.join(' - ');
      if (trailerPlate.trim() && trailerDesc) {
        finalCoupledName = `${trailerPlate.trim().toUpperCase()} - ${trailerDesc}`;
      } else if (trailerPlate.trim()) {
        finalCoupledName = trailerPlate.trim().toUpperCase();
      } else if (trailerDesc) {
        finalCoupledName = trailerDesc;
      } else if (coupledTrailerName.trim()) {
        finalCoupledName = coupledTrailerName.trim();
      } else {
        finalCoupledName = 'Reboque vinculado';
      }
    }

    // Use automatically calculated consumption or preserve existing
    const finalKmPerLiter = consumptionMetrics.avgKmPerLiter !== null 
      ? consumptionMetrics.avgKmPerLiter 
      : editingVehicle?.averageConsumptionKmPerLiter;

    const finalLitersPerHour = consumptionMetrics.avgLitersPerHour !== null 
      ? consumptionMetrics.avgLitersPerHour 
      : editingVehicle?.averageConsumptionLitersPerHour;

    const numInstallments = parseInt(installmentsCount, 10) || 0;
    const numInstallmentVal = desformatarMoeda(installmentValue);

    const willGenerateInstallments = Boolean(
      isFinanced && 
      generatePayables && 
      numInstallments > 0 && 
      numInstallmentVal > 0 && 
      onAddExpense && 
      !editingVehicle?.installmentsGenerated
    );

    const vehicleData: Machinery = {
      id: editingVehicle ? editingVehicle.id : `veh_${Date.now()}`,
      name: formattedName,
      model: formattedModel,
      brand: formattedBrand,
      year: year ? parseInt(year, 10) : undefined,
      renavam: renavam.trim() || undefined,
      color: color.trim() || undefined,
      fleetNumber: fleetNumber.trim() || undefined,
      categoryType: categoryType || 'forrageira',
      status: status || 'disponivel',
      ownership: ownership || 'proprio',
      
      // Vínculo de Reboque
      hasCoupledTrailer: isReboqueCategory ? false : hasCoupledTrailer,
      trailerPlate: !isReboqueCategory && hasCoupledTrailer ? (trailerPlate.trim().toUpperCase() || undefined) : undefined,
      trailerModel: !isReboqueCategory && hasCoupledTrailer ? (trailerModel.trim().toUpperCase() || undefined) : undefined,
      coupledTrailerType: !isReboqueCategory && hasCoupledTrailer ? (coupledTrailerType.trim() || undefined) : undefined,
      trailerCapacityLoadKg: !isReboqueCategory && hasCoupledTrailer && trailerCapacityLoadKg ? parseFloat(trailerCapacityLoadKg) : undefined,
      trailerCapacityM3: !isReboqueCategory && hasCoupledTrailer && trailerCapacityM3 ? parseFloat(trailerCapacityM3) : undefined,
      compositionType: isReboqueCategory ? 'reboque' : (hasCoupledTrailer ? 'cavalo' : compositionType),
      coupledTrailerId: !isReboqueCategory && hasCoupledTrailer ? finalCoupledId : undefined,
      coupledTrailerName: !isReboqueCategory && hasCoupledTrailer ? finalCoupledName : undefined,
      vehicleTypeDetailed: vehicleTypeDetailed.trim() || undefined,

      // Dados específicos de Reboque (quando Categoria = Reboque)
      trailerType: isReboqueCategory ? (trailerType.trim() || undefined) : undefined,
      trailerAxlesCount: isReboqueCategory && trailerAxlesCount ? parseInt(trailerAxlesCount, 10) : undefined,

      // Weights
      taraWeightKg: taraWeightKg ? parseFloat(taraWeightKg) : undefined,
      capacityLoadKg: capacityLoadKg ? parseFloat(capacityLoadKg) : undefined,
      grossWeightKg: computedPbt > 0 ? computedPbt : undefined,

      // Serial
      serialNumber: serialNumber.trim() || undefined,

      // Ownership ("No nome de quem")
      ownerName: ownerName.trim() || undefined,
      ownerDocument: ownerDocument.trim() || undefined,
      secondaryOwnerName: secondaryOwnerName.trim() || undefined,
      secondaryOwnerDocument: secondaryOwnerDocument.trim() || undefined,

      // Purchase & Financing
      purchaseValue: purchaseValue ? desformatarMoeda(purchaseValue) : undefined,
      purchaseInvoiceNumber: purchaseInvoiceNumber.trim() || undefined,
      purchaseInvoiceKey: purchaseInvoiceKey.trim() || undefined,
      purchaseDate: purchaseDate || undefined,
      purchaseSupplier: purchaseSupplier.trim() || undefined,
      purchaseInvoiceAttachment: purchaseAttachmentName ? { name: purchaseAttachmentName, uploadedAt: new Date().toISOString() } : undefined,
      isFinancedOrInstallments: isFinanced,
      installmentsCount: isFinanced && numInstallments > 0 ? numInstallments : undefined,
      installmentValue: isFinanced && numInstallmentVal > 0 ? numInstallmentVal : undefined,
      firstInstallmentDueDate: isFinanced ? firstInstallmentDueDate : undefined,
      financialInstitution: isFinanced ? financialInstitution.trim() : undefined,
      installmentsGenerated: editingVehicle?.installmentsGenerated || willGenerateInstallments,
      purchaseInstallmentRows: savedPurchaseInstallmentRows.length > 0 
        ? savedPurchaseInstallmentRows 
        : (editingVehicle?.purchaseInstallmentRows || undefined),
      purchaseInstallmentIntervalDays: purchaseInstallmentIntervalDays !== null 
        ? purchaseInstallmentIntervalDays 
        : (editingVehicle?.purchaseInstallmentIntervalDays || undefined),

      // 4. Controle Patrimonial, Impostos & Taxas
      fipeValue: fipeValue ? desformatarMoeda(fipeValue) : undefined,
      ipvaBaseValue: ipvaBaseValue ? desformatarMoeda(ipvaBaseValue) : undefined,
      ipvaRatePercent: ipvaRatePercent ? parseFloat(ipvaRatePercent) : undefined,
      ipvaTotalAmount: computedIpvaTotal > 0 ? computedIpvaTotal : undefined,
      ipvaInstallmentsCount: ipvaInstallmentsCount ? parseInt(ipvaInstallmentsCount, 10) : undefined,
      ipvaFinancialStatus,
      ipvaLastLaunchDate: effectiveIpvaLaunchDate || undefined,
      licensingValue: licensingValue ? desformatarMoeda(licensingValue) : undefined,
      licensingFinancialStatus,
      licensingLastLaunchDate: effectiveLicensingLaunchDate || undefined,

      // Capacity & Meters
      capacityM3: capacityM3 ? parseFloat(capacityM3) : undefined,
      fuelCapacityLiters: fuelCapacityLiters ? parseFloat(fuelCapacityLiters) : undefined,
      tank_capacity: fuelCapacityLiters ? parseFloat(fuelCapacityLiters) : undefined,
      tankCapacity: fuelCapacityLiters ? parseFloat(fuelCapacityLiters) : undefined,
      licensePlateOrSerial: (plate.trim() || serialNumber.trim()).toUpperCase(),
      hourMeter: hourMeter ? parseFloat(hourMeter) : (editingVehicle?.hourMeter || 0),
      currentKm: currentKm ? parseFloat(currentKm) : (editingVehicle?.currentKm || undefined),
      averageConsumptionKmPerLiter: finalKmPerLiter,
      averageConsumptionLitersPerHour: finalLitersPerHour,
      operatorOrDriver: compiledDriverString,
      assignedDriverIds: selectedDriverIds,
      assignedDrivers: assignedNames,
      revisionStatus: revisionStatus.trim() || 'Em dia',
      notes: notes.trim() || undefined,
      reaisNotes: notes.trim() || undefined,
      accumulatedCost: editingVehicle ? editingVehicle.accumulatedCost : 0,
      totalFuelExpenses: editingVehicle?.totalFuelExpenses || 0,
      totalMaintenanceExpenses: editingVehicle?.totalMaintenanceExpenses || 0,
      lastMaintenanceDate: editingVehicle?.lastMaintenanceDate || new Date().toISOString().split('T')[0],
      currentFuelPercentage: editingVehicle?.currentFuelPercentage || 100,
    };

    // Automatically generate installments in Contas a Pagar if requested
    if (willGenerateInstallments && onAddExpense) {
      const baseDueDate = firstInstallmentDueDate || new Date().toISOString().split('T')[0];
      const [bYear, bMonth, bDay] = baseDueDate.split('-').map(Number);

      for (let i = 1; i <= numInstallments; i++) {
        // Calculate each month's date cleanly
        const targetDate = new Date(bYear, (bMonth - 1) + (i - 1), bDay || 10);
        const yyyy = targetDate.getFullYear();
        const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
        const dd = String(targetDate.getDate()).padStart(2, '0');
        const instDueDate = `${yyyy}-${mm}-${dd}`;

        onAddExpense({
          description: `Parcela ${i}/${numInstallments} - Financiamento ${formattedName} (${(plate || serialNumber).toUpperCase()})`,
          amount: numInstallmentVal,
          category: 'Financiamento de Veículos / Frotas',
          dueDate: instDueDate,
          status: 'pendente',
          paymentMethod: 'boleto',
          supplier: financialInstitution.trim() || purchaseSupplier.trim() || ownerName.trim() || 'Banco / Financeira',
          invoiceNumber: purchaseInvoiceNumber.trim() || undefined,
          machineryId: vehicleData.id,
          machineryName: formattedName,
          notes: `Parcelamento de aquisição do veículo ${formattedName} (Placa/Série: ${(plate || serialNumber).toUpperCase()}). Parcela ${i} de ${numInstallments}. NF Compra: ${purchaseInvoiceNumber.trim() || 'N/A'}.`,
        });
      }
    }

    onSave(vehicleData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-zinc-300 overflow-hidden flex flex-col max-h-[92vh]"
      >
        
        {/* Header - Charcoal bg-zinc-800 with White Text */}
        <div 
          className="px-5 sm:px-6 py-3.5 bg-zinc-800 text-white flex items-center justify-between shrink-0 shadow-xs"
        >
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-zinc-700 text-white flex items-center justify-center shadow-xs">
              <Truck className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 
                className="text-base sm:text-lg font-bold text-white font-['Outfit']"
              >
                {editingVehicle ? 'Editar Veículo / Máquina' : 'Cadastrar Novo Veículo / Máquina'}
              </h3>
              <p 
                className="text-[11px] text-zinc-300"
              >
                Gestão de dados cadastrais, dados de propriedade, pesos e controle de compra
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-700/60 transition cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Tabs Bar with Print Action Buttons */}
        <div 
          className="p-2.5 sm:p-3 bg-zinc-100/90 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-2.5 shrink-0"
        >
          {/* Central Tabs: Dados & Histórico */}
          <div className="grid grid-cols-2 gap-2 w-full sm:w-auto max-w-md bg-zinc-200/80 p-1 rounded-xl shadow-xs">
            <button
              type="button"
              onClick={() => setActiveTab('dados')}
              className={`py-2 px-4 rounded-lg text-xs sm:text-sm font-bold transition flex items-center justify-center space-x-2 cursor-pointer ${
                activeTab === 'dados'
                  ? 'bg-zinc-800 text-white shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
            >
              <Car className="w-4 h-4" />
              <span>Dados do Veículo</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('historico')}
              className={`py-2 px-4 rounded-lg text-xs sm:text-sm font-bold transition flex items-center justify-center space-x-2 cursor-pointer ${
                activeTab === 'historico'
                  ? 'bg-zinc-800 text-white shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Histórico, Consumo & DRE</span>
            </button>
          </div>

          {/* Action Buttons: Imprimir Cadastro & Imprimir Histórico */}
          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handlePrintCadastro}
              title="Imprimir Ficha Cadastral do Veículo"
              className="px-3 py-2 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5 shadow-xs border border-zinc-300 cursor-pointer text-zinc-800 bg-white hover:bg-zinc-100 active:scale-95"
            >
              <Printer className="w-4 h-4 text-zinc-700" />
              <span className="font-bold whitespace-nowrap">
                Imprimir Cadastro
              </span>
            </button>

            <button
              type="button"
              onClick={handlePrintHistorico}
              title="Imprimir Relatório de Histórico, Consumo e DRE"
              className="px-3 py-2 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5 shadow-xs border border-zinc-300 cursor-pointer text-zinc-800 bg-white hover:bg-zinc-100 active:scale-95"
            >
              <Printer className="w-4 h-4 text-zinc-700" />
              <span className="font-bold whitespace-nowrap">
                Imprimir Histórico
              </span>
            </button>
          </div>
        </div>

        {/* TAB 1: DADOS DO VEÍCULO */}
        {activeTab === 'dados' && (
          <form 
            onSubmit={handleSubmit} 
            className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3.5 bg-zinc-50"
          >
            
            {/* SEÇÃO 1: IDENTIFICAÇÃO BÁSICA (CARD BRANCO) */}
            <div className="p-3.5 sm:p-4 rounded-xl bg-white border border-zinc-200 shadow-xs space-y-3.5">
              <div className="flex items-center space-x-2">
                <Truck className="w-4 h-4 text-zinc-700" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-800">
                  1. IDENTIFICAÇÃO DO VEÍCULO / MÁQUINA
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                {/* 1º: Placa do Veículo */}
                <div className="sm:col-span-3">
                  <label className="block text-xs font-bold mb-1 text-zinc-700">
                    Placa do Veículo
                  </label>
                  <input
                    type="text"
                    value={plate}
                    onChange={(e) => setPlate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-sm font-bold uppercase focus:outline-none focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700 shadow-xs"
                  />
                </div>

                {/* 2º: Nº da Frota */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold mb-1 text-zinc-700">
                    Nº da Frota
                  </label>
                  <input
                    type="text"
                    value={fleetNumber}
                    onChange={(e) => setFleetNumber(e.target.value)}
                    className={`w-full px-3.5 py-2 rounded-xl border text-zinc-900 text-sm font-bold uppercase focus:outline-none shadow-xs transition-colors ${
                      isFleetNumberDuplicate
                        ? 'border-rose-500 ring-2 ring-rose-500/40 bg-rose-50/50 focus:border-rose-600 focus:ring-rose-500'
                        : 'border-zinc-300 bg-white focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700'
                    }`}
                    placeholder="Ex: 10"
                  />
                  {isFleetNumberDuplicate && (
                    <div className="mt-1.5 flex items-start space-x-1 text-rose-600">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                      <p className="text-xs font-bold leading-tight">
                        Este número de frota já está cadastrado em outro veículo. Escolha um número exclusivo.
                      </p>
                    </div>
                  )}
                </div>

                {/* 3º: Nº de Série (Chassi / Fabricante) */}
                <div className="sm:col-span-4">
                  <label className="block text-xs font-bold mb-1 text-zinc-700">
                    Nº de Série (Chassi / Fabricante)
                  </label>
                  <input
                    type="text"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700 shadow-xs"
                  />
                </div>

                {/* 4º: Código RENAVAM */}
                <div className="sm:col-span-3">
                  <label className="block text-xs font-bold mb-1 text-zinc-700">
                    Código RENAVAM
                  </label>
                  <input
                    type="text"
                    value={renavam}
                    onChange={(e) => setRenavam(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700 shadow-xs"
                  />
                </div>
              </div>

              {/* Marca, Modelo, Ano, Cor e Capacidade do Tanque (L) */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                <div className="sm:col-span-3">
                  <label className="block text-xs font-bold mb-1 text-zinc-700">
                    Marca
                  </label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value.toUpperCase())}
                    className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-sm font-semibold uppercase focus:outline-none focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700 shadow-xs"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-xs font-bold mb-1 text-zinc-700">
                    Modelo
                  </label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value.toUpperCase())}
                    className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-sm font-semibold uppercase focus:outline-none focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700 shadow-xs"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold mb-1 text-zinc-700">
                    Ano de Fabricação
                  </label>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700 shadow-xs"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold mb-1 text-zinc-700">
                    Cor
                  </label>
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700 shadow-xs"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold mb-1 text-zinc-700" title="Capacidade total do tanque de combustível em litros">
                    Capacidade do Tanque (L)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={fuelCapacityLiters}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || /^\d*\.?\d*$/.test(val)) {
                        setFuelCapacityLiters(val);
                      }
                    }}
                    placeholder="Ex: 300"
                    className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700 shadow-xs"
                  />
                </div>
              </div>

              {/* Categoria do Veículo e Status Operacional */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Categoria do Veículo - Lista Editável */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-zinc-700">
                      Categoria do Veículo
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCategoriesModalOpen(true)}
                      className="text-[11px] text-zinc-700 hover:text-zinc-900 hover:underline font-bold flex items-center space-x-1 cursor-pointer"
                      title="Gerenciar lista: incluir novas ou excluir opções"
                    >
                      <Tag className="w-3 h-3 text-zinc-600" />
                      <span>Editar Lista</span>
                    </button>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <select
                      value={categoryType}
                      onChange={(e) => {
                        if (e.target.value === '__manage__') {
                          setIsCategoriesModalOpen(true);
                        } else {
                          const val = e.target.value;
                          setCategoryType(val);
                          const isNowReboque = val.trim().toLowerCase() === 'reboque' || val.trim().toLowerCase() === 'transbordo / reboque / carreta';
                          if (isNowReboque) {
                            setHasCoupledTrailer(false);
                            setCompositionType('reboque');
                          }
                        }
                      }}
                      className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700 shadow-xs cursor-pointer"
                    >
                      {categoriesList.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                      {!categoriesList.includes(categoryType) && categoryType && (
                        <option value={categoryType}>{categoryType}</option>
                      )}
                      <option disabled>──────────</option>
                      <option value="__manage__">+ Incluir ou Excluir Categorias da Lista...</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => setIsCategoriesModalOpen(true)}
                      className="p-2 border border-zinc-300 bg-white hover:bg-zinc-50 rounded-xl text-zinc-700 transition cursor-pointer shrink-0 shadow-xs"
                      title="Incluir nova categoria ou excluir existente"
                    >
                      <Plus className="w-4 h-4 text-zinc-700" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1 text-zinc-700">
                    Status Operacional
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700 shadow-xs"
                  >
                    <option value="disponivel">Disponível</option>
                    <option value="operacional">Operacional (Em Atividade / Campo)</option>
                    <option value="em_manutencao">Em Manutenção / Oficina</option>
                    <option value="parado">Parado / Sinistro / Aguardando Peças</option>
                  </select>
                </div>
              </div>

              {/* BLOCO CONDICIONAL: DETALHAMENTO DO REBOQUE (quando Categoria = Reboque) */}
              {isReboqueCategory && (
                <div className="pt-3.5 border-t border-zinc-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Layers className="w-4 h-4 text-zinc-700" />
                      <h5 className="text-xs font-bold uppercase tracking-wider text-zinc-800">
                        Detalhamento do Reboque
                      </h5>
                    </div>
                    <span className="text-[11px] font-bold text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-300">
                      Categoria: Reboque
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 bg-zinc-50 p-3.5 rounded-xl border border-zinc-200">
                    {/* Campo: Tipo de Reboque */}
                    <div className="sm:col-span-8">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-zinc-700">
                          Tipo de Reboque
                        </label>
                        <span className="text-[10px] text-zinc-500 font-medium">
                          Selecione uma opção ou digite livremente
                        </span>
                      </div>
                      
                      <div className="space-y-1.5">
                        <input
                          type="text"
                          list="reboque-tipo-sugestoes"
                          value={trailerType}
                          onChange={(e) => setTrailerType(e.target.value)}
                          placeholder="Ex: Prancha, Baú, Graneleiro, Basculante, Sider..."
                          className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700 shadow-xs"
                        />
                        <datalist id="reboque-tipo-sugestoes">
                          <option value="Prancha" />
                          <option value="Baú" />
                          <option value="Graneleiro" />
                          <option value="Basculante" />
                          <option value="Sider" />
                          <option value="Carreta Agrícola / Silagem" />
                          <option value="Transbordo" />
                          <option value="Tanque / Pipa" />
                          <option value="Porta-Contêiner" />
                        </datalist>

                        {/* Sugestões rápidas de 1 clique */}
                        <div className="flex items-center flex-wrap gap-1.5 pt-0.5">
                          <span className="text-[10px] font-semibold text-zinc-500 mr-0.5">Sugestões:</span>
                          {['Prancha', 'Baú', 'Graneleiro', 'Basculante', 'Sider'].map((tipo) => {
                            const isSelected = trailerType.trim().toLowerCase() === tipo.toLowerCase();
                            return (
                              <button
                                key={tipo}
                                type="button"
                                onClick={() => setTrailerType(tipo)}
                                className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition cursor-pointer shadow-2xs ${
                                  isSelected
                                    ? 'bg-zinc-800 text-white border-zinc-800'
                                    : 'bg-white text-zinc-700 border-zinc-300 hover:border-zinc-500 hover:bg-zinc-100'
                                }`}
                              >
                                {tipo}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Campo: Quantidade de Eixos */}
                    <div className="sm:col-span-4">
                      <label className="block text-xs font-bold mb-1 text-zinc-700">
                        Quantidade de Eixos
                      </label>
                      <div className="space-y-1.5">
                        <input
                          type="number"
                          min={1}
                          max={12}
                          value={trailerAxlesCount}
                          onChange={(e) => setTrailerAxlesCount(e.target.value)}
                          placeholder="Ex: 1, 2, 3, 4+"
                          className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700 shadow-xs"
                        />

                        {/* Atalhos numéricos rápidos */}
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <span className="text-[10px] font-semibold text-zinc-500 mr-0.5">Eixos:</span>
                          {['1', '2', '3', '4'].map((num) => {
                            const isSelected = trailerAxlesCount === num;
                            return (
                              <button
                                key={num}
                                type="button"
                                onClick={() => setTrailerAxlesCount(num)}
                                className={`flex-1 py-1 text-xs font-bold rounded-lg border text-center transition cursor-pointer shadow-2xs ${
                                  isSelected
                                    ? 'bg-zinc-800 text-white border-zinc-800'
                                    : 'bg-white text-zinc-700 border-zinc-300 hover:border-zinc-500 hover:bg-zinc-100'
                                }`}
                              >
                                {num}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* SEÇÃO: VÍNCULO DE REBOQUE / IMPLEMENTO (CARD BRANCO) */}
            {!isReboqueCategory ? (
            <div className="p-3.5 sm:p-4 rounded-xl bg-white border border-zinc-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Link2 className="w-4 h-4 text-zinc-700" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-800">
                    Vínculo de Reboque / Implemento
                  </h4>
                </div>
                <span className="text-[11px] font-semibold text-zinc-500">
                  Acoplamento Operacional
                </span>
              </div>

              {/* 1. Pergunta de Vínculo (Checkbox / Switch) */}
              <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                <div className="flex items-center space-x-2.5">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition shadow-2xs ${hasCoupledTrailer ? 'bg-zinc-800 text-white' : 'bg-zinc-200 text-zinc-600'}`}>
                    <Truck className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <label htmlFor="coupledTrailerSwitch" className="text-xs font-bold text-zinc-800 cursor-pointer block">
                      Este veículo possui reboque vinculado?
                    </label>
                    <span className="text-[11px] text-zinc-600">
                      {hasCoupledTrailer 
                        ? 'Sim — Reboque, carreta ou implemento acoplado a este veículo' 
                        : 'Não — Veículo operando de forma isolada / sem reboque'}
                    </span>
                  </div>
                </div>

                {/* Switch Moderno */}
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    id="coupledTrailerSwitch"
                    type="checkbox"
                    checked={hasCoupledTrailer}
                    onChange={(e) => handleToggleCoupledTrailer(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-zinc-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-zinc-800"></div>
                  <span className="ml-2 text-xs font-black uppercase text-zinc-800">
                    {hasCoupledTrailer ? 'Sim' : 'Não'}
                  </span>
                </label>
              </div>

              {/* 2. Bloco Dinâmico do Reboque */}
              {hasCoupledTrailer && (
                <div className="pt-3 border-t border-zinc-200 space-y-3">
                  <div className="flex items-center justify-between pb-1.5 border-b border-zinc-200">
                    <div className="flex items-center space-x-1.5">
                      <Layers className="w-3.5 h-3.5 text-zinc-700" />
                      <h5 className="text-xs font-bold uppercase tracking-wider text-zinc-800">
                        Dados do Reboque
                      </h5>
                    </div>
                    {candidateTrailers.length > 0 && (
                      <span className="text-[11px] text-zinc-500 font-medium">
                        Preenchimento manual ou vínculo rápido
                      </span>
                    )}
                  </div>

                  {/* Seletor Opcional de Reboques Cadastrados */}
                  {candidateTrailers.length > 0 && (
                    <div>
                      <label className="block text-xs font-bold mb-1 text-zinc-700">
                        Vincular a partir da Frota Existente (Opcional):
                      </label>
                      <select
                        value={coupledTrailerId}
                        onChange={(e) => handleSelectCandidateTrailer(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700 shadow-xs"
                      >
                        <option value="">-- Preencher dados manualmente ou selecionar reboque da frota --</option>
                        {candidateTrailers.map((t) => (
                          <option key={t.id} value={t.id} className="uppercase">
                            {t.licensePlateOrSerial || t.fleetNumber || 'S/N'} — {(t.model || t.name || '').toUpperCase()} {t.capacityLoadKg ? `(${t.capacityLoadKg} kg)` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Grid Proporcional de Campos do Reboque */}
                  <div className="grid grid-cols-1 sm:grid-cols-[130px_repeat(4,minmax(0,1fr))] gap-4">
                    {/* 1º: Placa do Reboque (Compacto para 7 caracteres) */}
                    <div>
                      <label className="block text-xs font-bold mb-1 text-zinc-700">
                        Placa do Reboque
                      </label>
                      <input
                        type="text"
                        placeholder="ABC-1D23"
                        maxLength={8}
                        value={trailerPlate}
                        onChange={(e) => setTrailerPlate(e.target.value.toUpperCase())}
                        className="w-full px-3 py-2 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-sm font-mono font-bold uppercase focus:outline-none focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700 shadow-xs"
                      />
                    </div>

                    {/* 2º: Modelo do Reboque (Largura média idêntica aos demais) */}
                    <div>
                      <label className="block text-xs font-bold mb-1 text-zinc-700">
                        Modelo do Reboque
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Randon Basculante"
                        value={trailerModel}
                        onChange={(e) => setTrailerModel(e.target.value.toUpperCase())}
                        className="w-full px-3 py-2 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-sm font-semibold uppercase focus:outline-none focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700 shadow-xs"
                      />
                    </div>

                    {/* 3º: Tipo de Reboque (Largura média idêntica aos demais) */}
                    <div>
                      <label className="block text-xs font-bold mb-1 text-zinc-700">
                        Tipo de Reboque
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Graneleiro, Caçamba"
                        value={coupledTrailerType}
                        onChange={(e) => setCoupledTrailerType(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700 shadow-xs"
                      />
                    </div>

                    {/* 4º: Capacidade Carga (kg) (Largura idêntica aos de Modelo e Tipo) */}
                    <div>
                      <label className="block text-xs font-bold mb-1 text-zinc-700">
                        Capacidade Carga (kg)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="any"
                          placeholder="Ex: 25000"
                          value={trailerCapacityLoadKg}
                          onChange={(e) => setTrailerCapacityLoadKg(e.target.value)}
                          className="w-full px-3 py-2 pr-8 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700 shadow-xs"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-zinc-500 pointer-events-none">
                          kg
                        </span>
                      </div>
                    </div>

                    {/* 5º: Capacidade Volumétrica (m³) (Largura idêntica aos de Modelo e Tipo) */}
                    <div>
                      <label className="block text-xs font-bold mb-1 text-zinc-700">
                        Capacidade (m³)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="any"
                          placeholder="Ex: 40"
                          value={trailerCapacityM3}
                          onChange={(e) => setTrailerCapacityM3(e.target.value)}
                          className="w-full px-3 py-2 pr-8 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700 shadow-xs"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-zinc-500 pointer-events-none">
                          m³
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            ) : (
              <div className="p-3.5 sm:p-4 rounded-xl bg-zinc-100/80 border border-zinc-200 flex items-center justify-between text-xs text-zinc-600">
                <div className="flex items-center space-x-2.5">
                  <div className="w-7 h-7 rounded-lg bg-zinc-200 text-zinc-600 flex items-center justify-center shrink-0">
                    <Link2 className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-zinc-800">Vínculo de Reboque / Implemento: </span>
                    <span className="text-zinc-600">
                      Desativado porque o veículo cadastrado já é da categoria <strong>Reboque</strong>.
                    </span>
                  </div>
                </div>
                <span className="text-[11px] font-bold text-zinc-600 bg-zinc-200 px-2 py-0.5 rounded-md shrink-0">
                  Não Aplicável
                </span>
              </div>
            )}

            {/* SEÇÃO 2: PROPRIEDADE & NO NOME DE QUEM (CARD BRANCO) */}
            <div className="p-3.5 sm:p-4 rounded-xl bg-white border border-zinc-200 shadow-xs space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <Building className="w-4 h-4 text-zinc-700" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-800">
                    Propriedade & Documentação ("No Nome de Quem")
                  </h4>
                </div>
                <div className="flex items-center space-x-1.5 self-end sm:self-auto">
                  <span className="text-[11px] text-zinc-600 font-semibold">Regime:</span>
                  <select
                    value={ownership}
                    onChange={(e) => {
                      if (e.target.value === '__manage__') {
                        setIsRegimesModalOpen(true);
                      } else {
                        setOwnership(e.target.value);
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg border border-zinc-300 bg-white text-zinc-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700 cursor-pointer shadow-xs"
                  >
                    {regimesList.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                    {!regimesList.includes(ownership) && ownership && (
                      <option value={ownership}>{ownership}</option>
                    )}
                    <option disabled>──────────</option>
                    <option value="__manage__">+ Incluir ou Excluir Regimes...</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => setIsRegimesModalOpen(true)}
                    className="p-1 border border-zinc-300 bg-white hover:bg-zinc-50 rounded-lg text-zinc-700 transition cursor-pointer shrink-0 shadow-xs"
                    title="Incluir novo regime ou excluir opções da lista"
                  >
                    <Plus className="w-3.5 h-3.5 text-zinc-700" />
                  </button>
                </div>
              </div>

              {/* Titular Principal */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold mb-1 text-zinc-700">
                    Está no Nome de Quem (Razão Social ou Nome do Proprietário)
                  </label>
                  <input
                    type="text"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700 shadow-xs"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">Nome constante no documento do veículo</p>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1 text-zinc-700">
                    CNPJ ou CPF do Proprietário
                  </label>
                  <input
                    type="text"
                    value={ownerDocument}
                    onChange={(e) => setOwnerDocument(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700 shadow-xs"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">Permite veículos no CPF e no CNPJ da empresa</p>
                </div>
              </div>

              {/* Segundo Proprietário / Sócio (Opcional) */}
              {showSecondaryOwner ? (
                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-800">
                      Segundo Proprietário / Coproprietário / Sócio
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSecondaryOwner(false);
                        setSecondaryOwnerName('');
                        setSecondaryOwnerDocument('');
                      }}
                      className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
                    >
                      Remover segundo titular
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <input
                        type="text"
                        value={secondaryOwnerName}
                        onChange={(e) => setSecondaryOwnerName(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 bg-white text-zinc-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={secondaryOwnerDocument}
                        onChange={(e) => setSecondaryOwnerDocument(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 bg-white text-zinc-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSecondaryOwner(true)}
                  className="inline-flex items-center space-x-1.5 text-xs text-zinc-700 font-bold hover:text-zinc-900 hover:underline cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-zinc-700" />
                  <span>Possui mais de um sócio / coproprietário? Adicionar segundo titular</span>
                </button>
              )}
            </div>

            {/* SEÇÃO 3: CONTROLE DE PESO (TARA & LOTAÇÃO) E MEDIÇÕES (CARD BRANCO) */}
            <div className="p-3.5 sm:p-4 rounded-xl bg-white border border-zinc-200 shadow-xs space-y-3.5">
              <div className="flex items-center space-x-2">
                <Weight className="w-4 h-4 text-zinc-700" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-800">
                  Controle de Pesos, Capacidade & Odômetro/Horímetro
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {/* Tara (kg) */}
                <div>
                  <label className="block text-xs font-bold mb-1 text-zinc-700">
                    Tara (kg)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      value={taraWeightKg}
                      onChange={(e) => setTaraWeightKg(e.target.value)}
                      className="w-full px-3.5 py-2 pr-12 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700 shadow-xs"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500">
                      kg
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1">Peso do veículo vazio sem carga</p>
                </div>

                {/* Lotação (kg) */}
                <div>
                  <label className="block text-xs font-bold mb-1 text-zinc-700">
                    Lotação (kg)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      value={capacityLoadKg}
                      onChange={(e) => setCapacityLoadKg(e.target.value)}
                      className="w-full px-3.5 py-2 pr-12 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700 shadow-xs"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500">
                      kg
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1">Carga máxima útil permitida</p>
                </div>

                {/* PBT Calculado */}
                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 flex flex-col justify-center">
                  <span className="text-[10px] font-bold text-zinc-700 uppercase">
                    PBT Calculado (Tara + Lotação)
                  </span>
                  <div className="text-lg font-black text-zinc-900 font-mono mt-0.5">
                    {computedPbt > 0 ? `${computedPbt.toLocaleString('pt-BR')} kg` : '--'}
                  </div>
                  <span className="text-[10px] text-zinc-500">
                    {computedPbt > 0 ? `Equivale a ${(computedPbt / 1000).toFixed(1)} toneladas` : 'Informe Tara e Lotação'}
                  </span>
                </div>
              </div>

              {/* Volume M3, Horímetro e Odômetro */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
                {/* Capacidade M³ */}
                <div>
                  <label className="block text-xs font-bold mb-1 flex items-center space-x-1 text-zinc-700">
                    <Layers className="w-3.5 h-3.5 text-zinc-600" />
                    <span>Capacidade Caçamba (m³)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      value={capacityM3}
                      onChange={(e) => setCapacityM3(e.target.value)}
                      className="w-full px-3.5 py-2 pr-12 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700 shadow-xs"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500">
                      m³
                    </span>
                  </div>
                </div>

                {/* Horímetro Atual */}
                <div>
                  <label className="block text-xs font-bold mb-1 flex items-center space-x-1 text-zinc-700">
                    <Clock className="w-3.5 h-3.5 text-zinc-600" />
                    <span>Horímetro Atual (Horas)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      value={hourMeter}
                      onChange={(e) => setHourMeter(e.target.value)}
                      className="w-full px-3.5 py-2 pr-12 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700 shadow-xs"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500">
                      h
                    </span>
                  </div>
                </div>

                {/* Odômetro Atual */}
                <div>
                  <label className="block text-xs font-bold mb-1 flex items-center space-x-1 text-zinc-700">
                    <Gauge className="w-3.5 h-3.5 text-zinc-600" />
                    <span>Odômetro Atual (KM)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      value={currentKm}
                      onChange={(e) => setCurrentKm(e.target.value)}
                      className="w-full px-3.5 py-2 pr-12 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700 shadow-xs"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500">
                      km
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* SEÇÃO 4: CONTROLE DE COMPRA, NOTA FISCAL & FINANCIAMENTO (CARD BRANCO) */}
            <div className="p-3.5 sm:p-4 rounded-xl bg-white border border-zinc-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <Receipt className="w-4 h-4 text-zinc-700" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-800">
                    Controle de Compra, Nota Fiscal & Financiamento
                  </h4>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-medium text-zinc-600">Modalidade:</span>
                  <div className="inline-flex rounded-lg p-0.5 bg-zinc-200 border border-zinc-300">
                    <button
                      type="button"
                      onClick={() => setIsFinanced(false)}
                      className={`px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                        !isFinanced ? 'bg-zinc-800 text-white shadow-xs' : 'text-zinc-700 hover:text-zinc-900'
                      }`}
                    >
                      À Vista
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsFinanced(true)}
                      className={`px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                        isFinanced ? 'bg-zinc-800 text-white shadow-xs' : 'text-zinc-700 hover:text-zinc-900'
                      }`}
                    >
                      Parcelado / Financiado
                    </button>
                  </div>
                </div>
              </div>

              {/* Dados da Nota de Compra e Valor */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                {/* Valor de Compra */}
                <div>
                  <CurrencyInput
                    id="purchaseValueInput"
                    label="Valor de Compra (R$)"
                    value={purchaseValue}
                    onChange={(numericValue, formattedValue) => {
                      setPurchaseValue(formattedValue);
                      // Se estiver financiado e tiver parcelas, calcula sugestão
                      const count = parseInt(installmentsCount, 10);
                      if (isFinanced && count > 0 && numericValue > 0) {
                        const parcelVal = numericValue / count;
                        setInstallmentValue(formatarMoeda(Math.round(parcelVal * 100)));
                      }
                    }}
                    placeholder="0,00"
                  />
                </div>

                {/* Nota Fiscal de Compra */}
                <div>
                  <label className="block text-xs font-bold mb-1 text-zinc-700">
                    Nota Fiscal de Compra
                  </label>
                  <input
                    type="text"
                    value={purchaseInvoiceNumber}
                    onChange={(e) => setPurchaseInvoiceNumber(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700 shadow-xs"
                  />
                </div>

                {/* Data da Compra */}
                <div>
                  <label className="block text-xs font-bold mb-1 text-zinc-700">
                    Data da Compra
                  </label>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700 shadow-xs"
                  />
                </div>

                {/* Fornecedor / Vendedor */}
                <div>
                  <label className="block text-xs font-bold mb-1 text-zinc-700">
                    Concessionária / Vendedor
                  </label>
                  <input
                    type="text"
                    value={purchaseSupplier}
                    onChange={(e) => setPurchaseSupplier(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700 shadow-xs"
                  />
                </div>
              </div>

              {/* Chave de Acesso e Anexo da Nota */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1 text-zinc-700">
                    Chave de Acesso da NF-e (44 dígitos)
                  </label>
                  <input
                    type="text"
                    value={purchaseInvoiceKey}
                    onChange={(e) => setPurchaseInvoiceKey(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700 shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1 text-zinc-700">
                    Anexar Arquivo da Nota Fiscal (PDF ou Imagem)
                  </label>
                  <div className="flex items-center space-x-2">
                    <label className="px-3.5 py-2 rounded-xl border border-zinc-300 bg-zinc-50 hover:bg-zinc-100 text-zinc-800 text-xs font-bold flex items-center space-x-1.5 cursor-pointer transition shadow-xs">
                      <Paperclip className="w-3.5 h-3.5 text-zinc-700" />
                      <span>Selecionar Arquivo...</span>
                      <input type="file" onChange={handleFileUpload} className="hidden" accept=".pdf,image/*" />
                    </label>
                    {purchaseAttachmentName && (
                      <span className="text-xs text-zinc-800 font-medium truncate max-w-xs flex items-center space-x-1">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                        <span>{purchaseAttachmentName}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* SE FINANCIADO / PARCELADO */}
              {isFinanced && (
                <div className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-200 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-bold text-zinc-800 flex items-center space-x-1.5">
                      <CreditCard className="w-4 h-4 text-zinc-700" />
                      <span>Condições do Financiamento / Parcelamento</span>
                    </span>
                    <div className="flex items-center space-x-2">
                      {editingVehicle?.installmentsGenerated && (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-zinc-200 text-zinc-800 border border-zinc-300">
                          Parcelas já lançadas no Contas a Pagar
                        </span>
                      )}
                      <button
                        type="button"
                        id="btn-abrir-modal-parcelas-compra-financiamento"
                        onClick={handleOpenPurchaseInstallmentsModal}
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-900 text-white text-xs font-bold rounded-lg transition flex items-center space-x-1.5 shadow-2xs cursor-pointer active:scale-98"
                        title="Abrir a grade de Parcelas Geradas para Compra / Financiamento"
                      >
                        <CreditCard className="w-3.5 h-3.5 text-zinc-200" />
                        <span>Parcelas da Compra / Financiamento</span>
                      </button>
                    </div>
                  </div>

                  {/* Feedback se as parcelas foram recém geradas */}
                  {installmentsCreatedFeedback && (
                    <div className="p-2 bg-emerald-50 border border-emerald-300 rounded-lg flex items-center space-x-2 text-emerald-800 text-xs font-bold animate-in fade-in">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Parcelas de compra/financiamento gravadas com sucesso no módulo financeiro (Contas a Pagar)!</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    {/* Quantidade de parcelas */}
                    <div>
                      <label className="block text-xs font-bold mb-1 text-zinc-700">
                        Qtd. de Parcelas
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="120"
                        value={installmentsCount}
                        onChange={(e) => handleInstallmentsCountChange(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 bg-white text-zinc-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700"
                      />
                    </div>

                    {/* Valor da parcela */}
                    <div>
                      <CurrencyInput
                        id="installmentValueInput"
                        label="Valor da Parcela (R$)"
                        value={installmentValue}
                        onChange={(numericValue, formattedValue) => {
                          setInstallmentValue(formattedValue);
                        }}
                        placeholder="0,00"
                      />
                    </div>

                    {/* Data 1º Vencimento */}
                    <div>
                      <label className="block text-xs font-bold mb-1 text-zinc-700">
                        1º Vencimento
                      </label>
                      <input
                        type="date"
                        value={firstInstallmentDueDate}
                        onChange={(e) => setFirstInstallmentDueDate(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 bg-white text-zinc-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700"
                      />
                    </div>

                    {/* Banco / Financeira */}
                    <div>
                      <label className="block text-xs font-bold mb-1 text-zinc-700">
                        Banco / Instituição
                      </label>
                      <input
                        type="text"
                        value={financialInstitution}
                        onChange={(e) => setFinancialInstitution(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 bg-white text-zinc-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700"
                      />
                    </div>
                  </div>

                  {/* Automação: Incluir no Contas a Pagar */}
                  {!editingVehicle?.installmentsGenerated && (
                    <div className="pt-2 border-t border-zinc-200 flex items-start space-x-2.5">
                      <input
                        type="checkbox"
                        id="generatePayablesCheck"
                        checked={generatePayables}
                        onChange={(e) => setGeneratePayables(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-zinc-800 focus:ring-zinc-700 cursor-pointer accent-zinc-800"
                      />
                      <label htmlFor="generatePayablesCheck" className="text-xs text-zinc-800 cursor-pointer">
                        <strong className="text-zinc-900">
                          Incluir as parcelas no Contas a Pagar automaticamente
                        </strong>
                        <span className="block text-[11px] text-zinc-600">
                          O sistema irá gerar as {installmentsCount || 'X'} despesas mensais sequenciais no módulo financeiro vinculadas à aquisição deste veículo.
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* SEÇÃO 4: CONTROLE PATRIMONIAL, IMPOSTOS & TAXAS */}
            <div className="p-3.5 sm:p-4 rounded-xl bg-white border border-zinc-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-zinc-200">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-zinc-700" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-800">
                    4. Controle Patrimonial, Impostos & Taxas
                  </h4>
                </div>
                <span className="text-[11px] text-zinc-500 font-medium">
                  Ativo Imobilizado, Avaliação FIPE e Tributos da Frota
                </span>
              </div>

              {/* Grid dos Campos de Avaliação e IPVA */}
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* 1. Valor Comercial Tabela FIPE (R$) */}
                <div className="sm:col-span-1 lg:col-span-2">
                  <CurrencyInput
                    id="fipeValueInput"
                    label="Valor Comercial Tabela FIPE (R$)"
                    value={fipeValue}
                    onChange={(numericValue, formattedValue) => {
                      setFipeValue(formattedValue);
                    }}
                    placeholder="0,00"
                  />
                </div>

                {/* 2. Valor Base para IPVA (R$) */}
                <div className="sm:col-span-1 lg:col-span-2">
                  <CurrencyInput
                    id="ipvaBaseValueInput"
                    label="Valor Base para IPVA (R$)"
                    value={ipvaBaseValue}
                    onChange={(numericValue, formattedValue) => {
                      setIpvaBaseValue(formattedValue);
                    }}
                    placeholder="0,00"
                  />
                </div>

                {/* 3. Alíquota IPVA (%) */}
                <div>
                  <label className="block text-xs font-bold mb-1 text-zinc-700">
                    Alíquota IPVA (%)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      placeholder="Ex: 2"
                      value={ipvaRatePercent}
                      onChange={(e) => setIpvaRatePercent(e.target.value)}
                      className="w-full px-3 py-2 pr-7 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500">
                      %
                    </span>
                  </div>
                </div>

                {/* 4. Valor Total IPVA (R$) - Calculado Automaticamente */}
                <div>
                  <label className="block text-xs font-bold mb-1 text-zinc-700">
                    Total IPVA (R$)
                  </label>
                  <div className="px-3 py-2 rounded-xl border border-zinc-300 bg-zinc-100 text-zinc-900 text-xs sm:text-sm font-black flex items-center h-[38px]">
                    {computedIpvaTotal > 0 
                      ? computedIpvaTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                      : 'R$ 0,00'}
                  </div>
                </div>
              </div>

              {/* Linha de Parcelamento e Licenciamento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                {/* 5. Qtd. Parcelas IPVA */}
                <div>
                  <label className="block text-xs font-bold mb-1 text-zinc-700">
                    Qtd. Parcelas IPVA
                  </label>
                  <select
                    value={ipvaInstallmentsCount}
                    onChange={(e) => setIpvaInstallmentsCount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700"
                  >
                    <option value="1">1x (À Vista / Cota Única)</option>
                    <option value="2">2x mensais</option>
                    <option value="3">3x mensais</option>
                    <option value="4">4x mensais</option>
                    <option value="5">5x mensais</option>
                  </select>
                </div>

                {/* 6. Valor do Licenciamento Anual (R$) */}
                <div>
                  <CurrencyInput
                    id="licensingValueInput"
                    label="Valor do Licenciamento (R$)"
                    value={licensingValue}
                    onChange={(numericValue, formattedValue) => {
                      setLicensingValue(formattedValue);
                    }}
                    placeholder="0,00"
                  />
                </div>

                {/* 7. Ação de Lançar IPVA no Financeiro */}
                <div className="flex flex-col justify-end">
                  <span className="block text-[10px] font-bold text-zinc-500 mb-1">
                    Integração Contas a Pagar
                  </span>
                  {ipvaFinancialStatus === 'lancado' ? (
                    <div className="h-[38px] px-2.5 rounded-xl bg-emerald-50 border border-emerald-300 flex items-center justify-between gap-1 text-emerald-800 text-xs font-black">
                      <div className="flex items-center space-x-1 truncate">
                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="truncate">IPVA Lançado</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleLaunchIpva}
                        className="px-2 py-1 bg-white hover:bg-emerald-100 border border-emerald-300 rounded-lg text-[10px] font-bold text-emerald-900 transition cursor-pointer shrink-0 shadow-2xs"
                        title="Ver parcelas geradas ou lançar novamente"
                      >
                        Ver / Gerar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleLaunchIpva}
                      disabled={computedIpvaTotal <= 0}
                      className="h-[38px] px-3 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-800 text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Landmark className="w-4 h-4 text-zinc-700" />
                      <span>Lançar IPVA no Financeiro</span>
                    </button>
                  )}
                  <span className="text-[11px] text-zinc-500 text-center mt-1.5 leading-tight">
                    Último lançamento: {effectiveIpvaLaunchDate ? formatDateBR(effectiveIpvaLaunchDate) : '-'}
                  </span>
                </div>

                {/* 8. Ação de Lançar Licenciamento no Financeiro */}
                <div className="flex flex-col justify-end">
                  <span className="block text-[10px] font-bold text-zinc-500 mb-1">
                    Taxa Anual CRLV
                  </span>
                  {licensingFinancialStatus === 'lancado' ? (
                    <div className="h-[38px] px-2.5 rounded-xl bg-emerald-50 border border-emerald-300 flex items-center justify-between gap-1 text-emerald-800 text-xs font-black">
                      <div className="flex items-center space-x-1 truncate">
                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="truncate">✓ Licenciamento Lançado</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleLaunchLicensing}
                        className="px-2 py-1 bg-white hover:bg-emerald-100 border border-emerald-300 rounded-lg text-[10px] font-bold text-emerald-900 transition cursor-pointer shrink-0 shadow-2xs"
                        title="Ver dados do licenciamento ou lançar novamente"
                      >
                        Ver / Gerar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleLaunchLicensing}
                      className="h-[38px] px-3 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-800 text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow-xs cursor-pointer"
                    >
                      <DollarSign className="w-4 h-4 text-zinc-700" />
                      <span>Lançar Licenciamento</span>
                    </button>
                  )}
                  <span className="text-[11px] text-zinc-500 text-center mt-1.5 leading-tight">
                    Último lançamento: {effectiveLicensingLaunchDate ? formatDateBR(effectiveLicensingLaunchDate) : '-'}
                  </span>
                </div>
              </div>
            </div>

            {/* SEÇÃO 5: MOTORISTAS / OPERADORES (CARD BRANCO) */}
            <div className="p-3.5 sm:p-4 bg-white rounded-xl border border-zinc-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold flex items-center space-x-1.5 text-zinc-800">
                  <Users className="w-4 h-4 text-zinc-700" />
                  <span>Motoristas & Operadores Vinculados (Múltiplos)</span>
                </label>
                <span className="text-[11px] font-semibold text-zinc-500">
                  {selectedDriverIds.length} selecionado(s)
                </span>
              </div>

              {/* Chips of selected employees */}
              <div className="flex flex-wrap gap-2 min-h-[38px] p-2 bg-zinc-50 border border-zinc-200 rounded-xl">
                {selectedDriverIds.length === 0 ? (
                  <span className="text-xs text-zinc-500 italic py-1 px-1">
                    Nenhum motorista ou operador selecionado. Escolha na lista abaixo:
                  </span>
                ) : (
                  selectedDriverIds.map((id) => {
                    const emp = activeEmployees.find(e => e.id === id);
                    if (!emp) return null;
                    return (
                      <span
                        key={emp.id}
                        className="inline-flex items-center space-x-1.5 py-1 px-2.5 rounded-lg bg-zinc-100 border border-zinc-300 text-zinc-800 text-xs font-bold shadow-2xs"
                      >
                        <UserCheck className="w-3.5 h-3.5 text-zinc-700" />
                        <span>{emp.name}</span>
                        <span className="text-[10px] text-zinc-500 font-normal">
                          ({emp.role})
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveDriver(emp.id)}
                          className="hover:bg-zinc-200 rounded-full p-0.5 transition cursor-pointer text-zinc-600 hover:text-zinc-900"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })
                )}
              </div>

              {/* Employee Selection Search */}
              <div className="space-y-2">
                <div className="relative">
                  <input
                    type="text"
                    value={driverSearchQuery}
                    onChange={(e) => setDriverSearchQuery(e.target.value)}
                    placeholder="Pesquisar funcionário..."
                    className="w-full px-3.5 py-2 bg-white border border-zinc-300 rounded-xl text-xs sm:text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700"
                  />
                  {filteredEmployeeSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-zinc-200 rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto divide-y divide-zinc-100">
                      {filteredEmployeeSuggestions.map((emp) => (
                        <button
                          key={emp.id}
                          type="button"
                          onClick={() => handleToggleDriver(emp.id)}
                          className="w-full text-left px-3.5 py-2 hover:bg-zinc-50 flex items-center justify-between text-xs transition cursor-pointer"
                        >
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-zinc-900">{emp.name}</span>
                            <span className="text-zinc-500 text-[11px]">({emp.role})</span>
                          </div>
                          <span className="text-zinc-700 font-bold flex items-center space-x-1">
                            <Plus className="w-3 h-3 text-zinc-700" />
                            <span>Adicionar</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick Selection Buttons */}
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-1">
                  {activeEmployees.slice(0, 10).map((emp) => {
                    const isSelected = selectedDriverIds.includes(emp.id);
                    return (
                      <button
                        key={emp.id}
                        type="button"
                        onClick={() => handleToggleDriver(emp.id)}
                        className={`text-xs py-1 px-2.5 rounded-lg border transition flex items-center space-x-1.5 cursor-pointer ${
                          isSelected
                            ? 'bg-zinc-800 text-white border-zinc-800 font-bold'
                            : 'bg-white border-zinc-300 text-zinc-700 hover:border-zinc-500 hover:bg-zinc-50 font-medium'
                        }`}
                      >
                        {isSelected ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3 text-zinc-400" />}
                        <span>{emp.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* SEÇÃO 6: MÉDIAS DE CONSUMO AUTOMÁTICAS (CARD BRANCO) */}
            <div className="p-3.5 sm:p-4 rounded-xl bg-white border border-zinc-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 rounded-lg bg-zinc-800 text-white flex items-center justify-center">
                    <Fuel className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-800">
                      Médias de Consumo de Combustível
                    </h4>
                    <p className="text-[11px] text-zinc-500">
                      Calculadas automaticamente com base nos registros de abastecimento
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-300">
                  Cálculo Automático
                </span>
              </div>

              {/* Metric Badges */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-zinc-600">
                      Média por Km (km/L)
                    </span>
                    <div className="text-lg font-black text-zinc-900 font-['Outfit']">
                      {consumptionMetrics.avgKmPerLiter !== null 
                        ? `${consumptionMetrics.avgKmPerLiter.toLocaleString('pt-BR')} km/L` 
                        : (editingVehicle?.averageConsumptionKmPerLiter 
                            ? `${editingVehicle.averageConsumptionKmPerLiter.toLocaleString('pt-BR')} km/L`
                            : 'Aguardando Abastecimento')}
                    </div>
                  </div>
                  <Gauge className="w-6 h-6 text-zinc-400" />
                </div>

                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-zinc-600">
                      Média por Horas (L/h)
                    </span>
                    <div className="text-lg font-black text-zinc-900 font-['Outfit']">
                      {consumptionMetrics.avgLitersPerHour !== null 
                        ? `${consumptionMetrics.avgLitersPerHour.toLocaleString('pt-BR')} L/h` 
                        : (editingVehicle?.averageConsumptionLitersPerHour 
                            ? `${editingVehicle.averageConsumptionLitersPerHour.toLocaleString('pt-BR')} L/h`
                            : 'Aguardando Abastecimento')}
                    </div>
                  </div>
                  <Clock className="w-6 h-6 text-zinc-400" />
                </div>
              </div>
            </div>

            {/* SEÇÃO 7: OBSERVAÇÕES (CARD BRANCO) */}
            <div className="p-3.5 sm:p-4 rounded-xl bg-white border border-zinc-200 shadow-xs space-y-2">
              <label className="block text-xs font-bold text-zinc-800">
                Observações Adicionais
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700 resize-none shadow-xs"
              />
            </div>

            {/* Actions / Rodapé */}
            <div 
              className="p-3.5 sm:p-4 bg-white rounded-xl border border-zinc-200 shadow-xs flex items-center justify-end space-x-2.5"
            >
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-800 text-xs sm:text-sm font-bold transition cursor-pointer shadow-xs"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isFleetNumberDuplicate}
                className={`px-6 py-2.5 rounded-xl text-white text-xs sm:text-sm font-bold shadow-md transition flex items-center space-x-2 ${
                  isFleetNumberDuplicate
                    ? 'bg-zinc-400 opacity-60 cursor-not-allowed'
                    : 'bg-zinc-800 hover:bg-zinc-900 cursor-pointer active:scale-95'
                }`}
                title={isFleetNumberDuplicate ? 'Corrija o número de frota duplicado para salvar' : undefined}
              >
                <Save className="w-4 h-4 text-white" />
                <span>Salvar Veículo</span>
              </button>
            </div>

          </form>
        )}

        {/* TAB 2: HISTÓRICO, CONSUMO & DRE */}
        {activeTab === 'historico' && (
          <VehicleHistoryDreTab
            vehicle={editingVehicle}
            employees={employees}
            fuelLogs={fuelLogs}
            maintenanceLogs={maintenanceLogs}
            expenses={expenses}
            services={services}
            orders={orders}
            onAddExpense={onAddExpense}
            onClose={onClose}
          />
        )}

      </div>

      {/* Modal para Gerenciar (Incluir / Excluir / Editar) Categorias da Lista */}
      <VehicleCategoriesModal
        isOpen={isCategoriesModalOpen}
        onClose={() => setIsCategoriesModalOpen(false)}
        categories={categoriesList}
        onSaveCategories={handleSaveCategories}
        onSelectCategory={(cat) => setCategoryType(cat)}
      />

      {/* Modal para Gerenciar (Incluir / Excluir / Editar) Regimes da Lista */}
      <VehicleOwnershipModal
        isOpen={isRegimesModalOpen}
        onClose={() => setIsRegimesModalOpen(false)}
        regimes={regimesList}
        onSaveRegimes={handleSaveRegimes}
        onSelectRegime={(reg) => setOwnership(reg)}
      />

      {/* Modal de Pré-visualização e Impressão Oficial do Veículo */}
      {printOptions && (
        <PrintPreviewModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          options={printOptions}
        />
      )}

      {/* Modal de Parcelas Geradas para IPVA */}
      <IpvaInstallmentsModal
        isOpen={isIpvaInstallmentsModalOpen}
        onClose={() => setIsIpvaInstallmentsModalOpen(false)}
        vehicleName={`${brand.trim() || 'Veículo'} ${model.trim() || plate.trim() || 'Frota'}`.trim()}
        vehicleIdentifier={(plate.trim() || serialNumber.trim() || fleetNumber.trim() || 'S/N').toUpperCase()}
        totalAmount={computedIpvaTotal}
        initialInstallmentsCount={Math.max(1, parseInt(ipvaInstallmentsCount, 10) || 1)}
        year={year || new Date().getFullYear()}
        onConfirmAndSave={handleConfirmIpvaInstallments}
      />

      {/* Modal de Confirmação e Lançamento do Licenciamento CRLV */}
      <LicensingLaunchModal
        isOpen={isLicensingLaunchModalOpen}
        onClose={() => setIsLicensingLaunchModalOpen(false)}
        vehicleName={`${brand.trim() || 'Veículo'} ${model.trim() || plate.trim() || 'Frota'}`.trim()}
        vehicleIdentifier={(plate.trim() || serialNumber.trim() || fleetNumber.trim() || 'S/N').toUpperCase()}
        baseValue={licensingValue ? desformatarMoeda(licensingValue) : 0}
        year={year || new Date().getFullYear()}
        onConfirmAndSave={handleConfirmLicensing}
      />

      {/* Modal de Parcelas Geradas para Compra / Financiamento */}
      <VehiclePurchaseInstallmentsModal
        isOpen={isPurchaseInstallmentsModalOpen}
        onClose={() => setIsPurchaseInstallmentsModalOpen(false)}
        vehicleName={`${brand.trim() || 'Veículo'} ${model.trim() || plate.trim() || 'Frota'}`.trim()}
        vehicleIdentifier={(plate.trim() || serialNumber.trim() || fleetNumber.trim() || 'S/N').toUpperCase()}
        purchaseValue={purchaseValue ? desformatarMoeda(purchaseValue) : 0}
        baseDate={purchaseDate || new Date().toISOString().split('T')[0]}
        firstDueDate={firstInstallmentDueDate || undefined}
        initialInstallmentsCount={Math.max(1, parseInt(installmentsCount, 10) || 1)}
        existingInstallments={savedPurchaseInstallmentRows.length > 0 ? savedPurchaseInstallmentRows : (editingVehicle?.purchaseInstallmentRows || undefined)}
        initialIntervalDays={purchaseInstallmentIntervalDays ?? editingVehicle?.purchaseInstallmentIntervalDays ?? null}
        supplierName={purchaseSupplier.trim() || ownerName.trim()}
        invoiceNumber={purchaseInvoiceNumber.trim()}
        financialInstitution={financialInstitution.trim()}
        onConfirmAndSave={handleConfirmPurchaseInstallments}
      />
    </div>
  );
};
