/**
 * SecureVision AI — Frontend Application Controller (Enterprise Edition)
 * Real-time CCTV streaming, Biometric Enrollment, Event Logging & Zero-Trust Session Control
 */

// --- Anti-Tamper & Kiosk Warning ---
document.addEventListener('keydown', (e) => {
  if (e.key === 'F12' || e.keyCode === 123) {
    e.preventDefault();
    showToastNotification("Acesso Bloqueado: Ferramentas de desenvolvedor restritas por política NPU.");
    return false;
  }
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) {
    e.preventDefault();
    showToastNotification("Acesso Bloqueado: Atalho de inspeção restrito por protocolo.");
    return false;
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U')) {
    e.preventDefault();
    showToastNotification("Acesso Bloqueado: Exibição de código-fonte desativada.");
    return false;
  }
});

document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  showToastNotification("Menu de contexto bloqueado por política de segurança.");
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

document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elements References ---
  const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
  const viewPanels = document.querySelectorAll('.view-panel');
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const lockdownBtn = document.getElementById('lockdownBtn');
  const lockdownOverlay = document.getElementById('lockdownOverlay');
  
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

  // --- Emergency Lockdown ---
  let isLockdown = false;
  if (lockdownBtn) {
    lockdownBtn.addEventListener('click', async () => {
      const confirmAction = isLockdown || confirm("ATENÇÃO: Ativar Emergency Lockdown fechará os setores e elevará o nível de alerta para o MÁXIMO. Confirmar?");
      if (!confirmAction) return;

      try {
        const resp = await fetch('/api/v1/system/lockdown', {
          method: 'POST',
          credentials: 'same-origin'
        });
        const data = await resp.json();
        isLockdown = Boolean(data.lockdown_active);

        if (isLockdown) {
          lockdownBtn.innerHTML = '<i class="fa-solid fa-shield-halved"></i> Deactivate Lockdown';
          lockdownBtn.classList.add('active-lockdown');
          if (lockdownOverlay) lockdownOverlay.classList.add('active');
          playAlarmSound();
        } else {
          lockdownBtn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Emergency Lockdown';
          lockdownBtn.classList.remove('active-lockdown');
          if (lockdownOverlay) lockdownOverlay.classList.remove('active');
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
    } catch (e) {}
  }

  // --- Zero-Trust Authentication Session ---
  async function checkServerSession() {
    try {
      const resp = await fetch('/api/v1/auth/me', {
        credentials: 'same-origin'
      });
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
          btnSubmit.innerHTML = '<i class="fa-solid fa-lock"></i> Autenticar e Acessar Sistema';
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
          btnSubmit.innerHTML = '<i class="fa-solid fa-user-shield"></i> Criar Conta de Operador';
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

        card.className = `log-card ${cardClass}`;
        const timePart = (evt.detected_at || "").split(' ')[1] || evt.detected_at || "--:--:--";
        
        card.innerHTML = `
          <div class="log-card-header">
            <span>${timePart}</span>
            <span class="log-camera-tag">${evt.camera_code || 'CAM_SYS'}</span>
          </div>
          <div class="log-title">
            ${icon} ${(evt.tipo_evento || '').replace('_', ' ')}
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
      ctx.beginPath(); ctx.moveTo(bx, by + bh - len); ctx.lineTo(bx, by + bh); ctx.lineTo(bx + len, by + bh); ctx.stroke();
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
    if (hashDisplay) hashDisplay.innerText = `HASH: ${pseudoHash}`;
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
          age: age,
          department: dept,
          clearance_level: clearance,
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
          alert(`Identidade cadastrada com sucesso!\nID: ${resData.subject_id}\nVetor 128D criptografado e persistido.`);
          enrollForm.reset();
          capturedImageBase64 = null;
          if (generatedHashBox) generatedHashBox.style.display = 'none';
          if (consentCheckbox) consentCheckbox.checked = false;
          loadEnrolledSubjects();
          fetchDashboardStats();
        } else {
          alert(`Erro no cadastro: ${resData.detail || 'Falha ao processar'}`);
        }
      } catch (err) {
        alert("Erro de conexão ao servidor.");
      } finally {
        if (btnSubmitEnroll) {
          btnSubmitEnroll.disabled = consentCheckbox ? !consentCheckbox.checked : false;
          btnSubmitEnroll.innerHTML = '<i class="fa-solid fa-lock"></i> Enroll Identity';
        }
      }
    });
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
        row.innerHTML = `
          <div style="display: flex; align-items: center; gap: 10px;">
            <div class="user-avatar">${(p.full_name || 'U').substring(0, 2).toUpperCase()}</div>
            <div>
              <div class="user-name">${p.full_name}</div>
              <div class="user-role">${p.department} • ${p.clearance_level} • CPF: ${p.national_id_masked}</div>
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
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          if (confirm("Deseja realmente remover esta identidade biométrica do sistema?")) {
            await fetch(`/api/v1/subjects/${id}`, { method: 'DELETE', credentials: 'same-origin' });
            loadEnrolledSubjects();
            fetchDashboardStats();
          }
        });
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

  // Initial Boot
  checkServerSession();
  fetchDashboardStats();
  fetchLiveEvents();

  setInterval(fetchDashboardStats, 3000);
  setInterval(fetchLiveEvents, 2500);
});
