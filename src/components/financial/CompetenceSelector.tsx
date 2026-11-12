import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface CompetenceSelectorProps {
  competence: string;
  onPrev: (e?: React.MouseEvent) => void;
  onNext: (e?: React.MouseEvent) => void;
  className?: string;
  title?: string;
}

export function getCurrentCompetence(): string {
  const now = new Date();
  return `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
}

export function getPrevCompetence(competence: string): string {
  if (!competence || !competence.includes('/')) return getCurrentCompetence();
  const [mStr, yStr] = competence.split('/');
  let m = parseInt(mStr, 10);
  let y = parseInt(yStr, 10);
  if (isNaN(m) || isNaN(y)) return getCurrentCompetence();
  if (m === 1) {
    m = 12;
    y -= 1;
  } else {
    m -= 1;
  }
  return `${String(m).padStart(2, '0')}/${y}`;
}

export function getNextCompetence(competence: string): string {
  if (!competence || !competence.includes('/')) return getCurrentCompetence();
  const [mStr, yStr] = competence.split('/');
  let m = parseInt(mStr, 10);
  let y = parseInt(yStr, 10);
  if (isNaN(m) || isNaN(y)) return getCurrentCompetence();
  if (m === 12) {
    m = 1;
    y += 1;
  } else {
    m += 1;
  }
  return `${String(m).padStart(2, '0')}/${y}`;
}

export function matchesCompetence(dateStr: string | undefined | null, competence: string): boolean {
  if (!dateStr || !competence) return false;
  const cleanComp = competence.trim();
  if (!cleanComp.includes('/')) return true;
  const [mStr, yStr] = cleanComp.split('/');
  const mPad = mStr.padStart(2, '0');
  const y = yStr;

  // Formato ISO: YYYY-MM-DD ou YYYY-MM
  if (dateStr.includes('-')) {
    if (dateStr.startsWith(`${y}-${mPad}`)) return true;
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length >= 2 && parts[0] === y && parts[1].padStart(2, '0') === mPad) return true;
  }

  // Formato PT-BR: DD/MM/YYYY ou MM/YYYY
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      if (parts[1].padStart(2, '0') === mPad && parts[2].startsWith(y)) return true;
    } else if (parts.length === 2) {
      if (parts[0].padStart(2, '0') === mPad && parts[1].startsWith(y)) return true;
    }
  }

  return false;
}

export function getCompetenceDateRange(competence: string): { start: string; end: string } {
  if (!competence || !competence.includes('/')) {
    const now = new Date();
    const curComp = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    return getCompetenceDateRange(curComp);
  }
  const [mStr, yStr] = competence.split('/');
  const m = parseInt(mStr, 10);
  const y = parseInt(yStr, 10);
  if (isNaN(m) || isNaN(y)) {
    return { start: '', end: '' };
  }
  const mPad = String(m).padStart(2, '0');
  const lastDay = new Date(y, m, 0).getDate();
  const lastDayPad = String(lastDay).padStart(2, '0');
  return {
    start: `${y}-${mPad}-01`,
    end: `${y}-${mPad}-${lastDayPad}`,
  };
}

export const CompetenceSelector: React.FC<CompetenceSelectorProps> = ({
  competence,
  onPrev,
  onNext,
  className = '',
  title = 'Competência Ativa',
}) => {
  return (
    <div className={`competence-selector-root flex items-center space-x-1.5 shrink-0 ${className}`}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onPrev(e);
        }}
        className="competence-selector-btn p-1 rounded-lg border border-emerald-800 dark:border-emerald-900 bg-emerald-600 dark:bg-emerald-600 hover:bg-emerald-700 dark:hover:bg-emerald-700 transition cursor-pointer text-white font-bold select-none active:scale-95"
        title="Mês Anterior"
        aria-label="Mês Anterior"
      >
        <ChevronLeft className="w-3.5 h-3.5 text-white stroke-[2.5]" />
      </button>

      <div
        className="competence-selector-badge flex items-center space-x-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-emerald-600 dark:bg-emerald-600 text-white border border-emerald-800 dark:border-emerald-900 shadow-2xs select-none"
        title={title}
      >
        <span className="text-white font-bold">Competência:</span>
        <span className="text-white font-bold text-sm">{competence}</span>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onNext(e);
        }}
        className="competence-selector-btn p-1 rounded-lg border border-emerald-800 dark:border-emerald-900 bg-emerald-600 dark:bg-emerald-600 hover:bg-emerald-700 dark:hover:bg-emerald-700 transition cursor-pointer text-white font-bold select-none active:scale-95"
        title="Próximo Mês"
        aria-label="Próximo Mês"
      >
        <ChevronRight className="w-3.5 h-3.5 text-white stroke-[2.5]" />
      </button>
    </div>
  );
};
