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
  const [fuelTypeFilter, setFuelTypeFilter] = useState('todos');

  // Filtered Fuel Logs
  const filteredLogs = useMemo(() => {
    return fuelLogs.filter(log => {
      const matchDate = log.date >= startDate && log.date <= endDate;
      const matchSearch = 
        log.machineryPlateOrName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.driverOrOperator && log.driverOrOperator.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (log.supplierStation && log.supplierStation.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchType = fuelTypeFilter === 'todos' || log.fuelType === fuelTypeFilter;
      return matchDate && matchSearch && matchType;
    });
  }, [fuelLogs, startDate, endDate, searchTerm, fuelTypeFilter]);

  // KPIs
  const totalLiters = filteredLogs.reduce((sum, l) => sum + (l.liters || 0), 0);
  const totalAmount = filteredLogs.reduce((sum, l) => sum + (l.totalAmount || 0), 0);
  const avgPricePerLiter = totalLiters > 0 ? (totalAmount / totalLiters) : 0;

  // Breakdown by Machinery
  const machineryStats = useMemo(() => {
    const map = new Map<string, { name: string; liters: number; totalCost: number; count: number }>();
    filteredLogs.forEach(l => {
      const name = l.machineryPlateOrName || 'Outro Veículo';
      const existing = map.get(name) || { name, liters: 0, totalCost: 0, count: 0 };
      existing.liters += l.liters || 0;
      existing.totalCost += l.totalAmount || 0;
      existing.count += 1;
      map.set(name, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.liters - a.liters);
  }, [filteredLogs]);

  const handleExportCsv = () => {
    const headers = 'Data,Maquina_Veiculo,Tipo_Combustivel,Litros,Preco_Litro,Total_R$,Horimetro_KM,Operador_Motorista,Posto_Fornecedor\n';
    const rows = filteredLogs.map(l => 
      `"${l.date}","${l.machineryPlateOrName}","${l.fuelType}","${l.liters}","${l.pricePerLiter}","${l.totalAmount}","${l.currentHourMeterOrKm}","${l.driverOrOperator || ''}","${l.supplierStation || ''}"`
    ).join('\n');

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
              Controle de litros de Diesel S10/Arla, gasto financeiro e médias de consumo por maquinário
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

      {/* Top Máquinas por Consumo */}
      {machineryStats.length > 0 && (
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-4 shadow-xs">
          <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100 mb-3 flex items-center space-x-1.5">
            <Tractor className="w-3.5 h-3.5 text-stone-400" />
            <span>Consumo Consolidado por Máquina / Trator / Caminhão</span>
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {machineryStats.map(m => (
              <div key={m.name} className="p-3 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200/70 dark:border-stone-700/60 flex justify-between items-center">
                <div>
                  <span className="text-xs font-bold text-stone-900 dark:text-stone-100 block">{m.name}</span>
                  <span className="text-[10px] text-stone-400">{m.count} abastecimento(s)</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black text-amber-600 dark:text-amber-400 block">{m.liters.toFixed(1)} L</span>
                  <span className="text-[10px] font-bold text-stone-500">{formatCurrencyBRL(m.totalCost)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter and Search */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-3 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-2.5">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por veículo, operador ou posto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 outline-none focus:ring-1 focus:ring-[#009688]"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <select
            value={fuelTypeFilter}
            onChange={(e) => setFuelTypeFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-1.5 text-xs font-semibold rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200"
          >
            <option value="todos">Todos os combustíveis</option>
            <option value="Diesel S10">Diesel S10</option>
            <option value="Diesel Comum">Diesel Comum</option>
            <option value="Arla 32">Arla 32</option>
            <option value="Gasolina">Gasolina</option>
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
                filteredLogs.map((item) => (
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
                      {item.currentHourMeterOrKm || '-'}
                    </td>
                    <td className="py-2.5 px-3.5 text-stone-600 dark:text-stone-400">
                      {item.driverOrOperator || '-'}
                    </td>
                    <td className="py-2.5 px-3.5 text-stone-600 dark:text-stone-400">
                      {item.supplierStation || '-'}
                    </td>
                  </tr>
                ))
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
