import React, { useState, useEffect } from 'react';
import { 
  FolderKanban, 
  Building2, 
  FileSpreadsheet, 
  ShieldCheck, 
  Database,
  ArrowRight
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
    return 'cargos_permissoes';
  };

  const [activeTab, setActiveTab] = useState<CadastrosSubTab>(() => resolveTab(initialSubTab));

  useEffect(() => {
    if (initialSubTab) {
      setActiveTab(resolveTab(initialSubTab));
    }
  }, [initialSubTab]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner do Módulo Cadastros Base */}
      <div className="bg-gradient-to-r from-zinc-900 via-stone-900 to-zinc-900 text-white rounded-3xl p-6 sm:p-7 shadow-lg border border-zinc-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0 shadow-inner">
              <Database className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-800">
                  ESTRUTURAÇÃO & GOVERNANÇA
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-1">
                Cadastros Base
              </h1>
              <p className="text-xs sm:text-sm text-stone-300 max-w-xl">
                Parametrização corporativa resiliente em modo offline com controle de acessos por cargo, plano de contas e centros de custos.
              </p>
            </div>
          </div>
        </div>

        {/* Navegação entre os 3 sub-menus */}
        <div className="mt-6 pt-4 border-t border-zinc-800 flex flex-wrap items-center gap-2">
          {/* Sub-menu 1: Centros de Custo */}
          <button
            type="button"
            onClick={() => setActiveTab('centros_custo')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
              activeTab === 'centros_custo'
                ? 'bg-amber-500 text-zinc-950 shadow-md font-extrabold'
                : 'bg-zinc-800/80 hover:bg-zinc-800 text-stone-300 hover:text-white border border-zinc-700/60'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Centros de Custo</span>
          </button>

          {/* Sub-menu 2: Plano de Contas & Formas */}
          <button
            type="button"
            onClick={() => setActiveTab('plano_contas')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
              activeTab === 'plano_contas'
                ? 'bg-teal-500 text-zinc-950 shadow-md font-extrabold'
                : 'bg-zinc-800/80 hover:bg-zinc-800 text-stone-300 hover:text-white border border-zinc-700/60'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Plano de Contas & Formas</span>
          </button>

          {/* Sub-menu 3: Cargos, Setores & Permissões */}
          <button
            type="button"
            onClick={() => setActiveTab('cargos_permissoes')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
              activeTab === 'cargos_permissoes'
                ? 'bg-indigo-600 text-white shadow-md font-extrabold'
                : 'bg-zinc-800/80 hover:bg-zinc-800 text-stone-300 hover:text-white border border-zinc-700/60'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Cargos, Setores & Permissões</span>
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
