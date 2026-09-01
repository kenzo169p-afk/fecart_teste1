import os
import sys
import hashlib
import json
import shutil
import argparse
from dotenv import load_dotenv

load_dotenv()

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
    if not os.path.exists(filepath):
        return None
    hasher = hashlib.sha256()
    with open(filepath, 'rb') as f:
        buf = f.read(65536)
        while len(buf) > 0:
            hasher.update(buf)
            buf = f.read(65536)
    return hasher.hexdigest()

def authorize(provided_key):
    secret_key = os.getenv("AUDIT_SECRET_KEY")
    if not secret_key:
        print("[ERRO] A variável de ambiente 'AUDIT_SECRET_KEY' não está configurada no seu arquivo .env!")
        print("Defina a chave antes de prosseguir para garantir a segurança do sistema.")
        return False
        
    if provided_key != secret_key:
        print("[ERRO] Chave de autorização incorreta! Esta tentativa foi bloqueada.")
        return False
        
    print("\n[AUTORIZAR] Chave validada com sucesso. Iniciando atualização das assinaturas...")
    
    signatures = {}
    os.makedirs(BACKUP_DIR, exist_ok=True)
    
    for filepath in WATCHED_FILES:
        if os.path.exists(filepath):
            file_hash = get_file_hash(filepath)
            signatures[filepath] = file_hash
            
            # Atualiza o backup do arquivo
            backup_path = os.path.join(BACKUP_DIR, os.path.basename(filepath))
            shutil.copy2(filepath, backup_path)
            print(f" -> Autorizado e salvo em backup: {filepath} (SHA-256: {file_hash[:8]}...)")
        else:
            print(f" -> [AVISO] Arquivo vigiado não existe localmente ainda: {filepath}")
            
    with open(SIGNATURE_FILE, 'w') as f:
        json.dump(signatures, f, indent=4)
        
    print("\n[SUCESSO] Todas as assinaturas foram atualizadas e o backup sincronizado.")
    print("O monitor de integridade agora aceitará as versões atuais destes arquivos.")
    return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Autoriza alterações legítimas nos arquivos-fonte vigiados pelo sistema de auditoria.")
    parser.add_argument("--key", type=str, help="Chave secreta de autorização definida no .env (AUDIT_SECRET_KEY).")
    
    args = parser.parse_args()
    
    key = args.key
    if not key:
        print("=== Sistema de Autorização de Alterações de Código ===")
        try:
            key = input("Digite a chave secreta (AUDIT_SECRET_KEY): ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nOperação cancelada.")
            sys.exit(1)
            
    success = authorize(key)
    if not success:
        sys.exit(1)
