import React, { useState, useEffect } from 'react';
import { 
  LogOut,
  ChevronRight,
  Sprout,
  Bell,
  Sun,
  Moon
} from 'lucide-react';
import { CompanyProfile } from '../../types';
import { 
  ALL_MENU_ITEMS, 
  DEFAULT_MENU_ORDER, 
  MenuItemDef 
} from './ReorderMenuModal';
import { SupabaseStatusControl } from './SupabaseStatusControl';

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

  const handleSelect = (tabId: string) => {
    setActiveTab(tabId);
    if (onCloseMobile) onCloseMobile();
  };

  // Build sorted navigation list
  const currentOrder = propMenuOrder || menuOrder;
  const navItems: MenuItemDef[] = currentOrder
    .map(id => ALL_MENU_ITEMS.find(m => m.id === id))
    .filter((item): item is MenuItemDef => Boolean(item));

  return (
    <>
      <aside 
        id="main-sidebar"
        className={`
          no-print fixed inset-y-0 left-0 z-40 w-64 bg-blue-700 dark:bg-stone-900 border-r border-blue-800/60 flex flex-col justify-between transition-transform duration-300 ease-in-out
          ${isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Top Section: Logo & Brand */}
        <div className="flex flex-col flex-1 overflow-y-auto bg-blue-700 dark:bg-stone-900 scrollbar-none">
          
          {/* Brand Header */}
          <div className="p-4 sm:p-5 border-b border-blue-800/60 flex items-center space-x-3 cursor-pointer bg-blue-800/40 dark:bg-stone-900" onClick={() => handleSelect('dashboard')}>
            {companyProfile?.logoUrl ? (
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-emerald-950/60 border border-slate-200 dark:border-emerald-700 p-1 flex items-center justify-center shadow-xs shrink-0 overflow-hidden">
                <img 
                  src={companyProfile.logoUrl} 
                  alt="Logo" 
                  className="max-w-full max-h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-blue-500 dark:bg-emerald-600 flex items-center justify-center text-white shadow-sm shrink-0">
                <Sprout className="w-6 h-6 stroke-[2.5]" />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-base font-extrabold text-white truncate tracking-tight font-['Outfit']">
                {companyProfile?.tradeName || 'Silagem Fácil'}
              </h2>
              <p className="text-[10px] font-black text-blue-200 dark:text-stone-400 tracking-wider uppercase">
                GESTÃO AGRÍCOLA
              </p>
            </div>
          </div>

          {/* Navigation Section Header: Título MENU PRINCIPAL com os botões rápidos alinhados horizontalmente à direita */}
          <div className="px-3 sm:px-4 pt-3 pb-1 flex items-center justify-between gap-1 text-[11px] font-bold text-blue-200/70 dark:text-stone-400 uppercase tracking-wider">
            <span className="shrink-0">MENU PRINCIPAL</span>

            {/* Grupo de botões de atalho rápidos realocados do cabeçalho */}
            <div className="flex items-center space-x-1 shrink-0 normal-case tracking-normal">
              {/* Notificações / Sininho */}
              <button
                type="button"
                onClick={() => handleSelect('funcionarios')}
                title="Notificações e Avisos de CNH"
                className="relative p-1.5 rounded-lg text-white hover:bg-white/15 transition cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
              </button>

              {/* Configurações / Tema / Atualizar */}
              {setIsDarkMode && (
                <button
                  id="btn-theme-toggle"
                  type="button"
                  onClick={() => setIsDarkMode(prev => !prev)}
                  title={isDarkMode ? 'Mudar para modo claro (Light)' : 'Mudar para modo escuro (Dark)'}
                  aria-label="Alternar tema claro e escuro"
                  className="p-1.5 rounded-lg text-white hover:bg-white/15 transition cursor-pointer flex items-center justify-center active:scale-95"
                >
                  {isDarkMode ? (
                    <Sun className="w-4 h-4 fill-amber-400/20 text-amber-300" />
                  ) : (
                    <Moon className="w-4 h-4 text-white" />
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Navigation List */}
          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = 
                activeTab === item.id ||
                (item.id === 'venda' && (activeTab === 'venda' || activeTab === 'vendas')) ||
                (item.id === 'fiscal' && (activeTab === 'nfe_notas' || activeTab === 'nfe_importar')) ||
                (item.id === 'financeiro' && activeTab === 'despesas') ||
                (item.id === 'frotas' && ['veiculos', 'manutencoes', 'combustivel', 'motoristas', 'equipe', 'rodizio', 'rodizio_pneus'].includes(activeTab)) ||
                (item.id === 'rh' && activeTab === 'funcionarios');

              return (
                <button
                  key={item.id}
                  id={`sidebar-nav-${item.id}`}
                  onClick={() => handleSelect(item.id)}
                  className={`
                    w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer group
                    ${
                      isActive
                        ? 'bg-blue-500 text-white font-bold shadow-sm shadow-blue-900/30 border border-blue-400/50 dark:bg-sky-600 dark:text-white dark:border-sky-500'
                        : 'text-white/80 dark:text-stone-300 hover:bg-blue-600/40 dark:hover:bg-stone-800 hover:text-white'
                    }
                  `}
                >
                  <div className="flex items-center space-x-3 truncate">
                    <Icon 
                      className={`w-4 h-4 shrink-0 transition ${isActive ? 'text-white' : 'text-blue-200 group-hover:text-white'}`} 
                    />
                    <span 
                      className={`truncate ${isActive ? 'text-white font-bold' : 'text-white/90 group-hover:text-white'}`}
                    >
                      {item.label}
                    </span>
                  </div>

                  {isActive && (
                    <ChevronRight className="w-4 h-4 text-white shrink-0" />
                  )}

                  {!isActive && item.hasSubmenu && (
                    <ChevronRight className="w-3.5 h-3.5 text-blue-300/60 dark:text-stone-500 group-hover:text-white shrink-0" />
                  )}
                </button>
              );
            })}
          </nav>

        </div>

        {/* Bottom Section: Logout & Supabase */}
        <div className="p-3 border-t border-blue-800/60 bg-blue-800/30 dark:bg-stone-900 flex items-center justify-between gap-2">
          <button
            id="btn-sidebar-logout"
            onClick={() => {
              if (onLogout) {
                onLogout();
              } else {
                setActiveTab('dashboard');
              }
            }}
            className="flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold text-rose-200 hover:bg-rose-900/40 hover:text-white dark:text-rose-400 dark:hover:bg-rose-950/30 transition cursor-pointer"
          >
            <LogOut 
              className="w-4 h-4 text-rose-400 shrink-0" 
            />
            <span>Sair</span>
          </button>

          {/* Botão Supabase posicionado no rodapé ao lado direito do botão Sair */}
          <div className="shrink-0">
            <SupabaseStatusControl dropdownPosition="up" />
          </div>
        </div>

      </aside>
    </>
  );
};
