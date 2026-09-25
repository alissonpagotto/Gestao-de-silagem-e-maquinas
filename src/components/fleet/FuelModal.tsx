import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Fuel, Save, Calculator, Gauge, Clock, History, AlertTriangle, Sparkles, Droplets, Building2, CreditCard, Wallet, Calendar, ChevronDown, Search, Check, Warehouse } from 'lucide-react';
import { FuelLog, Machinery, Employee, Supplier, BankAccount, FuelOrigin, TanqueCombustivel } from '../../types';
import { FuelTankVisualizer } from './FuelTankVisualizer';
import { TanqueIndustrialVisualizer } from './TanqueIndustrialVisualizer';
import { FuelCalculationResult } from '../../lib/fuelCalculation';
import { calculateVehicleConsumptionMetrics } from '../../lib/fleetMetrics';
import { fetchGestaoFrotas, fetchCloudFuelLogs, fetchTanquesCombustivel, subtrairCombustivelTanque } from '../../lib/supabaseService';
import { getStoredSuppliers, getStoredBankAccounts, getStoredTanquesCombustivel, calculateDefaultDueDate, formatCurrencyBRL } from '../../lib/storage';

interface FuelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (fuelLog: FuelLog, createExpense: boolean) => void;
  editingLog: FuelLog | null;
  machineries: Machinery[];
  employees: Employee[];
  fuelLogs?: FuelLog[];
  initialMachineryId?: string;
  suppliers?: Supplier[];
  bankAccounts?: BankAccount[];
}

/**
 * FuelModal: Modal de Abastecimento com arquitetura 100% HTTP assíncrona (PostgREST)
 * - ZERO conexões de WebSocket / Realtime (.subscribe / .on('postgres_changes') desativados)
 * - Carregamento resiliente com async/await e try/catch direto na tabela 'gestao_frotas'
 * - Inputs 100% desbloqueados para digitação manual imediata (sem travas por isLoading ou conexões)
 */
