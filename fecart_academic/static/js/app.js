// --- Security Protocol: Anti-Tamper & DevTools Inspection Block (F12 Block) ---
document.addEventListener('keydown', (e) => {
  // Bloquear F12
  if (e.key === 'F12' || e.keyCode === 123) {
    e.preventDefault();
    e.stopPropagation();
    showSecurityWarning("Acesso Bloqueado: As ferramentas de desenvolvedor (F12) estão restritas pela política de segurança do sistema.");
    return false;
  }

  // Bloquear Ctrl+Shift+I (Inspecionar), Ctrl+Shift+J (Console), Ctrl+Shift+C (Element Selector)
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) {
    e.preventDefault();
    e.stopPropagation();
    showSecurityWarning("Acesso Bloqueado: Atalho de inspeção restrito por protocolo NPU.");
    return false;
  }

  // Bloquear Ctrl+U (Ver Código-Fonte)
  if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U')) {
    e.preventDefault();
    e.stopPropagation();
    showSecurityWarning("Acesso Bloqueado: Exibição de código-fonte desativada.");
    return false;
  }
});

// Bloquear botão direito do mouse (Menu de Contexto / Inspecionar)
document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  showSecurityWarning("Menu de contexto bloqueado por política de integridade.");
  return false;
});

function showSecurityWarning(text) {
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

document.addEventListener('DOMContentLoaded', () => {
  // --- Operator Authentication & Session Management ---
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

  let currentUser = JSON.parse(localStorage.getItem('securevision_user') || 'null');

  function checkAuth() {
    if (currentUser && currentUser.nome) {
      if (authOverlay) authOverlay.classList.add('auth-hidden');
      if (sidebarAvatar) sidebarAvatar.innerText = currentUser.nome.substring(0, 2).toUpperCase();
      if (sidebarUserName) sidebarUserName.innerText = currentUser.nome;
      if (sidebarUserRole) sidebarUserRole.innerText = currentUser.clearance_level || currentUser.role || 'AUTII: Lvl 5';
    } else {
      if (authOverlay) authOverlay.classList.remove('auth-hidden');
    }
  }

  // Toggle Login / Register Tabs
  if (tabBtnLogin && tabBtnRegister) {
    tabBtnLogin.addEventListener('click', () => {
      tabBtnLogin.classList.add('active');
      tabBtnRegister.classList.remove('active');
      formLogin.style.display = 'flex';
      formRegister.style.display = 'none';
      if (authErrorBox) authErrorBox.style.display = 'none';
    });

    tabBtnRegister.addEventListener('click', () => {
      tabBtnRegister.classList.add('active');
      tabBtnLogin.classList.remove('active');
      formRegister.style.display = 'flex';
      formLogin.style.display = 'none';
      if (authErrorBox) authErrorBox.style.display = 'none';
    });
  }

  // Submit Login
  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('loginUsername').value.trim();
      const birthdate = document.getElementById('loginBirthdate').value;
      const password = document.getElementById('loginPassword').value.trim();
      const btnSubmit = document.getElementById('btnSubmitLogin');

      if (!username || !birthdate || !password) {
        showAuthError("Preencha todos os campos: Usuário/Login, Data de Nascimento e Senha.");
        return;
      }

      btnSubmit.disabled = true;
      btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verificando credenciais...';

      try {
        const resp = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, birthdate, password })
        });

        const data = await resp.json();
        if (resp.ok && data.success) {
          currentUser = data.user;
          localStorage.setItem('securevision_user', JSON.stringify(currentUser));
          checkAuth();
          if (authErrorBox) authErrorBox.style.display = 'none';
        } else {
          showAuthError(data.error || "Acesso Negado: Usuário, Data de Nascimento ou Senha incorretos.");
        }
      } catch (err) {
        // Fallback local caso offline
        if ((username.toLowerCase() === 'admin' || username === 'S. Carter') && birthdate === '1985-05-12' && password === 'admin123') {
          currentUser = { id: 'admin', nome: 'S. Carter', role: 'admin', clearance_level: 'AUTII: Lvl 5' };
          localStorage.setItem('securevision_user', JSON.stringify(currentUser));
          checkAuth();
        } else {
          showAuthError("Credenciais inválidas ou erro de conexão com servidor NPU.");
        }
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<i class="fa-solid fa-lock"></i> Autenticar e Acessar Sistema';
      }
    });
  }

  // Submit Register
  if (formRegister) {
    formRegister.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nome = document.getElementById('regNome').value.trim();
      const username = document.getElementById('regUsername').value.trim();
      const birthdate = document.getElementById('regBirthdate').value;
      const password = document.getElementById('regPassword').value.trim();
      const dept = document.getElementById('regDept').value;
      const clearance = document.getElementById('regClearance').value;
      const btnSubmit = document.getElementById('btnSubmitRegister');

      if (!nome || !username || !birthdate || !password) {
        showAuthError("Todos os campos são obrigatórios para registrar uma nova conta.");
        return;
      }

      btnSubmit.disabled = true;
      btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Registrando operador...';

      try {
        const resp = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome, username, birthdate, password, departamento: dept, clearance_level: clearance })
        });

        const data = await resp.json();
        if (resp.ok && data.success) {
          alert(`Conta do operador '${nome}' criada com sucesso!\nVocê já pode realizar o login com suas credenciais.`);
          formRegister.reset();
          tabBtnLogin.click();
          document.getElementById('loginUsername').value = username;
          document.getElementById('loginBirthdate').value = birthdate;
        } else {
          showAuthError(data.error || "Erro ao criar conta.");
        }
      } catch (err) {
        showAuthError("Erro de comunicação ao registrar usuário.");
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<i class="fa-solid fa-user-shield"></i> Criar Conta de Operador';
      }
    });
  }

  function showAuthError(msg) {
    if (authErrorBox && authErrorMsg) {
      authErrorMsg.innerText = msg;
      authErrorBox.style.display = 'flex';
    } else {
      alert(msg);
    }
  }

  // Logout
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      if (confirm("Deseja encerrar a sessão de operador e bloquear o painel?")) {
        localStorage.removeItem('securevision_user');
        currentUser = null;
        checkAuth();
      }
    });
  }

  checkAuth();

  // --- Navigation & Routing ---
  const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
  const viewPanels = document.querySelectorAll('.view-panel');
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const lockdownBtn = document.getElementById('lockdownBtn');
  const lockdownOverlay = document.getElementById('lockdownOverlay');

  function switchTab(tabId) {
    navItems.forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-tab') === tabId);
    });

    viewPanels.forEach(panel => {
      panel.classList.toggle('active-view', panel.id === `${tabId}-view`);
    });

    if (tabId === 'enrollment') {
      initEnrollmentCamera();
      loadEnrolledSubjects();
    } else {
      stopEnrollmentCamera();
    }

    if (tabId === 'logs') {
      loadDetailedLogs();
    }
  }

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tabId = item.getAttribute('data-tab');
      switchTab(tabId);
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

  // --- Emergency Lockdown ---
  let isLockdown = false;
  if (lockdownBtn) {
    lockdownBtn.addEventListener('click', async () => {
      const confirmAction = isLockdown || confirm("ATENÇÃO: Ativar Emergency Lockdown fechará os setores e elevará o nível de alerta para o MÁXIMO. Confirmar?");
      if (!confirmAction) return;

      try {
        const resp = await fetch('/api/lockdown', { method: 'POST' });
        const data = await resp.json();
        isLockdown = data.lockdown_active;

        if (isLockdown) {
          lockdownBtn.innerHTML = '<i class="fa-solid fa-shield-halved"></i> DEACTIVATE LOCKDOWN';
          lockdownBtn.classList.add('active-lockdown');
          lockdownOverlay.classList.add('active');
          playAlarmSound();
        } else {
          lockdownBtn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> EMERGENCY LOCKDOWN';
          lockdownBtn.classList.remove('active-lockdown');
          lockdownOverlay.classList.remove('active');
        }
        fetchDashboardStats();
      } catch (err) {
        console.error("Erro ao alternar lockdown:", err);
      }
    });
  }

  function playAlarmSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
      console.log("Audio not supported / allowed");
    }
  }

  // --- Live Stats & Event Polling ---
  async function fetchDashboardStats() {
    try {
      const resp = await fetch('/api/stats');
      const data = await resp.json();

      // Topbar
      document.getElementById('statFps').innerText = data.fps_avg.toFixed(1);
      document.getElementById('statGpu').innerText = `${data.edge_gpu_usage}%`;
      document.getElementById('statStreams').innerText = `${data.active_streams} / ${data.total_streams}`;

      // Status View & Integrity
      if (document.getElementById('statusProcessingLoad')) {
        document.getElementById('statusProcessingLoad').innerText = `${data.processing_load}%`;
      }
      if (document.getElementById('statusAnomalies')) {
        document.getElementById('statusAnomalies').innerText = data.active_anomalies;
      }
      if (document.getElementById('statusLatency')) {
        document.getElementById('statusLatency').innerText = `${data.frame_latency}ms`;
      }
      if (document.getElementById('statusUptime')) {
        document.getElementById('statusUptime').innerText = `${data.uptime}%`;
      }
      if (document.getElementById('kpiTotalPersons')) {
        document.getElementById('kpiTotalPersons').innerText = data.total_subjects;
      }
      if (document.getElementById('kpiActiveEvents')) {
        document.getElementById('kpiActiveEvents').innerText = data.total_recognitions;
      }
    } catch (err) {
      console.error("Erro ao buscar stats:", err);
    }
  }

  async function fetchLiveEvents() {
    try {
      const resp = await fetch('/api/events');
      const events = await resp.json();
      const logList = document.getElementById('liveLogList');
      if (!logList) return;

      logList.innerHTML = '';
      events.forEach(evt => {
        const card = document.createElement('div');
        let cardClass = 'event-match';
        let icon = '<i class="fa-solid fa-check"></i>';

        if (evt.tipo_evento === 'UNAUTHORIZED_PRESENCE' || evt.alert) {
          cardClass = 'event-unauthorized';
          icon = '<i class="fa-solid fa-triangle-exclamation"></i>';
        } else if (evt.tipo_evento === 'ROUTINE_SCAN' || evt.tipo_evento === 'MODEL_UPDATED') {
          cardClass = 'event-routine';
          icon = '<i class="fa-solid fa-arrows-rotate"></i>';
        }

        card.className = `log-card ${cardClass}`;
        card.innerHTML = `
          <div class="log-card-header">
            <span>${evt.detected_at.split(' ')[1] || evt.detected_at}</span>
            <span class="log-camera-tag">${evt.camera_code}</span>
          </div>
          <div class="log-title">
            ${icon} ${evt.tipo_evento.replace('_', ' ')}
          </div>
          <div class="log-desc">
            ${evt.note || `${evt.pessoa_nome} (${evt.departamento}) - Conf: ${Math.round(evt.confianca * 100)}%`}
          </div>
        `;
        logList.appendChild(card);
      });
    } catch (err) {
      console.error("Erro ao buscar eventos:", err);
    }
  }

  // --- Enrollment & Camera Module ---
  let enrollStream = null;
  const enrollVideo = document.getElementById('enrollVideo');
  const enrollCanvas = document.getElementById('enrollCanvas');
  const btnCapturePhoto = document.getElementById('btnCapturePhoto');
  const photoUploadInput = document.getElementById('photoUploadInput');
  const btnTriggerUpload = document.getElementById('btnTriggerUpload');
  const generatedHashBox = document.getElementById('generatedHashBox');
  const hashDisplay = document.getElementById('hashDisplay');
  const enrollForm = document.getElementById('enrollSubjectForm');
  const consentCheckbox = document.getElementById('consentCheckbox');
  const btnSubmitEnroll = document.getElementById('btnSubmitEnroll');
  const inputCpf = document.getElementById('inputCpf');

  let capturedImageBase64 = null;

  async function initEnrollmentCamera() {
    if (!enrollVideo) return;
    try {
      enrollStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      enrollVideo.srcObject = enrollStream;
      startLandmarkSimulation();
    } catch (e) {
      console.log("Webcam não disponível para enrollment, usando simulador de NPU.");
      startLandmarkSimulation(true);
    }
  }

  function stopEnrollmentCamera() {
    if (enrollStream) {
      enrollStream.getTracks().forEach(t => t.stop());
      enrollStream = null;
    }
  }

  let landmarkInterval = null;
  function startLandmarkSimulation(fallbackMode = false) {
    if (landmarkInterval) clearInterval(landmarkInterval);
    const ctx = enrollCanvas.getContext('2d');
    enrollCanvas.width = 640;
    enrollCanvas.height = 480;

    landmarkInterval = setInterval(() => {
      ctx.clearRect(0, 0, 640, 480);

      if (fallbackMode && !capturedImageBase64) {
        // Desenha silhueta placeholder
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

      // Desenha malha facial inteligente / retículos
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

      // Pontos faciais
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

      // Bounding box brackets
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 3;
      const bx = cx - 110, by = cy - 130, bw = 220, bh = 260, len = 20;

      // Top Left
      ctx.beginPath(); ctx.moveTo(bx, by + len); ctx.lineTo(bx, by); ctx.lineTo(bx + len, by); ctx.stroke();
      // Top Right
      ctx.beginPath(); ctx.moveTo(bx + bw - len, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw, by + len); ctx.stroke();
      // Bottom Left
      ctx.beginPath(); ctx.moveTo(bx, by + bh - len); ctx.lineTo(bx, by + bh); ctx.lineTo(bx + len, by + bh); ctx.stroke();
      // Bottom Right
      ctx.beginPath(); ctx.moveTo(bx + bw - len, by + bh); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx + bw, by + bh - len); ctx.stroke();

    }, 50);
  }

  // Capturar frame da câmera
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

  // Upload de arquivo alternativo
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
    if (hashDisplay) hashDisplay.innerText = `HASH: ${pseudoHash}`;
    if (generatedHashBox) generatedHashBox.style.display = 'flex';
  }

  // Máscara automática de CPF
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

  // Controle de validação de consentimento
  if (consentCheckbox && btnSubmitEnroll) {
    consentCheckbox.addEventListener('change', () => {
      btnSubmitEnroll.disabled = !consentCheckbox.checked;
    });
  }

  // Submissão do cadastro
  if (enrollForm) {
    enrollForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nome = document.getElementById('inputName').value.trim();
      const cpf = document.getElementById('inputCpf').value.trim();
      const dept = document.getElementById('selectDept').value;
      const clearance = document.getElementById('selectClearance').value;
      const idade = parseInt(document.getElementById('inputIdade').value) || 28;

      if (!nome || !cpf) {
        alert("Preencha o nome completo e o CPF.");
        return;
      }

      btnSubmitEnroll.disabled = true;
      btnSubmitEnroll.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing NPU Embedding...';

      try {
        const payload = {
          nome: nome,
          cpf: cpf,
          idade: idade,
          departamento: dept,
          clearance_level: clearance,
          foto_base64: capturedImageBase64
        };

        const resp = await fetch('/api/enroll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const resData = await resp.json();
        if (resp.ok) {
          alert(`Identidade cadastrada com sucesso!\nID: ${resData.pessoa_id}\nVetor 128D criptografado e persistido.`);
          enrollForm.reset();
          capturedImageBase64 = null;
          if (generatedHashBox) generatedHashBox.style.display = 'none';
          if (consentCheckbox) consentCheckbox.checked = false;
          loadEnrolledSubjects();
          fetchDashboardStats();
        } else {
          alert(`Erro no cadastro: ${resData.error || 'Falha ao processar'}`);
        }
      } catch (err) {
        alert("Erro de conexão ao servidor.");
      } finally {
        btnSubmitEnroll.disabled = !consentCheckbox.checked;
        btnSubmitEnroll.innerHTML = '<i class="fa-solid fa-lock"></i> Enroll Identity';
      }
    });
  }

  // Carregar lista de entidades cadastradas
  async function loadEnrolledSubjects() {
    const listEl = document.getElementById('enrolledSubjectsList');
    if (!listEl) return;

    try {
      const resp = await fetch('/api/persons');
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
        row.innerHTML = `
          <div style="display: flex; align-items: center; gap: 10px;">
            <div class="user-avatar">${p.nome.substring(0, 2).toUpperCase()}</div>
            <div>
              <div class="user-name">${p.nome}</div>
              <div class="user-role">${p.departamento} • ${p.clearance_level} • CPF: ${p.cpf_mascarado}</div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="badge-secure" style="font-size: 0.7rem;">${p.status.toUpperCase()}</span>
            <button class="action-icon-btn btn-delete-person" data-id="${p.id}" title="Remover"><i class="fa-solid fa-trash"></i></button>
          </div>
        `;
        listEl.appendChild(row);
      });

      document.querySelectorAll('.btn-delete-person').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = btn.getAttribute('data-id');
          if (confirm("Deseja realmente remover esta identidade biométrica do sistema?")) {
            await fetch(`/api/persons/${id}`, { method: 'DELETE' });
            loadEnrolledSubjects();
            fetchDashboardStats();
          }
        });
      });
    } catch (e) {
      console.error(e);
    }
  }

  // Carregar logs na aba de Logs
  async function loadDetailedLogs() {
    const tbody = document.getElementById('auditLogsTableBody');
    if (!tbody) return;

    try {
      const resp = await fetch('/api/logs');
      const logs = await resp.json();
      tbody.innerHTML = '';

      logs.forEach(l => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="font-family: 'JetBrains Mono', monospace; font-size: 0.78rem;">${l.created_at}</td>
          <td><strong>${l.user_id}</strong></td>
          <td><span class="badge-aes">${l.acao}</span></td>
          <td>${l.entidade}</td>
          <td style="color: var(--text-secondary); font-size: 0.8rem;">${l.detalhes || '-'}</td>
        `;
        tbody.appendChild(tr);
      });
    } catch (e) {
      console.error(e);
    }
  }

  // Inicialização e ciclos de polling
  fetchDashboardStats();
  fetchLiveEvents();

  setInterval(fetchDashboardStats, 3000);
  setInterval(fetchLiveEvents, 2500);
});
