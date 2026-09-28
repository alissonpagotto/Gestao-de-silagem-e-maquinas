-- ==============================================================================
-- MIGRAÇÃO SUPABASE: Vínculo Oficial de Motoristas em 'gestao_frotas'
-- Executar no Supabase SQL Editor
-- ==============================================================================

-- 1. Colunas de chave para identificar o motorista responsável (UUID)
ALTER TABLE public.gestao_frotas ADD COLUMN IF NOT EXISTS driver_id UUID;
ALTER TABLE public.gestao_frotas ADD COLUMN IF NOT EXISTS motorista_id UUID;

-- 2. Colunas de texto para armazenar o nome do motorista
ALTER TABLE public.gestao_frotas ADD COLUMN IF NOT EXISTS motorista TEXT;
ALTER TABLE public.gestao_frotas ADD COLUMN IF NOT EXISTS operator_or_driver TEXT;

-- 3. Colunas estruturadas JSONB para múltiplos motoristas atribuídos
ALTER TABLE public.gestao_frotas ADD COLUMN IF NOT EXISTS assigned_driver_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.gestao_frotas ADD COLUMN IF NOT EXISTS assigned_drivers JSONB DEFAULT '[]'::jsonb;

-- 4. Índice de performance
CREATE INDEX IF NOT EXISTS idx_gestao_frotas_driver_id ON public.gestao_frotas(driver_id);
CREATE INDEX IF NOT EXISTS idx_gestao_frotas_user_id ON public.gestao_frotas(user_id);

-- 5. Recarrega o cache do PostgREST imediatamente (elimina erro HTTP 400 / PGRST204)
NOTIFY pgrst, 'reload schema';
