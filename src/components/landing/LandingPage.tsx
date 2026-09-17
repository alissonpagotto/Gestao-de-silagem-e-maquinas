import React, { useState, useEffect } from 'react';
import { 
  Check, 
  ArrowRight, 
  Sparkles, 
  ShieldCheck, 
  Layers, 
  Clock, 
  Users, 
  TrendingUp, 
  Wrench, 
  ExternalLink,
  Lock,
  ChevronRight,
  Tractor,
  Smartphone,
  PhoneCall
} from 'lucide-react';
import { SiteConfig, PlanDefinition } from '../../types/masterAdmin';
import { getStoredSiteConfig, getStoredPlans } from '../../lib/masterAdminStorage';
import { formatCurrencyBRL } from '../../lib/formatters';

interface LandingPageProps {
  onEnterApp: () => void;
  onOpenMasterAdmin: () => void;
  onNavigateToAuth?: (planId?: string, mode?: 'signup' | 'login') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onEnterApp,
  onOpenMasterAdmin,
  onNavigateToAuth,
}) => {
  const [siteConfig, setSiteConfig] = useState<SiteConfig>(() => getStoredSiteConfig());
  const [plans, setPlans] = useState<PlanDefinition[]>(() => getStoredPlans());

  // Sincronização em tempo real caso o Master Admin altere em outra aba
  useEffect(() => {
    const handleSync = () => {
      setSiteConfig(getStoredSiteConfig());
      setPlans(getStoredPlans());
    };
    window.addEventListener('master_admin_data_changed', handleSync);
    return () => window.removeEventListener('master_admin_data_changed', handleSync);
  }, []);

  // Filtrar apenas planos ativos e ordenar por displayOrder
  const activePlans = plans
    .filter(p => p.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const handleCheckoutClick = (plan: PlanDefinition) => {
    if (plan.checkoutUrl && plan.checkoutUrl.startsWith('http') && !plan.checkoutUrl.includes('exemplo')) {
      window.open(plan.checkoutUrl, '_blank', 'noopener,noreferrer');
    } else if (onNavigateToAuth) {
      onNavigateToAuth(plan.id, 'signup');
    } else {
      onEnterApp();
    }
  };

  const featureIcons = [
    <Tractor className="w-6 h-6 text-emerald-500" key="1" />,
    <Smartphone className="w-6 h-6 text-teal-500" key="2" />,
    <TrendingUp className="w-6 h-6 text-emerald-600" key="3" />,
    <Wrench className="w-6 h-6 text-amber-500" key="4" />,
  ];

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 font-['Plus_Jakarta_Sans',sans-serif] selection:bg-emerald-500 selection:text-stone-950">
      
      {/* NAVBAR PÚBLICA */}
      <nav className="border-b border-stone-800/80 bg-stone-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-black text-base shadow-md shadow-emerald-950">
              AC
            </div>
            <div>
              <span className="text-base font-black tracking-tight text-white block">
                AgroControl
              </span>
              <span className="text-[10px] text-emerald-400 font-bold tracking-wider uppercase block -mt-1">
                Silagem Fácil Pro
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-6 text-xs font-bold text-stone-300">
            <a href="#recursos" className="hover:text-emerald-400 transition">
              Recursos
            </a>
            <a href="#planos" className="hover:text-emerald-400 transition">
              Planos & Preços
            </a>
            <a href="#depoimentos" className="hover:text-emerald-400 transition">
              Diferenciais
            </a>
          </div>

          <div className="flex items-center gap-2.5">
            {onNavigateToAuth && (
              <button
                type="button"
                onClick={() => onNavigateToAuth(undefined, 'signup')}
                className="px-3.5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-stone-950 rounded-xl text-xs font-black transition cursor-pointer shadow-sm shadow-emerald-950 flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Criar Conta (15d Grátis)</span>
              </button>
            )}
            <button
              type="button"
              onClick={onEnterApp}
              className="px-4 py-2 bg-stone-900 border border-stone-700 hover:bg-stone-800 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-sm shadow-emerald-950 flex items-center gap-1.5"
            >
              <span>Acessar o ERP</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </nav>

      {/* BLOCO HERO (DINÂMICO) */}
      <section className="relative pt-16 pb-20 md:pt-24 md:pb-32 px-4 sm:px-6 overflow-hidden">
        {/* Glow de fundo */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="max-w-4xl mx-auto text-center space-y-6 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>A plataforma nº 1 em prestação de serviços de silagem e colheita</span>
          </div>

          {/* TÍTULO PRINCIPAL (H1) */}
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight leading-[1.15]">
            {siteConfig.heroTitle}
          </h1>

          {/* SUBTÍTULO */}
          <p className="text-sm sm:text-lg text-stone-300 max-w-2xl mx-auto leading-relaxed font-normal">
            {siteConfig.heroSubtitle}
          </p>

          {/* BOTÕES DO HERO */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <button
              type="button"
              onClick={() => onNavigateToAuth ? onNavigateToAuth('plano-pro', 'signup') : onEnterApp()}
              className="w-full sm:w-auto px-7 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-stone-950 font-black text-sm rounded-xl transition shadow-xl shadow-emerald-950/50 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{siteConfig.heroPrimaryBtnText}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <a
              href="#planos"
              className="w-full sm:w-auto px-7 py-3.5 bg-stone-900 hover:bg-stone-800 text-stone-200 border border-stone-800 font-bold text-sm rounded-xl transition flex items-center justify-center gap-2"
            >
              <span>{siteConfig.heroSecondaryBtnText}</span>
            </a>
          </div>

          {/* Badges de Confiança */}
          <div className="pt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-stone-400">
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-400" /> Sem fidelidade contratual
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-400" /> Ativação imediata
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-400" /> Suporte humanizado no WhatsApp
            </span>
          </div>
        </div>
      </section>

      {/* BLOCO RECURSOS / BENEFÍCIOS (4 CARTÕES CONECTADOS) */}
      <section id="recursos" className="py-16 md:py-24 bg-stone-900/50 border-y border-stone-800/80 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto space-y-12">
          
          {/* Cabeçalho de Recursos Dinâmico */}
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              {siteConfig.featuresSectionTitle}
            </h2>
            <p className="text-xs sm:text-sm text-stone-400">
              {siteConfig.featuresSectionSubtitle}
            </p>
          </div>

          {/* Os 4 Cartões de Benefícios */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            
            {/* Card #1 */}
            <div className="bg-stone-900 border border-stone-800 p-6 rounded-2xl space-y-3 hover:border-emerald-500/50 transition">
              <div className="w-12 h-12 rounded-xl bg-emerald-950/60 border border-emerald-800/60 flex items-center justify-center">
                {featureIcons[0]}
              </div>
              <h3 className="text-base font-black text-white">
                {siteConfig.feature1Title}
              </h3>
              <p className="text-xs text-stone-400 leading-relaxed">
                {siteConfig.feature1Desc}
              </p>
            </div>

            {/* Card #2 */}
            <div className="bg-stone-900 border border-stone-800 p-6 rounded-2xl space-y-3 hover:border-teal-500/50 transition">
              <div className="w-12 h-12 rounded-xl bg-teal-950/60 border border-teal-800/60 flex items-center justify-center">
                {featureIcons[1]}
              </div>
              <h3 className="text-base font-black text-white">
                {siteConfig.feature2Title}
              </h3>
              <p className="text-xs text-stone-400 leading-relaxed">
                {siteConfig.feature2Desc}
              </p>
            </div>

            {/* Card #3 */}
            <div className="bg-stone-900 border border-stone-800 p-6 rounded-2xl space-y-3 hover:border-emerald-500/50 transition">
              <div className="w-12 h-12 rounded-xl bg-emerald-950/60 border border-emerald-800/60 flex items-center justify-center">
                {featureIcons[2]}
              </div>
              <h3 className="text-base font-black text-white">
                {siteConfig.feature3Title}
              </h3>
              <p className="text-xs text-stone-400 leading-relaxed">
                {siteConfig.feature3Desc}
              </p>
            </div>

            {/* Card #4 */}
            <div className="bg-stone-900 border border-stone-800 p-6 rounded-2xl space-y-3 hover:border-amber-500/50 transition">
              <div className="w-12 h-12 rounded-xl bg-amber-950/60 border border-amber-800/60 flex items-center justify-center">
                {featureIcons[3]}
              </div>
              <h3 className="text-base font-black text-white">
                {siteConfig.feature4Title}
              </h3>
              <p className="text-xs text-stone-400 leading-relaxed">
                {siteConfig.feature4Desc}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SEÇÃO DE PLANOS & PREÇOS (DINÂMICA) */}
      <section id="planos" className="py-20 md:py-28 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto space-y-12">
          
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-black text-emerald-400 uppercase tracking-wider">
              Investimento Transparente
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              Escolha o plano ideal para a sua operação
            </h2>
            <p className="text-xs sm:text-sm text-stone-400">
              Comece com 7 dias grátis de teste. Cancele ou altere de plano a qualquer momento sem burocracia.
            </p>
          </div>

          {/* Cards dos Planos Ativos Ordenados */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
            {activePlans.map((plan) => {
              // Quebra as features linha por linha
              const features = plan.featuresText.split('\n').filter(Boolean);

              return (
                <div
                  key={plan.id}
                  className={`bg-stone-900 rounded-3xl p-6 sm:p-8 flex flex-col justify-between space-y-6 relative transition-all duration-200 ${
                    plan.isFeatured
                      ? 'border-2 border-emerald-500 shadow-2xl shadow-emerald-950/80 ring-1 ring-emerald-500/50 sm:-translate-y-2'
                      : 'border border-stone-800 hover:border-stone-700'
                  }`}
                >
                  {/* Badge de Destaque */}
                  {(plan.badge || plan.isFeatured) && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <span className="px-4 py-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-stone-950 text-xs font-black rounded-full uppercase tracking-wider shadow-md">
                        {plan.badge || 'Mais Escolhido'}
                      </span>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <h3 className="text-xl font-black text-white">
                        {plan.name}
                      </h3>
                      <p className="text-xs text-stone-400 mt-1 leading-relaxed">
                        {plan.description}
                      </p>
                    </div>

                    {/* Preço em Moeda Brasileira Padrão R$ #.##0,00 */}
                    <div className="py-3 border-y border-stone-800">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                          {formatCurrencyBRL(plan.price)}
                        </span>
                        <span className="text-xs text-stone-400 font-bold">/mês</span>
                      </div>
                      <span className="text-[11px] text-emerald-400 font-medium block mt-1">
                        Faturamento mensal no cartão ou Pix
                      </span>
                    </div>

                    {/* Features com ícone de check verde */}
                    <div className="space-y-2.5 pt-2">
                      <span className="text-[11px] font-black uppercase tracking-wider text-stone-400 block">
                        O que está incluído:
                      </span>
                      <ul className="space-y-2.5">
                        {features.map((feat, idx) => (
                          <li key={idx} className="flex items-start gap-2.5 text-xs text-stone-200 leading-snug">
                            <div className="w-4 h-4 rounded-full bg-emerald-950 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-800">
                              <Check className="w-3 h-3 text-emerald-400" />
                            </div>
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Botão Começar Agora com Injeção Direta da URL de Checkout */}
                  <div className="pt-4">
                    <button
                      type="button"
                      onClick={() => handleCheckoutClick(plan)}
                      className={`w-full py-3.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2 shadow-md ${
                        plan.isFeatured
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-stone-950 shadow-emerald-950/80'
                          : 'bg-stone-800 hover:bg-stone-700 text-white'
                      }`}
                    >
                      <span>Começar Agora</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* RODAPÉ DO SITE PÚBLICO */}
      <footer className="border-t border-stone-800/80 bg-stone-950 py-12 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-stone-400">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-black text-xs">
              AC
            </div>
            <span className="font-bold text-stone-300">
              AgroControl • Silagem Fácil Pro © 2026
            </span>
          </div>

          <div className="flex items-center gap-6">
            {onNavigateToAuth && (
              <button
                type="button"
                onClick={() => onNavigateToAuth(undefined, 'signup')}
                className="text-emerald-400 font-bold hover:underline transition cursor-pointer"
              >
                Criar Conta (15 Dias Grátis)
              </button>
            )}
            <button
              type="button"
              onClick={onEnterApp}
              className="hover:text-emerald-400 transition cursor-pointer"
            >
              Painel do Assinante (ERP)
            </button>
            <button
              type="button"
              onClick={onOpenMasterAdmin}
              className="hover:text-stone-200 transition cursor-pointer flex items-center gap-1 text-stone-500 hover:text-emerald-400"
              title="Acesso Administrativo Geral"
            >
              <Lock className="w-3 h-3" />
              <span>Admin Mestre</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
