-- ==============================================================================
-- MIGRAÇÃO DE CORREÇÃO: Alinhamento de colunas da tabela clientes no Supabase
-- Erros tratados: PGRST204 (Could not find 'name', 'nome', 'city' in schema cache)
-- ==============================================================================

-- 1. Garante as colunas 'name' (inglês) e 'nome' (português) para compatibilidade universal
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS nome TEXT;

-- 2. Sincroniza dados existentes caso uma coluna esteja preenchida e a outra nula
UPDATE public.clientes SET name = nome WHERE name IS NULL AND nome IS NOT NULL;
UPDATE public.clientes SET nome = name WHERE nome IS NULL AND name IS NOT NULL;

-- 3. Garante colunas de localização e organização multi-empresa
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS company_id TEXT;

-- 4. Recarrega o cache do PostgREST imediatamente para liberar novas colunas na API
NOTIFY pgrst, 'reload schema';
