-- =============================================================================
-- SecureVision — Schema Completo do Banco de Dados
-- Supabase / PostgreSQL
-- =============================================================================
-- INSTRUCOES: Execute este script no SQL Editor do seu projeto Supabase.
-- Menu: SQL Editor -> New Query -> Cole o conteudo -> Run
-- =============================================================================

-- Habilita extensao pgvector para busca de similaridade vetorial de embeddings faciais
CREATE EXTENSION IF NOT EXISTS vector;

-- Habilita extensao para geracao de UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- =============================================================================
-- LIMPEZA (DROP) — Remove versoes anteriores para aplicar o schema novo
-- Comente esta secao em producao para nao perder dados!
-- =============================================================================
DROP TABLE IF EXISTS source_integrity_logs CASCADE;
DROP TABLE IF EXISTS audit_logs            CASCADE;
DROP TABLE IF EXISTS reconhecimentos       CASCADE;
DROP TABLE IF EXISTS face_embeddings       CASCADE;
DROP TABLE IF EXISTS cameras               CASCADE;
DROP TABLE IF EXISTS pessoas               CASCADE;
DROP TABLE IF EXISTS users_profiles        CASCADE;

DROP FUNCTION IF EXISTS match_face_embedding(vector, float, int);
DROP FUNCTION IF EXISTS get_dashboard_stats();
DROP FUNCTION IF EXISTS fn_set_updated_at();
DROP FUNCTION IF EXISTS fn_create_user_profile();


