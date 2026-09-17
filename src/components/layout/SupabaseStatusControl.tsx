import React, { useState } from 'react';
import { 
  Database, 
  RefreshCw, 
  CheckCircle2, 
  LogOut
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SupabaseStatusControlProps {
  dropdownPosition?: 'up' | 'down';
}

export const SupabaseStatusControl: React.FC<SupabaseStatusControlProps> = ({
  dropdownPosition = 'down'
}) => {
  const { 
    currentUser, 
    isConnectedToSupabase, 
    isConfigured,
    signOutUser, 
    isSyncing,
    lastSyncedAt
  } = useAuth();

  const [isOpenMenu, setIsOpenMenu] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOutUser();
      setIsOpenMenu(false);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpenMenu(prev => !prev)}
        className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border border-white/30 hover:bg-white/15 bg-white/10 text-white transition cursor-pointer text-xs"
        title="Status da Conexão Supabase PostgreSQL"
      >
        <Database className="w-3.5 h-3.5 text-emerald-300" />
        <span className="font-semibold text-[11px]">
          {isConfigured ? 'Supabase' : 'DB Local'}
        </span>
        <span 
          className={`w-1.5 h-1.5 rounded-full ${
            isConnectedToSupabase || isConfigured 
              ? 'bg-emerald-400 animate-pulse' 
              : 'bg-emerald-300'
          }`} 
        />
      </button>

      {/* Dropdown Menu */}
      {isOpenMenu && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpenMenu(false)} 
          />
          <div className={`absolute z-50 w-56 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl shadow-xl p-3 text-xs space-y-2.5 ${
            dropdownPosition === 'up'
              ? 'bottom-full mb-2 right-0'
              : 'left-[-60px] sm:left-[-70px] top-full mt-1.5'
          }`}>
          <div className="border-b border-stone-100 dark:border-stone-800 pb-2 flex items-center justify-between">
            <div>
              <p className="font-bold text-stone-800 dark:text-stone-200">
                Supabase PostgreSQL
              </p>
              <p className="text-stone-400 dark:text-stone-500 text-[10px]">
                Backend & Banco de Dados
              </p>
            </div>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              {isConfigured ? 'Conectado' : 'Modo Offline / Local'}
            </span>
          </div>

          <div className="space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between text-stone-600 dark:text-stone-400">
              <span>Status:</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                {isConfigured ? 'Nuvem Ativa' : 'Pronto p/ Conexão'}
              </span>
            </div>

            {isSyncing && (
              <div className="flex items-center space-x-1.5 text-blue-600 dark:text-blue-400 text-[11px]">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Sincronizando tabelas...</span>
              </div>
            )}

            {lastSyncedAt && (
              <div className="text-[10px] text-stone-400 pt-1">
                Última sincronização: {lastSyncedAt.toLocaleTimeString('pt-BR')}
              </div>
            )}
          </div>

          {currentUser && (
            <div className="pt-2 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between">
              <span className="text-[11px] text-stone-600 dark:text-stone-400 truncate max-w-[130px]">
                {currentUser.email || currentUser.displayName}
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                className="text-[11px] text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <LogOut className="w-3 h-3" />
                Sair
              </button>
            </div>
          )}
        </div>
        </>
      )}
    </div>
  );
};
