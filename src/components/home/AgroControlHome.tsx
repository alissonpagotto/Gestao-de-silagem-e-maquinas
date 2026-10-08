import React, { useState, useEffect, useMemo } from 'react';
import { 
  CreditCard, 
  Wallet, 
  Users, 
  Package, 
  Layers, 
  ShieldCheck, 
  ChevronRight,
  TrendingUp,
  FileCheck2,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { CompanyProfile } from '../../types';
import { EnsiladeiraVector } from './EnsiladeiraVector';

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

  // Razão Social & Nome Fantasia resolvidos
  const activeTradeName = useMemo(() => {
    const raw = companyProfile?.tradeName || companyProfile?.activitySector;
    if (!raw || raw.trim() === '' || raw.trim().toLowerCase() === 'gestão de silagem' || raw.trim().toLowerCase() === 'silagem fácil') {
      return 'COLAÇA SILAGEM';
    }
    return raw.trim().toUpperCase();
  }, [companyProfile]);

  return (
    <div 
      id="agrocontrol-home-root"
      className="w-full h-full max-h-full flex flex-col justify-between items-center py-2 px-2.5 sm:px-4 lg:px-6 bg-gradient-to-b from-slate-100 via-slate-50 to-slate-200 dark:from-stone-900 dark:via-stone-900 dark:to-stone-950 overflow-hidden select-none"
    >
      
      {/* 1. TOPO DISCRETO: STATUS OPERACIONAL & ASSINATURA */}
      <div className="w-full max-w-6xl flex items-center justify-between text-xs text-slate-500 dark:text-stone-400 font-semibold border-b border-slate-300/70 dark:border-stone-800 pb-1.5 shrink-0">
        <div className="flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="uppercase text-[10px] tracking-wider font-extrabold text-slate-700 dark:text-stone-300">
            AMBIENTE OPERACIONAL ATIVO
          </span>
        </div>
        <div className="uppercase text-[10px] tracking-wider font-bold text-slate-600 dark:text-stone-300">
          ASSINANTE: <span className="text-emerald-700 dark:text-emerald-400 font-extrabold">{activeTradeName}</span> • GESTÃO AGRÍCOLA
        </div>
      </div>

      {/* 2. CENTRO PRINCIPAL: LOGOTIPO OFICIAL DA ENSILADEIRA COM CIFRÃO E GRID COMERCIAL */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-6xl min-h-0 my-auto py-1">
        
        {/* LOGOTIPO CENTRAL: ENSILADEIRA AUTOMOTRIZ VERDE COM O CIFRÃO ($) NA LATERAL (PRINT 3) */}
        <div className="flex flex-col items-center justify-center text-center shrink-0">
          <div className="transition-transform hover:scale-105 duration-200 cursor-pointer" onClick={() => onNavigate('dashboard')} title="Visão Executiva do AgroControl">
            <EnsiladeiraVector size="lg" className="h-16 sm:h-20 md:h-24 w-auto drop-shadow-md" />
          </div>

          <h1 className="text-slate-800 dark:text-slate-100 font-extrabold text-2xl sm:text-3xl tracking-tight uppercase [text-shadow:_0_1px_0_rgba(255,255,255,0.95)] dark:[text-shadow:_0_1px_0_rgba(255,255,255,0.1)] leading-none mt-1">
            AGROCONTROL
          </h1>

          <p className="text-[11px] sm:text-xs font-bold text-emerald-600 dark:text-emerald-400 tracking-wider uppercase mt-1">
            GESTÃO DE SILAGEM E VEÍCULOS
          </p>
        </div>

        {/* 3. GRID DE DASHBOARDS COMERCIAIS E FISCAIS DA HOME (PRINT 2) */}
        {/* BLOCOS AZUIS HORIZONTAIS E PARALELOS EM CAIXA ALTA */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-2.5 mt-3 sm:mt-4 shrink-0">
          
          {/* SEÇÃO 1: CONTAS A RECEBER */}
          <div className="flex flex-col rounded-md shadow-xs overflow-hidden border border-blue-400/80 dark:border-blue-900 bg-white/90 dark:bg-stone-850/90">
            {/* Cabeçalho da Seção */}
            <div 
              onClick={() => onNavigate('financeiro')}
              className="bg-gradient-to-r from-blue-700 via-blue-600 to-blue-800 hover:from-blue-600 hover:to-blue-700 text-white font-extrabold text-[10.5px] uppercase tracking-wide py-1 px-2.5 flex items-center justify-between border-b border-blue-900 cursor-pointer transition select-none shadow-2xs"
            >
              <div className="flex items-center space-x-1.5 truncate">
                <TrendingUp className="w-3.5 h-3.5 text-blue-200 shrink-0" />
                <span className="truncate">CONTAS A RECEBER</span>
              </div>
              <ChevronRight className="w-3 h-3 text-blue-200 shrink-0" />
            </div>

            {/* Itens Internos Compactos */}
            <div className="p-1.5 space-y-1">
              <button
                type="button"
                onClick={() => onNavigate('financeiro')}
                className="w-full flex items-center justify-between px-2 py-1 rounded bg-slate-50 hover:bg-blue-50 dark:bg-stone-800 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-stone-700 hover:border-blue-300 transition cursor-pointer text-left active:scale-98"
              >
                <span className="text-[10px] sm:text-[10.5px] font-semibold text-slate-700 dark:text-slate-300 uppercase truncate">
                  DÉBITOS VENCIDOS
                </span>
                <span className="bg-rose-600 text-white font-black text-[10.5px] px-1.5 py-0.2 rounded shadow-2xs min-w-[20px] text-center shrink-0">
                  {indicators.receberVencidos}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('financeiro')}
                className="w-full flex items-center justify-between px-2 py-1 rounded bg-slate-50 hover:bg-blue-50 dark:bg-stone-800 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-stone-700 hover:border-blue-300 transition cursor-pointer text-left active:scale-98"
              >
                <span className="text-[10px] sm:text-[10.5px] font-semibold text-slate-700 dark:text-slate-300 uppercase truncate">
                  DÉB. VENCENDO HOJE
                </span>
                <span className="bg-amber-500 text-white font-black text-[10.5px] px-1.5 py-0.2 rounded shadow-2xs min-w-[20px] text-center shrink-0">
                  {indicators.receberHoje}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('financeiro')}
                className="w-full flex items-center justify-between px-2 py-1 rounded bg-slate-50 hover:bg-blue-50 dark:bg-stone-800 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-stone-700 hover:border-blue-300 transition cursor-pointer text-left active:scale-98"
              >
                <span className="text-[10px] sm:text-[10.5px] font-semibold text-slate-700 dark:text-slate-300 uppercase truncate">
                  CHEQUES VENCENDO HOJE
                </span>
                <span className="bg-slate-200 dark:bg-stone-700 text-slate-600 dark:text-stone-300 font-bold text-[10.5px] px-1.5 py-0.2 rounded min-w-[20px] text-center shrink-0">
                  {indicators.receberCheques}
                </span>
              </button>
            </div>
          </div>

          {/* SEÇÃO 2: CONTAS A PAGAR */}
          <div className="flex flex-col rounded-md shadow-xs overflow-hidden border border-blue-400/80 dark:border-blue-900 bg-white/90 dark:bg-stone-850/90">
            {/* Cabeçalho da Seção */}
            <div 
              onClick={() => onNavigate('financeiro')}
              className="bg-gradient-to-r from-blue-700 via-blue-600 to-blue-800 hover:from-blue-600 hover:to-blue-700 text-white font-extrabold text-[10.5px] uppercase tracking-wide py-1 px-2.5 flex items-center justify-between border-b border-blue-900 cursor-pointer transition select-none shadow-2xs"
            >
              <div className="flex items-center space-x-1.5 truncate">
                <Wallet className="w-3.5 h-3.5 text-blue-200 shrink-0" />
                <span className="truncate">CONTAS A PAGAR</span>
              </div>
              <ChevronRight className="w-3 h-3 text-blue-200 shrink-0" />
            </div>

            {/* Itens Internos Compactos */}
            <div className="p-1.5 space-y-1">
              <button
                type="button"
                onClick={() => onNavigate('financeiro')}
                className="w-full flex items-center justify-between px-2 py-1 rounded bg-slate-50 hover:bg-blue-50 dark:bg-stone-800 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-stone-700 hover:border-blue-300 transition cursor-pointer text-left active:scale-98"
              >
                <span className="text-[10px] sm:text-[10.5px] font-semibold text-slate-700 dark:text-slate-300 uppercase truncate">
                  DÉBITOS VENCIDOS
                </span>
                <span className="bg-slate-200 dark:bg-stone-700 text-slate-600 dark:text-stone-300 font-bold text-[10.5px] px-1.5 py-0.2 rounded min-w-[20px] text-center shrink-0">
                  {indicators.pagarVencidos}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('financeiro')}
                className="w-full flex items-center justify-between px-2 py-1 rounded bg-slate-50 hover:bg-blue-50 dark:bg-stone-800 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-stone-700 hover:border-blue-300 transition cursor-pointer text-left active:scale-98"
              >
                <span className="text-[10px] sm:text-[10.5px] font-semibold text-slate-700 dark:text-slate-300 uppercase truncate">
                  DÉB. VENCENDO HOJE
                </span>
                <span className="bg-slate-200 dark:bg-stone-700 text-slate-600 dark:text-stone-300 font-bold text-[10.5px] px-1.5 py-0.2 rounded min-w-[20px] text-center shrink-0">
                  {indicators.pagarHoje}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('financeiro')}
                className="w-full flex items-center justify-between px-2 py-1 rounded bg-slate-50 hover:bg-blue-50 dark:bg-stone-800 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-stone-700 hover:border-blue-300 transition cursor-pointer text-left active:scale-98"
              >
                <span className="text-[10px] sm:text-[10.5px] font-semibold text-slate-700 dark:text-slate-300 uppercase truncate">
                  CHEQUES VENCENDO HOJE
                </span>
                <span className="bg-slate-200 dark:bg-stone-700 text-slate-600 dark:text-stone-300 font-bold text-[10.5px] px-1.5 py-0.2 rounded min-w-[20px] text-center shrink-0">
                  {indicators.pagarCheques}
                </span>
              </button>
            </div>
          </div>

          {/* SEÇÃO 3: CLIENTES */}
          <div className="flex flex-col rounded-md shadow-xs overflow-hidden border border-blue-400/80 dark:border-blue-900 bg-white/90 dark:bg-stone-850/90">
            {/* Cabeçalho da Seção */}
            <div 
              onClick={() => onNavigate('clientes')}
              className="bg-gradient-to-r from-blue-700 via-blue-600 to-blue-800 hover:from-blue-600 hover:to-blue-700 text-white font-extrabold text-[10.5px] uppercase tracking-wide py-1 px-2.5 flex items-center justify-between border-b border-blue-900 cursor-pointer transition select-none shadow-2xs"
            >
              <div className="flex items-center space-x-1.5 truncate">
                <Users className="w-3.5 h-3.5 text-blue-200 shrink-0" />
                <span className="truncate">CLIENTES</span>
              </div>
              <ChevronRight className="w-3 h-3 text-blue-200 shrink-0" />
            </div>

            {/* Itens Internos Compactos */}
            <div className="p-1.5 space-y-1">
              <button
                type="button"
                onClick={() => onNavigate('clientes')}
                className="w-full flex items-center justify-between px-2 py-1 rounded bg-slate-50 hover:bg-blue-50 dark:bg-stone-800 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-stone-700 hover:border-blue-300 transition cursor-pointer text-left active:scale-98"
              >
                <span className="text-[10px] sm:text-[10.5px] font-semibold text-slate-700 dark:text-slate-300 uppercase truncate">
                  CLIENTES AUSENTES
                </span>
                <span className="bg-slate-200 dark:bg-stone-700 text-slate-600 dark:text-stone-300 font-bold text-[10.5px] px-1.5 py-0.2 rounded min-w-[20px] text-center shrink-0">
                  {indicators.clientesAusentes}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('clientes')}
                className="w-full flex items-center justify-between px-2 py-1 rounded bg-slate-50 hover:bg-blue-50 dark:bg-stone-800 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-stone-700 hover:border-blue-300 transition cursor-pointer text-left active:scale-98"
              >
                <span className="text-[10px] sm:text-[10.5px] font-semibold text-slate-700 dark:text-slate-300 uppercase truncate">
                  CLIENTES BLOQUEADOS
                </span>
                <span className="bg-slate-200 dark:bg-stone-700 text-slate-600 dark:text-stone-300 font-bold text-[10.5px] px-1.5 py-0.2 rounded min-w-[20px] text-center shrink-0">
                  {indicators.clientesBloqueados}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('clientes')}
                className="w-full flex items-center justify-between px-2 py-1 rounded bg-slate-50 hover:bg-blue-50 dark:bg-stone-800 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-stone-700 hover:border-blue-300 transition cursor-pointer text-left active:scale-98"
              >
                <span className="text-[10px] sm:text-[10.5px] font-semibold text-slate-700 dark:text-slate-300 uppercase truncate">
                  ANIVERSARIANTES
                </span>
                <span className="bg-slate-200 dark:bg-stone-700 text-slate-600 dark:text-stone-300 font-bold text-[10.5px] px-1.5 py-0.2 rounded min-w-[20px] text-center shrink-0">
                  {indicators.clientesAniversariantes}
                </span>
              </button>
            </div>
          </div>

          {/* SEÇÃO 4: PRODUTOS */}
          <div className="flex flex-col rounded-md shadow-xs overflow-hidden border border-blue-400/80 dark:border-blue-900 bg-white/90 dark:bg-stone-850/90">
            {/* Cabeçalho da Seção */}
            <div 
              onClick={() => onNavigate('almoxarifado')}
              className="bg-gradient-to-r from-blue-700 via-blue-600 to-blue-800 hover:from-blue-600 hover:to-blue-700 text-white font-extrabold text-[10.5px] uppercase tracking-wide py-1 px-2.5 flex items-center justify-between border-b border-blue-900 cursor-pointer transition select-none shadow-2xs"
            >
              <div className="flex items-center space-x-1.5 truncate">
                <Package className="w-3.5 h-3.5 text-blue-200 shrink-0" />
                <span className="truncate">PRODUTOS</span>
              </div>
              <ChevronRight className="w-3 h-3 text-blue-200 shrink-0" />
            </div>

            {/* Itens Internos Compactos */}
            <div className="p-1.5 space-y-1">
              <button
                type="button"
                onClick={() => onNavigate('almoxarifado')}
                className="w-full flex items-center justify-between px-2 py-1 rounded bg-slate-50 hover:bg-blue-50 dark:bg-stone-800 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-stone-700 hover:border-blue-300 transition cursor-pointer text-left active:scale-98"
              >
                <span className="text-[10px] sm:text-[10.5px] font-semibold text-slate-700 dark:text-slate-300 uppercase truncate">
                  ESTOQUE BAIXO
                </span>
                <span className="bg-amber-500 text-white font-black text-[10.5px] px-1.5 py-0.2 rounded shadow-2xs min-w-[20px] text-center shrink-0">
                  {indicators.produtosEstoqueBaixo}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('almoxarifado')}
                className="w-full flex items-center justify-between px-2 py-1 rounded bg-slate-50 hover:bg-blue-50 dark:bg-stone-800 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-stone-700 hover:border-blue-300 transition cursor-pointer text-left active:scale-98"
              >
                <span className="text-[10px] sm:text-[10.5px] font-semibold text-slate-700 dark:text-slate-300 uppercase truncate">
                  PROD. VENCENDO HOJE
                </span>
                <span className="bg-slate-200 dark:bg-stone-700 text-slate-600 dark:text-stone-300 font-bold text-[10.5px] px-1.5 py-0.2 rounded min-w-[20px] text-center shrink-0">
                  {indicators.produtosVencendoHoje}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('almoxarifado')}
                className="w-full flex items-center justify-between px-2 py-1 rounded bg-slate-50 hover:bg-blue-50 dark:bg-stone-800 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-stone-700 hover:border-blue-300 transition cursor-pointer text-left active:scale-98"
              >
                <span className="text-[10px] sm:text-[10.5px] font-semibold text-slate-700 dark:text-slate-300 uppercase truncate">
                  SUG. DE CICLO DE VIDA
                </span>
                <span className="bg-slate-200 dark:bg-stone-700 text-slate-600 dark:text-stone-300 font-bold text-[10.5px] px-1.5 py-0.2 rounded min-w-[20px] text-center shrink-0">
                  {indicators.produtosCicloVida}
                </span>
              </button>
            </div>
          </div>

          {/* SEÇÃO 5: OUTROS */}
          <div className="flex flex-col rounded-md shadow-xs overflow-hidden border border-blue-400/80 dark:border-blue-900 bg-white/90 dark:bg-stone-850/90 sm:col-span-2 lg:col-span-1">
            {/* Cabeçalho da Seção */}
            <div 
              onClick={() => onNavigate('fiscal')}
              className="bg-gradient-to-r from-blue-700 via-blue-600 to-blue-800 hover:from-blue-600 hover:to-blue-700 text-white font-extrabold text-[10.5px] uppercase tracking-wide py-1 px-2.5 flex items-center justify-between border-b border-blue-900 cursor-pointer transition select-none shadow-2xs"
            >
              <div className="flex items-center space-x-1.5 truncate">
                <Layers className="w-3.5 h-3.5 text-blue-200 shrink-0" />
                <span className="truncate">OUTROS</span>
              </div>
              <ChevronRight className="w-3 h-3 text-blue-200 shrink-0" />
            </div>

            {/* Itens Internos Compactos */}
            <div className="p-1.5 space-y-1">
              <button
                type="button"
                onClick={() => onNavigate('servicos')}
                className="w-full flex items-center justify-between px-2 py-1 rounded bg-slate-50 hover:bg-blue-50 dark:bg-stone-800 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-stone-700 hover:border-blue-300 transition cursor-pointer text-left active:scale-98"
              >
                <span className="text-[10px] sm:text-[10.5px] font-semibold text-slate-700 dark:text-slate-300 uppercase truncate">
                  ENTREGAS
                </span>
                <span className="bg-slate-200 dark:bg-stone-700 text-slate-600 dark:text-stone-300 font-bold text-[10.5px] px-1.5 py-0.2 rounded min-w-[20px] text-center shrink-0">
                  {indicators.outrosEntregas}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('almoxarifado')}
                className="w-full flex items-center justify-between px-2 py-1 rounded bg-slate-50 hover:bg-blue-50 dark:bg-stone-800 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-stone-700 hover:border-blue-300 transition cursor-pointer text-left active:scale-98"
              >
                <span className="text-[10px] sm:text-[10.5px] font-semibold text-slate-700 dark:text-slate-300 uppercase truncate">
                  PRODUTOS SEM VENDAS
                </span>
                <span className="bg-blue-600 text-white font-black text-[10.5px] px-1.5 py-0.2 rounded shadow-2xs min-w-[20px] text-center shrink-0">
                  {indicators.outrosSemVendas}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('financeiro')}
                className="w-full flex items-center justify-between px-2 py-1 rounded bg-slate-50 hover:bg-blue-50 dark:bg-stone-800 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-stone-700 hover:border-blue-300 transition cursor-pointer text-left active:scale-98"
              >
                <span className="text-[10px] sm:text-[10.5px] font-semibold text-slate-700 dark:text-slate-300 uppercase truncate">
                  COBRANÇAS PREVISTAS
                </span>
                <span className="bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 font-black text-[10px] px-1.5 py-0.2 rounded border border-blue-300 dark:border-blue-800 shrink-0">
                  {formattedCobrancasPrevistas}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('fiscal')}
                className="w-full flex items-center justify-between px-2 py-1 rounded bg-emerald-50/80 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800/60 hover:border-emerald-300 transition cursor-pointer text-left active:scale-98"
              >
                <span className="text-[10px] sm:text-[10.5px] font-semibold text-emerald-800 dark:text-emerald-300 uppercase truncate flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                  MONITOR FISCAL
                </span>
                <span className="bg-emerald-600 text-white font-black text-[9.5px] px-1.5 py-0.2 rounded shadow-2xs shrink-0 tracking-wider">
                  {indicators.monitorFiscalStatus}
                </span>
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* 4. RODAPÉ DE GOVERNANÇA E VERSÃO DO SISTEMA (SLIM, ZERO ROLAGEM) */}
      <div className="w-full max-w-6xl border-t border-slate-300/70 dark:border-stone-800 pt-1 text-center shrink-0">
        <p className="text-[10px] font-semibold text-slate-500 dark:text-stone-400 uppercase tracking-tight">
          SISTEMA AGROCONTROL • GESTÃO DE SILAGEM E VEÍCULOS • VERSÃO 1.0.3
        </p>
      </div>

    </div>
  );
};

export default AgroControlHome;
