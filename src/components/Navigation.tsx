import React from 'react';
import { 
  ReceiptText, 
  Users, 
  ShoppingCart, 
  Tractor, 
  TrendingUp, 
  Settings2,
  FolderSync
} from 'lucide-react';

interface NavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  expensesCount: number;
  clientsCount: number;
  ordersCount: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  expensesCount,
  clientsCount,
  ordersCount,
}) => {
  const navItems = [
    {
      id: 'despesas',
      label: 'Lançamento de Despesas',
      icon: ReceiptText,
      badge: expensesCount,
      highlight: true,
    },
    {
      id: 'crm',
      label: 'CRM & Produtores',
      icon: Users,
      badge: clientsCount,
    },
    {
      id: 'pedidos',
      label: 'Vendas de Silagem',
      icon: ShoppingCart,
      badge: ordersCount,
    },
    {
      id: 'maquinarios',
      label: 'Maquinários & Frota',
      icon: Tractor,
    },
    {
      id: 'dre',
      label: 'DRE & Lucro Agro',
      icon: TrendingUp,
    },
    {
      id: 'categorias',
      label: 'Categorias & Centros',
      icon: Settings2,
    },
  ];

  return (
    <nav id="main-navigation" className="bg-white border-b border-stone-200 sticky top-16 sm:top-20 z-20 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex space-x-1 sm:space-x-4 overflow-x-auto py-2.5 scrollbar-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-tab-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                    : 'text-stone-600 hover:text-stone-950 hover:bg-stone-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-stone-500'}`} />
                <span>{item.label}</span>
                {typeof item.badge === 'number' && (
                  <span
                    className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                      isActive
                        ? 'bg-emerald-700/80 text-emerald-100'
                        : 'bg-stone-200 text-stone-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
