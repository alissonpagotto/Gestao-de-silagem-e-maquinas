import React, { useState, useEffect, useMemo } from 'react';
import { X, Fuel, Save, Calculator, Gauge, Clock, History, AlertTriangle, Sparkles } from 'lucide-react';
import { FuelLog, Machinery, Employee } from '../../types';
import { FuelTankVisualizer } from './FuelTankVisualizer';
import { FuelCalculationResult } from '../../lib/fuelCalculation';
import { calculateVehicleConsumptionMetrics } from '../../lib/fleetMetrics';
import { fetchGestaoFrotas, fetchCloudFuelLogs } from '../../lib/supabaseService';

interface FuelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (fuelLog: FuelLog, createExpense: boolean) => void;
  editingLog: FuelLog | null;
  machineries: Machinery[];
  employees: Employee[];
  fuelLogs?: FuelLog[];
  initialMachineryId?: string;
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
}) => {
  // Estado local para veículos e abastecimentos carregados via HTTP padrão (REST)
  const [dbMachineries, setDbMachineries] = useState<Machinery[]>([]);
  const [dbFuelLogs, setDbFuelLogs] = useState<FuelLog[]>([]);

  // Lista unificada de veículos (prioriza dados atualizados do banco mantendo props locais de fallback)
  const availableMachineries = useMemo(() => {
    let list: Machinery[] = propMachineries;
    if (dbMachineries.length > 0) {
      // Mescla garantindo que todos os veículos apareçam
      const map = new Map<string, Machinery>();
      propMachineries.forEach(m => map.set(m.id, m));
      dbMachineries.forEach(m => map.set(m.id, { ...(map.get(m.id) || {}), ...m }));
      list = Array.from(map.values());
    }
    return list.map((v) => ({
      ...v,
      nome: v.nome || (v.licensePlateOrSerial 
        ? `[${v.licensePlateOrSerial}] ${v.brand ? `${v.brand} ` : ''}${v.model || v.name || 'Veículo'}`
        : (v.brand ? `${v.brand} ` : '') + (v.model || v.name || 'Veículo'))
    }));
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
  const [supplierStation, setSupplierStation] = useState('Tanque da Fazenda');
  const [notes, setNotes] = useState('');
  const [createExpense, setCreateExpense] = useState(true);
  const [latestCalculation, setLatestCalculation] = useState<FuelCalculationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
    };

    loadGestaoFrotasHttp();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

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

  // Trava de segurança: Bloqueia o botão Salvar se o abastecimento ultrapassar a capacidade do tanque
  const isOverCapacity = useMemo(() => {
    if (latestCalculation?.isOverflowing) return true;

    const capacidadeTanque = Number(
      (selectedMachinery as any)?.tank_capacity ?? 
      (selectedMachinery as any)?.tankCapacity ?? 
      selectedMachinery?.fuelCapacityLiters ?? 0
    );
    const litrosAbastecidos = parseFloat(liters) || 0;
    const nivelAtual = latestCalculation ? latestCalculation.nivelAtual : 0;

    return capacidadeTanque > 0 && (nivelAtual + litrosAbastecidos) > capacidadeTanque;
  }, [latestCalculation, selectedMachinery, liters]);

  // Inicialização síncrona imediata ao abrir o modal (inputs livres desde o milissegundo 0)
  useEffect(() => {
    if (!isOpen) return;

    if (editingLog) {
      setDate(editingLog.date);
      setMachineryId(editingLog.machineryId);
      setFuelType(editingLog.fuelType);
      setLiters(String(editingLog.liters || ''));
      setPricePerLiter(String(editingLog.pricePerLiter || '5.85'));
      setTotalAmount(String(editingLog.totalAmount || ''));
      
      setCurrentKm(editingLog.currentKm !== undefined && editingLog.currentKm !== null ? String(editingLog.currentKm) : (editingLog.currentHourMeterOrKm && editingLog.currentHourMeterOrKm > 50000 ? String(editingLog.currentHourMeterOrKm) : ''));
      setPreviousKm(editingLog.previousKm !== undefined && editingLog.previousKm !== null ? String(editingLog.previousKm) : (editingLog.previousHourMeterOrKm && editingLog.previousHourMeterOrKm > 50000 ? String(editingLog.previousHourMeterOrKm) : ''));
      
      setCurrentHourMeter(editingLog.currentHourMeter !== undefined && editingLog.currentHourMeter !== null ? String(editingLog.currentHourMeter) : (editingLog.currentHourMeterOrKm && editingLog.currentHourMeterOrKm <= 50000 ? String(editingLog.currentHourMeterOrKm) : ''));
      setPreviousHourMeter(editingLog.previousHourMeter !== undefined && editingLog.previousHourMeter !== null ? String(editingLog.previousHourMeter) : (editingLog.previousHourMeterOrKm && editingLog.previousHourMeterOrKm <= 50000 ? String(editingLog.previousHourMeterOrKm) : ''));
      
      setDriverOrOperator(editingLog.driverOrOperator || '');
      setSupplierStation(editingLog.supplierStation || 'Tanque da Fazenda');
      setNotes(editingLog.notes || '');
      setCreateExpense(false);
    } else {
      // Novo Registro de Abastecimento
      setDate(new Date().toISOString().split('T')[0]);
      setFuelType('Diesel S10');
      setLiters('');
      setPricePerLiter('5.85');
      setTotalAmount('');
      setCurrentKm('');
      setCurrentHourMeter('');
      setSupplierStation('Tanque da Fazenda');
      setNotes('');
      setCreateExpense(true);

      const cleanInitialId = typeof initialMachineryId === 'string' ? initialMachineryId : '';
      const targetId = cleanInitialId || (availableMachineries.length > 0 ? availableMachineries[0].id : '');
      setMachineryId(typeof targetId === 'string' ? targetId : '');

      const mach = availableMachineries.find(m => m.id === targetId);
      if (mach) {
        const initKm = mach.currentKm ?? (mach as any).km_inicial ?? (mach as any).initialKm ?? (mach as any).horimetro_ou_km_atual;
        const initHours = mach.hourMeter ?? (mach as any).horimetro_inicial ?? (mach as any).initialHourMeter ?? (mach as any).horimetro_ou_km_atual;

        const prevLogs = (activeFuelLogs || [])
          .filter(l => l.machineryId === targetId)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const lastLog = prevLogs[0];

        const finalKm = lastLog?.currentKm !== undefined && lastLog.currentKm !== null 
          ? String(lastLog.currentKm) 
          : (initKm !== undefined && initKm !== null && Number(initKm) > 0 ? String(initKm) : '');

        const finalHours = lastLog?.currentHourMeter !== undefined && lastLog.currentHourMeter !== null 
          ? String(lastLog.currentHourMeter) 
          : (initHours !== undefined && initHours !== null && Number(initHours) > 0 ? String(initHours) : '');

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

    const initKm = mach.currentKm ?? (mach as any).km_inicial ?? (mach as any).initialKm ?? (mach as any).horimetro_ou_km_atual;
    const initHours = mach.hourMeter ?? (mach as any).horimetro_inicial ?? (mach as any).initialHourMeter ?? (mach as any).horimetro_ou_km_atual;

    const prevLogs = (activeFuelLogs || [])
      .filter((l) => l.machineryId === id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const lastLog = prevLogs[0];

    const prevKmFinal = lastLog?.currentKm !== undefined && lastLog.currentKm !== null
      ? String(lastLog.currentKm)
      : (initKm !== undefined && initKm !== null && Number(initKm) > 0 ? String(initKm) : '');

    const prevHourFinal = lastLog?.currentHourMeter !== undefined && lastLog.currentHourMeter !== null
      ? String(lastLog.currentHourMeter)
      : (initHours !== undefined && initHours !== null && Number(initHours) > 0 ? String(initHours) : '');

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
    const l = parseFloat(litersVal);
    const p = parseFloat(priceVal);
    if (!isNaN(l) && !isNaN(p) && l > 0 && p > 0) {
      setTotalAmount((l * p).toFixed(2));
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

  // 1. VALIDAÇÃO DE REGISTRO INICIAL (Primeiro Abastecimento de Veículo / Máquina)
  // Quando um veículo é novo no sistema, KM Anterior ou Horas Anterior vêm nulos, vazios ou zero.
  const isFirstRecordHour = useMemo(() => {
    const val = parseFloat(previousHourMeter);
    return !previousHourMeter || isNaN(val) || val === 0;
  }, [previousHourMeter]);

  const isFirstRecordKm = useMemo(() => {
    const val = parseFloat(previousKm);
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

  // 2. CÁLCULO DE MÉDIAS EM TEMPO REAL
  // Se isFirstRecord for verdadeiro, o sistema NÃO tenta calcular a diferença nem subtrair consumo do nível do tanque.
  // O consumo e médias são definidos temporariamente como nulos / 0 para este lançamento.
  const calculatedMetrics = useMemo(() => {
    if (isFirstRecord) {
      return { kmPerLiter: null, litersPerHour: null };
    }

    const l = parseFloat(liters) || 0;
    
    // Média KM: km/L
    let kmPerLiter: number | null = null;
    if (!isFirstRecordKm) {
      const cKm = parseFloat(currentKm);
      const pKm = parseFloat(previousKm);
      if (!isNaN(cKm) && !isNaN(pKm) && cKm > pKm && l > 0) {
        kmPerLiter = parseFloat(((cKm - pKm) / l).toFixed(2));
      }
    }

    // Média Horas: L/h
    let litersPerHour: number | null = null;
    if (!isFirstRecordHour) {
      const cHour = parseFloat(currentHourMeter);
      const pHour = parseFloat(previousHourMeter);
      if (!isNaN(cHour) && !isNaN(pHour) && cHour > pHour && l > 0) {
        litersPerHour = parseFloat((l / (cHour - pHour)).toFixed(2));
      }
    }

    return { kmPerLiter, litersPerHour };
  }, [isFirstRecord, isFirstRecordKm, isFirstRecordHour, liters, currentKm, previousKm, currentHourMeter, previousHourMeter]);

  const displayLitersPerHour = isFirstRecord || isFirstRecordHour ? null : (calculatedMetrics.litersPerHour ?? historicalAvgLitersPerHour);
  const displayKmPerLiter = isFirstRecord || isFirstRecordKm ? null : (calculatedMetrics.kmPerLiter ?? historicalAvgKmPerLiter);

  const handleSubmit = (e?: React.FormEvent | React.MouseEvent) => {
    if (e && 'preventDefault' in e) {
      e.preventDefault();
    }
    console.log("Botão Salvar Clicado");
    const l = parseFloat(liters);
    const p = parseFloat(pricePerLiter);
    const t = parseFloat(totalAmount) || (l * (isNaN(p) ? 0 : p));
    
    const currK = parseFloat(currentKm);
    const prevK = parseFloat(previousKm);
    const currH = parseFloat(currentHourMeter);
    const prevH = parseFloat(previousHourMeter);

    const effectiveMachineryId = machineryId || (availableMachineries.length > 0 ? availableMachineries[0].id : '');

    if (!effectiveMachineryId) {
      console.warn("Validação: selecione um veículo.");
      return;
    }

    if (isNaN(l) || l <= 0) {
      console.warn("Validação: informe a quantidade de litros.");
      const inputLiters = document.querySelector('input[placeholder="Ex: 250"]') as HTMLInputElement;
      if (inputLiters) inputLiters.focus();
      return;
    }

    if (isOverCapacity) {
      console.warn("Validação: O volume total ultrapassa a capacidade máxima do tanque.");
      return;
    }

    const currentSelected = availableMachineries.find((m) => m.id === effectiveMachineryId) || selectedMachinery;

    const machName = currentSelected 
      ? (currentSelected.licensePlateOrSerial ? `[${currentSelected.licensePlateOrSerial}] - ${currentSelected.model || currentSelected.name}` : currentSelected.name)
      : 'Veículo';

    const log: FuelLog = {
      id: editingLog ? editingLog.id : `fuel_${Date.now()}`,
      date: date || new Date().toISOString().split('T')[0],
      machineryId: effectiveMachineryId,
      machineryPlateOrName: machName,
      fuelType,
      liters: l,
      pricePerLiter: !isNaN(p) && p > 0 ? p : 0,
      totalAmount: !isNaN(t) && t > 0 ? t : (l * (!isNaN(p) && p > 0 ? p : 0)),
      currentHourMeterOrKm: !isNaN(currH) && currH > 0 ? currH : (!isNaN(currK) ? currK : 0),
      previousHourMeterOrKm: isFirstRecord ? 0 : (!isNaN(prevH) && prevH > 0 ? prevH : (!isNaN(prevK) ? prevK : undefined)),
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
      supplierStation: supplierStation.trim(),
      notes: notes.trim() || undefined,
      expenseId: editingLog?.expenseId,
      createdAt: editingLog?.createdAt || new Date().toISOString(),
    };

    onSave(log, createExpense && !editingLog);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-zinc-950/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-stone-900 rounded-2xl max-w-5xl w-full shadow-2xl border border-zinc-300 dark:border-stone-700 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Cabeçalho */}
        <div className="px-6 py-4 bg-zinc-800 text-white flex items-center justify-between border-b border-zinc-700 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-700 flex items-center justify-center text-white shadow-xs">
              <Fuel className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-['Outfit']">
                {editingLog ? 'Editar Abastecimento' : 'Novo Registro de Abastecimento'}
              </h3>
              <p className="text-xs text-zinc-300">
                Controle de combustível com cálculo automático de média por KM (km/L) e por Horas (L/h)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onClose()}
            className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-300 hover:text-white transition cursor-pointer pointer-events-auto"
          >
            <X className="w-5 h-5 text-white pointer-events-none" />
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="overflow-y-auto flex-1 bg-white dark:bg-stone-900">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 sm:p-6 items-start">
            
            {/* Formulário à Esquerda (Todos os inputs 100% livres para digitação manual) */}
            <div className="lg:col-span-7">
              <form id="fuel-form" noValidate onSubmit={handleSubmit} className="space-y-4">
                
                {/* 1. Veículo / Máquina e Data do Abastecimento */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                      Veículo / Máquina <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={machineryId}
                      onChange={(e) => handleSelecaoVeiculo(e.target.value)}
                      className="w-full p-2 border border-stone-300 dark:border-stone-700 rounded bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 pointer-events-auto cursor-pointer"
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
                    <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                      Data do Abastecimento <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs pointer-events-auto"
                    />
                  </div>
                </div>

                {/* Banner Informativo: Primeiro Abastecimento */}
                {isFirstRecord && (
                  <div className="p-3 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-start space-x-2.5 text-xs text-amber-900 dark:text-amber-200 shadow-2xs">
                    <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">Primeiro Abastecimento Detectado</span>
                      <span className="text-amber-800/90 dark:text-amber-300/90 text-[11px] leading-relaxed">
                        Este é o registro inicial deste veículo no sistema. O cálculo de consumo foi desativado temporariamente (0L) e o nível do tanque partirá de 0L. Preencha apenas a leitura atual, que servirá como base para os próximos abastecimentos.
                      </span>
                    </div>
                  </div>
                )}

                {/* 2. Odômetro / Quilometragem (KM) e Horímetro (Horas de Motor) */}
                <div className="space-y-3">
                  {/* Seção: Quilometragem (KM) */}
                  <div className="p-3.5 bg-stone-50 dark:bg-stone-800/40 rounded-xl border border-stone-200 dark:border-stone-700/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center space-x-1.5">
                        <Gauge className="w-4 h-4 text-emerald-600" />
                        <span>Odômetro / Quilometragem (KM)</span>
                      </span>
                      {isFirstRecordKm ? (
                        <span className="text-[10px] font-semibold text-stone-600 dark:text-stone-400 bg-stone-200/80 dark:bg-stone-700/80 px-2 py-0.5 rounded-md">
                          Registro Inicial
                        </span>
                      ) : displayKmPerLiter !== null ? (
                        <span className="text-xs font-black text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded-md">
                          Média: {displayKmPerLiter} km/L
                        </span>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[11px] font-semibold text-stone-600 dark:text-stone-400">
                            KM Anterior
                          </label>
                          {isFirstRecordKm ? (
                            <span 
                              className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/70 px-1.5 py-0.5 rounded flex items-center space-x-1"
                              title="Primeiro registro deste veículo - campo desabilitado"
                            >
                              <span>Primeiro registro</span>
                            </span>
                          ) : previousKm ? (
                            <span 
                              className="text-[10px] font-medium text-stone-500 dark:text-stone-400 flex items-center space-x-1"
                              title="Leitura anterior do veículo"
                            >
                              <History className="w-2.5 h-2.5" />
                              <span>Anterior</span>
                            </span>
                          ) : null}
                        </div>
                        <input
                          type="number"
                          step="any"
                          value={isFirstRecordKm ? '' : previousKm}
                          onChange={(e) => setPreviousKm(e.target.value)}
                          disabled={isFirstRecordKm}
                          placeholder={isFirstRecordKm ? "Primeiro registro" : "Ex: 145000"}
                          className={`w-full px-3 py-1.5 rounded-lg border text-xs sm:text-sm font-medium focus:outline-none transition ${
                            isFirstRecordKm
                              ? 'border-stone-200 dark:border-stone-700/60 bg-stone-100/80 dark:bg-stone-800/60 text-stone-400 dark:text-stone-500 cursor-not-allowed select-none placeholder:text-stone-400 dark:placeholder:text-stone-500'
                              : 'border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-emerald-500'
                          }`}
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[11px] font-semibold text-stone-600 dark:text-stone-400">
                            KM Atual no Abastecimento
                          </label>
                          {isFirstRecordKm && (
                            <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                              Base para os próximos
                            </span>
                          )}
                        </div>
                        <input
                          type="number"
                          step="any"
                          value={currentKm}
                          onChange={(e) => setCurrentKm(e.target.value)}
                          placeholder="Ex: 145600"
                          className="w-full px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Seção: Horímetro (Horas) */}
                  <div className="p-3.5 bg-stone-50 dark:bg-stone-800/40 rounded-xl border border-stone-200 dark:border-stone-700/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center space-x-1.5">
                        <Clock className="w-4 h-4 text-amber-600" />
                        <span>Horímetro (Horas de Motor)</span>
                      </span>
                      {isFirstRecordHour ? (
                        <span className="text-[10px] font-semibold text-stone-600 dark:text-stone-400 bg-stone-200/80 dark:bg-stone-700/80 px-2 py-0.5 rounded-md">
                          Registro Inicial
                        </span>
                      ) : displayLitersPerHour !== null ? (
                        <span className="text-xs font-black text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 px-2 py-0.5 rounded-md">
                          Média: {displayLitersPerHour} L/h
                        </span>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[11px] font-semibold text-stone-600 dark:text-stone-400">
                            Horas Anterior
                          </label>
                          {isFirstRecordHour ? (
                            <span 
                              className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/70 px-1.5 py-0.5 rounded flex items-center space-x-1"
                              title="Primeiro registro desta máquina - campo desabilitado"
                            >
                              <span>Primeiro registro</span>
                            </span>
                          ) : previousHourMeter ? (
                            <span 
                              className="text-[10px] font-medium text-stone-500 dark:text-stone-400 flex items-center space-x-1"
                              title="Leitura anterior do veículo"
                            >
                              <History className="w-2.5 h-2.5" />
                              <span>Anterior</span>
                            </span>
                          ) : null}
                        </div>
                        <input
                          type="number"
                          step="any"
                          value={isFirstRecordHour ? '' : previousHourMeter}
                          onChange={(e) => setPreviousHourMeter(e.target.value)}
                          disabled={isFirstRecordHour}
                          placeholder={isFirstRecordHour ? "Primeiro registro" : "Ex: 198"}
                          className={`w-full px-3 py-1.5 rounded-lg border text-xs sm:text-sm font-medium focus:outline-none transition ${
                            isFirstRecordHour
                              ? 'border-stone-200 dark:border-stone-700/60 bg-stone-100/80 dark:bg-stone-800/60 text-stone-400 dark:text-stone-500 cursor-not-allowed select-none placeholder:text-stone-400 dark:placeholder:text-stone-500'
                              : 'border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-amber-500'
                          }`}
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[11px] font-semibold text-stone-600 dark:text-stone-400">
                            Horas Atual no Abastecimento
                          </label>
                          {isFirstRecordHour && (
                            <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                              Base para os próximos
                            </span>
                          )}
                        </div>
                        <input
                          type="number"
                          step="any"
                          value={currentHourMeter}
                          onChange={(e) => setCurrentHourMeter(e.target.value)}
                          placeholder="Ex: 250"
                          className="w-full px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Combustível, Litros Abastecidos, Preço / Litro e Total */}
                <div className="space-y-3.5 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    {/* Combustível */}
                    <div>
                      <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                        Combustível
                      </label>
                      <select
                        value={fuelType}
                        onChange={(e) => setFuelType(e.target.value as any)}
                        className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
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
                      <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                        Litros Abastecidos <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={liters}
                        onChange={(e) => handleLitersChange(e.target.value)}
                        placeholder="Ex: 250"
                        className="w-full px-3.5 py-2 rounded-xl border border-amber-300 dark:border-amber-700/80 bg-amber-50/30 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs pointer-events-auto"
                      />
                    </div>

                    {/* Preço por Litro */}
                    <div>
                      <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                        Preço / Litro (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={pricePerLiter}
                        onChange={(e) => handlePriceChange(e.target.value)}
                        placeholder="Ex: 5.85"
                        className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
                      />
                    </div>
                  </div>

                  {/* Total Financeiro Formatado no Padrão R$ #.##0,00 */}
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-amber-800 dark:text-amber-300 text-xs font-semibold">
                      <Calculator className="w-4 h-4" />
                      <span>Valor Total Calculado:</span>
                    </div>
                    <div className="text-lg font-black text-amber-900 dark:text-amber-200 font-['Outfit']">
                      R$ {totalAmount ? parseFloat(totalAmount).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'}
                    </div>
                  </div>
                </div>

                {/* 4. Motorista / Operador e Local / Posto */}
                <div className="space-y-3.5 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                        Motorista / Operador
                      </label>
                      <select
                        value={driverOrOperator}
                        onChange={(e) => setDriverOrOperator(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
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
                      <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                        Local / Posto de Abastecimento
                      </label>
                      <input
                        type="text"
                        value={supplierStation}
                        onChange={(e) => setSupplierStation(e.target.value)}
                        placeholder="Ex: Tanque da Fazenda, Posto Trevo..."
                        className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
                      />
                    </div>
                  </div>

                  {/* Sincronizar com Despesas */}
                  {!editingLog && (
                    <label className="flex items-center space-x-2.5 p-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={createExpense}
                        onChange={(e) => setCreateExpense(e.target.checked)}
                        className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                      />
                      <div className="text-xs">
                        <span className="font-bold text-stone-900 dark:text-stone-100 block">
                          Lançar automaticamente nas Despesas Financeiras (DRE)
                        </span>
                        <span className="text-stone-500 dark:text-stone-400">
                          Cria lançamento de despesa em "Combustível" vinculado ao veículo.
                        </span>
                      </div>
                    </label>
                  )}
                </div>

              </form>
            </div>

            {/* Visualizador do Tanque à Direita */}
            <div className="lg:col-span-5 lg:sticky lg:top-0">
              <FuelTankVisualizer 
                machinery={selectedMachinery}
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

        {/* Rodapé com Ações */}
        <div className="px-6 py-3.5 bg-zinc-50 dark:bg-stone-800/80 border-t border-zinc-200 dark:border-stone-700 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 relative z-30 pointer-events-auto">
          <div className="w-full sm:w-auto">
            {isOverCapacity && (
              <div className="flex items-center space-x-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Capacidade do tanque excedida (+{latestCalculation?.excessoLitros?.toFixed(1) || '0.0'} L). Ajuste a quantidade para salvar.</span>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => onClose()}
              className="pointer-events-auto cursor-pointer px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-stone-600 text-zinc-700 dark:text-zinc-200 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-stone-700 transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              form="fuel-form"
              onClick={(e) => handleSubmit(e)}
              disabled={isOverCapacity || isLoading}
              title={isOverCapacity ? 'Abastecimento excede a capacidade máxima do tanque' : undefined}
              className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold shadow-xs transition flex items-center space-x-2 ${
                isOverCapacity || isLoading
                  ? 'opacity-50 cursor-not-allowed bg-stone-400 dark:bg-stone-600 pointer-events-none select-none'
                  : 'pointer-events-auto cursor-pointer bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800'
              }`}
            >
              <Save className="w-4 h-4 pointer-events-none" />
              <span>{isLoading ? 'Salvando...' : 'Salvar Abastecimento'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
