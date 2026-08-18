import os
import sqlite3
import json
from datetime import datetime

DB_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "data"))
DB_PATH = os.path.join(DB_DIR, "fecart.db")

def get_connection():
    """Retorna uma conexao ativa com o banco de dados SQLite."""
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # Permite acessar colunas por nome
    return conn

def init_db():
    """Inicializa o banco de dados e cria as 7 tabelas necessarias."""
    conn = get_connection()
    cursor = conn.cursor()

    # 1. Tabela users_profiles
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users_profiles (
        id TEXT PRIMARY KEY,
        user_id TEXT UNIQUE NOT NULL,
        nome TEXT NOT NULL,
        role TEXT CHECK(role IN ('admin', 'operador', 'visualizador')) DEFAULT 'visualizador',
        status TEXT CHECK(status IN ('ativo', 'inativo')) DEFAULT 'ativo',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 2. Tabela pessoas
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS pessoas (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        idade INTEGER,
        cpf_hash TEXT UNIQUE NOT NULL,
        cpf_mascarado TEXT NOT NULL,
        foto_url TEXT,
        status TEXT CHECK(status IN ('ativo', 'bloqueado', 'inativo')) DEFAULT 'ativo',
        consentimento_registrado INTEGER DEFAULT 0,
        created_by TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 3. Tabela face_embeddings
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS face_embeddings (
        id TEXT PRIMARY KEY,
        pessoa_id TEXT NOT NULL,
        embedding TEXT NOT NULL, -- Vetor serializado em formato JSON
        modelo_usado TEXT NOT NULL,
        qualidade_imagem REAL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pessoa_id) REFERENCES pessoas(id) ON DELETE CASCADE
    );
    """)

    # 4. Tabela cameras
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS cameras (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        tipo TEXT CHECK(tipo IN ('webcam', 'usb', 'ip', 'rtsp', 'onvif')) NOT NULL,
        url_conexao TEXT NOT NULL,
        status TEXT CHECK(status IN ('ativo', 'inativo', 'erro')) DEFAULT 'ativo',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 5. Tabela reconhecimentos
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS reconhecimentos (
        id TEXT PRIMARY KEY,
        pessoa_id TEXT, -- NULL se for desconhecido
        camera_id TEXT,
        confianca REAL,
        imagem_snapshot_url TEXT,
        detected_at TEXT DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT, -- JSON com dados adicionais
        FOREIGN KEY (pessoa_id) REFERENCES pessoas(id) ON DELETE SET NULL,
        FOREIGN KEY (camera_id) REFERENCES cameras(id) ON DELETE SET NULL
    );
    """)

    # 6. Tabela audit_logs
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        acao TEXT NOT NULL,
        entidade TEXT NOT NULL,
        entidade_id TEXT,
        ip TEXT,
        user_agent TEXT,
        detalhes TEXT, -- JSON com detalhes do evento
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 7. Tabela source_integrity_logs
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS source_integrity_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        commit_hash TEXT,
        arquivo_alterado TEXT NOT NULL,
        acao_detectada TEXT NOT NULL,
        permitido INTEGER DEFAULT 0,
        motivo TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)

    conn.commit()

    # Inserir dados de teste iniciais (se vazios)
    seed_data(cursor)
    conn.commit()
    conn.close()
    print("[DB] Banco de dados SQLite inicializado com sucesso.")

def seed_data(cursor):
    """Insere dados ficticios para demonstracao academica."""
    # Verificar se ja existem cameras cadastradas
    cursor.execute("SELECT COUNT(*) FROM cameras;")
    if cursor.fetchone()[0] == 0:
        import uuid
        cams = [
            (str(uuid.uuid4()), "Webcam Integrada", "webcam", "0", "ativo"),
            (str(uuid.uuid4()), "Entrada FECAP (Simulada)", "ip", "fecap_entrada.mp4", "ativo"),
            (str(uuid.uuid4()), "Auditório FECAP (Simulada)", "rtsp", "fecap_auditorio.mp4", "ativo")
        ]
        cursor.executemany("INSERT INTO cameras (id, nome, tipo, url_conexao, status) VALUES (?, ?, ?, ?, ?);", cams)

    # Verificar se ja existe usuario demo
    cursor.execute("SELECT COUNT(*) FROM users_profiles;")
    if cursor.fetchone()[0] == 0:
        import uuid
        uid = str(uuid.uuid4())
        cursor.execute(
            "INSERT INTO users_profiles (id, user_id, nome, role, status) VALUES (?, ?, ?, ?, ?);",
            (uid, uid, "Prof. Administrador FECAP", "admin", "ativo")
        )

# --- Funcoes auxiliares de persistencia ---

