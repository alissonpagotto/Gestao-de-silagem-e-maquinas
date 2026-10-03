import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Centralized Supabase Client Configuration
 * Maps environment variables:
 * - SUPABASE_URL (or VITE_SUPABASE_URL)
 * - SUPABASE_ANON_KEY (or VITE_SUPABASE_ANON_KEY)
 */

const metaEnv = ((import.meta as any)?.env || {}) as Record<string, string | undefined>;

// Credenciais canônicas unificadas para todos os ambientes e URLs (produção e IDX)
export const UNIFIED_SUPABASE_URL = 'https://dyemddjnqoxqyabbhixu.supabase.co';
export const UNIFIED_SUPABASE_ANON_KEY = 'sb_publishable_SPzmag-Va8d6RH8lVY9Zow_th9ReW1c';

function isValidKey(key: unknown): boolean {
  if (typeof key !== 'string') return false;
  const trimmed = key.trim();
  if (trimmed.length < 30) return false;
  if (trimmed.includes('@')) return false;
  if (trimmed.includes(' ') || trimmed.startsWith('http')) return false;
  if (/^(undefined|null|your-.*|dummy|placeholder)$/i.test(trimmed)) return false;
  return trimmed.startsWith('sb_') || trimmed.startsWith('eyJ');
}

function isValidUrl(url: unknown): boolean {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return false;
  if (!trimmed.includes('.supabase.co')) return false;
  if (trimmed.includes('supabase.https:')) return false;
  return true;
}

const envUrl = String(
  metaEnv.VITE_SUPABASE_URL ||
  metaEnv.SUPABASE_URL ||
  (typeof process !== 'undefined' && (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL)) ||
  ''
).trim();

const envKey = (
  metaEnv.VITE_SUPABASE_ANON_KEY ||
  metaEnv.SUPABASE_ANON_KEY ||
  (typeof process !== 'undefined' && (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY)) ||
  ''
);

// Sanitização obrigatória: garante que todos os ambientes usem estritamente as credenciais unificadas
export const SUPABASE_URL = (isValidUrl(envUrl) ? envUrl : UNIFIED_SUPABASE_URL).replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
export const SUPABASE_ANON_KEY = (isValidKey(envKey) ? String(envKey).trim() : UNIFIED_SUPABASE_ANON_KEY);

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL &&
  SUPABASE_ANON_KEY &&
  SUPABASE_URL.startsWith('http')
);

if (isSupabaseConfigured && typeof window !== 'undefined' && (window as any).__DEBUG_SUPABASE__) {
  console.log('✅ Supabase conectado de forma unificada (multi-dispositivo):', SUPABASE_URL);
}

// Classe de transporte WebSocket segura sem conexão de rede para ambientes restritos (sandboxes, Cloud Run e iFrames)
class NoOpWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  readonly readyState = 3; // CLOSED
  readonly url = '';
  readonly protocol = '';
  readonly extensions = '';
  readonly bufferedAmount = 0;
  binaryType = 'blob';
  onopen: any = null;
  onclose: any = null;
  onerror: any = null;
  onmessage: any = null;
  constructor(_url?: string) {}
  close() {}
  send() {}
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() { return true; }
}

// Inicialização direta do cliente oficial com as credenciais reais de produção e schema público estático
export const isRealtimeEnabledInEnv = typeof window !== 'undefined' && (window as any).__ENABLE_SUPABASE_REALTIME__ !== false;

// Higienização preventiva de sessão corrompida ou expirada no localStorage para evitar requisição automática de refresh com status 400 no Sandbox
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i);
      if (storageKey && (storageKey.startsWith('sb-') || storageKey.includes('-auth-token'))) {
        const itemStr = localStorage.getItem(storageKey);
        if (itemStr) {
          try {
            const parsed = JSON.parse(itemStr);
            const expiresAt = parsed?.expires_at ? Number(parsed.expires_at) * 1000 : 0;
            const isCorrupted = !parsed?.refresh_token || !parsed?.access_token;
            // Se expirou há mais de 10 minutos ou está corrompido, limpa o token órfão do Sandbox
            const isStale = expiresAt > 0 && (Date.now() - expiresAt > 600 * 1000);
            if (isCorrupted || isStale) {
              localStorage.removeItem(storageKey);
            }
          } catch {
            localStorage.removeItem(storageKey);
          }
        }
      }
    }
  } catch {}
}

export const supabase: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    db: {
      schema: 'public',
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      headers: {
        'x-application-name': 'agrocontrol-silagem',
        'x-client-info': 'agrocontrol-silagem-web',
        'Accept': '*/*',
      }
    },
    realtime: isRealtimeEnabledInEnv ? {
      params: {
        eventsPerSecond: 2,
      },
      heartbeatIntervalMs: 30000,
    } : {
      transport: NoOpWebSocket as any,
      params: {
        eventsPerSecond: 0,
      },
    }
  }
);

/**
 * Utilitário seguro para remoção e desmonte obrigatório de canais Realtime
 * Previne vazamentos de conexão e reduz o tráfego de Egress e Log Ingestion.
 */
export function safeRemoveChannel(channel: any): void {
  if (!channel) return;
  try {
    supabase.removeChannel(channel);
  } catch (_) {}
}

/**
 * Cria uma função de consulta com debounce para evitar disparos em massa ao Supabase
 */
export function createDebouncedQuery<T extends (...args: any[]) => any>(
  fn: T,
  delayMs: number = 300
): T & { cancel: () => void } {
  let timer: any = null;
  const debounced = ((...args: any[]) => {
    return new Promise((resolve, reject) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          const res = await fn(...args);
          resolve(res);
        } catch (e) {
          reject(e);
        }
      }, delayMs);
    });
  }) as any;
  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
  };
  return debounced;
}

