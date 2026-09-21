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
  trialDaysRemaining?: number | null;
  subscriptionStatus?: 'active' | 'trial' | 'expired' | 'suspended' | 'not_found';
  subscriptionPlanName?: string;
}

export const TopBar: React.FC<TopBarProps> = ({
  onOpenMobileMenu,
  onOpenTrialInfo,
  trialDaysRemaining = 7,
  subscriptionStatus = 'trial',
  subscriptionPlanName = 'Produtor Essencial',
}) => {
  const isTrial = subscriptionStatus === 'trial';
  const days = trialDaysRemaining !== null && trialDaysRemaining !== undefined ? trialDaysRemaining : 7;
  const planDisplay = subscriptionPlanName && subscriptionPlanName !== 'Silagem Fácil Pro'
    ? subscriptionPlanName
    : 'Produtor Essencial';

  return (
    <div id="top-bar-container" className="no-print sticky top-0 z-30 shadow-xs">
      
      {/* Top Banner: Período de Teste ou Assinatura Ativa com botão de menu mobile */}
      <div className={`border-b px-3 sm:px-4 py-1.5 flex items-center justify-between text-xs transition-colors ${
        isTrial 
          ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300'
          : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300'
      }`}>
        <div className="flex items-center space-x-2 truncate">
          {/* Mobile menu trigger */}
          <button
            onClick={onOpenMobileMenu}
            className={`lg:hidden p-1 rounded-md transition cursor-pointer ${
              isTrial
                ? 'text-rose-700 dark:text-rose-300 hover:bg-rose-200/50 dark:hover:bg-rose-900/50'
                : 'text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200/50 dark:hover:bg-emerald-900/50'
            }`}
            aria-label="Abrir Menu"
          >
            <Menu className="w-4 h-4" />
          </button>
          
          {isTrial ? (
            <>
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span className="font-semibold truncate">
                Período de teste ({planDisplay}) — restam {days} {days === 1 ? 'dia' : 'dias'}.
              </span>
              <button 
                onClick={onOpenTrialInfo}
                className="underline font-bold hover:text-rose-900 dark:hover:text-rose-100 transition cursor-pointer"
              >
                Ativar agora
              </button>
            </>
          ) : (
            <>
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse"></span>
              <span className="font-semibold truncate">
                Assinatura Ativa — {planDisplay}
              </span>
            </>
          )}
        </div>
        <div className={`hidden sm:flex items-center space-x-2 text-[11px] ${
          isTrial ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
        }`}>
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Silagem Fácil Pro • Modo Completo</span>
        </div>
      </div>

    </div>
  );
};


