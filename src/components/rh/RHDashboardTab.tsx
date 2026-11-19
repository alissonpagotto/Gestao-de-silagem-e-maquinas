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
import { computeUnifiedVacationMetrics } from './vacationHelpers';

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
  // 1. Métricas sincronizadas com a lista filtrada de funcionários ativos
  const activeEmployeesCount = React.useMemo(() => {
    return employees.filter(e => {
      if (!e || !e.name || e.name.trim() === '') return false;
      const st = String(e.status || '').toLowerCase();
      if (st === 'excluido' || st === 'inativo' || e.active === false) return false;
      if (e.id === 'ab80e2fa-5094-43b3-83bf-c34047bf1b42' || (e.name.trim().toUpperCase() === 'ALISSON PAG' && !e.cpf)) {
        return false;
      }
      return true;
    }).length;
  }, [employees]);

  const currentMonthPayrolls = payrolls.filter(p => p.referenceMonth === currentMonthRef);
  const totalPayrollMonth = currentMonthPayrolls.reduce((sum, p) => sum + (p.netSalary || 0), 0);

  // 3. Alinhamento com a Aba Férias: filtra estritamente por colaboradores ativos
  // e faz a mesma distinção unificada entre "Em Gozo" e "Programados/Agendados" (sem registros fantasmas ou duplicados)
  const vacationMetrics = React.useMemo(() => {
    return computeUnifiedVacationMetrics(employees, vacations);
  }, [employees, vacations]);

  const { activeVacationsList, emGozoCount, programadosCount, totalEmFeriasAgendado } = vacationMetrics;
  const activeLeaves = leaves.filter(l => l.status === 'ativo');

  return (
    <div className="w-full max-w-none flex-1 min-h-0 h-full max-h-full flex flex-col gap-3 sm:gap-4 overflow-hidden">
      
      {/* 4 Cards de Métricas Principais */}
      <div className="shrink-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* Card 1: Funcionários Ativos */}
        <div 
          onClick={() => onNavigateTab('funcionarios')}
          className="bg-[#e0e6f1] dark:bg-stone-900 border border-black dark:border-stone-700 rounded-xl p-4 sm:p-5 shadow-xs flex items-center space-x-4 cursor-pointer hover:bg-[#d2dced] dark:hover:border-stone-600 transition text-black dark:text-white"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-100/90 dark:bg-blue-950/60 border border-blue-400 dark:border-blue-800 flex items-center justify-center text-blue-800 dark:text-blue-300 shrink-0">
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
          className="bg-[#e0e6f1] dark:bg-stone-900 border border-black dark:border-stone-700 rounded-xl p-4 sm:p-5 shadow-xs flex items-center space-x-4 cursor-pointer hover:bg-[#d2dced] dark:hover:border-stone-600 transition text-black dark:text-white"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-100/90 dark:bg-emerald-950/60 border border-emerald-400 dark:border-emerald-800 flex items-center justify-center text-emerald-800 dark:text-emerald-300 shrink-0">
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

        {/* Card 3: Em Férias / Agendado */}
        <div 
          onClick={() => onNavigateTab('ferias')}
          className="bg-[#e0e6f1] dark:bg-stone-900 border border-black dark:border-stone-700 rounded-xl p-4 sm:p-5 shadow-xs flex items-center space-x-4 cursor-pointer hover:bg-[#d2dced] dark:hover:border-stone-600 transition text-black dark:text-white"
        >
          <div className="w-12 h-12 rounded-xl bg-amber-100/90 dark:bg-amber-950/60 border border-amber-400 dark:border-amber-800 flex items-center justify-center text-amber-900 dark:text-amber-300 shrink-0">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-black dark:text-stone-300 uppercase tracking-wider block">
              Em Férias / Agendado
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-black text-black dark:text-amber-400 font-['Outfit']">
                {totalEmFeriasAgendado}
              </span>
              <span className="text-[11px] font-bold text-black/75 dark:text-stone-300">
                {emGozoCount > 0 && programadosCount > 0
                  ? `(${emGozoCount} em gozo • ${programadosCount} agendado)`
                  : emGozoCount > 0
                  ? `(${emGozoCount} em gozo)`
                  : programadosCount > 0
                  ? `(${programadosCount} agendado)`
                  : '(0)'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Afastamentos Ativos */}
        <div 
          onClick={() => onNavigateTab('afastamentos')}
          className="bg-[#e0e6f1] dark:bg-stone-900 border border-black dark:border-stone-700 rounded-xl p-4 sm:p-5 shadow-xs flex items-center space-x-4 cursor-pointer hover:bg-[#d2dced] dark:hover:border-stone-600 transition text-black dark:text-white"
        >
          <div className="w-12 h-12 rounded-xl bg-rose-100/90 dark:bg-rose-950/60 border border-rose-400 dark:border-rose-800 flex items-center justify-center text-rose-900 dark:text-rose-300 shrink-0">
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
      <div className="shrink-0 grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Painel 1: Férias Próximas / Em Gozo */}
        <div className="bg-[#e0e6f1] dark:bg-stone-900 border border-black dark:border-stone-700 rounded-lg shadow-xs flex flex-col min-h-[140px] max-h-[210px] overflow-hidden text-black dark:text-white">
          <div className="shrink-0 flex items-center justify-between px-4 py-2.5 bg-[#cad4e6] dark:bg-stone-800 border-b border-black dark:border-stone-700">
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

          {activeVacationsList.length > 0 ? (
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden divide-y divide-black/20 dark:divide-stone-800 bg-[#e0e6f1] dark:bg-stone-900 px-4 py-1">
              {activeVacationsList.map((vac) => {
                const isGozo = String(vac.status ?? '').toLowerCase() === 'em_gozo' || String(vac.situacao_execucao).toUpperCase() === 'EM_GOZO';
                return (
                  <div key={vac.id} className="py-2 flex items-center justify-between text-xs hover:bg-[#d2dced]/60 dark:hover:bg-stone-800/60 transition rounded px-1">
                    <div>
                      <span className="font-bold text-black dark:text-white block">
                        {vac.employeeName}
                      </span>
                      <span className="text-[11px] text-black/85 dark:text-stone-300 font-medium">
                        {formatDateBR(vac.startDate)} até {formatDateBR(vac.endDate)} ({vac.daysCount} dias)
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      isGozo
                        ? 'bg-indigo-100 border-indigo-400 text-indigo-900'
                        : 'bg-blue-100 border-blue-400 text-blue-900'
                    }`}>
                      {isGozo ? 'Em Gozo' : 'Agendado'}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center bg-[#e0e6f1] dark:bg-stone-900 text-slate-700 dark:text-stone-400 font-semibold uppercase text-xs py-8">
              NENHUM REGISTRO ENCONTRADO
            </div>
          )}
        </div>

        {/* Painel 2: Afastamentos Ativos */}
        <div className="bg-[#e0e6f1] dark:bg-stone-900 border border-black dark:border-stone-700 rounded-lg shadow-xs flex flex-col min-h-[140px] max-h-[210px] overflow-hidden text-black dark:text-white">
          <div className="shrink-0 flex items-center justify-between px-4 py-2.5 bg-[#cad4e6] dark:bg-stone-800 border-b border-black dark:border-stone-700">
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
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden divide-y divide-black/20 dark:divide-stone-800 bg-[#e0e6f1] dark:bg-stone-900 px-4 py-1">
              {activeLeaves.map((leave) => (
                <div key={leave.id} className="py-2 flex items-center justify-between text-xs hover:bg-[#d2dced]/60 dark:hover:bg-stone-800/60 transition rounded px-1">
                  <div>
                    <span className="font-bold text-black dark:text-white block">
                      {leave.employeeName}
                    </span>
                    <span className="text-[11px] text-black/85 dark:text-stone-300 font-medium">
                      {leave.type} - desde {formatDateBR(leave.startDate)}
                      {leave.expectedReturnDate && ` (retorno: ${formatDateBR(leave.expectedReturnDate)})`}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 border border-rose-400 text-rose-900">
                    Afastado
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center bg-[#e0e6f1] dark:bg-stone-900 text-slate-700 dark:text-stone-400 font-semibold uppercase text-xs py-8">
              NENHUM REGISTRO ENCONTRADO
            </div>
          )}
        </div>

      </div>

      {/* Painel Inferior: Folhas — Mês Atual (ex: Folhas — Mês Atual (09/2026)) */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-[#e0e6f1] dark:bg-stone-900 border border-black dark:border-stone-700 rounded-lg shadow-xs text-black dark:text-white">
        <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-2.5 bg-[#cad4e6] dark:bg-stone-800 border-b border-black dark:border-stone-700">
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
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 border border-black/40 text-white text-xs font-bold transition cursor-pointer shadow-xs active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Lançar Folha</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('folha')}
              className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-black dark:border-stone-600 bg-[#e0e6f1] dark:bg-stone-900 text-black dark:text-white hover:bg-[#d2dced] dark:hover:bg-stone-700 text-xs font-bold transition cursor-pointer"
            >
              <span>Gerenciador de Folha</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {currentMonthPayrolls.length > 0 ? (
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-[#e0e6f1] dark:bg-stone-900">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 text-[11px] font-black text-black dark:text-white uppercase tracking-wider border-b border-black dark:border-stone-700 shadow-sm">
                <tr>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3 border-b border-black dark:border-stone-700">Status</th>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3 border-b border-black dark:border-stone-700">Colaborador</th>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3 border-b border-black dark:border-stone-700">Cargo / Função</th>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3 text-right border-b border-black dark:border-stone-700">Salário Base</th>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3 text-right border-b border-black dark:border-stone-700">Horas Extras/Bônus</th>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3 text-right border-b border-black dark:border-stone-700">Descontos/Vales</th>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3 text-right border-b border-black dark:border-stone-700">Líquido a Pagar</th>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3 text-center border-b border-black dark:border-stone-700">Holerite</th>
                </tr>
              </thead>
              <tbody className="bg-[#e0e6f1] dark:bg-stone-900 divide-y divide-black/20 dark:divide-stone-800">
                {currentMonthPayrolls.map((p) => (
                  <tr key={p.id} className="bg-[#e0e6f1] hover:bg-[#d2dced] dark:bg-stone-900 dark:hover:bg-stone-800 transition border-b border-black/20 dark:border-stone-800">
                    <td className="py-2 px-3">
                      <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        p.status === 'pago'
                          ? 'bg-emerald-100 border-emerald-400 text-emerald-900'
                          : 'bg-amber-100 border-amber-400 text-amber-900'
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
                        className="p-1 text-black dark:text-sky-400 hover:bg-[#cad4e6] dark:hover:bg-stone-800 rounded transition cursor-pointer"
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
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center bg-[#e0e6f1] dark:bg-stone-900 py-8">
            <p className="text-slate-700 dark:text-stone-400 font-semibold uppercase text-xs">
              NENHUM REGISTRO ENCONTRADO
            </p>
          </div>
        )}
      </div>

    </div>
  );
};