if (typeof window !== 'undefined') {
  // Evita looping de requisições de refresh 400 em caso de token expirado
  supabase.auth.onAuthStateChange(async (event, session) => {
    if ((event === 'TOKEN_REFRESHED' && !session) || event === 'SIGNED_OUT') {
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {}
    }
  });
}

/**
 * Dicionário especializado de Códigos de Erro do PostgreSQL / PostgREST (DBA Diagnostic)
 */
export const POSTGRES_ERROR_DICTIONARY: Record<string, string> = {
  '23503': 'FOREIGN KEY VIOLATION (Violação de Chave Estrangeira): A coluna aponta para um registro que não existe ou a restrição de FK em company_id/user_id está rejeitando o valor fornecido.',
  '23505': 'UNIQUE VIOLATION (Violação de Unicidade): Tentativa de inserir registro duplicado em campo com restrição UNIQUE (ex: CPF/CNPJ, e-mail ou chave primária).',
  '23502': 'NOT NULL VIOLATION (Coluna Obrigatória Nula): Uma coluna com restrição NOT NULL não recebeu valor válido.',
  '42703': 'UNDEFINED COLUMN (Coluna Inexistente no Schema): O frontend solicitou ou tentou gravar em uma coluna que não existe fisicamente na tabela.',
  '42P01': 'UNDEFINED TABLE (Tabela Inexistente no Schema): A tabela consultada não existe no esquema público do PostgreSQL.',
  '22P02': 'INVALID TEXT REPRESENTATION (Tipo de Dado Inválido): Falha na conversão de tipo (ex: string não-UUID fornecida para coluna do tipo UUID).',
  '42501': 'INSUFFICIENT PRIVILEGE (Permissão Negada / RLS): Política de Row-Level Security impediu a operação.',
  'PGRST116': 'POSTGREST NOT FOUND: Nenhum registro encontrado para single() ou maybeSingle().',
  'PGRST204': 'POSTGREST SCHEMA CACHE MISMATCH: Coluna ou campo não mapeado no cache do PostgREST. Necessário NOTIFY pgrst, \'reload schema\'.',
  'PGRST205': 'POSTGREST TABLE NOT IN SCHEMA: Tabela não exposta no schema público do PostgREST.',
  'PGRST301': 'POSTGREST JWT EXPIRED: Token de autorização expirado.',
  '40001': 'SERIALIZATION FAILURE: Conflito de concorrência na transação.',
  '57014': 'QUERY CANCELED: Query cancelada por exceder o tempo limite (timeout).'
};

export interface PostgresErrorLogOptions {
  table?: string;
  action?: 'SELECT' | 'INSERT' | 'UPDATE' | 'UPSERT' | 'DELETE' | 'SUBSCRIBE' | 'RPC';
  payload?: any;
  companyId?: string;
}

/**
 * Função defensiva centralizada de logging de erros do PostgreSQL / Supabase
 * Exibe relatório completo com código SQLSTATE, explicação amigável, tabela e payload.
 */
export function logPostgresError(
  context: string,
  error: any,
  options?: PostgresErrorLogOptions
): void {
  if (!error) return;

  const message = error.message || String(error);

  // Falhas de transporte de WebSocket (Realtime) ou falhas transitórias de rede (Failed to fetch) não são erros de SQL/Postgres DBA
  if (
    options?.action === 'SUBSCRIBE' ||
    message.includes('transport failure') ||
    message.includes('CHANNEL_ERROR') ||
    message.includes('WebSocket') ||
    message.includes('Failed to fetch') ||
    message.includes('NetworkError') ||
    message.includes('Load failed')
  ) {
    console.warn(`⚠️ [Realtime/Network Notice] Aviso de conexão em '${context}': ${message}`);
    return;
  }

  const code = String(error.code || error.statusCode || '').trim();
  const description = POSTGRES_ERROR_DICTIONARY[code] || 'Código de erro do PostgreSQL/PostgREST não mapeado';
  const details = error.details || error.detail || '';
  const hint = error.hint || '';

  if (code === 'PGRST204' || code === '42703') {
    console.warn(`⚠️ [Schema Adaptive Notice] [${options?.action || 'QUERY'}] em '${context}' (${code}): ${message}`);
    return;
  }

  console.error(`🚨 [POSTGRES DBA ERROR] [${options?.action || 'QUERY'}] no contexto '${context}':`, {
    tabela: options?.table || 'N/A',
    codigoPostgres: code || 'SEM_CODIGO',
    diagnosticoDBA: description,
    mensagem: message,
    detalhes: details || undefined,
    dicaPostgres: hint || undefined,
    companyId: options?.companyId || undefined,
    payloadEnviado: options?.payload !== undefined ? options.payload : undefined,
    rawError: error
  });
}

/**
 * Realiza teste de integridade da conexão direta com o Supabase
 */
export async function testSupabaseConnection(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const { error } = await supabase.from('clientes').select('id').limit(1);
    if (!error) return true;
    // PGRST116 ou violação de RLS comprovam que o banco remoto respondeu com sucesso
    if (error.code === 'PGRST116' || error.message?.includes('row-level security')) return true;
    logPostgresError('testSupabaseConnection', error, { table: 'clientes', action: 'SELECT' });
    return false;
  } catch (err) {
    console.warn('Supabase ping notice:', err);
    return false;
  }
}
