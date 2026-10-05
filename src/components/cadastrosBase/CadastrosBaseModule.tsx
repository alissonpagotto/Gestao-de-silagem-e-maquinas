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
    <div className="space-y-4 max-w-7xl mx-auto pb-8">
      {/* Top Banner do Módulo Cadastros Base - Cor Cinza-Escura Corporativa Padrão (bg-slate-800) */}
      <div className="bg-slate-800 dark:bg-zinc-800 text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-700/80 dark:border-zinc-700">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
              <Database className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-300 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-700/50">
                  ESTRUTURAÇÃO & GOVERNANÇA
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-white mt-0.5">
                Cadastros Base
              </h1>
              <p className="text-xs text-slate-300 dark:text-zinc-300">
                Parametrização corporativa resiliente em modo offline com controle de acessos por cargo, plano de contas e centros de custos.
              </p>
            </div>
          </div>
        </div>

        {/* 3 Cards Visuais Separados e Independentes (Tab Switcher no Topo) */}
        <div className="mt-4 pt-3.5 border-t border-slate-700/70 dark:border-zinc-700 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Card 1: Centros de Custo */}
          <button
            type="button"
            id="tab-card-centros-custo"
            onClick={() => setActiveTab('centros_custo')}
            className={`w-full flex items-center space-x-3 p-3 sm:py-2.5 sm:px-3.5 rounded-xl border text-left transition-all duration-150 cursor-pointer group ${
              activeTab === 'centros_custo'
                ? 'bg-blue-600 text-white border-blue-500 shadow-md ring-2 ring-blue-400/70 font-black'
                : 'bg-blue-50 dark:bg-stone-800/90 text-slate-800 dark:text-stone-200 border-blue-200/90 dark:border-stone-700 hover:bg-blue-100/90 hover:border-blue-300'
            }`}
          >
            <div className={`p-2 rounded-lg shrink-0 transition ${
              activeTab === 'centros_custo'
                ? 'bg-white/20 text-white'
                : 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
            }`}>
              <Building2 className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className={`text-xs sm:text-sm font-extrabold truncate ${
                activeTab === 'centros_custo' ? 'text-white' : 'text-slate-900 dark:text-white'
              }`}>
                Centros de Custo
              </div>
              <div className={`text-[11px] truncate ${
                activeTab === 'centros_custo' ? 'text-blue-100' : 'text-slate-600 dark:text-stone-400'
              }`}>
                Talhões & Custos Operacionais
              </div>
            </div>
          </button>

          {/* Card 2: Plano de Contas & Formas */}
          <button
            type="button"
            id="tab-card-plano-contas"
            onClick={() => setActiveTab('plano_contas')}
            className={`w-full flex items-center space-x-3 p-3 sm:py-2.5 sm:px-3.5 rounded-xl border text-left transition-all duration-150 cursor-pointer group ${
              activeTab === 'plano_contas'
                ? 'bg-amber-500 text-zinc-950 border-amber-400 shadow-md ring-2 ring-amber-300/70 font-black'
                : 'bg-amber-50 dark:bg-stone-800/90 text-slate-800 dark:text-stone-200 border-amber-200/90 dark:border-stone-700 hover:bg-amber-100/90 hover:border-amber-300'
            }`}
          >
            <div className={`p-2 rounded-lg shrink-0 transition ${
              activeTab === 'plano_contas'
                ? 'bg-black/15 text-zinc-950'
                : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
            }`}>
              <FileSpreadsheet className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className={`text-xs sm:text-sm font-extrabold truncate ${
                activeTab === 'plano_contas' ? 'text-zinc-950' : 'text-slate-900 dark:text-white'
              }`}>
                Plano de Contas & Formas
              </div>
              <div className={`text-[11px] truncate ${
                activeTab === 'plano_contas' ? 'text-amber-950/80' : 'text-slate-600 dark:text-stone-400'
              }`}>
                Categorias & Formas Pgto
              </div>
            </div>
          </button>

          {/* Card 3: Cargos, Setores & Permissões */}
          <button
            type="button"
            id="tab-card-cargos-permissoes"
            onClick={() => setActiveTab('cargos_permissoes')}
            className={`w-full flex items-center space-x-3 p-3 sm:py-2.5 sm:px-3.5 rounded-xl border text-left transition-all duration-150 cursor-pointer group ${
              activeTab === 'cargos_permissoes'
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-md ring-2 ring-indigo-400/70 font-black'
                : 'bg-indigo-50 dark:bg-stone-800/90 text-slate-800 dark:text-stone-200 border-indigo-200/90 dark:border-stone-700 hover:bg-indigo-100/90 hover:border-indigo-300'
            }`}
          >
            <div className={`p-2 rounded-lg shrink-0 transition ${
              activeTab === 'cargos_permissoes'
                ? 'bg-white/20 text-white'
                : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800'
            }`}>
              <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className={`text-xs sm:text-sm font-extrabold truncate ${
                activeTab === 'cargos_permissoes' ? 'text-white' : 'text-slate-900 dark:text-white'
              }`}>
                Cargos, Setores & Permissões
              </div>
              <div className={`text-[11px] truncate ${
                activeTab === 'cargos_permissoes' ? 'text-indigo-100' : 'text-slate-600 dark:text-stone-400'
              }`}>
                Acessos & Funções Offline
              </div>
            </div>
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
