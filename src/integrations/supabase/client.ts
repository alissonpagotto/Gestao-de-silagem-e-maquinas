// Cliente Supabase unificado e conectado diretamente às credenciais da nuvem
import { supabase, isSupabaseConfigured, SUPABASE_URL, SUPABASE_ANON_KEY, testSupabaseConnection } from '../../lib/supabase';

export { supabase, isSupabaseConfigured, SUPABASE_URL, SUPABASE_ANON_KEY, testSupabaseConnection };
export default supabase;
