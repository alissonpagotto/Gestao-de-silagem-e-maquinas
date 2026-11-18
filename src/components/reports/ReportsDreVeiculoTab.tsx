import React, { useEffect, useMemo, useState } from 'react';
import {
  Tractor,
  Search,
  Download,
  TrendingUp,
  Fuel,
  Wrench,
  DollarSign,
} from 'lucide-react';
import {
  CompanyProfile,
  Employee,
  Expense,
  FuelLog,
  Machinery,
  MaintenanceLog,
  ServiceOrder,
  SilageOrder,
} from '../../types';
import { formatCurrencyBRL, isFictitiousOrZeroFuelLog } from '../../lib/storage';
import { findVehicleForLog } from '../../lib/fuelCalculation';
import {
  CompetenceSelector,
  getNextCompetence,
  getPrevCompetence,
} from '../financial/CompetenceSelector';
import {
  buildDreVeiculoReport,
  ReportPrintConfig,
  VehicleDreReportRow,
} from './reportPrintBuilders';

interface ReportsDreVeiculoTabProps {
  machineries: Machinery[];
  orders: SilageOrder[];
  services: ServiceOrder[];
  expenses: Expense[];
  fuelLogs: FuelLog[];
  maintenanceLogs: MaintenanceLog[];
  employees: Employee[];
  companyProfile: CompanyProfile;
  startDate: string;
  endDate: string;
  competence?: string;
  onCompetenceChange?: (comp: string) => void;
  onRegisterPrintGetter?: (getter: () => ReportPrintConfig) => void;
}

