import os
import sqlite3
import json
import uuid
import hashlib
from datetime import datetime

DB_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "data"))
DB_PATH = os.path.join(DB_DIR, "fecart.db")

def get_connection():
    """Retorna uma conexão ativa com o banco de dados SQLite."""
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db(force_recreate=False):
    """Inicializa o banco de dados e cria as tabelas necessárias."""
    os.makedirs(DB_DIR, exist_ok=True)
    if force_recreate and os.path.exists(DB_PATH):
        try:
            os.remove(DB_PATH)
        except Exception:
            pass

    conn = get_connection()
    cursor = conn.cursor()

    # 1. Tabela users_profiles (Operadores e Admins)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users_profiles (
        id TEXT PRIMARY KEY,
        user_id TEXT UNIQUE NOT NULL,
        nome TEXT NOT NULL,
        role TEXT CHECK(role IN ('admin', 'operador', 'visualizador')) DEFAULT 'admin',
        clearance_level TEXT DEFAULT 'Level 4 (Executive)',
        avatar_url TEXT,
        status TEXT CHECK(status IN ('ativo', 'inativo')) DEFAULT 'ativo',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 2. Tabela pessoas (Cadastros biométricos de entidades/sujeitos)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS pessoas (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        idade INTEGER DEFAULT 30,
        cpf_hash TEXT UNIQUE NOT NULL,
        cpf_mascarado TEXT NOT NULL,
        departamento TEXT DEFAULT 'Engineering',
        clearance_level TEXT DEFAULT 'Level 1 (Basic)',
        foto_url TEXT,
        status TEXT CHECK(status IN ('ativo', 'bloqueado', 'inativo')) DEFAULT 'ativo',
        consentimento_registrado INTEGER DEFAULT 1,
        created_by TEXT DEFAULT 'S. Carter (Admin)',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 3. Tabela face_embeddings (Vetores matemáticos 128D)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS face_embeddings (
        id TEXT PRIMARY KEY,
        pessoa_id TEXT NOT NULL,
        embedding TEXT NOT NULL,
        hash_128d TEXT,
        modelo_usado TEXT DEFAULT 'PyTorch/ResNet-18 (128D)',
        qualidade_imagem REAL DEFAULT 0.98,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pessoa_id) REFERENCES pessoas(id) ON DELETE CASCADE
    );
    """)

    # 4. Tabela cameras (Fontes de vídeo e streams)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS cameras (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        nome TEXT NOT NULL,
        tipo TEXT CHECK(tipo IN ('webcam', 'usb', 'ip', 'rtsp', 'onvif', 'simulated')) NOT NULL,
        localizacao TEXT NOT NULL,
        url_conexao TEXT NOT NULL,
        status TEXT CHECK(status IN ('ativo', 'inativo', 'alerta', 'lockdown')) DEFAULT 'ativo',
        resolution TEXT DEFAULT '1080p',
        fps INTEGER DEFAULT 60,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 5. Tabela reconhecimentos (Log de eventos de detecção e segurança)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS reconhecimentos (
        id TEXT PRIMARY KEY,
        pessoa_id TEXT,
        camera_id TEXT NOT NULL,
        confianca REAL DEFAULT 0.95,
        tipo_evento TEXT DEFAULT 'ID_MATCH',
        status_autorizacao TEXT DEFAULT 'Authorized',
        imagem_snapshot_url TEXT,
        detected_at TEXT DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT,
        FOREIGN KEY (pessoa_id) REFERENCES pessoas(id) ON DELETE SET NULL,
        FOREIGN KEY (camera_id) REFERENCES cameras(id) ON DELETE CASCADE
    );
    """)

    # 6. Tabela audit_logs (Trilha de auditoria administrativa e LGPD)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        acao TEXT NOT NULL,
        entidade TEXT NOT NULL,
        entidade_id TEXT,
        ip TEXT DEFAULT '127.0.0.1',
        user_agent TEXT DEFAULT 'SecureVision NPU Core',
        detalhes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 7. Tabela source_integrity_logs (Monitor de integridade de código)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS source_integrity_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT DEFAULT 'system',
        commit_hash TEXT,
        arquivo_alterado TEXT NOT NULL,
        acao_detectada TEXT NOT NULL,
        permitido INTEGER DEFAULT 1,
        motivo TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 8. Tabela system_state (Estado global e lockdown)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS system_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        lockdown_active INTEGER DEFAULT 0,
        vigilance_level TEXT DEFAULT 'High',
        fps_avg REAL DEFAULT 59.8,
        edge_gpu_usage INTEGER DEFAULT 82,
        active_streams INTEGER DEFAULT 4,
        total_streams INTEGER DEFAULT 4,
        processing_load INTEGER DEFAULT 42,
        active_anomalies INTEGER DEFAULT 1,
        frame_latency INTEGER DEFAULT 12,
        uptime REAL DEFAULT 99.9,
        files_scanned INTEGER DEFAULT 1482,
        last_check TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)

    conn.commit()
    seed_data(cursor)
    conn.commit()
    conn.close()
    print("[DB] Banco de dados SQLite SecureVision AI inicializado com sucesso.")

