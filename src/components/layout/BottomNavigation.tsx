import React from 'react';
import { 
  LayoutDashboard, 
  Tractor, 
  Receipt, 
  Users, 
  PlusCircle, 
  Menu
} from 'lucide-react';

interface BottomNavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenMobileMenu: () => void;
  onNewExpense: () => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  setActiveTab,
  onOpenMobileMenu,
  onNewExpense,
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Painel', icon: LayoutDashboard },
    { id: 'servicos', label: 'Serviços', icon: Tractor },
    { id: 'despesas', label: 'Despesas', icon: Receipt },
    { id: 'clientes', label: 'Clientes', icon: Users },
  ];

  return (
    <nav
      id="mobile-bottom-navigation"
      className="no-print lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md border-t border-zinc-200 dark:border-stone-800 px-2 py-1.5 shadow-lg flex items-center justify-around safe-bottom"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition min-h-[44px] cursor-pointer ${
              isActive
                ? 'text-emerald-600 dark:text-emerald-400 font-extrabold'
                : 'text-zinc-500 dark:text-stone-400 hover:text-zinc-900 dark:hover:text-stone-200'
            }`}
          >
            <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
            <span className="text-[10px] tracking-tight mt-0.5 whitespace-nowrap">{item.label}</span>
          </button>
        );
      })}

      {/* Botão de Ação Rápida: Nova Despesa */}
      <button
        type="button"
        onClick={onNewExpense}
        className="flex flex-col items-center justify-center py-1 px-2 rounded-xl text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition min-h-[44px] cursor-pointer"
        title="Novo Lançamento Rápido"
      >
        <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-md">
          <PlusCircle className="w-5 h-5 stroke-[2.5]" />
        </div>
        <span className="text-[9px] font-bold text-zinc-600 dark:text-stone-400 mt-0.5">Novo</span>
      </button>

      {/* Botão para Abrir Menu Lateral Completo */}
      <button
        type="button"
        onClick={onOpenMobileMenu}
        className="flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl text-zinc-500 dark:text-stone-400 hover:text-zinc-900 dark:hover:text-stone-200 transition min-h-[44px] cursor-pointer"
        title="Abrir Menu Completo"
      >
        <Menu className="w-5 h-5 stroke-[1.75]" />
        <span className="text-[10px] tracking-tight mt-0.5 whitespace-nowrap">Mais</span>
      </button>
    </nav>
  );
};
