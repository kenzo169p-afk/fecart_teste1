import os
import cv2
import uuid
import socket
import base64
import urllib.parse
from flask import Flask, Response, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)  # Permite solicitações do frontend

# Dicionário para rastrear feeds de vídeo ativos e evitar conexões órfãs
active_streams = {}

def gen_frames(camera_url):
    """
    Captura frames da câmera usando OpenCV e transmite como stream MJPEG.
    """
    print(f"[CAM] Abrindo feed de vídeo para: {camera_url}")
    # Trata '0' como webcam local (inteiro)
    if camera_url == "0" or camera_url.isdigit():
        cap = cv2.VideoCapture(int(camera_url), cv2.CAP_DSHOW if os.name == 'nt' else cv2.CAP_ANY)
    else:
        # Se for RTSP/IP
        cap = cv2.VideoCapture(camera_url)

    # Configura um buffer menor para menor latência
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

    while True:
        success, frame = cap.read()
        if not success:
            print(f"[CAM] Erro ao ler frame de: {camera_url}. Tentando reconectar...")
            # Pequeno delay antes de tentar novamente
            cv2.waitKey(1000)
            if camera_url == "0" or camera_url.isdigit():
                cap = cv2.VideoCapture(int(camera_url), cv2.CAP_DSHOW if os.name == 'nt' else cv2.CAP_ANY)
            else:
                cap = cv2.VideoCapture(camera_url)
            continue
        
        # Opcional: Redimensionar para otimizar transferência e processamento
        # frame = cv2.resize(frame, (640, 480))
        
        ret, buffer = cv2.imencode('.jpg', frame)
        if not ret:
            continue
            
        frame_bytes = buffer.tobytes()
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
               
    cap.release()

@app.route('/health')
def health():
    return jsonify({"status": "running", "opencv": cv2.__version__})

@app.route('/video_feed')
def video_feed():
    """
    Endpoint para stream de vídeo. Aceita 'url' (url-encoded) ou 'url_b64' (Base64)
    Exemplo: /video_feed?url=rtsp://192.168.1.100:554/stream1
    """
    url = request.args.get('url')
    url_b64 = request.args.get('url_b64')
    
    if url_b64:
        try:
            url = base64.b64decode(url_b64).decode('utf-8')
        except Exception as e:
            return "Parâmetro url_b64 inválido", 400
            
    if not url:
        return "Parâmetro 'url' ou 'url_b64' é obrigatório", 400
        
    return Response(gen_frames(url), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/discover_cameras')
def discover_cameras():
    """
    Faz a busca de câmeras IP ONVIF na rede local usando WS-Discovery (UDP Multicast).
    Retorna uma lista de IPs e URIs ONVIF descobertos.
    """
    print("[ONVIF] Iniciando busca WS-Discovery por câmeras ONVIF...")
    
    # Payload SOAP de Probe para descobrir dispositivos ONVIF
    probe_msg = (
        '<?xml version="1.0" encoding="utf-8"?>'
        '<Envelope xmlns:tds="http://www.onvif.org/ver10/device/wsdl" '
        'xmlns:dn="http://www.onvif.org/ver10/network/wsdl" xmlns:uuid="http://uuid.org" '
        'xmlns:wsd="http://schemas.xmlsoap.org/ws/2005/04/discovery" '
        'xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing" '
        'xmlns:soap="http://www.w3.org/2003/05/soap-envelope">'
          '<Header>'
            f'<wsa:MessageID>urn:uuid:{uuid.uuid4()}</wsa:MessageID>'
            '<wsa:To>urn:schemas-xmlsoap.org:ws:2005:04:discovery</wsa:To>'
            '<wsa:Action>http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</wsa:Action>'
          '</Header>'
          '<Body>'
            '<wsd:Probe>'
              '<wsd:Types>tds:Device</wsd:Types>'
            '</wsd:Probe>'
          '</Body>'
        '</Envelope>'
    )
    
    discovered_devices = []
    
    # Configura socket UDP Multicast
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
    sock.settimeout(3.0)  # Aguarda 3 segundos por respostas
    
    # Configura TTL do multicast para 4 (limita à rede local)
    sock.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_TTL, 4)
    
    multicast_group = ('239.255.255.250', 3702)
    
    try:
        sock.sendto(probe_msg.encode('utf-8'), multicast_group)
        
        while True:
            try:
                data, addr = sock.recvfrom(65535)
                response_str = data.decode('utf-8', errors='ignore')
                
                # Procura por URIs de serviço ONVIF na resposta XML
                # Exemplo de resposta comum contém: <wsd:XAddrs>http://192.168.1.108/onvif/device_service</wsd:XAddrs>
                if "onvif" in response_str.lower():
                    # Extrai XAddrs simplificado
                    xaddrs = ""
                    if "<XAddrs>" in response_str:
                        xaddrs = response_str.split("<XAddrs>")[1].split("</XAddrs>")[0]
                    elif "xaddrs" in response_str.lower():
                        # Lida com namespaces
                        parts = response_str.split("Addrs>")
                        if len(parts) >= 3:
                            xaddrs = parts[1][:-2] # Remove </
                    
                    device_ip = addr[0]
                    
                    device_info = {
                        "ip": device_ip,
                        "onvif_service_url": xaddrs.split(" ")[0] if xaddrs else f"http://{device_ip}/onvif/device_service",
                        "rTSP_url_guess": f"rtsp://{device_ip}:554/live/ch0"  # Sugestão padrão de stream
                    }
                    
                    # Evita duplicatas
                    if not any(d['ip'] == device_ip for d in discovered_devices):
                        discovered_devices.append(device_info)
                        print(f"[ONVIF] Câmera encontrada no IP: {device_ip}")
            except socket.timeout:
                # Fim do tempo de espera
                break
    except Exception as e:
        print(f"[ONVIF] Erro durante descoberta de câmeras: {e}")
    finally:
        sock.close()
        
    return jsonify({
        "status": "success",
        "count": len(discovered_devices),
        "devices": discovered_devices
    })

