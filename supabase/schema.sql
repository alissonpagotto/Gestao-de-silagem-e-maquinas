-- ==============================================================================
-- SILAGEM FÁCIL ERP - ESQUEMA RELACIONAL POSTGRESQL (SUPABASE)
-- ==============================================================================
-- Este script cria fisicamente todas as tabelas operacionais do sistema
-- com integridade referencial estrita, índices de alta performance e
-- restrição ON DELETE CASCADE entre contas_a_pagar e notas_fiscais.
-- ==============================================================================

-- 0. HABILITA EXTENSÕES PARA UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. TABELA: fornecedores
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.fornecedores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cnpj_cpf TEXT NOT NULL UNIQUE,
    razao_social TEXT NOT NULL,
    nome_fantasia TEXT,
    inscricao_estadual TEXT,
    inscricao_municipal TEXT,
    telefone_whatsapp TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para buscas rápidas
CREATE INDEX IF NOT EXISTS idx_fornecedores_cnpj_cpf ON public.fornecedores(cnpj_cpf);
CREATE INDEX IF NOT EXISTS idx_fornecedores_razao_social ON public.fornecedores(razao_social);

-- ==============================================================================
-- 2. TABELA: notas_fiscais
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.notas_fiscais (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero_nota TEXT NOT NULL,
    serie TEXT DEFAULT '1',
    chave_acesso TEXT UNIQUE,
    fornecedor_id UUID REFERENCES public.fornecedores(id) ON DELETE SET NULL,
    valor_total NUMERIC(15,2) NOT NULL,
    natureza_operacao TEXT,
    data_emissao DATE,
    data_entrada DATE DEFAULT CURRENT_DATE,
    itens_produtos JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices de consulta fiscal
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_chave ON public.notas_fiscais(chave_acesso);
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_numero ON public.notas_fiscais(numero_nota);
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_fornecedor ON public.notas_fiscais(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_emissao ON public.notas_fiscais(data_emissao);

-- ==============================================================================
-- 3. TABELA: contas_a_pagar (Financeiro)
-- Regra Crítica: ON DELETE CASCADE na chave estrangeira nota_fiscal_id
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.contas_a_pagar (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nota_fiscal_id UUID REFERENCES public.notas_fiscais(id) ON DELETE CASCADE,
    numero_parcela TEXT, -- Ex: "01/04"
    valor_parcela NUMERIC(15,2) NOT NULL,
    data_vencimento DATE NOT NULL,
    forma_pagamento TEXT,
    centro_custo TEXT, -- Vinculado à classificação obrigatória
    status_pago BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices de controle financeiro
CREATE INDEX IF NOT EXISTS idx_contas_a_pagar_nota_fiscal_id ON public.contas_a_pagar(nota_fiscal_id);
CREATE INDEX IF NOT EXISTS idx_contas_a_pagar_vencimento ON public.contas_a_pagar(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_contas_a_pagar_status ON public.contas_a_pagar(status_pago);

-- ==============================================================================
-- 4. TABELA: estoque
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.estoque (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo_produto TEXT UNIQUE,
    descricao TEXT NOT NULL,
    quantidade_atual NUMERIC(15,3) NOT NULL DEFAULT 0.000,
    preco_venda_final NUMERIC(15,2),
    preco_venda_atacado NUMERIC(15,2),
    preco_venda_promo NUMERIC(15,2),
    fim_promocao DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices de estoque
CREATE INDEX IF NOT EXISTS idx_estoque_codigo_produto ON public.estoque(codigo_produto);
CREATE INDEX IF NOT EXISTS idx_estoque_descricao ON public.estoque(descricao);

-- ==============================================================================
-- TABELAS COMPLEMENTARES DO ERP SILAGEM FÁCIL
-- ==============================================================================

-- 5. TABELA: clientes
CREATE TABLE IF NOT EXISTS public.clientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    farm_name TEXT,
    cpf_cnpj TEXT,
    state_registration TEXT,
    phone TEXT,
    email TEXT,
    city TEXT,
    state TEXT,
    total_area NUMERIC(15,2) DEFAULT 0,
    cultivated_area NUMERIC(15,2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. TABELA: rh_funcionarios
CREATE TABLE IF NOT EXISTS public.rh_funcionarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    role TEXT,
    cpf TEXT,
    phone TEXT,
    email TEXT,
    status TEXT DEFAULT 'ativo',
    registration_type TEXT DEFAULT 'Funcionário',
    salary NUMERIC(15,2) DEFAULT 0,
    admission_date DATE,
    driver_license TEXT,
    license_category TEXT,
    license_expiry DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. TABELA: gestao_frotas (Maquinários e Veículos)
CREATE TABLE IF NOT EXISTS public.gestao_frotas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type TEXT,
    model TEXT,
    plate_or_serial TEXT,
    year INTEGER,
    hourmeter NUMERIC(12,2) DEFAULT 0,
    status TEXT DEFAULT 'operacional',
    fuel_level NUMERIC(5,2) DEFAULT 100,
    accumulated_cost NUMERIC(15,2) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. TABELA: agendamentos (Agenda Operacional por Máquinas)
CREATE TABLE IF NOT EXISTS public.agendamentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_number TEXT,
    client_id UUID,
    client_name TEXT NOT NULL,
    farm_name TEXT,
    location_city_state TEXT,
    contact_phone TEXT,
    service_type TEXT,
    service_tab TEXT,
    start_date DATE,
    start_time TIME,
    estimated_quantity NUMERIC(12,2) DEFAULT 0,
    area_unit TEXT DEFAULT 'hectares',
    productivity_rate NUMERIC(8,2),
    execution_time_minutes INTEGER,
    travel_time_minutes INTEGER,
    total_time_minutes INTEGER,
    end_date DATE,
    end_time TIME,
    primary_machinery_id TEXT,
    primary_machinery_prefix TEXT,
    primary_machinery_plate TEXT,
    primary_machinery_model TEXT,
    assigned_vehicles JSONB DEFAULT '[]'::jsonb,
    assigned_team JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'agendado',
    field_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. TABELA: frentes_colheita (Frentes / Colunas da Agenda Operacional)
CREATE TABLE IF NOT EXISTS public.frentes_colheita (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    machinery_id TEXT,
    machinery_name TEXT,
    header_bg_color TEXT,
    column_bg_color TEXT,
    border_color TEXT,
    front_number INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- FUNÇÃO & TRIGGER: Atualização Automática de updated_at
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fornecedores_updated_at ON public.fornecedores;
CREATE TRIGGER trg_fornecedores_updated_at
BEFORE UPDATE ON public.fornecedores
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_clientes_updated_at ON public.clientes;
CREATE TRIGGER trg_clientes_updated_at
BEFORE UPDATE ON public.clientes
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_rh_funcionarios_updated_at ON public.rh_funcionarios;
CREATE TRIGGER trg_rh_funcionarios_updated_at
BEFORE UPDATE ON public.rh_funcionarios
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_gestao_frotas_updated_at ON public.gestao_frotas;
CREATE TRIGGER trg_gestao_frotas_updated_at
BEFORE UPDATE ON public.gestao_frotas
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- POLÍTICAS DE SEGURANÇA (ROW LEVEL SECURITY - RLS)
-- Permitem leitura e escrita das tabelas para clientes autenticados e anônimos (ERP)
-- ==============================================================================
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas_fiscais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas_a_pagar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_funcionarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gestao_frotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frentes_colheita ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    -- Agendamentos
    DROP POLICY IF EXISTS "Permissao Total Agendamentos" ON public.agendamentos;
    CREATE POLICY "Permissao Total Agendamentos" ON public.agendamentos FOR ALL USING (true) WITH CHECK (true);

    -- Frentes de Colheita
    DROP POLICY IF EXISTS "Permissao Total Frentes" ON public.frentes_colheita;
    CREATE POLICY "Permissao Total Frentes" ON public.frentes_colheita FOR ALL USING (true) WITH CHECK (true);

    -- Fornecedores
    DROP POLICY IF EXISTS "Permissao Total Fornecedores" ON public.fornecedores;
    CREATE POLICY "Permissao Total Fornecedores" ON public.fornecedores FOR ALL USING (true) WITH CHECK (true);

    -- Notas Fiscais
    DROP POLICY IF EXISTS "Permissao Total Notas Fiscais" ON public.notas_fiscais;
    CREATE POLICY "Permissao Total Notas Fiscais" ON public.notas_fiscais FOR ALL USING (true) WITH CHECK (true);

    -- Contas a Pagar
    DROP POLICY IF EXISTS "Permissao Total Contas a Pagar" ON public.contas_a_pagar;
    CREATE POLICY "Permissao Total Contas a Pagar" ON public.contas_a_pagar FOR ALL USING (true) WITH CHECK (true);

    -- Estoque
    DROP POLICY IF EXISTS "Permissao Total Estoque" ON public.estoque;
    CREATE POLICY "Permissao Total Estoque" ON public.estoque FOR ALL USING (true) WITH CHECK (true);

    -- Clientes
    DROP POLICY IF EXISTS "Permissao Total Clientes" ON public.clientes;
    CREATE POLICY "Permissao Total Clientes" ON public.clientes FOR ALL USING (true) WITH CHECK (true);

    -- RH Funcionários
    DROP POLICY IF EXISTS "Permissao Total RH" ON public.rh_funcionarios;
    CREATE POLICY "Permissao Total RH" ON public.rh_funcionarios FOR ALL USING (true) WITH CHECK (true);

    -- Gestão Frotas
    DROP POLICY IF EXISTS "Permissao Total Frotas" ON public.gestao_frotas;
    CREATE POLICY "Permissao Total Frotas" ON public.gestao_frotas FOR ALL USING (true) WITH CHECK (true);
END $$;

-- ==============================================================================
-- 8. TABELAS: Master Admin, Assinantes & Landing Page
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.subscribers (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    document TEXT,
    plan_name TEXT DEFAULT 'Produtor Essencial',
    status TEXT DEFAULT 'Trial',
    trial_ends_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '15 days'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(15,2) NOT NULL,
    billing_cycle TEXT DEFAULT 'mensal',
    badge TEXT,
    is_featured BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 1,
    limits JSONB DEFAULT '{}'::jsonb,
    features_text TEXT,
    checkout_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.site_settings (
    id TEXT PRIMARY KEY DEFAULT 'global',
    hero_badge_text TEXT,
    hero_title TEXT,
    hero_subtitle TEXT,
    hero_primary_btn_text TEXT,
    hero_secondary_btn_text TEXT,
    hero_background_image TEXT,
    hero_video_url TEXT,
    hero_overlay_opacity INTEGER DEFAULT 75,
    features_section_title TEXT,
    features_section_subtitle TEXT,
    features_highlight_image TEXT,
    features_tabs JSONB DEFAULT '[]'::jsonb,
    feature1_title TEXT,
    feature1_desc TEXT,
    feature2_title TEXT,
    feature2_desc TEXT,
    feature3_title TEXT,
    feature3_desc TEXT,
    feature4_title TEXT,
    feature4_desc TEXT,
    pricing_tag TEXT,
    pricing_title TEXT,
    pricing_subtitle TEXT,
    footer_copyright TEXT,
    footer_signup_url TEXT,
    footer_login_url TEXT,
    allow_free_trial BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Migração para tabela site_settings existente
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS allow_free_trial BOOLEAN DEFAULT true;
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS hero_badge_text TEXT;
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS hero_video_url TEXT;
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS hero_overlay_opacity INTEGER DEFAULT 75;
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS features_tabs JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS pricing_tag TEXT;
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS pricing_title TEXT;
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS pricing_subtitle TEXT;
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS footer_copyright TEXT;
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS footer_signup_url TEXT;
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS footer_login_url TEXT;

-- ==============================================================================
-- 9. MIGRAÇÃO: company_id para sincronização multi-dispositivo por empresa
-- ==============================================================================
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE public.notas_fiscais ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE public.contas_a_pagar ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE public.estoque ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE public.rh_funcionarios ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE public.gestao_frotas ADD COLUMN IF NOT EXISTS company_id TEXT;

-- Compatibilidade de colunas da tabela de assinantes (subscribers)
ALTER TABLE public.subscribers ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.subscribers ADD COLUMN IF NOT EXISTS document TEXT;
ALTER TABLE public.subscribers ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- ==============================================================================
-- 10. TABELA OFICIAL: public.assinantes (Painel Master Admin & Planos)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.assinantes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    plano_selecionado TEXT NOT NULL DEFAULT 'essencial',
    valor_mensal NUMERIC(15,2) NOT NULL DEFAULT 195.00,
    status TEXT NOT NULL DEFAULT 'trial',
    trial_ate TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 11. TRIGGER & FUNÇÃO: Sincronização Automática entre auth.users e assinantes
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
    v_nome TEXT;
    v_plano TEXT;
    v_valor NUMERIC;
BEGIN
    v_nome := COALESCE(
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'name',
        split_part(new.email, '@', 1)
    );
    v_plano := COALESCE(
        new.raw_user_meta_data->>'plano_selecionado',
        'essencial'
    );
    v_valor := CASE 
        WHEN v_plano = 'enterprise' THEN 495.00
        WHEN v_plano = 'pro' THEN 295.00
        ELSE 195.00
    END;

    INSERT INTO public.assinantes (
        id,
        nome,
        email,
        plano_selecionado,
        valor_mensal,
        status,
        trial_ate,
        criado_em
    ) VALUES (
        new.id,
        v_nome,
        new.email,
        v_plano,
        v_valor,
        'trial',
        now() + interval '7 days',
        now()
    )
    ON CONFLICT (email) DO UPDATE SET
        id = EXCLUDED.id,
        nome = COALESCE(EXCLUDED.nome, public.assinantes.nome),
        plano_selecionado = COALESCE(EXCLUDED.plano_selecionado, public.assinantes.plano_selecionado),
        valor_mensal = COALESCE(EXCLUDED.valor_mensal, public.assinantes.valor_mensal);

    -- Espelha também para a tabela subscribers (contingência)
    INSERT INTO public.subscribers (
        id,
        name,
        email,
        plan_name,
        status,
        trial_ends_at,
        created_at
    ) VALUES (
        new.id,
        v_nome,
        new.email,
        CASE WHEN v_plano = 'enterprise' THEN 'Agro Enterprise' WHEN v_plano = 'pro' THEN 'Frota Pro' ELSE 'Produtor Essencial' END,
        'Trial',
        now() + interval '7 days',
        now()
    )
    ON CONFLICT (email) DO UPDATE SET
        id = EXCLUDED.id,
        name = COALESCE(EXCLUDED.name, public.subscribers.name);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ==============================================================================
-- SINCRONIZAÇÃO / MIGRAÇÃO DE CONTAS EXISTENTES (auth.users -> public.assinantes)
-- Garante que todo usuário já cadastrado no Auth apareça no Painel Admin Mestre
-- ==============================================================================
INSERT INTO public.assinantes (
    id,
    nome,
    email,
    plano_selecionado,
    valor_mensal,
    status,
    trial_ate,
    criado_em
)
SELECT 
    u.id,
    COALESCE(
        u.raw_user_meta_data->>'full_name',
        u.raw_user_meta_data->>'name',
        split_part(u.email, '@', 1)
    ) as nome,
    u.email,
    COALESCE(u.raw_user_meta_data->>'plano_selecionado', 'essencial') as plano_selecionado,
    195.00 as valor_mensal,
    'trial' as status,
    now() + interval '7 days' as trial_ate,
    COALESCE(u.created_at, now()) as criado_em
FROM auth.users u
ON CONFLICT (email) DO UPDATE SET
    id = EXCLUDED.id,
    nome = COALESCE(EXCLUDED.nome, public.assinantes.nome),
    status = 'trial';

-- GARANTIA EXPLÍCITA: CLIENTE 'COLACA SILAGEM LTDA' (Status Trial, MRR R$ 0,00)
INSERT INTO public.assinantes (
    id,
    nome,
    email,
    plano_selecionado,
    valor_mensal,
    status,
    trial_ate,
    criado_em
) VALUES (
    'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
    'COLACA SILAGEM LTDA',
    'colacasilagem@gmail.com',
    'essencial',
    195.00,
    'trial',
    now() + interval '7 days',
    now()
)
ON CONFLICT (email) DO UPDATE SET
    nome = 'COLACA SILAGEM LTDA',
    status = 'trial';

-- Espelha também para public.subscribers
INSERT INTO public.subscribers (
    id,
    name,
    email,
    plan_name,
    status,
    trial_ends_at,
    created_at
) VALUES (
    'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
    'COLACA SILAGEM LTDA',
    'colacasilagem@gmail.com',
    'Produtor Essencial',
    'Trial',
    now() + interval '7 days',
    now()
)
ON CONFLICT (email) DO UPDATE SET
    name = 'COLACA SILAGEM LTDA',
    status = 'Trial';

-- ==============================================================================
-- 12. POLÍTICAS RLS E ACESSO PÚBLICO (ANON) PARA LANDING PAGE E PLANOS
-- ==============================================================================
ALTER TABLE public.assinantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Permissao Total Plans" ON public.plans;
    DROP POLICY IF EXISTS "Leitura Publica Plans" ON public.plans;
    CREATE POLICY "Permissao Total Plans" ON public.plans FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Permissao Total Site Settings" ON public.site_settings;
    DROP POLICY IF EXISTS "Leitura Publica Site Settings" ON public.site_settings;
    CREATE POLICY "Permissao Total Site Settings" ON public.site_settings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

    -- Assinantes (Tabela Oficial 'assinantes')
    DROP POLICY IF EXISTS "Permissao Total Assinantes" ON public.assinantes;
    CREATE POLICY "Permissao Total Assinantes" ON public.assinantes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

    -- Assinantes (Subscribers)
    DROP POLICY IF EXISTS "Permissao Total Subscribers" ON public.subscribers;
    DROP POLICY IF EXISTS "Permissao Insercao Anonima Subscribers" ON public.subscribers;
    DROP POLICY IF EXISTS "Permissao Leitura Master Subscribers" ON public.subscribers;

    -- Permite inserção anônima e autenticada de novos assinantes vindos da Landing Page
    CREATE POLICY "Permissao Insercao Anonima Subscribers" ON public.subscribers FOR INSERT TO anon, authenticated WITH CHECK (true);
    -- Permite leitura completa dos assinantes pelo Painel Master
    CREATE POLICY "Permissao Leitura Master Subscribers" ON public.subscribers FOR SELECT TO anon, authenticated USING (true);
    -- Permite atualização e manutenção completa
    CREATE POLICY "Permissao Total Subscribers" ON public.subscribers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
END $$;

-- ==============================================================================
-- PUBLICAÇÃO REALTIME (SUPABASE REALTIME)
-- Permite que alterações no banco sejam sincronizadas em tempo real nas 11 telas
-- ==============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE 
            public.fornecedores, 
            public.notas_fiscais, 
            public.contas_a_pagar, 
            public.estoque,
            public.clientes,
            public.rh_funcionarios,
            public.gestao_frotas,
            public.plans,
            public.site_settings,
            public.assinantes,
            public.subscribers;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;
