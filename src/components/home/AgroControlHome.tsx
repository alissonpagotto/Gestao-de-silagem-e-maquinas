import React, { useState, useEffect, useMemo } from 'react';
import { 
  CreditCard, 
  Wallet, 
  Users, 
  Package, 
  Layers, 
  ShieldCheck, 
  ChevronRight,
  TrendingUp
} from 'lucide-react';
import { CompanyProfile } from '../../types';
import { EnsiladeiraVector } from './EnsiladeiraVector';
import { ColacaSilagemEmblem } from './ColacaSilagemEmblem';

export interface AgroControlHomeProps {
  onNavigate: (tab: string) => void;
  companyProfile?: CompanyProfile;
}

interface IndicatorValues {
  receberVencidos: number;
  receberHoje: number;
  receberCheques: number;
  pagarVencidos: number;
  pagarHoje: number;
  pagarCheques: number;
  clientesAusentes: number;
  clientesBloqueados: number;
  clientesAniversariantes: number;
  produtosEstoqueBaixo: number;
  produtosVencendoHoje: number;
  produtosCicloVida: number;
  outrosEntregas: number;
  outrosSemVendas: number;
  outrosCobrancasPrevistas: number;
  monitorFiscalStatus: string;
}

const DEFAULT_INDICATORS: IndicatorValues = {
  receberVencidos: 26,
  receberHoje: 1,
  receberCheques: 0,
  pagarVencidos: 0,
  pagarHoje: 0,
  pagarCheques: 0,
  clientesAusentes: 0,
  clientesBloqueados: 0,
  clientesAniversariantes: 0,
  produtosEstoqueBaixo: 30,
  produtosVencendoHoje: 0,
  produtosCicloVida: 0,
  outrosEntregas: 0,
  outrosSemVendas: 74,
  outrosCobrancasPrevistas: 20964.31,
  monitorFiscalStatus: 'ATIVO'
};

