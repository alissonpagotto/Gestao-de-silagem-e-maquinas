import React, { useEffect, useMemo, useState } from 'react';
import {
  Users,
  Search,
  Download,
  DollarSign,
  AlertTriangle,
  WalletCards,
  Clock,
} from 'lucide-react';
import {
  CompanyProfile,
  Employee,
  PayrollRecord,
  SalaryAdvance,
  VacationRecord,
} from '../../types';
import { formatCurrencyBRL, formatDateBR } from '../../lib/storage';
import {
  CompetenceSelector,
  getNextCompetence,
  getPrevCompetence,
} from '../financial/CompetenceSelector';
import {
  buildRhFolhaReport,
  ReportPrintConfig,
  RhFolhaReportRow,
} from './reportPrintBuilders';

interface ReportsRhFolhaTabProps {
  employees: Employee[];
  payrolls: PayrollRecord[];
  vacations: VacationRecord[];
  advances: SalaryAdvance[];
  companyProfile: CompanyProfile;
  startDate: string;
  endDate: string;
  competence?: string;
  onCompetenceChange?: (comp: string) => void;
  onRegisterPrintGetter?: (getter: () => ReportPrintConfig) => void;
}

export const ReportsRhFolhaTab: React.FC<ReportsRhFolhaTabProps> = ({
  employees = [],
  payrolls = [],
  vacations = [],
  advances = [],
  companyProfile,
  startDate,
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
  const [statusFilter, setStatusFilter] = useState<'ativos' | 'todos' | 'inativos'>('ativos');

  const todayMs = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const rows = useMemo<RhFolhaReportRow[]>(() => {
    const term = searchTerm.toLowerCase().trim();

    return employees
      .filter((emp) => {
        const isInactive = emp.status === 'inativo';
        if (statusFilter === 'ativos' && isInactive) return false;
        if (statusFilter === 'inativos' && !isInactive) return false;
        if (term) {
          const hay = `${emp.name || ''} ${emp.role || ''} ${emp.cpf || ''}`.toLowerCase();
          if (!hay.includes(term)) return false;
        }
        return true;
      })
      .map((emp) => {
        // Folha da competência selecionada
        const empPayrolls = (payrolls || []).filter(
          (p) =>
            p.employeeId === emp.id &&
            p.referenceMonth === activeCompetence &&
            (p.payrollType || 'monthly') === 'monthly'
        );

        const baseSalary =
          empPayrolls.length > 0
            ? empPayrolls.reduce((s, p) => s + (Number(p.baseSalary) || 0), 0)
            : Number(emp.salary || 0);

        const overtimeAndBonus = empPayrolls.reduce(
          (s, p) => s + (Number(p.overtimeAmount) || 0) + (Number(p.bonusAmount) || 0),
          0
        );

        const commissions = empPayrolls.reduce(
          (s, p) => s + (Number(p.commissionAmount) || 0),
          0
        );

        const empAdvancesSum = (advances || [])
          .filter(
            (a) =>
              a.employeeId === emp.id &&
              (a.referenceMonth === activeCompetence ||
                (!a.referenceMonth && a.date && a.date.slice(0, 7) === `${activeCompetence.slice(3, 7)}-${activeCompetence.slice(0, 2)}`))
          )
          .reduce((s, a) => s + (Number(a.amount ?? a.valor) || 0), 0);

        const advancesDiscount =
          empPayrolls.length > 0
            ? Math.max(
                empPayrolls.reduce((s, p) => s + (Number(p.advancesDiscount ?? p.totalVales) || 0), 0),
                empAdvancesSum
              )
            : empAdvancesSum;

        const otherDiscounts = empPayrolls.reduce(
          (s, p) =>
            s +
            (Number(p.otherDiscounts) || 0) +
            (Number(p.inssDiscount) || 0) +
            (Number(p.irrfDiscount) || 0) +
            (Number(p.sindicalDiscount) || 0),
          0
        );

        const netSalary =
          empPayrolls.length > 0
            ? empPayrolls.reduce((s, p) => s + (Number(p.netSalary) || 0), 0)
            : Math.max(0, baseSalary + overtimeAndBonus + commissions - advancesDiscount - otherDiscounts);

        // Vencimento de CNH
        const cnhExp = emp.cnhExpiration || (emp as any).vencimento_cnh || '';
        let cnhDaysLeft: number | null = null;
        if (cnhExp && /^\d{4}-\d{2}-\d{2}/.test(cnhExp)) {
          const expTime = new Date(`${cnhExp.slice(0, 10)}T00:00:00`).getTime();
          if (!isNaN(expTime)) {
            cnhDaysLeft = Math.ceil((expTime - todayMs) / (1000 * 60 * 60 * 24));
          }
        }

        // Situação Férias
        const empVacations = (vacations || []).filter(
          (v) => v.employeeId === emp.id && v.status !== 'cancelado'
        );
        const emGozo = empVacations.find((v) => v.status === 'em_gozo');
        const agendada = empVacations.find((v) => v.status === 'agendado' || v.status === 'programado');
        let vacationDueStatus = 'Regular';
        if (emGozo) {
          vacationDueStatus = `Em Gozo (até ${formatDateBR(emGozo.endDate)})`;
        } else if (agendada) {
          vacationDueStatus = `Agendada (${formatDateBR(agendada.startDate)})`;
        } else if (emp.admissionDate) {
          const adm = new Date(`${emp.admissionDate.slice(0, 10)}T00:00:00`);
          if (!isNaN(adm.getTime())) {
            const monthsSinceAdm = (todayMs - adm.getTime()) / (1000 * 60 * 60 * 24 * 30.4375);
            const lastVac = empVacations
              .filter((v) => v.endDate)
              .sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
            if (monthsSinceAdm >= 12 && !lastVac) {
              vacationDueStatus = monthsSinceAdm >= 22 ? 'Férias Dobradas / Limite' : 'Período Vencido';
            }
          }
        }

        return {
          employeeId: emp.id,
          employeeName: emp.name,
          role: emp.role || 'Colaborador',
          status: emp.status || 'ativo',
          baseSalary,
          overtimeAndBonus,
          commissions,
          advancesDiscount,
          otherDiscounts,
          netSalary,
          cnhExpiration: cnhExp ? cnhExp.slice(0, 10) : undefined,
          cnhDaysLeft,
          vacationDueStatus,
        };
      })
      .sort((a, b) => b.netSalary - a.netSalary);
  }, [employees, payrolls, advances, vacations, activeCompetence, statusFilter, searchTerm, todayMs]);

  const kpis = useMemo(() => {
    const totalBase = rows.reduce((s, r) => s + r.baseSalary, 0);
    const totalVar = rows.reduce((s, r) => s + r.overtimeAndBonus + r.commissions, 0);
    const totalVales = rows.reduce((s, r) => s + r.advancesDiscount, 0);
    const totalNet = rows.reduce((s, r) => s + r.netSalary, 0);
    const cnhAlerts = rows.filter((r) => typeof r.cnhDaysLeft === 'number' && r.cnhDaysLeft <= 30).length;
    return { totalBase, totalVar, totalVales, totalNet, cnhAlerts };
  }, [rows]);

  const printConfig = useMemo(
    () =>
      buildRhFolhaReport({
        companyProfile,
        rows,
        competence: activeCompetence,
        statusFilter,
        searchTerm,
      }),
    [companyProfile, rows, activeCompetence, statusFilter, searchTerm]
  );

  useEffect(() => {
    onRegisterPrintGetter?.(() => printConfig);
  }, [onRegisterPrintGetter, printConfig]);

  const handleExportCsv = () => {
    const headers =
      'Colaborador,Cargo,Status,Salario_Base,HE_Bonus,Comissoes,Vales_Adiantamentos,Outros_Descontos,Liquido_R$,Venc_CNH,Situacao_Ferias\n';
    const csvRows = rows
      .map(
        (r) =>
          `"${r.employeeName}","${r.role}","${r.status}","${r.baseSalary.toFixed(2)}","${r.overtimeAndBonus.toFixed(2)}","${r.commissions.toFixed(2)}","${r.advancesDiscount.toFixed(2)}","${r.otherDiscounts.toFixed(2)}","${r.netSalary.toFixed(2)}","${r.cnhExpiration || ''}","${r.vacationDueStatus}"`
      )
      .join('\n');
    const blob = new Blob([headers + csvRows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `resumo_rh_folha_${activeCompetence.replace('/', '-')}.csv`;
    link.click();
  };

  return (
    <div className="flex-1 min-h-0 h-full max-h-full flex flex-col gap-2.5 overflow-hidden animate-fade-in">
      {/* 1. KPIs */}
      <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
        <div className="reports-kpi-card bg-[#e0e6f1] dark:bg-stone-900 rounded-lg py-2 px-3 border border-black dark:border-stone-800 border-l-[3px] border-l-slate-700 shadow-2xs flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-stone-800 text-slate-700 flex items-center justify-center shrink-0 border border-black/15">
            <Users className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 block truncate">
              Salários Base ({rows.length} Colab.)
            </span>
            <div className="text-sm sm:text-base font-black text-stone-900 dark:text-stone-100 font-['Outfit'] truncate">
              {formatCurrencyBRL(kpis.totalBase)}
            </div>
            <div className="text-[10px] text-stone-600 truncate">Competência {activeCompetence}</div>
          </div>
        </div>

        <div className="reports-kpi-card bg-[#e0e6f1] dark:bg-stone-900 rounded-lg py-2 px-3 border border-black dark:border-stone-800 border-l-[3px] border-l-sky-600 shadow-2xs flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-sky-50 dark:bg-sky-950/50 text-sky-700 flex items-center justify-center shrink-0 border border-black/15">
            <Clock className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 block truncate">
              H. Extras, Bônus & Comissões
            </span>
            <div className="text-sm sm:text-base font-black text-sky-800 dark:text-sky-300 font-['Outfit'] truncate">
              {formatCurrencyBRL(kpis.totalVar)}
            </div>
            <div className="text-[10px] text-stone-600 truncate">Variáveis da competência</div>
          </div>
        </div>

        <div className="reports-kpi-card bg-[#e0e6f1] dark:bg-stone-900 rounded-lg py-2 px-3 border border-black dark:border-stone-800 border-l-[3px] border-l-amber-600 shadow-2xs flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-700 flex items-center justify-center shrink-0 border border-black/15">
            <WalletCards className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 block truncate">
              Vales & Adiantamentos
            </span>
            <div className="text-sm sm:text-base font-black text-amber-700 dark:text-amber-400 font-['Outfit'] truncate">
              {formatCurrencyBRL(kpis.totalVales)}
            </div>
            <div className="text-[10px] text-stone-600 truncate">Descontos / consumos particulares</div>
          </div>
        </div>

        <div className="reports-kpi-card bg-[#e0e6f1] dark:bg-stone-900 rounded-lg py-2 px-3 border border-black dark:border-stone-800 border-l-[3px] border-l-emerald-600 shadow-2xs flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 flex items-center justify-center shrink-0 border border-black/15">
            {kpis.cnhAlerts > 0 ? (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            ) : (
              <DollarSign className="w-3.5 h-3.5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 block truncate">
              Total Líquido Folha / RH
            </span>
            <div className="text-sm sm:text-base font-black text-emerald-700 dark:text-emerald-400 font-['Outfit'] truncate">
              {formatCurrencyBRL(kpis.totalNet)}
            </div>
            <div className="text-[10px] text-stone-600 truncate">
              {kpis.cnhAlerts > 0 ? `${kpis.cnhAlerts} CNH vencendo / vencida` : 'CNHs em conformidade'}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Filtros */}
      <div className="shrink-0 reports-filter-bar bg-[#cad4e6] dark:bg-stone-900 border border-black dark:border-stone-800 rounded-lg p-2 shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          <CompetenceSelector
            competence={activeCompetence}
            onPrev={() => onCompetenceChange?.(getPrevCompetence(activeCompetence))}
            onNext={() => onCompetenceChange?.(getNextCompetence(activeCompetence))}
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ativos' | 'todos' | 'inativos')}
            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 outline-none"
          >
            <option value="ativos">Colaboradores Ativos</option>
            <option value="todos">Todos os Colaboradores</option>
            <option value="inativos">Desligados / Inativos</option>
          </select>

          <div className="relative flex-1 min-w-[180px] max-w-[260px]">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar colaborador, cargo ou CPF..."
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

      {/* 3. Tabela */}
      <div className="flex-1 min-h-0 bg-white dark:bg-stone-900 border border-black dark:border-stone-800 rounded-lg shadow-xs overflow-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-[#cad4e6] dark:bg-stone-800 border-b border-black text-stone-900 dark:text-stone-100 font-black uppercase text-[10px]">
            <tr>
              <th className="py-2 px-3">Colaborador</th>
              <th className="py-2 px-3">Cargo / Função</th>
              <th className="py-2 px-3 text-right">Salário Base</th>
              <th className="py-2 px-3 text-right">H.E. / Bônus</th>
              <th className="py-2 px-3 text-right">Comissões</th>
              <th className="py-2 px-3 text-right">Vales / Desc.</th>
              <th className="py-2 px-3 text-right">Líquido (R$)</th>
              <th className="py-2 px-3 text-center">Venc. CNH</th>
              <th className="py-2 px-3">Situação Férias</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
            {rows.length > 0 ? (
              rows.map((row) => {
                const cnhAlert = typeof row.cnhDaysLeft === 'number' && row.cnhDaysLeft <= 30;
                return (
                  <tr key={row.employeeId} className="hover:bg-slate-50 dark:hover:bg-stone-800/40">
                    <td className="py-2 px-3 font-bold text-stone-900 dark:text-stone-100">
                      {row.employeeName}
                    </td>
                    <td className="py-2 px-3 text-stone-700 dark:text-stone-300">{row.role}</td>
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      {formatCurrencyBRL(row.baseSalary)}
                    </td>
                    <td className="py-2 px-3 text-right whitespace-nowrap text-sky-700 font-semibold">
                      {formatCurrencyBRL(row.overtimeAndBonus)}
                    </td>
                    <td className="py-2 px-3 text-right whitespace-nowrap text-emerald-700 font-semibold">
                      {formatCurrencyBRL(row.commissions)}
                    </td>
                    <td className="py-2 px-3 text-right whitespace-nowrap text-rose-700 font-semibold">
                      {formatCurrencyBRL(row.advancesDiscount + row.otherDiscounts)}
                    </td>
                    <td className="py-2 px-3 text-right whitespace-nowrap font-black text-stone-900 dark:text-stone-100">
                      {formatCurrencyBRL(row.netSalary)}
                    </td>
                    <td className="py-2 px-3 text-center whitespace-nowrap">
                      {row.cnhExpiration ? (
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            cnhAlert
                              ? 'bg-rose-100 text-rose-800 border-rose-300'
                              : 'bg-slate-100 text-slate-700 border-slate-300'
                          }`}
                        >
                          {formatDateBR(row.cnhExpiration)}
                        </span>
                      ) : (
                        <span className="text-stone-400">--</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-xs font-medium text-stone-700 dark:text-stone-300">
                      {row.vacationDueStatus}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={9} className="py-10 text-center text-stone-500">
                  Nenhum colaborador encontrado para os filtros aplicados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
