-- ==============================================================================
-- SUPABASE SCHEMA — ECOSSISTEMA DE E-BOOKS & ADMINISTRAÇÃO CÁSSIO DINIZ
-- Execute este script no SQL Editor do Supabase (https://supabase.com/dashboard)
-- ==============================================================================

-- 1. TABELA DE USUÁRIOS ADMINISTRADORES
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL DEFAULT 'Administrador Cássio Diniz',
    role TEXT NOT NULL DEFAULT 'admin',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Inserir usuário administrador inicial de referência
INSERT INTO public.admin_users (email, full_name, role)
VALUES ('admin@cassiodiniz.com.br', 'Cássio Diniz (Admin Master)', 'superadmin')
ON CONFLICT (email) DO NOTHING;

-- 2. TABELA DE E-BOOKS E MAPEAMENTO DE PASTAS POR PLATAFORMA
CREATE TABLE IF NOT EXISTS public.ebooks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    short_title TEXT NOT NULL,
    kicker TEXT,
    badge TEXT DEFAULT 'NOVO',
    price NUMERIC(10,2) NOT NULL DEFAULT 47.00,
    original_price NUMERIC(10,2) DEFAULT 97.00,
    cover TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT 'hotmart', -- 'hotmart', 'kiwify', 'monetizze', 'site_direto'
    folder_path TEXT NOT NULL DEFAULT 'ebook/hotmart/', -- caminho relativo físico da pasta
    content_file TEXT NOT NULL,
    lead TEXT,
    features JSONB DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'draft'
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. SEED DOS 4 E-BOOKS OFICIAIS COM SUAS RESPECTIVAS PASTAS
INSERT INTO public.ebooks (id, title, short_title, kicker, badge, price, original_price, cover, platform, folder_path, content_file, lead, features)
VALUES 
(
    'esteira-automacao',
    'Esteira de Automação para Negócios Locais — O Guia Definitivo',
    'Esteira de Automação para Negócios Locais',
    'AUTOMAÇÃO COMERCIAL & IA',
    'MAIS VENDIDO',
    47.00,
    97.00,
    'assets/capa-esteira-automacao.jpg',
    'hotmart',
    'ebook/hotmart/esteira-automacao/',
    'esteira-de-automacao-para-negocios-locais.html',
    'Transforme o WhatsApp e o atendimento da sua empresa em uma máquina 24/7 com Make, Typebot e IA.',
    '["Manual Completo em PDF/Web Diagramado em Alta Definição", "Os 4 Pilares da Esteira Automatizada", "Configuração do Typebot e WhatsApp Oficial", "Blindagem Anti-No-Show de 80%", "BÔNUS: Pack com 15 Scripts Prontos"]'::jsonb
),
(
    'trafego-hiperlocal',
    'Manual Prático de Tráfego Pago Hiperlocal (Google Ads & Meta Ads)',
    'Manual Prático de Tráfego Pago Hiperlocal',
    'TRÁFEGO PAGO REGIONAL',
    'ALTO ROI',
    37.00,
    97.00,
    'assets/capa-trafego-hiperlocal.jpg',
    'kiwify',
    'ebook/kiwify/trafego-hiperlocal/',
    'manual-pratico-trafego-pago-hiperlocal.html',
    'Domine o raio de 3 a 15 km no Google Maps e Instagram sem desperdiçar verba com outras cidades.',
    '["A Fórmula do Raio de Ouro (3 km, 5 km e 10 km)", "Pino de Destaque no Google Maps", "Lista Negra com 150+ palavras negativas", "BÔNUS: 20 Modelos de Anúncios Prontos"]'::jsonb
),
(
    'copywriting-black',
    'Templates de Copywriting para Infoprodutos Black — Estruturas de Alta Conversão',
    'Templates de Copywriting para Infoprodutos Black',
    'COPYWRITING & PERSUASÃO',
    'ALTA ESCALA',
    67.00,
    197.00,
    'assets/capa-copywriting-black.jpg',
    'monetizze',
    'ebook/monetizee/copywriting-black/',
    'templates-de-copywriting-para-infoprodutos-black.html',
    'Ganchos hipnóticos e Mecanismos Únicos com blindagem total contra bloqueios de contas de anúncios.',
    '["O Conceito de Mecanismo Único", "Estrutura dos Primeiros 180s da VSL", "Advertoriais e Presells Seguros", "BÔNUS: Dicionário de Compliance"]'::jsonb
),
(
    'python-automacao',
    'Guia Avançado de Python para Automação: Web Scraping, Bots e Pipelines Industriais',
    'Guia Avançado de Python para Automação',
    'ENGENHARIA DE SOFTWARE',
    'AVANÇADO',
    47.00,
    127.00,
    'assets/capa-python-automacao.jpg',
    'hotmart',
    'ebook/hotmart/python-automacao/',
    'guia-avancado-de-python-para-automacao.html',
    'Construa automações resilientes com Playwright assíncrono, HTTPX concorrente e Docker 24/7.',
    '["Automação Web Assíncrona com Playwright", "Web Scraping Concorrente com HTTPX", "Automação de Planilhas e OCR", "BÔNUS: Dockerização e Pipelines 24/7"]'::jsonb
)
ON CONFLICT (id) DO UPDATE 
SET price = EXCLUDED.price,
    platform = EXCLUDED.platform,
    folder_path = EXCLUDED.folder_path,
    updated_at = timezone('utc'::text, now());

-- 4. TABELA DE PEDIDOS E HISTÓRICO DE VENDAS (GESTAO DE VENDAS)
CREATE TABLE IF NOT EXISTS public.orders (
    id BIGSERIAL PRIMARY KEY,
    order_id TEXT UNIQUE NOT NULL,
    ebook_id TEXT NOT NULL REFERENCES public.ebooks(id),
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_cpf TEXT,
    amount NUMERIC(10,2) NOT NULL,
    platform TEXT NOT NULL DEFAULT 'site_pix', -- 'site_pix', 'hotmart', 'kiwify', 'monetizze'
    folder_path TEXT NOT NULL DEFAULT 'ebook/conteudo/',
    access_code TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'refunded'
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    approved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON public.orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_access_code ON public.orders(access_code);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);

-- 5. TABELA DE CONTROLE DE SESSÕES ATIVAS (SINGLE SESSION LOCK)
CREATE TABLE IF NOT EXISTS public.active_sessions (
    access_code TEXT PRIMARY KEY,
    session_token TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    ebook_id TEXT NOT NULL REFERENCES public.ebooks(id),
    last_heartbeat TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ativação de RLS (Row Level Security) opcional
ALTER TABLE public.ebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;

-- Políticas de leitura pública para o catálogo
CREATE POLICY "Catálogo de E-books visível publicamente" 
ON public.ebooks FOR SELECT USING (status = 'active');

-- Política de leitura e escrita administrativa
CREATE POLICY "Administradores possuem acesso irrestrito a ebooks" 
ON public.ebooks FOR ALL USING (true);

CREATE POLICY "Administradores possuem acesso irrestrito a pedidos" 
ON public.orders FOR ALL USING (true);

CREATE POLICY "Administradores possuem acesso irrestrito a sessoes" 
ON public.active_sessions FOR ALL USING (true);
