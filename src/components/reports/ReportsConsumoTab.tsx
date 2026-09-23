import React, { useState, useMemo } from 'react';
import { 
  Fuel, 
  Search, 
  Download, 
  Tractor, 
  Truck, 
  Gauge, 
  DollarSign, 
  Calendar, 
  Droplet 
} from 'lucide-react';
import { FuelLog, Machinery } from '../../types';
import { formatCurrencyBRL, formatDateBR } from '../../lib/storage';
import { formatFuelLogEfficiency, findVehicleForLog, isVehicleHoursControlled } from '../../lib/fuelCalculation';

interface ReportsConsumoTabProps {
  fuelLogs: FuelLog[];
  machineries?: Machinery[];
  startDate: string;
  endDate: string;
}

export const ReportsConsumoTab: React.FC<ReportsConsumoTabProps> = ({
  fuelLogs = [],
  machineries = [],
  startDate,
  endDate,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState('todos');
  const [fuelTypeFilter, setFuelTypeFilter] = useState('todos');

  // Filtered Fuel Logs (Respeitando dinamicamente filtros de data, veículo e busca)
  const filteredLogs = useMemo(() => {
    return fuelLogs.filter(log => {
      const matchDate = log.date >= startDate && log.date <= endDate;
      const matchSearch = 
        log.machineryPlateOrName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.driverOrOperator && log.driverOrOperator.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (log.supplierStation && log.supplierStation.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchType = fuelTypeFilter === 'todos' || log.fuelType === fuelTypeFilter;
      const matchVehicle = selectedVehicle === 'todos' || 
        log.machineryId === selectedVehicle || 
        log.machineryPlateOrName.toLowerCase() === selectedVehicle.toLowerCase();

      return matchDate && matchSearch && matchType && matchVehicle;
    });
  }, [fuelLogs, startDate, endDate, searchTerm, fuelTypeFilter, selectedVehicle]);

  // KPIs
  const totalLiters = filteredLogs.reduce((sum, l) => sum + (l.liters || 0), 0);
  const totalAmount = filteredLogs.reduce((sum, l) => sum + (l.totalAmount || 0), 0);
  const avgPricePerLiter = totalLiters > 0 ? (totalAmount / totalLiters) : 0;

  // Breakdown by Machinery com Média Dinâmica por Tipo (L/h para Máquinas e km/L para Rodoviários)
  const machineryStats = useMemo(() => {
    const map = new Map<string, {
      id?: string;
      name: string;
      liters: number;
      totalCost: number;
      count: number;
      logs: FuelLog[];
    }>();

    filteredLogs.forEach(l => {
      const name = l.machineryPlateOrName || 'Outro Veículo';
      const existing = map.get(name) || {
        id: l.machineryId,
        name,
        liters: 0,
        totalCost: 0,
        count: 0,
        logs: [],
      };
      existing.liters += l.liters || 0;
      existing.totalCost += l.totalAmount || 0;
      existing.count += 1;
      existing.logs.push(l);
      if (!existing.id && l.machineryId) existing.id = l.machineryId;
      map.set(name, existing);
    });

    return Array.from(map.values()).map(item => {
      const vehicle = findVehicleForLog({ machineryId: item.id, machineryPlateOrName: item.name }, machineries);
      const isHours = isVehicleHoursControlled(vehicle, item.name);

      // Coleta médias válidas calculadas de cada abastecimento
      const validEffs = item.logs
        .map(l => formatFuelLogEfficiency(l, vehicle))
        .filter((eff): eff is NonNullable<typeof eff> => eff !== null && eff.value > 0);

      let avgEfficiencyText: string | null = null;
      if (validEffs.length > 0) {
        const sumVal = validEffs.reduce((acc, curr) => acc + curr.value, 0);
        const avgVal = sumVal / validEffs.length;
        const unit = isHours ? 'L/h' : 'km/L';
        avgEfficiencyText = `${avgVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${unit}`;
      }

      return {
        ...item,
        isMachine: isHours,
        avgEfficiencyText,
      };
    }).sort((a, b) => b.liters - a.liters);
  }, [filteredLogs, machineries]);

  const handleExportCsv = () => {
    const headers = 'Data,Maquina_Veiculo,Tipo_Combustivel,Litros,Preco_Litro,Total_R$,Horimetro_KM,Media_Consumo,Operador_Motorista,Posto_Fornecedor\n';
    const rows = filteredLogs.map(l => {
      const vehicle = findVehicleForLog(l, machineries);
      const eff = formatFuelLogEfficiency(l, vehicle);
      return `"${l.date}","${l.machineryPlateOrName}","${l.fuelType}","${l.liters}","${l.pricePerLiter}","${l.totalAmount}","${l.currentHourMeterOrKm}","${eff?.formatted || ''}","${l.driverOrOperator || ''}","${l.supplierStation || ''}"`;
    }).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio_consumo_combustivel_${startDate}_a_${endDate}.csv`;
    link.click();
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      
      {/* Top Header */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Fuel className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
              Relatório de Consumo de Combustível & Lubrificantes
            </h3>
            <p className="text-xs text-stone-500">
              Controle de litros de Diesel S10/Arla, gasto financeiro e médias de consumo (L/h para máquinas e km/L para rodoviários)
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-3.5 py-1.5 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 font-bold text-xs rounded-xl transition cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Exportar Consumo (CSV)</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
        
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-3.5 shadow-2xs border-l-4 border-l-amber-500">
          <span className="text-[11px] font-bold text-stone-500 uppercase block">Litros Totais Consumidos</span>
          <div className="text-lg sm:text-xl font-black text-amber-600 dark:text-amber-400 mt-0.5">
            {totalLiters.toFixed(1)} L
          </div>
          <span className="text-[10px] text-stone-400">{filteredLogs.length} abastecimentos</span>
        </div>

        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-3.5 shadow-2xs border-l-4 border-l-rose-500">
          <span className="text-[11px] font-bold text-stone-500 uppercase block">Custo Total de Combustível</span>
          <div className="text-lg sm:text-xl font-black text-rose-600 dark:text-rose-400 mt-0.5">
            {formatCurrencyBRL(totalAmount)}
          </div>
          <span className="text-[10px] text-stone-400">Total investido em diesel/óleo</span>
        </div>

        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-3.5 shadow-2xs border-l-4 border-l-teal-500">
          <span className="text-[11px] font-bold text-stone-500 uppercase block">Preço Médio por Litro</span>
          <div className="text-lg sm:text-xl font-black text-teal-600 dark:text-teal-400 mt-0.5">
            {formatCurrencyBRL(avgPricePerLiter)}
          </div>
          <span className="text-[10px] text-stone-400">Valor médio pago / litro</span>
        </div>

      </div>

      {/* Top Máquinas por Consumo com Médias Formatadas */}
      {machineryStats.length > 0 && (
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-4 shadow-xs">
          <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100 mb-3 flex items-center space-x-1.5">
            <Tractor className="w-3.5 h-3.5 text-stone-400" />
            <span>Consumo Consolidado por Máquina / Trator / Caminhão</span>
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {machineryStats.map(m => (
              <div key={m.name} className="p-3 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200/70 dark:border-stone-700/60 flex justify-between items-center">
                <div className="min-w-0 flex-1 pr-2">
                  <div className="flex items-center gap-1.5">
                    {m.isMachine ? (
                      <Tractor className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    ) : (
                      <Truck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    )}
                    <span className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate block">
                      {m.name}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span className="text-[10px] text-stone-400">{m.count} abastecimento(s)</span>
                    {m.avgEfficiencyText && (
                      <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                        m.isMachine 
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200/50'
                          : 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200/50'
                      }`}>
                        Média: {m.avgEfficiencyText}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-black text-amber-600 dark:text-amber-400 block">{m.liters.toFixed(1)} L</span>
                  <span className="text-[10px] font-bold text-stone-500">{formatCurrencyBRL(m.totalCost)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter and Search */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-3 shadow-xs flex flex-col md:flex-row items-center justify-between gap-2.5">
        <div className="relative w-full md:w-72">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por veículo, operador ou posto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 outline-none focus:ring-1 focus:ring-[#009688]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Filtro Dinâmico de Veículo / Máquina */}
          <select
            value={selectedVehicle}
            onChange={(e) => setSelectedVehicle(e.target.value)}
            className="w-full sm:w-auto px-3 py-1.5 text-xs font-semibold rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 outline-none focus:ring-1 focus:ring-[#009688] cursor-pointer"
          >
            <option value="todos">Todos os Veículos / Máquinas</option>
            {machineries.map((m) => (
              <option key={m.id} value={m.id}>
                {m.licensePlateOrSerial ? `[${m.licensePlateOrSerial}] - ` : ''}{m.name}
              </option>
            ))}
          </select>

          {/* Filtro de Tipo de Combustível */}
          <select
            value={fuelTypeFilter}
            onChange={(e) => setFuelTypeFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-1.5 text-xs font-semibold rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 outline-none focus:ring-1 focus:ring-[#009688] cursor-pointer"
          >
            <option value="todos">Todos os combustíveis</option>
            <option value="Diesel S10">Diesel S10</option>
            <option value="Diesel Comum">Diesel Comum</option>
            <option value="Arla 32">Arla 32</option>
            <option value="Gasolina">Gasolina</option>
            <option value="Etanol">Etanol</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 dark:bg-stone-800/70 text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider border-b border-stone-200 dark:border-stone-800">
              <tr>
                <th className="py-3 px-3.5">Data</th>
                <th className="py-3 px-3.5">Máquina / Veículo</th>
                <th className="py-3 px-3.5">Combustível</th>
                <th className="py-3 px-3.5 text-right">Volume (Litros)</th>
                <th className="py-3 px-3.5 text-right">Preço / Litro</th>
                <th className="py-3 px-3.5 text-right">Total (R$)</th>
                <th className="py-3 px-3.5 text-right">Horímetro / KM</th>
                <th className="py-3 px-3.5">Operador / Motorista</th>
                <th className="py-3 px-3.5">Posto / Local</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((item) => {
                  const vehicle = findVehicleForLog(item, machineries);
                  const eff = formatFuelLogEfficiency(item, vehicle);

                  return (
                    <tr key={item.id} className="hover:bg-stone-50/70 dark:hover:bg-stone-800/40 transition">
                      <td className="py-2.5 px-3.5 whitespace-nowrap text-stone-600 dark:text-stone-400">
                        {formatDateBR(item.date)}
                      </td>
                      <td className="py-2.5 px-3.5 font-bold text-stone-900 dark:text-stone-100">
                        {item.machineryPlateOrName}
                      </td>
                      <td className="py-2.5 px-3.5 font-medium text-stone-700 dark:text-stone-300">
                        {item.fuelType}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-black text-stone-900 dark:text-stone-100">
                        {item.liters.toFixed(1)} L
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-semibold text-stone-600 dark:text-stone-400">
                        {formatCurrencyBRL(item.pricePerLiter)}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-black text-rose-600 dark:text-rose-400 whitespace-nowrap">
                        {formatCurrencyBRL(item.totalAmount)}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-mono text-stone-600 dark:text-stone-400">
                        <div>{item.currentHourMeterOrKm ? item.currentHourMeterOrKm.toLocaleString('pt-BR') : '-'}</div>
                        {eff ? (
                          <span className={`block text-[10px] font-bold mt-0.5 ${
                            eff.unit === 'L/h'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}>
                            {eff.formatted}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2.5 px-3.5 text-stone-600 dark:text-stone-400">
                        {item.driverOrOperator || '-'}
                      </td>
                      <td className="py-2.5 px-3.5 text-stone-600 dark:text-stone-400">
                        {item.supplierStation || '-'}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-stone-400">
                    Nenhum registro de abastecimento localizado no período selecionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
