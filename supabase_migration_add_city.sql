-- ==============================================================================
-- MIGRAÇÃO DE CORREÇÃO: Adicionar colunas de cidade/estado na tabela clientes
-- Erro tratado: PGRST204 (Could not find the 'city' column of 'clientes' in the schema cache)
-- ==============================================================================

-- 1. Adiciona a coluna 'city' se não existir
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS city TEXT;

-- 2. Adiciona a coluna 'state' se não existir
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS state TEXT;

-- 3. Adiciona a coluna 'company_id' para compatibilidade multi-empresa
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS company_id TEXT;

-- 4. Recarrega o cache do PostgREST imediatamente para liberar novas colunas na API
NOTIFY pgrst, 'reload schema';
