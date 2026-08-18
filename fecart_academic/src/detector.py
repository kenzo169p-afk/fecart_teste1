import os
import cv2
from ultralytics import YOLO

MODELS_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "models"))
YOLO_PATH = os.path.join(MODELS_DIR, "yolov8n.pt")

class PersonDetector:
    def __init__(self):
        """Inicializa o modelo YOLOv8 para detecao de pessoas."""
        os.makedirs(MODELS_DIR, exist_ok=True)
        # Se o modelo nao existir na pasta models, ele sera baixado automaticamente
        print(f"[YOLO] Carregando modelo YOLOv8n de {YOLO_PATH}...")
        self.model = YOLO(YOLO_PATH)
        print("[YOLO] Modelo carregado com sucesso.")

    def detect_people(self, frame, conf_threshold=0.3):
        """
        Roda inferencia do YOLO no frame e filtra apenas por pessoas (classe 0).
        Retorna uma lista de caixas delimitadoras [x1, y1, x2, y2] e confianca.
        """
        results = self.model(frame, verbose=False)[0]
        detections = []
        
        for box in results.boxes:
            class_id = int(box.cls[0])
            conf = float(box.conf[0])
            
            # Filtra apenas a classe 'person' (ID 0)
            if class_id == 0 and conf >= conf_threshold:
                # Obter coordenadas [x1, y1, x2, y2]
                xyxy = box.xyxy[0].cpu().numpy()
                x1, y1, x2, y2 = map(int, xyxy)
                
                detections.append({
                    "box": [x1, y1, x2, y2],
                    "confidence": conf
                })
                
        return detections

if __name__ == "__main__":
    # Teste de importacao e carregamento do YOLO
    detector = PersonDetector()
    print("[YOLO] Teste concluido!")