# =============================================================================
# SUPABASE REST API INTEGRATION LAYER
# =============================================================================
import requests

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY", "")

def supabase_headers():
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

def is_supabase_configured():
    return bool(SUPABASE_URL and SUPABASE_KEY and not SUPABASE_URL.startswith("https://sua-url"))

@app.route('/api/status', methods=['GET'])
def get_system_status():
    """Retorna o status da conexão do backend e do Supabase."""
    return jsonify({
        "status": "online",
        "supabase_configured": is_supabase_configured(),
        "supabase_url": SUPABASE_URL if is_supabase_configured() else "Não configurado"
    })

@app.route('/api/pessoas', methods=['GET', 'POST', 'DELETE'])
def handle_pessoas():
    """CRUD de Pessoas Registradas conectado ao Supabase com fallback local."""
    if request.method == 'GET':
        if is_supabase_configured():
            try:
                res = requests.get(f"{SUPABASE_URL}/rest/v1/pessoas?select=*&order=created_at.desc", headers=supabase_headers(), timeout=5)
                if res.status_code in [200, 206]:
                    return jsonify({"success": True, "data": res.json()})
            except Exception as e:
                print(f"[SUPABASE] Erro ao buscar pessoas: {e}")
        return jsonify({"success": True, "data": [], "fallback": True})

    elif request.method == 'POST':
        data = request.get_json() or {}
        if not data.get('nome'):
            return jsonify({"success": False, "error": "Nome é obrigatório"}), 400
            
        if is_supabase_configured():
            try:
                res = requests.post(f"{SUPABASE_URL}/rest/v1/pessoas", headers=supabase_headers(), json=data, timeout=5)
                if res.status_code in [200, 201]:
                    return jsonify({"success": True, "data": res.json()})
                else:
                    return jsonify({"success": False, "error": res.text}), res.status_code
            except Exception as e:
                print(f"[SUPABASE] Erro ao cadastrar pessoa: {e}")
                return jsonify({"success": False, "error": str(e)}), 500
        return jsonify({"success": True, "data": [data], "fallback": True})

    elif request.method == 'DELETE':
        person_id = request.args.get('id')
        if is_supabase_configured():
            try:
                url = f"{SUPABASE_URL}/rest/v1/pessoas?id=eq.{person_id}" if person_id else f"{SUPABASE_URL}/rest/v1/pessoas?id=not.is.null"
                res = requests.delete(url, headers=supabase_headers(), timeout=5)
                if res.status_code in [200, 204]:
                    return jsonify({"success": True, "message": "Pessoa(s) removida(s) com sucesso"})
                else:
                    return jsonify({"success": False, "error": res.text}), res.status_code
            except Exception as e:
                return jsonify({"success": False, "error": str(e)}), 500
        return jsonify({"success": True, "fallback": True})

@app.route('/api/reconhecimentos', methods=['GET', 'POST'])
def handle_reconhecimentos():
    """Gerencia eventos de detecção facial no Supabase."""
    if request.method == 'GET':
        if is_supabase_configured():
            try:
                limit = request.args.get('limit', 50)
                res = requests.get(f"{SUPABASE_URL}/rest/v1/reconhecimentos?select=*,pessoas(nome,cpf_mascarado)&order=detected_at.desc&limit={limit}", headers=supabase_headers(), timeout=5)
                if res.status_code in [200, 206]:
                    return jsonify({"success": True, "data": res.json()})
            except Exception as e:
                print(f"[SUPABASE] Erro ao buscar reconhecimentos: {e}")
        return jsonify({"success": True, "data": [], "fallback": True})

    elif request.method == 'POST':
        data = request.get_json() or {}
        if is_supabase_configured():
            try:
                res = requests.post(f"{SUPABASE_URL}/rest/v1/reconhecimentos", headers=supabase_headers(), json=data, timeout=5)
                if res.status_code in [200, 201]:
                    return jsonify({"success": True, "data": res.json()})
            except Exception as e:
                print(f"[SUPABASE] Erro ao salvar reconhecimento: {e}")
        return jsonify({"success": True, "data": data, "fallback": True})

@app.route('/api/audit_logs', methods=['GET', 'POST'])
def handle_audit_logs():
    """Gerencia logs de auditoria do sistema no Supabase."""
    if request.method == 'GET':
        if is_supabase_configured():
            try:
                res = requests.get(f"{SUPABASE_URL}/rest/v1/audit_logs?select=*&order=created_at.desc&limit=100", headers=supabase_headers(), timeout=5)
                if res.status_code in [200, 206]:
                    return jsonify({"success": True, "data": res.json()})
            except Exception as e:
                print(f"[SUPABASE] Erro ao buscar audit logs: {e}")
        return jsonify({"success": True, "data": [], "fallback": True})

    elif request.method == 'POST':
        data = request.get_json() or {}
        if is_supabase_configured():
            try:
                res = requests.post(f"{SUPABASE_URL}/rest/v1/audit_logs", headers=supabase_headers(), json=data, timeout=5)
                if res.status_code in [200, 201]:
                    return jsonify({"success": True, "data": res.json()})
            except Exception as e:
                print(f"[SUPABASE] Erro ao registrar log de auditoria: {e}")
        return jsonify({"success": True, "data": data, "fallback": True})

if __name__ == '__main__':
    port = int(os.getenv("PORT", 5000))
    print(f"[APP] Iniciando servidor backend na porta {port}...")
    app.run(host='0.0.0.0', port=port, debug=False)
