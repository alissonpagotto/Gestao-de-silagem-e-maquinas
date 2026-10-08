import React from 'react';
import { 
  Sprout, 
  Truck, 
  Users, 
  Wallet, 
  Package, 
  BarChart3, 
  ArrowRight,
  ShieldCheck,
  CalendarCheck
} from 'lucide-react';
import { CompanyProfile } from '../../types';

export interface AgroControlHomeProps {
  onNavigate: (tab: string) => void;
  companyProfile?: CompanyProfile;
}

export const AgroControlHome: React.FC<AgroControlHomeProps> = ({
  onNavigate,
  companyProfile,
}) => {
  const quickModules = [
    { id: 'dashboard', label: 'Painel Geral', icon: BarChart3, desc: 'Visão executiva em tempo real', color: 'text-sky-600' },
    { id: 'frotas', label: 'Gestão de Frotas', icon: Truck, desc: 'Máquinas, caminhões e manutenções', color: 'text-amber-600' },
    { id: 'rh', label: 'Recursos Humanos', icon: Users, desc: 'Folha, férias CLT e adiantamentos', color: 'text-blue-600' },
    { id: 'servicos', label: 'Serviços & Silagem', icon: Sprout, desc: 'Ordens de serviço e safras', color: 'text-emerald-600' },
    { id: 'financeiro', label: 'Financeiro & DRE', icon: Wallet, desc: 'Contas a pagar, receber e bancos', color: 'text-indigo-600' },
    { id: 'almoxarifado', label: 'Almoxarifado & Estoque', icon: Package, desc: 'Peças, ferramentas e inventário', color: 'text-teal-600' },
  ];

  return (
    <div className="w-full h-full min-h-[calc(100vh-60px)] flex flex-col justify-between items-center p-4 sm:p-6 lg:p-8 bg-gradient-to-b from-slate-100 via-slate-50 to-slate-200 dark:from-stone-900 dark:via-stone-900 dark:to-stone-950 overflow-hidden select-none">
      
      {/* Topo Discreto: Status Operacional & Assinante Ativo */}
      <div className="w-full max-w-4xl flex items-center justify-between text-xs text-slate-500 dark:text-stone-400 font-semibold border-b border-slate-300/60 dark:border-stone-800 pb-2">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="uppercase text-[10px] tracking-wider font-bold text-slate-700 dark:text-stone-300">
            AMBIENTE OPERACIONAL ATIVO
          </span>
        </div>
        <div className="uppercase text-[10px] tracking-wider font-bold text-slate-600 dark:text-stone-300">
          ASSINANTE: <span className="text-emerald-700 dark:text-emerald-400 font-extrabold">{companyProfile?.tradeName ? companyProfile.tradeName.toUpperCase() : 'COLAÇA SILAGEM L.'}</span> • GESTÃO AGRÍCOLA
        </div>
      </div>

      {/* Centro Absoluto: Identidade Oficial AGROCONTROL */}
      <div className="my-auto flex flex-col items-center justify-center text-center max-w-2xl px-4 py-6">
        
        {/* Emblema Metálico 3D Superior */}
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 dark:from-stone-800 dark:via-stone-750 dark:to-stone-900 border-2 border-slate-400 dark:border-stone-700 flex items-center justify-center shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9),0_4px_10px_rgba(0,0,0,0.1)] dark:shadow-[inset_1px_1px_0px_rgba(255,255,255,0.1),0_4px_10px_rgba(0,0,0,0.4)] mb-4 shrink-0 transition-transform hover:scale-105 duration-200">
          <Sprout className="w-9 h-9 sm:w-11 sm:h-11 text-emerald-600 stroke-[2.2] drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]" />
        </div>

        {/* Nome Principal: AGROCONTROL em Formato Tridimensional Premium */}
        <h1 className="text-slate-800 dark:text-slate-100 font-extrabold text-3xl sm:text-4xl md:text-5xl tracking-tight uppercase drop-shadow-[0_2px_3px_rgba(0,0,0,0.25)] [text-shadow:_0_1px_0_rgba(255,255,255,0.95),_0_2px_4px_rgba(0,0,0,0.15)] dark:[text-shadow:_0_1px_0_rgba(255,255,255,0.1),_0_2px_4px_rgba(0,0,0,0.6)]">
          AGROCONTROL
        </h1>

        {/* Linha 1: Subtítulo de Especialidade */}
        <p className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 tracking-wider uppercase mt-2">
          GESTÃO DE SILAGEM E VEÍCULOS
        </p>

        {/* Linha 2: Slogan Oficial */}
        <p className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-stone-400 italic mt-1">
          Vivendo tecnologia. Criando soluções.
        </p>

        {/* Atalhos Rápidos Compactos Slim para os Módulos Principais */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 mt-8 w-full max-w-xl">
          {quickModules.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onNavigate(m.id)}
                className="group p-2.5 rounded-xl bg-white/80 hover:bg-white dark:bg-stone-800/80 dark:hover:bg-stone-800 border border-slate-300/80 dark:border-stone-700 shadow-2xs hover:shadow-xs transition-all duration-150 text-left cursor-pointer active:scale-95 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <div className={`p-1.5 rounded-lg bg-slate-100 dark:bg-stone-700/60 ${m.color}`}>
                    <Icon className="w-4 h-4 stroke-[2.2]" />
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-800 dark:group-hover:text-white transition-transform group-hover:translate-x-0.5" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide block">
                    {m.label}
                  </span>
                  <span className="text-[9.5px] font-medium text-slate-500 dark:text-stone-400 line-clamp-1 block">
                    {m.desc}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

      </div>

      {/* Rodapé de Governança e Versão do Sistema */}
      <div className="w-full max-w-4xl border-t border-slate-300/60 dark:border-stone-800 pt-2.5 text-center shrink-0">
        <p className="text-[10px] font-semibold text-slate-500 dark:text-stone-400 uppercase tracking-tight">
          SISTEMA AGROCONTROL • GESTÃO DE SILAGEM E VEÍCULOS • VERSÃO 1.0.3
        </p>
      </div>

    </div>
  );
};
