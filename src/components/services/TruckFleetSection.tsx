import React from 'react';
import { 
  Truck, 
  Plus, 
  Trash2, 
  Percent, 
  Sparkles, 
  MapPin, 
  Clock, 
  Layers, 
  TrendingUp,
  User,
  Info,
  Calculator,
  Lock
} from 'lucide-react';
import { ServiceTruckItem, Machinery, Employee, FreightCommissionMode } from '../../types';
import { formatCurrencyBRL } from '../../lib/storage';
import { 
  isCaminhao, 
  findLinkedOperator, 
  formatEmployeeOptionLabel, 
  formatMachineryOptionLabel, 
  formatTruckOptionLabel,
  isThirdPartyTruck
} from './serviceHelpers';

interface TruckFleetSectionProps {
  trucks: ServiceTruckItem[];
  machineries: Machinery[];
  employees: Employee[];
  selectedMachineryIds: Set<string>;
  truckFleetPercentage: number | '';
  onPercentageChange: (pct: number | '') => void;
  valorBaseArea: number; // Exclusivamente a área (sem trator!)
  valorDistribuicaoFrotas: number; // (valorBaseArea * pct) / 100
  totalVolumeGeralM3: number;
  horasTambor: number | '';
  horasMotor: number | '';
  unidadeArea: 'hectares' | 'alqueires' | 'hora' | 'horas';
  onAddTruck: () => void;
  onRemoveTruck: (id: string) => void;
  onUpdateTruck: (id: string, updates: Partial<ServiceTruckItem>) => void;
  totalTransporteFrotasHoras?: number;
  pesoPorM3?: number | '';
  estimativaToneladas?: number | '';
}

export const calculateTruckFreightCommission = (
  mode: FreightCommissionMode | undefined,
  truck: {
    driverHours?: number;
    tripLoads?: number;
    capacityM3?: number;
    additionalKm?: number;
    driverCommissionBase?: number | '';
    driverCommissionRate?: number;
    ratePerKm?: number;
  },
  pesoM3?: number | ''
): { base: number; rate: number; total: number; unitLabel: string } => {
  const currentMode = mode || 'horas';
  const rate = typeof truck.driverCommissionRate === 'number' && truck.driverCommissionRate > 0
    ? Number(truck.driverCommissionRate.toFixed(2))
    : (currentMode === 'km' && typeof truck.ratePerKm === 'number' && truck.ratePerKm > 0 ? truck.ratePerKm : 0);

  let base = 0;
  let unitLabel = 'Hora (h)';

  if (currentMode === 'km') {
    unitLabel = 'KM';
    if (typeof truck.driverCommissionBase === 'number' && truck.driverCommissionBase > 0) {
      base = truck.driverCommissionBase;
    } else if (typeof truck.additionalKm === 'number' && truck.additionalKm > 0) {
      base = truck.additionalKm;
    }
  } else if (currentMode === 'horas') {
    unitLabel = 'Hora (h)';
    base = typeof truck.driverHours === 'number' ? truck.driverHours : 0;
  } else if (currentMode === 'tonelada_carga' || (currentMode as string) === 'toneladas' || (currentMode as string) === 'cargas') {
    unitLabel = 'Ton / Carga';
    const numPeso = typeof pesoM3 === 'number' ? pesoM3 : 0;
    const calcTons = numPeso > 0 && truck.capacityM3 && truck.tripLoads
      ? Number(((truck.capacityM3 * truck.tripLoads * numPeso) / 1000).toFixed(2))
      : 0;
    if (typeof truck.driverCommissionBase === 'number' && truck.driverCommissionBase > 0) {
      base = truck.driverCommissionBase;
    } else if (calcTons > 0) {
      base = calcTons;
    } else {
      base = typeof truck.tripLoads === 'number' ? truck.tripLoads : 0;
    }
  } else if (currentMode === 'viagem') {
    unitLabel = 'Viagem';
    base = typeof truck.tripLoads === 'number' ? truck.tripLoads : 0;
  } else {
    // 'livre'
    unitLabel = 'Unidade';
    base = typeof truck.driverCommissionBase === 'number' ? truck.driverCommissionBase : 0;
  }

  const total = Number((base * rate).toFixed(2));
  return { base, rate, total, unitLabel };
};

