import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, 
  Wrench, 
  Truck, 
  ShoppingCart, 
  Package, 
  Receipt,
  RotateCcw,
  ShieldCheck,
  Building2,
  FileCheck2,
  TrendingUp
} from 'lucide-react';
import { CompanyProfile } from '../../types';
import { FiscalDocumentTypeView } from '../nfe/FiscalDocumentTypeView';
import { MdfeView, getStoredMdfe } from '../nfe/MdfeView';

export type FaturamentoSubTab = 'nfe' | 'nfse' | 'cte' | 'nfe_c' | 'mdfe';

interface FaturamentoFiscalModuleProps {
  companyProfile?: CompanyProfile;
  onNavigate?: (tab: string) => void;
  initialSubTab?: FaturamentoSubTab;
}

export const FaturamentoFiscalModule: React.FC<FaturamentoFiscalModuleProps> = ({
  companyProfile,
  onNavigate,
  initialSubTab = 'nfe',
}) => {
  const [activeSubTab, setActiveSubTab] = useState<FaturamentoSubTab>(initialSubTab);

  // Contadores de Documentos emitidos / lançados
  const [nfeDocsCount, setNfeDocsCount] = useState<number>(0);
  const [nfseDocsCount, setNfseDocsCount] = useState<number>(0);
  const [cteDocsCount, setCteDocsCount] = useState<number>(0);
  const [nfecDocsCount, setNfecDocsCount] = useState<number>(0);
  const [mdfeCount, setMdfeCount] = useState<number>(0);

  const refreshCounts = () => {
    try {
      const rn = localStorage.getItem('agrocontrol_notas_nfe');
      setNfeDocsCount(rn ? JSON.parse(rn).length : 0);
    } catch { setNfeDocsCount(0); }

    try {
      const rns = localStorage.getItem('agrocontrol_notas_nfse');
      setNfseDocsCount(rns ? JSON.parse(rns).length : 0);
    } catch { setNfseDocsCount(0); }

    try {
      const rc = localStorage.getItem('agrocontrol_notas_cte');
      setCteDocsCount(rc ? JSON.parse(rc).length : 0);
    } catch { setCteDocsCount(0); }

    try {
      const rnc = localStorage.getItem('agrocontrol_notas_nfec');
      setNfecDocsCount(rnc ? JSON.parse(rnc).length : 0);
    } catch { setNfecDocsCount(0); }

    try {
      setMdfeCount(getStoredMdfe().length);
    } catch { setMdfeCount(0); }
  };

  useEffect(() => {
    refreshCounts();
    const handleStorage = () => refreshCounts();
    window.addEventListener('storage', handleStorage);
    window.addEventListener('agrocontrol_fiscal_docs_updated', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('agrocontrol_fiscal_docs_updated', handleStorage);
    };
  }, []);

  const totalGeralDocs = useMemo(() => {
    return nfeDocsCount + nfseDocsCount + cteDocsCount + nfecDocsCount + mdfeCount;
  }, [nfeDocsCount, nfseDocsCount, cteDocsCount, nfecDocsCount, mdfeCount]);

  const SUB_TABS = useMemo(() => [
    {
      id: 'nfe' as const,
      label: 'NF-E (MERCADORIAS)',
      icon: FileText,
      count: nfeDocsCount,
      color: 'text-emerald-700 dark:text-emerald-400',
      activeBorder: 'border-t-emerald-600',
      badgeBg: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200'
    },
    {
      id: 'nfse' as const,
      label: 'NFS-E (SERVIÇOS)',
      icon: Wrench,
      count: nfseDocsCount,
      color: 'text-sky-700 dark:text-sky-400',
      activeBorder: 'border-t-sky-600',
      badgeBg: 'bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950 dark:text-sky-200'
    },
    {
      id: 'cte' as const,
      label: 'CT-E (FRETE / TRANSPORTE)',
      icon: Truck,
      count: cteDocsCount,
      color: 'text-sky-700 dark:text-sky-400',
      activeBorder: 'border-t-sky-600',
      badgeBg: 'bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950 dark:text-sky-200'
    },
    {
      id: 'nfe_c' as const,
      label: 'NFC-E (CONSUMIDOR FINAL)',
      icon: ShoppingCart,
      count: nfecDocsCount,
      color: 'text-amber-700 dark:text-amber-400',
      activeBorder: 'border-t-amber-600',
      badgeBg: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200'
    },
    {
      id: 'mdfe' as const,
      label: 'MDF-E (MANIFESTOS)',
      icon: Package,
      count: mdfeCount,
      color: 'text-indigo-700 dark:text-indigo-400',
      activeBorder: 'border-t-indigo-600',
      badgeBg: 'bg-indigo-100 text-indigo-900 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-200'
    }
  ], [nfeDocsCount, nfseDocsCount, cteDocsCount, nfecDocsCount, mdfeCount]);

  return (
    <div className="w-full h-full flex flex-col bg-[#edf4ff] dark:bg-stone-900 overflow-hidden select-none">
      
      {/* CABEÇALHO DO MÓDULO: FATURAMENTO / FISCAL */}
      <div className="bg-white dark:bg-stone-900 border-b border-slate-300/80 dark:border-stone-800 px-4 py-2.5 shadow-2xs shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-700 text-white shadow-xs">
            <Receipt className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-sm sm:text-base font-black tracking-wide uppercase text-slate-900 dark:text-white">
                FATURAMENTO / FISCAL
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-700">
                MÓDULO OFICIAL
              </span>
            </div>
            <p className="text-[11px] font-bold text-slate-600 dark:text-stone-400 uppercase tracking-tight">
              Emissão, Lançamento e Controle Centralizado de Documentos Fiscais Eletrônicos de Saída
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 self-end sm:self-center">
          <div className="flex items-center space-x-2 px-3 py-1 bg-slate-100 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded-lg text-xs font-black uppercase text-slate-800 dark:text-stone-200">
            <span>TOTAL DE DOCUMENTOS:</span>
            <span className="px-1.5 py-0.2 rounded bg-emerald-600 text-white text-[11px]">
              {totalGeralDocs}
            </span>
          </div>

          <button
            type="button"
            onClick={refreshCounts}
            className="p-1.5 rounded-lg bg-white dark:bg-stone-800 border border-slate-300 dark:border-stone-700 text-slate-600 dark:text-stone-300 hover:text-slate-900 hover:bg-slate-100 transition shadow-2xs cursor-pointer"
            title="Atualizar Contadores e Registros"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. SUB-ABAS HORIZONTAIS DE DOCUMENTOS NO TOPO DA TELA (SLIM PRO, CAIXA ALTA) */}
      <div className="bg-slate-200/90 dark:bg-stone-850 border-b border-slate-300 dark:border-stone-700 px-3 pt-1.5 flex items-center overflow-x-auto whitespace-nowrap scrollbar-none gap-1 shrink-0">
        {SUB_TABS.map((tab) => {
          const isActive = activeSubTab === tab.id;
          const IconComp = tab.icon;

          return (
            <button
              key={tab.id}
              type="button"
              id={`tab-faturamento-${tab.id}`}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] sm:text-xs tracking-wide font-black uppercase transition cursor-pointer select-none whitespace-nowrap rounded-t-lg border-t-2 ${
                isActive
                  ? `bg-white text-slate-900 dark:bg-stone-900 dark:text-white shadow-xs ${tab.activeBorder} border-x border-slate-300/80 dark:border-stone-700 -mb-px z-10`
                  : 'bg-slate-100/70 hover:bg-white/80 dark:bg-stone-800 text-slate-700 dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-200 border-t-transparent border-x border-transparent'
              }`}
            >
              <IconComp className={`w-3.5 h-3.5 shrink-0 ${isActive ? tab.color : 'text-slate-500'}`} />
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-black border ${
                isActive 
                  ? tab.badgeBg 
                  : 'bg-slate-200 text-slate-700 border-slate-300 dark:bg-stone-700 dark:text-stone-300 dark:border-stone-600'
              }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 3. ÁREA DE CONTEÚDO PRINCIPAL (COM ZERO ROLAGEM GLOBAL - SCROLL APENAS NA TABELA) */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 bg-[#edf4ff] dark:bg-stone-900 space-y-3">
        {activeSubTab === 'nfe' && (
          <FiscalDocumentTypeView
            category="nfe"
            companyProfile={companyProfile}
            onRefreshAll={refreshCounts}
          />
        )}

        {activeSubTab === 'nfse' && (
          <FiscalDocumentTypeView
            category="nfse"
            companyProfile={companyProfile}
            onRefreshAll={refreshCounts}
          />
        )}

        {activeSubTab === 'cte' && (
          <FiscalDocumentTypeView
            category="cte"
            companyProfile={companyProfile}
            onRefreshAll={refreshCounts}
          />
        )}

        {activeSubTab === 'nfe_c' && (
          <FiscalDocumentTypeView
            category="nfe_c"
            companyProfile={companyProfile}
            onRefreshAll={refreshCounts}
          />
        )}

        {activeSubTab === 'mdfe' && (
          <MdfeView
            companyProfile={companyProfile}
            onRefreshAll={refreshCounts}
          />
        )}
      </div>

    </div>
  );
};
