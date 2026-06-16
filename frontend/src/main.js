import * as faceapi from '@vladmandic/face-api';
import { createClient } from '@supabase/supabase-js';
import CryptoJS from 'crypto-js';

// Função para mascarar CPF por questões de segurança e privacidade (LGPD)
function maskCpf(cpf) {
  if (!cpf) return '';
  return cpf.replace(/(\d{3})\.(\d{3})\.(\d{3})-(\d{2})/, "$1.***.***-$4");
}

// Algoritmo clássico de validação de CPF (dígitos verificadores)
function isValidCpf(cpf) {
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return false;
  if (/^(\d)\1+$/.test(clean)) return false; // Rejeita CPFs com todos os dígitos iguais
  
  // Valida 1o dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i)) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(9))) return false;
  
  // Valida 2o dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i)) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(10))) return false;
  
  return true;
}



// --- CONFIGURAÇÃO E ESTADO GLOBAL ---
let supabase = null;
let supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
let supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
let encryptionKey = 'SecureVisionSecretPassphrase'; // Fallback se não configurado

let modelsLoaded = false;
let isTrackingActive = true;
let isUserAuthenticated = false;

// Caches de Dados
let registeredFaces = []; // Array de { id, pessoa_id, nome, descriptor }
let activeTracks = []; // Rastreamento de faces ativas { id, lastBox, centroidHistory, label, confidence, lastSeen }
let nextTrackId = 1;

// Referências de Elementos do DOM
const dom = {
  video: document.getElementById('webcam-video'),
  mjpegFeed: document.getElementById('mjpeg-feed'),
  canvas: document.getElementById('video-canvas'),
  loading: document.getElementById('video-loading'),
  cameraSelect: document.getElementById('camera-select'),
  btnScanOnvif: document.getElementById('btn-scan-onvif'),
  btnAddCamera: document.getElementById('btn-add-camera'),
  btnSaveNewCam: document.getElementById('btn-save-new-camera'),
  modalCamera: document.getElementById('modal-camera'),
  cameraList: document.getElementById('camera-list'),
  activeCameraTitle: document.getElementById('active-camera-title'),
  
  // Stats
  facesCount: document.getElementById('stats-faces-count'),
  lastRecognized: document.getElementById('stats-last-recognized'),
  avgConfidence: document.getElementById('stats-avg-confidence'),

  // Cadastro
  formCadastro: document.getElementById('form-cadastro'),
  cadNome: document.getElementById('cad-nome'),
  cadCpf: document.getElementById('cad-cpf'),
  cadDataNasc: document.getElementById('cad-data-nasc'),
  cadStatus: document.getElementById('cad-status'),
  cadObs: document.getElementById('cad-obs'),
  cadConsent: document.getElementById('cad-consent'),
  btnSubmitCadastro: document.getElementById('btn-submit-cadastro'),
  btnCancelEdit: document.getElementById('btn-cancel-edit'),
  btnCapturePhoto: document.getElementById('btn-capture-photo'),
  btnUploadPhoto: document.getElementById('btn-upload-photo'),
  previewCanvas: document.getElementById('captured-photo-canvas'),
  previewImg: document.getElementById('uploaded-photo-img'),
  previewIcon: document.querySelector('.placeholder-icon'),
  photoFeedback: document.getElementById('photo-feedback-msg'),
  photoBox: document.getElementById('photo-preview-container'),
  btnPeopleTab: document.querySelector('[data-tab="tab-pessoas-list"]'),
  btnCadastroTab: document.querySelector('[data-tab="tab-novo-cadastro"]'),
  tabCadastro: document.getElementById('tab-novo-cadastro'),
  tabPeople: document.getElementById('tab-pessoas-list'),
  peopleList: document.getElementById('registered-people-list'),
  searchPeople: document.getElementById('search-people'),
  cadastroFormTitle: document.getElementById('cadastro-form-title'),
  editBadge: document.getElementById('edit-badge'),
  
  // Logs & Alertas
  accessLogs: document.getElementById('access-logs-container'),
  btnClearLogs: document.getElementById('btn-clear-logs'),
  auditLogsMini: document.getElementById('audit-logs-mini'),
  auditAlert: document.getElementById('audit-alert'),
  btnDismissAlert: document.getElementById('btn-dismiss-alert'),
  
  // Modais de Setup e Auth
  modalSupabase: document.getElementById('modal-config-supabase'),
  btnSaveSupabase: document.getElementById('btn-save-supabase'),
  modalLogin: document.getElementById('modal-login'),
  btnDoLogin: document.getElementById('btn-do-login'),
  btnLogout: document.getElementById('btn-logout'),
  auditHeaderStatus: document.getElementById('audit-header-status'),
  auditDot: document.getElementById('audit-dot'),
  auditText: document.getElementById('audit-text')
};

// Variáveis de Captura Biométrica
let capturedFaceDescriptor = null;
let capturedFaceBlob = null;
let currentCameraStream = null;

// Variáveis de Estado de Edição de Cadastro
let editMode = false;
let editingPersonId = null;
let originalPersonData = null; // Armazena estado original para gerar logs de auditoria detalhados


// --- INICIALIZAÇÃO E AUTENTICAÇÃO ---

async function init() {
  setupEventListeners();
  maskCpfInput();

  // Verifica se as credenciais do Supabase estão salvas no localStorage ou no .env
  const storedUrl = localStorage.getItem('supabase_url');
  const storedKey = localStorage.getItem('supabase_key');
  const storedEncKey = localStorage.getItem('encryption_key');

  if (storedUrl && storedKey) {
    supabaseUrl = storedUrl;
    supabaseKey = storedKey;
    if (storedEncKey) encryptionKey = storedEncKey;
  }

  if (!supabaseUrl || !supabaseKey) {
    // Abre modal de setup caso falte as chaves do Supabase
    dom.modalSupabase.classList.remove('hidden');
    return;
  }

  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log("[SV] Supabase inicializado com sucesso.");
    
    // Verifica sessão ativa
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      onUserAuthenticated(session.user);
    } else {
      showLoginModal();
    }
  } catch (err) {
    console.error("[SV] Erro ao conectar ao Supabase:", err);
    localStorage.removeItem('supabase_url');
    localStorage.removeItem('supabase_key');
    dom.modalSupabase.classList.remove('hidden');
  }
}

function showLoginModal() {
  dom.modalLogin.classList.remove('hidden');
}

function onUserAuthenticated(user) {
  isUserAuthenticated = true;
  dom.modalLogin.classList.add('hidden');
  dom.modalSupabase.classList.add('hidden');
  console.log("[SV] Usuário autenticado:", user.email);

  // Inicia o carregamento dos modelos faciais e ativa o feed da câmera
  loadModelsAndStart();
  
  // Carrega configurações de câmeras e pessoas do Supabase
  loadRegisteredPeople();
  loadCamerasConfig();
  
  // Inscreve-se nos canais de tempo real (Auditoria e Logs)
  setupRealtimeSubscriptions();
}

