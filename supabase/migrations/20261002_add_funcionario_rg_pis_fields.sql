-- ==============================================================================
-- MIGRAÇÃO SUPABASE: CAMPOS DE DOCUMENTOS E CONTRATO DE FUNCIONÁRIOS
-- Tabelas: public.funcionarios e public.rh_funcionarios
-- ==============================================================================

-- 1. Campos na tabela public.funcionarios
ALTER TABLE IF EXISTS public.funcionarios ADD COLUMN IF NOT EXISTS numero_rg TEXT;
ALTER TABLE IF EXISTS public.funcionarios ADD COLUMN IF NOT EXISTS data_nascimento DATE;
ALTER TABLE IF EXISTS public.funcionarios ADD COLUMN IF NOT EXISTS numero_pis TEXT;
ALTER TABLE IF EXISTS public.funcionarios ADD COLUMN IF NOT EXISTS regime_contratacao TEXT;
ALTER TABLE IF EXISTS public.funcionarios ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE IF EXISTS public.funcionarios ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE IF EXISTS public.funcionarios ADD COLUMN IF NOT EXISTS cpf TEXT;
ALTER TABLE IF EXISTS public.funcionarios ADD COLUMN IF NOT EXISTS telefone TEXT;
ALTER TABLE IF EXISTS public.funcionarios ADD COLUMN IF NOT EXISTS data_admissao DATE;
ALTER TABLE IF EXISTS public.funcionarios ADD COLUMN IF NOT EXISTS salario NUMERIC(15,2) DEFAULT 0;

-- 2. Campos na tabela public.rh_funcionarios
ALTER TABLE IF EXISTS public.rh_funcionarios ADD COLUMN IF NOT EXISTS numero_rg TEXT;
ALTER TABLE IF EXISTS public.rh_funcionarios ADD COLUMN IF NOT EXISTS rg TEXT;
ALTER TABLE IF EXISTS public.rh_funcionarios ADD COLUMN IF NOT EXISTS data_nascimento DATE;
ALTER TABLE IF EXISTS public.rh_funcionarios ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE IF EXISTS public.rh_funcionarios ADD COLUMN IF NOT EXISTS numero_pis TEXT;
ALTER TABLE IF EXISTS public.rh_funcionarios ADD COLUMN IF NOT EXISTS pis TEXT;
ALTER TABLE IF EXISTS public.rh_funcionarios ADD COLUMN IF NOT EXISTS regime_contratacao TEXT;
ALTER TABLE IF EXISTS public.rh_funcionarios ADD COLUMN IF NOT EXISTS contract_type TEXT;

-- Recarrega o cache do PostgREST
NOTIFY pgrst, 'reload schema';
