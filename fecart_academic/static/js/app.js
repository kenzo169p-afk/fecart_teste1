/**
 * SecureVision AI — Frontend Application Controller (Enterprise Edition)
 * Multilingual Architecture: Português (PT-BR), English (EN-US), 简体中文 (ZH-CN)
 * Designed with 20+ years linguistic precision in Technical English, Cyber Surveillance, and Chinese NLP.
 */

// --- Anti-Tamper & Kiosk Warning ---
document.addEventListener('keydown', (e) => {
  if (e.key === 'F12' || e.keyCode === 123) {
    e.preventDefault();
    showToastNotification(window.getSystemTranslation ? window.getSystemTranslation('kiosk_f12') : "Acesso Bloqueado: F12");
    return false;
  }
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) {
    e.preventDefault();
    showToastNotification(window.getSystemTranslation ? window.getSystemTranslation('kiosk_devtools') : "Acesso Bloqueado: Inspecionar");
    return false;
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U')) {
    e.preventDefault();
    showToastNotification(window.getSystemTranslation ? window.getSystemTranslation('kiosk_source') : "Acesso Bloqueado: Código-Fonte");
    return false;
  }
});

document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  showToastNotification(window.getSystemTranslation ? window.getSystemTranslation('kiosk_context') : "Menu de contexto bloqueado.");
  return false;
});