// --- CARREGAMENTO DE MODELOS E VÍDEO ---

async function loadModelsAndStart() {
  dom.loading.classList.remove('hidden');
  try {
    console.log("[SV] Carregando modelos do face-api.js...");
    // Carrega modelos faciais salvos localmente na pasta /models/
    await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
    await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
    await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
    await faceapi.nets.ageGenderNet.loadFromUri('/models');
    
    modelsLoaded = true;
    console.log("[SV] Todos os modelos de biometria carregados.");
    
    // Inicia câmera padrão (Webcam)
    startCamera("webcam_local");
  } catch (err) {
    console.error("[SV] Erro ao carregar modelos faciais:", err);
    dom.photoFeedback.innerText = "Erro ao carregar modelos. Recarregue a página.";
  }
}

async function startCamera(camType, camUrl = "") {
  // Para stream atual da webcam se ativo
  if (currentCameraStream) {
    currentCameraStream.getTracks().forEach(track => track.stop());
    currentCameraStream = null;
  }

  dom.loading.classList.remove('hidden');
  dom.video.classList.add('hidden');
  dom.mjpegFeed.classList.add('hidden');

  if (camType === "webcam_local") {
    dom.video.classList.remove('hidden');
    dom.activeCameraTitle.innerText = "Monitoramento: Webcam Principal (Navegador)";
    try {
      currentCameraStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, frameRate: { ideal: 30 } }
      });
      dom.video.srcObject = currentCameraStream;
      
      dom.video.onloadedmetadata = () => {
        setupCanvasDimensions(dom.video);
        dom.loading.classList.add('fade-out');
        setTimeout(() => dom.loading.classList.add('hidden'), 500);
        startRecognitionLoop();
      };
    } catch (err) {
      console.error("[SV] Erro ao acessar webcam local:", err);
      dom.loading.innerHTML = `<span class="material-icons-round text-error">error</span><p>Não foi possível acessar a webcam local.</p>`;
    }
  } else {
    // Stream de câmera RTSP/IP via Proxy Backend MJPEG
    dom.mjpegFeed.classList.remove('hidden');
    dom.activeCameraTitle.innerText = `Monitoramento: ${camUrl}`;
    
    // Codifica URL em Base64 para evitar quebra de rota
    const urlB64 = btoa(camUrl);
    const feedUrl = `http://localhost:5000/video_feed?url_b64=${urlB64}`;
    
    dom.mjpegFeed.src = feedUrl;
    
    dom.mjpegFeed.onload = () => {
      setupCanvasDimensions(dom.mjpegFeed);
      dom.loading.classList.add('fade-out');
      setTimeout(() => dom.loading.classList.add('hidden'), 500);
      startRecognitionLoop();
    };

    dom.mjpegFeed.onerror = () => {
      console.error("[SV] Erro ao conectar ao feed de vídeo do backend.");
      dom.loading.innerHTML = `<span class="material-icons-round text-error">videocam_off</span><p>Erro no stream do backend (verifique se o backend Python está rodando).</p>`;
    };
  }
}

function setupCanvasDimensions(mediaElement) {
  const rect = mediaElement.getBoundingClientRect();
  dom.canvas.width = mediaElement.videoWidth || mediaElement.naturalWidth || rect.width || 640;
  dom.canvas.height = mediaElement.videoHeight || mediaElement.naturalHeight || rect.height || 480;
}

// --- LOOP DE RECONHECIMENTO E RASTREAMENTO FACIAL ---

let recognitionIntervalId = null;

function startRecognitionLoop() {
  if (recognitionIntervalId) clearInterval(recognitionIntervalId);
  
  // Roda a detecção a cada 250ms para manter o navegador fluido
  recognitionIntervalId = setInterval(async () => {
    if (!modelsLoaded || !isTrackingActive || !isUserAuthenticated) return;
    
    const activeElement = dom.video.classList.contains('hidden') ? dom.mjpegFeed : dom.video;
    if (activeElement.classList.contains('hidden')) return;

    // Detecção facial com landmarks, extração de características e estimativa de idade
    const detections = await faceapi.detectAllFaces(
      activeElement, 
      new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 })
    ).withFaceLandmarks().withFaceDescriptors().withAgeAndGender();

    drawTrackingOverlay(detections, activeElement);
  }, 250);
}

