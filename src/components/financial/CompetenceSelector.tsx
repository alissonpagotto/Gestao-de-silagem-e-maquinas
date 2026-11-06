import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CompetenceSelectorProps {
  competence: string;
  onPrev: () => void;
  onNext: () => void;
  className?: string;
}

export const CompetenceSelector: React.FC<CompetenceSelectorProps> = ({
  competence,
  onPrev,
  onNext,
  className = '',
}) => {
  return (
    <div className={`flex items-center space-x-1.5 shrink-0 ${className}`}>
      <button
        type="button"
        onClick={onPrev}
        className="p-1 rounded-lg border border-blue-300 dark:border-stone-700 bg-blue-100/50 dark:bg-stone-800 hover:bg-blue-200/70 dark:hover:bg-stone-700 transition cursor-pointer text-black dark:text-white"
        title="Mês Anterior"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>

      <div
        style={{ backgroundColor: '#cefebd', borderColor: '#4fd716' }}
        className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-black text-black border border-[#4fd716] shadow-2xs select-none"
      >
        <span className="font-bold">Competência:</span>
        <span className="text-black font-black text-sm font-mono tracking-tight">{competence}</span>
      </div>

      <button
        type="button"
        onClick={onNext}
        className="p-1 rounded-lg border border-blue-300 dark:border-stone-700 bg-blue-100/50 dark:bg-stone-800 hover:bg-blue-200/70 dark:hover:bg-stone-700 transition cursor-pointer text-black dark:text-white"
        title="Próximo Mês"
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export const getPrevCompetence = (competence: string): string => {
  const [mStr, yStr] = (competence || '').split('/');
  let m = parseInt(mStr, 10) || 1;
  let y = parseInt(yStr, 10) || 2026;
  m -= 1;
  if (m < 1) {
    m = 12;
    y -= 1;
  }
  return `${String(m).padStart(2, '0')}/${y}`;
};

export const getNextCompetence = (competence: string): string => {
  const [mStr, yStr] = (competence || '').split('/');
  let m = parseInt(mStr, 10) || 1;
  let y = parseInt(yStr, 10) || 2026;
  m += 1;
  if (m > 12) {
    m = 1;
    y += 1;
  }
  return `${String(m).padStart(2, '0')}/${y}`;
};

export const getCompetenceDateRange = (competence: string): { start: string; end: string } => {
  const [mStr, yStr] = (competence || '').split('/');
  const m = parseInt(mStr, 10) || 1;
  const y = parseInt(yStr, 10) || 2026;
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
};

export const matchesCompetence = (dateStr?: string | null, competence?: string): boolean => {
  if (!competence || !dateStr) return false;
  const [mStr, yStr] = competence.split('/');
  if (!mStr || !yStr) return false;
  const cleanM = mStr.padStart(2, '0');
  const isoPrefix = `${yStr}-${cleanM}`;
  return (
    dateStr.startsWith(isoPrefix) ||
    dateStr.includes(`/${cleanM}/${yStr}`) ||
    dateStr.includes(`${cleanM}/${yStr}`)
  );
};
