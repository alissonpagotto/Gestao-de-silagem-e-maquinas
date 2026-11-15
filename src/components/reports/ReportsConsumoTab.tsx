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
import { 
  formatFuelLogEfficiency, 
  formatDualFuelLogEfficiency, 
  getFuelLogReadings, 
  findVehicleForLog, 
  isVehicleHoursControlled 
} from '../../lib/fuelCalculation';
import { useAbastecimentosRealtime } from '../../hooks/useAbastecimentosRealtime';
import { 
  CompetenceSelector, 
  getPrevCompetence, 
  getNextCompetence 
} from '../financial/CompetenceSelector';

interface ReportsConsumoTabProps {
  fuelLogs: FuelLog[];
  machineries?: Machinery[];
  startDate: string;
  endDate: string;
  competence?: string;
  onCompetenceChange?: (comp: string) => void;
  onStartDateChange?: (d: string) => void;
  onEndDateChange?: (d: string) => void;
}

export const ReportsConsumoTab: React.FC<ReportsConsumoTabProps> = ({
  fuelLogs: propFuelLogs = [],
  machineries = [],
  startDate,
  endDate,
  competence,
  onCompetenceChange,
  onStartDateChange,
  onEndDateChange,
}) => {
  const activeCompetence = useMemo(() => {
    if (competence) return competence;
    if (startDate && startDate.length >= 7) {
      const [y, m] = startDate.split('-');
      return `${m}/${y}`;
    }
    const now = new Date();
    return `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  }, [competence, startDate]);

  const handlePrev = () => {
    const nextComp = getPrevCompetence(activeCompetence);
    onCompetenceChange?.(nextComp);
  };

  const handleNext = () => {
    const nextComp = getNextCompetence(activeCompetence);
    onCompetenceChange?.(nextComp);
  };
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState('todos');
  const [fuelTypeFilter, setFuelTypeFilter] = useState('todos');

  // Sincronização em tempo real unificada via useAbastecimentosRealtime (Realtime + Polling 30s + Foco da Janela)
  const { fuelLogs: localLogs } = useAbastecimentosRealtime(propFuelLogs);

  // Filtered Fuel Logs (Respeitando dinamicamente filtros de data, veículo e busca)
  const filteredLogs = useMemo(() => {
    const term = (searchTerm || '').trim().toLowerCase();
    const selVehicleLower = String(selectedVehicle || '').toLowerCase();
    return (localLogs || []).filter(log => {
      if (!log) return false;
      const matchDate = (!startDate || !endDate) ? true : (log.date >= startDate && log.date <= endDate);
      const plateOrName = String(log.machineryPlateOrName || (log as any).vehiclePlate || (log as any).vehicleName || '').toLowerCase();
      const driver = String(log.driverOrOperator || '').toLowerCase();
      const station = String(log.supplierStation || '').toLowerCase();

      const matchSearch = 
        !term ||
        plateOrName.includes(term) ||
        driver.includes(term) ||
        station.includes(term);

      const matchType = fuelTypeFilter === 'todos' || log.fuelType === fuelTypeFilter;
      const matchVehicle = selectedVehicle === 'todos' || 
        log.machineryId === selectedVehicle || 
        plateOrName === selVehicleLower;

      return matchDate && matchSearch && matchType && matchVehicle;
    });
  }, [localLogs, startDate, endDate, searchTerm, fuelTypeFilter, selectedVehicle]);

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
      // Lógica condicional: veiculo.controla_por === 'horas' ? 'L/h' : 'km/L'
      const isHours = vehicle?.controla_por
        ? (vehicle.controla_por.toLowerCase() === 'horas')
        : isVehicleHoursControlled(vehicle, item.name);

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
      } else {
        // Fallback: se nenhum log calculou individualmente, verificar se algum log possui averageCalculated
        const logWithAvg = item.logs.find(l => (l.averageCalculated && l.averageCalculated > 0) || (l.averageKmPerLiter && l.averageKmPerLiter > 0) || (l.averageLitersPerHour && l.averageLitersPerHour > 0));
        if (logWithAvg) {
          const rawVal = Number(logWithAvg.averageCalculated || (isHours ? logWithAvg.averageLitersPerHour : logWithAvg.averageKmPerLiter) || logWithAvg.averageLitersPerHour);
          if (!isNaN(rawVal) && rawVal > 0) {
            const unit = isHours ? 'L/h' : 'km/L';
            avgEfficiencyText = `${rawVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${unit}`;
          }
        }
      }

      return {
        ...item,
        isMachine: isHours,
        avgEfficiencyText,
      };
    }).sort((a, b) => b.liters - a.liters);
  }, [filteredLogs, machineries]);

  const handleExportCsv = () => {
    const headers = 'Data,Maquina_Veiculo,Tipo_Controle,Tipo_Combustivel,Litros,Preco_Litro,Total_R$,Leitura_Atual,Media_Consumo,Operador_Motorista,Posto_Fornecedor\n';
    const rows = filteredLogs.map(l => {
      const vehicle = findVehicleForLog(l, machineries);
      const readings = getFuelLogReadings(l, vehicle);
      const dualEff = formatDualFuelLogEfficiency(l, vehicle);

      let reading = '';
      if (readings.hasBoth) {
        reading = `${readings.kmFormatted} / ${readings.hoursFormatted}`;
      } else if (readings.kmFormatted) {
        reading = readings.kmFormatted;
      } else if (readings.hoursFormatted) {
        reading = readings.hoursFormatted;
      }

      let media = '';
      if (dualEff.hasBoth) {
        media = `${dualEff.kmPerLiter?.formatted} / ${dualEff.litersPerHour?.formatted}`;
      } else if (dualEff.kmPerLiter) {
        media = dualEff.kmPerLiter.formatted;
      } else if (dualEff.litersPerHour) {
        media = dualEff.litersPerHour.formatted;
      }

      const tipoControle = readings.hasBoth ? 'Misto (KM + Horas)' : (readings.hoursFormatted ? 'Horas (L/h)' : 'KM (km/L)');
      return `"${l.date}","${l.machineryPlateOrName}","${tipoControle}","${l.fuelType}","${l.liters}","${l.pricePerLiter}","${l.totalAmount}","${reading}","${media}","${l.driverOrOperator || ''}","${l.supplierStation || ''}"`;
    }).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio_consumo_combustivel_${startDate}_a_${endDate}.csv`;
    link.click();
  };

  return (
    <div className="space-y-2.5 animate-fade-in financial-subtab-clean">
      
      {/* 1. Cards de Resumo Finos e Compactos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-2.5">
        
        <div className="bg-white dark:bg-stone-900 rounded-xl py-2 px-3 border border-stone-200 dark:border-stone-800 border-l-[3px] border-l-amber-500 shadow-2xs flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center shrink-0">
            <Droplet className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 block leading-tight truncate">
              Litros Totais Consumidos
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-x-2">
              <div className="text-sm sm:text-base font-black text-amber-600 dark:text-amber-400 font-['Outfit'] leading-tight truncate">
                {totalLiters.toFixed(1)} L
              </div>
              <div className="text-[10px] text-stone-500 leading-tight truncate">
                {filteredLogs.length} abastecimentos
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-stone-900 rounded-xl py-2 px-3 border border-stone-200 dark:border-stone-800 border-l-[3px] border-l-rose-500 shadow-2xs flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center shrink-0">
            <DollarSign className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 block leading-tight truncate">
              Custo Total de Combustível
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-x-2">
              <div className="text-sm sm:text-base font-black text-rose-600 dark:text-rose-400 font-['Outfit'] leading-tight truncate">
                {formatCurrencyBRL(totalAmount)}
              </div>
              <div className="text-[10px] text-stone-500 leading-tight truncate">
                Total investido em diesel/óleo
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-stone-900 rounded-xl py-2 px-3 border border-stone-200 dark:border-stone-800 border-l-[3px] border-l-teal-500 shadow-2xs flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-teal-50 dark:bg-teal-950/50 text-teal-600 flex items-center justify-center shrink-0">
            <Gauge className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 block leading-tight truncate">
              Preço Médio por Litro
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-x-2">
              <div className="text-sm sm:text-base font-black text-teal-600 dark:text-teal-400 font-['Outfit'] leading-tight truncate">
                {formatCurrencyBRL(avgPricePerLiter)}
              </div>
              <div className="text-[10px] text-stone-500 leading-tight truncate">
                Valor médio pago / litro
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Top Máquinas por Consumo com Médias Formatadas */}
      {machineryStats.length > 0 && (
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-3 shadow-xs">
          <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100 mb-2 flex items-center space-x-1.5">
            <Tractor className="w-3.5 h-3.5 text-stone-400" />
            <span>Consumo Consolidado por Máquina / Trator / Caminhão</span>
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {machineryStats.map(m => (
              <div key={m.name} className="py-2 px-3 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200/70 dark:border-stone-700/60 flex justify-between items-center">
                <div className="min-w-0 flex-1 pr-2">
                  <div className="flex items-center gap-1.5">
                    {m.isMachine ? (
                      <Tractor className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    ) : (
                      <Truck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    )}
                    <span className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate block">
                      {m.name}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] text-stone-400">{m.count} abastecimento(s)</span>
                    {m.avgEfficiencyText && (
                      <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                        m.isMachine 
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200/50'
                          : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200/50'
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

      {/* 2. Filtros, Busca, Competência e Exportação */}
      <div className="bg-white dark:bg-stone-900 px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-800 shadow-xs flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por veículo, operador ou posto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#009688]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filtro Dinâmico de Veículo / Máquina */}
          <select
            value={selectedVehicle}
            onChange={(e) => setSelectedVehicle(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#009688] cursor-pointer"
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
            className="px-2.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#009688] cursor-pointer"
          >
            <option value="todos">Todos os combustíveis</option>
            <option value="Diesel S10">Diesel S10</option>
            <option value="Diesel Comum">Diesel Comum</option>
            <option value="Arla 32">Arla 32</option>
            <option value="Gasolina">Gasolina</option>
            <option value="Etanol">Etanol</option>
          </select>

          <CompetenceSelector
            competence={activeCompetence}
            onPrev={handlePrev}
            onNext={handleNext}
          />

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 border border-stone-300 dark:border-stone-700 font-bold text-xs rounded-lg transition cursor-pointer shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar Consumo (CSV)</span>
          </button>
        </div>
      </div>

      {/* 3. Tabela */}
      <div className="bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-800 rounded-xl overflow-hidden shadow-xs">
        <div className="max-h-[calc(100vh-250px)] overflow-y-auto overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 text-[11px] font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider border-b border-slate-300 dark:border-stone-700 shadow-sm">
              <tr>
                <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 py-3 px-3.5">Data</th>
                <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 py-3 px-3.5">Máquina / Veículo</th>
                <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 py-3 px-3.5">Combustível</th>
                <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 py-3 px-3.5 text-right">Volume (Litros)</th>
                <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 py-3 px-3.5 text-right">Preço / Litro</th>
                <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 py-3 px-3.5 text-right">Total (R$)</th>
                <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 py-3 px-3.5 text-right">Leitura Atual</th>
                <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 py-3 px-3.5 text-right">Média Consumo</th>
                <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 py-3 px-3.5">Operador / Motorista</th>
                <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 py-3 px-3.5">Posto / Local</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((item) => {
                  const vehicle = findVehicleForLog(item, machineries);
                  const readings = getFuelLogReadings(item, vehicle);
                  const dualEff = formatDualFuelLogEfficiency(item, vehicle);

                  return (
                    <tr key={item.id} className="even:bg-[#f2f2f2] odd:bg-white dark:even:bg-stone-800/50 dark:odd:bg-stone-900 hover:bg-slate-200/60 dark:hover:bg-stone-800 transition border-b border-slate-200 dark:border-stone-800">
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
                      <td className="py-2.5 px-3.5 text-right font-mono text-stone-700 dark:text-stone-300 whitespace-nowrap">
                        {readings.hasBoth ? (
                          <div className="flex flex-col items-end space-y-0.5">
                            <span className="font-semibold text-stone-900 dark:text-stone-100">{readings.kmFormatted}</span>
                            <span className="text-xs text-stone-500 dark:text-stone-400">{readings.hoursFormatted}</span>
                          </div>
                        ) : readings.kmFormatted ? (
                          <span className="font-medium">{readings.kmFormatted}</span>
                        ) : readings.hoursFormatted ? (
                          <span className="font-medium">{readings.hoursFormatted}</span>
                        ) : (
                          <span className="text-stone-400 dark:text-stone-600">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-mono whitespace-nowrap">
                        {dualEff.hasBoth ? (
                          <div className="flex flex-col items-end space-y-1">
                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 inline-block">
                              {dualEff.kmPerLiter?.formatted}
                            </span>
                            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 inline-block">
                              {dualEff.litersPerHour?.formatted}
                            </span>
                          </div>
                        ) : dualEff.kmPerLiter ? (
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            {dualEff.kmPerLiter.formatted}
                          </span>
                        ) : dualEff.litersPerHour ? (
                          <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                            {dualEff.litersPerHour.formatted}
                          </span>
                        ) : (
                          <span className="text-stone-400 dark:text-stone-600 text-xs font-normal">-</span>
                        )}
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
                  <td colSpan={10} className="py-8 text-center text-stone-400">
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
