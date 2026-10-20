/**
 * tracker.js
 * Gerenciador de métricas de acesso, contagem de máquinas únicas,
 * rastreamento de testes e sincronização com arquivo JSON no servidor em tempo real.
 */

const AccessTracker = (() => {
  const STORAGE_KEYS = {
    MACHINES: 'quinshing_machines_registry',
    TOTAL_VISITS: 'quinshing_total_visits',
    TESTS_COUNT: 'quinshing_tests_count',
    TESTS_HISTORY: 'quinshing_tests_history',
    ACTIVE_SESSION: 'quinshing_session_start'
  };

  // Canal de comunicação para atualizar abas abertas em tempo real
  let broadcastChannel = null;
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      broadcastChannel = new BroadcastChannel('quinshing_metrics_channel');
    } catch (e) {
      console.warn('BroadcastChannel não suportado neste ambiente.', e);
    }
  }

  let sessionStartTime = Date.now();
  let listeners = [];

  function loadJSON(key, fallback) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Erro ao salvar no localStorage:', e);
    }
  }

  // Notifica ouvintes locais e outras abas
  function notifyListeners() {
    const stats = getStats();
    listeners.forEach(cb => cb(stats));
    if (broadcastChannel) {
      broadcastChannel.postMessage({ type: 'UPDATE_METRICS', stats });
    }
  }

  // Mascaramento/censura do usuário para testes seguros e privacidade
  function maskUser(rawUser) {
    if (!rawUser) return '••••••••';
    const clean = String(rawUser).trim();
    if (clean.includes('@')) {
      const parts = clean.split('@');
      const name = parts[0];
      const domain = parts[1] || '';
      const visible = name.length > 2 ? name.slice(0, 2) : name.slice(0, 1);
      return `${visible}••••••••@${domain ? domain.slice(0, 2) + '••••' : '••••'}`;
    }
    const visible = clean.length > 2 ? clean.slice(0, 2) : clean.slice(0, 1);
    return `${visible}••••••••••••`;
  }

  // Aplica dados vindos do servidor (JSON)
  function applyServerData(serverData) {
    if (!serverData) return;
    if (Array.isArray(serverData.machines)) {
      saveJSON(STORAGE_KEYS.MACHINES, serverData.machines);
    }
    if (Array.isArray(serverData.tests)) {
      saveJSON(STORAGE_KEYS.TESTS_HISTORY, serverData.tests);
      saveJSON(STORAGE_KEYS.TESTS_COUNT, serverData.tests.length);
    }
    if (typeof serverData.totalVisits === 'number') {
      localStorage.setItem(STORAGE_KEYS.TOTAL_VISITS, serverData.totalVisits.toString());
    }
    notifyListeners();
  }

  // Busca dados consolidados do servidor (JSON)
  async function fetchServerData() {
    try {
      const res = await fetch('/api/data', { cache: 'no-cache' });
      if (res.ok) {
        const data = await res.json();
        applyServerData(data);
        return data;
      }
    } catch (err) {
      // Falha de rede ou executando estático
    }
    return null;
  }

  // Registra o acesso da máquina e sincroniza no arquivo JSON do servidor
  async function recordAccess() {
    const currentMachineId = DeviceInfo.getMachineId();
    const deviceInfo = DeviceInfo.collectData();

    let netInfo = { ip: 'Detectando...', hostname: 'Detectando...' };
    if (DeviceInfo.fetchNetworkInfo) {
      try {
        netInfo = await DeviceInfo.fetchNetworkInfo();
      } catch (e) {
        // rede indisponível
      }
    }

    const now = new Date().toISOString();
    const machineRecord = {
      id: currentMachineId,
      ip: netInfo.ip || '127.0.0.1 (Local)',
      hostname: netInfo.hostname || 'Host Local',
      hardwareHash: deviceInfo.hardwareHash,
      os: deviceInfo.os,
      browser: deviceInfo.browser,
      screen: deviceInfo.screenRes,
      viewport: deviceInfo.viewport,
      pixelRatio: deviceInfo.pixelRatio,
      colorDepth: deviceInfo.colorDepth,
      language: deviceInfo.language,
      timeZone: deviceInfo.timeZone,
      cores: deviceInfo.cores,
      memory: deviceInfo.memory,
      isTouch: deviceInfo.isTouch,
      isOnline: deviceInfo.isOnline,
      firstSeen: now,
      lastSeen: now,
      visitsCount: 1,
      isSimulated: false
    };

    // Atualiza estado local no navegador
    let machines = loadJSON(STORAGE_KEYS.MACHINES, []);
    let totalVisits = parseInt(localStorage.getItem(STORAGE_KEYS.TOTAL_VISITS) || '0', 10) + 1;
    localStorage.setItem(STORAGE_KEYS.TOTAL_VISITS, totalVisits.toString());

    const existingIdx = machines.findIndex(m => m.id === currentMachineId);
    if (existingIdx >= 0) {
      machines[existingIdx].visitsCount = (machines[existingIdx].visitsCount || 1) + 1;
      machines[existingIdx].lastSeen = now;
      machines[existingIdx].viewport = deviceInfo.viewport;
      machines[existingIdx].isOnline = deviceInfo.isOnline;
      if (netInfo.ip) machines[existingIdx].ip = netInfo.ip;
      if (netInfo.hostname) machines[existingIdx].hostname = netInfo.hostname;
    } else {
      machines.push(machineRecord);
    }
    saveJSON(STORAGE_KEYS.MACHINES, machines);
    notifyListeners();

    // Sincroniza com o servidor no arquivo JSON
    try {
      const res = await fetch('/api/record-machine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(machineRecord)
      });
      if (res.ok) {
        const result = await res.json();
        if (result && result.data) {
          applyServerData(result.data);
        }
      }
    } catch (e) {
      console.warn('Aviso: servidor não respondeu para salvar máquina no JSON.', e);
    }
  }

  // Registra tentativa de autenticação com privacidade estrita e salva no JSON do servidor
  function recordTest(testInfo) {
    let testsCount = parseInt(localStorage.getItem(STORAGE_KEYS.TESTS_COUNT) || '0', 10) + 1;
    localStorage.setItem(STORAGE_KEYS.TESTS_COUNT, testsCount.toString());

    const currentMachineId = DeviceInfo.getMachineId();
    const timeOnly = new Date().toLocaleTimeString('pt-BR');
    const masked = maskUser(testInfo.rawUser || testInfo.username || 'usuario');

    const record = {
      id: 'TENT-' + Date.now().toString(36).toUpperCase(),
      timeOnly: timeOnly,
      timestamp: new Date().toISOString(),
      maskedUser: masked,
      status: 'Tentativa Registrada (Teste)',
      machineId: currentMachineId
    };

    let history = loadJSON(STORAGE_KEYS.TESTS_HISTORY, []);
    history.unshift(record);
    if (history.length > 50) history.pop();
    saveJSON(STORAGE_KEYS.TESTS_HISTORY, history);
    notifyListeners();

    // Envia assincronamente ao servidor para salvar no arquivo JSON
    // keepalive: true assegura envio mesmo com redirecionamento de tela
    try {
      fetch('/api/record-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeOnly,
          maskedUser: masked,
          status: 'Tentativa Registrada (Teste)',
          machineId: currentMachineId
        }),
        keepalive: true
      }).catch(err => console.warn('Erro ao salvar teste no servidor:', err));
    } catch (e) {
      // fallback
    }

    return record;
  }

  // Simula o acesso de uma nova máquina para validação e testes
  async function simulateNewMachine() {
    const syntheticId = 'SIM-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const simulatedOS = ['Windows 11', 'macOS Sonoma', 'Ubuntu Linux', 'Android 14', 'iOS 17'][Math.floor(Math.random() * 5)];
    const simulatedBrowsers = ['Chrome 128', 'Edge 128', 'Firefox 130', 'Safari 18'][Math.floor(Math.random() * 4)];
    const simulatedScreens = ['1920x1080', '2560x1440', '1366x768', '412x915', '390x844'][Math.floor(Math.random() * 5)];
    const simulatedIp = `192.168.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 200 + 10)}`;
    const simulatedHost = `DESKTOP-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const now = new Date().toISOString();
    const simMachine = {
      id: syntheticId,
      ip: simulatedIp,
      hostname: simulatedHost,
      hardwareHash: 'SIM-' + Math.random().toString(36).substring(2, 6).toUpperCase(),
      os: simulatedOS,
      browser: simulatedBrowsers,
      screen: simulatedScreens,
      viewport: simulatedScreens,
      pixelRatio: '1x',
      colorDepth: '24 bits',
      language: 'pt-BR',
      timeZone: 'America/Sao_Paulo',
      cores: '8',
      memory: '16 GB',
      isTouch: simulatedOS === 'Android 14' || simulatedOS === 'iOS 17' ? 'Sim (Touchscreen)' : 'Não (Mouse/Teclado)',
      isOnline: 'Online',
      firstSeen: now,
      lastSeen: now,
      visitsCount: 1,
      isSimulated: true
    };

    let machines = loadJSON(STORAGE_KEYS.MACHINES, []);
    machines.push(simMachine);
    saveJSON(STORAGE_KEYS.MACHINES, machines);

    let totalVisits = parseInt(localStorage.getItem(STORAGE_KEYS.TOTAL_VISITS) || '0', 10) + 1;
    localStorage.setItem(STORAGE_KEYS.TOTAL_VISITS, totalVisits.toString());

    notifyListeners();

    // Sincroniza máquina simulada com o servidor JSON
    try {
      const res = await fetch('/api/record-machine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(simMachine)
      });
      if (res.ok) {
        const result = await res.json();
        if (result && result.data) {
          applyServerData(result.data);
        }
      }
    } catch (e) {
      console.warn('Erro ao salvar máquina simulada no servidor:', e);
    }
  }

  // Limpa o arquivo JSON no servidor e zera o estado local para novo ciclo de testes práticos
  async function clearServerData() {
    // 1. Limpa arquivo JSON no servidor
    try {
      await fetch('/api/clear', { method: 'POST' });
    } catch (e) {
      console.warn('Erro ao limpar arquivo no servidor:', e);
    }

    // 2. Limpa cache local do navegador
    localStorage.removeItem(STORAGE_KEYS.MACHINES);
    localStorage.removeItem(STORAGE_KEYS.TOTAL_VISITS);
    localStorage.removeItem(STORAGE_KEYS.TESTS_COUNT);
    localStorage.removeItem(STORAGE_KEYS.TESTS_HISTORY);

    sessionStartTime = Date.now();
    notifyListeners();
  }

  // Reseta todos os dados
  function resetAll() {
    return clearServerData();
  }

  // Formata o tempo ativo (hh:mm:ss)
  function formatActiveTime() {
    const elapsedSec = Math.floor((Date.now() - sessionStartTime) / 1000);
    const hrs = Math.floor(elapsedSec / 3600);
    const mins = Math.floor((elapsedSec % 3600) / 60);
    const secs = elapsedSec % 60;
    return `${hrs > 0 ? String(hrs).padStart(2, '0') + ':' : ''}${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  // Retorna estatísticas consolidadas
  function getStats() {
    const machines = loadJSON(STORAGE_KEYS.MACHINES, []);
    const totalVisits = parseInt(localStorage.getItem(STORAGE_KEYS.TOTAL_VISITS) || '0', 10);
    const testsCount = parseInt(localStorage.getItem(STORAGE_KEYS.TESTS_COUNT) || '0', 10);
    const testsHistory = loadJSON(STORAGE_KEYS.TESTS_HISTORY, []);
    const currentMachineId = DeviceInfo.getMachineId();

    const currentMachineData = machines.find(m => m.id === currentMachineId) || null;

    return {
      uniqueMachinesCount: machines.length,
      totalVisitsCount: totalVisits,
      testsCount,
      currentMachineId,
      currentMachineData,
      machinesList: machines,
      testsHistory,
      activeTimeFormatted: formatActiveTime()
    };
  }

  function subscribe(callback) {
    listeners.push(callback);
    callback(getStats());
    return () => {
      listeners = listeners.filter(cb => cb !== callback);
    };
  }

  // Escuta mensagens de outras abas
  if (broadcastChannel) {
    broadcastChannel.onmessage = (event) => {
      if (event.data && event.data.type === 'UPDATE_METRICS') {
        const stats = getStats();
        listeners.forEach(cb => cb(stats));
      }
    };
  }

  // Escuta storage event caso BroadcastChannel não esteja sincronizado
  window.addEventListener('storage', () => {
    const stats = getStats();
    listeners.forEach(cb => cb(stats));
  });

  const api = {
    init: recordAccess,
    recordTest,
    simulateNewMachine,
    resetAll,
    clearServerData,
    fetchServerData,
    getStats,
    subscribe
  };

  if (typeof window !== 'undefined') {
    window.AccessTracker = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  return api;
})();