def add_audit_log(user_id, acao, entidade, entidade_id=None, detalhes=None, ip="127.0.0.1", user_agent="Streamlit App"):
    """Insere um novo log de auditoria no banco."""
    import uuid
    conn = get_connection()
    cursor = conn.cursor()
    detalhes_str = json.dumps(detalhes) if detalhes else None
    cursor.execute(
        "INSERT INTO audit_logs (id, user_id, acao, entidade, entidade_id, ip, user_agent, detalhes) VALUES (?, ?, ?, ?, ?, ?, ?, ?);",
        (str(uuid.uuid4()), user_id, acao, entidade, entidade_id, ip, user_agent, detalhes_str)
    )
    conn.commit()
    conn.close()

def add_integrity_log(user_id, commit_hash, arquivo_alterado, acao_detectada, permitido=0, motivo=None):
    """Insere um log de integridade de codigo-fonte."""
    import uuid
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO source_integrity_logs (id, user_id, commit_hash, arquivo_alterado, acao_detectada, permitido, motivo) VALUES (?, ?, ?, ?, ?, ?, ?);",
        (str(uuid.uuid4()), user_id, commit_hash, arquivo_alterado, acao_detectada, permitido, motivo)
    )
    conn.commit()
    conn.close()

def register_person(nome, idade, cpf_mascarado, cpf_hash, embedding, foto_url=None, consentimento=True, created_by=None):
    """Cadastra uma pessoa e seu embedding correspondente."""
    import uuid
    conn = get_connection()
    cursor = conn.cursor()
    pessoa_id = str(uuid.uuid4())
    
    try:
        # 1. Inserir pessoa
        cursor.execute(
            "INSERT INTO pessoas (id, nome, idade, cpf_hash, cpf_mascarado, foto_url, status, consentimento_registrado, created_by) VALUES (?, ?, ?, ?, ?, ?, 'ativo', ?, ?);",
            (pessoa_id, nome, idade, cpf_hash, cpf_mascarado, foto_url, 1 if consentimento else 0, created_by)
        )
        
        # 2. Inserir embedding
        emb_id = str(uuid.uuid4())
        cursor.execute(
            "INSERT INTO face_embeddings (id, pessoa_id, embedding, modelo_usado, qualidade_imagem) VALUES (?, ?, ?, ?, ?);",
            (emb_id, pessoa_id, json.dumps(embedding), "PyTorch/ResNet-50", 0.95)
        )
        
        conn.commit()
        
        # 3. Log de auditoria
        add_audit_log(created_by, "CREATE", "pessoas", pessoa_id, {"nome": nome, "idade": idade, "cpf": cpf_mascarado})
        return pessoa_id
    except sqlite3.IntegrityError as e:
        conn.rollback()
        raise ValueError("Erro de Integridade: Possível CPF duplicado.")
    finally:
        conn.close()

def delete_person(pessoa_id, user_id=None):
    """Remove uma pessoa e seus embeddings associados (via cascade)."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM pessoas WHERE id = ?;", (pessoa_id,))
    conn.commit()
    conn.close()
    add_audit_log(user_id, "DELETE", "pessoas", pessoa_id, {"info": "Remocao de cadastro permanente"})

def get_all_embeddings():
    """Retorna lista de todos os embeddings ativos do banco de dados."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT fe.pessoa_id, p.nome, p.status, p.foto_url, fe.embedding, p.cpf_mascarado
        FROM face_embeddings fe
        JOIN pessoas p ON fe.pessoa_id = p.id
        WHERE p.status != 'inativo';
    """)
    rows = cursor.fetchall()
    conn.close()
    
    embeddings = []
    for row in rows:
        embeddings.append({
            "pessoa_id": row["pessoa_id"],
            "nome": row["nome"],
            "status": row["status"],
            "foto_url": row["foto_url"],
            "cpf_mascarado": row["cpf_mascarado"],
            "embedding": json.loads(row["embedding"])
        })
    return embeddings

def register_recognition(pessoa_id, camera_id, confianca, snapshot_url, metadata=None):
    """Insere um novo evento de reconhecimento facial / de pessoa."""
    import uuid
    conn = get_connection()
    cursor = conn.cursor()
    rec_id = str(uuid.uuid4())
    metadata_str = json.dumps(metadata) if metadata else None
    
    cursor.execute(
        "INSERT INTO reconhecimentos (id, pessoa_id, camera_id, confianca, imagem_snapshot_url, metadata) VALUES (?, ?, ?, ?, ?, ?);",
        (rec_id, pessoa_id, camera_id, confianca, snapshot_url, metadata_str)
    )
    conn.commit()
    conn.close()
    return rec_id

if __name__ == "__main__":
    init_db()
