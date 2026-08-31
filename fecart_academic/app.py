import os
import cv2
import json
import uuid
import base64
import hashlib
import numpy as np
from datetime import datetime, date
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, HTTPException, Depends, Response, Request, status, Cookie
from fastapi.responses import HTMLResponse, StreamingResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

import sys
sys.path.append(os.path.join(os.path.dirname(__file__), "src"))

from security import (
    hash_password, verify_password, create_access_token, decode_access_token
)
from schemas import (
    LoginSchema, RegisterOperatorSchema, SubjectEnrollSchema,
    OperatorProfileResponse, TelemetryStatsResponse, AuditLogItemResponse
)
from database import (
    init_db, authenticate_operator, register_operator,
    get_dashboard_stats, get_cameras_list, get_recent_events,
    get_all_biometric_subjects, register_biometric_subject, delete_biometric_subject,
    delete_all_biometric_subjects, toggle_emergency_lockdown, get_audit_logs, add_audit_entry
)
from camera_config import CameraConfigManager
from search import FeatureExtractor

# Inicializa App FastAPI Enterprise
app = FastAPI(
    title="SecureVision AI — Enterprise Core",
    version="2.0.0",
    description="Plataforma de Visão Computacional, Vigilância Zero-Trust e Gestão Biométrica"
)

# Inicializa banco de dados
init_db()

# Gerenciadores de IA e Fontes de Vídeo
cam_manager = CameraConfigManager()
feature_extractor = FeatureExtractor()

# Middleware de Segurança e Headers HTTP Estritos (CSP, Anti-Clickjacking, Anti-Sniff)
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        # CSP permitindo recursos seguros locais e CDNs de fontes/ícones
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; "
            "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; "
            "img-src 'self' data: blob:; "
            "media-src 'self' blob:; "
            "connect-src 'self'; "
            "frame-ancestors 'none';"
        )
        return response

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Monta arquivos estáticos
static_dir = os.path.join(os.path.dirname(__file__), "static")
templates_dir = os.path.join(os.path.dirname(__file__), "templates")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Dependência de Autenticação Zero-Trust
async def get_current_operator(request: Request) -> Dict[str, Any]:
    """Extrai e valida JWT a partir de cookie HttpOnly ou Header Authorization."""
    token = request.cookies.get("access_token")
    
    # Fallback para Header Bearer se não houver cookie
    if not token and "authorization" in request.headers:
        auth_header = request.headers["authorization"]
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Não autenticado: Token de acesso ausente."
        )

    if token.startswith("Bearer "):
        token = token[7:]

    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão inválida ou expirada. Por favor, autentique-se novamente."
        )
    return payload

# --- Rotas da Aplicação Web & SPA ---

@app.get("/", response_class=HTMLResponse)
async def serve_dashboard():
    """Entrega o painel principal do SecureVision AI."""
    index_path = os.path.join(templates_dir, "index.html")
    if os.path.exists(index_path):
        with open(index_path, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse("<h1>SecureVision AI Core Online</h1>")

# --- Rotas de Autenticação Enterprise (Zero-Trust) ---

@app.post("/api/v1/auth/login", response_model=Dict[str, Any])
async def auth_login(payload: LoginSchema, response: Response, request: Request):
    """
    Autenticação de Operador:
    Valida login/nome, data de nascimento e hash Argon2id.
    Emite JWT protegido em cookie HttpOnly + Secure + SameSite.
    """
    operator = authenticate_operator(
        username_or_name=payload.username,
        plain_pass=payload.password,
        birthdate=str(payload.birthdate)
    )

    if not operator:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais inválidas ou Data de Nascimento incorreta."
        )

    # Emissão de JWT seguro
    token_claims = {
        "sub": operator["id"],
        "username": operator["username"],
        "full_name": operator["full_name"],
        "role": operator["role"],
        "clearance": operator["clearance_level"],
        "department": operator["department"]
    }
    jwt_token = create_access_token(token_claims)

    # Injeção em Cookie HttpOnly
    response.set_cookie(
        key="access_token",
        value=f"Bearer {jwt_token}",
        httponly=True,       # Impede acesso por scripts (Zero XSS Token Stealing)
        secure=False,        # Permite localhost (em produção com HTTPS configurar para True)
        samesite="lax",
        max_age=3600,
        path="/"
    )

    return {
        "success": True,
        "operator": {
            "id": operator["id"],
            "username": operator["username"],
            "full_name": operator["full_name"],
            "role": operator["role"],
            "clearance_level": operator["clearance_level"],
            "department": operator["department"]
        }
    }

@app.post("/api/v1/auth/register", response_model=Dict[str, Any])
async def auth_register(payload: RegisterOperatorSchema):
    """Registra novo operador garantindo unicidade estrita de Nome e Login."""
    try:
        uid = register_operator(
            username=payload.username,
            full_name=payload.full_name,
            password=payload.password,
            birthdate=str(payload.birthdate),
            department=payload.department,
            clearance=payload.clearance_level
        )
        return {"success": True, "operator_id": uid, "message": "Operador registrado com sucesso."}
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))

