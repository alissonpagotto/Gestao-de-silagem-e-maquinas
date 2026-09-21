import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  X,
  Video,
  Sliders,
  Smartphone,
  TrendingUp,
  Wrench,
  Tractor
} from 'lucide-react';
import { 
  Subscriber, 
  SiteConfig, 
  PlanDefinition, 
  FeatureTabItem,
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
  STORAGE_KEYS,
  syncMasterAdminFromCloud
} from '../../lib/masterAdminStorage';
import { getStoredCompanyProfile, saveStoredCompanyProfile } from '../../lib/storage';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  deleteCloudPlan,
  deleteCloudSubscriber,
  updateCloudSubscriberStatus,
  upsertCloudSubscriber,
  upsertCloudPlan,
  upsertCloudSiteConfig,
  saveCloudCompanyProfile,
  CompanyProfile,
  sanitizePlanId,
  normalizeSubscriberStatus,
  toValidUUID
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

/**
 * Realiza um JOIN dinâmico entre o assinante e a lista atualizada de planos ('plans').
 * Garante que alterações de preço ou nomenclatura no módulo de planos reflitam imediatamente
 * na visualização de todos os assinantes, em vez de exibir textos ou valores estáticos antigos.
 */
export function resolveSubscriberPlan(
  sub: Partial<Subscriber> | null | undefined,
  plansList: PlanDefinition[]
): { planName: string; monthlyValue: number; planId: string } {
  if (!sub) {
    return { planName: 'Produtor Essencial', monthlyValue: 195, planId: 'essencial' };
  }

  const subPlanId = String(sub.planId || '').trim().toLowerCase();
  const subPlanName = String(sub.planName || '').trim().toLowerCase();

  // Função para normalizar chaves: remove prefixos, traços e caracteres especiais
  const normalizeKey = (val: string) =>
    val.toLowerCase().replace(/^plano[-_]/, '').replace(/[^a-z0-9]/g, '');

  const normSubId = normalizeKey(subPlanId);
  const normSubName = normalizeKey(subPlanName);

  // Procura correspondência na lista atualizada de planos
  const found = (plansList || []).find((p) => {
    if (!p) return false;
    const pId = String(p.id || '').trim().toLowerCase();
    const pName = String(p.name || '').trim().toLowerCase();
    const normPId = normalizeKey(pId);
    const normPName = normalizeKey(pName);

    // 1. Correspondência exata por ID (com ou sem 'plano-')
    if (subPlanId && (pId === subPlanId || normPId === normSubId)) return true;

    // 2. Correspondência exata por nome
    if (subPlanName && (pName === subPlanName || normPName === normSubName)) return true;

    // 3. Correspondência semântica das categorias principais
    if (normSubId.includes('essencial') && (normPId.includes('essencial') || normPName.includes('essencial'))) return true;
    if (normSubId.includes('pro') && !normSubId.includes('enterprise') && (normPId.includes('pro') || normPName.includes('pro')) && !normPId.includes('enterprise')) return true;
    if (normSubId.includes('enterprise') && (normPId.includes('enterprise') || normPName.includes('enterprise'))) return true;

    // 4. Inclusão recíproca por nome
    if (subPlanName && pName && (pName.includes(subPlanName) || subPlanName.includes(pName))) return true;

    return false;
  });

  if (found) {
    return {
      planName: found.name || sub.planName || 'Produtor Essencial',
      monthlyValue: typeof found.price === 'number' ? found.price : (Number(found.price) || 0),
      planId: found.id || sub.planId || 'essencial',
    };
  }

  // Fallback seguro caso seja um plano não encontrado
  return {
    planName: sub.planName || 'Produtor Essencial',
    monthlyValue: Number(sub.monthlyValue) || 0,
    planId: sub.planId || 'essencial',
  };
}

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

  // Sincroniza siteForm caso siteConfig seja atualizado externamente ou via nuvem
  useEffect(() => {
    if (siteConfig) {
      setSiteForm(prev => (isDeepEqual(prev, siteConfig) ? prev : { ...prev, ...siteConfig }));
    }
  }, [siteConfig]);

  const [settingsForm, setSettingsForm] = useState<AdminSettings>(settings);
  const [newSuperAdminEmail, setNewSuperAdminEmail] = useState('');
  const [settingsSaveSuccess, setSettingsSaveSuccess] = useState(false);

  // Comparador seguro para evitar loops de renderização desnecessários
  const isDeepEqual = (a: any, b: any): boolean => {
    if (a === b) return true;
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  };

  // Refs de espelho síncrono para validação imediata em eventos assíncronos do Realtime
  const subscribersRef = useRef<Subscriber[]>(subscribers);
  useEffect(() => {
    subscribersRef.current = subscribers;
  }, [subscribers]);

  const plansRef = useRef<PlanDefinition[]>(plans);
  useEffect(() => {
    plansRef.current = plans;
  }, [plans]);

  // Registro de alterações manuais recentes do usuário para bloquear loops de eco (janela de 5s)
  const recentManualActionsRef = useRef<Map<string, { timestamp: number; payload?: any }>>(new Map());

  // Refs para controle rigoroso de concorrência e cooldown de rede
  const isSyncingRef = useRef(false);
  const lastSyncTimeRef = useRef(0);
  const syncDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  // Setters protegidos contra re-renders idênticos
  const updateSubscribersIfChanged = useCallback((newSubs: Subscriber[]) => {
    if (!Array.isArray(newSubs)) return;
    setSubscribers(prev => (isDeepEqual(prev, newSubs) ? prev : newSubs));
  }, []);

  const updateSiteConfigIfChanged = useCallback((newConfig: SiteConfig) => {
    if (!newConfig) return;
    setSiteConfig(prev => (isDeepEqual(prev, newConfig) ? prev : newConfig));
  }, []);

  const updatePlansIfChanged = useCallback((newPlans: PlanDefinition[]) => {
    if (!Array.isArray(newPlans)) return;
    setPlans(prev => (isDeepEqual(prev, newPlans) ? prev : newPlans));
  }, []);

  const updateSettingsIfChanged = useCallback((newSettings: AdminSettings) => {
    if (!newSettings) return;
    setSettings(prev => (isDeepEqual(prev, newSettings) ? prev : newSettings));
  }, []);

  // Consulta direta dos planos comerciais da tabela 'plans' para integridade absoluta
  const fetchCloudPlansDirectly = useCallback(async (): Promise<PlanDefinition[]> => {
    if (!isSupabaseConfigured) return [];
    try {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .order('display_order', { ascending: true });

      if (error || !Array.isArray(data) || data.length === 0) {
        return [];
      }

      return data
        .filter((r: any) => r.is_active !== false)
        .map((r: any) => ({
          id: r.id,
          name: r.name,
          description: r.description || '',
          price: Number(r.price) || 0,
          billingCycle: r.billing_cycle || 'mensal',
          badge: r.badge,
          isFeatured: Boolean(r.is_featured),
          isActive: r.is_active !== false,
          displayOrder: r.display_order || 1,
          limits: r.limits || { maxUsers: 1, maxMachineries: 2, maxClients: 2, storageLimitGb: 5 },
          featuresText: r.features_text || '',
          checkoutUrl: r.checkout_url || '',
        }));
    } catch {
      return [];
    }
  }, []);

  // Busca direta e prioritária na tabela oficial 'assinantes' do Supabase integrada aos planos dinâmicos e dados de endereço
  const fetchSubscribersFromAssinantes = useCallback(async () => {
    if (!isSupabaseConfigured || !isMountedRef.current) return;
    try {
      // Consulta planos dinâmicos, assinantes e configurações fiscais/endereço em paralelo
      const [plansResult, assinantesResult, settingsResult] = await Promise.allSettled([
        fetchCloudPlansDirectly(),
        supabase.from('assinantes').select('*').order('criado_em', { ascending: false }),
        supabase.from('site_settings').select('id, hero_title').or('id.like.company_profile_%,id.like.cloud_company_%'),
      ]);

      let activePlans = plansRef.current;
      if (plansResult.status === 'fulfilled' && plansResult.value.length > 0) {
        activePlans = plansResult.value;
        updatePlansIfChanged(activePlans);
        plansRef.current = activePlans;
      }

      if (assinantesResult.status !== 'fulfilled' || assinantesResult.value.error) {
        if (assinantesResult.status === 'fulfilled' && assinantesResult.value.error) {
          console.warn('Aviso ao consultar tabela assinantes:', assinantesResult.value.error.message);
        }
        return;
      }

      // Mapeamento em memória dos dados de perfil/endereço do site_settings
      const profileMap = new Map<string, any>();
      if (settingsResult.status === 'fulfilled' && Array.isArray(settingsResult.value.data)) {
        for (const setRow of settingsResult.value.data) {
          if (!setRow.hero_title) continue;
          try {
            const p = JSON.parse(setRow.hero_title);
            if (p && typeof p === 'object') {
              const cleanRowId = String(setRow.id || '').replace(/^(company_profile_|cloud_company_|cloud_company_company_)/, '').toLowerCase();
              if (cleanRowId) profileMap.set(cleanRowId, p);
              if (p.id) profileMap.set(String(p.id).toLowerCase(), p);
              if (p.cnpjCpf || p.cnpj || p.cpf_cnpj || p.document) {
                const docClean = String(p.cnpjCpf || p.cnpj || p.cpf_cnpj || p.document).replace(/\D/g, '');
                if (docClean) profileMap.set(docClean, p);
              }
              if (p.email || p.loginEmail) {
                const emClean = String(p.email || p.loginEmail).trim().toLowerCase();
                if (emClean) profileMap.set(emClean, p);
              }
            }
          } catch {}
        }
      }

      const data = assinantesResult.value.data;
      if (Array.isArray(data) && isMountedRef.current) {
        const cloudSubs: Subscriber[] = data.map((row: any) => {
          const emailKey = (row.email || row.responsible_email || '').trim().toLowerCase();
          const idKey = String(row.id || emailKey);
          const docKey = String(row.cpf_cnpj || row.document || '').replace(/\D/g, '');
          
          // Localiza dados de endereço e perfil correspondentes
          const prof = profileMap.get(idKey.toLowerCase()) ||
                       (docKey ? profileMap.get(docKey) : null) ||
                       profileMap.get(emailKey) ||
                       null;

          const resolvedCep = row.cep || row.zip_code || row.zipCode || row.codigo_postal || prof?.zipCode || prof?.cep || prof?.zip_code || '';
          const resolvedStreet = row.logradouro || row.street || row.rua || row.address || row.endereco || prof?.address || prof?.street || prof?.logradouro || prof?.rua || '';
          const resolvedNumber = row.numero || row.number || row.num || prof?.number || prof?.numero || '';
          const resolvedNeighborhood = row.bairro || row.neighborhood || row.district || prof?.neighborhood || prof?.bairro || '';
          const resolvedCity = row.cidade || row.city || row.municipio || prof?.city || prof?.cidade || '';
          const resolvedState = row.estado || row.state || row.uf || prof?.state || prof?.estado || prof?.uf || '';
          const resolvedCpfCnpj = row.cpf_cnpj || row.document || prof?.cnpjCpf || prof?.cnpj || prof?.cpf_cnpj || '';
          const resolvedPhone = row.telefone || row.phone || prof?.phone || prof?.telefone || '';
          const resolvedStateReg = row.state_registration || row.inscricao_estadual || prof?.stateRegistration || prof?.inscricaoEstadual || undefined;

          // Conexão dinâmica estrita com os planos da tabela 'plans'
          const resolvedPlan = resolveSubscriberPlan(
            {
              id: idKey,
              name: row.nome || row.name || prof?.tradeName || prof?.corporateName || prof?.name || 'Assinante',
              responsibleEmail: emailKey,
              planId: row.plano_selecionado || row.plano_nome,
              planName: row.plano_nome || row.plano_selecionado,
              monthlyValue: Number(row.valor_mensal) || 0,
              status: normalizeSubscriberStatus(row.status),
              trialUntil: row.trial_ate ? new Date(row.trial_ate).toISOString().split('T')[0] : (row.trial_until || ''),
              createdAt: row.criado_em || row.created_at || new Date().toISOString(),
              updatedAt: row.criado_em || row.updated_at || new Date().toISOString(),
            },
            activePlans
          );

          return {
            id: idKey,
            name: row.nome || row.name || prof?.tradeName || prof?.corporateName || prof?.name || 'Assinante',
            responsibleEmail: emailKey,
            password: row.senha || row.password_hash || undefined,
            trialUntil: row.trial_ate ? new Date(row.trial_ate).toISOString().split('T')[0] : (row.trial_until || ''),
            cpfCnpj: resolvedCpfCnpj,
            stateRegistration: resolvedStateReg,
            phone: resolvedPhone,
            cep: resolvedCep,
            street: resolvedStreet,
            number: resolvedNumber,
            neighborhood: resolvedNeighborhood,
            city: resolvedCity,
            state: resolvedState,
            planId: resolvedPlan.planId,
            planName: resolvedPlan.planName,
            monthlyValue: resolvedPlan.monthlyValue,
            status: normalizeSubscriberStatus(row.status),
            createdAt: row.criado_em || row.created_at || new Date().toISOString(),
            updatedAt: row.criado_em || row.updated_at || new Date().toISOString(),
          };
        });

        updateSubscribersIfChanged(cloudSubs);
        subscribersRef.current = cloudSubs;
        try {
          localStorage.setItem(STORAGE_KEYS.SUBSCRIBERS, JSON.stringify(cloudSubs));
        } catch {}
      }
    } catch (err) {
      console.warn('Erro ao carregar assinantes em tempo real:', err);
    }
  }, [fetchCloudPlansDirectly, updatePlansIfChanged, updateSubscribersIfChanged]);

  const handleManualCloudSync = async () => {
    setIsSyncingCloud(true);
    try {
      await fetchSubscribersFromAssinantes();
      const cloudData = await syncMasterAdminFromCloud();
      if (cloudData.subscribers && cloudData.subscribers.length > 0) {
        updateSubscribersIfChanged(cloudData.subscribers);
      }
      if (cloudData.siteConfig) setSiteConfig(cloudData.siteConfig);
      if (cloudData.plans) setPlans(cloudData.plans);
    } finally {
      setIsSyncingCloud(false);
    }
  };

  // Sincronização centralizada, debounced e com cooldown mínimo de 8s entre requisições
  const triggerSafeCloudSync = useCallback(() => {
    if (syncDebounceTimerRef.current) {
      clearTimeout(syncDebounceTimerRef.current);
    }
    syncDebounceTimerRef.current = setTimeout(async () => {
      const now = Date.now();
      if (!isMountedRef.current || isSyncingRef.current || (now - lastSyncTimeRef.current < 8000)) {
        return;
      }
      isSyncingRef.current = true;
      try {
        const cloudData = await syncMasterAdminFromCloud();
        lastSyncTimeRef.current = Date.now();
        if (!isMountedRef.current) return;
        if (cloudData.subscribers && cloudData.subscribers.length > 0) {
          updateSubscribersIfChanged(cloudData.subscribers);
        }
        if (cloudData.siteConfig) {
          updateSiteConfigIfChanged(cloudData.siteConfig);
        }
        if (cloudData.plans && cloudData.plans.length > 0) {
          updatePlansIfChanged(cloudData.plans);
        }
      } catch (err) {
        console.warn('Aviso na sincronização do Supabase:', err);
      } finally {
        isSyncingRef.current = false;
      }
    }, 1200);
  }, [updateSubscribersIfChanged, updateSiteConfigIfChanged, updatePlansIfChanged]);

  // Listener dedicado e seguro para eventos em tempo real da tabela 'assinantes'
  // Implementa deduplicação rigorosa, bloqueio de updates circulares e integridade de planos dinâmicos
  const handleAssinantesRealtimeEvent = useCallback(async (payload: any) => {
    if (!isMountedRef.current) return;
    const eventType = payload.eventType;

    if (eventType === 'DELETE') {
      const deletedId = String(payload.old?.id || '');
      if (deletedId) {
        setSubscribers(prev => {
          const next = prev.filter(s => s.id !== deletedId);
          subscribersRef.current = next;
          try {
            localStorage.setItem(STORAGE_KEYS.SUBSCRIBERS, JSON.stringify(next));
          } catch {}
          return next;
        });
      }
      return;
    }

    if (eventType === 'INSERT') {
      // Novo cadastro recebido na plataforma
      await fetchSubscribersFromAssinantes();
      return;
    }

    if (eventType === 'UPDATE') {
      const newRow = payload.new;
      if (!newRow || !newRow.id) return;
      const subId = String(newRow.id);
      const cleanEmail = (newRow.email || '').trim().toLowerCase();

      // REGRA 1: Bloqueio de updates circulares e eco de gatilho manual interno recente (janela de 5s)
      const recentAction = recentManualActionsRef.current.get(subId);
      if (recentAction && Date.now() - recentAction.timestamp < 5000) {
        console.log('🛡️ [Realtime Eco] Ignorando eco de alteração manual recente para o assinante:', subId);
        return;
      }

      // Localiza o assinante atual em memória via ref sem disparar re-render
      const currentSub = subscribersRef.current.find(
        s => s.id === subId || s.responsibleEmail.trim().toLowerCase() === cleanEmail
      );

      if (currentSub) {
        // REGRA 2: Verificação de Integridade de Planos Dinâmicos consultando diretamente os planos oficiais
        const activePlans = plansRef.current.length > 0 ? plansRef.current : getStoredPlans();
        const incomingPlanRaw = newRow.plano_nome || newRow.plano_selecionado || '';
        const resolved = resolveSubscriberPlan(
          {
            ...currentSub,
            planId: incomingPlanRaw,
            planName: incomingPlanRaw,
            monthlyValue: Number(newRow.valor_mensal) || 0,
          },
          activePlans
        );

        const incomingStatus = normalizeSubscriberStatus(newRow.status);
        const incomingTrial = newRow.trial_ate 
          ? new Date(newRow.trial_ate).toISOString().split('T')[0] 
          : (newRow.trial_until || '');
        const incomingName = (newRow.nome || newRow.name || '').trim();
        const incomingPhone = (newRow.telefone || newRow.phone || '').trim();
        const incomingCpfCnpj = (newRow.cpf_cnpj || newRow.document || '').trim();

        // Deduplicação estrita: se os dados reativos recebidos forem idênticos ao estado atual, aborta imediatamente!
        const isSamePlan = currentSub.planName.trim().toLowerCase() === resolved.planName.trim().toLowerCase();
        const isSameValue = Math.abs((Number(currentSub.monthlyValue) || 0) - resolved.monthlyValue) < 0.01;
        const isSameStatus = currentSub.status === incomingStatus;
        const isSameName = currentSub.name.trim() === incomingName;
        const isSameTrial = (currentSub.trialUntil || '') === incomingTrial;
        const isSamePhone = (currentSub.phone || '').trim() === incomingPhone;
        const isSameDoc = (currentSub.cpfCnpj || '').trim() === incomingCpfCnpj;

        if (isSamePlan && isSameValue && isSameStatus && isSameName && isSameTrial && isSamePhone && isSameDoc) {
          console.log('🛡️ [Realtime Deduplicação] Update idêntico aos dados atuais em memória. Abortando atualização circular:', subId);
          return;
        }

        // Se houve alteração legítima externa, atualiza apenas em memória local sem disparar gravações no banco
        const updatedSubscriber: Subscriber = {
          ...currentSub,
          name: incomingName || currentSub.name,
          status: incomingStatus,
          planId: resolved.planId,
          planName: resolved.planName,
          monthlyValue: resolved.monthlyValue,
          trialUntil: incomingTrial || currentSub.trialUntil,
          phone: incomingPhone || currentSub.phone,
          cpfCnpj: incomingCpfCnpj || currentSub.cpfCnpj,
          updatedAt: newRow.atualizado_em || newRow.updated_at || new Date().toISOString(),
        };

        setSubscribers(prev => {
          const next = prev.map(s => (s.id === subId || s.responsibleEmail.trim().toLowerCase() === cleanEmail) ? updatedSubscriber : s);
          subscribersRef.current = next;
          try {
            localStorage.setItem(STORAGE_KEYS.SUBSCRIBERS, JSON.stringify(next));
          } catch {}
          return next;
        });
        return;
      }

      // Se o assinante não estava em memória, sincroniza com integridade
      await fetchSubscribersFromAssinantes();
    }
  }, [fetchSubscribersFromAssinantes]);

  // REGRA 3: Limpeza Geral de Ouvintes Automáticos e Ciclo de Vida Seguro
  useEffect(() => {
    isMountedRef.current = true;

    // Sincronização segura com dados locais do localStorage sem permitir rollback de planos da nuvem
    const handleLocalSync = () => {
      if (!isMountedRef.current) return;
      updateSiteConfigIfChanged(getStoredSiteConfig());
      if (plansRef.current.length === 0) {
        updatePlansIfChanged(getStoredPlans());
      }
      updateSettingsIfChanged(getStoredAdminSettings());
    };

    // 1. Carga inicial com verificação de integridade de planos dinâmicos
    fetchSubscribersFromAssinantes();
    triggerSafeCloudSync();

    // 2. Canal Realtime unificado e gerenciado (Elimina concorrência e duplicidade de listeners)
    let masterRealtimeChannel: any = null;
    if (isSupabaseConfigured) {
      masterRealtimeChannel = supabase
        .channel(`master_admin_stream_${Date.now()}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'assinantes' },
          handleAssinantesRealtimeEvent
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'plans' },
          async () => {
            console.log('⚡ [Realtime] Planos comerciais alterados na nuvem');
            const freshPlans = await fetchCloudPlansDirectly();
            if (freshPlans.length > 0 && isMountedRef.current) {
              updatePlansIfChanged(freshPlans);
              plansRef.current = freshPlans;
              await fetchSubscribersFromAssinantes();
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'site_settings' },
          () => {
            triggerSafeCloudSync();
          }
        )
        .subscribe();
    }

    // 3. Ouvintes de eventos do navegador entre abas
    const handleStorage = (e: StorageEvent) => {
      if (
        e.key === AGROCONTROL_SITE_SETTINGS_KEY ||
        e.key === 'landingPageSettings' ||
        e.key === 'silagem_master_site_config_v1'
      ) {
        handleLocalSync();
      }
    };

    window.addEventListener('master_admin_data_changed', handleLocalSync);
    window.addEventListener('agrocontrol_site_settings_updated', handleLocalSync);
    window.addEventListener('landing_page_settings_updated', handleLocalSync);
    window.addEventListener('storage', handleStorage);

    // 4. Limpeza rigorosa no desmonte: cancela todos os canais e timers ativos
    return () => {
      isMountedRef.current = false;
      if (syncDebounceTimerRef.current) {
        clearTimeout(syncDebounceTimerRef.current);
        syncDebounceTimerRef.current = null;
      }
      if (masterRealtimeChannel) {
        try {
          supabase.removeChannel(masterRealtimeChannel);
        } catch (err) {
          console.warn('Aviso ao remover canal Realtime:', err);
        }
      }
      window.removeEventListener('master_admin_data_changed', handleLocalSync);
      window.removeEventListener('agrocontrol_site_settings_updated', handleLocalSync);
      window.removeEventListener('landing_page_settings_updated', handleLocalSync);
      window.removeEventListener('storage', handleStorage);
    };
  }, [fetchCloudPlansDirectly, fetchSubscribersFromAssinantes, handleAssinantesRealtimeEvent, triggerSafeCloudSync, updatePlansIfChanged, updateSettingsIfChanged, updateSiteConfigIfChanged]);

  // Sincroniza o formulário do site apenas quando a aba 'site' for acessada e houver alteração real
  useEffect(() => {
    if (adminTab === 'site') {
      const freshConfig = getStoredSiteConfig();
      setSiteForm(prev => (isDeepEqual(prev, freshConfig) ? prev : freshConfig));
    }
  }, [adminTab]);

  // Recalcular métricas em tempo real com JOIN dinâmico de valores dos planos
  const metrics = useMemo(() => {
    const list = Array.isArray(subscribers) ? subscribers.filter(Boolean) : [];
    const baseMetrics = computeMasterMetrics(list);
    // Calcula o MRR usando o valor dinâmico de cada plano ativo
    const dynamicMrr = list
      .filter(s => (s?.status || '').toLowerCase() === 'ativa')
      .reduce((sum, s) => {
        const resolved = resolveSubscriberPlan(s, plans);
        return sum + resolved.monthlyValue;
      }, 0);

    return {
      ...baseMetrics,
      estimatedMrr: dynamicMrr,
    };
  }, [subscribers, plans]);

  // Filtrar assinantes instantaneamente por status e busca (100% à prova de valores nulos ou incompletos)
  const filteredSubscribers = useMemo(() => {
    if (!Array.isArray(subscribers)) return [];
    return subscribers.filter(sub => {
      if (!sub) return false;
      const subStatus = (sub?.status || 'trial').toLowerCase();
      if (statusFilter !== 'todas' && subStatus !== statusFilter.toLowerCase()) {
        return false;
      }
      if (searchQuery && searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const resolved = resolveSubscriberPlan(sub, plans);
        const matchesName = (sub?.name || '').toLowerCase().includes(q);
        const matchesEmail = (sub?.responsibleEmail || '').toLowerCase().includes(q);
        const matchesDoc = (sub?.cpfCnpj || '').toLowerCase().includes(q);
        const matchesCity = (sub?.city || '').toLowerCase().includes(q);
        const matchesPlan = (sub?.planName || '').toLowerCase().includes(q) || (resolved.planName || '').toLowerCase().includes(q);
        return matchesName || matchesEmail || matchesDoc || matchesCity || matchesPlan;
      }
      return true;
    });
  }, [subscribers, statusFilter, searchQuery, plans]);

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
    if (!sub) return;
    if (onImpersonate) {
      onImpersonate(sub);
    } else {
      localStorage.setItem('is_admin_impersonating', 'true');
      localStorage.setItem('impersonated_subscriber_id', sub?.id || '');
      localStorage.setItem('impersonated_subscriber_name', sub?.name || 'Assinante');
      localStorage.setItem('impersonated_subscriber_email', sub?.responsibleEmail || '');
      localStorage.setItem('current_company_id', sub?.id || '');
      localStorage.setItem('user_role', 'admin');
      localStorage.setItem('silagem_client_session', 'active');
      window.location.href = '/dashboard';
    }
  };

  // Atualização atômica de assinantes vinda de modais especializados (Planos, Trial, Status)
  // Evita re-executar upsertCloudSubscriber que causava o loop de eco reativo
  const handleSpecializedModalSuccess = (updatedSub: Subscriber) => {
    if (!updatedSub || !updatedSub.id) return;
    // Registra alteração manual recente para bloquear eco do Realtime nos próximos 5 segundos
    recentManualActionsRef.current.set(updatedSub.id, { timestamp: Date.now(), payload: updatedSub });

    setSubscribers(prev => {
      const next = prev.map(s => s.id === updatedSub.id ? updatedSub : s);
      subscribersRef.current = next;
      try {
        localStorage.setItem(STORAGE_KEYS.SUBSCRIBERS, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // 2. Salvar Assinante com UPDATE real no banco de dados Supabase (usado pelo modal de edição completa)
  const handleSaveSubscriber = async (saved: Subscriber) => {
    if (!saved || !saved.id) return;
    // Registra alteração manual recente para bloquear eco
    recentManualActionsRef.current.set(saved.id, { timestamp: Date.now(), payload: saved });

    const currentList = Array.isArray(subscribers) ? subscribers : [];
    const exists = currentList.some(s => s?.id === saved.id);
    let updatedList: Subscriber[];
    if (exists) {
      updatedList = currentList.map(s => s?.id === saved.id ? saved : s);
    } else {
      updatedList = [saved, ...currentList];
    }
    setSubscribers(updatedList);
    subscribersRef.current = updatedList;
    saveStoredSubscribers(updatedList);

    try {
      await upsertCloudSubscriber(saved);
      const profilePayload: CompanyProfile = {
        id: saved.id,
        corporateName: saved.name.trim(),
        tradeName: saved.name.trim(),
        name: saved.name.trim(),
        cnpjCpf: saved.cpfCnpj || '',
        stateRegistration: saved.stateRegistration || '',
        phone: saved.phone || '',
        email: saved.responsibleEmail.trim().toLowerCase(),
        loginEmail: saved.responsibleEmail.trim().toLowerCase(),
        zipCode: saved.cep || '',
        address: saved.street || '',
        number: saved.number || '',
        neighborhood: saved.neighborhood || '',
        city: saved.city || '',
        state: saved.state || '',
      };
      await saveCloudCompanyProfile(profilePayload, saved.id);
      showToast(`Assinante "${saved.name || 'Assinante'}" atualizado no Supabase com sucesso!`);
    } catch (err) {
      console.warn('Aviso ao salvar assinante na nuvem:', err);
    }
  };

  // Excluir Assinante com remoção estrita da tabela 'assinantes', Supabase Auth e tabelas de acesso
  const handleDeleteSubscriber = async (idDoAssinante: string, name: string, email?: string) => {
    if (!window.confirm(`Tem certeza que deseja remover o assinante "${name || 'Assinante'}"? Esta ação é irreversível e revogará todos os acessos.`)) {
      return;
    }

    const cleanEmail = email && email.trim() !== '-' ? email.trim().toLowerCase() : undefined;
    const derivedUuid = toValidUUID(idDoAssinante);

    try {
      // 1. Exclusão direta na tabela oficial 'assinantes' do Supabase
      // Padrão solicitado: const { error } = await supabase.from('assinantes').delete().eq('id', idDoAssinante);
      const { error } = await supabase
        .from('assinantes')
        .delete()
        .eq('id', idDoAssinante);

      if (error) {
        console.warn('Aviso ao deletar de assinantes por ID:', error.message);
        // Se o banco Postgres esperar UUID e idDoAssinante for formato texto legado, tenta com UUID correspondente
        try {
          if (derivedUuid && derivedUuid !== idDoAssinante) {
            await supabase.from('assinantes').delete().eq('id', derivedUuid);
          }
        } catch {}
      }

      // Se houver e-mail válido, remove também por email para garantir limpeza total no banco
      if (cleanEmail) {
        await supabase
          .from('assinantes')
          .delete()
          .eq('email', cleanEmail);
      }

      // 2. Chamar a API de gerenciamento de usuários do Supabase (supabase.auth.admin.deleteUser)
      // passando o ID de autenticação do usuário correspondente para remover completamente o login dele do sistema
      try {
        if ((supabase.auth as any)?.admin?.deleteUser) {
          const { error: authError } = await (supabase.auth as any).admin.deleteUser(idDoAssinante);
          if (authError) {
            console.warn('Aviso ao executar supabase.auth.admin.deleteUser:', authError.message);
            if (derivedUuid && derivedUuid !== idDoAssinante) {
              await (supabase.auth as any).admin.deleteUser(derivedUuid);
            }
          }
        }
      } catch (authDelErr) {
        console.warn('Erro ao chamar supabase.auth.admin.deleteUser:', authDelErr);
      }

      // 3. Atualizar/limpar tabelas de usuários, empresas e acessos associados (coluna status como 'cancelado'/'inativo' e exclusão)
      // Tabela de espelho/contingência 'subscribers'
      try {
        await supabase.from('subscribers').update({ status: 'cancelado' }).eq('id', idDoAssinante);
        await supabase.from('subscribers').delete().eq('id', idDoAssinante);
        if (derivedUuid && derivedUuid !== idDoAssinante) {
          await supabase.from('subscribers').update({ status: 'cancelado' }).eq('id', derivedUuid);
          await supabase.from('subscribers').delete().eq('id', derivedUuid);
        }
        if (cleanEmail) {
          await supabase.from('subscribers').update({ status: 'cancelado' }).eq('email', cleanEmail);
          await supabase.from('subscribers').delete().eq('email', cleanEmail);
        }
      } catch {}

      // Tabela de usuários do sistema ('usuarios' e 'users')
      try {
        await supabase.from('usuarios').update({ status: 'inativo' }).eq('id', idDoAssinante);
        await supabase.from('usuarios').delete().eq('id', idDoAssinante);
        if (cleanEmail) {
          await supabase.from('usuarios').update({ status: 'inativo' }).eq('email', cleanEmail);
          await supabase.from('usuarios').delete().eq('email', cleanEmail);
        }
      } catch {}

      try {
        await supabase.from('users').update({ status: 'inativo' }).eq('id', idDoAssinante);
        await supabase.from('users').delete().eq('id', idDoAssinante);
        if (cleanEmail) {
          await supabase.from('users').update({ status: 'inativo' }).eq('email', cleanEmail);
          await supabase.from('users').delete().eq('email', cleanEmail);
        }
      } catch {}

      // Tabela de empresas associadas ('empresas' e 'companies')
      try {
        await supabase.from('empresas').update({ status: 'cancelado' }).eq('id', idDoAssinante);
        await supabase.from('empresas').delete().eq('id', idDoAssinante);
      } catch {}

      try {
        await supabase.from('companies').update({ status: 'cancelado' }).eq('id', idDoAssinante);
        await supabase.from('companies').delete().eq('id', idDoAssinante);
      } catch {}

      // Executa exclusão complementar nas tabelas de nuvem
      await deleteCloudSubscriber(idDoAssinante, cleanEmail);

      // 4. Limpeza de sessões e perfil da empresa no navegador se pertencerem a esta conta
      if (typeof localStorage !== 'undefined') {
        const activeSubId = localStorage.getItem('silagem_active_subscriber_id');
        const activeUserEmail = localStorage.getItem('silagem_active_user_email') || localStorage.getItem('silagem_active_subscriber_email');
        const impersonatedSubId = localStorage.getItem('impersonated_subscriber_id');
        const currentCompanyId = localStorage.getItem('current_company_id');

        const isSameAccount =
          activeSubId === idDoAssinante ||
          impersonatedSubId === idDoAssinante ||
          currentCompanyId === idDoAssinante ||
          (cleanEmail && activeUserEmail && activeUserEmail.toLowerCase() === cleanEmail);

        if (isSameAccount) {
          localStorage.removeItem('silagem_client_session');
          localStorage.removeItem('silagem_active_user_email');
          localStorage.removeItem('silagem_active_subscriber_email');
          localStorage.removeItem('silagem_active_subscriber_id');
          localStorage.removeItem('is_admin_impersonating');
          localStorage.removeItem('impersonated_subscriber_id');
          localStorage.removeItem('impersonated_subscriber_name');
          localStorage.removeItem('impersonated_subscriber_email');
          localStorage.removeItem('current_company_id');
        }

        try {
          const comp = getStoredCompanyProfile();
          const compEmail = (comp.loginEmail || comp.email || '').toLowerCase();
          if (comp.id === idDoAssinante || (cleanEmail && compEmail === cleanEmail)) {
            saveStoredCompanyProfile({
              ...comp,
              loginEmail: '',
              activitySector: 'CANCELADO / INATIVO',
            });
          }
        } catch {}
      }

      // 5. LOGO APÓS O RETORNO DA OPERAÇÃO:
      // Atualiza o estado local do React filtrando o item removido da lista
      // para que ele suma da tela instantaneamente sem precisar de F5
      setSubscribers(prev => {
        const nextList = (prev || []).filter(sub => {
          if (!sub) return false;
          const matchId = sub.id === idDoAssinante || String(sub.id) === String(idDoAssinante);
          const matchEmail = cleanEmail && sub.responsibleEmail && sub.responsibleEmail.toLowerCase() === cleanEmail;
          return !matchId && !matchEmail;
        });
        saveStoredSubscribers(nextList);
        return nextList;
      });

      showToast(`Assinante "${name || 'Assinante'}" e logins associados excluídos com sucesso.`);
    } catch (err) {
      console.error('Erro ao excluir assinante da tabela assinantes e serviços de autenticação:', err);
      // Em caso de falha de rede, garante a remoção local para feedback imediato
      setSubscribers(prev => {
        const nextList = (prev || []).filter(sub => sub && sub.id !== idDoAssinante && String(sub.id) !== String(idDoAssinante));
        saveStoredSubscribers(nextList);
        return nextList;
      });
      showToast(`Assinante "${name || 'Assinante'}" removido localmente.`);
    }
  };

  // 3. Alternar Status Rápido do Assinante com sincronização direta no Supabase
  const handleQuickStatusChange = async (id: string, newStatus: SubscriberStatus) => {
    // Registra alteração manual recente para bloquear eco
    recentManualActionsRef.current.set(id, { timestamp: Date.now(), payload: { status: newStatus } });

    const currentList = Array.isArray(subscribers) ? subscribers : [];
    const updated = currentList.map(s => {
      if (s?.id === id) {
        return { ...s, status: newStatus, updatedAt: new Date().toISOString() };
      }
      return s;
    });
    setSubscribers(updated);
    subscribersRef.current = updated;
    saveStoredSubscribers(updated);

    try {
      const dbStatus = newStatus === 'ativa' ? 'Ativa' : newStatus === 'suspensa' ? 'Suspenso' : newStatus;
      await updateCloudSubscriberStatus(id, dbStatus);
      showToast(`Status atualizado para "${newStatus}" no Supabase.`);
    } catch (err) {
      console.warn('Aviso ao sincronizar status no Supabase:', err);
    }
  };

  // Salvar Plano com sanitização estrita de ID e sincronização resiliente com Supabase
  const handleSavePlan = async (savedPlan: PlanDefinition) => {
    // 1. Sanitização estrita do ID e validação dos dados antes de qualquer persistência
    const cleanId = sanitizePlanId(savedPlan.id, savedPlan.name);

    const sanitizedPlan: PlanDefinition = {
      ...savedPlan,
      id: cleanId,
      name: (savedPlan.name || 'Plano Comercial').trim(),
      description: (savedPlan.description || '').trim(),
      price: Number(savedPlan.price) || 0,
      billingCycle: savedPlan.billingCycle === 'anual' ? 'anual' : 'mensal',
      badge: savedPlan.badge ? savedPlan.badge.trim() : undefined,
      isFeatured: Boolean(savedPlan.isFeatured),
      isActive: savedPlan.isActive !== undefined ? Boolean(savedPlan.isActive) : true,
      displayOrder: Number(savedPlan.displayOrder) || 1,
      limits: typeof savedPlan.limits === 'object' && savedPlan.limits ? savedPlan.limits : {
        maxUsers: 5,
        maxMachineries: 10,
        maxClients: 100,
        storageLimitGb: 5,
      },
      featuresText: (savedPlan.featuresText || '').trim(),
      checkoutUrl: (savedPlan.checkoutUrl || '').trim(),
    };

    // 2. Atualizar estado local garantindo ausência de duplicatas de ID
    const existsIndex = plans.findIndex(p => p.id === cleanId || (savedPlan.id && p.id === savedPlan.id));
    let updated: PlanDefinition[];
    if (existsIndex >= 0) {
      updated = [...plans];
      updated[existsIndex] = sanitizedPlan;
    } else {
      updated = [...plans, sanitizedPlan];
    }

    // Ordenar por ordem de exibição
    updated.sort((a, b) => a.displayOrder - b.displayOrder);
    setPlans(updated);

    // 3. Centralização do localStorage: salvar na chave global única padronizada 'agrocontrol_plans_data'
    if (typeof localStorage !== 'undefined') {
      const serialized = JSON.stringify(updated);
      localStorage.setItem('agrocontrol_plans_data', serialized);
      localStorage.setItem(AGROCONTROL_PLANS_DATA_KEY, serialized);
    }

    // 4. Notificação em tempo real via CustomEvents e StorageEvent para a Landing Page
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('agrocontrol_plans_updated', { detail: updated }));
      window.dispatchEvent(new CustomEvent('master_admin_data_changed', { detail: updated }));
      try {
        window.dispatchEvent(new Event('storage'));
      } catch (e) {
        // Fallback
      }
    }

    // 5. Sincronização direta e segura com o Supabase (específica para o plano salvo)
    try {
      const success = await upsertCloudPlan(sanitizedPlan);
      if (success) {
        showToast(`Plano "${sanitizedPlan.name}" salvo e sincronizado com o Supabase com sucesso!`);
      } else {
        showToast(`Plano "${sanitizedPlan.name}" salvo localmente.`);
      }
    } catch (err) {
      console.warn('Aviso ao sincronizar plano no Supabase:', err);
      showToast(`Plano "${sanitizedPlan.name}" salvo localmente.`);
    }
  };

  // Excluir Plano
  const handleDeletePlan = async (id: string, name: string) => {
    if (window.confirm(`Deseja realmente excluir o plano "${name}"?`)) {
      const cleanId = sanitizePlanId(id, name);
      const updated = plans.filter(p => p.id !== id && p.id !== cleanId);
      setPlans(updated);

      // Centralização do localStorage: salvar na chave global padronizada
      if (typeof localStorage !== 'undefined') {
        const serialized = JSON.stringify(updated);
        localStorage.setItem('agrocontrol_plans_data', serialized);
        localStorage.setItem(AGROCONTROL_PLANS_DATA_KEY, serialized);
      }

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

      try {
        await deleteCloudPlan(cleanId);
        showToast(`Plano "${name}" removido com sucesso.`);
      } catch (err) {
        console.warn('Notice deleting plan from cloud:', err);
      }
    }
  };

  // Manipulador reativo e imediato para o interruptor (Toggle) de Período de Teste Grátis (Trial)
  const handleToggleFreeTrial = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // 3. Captura o estado booleano do clique (onChange) antes de disparar o Supabase
    const newValue = Boolean(e.target.checked);

    // Atualização imediata do estado local do React
    const updatedForm = { ...siteForm, allow_free_trial: newValue };
    setSiteForm(updatedForm);
    setSiteConfig((prev) => ({ ...prev, allow_free_trial: newValue }));

    // Persistência local imediata
    if (typeof localStorage !== 'undefined') {
      const serialized = JSON.stringify(updatedForm);
      localStorage.setItem('agrocontrol_site_settings', serialized);
      localStorage.setItem('landingPageSettings', serialized);
    }
    saveStoredSiteConfig(updatedForm);

    // Dispara eventos globais para atualização instantânea da Landing Page e AuthPage
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('agrocontrol_site_settings_updated', { detail: updatedForm }));
      window.dispatchEvent(new CustomEvent('landing_page_settings_updated', { detail: updatedForm }));
      window.dispatchEvent(new CustomEvent('master_admin_data_changed', { detail: updatedForm }));
      try {
        window.dispatchEvent(new Event('storage'));
      } catch {}
    }

    // 1 & 2. Envio explícito para o Supabase com id: "default_settings" e campo allow_free_trial
    try {
      const payload = {
        id: 'default_settings',
        allow_free_trial: newValue,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('site_settings')
        .upsert(payload, { onConflict: 'id' });

      if (error) {
        console.error('Erro ao gravar allow_free_trial no Supabase:', error);
        showToast('Aviso: Falha ao salvar no Supabase (' + error.message + ')');
      } else {
        showToast(
          newValue
            ? 'Período de Teste Grátis ATIVADO no Supabase!'
            : 'Período de Teste Grátis DESATIVADO no Supabase!'
        );
      }
    } catch (err) {
      console.error('Falha ao disparar upsert em site_settings:', err);
    }
  };

  // Salvar Configurações do Site (Landing Page Pública)
  const handleSaveSiteConfig = async (e?: React.FormEvent) => {
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

      // 1 & 2. Objeto de Envio (Payload) explícito com id: "default_settings" e campo allow_free_trial
      const payload = {
        id: 'default_settings',
        allow_free_trial: Boolean(siteForm.allow_free_trial),
        updated_at: new Date().toISOString()
      };

      // Dispara o upsert direto no Supabase para anular o erro de on_conflict
      const { error } = await supabase
        .from('site_settings')
        .upsert(payload, { onConflict: 'id' });

      if (error) {
        console.error('Erro ao salvar site_settings no Supabase:', error);
      }

      // Sincronização em nuvem de outros campos via serviço com payload tratado
      await upsertCloudSiteConfig(siteForm);

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
      showToast('Configurações da Landing Page salvas com sucesso no Supabase!');
      setTimeout(() => setSiteSaveSuccess(false), 4500);
    } catch (err) {
      console.error('Erro ao salvar configurações da Landing Page:', err);
      showToast('Erro ao salvar configurações.');
    }
  };

  // Funções Auxiliares para Abas Interativas dos Recursos
  const handleAddFeatureTab = () => {
    const currentTabs = siteForm.features_tabs || [];
    const newTab: FeatureTabItem = {
      id: `tab-${Date.now()}`,
      title: 'Nova Funcionalidade',
      iconName: 'Tractor',
      description: 'Descrição detalhada dos diferenciais e recursos tecnológicos desta funcionalidade.',
      bullets: [
        'Benefício prático e redução de custos no campo',
        'Controle automatizado e integração com o sistema',
      ],
      imageUrl: '/image.png',
    };
    setSiteForm({ ...siteForm, features_tabs: [...currentTabs, newTab] });
  };

  const handleUpdateFeatureTab = (index: number, updatedTab: FeatureTabItem) => {
    const currentTabs = [...(siteForm.features_tabs || [])];
    currentTabs[index] = updatedTab;
    setSiteForm({ ...siteForm, features_tabs: currentTabs });
  };

  const handleRemoveFeatureTab = (index: number) => {
    const currentTabs = [...(siteForm.features_tabs || [])];
    currentTabs.splice(index, 1);
    setSiteForm({ ...siteForm, features_tabs: currentTabs });
  };

  // Funções Auxiliares para Checks Verdes dos Planos na Landing Page
  const handleUpdatePlanBadge = (plan: PlanDefinition, badge: string) => {
    handleSavePlan({ ...plan, badge });
  };

  const handleUpdatePlanFeature = (plan: PlanDefinition, featureIndex: number, newText: string) => {
    const lines = (plan.featuresText || '').split('\n');
    lines[featureIndex] = newText;
    handleSavePlan({ ...plan, featuresText: lines.join('\n') });
  };

  const handleAddPlanFeature = (plan: PlanDefinition) => {
    const lines = plan.featuresText ? plan.featuresText.split('\n').filter(Boolean) : [];
    lines.push('Novo benefício operacional');
    handleSavePlan({ ...plan, featuresText: lines.join('\n') });
  };

  const handleRemovePlanFeature = (plan: PlanDefinition, featureIndex: number) => {
    const lines = (plan.featuresText || '').split('\n');
    lines.splice(featureIndex, 1);
    handleSavePlan({ ...plan, featuresText: lines.join('\n') });
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
    <div 
      id="master-admin-root" 
      className="master-admin-container min-h-screen bg-[#1a1d24] text-white flex font-['Plus_Jakarta_Sans',sans-serif] relative selection:bg-[#3a4150] selection:text-white"
    >
      
      {/* Backdrop Mobile para fechar a Sidebar */}
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* 1. BARRA LATERAL VERTICAL (SIDEBAR) FIXA NA EXTREMIDADE ESQUERDA - #14161d */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-64 xl:w-72 bg-[#14161d] border-r border-[#232732] flex flex-col justify-between select-none h-screen transition-transform duration-300 ease-in-out ${
          isMobileSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Topo da Sidebar: Identidade Visual e Fechamento Mobile */}
        <div className="p-4 sm:p-5 border-b border-[#232732] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#252a34] border border-[#2f3644] flex items-center justify-center text-white font-black text-sm shadow-xs">
              AM
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black tracking-tight text-white">
                  Admin Mestre
                </h1>
                <span className="text-[9px] bg-[#252a34] text-[#8a92a6] border border-[#2f3644] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  Super
                </span>
              </div>
              <p className="text-[11px] text-[#8a92a6] font-medium">
                Painel Central Global
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(false)}
            className="md:hidden p-1.5 rounded-lg text-[#8a92a6] hover:text-white hover:bg-[#252a34] transition cursor-pointer"
            title="Fechar menu lateral"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Itens do Menu Empilhados Verticalmente */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
          <div className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-[#8a92a6]">
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
                ? 'bg-[#252a34] text-white border border-[#2f3644] shadow-xs'
                : 'text-[#8a92a6] hover:text-white hover:bg-[#1a1d24] border border-transparent'
            }`}
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className={`p-2.5 rounded-xl transition shrink-0 ${
                adminTab === 'assinantes'
                  ? 'bg-[#3a4150] text-white'
                  : 'bg-[#1e222b] text-[#8a92a6] group-hover:text-white group-hover:bg-[#252a34]'
              }`}>
                <Users className="w-5 h-5" />
              </div>
              <div className="truncate">
                <div className={`text-sm sm:text-[15px] leading-snug truncate ${
                  adminTab === 'assinantes' ? 'text-white font-black' : 'text-white font-bold group-hover:text-white'
                }`}>
                  Assinantes
                </div>
                <div className="text-xs text-[#8a92a6] font-medium truncate mt-0.5">
                  Clientes e Contratos
                </div>
              </div>
            </div>
            <span className={`px-2.5 py-1 text-xs rounded-full font-bold shrink-0 ml-2 ${
              adminTab === 'assinantes'
                ? 'bg-[#3a4150] text-white font-bold'
                : 'bg-[#1e222b] text-[#8a92a6] group-hover:text-white'
            }`}>
              {(subscribers || []).length}
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
                ? 'bg-[#252a34] text-white border border-[#2f3644] shadow-xs'
                : 'text-[#8a92a6] hover:text-white hover:bg-[#1a1d24] border border-transparent'
            }`}
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className={`p-2.5 rounded-xl transition shrink-0 ${
                adminTab === 'planos'
                  ? 'bg-[#3a4150] text-white'
                  : 'bg-[#1e222b] text-[#8a92a6] group-hover:text-white group-hover:bg-[#252a34]'
              }`}>
                <Tag className="w-5 h-5" />
              </div>
              <div className="truncate">
                <div className={`text-sm sm:text-[15px] leading-snug truncate ${
                  adminTab === 'planos' ? 'text-white font-black' : 'text-white font-bold group-hover:text-white'
                }`}>
                  Módulo de Planos
                </div>
                <div className="text-xs text-[#8a92a6] font-medium truncate mt-0.5">
                  Tabelas de Preços
                </div>
              </div>
            </div>
            <span className={`px-2.5 py-1 text-xs rounded-full font-bold shrink-0 ml-2 ${
              adminTab === 'planos'
                ? 'bg-[#3a4150] text-white font-bold'
                : 'bg-[#1e222b] text-[#8a92a6] group-hover:text-white'
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
                ? 'bg-[#252a34] text-white border border-[#2f3644] shadow-xs'
                : 'text-[#8a92a6] hover:text-white hover:bg-[#1a1d24] border border-transparent'
            }`}
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className={`p-2.5 rounded-xl transition shrink-0 ${
                adminTab === 'site'
                  ? 'bg-[#3a4150] text-white'
                  : 'bg-[#1e222b] text-[#8a92a6] group-hover:text-white group-hover:bg-[#252a34]'
              }`}>
                <Globe className="w-5 h-5" />
              </div>
              <div className="truncate">
                <div className={`text-sm sm:text-[15px] leading-snug truncate ${
                  adminTab === 'site' ? 'text-white font-black' : 'text-white font-bold group-hover:text-white'
                }`}>
                  Configurações do Site
                </div>
                <div className="text-xs text-[#8a92a6] font-medium truncate mt-0.5">
                  Landing Page Pública
                </div>
              </div>
            </div>
            {adminTab === 'site' && (
              <div className="w-2 h-2 rounded-full bg-white shadow-xs shrink-0 ml-2" />
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
                ? 'bg-[#252a34] text-white border border-[#2f3644] shadow-xs'
                : 'text-[#8a92a6] hover:text-white hover:bg-[#1a1d24] border border-transparent'
            }`}
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className={`p-2.5 rounded-xl transition shrink-0 ${
                adminTab === 'configuracoes'
                  ? 'bg-[#3a4150] text-white'
                  : 'bg-[#1e222b] text-[#8a92a6] group-hover:text-white group-hover:bg-[#252a34]'
              }`}>
                <Key className="w-5 h-5" />
              </div>
              <div className="truncate">
                <div className={`text-sm sm:text-[15px] leading-snug truncate ${
                  adminTab === 'configuracoes' ? 'text-white font-black' : 'text-white font-bold group-hover:text-white'
                }`}>
                  Webhooks & Admins
                </div>
                <div className="text-xs text-[#8a92a6] font-medium truncate mt-0.5">
                  Segurança & Integrações
                </div>
              </div>
            </div>
            {adminTab === 'configuracoes' && (
              <div className="w-2 h-2 rounded-full bg-white shadow-xs shrink-0 ml-2" />
            )}
          </button>
        </div>

        {/* Rodapé da Sidebar: Sessão & Ações Rápidas */}
        <div className="p-3 sm:p-4 border-t border-[#232732] space-y-2 bg-[#14161d] shrink-0">
          {session && (
            <div className="px-3 py-2 rounded-xl bg-[#1a1d24] border border-[#2f3644] text-xs">
              <div className="flex items-center gap-2 mb-0.5">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#8a92a6]">
                  Super Admin
                </span>
              </div>
              <div className="font-mono text-white font-bold text-[11px] truncate" title={session.email}>
                {session.email}
              </div>
            </div>
          )}

          <div className="pt-1 space-y-1">
            <button
              type="button"
              onClick={onOpenLandingPage}
              className="w-full px-3 py-2 bg-[#1e222b] hover:bg-[#252a34] text-[#8a92a6] hover:text-white rounded-xl text-xs font-bold flex items-center gap-2.5 transition cursor-pointer border border-[#2f3644]"
              title="Abrir a Landing Page pública de vendas"
            >
              <Globe className="w-3.5 h-3.5 text-[#8a92a6] shrink-0" />
              <span className="truncate">Ver Landing Page</span>
            </button>

            <button
              type="button"
              onClick={onBackToApp}
              className="w-full px-3 py-2 bg-[#3a4150] hover:bg-[#475062] active:bg-[#2d3340] text-white rounded-xl text-xs font-bold flex items-center gap-2.5 transition cursor-pointer border border-[#4d576a] shadow-xs"
              title="Acessar o ERP Interno"
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Abrir ERP Silagem Fácil</span>
            </button>

            <button
              type="button"
              onClick={handleLogoutMaster}
              className="w-full px-3 py-2 bg-[#1a1d24] hover:bg-[#252a34] hover:text-rose-300 text-[#8a92a6] rounded-xl text-xs font-bold flex items-center gap-2.5 transition cursor-pointer border border-[#2f3644]"
              title="Encerrar sessão e deslogar do Admin Mestre"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span className="truncate">Sair do Master</span>
            </button>
          </div>
        </div>
      </aside>

      {/* 2. ÁREA DE EXIBIÇÃO DA DIREITA (Começa logo após a Sidebar) */}
      <div className="flex-1 md:pl-64 xl:pl-72 flex flex-col min-h-screen w-full min-w-0 bg-[#1a1d24]">
        
        {/* TopBar Superior da Área de Conteúdo */}
        <header className="bg-[#1a1d24]/95 backdrop-blur-md border-b border-[#2f3644] sticky top-0 z-30 px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* Botão Hambúrguer Mobile */}
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="md:hidden p-2 rounded-xl bg-[#252a34] text-[#8a92a6] hover:text-white hover:bg-[#343a46] transition shrink-0 cursor-pointer border border-[#2f3644]"
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
                <span className="text-[10px] bg-[#252a34] text-[#8a92a6] border border-[#2f3644] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider hidden sm:inline-block shrink-0">
                  {adminTab === 'assinantes' && `${(subscribers || []).length} registros`}
                  {adminTab === 'planos' && `${(plans || []).length} planos`}
                  {adminTab === 'site' && 'Landing Page'}
                  {adminTab === 'configuracoes' && 'Segurança'}
                </span>
              </div>
              <p className="text-xs text-[#8a92a6] hidden sm:block truncate">
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
              className="px-3 py-1.5 bg-[#252a34] hover:bg-[#343a46] text-[#8a92a6] hover:text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border border-[#2f3644] disabled:opacity-60"
              title="Sincronizar dados em tempo real com o banco de dados Supabase na nuvem"
            >
              <Database className={`w-3.5 h-3.5 text-[#8a92a6] ${isSyncingCloud ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isSyncingCloud ? 'Sincronizando...' : 'Nuvem Supabase'}</span>
            </button>

            <button
              type="button"
              onClick={onBackToApp}
              className="hidden lg:flex px-3 py-1.5 bg-[#3a4150] hover:bg-[#475062] active:bg-[#2d3340] text-white rounded-lg text-xs font-bold items-center gap-1.5 transition cursor-pointer border border-[#4d576a] shadow-xs"
              title="Acessar o ERP Interno"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Abrir ERP</span>
            </button>
          </div>
        </header>

        {/* Conteúdo Principal (Cards de Indicadores + Tabela e Formulários) */}
        <main className="flex-1 w-full max-w-[95%] mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
          
          {/* CARDS DE CONTADORES SUPERIORES & MRR ESTIMADO EM TEMPO REAL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
            
            {/* 1. Total de Assinantes */}
            <div className="bg-[#252a34] border border-[#2f3644] p-4 rounded-2xl space-y-1">
              <div className="flex items-center justify-between text-[#8a92a6]">
                <span className="text-[11px] font-bold uppercase tracking-wider">Total Assinantes</span>
                <Users className="w-4 h-4 text-[#8a92a6]" />
              </div>
              <p className="text-2xl font-black text-white tracking-tight">
                {metrics?.totalSubscribers ?? 0}
              </p>
              <span className="text-[10px] text-[#8a92a6] font-medium">
                Registros no banco
              </span>
            </div>

            {/* 2. Assinaturas Ativas */}
            <div className="bg-[#252a34] border border-[#2f3644] p-4 rounded-2xl space-y-1">
              <div className="flex items-center justify-between text-[#8a92a6]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span className="text-[11px] font-bold uppercase tracking-wider">Ativas</span>
                </div>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-black text-white tracking-tight">
                {metrics?.activeSubscribers ?? 0}
              </p>
              <span className="text-[10px] text-[#8a92a6] font-medium">
                Contratos adimplentes
              </span>
            </div>

            {/* 3. Em Trial */}
            <div className="bg-[#252a34] border border-[#2f3644] p-4 rounded-2xl space-y-1">
              <div className="flex items-center justify-between text-[#8a92a6]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span className="text-[11px] font-bold uppercase tracking-wider">Em Trial</span>
                </div>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-2xl font-black text-white tracking-tight">
                {metrics?.trialSubscribers ?? 0}
              </p>
              <span className="text-[10px] text-[#8a92a6] font-medium">
                Testando a plataforma
              </span>
            </div>

            {/* 4. Suspensas / Inadimplentes */}
            <div className="bg-[#252a34] border border-[#2f3644] p-4 rounded-2xl space-y-1">
              <div className="flex items-center justify-between text-[#8a92a6]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                  <span className="text-[11px] font-bold uppercase tracking-wider">Suspensas</span>
                </div>
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              </div>
              <p className="text-2xl font-black text-white tracking-tight">
                {metrics?.suspendedSubscribers ?? 0}
              </p>
              <span className="text-[10px] text-[#8a92a6] font-medium">
                Inadimplência ou pausa
              </span>
            </div>

            {/* 5. MRR Estimado (Soma dinâmica de clientes com status "ATIVA") */}
            <div className="col-span-1 sm:col-span-2 md:col-span-1 xl:col-span-1 bg-[#252a34] border border-[#2f3644] p-4 rounded-2xl space-y-1">
              <div className="flex items-center justify-between text-[#8a92a6]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span className="text-[11px] font-bold uppercase tracking-wider">MRR Estimado</span>
                </div>
                <DollarSign className="w-4 h-4 text-[#8a92a6]" />
              </div>
              <p className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {formatCurrencyBRL(metrics?.estimatedMrr ?? 0)}
              </p>
              <span className="text-[10px] text-[#8a92a6] font-medium block">
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
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-[#252a34] p-3.5 rounded-2xl border border-[#2f3644]">
              
              {/* Abas de filtro instantâneo por status */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setStatusFilter('todas')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    statusFilter === 'todas'
                      ? 'bg-[#3a4150] text-white border border-[#4d576a] shadow-xs'
                      : 'bg-[#1a1d24] text-[#8a92a6] hover:text-white hover:bg-[#202530] border border-[#2f3644]'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#8a92a6]" />
                  <span>Todas ({(subscribers || []).filter(Boolean).length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('ativa')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    statusFilter === 'ativa'
                      ? 'bg-[#3a4150] text-white border border-[#4d576a] shadow-xs'
                      : 'bg-[#1a1d24] text-[#8a92a6] hover:text-white hover:bg-[#202530] border border-[#2f3644]'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Ativa ({(subscribers || []).filter(s => (s?.status || '').toLowerCase() === 'ativa').length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('trial')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    statusFilter === 'trial'
                      ? 'bg-[#3a4150] text-white border border-[#4d576a] shadow-xs'
                      : 'bg-[#1a1d24] text-[#8a92a6] hover:text-white hover:bg-[#202530] border border-[#2f3644]'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span>Trial ({(subscribers || []).filter(s => (s?.status || '').toLowerCase() === 'trial').length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('inadimplente')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    statusFilter === 'inadimplente'
                      ? 'bg-[#3a4150] text-white border border-[#4d576a] shadow-xs'
                      : 'bg-[#1a1d24] text-[#8a92a6] hover:text-white hover:bg-[#202530] border border-[#2f3644]'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                  <span>Inadimplente ({(subscribers || []).filter(s => (s?.status || '').toLowerCase() === 'inadimplente').length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('cancelada')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    statusFilter === 'cancelada'
                      ? 'bg-[#3a4150] text-white border border-[#4d576a] shadow-xs'
                      : 'bg-[#1a1d24] text-[#8a92a6] hover:text-white hover:bg-[#202530] border border-[#2f3644]'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                  <span>Cancelada ({(subscribers || []).filter(s => (s?.status || '').toLowerCase() === 'cancelada').length})</span>
                </button>
              </div>

              {/* Busca e Botão Novo Assinante */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-4 h-4 text-[#8a92a6] absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar assinante, e-mail, CNPJ..."
                    className="w-full pl-9 pr-3 py-2 bg-[#1a1d24] border border-[#2f3644] rounded-xl text-xs text-white placeholder-[#8a92a6] focus:border-[#4d576a] focus:ring-1 focus:ring-[#4d576a] outline-none transition"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEditingSubscriber(null);
                    setIsEditSubscriberOpen(true);
                  }}
                  className="px-3.5 py-2 bg-[#3a4150] hover:bg-[#475062] active:bg-[#2d3340] text-white border border-[#4d576a] rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Novo Assinante</span>
                </button>
              </div>
            </div>

            {/* Tabela de Assinantes */}
            <div 
              id="master-admin-table-container"
              className="dark-elegance-table-container bg-[#252a34] border border-[#2f3644] rounded-2xl overflow-hidden shadow-xl"
              style={{ backgroundColor: '#252a34' }}
            >
              <div className="overflow-x-auto">
                <table 
                  className="w-full text-left border-collapse dark-elegance-table bg-[#252a34] text-white"
                  style={{ backgroundColor: '#252a34', color: '#ffffff' }}
                >
                  <thead className="bg-[#1e222b]" style={{ backgroundColor: '#1e222b' }}>
                    <tr className="border-b border-[#2f3644] bg-[#1e222b] text-[11px] font-bold text-[#8a92a6] uppercase tracking-wider" style={{ backgroundColor: '#1e222b' }}>
                      <th className="py-3.5 px-4 text-[#8a92a6]" style={{ backgroundColor: '#1e222b', color: '#8a92a6' }}>Assinante / Empresa</th>
                      <th className="py-3.5 px-4 text-[#8a92a6]" style={{ backgroundColor: '#1e222b', color: '#8a92a6' }}>Responsável & Contato</th>
                      <th className="py-3.5 px-4 text-[#8a92a6]" style={{ backgroundColor: '#1e222b', color: '#8a92a6' }}>Documento / Cidade</th>
                      <th className="py-3.5 px-4 text-[#8a92a6]" style={{ backgroundColor: '#1e222b', color: '#8a92a6' }}>Plano & Valor</th>
                      <th className="py-3.5 px-4 text-[#8a92a6]" style={{ backgroundColor: '#1e222b', color: '#8a92a6' }}>Trial Até</th>
                      <th className="py-3.5 px-4 text-[#8a92a6]" style={{ backgroundColor: '#1e222b', color: '#8a92a6' }}>Status</th>
                      <th className="py-3.5 px-4 text-right text-[#8a92a6]" style={{ backgroundColor: '#1e222b', color: '#8a92a6' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2f3644]/50 text-xs bg-[#252a34]" style={{ backgroundColor: '#252a34' }}>
                    {filteredSubscribers.length === 0 ? (
                      <tr style={{ backgroundColor: '#252a34' }}>
                        <td colSpan={7} className="py-16 text-center text-[#8a92a6]" style={{ backgroundColor: '#252a34', color: '#8a92a6' }}>
                          <div className="flex flex-col items-center justify-center space-y-2">
                            <Building2 className="w-8 h-8 text-[#8a92a6] stroke-[1.5]" />
                            <p className="text-sm font-semibold text-white">
                              {(subscribers || []).length === 0
                                ? 'Nenhum assinante cadastrado na plataforma até o momento.'
                                : 'Nenhum assinante encontrado para os critérios selecionados.'}
                            </p>
                            {(subscribers || []).length === 0 && (
                              <p className="text-xs text-[#8a92a6] max-w-sm">
                                Novos cadastros realizados na plataforma ou criados pelo botão "+ Novo Assinante" aparecerão aqui automaticamente.
                              </p>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredSubscribers.map((sub, idx) => {
                        if (!sub) return null;
                        const subId = sub?.id || `sub-${idx}`;
                        const subName = sub?.name || 'Assinante';
                        const subEmail = sub?.responsibleEmail || '-';
                        const subPhone = sub?.phone || '-';
                        const subDoc = sub?.cpfCnpj || '-';
                        const subCity = sub?.city || '';
                        const subState = sub?.state || '';
                        const subLocation = (subCity || subState) ? `${subCity}${subCity && subState ? ' - ' : ''}${subState}` : '-';
                        
                        // JOIN dinâmico com a lista de planos para obter nome e preço atualizados em tempo real
                        const resolvedPlan = resolveSubscriberPlan(sub, plans);
                        const subPlan = resolvedPlan.planName;
                        const subValue = resolvedPlan.monthlyValue;
                        const subStatus = ((sub?.status || 'trial') as string).toLowerCase() as SubscriberStatus;
                        
                        let trialDateFormatted = '-';
                        if (sub?.trialUntil) {
                          try {
                            const rawDate = String(sub.trialUntil).trim();
                            const isoDate = rawDate.includes('T') ? rawDate : `${rawDate}T12:00:00`;
                            const d = new Date(isoDate);
                            if (!isNaN(d.getTime())) {
                              trialDateFormatted = d.toLocaleDateString('pt-BR');
                            } else {
                              trialDateFormatted = rawDate;
                            }
                          } catch {
                            trialDateFormatted = String(sub.trialUntil);
                          }
                        }

                        return (
                          <tr 
                            key={subId} 
                            className="hover:bg-[#2a303c] transition-colors bg-[#252a34]"
                            style={{ backgroundColor: '#252a34' }}
                          >
                            {/* Nome do Assinante */}
                            <td className="py-3.5 px-4 font-bold text-white" style={{ backgroundColor: '#252a34', color: '#ffffff' }}>
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-[#1a1d24] border border-[#2f3644] flex items-center justify-center shrink-0">
                                  <Building2 className="w-4.5 h-4.5 text-[#8a92a6]" />
                                </div>
                                <div>
                                  <span className="text-sm sm:text-base font-bold text-white block tracking-tight">{subName}</span>
                                  <span className="block text-xs text-[#8a92a6] font-mono">
                                    ID: {subId}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Email & Telefone */}
                            <td className="py-3.5 px-4 text-[#d1d5db]" style={{ backgroundColor: '#252a34', color: '#d1d5db' }}>
                              <div>
                                <span className="text-sm font-medium text-white block">{subEmail}</span>
                                <span className="text-xs text-[#8a92a6] font-mono">{subPhone}</span>
                              </div>
                            </td>

                            {/* Documento & Cidade */}
                            <td className="py-3.5 px-4 text-[#d1d5db]" style={{ backgroundColor: '#252a34', color: '#d1d5db' }}>
                              <span className="font-mono text-sm text-white block">{subDoc}</span>
                              <span className="text-xs text-[#8a92a6]">
                                {subLocation}
                              </span>
                            </td>

                            {/* Plano & Valor */}
                            <td className="py-3.5 px-4" style={{ backgroundColor: '#252a34' }}>
                              <span className="text-sm font-bold text-white block">{subPlan}</span>
                              <span className="text-xs sm:text-sm font-semibold text-[#8a92a6]">
                                {formatCurrencyBRL(subValue)}/mês
                              </span>
                            </td>

                            {/* Trial Até */}
                            <td className="py-3.5 px-4 font-mono text-xs sm:text-sm text-[#d1d5db]" style={{ backgroundColor: '#252a34', color: '#d1d5db' }}>
                              {trialDateFormatted}
                            </td>

                            {/* Status */}
                            <td className="py-3.5 px-4" style={{ backgroundColor: '#252a34' }}>
                              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1a1d24] border border-[#2f3644]">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${
                                  subStatus === 'ativa' ? 'bg-emerald-400' :
                                  subStatus === 'trial' ? 'bg-amber-400' :
                                  subStatus === 'inadimplente' ? 'bg-rose-400' :
                                  subStatus === 'suspensa' ? 'bg-purple-400' : 'bg-zinc-500'
                                }`} />
                                <select
                                  value={subStatus}
                                  onChange={(e) => handleQuickStatusChange(subId, e.target.value as SubscriberStatus)}
                                  className="bg-transparent text-xs font-bold text-[#d1d5db] outline-none cursor-pointer"
                                >
                                  <option value="ativa" className="bg-[#1a1d24] text-white">Ativa</option>
                                  <option value="trial" className="bg-[#1a1d24] text-white">Trial</option>
                                  <option value="inadimplente" className="bg-[#1a1d24] text-white">Inadimplente</option>
                                  <option value="suspensa" className="bg-[#1a1d24] text-white">Suspensa</option>
                                  <option value="cancelada" className="bg-[#1a1d24] text-white">Cancelada</option>
                                </select>
                              </div>
                            </td>

                            {/* Ações Rápidas */}
                            <td className="py-3.5 px-4 text-right" style={{ backgroundColor: '#252a34' }}>
                              <div className="flex items-center justify-end gap-1.5 flex-wrap sm:flex-nowrap">
                                
                                {/* 1. Visualizar Ficha (Verde Vibrante) */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setViewingSubscriber(sub);
                                    setIsDetailSubscriberOpen(true);
                                  }}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#1a1d24] hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 hover:border-emerald-500/50 transition-colors cursor-pointer"
                                  title="Visualizar Ficha Completa"
                                >
                                  <Eye className="w-4.5 h-4.5" />
                                </button>

                                {/* 2. Pausar ou Play (Amarelo/Laranja Vibrante) */}
                                {subStatus === 'suspensa' ? (
                                  <button
                                    type="button"
                                    onClick={() => setPauseModalSubscriber(sub)}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#1a1d24] hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 hover:border-emerald-500/50 transition-colors cursor-pointer"
                                    title="Reativar Assinatura (Liberar Acesso)"
                                  >
                                    <Play className="w-4.5 h-4.5" />
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setPauseModalSubscriber(sub)}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#1a1d24] hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 border border-amber-500/30 hover:border-amber-500/50 transition-colors cursor-pointer"
                                    title="Pausar / Suspender Assinatura (Bloquear ERP por pendência)"
                                  >
                                    <Pause className="w-4.5 h-4.5" />
                                  </button>
                                )}

                                {/* 3. Lápis (Editar - Amarelo/Laranja Vibrante) */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingSubscriber(sub);
                                    setIsEditSubscriberOpen(true);
                                  }}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#1a1d24] hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 border border-amber-500/30 hover:border-amber-500/50 transition-colors cursor-pointer"
                                  title="Editar Informações do Assinante"
                                >
                                  <Edit className="w-4.5 h-4.5" />
                                </button>

                                {/* 4. Cadeado (Redefinir Senha - Azul/Ciano) */}
                                <button
                                  type="button"
                                  onClick={() => setResetPasswordSubscriber(sub)}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#1a1d24] hover:bg-sky-500/20 text-sky-400 hover:text-sky-300 border border-sky-500/30 hover:border-sky-500/50 transition-colors cursor-pointer"
                                  title="Redefinir Senha do Assinante no Supabase"
                                >
                                  <Lock className="w-4.5 h-4.5" />
                                </button>

                                {/* 5. Cubo (Alterar Plano - Roxo/Índigo) */}
                                <button
                                  type="button"
                                  onClick={() => setChangePlanSubscriber(sub)}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#1a1d24] hover:bg-purple-500/20 text-purple-400 hover:text-purple-300 border border-purple-500/30 hover:border-purple-500/50 transition-colors cursor-pointer"
                                  title="Alterar Módulo/Plano Comercial"
                                >
                                  <Package className="w-4.5 h-4.5" />
                                </button>

                                {/* 6. Calendário (Estender Trial - Laranja/Âmbar) */}
                                <button
                                  type="button"
                                  onClick={() => setExtendTrialSubscriber(sub)}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#1a1d24] hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 border border-amber-500/30 hover:border-amber-500/50 transition-colors cursor-pointer"
                                  title="Estender Período de Testes (Trial)"
                                >
                                  <Calendar className="w-4.5 h-4.5" />
                                </button>

                                {/* 7. Lixeira (Excluir da Tabela 'assinantes' - Vermelho Bem Destacado) */}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSubscriber(subId, subName, subEmail !== '-' ? subEmail : undefined)}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#1a1d24] hover:bg-rose-500/20 text-rose-500 hover:text-rose-400 border border-rose-500/40 hover:border-rose-500/60 transition-colors cursor-pointer"
                                  title="Remover Assinante da Tabela de Assinantes"
                                >
                                  <Trash2 className="w-4.5 h-4.5" />
                                </button>

                                {/* 8. Botão "→ Entrar" com Fundo Verde Vibrante e Negrito */}
                                <button
                                  type="button"
                                  onClick={() => handleImpersonate(sub)}
                                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-lg text-xs sm:text-sm font-bold flex items-center gap-1.5 transition shadow-sm hover:shadow-md cursor-pointer whitespace-nowrap ml-1"
                                  title={`Entrar no painel operacional de ${subName} (Modo Personificação)`}
                                >
                                  <span>→ Entrar</span>
                                </button>

                              </div>
                            </td>
                          </tr>
                        );
                      })
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#252a34] p-4 rounded-2xl border border-[#2f3644]">
              <div>
                <h2 className="text-sm font-black text-white">
                  Planos Comerciais da Plataforma
                </h2>
                <p className="text-xs text-[#8a92a6]">
                  Planos com status ativo aparecem na Landing Page pública com link direto de checkout.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingPlan(null);
                  setIsPlanModalOpen(true);
                }}
                className="px-3.5 py-2 bg-[#3a4150] hover:bg-[#475062] active:bg-[#2d3340] text-white border border-[#4d576a] rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Novo Plano</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {plans.map((p) => (
                <div 
                  key={p.id}
                  className={`bg-[#252a34] rounded-2xl border p-5 flex flex-col justify-between space-y-4 relative ${
                    p.isFeatured 
                      ? 'border-[#4d576a] shadow-md ring-1 ring-[#4d576a]/60' 
                      : 'border-[#2f3644]'
                  }`}
                >
                  {p.isFeatured && (
                    <span className="absolute -top-3 right-4 px-3 py-0.5 bg-[#3a4150] text-white border border-[#4d576a] text-[10px] font-bold rounded-full uppercase tracking-wider shadow-xs">
                      Destaque
                    </span>
                  )}

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-black text-white">{p.name}</h3>
                        <span className="text-[11px] text-[#8a92a6]">Ordem de Exibição: #{p.displayOrder}</span>
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-bold rounded-full border bg-[#1a1d24] text-[#d1d5db] border-[#2f3644]">
                        <span className={`w-1.5 h-1.5 rounded-full ${p.isActive ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
                        <span>{p.isActive ? 'ATIVO NO SITE' : 'INATIVO'}</span>
                      </span>
                    </div>

                    <p className="text-xs text-[#8a92a6] min-h-[36px]">
                      {p.description}
                    </p>

                    <div className="pt-2 border-t border-[#2f3644]">
                      <span className="text-2xl font-black text-white tracking-tight">
                        {formatCurrencyBRL(p.price)}
                      </span>
                      <span className="text-xs text-[#8a92a6] ml-1">/mês</span>
                    </div>

                    {/* Limites */}
                    <div className="p-3 bg-[#1a1d24] rounded-xl border border-[#2f3644] text-[11px] space-y-1 text-[#d1d5db]">
                      <div className="flex justify-between">
                        <span className="text-[#8a92a6]">Máquinas/Veículos:</span>
                        <span className="font-bold text-white">{p.limits.maxMachineries === 'unlimited' ? 'Ilimitado' : p.limits.maxMachineries}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#8a92a6]">Usuários no painel:</span>
                        <span className="font-bold text-white">{p.limits.maxUsers === 'unlimited' ? 'Ilimitado' : p.limits.maxUsers}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#8a92a6]">Clientes CRM:</span>
                        <span className="font-bold text-white">{p.limits.maxClients === 'unlimited' ? 'Ilimitado' : p.limits.maxClients}</span>
                      </div>
                    </div>

                    {/* Features Preview */}
                    <div className="space-y-1.5 text-xs text-[#d1d5db]">
                      <span className="text-[10px] font-bold text-[#8a92a6] uppercase tracking-wider block">
                        Features (renderizadas no site):
                      </span>
                      <ul className="space-y-1">
                        {p.featuresText.split('\n').filter(Boolean).slice(0, 4).map((feat, idx) => (
                          <li key={idx} className="flex items-center gap-2 text-[11px]">
                            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="truncate text-[#d1d5db]">{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Botões de Ação */}
                  <div className="pt-3 border-t border-[#2f3644] flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPlan(p);
                        setIsPlanModalOpen(true);
                      }}
                      className="flex-1 py-2 bg-[#3a4150] hover:bg-[#475062] active:bg-[#2d3340] text-white border border-[#4d576a] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Refatorar Plano</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeletePlan(p.id, p.name)}
                      className="p-2 bg-[#1a1d24] hover:bg-[#343a46] text-[#8a92a6] hover:text-rose-400 rounded-xl transition cursor-pointer border border-[#2f3644]"
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
                className="fixed top-6 right-6 z-50 flex items-center gap-3 bg-[#252a34] text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-[#4d576a] font-bold text-xs"
              >
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="font-bold text-sm text-white">Configurações da Landing Page salvas com sucesso!</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#252a34] p-4 rounded-2xl border border-[#2f3644]">
              <div>
                <h2 className="text-sm font-black text-white">
                  Controle Dinâmico da Landing Page Pública
                </h2>
                <p className="text-xs text-[#8a92a6]">
                  Edite os títulos, chamadas e cartões de recursos. Ao salvar, a Landing Page atualiza instantaneamente.
                </p>
              </div>
              <button
                type="button"
                id="btn-save-site-config-top"
                onClick={() => handleSaveSiteConfig()}
                className="px-5 py-2.5 bg-[#3a4150] hover:bg-[#475062] active:bg-[#2d3340] text-white border border-[#4d576a] rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer self-start sm:self-auto shadow-xs"
              >
                <Save className="w-4 h-4" />
                <span>Salvar Alterações</span>
              </button>
            </div>

            {siteSaveSuccess && (
              <div className="p-3.5 bg-[#252a34] border border-[#2f3644] rounded-2xl text-xs font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Configurações da Landing Page salvas com sucesso!</span>
              </div>
            )}

            {/* 1. BLOCO DE CONFIGURAÇÃO GLOBAL (TRIAL TOGGLE) */}
            <div className="bg-[#252a34] border border-[#2f3644] rounded-2xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span>Configuração Global: Período de Teste Grátis (Trial)</span>
                  </h3>
                  <p className="text-[11px] text-[#8a92a6] mt-0.5">
                    Quando desativado, a Landing Page oculta as menções a &quot;grátis&quot; e direciona o fluxo de botões para &quot;Começar Agora&quot; ou contratação direta.
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                  <input
                    type="checkbox"
                    id="toggle-allow-free-trial"
                    checked={Boolean(siteForm.allow_free_trial ?? true)}
                    onChange={handleToggleFreeTrial}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-[#1a1d24] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 border border-[#2f3644]"></div>
                  <span className="ml-3 text-xs font-bold text-white whitespace-nowrap">
                    {siteForm.allow_free_trial ?? true ? 'Ativado (Com Teste Grátis)' : 'Desativado (Sem Teste Grátis)'}
                  </span>
                </label>
              </div>
            </div>

            {/* 2. BLOCO HERO (TOPO DA PÁGINA) & MÍDIA */}
            <div className="bg-[#252a34] border border-[#2f3644] rounded-2xl p-5 space-y-4">
              <div className="border-b border-[#2f3644] pb-2">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  1. Bloco Hero (Topo da Página) & Mídia
                </h3>
                <p className="text-[11px] text-[#8a92a6]">
                  Configuração dos textos de chamada, imagem de fundo, vídeo de demonstração e intensidade de opacidade do fundo escuro.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Frase Verde Superior (Badge) */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[#8a92a6] mb-1 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <span>FRASE VERDE SUPERIOR (BADGE DO HERO)</span>
                  </label>
                  <input
                    type="text"
                    value={siteForm.hero_badge_text || ''}
                    placeholder="Ex: A plataforma nº 1 em prestação de serviços de silagem e colheita"
                    onChange={(e) => setSiteForm({ ...siteForm, hero_badge_text: e.target.value })}
                    className="w-full p-2.5 bg-[#1a1d24] border border-[#2f3644] rounded-xl text-xs font-bold text-white focus:border-[#4d576a] focus:ring-1 focus:ring-[#4d576a] outline-none transition"
                  />
                  <p className="text-[10px] text-[#8a92a6] mt-1">
                    Exibida em destaque na tag arredondada no topo da seção Hero.
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[#8a92a6] mb-1">
                    TÍTULO PRINCIPAL (H1) *
                  </label>
                  <input
                    type="text"
                    required
                    value={siteForm.heroTitle}
                    onChange={(e) => setSiteForm({ ...siteForm, heroTitle: e.target.value })}
                    className="w-full p-2.5 bg-[#1a1d24] border border-[#2f3644] rounded-xl text-xs font-bold text-white focus:border-[#4d576a] focus:ring-1 focus:ring-[#4d576a] outline-none transition"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[#8a92a6] mb-1">
                    SUBTÍTULO *
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={siteForm.heroSubtitle}
                    onChange={(e) => setSiteForm({ ...siteForm, heroSubtitle: e.target.value })}
                    className="w-full p-2.5 bg-[#1a1d24] border border-[#2f3644] rounded-xl text-xs font-medium text-[#d1d5db] focus:border-[#4d576a] focus:ring-1 focus:ring-[#4d576a] outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#8a92a6] mb-1">
                    TEXTO BOTÃO PRINCIPAL *
                  </label>
                  <input
                    type="text"
                    required
                    value={siteForm.heroPrimaryBtnText}
                    onChange={(e) => setSiteForm({ ...siteForm, heroPrimaryBtnText: e.target.value })}
                    className="w-full p-2.5 bg-[#1a1d24] border border-[#2f3644] rounded-xl text-xs font-bold text-white focus:border-[#4d576a] focus:ring-1 focus:ring-[#4d576a] outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#8a92a6] mb-1">
                    TEXTO BOTÃO SECUNDÁRIO *
                  </label>
                  <input
                    type="text"
                    required
                    value={siteForm.heroSecondaryBtnText}
                    onChange={(e) => setSiteForm({ ...siteForm, heroSecondaryBtnText: e.target.value })}
                    className="w-full p-2.5 bg-[#1a1d24] border border-[#2f3644] rounded-xl text-xs font-bold text-white focus:border-[#4d576a] focus:ring-1 focus:ring-[#4d576a] outline-none transition"
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

                {/* CAMPO PARA URL DO VÍDEO DEMONSTRATIVO */}
                <div className="sm:col-span-2">
                  <label htmlFor="hero_video_url" className="block text-xs font-bold text-[#8a92a6] mb-1 flex items-center gap-1.5">
                    <Video className="w-3.5 h-3.5 text-emerald-400" />
                    <span>URL do Vídeo Demonstrativo</span>
                  </label>
                  <input
                    type="url"
                    id="hero_video_url"
                    name="hero_video_url"
                    placeholder="Ex: https://www.youtube.com/watch?v=... ou link direto .mp4 / vimeo"
                    value={siteForm.hero_video_url || ''}
                    onChange={(e) => {
                      const newUrl = e.target.value;
                      const updated = { ...siteForm, hero_video_url: newUrl };
                      setSiteForm(updated);
                      if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('agrocontrol_site_settings_updated', { detail: updated }));
                      }
                    }}
                    className="w-full p-2.5 bg-[#1a1d24] border border-[#2f3644] rounded-xl text-xs font-bold text-white focus:border-[#4d576a] focus:ring-1 focus:ring-[#4d576a] outline-none transition"
                  />
                  <p className="text-[11px] text-[#8a92a6] mt-1">
                    Ao clicar no botão &quot;Conhecer Funcionalidades&quot; na Landing Page, abrirá um modal pop-up (lightbox) reproduzindo este vídeo.
                  </p>
                </div>

                {/* CONTROLE DESLIZANTE DE OPACIDADE (OVERLAY) */}
                <div className="sm:col-span-2 bg-[#1a1d24] border border-[#2f3644] p-3.5 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="hero_overlay_opacity" className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Intensidade do Fundo Escuro (Overlay)</span>
                    </label>
                    <span className="text-xs font-black text-emerald-400 bg-[#252a34] px-2.5 py-1 rounded-lg border border-[#2f3644]">
                      {siteForm.hero_overlay_opacity !== undefined && siteForm.hero_overlay_opacity !== null ? siteForm.hero_overlay_opacity : 75}%
                    </span>
                  </div>
                  <input
                    type="range"
                    id="hero_overlay_opacity"
                    name="hero_overlay_opacity"
                    min="0"
                    max="100"
                    step="1"
                    value={siteForm.hero_overlay_opacity !== undefined && siteForm.hero_overlay_opacity !== null ? siteForm.hero_overlay_opacity : 75}
                    onChange={(e) => {
                      const newOpacity = Number(e.target.value);
                      const updated = { ...siteForm, hero_overlay_opacity: newOpacity };
                      setSiteForm(updated);
                      if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('agrocontrol_site_settings_updated', { detail: updated }));
                      }
                    }}
                    className="w-full h-2 bg-[#252a34] rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                  <div className="flex justify-between text-[10px] text-[#8a92a6]">
                    <span>0% (Mais claro / Imagem pura)</span>
                    <span>50% (Equilibrado)</span>
                    <span>100% (Mais escuro / Máximo contraste)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. BLOCO IMAGEM DE DESTAQUE DOS RECURSOS (SEÇÃO INFERIOR) */}
            <div className="bg-[#252a34] border border-[#2f3644] rounded-2xl p-5 space-y-4">
              <div className="border-b border-[#2f3644] pb-2">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  2. Imagem de Destaque dos Recursos (Seção Inferior)
                </h3>
                <p className="text-[11px] text-[#8a92a6]">
                  Imagem ilustrativa exibida abaixo do cabeçalho de recursos na Landing Page.
                </p>
              </div>

              <ImageUploadField
                id="features-highlight-upload"
                label="IMAGEM DE DESTAQUE DOS RECURSOS (SEÇÃO INFERIOR)"
                description="Carregue uma imagem ou captura de tela do sistema para exibir como mockup de destaque."
                value={siteForm.featuresHighlightImage || ''}
                onChange={(val) => setSiteForm({ ...siteForm, featuresHighlightImage: val })}
                aspectRatioLabel="Recomendado: 16:9 widescreen ou mockup de sistema"
              />
            </div>

            {/* 4. BLOCO CABEÇALHO DE RECURSOS & ABAS INTERATIVAS */}
            <div className="bg-[#252a34] border border-[#2f3644] rounded-2xl p-5 space-y-5">
              <div className="border-b border-[#2f3644] pb-2">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  3. Bloco Cabeçalho de Recursos & Abas Interativas
                </h3>
                <p className="text-[11px] text-[#8a92a6]">
                  Configure os títulos da seção e gerencie as abas interativas com descrições e capturas do sistema.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#8a92a6] mb-1">
                    TÍTULO DA SEÇÃO *
                  </label>
                  <input
                    type="text"
                    required
                    value={siteForm.featuresSectionTitle}
                    onChange={(e) => setSiteForm({ ...siteForm, featuresSectionTitle: e.target.value })}
                    className="w-full p-2.5 bg-[#1a1d24] border border-[#2f3644] rounded-xl text-xs font-bold text-white focus:border-[#4d576a] focus:ring-1 focus:ring-[#4d576a] outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#8a92a6] mb-1">
                    SUBTÍTULO DA SEÇÃO *
                  </label>
                  <input
                    type="text"
                    required
                    value={siteForm.featuresSectionSubtitle}
                    onChange={(e) => setSiteForm({ ...siteForm, featuresSectionSubtitle: e.target.value })}
                    className="w-full p-2.5 bg-[#1a1d24] border border-[#2f3644] rounded-xl text-xs font-medium text-[#d1d5db] focus:border-[#4d576a] focus:ring-1 focus:ring-[#4d576a] outline-none transition"
                  />
                </div>
              </div>

              {/* Gerenciador das Abas Interativas */}
              <div className="bg-[#1a1d24] p-4 rounded-xl border border-[#2f3644] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Layers className="w-4 h-4 text-emerald-400" />
                      <span>Abas Interativas do Rodapé de Recursos</span>
                    </h4>
                    <p className="text-[11px] text-[#8a92a6]">
                      Permite aos visitantes navegar por abas dinâmicas detalhadas na Landing Page.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddFeatureTab}
                    className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar Aba</span>
                  </button>
                </div>

                <div className="space-y-4">
                  {(siteForm.features_tabs || []).map((tab, tIdx) => (
                    <div key={tab.id || tIdx} className="p-4 bg-[#252a34] rounded-xl border border-[#2f3644] space-y-3">
                      <div className="flex items-center justify-between border-b border-[#2f3644] pb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px] flex items-center justify-center">
                            {tIdx + 1}
                          </span>
                          <span className="text-xs font-bold text-white">
                            {tab.title || `Aba #${tIdx + 1}`}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFeatureTab(tIdx)}
                          className="p-1 text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded transition cursor-pointer"
                          title="Remover Aba"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-[#8a92a6] mb-1">TÍTULO DA ABA</label>
                          <input
                            type="text"
                            value={tab.title}
                            onChange={(e) => handleUpdateFeatureTab(tIdx, { ...tab, title: e.target.value })}
                            className="w-full p-2 bg-[#1a1d24] border border-[#2f3644] rounded-lg text-xs font-bold text-white outline-none focus:border-[#4d576a]"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-[#8a92a6] mb-1">ÍCONE</label>
                          <select
                            value={tab.iconName || 'Tractor'}
                            onChange={(e) => handleUpdateFeatureTab(tIdx, { ...tab, iconName: e.target.value })}
                            className="w-full p-2 bg-[#1a1d24] border border-[#2f3644] rounded-lg text-xs font-bold text-white outline-none focus:border-[#4d576a]"
                          >
                            <option value="Tractor">Trator / Campo (Tractor)</option>
                            <option value="Smartphone">App Celular / Offline (Smartphone)</option>
                            <option value="TrendingUp">Gráficos & Custos (TrendingUp)</option>
                            <option value="Wrench">Manutenção Mecânica (Wrench)</option>
                            <option value="ShieldCheck">Segurança e Backup (ShieldCheck)</option>
                            <option value="Clock">Horímetro e Escala (Clock)</option>
                            <option value="Layers">Múltiplos Módulos (Layers)</option>
                          </select>
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-bold text-[#8a92a6] mb-1">URL DA IMAGEM / MOCKUP</label>
                          <input
                            type="text"
                            value={tab.imageUrl || ''}
                            placeholder="Ex: /image.png ou URL externa de captura"
                            onChange={(e) => handleUpdateFeatureTab(tIdx, { ...tab, imageUrl: e.target.value })}
                            className="w-full p-2 bg-[#1a1d24] border border-[#2f3644] rounded-lg text-xs text-white outline-none focus:border-[#4d576a]"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-bold text-[#8a92a6] mb-1">DESCRIÇÃO DA FUNCIONALIDADE</label>
                          <textarea
                            rows={2}
                            value={tab.description || ''}
                            onChange={(e) => handleUpdateFeatureTab(tIdx, { ...tab, description: e.target.value })}
                            className="w-full p-2 bg-[#1a1d24] border border-[#2f3644] rounded-lg text-xs text-[#d1d5db] outline-none focus:border-[#4d576a]"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-bold text-[#8a92a6] mb-1">
                            PONTOS-CHAVE / BULLETS (UM POR LINHA)
                          </label>
                          <textarea
                            rows={3}
                            value={(tab.bullets || []).join('\n')}
                            onChange={(e) => {
                              const bullets = e.target.value.split('\n').filter(Boolean);
                              handleUpdateFeatureTab(tIdx, { ...tab, bullets });
                            }}
                            placeholder="Benefício 1&#10;Benefício 2&#10;Benefício 3"
                            className="w-full p-2 bg-[#1a1d24] border border-[#2f3644] rounded-lg text-xs text-[#d1d5db] outline-none focus:border-[#4d576a]"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 5. BLOCO RECURSOS (BENEFÍCIOS - 4 CARTÕES DA LANDING PAGE) */}
            <div className="bg-[#252a34] border border-[#2f3644] rounded-2xl p-5 space-y-4">
              <div className="border-b border-[#2f3644] pb-2">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  4. Bloco Recursos (Benefícios - 4 Cartões da Landing Page)
                </h3>
                <p className="text-[11px] text-[#8a92a6]">
                  Estes campos alimentam diretamente os 4 cartões de benefícios da página pública de vendas.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Recurso #1 */}
                <div className="p-4 bg-[#1a1d24] rounded-xl border border-[#2f3644] space-y-3">
                  <span className="text-xs font-bold text-white uppercase tracking-wider block">
                    RECURSO #1
                  </span>
                  <div>
                    <label className="block text-[11px] font-bold text-[#8a92a6] mb-1">TÍTULO</label>
                    <input
                      type="text"
                      required
                      value={siteForm.feature1Title}
                      onChange={(e) => setSiteForm({ ...siteForm, feature1Title: e.target.value })}
                      className="w-full p-2 bg-[#252a34] border border-[#2f3644] rounded-lg text-xs font-bold text-white outline-none focus:border-[#4d576a]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#8a92a6] mb-1">DESCRIÇÃO</label>
                    <textarea
                      rows={2}
                      required
                      value={siteForm.feature1Desc}
                      onChange={(e) => setSiteForm({ ...siteForm, feature1Desc: e.target.value })}
                      className="w-full p-2 bg-[#252a34] border border-[#2f3644] rounded-lg text-xs text-[#d1d5db] outline-none focus:border-[#4d576a]"
                    />
                  </div>
                </div>

                {/* Recurso #2 */}
                <div className="p-4 bg-[#1a1d24] rounded-xl border border-[#2f3644] space-y-3">
                  <span className="text-xs font-bold text-white uppercase tracking-wider block">
                    RECURSO #2
                  </span>
                  <div>
                    <label className="block text-[11px] font-bold text-[#8a92a6] mb-1">TÍTULO</label>
                    <input
                      type="text"
                      required
                      value={siteForm.feature2Title}
                      onChange={(e) => setSiteForm({ ...siteForm, feature2Title: e.target.value })}
                      className="w-full p-2 bg-[#252a34] border border-[#2f3644] rounded-lg text-xs font-bold text-white outline-none focus:border-[#4d576a]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#8a92a6] mb-1">DESCRIÇÃO</label>
                    <textarea
                      rows={2}
                      required
                      value={siteForm.feature2Desc}
                      onChange={(e) => setSiteForm({ ...siteForm, feature2Desc: e.target.value })}
                      className="w-full p-2 bg-[#252a34] border border-[#2f3644] rounded-lg text-xs text-[#d1d5db] outline-none focus:border-[#4d576a]"
                    />
                  </div>
                </div>

                {/* Recurso #3 */}
                <div className="p-4 bg-[#1a1d24] rounded-xl border border-[#2f3644] space-y-3">
                  <span className="text-xs font-bold text-white uppercase tracking-wider block">
                    RECURSO #3
                  </span>
                  <div>
                    <label className="block text-[11px] font-bold text-[#8a92a6] mb-1">TÍTULO</label>
                    <input
                      type="text"
                      required
                      value={siteForm.feature3Title}
                      onChange={(e) => setSiteForm({ ...siteForm, feature3Title: e.target.value })}
                      className="w-full p-2 bg-[#252a34] border border-[#2f3644] rounded-lg text-xs font-bold text-white outline-none focus:border-[#4d576a]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#8a92a6] mb-1">DESCRIÇÃO</label>
                    <textarea
                      rows={2}
                      required
                      value={siteForm.feature3Desc}
                      onChange={(e) => setSiteForm({ ...siteForm, feature3Desc: e.target.value })}
                      className="w-full p-2 bg-[#252a34] border border-[#2f3644] rounded-lg text-xs text-[#d1d5db] outline-none focus:border-[#4d576a]"
                    />
                  </div>
                </div>

                {/* Recurso #4 */}
                <div className="p-4 bg-[#1a1d24] rounded-xl border border-[#2f3644] space-y-3">
                  <span className="text-xs font-bold text-white uppercase tracking-wider block">
                    RECURSO #4
                  </span>
                  <div>
                    <label className="block text-[11px] font-bold text-[#8a92a6] mb-1">TÍTULO</label>
                    <input
                      type="text"
                      required
                      value={siteForm.feature4Title}
                      onChange={(e) => setSiteForm({ ...siteForm, feature4Title: e.target.value })}
                      className="w-full p-2 bg-[#252a34] border border-[#2f3644] rounded-lg text-xs font-bold text-white outline-none focus:border-[#4d576a]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#8a92a6] mb-1">DESCRIÇÃO</label>
                    <textarea
                      rows={2}
                      required
                      value={siteForm.feature4Desc}
                      onChange={(e) => setSiteForm({ ...siteForm, feature4Desc: e.target.value })}
                      className="w-full p-2 bg-[#252a34] border border-[#2f3644] rounded-lg text-xs text-[#d1d5db] outline-none focus:border-[#4d576a]"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 6. BLOCO SEÇÃO DE PLANOS E PREÇOS & CHECKS VERDES */}
            <div className="bg-[#252a34] border border-[#2f3644] rounded-2xl p-5 space-y-5">
              <div className="border-b border-[#2f3644] pb-2">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  5. Seção de Planos e Preços & Checks Verdes Dinâmicos
                </h3>
                <p className="text-[11px] text-[#8a92a6]">
                  Configure os títulos da seção de preços e edite em tempo real as tags e a lista de itens/checks verdes de cada plano.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#8a92a6] mb-1">
                    TAG DE CHAMADA SUPERIOR
                  </label>
                  <input
                    type="text"
                    value={siteForm.pricing_tag || ''}
                    placeholder="Ex: INVESTIMENTO TRANSPARENTE"
                    onChange={(e) => setSiteForm({ ...siteForm, pricing_tag: e.target.value })}
                    className="w-full p-2.5 bg-[#1a1d24] border border-[#2f3644] rounded-xl text-xs font-bold text-white focus:border-[#4d576a] focus:ring-1 focus:ring-[#4d576a] outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#8a92a6] mb-1">
                    TÍTULO DA SEÇÃO *
                  </label>
                  <input
                    type="text"
                    value={siteForm.pricing_title || ''}
                    placeholder="Ex: Escolha o plano ideal para a sua operação"
                    onChange={(e) => setSiteForm({ ...siteForm, pricing_title: e.target.value })}
                    className="w-full p-2.5 bg-[#1a1d24] border border-[#2f3644] rounded-xl text-xs font-bold text-white focus:border-[#4d576a] focus:ring-1 focus:ring-[#4d576a] outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#8a92a6] mb-1">
                    SUBTÍTULO DA SEÇÃO
                  </label>
                  <input
                    type="text"
                    value={siteForm.pricing_subtitle || ''}
                    placeholder="Ex: Comece com 7 dias grátis de teste..."
                    onChange={(e) => setSiteForm({ ...siteForm, pricing_subtitle: e.target.value })}
                    className="w-full p-2.5 bg-[#1a1d24] border border-[#2f3644] rounded-xl text-xs font-medium text-[#d1d5db] focus:border-[#4d576a] focus:ring-1 focus:ring-[#4d576a] outline-none transition"
                  />
                </div>
              </div>

              {/* Gerenciador Dinâmico de Itens / Checks Verdes por Plano */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Controle Rápido dos Checks Verdes dos Planos</span>
                  </h4>
                  <span className="text-[11px] text-[#8a92a6]">
                    Edição sincronizada com o banco e a Landing Page
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {plans.map((plan) => {
                    const features = (plan.featuresText || '').split('\n').filter(Boolean);
                    return (
                      <div key={plan.id} className="bg-[#1a1d24] border border-[#2f3644] rounded-xl p-4 space-y-3 flex flex-col justify-between">
                        <div>
                          <div className="flex items-start justify-between gap-2 border-b border-[#2f3644] pb-2">
                            <div>
                              <span className="text-xs font-black text-white">{plan.name}</span>
                              <p className="text-[11px] text-emerald-400 font-bold">
                                {formatCurrencyBRL(plan.price)} / {plan.billingCycle}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPlan(plan);
                                setIsPlanModalOpen(true);
                              }}
                              className="text-[10px] text-stone-300 hover:text-white px-2 py-1 bg-[#252a34] rounded border border-[#2f3644] transition cursor-pointer"
                            >
                              Editar Plano
                            </button>
                          </div>

                          {/* Tag / Badge de Destaque */}
                          <div className="pt-2">
                            <label className="block text-[10px] font-bold text-[#8a92a6] mb-1">
                              TAG DE DESTAQUE (OPCIONAL)
                            </label>
                            <input
                              type="text"
                              value={plan.badge || ''}
                              placeholder="Ex: COMECE AQUI, MAIS ESCOLHIDO"
                              onChange={(e) => handleUpdatePlanBadge(plan, e.target.value)}
                              className="w-full p-1.5 bg-[#252a34] border border-[#2f3644] rounded text-xs text-white outline-none focus:border-[#4d576a]"
                            />
                          </div>

                          {/* Lista dos Checks Verdes */}
                          <div className="pt-2 space-y-2">
                            <label className="block text-[10px] font-bold text-[#8a92a6]">
                              BENEFÍCIOS / CHECKS VERDES
                            </label>
                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                              {features.map((feat, fIdx) => (
                                <div key={fIdx} className="flex items-center gap-1.5 bg-[#252a34] p-1.5 rounded border border-[#2f3644]">
                                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                  <input
                                    type="text"
                                    value={feat}
                                    onChange={(e) => handleUpdatePlanFeature(plan, fIdx, e.target.value)}
                                    className="flex-1 bg-transparent text-[11px] text-[#d1d5db] outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleRemovePlanFeature(plan, fIdx)}
                                    className="text-stone-500 hover:text-red-400 transition cursor-pointer p-0.5"
                                    title="Remover Item"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAddPlanFeature(plan)}
                          className="w-full py-1.5 bg-[#252a34] hover:bg-[#2f3644] text-emerald-400 rounded text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer border border-[#2f3644]"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Adicionar Check Verde</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 7. BLOCO CONFIGURAÇÕES DO RODAPÉ (FOOTER) */}
            <div className="bg-[#252a34] border border-[#2f3644] rounded-2xl p-5 space-y-4">
              <div className="border-b border-[#2f3644] pb-2">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  6. Configurações do Rodapé (Footer)
                </h3>
                <p className="text-[11px] text-[#8a92a6]">
                  Personalize o copyright da empresa e os destinos dos links rápidos públicos do rodapé.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#8a92a6] mb-1">
                    COPYRIGHT & NOME DA EMPRESA
                  </label>
                  <input
                    type="text"
                    value={siteForm.footer_copyright || ''}
                    placeholder="Ex: AgroControl • Silagem Fácil Pro © 2026"
                    onChange={(e) => setSiteForm({ ...siteForm, footer_copyright: e.target.value })}
                    className="w-full p-2.5 bg-[#1a1d24] border border-[#2f3644] rounded-xl text-xs font-bold text-white focus:border-[#4d576a] focus:ring-1 focus:ring-[#4d576a] outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#8a92a6] mb-1">
                    URL LINK &quot;CRIAR CONTA&quot; (OPCIONAL)
                  </label>
                  <input
                    type="url"
                    value={siteForm.footer_signup_url || ''}
                    placeholder="Vazio = formulário interno de cadastro"
                    onChange={(e) => setSiteForm({ ...siteForm, footer_signup_url: e.target.value })}
                    className="w-full p-2.5 bg-[#1a1d24] border border-[#2f3644] rounded-xl text-xs text-white focus:border-[#4d576a] focus:ring-1 focus:ring-[#4d576a] outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#8a92a6] mb-1">
                    URL LINK &quot;PAINEL DO ASSINANTE ERP&quot; (OPCIONAL)
                  </label>
                  <input
                    type="url"
                    value={siteForm.footer_login_url || ''}
                    placeholder="Vazio = login seguro interno"
                    onChange={(e) => setSiteForm({ ...siteForm, footer_login_url: e.target.value })}
                    className="w-full p-2.5 bg-[#1a1d24] border border-[#2f3644] rounded-xl text-xs text-white focus:border-[#4d576a] focus:ring-1 focus:ring-[#4d576a] outline-none transition"
                  />
                </div>
              </div>
            </div>

            {/* Botão Salvar Flutuante / Final */}
            <div className="flex justify-end">
              <button
                type="button"
                id="btn-save-site-config-bottom"
                onClick={() => handleSaveSiteConfig()}
                className="px-6 py-3 bg-[#3a4150] hover:bg-[#475062] active:bg-[#2d3340] text-white border border-[#4d576a] rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-sm"
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
          <div className="space-y-6 bg-[#1a1d24] p-4 sm:p-6 rounded-2xl border border-[#2f3644] shadow-xs">
            
            {/* Cabeçalho do Módulo */}
            <div className="bg-[#252a34] p-4 sm:p-5 rounded-xl border border-[#2f3644] shadow-2xs">
              <h2 className="text-base font-black text-white tracking-tight">
                Webhooks de Pagamento & Permissões de Super Admin
              </h2>
              <p className="text-xs text-[#8a92a6] font-medium mt-0.5">
                Integre plataformas de checkout automáticas e gerencie os e-mails com permissão de acesso ao Admin Mestre.
              </p>
            </div>

            {settingsSaveSuccess && (
              <div className="p-3.5 bg-[#252a34] border border-[#2f3644] rounded-xl text-xs font-bold text-white flex items-center gap-2 shadow-2xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Configurações atualizadas com sucesso!</span>
              </div>
            )}

            {/* Form Webhooks */}
            <form onSubmit={handleSaveAdminSettings} className="bg-[#252a34] border border-[#2f3644] rounded-xl p-5 space-y-4 shadow-2xs">
              <div className="border-b border-[#2f3644] pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Webhook className="w-4 h-4 text-[#8a92a6]" />
                    <span>URLs de Webhook de Pagamento</span>
                  </h3>
                  <p className="text-[11px] text-[#8a92a6] font-medium mt-0.5">
                    Insira as rotas de retorno das plataformas para aprovação e cancelamento automático de assinantes.
                  </p>
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#3a4150] hover:bg-[#475062] active:bg-[#2d3340] text-white rounded-lg text-xs font-bold border border-[#4d576a] flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs shrink-0 focus:outline-none focus:ring-1 focus:ring-[#4d576a]"
                >
                  <Save className="w-4 h-4" />
                  <span>Salvar Webhooks</span>
                </button>
              </div>

              <div className="space-y-3.5 pt-1">
                <div>
                  <label className="block text-xs font-bold text-[#8a92a6] mb-1 tracking-wide">
                    WEBHOOK KIWIFY
                  </label>
                  <input
                    type="url"
                    value={settingsForm.webhookKiwify}
                    onChange={(e) => setSettingsForm({ ...settingsForm, webhookKiwify: e.target.value })}
                    placeholder="https://api.seusistema.com.br/webhooks/kiwify"
                    className="w-full p-2.5 bg-[#1a1d24] border border-[#2f3644] rounded-lg text-xs font-mono text-white placeholder-[#8a92a6] focus:border-[#4d576a] focus:ring-1 focus:ring-[#4d576a] outline-none transition shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#8a92a6] mb-1 tracking-wide">
                    WEBHOOK CAKTO
                  </label>
                  <input
                    type="url"
                    value={settingsForm.webhookCakto}
                    onChange={(e) => setSettingsForm({ ...settingsForm, webhookCakto: e.target.value })}
                    placeholder="https://api.seusistema.com.br/webhooks/cakto"
                    className="w-full p-2.5 bg-[#1a1d24] border border-[#2f3644] rounded-lg text-xs font-mono text-white placeholder-[#8a92a6] focus:border-[#4d576a] focus:ring-1 focus:ring-[#4d576a] outline-none transition shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#8a92a6] mb-1 tracking-wide">
                    WEBHOOK PERFECTPAY
                  </label>
                  <input
                    type="url"
                    value={settingsForm.webhookPerfectPay}
                    onChange={(e) => setSettingsForm({ ...settingsForm, webhookPerfectPay: e.target.value })}
                    placeholder="https://api.seusistema.com.br/webhooks/perfectpay"
                    className="w-full p-2.5 bg-[#1a1d24] border border-[#2f3644] rounded-lg text-xs font-mono text-white placeholder-[#8a92a6] focus:border-[#4d576a] focus:ring-1 focus:ring-[#4d576a] outline-none transition shadow-2xs"
                  />
                </div>
              </div>
            </form>

            {/* SUPER ADMINS */}
            <div className="bg-[#252a34] border border-[#2f3644] rounded-xl p-5 space-y-4 shadow-2xs">
              <div className="border-b border-[#2f3644] pb-3">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#8a92a6]" />
                  <span>E-mails Autorizados a Acessar o Admin Mestre</span>
                </h3>
                <p className="text-[11px] text-[#8a92a6] font-medium mt-0.5">
                  Usuários com estes e-mails possuem privilégios de super admin para administrar a plataforma.
                </p>
              </div>

              {/* Input e Botão "+ Adicionar" */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Mail className="w-4 h-4 text-[#8a92a6] absolute left-3 top-3 pointer-events-none" />
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
                    className="w-full pl-9 pr-3 py-2.5 bg-[#1a1d24] border border-[#2f3644] rounded-lg text-xs text-white placeholder-[#8a92a6] focus:border-[#4d576a] focus:ring-1 focus:ring-[#4d576a] outline-none transition shadow-2xs"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleAddSuperAdminEmail}
                  className="px-4 py-2.5 bg-[#3a4150] hover:bg-[#475062] active:bg-[#2d3340] text-white rounded-lg text-xs font-bold border border-[#4d576a] flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-xs focus:outline-none focus:ring-1 focus:ring-[#4d576a]"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>+ Adicionar</span>
                </button>
              </div>

              {/* Lista de Super Admins Cadastrados */}
              <div className="space-y-2 pt-1">
                {settingsForm.superAdminEmails.map((email) => (
                  <div
                    key={email}
                    className="flex items-center justify-between p-3 bg-[#1a1d24] rounded-lg border border-[#2f3644] text-xs shadow-2xs hover:border-[#4d576a] transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-[#252a34] text-[#8a92a6] flex items-center justify-center font-bold text-[10px] border border-[#2f3644] shrink-0">
                        ✓
                      </div>
                      <span className="font-bold text-white font-mono">{email}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveSuperAdminEmail(email)}
                      className="text-[#8a92a6] hover:text-rose-400 p-1.5 hover:bg-[#252a34] rounded-md transition cursor-pointer"
                      title="Remover autorização"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* SENHA MESTRE DE ACESSO */}
            <div className="bg-[#252a34] border border-[#2f3644] rounded-xl p-5 space-y-4 shadow-2xs">
              <div className="border-b border-[#2f3644] pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Lock className="w-4 h-4 text-[#8a92a6]" />
                    <span>Alterar Senha Mestre de Acesso</span>
                  </h3>
                  <p className="text-[11px] text-[#8a92a6] font-medium mt-0.5">
                    Defina uma nova senha mestre forte para autenticação dos Super Administradores.
                  </p>
                </div>
                <div className="px-2.5 py-1 rounded-md bg-[#1a1d24] border border-[#2f3644] text-[10px] text-[#8a92a6] font-mono self-start sm:self-auto">
                  Mínimo 6 caracteres
                </div>
              </div>

              {passwordChangeSuccess && (
                <div className="p-3 bg-[#1a1d24] border border-[#2f3644] rounded-lg text-xs font-bold text-white flex items-center gap-2 shadow-2xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Senha mestre atualizada com sucesso! Todas as sessões administrativas usarão a nova credencial.</span>
                </div>
              )}

              {passwordChangeError && (
                <div className="p-3 bg-[#1a1d24] border border-rose-800/80 rounded-lg text-xs font-bold text-rose-300 flex items-center gap-2 shadow-2xs">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{passwordChangeError}</span>
                </div>
              )}

              <form onSubmit={handleChangeMasterPassword} className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-[#8a92a6] mb-1 tracking-wide">
                      NOVA SENHA MESTRE
                    </label>
                    <div className="relative">
                      <Key className="w-4 h-4 text-[#8a92a6] absolute left-3 top-3 pointer-events-none" />
                      <input
                        type="password"
                        value={newMasterPassword}
                        onChange={(e) => {
                          setNewMasterPassword(e.target.value);
                          if (passwordChangeError) setPasswordChangeError(null);
                        }}
                        placeholder="Digite a nova senha"
                        className="w-full pl-9 pr-3 py-2.5 bg-[#1a1d24] border border-[#2f3644] rounded-lg text-xs text-white placeholder-[#8a92a6] focus:border-[#4d576a] focus:ring-1 focus:ring-[#4d576a] outline-none transition shadow-2xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#8a92a6] mb-1 tracking-wide">
                      CONFIRMAR NOVA SENHA
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-[#8a92a6] absolute left-3 top-3 pointer-events-none" />
                      <input
                        type="password"
                        value={confirmMasterPassword}
                        onChange={(e) => {
                          setConfirmMasterPassword(e.target.value);
                          if (passwordChangeError) setPasswordChangeError(null);
                        }}
                        placeholder="Confirme a nova senha"
                        className="w-full pl-9 pr-3 py-2.5 bg-[#1a1d24] border border-[#2f3644] rounded-lg text-xs text-white placeholder-[#8a92a6] focus:border-[#4d576a] focus:ring-1 focus:ring-[#4d576a] outline-none transition shadow-2xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end pt-1">
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-[#3a4150] hover:bg-[#475062] active:bg-[#2d3340] text-white rounded-lg text-xs font-bold border border-[#4d576a] flex items-center gap-1.5 transition cursor-pointer shadow-xs focus:outline-none focus:ring-1 focus:ring-[#4d576a]"
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
        plans={plans}
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
        onSuccess={handleSpecializedModalSuccess}
        onSuccessToast={showToast}
      />

      {/* 6. Modal de Estender Trial (Marrom) */}
      <ExtendTrialModal
        isOpen={Boolean(extendTrialSubscriber)}
        onClose={() => setExtendTrialSubscriber(null)}
        subscriber={extendTrialSubscriber}
        onSuccess={handleSpecializedModalSuccess}
        onSuccessToast={showToast}
      />

      {/* 2. Modal de Pausar / Reativar Assinatura (Laranja / Verde) */}
      <PauseSubscriberModal
        isOpen={Boolean(pauseModalSubscriber)}
        onClose={() => setPauseModalSubscriber(null)}
        subscriber={pauseModalSubscriber}
        onSuccess={handleSpecializedModalSuccess}
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
