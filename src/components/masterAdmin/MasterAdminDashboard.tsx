import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  DollarSign, 
  Search, 
  Plus, 
  Layers, 
  Globe, 
  Settings, 
  Edit, 
  Trash2, 
  Eye, 
  ExternalLink, 
  ShieldCheck, 
  Sparkles, 
  Webhook, 
  Mail, 
  Key, 
  ArrowLeft,
  Save,
  Check,
  Building2,
  RefreshCw,
  Lock,
  ChevronRight,
  LogOut,
  Database,
  Pause,
  Play,
  Package,
  Calendar,
  Tag,
  BarChart3,
  Menu,
  X
} from 'lucide-react';
import { 
  Subscriber, 
  SiteConfig, 
  PlanDefinition, 
  AdminSettings, 
  SubscriberStatus,
  MasterSession
} from '../../types/masterAdmin';
import { 
  getStoredSubscribers, 
  saveStoredSubscribers,
  getStoredSiteConfig, 
  saveStoredSiteConfig,
  getStoredPlans, 
  saveStoredPlans,
  getStoredAdminSettings, 
  saveStoredAdminSettings,
  computeMasterMetrics,
  getStoredMasterSession,
  clearStoredMasterSession,
  AGROCONTROL_PLANS_DATA_KEY,
  AGROCONTROL_SITE_SETTINGS_KEY,
  syncMasterAdminFromCloud
} from '../../lib/masterAdminStorage';
import {
  deleteCloudPlan,
  deleteCloudSubscriber,
  subscribeToCloudTable,
  fetchCloudSubscribers,
  fetchCloudPlans,
  fetchCloudSiteConfig,
  updateCloudSubscriberStatus,
  upsertCloudSubscriber
} from '../../lib/supabaseService';
import { EditSubscriberModal } from './EditSubscriberModal';
import { SubscriberDetailModal } from './SubscriberDetailModal';
import { PlanModal } from './PlanModal';
import { ResetPasswordModal } from './ResetPasswordModal';
import { ChangePlanModal } from './ChangePlanModal';
import { ExtendTrialModal } from './ExtendTrialModal';
import { PauseSubscriberModal } from './PauseSubscriberModal';
import { MasterAdminLogin } from './MasterAdminLogin';
import { ImageUploadField } from './ImageUploadField';
import { formatCurrencyBRL } from '../../lib/formatters';

interface MasterAdminDashboardProps {
  onBackToApp: () => void;
  onOpenLandingPage: () => void;
  onImpersonate?: (subscriber: Subscriber) => void;
}

