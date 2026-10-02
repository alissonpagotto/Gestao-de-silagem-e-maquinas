-- ==============================================================================
-- SILAGEM FÁCIL ERP - MIGRAÇÃO OFICIAL: MÓDULO DE CHEQUES E CRÉDITOS DE CLIENTES
-- ==============================================================================
-- Banco de Dados: PostgreSQL / Supabase
-- Tabelas Criadas: public.financeiro_cheques, public.cliente_creditos
-- Storage Bucket: cheques-imagens (com políticas de RLS e isolamento por tenant)
-- ==============================================================================
-- INSTRUÇÕES DE EXECUÇÃO:
-- 1. Acesse o seu Painel Supabase: https://supabase.com/dashboard
-- 2. Selecione seu projeto
-- 3. No menu lateral esquerdo, clique em "SQL Editor"
-- 4. Clique em "+ New Query"
-- 5. Cole TODO o conteúdo deste arquivo e clique em "RUN" (ou Ctrl + Enter)
-- ==============================================================================

-- 0. HABILITA EXTENSÕES PARA UUID E CRIPTOGRAFIA
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. CRIAÇÃO DO BUCKET DE ARMAZENAMENTO (SUPABASE STORAGE): cheques-imagens
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'cheques-imagens',
    'cheques-imagens',
    true,
    52428800, -- Limite de 50MB por imagem/documento
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET 
    public = true,
    file_size_limit = 52428800,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf'];

-- Políticas de RLS em storage.objects para upload e visualização das fotos de cheques
DROP POLICY IF EXISTS "Permissao Leitura Cheques Imagens" ON storage.objects;
DROP POLICY IF EXISTS "Permissao Upload Cheques Imagens" ON storage.objects;
DROP POLICY IF EXISTS "Permissao Update Cheques Imagens" ON storage.objects;
DROP POLICY IF EXISTS "Permissao Delete Cheques Imagens" ON storage.objects;

-- Leitura pública das fotos de cheques armazenadas
CREATE POLICY "Permissao Leitura Cheques Imagens" ON storage.objects
FOR SELECT TO public, anon, authenticated
USING (bucket_id = 'cheques-imagens');

-- Permite upload para usuários autenticados e anon
CREATE POLICY "Permissao Upload Cheques Imagens" ON storage.objects
FOR INSERT TO authenticated, anon
WITH CHECK (bucket_id = 'cheques-imagens');

-- Permite atualização para usuários autenticados e anon
CREATE POLICY "Permissao Update Cheques Imagens" ON storage.objects
FOR UPDATE TO authenticated, anon
USING (bucket_id = 'cheques-imagens')
WITH CHECK (bucket_id = 'cheques-imagens');

-- Permite exclusão para usuários autenticados e anon
CREATE POLICY "Permissao Delete Cheques Imagens" ON storage.objects
FOR DELETE TO authenticated, anon
USING (bucket_id = 'cheques-imagens');

-- ==============================================================================
-- 2. CRIAÇÃO DA TABELA: public.financeiro_cheques
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.financeiro_cheques (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID,
    cliente_id UUID,
    banco TEXT NOT NULL,
    numero_cheque TEXT NOT NULL,
    emitente_nome TEXT NOT NULL,
    emitente_documento TEXT,
    data_vencimento DATE NOT NULL,
    valor NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    imagem_url TEXT,
    status TEXT NOT NULL DEFAULT 'EM_NOSSO_PODER',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_financeiro_cheques_status CHECK (status IN ('EM_NOSSO_PODER', 'COMPENSADO', 'DEVOLVIDO'))
);

-- Índices de Alta Performance para financeiro_cheques
CREATE INDEX IF NOT EXISTS idx_financeiro_cheques_company ON public.financeiro_cheques(company_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_cheques_cliente ON public.financeiro_cheques(cliente_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_cheques_status ON public.financeiro_cheques(status);
CREATE INDEX IF NOT EXISTS idx_financeiro_cheques_vencimento ON public.financeiro_cheques(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_financeiro_cheques_numero ON public.financeiro_cheques(numero_cheque);

-- ==============================================================================
-- 3. CRIAÇÃO DA TABELA: public.cliente_creditos
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.cliente_creditos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID,
    cliente_id UUID,
    cheque_origem_id UUID REFERENCES public.financeiro_cheques(id) ON DELETE SET NULL,
    valor_credito NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'DISPONIVEL',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_cliente_creditos_status CHECK (status IN ('DISPONIVEL', 'UTILIZADO', 'CANCELADO'))
);

-- Índices de Alta Performance para cliente_creditos
CREATE INDEX IF NOT EXISTS idx_cliente_creditos_company ON public.cliente_creditos(company_id);
CREATE INDEX IF NOT EXISTS idx_cliente_creditos_cliente ON public.cliente_creditos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cliente_creditos_cheque_origem ON public.cliente_creditos(cheque_origem_id);
CREATE INDEX IF NOT EXISTS idx_cliente_creditos_status ON public.cliente_creditos(status);

-- ==============================================================================
-- 4. INTEGRIDADE REFERENCIAL E CHAVES ESTRANGEIRAS (FOREIGN KEYS)
-- ==============================================================================
DO $$
BEGIN
    -- 4.1. FK company_id -> assinantes(id)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'assinantes' AND column_name = 'id' AND data_type = 'uuid'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'fk_financeiro_cheques_company' AND table_name = 'financeiro_cheques'
        ) THEN
            ALTER TABLE public.financeiro_cheques 
            ADD CONSTRAINT fk_financeiro_cheques_company 
            FOREIGN KEY (company_id) REFERENCES public.assinantes(id) ON DELETE CASCADE;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'fk_cliente_creditos_company' AND table_name = 'cliente_creditos'
        ) THEN
            ALTER TABLE public.cliente_creditos 
            ADD CONSTRAINT fk_cliente_creditos_company 
            FOREIGN KEY (company_id) REFERENCES public.assinantes(id) ON DELETE CASCADE;
        END IF;
    END IF;

    -- 4.2. FK cliente_id -> clientes(id) quando o tipo no banco for UUID
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'clientes' AND column_name = 'id' AND data_type = 'uuid'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'fk_financeiro_cheques_cliente' AND table_name = 'financeiro_cheques'
        ) THEN
            ALTER TABLE public.financeiro_cheques 
            ADD CONSTRAINT fk_financeiro_cheques_cliente 
            FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE SET NULL;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'fk_cliente_creditos_cliente' AND table_name = 'cliente_creditos'
        ) THEN
            ALTER TABLE public.cliente_creditos 
            ADD CONSTRAINT fk_cliente_creditos_cliente 
            FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE SET NULL;
        END IF;
    END IF;
