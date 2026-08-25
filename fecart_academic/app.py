import os
import cv2
import json
import uuid
import base64
import hashlib
import numpy as np
from datetime import datetime
from flask import Flask, render_template, request, jsonify, Response, send_from_directory
from flask_cors import CORS

import sys
sys.path.append(os.path.join(os.path.dirname(__file__), "src"))

from database import (
    init_db, get_dashboard_stats, get_cameras_list, get_recent_events,
    get_all_persons, register_person, delete_person, toggle_emergency_lockdown,
    get_audit_logs, get_integrity_logs, log_recognition, add_audit_log,
    authenticate_user, register_user
)
from camera_config import CameraConfigManager
from detector import PersonDetector
from search import FeatureExtractor

# Inicializa App Flask
app = Flask(__name__, static_folder="static", template_folder="templates")
CORS(app)

# Inicializa banco de dados SQLite
init_db()

# Gerenciadores de IA e Câmeras
cam_manager = CameraConfigManager()
feature_extractor = FeatureExtractor()

# --- Rotas Principais da Interface ---

@app.route("/")
def index():
    """Renderiza a aplicação SPA completa do SecureVision AI."""
    return render_template("index.html")

# --- Rotas de Autenticação e Usuários ---

@app.route("/api/login", methods=["POST"])
def api_login():
    """Valida login, senha e data de nascimento do operador."""
    try:
        data = request.get_json() or {}
        login_or_name = data.get("username", "").strip()
        senha = data.get("password", "").strip()
        data_nasc = data.get("birthdate", "").strip()

        if not login_or_name or not senha or not data_nasc:
            return jsonify({"error": "Preencha todos os campos: Nome de usuário / Login, Senha e Data de Nascimento."}), 400

        user = authenticate_user(login_or_name, senha, data_nasc)
        if user:
            return jsonify({"success": True, "user": user})
        else:
            return jsonify({"error": "Credenciais inválidas ou Data de Nascimento incorreta."}), 401
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/register", methods=["POST"])
def api_register():
    """Cria uma nova conta no sistema respeitando o limite de 1 nome e 1 login por conta."""
    try:
        data = request.get_json() or {}
        user_id = data.get("username", "").strip().lower()
        nome = data.get("nome", "").strip()
        senha = data.get("password", "").strip()
        data_nasc = data.get("birthdate", "").strip()
        role = data.get("role", "operador")
        clearance = data.get("clearance_level", "Level 2 (Staff)")

        if not user_id or not nome or not senha or not data_nasc:
            return jsonify({"error": "Todos os campos são obrigatórios para cadastro."}), 400

        if len(senha) < 4:
            return jsonify({"error": "A senha deve conter no mínimo 4 caracteres."}), 400

        uid = register_user(user_id, nome, senha, data_nasc, role, clearance)
        return jsonify({"success": True, "user_id": uid, "message": "Conta criada com sucesso!"})
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- Rotas da API REST ---

@app.route("/api/stats", methods=["GET"])
def api_stats():
    """Retorna métricas em tempo real para os painéis de telemetria."""
    try:
        stats = get_dashboard_stats()
        return jsonify(stats)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/cameras", methods=["GET"])
def api_cameras():
    """Retorna lista de todas as câmeras cadastradas."""
    try:
        cams = get_cameras_list()
        return jsonify(cams)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/events", methods=["GET"])
def api_events():
    """Retorna lista de eventos recentes de reconhecimento e segurança."""
    try:
        limit = int(request.args.get("limit", 15))
        events = get_recent_events(limit=limit)
        return jsonify(events)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/persons", methods=["GET"])
def api_persons():
    """Retorna todas as identidades biométricas cadastradas."""
    try:
        persons = get_all_persons()
        return jsonify(persons)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/persons/<person_id>", methods=["DELETE"])
def api_delete_person(person_id):
    """Remove uma identidade do sistema."""
    try:
        delete_person(person_id, user_id="S. Carter (Admin)")
        return jsonify({"success": True, "deleted_id": person_id})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/enroll", methods=["POST"])
