import os
import cv2
import numpy as np
import time
import math
from datetime import datetime

try:
    from .database import get_connection
except (ImportError, ValueError):
    from database import get_connection

class CameraConfigManager:
    def __init__(self):
        """Gerencia conexões, streams reais e simulações para as 4 câmeras do sistema."""
        self.active_caps = {}

    def get_registered_cameras(self):
        """Retorna todas as câmeras cadastradas."""
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM cameras ORDER BY code ASC;")
        rows = cursor.fetchall()
        conn.close()
        return [dict(r) for r in rows]

    def get_video_capture(self, camera_id_or_code):
        """Retorna o objeto de captura correspondente."""
        if camera_id_or_code in self.active_caps:
            return self.active_caps[camera_id_or_code]

        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM cameras WHERE id = ? OR code = ?;", (camera_id_or_code, camera_id_or_code))
        cam = cursor.fetchone()
        conn.close()

        if not cam:
            # Fallback seguro
            cap = RealisticSecurityCameraFeed(code="CAM_01_LOBBY", name="Main Lobby", scene_type="lobby")
            self.active_caps[camera_id_or_code] = cap
            return cap

        code = cam["code"]
        url = cam["url_conexao"]
        tipo = cam["tipo"]

        if tipo == "webcam" or url == "0" or url.isdigit():
            cap = cv2.VideoCapture(int(url))
            self.active_caps[camera_id_or_code] = cap
            return cap
        elif os.path.exists(url):
            cap = cv2.VideoCapture(url)
            self.active_caps[camera_id_or_code] = cap
            return cap
        else:
            # Gera feed simulado de alta fidelidade específico para o setor da câmera
            scene = "lobby"
            if "EXTERIOR" in code or "04" in code:
                scene = "exterior"
            elif "DATACENTER" in code or "07" in code:
                scene = "datacenter"
            elif "ENTRANCE" in code or "02" in code:
                scene = "entrance"

            cap = RealisticSecurityCameraFeed(code=code, name=cam["nome"], scene_type=scene)
            self.active_caps[camera_id_or_code] = cap
            return cap

    def release_all(self):
        """Libera capturas ativas."""
        for cap in self.active_caps.values():
            if hasattr(cap, "release"):
                cap.release()
        self.active_caps.clear()