export const MasterAdminDashboard: React.FC<MasterAdminDashboardProps> = ({
  onBackToApp,
  onOpenLandingPage,
  onImpersonate,
}) => {
  // Estado de Sessão Autenticada de Super Admin
  const [session, setSession] = useState<MasterSession | null>(() => {
    const s = getStoredMasterSession();
    if (!s) return null;
    const currentSettings = getStoredAdminSettings();
    const isSuperAdmin = (currentSettings.superAdminEmails || []).some(
      (email) => email.trim().toLowerCase() === s.email.trim().toLowerCase()
    );
    return isSuperAdmin ? s : null;
  });

  // Estados Principais de Dados
  const [subscribers, setSubscribers] = useState<Subscriber[]>(() => getStoredSubscribers());
  const [siteConfig, setSiteConfig] = useState<SiteConfig>(() => getStoredSiteConfig());
  const [plans, setPlans] = useState<PlanDefinition[]>(() => getStoredPlans());
  const [settings, setSettings] = useState<AdminSettings>(() => getStoredAdminSettings());
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);

  // Estados dos Novos Modais de Ações Rápidas
  const [resetPasswordSubscriber, setResetPasswordSubscriber] = useState<Subscriber | null>(null);
  const [changePlanSubscriber, setChangePlanSubscriber] = useState<Subscriber | null>(null);
  const [extendTrialSubscriber, setExtendTrialSubscriber] = useState<Subscriber | null>(null);
  const [pauseModalSubscriber, setPauseModalSubscriber] = useState<Subscriber | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4500);
  };

  const handleManualCloudSync = async () => {
    setIsSyncingCloud(true);
    try {
      const cloudData = await syncMasterAdminFromCloud();
      if (cloudData.subscribers) setSubscribers(cloudData.subscribers);
      if (cloudData.siteConfig) setSiteConfig(cloudData.siteConfig);
      if (cloudData.plans) setPlans(cloudData.plans);
    } finally {
      setIsSyncingCloud(false);
    }
  };

  // Aba ativa do Painel Mestre
  const [adminTab, setAdminTab] = useState<'assinantes' | 'planos' | 'site' | 'configuracoes'>('assinantes');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Filtros da Tabela de Assinantes
  const [statusFilter, setStatusFilter] = useState<'todas' | SubscriberStatus>('todas');
  const [searchQuery, setSearchQuery] = useState('');

  // Modais de Assinantes e Planos
  const [isEditSubscriberOpen, setIsEditSubscriberOpen] = useState(false);
  const [editingSubscriber, setEditingSubscriber] = useState<Subscriber | null>(null);
  const [isDetailSubscriberOpen, setIsDetailSubscriberOpen] = useState(false);
  const [viewingSubscriber, setViewingSubscriber] = useState<Subscriber | null>(null);

  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanDefinition | null>(null);

  // Estados dos formulários de Site Config e Configurações Gerais
  const [siteForm, setSiteForm] = useState<SiteConfig>(siteConfig);
  const [siteSaveSuccess, setSiteSaveSuccess] = useState(false);

  const [settingsForm, setSettingsForm] = useState<AdminSettings>(settings);
  const [newSuperAdminEmail, setNewSuperAdminEmail] = useState('');
  const [settingsSaveSuccess, setSettingsSaveSuccess] = useState(false);

  // Sincronização e Reatividade
  useEffect(() => {
    let isMounted = true;

    const handleSync = () => {
      setSubscribers(getStoredSubscribers());
      const freshConfig = getStoredSiteConfig();
      setSiteConfig(freshConfig);
      setPlans(getStoredPlans());
      setSettings(getStoredAdminSettings());
    };

    // Sincronização inicial com o Supabase Cloud
    syncMasterAdminFromCloud().then(cloudData => {
      if (!isMounted) return;
      if (cloudData.subscribers) setSubscribers(cloudData.subscribers);
      if (cloudData.siteConfig) setSiteConfig(cloudData.siteConfig);
      if (cloudData.plans && cloudData.plans.length > 0) setPlans(cloudData.plans);
    });

    // Assinaturas Realtime para que alterações feitas por outros administradores ou novos cadastros apareçam na hora
    const unsubSubs = subscribeToCloudTable('subscribers', () => {
      fetchCloudSubscribers().then(freshSubs => {
        if (freshSubs && isMounted) setSubscribers(freshSubs);
      });
    });

    const unsubPlans = subscribeToCloudTable('plans', () => {
      fetchCloudPlans().then(freshPlans => {
        if (freshPlans && freshPlans.length > 0 && isMounted) setPlans(freshPlans);
      });
    });

    const unsubSite = subscribeToCloudTable('site_settings', () => {
      fetchCloudSiteConfig().then(freshSite => {
        if (freshSite && isMounted) setSiteConfig(freshSite);
      });
    });

    const handleStorage = (e: StorageEvent) => {
      if (
        e.key === AGROCONTROL_PLANS_DATA_KEY ||
        e.key === 'silagem_master_plans_v1' ||
        e.key === AGROCONTROL_SITE_SETTINGS_KEY ||
        e.key === 'landingPageSettings' ||
        e.key === 'silagem_master_site_config_v1'
      ) {
        handleSync();
      }
    };

    window.addEventListener('master_admin_data_changed', handleSync);
    window.addEventListener('agrocontrol_site_settings_updated', handleSync);
    window.addEventListener('landing_page_settings_updated', handleSync);
    window.addEventListener('agrocontrol_plans_updated', handleSync);
    window.addEventListener('storage', handleStorage);
    return () => {
      isMounted = false;
      unsubSubs();
      unsubPlans();
      unsubSite();
      window.removeEventListener('master_admin_data_changed', handleSync);
      window.removeEventListener('agrocontrol_site_settings_updated', handleSync);
      window.removeEventListener('landing_page_settings_updated', handleSync);
      window.removeEventListener('agrocontrol_plans_updated', handleSync);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Sincroniza o formulário do site sempre que a aba 'site' for acessada
  useEffect(() => {
    if (adminTab === 'site') {
      const freshConfig = getStoredSiteConfig();
      setSiteForm(freshConfig);
    }
  }, [adminTab]);

  // Recalcular métricas em tempo real
  const metrics = useMemo(() => {
    return computeMasterMetrics(subscribers);
  }, [subscribers]);

  // Filtrar assinantes instantaneamente por status e busca
  const filteredSubscribers = useMemo(() => {
    return subscribers.filter(sub => {
      if (statusFilter !== 'todas' && sub.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = sub.name.toLowerCase().includes(q);
        const matchesEmail = sub.responsibleEmail.toLowerCase().includes(q);
        const matchesDoc = (sub.cpfCnpj || '').toLowerCase().includes(q);
        const matchesCity = (sub.city || '').toLowerCase().includes(q);
        const matchesPlan = (sub.planName || '').toLowerCase().includes(q);
        return matchesName || matchesEmail || matchesDoc || matchesCity || matchesPlan;
      }
      return true;
    });
  }, [subscribers, statusFilter, searchQuery]);

  // Estado para alteração de senha mestre
  const [newMasterPassword, setNewMasterPassword] = useState('');
  const [confirmMasterPassword, setConfirmMasterPassword] = useState('');
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState(false);
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null);

  const handleChangeMasterPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordChangeError(null);
    setPasswordChangeSuccess(false);

    const cleanPass = newMasterPassword.trim();
    if (!cleanPass || cleanPass.length < 6) {
      setPasswordChangeError('A nova senha mestre deve conter no mínimo 6 caracteres.');
      return;
    }

    if (cleanPass !== confirmMasterPassword.trim()) {
      setPasswordChangeError('A confirmação de senha não confere com a nova senha digitada.');
      return;
    }

    const updated: AdminSettings = {
      ...settingsForm,
      masterPassword: cleanPass
    };
    setSettingsForm(updated);
    setSettings(updated);
    saveStoredAdminSettings(updated);
    setPasswordChangeSuccess(true);
    setNewMasterPassword('');
    setConfirmMasterPassword('');
    setTimeout(() => setPasswordChangeSuccess(false), 4000);
  };

  const handleLogoutMaster = () => {
    clearStoredMasterSession();
    setSession(null);
  };

  // 1. Função de Personificação (Impersonate - Botão Verde "→ Entrar")
  const handleImpersonate = (sub: Subscriber) => {
    if (onImpersonate) {
      onImpersonate(sub);
    } else {
      localStorage.setItem('is_admin_impersonating', 'true');
      localStorage.setItem('impersonated_subscriber_id', sub.id);
      localStorage.setItem('impersonated_subscriber_name', sub.name);
      localStorage.setItem('impersonated_subscriber_email', sub.responsibleEmail || '');
      localStorage.setItem('current_company_id', sub.id);
      localStorage.setItem('user_role', 'admin');
      localStorage.setItem('silagem_client_session', 'active');
      window.location.href = '/dashboard';
    }
  };

  // 2. Salvar Assinante com UPDATE real no banco de dados Supabase
  const handleSaveSubscriber = async (saved: Subscriber) => {
    const exists = subscribers.some(s => s.id === saved.id);
    let updatedList: Subscriber[];
    if (exists) {
      updatedList = subscribers.map(s => s.id === saved.id ? saved : s);
    } else {
      updatedList = [saved, ...subscribers];
    }
    setSubscribers(updatedList);
    saveStoredSubscribers(updatedList);

    try {
      await upsertCloudSubscriber(saved);
      showToast(`Assinante "${saved.name}" atualizado no Supabase com sucesso!`);
    } catch (err) {
      console.warn('Aviso ao salvar assinante na nuvem:', err);
    }
  };

  // Excluir Assinante
  const handleDeleteSubscriber = (id: string, name: string) => {
    if (window.confirm(`Tem certeza que deseja remover o assinante "${name}"? Esta ação é irreversível.`)) {
      const updated = subscribers.filter(s => s.id !== id);
      setSubscribers(updated);
      saveStoredSubscribers(updated);
      deleteCloudSubscriber(id).catch(err => console.warn('Notice deleting subscriber from cloud:', err));
      showToast(`Assinante "${name}" removido.`);
    }
  };

  // 3. Alternar Status Rápido do Assinante com sincronização direta no Supabase
  const handleQuickStatusChange = async (id: string, newStatus: SubscriberStatus) => {
    const updated = subscribers.map(s => {
      if (s.id === id) {
        return { ...s, status: newStatus, updatedAt: new Date().toISOString() };
      }
      return s;
    });
    setSubscribers(updated);
    saveStoredSubscribers(updated);

    try {
      const dbStatus = newStatus === 'ativa' ? 'Ativa' : newStatus === 'suspensa' ? 'Suspenso' : newStatus;
      await updateCloudSubscriberStatus(id, dbStatus);
      showToast(`Status atualizado para "${newStatus}" no Supabase.`);
    } catch (err) {
      console.warn('Aviso ao sincronizar status no Supabase:', err);
    }
  };

  // Salvar Plano
  const handleSavePlan = (savedPlan: PlanDefinition) => {
    const exists = plans.some(p => p.id === savedPlan.id);
    let updated: PlanDefinition[];
    if (exists) {
      updated = plans.map(p => p.id === savedPlan.id ? savedPlan : p);
    } else {
      updated = [...plans, savedPlan];
    }
    // Ordenar por ordem de exibição
    updated.sort((a, b) => a.displayOrder - b.displayOrder);
    setPlans(updated);

    // 1. Centralização do localStorage: salvar na chave global única padronizada 'agrocontrol_plans_data'
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('agrocontrol_plans_data', JSON.stringify(updated));
    }
    saveStoredPlans(updated);

    // 2. Notificação em tempo real via CustomEvents e StorageEvent para a Landing Page
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('agrocontrol_plans_updated', { detail: updated }));
      window.dispatchEvent(new CustomEvent('master_admin_data_changed', { detail: updated }));
      try {
        window.dispatchEvent(new Event('storage'));
      } catch (e) {
        // Fallback
      }
    }
  };

  // Excluir Plano
  const handleDeletePlan = (id: string, name: string) => {
    if (window.confirm(`Deseja realmente excluir o plano "${name}"?`)) {
      const updated = plans.filter(p => p.id !== id);
      setPlans(updated);

      // Centralização do localStorage: salvar na chave global padronizada
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('agrocontrol_plans_data', JSON.stringify(updated));
      }
      saveStoredPlans(updated);
      deleteCloudPlan(id).catch(err => console.warn('Notice deleting plan from cloud:', err));

      // Notificação imediata para a Landing Page
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('agrocontrol_plans_updated', { detail: updated }));
        window.dispatchEvent(new CustomEvent('master_admin_data_changed', { detail: updated }));
        try {
          window.dispatchEvent(new Event('storage'));
        } catch (e) {
          // Fallback
        }
      }
    }
  };

  // Salvar Configurações do Site (Landing Page Pública)
  const handleSaveSiteConfig = (e?: React.FormEvent) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    try {
      // 1. Atualização do estado local imediato
      setSiteConfig(siteForm);

      // 2. Persistência na chave padronizada 'agrocontrol_site_settings' e legadas
      if (typeof localStorage !== 'undefined') {
        const serialized = JSON.stringify(siteForm);
        localStorage.setItem('agrocontrol_site_settings', serialized);
        localStorage.setItem('landingPageSettings', serialized);
      }
      saveStoredSiteConfig(siteForm);

      // 3. Notificação global de sincronização para a Landing Page
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('agrocontrol_site_settings_updated', { detail: siteForm }));
        window.dispatchEvent(new CustomEvent('landing_page_settings_updated', { detail: siteForm }));
        window.dispatchEvent(new CustomEvent('master_admin_data_changed', { detail: siteForm }));
        try {
          window.dispatchEvent(new Event('storage'));
        } catch (e) {
          // Fallback
        }
      }

      // 4. Exibição do Alerta Visual / Toast
      setSiteSaveSuccess(true);
      setTimeout(() => setSiteSaveSuccess(false), 4500);
    } catch (err) {
      console.error('Erro ao salvar configurações da Landing Page:', err);
    }
  };

  // Salvar Configurações Gerais e Webhooks
  const handleSaveAdminSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSettings(settingsForm);
    saveStoredAdminSettings(settingsForm);
    setSettingsSaveSuccess(true);
    setTimeout(() => setSettingsSaveSuccess(false), 3000);
  };

  // Adicionar Super Admin Email
  const handleAddSuperAdminEmail = () => {
    const email = newSuperAdminEmail.trim().toLowerCase();
    if (!email) return;
    if (settingsForm.superAdminEmails.includes(email)) return;
    const updated = {
      ...settingsForm,
      superAdminEmails: [...settingsForm.superAdminEmails, email]
    };
    setSettingsForm(updated);
    setSettings(updated);
    saveStoredAdminSettings(updated);
    setNewSuperAdminEmail('');
  };

  // Remover Super Admin Email
  const handleRemoveSuperAdminEmail = (email: string) => {
    const updated = {
      ...settingsForm,
      superAdminEmails: settingsForm.superAdminEmails.filter(e => e !== email)
    };
    setSettingsForm(updated);
    setSettings(updated);
    saveStoredAdminSettings(updated);
  };

  // TELA DE BLOQUEIO / LOGIN MESTRE SE NÃO AUTENTICADO
  if (!session) {
    return (
      <MasterAdminLogin
        onSuccess={(newSession) => setSession(newSession)}
        onBackToApp={onBackToApp}
        onOpenLandingPage={onOpenLandingPage}
      />
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex font-['Plus_Jakarta_Sans',sans-serif] relative">
      
      {/* Backdrop Mobile para fechar a Sidebar */}
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* 1. BARRA LATERAL VERTICAL (SIDEBAR) FIXA NA EXTREMIDADE ESQUERDA */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-64 xl:w-72 bg-stone-900 border-r border-stone-800 flex flex-col justify-between select-none h-screen transition-transform duration-300 ease-in-out ${
          isMobileSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Topo da Sidebar: Identidade Visual e Fechamento Mobile */}
        <div className="p-4 sm:p-5 border-b border-stone-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white font-black text-sm shadow-md shadow-emerald-950/40">
              AM
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black tracking-tight text-white">
                  Admin Mestre
                </h1>
                <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider">
                  Super
                </span>
              </div>
              <p className="text-[11px] text-stone-400 font-medium">
                Painel Central Global
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(false)}
            className="md:hidden p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition"
            title="Fechar menu lateral"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Itens do Menu Empilhados Verticalmente */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
          <div className="px-3 pb-1 text-[11px] font-black uppercase tracking-wider text-stone-400">
            Módulos Globais
          </div>

          {/* 1. Módulo: Assinaturas & Assinantes */}
          <button
            type="button"
            onClick={() => {
              setAdminTab('assinantes');
              setIsMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition-all cursor-pointer group text-left ${
              adminTab === 'assinantes'
                ? 'bg-stone-800 text-emerald-400 border border-stone-700/90 shadow-md ring-1 ring-emerald-500/30'
                : 'text-stone-400 hover:text-white hover:bg-stone-800/50 border border-transparent'
            }`}
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className={`p-2.5 rounded-xl transition shrink-0 ${
                adminTab === 'assinantes'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-stone-800/70 text-stone-400 group-hover:text-stone-200 group-hover:bg-stone-800'
              }`}>
                <Users className="w-5 h-5" />
              </div>
              <div className="truncate">
                <div className={`text-sm sm:text-[15px] leading-snug truncate ${
                  adminTab === 'assinantes' ? 'text-emerald-400 font-black' : 'text-white font-bold group-hover:text-white'
                }`}>
                  Assinantes
                </div>
                <div className="text-xs text-stone-400 font-medium truncate mt-0.5">
                  Clientes e Contratos
                </div>
              </div>
            </div>
            <span className={`px-2.5 py-1 text-xs rounded-full font-bold shrink-0 ml-2 ${
              adminTab === 'assinantes'
                ? 'bg-emerald-500/30 text-emerald-300 font-black'
                : 'bg-stone-800 text-stone-400 group-hover:text-stone-300'
            }`}>
              {subscribers.length}
            </span>
          </button>

          {/* 2. Módulo: Módulo de Planos */}
          <button
            type="button"
            onClick={() => {
              setAdminTab('planos');
              setIsMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition-all cursor-pointer group text-left ${
              adminTab === 'planos'
                ? 'bg-stone-800 text-emerald-400 border border-stone-700/90 shadow-md ring-1 ring-emerald-500/30'
                : 'text-stone-400 hover:text-white hover:bg-stone-800/50 border border-transparent'
            }`}
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className={`p-2.5 rounded-xl transition shrink-0 ${
                adminTab === 'planos'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-stone-800/70 text-stone-400 group-hover:text-stone-200 group-hover:bg-stone-800'
              }`}>
                <Tag className="w-5 h-5" />
              </div>
              <div className="truncate">
                <div className={`text-sm sm:text-[15px] leading-snug truncate ${
                  adminTab === 'planos' ? 'text-emerald-400 font-black' : 'text-white font-bold group-hover:text-white'
                }`}>
                  Módulo de Planos
                </div>
                <div className="text-xs text-stone-400 font-medium truncate mt-0.5">
                  Tabelas de Preços
                </div>
              </div>
            </div>
            <span className={`px-2.5 py-1 text-xs rounded-full font-bold shrink-0 ml-2 ${
              adminTab === 'planos'
                ? 'bg-emerald-500/30 text-emerald-300 font-black'
                : 'bg-stone-800 text-stone-400 group-hover:text-stone-300'
            }`}>
              {plans.length}
            </span>
          </button>

          {/* 3. Módulo: Configurações do Site (Landing Page) */}
          <button
            type="button"
            onClick={() => {
              setAdminTab('site');
              setIsMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition-all cursor-pointer group text-left ${
              adminTab === 'site'
                ? 'bg-stone-800 text-emerald-400 border border-stone-700/90 shadow-md ring-1 ring-emerald-500/30'
                : 'text-stone-400 hover:text-white hover:bg-stone-800/50 border border-transparent'
            }`}
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className={`p-2.5 rounded-xl transition shrink-0 ${
                adminTab === 'site'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-stone-800/70 text-stone-400 group-hover:text-stone-200 group-hover:bg-stone-800'
              }`}>
                <Globe className="w-5 h-5" />
              </div>
              <div className="truncate">
                <div className={`text-sm sm:text-[15px] leading-snug truncate ${
                  adminTab === 'site' ? 'text-emerald-400 font-black' : 'text-white font-bold group-hover:text-white'
                }`}>
                  Configurações do Site
                </div>
                <div className="text-xs text-stone-400 font-medium truncate mt-0.5">
                  Landing Page Pública
                </div>
              </div>
            </div>
            {adminTab === 'site' && (
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shrink-0 ml-2" />
            )}
          </button>

          {/* 4. Módulo: Webhooks & Super Admins */}
          <button
            type="button"
            onClick={() => {
              setAdminTab('configuracoes');
              setIsMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition-all cursor-pointer group text-left ${
              adminTab === 'configuracoes'
                ? 'bg-stone-800 text-emerald-400 border border-stone-700/90 shadow-md ring-1 ring-emerald-500/30'
                : 'text-stone-400 hover:text-white hover:bg-stone-800/50 border border-transparent'
            }`}
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className={`p-2.5 rounded-xl transition shrink-0 ${
                adminTab === 'configuracoes'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-stone-800/70 text-stone-400 group-hover:text-stone-200 group-hover:bg-stone-800'
              }`}>
                <Key className="w-5 h-5" />
              </div>
              <div className="truncate">
                <div className={`text-sm sm:text-[15px] leading-snug truncate ${
                  adminTab === 'configuracoes' ? 'text-emerald-400 font-black' : 'text-white font-bold group-hover:text-white'
                }`}>
                  Webhooks & Admins
                </div>
                <div className="text-xs text-stone-400 font-medium truncate mt-0.5">
                  Segurança & Integrações
                </div>
              </div>
            </div>
            {adminTab === 'configuracoes' && (
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shrink-0 ml-2" />
            )}
          </button>
        </div>

        {/* Rodapé da Sidebar: Sessão & Ações Rápidas */}
        <div className="p-3 sm:p-4 border-t border-stone-800 space-y-2 bg-stone-900/80 shrink-0">
          {session && (
            <div className="px-3 py-2 rounded-xl bg-stone-950/80 border border-stone-800/80 text-xs">
              <div className="flex items-center gap-2 mb-0.5">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] uppercase font-bold tracking-wider text-stone-400">
                  Super Admin
                </span>
              </div>
              <div className="font-mono text-emerald-400 font-bold text-[11px] truncate" title={session.email}>
                {session.email}
              </div>
            </div>
          )}

          <div className="pt-1 space-y-1">
            <button
              type="button"
              onClick={onOpenLandingPage}
              className="w-full px-3 py-2 bg-stone-800/80 hover:bg-stone-800 text-stone-300 hover:text-white rounded-xl text-xs font-bold flex items-center gap-2.5 transition cursor-pointer border border-stone-700/60"
              title="Abrir a Landing Page pública de vendas"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate">Ver Landing Page</span>
            </button>

            <button
              type="button"
              onClick={onBackToApp}
              className="w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-2.5 transition cursor-pointer shadow-sm"
              title="Acessar o ERP Interno"
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Abrir ERP Silagem Fácil</span>
            </button>

            <button
              type="button"
              onClick={handleLogoutMaster}
              className="w-full px-3 py-2 bg-stone-950 hover:bg-rose-950/40 hover:text-rose-300 hover:border-rose-800/60 text-stone-400 rounded-xl text-xs font-bold flex items-center gap-2.5 transition cursor-pointer border border-stone-800"
              title="Encerrar sessão e deslogar do Admin Mestre"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span className="truncate">Sair do Master</span>
            </button>
          </div>
        </div>
      </aside>

      {/* 2. ÁREA DE EXIBIÇÃO DA DIREITA (Começa logo após a Sidebar) */}
      <div className="flex-1 md:pl-64 xl:pl-72 flex flex-col min-h-screen w-full min-w-0 bg-stone-950">
        
        {/* TopBar Superior da Área de Conteúdo */}
        <header className="bg-stone-900/90 backdrop-blur-md border-b border-stone-800 sticky top-0 z-30 px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* Botão Hambúrguer Mobile */}
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="md:hidden p-2 rounded-xl bg-stone-800 text-stone-300 hover:text-white hover:bg-stone-700 transition shrink-0"
              title="Abrir Menu Lateral de Módulos"
            >
              <Menu className="w-5 h-5" />
            </button>
            
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white truncate">
                  {adminTab === 'assinantes' && 'Assinaturas & Assinantes'}
                  {adminTab === 'planos' && 'Módulo de Planos Comerciais'}
                  {adminTab === 'site' && 'Configurações do Site (Landing Page)'}
                  {adminTab === 'configuracoes' && 'Webhooks & Super Admins'}
                </h2>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider hidden sm:inline-block shrink-0">
                  {adminTab === 'assinantes' && `${subscribers.length} registros`}
                  {adminTab === 'planos' && `${plans.length} planos`}
                  {adminTab === 'site' && 'Landing Page'}
                  {adminTab === 'configuracoes' && 'Segurança'}
                </span>
              </div>
              <p className="text-xs text-stone-400 hidden sm:block truncate">
                {adminTab === 'assinantes' && 'Gestão unificada de clientes rurais, contratos e faturamento recorrente'}
                {adminTab === 'planos' && 'Tabelas de preços, limites operacionais e recursos cadastrados'}
                {adminTab === 'site' && 'Customização visual e conteúdo da Landing Page pública de vendas'}
                {adminTab === 'configuracoes' && 'Chaves de API, webhooks e credenciais de acesso restrito'}
              </p>
            </div>
          </div>

          {/* Ações Rápidas no TopBar Superior */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={handleManualCloudSync}
              disabled={isSyncingCloud}
              className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border border-stone-700 disabled:opacity-60"
              title="Sincronizar dados em tempo real com o banco de dados Supabase na nuvem"
            >
              <Database className={`w-3.5 h-3.5 text-emerald-400 ${isSyncingCloud ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isSyncingCloud ? 'Sincronizando...' : 'Nuvem Supabase'}</span>
            </button>

            <button
              type="button"
              onClick={onBackToApp}
              className="hidden lg:flex px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-black items-center gap-1.5 transition cursor-pointer shadow-sm"
              title="Acessar o ERP Interno"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Abrir ERP</span>
            </button>
          </div>
        </header>

        {/* Conteúdo Principal (Cards de Indicadores + Tabela e Formulários) */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
          
          {/* CARDS DE CONTADORES SUPERIORES & MRR ESTIMADO EM TEMPO REAL */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            
            {/* 1. Total de Assinantes */}
            <div className="bg-stone-900 border border-stone-800 p-4 rounded-2xl space-y-1">
              <div className="flex items-center justify-between text-stone-400">
                <span className="text-[11px] font-bold uppercase tracking-wider">Total Assinantes</span>
                <Users className="w-4 h-4 text-stone-400" />
              </div>
              <p className="text-2xl font-black text-white tracking-tight">
                {metrics.totalSubscribers}
              </p>
              <span className="text-[10px] text-stone-500 font-medium">
                Registros no banco
              </span>
            </div>

            {/* 2. Assinaturas Ativas */}
            <div className="bg-stone-900 border border-stone-800 p-4 rounded-2xl space-y-1">
              <div className="flex items-center justify-between text-emerald-400">
                <span className="text-[11px] font-bold uppercase tracking-wider">Ativas</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-black text-emerald-400 tracking-tight">
                {metrics.activeSubscribers}
              </p>
              <span className="text-[10px] text-emerald-500/80 font-medium">
                Contratos adimplentes
              </span>
            </div>

            {/* 3. Em Trial */}
            <div className="bg-stone-900 border border-stone-800 p-4 rounded-2xl space-y-1">
              <div className="flex items-center justify-between text-amber-400">
                <span className="text-[11px] font-bold uppercase tracking-wider">Em Trial</span>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-2xl font-black text-amber-400 tracking-tight">
                {metrics.trialSubscribers}
              </p>
              <span className="text-[10px] text-amber-500/80 font-medium">
                Testando a plataforma
              </span>
            </div>

            {/* 4. Suspensas / Inadimplentes */}
            <div className="bg-stone-900 border border-stone-800 p-4 rounded-2xl space-y-1">
              <div className="flex items-center justify-between text-rose-400">
                <span className="text-[11px] font-bold uppercase tracking-wider">Suspensas</span>
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              </div>
              <p className="text-2xl font-black text-rose-400 tracking-tight">
                {metrics.suspendedSubscribers}
              </p>
              <span className="text-[10px] text-rose-500/80 font-medium">
                Inadimplência ou pausa
              </span>
            </div>

            {/* 5. MRR Estimado (Soma dinâmica de clientes com status "ATIVA") */}
            <div className="col-span-2 sm:col-span-1 bg-gradient-to-br from-emerald-950/60 to-stone-900 border border-emerald-800/50 p-4 rounded-2xl space-y-1">
              <div className="flex items-center justify-between text-emerald-300">
                <span className="text-[11px] font-black uppercase tracking-wider">MRR Estimado</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-xl sm:text-2xl font-black text-emerald-400 tracking-tight">
                {formatCurrencyBRL(metrics.estimatedMrr)}
              </p>
              <span className="text-[10px] text-emerald-400/80 font-bold block">
                Receita Recorrente Mensal
              </span>
            </div>
          </div>

          {/* ======================================================== */}
          {/* ABA 1: ASSINATURAS & ASSINANTES                          */}
          {/* ======================================================== */}
          {adminTab === 'assinantes' && (
          <div className="space-y-4">
            
            {/* Barra de Filtros e Busca */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-stone-900 p-3.5 rounded-2xl border border-stone-800">
              
              {/* Abas de filtro instantâneo por status */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setStatusFilter('todas')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                    statusFilter === 'todas'
                      ? 'bg-stone-700 text-white'
                      : 'text-stone-400 hover:text-white hover:bg-stone-800'
                  }`}
                >
                  Todas ({subscribers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('ativa')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                    statusFilter === 'ativa'
                      ? 'bg-emerald-600 text-white'
                      : 'text-emerald-400 hover:bg-emerald-950/40'
                  }`}
                >
                  Ativa ({subscribers.filter(s => s.status === 'ativa').length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('trial')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                    statusFilter === 'trial'
                      ? 'bg-amber-600 text-white'
                      : 'text-amber-400 hover:bg-amber-950/40'
                  }`}
                >
                  Trial ({subscribers.filter(s => s.status === 'trial').length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('inadimplente')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                    statusFilter === 'inadimplente'
                      ? 'bg-rose-600 text-white'
                      : 'text-rose-400 hover:bg-rose-950/40'
                  }`}
                >
                  Inadimplente ({subscribers.filter(s => s.status === 'inadimplente').length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('cancelada')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                    statusFilter === 'cancelada'
                      ? 'bg-stone-600 text-white'
                      : 'text-stone-400 hover:bg-stone-800'
                  }`}
                >
                  Cancelada ({subscribers.filter(s => s.status === 'cancelada').length})
                </button>
              </div>

              {/* Busca e Botão Novo Assinante */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-4 h-4 text-stone-500 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar assinante, e-mail, CNPJ..."
                    className="w-full pl-9 pr-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-white placeholder-stone-500 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEditingSubscriber(null);
                    setIsEditSubscriberOpen(true);
                  }}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Novo Assinante</span>
                </button>
              </div>
            </div>

            {/* Tabela de Assinantes */}
            <div className="bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-stone-800 bg-stone-950/50 text-[11px] font-black text-stone-400 uppercase tracking-wider">
                      <th className="py-3.5 px-4">Assinante / Empresa</th>
                      <th className="py-3.5 px-4">Responsável & Contato</th>
                      <th className="py-3.5 px-4">Documento / Cidade</th>
                      <th className="py-3.5 px-4">Plano & Valor</th>
                      <th className="py-3.5 px-4">Trial Até</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-800/60 text-xs">
                    {filteredSubscribers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-16 text-center text-stone-400">
                          <div className="flex flex-col items-center justify-center space-y-2">
                            <Building2 className="w-8 h-8 text-stone-600 stroke-[1.5]" />
                            <p className="text-sm font-semibold text-stone-300">
                              {subscribers.length === 0
                                ? 'Nenhum assinante cadastrado na plataforma até o momento.'
                                : 'Nenhum assinante encontrado para os critérios selecionados.'}
                            </p>
                            {subscribers.length === 0 && (
                              <p className="text-xs text-stone-500 max-w-sm">
                                Novos cadastros realizados na plataforma ou criados pelo botão "+ Novo Assinante" aparecerão aqui automaticamente.
                              </p>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredSubscribers.map((sub) => (
                        <tr key={sub.id} className="hover:bg-stone-800/40 transition">
                          
                          {/* Nome do Assinante */}
                          <td className="py-3 px-4 font-bold text-white">
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-emerald-400 shrink-0" />
                              <div>
                                <span>{sub.name}</span>
                                <span className="block text-[10px] text-stone-500 font-mono">
                                  ID: {sub.id}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Email & Telefone */}
                          <td className="py-3 px-4 text-stone-300">
                            <div>
                              <span className="font-medium text-stone-200 block">{sub.responsibleEmail}</span>
                              <span className="text-[11px] text-stone-400 font-mono">{sub.phone || '-'}</span>
                            </div>
                          </td>

                          {/* Documento & Cidade */}
                          <td className="py-3 px-4 text-stone-300">
                            <span className="font-mono text-stone-300 block">{sub.cpfCnpj || '-'}</span>
                            <span className="text-[11px] text-stone-400">
                              {sub.city ? `${sub.city} - ${sub.state}` : '-'}
                            </span>
                          </td>

                          {/* Plano & Valor */}
                          <td className="py-3 px-4">
                            <span className="font-black text-teal-400 block">{sub.planName}</span>
                            <span className="text-[11px] font-black text-emerald-400">
                              {formatCurrencyBRL(sub.monthlyValue)}/mês
                            </span>
                          </td>

                          {/* Trial Até */}
                          <td className="py-3 px-4 font-mono text-stone-300">
                            {sub.trialUntil ? new Date(sub.trialUntil + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4">
                            <select
                              value={sub.status}
                              onChange={(e) => handleQuickStatusChange(sub.id, e.target.value as SubscriberStatus)}
                              className={`text-[11px] font-black px-2.5 py-1 rounded-lg border outline-none cursor-pointer ${
                                sub.status === 'ativa'
                                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                                  : sub.status === 'trial'
                                  ? 'bg-amber-950/60 text-amber-300 border-amber-800'
                                  : sub.status === 'inadimplente'
                                  ? 'bg-rose-950/60 text-rose-300 border-rose-800'
                                  : sub.status === 'suspensa'
                                  ? 'bg-purple-950/60 text-purple-300 border-purple-800'
                                  : 'bg-stone-800 text-stone-400 border-stone-700'
                              }`}
                            >
                              <option value="ativa">Ativa</option>
                              <option value="trial">Trial</option>
                              <option value="inadimplente">Inadimplente</option>
                              <option value="suspensa">Suspensa</option>
                              <option value="cancelada">Cancelada</option>
                            </select>
                          </td>

                          {/* Ações Rápidas */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap sm:flex-nowrap">
                              {/* 1. Botão Verde "→ Entrar" (Personificação / Impersonate) */}
                              <button
                                type="button"
                                onClick={() => handleImpersonate(sub)}
                                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-black flex items-center gap-1 transition shadow-sm cursor-pointer whitespace-nowrap"
                                title={`Entrar no painel operacional de ${sub.name} (Modo Personificação)`}
                              >
                                <span>→ Entrar</span>
                              </button>

                              {/* 2. Ícone de Pausa (Laranja) ou Play (Verde) (Suspensão/Reativação) */}
                              {sub.status === 'suspensa' ? (
                                <button
                                  type="button"
                                  onClick={() => setPauseModalSubscriber(sub)}
                                  className="p-1.5 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-400 rounded-lg transition cursor-pointer border border-emerald-800/60"
                                  title="Reativar Assinatura (Liberar Acesso)"
                                >
                                  <Play className="w-4 h-4" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setPauseModalSubscriber(sub)}
                                  className="p-1.5 bg-amber-950/60 hover:bg-amber-900/80 text-amber-400 rounded-lg transition cursor-pointer border border-amber-800/60"
                                  title="Pausar / Suspender Assinatura (Bloquear ERP por pendência)"
                                >
                                  <Pause className="w-4 h-4" />
                                </button>
                              )}

                              {/* 3. Ícone do Lápis (Amarelo - Editar Informações) */}
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingSubscriber(sub);
                                  setIsEditSubscriberOpen(true);
                                }}
                                className="p-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 rounded-lg transition cursor-pointer border border-amber-500/30"
                                title="Editar Informações do Assinante (com busca por CEP e troca de plano)"
                              >
                                <Edit className="w-4 h-4" />
                              </button>

                              {/* 4. Ícone do Cadeado (Azul - Redefinir Senha) */}
                              <button
                                type="button"
                                onClick={() => setResetPasswordSubscriber(sub)}
                                className="p-1.5 bg-sky-950/60 hover:bg-sky-900/80 text-sky-400 rounded-lg transition cursor-pointer border border-sky-800/60"
                                title="Redefinir Senha do Assinante no Supabase"
                              >
                                <Lock className="w-4 h-4" />
                              </button>

                              {/* 5. Ícone do Cubo/Caixa (Roxo - Alterar Módulo/Plano) */}
                              <button
                                type="button"
                                onClick={() => setChangePlanSubscriber(sub)}
                                className="p-1.5 bg-purple-950/60 hover:bg-purple-900/80 text-purple-400 rounded-lg transition cursor-pointer border border-purple-800/60"
                                title="Alterar Módulo/Plano Comercial (Sincronizado do Supabase)"
                              >
                                <Package className="w-4 h-4" />
                              </button>

                              {/* 6. Ícone do Calendário (Marrom - Estender Trial) */}
                              <button
                                type="button"
                                onClick={() => setExtendTrialSubscriber(sub)}
                                className="p-1.5 bg-stone-800 hover:bg-stone-700 text-amber-500 rounded-lg transition cursor-pointer border border-amber-900/40"
                                title="Estender Período de Testes (Trial)"
                              >
                                <Calendar className="w-4 h-4" />
                              </button>

                              {/* Visualizar Ficha */}
                              <button
                                type="button"
                                onClick={() => {
                                  setViewingSubscriber(sub);
                                  setIsDetailSubscriberOpen(true);
                                }}
                                className="p-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white rounded-lg transition cursor-pointer"
                                title="Visualizar Ficha Completa"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              {/* Remover */}
                              <button
                                type="button"
                                onClick={() => handleDeleteSubscriber(sub.id, sub.name)}
                                className="p-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 rounded-lg transition cursor-pointer border border-rose-800/40"
                                title="Remover Assinante"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* ABA 2: MÓDULO DE PLANOS                                  */}
        {/* ======================================================== */}
        {adminTab === 'planos' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-stone-900 p-4 rounded-2xl border border-stone-800">
              <div>
                <h2 className="text-sm font-black text-white">
                  Planos Comerciais da Plataforma
                </h2>
                <p className="text-xs text-stone-400">
                  Planos com status ativo aparecem na Landing Page pública com link direto de checkout.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingPlan(null);
                  setIsPlanModalOpen(true);
                }}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Novo Plano</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plans.map((p) => (
                <div 
                  key={p.id}
                  className={`bg-stone-900 rounded-2xl border p-5 flex flex-col justify-between space-y-4 relative ${
                    p.isFeatured 
                      ? 'border-emerald-500/80 shadow-lg shadow-emerald-950/50 ring-1 ring-emerald-500/40' 
                      : 'border-stone-800'
                  }`}
                >
                  {p.isFeatured && (
                    <span className="absolute -top-3 right-4 px-3 py-0.5 bg-emerald-500 text-stone-950 text-[10px] font-black rounded-full uppercase tracking-wider shadow-sm">
                      Destaque
                    </span>
                  )}

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-black text-white">{p.name}</h3>
                        <span className="text-[11px] text-stone-400">Ordem de Exibição: #{p.displayOrder}</span>
                      </div>
                      <span className={`px-2.5 py-0.5 text-[10px] font-black rounded-full border ${
                        p.isActive 
                          ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800' 
                          : 'bg-stone-800 text-stone-500 border-stone-700'
                      }`}>
                        {p.isActive ? 'ATIVO NO SITE' : 'INATIVO'}
                      </span>
                    </div>

                    <p className="text-xs text-stone-400 min-h-[36px]">
                      {p.description}
                    </p>

                    <div className="pt-2 border-t border-stone-800">
                      <span className="text-2xl font-black text-emerald-400 tracking-tight">
                        {formatCurrencyBRL(p.price)}
                      </span>
                      <span className="text-xs text-stone-400">/mês</span>
                    </div>

                    {/* Limites */}
                    <div className="p-3 bg-stone-950/70 rounded-xl border border-stone-800/80 text-[11px] space-y-1 text-stone-300">
                      <div className="flex justify-between">
                        <span className="text-stone-500">Máquinas/Veículos:</span>
                        <span className="font-bold">{p.limits.maxMachineries === 'unlimited' ? 'Ilimitado' : p.limits.maxMachineries}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-500">Usuários no painel:</span>
                        <span className="font-bold">{p.limits.maxUsers === 'unlimited' ? 'Ilimitado' : p.limits.maxUsers}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-500">Clientes CRM:</span>
                        <span className="font-bold">{p.limits.maxClients === 'unlimited' ? 'Ilimitado' : p.limits.maxClients}</span>
                      </div>
                    </div>

                    {/* Features Preview */}
                    <div className="space-y-1.5 text-xs text-stone-300">
                      <span className="text-[10px] font-black text-stone-500 uppercase tracking-wider block">
                        Features (renderizadas no site):
                      </span>
                      <ul className="space-y-1">
                        {p.featuresText.split('\n').filter(Boolean).slice(0, 4).map((feat, idx) => (
                          <li key={idx} className="flex items-center gap-2 text-[11px]">
                            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="truncate">{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Botões de Ação */}
                  <div className="pt-3 border-t border-stone-800 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPlan(p);
                        setIsPlanModalOpen(true);
                      }}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Refatorar Plano</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeletePlan(p.id, p.name)}
                      className="p-2 bg-stone-800 hover:bg-rose-900/50 text-stone-400 hover:text-rose-300 rounded-xl transition cursor-pointer border border-stone-700"
                      title="Excluir Plano"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* ABA 3: CONFIGURAÇÕES DO SITE (LANDING PAGE)              */}
        {/* ======================================================== */}
        {adminTab === 'site' && (
          <form onSubmit={handleSaveSiteConfig} className="space-y-6">
            
            {/* Toast Flutuante de Confirmação Obrigatório */}
            {siteSaveSuccess && (
              <div 
                id="toast-landing-settings-success"
                className="fixed top-6 right-6 z-50 flex items-center gap-3 bg-emerald-600 text-white px-5 py-3.5 rounded-2xl shadow-2xl shadow-emerald-950/80 border border-emerald-400 font-bold text-xs"
              >
                <CheckCircle2 className="w-5 h-5 text-emerald-100 shrink-0" />
                <span className="font-black text-sm">Configurações da Landing Page salvas com sucesso!</span>
              </div>
            )}

            <div className="flex items-center justify-between bg-stone-900 p-4 rounded-2xl border border-stone-800">
              <div>
                <h2 className="text-sm font-black text-white">
                  Controle Dinâmico da Landing Page Pública
                </h2>
                <p className="text-xs text-stone-400">
                  Edite os títulos, chamadas e cartões de recursos. Ao salvar, a Landing Page atualiza instantaneamente.
                </p>
              </div>
              <button
                type="button"
                id="btn-save-site-config-top"
                onClick={() => handleSaveSiteConfig()}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-2 transition cursor-pointer shadow-sm shadow-emerald-950"
              >
                <Save className="w-4 h-4" />
                <span>Salvar Alterações</span>
              </button>
            </div>

            {siteSaveSuccess && (
              <div className="p-3.5 bg-emerald-950/60 border border-emerald-800/80 rounded-2xl text-xs font-bold text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Configurações da Landing Page salvas com sucesso!</span>
              </div>
            )}

            {/* BLOCO HERO */}
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 space-y-4">
              <div className="border-b border-stone-800 pb-2">
                <h3 className="text-xs font-black text-emerald-400 uppercase tracking-wider">
                  1. Bloco Hero (Topo da Página)
                </h3>
                <p className="text-[11px] text-stone-400">
                  Configuração do título principal, subtítulo e textos dos botões de conversão.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-stone-300 mb-1">
                    TÍTULO PRINCIPAL (H1) *
                  </label>
                  <input
                    type="text"
                    required
                    value={siteForm.heroTitle}
                    onChange={(e) => setSiteForm({ ...siteForm, heroTitle: e.target.value })}
                    className="w-full p-2.5 bg-stone-950 border border-stone-800 rounded-xl text-xs font-black text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-stone-300 mb-1">
                    SUBTÍTULO *
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={siteForm.heroSubtitle}
                    onChange={(e) => setSiteForm({ ...siteForm, heroSubtitle: e.target.value })}
                    className="w-full p-2.5 bg-stone-950 border border-stone-800 rounded-xl text-xs font-medium text-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-300 mb-1">
                    TEXTO BOTÃO PRINCIPAL *
                  </label>
                  <input
                    type="text"
                    required
                    value={siteForm.heroPrimaryBtnText}
                    onChange={(e) => setSiteForm({ ...siteForm, heroPrimaryBtnText: e.target.value })}
                    className="w-full p-2.5 bg-stone-950 border border-stone-800 rounded-xl text-xs font-bold text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-300 mb-1">
                    TEXTO BOTÃO SECUNDÁRIO *
                  </label>
                  <input
                    type="text"
                    required
                    value={siteForm.heroSecondaryBtnText}
                    onChange={(e) => setSiteForm({ ...siteForm, heroSecondaryBtnText: e.target.value })}
                    className="w-full p-2.5 bg-stone-950 border border-stone-800 rounded-xl text-xs font-bold text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <ImageUploadField
                    id="hero-background-upload"
                    label="IMAGEM DE FUNDO DO HERO"
                    description="Upload de imagem do seu computador (.jpg, .png, .webp). Aplica corte inferior automático para ocultar textos artificiais e gradiente escuro profissional de alto contraste."
                    value={siteForm.heroBackgroundImage || ''}
                    onChange={(val) => setSiteForm({ ...siteForm, heroBackgroundImage: val })}
                    defaultFallback="/image.png"
                    aspectRatioLabel="Recomendado: 16:9 widescreen"
                  />
                </div>
              </div>
            </div>

            {/* BLOCO IMAGEM DE DESTAQUE DOS RECURSOS (SEÇÃO INFERIOR) */}
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 space-y-4">
              <div className="border-b border-stone-800 pb-2">
                <h3 className="text-xs font-black text-emerald-400 uppercase tracking-wider">
                  2. Imagem de Destaque dos Recursos (Seção Inferior)
                </h3>
                <p className="text-[11px] text-stone-400">
                  Imagem ilustrativa das funcionalidades do sistema, exibida logo abaixo do bloco de cabeçalho de recursos na Landing Page.
                </p>
              </div>

              <ImageUploadField
                id="features-highlight-upload"
                label="IMAGEM DE DESTAQUE DOS RECURSOS (SEÇÃO INFERIOR)"
                description="Carregue uma imagem ou captura de tela do sistema para exibir como destaque visual das funcionalidades na Landing Page."
                value={siteForm.featuresHighlightImage || ''}
                onChange={(val) => setSiteForm({ ...siteForm, featuresHighlightImage: val })}
                aspectRatioLabel="Recomendado: 16:9 widescreen ou mockup de sistema"
              />
            </div>

            {/* BLOCO CABEÇALHO DE RECURSOS */}
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 space-y-4">
              <div className="border-b border-stone-800 pb-2">
                <h3 className="text-xs font-black text-emerald-400 uppercase tracking-wider">
                  3. Bloco Cabeçalho de Recursos
                </h3>
                <p className="text-[11px] text-stone-400">
                  Cabeçalho da seção de diferenciais da página de vendas.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-300 mb-1">
                    TÍTULO DA SEÇÃO *
                  </label>
                  <input
                    type="text"
                    required
                    value={siteForm.featuresSectionTitle}
                    onChange={(e) => setSiteForm({ ...siteForm, featuresSectionTitle: e.target.value })}
                    className="w-full p-2.5 bg-stone-950 border border-stone-800 rounded-xl text-xs font-black text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-300 mb-1">
                    SUBTÍTULO DA SEÇÃO *
                  </label>
                  <input
                    type="text"
                    required
                    value={siteForm.featuresSectionSubtitle}
                    onChange={(e) => setSiteForm({ ...siteForm, featuresSectionSubtitle: e.target.value })}
                    className="w-full p-2.5 bg-stone-950 border border-stone-800 rounded-xl text-xs font-medium text-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* BLOCO RECURSOS (BENEFÍCIOS) - 4 CARTÕES CONECTADOS */}
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 space-y-4">
              <div className="border-b border-stone-800 pb-2">
                <h3 className="text-xs font-black text-emerald-400 uppercase tracking-wider">
                  4. Bloco Recursos (Benefícios - 4 Cartões da Landing Page)
                </h3>
                <p className="text-[11px] text-stone-400">
                  Estes campos alimentam diretamente os 4 cartões de benefícios da página pública de vendas.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Recurso #1 */}
                <div className="p-4 bg-stone-950/60 rounded-xl border border-stone-800 space-y-3">
                  <span className="text-xs font-black text-emerald-400 uppercase tracking-wider block">
                    RECURSO #1
                  </span>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-400 mb-1">TÍTULO</label>
                    <input
                      type="text"
                      required
                      value={siteForm.feature1Title}
                      onChange={(e) => setSiteForm({ ...siteForm, feature1Title: e.target.value })}
                      className="w-full p-2 bg-stone-900 border border-stone-700 rounded-lg text-xs font-bold text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-400 mb-1">DESCRIÇÃO</label>
                    <textarea
                      rows={2}
                      required
                      value={siteForm.feature1Desc}
                      onChange={(e) => setSiteForm({ ...siteForm, feature1Desc: e.target.value })}
                      className="w-full p-2 bg-stone-900 border border-stone-700 rounded-lg text-xs text-stone-200 outline-none"
                    />
                  </div>
                </div>

                {/* Recurso #2 */}
                <div className="p-4 bg-stone-950/60 rounded-xl border border-stone-800 space-y-3">
                  <span className="text-xs font-black text-emerald-400 uppercase tracking-wider block">
                    RECURSO #2
                  </span>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-400 mb-1">TÍTULO</label>
                    <input
                      type="text"
                      required
                      value={siteForm.feature2Title}
                      onChange={(e) => setSiteForm({ ...siteForm, feature2Title: e.target.value })}
                      className="w-full p-2 bg-stone-900 border border-stone-700 rounded-lg text-xs font-bold text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-400 mb-1">DESCRIÇÃO</label>
                    <textarea
                      rows={2}
                      required
                      value={siteForm.feature2Desc}
                      onChange={(e) => setSiteForm({ ...siteForm, feature2Desc: e.target.value })}
                      className="w-full p-2 bg-stone-900 border border-stone-700 rounded-lg text-xs text-stone-200 outline-none"
                    />
                  </div>
                </div>

                {/* Recurso #3 */}
                <div className="p-4 bg-stone-950/60 rounded-xl border border-stone-800 space-y-3">
                  <span className="text-xs font-black text-emerald-400 uppercase tracking-wider block">
                    RECURSO #3
                  </span>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-400 mb-1">TÍTULO</label>
                    <input
                      type="text"
                      required
                      value={siteForm.feature3Title}
                      onChange={(e) => setSiteForm({ ...siteForm, feature3Title: e.target.value })}
                      className="w-full p-2 bg-stone-900 border border-stone-700 rounded-lg text-xs font-bold text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-400 mb-1">DESCRIÇÃO</label>
                    <textarea
                      rows={2}
                      required
                      value={siteForm.feature3Desc}
                      onChange={(e) => setSiteForm({ ...siteForm, feature3Desc: e.target.value })}
                      className="w-full p-2 bg-stone-900 border border-stone-700 rounded-lg text-xs text-stone-200 outline-none"
                    />
                  </div>
                </div>

                {/* Recurso #4 */}
                <div className="p-4 bg-stone-950/60 rounded-xl border border-stone-800 space-y-3">
                  <span className="text-xs font-black text-emerald-400 uppercase tracking-wider block">
                    RECURSO #4
                  </span>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-400 mb-1">TÍTULO</label>
                    <input
                      type="text"
                      required
                      value={siteForm.feature4Title}
                      onChange={(e) => setSiteForm({ ...siteForm, feature4Title: e.target.value })}
                      className="w-full p-2 bg-stone-900 border border-stone-700 rounded-lg text-xs font-bold text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-400 mb-1">DESCRIÇÃO</label>
                    <textarea
                      rows={2}
                      required
                      value={siteForm.feature4Desc}
                      onChange={(e) => setSiteForm({ ...siteForm, feature4Desc: e.target.value })}
                      className="w-full p-2 bg-stone-900 border border-stone-700 rounded-lg text-xs text-stone-200 outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Botão Salvar Flutuante ou no final */}
            <div className="flex justify-end">
              <button
                type="button"
                id="btn-save-site-config-bottom"
                onClick={() => handleSaveSiteConfig()}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-2 transition cursor-pointer shadow-lg shadow-emerald-950"
              >
                <Save className="w-4 h-4" />
                <span>Salvar Todas as Alterações do Site</span>
              </button>
            </div>
          </form>
        )}

        {/* ======================================================== */}
        {/* ABA 4: CONFIGURAÇÕES (WEBHOOKS E SUPER ADMINS)            */}
        {/* ======================================================== */}
        {adminTab === 'configuracoes' && (
          <div className="space-y-6">
            
            <div className="bg-stone-900 p-4 rounded-2xl border border-stone-800">
              <h2 className="text-sm font-black text-white">
                Webhooks de Pagamento & Permissões de Super Admin
              </h2>
              <p className="text-xs text-stone-400">
                Integre plataformas de checkout automáticas e gerencie os e-mails com permissão de acesso ao Admin Mestre.
              </p>
            </div>

            {settingsSaveSuccess && (
              <div className="p-3.5 bg-emerald-950/60 border border-emerald-800/80 rounded-2xl text-xs font-bold text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Configurações atualizadas com sucesso!</span>
              </div>
            )}

            {/* Form Webhooks */}
            <form onSubmit={handleSaveAdminSettings} className="bg-stone-900 border border-stone-800 rounded-2xl p-5 space-y-4">
              <div className="border-b border-stone-800 pb-2 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                    <Webhook className="w-4 h-4" />
                    <span>URLs de Webhook de Pagamento</span>
                  </h3>
                  <p className="text-[11px] text-stone-400">
                    Insira as rotas de retorno das plataformas para aprovação e cancelamento automático de assinantes.
                  </p>
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Salvar Webhooks</span>
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-stone-300 mb-1">
                    WEBHOOK KIWIFY
                  </label>
                  <input
                    type="url"
                    value={settingsForm.webhookKiwify}
                    onChange={(e) => setSettingsForm({ ...settingsForm, webhookKiwify: e.target.value })}
                    placeholder="https://api.seusistema.com.br/webhooks/kiwify"
                    className="w-full p-2.5 bg-stone-950 border border-stone-800 rounded-xl text-xs font-mono text-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-300 mb-1">
                    WEBHOOK CAKTO
                  </label>
                  <input
                    type="url"
                    value={settingsForm.webhookCakto}
                    onChange={(e) => setSettingsForm({ ...settingsForm, webhookCakto: e.target.value })}
                    placeholder="https://api.seusistema.com.br/webhooks/cakto"
                    className="w-full p-2.5 bg-stone-950 border border-stone-800 rounded-xl text-xs font-mono text-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-300 mb-1">
                    WEBHOOK PERFECTPAY
                  </label>
                  <input
                    type="url"
                    value={settingsForm.webhookPerfectPay}
                    onChange={(e) => setSettingsForm({ ...settingsForm, webhookPerfectPay: e.target.value })}
                    placeholder="https://api.seusistema.com.br/webhooks/perfectpay"
                    className="w-full p-2.5 bg-stone-950 border border-stone-800 rounded-xl text-xs font-mono text-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>
            </form>

            {/* SUPER ADMINS */}
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 space-y-4">
              <div className="border-b border-stone-800 pb-2">
                <h3 className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  <span>E-mails Autorizados a Acessar o Admin Mestre</span>
                </h3>
                <p className="text-[11px] text-stone-400">
                  Usuários com estes e-mails possuem privilégios de super admin para administrar a plataforma.
                </p>
              </div>

              {/* Input e Botão "+ Adicionar" */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Mail className="w-4 h-4 text-stone-500 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="email"
                    value={newSuperAdminEmail}
                    onChange={(e) => setNewSuperAdminEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSuperAdminEmail();
                      }
                    }}
                    placeholder="Digite o e-mail do super admin (ex: admin@empresa.com)"
                    className="w-full pl-9 pr-3 py-2.5 bg-stone-950 border border-stone-800 rounded-xl text-xs text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleAddSuperAdminEmail}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Adicionar</span>
                </button>
              </div>

              {/* Lista de Super Admins Cadastrados */}
              <div className="space-y-2 pt-2">
                {settingsForm.superAdminEmails.map((email) => (
                  <div
                    key={email}
                    className="flex items-center justify-between p-3 bg-stone-950/70 rounded-xl border border-stone-800 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-emerald-950 text-emerald-400 flex items-center justify-center font-bold text-[10px] border border-emerald-800">
                        ✓
                      </div>
                      <span className="font-bold text-white font-mono">{email}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveSuperAdminEmail(email)}
                      className="text-stone-500 hover:text-rose-400 p-1 rounded-md transition cursor-pointer"
                      title="Remover autorização"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* SENHA MESTRE DE ACESSO */}
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 space-y-4">
              <div className="border-b border-stone-800 pb-2 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    <span>Alterar Senha Mestre de Acesso</span>
                  </h3>
                  <p className="text-[11px] text-stone-400">
                    Defina uma nova senha mestre forte para autenticação dos Super Administradores.
                  </p>
                </div>
                <div className="px-2.5 py-1 rounded-lg bg-stone-950 border border-stone-800 text-[10px] text-stone-400 font-mono">
                  Mínimo 6 caracteres
                </div>
              </div>

              {passwordChangeSuccess && (
                <div className="p-3 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-xs font-bold text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Senha mestre atualizada com sucesso! Todas as sessões administrativas usarão a nova credencial.</span>
                </div>
              )}

              {passwordChangeError && (
                <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl text-xs font-bold text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{passwordChangeError}</span>
                </div>
              )}

              <form onSubmit={handleChangeMasterPassword} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-300 mb-1">
                      NOVA SENHA MESTRE
                    </label>
                    <div className="relative">
                      <Key className="w-4 h-4 text-stone-500 absolute left-3 top-3 pointer-events-none" />
                      <input
                        type="password"
                        value={newMasterPassword}
                        onChange={(e) => {
                          setNewMasterPassword(e.target.value);
                          if (passwordChangeError) setPasswordChangeError(null);
                        }}
                        placeholder="Digite a nova senha"
                        className="w-full pl-9 pr-3 py-2.5 bg-stone-950 border border-stone-800 rounded-xl text-xs text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-300 mb-1">
                      CONFIRMAR NOVA SENHA
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-stone-500 absolute left-3 top-3 pointer-events-none" />
                      <input
                        type="password"
                        value={confirmMasterPassword}
                        onChange={(e) => {
                          setConfirmMasterPassword(e.target.value);
                          if (passwordChangeError) setPasswordChangeError(null);
                        }}
                        placeholder="Confirme a nova senha"
                        className="w-full pl-9 pr-3 py-2.5 bg-stone-950 border border-stone-800 rounded-xl text-xs text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end pt-1">
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer shadow-md"
                  >
                    <Save className="w-4 h-4" />
                    <span>Salvar Nova Senha Mestre</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
      </div>

      {/* MODAIS DO MASTER ADMIN */}
      <EditSubscriberModal
        isOpen={isEditSubscriberOpen}
        onClose={() => {
          setIsEditSubscriberOpen(false);
          setEditingSubscriber(null);
        }}
        subscriber={editingSubscriber}
        plans={plans}
        onSave={handleSaveSubscriber}
      />

      <SubscriberDetailModal
        isOpen={isDetailSubscriberOpen}
        onClose={() => {
          setIsDetailSubscriberOpen(false);
          setViewingSubscriber(null);
        }}
        subscriber={viewingSubscriber}
        onEdit={(sub) => {
          setEditingSubscriber(sub);
          setIsEditSubscriberOpen(true);
        }}
      />

      <PlanModal
        isOpen={isPlanModalOpen}
        onClose={() => {
          setIsPlanModalOpen(false);
          setEditingPlan(null);
        }}
        plan={editingPlan}
        onSave={handleSavePlan}
      />

      {/* 4. Modal de Redefinir Senha (Azul) */}
      <ResetPasswordModal
        isOpen={Boolean(resetPasswordSubscriber)}
        onClose={() => setResetPasswordSubscriber(null)}
        subscriber={resetPasswordSubscriber}
        onSuccessToast={showToast}
      />

      {/* 5. Modal de Alterar Plano Dinâmico do Supabase (Roxo) */}
      <ChangePlanModal
        isOpen={Boolean(changePlanSubscriber)}
        onClose={() => setChangePlanSubscriber(null)}
        subscriber={changePlanSubscriber}
        onSuccess={(updatedSub) => {
          handleSaveSubscriber(updatedSub);
        }}
        onSuccessToast={showToast}
      />

      {/* 6. Modal de Estender Trial (Marrom) */}
      <ExtendTrialModal
        isOpen={Boolean(extendTrialSubscriber)}
        onClose={() => setExtendTrialSubscriber(null)}
        subscriber={extendTrialSubscriber}
        onSuccess={(updatedSub) => {
          handleSaveSubscriber(updatedSub);
        }}
        onSuccessToast={showToast}
      />

      {/* 2. Modal de Pausar / Reativar Assinatura (Laranja / Verde) */}
      <PauseSubscriberModal
        isOpen={Boolean(pauseModalSubscriber)}
        onClose={() => setPauseModalSubscriber(null)}
        subscriber={pauseModalSubscriber}
        onSuccess={(updatedSub) => {
          handleSaveSubscriber(updatedSub);
        }}
        onSuccessToast={showToast}
      />

      {/* Notificação Toast Flutuante */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md bg-stone-900 text-stone-100 px-4 py-3 rounded-2xl shadow-2xl border border-emerald-500/40 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <p className="text-xs font-bold text-stone-200 leading-snug">
            {toastMessage}
          </p>
        </div>
      )}
    </div>
  );
};
