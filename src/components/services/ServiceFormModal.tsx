import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Scissors, 
  Wheat, 
  Tractor, 
  Wrench, 
  FileText, 
  ShoppingCart, 
  Calendar, 
  Clock, 
  User, 
  Plus, 
  Check, 
  Layers, 
  Sparkles, 
  Info, 
  Truck, 
  Trash2, 
  TrendingUp, 
  Gauge, 
  UserPlus, 
  ArrowRight, 
  Calculator, 
  ShieldCheck, 
  AlertCircle,
  Printer,
  PrinterCheck,
  Lock,
  LogOut,
  CheckCircle2,
  Handshake
} from 'lucide-react';
import { 
  ServiceOrder, 
  Machinery, 
  Employee, 
  Client, 
  ServiceTruckItem, 
  CompanyProfile,
  ServiceFuelEntry,
  ServiceMealExpense,
  BrokerSettlement,
  ThirdPartySettlement
} from '../../types';
import { 
  formatCurrencyBRL, 
  getStoredBrokerSettlements, 
  saveStoredBrokerSettlements,
  getStoredSettlements,
  saveStoredSettlements
} from '../../lib/storage';
import { parseCurrencyToFloat, maskCurrencyBRLInput, formatCurrencyBRLOnBlur } from '../../lib/formatters';
// Cadastro Unificado de Cliente (Modal Completo Oficial "Novo Produtor Rural / Pecuarista")
import { ClientModal } from '../crm/ClientModal';
import { TractorBlock } from './TractorBlock';
import { TruckFleetSection, calculateTruckFreightCommission } from './TruckFleetSection';
import { DRESummaryBlock, TruckExpenseDetail } from './DRESummaryBlock';
import { 
  ServiceDocumentPreview, 
  PrintContentType, 
  PrintPaperFormat 
} from './ServiceDocumentPreview';
import { PrintReportHeader } from '../common/PrintReportHeader';
import { PrintReportFooter } from '../common/PrintReportFooter';
import { 
  isForrageira, 
  findLinkedOperator, 
  formatEmployeeOptionLabel,
  formatMachineryOptionLabel,
  isBrokerEmployee,
  isThirdPartyTruck
} from './serviceHelpers';

export type ServiceTabType = 'corte' | 'colheita' | 'trator' | 'maquina' | 'frete' | 'orcamento' | 'venda';

interface ServiceFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (service: ServiceOrder) => void;
  activeTab: ServiceTabType;
  clients?: Client[];
  machineries?: Machinery[];
  employees?: Employee[];
  companyProfile?: CompanyProfile;
  nextNumber?: string;
  editRecord?: ServiceOrder | null;
  onSaveClient?: (newClient: Client) => void;
}