def seed_data(cursor):
    """Insere dados de demonstração idênticos ao design das imagens de referência."""
    # 1. System state
    cursor.execute("SELECT COUNT(*) FROM system_state WHERE id = 1;")
    if cursor.fetchone()[0] == 0:
        cursor.execute("""
        INSERT INTO system_state (
            id, lockdown_active, vigilance_level, fps_avg, edge_gpu_usage, 
            active_streams, total_streams, processing_load, active_anomalies, 
            frame_latency, uptime, files_scanned
        ) VALUES (1, 0, 'High', 59.8, 82, 4, 4, 42, 1, 12, 99.9, 1482);
        """)

    # 2. Usuário administrador
    cursor.execute("SELECT COUNT(*) FROM users_profiles;")
    if cursor.fetchone()[0] == 0:
        admin_id = str(uuid.uuid4())
        cursor.execute("""
        INSERT INTO users_profiles (id, user_id, nome, role, clearance_level, status)
        VALUES (?, 'admin_carter', 'S. Carter', 'admin', 'AUTII: Lvl 5', 'ativo');
        """, (admin_id,))

    # 3. Câmeras (4 câmeras das imagens)
    cursor.execute("SELECT COUNT(*) FROM cameras;")
    if cursor.fetchone()[0] == 0:
        cams = [
            ("cam_01", "CAM_01_LOBBY", "Main Lobby Entrance", "simulated", "Building A - Ground Floor", "sim://lobby", "ativo", "1080p", 60),
            ("cam_04", "CAM_04_EXTERIOR", "Exterior / Server Rm B", "simulated", "Building B - Perimeter", "sim://exterior", "alerta", "1080p", 60),
            ("cam_07", "CAM_07_DATACENTER", "Datacenter Vault", "simulated", "Sub-level 02 - Rack Row 4", "sim://datacenter", "ativo", "4K", 60),
            ("cam_02", "CAM_02_ENTRANCE", "Campus Turnstiles / Ext West", "simulated", "Main Plaza North Gate", "sim://entrance", "ativo", "1080p", 60),
        ]
        cursor.executemany("""
        INSERT INTO cameras (id, code, nome, tipo, localizacao, url_conexao, status, resolution, fps)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, cams)

    # 4. Pessoas cadastradas
    cursor.execute("SELECT COUNT(*) FROM pessoas;")
    if cursor.fetchone()[0] == 0:
        p1_id = "p_0492"
        p2_id = "p_9102"
        p3_id = "p_9942"
        p4_id = "p_unk4"

        def make_dummy_emb(seed_val):
            import random
            random.seed(seed_val)
            v = [random.gauss(0, 1) for _ in range(128)]
            norm = sum(x*x for x in v) ** 0.5
            return [x / norm for x in v]

        emb1 = make_dummy_emb(492)
        emb2 = make_dummy_emb(9102)
        emb3 = make_dummy_emb(9942)
        emb4 = make_dummy_emb(444)

        hash1 = hashlib.sha256(b"12345678901").hexdigest()
        hash2 = hashlib.sha256(b"98765432100").hexdigest()
        hash3 = hashlib.sha256(b"45678912300").hexdigest()
        hash4 = hashlib.sha256(b"00000000000").hexdigest()

        people = [
            (p1_id, "J. Smith (Eng)", 34, hash1, "123.***.***-01", "Engineering", "Level 3 (Senior)", "ativo", 1, "S. Carter (Admin)"),
            (p2_id, "A. Chan (Infra)", 29, hash2, "987.***.***-00", "IT Infrastructure", "Level 4 (Executive)", "ativo", 1, "S. Carter (Admin)"),
            (p3_id, "G. Rodriguez (Sec)", 41, hash3, "456.***.***-00", "Security", "Level 2 (Staff)", "ativo", 1, "S. Carter (Admin)"),
            (p4_id, "Unknown #4 (Suspect)", 0, hash4, "000.***.***-00", "Visitor", "Level 1 (Basic)", "bloqueado", 0, "Security System (Auto-flag)")
        ]
        cursor.executemany("""
        INSERT INTO pessoas (id, nome, idade, cpf_hash, cpf_mascarado, departamento, clearance_level, status, consentimento_registrado, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, people)

        embs = [
            (str(uuid.uuid4()), p1_id, json.dumps(emb1), "9a2f_4c1b", "PyTorch/ResNet-18 (128D)", 0.98),
            (str(uuid.uuid4()), p2_id, json.dumps(emb2), "3d8e_91fa", "PyTorch/ResNet-18 (128D)", 0.96),
            (str(uuid.uuid4()), p3_id, json.dumps(emb3), "7f1c_20ba", "PyTorch/ResNet-18 (128D)", 0.99),
            (str(uuid.uuid4()), p4_id, json.dumps(emb4), "ee41_a902", "PyTorch/ResNet-18 (128D)", 0.65),
        ]
        cursor.executemany("""
        INSERT INTO face_embeddings (id, pessoa_id, embedding, hash_128d, modelo_usado, qualidade_imagem)
        VALUES (?, ?, ?, ?, ?, ?);
        """, embs)

    # 5. Reconhecimentos iniciais (Live Security Log)
    cursor.execute("SELECT COUNT(*) FROM reconhecimentos;")
    if cursor.fetchone()[0] == 0:
        events = [
            (str(uuid.uuid4()), "p_0492", "cam_04", 0.38, "UNAUTHORIZED_PRESENCE", "Unauthorized", None, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), json.dumps({"note": "Facial recognition failed in Server Room B. Security dispatched.", "alert": True})),
            (str(uuid.uuid4()), "p_0492", "cam_01", 0.96, "ID_MATCH", "Authorized", None, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), json.dumps({"note": "J. Smith (ID: 0492) entered Main Lobby."})),
            (str(uuid.uuid4()), None, "cam_07", 0.99, "MODEL_UPDATED", "Authorized", None, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), json.dumps({"note": "Vision heuristics v4.2 deployed successfully across all nodes."})),
            (str(uuid.uuid4()), "p_9102", "cam_02", 0.92, "ID_MATCH", "Authorized", None, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), json.dumps({"note": "A. Chan (ID: 9102) entered Hallway C."})),
            (str(uuid.uuid4()), None, "cam_01", 1.0, "ROUTINE_SCAN", "Authorized", None, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), json.dumps({"note": "Routine scan completed. Zero anomalies detected in sector."})),
        ]
        cursor.executemany("""
        INSERT INTO reconhecimentos (id, pessoa_id, camera_id, confianca, tipo_evento, status_autorizacao, imagem_snapshot_url, detected_at, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, events)

    # 6. Logs de integridade de código iniciais
    cursor.execute("SELECT COUNT(*) FROM source_integrity_logs;")
    if cursor.fetchone()[0] == 0:
        int_logs = [
            (str(uuid.uuid4()), "system", "c89f2a", "kernel_sys.dll", "SHA-256 Verified", 1, "Signature match with secure baseline"),
            (str(uuid.uuid4()), "system", "c89f2a", "auth_module.so", "SHA-256 Verified", 1, "Signature match with secure baseline"),
            (str(uuid.uuid4()), "system", "c89f2a", "detector.py", "SHA-256 Verified", 1, "Module integrity OK"),
            (str(uuid.uuid4()), "system", "c89f2a", "search.py", "SHA-256 Verified", 1, "Module integrity OK"),
        ]
        cursor.executemany("""
        INSERT INTO source_integrity_logs (id, user_id, commit_hash, arquivo_alterado, acao_detectada, permitido, motivo)
        VALUES (?, ?, ?, ?, ?, ?, ?);
        """, int_logs)

    # 7. Audit logs iniciais
    cursor.execute("SELECT COUNT(*) FROM audit_logs;")
    if cursor.fetchone()[0] == 0:
        aud_logs = [
            (str(uuid.uuid4()), "S. Carter (Admin)", "SYSTEM_STARTUP", "NPU_CORE", "all", "127.0.0.1", "SecureVision Server", json.dumps({"status": "All 4 cameras initialized in multi-stream mode."})),
            (str(uuid.uuid4()), "S. Carter (Admin)", "ENROLL_SUBJECT", "pessoas", "p_0492", "127.0.0.1", "Web Client", json.dumps({"name": "J. Smith", "dept": "Engineering", "clearance": "Level 3"})),
            (str(uuid.uuid4()), "S. Carter (Admin)", "ENROLL_SUBJECT", "pessoas", "p_9102", "127.0.0.1", "Web Client", json.dumps({"name": "A. Chan", "dept": "IT Infrastructure", "clearance": "Level 4"})),
        ]
        cursor.executemany("""
        INSERT INTO audit_logs (id, user_id, acao, entidade, entidade_id, ip, user_agent, detalhes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?);
        """, aud_logs)

# --- Queries e Operações Auxiliares ---

def get_dashboard_stats():
    """Retorna estatísticas em tempo real para o cabeçalho e cards de System Status/Integrity."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM system_state WHERE id = 1;")
    state = dict(cursor.fetchone())

    cursor.execute("SELECT COUNT(*) FROM pessoas WHERE status = 'ativo';")
    state["active_subjects"] = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM pessoas;")
    state["total_subjects"] = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM reconhecimentos;")
    state["total_recognitions"] = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM reconhecimentos WHERE tipo_evento = 'UNAUTHORIZED_PRESENCE';")
    state["unauthorized_events"] = cursor.fetchone()[0]

    conn.close()
    return state