export const ReportsDreVeiculoTab: React.FC<ReportsDreVeiculoTabProps> = ({
  machineries = [],
  orders = [],
  services = [],
  expenses = [],
  fuelLogs = [],
  maintenanceLogs = [],
  employees = [],
  companyProfile,
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

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('todos');

  const getVehicleCategory = (m: Machinery) =>
    m.categoriaVeiculo || m.categoria || m.categoryType || m.type || 'Frota';

  const categories = useMemo(() => {
    const set = new Set<string>();
    machineries.forEach((m) => {
      const cat = getVehicleCategory(m);
      if (cat) set.add(cat);
    });
    return Array.from(set).sort();
  }, [machineries]);

  const rows = useMemo<VehicleDreReportRow[]>(() => {
    const inPeriod = (dateStr?: string) => {
      if (!startDate || !endDate) return true;
      if (!dateStr) return false;
      const iso = dateStr.slice(0, 10);
      return iso >= startDate && iso <= endDate;
    };

    const term = searchTerm.toLowerCase().trim();
    const activeEmployees = employees.filter((e) => e.status !== 'inativo');

    return machineries
      .filter((veh) => {
        const vehCat = getVehicleCategory(veh);
        if (categoryFilter !== 'todos' && vehCat !== categoryFilter) return false;
        if (term) {
          const hay = `${veh.licensePlateOrSerial || veh.plate || ''} ${veh.name || ''} ${veh.model || ''} ${vehCat}`.toLowerCase();
          if (!hay.includes(term)) return false;
        }
        return true;
      })
      .map((veh) => {
        const plateLower = String(veh.licensePlateOrSerial || '').toLowerCase().trim();
        const modelLower = String(veh.model || veh.name || '').toLowerCase().trim();

        const driverIds = new Set<string>();
        if (Array.isArray(veh.assignedDriverIds)) {
          veh.assignedDriverIds.forEach((id) => driverIds.add(id));
        }
        if (veh.operatorOrDriver) {
          const names = veh.operatorOrDriver.split(',').map((s) => s.trim().toLowerCase());
          employees
            .filter((e) => names.includes(String(e.name || '').toLowerCase()))
            .forEach((e) => driverIds.add(e.id));
        }
        employees.filter((e) => e.machineryId === veh.id).forEach((e) => driverIds.add(e.id));
        const assignedDriverIds = Array.from(driverIds);
        const assignedDriverNames = employees
          .filter((e) => assignedDriverIds.includes(e.id))
          .map((e) => e.name);

        // 1. Receitas (Serviços + Pedidos CIF/FOB + Receitas operacionais diretas no período)
        const srvRev = (services || [])
          .filter((s) => {
            if (!s || s.status === 'cancelado' || !inPeriod(s.startDate)) return false;
            if (s.machineryId === veh.id) return true;
            const assigned = String(s.machineryAssigned || '').toLowerCase();
            return (
              (plateLower && assigned.includes(plateLower)) ||
              (modelLower && assigned.includes(modelLower))
            );
          })
          .reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);

        const matchedOrders = (orders || []).filter((o) => {
          if (!o || o.status === 'cancelado' || !inPeriod(o.deliveryDate)) return false;
          if (o.machineryId === veh.id) return true;
          const plateOrName = String(o.machineryPlateOrName || '').toLowerCase();
          if (plateLower && plateOrName.includes(plateLower)) return true;
          if (modelLower && plateOrName.includes(modelLower)) return true;
          return assignedDriverNames.some(
            (n) => n.length > 2 && String(o.driverName || '').toLowerCase().includes(n.toLowerCase())
          );
        });
        const ordRev = matchedOrders.reduce(
          (sum, o) => sum + (o.freightCost || (o.freightType === 'CIF' ? o.totalAmount * 0.15 : o.totalAmount)),
          0
        );

        const revenue = srvRev + ordRev;

        // 2. Combustível
        const fuelCost = (fuelLogs || [])
          .filter((l) => {
            if (!l || isFictitiousOrZeroFuelLog(l) || !inPeriod(l.date)) return false;
            if (l.machineryId === veh.id) return true;
            const found = findVehicleForLog(l, machineries);
            return found?.id === veh.id;
          })
          .reduce((sum, l) => sum + (Number(l.totalCost) || 0), 0);

        // 3. Manutenção / Peças
        const maintenanceCost = (maintenanceLogs || [])
          .filter((m) => {
            if (!m || m.status === 'cancelada' || !inPeriod(m.date)) return false;
            if (m.machineryId === veh.id) return true;
            const ref = String(m.machineryPlateOrName || '').toLowerCase();
            return (
              (plateLower && ref.includes(plateLower)) ||
              (modelLower && ref.includes(modelLower))
            );
          })
          .reduce((sum, m) => sum + (Number(m.totalCost) || 0), 0);

        // 4. Rateio de Despesas & Custos Diretos (Pessoal, IPVA, Seguro, etc.)
        let apportionedExpenses = 0;
        (expenses || []).forEach((exp) => {
          if (!exp || !inPeriod(exp.dueDate || exp.paymentDate)) return;

          const rhDeductionTotal = Number(
            exp.employeePayrollDeductionsTotal ??
              (Array.isArray(exp.employeePayrollDeductions)
                ? exp.employeePayrollDeductions.reduce((s, item) => s + (Number(item.amount) || 0), 0)
                : 0)
          );
          const rawAmount = Number(exp.dreGrossAmount || exp.amount || 0);
          const baseAmount = exp.dreGrossAmount
            ? rawAmount
            : Math.max(0, +(rawAmount - rhDeductionTotal).toFixed(2));

          // 4a. Rateio detalhado por funcionário/máquina
          if (Array.isArray(exp.employeeApportionmentDetails) && exp.employeeApportionmentDetails.length > 0) {
            const matched = exp.employeeApportionmentDetails.filter(
              (entry) => assignedDriverIds.includes(entry.employeeId) || entry.machineryId === veh.id
            );
            apportionedExpenses += matched.reduce((s, e) => s + (Number(e.companyAmount) || 0), 0);
            return;
          }

          // 4b. Rateio por string de IDs
          if (exp.employeeApportionment && exp.employeeApportionment.trim()) {
            const parts = exp.employeeApportionment.split(',').map((s) => s.trim()).filter(Boolean);
            if (parts.includes('todos')) {
              const totalActive = Math.max(activeEmployees.length, 1);
              const matchedCount = assignedDriverIds.filter((id) =>
                activeEmployees.some((e) => e.id === id)
              ).length;
              if (matchedCount > 0) {
                apportionedExpenses += baseAmount * (matchedCount / totalActive);
              } else if (exp.machineryId === veh.id) {
                apportionedExpenses += baseAmount / totalActive;
              }
              return;
            }
            const matchedCount = parts.filter((id) => assignedDriverIds.includes(id)).length;
            if (matchedCount > 0) {
              apportionedExpenses += baseAmount * (matchedCount / parts.length);
              return;
            }
            if (exp.machineryId === veh.id && parts.length === 1) {
              apportionedExpenses += baseAmount;
            }
            return;
          }

          // 4c. Despesa direta associada ao veículo ou motorista (evitando duplicar combustível/manutenção)
          const cat = String(exp.categoryName || exp.categoryId || '').toLowerCase();
          const desc = String(exp.description || '').toLowerCase();
          const isFuelExp = cat.includes('combust') || desc.includes('combust') || desc.includes('diesel');
          const isMaintExp = cat.includes('manut') || desc.includes('manut') || desc.includes('oficina') || desc.includes('peça');

          if (exp.machineryId === veh.id) {
            if (!isFuelExp && !isMaintExp) {
              apportionedExpenses += baseAmount;
            }
            return;
          }

          if (exp.employeeId && assignedDriverIds.includes(exp.employeeId)) {
            apportionedExpenses += baseAmount;
          }
        });

        const totalCosts = fuelCost + maintenanceCost + apportionedExpenses;
        const netResult = revenue - totalCosts;
        const marginPct = revenue > 0 ? (netResult / revenue) * 100 : 0;

        return {
          machineryId: veh.id,
          plateOrSerial: veh.licensePlateOrSerial || veh.plateOrSerial || veh.plate || veh.fleetNumber || '-',
          name: veh.name || veh.model || 'Equipamento',
          category: getVehicleCategory(veh),
          revenue,
          fuelCost,
          maintenanceCost,
          apportionedExpenses,
          totalCosts,
          netResult,
          marginPct,
        };
      })
      .sort((a, b) => b.netResult - a.netResult);
  }, [
    machineries,
    services,
    orders,
    fuelLogs,
    maintenanceLogs,
    expenses,
    employees,
    startDate,
    endDate,
    searchTerm,
    categoryFilter,
  ]);

  const totals = useMemo(() => {
    const revenue = rows.reduce((s, r) => s + r.revenue, 0);
    const fuel = rows.reduce((s, r) => s + r.fuelCost, 0);
    const maintenance = rows.reduce((s, r) => s + r.maintenanceCost, 0);
    const apportioned = rows.reduce((s, r) => s + r.apportionedExpenses, 0);
    const netResult = revenue - (fuel + maintenance + apportioned);
    const margin = revenue > 0 ? (netResult / revenue) * 100 : 0;
    return { revenue, fuel, maintenance, apportioned, netResult, margin };
  }, [rows]);

  const printConfig = useMemo(
    () =>
      buildDreVeiculoReport({
        companyProfile,
        rows,
        startDate,
        endDate,
        competence: activeCompetence,
        searchTerm,
        categoryFilter,
      }),
    [companyProfile, rows, startDate, endDate, activeCompetence, searchTerm, categoryFilter]
  );

  useEffect(() => {
    onRegisterPrintGetter?.(() => printConfig);
  }, [onRegisterPrintGetter, printConfig]);

  const handleExportCsv = () => {
    const headers =
      'Placa_Serie,Veiculo_Maquina,Categoria,Receita_Gerada,Combustivel,Manutencao_Pecas,Rateio_Despesas,Resultado_Liquido,Margem_%\n';
    const csvRows = rows
      .map(
        (r) =>
          `"${r.plateOrSerial}","${r.name}","${r.category}","${r.revenue.toFixed(2)}","${r.fuelCost.toFixed(2)}","${r.maintenanceCost.toFixed(2)}","${r.apportionedExpenses.toFixed(2)}","${r.netResult.toFixed(2)}","${r.marginPct.toFixed(1)}%"`
      )
      .join('\n');
    const blob = new Blob([headers + csvRows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `dre_por_veiculo_${startDate}_a_${endDate}.csv`;
    link.click();
  };

  return (
    <div className="flex-1 min-h-0 h-full max-h-full flex flex-col gap-2.5 overflow-hidden animate-fade-in">
      {/* 1. KPIs Consolidados Frota */}
      <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
        <div className="reports-kpi-card bg-[#e0e6f1] dark:bg-stone-900 rounded-lg py-2 px-3 border border-black dark:border-stone-800 border-l-[3px] border-l-emerald-600 shadow-2xs flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 flex items-center justify-center shrink-0 border border-black/15">
            <TrendingUp className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 block truncate">
              Receita Gerada (Frota)
            </span>
            <div className="text-sm sm:text-base font-black text-emerald-700 dark:text-emerald-400 font-['Outfit'] truncate">
              {formatCurrencyBRL(totals.revenue)}
            </div>
            <div className="text-[10px] text-stone-600 truncate">{rows.length} equipamento(s)</div>
          </div>
        </div>

        <div className="reports-kpi-card bg-[#e0e6f1] dark:bg-stone-900 rounded-lg py-2 px-3 border border-black dark:border-stone-800 border-l-[3px] border-l-amber-600 shadow-2xs flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-700 flex items-center justify-center shrink-0 border border-black/15">
            <Fuel className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 block truncate">
              Combustível + Manutenção
            </span>
            <div className="text-sm sm:text-base font-black text-amber-700 dark:text-amber-400 font-['Outfit'] truncate">
              {formatCurrencyBRL(totals.fuel + totals.maintenance)}
            </div>
            <div className="text-[10px] text-stone-600 truncate">
              Comb: {formatCurrencyBRL(totals.fuel)} • Manut: {formatCurrencyBRL(totals.maintenance)}
            </div>
          </div>
        </div>

        <div className="reports-kpi-card bg-[#e0e6f1] dark:bg-stone-900 rounded-lg py-2 px-3 border border-black dark:border-stone-800 border-l-[3px] border-l-rose-600 shadow-2xs flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-700 flex items-center justify-center shrink-0 border border-black/15">
            <Wrench className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 block truncate">
              Rateio Despesas / Pessoal
            </span>
            <div className="text-sm sm:text-base font-black text-rose-700 dark:text-rose-400 font-['Outfit'] truncate">
              {formatCurrencyBRL(totals.apportioned)}
            </div>
            <div className="text-[10px] text-stone-600 truncate">Salários, férias, taxas e diretos</div>
          </div>
        </div>

        <div className="reports-kpi-card bg-[#e0e6f1] dark:bg-stone-900 rounded-lg py-2 px-3 border border-black dark:border-stone-800 border-l-[3px] border-l-sky-700 shadow-2xs flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-sky-50 dark:bg-sky-950/50 text-sky-700 flex items-center justify-center shrink-0 border border-black/15">
            <DollarSign className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 block truncate">
              Resultado Líquido Frota
            </span>
            <div
              className={`text-sm sm:text-base font-black font-['Outfit'] truncate ${
                totals.netResult >= 0 ? 'text-sky-800 dark:text-sky-300' : 'text-rose-700'
              }`}
            >
              {formatCurrencyBRL(totals.netResult)}
            </div>
            <div className="text-[10px] text-stone-600 truncate">
              Margem consolidada: {totals.margin.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      {/* 2. Barra de Filtros */}
      <div className="shrink-0 reports-filter-bar bg-[#cad4e6] dark:bg-stone-900 border border-black dark:border-stone-800 rounded-lg p-2 shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          <CompetenceSelector
            competence={activeCompetence}
            onPrev={() => onCompetenceChange?.(getPrevCompetence(activeCompetence))}
            onNext={() => onCompetenceChange?.(getNextCompetence(activeCompetence))}
          />

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 outline-none"
          >
            <option value="todos">Todas as Categorias ({machineries.length})</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <div className="relative flex-1 min-w-[180px] max-w-[260px]">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar placa, série ou máquina..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 outline-none"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-black dark:border-stone-700 bg-[#e0e6f1] hover:bg-[#d2dced] dark:bg-stone-800 text-black dark:text-stone-100 text-xs font-bold transition cursor-pointer shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          <span>CSV</span>
        </button>
      </div>

      {/* 3. Tabela Comparativa por Veículo / Máquina */}
      <div className="flex-1 min-h-0 bg-white dark:bg-stone-900 border border-black dark:border-stone-800 rounded-lg shadow-xs overflow-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-[#cad4e6] dark:bg-stone-800 border-b border-black text-stone-900 dark:text-stone-100 font-black uppercase text-[10px]">
            <tr>
              <th className="py-2 px-3">Placa / Série</th>
              <th className="py-2 px-3">Veículo / Máquina</th>
              <th className="py-2 px-3 text-right">Receita Gerada</th>
              <th className="py-2 px-3 text-right">Combustível</th>
              <th className="py-2 px-3 text-right">Manutenção / Peças</th>
              <th className="py-2 px-3 text-right">Rateio Despesas</th>
              <th className="py-2 px-3 text-right">Resultado Líquido</th>
              <th className="py-2 px-3 text-right">Margem (%)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
            {rows.length > 0 ? (
              rows.map((row) => (
                <tr key={row.machineryId} className="hover:bg-slate-50 dark:hover:bg-stone-800/40">
                  <td className="py-2 px-3 font-mono font-bold text-stone-900 dark:text-stone-100 whitespace-nowrap">
                    {row.plateOrSerial}
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-1.5">
                      <Tractor className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                      <div>
                        <div className="font-bold text-stone-900 dark:text-stone-100">{row.name}</div>
                        <div className="text-[10px] text-stone-500">{row.category}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-2 px-3 text-right font-bold text-emerald-700 whitespace-nowrap">
                    {formatCurrencyBRL(row.revenue)}
                  </td>
                  <td className="py-2 px-3 text-right font-semibold text-amber-700 whitespace-nowrap">
                    {formatCurrencyBRL(row.fuelCost)}
                  </td>
                  <td className="py-2 px-3 text-right font-semibold text-amber-700 whitespace-nowrap">
                    {formatCurrencyBRL(row.maintenanceCost)}
                  </td>
                  <td className="py-2 px-3 text-right font-semibold text-rose-700 whitespace-nowrap">
                    {formatCurrencyBRL(row.apportionedExpenses)}
                  </td>
                  <td
                    className={`py-2 px-3 text-right font-black whitespace-nowrap ${
                      row.netResult >= 0 ? 'text-sky-800 dark:text-sky-300' : 'text-rose-700'
                    }`}
                  >
                    {formatCurrencyBRL(row.netResult)}
                  </td>
                  <td
                    className={`py-2 px-3 text-right font-extrabold whitespace-nowrap ${
                      row.marginPct >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {row.marginPct.toFixed(1)}%
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="py-10 text-center text-stone-500">
                  Nenhum veículo ou máquina encontrado para apuração de DRE no período.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="sticky bottom-0 bg-[#e0e6f1] dark:bg-stone-800 border-t-2 border-black font-black text-xs">
              <tr>
                <td colSpan={2} className="py-2 px-3 text-right uppercase">
                  Totais Consolidados ({rows.length} equipamentos):
                </td>
                <td className="py-2 px-3 text-right text-emerald-700 whitespace-nowrap">
                  {formatCurrencyBRL(totals.revenue)}
                </td>
                <td className="py-2 px-3 text-right text-amber-700 whitespace-nowrap">
                  {formatCurrencyBRL(totals.fuel)}
                </td>
                <td className="py-2 px-3 text-right text-amber-700 whitespace-nowrap">
                  {formatCurrencyBRL(totals.maintenance)}
                </td>
                <td className="py-2 px-3 text-right text-rose-700 whitespace-nowrap">
                  {formatCurrencyBRL(totals.apportioned)}
                </td>
                <td
                  className={`py-2 px-3 text-right whitespace-nowrap ${
                    totals.netResult >= 0 ? 'text-sky-800 dark:text-sky-300' : 'text-rose-700'
                  }`}
                >
                  {formatCurrencyBRL(totals.netResult)}
                </td>
                <td
                  className={`py-2 px-3 text-right whitespace-nowrap ${
                    totals.margin >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {totals.margin.toFixed(1)}%
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};
