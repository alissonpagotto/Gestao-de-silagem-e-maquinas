import React, { useState, useEffect } from 'react';
import { 
  Sprout,
  Bell,
  Sun,
  Moon,
  Lock,
  Building
} from 'lucide-react';
import { CompanyProfile, SimulatedUserSession } from '../../types';
import { 
  ALL_MENU_ITEMS, 
  DEFAULT_MENU_ORDER, 
  MenuItemDef 
} from './ReorderMenuModal';
import { 
  getActiveUserSession, 
  ModulePermissionKey 
} from '../../lib/cadastrosBaseStorage';
import { getStoredCompanyProfile } from '../../lib/storage';

export interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  companyProfile?: CompanyProfile;
  menuOrder?: string[];
  isDarkMode?: boolean;
  setIsDarkMode?: (val: boolean | ((prev: boolean) => boolean)) => void;
  onOpenCustomizeShortcuts?: () => void;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isOpenMobile,
  onCloseMobile,
  companyProfile,
  menuOrder: propMenuOrder,
  isDarkMode,
  setIsDarkMode,
  onLogout,
}) => {
  const [userSession, setUserSession] = useState<SimulatedUserSession>(() => getActiveUserSession());

  // Leitura reativa da chave local dos dados da empresa ('dadosEmpresa' ou perfil oficial)
  const getResolvedDadosEmpresa = (): { ramoAtividade?: string } => {
    try {
      const raw = localStorage.getItem('dadosEmpresa');
      if (raw) {
        const parsed = JSON.parse(raw);
        const val = parsed?.ramoAtividade || parsed?.activitySector || parsed?.setor;
        if (val && typeof val === 'string' && val.trim()) {
          return { ramoAtividade: val.trim() };
        }
      }
    } catch (e) {}

    try {
      const stored = getStoredCompanyProfile();
      if (stored) {
        const val = (stored as any)?.ramoAtividade || stored?.activitySector;
        if (val && typeof val === 'string' && val.trim() && val.trim().toUpperCase() !== 'GESTÃO AGRÍCOLA') {
          return { ramoAtividade: val.trim() };
        }
      }
    } catch (e) {}

    const propVal = (companyProfile as any)?.ramoAtividade || companyProfile?.activitySector;
    if (propVal && typeof propVal === 'string' && propVal.trim() && propVal.trim().toUpperCase() !== 'GESTÃO AGRÍCOLA') {
      return { ramoAtividade: propVal.trim() };
    }

    return { ramoAtividade: 'PRESTAÇÃO DE SERVIÇO DE SILAGEM' };
  };

  const [dadosEmpresa, setDadosEmpresa] = useState<{ ramoAtividade?: string }>(() => getResolvedDadosEmpresa());

  useEffect(() => {
    const syncDados = () => {
      setDadosEmpresa(getResolvedDadosEmpresa());
    };

    const handleLiveCompanySync = (e: any) => {
      const sector = e.detail?.ramoAtividade || e.detail?.activitySector;
      if (typeof sector === 'string') {
        setDadosEmpresa({ ramoAtividade: sector });
      } else {
        syncDados();
      }
    };

    window.addEventListener('colaca_company_profile_live_change', handleLiveCompanySync);
    window.addEventListener('storage', syncDados);
    return () => {
      window.removeEventListener('colaca_company_profile_live_change', handleLiveCompanySync);
      window.removeEventListener('storage', syncDados);
    };
  }, [companyProfile]);

  const [menuOrder, setMenuOrder] = useState<string[]>(() => {
    if (propMenuOrder && propMenuOrder.length > 0) {
      return propMenuOrder;
    }
    try {
      const saved = localStorage.getItem('silagem_facil_sidebar_order');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Verify valid items
          const valid = parsed.filter(id => ALL_MENU_ITEMS.some(m => m.id === id));
          if (!valid.includes('venda')) {
            const servIndex = valid.indexOf('servicos');
            if (servIndex !== -1) {
              valid.splice(servIndex + 1, 0, 'venda');
            } else {
              valid.push('venda');
            }
          }
          if (!valid.includes('fiscal')) {
            const finIndex = valid.indexOf('financeiro');
            if (finIndex !== -1) {
              valid.splice(finIndex + 1, 0, 'fiscal');
            } else {
              valid.push('fiscal');
            }
          }
          if (!valid.includes('almoxarifado')) {
            const estIndex = valid.indexOf('estoque');
            if (estIndex !== -1) {
              valid.splice(estIndex + 1, 0, 'almoxarifado');
            } else {
              valid.push('almoxarifado');
            }
          }
          if (!valid.includes('frotas')) {
            const fornIndex = valid.indexOf('fornecedores');
            if (fornIndex !== -1) {
              valid.splice(fornIndex + 1, 0, 'frotas');
            } else {
              const baseIndex = valid.indexOf('cadastros_base');
              if (baseIndex !== -1) {
                valid.splice(baseIndex, 0, 'frotas');
              } else {
                valid.push('frotas');
              }
            }
          }
          if (!valid.includes('cadastros_base')) {
            const frotaIndex = valid.indexOf('frotas');
            if (frotaIndex !== -1) {
              valid.splice(frotaIndex + 1, 0, 'cadastros_base');
            } else {
              valid.push('cadastros_base');
            }
          }
          const missing = ALL_MENU_ITEMS.filter(m => !valid.includes(m.id)).map(m => m.id);
          return [...valid, ...missing];
        }
      }
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_MENU_ORDER;
  });

  useEffect(() => {
    if (propMenuOrder && propMenuOrder.length > 0) {
      setMenuOrder(propMenuOrder);
    }
  }, [propMenuOrder]);

  // Sincroniza sessão ativa de permissões
  useEffect(() => {
    const handleSessionSync = (e: any) => {
      if (e?.detail) {
        setUserSession(e.detail);
      } else {
        setUserSession(getActiveUserSession());
      }
    };
    window.addEventListener('colaca_silagem_session_updated', handleSessionSync);
    window.addEventListener('storage', handleSessionSync);
    return () => {
      window.removeEventListener('colaca_silagem_session_updated', handleSessionSync);
      window.removeEventListener('storage', handleSessionSync);
    };
  }, []);

  useEffect(() => {
    const handleOrderSync = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setMenuOrder(e.detail);
      } else {
        try {
          const saved = localStorage.getItem('silagem_facil_sidebar_order');
          if (saved) setMenuOrder(JSON.parse(saved));
        } catch (err) {}
      }
    };
    window.addEventListener('silagem_sidebar_order_changed', handleOrderSync);
    window.addEventListener('storage', handleOrderSync);
    return () => {
      window.removeEventListener('silagem_sidebar_order_changed', handleOrderSync);
      window.removeEventListener('storage', handleOrderSync);
    };
  }, []);

  // Mapeamento de tab para a chave de permissão correspondente
  const getModulePermissionKey = (id: string): ModulePermissionKey | null => {
    if (id === 'servicos') return 'servicos';
    if (id === 'financeiro' || id === 'despesas') return 'financeiro';
    if (id === 'frotas') return 'frotas';
    if (id === 'rh' || id === 'funcionarios') return 'rh';
    if (id === 'estoque' || id === 'almoxarifado' || id === 'fiscal') return 'estoque';
    if (id === 'configuracoes') return 'empresa';
    return null;
  };

  // Ocultação estrita das abas conforme permissões do cargo na sessão ativa
  const isModuleHidden = (id: string): boolean => {
    if (userSession.type === 'admin') return false;
    const permKey = getModulePermissionKey(id);
    if (!permKey) return false;
    if (userSession.permissions && userSession.permissions[permKey] === false) {
      return true;
    }
    return false;
  };

  const isModuleRestricted = isModuleHidden;

  // Redireciona caso a tela ativa seja ocultada pelo perfil selecionado
  useEffect(() => {
    if (isModuleHidden(activeTab)) {
      setActiveTab('dashboard');
    }
  }, [userSession, activeTab]);

  const handleSelect = (tabId: string) => {
    // 4. TRAVA DE SEGURANÇA NA SIDEBAR (INTERCEPÇÃO VISUAL)
    if (isModuleHidden(tabId)) {
      setActiveTab(`acesso_restrito_${tabId}`);
      if (onCloseMobile) onCloseMobile();
      return;
    }

    setActiveTab(tabId);
    if (onCloseMobile) onCloseMobile();
  };

  const [logoError, setLogoError] = useState(false);

  // Build sorted navigation list
  const currentOrder = propMenuOrder || menuOrder;
  const navItems: MenuItemDef[] = currentOrder
    .map(id => ALL_MENU_ITEMS.find(m => m.id === id))
    .filter((item): item is MenuItemDef => Boolean(item));

  // 1. Menus principais (Dashboard até Cadastros Base) que ficam na lista com rolagem flexível
  // Oculta imediatamente abas não permitidas para o cargo/colaborador selecionado
  const middleNavItems = navItems
    .filter(item => item.id !== 'configuracoes' && item.id !== 'empresa')
    .filter(item => !isModuleHidden(item.id));

  // 2. Estado de acesso do botão Dados da Empresa (fixado obrigatoriamente no rodapé)
  const isEmpresaRestricted = isModuleHidden('configuracoes');
  const isEmpresaActive = activeTab === 'configuracoes' || activeTab === 'empresa';

  return (
    <>
      <aside 
        id="main-sidebar"
        className={`
          no-print absolute inset-y-0 left-0 z-40 w-64 bg-zinc-200 dark:bg-stone-900 border-r border-slate-300 dark:border-stone-800 shadow-[1px_0_0px_0px_rgba(255,255,255,0.9)] dark:shadow-[1px_0_0px_0px_rgba(255,255,255,0.05)] flex flex-col transition-transform duration-300 ease-in-out h-full max-h-full overflow-hidden
          ${isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Top Section: Cabeçalho da Empresa, Sessão Ativa & Título do Menu (Fixo) */}
        <div className="shrink-0 bg-zinc-200 dark:bg-stone-900">
          
          {/* Brand Header */}
          <div className="p-4 sm:p-5 border-b border-slate-300 dark:border-stone-800 shadow-[0_1px_0px_0px_rgba(255,255,255,0.8)] dark:shadow-[0_1px_0px_0px_rgba(255,255,255,0.05)] flex items-center space-x-3 cursor-pointer bg-zinc-200/90 dark:bg-stone-900" onClick={() => handleSelect('dashboard')}>
            {companyProfile?.logoUrl && !logoError ? (
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-emerald-950/60 border border-zinc-300 dark:border-emerald-700 p-1 flex items-center justify-center shadow-xs shrink-0 overflow-hidden">
                <img 
                  src={companyProfile.logoUrl} 
                  alt="Logo" 
                  className="max-w-full max-h-full object-contain"
                  referrerPolicy="no-referrer"
                  onError={() => setLogoError(true)}
                />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-zinc-800 dark:bg-emerald-600 flex items-center justify-center text-white shadow-xs shrink-0">
                <Sprout className="w-6 h-6 stroke-[2.5]" />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-base font-extrabold text-zinc-900 dark:text-white truncate tracking-tight font-['Outfit']">
                {companyProfile?.tradeName || 'COLAÇA SILAGEM'}
              </h2>
              <p 
                className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 tracking-wider uppercase truncate max-w-[170px]"
                title={dadosEmpresa?.ramoAtividade?.toUpperCase() || 'PRESTAÇÃO DE SERVIÇO DE SILAGEM'}
              >
                {dadosEmpresa?.ramoAtividade?.toUpperCase() || 'PRESTAÇÃO DE SERVIÇO DE SILAGEM'}
              </p>
            </div>
          </div>

          {/* Navigation Section Header: Título MENU PRINCIPAL com os botões rápidos */}
          <div className="px-3 sm:px-4 pt-3 pb-1 flex items-center justify-between gap-1 text-[11px] font-bold text-zinc-600 dark:text-stone-400 uppercase tracking-wider">
            <span className="shrink-0">MENU PRINCIPAL</span>

            <div className="flex items-center space-x-1 shrink-0 normal-case tracking-normal">
              {/* Notificações / Sininho */}
              <button
                type="button"
                onClick={() => handleSelect('funcionarios')}
                title="Notificações e Avisos de CNH"
                className="relative p-1.5 rounded-lg text-zinc-700 hover:bg-zinc-300/60 dark:text-white dark:hover:bg-white/15 transition cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
              </button>

              {/* Alternar Tema Claro / Escuro */}
              {setIsDarkMode && (
                <button
                  id="btn-theme-toggle"
                  type="button"
                  onClick={() => setIsDarkMode(prev => !prev)}
                  title={isDarkMode ? 'Mudar para modo claro (Light)' : 'Mudar para modo escuro (Dark)'}
                  aria-label="Alternar tema claro e escuro"
                  className="p-1.5 rounded-lg text-zinc-700 hover:bg-zinc-300/60 dark:text-white dark:hover:bg-white/15 transition cursor-pointer flex items-center justify-center active:scale-95"
                >
                  {isDarkMode ? (
                    <Sun className="w-4 h-4 fill-amber-400/20 text-amber-300" />
                  ) : (
                    <Moon className="w-4 h-4 text-zinc-700 dark:text-white" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 1. ATIVAR ROLAGEM EXCLUSIVA NA LISTA DE MENUS (NAV): */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-none px-3 py-1 space-y-1">
          <nav className="space-y-1">
            {middleNavItems.map((item) => {
              const Icon = item.icon;
              const isRestricted = isModuleRestricted(item.id);

              const isCadastrosBaseActive = 
                item.id === 'cadastros_base' && 
                (activeTab === 'cadastros_base' || activeTab.startsWith('cadastros_base_') || ['centros_custo', 'plano_contas', 'cargos_permissoes'].includes(activeTab));

              const isActive = 
                isCadastrosBaseActive ||
                activeTab === item.id ||
                (item.id === 'venda' && (activeTab === 'venda' || activeTab === 'vendas')) ||
                (item.id === 'fiscal' && (activeTab === 'nfe_notas' || activeTab === 'nfe_importar' || activeTab === 'documentos_entrada' || activeTab === 'entradas')) ||
                (item.id === 'financeiro' && activeTab === 'despesas') ||
                (item.id === 'frotas' && ['veiculos', 'manutencoes', 'combustivel', 'motoristas', 'equipe', 'rodizio', 'rodizio_pneus'].includes(activeTab)) ||
                (item.id === 'rh' && activeTab === 'funcionarios');

              return (
                <div key={item.id} className="space-y-0.5">
                  <button
                    id={`sidebar-nav-${item.id}`}
                    onClick={() => handleSelect(item.id)}
                    className={`
                      w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-[11px] font-semibold uppercase tracking-wider transition cursor-pointer group
                      ${
                        isRestricted
                          ? 'bg-rose-50/60 text-zinc-600 dark:bg-rose-950/20 dark:text-stone-400 hover:bg-rose-100/70 border border-dashed border-rose-300/70'
                          : isActive
                            ? 'bg-white text-slate-900 font-semibold shadow-xs border border-slate-300/80 dark:bg-stone-800 dark:text-white dark:border-stone-700'
                            : 'text-slate-700 dark:text-stone-300 hover:bg-slate-300/60 dark:hover:bg-stone-800 hover:text-slate-900 dark:hover:text-white'
                      }
                    `}
                  >
                    <div className="flex items-center space-x-2.5 truncate">
                      <Icon 
                        className={`w-4 h-4 shrink-0 transition ${
                          isRestricted 
                            ? 'text-rose-500' 
                            : isActive ? 'text-slate-900 dark:text-white' : 'text-slate-600 group-hover:text-slate-900 dark:text-stone-400 dark:group-hover:text-white'
                        }`} 
                      />
                      <span 
                        className={`truncate text-[11px] font-semibold uppercase tracking-wider ${
                          isRestricted
                            ? 'text-zinc-500 dark:text-stone-400'
                            : isActive ? 'text-slate-900 font-semibold dark:text-white' : 'text-slate-700 group-hover:text-slate-900 dark:text-stone-300 dark:group-hover:text-white'
                        }`}
                      >
                        {item.label}
                      </span>
                    </div>

                    {isRestricted && (
                      <span title="Acesso Bloqueado para este Cargo">
                        <Lock className="w-3.5 h-3.5 text-rose-500" />
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </nav>
        </div>

        {/* 2. FIXAR O RODAPÉ DA SIDEBAR (DADOS DA EMPRESA):
            Container fixado no rodapé absoluto da barra lateral com Dados da Empresa */}
        <div className="mt-auto pt-2.5 border-t border-slate-300 dark:border-stone-800 shadow-[0_-1px_0px_0px_rgba(255,255,255,0.8)] dark:shadow-[0_-1px_0px_0px_rgba(255,255,255,0.05)] bg-zinc-200/90 dark:bg-stone-900 p-3 space-y-2 shrink-0">
          
          {/* Botão Fixo: Dados da Empresa (se não estiver restrito/oculto para o cargo) */}
          {!isEmpresaRestricted && (
            <button
              id="sidebar-nav-configuracoes"
              type="button"
              onClick={() => handleSelect('configuracoes')}
              className={`
                w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-[11px] font-semibold uppercase tracking-wider transition cursor-pointer group
                ${
                  isEmpresaActive
                    ? 'bg-white text-slate-900 font-semibold shadow-xs border border-slate-300/80 dark:bg-stone-800 dark:text-white dark:border-stone-700'
                    : 'text-slate-700 dark:text-stone-300 hover:bg-slate-300/60 dark:hover:bg-stone-800 hover:text-slate-900 dark:hover:text-white'
                }
              `}
            >
              <div className="flex items-center space-x-2.5 truncate">
                <Building 
                  className={`w-4 h-4 shrink-0 transition ${
                    isEmpresaActive ? 'text-slate-900 dark:text-white' : 'text-slate-600 group-hover:text-slate-900 dark:text-stone-400 dark:group-hover:text-white'
                  }`} 
                />
                <span 
                  className={`truncate text-[11px] font-semibold uppercase tracking-wider ${
                    isEmpresaActive ? 'text-slate-900 font-semibold dark:text-white' : 'text-slate-700 group-hover:text-slate-900 dark:text-stone-300 dark:group-hover:text-white'
                  }`}
                >
                  Dados da Empresa
                </span>
              </div>
            </button>
          )}
        </div>

      </aside>
    </>
  );
};
