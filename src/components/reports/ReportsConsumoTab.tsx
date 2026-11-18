import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Download, 
  Tractor, 
  Truck, 
  Gauge, 
  DollarSign, 
  Droplet 
} from 'lucide-react';
import { CompanyProfile, FuelLog, Machinery } from '../../types';
import { formatCurrencyBRL, formatDateBR, isFictitiousOrZeroFuelLog } from '../../lib/storage';
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
import {
  buildConsumoReport,
  buildSyntheticSummaryRows,
  ReportPrintConfig,
  ReportViewMode,
} from './reportPrintBuilders';
import { ReportViewModeToggle } from './ReportViewModeToggle';

interface ReportsConsumoTabProps {
  fuelLogs: FuelLog[];
  machineries?: Machinery[];
  companyProfile?: CompanyProfile;
  startDate: string;
  endDate: string;
  competence?: string;
  onCompetenceChange?: (comp: string) => void;
  onStartDateChange?: (d: string) => void;
  onEndDateChange?: (d: string) => void;
  onRegisterPrintGetter?: (getter: () => ReportPrintConfig) => void;
}

export const ReportsConsumoTab: React.FC<ReportsConsumoTabProps> = ({
  fuelLogs: propFuelLogs = [],
  machineries = [],
  companyProfile = {} as CompanyProfile,
  startDate,
  endDate,
  competence,
  onCompetenceChange,
  onRegisterPrintGetter,
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
  const [viewMode, setViewMode] = useState<ReportViewMode>('analitico');
  const [groupBy, setGroupBy] = useState<'veiculo' | 'combustivel' | 'operador' | 'posto'>('veiculo');

  const groupByLabel = useMemo(() => {
    if (groupBy === 'combustivel') return 'Combustível';
    if (groupBy === 'operador') return 'Operador / Motorista';
    if (groupBy === 'posto') return 'Posto / Local';
    return 'Veículo / Máquina';
  }, [groupBy]);

  // Sincronização em tempo real unificada via useAbastecimentosRealtime (Realtime + Polling 30s + Foco da Janela)
  const { fuelLogs: localLogs } = useAbastecimentosRealtime(propFuelLogs);

  // Filtered Fuel Logs (Respeitando dinamicamente filtros de data, veículo e busca)
  const filteredLogs = useMemo(() => {
    const term = String(searchTerm ?? '').trim().toLowerCase();
    const selVehicleLower = String(selectedVehicle || '').toLowerCase();
    return (localLogs || []).filter(log => {
      if (!log || isFictitiousOrZeroFuelLog(log)) return false;
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
        ? (String(vehicle.controla_por ?? '').toLowerCase() === 'horas')
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

  const selectedVehicleLabel = useMemo(() => {
    if (selectedVehicle === 'todos') return 'todos';
    const found = machineries.find((m) => m.id === selectedVehicle);
    return found ? `${found.licensePlateOrSerial ? `[${found.licensePlateOrSerial}] ` : ''}${found.name}` : selectedVehicle;
  }, [selectedVehicle, machineries]);

  const syntheticRows = useMemo(() => {
    return buildSyntheticSummaryRows(
      filteredLogs,
      (l) => {
        if (groupBy === 'combustivel') return l.fuelType || 'Combustível N/I';
        if (groupBy === 'operador') return l.driverOrOperator || 'Operador N/I';
        if (groupBy === 'posto') return l.supplierStation || 'Posto N/I';
        return l.machineryPlateOrName || 'Outro Veículo';
      },
      (l) => l.totalAmount || 0,
      {
        getSecondarySum: (l) => l.liters || 0,
        formatSecondary: (liters) => `${liters.toFixed(1)} L`,
      }
    );
  }, [filteredLogs, groupBy]);

  const printConfig = useMemo(
    () =>
      buildConsumoReport({
        companyProfile,
        filteredLogs,
        machineryStats,
        machineries,
        startDate,
        endDate,
        competence: activeCompetence,
        searchTerm,
        selectedVehicleLabel,
        fuelTypeFilter,
        viewMode,
        groupByLabel,
        syntheticRows,
      }),
    [
      companyProfile,
      filteredLogs,
      machineryStats,
      machineries,
      startDate,
      endDate,
      activeCompetence,
      searchTerm,
      selectedVehicleLabel,
      fuelTypeFilter,
      viewMode,
      groupByLabel,
      syntheticRows,
    ]
  );

  useEffect(() => {
    onRegisterPrintGetter?.(() => printConfig);
  }, [onRegisterPrintGetter, printConfig]);

  const handleExportCsv = () => {
    if (viewMode === 'sintetico') {
      const headers = `${groupByLabel.replace(/[^a-zA-Z0-9]/g, '_')},Qtd_Abastecimentos,Litros_Totais,Custo_Total,Ticket_Medio,Participacao_Pct\n`;
      const rows = syntheticRows
        .map(
          (r) =>
            `"${r.groupKey}","${r.count}","${r.secondaryMetric || '0.0 L'}","${r.totalAmount.toFixed(2)}","${r.avgTicket.toFixed(2)}","${r.sharePct.toFixed(1)}%"`
        )
        .join('\n');
      const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `relatorio_consumo_sintetico_${startDate}_a_${endDate}.csv`;
      link.click();
      return;
    }

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
    <div className="flex-1 min-h-0 h-full max-h-full flex flex-col gap-2.5 overflow-hidden animate-fade-in financial-subtab-clean">
      
      {/* 1. Cards de Resumo Finos e Compactos */}
      <div className="shrink-0 grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-2.5">
        
        <div className="reports-kpi-card bg-[#e0e6f1] dark:bg-stone-900 rounded-lg py-2 px-3 border border-black dark:border-stone-800 border-l-[3px] border-l-amber-500 shadow-2xs flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center shrink-0 border border-black/15">
            <Droplet className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 block leading-tight truncate">
              Litros Totais Consumidos
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-x-2">
              <div className="text-sm sm:text-base font-black text-amber-700 dark:text-amber-400 font-['Outfit'] leading-tight truncate">
                {totalLiters.toFixed(1)} L
              </div>
              <div className="text-[10px] text-stone-600 leading-tight truncate">
                {filteredLogs.length} abastecimentos
              </div>
            </div>
          </div>
        </div>

        <div className="reports-kpi-card bg-[#e0e6f1] dark:bg-stone-900 rounded-lg py-2 px-3 border border-black dark:border-stone-800 border-l-[3px] border-l-rose-500 shadow-2xs flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center shrink-0 border border-black/15">
            <DollarSign className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 block leading-tight truncate">
              Custo Total de Combustível
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-x-2">
              <div className="text-sm sm:text-base font-black text-rose-700 dark:text-rose-400 font-['Outfit'] leading-tight truncate">
                {formatCurrencyBRL(totalAmount)}
              </div>
              <div className="text-[10px] text-stone-600 leading-tight truncate">
                Total investido em diesel/óleo
              </div>
            </div>
          </div>
        </div>

        <div className="reports-kpi-card bg-[#e0e6f1] dark:bg-stone-900 rounded-lg py-2 px-3 border border-black dark:border-stone-800 border-l-[3px] border-l-teal-500 shadow-2xs flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-teal-50 dark:bg-teal-950/50 text-teal-600 flex items-center justify-center shrink-0 border border-black/15">
            <Gauge className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 block leading-tight truncate">
              Preço Médio por Litro
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-x-2">
              <div className="text-sm sm:text-base font-black text-teal-700 dark:text-teal-400 font-['Outfit'] leading-tight truncate">
                {formatCurrencyBRL(avgPricePerLiter)}
              </div>
              <div className="text-[10px] text-stone-600 leading-tight truncate">
                Valor médio pago / litro
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Top Máquinas por Consumo com Médias Formatadas */}
      {machineryStats.length > 0 && (
        <div className="reports-kpi-card shrink-0 bg-[#e0e6f1] dark:bg-stone-900 border border-black dark:border-stone-800 rounded-lg p-2.5 shadow-xs max-h-[145px] overflow-y-auto">
          <h4 className="text-xs font-bold text-black dark:text-stone-100 mb-2 flex items-center space-x-1.5">
            <Tractor className="w-3.5 h-3.5 text-stone-600" />
            <span>Consumo Consolidado por Máquina / Trator / Caminhão</span>
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {machineryStats.map(m => (
              <div key={m.name} className="py-1.5 px-2.5 bg-[#cad4e6]/70 dark:bg-stone-800/60 rounded-lg border border-black/40 dark:border-stone-700/60 flex justify-between items-center">
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
                    <span className="text-[10px] text-stone-600">{m.count} abastecimento(s)</span>
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
                  <span className="text-xs font-black text-amber-700 dark:text-amber-400 block">{m.liters.toFixed(1)} L</span>
                  <span className="text-[10px] font-bold text-stone-600">{formatCurrencyBRL(m.totalCost)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Filtros, Busca, Competência e Exportação */}
      <div className="reports-filter-bar shrink-0 bg-[#cad4e6] dark:bg-stone-900 px-3 py-2 rounded-lg border border-black dark:border-stone-800 shadow-xs flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por veículo, operador ou posto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#009688]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filtro Dinâmico de Veículo / Máquina */}
          <select
            value={selectedVehicle}
            onChange={(e) => setSelectedVehicle(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#009688] cursor-pointer"
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
            className="px-2.5 py-1.5 rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#009688] cursor-pointer"
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

          <ReportViewModeToggle
            viewMode={viewMode}
            onChange={setViewMode}
            groupBy={groupBy}
            groupOptions={[
              { value: 'veiculo', label: 'Veículo / Máquina' },
              { value: 'combustivel', label: 'Combustível' },
              { value: 'operador', label: 'Operador / Motorista' },
              { value: 'posto', label: 'Posto / Local' },
            ]}
            onGroupByChange={(val) => setGroupBy(val as 'veiculo' | 'combustivel' | 'operador' | 'posto')}
          />

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-[#e0e6f1] dark:bg-stone-800 text-black dark:text-stone-300 hover:bg-[#d2dced] dark:hover:bg-stone-700 border border-black dark:border-stone-700 font-bold text-xs rounded-lg transition cursor-pointer shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar Consumo (CSV)</span>
          </button>
        </div>
      </div>

      {/* 3. Tabela */}
      <div className="flex-1 min-h-0 flex flex-col bg-[#e0e6f1] dark:bg-stone-900 border border-black dark:border-stone-800 rounded-lg overflow-hidden shadow-xs">
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          {viewMode === 'sintetico' ? (
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 text-[11px] font-bold text-black dark:text-stone-300 uppercase tracking-wider border-b border-black dark:border-stone-700 shadow-sm">
                <tr>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5">{groupByLabel}</th>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5 text-center">Qtd. Abastec.</th>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5 text-right">Volume (Litros)</th>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5 text-right">Custo Total (R$)</th>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5 text-right">Ticket Médio</th>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5 text-right">Partic. (%)</th>
                </tr>
              </thead>
              <tbody className="bg-[#e0e6f1] divide-y divide-black/15 dark:divide-stone-800">
                {syntheticRows.length > 0 ? (
                  syntheticRows.map((row) => (
                    <tr key={row.groupKey} className="bg-[#e0e6f1] dark:bg-stone-900 hover:bg-[#d2dced] dark:hover:bg-stone-800 transition border-b border-black/20 dark:border-stone-800">
                      <td className="py-2.5 px-3.5 font-bold text-stone-900 dark:text-stone-100">{row.groupKey}</td>
                      <td className="py-2.5 px-3.5 text-center font-bold text-stone-700 dark:text-stone-300">{row.count}</td>
                      <td className="py-2.5 px-3.5 text-right font-semibold text-amber-700 dark:text-amber-400">{row.secondaryMetric || '-'}</td>
                      <td className="py-2.5 px-3.5 text-right font-black text-rose-700 dark:text-rose-400 whitespace-nowrap">{formatCurrencyBRL(row.totalAmount)}</td>
                      <td className="py-2.5 px-3.5 text-right font-semibold text-stone-700 dark:text-stone-300 whitespace-nowrap">{formatCurrencyBRL(row.avgTicket)}</td>
                      <td className="py-2.5 px-3.5 text-right font-black text-stone-900 dark:text-stone-100">{row.sharePct.toFixed(1)}%</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-stone-600 bg-[#e0e6f1] dark:bg-stone-900">
                      Nenhum registro de abastecimento localizado no período selecionado.
                    </td>
                  </tr>
                )}
              </tbody>
              {syntheticRows.length > 0 && (
                <tfoot className="bg-[#cad4e6] dark:bg-stone-800 font-black text-xs border-t-2 border-black dark:border-stone-700">
                  <tr>
                    <td className="py-2.5 px-3.5 uppercase">Total Consolidado ({syntheticRows.length} grupos)</td>
                    <td className="py-2.5 px-3.5 text-center">{filteredLogs.length}</td>
                    <td className="py-2.5 px-3.5 text-right text-amber-800 dark:text-amber-300">{totalLiters.toFixed(1)} L</td>
                    <td className="py-2.5 px-3.5 text-right text-rose-800 dark:text-rose-300">{formatCurrencyBRL(totalAmount)}</td>
                    <td className="py-2.5 px-3.5 text-right">{formatCurrencyBRL(filteredLogs.length > 0 ? totalAmount / filteredLogs.length : 0)}</td>
                    <td className="py-2.5 px-3.5 text-right">100.0%</td>
                  </tr>
                </tfoot>
              )}
            </table>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 text-[11px] font-bold text-black dark:text-stone-300 uppercase tracking-wider border-b border-black dark:border-stone-700 shadow-sm">
                <tr>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5">Data</th>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5">Máquina / Veículo</th>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5">Combustível</th>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5 text-right">Volume (Litros)</th>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5 text-right">Preço / Litro</th>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5 text-right">Total (R$)</th>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5 text-right">Leitura Atual</th>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5 text-right">Média Consumo</th>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5">Operador / Motorista</th>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5">Posto / Local</th>
                </tr>
              </thead>
              <tbody className="bg-[#e0e6f1] divide-y divide-black/15 dark:divide-stone-800">
                {filteredLogs.length > 0 ? (
                  filteredLogs.map((item) => {
                    const vehicle = findVehicleForLog(item, machineries);
                    const readings = getFuelLogReadings(item, vehicle);
                    const dualEff = formatDualFuelLogEfficiency(item, vehicle);

                    return (
                      <tr key={item.id} className="bg-[#e0e6f1] dark:bg-stone-900 hover:bg-[#d2dced] dark:hover:bg-stone-800 transition border-b border-black/20 dark:border-stone-800">
                        <td className="py-2.5 px-3.5 whitespace-nowrap text-stone-700 dark:text-stone-400">
                          {formatDateBR(item.date)}
                        </td>
                        <td className="py-2.5 px-3.5 font-bold text-stone-900 dark:text-stone-100">
                          {item.machineryPlateOrName}
                        </td>
                        <td className="py-2.5 px-3.5 font-medium text-stone-800 dark:text-stone-300">
                          {item.fuelType}
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-black text-stone-900 dark:text-stone-100">
                          {item.liters.toFixed(1)} L
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-semibold text-stone-700 dark:text-stone-400">
                          {formatCurrencyBRL(item.pricePerLiter)}
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-black text-rose-700 dark:text-rose-400 whitespace-nowrap">
                          {formatCurrencyBRL(item.totalAmount)}
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-mono text-stone-700 dark:text-stone-300 whitespace-nowrap">
                          {readings.hasBoth ? (
                            <div className="flex flex-col items-end space-y-0.5">
                              <span className="font-semibold text-stone-900 dark:text-stone-100">{readings.kmFormatted}</span>
                              <span className="text-xs text-stone-600 dark:text-stone-400">{readings.hoursFormatted}</span>
                            </div>
                          ) : readings.kmFormatted ? (
                            <span className="font-medium">{readings.kmFormatted}</span>
                          ) : readings.hoursFormatted ? (
                            <span className="font-medium">{readings.hoursFormatted}</span>
                          ) : (
                            <span className="text-stone-500 dark:text-stone-600">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-mono whitespace-nowrap">
                          {dualEff.hasBoth ? (
                            <div className="flex flex-col items-end space-y-1">
                              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 inline-block">
                                {dualEff.kmPerLiter?.formatted}
                              </span>
                              <span className="text-xs font-bold text-amber-700 dark:text-amber-400 inline-block">
                                {dualEff.litersPerHour?.formatted}
                              </span>
                            </div>
                          ) : dualEff.kmPerLiter ? (
                            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                              {dualEff.kmPerLiter.formatted}
                            </span>
                          ) : dualEff.litersPerHour ? (
                            <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                              {dualEff.litersPerHour.formatted}
                            </span>
                          ) : (
                            <span className="text-stone-500 dark:text-stone-600 text-xs font-normal">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3.5 text-stone-700 dark:text-stone-400">
                          {item.driverOrOperator || '-'}
                        </td>
                        <td className="py-2.5 px-3.5 text-stone-700 dark:text-stone-400">
                          {item.supplierStation || '-'}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-stone-600 bg-[#e0e6f1] dark:bg-stone-900">
                      Nenhum registro de abastecimento localizado no período selecionado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  );
};
