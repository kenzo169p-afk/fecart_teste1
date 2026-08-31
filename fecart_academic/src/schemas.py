from pydantic import BaseModel, Field, field_validator
from datetime import date, datetime
from typing import Optional, List, Dict, Any
import re

class LoginSchema(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, description="Login único ou Nome do Operador")
    birthdate: date = Field(..., description="Data de Nascimento para verificação de identidade")
    password: str = Field(..., min_length=4, max_length=128, description="Senha de acesso")

    @field_validator("username")
    def sanitize_username(cls, v: str) -> str:
        clean = v.strip()
        if not re.match(r"^[a-zA-Z0-9_.\-\s]+$", clean):
            raise ValueError("O identificador de usuário contém caracteres inválidos.")
        return clean

class RegisterOperatorSchema(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    full_name: str = Field(..., min_length=3, max_length=150)
    birthdate: date
    password: str = Field(..., min_length=4, max_length=128)
    department: str = Field(default="Security")
    clearance_level: str = Field(default="Level 2 (Staff)")

    @field_validator("username")
    def sanitize_username(cls, v: str) -> str:
        clean = v.strip().lower()
        if not re.match(r"^[a-z0-9_.-]+$", clean):
            raise ValueError("O login deve conter apenas letras minúsculas, números, ponto, hífen ou sublinhado.")
        return clean

    @field_validator("full_name")
    def sanitize_name(cls, v: str) -> str:
        clean = v.strip()
        if len(clean) < 3:
            raise ValueError("Nome completo deve conter no mínimo 3 caracteres.")
        return clean

class SubjectEnrollSchema(BaseModel):
    full_name: str = Field(..., min_length=3, max_length=150)
    national_id: str = Field(..., min_length=11, max_length=14, description="CPF da pessoa")
    department: str = Field(default="Engineering")
    clearance_level: str = Field(default="Level 1 (Basic)")
    age: int = Field(default=30, ge=0, le=120)
    photo_base64: Optional[str] = None
    lgpd_consent: bool = Field(default=True)

    @field_validator("national_id")
    def validate_cpf(cls, v: str) -> str:
        digits = re.sub(r"\D", "", v)
        if len(digits) != 11:
            raise ValueError("O CPF informado deve conter exatamente 11 dígitos numéricos.")
        return digits

class OperatorProfileResponse(BaseModel):
    id: str
    username: str
    full_name: str
    role: str
    clearance_level: str
    department: Optional[str] = "Security"

class TelemetryStatsResponse(BaseModel):
    fps_avg: float
    edge_gpu_usage: int
    active_streams: int
    total_streams: int
    processing_load: int
    active_anomalies: int
    frame_latency: int
    uptime: float
    files_scanned: int
    lockdown_active: bool
    vigilance_level: str
    total_subjects: int
    active_subjects: int
    total_recognitions: int
    unauthorized_events: int
    last_check: str

class AuditLogItemResponse(BaseModel):
    id: str
    timestamp: str
    operator_username: str
    action: str
    entity_type: str
    entity_id: Optional[str]
    details: Optional[Dict[str, Any]]
    current_log_hash: str