function drawTrackingOverlay(detections, mediaElement) {
  const ctx = dom.canvas.getContext('2d');
  ctx.clearRect(0, 0, dom.canvas.width, dom.canvas.height);

  dom.facesCount.innerText = detections.length;

  if (detections.length === 0) {
    // Se não houver faces, envelhece os rastreadores ativos
    activeTracks = activeTracks.filter(track => {
      track.lastSeen++;
      return track.lastSeen < 10; // Mantém no histórico por 10 frames (~2.5s)
    });
    return;
  }

  // Redimensiona caixas de acordo com o tamanho real do Canvas overlay
  const displaySize = { width: dom.canvas.width, height: dom.canvas.height };
  const resizedDetections = faceapi.resizeResults(detections, displaySize);

  let matchScores = [];

  resizedDetections.forEach(det => {
    const box = det.detection.box;
    const descriptor = det.descriptor;
    const age = Math.round(det.age);
    const centroid = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

    // 1. Identificar face comparando com as assinaturas faciais no cache (in-memory)
    let bestMatchName = "Desconhecido";
    let bestMatchId = null;
    let minDistance = 1.0; // Distância Euclidiana (menor = mais parecido)

    registeredFaces.forEach(face => {
      // Calcula a distância euclidiana entre os dois vetores de 128 floats
      const dist = faceapi.euclideanDistance(descriptor, face.descriptor);
      if (dist < minDistance) {
        minDistance = dist;
        bestMatchName = face.nome;
        bestMatchId = face.pessoa_id;
      }
    });

    const confidence = Math.round((1 - minDistance) * 100);
    const isMatched = minDistance < 0.5; // Limite padrão para correspondência segura

    const label = isMatched ? bestMatchName : "Desconhecido";
    if (isMatched) {
      matchScores.push(confidence);
      dom.lastRecognized.innerText = `${label} (${age} anos)`;
    }

    // 2. Algoritmo simples de Rastreamento (Centroide / IoU Tracker)
    let assignedTrack = null;
    let minTrackDist = 80; // Tolerância em pixels para associar a mesma pessoa

    activeTracks.forEach(track => {
      const lastCentroid = track.centroidHistory[track.centroidHistory.length - 1];
      const dist = Math.hypot(centroid.x - lastCentroid.x, centroid.y - lastCentroid.y);
      if (dist < minTrackDist) {
        minTrackDist = dist;
        assignedTrack = track;
      }
    });

    if (assignedTrack) {
      // Atualiza rastreador existente
      assignedTrack.lastBox = box;
      assignedTrack.centroidHistory.push(centroid);
      if (assignedTrack.centroidHistory.length > 15) assignedTrack.centroidHistory.shift();
      assignedTrack.lastSeen = 0;
      assignedTrack.age = age;
      // Atualiza o label se reconhecido
      if (isMatched) {
        assignedTrack.label = label;
        assignedTrack.confidence = confidence;
        assignedTrack.pessoa_id = bestMatchId;
      }
    } else {
      // Cria novo rastreador
      assignedTrack = {
        id: nextTrackId++,
        lastBox: box,
        centroidHistory: [centroid],
        label: label,
        confidence: isMatched ? confidence : 0,
        pessoa_id: isMatched ? bestMatchId : null,
        lastSeen: 0,
        age: age,
        logged: false // Evita logar múltiplas vezes o mesmo evento continuamente
      };
      activeTracks.push(assignedTrack);
    }

    // 3. Logar a detecção no Supabase e na UI (Apenas se não logado recentemente neste track)
    if (!assignedTrack.logged) {
      assignedTrack.logged = true;
      logAccessEvent(assignedTrack.pessoa_id, assignedTrack.label, isMatched ? (1 - minDistance) : 0, age);
    }

    // 4. Desenha elementos visuais na tela
    // Cor: Vermelho para bloqueados, Verde para reconhecidos, Laranja para desconhecidos
    const isBlockedPerson = isMatched && registeredFaces.find(f => f.pessoa_id === bestMatchId)?.status === 'bloqueado';
    const color = isBlockedPerson ? '#ef4444' : isMatched ? '#10b981' : '#f59e0b';
    
    // Caixa delimitadora
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.strokeRect(box.x, box.y, box.width, box.height);

    // Cantos destacados (Efeito Sci-Fi)
    ctx.fillStyle = color;
    const cornerLen = 15;
    const cornerW = 5;
    // Top-Left
    ctx.fillRect(box.x, box.y, cornerLen, cornerW);
    ctx.fillRect(box.x, box.y, cornerW, cornerLen);
    // Top-Right
    ctx.fillRect(box.x + box.width - cornerLen, box.y, cornerLen, cornerW);
    ctx.fillRect(box.x + box.width - cornerW, box.y, cornerW, cornerLen);
    // Bottom-Left
    ctx.fillRect(box.x, box.y + box.height - cornerW, cornerLen, cornerW);
    ctx.fillRect(box.x, box.y + box.height - cornerLen, cornerW, cornerLen);
    // Bottom-Right
    ctx.fillRect(box.x + box.width - cornerLen, box.y + box.height - cornerW, cornerLen, cornerW);
    ctx.fillRect(box.x + box.width - cornerW, box.y + box.height - cornerLen, cornerW, cornerLen);

    // Label do nome / rastreador
    ctx.fillStyle = color;
    ctx.font = 'bold 12px Plus Jakarta Sans';
    const textLabel = isMatched ? `${label} (${age}a, ${confidence}%)` : `Desconhecido #${assignedTrack.id} (${age}a)`;
    const textWidth = ctx.measureText(textLabel).width;
    ctx.fillRect(box.x, box.y - 22, textWidth + 16, 22);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(textLabel, box.x + 8, box.y - 6);

    // Desenha rastro da trajetória (Rastreamento em tempo real)
    ctx.beginPath();
    ctx.strokeStyle = isMatched ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.4)';
    ctx.lineWidth = 2;
    assignedTrack.centroidHistory.forEach((pt, idx) => {
      if (idx === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.stroke();
  });

  // Calcula confiança média
  if (matchScores.length > 0) {
    const sum = matchScores.reduce((a, b) => a + b, 0);
    dom.avgConfidence.innerText = `${Math.round(sum / matchScores.length)}%`;
  }

  // Remove tracks antigos não vistos
  activeTracks = activeTracks.filter(track => {
    track.lastSeen++;
    return track.lastSeen < 12;
  });
}

// --- LOGS E COMUNICAÇÃO SUPABASE ---

async function logAccessEvent(pessoaId, label, similarity, age = null) {
  const activeCameraId = dom.cameraSelect.value === "webcam_local" ? null : dom.cameraSelect.value;
  const timeString = new Date().toLocaleTimeString('pt-BR');
  
  // Verifica se a pessoa detectada está bloqueada no cache local
  const cachedPerson = pessoaId ? registeredFaces.find(f => f.pessoa_id === pessoaId) : null;
  const isBloqueado = cachedPerson && cachedPerson.status === 'bloqueado';
  
  // Adiciona imediatamente na UI
  const isUnknown = label === "Desconhecido";
  const logCard = document.createElement('div');
  
  let cardClass = 'log-card ';
  let icon = 'help_outline';
  if (isBloqueado) {
    cardClass += 'blocked'; // Vermelho pulsante para bloqueados
    icon = 'block';
    // Dispara alerta sonoro de acesso bloqueado
    triggerBlockedPersonAlert(label);
  } else if (isUnknown) {
    cardClass += 'unauthorized';
    icon = 'help_outline';
  } else {
    cardClass += 'success';
    icon = 'check_circle_outline';
  }

  logCard.className = cardClass;
  
  logCard.innerHTML = `
    <span class="material-icons-round log-avatar" style="font-size: 2.2rem; line-height:36px; text-align:center; color: ${isBloqueado ? '#ef4444' : isUnknown ? '#f59e0b' : '#10b981'}">
      ${icon}
    </span>
    <div class="log-info">
      <span class="log-name">${label} ${age ? `(${age} anos)` : ''}${isBloqueado ? ' <span style="color:#ef4444;font-weight:700;">⛔ BLOQUEADO</span>' : ''}</span>
      <span class="log-time">${timeString}</span>
    </div>
    <span class="log-score" style="${isBloqueado ? 'color:#ef4444;font-weight:700;' : ''}">${isUnknown ? 'Desconhecido' : `${Math.round(similarity * 100)}%`}</span>
  `;

  // Insere no início do painel de logs
  if (dom.accessLogs.querySelector('.log-card.empty')) {
    dom.accessLogs.innerHTML = '';
  }
  dom.accessLogs.insertBefore(logCard, dom.accessLogs.firstChild);

  // Limita logs visíveis na tela para evitar gargalo de DOM
  if (dom.accessLogs.children.length > 15) {
    dom.accessLogs.lastChild.remove();
  }

  // Salva no Supabase `reconhecimentos` se logado
  if (supabase) {
    try {
      await supabase.from('reconhecimentos').insert([{
        camera_id: activeCameraId,
        pessoa_id: pessoaId,
        confianca: similarity > 0 ? similarity : null,
        metadata: age ? { idade_estimada: age } : null
      }]);
    } catch (e) {
      console.error("[SV] Erro ao gravar reconhecimento remoto:", e);
    }
  }
}

// Dispara alerta sonoro e visual quando pessoa bloqueada é detectada pela câmera
function triggerBlockedPersonAlert(nome) {
  // Toca som de alarme duplo
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.4].forEach(startOffset => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + startOffset);
      osc.frequency.linearRampToValueAtTime(440, audioCtx.currentTime + startOffset + 0.3);
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime + startOffset);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + startOffset + 0.35);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(audioCtx.currentTime + startOffset);
      osc.stop(audioCtx.currentTime + startOffset + 0.35);
    });
  } catch(e) {}

  // Pisca o log panel em vermelho por 3 segundos
  dom.accessLogs.style.boxShadow = '0 0 20px rgba(239,68,68,0.7)';
  dom.accessLogs.style.border = '2px solid #ef4444';
  setTimeout(() => {
    dom.accessLogs.style.boxShadow = '';
    dom.accessLogs.style.border = '';
  }, 3000);

  console.warn(`[SEGURANÇA] Pessoa BLOQUEADA detectada pela câmera: ${nome}`);
}

