import os
import time
import hmac
import hashlib
import jwt
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHashError

# Configuração Criptográfica de Nível Enterprise
JWT_SECRET = os.getenv("JWT_SECRET_KEY", "securevision-npu-enterprise-secret-key-32-chars-min!")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60  # 1 hora
HMAC_AUDIT_SECRET = os.getenv("HMAC_AUDIT_KEY", "securevision-audit-chain-secret-key-2026!").encode("utf-8")

# Hasher Argon2id (Parâmetros RFC 9106 recomendados para ambiente Enterprise)
ph = PasswordHasher(
    time_cost=3,          # 3 iterações
    memory_cost=65536,    # 64 MB
    parallelism=4,        # 4 threads
    hash_len=32,
    salt_len=16
)

def hash_password(password: str) -> str:
    """Gera hash seguro da senha utilizando Argon2id."""
    return ph.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica a senha contra o hash Argon2id com proteção contra timing attack."""
    try:
        return ph.verify(hashed_password, plain_password)
    except (VerifyMismatchError, InvalidHashError):
        return False

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Gera um JWT assinado com claims de segurança e expiração estrita."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    
    to_encode.update({
        "exp": expire,
        "iat": now,
        "iss": "securevision-npu-core",
        "jti": hashlib.sha256(f"{now.timestamp()}-{data.get('sub')}".encode()).hexdigest()[:16]
    })
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decodifica e valida assinatura e expiração do JWT."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM], issuer="securevision-npu-core")
        return payload
    except jwt.PyJWTError:
        return None

def compute_audit_hash(prev_hash: str, timestamp: str, operator_id: str, action: str, entity: str, payload_str: str) -> str:
    """
    Calcula HMAC-SHA256 para encadeamento imutável de logs de auditoria (Blockchain-like WORM).
    Garante que nenhum registro de auditoria possa ser alterado retroativamente.
    """
    record_content = f"{prev_hash}|{timestamp}|{operator_id}|{action}|{entity}|{payload_str}".encode("utf-8")
    return hmac.new(HMAC_AUDIT_SECRET, record_content, hashlib.sha256).hexdigest()
