import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Centralized Supabase Client Configuration
 * Maps environment variables:
 * - SUPABASE_URL (or VITE_SUPABASE_URL)
 * - SUPABASE_ANON_KEY (or VITE_SUPABASE_ANON_KEY)
 */

function getEnv(key: string): string {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any)?.env) {
      const val = (import.meta as any).env[key] || (import.meta as any).env[`VITE_${key}`];
      if (val && String(val).trim()) return String(val).trim();
    }
  } catch (_) {}

  try {
    if (typeof process !== 'undefined' && process?.env) {
      const val = process.env[key] || process.env[`VITE_${key}`];
      if (val && String(val).trim()) return String(val).trim();
    }
  } catch (_) {}

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = localStorage.getItem(`silagem_facil_${key.toLowerCase()}`) ||
                     localStorage.getItem(key) ||
                     localStorage.getItem(`VITE_${key}`);
      if (stored && stored.trim()) return stored.trim();
    }
  } catch (_) {}

  return '';
}

export const SUPABASE_URL = getEnv('SUPABASE_URL');
export const SUPABASE_ANON_KEY = getEnv('SUPABASE_ANON_KEY');

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL &&
  SUPABASE_ANON_KEY &&
  SUPABASE_URL.startsWith('http') &&
  !SUPABASE_URL.includes('placeholder')
);

if (isSupabaseConfigured) {
  console.log('✅ Supabase inicializado com sucesso para:', SUPABASE_URL);
} else {
  console.log('ℹ️ Supabase utilizando cliente local/offline');
}

// Fallback client to prevent application crash if credentials are not yet populated in the environment
const fallbackUrl = 'https://supabase-erp-demo.supabase.co';
const fallbackAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlbW8iLCJyb2xlIjoiYW5vbiIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoyMDAwMDAwMDAwfQ.placeholder';

export const supabase: SupabaseClient = createClient(
  isSupabaseConfigured ? SUPABASE_URL : fallbackUrl,
  isSupabaseConfigured ? SUPABASE_ANON_KEY : fallbackAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    }
  }
);

/**
 * Tests connection to the Supabase instance
 */
export async function testSupabaseConnection(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const { error } = await supabase.from('clientes').select('id').limit(1);
    if (!error) return true;
    // PGRST116 means 0 rows or table query succeeded
    if (error.code === 'PGRST116') return true;
    console.warn('Supabase query notice:', error.message);
    return false;
  } catch (err) {
    console.warn('Supabase ping notice:', err);
    return false;
  }
}
