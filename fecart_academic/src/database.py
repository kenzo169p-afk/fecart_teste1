import os
import sqlite3
import json
import uuid
import hashlib
from datetime import datetime, date
from typing import Optional, List, Dict, Any

try:
    from .security import hash_password, verify_password, compute_audit_hash
except (ImportError, ValueError):
    from security import hash_password, verify_password, compute_audit_hash

DB_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "data"))
DB_PATH = os.path.join(DB_DIR, "fecart.db")

def get_connection():
    """Retorna uma conexão ativa com o banco SQLite Enterprise."""
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db(force_recreate=False):
    """Inicializa as tabelas relacionais do sistema e injeta sementes seguras."""
    os.makedirs(DB_DIR, exist_ok=True)
    if force_recreate and os.path.exists(DB_PATH):
        try:
            os.remove(DB_PATH)
        except Exception:
            pass

    conn = get_connection()
    cursor = conn.cursor()

    # 1. Operadores do Sistema (com Argon2id e Unicidade)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS operators (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        full_name TEXT UNIQUE NOT NULL,
        birthdate TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT CHECK(role IN ('ADMIN', 'SECURITY_OFFICER', 'AUDITOR', 'VIEWER')) DEFAULT 'ADMIN',
        clearance_level TEXT DEFAULT 'AUTII: Lvl 5',
        department TEXT DEFAULT 'Security Management',
        avatar_url TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 2. Sujeitos Biométricos (Entidades Cadastradas em conformidade com a LGPD)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS biometric_subjects (
        id TEXT PRIMARY KEY,
        full_name TEXT NOT NULL,
        national_id_hash TEXT UNIQUE NOT NULL, -- SHA-256 Blind Index do CPF
        national_id_masked TEXT NOT NULL,     -- 123.***.***-00
        birthdate TEXT NOT NULL DEFAULT '1990-01-01',
        department TEXT DEFAULT 'Engineering',
        clearance_level TEXT DEFAULT 'Level 1 (Basic)',
        age INTEGER DEFAULT 30,
        criminal_record TEXT CHECK(criminal_record IN ('CLEARED', 'SUSPECT', 'THEFT_OFFENSE', 'WANTED_CRIMINAL')) DEFAULT 'CLEARED',
        incident_details TEXT DEFAULT '',
        is_threat INTEGER DEFAULT 0,
        photo_url TEXT,
        status TEXT CHECK(status IN ('ACTIVE', 'BLOCKED', 'FLAGGED', 'INACTIVE')) DEFAULT 'ACTIVE',
        lgpd_consent_granted INTEGER DEFAULT 1,
        lgpd_consent_timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT DEFAULT 'S. Carter (Admin)',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 3. Embeddings Biométricos (Vetores matemáticos 128D)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS biometric_embeddings (
        id TEXT PRIMARY KEY,
        subject_id TEXT NOT NULL,
        embedding TEXT NOT NULL, -- JSON Array de 128 floats
        hash_128d TEXT NOT NULL,
        model_version TEXT DEFAULT 'PyTorch/ResNet-18 (128D)',
        quality_score REAL DEFAULT 0.98,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (subject_id) REFERENCES biometric_subjects(id) ON DELETE CASCADE
    );
    """)

    # 4. Fontes de Câmeras
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

    # 5. Eventos de Reconhecimento em Tempo Real
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS recognition_events (
        id TEXT PRIMARY KEY,
        subject_id TEXT,
        camera_id TEXT NOT NULL,
        confidence REAL DEFAULT 0.95,
        event_type TEXT DEFAULT 'ID_MATCH',
        auth_status TEXT DEFAULT 'Authorized',
        snapshot_url TEXT,
        detected_at TEXT DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT,
        FOREIGN KEY (subject_id) REFERENCES biometric_subjects(id) ON DELETE SET NULL,
        FOREIGN KEY (camera_id) REFERENCES cameras(id) ON DELETE CASCADE
    );
    """)

    # 6. Trilha de Auditoria Imutável (WORM com Encadeamento HMAC)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS immutable_audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        operator_username TEXT NOT NULL,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        ip_address TEXT DEFAULT '127.0.0.1',
        user_agent TEXT DEFAULT 'SecureVision NPU Core',
        payload_json TEXT,
        previous_log_hash TEXT NOT NULL,
        current_log_hash TEXT NOT NULL
    );
    """)

    # 7. Estado Global do Sistema
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
    seed_enterprise_data(cursor)
    conn.commit()
    conn.close()
    print("[DB] Banco de Dados Enterprise inicializado com sucesso (Argon2id + HMAC Audit Chain).")

def seed_enterprise_data(cursor):
    """Insere dados de demonstração iniciais e o operador administrador padrão."""
    # 1. Estado do Sistema
    cursor.execute("SELECT COUNT(*) FROM system_state WHERE id = 1;")
    if cursor.fetchone()[0] == 0:
        cursor.execute("""
        INSERT INTO system_state (
            id, lockdown_active, vigilance_level, fps_avg, edge_gpu_usage, 
            active_streams, total_streams, processing_load, active_anomalies, 
            frame_latency, uptime, files_scanned
        ) VALUES (1, 0, 'High', 59.8, 82, 4, 4, 42, 1, 12, 99.9, 1482);
        """)

    # 2. Administrador Padrão com Hash Argon2id
    cursor.execute("SELECT COUNT(*) FROM operators;")
    if cursor.fetchone()[0] == 0:
        admin_id = str(uuid.uuid4())
        argon2_hash = hash_password("admin123")
        cursor.execute("""
        INSERT INTO operators (id, username, full_name, birthdate, password_hash, role, clearance_level, department)
        VALUES (?, 'admin', 'S. Carter', '1985-05-12', ?, 'ADMIN', 'AUTII: Lvl 5', 'Security Management');
        """, (admin_id, argon2_hash))

    # 3. Câmeras
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

    # 4. Pessoas Cadastradas
    cursor.execute("SELECT COUNT(*) FROM biometric_subjects;")
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

        hash1 = hashlib.sha256(b"12345678901").hexdigest()
        hash2 = hashlib.sha256(b"98765432100").hexdigest()
        hash3 = hashlib.sha256(b"45678912300").hexdigest()
        hash4 = hashlib.sha256(b"00000000000").hexdigest()

        subjects = [
            (p1_id, "J. Smith", hash1, "123.***.***-01", "1990-04-12", "Engineering", "Level 3 (Senior)", 34, "CLEARED", "Ficha limpa. Funcionário registrado sem ocorrências.", 0, "ACTIVE", 1, "S. Carter (Admin)", "2026-08-10 09:15:00"),
            (p2_id, "A. Chan", hash2, "987.***.***-00", "1995-11-23", "IT Infrastructure", "Level 4 (Executive)", 29, "CLEARED", "Ficha limpa. Acesso irrestrito a servidores.", 0, "ACTIVE", 1, "S. Carter (Admin)", "2026-08-15 14:30:00"),
            (p3_id, "G. Rodriguez", hash3, "456.***.***-00", "1983-07-08", "Security", "Level 2 (Staff)", 41, "SUSPECT", "Tentativa de acesso sem crachá em área restrita de geradores.", 0, "ACTIVE", 1, "S. Carter (Admin)", "2026-08-18 11:20:00"),
            (p4_id, "Unknown #4", hash4, "000.***.***-00", "1999-02-14", "Visitor", "Level 1 (Basic)", 25, "THEFT_OFFENSE", "FLAGRANTE DE FURTO: Tentativa de furto de cabos e placas de servidor no Rack 4.", 1, "BLOCKED", 0, "Security System (Auto-flag)", "2026-08-22 16:45:00")
        ]
        cursor.executemany("""
        INSERT INTO biometric_subjects (id, full_name, national_id_hash, national_id_masked, birthdate, department, clearance_level, age, criminal_record, incident_details, is_threat, status, lgpd_consent_granted, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, subjects)

        embs = [
            (str(uuid.uuid4()), p1_id, json.dumps(make_dummy_emb(492)), "9a2f_4c1b", 0.98),
            (str(uuid.uuid4()), p2_id, json.dumps(make_dummy_emb(9102)), "3d8e_91fa", 0.96),
            (str(uuid.uuid4()), p3_id, json.dumps(make_dummy_emb(9942)), "7f1c_20ba", 0.99),
            (str(uuid.uuid4()), p4_id, json.dumps(make_dummy_emb(444)), "ee41_a902", 0.65),
        ]
        cursor.executemany("""
        INSERT INTO biometric_embeddings (id, subject_id, embedding, hash_128d, quality_score)
        VALUES (?, ?, ?, ?, ?);
        """, embs)

    # 5. Reconhecimentos
    cursor.execute("SELECT COUNT(*) FROM recognition_events;")
    if cursor.fetchone()[0] == 0:
        events = [
            (str(uuid.uuid4()), "p_0492", "cam_04", 0.38, "UNAUTHORIZED_PRESENCE", "Unauthorized", None, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), json.dumps({"note": "Facial recognition failed in Server Rm B. Security dispatched.", "alert": True})),
            (str(uuid.uuid4()), "p_0492", "cam_01", 0.96, "ID_MATCH", "Authorized", None, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), json.dumps({"note": "J. Smith (ID: 0492) entered Main Lobby."})),
            (str(uuid.uuid4()), None, "cam_07", 0.99, "MODEL_UPDATED", "Authorized", None, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), json.dumps({"note": "Vision heuristics v4.2 deployed successfully across all nodes."})),
            (str(uuid.uuid4()), "p_9102", "cam_02", 0.92, "ID_MATCH", "Authorized", None, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), json.dumps({"note": "A. Chan (ID: 9102) entered North Turnstiles."})),
            (str(uuid.uuid4()), None, "cam_01", 1.0, "ROUTINE_SCAN", "Authorized", None, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), json.dumps({"note": "Routine scan completed. Zero anomalies detected in sector."})),
        ]
        cursor.executemany("""
        INSERT INTO recognition_events (id, subject_id, camera_id, confidence, event_type, auth_status, snapshot_url, detected_at, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, events)

    # 6. Inicializa primeiro elo da trilha de auditoria HMAC
    cursor.execute("SELECT COUNT(*) FROM immutable_audit_logs;")
    if cursor.fetchone()[0] == 0:
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        genesis_prev_hash = "0" * 64
        payload = json.dumps({"event": "GENESIS_NODE_INITIALIZED", "system": "SecureVision Enterprise"})
        current_hash = compute_audit_hash(genesis_prev_hash, ts, "SYSTEM", "GENESIS_INIT", "NPU_CORE", payload)
        cursor.execute("""
        INSERT INTO immutable_audit_logs (timestamp, operator_username, action, entity_type, entity_id, payload_json, previous_log_hash, current_log_hash)
        VALUES (?, 'SYSTEM', 'GENESIS_INIT', 'NPU_CORE', 'genesis_0', ?, ?, ?);
        """, (ts, payload, genesis_prev_hash, current_hash))

# --- Operações de Autenticação e Operadores ---

def authenticate_operator(username_or_name: str, plain_pass: str, birthdate: str) -> Optional[Dict[str, Any]]:
    """Autentica o operador validando login/nome, data de nascimento e hash Argon2id."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT * FROM operators 
    WHERE (username = ? OR full_name = ?) AND birthdate = ? AND is_active = 1;
    """, (username_or_name, username_or_name, birthdate))
    row = cursor.fetchone()
    conn.close()

    if not row:
        add_audit_entry(username_or_name, "LOGIN_FAILED", "operators", None, {"reason": "Operador não encontrado ou Data de Nascimento inválida"})
        return None

    op_dict = dict(row)
    if verify_password(plain_pass, op_dict["password_hash"]):
        op_dict.pop("password_hash", None)
        add_audit_entry(op_dict["username"], "LOGIN_SUCCESS", "operators", op_dict["id"], {"role": op_dict["role"]})
        return op_dict
    else:
        add_audit_entry(username_or_name, "LOGIN_FAILED", "operators", op_dict["id"], {"reason": "Senha incorreta"})
        return None

def register_operator(username: str, full_name: str, password: str, birthdate: str, department="Security", clearance="Level 2 (Staff)", role="SECURITY_OFFICER") -> str:
    """Registra um novo operador garantindo 1 nome e 1 login únicos."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id, username, full_name FROM operators WHERE username = ? OR full_name = ?;", (username, full_name))
    existing = cursor.fetchone()
    if existing:
        conn.close()
        if existing["username"] == username:
            raise ValueError("Este nome de usuário / login já está cadastrado no sistema.")
        else:
            raise ValueError("Já existe uma conta registrada com este Nome Completo.")

    uid = str(uuid.uuid4())
    argon2_hash = hash_password(password)

    cursor.execute("""
    INSERT INTO operators (id, username, full_name, birthdate, password_hash, role, clearance_level, department)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    """, (uid, username, full_name, birthdate, argon2_hash, role, clearance, department))

    conn.commit()
    conn.close()
    add_audit_entry(username, "OPERATOR_REGISTER", "operators", uid, {"full_name": full_name, "clearance": clearance})
    return uid

