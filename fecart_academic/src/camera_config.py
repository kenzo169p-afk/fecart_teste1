import os
import cv2
import numpy as np
import time
from datetime import datetime
try:
    from .database import get_connection
except (ImportError, ValueError):
    from database import get_connection

class CameraConfigManager:
    def __init__(self):
        """Gerencia conexoes e simulacoes das fontes de cameras."""
        self.active_caps = {}

    def get_registered_cameras(self):
        """Retorna todas as cameras cadastradas no banco de dados."""
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM cameras WHERE status = 'ativo';")
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]

    def get_video_capture(self, camera_id):
        """
        Retorna o objeto cv2.VideoCapture correspondente a camera.
        Se for uma camera simulada (video inexistente), inicia a geracao sintetica.
        """
        if camera_id in self.active_caps:
            return self.active_caps[camera_id]

        # Buscar config no DB
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM cameras WHERE id = ?;", (camera_id,))
        cam = cursor.fetchone()
        conn.close()

        if not cam:
            raise ValueError(f"Camera com ID {camera_id} nao encontrada.")

        url = cam["url_conexao"]
        tipo = cam["tipo"]

        if tipo == "webcam" or url == "0" or url.isdigit():
            # Inicia webcam local
            cap = cv2.VideoCapture(int(url))
            self.active_caps[camera_id] = cap
            return cap
        else:
            # Camera IP / RTSP / Video Simulador
            if os.path.exists(url):
                # Se o arquivo de video local existir, usa ele
                cap = cv2.VideoCapture(url)
                self.active_caps[camera_id] = cap
                return cap
            else:
                # Fallback: Usar gerador de frames sinteticos para simular camera FECAP
                print(f"[CAM] Arquivo '{url}' nao encontrado. Usando gerador de video sintetico.")
                cap = SyntheticVideoCapture(nome_camera=cam["nome"])
                self.active_caps[camera_id] = cap
                return cap

    def release_all(self):
        """Libera todos os recursos de captura de video."""
        for cap in self.active_caps.values():
            if hasattr(cap, "release"):
                cap.release()
        self.active_caps.clear()


class SyntheticVideoCapture:
    """
    Classe mock que simula o comportamento de cv2.VideoCapture,
    gerando frames sinteticos de pessoas caminhando em um cenario.
    """
    def __init__(self, width=640, height=480, nome_camera="FECAP"):
        self.width = width
        self.height = height
        self.nome_camera = nome_camera
        self.frame_count = 0
        
        # Posicao inicial dos 'bonecos' sinteticos
        # Cada boneco tem [x, y, vx, vy, color, size]
        self.entities = [
            [100, 200, 2, 0, (0, 255, 0), (60, 160)],   # Verde (simula pessoa 1)
            [500, 250, -2, 1, (255, 0, 0), (50, 140)],  # Vermelho (simula pessoa 2)
            [300, 150, 0, 0, (0, 0, 255), (70, 180)],   # Azul (simula pessoa 3, parada)
        ]

    def read(self):
        """Retorna (success, frame) simulando uma captura real."""
        # Cria um background de cenario (cor cinza escuro de monitoramento)
        frame = np.zeros((self.height, self.width, 3), dtype=np.uint8)
        cv2.rectangle(frame, (0, 0), (self.width, self.height), (30, 30, 35), -1)

        # Desenha cenario simples (ex: linhas de corredor)
        cv2.line(frame, (0, 350), (self.width, 350), (100, 100, 100), 2)
        cv2.line(frame, (150, 0), (150, 350), (80, 80, 80), 1)
        cv2.line(frame, (490, 0), (490, 350), (80, 80, 80), 1)

        # Injeta identificacao da camera no frame
        cv2.putText(frame, f"CAM: {self.nome_camera} [SIMULADA]", (20, 40), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        
        # Injeta timestamp
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cv2.putText(frame, now_str, (self.width - 240, 40), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)

        # Atualiza e desenha as entidades (pessoas simuladas)
        self.frame_count += 1
        for entity in self.entities:
            x, y, vx, vy, color, (w, h) = entity
            
            # Movimenta entidade
            x += vx
            y += vy

            # Limites da tela (rebate horizontal)
            if x < 50 or x > self.width - 50:
                entity[2] = -vx
            if y < 100 or y > self.height - 150:
                entity[3] = -vy

            # Atualiza posicao na lista
            entity[0] = x
            entity[1] = y

            # Desenha cabeca (circulo)
            cv2.circle(frame, (x, y), 20, color, -1)
            # Desenha corpo (retangulo)
            cv2.rectangle(frame, (x - w//2, y + 20), (x + w//2, y + h), color, -1)
            # Pernas
            cv2.line(frame, (x - 10, y + h), (x - 10, y + h + 20), color, 3)
            cv2.line(frame, (x + 10, y + h), (x + 10, y + h + 20), color, 3)

        # Introduz um pequeno delay para simular taxa de quadros (30 FPS)
        time.sleep(0.033)
        return True, frame

    def release(self):
        pass
