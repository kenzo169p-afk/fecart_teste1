import os
import urllib.request

# Configurações de download
BASE_URL = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/"
OUTPUT_DIR = os.path.join("frontend", "public", "models")

MODELS = [
    # SSD Mobilenet V1
    "ssd_mobilenetv1_model-weights_manifest.json",
    "ssd_mobilenetv1_model-shard1",
    "ssd_mobilenetv1_model-shard2",
    # Face Landmark 68
    "face_landmark_68_model-weights_manifest.json",
    "face_landmark_68_model-shard1",
    # Face Recognition
    "face_recognition_model-weights_manifest.json",
    "face_recognition_model-shard1",
    # Age & Gender
    "age_gender_model-weights_manifest.json",
    "age_gender_model-shard1",
    # Tiny Face Detector (Opcional, mas bom ter de fallback)
    "tiny_face_detector_model-weights_manifest.json",
    "tiny_face_detector_model-shard1"
]

def download_models():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"Iniciando download dos modelos do face-api.js para: {OUTPUT_DIR}\n")
    
    for model in MODELS:
        target_path = os.path.join(OUTPUT_DIR, model)
        if os.path.exists(target_path):
            print(f"[PULADO] {model} já existe.")
            continue
            
        url = BASE_URL + model
        print(f"[BAIXANDO] {model} de {url}...")
        try:
            urllib.request.urlretrieve(url, target_path)
            print(f"[OK] {model} baixado com sucesso.")
        except Exception as e:
            print(f"[ERRO] Falha ao baixar {model}: {e}")

if __name__ == "__main__":
    download_models()
