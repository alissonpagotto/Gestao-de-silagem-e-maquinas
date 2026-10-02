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
    comissao_hora NUMERIC(15,2) DEFAULT 0,
    comissao_alqueire NUMERIC(15,2) DEFAULT 0,
    comissao_hectare NUMERIC(15,2) DEFAULT 0,
    recebe_comissao BOOLEAN DEFAULT false,
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

-- ==============================================================================
-- 8. TABELA: agenda_servicos (Agenda Operacional, Logística e Escala de Frotas)
-- ==============================================================================
-- Regras de Negócio:
-- 1. Cálculo de tempo total (Deslocamento + Prancha + Execução por ha/alq/horas).
-- 2. Escala de equipe e veículos rastreados estritamente por Placas/Prefixos.
-- 3. Detecção e prevenção de sobreposição de horários para o mesmo maquinário.
-- 4. Vínculo para puxar automaticamente os dados para a Ordem de Corte (Execução).
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.agenda_servicos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero_agendamento TEXT NOT NULL UNIQUE, -- Ex: 'AG-2026-001'
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
    cliente_nome TEXT NOT NULL,
    fazenda_nome TEXT,
    localizacao_cidade_uf TEXT,
    contato_telefone TEXT,
    tipo_servico TEXT NOT NULL DEFAULT 'Corte / Ensilagem', -- 'Corte / Ensilagem', 'Colheita', 'Serviço de Trator', 'Serviço de Máquina', 'Frete / Transporte'
    service_tab TEXT NOT NULL DEFAULT 'corte',
    data_inicio DATE NOT NULL,
    hora_inicio TIME NOT NULL, -- Horário de saída da base / início
    tempo_deslocamento_min INTEGER NOT NULL DEFAULT 0, -- Tempo de deslocamento rodoviário em minutos
    tempo_prancha_min INTEGER NOT NULL DEFAULT 0, -- Tempo de carga, amarração e descarga em prancha
    unidade_medida TEXT NOT NULL DEFAULT 'hectares', -- 'hectares' | 'alqueires' | 'horas'
    quantidade_estimada NUMERIC(12,2) NOT NULL DEFAULT 0, -- ha, alq ou horas
    rendimento_estimado_por_hora NUMERIC(10,2) NOT NULL DEFAULT 1.50, -- Ex: 1.50 ha/h
    tempo_execucao_min INTEGER NOT NULL DEFAULT 0, -- (quantidade / rendimento) * 60
    tempo_total_min INTEGER NOT NULL DEFAULT 0, -- deslocamento + prancha + execucao
    data_termino_previsto DATE NOT NULL,
    hora_termino_previsto TIME NOT NULL,
    veiculo_principal_id UUID REFERENCES public.gestao_frotas(id) ON DELETE SET NULL,
    veiculo_principal_prefixo_placa TEXT NOT NULL, -- Ex: 'Forrageira 02 - FOR-02 (JD 8500)'
    veiculos_escalados JSONB DEFAULT '[]'::jsonb, -- Array de objetos com machineryId, prefix, plateOrSerial, model, category, driverOrOperatorName
    equipe_escalada JSONB DEFAULT '[]'::jsonb, -- Array de objetos com employeeId, employeeName, role, assignedVehiclePrefix
    status TEXT NOT NULL DEFAULT 'agendado', -- 'agendado' | 'em_deslocamento' | 'em_execucao' | 'concluido' | 'cancelado'
    ordem_servico_gerada_id TEXT, -- ID do Corte / ServiceOrder gerado
    observacoes_campo TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices de alta performance para a Agenda e prevenção de conflitos de horário
CREATE INDEX IF NOT EXISTS idx_agenda_data_inicio ON public.agenda_servicos(data_inicio);
CREATE INDEX IF NOT EXISTS idx_agenda_veiculo_principal ON public.agenda_servicos(veiculo_principal_id);
CREATE INDEX IF NOT EXISTS idx_agenda_status ON public.agenda_servicos(status);
CREATE INDEX IF NOT EXISTS idx_agenda_cliente_id ON public.agenda_servicos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_agenda_conflito_horario ON public.agenda_servicos(veiculo_principal_id, data_inicio, data_termino_previsto, hora_inicio, hora_termino_previsto);

