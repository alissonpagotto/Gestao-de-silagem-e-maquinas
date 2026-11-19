import React from 'react';
import { 
  Gauge, 
  Car, 
  UserCheck, 
  Users, 
  Fuel, 
  Wrench, 
  AlertTriangle, 
  CheckCircle2, 
  AlertCircle, 
  TrendingUp, 
  Plus, 
  ArrowUpRight,
  Clock,
  ShieldAlert,
  Droplets,
  Calendar
} from 'lucide-react';
import { Machinery, Employee, FuelLog, MaintenanceLog, Expense } from '../../types';
import { formatCurrencyBRL, formatDateBR, checkCnhStatus } from '../../lib/storage';

interface FleetDashboardProps {
  machineries: Machinery[];
  employees: Employee[];
  fuelLogs: FuelLog[];
  maintenanceLogs: MaintenanceLog[];
  expenses: Expense[];
  onNavigateSubtab: (tab: 'painel' | 'veiculos' | 'motoristas' | 'equipe' | 'combustivel' | 'manutencoes') => void;
  onOpenNewVehicle: () => void;
  onOpenNewFuel: () => void;
  onOpenNewMaintenance: () => void;
}

export const FleetDashboard: React.FC<FleetDashboardProps> = ({
  machineries,
  employees,
  fuelLogs,
  maintenanceLogs,
  expenses,
  onNavigateSubtab,
  onOpenNewVehicle,
  onOpenNewFuel,
  onOpenNewMaintenance,
}) => {
  // Vehicle stats
  const totalVehicles = machineries.length;
  const operationalCount = machineries.filter(m => m.status === 'operacional').length;
  const maintenanceCount = machineries.filter(m => m.status === 'em_manutencao').length;
  const availableCount = machineries.filter(m => m.status === 'disponivel').length;
  const stoppedCount = machineries.filter(m => m.status === 'parado').length;

  const trucksCount = machineries.filter(m => m.categoryType === 'caminhao').length;
  const harvestersCount = machineries.filter(m => m.categoryType === 'ensiladeira').length;
  const tractorsCount = machineries.filter(m => m.categoryType === 'trator').length;
  const supportCount = machineries.filter(m => m.categoryType === 'utilitario' || m.categoryType === 'onibus' || m.categoryType === 'outro').length;

  // Drivers & Team stats
  const drivers = employees.filter(e => 
    String(e.role ?? '').toLowerCase().includes('motorista') || 
    String(e.role ?? '').toLowerCase().includes('transporte') ||
    Boolean(e.cnhNumber)
  );
  const teamMembers = employees.filter(e => !drivers.some(d => d.id === e.id));
  const cnhReport = checkCnhStatus(employees);

  // Fuel stats (NaN-safe)
  const rawFuelLiters = fuelLogs.reduce((acc, curr) => {
    const litersVal = Number(curr?.liters ?? 0);
    return acc + (Number.isFinite(litersVal) ? litersVal : 0);
  }, 0);
  const totalFuelLiters = Number.isFinite(rawFuelLiters) ? rawFuelLiters : 0;

  const rawFuelAmount = fuelLogs.reduce((acc, curr) => {
    const amountVal = Number(curr?.totalAmount ?? 0);
    return acc + (Number.isFinite(amountVal) ? amountVal : 0);
  }, 0);
  const totalFuelAmount = Number.isFinite(rawFuelAmount) ? rawFuelAmount : 0;

  const rawAvgDieselPrice = totalFuelLiters > 0 ? totalFuelAmount / totalFuelLiters : 0;
  const avgDieselPrice = Number.isFinite(rawAvgDieselPrice) ? rawAvgDieselPrice : 0;

  // Maintenance stats (NaN-safe)
  const rawMaintAmount = maintenanceLogs.reduce((acc, curr) => {
    const costVal = Number(curr?.totalCost ?? 0);
    return acc + (Number.isFinite(costVal) ? costVal : 0);
  }, 0);
  const totalMaintenanceAmount = Number.isFinite(rawMaintAmount) ? rawMaintAmount : 0;
  const activeMaintenances = maintenanceLogs.filter(m => m.status === 'em_andamento').length;

  // Calculate costs per vehicle
  const vehicleCosts: { [plate: string]: { fuel: number; maintenance: number; total: number; name: string } } = {};
  machineries.forEach(m => {
    const key = m.licensePlateOrSerial || m.name;
    vehicleCosts[key] = { fuel: 0, maintenance: 0, total: 0, name: m.model || m.name };
  });

  fuelLogs.forEach(f => {
    const mach = machineries.find(m => m.id === f.machineryId);
    const key = mach ? (mach.licensePlateOrSerial || mach.name) : f.machineryPlateOrName;
    if (!vehicleCosts[key]) {
      vehicleCosts[key] = { fuel: 0, maintenance: 0, total: 0, name: f.machineryPlateOrName };
    }
    vehicleCosts[key].fuel += f.totalAmount;
    vehicleCosts[key].total += f.totalAmount;
  });

  maintenanceLogs.forEach(m => {
    const mach = machineries.find(v => v.id === m.machineryId);
    const key = mach ? (mach.licensePlateOrSerial || mach.name) : m.machineryPlateOrName;
    if (!vehicleCosts[key]) {
      vehicleCosts[key] = { fuel: 0, maintenance: 0, total: 0, name: m.machineryPlateOrName };
    }
    vehicleCosts[key].maintenance += m.totalCost;
    vehicleCosts[key].total += m.totalCost;
  });

  const sortedVehicleCosts = Object.entries(vehicleCosts)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5);

  return (
    <div id="fleet-dashboard-panel" className="space-y-3 sm:space-y-3.5 animate-in fade-in duration-200">
      {/* Top 4 KPI Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        
        {/* Card 1: FROTA TOTAL */}
        <div 
          onClick={() => onNavigateSubtab('veiculos')}
          className="bg-[#e0e6f1]! dark:bg-stone-900! border border-black! border-l-4 border-l-emerald-700! dark:border-stone-700! rounded-xl py-2.5 px-3 shadow-xs hover:bg-[#d4deee]! dark:hover:bg-stone-800/90! transition-colors cursor-pointer group text-black dark:text-white"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black tracking-wider text-slate-800 dark:text-stone-300 uppercase leading-none">
              FROTA TOTAL
            </span>
            <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-stone-800 text-emerald-800 dark:text-emerald-300 border border-black/20 flex items-center justify-center group-hover:scale-105 transition shrink-0">
              <Car className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black text-slate-950 dark:text-white mt-1 leading-tight font-['Outfit']">
            {totalVehicles} <span className="text-[11px] font-bold text-slate-700 dark:text-stone-400">veículos</span>
          </div>
          <div className="flex items-center space-x-1.5 text-[10.5px] text-slate-800 dark:text-stone-300 font-semibold mt-0.5 leading-tight">
            <span className="inline-flex items-center text-emerald-800 dark:text-emerald-300 font-black">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1"></span>
              {operationalCount + availableCount} ativos
            </span>
            <span>•</span>
            <span className="text-amber-800 dark:text-amber-300 font-black">{maintenanceCount} na oficina</span>
          </div>
        </div>

        {/* Card 2: MOTORISTAS & EQUIPE */}
        <div 
          onClick={() => onNavigateSubtab('motoristas')}
          className="bg-[#e0e6f1]! dark:bg-stone-900! border border-black! border-l-4 border-l-blue-700! dark:border-stone-700! rounded-xl py-2.5 px-3 shadow-xs hover:bg-[#d4deee]! dark:hover:bg-stone-800/90! transition-colors cursor-pointer group text-black dark:text-white"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black tracking-wider text-slate-800 dark:text-stone-300 uppercase leading-none">
              MOTORISTAS & EQUIPE
            </span>
            <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-stone-800 text-blue-800 dark:text-blue-300 border border-black/20 flex items-center justify-center group-hover:scale-105 transition shrink-0">
              <UserCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black text-slate-950 dark:text-white mt-1 leading-tight font-['Outfit']">
            {employees.length} <span className="text-[11px] font-bold text-slate-700 dark:text-stone-400">colaboradores</span>
          </div>
          <div className="flex items-center space-x-1.5 text-[10.5px] text-slate-800 dark:text-stone-300 font-semibold mt-0.5 leading-tight">
            <span className="font-black text-blue-800 dark:text-blue-300">{drivers.length} motoristas</span>
            <span>•</span>
            <span className="font-bold text-slate-900 dark:text-white">{teamMembers.length} operadores</span>
          </div>
        </div>

        {/* Card 3: COMBUSTÍVEL ACUMULADO */}
        <div 
          onClick={() => onNavigateSubtab('combustivel')}
          className="bg-[#e0e6f1]! dark:bg-stone-900! border border-black! border-l-4 border-l-amber-600! dark:border-stone-700! rounded-xl py-2.5 px-3 shadow-xs hover:bg-[#d4deee]! dark:hover:bg-stone-800/90! transition-colors cursor-pointer group text-black dark:text-white"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black tracking-wider text-slate-800 dark:text-stone-300 uppercase leading-none">
              COMBUSTÍVEL ACUMULADO
            </span>
            <div className="w-6 h-6 rounded-lg bg-amber-100 dark:bg-stone-800 text-amber-800 dark:text-amber-300 border border-black/20 flex items-center justify-center group-hover:scale-105 transition shrink-0">
              <Fuel className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black text-slate-950 dark:text-white mt-1 leading-tight font-['Outfit']">
            {formatCurrencyBRL(totalFuelAmount)}
          </div>
          <div className="flex items-center space-x-1.5 text-[10.5px] text-slate-800 dark:text-stone-300 font-semibold mt-0.5 leading-tight">
            <span className="font-black text-amber-800 dark:text-amber-300">
              {(Number.isFinite(totalFuelLiters) ? totalFuelLiters : 0).toLocaleString('pt-BR')} L
            </span>
            <span>•</span>
            <span className="text-slate-700 dark:text-stone-300">
              Média {formatCurrencyBRL(Number.isFinite(avgDieselPrice) ? avgDieselPrice : 0)}/L
            </span>
          </div>
        </div>

        {/* Card 4: MANUTENÇÕES & OFICINA */}
        <div 
          onClick={() => onNavigateSubtab('manutencoes')}
          className="bg-[#e0e6f1]! dark:bg-stone-900! border border-black! border-l-4 border-l-indigo-700! dark:border-stone-700! rounded-xl py-2.5 px-3 shadow-xs hover:bg-[#d4deee]! dark:hover:bg-stone-800/90! transition-colors cursor-pointer group text-black dark:text-white"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black tracking-wider text-slate-800 dark:text-stone-300 uppercase leading-none">
              MANUTENÇÕES & OFICINA
            </span>
            <div className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-stone-800 text-indigo-800 dark:text-indigo-300 border border-black/20 flex items-center justify-center group-hover:scale-105 transition shrink-0">
              <Wrench className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black text-slate-950 dark:text-white mt-1 leading-tight font-['Outfit']">
            {formatCurrencyBRL(totalMaintenanceAmount)}
          </div>
          <div className="flex items-center space-x-1.5 text-[10.5px] text-slate-800 dark:text-stone-300 font-semibold mt-0.5 leading-tight">
            <span className="font-black text-indigo-800 dark:text-indigo-300">{maintenanceLogs.length} ordens</span>
            {activeMaintenances > 0 && (
              <span className="text-rose-700 dark:text-rose-400 font-black">• {activeMaintenances} abertas</span>
            )}
          </div>
        </div>

      </section>

      {/* CNH & Revision Alerts Section */}
      {(cnhReport.expired.length > 0 || cnhReport.expiringSoon.length > 0 || maintenanceCount > 0) && (
        <section>
          <article className="bg-[#e0e6f1]! dark:bg-stone-900! border border-black! dark:border-stone-700! rounded-xl overflow-hidden shadow-xs">
          <div className="bg-[#cad4e6]! dark:bg-stone-800/90! border-b border-black! dark:border-stone-700! px-3.5 py-2 flex items-center space-x-1.5 text-slate-950 dark:text-stone-100 font-black text-xs uppercase tracking-wider">
            <ShieldAlert className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
            <span>Alertas de Conformidade e Atenção da Frota</span>
          </div>

          <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
            {/* CNH Expirada */}
            {cnhReport.expired.map(emp => (
              <div 
                key={emp.id}
                onClick={() => onNavigateSubtab('motoristas')}
                className="bg-white/75 hover:bg-white/95 dark:bg-stone-800/90 p-2 sm:p-2.5 rounded-lg border border-black/25 border-l-4 border-l-red-600 dark:border-stone-700 flex items-center justify-between cursor-pointer transition-colors"
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-6 h-6 rounded-md bg-red-100 dark:bg-red-950/60 text-red-700 flex items-center justify-center font-black text-[10px] border border-red-300 dark:border-red-900/60 shrink-0">
                    CNH
                  </div>
                  <div className="min-w-0">
                    <h5 className="text-xs font-bold text-slate-900 dark:text-stone-100 truncate">{emp.name}</h5>
                    <p className="text-[10px] text-red-700 dark:text-red-400 font-semibold">
                      CNH Vencida em {formatDateBR(emp.cnhExpiration)} (Cat. {emp.cnhCategory})
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-red-800 bg-red-100 dark:bg-red-950/80 dark:text-red-300 px-2 py-0.5 rounded-md border border-red-300 dark:border-red-900/60 shrink-0">
                  Regularizar
                </span>
              </div>
            ))}

            {/* CNH a vencer em 30 dias */}
            {cnhReport.expiringSoon.map(emp => (
              <div 
                key={emp.id}
                onClick={() => onNavigateSubtab('motoristas')}
                className="bg-white/75 hover:bg-white/95 dark:bg-stone-800/90 p-2 sm:p-2.5 rounded-lg border border-black/25 border-l-4 border-l-amber-500 dark:border-stone-700 flex items-center justify-between cursor-pointer transition-colors"
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-6 h-6 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-700 flex items-center justify-center font-black text-[10px] border border-amber-300 dark:border-amber-900/60 shrink-0">
                    CNH
                  </div>
                  <div className="min-w-0">
                    <h5 className="text-xs font-bold text-slate-900 dark:text-stone-100 truncate">{emp.name}</h5>
                    <p className="text-[10px] text-amber-800 dark:text-amber-400 font-semibold">
                      Vence em breve: {formatDateBR(emp.cnhExpiration)}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 dark:bg-amber-950/80 dark:text-amber-300 px-2 py-0.5 rounded-md border border-amber-300 dark:border-amber-900/60 shrink-0">
                  Aviso 30d
                </span>
              </div>
            ))}

            {/* Veículos na oficina */}
            {machineries.filter(m => m.status === 'em_manutencao').map(m => (
              <div 
                key={m.id}
                onClick={() => onNavigateSubtab('manutencoes')}
                className="bg-white/75 hover:bg-white/95 dark:bg-stone-800/90 p-2 sm:p-2.5 rounded-lg border border-black/25 border-l-4 border-l-indigo-600 dark:border-stone-700 flex items-center justify-between cursor-pointer transition-colors"
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-6 h-6 rounded-md bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 flex items-center justify-center font-bold text-[10px] border border-indigo-300 dark:border-indigo-900/60 shrink-0">
                    <Wrench className="w-3 h-3" />
                  </div>
                  <div className="min-w-0">
                    <h5 className="text-xs font-bold text-slate-900 dark:text-stone-100 truncate">
                      {m.licensePlateOrSerial ? `[${m.licensePlateOrSerial}] ` : ''}{m.name || m.model}
                    </h5>
                    <p className="text-[10px] text-indigo-700 dark:text-indigo-400 font-semibold">
                      Veículo em manutenção / oficina
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-indigo-800 bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300 px-2 py-0.5 rounded-md border border-indigo-300 dark:border-indigo-800 shrink-0">
                  Ver OS
                </span>
              </div>
            ))}
          </div>
          </article>
        </section>
      )}

      {/* 2-Column Split: Top Cost Vehicles + Fleet Composition */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        
        {/* Left 2 Cols: Maiores Custos da Frota */}
        <div className="lg:col-span-2 bg-[#e0e6f1]! dark:bg-stone-900! rounded-xl border border-black! dark:border-stone-700! overflow-hidden shadow-xs flex flex-col text-black dark:text-white">
          <div className="bg-[#cad4e6]! dark:bg-stone-800/90! border-b border-black! dark:border-stone-700! px-3.5 py-2.5 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-xs sm:text-sm font-black text-slate-950 dark:text-white font-['Outfit']">
                Custo Total por Veículo (Combustível + Manutenção)
              </h3>
              <p className="text-[11px] text-slate-700 dark:text-stone-300 font-semibold">
                Veículos com maior impacto de custos na operação
              </p>
            </div>
            <button 
              type="button"
              onClick={() => onNavigateSubtab('veiculos')}
              className="text-xs font-black text-emerald-800 dark:text-emerald-400 hover:underline flex items-center space-x-1 cursor-pointer shrink-0"
            >
              <span>Ver todos</span>
              <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          </div>

          <div className="p-3 space-y-2 flex-1">
            {sortedVehicleCosts.map(([plate, data], index) => {
              const maxTotal = sortedVehicleCosts[0]?.[1]?.total || 1;
              const pct = Math.min(100, Math.round((data.total / (maxTotal || 1)) * 100));

              return (
                <div key={plate} className="p-2 sm:p-2.5 rounded-lg bg-white/70 dark:bg-stone-800/80 border border-black/20 dark:border-stone-700 space-y-1.5">
                  <div className="flex items-center justify-between text-xs gap-2">
                    <div className="flex items-center space-x-2 min-w-0">
                      <span className="w-5 h-5 rounded-md bg-[#cad4e6] dark:bg-stone-700 text-slate-950 dark:text-white border border-black/20 font-black flex items-center justify-center text-[9px] shrink-0">
                        #{index + 1}
                      </span>
                      <span className="font-black text-slate-950 dark:text-white text-xs shrink-0">{plate}</span>
                      <span className="text-slate-700 dark:text-stone-300 font-semibold text-[10px] truncate max-w-[200px]">
                        {data.name}
                      </span>
                    </div>
                    <span className="font-black text-slate-950 dark:text-white text-xs font-['Outfit'] shrink-0">
                      {formatCurrencyBRL(data.total)}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-[#cad4e6] dark:bg-stone-700 h-1.5 rounded-full overflow-hidden flex border border-black/10">
                    <div 
                      className="bg-amber-500 h-full"
                      style={{ width: `${(data.fuel / (data.total || 1)) * pct}%` }}
                      title={`Combustível: ${formatCurrencyBRL(data.fuel)}`}
                    ></div>
                    <div 
                      className="bg-indigo-600 h-full"
                      style={{ width: `${(data.maintenance / (data.total || 1)) * pct}%` }}
                      title={`Manutenção: ${formatCurrencyBRL(data.maintenance)}`}
                    ></div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-800 dark:text-stone-300 font-bold">
                    <span className="flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                      <span>Combustível: {formatCurrencyBRL(data.fuel)}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                      <span>Manutenção: {formatCurrencyBRL(data.maintenance)}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 1 Col: Distribuição por Tipo de Frota (Multi-Segmento) */}
        <div className="bg-[#e0e6f1]! dark:bg-stone-900! rounded-xl border border-black! dark:border-stone-700! overflow-hidden shadow-xs flex flex-col text-black dark:text-white">
          <div className="bg-[#cad4e6]! dark:bg-stone-800/90! border-b border-black! dark:border-stone-700! px-3.5 py-2.5">
            <h3 className="text-xs sm:text-sm font-black text-slate-950 dark:text-white font-['Outfit']">
              Composição da Frota
            </h3>
            <p className="text-[11px] text-slate-700 dark:text-stone-300 font-semibold">
              Distribuição por categoria de equipamento
            </p>
          </div>

          <div className="p-3 space-y-2 flex-1">
            <div 
              onClick={() => onNavigateSubtab('veiculos')}
              className="p-2 sm:p-2.5 rounded-lg bg-white/70 hover:bg-white/95 dark:bg-stone-800/80 dark:hover:bg-stone-800 border border-black/20 dark:border-stone-700 flex items-center justify-between cursor-pointer transition-colors"
            >
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-sky-700 text-white border border-black/30 flex items-center justify-center font-bold text-xs shrink-0">
                  🚛
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-black text-slate-950 dark:text-white truncate">Caminhões & Basculantes</h4>
                  <p className="text-[10px] text-slate-700 dark:text-stone-300 font-semibold truncate">Caçambas, carga e logística</p>
                </div>
              </div>
              <span className="text-base font-black text-slate-950 dark:text-white font-['Outfit'] shrink-0 ml-2">
                {trucksCount}
              </span>
            </div>

            <div 
              onClick={() => onNavigateSubtab('veiculos')}
              className="p-2 sm:p-2.5 rounded-lg bg-white/70 hover:bg-white/95 dark:bg-stone-800/80 dark:hover:bg-stone-800 border border-black/20 dark:border-stone-700 flex items-center justify-between cursor-pointer transition-colors"
            >
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-emerald-700 text-white border border-black/30 flex items-center justify-center font-bold text-xs shrink-0">
                  🌾
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-black text-slate-950 dark:text-white truncate">Máquinas Autopropelidas / Colhedoras</h4>
                  <p className="text-[10px] text-slate-700 dark:text-stone-300 font-semibold truncate">Colheitadeiras, forrageiras e pesadas</p>
                </div>
              </div>
              <span className="text-base font-black text-slate-950 dark:text-white font-['Outfit'] shrink-0 ml-2">
                {harvestersCount}
              </span>
            </div>

            <div 
              onClick={() => onNavigateSubtab('veiculos')}
              className="p-2 sm:p-2.5 rounded-lg bg-white/70 hover:bg-white/95 dark:bg-stone-800/80 dark:hover:bg-stone-800 border border-black/20 dark:border-stone-700 flex items-center justify-between cursor-pointer transition-colors"
            >
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-amber-600 text-white border border-black/30 flex items-center justify-center font-bold text-xs shrink-0">
                  🚜
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-black text-slate-950 dark:text-white truncate">Tratores Agrícolas</h4>
                  <p className="text-[10px] text-slate-700 dark:text-stone-300 font-semibold truncate">Tração, preparo e operações de campo</p>
                </div>
              </div>
              <span className="text-base font-black text-slate-950 dark:text-white font-['Outfit'] shrink-0 ml-2">
                {tractorsCount}
              </span>
            </div>

            <div 
              onClick={() => onNavigateSubtab('veiculos')}
              className="p-2 sm:p-2.5 rounded-lg bg-white/70 hover:bg-white/95 dark:bg-stone-800/80 dark:hover:bg-stone-800 border border-black/20 dark:border-stone-700 flex items-center justify-between cursor-pointer transition-colors"
            >
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-purple-700 text-white border border-black/30 flex items-center justify-center font-bold text-xs shrink-0">
                  🚐
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-black text-slate-950 dark:text-white truncate">Apoio, Vans & Utilitários</h4>
                  <p className="text-[10px] text-slate-700 dark:text-stone-300 font-semibold truncate">Transporte de equipe e oficina móvel</p>
                </div>
              </div>
              <span className="text-base font-black text-slate-950 dark:text-white font-['Outfit'] shrink-0 ml-2">
                {supportCount}
              </span>
            </div>
          </div>
        </div>

      </section>

      {/* Bottom Row: Últimos Abastecimentos & Últimas Manutenções */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        
        {/* Últimos Abastecimentos */}
        <div className="bg-[#e0e6f1]! dark:bg-stone-900! rounded-xl border border-black! dark:border-stone-700! overflow-hidden shadow-xs flex flex-col text-black dark:text-white">
          <div className="bg-[#cad4e6]! dark:bg-stone-800/90! border-b border-black! dark:border-stone-700! px-3.5 py-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center space-x-1.5">
              <Fuel className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
              <h3 className="text-xs sm:text-sm font-black text-slate-950 dark:text-white font-['Outfit']">
                Últimos Abastecimentos
              </h3>
            </div>
            <button 
              type="button"
              onClick={() => onNavigateSubtab('combustivel')}
              className="text-xs font-black text-emerald-800 dark:text-emerald-400 hover:underline flex items-center space-x-1 cursor-pointer shrink-0"
            >
              <span>Ver todos ({fuelLogs.length})</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-3 space-y-2 flex-1">
            {fuelLogs.slice(0, 4).map((log) => (
              <div key={log.id} className="p-2 sm:p-2.5 rounded-lg border border-black/20 dark:border-stone-700 flex items-center justify-between gap-2 bg-white/70 dark:bg-stone-800/80 text-black dark:text-white">
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-xs text-slate-950 dark:text-white truncate">
                      {log.machineryPlateOrName || (log as any).vehiclePlate || (log as any).vehicleName || 'Veículo'}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#cad4e6] dark:bg-amber-950/60 text-slate-950 dark:text-amber-300 border border-black/25 dark:border-amber-800 font-black shrink-0">
                      {log.fuelType}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-700 dark:text-stone-300 font-semibold mt-0.5 truncate">
                    {formatDateBR(log.date)} • {log.liters} L • {log.driverOrOperator || 'Sem motorista'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs sm:text-sm font-black text-slate-950 dark:text-white block font-['Outfit']">
                    {formatCurrencyBRL(log.totalAmount)}
                  </span>
                  <span className="text-[9px] text-slate-700 dark:text-stone-400 font-bold">
                    {formatCurrencyBRL(log.pricePerLiter)}/L
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Últimas Manutenções */}
        <div className="bg-[#e0e6f1]! dark:bg-stone-900! rounded-xl border border-black! dark:border-stone-700! overflow-hidden shadow-xs flex flex-col text-black dark:text-white">
          <div className="bg-[#cad4e6]! dark:bg-stone-800/90! border-b border-black! dark:border-stone-700! px-3.5 py-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center space-x-1.5">
              <Wrench className="w-4 h-4 text-indigo-700 dark:text-indigo-400 shrink-0" />
              <h3 className="text-xs sm:text-sm font-black text-slate-950 dark:text-white font-['Outfit']">
                Últimas Ordens de Manutenção
              </h3>
            </div>
            <button 
              type="button"
              onClick={() => onNavigateSubtab('manutencoes')}
              className="text-xs font-black text-emerald-800 dark:text-emerald-400 hover:underline flex items-center space-x-1 cursor-pointer shrink-0"
            >
              <span>Ver todas ({maintenanceLogs.length})</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-3 space-y-2 flex-1">
            {maintenanceLogs.slice(0, 4).map((m) => (
              <div key={m.id} className="p-2 sm:p-2.5 rounded-lg border border-black/20 dark:border-stone-700 flex items-center justify-between gap-2 bg-white/70 dark:bg-stone-800/80 text-black dark:text-white">
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-xs text-slate-950 dark:text-white truncate">
                      {m.machineryPlateOrName || (m as any).vehiclePlate || (m as any).vehicleName || 'Veículo'}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#cad4e6] dark:bg-indigo-950/60 text-slate-950 dark:text-indigo-300 border border-black/25 dark:border-indigo-800 font-black shrink-0">
                      {m.serviceCategory}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-700 dark:text-stone-300 font-semibold mt-0.5 line-clamp-1">
                    {formatDateBR(m.date)} • {m.description}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs sm:text-sm font-black text-slate-950 dark:text-white block font-['Outfit']">
                    {formatCurrencyBRL(m.totalCost)}
                  </span>
                  <span className={`text-[9px] font-black ${m.status === 'concluida' ? 'text-emerald-800 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                    {m.status === 'concluida' ? 'Concluída' : 'Em andamento'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </section>

    </div>
  );
};