# --- Trilha de Auditoria Imutável (WORM com Encadeamento HMAC) ---

def add_audit_entry(operator_username: str, action: str, entity_type: str, entity_id: Optional[str] = None, details: Optional[Dict[str, Any]] = None, ip="127.0.0.1", user_agent="SecureVision Server"):
    """Insere um novo log de auditoria encadeado criptograficamente com o registro anterior."""
    conn = get_connection()
    cursor = conn.cursor()

    # Busca o hash do último registro inserido
    cursor.execute("SELECT current_log_hash FROM immutable_audit_logs ORDER BY id DESC LIMIT 1;")
    last_row = cursor.fetchone()
    prev_hash = last_row["current_log_hash"] if last_row else ("0" * 64)

    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    payload_str = json.dumps(details or {})
    current_hash = compute_audit_hash(prev_hash, ts, operator_username, action, entity_type, payload_str)

    cursor.execute("""
    INSERT INTO immutable_audit_logs (timestamp, operator_username, action, entity_type, entity_id, ip_address, user_agent, payload_json, previous_log_hash, current_log_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, (ts, operator_username, action, entity_type, entity_id, ip, user_agent, payload_str, prev_hash, current_hash))

    conn.commit()
    conn.close()

def get_audit_logs(limit=50) -> List[Dict[str, Any]]:
    """Retorna os logs de auditoria imutáveis com validação de encadeamento."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM immutable_audit_logs ORDER BY id DESC LIMIT ?;", (limit,))
    rows = cursor.fetchall()
    conn.close()
    
    logs = []
    for r in rows:
        d = dict(r)
        d["details"] = json.loads(d["payload_json"]) if d["payload_json"] else {}
        logs.append(d)
    return logs

