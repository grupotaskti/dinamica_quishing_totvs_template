/**
 * server.js
 * Servidor local estático simples em Node.js (sem dependências externas)
 * para rodar a aplicação web em http://localhost:3000
 * e prover endpoint de identificação de IP e Hostname da máquina.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const dns = require('dns');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

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

  // ========================================================
  // ENDPOINT DE CAPTURA DE IP E HOSTNAME DA MÁQUINA
  // ========================================================
  if (reqPath === '/api/client-info') {
    let rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    if (rawIp.startsWith('::ffff:')) {
      rawIp = rawIp.replace('::ffff:', '');
    }

    const isLocal = rawIp === '::1' || rawIp === '127.0.0.1' || rawIp.startsWith('127.');
    const lanIp = getHostLanIp();
    const effectiveIp = isLocal ? (lanIp !== '127.0.0.1' ? `${lanIp} (Local)` : '127.0.0.1') : rawIp;
    const hostname = isLocal ? os.hostname() : `Host (${rawIp})`;

    res.writeHead(200, {
      'Content-Type': 'application/json; charset=UTF-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    });

    res.end(JSON.stringify({
      ip: effectiveIp,
      rawIp: rawIp,
      hostname: hostname,
      osHostname: os.hostname(),
      platform: os.platform(),
      lanIp: lanIp
    }));
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

server.listen(PORT, () => {
  console.log(`\n=================================================`);
  console.log(`🚀 Aplicação TOTVS Linha RM disponível em:`);
  console.log(`👉 http://localhost:${PORT}`);
  console.log(`👉 http://localhost:${PORT}/metricas.html (Página Oculta)`);
  console.log(`=================================================\n`);
});