-- =============================================================================
-- FUNCAO AUXILIAR: Atualiza updated_at automaticamente via trigger
-- =============================================================================
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- =============================================================================
-- TABELA 1: users_profiles
-- Perfil de cada usuario administrador do sistema (vinculado ao Supabase Auth).
-- =============================================================================
CREATE TABLE IF NOT EXISTS users_profiles (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nome       TEXT        NOT NULL,
  role       TEXT        NOT NULL DEFAULT 'visualizador'
               CHECK (role IN ('admin', 'operador', 'visualizador')),
  status     TEXT        NOT NULL DEFAULT 'ativo'
               CHECK (status IN ('ativo', 'inativo', 'suspenso')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  users_profiles         IS 'Perfis de usuarios administrativos vinculados ao Supabase Auth.';
COMMENT ON COLUMN users_profiles.user_id IS 'FK para auth.users — cada perfil pertence a um usuario Auth.';
COMMENT ON COLUMN users_profiles.role    IS 'Nivel de acesso: admin (total), operador (leitura/escrita), visualizador (somente leitura).';
COMMENT ON COLUMN users_profiles.status  IS 'Status da conta no sistema.';


-- =============================================================================
-- TABELA 2: pessoas
-- Registro das pessoas cadastradas no sistema de biometria.
-- O CPF nunca e armazenado em texto puro: usa hash cego (cpf_hash)
-- para garantir unicidade e uma versao mascarada para exibicao.
-- =============================================================================
CREATE TABLE IF NOT EXISTS pessoas (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                     TEXT        NOT NULL,
  idade                    INT         CHECK (idade >= 0 AND idade <= 150),
  cpf_hash                 TEXT        NOT NULL UNIQUE,
  cpf_mascarado            TEXT        NOT NULL,
  foto_url                 TEXT,
  status                   TEXT        NOT NULL DEFAULT 'ativo'
                             CHECK (status IN ('ativo', 'bloqueado', 'inativo')),
  consentimento_registrado BOOLEAN     NOT NULL DEFAULT FALSE,
  created_by               UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  pessoas                          IS 'Pessoas cadastradas no sistema para reconhecimento facial.';
COMMENT ON COLUMN pessoas.cpf_hash                 IS 'SHA-256 do CPF sem formatacao. Usado como blind index para unicidade sem expor o CPF.';
COMMENT ON COLUMN pessoas.cpf_mascarado            IS 'CPF parcialmente mascarado para exibicao segura na UI (ex: 123.***.***-45).';
COMMENT ON COLUMN pessoas.status                   IS 'ativo = reconhecimento normal; bloqueado = gera alerta; inativo = ignorado.';
COMMENT ON COLUMN pessoas.consentimento_registrado IS 'Confirma que o titular deu consentimento expresso conforme a LGPD.';
COMMENT ON COLUMN pessoas.created_by               IS 'FK para o usuario admin que realizou o cadastro.';

CREATE TRIGGER trg_pessoas_updated_at
  BEFORE UPDATE ON pessoas
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_pessoas_status ON pessoas(status);


-- =============================================================================
-- TABELA 3: face_embeddings
-- Vetores de caracteristicas faciais (embeddings) gerados pelos modelos de IA.
-- =============================================================================
CREATE TABLE IF NOT EXISTS face_embeddings (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pessoa_id        UUID        NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
  embedding        VECTOR(128) NOT NULL,
  modelo_usado     TEXT        NOT NULL DEFAULT 'face-api.js/ssdMobilenetv1',
  qualidade_imagem FLOAT       CHECK (qualidade_imagem >= 0.0 AND qualidade_imagem <= 1.0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  face_embeddings                  IS 'Embeddings faciais de 128 dimensoes vinculados a cada pessoa cadastrada.';
COMMENT ON COLUMN face_embeddings.embedding        IS 'Vetor de caracteristicas faciais (128 dim). Tipo pgvector.';
COMMENT ON COLUMN face_embeddings.modelo_usado     IS 'Identificacao do modelo e versao que gerou o embedding.';
COMMENT ON COLUMN face_embeddings.qualidade_imagem IS 'Score de 0 a 1 indicando qualidade da imagem fonte do embedding.';

-- Indice HNSW para busca ANN rapida (Approximate Nearest Neighbor) por cosseno
CREATE INDEX IF NOT EXISTS idx_face_embeddings_hnsw
  ON face_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_face_embeddings_pessoa_id ON face_embeddings(pessoa_id);


-- =============================================================================
-- TABELA 4: cameras
-- Configuracao das cameras cadastradas no sistema.
-- =============================================================================
CREATE TABLE IF NOT EXISTS cameras (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome         TEXT        NOT NULL,
  tipo         TEXT        NOT NULL
                 CHECK (tipo IN ('webcam', 'usb', 'ip', 'rtsp', 'onvif')),
  url_conexao  TEXT        NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'ativo'
                 CHECK (status IN ('ativo', 'inativo', 'erro')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  cameras            IS 'Cameras cadastradas no sistema de monitoramento.';
COMMENT ON COLUMN cameras.tipo       IS 'Protocolo: webcam, usb, ip (HTTP MJPEG), rtsp ou onvif.';
COMMENT ON COLUMN cameras.url_conexao IS 'Indice do dispositivo (ex: 0) para USB, ou URL completa para IP/RTSP.';


-- =============================================================================
-- TABELA 5: reconhecimentos
-- Registro de cada evento de deteccao/reconhecimento facial pela camera.
-- =============================================================================
CREATE TABLE IF NOT EXISTS reconhecimentos (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pessoa_id           UUID        REFERENCES pessoas(id) ON DELETE SET NULL,
  camera_id           UUID        REFERENCES cameras(id) ON DELETE SET NULL,
  confianca           FLOAT       CHECK (confianca >= 0.0 AND confianca <= 1.0),
  imagem_snapshot_url TEXT,
  detected_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata            JSONB
);

COMMENT ON TABLE  reconhecimentos                   IS 'Log de cada evento de deteccao/reconhecimento facial pelo sistema.';
COMMENT ON COLUMN reconhecimentos.pessoa_id         IS 'Pessoa identificada. NULL indica pessoa desconhecida.';
COMMENT ON COLUMN reconhecimentos.confianca         IS 'Score de similaridade (0 a 1). Valores > 0.5 sao considerados match valido.';
COMMENT ON COLUMN reconhecimentos.imagem_snapshot_url IS 'URL do frame capturado no Storage para auditoria visual posterior.';
COMMENT ON COLUMN reconhecimentos.metadata          IS 'JSON extra: { "idade_estimada": 34, "track_id": 7, "genero": "male" }';

CREATE INDEX IF NOT EXISTS idx_reconhecimentos_detected_at ON reconhecimentos(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_reconhecimentos_pessoa_id   ON reconhecimentos(pessoa_id);
CREATE INDEX IF NOT EXISTS idx_reconhecimentos_camera_id   ON reconhecimentos(camera_id);


-- =============================================================================
-- TABELA 6: audit_logs
-- Trilha de auditoria de todas as acoes administrativas no sistema.
-- =============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  acao        TEXT        NOT NULL,
  entidade    TEXT        NOT NULL,
  entidade_id UUID,
  ip          TEXT,
  user_agent  TEXT,
  detalhes    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  audit_logs            IS 'Trilha de auditoria completa de todas as acoes administrativas.';
COMMENT ON COLUMN audit_logs.acao       IS 'Tipo de acao: CREATE, UPDATE, DELETE, LOGIN, LOGOUT, BLOCK_PERSON, etc.';
COMMENT ON COLUMN audit_logs.entidade   IS 'Nome da tabela/entidade afetada.';
COMMENT ON COLUMN audit_logs.entidade_id IS 'UUID do registro afetado. Nulo para acoes sistemicas (ex: LOGIN).';
COMMENT ON COLUMN audit_logs.detalhes   IS 'JSON com contexto: valores anteriores, novos, diff de campos alterados.';

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id    ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entidade   ON audit_logs(entidade, entidade_id);


-- =============================================================================
-- TABELA 7: source_integrity_logs
-- Logs do sistema de vigilancia de integridade do codigo-fonte.
-- =============================================================================
CREATE TABLE IF NOT EXISTS source_integrity_logs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  commit_hash      TEXT,
  arquivo_alterado TEXT        NOT NULL,
  acao_detectada   TEXT        NOT NULL
                     CHECK (acao_detectada IN ('MODIFICACAO', 'DELECAO', 'CRIACAO')),
  permitido        BOOLEAN     NOT NULL DEFAULT FALSE,
  motivo           TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  source_integrity_logs              IS 'Registro de eventos de monitoramento de integridade do codigo-fonte.';
COMMENT ON COLUMN source_integrity_logs.commit_hash  IS 'Hash SHA-256 do arquivo no momento da deteccao.';
COMMENT ON COLUMN source_integrity_logs.acao_detectada IS 'Tipo de evento: MODIFICACAO, DELECAO ou CRIACAO de arquivo.';
COMMENT ON COLUMN source_integrity_logs.permitido    IS 'TRUE = mudanca autorizada via CLI authorize_changes.py.';
COMMENT ON COLUMN source_integrity_logs.motivo       IS 'Razao da rejeicao ou justificativa da autorizacao.';

CREATE INDEX IF NOT EXISTS idx_source_integrity_created_at ON source_integrity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_source_integrity_arquivo    ON source_integrity_logs(arquivo_alterado);
CREATE INDEX IF NOT EXISTS idx_source_integrity_bloqueados ON source_integrity_logs(permitido) WHERE permitido = FALSE;


-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================
ALTER TABLE users_profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE pessoas               ENABLE ROW LEVEL SECURITY;
ALTER TABLE face_embeddings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE cameras               ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconhecimentos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_integrity_logs ENABLE ROW LEVEL SECURITY;

-- ---- users_profiles ----
CREATE POLICY "up_select_auth"
  ON users_profiles FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "up_all_own"
  ON users_profiles FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "up_all_admin"
  ON users_profiles FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users_profiles WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- ---- pessoas ----
CREATE POLICY "pessoas_select_auth"
  ON pessoas FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "pessoas_insert_op"
  ON pessoas FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM users_profiles WHERE user_id = auth.uid() AND role IN ('admin','operador')
  ));

CREATE POLICY "pessoas_update_op"
  ON pessoas FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM users_profiles WHERE user_id = auth.uid() AND role IN ('admin','operador')
  ));

CREATE POLICY "pessoas_delete_admin"
  ON pessoas FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM users_profiles WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- ---- face_embeddings ----
CREATE POLICY "fe_select_auth"
  ON face_embeddings FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "fe_insert_op"
  ON face_embeddings FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM users_profiles WHERE user_id = auth.uid() AND role IN ('admin','operador')
  ));

CREATE POLICY "fe_delete_op"
  ON face_embeddings FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM users_profiles WHERE user_id = auth.uid() AND role IN ('admin','operador')
  ));