def get_cameras_list():
    """Retorna todas as câmeras cadastradas com informações de status."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM cameras ORDER BY code ASC;")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_recent_events(limit=15):
    """Retorna lista de reconhecimentos e eventos de segurança recentes."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT 
        r.id, r.detected_at, r.confianca, r.tipo_evento, r.status_autorizacao, r.metadata,
        c.code as camera_code, c.nome as camera_nome,
        p.id as pessoa_id, p.nome as pessoa_nome, p.cpf_mascarado, p.departamento, p.clearance_level, p.status as pessoa_status
    FROM reconhecimentos r
    LEFT JOIN cameras c ON r.camera_id = c.id
    LEFT JOIN pessoas p ON r.pessoa_id = p.id
    ORDER BY r.detected_at DESC, r.rowid DESC
    LIMIT ?;
    """, (limit,))
    rows = cursor.fetchall()
    conn.close()

    events = []
    for r in rows:
        meta = json.loads(r["metadata"]) if r["metadata"] else {}
        events.append({
            "id": r["id"],
            "detected_at": r["detected_at"],
            "confianca": r["confianca"],
            "tipo_evento": r["tipo_evento"],
            "status_autorizacao": r["status_autorizacao"],
            "camera_code": r["camera_code"] or "CAM_SYS",
            "camera_nome": r["camera_nome"] or "System Node",
            "pessoa_id": r["pessoa_id"],
            "pessoa_nome": r["pessoa_nome"] or ("Unknown Entity" if r["tipo_evento"] == "UNAUTHORIZED_PRESENCE" else "System"),
            "cpf_mascarado": r["cpf_mascarado"] or "N/A",
            "departamento": r["departamento"] or "General",
            "clearance_level": r["clearance_level"] or "N/A",
            "note": meta.get("note", ""),
            "alert": meta.get("alert", r["status_autorizacao"] == "Unauthorized")
        })
    return events

def get_all_persons():
    """Retorna lista de pessoas cadastradas."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT p.*, fe.hash_128d, fe.qualidade_imagem
    FROM pessoas p
    LEFT JOIN face_embeddings fe ON p.id = fe.pessoa_id
    ORDER BY p.created_at DESC;
    """)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_all_embeddings():
    """Retorna lista de embeddings ativos para re-identificação."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT fe.pessoa_id, p.nome, p.status, p.departamento, p.clearance_level, p.cpf_mascarado, fe.embedding, fe.hash_128d
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
            "departamento": row["departamento"],
            "clearance_level": row["clearance_level"],
            "cpf_mascarado": row["cpf_mascarado"],
            "hash_128d": row["hash_128d"],
            "embedding": json.loads(row["embedding"])
        })
    return embeddings