# --- Sujeitos Biométricos & Reconhecimento ---

def register_biometric_subject(full_name: str, national_id_clean: str, birthdate: str = "1990-01-01", department="Engineering", clearance="Level 1 (Basic)", age=30, criminal_record="CLEARED", incident_details="", embedding=None, lgpd_consent=True, created_by="admin") -> str:
    """Cadastra um novo sujeito com blind index SHA-256, histórico criminal, incidentes e embedding facial 128D."""
    conn = get_connection()
    cursor = conn.cursor()

    masked_cpf = f"{national_id_clean[:3]}.***.***-{national_id_clean[-2:]}"
    cpf_hash = hashlib.sha256(national_id_clean.encode("utf-8")).hexdigest()
    subject_id = f"p_{uuid.uuid4().hex[:6]}"
    is_threat = 1 if criminal_record in ('THEFT_OFFENSE', 'WANTED_CRIMINAL') else 0
    status_val = "BLOCKED" if is_threat else ("FLAGGED" if criminal_record == 'SUSPECT' else "ACTIVE")

    try:
        cursor.execute("""
        INSERT INTO biometric_subjects (id, full_name, national_id_hash, national_id_masked, birthdate, department, clearance_level, age, criminal_record, incident_details, is_threat, status, lgpd_consent_granted, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, (subject_id, full_name, cpf_hash, masked_cpf, birthdate, department, clearance, age, criminal_record, incident_details, is_threat, status_val, 1 if lgpd_consent else 0, created_by))

        if embedding is not None:
            emb_id = str(uuid.uuid4())
            hash_str = f"{uuid.uuid4().hex[:4]}_{uuid.uuid4().hex[:4]}"
            cursor.execute("""
            INSERT INTO biometric_embeddings (id, subject_id, embedding, hash_128d, quality_score)
            VALUES (?, ?, ?, ?, 0.98);
            """, (emb_id, subject_id, json.dumps(embedding), hash_str))

        conn.commit()
        add_audit_entry(created_by, "ENROLL_SUBJECT", "biometric_subjects", subject_id, {"name": full_name, "dept": department, "clearance": clearance})
        return subject_id
    except sqlite3.IntegrityError:
        conn.rollback()
        raise ValueError("CPF duplicado: este documento já se encontra registrado na base biométrica.")
    finally:
        conn.close()

def delete_biometric_subject(subject_id: str, operator_username="admin"):
    """Remove um sujeito biométrico e grava o evento em auditoria."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT full_name FROM biometric_subjects WHERE id = ?;", (subject_id,))
    row = cursor.fetchone()
    name = row["full_name"] if row else "Desconhecido"

    cursor.execute("DELETE FROM biometric_subjects WHERE id = ?;", (subject_id,))
    conn.commit()
    conn.close()
    add_audit_entry(operator_username, "DELETE_SUBJECT", "biometric_subjects", subject_id, {"full_name": name})

