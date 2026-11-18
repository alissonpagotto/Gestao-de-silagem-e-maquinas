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
  getNextCompetence, 
  getCompetenceDateRange 
} from '../financial/CompetenceSelector';

interface FleetFuelViewProps {
  fuelLogs: FuelLog[];
  machineries: Machinery[];
  employees: Employee[];
  onOpenNewFuel: () => void;
  onEditFuel: (log: FuelLog) => void;
  onDeleteFuel: (id: string) => void;
  competence?: string;
  onCompetenceChange?: (comp: string) => void;
}

export const FleetFuelView: React.FC<FleetFuelViewProps> = ({
  fuelLogs,
  machineries,
  employees,
  onOpenNewFuel,
  onEditFuel,
  onDeleteFuel,
  competence,
  onCompetenceChange,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<string>('todos');
  const [selectedFuelType, setSelectedFuelType] = useState<string>('todos');

  // Competência ativa
  const activeCompetence = useMemo(() => {
    if (competence) return competence;
    const now = new Date();
    return `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  }, [competence]);

  const handlePrev = () => {
    const nextComp = getPrevCompetence(activeCompetence);
    onCompetenceChange?.(nextComp);
  };

  const handleNext = () => {
    const nextComp = getNextCompetence(activeCompetence);
    onCompetenceChange?.(nextComp);
  };

  const competenceRange = useMemo(() => {
    return getCompetenceDateRange(activeCompetence);
  }, [activeCompetence]);

  // Sincronização em tempo real via Hook unificado (Realtime + Polling 30s + Foco da Janela)
  const { fuelLogs: localLogs } = useAbastecimentosRealtime(fuelLogs);

  // Filtered Fuel Logs (Respeitando a competência ativa)
  const filteredLogs = useMemo(() => {
    const term = (searchTerm || '').trim().toLowerCase();
    const { start, end } = competenceRange;

    return (localLogs || []).filter((log) => {
      if (!log) return false;
      const logDate = log.date ? log.date.slice(0, 10) : '';
      const matchDate = !logDate || (logDate >= start && logDate <= end);
      if (!matchDate) return false;

      const plateOrName = String(log.machineryPlateOrName || (log as any).vehiclePlate || (log as any).vehicleName || '').toLowerCase();
      const driver = String(log.driverOrOperator || '').toLowerCase();
      const station = String(log.supplierStation || '').toLowerCase();

      const matchSearch =
        !term ||
        plateOrName.includes(term) ||
        driver.includes(term) ||
        station.includes(term);

      const matchVehicle = selectedVehicle === 'todos' || log.machineryId === selectedVehicle;
      const matchFuelType = selectedFuelType === 'todos' || log.fuelType === selectedFuelType;

      return matchSearch && matchVehicle && matchFuelType;
    });
  }, [localLogs, searchTerm, selectedVehicle, selectedFuelType, competenceRange]);

  // Statistics
  const totalLiters = filteredLogs.reduce((acc, curr) => acc + (Number(curr?.liters) || 0), 0);
  const totalCost = filteredLogs.reduce((acc, curr) => acc + (Number(curr?.totalAmount) || 0), 0);
  const avgPrice = totalLiters > 0 ? totalCost / totalLiters : 0;

  return (
    <div className="flex-1 min-h-0 h-full max-h-full flex flex-col gap-2 overflow-hidden animate-in fade-in duration-200">
      
      {/* Painel Externo Unificado e Compacto do Cabeçalho */}
      <div className="shrink-0 bg-[#cad4e6] dark:bg-stone-900 border border-black dark:border-stone-800 rounded-lg p-2 space-y-2 shadow-xs">
        {/* Linha 1: Título + Botão */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <Fuel className="w-4 h-4 text-[#cc1f2f] shrink-0" />
            <h2 className="text-sm sm:text-base font-bold text-black dark:text-stone-100 font-['Outfit'] leading-tight">
              Controle de Combustível &amp; Abastecimentos
            </h2>
          </div>

          <button
            onClick={onOpenNewFuel}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 border border-black/40 text-white text-xs font-bold uppercase rounded-lg shadow-sm transition active:scale-95 cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>REGISTRAR ABASTECIMENTO</span>
          </button>
        </div>

        {/* Linha 2: 3 KPI Cards Compactos (#e0e6f1 + border-black) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="px-3 py-1.5 rounded-lg bg-[#e0e6f1] dark:bg-stone-900 border border-black dark:border-stone-800 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-stone-700 dark:text-stone-400 uppercase tracking-wider leading-tight">
                Total de Litros
              </span>
              <Droplets className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            </div>
            <div className="text-lg font-black text-amber-800 dark:text-amber-400 mt-0.5 leading-tight font-['Outfit']">
              {(Number(totalLiters) || 0).toLocaleString('pt-BR')} <span className="text-xs font-semibold">Litros</span>
            </div>
            <p className="text-[11px] text-stone-600 leading-tight mt-0.5">Volume abastecido no período</p>
          </div>

          <div className="px-3 py-1.5 rounded-lg bg-[#e0e6f1] dark:bg-stone-900 border border-black dark:border-stone-800 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-stone-700 dark:text-stone-400 uppercase tracking-wider leading-tight">
                Custo Total em Combustível
              </span>
              <DollarSign className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            </div>
            <div className="text-lg font-black text-stone-900 dark:text-stone-100 mt-0.5 leading-tight font-['Outfit']">
              {formatCurrencyBRL(totalCost)}
            </div>
            <p className="text-[11px] text-stone-600 leading-tight mt-0.5">Impacto no custo operacional</p>
          </div>

          <div className="px-3 py-1.5 rounded-lg bg-[#e0e6f1] dark:bg-stone-900 border border-black dark:border-stone-800 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-stone-700 dark:text-stone-400 uppercase tracking-wider leading-tight">
                Preço Médio por Litro
              </span>
              <Calculator className="w-3.5 h-3.5 text-sky-600 shrink-0" />
            </div>
            <div className="text-lg font-black text-stone-900 dark:text-stone-100 mt-0.5 leading-tight font-['Outfit']">
              {formatCurrencyBRL(avgPrice)}/L
            </div>
            <p className="text-[11px] text-stone-600 leading-tight mt-0.5">Preço médio ponderado</p>
          </div>
        </div>

        {/* Linha 3: Busca, Competência & Filtros Compactos */}
        <div className="pt-1.5 border-t border-black/20 dark:border-stone-800 flex flex-col md:flex-row items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto flex-1">
            <div className="relative w-full sm:w-80">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por placa, motorista, posto..."
                className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-stone-800 border border-slate-400 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <CompetenceSelector
              competence={activeCompetence}
              onPrev={handlePrev}
              onNext={handleNext}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Vehicle Filter */}
            <select
              value={selectedVehicle}
              onChange={(e) => setSelectedVehicle(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
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
              className="px-2.5 py-1.5 rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
            >
              <option value="todos">Todos Combustíveis</option>
              <option value="Diesel S10">Diesel S10</option>
              <option value="Diesel Comum">Diesel Comum</option>
              <option value="Arla 32">Arla 32</option>
              <option value="Gasolina">Gasolina</option>
            </select>
          </div>
        </div>
      </div>

      {/* Fuel Logs Table */}
      <div className="flex-1 min-h-0 flex flex-col bg-[#e0e6f1] dark:bg-stone-900 rounded-lg border border-black dark:border-stone-800 overflow-hidden shadow-xs">
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 text-[11px] font-bold text-black dark:text-stone-300 uppercase tracking-wider border-b border-black dark:border-stone-700 shadow-sm">
              <tr>
                <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5">Data</th>
                <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5">Veículo / Placa</th>
                <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5">Combustível</th>
                <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5">Litros</th>
                <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5">Preço / Litro</th>
                <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5">Valor Total</th>
                <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5">Leitura Atual</th>
                <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5">Média Consumo</th>
                <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5">Motorista / Responsável</th>
                <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5">Local / Posto</th>
                <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-[#e0e6f1] divide-y divide-black/15 dark:divide-stone-800/60 font-medium">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-xs font-semibold text-stone-600 bg-[#e0e6f1] uppercase">
                    NENHUM REGISTRO ENCONTRADO
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="bg-[#e0e6f1] dark:bg-stone-900 hover:bg-[#d2dced] dark:hover:bg-stone-800 transition border-b border-black/20 dark:border-stone-800">
                    <td className="py-3.5 px-4 font-mono text-stone-700 dark:text-stone-300">
                      {formatDateBR(log.date)}
                    </td>

                    <td className="py-3.5 px-4 font-bold text-stone-900 dark:text-stone-100">
                      {(String(log.machineryPlateOrName || (log as any).vehiclePlate || (log as any).vehicleName || '')).replace(/^(AGR[IÍ]COLA\s*[-–—:]*\s*)/i, '').trim() || 'Veículo'}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/50">
                        {log.fuelType || 'Diesel'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-stone-900 dark:text-stone-100">
                      {(Number(log.liters) || 0).toLocaleString('pt-BR')} L
                    </td>

                    <td className="py-3.5 px-4 text-stone-600 dark:text-stone-400">
                      {formatCurrencyBRL(Number(log.pricePerLiter) || 0)}
                    </td>

                    <td className="py-3.5 px-4 font-black text-amber-800 dark:text-amber-300 font-['Outfit']">
                      {formatCurrencyBRL(Number(log.totalAmount) || 0)}
                    </td>

                    {(() => {
                      const vehicle = findVehicleForLog(log, machineries);
                      const readings = getFuelLogReadings(log, vehicle);
                      const dualEff = formatDualFuelLogEfficiency(log, vehicle);

                      return (
                        <>
                          <td className="py-3.5 px-4 font-mono text-stone-700 dark:text-stone-300 whitespace-nowrap">
                            {readings.hasBoth ? (
                              <div className="flex flex-col space-y-0.5">
                                <span className="font-semibold text-stone-900 dark:text-stone-100">{readings.kmFormatted}</span>
                                <span className="text-xs text-stone-500 dark:text-stone-400">{readings.hoursFormatted}</span>
                              </div>
                            ) : readings.kmFormatted ? (
                              <span className="font-medium">{readings.kmFormatted}</span>
                            ) : readings.hoursFormatted ? (
                              <span className="font-medium">{readings.hoursFormatted}</span>
                            ) : (
                              <span className="text-stone-400 dark:text-stone-600">--</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                            {dualEff.hasBoth ? (
                              <div className="flex flex-col space-y-1">
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
                              <span className="text-stone-400 dark:text-stone-600 text-xs font-normal">--</span>
                            )}
                          </td>
                        </>
                      );
                    })()}

                    <td className="py-3.5 px-4 text-stone-700 dark:text-stone-300">
                      {log.driverOrOperator || '--'}
                    </td>

                    <td className="py-3.5 px-4 text-xs">
                      <div className="flex flex-col space-y-1">
                        <span className="font-semibold text-stone-900 dark:text-stone-100">
                          {log.supplierStation || 'Tanque da Fazenda'}
                        </span>
                        {log.fuelOrigin === 'Posto Conveniado (Faturado)' ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 w-fit">
                            Conveniado (A Pagar)
                          </span>
                        ) : log.fuelOrigin === 'Posto de Viagem (Pago na Hora)' ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 w-fit">
                            Viagem ({log.paymentMethod || 'Pago'})
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 w-fit">
                            Tanque Interno
                          </span>
                        )}
                      </div>
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
