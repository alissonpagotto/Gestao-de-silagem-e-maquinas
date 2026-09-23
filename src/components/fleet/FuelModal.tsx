import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { X, Fuel, Save, DollarSign, Calculator, Calendar, Gauge, Clock, Sparkles, CheckCircle2, History, RefreshCw } from 'lucide-react';
import { FuelLog, Machinery, Employee } from '../../types';
import { FuelTankVisualizer } from './FuelTankVisualizer';
import { calculateVehicleConsumptionMetrics } from '../../lib/fleetMetrics';

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

export const FuelModal: React.FC<FuelModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingLog,
  machineries,
  employees,
  fuelLogs = [],
  initialMachineryId,
}) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [machineryId, setMachineryId] = useState('');
  const [fuelType, setFuelType] = useState<FuelLog['fuelType']>('Diesel S10');
  const [liters, setLiters] = useState('');
  const [pricePerLiter, setPricePerLiter] = useState('5.85');
  const [totalAmount, setTotalAmount] = useState('');
  
  // Meters: KM & Horímetro
  const [currentKm, setCurrentKm] = useState('');
  const [previousKm, setPreviousKm] = useState('');
  const [currentHourMeter, setCurrentHourMeter] = useState('');
  const [previousHourMeter, setPreviousHourMeter] = useState('');
  const [metersSource, setMetersSource] = useState<'local_history' | 'initial_profile'>('initial_profile');

  const [driverOrOperator, setDriverOrOperator] = useState('');
  const [supplierStation, setSupplierStation] = useState('Tanque da Fazenda');
  const [notes, setNotes] = useState('');
  const [createExpense, setCreateExpense] = useState(true);

  const selectedMachinery = useMemo(() => {
    return machineries.find(m => m.id === machineryId);
  }, [machineries, machineryId]);

  // Histórico de métricas do veículo através de logs anteriores
  const vehicleMetrics = useMemo(() => {
    if (!machineryId || !fuelLogs || fuelLogs.length === 0) return null;
    return calculateVehicleConsumptionMetrics(machineryId, fuelLogs);
  }, [machineryId, fuelLogs]);

  const historicalAvgLitersPerHour = useMemo(() => {
    return selectedMachinery?.averageConsumptionLitersPerHour ?? vehicleMetrics?.avgLitersPerHour ?? null;
  }, [selectedMachinery, vehicleMetrics]);

  const historicalAvgKmPerLiter = useMemo(() => {
    return selectedMachinery?.averageConsumptionKmPerLiter ?? vehicleMetrics?.avgKmPerLiter ?? null;
  }, [selectedMachinery, vehicleMetrics]);

  const prevIsOpenRef = useRef(false);

  /**
   * CARREGAMENTO DIRETO E INSTANTÂNEO DOS LEITURAS DE HORÍMETRO E KM:
   * 1. Consulta o histórico local de abastecimentos (fuelLogs) do veículo selecionado.
   * 2. Se não houver histórico anterior, busca diretamente o Horímetro Inicial e o KM Inicial
   *    do objeto do veículo já carregado da tabela 'gestao_frotas'.
   * 3. Execução 100% síncrona e local, sem requisições a tabelas inexistentes,
   *    mantendo todos os campos liberados e imediatamente editáveis.
   */
  const loadVehicleMeters = useCallback((vehicleId: string, mach?: Machinery) => {
    if (!vehicleId) return;

    const targetMach = mach || machineries.find((m) => m.id === vehicleId);

    // 1. Procura no histórico local de abastecimentos (fuelLogs)
    const logsForVehicle = (fuelLogs || [])
      .filter((f) => f.machineryId === vehicleId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    let foundHours: number | null = null;
    let foundKm: number | null = null;
    let source: 'local_history' | 'initial_profile' = 'initial_profile';

    if (logsForVehicle.length > 0) {
      const lastLog = logsForVehicle[0];
      const h = lastLog.currentHourMeter !== undefined ? lastLog.currentHourMeter : (lastLog.currentHourMeterOrKm && lastLog.currentHourMeterOrKm <= 50000 ? lastLog.currentHourMeterOrKm : undefined);
      const k = lastLog.currentKm !== undefined ? lastLog.currentKm : (lastLog.currentHourMeterOrKm && lastLog.currentHourMeterOrKm > 50000 ? lastLog.currentHourMeterOrKm : undefined);
      if (h !== undefined && h > 0) {
        foundHours = h;
        source = 'local_history';
      }
      if (k !== undefined && k > 0) {
        foundKm = k;
        source = 'local_history';
      }
    }

    // 2. Fallback do perfil do veículo (Horímetro Inicial / KM Inicial da tabela 'gestao_frotas')
    if (foundHours === null && targetMach) {
      const machH = targetMach.hourMeter ?? targetMach.horimetro_ou_km_atual;
      if (machH !== undefined && machH !== null && Number(machH) > 0) {
        foundHours = Number(machH);
        source = 'initial_profile';
      }
    }
    if (foundKm === null && targetMach) {
      const machK = targetMach.currentKm ?? targetMach.horimetro_ou_km_atual;
      if (machK !== undefined && machK !== null && Number(machK) > 0) {
        foundKm = Number(machK);
        source = 'initial_profile';
      }
    }

    // Seta imediatamente na tela os valores de forma síncrona
    setPreviousHourMeter(foundHours !== null ? String(foundHours) : '');
    setPreviousKm(foundKm !== null ? String(foundKm) : '');
    setMetersSource(source);
  }, [fuelLogs, machineries]);

  // Hook estável de inicialização do modal: executa apenas ao abrir ou trocar edição
  useEffect(() => {
    if (!isOpen) {
      prevIsOpenRef.current = false;
      return;
    }

    const wasOpened = !prevIsOpenRef.current;
    prevIsOpenRef.current = true;

    if (editingLog) {
      setDate(editingLog.date);
      setMachineryId(editingLog.machineryId);
      setFuelType(editingLog.fuelType);
      setLiters(String(editingLog.liters));
      setPricePerLiter(String(editingLog.pricePerLiter));
      setTotalAmount(String(editingLog.totalAmount));
      
      setCurrentKm(editingLog.currentKm !== undefined ? String(editingLog.currentKm) : (editingLog.currentHourMeterOrKm > 50000 ? String(editingLog.currentHourMeterOrKm) : ''));
      setPreviousKm(editingLog.previousKm !== undefined ? String(editingLog.previousKm) : (editingLog.previousHourMeterOrKm && editingLog.previousHourMeterOrKm > 50000 ? String(editingLog.previousHourMeterOrKm) : ''));
      
      setCurrentHourMeter(editingLog.currentHourMeter !== undefined ? String(editingLog.currentHourMeter) : (editingLog.currentHourMeterOrKm <= 50000 ? String(editingLog.currentHourMeterOrKm) : ''));
      setPreviousHourMeter(editingLog.previousHourMeter !== undefined ? String(editingLog.previousHourMeter) : (editingLog.previousHourMeterOrKm && editingLog.previousHourMeterOrKm <= 50000 ? String(editingLog.previousHourMeterOrKm) : ''));
      
      setDriverOrOperator(editingLog.driverOrOperator || '');
      setSupplierStation(editingLog.supplierStation || 'Posto Trevo Petrobras');
      setNotes(editingLog.notes || '');
      setCreateExpense(false);
      setMetersSource('local_history');
      return;
    }

    // Inicialização ao abrir novo registro de abastecimento
    if (wasOpened) {
      setDate(new Date().toISOString().split('T')[0]);
      const initialId = initialMachineryId || (machineries.length > 0 ? machineries[0].id : '');
      setMachineryId(initialId);
      const targetMach = machineries.find(m => m.id === initialId);
      if (targetMach?.operatorOrDriver) {
        setDriverOrOperator(targetMach.operatorOrDriver.split(',')[0].trim());
      } else {
        setDriverOrOperator('');
      }
      setFuelType('Diesel S10');
      setLiters('');
      setPricePerLiter('5.85');
      setTotalAmount('');
      setCurrentKm('');
      setCurrentHourMeter('');
      setSupplierStation('Tanque da Fazenda');
      setNotes('');
      setCreateExpense(true);

      if (initialId) {
        loadVehicleMeters(initialId, targetMach);
      }
    }
  }, [isOpen, editingLog?.id, initialMachineryId, loadVehicleMeters, machineries]);

  const handleMachineryChange = (id: string) => {
    setMachineryId(id);
    const mach = machineries.find((m) => m.id === id);
    if (mach) {
      if (mach.operatorOrDriver) {
        setDriverOrOperator(mach.operatorOrDriver.split(',')[0].trim());
      } else {
        setDriverOrOperator('');
      }
      // Ao trocar de veículo, limpa as leituras atuais digitadas e carrega os medidores instantaneamente
      setCurrentHourMeter('');
      setCurrentKm('');
      loadVehicleMeters(id, mach);
    } else {
      setDriverOrOperator('');
      setPreviousHourMeter('');
      setPreviousKm('');
      setCurrentHourMeter('');
      setCurrentKm('');
    }
  };

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

  // Live metrics for this specific refill
  const calculatedMetrics = useMemo(() => {
    const l = parseFloat(liters) || 0;
    
    // 1. KM Average: km/L
    let kmPerLiter: number | null = null;
    const cKm = parseFloat(currentKm);
    const pKm = parseFloat(previousKm);
    if (!isNaN(cKm) && !isNaN(pKm) && cKm > pKm && l > 0) {
      kmPerLiter = parseFloat(((cKm - pKm) / l).toFixed(2));
    }

    // 2. Horímetro Average: L/h (Litros por Hora)
    let litersPerHour: number | null = null;
    const cHour = parseFloat(currentHourMeter);
    const pHour = parseFloat(previousHourMeter);
    if (!isNaN(cHour) && !isNaN(pHour) && cHour > pHour && l > 0) {
      litersPerHour = parseFloat((l / (cHour - pHour)).toFixed(2));
    }

    return { kmPerLiter, litersPerHour };
  }, [liters, currentKm, previousKm, currentHourMeter, previousHourMeter]);

  const displayLitersPerHour = calculatedMetrics.litersPerHour ?? historicalAvgLitersPerHour;
  const displayKmPerLiter = calculatedMetrics.kmPerLiter ?? historicalAvgKmPerLiter;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const l = parseFloat(liters);
    const p = parseFloat(pricePerLiter);
    const t = parseFloat(totalAmount) || (l * p);
    
    const currK = parseFloat(currentKm);
    const prevK = parseFloat(previousKm);
    const currH = parseFloat(currentHourMeter);
    const prevH = parseFloat(previousHourMeter);

    if (isNaN(l) || l <= 0 || !machineryId) return;

    const machName = selectedMachinery 
      ? (selectedMachinery.licensePlateOrSerial ? `${selectedMachinery.licensePlateOrSerial} - ${selectedMachinery.model || selectedMachinery.name}` : selectedMachinery.name)
      : 'Veículo';

    const log: FuelLog = {
      id: editingLog ? editingLog.id : `fuel_${Date.now()}`,
      date,
      machineryId,
      machineryPlateOrName: machName,
      fuelType,
      liters: l,
      pricePerLiter: p || 0,
      totalAmount: t || 0,
      currentHourMeterOrKm: !isNaN(currH) && currH > 0 ? currH : (!isNaN(currK) ? currK : 0),
      previousHourMeterOrKm: !isNaN(prevH) && prevH > 0 ? prevH : (!isNaN(prevK) ? prevK : undefined),
      currentKm: !isNaN(currK) && currK > 0 ? currK : undefined,
      previousKm: !isNaN(prevK) && prevK > 0 ? prevK : undefined,
      currentHourMeter: !isNaN(currH) && currH > 0 ? currH : undefined,
      previousHourMeter: !isNaN(prevH) && prevH > 0 ? prevH : undefined,
      averageCalculated: calculatedMetrics.kmPerLiter || calculatedMetrics.litersPerHour || undefined,
      averageKmPerLiter: calculatedMetrics.kmPerLiter || undefined,
      averageLitersPerHour: calculatedMetrics.litersPerHour || undefined,
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
        
        {/* Header - Charcoal bg-zinc-800 with White Text */}
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
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-300 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Modal Body: Layout em Duas Colunas (Formulário à Esquerda + Visualizador do Tanque à Direita) */}
        <div className="overflow-y-auto flex-1 bg-white dark:bg-stone-900">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 sm:p-6 items-start">
            
            {/* Coluna Esquerda: Formulário de Preenchimento (7 colunas no Desktop) */}
            <div className="lg:col-span-7">
              <form id="fuel-form" onSubmit={handleSubmit} className="space-y-4">
                
                {/* 1. TOPO (MANTIDO): Veículo / Máquina e Data do Abastecimento */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Veículo */}
                  <div>
                    <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                      Veículo / Máquina <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required
                      value={machineryId}
                      onChange={(e) => handleMachineryChange(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
                    >
                      <option value="">Selecione o veículo...</option>
                      {machineries.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.licensePlateOrSerial ? `[${m.licensePlateOrSerial}] ` : ''}{m.brand ? `${m.brand} ` : ''}{m.model || m.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Data */}
                  <div>
                    <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                      Data do Abastecimento <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
                    />
                  </div>
                </div>

                {/* 2. BLOCO 2 (SUBIR BLOCO VERMELHO): Odômetro / Quilometragem (KM) e Horímetro (Horas de Motor) */}
                <div className="space-y-3">
                  {/* Seção: Quilometragem (KM) */}
                  <div className="p-3.5 bg-stone-50 dark:bg-stone-800/40 rounded-xl border border-stone-200 dark:border-stone-700/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center space-x-1.5">
                        <Gauge className="w-4 h-4 text-emerald-600" />
                        <span>Odômetro / Quilometragem (KM)</span>
                      </span>
                      {displayKmPerLiter !== null && (
                        <span className="text-xs font-black text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded-md">
                          Média: {displayKmPerLiter} km/L
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[11px] font-semibold text-stone-600 dark:text-stone-400">
                            KM Anterior
                          </label>
                          {previousKm && (
                            <span 
                              className={`text-[10px] font-medium flex items-center space-x-1 ${
                                metersSource === 'local_history'
                                  ? 'text-sky-600 dark:text-sky-400'
                                  : 'text-stone-500 dark:text-stone-400'
                              }`}
                              title={
                                metersSource === 'local_history'
                                  ? 'Carregado do histórico do último abastecimento'
                                  : 'Horímetro/KM inicial cadastrado na frota'
                              }
                            >
                              <History className="w-2.5 h-2.5" />
                              <span>
                                {metersSource === 'initial_profile' ? 'Inicial (Frota)' : 'Último'}
                              </span>
                            </span>
                          )}
                        </div>
                        <input
                          type="number"
                          step="any"
                          value={previousKm}
                          onChange={(e) => setPreviousKm(e.target.value)}
                          placeholder="Ex: 145000"
                          className="w-full px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-stone-600 dark:text-stone-400 mb-1">
                          KM Atual no Abastecimento
                        </label>
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
                      {displayLitersPerHour !== null && (
                        <span className="text-xs font-black text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 px-2 py-0.5 rounded-md">
                          Média: {displayLitersPerHour} L/h
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[11px] font-semibold text-stone-600 dark:text-stone-400">
                            Horas Anterior
                          </label>
                          {previousHourMeter && (
                            <span 
                              className={`text-[10px] font-medium flex items-center space-x-1 ${
                                metersSource === 'local_history'
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-stone-500 dark:text-stone-400'
                              }`}
                              title={
                                metersSource === 'local_history'
                                  ? 'Carregado do histórico do último abastecimento'
                                  : 'Horímetro/KM inicial cadastrado na frota'
                              }
                            >
                              <History className="w-2.5 h-2.5" />
                              <span>
                                {metersSource === 'initial_profile' ? 'Inicial (Frota)' : 'Último'}
                              </span>
                            </span>
                          )}
                        </div>
                        <input
                          type="number"
                          step="any"
                          value={previousHourMeter}
                          onChange={(e) => setPreviousHourMeter(e.target.value)}
                          placeholder="Ex: 198"
                          className="w-full px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-stone-600 dark:text-stone-400 mb-1">
                          Horas Atual no Abastecimento
                        </label>
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

                {/* 3. BLOCO 3 (DESCER BLOCO ROSA): Combustível, Litros Abastecidos, Preço / Litro e Total */}
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
                        min="0.1"
                        required
                        value={liters}
                        onChange={(e) => handleLitersChange(e.target.value)}
                        placeholder="Ex: 250"
                        className="w-full px-3.5 py-2 rounded-xl border border-amber-300 dark:border-amber-700/80 bg-amber-50/30 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
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

                  {/* Total Financeiro */}
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

                {/* 4. BLOCO 4 (FIM - BLOCO VERDE): Motorista / Operador e Local / Posto */}
                <div className="space-y-3.5 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Motorista / Responsável */}
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

                    {/* Posto / Fornecedor */}
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

            {/* Coluna Direita: Animação Visual Dinâmica do Tanque de Combustível (5 colunas no Desktop) */}
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
              />
            </div>

          </div>
        </div>

        {/* Footer com Ações */}
        <div className="px-6 py-3.5 bg-zinc-50 dark:bg-stone-800/80 border-t border-zinc-200 dark:border-stone-700 flex items-center justify-end space-x-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-stone-600 text-zinc-700 dark:text-zinc-200 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-stone-700 transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="fuel-form"
            className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white text-xs font-bold shadow-xs transition flex items-center space-x-2 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Salvar Abastecimento</span>
          </button>
        </div>

      </div>
    </div>
  );
};
