import os
import sys
import time
import hashlib
import json
import shutil
import requests
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from dotenv import load_dotenv

# Carrega variáveis de ambiente
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

WATCHED_FILES = [
    os.path.normpath("backend/app.py"),
    os.path.normpath("backend/audit_monitor.py"),
    os.path.normpath("backend/authorize_changes.py"),
    os.path.normpath("frontend/index.html"),
    os.path.normpath("frontend/main.js"),
    os.path.normpath("frontend/style.css"),
]

BACKUP_DIR = os.path.normpath(".shadow_backup")
SIGNATURE_FILE = os.path.normpath(".audit_signatures.json")

def get_file_hash(filepath):
    """Calcula o hash SHA-256 de um arquivo."""
    if not os.path.exists(filepath):
        return None
    hasher = hashlib.sha256()
    with open(filepath, 'rb') as f:
        buf = f.read(65536)
        while len(buf) > 0:
            hasher.update(buf)
            buf = f.read(65536)
    return hasher.hexdigest()

def log_audit_to_supabase(event_type, description, details, reverted=True):
    """Envia o log de auditoria diretamente para o banco de dados Supabase via REST API."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print("[AUDIT] Supabase não configurado. Ignorando log remoto.")
        return False
        
    url = f"{SUPABASE_URL}/rest/v1/audit_logs"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }
    payload = {
        "tipo_evento": event_type,
        "descricao": description,
        "detalhes": details,
        "revertido": reverted
    }
    try:
        res = requests.post(url, headers=headers, json=payload, timeout=5)
        if res.status_code in [200, 201]:
            print("[AUDIT] Log de auditoria enviado para o Supabase.")
            return True
        else:
            print(f"[AUDIT] Erro ao enviar log: {res.status_code} - {res.text}")
    except Exception as e:
        print(f"[AUDIT] Falha na requisição para Supabase: {e}")
    return False

class CodeIntegrityHandler(FileSystemEventHandler):
    def __init__(self):
        super().__init__()
        self.load_signatures()
        self.last_revert_time = {}

    def load_signatures(self):
        """Carrega as assinaturas autorizadas do arquivo JSON."""
        if os.path.exists(SIGNATURE_FILE):
            with open(SIGNATURE_FILE, 'r') as f:
                self.signatures = json.load(f)
        else:
            print("[AUDIT] [AVISO] Arquivo de assinaturas não encontrado! Inicializando com estado atual...")
            self.signatures = {}
            self.initialize_signatures()

    def initialize_signatures(self):
        """Inicializa as assinaturas dos arquivos existentes e cria o backup na primeira execução."""
        os.makedirs(BACKUP_DIR, exist_ok=True)
        for filepath in WATCHED_FILES:
            if os.path.exists(filepath):
                file_hash = get_file_hash(filepath)
                self.signatures[filepath] = file_hash
                
                # Cria cópia de backup na pasta shadow
                backup_path = os.path.join(BACKUP_DIR, os.path.basename(filepath))
                shutil.copy2(filepath, backup_path)
                
        with open(SIGNATURE_FILE, 'w') as f:
            json.dump(self.signatures, f, indent=4)
        print(f"[AUDIT] Backup e assinaturas iniciais criados para {len(WATCHED_FILES)} arquivos.")

    def handle_modification(self, filepath):
        filepath = os.path.normpath(filepath)
        
        # Ignora arquivos fora da lista vigiada
        if filepath not in WATCHED_FILES:
            # Se for um arquivo temporário gerado no mesmo diretório, ignora
            return

        # Para evitar loops infinitos de re-gatilho de gravação
        now = time.time()
        if filepath in self.last_revert_time and (now - self.last_revert_time[filepath]) < 1.0:
            return

        current_hash = get_file_hash(filepath)
        expected_hash = self.signatures.get(filepath)

        if current_hash != expected_hash:
            print(f"[AUDIT] [ALERTA] Alteração não autorizada detectada em: {filepath}")
            print(f"         Hash Atual: {current_hash}")
            print(f"         Hash Esperado: {expected_hash}")
            
            # Reverte o arquivo imediatamente do backup
            backup_path = os.path.join(BACKUP_DIR, os.path.basename(filepath))
            if os.path.exists(backup_path):
                try:
                    self.last_revert_time[filepath] = now
                    # Aguarda um milissegundo para liberar handles abertos por outros editores
                    time.sleep(0.1)
                    shutil.copy2(backup_path, filepath)
                    print(f"[AUDIT] [BLOQUEADO] Arquivo '{filepath}' foi restaurado com sucesso para a versão autorizada.")
                    
                    # Loga o evento
                    log_audit_to_supabase(
                        event_type="MODIFICACAO_CODIGO",
                        description=f"Alteração não autorizada revertida em {filepath}",
                        details={
                            "arquivo": filepath,
                            "hash_original": expected_hash,
                            "hash_tentativa": current_hash,
                            "status": "revertido_com_sucesso"
                        },
                        reverted=True
                    )
                except Exception as e:
                    print(f"[AUDIT] [ERRO] Falha ao reverter arquivo {filepath}: {e}")
            else:
                print(f"[AUDIT] [ERRO] Backup não encontrado para restaurar '{filepath}'!")

    def on_modified(self, event):
        if not event.is_directory:
            self.handle_modification(event.src_path)

    def on_deleted(self, event):
        if not event.is_directory:
            filepath = os.path.normpath(event.src_path)
            if filepath in WATCHED_FILES:
                print(f"[AUDIT] [ALERTA] Arquivo vigiado deletado: {filepath}")
                backup_path = os.path.join(BACKUP_DIR, os.path.basename(filepath))
                if os.path.exists(backup_path):
                    try:
                        shutil.copy2(backup_path, filepath)
                        print(f"[AUDIT] [BLOQUEADO] Arquivo '{filepath}' foi restaurado do backup.")
                        
                        log_audit_to_supabase(
                            event_type="MODIFICACAO_CODIGO",
                            description=f"Tentativa de remoção bloqueada: {filepath}",
                            details={
                                "arquivo": filepath,
                                "status": "restaurado_apos_remocao"
                            },
                            reverted=True
                        )
                    except Exception as e:
                        print(f"[AUDIT] Falha ao restaurar {filepath}: {e}")

    def on_created(self, event):
        # Bloqueia criação de arquivos estranhos nas pastas vigiadas (backend/ e frontend/)
        # Para fins de demonstração, remove se for inserido algo indevido nos diretórios chave
        if not event.is_directory:
            filepath = os.path.normpath(event.src_path)
            # Verifica se o arquivo está em pastas vigiadas, mas não na lista autorizada
            dirname = os.path.dirname(filepath)
            if dirname in ["backend", "frontend"] and filepath not in WATCHED_FILES:
                # Evita deletar arquivos de pacotes/instalações temporárias
                if "node_modules" not in filepath and ".vite" not in filepath and "__pycache__" not in filepath:
                    print(f"[AUDIT] [ALERTA] Arquivo estranho criado em diretório protegido: {filepath}")
                    try:
                        time.sleep(0.1)
                        os.remove(filepath)
                        print(f"[AUDIT] [BLOQUEADO] Arquivo não autorizado '{filepath}' foi removido.")
                        
                        log_audit_to_supabase(
                            event_type="MODIFICACAO_CODIGO",
                            description=f"Arquivo estranho detectado e removido: {filepath}",
                            details={
                                "arquivo": filepath,
                                "status": "deletado_automaticamente"
                            },
                            reverted=True
                        )
                    except Exception as e:
                        pass

def monitor():
    print("[AUDIT] Iniciando Monitor de Integridade do Código...")
    event_handler = CodeIntegrityHandler()
    observer = Observer()
    
    # Monitora raiz e subpastas
    observer.schedule(event_handler, path="backend", recursive=True)
    observer.schedule(event_handler, path="frontend", recursive=True)
    
    observer.start()
    print("[AUDIT] Monitor ativo e vigiando alterações em tempo real.")
    
    try:
        while True:
            # Recarrega assinaturas periodicamente se o arquivo for modificado pelo script de autorização
            time.sleep(2)
            event_handler.load_signatures()
    except KeyboardInterrupt:
        observer.stop()
    observer.join()

if __name__ == "__main__":
    monitor()