function showToastNotification(text) {
  let toast = document.getElementById('secWarningToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'secWarningToast';
    toast.style.cssText = `
      position: fixed; bottom: 20px; right: 20px; z-index: 999999;
      background: rgba(185, 28, 28, 0.95); color: #ffffff;
      padding: 12px 18px; border-radius: 8px; font-size: 0.82rem; font-weight: 600;
      border: 1px solid #ef4444; box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      display: flex; align-items: center; gap: 8px; transition: all 0.3s ease;
      font-family: Inter, sans-serif;
    `;
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<i class="fa-solid fa-shield-halved"></i> ${text}`;
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';

  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
  }, 2500);
}

// --- Comprehensive 3-Language Master Translation Dictionary ---
const translations = {
  pt: {
    // Auth Portal
    auth_portal_title: "SecureVision AI — Portal de Acesso",
    auth_portal_sub: "Autenticação Zero-Trust • Criptografia Argon2id & Sessão JWT",
    tab_login: "Entrar no Sistema",
    tab_register: "Criar Conta de Operador",
    label_username: "Usuário / Login",
    ph_login_user: "Ex: admin ou seu_login",
    label_birthdate: "Data de Nascimento",
    label_password: "Senha de Operador",
    ph_password: "••••••••••••",
    login_btn: "Autenticar e Acessar Sistema",
    label_fullname: "Nome Completo do Operador",
    ph_fullname: "Ex: Samantha Carter",
    label_login_user: "Login de Usuário (Único)",
    ph_reg_user: "Ex: scarter",
    register_btn: "Criar Conta de Operador",
    dept_sec_mgmt: "Gestão de Segurança",
    dept_ops: "Operações",

    // Sidebar & Brand
    brand_title: "SecureVision",
    vigilance_high: "Nível de Vigilância: Alto",
    nav_status: "Status do Sistema",
    nav_monitoring: "Monitoramento",
    nav_enrollment: "Cadastro",
    nav_personnel: "Pessoas Registradas",
    nav_logs: "Logs de Auditoria",
    nav_settings: "Configurações",
    nav_support: "Suporte",

    // Topbar
    stat_fps: "FPS (Médio)",
    stat_gpu: "GPU Edge",
    stat_streams: "Streams Ativos",
    search_placeholder: "Buscar câmeras, logs, pessoas...",

    // Tab 1: Monitoring
    integrity_title: "Monitor de Integridade do Sistema",
    integrity_cluster: "CLUSTER_NÓ_ALFA • Última Verificação: 0.2s atrás",
    files_scanned_label: "Arquivos Verificados",
    core_modules_label: "Módulos Principais",
    badge_secure: "SEGURO",
    live_log_title: "Registro de Segurança ao Vivo",
    filter_link: "Filtrar",
    evt_routine: "Varredura de Rotina",
    evt_match: "Identificação Positiva",
    evt_model: "Modelo Atualizado",
    evt_unauthorized: "Presença Não Autorizada",

    // Tab 2: Enrollment
    capture_title: "Captura de Identidade",
    capture_desc: "Extração de vetor matemático facial 128D em isolamento Zero-Trust.",
    sensor_active: "Sensor Ativo • NPU Zero-Trust",
    upload_btn: "Carregar Imagem de Arquivo",
    emb_generated_title: "Embedding 128D Gerado",
    emb_generated_desc: "Vetor normalizado na hiperesfera unitária (L2)",
    hash_display: "HASH DO EMBEDDING: ",
    subject_id_title: "Identidade do Titular",
    subject_id_desc: "Vincula o vetor biométrico ao perfil cadastral do titular.",
    label_full_name: "Nome Completo Legal",
    ph_full_name: "Digite o nome completo legal",
    label_national_id: "Documento Nacional (CPF)",
    label_dept: "Departamento",
    dept_eng: "Engenharia",
    dept_it: "Infraestrutura de TI",
    dept_sec: "Segurança Patrimonial",
    dept_adm: "Administração",
    dept_vis: "Visitante",
    label_clearance: "Nível de Acesso (Clearance)",
    clearance_1: "Nível 1 (Básico)",
    clearance_2: "Nível 2 (Funcionário)",
    clearance_3: "Nível 3 (Sênior)",
    clearance_4: "Nível 4 (Executivo)",
    label_est_age: "Idade Estimada",
    label_crim_record: "Ficha de Segurança / Antecedentes",
    opt_crim_cleared: "🟢 Autorizado / Sem Antecedentes (Ficha Limpa)",
    opt_crim_suspect: "🟡 Suspeito / Em Investigação (Monitorar)",
    opt_crim_theft: "🔴 Ladrão / Histórico de Furto ou Roubo (Bloquear)",
    opt_crim_wanted: "🚨 Mandado de Prisão / Procurado (Alerta Máximo)",
    label_incident_desc: "Descrição do que a pessoa fez (Delito ou Histórico)",
    ph_incident_desc: "Ex: Furto de equipamentos no servidor, invasão de perímetro, sem ocorrências...",
    lgpd_title: "Aviso de Conformidade LGPD",
    lgpd_text: "A coleta de dados biométricos requer consentimento expresso conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 - LGPD). Este dado é armazenado localmente como um vetor matemático 128D irreversível.",
    lgpd_controller: "Controlador de Dados: SecureVision AI Systems Inc. / FECAP",
    lgpd_consent_check: "Confirmo que o titular assinou o Termo de Consentimento Biométrico nos termos da LGPD.",
    btn_enroll_submit: "Cadastrar Identidade",
    active_enrolled_title: "Identidades Cadastradas Ativas",

    // Tab 3: System Status
    status_title: "Visão Geral de Integridade e Desempenho do Sistema",
    status_sub: "Monitoramento contínuo de nós de borda NPU e telemetria de integridade das câmeras.",
    kpi_load_title: "Carga de Processamento NPU",
    kpi_load_sub: "Estável",
    kpi_anom_title: "Anomalias Ativas",
    kpi_anom_sub: "Requer Atenção",
    kpi_lat_title: "Latência de Frame",
    kpi_lat_sub: "Ótima",
    kpi_uptime_title: "Tempo de Atividade",
    kpi_uptime_sub: "Nós de Borda Online",
    diag_table_title: "Matriz de Diagnóstico de Nós de Câmera",
    th_code: "Código",
    th_location: "Localização",
    th_type: "Tipo",
    th_resolution: "Resolução",
    th_fps: "FPS Alvo",
    th_status: "Status",
    badge_online: "ONLINE",
    badge_alert: "ALERTA",

    // Tab 4: Personnel
    personnel_title: "Diretório de Pessoas Registradas",
    personnel_sub: "Base biométrica cadastral com Nome Completo, CPF mascarado, Data de Nascimento e Histórico de Antecedentes (LGPD Compliant).",
    filter_personnel_ph: "Filtrar por nome, CPF, depto ou histórico...",
    purge_all_btn: "Remover Geral (Todos)",
    kpi_total_entities: "Total de Pessoas Registradas",
    kpi_active_128d: "Biometria Ativa (128D)",
    kpi_sec_clearance: "Níveis de Acesso",
    kpi_rbac_sub: "Segmentado por RBAC",
    kpi_std_title: "Padrão de Proteção",
    kpi_consent_chained: "Consentimento Encadeado",
    card_cpf: "CPF (Documento)",
    card_birth: "Data de Nascimento",
    card_reg: "Data de Registro no Sistema",
    card_hash: "Hash 128D:",
    card_del_title: "Remover apenas esta pessoa",
    crim_cleared: "🟢 FICHA LIMPA / AUTORIZADO",
    crim_suspect: "🟡 SUSPEITO / EM OBSERVAÇÃO",
    crim_theft: "🔴 LADRÃO / HISTÓRICO DE FURTO",
    crim_wanted: "🚨 PROCURADO / MANDADO ATIVO",
    card_incident_label: "Ocorrência / Histórico do Delito:",
    empty_personnel: "Nenhuma pessoa encontrada com o termo pesquisado.",

    // Tab 5: Logs
    logs_title: "Logs de Integridade e Auditoria",
    logs_sub: "Trilha imutável de todas as operações biométricas, logins e alterações no sistema (LGPD Art. 6º VII).",
    th_timestamp: "Carimbo de Data/Hora",
    th_operator: "Operador",
    th_action: "Ação",
    th_target: "Entidade Alvo",
    th_details: "Detalhes",

    // System Prompts & Confirmations
    confirm_del_single: "Deseja realmente remover '{name}' da base biométrica?",
    confirm_del_all_1: "ATENÇÃO CRÍTICA (Expurgo Geral):\nDeseja realmente remover TODAS as {count} pessoas da base de dados?\n\nEsta ação apagará todos os registros e vetores faciais.",
    confirm_del_all_2: "Confirmação Final: Deseja prosseguir com o expurgo total de todos os registros biométricos?",
    purge_done: "Expurgo concluído: {count} registros removidos.",
    del_done: "Entidade '{name}' removida com sucesso.",
    kiosk_f12: "Acesso Bloqueado: Ferramentas de desenvolvedor restritas por política NPU.",
    kiosk_devtools: "Acesso Bloqueado: Atalho de inspeção restrito por protocolo.",
    kiosk_source: "Acesso Bloqueado: Exibição de código-fonte desativada.",
    kiosk_context: "Menu de contexto bloqueado por política de segurança."
  },

  en: {
    // Auth Portal
    auth_portal_title: "SecureVision AI — Access Portal",
    auth_portal_sub: "Zero-Trust Authentication • Argon2id Encryption & JWT Session",
    tab_login: "Sign In",
    tab_register: "Register Operator",
    label_username: "Username / Login",
    ph_login_user: "E.g. admin or username",
    label_birthdate: "Date of Birth",
    label_password: "Operator Password",
    ph_password: "••••••••••••",
    login_btn: "Authenticate & Enter System",
    label_fullname: "Operator Full Legal Name",
    ph_fullname: "E.g. Samantha Carter",
    label_login_user: "Unique Username",
    ph_reg_user: "E.g. scarter",
    register_btn: "Create Operator Account",
    dept_sec_mgmt: "Security Management",
    dept_ops: "Operations",

    // Sidebar & Brand
    brand_title: "SecureVision",
    vigilance_high: "Vigilance Level: High",
    nav_status: "System Status",
    nav_monitoring: "Monitoring",
    nav_enrollment: "Enrollment",
    nav_personnel: "Personnel",
    nav_logs: "Logs",
    nav_settings: "Settings",
    nav_support: "Support",

    // Topbar
    stat_fps: "FPS (Avg)",
    stat_gpu: "Edge GPU",
    stat_streams: "Active Streams",
    search_placeholder: "Search camera feeds, logs, personnel...",

    // Tab 1: Monitoring
    integrity_title: "System Integrity Monitor",
    integrity_cluster: "NODE_CLUSTER_ALPHA • Last Check: 0.2s ago",
    files_scanned_label: "Files Scanned",
    core_modules_label: "Core Modules",
    badge_secure: "SECURE",
    live_log_title: "Live Security Log",
    filter_link: "Filter",
    evt_routine: "Routine Scan",
    evt_match: "Identity Match",
    evt_model: "Model Updated",
    evt_unauthorized: "Unauthorized Presence",

    // Tab 2: Enrollment
    capture_title: "Identity Capture",
    capture_desc: "Extract local 128D facial mathematical vector in zero-trust isolation.",
    sensor_active: "Sensor Active • Zero-Trust NPU",
    upload_btn: "Upload Image from File",
    emb_generated_title: "128D Embedding Generated",
    emb_generated_desc: "Vector normalized to unit sphere (L2)",
    hash_display: "EMBEDDING HASH: ",
    subject_id_title: "Subject Identity",
    subject_id_desc: "Link mathematical biometric vector to legal subject profile.",
    label_full_name: "Full Legal Name",
    ph_full_name: "Enter full legal name",
    label_national_id: "National ID (CPF)",
    label_dept: "Department",
    dept_eng: "Engineering",
    dept_it: "IT Infrastructure",
    dept_sec: "Corporate Security",
    dept_adm: "Administration",
    dept_vis: "Visitor",
    label_clearance: "Clearance Level",
    clearance_1: "Level 1 (Basic)",
    clearance_2: "Level 2 (Staff)",
    clearance_3: "Level 3 (Senior)",
    clearance_4: "Level 4 (Executive)",
    label_est_age: "Estimated Age",
    label_crim_record: "Security Profile & Background Record",
    opt_crim_cleared: "🟢 Authorized / Clean Record (Cleared)",
    opt_crim_suspect: "🟡 Suspect / Under Investigation (Watch)",
    opt_crim_theft: "🔴 Convicted Thief / Theft History (Block)",
    opt_crim_wanted: "🚨 Active Arrest Warrant / Wanted (Critical)",
    label_incident_desc: "Incident Log / Offense History Description",
    ph_incident_desc: "E.g. Server room hardware theft, unauthorized perimeter breach, clean record...",
    lgpd_title: "Data Privacy & LGPD Notice",
    lgpd_text: "Biometric data collection requires explicit subject consent pursuant to Data Protection Laws (Lei nº 13.709/2018 - LGPD). Data is stored locally as an irreversible 128D mathematical vector.",
    lgpd_controller: "Data Controller: SecureVision AI Systems Inc. / FECAP",
    lgpd_consent_check: "I confirm the subject has reviewed and signed the Biometric Data Processing Agreement.",
    btn_enroll_submit: "Enroll Identity",
    active_enrolled_title: "Active Enrolled Entities",

    // Tab 3: System Status
    status_title: "System Integrity & Performance Overview",
    status_sub: "Continuous NPU edge node monitoring and camera health telemetry.",
    kpi_load_title: "AI Processing Load",
    kpi_load_sub: "Stable",
    kpi_anom_title: "Active Anomalies",
    kpi_anom_sub: "Requires Attention",
    kpi_lat_title: "Frame Latency",
    kpi_lat_sub: "Optimal",
    kpi_uptime_title: "System Uptime",
    kpi_uptime_sub: "Edge Nodes Online",
    diag_table_title: "Camera Stream Nodes Diagnostic Matrix",
    th_code: "Code",
    th_location: "Location",
    th_type: "Type",
    th_resolution: "Resolution",
    th_fps: "Target FPS",
    th_status: "Status",
    badge_online: "ONLINE",
    badge_alert: "ALERT",

    // Tab 4: Personnel
    personnel_title: "Registered Entities & Personnel Directory",
    personnel_sub: "Corporate biometric database with demographic data, masked ID, Date of Birth, and Security Background Records (LGPD Compliant).",
    filter_personnel_ph: "Filter by name, ID, department or background...",
    purge_all_btn: "Purge All (Delete All)",
    kpi_total_entities: "Total Registered Entities",
    kpi_active_128d: "Active Biometrics (128D)",
    kpi_sec_clearance: "Security Clearance",
    kpi_rbac_sub: "RBAC Segmented",
    kpi_std_title: "Compliance Standard",
    kpi_consent_chained: "Consent Chained",
    card_cpf: "National ID (CPF)",
    card_birth: "Date of Birth",
    card_reg: "System Registration Date",
    card_hash: "128D Hash:",
    card_del_title: "Remove this person only",
    crim_cleared: "🟢 CLEARED / AUTHORIZED",
    crim_suspect: "🟡 SUSPECT / UNDER WATCH",
    crim_theft: "🔴 THEFT / CONVICTED THIEF",
    crim_wanted: "🚨 WANTED / ACTIVE WARRANT",
    card_incident_label: "Incident / Crime History Details:",
    empty_personnel: "No entities found matching the search query.",

    // Tab 5: Logs
    logs_title: "Audit & Source Integrity Logs",
    logs_sub: "Immutable activity trail of all biometric operations, logins, and system changes (LGPD Art. 6º VII).",
    th_timestamp: "Timestamp",
    th_operator: "Operator",
    th_action: "Action",
    th_target: "Target Entity",
    th_details: "Details",

    // System Prompts & Confirmations
    confirm_del_single: "Are you sure you want to remove '{name}' from the biometric database?",
    confirm_del_all_1: "CRITICAL WARNING (Bulk Purge):\nAre you sure you want to remove ALL {count} registered entities?\n\nThis will permanently delete all biometric vectors.",
    confirm_del_all_2: "Final Confirmation: Proceed with total purge of all biometric subjects?",
    purge_done: "Bulk purge completed: {count} records removed.",
    del_done: "Entity '{name}' successfully removed.",
    kiosk_f12: "Access Blocked: Developer tools restricted by NPU policy.",
    kiosk_devtools: "Access Blocked: Inspection shortcut restricted.",
    kiosk_source: "Access Blocked: Source view disabled.",
    kiosk_context: "Context menu disabled by security protocol."
  },

  zh: {
    // Auth Portal
    auth_portal_title: "SecureVision AI — 身份验证与登录网关",
    auth_portal_sub: "零信任安全架构 • Argon2id 强哈希算法与 JWT 会话加密",
    tab_login: "操作员登录",
    tab_register: "注册新操作员",
    label_username: "登录用户名 / 账号",
    ph_login_user: "例如: admin 或您的专属账号",
    label_birthdate: "出生日期",
    label_password: "操作员安全密码",
    ph_password: "••••••••••••",
    login_btn: "验证身份并登录系统",
    label_fullname: "操作员法定姓名",
    ph_fullname: "例如: Samantha Carter",
    label_login_user: "系统唯一用户名",
    ph_reg_user: "例如: scarter",
    register_btn: "确认注册操作员",
    dept_sec_mgmt: "安全管理部",
    dept_ops: "运维保障部",

    // Sidebar & Brand
    brand_title: "SecureVision",
    vigilance_high: "警戒级别：高危防范",
    nav_status: "系统状态",
    nav_monitoring: "实时监控",
    nav_enrollment: "特征注册",
    nav_personnel: "人员名录",
    nav_logs: "审计日志",
    nav_settings: "系统设置",
    nav_support: "技术支持",

    // Topbar
    stat_fps: "平均帧率 (FPS)",
    stat_gpu: "边缘计算 GPU",
    stat_streams: "活跃视频流",
    search_placeholder: "搜索摄像头、日志、人员...",

    // Tab 1: Monitoring
    integrity_title: "系统完整性实时监控",
    integrity_cluster: "节点集群 ALPHA • 上次校验: 0.2秒前",
    files_scanned_label: "已校验核心文件",
    core_modules_label: "核心系统模块",
    badge_secure: "安全正常",
    live_log_title: "实时安全事件日志",
    filter_link: "快速筛选",
    evt_routine: "例行巡检扫描",
    evt_match: "身份比对成功",
    evt_model: "视觉算法模型更新",
    evt_unauthorized: "未经授权侵入警报",

    // Tab 2: Enrollment
    capture_title: "人脸生物特征采集",
    capture_desc: "在零信任隔离环境中提取本地 128 维人脸数学特征向量。",
    sensor_active: "传感器运行中 • 零信任 NPU",
    upload_btn: "上传本地照片文件",
    emb_generated_title: "128D 特征向量已生成",
    emb_generated_desc: "特征向量已完成 L2 空间单位球归一化",
    hash_display: "特征向量哈希值: ",
    subject_id_title: "登记主体法定身份",
    subject_id_desc: "将生物识别数学特征与主体法定档案深度绑定。",
    label_full_name: "登记人法定全名",
    ph_full_name: "请输入法定全名",
    label_national_id: "身份证件号码 (CPF)",
    label_dept: "所属部门",
    dept_eng: "研发工程部",
    dept_it: "IT 基础架构部",
    dept_sec: "安保防护部",
    dept_adm: "综合行政部",
    dept_vis: "临时访客",
    label_clearance: "安全访问权限等级",
    clearance_1: "1级 (基础权限)",
    clearance_2: "2级 (普通职员)",
    clearance_3: "3级 (高级人员)",
    clearance_4: "4级 (执行高管)",
    label_est_age: "预估年龄",
    label_crim_record: "安全风险背景审查 / 前科分类",
    opt_crim_cleared: "🟢 审查合格 / 无犯罪前科 (白名单)",
    opt_crim_suspect: "🟡 重点怀疑对象 / 持续侦查中 (黄色预警)",
    opt_crim_theft: "🔴 盗窃惯犯 / 盗窃前科黑名单 (立即阻截)",
    opt_crim_wanted: "🚨 在逃通缉重犯 / 最高红色预警 (直接报警)",
    label_incident_desc: "违法犯罪事实说明 / 历史处分记录",
    ph_incident_desc: "例如：机房服务器设备盗窃、非法闯入限制区、背景清白无记录...",
    lgpd_title: "个人信息保护合规告知 (LGPD)",
    lgpd_text: "依据《通用个人数据保护法》(LGPD 第13.709/2018号法律)，采集人脸生物特征需取得主体明确授权。数据以不可逆的 128 维数学向量形式本地加密存储。",
    lgpd_controller: "数据控制方：SecureVision AI Systems Inc. / FECAP",
    lgpd_consent_check: "我确认登记主体已阅读并正式签署符合 LGPD 法规的生物识别数据处理与授权协议。",
    btn_enroll_submit: "确认登记生物特征身份",
    active_enrolled_title: "当前已注册生效的主体列表",

    // Tab 3: System Status
    status_title: "系统完整性与运行性能概览",
    status_sub: "持续监控边缘 NPU 神经网络节点状态与摄像头数据流健康度。",
    kpi_load_title: "NPU 人工智能处理负载",
    kpi_load_sub: "运行稳定",
    kpi_anom_title: "当前活跃异常警报",
    kpi_anom_sub: "需要立即处理",
    kpi_lat_title: "视频帧处理延迟",
    kpi_lat_sub: "极佳",
    kpi_uptime_title: "系统持续运行率",
    kpi_uptime_sub: "边缘计算节点全部在线",
    diag_table_title: "摄像头视频流节点诊断矩阵",
    th_code: "节点代号",
    th_location: "部署物理位置",
    th_type: "流协议类型",
    th_resolution: "视频分辨率",
    th_fps: "目标帧率",
    th_status: "运行状态",
    badge_online: "正常在线",
    badge_alert: "异常告警",

    // Tab 4: Personnel
    personnel_title: "已注册人员与生物特征名录",
    personnel_sub: "企业级生物识别特征库，包含主体全名、掩码身份证号、出生日期及安全风险审查记录 (符合 LGPD 法规)。",
    filter_personnel_ph: "按姓名、证件号、部门或前科搜索...",
    purge_all_btn: "清除全部人员 (一键清空)",
    kpi_total_entities: "已登记人员总数",
    kpi_active_128d: "128D 特征向量已激活",
    kpi_sec_clearance: "安全权限分级体系",
    kpi_rbac_sub: "基于 RBAC 严格隔离",
    kpi_std_title: "数据保护合规标准",
    kpi_consent_chained: "授权链条已固化",
    card_cpf: "身份证件 (CPF)",
    card_birth: "出生日期",
    card_reg: "系统入库时间",
    card_hash: "128D 特征哈希:",
    card_del_title: "仅删除此人员",
    crim_cleared: "🟢 审查合格 / 无犯罪记录",
    crim_suspect: "🟡 重点怀疑对象 / 侦查中",
    crim_theft: "🔴 盗窃惯犯 / 盗窃前科黑名单",
    crim_wanted: "🚨 在逃通缉重犯 / 红色预警",
    card_incident_label: "违法事实与案件记录详情:",
    empty_personnel: "未找到与搜索条件匹配的人员记录。",

    // Tab 5: Logs
    logs_title: "系统完整性与操作审计日志",
    logs_sub: "记录所有生物识别操作、登录验证及系统配置变更的不可篡改审计追踪链 (LGPD 第6条第VII款)。",
    th_timestamp: "操作时间戳",
    th_operator: "操作人员",
    th_action: "执行动作",
    th_target: "目标对象",
    th_details: "操作详细数据",

    // System Prompts & Confirmations
    confirm_del_single: "确定要从生物识别库中删除“{name}”吗？",
    confirm_del_all_1: "严重警告（全局清空）：\n确定要清空全部 {count} 名已注册人员吗？此操作将永久删除特征向量。",
    confirm_del_all_2: "最终确认：确定要执行全体人员清空操作吗？",
    purge_done: "清空完成：已删除 {count} 条人员记录。",
    del_done: "人员“{name}”已成功删除。",
    kiosk_f12: "访问受限：开发者工具已按 NPU 安全策略禁用。",
    kiosk_devtools: "访问受限：元素检查快捷键已被安全策略拦截。",
    kiosk_source: "访问受限：源代码查看功能已关闭。",
    kiosk_context: "右键快捷菜单已被安全系统禁用。"
  }
};

let currentLang = localStorage.getItem('securevision_lang') || 'pt';

window.getSystemTranslation = function(key, params = {}) {
  const dict = translations[currentLang] || translations.pt;
  let str = dict[key] || translations.pt[key] || key;
  for (const [k, v] of Object.entries(params)) {
    str = str.replace(`{${k}}`, v);
  }
  return str;
};

document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elements References ---
  const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
  const viewPanels = document.querySelectorAll('.view-panel');
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  
  const authOverlay = document.getElementById('authPortalOverlay');
  const tabBtnLogin = document.getElementById('tabBtnLogin');
  const tabBtnRegister = document.getElementById('tabBtnRegister');
  const formLogin = document.getElementById('formLogin');
  const formRegister = document.getElementById('formRegister');
  const authErrorBox = document.getElementById('authErrorBox');
  const authErrorMsg = document.getElementById('authErrorMsg');
  const btnLogout = document.getElementById('btnLogout');
  
  const sidebarAvatar = document.getElementById('sidebarAvatar');
  const sidebarUserName = document.getElementById('sidebarUserName');
  const sidebarUserRole = document.getElementById('sidebarUserRole');

  let allPersonnelData = [];

  // --- Comprehensive Multilingual Switching Function ---
  function setSystemLanguage(lang) {
    if (!translations[lang]) return;
    currentLang = lang;
    localStorage.setItem('securevision_lang', lang);
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : (lang === 'en' ? 'en-US' : 'pt-BR');

    const labelEl = document.getElementById('currentLangLabel');
    if (labelEl) labelEl.textContent = lang.toUpperCase();

    // 1. Static elements with data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key && (translations[lang][key] || translations.pt[key])) {
        el.textContent = window.getSystemTranslation(key);
      }
    });

    // 2. Input Placeholders
    const searchGlobal = document.getElementById('globalSearchInput') || document.querySelector('.topbar-actions .search-box input');
    if (searchGlobal) searchGlobal.placeholder = window.getSystemTranslation('search_placeholder');

    const searchPers = document.getElementById('searchPersonnelInput');
    if (searchPers) searchPers.placeholder = window.getSystemTranslation('filter_personnel_ph');

    const inputName = document.getElementById('inputName');
    if (inputName) inputName.placeholder = window.getSystemTranslation('ph_full_name');

    const inputIncident = document.getElementById('inputIncidentDetails');
    if (inputIncident) inputIncident.placeholder = window.getSystemTranslation('ph_incident_desc');

    const loginUser = document.getElementById('loginUsername');
    if (loginUser) loginUser.placeholder = window.getSystemTranslation('ph_login_user');

    const regNome = document.getElementById('regNome');
    if (regNome) regNome.placeholder = window.getSystemTranslation('ph_fullname');

    const regUser = document.getElementById('regUsername');
    if (regUser) regUser.placeholder = window.getSystemTranslation('ph_reg_user');

    // 3. Dropdown Options
    const optCleared = document.querySelector('#selectCriminalRecord option[value="CLEARED"]');
    if (optCleared) optCleared.textContent = window.getSystemTranslation('opt_crim_cleared');

    const optSuspect = document.querySelector('#selectCriminalRecord option[value="SUSPECT"]');
    if (optSuspect) optSuspect.textContent = window.getSystemTranslation('opt_crim_suspect');

    const optTheft = document.querySelector('#selectCriminalRecord option[value="THEFT_OFFENSE"]');
    if (optTheft) optTheft.textContent = window.getSystemTranslation('opt_crim_theft');

    const optWanted = document.querySelector('#selectCriminalRecord option[value="WANTED_CRIMINAL"]');
    if (optWanted) optWanted.textContent = window.getSystemTranslation('opt_crim_wanted');

    // 4. Buttons
    const btnPurge = document.getElementById('btnDeleteAllPersonnel');
    if (btnPurge) btnPurge.innerHTML = `<i class="fa-solid fa-trash-can"></i> ${window.getSystemTranslation('purge_all_btn')}`;

    const btnEnroll = document.getElementById('btnSubmitEnroll');
    if (btnEnroll && !btnEnroll.disabled) {
      btnEnroll.innerHTML = `<i class="fa-solid fa-lock"></i> ${window.getSystemTranslation('btn_enroll_submit')}`;
    }

    // 5. Re-render dynamic components
    loadPersonnelDirectory(searchPers?.value || '');
    loadEnrolledSubjects();
    fetchLiveEvents();
  }

  // Language switcher elements
  const langSwitcherBtn = document.getElementById('langSwitcherBtn');
  const langDropdownMenu = document.getElementById('langDropdownMenu');
  const langOptions = document.querySelectorAll('.lang-opt');

  if (langSwitcherBtn && langDropdownMenu) {
    langSwitcherBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = langDropdownMenu.style.display === 'block';
      langDropdownMenu.style.display = isVisible ? 'none' : 'block';
    });

    document.addEventListener('click', () => {
      langDropdownMenu.style.display = 'none';
    });

    langOptions.forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const selected = opt.getAttribute('data-lang');
        if (selected) {
          setSystemLanguage(selected);
          langDropdownMenu.style.display = 'none';
        }
      });
    });
  }

  // --- Tab Navigation ---
  function switchTab(tabId) {
    navItems.forEach(item => {
      const match = item.getAttribute('data-tab') === tabId;
      item.classList.toggle('active', match);
    });

    viewPanels.forEach(panel => {
      const match = panel.id === `${tabId}-view`;
      panel.classList.toggle('active-view', match);
    });

    if (tabId === 'enrollment') {
      initEnrollmentCamera();
      loadEnrolledSubjects();
    } else {
      stopEnrollmentCamera();
    }

    if (tabId === 'personnel') {
      loadPersonnelDirectory();
    }

    if (tabId === 'logs') {
      loadDetailedLogs();
    }

    if (tabId === 'status') {
      fetchDashboardStats();
    }
  }

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tabId = item.getAttribute('data-tab');
      if (tabId) switchTab(tabId);
    });
  });

  // Settings & Support buttons
  document.querySelectorAll('.sidebar-footer .nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const label = item.querySelector('span')?.textContent || 'Menu';
      alert(`[${label}] Módulo de configuração de nós de vigilância e suporte NPU ativo.`);
    });
  });

  // --- Theme Toggle ---
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      themeToggleBtn.innerHTML = next === 'light' ? '<i class="fa-solid fa-moon"></i>' : '<i class="fa-solid fa-sun"></i>';
    });
  }

  // --- Zero-Trust Authentication Session ---
  async function checkServerSession() {
    try {
      const resp = await fetch('/api/v1/auth/me', { credentials: 'same-origin' });
      if (resp.ok) {
        const data = await resp.json();
        const op = data.operator;
        if (authOverlay) authOverlay.classList.add('auth-hidden');
        if (sidebarAvatar) sidebarAvatar.textContent = (op.full_name || op.username || 'SC').substring(0, 2).toUpperCase();
        if (sidebarUserName) sidebarUserName.textContent = op.full_name || op.username;
        if (sidebarUserRole) sidebarUserRole.textContent = op.clearance || op.clearance_level || 'AUTII: Lvl 5';
      } else {
        if (authOverlay) authOverlay.classList.remove('auth-hidden');
      }
    } catch (err) {
      if (authOverlay) authOverlay.classList.remove('auth-hidden');
    }
  }

  // Toggle Login vs Register Tabs
  if (tabBtnLogin && tabBtnRegister) {
    tabBtnLogin.addEventListener('click', () => {
      tabBtnLogin.classList.add('active');
      tabBtnRegister.classList.remove('active');
      if (formLogin) formLogin.style.display = 'flex';
      if (formRegister) formRegister.style.display = 'none';
      if (authErrorBox) authErrorBox.style.display = 'none';
    });

    tabBtnRegister.addEventListener('click', () => {
      tabBtnRegister.classList.add('active');
      tabBtnLogin.classList.remove('active');
      if (formRegister) formRegister.style.display = 'flex';
      if (formLogin) formLogin.style.display = 'none';
      if (authErrorBox) authErrorBox.style.display = 'none';
    });
  }

  // Form Login
  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('loginUsername')?.value.trim();
      const birthdate = document.getElementById('loginBirthdate')?.value;
      const password = document.getElementById('loginPassword')?.value.trim();
      const btnSubmit = document.getElementById('btnSubmitLogin');

      if (!username || !birthdate || !password) {
        showAuthError("Preencha todos os campos: Usuário/Login, Data de Nascimento e Senha.");
        return;
      }

      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Validando credenciais (Argon2id)...';
      }

      try {
        const resp = await fetch('/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ username, birthdate, password })
        });

        const data = await resp.json();
        if (resp.ok && data.success) {
          if (authErrorBox) authErrorBox.style.display = 'none';
          await checkServerSession();
          fetchDashboardStats();
          fetchLiveEvents();
        } else {
          showAuthError(data.detail || "Acesso Negado: Usuário, Data de Nascimento ou Senha incorretos.");
        }
      } catch (err) {
        showAuthError("Erro de comunicação com o servidor de autenticação.");
      } finally {
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = `<i class="fa-solid fa-lock"></i> ${window.getSystemTranslation('login_btn')}`;
        }
      }
    });
  }

  // Form Register
  if (formRegister) {
    formRegister.addEventListener('submit', async (e) => {
      e.preventDefault();
      const full_name = document.getElementById('regNome')?.value.trim();
      const username = document.getElementById('regUsername')?.value.trim().toLowerCase();
      const birthdate = document.getElementById('regBirthdate')?.value;
      const password = document.getElementById('regPassword')?.value.trim();
      const dept = document.getElementById('regDept')?.value || 'Security';
      const clearance = document.getElementById('regClearance')?.value || 'Level 2 (Staff)';
      const btnSubmit = document.getElementById('btnSubmitRegister');

      if (!full_name || !username || !birthdate || !password) {
        showAuthError("Todos os campos são obrigatórios para registrar uma nova conta.");
        return;
      }

      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Registrando operador...';
      }

      try {
        const resp = await fetch('/api/v1/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ full_name, username, birthdate, password, department: dept, clearance_level: clearance })
        });

        const data = await resp.json();
        if (resp.ok && data.success) {
          alert(`Conta do operador '${full_name}' criada com sucesso!\nVocê já pode realizar o login com suas credenciais.`);
          formRegister.reset();
          if (tabBtnLogin) tabBtnLogin.click();
          const uField = document.getElementById('loginUsername');
          const bField = document.getElementById('loginBirthdate');
          if (uField) uField.value = username;
          if (bField) bField.value = birthdate;
        } else {
          showAuthError(data.detail || "Erro ao registrar operador.");
        }
      } catch (err) {
        showAuthError("Erro de comunicação ao registrar operador.");
      } finally {
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = `<i class="fa-solid fa-user-shield"></i> ${window.getSystemTranslation('register_btn')}`;
        }
      }
    });
  }

  function showAuthError(msg) {
    if (authErrorBox && authErrorMsg) {
      authErrorMsg.textContent = msg;
      authErrorBox.style.display = 'flex';
    } else {
      alert(msg);
    }
  }

  // Logout
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      if (confirm("Deseja encerrar a sessão de operador e bloquear o painel?")) {
        try {
          await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'same-origin' });
        } catch (e) {}
        if (authOverlay) authOverlay.classList.remove('auth-hidden');
      }
    });
  }

  // --- Telemetry & Live Events Polling ---
  async function fetchDashboardStats() {
    try {
      const resp = await fetch('/api/v1/telemetry/stats', { credentials: 'same-origin' });
      if (!resp.ok) return;
      const data = await resp.json();

      const elFps = document.getElementById('statFps');
      const elGpu = document.getElementById('statGpu');
      const elStreams = document.getElementById('statStreams');
      if (elFps) elFps.textContent = Number(data.fps_avg || 59.8).toFixed(1);
      if (elGpu) elGpu.textContent = `${data.edge_gpu_usage || 82}%`;
      if (elStreams) elStreams.textContent = `${data.active_streams || 4} / ${data.total_streams || 4}`;

      const elLoad = document.getElementById('statusProcessingLoad');
      const elAnom = document.getElementById('statusAnomalies');
      const elLat = document.getElementById('statusLatency');
      const elUptime = document.getElementById('statusUptime');

      if (elLoad) elLoad.textContent = `${data.processing_load || 42}%`;
      if (elAnom) elAnom.textContent = data.active_anomalies || 1;
      if (elLat) elLat.textContent = `${data.frame_latency || 12}ms`;
      if (elUptime) elUptime.textContent = `${data.uptime || 99.9}%`;
    } catch (err) {
      console.warn("Telemetria offline:", err);
    }
  }

  async function fetchLiveEvents() {
    try {
      const resp = await fetch('/api/v1/events', { credentials: 'same-origin' });
      if (!resp.ok) return;
      const events = await resp.json();
      const logList = document.getElementById('liveLogList');
      if (!logList) return;

      logList.innerHTML = '';
      events.forEach(evt => {
        const card = document.createElement('div');
        let cardClass = evt.alert ? 'event-unauthorized' : (evt.tipo_evento === 'ID_MATCH' ? 'event-match' : 'event-routine');
        let icon = evt.alert ? '<i class="fa-solid fa-triangle-exclamation"></i>' : (evt.tipo_evento === 'ID_MATCH' ? '<i class="fa-solid fa-check"></i>' : '<i class="fa-solid fa-arrows-rotate"></i>');

        let titleText = (evt.tipo_evento || '').replace('_', ' ');
        if (evt.tipo_evento === 'ROUTINE_SCAN') titleText = window.getSystemTranslation('evt_routine');
        if (evt.tipo_evento === 'ID_MATCH') titleText = window.getSystemTranslation('evt_match');
        if (evt.tipo_evento === 'MODEL_UPDATED') titleText = window.getSystemTranslation('evt_model');
        if (evt.tipo_evento === 'UNAUTHORIZED_PRESENCE') titleText = window.getSystemTranslation('evt_unauthorized');

        card.className = `log-card ${cardClass}`;
        const timePart = (evt.detected_at || "").split(' ')[1] || evt.detected_at || "--:--:--";
        
        card.innerHTML = `
          <div class="log-card-header">
            <span>${timePart}</span>
            <span class="log-camera-tag">${evt.camera_code || 'CAM_SYS'}</span>
          </div>
          <div class="log-title">
            ${icon} ${titleText}
          </div>
          <div class="log-desc">
            ${evt.note || `${evt.pessoa_nome} (${evt.departamento}) - Conf: ${Math.round((evt.confianca || 0.95) * 100)}%`}
          </div>
        `;
        logList.appendChild(card);
      });
    } catch (err) {
      console.warn("Live events error:", err);
    }
  }

  // --- Enrollment & Biometrics ---
  let enrollStream = null;
  let capturedImageBase64 = null;
  const enrollVideo = document.getElementById('enrollVideo');
  const enrollCanvas = document.getElementById('enrollCanvas');
  const btnCapturePhoto = document.getElementById('btnCapturePhoto');
  const btnTriggerUpload = document.getElementById('btnTriggerUpload');
  const photoUploadInput = document.getElementById('photoUploadInput');
  const generatedHashBox = document.getElementById('generatedHashBox');
  const hashDisplay = document.getElementById('hashDisplay');
  const enrollForm = document.getElementById('enrollSubjectForm');
  const consentCheckbox = document.getElementById('consentCheckbox');
  const btnSubmitEnroll = document.getElementById('btnSubmitEnroll');
  const inputCpf = document.getElementById('inputCpf');

  async function initEnrollmentCamera() {
    if (!enrollVideo) return;
    try {
      enrollStream = await navigator.mediaDevices.getUserMedia({ video: true });
      enrollVideo.srcObject = enrollStream;
      drawFaceMeshSimulation(false);
    } catch (err) {
      drawFaceMeshSimulation(true);
    }
  }

  function stopEnrollmentCamera() {
    if (enrollStream) {
      enrollStream.getTracks().forEach(track => track.stop());
      enrollStream = null;
    }
  }

  let meshAnimationTimer = null;
  function drawFaceMeshSimulation(isFallback) {
    if (meshAnimationTimer) clearInterval(meshAnimationTimer);
    if (!enrollCanvas) return;
    const ctx = enrollCanvas.getContext('2d');
    enrollCanvas.width = 640;
    enrollCanvas.height = 480;

    meshAnimationTimer = setInterval(() => {
      ctx.clearRect(0, 0, 640, 480);

      if (isFallback) {
        ctx.fillStyle = "#0c1322";
        ctx.fillRect(0, 0, 640, 480);
        ctx.fillStyle = "#1e293b";
        ctx.beginPath();
        ctx.arc(320, 200, 70, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(320, 390, 140, 110, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      const cx = 320;
      const cy = 200;
      const r = 85;

      ctx.strokeStyle = "rgba(6, 182, 212, 0.7)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * 0.8, r * 1.05, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "#10b981";
      const pts = [
        [cx - 28, cy - 15], [cx + 28, cy - 15],
        [cx, cy + 10], [cx - 20, cy + 35], [cx + 20, cy + 35], [cx, cy + 40]
      ];
      pts.forEach(([px, py]) => {
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 3;
      const bx = cx - 110, by = cy - 130, bw = 220, bh = 260, len = 20;

      ctx.beginPath(); ctx.moveTo(bx, by + len); ctx.lineTo(bx, by); ctx.lineTo(bx + len, by); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx + bw - len, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw, by + len); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx + bw - len, by + bh); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx + len, by + bh); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx + bw - len, by + bh); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx + bw, by + bh - len); ctx.stroke();
    }, 50);
  }

  if (btnCapturePhoto) {
    btnCapturePhoto.addEventListener('click', () => {
      const snapCanvas = document.createElement('canvas');
      snapCanvas.width = 640;
      snapCanvas.height = 480;
      const ctx = snapCanvas.getContext('2d');

      if (enrollStream) {
        ctx.drawImage(enrollVideo, 0, 0, 640, 480);
      } else {
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(0, 0, 640, 480);
        ctx.fillStyle = "#94a3b8";
        ctx.font = "20px Inter";
        ctx.fillText("Sensor Photo Captured", 220, 240);
      }

      capturedImageBase64 = snapCanvas.toDataURL('image/jpeg', 0.9);
      displayGeneratedHash();
    });
  }

  if (btnTriggerUpload && photoUploadInput) {
    btnTriggerUpload.addEventListener('click', () => photoUploadInput.click());
    photoUploadInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        capturedImageBase64 = event.target.result;
        displayGeneratedHash();
      };
      reader.readAsDataURL(file);
    });
  }

  function displayGeneratedHash() {
    const pseudoHash = Array.from({length: 4}, () => Math.floor(Math.random()*16).toString(16)).join('') + '_' +
                       Array.from({length: 4}, () => Math.floor(Math.random()*16).toString(16)).join('');
    if (hashDisplay) hashDisplay.innerText = `${window.getSystemTranslation('hash_display')}${pseudoHash}`;
    if (generatedHashBox) generatedHashBox.style.display = 'flex';
  }

  if (inputCpf) {
    inputCpf.addEventListener('input', (e) => {
      let v = e.target.value.replace(/\D/g, '');
      if (v.length > 11) v = v.slice(0, 11);
      if (v.length > 9) {
        v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
      } else if (v.length > 6) {
        v = v.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
      } else if (v.length > 3) {
        v = v.replace(/(\d{3})(\d{1,3})/, '$1.$2');
      }
      e.target.value = v;
    });
  }

  if (consentCheckbox && btnSubmitEnroll) {
    consentCheckbox.addEventListener('change', () => {
      btnSubmitEnroll.disabled = !consentCheckbox.checked;
    });
  }

  if (enrollForm) {
    enrollForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const full_name = document.getElementById('inputName')?.value.trim();
      const national_id = document.getElementById('inputCpf')?.value.trim();
      const dept = document.getElementById('selectDept')?.value || 'Engineering';
      const clearance = document.getElementById('selectClearance')?.value || 'Level 1 (Basic)';
      const age = parseInt(document.getElementById('inputIdade')?.value) || 28;
      const bdate = document.getElementById('inputBirthdate')?.value || '1995-01-01';
      const crimRecord = document.getElementById('selectCriminalRecord')?.value || 'CLEARED';
      const incidentDetails = document.getElementById('inputIncidentDetails')?.value.trim() || '';

      if (!full_name || !national_id) {
        alert("Preencha o nome completo e o CPF.");
        return;
      }

      if (btnSubmitEnroll) {
        btnSubmitEnroll.disabled = true;
        btnSubmitEnroll.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing NPU Embedding...';
      }

      try {
        const payload = {
          full_name: full_name,
          national_id: national_id,
          birthdate: bdate,
          age: age,
          department: dept,
          clearance_level: clearance,
          criminal_record: crimRecord,
          incident_details: incidentDetails,
          photo_base64: capturedImageBase64,
          lgpd_consent: consentCheckbox ? consentCheckbox.checked : true
        };

        const resp = await fetch('/api/v1/subjects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(payload)
        });

        const resData = await resp.json();
        if (resp.ok) {
          alert(`Identidade cadastrada com sucesso!\nID: ${resData.subject_id}\nClassificação de Segurança: ${crimRecord}\nVetor 128D persistido.`);
          enrollForm.reset();
          capturedImageBase64 = null;
          if (generatedHashBox) generatedHashBox.style.display = 'none';
          if (consentCheckbox) consentCheckbox.checked = false;
          loadEnrolledSubjects();
          loadPersonnelDirectory();
          fetchDashboardStats();
        } else {
          alert(`Erro no cadastro: ${resData.detail || 'Falha ao processar'}`);
        }
      } catch (err) {
        alert("Erro de conexão ao servidor.");
      } finally {
        if (btnSubmitEnroll) {
          btnSubmitEnroll.disabled = consentCheckbox ? !consentCheckbox.checked : false;
          btnSubmitEnroll.innerHTML = `<i class="fa-solid fa-lock"></i> ${window.getSystemTranslation('btn_enroll_submit')}`;
        }
      }
    });
  }

  // --- Personnel Directory (Multilingual + Single & Bulk Deletion + Criminal Record Matrix) ---
  async function loadPersonnelDirectory(filterQuery = '') {
    const container = document.getElementById('personnelGridCards');
    const countBadge = document.getElementById('personnelTotalCount');
    if (!container) return;

    try {
      const resp = await fetch('/api/v1/subjects', { credentials: 'same-origin' });
      if (!resp.ok) return;
      allPersonnelData = await resp.json();

      let filtered = allPersonnelData;
      if (filterQuery && filterQuery.trim()) {
        const q = filterQuery.toLowerCase().trim();
        filtered = allPersonnelData.filter(p => 
          (p.full_name || '').toLowerCase().includes(q) ||
          (p.national_id_masked || '').toLowerCase().includes(q) ||
          (p.department || '').toLowerCase().includes(q) ||
          (p.criminal_record || '').toLowerCase().includes(q) ||
          (p.incident_details || '').toLowerCase().includes(q)
        );
      }

      if (countBadge) countBadge.textContent = filtered.length;
      container.innerHTML = '';

      if (filtered.length === 0) {
        container.innerHTML = `
          <div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--text-muted); background: var(--bg-card); border-radius: 12px; border: 1px dashed var(--border-color);">
            <i class="fa-solid fa-users-slash" style="font-size: 2rem; margin-bottom: 12px; opacity: 0.5;"></i>
            <p>${window.getSystemTranslation('empty_personnel')}</p>
          </div>
        `;
        return;
      }

      filtered.forEach(person => {
        const card = document.createElement('div');
        card.className = 'card-enroll';
        
        // Threat classification style
        const crim = person.criminal_record || 'CLEARED';
        let crimBadgeText = window.getSystemTranslation('crim_cleared');
        let crimBadgeColor = 'var(--accent-green)';
        let crimBadgeBg = 'rgba(16, 185, 129, 0.12)';
        let cardBorderColor = 'var(--border-color)';

        if (crim === 'THEFT_OFFENSE') {
          crimBadgeText = window.getSystemTranslation('crim_theft');
          crimBadgeColor = 'var(--accent-red)';
          crimBadgeBg = 'rgba(239, 68, 68, 0.18)';
          cardBorderColor = 'rgba(239, 68, 68, 0.5)';
        } else if (crim === 'WANTED_CRIMINAL') {
          crimBadgeText = window.getSystemTranslation('crim_wanted');
          crimBadgeColor = '#f43f5e';
          crimBadgeBg = 'rgba(244, 63, 94, 0.25)';
          cardBorderColor = 'rgba(244, 63, 94, 0.7)';
        } else if (crim === 'SUSPECT') {
          crimBadgeText = window.getSystemTranslation('crim_suspect');
          crimBadgeColor = '#eab308';
          crimBadgeBg = 'rgba(234, 179, 8, 0.15)';
          cardBorderColor = 'rgba(234, 179, 8, 0.4)';
        }

        card.style.cssText = `
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          background: rgba(21, 29, 48, 0.7);
          border: 1px solid ${cardBorderColor};
          border-radius: 12px;
          box-shadow: 0 4px 14px rgba(0,0,0,0.3);
          transition: transform 0.2s ease, border-color 0.2s ease;
        `;
        card.onmouseenter = () => { card.style.transform = 'translateY(-2px)'; };
        card.onmouseleave = () => { card.style.transform = 'translateY(0)'; };

        let birthFormatted = person.birthdate || '1990-01-01';
        if (birthFormatted.includes('-')) {
          const parts = birthFormatted.split('-');
          if (parts.length === 3) {
            birthFormatted = currentLang === 'zh' ? `${parts[0]}年${parts[1]}月${parts[2]}日` : `${parts[2]}/${parts[1]}/${parts[0]}`;
          }
        }

        let regFormatted = person.created_at || '2026-08-25 12:00:00';
        if (regFormatted.includes('-') && regFormatted.includes(' ')) {
          const [dPart, tPart] = regFormatted.split(' ');
          const dParts = dPart.split('-');
          if (dParts.length === 3) {
            regFormatted = currentLang === 'zh' ? `${dParts[0]}/${dParts[1]}/${dParts[2]} ${tPart}` : `${dParts[2]}/${dParts[1]}/${dParts[0]} às ${tPart}`;
          }
        }

        const initials = (person.full_name || 'U').substring(0, 2).toUpperCase();

        // Incident details banner
        let incidentHtml = '';
        if (person.incident_details && person.incident_details.trim()) {
          incidentHtml = `
            <div style="background: ${crimBadgeBg}; border-left: 3px solid ${crimBadgeColor}; padding: 8px 12px; border-radius: 4px; font-size: 0.78rem; color: var(--text-secondary); margin-top: 2px;">
              <strong style="color: ${crimBadgeColor}; display: flex; align-items: center; gap: 5px; font-size: 0.75rem; margin-bottom: 2px;">
                <i class="fa-solid fa-triangle-exclamation"></i> ${window.getSystemTranslation('card_incident_label')}
              </strong>
              <span>${person.incident_details}</span>
            </div>
          `;
        }

        card.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div class="user-avatar" style="width: 44px; height: 44px; font-size: 1.1rem; border-color: ${crimBadgeColor}; background: linear-gradient(135deg, rgba(6,182,212,0.2), rgba(59,130,246,0.2)); color: ${crimBadgeColor};">
                ${initials}
              </div>
              <div>
                <h3 style="font-size: 1rem; font-weight: 700; color: var(--text-primary); margin-bottom: 2px;">
                  ${person.full_name}
                </h3>
                <span class="badge-aes" style="font-size: 0.72rem;">${person.department || 'Geral'}</span>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <button class="action-icon-btn btn-delete-single-card" data-id="${person.id}" data-name="${person.full_name}" title="${window.getSystemTranslation('card_del_title')}" style="color: var(--accent-red); border-color: rgba(239, 68, 68, 0.4); width: 32px; height: 32px; cursor: pointer;">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </div>

          <!-- Criminal Profile Tag -->
          <div style="display: flex; align-items: center; justify-content: space-between; background: ${crimBadgeBg}; border: 1px solid ${crimBadgeColor}; padding: 6px 12px; border-radius: 6px;">
            <span style="font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: ${crimBadgeColor}; display: flex; align-items: center; gap: 6px;">
              ${crimBadgeText}
            </span>
            <span style="font-size: 0.7rem; font-weight: 600; color: var(--text-muted);">Status: ${person.status}</span>
          </div>

          ${incidentHtml}

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: var(--bg-input); padding: 14px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 0.82rem;">
            
            <div style="display: flex; flex-direction: column; gap: 3px;">
              <span style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">
                <i class="fa-solid fa-id-card" style="color: var(--accent-blue);"></i> ${window.getSystemTranslation('card_cpf')}
              </span>
              <strong style="font-family: 'JetBrains Mono', monospace; color: var(--text-primary); font-size: 0.88rem;">
                ${person.national_id_masked || '000.***.***-00'}
              </strong>
            </div>

            <div style="display: flex; flex-direction: column; gap: 3px;">
              <span style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">
                <i class="fa-solid fa-cake-candles" style="color: var(--accent-cyan);"></i> ${window.getSystemTranslation('card_birth')}
              </span>
              <strong style="color: var(--accent-cyan); font-size: 0.88rem;">
                ${birthFormatted}
              </strong>
            </div>

            <div style="display: flex; flex-direction: column; gap: 3px; grid-column: 1 / -1; border-top: 1px dashed var(--border-color); padding-top: 8px; margin-top: 2px;">
              <span style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">
                <i class="fa-solid fa-calendar-check" style="color: var(--accent-green);"></i> ${window.getSystemTranslation('card_reg')}
              </span>
              <span style="font-family: 'JetBrains Mono', monospace; font-size: 0.78rem; color: var(--text-secondary);">
                ${regFormatted}
              </span>
            </div>

          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.76rem; color: var(--text-muted); padding-top: 2px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-fingerprint" style="color: var(--accent-cyan);"></i>
              <span>${window.getSystemTranslation('card_hash')} <strong>${person.hash_128d || '9a2f_4c1b'}</strong></span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-shield-halved" style="color: var(--accent-blue);"></i>
              <span>${person.clearance_level || 'Level 1'}</span>
            </div>
          </div>
        `;
        container.appendChild(card);
      });

      // Bind individual delete buttons on cards
      container.querySelectorAll('.btn-delete-single-card').forEach(btn => {
        btn.onclick = async (e) => {
          e.stopPropagation();
          const id = btn.getAttribute('data-id');
          const name = btn.getAttribute('data-name') || 'esta pessoa';
          if (confirm(window.getSystemTranslation('confirm_del_single', { name }))) {
            try {
              const res = await fetch(`/api/v1/subjects/${id}`, { method: 'DELETE', credentials: 'same-origin' });
              if (res.ok) {
                showToastNotification(window.getSystemTranslation('del_done', { name }));
                loadPersonnelDirectory(searchPersonnelInput?.value || '');
                loadEnrolledSubjects();
                fetchDashboardStats();
              } else {
                alert("Falha ao remover entidade.");
              }
            } catch (err) {
              alert("Erro de rede ao remover registro.");
            }
          }
        };
      });

    } catch (err) {
      console.error("Erro ao carregar diretório de pessoas:", err);
    }
  }

  // Real-time search filter
  const searchPersonnelInput = document.getElementById('searchPersonnelInput');
  if (searchPersonnelInput) {
    searchPersonnelInput.addEventListener('input', (e) => {
      loadPersonnelDirectory(e.target.value);
    });
  }

  const btnRefreshPersonnel = document.getElementById('btnRefreshPersonnel');
  if (btnRefreshPersonnel) {
    btnRefreshPersonnel.addEventListener('click', () => {
      loadPersonnelDirectory(searchPersonnelInput?.value || '');
    });
  }

  // --- Bulk Purge Handler (Remover Geral - Todos) ---
  const btnDeleteAllPersonnel = document.getElementById('btnDeleteAllPersonnel');
  if (btnDeleteAllPersonnel) {
    btnDeleteAllPersonnel.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();

      try {
        const checkResp = await fetch('/api/v1/subjects', { credentials: 'same-origin' });
        const currentList = checkResp.ok ? await checkResp.json() : allPersonnelData;

        if (!currentList || currentList.length === 0) {
          alert(currentLang === 'zh' ? "生物识别人员库已为空。" : (currentLang === 'en' ? "Biometric personnel database is already empty." : "A base de pessoas cadastradas já está vazia."));
          return;
        }

        const confirmFirst = confirm(window.getSystemTranslation('confirm_del_all_1', { count: currentList.length }));
        if (!confirmFirst) return;

        const confirmSecond = confirm(window.getSystemTranslation('confirm_del_all_2'));
        if (!confirmSecond) return;

        const resp = await fetch('/api/v1/subjects', { method: 'DELETE', credentials: 'same-origin' });
        const resData = await resp.json();

        if (resp.ok) {
          showToastNotification(window.getSystemTranslation('purge_done', { count: resData.count_deleted || currentList.length }));
          loadPersonnelDirectory();
          loadEnrolledSubjects();
          fetchDashboardStats();
        } else {
          alert(`Erro no expurgo: ${resData.detail || 'Falha no servidor'}`);
        }
      } catch (err) {
        console.error("Erro ao executar expurgo geral:", err);
        alert("Erro de comunicação ao executar expurgo geral.");
      }
    };
  }

  async function loadEnrolledSubjects() {
    const listEl = document.getElementById('enrolledSubjectsList');
    if (!listEl) return;

    try {
      const resp = await fetch('/api/v1/subjects', { credentials: 'same-origin' });
      const persons = await resp.json();
      listEl.innerHTML = '';

      if (persons.length === 0) {
        listEl.innerHTML = '<div style="padding: 20px; color: var(--text-muted); text-align: center;">Nenhuma entidade cadastrada.</div>';
        return;
      }

      persons.forEach(p => {
        const row = document.createElement('div');
        row.className = 'user-profile-badge';
        row.style.justifyContent = 'space-between';
        
        let crimTag = p.criminal_record === 'THEFT_OFFENSE' ? (currentLang === 'zh' ? ' [盗窃前科]' : (currentLang === 'en' ? ' [THEFT]' : ' [LADRÃO]')) : (p.criminal_record === 'WANTED_CRIMINAL' ? (currentLang === 'zh' ? ' [通缉要犯]' : (currentLang === 'en' ? ' [WANTED]' : ' [PROCURADO]')) : '');
        let crimColor = (p.criminal_record === 'THEFT_OFFENSE' || p.criminal_record === 'WANTED_CRIMINAL') ? 'var(--accent-red)' : 'var(--text-secondary)';

        row.innerHTML = `
          <div style="display: flex; align-items: center; gap: 10px;">
            <div class="user-avatar">${(p.full_name || 'U').substring(0, 2).toUpperCase()}</div>
            <div>
              <div class="user-name" style="display: flex; align-items: center; gap: 6px;">
                ${p.full_name} <span style="font-size: 0.72rem; color: ${crimColor}; font-weight: 700;">${crimTag}</span>
              </div>
              <div class="user-role">${p.department} • ${p.clearance_level} • CPF: ${p.national_id_masked}</div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="badge-secure" style="font-size: 0.7rem;">${p.status.toUpperCase()}</span>
            <button class="action-icon-btn btn-delete-person" data-id="${p.id}" data-name="${p.full_name}" title="Remover"><i class="fa-solid fa-trash"></i></button>
          </div>
        `;
        listEl.appendChild(row);
      });

      document.querySelectorAll('.btn-delete-person').forEach(btn => {
        btn.onclick = async (e) => {
          e.stopPropagation();
          const id = btn.getAttribute('data-id');
          const name = btn.getAttribute('data-name') || 'esta entidade';
          if (confirm(window.getSystemTranslation('confirm_del_single', { name }))) {
            await fetch(`/api/v1/subjects/${id}`, { method: 'DELETE', credentials: 'same-origin' });
            loadEnrolledSubjects();
            loadPersonnelDirectory();
            fetchDashboardStats();
          }
        };
      });
    } catch (e) {
      console.error(e);
    }
  }

  async function loadDetailedLogs() {
    const tbody = document.getElementById('auditLogsTableBody');
    if (!tbody) return;

    try {
      const resp = await fetch('/api/v1/audit/logs', { credentials: 'same-origin' });
      const logs = await resp.json();
      tbody.innerHTML = '';

      logs.forEach(l => {
        const tr = document.createElement('tr');
        const detStr = l.details ? JSON.stringify(l.details) : '-';
        tr.innerHTML = `
          <td style="font-family: 'JetBrains Mono', monospace; font-size: 0.78rem;">${l.timestamp}</td>
          <td><strong>${l.operator_username}</strong></td>
          <td><span class="badge-aes">${l.action}</span></td>
          <td>${l.entity_type}</td>
          <td style="color: var(--text-secondary); font-size: 0.8rem;">${detStr}</td>
        `;
        tbody.appendChild(tr);
      });
    } catch (e) {
      console.error(e);
    }
  }

  // --- Initial System Boot ---
  setSystemLanguage(currentLang);
  checkServerSession();
  fetchDashboardStats();
  fetchLiveEvents();

  setInterval(fetchDashboardStats, 3000);
  setInterval(fetchLiveEvents, 2500);
});
