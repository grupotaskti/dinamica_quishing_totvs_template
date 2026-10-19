/**
 * fingerprint.js
 * Módulo para captura de dados do dispositivo do usuário e geração
 * de identificador único (fingerprint) de máquina.
 */

const DeviceInfo = (() => {
  // Gera um hash simples e determinístico a partir de uma string
  function hashCode(str) {
    let hash = 0;
    if (str.length === 0) return '00000000';
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Converte para inteiro de 32 bits
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  // Gera uma assinatura gráfica através do Canvas HTML5
  function getCanvasFingerprint() {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 50;
      const ctx = canvas.getContext('2d');
      if (!ctx) return 'no-canvas';

      ctx.textBaseline = 'top';
      ctx.font = "14px 'Arial', sans-serif";
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#0C9ABE';
      ctx.fillRect(125, 1, 62, 20);

      ctx.fillStyle = '#069';
      ctx.fillText('TOTVS Linha RM Usabilidade', 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.fillText('TOTVS Linha RM Usabilidade', 4, 17);

      return hashCode(canvas.toDataURL());
    } catch (e) {
      return 'canvas-blocked';
    }
  }

  // Identifica o Sistema Operacional
  function detectOS() {
    const userAgent = window.navigator.userAgent || '';
    const platform = window.navigator.platform || '';
    const macosPlatforms = ['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K'];
    const windowsPlatforms = ['Win32', 'Win64', 'Windows', 'WinCE'];
    const iosPlatforms = ['iPhone', 'iPad', 'iPod'];

    if (macosPlatforms.indexOf(platform) !== -1) return 'macOS';
    if (iosPlatforms.indexOf(platform) !== -1) return 'iOS';
    if (windowsPlatforms.indexOf(platform) !== -1) {
      if (userAgent.includes('Windows NT 10.0')) return 'Windows 10/11';
      if (userAgent.includes('Windows NT 6.3')) return 'Windows 8.1';
      if (userAgent.includes('Windows NT 6.1')) return 'Windows 7';
      return 'Windows';
    }
    if (/Android/.test(userAgent)) return 'Android';
    if (/Linux/.test(platform) || /Linux/.test(userAgent)) return 'Linux';

    return 'Desconhecido';
  }

  // Identifica o Navegador
  function detectBrowser() {
    const ua = navigator.userAgent;
    let browser = 'Desconhecido';
    let version = '';

    if (ua.indexOf('Edg/') > -1) {
      browser = 'Microsoft Edge';
      version = ua.substring(ua.indexOf('Edg/') + 4).split(' ')[0];
    } else if (ua.indexOf('Chrome/') > -1) {
      browser = 'Google Chrome';
      version = ua.substring(ua.indexOf('Chrome/') + 7).split(' ')[0];
    } else if (ua.indexOf('Firefox/') > -1) {
      browser = 'Mozilla Firefox';
      version = ua.substring(ua.indexOf('Firefox/') + 8).split(' ')[0];
    } else if (ua.indexOf('Safari/') > -1 && ua.indexOf('Chrome/') === -1) {
      browser = 'Apple Safari';
      version = ua.substring(ua.indexOf('Version/') + 8).split(' ')[0];
    } else if (ua.indexOf('OPR/') > -1 || ua.indexOf('Opera/') > -1) {
      browser = 'Opera';
      version = ua.substring(ua.indexOf('OPR/') + 4).split(' ')[0];
    }

    return { name: browser, version: version ? version.split('.')[0] : '' };
  }

  // Coleta dados completos da máquina e do ambiente do usuário
  function collectData() {
    const os = detectOS();
    const browser = detectBrowser();
    const screenRes = `${window.screen.width}x${window.screen.height}`;
    const colorDepth = window.screen.colorDepth || 24;
    const pixelRatio = window.devicePixelRatio || 1;
    const language = navigator.language || navigator.userLanguage || 'pt-BR';
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const timeZoneOffset = new Date().getTimezoneOffset();
    const cores = navigator.hardwareConcurrency || 'N/D';
    const memory = navigator.deviceMemory ? `${navigator.deviceMemory} GB` : 'N/D';
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const canvasHash = getCanvasFingerprint();

    // Composição determinística dos atributos de hardware e ambiente
    const rawFingerprint = [
      os,
      browser.name,
      screenRes,
      colorDepth,
      pixelRatio,
      language,
      timeZone,
      timeZoneOffset,
      cores,
      canvasHash
    ].join('###');

    const hardwareHash = 'M' + hashCode(rawFingerprint).toUpperCase();

    return {
      os,
      browser: `${browser.name} ${browser.version}`.trim(),
      screenRes,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      pixelRatio: `${pixelRatio}x`,
      colorDepth: `${colorDepth} bits`,
      language,
      timeZone,
      cores: cores.toString(),
      memory,
      isTouch: isTouch ? 'Sim (Touchscreen)' : 'Não (Mouse/Teclado)',
      isOnline: navigator.onLine ? 'Online' : 'Offline',
      hardwareHash,
      canvasHash
    };
  }

  // Obtém ou inicializa o ID único da máquina de forma persistente
  function getMachineId(overrideId = null) {
    if (overrideId) {
      return overrideId;
    }

    const STORAGE_KEY = 'quinshing_machine_id';
    let machineId = localStorage.getItem(STORAGE_KEY);

    if (!machineId) {
      // Se ainda não existir no localStorage, cria combinando o hash de hardware com um sufixo curto
      const data = collectData();
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      machineId = `${data.hardwareHash}-${randomSuffix}`;
      localStorage.setItem(STORAGE_KEY, machineId);
    }

    return machineId;
  }

  // Captura assíncrona de IP e Hostname através do servidor ou fallback
  async function fetchNetworkInfo() {
    try {
      const response = await fetch('/api/client-info');
      if (response.ok) {
        const data = await response.json();
        return {
          ip: data.ip || '127.0.0.1',
          hostname: data.hostname || 'Host Local'
        };
      }
    } catch (e) {
      // Falha ao conectar ao servidor local
    }

    // Fallback para api pública caso executando fora do server.js
    try {
      const pubRes = await fetch('https://api.ipify.org?format=json');
      if (pubRes.ok) {
        const pubData = await pubRes.json();
        return {
          ip: pubData.ip,
          hostname: 'IP Público WAN'
        };
      }
    } catch (e) {
      // Offline
    }

    return {
      ip: '127.0.0.1 (Local)',
      hostname: 'Host Local'
    };
  }

  const api = {
    collectData,
    getMachineId,
    fetchNetworkInfo
  };

  if (typeof window !== 'undefined') {
    window.DeviceInfo = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  return api;
})();