async function loadRegisteredPeople() {
  if (!supabase) return;
  try {
    // 1. Carrega dados completos de pessoas
    const { data: pessoas, error } = await supabase
      .from('pessoas')
      .select('id, nome, cpf_mascarado, idade, status, consentimento_registrado, foto_url, created_by, created_at, updated_at');
      
    if (error) throw error;
    
    // 2. Carrega embeddings faciais associados
    const { data: embeddings, error: errEmb } = await supabase
      .from('face_embeddings')
      .select('pessoa_id, embedding, foto_url, qualidade_imagem');
      
    if (errEmb) throw errEmb;

    // Reconstrói cache facial em memória (somente pessoas ativas e bloqueadas — inativas são ignoradas)
    registeredFaces = embeddings.map(e => {
      const pessoa = pessoas.find(p => p.id === e.pessoa_id);
      if (!pessoa || pessoa.status === 'inativo') return null;
      
      // Converte o vetor retornado do Supabase para Float32Array
      let descriptorArray = null;
      if (typeof e.embedding === 'string') {
        descriptorArray = new Float32Array(JSON.parse(e.embedding));
      } else if (Array.isArray(e.embedding)) {
        descriptorArray = new Float32Array(e.embedding);
      }

      return {
        pessoa_id: e.pessoa_id,
        nome: pessoa.nome,
        status: pessoa.status,
        descriptor: descriptorArray,
        foto_url: pessoa.foto_url || e.foto_url
      };
    }).filter(f => f !== null && f.descriptor !== null);

    console.log(`[SV] Cache carregado: ${registeredFaces.length} embeddings ativos.`);
    
    // Atualiza a visualização na aba de pessoas cadastradas
    renderPeopleList(pessoas, embeddings);
  } catch (err) {
    console.error("[SV] Erro ao sincronizar banco com memória:", err);
  }
}

function renderPeopleList(pessoas, embeddings) {
  dom.peopleList.innerHTML = '';
  if (pessoas.length === 0) {
    dom.peopleList.innerHTML = '<p class="text-center text-dimmed p-4">Nenhuma pessoa cadastrada.</p>';
    return;
  }

  const statusConfig = {
    ativo:     { cls: 'badge-success', icon: 'check_circle',          label: 'Ativo'     },
    bloqueado: { cls: 'badge-error',   icon: 'block',                 label: 'Bloqueado' },
    inativo:   { cls: 'badge-warning', icon: 'radio_button_unchecked', label: 'Inativo'  }
  };

  pessoas.forEach(p => {
    const emb = embeddings.find(e => e.pessoa_id === p.id);
    const avatarSrc = p.foto_url || (emb ? emb.foto_url : '');
    const statusInfo = statusConfig[p.status] || statusConfig.inativo;
    const isBloqueado = p.status === 'bloqueado';
    // CPF já vem mascarado do banco (cpf_mascarado)
    const cpfExibido = p.cpf_mascarado || 'CPF Protegido';

    const card = document.createElement('div');
    card.className = `person-card ${isBloqueado ? 'person-card--blocked' : ''}`;
    card.innerHTML = `
      <img src="${avatarSrc || 'https://via.placeholder.com/40'}" class="person-avatar" onerror="this.src='https://via.placeholder.com/40'">
      <div class="person-details">
        <h4>${p.nome}</h4>
        <p>${cpfExibido}</p>
        <span class="badge ${statusInfo.cls} badge-sm">
          <span class="material-icons-round" style="font-size:12px;vertical-align:middle;margin-right:2px">${statusInfo.icon}</span>
          ${statusInfo.label}
        </span>
      </div>
      <div class="person-card-actions">
        <button class="btn-edit-person" data-id="${p.id}" title="Editar Cadastro">
          <span class="material-icons-round">edit</span>
        </button>
        <button class="btn-delete-person" data-id="${p.id}" title="Deletar Cadastro">
          <span class="material-icons-round">delete_outline</span>
        </button>
      </div>
    `;

    card.querySelector('.btn-edit-person').addEventListener('click', () => enterEditMode(p, embeddings));

    card.querySelector('.btn-delete-person').addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      if (confirm("Deseja realmente excluir este cadastro biométrico permanentemente? Esta ação não pode ser desfeita.")) {
        await deletePerson(id);
      }
    });

    dom.peopleList.appendChild(card);
  });
}

function enterEditMode(pessoa, embeddings) {
  editMode = true;
  editingPersonId = pessoa.id;

  // Armazena estado original para gerar diff no audit_log
  // Nota: cpf_mascarado não é editável diretamente — apenas exibido
  originalPersonData = {
    nome:   pessoa.nome,
    idade:  pessoa.idade || '',
    status: pessoa.status || 'ativo'
  };

  // Preenche o formulário com os dados atuais
  dom.cadNome.value   = pessoa.nome  || '';
  dom.cadCpf.value    = pessoa.cpf_mascarado || '';
  dom.cadStatus.value = pessoa.status || 'ativo';

  // Preenche data de nascimento (campo mantido no HTML mas não no novo schema — usa idade)
  if (dom.cadDataNasc) dom.cadDataNasc.value = '';
  if (dom.cadObs)      dom.cadObs.value      = '';

  // Se houver foto cadastrada, exibe no preview
  const fotoSrc = pessoa.foto_url || (embeddings.find(e => e.pessoa_id === pessoa.id)?.foto_url);
  if (fotoSrc) {
    dom.previewImg.src = fotoSrc;
    dom.previewImg.classList.remove('hidden');
    dom.previewCanvas.classList.add('hidden');
    dom.previewIcon.classList.add('hidden');
    dom.photoBox.className = 'photo-preview-box success';
    dom.photoFeedback.innerText = 'Foto atual. Capture/faça upload para substituir a biometria.';
  }

  dom.cadastroFormTitle.innerText = `Editando: ${pessoa.nome}`;
  dom.editBadge.classList.remove('hidden');
  dom.btnCancelEdit.classList.remove('hidden');
  dom.btnSubmitCadastro.innerHTML = '<span class="material-icons-round">save</span> Salvar Alterações';
  dom.cadConsent.checked = true;

  dom.btnCadastroTab.click();
  validateFormInputs();

  console.log(`[SV] Modo de edição ativado para: ${pessoa.nome} (ID: ${pessoa.id})`);
}

