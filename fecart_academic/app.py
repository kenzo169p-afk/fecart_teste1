import os
import cv2
import json
import uuid
import numpy as np
import pandas as pd
import hashlib
from datetime import datetime
from PIL import Image
import streamlit as st

# Configurar layout do Streamlit
st.set_page_config(
    page_title="FECART 2026 - IA e Localização de Entidades",
    page_icon="🎥",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Caminhos locais
SNAP_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), "data", "snapshots"))
os.makedirs(SNAP_DIR, exist_ok=True)

# Tentar importar os modulos locais de src/
# Adiciona src ao path se necessario
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), "src"))

try:
    from database import (
        init_db, get_connection, register_person, get_all_embeddings,
        register_recognition, add_audit_log
    )
    from camera_config import CameraConfigManager
    from detector import PersonDetector
    from search import FeatureExtractor, search_best_match
except ImportError as e:
    st.error(f"Erro ao importar modulos locais do src: {e}")

# Inicializa banco de dados na primeira execucao
init_db()

# --- Helpers de UI ---

def mask_cpf(cpf):
    """Aplica mascara no CPF (ex: 123.***.***-45)."""
    clean = "".join(filter(str.isdigit, cpf))
    if len(clean) != 11:
        return "CPF Inválido"
    return f"{clean[:3]}.***.***-{clean[-2:]}"

def hash_cpf(cpf):
    """Gera hash SHA-256 unico do CPF para blind indexing."""
    clean = "".join(filter(str.isdigit, cpf))
    return hashlib.sha256(clean.encode('utf-8')).hexdigest()

# --- Lado do Servidor Streamlit: Instanciar Controladores ---

@st.cache_resource
def get_detector():
    return PersonDetector()

@st.cache_resource
def get_extractor():
    return FeatureExtractor()

@st.cache_resource
def get_camera_manager():
    return CameraConfigManager()

# --- RENDERIZACAO DA INTERFACE ---

st.title("🎥 Localização de Entidades com Inteligência Artificial")
st.caption("Projeto Científico Acadêmico para a FECART 2026 - FECAP")

# Sidebar com informacoes do projeto e creditos
with st.sidebar:
    st.image("https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR07wW4Q6Xl6n1s_Kz_y5Gv6R_xszpT21dFVA&s", width=120, output_format="PNG")
    st.title("Sobre o Projeto")
    st.markdown("""
    **Tema:** *O uso da inteligência artificial para a localização de entidades na sociedade brasileira com o uso de câmeras.*
    
    **Mapeamento e Ingestão:**
    - YOLOv8 (Detecção de Pessoas)
    - PyTorch ResNet-18 (Extrator de Embeddings)
    - Similaridade Vetorial (Distância de Cosseno)
    - Persistência Local (SQLite)
    """)
    st.divider()
    st.info("Logado como: **Prof. Administrador FECAP** (admin)")

# Abas principais
tab_monitor, tab_cadastro, tab_busca, tab_relatorios, tab_regulamento = st.tabs([
    "🖥️ Monitoramento em Tempo Real",
    "📝 Cadastro Biométrico",
    "🔍 Busca por Imagem",
    "📊 Logs & Auditoria",
    "⚖️ Relatório Técnico e LGPD"
])

