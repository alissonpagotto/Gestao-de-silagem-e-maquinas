import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { SiteConfig, PlanDefinition } from '../types/masterAdmin';
import { 
  DEFAULT_SITE_CONFIG, 
  DEFAULT_PLANS, 
  getStoredSiteConfig, 
  saveStoredSiteConfig, 
  getStoredPlans, 
  saveStoredPlans,
  AGROCONTROL_SITE_SETTINGS_KEY,
  AGROCONTROL_PLANS_DATA_KEY
} from '../lib/masterAdminStorage';

export { AGROCONTROL_SITE_SETTINGS_KEY, AGROCONTROL_PLANS_DATA_KEY };

interface AppStateContextType {
  siteConfig: SiteConfig;
  plans: PlanDefinition[];
  updateSiteConfig: (newConfig: Partial<SiteConfig> | SiteConfig) => void;
  updatePlans: (newPlans: PlanDefinition[]) => void;
  reloadFromStorage: () => void;
}

const AppStateContext = createContext<AppStateContextType | undefined>(undefined);

export const AppStateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Leitura inicial dinâmica das duas chaves obrigatórias com fallback
  const [siteConfig, setSiteConfig] = useState<SiteConfig>(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(AGROCONTROL_SITE_SETTINGS_KEY) || localStorage.getItem('landingPageSettings');
        if (raw) {
          const parsed = JSON.parse(raw);
          return { ...DEFAULT_SITE_CONFIG, ...parsed };
        }
      }
    } catch (e) {
      console.error('Erro ao ler agrocontrol_site_settings na inicialização do context:', e);
    }
    return getStoredSiteConfig();
  });

  const [plans, setPlans] = useState<PlanDefinition[]>(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(AGROCONTROL_PLANS_DATA_KEY) || localStorage.getItem('silagem_master_plans_v1');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      }
    } catch (e) {
      console.error('Erro ao ler agrocontrol_plans_data na inicialização do context:', e);
    }
    return getStoredPlans();
  });

  // Função centralizada para recarregar do localStorage
  const reloadFromStorage = useCallback(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        // 1. Recarrega configurações do site
        const rawSite = localStorage.getItem(AGROCONTROL_SITE_SETTINGS_KEY) || localStorage.getItem('landingPageSettings');
        if (rawSite) {
          const parsedSite = JSON.parse(rawSite);
          setSiteConfig({ ...DEFAULT_SITE_CONFIG, ...parsedSite });
        } else {
          setSiteConfig(getStoredSiteConfig());
        }

        // 2. Recarrega lista de planos
        const rawPlans = localStorage.getItem(AGROCONTROL_PLANS_DATA_KEY) || localStorage.getItem('silagem_master_plans_v1');
        if (rawPlans) {
          const parsedPlans = JSON.parse(rawPlans);
          if (Array.isArray(parsedPlans) && parsedPlans.length > 0) {
            setPlans(parsedPlans);
          } else {
            setPlans(getStoredPlans());
          }
        } else {
          setPlans(getStoredPlans());
        }
      }
    } catch (err) {
      console.error('Erro ao recarregar dados no AppStateContext:', err);
      setSiteConfig(getStoredSiteConfig());
      setPlans(getStoredPlans());
    }
  }, []);

  // Atualização persistente de Configurações do Site
  const updateSiteConfig = useCallback((newConfig: Partial<SiteConfig> | SiteConfig) => {
    setSiteConfig((prev) => {
      const merged: SiteConfig = { ...prev, ...newConfig };
      try {
        if (typeof localStorage !== 'undefined') {
          const serialized = JSON.stringify(merged);
          localStorage.setItem(AGROCONTROL_SITE_SETTINGS_KEY, serialized);
          localStorage.setItem('landingPageSettings', serialized);
          localStorage.setItem('silagem_master_site_config_v1', serialized);
        }
        saveStoredSiteConfig(merged);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('agrocontrol_site_settings_updated', { detail: merged }));
          window.dispatchEvent(new CustomEvent('landing_page_settings_updated', { detail: merged }));
          window.dispatchEvent(new CustomEvent('master_admin_data_changed', { detail: merged }));
        }
      } catch (e) {
        console.error('Erro ao salvar agrocontrol_site_settings no context:', e);
      }
      return merged;
    });
  }, []);

  // Atualização persistente da lista de Planos
  const updatePlans = useCallback((newPlans: PlanDefinition[]) => {
    const sorted = [...newPlans].sort((a, b) => a.displayOrder - b.displayOrder);
    setPlans(sorted);
    try {
      if (typeof localStorage !== 'undefined') {
        const serialized = JSON.stringify(sorted);
        localStorage.setItem(AGROCONTROL_PLANS_DATA_KEY, serialized);
        localStorage.setItem('silagem_master_plans_v1', serialized);
      }
      saveStoredPlans(sorted);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('agrocontrol_plans_updated', { detail: sorted }));
        window.dispatchEvent(new CustomEvent('master_admin_data_changed', { detail: sorted }));
      }
    } catch (e) {
      console.error('Erro ao salvar agrocontrol_plans_data no context:', e);
    }
  }, []);

  // Sincronização em tempo real obrigatória
  useEffect(() => {
    // 1. Carga inicial garantida na montagem
    reloadFromStorage();

    // 2. Listener do evento nativo 'storage' da window para sincronia entre abas
    const handleStorageEvent = (e: StorageEvent) => {
      if (
        e.key === AGROCONTROL_SITE_SETTINGS_KEY || 
        e.key === 'landingPageSettings' || 
        e.key === 'silagem_master_site_config_v1'
      ) {
        if (e.newValue) {
          try {
            const parsed = JSON.parse(e.newValue);
            setSiteConfig((prev) => ({ ...prev, ...parsed }));
          } catch {
            reloadFromStorage();
          }
        } else {
          reloadFromStorage();
        }
      }

      if (
        e.key === AGROCONTROL_PLANS_DATA_KEY || 
        e.key === 'silagem_master_plans_v1'
      ) {
        if (e.newValue) {
          try {
            const parsed = JSON.parse(e.newValue);
            if (Array.isArray(parsed)) {
              setPlans(parsed);
            }
          } catch {
            reloadFromStorage();
          }
        } else {
          reloadFromStorage();
        }
      }
    };

    // 3. Listeners de CustomEvents para sincronia na mesma janela
    const handleSiteSettingsEvent = (e: any) => {
      if (e?.detail) {
        setSiteConfig((prev) => ({ ...prev, ...e.detail }));
      } else {
        reloadFromStorage();
      }
    };

    const handlePlansEvent = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setPlans(e.detail);
      } else {
        reloadFromStorage();
      }
    };

    const handleMasterAdminChanged = (e: any) => {
      if (e?.detail) {
        if (Array.isArray(e.detail)) {
          setPlans(e.detail);
        } else if (typeof e.detail === 'object') {
          setSiteConfig((prev) => ({ ...prev, ...e.detail }));
        }
      } else {
        reloadFromStorage();
      }
    };

    window.addEventListener('storage', handleStorageEvent);
    window.addEventListener('agrocontrol_site_settings_updated', handleSiteSettingsEvent);
    window.addEventListener('landing_page_settings_updated', handleSiteSettingsEvent);
    window.addEventListener('agrocontrol_plans_updated', handlePlansEvent);
    window.addEventListener('master_admin_data_changed', handleMasterAdminChanged);

    return () => {
      window.removeEventListener('storage', handleStorageEvent);
      window.removeEventListener('agrocontrol_site_settings_updated', handleSiteSettingsEvent);
      window.removeEventListener('landing_page_settings_updated', handleSiteSettingsEvent);
      window.removeEventListener('agrocontrol_plans_updated', handlePlansEvent);
      window.removeEventListener('master_admin_data_changed', handleMasterAdminChanged);
    };
  }, [reloadFromStorage]);

  return (
    <AppStateContext.Provider
      value={{
        siteConfig,
        plans,
        updateSiteConfig,
        updatePlans,
        reloadFromStorage,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
};

export const useAppState = (): AppStateContextType => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
};
