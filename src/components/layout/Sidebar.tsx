import React, { useState, useEffect } from 'react';
import { 
  Sun,
  Moon,
  Lock,
  Building,
  Home,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { CompanyProfile, SimulatedUserSession } from '../../types';
import { 
  ALL_MENU_ITEMS, 
  DEFAULT_MENU_ORDER, 
  MenuItemDef 
} from './ReorderMenuModal';
import { 
  getActiveUserSession, 
  isDefaultContadorRole,
  ModulePermissionKey 
} from '../../lib/cadastrosBaseStorage';
import { getStoredCompanyProfile } from '../../lib/storage';
import { useResolvedMediaUrl } from '../../lib/imageStorage';
import {
  getEffectiveModulesConfig,
  IMPERSONATED_MODULES_STORAGE_KEY,
  isModuleEnabledForSubscriber,
  SUBSCRIBER_MODULES_STORAGE_KEY,
  SUBSCRIBER_MODULES_UPDATED_EVENT,
} from '../../lib/subscriberModules';
import type { SubscriberModulesConfig } from '../../types/masterAdmin';

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
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
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
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const handleToggleCollapse = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    }
  };
  const [userSession, setUserSession] = useState<SimulatedUserSession>(() => getActiveUserSession());
  const [subscriberModulesConfig, setSubscriberModulesConfig] = useState<SubscriberModulesConfig>(
    () => getEffectiveModulesConfig(companyProfile)
  );

  interface ResolvedCompanyInfo {
    title: string;
    subtitle: string;
    logoUrl?: string;
    initials: string;
  }

  const resolveCompanyInfo = (
    propProfile?: CompanyProfile,
    explicitLogoOverride?: string,
    preferPropExplicitly = false
  ): ResolvedCompanyInfo => {
    let propTrade = '';
    let propCorp = '';
    let propSector = '';
    let propLogo = '';

    if (propProfile) {
      propTrade = String(
        propProfile.tradeName || (propProfile as any).nomeFantasia || ''
      ).trim();
      propCorp = String(
        propProfile.corporateName ||
          (propProfile as any).razaoSocial ||
          propProfile.companyName ||
          ''
      ).trim();
      propSector = String(
        propProfile.activitySector ||
          (propProfile as any).ramoAtividade ||
          (propProfile as any).setor ||
          ''
      ).trim();
      propLogo = String(propProfile.logoUrl || '').trim();
    }

    let storedTrade = '';
    let storedCorp = '';
    let storedSector = '';
    let storedLogo = '';
    try {
      const stored = getStoredCompanyProfile();
      if (stored) {
        storedTrade = String(stored.tradeName || (stored as any).nomeFantasia || '').trim();
        storedCorp = String(
          stored.corporateName || (stored as any).razaoSocial || stored.companyName || ''
        ).trim();
        storedSector = String(
          stored.activitySector || (stored as any).ramoAtividade || (stored as any).setor || ''
        ).trim();
        storedLogo = String(stored.logoUrl || '').trim();
      }
    } catch (_) {}

    let dadosTrade = '';
    let dadosCorp = '';
    let dadosSector = '';
    let dadosLogo = '';
    let lsLogo = '';
    try {
      if (typeof localStorage !== 'undefined') {
        const rawDados = localStorage.getItem('dadosEmpresa');
        if (rawDados) {
          const parsed = JSON.parse(rawDados);
          dadosTrade = String(parsed?.nomeFantasia || parsed?.tradeName || '').trim();
          dadosCorp = String(parsed?.razaoSocial || parsed?.corporateName || '').trim();
          dadosSector = String(parsed?.ramoAtividade || parsed?.activitySector || parsed?.setor || '').trim();
          dadosLogo = String(parsed?.logoUrl || '').trim();
        }
        lsLogo = String(localStorage.getItem('agrocontrol_empresa_logo') || '').trim();
      }
    } catch (_) {}

    const rawTrade = preferPropExplicitly && propProfile && ('tradeName' in propProfile || 'nomeFantasia' in propProfile)
      ? propTrade
      : propTrade || storedTrade || dadosTrade;
    const rawCorp = preferPropExplicitly && propProfile && ('corporateName' in propProfile || 'razaoSocial' in propProfile)
      ? propCorp
      : propCorp || storedCorp || dadosCorp;
    const rawSector = preferPropExplicitly && propProfile && ('activitySector' in propProfile || 'ramoAtividade' in propProfile || 'setor' in propProfile)
      ? propSector
      : propSector || storedSector || dadosSector;

    const sanitizePlaceholder = (val: string, placeholders: string[]) => {
      const clean = val.trim();
      if (!clean) return '';
      if (placeholders.includes(clean.toUpperCase())) return '';
      return clean;
    };

    const cleanTrade = sanitizePlaceholder(rawTrade, ['SUA EMPRESA AQUI', 'SISTEMA ERP OPERACIONAL']);
    const cleanCorp = sanitizePlaceholder(rawCorp, ['SUA EMPRESA AQUI', 'SISTEMA ERP OPERACIONAL']);
    const cleanSector = sanitizePlaceholder(rawSector, ['SUA EMPRESA AQUI', 'SISTEMA ERP OPERACIONAL']);

    // Linha Superior: Nome Fantasia cadastrado; fallback para Razão Social; fallback genérico apenas se ambos vazios
    const finalTitle = (cleanTrade || cleanCorp || 'SUA EMPRESA AQUI').toUpperCase();
    // Linha Inferior: Setor / Ramo de Atividade cadastrado; fallback padrão apenas se vazio
    const finalSubtitle = (cleanSector || 'SISTEMA ERP OPERACIONAL').toUpperCase();

    // Iniciais dinâmicas baseadas no título exibido
    let initials = 'SE';
    if (cleanTrade || cleanCorp) {
      const parts = finalTitle.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        initials = (parts[0][0] + parts[1][0]).toUpperCase();
      } else if (parts.length === 1) {
        initials = parts[0].slice(0, 2).toUpperCase();
      }
    }

    // Logo: respeita override explícito (ex: remoção da logo) ou busca em prop -> storage -> dadosEmpresa -> chave direta
    let finalLogo =
      explicitLogoOverride !== undefined
        ? explicitLogoOverride.trim()
        : propLogo || storedLogo || dadosLogo || lsLogo;

    if (
      finalLogo &&
      (finalLogo.includes('a7f3d0') ||
        finalLogo.includes('15803d') ||
        finalLogo.includes('viewBox="0 0 200 160"') ||
        finalLogo.startsWith('/upload/') ||
        finalLogo.startsWith('/_upload/') ||
        finalLogo.includes('/_upload/') ||
        finalLogo.includes('/upload/'))
    ) {
      finalLogo = '';
    }

    return {
      title: finalTitle,
      subtitle: finalSubtitle,
      logoUrl: finalLogo,
      initials,
    };
  };

  const [companyInfo, setCompanyInfo] = useState<ResolvedCompanyInfo>(() =>
    resolveCompanyInfo(companyProfile)
  );
  const resolvedSidebarLogo = useResolvedMediaUrl(companyInfo.logoUrl);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    setLogoError(false);
  }, [resolvedSidebarLogo]);

  useEffect(() => {
    setCompanyInfo(resolveCompanyInfo(companyProfile));
    setLogoError(false);
  }, [companyProfile]);

  useEffect(() => {
    let isMounted = true;
    const syncCompany = () => {
      queueMicrotask(() => {
        if (isMounted) {
          setCompanyInfo(resolveCompanyInfo(companyProfile));
          setLogoError(false);
        }
      });
    };

    const handleLiveCompanySync = (e: any) => {
      const detail = e?.detail;
      queueMicrotask(() => {
        if (!isMounted) return;
        if (detail && typeof detail === 'object') {
          const simulatedProfile = {
            corporateName: detail.corporateName ?? detail.razaoSocial ?? companyProfile?.corporateName ?? '',
            tradeName: detail.tradeName ?? detail.nomeFantasia ?? companyProfile?.tradeName ?? '',
            activitySector: detail.activitySector ?? detail.ramoAtividade ?? detail.setor ?? companyProfile?.activitySector ?? '',
            logoUrl: detail.logoUrl !== undefined ? detail.logoUrl : companyProfile?.logoUrl,
          } as CompanyProfile;
          const explicitLogo = detail.logoUrl !== undefined ? String(detail.logoUrl || '') : undefined;
          setCompanyInfo(resolveCompanyInfo(simulatedProfile, explicitLogo, true));
          setLogoError(false);
        } else {
          setCompanyInfo(resolveCompanyInfo(companyProfile));
          setLogoError(false);
        }
      });
    };

    const handleLogoSync = (e: any) => {
      const detail = e?.detail;
      queueMicrotask(() => {
        if (!isMounted) return;
        if (typeof detail === 'string') {
          setCompanyInfo(resolveCompanyInfo(companyProfile, detail));
          setLogoError(false);
        } else {
          setCompanyInfo(resolveCompanyInfo(companyProfile));
          setLogoError(false);
        }
      });
    };

    window.addEventListener('colaca_company_profile_live_change', handleLiveCompanySync);
    window.addEventListener('agrocontrol_company_profile_updated', handleLiveCompanySync);
    window.addEventListener('company_profile_updated', handleLiveCompanySync);
    window.addEventListener('agrocontrol_empresa_logo_updated', handleLogoSync);
    window.addEventListener('agrocontrol_logo_updated', handleLogoSync);
    window.addEventListener('storage', syncCompany);
    return () => {
      isMounted = false;
      window.removeEventListener('colaca_company_profile_live_change', handleLiveCompanySync);
      window.removeEventListener('agrocontrol_company_profile_updated', handleLiveCompanySync);
      window.removeEventListener('company_profile_updated', handleLiveCompanySync);
      window.removeEventListener('agrocontrol_empresa_logo_updated', handleLogoSync);
      window.removeEventListener('agrocontrol_logo_updated', handleLogoSync);
      window.removeEventListener('storage', syncCompany);
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
          if (!valid.includes('despesas')) {
            const finIndex = valid.indexOf('financeiro');
            if (finIndex !== -1) {
              valid.splice(finIndex + 1, 0, 'despesas');
            } else {
              valid.push('despesas');
            }
          }
          if (!valid.includes('fiscal')) {
            const finIndex = valid.indexOf('financeiro');
            const despIndex = valid.indexOf('despesas');
            const targetIdx = despIndex !== -1 ? despIndex : finIndex;
            if (targetIdx !== -1) {
              valid.splice(targetIdx + 1, 0, 'fiscal');
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
          if (!valid.includes('contador') || localStorage.getItem('agrocontrol_contador_menu_bottom_v1') !== 'true') {
            const withoutContador = valid.filter(id => id !== 'contador');
            const baseIndex = withoutContador.indexOf('cadastros_base');
            if (baseIndex !== -1) {
              withoutContador.splice(baseIndex + 1, 0, 'contador');
            } else {
              const configIndex = withoutContador.indexOf('configuracoes');
              if (configIndex !== -1) {
                withoutContador.splice(configIndex, 0, 'contador');
              } else {
                withoutContador.push('contador');
              }
            }
            valid.splice(0, valid.length, ...withoutContador);
            try {
              localStorage.setItem('agrocontrol_contador_menu_bottom_v1', 'true');
            } catch {}
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
    let isMounted = true;
    const handleSessionSync = (e: any) => {
      queueMicrotask(() => {
        if (!isMounted) return;
        if (e?.detail) {
          setUserSession(e.detail);
        } else {
          setUserSession(getActiveUserSession());
        }
      });
    };
    window.addEventListener('colaca_silagem_session_updated', handleSessionSync);
    window.addEventListener('storage', handleSessionSync);
    return () => {
      isMounted = false;
      window.removeEventListener('colaca_silagem_session_updated', handleSessionSync);
      window.removeEventListener('storage', handleSessionSync);
    };
  }, []);

  // Sincroniza módulos ativos do assinante (Perfil / Segmento configurado no Master Admin)
  useEffect(() => {
    let isMounted = true;
    const syncModules = () => {
      queueMicrotask(() => {
        if (!isMounted) return;
        setSubscriberModulesConfig(getEffectiveModulesConfig(companyProfile));
      });
    };

    if (isMounted) {
      setSubscriberModulesConfig(getEffectiveModulesConfig(companyProfile));
    }

    const handleStorageModules = (e: StorageEvent) => {
      if (
        !e.key ||
        e.key === SUBSCRIBER_MODULES_STORAGE_KEY ||
        e.key === IMPERSONATED_MODULES_STORAGE_KEY ||
        e.key === 'silagem_master_subscribers_v2' ||
        e.key === 'is_admin_impersonating' ||
        e.key === 'admin_impersonated_company_id'
      ) {
        syncModules();
      }
    };

    window.addEventListener(SUBSCRIBER_MODULES_UPDATED_EVENT, syncModules);
    window.addEventListener('master_admin_data_changed', syncModules);
    window.addEventListener('agrocontrol_company_profile_updated', syncModules);
    window.addEventListener('company_profile_updated', syncModules);
    window.addEventListener('storage', handleStorageModules);
    return () => {
      isMounted = false;
      window.removeEventListener(SUBSCRIBER_MODULES_UPDATED_EVENT, syncModules);
      window.removeEventListener('master_admin_data_changed', syncModules);
      window.removeEventListener('agrocontrol_company_profile_updated', syncModules);
      window.removeEventListener('company_profile_updated', syncModules);
      window.removeEventListener('storage', handleStorageModules);
    };
  }, [companyProfile]);

  useEffect(() => {
    let isMounted = true;
    const handleOrderSync = (e: any) => {
      queueMicrotask(() => {
        if (!isMounted) return;
        if (e.detail && Array.isArray(e.detail)) {
          setMenuOrder(e.detail);
        } else {
          try {
            const saved = localStorage.getItem('silagem_facil_sidebar_order');
            if (saved) setMenuOrder(JSON.parse(saved));
          } catch (err) {}
        }
      });
    };
    window.addEventListener('silagem_sidebar_order_changed', handleOrderSync);
    window.addEventListener('storage', handleOrderSync);
    return () => {
      isMounted = false;
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
    if (id === 'contador') return 'contador';
    if (id === 'configuracoes' || id === 'empresa') return 'empresa';
    return null;
  };

  // Ocultação estrita das abas conforme permissões do cargo na sessão ativa
  const isModuleHidden = (id: string): boolean => {
    if (userSession.type === 'admin') return false;
    const permKey = getModulePermissionKey(id);
    if (!permKey) return false;
    if (userSession.permissions && typeof userSession.permissions[permKey] === 'boolean') {
      return userSession.permissions[permKey] === false;
    }
    if (permKey === 'contador') {
      return !isDefaultContadorRole(userSession.cargoNome, userSession.setor);
    }
    return false;
  };

  const isModuleRestricted = isModuleHidden;

  // Redireciona caso a tela ativa seja ocultada pelo cargo ou desativada pelo perfil de segmento do assinante
  useEffect(() => {
    const blockedByRole = isModuleHidden(activeTab);
    const disabledBySegment = !isModuleEnabledForSubscriber(activeTab, subscriberModulesConfig);
    if (blockedByRole || disabledBySegment) {
      const timer = setTimeout(() => {
        setActiveTab('dashboard');
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [userSession, activeTab, subscriberModulesConfig]);

  const handleSelect = (tabId: string) => {
    if (!isModuleEnabledForSubscriber(tabId, subscriberModulesConfig)) {
      setActiveTab('dashboard');
      if (onCloseMobile) onCloseMobile();
      return;
    }

    // 4. TRAVA DE SEGURANÇA NA SIDEBAR (INTERCEPÇÃO VISUAL)
    if (isModuleHidden(tabId)) {
      setActiveTab(`acesso_restrito_${tabId}`);
      if (onCloseMobile) onCloseMobile();
      return;
    }

    setActiveTab(tabId);
    if (onCloseMobile) onCloseMobile();
  };

  // Build sorted navigation list
  const currentOrder = propMenuOrder || menuOrder;
  const navItems: MenuItemDef[] = currentOrder
    .map(id => ALL_MENU_ITEMS.find(m => m.id === id))
    .filter((item): item is MenuItemDef => Boolean(item));

  // 1. Menus principais (Dashboard até Cadastros Base) que ficam na lista com rolagem flexível
  // Oculta abas desativadas para o segmento do assinante e abas não permitidas para o cargo/colaborador selecionado
  const middleNavItems = navItems
    .filter(item => item.id !== 'configuracoes' && item.id !== 'empresa')
    .filter(item => isModuleEnabledForSubscriber(item.id, subscriberModulesConfig))
    .filter(item => !isModuleHidden(item.id));

  // 2. Estado de acesso do botão Dados da Empresa (fixado obrigatoriamente no rodapé)
  const isEmpresaRestricted = isModuleHidden('configuracoes');
  const isEmpresaActive = activeTab === 'configuracoes' || activeTab === 'empresa';

  // 3. Agrupamento lógico em 4 setores corporativos (preservando permissões e filtros de módulo)
  const SIDEBAR_GROUPS: { id: string; title: string; itemIds: string[] }[] = [
    {
      id: 'gestao',
      title: 'GESTÃO',
      itemIds: ['dashboard'],
    },
    {
      id: 'operacao_frota',
      title: 'OPERAÇÃO & FROTA',
      itemIds: ['servicos', 'venda', 'estoque', 'almoxarifado', 'frotas'],
    },
    {
      id: 'financeiro_fiscal',
      title: 'FINANCEIRO & FISCAL',
      itemIds: ['financeiro', 'despesas', 'fiscal', 'contador'],
    },
    {
      id: 'empresa_relatorios',
      title: 'EMPRESA & RELATÓRIOS',
      itemIds: ['rh', 'relatorios', 'clientes', 'fornecedores', 'cadastros_base'],
    },
  ];

  const groupedItemIds = new Set(SIDEBAR_GROUPS.flatMap((g) => g.itemIds));
  const extraVisibleItems = middleNavItems.filter((item) => !groupedItemIds.has(item.id));

  const visibleGroups = SIDEBAR_GROUPS.map((group) => {
    const items = group.itemIds
      .map((id) => middleNavItems.find((m) => m.id === id))
      .filter((item): item is MenuItemDef => Boolean(item));
    if (group.id === 'empresa_relatorios' && extraVisibleItems.length > 0) {
      items.push(...extraVisibleItems);
    }
    return { ...group, items };
  }).filter((group) => group.items.length > 0);

  const getDisplayLabel = (item: MenuItemDef): string => {
    switch (item.id) {
      case 'dashboard':
        return 'Dashboard';
      case 'servicos':
        return 'Prestação de Serviços';
      case 'venda':
        return 'Venda';
      case 'estoque':
        return 'Estoque';
      case 'almoxarifado':
        return 'Almoxarifado';
      case 'frotas':
        return 'Gestão de Frotas';
      case 'financeiro':
        return 'Financeiro';
      case 'despesas':
        return 'Despesas';
      case 'fiscal':
        return 'Fiscal & Notas';
      case 'contador':
        return 'Contador';
      case 'rh':
        return 'RH';
      case 'relatorios':
        return 'Relatórios';
      case 'clientes':
        return 'Clientes';
      case 'fornecedores':
        return 'Fornecedores & Transp.';
      case 'cadastros_base':
        return 'Cadastros & Configurações';
      default:
        return item.label;
    }
  };

  const getInactiveIconColor = (itemId: string): string => {
    switch (itemId) {
      case 'dashboard':
      case 'venda':
      case 'financeiro':
        return 'text-emerald-700 dark:text-emerald-400';
      case 'servicos':
      case 'frotas':
        return 'text-blue-700 dark:text-blue-400';
      case 'estoque':
      case 'almoxarifado':
      case 'despesas':
        return 'text-amber-700 dark:text-amber-400';
      case 'fiscal':
      case 'contador':
        return 'text-indigo-700 dark:text-indigo-400';
      case 'rh':
      case 'relatorios':
        return 'text-purple-700 dark:text-purple-400';
      case 'clientes':
      case 'fornecedores':
        return 'text-teal-700 dark:text-teal-400';
      case 'cadastros_base':
      default:
        return 'text-slate-700 dark:text-slate-300';
    }
  };

  return (
    <>
      <aside
        id="main-sidebar"
        className={`
          no-print absolute inset-y-0 left-0 z-40 ${isCollapsed ? 'w-16' : 'w-[15rem]'} bg-[#d4deee] dark:bg-stone-900 border-r border-black dark:border-stone-800 flex flex-col transition-all duration-200 ease-in-out h-full max-h-full overflow-hidden
          ${isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Cabeçalho Corporativo da Empresa & Controle de Tema/Recolhimento */}
        <header className="shrink-0 bg-[#cad4e6] dark:bg-stone-900 border-b border-black/25 dark:border-stone-800">
          {isCollapsed ? (
            <div className="p-2 flex flex-col items-center justify-center gap-1.5">
              <div
                className="cursor-pointer"
                onClick={() => handleSelect('home')}
                title={`${companyInfo.title} — Tela Inicial`}
              >
                {resolvedSidebarLogo && !logoError ? (
                  <div className="w-8 h-8 rounded-lg bg-white dark:bg-emerald-950/60 border border-black/30 dark:border-emerald-700 p-0.5 flex items-center justify-center shadow-xs shrink-0 overflow-hidden">
                    <img
                      src={resolvedSidebarLogo}
                      alt="Logo"
                      className="max-w-full max-h-full object-contain"
                      referrerPolicy="no-referrer"
                      onError={() => {
                        queueMicrotask(() => setLogoError(true));
                      }}
                    />
                  </div>
                ) : (
                  <div
                    className="w-8 h-8 rounded-lg bg-[#e0e6f1] dark:bg-stone-800 border border-black/40 dark:border-stone-600 flex items-center justify-center shrink-0 select-none transition-transform hover:scale-105"
                    title={companyInfo.title}
                  >
                    <span className="text-emerald-800 dark:text-emerald-400 font-black text-[11px] tracking-tight">
                      {companyInfo.initials}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1">
                <button
                  id="btn-expand-sidebar-toggle"
                  type="button"
                  onClick={handleToggleCollapse}
                  title="Expandir Menu Lateral"
                  aria-label="Expandir Menu Lateral"
                  className="p-1 rounded bg-[#e0e6f1] dark:bg-stone-800 hover:bg-[#bccae2] dark:hover:bg-stone-700 text-slate-800 dark:text-stone-200 transition cursor-pointer shrink-0 border border-black/30 dark:border-stone-700"
                >
                  <PanelLeftOpen className="w-3.5 h-3.5" />
                </button>
                {setIsDarkMode && (
                  <button
                    id="btn-theme-toggle"
                    type="button"
                    onClick={() => setIsDarkMode((prev) => !prev)}
                    title={isDarkMode ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
                    aria-label="Alternar tema claro e escuro"
                    className="p-1 rounded bg-[#e0e6f1] dark:bg-stone-800 hover:bg-[#bccae2] dark:hover:bg-stone-700 text-slate-800 dark:text-stone-200 transition cursor-pointer shrink-0 border border-black/30 dark:border-stone-700"
                  >
                    {isDarkMode ? (
                      <Sun className="w-3.5 h-3.5 text-amber-300" />
                    ) : (
                      <Moon className="w-3.5 h-3.5 text-slate-700" />
                    )}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="px-2.5 py-2 flex items-center justify-between gap-1.5">
              <div
                className="flex items-center space-x-2 cursor-pointer min-w-0 flex-1 group"
                onClick={() => handleSelect('home')}
                title={`${companyInfo.title} — Voltar para Tela Inicial`}
              >
                {resolvedSidebarLogo && !logoError ? (
                  <div className="w-9 h-9 rounded-lg bg-white dark:bg-emerald-950/60 border border-black/30 dark:border-emerald-700 p-1 flex items-center justify-center shadow-xs shrink-0 overflow-hidden">
                    <img
                      src={resolvedSidebarLogo}
                      alt="Logo"
                      className="max-w-full max-h-full object-contain"
                      referrerPolicy="no-referrer"
                      onError={() => {
                        queueMicrotask(() => setLogoError(true));
                      }}
                    />
                  </div>
                ) : (
                  <div
                    className="w-9 h-9 rounded-lg bg-[#e0e6f1] dark:bg-stone-800 border border-black/40 dark:border-stone-600 flex items-center justify-center shrink-0 select-none transition-transform group-hover:scale-105"
                    title={`${companyInfo.title} (${companyInfo.initials})`}
                  >
                    <span className="text-emerald-800 dark:text-emerald-400 font-black text-xs tracking-tight">
                      {companyInfo.initials}
                    </span>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h2
                    className="text-xs font-extrabold text-slate-900 dark:text-white truncate tracking-tight font-['Outfit'] group-hover:text-emerald-800 dark:group-hover:text-emerald-400 transition-colors"
                    title={companyInfo.title}
                  >
                    {companyInfo.title}
                  </h2>
                  <p
                    className="text-[9px] font-bold text-emerald-800 dark:text-emerald-400 tracking-wider uppercase truncate"
                    title={companyInfo.subtitle}
                  >
                    {companyInfo.subtitle}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {setIsDarkMode && (
                  <button
                    id="btn-theme-toggle"
                    type="button"
                    onClick={() => setIsDarkMode((prev) => !prev)}
                    title={isDarkMode ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
                    aria-label="Alternar tema claro e escuro"
                    className="p-1.5 rounded bg-[#e0e6f1] dark:bg-stone-800 hover:bg-[#bccae2] dark:hover:bg-stone-700 text-slate-800 dark:text-stone-200 transition cursor-pointer border border-black/25 dark:border-stone-700"
                  >
                    {isDarkMode ? (
                      <Sun className="w-3.5 h-3.5 text-amber-300" />
                    ) : (
                      <Moon className="w-3.5 h-3.5 text-slate-700" />
                    )}
                  </button>
                )}

                <button
                  id="btn-collapse-sidebar-toggle"
                  type="button"
                  onClick={handleToggleCollapse}
                  title="Recolher Menu Lateral"
                  aria-label="Recolher Menu Lateral"
                  className="p-1.5 rounded bg-[#e0e6f1] dark:bg-stone-800 hover:bg-[#bccae2] dark:hover:bg-stone-700 text-slate-800 dark:text-stone-200 transition cursor-pointer border border-black/25 dark:border-stone-700"
                >
                  <PanelLeftClose className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </header>

        {/* Lista Única Limpa Sem Micro-Títulos de Grupo (Apenas Divisórias Sutis) */}
        <nav
          aria-label="Menu Principal"
          className="flex-1 min-h-0 overflow-y-auto scrollbar-none py-1.5"
        >
          {!isCollapsed && (
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-stone-400 px-3 pt-1 pb-1.5 select-none">
              MENU PRINCIPAL
            </div>
          )}

          {visibleGroups.map((group, groupIdx) => (
            <div key={group.id}>
              {groupIdx > 0 && (
                <div className="border-t border-black/15 dark:border-stone-700/80 my-1.5 mx-2.5" />
              )}

              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isRestricted = isModuleRestricted(item.id);
                  const displayLabel = getDisplayLabel(item);

                  const isCadastrosBaseActive =
                    item.id === 'cadastros_base' &&
                    (activeTab === 'cadastros_base' ||
                      activeTab.startsWith('cadastros_base_') ||
                      ['centros_custo', 'plano_contas', 'cargos_permissoes'].includes(activeTab));

                  const isActive =
                    isCadastrosBaseActive ||
                    activeTab === item.id ||
                    (item.id === 'venda' && (activeTab === 'venda' || activeTab === 'vendas')) ||
                    (item.id === 'financeiro' &&
                      ['financeiro', 'contas', 'bancos', 'pagar', 'receber'].includes(activeTab)) ||
                    (item.id === 'fiscal' &&
                      (activeTab === 'nfe_notas' ||
                        activeTab === 'nfe_importar' ||
                        activeTab === 'documentos_entrada' ||
                        activeTab === 'entradas')) ||
                    (item.id === 'frotas' &&
                      [
                        'frota',
                        'veiculos',
                        'manutencoes',
                        'combustivel',
                        'motoristas',
                        'equipe',
                        'rodizio',
                        'rodizio_pneus',
                      ].includes(activeTab)) ||
                    (item.id === 'rh' && (activeTab === 'funcionarios' || activeTab === 'rh'));

                  return (
                    <button
                      key={item.id}
                      id={`sidebar-nav-${item.id}`}
                      type="button"
                      onClick={() => handleSelect(item.id)}
                      title={
                        isRestricted
                          ? `${displayLabel} (Acesso Bloqueado)`
                          : displayLabel
                      }
                      className={`
                        ${
                          isCollapsed
                            ? 'mx-auto w-10 justify-center px-1.5 py-2'
                            : 'w-[calc(100%-1rem)] mx-2 justify-between px-3 py-2'
                        }
                        rounded-md text-xs transition-all flex items-center cursor-pointer group select-none
                        ${
                          isRestricted
                            ? 'bg-rose-50/70 text-slate-600 dark:bg-rose-950/20 dark:text-stone-400 hover:bg-rose-100/80 border border-dashed border-rose-400/70 font-semibold'
                            : isActive
                              ? 'bg-emerald-700 text-white border border-black shadow-sm font-bold'
                              : 'hover:bg-[#bccae2] dark:hover:bg-stone-800 text-slate-800 dark:text-stone-200 border border-transparent font-semibold'
                        }
                      `}
                    >
                      <span
                        className={`flex items-center ${
                          isCollapsed ? 'justify-center' : 'gap-2.5 min-w-0'
                        }`}
                      >
                        <Icon
                          className={`w-4 h-4 shrink-0 transition-colors ${
                            isRestricted
                              ? 'text-rose-500'
                              : isActive
                                ? 'text-white'
                                : getInactiveIconColor(item.id)
                          }`}
                        />
                        {!isCollapsed && (
                          <span className="truncate leading-tight">{displayLabel}</span>
                        )}
                      </span>

                      {!isCollapsed && isRestricted && (
                        <span title="Acesso bloqueado para este cargo" className="shrink-0">
                          <Lock className="w-3.5 h-3.5 text-rose-500" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Rodapé Corporativo: Mini-Card de Status + Atalho Tela Inicial + Dados da Empresa */}
        <footer className="mt-auto shrink-0 flex flex-col bg-[#d4deee] dark:bg-stone-900">
          {/* Mini-Card Compacto de Status & Atalho Tela Inicial */}
          {isCollapsed ? (
            <div className="px-2 pb-2 flex flex-col items-center gap-1.5">
              <button
                id="sidebar-nav-home-trigger"
                type="button"
                onClick={() => handleSelect('home')}
                title="Base Sincronizada • Ir para Tela Inicial"
                className={`relative w-10 h-8 rounded-md border flex items-center justify-center transition-all cursor-pointer ${
                  activeTab === 'home'
                    ? 'bg-emerald-700 text-white border-black shadow-sm'
                    : 'bg-[#e0e6f1] hover:bg-[#bccae2] dark:bg-stone-800 dark:hover:bg-stone-700 text-slate-800 dark:text-stone-200 border-black/40 dark:border-stone-700'
                }`}
              >
                <Home className="w-4 h-4" />
                <span
                  className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-black/40"
                  aria-hidden="true"
                />
              </button>
            </div>
          ) : (
            <div className="mx-2 mb-2 p-2 rounded-md bg-[#e0e6f1] dark:bg-stone-800/90 border border-black/40 dark:border-stone-700 text-[10px] flex flex-col gap-1.5 shadow-2xs">
              <div className="flex items-center justify-between gap-1.5 text-slate-700 dark:text-stone-300 font-semibold">
                <span className="inline-flex items-center gap-1.5 truncate">
                  <span
                    className="w-2 h-2 rounded-full bg-emerald-600 shrink-0 shadow-[0_0_0_2px_rgba(16,185,129,0.2)]"
                    aria-hidden="true"
                  />
                  <span className="truncate">Base Sincronizada</span>
                </span>
                <span className="text-[9px] font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-400 shrink-0">
                  Online
                </span>
              </div>

              <button
                id="sidebar-nav-home-trigger"
                type="button"
                onClick={() => handleSelect('home')}
                title="Voltar para a Tela Inicial"
                className={`w-full flex items-center justify-center gap-1.5 py-1 px-2 rounded text-[10px] font-bold transition-all cursor-pointer border ${
                  activeTab === 'home'
                    ? 'bg-emerald-700 text-white border-black shadow-2xs'
                    : 'bg-[#cad4e6] hover:bg-[#bccae2] dark:bg-stone-700 dark:hover:bg-stone-600 text-slate-900 dark:text-stone-100 border-black/30 dark:border-stone-600'
                }`}
              >
                <Home className="w-3 h-3 shrink-0" />
                <span>Tela Inicial</span>
              </button>
            </div>
          )}

          {/* Botão Fixo na Base: DADOS DA EMPRESA */}
          {!isEmpresaRestricted && (
            <button
              id="sidebar-nav-configuracoes"
              type="button"
              onClick={() => handleSelect('configuracoes')}
              title="Dados da Empresa"
              className={`
                w-full flex items-center ${
                  isCollapsed ? 'justify-center px-2' : 'justify-between px-3'
                } py-2.5 text-xs uppercase tracking-wider font-bold border-t border-black dark:border-stone-700 transition-colors cursor-pointer select-none
                ${
                  isEmpresaActive
                    ? 'bg-emerald-700 text-white'
                    : 'bg-[#cad4e6] hover:bg-[#b8c6de] dark:bg-stone-900 dark:hover:bg-stone-800 text-slate-900 dark:text-stone-100'
                }
              `}
            >
              <span
                className={`flex items-center ${
                  isCollapsed ? 'justify-center' : 'gap-2.5 truncate'
                }`}
              >
                <Building
                  className={`w-4 h-4 shrink-0 ${
                    isEmpresaActive
                      ? 'text-white'
                      : 'text-slate-800 dark:text-stone-300'
                  }`}
                />
                {!isCollapsed && <span className="truncate">Dados da Empresa</span>}
              </span>
            </button>
          )}
        </footer>
      </aside>
    </>
  );
};
