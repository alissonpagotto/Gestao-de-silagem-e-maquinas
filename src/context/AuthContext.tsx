import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured, testSupabaseConnection } from '../lib/supabase';

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
  signIn: (email?: string, password?: string) => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  isSyncing: boolean;
  setIsSyncing: (val: boolean) => void;
  lastSyncedAt: Date | null;
  setLastSyncedAt: (val: Date | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isConnectedToSupabase, setIsConnectedToSupabase] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  useEffect(() => {
    let isMounted = true;

    // 1. Check Supabase connection
    testSupabaseConnection().then((connected) => {
      if (isMounted) {
        setIsConnectedToSupabase(connected);
      }
    });

    // 2. Check active Supabase Session
    supabase.auth.getSession().then(({ data: { session } }) => {
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
        }
        setLoading(false);
      }
    }).catch(() => {
      if (isMounted) setLoading(false);
    });

    // 3. Listen to auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
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
      } else {
        setCurrentUser(null);
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
      if (email && password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        // Sign in with Google OAuth on Supabase
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin
          }
        });
        if (error) throw error;
      }
    } catch (err) {
      console.error('Supabase auth sign in failed:', err);
      throw err;
    }
  };

  const signUp = async (email: string, password: string, displayName?: string) => {
    try {
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
      await supabase.auth.signOut();
      setCurrentUser(null);
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
        signIn,
        signUp,
        signOutUser,
        isSyncing,
        setIsSyncing,
        lastSyncedAt,
        setLastSyncedAt,
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