# -----------------------------------------------------------------------------
# ABA 1: MONITORAMENTO EM TEMPO REAL
# -----------------------------------------------------------------------------
with tab_monitor:
    st.header("🖥️ Monitoramento de Câmeras Simultâneo")
    st.write("Visualização e processamento em tempo real das fontes simuladas e webcams.")

    # Instanciar recursos de IA
    try:
        detector = get_detector()
        extractor = get_extractor()
        cam_manager = get_camera_manager()
    except Exception as e:
        st.warning(f"Carregando modelos de IA no background... Aguarde. Detalhe: {e}")
        st.stop()

    cams = cam_manager.get_registered_cameras()
    
    if not cams:
        st.warning("Nenhuma câmera cadastrada no sistema.")
    else:
        # Checkbox para iniciar monitoramento
        run_monitor = st.checkbox("▶️ Iniciar Monitoramento de Vídeo", value=False)
        
        # Colunas para exibir as transmissões lado a lado
        cols = st.columns(len(cams))
        placeholders = [col.empty() for col in cols]
        
        # Mostrar info de conexao de cada camera
        for i, cam in enumerate(cams):
            with cols[i]:
                st.caption(f"**Dispositivo:** {cam['nome']} ({cam['tipo'].upper()})")

        # Obter pessoas cadastradas para realizar re-identificacao facial
        registered_faces = get_all_embeddings()

        if run_monitor:
            try:
                # Abrir fluxos de video
                caps = {}
                for cam in cams:
                    caps[cam["id"]] = cam_manager.get_video_capture(cam["id"])

                # Loop de transmissao
                while run_monitor:
                    for i, cam in enumerate(cams):
                        cap = caps[cam["id"]]
                        
                        # Ler frame (funciona tanto para OpenCV cap quanto para SyntheticVideoCapture)
                        success, frame = cap.read()
                        
                        if not success or frame is None:
                            continue
                            
                        # Roda a detecao YOLOv8
                        detections = detector.detect_people(frame, conf_threshold=0.4)
                        
                        # Desenha caixas e realiza busca por similaridade
                        for det in detections:
                            x1, y1, x2, y2 = det["box"]
                            conf = det["confidence"]
                            
                            # Realiza crop da entidade detectada
                            crop = frame[max(0, y1):min(frame.shape[0], y2), max(0, x1):min(frame.shape[1], x2)]
                            
                            label = "Entidade"
                            color = (255, 120, 0) # Laranja padrao
                            
                            # Se existirem pessoas cadastradas, tenta re-identificar pelo embedding
                            if len(registered_faces) > 0 and crop.size > 0:
                                try:
                                    crop_embedding = extractor.extract_features(crop)
                                    match = search_best_match(crop_embedding, registered_faces, threshold=0.55)
                                    
                                    if match:
                                        label = f"{match['nome']} ({int(match['confianca']*100)}%)"
                                        if match["status"] == "bloqueado":
                                            color = (0, 0, 255) # Vermelho para alertas
                                            label = f"⚠️ [BLOQUEADO] {match['nome']}"
                                            # Salvar snapshot do alerta
                                            snap_name = f"alerta_{match['nome']}_{uuid.uuid4().hex[:8]}.jpg"
                                            snap_path = os.path.join(SNAP_DIR, snap_name)
                                            cv2.imwrite(snap_path, frame)
                                            # Gravar reconhecimento
                                            register_recognition(match["pessoa_id"], cam["id"], match["confianca"], snap_name, {"alerta": "Pessoa bloqueada na camera"})
                                        else:
                                            color = (0, 255, 0) # Verde para ativos
                                            # Gravar reconhecimento no historico (sem duplicar excessivamente)
                                            snap_name = f"rec_{match['nome']}_{uuid.uuid4().hex[:8]}.jpg"
                                            snap_path = os.path.join(SNAP_DIR, snap_name)
                                            cv2.imwrite(snap_path, crop)
                                            register_recognition(match["pessoa_id"], cam["id"], match["confianca"], snap_name)
                                except Exception as e:
                                    pass

                            # Desenhar retangulo
                            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                            # Desenhar label
                            cv2.putText(frame, label, (x1, max(15, y1 - 10)), 
                                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

                        # Renderiza no Streamlit correspondente
                        placeholders[i].image(frame, channels="BGR")
            except KeyboardInterrupt:
                pass
            finally:
                cam_manager.release_all()

# -----------------------------------------------------------------------------
# ABA 2: CADASTRO BIOMÉTRICO
# -----------------------------------------------------------------------------
with tab_cadastro:
    st.header("📝 Cadastrar Pessoa de Referência (Entidade)")
    st.write("Cadastre informações e faça o upload da foto de referência para gerar a assinatura biométrica digital.")

    col_form, col_preview = st.columns([2, 1])

    with col_form:
        cad_nome = st.text_input("Nome Completo", placeholder="Ex: João da Silva")
        cad_idade = st.number_input("Idade", min_value=0, max_value=120, value=25)
        cad_cpf = st.text_input("CPF (Apenas números)", max_chars=11, placeholder="00000000000")
        
        # Upload de Imagem de Referencia
        uploaded_file = st.file_uploader("Selecione a Imagem de Referência (Face/Corpo)", type=["jpg", "png", "jpeg"])
        
        # Consentimento LGPD
        st.subheader("Termo de Consentimento (LGPD)")
        consent = st.checkbox(
            "Declaro consentimento livre, informado e inequívoco para que os dados pessoais e biométricos coletados sejam processados com a finalidade exclusiva de segurança e monitoramento de circulação interna no campus, em conformidade com as diretrizes da Lei Geral de Proteção de Dados (Lei nº 13.709/2018)."
        )

        btn_cadastrar = st.button("Salvar e Gerar Embedding", disabled=not consent)

    with col_preview:
        st.subheader("Visualização da Foto")
        if uploaded_file:
            st.image(uploaded_file, caption="Imagem Carregada", use_column_width=True)
        else:
            st.info("Aguardando upload da imagem...")

    if btn_cadastrar:
        if not cad_nome or not cad_cpf or not uploaded_file:
            st.error("Por favor, preencha todos os campos obrigatórios e envie a imagem.")
        elif len(cad_cpf) != 11 or not cad_cpf.isdigit():
            st.error("CPF deve conter exatamente 11 dígitos numéricos.")
        else:
            with st.spinner("Processando imagem e extraindo características visuais..."):
                try:
                    # Carrega imagem
                    file_bytes = np.asarray(bytearray(uploaded_file.read()), dtype=np.uint8)
                    img = cv2.imdecode(file_bytes, 1)

                    # Tenta extrair características
                    extractor = get_extractor()
                    embedding = extractor.extract_features(img)

                    # Tratar CPF
                    cpf_masc = mask_cpf(cad_cpf)
                    cpf_h = hash_cpf(cad_cpf)

                    # Salvar foto de referencia no diretorio snapshots
                    foto_nome = f"ref_{cad_nome.lower().replace(' ', '_')}_{uuid.uuid4().hex[:8]}.jpg"
                    foto_path = os.path.join(SNAP_DIR, foto_nome)
                    cv2.imwrite(foto_path, img)

                    # Registrar no banco de dados SQLite
                    pessoa_id = register_person(
                        nome=cad_nome,
                        idade=cad_idade,
                        cpf_mascarado=cpf_masc,
                        cpf_hash=cpf_h,
                        embedding=embedding,
                        foto_url=foto_nome,
                        consentimento=consent,
                        created_by="Prof. Administrador FECAP"
                    )

                    st.success(f"Entidade '{cad_nome}' cadastrada com sucesso! ID: {pessoa_id}")
                    # Grava log administrativo
                    add_audit_log("admin", "CREATE_PERSON", "pessoas", pessoa_id, {"nome": cad_nome, "cpf_mascarado": cpf_masc})
                except ValueError as ve:
                    st.error(str(ve))
                except Exception as ex:
                    st.error(f"Falha ao realizar cadastro: {ex}")

# -----------------------------------------------------------------------------
# ABA 3: BUSCA POR IMAGEM (LOCALIZAÇÃO)
# -----------------------------------------------------------------------------
with tab_busca:
    st.header("🔍 Localizar Entidade no Histórico")
    st.write("Faça upload de uma foto de uma pessoa para realizar busca de similaridade e localizar onde e quando ela passou pelas câmeras.")

    col_upload_busca, col_filtros_busca = st.columns([1, 1])

    with col_upload_busca:
        busca_file = st.file_uploader("Carregar foto de busca", type=["jpg", "png", "jpeg"], key="busca_uploader")
        threshold_busca = st.slider("Limiar de Confiança (Threshold)", min_value=0.3, max_value=0.9, value=0.55, step=0.05)

    with col_filtros_busca:
        # Filtros de data e camera para a busca
        data_busca = st.date_input("Filtrar a partir do dia", value=datetime.today())
        btn_localizar = st.button("Buscar Entidade", key="btn_localizar")

    if btn_localizar and busca_file:
        with st.spinner("Processando busca vetorial no histórico..."):
            try:
                # Carregar e ler imagem
                file_bytes = np.asarray(bytearray(busca_file.read()), dtype=np.uint8)
                img_busca = cv2.imdecode(file_bytes, 1)

                # Extrair características da query
                extractor = get_extractor()
                query_embedding = extractor.extract_features(img_busca)

                # Obter todas as pessoas para encontrar a correspondencia mais proxima
                registered_faces = get_all_embeddings()
                match = search_best_match(query_embedding, registered_faces, threshold=threshold_busca)

                if match:
                    st.success(f"Entidade identificada: **{match['nome']}** (Confiança: {int(match['confianca']*100)}%)")
                    
                    # Buscar ocorrencias na tabela de reconhecimentos
                    conn = get_connection()
                    query = """
                        SELECT r.detected_at, r.confianca, r.imagem_snapshot_url, c.nome AS camera_nome
                        FROM reconhecimentos r
                        JOIN cameras c ON r.camera_id = c.id
                        WHERE r.pessoa_id = ?
                        ORDER BY r.detected_at DESC;
                    """
                    df = pd.read_sql_query(query, conn, params=(match["pessoa_id"],))
                    conn.close()

                    if df.empty:
                        st.info("Nenhuma detecção desta pessoa registrada no histórico do banco de dados.")
                    else:
                        st.subheader(f"Linha do tempo de aparições de {match['nome']}")
                        for idx, row in df.iterrows():
                            c_card1, c_card2 = st.columns([1, 2])
                            with c_card1:
                                snap_url = os.path.join(SNAP_DIR, row["imagem_snapshot_url"])
                                if os.path.exists(snap_url):
                                    st.image(snap_url, width=150, caption="Crop da câmera")
                                else:
                                    st.caption("[Sem Snapshot]")
                            with c_card2:
                                st.write(f"📅 **Data/Hora:** {row['detected_at']}")
                                st.write(f"📹 **Câmera:** {row['camera_nome']}")
                                st.write(f"📈 **Grau de Similaridade:** {int(row['confianca']*100)}%")
                                st.divider()
                else:
                    st.error("Nenhuma correspondência encontrada acima do limiar de confiança no banco de dados.")
            except Exception as e:
                st.error(f"Erro ao processar busca: {e}")

# -----------------------------------------------------------------------------
# ABA 4: LOGS & AUDITORIA
# -----------------------------------------------------------------------------
with tab_relatorios:
    st.header("📊 Registro de Acessos e Logs Administrativos")
    
    subtab_rec, subtab_audit, subtab_integridade = st.tabs([
        "📍 Histórico de Reconhecimentos", 
        "🛡️ Auditoria do Sistema",
        "📂 Integridade do Código"
    ])

    with subtab_rec:
        st.subheader("Registros Recentes de Localização")
        conn = get_connection()
        query = """
            SELECT r.detected_at, p.nome AS pessoa_nome, p.cpf_mascarado, c.nome AS camera_nome, r.confianca
            FROM reconhecimentos r
            LEFT JOIN pessoas p ON r.pessoa_id = p.id
            LEFT JOIN cameras c ON r.camera_id = c.id
            ORDER BY r.detected_at DESC LIMIT 50;
        """
        df_rec = pd.read_sql_query(query, conn)
        conn.close()
        
        if df_rec.empty:
            st.info("Nenhum registro de reconhecimento disponível.")
        else:
            st.dataframe(df_rec, use_container_width=True)

    with subtab_audit:
        st.subheader("Trilha de Auditoria Administrativa")
        conn = get_connection()
        df_audit = pd.read_sql_query("SELECT created_at, user_id, acao, entidade, detalhes FROM audit_logs ORDER BY created_at DESC LIMIT 100;", conn)
        conn.close()
        
        if df_audit.empty:
            st.info("Nenhum log de auditoria administrativo gravado.")
        else:
            st.dataframe(df_audit, use_container_width=True)

    with subtab_integridade:
        st.subheader("Logs de Integridade do Código-Fonte (Watchdog)")
        conn = get_connection()
        df_int = pd.read_sql_query("SELECT created_at, arquivo_alterado, acao_detectada, permitido, motivo FROM source_integrity_logs ORDER BY created_at DESC LIMIT 50;", conn)
        conn.close()
        
        if df_int.empty:
            st.info("Nenhum evento de violação ou alteração registrado.")
        else:
            st.dataframe(df_int, use_container_width=True)

# -----------------------------------------------------------------------------
# ABA 5: RELATÓRIO TÉCNICO E LGPD
# -----------------------------------------------------------------------------
with tab_regulamento:
    st.header("⚖️ Relatório Técnico, Riscos e Conformidade com a LGPD")
    
    # Exibe o relatorio tecnico em Markdown
    doc_path = os.path.normpath(os.path.join(os.path.dirname(__file__), "RELATORIO_TECNICO.md"))
    if os.path.exists(doc_path):
        with open(doc_path, "r", encoding="utf-8") as f:
            st.markdown(f.read())
    else:
        st.info("Relatório Técnico não encontrado. Aguardando geração do arquivo.")
