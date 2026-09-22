import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured, testSupabaseConnection } from '../lib/supabase';
import { setDbAuthCompanyId, getDbAuthCompanyId, clearAllAuthSessionCache } from '../lib/storage';
import { resolveUserCompanyIdFromSupabase } from '../lib/supabaseService';

export interface AppUser {
  uid: string;
  id: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
}

interface AuthContextType {
  currentUser: AppUser | null;
  loading: boolean;
  isConnectedToSupabase: boolean;
  isConfigured: boolean;
  activeCompanyId: string | null;
  companyId: string | null;
  resolveAndSetActiveCompanyId: (userId: string, email?: string) => Promise<string | null>;
  signIn: (email?: string, password?: string) => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  isSyncing: boolean;
  setIsSyncing: (val: boolean) => void;
  lastSyncedAt: Date | null;
  setLastSyncedAt: (val: Date | null) => void;
  // Gestão de Personificação Multi-Tenant (Admin Mestre → Assinante)
  impersonatedCompanyId: string | null;
  isImpersonating: boolean;
  startImpersonation: (companyId: string, extraData?: { name?: string; email?: string; planName?: string }) => void;
  stopImpersonation: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isConnectedToSupabase, setIsConnectedToSupabase] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  // company_id resolvido e sincronizado diretamente com o banco de dados remoto
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(() => {
    return getDbAuthCompanyId();
  });

  // Estado de Personificação do Admin Mestre
  const [impersonatedCompanyId, setImpersonatedCompanyId] = useState<string | null>(() => {
    if (typeof localStorage !== 'undefined') {
      const explicit = (localStorage.getItem('admin_impersonated_company_id') || '').trim();
      if (explicit) return explicit;
      const isAdmin = localStorage.getItem('is_admin_impersonating') === 'true';
      const subId = (localStorage.getItem('impersonated_subscriber_id') || '').trim();
      if (isAdmin && subId) return subId;
    }
    return null;
  });

  const isImpersonating = Boolean(impersonatedCompanyId);

  /**
   * Resolução do company_id a partir do banco de dados remoto do Supabase
   * Busca em public.profiles, public.user_companies, public.users, public.assinantes ou public.subscribers
   */
  const resolveAndSetActiveCompanyId = async (userId: string, email?: string): Promise<string | null> => {
    if (!userId) return null;
    try {
      const resolved = await resolveUserCompanyIdFromSupabase(userId, email);
      if (resolved) {
        setDbAuthCompanyId(resolved);
        setActiveCompanyId(resolved);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('silagem_client_session', 'active');
          localStorage.setItem('silagem_active_subscriber_id', resolved);
          localStorage.setItem('current_company_id', resolved);
          if (email) {
            localStorage.setItem('silagem_active_user_email', email);
          }
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('active_company_id_changed', { detail: { companyId: resolved } }));
        }
        return resolved;
      }
    } catch (err) {
      console.warn('Erro ao resolver company_id no Supabase:', err);
    }
    return null;
  };

  const startImpersonation = (companyId: string, extraData?: { name?: string; email?: string; planName?: string }) => {
    const cleanId = (companyId || '').trim();
    if (!cleanId) return;

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('admin_impersonated_company_id', cleanId);
      localStorage.setItem('is_admin_impersonating', 'true');
      localStorage.setItem('impersonated_subscriber_id', cleanId);
      if (extraData?.name) localStorage.setItem('impersonated_subscriber_name', extraData.name);
      if (extraData?.email) localStorage.setItem('impersonated_subscriber_email', extraData.email);
      if (extraData?.planName) localStorage.setItem('impersonated_subscriber_plan', extraData.planName);
      localStorage.setItem('current_company_id', cleanId);
      localStorage.setItem('user_role', 'admin');
      localStorage.setItem('silagem_client_session', 'active');
    }

    setImpersonatedCompanyId(cleanId);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('admin_impersonation_changed', { detail: { companyId: cleanId } }));
      window.dispatchEvent(new CustomEvent('active_company_id_changed', { detail: { companyId: cleanId } }));
    }
  };

  const stopImpersonation = () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('admin_impersonated_company_id');
      localStorage.removeItem('is_admin_impersonating');
      localStorage.removeItem('impersonated_subscriber_id');
      localStorage.removeItem('impersonated_subscriber_name');
      localStorage.removeItem('impersonated_subscriber_email');
      localStorage.removeItem('impersonated_subscriber_plan');
      localStorage.removeItem('current_company_id');
    }

    setImpersonatedCompanyId(null);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('admin_impersonation_changed', { detail: { companyId: null } }));
      window.dispatchEvent(new CustomEvent('active_company_id_changed', { detail: { companyId: activeCompanyId } }));
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleImpersonationEvent = (e: any) => {
      const cId = e.detail?.companyId || null;
      setImpersonatedCompanyId(cId);
    };

    const handleCompanyIdChanged = (e: any) => {
      const cId = e.detail?.companyId || getDbAuthCompanyId();
      setActiveCompanyId(cId || null);
    };

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === 'admin_impersonated_company_id' || e.key === 'is_admin_impersonating') {
        const current = localStorage.getItem('admin_impersonated_company_id');
        setImpersonatedCompanyId(current || null);
      }
      if (e.key === 'supabase_auth_company_id' || e.key === 'authenticated_user_company_id') {
        setActiveCompanyId(getDbAuthCompanyId());
      }
    };

    window.addEventListener('admin_impersonation_changed', handleImpersonationEvent);
    window.addEventListener('active_company_id_changed', handleCompanyIdChanged);
    window.addEventListener('storage', handleStorageEvent);

    return () => {
      window.removeEventListener('admin_impersonation_changed', handleImpersonationEvent);
      window.removeEventListener('active_company_id_changed', handleCompanyIdChanged);
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [activeCompanyId]);

  useEffect(() => {
    let isMounted = true;

    // 1. Check Supabase connection
    testSupabaseConnection().then((connected) => {
      if (isMounted) {
        setIsConnectedToSupabase(connected);
      }
    });

    // 2. Check active Supabase Session or stored active session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (isMounted) {
        if (session?.user) {
          const u = session.user;
          setCurrentUser({
            uid: u.id,
            id: u.id,
            email: u.email,
            displayName: u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split('@')[0] || 'Usuário Supabase',
            photoURL: u.user_metadata?.avatar_url || ''
          });
          // Resolução imediata de company_id no banco de dados remoto
          await resolveAndSetActiveCompanyId(u.id, u.email);
        } else if (typeof localStorage !== 'undefined' && localStorage.getItem('silagem_client_session') === 'active') {
          const storedEmail = localStorage.getItem('silagem_active_user_email') || localStorage.getItem('silagem_active_subscriber_email') || 'usuario@silagem.com';
          const storedId = getDbAuthCompanyId() || localStorage.getItem('silagem_active_subscriber_id') || 'usr_local';
          setCurrentUser({
            uid: storedId,
            id: storedId,
            email: storedEmail,
            displayName: storedEmail.split('@')[0] || 'Produtor',
            photoURL: ''
          });
          setActiveCompanyId(getDbAuthCompanyId());
        }
        setLoading(false);
      }
    }).catch(() => {
      if (isMounted) {
        if (typeof localStorage !== 'undefined' && localStorage.getItem('silagem_client_session') === 'active') {
          const storedEmail = localStorage.getItem('silagem_active_user_email') || localStorage.getItem('silagem_active_subscriber_email') || 'usuario@silagem.com';
          const storedId = getDbAuthCompanyId() || localStorage.getItem('silagem_active_subscriber_id') || 'usr_local';
          setCurrentUser({
            uid: storedId,
            id: storedId,
            email: storedEmail,
            displayName: storedEmail.split('@')[0] || 'Produtor',
            photoURL: ''
          });
          setActiveCompanyId(getDbAuthCompanyId());
        }
        setLoading(false);
      }
    });

    // 3. Listen to auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;
      if (session?.user) {
        const u = session.user;
        setCurrentUser({
          uid: u.id,
          id: u.id,
          email: u.email,
          displayName: u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split('@')[0] || 'Usuário Supabase',
          photoURL: u.user_metadata?.avatar_url || ''
        });
        await resolveAndSetActiveCompanyId(u.id, u.email);
      } else {
        setCurrentUser(null);
        setActiveCompanyId(null);
      }
      setLoading(false);
    });

    return () => {
      isMounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email?: string, password?: string) => {
    try {
      // 3. LIMPEZA DE CACHE DE LOGIN ANTERIOR:
      // Garante que o company_id antigo seja completamente limpo do estado antes do novo login
      clearAllAuthSessionCache();
      setActiveCompanyId(null);

      if (email && password) {
        if (isSupabaseConfigured) {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
          if (data?.user) {
            const u = data.user;
            setCurrentUser({
              uid: u.id,
              id: u.id,
              email: u.email,
              displayName: u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split('@')[0] || 'Usuário Supabase',
              photoURL: u.user_metadata?.avatar_url || ''
            });
            // 1. RESOLUÇÃO IMEDIATA DO COMPANY_ID A PARTIR DO BANCO REMOTO
            await resolveAndSetActiveCompanyId(u.id, u.email);
          }
        } else {
          // Fallback local/offline
          const localUid = `usr_${Date.now()}`;
          setCurrentUser({
            uid: localUid,
            id: localUid,
            email,
            displayName: email.split('@')[0] || 'Usuário Local',
            photoURL: ''
          });
        }
      } else {
        // Sign in with Google OAuth on Supabase
        if (isSupabaseConfigured) {
          const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
              redirectTo: window.location.origin
            }
          });
          if (error) throw error;
        }
      }
    } catch (err) {
      console.error('Supabase auth sign in failed:', err);
      throw err;
    }
  };

  const signUp = async (email: string, password: string, displayName?: string) => {
    try {
      clearAllAuthSessionCache();
      setActiveCompanyId(null);

      if (isSupabaseConfigured) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: displayName || email.split('@')[0],
              name: displayName || email.split('@')[0],
            }
          }
        });
        if (error) {
          console.warn('Supabase auth signUp notice:', error.message);
        }
        if (data?.user) {
          const u = data.user;
          setCurrentUser({
            uid: u.id,
            id: u.id,
            email: u.email,
            displayName: displayName || u.email?.split('@')[0] || 'Usuário Supabase',
            photoURL: ''
          });
          await resolveAndSetActiveCompanyId(u.id, u.email);
        }
      } else {
        // Fallback local session
        const localUid = `usr_${Date.now()}`;
        setCurrentUser({
          uid: localUid,
          id: localUid,
          email,
          displayName: displayName || email.split('@')[0] || 'Usuário Local',
          photoURL: ''
        });
      }
    } catch (err) {
      console.warn('Sign up error fallback:', err);
    }
  };

  const signOutUser = async () => {
    try {
      stopImpersonation();
      clearAllAuthSessionCache();
      setActiveCompanyId(null);
      setCurrentUser(null);
      if (isSupabaseConfigured) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.error('Supabase sign out failed:', err);
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        loading,
        isConnectedToSupabase,
        isConfigured: isSupabaseConfigured,
        activeCompanyId,
        companyId: activeCompanyId,
        resolveAndSetActiveCompanyId,
        signIn,
        signUp,
        signOutUser,
        isSyncing,
        setIsSyncing,
        lastSyncedAt,
        setLastSyncedAt,
        impersonatedCompanyId,
        isImpersonating,
        startImpersonation,
        stopImpersonation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
