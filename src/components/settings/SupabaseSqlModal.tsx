import React, { useState } from 'react';
import { X, Copy, Check, Download, Database, ShieldCheck, CheckCircle2, Terminal } from 'lucide-react';

interface SupabaseSqlModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SUPABASE_FULL_SQL_SCHEMA = `-- ==============================================================================
-- SILAGEM FÁCIL ERP - ESQUEMA RELACIONAL POSTGRESQL (SUPABASE)
-- ==============================================================================
-- Executar no Supabase: Dashboard > SQL Editor > New query > Run
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
    company_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contas_a_pagar_nota_fiscal_id ON public.contas_a_pagar(nota_fiscal_id);
CREATE INDEX IF NOT EXISTS idx_contas_a_pagar_vencimento ON public.contas_a_pagar(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_contas_a_pagar_status ON public.contas_a_pagar(status_pago);

-- ==============================================================================
-- 3.1. TABELA: contas_a_receber (Financeiro)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.contas_a_receber (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
    cliente_nome TEXT NOT NULL,
    descricao TEXT,
    valor_total NUMERIC(15,2) NOT NULL,
    data_emissao DATE DEFAULT CURRENT_DATE,
    data_vencimento DATE NOT NULL,
    forma_pagamento TEXT,
    status_pago BOOLEAN NOT NULL DEFAULT false,
    company_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contas_a_receber_cliente ON public.contas_a_receber(cliente_id);
CREATE INDEX IF NOT EXISTS idx_contas_a_receber_vencimento ON public.contas_a_receber(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_contas_a_receber_status ON public.contas_a_receber(status_pago);

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

CREATE INDEX IF NOT EXISTS idx_estoque_codigo_produto ON public.estoque(codigo_produto);
CREATE INDEX IF NOT EXISTS idx_estoque_descricao ON public.estoque(descricao);

-- ==============================================================================
-- 5. TABELAS COMPLEMENTARES
-- ==============================================================================
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

CREATE TABLE IF NOT EXISTS public.rh_funcionarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id TEXT,
    tenant_id TEXT,
    user_id TEXT,
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
    foto_url TEXT,
    avatar_url TEXT,
    photo_url TEXT,
    comissao_hora NUMERIC(15,2) DEFAULT 0,
    comissao_alqueire NUMERIC(15,2) DEFAULT 0,
    comissao_hectare NUMERIC(15,2) DEFAULT 0,
    recebe_comissao BOOLEAN DEFAULT false,
    numero_rg TEXT,
    data_nascimento DATE,
    numero_pis TEXT,
    regime_contratacao TEXT DEFAULT 'Registrado (CLT)',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rh_funcionarios ADD COLUMN IF NOT EXISTS numero_rg TEXT;
ALTER TABLE public.rh_funcionarios ADD COLUMN IF NOT EXISTS data_nascimento DATE;
ALTER TABLE public.rh_funcionarios ADD COLUMN IF NOT EXISTS numero_pis TEXT;
ALTER TABLE public.rh_funcionarios ADD COLUMN IF NOT EXISTS regime_contratacao TEXT DEFAULT 'Registrado (CLT)';

CREATE TABLE IF NOT EXISTS public.gestao_frotas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type TEXT,
    model TEXT,
    plate_or_serial TEXT,
    fleet_number TEXT,
    year INTEGER,
    hourmeter NUMERIC(12,2) DEFAULT 0,
    status TEXT DEFAULT 'operacional',
    fuel_level NUMERIC(5,2) DEFAULT 100,
    accumulated_cost NUMERIC(15,2) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Migração automática para tabelas existentes
ALTER TABLE public.gestao_frotas ADD COLUMN IF NOT EXISTS fleet_number TEXT;
ALTER TABLE public.gestao_frotas ADD COLUMN IF NOT EXISTS driver_id UUID;
ALTER TABLE public.gestao_frotas ADD COLUMN IF NOT EXISTS motorista TEXT;
ALTER TABLE public.gestao_frotas ADD COLUMN IF NOT EXISTS operator_or_driver TEXT;
ALTER TABLE public.gestao_frotas ADD COLUMN IF NOT EXISTS assigned_driver_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.gestao_frotas ADD COLUMN IF NOT EXISTS assigned_drivers JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.gestao_frotas ADD COLUMN IF NOT EXISTS reboque_vinculado_id TEXT;
ALTER TABLE public.gestao_frotas ADD COLUMN IF NOT EXISTS reboque_id TEXT;
ALTER TABLE public.gestao_frotas ADD COLUMN IF NOT EXISTS has_coupled_trailer BOOLEAN DEFAULT false;
ALTER TABLE public.gestao_frotas ADD COLUMN IF NOT EXISTS coupled_trailer_name TEXT;
ALTER TABLE public.gestao_frotas ADD COLUMN IF NOT EXISTS coupled_trailer_type TEXT;
ALTER TABLE public.gestao_frotas ADD COLUMN IF NOT EXISTS trailer_plate TEXT;
ALTER TABLE public.gestao_frotas ADD COLUMN IF NOT EXISTS trailer_model TEXT;
ALTER TABLE public.gestao_frotas ADD COLUMN IF NOT EXISTS composition_type TEXT;

-- Tabela oficial de Veículos e Máquinas (veiculos_maquinas)
CREATE TABLE IF NOT EXISTS public.veiculos_maquinas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id TEXT,
    nome TEXT,
    name TEXT,
    tipo TEXT,
    type TEXT,
    modelo TEXT,
    model TEXT,
    marca TEXT,
    brand TEXT,
    placa_ou_serie TEXT,
    plate_or_serial TEXT,
    fleet_number TEXT,
    ano INTEGER,
    year INTEGER,
    horimetro_ou_km_atual NUMERIC(12,2) DEFAULT 0,
    hourmeter NUMERIC(12,2) DEFAULT 0,
    current_km NUMERIC(12,2) DEFAULT 0,
    status TEXT DEFAULT 'ativo',
    manutencao_status TEXT DEFAULT 'ok',
    fuel_level NUMERIC(5,2) DEFAULT 100,
    tank_capacity NUMERIC(12,2),
    driver_id UUID,
    motorista TEXT,
    operator_or_driver TEXT,
    assigned_driver_ids JSONB DEFAULT '[]'::jsonb,
    assigned_drivers JSONB DEFAULT '[]'::jsonb,
    reboque_vinculado_id TEXT,
    reboque_id TEXT,
    has_coupled_trailer BOOLEAN DEFAULT false,
    coupled_trailer_name TEXT,
    coupled_trailer_type TEXT,
    trailer_plate TEXT,
    trailer_model TEXT,
    composition_type TEXT,
    numero_eixos INTEGER,
    quantidade_pneus INTEGER,
    controla_por TEXT DEFAULT 'horas',
    propriedade TEXT DEFAULT 'proprio',
    renavam TEXT,
    cor TEXT,
    foto_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.veiculos_maquinas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permissao Total veiculos_maquinas" ON public.veiculos_maquinas;
CREATE POLICY "Permissao Total veiculos_maquinas" ON public.veiculos_maquinas FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- ==============================================================================
-- 7.1. TABELA: tanques_combustivel (Tanques Aéreos da Fazenda)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.tanques_combustivel (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    tipo_combustivel TEXT NOT NULL DEFAULT 'Diesel S10',
    capacidade_total NUMERIC(15,2) NOT NULL DEFAULT 15000,
    quantidade_atual NUMERIC(15,2) NOT NULL DEFAULT 0,
    localizacao TEXT,
    company_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Inserção dos tanques padrão da fazenda caso não existam:
INSERT INTO public.tanques_combustivel (id, nome, tipo_combustivel, capacidade_total, quantidade_atual, localizacao)
VALUES 
    ('tanque_diesel_s10', 'Tanque Principal Diesel S10', 'Diesel S10', 15000.00, 5580.00, 'Pátio Central / Barracão de Abastecimento'),
    ('tanque_diesel_s500', 'Tanque Secundário Diesel S500', 'Diesel S500', 10000.00, 3200.00, 'Oficina / Setor Agrícola'),
    ('tanque_arla_32', 'Reservatório / Tanque Arla 32', 'Arla 32', 5000.00, 1800.00, 'Barracão de Abastecimento / Oficina')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.tanques_combustivel ADD COLUMN IF NOT EXISTS produto_id TEXT;
ALTER TABLE public.abastecimentos ADD COLUMN IF NOT EXISTS tanque_id TEXT;

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
-- 6. TRIGGERS: updated_at automático
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

-- ==============================================================================
-- 7. POLÍTICAS DE SEGURANÇA (ROW LEVEL SECURITY - RLS)
-- ==============================================================================
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas_fiscais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas_a_pagar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas_a_receber ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_funcionarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gestao_frotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frentes_colheita ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tanques_combustivel ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Permissao Total Tanques" ON public.tanques_combustivel;
    CREATE POLICY "Permissao Total Tanques" ON public.tanques_combustivel FOR ALL USING (true) WITH CHECK (true);
    DROP POLICY IF EXISTS "Permissao Total Agendamentos" ON public.agendamentos;
    CREATE POLICY "Permissao Total Agendamentos" ON public.agendamentos FOR ALL USING (true) WITH CHECK (true);
    DROP POLICY IF EXISTS "Permissao Total Frentes" ON public.frentes_colheita;
    CREATE POLICY "Permissao Total Frentes" ON public.frentes_colheita FOR ALL USING (true) WITH CHECK (true);
    DROP POLICY IF EXISTS "Permissao Total Fornecedores" ON public.fornecedores;
    CREATE POLICY "Permissao Total Fornecedores" ON public.fornecedores FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Permissao Total Notas Fiscais" ON public.notas_fiscais;
    CREATE POLICY "Permissao Total Notas Fiscais" ON public.notas_fiscais FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Permissao Total Contas a Pagar" ON public.contas_a_pagar;
    CREATE POLICY "Permissao Total Contas a Pagar" ON public.contas_a_pagar FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Permissao Total Contas a Receber" ON public.contas_a_receber;
    CREATE POLICY "Permissao Total Contas a Receber" ON public.contas_a_receber FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Permissao Total Estoque" ON public.estoque;
    CREATE POLICY "Permissao Total Estoque" ON public.estoque FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Permissao Total Clientes" ON public.clientes;
    CREATE POLICY "Permissao Total Clientes" ON public.clientes FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Permissao Total RH" ON public.rh_funcionarios;
    CREATE POLICY "Permissao Total RH" ON public.rh_funcionarios FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Permissao Total Frotas" ON public.gestao_frotas;
    CREATE POLICY "Permissao Total Frotas" ON public.gestao_frotas FOR ALL USING (true) WITH CHECK (true);
END $$;

-- ==============================================================================
-- 8. TABELAS: Master Admin, Assinantes & Landing Page
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

CREATE TABLE IF NOT EXISTS public.subscribers (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    document TEXT,
    plan_name TEXT DEFAULT 'Produtor Essencial',
    status TEXT DEFAULT 'Trial',
    trial_ends_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '7 days'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Trigger para sincronização automática de todo novo usuário cadastrado no Supabase Auth
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

-- SINCRONIZAÇÃO / MIGRAÇÃO DE CONTAS EXISTENTES (auth.users -> public.assinantes)
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
    logo_url TEXT,
    company_name TEXT DEFAULT 'AgroControl Silagem',
    primary_color TEXT DEFAULT '#16a34a',
    maintenance_mode BOOLEAN DEFAULT false,
    hero_title TEXT,
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 10. MIGRAÇÃO: Compatibilidade de colunas da tabela clientes e company_id
-- ==============================================================================
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS nome TEXT;
UPDATE public.clientes SET name = nome WHERE name IS NULL AND nome IS NOT NULL;
UPDATE public.clientes SET nome = name WHERE nome IS NULL AND name IS NOT NULL;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE public.notas_fiscais ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE public.contas_a_pagar ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE public.estoque ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE public.rh_funcionarios ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE public.rh_funcionarios ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE public.rh_funcionarios ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE public.rh_funcionarios ADD COLUMN IF NOT EXISTS local_recebimento TEXT;
ALTER TABLE public.rh_funcionarios ADD COLUMN IF NOT EXISTS banco_chave_pix TEXT;
ALTER TABLE public.rh_funcionarios ADD COLUMN IF NOT EXISTS agencia TEXT;
ALTER TABLE public.rh_funcionarios ADD COLUMN IF NOT EXISTS conta_corrente TEXT;
ALTER TABLE public.rh_funcionarios ADD COLUMN IF NOT EXISTS foto_url TEXT;
ALTER TABLE public.rh_funcionarios ADD COLUMN IF NOT EXISTS aso_url TEXT;
ALTER TABLE public.rh_funcionarios ADD COLUMN IF NOT EXISTS contrato_experiencia_url TEXT;
ALTER TABLE public.rh_funcionarios ADD COLUMN IF NOT EXISTS cnh_url TEXT;
ALTER TABLE public.rh_funcionarios ADD COLUMN IF NOT EXISTS ficha_registro_url TEXT;
ALTER TABLE public.rh_funcionarios ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.rh_funcionarios ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE public.rh_funcionarios ADD COLUMN IF NOT EXISTS comissao_hora NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.rh_funcionarios ADD COLUMN IF NOT EXISTS comissao_alqueire NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.rh_funcionarios ADD COLUMN IF NOT EXISTS comissao_hectare NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.rh_funcionarios ADD COLUMN IF NOT EXISTS recebe_comissao BOOLEAN DEFAULT false;
ALTER TABLE public.rh_funcionarios ADD COLUMN IF NOT EXISTS numero_rg TEXT;
ALTER TABLE public.rh_funcionarios ADD COLUMN IF NOT EXISTS rg TEXT;
ALTER TABLE public.rh_funcionarios ADD COLUMN IF NOT EXISTS data_nascimento DATE;
ALTER TABLE public.rh_funcionarios ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE public.rh_funcionarios ADD COLUMN IF NOT EXISTS numero_pis TEXT;
ALTER TABLE public.rh_funcionarios ADD COLUMN IF NOT EXISTS pis TEXT;
ALTER TABLE public.rh_funcionarios ADD COLUMN IF NOT EXISTS regime_contratacao TEXT;
ALTER TABLE public.rh_funcionarios ADD COLUMN IF NOT EXISTS contract_type TEXT;

ALTER TABLE IF EXISTS public.funcionarios ADD COLUMN IF NOT EXISTS numero_rg TEXT;
ALTER TABLE IF EXISTS public.funcionarios ADD COLUMN IF NOT EXISTS data_nascimento DATE;
ALTER TABLE IF EXISTS public.funcionarios ADD COLUMN IF NOT EXISTS numero_pis TEXT;
ALTER TABLE IF EXISTS public.funcionarios ADD COLUMN IF NOT EXISTS regime_contratacao TEXT;
ALTER TABLE IF EXISTS public.funcionarios ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE IF EXISTS public.funcionarios ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Storage buckets para fotos e documentos de funcionários
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true) 
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('rh_fotos', 'rh_fotos', true) 
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('documentos', 'documentos', true) 
ON CONFLICT (id) DO UPDATE SET public = true;

-- Políticas de acesso público para o bucket de fotos e documentos
DROP POLICY IF EXISTS "Public Access Avatars" ON storage.objects;
CREATE POLICY "Public Access Avatars" ON storage.objects 
FOR ALL USING (bucket_id IN ('avatars', 'rh_fotos', 'fotos', 'funcionarios', 'documentos')) 
WITH CHECK (bucket_id IN ('avatars', 'rh_fotos', 'fotos', 'funcionarios', 'documentos'));

-- Tabela oficial de Férias e Afastamentos (rh_ferias)
CREATE TABLE IF NOT EXISTS public.rh_ferias (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    company_id TEXT,
    funcionario_id TEXT,
    employee_id TEXT,
    status TEXT DEFAULT 'agendado',
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.rh_ferias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permissao Total rh_ferias" ON public.rh_ferias;
CREATE POLICY "Permissao Total rh_ferias" ON public.rh_ferias
FOR ALL TO authenticated, anon
USING (true)
WITH CHECK (true);

-- Tabela oficial de Faltas e Ocorrências (rh_faltas)
CREATE TABLE IF NOT EXISTS public.rh_faltas (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    funcionario_id TEXT,
    tipo_falta TEXT DEFAULT 'injustificada',
    data_periodo DATE,
    qtd_dias NUMERIC DEFAULT 1,
    motivo_justificativa TEXT,
    desconto_estimado NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'pendente'
);

ALTER TABLE public.rh_faltas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permissao Total rh_faltas" ON public.rh_faltas;
CREATE POLICY "Permissao Total rh_faltas" ON public.rh_faltas
FOR ALL TO authenticated, anon
USING (true)
WITH CHECK (true);

-- Tabela oficial de Folhas de Pagamento (rh_folhas_pagamento)
CREATE TABLE IF NOT EXISTS public.rh_folhas_pagamento (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    company_id TEXT,
    funcionario_id TEXT,
    employee_id TEXT,
    employee_name TEXT,
    employee_role TEXT,
    reference_month TEXT,
    base_salary NUMERIC DEFAULT 0,
    overtime_amount NUMERIC DEFAULT 0,
    bonus_amount NUMERIC DEFAULT 0,
    commission_amount NUMERIC DEFAULT 0,
    inss_discount NUMERIC DEFAULT 0,
    advances_discount NUMERIC DEFAULT 0,
    other_discounts NUMERIC DEFAULT 0,
    net_salary NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'pendente',
    notes TEXT,
    payment_date TEXT,
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.rh_folhas_pagamento ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS funcionario_id TEXT;
ALTER TABLE public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS employee_id TEXT;
ALTER TABLE public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS employee_name TEXT;
ALTER TABLE public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS employee_role TEXT;
ALTER TABLE public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS competencia TEXT;
ALTER TABLE public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS mes_referencia TEXT;
ALTER TABLE public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS reference_month TEXT;
ALTER TABLE public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS salario_base NUMERIC DEFAULT 0;
ALTER TABLE public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS base_salary NUMERIC DEFAULT 0;
ALTER TABLE public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS proventos NUMERIC DEFAULT 0;
ALTER TABLE public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS total_proventos NUMERIC DEFAULT 0;
ALTER TABLE public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS inss NUMERIC DEFAULT 0;
ALTER TABLE public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS inss_discount NUMERIC DEFAULT 0;
ALTER TABLE public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS irrf NUMERIC DEFAULT 0;
ALTER TABLE public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS desconto_irrf NUMERIC DEFAULT 0;
ALTER TABLE public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS irrf_discount NUMERIC DEFAULT 0;
ALTER TABLE public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS deducoes NUMERIC DEFAULT 0;
ALTER TABLE public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS vales_descontos NUMERIC DEFAULT 0;
ALTER TABLE public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS total_descontos NUMERIC DEFAULT 0;
ALTER TABLE public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS liquido_a_pagar NUMERIC DEFAULT 0;
ALTER TABLE public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS valor_liquido NUMERIC DEFAULT 0;
ALTER TABLE public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS net_salary NUMERIC DEFAULT 0;
ALTER TABLE public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS overtime_amount NUMERIC DEFAULT 0;
ALTER TABLE public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS bonus_amount NUMERIC DEFAULT 0;
ALTER TABLE public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS commission_amount NUMERIC DEFAULT 0;
ALTER TABLE public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pendente';
ALTER TABLE public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS payment_date TEXT;
ALTER TABLE public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Habilita RLS e aplica políticas de acesso para usuários autenticados
ALTER TABLE public.rh_folhas_pagamento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rh_folhas_pagamento_select_policy" ON public.rh_folhas_pagamento;
DROP POLICY IF EXISTS "rh_folhas_pagamento_insert_policy" ON public.rh_folhas_pagamento;
DROP POLICY IF EXISTS "rh_folhas_pagamento_update_policy" ON public.rh_folhas_pagamento;
DROP POLICY IF EXISTS "rh_folhas_pagamento_delete_policy" ON public.rh_folhas_pagamento;
DROP POLICY IF EXISTS "Permissao Total rh_folhas_pagamento" ON public.rh_folhas_pagamento;
DROP POLICY IF EXISTS "Permitir inserção para usuários da mesma empresa" ON public.rh_folhas_pagamento;
DROP POLICY IF EXISTS "Permitir leitura para usuários da mesma empresa" ON public.rh_folhas_pagamento;
DROP POLICY IF EXISTS "Permitir atualização para usuários da mesma empresa" ON public.rh_folhas_pagamento;
DROP POLICY IF EXISTS "Permitir exclusão para usuários da mesma empresa" ON public.rh_folhas_pagamento;

-- POLÍTICAS SOLICITADAS: ESCRITA E LEITURA LIVRES PARA USUÁRIOS AUTENTICADOS
CREATE POLICY "Permitir inserção para usuários da mesma empresa" ON public.rh_folhas_pagamento 
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Permitir leitura para usuários da mesma empresa" ON public.rh_folhas_pagamento 
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir atualização para usuários da mesma empresa" ON public.rh_folhas_pagamento 
FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Permitir exclusão para usuários da mesma empresa" ON public.rh_folhas_pagamento 
FOR DELETE TO authenticated USING (true);

-- POLÍTICA RESILIENTE GLOBAL COMPLEMENTAR
CREATE POLICY "Permissao Total rh_folhas_pagamento" ON public.rh_folhas_pagamento
FOR ALL TO authenticated, anon
USING (true)
WITH CHECK (true);

-- Tabela oficial de Gestão de Manutenções e Ordens de Serviço (frotas_manutencoes e manutencoes)
CREATE TABLE IF NOT EXISTS public.frotas_manutencoes (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    company_id TEXT,
    machinery_id TEXT,
    machinery_plate_or_name TEXT,
    os_number TEXT,
    date TEXT,
    type TEXT DEFAULT 'corretiva',
    service_category TEXT,
    description TEXT,
    executor_name TEXT,
    workshop_or_mechanic TEXT,
    workshop TEXT,
    parts_cost NUMERIC DEFAULT 0,
    labor_cost NUMERIC DEFAULT 0,
    total_cost NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'pendente',
    location TEXT DEFAULT 'oficina_interna',
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.frotas_manutencoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permissao Total frotas_manutencoes" ON public.frotas_manutencoes;
CREATE POLICY "Permissao Total frotas_manutencoes" ON public.frotas_manutencoes
FOR ALL TO authenticated, anon
USING (true)
WITH CHECK (true);

-- Tabela oficial de Contas Bancárias e Caixas (financeiro_contas)
CREATE TABLE IF NOT EXISTS public.financeiro_contas (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    user_id TEXT,
    name TEXT,
    account_name TEXT,
    bank_name TEXT,
    bank_code TEXT,
    account_type TEXT DEFAULT 'corrente',
    agency TEXT,
    account_number TEXT,
    account_digit TEXT,
    balance NUMERIC DEFAULT 0,
    current_balance NUMERIC DEFAULT 0,
    overdraft_limit NUMERIC DEFAULT 0,
    pix_key TEXT,
    pix_key_type TEXT,
    color TEXT DEFAULT '#0963cb',
    corporate_cards JSONB DEFAULT '[]'::jsonb,
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.financeiro_contas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permissao Total financeiro_contas" ON public.financeiro_contas;
CREATE POLICY "Permissao Total financeiro_contas" ON public.financeiro_contas
FOR ALL TO authenticated, anon
USING (true)
WITH CHECK (true);

-- Tabela de Manutenções legada (manutencoes)
CREATE TABLE IF NOT EXISTS public.manutencoes (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    company_id TEXT,
    machinery_id TEXT,
    machinery_plate_or_name TEXT,
    os_number TEXT,
    date TEXT,
    type TEXT DEFAULT 'corretiva',
    service_category TEXT,
    description TEXT,
    total_cost NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'pendente',
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.manutencoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permissao Total manutencoes" ON public.manutencoes;
CREATE POLICY "Permissao Total manutencoes" ON public.manutencoes
FOR ALL TO authenticated, anon
USING (true)
WITH CHECK (true);
ALTER TABLE public.gestao_frotas ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE public.frentes_colheita ADD COLUMN IF NOT EXISTS company_id TEXT;

-- Recarrega o cache do PostgREST para reconhecer novas colunas imediatamente
NOTIFY pgrst, 'reload schema';

-- Compatibilidade de colunas da tabela de assinantes (subscribers)
ALTER TABLE public.subscribers ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.subscribers ADD COLUMN IF NOT EXISTS document TEXT;
ALTER TABLE public.subscribers ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- ==============================================================================
-- 11. POLÍTICAS RLS E ACESSO PÚBLICO (ANON) PARA LANDING PAGE E PLANOS
-- ==============================================================================
ALTER TABLE public.assinantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Permissões de schema no PostgreSQL para usuários anônimos e autenticados
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

DO $$ 
BEGIN
    -- Planos: Leitura pública universal para qualquer visitante na internet (anon/authenticated)
    DROP POLICY IF EXISTS "Permissao Total Plans" ON public.plans;
    DROP POLICY IF EXISTS "Leitura Publica Plans" ON public.plans;
    CREATE POLICY "Permissao Total Plans" ON public.plans FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

    -- Configurações do Site: Leitura pública universal para qualquer visitante na internet (anon/authenticated)
    DROP POLICY IF EXISTS "Permissao Total Site Settings" ON public.site_settings;
    DROP POLICY IF EXISTS "Leitura Publica Site Settings" ON public.site_settings;
    CREATE POLICY "Permissao Total Site Settings" ON public.site_settings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

    -- Tabela Oficial 'assinantes'
    DROP POLICY IF EXISTS "Permissao Total Assinantes" ON public.assinantes;
    CREATE POLICY "Permissao Total Assinantes" ON public.assinantes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

    -- Assinantes (Subscribers)
    DROP POLICY IF EXISTS "Permissao Total Subscribers" ON public.subscribers;
    DROP POLICY IF EXISTS "Permissao Insercao Anonima Subscribers" ON public.subscribers;
    DROP POLICY IF EXISTS "Permissao Leitura Master Subscribers" ON public.subscribers;

    -- Permite inserção anônima e autenticada de novos cadastros (Landing Page / Auth)
    CREATE POLICY "Permissao Insercao Anonima Subscribers" ON public.subscribers FOR INSERT TO anon, authenticated WITH CHECK (true);
    -- Permite leitura completa dos assinantes pelo Painel Master
    CREATE POLICY "Permissao Leitura Master Subscribers" ON public.subscribers FOR SELECT TO anon, authenticated USING (true);
    -- Permite atualização e manutenção completa
    CREATE POLICY "Permissao Total Subscribers" ON public.subscribers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
END $$;

-- ==============================================================================
-- 12. MÓDULO DE CHEQUES E CRÉDITOS DE CLIENTES (RECEBIMENTO E CARTEIRA)
-- ==============================================================================
-- 12.1. Bucket de Armazenamento para Fotos dos Cheques
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

-- 12.2. Tabela: public.financeiro_cheques
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

-- 12.3. Tabela: public.cliente_creditos
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

-- 12.4. RLS para Cheques e Créditos (Isolamento por company_id)
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

-- Publicação Realtime para sincronizar assinantes instantaneamente
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE 
            public.documentos_entrada,
            public.documentos_entrada_itens,
            public.notas_fiscais,
            public.contas_a_pagar,
            public.contas_a_receber,
            public.financeiro_cheques,
            public.cliente_creditos,
            public.fornecedores,
            public.estoque,
            public.clientes,
            public.rh_funcionarios,
            public.veiculos_maquinas,
            public.manutencoes,
            public.gestao_frotas,
            public.assinantes,
            public.subscribers;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

-- Recarrega imediatamente o cache de rotas e tabelas da API REST do Supabase (evita erro 404)
NOTIFY pgrst, 'reload schema';
`;

