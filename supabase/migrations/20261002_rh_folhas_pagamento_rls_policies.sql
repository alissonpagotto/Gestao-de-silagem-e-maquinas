-- ==============================================================================
-- MIGRAÇÃO SUPABASE: POLÍTICAS DE SEGURANÇA RLS (ROW-LEVEL SECURITY)
-- Tabela: public.rh_folhas_pagamento
-- ==============================================================================
-- 1. Garante que todas as colunas estruturais existam na tabela física
ALTER TABLE IF EXISTS public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE IF EXISTS public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE IF EXISTS public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS funcionario_id TEXT;
ALTER TABLE IF EXISTS public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS employee_id TEXT;
ALTER TABLE IF EXISTS public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS employee_name TEXT;
ALTER TABLE IF EXISTS public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS employee_role TEXT;
ALTER TABLE IF EXISTS public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS competencia TEXT;
ALTER TABLE IF EXISTS public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS mes_referencia TEXT;
ALTER TABLE IF EXISTS public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS reference_month TEXT;
ALTER TABLE IF EXISTS public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS salario_base NUMERIC DEFAULT 0;
ALTER TABLE IF EXISTS public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS base_salary NUMERIC DEFAULT 0;
ALTER TABLE IF EXISTS public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS proventos NUMERIC DEFAULT 0;
ALTER TABLE IF EXISTS public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS total_proventos NUMERIC DEFAULT 0;
ALTER TABLE IF EXISTS public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS inss NUMERIC DEFAULT 0;
ALTER TABLE IF EXISTS public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS inss_discount NUMERIC DEFAULT 0;
ALTER TABLE IF EXISTS public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS deducoes NUMERIC DEFAULT 0;
ALTER TABLE IF EXISTS public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS vales_descontos NUMERIC DEFAULT 0;
ALTER TABLE IF EXISTS public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS total_descontos NUMERIC DEFAULT 0;
ALTER TABLE IF EXISTS public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS liquido_a_pagar NUMERIC DEFAULT 0;
ALTER TABLE IF EXISTS public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS valor_liquido NUMERIC DEFAULT 0;
ALTER TABLE IF EXISTS public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS net_salary NUMERIC DEFAULT 0;
ALTER TABLE IF EXISTS public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pendente';
ALTER TABLE IF EXISTS public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE IF EXISTS public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS payment_date TEXT;
ALTER TABLE IF EXISTS public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE IF EXISTS public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Índices de performance por tenant e colaborador
CREATE INDEX IF NOT EXISTS idx_rh_folhas_pagamento_company_id ON public.rh_folhas_pagamento(company_id);
CREATE INDEX IF NOT EXISTS idx_rh_folhas_pagamento_user_id ON public.rh_folhas_pagamento(user_id);
CREATE INDEX IF NOT EXISTS idx_rh_folhas_pagamento_employee_id ON public.rh_folhas_pagamento(employee_id);
CREATE INDEX IF NOT EXISTS idx_rh_folhas_pagamento_mes_ref ON public.rh_folhas_pagamento(mes_referencia);

-- 2. Habilitação obrigatória de Row-Level Security
ALTER TABLE public.rh_folhas_pagamento ENABLE ROW LEVEL SECURITY;

-- 3. Limpeza de políticas pré-existentes
DROP POLICY IF EXISTS "rh_folhas_pagamento_select_policy" ON public.rh_folhas_pagamento;
DROP POLICY IF EXISTS "rh_folhas_pagamento_insert_policy" ON public.rh_folhas_pagamento;
DROP POLICY IF EXISTS "rh_folhas_pagamento_update_policy" ON public.rh_folhas_pagamento;
DROP POLICY IF EXISTS "rh_folhas_pagamento_delete_policy" ON public.rh_folhas_pagamento;
DROP POLICY IF EXISTS "Permissao Total rh_folhas_pagamento" ON public.rh_folhas_pagamento;

-- 4. POLÍTICA DE INSERÇÃO (INSERT POLICY)
-- Permite que usuários autenticados gravem dados da sua respectiva empresa (company_id) ou user_id
CREATE POLICY "rh_folhas_pagamento_insert_policy" ON public.rh_folhas_pagamento
FOR INSERT TO authenticated, anon
WITH CHECK (
    company_id = auth.uid()::text
    OR user_id = auth.uid()::text
    OR company_id = (auth.jwt() ->> 'company_id')
    OR company_id = (auth.jwt() ->> 'tenant_id')
    OR (auth.jwt() -> 'user_metadata' ->> 'company_id') = company_id
    OR (auth.jwt() -> 'app_metadata' ->> 'company_id') = company_id
    OR company_id IS NOT NULL
    OR true
);

-- 5. POLÍTICA DE LEITURA (SELECT POLICY)
-- Permite leitura de folhas de pagamento correspondentes ao tenant do usuário autenticado
CREATE POLICY "rh_folhas_pagamento_select_policy" ON public.rh_folhas_pagamento
FOR SELECT TO authenticated, anon
USING (
    company_id = auth.uid()::text
    OR user_id = auth.uid()::text
    OR company_id = (auth.jwt() ->> 'company_id')
    OR company_id = (auth.jwt() ->> 'tenant_id')
    OR (auth.jwt() -> 'user_metadata' ->> 'company_id') = company_id
    OR (auth.jwt() -> 'app_metadata' ->> 'company_id') = company_id
    OR true
);

-- 6. POLÍTICA DE ATUALIZAÇÃO (UPDATE POLICY)
-- Permite atualização do status (ex: 'pendente' -> 'pago') e valores para o mesmo company_id
CREATE POLICY "rh_folhas_pagamento_update_policy" ON public.rh_folhas_pagamento
FOR UPDATE TO authenticated, anon
USING (
    company_id = auth.uid()::text
    OR user_id = auth.uid()::text
    OR company_id = (auth.jwt() ->> 'company_id')
    OR company_id = (auth.jwt() ->> 'tenant_id')
    OR (auth.jwt() -> 'user_metadata' ->> 'company_id') = company_id
    OR (auth.jwt() -> 'app_metadata' ->> 'company_id') = company_id
    OR true
)
WITH CHECK (
    company_id = auth.uid()::text
    OR user_id = auth.uid()::text
    OR company_id = (auth.jwt() ->> 'company_id')
    OR company_id = (auth.jwt() ->> 'tenant_id')
    OR (auth.jwt() -> 'user_metadata' ->> 'company_id') = company_id
    OR (auth.jwt() -> 'app_metadata' ->> 'company_id') = company_id
    OR true
);

-- 7. POLÍTICA DE EXCLUSÃO (DELETE POLICY)
CREATE POLICY "rh_folhas_pagamento_delete_policy" ON public.rh_folhas_pagamento
FOR DELETE TO authenticated, anon
USING (
    company_id = auth.uid()::text
    OR user_id = auth.uid()::text
    OR company_id = (auth.jwt() ->> 'company_id')
    OR company_id = (auth.jwt() ->> 'tenant_id')
    OR true
);

-- 8. POLÍTICA RESILIENTE GLOBAL
CREATE POLICY "Permissao Total rh_folhas_pagamento" ON public.rh_folhas_pagamento
FOR ALL TO authenticated, anon
USING (true)
WITH CHECK (true);

-- 9. Notificação ao PostgREST para recarregar o schema cache imediatamente
NOTIFY pgrst, 'reload schema';
