-- Habilita a extensão pgvector para busca de similaridade vetorial
create extension if not exists vector;

-- Tabela de Pessoas Cadastradas
create table if not exists pessoas (
  id uuid default gen_random_uuid() primary key,
  nome text not null,
  cpf_encrypted text not null, -- CPF criptografado no cliente (AES-256)
  cpf_hash text unique not null, -- Blind Index para impedir CPFs duplicados
  data_nascimento date not null,
  status text check (status in ('ativo', 'bloqueado', 'inativo')) default 'ativo' not null,
  observacoes text,
  criado_por text not null, -- E-mail do usuário administrador que realizou o cadastro
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Tabela de Biometria Facial
create table if not exists biometria (
  id uuid default gen_random_uuid() primary key,
  pessoa_id uuid references pessoas(id) on delete cascade not null,
  descriptor vector(128) not null, -- Vetor de 128 dimensões do face-api.js
  foto_url text not null,          -- Link público ou privado para a imagem do cadastro
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Tabela de Configurações das Câmeras
create table if not exists camera_configs (
  id uuid default gen_random_uuid() primary key,
  nome text not null,
  tipo text check (tipo in ('webcam', 'usb', 'ip', 'rtsp')) not null,
  url text not null, -- '0' para webcam integrada ou URL RTSP/IP
  status text check (status in ('ativo', 'inativo')) default 'ativo' not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Tabela de Registro de Acessos (Detecções em Tempo Real)
create table if not exists registro_acessos (
  id uuid default gen_random_uuid() primary key,
  camera_id uuid references camera_configs(id) on delete set null,
  pessoa_id uuid references pessoas(id) on delete set null, -- NULL se for pessoa desconhecida
  foto_capturada_url text,                                   -- Link para o frame do evento
  similaridade float,                                        -- Score de correspondência (0 a 1)
  idade_estimada int,                                        -- Idade estimada na detecção facial
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Tabela de Logs de Auditoria (Sistema de Integridade e Segurança)
create table if not exists audit_logs (
  id uuid default gen_random_uuid() primary key,
  tipo_evento text not null, -- 'MODIFICACAO_CODIGO', 'TENTATIVA_INVASAO', 'ALTERACAO_CONFIG'
  descricao text not null,
  detalhes jsonb,            -- Dados extras como path do arquivo, diff, IP, etc.
  revertido boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilita Row Level Security (RLS) para as tabelas principais para garantir a segurança dos dados
alter table pessoas enable row level security;
alter table biometria enable row level security;
alter table camera_configs enable row level security;
alter table registro_acessos enable row level security;
alter table audit_logs enable row level security;

-- Criação de Políticas Básicas de Acesso para Administradores
-- Para fins deste MVP/Protótipo, as políticas permitirão acesso total a usuários autenticados
create policy "Permitir leitura para usuários autenticados" on pessoas for select using (auth.role() = 'authenticated');
create policy "Permitir escrita para usuários autenticados" on pessoas for all using (auth.role() = 'authenticated');

create policy "Permitir leitura para usuários autenticados" on biometria for select using (auth.role() = 'authenticated');
create policy "Permitir escrita para usuários autenticados" on biometria for all using (auth.role() = 'authenticated');

create policy "Permitir leitura para usuários autenticados" on camera_configs for select using (auth.role() = 'authenticated');
create policy "Permitir escrita para usuários autenticados" on camera_configs for all using (auth.role() = 'authenticated');

create policy "Permitir leitura para usuários autenticados" on registro_acessos for select using (auth.role() = 'authenticated');
create policy "Permitir escrita para usuários autenticados" on registro_acessos for all using (auth.role() = 'authenticated');

create policy "Permitir leitura para usuários autenticados" on audit_logs for select using (auth.role() = 'authenticated');
create policy "Permitir escrita para usuários autenticados" on audit_logs for all using (auth.role() = 'authenticated');

-- Função RPC para Busca Vetorial de Face por Distância de Cosseno
create or replace function match_face_descriptor (
  query_embedding vector(128),
  match_threshold float,
  match_count int
)
returns table (
  biometria_id uuid,
  pessoa_id uuid,
  nome text,
  foto_url text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    b.id as biometria_id,
    b.pessoa_id,
    p.nome,
    b.foto_url,
    1 - (b.descriptor <=> query_embedding) as similarity
  from biometria b
  join pessoas p on b.pessoa_id = p.id
  where p.status != 'inativo' -- Oculta inativos da busca ativa de monitoramento
    and 1 - (b.descriptor <=> query_embedding) > match_threshold
  order by b.descriptor <=> query_embedding asc
  limit match_count;
end;
$$;