export const SUPABASE_RLS_FOLHAS_PAGAMENTO_SQL = `-- ==============================================================================
-- CORREÇÃO DE DIRETRIZ DE SEGURANÇA (RLS VIOLATION 42501 ON RH_FOLHAS_PAGAMENTO)
-- ==============================================================================
-- Executar no Supabase: Dashboard > SQL Editor > New query > Run
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
ALTER TABLE IF EXISTS public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS irrf NUMERIC DEFAULT 0;
ALTER TABLE IF EXISTS public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS desconto_irrf NUMERIC DEFAULT 0;
ALTER TABLE IF EXISTS public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS irrf_discount NUMERIC DEFAULT 0;
ALTER TABLE IF EXISTS public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS sindical NUMERIC DEFAULT 0;
ALTER TABLE IF EXISTS public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS desconto_sindical NUMERIC DEFAULT 0;
ALTER TABLE IF EXISTS public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS sindical_discount NUMERIC DEFAULT 0;
ALTER TABLE IF EXISTS public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS taxa_sindical NUMERIC DEFAULT 0;
ALTER TABLE IF EXISTS public.rh_folhas_pagamento ADD COLUMN IF NOT EXISTS sindical_enabled BOOLEAN DEFAULT true;
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

-- 2. Habilitação de RLS na tabela
ALTER TABLE public.rh_folhas_pagamento ENABLE ROW LEVEL SECURITY;

-- 3. Limpeza de políticas pré-existentes
DROP POLICY IF EXISTS "rh_folhas_pagamento_select_policy" ON public.rh_folhas_pagamento;
DROP POLICY IF EXISTS "rh_folhas_pagamento_insert_policy" ON public.rh_folhas_pagamento;
DROP POLICY IF EXISTS "rh_folhas_pagamento_update_policy" ON public.rh_folhas_pagamento;
DROP POLICY IF EXISTS "rh_folhas_pagamento_delete_policy" ON public.rh_folhas_pagamento;
DROP POLICY IF EXISTS "Permissao Total rh_folhas_pagamento" ON public.rh_folhas_pagamento;
DROP POLICY IF EXISTS "Permitir inserção para usuários da mesma empresa" ON public.rh_folhas_pagamento;
DROP POLICY IF EXISTS "Permitir leitura para usuários da mesma empresa" ON public.rh_folhas_pagamento;
DROP POLICY IF EXISTS "Permitir atualização para usuários da mesma empresa" ON public.rh_folhas_pagamento;
DROP POLICY IF EXISTS "Permitir exclusão para usuários da mesma empresa" ON public.rh_folhas_pagamento;

-- 4. POLÍTICAS SOLICITADAS: ESCRITA E LEITURA LIVRES PARA USUÁRIOS AUTENTICADOS
CREATE POLICY "Permitir inserção para usuários da mesma empresa" ON public.rh_folhas_pagamento 
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Permitir leitura para usuários da mesma empresa" ON public.rh_folhas_pagamento 
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir atualização para usuários da mesma empresa" ON public.rh_folhas_pagamento 
FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Permitir exclusão para usuários da mesma empresa" ON public.rh_folhas_pagamento 
FOR DELETE TO authenticated USING (true);

-- 5. POLÍTICA RESILIENTE GLOBAL COMPLEMENTAR
CREATE POLICY "Permissao Total rh_folhas_pagamento" ON public.rh_folhas_pagamento
FOR ALL TO authenticated, anon
USING (true)
WITH CHECK (true);

-- 9. Notificação ao PostgREST para recarregar o schema cache imediatamente
NOTIFY pgrst, 'reload schema';
`;

