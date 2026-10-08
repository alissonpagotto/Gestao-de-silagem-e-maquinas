import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { CompanyProfile } from '../../types';
import { getStoredCompanyProfile } from '../../lib/storage';

export interface MainLayoutProps {
  children?: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  companyProfile?: CompanyProfile;
  isDarkMode?: boolean;
  setIsDarkMode?: (val: boolean | ((prev: boolean) => boolean)) => void;
  onLogout?: () => void;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  activeTab,
  setActiveTab,
  companyProfile,
  isDarkMode,
  setIsDarkMode,
  onLogout
}) => {
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
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    const syncDados = () => {
      setDadosEmpresa(getResolvedDadosEmpresa());
    };

    const handleLiveSync = (e: any) => {
      const sector = e.detail?.ramoAtividade || e.detail?.activitySector;
      if (typeof sector === 'string') {
        setDadosEmpresa({ ramoAtividade: sector });
      } else {
        syncDados();
      }
    };

    window.addEventListener('colaca_company_profile_live_change', handleLiveSync);
    window.addEventListener('storage', syncDados);
    return () => {
      window.removeEventListener('colaca_company_profile_live_change', handleLiveSync);
      window.removeEventListener('storage', syncDados);
    };
  }, [companyProfile]);

  return (
    <div id="main-layout-container" className="h-screen w-screen overflow-hidden flex flex-col bg-zinc-100 dark:bg-stone-950">
      <TopBar onOpenMobileMenu={() => setIsMobileSidebarOpen(true)} />
      <div className="flex-1 w-full min-h-0 relative flex flex-row overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isOpenMobile={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          companyProfile={companyProfile}
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
          onLogout={onLogout}
        />
        <main id="main-layout-content" className="lg:pl-64 flex flex-col flex-1 h-full min-h-0 w-full overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