-- ---- cameras ----
CREATE POLICY "cameras_select_auth"
  ON cameras FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "cameras_all_op"
  ON cameras FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users_profiles WHERE user_id = auth.uid() AND role IN ('admin','operador')
  ));

-- ---- reconhecimentos ----
CREATE POLICY "recon_select_auth"
  ON reconhecimentos FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "recon_insert_auth"
  ON reconhecimentos FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ---- audit_logs ----
CREATE POLICY "al_select_auth"
  ON audit_logs FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "al_insert_open"
  ON audit_logs FOR INSERT
  WITH CHECK (true);

-- ---- source_integrity_logs ----
CREATE POLICY "sil_select_admin"
  ON source_integrity_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users_profiles WHERE user_id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "sil_insert_open"
  ON source_integrity_logs FOR INSERT
  WITH CHECK (true);


-- =============================================================================
-- FUNCAO RPC: match_face_embedding
-- Busca os embeddings mais proximos usando distancia de cosseno (pgvector).
-- Filtra automaticamente pessoas com status 'inativo'.
-- =============================================================================
CREATE OR REPLACE FUNCTION match_face_embedding(
  query_embedding VECTOR(128),
  match_threshold FLOAT   DEFAULT 0.50,
  match_count     INT     DEFAULT 5
)
RETURNS TABLE (
  embedding_id UUID,
  pessoa_id    UUID,
  nome         TEXT,
  status       TEXT,
  foto_url     TEXT,
  modelo_usado TEXT,
  similarity   FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    fe.id                                               AS embedding_id,
    fe.pessoa_id,
    p.nome,
    p.status,
    p.foto_url,
    fe.modelo_usado,
    (1.0 - (fe.embedding <=> query_embedding))::FLOAT   AS similarity
  FROM face_embeddings fe
  JOIN pessoas p ON p.id = fe.pessoa_id
  WHERE
    p.status != 'inativo'
    AND (1.0 - (fe.embedding <=> query_embedding)) > match_threshold
  ORDER BY fe.embedding <=> query_embedding ASC
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION match_face_embedding IS
  'Busca vetorial por cosseno nos embeddings faciais. Exclui pessoas inativas. Retorna os N mais similares acima do limiar.';


-- =============================================================================
-- FUNCAO RPC: get_dashboard_stats
-- Retorna contadores gerais para o painel administrativo.
-- =============================================================================
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE result JSON;
BEGIN
  SELECT json_build_object(
    'total_pessoas',        (SELECT COUNT(*) FROM pessoas),
    'pessoas_ativas',       (SELECT COUNT(*) FROM pessoas WHERE status = 'ativo'),
    'pessoas_bloqueadas',   (SELECT COUNT(*) FROM pessoas WHERE status = 'bloqueado'),
    'total_cameras',        (SELECT COUNT(*) FROM cameras),
    'cameras_ativas',       (SELECT COUNT(*) FROM cameras WHERE status = 'ativo'),
    'reconhecimentos_hoje', (SELECT COUNT(*) FROM reconhecimentos WHERE detected_at >= CURRENT_DATE),
    'total_usuarios',       (SELECT COUNT(*) FROM users_profiles)
  ) INTO result;
  RETURN result;
END;
$$;


-- =============================================================================
-- TRIGGER: Cria o perfil do usuario automaticamente ao se registrar no Auth
-- =============================================================================
CREATE OR REPLACE FUNCTION fn_create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users_profiles (user_id, nome, role, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    'visualizador',
    'ativo'
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_create_user_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION fn_create_user_profile();


-- =============================================================================
-- VIEWS UTEIS
-- =============================================================================

CREATE OR REPLACE VIEW vw_pessoas_resumo AS
SELECT
  p.id,
  p.nome,
  p.cpf_mascarado,
  p.status,
  p.consentimento_registrado,
  p.foto_url,
  p.created_at,
  p.updated_at,
  COUNT(DISTINCT fe.id)  AS total_embeddings,
  MAX(r.detected_at)     AS ultimo_reconhecimento,
  up.nome                AS cadastrado_por
FROM pessoas p
LEFT JOIN face_embeddings fe ON fe.pessoa_id = p.id
LEFT JOIN reconhecimentos  r  ON r.pessoa_id  = p.id
LEFT JOIN users_profiles  up  ON up.user_id   = p.created_by
GROUP BY p.id, up.nome;

COMMENT ON VIEW vw_pessoas_resumo IS
  'Pessoas cadastradas com contagem de embeddings e data do ultimo reconhecimento.';

CREATE OR REPLACE VIEW vw_reconhecimentos_recentes AS
SELECT
  r.id,
  r.detected_at,
  r.confianca,
  r.imagem_snapshot_url,
  r.metadata,
  p.nome         AS pessoa_nome,
  p.status       AS pessoa_status,
  p.cpf_mascarado,
  c.nome         AS camera_nome,
  c.tipo         AS camera_tipo
FROM reconhecimentos r
LEFT JOIN pessoas p ON p.id = r.pessoa_id
LEFT JOIN cameras c ON c.id = r.camera_id
ORDER BY r.detected_at DESC;

COMMENT ON VIEW vw_reconhecimentos_recentes IS
  'Reconhecimentos recentes com dados enriquecidos de pessoa e camera.';

-- =============================================================================
-- FIM DO SCHEMA
-- =============================================================================