def register_person(nome, idade, cpf_mascarado, cpf_hash, departamento="Engineering", clearance_level="Level 1 (Basic)", embedding=None, foto_url=None, consentimento=True, created_by="S. Carter (Admin)"):
    """Cadastra uma nova entidade/pessoa e seu embedding."""
    conn = get_connection()
    cursor = conn.cursor()
    pessoa_id = f"p_{uuid.uuid4().hex[:6]}"

    try:
        cursor.execute("""
        INSERT INTO pessoas (id, nome, idade, cpf_hash, cpf_mascarado, departamento, clearance_level, foto_url, status, consentimento_registrado, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ativo', ?, ?);
        """, (pessoa_id, nome, idade, cpf_hash, cpf_mascarado, departamento, clearance_level, foto_url, 1 if consentimento else 0, created_by))

        if embedding is not None:
            emb_id = str(uuid.uuid4())
            hash_str = f"{uuid.uuid4().hex[:4]}_{uuid.uuid4().hex[:4]}"
            cursor.execute("""
            INSERT INTO face_embeddings (id, pessoa_id, embedding, hash_128d, modelo_usado, qualidade_imagem)
            VALUES (?, ?, ?, ?, 'PyTorch/ResNet-18 (128D)', 0.98);
            """, (emb_id, pessoa_id, json.dumps(embedding), hash_str))

        cursor.execute("""
        INSERT INTO audit_logs (id, user_id, acao, entidade, entidade_id, detalhes)
        VALUES (?, ?, 'ENROLL_SUBJECT', 'pessoas', ?, ?);
        """, (str(uuid.uuid4()), created_by, pessoa_id, json.dumps({"nome": nome, "cpf_mascarado": cpf_mascarado, "dept": departamento, "clearance": clearance_level})))

        conn.commit()
        return pessoa_id
    except sqlite3.IntegrityError:
        conn.rollback()
        raise ValueError("CPF duplicado: este documento já está cadastrado no sistema.")
    finally:
        conn.close()