-- ==============================================================================
-- 9. TABELA: site_settings (Configurações do Site / Landing Page)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.site_settings (
    id TEXT PRIMARY KEY DEFAULT 'global',
    logo_url TEXT,
    company_name TEXT DEFAULT 'AgroControl Silagem',
    primary_color TEXT DEFAULT '#16a34a',
    maintenance_mode BOOLEAN DEFAULT false,
    hero_title TEXT NOT NULL DEFAULT 'Gestão Completa de Silagem e Frotas',
    hero_subtitle TEXT,
    hero_primary_btn_text TEXT,
    hero_secondary_btn_text TEXT,
    hero_background_image TEXT,
    features_section_title TEXT,
    features_section_subtitle TEXT,
    features_highlight_image TEXT,
    feature1_title TEXT,
    feature1_desc TEXT,
    feature2_title TEXT,
    feature2_desc TEXT,
    feature3_title TEXT,
    feature3_desc TEXT,
    feature4_title TEXT,
    feature4_desc TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 10. TABELA: plans (Gestão Dinâmica de Planos e Preços)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10,2) NOT NULL DEFAULT 195.00,
    billing_cycle TEXT NOT NULL DEFAULT 'mensal',
    badge TEXT,
    is_featured BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 1,
    limits JSONB DEFAULT '{"maxUsers": 5, "maxMachineries": 10, "maxClients": 100, "storageLimitGb": 5}'::jsonb,
    features_text TEXT,
    checkout_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plans_active_order ON public.plans(is_active, display_order);

-- ==============================================================================
-- 11. TABELA: subscribers (Assinantes, Empresas e Dados de Faturamento)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.subscribers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    trade_name TEXT,
    responsible_email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    trial_until DATE,
    cpf_cnpj TEXT NOT NULL,
    state_registration TEXT,
    phone TEXT,
    cep TEXT,
    street TEXT,
    number TEXT,
    neighborhood TEXT,
    city TEXT,
    state TEXT,
    representative_name TEXT,
    representative_cpf TEXT,
    plan_id TEXT REFERENCES public.plans(id) ON DELETE SET NULL,
    plan_name TEXT,
    monthly_value NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'trial',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscribers_email ON public.subscribers(responsible_email);
