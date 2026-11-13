import React, { useMemo, useState } from 'react';
import {
  Check,
  CheckSquare,
  Filter,
  Loader2,
  Lock,
  Printer,
  Users,
  X,
} from 'lucide-react';
import { CompanyProfile, Employee } from '../../types';
import {
  getCachedMediaUrl,
  getEmployeeAvatarRef,
  resolveMediaUrlAsync,
} from '../../lib/imageStorage';
import { isBrokenAvatarUrl } from '../common/EmployeeAvatar';
import { executePrint } from '../../lib/printService';
import {
  DEFAULT_SELECTED_PRINT_COLUMNS,
  EMPLOYEE_PRINT_COLUMNS,
  EmployeePrintColumnKey,
  EmployeePrintScope,
  generateEmployeeListPrintHtml,
  getEmployeePrintPhotoKey,
  isEmployeeActiveRecord,
} from './employeeListPrintUtils';

interface VacationAlertMinimal {
  level: 'expired' | 'warning' | 'none';
  badgeText?: string;
  monthsLabel?: string;
}

interface EmployeeListPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  company: CompanyProfile;
  activeEmployees: Employee[];
  allEmployees: Employee[];
  getVacationAlert: (emp: Employee) => VacationAlertMinimal;
}

export const EmployeeListPrintModal: React.FC<EmployeeListPrintModalProps> = ({
  isOpen,
  onClose,
  company,
  activeEmployees,
  allEmployees,
  getVacationAlert,
}) => {
  const [scope, setScope] = useState<EmployeePrintScope>('active');
  const [selectedColumns, setSelectedColumns] = useState<EmployeePrintColumnKey[]>(
    DEFAULT_SELECTED_PRINT_COLUMNS
  );
  const [isGenerating, setIsGenerating] = useState(false);

  const activeOnlyList = useMemo(() => {
    const base = activeEmployees.length > 0 ? activeEmployees : allEmployees;
    return base.filter((emp) => isEmployeeActiveRecord(emp));
  }, [activeEmployees, allEmployees]);

  const allCombinedList = useMemo(() => {
    return allEmployees.length > 0 ? allEmployees : activeEmployees;
  }, [allEmployees, activeEmployees]);

  const vacationAlertsList = useMemo(() => {
    return activeOnlyList.filter((emp) => {
      const alert = getVacationAlert(emp);
      return alert.level === 'expired' || alert.level === 'warning';
    });
  }, [activeOnlyList, getVacationAlert]);

  const targetEmployees = useMemo(() => {
    if (scope === 'all') return allCombinedList;
    if (scope === 'vacation_alerts') return vacationAlertsList;
    return activeOnlyList;
  }, [scope, allCombinedList, vacationAlertsList, activeOnlyList]);

  if (!isOpen) return null;

  const nonFixedKeys = EMPLOYEE_PRINT_COLUMNS.filter((c) => !c.fixed).map((c) => c.key);
  const areAllNonFixedSelected = nonFixedKeys.every((k) => selectedColumns.includes(k));

  const handleToggleColumn = (key: EmployeePrintColumnKey, fixed?: boolean) => {
    if (fixed) return;
    setSelectedColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleToggleAllColumns = () => {
    if (areAllNonFixedSelected) {
      setSelectedColumns(['name']);
    } else {
      setSelectedColumns(EMPLOYEE_PRINT_COLUMNS.map((c) => c.key));
    }
  };

  const handleGenerateAndPrint = async () => {
    setIsGenerating(true);
    // Abre a janela síncrona no clique para evitar bloqueio de pop-up nos navegadores
    let printWin: Window | null = null;
    try {
      printWin = window.open('', '_blank', 'width=1000,height=750');
    } catch {
      printWin = null;
    }

    try {
      const resolvedLogoUrl =
        (await resolveMediaUrlAsync(company?.logoUrl)) ||
        getCachedMediaUrl(company?.logoUrl) ||
        '';

      const resolvedPhotosByKey: Record<string, string> = {};
      if (selectedColumns.includes('photo')) {
        await Promise.all(
          targetEmployees.map(async (emp, idx) => {
            const key = getEmployeePrintPhotoKey(emp, idx);
            const rawCandidates = [
              emp.avatar_url,
              emp.photoUrl,
              emp.foto_url,
              emp.foto,
              emp.id ? getEmployeeAvatarRef(emp.id) : undefined,
            ];

            for (const candidate of rawCandidates) {
              if (!candidate || isBrokenAvatarUrl(candidate)) continue;
              const resolved =
                (await resolveMediaUrlAsync(candidate)) ||
                getCachedMediaUrl(candidate);
              if (resolved && !isBrokenAvatarUrl(resolved)) {
                resolvedPhotosByKey[key] = resolved;
                break;
              }
            }
          })
        );
      }

      const html = generateEmployeeListPrintHtml({
        company,
        employees: targetEmployees,
        badgeSequenceSource: allCombinedList,
        selectedColumns,
        scope,
        resolvedLogoUrl,
        resolvedPhotosByKey,
        getVacationStatusLabel: (emp) => {
          const alert = getVacationAlert(emp);
          if (alert.level === 'expired') {
            return {
              text: alert.monthsLabel
                ? `Vencida (${alert.monthsLabel})`
                : 'Férias Vencidas',
              level: 'expired',
            };
          }
          if (alert.level === 'warning') {
            return {
              text: alert.monthsLabel
                ? `A vencer (${alert.monthsLabel})`
                : 'Próxima a vencer',
              level: 'warning',
            };
          }
          return {
            text: emp.admissionDate ? 'Regular' : 'Sem admissão',
            level: 'none',
          };
        },
      });

      if (printWin) {
        printWin.document.open();
        printWin.document.write(html);
        printWin.document.close();
        printWin.focus();
      } else {
        executePrint(html);
      }

      onClose();
    } catch (err) {
      console.error('Erro ao gerar relatório de colaboradores:', err);
      if (printWin) {
        try {
          printWin.close();
        } catch {}
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const orientationLabel =
    selectedColumns.length > 7 ? 'Paisagem (A4 Horizontal)' : 'Retrato (A4 Vertical)';

  return (
    <div
      className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 no-print overflow-hidden"
      onClick={onClose}
    >
      <div
        className="bg-[#cad4e6] dark:bg-stone-900 border border-black dark:border-stone-700 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[93vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho Oficial AgroControl */}
        <div className="px-4 sm:px-5 py-3 bg-[#cad4e6] dark:bg-stone-900 border-b border-black dark:border-stone-700 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-white dark:bg-stone-800 border border-gray-400 dark:border-stone-700 flex items-center justify-center shadow-2xs shrink-0">
              <Printer className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-black dark:text-stone-100 truncate">
                CONFIGURAR IMPRESSÃO — RELAÇÃO DE COLABORADORES
              </h3>
              <p className="text-[11px] text-stone-800 dark:text-stone-300 font-semibold truncate">
                Selecione o filtro de funcionários e as colunas desejadas para impressão em A4
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/80 hover:bg-white border border-gray-400 text-black transition cursor-pointer shrink-0"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo com 2 Cards Internos (#e0e6f1 + border-black) */}
        <div className="p-4 space-y-3 overflow-y-auto flex-1 bg-[#cad4e6] dark:bg-stone-950">
          {/* CARD 1: Filtro de Colaboradores */}
          <div className="bg-[#e0e6f1] dark:bg-stone-900 border border-black dark:border-stone-700 rounded-xl p-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-400/70 pb-1.5">
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-slate-800 dark:text-stone-200" />
                <h4 className="text-xs font-extrabold uppercase tracking-wide text-black dark:text-stone-100">
                  1. Filtro de Colaboradores
                </h4>
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-slate-400 text-[11px] font-bold text-black">
                <Users className="w-3 h-3 text-emerald-700" />
                {targetEmployees.length}{' '}
                {targetEmployees.length === 1 ? 'listado' : 'listados'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                {
                  id: 'active' as EmployeePrintScope,
                  label: 'Apenas Colaboradores Ativos',
                  count: activeOnlyList.length,
                },
                {
                  id: 'all' as EmployeePrintScope,
                  label: 'Todos (Ativos + Ex-Colaboradores)',
                  count: allCombinedList.length,
                },
                {
                  id: 'vacation_alerts' as EmployeePrintScope,
                  label: 'Apenas com Férias Vencidas / A Vencer',
                  count: vacationAlertsList.length,
                },
              ].map((opt) => {
                const isSelected = scope === opt.id;
                return (
                  <label
                    key={opt.id}
                    className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border cursor-pointer transition select-none ${
                      isSelected
                        ? 'bg-white border-emerald-700 ring-1 ring-emerald-600 text-black'
                        : 'bg-white/85 border-slate-400 text-slate-700 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <input
                        type="radio"
                        name="employee-print-scope"
                        checked={isSelected}
                        onChange={() => setScope(opt.id)}
                        className="sr-only"
                      />
                      <span
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'border-emerald-700 bg-emerald-600'
                            : 'border-slate-500 bg-white'
                        }`}
                      >
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                      <span className="text-xs font-bold leading-tight">{opt.label}</span>
                    </div>
                    <span className="text-[11px] font-black px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 text-slate-800 shrink-0">
                      {opt.count}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* CARD 2: Escolha quais informações devem sair na impressão */}
          <div className="bg-[#e0e6f1] dark:bg-stone-900 border border-black dark:border-stone-700 rounded-xl p-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-400/70 pb-1.5">
              <div className="flex items-center space-x-2">
                <CheckSquare className="w-4 h-4 text-slate-800 dark:text-stone-200" />
                <h4 className="text-xs font-extrabold uppercase tracking-wide text-black dark:text-stone-100">
                  2. Escolha quais informações devem sair na impressão
                </h4>
              </div>

              <button
                type="button"
                onClick={handleToggleAllColumns}
                className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 border border-slate-500 text-[11px] font-bold text-black transition cursor-pointer"
              >
                {areAllNonFixedSelected ? 'Desmarcar Todos' : 'Marcar / Desmarcar Todos'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {EMPLOYEE_PRINT_COLUMNS.map((col) => {
                const isChecked = col.fixed || selectedColumns.includes(col.key);
                return (
                  <label
                    key={col.key}
                    className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border transition select-none ${
                      col.fixed
                        ? 'bg-white border-slate-500 text-black cursor-not-allowed'
                        : isChecked
                        ? 'bg-white border-emerald-700 ring-1 ring-emerald-600 text-black cursor-pointer'
                        : 'bg-white/85 border-slate-400 text-slate-700 hover:bg-white cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={col.fixed}
                        onChange={() => handleToggleColumn(col.key, col.fixed)}
                        className="sr-only"
                      />
                      <span
                        className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 transition ${
                          isChecked
                            ? col.fixed
                              ? 'bg-slate-700 border-slate-800 text-white'
                              : 'bg-emerald-600 border-emerald-700 text-white'
                            : 'bg-white border-slate-500 text-transparent'
                        }`}
                      >
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                      <span className="text-xs font-bold leading-tight">{col.label}</span>
                    </div>

                    {col.fixed && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 text-slate-700 shrink-0">
                        <Lock className="w-2.5 h-2.5" /> Fixo
                      </span>
                    )}
                  </label>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-800 font-semibold">
              <span>
                Colunas selecionadas: <strong>{selectedColumns.length}</strong> de{' '}
                {EMPLOYEE_PRINT_COLUMNS.length}
              </span>
              <span>
                Orientação automática da folha: <strong>{orientationLabel}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Rodapé Oficial AgroControl */}
        <div className="px-4 py-3 bg-[#cad4e6] dark:bg-stone-900 border-t border-black dark:border-stone-700 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-400 bg-white hover:bg-gray-100 text-black text-xs font-bold uppercase transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleGenerateAndPrint}
            disabled={isGenerating}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold border border-emerald-700 shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-60 inline-flex items-center gap-1.5"
          >
            {isGenerating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>🖨️ Gerar e Imprimir Relatório</span>
          </button>
        </div>
      </div>
    </div>
  );
};