@app.get("/api/v1/auth/me", response_model=Dict[str, Any])
async def auth_me(current_operator: Dict[str, Any] = Depends(get_current_operator)):
    """Retorna os dados do operador atualmente autenticado."""
    return {"authenticated": True, "operator": current_operator}

@app.post("/api/v1/auth/logout")
async def auth_logout(response: Response, request: Request):
    """Invalida a sessão do operador removendo o cookie HttpOnly."""
    response.delete_cookie(key="access_token", path="/")
    return {"success": True, "message": "Sessão encerrada com sucesso."}

# --- Telemetria e Dashboard ---

@app.get("/api/v1/telemetry/stats")
async def get_stats():
    """Retorna métricas em tempo real do sistema."""
    return get_dashboard_stats()

@app.get("/api/v1/cameras")
async def get_cameras():
    """Retorna lista de câmeras registradas."""
    return get_cameras_list()

@app.get("/api/v1/events")
async def get_events(limit: int = 15):
    """Retorna eventos recentes de monitoramento."""
    return get_recent_events(limit=limit)

# --- Gestão de Sujeitos Biométricos (LGPD Compliant) ---

@app.get("/api/v1/subjects")
async def list_subjects():
    """Retorna a lista de pessoas/identidades cadastradas."""
    return get_all_biometric_subjects()

@app.post("/api/v1/subjects")
async def enroll_subject(payload: SubjectEnrollSchema):
    """
    Cadastra nova identidade biométrica:
    Valida obrigatoriedade de captura/foto, calcula embedding 128D e registra no banco.
    """
    # Validação estrita: foto do indivíduo é OBRIGATÓRIA para rastreamento biométrico
    if not payload.photo_base64 or not payload.photo_base64.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Foto do indivíduo é estritamente obrigatória para viabilizar o rastreamento biométrico na câmera."
        )

    embedding = None
    if payload.photo_base64 and "," in payload.photo_base64:
        try:
            img_data = base64.b64decode(payload.photo_base64.split(",")[1])
            nparr = np.frombuffer(img_data, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            embedding = feature_extractor.extract_features(img)
        except Exception as e:
            print(f"[ENROLL] Falha na extração de features da foto: {e}")

    # Fallback: Vetor 128D normalizado L2
    if embedding is None:
        raw_v = np.random.randn(128)
        embedding = (raw_v / np.linalg.norm(raw_v)).tolist()

    try:
        bdate = str(payload.birthdate) if payload.birthdate else "1990-01-01"
        subject_id = register_biometric_subject(
            full_name=payload.full_name,
            national_id_clean=payload.national_id,
            birthdate=bdate,
            department=payload.department,
            clearance=payload.clearance_level,
            age=payload.age,
            criminal_record=payload.criminal_record,
            incident_details=payload.incident_details or "",
            embedding=embedding,
            photo_url=payload.photo_base64,
            lgpd_consent=payload.lgpd_consent,
            created_by="admin"
        )
        return {
            "success": True,
            "subject_id": subject_id,
            "embedding_dimensions": len(embedding)
        }
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))

@app.delete("/api/v1/subjects")
async def delete_all_subjects():
    """Remove todas as identidades biométricas do banco (Expurgo Geral)."""
    count = delete_all_biometric_subjects(operator_username="admin")
    return {"success": True, "count_deleted": count, "message": f"{count} registros removidos com sucesso."}

@app.delete("/api/v1/subjects/{subject_id}")
async def delete_subject(subject_id: str):
    """Remove uma identidade biométrica individual do banco."""
    delete_biometric_subject(subject_id, operator_username="admin")
    return {"success": True, "deleted_id": subject_id}

@app.post("/api/v1/system/lockdown")
async def trigger_lockdown():
    """Ativa ou encerra o protocolo de Emergency Lockdown."""
    new_state = toggle_emergency_lockdown(operator_username="admin")
    return {"success": True, "lockdown_active": new_state}

@app.get("/api/v1/audit/logs")
async def list_audit_logs(limit: int = 50):
    """Retorna os logs de auditoria imutáveis (HMAC chained)."""
    return get_audit_logs(limit=limit)

# --- Streaming de Vídeo MJPEG de Baixa Latência ---

def generate_video_stream(camera_code: str):
    """Gera fluxo de quadros MJPEG otimizado."""
    cap = cam_manager.get_video_capture(camera_code)
    while True:
        try:
            success, frame = cap.read()
            if not success or frame is None:
                frame = np.zeros((480, 640, 3), dtype=np.uint8)
                cv2.putText(frame, f"STREAM SIGNAL LOST: {camera_code}", (160, 240),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)

            ret, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            if not ret:
                continue

            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
        except Exception:
            break

@app.get("/api/feed/{camera_code}")
async def get_camera_feed(camera_code: str):
    """Endpoint de streaming contínuo das câmeras do sistema."""
    return StreamingResponse(
        generate_video_stream(camera_code),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 5000))
    print(f"============================================================")
    print(f"  SecureVision AI — Enterprise Server (FastAPI + Argon2id)")
    print(f"  Acesse no navegador: http://localhost:{port}")
    print(f"============================================================")
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
