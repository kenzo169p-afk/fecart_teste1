# SecureVision AI — NPU Surveillance & Biometric Control (FECART 2026)

Protótipo de Visão Computacional, Inteligência Artificial e Vigilância de Alta Disponibilidade desenvolvido para a **FECART 2026 da FECAP**, com o tema:
**"O uso da inteligência artificial para a localização de entidades na sociedade brasileira com o uso de câmeras"**.

---

## 📸 Interface e Design System

O sistema possui uma interface web de nível comercial com visual **Cybersecurity Dark Theme (Navy & Electric Blue)**, reproduzindo:
- **Painel de Monitoramento (Grid 2x2)**: Exibição simultânea de 4 streams de vídeo com detecção em tempo real, badges de autorização (`Authorized` / `RED ALERT - Unauthorized Presence`), caixas delimitadoras e telemetria de NPU.
- **System Integrity Monitor**: Diagnóstico de integridade de arquivos em tempo real e status de nós de cluster.
- **Live Security Log**: Feed lateral de eventos de acesso e alertas de anomalias com atualização contínua.
- **Subject Enrollment**: Módulo de cadastro biométrico com captura por câmera local / upload, extração de vetores matemáticos 128D, mascaramento de CPF (`AES-256`), e termo de consentimento explícito em conformidade com a **LGPD (Lei nº 13.709/2018)**.
- **System Status & Telemetry**: Indicadores de carga de IA, GPU edge, latência de quadros (12ms) e disponibilidade (99.9% uptime).
- **Emergency Lockdown**: Acionamento instantâneo de protocolo de contenção em nível de emergência.
- **Trilha de Auditoria Imutável**: Logs detalhados de todas as ações de operadores e integridade de código.

---

## 🚀 Como Instalar e Rodar

### 1. Pré-requisitos
- Python 3.10 ou superior.

### 2. Instalação de Dependências
Abra o terminal na pasta `fecart_academic` e execute:
```bash
pip install -r requirements.txt --user
```

### 3. Iniciar o Servidor
Execute:
```bash
python app.py
```

Abra o seu navegador no endereço:
**`http://localhost:5000`**

---

## 🏛️ Arquitetura dos Módulos (`src/`)

- `src/database.py`: Banco de dados relacional SQLite (`data/fecart.db`) com 8 tabelas estruturadas e seeds de câmeras e identidades.
- `src/camera_config.py`: Abstração de conexões (Webcam física, streams RTSP/IP e gerador de cenas sintéticas de CCTV de alta fidelidade).
- `src/detector.py`: Integração YOLOv8 (`ultralytics`) para detecção rápida de pessoas.
- `src/search.py`: Extrator de características profundas PyTorch (ResNet-18) projetadas para 128 dimensões com normalização L2 e busca por cosseno.
- `static/css/style.css`: Design System completo com suporte a temas Dark e Light.
- `static/js/app.js`: Controlador Single Page Application (SPA).
