# SecureVision - Sistema de Monitoramento por Câmera e Reconhecimento Facial

Este é um sistema completo e de alta fidelidade para monitoramento por câmeras com reconhecimento de face e rastreamento em tempo real. Ele usa **Supabase** como banco de dados central (com busca vetorial via `pgvector`), um backend Python leve para suporte a streams RTSP/IP e ONVIF, e uma interface administrativa Glassmorphic moderna.

O sistema foi desenvolvido seguindo boas práticas de segurança, privacidade de dados (LGPD) e conta com um **Monitor de Integridade de Código-Fonte** que previne e reverte alterações não autorizadas nos arquivos de sistema.

---

## 🚀 Como Iniciar o Sistema

### Passo 1: Configurar o Supabase

1. Crie uma conta gratuita em [supabase.com](https://supabase.com) e crie um novo projeto.
2. No painel do seu projeto, vá até o menu **SQL Editor** e clique em **New Query**.
3. Copie o conteúdo do arquivo [supabase/schema.sql](file:///c:/Users/26012317/Documents/GitHub/fecart_teste1/supabase/schema.sql) e clique em **Run**. Isso irá:
   - Ativar a extensão `pgvector`.
   - Criar as tabelas necessárias (`pessoas`, `biometria`, `camera_configs`, `registro_acessos`, `audit_logs`).
   - Habilitar as políticas de segurança RLS.
   - Criar a função RPC `match_face_descriptor` para busca de similaridade por cosseno.
4. Vá em **Storage** no menu lateral, clique em **New Bucket** e crie um bucket chamado `fotos` com acesso **público** (para demonstração simples) ou privado.

### Passo 2: Configurar o arquivo `.env`

1. Na raiz do projeto, você encontrará o arquivo `.env` (criado automaticamente na primeira execução do `start.bat` ou copie de `.env.example`).
2. Abra o arquivo `.env` e substitua as variáveis com as informações obtidas nas configurações do seu projeto Supabase em **Project Settings > API**:
   - `SUPABASE_URL`: URL de acesso REST.
   - `SUPABASE_KEY`: Chave anônima pública (`anon` `public`).
   - `SUPABASE_SERVICE_ROLE_KEY`: Chave secreta de serviço (`service_role` - necessária para o monitor de auditoria registrar logs bypassando RLS).
   - `AUDIT_SECRET_KEY`: Uma senha de sua preferência para autorizar edições de código legítimas (valor padrão: `ChaveSecretaAuditoriaDeCodigo123!`).

### Passo 3: Iniciar o Sistema (Windows)

Dê um duplo clique no arquivo [start.bat](file:///c:/Users/26012317/Documents/GitHub/fecart_teste1/start.bat) ou execute no terminal:
```powershell
.\start.bat
```

Isso irá:
1. Copiar o arquivo `.env` de configuração para a pasta do backend.
2. Inicializar o backup local dos arquivos protegidos e registrar suas assinaturas digitais (hashes).
3. Iniciar o **Servidor Flask Backend** (porta `5000`) para streaming RTSP/ONVIF.
4. Iniciar o **Monitor de Integridade de Código-Fonte** (Auditoria em background).
5. Iniciar o **Servidor Frontend Vite** (abrindo uma janela de terminal que mostrará o endereço, por exemplo `http://localhost:5173`).

---

## 🛡️ Sistema de Auditoria de Integridade de Código

Para atender ao requisito de detectar e bloquear alterações não autorizadas no código-fonte, o sistema possui o daemon `backend/audit_monitor.py`.

### Como Funciona:
* O monitor vigia continuamente os arquivos mais críticos do sistema:
  - `backend/app.py`, `backend/audit_monitor.py`, `backend/authorize_changes.py`
  - `frontend/index.html`, `frontend/src/main.js`, `frontend/src/style.css`
* Se qualquer um destes arquivos for modificado por um editor externo sem autorização prévia, ou for deletado:
  1. O arquivo será **revertido instantaneamente** a partir de uma cópia de segurança localizada no diretório oculto `.shadow_backup/`.
  2. Um log de segurança será gravado na tabela `audit_logs` do Supabase.
  3. Um **alerta visual e sonoro** de alta prioridade será acionado na tela do painel do administrador em tempo real.

### Como realizar alterações autorizadas no código:
Se você for o desenvolvedor autorizado e desejar fazer uma mudança legítima no código:
1. Faça suas alterações nos arquivos.
2. Antes que o monitor reverta (ou se ele estiver pausado), execute o utilitário de autorização informando a sua chave configurada no `.env` (`AUDIT_SECRET_KEY`):
   ```bash
   python backend/authorize_changes.py --key ChaveSecretaAuditoriaDeCodigo123!
   ```
3. O script irá recalcular as assinaturas autorizadas dos arquivos e atualizar a cópia da pasta `.shadow_backup/`.

---

## 🛠️ Arquitetura do Reconhecimento e Rastreamento Facial

* **Processamento no Cliente (Edge AI)**: O processamento de imagem para extrair os vetores de características da face (embeddings de 128 dimensões) é realizado inteiramente no navegador do cliente usando a biblioteca `face-api.js` (através de WebGL com aceleração por GPU). Isso garante que imagens brutas de vídeo não trafeguem pela rede, preservando a largura de banda e a privacidade.
* **Segurança e Proteção de Dados (LGPD)**:
  - O CPF da pessoa é **criptografado localmente com AES-256** antes de ser persistido na tabela `pessoas`. Desta forma, os CPFs ficam totalmente inelegíveis no banco de dados Supabase e só podem ser abertos por administradores autenticados com o passphrase do sistema.
  - Para conformidade com a LGPD, o painel do administrador exige que o check de consentimento do titular seja assinado antes que o botão de cadastro seja habilitado.
* **Algoritmo de Rastreamento (Tracker)**: O rastreamento em tempo real implementa uma lógica baseada em centroides geométricos e distâncias entre frames. Ele atribui um identificador sequencial (ex: `Pessoa #3` ou `Desconhecido #2`) a cada face identificada e desenha trilhas históricas dos movimentos na tela, atualizando a identidade assim que a correspondência com o banco é estabelecida.
