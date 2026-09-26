import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Fuel, Save, Calculator, Gauge, Clock, History, AlertTriangle, Sparkles, Droplets, Building2, CreditCard, Wallet, Calendar, ChevronDown, Search, Check, Warehouse, ArrowDown, Settings } from 'lucide-react';
import { FuelLog, Machinery, Employee, Supplier, BankAccount, FuelOrigin, TanqueCombustivel, InventoryItem } from '../../types';
import { FuelTankVisualizer } from './FuelTankVisualizer';
import { TanqueIndustrialVisualizer } from './TanqueIndustrialVisualizer';
import { FuelCalculationResult } from '../../lib/fuelCalculation';
import { calculateVehicleConsumptionMetrics } from '../../lib/fleetMetrics';
import { fetchGestaoFrotas, fetchCloudFuelLogs, fetchTanquesCombustivel, fetchCombustivelEstoqueProdutos, subtrairCombustivelTanque, updateCapacidadeTanqueCombustivel } from '../../lib/supabaseService';
import { getStoredSuppliers, getStoredBankAccounts, getStoredTanquesCombustivel, getStoredInventory, ensureDieselProductsInInventory, calculateDefaultDueDate, formatCurrencyBRL } from '../../lib/storage';

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

  // Combustíveis dinâmicos do estoque (tabela 'public.estoque_produtos' - categoria 'Combustível & Arla')
  const [fuelStockProducts, setFuelStockProducts] = useState<InventoryItem[]>(() => {
    return ensureDieselProductsInInventory(getStoredInventory()).filter(item => {
      const cat = String(item.categoria || item.category || '').toLowerCase();
      const nome = String(item.nome_comercial || item.name || '').toLowerCase();
      return cat.includes('combust') || cat.includes('arla') || nome.includes('diesel') || nome.includes('arla');
    });
  });
  const [selectedFuelProductId, setSelectedFuelProductId] = useState<string>(() => {
    const list = ensureDieselProductsInInventory(getStoredInventory()).filter(item => {
      const cat = String(item.categoria || item.category || '').toLowerCase();
      const nome = String(item.nome_comercial || item.name || '').toLowerCase();
      return cat.includes('combust') || cat.includes('arla') || nome.includes('diesel') || nome.includes('arla');
    });
    return list[0]?.id || 'prod_diesel_s10';
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
  const [pricePerLiter, setPricePerLiter] = useState(() => {
    const list = ensureDieselProductsInInventory(getStoredInventory()).filter(item => {
      const cat = String(item.categoria || item.category || '').toLowerCase();
      const nome = String(item.nome_comercial || item.name || '').toLowerCase();
      return cat.includes('combust') || cat.includes('arla') || nome.includes('diesel') || nome.includes('arla');
    });
    const s10 = list.find(p => (p.nome_comercial || p.name).toLowerCase().includes('s10')) || list[0];
    const cost = Number(s10?.preco_custo_inicial ?? (s10 as any)?.custo_nominal ?? s10?.unitCost ?? 0);
    return cost > 0 ? cost.toFixed(2) : '5.85';
  });
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

  // 2. ESTADO DO SUB-MODAL DE CAPACIDADE DO TANQUE (Supabase public.tanques_combustivel)
  const [isTankConfigModalOpen, setIsTankConfigModalOpen] = useState(false);
  const [tankConfigTarget, setTankConfigTarget] = useState<TanqueCombustivel | null>(null);
  const [tankConfigName, setTankConfigName] = useState('');
  const [tankConfigCapacity, setTankConfigCapacity] = useState('');
  const [isSavingTankConfig, setIsSavingTankConfig] = useState(false);
  const [tankConfigError, setTankConfigError] = useState('');

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

      try {
        const fuelProds = await fetchCombustivelEstoqueProdutos();
        if (fuelProds && fuelProds.length > 0 && isMounted) {
          setFuelStockProducts(fuelProds);
          let chosenId = '';
          if (editingLog) {
            const editProd = fuelProds.find(p => 
              ((editingLog as any).produto_id && p.id === (editingLog as any).produto_id) ||
              (p.nome_comercial || p.name).toLowerCase() === String(editingLog.fuelType || '').toLowerCase()
            );
            if (editProd) chosenId = editProd.id;
          }
          if (!chosenId) {
            const s10 = fuelProds.find(p => (p.nome_comercial || p.name).toLowerCase().includes('s10'));
            chosenId = s10 ? s10.id : fuelProds[0].id;
          }
          setSelectedFuelProductId(chosenId);
          const chosenProd = fuelProds.find(p => p.id === chosenId);
          if (chosenProd) {
            setFuelType((chosenProd.nome_comercial || chosenProd.name) as any);
            // Preenchimento automático do Preço / Litro com o custo real do estoque
            if (!editingLog) {
              const cost = Number(chosenProd.preco_custo_inicial ?? (chosenProd as any).custo_nominal ?? chosenProd.unitCost ?? 0);
              if (cost > 0) {
                const formattedPrice = cost.toFixed(2);
                setPricePerLiter(formattedPrice);
              }
            }
          }
        }
      } catch (err) {
        console.warn('Busca HTTP combustivel estoque_produtos com fallback:', err);
      }
    };

    loadGestaoFrotasHttp();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Tanque Selecionado (Vinculado dinamicamente ao produto de combustível selecionado)
  const selectedTanque = useMemo(() => {
    if (selectedFuelProductId) {
      const byProdId = tanques.find(t => t.produto_id === selectedFuelProductId);
      if (byProdId) return byProdId;
      const curProd = fuelStockProducts.find(p => p.id === selectedFuelProductId);
      if (curProd) {
        const pName = (curProd.nome_comercial || curProd.name).toLowerCase();
        const byType = tanques.find(t => 
          (t.tipo_combustivel && t.tipo_combustivel.toLowerCase() === pName) ||
          (pName.includes('s10') && (t.id === 'tanque_diesel_s10' || t.tipo_combustivel?.toLowerCase().includes('s10'))) ||
          ((pName.includes('s500') || pName.includes('comum')) && (t.id === 'tanque_diesel_s500' || t.tipo_combustivel?.toLowerCase().includes('s500'))) ||
          (pName.includes('arla') && (t.nome.toLowerCase().includes('arla') || t.tipo_combustivel?.toLowerCase().includes('arla')))
        );
        if (byType) return byType;
      }
    }
    return tanques.find(t => t.id === selectedTanqueId) || tanques[0] || null;
  }, [tanques, selectedTanqueId, selectedFuelProductId, fuelStockProducts]);

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
      const prevL = (editingLog as any).previousFuelLiters ?? (editingLog as any).nivel_anterior ?? (editingLog as any).previous_fuel_liters;
      if (prevL !== undefined && prevL !== null && !isNaN(Number(prevL)) && Number(prevL) >= 0) {
        return Number(prevL);
      }
    }

    // 2. Saldo explícito do veículo registrado no banco de dados (public.gestao_frotas / estado local)
    const machLiters = (selectedMachinery as any)?.currentFuelLiters ?? 
                       (selectedMachinery as any)?.current_fuel_liters ?? 
                       (selectedMachinery as any)?.current_fuel_level ?? 
                       (selectedMachinery as any)?.nivel_combustivel ?? 
                       (selectedMachinery as any)?.saldo_combustivel ?? 
                       (selectedMachinery as any)?.fuel_level;
    if (machLiters !== undefined && machLiters !== null && !isNaN(Number(machLiters)) && Number(machLiters) >= 0) {
      return Number(machLiters);
    }

    // 3. Último registro de abastecimento no histórico deste veículo
    const prevLogs = (activeFuelLogs || [])
      .filter(l => l.machineryId === machineryId && (!editingLog || l.id !== editingLog.id))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || String(b.id).localeCompare(String(a.id)));
    const lastLog = prevLogs[0];
    if (lastLog) {
      const lFuelLiters = (lastLog as any).currentFuelLiters ?? 
                          (lastLog as any).current_fuel_liters ?? 
                          (lastLog as any).novo_nivel ?? 
                          (lastLog as any).novoNivel ?? 
                          (lastLog as any).nivel_atual;
      if (lFuelLiters !== undefined && lFuelLiters !== null && !isNaN(Number(lFuelLiters)) && Number(lFuelLiters) >= 0) {
        let remaining = Number(lFuelLiters);

        // Projeção de consumo decorrido caso o horímetro ou km atual tenha avançado
        const curH = parseFloat(String(currentHourMeter).trim().replace(',', '.'));
        const lastH = (lastLog as any).currentHourMeter ?? (lastLog as any).horas_atual ?? (lastLog as any).horimetro_atual;
        if (!isNaN(curH) && lastH !== undefined && !isNaN(Number(lastH)) && curH > Number(lastH)) {
          const deltaHours = curH - Number(lastH);
          const avgH = historicalAvgLitersPerHour || selectedMachinery?.averageConsumptionLitersPerHour || 22;
          if (avgH > 0) {
            remaining = Math.max(0, remaining - (deltaHours * avgH));
          }
        } else {
          const curK = parseFloat(String(currentKm).trim().replace(',', '.'));
          const lastK = (lastLog as any).currentKm ?? (lastLog as any).km_atual;
          if (!isNaN(curK) && lastK !== undefined && !isNaN(Number(lastK)) && curK > Number(lastK)) {
            const deltaKm = curK - Number(lastK);
            const avgK = historicalAvgKmPerLiter || selectedMachinery?.averageConsumptionKmPerLiter || 2.8;
            if (avgK > 0) {
              remaining = Math.max(0, remaining - (deltaKm / avgK));
            }
          }
        }

        return parseFloat(remaining.toFixed(1));
      }
    }

    // 4. Porcentagem de combustível cadastrada no veículo
    const machPct = (selectedMachinery as any)?.currentFuelPercentage ?? (selectedMachinery as any)?.current_fuel_percentage;
    if (machPct !== undefined && machPct !== null && tankCap > 0) {
      const pct = Number(machPct);
      if (!isNaN(pct)) {
        return parseFloat(((pct / 100) * tankCap).toFixed(1));
      }
    }

    // 5. NUNCA espelha a capacidade máxima se não houver saldo no banco (retorna 0)
    return 0;
  }, [selectedMachinery, machineryId, activeFuelLogs, editingLog, isFirstRecord, currentHourMeter, currentKm, historicalAvgLitersPerHour, historicalAvgKmPerLiter]);

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
      const curProd = fuelStockProducts.find(p => p.id === selectedFuelProductId) ||
        fuelStockProducts.find(p => (p.nome_comercial || p.name).toLowerCase().includes('s10')) ||
        fuelStockProducts[0];
      const prodName = curProd ? (curProd.nome_comercial || curProd.name) : 'Diesel S10';
      setFuelType(prodName as any);
      const defaultCost = Number(curProd?.preco_custo_inicial ?? (curProd as any)?.custo_nominal ?? curProd?.unitCost ?? 0);
      setLiters('');
      setPricePerLiter(defaultCost > 0 ? defaultCost.toFixed(2) : '5.85');
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

  // 1. DROPDOWN DE COMBUSTÍVEL DINÂMICO & VÍNCULO AUTOMÁTICO COM OS TANQUES
  // Quando o usuário seleciona um combustível do estoque, busca na tabela 'public.tanques_combustivel'
  // qual tanque possui o 'produto_id' correspondente e atualiza reativamente o painel de monitoramento do estoque.
  const handleFuelProductChange = (prodId: string) => {
    setSelectedFuelProductId(prodId);
    const prod = fuelStockProducts.find(p => p.id === prodId);
    const prodName = prod ? (prod.nome_comercial || prod.name || 'Diesel S10') : 'Diesel S10';
    setFuelType(prodName as any);

    // Localiza o tanque que possui este produto_id ou tipo compatível
    const matchingTank = tanques.find(t => 
      t.produto_id === prodId || 
      (t as any).produtoId === prodId ||
      (t.tipo_combustivel && t.tipo_combustivel.toLowerCase() === prodName.toLowerCase()) ||
      (prodName.toLowerCase().includes('s10') && (t.id === 'tanque_diesel_s10' || t.tipo_combustivel?.toLowerCase().includes('s10'))) ||
      ((prodName.toLowerCase().includes('s500') || prodName.toLowerCase().includes('comum')) && (t.id === 'tanque_diesel_s500' || t.tipo_combustivel?.toLowerCase().includes('s500'))) ||
      (prodName.toLowerCase().includes('arla') && (t.nome.toLowerCase().includes('arla') || t.tipo_combustivel?.toLowerCase().includes('arla') || t.id === 'tanque_arla_32'))
    );

    if (matchingTank) {
      setSelectedTanqueId(matchingTank.id);
      if (fuelOrigin === 'Tanque Interno (Fazenda)') {
        setSupplierStation(matchingTank.nome);
      }
    }

    // 1. PREÇO POR LITRO DINÂMICO VINDO DO ESTOQUE
    // Preenche AUTOMATICAMENTE assim que o usuário selecionar um produto no dropdown 'Combustível'.
    // Valor puxado diretamente da coluna de custo do produto na tabela 'public.estoque_produtos'.
    if (prod) {
      const cost = Number(prod.preco_custo_inicial ?? (prod as any).custo_nominal ?? prod.unitCost ?? 0);
      if (cost > 0) {
        const formattedPrice = cost.toFixed(2);
        setPricePerLiter(formattedPrice);
        calculateTotal(liters, formattedPrice);
      }
    }
  };

  // 2. GERENCIAMENTO DE CAPACIDADE DOS TANQUES INTERNOS (Supabase 'tanques_combustivel')
  const openTankConfigModal = (tankToConfig?: TanqueCombustivel | null) => {
    const target = tankToConfig || selectedTanque || tanques[0];
    if (!target) return;
    setTankConfigTarget(target);
    setTankConfigName(target.nome);
    setTankConfigCapacity(String(target.capacidade_total || 15000));
    setTankConfigError('');
    setIsTankConfigModalOpen(true);
  };

  const handleSaveTankCapacity = async () => {
    if (!tankConfigTarget) return;
    const cleanCap = parseFloat(String(tankConfigCapacity).replace(/\./g, '').replace(',', '.'));
    if (isNaN(cleanCap) || cleanCap <= 0) {
      setTankConfigError('Informe uma capacidade total válida em litros (maior que 0).');
      return;
    }

    setIsSavingTankConfig(true);
    setTankConfigError('');
    try {
      const res = await updateCapacidadeTanqueCombustivel({
        tanqueId: tankConfigTarget.id,
        novaCapacidadeTotal: cleanCap,
        novoNome: tankConfigName.trim() || tankConfigTarget.nome
      });

      if (res.success && res.tanque) {
        setTanques(prev => prev.map(t => t.id === tankConfigTarget.id ? res.tanque! : t));
        setIsTankConfigModalOpen(false);
      } else {
        setTankConfigError(res.error || 'Erro ao salvar capacidade do tanque.');
      }
    } catch (err) {
      console.error('Erro ao atualizar capacidade do tanque:', err);
      setTankConfigError('Falha ao comunicar com o banco de dados. Tente novamente.');
    } finally {
      setIsSavingTankConfig(false);
    }
  };

  // 2. CÁLCULO DE MÉDIAS EM TEMPO REAL
  // Se Litros Abastecidos for vazio ou 0, ou se isFirstRecord for verdadeiro:
  // o sistema NÃO calcula médias, evitando divisões por zero ou congelamento em médias antigas.
  const calculatedMetrics = useMemo(() => {
    const l = parseFloat(String(liters).trim().replace(',', '.')) || 0;
    if (l <= 0 || isFirstRecord) {
      return { kmPerLiter: null, litersPerHour: null };
    }

    // Média KM: km/L
    let kmPerLiter: number | null = null;
    if (!isFirstRecordKm) {
      const cKm = parseFloat(String(currentKm).trim().replace(',', '.'));
      const pKm = parseFloat(String(previousKm).trim().replace(',', '.'));
      if (!isNaN(cKm) && !isNaN(pKm) && cKm > pKm) {
        kmPerLiter = parseFloat(((cKm - pKm) / l).toFixed(2));
      }
    }

    // Média Horas: L/h
    let litersPerHour: number | null = null;
    if (!isFirstRecordHour) {
      const cHour = parseFloat(String(currentHourMeter).trim().replace(',', '.'));
      const pHour = parseFloat(String(previousHourMeter).trim().replace(',', '.'));
      if (!isNaN(cHour) && !isNaN(pHour) && cHour > pHour) {
        litersPerHour = parseFloat((l / (cHour - pHour)).toFixed(2));
      }
    }

    return { kmPerLiter, litersPerHour };
  }, [isFirstRecord, isFirstRecordKm, isFirstRecordHour, liters, currentKm, previousKm, currentHourMeter, previousHourMeter]);

  const litersNumber = parseFloat(String(liters).trim().replace(',', '.')) || 0;
  const displayLitersPerHour = (isFirstRecord || isFirstRecordHour || litersNumber <= 0) ? null : calculatedMetrics.litersPerHour;
  const displayKmPerLiter = (isFirstRecord || isFirstRecordKm || litersNumber <= 0) ? null : calculatedMetrics.kmPerLiter;

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
      produto_id: selectedFuelProductId,
      produtoId: selectedFuelProductId,
      tanque_id: fuelOrigin === 'Tanque Interno (Fazenda)' ? (selectedTanque?.id || selectedTanqueId || tanques[0]?.id) : undefined,
      tanqueId: fuelOrigin === 'Tanque Interno (Fazenda)' ? (selectedTanque?.id || selectedTanqueId || tanques[0]?.id) : undefined,
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
    if (fuelOrigin === 'Tanque Interno (Fazenda)' && (selectedTanque?.id || selectedTanqueId || tanques[0]?.id) && l > 0) {
      const tId = selectedTanque?.id || selectedTanqueId || tanques[0]?.id;
      subtrairCombustivelTanque(tId, l).catch(err => {
        console.warn('Erro ao subtrair litros de tanques_combustivel:', err);
      });
    }

    onSave(log, createExpense && !editingLog);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-2.5 bg-black/60 dark:bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-6xl w-full h-auto max-h-[94vh] shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col text-zinc-900 dark:text-zinc-100">
        
        {/* Cabeçalho Equilibrado e Compacto */}
        <div className="px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/90 text-zinc-900 dark:text-zinc-100 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-700/80 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 dark:bg-amber-500/20 border border-amber-500/30 dark:border-amber-500/40 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-2xs">
              <Fuel className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white font-['Outfit'] leading-tight">
                {editingLog ? 'Editar Abastecimento' : 'Novo Registro de Abastecimento'}
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-none mt-0.5">
                Controle de combustível com cálculo de consumo em tempo real
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onClose()}
            className="p-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-700/60 dark:hover:bg-zinc-700 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-white border border-zinc-200 dark:border-zinc-600 transition cursor-pointer pointer-events-auto"
          >
            <X className="w-4 h-4 pointer-events-none" />
          </button>
        </div>

        {/* Corpo do Modal com Respiro Elegante e Simetria */}
        <div className="overflow-y-auto flex-1 bg-zinc-100/70 dark:bg-zinc-900">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 p-3 items-stretch min-h-full">
            
            {/* Coluna Esquerda: Formulário com Cards e Inputs Bem Definidos */}
            <div className="lg:col-span-7 flex flex-col">
              <form id="fuel-form" noValidate onSubmit={handleSubmit} className="flex flex-col justify-between h-full gap-2.5">
                
                {/* 1. Veículo / Máquina e Data do Abastecimento */}
                <div className="p-3 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                    <div className="sm:col-span-8 relative" ref={vehicleDropdownRef}>
                      <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-0.5">
                        Veículo / Máquina <span className="text-rose-500">*</span>
                      </label>

                      {/* Botão Seletor Customizado do Veículo com Fundo e Borda Nítidos */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsVehicleDropdownOpen(prev => !prev);
                          setVehicleSearchText('');
                        }}
                        className="w-full text-left px-3 py-1.5 h-8.5 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700/75 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-amber-500 dark:focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 flex items-center justify-between transition cursor-pointer shadow-xs"
                      >
                        <div className="flex-1 min-w-0 pr-2 flex items-center justify-between gap-2">
                          {selectedMachinery ? (
                            <>
                              <div className="flex items-center space-x-2 min-w-0">
                                <span className="font-bold text-xs text-zinc-900 dark:text-white truncate">
                                  {selectedMachinery.nome}
                                </span>
                                {selectedMachinery.licensePlateOrSerial && (
                                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 shrink-0">
                                    {selectedMachinery.licensePlateOrSerial}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-zinc-500 dark:text-zinc-300 truncate hidden xl:inline shrink-0">
                                👤 {selectedMachinery.operatorOrDriver ? selectedMachinery.operatorOrDriver.split(',')[0].trim() : 'Sem operador'}
                              </span>
                            </>
                          ) : (
                            <span className="text-zinc-400 dark:text-zinc-400 text-xs">Selecione o veículo...</span>
                          )}
                        </div>
                        <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 dark:text-zinc-300 shrink-0 transition-transform duration-200 ${isVehicleDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {/* Popover de Opções de Veículos com Filtro de Busca */}
                      {isVehicleDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                          <div className="p-2.5 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 flex items-center space-x-2">
                            <Search className="w-4 h-4 text-zinc-400 dark:text-zinc-500 shrink-0" />
                            <input
                              type="text"
                              value={vehicleSearchText}
                              onChange={(e) => setVehicleSearchText(e.target.value)}
                              placeholder="Buscar máquina, placa ou operador..."
                              className="w-full bg-transparent text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none"
                              autoFocus
                            />
                            {vehicleSearchText && (
                              <button
                                type="button"
                                onClick={() => setVehicleSearchText('')}
                                className="text-zinc-500 hover:text-zinc-800 dark:text-zinc-300 dark:hover:text-white text-[11px]"
                              >
                                Limpar
                              </button>
                            )}
                          </div>

                          <div className="max-h-56 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-700">
                            {filteredVehicles.length === 0 ? (
                              <div className="p-3.5 text-center text-xs text-zinc-500 dark:text-zinc-400">
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
                                        ? 'bg-amber-50 dark:bg-amber-500/20 border-l-4 border-amber-500'
                                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-700/70'
                                    }`}
                                  >
                                    <div className="flex-1 min-w-0 pr-2">
                                      <div className="flex items-center space-x-1.5 flex-wrap">
                                        <span className={`text-xs sm:text-sm font-bold truncate ${isSelected ? 'text-amber-800 dark:text-amber-300' : 'text-zinc-900 dark:text-zinc-100'}`}>
                                          {v.nome}
                                        </span>
                                        {v.licensePlateOrSerial && (
                                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-600 shrink-0">
                                            {v.licensePlateOrSerial}
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[11px] text-zinc-500 dark:text-zinc-300 truncate mt-0.5">
                                        👤 Motorista / Operador: <span className="font-semibold text-zinc-700 dark:text-zinc-200">{v.operatorOrDriver ? v.operatorOrDriver.split(',')[0].trim() : 'Sem operador associado'}</span>
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

                    <div className="sm:col-span-4">
                      <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-0.5">
                        Data do Abastecimento <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full h-8.5 px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700/75 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 text-xs font-medium focus:outline-none focus:border-amber-500 dark:focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 pointer-events-auto shadow-xs"
                      />
                    </div>
                  </div>

                  {/* Banner Informativo: Primeiro Abastecimento */}
                  {isFirstRecord && (
                    <div className="mt-2 py-1.5 px-2.5 bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/35 rounded-lg flex items-center space-x-2 text-[11px] text-amber-900 dark:text-amber-200">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span className="leading-snug">
                        <strong className="text-amber-800 dark:text-amber-300 font-bold">Primeiro Abastecimento:</strong> Nível parte de 0 L (Projeção = Litros Abastecidos). Informe apenas a leitura atual como base.
                      </span>
                    </div>
                  )}
                </div>

                {/* 2. Odômetro / Quilometragem (KM) e Horímetro (Horas de Motor) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Seção: Quilometragem (KM) */}
                  <div className="p-3 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-xs space-y-2">
                    <div className="flex items-center justify-between pb-1 border-b border-zinc-100 dark:border-zinc-700">
                      <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center space-x-1.5">
                        <Gauge className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Odômetro (KM)</span>
                      </span>
                      {isFirstRecordKm ? (
                        <span className="text-[9px] font-semibold text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 px-1.5 py-0.2 rounded">
                          Registro Inicial
                        </span>
                      ) : (litersNumber > 0 && displayKmPerLiter !== null) ? (
                        <span className="text-[9px] font-black text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/40 px-1.5 py-0.2 rounded font-mono">
                          Média: {displayKmPerLiter.toFixed(2).replace('.', ',')} km/L
                        </span>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="flex items-center justify-between mb-0.5">
                          <label className="block text-[10px] font-semibold text-zinc-600 dark:text-zinc-300">
                            KM Anterior
                          </label>
                          {!isFirstRecordKm && previousKm ? (
                            <span className="text-[10px] text-zinc-400 flex items-center space-x-0.5">
                              <History className="w-3 h-3" />
                            </span>
                          ) : null}
                        </div>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={isFirstRecordKm ? '' : previousKm}
                          onChange={(e) => setPreviousKm(e.target.value)}
                          disabled={isFirstRecordKm}
                          placeholder={isFirstRecordKm ? "1º registro" : "Ex: 145000"}
                          className={`w-full h-8.5 px-2.5 py-1 rounded-lg border text-xs font-semibold focus:outline-none transition ${
                            isFirstRecordKm
                              ? 'border-zinc-200 dark:border-zinc-600/80 bg-zinc-50 dark:bg-zinc-700/35 text-zinc-400 dark:text-zinc-500 cursor-not-allowed select-none placeholder:text-zinc-400'
                              : 'border-zinc-300 dark:border-zinc-500 bg-white dark:bg-zinc-700/75 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20'
                          }`}
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-0.5">
                          <label className="block text-[10px] font-bold text-zinc-800 dark:text-zinc-200">
                            KM Atual
                          </label>
                        </div>
                        <input
                          id="input-km-atual"
                          type="text"
                          inputMode="decimal"
                          value={currentKm}
                          onChange={(e) => setCurrentKm(e.target.value)}
                          placeholder="Ex: 145600"
                          className="w-full h-8.5 px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-zinc-500 bg-white dark:bg-zinc-700/75 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-400 text-xs font-semibold focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 shadow-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Seção: Horímetro (Horas) */}
                  <div className="p-3 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-xs space-y-2">
                    <div className="flex items-center justify-between pb-1 border-b border-zinc-100 dark:border-zinc-700">
                      <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center space-x-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                        <span>Horímetro (Horas)</span>
                      </span>
                      {isFirstRecordHour ? (
                        <span className="text-[9px] font-semibold text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 px-1.5 py-0.2 rounded">
                          Registro Inicial
                        </span>
                      ) : (litersNumber > 0 && displayLitersPerHour !== null) ? (
                        <span className="text-[9px] font-black text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/20 border border-amber-200 dark:border-amber-500/40 px-1.5 py-0.2 rounded font-mono">
                          Média: {displayLitersPerHour.toFixed(2).replace('.', ',')} L/h
                        </span>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="flex items-center justify-between mb-0.5">
                          <label className="block text-[10px] font-semibold text-zinc-600 dark:text-zinc-300">
                            Horas Anterior
                          </label>
                          {!isFirstRecordHour && previousHourMeter ? (
                            <span className="text-[10px] text-zinc-400 flex items-center space-x-0.5">
                              <History className="w-3 h-3" />
                            </span>
                          ) : null}
                        </div>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={isFirstRecordHour ? '' : previousHourMeter}
                          onChange={(e) => setPreviousHourMeter(e.target.value)}
                          disabled={isFirstRecordHour}
                          placeholder={isFirstRecordHour ? "1º registro" : "Ex: 198"}
                          className={`w-full h-8.5 px-2.5 py-1 rounded-lg border text-xs font-semibold focus:outline-none transition ${
                            isFirstRecordHour
                              ? 'border-zinc-200 dark:border-zinc-600/80 bg-zinc-50 dark:bg-zinc-700/35 text-zinc-400 dark:text-zinc-500 cursor-not-allowed select-none placeholder:text-zinc-400'
                              : 'border-zinc-300 dark:border-zinc-500 bg-white dark:bg-zinc-700/75 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:border-amber-500 dark:focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20'
                          }`}
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-0.5">
                          <label className="block text-[10px] font-bold text-zinc-800 dark:text-zinc-200">
                            Horas Atual
                          </label>
                        </div>
                        <input
                          id="input-horas-atual"
                          type="text"
                          inputMode="decimal"
                          value={currentHourMeter}
                          onChange={(e) => setCurrentHourMeter(e.target.value)}
                          placeholder="Ex: 250"
                          className="w-full h-8.5 px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-zinc-500 bg-white dark:bg-zinc-700/75 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-400 text-xs font-semibold focus:outline-none focus:border-amber-500 dark:focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 shadow-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Combustível, Litros Abastecidos, Preço / Litro e Valor Total Calculado */}
                <div className="p-3 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-xs space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {/* Combustível (Dropdown Dinâmico lendo de public.estoque_produtos) */}
                    <div>
                      <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-0.5">
                        Combustível <span className="text-rose-500">*</span>
                      </label>
                      <select
                        id="select-combustivel-estoque"
                        value={selectedFuelProductId}
                        onChange={(e) => handleFuelProductChange(e.target.value)}
                        className="w-full h-8.5 px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-zinc-500 bg-white dark:bg-zinc-700/75 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white text-xs font-bold focus:outline-none focus:border-amber-500 dark:focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 cursor-pointer shadow-xs"
                      >
                        {fuelStockProducts.map((p) => {
                          const nomeExibicao = p.nome_comercial || p.name || 'Combustível';
                          return (
                            <option key={p.id} value={p.id}>
                              {nomeExibicao}
                            </option>
                          );
                        })}
                        {fuelStockProducts.length === 0 && (
                          <>
                            <option value="prod_diesel_s10">Diesel S10</option>
                            <option value="prod_diesel_s500">Diesel S500</option>
                            <option value="prod_arla_32">Arla 32 (Granel / Litro)</option>
                          </>
                        )}
                      </select>
                    </div>

                    {/* Litros Abastecidos */}
                    <div>
                      <label className="block text-xs font-bold text-amber-700 dark:text-amber-300 mb-0.5">
                        Litros Abastecidos <span className="text-rose-500">*</span>
                      </label>
                      <input
                        id="input-litros-abastecidos"
                        type="text"
                        inputMode="decimal"
                        value={liters}
                        onChange={(e) => handleLitersChange(e.target.value)}
                        placeholder="Ex: 250"
                        className="w-full h-8.5 px-2.5 py-1 rounded-lg border-2 border-amber-500/80 bg-amber-50/40 dark:bg-zinc-700/85 hover:bg-amber-50/70 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-300 text-xs font-bold focus:outline-none focus:border-amber-500 dark:focus:border-amber-400 focus:ring-2 focus:ring-amber-500/30 pointer-events-auto shadow-xs"
                      />
                    </div>

                    {/* Preço por Litro */}
                    <div>
                      <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-0.5">
                        Preço / Litro (R$)
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={pricePerLiter}
                        onChange={(e) => handlePriceChange(e.target.value)}
                        placeholder="Ex: 5.85"
                        className="w-full h-8.5 px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-zinc-500 bg-white dark:bg-zinc-700/75 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-400 text-xs font-semibold focus:outline-none focus:border-amber-500 dark:focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 shadow-xs"
                      />
                    </div>
                  </div>

                  {/* Total Financeiro Formatado no Padrão R$ #.##0,00 */}
                  <div className="py-1.5 px-3 bg-amber-50/70 dark:bg-zinc-700/60 border border-amber-200 dark:border-zinc-600 rounded-lg flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-zinc-700 dark:text-zinc-200 text-xs font-bold">
                      <Calculator className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span>Valor Total Calculado:</span>
                    </div>
                    <div className="text-sm sm:text-base font-black text-amber-600 dark:text-amber-400 font-['Outfit']">
                      R$ {totalAmount ? parseFloat(totalAmount).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'}
                    </div>
                  </div>
                </div>

                {/* 4. Origem do Combustível & Integração com o Financeiro (Contas a Pagar) */}
                <div className="p-3 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-xs space-y-2">
                  <div className="flex items-center justify-between pb-1 border-b border-zinc-100 dark:border-zinc-700">
                    <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center space-x-1.5">
                      <Droplets className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span>Origem do Combustível <span className="text-rose-500">*</span></span>
                    </label>
                    <span className="text-[9px] font-bold px-2 py-0.2 rounded-full bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-600">
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
                    className="w-full h-8.5 px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-zinc-500 bg-white dark:bg-zinc-700/75 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white text-xs font-bold focus:outline-none focus:border-amber-500 dark:focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 cursor-pointer shadow-xs"
                  >
                    <option value="Tanque Interno (Fazenda)">Tanque Interno (Fazenda)</option>
                    <option value="Posto Conveniado (Faturado)">Posto Conveniado (Faturado)</option>
                    <option value="Posto de Viagem (Pago na Hora)">Posto de Viagem (Pago na Hora)</option>
                  </select>

                  {/* CASO 1: Tanque Interno da Fazenda */}
                  {fuelOrigin === 'Tanque Interno (Fazenda)' && (
                    <div className="space-y-1.5 pt-1.5 border-t border-zinc-100 dark:border-zinc-700">
                      <div>
                        <div className="flex items-center justify-between mb-0.5">
                          <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center space-x-1.5">
                            <Warehouse className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            <span>Tanque da Fazenda (Tabela tanques_combustivel) <span className="text-rose-500">*</span></span>
                          </label>
                          <button
                            type="button"
                            onClick={() => openTankConfigModal(selectedTanque || tanques[0])}
                            title="Configurar Capacidade do Tanque (Supabase)"
                            className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 bg-amber-100/70 dark:bg-amber-500/20 hover:bg-amber-200 dark:hover:bg-amber-500/30 border border-amber-300 dark:border-amber-500/40 transition cursor-pointer shadow-2xs"
                          >
                            <Settings className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                            <span>⚙️ Configurar Capacidade</span>
                          </button>
                        </div>
                        <select
                          id="select-tanque-combustivel"
                          value={selectedTanqueId}
                          onChange={(e) => {
                            const tId = e.target.value;
                            if (tId === '__configurar_capacidade__') {
                              openTankConfigModal(selectedTanque || tanques[0]);
                              return;
                            }
                            setSelectedTanqueId(tId);
                            const t = tanques.find(item => item.id === tId);
                            if (t) {
                              setSupplierStation(t.nome);
                              // Sincroniza o combustível selecionado a partir do tanque
                              if (t.produto_id) {
                                const p = fuelStockProducts.find(item => item.id === t.produto_id);
                                if (p) {
                                  setSelectedFuelProductId(p.id);
                                  setFuelType((p.nome_comercial || p.name) as any);
                                }
                              } else {
                                const isS500 = t.tipo_combustivel?.toLowerCase().includes('s500') || t.nome.toLowerCase().includes('s500');
                                const isArla = t.tipo_combustivel?.toLowerCase().includes('arla') || t.nome.toLowerCase().includes('arla');
                                const matched = fuelStockProducts.find(item => {
                                  const nm = (item.nome_comercial || item.name || '').toLowerCase();
                                  if (isS500) return nm.includes('s500') || nm.includes('comum');
                                  if (isArla) return nm.includes('arla');
                                  return nm.includes('s10');
                                });
                                if (matched) {
                                  setSelectedFuelProductId(matched.id);
                                  setFuelType((matched.nome_comercial || matched.name) as any);
                                }
                              }
                            }
                          }}
                          className="w-full h-8.5 px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-zinc-500 bg-white dark:bg-zinc-700/75 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white text-xs font-semibold focus:outline-none focus:border-amber-500 dark:focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 cursor-pointer shadow-xs"
                        >
                          {tanques.map((t) => {
                            const pct = t.capacidade_total > 0 ? ((t.quantidade_atual / t.capacidade_total) * 100).toFixed(1) : '0.0';
                            return (
                              <option key={t.id} value={t.id}>
                                {t.nome} - Saldo: {t.quantidade_atual.toLocaleString('pt-BR')} L / {t.capacidade_total.toLocaleString('pt-BR')} L ({pct}%)
                              </option>
                            );
                          })}
                          <option value="__configurar_capacidade__">⚙️ Configurar Capacidade do Tanque...</option>
                        </select>
                      </div>

                      <p className="text-[10px] text-zinc-500 dark:text-zinc-300 leading-snug px-0.5">
                        <strong className="text-zinc-800 dark:text-zinc-100 font-semibold">{selectedTanque?.nome || 'Tanque Principal'}:</strong> subtrai os litros de <code className="font-mono text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-zinc-800 px-1 py-0.2 rounded">quantidade_atual</code> e vincula o estoque interno.
                      </p>
                    </div>
                  )}

                  {/* CASO 2: Posto Conveniado (Faturado) */}
                  {fuelOrigin === 'Posto Conveniado (Faturado)' && (
                    <div className="space-y-1.5 pt-1.5 border-t border-zinc-100 dark:border-zinc-700">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-0.5 flex items-center space-x-1">
                            <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
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
                                className="w-full h-8.5 px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-zinc-500 bg-white dark:bg-zinc-700/75 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white text-xs font-medium focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 cursor-pointer shadow-xs"
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
                                  className="w-full h-8.5 px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-zinc-500 bg-white dark:bg-zinc-700/75 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-400 text-xs font-medium focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 shadow-xs"
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
                              className="w-full h-8.5 px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-zinc-500 bg-white dark:bg-zinc-700/75 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-400 text-xs font-medium focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 shadow-xs"
                            />
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-0.5 flex items-center space-x-1">
                            <Calendar className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-300" />
                            <span>Vencimento da Fatura</span>
                          </label>
                          <input
                            type="date"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            className="w-full h-8.5 px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-zinc-500 bg-white dark:bg-zinc-700/75 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white text-xs font-medium focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 cursor-pointer shadow-xs"
                          />
                        </div>
                      </div>

                      <p className="text-[10px] text-zinc-500 dark:text-zinc-300 leading-snug px-0.5">
                        <strong className="text-zinc-800 dark:text-zinc-100 font-semibold">Contas a Pagar (Pendente):</strong> registra lançamento vinculado ao fornecedor e ao DRE do veículo.
                      </p>
                    </div>
                  )}

                  {/* CASO 3: Posto de Viagem (Pago na Hora) */}
                  {fuelOrigin === 'Posto de Viagem (Pago na Hora)' && (
                    <div className="space-y-1.5 pt-1.5 border-t border-zinc-100 dark:border-zinc-700">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-0.5 flex items-center space-x-1">
                            <CreditCard className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>Pagamento <span className="text-rose-500">*</span></span>
                          </label>
                          <select
                            value={paymentMethod}
                            onChange={(e) => {
                              setPaymentMethod(e.target.value);
                              setValidationError('');
                            }}
                            className="w-full h-8.5 px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-zinc-500 bg-white dark:bg-zinc-700/75 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white text-xs font-medium focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400 cursor-pointer shadow-xs"
                          >
                            <option value="Pix">Pix</option>
                            <option value="Cartão">Cartão</option>
                            <option value="Dinheiro">Dinheiro</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-0.5 flex items-center space-x-1">
                            <Wallet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>Conta / Caixa <span className="text-rose-500">*</span></span>
                          </label>
                          <select
                            value={bankAccountId}
                            onChange={(e) => {
                              setBankAccountId(e.target.value);
                              setValidationError('');
                            }}
                            className="w-full h-8.5 px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-zinc-500 bg-white dark:bg-zinc-700/75 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white text-xs font-medium focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400 cursor-pointer shadow-xs"
                          >
                            <option value="">Selecione a Conta...</option>
                            {availableBankAccounts.map((acc) => (
                              <option key={acc.id} value={acc.id}>
                                {acc.name} ({formatCurrencyBRL(acc.balance || 0)})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-0.5">
                            Posto (Opcional)
                          </label>
                          <input
                            type="text"
                            value={supplierStation}
                            onChange={(e) => setSupplierStation(e.target.value)}
                            placeholder="Ex: Posto Rodovia..."
                            className="w-full h-8.5 px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-zinc-500 bg-white dark:bg-zinc-700/75 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-400 text-xs font-medium focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400 shadow-xs"
                          />
                        </div>
                      </div>

                      <p className="text-[10px] text-zinc-500 dark:text-zinc-300 leading-snug px-0.5">
                        <strong className="text-zinc-800 dark:text-zinc-100 font-semibold">Contas a Pagar (Pago):</strong> lança despesa liquidada deduzindo da conta selecionada e apropriando ao DRE.
                      </p>
                    </div>
                  )}
                </div>

                {/* 5. Motorista / Operador, Observações e Sincronização */}
                <div className="p-3 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-xs space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-0.5">
                        Motorista / Operador
                      </label>
                      <select
                        value={driverOrOperator}
                        onChange={(e) => setDriverOrOperator(e.target.value)}
                        className="w-full h-8.5 px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-zinc-500 bg-white dark:bg-zinc-700/75 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white text-xs font-medium focus:outline-none focus:border-amber-500 dark:focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 cursor-pointer shadow-xs"
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
                      <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-0.5">
                        Observações do Abastecimento
                      </label>
                      <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Ex: Abastecimento em trânsito safra..."
                        className="w-full h-8.5 px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-zinc-500 bg-white dark:bg-zinc-700/75 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-400 text-xs font-medium focus:outline-none focus:border-amber-500 dark:focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 shadow-xs"
                      />
                    </div>
                  </div>

                  {/* Sincronizar com Despesas */}
                  {!editingLog && (
                    <label className="flex items-center space-x-2 py-1.5 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700/50 hover:bg-zinc-100 dark:hover:bg-zinc-700/70 transition cursor-pointer">
                      <input
                        type="checkbox"
                        checked={createExpense}
                        onChange={(e) => setCreateExpense(e.target.checked)}
                        className="w-3.5 h-3.5 text-amber-500 rounded focus:ring-amber-500 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-500"
                      />
                      <div className="text-xs leading-snug">
                        <span className="font-bold text-zinc-900 dark:text-zinc-100">
                          Sincronizar lançamento financeiro & DRE do veículo
                        </span>
                        <span className="text-[11px] text-zinc-500 dark:text-zinc-300 ml-1.5 hidden sm:inline">
                          — Registra no Contas a Pagar conforme a Origem.
                        </span>
                      </div>
                    </label>
                  )}
                </div>

              </form>
            </div>

            {/* Painel Direito: Monitoramento do Fluxo de Combustível em Tempo Real (Origem -> Destino) */}
            <div className="lg:col-span-5 flex flex-col justify-between h-full gap-2">
              
              {/* 1. MONITORAMENTO DO ESTOQUE (Topo do Painel: ORIGEM) */}
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
                      // Sincroniza o combustível selecionado a partir do tanque
                      if (t.produto_id) {
                        const p = fuelStockProducts.find(item => item.id === t.produto_id);
                        if (p) {
                          setSelectedFuelProductId(p.id);
                          setFuelType((p.nome_comercial || p.name) as any);
                        }
                      } else {
                        const isS500 = t.tipo_combustivel?.toLowerCase().includes('s500') || t.nome.toLowerCase().includes('s500');
                        const isArla = t.tipo_combustivel?.toLowerCase().includes('arla') || t.nome.toLowerCase().includes('arla');
                        const matched = fuelStockProducts.find(item => {
                          const nm = (item.nome_comercial || item.name || '').toLowerCase();
                          if (isS500) return nm.includes('s500') || nm.includes('comum');
                          if (isArla) return nm.includes('arla');
                          return nm.includes('s10');
                        });
                        if (matched) {
                          setSelectedFuelProductId(matched.id);
                          setFuelType((matched.nome_comercial || matched.name) as any);
                        }
                      }
                    }
                  }}
                />
              ) : (
                <div className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 shadow-xs text-zinc-900 dark:text-zinc-100 space-y-2 select-none flex flex-col justify-between flex-1">
                  <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-700 pb-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-6.5 h-6.5 rounded-lg bg-amber-500/15 dark:bg-amber-500/20 border border-amber-500/30 dark:border-amber-500/40 flex items-center justify-center text-amber-600 dark:text-amber-400">
                        <Building2 className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <h4 className="text-[11px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider font-['Outfit']">
                          1. MONITORAMENTO DA ORIGEM
                        </h4>
                        <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate max-w-[220px] mt-0.5">
                          {supplierStation || fuelOrigin}
                        </p>
                      </div>
                    </div>
                    <span className="text-[9px] font-bold px-2 py-0.2 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-600">
                      {fuelOrigin === 'Posto Conveniado (Faturado)' ? 'Posto Conveniado' : 'Posto de Viagem'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-600 dark:text-zinc-300">Combustível Selecionado:</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400">{fuelType}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-700/60 border border-zinc-200 dark:border-zinc-600 flex items-center justify-between text-xs shadow-2xs">
                    <span className="text-zinc-700 dark:text-zinc-200 font-medium">Volume Solicitado:</span>
                    <span className="font-mono font-black text-amber-600 dark:text-amber-400 text-sm">
                      {liters && Number(liters.replace(',', '.')) > 0
                        ? `${Number(liters.replace(',', '.')).toLocaleString('pt-BR')} L`
                        : '0 L'}
                    </span>
                  </div>
                </div>
              )}

              {/* Indicador Visual do Fluxo de Combustível (Origem ➔ Destino) */}
              <div className="flex items-center justify-center shrink-0 my-0.5">
                <div className="flex items-center space-x-2 px-3 py-0.5 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 text-[10px] font-bold text-zinc-800 dark:text-zinc-200 shadow-2xs">
                  <span className="flex items-center text-amber-600 dark:text-amber-400 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse mr-1" />
                    {fuelOrigin === 'Tanque Interno (Fazenda)' 
                      ? (selectedTanque?.tipo_combustivel?.toLowerCase().includes('s500') ? 'Estoque S500' : 'Estoque S10') 
                      : 'Origem Externa'}
                  </span>
                  <ArrowDown className="w-3 h-3 text-zinc-400 dark:text-zinc-300 animate-bounce" />
                  <span className="flex items-center text-blue-600 dark:text-blue-400 font-semibold">
                    Destino: {selectedMachinery ? (selectedMachinery.licensePlateOrSerial || selectedMachinery.nome) : 'Veículo'}
                  </span>
                  {liters && Number(liters.replace(',', '.')) > 0 && (
                    <span className="ml-0.5 px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 font-mono text-[9px] border border-amber-300 dark:border-amber-500/40">
                      {liters} L
                    </span>
                  )}
                </div>
              </div>

              {/* 2. MONITORAMENTO DO VEÍCULO (Base do Painel: DESTINO) */}
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

            </div>

          </div>
        </div>

        {/* Rodapé com Ações Bem Definido */}
        <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border-t border-zinc-200 dark:border-zinc-700 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0 relative z-30 pointer-events-auto">
          <div className="w-full sm:w-auto">
            {validationError ? (
              <div className="flex items-center space-x-1.5 text-xs font-bold text-rose-500 animate-in fade-in">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                <span>{validationError}</span>
              </div>
            ) : isOverCapacity ? (
              <div className="flex items-center space-x-1.5 text-[11px] font-medium text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/15 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-500/40 animate-in fade-in">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500 dark:text-amber-400" />
                <span>Alerta visual: Projeção excede a capacidade (+{latestCalculation?.excessoLitros?.toFixed(1) || '0.0'} L). Salvamento liberado.</span>
              </div>
            ) : null}
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => onClose()}
              className="pointer-events-auto cursor-pointer px-3.5 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700/60 text-zinc-700 dark:text-zinc-200 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white transition shadow-2xs"
            >
              Cancelar
            </button>
            <button
              id="btn-salvar-abastecimento"
              type="submit"
              form="fuel-form"
              disabled={isLoading}
              className={`px-4 py-1.5 rounded-xl text-white text-xs font-bold shadow-xs transition flex items-center space-x-1.5 ${
                isLoading
                  ? 'opacity-50 cursor-not-allowed bg-zinc-400 dark:bg-zinc-600 pointer-events-none select-none'
                  : 'pointer-events-auto cursor-pointer bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700'
              }`}
            >
              <Save className="w-3.5 h-3.5 pointer-events-none" />
              <span>{isLoading ? 'Salvando...' : 'Salvar Abastecimento'}</span>
            </button>
          </div>
        </div>

      </div>

      {/* Sub-modal: Gerenciamento da Capacidade do Tanque (Supabase 'tanques_combustivel') */}
      {isTankConfigModalOpen && tankConfigTarget && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-3 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl max-w-md w-full shadow-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150 text-zinc-900 dark:text-zinc-100">
            
            {/* Cabeçalho */}
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/80">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/15 dark:bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <Settings className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-wider font-['Outfit']">
                    Configurar Capacidade do Tanque
                  </h3>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                    Tabela public.tanques_combustivel (Supabase)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTankConfigModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Corpo */}
            <div className="p-4 space-y-3.5 text-xs">
              {/* Badge Informativo do Tanque */}
              <div className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wide block">
                    Saldo Atual em Estoque
                  </span>
                  <span className="text-sm font-black text-amber-900 dark:text-amber-200 font-mono">
                    {Number(tankConfigTarget.quantidade_atual || 0).toLocaleString('pt-BR')} Litros
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white dark:bg-zinc-700 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 font-mono">
                    {tankConfigTarget.tipo_combustivel || 'Diesel'}
                  </span>
                  <span className="block text-[9px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    ID: {tankConfigTarget.id}
                  </span>
                </div>
              </div>

              {/* Nome do Tanque */}
              <div>
                <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-1">
                  Nome do Tanque
                </label>
                <input
                  type="text"
                  value={tankConfigName}
                  onChange={(e) => setTankConfigName(e.target.value)}
                  placeholder="Ex: Tanque Principal Diesel S10"
                  className="w-full h-9 px-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700/80 text-zinc-900 dark:text-white text-xs font-semibold focus:outline-none focus:border-amber-500 dark:focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 shadow-xs"
                />
              </div>

              {/* Capacidade Total (Litros) */}
              <div>
                <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-1">
                  Capacidade Total (Litros) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={tankConfigCapacity}
                    onChange={(e) => setTankConfigCapacity(e.target.value.replace(/[^0-9.,]/g, ''))}
                    placeholder="Ex: 15000"
                    className="w-full h-9 pl-3 pr-8 rounded-lg border-2 border-amber-500/70 bg-amber-50/20 dark:bg-zinc-700/80 text-zinc-900 dark:text-white text-xs font-bold focus:outline-none focus:border-amber-500 dark:focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 shadow-xs"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-bold text-zinc-500 dark:text-zinc-400 pointer-events-none">
                    L
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">
                  Define o limite máximo (100%) utilizado no cálculo da porcentagem e no desenho do tanque horizontal.
                </p>
              </div>

              {tankConfigError && (
                <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/35 text-[11px] font-bold text-rose-600 dark:text-rose-300 flex items-center space-x-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{tankConfigError}</span>
                </div>
              )}
            </div>

            {/* Rodapé com botões */}
            <div className="px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/80 border-t border-zinc-200 dark:border-zinc-700 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsTankConfigModalOpen(false)}
                disabled={isSavingTankConfig}
                className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-600 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveTankCapacity}
                disabled={isSavingTankConfig}
                className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-xs transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingTankConfig ? 'Salvando...' : 'Salvar Capacidade'}</span>
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