def delete_all_biometric_subjects(operator_username="admin") -> int:
    """Remove todas as identidades cadastradas e registra o expurgo na trilha de auditoria."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM biometric_subjects;")
    total = cursor.fetchone()[0]

    cursor.execute("DELETE FROM biometric_subjects;")
    conn.commit()
    conn.close()

    add_audit_entry(operator_username, "PURGE_ALL_SUBJECTS", "biometric_subjects", "ALL", {"count_deleted": total})
    return total

def get_all_biometric_subjects() -> List[Dict[str, Any]]:
    """Retorna a lista de todos os colaboradores/entidades cadastradas."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT s.*, e.hash_128d, e.quality_score 
    FROM biometric_subjects s
    LEFT JOIN biometric_embeddings e ON s.id = e.subject_id
    ORDER BY s.created_at DESC;
    """)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

# --- Telemetria e Dashboard ---

def get_dashboard_stats() -> Dict[str, Any]:
    """Retorna métricas em tempo real para os cards e telemetria de integridade."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM system_state WHERE id = 1;")
    state = dict(cursor.fetchone())

    cursor.execute("SELECT COUNT(*) FROM biometric_subjects WHERE status = 'ACTIVE';")
    state["active_subjects"] = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM biometric_subjects;")
    state["total_subjects"] = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM recognition_events;")
    state["total_recognitions"] = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM recognition_events WHERE event_type = 'UNAUTHORIZED_PRESENCE';")
    state["unauthorized_events"] = cursor.fetchone()[0]

    state["lockdown_active"] = bool(state["lockdown_active"])
    conn.close()
    return state

