import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  FileSpreadsheet, 
  ShieldCheck, 
  ClipboardList,
  Lock,
  CreditCard,
  Database
} from 'lucide-react';
import { CargosPermissoesTab } from './CargosPermissoesTab';
import { CentrosCustoTab } from './CentrosCustoTab';
import { PlanoContasTab } from './PlanoContasTab';
import { CadastrosAuxiliaresTab } from './CadastrosAuxiliaresTab';
import { PaymentMethodsManagerPanel } from '../common/PaymentMethodsManager';
import { hasCadastrosBaseSubPermission } from '../../lib/cadastrosBaseStorage';

export type CadastrosSubTab = 'centros_custo' | 'plano_contas' | 'cargos_permissoes' | 'formas_pagamento' | 'cadastros_auxiliares';

interface CadastrosBaseModuleProps {
  initialSubTab?: CadastrosSubTab | string;
}

export const CadastrosBaseModule: React.FC<CadastrosBaseModuleProps> = ({
  initialSubTab = 'cargos_permissoes',
}) => {
  const resolveTab = (tabStr?: string): CadastrosSubTab => {
    if (tabStr === 'centros_custo' || tabStr === 'cadastros_base_centros_custo') return 'centros_custo';
    if (tabStr === 'plano_contas' || tabStr === 'cadastros_base_plano_contas') return 'plano_contas';
    if (tabStr === 'formas_pagamento' || tabStr === 'cadastros_base_formas_pagamento') return 'formas_pagamento';
    if (tabStr === 'cadastros_auxiliares' || tabStr === 'cadastros_base_cadastros_auxiliares') return 'cadastros_auxiliares';
    if (tabStr === 'cargos_permissoes' || tabStr === 'cadastros_base_cargos_permissoes') return 'cargos_permissoes';
    return 'cargos_permissoes';
  };

  const allowedTabs = useMemo(() => {
    const list: CadastrosSubTab[] = [];
    if (hasCadastrosBaseSubPermission('cargos_permissoes')) list.push('cargos_permissoes');
    if (hasCadastrosBaseSubPermission('plano_contas')) {
      list.push('plano_contas');
      list.push('formas_pagamento');
    }
    if (hasCadastrosBaseSubPermission('centros_custo')) list.push('centros_custo');
    if (hasCadastrosBaseSubPermission('cadastros_auxiliares')) list.push('cadastros_auxiliares');
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
    <div className="space-y-2.5 sm:space-y-3 w-full mx-auto pb-4">
      {/* Top Banner Slim - Moldura Acetinada 3D */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-slate-300 dark:border-stone-800 shadow-[0_1px_0px_0px_rgba(255,255,255,0.8)] dark:shadow-[0_1px_0px_0px_rgba(255,255,255,0.05)] pb-2">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <ClipboardList className="w-3.5 h-3.5 stroke-[2.2]" />
          </div>
          <div className="flex items-center space-x-2">
            <h1 className="text-base sm:text-lg font-black tracking-tight text-zinc-900 dark:text-white uppercase">
              CADASTROS & CONFIGURAÇÕES — ESTRUTURAÇÃO & TABELAS AUXILIARES
            </h1>
          </div>
        </div>
      </header>

      {/* 2. ESTRUTURA INTEGRADA DE ABAS SUPERIORES E MOLDURA GERAL (PADRÃO OURO) */}
      <div className="w-full flex flex-col">
        {/* BASE DE FUNDO DAS ABAS: MOLDURA MDI TRIDIMENSIONAL ACETINADA */}
        <div className="w-full bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 border-b border-slate-400 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9),inset_-1px_-1px_0px_rgba(0,0,0,0.15)] rounded-t-lg border border-b-0 border-slate-300 dark:border-stone-700 overflow-x-auto scrollbar-none">
          <nav 
            aria-label="Abas de Cadastros & Configurações"
            className="w-full flex items-center overflow-x-auto whitespace-nowrap scrollbar-none"
          >
            {/* Card 1: Cargos, Setores & Permissões */}
            {hasCadastrosBaseSubPermission('cargos_permissoes') ? (
              <button
                type="button"
                id="tab-card-cargos-permissoes"
                onClick={() => setActiveTab('cargos_permissoes')}
                style={activeTab === 'cargos_permissoes' ? { backgroundColor: 'rgba(251, 146, 60, 0.40)' } : undefined}
                className={`flex-1 min-w-max flex items-center justify-center gap-1.5 px-3 py-1 text-[10px] tracking-wide uppercase transition cursor-pointer select-none whitespace-nowrap border-r border-slate-300/80 dark:border-stone-700/80 ${
                  activeTab === 'cargos_permissoes'
                    ? 'bg-orange-400/40 text-black font-semibold shadow-xs border-t-2 border-t-emerald-600 -mb-px z-10'
                    : 'bg-slate-200/50 hover:bg-slate-200 dark:bg-stone-850 dark:hover:bg-stone-800 text-slate-700 font-bold dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-200'
                }`}
              >
                <ShieldCheck className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'cargos_permissoes' ? 'text-black' : 'text-indigo-600 dark:text-indigo-400'}`} />
                <span>Cargos, Setores & Permissões</span>
              </button>
            ) : (
              <div className="flex-1 min-w-max flex items-center justify-center gap-1.5 px-3 py-1 text-[10px] font-bold tracking-wide uppercase whitespace-nowrap bg-zinc-300/40 text-zinc-400 opacity-60 select-none border-r border-slate-300/80">
                <Lock className="w-3.5 h-3.5 text-zinc-400" />
                <span>Cargos & Permissões (Bloqueado)</span>
              </div>
            )}

            {/* Card 2: Plano de Contas & Formas */}
            {hasCadastrosBaseSubPermission('plano_contas') ? (
              <button
                type="button"
                id="tab-card-plano-contas"
                onClick={() => setActiveTab('plano_contas')}
                style={activeTab === 'plano_contas' ? { backgroundColor: 'rgba(251, 146, 60, 0.40)' } : undefined}
                className={`flex-1 min-w-max flex items-center justify-center gap-1.5 px-3 py-1 text-[10px] tracking-wide uppercase transition cursor-pointer select-none whitespace-nowrap border-r border-slate-300/80 dark:border-stone-700/80 ${
                  activeTab === 'plano_contas'
                    ? 'bg-orange-400/40 text-black font-semibold shadow-xs border-t-2 border-t-emerald-600 -mb-px z-10'
                    : 'bg-slate-200/50 hover:bg-slate-200 dark:bg-stone-850 dark:hover:bg-stone-800 text-slate-700 font-bold dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-200'
                }`}
              >
                <FileSpreadsheet className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'plano_contas' ? 'text-black' : 'text-amber-600 dark:text-amber-400'}`} />
                <span>Plano de Contas & Formas</span>
              </button>
            ) : (
              <div className="flex-1 min-w-max flex items-center justify-center gap-1.5 px-3 py-1 text-[10px] font-bold tracking-wide uppercase whitespace-nowrap bg-zinc-300/40 text-zinc-400 opacity-60 select-none border-r border-slate-300/80">
                <Lock className="w-3.5 h-3.5 text-zinc-400" />
                <span>Plano de Contas (Bloqueado)</span>
              </div>
            )}

            {/* Card 3: Formas de Pagamento & Recebimento */}
            {hasCadastrosBaseSubPermission('plano_contas') && (
              <button
                type="button"
                id="tab-card-formas-pagamento"
                onClick={() => setActiveTab('formas_pagamento')}
                style={activeTab === 'formas_pagamento' ? { backgroundColor: 'rgba(251, 146, 60, 0.40)' } : undefined}
                className={`flex-1 min-w-max flex items-center justify-center gap-1.5 px-3 py-1 text-[10px] tracking-wide uppercase transition cursor-pointer select-none whitespace-nowrap border-r border-slate-300/80 dark:border-stone-700/80 ${
                  activeTab === 'formas_pagamento'
                    ? 'bg-orange-400/40 text-black font-semibold shadow-xs border-t-2 border-t-emerald-600 -mb-px z-10'
                    : 'bg-slate-200/50 hover:bg-slate-200 dark:bg-stone-850 dark:hover:bg-stone-800 text-slate-700 font-bold dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-200'
                }`}
              >
                <CreditCard className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'formas_pagamento' ? 'text-black' : 'text-emerald-600 dark:text-emerald-400'}`} />
                <span>💳 Formas de Pagamento & Recebimento</span>
              </button>
            )}

            {/* Card 4: Centros de Custo */}
            {hasCadastrosBaseSubPermission('centros_custo') ? (
              <button
                type="button"
                id="tab-card-centros-custo"
                onClick={() => setActiveTab('centros_custo')}
                style={activeTab === 'centros_custo' ? { backgroundColor: 'rgba(251, 146, 60, 0.40)' } : undefined}
                className={`flex-1 min-w-max flex items-center justify-center gap-1.5 px-3 py-1 text-[10px] tracking-wide uppercase transition cursor-pointer select-none whitespace-nowrap border-r border-slate-300/80 dark:border-stone-700/80 ${
                  activeTab === 'centros_custo'
                    ? 'bg-orange-400/40 text-black font-semibold shadow-xs border-t-2 border-t-emerald-600 -mb-px z-10'
                    : 'bg-slate-200/50 hover:bg-slate-200 dark:bg-stone-850 dark:hover:bg-stone-800 text-slate-700 font-bold dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-200'
                }`}
              >
                <Building2 className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'centros_custo' ? 'text-black' : 'text-blue-600 dark:text-blue-400'}`} />
                <span>Centros de Custo</span>
              </button>
            ) : (
              <div className="flex-1 min-w-max flex items-center justify-center gap-1.5 px-3 py-1 text-[10px] font-bold tracking-wide uppercase whitespace-nowrap bg-zinc-300/40 text-zinc-400 opacity-60 select-none border-r border-slate-300/80">
                <Lock className="w-3.5 h-3.5 text-zinc-400" />
                <span>Centros de Custo (Bloqueado)</span>
              </div>
            )}

            {/* Card 5: Cadastros Auxiliares */}
            {hasCadastrosBaseSubPermission('cadastros_auxiliares') ? (
              <button
                type="button"
                id="tab-card-cadastros-auxiliares"
                onClick={() => setActiveTab('cadastros_auxiliares')}
                style={activeTab === 'cadastros_auxiliares' ? { backgroundColor: 'rgba(251, 146, 60, 0.40)' } : undefined}
                className={`flex-1 min-w-max flex items-center justify-center gap-1.5 px-3 py-1 text-[10px] tracking-wide uppercase transition cursor-pointer select-none whitespace-nowrap ${
                  activeTab === 'cadastros_auxiliares'
                    ? 'bg-orange-400/40 text-black font-semibold shadow-xs border-t-2 border-t-emerald-600 -mb-px z-10'
                    : 'bg-slate-200/50 hover:bg-slate-200 dark:bg-stone-850 dark:hover:bg-stone-800 text-slate-700 font-bold dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-200'
                }`}
              >
                <Database className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'cadastros_auxiliares' ? 'text-black' : 'text-teal-600 dark:text-teal-400'}`} />
                <span>📋 Cadastros Auxiliares</span>
              </button>
            ) : (
              <div className="flex-1 min-w-max flex items-center justify-center gap-1.5 px-3 py-1 text-[10px] font-bold tracking-wide uppercase whitespace-nowrap bg-zinc-300/40 text-zinc-400 opacity-60 select-none">
                <Lock className="w-3.5 h-3.5 text-zinc-400" />
                <span>Cadastros Auxiliares (Bloqueado)</span>
              </div>
            )}
          </nav>
        </div>

        {/* MOLDURA GERAL INTEGRADA DE PONTA A PONTA (SEM VÃO LIVRE) */}
        <div className="w-full border border-slate-300 dark:border-stone-700 rounded-b-lg bg-[#edf4ff] dark:bg-stone-900 shadow-sm overflow-y-auto overflow-x-hidden global p-3 space-y-3">
          {/* Renderização do Sub-menu ativo */}
          {activeTab === 'cargos_permissoes' && <CargosPermissoesTab />}
          {activeTab === 'plano_contas' && <PlanoContasTab />}
          {activeTab === 'formas_pagamento' && <PaymentMethodsManagerPanel />}
          {activeTab === 'centros_custo' && <CentrosCustoTab />}
          {activeTab === 'cadastros_auxiliares' && (
            <CadastrosAuxiliaresTab onNavigateTab={(tab) => setActiveTab(tab)} />
          )}
        </div>
      </div>
    </div>
  );
};