async function deletePerson(id) {
  if (!supabase) return;
  try {
    // A remoção da biometria e arquivos do storage ocorrerá em cascata / gatilho se configurados,
    // ou fazemos a deleção direta na tabela de pessoas.
    const { error } = await supabase.from('pessoas').delete().eq('id', id);
    if (error) throw error;
    
    console.log("[SV] Cadastro excluído com sucesso.");
    loadRegisteredPeople();
  } catch (err) {
    console.error("[SV] Erro ao excluir cadastro:", err);
  }
}

// --- CADASTRO BIOMÉTRICO (FORMULÁRIO E CAPTURA) ---

async function capturePhotoFromStream() {
  const activeElement = dom.video.classList.contains('hidden') ? dom.mjpegFeed : dom.video;
  if (activeElement.classList.contains('hidden')) {
    alert("Nenhuma câmera ativa para capturar foto!");
    return;
  }

  dom.photoFeedback.innerText = "Analisando face...";
  dom.photoBox.className = "photo-preview-box";
  
  // Configura tamanho do canvas de captura
  const width = activeElement.videoWidth || activeElement.naturalWidth || 640;
  const height = activeElement.videoHeight || activeElement.naturalHeight || 480;
  
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const ctx = tempCanvas.getContext('2d');
  
  // Desenha o frame atual
  ctx.drawImage(activeElement, 0, 0, width, height);
  
  // Executa detecção na foto capturada para garantir que há uma face elegível
  const detection = await faceapi.detectSingleFace(
    tempCanvas, 
    new faceapi.SsdMobilenetv1Options({ minConfidence: 0.6 })
  ).withFaceLandmarks().withFaceDescriptor();

  if (!detection) {
    dom.photoBox.className = "photo-preview-box error";
    dom.photoFeedback.innerText = "Nenhuma face detectada! Tente novamente em outra posição.";
    capturedFaceDescriptor = null;
    capturedFaceBlob = null;
    dom.btnSubmitCadastro.disabled = true;
    return;
  }

  // Desenha no canvas de preview
  dom.previewCanvas.classList.remove('hidden');
  dom.previewImg.classList.add('hidden');
  dom.previewIcon.classList.add('hidden');

  dom.previewCanvas.width = width;
  dom.previewCanvas.height = height;
  const prevCtx = dom.previewCanvas.getContext('2d');
  prevCtx.drawImage(tempCanvas, 0, 0);

  // Desenha caixa facial na foto apenas para feedback visual
  prevCtx.strokeStyle = '#10b981';
  prevCtx.lineWidth = 4;
  const box = detection.detection.box;
  prevCtx.strokeRect(box.x, box.y, box.width, box.height);

  // Salva o descritor e o frame como blob
  capturedFaceDescriptor = detection.descriptor;
  
  tempCanvas.toBlob((blob) => {
    capturedFaceBlob = blob;
    dom.photoBox.className = "photo-preview-box success";
    dom.photoFeedback.innerText = "Face capturada com sucesso!";
    validateFormInputs();
  }, 'image/jpeg', 0.9);
}

async function uploadPhotoFromFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  dom.photoFeedback.innerText = "Processando imagem...";
  dom.photoBox.className = "photo-preview-box";

  const reader = new FileReader();
  reader.onload = async (e) => {
    dom.previewImg.src = e.target.result;
    dom.previewImg.classList.remove('hidden');
    dom.previewCanvas.classList.add('hidden');
    dom.previewIcon.classList.add('hidden');

    // Aguarda carregar
    dom.previewImg.onload = async () => {
      const detection = await faceapi.detectSingleFace(
        dom.previewImg,
        new faceapi.SsdMobilenetv1Options({ minConfidence: 0.6 })
      ).withFaceLandmarks().withFaceDescriptor();

      if (!detection) {
        dom.photoBox.className = "photo-preview-box error";
        dom.photoFeedback.innerText = "Nenhuma face clara encontrada na foto de upload!";
        capturedFaceDescriptor = null;
        capturedFaceBlob = null;
        dom.btnSubmitCadastro.disabled = true;
        return;
      }

      capturedFaceDescriptor = detection.descriptor;
      capturedFaceBlob = file; // usa o arquivo de upload diretamente
      dom.photoBox.className = "photo-preview-box success";
      dom.photoFeedback.innerText = "Biometria carregada da foto de upload.";
      validateFormInputs();
    };
  };
  reader.readAsDataURL(file);
}

