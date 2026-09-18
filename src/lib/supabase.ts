import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Centralized Supabase Client Configuration
 * Maps environment variables:
 * - SUPABASE_URL (or VITE_SUPABASE_URL)
 * - SUPABASE_ANON_KEY (or VITE_SUPABASE_ANON_KEY)
 */

const metaEnv = ((import.meta as any)?.env || {}) as Record<string, string | undefined>;

// Injetadas diretamente pelo sistema e vite.config.ts
const rawUrl = (
  metaEnv.VITE_SUPABASE_URL ||
  metaEnv.SUPABASE_URL ||
  (typeof process !== 'undefined' && (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL)) ||
  ''
);

const rawKey = (
  metaEnv.VITE_SUPABASE_ANON_KEY ||
  metaEnv.SUPABASE_ANON_KEY ||
  (typeof process !== 'undefined' && (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY)) ||
  ''
);

// Sanitização obrigatória para garantir que o cliente Supabase receba a URL base do projeto (sem /rest/v1 duplicado)
export const SUPABASE_URL = String(rawUrl).trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
export const SUPABASE_ANON_KEY = String(rawKey).trim();

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL &&
  SUPABASE_ANON_KEY &&
  SUPABASE_URL.startsWith('http')
);

if (isSupabaseConfigured) {
  console.log('✅ Supabase conectado diretamente via variáveis de ambiente da nuvem:', SUPABASE_URL);
} else {
  console.warn('⚠️ Credenciais do Supabase não encontradas no ambiente.');
}

// Inicialização direta do cliente oficial com as credenciais reais de produção e schema público estático
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
      }
    }
  }
);

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
    console.warn('Supabase query notice:', error.message);
    return false;
  } catch (err) {
    console.warn('Supabase ping notice:', err);
    return false;
  }
}
