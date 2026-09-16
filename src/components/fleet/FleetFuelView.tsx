import React, { useState, useMemo } from 'react';
import { 
  Fuel, 
  Plus, 
  Search, 
  DollarSign, 
  TrendingUp, 
  Calendar, 
  UserCheck, 
  Gauge, 
  Edit3, 
  Trash2, 
  Droplets,
  Calculator,
  Download
} from 'lucide-react';
import { FuelLog, Machinery, Employee } from '../../types';
import { formatCurrencyBRL, formatDateBR } from '../../lib/storage';

interface FleetFuelViewProps {
  fuelLogs: FuelLog[];
  machineries: Machinery[];
  employees: Employee[];
  onOpenNewFuel: () => void;
  onEditFuel: (log: FuelLog) => void;
  onDeleteFuel: (id: string) => void;
}

export const FleetFuelView: React.FC<FleetFuelViewProps> = ({
  fuelLogs,
  machineries,
  employees,
  onOpenNewFuel,
  onEditFuel,
  onDeleteFuel,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<string>('todos');
  const [selectedFuelType, setSelectedFuelType] = useState<string>('todos');

  // Filtered Fuel Logs
  const filteredLogs = useMemo(() => {
    return fuelLogs.filter((log) => {
      const matchSearch =
        log.machineryPlateOrName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.driverOrOperator || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.supplierStation || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchVehicle = selectedVehicle === 'todos' || log.machineryId === selectedVehicle;
      const matchFuelType = selectedFuelType === 'todos' || log.fuelType === selectedFuelType;

      return matchSearch && matchVehicle && matchFuelType;
    });
  }, [fuelLogs, searchTerm, selectedVehicle, selectedFuelType]);

  // Statistics
  const totalLiters = filteredLogs.reduce((acc, curr) => acc + curr.liters, 0);
  const totalCost = filteredLogs.reduce((acc, curr) => acc + curr.totalAmount, 0);
  const avgPrice = totalLiters > 0 ? totalCost / totalLiters : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 dark:border-stone-800 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <Fuel className="w-5 h-5 text-[#cc1f2f]" />
            <h2 className="text-base font-bold text-stone-900 dark:text-stone-100 font-['Outfit']">
              Controle de Combustível & Abastecimentos
            </h2>
          </div>
          <p className="text-xs text-[#110f0c] dark:text-stone-400 mt-0.5">
            Registro detalhado de litros, diesel S10, Arla 32, horímetros e média de consumo por máquina
          </p>
        </div>

        <button
          onClick={onOpenNewFuel}
          className="inline-flex items-center space-x-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-sm transition active:scale-95 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Abastecimento</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
              Total de Litros
            </span>
            <Droplets className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-700 dark:text-amber-400 mt-1 font-['Outfit']">
            {totalLiters.toLocaleString('pt-BR')} <span className="text-sm font-semibold">Litros</span>
          </div>
          <p className="text-xs text-stone-500 mt-0.5">Volume abastecido no período</p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
              Custo Total em Combustível
            </span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-stone-900 dark:text-stone-100 mt-1 font-['Outfit']">
            {formatCurrencyBRL(totalCost)}
          </div>
          <p className="text-xs text-stone-500 mt-0.5">Impacto no custo operacional</p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
              Preço Médio por Litro
            </span>
            <Calculator className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-black text-stone-900 dark:text-stone-100 mt-1 font-['Outfit']">
            {formatCurrencyBRL(avgPrice)}/L
          </div>
          <p className="text-xs text-stone-500 mt-0.5">Preço médio ponderado</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por placa, motorista, posto..."
            className="w-full pl-9 pr-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs sm:text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Vehicle Filter */}
          <select
            value={selectedVehicle}
            onChange={(e) => setSelectedVehicle(e.target.value)}
            className="px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
          >
            <option value="todos">Todos os Veículos</option>
            {machineries.map((m) => (
              <option key={m.id} value={m.id}>
                {m.licensePlateOrSerial ? `[${m.licensePlateOrSerial}] ` : ''}{m.model || m.name}
              </option>
            ))}
          </select>

          {/* Fuel Type Filter */}
          <select
            value={selectedFuelType}
            onChange={(e) => setSelectedFuelType(e.target.value)}
            className="px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
          >
            <option value="todos">Todos Combustíveis</option>
            <option value="Diesel S10">Diesel S10</option>
            <option value="Diesel Comum">Diesel Comum</option>
            <option value="Arla 32">Arla 32</option>
            <option value="Gasolina">Gasolina</option>
          </select>
        </div>
      </div>

      {/* Fuel Logs Table */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-stone-50 dark:bg-stone-800/80 text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider border-b border-stone-200 dark:border-stone-800">
              <tr>
                <th className="py-3 px-4">Data</th>
                <th className="py-3 px-4">Veículo / Placa</th>
                <th className="py-3 px-4">Combustível</th>
                <th className="py-3 px-4">Litros</th>
                <th className="py-3 px-4">Preço / Litro</th>
                <th className="py-3 px-4">Valor Total</th>
                <th className="py-3 px-4">Horímetro / KM</th>
                <th className="py-3 px-4">Motorista / Responsável</th>
                <th className="py-3 px-4">Local / Posto</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60 font-medium">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-stone-400">
                    Nenhum registro de abastecimento encontrado.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-stone-50/70 dark:hover:bg-stone-800/40 transition">
                    <td className="py-3.5 px-4 font-mono text-stone-700 dark:text-stone-300">
                      {formatDateBR(log.date)}
                    </td>

                    <td className="py-3.5 px-4 font-bold text-stone-900 dark:text-stone-100">
                      {log.machineryPlateOrName}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/50">
                        {log.fuelType}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-stone-900 dark:text-stone-100">
                      {log.liters.toLocaleString('pt-BR')} L
                    </td>

                    <td className="py-3.5 px-4 text-stone-600 dark:text-stone-400">
                      {formatCurrencyBRL(log.pricePerLiter)}
                    </td>

                    <td className="py-3.5 px-4 font-black text-amber-800 dark:text-amber-300 font-['Outfit']">
                      {formatCurrencyBRL(log.totalAmount)}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-stone-700 dark:text-stone-300">
                      {log.currentHourMeterOrKm ? `${log.currentHourMeterOrKm.toLocaleString('pt-BR')}` : '--'}
                      {log.averageCalculated ? (
                        <span className="block text-[10px] font-bold text-emerald-600">
                          {log.averageCalculated} km/L
                        </span>
                      ) : null}
                    </td>

                    <td className="py-3.5 px-4 text-stone-700 dark:text-stone-300">
                      {log.driverOrOperator || '--'}
                    </td>

                    <td className="py-3.5 px-4 text-stone-500 text-xs">
                      {log.supplierStation || 'Tanque Próprio'}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => onEditFuel(log)}
                          title="Editar Registro"
                          className="p-1.5 text-stone-500 hover:text-stone-900 dark:hover:text-white rounded-lg transition cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDeleteFuel(log.id)}
                          title="Excluir Registro"
                          className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
