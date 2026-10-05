import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  FileSpreadsheet, 
  ShieldCheck, 
  Database
} from 'lucide-react';
import { CargosPermissoesTab } from './CargosPermissoesTab';
import { CentrosCustoTab } from './CentrosCustoTab';
import { PlanoContasTab } from './PlanoContasTab';

export type CadastrosSubTab = 'centros_custo' | 'plano_contas' | 'cargos_permissoes';

interface CadastrosBaseModuleProps {
  initialSubTab?: CadastrosSubTab | string;
}

export const CadastrosBaseModule: React.FC<CadastrosBaseModuleProps> = ({
  initialSubTab = 'cargos_permissoes',
}) => {
  const resolveTab = (tabStr?: string): CadastrosSubTab => {
    if (tabStr === 'centros_custo' || tabStr === 'cadastros_base_centros_custo') return 'centros_custo';
    if (tabStr === 'plano_contas' || tabStr === 'cadastros_base_plano_contas') return 'plano_contas';
    if (tabStr === 'cargos_permissoes' || tabStr === 'cadastros_base_cargos_permissoes') return 'cargos_permissoes';
    return 'cargos_permissoes';
  };

  const [activeTab, setActiveTab] = useState<CadastrosSubTab>(() => resolveTab(initialSubTab));

  useEffect(() => {
    if (initialSubTab) {
      setActiveTab(resolveTab(initialSubTab));
    }
  }, [initialSubTab]);

  return (
    <div className="space-y-2.5 sm:space-y-3 max-w-7xl mx-auto pb-4">
      {/* Top Banner Slim - Compacto e Fino (bg-slate-800) */}
      <div className="bg-slate-800 dark:bg-zinc-800 text-white rounded-xl py-2.5 sm:py-3 px-3.5 sm:px-4 shadow-xs border border-slate-700/80 dark:border-zinc-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
              <Database className="w-3.5 h-3.5 stroke-[2.2]" />
            </div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-white">
                Cadastros Base
              </h1>
              <span className="text-[9px] font-black uppercase tracking-wider text-indigo-300 bg-indigo-950/80 px-1.5 py-0.5 rounded border border-indigo-700/50">
                ESTRUTURAÇÃO & GOVERNANÇA
              </span>
            </div>
          </div>
        </div>

        {/* 3 Abas/Cards Horizontais Compactas e Achatadas (Slim Tab Switcher) */}
        <div className="mt-2.5 pt-2.5 border-t border-slate-700/60 dark:border-zinc-700 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
          {/* Card 1: Centros de Custo */}
          <button
            type="button"
            id="tab-card-centros-custo"
            onClick={() => setActiveTab('centros_custo')}
            className={`w-full flex items-center justify-center sm:justify-start space-x-2 py-1.5 sm:py-2 px-3 rounded-lg border text-left transition-all duration-150 cursor-pointer ${
              activeTab === 'centros_custo'
                ? 'bg-blue-600 text-white border-blue-500 shadow-xs ring-1 ring-blue-400/70 font-semibold'
                : 'bg-blue-50 dark:bg-stone-800 text-slate-800 dark:text-stone-200 border-blue-200/90 dark:border-stone-700 hover:bg-blue-100 hover:border-blue-300 font-medium'
            }`}
          >
            <Building2 className={`w-4 h-4 shrink-0 ${activeTab === 'centros_custo' ? 'text-white' : 'text-blue-600 dark:text-blue-400'}`} />
            <span className="text-xs sm:text-sm font-semibold truncate">
              Centros de Custo
            </span>
          </button>

          {/* Card 2: Plano de Contas & Formas */}
          <button
            type="button"
            id="tab-card-plano-contas"
            onClick={() => setActiveTab('plano_contas')}
            className={`w-full flex items-center justify-center sm:justify-start space-x-2 py-1.5 sm:py-2 px-3 rounded-lg border text-left transition-all duration-150 cursor-pointer ${
              activeTab === 'plano_contas'
                ? 'bg-amber-500 text-zinc-950 border-amber-400 shadow-xs ring-1 ring-amber-300/70 font-semibold'
                : 'bg-amber-50 dark:bg-stone-800 text-slate-800 dark:text-stone-200 border-amber-200/90 dark:border-stone-700 hover:bg-amber-100 hover:border-amber-300 font-medium'
            }`}
          >
            <FileSpreadsheet className={`w-4 h-4 shrink-0 ${activeTab === 'plano_contas' ? 'text-zinc-950' : 'text-amber-600 dark:text-amber-400'}`} />
            <span className="text-xs sm:text-sm font-semibold truncate">
              Plano de Contas & Formas
            </span>
          </button>

          {/* Card 3: Cargos, Setores & Permissões */}
          <button
            type="button"
            id="tab-card-cargos-permissoes"
            onClick={() => setActiveTab('cargos_permissoes')}
            className={`w-full flex items-center justify-center sm:justify-start space-x-2 py-1.5 sm:py-2 px-3 rounded-lg border text-left transition-all duration-150 cursor-pointer ${
              activeTab === 'cargos_permissoes'
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-xs ring-1 ring-indigo-400/70 font-semibold'
                : 'bg-indigo-50 dark:bg-stone-800 text-slate-800 dark:text-stone-200 border-indigo-200/90 dark:border-stone-700 hover:bg-indigo-100 hover:border-indigo-300 font-medium'
            }`}
          >
            <ShieldCheck className={`w-4 h-4 shrink-0 ${activeTab === 'cargos_permissoes' ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}`} />
            <span className="text-xs sm:text-sm font-semibold truncate">
              Cargos, Setores & Permissões
            </span>
          </button>
        </div>
      </div>

      {/* Renderização do Sub-menu ativo */}
      {activeTab === 'centros_custo' && <CentrosCustoTab />}
      {activeTab === 'plano_contas' && <PlanoContasTab />}
      {activeTab === 'cargos_permissoes' && <CargosPermissoesTab />}
    </div>
  );
};