async function submitCadastro(e) {
  e.preventDefault();
  if (!supabase) return;

  const nome = dom.cadNome.value.trim();
  const cpf = dom.cadCpf.value.trim();
  const dataNasc = dom.cadDataNasc.value;
  const status = dom.cadStatus.value;
  const obs = dom.cadObs.value.trim();

  dom.btnSubmitCadastro.disabled = true;
  dom.btnSubmitCadastro.innerHTML = `<div class="spinner" style="width:16px;height:16px;border-width:2px;display:inline-block;margin-right:8px;"></div> Processando...`;

  try {
    // Obtém administrador autenticado atual
    const { data: { user } } = await supabase.auth.getUser();
    const adminEmail = user ? user.email : 'admin_sistema';

    // 1. Criptografa o CPF no cliente (para salvar de forma segura)
    const cpfCifrado = CryptoJS.AES.encrypt(cpf, encryptionKey).toString();
    
    // Gera o blind index do CPF usando hash SHA-256 para busca única sem expor dados
    const cpfClean = cpf.replace(/\D/g, '');
    const cpfHash = CryptoJS.SHA256(cpfClean).toString();

    if (editMode) {
      // --- MODO EDIÇÃO ---
      console.log(`[SV] Editando cadastro ID: ${editingPersonId}`);
      
      // 2. Atualiza a Pessoa
      const { error: errUpdate } = await supabase
        .from('pessoas')
        .update({
          nome: nome,
          cpf_encrypted: cpfCifrado,
          cpf_hash: cpfHash,
          data_nascimento: dataNasc,
          status: status,
          observacoes: obs,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingPersonId);

      if (errUpdate) {
        if (errUpdate.code === '23505') throw new Error("CPF Duplicado! Este CPF já pertence a outro usuário cadastrado.");
        throw errUpdate;
      }

      // 3. Se uma nova foto foi tirada/carregada
      if (capturedFaceDescriptor && capturedFaceBlob) {
        const fileExt = 'jpg';
        const filePath = `cadastros/${editingPersonId}_${Date.now()}.${fileExt}`;
        
        const { error: errUpload } = await supabase.storage
          .from('fotos')
          .upload(filePath, capturedFaceBlob, { contentType: 'image/jpeg', upsert: true });

        if (errUpload) throw errUpload;

        const { data: { publicUrl } } = supabase.storage
          .from('fotos')
          .getPublicUrl(filePath);

        // Deleta biometria anterior e insere a nova
        await supabase.from('biometria').delete().eq('pessoa_id', editingPersonId);
        
        const descriptorArray = Array.from(capturedFaceDescriptor);
        const { error: errBio } = await supabase
          .from('biometria')
          .insert([{
            pessoa_id: editingPersonId,
            descriptor: descriptorArray,
            foto_url: publicUrl
          }]);

        if (errBio) throw errBio;
      }

      // 4. Registra Logs de Auditoria detalhando mudanças de valores
      const diff = {};
      if (originalPersonData.nome !== nome) diff.nome = { old: originalPersonData.nome, new: nome };
      if (originalPersonData.data_nascimento !== dataNasc) diff.data_nascimento = { old: originalPersonData.data_nascimento, new: dataNasc };
      if (originalPersonData.status !== status) diff.status = { old: originalPersonData.status, new: status };
      if (originalPersonData.observacoes !== obs) diff.observacoes = { old: originalPersonData.observacoes || '', new: obs };
      if (capturedFaceDescriptor) diff.foto = { old: 'Foto Anterior', new: 'Nova Foto Biométrica' };

      if (Object.keys(diff).length > 0) {
        const changesText = Object.entries(diff)
          .map(([field, values]) => `${field} ('${values.old}' -> '${values.new}')`)
          .join(', ');

        await supabase.from('audit_logs').insert([{
          tipo_evento: 'ALTERACAO_CADASTRO',
          descricao: `Cadastro de ${nome} alterado por ${adminEmail}. Alterações: ${changesText}`,
          detalhes: {
            pessoa_id: editingPersonId,
            alterado_por: adminEmail,
            mudancas: diff
          },
          revertido: false
        }]);
      }

      alert("Cadastro biométrico atualizado com sucesso!");
      exitEditMode();
      
    } else {
      // --- MODO NOVO CADASTRO ---
      if (!capturedFaceDescriptor || !capturedFaceBlob) {
        throw new Error("A captura ou upload de foto biométrica é obrigatória para novos cadastros!");
      }

      // 2. Insere a Pessoa na tabela pessoas
      const { data: pessoa, error: errPessoa } = await supabase
        .from('pessoas')
        .insert([{
          nome: nome,
          cpf_encrypted: cpfCifrado,
          cpf_hash: cpfHash,
          data_nascimento: dataNasc,
          status: status,
          observacoes: obs,
          criado_por: adminEmail
        }])
        .select()
        .single();

      if (errPessoa) {
        if (errPessoa.code === '23505') throw new Error("CPF Duplicado! Este CPF já está cadastrado no sistema.");
        throw errPessoa;
      }

      // 3. Faz upload da Foto no Storage bucket do Supabase
      const fileExt = 'jpg';
      const filePath = `cadastros/${pessoa.id}_${Date.now()}.${fileExt}`;
      
      const { error: errUpload } = await supabase.storage
        .from('fotos')
        .upload(filePath, capturedFaceBlob, { contentType: 'image/jpeg' });

      if (errUpload) throw errUpload;

      // Obtém link público da imagem enviada
      const { data: { publicUrl } } = supabase.storage
        .from('fotos')
        .getPublicUrl(filePath);

      // 4. Insere o vetor (descriptor) de 128 floats na tabela biometria
      const descriptorArray = Array.from(capturedFaceDescriptor);
      
      const { error: errBio } = await supabase
        .from('biometria')
        .insert([{
          pessoa_id: pessoa.id,
          descriptor: descriptorArray,
          foto_url: publicUrl
        }]);

      if (errBio) throw errBio;

      // 5. Registra Log de criação
      await supabase.from('audit_logs').insert([{
        tipo_evento: 'ALTERACAO_CADASTRO',
        descricao: `Novo cadastro biométrico criado para ${nome} por ${adminEmail}`,
        detalhes: {
          pessoa_id: pessoa.id,
          criado_por: adminEmail
        },
        revertido: false
      }]);

      console.log("[SV] Cadastro biométrico concluído remoto!");
      alert("Cadastro biométrico realizado com sucesso!");

      // Reseta form
      dom.formCadastro.reset();
      resetPhotoPreview();
    }

    loadRegisteredPeople();
    // Vai para a aba de cadastrados
    dom.btnPeopleTab.click();
  } catch (err) {
    console.error("[SV] Erro ao submeter cadastro biométrico:", err);
    alert(err.message || "Erro desconhecido no cadastro.");
  } finally {
    dom.btnSubmitCadastro.disabled = false;
    dom.btnSubmitCadastro.innerText = editMode ? "Salvar Alterações" : "Concluir Cadastro";
  }
}

function exitEditMode() {
  editMode = false;
  editingPersonId = null;
  originalPersonData = null;
  
  dom.cadastroFormTitle.innerText = "Cadastro Biométrico";
  dom.editBadge.classList.add('hidden');
  dom.btnCancelEdit.classList.add('hidden');
  dom.btnSubmitCadastro.innerText = "Concluir Cadastro";
  
  dom.formCadastro.reset();
  resetPhotoPreview();
  validateFormInputs();
}

function resetPhotoPreview() {
  dom.previewCanvas.classList.add('hidden');
  dom.previewImg.classList.add('hidden');
  dom.previewIcon.classList.remove('hidden');
  dom.photoBox.className = "photo-preview-box";
  dom.photoFeedback.innerText = "A foto deve conter uma face clara e iluminada";
  capturedFaceDescriptor = null;
  capturedFaceBlob = null;
  dom.btnSubmitCadastro.disabled = true;
}

function validateFormInputs() {
  const nomeVal = dom.cadNome.value.trim();
  const cpfVal = dom.cadCpf.value.trim();
  const dataNascVal = dom.cadDataNasc.value;
  const consentVal = dom.cadConsent.checked;
  
  const isCpfValido = isValidCpf(cpfVal);
  const needsPhoto = editMode ? false : (capturedFaceDescriptor === null);
  
  const isFormValid = nomeVal.length >= 3 && isCpfValido && dataNascVal !== '' && consentVal && !needsPhoto;
  dom.btnSubmitCadastro.disabled = !isFormValid;
}

// --- CONFIGURAÇÃO DE CÂMERAS ---

async function loadCamerasConfig() {
  if (!supabase) return;
  try {
    const { data: cams, error } = await supabase
      .from('camera_configs')
      .select('*')
      .order('nome', { ascending: true });
      
    if (error) throw error;

    // Reseta select
    dom.cameraSelect.innerHTML = `<option value="webcam_local">Webcam Local (Navegador)</option>`;
    dom.cameraList.innerHTML = `
      <div class="camera-item active" data-id="webcam_local" data-tipo="webcam" data-url="0">
        <span class="material-icons-round text-primary">photo_camera</span>
        <div class="camera-item-info">
          <h4>Webcam Integrada</h4>
          <p>Local USB (0)</p>
        </div>
        <span class="badge badge-success">Online</span>
      </div>
    `;

    cams.forEach(cam => {
      // Injeta no select
      const option = document.createElement('option');
      option.value = cam.id;
      option.innerText = `${cam.nome} (${cam.tipo.toUpperCase()})`;
      dom.cameraSelect.appendChild(option);

      // Injeta na lista lateral
      const isOnline = cam.status === 'ativo';
      const item = document.createElement('div');
      item.className = 'camera-item';
      item.setAttribute('data-id', cam.id);
      item.setAttribute('data-tipo', cam.tipo);
      item.setAttribute('data-url', cam.url);
      
      item.innerHTML = `
        <span class="material-icons-round text-dimmed">videocam</span>
        <div class="camera-item-info">
          <h4>${cam.nome}</h4>
          <p>${cam.url.substring(0, 30)}${cam.url.length > 30 ? '...' : ''}</p>
        </div>
        <span class="badge ${isOnline ? 'badge-success' : 'badge-error'}">${isOnline ? 'Ativa' : 'Off'}</span>
      `;
      
      dom.cameraList.appendChild(item);
    });

    // Adiciona listener para cliques na lista de câmeras
    document.querySelectorAll('.camera-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const target = e.currentTarget;
        document.querySelectorAll('.camera-item').forEach(i => i.classList.remove('active'));
        target.classList.add('active');
        
        const id = target.getAttribute('data-id');
        const tipo = target.getAttribute('data-tipo');
        const url = target.getAttribute('data-url');
        
        dom.cameraSelect.value = id;
        startCamera(tipo, url);
      });
    });

  } catch (err) {
    console.error("[SV] Erro ao carregar configurações de câmeras:", err);
  }
}

