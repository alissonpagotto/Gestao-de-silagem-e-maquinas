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

      {/* 2. ESTRUTURA INTEGRADA DE ABAS SUPERIORES E MOLDURA GERAL (PADRÃO OURO) */}
      <div className="w-full flex flex-col">
        {/* BASE DE FUNDO DAS ABAS: MOLDURA MDI TRIDIMENSIONAL ACETINADA */}
        <div className="w-full bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 border-b border-slate-400 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9),inset_-1px_-1px_0px_rgba(0,0,0,0.15)] rounded-t-lg border border-b-0 border-slate-300 dark:border-stone-700 overflow-x-auto scrollbar-none">
          <nav 
            aria-label="Abas de Cadastros Base"
            className="w-full flex items-center overflow-x-auto whitespace-nowrap scrollbar-none"
          >
            {/* Card 1: Centros de Custo */}
            {hasCadastrosBaseSubPermission('centros_custo') ? (
              <button
                type="button"
                id="tab-card-centros-custo"
                onClick={() => setActiveTab('centros_custo')}
                className={`flex-1 min-w-max flex items-center justify-center gap-1.5 px-3 py-1 text-[10px] font-bold tracking-wide uppercase transition cursor-pointer select-none whitespace-nowrap border-r border-slate-300/80 dark:border-stone-700/80 ${
                  activeTab === 'centros_custo'
                    ? 'bg-white text-zinc-900 dark:bg-stone-900 dark:text-white shadow-xs border-t-2 border-t-emerald-600 -mb-px z-10'
                    : 'bg-slate-200/50 hover:bg-slate-200 dark:bg-stone-850 dark:hover:bg-stone-800 text-slate-700 dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-200'
                }`}
              >
                <Building2 className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'centros_custo' ? 'text-zinc-900 dark:text-white' : 'text-blue-600 dark:text-blue-400'}`} />
                <span>Centros de Custo</span>
              </button>
            ) : (
              <div className="flex-1 min-w-max flex items-center justify-center gap-1.5 px-3 py-1 text-[10px] font-bold tracking-wide uppercase whitespace-nowrap bg-zinc-300/40 text-zinc-400 opacity-60 select-none border-r border-slate-300/80">
                <Lock className="w-3.5 h-3.5 text-zinc-400" />
                <span>Centros de Custo (Bloqueado)</span>
              </div>
            )}

            {/* Card 2: Plano de Contas & Formas */}
            {hasCadastrosBaseSubPermission('plano_contas') ? (
              <button
                type="button"
                id="tab-card-plano-contas"
                onClick={() => setActiveTab('plano_contas')}
                className={`flex-1 min-w-max flex items-center justify-center gap-1.5 px-3 py-1 text-[10px] font-bold tracking-wide uppercase transition cursor-pointer select-none whitespace-nowrap border-r border-slate-300/80 dark:border-stone-700/80 ${
                  activeTab === 'plano_contas'
                    ? 'bg-white text-zinc-900 dark:bg-stone-900 dark:text-white shadow-xs border-t-2 border-t-emerald-600 -mb-px z-10'
                    : 'bg-slate-200/50 hover:bg-slate-200 dark:bg-stone-850 dark:hover:bg-stone-800 text-slate-700 dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-200'
                }`}
              >
                <FileSpreadsheet className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'plano_contas' ? 'text-zinc-900 dark:text-white' : 'text-amber-600 dark:text-amber-400'}`} />
                <span>Plano de Contas & Formas</span>
              </button>
            ) : (
              <div className="flex-1 min-w-max flex items-center justify-center gap-1.5 px-3 py-1 text-[10px] font-bold tracking-wide uppercase whitespace-nowrap bg-zinc-300/40 text-zinc-400 opacity-60 select-none border-r border-slate-300/80">
                <Lock className="w-3.5 h-3.5 text-zinc-400" />
                <span>Plano de Contas (Bloqueado)</span>
              </div>
            )}

            {/* Card 3: Cargos, Setores & Permissões */}
            {hasCadastrosBaseSubPermission('cargos_permissoes') ? (
              <button
                type="button"
                id="tab-card-cargos-permissoes"
                onClick={() => setActiveTab('cargos_permissoes')}
                className={`flex-1 min-w-max flex items-center justify-center gap-1.5 px-3 py-1 text-[10px] font-bold tracking-wide uppercase transition cursor-pointer select-none whitespace-nowrap ${
                  activeTab === 'cargos_permissoes'
                    ? 'bg-white text-zinc-900 dark:bg-stone-900 dark:text-white shadow-xs border-t-2 border-t-emerald-600 -mb-px z-10'
                    : 'bg-slate-200/50 hover:bg-slate-200 dark:bg-stone-850 dark:hover:bg-stone-800 text-slate-700 dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-200'
                }`}
              >
                <ShieldCheck className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'cargos_permissoes' ? 'text-zinc-900 dark:text-white' : 'text-indigo-600 dark:text-indigo-400'}`} />
                <span>Cargos, Setores & Permissões</span>
              </button>
            ) : (
              <div className="flex-1 min-w-max flex items-center justify-center gap-1.5 px-3 py-1 text-[10px] font-bold tracking-wide uppercase whitespace-nowrap bg-zinc-300/40 text-zinc-400 opacity-60 select-none">
                <Lock className="w-3.5 h-3.5 text-zinc-400" />
                <span>Cargos & Permissões (Bloqueado)</span>
              </div>
            )}
          </nav>
        </div>

        {/* MOLDURA GERAL INTEGRADA DE PONTA A PONTA (SEM VÃO LIVRE) */}
        <div className="w-full border border-slate-300 dark:border-stone-700 rounded-b-lg bg-slate-50 dark:bg-stone-900 shadow-sm overflow-hidden global p-3 space-y-3">
          {/* Renderização do Sub-menu ativo */}
          {activeTab === 'centros_custo' && <CentrosCustoTab />}
          {activeTab === 'plano_contas' && <PlanoContasTab />}
          {activeTab === 'cargos_permissoes' && <CargosPermissoesTab />}
        </div>
      </div>
    </div>
  );
};
