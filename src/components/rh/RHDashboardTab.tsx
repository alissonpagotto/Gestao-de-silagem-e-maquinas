import React from 'react';
import { 
  Users, 
  DollarSign, 
  Calendar, 
  AlertCircle, 
  Plus, 
  FileText, 
  CheckCircle2, 
  Clock, 
  ArrowRight,
  TrendingUp
} from 'lucide-react';
import { 
  Employee, 
  PayrollRecord, 
  VacationRecord, 
  LeaveRecord, 
  SalaryAdvance 
} from '../../types';
import { formatCurrencyBRL, formatDateBR } from '../../lib/storage';

interface RHDashboardTabProps {
  employees: Employee[];
  payrolls: PayrollRecord[];
  vacations: VacationRecord[];
  leaves: LeaveRecord[];
  advances: SalaryAdvance[];
  currentMonthRef: string; // Ex: '09/2026'
  onNavigateTab: (tab: 'dashboard' | 'folha' | 'ferias' | 'afastamentos' | 'adiantamentos' | 'funcionarios') => void;
  onOpenNewPayroll: () => void;
  onOpenNewVacation: () => void;
  onOpenNewLeave: () => void;
  onOpenNewAdvance: () => void;
  onViewPayslip: (payroll: PayrollRecord) => void;
}

