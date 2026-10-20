/**
 * server.js
 * Servidor local em Node.js (sem dependências externas)
 * Provê endpoints de identificação de IP/Hostname, persistência em arquivo JSON
 * e rotinas automáticas de limpeza ao atualizar e antes de encerrar o serviço.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE_PATH = path.join(DATA_DIR, 'dados_maquinas.json');

// Garante que o diretório de dados exista
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Estrutura padrão inicial do arquivo JSON
function getInitialDataTemplate() {
  return {
    lastUpdated: new Date().toISOString(),
    uniqueMachinesCount: 0,
    totalVisits: 0,
    machines: [],
    tests: []
  };
}

// Limpa/reinicializa o arquivo JSON em disco
function clearDataFile() {
  try {
    const template = getInitialDataTemplate();
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(template, null, 2), 'utf8');
    console.log(`🧹 [SERVER] Arquivo JSON de métricas limpo com sucesso: ${DATA_FILE_PATH}`);
    return template;
  } catch (err) {
    console.error('❌ [SERVER] Erro ao limpar arquivo JSON:', err);
    return null;
  }
}

// Lê os dados do arquivo JSON (inicializa caso não exista)
function readDataFile() {
  try {
    if (!fs.existsSync(DATA_FILE_PATH)) {
      return clearDataFile();
    }
    const raw = fs.readFileSync(DATA_FILE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.warn('⚠️ [SERVER] Arquivo corrompido ou ilegível, reinicializando...', err);
    return clearDataFile();
  }
}

// Salva dados no arquivo JSON
function saveDataFile(data) {
  try {
    data.lastUpdated = new Date().toISOString();
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('❌ [SERVER] Erro ao salvar dados no JSON:', err);
    return false;
  }
}

// Lê o corpo (body) de requisições POST em JSON
function parseRequestBody(req, callback) {
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });
  req.on('end', () => {
    try {
      callback(null, body ? JSON.parse(body) : {});
    } catch (err) {
      callback(err, null);
    }
  });
}

// Obtém o IP da rede local da máquina host
function getHostLanIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

const server = http.createServer((req, res) => {
  let reqPath = decodeURI(req.url.split('?')[0]);

  // Headers CORS padrão para todas as rotas de API
  const sendJsonResponse = (statusCode, payload) => {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=UTF-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'no-cache'
    });
    res.end(JSON.stringify(payload));
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // ========================================================
  // ROTAS DE API DO SISTEMA DE MÉTRICAS & DADOS DE MÁQUINAS
  // ========================================================

  // 1. Endpoint de captura de IP e Hostname da máquina
  if (reqPath === '/api/client-info') {
    let rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    if (rawIp.startsWith('::ffff:')) {
      rawIp = rawIp.replace('::ffff:', '');
    }

    const isLocal = rawIp === '::1' || rawIp === '127.0.0.1' || rawIp.startsWith('127.');
    const lanIp = getHostLanIp();
    const effectiveIp = isLocal ? (lanIp !== '127.0.0.1' ? `${lanIp} (Local)` : '127.0.0.1') : rawIp;
    const hostname = isLocal ? os.hostname() : `Host (${rawIp})`;

    sendJsonResponse(200, {
      ip: effectiveIp,
      rawIp: rawIp,
      hostname: hostname,
      osHostname: os.hostname(),
      platform: os.platform(),
      lanIp: lanIp
    });
    return;
  }

  // 2. Endpoint de leitura dos dados persistidos em JSON
  if (reqPath === '/api/data' && req.method === 'GET') {
    const data = readDataFile();
    sendJsonResponse(200, data);
    return;
  }

  // 3. Endpoint para registrar/atualizar uma máquina no arquivo JSON
  if (reqPath === '/api/record-machine' && req.method === 'POST') {
    parseRequestBody(req, (err, payload) => {
      if (err || !payload || !payload.id) {
        sendJsonResponse(400, { success: false, message: 'Dados de máquina inválidos' });
        return;
      }

      const current = readDataFile();
      const now = new Date().toISOString();
      if (!Array.isArray(current.machines)) current.machines = [];

      const existingIdx = current.machines.findIndex(m => m.id === payload.id);
      if (existingIdx >= 0) {
        current.machines[existingIdx].visitsCount = (current.machines[existingIdx].visitsCount || 1) + 1;
        current.machines[existingIdx].lastSeen = now;
        current.machines[existingIdx].viewport = payload.viewport || current.machines[existingIdx].viewport;
        current.machines[existingIdx].isOnline = payload.isOnline || current.machines[existingIdx].isOnline;
        if (payload.ip && payload.ip !== 'Detectando...') current.machines[existingIdx].ip = payload.ip;
        if (payload.hostname && payload.hostname !== 'Detectando...') current.machines[existingIdx].hostname = payload.hostname;
      } else {
        payload.firstSeen = payload.firstSeen || now;
        payload.lastSeen = now;
        payload.visitsCount = payload.visitsCount || 1;
        current.machines.push(payload);
      }

      current.uniqueMachinesCount = current.machines.length;
      current.totalVisits = (current.totalVisits || 0) + 1;

      saveDataFile(current);
      console.log(`📝 [SERVER] Máquina registrada/atualizada no JSON: ${payload.id} (Total: ${current.uniqueMachinesCount})`);
      sendJsonResponse(200, { success: true, data: current });
    });
    return;
  }

  // 4. Endpoint para registrar tentativa de teste no arquivo JSON
  if (reqPath === '/api/record-test' && req.method === 'POST') {
    parseRequestBody(req, (err, payload) => {
      if (err) {
        sendJsonResponse(400, { success: false, message: 'JSON inválido' });
        return;
      }

      const current = readDataFile();
      if (!Array.isArray(current.tests)) current.tests = [];

      const testRecord = {
        id: 'TENT-' + Date.now().toString(36).toUpperCase(),
        timeOnly: payload.timeOnly || new Date().toLocaleTimeString('pt-BR'),
        timestamp: new Date().toISOString(),
        maskedUser: payload.maskedUser || '••••••••',
        status: payload.status || 'Tentativa Registrada (Teste)',
        machineId: payload.machineId || 'N/A'
      };

      current.tests.unshift(testRecord);
      if (current.tests.length > 100) {
        current.tests.pop();
      }

      saveDataFile(current);
      console.log(`🔐 [SERVER] Tentativa de teste salva no JSON: ${testRecord.timeOnly} (${testRecord.maskedUser})`);
      sendJsonResponse(200, { success: true, test: testRecord, data: current });
    });
    return;
  }

  // 5. Endpoint para salvar/sincronizar dados completos no arquivo JSON
  if (reqPath === '/api/sync' && req.method === 'POST') {
    parseRequestBody(req, (err, payload) => {
      if (err) {
        sendJsonResponse(400, { success: false, message: 'JSON inválido' });
        return;
      }

      const current = readDataFile();
      if (Array.isArray(payload.machines)) {
        current.machines = payload.machines;
        current.uniqueMachinesCount = payload.machines.length;
      }
      if (Array.isArray(payload.tests)) {
        current.tests = payload.tests;
      }
      if (typeof payload.totalVisits === 'number') {
        current.totalVisits = payload.totalVisits;
      }

      const saved = saveDataFile(current);
      sendJsonResponse(200, { success: saved, data: current });
    });
    return;
  }

  // 6. Endpoint de limpeza do arquivo JSON (acionado pelo botão "Atualizar" ou manualmente)
  if ((reqPath === '/api/clear' || reqPath === '/api/clear-data') && (req.method === 'POST' || req.method === 'GET')) {
    const cleanData = clearDataFile();
    sendJsonResponse(200, {
      success: true,
      message: 'Arquivo JSON limpo com sucesso para novo ciclo de teste.',
      data: cleanData
    });
    return;
  }

  // ========================================================
  // SERVINDO ARQUIVOS ESTÁTICOS
  // ========================================================
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  const filePath = path.join(PUBLIC_DIR, reqPath);
  const ext = path.extname(filePath).toLowerCase();

  // Previne Directory Traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Proibido');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8' });
      res.end('404 Arquivo Não Encontrado');
      return;
    }

    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    });

    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
  });
});

// ========================================================
// ROTINAS DE LIMPEZA ANTES DE ENCERRAR O SERVIÇO (SHUTDOWN)
// ========================================================
let isShuttingDown = false;
function handleShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n🛑 [SERVER] Recebido sinal ${signal}. Encerrando serviço...`);
  console.log('🧹 [SERVER] Executando limpeza prévia do arquivo JSON de métricas para novo teste prático...');

  // Limpa o arquivo JSON em disco
  clearDataFile();

  server.close(() => {
    console.log('✅ [SERVER] Serviço encerrado com sucesso.');
    process.exit(0);
  });

  // Timeout de segurança para finalizar processo
  setTimeout(() => {
    process.exit(0);
  }, 1000);
}

process.on('SIGINT', () => handleShutdown('SIGINT (Ctrl+C)'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGBREAK', () => handleShutdown('SIGBREAK (Ctrl+Break)'));
process.on('SIGHUP', () => handleShutdown('SIGHUP'));

// Captura segura de SIGINT no Windows (PowerShell / CMD)
if (process.platform === 'win32') {
  try {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.on('SIGINT', () => {
      handleShutdown('SIGINT (Windows readline)');
    });
  } catch (e) {
    // ignora se stdin não for interativo
  }
}

// Hook de saída síncrono para garantir arquivo limpo antes de encerrar
process.on('exit', () => {
  clearDataFile();
});

server.listen(PORT, () => {
  console.log(`\n=================================================`);
  console.log(`🚀 Aplicação TOTVS Linha RM disponível em:`);
  console.log(`👉 http://localhost:${PORT}`);
  console.log(`👉 http://localhost:${PORT}/metricas.html (Página Oculta)`);
  console.log(`📁 Arquivo de dados JSON ativo em: ${DATA_FILE_PATH}`);
  console.log(`=================================================\n`);
});