class RealisticSecurityCameraFeed:
    """
    Gera frames simulados ultra-realistas com visual de CCTV / NPU HUD
    reproduzindo com precisão a estética das referências do SecureVision AI.
    """
    def __init__(self, code="CAM_01_LOBBY", name="Main Lobby", scene_type="lobby", width=640, height=480):
        self.code = code
        self.name = name
        self.scene_type = scene_type
        self.width = width
        self.height = height
        self.frame_idx = 0
        self.last_time = time.time()
        
        # Parâmetros de animação específicos por cena
        if scene_type == "lobby":
            # Pessoa autorizada caminhando pelo corredor
            self.person_x = 220
            self.person_speed = 1.2
            self.badge_name = "Person #3 (Authorized)"
            self.id_tag = "ID: 0492 - Smith, J (96%)"
        elif scene_type == "exterior":
            # Intruso suspeito com alerta vermelho
            self.person_x = 440
            self.person_speed = -1.5
            self.alert_pulse = 0
        elif scene_type == "datacenter":
            self.rack_lights = [np.random.randint(0, 2, 8) for _ in range(6)]
        elif scene_type == "entrance":
            self.walkers = [[120, 1.0], [280, -0.8], [420, 1.2]]

    def read(self):
        """Renderiza e retorna o frame com efeitos e HUD."""
        self.frame_idx += 1
        now = datetime.now()
        timestamp_str = now.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        
        frame = np.zeros((self.height, self.width, 3), dtype=np.uint8)

        # 1. Renderiza o cenário de fundo
        if self.scene_type == "lobby":
            self._draw_lobby_scene(frame)
        elif self.scene_type == "exterior":
            self._draw_exterior_scene(frame)
        elif self.scene_type == "datacenter":
            self._draw_datacenter_scene(frame)
        elif self.scene_type == "entrance":
            self._draw_entrance_scene(frame)

        # 2. Renderiza HUD superior (Nome da Câmera, indicador de REC / LIVE, Timestamp)
        self._draw_hud_overlays(frame, timestamp_str)

        # 3. Adiciona leve ruído de sensor / scanlines para realismo
        if self.frame_idx % 2 == 0:
            frame[::4, :, :] = (frame[::4, :, :].astype(np.float32) * 0.92).astype(np.uint8)

        time.sleep(0.018)  # ~55-60 FPS
        return True, frame

    def _draw_hud_overlays(self, frame, timestamp_str):
        # Badge de topo esquerdo
        dot_color = (0, 255, 128)  # Verde
        status_text = "LIVE"
        
        if self.scene_type == "exterior":
            # Piscada vermelha
            if (self.frame_idx // 15) % 2 == 0:
                dot_color = (0, 0, 255)
                status_text = "REC / ALERT"

        # Barra translúcida no topo da câmera
        cv2.rectangle(frame, (10, 10), (220, 36), (20, 25, 35), -1)
        cv2.rectangle(frame, (10, 10), (220, 36), (60, 70, 90), 1)
        
        # Ponto indicador
        cv2.circle(frame, (25, 23), 5, dot_color, -1)
        cv2.putText(frame, f"{self.code}", (38, 27), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (230, 240, 255), 1, cv2.LINE_AA)

        # Timestamp no topo direito
        cv2.putText(frame, timestamp_str, (self.width - 210, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (160, 180, 200), 1, cv2.LINE_AA)

        # Retícula de mira no canto inferior direito
        cv2.putText(frame, f"NPU: 12ms | FPS: 59.8 | 1080p", (15, self.height - 15), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (120, 140, 160), 1, cv2.LINE_AA)

    def _draw_lobby_scene(self, frame):
        # Fundo de corredor moderno (perspectiva com tons de cinza/azul)
        # Paredes
        cv2.fillPoly(frame, [np.array([[0, 0], [200, 150], [200, 350], [0, 480]], np.int32)], (35, 40, 48))
        cv2.fillPoly(frame, [np.array([[640, 0], [440, 150], [440, 350], [640, 480]], np.int32)], (40, 45, 55))
        # Teto e chão
        cv2.fillPoly(frame, [np.array([[0, 0], [640, 0], [440, 150], [200, 150]], np.int32)], (25, 30, 38))
        cv2.fillPoly(frame, [np.array([[0, 480], [640, 480], [440, 350], [200, 350]], np.int32)], (50, 55, 65))
        # Linhas de teto luminosas
        cv2.line(frame, (260, 150), (100, 0), (120, 130, 150), 2)
        cv2.line(frame, (380, 150), (540, 0), (120, 130, 150), 2)
        # Fundo final do corredor
        cv2.rectangle(frame, (200, 150), (440, 350), (30, 35, 42), -1)
        cv2.rectangle(frame, (290, 200), (350, 350), (15, 20, 25), -1)

        # Animação de pessoa autorizada
        self.person_x += self.person_speed
        if self.person_x > 360 or self.person_x < 210:
            self.person_speed *= -1

        px = int(self.person_x)
        py = 210
        pw, ph = 65, 170

        # Silhueta da pessoa
        cv2.circle(frame, (px + pw//2, py + 22), 16, (140, 150, 165), -1) # Cabeça
        cv2.rectangle(frame, (px + 10, py + 40), (px + pw - 10, py + 115), (70, 75, 85), -1) # Tronco
        cv2.line(frame, (px + 20, py + 115), (px + 15, py + ph), (50, 55, 60), 6) # Perna esq
        cv2.line(frame, (px + pw - 20, py + 115), (px + pw - 15, py + ph), (50, 55, 60), 6) # Perna dir

        # Bounding Box inteligente (Ciano / Azul claro - Authorized)
        box_color = (235, 180, 30) # Azul/Ciano BGR
        cv2.rectangle(frame, (px - 5, py - 5), (px + pw + 5, py + ph + 5), box_color, 2)
        
        # Retículos nos cantos da caixa
        s = 10
        cv2.line(frame, (px - 5, py - 5), (px - 5 + s, py - 5), (255, 255, 255), 2)
        cv2.line(frame, (px - 5, py - 5), (px - 5, py - 5 + s), (255, 255, 255), 2)

        # Wireframe de malha facial / pontos de IA
        fx, fy = px + pw//2, py + 22
        cv2.circle(frame, (fx - 5, fy - 2), 2, (0, 255, 200), -1)
        cv2.circle(frame, (fx + 5, fy - 2), 2, (0, 255, 200), -1)
        cv2.circle(frame, (fx, fy + 4), 1, (0, 255, 200), -1)
        cv2.line(frame, (fx - 4, fy + 8), (fx + 4, fy + 8), (0, 255, 200), 1)

        # Card de Identidade flutuante sobre a pessoa (Estilo Imagem 1)
        card_x, card_y = px - 25, py - 45
        cv2.rectangle(frame, (card_x, card_y), (card_x + 160, card_y + 32), (220, 210, 190), -1)
        cv2.putText(frame, "Person #3", (card_x + 10, card_y + 14), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (40, 40, 50), 1, cv2.LINE_AA)
        cv2.putText(frame, "[Authorized]", (card_x + 10, card_y + 27), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (0, 140, 40), 1, cv2.LINE_AA)

    def _draw_exterior_scene(self, frame):
        # Fundo escuro de estacionamento / área restrita
        frame[:] = (20, 20, 25)
        # Piso com marcações
        cv2.line(frame, (0, 360), (640, 360), (50, 50, 55), 2)
        cv2.line(frame, (100, 360), (0, 480), (70, 70, 75), 2)
        cv2.line(frame, (320, 360), (280, 480), (70, 70, 75), 2)
        cv2.line(frame, (540, 360), (600, 480), (70, 70, 75), 2)

        # Carro ao fundo
        cv2.rectangle(frame, (40, 260), (180, 330), (35, 35, 40), -1)
        cv2.circle(frame, (70, 330), 15, (25, 25, 30), -1)
        cv2.circle(frame, (150, 330), 15, (25, 25, 30), -1)

        # Movimento do suspeito
        self.person_x += self.person_speed
        if self.person_x > 500 or self.person_x < 360:
            self.person_speed *= -1

        px = int(self.person_x)
        py = 240
        pw, ph = 55, 150

        # Silhueta escura do suspeito
        cv2.circle(frame, (px + pw//2, py + 18), 14, (60, 60, 70), -1)
        cv2.rectangle(frame, (px + 8, py + 34), (px + pw - 8, py + 105), (45, 45, 55), -1)
        cv2.line(frame, (px + 18, py + 105), (px + 10, py + ph), (30, 30, 35), 5)
        cv2.line(frame, (px + pw - 18, py + 105), (px + pw - 10, py + ph), (30, 30, 35), 5)

        # EFEITO DE ALERTA VERMELHO INTENSO (Estilo Imagem 1 e 2)
        pulse = abs(math.sin(self.frame_idx * 0.15))
        red_intensity = int(180 + 75 * pulse)
        alert_color = (0, 0, red_intensity)

        # Bounding box vermelha pulsante com cantos destacados
        cv2.rectangle(frame, (px - 10, py - 10), (px + pw + 10, py + ph + 10), alert_color, 2)
        cv2.circle(frame, (px + pw//2, py + ph//2), int(35 + 10 * pulse), alert_color, 1)

        # Banner de RED ALERT flutuante
        banner_w, banner_h = 170, 42
        bx, by = px - 55, py - 60
        cv2.rectangle(frame, (bx, by), (bx + banner_w, by + banner_h), (10, 10, 25), -1)
        cv2.rectangle(frame, (bx, by), (bx + banner_w, by + banner_h), alert_color, 2)
        cv2.putText(frame, "RED ALERT", (bx + 40, by + 18), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (0, 0, 255), 2, cv2.LINE_AA)
        cv2.putText(frame, "UNAUTHORIZED PRESENCE", (bx + 8, by + 34), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (200, 200, 255), 1, cv2.LINE_AA)

        # Faixa inferior de detecção
        cv2.rectangle(frame, (20, self.height - 65), (self.width - 20, self.height - 35), (20, 22, 30), -1)
        cv2.rectangle(frame, (20, self.height - 65), (self.width - 20, self.height - 35), (70, 40, 50), 1)
        cv2.putText(frame, "Face Detected: Unknown #4 [MATCH: 0.38 - REJECTED]", (35, self.height - 46), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (100, 120, 255), 1, cv2.LINE_AA)

    def _draw_datacenter_scene(self, frame):
        # Corredor do datacenter escuro com racks de servidores e luzes azuis
        frame[:] = (12, 18, 28)
        
        # Racks laterais
        for i in range(4):
            rx1 = 50 + i * 45
            rx2 = 590 - i * 45
            cv2.rectangle(frame, (rx1 - 20, 80), (rx1 + 20, 420), (20, 30, 45), -1)
            cv2.rectangle(frame, (rx2 - 20, 80), (rx2 + 20, 420), (20, 30, 45), -1)

            # LEDs piscando nos racks
            for led_y in range(100, 400, 22):
                c1 = (255, 200, 50) if (self.frame_idx + i + led_y) % 5 == 0 else (180, 80, 20)
                c2 = (0, 255, 100) if (self.frame_idx + i * 2) % 4 == 0 else (100, 180, 20)
                cv2.circle(frame, (rx1, led_y), 2, c1, -1)
                cv2.circle(frame, (rx2, led_y), 2, c2, -1)

        # Piso com grade luminosa
        for gy in range(350, 480, 25):
            cv2.line(frame, (0, gy), (640, gy), (30, 45, 65), 1)

        # Informação de telemetria da sala
        cv2.putText(frame, "VAULT TEMPERATURE: 18.4 C | HUMIDITY: 45%", (180, 180), cv2.FONT_HERSHEY_SIMPLEX, 0.36, (0, 220, 255), 1, cv2.LINE_AA)
        cv2.putText(frame, "SECTOR SECURE - ENCRYPTION LOCK ON", (195, 210), cv2.FONT_HERSHEY_SIMPLEX, 0.36, (0, 255, 150), 1, cv2.LINE_AA)

    def _draw_entrance_scene(self, frame):
        # Entrada do campus com catracas
        frame[:] = (45, 50, 55)
        # Portas de vidro ao fundo
        cv2.rectangle(frame, (80, 60), (560, 320), (60, 70, 80), -1)
        cv2.line(frame, (240, 60), (240, 320), (120, 130, 140), 2)
        cv2.line(frame, (400, 60), (400, 320), (120, 130, 140), 2)

        # Catracas metálicas no primeiro plano
        for tx in [160, 300, 440]:
            cv2.rectangle(frame, (tx - 15, 300), (tx + 15, 450), (90, 100, 110), -1)
            cv2.circle(frame, (tx, 320), 4, (0, 255, 100), -1)

        # Várias pessoas passando nas catracas com tracking retangular
        for w in self.walkers:
            w[0] += w[1]
            if w[0] > 540 or w[0] < 100:
                w[1] *= -1

            wx = int(w[0])
            wy = 220
            cv2.circle(frame, (wx + 15, wy + 15), 12, (100, 110, 120), -1)
            cv2.rectangle(frame, (wx + 5, wy + 30), (wx + 25, wy + 90), (70, 75, 80), -1)
            # Caixa verde de detecção
            cv2.rectangle(frame, (wx - 2, wy - 2), (wx + 32, wy + 110), (0, 230, 120), 1)
            cv2.putText(frame, "ID: OK", (wx - 2, wy - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.32, (0, 255, 120), 1, cv2.LINE_AA)

    def release(self):
        pass