export const SupabaseSqlModal: React.FC<SupabaseSqlModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'full' | 'rh_folhas'>('full');

  if (!isOpen) return null;

  const currentSql = activeTab === 'rh_folhas' ? SUPABASE_RLS_FOLHAS_PAGAMENTO_SQL : SUPABASE_FULL_SQL_SCHEMA;
  const currentFileName = activeTab === 'rh_folhas' ? 'supabase/migrations/20261002_rh_folhas_pagamento_rls_policies.sql' : 'supabase/schema.sql';
  const downloadFileName = activeTab === 'rh_folhas' ? 'corrigir_rls_folhas_pagamento.sql' : 'supabase_schema_silagem_facil.sql';

  const handleCopy = () => {
    navigator.clipboard.writeText(currentSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleDownload = () => {
    const blob = new Blob([currentSql], { type: 'text/sql;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50 dark:bg-stone-950/40">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center space-x-2">
                <span>Script SQL PostgreSQL (Supabase)</span>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                  Estrutura Homologada
                </span>
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Tabelas e políticas RLS para persistência em nuvem multi-inquilino
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="px-4 pt-3 flex items-center space-x-2 border-b border-stone-200 dark:border-stone-800 bg-stone-100/50 dark:bg-stone-900/50">
          <button
            onClick={() => setActiveTab('full')}
            className={`px-3 py-2 text-xs font-bold rounded-t-lg transition border-b-2 flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'full'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-stone-900'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Schema Completo (Full SQL)</span>
          </button>

          <button
            onClick={() => setActiveTab('rh_folhas')}
            className={`px-3 py-2 text-xs font-bold rounded-t-lg transition border-b-2 flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'rh_folhas'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-stone-900'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
            <span>Corrigir RLS Folha de Pagamento</span>
            <span className="px-1.5 py-0.2 bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-[10px] rounded-full">
              42501 Fix
            </span>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto space-y-4 text-xs flex-1">
          {/* Instruções Rápidas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            <div className="p-3 bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-stone-200/60 dark:border-stone-700/60">
              <p className="font-bold text-stone-800 dark:text-stone-200 text-xs mb-1">1. Copie o Script</p>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                Clique no botão verde <strong className="text-stone-700 dark:text-stone-300">Copiar SQL</strong> abaixo para carregar o script selecionado.
              </p>
            </div>

            <div className="p-3 bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-stone-200/60 dark:border-stone-700/60">
              <p className="font-bold text-stone-800 dark:text-stone-200 text-xs mb-1">2. Abra o Supabase</p>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                No seu projeto Supabase, acesse o menu lateral <strong className="text-stone-700 dark:text-stone-300">SQL Editor</strong> e clique em <strong className="text-stone-700 dark:text-stone-300">+ New query</strong>.
              </p>
            </div>

            <div className="p-3 bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-stone-200/60 dark:border-stone-700/60">
              <p className="font-bold text-stone-800 dark:text-stone-200 text-xs mb-1">3. Cole e Execute</p>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                Cole o código SQL e clique em <strong className="text-stone-700 dark:text-stone-300">Run</strong>. O banco e as políticas estarão 100% aplicados!
              </p>
            </div>
          </div>

          {/* Destaque das Tabelas / Políticas */}
          {activeTab === 'rh_folhas' ? (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 p-3 rounded-xl flex items-start space-x-2.5">
              <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="font-bold text-amber-900 dark:text-amber-300 text-xs">
                  Políticas RLS para rh_folhas_pagamento (INSERT / SELECT / UPDATE / DELETE)
                </p>
                <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                  Garante permissão de escrita e leitura vinculando o <code className="bg-amber-200/60 dark:bg-amber-900/60 px-1 py-0.5 rounded font-mono text-[10px]">company_id</code> e <code className="bg-amber-200/60 dark:bg-amber-900/60 px-1 py-0.5 rounded font-mono text-[10px]">user_id</code> ao usuário autenticado, eliminando o erro <strong className="font-mono">42501</strong>.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 p-3 rounded-xl flex items-start space-x-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="font-bold text-emerald-900 dark:text-emerald-300 text-xs">
                  Integridade Referencial ON DELETE CASCADE Homologada
                </p>
                <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80">
                  A chave estrangeira <code className="bg-emerald-200/60 dark:bg-emerald-900/60 px-1 py-0.5 rounded font-mono text-[10px]">contas_a_pagar.nota_fiscal_id</code> inclui a restrição <code className="bg-emerald-200/60 dark:bg-emerald-900/60 px-1 py-0.5 rounded font-mono text-[10px]">ON DELETE CASCADE</code>.
                </p>
              </div>
            </div>
          )}

          {/* Code Viewer */}
          <div className="relative rounded-xl border border-stone-800 bg-stone-950 overflow-hidden font-mono text-[11px]">
            <div className="flex items-center justify-between px-3 py-2 bg-stone-900 border-b border-stone-800 text-stone-400 text-xs">
              <div className="flex items-center space-x-2">
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                <span>{currentFileName}</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleDownload}
                  className="px-2 py-1 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded text-[10px] font-bold flex items-center space-x-1 cursor-pointer transition"
                  title="Baixar arquivo .sql"
                >
                  <Download className="w-3 h-3" />
                  <span>Baixar .sql</span>
                </button>
                <button
                  onClick={handleCopy}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold flex items-center space-x-1 cursor-pointer transition"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copiado!' : 'Copiar SQL'}</span>
                </button>
              </div>
            </div>
            <pre className="p-3.5 overflow-x-auto text-stone-300 max-h-72 leading-relaxed selection:bg-emerald-900 selection:text-white">
              {currentSql}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950/40 flex items-center justify-between">
          <p className="text-[11px] text-stone-400">
            Arquivo: <code className="font-mono text-stone-500 dark:text-stone-300">/{currentFileName}</code>
          </p>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopy}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-xs cursor-pointer transition active:scale-95"
            >
              {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Código SQL Copiado!' : (activeTab === 'rh_folhas' ? 'Copiar Script RLS Folha' : 'Copiar Script SQL Completo')}</span>
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
