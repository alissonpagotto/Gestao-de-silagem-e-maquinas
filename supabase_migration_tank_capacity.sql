-- ==============================================================================
-- MIGRAÇÃO SUPABASE: Adicionar coluna 'tank_capacity' na tabela 'gestao_frotas'
-- Executar no Supabase SQL Editor
-- ==============================================================================

ALTER TABLE public.gestao_frotas ADD COLUMN IF NOT EXISTS tank_capacity NUMERIC DEFAULT 0;

-- Recarrega o cache de schema da API PostgREST para reconhecer a nova coluna imediatamente
NOTIFY pgrst, 'reload schema';
