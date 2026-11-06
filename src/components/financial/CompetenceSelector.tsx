import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface CompetenceSelectorProps {
  competence: string;
  onPrev: () => void;
  onNext: () => void;
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
    <div className={`flex items-center space-x-1.5 shrink-0 ${className}`}>
      <button
        type="button"
        onClick={onPrev}
        className="p-1 rounded-lg border border-blue-300 dark:border-stone-700 bg-blue-100/50 dark:bg-stone-800 hover:bg-blue-200/70 dark:hover:bg-stone-700 transition cursor-pointer text-black dark:text-white"
        title="Mês Anterior"
        aria-label="Mês Anterior"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>

      <div
        style={{ backgroundColor: '#cefebd', borderColor: '#4fd716' }}
        className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-lg text-xs font-black text-black dark:text-white border border-[#4fd716] shadow-2xs select-none"
        title={title}
      >
        <span>Competência:</span>
        <span className="text-black font-black text-sm">{competence}</span>
      </div>

      <button
        type="button"
        onClick={onNext}
        className="p-1 rounded-lg border border-blue-300 dark:border-stone-700 bg-blue-100/50 dark:bg-stone-800 hover:bg-blue-200/70 dark:hover:bg-stone-700 transition cursor-pointer text-black dark:text-white"
        title="Próximo Mês"
        aria-label="Próximo Mês"
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
