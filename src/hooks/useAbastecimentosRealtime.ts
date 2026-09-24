import { useState, useEffect, useCallback, useRef } from 'react';
import { FuelLog } from '../types';
import { supabase } from '../lib/supabaseClient';
import { fetchAbastecimentos, isRealtimeWebSocketActive, getAbastecimentosTableName } from '../lib/supabaseService';
import { getStoredFuelLogs, saveStoredFuelLogs } from '../lib/storage';

export interface UseAbastecimentosRealtimeOptions {
  initialLogs?: FuelLog[];
  companyId?: string;
  onUpdate?: (logs: FuelLog[]) => void;
  autoFetch?: boolean;
  pollIntervalMs?: number;
}

export interface UseAbastecimentosRealtimeReturn {
  fuelLogs: FuelLog[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<FuelLog[]>;
  setFuelLogs: React.Dispatch<React.SetStateAction<FuelLog[]>>;
  [Symbol.iterator](): Iterator<any>;
  [index: number]: any;
}

/**
 * Hook useAbastecimentosRealtime
 * 
 * Gerencia a sincronização em tempo real de abastecimentos com o Supabase Realtime,
 * com estratégia resiliente de 3 vias preparada para ambientes de proxy e sandbox (como Google IDX):
 * 1. Canal Supabase Realtime (postgres_changes na tabela 'abastecimentos' e 'site_settings')
 * 2. Polling inteligente de fallback (intervalo de 30s)
 * 3. Eventos de foco e visibilidade (re-busca imediata ao focar na aba/janela)
 */
export function useAbastecimentosRealtime(
  optionsOrInitialLogs?: FuelLog[] | UseAbastecimentosRealtimeOptions
): UseAbastecimentosRealtimeReturn {
  const options: UseAbastecimentosRealtimeOptions = Array.isArray(optionsOrInitialLogs)
    ? { initialLogs: optionsOrInitialLogs }
    : (optionsOrInitialLogs || {});

  const {
    initialLogs,
    companyId,
    onUpdate,
    autoFetch = true,
    pollIntervalMs = 30000,
  } = options;

  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>(() => {
    if (initialLogs && initialLogs.length > 0) return initialLogs;
    return getStoredFuelLogs();
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const lastSyncedState = useRef<string>(JSON.stringify(fuelLogs));
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  // Sincroniza se a prop inicial mudar
  useEffect(() => {
    if (initialLogs && initialLogs.length > 0) {
      const serialized = JSON.stringify(initialLogs);
      if (serialized !== lastSyncedState.current) {
        lastSyncedState.current = serialized;
        setFuelLogs(initialLogs);
      }
    }
  }, [initialLogs]);

  const refetch = useCallback(async (): Promise<FuelLog[]> => {
    try {
      setLoading(true);
      setError(null);
      const fresh = await fetchAbastecimentos(companyId);
      if (fresh && Array.isArray(fresh)) {
        const serialized = JSON.stringify(fresh);
        if (serialized !== lastSyncedState.current) {
          lastSyncedState.current = serialized;
          setFuelLogs(fresh);
          saveStoredFuelLogs(fresh);
          if (onUpdateRef.current) {
            onUpdateRef.current(fresh);
          }
        }
        return fresh;
      }
      return [];
    } catch (err: any) {
      console.warn('[useAbastecimentosRealtime] Erro ao sincronizar abastecimentos:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      return [];
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (!autoFetch) return;

    let isMounted = true;

    const executeSafeFetch = async () => {
      if (!isMounted) return;
      try {
        const fresh = await fetchAbastecimentos(companyId);
        if (fresh && Array.isArray(fresh) && isMounted) {
          const serialized = JSON.stringify(fresh);
          if (serialized !== lastSyncedState.current) {
            lastSyncedState.current = serialized;
            setFuelLogs(fresh);
            saveStoredFuelLogs(fresh);
            if (onUpdateRef.current) {
              onUpdateRef.current(fresh);
            }
          }
        }
      } catch (err) {
        console.warn('[useAbastecimentosRealtime] Falha na busca segura:', err);
      }
    };

    // 1. ATIVAÇÃO DO ESCUTADOR DE EVENTOS REALTIME (Postgres Changes):
    const currentTable = getAbastecimentosTableName() || 'abastecimentos';
    const channelId = `abastecimentos-hook-${Math.random().toString(36).substring(2, 8)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: currentTable },
        () => {
          executeSafeFetch();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'site_settings' },
        () => {
          executeSafeFetch();
        }
      );

    if (isRealtimeWebSocketActive) {
      channel.subscribe();
    }

    // 2. EVITAR CONFLITOS COM O PROXY DO GOOGLE IDX (Fallback Seguro a cada 30 segundos)
    const intervalId = setInterval(() => {
      executeSafeFetch();
    }, pollIntervalMs);

    // 3. RECUPERAÇÃO INSTANTÂNEA AO RETORNAR PARA A ABA (Visibility / Focus)
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        executeSafeFetch();
      }
    };

    const handleCustomSync = () => {
      executeSafeFetch();
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);
    window.addEventListener('silagem_force_rest_sync', handleCustomSync);

    return () => {
      isMounted = false;
      try {
        supabase.removeChannel(channel);
      } catch (_) {}
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.removeEventListener('silagem_force_rest_sync', handleCustomSync);
    };
  }, [autoFetch, companyId, pollIntervalMs]);

  // Suporte a desestruturação como Objeto { fuelLogs, refetch } ou Array [fuelLogs, refetch]
  const tuple = [fuelLogs, refetch, loading, error] as const;
  const result = Object.assign([...tuple], {
    fuelLogs,
    loading,
    error,
    refetch,
    setFuelLogs,
    [Symbol.iterator]: function* () {
      yield fuelLogs;
      yield refetch;
      yield loading;
      yield error;
    }
  }) as UseAbastecimentosRealtimeReturn;

  return result;
}

export default useAbastecimentosRealtime;