export const FuelModal: React.FC<FuelModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingLog,
  machineries: propMachineries,
  employees,
  fuelLogs: propFuelLogs = [],
  initialMachineryId,
  suppliers: propSuppliers = [],
  bankAccounts: propBankAccounts = [],
}) => {
  // Estado local para veículos e abastecimentos carregados via HTTP padrão (REST)
  const [dbMachineries, setDbMachineries] = useState<Machinery[]>([]);
  const [dbFuelLogs, setDbFuelLogs] = useState<FuelLog[]>([]);

  // Tanques de Combustível da Fazenda carregados da tabela 'tanques_combustivel'
  const [tanques, setTanques] = useState<TanqueCombustivel[]>(() => getStoredTanquesCombustivel());
  const [selectedTanqueId, setSelectedTanqueId] = useState<string>(() => {
    const list = getStoredTanquesCombustivel();
    return list[0]?.id || 'tanque_diesel_s10';
  });

  // Estado para o dropdown customizado de veículos com busca
  const [isVehicleDropdownOpen, setIsVehicleDropdownOpen] = useState(false);
  const [vehicleSearchText, setVehicleSearchText] = useState('');
  const vehicleDropdownRef = useRef<HTMLDivElement>(null);

  // Listas de Fornecedores e Contas Bancárias com fallback para o storage local
  const availableSuppliers = useMemo(() => {
    if (propSuppliers && propSuppliers.length > 0) return propSuppliers;
    return getStoredSuppliers();
  }, [propSuppliers]);

  const availableBankAccounts = useMemo(() => {
    if (propBankAccounts && propBankAccounts.length > 0) return propBankAccounts;
    return getStoredBankAccounts();
  }, [propBankAccounts]);

  // Lista unificada de veículos (prioriza dados atualizados do banco mantendo props locais de fallback)
  // Remove permanentemente o prefixo fixo 'AGRÍCOLA' que aparece na frente das máquinas
  const availableMachineries = useMemo(() => {
    let list: Machinery[] = propMachineries;
    if (dbMachineries.length > 0) {
      // Mescla garantindo que todos os veículos apareçam
      const map = new Map<string, Machinery>();
      propMachineries.forEach(m => map.set(m.id, m));
      dbMachineries.forEach(m => map.set(m.id, { ...(map.get(m.id) || {}), ...m }));
      list = Array.from(map.values());
    }
    return list.map((v) => {
      const cleanRawNome = (v.nome || v.name || v.model || 'Veículo').replace(/^(AGR[IÍ]COLA\s*[-–—:]*\s*)/i, '').trim();
      const cleanRawModel = (v.model || v.modelo || '').replace(/^(AGR[IÍ]COLA\s*[-–—:]*\s*)/i, '').trim();
      const cleanBrand = (v.brand || '').replace(/^(AGR[IÍ]COLA\s*[-–—:]*\s*)/i, '').trim();
      const plate = v.licensePlateOrSerial || (v as any).placa || (v as any).placa_ou_serie || '';
      return {
        ...v,
        name: cleanRawNome,
        nome: cleanRawNome,
        model: cleanRawModel,
        modelo: cleanRawModel,
        brand: cleanBrand,
        licensePlateOrSerial: plate,
      };
    });
  }, [propMachineries, dbMachineries]);

  const activeFuelLogs = useMemo(() => {
    if (dbFuelLogs.length > 0) {
      return [...dbFuelLogs, ...propFuelLogs.filter(p => !dbFuelLogs.some(d => d.id === p.id))];
    }
    return propFuelLogs;
  }, [propFuelLogs, dbFuelLogs]);

  // Formulário State (totalmente independente de loading flags)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [machineryId, setMachineryId] = useState('');
  
  // 1. ORIGEM DO COMBUSTÍVEL & INTEGRAÇÃO FINANCEIRA
  const [fuelOrigin, setFuelOrigin] = useState<FuelOrigin>('Tanque Interno (Fazenda)');
  const [supplierStation, setSupplierStation] = useState('Tanque da Fazenda');
  const [dueDate, setDueDate] = useState(() => calculateDefaultDueDate(new Date().toISOString().split('T')[0]));
  const [paymentMethod, setPaymentMethod] = useState<'Pix' | 'Cartão' | 'Dinheiro' | string>('Pix');
  const [bankAccountId, setBankAccountId] = useState('');

  const [fuelType, setFuelType] = useState<FuelLog['fuelType']>('Diesel S10');
  const [liters, setLiters] = useState('');
  const [pricePerLiter, setPricePerLiter] = useState('5.85');
  const [totalAmount, setTotalAmount] = useState('');
  
  // Medidores: KM & Horímetro (100% Desbloqueados para Edição Manual)
  const [currentKm, setCurrentKm] = useState('');
  const [previousKm, setPreviousKm] = useState('');
  const [currentHourMeter, setCurrentHourMeter] = useState('');
  const [previousHourMeter, setPreviousHourMeter] = useState('');

  const [driverOrOperator, setDriverOrOperator] = useState('');
  const [notes, setNotes] = useState('');
  const [createExpense, setCreateExpense] = useState(true);
  const [latestCalculation, setLatestCalculation] = useState<FuelCalculationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState('');

  // 1. CARREGAMENTO ASSÍNCRONO TRADICIONAL VIA HTTP (ASYNC/AWAIT com try/catch)
  // Sem WebSocket, sem conexões persistentes - apenas requisição HTTP pontual e estável
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    const loadGestaoFrotasHttp = async () => {
      try {
        const vehicles = await fetchGestaoFrotas();
        if (vehicles && vehicles.length > 0 && isMounted) {
          setDbMachineries(vehicles);
        }
      } catch (err) {
        console.warn('Busca HTTP gestao_frotas com fallback local:', err);
      }

      try {
        const cloudLogs = await fetchCloudFuelLogs();
        if (cloudLogs && Array.isArray(cloudLogs) && cloudLogs.length > 0 && isMounted) {
          setDbFuelLogs(cloudLogs);
        }
      } catch {
        // Fallback silencioso mantendo histórico de abastecimentos das props
      }

      try {
        const fetchedTanques = await fetchTanquesCombustivel();
        if (fetchedTanques && fetchedTanques.length > 0 && isMounted) {
          setTanques(fetchedTanques);
          setSelectedTanqueId(prev => {
            if (prev && fetchedTanques.some(t => t.id === prev)) return prev;
            return fetchedTanques[0].id;
          });
        }
      } catch (err) {
        console.warn('Busca HTTP tanques_combustivel com fallback local:', err);
      }
    };

    loadGestaoFrotasHttp();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Tanque Selecionado
  const selectedTanque = useMemo(() => {
    return tanques.find(t => t.id === selectedTanqueId) || tanques[0] || null;
  }, [tanques, selectedTanqueId]);

  // Filtro de busca para dropdown de veículos
  const filteredVehicles = useMemo(() => {
    if (!vehicleSearchText.trim()) return availableMachineries;
    const term = vehicleSearchText.toLowerCase();
    return availableMachineries.filter(v => 
      (v.nome || '').toLowerCase().includes(term) ||
      (v.model || '').toLowerCase().includes(term) ||
      (v.brand || '').toLowerCase().includes(term) ||
      (v.licensePlateOrSerial || '').toLowerCase().includes(term) ||
      (v.operatorOrDriver || '').toLowerCase().includes(term)
    );
  }, [availableMachineries, vehicleSearchText]);

  // Fecha o dropdown de veículo ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (vehicleDropdownRef.current && !vehicleDropdownRef.current.contains(e.target as Node)) {
        setIsVehicleDropdownOpen(false);
      }
    };
    if (isVehicleDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVehicleDropdownOpen]);

  // Veículo Selecionado
  const selectedMachinery = useMemo(() => {
    return availableMachineries.find(m => m.id === machineryId) || null;
  }, [availableMachineries, machineryId]);

  // Histórico de métricas do veículo
  const vehicleMetrics = useMemo(() => {
    if (!machineryId || !activeFuelLogs || activeFuelLogs.length === 0) return null;
    return calculateVehicleConsumptionMetrics(machineryId, activeFuelLogs);
  }, [machineryId, activeFuelLogs]);

  const historicalAvgLitersPerHour = useMemo(() => {
    return selectedMachinery?.averageConsumptionLitersPerHour ?? vehicleMetrics?.avgLitersPerHour ?? null;
  }, [selectedMachinery, vehicleMetrics]);

  const historicalAvgKmPerLiter = useMemo(() => {
    return selectedMachinery?.averageConsumptionKmPerLiter ?? vehicleMetrics?.avgKmPerLiter ?? null;
  }, [selectedMachinery, vehicleMetrics]);

  // 1. VALIDAÇÃO DE REGISTRO INICIAL (Primeiro Abastecimento de Veículo / Máquina)
  // Quando um veículo é novo no sistema, KM Anterior ou Horas Anterior vêm nulos, vazios ou zero.
  const isFirstRecordHour = useMemo(() => {
    const val = parseFloat(String(previousHourMeter).trim().replace(',', '.'));
    return !previousHourMeter || isNaN(val) || val === 0;
  }, [previousHourMeter]);

  const isFirstRecordKm = useMemo(() => {
    const val = parseFloat(String(previousKm).trim().replace(',', '.'));
    return !previousKm || isNaN(val) || val === 0;
  }, [previousKm]);

  // Identifica se é primeiro abastecimento no sistema para este lançamento
  const isFirstRecord = useMemo(() => {
    if (editingLog) {
      const pKm = editingLog.previousKm ?? (editingLog.previousHourMeterOrKm && editingLog.previousHourMeterOrKm > 50000 ? editingLog.previousHourMeterOrKm : 0);
      const pHour = editingLog.previousHourMeter ?? (editingLog.previousHourMeterOrKm && editingLog.previousHourMeterOrKm <= 50000 ? editingLog.previousHourMeterOrKm : 0);
      return (!pKm || pKm === 0) && (!pHour || pHour === 0);
    }
    return isFirstRecordHour && isFirstRecordKm;
  }, [editingLog, isFirstRecordHour, isFirstRecordKm]);

  // Nível Atual vindo do banco de dados (saldo registrado para o veículo antes deste abastecimento)
  const dbTankLevel = useMemo(() => {
    const tankCap = Number(
      (selectedMachinery as any)?.tank_capacity ?? 
      (selectedMachinery as any)?.tankCapacity ?? 
      selectedMachinery?.fuelCapacityLiters ?? 0
    );

    if (isFirstRecord) return 0;

    // 1. Se estiver editando um registro existente, pega o saldo antes desse abastecimento
    if (editingLog) {
      const prevL = (editingLog as any).previousFuelLiters ?? (editingLog as any).nivel_anterior;
      if (prevL !== undefined && prevL !== null && !isNaN(Number(prevL)) && Number(prevL) >= 0) {
        return Number(prevL);
      }
    }

    // 2. Saldo explícito do veículo registrado no banco de dados
    const machLiters = (selectedMachinery as any)?.currentFuelLiters ?? (selectedMachinery as any)?.current_fuel_liters;
    if (machLiters !== undefined && machLiters !== null && !isNaN(Number(machLiters)) && Number(machLiters) >= 0) {
      return Number(machLiters);
    }

    // 3. Último registro de abastecimento no histórico deste veículo
    const prevLogs = (activeFuelLogs || [])
      .filter(l => l.machineryId === machineryId && (!editingLog || l.id !== editingLog.id))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || String(b.id).localeCompare(String(a.id)));
    const lastLog = prevLogs[0];
    if (lastLog) {
      const lFuelLiters = (lastLog as any).currentFuelLiters ?? (lastLog as any).current_fuel_liters ?? (lastLog as any).novo_nivel;
      if (lFuelLiters !== undefined && lFuelLiters !== null && !isNaN(Number(lFuelLiters)) && Number(lFuelLiters) >= 0) {
        return Number(lFuelLiters);
      }
    }

    // 4. Porcentagem de combustível cadastrada no veículo
    if (selectedMachinery?.currentFuelPercentage !== undefined && selectedMachinery?.currentFuelPercentage !== null && tankCap > 0) {
      const pct = Number(selectedMachinery.currentFuelPercentage);
      if (!isNaN(pct)) {
        return parseFloat(((pct / 100) * tankCap).toFixed(1));
      }
    }

    return tankCap > 0 ? tankCap : 0;
  }, [selectedMachinery, machineryId, activeFuelLogs, editingLog, isFirstRecord]);

  // Alerta de excesso de capacidade teórica (apenas visual, sem travar o botão Salvar)
  const isOverCapacity = useMemo(() => {
    const capacidadeTanque = Number(
      (selectedMachinery as any)?.tank_capacity ?? 
      (selectedMachinery as any)?.tankCapacity ?? 
      selectedMachinery?.fuelCapacityLiters ?? 0
    );
    const litrosAbastecidos = parseFloat(String(liters).trim().replace(',', '.')) || 0;

    if (capacidadeTanque <= 0) return false;

    if (isFirstRecord) {
      return litrosAbastecidos > capacidadeTanque;
    }

    if (latestCalculation?.isOverflowing) return true;
    return (dbTankLevel + litrosAbastecidos) > capacidadeTanque;
  }, [latestCalculation, selectedMachinery, liters, isFirstRecord, dbTankLevel]);

  // Inicialização síncrona imediata ao abrir o modal (inputs livres desde o milissegundo 0)
  useEffect(() => {
    if (!isOpen) return;

    setValidationError('');

    if (editingLog) {
      setDate(editingLog.date);
      setMachineryId(editingLog.machineryId);
      setFuelType(editingLog.fuelType);
      setLiters(String(editingLog.liters || ''));
      setPricePerLiter(String(editingLog.pricePerLiter || '5.85'));
      setTotalAmount(String(editingLog.totalAmount || ''));
      
      const inferredOrigin: FuelOrigin = editingLog.fuelOrigin || (
        editingLog.supplierStation?.toLowerCase().includes('viagem') 
          ? 'Posto de Viagem (Pago na Hora)' 
          : (editingLog.supplierStation && !editingLog.supplierStation.toLowerCase().includes('tanque') && !editingLog.supplierStation.toLowerCase().includes('fazenda') 
            ? 'Posto Conveniado (Faturado)' 
            : 'Tanque Interno (Fazenda)')
      );
      setFuelOrigin(inferredOrigin);
      setSupplierStation(editingLog.supplierStation || (inferredOrigin === 'Tanque Interno (Fazenda)' ? 'Tanque da Fazenda' : ''));
      const rawPay = (editingLog.paymentMethod || '').toLowerCase();
      const normPay = rawPay.includes('cart') ? 'Cartão' : (rawPay.includes('dinh') ? 'Dinheiro' : 'Pix');
      setPaymentMethod(normPay);
      setBankAccountId(editingLog.bankAccountId || (availableBankAccounts[0]?.id || ''));
      setDueDate(editingLog.dueDate || calculateDefaultDueDate(editingLog.date));

      setCurrentKm(editingLog.currentKm !== undefined && editingLog.currentKm !== null ? String(editingLog.currentKm) : (editingLog.currentHourMeterOrKm && editingLog.currentHourMeterOrKm > 50000 ? String(editingLog.currentHourMeterOrKm) : ''));
      setPreviousKm(editingLog.previousKm !== undefined && editingLog.previousKm !== null ? String(editingLog.previousKm) : (editingLog.previousHourMeterOrKm && editingLog.previousHourMeterOrKm > 50000 ? String(editingLog.previousHourMeterOrKm) : ''));
      
      setCurrentHourMeter(editingLog.currentHourMeter !== undefined && editingLog.currentHourMeter !== null ? String(editingLog.currentHourMeter) : (editingLog.currentHourMeterOrKm && editingLog.currentHourMeterOrKm <= 50000 ? String(editingLog.currentHourMeterOrKm) : ''));
      setPreviousHourMeter(editingLog.previousHourMeter !== undefined && editingLog.previousHourMeter !== null ? String(editingLog.previousHourMeter) : (editingLog.previousHourMeterOrKm && editingLog.previousHourMeterOrKm <= 50000 ? String(editingLog.previousHourMeterOrKm) : ''));
      
      setDriverOrOperator(editingLog.driverOrOperator || '');
      setNotes(editingLog.notes || '');
      setCreateExpense(false);
    } else {
      // Novo Registro de Abastecimento
      setDate(new Date().toISOString().split('T')[0]);
      setFuelOrigin('Tanque Interno (Fazenda)');
      setSupplierStation('Tanque da Fazenda');
      setPaymentMethod('Pix');
      setBankAccountId(availableBankAccounts[0]?.id || '');
      setDueDate(calculateDefaultDueDate(new Date().toISOString().split('T')[0]));
      setFuelType('Diesel S10');
      setLiters('');
      setPricePerLiter('5.85');
      setTotalAmount('');
      setCurrentKm('');
      setCurrentHourMeter('');
      setNotes('');
      setCreateExpense(true);

      const cleanInitialId = typeof initialMachineryId === 'string' ? initialMachineryId : '';
      const targetId = cleanInitialId || (availableMachineries.length > 0 ? availableMachineries[0].id : '');
      setMachineryId(typeof targetId === 'string' ? targetId : '');

      const mach = availableMachineries.find(m => m.id === targetId);
      if (mach) {
        const prevLogs = (activeFuelLogs || [])
          .filter(l => l.machineryId === targetId)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const lastLog = prevLogs[0];

        // 1. KM ANTERIOR: Estritamente de km_atual do último registro ou currentKm do cadastro
        let finalKm = '';
        if (lastLog) {
          const lKm = (lastLog as any).km_atual ?? (lastLog as any).kmAtual ?? lastLog.currentKm;
          if (lKm !== undefined && lKm !== null && String(lKm).trim() !== '' && !isNaN(Number(lKm)) && Number(lKm) > 0) {
            finalKm = String(lKm);
          }
        }
        if (!finalKm) {
          const machKm = (mach as any).km_atual ?? (mach as any).kmAtual ?? (mach as any).km_inicial ?? (mach as any).initialKm ?? mach.currentKm;
          if (machKm !== undefined && machKm !== null && String(machKm).trim() !== '' && !isNaN(Number(machKm)) && Number(machKm) > 0) {
            finalKm = String(machKm);
          }
        }

        // 2. HORAS ANTERIOR: Estritamente de horas_atual / horimetro do último registro ou hourMeter do cadastro
        let finalHours = '';
        if (lastLog) {
          const lHours = (lastLog as any).horas_atual ?? (lastLog as any).horasAtual ?? (lastLog as any).horimetro_atual ?? (lastLog as any).horimetroAtual ?? lastLog.currentHourMeter;
          if (lHours !== undefined && lHours !== null && String(lHours).trim() !== '' && !isNaN(Number(lHours)) && Number(lHours) > 0) {
            finalHours = String(lHours);
          }
        }
        if (!finalHours) {
          const machHours = (mach as any).horas_atual ?? (mach as any).horasAtual ?? (mach as any).horimetro_atual ?? (mach as any).horimetroAtual ?? (mach as any).horimetro_inicial ?? (mach as any).initialHourMeter ?? mach.hourMeter;
          if (machHours !== undefined && machHours !== null && String(machHours).trim() !== '' && !isNaN(Number(machHours)) && Number(machHours) > 0) {
            finalHours = String(machHours);
          }
        }

        setPreviousKm(finalKm);
        setPreviousHourMeter(finalHours);

        if (mach.operatorOrDriver) {
          setDriverOrOperator(mach.operatorOrDriver.split(',')[0].trim());
        } else {
          setDriverOrOperator('');
        }
      } else {
        setPreviousKm('');
        setPreviousHourMeter('');
        setDriverOrOperator('');
      }
    }
  }, [isOpen, editingLog]);

  // Seleção de Veículo pelo Usuário - Manipulação síncrona direta em memória
  const handleSelecaoVeiculo = (id: string) => {
    setMachineryId(id);
    const mach = availableMachineries.find((m) => m.id === id);

    if (!mach) {
      setPreviousKm('');
      setPreviousHourMeter('');
      setCurrentKm('');
      setCurrentHourMeter('');
      setDriverOrOperator('');
      return;
    }

    const prevLogs = (activeFuelLogs || [])
      .filter((l) => l.machineryId === id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const lastLog = prevLogs[0];

    // 1. KM ANTERIOR: Estritamente de km_atual
    let prevKmFinal = '';
    if (lastLog) {
      const lKm = (lastLog as any).km_atual ?? (lastLog as any).kmAtual ?? lastLog.currentKm;
      if (lKm !== undefined && lKm !== null && String(lKm).trim() !== '' && !isNaN(Number(lKm)) && Number(lKm) > 0) {
        prevKmFinal = String(lKm);
      }
    }
    if (!prevKmFinal) {
      const machKm = (mach as any).km_atual ?? (mach as any).kmAtual ?? (mach as any).km_inicial ?? (mach as any).initialKm ?? mach.currentKm;
      if (machKm !== undefined && machKm !== null && String(machKm).trim() !== '' && !isNaN(Number(machKm)) && Number(machKm) > 0) {
        prevKmFinal = String(machKm);
      }
    }

    // 2. HORAS ANTERIOR: Estritamente de horas_atual
    let prevHourFinal = '';
    if (lastLog) {
      const lHours = (lastLog as any).horas_atual ?? (lastLog as any).horasAtual ?? (lastLog as any).horimetro_atual ?? (lastLog as any).horimetroAtual ?? lastLog.currentHourMeter;
      if (lHours !== undefined && lHours !== null && String(lHours).trim() !== '' && !isNaN(Number(lHours)) && Number(lHours) > 0) {
        prevHourFinal = String(lHours);
      }
    }
    if (!prevHourFinal) {
      const machHours = (mach as any).horas_atual ?? (mach as any).horasAtual ?? (mach as any).horimetro_atual ?? (mach as any).horimetroAtual ?? (mach as any).horimetro_inicial ?? (mach as any).initialHourMeter ?? mach.hourMeter;
      if (machHours !== undefined && machHours !== null && String(machHours).trim() !== '' && !isNaN(Number(machHours)) && Number(machHours) > 0) {
        prevHourFinal = String(machHours);
      }
    }

    // Atualização imediata e síncrona dos estados
    setPreviousKm(prevKmFinal);
    setPreviousHourMeter(prevHourFinal);
    setCurrentKm('');
    setCurrentHourMeter('');

    if (mach.operatorOrDriver) {
      setDriverOrOperator(mach.operatorOrDriver.split(',')[0].trim());
    } else {
      setDriverOrOperator('');
    }
  };

  const handleMachineryChange = handleSelecaoVeiculo;

  const calculateTotal = (litersVal: string, priceVal: string) => {
    const l = parseFloat(String(litersVal).trim().replace(',', '.'));
    const p = parseFloat(String(priceVal).trim().replace(',', '.'));
    if (!isNaN(l) && !isNaN(p) && l > 0 && p > 0) {
      setTotalAmount((l * p).toFixed(2));
    } else {
      setTotalAmount('');
    }
  };

  const handleLitersChange = (val: string) => {
    setLiters(val);
    calculateTotal(val, pricePerLiter);
  };

  const handlePriceChange = (val: string) => {
    setPricePerLiter(val);
    calculateTotal(liters, val);
  };

  // 2. CÁLCULO DE MÉDIAS EM TEMPO REAL
  // Se isFirstRecord for verdadeiro, o sistema NÃO tenta calcular a diferença nem subtrair consumo do nível do tanque.
  // O consumo e médias são definidos temporariamente como nulos / 0 para este lançamento.
  const calculatedMetrics = useMemo(() => {
    if (isFirstRecord) {
      return { kmPerLiter: null, litersPerHour: null };
    }

    const l = parseFloat(String(liters).trim().replace(',', '.')) || 0;
    
    // Média KM: km/L
    let kmPerLiter: number | null = null;
    if (!isFirstRecordKm) {
      const cKm = parseFloat(String(currentKm).trim().replace(',', '.'));
      const pKm = parseFloat(String(previousKm).trim().replace(',', '.'));
      if (!isNaN(cKm) && !isNaN(pKm) && cKm > pKm && l > 0) {
        kmPerLiter = parseFloat(((cKm - pKm) / l).toFixed(2));
      }
    }

    // Média Horas: L/h
    let litersPerHour: number | null = null;
    if (!isFirstRecordHour) {
      const cHour = parseFloat(String(currentHourMeter).trim().replace(',', '.'));
      const pHour = parseFloat(String(previousHourMeter).trim().replace(',', '.'));
      if (!isNaN(cHour) && !isNaN(pHour) && cHour > pHour && l > 0) {
        litersPerHour = parseFloat((l / (cHour - pHour)).toFixed(2));
      }
    }

    return { kmPerLiter, litersPerHour };
  }, [isFirstRecord, isFirstRecordKm, isFirstRecordHour, liters, currentKm, previousKm, currentHourMeter, previousHourMeter]);

  const displayLitersPerHour = isFirstRecord || isFirstRecordHour ? null : calculatedMetrics.litersPerHour;
  const displayKmPerLiter = isFirstRecord || isFirstRecordKm ? null : calculatedMetrics.kmPerLiter;

  const handleSubmit = (e?: React.FormEvent | React.MouseEvent) => {
    if (e && 'preventDefault' in e) {
      e.preventDefault();
      e.stopPropagation();
    }

    setValidationError('');
    
    const l = parseFloat(String(liters).trim().replace(',', '.'));
    const p = parseFloat(String(pricePerLiter).trim().replace(',', '.'));
    const t = parseFloat(String(totalAmount).trim().replace(',', '.')) || (l * (isNaN(p) ? 0 : p));
    
    const currK = parseFloat(String(currentKm).trim().replace(',', '.'));
    const prevK = parseFloat(String(previousKm).trim().replace(',', '.'));
    const currH = parseFloat(String(currentHourMeter).trim().replace(',', '.'));
    const prevH = parseFloat(String(previousHourMeter).trim().replace(',', '.'));

    const effectiveMachineryId = machineryId || (availableMachineries.length > 0 ? availableMachineries[0].id : '');

    if (!effectiveMachineryId) {
      setValidationError("Por favor, selecione um veículo / máquina.");
      return;
    }

    if (!fuelOrigin) {
      setValidationError("Campo obrigatório: selecione a Origem do Combustível.");
      return;
    }

    if (fuelOrigin === 'Posto Conveniado (Faturado)' && !supplierStation.trim()) {
      setValidationError("Para Posto Conveniado (Faturado), selecione ou informe o Fornecedor/Posto.");
      return;
    }

    if (fuelOrigin === 'Posto de Viagem (Pago na Hora)') {
      if (!paymentMethod) {
        setValidationError("Para Posto de Viagem (Pago na Hora), selecione a Forma de Pagamento.");
        return;
      }
      if (!bankAccountId && availableBankAccounts.length > 0) {
        setValidationError("Para Posto de Viagem (Pago na Hora), selecione a Conta Bancária/Caixa.");
        return;
      }
    }

    if (isNaN(l) || l <= 0) {
      setValidationError("Por favor, informe a quantidade de litros abastecidos.");
      const inputLiters = document.getElementById('input-litros-abastecidos') as HTMLInputElement;
      if (inputLiters) inputLiters.focus();
      return;
    }

    const currentSelected = availableMachineries.find((m) => m.id === effectiveMachineryId) || selectedMachinery;

    const machName = currentSelected 
      ? (currentSelected.licensePlateOrSerial ? `[${currentSelected.licensePlateOrSerial}] - ${currentSelected.model || currentSelected.name}` : currentSelected.name)
      : 'Veículo';

    const selectedAccount = availableBankAccounts.find(b => b.id === bankAccountId);
    const selectedSupplier = availableSuppliers.find(s => s.id === supplierStation || s.name === supplierStation);

    const log: FuelLog = {
      id: editingLog ? editingLog.id : `fuel_${Date.now()}`,
      date: date || new Date().toISOString().split('T')[0],
      machineryId: effectiveMachineryId,
      machineryPlateOrName: machName,
      fuelType,
      liters: l,
      pricePerLiter: !isNaN(p) && p > 0 ? p : 0,
      totalAmount: !isNaN(t) && t > 0 ? t : (l * (!isNaN(p) && p > 0 ? p : 0)),
      currentHourMeterOrKm: !isNaN(currH) && currH > 0 ? currH : (!isNaN(currK) && currK > 0 ? currK : 0),
      previousHourMeterOrKm: isFirstRecord ? 0 : (!isNaN(prevH) && prevH > 0 ? prevH : (!isNaN(prevK) && prevK > 0 ? prevK : undefined)),
      currentKm: !isNaN(currK) && currK > 0 ? currK : undefined,
      previousKm: isFirstRecord || isFirstRecordKm ? undefined : (!isNaN(prevK) && prevK > 0 ? prevK : undefined),
      currentHourMeter: !isNaN(currH) && currH > 0 ? currH : undefined,
      previousHourMeter: isFirstRecord || isFirstRecordHour ? undefined : (!isNaN(prevH) && prevH > 0 ? prevH : undefined),
      averageCalculated: isFirstRecord ? undefined : (calculatedMetrics.kmPerLiter || calculatedMetrics.litersPerHour || undefined),
      averageKmPerLiter: isFirstRecord || isFirstRecordKm ? undefined : (calculatedMetrics.kmPerLiter || undefined),
      averageLitersPerHour: isFirstRecord || isFirstRecordHour ? undefined : (calculatedMetrics.litersPerHour || undefined),
      currentFuelPercentage: latestCalculation ? Math.round(latestCalculation.novoNivelPorcentagem) : undefined,
      currentFuelLiters: latestCalculation ? latestCalculation.novoNivel : undefined,
      fuelConsumedLiters: isFirstRecord ? 0 : (latestCalculation ? latestCalculation.combustivelGasto : 0),
      tankCapacity: latestCalculation ? latestCalculation.capacidadeTanque : undefined,
      driverOrOperator: driverOrOperator.trim(),
      fuelOrigin,
      tanque_id: fuelOrigin === 'Tanque Interno (Fazenda)' ? (selectedTanqueId || tanques[0]?.id) : undefined,
      tanqueId: fuelOrigin === 'Tanque Interno (Fazenda)' ? (selectedTanqueId || tanques[0]?.id) : undefined,
      tanqueNome: fuelOrigin === 'Tanque Interno (Fazenda)' ? (selectedTanque?.nome || 'Tanque da Fazenda') : undefined,
      supplierStation: fuelOrigin === 'Tanque Interno (Fazenda)'
        ? (selectedTanque?.nome || 'Tanque da Fazenda')
        : (supplierStation.trim() || (fuelOrigin === 'Posto Conveniado (Faturado)' ? 'Posto Conveniado' : 'Posto de Viagem')),
      supplierId: selectedSupplier ? selectedSupplier.id : undefined,
      paymentMethod: fuelOrigin === 'Posto de Viagem (Pago na Hora)'
        ? paymentMethod
        : (fuelOrigin === 'Posto Conveniado (Faturado)' ? 'Boleto' : undefined),
      bankAccountId: fuelOrigin === 'Posto de Viagem (Pago na Hora)' ? bankAccountId : undefined,
      bankAccountName: fuelOrigin === 'Posto de Viagem (Pago na Hora)' ? selectedAccount?.name : undefined,
      dueDate: fuelOrigin === 'Posto Conveniado (Faturado)' ? (dueDate || calculateDefaultDueDate(date)) : date,
      financialStatus: fuelOrigin === 'Tanque Interno (Fazenda)'
        ? 'compensado_estoque'
        : (fuelOrigin === 'Posto Conveniado (Faturado)' ? 'pendente' : 'pago'),
      notes: notes.trim() || undefined,
      expenseId: editingLog?.expenseId,
      createdAt: editingLog?.createdAt || new Date().toISOString(),
    };

    (log as any).km_atual = !isNaN(currK) && currK > 0 ? currK : undefined;
    (log as any).horas_atual = !isNaN(currH) && currH > 0 ? currH : undefined;

    // Se for abastecido do Tanque Interno da Fazenda, subtrai a quantidade de litros diretamente da tabela 'tanques_combustivel'
    if (fuelOrigin === 'Tanque Interno (Fazenda)' && (selectedTanqueId || tanques[0]?.id) && l > 0) {
      const tId = selectedTanqueId || tanques[0]?.id;
      subtrairCombustivelTanque(tId, l).catch(err => {
        console.warn('Erro ao subtrair litros de tanques_combustivel:', err);
      });
    }

    onSave(log, createExpense && !editingLog);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-3 bg-zinc-950/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-stone-900 rounded-2xl max-w-5xl w-full shadow-2xl border border-zinc-300 dark:border-stone-700 overflow-hidden flex flex-col max-h-[96vh]">
        
        {/* Cabeçalho Compacto */}
        <div className="px-4 py-2.5 bg-zinc-800 text-white flex items-center justify-between border-b border-zinc-700 shrink-0">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-zinc-700 flex items-center justify-center text-white shadow-xs">
              <Fuel className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white font-['Outfit'] leading-tight">
                {editingLog ? 'Editar Abastecimento' : 'Novo Registro de Abastecimento'}
              </h3>
              <p className="text-[11px] text-zinc-300 leading-none">
                Controle de combustível com cálculo de consumo em tempo real
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onClose()}
            className="p-1 rounded-lg hover:bg-zinc-700 text-zinc-300 hover:text-white transition cursor-pointer pointer-events-auto"
          >
            <X className="w-4 h-4 text-white pointer-events-none" />
          </button>
        </div>

        {/* Corpo do Modal - Padding Reduzido para p-3.5 conforme solicitado */}
        <div className="overflow-y-auto flex-1 bg-white dark:bg-stone-900">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 p-3.5 items-start">
            
            {/* Formulário à Esquerda - Espaçamento space-y-2 */}
            <div className="lg:col-span-7">
              <form id="fuel-form" noValidate onSubmit={handleSubmit} className="space-y-2">
                
                {/* 1. Veículo / Máquina e Data do Abastecimento */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="relative" ref={vehicleDropdownRef}>
                    <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-0.5">
                      Veículo / Máquina <span className="text-rose-500">*</span>
                    </label>

                    {/* Botão Seletor Customizado do Veículo */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsVehicleDropdownOpen(prev => !prev);
                        setVehicleSearchText('');
                      }}
                      className="w-full text-left px-2.5 py-1.5 border border-stone-300 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs flex items-center justify-between transition cursor-pointer"
                    >
                      <div className="flex-1 min-w-0 pr-1.5">
                        {selectedMachinery ? (
                          <div>
                            {/* Nome da Máquina + PLACA em destaque */}
                            <div className="flex items-center space-x-1.5 flex-wrap">
                              <span className="font-bold text-xs sm:text-sm text-stone-900 dark:text-stone-100 truncate">
                                {selectedMachinery.nome}
                              </span>
                              {selectedMachinery.licensePlateOrSerial && (
                                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 shrink-0">
                                  {selectedMachinery.licensePlateOrSerial}
                                </span>
                              )}
                            </div>
                            {/* Logo abaixo em texto menor secundário: Motorista/Operador associado */}
                            <div className="text-[10px] text-stone-500 dark:text-stone-400 truncate mt-0.5">
                              👤 Motorista / Operador: <strong className="font-semibold text-stone-700 dark:text-stone-300">{selectedMachinery.operatorOrDriver ? selectedMachinery.operatorOrDriver.split(',')[0].trim() : 'Sem operador associado'}</strong>
                            </div>
                          </div>
                        ) : (
                          <span className="text-stone-400 text-xs sm:text-sm">Selecione o veículo...</span>
                        )}
                      </div>
                      <ChevronDown className={`w-4 h-4 text-stone-400 shrink-0 transition-transform duration-200 ${isVehicleDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Popover de Opções de Veículos com Filtro de Busca */}
                    {isVehicleDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                        {/* Campo de Pesquisa Rápida */}
                        <div className="p-2 border-b border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-850 flex items-center space-x-1.5">
                          <Search className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          <input
                            type="text"
                            value={vehicleSearchText}
                            onChange={(e) => setVehicleSearchText(e.target.value)}
                            placeholder="Buscar máquina, placa ou operador..."
                            className="w-full bg-transparent text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none"
                            autoFocus
                          />
                          {vehicleSearchText && (
                            <button
                              type="button"
                              onClick={() => setVehicleSearchText('')}
                              className="text-stone-400 hover:text-stone-600 text-[10px]"
                            >
                              Limpar
                            </button>
                          )}
                        </div>

                        {/* Lista com Rolagem */}
                        <div className="max-h-56 overflow-y-auto divide-y divide-stone-100 dark:divide-stone-700/50">
                          {filteredVehicles.length === 0 ? (
                            <div className="p-3 text-center text-xs text-stone-400">
                              Nenhuma máquina encontrada.
                            </div>
                          ) : (
                            filteredVehicles.map((v) => {
                              const isSelected = v.id === machineryId;
                              return (
                                <button
                                  key={v.id}
                                  type="button"
                                  onClick={() => {
                                    handleSelecaoVeiculo(v.id);
                                    setIsVehicleDropdownOpen(false);
                                  }}
                                  className={`w-full text-left p-2.5 transition flex items-center justify-between cursor-pointer ${
                                    isSelected
                                      ? 'bg-amber-50 dark:bg-amber-950/40 border-l-4 border-amber-500'
                                      : 'hover:bg-stone-50 dark:hover:bg-stone-750'
                                  }`}
                                >
                                  <div className="flex-1 min-w-0 pr-2">
                                    {/* Nome da Máquina + Placa em Destaque */}
                                    <div className="flex items-center space-x-1.5 flex-wrap">
                                      <span className={`text-xs sm:text-sm font-bold truncate ${isSelected ? 'text-amber-900 dark:text-amber-200' : 'text-stone-900 dark:text-stone-100'}`}>
                                        {v.nome}
                                      </span>
                                      {v.licensePlateOrSerial && (
                                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-stone-100 dark:bg-stone-700 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-600 shrink-0">
                                          {v.licensePlateOrSerial}
                                        </span>
                                      )}
                                    </div>
                                    {/* Texto menor secundário: Motorista/Operador associado */}
                                    <div className="text-[10px] text-stone-500 dark:text-stone-400 truncate mt-0.5">
                                      👤 Motorista / Operador: <span className="font-medium text-stone-600 dark:text-stone-300">{v.operatorOrDriver ? v.operatorOrDriver.split(',')[0].trim() : 'Sem operador associado'}</span>
                                    </div>
                                  </div>
                                  {isSelected && (
                                    <Check className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                                  )}
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}

                    {/* Select nativo oculto para sincronização e acessibilidade */}
                    <select
                      id="select-veiculo-maquina"
                      value={machineryId}
                      onChange={(e) => handleSelecaoVeiculo(e.target.value)}
                      className="sr-only"
                      tabIndex={-1}
                      aria-hidden="true"
                    >
                      <option value="">Selecione o veículo...</option>
                      {availableMachineries.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-0.5">
                      Data do Abastecimento <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs pointer-events-auto"
                    />
                  </div>
                </div>

                {/* Banner Informativo: Primeiro Abastecimento (Margens reduzidas para py-2 px-3) */}
                {isFirstRecord && (
                  <div className="py-2 px-3 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-lg flex items-start space-x-2 text-xs text-amber-900 dark:text-amber-200 shadow-2xs">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block leading-tight">Primeiro Abastecimento Detectado</span>
                      <span className="text-amber-800/90 dark:text-amber-300/90 text-[10px] leading-tight block mt-0.5">
                        Registro inicial deste veículo: o nível do tanque parte de 0 L (Projeção = Litros Abastecidos) e o consumo é 0. Preencha apenas a leitura atual, que servirá como base para os próximos registros.
                      </span>
                    </div>
                  </div>
                )}

                {/* 2. Odômetro / Quilometragem (KM) e Horímetro (Horas de Motor) */}
                <div className="space-y-2">
                  {/* Seção: Quilometragem (KM) */}
                  <div className="p-2.5 bg-stone-50 dark:bg-stone-800/40 rounded-lg border border-stone-200 dark:border-stone-700/80 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-stone-800 dark:text-stone-200 flex items-center space-x-1">
                        <Gauge className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Odômetro / Quilometragem (KM)</span>
                      </span>
                      {isFirstRecordKm ? (
                        <span className="text-[9px] font-semibold text-stone-600 dark:text-stone-400 bg-stone-200/80 dark:bg-stone-700/80 px-1.5 py-0.5 rounded">
                          Registro Inicial
                        </span>
                      ) : displayKmPerLiter !== null ? (
                        <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-1.5 py-0.5 rounded">
                          Média: {displayKmPerLiter} km/L
                        </span>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <div className="flex items-center justify-between mb-0.5">
                          <label className="block text-[10px] font-semibold text-stone-600 dark:text-stone-400">
                            KM Anterior
                          </label>
                          {isFirstRecordKm ? (
                            <span className="text-[9px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/70 px-1 py-0.5 rounded">
                              Primeiro registro
                            </span>
                          ) : previousKm ? (
                            <span className="text-[9px] font-medium text-stone-500 dark:text-stone-400 flex items-center space-x-0.5">
                              <History className="w-2.5 h-2.5" />
                              <span>Anterior</span>
                            </span>
                          ) : null}
                        </div>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={isFirstRecordKm ? '' : previousKm}
                          onChange={(e) => setPreviousKm(e.target.value)}
                          disabled={isFirstRecordKm}
                          placeholder={isFirstRecordKm ? "Primeiro registro" : "Ex: 145000"}
                          className={`w-full px-2.5 py-1.5 rounded-lg border text-xs sm:text-sm font-medium focus:outline-none transition ${
                            isFirstRecordKm
                              ? 'border-stone-200 dark:border-stone-700/60 bg-stone-100/80 dark:bg-stone-800/60 text-stone-400 dark:text-stone-500 cursor-not-allowed select-none placeholder:text-stone-400 dark:placeholder:text-stone-500'
                              : 'border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-emerald-500'
                          }`}
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-0.5">
                          <label className="block text-[10px] font-semibold text-stone-600 dark:text-stone-400">
                            KM Atual no Abastecimento
                          </label>
                          {isFirstRecordKm && (
                            <span className="text-[9px] font-medium text-emerald-600 dark:text-emerald-400">
                              Base para os próximos
                            </span>
                          )}
                        </div>
                        <input
                          id="input-km-atual"
                          type="text"
                          inputMode="decimal"
                          value={currentKm}
                          onChange={(e) => setCurrentKm(e.target.value)}
                          placeholder="Ex: 145600"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Seção: Horímetro (Horas) */}
                  <div className="p-2.5 bg-stone-50 dark:bg-stone-800/40 rounded-lg border border-stone-200 dark:border-stone-700/80 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-stone-800 dark:text-stone-200 flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span>Horímetro (Horas de Motor)</span>
                      </span>
                      {isFirstRecordHour ? (
                        <span className="text-[9px] font-semibold text-stone-600 dark:text-stone-400 bg-stone-200/80 dark:bg-stone-700/80 px-1.5 py-0.5 rounded">
                          Registro Inicial
                        </span>
                      ) : displayLitersPerHour !== null ? (
                        <span className="text-[10px] font-black text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 px-1.5 py-0.5 rounded">
                          Média: {displayLitersPerHour} L/h
                        </span>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <div className="flex items-center justify-between mb-0.5">
                          <label className="block text-[10px] font-semibold text-stone-600 dark:text-stone-400">
                            Horas Anterior
                          </label>
                          {isFirstRecordHour ? (
                            <span className="text-[9px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/70 px-1 py-0.5 rounded">
                              Primeiro registro
                            </span>
                          ) : previousHourMeter ? (
                            <span className="text-[9px] font-medium text-stone-500 dark:text-stone-400 flex items-center space-x-0.5">
                              <History className="w-2.5 h-2.5" />
                              <span>Anterior</span>
                            </span>
                          ) : null}
                        </div>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={isFirstRecordHour ? '' : previousHourMeter}
                          onChange={(e) => setPreviousHourMeter(e.target.value)}
                          disabled={isFirstRecordHour}
                          placeholder={isFirstRecordHour ? "Primeiro registro" : "Ex: 198"}
                          className={`w-full px-2.5 py-1.5 rounded-lg border text-xs sm:text-sm font-medium focus:outline-none transition ${
                            isFirstRecordHour
                              ? 'border-stone-200 dark:border-stone-700/60 bg-stone-100/80 dark:bg-stone-800/60 text-stone-400 dark:text-stone-500 cursor-not-allowed select-none placeholder:text-stone-400 dark:placeholder:text-stone-500'
                              : 'border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-amber-500'
                          }`}
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-0.5">
                          <label className="block text-[10px] font-semibold text-stone-600 dark:text-stone-400">
                            Horas Atual no Abastecimento
                          </label>
                          {isFirstRecordHour && (
                            <span className="text-[9px] font-medium text-amber-600 dark:text-amber-400">
                              Base para os próximos
                            </span>
                          )}
                        </div>
                        <input
                          id="input-horas-atual"
                          type="text"
                          inputMode="decimal"
                          value={currentHourMeter}
                          onChange={(e) => setCurrentHourMeter(e.target.value)}
                          placeholder="Ex: 250"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Combustível, Litros Abastecidos, Preço / Litro e Total */}
                <div className="space-y-2 pt-0.5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {/* Combustível */}
                    <div>
                      <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-0.5">
                        Combustível
                      </label>
                      <select
                        value={fuelType}
                        onChange={(e) => setFuelType(e.target.value as any)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                      >
                        <option value="Diesel S10">Diesel S10</option>
                        <option value="Diesel Comum">Diesel Comum</option>
                        <option value="Arla 32">Arla 32</option>
                        <option value="Gasolina">Gasolina</option>
                        <option value="Etanol">Etanol</option>
                      </select>
                    </div>

                    {/* Litros Abastecidos */}
                    <div>
                      <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-0.5">
                        Litros Abastecidos <span className="text-rose-500">*</span>
                      </label>
                      <input
                        id="input-litros-abastecidos"
                        type="text"
                        inputMode="decimal"
                        value={liters}
                        onChange={(e) => handleLitersChange(e.target.value)}
                        placeholder="Ex: 250"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-amber-400 dark:border-amber-700/80 bg-amber-50/40 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs pointer-events-auto"
                      />
                    </div>

                    {/* Preço por Litro */}
                    <div>
                      <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-0.5">
                        Preço / Litro (R$)
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={pricePerLiter}
                        onChange={(e) => handlePriceChange(e.target.value)}
                        placeholder="Ex: 5.85"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* Total Financeiro Formatado no Padrão R$ #.##0,00 */}
                  <div className="p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-lg flex items-center justify-between">
                    <div className="flex items-center space-x-1.5 text-amber-800 dark:text-amber-300 text-xs font-semibold">
                      <Calculator className="w-3.5 h-3.5" />
                      <span>Valor Total Calculado:</span>
                    </div>
                    <div className="text-base font-black text-amber-900 dark:text-amber-200 font-['Outfit']">
                      R$ {totalAmount ? parseFloat(totalAmount).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'}
                    </div>
                  </div>
                </div>

                {/* 4. Origem do Combustível & Integração com o Financeiro (Contas a Pagar) */}
                <div className="p-3 bg-stone-50/90 dark:bg-stone-800/50 rounded-xl border border-stone-200 dark:border-stone-700/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center space-x-1.5">
                      <Droplets className="w-3.5 h-3.5 text-amber-600" />
                      <span>Origem do Combustível <span className="text-rose-500">*</span></span>
                    </label>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-200/80 dark:bg-stone-700 text-stone-700 dark:text-stone-300">
                      {fuelOrigin === 'Tanque Interno (Fazenda)' ? 'Tanque da Fazenda' : fuelOrigin === 'Posto Conveniado (Faturado)' ? 'Posto Conveniado' : 'Posto de Viagem'}
                    </span>
                  </div>

                  <select
                    id="select-origem-combustivel"
                    value={fuelOrigin}
                    onChange={(e) => {
                      const val = e.target.value as FuelOrigin;
                      setFuelOrigin(val);
                      setValidationError('');
                      if (val === 'Tanque Interno (Fazenda)') {
                        setSupplierStation('Tanque da Fazenda');
                      } else if (val === 'Posto Conveniado (Faturado)') {
                        if (supplierStation === 'Tanque da Fazenda') {
                          setSupplierStation(availableSuppliers[0]?.name || '');
                        }
                      } else if (val === 'Posto de Viagem (Pago na Hora)') {
                        if (supplierStation === 'Tanque da Fazenda') {
                          setSupplierStation('');
                        }
                        if (!bankAccountId && availableBankAccounts.length > 0) {
                          setBankAccountId(availableBankAccounts[0].id);
                        }
                      }
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs cursor-pointer"
                  >
                    <option value="Tanque Interno (Fazenda)">Tanque Interno (Fazenda)</option>
                    <option value="Posto Conveniado (Faturado)">Posto Conveniado (Faturado)</option>
                    <option value="Posto de Viagem (Pago na Hora)">Posto de Viagem (Pago na Hora)</option>
                  </select>

                  {/* CASO 1: Tanque Interno da Fazenda */}
                  {fuelOrigin === 'Tanque Interno (Fazenda)' && (
                    <div className="space-y-2 pt-1 border-t border-stone-200 dark:border-stone-700/60">
                      <div>
                        <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-0.5 flex items-center space-x-1.5">
                          <Warehouse className="w-3.5 h-3.5 text-amber-600" />
                          <span>Tanque da Fazenda (Tabela tanques_combustivel) <span className="text-rose-500">*</span></span>
                        </label>
                        <select
                          id="select-tanque-combustivel"
                          value={selectedTanqueId}
                          onChange={(e) => {
                            const tId = e.target.value;
                            setSelectedTanqueId(tId);
                            const t = tanques.find(item => item.id === tId);
                            if (t) {
                              setSupplierStation(t.nome);
                              if (t.tipo_combustivel?.toLowerCase().includes('s500')) {
                                setFuelType('Diesel Comum');
                              } else if (t.tipo_combustivel?.toLowerCase().includes('s10')) {
                                setFuelType('Diesel S10');
                              }
                            }
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-amber-400 dark:border-amber-700 bg-amber-50/40 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs cursor-pointer"
                        >
                          {tanques.map((t) => {
                            const pct = t.capacidade_total > 0 ? ((t.quantidade_atual / t.capacidade_total) * 100).toFixed(1) : '0.0';
                            return (
                              <option key={t.id} value={t.id}>
                                {t.nome} - Saldo: {t.quantidade_atual.toLocaleString('pt-BR')} L / {t.capacidade_total.toLocaleString('pt-BR')} L ({pct}%)
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div className="py-2 px-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-900 dark:text-emerald-200 flex items-start space-x-2">
                        <span className="text-base shrink-0 mt-0.5">🚜</span>
                        <div className="text-[11px] leading-snug">
                          <strong className="block font-bold">Tanque Selecionado: {selectedTanque?.nome || 'Principal'}</strong>
                          <span className="text-emerald-800/90 dark:text-emerald-300/90">
                            Subtrai os litros abastecidos diretamente da coluna <code className="font-mono bg-emerald-100/80 dark:bg-emerald-900/60 px-1 rounded">quantidade_atual</code> da tabela <code className="font-mono bg-emerald-100/80 dark:bg-emerald-900/60 px-1 rounded">tanques_combustivel</code> e salva o <code className="font-mono bg-emerald-100/80 dark:bg-emerald-900/60 px-1 rounded">tanque_id</code> no registro. No financeiro, não gera dívida pendente (compensado pelo estoque).
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* CASO 2: Posto Conveniado (Faturado) */}
                  {fuelOrigin === 'Posto Conveniado (Faturado)' && (
                    <div className="space-y-2 pt-1 border-t border-stone-200 dark:border-stone-700/60">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-0.5 flex items-center space-x-1">
                            <Building2 className="w-3.5 h-3.5 text-blue-600" />
                            <span>Fornecedor / Posto Conveniado <span className="text-rose-500">*</span></span>
                          </label>
                          {availableSuppliers.length > 0 ? (
                            <div className="space-y-1">
                              <select
                                value={availableSuppliers.some(s => s.name === supplierStation || s.id === supplierStation) ? supplierStation : '__outro__'}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setValidationError('');
                                  if (val === '__outro__') {
                                    setSupplierStation('');
                                  } else {
                                    const sup = availableSuppliers.find(s => s.id === val || s.name === val);
                                    setSupplierStation(sup ? sup.name : val);
                                  }
                                }}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs cursor-pointer"
                              >
                                <option value="">Selecione o Fornecedor / Posto...</option>
                                {availableSuppliers.map((s) => (
                                  <option key={s.id} value={s.name}>
                                    {s.name} {s.category ? `(${s.category})` : ''}
                                  </option>
                                ))}
                                <option value="__outro__">+ Outro Posto / Digitar Nome...</option>
                              </select>
                              {(!availableSuppliers.some(s => s.name === supplierStation) || supplierStation === '') && (
                                <input
                                  type="text"
                                  value={supplierStation}
                                  onChange={(e) => {
                                    setSupplierStation(e.target.value);
                                    setValidationError('');
                                  }}
                                  placeholder="Digite o nome do Posto Conveniado..."
                                  className="w-full px-2.5 py-1.5 rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs mt-1"
                                />
                              )}
                            </div>
                          ) : (
                            <input
                              type="text"
                              value={supplierStation}
                              onChange={(e) => {
                                setSupplierStation(e.target.value);
                                setValidationError('');
                              }}
                              placeholder="Ex: Posto Trevo, Auto Posto Ipiranga..."
                              className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                            />
                          )}
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-0.5 flex items-center space-x-1">
                            <Calendar className="w-3.5 h-3.5 text-stone-500" />
                            <span>Vencimento da Fatura</span>
                          </label>
                          <input
                            type="date"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs cursor-pointer"
                          />
                        </div>
                      </div>

                      <div className="py-2 px-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 text-xs text-blue-900 dark:text-blue-200 flex items-start space-x-2">
                        <span className="text-base shrink-0 mt-0.5">📄</span>
                        <div className="text-[11px] leading-snug">
                          <strong className="block font-bold">Integração Contas a Pagar: Status "A Pagar" (Pendente)</strong>
                          <span className="text-blue-800/90 dark:text-blue-300/90">
                            Cria lançamento na tabela 'contas_a_pagar' com status 'A Pagar', vinculado ao Fornecedor/Posto faturado e apropriado ao custo do veículo para apuração do DRE.
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* CASO 3: Posto de Viagem (Pago na Hora) */}
                  {fuelOrigin === 'Posto de Viagem (Pago na Hora)' && (
                    <div className="space-y-2 pt-1 border-t border-stone-200 dark:border-stone-700/60">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {/* Forma de Pagamento */}
                        <div>
                          <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-0.5 flex items-center space-x-1">
                            <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Forma de Pagamento <span className="text-rose-500">*</span></span>
                          </label>
                          <select
                            value={paymentMethod}
                            onChange={(e) => {
                              setPaymentMethod(e.target.value);
                              setValidationError('');
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs cursor-pointer"
                          >
                            <option value="Pix">Pix</option>
                            <option value="Cartão">Cartão</option>
                            <option value="Dinheiro">Dinheiro</option>
                          </select>
                        </div>

                        {/* Conta Bancária / Caixa */}
                        <div>
                          <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-0.5 flex items-center space-x-1">
                            <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Conta Bancária / Caixa <span className="text-rose-500">*</span></span>
                          </label>
                          <select
                            value={bankAccountId}
                            onChange={(e) => {
                              setBankAccountId(e.target.value);
                              setValidationError('');
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs cursor-pointer"
                          >
                            <option value="">Selecione a Conta / Caixa...</option>
                            {availableBankAccounts.map((acc) => (
                              <option key={acc.id} value={acc.id}>
                                {acc.name} ({acc.bankName || 'Conta'}) - Saldo: {formatCurrencyBRL(acc.balance || 0)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-stone-700 dark:text-stone-300 mb-0.5">
                          Nome do Posto na Estrada / Cidade (Opcional)
                        </label>
                        <input
                          type="text"
                          value={supplierStation}
                          onChange={(e) => setSupplierStation(e.target.value)}
                          placeholder="Ex: Posto Graal Rodovia, Auto Posto Presidente..."
                          className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                        />
                      </div>

                      <div className="py-2 px-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-900 dark:text-emerald-200 flex items-start space-x-2">
                        <span className="text-base shrink-0 mt-0.5">💰</span>
                        <div className="text-[11px] leading-snug">
                          <strong className="block font-bold">Integração Contas a Pagar: Status "Pago" (Liquidada)</strong>
                          <span className="text-emerald-800/90 dark:text-emerald-300/90">
                            Cria lançamento liquidado na tabela 'contas_a_pagar' com status 'Pago', deduzindo o valor na hora da conta bancária/caixa escolhida e vinculando o custo ao DRE do veículo.
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 5. Motorista / Operador e Observações */}
                <div className="space-y-2 pt-0.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-0.5">
                        Motorista / Operador
                      </label>
                      <select
                        value={driverOrOperator}
                        onChange={(e) => setDriverOrOperator(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                      >
                        <option value="">Selecione quem abasteceu...</option>
                        {employees.map((emp) => (
                          <option key={emp.id} value={emp.name}>
                            {emp.name} ({emp.role})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-0.5">
                        Observações do Abastecimento
                      </label>
                      <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Ex: Abastecimento em trânsito safra..."
                        className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* Sincronizar com Despesas */}
                  {!editingLog && (
                    <label className="flex items-center space-x-2 p-2 rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={createExpense}
                        onChange={(e) => setCreateExpense(e.target.checked)}
                        className="w-3.5 h-3.5 text-amber-600 rounded focus:ring-amber-500"
                      />
                      <div className="text-[11px] leading-tight">
                        <span className="font-bold text-stone-900 dark:text-stone-100 block">
                          Sincronizar lançamento financeiro & DRE do veículo
                        </span>
                        <span className="text-stone-500 dark:text-stone-400 text-[10px]">
                          Registra a movimentação no Contas a Pagar conforme a Origem selecionada e vincula ao DRE.
                        </span>
                      </div>
                    </label>
                  )}
                </div>

              </form>
            </div>

            {/* Visualizador do Tanque à Direita (Compactado e sem rolagem) */}
            <div className="lg:col-span-5 lg:sticky lg:top-0">
              {fuelOrigin === 'Tanque Interno (Fazenda)' ? (
                <TanqueIndustrialVisualizer
                  tanque={selectedTanque}
                  addedLitersInput={liters}
                  tanques={tanques}
                  onTanqueChange={(tId) => {
                    setSelectedTanqueId(tId);
                    const t = tanques.find(item => item.id === tId);
                    if (t) {
                      setSupplierStation(t.nome);
                      if (t.tipo_combustivel?.toLowerCase().includes('s500')) {
                        setFuelType('Diesel Comum');
                      } else if (t.tipo_combustivel?.toLowerCase().includes('s10')) {
                        setFuelType('Diesel S10');
                      }
                    }
                  }}
                />
              ) : (
                <FuelTankVisualizer 
                  machinery={selectedMachinery}
                  dbTankLevel={dbTankLevel}
                  addedLitersInput={liters}
                  currentHourMeterInput={currentHourMeter}
                  previousHourMeterInput={previousHourMeter}
                  currentKmInput={currentKm}
                  previousKmInput={previousKm}
                  liveLitersPerHour={calculatedMetrics.litersPerHour}
                  liveKmPerLiter={calculatedMetrics.kmPerLiter}
                  historicalAvgLitersPerHour={historicalAvgLitersPerHour}
                  historicalAvgKmPerLiter={historicalAvgKmPerLiter}
                  isFirstRecord={isFirstRecord}
                  onCalculationChange={setLatestCalculation}
                />
              )}
            </div>

          </div>
        </div>

        {/* Rodapé com Ações Compacto */}
        <div className="px-4 py-2.5 bg-zinc-50 dark:bg-stone-800/80 border-t border-zinc-200 dark:border-stone-700 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0 relative z-30 pointer-events-auto">
          <div className="w-full sm:w-auto">
            {validationError ? (
              <div className="flex items-center space-x-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{validationError}</span>
              </div>
            ) : isOverCapacity ? (
              <div className="flex items-center space-x-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-1 rounded-lg border border-amber-300 dark:border-amber-800 animate-in fade-in">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>Alerta visual: Projeção excede a capacidade do tanque (+{latestCalculation?.excessoLitros?.toFixed(1) || '0.0'} L). Salvamento liberado com dados reais.</span>
              </div>
            ) : null}
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => onClose()}
              className="pointer-events-auto cursor-pointer px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-stone-600 text-zinc-700 dark:text-zinc-200 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-stone-700 transition"
            >
              Cancelar
            </button>
            <button
              id="btn-salvar-abastecimento"
              type="submit"
              form="fuel-form"
              disabled={isLoading}
              className={`px-4 py-2 rounded-xl text-white text-xs font-bold shadow-xs transition flex items-center space-x-1.5 ${
                isLoading
                  ? 'opacity-50 cursor-not-allowed bg-stone-400 dark:bg-stone-600 pointer-events-none select-none'
                  : 'pointer-events-auto cursor-pointer bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800'
              }`}
            >
              <Save className="w-3.5 h-3.5 pointer-events-none" />
              <span>{isLoading ? 'Salvando...' : 'Salvar Abastecimento'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
