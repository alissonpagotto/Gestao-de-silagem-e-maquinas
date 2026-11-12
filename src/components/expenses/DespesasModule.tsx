import React, { useState, useMemo, useCallback } from 'react';
import { PlusCircle, Sparkles, Fuel } from 'lucide-react';
import { 
  Expense, 
  ExpenseCategory, 
  CostCenter, 
  Employee, 
  FleetTeam, 
  Machinery, 
  CropSeason, 
  CompanyProfile 
} from '../../types';
import { ExpenseStats } from './ExpenseStats';
import { ExpenseList } from './ExpenseList';
import { CompetenceSelector } from '../financial/CompetenceSelector';

export interface DespesasModuleProps {
  expenses: Expense[];
  machineries: Machinery[];
  seasons: CropSeason[];
  categories: ExpenseCategory[];
  costCenters: CostCenter[];
  employees: Employee[];
  fleetTeams: FleetTeam[];
  companyProfile?: CompanyProfile;
  onNewExpense: () => void;
  onOpenFuelModal: () => void;
  onEditExpense: (exp: Expense) => void;
  onDeleteExpense: (id: string) => void;
  onToggleExpenseStatus: (id: string, newStatus?: string) => void;
  onViewReceipt: (exp: Expense) => void;
  onDuplicateExpense: (exp: Expense) => void;
  onOpenAiParser?: () => void;
}