def delete_person(pessoa_id, user_id="S. Carter (Admin)"):
    """Deleta o cadastro de uma pessoa e registra em auditoria."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT nome FROM pessoas WHERE id = ?;", (pessoa_id,))
    row = cursor.fetchone()
    nome = row["nome"] if row else "Desconhecido"

    cursor.execute("DELETE FROM pessoas WHERE id = ?;", (pessoa_id,))
    cursor.execute("""
    INSERT INTO audit_logs (id, user_id, acao, entidade, entidade_id, detalhes)
    VALUES (?, ?, 'DELETE_SUBJECT', 'pessoas', ?, ?);
    """, (str(uuid.uuid4()), user_id, pessoa_id, json.dumps({"nome": nome})))

    conn.commit()
    conn.close()

def toggle_emergency_lockdown(user_id="S. Carter (Admin)"):
    """Ativa ou desativa o modo de Emergency Lockdown no sistema."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT lockdown_active FROM system_state WHERE id = 1;")
    current = cursor.fetchone()[0]
    new_state = 1 if current == 0 else 0

    cursor.execute("""
    UPDATE system_state 
    SET lockdown_active = ?, vigilance_level = ?, active_anomalies = ?
    WHERE id = 1;
    """, (new_state, 'MAXIMUM_LOCKDOWN' if new_state == 1 else 'High', 9 if new_state == 1 else 1))

    # Atualiza status das câmeras
    new_cam_status = 'lockdown' if new_state == 1 else 'ativo'
    cursor.execute("UPDATE cameras SET status = ?;", (new_cam_status,))
    if new_state == 0:
        cursor.execute("UPDATE cameras SET status = 'alerta' WHERE code = 'CAM_04_EXTERIOR';")

    acao = "EMERGENCY_LOCKDOWN_ACTIVATED" if new_state == 1 else "EMERGENCY_LOCKDOWN_CLEARED"
    cursor.execute("""
    INSERT INTO audit_logs (id, user_id, acao, entidade, entidade_id, detalhes)
    VALUES (?, ?, ?, 'system_state', '1', ?);
    """, (str(uuid.uuid4()), user_id, acao, json.dumps({"lockdown": bool(new_state)})))

    conn.commit()
    conn.close()
    return bool(new_state)

