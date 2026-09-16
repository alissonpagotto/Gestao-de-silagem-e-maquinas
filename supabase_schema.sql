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
            public.agenda_servicos;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;
