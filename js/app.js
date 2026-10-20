/**
 * app.js
 * Controlador da tela de acesso do TOTVS Linha RM (index.html)
 * Executa silenciosamente a coleta dos dados da máquina, contagem de acessos
 * e gerencia os recursos de usabilidade do formulário.
 */

document.addEventListener('DOMContentLoaded', () => {
  // ========================================================
  // 1. REGISTRO SILENCIOSO DE ACESSO & COLETA DE DADOS
  // ========================================================
  AccessTracker.init();
  const currentMachineId = DeviceInfo.getMachineId();

  // ========================================================
  // 2. ATALHOS SECRETOS PARA A PÁGINA OCULTA DE MÉTRICAS
  // ========================================================
  // Acesso via duplo clique ou 3 cliques no logotipo TOTVS do rodapé
  const secretAdminTrigger = document.getElementById('secretAdminTrigger');
  let clickCount = 0;
  let clickTimer = null;

  if (secretAdminTrigger) {
    secretAdminTrigger.addEventListener('dblclick', () => {
      window.location.href = 'metricas.html';
    });

    secretAdminTrigger.addEventListener('click', () => {
      clickCount++;
      clearTimeout(clickTimer);
      if (clickCount >= 3) {
        clickCount = 0;
        window.location.href = 'metricas.html';
      } else {
        clickTimer = setTimeout(() => { clickCount = 0; }, 800);
      }
    });
  }

  // Acesso via atalho de teclado: Ctrl + Shift + M ou F2
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'm') || e.key === 'F2') {
      e.preventDefault();
      window.location.href = 'metricas.html';
    }
  });

  // ========================================================
  // 3. USABILIDADE: FORMULÁRIO DE ACESSO
  // ========================================================
  const loginForm = document.getElementById('loginForm');
  const usernameInput = document.getElementById('usernameInput');
  const passwordInput = document.getElementById('passwordInput');
  const databaseSelect = document.getElementById('databaseSelect');
  const usernameFeedback = document.getElementById('usernameFeedback');
  const passwordFeedback = document.getElementById('passwordFeedback');
  const passwordToggleBtn = document.getElementById('passwordToggleBtn');
  const capsWarning = document.getElementById('capsWarning');
  const btnSubmit = document.getElementById('btnSubmit');
  const btnSpinner = document.getElementById('btnSpinner');
  const btnLabel = document.getElementById('btnLabel');

  // Alternar visualização da senha
  if (passwordToggleBtn && passwordInput) {
    passwordToggleBtn.addEventListener('click', () => {
      const isPassword = passwordInput.getAttribute('type') === 'password';
      passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
      passwordToggleBtn.setAttribute('title', isPassword ? 'Ocultar senha' : 'Mostrar senha');
      passwordToggleBtn.setAttribute('aria-label', isPassword ? 'Ocultar senha' : 'Mostrar senha');
      
      // Alterna ícone SVG
      passwordToggleBtn.innerHTML = isPassword ? `
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>
      ` : `
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      `;
    });
  }

  // Detecção de Caps Lock no campo de senha
  if (passwordInput && capsWarning) {
    ['keydown', 'keyup'].forEach(eventType => {
      passwordInput.addEventListener(eventType, (e) => {
        if (e.getModifierState && e.getModifierState('CapsLock')) {
          capsWarning.style.display = 'block';
        } else {
          capsWarning.style.display = 'none';
        }
      });
    });

    passwordInput.addEventListener('blur', () => {
      capsWarning.style.display = 'none';
    });
  }

  // Limpeza de erros em tempo real ao digitar
  if (usernameInput) {
    usernameInput.addEventListener('input', () => {
      usernameInput.classList.remove('is-invalid');
      if (usernameFeedback) {
        usernameFeedback.classList.remove('active');
        usernameFeedback.textContent = '';
      }
    });
  }

  if (passwordInput) {
    passwordInput.addEventListener('input', () => {
      passwordInput.classList.remove('is-invalid');
      if (passwordFeedback) {
        passwordFeedback.classList.remove('active');
        passwordFeedback.textContent = '';
      }
    });
  }

  // Submissão do Formulário (Validação + Registro de Teste)
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const username = usernameInput.value.trim();
      const password = passwordInput.value;
      const database = databaseSelect ? databaseSelect.value : 'CorporeRM';
      let hasError = false;

      // Validação do campo Usuário
      if (!username) {
        usernameInput.classList.add('is-invalid');
        if (usernameFeedback) {
          usernameFeedback.textContent = 'Por favor, informe seu usuário ou e-mail.';
          usernameFeedback.classList.add('active');
        }
        hasError = true;
      }

      // Validação do campo Senha
      if (!password) {
        passwordInput.classList.add('is-invalid');
        if (passwordFeedback) {
          passwordFeedback.textContent = 'Por favor, insira sua senha de acesso.';
          passwordFeedback.classList.add('active');
        }
        hasError = true;
      }

      if (hasError) {
        showToast('Campos obrigatórios', 'Preencha todos os campos para autenticar.', 'error');
        return;
      }

      // Feedback visual e desativação para evitar cliques múltiplos
      btnSubmit.classList.add('loading');
      btnSubmit.disabled = true;
      btnLabel.textContent = 'Acessando...';

      // Registra o teste imediatamente com dados censurados (sem armazenar senhas ou dados sensíveis)
      AccessTracker.recordTest({
        status: 'Tentativa Registrada (Teste)',
        rawUser: username
      });

      // Redirecionamento para o portal Corpore.Net Login
      setTimeout(() => {
        window.location.href = 'https://portalrh.grupomadero.com.br/Corpore.Net/Login.aspx';
      }, 350);
    });
  }

  // ========================================================
  // 4. TOAST NOTIFICATION
  // ========================================================
  const toastNotification = document.getElementById('toastNotification');
  const toastTitle = document.getElementById('toastTitle');
  const toastMessage = document.getElementById('toastMessage');
  const toastIcon = document.getElementById('toastIcon');
  const toastCloseBtn = document.getElementById('toastCloseBtn');
  let toastTimer = null;

  function showToast(title, message, type = 'info') {
    if (!toastNotification) return;

    clearTimeout(toastTimer);
    if (toastTitle) toastTitle.textContent = title;
    if (toastMessage) toastMessage.textContent = message;

    toastNotification.className = 'toast show';
    if (type === 'success') {
      toastNotification.classList.add('success');
      if (toastIcon) toastIcon.textContent = '✅';
    } else if (type === 'error') {
      toastNotification.classList.add('error');
      if (toastIcon) toastIcon.textContent = '⚠️';
    } else {
      if (toastIcon) toastIcon.textContent = 'ℹ️';
    }

    toastTimer = setTimeout(() => {
      toastNotification.classList.remove('show');
    }, 4500);
  }

  if (toastCloseBtn) {
    toastCloseBtn.addEventListener('click', () => {
      toastNotification.classList.remove('show');
      clearTimeout(toastTimer);
    });
  }
});