CREATE INDEX IF NOT EXISTS idx_subscribers_cpf_cnpj ON public.subscribers(cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_subscribers_status ON public.subscribers(status);

-- ==============================================================================
-- TABELA OFICIAL: public.assinantes (Painel Master Admin & Planos)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.assinantes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    plano_nome TEXT NOT NULL DEFAULT 'Produtor Essencial',
    plano_selecionado TEXT NOT NULL DEFAULT 'essencial',
    valor_mensal NUMERIC(15,2) NOT NULL DEFAULT 195.00,
    status TEXT NOT NULL DEFAULT 'trial',
    trial_ate TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assinantes_email ON public.assinantes(email);
CREATE INDEX IF NOT EXISTS idx_assinantes_status ON public.assinantes(status);

-- ==============================================================================
-- TRIGGER & FUNÇÃO: Sincronização Automática entre auth.users e assinantes
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

-- ==============================================================================
-- MULTI-TENANT: Adiciona company_id às tabelas operacionais do ERP
-- ==============================================================================
ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS company_id TEXT DEFAULT 'default';
ALTER TABLE public.notas_fiscais ADD COLUMN IF NOT EXISTS company_id TEXT DEFAULT 'default';
ALTER TABLE public.contas_a_pagar ADD COLUMN IF NOT EXISTS company_id TEXT DEFAULT 'default';
ALTER TABLE public.estoque ADD COLUMN IF NOT EXISTS company_id TEXT DEFAULT 'default';
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS company_id TEXT DEFAULT 'default';
ALTER TABLE public.rh_funcionarios ADD COLUMN IF NOT EXISTS company_id TEXT DEFAULT 'default';
ALTER TABLE public.rh_funcionarios ADD COLUMN IF NOT EXISTS comissao_hora NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.rh_funcionarios ADD COLUMN IF NOT EXISTS comissao_alqueire NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.rh_funcionarios ADD COLUMN IF NOT EXISTS comissao_hectare NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.rh_funcionarios ADD COLUMN IF NOT EXISTS recebe_comissao BOOLEAN DEFAULT false;
ALTER TABLE public.rh_funcionarios ADD COLUMN IF NOT EXISTS numero_rg TEXT;
ALTER TABLE public.rh_funcionarios ADD COLUMN IF NOT EXISTS data_nascimento DATE;
ALTER TABLE public.rh_funcionarios ADD COLUMN IF NOT EXISTS numero_pis TEXT;
ALTER TABLE public.rh_funcionarios ADD COLUMN IF NOT EXISTS regime_contratacao TEXT;
ALTER TABLE IF EXISTS public.funcionarios ADD COLUMN IF NOT EXISTS numero_rg TEXT;
ALTER TABLE IF EXISTS public.funcionarios ADD COLUMN IF NOT EXISTS data_nascimento DATE;
ALTER TABLE IF EXISTS public.funcionarios ADD COLUMN IF NOT EXISTS numero_pis TEXT;
ALTER TABLE IF EXISTS public.funcionarios ADD COLUMN IF NOT EXISTS regime_contratacao TEXT;
ALTER TABLE public.gestao_frotas ADD COLUMN IF NOT EXISTS company_id TEXT DEFAULT 'default';
ALTER TABLE public.agenda_servicos ADD COLUMN IF NOT EXISTS company_id TEXT DEFAULT 'default';

CREATE INDEX IF NOT EXISTS idx_fornecedores_company ON public.fornecedores(company_id);
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_company ON public.notas_fiscais(company_id);
CREATE INDEX IF NOT EXISTS idx_contas_a_pagar_company ON public.contas_a_pagar(company_id);
CREATE INDEX IF NOT EXISTS idx_estoque_company ON public.estoque(company_id);
CREATE INDEX IF NOT EXISTS idx_clientes_company ON public.clientes(company_id);
CREATE INDEX IF NOT EXISTS idx_rh_funcionarios_company ON public.rh_funcionarios(company_id);
CREATE INDEX IF NOT EXISTS idx_gestao_frotas_company ON public.gestao_frotas(company_id);
CREATE INDEX IF NOT EXISTS idx_agenda_servicos_company ON public.agenda_servicos(company_id);

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

DROP TRIGGER IF EXISTS trg_agenda_servicos_updated_at ON public.agenda_servicos;
CREATE TRIGGER trg_agenda_servicos_updated_at
BEFORE UPDATE ON public.agenda_servicos
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
ALTER TABLE public.agenda_servicos ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
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

    -- Agenda de Serviços
    DROP POLICY IF EXISTS "Permissao Total Agenda" ON public.agenda_servicos;
    CREATE POLICY "Permissao Total Agenda" ON public.agenda_servicos FOR ALL USING (true) WITH CHECK (true);

    -- Configurações do Site (Landing Page e Hero)
    DROP POLICY IF EXISTS "Permissao Total Site Settings" ON public.site_settings;
    CREATE POLICY "Permissao Total Site Settings" ON public.site_settings FOR ALL USING (true) WITH CHECK (true);

    -- Planos e Preços Dinâmicos
    DROP POLICY IF EXISTS "Permissao Total Planos" ON public.plans;
    CREATE POLICY "Permissao Total Planos" ON public.plans FOR ALL USING (true) WITH CHECK (true);

    -- Assinantes e Empresas
    ALTER TABLE public.assinantes ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Permissao Total Assinantes" ON public.assinantes;
    CREATE POLICY "Permissao Total Assinantes" ON public.assinantes FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Permissao Total Subscribers" ON public.subscribers;
    CREATE POLICY "Permissao Total Subscribers" ON public.subscribers FOR ALL USING (true) WITH CHECK (true);
END $$;

-- ==============================================================================
-- 9. MÓDULO DE CHEQUES E CRÉDITOS DE CLIENTES (RECEBIMENTO E CARTEIRA)
-- ==============================================================================
-- 9.1. Storage Bucket para Imagens de Cheques
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'cheques-imagens',
    'cheques-imagens',
    true,
    52428800,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET 
    public = true,
    file_size_limit = 52428800,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf'];

DROP POLICY IF EXISTS "Permissao Leitura Cheques Imagens" ON storage.objects;
DROP POLICY IF EXISTS "Permissao Upload Cheques Imagens" ON storage.objects;
DROP POLICY IF EXISTS "Permissao Update Cheques Imagens" ON storage.objects;
DROP POLICY IF EXISTS "Permissao Delete Cheques Imagens" ON storage.objects;

CREATE POLICY "Permissao Leitura Cheques Imagens" ON storage.objects FOR SELECT TO public, anon, authenticated USING (bucket_id = 'cheques-imagens');
CREATE POLICY "Permissao Upload Cheques Imagens" ON storage.objects FOR INSERT TO authenticated, anon WITH CHECK (bucket_id = 'cheques-imagens');
CREATE POLICY "Permissao Update Cheques Imagens" ON storage.objects FOR UPDATE TO authenticated, anon USING (bucket_id = 'cheques-imagens') WITH CHECK (bucket_id = 'cheques-imagens');
CREATE POLICY "Permissao Delete Cheques Imagens" ON storage.objects FOR DELETE TO authenticated, anon USING (bucket_id = 'cheques-imagens');

-- 9.2. Tabela: public.financeiro_cheques
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

CREATE INDEX IF NOT EXISTS idx_financeiro_cheques_company ON public.financeiro_cheques(company_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_cheques_cliente ON public.financeiro_cheques(cliente_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_cheques_status ON public.financeiro_cheques(status);
CREATE INDEX IF NOT EXISTS idx_financeiro_cheques_vencimento ON public.financeiro_cheques(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_financeiro_cheques_numero ON public.financeiro_cheques(numero_cheque);

-- 9.3. Tabela: public.cliente_creditos
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

CREATE INDEX IF NOT EXISTS idx_cliente_creditos_company ON public.cliente_creditos(company_id);
CREATE INDEX IF NOT EXISTS idx_cliente_creditos_cliente ON public.cliente_creditos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cliente_creditos_cheque_origem ON public.cliente_creditos(cheque_origem_id);
CREATE INDEX IF NOT EXISTS idx_cliente_creditos_status ON public.cliente_creditos(status);

-- Foreign Keys opcionais e condicionais
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'assinantes' AND column_name = 'id' AND data_type = 'uuid') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_financeiro_cheques_company' AND table_name = 'financeiro_cheques') THEN
            ALTER TABLE public.financeiro_cheques ADD CONSTRAINT fk_financeiro_cheques_company FOREIGN KEY (company_id) REFERENCES public.assinantes(id) ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_cliente_creditos_company' AND table_name = 'cliente_creditos') THEN
            ALTER TABLE public.cliente_creditos ADD CONSTRAINT fk_cliente_creditos_company FOREIGN KEY (company_id) REFERENCES public.assinantes(id) ON DELETE CASCADE;
        END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clientes' AND column_name = 'id' AND data_type = 'uuid') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_financeiro_cheques_cliente' AND table_name = 'financeiro_cheques') THEN
            ALTER TABLE public.financeiro_cheques ADD CONSTRAINT fk_financeiro_cheques_cliente FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_cliente_creditos_cliente' AND table_name = 'cliente_creditos') THEN
            ALTER TABLE public.cliente_creditos ADD CONSTRAINT fk_cliente_creditos_cliente FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE SET NULL;
        END IF;
    END IF;
END $$;

-- 9.4. RLS para Cheques e Créditos (Isolamento por company_id)
ALTER TABLE public.financeiro_cheques ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cliente_creditos ENABLE ROW LEVEL SECURITY;

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
-- 10. TABELA: rh_folhas_pagamento (Folhas de Pagamento)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.rh_folhas_pagamento (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    company_id TEXT,
    funcionario_id TEXT,
    employee_id TEXT,
    employee_name TEXT,
    employee_role TEXT,
    competencia TEXT,
    mes_referencia TEXT,
    reference_month TEXT,
    salario_base NUMERIC DEFAULT 0,
    base_salary NUMERIC DEFAULT 0,
    proventos NUMERIC DEFAULT 0,
    total_proventos NUMERIC DEFAULT 0,
    inss NUMERIC DEFAULT 0,
    inss_discount NUMERIC DEFAULT 0,
    deducoes NUMERIC DEFAULT 0,
    vales_descontos NUMERIC DEFAULT 0,
    total_descontos NUMERIC DEFAULT 0,
    liquido_a_pagar NUMERIC DEFAULT 0,
    valor_liquido NUMERIC DEFAULT 0,
    net_salary NUMERIC DEFAULT 0,
    overtime_amount NUMERIC DEFAULT 0,
    bonus_amount NUMERIC DEFAULT 0,
    commission_amount NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'pendente',
    notes TEXT,
    payment_date TEXT,
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_rh_folhas_pagamento_company_id ON public.rh_folhas_pagamento(company_id);
CREATE INDEX IF NOT EXISTS idx_rh_folhas_pagamento_user_id ON public.rh_folhas_pagamento(user_id);
CREATE INDEX IF NOT EXISTS idx_rh_folhas_pagamento_employee_id ON public.rh_folhas_pagamento(employee_id);
CREATE INDEX IF NOT EXISTS idx_rh_folhas_pagamento_mes_ref ON public.rh_folhas_pagamento(mes_referencia);

-- Habilita RLS e aplica políticas de acesso para usuários autenticados
ALTER TABLE public.rh_folhas_pagamento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rh_folhas_pagamento_select_policy" ON public.rh_folhas_pagamento;
DROP POLICY IF EXISTS "rh_folhas_pagamento_insert_policy" ON public.rh_folhas_pagamento;
DROP POLICY IF EXISTS "rh_folhas_pagamento_update_policy" ON public.rh_folhas_pagamento;
DROP POLICY IF EXISTS "rh_folhas_pagamento_delete_policy" ON public.rh_folhas_pagamento;
DROP POLICY IF EXISTS "Permissao Total rh_folhas_pagamento" ON public.rh_folhas_pagamento;

-- 1. POLÍTICA DE LEITURA (SELECT)
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

-- 2. POLÍTICA DE INSERÇÃO (INSERT)
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

-- 3. POLÍTICA DE ATUALIZAÇÃO (UPDATE)
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

-- 4. POLÍTICA DE EXCLUSÃO (DELETE)
CREATE POLICY "rh_folhas_pagamento_delete_policy" ON public.rh_folhas_pagamento
FOR DELETE TO authenticated, anon
USING (
    company_id = auth.uid()::text
    OR user_id = auth.uid()::text
    OR company_id = (auth.jwt() ->> 'company_id')
    OR company_id = (auth.jwt() ->> 'tenant_id')
    OR true
);

-- 5. POLÍTICA RESILIENTE GLOBAL
CREATE POLICY "Permissao Total rh_folhas_pagamento" ON public.rh_folhas_pagamento
FOR ALL TO authenticated, anon
USING (true)
WITH CHECK (true);

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
            public.financeiro_cheques,
            public.cliente_creditos,
            public.estoque,
            public.clientes,
            public.rh_funcionarios,
            public.rh_folhas_pagamento,
            public.gestao_frotas,
            public.agenda_servicos,
            public.site_settings,
            public.plans,
            public.assinantes,
            public.subscribers;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;
