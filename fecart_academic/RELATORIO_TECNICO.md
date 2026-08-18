# Relatório Técnico: Limitações, Desafios e Aspectos Regulatórios (LGPD) em Sistemas de Monitoramento Inteligente

Este documento constitui o referencial teórico e técnico de análise de riscos do projeto de pesquisa **"O uso da inteligência artificial para a localização de entidades na sociedade brasileira com o uso de câmeras"**, apresentado na **FECART 2026 da FECAP**.

---

## 1. Análise de Limitações Técnicas dos Modelos de Visão Computacional

Sistemas modernos de monitoramento baseados em inteligência artificial e visão computacional (como o acoplamento YOLOv8 + ResNet-18 implementado neste protótipo) apresentam excelentes resultados práticos, porém estão sujeitos a limitações intrínsecas ao ambiente físico e à física óptica.

### A. Condições Ópticas e Iluminação
* **Subexposição e Ruído Sensor**: Ambientes com baixa luminosidade (monitoramento noturno ou áreas de sombra) degradam a qualidade dos pixels capturados pelas câmeras. O ruído térmico introduzido pelo sensor da câmera dificulta tanto a detecção de caixas delimitadoras pelo YOLO quanto a extração de embeddings consistentes pela ResNet, reduzindo a acurácia de similaridade.
* **Superexposição e Contraluz**: Fontes intensas de luz posicionadas atrás do alvo (contraluz) criam silhuetas escuras, anulando informações cruciais de textura e cor de roupas/rosto necessárias para a busca por similaridade.

### B. Oclusão Parcial e Escala
* **Oclusão Física**: Em ambientes com alta densidade demográfica (como feiras, corredores acadêmicos cheios ou pontos de tráfego), entidades frequentemente se posicionam à frente de outras. Oclusões parciais impedem a extração completa do vetor de características (embedding), fazendo com que a similaridade de cosseno falhe ao comparar partes incompletas do corpo.
* **Escala e Resolução**: Câmeras posicionadas a grandes distâncias produzem recortes (crops) de entidades muito pequenos (ex: menos de 50x50 pixels). A interpolação para o redimensionamento exigido pelos modelos profundos (geralmente 128x128 ou 224x224 pixels) gera artefatos de compressão e desfoque, destruindo as características discriminativas da entidade.

### C. Mudanças de Pose, Ângulo e Padrões de Roupas (Re-ID)
* **Variação de Perspectiva (Pose/Ângulo)**: O vetor de características de uma pessoa vista de frente difere substancialmente da mesma pessoa vista de costas ou de cima. Embora redes convolucionais profundas (como a ResNet) possuam certa invariância espacial, mudanças drásticas de ângulo de câmera diminuem consideravelmente a taxa de correspondência.
* **Limitação Temporal de Vestuário**: Sistemas de Re-identificação (Re-ID) de pessoas baseados na aparência física geral dependem fortemente das roupas que a entidade está vestindo no dia do monitoramento. Se a entidade trocar de casaco ou vestimenta, o sistema não conseguirá associá-la aos registros históricos anteriores, evidenciando que sistemas de Re-ID por aparência são soluções focadas em curtos intervalos de tempo.

---

## 2. Aspectos Éticos e Jurídicos: Conformidade com a LGPD (Lei 13.709/2018)

O processamento de imagens e vídeos contendo dados de cidadãos identificáveis entra diretamente no escopo de aplicação da Lei Geral de Proteção de Dados (LGPD). A imagem de um indivíduo constitui um **dado pessoal**, e quando submetida a processamentos de IA para fins de identificação/biometria, é categorizada como **dado pessoal sensível** (Art. 5º, II da LGPD).

### A. Princípios Fundamentais Aplicados
1. **Minimização e Finalidade (Art. 6º, I e III)**: O sistema de localização de entidades deve ser restrito aos propósitos legítimos de segurança patrimonial e controle de acesso em áreas autorizadas. A coleta indiscriminada ou o processamento de imagens sem finalidade específica de segurança infringe diretamente a lei.
2. **Segurança e Confidencialidade (Art. 6º, VII)**: Dados sensíveis (como CPFs de referência e fotos biométricas) devem ser protegidos contra acessos não autorizados. No escopo deste projeto:
   - Os CPFs inseridos são mascarados na interface de exibição.
   - Os CPFs originais são convertidos em hashes irreversíveis (`cpf_hash` via SHA-256) que atuam como *blind index* para detecção de duplicidade, impedindo o armazenamento do dado em formato plaintext no banco de dados.
3. **Transparência (Art. 6º, VI)**: A sociedade monitorada deve ser devidamente informada sobre a presença das câmeras e a finalidade do processamento de dados por meio de avisos físicos estruturados nos locais físicos monitorados.

### B. Bases Legais para o Tratamento (Art. 7º e Art. 11)
Sistemas de monitoramento público ou privado em cidades inteligentes e campi universitários geralmente se apoiam em duas bases legais principais:
* **Legítimo Interesse do Controlador (Art. 7º, IX)**: Aplicado para garantir a segurança de bens e pessoas dentro do campus/estabelecimento privado, ponderando-se os direitos fundamentais do cidadão monitorado.
* **Tutela da Segurança / Prevenção à Fraude (Art. 11, II, "g")**: Essencial quando o processamento de dados pessoais sensíveis (biometria) visa garantir a segurança de acesso a áreas críticas de laboratórios e exames acadêmicos, prevenindo fraudes de identidade.
* **Consentimento (Art. 7º, I)**: No caso de registros cadastrais voluntários (por exemplo, listas de busca autorizadas ou monitoramento de acompanhamento de alunos e professores), o consentimento deve ser registrado por termo inequívoco, permitindo ao titular revogar o acesso a qualquer momento.

---

## 3. Diretrizes de Segurança Recomendadas para Cidades Inteligentes

Para mitigar os riscos associados ao monitoramento contínuo por IA, projetos de cidades inteligentes e segurança institucional devem adotar as seguintes salvaguardas:
1. **Edge AI / Processamento na Borda**: Sempre que possível, o processamento de imagens (detecção YOLO e extração de características) deve ocorrer na própria câmera ou em servidores locais (como feito neste protótipo offline). Isso evita o tráfego de imagens brutas em canais de internet abertos ou armazenamento em nuvens de terceiros.
2. **Criptografia e Descarte Automático**: Dados de reconhecimento de pessoas desconhecidas que não geraram alertas de segurança devem ser automaticamente descartados após um curto período de retenção (ex: 72 horas).
3. **Trilha de Auditoria Permanente (Logs)**: O sistema deve registrar de forma auditável e imutável todas as consultas realizadas por operadores humanos (tabela `audit_logs`). Isso desencoraja desvios de finalidade e vazamentos provocados por agentes internos autorizados.
