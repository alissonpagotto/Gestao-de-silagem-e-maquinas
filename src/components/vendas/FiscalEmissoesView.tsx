import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, 
  Truck, 
  FileSpreadsheet, 
  Wrench, 
  Package, 
  Plus 
} from 'lucide-react';
import { CompanyProfile } from '../../types';
import { FiscalDocumentTypeView, FiscalDocumentCategory } from '../nfe/FiscalDocumentTypeView';
import { MdfeView, getStoredMdfe } from '../nfe/MdfeView';

export type FiscalEmissaoSubTab = 'nfe' | 'cte' | 'nfe_c' | 'nfse' | 'mdfe';

interface FiscalEmissoesViewProps {
  companyProfile?: CompanyProfile | null;
}

export const FiscalEmissoesView: React.FC<FiscalEmissoesViewProps> = ({
  companyProfile = null,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<FiscalEmissaoSubTab>('nfe');
  const [openModalTrigger, setOpenModalTrigger] = useState<number>(0);

  // Contadores dinâmicos dos registros fiscais emitidos
  const [nfeDocsCount, setNfeDocsCount] = useState<number>(0);
  const [cteDocsCount, setCteDocsCount] = useState<number>(0);
  const [nfecDocsCount, setNfecDocsCount] = useState<number>(0);
  const [nfseDocsCount, setNfseDocsCount] = useState<number>(0);
  const [mdfeCount, setMdfeCount] = useState<number>(0);

  const refreshCounts = useCallback(() => {
    try {
      const rn = localStorage.getItem('agrocontrol_notas_nfe');
      setNfeDocsCount(rn ? JSON.parse(rn).length : 0);

      const rc = localStorage.getItem('agrocontrol_notas_cte');
      setCteDocsCount(rc ? JSON.parse(rc).length : 0);

      const rnc = localStorage.getItem('agrocontrol_notas_nfec');
      setNfecDocsCount(rnc ? JSON.parse(rnc).length : 0);

      const rns = localStorage.getItem('agrocontrol_notas_nfse');
      setNfseDocsCount(rns ? JSON.parse(rns).length : 0);

      setMdfeCount(getStoredMdfe().length);
    } catch {
      // Ignorar possíveis erros de parse temporário
    }
  }, []);

  useEffect(() => {
    refreshCounts();
    const handleStorageChange = () => refreshCounts();
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [refreshCounts]);

  const handleEmitirNotaFiscal = () => {
    setOpenModalTrigger((prev) => prev + 1);
  };

  return (
    <div 
      id="fiscal-emissoes-view-root" 
      className="w-full space-y-2.5 bg-[#edf4ff] dark:bg-stone-900 rounded-lg"
    >
      {/* BARRA SUPERIOR: SUB-ABAS HORIZONTAIS DE SAÍDA + BOTÃO PRIMÁRIO "+ EMITIR NOTA FISCAL" */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-300 dark:border-stone-800">
        {/* SUB-ABAS HORIZONTAIS DE EMISSÃO FISCAL */}
        <div 
          className="flex flex-wrap items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5"
          role="tablist"
          aria-label="Sub-abas de Emissão Fiscal"
        >
          {/* 1. NF-E (MERCADORIAS) */}
          <button
            type="button"
            id="subtab-fiscal-nfe"
            role="tab"
            aria-selected={activeSubTab === 'nfe'}
            onClick={() => setActiveSubTab('nfe')}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold tracking-wide uppercase rounded-md border transition cursor-pointer select-none whitespace-nowrap ${
              activeSubTab === 'nfe'
                ? 'bg-emerald-100/90 text-emerald-900 border-emerald-500/80 shadow-xs'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 dark:bg-stone-850 dark:hover:bg-stone-800 dark:text-stone-300 dark:border-stone-700'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>NF-E (MERCADORIAS)</span>
            <span className="ml-0.5 px-1 py-0.2 rounded bg-emerald-200/60 dark:bg-emerald-900/40 text-[9px] font-black">
              ({nfeDocsCount})
            </span>
          </button>

          {/* 2. CT-E (FRETE / TRANSPORTE) */}
          <button
            type="button"
            id="subtab-fiscal-cte"
            role="tab"
            aria-selected={activeSubTab === 'cte'}
            onClick={() => setActiveSubTab('cte')}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold tracking-wide uppercase rounded-md border transition cursor-pointer select-none whitespace-nowrap ${
              activeSubTab === 'cte'
                ? 'bg-emerald-100/90 text-emerald-900 border-emerald-500/80 shadow-xs'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 dark:bg-stone-850 dark:hover:bg-stone-800 dark:text-stone-300 dark:border-stone-700'
            }`}
          >
            <Truck className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            <span>CT-E (FRETE / TRANSPORTE)</span>
            <span className="ml-0.5 px-1 py-0.2 rounded bg-sky-200/60 dark:bg-sky-900/40 text-[9px] font-black">
              ({cteDocsCount})
            </span>
          </button>

          {/* 3. NFC-E (CONSUMIDOR FINAL) */}
          <button
            type="button"
            id="subtab-fiscal-nfec"
            role="tab"
            aria-selected={activeSubTab === 'nfe_c'}
            onClick={() => setActiveSubTab('nfe_c')}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold tracking-wide uppercase rounded-md border transition cursor-pointer select-none whitespace-nowrap ${
              activeSubTab === 'nfe_c'
                ? 'bg-emerald-100/90 text-emerald-900 border-emerald-500/80 shadow-xs'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 dark:bg-stone-850 dark:hover:bg-stone-800 dark:text-stone-300 dark:border-stone-700'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>NFC-E (CONSUMIDOR FINAL)</span>
            <span className="ml-0.5 px-1 py-0.2 rounded bg-amber-200/60 dark:bg-amber-900/40 text-[9px] font-black">
              ({nfecDocsCount})
            </span>
          </button>

          {/* 4. NFS-E (NOTA FISCAL DE SERVIÇO) */}
          <button
            type="button"
            id="subtab-fiscal-nfse"
            role="tab"
            aria-selected={activeSubTab === 'nfse'}
            onClick={() => setActiveSubTab('nfse')}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold tracking-wide uppercase rounded-md border transition cursor-pointer select-none whitespace-nowrap ${
              activeSubTab === 'nfse'
                ? 'bg-emerald-100/90 text-emerald-900 border-emerald-500/80 shadow-xs'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 dark:bg-stone-850 dark:hover:bg-stone-800 dark:text-stone-300 dark:border-stone-700'
            }`}
          >
            <Wrench className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>NFS-E (NOTA FISCAL DE SERVIÇO)</span>
            <span className="ml-0.5 px-1 py-0.2 rounded bg-indigo-200/60 dark:bg-indigo-900/40 text-[9px] font-black">
              ({nfseDocsCount})
            </span>
          </button>

          {/* 5. MDF-E (MANIFESTOS) */}
          <button
            type="button"
            id="subtab-fiscal-mdfe"
            role="tab"
            aria-selected={activeSubTab === 'mdfe'}
            onClick={() => setActiveSubTab('mdfe')}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold tracking-wide uppercase rounded-md border transition cursor-pointer select-none whitespace-nowrap ${
              activeSubTab === 'mdfe'
                ? 'bg-emerald-100/90 text-emerald-900 border-emerald-500/80 shadow-xs'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 dark:bg-stone-850 dark:hover:bg-stone-800 dark:text-stone-300 dark:border-stone-700'
            }`}
          >
            <Package className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>MDF-E (MANIFESTOS)</span>
            <span className="ml-0.5 px-1 py-0.2 rounded bg-teal-200/60 dark:bg-teal-900/40 text-[9px] font-black">
              ({mdfeCount})
            </span>
          </button>
        </div>

        {/* BOTÃO PRIMÁRIO PADRONIZADO EM VERDE: + EMITIR NOTA FISCAL */}
        <div className="shrink-0 flex items-center justify-end">
          <button
            type="button"
            id="btn-emitir-nota-fiscal"
            onClick={handleEmitirNotaFiscal}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-[#059669] hover:bg-[#047857] text-white rounded-lg text-xs font-black uppercase tracking-wider shadow-sm transition active:scale-95 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ EMITIR NOTA FISCAL</span>
          </button>
        </div>
      </div>

      {/* RENDERIZAÇÃO DA VISÃO SELECIONADA */}
      <div className="w-full">
        {activeSubTab === 'mdfe' ? (
          <MdfeView
            companyProfile={companyProfile}
            externalOpenModalTrigger={openModalTrigger}
            onRefreshAll={refreshCounts}
          />
        ) : (
          <FiscalDocumentTypeView
            category={activeSubTab as FiscalDocumentCategory}
            companyProfile={companyProfile}
            externalOpenModalTrigger={openModalTrigger}
            onRefreshAll={refreshCounts}
          />
        )}
      </div>
    </div>
  );
};