export const DespesasModule: React.FC<DespesasModuleProps> = ({
  expenses = [],
  machineries = [],
  seasons = [],
  categories = [],
  costCenters = [],
  employees = [],
  fleetTeams = [],
  companyProfile,
  onNewExpense,
  onOpenFuelModal,
  onEditExpense,
  onDeleteExpense,
  onToggleExpenseStatus,
  onViewReceipt,
  onDuplicateExpense,
  onOpenAiParser,
}) => {
  // Competência selecionada (padrão MM/AAAA, ex: "11/2026")
  const [competenceMonth, setCompetenceMonth] = useState<string>(() => {
    const now = new Date();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    return `${m}/${y}`;
  });

  const handlePrevMonth = useCallback(() => {
    setCompetenceMonth((prev) => {
      const parts = (prev || '11/2026').split('/');
      let month = Number(parts[0]) || 1;
      let year = Number(parts[1]) || 2026;
      let newMonth = month - 1;
      let newYear = year;
      if (newMonth < 1) {
        newMonth = 12;
        newYear -= 1;
      }
      return `${String(newMonth).padStart(2, '0')}/${newYear}`;
    });
  }, []);

  const handleNextMonth = useCallback(() => {
    setCompetenceMonth((prev) => {
      const parts = (prev || '11/2026').split('/');
      let month = Number(parts[0]) || 1;
      let year = Number(parts[1]) || 2026;
      let newMonth = month + 1;
      let newYear = year;
      if (newMonth > 12) {
        newMonth = 1;
        newYear += 1;
      }
      return `${String(newMonth).padStart(2, '0')}/${newYear}`;
    });
  }, []);

  // Filtragem dinâmica de despesas pela competência ativa (mês/ano)
  const filteredByCompetenceExpenses = useMemo(() => {
    if (!competenceMonth) return expenses;
    const parts = competenceMonth.split('/');
    if (parts.length !== 2) return expenses;
    const targetMonth = parts[0].padStart(2, '0');
    const targetYear = parts[1];

    return (expenses || []).filter((exp) => {
      if (!exp) return false;

      // 1. Campo de competência explícito se houver
      if (exp.competenceMonth) {
        const compRaw = String(exp.competenceMonth).trim();
        if (compRaw.includes('-')) {
          const [y, m] = compRaw.split('-');
          if (y === targetYear && m.padStart(2, '0') === targetMonth) return true;
        } else if (compRaw.includes('/')) {
          const [m, y] = compRaw.split('/');
          if (y === targetYear && m.padStart(2, '0') === targetMonth) return true;
        }
      }

      // 2. Data de vencimento (dueDate), data de pagamento (paymentDate) ou data do lançamento (date)
      const dateCandidates = [exp.dueDate, exp.paymentDate, exp.date, (exp as any).data];
      for (const d of dateCandidates) {
        if (!d) continue;
        const raw = String(d).trim();
        if (raw.includes('-')) {
          const p = raw.split('-');
          if (p.length >= 2) {
            const y = p[0];
            const m = p[1].padStart(2, '0');
            if (y === targetYear && m === targetMonth) return true;
          }
        } else if (raw.includes('/')) {
          const p = raw.split('/');
          if (p.length === 3) {
            const m = p[1].padStart(2, '0');
            const y = p[2];
            if (y === targetYear && m === targetMonth) return true;
          }
        }
      }

      return false;
    });
  }, [expenses, competenceMonth]);

  return (
    <div 
      id="modulo-despesas-master"
      className="w-full h-full flex flex-col space-y-4 bg-[#edf4ff] dark:bg-stone-900 overflow-y-auto scrollbar-thin p-2 sm:p-3 select-none"
    >
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-300 dark:border-stone-800 pb-2.5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-black text-black dark:text-stone-100 uppercase tracking-tight font-['Outfit']">
              CONTROLE DE DESPESAS
            </h1>

            {/* Seletor Unificado de Competência */}
            <CompetenceSelector
              competence={competenceMonth}
              onPrev={handlePrevMonth}
              onNext={handleNextMonth}
              className="ml-1 sm:ml-4"
            />

            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              MÓDULO MESTRE
            </span>
          </div>
          <p className="text-xs font-bold text-slate-600 dark:text-stone-300 uppercase tracking-wider mt-0.5">
            GERENCIE TODOS OS CUSTOS E DESPESAS OPERACIONAIS
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Botão Primário Lançar Despesa: Verde Padrão Mestre #059669 */}
          <button
            id="btn-despesas-novo-lancamento"
            onClick={onNewExpense}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs sm:text-sm font-bold uppercase tracking-wider rounded-xl bg-[#059669] hover:bg-emerald-700 text-white shadow-xs transition active:scale-95 cursor-pointer"
            title="Lançar Nova Despesa Operacional"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ LANÇAR DESPESA</span>
          </button>

          {/* Botão Abastecimento: Preservado rigorosamente na cor LARANJA */}
          <button
            id="btn-despesas-registrar-abastecimento"
            onClick={onOpenFuelModal}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs sm:text-sm font-bold uppercase tracking-wider rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition active:scale-95 cursor-pointer"
            title="Registrar Abastecimento no Tanque ou Posto (Módulo Gestão de Frotas)"
          >
            <Fuel className="w-4 h-4" />
            <span>+ REGISTRAR ABASTECIMENTO</span>
          </button>

          {/* Botão IA Rápida */}
          {onOpenAiParser && (
            <button
              id="btn-despesas-ai-fast"
              onClick={onOpenAiParser}
              className="inline-flex items-center space-x-1.5 px-3 py-2 text-xs sm:text-sm font-bold uppercase tracking-wider rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 border border-stone-300 dark:border-stone-700 hover:bg-stone-200 dark:hover:bg-stone-700 transition cursor-pointer"
              title="Lançamento Rápido com IA"
            >
              <Sparkles className="w-4 h-4 text-emerald-500" />
              <span className="hidden sm:inline">IA RÁPIDA</span>
            </button>
          )}
        </div>
      </div>

      {/* Mini-Cards de Resumo Operacional Aglutinado (Recalculados com base na Competência) */}
      <ExpenseStats
        expenses={filteredByCompetenceExpenses}
        machineries={machineries}
        seasons={seasons}
      />

      {/* Listagem, Filtros A-Z e Tabela de Despesas */}
      <ExpenseList
        expenses={filteredByCompetenceExpenses}
        categories={categories}
        costCenters={costCenters}
        employees={employees}
        teams={fleetTeams}
        companyProfile={companyProfile || ({ tradeName: 'AGROCONTROL' } as any)}
        onNewExpense={onNewExpense}
        onEditExpense={onEditExpense}
        onDeleteExpense={onDeleteExpense}
        onToggleStatus={onToggleExpenseStatus}
        onViewReceipt={onViewReceipt}
        onDuplicateExpense={onDuplicateExpense}
      />
    </div>
  );
};
