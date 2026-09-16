import React, { useState, useEffect, useMemo } from 'react';
import { X, Fuel, Save, DollarSign, Calculator, Calendar, Gauge, Clock, Sparkles, CheckCircle2 } from 'lucide-react';
import { FuelLog, Machinery, Employee } from '../../types';

interface FuelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (fuelLog: FuelLog, createExpense: boolean) => void;
  editingLog: FuelLog | null;
  machineries: Machinery[];
  employees: Employee[];
}

export const FuelModal: React.FC<FuelModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingLog,
  machineries,
  employees,
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

  const [driverOrOperator, setDriverOrOperator] = useState('');
  const [supplierStation, setSupplierStation] = useState('Tanque da Fazenda');
  const [notes, setNotes] = useState('');
  const [createExpense, setCreateExpense] = useState(true);

  const selectedMachinery = useMemo(() => {
    return machineries.find(m => m.id === machineryId);
  }, [machineries, machineryId]);

  useEffect(() => {
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
    } else {
      setDate(new Date().toISOString().split('T')[0]);
      if (machineries.length > 0) {
        const first = machineries[0];
        setMachineryId(first.id);
        if (first.operatorOrDriver) {
          setDriverOrOperator(first.operatorOrDriver.split(',')[0].trim());
        }
        if (first.hourMeter) {
          setPreviousHourMeter(String(first.hourMeter));
        }
        if (first.currentKm) {
          setPreviousKm(String(first.currentKm));
        }
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
    }
  }, [editingLog, isOpen, machineries]);

  const handleMachineryChange = (id: string) => {
    setMachineryId(id);
    const mach = machineries.find((m) => m.id === id);
    if (mach) {
      if (mach.operatorOrDriver) {
        setDriverOrOperator(mach.operatorOrDriver.split(',')[0].trim());
      }
      if (mach.hourMeter) {
        setPreviousHourMeter(String(mach.hourMeter));
      } else {
        setPreviousHourMeter('');
      }
      if (mach.currentKm) {
        setPreviousKm(String(mach.currentKm));
      } else {
        setPreviousKm('');
      }
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

  // Real-time calculated live metrics for this specific refill
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-stone-900 rounded-2xl max-w-2xl w-full shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 bg-amber-600 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center text-white">
              <Fuel className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold font-['Outfit']">
                {editingLog ? 'Editar Abastecimento' : 'Novo Registro de Abastecimento'}
              </h3>
              <p className="text-xs text-amber-100">
                Controle de combustível com cálculo automático de média por KM (km/L) e por Horas (L/h)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/20 transition cursor-pointer text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          
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
                required
                value={liters}
                onChange={(e) => handleLitersChange(e.target.value)}
                placeholder="Ex: 250"
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
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

          {/* Seção 1: Quilometragem (KM) */}
          <div className="p-3.5 bg-stone-50 dark:bg-stone-800/40 rounded-xl border border-stone-200 dark:border-stone-700/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center space-x-1.5">
                <Gauge className="w-4 h-4 text-emerald-600" />
                <span>Odômetro / Quilometragem (KM)</span>
              </span>
              {calculatedMetrics.kmPerLiter !== null && (
                <span className="text-xs font-black text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded-md">
                  Média: {calculatedMetrics.kmPerLiter} km/L
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-stone-600 dark:text-stone-400 mb-1">
                  KM Anterior
                </label>
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

          {/* Seção 2: Horímetro (Horas) */}
          <div className="p-3.5 bg-stone-50 dark:bg-stone-800/40 rounded-xl border border-stone-200 dark:border-stone-700/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center space-x-1.5">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>Horímetro (Horas de Motor)</span>
              </span>
              {calculatedMetrics.litersPerHour !== null && (
                <span className="text-xs font-black text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 px-2 py-0.5 rounded-md">
                  Média: {calculatedMetrics.litersPerHour} L/h
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-stone-600 dark:text-stone-400 mb-1">
                  Horas Anterior
                </label>
                <input
                  type="number"
                  step="any"
                  value={previousHourMeter}
                  onChange={(e) => setPreviousHourMeter(e.target.value)}
                  placeholder="Ex: 4500"
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
                  placeholder="Ex: 4520"
                  className="w-full px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          </div>

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

          {/* Actions */}
          <div className="pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 text-xs font-semibold hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md shadow-amber-600/20 transition flex items-center space-x-2 cursor-pointer active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Abastecimento</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
