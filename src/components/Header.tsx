import React from 'react';
import { 
  Sprout, 
  PlusCircle, 
  Upload, 
  Sparkles, 
  DollarSign, 
  FileText, 
  AlertTriangle,
  FolderSync
} from 'lucide-react';
import { formatCurrencyBRL } from '../lib/storage';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onNewExpense: () => void;
  onOpenAiParser: () => void;
  onOpenIntegration: () => void;
  pendingTotal: number;
  overdueCount: number;
  paidTotal: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onNewExpense,
  onOpenAiParser,
  onOpenIntegration,
  pendingTotal,
  overdueCount,
  paidTotal,
}) => {
  return (
    <header id="main-header" className="bg-stone-900 text-stone-100 border-b border-stone-800 sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('despesas')}>
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-stone-950 font-black shadow-lg shadow-emerald-500/20">
              <Sprout className="w-6 h-6 text-stone-950" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-extrabold tracking-tight text-white font-['Outfit']">
                  Silagem<span className="text-emerald-400">Fácil</span>
                </span>
                <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  CRM & Despesas
                </span>
              </div>
              <p className="text-xs text-stone-400 hidden sm:block">
                Gestão Financeira & Comercial da Silagem
              </p>
            </div>
          </div>

          {/* Quick Metrics Bar on Desktop */}
          <div className="hidden lg:flex items-center space-x-6 text-xs bg-stone-800/70 border border-stone-700/60 rounded-xl px-4 py-2">
            <div>
              <span className="text-stone-400 block">Total Pago (Mês):</span>
              <span className="font-bold text-emerald-400 text-sm">{formatCurrencyBRL(paidTotal)}</span>
            </div>
            <div className="h-6 w-px bg-stone-700"></div>
            <div>
              <span className="text-stone-400 block">A Pagar / Pendente:</span>
              <span className="font-bold text-amber-400 text-sm">{formatCurrencyBRL(pendingTotal)}</span>
            </div>
            {overdueCount > 0 && (
              <>
                <div className="h-6 w-px bg-stone-700"></div>
                <div className="flex items-center space-x-1.5 text-rose-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="font-semibold">{overdueCount} atrasada(s)</span>
                </div>
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            
            {/* AI Natural Language Fast Entry */}
            <button
              id="btn-ai-expense"
              onClick={onOpenAiParser}
              className="inline-flex items-center space-x-1.5 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg bg-stone-800 hover:bg-stone-700 text-emerald-300 border border-emerald-500/30 hover:border-emerald-400 transition shadow-sm"
              title="Lançamento Inteligente por voz ou texto rápido"
            >
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span className="hidden md:inline">Lançar c/ IA</span>
            </button>

            {/* Lovable Integration / Import Button */}
            <button
              id="btn-integration-lovable"
              onClick={onOpenIntegration}
              className="inline-flex items-center space-x-1.5 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 hover:text-white transition"
              title="Importar do Lovable / Exportar dados"
            >
              <FolderSync className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Lovable & Dados</span>
            </button>

            {/* Primary Action: New Expense */}
            <button
              id="btn-new-expense-header"
              onClick={onNewExpense}
              className="inline-flex items-center space-x-2 px-3.5 py-2 text-xs sm:text-sm font-bold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-stone-950 transition shadow-lg shadow-emerald-500/25 active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Nova Despesa</span>
            </button>

          </div>

        </div>
      </div>
    </header>
  );
};
