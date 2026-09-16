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
    e.role.toLowerCase().includes('motorista') || 
    e.role.toLowerCase().includes('transporte') ||
    Boolean(e.cnhNumber)
  );
  const teamMembers = employees.filter(e => !drivers.some(d => d.id === e.id));
  const cnhReport = checkCnhStatus(employees);

  // Fuel stats
  const totalFuelLiters = fuelLogs.reduce((acc, curr) => acc + curr.liters, 0);
  const totalFuelAmount = fuelLogs.reduce((acc, curr) => acc + curr.totalAmount, 0);
  const avgDieselPrice = totalFuelLiters > 0 ? totalFuelAmount / totalFuelLiters : 5.85;

  // Maintenance stats
  const totalMaintenanceAmount = maintenanceLogs.reduce((acc, curr) => acc + curr.totalCost, 0);
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
    <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-200">
      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        
        {/* Card 1: TOTAL DE VEÍCULOS */}
        <div 
          onClick={() => onNavigateSubtab('veiculos')}
          className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-3 sm:p-3.5 shadow-xs hover:border-blue-300 transition cursor-pointer group text-black dark:text-white"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black tracking-wider text-black dark:text-stone-300 uppercase">
              FROTA TOTAL
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-stone-800 text-blue-900 dark:text-blue-300 flex items-center justify-center group-hover:scale-110 transition">
              <Car className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-black dark:text-white mt-0.5 font-['Outfit']">
            {totalVehicles} <span className="text-[11px] font-black text-black/70 dark:text-stone-400">veículos</span>
          </div>
          <div className="flex items-center space-x-1.5 text-[11px] text-black dark:text-stone-300 font-medium mt-1">
            <span className="inline-flex items-center text-emerald-950 dark:text-emerald-300 font-black">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1"></span>
              {operationalCount + availableCount} ativos
            </span>
            <span>•</span>
            <span className="text-amber-950 dark:text-amber-300 font-black">{maintenanceCount} na oficina</span>
          </div>
        </div>

        {/* Card 2: MOTORISTAS & EQUIPE */}
        <div 
          onClick={() => onNavigateSubtab('motoristas')}
          className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-3 sm:p-3.5 shadow-xs hover:border-blue-300 transition cursor-pointer group text-black dark:text-white"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black tracking-wider text-black dark:text-stone-300 uppercase">
              MOTORISTAS & EQUIPE
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-stone-800 text-blue-900 dark:text-blue-300 flex items-center justify-center group-hover:scale-110 transition">
              <UserCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-black dark:text-white mt-0.5 font-['Outfit']">
            {employees.length} <span className="text-[11px] font-black text-black/70 dark:text-stone-400">colaboradores</span>
          </div>
          <div className="flex items-center space-x-1.5 text-[11px] text-black dark:text-stone-300 font-medium mt-1">
            <span className="font-black text-blue-950 dark:text-blue-300">{drivers.length} motoristas</span>
            <span>•</span>
            <span className="font-black text-black dark:text-white">{teamMembers.length} operadores</span>
          </div>
        </div>

        {/* Card 3: COMBUSTÍVEL DIESEL */}
        <div 
          onClick={() => onNavigateSubtab('combustivel')}
          className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-3 sm:p-3.5 shadow-xs hover:border-amber-300 transition cursor-pointer group text-black dark:text-white"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black tracking-wider text-black dark:text-stone-300 uppercase">
              COMBUSTÍVEL ACUMULADO
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-stone-800 text-amber-900 dark:text-amber-300 flex items-center justify-center group-hover:scale-110 transition">
              <Fuel className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-black dark:text-white mt-0.5 font-['Outfit']">
            {formatCurrencyBRL(totalFuelAmount)}
          </div>
          <div className="flex items-center space-x-1.5 text-[11px] text-black dark:text-stone-300 font-medium mt-1">
            <span className="font-black text-amber-950 dark:text-amber-300">{totalFuelLiters.toLocaleString('pt-BR')} L</span>
            <span>•</span>
            <span className="text-black/90 dark:text-stone-300">Média {formatCurrencyBRL(avgDieselPrice)}/L</span>
          </div>
        </div>

        {/* Card 4: MANUTENÇÕES */}
        <div 
          onClick={() => onNavigateSubtab('manutencoes')}
          className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-3 sm:p-3.5 shadow-xs hover:border-indigo-300 transition cursor-pointer group text-black dark:text-white"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black tracking-wider text-black dark:text-stone-300 uppercase">
              MANUTENÇÕES & OFICINA
            </span>
            <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-stone-800 text-indigo-900 dark:text-indigo-300 flex items-center justify-center group-hover:scale-110 transition">
              <Wrench className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-black dark:text-white mt-0.5 font-['Outfit']">
            {formatCurrencyBRL(totalMaintenanceAmount)}
          </div>
          <div className="flex items-center space-x-1.5 text-[11px] text-black dark:text-stone-300 font-medium mt-1">
            <span className="font-black text-indigo-950 dark:text-indigo-300">{maintenanceLogs.length} ordens</span>
            {activeMaintenances > 0 && (
              <span className="text-rose-900 dark:text-rose-400 font-black">• {activeMaintenances} abertas</span>
            )}
          </div>
        </div>

      </div>

      {/* CNH & Revision Alerts Section */}
      {(cnhReport.expired.length > 0 || cnhReport.expiringSoon.length > 0 || maintenanceCount > 0) && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-3 sm:p-3.5 space-y-2">
          <div className="flex items-center space-x-1.5 text-amber-800 dark:text-amber-300 font-bold text-xs">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Alertas de Conformidade e Atenção da Frota</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {/* CNH Expirada */}
            {cnhReport.expired.map(emp => (
              <div 
                key={emp.id}
                onClick={() => onNavigateSubtab('motoristas')}
                className="bg-white dark:bg-stone-900 p-2 sm:p-2.5 rounded-xl border border-rose-200 dark:border-rose-800 flex items-center justify-between cursor-pointer hover:shadow-xs transition"
              >
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center font-bold text-[10px]">
                    CNH
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-stone-900 dark:text-stone-100">{emp.name}</h5>
                    <p className="text-[10px] text-rose-600 font-semibold">
                      CNH Vencida em {formatDateBR(emp.cnhExpiration)} (Cat. {emp.cnhCategory})
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950 px-2 py-0.5 rounded-lg">
                  Regularizar
                </span>
              </div>
            ))}

            {/* CNH a vencer em 30 dias */}
            {cnhReport.expiringSoon.map(emp => (
              <div 
                key={emp.id}
                onClick={() => onNavigateSubtab('motoristas')}
                className="bg-white dark:bg-stone-900 p-2 sm:p-2.5 rounded-xl border border-amber-200 dark:border-amber-800 flex items-center justify-between cursor-pointer hover:shadow-xs transition"
              >
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center font-bold text-[10px]">
                    CNH
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-stone-900 dark:text-stone-100">{emp.name}</h5>
                    <p className="text-[10px] text-amber-600 font-semibold">
                      Vence em breve: {formatDateBR(emp.cnhExpiration)}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-lg">
                  Aviso 30d
                </span>
              </div>
            ))}

            {/* Veículos na oficina */}
            {machineries.filter(m => m.status === 'em_manutencao').map(m => (
              <div 
                key={m.id}
                onClick={() => onNavigateSubtab('manutencoes')}
                className="bg-white dark:bg-stone-900 p-2 sm:p-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 flex items-center justify-between cursor-pointer hover:shadow-xs transition"
              >
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center font-bold text-[10px]">
                    <Wrench className="w-3 h-3" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-stone-900 dark:text-stone-100">
                      {m.licensePlateOrSerial ? `[${m.licensePlateOrSerial}] ` : ''}{m.name || m.model}
                    </h5>
                    <p className="text-[10px] text-indigo-600 font-semibold">
                      Veículo em manutenção / oficina
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-lg">
                  Ver OS
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2-Column Split: Top Cost Vehicles + Quick Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        
        {/* Left 2 Cols: Maiores Custos da Frota */}
        <div className="lg:col-span-2 crm-card bg-[#87AFE3] dark:bg-stone-900 rounded-xl border border-blue-200/80 dark:border-stone-800 p-3.5 sm:p-4 shadow-xs space-y-2.5 text-black dark:text-white">
          <div className="flex items-center justify-between border-b border-blue-200/80 dark:border-stone-800 pb-2">
            <div>
              <h3 className="text-xs sm:text-sm font-black text-black dark:text-white font-['Outfit']">
                Custo Total por Veículo (Combustível + Manutenção)
              </h3>
              <p className="text-[11px] text-black/90 dark:text-stone-300 font-bold">
                Veículos com maior impacto de custos na operação
              </p>
            </div>
            <button 
              onClick={() => onNavigateSubtab('veiculos')}
              className="text-xs font-black text-blue-950 dark:text-sky-400 hover:underline flex items-center space-x-1 cursor-pointer"
            >
              <span>Ver todos</span>
              <ArrowUpRight className="w-3 h-3 stroke-[2.5]" />
            </button>
          </div>

          <div className="space-y-2">
            {sortedVehicleCosts.map(([plate, data], index) => {
              const maxTotal = sortedVehicleCosts[0]?.[1]?.total || 1;
              const pct = Math.min(100, Math.round((data.total / (maxTotal || 1)) * 100));

              return (
                <div key={plate} className="p-2 sm:p-2.5 rounded-xl bg-white/70 dark:bg-stone-800/80 border border-blue-200/70 dark:border-stone-700 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="w-4 h-4 rounded-md bg-blue-100 dark:bg-stone-700 text-black dark:text-white font-black flex items-center justify-center text-[9px]">
                        #{index + 1}
                      </span>
                      <span className="font-black text-black dark:text-white text-xs">{plate}</span>
                      <span className="text-black/80 dark:text-stone-300 font-bold text-[10px] truncate max-w-[180px]">
                        {data.name}
                      </span>
                    </div>
                    <span className="font-black text-black dark:text-white text-xs font-['Outfit']">
                      {formatCurrencyBRL(data.total)}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-blue-100 dark:bg-stone-700 h-1.5 rounded-full overflow-hidden flex">
                    <div 
                      className="bg-amber-500 h-full"
                      style={{ width: `${(data.fuel / (data.total || 1)) * pct}%` }}
                      title={`Combustível: ${formatCurrencyBRL(data.fuel)}`}
                    ></div>
                    <div 
                      className="bg-indigo-500 h-full"
                      style={{ width: `${(data.maintenance / (data.total || 1)) * pct}%` }}
                      title={`Manutenção: ${formatCurrencyBRL(data.maintenance)}`}
                    ></div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-black dark:text-stone-300 font-bold">
                    <span className="flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                      <span>Diesel: {formatCurrencyBRL(data.fuel)}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                      <span>Manutenção: {formatCurrencyBRL(data.maintenance)}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 1 Col: Distribuição por Tipo de Frota */}
        <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 rounded-xl border border-blue-200/80 dark:border-stone-800 p-3.5 sm:p-4 shadow-xs space-y-2.5 text-black dark:text-white">
          <div className="border-b border-blue-200/80 dark:border-stone-800 pb-2">
            <h3 className="text-xs sm:text-sm font-black text-black dark:text-white font-['Outfit']">
              Composição da Frota
            </h3>
            <p className="text-[11px] text-black/90 dark:text-stone-300 font-bold">
              Distribuição por categoria de equipamento
            </p>
          </div>

          <div className="space-y-2">
            <div 
              onClick={() => onNavigateSubtab('veiculos')}
              className="p-2 sm:p-2.5 rounded-xl bg-white/70 dark:bg-stone-800/80 border border-blue-200/70 dark:border-stone-700 flex items-center justify-between cursor-pointer hover:scale-[1.01] transition"
            >
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold text-xs">
                  🚛
                </div>
                <div>
                  <h4 className="text-xs font-black text-black dark:text-white">Caminhões de Silagem</h4>
                  <p className="text-[10px] text-black/80 dark:text-stone-300 font-bold">Basculantes e caçambas</p>
                </div>
              </div>
              <span className="text-base font-black text-black dark:text-white font-['Outfit']">
                {trucksCount}
              </span>
            </div>

            <div 
              onClick={() => onNavigateSubtab('veiculos')}
              className="p-2 sm:p-2.5 rounded-xl bg-white/70 dark:bg-stone-800/80 border border-blue-200/70 dark:border-stone-700 flex items-center justify-between cursor-pointer hover:scale-[1.01] transition"
            >
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                  🌽
                </div>
                <div>
                  <h4 className="text-xs font-black text-black dark:text-white">Ensiladeiras Autopropelidas</h4>
                  <p className="text-[10px] text-black/80 dark:text-stone-300 font-bold">Claas Jaguar / John Deere</p>
                </div>
              </div>
              <span className="text-base font-black text-black dark:text-white font-['Outfit']">
                {harvestersCount}
              </span>
            </div>

            <div 
              onClick={() => onNavigateSubtab('veiculos')}
              className="p-2 sm:p-2.5 rounded-xl bg-white/70 dark:bg-stone-800/80 border border-blue-200/70 dark:border-stone-700 flex items-center justify-between cursor-pointer hover:scale-[1.01] transition"
            >
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold text-xs">
                  🚜
                </div>
                <div>
                  <h4 className="text-xs font-black text-black dark:text-white">Tratores Agrícolas</h4>
                  <p className="text-[10px] text-black/80 dark:text-stone-300 font-bold">Corte, carga e compactação</p>
                </div>
              </div>
              <span className="text-base font-black text-black dark:text-white font-['Outfit']">
                {tractorsCount}
              </span>
            </div>

            <div 
              onClick={() => onNavigateSubtab('veiculos')}
              className="p-2 sm:p-2.5 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-between cursor-pointer hover:scale-[1.01] transition"
            >
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-lg bg-purple-600 text-white flex items-center justify-center font-bold text-xs">
                  🚐
                </div>
                <div>
                  <h4 className="text-xs font-bold text-black">Apoio, Vans & Ônibus</h4>
                  <p className="text-[10px] text-purple-800 font-medium">Transporte de equipe e oficina</p>
                </div>
              </div>
              <span className="text-base font-black text-purple-800 font-['Outfit']">
                {supportCount}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* Bottom Row: Últimos Abastecimentos & Últimas Manutenções */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        
        {/* Últimos Abastecimentos */}
        <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 rounded-xl border border-slate-400 dark:border-stone-800 p-3.5 sm:p-4 shadow-xs space-y-2.5 text-black dark:text-white">
          <div className="flex items-center justify-between border-b border-slate-400/80 dark:border-stone-800 pb-2">
            <div className="flex items-center space-x-1.5">
              <Fuel className="w-3.5 h-3.5 text-black dark:text-amber-500" />
              <h3 className="text-xs sm:text-sm font-black text-black dark:text-white font-['Outfit']">
                Últimos Abastecimentos
              </h3>
            </div>
            <button 
              onClick={() => onNavigateSubtab('combustivel')}
              className="text-xs font-bold text-black dark:text-amber-400 hover:underline flex items-center space-x-1 cursor-pointer"
            >
              <span>Ver todos ({fuelLogs.length})</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2">
            {fuelLogs.slice(0, 4).map((log) => (
              <div key={log.id} className="p-2 sm:p-2.5 rounded-xl border border-slate-300 dark:border-stone-700 flex items-center justify-between bg-white/80 dark:bg-stone-800/80 text-black dark:text-white">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-xs text-black dark:text-white">
                      {log.machineryPlateOrName}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-white dark:bg-amber-950/60 text-black dark:text-amber-300 border border-slate-300 dark:border-amber-800 font-black">
                      {log.fuelType}
                    </span>
                  </div>
                  <p className="text-[10px] text-black/90 dark:text-stone-300 font-semibold mt-0.5">
                    {formatDateBR(log.date)} • {log.liters} L • {log.driverOrOperator || 'Sem motorista'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs sm:text-sm font-black text-black dark:text-white block font-['Outfit']">
                    {formatCurrencyBRL(log.totalAmount)}
                  </span>
                  <span className="text-[9px] text-black/80 dark:text-stone-400 font-bold">
                    {formatCurrencyBRL(log.pricePerLiter)}/L
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Últimas Manutenções */}
        <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 rounded-xl border border-slate-400 dark:border-stone-800 p-3.5 sm:p-4 shadow-xs space-y-2.5 text-black dark:text-white">
          <div className="flex items-center justify-between border-b border-slate-400/80 dark:border-stone-800 pb-2">
            <div className="flex items-center space-x-1.5">
              <Wrench className="w-3.5 h-3.5 text-black dark:text-indigo-400" />
              <h3 className="text-xs sm:text-sm font-black text-black dark:text-white font-['Outfit']">
                Últimas Ordens de Manutenção
              </h3>
            </div>
            <button 
              onClick={() => onNavigateSubtab('manutencoes')}
              className="text-xs font-bold text-black dark:text-indigo-400 hover:underline flex items-center space-x-1 cursor-pointer"
            >
              <span>Ver todas ({maintenanceLogs.length})</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2">
            {maintenanceLogs.slice(0, 4).map((m) => (
              <div key={m.id} className="p-2 sm:p-2.5 rounded-xl border border-slate-300 dark:border-stone-700 flex items-center justify-between bg-white/80 dark:bg-stone-800/80 text-black dark:text-white">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-xs text-black dark:text-white">
                      {m.machineryPlateOrName}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-white dark:bg-indigo-950/60 text-black dark:text-indigo-300 border border-slate-300 dark:border-indigo-800 font-black">
                      {m.serviceCategory}
                    </span>
                  </div>
                  <p className="text-[10px] text-black/90 dark:text-stone-300 font-semibold mt-0.5 line-clamp-1">
                    {formatDateBR(m.date)} • {m.description}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs sm:text-sm font-black text-black dark:text-white block font-['Outfit']">
                    {formatCurrencyBRL(m.totalCost)}
                  </span>
                  <span className="text-[9px] font-black text-emerald-800 dark:text-emerald-400">
                    {m.status === 'concluida' ? 'Concluída' : 'Em andamento'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};