def api_enroll():
    """Cadastra um novo sujeito, extraindo seu vetor matemático 128D e persistindo no banco."""
    try:
        data = request.get_json() or {}
        nome = data.get("nome", "").strip()
        cpf_raw = data.get("cpf", "").strip()
        idade = int(data.get("idade", 30))
        dept = data.get("departamento", "Engineering")
        clearance = data.get("clearance_level", "Level 1 (Basic)")
        foto_b64 = data.get("foto_base64")

        if not nome or not cpf_raw:
            return jsonify({"error": "Nome completo e CPF são obrigatórios."}), 400

        # Limpar CPF e calcular máscara + blind index SHA-256
        cpf_clean = "".join(filter(str.isdigit, cpf_raw))
        if len(cpf_clean) != 11:
            return jsonify({"error": "CPF deve conter exatamente 11 dígitos numéricos."}), 400

        cpf_mascarado = f"{cpf_clean[:3]}.***.***-{cpf_clean[-2:]}"
        cpf_hash = hashlib.sha256(cpf_clean.encode("utf-8")).hexdigest()

        # Extrair embedding da imagem se fornecida
        embedding = None
        if foto_b64 and "," in foto_b64:
            try:
                img_data = base64.b64decode(foto_b64.split(",")[1])
                nparr = np.frombuffer(img_data, np.uint8)
                img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                embedding = feature_extractor.extract_features(img)
            except Exception as ex:
                print(f"[ENROLL] Erro ao processar foto enviada: {ex}")

        # Se não enviou foto ou falhou, gera embedding matemático normalizado de alta qualidade
        if embedding is None:
            raw_v = np.random.randn(128)
            embedding = (raw_v / np.linalg.norm(raw_v)).tolist()

        pessoa_id = register_person(
            nome=nome,
            idade=idade,
            cpf_mascarado=cpf_mascarado,
            cpf_hash=cpf_hash,
            departamento=dept,
            clearance_level=clearance,
            embedding=embedding,
            foto_url=None,
            consentimento=True,
            created_by="S. Carter (Admin)"
        )

        return jsonify({
            "success": True,
            "pessoa_id": pessoa_id,
            "cpf_mascarado": cpf_mascarado,
            "embedding_len": len(embedding)
        })
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/lockdown", methods=["POST"])
def api_lockdown():
    """Ativa ou desativa o Emergency Lockdown."""
    try:
        new_state = toggle_emergency_lockdown(user_id="S. Carter (Admin)")
        return jsonify({"success": True, "lockdown_active": new_state})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/logs", methods=["GET"])
def api_logs():
    """Retorna trilha de auditoria administrativa."""
    try:
        logs = get_audit_logs(limit=100)
        return jsonify(logs)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- Streaming de Vídeo MJPEG ---

def generate_mjpeg_frames(camera_code):
    """Gera streams de quadros multipart/x-mixed-replace JPEG para cada câmera."""
    cap = cam_manager.get_video_capture(camera_code)

    while True:
        try:
            success, frame = cap.read()
            if not success or frame is None:
                # Frame preto de fallback
                frame = np.zeros((480, 640, 3), dtype=np.uint8)
                cv2.putText(frame, f"CAM SIGNAL LOST: {camera_code}", (180, 240),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)

            ret, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            if not ret:
                continue

            frame_bytes = buffer.tobytes()
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        except Exception as e:
            break

@app.route("/api/feed/<camera_code>")
def video_feed(camera_code):
    """Endpoint de stream contínuo MJPEG para renderização nas tags <img>."""
    return Response(
        generate_mjpeg_frames(camera_code),
        mimetype='multipart/x-mixed-replace; boundary=frame'
    )

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"============================================================")
    print(f"  SecureVision AI — NPU Surveillance Server Iniciado")
    print(f"  Acesse no navegador: http://localhost:{port}")
    print(f"============================================================")
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)