export const RHDashboardTab: React.FC<RHDashboardTabProps> = ({
  employees,
  payrolls,
  vacations,
  leaves,
  advances,
  currentMonthRef,
  onNavigateTab,
  onOpenNewPayroll,
  onOpenNewVacation,
  onOpenNewLeave,
  onOpenNewAdvance,
  onViewPayslip,
}) => {
  // 1. Métricas
  const activeEmployees = employees.filter(e => e.status === 'ativo');
  const activeEmployeesCount = activeEmployees.length;

  const currentMonthPayrolls = payrolls.filter(p => p.referenceMonth === currentMonthRef);
  const totalPayrollMonth = currentMonthPayrolls.reduce((sum, p) => sum + (p.netSalary || 0), 0);

  const activeVacations = vacations.filter(v => v.status === 'em_gozo' || v.status === 'agendado');
  const activeLeaves = leaves.filter(l => l.status === 'ativo');

  return (
    <div className="w-full max-w-none space-y-4 sm:space-y-6">
      
      {/* 4 Cards de Métricas Principais (Exatamente como no print) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* Card 1: Funcionários Ativos */}
        <div 
          onClick={() => onNavigateTab('funcionarios')}
          className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-4 sm:p-5 shadow-xs flex items-center space-x-4 cursor-pointer hover:border-blue-300 dark:hover:border-stone-700 transition text-black dark:text-white"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-100/80 dark:bg-blue-950/60 border border-blue-300 dark:border-blue-800 flex items-center justify-center text-blue-800 dark:text-blue-300 shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-black dark:text-stone-300 uppercase tracking-wider block">
              Funcionários Ativos
            </span>
            <span className="text-2xl font-black text-black dark:text-white mt-0.5 block font-['Outfit']">
              {activeEmployeesCount}
            </span>
          </div>
        </div>

        {/* Card 2: Folha Mês Atual (ex: Folha 09/2026) */}
        <div 
          onClick={() => onNavigateTab('folha')}
          className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-4 sm:p-5 shadow-xs flex items-center space-x-4 cursor-pointer hover:border-blue-300 dark:hover:border-stone-700 transition text-black dark:text-white"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-100/80 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 flex items-center justify-center text-emerald-800 dark:text-emerald-300 shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-black dark:text-stone-300 uppercase tracking-wider block">
              Folha {currentMonthRef}
            </span>
            <span className="text-xl sm:text-2xl font-black text-black dark:text-emerald-400 mt-0.5 block font-['Outfit']">
              {formatCurrencyBRL(totalPayrollMonth)}
            </span>
          </div>
        </div>

        {/* Card 3: Em Férias/Agendado */}
        <div 
          onClick={() => onNavigateTab('ferias')}
          className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-4 sm:p-5 shadow-xs flex items-center space-x-4 cursor-pointer hover:border-blue-300 dark:hover:border-stone-700 transition text-black dark:text-white"
        >
          <div className="w-12 h-12 rounded-xl bg-amber-100/80 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 flex items-center justify-center text-amber-900 dark:text-amber-300 shrink-0">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-black dark:text-stone-300 uppercase tracking-wider block">
              Em Férias/Agendado
            </span>
            <span className="text-2xl font-black text-black dark:text-amber-400 mt-0.5 block font-['Outfit']">
              {activeVacations.length}
            </span>
          </div>
        </div>

        {/* Card 4: Afastamentos Ativos */}
        <div 
          onClick={() => onNavigateTab('afastamentos')}
          className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-4 sm:p-5 shadow-xs flex items-center space-x-4 cursor-pointer hover:border-blue-300 dark:hover:border-stone-700 transition text-black dark:text-white"
        >
          <div className="w-12 h-12 rounded-xl bg-rose-100/80 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 flex items-center justify-center text-rose-900 dark:text-rose-300 shrink-0">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-black dark:text-stone-300 uppercase tracking-wider block">
              Afastamentos Ativos
            </span>
            <span className="text-2xl font-black text-black dark:text-rose-400 mt-0.5 block font-['Outfit']">
              {activeLeaves.length}
            </span>
          </div>
        </div>

      </div>

      {/* Grid com 2 Painéis Superiores: Férias Próximas / Afastamentos Ativos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Painel 1: Férias Próximas / Em Gozo */}
        <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-5 shadow-xs flex flex-col min-h-[160px] text-black dark:text-white">
          <div className="flex items-center justify-between mb-3 border-b border-blue-200/60 dark:border-stone-800 pb-2.5">
            <h3 className="text-sm font-black text-black dark:text-white">
              Férias Próximas / Em Gozo
            </h3>
            <button
              type="button"
              onClick={() => onNavigateTab('ferias')}
              className="text-xs font-bold text-black dark:text-sky-400 hover:underline inline-flex items-center space-x-1 cursor-pointer"
            >
              <span>Ver todas</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {activeVacations.length > 0 ? (
            <div className="divide-y divide-blue-200/40 dark:divide-stone-800 space-y-2">
              {activeVacations.map((vac) => (
                <div key={vac.id} className="pt-2 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-black dark:text-white block">
                      {vac.employeeName}
                    </span>
                    <span className="text-[11px] text-black/85 dark:text-stone-300 font-medium">
                      {formatDateBR(vac.startDate)} até {formatDateBR(vac.endDate)} ({vac.daysCount} dias)
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    vac.status === 'em_gozo'
                      ? 'bg-amber-100 border-amber-300 text-amber-900'
                      : 'bg-blue-100 border-blue-300 text-blue-900'
                  }`}>
                    {vac.status === 'em_gozo' ? 'Em Gozo' : 'Agendado'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center text-black/70 dark:text-stone-400 font-medium text-xs py-8">
              Nenhum registro
            </div>
          )}
        </div>

        {/* Painel 2: Afastamentos Ativos */}
        <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-5 shadow-xs flex flex-col min-h-[160px] text-black dark:text-white">
          <div className="flex items-center justify-between mb-3 border-b border-blue-200/60 dark:border-stone-800 pb-2.5">
            <h3 className="text-sm font-black text-black dark:text-white">
              Afastamentos Ativos
            </h3>
            <button
              type="button"
              onClick={() => onNavigateTab('afastamentos')}
              className="text-xs font-bold text-black dark:text-sky-400 hover:underline inline-flex items-center space-x-1 cursor-pointer"
            >
              <span>Ver todos</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {activeLeaves.length > 0 ? (
            <div className="divide-y divide-blue-200/40 dark:divide-stone-800 space-y-2">
              {activeLeaves.map((leave) => (
                <div key={leave.id} className="pt-2 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-black dark:text-white block">
                      {leave.employeeName}
                    </span>
                    <span className="text-[11px] text-black/85 dark:text-stone-300 font-medium">
                      {leave.type} - desde {formatDateBR(leave.startDate)}
                      {leave.expectedReturnDate && ` (retorno: ${formatDateBR(leave.expectedReturnDate)})`}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 border border-rose-300 text-rose-900">
                    Afastado
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center text-black/70 dark:text-stone-400 font-medium text-xs py-8">
              Nenhum afastamento ativo
            </div>
          )}
        </div>

      </div>

      {/* Painel Inferior: Folhas — Mês Atual (ex: Folhas — Mês Atual (09/2026)) */}
      <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-5 shadow-xs text-black dark:text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-blue-200/60 dark:border-stone-800 pb-3">
          <div>
            <h3 className="text-sm font-black text-black dark:text-white">
              Folhas — Mês Atual ({currentMonthRef})
            </h3>
            <p className="text-xs text-black/85 dark:text-stone-300 font-medium">
              Lançamentos salariais e demonstrativos gerados para o período
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onOpenNewPayroll}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer shadow-xs active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Lançar Folha</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('folha')}
              className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl border border-slate-300 text-black hover:bg-slate-50 text-xs font-bold transition cursor-pointer"
            >
              <span>Gerenciador de Folha</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {currentMonthPayrolls.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-blue-100/60 dark:bg-stone-800 text-[11px] font-black text-black dark:text-white uppercase tracking-wider border-b border-blue-200/80 dark:border-stone-700">
                <tr>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Colaborador</th>
                  <th className="py-2.5 px-3">Cargo / Função</th>
                  <th className="py-2.5 px-3 text-right">Salário Base</th>
                  <th className="py-2.5 px-3 text-right">Horas Extras/Bônus</th>
                  <th className="py-2.5 px-3 text-right">Descontos/Vales</th>
                  <th className="py-2.5 px-3 text-right">Líquido a Pagar</th>
                  <th className="py-2.5 px-3 text-center">Holerite</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-200/60 dark:divide-stone-800">
                {currentMonthPayrolls.map((p) => (
                  <tr key={p.id} className="hover:bg-blue-200/40 dark:hover:bg-stone-800/60 transition">
                    <td className="py-2 px-3">
                      <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        p.status === 'pago'
                          ? 'bg-emerald-100 border-emerald-300 text-emerald-900'
                          : 'bg-amber-100 border-amber-300 text-amber-900'
                      }`}>
                        {p.status === 'pago' ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Pago</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3" />
                            <span>A Pagar</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-bold text-black dark:text-white">
                      {p.employeeName}
                    </td>
                    <td className="py-2 px-3 text-black/85 dark:text-stone-300 font-medium">
                      {p.employeeRole}
                    </td>
                    <td className="py-2 px-3 text-right font-medium text-black dark:text-stone-200 font-['Outfit']">
                      {formatCurrencyBRL(p.baseSalary)}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-emerald-900 dark:text-emerald-400 font-['Outfit']">
                      +{formatCurrencyBRL((p.overtimeAmount || 0) + (p.bonusAmount || 0))}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-rose-900 dark:text-rose-400 font-['Outfit']">
                      -{formatCurrencyBRL((p.inssDiscount || 0) + (p.advancesDiscount || 0) + (p.otherDiscounts || 0))}
                    </td>
                    <td className="py-2 px-3 text-right font-black text-black dark:text-white font-['Outfit']">
                      {formatCurrencyBRL(p.netSalary)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => onViewPayslip(p)}
                        className="p-1 text-black dark:text-sky-400 hover:bg-blue-200/50 dark:hover:bg-stone-800 rounded transition cursor-pointer"
                        title="Ver / Imprimir Holerite"
                      >
                        <FileText className="w-4 h-4 mx-auto" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <p className="text-black/75 dark:text-stone-400 font-medium text-xs">
              Nenhuma folha lançada para este mês
            </p>
          </div>
        )}
      </div>

    </div>
  );
};
