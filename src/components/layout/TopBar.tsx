import React, { useMemo } from 'react';
import { 
  AlertTriangle, 
  Menu,
  Sparkles
} from 'lucide-react';
import { getStoredCompanyProfile } from '../../lib/storage';

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
  const planDisplay = (subscriptionPlanName && subscriptionPlanName !== 'Silagem Fácil Pro'
    ? subscriptionPlanName
    : 'PRODUTOR ESSENCIAL').toUpperCase();

  const companyProfile = useMemo(() => getStoredCompanyProfile(), []);

  const currentFormattedDate = useMemo(() => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    return `${day}/${month}/${year}`;
  }, []);

  const activeCorporateName = useMemo(() => {
    const raw = companyProfile?.corporateName || companyProfile?.companyName;
    if (!raw || raw.trim() === '' || raw.trim().toLowerCase() === 'silagem fácil') {
      return 'COLAÇA SILAGEM LTDA';
    }
    return raw.trim().toUpperCase();
  }, [companyProfile]);

  const activeTradeName = useMemo(() => {
    const raw = companyProfile?.tradeName || companyProfile?.activitySector;
    if (!raw || raw.trim() === '' || raw.trim().toLowerCase() === 'gestão de silagem' || raw.trim().toLowerCase() === 'silagem fácil') {
      return 'COLAÇA SILAGEM';
    }
    return raw.trim().toUpperCase();
  }, [companyProfile]);

  return (
    <div id="top-bar-container" className="no-print sticky top-0 z-30 shadow-xs">
      {/* Top Banner: Sequência oficial simplificada em linha única */}
      <div className={`border-b px-3 sm:px-4 py-1.5 flex items-center justify-between text-xs transition-colors font-mono uppercase text-[11px] font-semibold tracking-tight ${
        isTrial 
          ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300'
          : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300'
      }`}>
        <div className="flex items-center space-x-1.5 truncate min-w-0">
          {/* Mobile menu trigger */}
          <button
            onClick={onOpenMobileMenu}
            className={`lg:hidden p-1 rounded-md transition cursor-pointer shrink-0 ${
              isTrial
                ? 'text-rose-700 dark:text-rose-300 hover:bg-rose-200/50 dark:hover:bg-rose-900/50'
                : 'text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200/50 dark:hover:bg-emerald-900/50'
            }`}
            aria-label="Abrir Menu"
          >
            <Menu className="w-4 h-4" />
          </button>
          
          <span className="whitespace-nowrap shrink-0">
            GESTAO DE SILAGEM E VEICULOS - VERSÃO:1.0.3 - {currentFormattedDate} - {activeCorporateName} - {activeTradeName} -{' '}
            <span className="text-emerald-700 dark:text-emerald-400 font-bold">
              *ASSINATURA ATIVA
            </span>
          </span>
        </div>

        <div className={`hidden sm:flex items-center space-x-2 text-[11px] shrink-0 ${
          isTrial ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
        }`}>
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>PRO</span>
        </div>
      </div>
    </div>
  );
};