export const TruckFleetSection: React.FC<TruckFleetSectionProps> = ({
  trucks,
  machineries,
  employees,
  selectedMachineryIds,
  truckFleetPercentage,
  onPercentageChange,
  valorBaseArea,
  valorDistribuicaoFrotas,
  totalVolumeGeralM3,
  horasTambor,
  horasMotor,
  unidadeArea,
  onAddTruck,
  onRemoveTruck,
  onUpdateTruck,
  totalTransporteFrotasHoras: totalTransporteFrotasHorasProp,
  pesoPorM3,
  estimativaToneladas,
}) => {
  // Filtra APENAS caminhões do cadastro
  const todosCaminhoes = machineries.filter(isCaminhao);

  // Soma total de frotas por horas trabalhadas (quando Hectares)
  const totalTransporteFrotasHorasCalculado = React.useMemo(() => {
    return trucks.reduce((sum, t) => {
      const h = typeof t.truckHours === 'number' ? t.truckHours : 0;
      const rate = typeof t.truckHourlyRate === 'number' ? t.truckHourlyRate : 0;
      return sum + (h * rate);
    }, 0);
  }, [trucks]);

  const totalTransporteFrotasHoras = totalTransporteFrotasHorasProp ?? totalTransporteFrotasHorasCalculado;

  // Manipula seleção de caminhão com autocompletar do motorista principal e regra de exclusão
  const handleSelectTruckMachinery = (truckId: string, machId: string) => {
    if (!machId) {
      onUpdateTruck(truckId, {
        machineryId: '',
        truckName: '',
        plate: '',
        capacityM3: 0,
        tripLoads: 0,
        totalM3: 0,
        primaryDriverId: '',
        primaryDriverName: '',
        secondaryDriverId: '',
        secondaryDriverName: '',
      });
      return;
    }

    const mach = machineries.find((m) => m.id === machId);
    if (!mach) return;

    const linkedOp = findLinkedOperator(mach, employees);
    const opEmployee = employees.find((e) => e.id === linkedOp.id || e.name === linkedOp.name);
    const defaultRate = opEmployee?.commissionPerHour && opEmployee.commissionPerHour > 0 ? Number(opEmployee.commissionPerHour.toFixed(2)) : 10;
    const capacity = mach.capacityM3 && mach.capacityM3 > 0 ? mach.capacityM3 : 20;

    // Obtém o caminhão atual para preservar ou inicializar cargas
    const currentTruck = trucks.find((t) => t.id === truckId);
    const loads = currentTruck && typeof currentTruck.tripLoads === 'number' ? currentTruck.tripLoads : 0;
    const mode = currentTruck?.driverCommissionMode || 'horas';
    const hourSource = currentTruck?.driverHourSource || 'tambor';
    const hours = hourSource === 'tambor'
      ? (typeof horasTambor === 'number' ? horasTambor : 0)
      : hourSource === 'motor'
      ? (typeof horasMotor === 'number' ? horasMotor : 0)
      : (typeof currentTruck?.driverHours === 'number' ? currentTruck.driverHours : 0);
    const base = mode === 'livre'
      ? (typeof currentTruck?.driverCommissionBase === 'number' ? currentTruck.driverCommissionBase : hours)
      : mode === 'horas' ? hours : loads;
    const rateToUse = typeof currentTruck?.driverCommissionRate === 'number' && currentTruck.driverCommissionRate > 0
      ? Number(currentTruck.driverCommissionRate.toFixed(2))
      : defaultRate;

    onUpdateTruck(truckId, {
      machineryId: mach.id,
      truckName: mach.name || mach.model || 'Caminhão',
      ownership: mach.ownership || 'proprio',
      plate: mach.licensePlateOrSerial ? mach.licensePlateOrSerial.trim().toUpperCase() : '',
      capacityM3: capacity,
      tripLoads: loads,
      totalM3: capacity * loads,
      driverHours: hours,
      driverHourSource: hourSource,
      driverCommissionMode: mode,
      driverCommissionRate: rateToUse,
      driverCommission: Number((base * rateToUse).toFixed(2)),
      // OPERADOR/MOTORISTA PRINCIPAL preenchido obrigatoriamente (inclusive terceirizado)
      primaryDriverId: linkedOp.id,
      primaryDriverName: linkedOp.name,
      // Segundo Operador NUNCA preenchido automaticamente, inicia sempre vazio para escolha manual
      secondaryDriverId: '',
      secondaryDriverName: '',
    });
  };

  const handleToggleHourSource = (truckId: string, source: 'tambor' | 'motor') => {
    const currentTruck = trucks.find((t) => t.id === truckId);
    // Se o usuário clica no mesmo botão ativo, permite alternar para manual, caso contrário trava na fonte escolhida
    const nextSource = currentTruck?.driverHourSource === source ? 'manual' : source;
    
    let hours = 0;
    if (nextSource === 'tambor') {
      hours = typeof horasTambor === 'number' ? horasTambor : 0;
    } else if (nextSource === 'motor') {
      hours = typeof horasMotor === 'number' ? horasMotor : 0;
    } else {
      hours = typeof currentTruck?.driverHours === 'number' ? currentTruck.driverHours : 0;
    }

    const mode = currentTruck?.driverCommissionMode || 'horas';
    const rate = typeof currentTruck?.driverCommissionRate === 'number' && currentTruck.driverCommissionRate > 0
      ? Number(currentTruck.driverCommissionRate.toFixed(2))
      : 10;
    const base = mode === 'livre'
      ? (typeof currentTruck?.driverCommissionBase === 'number' ? currentTruck.driverCommissionBase : hours)
      : mode === 'horas' ? hours : (currentTruck?.tripLoads || 0);

    onUpdateTruck(truckId, {
      driverHourSource: nextSource,
      driverHours: hours,
      driverCommissionRate: rate,
      driverCommission: Number((base * rate).toFixed(2)),
    });
  };

  return (
    <div 
      className="border border-slate-300 dark:border-slate-700 rounded-xl p-4 space-y-4 w-full max-w-full overflow-hidden bg-[#4e98dd]"
      style={{ backgroundColor: '#4e98dd' }}
    >
      
      {/* Cabeçalho da Seção de Frotas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 dark:border-slate-700 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 flex items-center justify-center">
            <Truck className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
              Frotas / Caminhões para Transporte
            </h4>
            <p className="text-[11px] text-gray-500 dark:text-slate-400">
              Distribuição proporcional por m³ transportado (Capacidade × Cargas)
            </p>
          </div>
        </div>

        {/* % de Distribuição (exclusivo sobre o valor base da área quando Alqueires - 100% congelado) */}
        {unidadeArea === 'alqueires' ? (
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 px-2.5 py-1 rounded-lg">
              <Percent className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs text-gray-700 dark:text-slate-300 font-medium">% Distribuição:</span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={truckFleetPercentage}
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                onChange={(e) => onPercentageChange(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-12 text-xs font-bold text-emerald-800 dark:text-emerald-400 bg-transparent focus:outline-none text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                placeholder="10"
              />
              <span className="text-xs text-gray-500 font-bold">%</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/60 px-2.5 py-1 rounded-lg text-xs font-bold text-blue-800 dark:text-blue-300">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            <span>Cobrança por Horas Trabalhadas</span>
          </div>
        )}
      </div>

      {/* Banner Informativo da Distribuição Proporcional ou Soma Total do Transporte */}
      {(unidadeArea === 'hectares' || unidadeArea === 'hora') ? (
        <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80 rounded-lg p-3 space-y-1.5 text-xs text-blue-950 dark:text-blue-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span className="font-bold flex items-center gap-1.5 uppercase tracking-wide">
              <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              SOMA TOTAL DO TRANSPORTE (POR HORAS):
            </span>
            <span className="font-black font-mono text-sm text-blue-900 dark:text-blue-100">
              {formatCurrencyBRL(totalTransporteFrotasHoras)}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-blue-800 dark:text-blue-300/80 pt-1 border-t border-blue-200 dark:border-blue-800/50">
            <span>
              Custo total das frotas cobrado do cliente por horas trabalhadas em {trucks.length} caminhão(ões).
            </span>
            <span className="italic font-medium">
              * Somado diretamente ao valor final do pedido (Área + Frete + Frotas por Hora).
            </span>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-lg p-3 space-y-1.5 text-xs text-emerald-950 dark:text-emerald-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span className="font-semibold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Distribuição Global para Frotas ({truckFleetPercentage || 0}% sobre {formatCurrencyBRL(valorBaseArea)} da Área):
            </span>
            <span className="font-bold font-mono text-sm text-emerald-900 dark:text-emerald-100">
              {formatCurrencyBRL(valorDistribuicaoFrotas)}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-emerald-800 dark:text-emerald-300/80 pt-1 border-t border-emerald-200 dark:border-emerald-800/50">
            <span>
              Volume Total da Frota: <strong>{totalVolumeGeralM3.toFixed(1)} m³</strong> em {trucks.length} caminhão(ões)
            </span>
            <span className="italic">
              * O custo do trator foi totalmente excluído da base de cálculo das frotas.
            </span>
          </div>
        </div>
      )}

      {/* Lista de Caminhões Dinâmicos */}
      {trucks.length === 0 ? (
        <div className="py-8 px-4 text-center border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900/50 space-y-3">
          <Truck className="w-10 h-10 text-gray-300 dark:text-slate-600 mx-auto" />
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">
              Nenhum caminhão adicionado a este serviço
            </p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              Adicione veículos para calcular automaticamente a distribuição de m³ e comissões dos motoristas
            </p>
          </div>
          <button
            type="button"
            onClick={onAddTruck}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ Adicionar frota/caminhão</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3.5">
          {trucks.map((truck, idx) => {
            // Regra de exclusão de duplicidade: lista apenas caminhões disponíveis ou o selecionado neste card
            const caminhoesParaEsteCard = todosCaminhoes.filter(
              (m) => m.id === truck.machineryId || !selectedMachineryIds.has(m.id)
            );

            // Cálculos individuais de produção e ratio por m³
            const truckTotalM3 = (truck.capacityM3 || 0) * (truck.tripLoads || 0);
            const ratioPercent = totalVolumeGeralM3 > 0 ? (truckTotalM3 / totalVolumeGeralM3) * 100 : 0;
            const valorProporcionalCaminhao = totalVolumeGeralM3 > 0 
              ? (truckTotalM3 / totalVolumeGeralM3) * valorDistribuicaoFrotas 
              : 0;

            const displayPlate = truck.plate ? truck.plate.trim().toUpperCase() : '';
            const displayTitle = displayPlate 
              ? `${displayPlate} — ${truck.truckName || 'Caminhão'}`
              : truck.truckName ? truck.truckName : 'Caminhão a selecionar (Em branco)';

            return (
              <div
                key={truck.id}
                className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-4 shadow-sm space-y-3 w-full max-w-full overflow-hidden"
                style={idx === 1 ? { backgroundColor: '#66a2e6' } : undefined}
              >
                {/* Cabeçalho do Card: Exibe primordialmente a PLACA do veículo no título + Botão Excluir */}
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 flex items-center justify-center text-xs font-bold font-mono">
                      #{idx + 1}
                    </span>
                    <div className="flex items-center gap-2">
                      {displayPlate ? (
                        <span className="px-2 py-0.5 bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-white rounded border border-gray-300 dark:border-slate-700 font-mono text-xs font-extrabold tracking-wider">
                          {displayPlate}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 rounded border border-amber-200 dark:border-amber-800/60 font-mono text-[10px] font-bold">
                          [Sem Veículo Escolhido]
                        </span>
                      )}
                      <span className="text-xs font-bold text-gray-900 dark:text-white">
                        {truck.truckName || 'Selecione o veículo abaixo'}
                      </span>
                      {isThirdPartyTruck(truck, machineries, employees) && (
                        <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 rounded border border-amber-300 dark:border-amber-700 font-extrabold text-[10px] tracking-wider uppercase shadow-2xs">
                          DE TERCEIRO
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Badge do Ratio Proporcional ou Total de Horas */}
                    {(unidadeArea === 'hectares' || unidadeArea === 'hora') ? (
                      <span className="text-[11px] font-bold text-blue-800 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800 font-mono">
                        Transporte: {truck.truckHours || 0}h ➔ {formatCurrencyBRL((truck.truckHours || 0) * (truck.truckHourlyRate || 0))}
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 font-mono">
                        Ratio: {ratioPercent.toFixed(1)}% ({truckTotalM3} m³) ➔ {formatCurrencyBRL(valorProporcionalCaminhao)}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => onRemoveTruck(truck.id)}
                      className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                      title="Remover Caminhão"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Seleção do Veículo & Motorista Principal & Segundo Operador */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  
                  {/* Seletor do Veículo (exibe primordialmente Placa - Modelo) */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 dark:text-slate-300 mb-1">
                      Veículo (Caminhão)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={truck.truckName ? (truck.plate ? `${truck.plate} — ${truck.truckName}` : truck.truckName) : ''}
                        onChange={(e) => onUpdateTruck(truck.id, { truckName: e.target.value })}
                        placeholder="-- Escolher Caminhão Cadastrado --"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-500 rounded-lg text-xs text-slate-900 dark:text-white font-semibold focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/30 shadow-2xs transition-colors"
                      />
                      {caminhoesParaEsteCard.length > 0 && (
                        <select
                          value={truck.machineryId || ''}
                          onChange={(e) => handleSelectTruckMachinery(truck.id, e.target.value)}
                          className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                          title="Selecionar caminhão cadastrado"
                        >
                          <option value="">-- Escolher Caminhão ({caminhoesParaEsteCard.length} disponíveis) --</option>
                          {caminhoesParaEsteCard.map((m) => (
                            <option key={m.id} value={m.id}>
                              {formatTruckOptionLabel(m)}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  {/* Motorista Principal (Autocompletado obrigatoriamente, inclusive Terceirizado) */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                      <span>Operador / Motorista Principal</span>
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">Autocompletado</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={truck.primaryDriverName || ''}
                        onChange={(e) => onUpdateTruck(truck.id, { primaryDriverName: e.target.value, primaryDriverId: '' })}
                        placeholder="Ex: Motorista Carlos"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-500 rounded-lg text-xs text-slate-900 dark:text-white font-semibold focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/30 shadow-2xs transition-colors"
                      />
                      {employees.length > 0 && (
                        <select
                          value={truck.primaryDriverId || ''}
                          onChange={(e) => {
                            const emp = employees.find((em) => em.id === e.target.value);
                            const defaultRate = emp?.commissionPerHour && emp.commissionPerHour > 0 ? Number(emp.commissionPerHour.toFixed(2)) : 10;
                            const currentTruck = trucks.find(t => t.id === truck.id);
                            const mode = currentTruck?.driverCommissionMode || 'horas';
                            const rateToUse = (typeof currentTruck?.driverCommissionRate === 'number' && currentTruck.driverCommissionRate > 0)
                              ? Number(currentTruck.driverCommissionRate.toFixed(2))
                              : defaultRate;
                            const comm = calculateTruckFreightCommission(mode, {
                              ...currentTruck,
                              driverCommissionRate: rateToUse,
                            }, pesoPorM3);

                            onUpdateTruck(truck.id, {
                              primaryDriverId: e.target.value,
                              primaryDriverName: emp ? emp.name : '',
                              driverCommissionRate: rateToUse,
                              driverCommission: comm.total,
                            });
                          }}
                          className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                          title="Selecionar motorista"
                        >
                          <option value="">-- Escolher Motorista --</option>
                          {employees.map((emp) => (
                            <option key={emp.id} value={emp.id}>
                              {formatEmployeeOptionLabel(emp)}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  {/* Segundo Operador (Opcional - inicia vazio) */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                      <span>Segundo Operador (Opcional)</span>
                      <span className="text-[10px] text-gray-400 font-medium">Inicia Vazio</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={truck.secondaryDriverName || ''}
                        onChange={(e) => onUpdateTruck(truck.id, { secondaryDriverName: e.target.value, secondaryDriverId: '' })}
                        placeholder="Ex: Ajudante / Carona"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-500 rounded-lg text-xs text-slate-900 dark:text-white font-semibold focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/30 shadow-2xs transition-colors"
                      />
                      {employees.length > 0 && (
                        <select
                          value={truck.secondaryDriverId || ''}
                          onChange={(e) => {
                            const emp = employees.find((em) => em.id === e.target.value);
                            onUpdateTruck(truck.id, {
                              secondaryDriverId: e.target.value,
                              secondaryDriverName: emp ? emp.name : '',
                            });
                          }}
                          className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                          title="Selecionar segundo motorista"
                        >
                          <option value="">-- Nenhum segundo operador --</option>
                          {employees.map((emp) => (
                            <option key={emp.id} value={emp.id}>
                              {formatEmployeeOptionLabel(emp)}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                </div>

                {/* Métricas de Produção: Cap. m³, Nº Cargas, Total m³ & Horas Motorista */}
                {/* 2. DADOS OPERACIONAIS: Capacidade, Cargas e Total m³ */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 dark:text-slate-300 mb-1">
                      Cap. m³
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={truck.capacityM3 ?? ''}
                      onWheel={(e) => (e.target as HTMLInputElement).blur()}
                      onChange={(e) => {
                        const cap = e.target.value === '' ? 0 : Number(e.target.value);
                        onUpdateTruck(truck.id, { 
                          capacityM3: cap,
                          totalM3: cap * (truck.tripLoads || 0),
                        });
                      }}
                      placeholder="20"
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-500 rounded-lg text-xs font-semibold text-slate-900 dark:text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/30 shadow-2xs transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 dark:text-slate-300 mb-1">
                      Nº de Cargas
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={truck.tripLoads ?? ''}
                      onWheel={(e) => (e.target as HTMLInputElement).blur()}
                      onChange={(e) => {
                        const loads = e.target.value === '' ? 0 : Number(e.target.value);
                        const comm = calculateTruckFreightCommission(truck.driverCommissionMode, {
                          ...truck,
                          tripLoads: loads,
                        }, pesoPorM3);
                        onUpdateTruck(truck.id, { 
                          tripLoads: loads,
                          totalM3: (truck.capacityM3 || 0) * loads,
                          driverCommission: comm.total,
                        });
                      }}
                      placeholder="0"
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-500 rounded-lg text-xs font-semibold text-slate-900 dark:text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/30 shadow-2xs transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 dark:text-slate-300 mb-1">
                      Total m³ (Calculado)
                    </label>
                    <div className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-bold text-slate-900 dark:text-white flex items-center justify-between shadow-2xs">
                      <span className="font-mono">{truckTotalM3.toFixed(1)} m³</span>
                      <span className="text-[10px] text-slate-500 font-semibold">Cap × Cargas</span>
                    </div>
                  </div>
                </div>

                {/* 3. BLOCO ESTRUTURADO DE COMISSÃO DE FRETE DO MOTORISTA (4 FORMAS: KM, HORA, TONELADA/CARGA OU VIAGEM) */}
                {(() => {
                  const commResult = calculateTruckFreightCommission(truck.driverCommissionMode, truck, pesoPorM3);
                  const activeMode = truck.driverCommissionMode || 'horas';
                  const numPeso = typeof pesoPorM3 === 'number' ? pesoPorM3 : 0;
                  const calcTons = numPeso > 0 && truck.capacityM3 && truck.tripLoads
                    ? Number(((truck.capacityM3 * truck.tripLoads * numPeso) / 1000).toFixed(2))
                    : 0;

                  return (
                    <div className="w-full max-w-full bg-white/95 dark:bg-slate-900/95 border border-emerald-300 dark:border-emerald-700/60 rounded-xl p-3 sm:p-3.5 space-y-3 mt-2 shadow-xs print-client-hide overflow-hidden">
                      <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-100 dark:border-slate-800 pb-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="w-6 h-6 rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 flex items-center justify-center">
                            <Truck className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
                              Regra de Frete: Comissão do Motorista ({truck.primaryDriverName || 'Motorista'})
                            </span>
                            <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
                              Apenas Veículos e Fretes — isolado das regras de operadores de corte
                            </p>
                          </div>
                        </div>

                        <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/80 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider self-start sm:self-auto">
                          Frete / Caminhão
                        </span>
                      </div>

                      {/* Seletor das 4 Formas de Frete + Livre */}
                      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 px-1">
                          Modalidade de Frete:
                        </span>
                        <div className="inline-flex flex-wrap rounded-lg p-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs shrink-0 max-w-full gap-1">
                          {/* 1. Por KM */}
                          <button
                            type="button"
                            onClick={() => {
                              const mode: FreightCommissionMode = 'km';
                              const defaultBase = (truck.additionalKm && truck.additionalKm > 0)
                                ? truck.additionalKm
                                : (typeof truck.driverCommissionBase === 'number' && truck.driverCommissionBase > 0 ? truck.driverCommissionBase : '');
                              const defaultRate = (truck.ratePerKm && truck.ratePerKm > 0)
                                ? truck.ratePerKm
                                : (typeof truck.driverCommissionRate === 'number' ? truck.driverCommissionRate : 0);
                              const comm = calculateTruckFreightCommission(mode, {
                                ...truck,
                                driverCommissionBase: defaultBase,
                                driverCommissionRate: defaultRate,
                              }, pesoPorM3);
                              onUpdateTruck(truck.id, {
                                driverCommissionMode: mode,
                                driverCommissionBase: defaultBase,
                                driverCommissionRate: defaultRate,
                                driverCommission: comm.total,
                              });
                            }}
                            className={`px-2.5 py-1 font-bold rounded-md transition cursor-pointer text-xs ${
                              activeMode === 'km'
                                ? 'bg-emerald-700 text-white shadow-xs'
                                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                            }`}
                            title="Comissão do motorista calculada por KM rodado no frete"
                          >
                            Por KM
                          </button>

                          {/* 2. Por Hora */}
                          <button
                            type="button"
                            onClick={() => {
                              const mode: FreightCommissionMode = 'horas';
                              const comm = calculateTruckFreightCommission(mode, truck, pesoPorM3);
                              onUpdateTruck(truck.id, {
                                driverCommissionMode: mode,
                                driverCommission: comm.total,
                              });
                            }}
                            className={`px-2.5 py-1 font-bold rounded-md transition cursor-pointer text-xs ${
                              activeMode === 'horas'
                                ? 'bg-emerald-700 text-white shadow-xs'
                                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                            }`}
                            title="Comissão do motorista calculada por horas trabalhadas"
                          >
                            Por Hora (h)
                          </button>

                          {/* 3. Por Tonelada / Carga [Tonco] */}
                          <button
                            type="button"
                            onClick={() => {
                              const mode: FreightCommissionMode = 'tonelada_carga';
                              const defaultBase = calcTons > 0 ? calcTons : (truck.tripLoads || 0);
                              const comm = calculateTruckFreightCommission(mode, {
                                ...truck,
                                driverCommissionBase: defaultBase,
                              }, pesoPorM3);
                              onUpdateTruck(truck.id, {
                                driverCommissionMode: mode,
                                driverCommissionBase: defaultBase,
                                driverCommission: comm.total,
                              });
                            }}
                            className={`px-2.5 py-1 font-bold rounded-md transition cursor-pointer text-xs ${
                              activeMode === 'tonelada_carga' || (activeMode as string) === 'cargas' || (activeMode as string) === 'toneladas'
                                ? 'bg-emerald-700 text-white shadow-xs'
                                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                            }`}
                            title="Comissão do motorista calculada por Tonelada ou Carga [Tonco] transportada"
                          >
                            Por Tonelada / Carga [Tonco]
                          </button>

                          {/* 4. Por Viagem */}
                          <button
                            type="button"
                            onClick={() => {
                              const mode: FreightCommissionMode = 'viagem';
                              const defaultBase = truck.tripLoads || 0;
                              const comm = calculateTruckFreightCommission(mode, {
                                ...truck,
                                driverCommissionBase: defaultBase,
                              }, pesoPorM3);
                              onUpdateTruck(truck.id, {
                                driverCommissionMode: mode,
                                driverCommissionBase: defaultBase,
                                driverCommission: comm.total,
                              });
                            }}
                            className={`px-2.5 py-1 font-bold rounded-md transition cursor-pointer text-xs ${
                              activeMode === 'viagem'
                                ? 'bg-emerald-700 text-white shadow-xs'
                                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                            }`}
                            title="Comissão do motorista calculada por viagem realizada no frete"
                          >
                            Por Viagem
                          </button>

                          {/* 5. Digitar (livre) */}
                          <button
                            type="button"
                            onClick={() => {
                              const mode: FreightCommissionMode = 'livre';
                              const currentBase = (truck.driverCommissionBase !== undefined && truck.driverCommissionBase !== '')
                                ? truck.driverCommissionBase
                                : (typeof truck.driverHours === 'number' && truck.driverHours > 0
                                  ? truck.driverHours
                                  : (typeof truck.tripLoads === 'number' && truck.tripLoads > 0 ? truck.tripLoads : ''));
                              const comm = calculateTruckFreightCommission(mode, {
                                ...truck,
                                driverCommissionBase: currentBase,
                              }, pesoPorM3);
                              onUpdateTruck(truck.id, {
                                driverCommissionMode: mode,
                                driverCommissionBase: currentBase,
                                driverCommission: comm.total,
                              });
                            }}
                            className={`px-2.5 py-1 font-bold rounded-md transition cursor-pointer text-xs ${
                              activeMode === 'livre'
                                ? 'bg-emerald-700 text-white shadow-xs'
                                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                            }`}
                            title="Digitar base e taxa livremente"
                          >
                            Digitar (livre)
                          </button>
                        </div>
                      </div>

                      {/* Configuração específica do modo de Horas (Tambor / Motor / Manual) */}
                      {activeMode === 'horas' && (
                        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg p-2">
                          <span className="text-[11px] font-bold text-gray-700 dark:text-slate-300">
                            Fonte das Horas do Motorista:
                          </span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleToggleHourSource(truck.id, 'tambor')}
                              className={`text-[11px] px-2 py-1 rounded font-bold transition cursor-pointer border ${
                                truck.driverHourSource === 'tambor'
                                  ? 'bg-pink-600 text-white border-pink-700 shadow-xs'
                                  : 'bg-pink-50 dark:bg-pink-950/30 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-900/50 hover:bg-pink-100'
                              }`}
                              title="Puxar e travar horas da Forrageira (Hora do Tambor)"
                            >
                              Tambor ({horasTambor || 0}h)
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleHourSource(truck.id, 'motor')}
                              className={`text-[11px] px-2 py-1 rounded font-bold transition cursor-pointer border ${
                                truck.driverHourSource === 'motor'
                                  ? 'bg-pink-600 text-white border-pink-700 shadow-xs'
                                  : 'bg-pink-50 dark:bg-pink-950/30 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-900/50 hover:bg-pink-100'
                              }`}
                              title="Puxar e travar horas da Forrageira (Hora do Motor)"
                            >
                              Motor ({horasMotor || 0}h)
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Dicas e atalhos rápidos para outros modos */}
                      {activeMode === 'km' && (
                        <div className="flex items-center justify-between bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-lg p-2 text-xs text-emerald-900 dark:text-emerald-200">
                          <span>Base calculada pelos quilômetros rodados no frete.</span>
                          {truck.additionalKm !== undefined && Number(truck.additionalKm) > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const km = Number(truck.additionalKm) || 0;
                                const rate = typeof truck.driverCommissionRate === 'number' && truck.driverCommissionRate > 0
                                  ? truck.driverCommissionRate
                                  : (truck.ratePerKm || 0);
                                onUpdateTruck(truck.id, {
                                  driverCommissionBase: km,
                                  driverCommissionRate: rate,
                                  driverCommission: Number((km * rate).toFixed(2)),
                                });
                              }}
                              className="text-[10.5px] px-2 py-0.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded shadow-2xs"
                            >
                              Puxar KM Adicional ({truck.additionalKm} km)
                            </button>
                          )}
                        </div>
                      )}

                      {(activeMode === 'tonelada_carga' || (activeMode as string) === 'cargas' || (activeMode as string) === 'toneladas') && (
                        <div className="flex flex-wrap items-center justify-between gap-2 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-lg p-2 text-xs text-emerald-900 dark:text-emerald-200">
                          <span>Base por Toneladas ou Cargas [Tonco] realizadas.</span>
                          <div className="flex items-center gap-1.5">
                            {calcTons > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const rate = typeof truck.driverCommissionRate === 'number' ? truck.driverCommissionRate : 0;
                                  onUpdateTruck(truck.id, {
                                    driverCommissionBase: calcTons,
                                    driverCommission: Number((calcTons * rate).toFixed(2)),
                                  });
                                }}
                                className="text-[10.5px] px-2 py-0.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded shadow-2xs"
                              >
                                Usar Toneladas ({calcTons} t)
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                const loads = truck.tripLoads || 0;
                                const rate = typeof truck.driverCommissionRate === 'number' ? truck.driverCommissionRate : 0;
                                onUpdateTruck(truck.id, {
                                  driverCommissionBase: loads,
                                  driverCommission: Number((loads * rate).toFixed(2)),
                                });
                              }}
                              className="text-[10.5px] px-2 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200 font-bold rounded border border-emerald-300 dark:border-emerald-700 shadow-2xs"
                            >
                              Usar Cargas [Tonco] ({truck.tripLoads || 0})
                            </button>
                          </div>
                        </div>
                      )}

                      {activeMode === 'viagem' && (
                        <div className="flex items-center justify-between bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-lg p-2 text-xs text-emerald-900 dark:text-emerald-200">
                          <span>Base calculada por viagem concluída no transporte ({truck.tripLoads || 0} viagens).</span>
                          <button
                            type="button"
                            onClick={() => {
                              const trips = truck.tripLoads || 0;
                              const rate = typeof truck.driverCommissionRate === 'number' ? truck.driverCommissionRate : 0;
                              onUpdateTruck(truck.id, {
                                driverCommissionBase: trips,
                                driverCommission: Number((trips * rate).toFixed(2)),
                              });
                            }}
                            className="text-[10.5px] px-2 py-0.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded shadow-2xs"
                          >
                            Puxar Viagens ({truck.tripLoads || 0})
                          </button>
                        </div>
                      )}

                      {/* Inputs: Base, Taxa R$ e Subtotal */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {/* 1. Base da Comissão de Frete */}
                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                            <span>
                              Base ({
                                activeMode === 'km' ? 'KM Rodado' :
                                activeMode === 'horas' ? 'Horas (h)' :
                                activeMode === 'tonelada_carga' || (activeMode as string) === 'cargas' || (activeMode as string) === 'toneladas' ? 'Ton / Carga [Tonco]' :
                                activeMode === 'viagem' ? 'Viagens' : 'Livre'
                              })
                            </span>
                            {activeMode !== 'livre' && (
                              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.2 rounded flex items-center gap-1">
                                <Lock className="w-2.5 h-2.5" />
                                Vinculado
                              </span>
                            )}
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={
                              activeMode === 'livre'
                                ? (truck.driverCommissionBase ?? '')
                                : activeMode === 'km'
                                ? (typeof truck.driverCommissionBase === 'number' && truck.driverCommissionBase > 0
                                    ? truck.driverCommissionBase
                                    : (typeof truck.additionalKm === 'number' && truck.additionalKm > 0 ? truck.additionalKm : ''))
                                : activeMode === 'horas'
                                ? (typeof truck.driverHours === 'number' && truck.driverHours > 0 ? truck.driverHours : '')
                                : activeMode === 'tonelada_carga' || (activeMode as string) === 'cargas' || (activeMode as string) === 'toneladas'
                                ? (typeof truck.driverCommissionBase === 'number' && truck.driverCommissionBase > 0
                                    ? truck.driverCommissionBase
                                    : (calcTons > 0 ? calcTons : (typeof truck.tripLoads === 'number' && truck.tripLoads > 0 ? truck.tripLoads : '')))
                                : activeMode === 'viagem'
                                ? (typeof truck.tripLoads === 'number' && truck.tripLoads > 0 ? truck.tripLoads : (truck.driverCommissionBase ?? ''))
                                : ''
                            }
                            onChange={(e) => {
                              const baseVal = e.target.value === '' ? '' : Number(e.target.value);
                              const baseNum = typeof baseVal === 'number' ? baseVal : 0;
                              const rateNum = typeof truck.driverCommissionRate === 'number' ? Number(truck.driverCommissionRate.toFixed(2)) : 0;
                              if (activeMode === 'horas') {
                                onUpdateTruck(truck.id, {
                                  driverHours: baseVal === '' ? undefined : baseVal,
                                  driverHourSource: 'manual',
                                  driverCommission: Number((baseNum * rateNum).toFixed(2)),
                                });
                              } else {
                                onUpdateTruck(truck.id, {
                                  driverCommissionBase: baseVal,
                                  driverCommission: Number((baseNum * rateNum).toFixed(2)),
                                });
                              }
                            }}
                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
                            placeholder={
                              activeMode === 'km' ? 'Ex: 45' :
                              activeMode === 'horas' ? 'Ex: 8.5' :
                              activeMode === 'tonelada_carga' ? 'Ex: 350' :
                              activeMode === 'viagem' ? 'Ex: 12' : 'Digite a base'
                            }
                            className="w-full px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-500 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600 shadow-2xs transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </div>

                        {/* 2. Taxa R$ da Modalidade de Frete */}
                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 dark:text-slate-300 mb-1">
                            R$ / {
                              activeMode === 'km' ? 'KM (R$/km)' :
                              activeMode === 'horas' ? 'Hora (R$/h)' :
                              activeMode === 'tonelada_carga' || (activeMode as string) === 'cargas' || (activeMode as string) === 'toneladas' ? 'Ton ou Carga [Tonco]' :
                              activeMode === 'viagem' ? 'Viagem (R$/viagem)' : 'Unidade (R$)'
                            }
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={typeof truck.driverCommissionRate === 'number' ? Number(truck.driverCommissionRate.toFixed(2)) : (truck.driverCommissionRate ?? '')}
                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
                            onChange={(e) => {
                              const rateVal = e.target.value === '' ? '' : Number(e.target.value);
                              const comm = calculateTruckFreightCommission(activeMode, {
                                ...truck,
                                driverCommissionRate: rateVal === '' ? 0 : rateVal,
                              }, pesoPorM3);
                              onUpdateTruck(truck.id, {
                                driverCommissionRate: rateVal,
                                driverCommission: comm.total,
                              });
                            }}
                            placeholder={
                              activeMode === 'km' ? 'Ex: 2.50' :
                              activeMode === 'horas' ? 'Ex: 15.00' :
                              activeMode === 'tonelada_carga' ? 'Ex: 4.50' :
                              activeMode === 'viagem' ? 'Ex: 60.00' : 'Ex: 10.00'
                            }
                            onBlur={() => {
                              if (typeof truck.driverCommissionRate === 'number') {
                                onUpdateTruck(truck.id, {
                                  driverCommissionRate: Number(truck.driverCommissionRate.toFixed(2)),
                                });
                              }
                            }}
                            className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-500 rounded-lg text-xs text-slate-900 dark:text-white font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/30 shadow-2xs transition-colors"
                          />
                        </div>

                        {/* 3. Subtotal da Comissão de Frete */}
                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 dark:text-slate-300 mb-1">
                            Subtotal Frete Motorista
                          </label>
                          <div className="w-full px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-bold text-slate-900 dark:text-white flex items-center justify-between shadow-2xs">
                            <span className="font-mono text-emerald-700 dark:text-emerald-400 font-extrabold">
                              {formatCurrencyBRL(commResult.total)}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-500">
                              {commResult.base} {commResult.unitLabel} × R$ {commResult.rate.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Bloco de Cobrança do Caminhão por Horas (Exclusivo quando Hectares ou Por Hora) */}
                {(unidadeArea === 'hectares' || unidadeArea === 'hora') && (
                  <div className="w-full max-w-full bg-blue-50/70 dark:bg-blue-950/20 border border-blue-300 dark:border-blue-800/60 rounded-lg p-3 space-y-2 mt-2 shadow-xs overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-blue-600" />
                        Cobrança de Transporte por Horas (Cobrado do Cliente)
                      </span>
                      <span className="text-[10px] bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300 px-2 py-0.5 rounded font-bold">
                        {unidadeArea === 'hora' ? 'Modalidade por Hora (h)' : 'Especial Hectares (ha)'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[11px] font-bold text-gray-700 dark:text-slate-300">
                            Horas Trabalhadas
                          </label>
                          {(horasTambor !== '' || horasMotor !== '') && (
                            <div className="flex items-center gap-1">
                              {horasTambor !== '' && Number(horasTambor) > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const h = Number(horasTambor);
                                    const rate = typeof truck.truckHourlyRate === 'number' ? truck.truckHourlyRate : 0;
                                    onUpdateTruck(truck.id, {
                                      truckHours: h,
                                      truckTotalCost: h * rate,
                                    });
                                  }}
                                  className="text-[9.5px] px-1.5 py-0.5 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/60 dark:hover:bg-blue-800/60 text-blue-800 dark:text-blue-200 rounded font-semibold transition cursor-pointer"
                                  title="Puxar Horas Tambor da Forrageira"
                                >
                                  Tambor ({horasTambor}h)
                                </button>
                              )}
                              {horasMotor !== '' && Number(horasMotor) > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const h = Number(horasMotor);
                                    const rate = typeof truck.truckHourlyRate === 'number' ? truck.truckHourlyRate : 0;
                                    onUpdateTruck(truck.id, {
                                      truckHours: h,
                                      truckTotalCost: h * rate,
                                    });
                                  }}
                                  className="text-[9.5px] px-1.5 py-0.5 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/60 dark:hover:bg-blue-800/60 text-blue-800 dark:text-blue-200 rounded font-semibold transition cursor-pointer"
                                  title="Puxar Horas Motor da Forrageira"
                                >
                                  Motor ({horasMotor}h)
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={truck.truckHours ?? ''}
                          onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          onChange={(e) => {
                            const hVal = e.target.value === '' ? '' : Number(e.target.value);
                            const hNum = typeof hVal === 'number' ? hVal : 0;
                            const rate = typeof truck.truckHourlyRate === 'number' ? truck.truckHourlyRate : 0;
                            onUpdateTruck(truck.id, { 
                              truckHours: hVal === '' ? undefined : hVal,
                              truckTotalCost: hNum * rate,
                            });
                          }}
                          placeholder="Ex: 8.5"
                          className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-500 rounded-lg text-xs font-semibold text-slate-900 dark:text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/30 shadow-2xs transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 dark:text-slate-300 mb-1">
                          Valor por Hora (R$)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={truck.truckHourlyRate ?? ''}
                          onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          onChange={(e) => {
                            const rateVal = e.target.value === '' ? '' : Number(e.target.value);
                            const rateNum = typeof rateVal === 'number' ? rateVal : 0;
                            const h = typeof truck.truckHours === 'number' ? truck.truckHours : 0;
                            onUpdateTruck(truck.id, { 
                              truckHourlyRate: rateVal === '' ? undefined : rateVal,
                              truckTotalCost: h * rateNum,
                            });
                          }}
                          placeholder="Ex: 150.00"
                          className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-500 rounded-lg text-xs font-semibold text-slate-900 dark:text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/30 shadow-2xs transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 dark:text-slate-300 mb-1">
                          Total Caminhão (R$)
                        </label>
                        <div className="w-full px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between shadow-2xs">
                          <span className="font-mono text-blue-900 dark:text-blue-300 font-extrabold">
                            {formatCurrencyBRL((truck.truckHours || 0) * (truck.truckHourlyRate || 0))}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-500">
                            {truck.truckHours || 0}h × R$ {truck.truckHourlyRate || 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Bloco de Adicional KM (Exclusivo quando Alqueires) */}
                {unidadeArea === 'alqueires' && (
                  <div className="w-full max-w-full bg-amber-50/70 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800/60 rounded-lg p-3 space-y-2 mt-2 shadow-xs overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-amber-600" />
                        Adicional KM (Cobrado do Cliente)
                      </span>
                      <span className="text-[10px] bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded font-medium">
                        Especial Alqueires
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 dark:text-slate-300 mb-1">
                          KM Adicional
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={truck.additionalKm ?? ''}
                          onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          onChange={(e) => {
                            const km = e.target.value === '' ? 0 : Number(e.target.value);
                            const updates: Partial<ServiceTruckItem> = {
                              additionalKm: km,
                              totalAdditionalKm: km * (truck.ratePerKm || 0),
                            };
                            if (truck.driverCommissionMode === 'km') {
                              const comm = calculateTruckFreightCommission('km', {
                                ...truck,
                                additionalKm: km,
                                driverCommissionBase: km,
                              }, pesoPorM3);
                              updates.driverCommissionBase = km;
                              updates.driverCommission = comm.total;
                            }
                            onUpdateTruck(truck.id, updates);
                          }}
                          placeholder="Ex: 40"
                          className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-500 rounded-lg text-xs font-semibold text-slate-900 dark:text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/30 shadow-2xs transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 dark:text-slate-300 mb-1">
                          R$ / KM
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={truck.ratePerKm ?? ''}
                          onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          onChange={(e) => {
                            const rate = e.target.value === '' ? 0 : Number(e.target.value);
                            onUpdateTruck(truck.id, { 
                              ratePerKm: rate,
                              totalAdditionalKm: (truck.additionalKm || 0) * rate,
                            });
                          }}
                          placeholder="Ex: 5.50"
                          className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-500 rounded-lg text-xs font-semibold text-slate-900 dark:text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/30 shadow-2xs transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 dark:text-slate-300 mb-1">
                          Total Adicional KM
                        </label>
                        <div className="w-full px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between shadow-2xs">
                          <span className="font-mono">{formatCurrencyBRL(truck.totalAdditionalKm || 0)}</span>
                          <span className="text-[10px] font-semibold text-slate-500">
                            {truck.additionalKm || 0} km
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* BOTÃO DINÂMICO DE ADICIONAR CAMINHÃO (LOGO ABAIXO DO ÚLTIMO CARD) */}
          <div className="pt-2">
            <button
              type="button"
              onClick={onAddTruck}
              className="w-full py-2.5 px-4 border-2 border-dashed border-emerald-600/70 hover:border-emerald-600 bg-emerald-50/80 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-2xs cursor-pointer group"
            >
              <div className="w-5 h-5 rounded-full bg-emerald-800 text-white flex items-center justify-center group-hover:scale-110 transition-transform">
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
              </div>
              <span>+ Adicionar frota/caminhão</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
