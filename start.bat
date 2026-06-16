@echo off
chcp 65001 > nul
echo ===================================================
echo             SISTEMA SECUREVISION
echo ===================================================
echo.

:: Verifica se o arquivo .env existe. Se não, cria a partir de .env.example
if not exist .env (
    echo [AVISO] Arquivo .env não encontrado na raiz. Criando a partir de .env.example...
    copy .env.example .env
    echo [CONFIG] Arquivo .env criado. IMPORTANTE: Abra o arquivo .env e edite as chaves do seu Supabase.
)

:: Copia o arquivo .env para o diretório backend para que os scripts Python tenham acesso
copy .env backend\.env > nul

:: Inicializa o banco de assinaturas de código para o monitor
echo [SETUP] Inicializando assinaturas autorizadas e backups locais de segurança...
python backend/authorize_changes.py --key ChaveSecretaAuditoriaDeCodigo123!

echo.
echo [INFO] Iniciando serviços em segundo plano...
echo.

:: 1. Inicia o Servidor Backend Flask
start "SecureVision - Flask Backend" cmd /k "python backend/app.py"

:: 2. Inicia o Monitor de Auditoria de Código
start "SecureVision - Monitor de Auditoria" cmd /k "python backend/audit_monitor.py"

:: 3. Inicia o Servidor Frontend Vite
cd frontend
start "SecureVision - Vite Frontend" cmd /k "npm run dev"

cd ..

echo.
echo ===================================================
echo [SUCESSO] Todos os serviços foram inicializados!
echo.
echo - Frontend: Verifique a janela do Vite para a URL local (geralmente http://localhost:5173)
echo - Backend: Rodando em http://localhost:5000
echo - Auditoria: Monitoramento ativo em tempo real
echo ===================================================
echo.
pause
