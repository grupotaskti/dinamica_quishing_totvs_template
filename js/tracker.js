/**
 * tracker.js
 * Gerenciador de métricas de acesso, contagem de máquinas únicas,
 * rastreamento de testes e sincronização em tempo real entre abas.
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

  // Registra o acesso ao carregar a página
  function recordAccess() {
    const currentMachineId = DeviceInfo.getMachineId();
    const deviceInfo = DeviceInfo.collectData();

    let machines = loadJSON(STORAGE_KEYS.MACHINES, []);
    let totalVisits = parseInt(localStorage.getItem(STORAGE_KEYS.TOTAL_VISITS) || '0', 10) + 1;
    localStorage.setItem(STORAGE_KEYS.TOTAL_VISITS, totalVisits.toString());

    const now = new Date().toISOString();
    const existingIndex = machines.findIndex(m => m.id === currentMachineId);

    if (existingIndex >= 0) {
      // Máquina já conhecida: apenas incrementa os acessos dela, sem aumentar o total de máquinas únicas
      machines[existingIndex].visitsCount = (machines[existingIndex].visitsCount || 1) + 1;
      machines[existingIndex].lastSeen = now;
      machines[existingIndex].viewport = deviceInfo.viewport;
      machines[existingIndex].isOnline = deviceInfo.isOnline;
      if (!machines[existingIndex].ip) machines[existingIndex].ip = 'Detectando...';
      if (!machines[existingIndex].hostname) machines[existingIndex].hostname = 'Detectando...';
    } else {
      // Nova máquina única detectada
      machines.push({
        id: currentMachineId,
        ip: 'Detectando...',
        hostname: 'Detectando...',
        hardwareHash: deviceInfo.hardwareHash,
        os: deviceInfo.os,
        browser: deviceInfo.browser,
        screen: deviceInfo.screenRes,
        viewport: deviceInfo.viewport,
        language: deviceInfo.language,
        timeZone: deviceInfo.timeZone,
        isTouch: deviceInfo.isTouch,
        firstSeen: now,
        lastSeen: now,
        visitsCount: 1,
        isSimulated: false
      });
    }

    saveJSON(STORAGE_KEYS.MACHINES, machines);
    notifyListeners();

    // Captura assíncrona do IP e Hostname reais da máquina
    if (DeviceInfo.fetchNetworkInfo) {
      DeviceInfo.fetchNetworkInfo().then(net => {
        let currentMachines = loadJSON(STORAGE_KEYS.MACHINES, []);
        const idx = currentMachines.findIndex(m => m.id === currentMachineId);
        if (idx >= 0) {
          currentMachines[idx].ip = net.ip || '127.0.0.1';
          currentMachines[idx].hostname = net.hostname || 'Host Local';
          saveJSON(STORAGE_KEYS.MACHINES, currentMachines);
          notifyListeners();
        }
      }).catch(err => console.warn('Erro ao obter IP/Hostname:', err));
    }
  }

  // Registra a tentativa de autenticação com privacidade estrita (apenas horário e usuário censurado)
  function recordTest(testInfo) {
    let testsCount = parseInt(localStorage.getItem(STORAGE_KEYS.TESTS_COUNT) || '0', 10) + 1;
    localStorage.setItem(STORAGE_KEYS.TESTS_COUNT, testsCount.toString());

    let history = loadJSON(STORAGE_KEYS.TESTS_HISTORY, []);
    const record = {
      id: 'TENT-' + Date.now().toString(36).toUpperCase(),
      timeOnly: new Date().toLocaleTimeString('pt-BR'), // Apenas horário da tentativa conforme solicitado
      maskedUser: maskUser(testInfo.rawUser || testInfo.username || 'usuario'), // Usuário nublado / censurado
      status: 'Tentativa Registrada (Teste)'
    };

    history.unshift(record);
    if (history.length > 50) history.pop(); // Limita histórico
    saveJSON(STORAGE_KEYS.TESTS_HISTORY, history);

    notifyListeners();
    return record;
  }

  // Simula o acesso de uma nova máquina para validação e testes
  function simulateNewMachine() {
    const syntheticId = 'SIM-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const simulatedOS = ['Windows 11', 'macOS Sonoma', 'Ubuntu Linux', 'Android 14', 'iOS 17'][Math.floor(Math.random() * 5)];
    const simulatedBrowsers = ['Chrome 128', 'Edge 128', 'Firefox 130', 'Safari 18'][Math.floor(Math.random() * 4)];
    const simulatedScreens = ['1920x1080', '2560x1440', '1366x768', '412x915', '390x844'][Math.floor(Math.random() * 5)];
    const simulatedIp = `192.168.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 200 + 10)}`;
    const simulatedHost = `DESKTOP-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    let machines = loadJSON(STORAGE_KEYS.MACHINES, []);
    const now = new Date().toISOString();

    machines.push({
      id: syntheticId,
      ip: simulatedIp,
      hostname: simulatedHost,
      hardwareHash: 'SIM-' + Math.random().toString(36).substring(2, 6).toUpperCase(),
      os: simulatedOS,
      browser: simulatedBrowsers,
      screen: simulatedScreens,
      viewport: simulatedScreens,
      language: 'pt-BR',
      timeZone: 'America/Sao_Paulo',
      isTouch: simulatedOS === 'Android 14' || simulatedOS === 'iOS 17' ? 'Sim' : 'Não',
      firstSeen: now,
      lastSeen: now,
      visitsCount: 1,
      isSimulated: true
    });

    let totalVisits = parseInt(localStorage.getItem(STORAGE_KEYS.TOTAL_VISITS) || '0', 10) + 1;
    localStorage.setItem(STORAGE_KEYS.TOTAL_VISITS, totalVisits.toString());

    saveJSON(STORAGE_KEYS.MACHINES, machines);
    notifyListeners();
  }

  // Reseta todos os dados para novo ciclo de testes
  function resetAll() {
    localStorage.removeItem(STORAGE_KEYS.MACHINES);
    localStorage.removeItem(STORAGE_KEYS.TOTAL_VISITS);
    localStorage.removeItem(STORAGE_KEYS.TESTS_COUNT);
    localStorage.removeItem(STORAGE_KEYS.TESTS_HISTORY);
    localStorage.removeItem('quinshing_machine_id');

    sessionStartTime = Date.now();
    recordAccess();
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
