import os
import cv2
import numpy as np

# Tentar importar PyTorch para extracao profunda
PYTORCH_AVAILABLE = False
try:
    import torch
    import torchvision.models as models
    import torchvision.transforms as transforms
    from PIL import Image
    PYTORCH_AVAILABLE = True
except ImportError:
    print("[SEARCH] PyTorch nao disponivel. Usando extrator de fallback baseado em Histograma de Cores.")

class FeatureExtractor:
    def __init__(self):
        """
        Inicializa o extrator de características.
        Usa PyTorch (ResNet-18 + projecao aleatoria para 128 dim) se disponivel.
        Caso contrario, usa fallback baseado em histograma de cores e texturas.
        """
        self.use_pytorch = PYTORCH_AVAILABLE
        self.embedding_dim = 128
        
        if self.use_pytorch:
            try:
                print("[SEARCH] Inicializando modelo ResNet-18...")
                # Carrega resnet18 (mais leve que resnet50, ideal para CPUs de apresentacao)
                # Usa pesos padrao da biblioteca
                weights = models.ResNet18_Weights.DEFAULT
                self.model = models.resnet18(weights=weights)
                self.model.eval() # Modo de inferencia
                
                # Desativa calculo de gradientes para otimizar velocidade e memoria
                for param in self.model.parameters():
                    param.requires_grad = False
                
                # Definir pipeline de transformacoes da imagem
                self.transform = transforms.Compose([
                    transforms.Resize((128, 128)),
                    transforms.ToTensor(),
                    transforms.Normalize(
                        mean=[0.485, 0.456, 0.406],
                        std=[0.229, 0.224, 0.225]
                    )
                ])
                
                # Criar uma matriz de projecao aleatoria estavel (semente fixa)
                # Projeta do tamanho original da ResNet-18 (512) para o tamanho do banco (128)
                np.random.seed(42)
                self.projection_matrix = np.random.randn(512, self.embedding_dim)
                # Normaliza colunas da matriz de projecao
                self.projection_matrix /= np.linalg.norm(self.projection_matrix, axis=0)
                
                print("[SEARCH] ResNet-18 carregada e pronta.")
            except Exception as e:
                print(f"[SEARCH] Falha ao carregar ResNet-18: {e}. Mudando para fallback local.")
                self.use_pytorch = False

    def extract_features(self, crop_image):
        """
        Extrai vetor de caracteristicas (embedding) de 128 dim de um recorte de imagem.
        Garante que o vetor retornado seja normalizado (L2 norm = 1.0).
        """
        if crop_image is None or crop_image.size == 0:
            return [0.0] * self.embedding_dim

        if self.use_pytorch:
            try:
                # Converter de BGR (OpenCV) para RGB (PIL)
                rgb_image = cv2.cvtColor(crop_image, cv2.COLOR_BGR2RGB)
                pil_img = Image.fromarray(rgb_image)
                
                # Aplicar transformacoes e adicionar dimensao de batch
                tensor_img = self.transform(pil_img).unsqueeze(0)
                
                # Roda a passagem forward ate a camada antes da FC
                # Extrai do avgpool
                with torch.no_grad():
                    # Hook simplificado: passamos pela rede excluindo a FC
                    x = self.model.conv1(tensor_img)
                    x = self.model.bn1(x)
                    x = self.model.relu(x)
                    x = self.model.maxpool(x)
                    
                    x = self.model.layer1(x)
                    x = self.model.layer2(x)
                    x = self.model.layer3(x)
                    x = self.model.layer4(x)
                    
                    x = self.model.avgpool(x)
                    features = torch.flatten(x, 1).cpu().numpy()[0]
                
                # Projetar de 512 para 128 dim
                projected = np.dot(features, self.projection_matrix)
                
                # Normalizacao L2
                norm = np.linalg.norm(projected)
                if norm > 0:
                    projected = projected / norm
                    
                return projected.tolist()
            except Exception as e:
                print(f"[SEARCH] Erro na inferencia PyTorch: {e}. Usando fallback para este frame.")
                # Fallback em caso de falha de execucao
        
        # --- Fallback: Histograma de Cores Local (Sem dependencias de rede) ---
        return self._extract_color_histogram(crop_image)

    def _extract_color_histogram(self, crop_image):
        """Extrai um histograma de cores H-S-V de 128 bins como embedding."""
        # Redimensiona para tamanho estavel
        img = cv2.resize(crop_image, (64, 128))
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        
        # Calcula histograma para H, S e V
        # 64 bins para H, 32 bins para S, 32 bins para V = total 128 dim
        hist_h = cv2.calcHist([hsv], [0], None, [64], [0, 180])
        hist_s = cv2.calcHist([hsv], [1], None, [32], [0, 256])
        hist_v = cv2.calcHist([hsv], [2], None, [32], [0, 256])
        
        # Concatena os histogramas
        features = np.concatenate([hist_h, hist_s, hist_v]).flatten()
        
        # Normalizacao L2
        norm = np.linalg.norm(features)
        if norm > 0:
            features = features / norm
            
        return features.tolist()


def compute_similarity(embedding_a, embedding_b):
    """
    Calcula a similaridade de cosseno entre dois embeddings.
    Retorna um float entre 0.0 (totalmente diferente) e 1.0 (identico).
    Como os vetores ja sao normalizados, a similaridade de cosseno e o produto escalar.
    """
    a = np.array(embedding_a)
    b = np.array(embedding_b)
    
    # Produto escalar
    dot_product = np.dot(a, b)
    
    # Mapeia de [-1, 1] para [0, 1] para fins de exibicao de confianca
    similarity = (dot_product + 1.0) / 2.0
    return float(similarity)

def search_best_match(query_embedding, registered_faces, threshold=0.5):
    """
    Compara o query_embedding com todos os cadastros.
    Retorna o melhor match se a similaridade for superior ao threshold.
    """
    best_match = None
    max_sim = 0.0
    
    for face in registered_faces:
        sim = compute_similarity(query_embedding, face["embedding"])
        if sim > max_sim:
            max_sim = sim
            best_match = face
            
    if max_sim >= threshold:
        return {
            "pessoa_id": best_match["pessoa_id"],
            "nome": best_match["nome"],
            "cpf_mascarado": best_match["cpf_mascarado"],
            "status": best_match["status"],
            "foto_url": best_match["foto_url"],
            "confianca": max_sim
        }
        
    return None

if __name__ == "__main__":
    # Teste rapido de extracao e busca
    extractor = FeatureExtractor()
    dummy_img = np.random.randint(0, 255, (100, 50, 3), dtype=np.uint8)
    emb = extractor.extract_features(dummy_img)
    print(f"[SEARCH] Teste concluido! Vetor gerado de tamanho: {len(emb)}")