async function saveNewCamera() {
  const nome = document.getElementById('modal-cam-nome').value.trim();
  const tipo = document.getElementById('modal-cam-tipo').value;
  const url = document.getElementById('modal-cam-url').value.trim();

  if (!nome || !url) {
    alert("Nome e URL são campos obrigatórios!");
    return;
  }

  try {
    const { error } = await supabase
      .from('camera_configs')
      .insert([{ nome, tipo, url, status: 'ativo' }]);

    if (error) throw error;
    
    // Limpa modal e fecha
    document.getElementById('modal-cam-nome').value = '';
    document.getElementById('modal-cam-url').value = '';
    dom.modalCamera.classList.add('hidden');
    
    loadCamerasConfig();
  } catch (err) {
    console.error("[SV] Erro ao cadastrar câmera:", err);
    alert(err.message);
  }
}

async function scanOnvifCameras() {
  dom.btnScanOnvif.disabled = true;
  dom.btnScanOnvif.innerHTML = `<div class="spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;margin-right:8px;"></div> Buscando...`;

  try {
    const res = await fetch('http://localhost:5000/discover_cameras');
    const data = await res.json();
    
    if (data.status === "success" && data.count > 0) {
      alert(`Descoberta concluída! Encontradas ${data.count} câmeras compatíveis na sua rede.`);
      
      // Abre o modal de cadastro pré-preenchido com a primeira câmera encontrada
      const cam = data.devices[0];
      document.getElementById('modal-cam-nome').value = `Câmera ONVIF ${cam.ip}`;
      document.getElementById('modal-cam-tipo').value = 'rtsp';
      document.getElementById('modal-cam-url').value = cam.rTSP_url_guess;
      
      dom.modalCamera.classList.remove('hidden');
    } else {
      alert("Nenhuma câmera ONVIF multicast encontrada na rede local.");
    }
  } catch (err) {
    console.error("[SV] Erro ao escanear ONVIF:", err);
    alert("Erro na conexão com o backend de descoberta.");
  } finally {
    dom.btnScanOnvif.disabled = false;
    dom.btnScanOnvif.innerHTML = `<span class="material-icons-round">travel_explore</span> Buscar Câmeras ONVIF`;
  }
}

// --- SISTEMA DE AUDITORIA E REALTIME ---

function setupRealtimeSubscriptions() {
  if (!supabase) return;

  console.log("[SV] Assinando atualizações em tempo real do banco de dados...");

  // Inscreve-se na tabela de `audit_logs` para receber alertas de código alterado
  supabase
    .channel('public:audit_logs')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs' }, (payload) => {
      const log = payload.new;
      console.log("[AUDIT] Novo evento de auditoria recebido:", log);
      
      // Mostra log na tela
      addAuditLogItem(log);
      
      // Se for alteração de código, dispara o alerta de invasão visual na tela
      if (log.tipo_evento === 'MODIFICACAO_CODIGO') {
        triggerSecurityIntrusionOverlay(log);
      }
    })
    .subscribe();

  // Polling fallback para logs de auditoria caso realtime falhe
  setInterval(loadRecentAuditLogs, 5000);
  loadRecentAuditLogs();
}

async function loadRecentAuditLogs() {
  if (!supabase) return;
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) throw error;
    
    dom.auditLogsMini.innerHTML = '';
    if (data.length === 0) {
      dom.auditLogsMini.innerHTML = '<div class="log-item empty"><p class="text-center text-dimmed">Nenhum evento registrado.</p></div>';
      return;
    }

    data.forEach(log => addAuditLogItem(log));
  } catch (e) {
    // Silencia erros de pooling
  }
}

function addAuditLogItem(log) {
  const timeStr = new Date(log.created_at).toLocaleTimeString('pt-BR');
  const pathClean = log.detalhes?.arquivo || 'Sistema';
  
  // Evita duplicados na mini-lista
  const existing = document.getElementById(`audit-log-${log.id}`);
  if (existing) return;

  const item = document.createElement('div');
  item.id = `audit-log-${log.id}`;
  item.className = `audit-mini-log-item danger`;
  item.innerHTML = `
    <strong>[${timeStr}]</strong> ${log.descricao.substring(0, 30)}... (${log.revertido ? 'REVERTIDO' : 'ALERTA'})
  `;
  
  dom.auditLogsMini.insertBefore(item, dom.auditLogsMini.firstChild);
  if (dom.auditLogsMini.children.length > 5) {
    dom.auditLogsMini.lastChild.remove();
  }
}

