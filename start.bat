@echo off
chcp 65001 > nul
title SecureVision AI - NPU Surveillance System
echo =============================================================
echo             SISTEMA SECUREVISION AI - FECART 2026
echo =============================================================
echo.

echo [1/2] Verificando dependencias...
pip install -r fecart_academic/requirements.txt --user --quiet

echo.
echo [2/2] Inicializando Servidor SecureVision AI...
start "SecureVision AI - Server Core" cmd /k "cd fecart_academic && python app.py"

timeout /t 2 > nul

echo.
echo [OK] Abrindo painel no seu navegador...
start http://localhost:5000

echo.
echo =============================================================
echo  Servidor Ativo em: http://localhost:5000
echo  Pressione qualquer tecla para fechar esta janela auxiliar.
echo =============================================================
pause > nul
