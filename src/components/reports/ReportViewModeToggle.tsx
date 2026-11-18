import React from 'react';
import { List, BarChart3 } from 'lucide-react';
import { ReportViewMode } from './reportPrintBuilders';

interface GroupOption {
  value: string;
  label: string;
}

interface ReportViewModeToggleProps {
  viewMode: ReportViewMode;
  onChange: (mode: ReportViewMode) => void;
  groupBy?: string;
  groupOptions?: GroupOption[];
  onGroupByChange?: (value: string) => void;
}

export const ReportViewModeToggle: React.FC<ReportViewModeToggleProps> = ({
  viewMode,
  onChange,
  groupBy,
  groupOptions,
  onGroupByChange,
}) => {
  return (
    <div className="inline-flex flex-wrap items-center gap-1.5 shrink-0">
      <div
        role="group"
        aria-label="Formato do relatório"
        className="inline-flex items-center rounded-lg border border-slate-400 dark:border-stone-700 overflow-hidden bg-white dark:bg-stone-800 shadow-2xs"
      >
        <button
          type="button"
          onClick={() => onChange('analitico')}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold transition cursor-pointer ${
            viewMode === 'analitico'
              ? 'bg-emerald-700 text-white'
              : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-slate-100 dark:hover:bg-stone-700'
          }`}
        >
          <List className="w-3.5 h-3.5" />
          <span>Analítico</span>
        </button>
        <button
          type="button"
          onClick={() => onChange('sintetico')}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold border-l border-slate-400 dark:border-stone-700 transition cursor-pointer ${
            viewMode === 'sintetico'
              ? 'bg-emerald-700 text-white'
              : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-slate-100 dark:hover:bg-stone-700'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Sintético</span>
        </button>
      </div>

      {viewMode === 'sintetico' && groupOptions && groupOptions.length > 0 && onGroupByChange && (
        <select
          value={groupBy}
          onChange={(e) => onGroupByChange(e.target.value)}
          aria-label="Agrupar relatório sintético por"
          className="px-2.5 py-1.5 rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-[#009688] cursor-pointer"
        >
          {groupOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              Agrupar: {opt.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
};