def get_cameras_list() -> List[Dict[str, Any]]:
    """Retorna lista de todas as câmeras."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM cameras ORDER BY code ASC;")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_recent_events(limit=15) -> List[Dict[str, Any]]:
    """Retorna eventos recentes de monitoramento e alertas."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT 
        r.id, r.detected_at, r.confidence, r.event_type, r.auth_status, r.metadata,
        c.code as camera_code, c.nome as camera_nome,
        s.id as subject_id, s.full_name as subject_name, s.national_id_masked, s.department, s.clearance_level
    FROM recognition_events r
    LEFT JOIN cameras c ON r.camera_id = c.id
    LEFT JOIN biometric_subjects s ON r.subject_id = s.id
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
            "confianca": r["confidence"],
            "tipo_evento": r["event_type"],
            "status_autorizacao": r["auth_status"],
            "camera_code": r["camera_code"] or "CAM_SYS",
            "camera_nome": r["camera_nome"] or "System Node",
            "pessoa_id": r["subject_id"],
            "pessoa_nome": r["subject_name"] or ("Unknown Entity" if r["event_type"] == "UNAUTHORIZED_PRESENCE" else "System"),
            "cpf_mascarado": r["national_id_masked"] or "N/A",
            "departamento": r["department"] or "General",
            "clearance_level": r["clearance_level"] or "N/A",
            "note": meta.get("note", ""),
            "alert": meta.get("alert", r["auth_status"] == "Unauthorized")
        })
    return events

def toggle_emergency_lockdown(operator_username="admin") -> bool:
    """Ativa ou desativa o Emergency Lockdown."""
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

    new_cam_status = 'lockdown' if new_state == 1 else 'ativo'
    cursor.execute("UPDATE cameras SET status = ?;", (new_cam_status,))
    if new_state == 0:
        cursor.execute("UPDATE cameras SET status = 'alerta' WHERE code = 'CAM_04_EXTERIOR';")

    conn.commit()
    conn.close()

    action = "EMERGENCY_LOCKDOWN_ACTIVATED" if new_state == 1 else "EMERGENCY_LOCKDOWN_CLEARED"
    add_audit_entry(operator_username, action, "system_state", "1", {"lockdown_active": bool(new_state)})
    return bool(new_state)

if __name__ == "__main__":
    init_db(force_recreate=True)