function triggerSecurityIntrusionOverlay(log) {
  // Dispara áudio de aviso sonoro de segurança
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(660, audioCtx.currentTime); // Tom alto de alarme
    oscillator.frequency.linearRampToValueAtTime(880, audioCtx.currentTime + 0.5);
    
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.8);
  } catch(e) {}

  // Atualiza cabeçalho com aviso vermelho piscante
  dom.auditHeaderStatus.classList.add('animate-pulse');
  dom.auditDot.className = 'status-dot red';
  dom.auditText.innerText = 'Código Violado!';
  dom.auditText.className = 'text-error font-bold';

  // Abre overlay de tela inteira bloqueando uso até ser dispensado pelo admin
  dom.auditAlert.classList.remove('hidden');
  dom.auditAlert.querySelector('p').innerText = `Uma modificação não autorizada no arquivo '${log.detalhes?.arquivo || 'fonte'}' foi detectada e revertida com sucesso pelo monitor de auditoria do backend!`;
}

// --- EVENT LISTENERS E MÁSCARAS ---

function setupEventListeners() {
  // Tabs
  dom.btnPeopleTab.addEventListener('click', () => {
    dom.btnPeopleTab.classList.add('active');
    dom.btnCadastroTab.classList.remove('active');
    dom.tabPeople.classList.add('active');
    dom.tabCadastro.classList.remove('active');
  });

  dom.btnCadastroTab.addEventListener('click', () => {
    dom.btnCadastroTab.classList.add('active');
    dom.btnPeopleTab.classList.remove('active');
    dom.tabCadastro.classList.add('active');
    dom.tabPeople.classList.remove('active');
  });

  // Cadastro de Pessoas
  dom.btnCapturePhoto.addEventListener('click', capturePhotoFromStream);
  dom.btnUploadPhoto.addEventListener('change', uploadPhotoFromFile);
  
  dom.formCadastro.addEventListener('submit', submitCadastro);
  dom.btnCancelEdit.addEventListener('click', exitEditMode);
  
  // Validações em tempo real do formulário
  [dom.cadNome, dom.cadCpf, dom.cadConsent].forEach(el => {
    el.addEventListener('input', validateFormInputs);
    el.addEventListener('change', validateFormInputs);
  });

  // Câmeras
  dom.cameraSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val === 'webcam_local') {
      startCamera('webcam_local');
    } else {
      // Procura a câmera nos registros da lista lateral
      const item = document.querySelector(`.camera-item[data-id="${val}"]`);
      if (item) {
        startCamera(item.getAttribute('data-tipo'), item.getAttribute('data-url'));
      }
    }
  });

  dom.btnAddCamera.addEventListener('click', () => dom.modalCamera.classList.remove('hidden'));
  dom.btnScanOnvif.addEventListener('click', scanOnvifCameras);
  dom.btnSaveNewCam.addEventListener('click', saveNewCamera);
  
  document.querySelectorAll('.btn-close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      dom.modalCamera.classList.add('hidden');
      dom.modalSupabase.classList.add('hidden');
      if (!isUserAuthenticated) showLoginModal();
    });
  });

  // Rastreamento Toggle
  document.getElementById('toggle-tracking').addEventListener('change', (e) => {
    isTrackingActive = e.target.checked;
    if (!isTrackingActive) {
      // Limpa overlay se desligado
      const ctx = dom.canvas.getContext('2d');
      ctx.clearRect(0, 0, dom.canvas.width, dom.canvas.height);
    }
  });

  // Dismiss Alerta de Auditoria
  dom.btnDismissAlert.addEventListener('click', () => {
    dom.auditAlert.classList.add('hidden');
    dom.auditHeaderStatus.classList.remove('animate-pulse');
    dom.auditDot.className = 'status-dot green';
    dom.auditText.innerText = 'Auditoria Ativa';
    dom.auditText.className = '';
  });

  // Limpar Logs de Acesso
  dom.btnClearLogs.addEventListener('click', () => {
    dom.accessLogs.innerHTML = '<div class="log-card empty"><p class="text-dimmed">Logs limpos. Aguardando detecção...</p></div>';
  });

  // Busca de Pessoas
  dom.searchPeople.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    document.querySelectorAll('.person-card').forEach(card => {
      const name = card.querySelector('h4').innerText.toLowerCase();
      if (name.includes(query)) card.classList.remove('hidden');
      else card.classList.add('hidden');
    });
  });

  // Modal Setup Supabase
  dom.btnSaveSupabase.addEventListener('click', () => {
    const url = document.getElementById('setup-sb-url').value.trim();
    const key = document.getElementById('setup-sb-key').value.trim();
    const encKey = document.getElementById('setup-encrypt-key').value.trim();

    if (!url || !key) {
      alert("Configuração incompleta!");
      return;
    }

    localStorage.setItem('supabase_url', url);
    localStorage.setItem('supabase_key', key);
    if (encKey) {
      localStorage.setItem('encryption_key', encKey);
      encryptionKey = encKey;
    }

    dom.modalSupabase.classList.add('hidden');
    init(); // Reinicia com novas credenciais
  });

  // Modal Login
  dom.btnDoLogin.addEventListener('click', async () => {
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-password').value;
    
    dom.btnDoLogin.disabled = true;
    dom.btnDoLogin.innerText = "Autenticando...";
    const errorEl = document.getElementById('login-error-msg');
    errorEl.classList.add('hidden');

    try {
      if (!supabase) {
        // Fallback local se Supabase falhou na inicialização inicial
        throw new Error("Conexão Supabase indisponível. Configure as credenciais primeiro.");
      }
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: pass
      });

      if (error) throw error;
      
      onUserAuthenticated(data.user);
    } catch (err) {
      console.error("[SV] Falha no login:", err);
      errorEl.innerText = err.message || "E-mail ou senha inválidos.";
      errorEl.classList.remove('hidden');
      dom.btnDoLogin.disabled = false;
      dom.btnDoLogin.innerText = "Autenticar";
    }
  });

  // Sair do Painel
  dom.btnLogout.addEventListener('click', async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    isUserAuthenticated = false;
    dom.modalLogin.classList.remove('hidden');
    if (currentCameraStream) {
      currentCameraStream.getTracks().forEach(track => track.stop());
    }
  });
}

function maskCpfInput() {
  dom.cadCpf.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 11) value = value.slice(0, 11);
    
    // Formata 000.000.000-00
    let formatted = "";
    if (value.length > 0) {
      formatted += value.slice(0, 3);
      if (value.length > 3) {
        formatted += "." + value.slice(3, 6);
        if (value.length > 6) {
          formatted += "." + value.slice(6, 9);
          if (value.length > 9) {
            formatted += "-" + value.slice(9, 11);
          }
        }
      }
    }
    e.target.value = formatted;
    validateFormInputs();
  });
}

// Inicia aplicação
window.addEventListener('DOMContentLoaded', init);