def log_recognition(camera_id, pessoa_id, confianca, tipo_evento="ID_MATCH", status_autorizacao="Authorized", snapshot_url=None, metadata=None):
    """Registra uma detecção no banco de dados."""
    conn = get_connection()
    cursor = conn.cursor()
    rec_id = str(uuid.uuid4())
    meta_str = json.dumps(metadata) if metadata else None

    cursor.execute("""
    INSERT INTO reconhecimentos (id, pessoa_id, camera_id, confianca, tipo_evento, status_autorizacao, imagem_snapshot_url, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    """, (rec_id, pessoa_id, camera_id, confianca, tipo_evento, status_autorizacao, snapshot_url, meta_str))

    conn.commit()
    conn.close()
    return rec_id

def add_audit_log(user_id, acao, entidade, entidade_id=None, detalhes=None, ip="127.0.0.1", user_agent="SecureVision Server"):
    """Insere um novo log de auditoria no banco."""
    conn = get_connection()
    cursor = conn.cursor()
    detalhes_str = json.dumps(detalhes) if isinstance(detalhes, (dict, list)) else detalhes
    cursor.execute("""
    INSERT INTO audit_logs (id, user_id, acao, entidade, entidade_id, ip, user_agent, detalhes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    """, (str(uuid.uuid4()), user_id, acao, entidade, entidade_id, ip, user_agent, detalhes_str))
    conn.commit()
    conn.close()

def get_audit_logs(limit=50):
    """Retorna logs de auditoria."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?;", (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_integrity_logs(limit=50):
    """Retorna logs de integridade do código-fonte."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM source_integrity_logs ORDER BY created_at DESC LIMIT ?;", (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

if __name__ == "__main__":
    init_db(force_recreate=True)
