import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  FileSpreadsheet, 
  ShieldCheck, 
  Database,
  Lock
} from 'lucide-react';
import { CargosPermissoesTab } from './CargosPermissoesTab';
import { CentrosCustoTab } from './CentrosCustoTab';
import { PlanoContasTab } from './PlanoContasTab';
import { hasCadastrosBaseSubPermission } from '../../lib/cadastrosBaseStorage';

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

  const allowedTabs = useMemo(() => {
    const list: CadastrosSubTab[] = [];
    if (hasCadastrosBaseSubPermission('centros_custo')) list.push('centros_custo');
    if (hasCadastrosBaseSubPermission('plano_contas')) list.push('plano_contas');
    if (hasCadastrosBaseSubPermission('cargos_permissoes')) list.push('cargos_permissoes');
    return list.length > 0 ? list : ['cargos_permissoes' as CadastrosSubTab];
  }, []);

  const [activeTab, setActiveTab] = useState<CadastrosSubTab>(() => {
    const desired = resolveTab(initialSubTab);
    return allowedTabs.includes(desired) ? desired : allowedTabs[0];
  });

  useEffect(() => {
    if (initialSubTab) {
      const desired = resolveTab(initialSubTab);
      if (allowedTabs.includes(desired)) {
        setActiveTab(desired);
      }
    }
  }, [initialSubTab, allowedTabs]);

  useEffect(() => {
    if (allowedTabs.length > 0 && !allowedTabs.includes(activeTab)) {
      setActiveTab(allowedTabs[0]);
    }
  }, [allowedTabs, activeTab]);

  return (
    <div className="space-y-2.5 sm:space-y-3 max-w-7xl mx-auto pb-4">
      {/* Top Banner Slim - Moldura Acetinada 3D */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-slate-300 dark:border-stone-800 shadow-[0_1px_0px_0px_rgba(255,255,255,0.8)] dark:shadow-[0_1px_0px_0px_rgba(255,255,255,0.05)] pb-2">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <Database className="w-3.5 h-3.5 stroke-[2.2]" />
          </div>
          <div className="flex items-center space-x-2">
            <h1 className="text-base sm:text-lg font-black tracking-tight text-zinc-900 dark:text-white">
              Cadastros Base
            </h1>
            <span className="text-[9px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/80 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-700/50">
              ESTRUTURAÇÃO & GOVERNANÇA
            </span>
          </div>
        </div>
      </header>

      {/* 3 Abas Horizontais com Moldura Acetinada 3D */}
      <nav 
        aria-label="Abas de Cadastros Base"
        className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 p-1.5 bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 dark:from-stone-900 dark:via-stone-850 dark:to-stone-900 rounded-xl border border-slate-400 dark:border-stone-700 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9),inset_-1px_-1px_0px_rgba(0,0,0,0.15)] dark:shadow-[inset_1px_1px_0px_rgba(255,255,255,0.08),inset_-1px_-1px_0px_rgba(0,0,0,0.3)]"
      >
        {/* Card 1: Centros de Custo */}
        {hasCadastrosBaseSubPermission('centros_custo') ? (
          <button
            type="button"
            id="tab-card-centros-custo"
            onClick={() => setActiveTab('centros_custo')}
            className={`w-full flex items-center justify-center sm:justify-start space-x-2 py-1.5 px-3 rounded-lg text-left transition-all duration-150 cursor-pointer ${
              activeTab === 'centros_custo'
                ? 'bg-white text-zinc-900 dark:bg-stone-800 dark:text-white shadow-xs border border-zinc-400 dark:border-stone-600 font-bold'
                : 'text-zinc-700 dark:text-stone-400 hover:text-zinc-900 dark:hover:text-stone-200 hover:bg-zinc-300/60 dark:hover:bg-stone-800/60 font-semibold'
            }`}
          >
            <Building2 className={`w-4 h-4 shrink-0 ${activeTab === 'centros_custo' ? 'text-zinc-900 dark:text-white' : 'text-blue-600 dark:text-blue-400'}`} />
            <span className="text-xs sm:text-sm truncate">
              Centros de Custo
            </span>
          </button>
        ) : (
          <div className="w-full flex items-center justify-center sm:justify-start space-x-2 py-1.5 px-3 rounded-lg border text-left bg-zinc-300/40 border-zinc-400 text-zinc-400 opacity-60 select-none">
            <Lock className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-xs sm:text-sm font-semibold truncate">Centros de Custo (Bloqueado)</span>
          </div>
        )}

        {/* Card 2: Plano de Contas & Formas */}
        {hasCadastrosBaseSubPermission('plano_contas') ? (
          <button
            type="button"
            id="tab-card-plano-contas"
            onClick={() => setActiveTab('plano_contas')}
            className={`w-full flex items-center justify-center sm:justify-start space-x-2 py-1.5 px-3 rounded-lg text-left transition-all duration-150 cursor-pointer ${
              activeTab === 'plano_contas'
                ? 'bg-white text-zinc-900 dark:bg-stone-800 dark:text-white shadow-xs border border-zinc-400 dark:border-stone-600 font-bold'
                : 'text-zinc-700 dark:text-stone-400 hover:text-zinc-900 dark:hover:text-stone-200 hover:bg-zinc-300/60 dark:hover:bg-stone-800/60 font-semibold'
            }`}
          >
            <FileSpreadsheet className={`w-4 h-4 shrink-0 ${activeTab === 'plano_contas' ? 'text-zinc-900 dark:text-white' : 'text-amber-600 dark:text-amber-400'}`} />
            <span className="text-xs sm:text-sm truncate">
              Plano de Contas & Formas
            </span>
          </button>
        ) : (
          <div className="w-full flex items-center justify-center sm:justify-start space-x-2 py-1.5 px-3 rounded-lg border text-left bg-zinc-300/40 border-zinc-400 text-zinc-400 opacity-60 select-none">
            <Lock className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-xs sm:text-sm font-semibold truncate">Plano de Contas (Bloqueado)</span>
          </div>
        )}

        {/* Card 3: Cargos, Setores & Permissões */}
        {hasCadastrosBaseSubPermission('cargos_permissoes') ? (
          <button
            type="button"
            id="tab-card-cargos-permissoes"
            onClick={() => setActiveTab('cargos_permissoes')}
            className={`w-full flex items-center justify-center sm:justify-start space-x-2 py-1.5 px-3 rounded-lg text-left transition-all duration-150 cursor-pointer ${
              activeTab === 'cargos_permissoes'
                ? 'bg-white text-zinc-900 dark:bg-stone-800 dark:text-white shadow-xs border border-zinc-400 dark:border-stone-600 font-bold'
                : 'text-zinc-700 dark:text-stone-400 hover:text-zinc-900 dark:hover:text-stone-200 hover:bg-zinc-300/60 dark:hover:bg-stone-800/60 font-semibold'
            }`}
          >
            <ShieldCheck className={`w-4 h-4 shrink-0 ${activeTab === 'cargos_permissoes' ? 'text-zinc-900 dark:text-white' : 'text-indigo-600 dark:text-indigo-400'}`} />
            <span className="text-xs sm:text-sm truncate">
              Cargos, Setores & Permissões
            </span>
          </button>
        ) : (
          <div className="w-full flex items-center justify-center sm:justify-start space-x-2 py-1.5 px-3 rounded-lg border text-left bg-zinc-300/40 border-zinc-400 text-zinc-400 opacity-60 select-none">
            <Lock className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-xs sm:text-sm font-semibold truncate">Cargos & Permissões (Bloqueado)</span>
          </div>
        )}
      </nav>

      {/* Renderização do Sub-menu ativo */}
      {activeTab === 'centros_custo' && <CentrosCustoTab />}
      {activeTab === 'plano_contas' && <PlanoContasTab />}
      {activeTab === 'cargos_permissoes' && <CargosPermissoesTab />}
    </div>
  );
};