export const ServiceFormModal: React.FC<ServiceFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  activeTab,
  clients = [],
  machineries = [],
  employees = [],
  companyProfile,
  nextNumber,
  editRecord,
  onSaveClient,
}) => {
  // Estado para Modal Rápida de Cliente (Nested Dialog)
  const [isQuickClientOpen, setIsQuickClientOpen] = useState(false);

  // 1. Identificação e Cliente
  const [numero, setNumero] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientName, setClientName] = useState('');
  const [farmName, setFarmName] = useState('');
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [completionDate, setCompletionDate] = useState('');
  const [maintenanceType, setMaintenanceType] = useState<
    'preventiva' | 'corretiva' | 'revisao_periodica' | 'preditiva' | 'reforma_entressafra'
  >('preventiva');
  const [maintenanceMachineryId, setMaintenanceMachineryId] = useState('');
  const [maintenanceHourMeter, setMaintenanceHourMeter] = useState('');
  const [status, setStatus] = useState<'agendado' | 'em_andamento' | 'concluido' | 'cancelado'>('agendado');

  // Estados da Aba 1: Seleção de Equipamentos & Regras de Cobrança (Serviços e Aluguel de Máquinas/Caminhões/Fretes)
  const [equipmentCategory, setEquipmentCategory] = useState<'pesadas' | 'caminhoes'>('pesadas');
  const [heavyMachineType, setHeavyMachineType] = useState<string>('Retroescavadeira');
  const [heavyMachineHours, setHeavyMachineHours] = useState<number | ''>('');
  const [heavyMachineHourlyRate, setHeavyMachineHourlyRate] = useState<string | number>('');

  // Caminhões / Transporte / Frete
  const [truckServiceId, setTruckServiceId] = useState<string>('');
  const [truckServiceName, setTruckServiceName] = useState<string>('');
  const [truckBillingMode, setTruckBillingMode] = useState<'km' | 'horas' | 'cargas' | 'viagem' | 'cargas_km' | 'somente_km'>('horas');
  const [truckServiceHours, setTruckServiceHours] = useState<number | ''>('');
  const [truckServiceHourlyRate, setTruckServiceHourlyRate] = useState<string | number>('');
  const [truckServiceLoads, setTruckServiceLoads] = useState<number | ''>('');
  const [truckServiceRatePerLoad, setTruckServiceRatePerLoad] = useState<string | number>('');
  const [truckServiceAdditionalKm, setTruckServiceAdditionalKm] = useState<number | ''>('');
  const [truckServiceRatePerKm, setTruckServiceRatePerKm] = useState<string | number>('');
  const [truckServiceTotalKm, setTruckServiceTotalKm] = useState<number | ''>('');
  const [truckServiceRateOnlyKm, setTruckServiceRateOnlyKm] = useState<string | number>('');
  const [truckServiceTrips, setTruckServiceTrips] = useState<number | ''>('');
  const [truckServiceRatePerTrip, setTruckServiceRatePerTrip] = useState<string | number>('');

  // Dados Adicionais de Frete / Logística
  const [freightMaterialType, setFreightMaterialType] = useState<string>('');
  const [freightOrigin, setFreightOrigin] = useState<string>('');
  const [freightDestination, setFreightDestination] = useState<string>('');
  const [freightDriverId, setFreightDriverId] = useState<string>('');
  const [freightDriverName, setFreightDriverName] = useState<string>('');

  // 2. Área e Unidades (Corte e Colheita)
  const [unidadeArea, setUnidadeArea] = useState<'hectares' | 'alqueires' | 'hora'>('hectares');
  const [quantidadeArea, setQuantidadeArea] = useState<number | ''>('');
  const [valorPorHectare, setValorPorHectare] = useState<string | number>('');
  const [pesoPorM3, setPesoPorM3] = useState<number | ''>(650);

  // 3. Bloco Forrageira / Ensiladeira (Borda Amarela)
  const [forrageiraId, setForrageiraId] = useState('');
  const [forrageiraNome, setForrageiraNome] = useState('');
  const [operadorForrageiraId, setOperadorForrageiraId] = useState('');
  const [operadorForrageiraNome, setOperadorForrageiraNome] = useState('');
  const [segundoOperadorForrageiraId, setSegundoOperadorForrageiraId] = useState('');
  const [segundoOperadorForrageiraNome, setSegundoOperadorForrageiraNome] = useState('');
  const [horasTambor, setHorasTambor] = useState<number | ''>('');
  const [horasMotor, setHorasMotor] = useState<number | ''>('');
  const [valorHoraForrageira, setValorHoraForrageira] = useState<number | ''>('');
  // Alternância (Toggles) e Comissão da Forrageira (4 modalidades)
  const [modoComissaoForrageira, setModoComissaoForrageira] = useState<'tambor' | 'motor' | 'area' | 'livre'>('area');
  const [qtdBaseComissaoForrageira, setQtdBaseComissaoForrageira] = useState<number | ''>('');
  const [taxaComissaoForrageira, setTaxaComissaoForrageira] = useState<number | ''>('');

  // =========================================================================
  // HELPERS DE COMISSÃO DO OPERADOR DA FORRAGEIRA (DINÂMICO)
  // =========================================================================
  const getSelectedForageOperator = (empId?: string, empName?: string): Employee | undefined => {
    if (empId) {
      const found = employees.find((e) => e.id === empId);
      if (found) return found;
    }
    if (empName && empName.trim()) {
      const clean = empName.toLowerCase().trim();
      return employees.find((e) => e.name.toLowerCase().trim() === clean);
    }
    return undefined;
  };

  const getEmpCommissionPerHectare = (emp?: Employee | null): number => {
    if (!emp) return 0;
    const anyEmp = emp as any;
    const val = anyEmp.comissao_hectare ?? anyEmp.comissaoHectare ?? anyEmp.commission_hectare ?? emp.commissionPerHectare ?? 0;
    return typeof val === 'number' ? val : Number(val) || 0;
  };

  const getEmpCommissionPerHour = (emp?: Employee | null): number => {
    if (!emp) return 0;
    const anyEmp = emp as any;
    const val = anyEmp.comissao_hora ?? anyEmp.comissaoHora ?? anyEmp.commission_hour ?? emp.commissionPerHour ?? 0;
    return typeof val === 'number' ? val : Number(val) || 0;
  };

  // Aplica dinamicamente a taxa e o modo de comissão do operador da forrageira conforme a modalidade ativa
  // 🚨 DIRETIVA DE SEGURANÇA MÁXIMA: A aba "alqueires" permanece 100% congelada com a regra e fórmula original
  const applyForageOperatorCommission = (
    emp: Employee | undefined,
    targetUnit: 'hectares' | 'alqueires' | 'hora'
  ) => {
    if (!emp) return;

    if (targetUnit === 'hectares') {
      // 1. Modalidade "Por Hectare (ha)"
      const taxaHa = getEmpCommissionPerHectare(emp);
      if (taxaHa > 0) {
        setModoComissaoForrageira('area');
        setTaxaComissaoForrageira(Number(taxaHa.toFixed(2)));
      } else if (getEmpCommissionPerHour(emp) > 0) {
        setModoComissaoForrageira('tambor');
        setTaxaComissaoForrageira(Number(getEmpCommissionPerHour(emp).toFixed(2)));
      }
    } else if (targetUnit === 'hora') {
      // 2. Modalidade "Por Hora (h)"
      const taxaHora = getEmpCommissionPerHour(emp);
      if (taxaHora > 0) {
        setModoComissaoForrageira('tambor');
        setTaxaComissaoForrageira(Number(taxaHora.toFixed(2)));
      }
    } else {
      // 3. Aba "Por Alqueire (alq)" - 🚨 100% CONGELADO / INTOCADO
      if (emp.commissionPerHour) {
        setModoComissaoForrageira('tambor');
        setTaxaComissaoForrageira(Number(emp.commissionPerHour.toFixed(2)));
      } else if (emp.commissionPerHectare || emp.commissionPerAlqueire) {
        setModoComissaoForrageira('area');
        const rate = emp.commissionPerHectare || emp.commissionPerAlqueire || 0;
        setTaxaComissaoForrageira(Number(rate.toFixed(2)));
      }
    }
  };

  // 4. Bloco Trator / Máquina (Borda Azul) com Independência Total
  const [tratorId, setTratorId] = useState('');
  const [tratorNome, setTratorNome] = useState('');
  const [operadorTratorId, setOperadorTratorId] = useState('');
  const [operadorTratorNome, setOperadorTratorNome] = useState('');
  const [segundoOperadorTratorId, setSegundoOperadorTratorId] = useState('');
  const [segundoOperadorTratorNome, setSegundoOperadorTratorNome] = useState('');
  // Faturamento da Máquina
  const [modoCobrancaTrator, setModoCobrancaTrator] = useState<'horas' | 'area_alq' | 'area_ha'>('horas');
  const [qtdCobrancaTrator, setQtdCobrancaTrator] = useState<number | ''>('');
  const [valorUnitarioTrator, setValorUnitarioTrator] = useState<number | ''>('');
  // Comissão do Operador (Independente)
  const [modoComissaoOperador, setModoComissaoOperador] = useState<'horas' | 'area_alq' | 'area_ha' | 'livre'>('horas');
  const [qtdBaseComissao, setQtdBaseComissao] = useState<number | ''>('');
  const [taxaComissaoOperador, setTaxaComissaoOperador] = useState<number | ''>('');

  // 4.5. Bloco Agenciador / Intermediação
  const [brokerId, setBrokerId] = useState('');
  const [brokerName, setBrokerName] = useState('');
  const [brokerCommissionType, setBrokerCommissionType] = useState<string>('Porcentagem (%) sobre o valor do pedido');
  const [brokerCommissionRate, setBrokerCommissionRate] = useState<number | ''>('');

  // 5. Seção Dinâmica de Frotas / Caminhões
  const [truckFleetPercentage, setTruckFleetPercentage] = useState<number | ''>(10);
  const [trucks, setTrucks] = useState<ServiceTruckItem[]>([]);

  // 6. Frete Prancha (Soma ao Faturamento Total do Pedido)
  const [fretePrancha, setFretePrancha] = useState<string | number>('');

  // 7. Custos Operacionais: Combustível e Alimentação (DRE)
  const [fuelEntries, setFuelEntries] = useState<ServiceFuelEntry[]>([]);
  const [mealExpenses, setMealExpenses] = useState<ServiceMealExpense[]>([]);

  // 8. Observações
  const [observacoes, setObservacoes] = useState('');

  // 9. Estados para o Modal / Tela de Prévia e Impressão
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [printPreviewContentType, setPrintPreviewContentType] = useState<PrintContentType>('client');
  const [printPreviewPaperFormat, setPrintPreviewPaperFormat] = useState<PrintPaperFormat>('thermal_80mm');

  // 10. Controle de Salvamento e Persistência na Tela (UX)
  const [savedOrder, setSavedOrder] = useState<ServiceOrder | null>(null);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [isSaveSuccessToast, setIsSaveSuccessToast] = useState(false);

  // Conjunto de IDs de Maquinários já Selecionados (REGRA DE EXCLUSÃO)
  const selectedMachineryIds = useMemo(() => {
    const ids = new Set<string>();
    if (forrageiraId) ids.add(forrageiraId);
    if (tratorId) ids.add(tratorId);
    trucks.forEach((t) => {
      if (t.machineryId) ids.add(t.machineryId);
    });
    return ids;
  }, [forrageiraId, tratorId, trucks]);

  // Lista de caminhões da frota disponíveis para serviços de transporte (Aba 1)
  const frotasCaminhoesDisponiveis = useMemo(() => {
    const list = machineries.filter(
      (m) =>
        m.categoryType === 'caminhao' ||
        m.compositionType === 'cavalo' ||
        (m.name && m.name.toLowerCase().includes('caminh')) ||
        (m.model && m.model.toLowerCase().includes('caminh')) ||
        (m.model &&
          (m.model.toLowerCase().includes('scania') ||
            m.model.toLowerCase().includes('volvo') ||
            m.model.toLowerCase().includes('mercedes') ||
            m.model.toLowerCase().includes('iveco') ||
            m.model.toLowerCase().includes('vw') ||
            m.model.toLowerCase().includes('constellation') ||
            m.model.toLowerCase().includes('axor') ||
            m.model.toLowerCase().includes('actros') ||
            m.model.toLowerCase().includes('fh')))
    );
    return list.length > 0 ? list : machineries;
  }, [machineries]);

  // Lista estritamente filtrada de Forrageiras disponíveis
  const forrageirasDisponiveis = useMemo(() => {
    return machineries.filter((m) => {
      if (!isForrageira(m)) return false;
      return m.id === forrageiraId || !selectedMachineryIds.has(m.id);
    });
  }, [machineries, forrageiraId, selectedMachineryIds]);

  // Lista filtrada de Colaboradores cujo Tipo de Cadastro ou Função seja "Agenciador"
  const agenciadoresDisponiveis = useMemo(() => {
    return employees.filter((emp) => isBrokerEmployee(emp));
  }, [employees]);

  // Sincroniza dados e configurações do Agenciador ao selecioná-lo no dropdown
  const handleSelectBroker = (selectedId: string) => {
    setBrokerId(selectedId);
    if (!selectedId) {
      setBrokerName('');
      setBrokerCommissionRate('');
      return;
    }
    const emp = employees.find((e) => e.id === selectedId);
    if (emp) {
      setBrokerName((emp.name || '').toUpperCase());
      const type = emp.brokerCommissionType || 'Porcentagem (%) sobre o valor do pedido';
      setBrokerCommissionType(type);
      const val = emp.brokerCommissionValue !== undefined && emp.brokerCommissionValue !== null ? emp.brokerCommissionValue : 5;
      setBrokerCommissionRate(val);
    }
  };

  // Carrega dados iniciais ou do registro em edição
  useEffect(() => {
    if (!isOpen) return;

    if (editRecord) {
      setNumero(editRecord.orderNumber || editRecord.id);
      setClientId(editRecord.clientId || '');
      setClientName(editRecord.clientName || '');
      setFarmName(editRecord.farmName || '');
      setServiceDate(editRecord.startDate || new Date().toISOString().split('T')[0]);
      setStatus(editRecord.status || 'agendado');

      setUnidadeArea(editRecord.areaUnit || 'hectares');
      setQuantidadeArea(editRecord.areaQuantity ?? editRecord.areaHectares ?? '');
      setValorPorHectare(
        editRecord.ratePerAreaUnit !== undefined 
          ? maskCurrencyBRLInput(editRecord.ratePerAreaUnit) 
          : editRecord.ratePerUnit !== undefined 
          ? maskCurrencyBRLInput(editRecord.ratePerUnit) 
          : ''
      );
      setPesoPorM3(editRecord.densityKg ?? editRecord.weightPerM3Kg ?? 650);

      // Forrageira
      setForrageiraId(editRecord.forageHarvesterId ?? '');
      setForrageiraNome(editRecord.forageHarvesterName ?? '');
      setOperadorForrageiraId(editRecord.forageOperatorId ?? '');
      setOperadorForrageiraNome(editRecord.forageOperatorName ?? '');
      setSegundoOperadorForrageiraId(editRecord.forageSecondOperatorId ?? '');
      setSegundoOperadorForrageiraNome(editRecord.forageSecondOperatorName ?? '');
      setHorasTambor(editRecord.forageDrumHours ?? '');
      setHorasMotor(editRecord.forageEngineHours ?? '');
      setValorHoraForrageira(editRecord.forageRatePerHour ?? '');
      const fMode = (editRecord.forageCommissionMode === 'tambor' || editRecord.forageCommissionMode === 'motor' || editRecord.forageCommissionMode === 'area' || editRecord.forageCommissionMode === 'livre')
        ? editRecord.forageCommissionMode
        : 'tambor';
      setModoComissaoForrageira(fMode);
      if (editRecord.forageCommissionBase !== undefined && editRecord.forageCommissionBase !== '') {
        setQtdBaseComissaoForrageira(editRecord.forageCommissionBase);
      } else {
        setQtdBaseComissaoForrageira(
          fMode === 'motor'
            ? (editRecord.forageEngineHours ?? '')
            : fMode === 'area'
            ? (editRecord.areaQuantity ?? '')
            : (editRecord.forageDrumHours ?? editRecord.areaQuantity ?? '')
        );
      }
      setTaxaComissaoForrageira(
        typeof editRecord.forageCommissionRate === 'number'
          ? Number(editRecord.forageCommissionRate.toFixed(2))
          : editRecord.forageOperatorCommission
          ? Number((editRecord.forageOperatorCommission / (editRecord.forageDrumHours || 1)).toFixed(2))
          : ''
      );

      // Trator
      setTratorId(editRecord.tractorId ?? '');
      setTratorNome(editRecord.tractorName ?? '');
      setOperadorTratorId(editRecord.tractorOperatorId ?? '');
      setOperadorTratorNome(editRecord.tractorOperatorName ?? '');
      setSegundoOperadorTratorId(editRecord.tractorSecondOperatorId ?? '');
      setSegundoOperadorTratorNome(editRecord.tractorSecondOperatorName ?? '');
      
      // Cobrança Trator
      const tMode = editRecord.tractorBillingMode || editRecord.tractorCalculationMode || 'horas';
      if (tMode === 'area') {
        setModoCobrancaTrator(editRecord.areaUnit === 'alqueires' ? 'area_alq' : 'area_ha');
        setQtdCobrancaTrator(editRecord.areaQuantity ?? editRecord.areaHectares ?? '');
      } else {
        setModoCobrancaTrator('horas');
        setQtdCobrancaTrator(editRecord.tractorHours ?? '');
      }
      setValorUnitarioTrator(editRecord.tractorRatePerHour ?? '');

      // Comissão Trator
      const opMode = editRecord.tractorOperatorCommissionMode || 'horas';
      if (opMode === 'area') {
        setModoComissaoOperador(editRecord.areaUnit === 'alqueires' ? 'area_alq' : 'area_ha');
        setQtdBaseComissao(editRecord.areaQuantity ?? editRecord.areaHectares ?? '');
      } else if (opMode === 'livre') {
        setModoComissaoOperador('livre');
        setQtdBaseComissao(editRecord.tractorOperatorHours ?? editRecord.tractorHours ?? '');
      } else {
        setModoComissaoOperador('horas');
        setQtdBaseComissao(editRecord.tractorOperatorHours ?? editRecord.tractorHours ?? '');
      }
      setTaxaComissaoOperador(
        typeof editRecord.tractorOperatorCommissionRate === 'number'
          ? Number(editRecord.tractorOperatorCommissionRate.toFixed(2))
          : ''
      );

      // Frotas
      setTruckFleetPercentage(editRecord.truckFleetPercentage ?? 10);
      setTrucks(editRecord.trucks || []);

      // Frete Prancha & Custos Operacionais
      setFretePrancha(
        editRecord.fretePrancha !== undefined 
          ? maskCurrencyBRLInput(editRecord.fretePrancha) 
          : editRecord.flatbedFreight !== undefined 
          ? maskCurrencyBRLInput(editRecord.flatbedFreight) 
          : ''
      );
      setFuelEntries(editRecord.fuelEntries || []);
      setMealExpenses(editRecord.mealExpenses || []);

      // Agenciador / Intermediação
      setBrokerId(editRecord.brokerId ?? '');
      setBrokerName(editRecord.brokerName ?? '');
      setBrokerCommissionType(editRecord.brokerCommissionType ?? 'Porcentagem (%) sobre o valor do pedido');
      setBrokerCommissionRate(editRecord.brokerCommissionRate ?? '');

      setCompletionDate(editRecord.completionDate || '');
      setMaintenanceMachineryId(editRecord.machineryId || '');
      if (editRecord.startDate) {
        setServiceDate(editRecord.startDate);
      }

      // Estados da Aba 1 (Máquinas Pesadas / Transporte)
      setEquipmentCategory(editRecord.equipmentCategory || (editRecord.truckBillingMode ? 'caminhoes' : 'pesadas'));
      setHeavyMachineType(editRecord.machineSpecificType || editRecord.machineryAssigned || 'Retroescavadeira');
      setHeavyMachineHours(editRecord.machineHours ?? (editRecord.areaUnit === 'hora' ? editRecord.areaQuantity : '') ?? '');
      setHeavyMachineHourlyRate(
        editRecord.machineHourlyRate !== undefined
          ? maskCurrencyBRLInput(editRecord.machineHourlyRate)
          : editRecord.ratePerUnit !== undefined && activeTab === 'maquina'
          ? maskCurrencyBRLInput(editRecord.ratePerUnit)
          : ''
      );
      setTruckServiceId(editRecord.machineryId || '');
      setTruckServiceName(editRecord.machineryAssigned || '');
      setTruckBillingMode(editRecord.truckBillingMode || (activeTab === 'frete' ? 'km' : 'horas'));
      setTruckServiceHours(editRecord.truckServiceHours ?? '');
      setTruckServiceHourlyRate(
        editRecord.truckServiceHourlyRate !== undefined ? maskCurrencyBRLInput(editRecord.truckServiceHourlyRate) : ''
      );
      setTruckServiceLoads(editRecord.truckServiceLoads ?? '');
      setTruckServiceRatePerLoad(
        editRecord.truckServiceRatePerLoad !== undefined ? maskCurrencyBRLInput(editRecord.truckServiceRatePerLoad) : ''
      );
      setTruckServiceAdditionalKm(editRecord.truckServiceKmAdditional ?? '');
      setTruckServiceRatePerKm(
        editRecord.truckServiceRatePerKm !== undefined ? maskCurrencyBRLInput(editRecord.truckServiceRatePerKm) : ''
      );
      setTruckServiceTotalKm(editRecord.truckServiceTotalKm ?? '');
      setTruckServiceRateOnlyKm(
        editRecord.truckServiceRateOnlyKm !== undefined ? maskCurrencyBRLInput(editRecord.truckServiceRateOnlyKm) : ''
      );
      setTruckServiceTrips(editRecord.truckServiceTrips ?? '');
      setTruckServiceRatePerTrip(
        editRecord.truckServiceRatePerTrip !== undefined ? maskCurrencyBRLInput(editRecord.truckServiceRatePerTrip) : ''
      );

      // Dados de Frete
      setFreightMaterialType(editRecord.freightMaterialType || '');
      setFreightOrigin(editRecord.freightOrigin || '');
      setFreightDestination(editRecord.freightDestination || '');
      setFreightDriverId(editRecord.freightDriverId || editRecord.operatorId || '');
      setFreightDriverName(editRecord.freightDriverName || editRecord.operatorAssigned || '');

      setObservacoes(editRecord.notes || '');
      setSavedOrder(editRecord || null);
      setSaveSuccessMessage(null);
    } else {
      // Novo registro padrão
      setNumero(nextNumber || `#${Date.now().toString().slice(-4)}`);
      setClientId('');
      setClientName('');
      setFarmName('');
      setServiceDate(new Date().toISOString().split('T')[0]);
      setStatus('agendado');

      // Reset Aba 1 & Frete
      if (activeTab === 'frete') {
        setEquipmentCategory('caminhoes');
        setTruckBillingMode('km');
        if (frotasCaminhoesDisponiveis.length > 0) {
          setTruckServiceId(frotasCaminhoesDisponiveis[0].id);
          setTruckServiceName(frotasCaminhoesDisponiveis[0].name || frotasCaminhoesDisponiveis[0].model);
        } else {
          setTruckServiceId('');
          setTruckServiceName('');
        }
      } else {
        setEquipmentCategory('pesadas');
        setTruckBillingMode('horas');
        setTruckServiceId('');
        setTruckServiceName('');
      }
      setHeavyMachineType('Retroescavadeira');
      setHeavyMachineHours('');
      setHeavyMachineHourlyRate('');
      setTruckServiceHours('');
      setTruckServiceHourlyRate('');
      setTruckServiceLoads('');
      setTruckServiceRatePerLoad('');
      setTruckServiceAdditionalKm('');
      setTruckServiceRatePerKm('');
      setTruckServiceTotalKm('');
      setTruckServiceRateOnlyKm('');
      setTruckServiceTrips('');
      setTruckServiceRatePerTrip('');

      setFreightMaterialType('');
      setFreightOrigin('');
      setFreightDestination('');
      setFreightDriverId('');
      setFreightDriverName('');

      setUnidadeArea('hectares');
      setQuantidadeArea('');
      setValorPorHectare('');
      setPesoPorM3(650);

      // Forrageira
      setForrageiraId('');
      setForrageiraNome('');
      setOperadorForrageiraId('');
      setOperadorForrageiraNome('');
      setSegundoOperadorForrageiraId('');
      setSegundoOperadorForrageiraNome('');
      setHorasTambor('');
      setHorasMotor('');
      setValorHoraForrageira('');
      setModoComissaoForrageira('area');
      setQtdBaseComissaoForrageira('');
      setTaxaComissaoForrageira('');

      // Trator
      setTratorId('');
      setTratorNome('');
      setOperadorTratorId('');
      setOperadorTratorNome('');
      setSegundoOperadorTratorId('');
      setSegundoOperadorTratorNome('');
      setModoCobrancaTrator('horas');
      setQtdCobrancaTrator('');
      setValorUnitarioTrator('');
      setModoComissaoOperador('horas');
      setQtdBaseComissao('');
      setTaxaComissaoOperador('');

      // Frotas
      setTruckFleetPercentage(10);
      setTrucks([]);

      // Frete Prancha & Custos Operacionais
      setFretePrancha('');
      setFuelEntries([]);
      setMealExpenses([]);

      // Agenciador / Intermediação
      setBrokerId('');
      setBrokerName('');
      setBrokerCommissionType('Porcentagem (%) sobre o valor do pedido');
      setBrokerCommissionRate('');

      setCompletionDate('');
      setMaintenanceType('preventiva');
      setMaintenanceMachineryId('');
      setMaintenanceHourMeter('');

      setObservacoes('');
      setSavedOrder(null);
      setSaveSuccessMessage(null);
    }
  }, [isOpen, editRecord, nextNumber]);

  // Sincroniza dados do cliente ao selecionar no select
  const handleSelectClient = (selectedId: string) => {
    setClientId(selectedId);
    const client = clients.find((c) => c.id === selectedId);
    if (client) {
      setClientName(client.name);
      setFarmName(client.farmName || '');
      if (client.areaHectares && !quantidadeArea) {
        setQuantidadeArea(client.areaHectares);
      }
    }
  };

  // Callback de sucesso da QuickClientModal
  const handleQuickClientCreated = (newClient: Client) => {
    if (onSaveClient) {
      onSaveClient(newClient);
    }
    setClientId(newClient.id);
    setClientName(newClient.name);
    setFarmName(newClient.farmName || '');
    if (newClient.areaHectares) {
      setQuantidadeArea(newClient.areaHectares);
    }
    setIsQuickClientOpen(false);
  };

  // Limpeza / Opção Neutra para Forrageira
  const handleClearForrageira = () => {
    setForrageiraId('');
    setForrageiraNome('');
    setOperadorForrageiraId('');
    setOperadorForrageiraNome('');
    setSegundoOperadorForrageiraId('');
    setSegundoOperadorForrageiraNome('');
    setHorasTambor('');
    setHorasMotor('');
    setValorHoraForrageira('');
    setQtdBaseComissaoForrageira('');
    setTaxaComissaoForrageira('');
  };

  // Seleção de Forrageira com Autocompletar (Operador Principal) e Segundo Operador VAZIO
  const handleSelectForrageira = (id: string) => {
    if (!id) {
      handleClearForrageira();
      return;
    }

    const mach = machineries.find((m) => m.id === id);
    if (!mach) return;

    const nomeFormatado = formatMachineryOptionLabel(mach);
    const linkedOp = findLinkedOperator(mach, employees);

    setForrageiraId(mach.id);
    setForrageiraNome(nomeFormatado);
    // Preenche AUTOMATICAMENTE o OPERADOR PRINCIPAL
    setOperadorForrageiraId(linkedOp.id);
    setOperadorForrageiraNome(linkedOp.name);
    // Segundo Operador NUNCA preenchido, inicia sempre vazio
    setSegundoOperadorForrageiraId('');
    setSegundoOperadorForrageiraNome('');

    // Preenche taxa de comissão dinamicamente conforme a modalidade ativa
    const emp = getSelectedForageOperator(linkedOp.id, linkedOp.name);
    if (emp) {
      applyForageOperatorCommission(emp, unidadeArea);
    }
  };

  // Seleção de Trator dentro do TractorBlock (com suporte a Opção Neutra)
  const handleSelectTrator = (id: string, nome: string, linkedOp: { id: string; name: string }) => {
    if (!id) {
      setTratorId('');
      setTratorNome('');
      setOperadorTratorId('');
      setOperadorTratorNome('');
      setSegundoOperadorTratorId('');
      setSegundoOperadorTratorNome('');
      setQtdCobrancaTrator('');
      setValorUnitarioTrator('');
      setQtdBaseComissao('');
      setTaxaComissaoOperador('');
      return;
    }

    setTratorId(id);
    setTratorNome(nome);
    // Preenche AUTOMATICAMENTE o OPERADOR PRINCIPAL
    setOperadorTratorId(linkedOp.id);
    setOperadorTratorNome(linkedOp.name);
    // Segundo Operador NUNCA preenchido, inicia sempre vazio
    setSegundoOperadorTratorId('');
    setSegundoOperadorTratorNome('');

    // Preenche comissão se o operador tiver configurada
    if (linkedOp.id) {
      const emp = employees.find((e) => e.id === linkedOp.id);
      if (emp && emp.commissionPerHour) {
        setTaxaComissaoOperador(Number(emp.commissionPerHour.toFixed(2)));
      }
    }
  };

  // Manipulação de Frotas / Caminhões: Inicializa sempre em Branco para preenchimento manual ou escolha
  const handleAddTruck = () => {
    const newTruck: ServiceTruckItem = {
      id: 'truck_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      machineryId: '',
      truckName: '',
      plate: '',
      primaryDriverId: '',
      primaryDriverName: '',
      secondaryDriverId: '',
      secondaryDriverName: '',
      capacityM3: 0,
      tripLoads: 0,
      totalM3: 0,
      driverHours: 0,
      driverHourSource: 'manual',
      additionalKm: 0,
      ratePerKm: 0,
      totalAdditionalKm: 0,
      driverCommission: 0,
      truckHours: 0,
      truckHourlyRate: 0,
      truckTotalCost: 0,
    };

    setTrucks((prev) => [...prev, newTruck]);
  };

  const handleRemoveTruck = (truckId: string) => {
    setTrucks((prev) => prev.filter((t) => t.id !== truckId));
  };

  const handleUpdateTruck = (truckId: string, updates: Partial<ServiceTruckItem>) => {
    setTrucks((prev) =>
      prev.map((t) => (t.id === truckId ? { ...t, ...updates } : t))
    );
  };

  // Sincronização em tempo real das Horas da Forrageira com os caminhões que utilizam 'tambor' ou 'motor'
  useEffect(() => {
    setTrucks((prevTrucks) => {
      let changed = false;
      const nextTrucks = prevTrucks.map((t) => {
        if (t.driverHourSource === 'tambor') {
          const val = typeof horasTambor === 'number' ? horasTambor : 0;
          if (t.driverHours !== val) {
            changed = true;
            const mode = t.driverCommissionMode || 'horas';
            const rate = typeof t.driverCommissionRate === 'number' && t.driverCommissionRate > 0 ? t.driverCommissionRate : 10;
            const base = mode === 'horas' ? val : (t.tripLoads || 0);
            return { ...t, driverHours: val, driverCommissionRate: rate, driverCommission: base * rate };
          }
        } else if (t.driverHourSource === 'motor') {
          const val = typeof horasMotor === 'number' ? horasMotor : 0;
          if (t.driverHours !== val) {
            changed = true;
            const mode = t.driverCommissionMode || 'horas';
            const rate = typeof t.driverCommissionRate === 'number' && t.driverCommissionRate > 0 ? t.driverCommissionRate : 10;
            const base = mode === 'horas' ? val : (t.tripLoads || 0);
            return { ...t, driverHours: val, driverCommissionRate: rate, driverCommission: base * rate };
          }
        }
        return t;
      });
      return changed ? nextTrucks : prevTrucks;
    });
  }, [horasTambor, horasMotor]);

  // ==========================================
  // MATEMÁTICA FINANCEIRA E REGRAS DE CÁLCULO
  // ==========================================

  // 1. Valor Base do Serviço (Área)
  const valorBaseArea = useMemo(() => {
    const qtd = typeof quantidadeArea === 'number' ? quantidadeArea : 0;
    const taxa = parseCurrencyToFloat(valorPorHectare);
    return qtd * taxa;
  }, [quantidadeArea, valorPorHectare]);

  // 2. Faturamento do Trator (Cobrança Máquina ao Cliente) - Zerado se Neutro
  const subtotalTrator = useMemo(() => {
    if (!tratorId && !tratorNome.trim()) return 0;
    const qtd = typeof qtdCobrancaTrator === 'number' ? qtdCobrancaTrator : 0;
    const taxa = typeof valorUnitarioTrator === 'number' ? valorUnitarioTrator : 0;
    return qtd * taxa;
  }, [tratorId, tratorNome, qtdCobrancaTrator, valorUnitarioTrator]);

  // 3. Faturamento Forrageira (se aplicável) - Zerado se Neutro
  const subtotalForrageira = useMemo(() => {
    if (!forrageiraId && !forrageiraNome.trim()) return 0;
    const hTambor = typeof horasTambor === 'number' ? horasTambor : 0;
    const taxaH = typeof valorHoraForrageira === 'number' ? valorHoraForrageira : 0;
    return hTambor * taxaH;
  }, [forrageiraId, forrageiraNome, horasTambor, valorHoraForrageira]);

  // 4. Adicional KM (Total de todos os caminhões quando alqueires)
  const totalAdicionalKm = useMemo(() => {
    if (unidadeArea !== 'alqueires') return 0;
    return trucks.reduce((sum, t) => sum + (t.totalAdditionalKm || 0), 0);
  }, [trucks, unidadeArea]);

  // Custo Total de Transporte das Frotas por Hora (quando Hectares ou Por Hora)
  // Modalidade Por Alqueire permanece 100% congelada.
  const totalFrotasPorHora = useMemo(() => {
    if (unidadeArea !== 'hectares' && unidadeArea !== 'hora') return 0;
    return trucks.reduce((sum, t) => {
      const h = typeof t.truckHours === 'number' ? t.truckHours : 0;
      const rate = typeof t.truckHourlyRate === 'number' ? t.truckHourlyRate : 0;
      return sum + (h * rate);
    }, 0);
  }, [trucks, unidadeArea]);

  // Subtotal do Serviço de Máquina ou Transporte / Frete
  const subtotalServicoMaquina = useMemo(() => {
    if (activeTab !== 'maquina' && activeTab !== 'frete') return 0;
    if (activeTab === 'maquina' && equipmentCategory === 'pesadas') {
      const h = typeof heavyMachineHours === 'number' ? heavyMachineHours : 0;
      const rate = typeof heavyMachineHourlyRate === 'number'
        ? heavyMachineHourlyRate
        : parseCurrencyToFloat(heavyMachineHourlyRate);
      return Number((h * rate).toFixed(2));
    } else {
      // Regras de Cobrança do Frete / Caminhão: Por KM, Por Hora, Por Carga, Por Viagem
      if (truckBillingMode === 'horas') {
        const h = typeof truckServiceHours === 'number' ? truckServiceHours : 0;
        const rate = typeof truckServiceHourlyRate === 'number'
          ? truckServiceHourlyRate
          : parseCurrencyToFloat(truckServiceHourlyRate);
        return Number((h * rate).toFixed(2));
      } else if (truckBillingMode === 'cargas' || truckBillingMode === 'cargas_km') {
        const loads = typeof truckServiceLoads === 'number' ? truckServiceLoads : 0;
        const rateLoad = typeof truckServiceRatePerLoad === 'number'
          ? truckServiceRatePerLoad
          : parseCurrencyToFloat(truckServiceRatePerLoad);
        const km = typeof truckServiceAdditionalKm === 'number' ? truckServiceAdditionalKm : 0;
        const rateKm = typeof truckServiceRatePerKm === 'number'
          ? truckServiceRatePerKm
          : parseCurrencyToFloat(truckServiceRatePerKm);
        return Number(((loads * rateLoad) + (km * rateKm)).toFixed(2));
      } else if (truckBillingMode === 'km' || truckBillingMode === 'somente_km') {
        const km = typeof truckServiceTotalKm === 'number' ? truckServiceTotalKm : 0;
        const rateKm = typeof truckServiceRateOnlyKm === 'number'
          ? truckServiceRateOnlyKm
          : parseCurrencyToFloat(truckServiceRateOnlyKm);
        return Number((km * rateKm).toFixed(2));
      } else if (truckBillingMode === 'viagem') {
        const trips = typeof truckServiceTrips === 'number' ? truckServiceTrips : 0;
        const rateTrip = typeof truckServiceRatePerTrip === 'number'
          ? truckServiceRatePerTrip
          : parseCurrencyToFloat(truckServiceRatePerTrip);
        return Number((trips * rateTrip).toFixed(2));
      }
      return 0;
    }
  }, [
    activeTab,
    equipmentCategory,
    heavyMachineHours,
    heavyMachineHourlyRate,
    truckBillingMode,
    truckServiceHours,
    truckServiceHourlyRate,
    truckServiceLoads,
    truckServiceRatePerLoad,
    truckServiceAdditionalKm,
    truckServiceRatePerKm,
    truckServiceTotalKm,
    truckServiceRateOnlyKm,
    truckServiceTrips,
    truckServiceRatePerTrip,
  ]);

  // 5. TOTAL DO PEDIDO (Cobrado do Cliente - com Frete Prancha e Frotas por Hora quando Hectares ou Por Hora)
  const totalPedido = useMemo(() => {
    const valorFretePrancha = parseCurrencyToFloat(fretePrancha);
    if (activeTab === 'maquina' || activeTab === 'frete') {
      return subtotalServicoMaquina + valorFretePrancha;
    }
    // Inclusão da modalidade Por Hora (h) para frotas cobradas por hora
    const adicionalFrotasHoras = (unidadeArea === 'hectares' || unidadeArea === 'hora') ? totalFrotasPorHora : 0;
    return valorBaseArea + subtotalTrator + subtotalForrageira + totalAdicionalKm + adicionalFrotasHoras + valorFretePrancha;
  }, [activeTab, subtotalServicoMaquina, valorBaseArea, subtotalTrator, subtotalForrageira, totalAdicionalKm, totalFrotasPorHora, fretePrancha, unidadeArea]);

  // =========================================================================
  // REGRA 3: CORREÇÃO MATEMÁTICA NA DISTRIBUIÇÃO GLOBAL DE FROTAS
  // Incide EXCLUSIVAMENTE sobre o "Valor Base do Serviço (Área)".
  // O Trator é TOTALMENTE EXCLUÍDO da base de cálculo!
  // Em Hectares e Por Hora: reflete a Soma Total do Transporte (Por Horas)
  // Em Alqueires: regra de % Distribuição 100% congelada e preservada
  // =========================================================================
  const valorDistribuicaoFrotas = useMemo(() => {
    if (unidadeArea === 'hectares' || unidadeArea === 'hora') {
      return totalFrotasPorHora;
    }
    const pct = typeof truckFleetPercentage === 'number' ? truckFleetPercentage : 0;
    return (valorBaseArea * pct) / 100;
  }, [valorBaseArea, truckFleetPercentage, unidadeArea, totalFrotasPorHora]);

  // =========================================================================
  // REGRA 4: CÁLCULO DE RATIO PROPORCIONAL POR M³ INDIVIDUAL DOS CAMINHÕES
  // 1. Total m³ = Capacidade × Cargas
  // 2. Volume Geral Transportado = soma de todos os caminhões
  // 3. Valor de cada caminhão = (m³ Caminhão / Volume Geral) × Distribuição
  // =========================================================================
  const totalVolumeGeralM3 = useMemo(() => {
    return trucks.reduce((sum, t) => sum + ((t.capacityM3 || 0) * (t.tripLoads || 0)), 0);
  }, [trucks]);

  // =========================================================================
  // CÁLCULO AUTOMATIZADO DE ESTIMATIVA DE TONELADAS
  // Fórmula: Toneladas = (Total Transportado em m³ * Peso por m³ (Kg)) / 1000
  // =========================================================================
  const estimativaToneladas = useMemo(() => {
    const densidade = typeof pesoPorM3 === 'number' ? pesoPorM3 : 0;
    if (totalVolumeGeralM3 <= 0 || densidade <= 0) return 0;
    return Number(((totalVolumeGeralM3 * densidade) / 1000).toFixed(2));
  }, [totalVolumeGeralM3, pesoPorM3]);

  // =========================================================================
  // COMISSÕES DOS OPERADORES (INFORMATIVAS - DRE)
  // =========================================================================

  // A) Comissões Forrageira (com suporte a alternância Horas vs Área e Travamento Automático)
  const { comissaoForrageiraP1, comissaoForrageiraP2, formulaForrageiraP1, formulaForrageiraP2 } = useMemo(() => {
    if (!forrageiraId && !forrageiraNome.trim()) {
      return { comissaoForrageiraP1: 0, comissaoForrageiraP2: 0, formulaForrageiraP1: '', formulaForrageiraP2: '' };
    }

    // REGRA 2: 4 OPÇÕES DE COMISSÃO NA FORRAGEIRA
    // "Digitar (livre)": base livre informada pelo usuário
    // "Por Hora (tambor)": trava horasTambor
    // "Por Hora (h)": trava horasMotor
    // "Por Área (alq)": trava quantidadeArea
    const baseCalculada = modoComissaoForrageira === 'livre'
      ? (typeof qtdBaseComissaoForrageira === 'number' ? qtdBaseComissaoForrageira : 0)
      : modoComissaoForrageira === 'tambor'
      ? (typeof horasTambor === 'number' && horasTambor > 0
          ? horasTambor
          : (unidadeArea === 'hora' && typeof quantidadeArea === 'number' && quantidadeArea > 0 ? quantidadeArea : (typeof horasTambor === 'number' ? horasTambor : 0)))
      : modoComissaoForrageira === 'motor'
      ? (typeof horasMotor === 'number' && horasMotor > 0
          ? horasMotor
          : (unidadeArea === 'hora' && typeof quantidadeArea === 'number' && quantidadeArea > 0 ? quantidadeArea : (typeof horasMotor === 'number' ? horasMotor : 0)))
      : (typeof quantidadeArea === 'number' ? quantidadeArea : 0);

    const taxaP1 = typeof taxaComissaoForrageira === 'number' ? Number(taxaComissaoForrageira.toFixed(2)) : 0;
    const p1Val = Number((baseCalculada * taxaP1).toFixed(2));
    const unLabel = modoComissaoForrageira === 'livre'
      ? 'un'
      : modoComissaoForrageira === 'tambor'
      ? (typeof horasTambor === 'number' && horasTambor > 0 ? 'h (tambor)' : unidadeArea === 'hora' ? 'h' : 'h (tambor)')
      : modoComissaoForrageira === 'motor'
      ? 'h'
      : (unidadeArea === 'alqueires' ? 'alq' : 'ha');
    const p1Formula = taxaP1 > 0 && baseCalculada > 0 
      ? `${formatCurrencyBRL(taxaP1)}/${unLabel} × ${baseCalculada} ${unLabel} = ${formatCurrencyBRL(p1Val)}`
      : '';

    let p2Val = 0;
    let p2Formula = '';
    if (segundoOperadorForrageiraNome.trim()) {
      const empP2 = employees.find((e) => e.id === segundoOperadorForrageiraId);
      const taxaP2 = empP2 && (empP2.commissionPerHour || empP2.commissionPerHectare || empP2.commissionPerAlqueire)
        ? Number((empP2.commissionPerHour || empP2.commissionPerHectare || empP2.commissionPerAlqueire || 0).toFixed(2))
        : 0;
      if (taxaP2 > 0 && baseCalculada > 0) {
        p2Val = Number((baseCalculada * taxaP2).toFixed(2));
        p2Formula = `${formatCurrencyBRL(taxaP2)}/${unLabel} × ${baseCalculada} ${unLabel} = ${formatCurrencyBRL(p2Val)}`;
      }
    }

    return {
      comissaoForrageiraP1: p1Val,
      comissaoForrageiraP2: p2Val,
      formulaForrageiraP1: p1Formula,
      formulaForrageiraP2: p2Formula,
    };
  }, [
    forrageiraId,
    forrageiraNome,
    operadorForrageiraNome,
    segundoOperadorForrageiraNome,
    segundoOperadorForrageiraId,
    horasTambor,
    horasMotor,
    quantidadeArea,
    modoComissaoForrageira,
    qtdBaseComissaoForrageira,
    taxaComissaoForrageira,
    unidadeArea,
    employees
  ]);

  // B) Comissões Trator (Totalmente independentes do faturamento da máquina e Zeradas se Neutro)
  const { comissaoTratorP1, comissaoTratorP2, formulaTratorP1, formulaTratorP2 } = useMemo(() => {
    if (!tratorId && !tratorNome.trim()) {
      return { comissaoTratorP1: 0, comissaoTratorP2: 0, formulaTratorP1: '', formulaTratorP2: '' };
    }

    const qtdBase = typeof qtdBaseComissao === 'number' ? qtdBaseComissao : 0;
    const taxa = typeof taxaComissaoOperador === 'number' ? Number(taxaComissaoOperador.toFixed(2)) : 0;
    const p1Val = Number((qtdBase * taxa).toFixed(2));
    const unidadeOp = modoComissaoOperador === 'livre' ? 'un' : modoComissaoOperador === 'horas' ? 'h' : modoComissaoOperador === 'area_alq' ? 'alq' : 'ha';
    const p1Formula = taxa > 0 && qtdBase > 0 ? `${formatCurrencyBRL(taxa)}/${unidadeOp} × ${qtdBase} ${unidadeOp} = ${formatCurrencyBRL(p1Val)}` : '';

    // Segundo operador trator (se houver)
    let p2Val = 0;
    let p2Formula = '';
    if (segundoOperadorTratorNome.trim()) {
      const empP2 = employees.find((e) => e.id === segundoOperadorTratorId);
      if (empP2 && empP2.commissionPerHour && qtdBase > 0) {
        const taxaP2 = Number(empP2.commissionPerHour.toFixed(2));
        p2Val = Number((taxaP2 * qtdBase).toFixed(2));
        p2Formula = `${formatCurrencyBRL(taxaP2)}/h × ${qtdBase}h = ${formatCurrencyBRL(p2Val)}`;
      }
    }

    return {
      comissaoTratorP1: p1Val,
      comissaoTratorP2: p2Val,
      formulaTratorP1: p1Formula,
      formulaTratorP2: p2Formula,
    };
  }, [tratorId, tratorNome, qtdBaseComissao, taxaComissaoOperador, modoComissaoOperador, segundoOperadorTratorNome, segundoOperadorTratorId, employees]);

  // C) Comissão Agenciador / Intermediação
  const brokerCommissionAmount = useMemo(() => {
    if (!brokerId) return 0;
    const rate = typeof brokerCommissionRate === 'number' ? brokerCommissionRate : 0;
    if (rate <= 0) return 0;

    const typeStr = (brokerCommissionType || '').toLowerCase();
    if (typeStr.includes('valor do pedido') || typeStr.includes('pedido') || typeStr.includes('área') || typeStr.includes('area')) {
      // Calcule a comissão sobre o campo "Subtotal Área (Base)"
      return Number(((valorBaseArea * rate) / 100).toFixed(2));
    } else if (typeStr.includes('produção') || typeStr.includes('producao')) {
      // Calcule com base no valor da "Estimativa de Produção"
      return Number((estimativaToneladas * rate).toFixed(2));
    } else {
      // Se for "Valor Fixo": Aplique o valor cadastrado diretamente.
      return Number(rate.toFixed(2));
    }
  }, [brokerId, brokerCommissionType, brokerCommissionRate, valorBaseArea, estimativaToneladas]);

  // =========================================================================
  // REGRA 5: DETALHAMENTO CIRÚRGICO NA DRE (BLOCO CUSTOS E PROVENTOS ADICIONAIS)
  // Plotagem nominal de cada caminhão ativo: Placa, Motorista, Cargas, Cap m³, Total m³, % e Valor Proporcional + Adicional KM
  // =========================================================================
  const trucksExpenseDetails: TruckExpenseDetail[] = useMemo(() => {
    return trucks.map((truck) => {
      const cap = truck.capacityM3 || 0;
      const loads = truck.tripLoads || 0;
      const truckTotalM3 = cap * loads;
      
      // % de Distribuição Global do Caminhão = (Total m³ do Caminhão / Total Volume Geral) x 100
      const ratioPercent = totalVolumeGeralM3 > 0 
        ? (truckTotalM3 / totalVolumeGeralM3) * 100 
        : 0;

      // Valor do Rateio / Custo de Transporte
      // Em Hectares e Por Hora: Horas Trabalhadas x Valor por Hora
      // Em Alqueires: (Total m³ do Caminhão / Total Volume Geral) x Valor Total Distribuído da Frota (100% congelado)
      const rateioCost = (unidadeArea === 'hectares' || unidadeArea === 'hora')
        ? (Number(truck.truckHours) || 0) * (Number(truck.truckHourlyRate) || 0)
        : (totalVolumeGeralM3 > 0 
            ? (truckTotalM3 / totalVolumeGeralM3) * valorDistribuicaoFrotas 
            : 0);

      // Adicional KM individual do caminhão
      const additionalKmCost = truck.totalAdditionalKm ?? ((truck.additionalKm || 0) * (truck.ratePerKm || 0));

      // Comissão individual do Motorista de Frete (4 modalidades: Por KM, Por Hora, Por Tonelada/Carga ou Por Viagem)
      const commResult = calculateTruckFreightCommission(truck.driverCommissionMode, truck, pesoPorM3);
      const driverCommissionCost = typeof truck.driverCommission === 'number' ? truck.driverCommission : commResult.total;

      // Total Composto = Rateio + Adicional KM + Comissão do Motorista
      const totalCost = rateioCost + additionalKmCost + driverCommissionCost;

      return {
        truckId: truck.id,
        plate: truck.plate ? truck.plate.toUpperCase() : 'S/ Placa',
        driverName: truck.primaryDriverName || 'Motorista',
        loads: loads,
        capacityM3: cap,
        totalM3: truckTotalM3,
        distributionPercent: ratioPercent,
        rateioCost: rateioCost,
        additionalKmCost: additionalKmCost,
        driverCommissionCost: driverCommissionCost,
        totalCost: totalCost,
        truckHours: truck.truckHours,
        truckHourlyRate: truck.truckHourlyRate,
      };
    });
  }, [trucks, totalVolumeGeralM3, valorDistribuicaoFrotas, unidadeArea, pesoPorM3]);

  // =========================================================================
  // GESTÃO OPERACIONAL DE COMBUSTÍVEL E ALIMENTAÇÃO (DRE)
  // =========================================================================

  // Veículos ativos na operação (Forrageira, Trator, Caminhões ou Máquinas Pesadas)
  const activeVehicles = useMemo(() => {
    const list: { vehicleId: string; vehicleType: 'forrageira' | 'trator' | 'caminhao' | 'outro'; vehicleName: string }[] = [];

    if (activeTab === 'frete') {
      list.push({
        vehicleId: truckServiceId || 'veh_truck_service',
        vehicleType: 'caminhao',
        vehicleName: `Caminhão (${truckServiceName || 'Frota de Frete'})`,
      });
      return list;
    }

    if (activeTab === 'maquina') {
      if (equipmentCategory === 'pesadas' && heavyMachineType) {
        list.push({
          vehicleId: 'veh_heavy_machine',
          vehicleType: 'trator',
          vehicleName: `Máquina Pesada (${heavyMachineType})`,
        });
      } else if (equipmentCategory === 'caminhoes' && (truckServiceId || truckServiceName)) {
        list.push({
          vehicleId: truckServiceId || 'veh_truck_service',
          vehicleType: 'caminhao',
          vehicleName: `Caminhão (${truckServiceName || 'Frota'})`,
        });
      }
      return list;
    }

    if (forrageiraId || forrageiraNome.trim()) {
      list.push({
        vehicleId: forrageiraId || 'veh_forrageira',
        vehicleType: 'forrageira',
        vehicleName: forrageiraNome.trim() ? `Ensiladeira / Forrageira (${forrageiraNome.trim()})` : 'Ensiladeira / Forrageira',
      });
    }

    if (tratorId || tratorNome.trim()) {
      list.push({
        vehicleId: tratorId || 'veh_trator',
        vehicleType: 'trator',
        vehicleName: tratorNome.trim() ? `Trator Compactador (${tratorNome.trim()})` : 'Trator Compactador',
      });
    }

    trucks.forEach((t, idx) => {
      const plateStr = t.plate ? t.plate.toUpperCase() : '';
      const nameStr = t.truckName ? t.truckName : `Caminhão #${idx + 1}`;
      const desc = plateStr ? `${nameStr} [${plateStr}]` : nameStr;
      list.push({
        vehicleId: t.id || `veh_truck_${idx}`,
        vehicleType: 'caminhao',
        vehicleName: desc,
      });
    });

    return list;
  }, [activeTab, equipmentCategory, heavyMachineType, truckServiceId, truckServiceName, forrageiraId, forrageiraNome, tratorId, tratorNome, trucks]);

  // Sincroniza a lista fixa de combustível por veículo ativo
  useEffect(() => {
    setFuelEntries((prevEntries) => {
      return activeVehicles.map((veh) => {
        const existing = prevEntries.find(
          (e) => e.vehicleId === veh.vehicleId || (e.vehicleType === veh.vehicleType && veh.vehicleType !== 'caminhao')
        );
        const liters = existing ? existing.liters : '';
        const pricePerLiter = existing ? existing.pricePerLiter : '';
        const subtotal = (Number(liters) || 0) * (Number(pricePerLiter) || 0);
        return {
          vehicleId: veh.vehicleId,
          vehicleType: veh.vehicleType,
          vehicleName: veh.vehicleName,
          liters,
          pricePerLiter,
          subtotal,
        };
      });
    });
  }, [activeVehicles]);

  const handleFuelEntryChange = (vehicleId: string, field: 'liters' | 'pricePerLiter', val: number | '') => {
    setFuelEntries((prev) =>
      prev.map((item) => {
        if (item.vehicleId !== vehicleId) return item;
        const updated = { ...item, [field]: val };
        updated.subtotal = (Number(updated.liters) || 0) * (Number(updated.pricePerLiter) || 0);
        return updated;
      })
    );
  };

  const totalCombustivelGeral = useMemo(() => {
    return fuelEntries.reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0);
  }, [fuelEntries]);

  // Gestão de Alimentação e Diárias
  const handleAddMealExpense = () => {
    setMealExpenses((prev) => [
      ...prev,
      {
        id: `meal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        description: 'Almoço',
        date: serviceDate || new Date().toISOString().split('T')[0],
        amount: '',
      },
    ]);
  };

  const handleRemoveMealExpense = (id: string) => {
    setMealExpenses((prev) => prev.filter((m) => m.id !== id));
  };

  const handleMealExpenseChange = (id: string, field: 'description' | 'date' | 'amount', val: any) => {
    setMealExpenses((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        return { ...item, [field]: val };
      })
    );
  };

  const totalAlimentacaoGeral = useMemo(() => {
    return mealExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [mealExpenses]);

  // TOTAL GERAL DESPESAS (Soma exata de todas as comissões, frotas, combustível e alimentação)
  const totalGeralDespesas = useMemo(() => {
    const totalTrucksExpense = trucksExpenseDetails.reduce((sum, item) => sum + item.totalCost, 0);
    return comissaoForrageiraP1 + comissaoForrageiraP2 + comissaoTratorP1 + comissaoTratorP2 + brokerCommissionAmount + totalTrucksExpense + totalCombustivelGeral + totalAlimentacaoGeral;
  }, [comissaoForrageiraP1, comissaoForrageiraP2, comissaoTratorP1, comissaoTratorP2, brokerCommissionAmount, trucksExpenseDetails, totalCombustivelGeral, totalAlimentacaoGeral]);

  // RESULTADO FINAL (LUCRO ESTIMADO)
  const lucroEstimado = useMemo(() => {
    return totalPedido - totalGeralDespesas;
  }, [totalPedido, totalGeralDespesas]);

  const margemLucroPercent = useMemo(() => {
    return totalPedido > 0 ? (lucroEstimado / totalPedido) * 100 : 0;
  }, [totalPedido, lucroEstimado]);

  // Salvar Ordem de Serviço
  const handleSave = () => {
    if (!clientName.trim()) {
      alert('Por favor, selecione ou informe o Cliente / Produtor.');
      return;
    }

    if (activeTab === 'frete') {
      if (!truckServiceId && !truckServiceName) {
        alert('Por favor, selecione o caminhão da frota para o frete.');
        return;
      }
    }

    if (activeTab === 'maquina') {
      if (equipmentCategory === 'pesadas') {
        if (!heavyMachineType) {
          alert('Por favor, selecione a máquina pesada da frota.');
          return;
        }
      } else {
        if (!truckServiceId && !truckServiceName) {
          alert('Por favor, selecione o caminhão da frota.');
          return;
        }
      }
    }

    const updatedTrucks = trucks.map((t) => {
      const m3 = (t.capacityM3 || 0) * (t.tripLoads || 0);
      const ratio = totalVolumeGeralM3 > 0 ? (m3 / totalVolumeGeralM3) * 100 : 0;
      const truckCostHoras = (Number(t.truckHours) || 0) * (Number(t.truckHourlyRate) || 0);
      // Hectares e Por Hora usam cobrança por horas; Alqueires preserva o rateio percentual congelado
      const distVal = (unidadeArea === 'hectares' || unidadeArea === 'hora')
        ? truckCostHoras
        : (totalVolumeGeralM3 > 0 ? (m3 / totalVolumeGeralM3) * valorDistribuicaoFrotas : 0);
      return {
        ...t,
        totalM3: m3,
        ratioPercent: ratio,
        distributedValue: distVal,
        truckTotalCost: truckCostHoras,
      };
    });

    const isFreight = activeTab === 'frete';

    const newService: ServiceOrder = {
      id: editRecord?.id || 'serv_' + Date.now(),
      orderNumber: numero || `#${Date.now().toString().slice(-4)}`,
      clientId,
      clientName,
      farmName,
      serviceType: activeTab === 'frete'
        ? 'Serviço de Frete'
        : activeTab === 'corte'
        ? 'Corte de Silagem'
        : activeTab === 'colheita'
        ? 'Colheita'
        : activeTab === 'trator'
        ? 'Serviço de Trator'
        : activeTab === 'orcamento'
        ? 'Orçamento Agrícola'
        : activeTab === 'venda'
        ? 'Venda de Silagem'
        : 'Serviço de Máquina',
      serviceTab: activeTab,
      status,
      startDate: serviceDate,
      completionDate: completionDate || undefined,
      machineryId: isFreight
        ? (truckServiceId || undefined)
        : activeTab === 'maquina'
        ? (equipmentCategory === 'caminhoes' ? (truckServiceId || undefined) : (machineries.find((m) => (m.name || m.model) === heavyMachineType)?.id || undefined))
        : (activeTab === 'maquina' && maintenanceMachineryId ? maintenanceMachineryId : editRecord?.machineryId),
      machineryAssigned: isFreight
        ? (truckServiceName || 'Caminhão')
        : activeTab === 'maquina'
        ? (equipmentCategory === 'caminhoes' ? (truckServiceName || 'Caminhão') : heavyMachineType)
        : editRecord?.machineryAssigned,
      operatorId: isFreight ? (freightDriverId || undefined) : undefined,
      operatorAssigned: isFreight ? (freightDriverName || undefined) : undefined,
      equipmentCategory: isFreight ? 'caminhoes' : (activeTab === 'maquina' ? equipmentCategory : undefined),
      machineSpecificType: activeTab === 'maquina' && equipmentCategory === 'pesadas' ? heavyMachineType : undefined,
      machineHours: activeTab === 'maquina' && equipmentCategory === 'pesadas' && typeof heavyMachineHours === 'number' ? heavyMachineHours : undefined,
      machineHourlyRate: activeTab === 'maquina' && equipmentCategory === 'pesadas' ? parseCurrencyToFloat(heavyMachineHourlyRate) : undefined,
      
      // Frete & Transporte
      truckBillingMode: (isFreight || (activeTab === 'maquina' && equipmentCategory === 'caminhoes')) ? truckBillingMode : undefined,
      truckServiceHours: (isFreight || (activeTab === 'maquina' && equipmentCategory === 'caminhoes')) && typeof truckServiceHours === 'number' ? truckServiceHours : undefined,
      truckServiceHourlyRate: (isFreight || (activeTab === 'maquina' && equipmentCategory === 'caminhoes')) ? parseCurrencyToFloat(truckServiceHourlyRate) : undefined,
      truckServiceLoads: (isFreight || (activeTab === 'maquina' && equipmentCategory === 'caminhoes')) && typeof truckServiceLoads === 'number' ? truckServiceLoads : undefined,
      truckServiceRatePerLoad: (isFreight || (activeTab === 'maquina' && equipmentCategory === 'caminhoes')) ? parseCurrencyToFloat(truckServiceRatePerLoad) : undefined,
      truckServiceKmAdditional: (isFreight || (activeTab === 'maquina' && equipmentCategory === 'caminhoes')) && typeof truckServiceAdditionalKm === 'number' ? truckServiceAdditionalKm : undefined,
      truckServiceRatePerKm: (isFreight || (activeTab === 'maquina' && equipmentCategory === 'caminhoes')) ? parseCurrencyToFloat(truckServiceRatePerKm) : undefined,
      truckServiceTotalKm: (isFreight || (activeTab === 'maquina' && equipmentCategory === 'caminhoes')) && typeof truckServiceTotalKm === 'number' ? truckServiceTotalKm : undefined,
      truckServiceRateOnlyKm: (isFreight || (activeTab === 'maquina' && equipmentCategory === 'caminhoes')) ? parseCurrencyToFloat(truckServiceRateOnlyKm) : undefined,
      truckServiceTrips: (isFreight || (activeTab === 'maquina' && equipmentCategory === 'caminhoes')) && typeof truckServiceTrips === 'number' ? truckServiceTrips : undefined,
      truckServiceRatePerTrip: (isFreight || (activeTab === 'maquina' && equipmentCategory === 'caminhoes')) ? parseCurrencyToFloat(truckServiceRatePerTrip) : undefined,
      machineTotalAmount: (isFreight || activeTab === 'maquina') ? subtotalServicoMaquina : undefined,

      // Logística / Frete
      freightMaterialType: freightMaterialType || undefined,
      freightOrigin: freightOrigin || undefined,
      freightDestination: freightDestination || undefined,
      freightDriverId: freightDriverId || undefined,
      freightDriverName: freightDriverName || undefined,

      // Área
      areaUnit: isFreight
        ? (truckBillingMode === 'horas' ? 'hora' : undefined)
        : activeTab === 'maquina'
        ? (equipmentCategory === 'pesadas' || truckBillingMode === 'horas' ? 'hora' : undefined)
        : unidadeArea,
      areaQuantity: isFreight
        ? (truckBillingMode === 'horas'
            ? (Number(truckServiceHours) || undefined)
            : (truckBillingMode === 'km' || truckBillingMode === 'somente_km')
            ? (Number(truckServiceTotalKm) || undefined)
            : (truckBillingMode === 'cargas' || truckBillingMode === 'cargas_km')
            ? (Number(truckServiceLoads) || undefined)
            : (Number(truckServiceTrips) || undefined))
        : activeTab === 'maquina'
        ? (equipmentCategory === 'pesadas' ? (Number(heavyMachineHours) || undefined) : (truckBillingMode === 'horas' ? (Number(truckServiceHours) || undefined) : (truckBillingMode === 'somente_km' ? (Number(truckServiceTotalKm) || undefined) : (Number(truckServiceLoads) || undefined))))
        : (typeof quantidadeArea === 'number' ? quantidadeArea : undefined),
      ratePerAreaUnit: (isFreight || activeTab === 'maquina')
        ? undefined
        : parseCurrencyToFloat(valorPorHectare),
      ratePerUnit: isFreight
        ? (truckBillingMode === 'horas'
            ? parseCurrencyToFloat(truckServiceHourlyRate)
            : (truckBillingMode === 'km' || truckBillingMode === 'somente_km')
            ? parseCurrencyToFloat(truckServiceRateOnlyKm)
            : (truckBillingMode === 'cargas' || truckBillingMode === 'cargas_km')
            ? parseCurrencyToFloat(truckServiceRatePerLoad)
            : parseCurrencyToFloat(truckServiceRatePerTrip))
        : activeTab === 'maquina'
        ? (equipmentCategory === 'pesadas' ? parseCurrencyToFloat(heavyMachineHourlyRate) : (truckBillingMode === 'horas' ? parseCurrencyToFloat(truckServiceHourlyRate) : (truckBillingMode === 'somente_km' ? parseCurrencyToFloat(truckServiceRateOnlyKm) : parseCurrencyToFloat(truckServiceRatePerLoad))))
        : parseCurrencyToFloat(valorPorHectare),
      tonsEstimated: estimativaToneladas > 0 ? estimativaToneladas : undefined,
      densityKg: typeof pesoPorM3 === 'number' ? pesoPorM3 : undefined,
      weightPerM3Kg: typeof pesoPorM3 === 'number' ? pesoPorM3 : undefined,
      subtotalArea: (isFreight || activeTab === 'maquina') ? subtotalServicoMaquina : valorBaseArea,

      // Frete Prancha
      fretePrancha: parseCurrencyToFloat(fretePrancha),
      flatbedFreight: parseCurrencyToFloat(fretePrancha),

      // Trator
      tractorId: tratorId,
      tractorName: tratorNome,
      tractorOperatorId: operadorTratorId,
      tractorOperatorName: operadorTratorNome,
      tractorSecondOperatorId: segundoOperadorTratorId,
      tractorSecondOperatorName: segundoOperadorTratorNome,
      tractorBillingMode: modoCobrancaTrator === 'horas' ? 'horas' : 'area',
      tractorCalculationMode: modoCobrancaTrator === 'horas' ? 'horas' : 'area',
      tractorHours: typeof qtdCobrancaTrator === 'number' ? qtdCobrancaTrator : undefined,
      tractorRatePerHour: typeof valorUnitarioTrator === 'number' ? valorUnitarioTrator : undefined,
      tractorTotalAmount: subtotalTrator,
      tractorOperatorCommissionMode: modoComissaoOperador === 'horas' ? 'horas' : modoComissaoOperador === 'livre' ? 'livre' : 'area',
      tractorOperatorHours: typeof qtdBaseComissao === 'number' ? qtdBaseComissao : undefined,
      tractorOperatorCommissionRate: typeof taxaComissaoOperador === 'number' ? Number(taxaComissaoOperador.toFixed(2)) : undefined,
      tractorOperatorCommission: Number((comissaoTratorP1 + comissaoTratorP2).toFixed(2)),
      tractorOperatorCommissionP1: Number(comissaoTratorP1.toFixed(2)),
      tractorOperatorCommissionP2: Number(comissaoTratorP2.toFixed(2)),

      // Forrageira
      forageHarvesterId: forrageiraId,
      forageHarvesterName: forrageiraNome,
      forageOperatorId: operadorForrageiraId,
      forageOperatorName: operadorForrageiraNome,
      forageSecondOperatorId: segundoOperadorForrageiraId,
      forageSecondOperatorName: segundoOperadorForrageiraNome,
      forageCommissionMode: modoComissaoForrageira,
      forageCommissionBase: typeof qtdBaseComissaoForrageira === 'number' ? qtdBaseComissaoForrageira : undefined,
      forageCommissionRate: typeof taxaComissaoForrageira === 'number' ? Number(taxaComissaoForrageira.toFixed(2)) : undefined,
      forageDrumHours: typeof horasTambor === 'number' ? horasTambor : undefined,
      forageEngineHours: typeof horasMotor === 'number' ? horasMotor : undefined,
      forageRatePerHour: typeof valorHoraForrageira === 'number' ? valorHoraForrageira : undefined,
      forageTotalAmount: subtotalForrageira,
      forageOperatorCommission: Number((comissaoForrageiraP1 + comissaoForrageiraP2).toFixed(2)),
      forageOperatorCommissionP1: Number(comissaoForrageiraP1.toFixed(2)),
      forageOperatorCommissionP2: Number(comissaoForrageiraP2.toFixed(2)),

      // Frotas
      trucks: updatedTrucks,
      truckFleetPercentage: (unidadeArea === 'hectares' || unidadeArea === 'hora') ? undefined : (typeof truckFleetPercentage === 'number' ? truckFleetPercentage : undefined),
      truckFleetTotalDistributed: valorDistribuicaoFrotas,
      truckFleetHourlyTotal: (unidadeArea === 'hectares' || unidadeArea === 'hora') ? totalFrotasPorHora : undefined,
      trucksTotalKmAdditional: totalAdicionalKm,

      // Combustível e Alimentação
      fuelEntries,
      totalFuelCost: totalCombustivelGeral,
      mealExpenses,
      totalMealCost: totalAlimentacaoGeral,

      // Fechamento e DRE
      totalAmount: totalPedido,
      totalExpenses: totalGeralDespesas,
      estimatedProfit: lucroEstimado,
      notes: observacoes,

      // Agenciador / Intermediação
      brokerId: brokerId || undefined,
      brokerName: brokerName || undefined,
      brokerCommissionType: brokerId ? brokerCommissionType : undefined,
      brokerCommissionRate: brokerId && typeof brokerCommissionRate === 'number' ? brokerCommissionRate : undefined,
      brokerCommissionAmount: brokerId && brokerCommissionAmount > 0 ? brokerCommissionAmount : undefined,
    };

    onSave(newService);

    // Geração automática de Contas a Pagar em "Acertos Agenciadores" se houver agenciador selecionado e comissão calculada > 0
    if (brokerId && brokerCommissionAmount > 0) {
      try {
        const storedBrokerSettlements = getStoredBrokerSettlements();
        const existingIdx = storedBrokerSettlements.findIndex((s) => s.orderId === newService.id);
        const broker = employees.find((b) => b.id === brokerId);

        const currentMonthYear = (() => {
          if (serviceDate) {
            const [y, m] = serviceDate.split('-');
            if (y && m) return `${m}/${y}`;
          }
          const now = new Date();
          return `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
        })();

        const baseVal = (brokerCommissionType || '').toLowerCase().includes('produção') || (brokerCommissionType || '').toLowerCase().includes('producao')
          ? estimativaToneladas
          : (brokerCommissionType || '').toLowerCase().includes('fixo')
          ? brokerCommissionAmount
          : valorBaseArea;

        const settlementRecord: BrokerSettlement = {
          id: existingIdx >= 0 ? storedBrokerSettlements[existingIdx].id : `bset_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          brokerId: brokerId,
          brokerName: (brokerName || broker?.name || 'AGENCIADOR').toUpperCase(),
          actingRegion: broker?.actingRegion || undefined,
          date: serviceDate || new Date().toISOString().split('T')[0],
          referenceMonth: currentMonthYear,
          orderId: newService.id,
          orderClientName: (clientName || '').toUpperCase(),
          description: `Comissão Agenciador - Pedido #${newService.orderNumber || ''} (${clientName || 'Cliente'})`,
          commissionType: brokerCommissionType,
          commissionRate: typeof brokerCommissionRate === 'number' ? brokerCommissionRate : 0,
          baseValue: baseVal,
          grossAmount: brokerCommissionAmount,
          deductions: 0,
          netAmount: brokerCommissionAmount,
          status: existingIdx >= 0 ? storedBrokerSettlements[existingIdx].status : 'pendente',
          createdAt: existingIdx >= 0 && storedBrokerSettlements[existingIdx].createdAt ? storedBrokerSettlements[existingIdx].createdAt : new Date().toISOString(),
        };

        if (existingIdx >= 0) {
          storedBrokerSettlements[existingIdx] = {
            ...storedBrokerSettlements[existingIdx],
            ...settlementRecord,
          };
        } else {
          storedBrokerSettlements.push(settlementRecord);
        }
        saveStoredBrokerSettlements(storedBrokerSettlements);
      } catch (err) {
        console.error('Erro ao salvar lançamento em Acertos Agenciadores:', err);
      }
    }

    // =========================================================================
    // LANÇAMENTO FINANCEIRO AUTOMATIZADO EM ACERTOS TERCEIROS (FRETES / CAMINHÕES)
    // =========================================================================
    try {
      const storedSettlements = getStoredSettlements();

      // Identifica os caminhões classificados como "DE TERCEIRO"
      const thirdPartyTrucks = updatedTrucks.filter((truck) =>
        isThirdPartyTruck(truck, machineries, employees)
      );

      const currentThirdPartyIds = new Set(thirdPartyTrucks.map((t) => t.id));

      // Preserva lançamentos de outras OSs e apenas da OS atual os que ainda pertencem a caminhões de terceiros ou já estão pagos
      let nextSettlements = storedSettlements.filter((s) => {
        if (s.orderId === newService.id && s.role === 'Freteiro / Caminhão') {
          if (s.status === 'pago') return true; // Preserva registros já quitados
          return currentThirdPartyIds.has(s.truckId || '');
        }
        return true;
      });

      for (const t of thirdPartyTrucks) {
        // Encontra o detalhe calculado para este caminhão no DRE
        const truckDetail = trucksExpenseDetails.find((d) => d.truckId === t.id);

        // Valor total calculado para aquele transporte (ex: R$ 544,81)
        const valorCalculado = truckDetail && truckDetail.totalCost > 0
          ? Number(truckDetail.totalCost.toFixed(2))
          : Number(
              (
                (unidadeArea === 'hectares' || unidadeArea === 'hora'
                  ? (Number(t.truckHours) || 0) * (Number(t.truckHourlyRate) || 0)
                  : (t.distributedValue || 0)) +
                (t.totalAdditionalKm || 0) +
                (t.driverCommission || 0)
              ).toFixed(2)
            );

        // Identifica maquinário e funcionário vinculados (se houver)
        const mach = machineries.find((m) => m.id === t.machineryId);
        const emp = employees.find(
          (e) => e.id === t.primaryDriverId || e.name.toLowerCase() === (t.primaryDriverName || '').toLowerCase()
        );

        // Identificador do veículo (ex: Transp. MTU ou Modelo/Placa)
        const vehicleIdentifier = t.plate
          ? (t.truckName ? `${t.truckName} [${t.plate.toUpperCase()}]` : t.plate.toUpperCase())
          : (t.truckName || mach?.name || mach?.model || 'Caminhão Terceirizado');

        // Nome do motorista / proprietário terceirizado (ex: EDIMO MTU)
        const driverOrOwnerName = (
          t.primaryDriverName?.trim() ||
          mach?.ownerName?.trim() ||
          mach?.operatorOrDriver?.trim() ||
          mach?.name?.trim() ||
          t.truckName?.trim() ||
          'MOTORISTA TERCEIRIZADO'
        ).toUpperCase();

        // Busca se já existe um acerto para este caminhão nesta OS
        const existingIdx = nextSettlements.findIndex(
          (s) =>
            (s.orderId === newService.id && s.truckId === t.id) ||
            (s.orderId === newService.id && s.machineryPlateOrName === vehicleIdentifier)
        );

        const existingItem = existingIdx >= 0 ? nextSettlements[existingIdx] : null;
        const deductions = existingItem ? (existingItem.deductions || 0) : 0;
        const netAmount = Math.max(0, valorCalculado - deductions);

        const settlementRecord: ThirdPartySettlement = {
          id: existingItem ? existingItem.id : `tset_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          thirdPartyName: driverOrOwnerName,
          role: 'Freteiro / Caminhão',
          date: serviceDate || new Date().toISOString().split('T')[0],
          description: `Transporte Silagem - Pedido #${newService.orderNumber || ''} (${clientName || 'Cliente'}) - ${vehicleIdentifier}`,
          tons: estimativaToneladas > 0 ? estimativaToneladas : undefined,
          trips: t.tripLoads || undefined,
          hours: typeof t.truckHours === 'number' && t.truckHours > 0 ? t.truckHours : undefined,
          rate: typeof t.truckHourlyRate === 'number' && t.truckHourlyRate > 0
            ? t.truckHourlyRate
            : (typeof t.ratePerKm === 'number' && t.ratePerKm > 0 ? t.ratePerKm : valorCalculado),
          totalAmount: valorCalculado,
          deductions: deductions,
          netAmount: netAmount,
          status: existingItem ? existingItem.status : 'pendente',
          machineryPlateOrName: vehicleIdentifier,
          phone: emp?.phone || mach?.notes || undefined,
          notes: `Lançamento automático de frete terceirizado - Pedido #${newService.orderNumber || ''} (Cliente: ${clientName || ''}). Veículo: ${vehicleIdentifier}. Transportador: ${driverOrOwnerName}.`,
          orderId: newService.id,
          truckId: t.id,
          orderNumber: newService.orderNumber,
          orderClientName: clientName,
          createdAt: existingItem && existingItem.createdAt ? existingItem.createdAt : new Date().toISOString(),
        };

        if (existingIdx >= 0) {
          nextSettlements[existingIdx] = {
            ...nextSettlements[existingIdx],
            ...settlementRecord,
          };
        } else {
          nextSettlements.push(settlementRecord);
        }
      }

      saveStoredSettlements(nextSettlements);
    } catch (err) {
      console.error('Erro ao gerar lançamento financeiro em Acertos Terceiros:', err);
    }

    setSavedOrder(newService);
    setSaveSuccessMessage(`Pedido ${newService.orderNumber} salvo com sucesso! Os dados foram gravados no sistema. Você pode continuar na tela para analisar o DRE ou imprimir.`);
    setIsSaveSuccessToast(true);
    setTimeout(() => {
      setIsSaveSuccessToast(false);
    }, 4000);
  };

  // Alias semântico para o salvamento conforme solicitado
  const handleSubmit = handleSave;

  // Configuração Dinâmica dos Estilos de Impressão Nativa (@media print)
  // Via Cliente: Formato Cupom Térmico 80mm (@page { size: 80mm auto; margin: 0; })
  // Via Completa: Formato A4 Gerencial (@page { size: A4; margin: 8mm; })
  const setupPrintStyles = (mode: 'client' | 'full') => {
    let styleEl = document.getElementById('dynamic-service-order-print-css') as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'dynamic-service-order-print-css';
      document.head.appendChild(styleEl);
    }

    if (mode === 'client') {
      styleEl.innerHTML = `
        @media print {
          @page {
            size: 80mm auto;
            margin: 0;
          }
          *, *::before, *::after {
            box-sizing: border-box !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            font-weight: 700 !important;
            -webkit-font-smoothing: antialiased !important;
            -moz-osx-font-smoothing: grayscale !important;
            text-rendering: optimizeLegibility !important;
          }
          span, p, div, td, th, label, h1, h2, h3, h4, h5, h6, b, strong, i, em, small, input, select, textarea, li, a {
            font-weight: 700 !important;
          }
          h1, h2, h3, h4, th, b, strong, .font-bold, .font-extrabold, .font-black {
            font-weight: 800 !important;
          }
          .text-slate-400, .text-slate-500, .text-slate-600, .text-gray-400, .text-gray-500, .text-gray-600, .text-gray-700 {
            color: #000000 !important;
          }
          html, body {
            width: 80mm !important;
            min-width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-size: 10px !important;
            line-height: 1.25 !important;
            -webkit-font-smoothing: antialiased !important;
            text-rendering: optimizeLegibility !important;
          }
          #printable-modal-overlay {
            position: static !important;
            display: block !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 auto !important;
            width: 80mm !important;
            max-width: 80mm !important;
          }
          #printable-service-order-modal {
            position: static !important;
            display: block !important;
            width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 auto !important;
            padding: 3mm 2mm !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background: #ffffff !important;
            color: #000000 !important;
            overflow: visible !important;
            max-height: none !important;
          }
          .modal-body-scroll {
            overflow: visible !important;
            max-height: none !important;
            height: auto !important;
            padding: 0 !important;
            gap: 4px !important;
          }
          /* REGRA CRÍTICA DE PRIVACIDADE: Oculta 100% bloco laranja, verde escuro e comissões */
          .print-client-hide,
          .print-hide-on-client,
          .print-commission-info,
          .print-commission-box {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            border: none !important;
          }
          .print\\:hidden,
          button,
          select {
            display: none !important;
          }
          .thermal-receipt-badge {
            display: block !important;
            text-align: center !important;
            font-size: 11px !important;
            font-weight: 800 !important;
            text-transform: uppercase !important;
            border-bottom: 1px dashed #000000 !important;
            padding-bottom: 4px !important;
            margin-bottom: 6px !important;
          }
          .print-signatures-area {
            display: block !important;
            margin-top: 10px !important;
            padding-top: 6px !important;
            border-top: 1px dashed #000000 !important;
            text-align: center !important;
          }
          .print-signatures-area .signature-line {
            margin-top: 16px !important;
            border-top: 1px solid #000000 !important;
            padding-top: 3px !important;
          }
        }
      `;
    } else {
      styleEl.innerHTML = `
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
          *, *::before, *::after {
            box-sizing: border-box !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            font-weight: 700 !important;
            -webkit-font-smoothing: antialiased !important;
            -moz-osx-font-smoothing: grayscale !important;
            text-rendering: optimizeLegibility !important;
          }
          span, p, div, td, th, label, h1, h2, h3, h4, h5, h6, b, strong, i, em, small, input, select, textarea, li, a {
            font-weight: 700 !important;
          }
          h1, h2, h3, h4, th, b, strong, .font-bold, .font-extrabold, .font-black {
            font-weight: 800 !important;
          }
          .text-slate-400, .text-slate-500, .text-slate-600, .text-gray-400, .text-gray-500, .text-gray-600, .text-gray-700 {
            color: #000000 !important;
          }
          html, body {
            width: 100% !important;
            height: auto !important;
            background: #ffffff !important;
            color: #0f172a !important;
            font-size: 9px !important;
            line-height: 1.15 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            -webkit-font-smoothing: antialiased !important;
            text-rendering: optimizeLegibility !important;
          }
          #printable-modal-overlay {
            position: static !important;
            display: block !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            height: auto !important;
            width: 100% !important;
          }
          #printable-service-order-modal {
            position: static !important;
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            max-height: none !important;
            height: auto !important;
            overflow: visible !important;
            border: none !important;
            box-shadow: none !important;
            background: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .modal-body-scroll {
            overflow: visible !important;
            max-height: none !important;
            height: auto !important;
            padding: 0 !important;
            gap: 2px !important;
          }
          .modal-body-scroll > * {
            margin-bottom: 3px !important;
            padding: 3px 5px !important;
            border-radius: 4px !important;
            page-break-inside: avoid !important;
          }
          .print-client-hide,
          .print-hide-on-client,
          .print-commission-info,
          .print-commission-box {
            display: block !important;
          }
          .print\\:hidden,
          button {
            display: none !important;
          }
          .thermal-receipt-badge {
            display: none !important;
          }
          .print-signatures-area {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 16px !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin-top: 6px !important;
            padding-top: 4px !important;
          }
          .break-inside-avoid,
          .page-break-inside-avoid {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .footer-sistema {
            display: block !important;
          }
        }
      `;
    }
  };

  // Dispara a impressão isolada em uma nova janela (window.open / Blob URL) para contornar a restrição de sandbox do iframe (allow-modals)
  const handlePrintInNewWindow = (mode: 'client' | 'full') => {
    setupPrintStyles(mode);

    const modalEl = document.getElementById('printable-service-order-modal');
    if (!modalEl) {
      try {
        window.print();
      } catch (err) {
        console.warn('Fallback window.print error:', err);
      }
      return;
    }

    // Clona o elemento do modal e sincroniza com precisão os valores atuais dos campos
    const clone = modalEl.cloneNode(true) as HTMLElement;

    const originalInputs = modalEl.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select');
    const cloneInputs = clone.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select');

    originalInputs.forEach((orig, idx) => {
      const c = cloneInputs[idx];
      if (!c) return;
      if (c.tagName === 'SELECT') {
        const origSel = orig as HTMLSelectElement;
        const cSel = c as HTMLSelectElement;
        cSel.value = origSel.value;
        Array.from(cSel.options).forEach((opt) => {
          if (opt.value === origSel.value) opt.setAttribute('selected', 'selected');
          else opt.removeAttribute('selected');
        });
      } else if (c.tagName === 'TEXTAREA') {
        c.textContent = (orig as HTMLTextAreaElement).value;
        (c as HTMLTextAreaElement).value = (orig as HTMLTextAreaElement).value;
      } else {
        const origInp = orig as HTMLInputElement;
        const cInp = c as HTMLInputElement;
        cInp.setAttribute('value', origInp.value);
        cInp.value = origInp.value;
        if (origInp.checked) {
          cInp.setAttribute('checked', 'checked');
        } else {
          cInp.removeAttribute('checked');
        }
      }
    });

    // Remove elementos de controle de tela (como o rodapé com os botões de ação e o botão fechar 'X')
    clone.querySelectorAll('.print\\:hidden').forEach((el) => el.remove());

    // Coleta folhas de estilo do documento para preservar classes Tailwind e fontes
    const headStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((el) => el.outerHTML)
      .join('\n');

    const isClient = mode === 'client';
    const docTitle = isClient
      ? `Silagem Fácil - Comprovante do Cliente (80mm) - ${numero || 'OS'}`
      : `Silagem Fácil - Ordem de Serviço Completa (DRE A4) - ${numero || 'OS'}`;

    const printPageStyles = `
      <style>
        *, *::before, *::after {
          box-sizing: border-box !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: #f8fafc !important;
          color: #0f172a !important;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
        }
        .no-print {
          display: flex;
        }
        .print-page-wrapper {
          display: flex;
          justify-content: center;
          padding: 24px 16px;
          min-height: calc(100vh - 60px);
          background: #f1f5f9;
        }
        #printable-service-order-modal {
          position: relative !important;
          display: block !important;
          margin: 0 auto !important;
          max-height: none !important;
          height: auto !important;
          overflow: visible !important;
          border-radius: 8px !important;
          box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.1) !important;
          background: #ffffff !important;
          color: #0f172a !important;
        }
        .modal-body-scroll {
          overflow: visible !important;
          max-height: none !important;
          height: auto !important;
        }
        input, textarea, select {
          border: 1px solid #cbd5e1 !important;
          background-color: #ffffff !important;
          color: #0f172a !important;
          pointer-events: none !important;
        }
        button:not(.no-print button), select.opacity-0 {
          display: none !important;
        }
        ${
          isClient
            ? `
          /* Formato 80mm - Cupom Térmico */
          #printable-service-order-modal {
            width: 80mm !important;
            max-width: 80mm !important;
            min-width: 80mm !important;
            padding: 4mm 3mm !important;
            font-size: 10px !important;
            line-height: 1.25 !important;
          }
          .thermal-receipt-badge {
            display: block !important;
            text-align: center !important;
            font-size: 11px !important;
            font-weight: 800 !important;
            text-transform: uppercase !important;
            border-bottom: 1px dashed #000000 !important;
            padding-bottom: 4px !important;
            margin-bottom: 6px !important;
          }
          .print-signatures-area {
            display: block !important;
            margin-top: 10px !important;
            padding-top: 6px !important;
            border-top: 1px dashed #000000 !important;
            text-align: center !important;
          }
          .print-signatures-area .signature-line {
            margin-top: 16px !important;
            border-top: 1px solid #000000 !important;
            padding-top: 3px !important;
          }
          .print-client-hide,
          .print-hide-on-client,
          .print-commission-info,
          .print-commission-box {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            border: none !important;
          }
        `
            : `
          /* Formato A4 Completo - DRE Gerencial */
          #printable-service-order-modal {
            width: 210mm !important;
            max-width: 100% !important;
            padding: 12mm 10mm !important;
            font-size: 9.5px !important;
            line-height: 1.2 !important;
          }
          .thermal-receipt-badge {
            display: none !important;
          }
          .print-signatures-area {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 16px !important;
            margin-top: 8px !important;
            padding-top: 6px !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .break-inside-avoid,
          .page-break-inside-avoid {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .footer-sistema {
            display: block !important;
          }
          .print-client-hide,
          .print-hide-on-client,
          .print-commission-info,
          .print-commission-box {
            display: block !important;
          }
        `
        }

        @media print {
          @page {
            size: ${isClient ? '80mm auto' : 'A4 portrait'};
            margin: ${isClient ? '0' : '8mm'};
          }
          *, *::before, *::after {
            font-weight: 700 !important;
            -webkit-font-smoothing: antialiased !important;
            -moz-osx-font-smoothing: grayscale !important;
            text-rendering: optimizeLegibility !important;
          }
          span, p, div, td, th, label, h1, h2, h3, h4, h5, h6, b, strong, i, em, small, input, select, textarea, li, a {
            font-weight: 700 !important;
          }
          h1, h2, h3, h4, th, b, strong, .font-bold, .font-extrabold, .font-black {
            font-weight: 800 !important;
          }
          .text-slate-400, .text-slate-500, .text-slate-600, .text-gray-400, .text-gray-500, .text-gray-600, .text-gray-700 {
            color: #000000 !important;
          }
          .no-print {
            display: none !important;
          }
          .print-page-wrapper {
            padding: 0 !important;
            margin: 0 !important;
            background: transparent !important;
            display: block !important;
          }
          .footer-sistema {
            display: block !important;
          }
          #printable-service-order-modal {
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            margin: 0 auto !important;
            padding: ${isClient ? '2mm' : '0'} !important;
            width: ${isClient ? '80mm' : '100%'} !important;
            max-width: ${isClient ? '80mm' : '100%'} !important;
            min-width: 0 !important;
          }
        }
      </style>
    `;

    const fullHtml = `<!DOCTYPE html>
<html lang="pt-BR" class="light">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${docTitle}</title>
  ${headStyles}
  ${printPageStyles}
</head>
<body>
  <!-- BARRA DE FERRAMENTAS ISOLADA (NÃO IMPRESSA) -->
  <div class="no-print" style="position: sticky; top: 0; left: 0; right: 0; z-index: 9999; background: #0f172a; color: #ffffff; padding: 10px 18px; align-items: center; justify-content: space-between; border-bottom: 1px solid #334155; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
    <div style="display: flex; align-items: center; gap: 12px;">
      <span style="font-weight: 800; font-size: 14px; letter-spacing: 0.5px; color: #10b981;">SILAGEM FÁCIL</span>
      <span style="font-size: 12px; background: rgba(255, 255, 255, 0.12); padding: 4px 10px; border-radius: 6px; font-weight: 600;">
        ${isClient ? '📄 Cupom Térmico 80mm (Via Cliente)' : '📊 Folha A4 Completa (Via Gerencial DRE)'}
      </span>
    </div>
    <div style="display: flex; align-items: center; gap: 10px;">
      <button onclick="window.print()" style="background: #059669; color: #ffffff; border: none; padding: 7px 16px; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);">
        🖨️ Imprimir Agora / Salvar PDF
      </button>
      <button onclick="window.close()" style="background: #334155; color: #cbd5e1; border: none; padding: 7px 14px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;">
        ✕ Fechar
      </button>
    </div>
  </div>

  <div class="print-page-wrapper">
    ${clone.outerHTML}
  </div>

  <script>
    function triggerAutoPrint() {
      setTimeout(function() {
        try {
          window.focus();
          window.print();
        } catch (err) {
          console.warn('Auto print failed:', err);
        }
      }, 400);
    }
    if (document.readyState === 'complete') {
      triggerAutoPrint();
    } else {
      window.addEventListener('load', triggerAutoPrint);
    }
  </script>
</body>
</html>`;

    // 1. Tenta abrir via Blob URL (isolamento de processo top-level, contornando o sandbox do iframe)
    try {
      const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      const printWin = window.open(blobUrl, '_blank');
      if (printWin) {
        printWin.focus();
        return;
      }
    } catch (err) {
      console.warn('Falha ao abrir via Blob URL:', err);
    }

    // 2. Fallback: document.write direto no window.open
    try {
      const printWin = window.open('', '_blank');
      if (printWin) {
        printWin.document.open();
        printWin.document.write(fullHtml);
        printWin.document.close();
        printWin.focus();
        return;
      }
    } catch (err) {
      console.warn('Falha ao abrir via document.write:', err);
    }

    // 3. Último recurso: disparo direto
    try {
      window.print();
    } catch (err) {
      console.error('Erro geral ao imprimir:', err);
    }
  };

  // Título e Ícone Dinâmicos por Aba
  const getTabConfig = () => {
    switch (activeTab) {
      case 'colheita':
        return { title: editRecord ? 'Editar Colheita' : 'Nova Colheita', icon: Wheat, color: 'text-amber-600' };
      case 'trator':
        return { title: editRecord ? 'Editar Serviço de Trator' : 'Novo Serviço de Trator', icon: Tractor, color: 'text-blue-600' };
      case 'maquina':
        return { title: editRecord ? 'Editar Serviço de Máquina' : 'Novo Serviço de Máquina', icon: Wrench, color: 'text-purple-600' };
      case 'frete':
        return { title: editRecord ? 'Editar Serviço de Frete' : 'Novo Serviço de Frete', icon: Truck, color: 'text-emerald-700' };
      case 'orcamento':
        return { title: editRecord ? 'Editar Orçamento' : 'Novo Orçamento', icon: FileText, color: 'text-cyan-600' };
      case 'venda':
        return { title: editRecord ? 'Editar Venda' : 'Nova Venda', icon: ShoppingCart, color: 'text-rose-600' };
      case 'corte':
      default:
        return { title: editRecord ? 'Editar Corte de Silagem' : 'Novo Corte de Silagem', icon: Scissors, color: 'text-emerald-700' };
    }
  };

  const { title: modalTitle, icon: HeaderIcon, color: iconColor } = getTabConfig();

  if (!isOpen) return null;

  return (
    <>
      {/* Folha de Estilos Especializada para Impressão Nativa (Gerenciada dinamicamente por setupPrintStyles) */}
      <style id="dynamic-service-order-print-css">{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
          *, *::before, *::after {
            box-sizing: border-box !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            font-weight: 700 !important;
            -webkit-font-smoothing: antialiased !important;
            -moz-osx-font-smoothing: grayscale !important;
            text-rendering: optimizeLegibility !important;
          }
          span, p, div, td, th, label, h1, h2, h3, h4, h5, h6, b, strong, i, em, small, input, select, textarea, li, a {
            font-weight: 700 !important;
          }
          h1, h2, h3, h4, th, b, strong, .font-bold, .font-extrabold, .font-black {
            font-weight: 800 !important;
          }
          .text-slate-400, .text-slate-500, .text-slate-600, .text-gray-400, .text-gray-500, .text-gray-600, .text-gray-700 {
            color: #000000 !important;
          }
          html, body {
            width: 100% !important;
            height: auto !important;
            background: #ffffff !important;
            color: #0f172a !important;
            font-size: 9px !important;
            line-height: 1.15 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }
          #printable-modal-overlay {
            position: static !important;
            display: block !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            height: auto !important;
            width: 100% !important;
            inset: auto !important;
          }
          #printable-service-order-modal {
            position: static !important;
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            max-height: none !important;
            height: auto !important;
            overflow: visible !important;
            border: none !important;
            box-shadow: none !important;
            background: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .modal-body-scroll {
            overflow: visible !important;
            max-height: none !important;
            height: auto !important;
            padding: 0 !important;
            gap: 2px !important;
          }
          .modal-body-scroll > * {
            margin-bottom: 3px !important;
            padding: 3px 5px !important;
            border-radius: 4px !important;
            page-break-inside: avoid !important;
          }
          .print:hidden,
          button {
            display: none !important;
          }
          .thermal-receipt-badge {
            display: none !important;
          }
          .print-signatures-area {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 16px !important;
            page-break-inside: avoid !important;
            margin-top: 6px !important;
            padding-top: 4px !important;
          }
        }
      `}</style>

      <div 
        id="printable-modal-overlay"
        className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto overflow-x-hidden"
      >
        <div 
          id="printable-service-order-modal"
          className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-800 flex flex-col max-h-[94vh] overflow-hidden overflow-x-hidden my-auto"
        >
          {/* Badge para Cupom Térmico (Visível apenas em impressão 80mm) */}
          <div className="hidden print:block thermal-receipt-badge text-center">
            <p className="font-black text-xs uppercase tracking-wider">Silagem Fácil - Ordem de Serviço</p>
            <p className="text-[9px] text-gray-700 font-mono">Comprovante de Execução Operacional</p>
          </div>

          {/* Cabeçalho Corporativo Oficial do Sistema para Impressão A4 */}
          <div className="hidden print:block p-3 pb-2 bg-white">
            <PrintReportHeader
              title="ORDEM DE SERVIÇO / PRESTAÇÃO AGRÍCOLA"
              subtitle={numero ? `OS Nº ${numero}` : undefined}
              companyProfile={companyProfile}
            />
          </div>
          
          {/* CABEÇALHO DO MODAL (COMPACTO) */}
          <div 
            className="flex items-center justify-between px-4 sm:px-5 py-2.5 sm:py-3 border-b border-gray-200 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-900/90 shrink-0 w-full print:hidden"
            style={{ backgroundColor: '#2f4db8' }}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shadow-2xs shrink-0">
                <HeaderIcon className={`w-4 h-4 sm:w-4.5 sm:h-4.5 ${iconColor}`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white">
                    {modalTitle}
                  </h3>
                </div>
                <p 
                  className="text-[11px] text-gray-500 dark:text-slate-400"
                  style={{ color: '#040404' }}
                >
                  Preencha os dados operacionais, frotas e fechamento DRE
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-800 transition cursor-pointer print:hidden"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* CORPO DO FORMULÁRIO COM ROLAGEM (COMPACTO) */}
          <div 
            className="flex-1 overflow-y-auto overflow-x-hidden p-3.5 sm:p-4 space-y-3 modal-body-scroll w-full"
            style={{ backgroundColor: '#2e65aa' }}
          >
            
            {/* ALERTA DE CONFIRMAÇÃO / PERSISTÊNCIA AO SALVAR */}
            {saveSuccessMessage && (
              <div className="bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-400 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-between shadow-xs animate-fade-in print:hidden">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 stroke-[2.5]" />
                  <span>{saveSuccessMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSaveSuccessMessage(null)}
                  className="text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 font-bold p-1 rounded-lg cursor-pointer"
                  title="Fechar aviso"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* 1. DADOS DE IDENTIFICAÇÃO E CLIENTE */}
            <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-3 sm:p-3.5 shadow-sm space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-2.5">
                
                {/* Número do Serviço */}
                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Número
                  </label>
                  <input
                    type="text"
                    value={numero}
                    onChange={(e) => setNumero(e.target.value)}
                    className="w-full px-3 py-1.5 sm:py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs sm:text-sm text-slate-800 dark:text-slate-100 font-mono font-bold cursor-default select-all focus:outline-none"
                  />
                </div>

                {/* Cliente / Produtor com Botão + Novo */}
                <div className="sm:col-span-5">
                  <label className="block text-[11px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span>Cliente / Produtor *</span>
                    <button
                      type="button"
                      onClick={() => setIsQuickClientOpen(true)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 dark:text-emerald-400 hover:text-emerald-700 hover:underline cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>+ Novo Cliente</span>
                    </button>
                  </label>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="Selecione ou digite o Produtor..."
                        className="w-full px-3 py-1.5 sm:py-2 bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-500 rounded-lg text-xs sm:text-sm text-gray-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600 shadow-2xs transition-colors"
                      />
                      {clients.length > 0 && (
                        <select
                          value={clientId}
                          onChange={(e) => handleSelectClient(e.target.value)}
                          className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                          title="Selecionar cliente da lista"
                        >
                          <option value="">-- Escolher Cliente Cadastrado --</option>
                          {clients.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} {c.farmName ? `(${c.farmName})` : ''}
                            </option>
                          ))}
                          {clientId && !clients.some((c) => c.id === clientId) && (
                            <option value={clientId}>
                              {clientName} {farmName ? `(${farmName})` : ''}
                            </option>
                          )}
                        </select>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsQuickClientOpen(true)}
                      className="p-1.5 sm:p-2 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-lg hover:bg-emerald-100 transition cursor-pointer shrink-0"
                      title="Cadastrar Novo Produtor Rural / Pecuarista (Completo)"
                    >
                      <UserPlus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Fazenda / Local */}
                <div className="sm:col-span-4">
                  <label className="block text-[11px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Fazenda / Propriedade
                  </label>
                  <input
                    type="text"
                    value={farmName}
                    onChange={(e) => setFarmName(e.target.value)}
                    placeholder="Ex: Fazenda Boa Esperança"
                    className="w-full px-3 py-1.5 sm:py-2 bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-500 rounded-lg text-xs sm:text-sm text-gray-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600 shadow-2xs transition-colors"
                  />
                </div>
              </div>

              {/* Datas da Operação / Manutenção */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Data da Abertura / Manutenção *
                  </label>
                  <input
                    type="date"
                    value={serviceDate}
                    onChange={(e) => setServiceDate(e.target.value)}
                    className="w-full px-3 py-1.5 sm:py-2 bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-500 rounded-lg text-xs sm:text-sm text-gray-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 shadow-2xs transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Previsão de Término / Conclusão (Data)
                  </label>
                  <input
                    type="date"
                    value={completionDate}
                    onChange={(e) => setCompletionDate(e.target.value)}
                    className="w-full px-3 py-1.5 sm:py-2 bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-500 rounded-lg text-xs sm:text-sm text-gray-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 shadow-2xs transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* BLOCO CENTRAL: ABA 1. SELEÇÃO DE EQUIPAMENTOS & REGRAS DE COBRANÇA */}
            {activeTab === 'maquina' && (
              <div className="bg-blue-50/70 dark:bg-slate-800/40 border border-blue-200 dark:border-slate-700 rounded-xl p-3.5 sm:p-4 shadow-sm space-y-4">
                {/* Cabeçalho Azul do Bloco */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-200 dark:border-slate-700 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-blue-600 text-white rounded-lg shadow-xs">
                      <Tractor className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-blue-950 dark:text-white uppercase tracking-wider">
                        ABA 1. SELEÇÃO DE EQUIPAMENTOS & REGRAS DE COBRANÇA
                      </h4>
                      <p className="text-[11px] text-blue-700 dark:text-blue-300">
                        Prestação de serviços e aluguel de maquinário pesado e fretes para clientes externos
                      </p>
                    </div>
                  </div>

                  <span className="self-start sm:self-auto px-2.5 py-1 text-[11px] font-bold rounded-lg border bg-white dark:bg-slate-900 border-blue-300 dark:border-slate-600 text-blue-900 dark:text-blue-200 shadow-2xs">
                    {equipmentCategory === 'pesadas' ? 'Máquinas Pesadas • Cobrança por Hora' : 'Caminhões / Transporte'}
                  </span>
                </div>

                {/* Seletor de Categoria de Equipamento */}
                <div>
                  <label className="block text-[11px] font-bold text-blue-950 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                    Tipo de Equipamento / Serviço *
                  </label>
                  <select
                    value={equipmentCategory}
                    onChange={(e) => {
                      const cat = e.target.value as 'pesadas' | 'caminhoes';
                      setEquipmentCategory(cat);
                      if (cat === 'pesadas') {
                        if (!heavyMachineType) setHeavyMachineType('Retroescavadeira');
                      } else {
                        if (!truckServiceId && frotasCaminhoesDisponiveis.length > 0) {
                          setTruckServiceId(frotasCaminhoesDisponiveis[0].id);
                          setTruckServiceName(frotasCaminhoesDisponiveis[0].name || frotasCaminhoesDisponiveis[0].model);
                        }
                      }
                    }}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border-2 border-blue-300 dark:border-blue-700 rounded-xl text-xs sm:text-sm font-bold text-blue-950 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 cursor-pointer shadow-2xs transition-colors"
                  >
                    <option value="pesadas">🚜 Serviços Máquinas Pesadas</option>
                    <option value="caminhoes">🚚 Caminhões / Transporte</option>
                  </select>
                </div>

                {/* CASO A: Serviços Máquinas Pesadas */}
                {equipmentCategory === 'pesadas' && (
                  <div className="bg-white dark:bg-slate-900/80 border border-blue-200 dark:border-slate-700 rounded-xl p-3 sm:p-4 space-y-3.5 shadow-2xs">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                      {/* Select da Máquina Específica */}
                      <div className="sm:col-span-6">
                        <label className="block text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1">
                          Máquina Específica da Frota *
                        </label>
                        <select
                          value={heavyMachineType}
                          onChange={(e) => setHeavyMachineType(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-600 rounded-lg text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 cursor-pointer"
                        >
                          <optgroup label="Máquinas Operacionais Padrão">
                            <option value="Retroescavadeira">Retroescavadeira</option>
                            <option value="Escavadeira Hidráulica">Escavadeira Hidráulica</option>
                            <option value="Trator de Esteira">Trator de Esteira</option>
                            <option value="Motoniveladora">Motoniveladora</option>
                          </optgroup>
                          {machineries.filter((m) => m.categoryType !== 'caminhao').length > 0 && (
                            <optgroup label="Outras Máquinas Cadastradas na Frota">
                              {machineries
                                .filter((m) => m.categoryType !== 'caminhao')
                                .map((m) => (
                                  <option key={m.id} value={m.name || m.model}>
                                    {m.name || m.model} {m.licensePlateOrSerial ? `[${m.licensePlateOrSerial}]` : ''} ({m.categoryType || 'Máquina'})
                                  </option>
                                ))}
                            </optgroup>
                          )}
                        </select>
                      </div>

                      {/* Regra de Cobrança: Trava Fixa em "Cobrança por Hora" */}
                      <div className="sm:col-span-6">
                        <label className="block text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1 flex items-center justify-between">
                          <span>Regra de Cobrança / Faturamento</span>
                          <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                            <Lock className="w-3 h-3" /> Regra Fixa
                          </span>
                        </label>
                        <div className="w-full px-3 py-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-lg text-xs sm:text-sm font-bold text-emerald-900 dark:text-emerald-200 flex items-center justify-between cursor-not-allowed shadow-2xs">
                          <span className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                            Cobrança por Hora
                          </span>
                          <span className="text-[10px] bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100 px-2 py-0.5 rounded font-extrabold uppercase">
                            Travado
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Inputs de Horas, Valor da Hora e Subtotal Calculado */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-slate-200 dark:border-slate-800">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Quantidade de Horas (h) *
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={heavyMachineHours}
                          onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          onChange={(e) => setHeavyMachineHours(e.target.value === '' ? '' : Number(e.target.value))}
                          placeholder="Ex: 8.5"
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-600 focus:border-blue-600 shadow-2xs"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Valor da Hora (R$/h) *
                        </label>
                        <input
                          type="text"
                          value={heavyMachineHourlyRate}
                          onChange={(e) => setHeavyMachineHourlyRate(maskCurrencyBRLInput(e.target.value))}
                          onBlur={() => setHeavyMachineHourlyRate(formatCurrencyBRLOnBlur(heavyMachineHourlyRate))}
                          placeholder="R$ 0,00"
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-600 focus:border-blue-600 shadow-2xs"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Subtotal da Máquina
                        </label>
                        <div className="w-full px-3 py-2 bg-blue-50 dark:bg-slate-800 border border-blue-300 dark:border-slate-600 rounded-lg text-xs sm:text-sm font-bold text-blue-950 dark:text-white flex items-center justify-between shadow-2xs">
                          <span>{formatCurrencyBRL(subtotalServicoMaquina)}</span>
                          <span className="text-[10px] text-blue-700 dark:text-blue-300 font-normal">
                            {heavyMachineHours || 0} h × {formatCurrencyBRL(parseCurrencyToFloat(heavyMachineHourlyRate))}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* CASO B: Caminhões / Transporte */}
                {equipmentCategory === 'caminhoes' && (
                  <div className="bg-white dark:bg-slate-900/80 border border-blue-200 dark:border-slate-700 rounded-xl p-3 sm:p-4 space-y-3.5 shadow-2xs">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                      {/* Seletor do Caminhão da Frota */}
                      <div className="sm:col-span-6">
                        <label className="block text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1">
                          Caminhão da Frota *
                        </label>
                        <select
                          value={truckServiceId}
                          onChange={(e) => {
                            const tId = e.target.value;
                            setTruckServiceId(tId);
                            const found = machineries.find((m) => m.id === tId);
                            if (found) {
                              setTruckServiceName(found.name || found.model);
                            }
                          }}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-600 rounded-lg text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 cursor-pointer"
                        >
                          <option value="">Selecione o caminhão da frota...</option>
                          {frotasCaminhoesDisponiveis.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.licensePlateOrSerial ? `[${m.licensePlateOrSerial}] ` : ''}
                              {m.name || m.model} {m.brand ? `(${m.brand})` : ''} {m.capacityM3 ? `• ${m.capacityM3}m³` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Seletor de Forma de Cobrança com 3 Opções Flexíveis */}
                      <div className="sm:col-span-6">
                        <label className="block text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1">
                          Forma de Cobrança do Transporte *
                        </label>
                        <select
                          value={truckBillingMode}
                          onChange={(e) => setTruckBillingMode(e.target.value as any)}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-600 rounded-lg text-xs sm:text-sm font-bold text-blue-900 dark:text-blue-300 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 cursor-pointer"
                        >
                          <option value="horas">⏱️ Por Horas</option>
                          <option value="cargas_km">📦 Por Cargas com KM Adicional</option>
                          <option value="somente_km">🛣️ Somente em KM</option>
                        </select>
                      </div>
                    </div>

                    {/* Inputs de acordo com a opção escolhida */}
                    {/* 1. Modalidade: Por Horas */}
                    {truckBillingMode === 'horas' && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Horas Trabalhadas (h) *
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={truckServiceHours}
                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
                            onChange={(e) => setTruckServiceHours(e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder="Ex: 10.0"
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-600 focus:border-blue-600 shadow-2xs"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Valor da Hora (R$/h) *
                          </label>
                          <input
                            type="text"
                            value={truckServiceHourlyRate}
                            onChange={(e) => setTruckServiceHourlyRate(maskCurrencyBRLInput(e.target.value))}
                            onBlur={() => setTruckServiceHourlyRate(formatCurrencyBRLOnBlur(truckServiceHourlyRate))}
                            placeholder="R$ 0,00"
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-600 focus:border-blue-600 shadow-2xs"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Subtotal do Transporte
                          </label>
                          <div className="w-full px-3 py-2 bg-blue-50 dark:bg-slate-800 border border-blue-300 dark:border-slate-600 rounded-lg text-xs sm:text-sm font-bold text-blue-950 dark:text-white flex items-center justify-between shadow-2xs">
                            <span>{formatCurrencyBRL(subtotalServicoMaquina)}</span>
                            <span className="text-[10px] text-blue-700 dark:text-blue-300 font-normal">
                              {truckServiceHours || 0} h × {formatCurrencyBRL(parseCurrencyToFloat(truckServiceHourlyRate))}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 2. Modalidade: Por Cargas com KM Adicional */}
                    {truckBillingMode === 'cargas_km' && (
                      <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                              Quantidade de Cargas *
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={truckServiceLoads}
                              onWheel={(e) => (e.target as HTMLInputElement).blur()}
                              onChange={(e) => setTruckServiceLoads(e.target.value === '' ? '' : Number(e.target.value))}
                              placeholder="Ex: 5"
                              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-600 focus:border-blue-600 shadow-2xs"
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                              Valor por Carga (R$/carga) *
                            </label>
                            <input
                              type="text"
                              value={truckServiceRatePerLoad}
                              onChange={(e) => setTruckServiceRatePerLoad(maskCurrencyBRLInput(e.target.value))}
                              onBlur={() => setTruckServiceRatePerLoad(formatCurrencyBRLOnBlur(truckServiceRatePerLoad))}
                              placeholder="R$ 0,00"
                              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-600 focus:border-blue-600 shadow-2xs"
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                              KM Adicional Rodado
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={truckServiceAdditionalKm}
                              onWheel={(e) => (e.target as HTMLInputElement).blur()}
                              onChange={(e) => setTruckServiceAdditionalKm(e.target.value === '' ? '' : Number(e.target.value))}
                              placeholder="Ex: 25"
                              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-600 focus:border-blue-600 shadow-2xs"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                              Valor por KM Adicional (R$/km)
                            </label>
                            <input
                              type="text"
                              value={truckServiceRatePerKm}
                              onChange={(e) => setTruckServiceRatePerKm(maskCurrencyBRLInput(e.target.value))}
                              onBlur={() => setTruckServiceRatePerKm(formatCurrencyBRLOnBlur(truckServiceRatePerKm))}
                              placeholder="R$ 0,00"
                              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-600 focus:border-blue-600 shadow-2xs"
                            />
                          </div>
                        </div>

                        {/* Card Subtotal da Combinação */}
                        <div className="flex items-center justify-between px-3.5 py-2 bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-700 rounded-lg">
                          <span className="text-xs text-blue-900 dark:text-blue-300 font-semibold">
                            Cargas ({truckServiceLoads || 0} × {formatCurrencyBRL(parseCurrencyToFloat(truckServiceRatePerLoad))}) + KM ({truckServiceAdditionalKm || 0} km × {formatCurrencyBRL(parseCurrencyToFloat(truckServiceRatePerKm))})
                          </span>
                          <span className="text-sm font-bold text-blue-950 dark:text-white">
                            Subtotal: {formatCurrencyBRL(subtotalServicoMaquina)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* 3. Modalidade: Somente em KM */}
                    {truckBillingMode === 'somente_km' && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Quilometragem Total (km) *
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={truckServiceTotalKm}
                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
                            onChange={(e) => setTruckServiceTotalKm(e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder="Ex: 120"
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-600 focus:border-blue-600 shadow-2xs"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Valor por KM (R$/km) *
                          </label>
                          <input
                            type="text"
                            value={truckServiceRateOnlyKm}
                            onChange={(e) => setTruckServiceRateOnlyKm(maskCurrencyBRLInput(e.target.value))}
                            onBlur={() => setTruckServiceRateOnlyKm(formatCurrencyBRLOnBlur(truckServiceRateOnlyKm))}
                            placeholder="R$ 0,00"
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-600 focus:border-blue-600 shadow-2xs"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Subtotal do Transporte
                          </label>
                          <div className="w-full px-3 py-2 bg-blue-50 dark:bg-slate-800 border border-blue-300 dark:border-slate-600 rounded-lg text-xs sm:text-sm font-bold text-blue-950 dark:text-white flex items-center justify-between shadow-2xs">
                            <span>{formatCurrencyBRL(subtotalServicoMaquina)}</span>
                            <span className="text-[10px] text-blue-700 dark:text-blue-300 font-normal">
                              {truckServiceTotalKm || 0} km × {formatCurrencyBRL(parseCurrencyToFloat(truckServiceRateOnlyKm))}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* BLOCO CENTRAL: ABA 1. SERVIÇO DE FRETE & REGRAS DE COBRANÇA */}
            {activeTab === 'frete' && (
              <div className="bg-emerald-50/70 dark:bg-slate-800/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-3.5 sm:p-4 shadow-sm space-y-4">
                {/* Cabeçalho Verde Esmeralda */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200 dark:border-emerald-800/60 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-emerald-700 text-white rounded-lg shadow-xs">
                      <Truck className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-emerald-950 dark:text-white uppercase tracking-wider">
                        ABA 1. SERVIÇO DE FRETE & REGRAS DE COBRANÇA
                      </h4>
                      <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
                        Gestão operacional e faturamento de transporte e frete rodoviário para clientes externos
                      </p>
                    </div>
                  </div>

                  <span className="self-start sm:self-auto px-2.5 py-1 text-[11px] font-bold rounded-lg border bg-white dark:bg-slate-900 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 shadow-2xs">
                    {truckBillingMode === 'km' || truckBillingMode === 'somente_km'
                      ? 'Modalidade: Por KM'
                      : truckBillingMode === 'horas'
                      ? 'Modalidade: Por Hora'
                      : truckBillingMode === 'cargas' || truckBillingMode === 'cargas_km'
                      ? 'Modalidade: Por Carga'
                      : 'Modalidade: Por Viagem'}
                  </span>
                </div>

                {/* Bloco 1: Veículo, Condutor e Dados da Carga / Rota */}
                <div className="bg-white dark:bg-slate-900/80 border border-emerald-200 dark:border-slate-700 rounded-xl p-3 sm:p-4 space-y-3 shadow-2xs">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    {/* Caminhão da Frota */}
                    <div className="sm:col-span-5">
                      <label className="block text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1">
                        Caminhão da Frota *
                      </label>
                      <select
                        value={truckServiceId}
                        onChange={(e) => {
                          const tId = e.target.value;
                          setTruckServiceId(tId);
                          const found = machineries.find((m) => m.id === tId);
                          if (found) {
                            setTruckServiceName(found.name || found.model);
                          }
                        }}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-600 rounded-lg text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 cursor-pointer"
                      >
                        <option value="">Selecione o caminhão...</option>
                        {frotasCaminhoesDisponiveis.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.licensePlateOrSerial ? `[${m.licensePlateOrSerial}] ` : ''}
                            {m.name || m.model} {m.brand ? `(${m.brand})` : ''} {m.capacityM3 ? `• ${m.capacityM3}m³` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Motorista / Responsável */}
                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1">
                        Motorista / Condutor
                      </label>
                      <select
                        value={freightDriverId}
                        onChange={(e) => {
                          const drvId = e.target.value;
                          setFreightDriverId(drvId);
                          const emp = employees.find((em) => em.id === drvId);
                          if (emp) {
                            setFreightDriverName(emp.name);
                          } else {
                            setFreightDriverName('');
                          }
                        }}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-600 rounded-lg text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 cursor-pointer"
                      >
                        <option value="">Selecione o motorista...</option>
                        {employees.map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.name} {emp.role ? `(${emp.role})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Tipo de Carga / Material */}
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1">
                        Tipo de Carga / Material
                      </label>
                      <input
                        type="text"
                        value={freightMaterialType}
                        onChange={(e) => setFreightMaterialType(e.target.value)}
                        placeholder="Ex: Silagem, Grãos, Adubo..."
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-600 rounded-lg text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
                      />
                    </div>
                  </div>

                  {/* Origem e Destino */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Origem / Ponto de Partida
                      </label>
                      <input
                        type="text"
                        value={freightOrigin}
                        onChange={(e) => setFreightOrigin(e.target.value)}
                        placeholder="Ex: Fazenda Boa Esperança, Galpão 1..."
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 shadow-2xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Destino / Ponto de Entrega
                      </label>
                      <input
                        type="text"
                        value={freightDestination}
                        onChange={(e) => setFreightDestination(e.target.value)}
                        placeholder="Ex: Silo da Cooperativa, Fazenda Santa Fé..."
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 shadow-2xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Seletor das 4 Regras de Cobrança do Frete */}
                <div className="bg-white dark:bg-slate-900/80 border border-emerald-200 dark:border-slate-700 rounded-xl p-3 sm:p-4 space-y-3.5 shadow-2xs">
                  <div>
                    <label className="block text-[11px] font-bold text-emerald-950 dark:text-slate-200 uppercase tracking-wider mb-2">
                      Regra de Cobrança do Frete *
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => setTruckBillingMode('km')}
                        className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold border transition cursor-pointer ${
                          truckBillingMode === 'km' || truckBillingMode === 'somente_km'
                            ? 'bg-emerald-700 text-white border-emerald-800 shadow-sm'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:bg-emerald-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        <Gauge className="w-4 h-4" />
                        <span>Por KM</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setTruckBillingMode('horas')}
                        className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold border transition cursor-pointer ${
                          truckBillingMode === 'horas'
                            ? 'bg-emerald-700 text-white border-emerald-800 shadow-sm'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:bg-emerald-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        <Clock className="w-4 h-4" />
                        <span>Por Hora</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setTruckBillingMode('cargas')}
                        className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold border transition cursor-pointer ${
                          truckBillingMode === 'cargas' || truckBillingMode === 'cargas_km'
                            ? 'bg-emerald-700 text-white border-emerald-800 shadow-sm'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:bg-emerald-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        <Layers className="w-4 h-4" />
                        <span>Por Carga</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setTruckBillingMode('viagem')}
                        className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold border transition cursor-pointer ${
                          truckBillingMode === 'viagem'
                            ? 'bg-emerald-700 text-white border-emerald-800 shadow-sm'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:bg-emerald-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        <ArrowRight className="w-4 h-4" />
                        <span>Por Viagem</span>
                      </button>
                    </div>
                  </div>

                  {/* 1. Modalidade: Por KM */}
                  {(truckBillingMode === 'km' || truckBillingMode === 'somente_km') && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Quilometragem Total (km) *
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={truckServiceTotalKm}
                          onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          onChange={(e) => setTruckServiceTotalKm(e.target.value === '' ? '' : Number(e.target.value))}
                          placeholder="Ex: 120"
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 shadow-2xs"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Valor por KM (R$/km) *
                        </label>
                        <input
                          type="text"
                          value={truckServiceRateOnlyKm}
                          onChange={(e) => setTruckServiceRateOnlyKm(maskCurrencyBRLInput(e.target.value))}
                          onBlur={() => setTruckServiceRateOnlyKm(formatCurrencyBRLOnBlur(truckServiceRateOnlyKm))}
                          placeholder="R$ 0,00"
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 shadow-2xs"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Subtotal do Frete
                        </label>
                        <div className="w-full px-3 py-2 bg-emerald-50 dark:bg-slate-800 border border-emerald-300 dark:border-slate-600 rounded-lg text-xs sm:text-sm font-bold text-emerald-950 dark:text-white flex items-center justify-between shadow-2xs">
                          <span>{formatCurrencyBRL(subtotalServicoMaquina)}</span>
                          <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-normal">
                            {truckServiceTotalKm || 0} km × {formatCurrencyBRL(parseCurrencyToFloat(truckServiceRateOnlyKm))}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 2. Modalidade: Por Hora */}
                  {truckBillingMode === 'horas' && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Horas Trabalhadas (h) *
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={truckServiceHours}
                          onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          onChange={(e) => setTruckServiceHours(e.target.value === '' ? '' : Number(e.target.value))}
                          placeholder="Ex: 8.0"
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 shadow-2xs"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Valor da Hora (R$/h) *
                        </label>
                        <input
                          type="text"
                          value={truckServiceHourlyRate}
                          onChange={(e) => setTruckServiceHourlyRate(maskCurrencyBRLInput(e.target.value))}
                          onBlur={() => setTruckServiceHourlyRate(formatCurrencyBRLOnBlur(truckServiceHourlyRate))}
                          placeholder="R$ 0,00"
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 shadow-2xs"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Subtotal do Frete
                        </label>
                        <div className="w-full px-3 py-2 bg-emerald-50 dark:bg-slate-800 border border-emerald-300 dark:border-slate-600 rounded-lg text-xs sm:text-sm font-bold text-emerald-950 dark:text-white flex items-center justify-between shadow-2xs">
                          <span>{formatCurrencyBRL(subtotalServicoMaquina)}</span>
                          <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-normal">
                            {truckServiceHours || 0} h × {formatCurrencyBRL(parseCurrencyToFloat(truckServiceHourlyRate))}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 3. Modalidade: Por Carga (com KM adicional opcional) */}
                  {(truckBillingMode === 'cargas' || truckBillingMode === 'cargas_km') && (
                    <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Quantidade de Cargas *
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={truckServiceLoads}
                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
                            onChange={(e) => setTruckServiceLoads(e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder="Ex: 4"
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 shadow-2xs"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Valor por Carga (R$/carga) *
                          </label>
                          <input
                            type="text"
                            value={truckServiceRatePerLoad}
                            onChange={(e) => setTruckServiceRatePerLoad(maskCurrencyBRLInput(e.target.value))}
                            onBlur={() => setTruckServiceRatePerLoad(formatCurrencyBRLOnBlur(truckServiceRatePerLoad))}
                            placeholder="R$ 0,00"
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 shadow-2xs"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                            KM Adicional Rodado
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={truckServiceAdditionalKm}
                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
                            onChange={(e) => setTruckServiceAdditionalKm(e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder="Ex: 30"
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 shadow-2xs"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Valor por KM Adicional (R$/km)
                          </label>
                          <input
                            type="text"
                            value={truckServiceRatePerKm}
                            onChange={(e) => setTruckServiceRatePerKm(maskCurrencyBRLInput(e.target.value))}
                            onBlur={() => setTruckServiceRatePerKm(formatCurrencyBRLOnBlur(truckServiceRatePerKm))}
                            placeholder="R$ 0,00"
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 shadow-2xs"
                          />
                        </div>
                      </div>

                      {/* Card Subtotal da Combinação */}
                      <div className="flex items-center justify-between px-3.5 py-2 bg-emerald-50 dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 rounded-lg">
                        <span className="text-xs text-emerald-900 dark:text-emerald-300 font-semibold">
                          Cargas ({truckServiceLoads || 0} × {formatCurrencyBRL(parseCurrencyToFloat(truckServiceRatePerLoad))}) + KM ({truckServiceAdditionalKm || 0} km × {formatCurrencyBRL(parseCurrencyToFloat(truckServiceRatePerKm))})
                        </span>
                        <span className="text-sm font-bold text-emerald-950 dark:text-white">
                          Subtotal: {formatCurrencyBRL(subtotalServicoMaquina)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* 4. Modalidade: Por Viagem */}
                  {truckBillingMode === 'viagem' && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Quantidade de Viagens *
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={truckServiceTrips}
                          onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          onChange={(e) => setTruckServiceTrips(e.target.value === '' ? '' : Number(e.target.value))}
                          placeholder="Ex: 2"
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 shadow-2xs"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Valor por Viagem (R$/viagem) *
                        </label>
                        <input
                          type="text"
                          value={truckServiceRatePerTrip}
                          onChange={(e) => setTruckServiceRatePerTrip(maskCurrencyBRLInput(e.target.value))}
                          onBlur={() => setTruckServiceRatePerTrip(formatCurrencyBRLOnBlur(truckServiceRatePerTrip))}
                          placeholder="R$ 0,00"
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 shadow-2xs"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Subtotal do Frete
                        </label>
                        <div className="w-full px-3 py-2 bg-emerald-50 dark:bg-slate-800 border border-emerald-300 dark:border-slate-600 rounded-lg text-xs sm:text-sm font-bold text-emerald-950 dark:text-white flex items-center justify-between shadow-2xs">
                          <span>{formatCurrencyBRL(subtotalServicoMaquina)}</span>
                          <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-normal">
                            {truckServiceTrips || 0} viagem(ns) × {formatCurrencyBRL(parseCurrencyToFloat(truckServiceRatePerTrip))}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2. ÁREA E UNIDADES (CORTE E COLHEITA) */}
            {(activeTab === 'corte' || activeTab === 'colheita') && (
              <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-3 sm:p-3.5 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-300 dark:border-slate-700 pb-2">
                  <span className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                    Área & Produção (Valor Base)
                  </span>

                  {/* Toggle Hectares / Alqueires / Hora */}
                  <div className="inline-flex rounded-lg p-0.5 bg-gray-200 dark:bg-slate-700 self-start sm:self-auto text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setUnidadeArea('hectares');
                        if (modoCobrancaTrator === 'area_alq') {
                          setModoCobrancaTrator('area_ha');
                        }
                        if (modoComissaoOperador === 'area_alq') {
                          setModoComissaoOperador('area_ha');
                          if (operadorTratorId) {
                            const emp = employees.find((e) => e.id === operadorTratorId);
                            if (emp && emp.commissionPerHectare) {
                              setTaxaComissaoOperador(Number(emp.commissionPerHectare.toFixed(2)));
                            }
                          }
                        }
                        const op = getSelectedForageOperator(operadorForrageiraId, operadorForrageiraNome);
                        if (op) {
                          applyForageOperatorCommission(op, 'hectares');
                        }
                      }}
                      className={`px-2.5 py-0.5 sm:py-1 font-semibold rounded-md transition cursor-pointer ${
                        unidadeArea === 'hectares'
                          ? 'bg-emerald-800 text-white shadow-xs font-bold'
                          : 'text-gray-600 dark:text-slate-300 hover:text-gray-900'
                      }`}
                    >
                      Por Hectare (ha)
                    </button>
                    <button
                      type="button"
                      onClick={() => setUnidadeArea('alqueires')}
                      className={`px-2.5 py-0.5 sm:py-1 font-semibold rounded-md transition cursor-pointer ${
                        unidadeArea === 'alqueires'
                          ? 'bg-emerald-800 text-white shadow-xs font-bold'
                          : 'text-gray-600 dark:text-slate-300 hover:text-gray-900'
                      }`}
                    >
                      Por Alqueire (alq)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUnidadeArea('hora');
                        const op = getSelectedForageOperator(operadorForrageiraId, operadorForrageiraNome);
                        if (op) {
                          applyForageOperatorCommission(op, 'hora');
                        }
                      }}
                      className={`px-2.5 py-0.5 sm:py-1 font-semibold rounded-md transition cursor-pointer ${
                        unidadeArea === 'hora'
                          ? 'bg-emerald-800 text-white shadow-xs font-bold'
                          : 'text-gray-600 dark:text-slate-300 hover:text-gray-900'
                      }`}
                    >
                      Por Hora (h)
                    </button>
                  </div>
                </div>

                {/* Linha 1: Quantidade, Valor Unitário com Máscara BRL e Subtotal da Área */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 dark:text-slate-300 mb-1">
                      {unidadeArea === 'hectares' ? 'Quantidade (ha)' : unidadeArea === 'alqueires' ? 'Quantidade (alq)' : 'Quantidade (horas)'}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={quantidadeArea}
                      onWheel={(e) => (e.target as HTMLInputElement).blur()}
                      onChange={(e) => setQuantidadeArea(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="Ex: 15.5"
                      className="w-full px-3 py-1.5 sm:py-2 bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-500 rounded-lg text-xs sm:text-sm text-gray-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600 shadow-2xs transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 dark:text-slate-300 mb-1">
                      R$ / {unidadeArea === 'hectares' ? 'Hectare' : unidadeArea === 'alqueires' ? 'Alqueire' : 'Hora'}
                    </label>
                    <input
                      type="text"
                      value={valorPorHectare}
                      onChange={(e) => setValorPorHectare(maskCurrencyBRLInput(e.target.value))}
                      onBlur={() => setValorPorHectare(formatCurrencyBRLOnBlur(valorPorHectare))}
                      placeholder="R$ 0,00"
                      className="w-full px-3 py-1.5 sm:py-2 bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-500 rounded-lg text-xs sm:text-sm text-gray-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600 shadow-2xs transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 dark:text-slate-300 mb-1">
                      Subtotal Área (Base)
                    </label>
                    <div className="w-full px-3 py-1.5 sm:py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center justify-between shadow-2xs cursor-not-allowed">
                      <span>{formatCurrencyBRL(valorBaseArea)}</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">Base Frota</span>
                    </div>
                  </div>
                </div>

                {/* Linha 2: Frete Prancha (R$) com Máscara BRL, Peso por m³ (Kg) e Estimativa de Produção Automatizada */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 pt-2 border-t border-slate-300 dark:border-slate-700">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        Frete Prancha (R$)
                      </span>
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">(Soma ao Total)</span>
                    </label>
                    <input
                      type="text"
                      value={fretePrancha}
                      onChange={(e) => setFretePrancha(maskCurrencyBRLInput(e.target.value))}
                      onBlur={() => setFretePrancha(formatCurrencyBRLOnBlur(fretePrancha))}
                      placeholder="R$ 0,00"
                      className="w-full px-3 py-1.5 sm:py-2 bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-500 rounded-lg text-xs sm:text-sm text-gray-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600 shadow-2xs transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                      <span>Peso por m³ (Kg)</span>
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">Densidade</span>
                    </label>
                    <input
                      type="number"
                      step="10"
                      min="0"
                      value={pesoPorM3}
                      onWheel={(e) => (e.target as HTMLInputElement).blur()}
                      onChange={(e) => setPesoPorM3(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="Ex: 650"
                      className="w-full px-3 py-1.5 sm:py-2 bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-500 rounded-lg text-xs sm:text-sm text-gray-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600 shadow-2xs transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                      <span>Estimativa de Produção</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Bloqueado (Auto)</span>
                    </label>
                    <div className="w-full px-3 py-1.5 sm:py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center justify-between shadow-2xs cursor-not-allowed" title={`Fórmula: (${totalVolumeGeralM3.toFixed(1)} m³ × ${pesoPorM3 || 0} kg) / 1000`}>
                      <span>{estimativaToneladas > 0 ? `${estimativaToneladas.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} ton` : '0,0 ton'}</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono font-normal">
                        {totalVolumeGeralM3 > 0 ? `${totalVolumeGeralM3.toFixed(1)} m³` : '0 m³'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* NOVO BLOCO: AGENCIADOR / INTERMEDIAÇÃO */}
            {(activeTab === 'corte' || activeTab === 'colheita' || activeTab === 'plantio' || activeTab === 'pulverizacao') && (
              <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-3.5 sm:p-4 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Handshake className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                      AGENCIADOR / INTERMEDIAÇÃO
                    </span>
                    {brokerId ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded shadow-2xs">
                        Vinculado ao Pedido
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded shadow-2xs">
                        Opcional
                      </span>
                    )}
                  </div>
                  {brokerId && (
                    <button
                      type="button"
                      onClick={() => handleSelectBroker('')}
                      className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 hover:underline cursor-pointer self-start sm:self-auto"
                    >
                      Limpar Agenciador
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  {/* Campo 1: Select / Dropdown do Agenciador */}
                  <div className="sm:col-span-5">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wide">
                      SELECIONE O AGENCIADOR
                    </label>
                    <select
                      value={brokerId}
                      onChange={(e) => handleSelectBroker(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-600 rounded-lg text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600 shadow-2xs transition-colors cursor-pointer"
                    >
                      <option value="">-- Nenhum Agenciador --</option>
                      {agenciadoresDisponiveis.map((ag) => (
                        <option key={ag.id} value={ag.id}>
                          {ag.name.toUpperCase()} {ag.actingRegion ? `(${ag.actingRegion})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Campo 2: Regra de Comissão (Tipo e Valor / %) */}
                  {brokerId ? (
                    <>
                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wide">
                          Tipo de Comissão
                        </label>
                        <select
                          value={brokerCommissionType}
                          onChange={(e) => setBrokerCommissionType(e.target.value)}
                          className="w-full px-2.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600 shadow-2xs cursor-pointer"
                        >
                          <option value="Porcentagem (%) sobre o valor do pedido">% sobre o valor do pedido (Área)</option>
                          <option value="Porcentagem (%) sobre a produção">% sobre a produção (Estimativa ton)</option>
                          <option value="Valor Fixo por contrato/pedido">Valor Fixo (R$ direto)</option>
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wide">
                          {brokerCommissionType === 'Valor Fixo por contrato/pedido' ? 'Valor Fixo (R$)' : 'Alíquota (%)'}
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={brokerCommissionRate}
                          onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          onChange={(e) => setBrokerCommissionRate(e.target.value === '' ? '' : Number(e.target.value))}
                          placeholder="Ex: 5"
                          className="w-full px-2.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600 shadow-2xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>

                      {/* Label Destacada com o Resultado do Cálculo Dinâmico */}
                      <div className="sm:col-span-2 flex flex-col justify-end">
                        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-lg px-2.5 py-1.5 shadow-2xs">
                          <span className="block text-[9.5px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-tight truncate" title={`Comissão Agenciador ${brokerName || ''}`}>
                            Comissão Agenciador {brokerName ? `[${brokerName}]` : ''}:
                          </span>
                          <span className="block text-sm font-black font-mono text-amber-900 dark:text-amber-200">
                            {formatCurrencyBRL(brokerCommissionAmount)}
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="sm:col-span-7">
                      <p className="text-xs text-slate-500 dark:text-slate-400 italic py-2">
                        Caso este pedido tenha intermediação ou agenciamento externo, selecione o agenciador para calcular sua comissão e lançar automaticamente no Contas a Pagar.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3. BLOCO FORRAGEIRA / ENSILADEIRA (COR DE FUNDO PERSONALIZADA #edc79c) COM OPÇÃO NEUTRA E TOGGLES DE COMISSÃO */}
            {(activeTab === 'corte' || activeTab === 'colheita') && (
              <div className={`border rounded-xl p-4 space-y-4 border-l-4 transition-colors bg-[#edc79c] ${
                forrageiraId || forrageiraNome.trim()
                  ? 'border-[#cda372] border-l-[#a66d2a] shadow-xs'
                  : 'border-[#d4aa78] border-l-slate-400'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#cca06e]/80 pb-2">
                  <div className="flex items-center gap-2">
                    <Scissors className={`w-4 h-4 ${forrageiraId || forrageiraNome.trim() ? 'text-amber-950' : 'text-slate-600'}`} />
                    <span className="text-xs font-bold text-slate-950 uppercase tracking-wider">
                      Ensiladeira / Forrageira
                    </span>
                    {!(forrageiraId || forrageiraNome.trim()) && (
                      <span className="text-[10px] uppercase font-bold text-slate-700 bg-white/80 px-2 py-0.5 rounded shadow-2xs">
                        Desativada / Nenhuma
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-amber-950 bg-white/85 px-2.5 py-0.5 rounded-full border border-[#cca06e] flex items-center gap-1.5 shadow-2xs">
                      <span>Horímetro, Tambor & Comissões</span>
                      {comissaoForrageiraP1 > 0 && (
                        <span className="font-bold bg-[#deaa72] text-amber-950 px-1.5 py-0.2 rounded-full text-[10px]">
                          {formatCurrencyBRL(comissaoForrageiraP1)}
                        </span>
                      )}
                    </span>
                    {(forrageiraId || forrageiraNome.trim()) && (
                      <button
                        type="button"
                        onClick={handleClearForrageira}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 hover:text-rose-900 hover:underline cursor-pointer ml-1"
                        title="Não utilizar forrageira e zerar custos"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Remover Forrageira</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Seleção de Forrageira (APENAS FORRAGEIRAS com OPÇÃO NEUTRA e REGRA DE EXCLUSÃO) */}
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Selecione uma Forrageira / Ensiladeira
                      </label>
                      <span className="text-[10px] text-amber-950 font-semibold">
                        {forrageirasDisponiveis.length} forrageira(s) disponível(is)
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        value={forrageiraNome}
                        onChange={(e) => setForrageiraNome(e.target.value)}
                        placeholder="-- Não Utilizar Forrageira / Nenhuma (Clique para escolher) --"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-400 rounded-lg text-sm text-slate-900 placeholder-slate-400 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-700/30 focus:border-amber-700 shadow-2xs transition-colors"
                      />
                      <select
                        value={forrageiraId}
                        onChange={(e) => handleSelectForrageira(e.target.value)}
                        className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                        title="Selecionar forrageira cadastrada"
                      >
                        <option value="">-- Não Utilizar Forrageira / Nenhuma --</option>
                        {forrageirasDisponiveis.map((m) => (
                          <option key={m.id} value={m.id}>
                            {formatMachineryOptionLabel(m)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {!(forrageiraId || forrageiraNome.trim()) ? (
                    <div className="p-3.5 rounded-lg border border-dashed border-[#cca06e] bg-white/80 text-center text-xs text-slate-700">
                      <p className="font-bold text-slate-800">
                        Nenhuma forrageira selecionada para este serviço.
                      </p>
                      <p className="text-[11px] mt-0.5 text-slate-600">
                        Os custos de cobrança e comissão da forrageira estão zerados e não afetarão o DRE final. Para selecionar uma máquina, clique no seletor acima.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Operador Principal (Autocompletado) e Segundo Operador (Opcional - inicia vazio) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                          <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                            <span>Operador da Forrageira (Principal)</span>
                            <span className="text-[10px] text-amber-950 font-bold">Autocompletado</span>
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              value={operadorForrageiraNome}
                              onChange={(e) => {
                                const newName = e.target.value;
                                setOperadorForrageiraNome(newName);
                                setOperadorForrageiraId('');
                                const matched = getSelectedForageOperator('', newName);
                                if (matched) {
                                  setOperadorForrageiraId(matched.id);
                                  applyForageOperatorCommission(matched, unidadeArea);
                                }
                              }}
                              placeholder="Ex: Operador Roberto"
                              className="w-full px-3.5 py-2.5 bg-white border border-slate-400 rounded-lg text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-700/30 focus:border-amber-700 shadow-2xs transition-colors"
                            />
                            {employees.length > 0 && (
                              <select
                                value={operadorForrageiraId}
                                onChange={(e) => {
                                  const emp = employees.find((em) => em.id === e.target.value);
                                  setOperadorForrageiraId(e.target.value);
                                  setOperadorForrageiraNome(emp ? emp.name : '');
                                  if (emp) {
                                    applyForageOperatorCommission(emp, unidadeArea);
                                  }
                                }}
                                className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                                title="Selecionar operador de forrageira"
                              >
                                <option value="">-- Escolher Operador --</option>
                                {employees.map((emp) => (
                                  <option key={emp.id} value={emp.id}>
                                    {formatEmployeeOptionLabel(emp)}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                            <span>Segundo Operador (Opcional)</span>
                            <span className="text-[10px] text-amber-950/80 font-semibold">Inicia Vazio</span>
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              value={segundoOperadorForrageiraNome}
                              onChange={(e) => {
                                setSegundoOperadorForrageiraNome(e.target.value);
                                setSegundoOperadorForrageiraId('');
                              }}
                              placeholder="Ex: Auxiliar / Suplente"
                              className="w-full px-3.5 py-2.5 bg-white border border-slate-400 rounded-lg text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-700/30 focus:border-amber-700 shadow-2xs transition-colors"
                            />
                            {employees.length > 0 && (
                              <select
                                value={segundoOperadorForrageiraId}
                                onChange={(e) => {
                                  const emp = employees.find((em) => em.id === e.target.value);
                                  setSegundoOperadorForrageiraId(e.target.value);
                                  setSegundoOperadorForrageiraNome(emp ? emp.name : '');
                                }}
                                className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                                title="Selecionar segundo operador de forrageira"
                              >
                                <option value="">-- Nenhum segundo operador --</option>
                                {employees.map((emp) => (
                                  <option key={emp.id} value={emp.id}>
                                    {formatEmployeeOptionLabel(emp)}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Horímetros: Hora do Tambor e Hora do Motor */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                        <div>
                          <label className="block text-xs font-bold text-slate-900 mb-1">
                            Hora do Tambor (H)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={horasTambor}
                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
                            onChange={(e) => setHorasTambor(e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder="Ex: 8.5"
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-400 rounded-lg text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-700/30 focus:border-amber-700 shadow-2xs transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-900 mb-1">
                            Hora do Motor (H)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={horasMotor}
                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
                            onChange={(e) => setHorasMotor(e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder="Ex: 10.2"
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-400 rounded-lg text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-700/30 focus:border-amber-700 shadow-2xs transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </div>
                      </div>

                      {/* SUB-BLOCO COMISSÃO DO OPERADOR DA FORRAGEIRA (COM TOGGLES DE ALTERNÂNCIA) */}
                      <div className="bg-white border border-slate-300 rounded-lg p-3.5 space-y-3 print-client-hide shadow-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                            <Calculator className="w-3.5 h-3.5 text-amber-700" />
                            Comissão do Operador da Forrageira (Independente)
                          </span>

                          {/* Botões de Alternância (Toggles): 4 Opções de Comissão da Forrageira */}
                          <div className="inline-flex rounded-lg p-0.5 bg-amber-100/90 self-start sm:self-auto text-xs">
                            <button
                              type="button"
                              onClick={() => {
                                setModoComissaoForrageira('livre');
                                if (qtdBaseComissaoForrageira === '') {
                                  const defaultBase = typeof horasTambor === 'number' && horasTambor > 0 
                                    ? horasTambor 
                                    : typeof horasMotor === 'number' && horasMotor > 0 
                                    ? horasMotor 
                                    : typeof quantidadeArea === 'number' && quantidadeArea > 0 
                                    ? quantidadeArea 
                                    : '';
                                  setQtdBaseComissaoForrageira(defaultBase);
                                }
                              }}
                              className={`px-2.5 py-1 font-semibold rounded-md transition cursor-pointer ${
                                modoComissaoForrageira === 'livre'
                                  ? 'bg-amber-600 text-white shadow-xs font-bold'
                                  : 'text-gray-700 hover:text-gray-900'
                              }`}
                            >
                              Digitar (livre)
                            </button>
                            <button
                              type="button"
                              onClick={() => setModoComissaoForrageira('tambor')}
                              className={`px-2.5 py-1 font-semibold rounded-md transition cursor-pointer ${
                                modoComissaoForrageira === 'tambor'
                                  ? 'bg-amber-600 text-white shadow-xs font-bold'
                                  : 'text-gray-700 hover:text-gray-900'
                              }`}
                            >
                              Por Hora (tambor)
                            </button>
                            <button
                              type="button"
                              onClick={() => setModoComissaoForrageira('motor')}
                              className={`px-2.5 py-1 font-semibold rounded-md transition cursor-pointer ${
                                modoComissaoForrageira === 'motor'
                                  ? 'bg-amber-600 text-white shadow-xs font-bold'
                                  : 'text-gray-700 hover:text-gray-900'
                              }`}
                            >
                              Por Hora (Motor)
                            </button>
                            <button
                              type="button"
                              onClick={() => setModoComissaoForrageira('area')}
                              className={`px-2.5 py-1 font-semibold rounded-md transition cursor-pointer ${
                                modoComissaoForrageira === 'area'
                                  ? 'bg-amber-600 text-white shadow-xs font-bold'
                                  : 'text-gray-700 hover:text-gray-900'
                              }`}
                            >
                              Por Área ({unidadeArea === 'alqueires' ? 'alq' : 'ha'})
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-gray-700 mb-1 flex items-center justify-between">
                              <span>Base da Comissão ({modoComissaoForrageira === 'livre' ? 'Livre' : modoComissaoForrageira === 'tambor' ? 'Hora Tambor' : modoComissaoForrageira === 'motor' ? 'Hora Motor' : 'Área'})</span>
                              {modoComissaoForrageira !== 'livre' && (
                                <span className="text-[10px] text-amber-900 font-semibold bg-amber-100 px-1.5 py-0.2 rounded flex items-center gap-1">
                                  <Lock className="w-2.5 h-2.5" />
                                  Travado ({modoComissaoForrageira === 'tambor' ? 'Hora Tambor' : modoComissaoForrageira === 'motor' ? 'Hora Motor' : 'Área'})
                                </span>
                              )}
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              readOnly={modoComissaoForrageira !== 'livre'}
                              value={
                                modoComissaoForrageira === 'livre'
                                  ? (qtdBaseComissaoForrageira ?? '')
                                  : modoComissaoForrageira === 'tambor'
                                  ? (typeof horasTambor === 'number' && horasTambor > 0 
                                      ? horasTambor 
                                      : (unidadeArea === 'hora' && typeof quantidadeArea === 'number' && quantidadeArea > 0 ? quantidadeArea : ''))
                                  : modoComissaoForrageira === 'motor'
                                  ? (typeof horasMotor === 'number' && horasMotor > 0 
                                      ? horasMotor 
                                      : (unidadeArea === 'hora' && typeof quantidadeArea === 'number' && quantidadeArea > 0 ? quantidadeArea : ''))
                                  : (typeof quantidadeArea === 'number' && quantidadeArea > 0 ? quantidadeArea : '')
                              }
                              onChange={(e) => {
                                if (modoComissaoForrageira === 'livre') {
                                  setQtdBaseComissaoForrageira(e.target.value === '' ? '' : Number(e.target.value));
                                }
                              }}
                              onWheel={(e) => (e.target as HTMLInputElement).blur()}
                              placeholder={
                                modoComissaoForrageira === 'livre'
                                  ? 'Digite a base livremente'
                                  : modoComissaoForrageira === 'tambor'
                                  ? (typeof horasTambor === 'number' && horasTambor > 0 ? 'Puxado de Hora do Tambor (H)' : unidadeArea === 'hora' ? 'Puxado das Horas da OS' : 'Puxado de Hora do Tambor (H)')
                                  : modoComissaoForrageira === 'motor'
                                  ? (typeof horasMotor === 'number' && horasMotor > 0 ? 'Puxado de Hora do Motor (H)' : unidadeArea === 'hora' ? 'Puxado das Horas da OS' : 'Puxado de Hora do Motor (H)')
                                  : 'Puxado da Área Global'
                              }
                              className={`w-full px-3 py-2 rounded-lg text-xs font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                modoComissaoForrageira === 'livre'
                                  ? 'bg-white border border-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 shadow-2xs transition-colors'
                                  : 'bg-slate-100 border border-slate-300 text-slate-800 cursor-not-allowed'
                              }`}
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-gray-700 mb-1">
                              R$ / {modoComissaoForrageira === 'livre' ? 'Unidade (R$)' : modoComissaoForrageira === 'tambor' ? 'Hora Tambor (R$/h)' : modoComissaoForrageira === 'motor' ? 'Hora Motor (R$/h)' : (unidadeArea === 'alqueires' ? 'Área (R$/alq)' : 'Área (R$/ha)')}
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={typeof taxaComissaoForrageira === 'number' ? Number(taxaComissaoForrageira.toFixed(2)) : taxaComissaoForrageira}
                              onWheel={(e) => (e.target as HTMLInputElement).blur()}
                              onChange={(e) => setTaxaComissaoForrageira(e.target.value === '' ? '' : Number(e.target.value))}
                              onBlur={() => {
                                if (typeof taxaComissaoForrageira === 'number') {
                                  setTaxaComissaoForrageira(Number(taxaComissaoForrageira.toFixed(2)));
                                }
                              }}
                              placeholder="Ex: 25.00"
                              className="w-full px-3 py-2 bg-white border border-slate-400 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 shadow-2xs transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </div>
                        </div>

                        {/* Card Informativo de Comissão Forrageira */}
                        <div className="bg-amber-50 border border-amber-200 rounded-md p-2.5 space-y-1 text-xs text-amber-950">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold flex items-center gap-1.5">
                              <Calculator className="w-3.5 h-3.5 text-amber-600" />
                              Comissão Operador ({operadorForrageiraNome || 'Não selecionado'}):
                            </span>
                            <span className="font-mono font-bold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded text-[11px] sm:text-xs">
                              {formulaForrageiraP1 ? `${formulaForrageiraP1} (informativo)` : `${formatCurrencyBRL(comissaoForrageiraP1)} (informativo)`}
                            </span>
                          </div>

                          {segundoOperadorForrageiraNome && comissaoForrageiraP2 > 0 && (
                            <div className="flex items-center justify-between pt-1 border-t border-amber-200">
                              <span className="font-semibold">
                                Comissão 2º Operador ({segundoOperadorForrageiraNome}):
                              </span>
                              <span className="font-mono font-bold">
                                {formulaForrageiraP2 ? `${formulaForrageiraP2} (informativo)` : `${formatCurrencyBRL(comissaoForrageiraP2)} (informativo)`}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* 4. BLOCO TRATOR & COMPACTAÇÃO (BORDA AZUL) COM INDEPENDÊNCIA TOTAL */}
            {(activeTab === 'corte' || activeTab === 'colheita' || activeTab === 'trator') && (
              <TractorBlock
                machineries={machineries}
                employees={employees}
                selectedMachineryIds={selectedMachineryIds}
                quantidadeAreaGlobal={quantidadeArea}
                tratorId={tratorId}
                tratorNome={tratorNome}
                onSelectTrator={handleSelectTrator}
                onTratorNomeChange={(name) => {
                  setTratorNome(name);
                  setTratorId('');
                }}
                operadorTratorId={operadorTratorId}
                operadorTratorNome={operadorTratorNome}
                onOperadorChange={(id, name) => {
                  setOperadorTratorId(id);
                  setOperadorTratorNome(name);
                }}
                segundoOperadorTratorId={segundoOperadorTratorId}
                segundoOperadorTratorNome={segundoOperadorTratorNome}
                onSegundoOperadorChange={(id, name) => {
                  setSegundoOperadorTratorId(id);
                  setSegundoOperadorTratorNome(name);
                }}
                modoCobrancaTrator={modoCobrancaTrator}
                onModoCobrancaChange={setModoCobrancaTrator}
                qtdCobrancaTrator={qtdCobrancaTrator}
                onQtdCobrancaChange={setQtdCobrancaTrator}
                valorUnitarioTrator={valorUnitarioTrator}
                onValorUnitarioChange={setValorUnitarioTrator}
                subtotalTrator={subtotalTrator}
                modoComissaoOperador={modoComissaoOperador}
                onModoComissaoChange={setModoComissaoOperador}
                qtdBaseComissao={qtdBaseComissao}
                onQtdBaseComissaoChange={setQtdBaseComissao}
                taxaComissaoOperador={taxaComissaoOperador}
                onTaxaComissaoChange={setTaxaComissaoOperador}
                comissaoTratorP1Total={comissaoTratorP1}
                comissaoTratorP2Total={comissaoTratorP2}
                comissaoFormulaP1={formulaTratorP1}
                comissaoFormulaP2={formulaTratorP2}
              />
            )}

            {/* 5. SEÇÃO DINÂMICA DE FROTAS / CAMINHÕES (DISTRIBUIÇÃO PROPORCIONAL POR M³) */}
            {(activeTab === 'corte' || activeTab === 'colheita') && (
              <TruckFleetSection
                trucks={trucks}
                machineries={machineries}
                employees={employees}
                selectedMachineryIds={selectedMachineryIds}
                truckFleetPercentage={truckFleetPercentage}
                onPercentageChange={setTruckFleetPercentage}
                valorBaseArea={valorBaseArea}
                valorDistribuicaoFrotas={valorDistribuicaoFrotas}
                totalVolumeGeralM3={totalVolumeGeralM3}
                horasTambor={horasTambor}
                horasMotor={horasMotor}
                unidadeArea={unidadeArea}
                totalTransporteFrotasHoras={totalFrotasPorHora}
                onAddTruck={handleAddTruck}
                onRemoveTruck={handleRemoveTruck}
                onUpdateTruck={handleUpdateTruck}
              />
            )}

            {/* 6. OBSERVAÇÕES GERAIS */}
            <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-3 sm:p-3.5 shadow-sm space-y-1.5">
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider">
                Observações do Pedido / Serviço
              </label>
              <textarea
                rows={2}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Detalhes adicionais, condições do terreno, tipo de silagem ou observações financeiras..."
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-500 rounded-lg text-sm text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600 resize-none shadow-2xs transition-colors"
              />
            </div>

            {/* 7. FECHAMENTO E DRE DA OPERAÇÃO (DETALHAMENTO CIRÚRGICO) */}
            <DRESummaryBlock
              subtotalServicoMaquina={(activeTab === 'maquina' || activeTab === 'frete') ? subtotalServicoMaquina : undefined}
              descricaoServicoMaquina={
                activeTab === 'frete'
                  ? `Frete / Caminhão (${truckServiceName || 'Frota'}) • ${
                      truckBillingMode === 'km' || truckBillingMode === 'somente_km'
                        ? `${truckServiceTotalKm || 0} km`
                        : truckBillingMode === 'horas'
                        ? `${truckServiceHours || 0} h`
                        : truckBillingMode === 'cargas' || truckBillingMode === 'cargas_km'
                        ? `${truckServiceLoads || 0} cargas + ${truckServiceAdditionalKm || 0} km`
                        : `${truckServiceTrips || 0} viagens`
                    }`
                  : activeTab === 'maquina'
                  ? equipmentCategory === 'pesadas'
                    ? `Máquina Pesada (${heavyMachineType || 'Equipamento'}) • ${heavyMachineHours || 0} h`
                    : `Caminhão (${truckServiceName || 'Frota'}) • ${
                        truckBillingMode === 'horas'
                          ? `${truckServiceHours || 0} h`
                          : truckBillingMode === 'cargas_km'
                          ? `${truckServiceLoads || 0} cargas + ${truckServiceAdditionalKm || 0} km`
                          : `${truckServiceTotalKm || 0} km`
                      }`
                  : undefined
              }
              valorBaseArea={valorBaseArea}
              unidadeAreaLabel={unidadeArea === 'hectares' ? 'ha' : unidadeArea === 'alqueires' ? 'alq' : 'h'}
              quantidadeArea={quantidadeArea}
              volumeTotalFrotaM3={totalVolumeGeralM3}
              unidadeArea={unidadeArea}
              totalFrotasPorHora={totalFrotasPorHora}
              subtotalTrator={subtotalTrator}
              qtdCobrancaTrator={qtdCobrancaTrator}
              modoCobrancaTratorLabel={modoCobrancaTrator === 'horas' ? 'h' : modoCobrancaTrator === 'area_alq' ? 'alq' : 'ha'}
              subtotalForrageira={subtotalForrageira}
              totalAdicionalKm={totalAdicionalKm}
              fretePrancha={fretePrancha}
              totalPedido={totalPedido}
              fuelEntries={fuelEntries}
              onFuelEntryChange={handleFuelEntryChange}
              totalCombustivelGeral={totalCombustivelGeral}
              mealExpenses={mealExpenses}
              onAddMealExpense={handleAddMealExpense}
              onRemoveMealExpense={handleRemoveMealExpense}
              onMealExpenseChange={handleMealExpenseChange}
              totalAlimentacaoGeral={totalAlimentacaoGeral}
              operadorForrageiraNome={operadorForrageiraNome}
              comissaoForrageiraP1={comissaoForrageiraP1}
              segundoOperadorForrageiraNome={segundoOperadorForrageiraNome}
              comissaoForrageiraP2={comissaoForrageiraP2}
              operadorTratorNome={operadorTratorNome}
              comissaoTratorP1={comissaoTratorP1}
              segundoOperadorTratorNome={segundoOperadorTratorNome}
              comissaoTratorP2={comissaoTratorP2}
              brokerName={brokerName}
              brokerCommissionAmount={brokerCommissionAmount}
              trucksExpenseDetails={trucksExpenseDetails}
              totalGeralDespesas={totalGeralDespesas}
              lucroEstimado={lucroEstimado}
              margemLucroPercent={margemLucroPercent}
            />

            {/* BLOCO DE ASSINATURAS E RODAPÉ INSTITUCIONAL (EXCLUSIVO PARA IMPRESSÃO A4) */}
            <div 
              className="hidden print:block page-break-inside-avoid break-inside-avoid w-full pt-4 mt-3" 
              style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
            >
              <PrintReportFooter
                companyProfile={companyProfile}
                showSignatures={true}
                leftSignatureLabel={clientName || 'Produtor Rural (Cliente)'}
                leftSignatureRole="Declaro conferência dos serviços e área discriminada"
                rightSignatureLabel={`${companyProfile?.tradeName || 'Silagem Fácil'} - Prestador de Serviços`}
                rightSignatureRole="Conferência operacional, horímetros e frotas"
              />
            </div>

          </div>

          {/* RODAPÉ DO MODAL (AÇÕES COMPACTAS) */}
          <div 
            className="w-full max-w-full flex flex-wrap items-center justify-end gap-2 sm:gap-2.5 px-4 sm:px-5 py-2.5 sm:py-3 border-t border-gray-200 dark:border-slate-800 bg-gray-50/80 dark:bg-slate-900/90 shrink-0 print:hidden overflow-hidden"
            style={{ backgroundColor: '#0042a7' }}
          >
            {/* BOTÃO 1: Imprimir Via Cliente */}
            <button
              type="button"
              onClick={() => {
                setPrintPreviewContentType('client');
                setPrintPreviewPaperFormat('thermal_80mm');
                setShowPrintPreview(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold rounded-lg shadow-2xs transition cursor-pointer hover:border-slate-400 dark:hover:border-slate-600"
              title="Abrir prévia e impressão da Via Cliente (Cupom 80mm pré-ativado, comissões ocultas)"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
              <span>Imprimir Via Cliente</span>
            </button>

            {/* BOTÃO 2: Imprimir Via Completa */}
            <button
              type="button"
              onClick={() => {
                setPrintPreviewContentType('full');
                setPrintPreviewPaperFormat('a4');
                setShowPrintPreview(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-blue-200 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/30 hover:bg-blue-100/70 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs sm:text-sm font-semibold rounded-lg shadow-2xs transition cursor-pointer hover:border-blue-300 dark:hover:border-blue-800"
              title="Abrir prévia e impressão da Via Completa (Folha A4 pré-ativada, com DRE e comissões)"
            >
              <PrinterCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Imprimir Via Completa</span>
            </button>

            {/* BOTÃO SAIR (Substituindo Cancelar conforme solicitado) */}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg transition cursor-pointer"
              title="Fechar o formulário e voltar à tela anterior"
            >
              <LogOut className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <span>Sair</span>
            </button>

            {isSaveSuccessToast && (
              <span className="text-xs text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-1.5 bg-emerald-100 dark:bg-emerald-950/80 px-2.5 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700 animate-fade-in shadow-2xs">
                <Check className="w-4 h-4 stroke-[3] text-emerald-600 dark:text-emerald-400" />
                Alterações salvas!
              </span>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              className="inline-flex items-center gap-1.5 px-4 sm:px-5 py-1.5 sm:py-2 bg-emerald-800 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold rounded-lg shadow-sm transition cursor-pointer"
              title="Salvar alterações no pedido sem fechar a janela"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>{savedOrder || editRecord ? '✓ Salvar Alterações' : '✓ Salvar Pedido'}</span>
            </button>
          </div>

        </div>
      </div>

      {/* Modal Sobreposta de Cadastro Unificado de Cliente ("Novo Produtor Rural / Pecuarista") */}
      <ClientModal
        isOpen={isQuickClientOpen}
        onClose={() => setIsQuickClientOpen(false)}
        onSuccess={handleQuickClientCreated}
        onSave={handleQuickClientCreated}
        initialName={clientName}
        zIndexClass="z-[70]"
      />

      {/* TELA DE PRÉVIA E IMPRESSÃO (VIA CLIENTE / COMPLETA & 80MM / A4) */}
      {showPrintPreview && (
        <ServiceDocumentPreview
          initialContentType={printPreviewContentType}
          initialPaperFormat={printPreviewPaperFormat}
          companyProfile={companyProfile}
          onClose={() => setShowPrintPreview(false)}
          orderNumber={numero}
          serviceTypeTitle={getTabConfig().title}
          serviceTab={activeTab}
          clientName={clientName}
          clientPhone={clients.find((c) => c.id === clientId)?.phone || ''}
          farmName={farmName}
          location={clients.find((c) => c.id === clientId)?.address || ''}
          serviceDate={serviceDate}
          operatorName={operadorForrageiraNome}
          tractorOperatorName={operadorTratorNome}
          unidadeArea={unidadeArea}
          unidadeAreaLabel={unidadeArea === 'hectares' ? 'Hectares (ha)' : unidadeArea === 'alqueires' ? 'Alqueires (alq)' : 'Horas (h)'}
          quantidadeArea={quantidadeArea}
          valorBaseArea={valorBaseArea}
          valorHectare={valorPorHectare}
          horasTambor={horasTambor}
          horasMotor={horasMotor}
          forageHarvesterName={forrageiraNome || machineries.find((m) => m.id === forrageiraId)?.name}
          tractorName={tratorNome}
          tractorHours={typeof qtdCobrancaTrator === 'number' ? qtdCobrancaTrator : ''}
          subtotalTrator={subtotalTrator}
          qtdCobrancaTrator={qtdCobrancaTrator}
          modoCobrancaTratorLabel={modoCobrancaTrator === 'horas' ? 'Horas (h)' : modoCobrancaTrator === 'area_alq' ? 'Alqueires (alq)' : 'Hectares (ha)'}
          trucks={trucks}
          totalAdicionalKm={totalAdicionalKm}
          totalFrotasPorHora={totalFrotasPorHora}
          fretePrancha={fretePrancha}
          totalPedido={totalPedido}
          fuelEntries={fuelEntries}
          totalCombustivelGeral={totalCombustivelGeral}
          mealExpenses={mealExpenses}
          totalAlimentacaoGeral={totalAlimentacaoGeral}
          operadorForrageiraNome={operadorForrageiraNome}
          comissaoForrageiraP1={comissaoForrageiraP1}
          segundoOperadorForrageiraNome={segundoOperadorForrageiraNome}
          comissaoForrageiraP2={comissaoForrageiraP2}
          operadorTratorNome={operadorTratorNome}
          comissaoTratorP1={comissaoTratorP1}
          segundoOperadorTratorNome={segundoOperadorTratorNome}
          comissaoTratorP2={comissaoTratorP2}
          brokerName={brokerName}
          brokerCommissionAmount={brokerCommissionAmount}
          trucksExpenseDetails={trucksExpenseDetails}
          totalGeralDespesas={totalGeralDespesas}
          lucroEstimado={lucroEstimado}
          margemLucroPercent={margemLucroPercent}
          observacoes={observacoes}
        />
      )}
    </>
  );
};
