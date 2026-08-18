# SecureVision — Projeto Acadêmico FECART 2026

Este é o repositório oficial do protótipo desenvolvido para o projeto de pesquisa científica: **"O uso da inteligência artificial para a localização de entidades na sociedade brasileira com o uso de câmeras"**, apresentado na **FECART 2026 da FECAP**.

O protótipo utiliza algoritmos modernos de Visão Computacional (YOLOv8 para detecção de pessoas) acoplados a Redes Neurais Convolucionais profundas (PyTorch ResNet-18 para extração de assinaturas de aparência/embeddings) e banco de dados relacional local (SQLite) para mapear, localizar e auditar a circulação de pessoas em ambientes físicos.

---

## 🚀 Requisitos de Instalação e Execução

O sistema foi otimizado para rodar localmente em estações de trabalho de forma simplificada e independente de serviços de nuvem ou credenciais de internet durante apresentações científicas presenciais.

### 📋 Pré-requisitos
- Python 3.10 ou superior instalado no sistema.
- Gerenciador de pacotes `pip` atualizado.

### 🔧 Instalação de Dependências

1. Navegue até a pasta do projeto acadêmico:
   ```bash
   cd fecart_academic
   ```

2. Instale as bibliotecas requeridas listadas no arquivo `requirements.txt`:
   ```bash
   pip install -r requirements.txt --user
   ```

*Nota: Caso o seu sistema possua Python 3.13 com NumPy 2.x instalado globalmente, o instalador atualizará o OpenCV para a versão 5.0+, que possui compatibilidade nativa com NumPy 2.x, evitando erros de importação.*

---

## 💻 Como Iniciar o Painel Streamlit

Após instalar as dependências com sucesso, execute o comando abaixo na pasta `fecart_academic`:

```bash
streamlit run app.py
```

O Streamlit iniciará um servidor web local e abrirá automaticamente a interface do usuário no seu navegador padrão (geralmente no endereço `http://localhost:8501`).

---

## 🛠️ Funcionamento dos Painéis da Aplicação

### 1. Monitoramento em Tempo Real (`🖥️ Monitoramento em Tempo Real`)
- **Fontes Simuladas Simultâneas**: O sistema inicia e monitora simultaneamente até 3 câmeras (Câmera 1: Webcam Local, Câmera 2: Entrada FECAP, Câmera 3: Auditório FECAP).
- **Fallback Sintético de Falhas**: Caso os arquivos de vídeo de teste não existam localmente, o módulo `src/camera_config.py` aciona automaticamente um gerador de quadros sintéticos (SyntheticVideoCapture) que simula o tráfego de pessoas (entidades coloridas se movimentando em um corredor) para permitir testes completos de inferência sem dependências de arquivos externos pesados.
- **Detecção YOLOv8**: O sistema detecta pessoas na tela e desenha as caixas delimitadoras laranja.
- **Re-identificação e Alerta**: Pessoas previamente cadastradas são identificadas por cores verdes. Se o status da pessoa for alterado para **bloqueado** no banco de dados, o monitor altera a caixa delimitadora para vermelha e dispara um aviso sonoro duplo e piscadas no painel.

### 2. Cadastro Biométrico (`📝 Cadastro Biométrico`)
- Permite o cadastro do nome, idade, CPF (com validação de formato e máscara de segurança) e envio de uma foto de referência.
- **Termo de Consentimento LGPD**: O botão de cadastro permanece bloqueado até o operador ler e marcar a caixa de consentimento obrigatória.
- **Segurança da Informação**: O CPF é mascarado na interface gráfica (`123.***.***-45`) e armazenado como um Hash unidirecional e irreversível (`cpf_hash` via SHA-256) impedindo duplicidades sem expor o CPF em formato texto.

### 3. Busca por Imagem (`🔍 Busca por Imagem`)
- Faça o upload da imagem de qualquer pessoa para buscar o histórico de localizações dela.
- O sistema calcula o embedding de 128 dimensões do recorte da pessoa e faz a busca vetorial por cosseno contra a tabela `face_embeddings`.
- Retorna uma linha do tempo detalhada mostrando o horário, a câmera de origem e a foto capturada do frame onde o indivíduo foi localizado.

### 4. Logs e Auditoria (`📊 Logs & Auditoria`)
- **Histórico de Reconhecimentos**: Mostra a lista histórica detalhada de todas as detecções válidas efetuadas pela rede.
- **Trilha de Auditoria**: Registra logs contínuos de quem efetuou consultas, cadastrou novas pessoas ou deletou registros, garantindo total transparência.

### 5. Relatório Técnico (`⚖️ Relatório Técnico e LGPD`)
- Exibe o documento acadêmico `RELATORIO_TECNICO.md` contendo a análise profunda das limitações ópticas, físicas e de pose do modelo, e os cuidados jurídicos estruturados com a LGPD em cidades inteligentes.