export const AgroControlHome: React.FC<AgroControlHomeProps> = ({
  onNavigate,
  companyProfile,
}) => {
  const [imgError, setImgError] = useState(false);
  const [clientLogoError, setClientLogoError] = useState(false);

  // Leitura reativa dos indicadores do painel comercial no LocalStorage
  const [indicators, setIndicators] = useState<IndicatorValues>(() => {
    try {
      const stored = localStorage.getItem('agrocontrol_home_indicators');
      if (stored) {
        return { ...DEFAULT_INDICATORS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_INDICATORS;
  });

  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const stored = localStorage.getItem('agrocontrol_home_indicators');
        if (stored) {
          setIndicators({ ...DEFAULT_INDICATORS, ...JSON.parse(stored) });
        }
      } catch (e) {}
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('agrocontrol_indicators_updated', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('agrocontrol_indicators_updated', handleStorageChange);
    };
  }, []);

  // Formatação comercial padrão PT-BR: R$ 20.964,31
  const formattedCobrancasPrevistas = useMemo(() => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(indicators.outrosCobrancasPrevistas);
  }, [indicators.outrosCobrancasPrevistas]);

  return (
    <div 
      id="agrocontrol-home-root"
      className="flex flex-col h-full justify-between p-4 overflow-hidden select-none bg-gradient-to-b from-slate-100 via-slate-50 to-slate-200 dark:from-stone-900 dark:via-stone-900 dark:to-stone-950"
    >
      
      {/* =========================================================================
          FAIXA 1: TOPO NOBRE (OCUPAR 40% DA ALTURA DA PÁGINA)
          Centralização absoluta do escudo/logotipo oficial do assinante (COLAÇA SILAGEM)
          ampliado em escala máxima (w-[580px] max-w-[95vw] h-auto) para preenchimento
          completo dos 40% do topo da tela, sem poluição de textos
         ========================================================================= */}
      <div className="h-[40%] flex items-center justify-center text-center shrink-0 w-full max-w-6xl mx-auto px-4 overflow-hidden">
        {companyProfile?.logoUrl && !clientLogoError ? (
          <div className="w-full h-full flex items-center justify-center py-1 px-2">
            <img 
              src={companyProfile.logoUrl} 
              alt="COLAÇA SILAGEM"
              className="w-[580px] max-w-[95vw] h-auto max-h-[96%] object-contain mb-2 sm:mb-3 mx-auto block drop-shadow-md select-none transition-transform hover:scale-[1.01] duration-150"
              referrerPolicy="no-referrer"
              onError={() => setClientLogoError(true)}
            />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center py-1 px-2">
            <ColacaSilagemEmblem className="w-[580px] max-w-[95vw] h-auto max-h-[96%] mb-2 sm:mb-3 mx-auto block drop-shadow-md transition-transform hover:scale-[1.01] duration-150" />
          </div>
        )}
      </div>

      {/* =========================================================================
          FAIXA 2: MIOLO CENTRAL (GRADE DE CARDS AZUIS SLIM & HARMONIOSA)
          Grade contínua horizontal contendo os 5 blocos de cards azuis de 
          monitoramento comercial ('CONTAS A RECEBER', 'CONTAS A PAGAR', 'CLIENTES', 
          'PRODUTOS', 'OUTROS') em escala slim elegante e compacta
         ========================================================================= */}
      <div className="w-full max-w-7xl mx-auto shrink-0 my-auto py-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3">
          
          {/* SEÇÃO 1: CONTAS A RECEBER */}
          <div className="flex flex-col h-full rounded-md shadow-xs overflow-hidden border border-blue-400/80 dark:border-blue-900 bg-white/95 dark:bg-stone-850/95">
            {/* Cabeçalho da Seção */}
            <div 
              onClick={() => onNavigate('financeiro')}
              className="bg-gradient-to-r from-blue-700 via-blue-600 to-blue-800 hover:from-blue-600 hover:to-blue-700 text-white font-extrabold text-[11px] uppercase tracking-wide py-1.5 px-3 flex items-center justify-between border-b border-blue-900 cursor-pointer transition select-none shadow-2xs shrink-0"
            >
              <div className="flex items-center space-x-1.5 truncate">
                <TrendingUp className="w-3.5 h-3.5 text-blue-200 shrink-0" />
                <span className="truncate">CONTAS A RECEBER</span>
              </div>
              <ChevronRight className="w-3 h-3 text-blue-200 shrink-0" />
            </div>

            {/* Itens Internos com Escala Slim Equilibrada */}
            <div className="flex flex-col justify-between p-2 sm:p-2.5 h-full flex-1 gap-1.5">
              <button
                type="button"
                onClick={() => onNavigate('financeiro')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-50 hover:bg-blue-50 dark:bg-stone-800 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-stone-700 hover:border-blue-300 transition cursor-pointer text-left active:scale-98"
              >
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase truncate">
                  DÉBITOS VENCIDOS
                </span>
                <span className="bg-rose-600 text-white font-black text-[11px] px-2 py-0.5 rounded shadow-2xs min-w-[22px] text-center shrink-0">
                  {indicators.receberVencidos}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('financeiro')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-50 hover:bg-blue-50 dark:bg-stone-800 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-stone-700 hover:border-blue-300 transition cursor-pointer text-left active:scale-98"
              >
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase truncate">
                  DÉB. VENCENDO HOJE
                </span>
                <span className="bg-amber-500 text-white font-black text-[11px] px-2 py-0.5 rounded shadow-2xs min-w-[22px] text-center shrink-0">
                  {indicators.receberHoje}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('financeiro')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-50 hover:bg-blue-50 dark:bg-stone-800 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-stone-700 hover:border-blue-300 transition cursor-pointer text-left active:scale-98"
              >
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase truncate">
                  CHEQUES VENCENDO HOJE
                </span>
                <span className="bg-slate-200 dark:bg-stone-700 text-slate-600 dark:text-stone-300 font-bold text-[11px] px-2 py-0.5 rounded min-w-[22px] text-center shrink-0">
                  {indicators.receberCheques}
                </span>
              </button>
            </div>
          </div>

          {/* SEÇÃO 2: CONTAS A PAGAR */}
          <div className="flex flex-col h-full rounded-md shadow-xs overflow-hidden border border-blue-400/80 dark:border-blue-900 bg-white/95 dark:bg-stone-850/95">
            {/* Cabeçalho da Seção */}
            <div 
              onClick={() => onNavigate('financeiro')}
              className="bg-gradient-to-r from-blue-700 via-blue-600 to-blue-800 hover:from-blue-600 hover:to-blue-700 text-white font-extrabold text-[11px] uppercase tracking-wide py-1.5 px-3 flex items-center justify-between border-b border-blue-900 cursor-pointer transition select-none shadow-2xs shrink-0"
            >
              <div className="flex items-center space-x-1.5 truncate">
                <Wallet className="w-3.5 h-3.5 text-blue-200 shrink-0" />
                <span className="truncate">CONTAS A PAGAR</span>
              </div>
              <ChevronRight className="w-3 h-3 text-blue-200 shrink-0" />
            </div>

            {/* Itens Internos com Escala Slim Equilibrada */}
            <div className="flex flex-col justify-between p-2 sm:p-2.5 h-full flex-1 gap-1.5">
              <button
                type="button"
                onClick={() => onNavigate('financeiro')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-50 hover:bg-blue-50 dark:bg-stone-800 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-stone-700 hover:border-blue-300 transition cursor-pointer text-left active:scale-98"
              >
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase truncate">
                  DÉBITOS VENCIDOS
                </span>
                <span className="bg-slate-200 dark:bg-stone-700 text-slate-600 dark:text-stone-300 font-bold text-[11px] px-2 py-0.5 rounded min-w-[22px] text-center shrink-0">
                  {indicators.pagarVencidos}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('financeiro')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-50 hover:bg-blue-50 dark:bg-stone-800 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-stone-700 hover:border-blue-300 transition cursor-pointer text-left active:scale-98"
              >
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase truncate">
                  DÉB. VENCENDO HOJE
                </span>
                <span className="bg-slate-200 dark:bg-stone-700 text-slate-600 dark:text-stone-300 font-bold text-[11px] px-2 py-0.5 rounded min-w-[22px] text-center shrink-0">
                  {indicators.pagarHoje}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('financeiro')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-50 hover:bg-blue-50 dark:bg-stone-800 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-stone-700 hover:border-blue-300 transition cursor-pointer text-left active:scale-98"
              >
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase truncate">
                  CHEQUES VENCENDO HOJE
                </span>
                <span className="bg-slate-200 dark:bg-stone-700 text-slate-600 dark:text-stone-300 font-bold text-[11px] px-2 py-0.5 rounded min-w-[22px] text-center shrink-0">
                  {indicators.pagarCheques}
                </span>
              </button>
            </div>
          </div>

          {/* SEÇÃO 3: CLIENTES */}
          <div className="flex flex-col h-full rounded-md shadow-xs overflow-hidden border border-blue-400/80 dark:border-blue-900 bg-white/95 dark:bg-stone-850/95">
            {/* Cabeçalho da Seção */}
            <div 
              onClick={() => onNavigate('clientes')}
              className="bg-gradient-to-r from-blue-700 via-blue-600 to-blue-800 hover:from-blue-600 hover:to-blue-700 text-white font-extrabold text-[11px] uppercase tracking-wide py-1.5 px-3 flex items-center justify-between border-b border-blue-900 cursor-pointer transition select-none shadow-2xs shrink-0"
            >
              <div className="flex items-center space-x-1.5 truncate">
                <Users className="w-3.5 h-3.5 text-blue-200 shrink-0" />
                <span className="truncate">CLIENTES</span>
              </div>
              <ChevronRight className="w-3 h-3 text-blue-200 shrink-0" />
            </div>

            {/* Itens Internos com Escala Slim Equilibrada */}
            <div className="flex flex-col justify-between p-2 sm:p-2.5 h-full flex-1 gap-1.5">
              <button
                type="button"
                onClick={() => onNavigate('clientes')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-50 hover:bg-blue-50 dark:bg-stone-800 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-stone-700 hover:border-blue-300 transition cursor-pointer text-left active:scale-98"
              >
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase truncate">
                  CLIENTES AUSENTES
                </span>
                <span className="bg-slate-200 dark:bg-stone-700 text-slate-600 dark:text-stone-300 font-bold text-[11px] px-2 py-0.5 rounded min-w-[22px] text-center shrink-0">
                  {indicators.clientesAusentes}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('clientes')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-50 hover:bg-blue-50 dark:bg-stone-800 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-stone-700 hover:border-blue-300 transition cursor-pointer text-left active:scale-98"
              >
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase truncate">
                  CLIENTES BLOQUEADOS
                </span>
                <span className="bg-slate-200 dark:bg-stone-700 text-slate-600 dark:text-stone-300 font-bold text-[11px] px-2 py-0.5 rounded min-w-[22px] text-center shrink-0">
                  {indicators.clientesBloqueados}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('clientes')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-50 hover:bg-blue-50 dark:bg-stone-800 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-stone-700 hover:border-blue-300 transition cursor-pointer text-left active:scale-98"
              >
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase truncate">
                  ANIVERSARIANTES
                </span>
                <span className="bg-slate-200 dark:bg-stone-700 text-slate-600 dark:text-stone-300 font-bold text-[11px] px-2 py-0.5 rounded min-w-[22px] text-center shrink-0">
                  {indicators.clientesAniversariantes}
                </span>
              </button>
            </div>
          </div>

          {/* SEÇÃO 4: PRODUTOS */}
          <div className="flex flex-col h-full rounded-md shadow-xs overflow-hidden border border-blue-400/80 dark:border-blue-900 bg-white/95 dark:bg-stone-850/95">
            {/* Cabeçalho da Seção */}
            <div 
              onClick={() => onNavigate('almoxarifado')}
              className="bg-gradient-to-r from-blue-700 via-blue-600 to-blue-800 hover:from-blue-600 hover:to-blue-700 text-white font-extrabold text-[11px] uppercase tracking-wide py-1.5 px-3 flex items-center justify-between border-b border-blue-900 cursor-pointer transition select-none shadow-2xs shrink-0"
            >
              <div className="flex items-center space-x-1.5 truncate">
                <Package className="w-3.5 h-3.5 text-blue-200 shrink-0" />
                <span className="truncate">PRODUTOS</span>
              </div>
              <ChevronRight className="w-3 h-3 text-blue-200 shrink-0" />
            </div>

            {/* Itens Internos com Escala Slim Equilibrada */}
            <div className="flex flex-col justify-between p-2 sm:p-2.5 h-full flex-1 gap-1.5">
              <button
                type="button"
                onClick={() => onNavigate('almoxarifado')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-50 hover:bg-blue-50 dark:bg-stone-800 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-stone-700 hover:border-blue-300 transition cursor-pointer text-left active:scale-98"
              >
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase truncate">
                  ESTOQUE BAIXO
                </span>
                <span className="bg-amber-500 text-white font-black text-[11px] px-2 py-0.5 rounded shadow-2xs min-w-[22px] text-center shrink-0">
                  {indicators.produtosEstoqueBaixo}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('almoxarifado')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-50 hover:bg-blue-50 dark:bg-stone-800 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-stone-700 hover:border-blue-300 transition cursor-pointer text-left active:scale-98"
              >
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase truncate">
                  PROD. VENCENDO HOJE
                </span>
                <span className="bg-slate-200 dark:bg-stone-700 text-slate-600 dark:text-stone-300 font-bold text-[11px] px-2 py-0.5 rounded min-w-[22px] text-center shrink-0">
                  {indicators.produtosVencendoHoje}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('almoxarifado')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-50 hover:bg-blue-50 dark:bg-stone-800 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-stone-700 hover:border-blue-300 transition cursor-pointer text-left active:scale-98"
              >
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase truncate">
                  SUG. DE CICLO DE VIDA
                </span>
                <span className="bg-slate-200 dark:bg-stone-700 text-slate-600 dark:text-stone-300 font-bold text-[11px] px-2 py-0.5 rounded min-w-[22px] text-center shrink-0">
                  {indicators.produtosCicloVida}
                </span>
              </button>
            </div>
          </div>

          {/* SEÇÃO 5: OUTROS */}
          <div className="flex flex-col h-full rounded-md shadow-xs overflow-hidden border border-blue-400/80 dark:border-blue-900 bg-white/95 dark:bg-stone-850/95 sm:col-span-2 lg:col-span-1">
            {/* Cabeçalho da Seção */}
            <div 
              onClick={() => onNavigate('fiscal')}
              className="bg-gradient-to-r from-blue-700 via-blue-600 to-blue-800 hover:from-blue-600 hover:to-blue-700 text-white font-extrabold text-[11px] uppercase tracking-wide py-1.5 px-3 flex items-center justify-between border-b border-blue-900 cursor-pointer transition select-none shadow-2xs shrink-0"
            >
              <div className="flex items-center space-x-1.5 truncate">
                <Layers className="w-3.5 h-3.5 text-blue-200 shrink-0" />
                <span className="truncate">OUTROS</span>
              </div>
              <ChevronRight className="w-3 h-3 text-blue-200 shrink-0" />
            </div>

            {/* Itens Internos com Escala Slim Equilibrada */}
            <div className="flex flex-col justify-between p-2 sm:p-2.5 h-full flex-1 gap-1.5">
              <button
                type="button"
                onClick={() => onNavigate('servicos')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-50 hover:bg-blue-50 dark:bg-stone-800 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-stone-700 hover:border-blue-300 transition cursor-pointer text-left active:scale-98"
              >
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase truncate">
                  ENTREGAS
                </span>
                <span className="bg-slate-200 dark:bg-stone-700 text-slate-600 dark:text-stone-300 font-bold text-[11px] px-2 py-0.5 rounded min-w-[22px] text-center shrink-0">
                  {indicators.outrosEntregas}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('almoxarifado')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-50 hover:bg-blue-50 dark:bg-stone-800 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-stone-700 hover:border-blue-300 transition cursor-pointer text-left active:scale-98"
              >
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase truncate">
                  PRODUTOS SEM VENDAS
                </span>
                <span className="bg-blue-600 text-white font-black text-[11px] px-2 py-0.5 rounded shadow-2xs min-w-[22px] text-center shrink-0">
                  {indicators.outrosSemVendas}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('financeiro')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-50 hover:bg-blue-50 dark:bg-stone-800 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-stone-700 hover:border-blue-300 transition cursor-pointer text-left active:scale-98"
              >
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase truncate">
                  COBRANÇAS PREVISTAS
                </span>
                <span className="bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 font-black text-[10px] px-2 py-0.5 rounded border border-blue-300 dark:border-blue-800 shrink-0">
                  {formattedCobrancasPrevistas}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('fiscal')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-emerald-50/80 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800/60 hover:border-emerald-300 transition cursor-pointer text-left active:scale-98"
              >
                <span className="text-[10px] sm:text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 uppercase truncate flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  MONITOR FISCAL
                </span>
                <span className="bg-emerald-600 text-white font-black text-[10px] px-2 py-0.5 rounded shadow-2xs shrink-0 tracking-wider">
                  {indicators.monitorFiscalStatus}
                </span>
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* =========================================================================
          FAIXA 3: BASE DA TELA (BLOCO DA MARCA AGROCONTROL OFICIAL 100% CENTRALIZADO)
          Fluxo vertical perfeitamente centralizado: Imagem oficial da ensiladeira 
          com saco de moedas acima, seguida de 'AgroControl' e 'GESTÃO DE SILAGEM E MÁQUINAS'
         ========================================================================= */}
      <div className="flex flex-col items-center justify-center text-center mt-auto pb-2 w-full select-none">
        <div 
          className="flex flex-col items-center justify-center text-center cursor-pointer transition-transform hover:scale-[1.01] duration-150"
          onClick={() => onNavigate('dashboard')}
          title="Visão Executiva do AgroControl"
        >
          {/* 1. Imagem Oficial Fiel: Ensiladeira com Saco de Moedas (Print 2) */}
          <div className="shrink-0 mb-1">
            {!imgError ? (
              <img 
                src="/src/assets/images/ensiladeira_moedas_1791492311961.jpg"
                alt="AgroControl - Ensiladeira com Moedas de Ouro"
                className="w-44 h-auto mx-auto block object-contain drop-shadow-sm transition-all"
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
              />
            ) : (
              <EnsiladeiraVector size="lg" className="w-44 h-auto drop-shadow-sm mx-auto block" />
            )}
          </div>

          {/* 2. Alinhamento do Nome Comercial: AgroControl (CamelCase exata) */}
          <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight leading-tight [text-shadow:_0_1px_0_rgba(255,255,255,0.9)] dark:[text-shadow:_0_1px_0_rgba(255,255,255,0.05)]">
            AgroControl
          </h2>

          {/* 3. Alinhamento da Descrição de Especialidade 100% Caixa Alta */}
          <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 tracking-widest uppercase mt-0.5 leading-tight">
            GESTÃO DE SILAGEM E MÁQUINAS
          </p>
        </div>
      </div>

    </div>
  );
};

export default AgroControlHome;
