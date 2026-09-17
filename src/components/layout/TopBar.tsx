import React from 'react';
import { 
  AlertTriangle, 
  Menu,
  Sparkles
} from 'lucide-react';

interface TopBarProps {
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
  isDarkMode?: boolean;
  setIsDarkMode?: (val: boolean | ((prev: boolean) => boolean)) => void;
  onOpenMobileMenu: () => void;
  onOpenQuickMemo?: () => void;
  onOpenTrialInfo?: () => void;
  selectedShortcuts?: string[];
  onOpenCustomizeShortcuts?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  onOpenMobileMenu,
  onOpenTrialInfo,
}) => {
  return (
    <div id="top-bar-container" className="no-print sticky top-0 z-30 shadow-xs">
      
      {/* Top Banner: Período de Teste com botão de menu mobile */}
      <div className="bg-rose-50 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-900/50 px-3 sm:px-4 py-1.5 flex items-center justify-between text-xs text-rose-700 dark:text-rose-300">
        <div className="flex items-center space-x-2 truncate">
          {/* Mobile menu trigger */}
          <button
            onClick={onOpenMobileMenu}
            className="lg:hidden p-1 rounded-md text-rose-700 dark:text-rose-300 hover:bg-rose-200/50 dark:hover:bg-rose-900/50 transition cursor-pointer"
            aria-label="Abrir Menu"
          >
            <Menu className="w-4 h-4" />
          </button>
          <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
          <span className="font-semibold truncate">
            Período de teste — restam 5 dias.
          </span>
          <button 
            onClick={onOpenTrialInfo}
            className="underline font-bold hover:text-rose-900 dark:hover:text-rose-100 transition cursor-pointer"
          >
            Ativar agora
          </button>
        </div>
        <div className="hidden sm:flex items-center space-x-2 text-[11px] text-rose-600 dark:text-rose-400">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Silagem Fácil Pro • Modo Completo</span>
        </div>
      </div>

    </div>
  );
};