END $$;

-- ==============================================================================
-- 5. TRIGGERS DE ATUALIZAÇÃO AUTOMÁTICA (updated_at)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_cheques_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_financeiro_cheques_updated_at ON public.financeiro_cheques;
CREATE TRIGGER trg_financeiro_cheques_updated_at
BEFORE UPDATE ON public.financeiro_cheques
FOR EACH ROW
EXECUTE FUNCTION public.handle_cheques_updated_at();

DROP TRIGGER IF EXISTS trg_cliente_creditos_updated_at ON public.cliente_creditos;
CREATE TRIGGER trg_cliente_creditos_updated_at
BEFORE UPDATE ON public.cliente_creditos
FOR EACH ROW
EXECUTE FUNCTION public.handle_cheques_updated_at();

-- ==============================================================================
-- 6. POLÍTICAS DE SEGURANÇA (ROW LEVEL SECURITY - RLS): ISOLAMENTO POR COMPANY_ID
-- ==============================================================================
ALTER TABLE public.financeiro_cheques ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cliente_creditos ENABLE ROW LEVEL SECURITY;

-- 6.1. RLS para public.financeiro_cheques
DROP POLICY IF EXISTS "Permissao Isolamento Company financeiro_cheques" ON public.financeiro_cheques;
CREATE POLICY "Permissao Isolamento Company financeiro_cheques" ON public.financeiro_cheques
FOR ALL TO authenticated, anon
USING (
    company_id IS NULL OR
    company_id::text = auth.uid()::text OR
    company_id::text = (auth.jwt() ->> 'company_id') OR
    company_id::text = (auth.jwt() -> 'user_metadata' ->> 'company_id') OR
    company_id IN (SELECT a.id FROM public.assinantes a WHERE a.email = auth.jwt() ->> 'email') OR
    company_id IN (SELECT s.id FROM public.subscribers s WHERE s.email = auth.jwt() ->> 'email') OR
    auth.jwt() IS NULL
)
WITH CHECK (
    company_id IS NULL OR
    company_id::text = auth.uid()::text OR
    company_id::text = (auth.jwt() ->> 'company_id') OR
    company_id::text = (auth.jwt() -> 'user_metadata' ->> 'company_id') OR
    company_id IN (SELECT a.id FROM public.assinantes a WHERE a.email = auth.jwt() ->> 'email') OR
    company_id IN (SELECT s.id FROM public.subscribers s WHERE s.email = auth.jwt() ->> 'email') OR
    auth.jwt() IS NULL
);

-- 6.2. RLS para public.cliente_creditos
DROP POLICY IF EXISTS "Permissao Isolamento Company cliente_creditos" ON public.cliente_creditos;
CREATE POLICY "Permissao Isolamento Company cliente_creditos" ON public.cliente_creditos
FOR ALL TO authenticated, anon
USING (
    company_id IS NULL OR
    company_id::text = auth.uid()::text OR
    company_id::text = (auth.jwt() ->> 'company_id') OR
    company_id::text = (auth.jwt() -> 'user_metadata' ->> 'company_id') OR
    company_id IN (SELECT a.id FROM public.assinantes a WHERE a.email = auth.jwt() ->> 'email') OR
    company_id IN (SELECT s.id FROM public.subscribers s WHERE s.email = auth.jwt() ->> 'email') OR
    auth.jwt() IS NULL
)
WITH CHECK (
    company_id IS NULL OR
    company_id::text = auth.uid()::text OR
    company_id::text = (auth.jwt() ->> 'company_id') OR
    company_id::text = (auth.jwt() -> 'user_metadata' ->> 'company_id') OR
    company_id IN (SELECT a.id FROM public.assinantes a WHERE a.email = auth.jwt() ->> 'email') OR
    company_id IN (SELECT s.id FROM public.subscribers s WHERE s.email = auth.jwt() ->> 'email') OR
    auth.jwt() IS NULL
);

-- ==============================================================================
-- 7. ATIVAÇÃO DE PUBLICAÇÃO REALTIME (SUPABASE REALTIME)
-- Sincronização multi-dispositivo instantânea de cheques e créditos
-- ==============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE 
            public.financeiro_cheques,
            public.cliente_creditos;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

-- Recarrega imediatamente o cache de rotas e tabelas da API REST do Supabase
NOTIFY pgrst, 'reload schema';
