const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { URL } = require('node:url');

const DIST_DIR = path.resolve(__dirname, '..', 'dist');
const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number.parseInt(process.env.PORT || '4173', 10);
const PROJECT_DIR = path.resolve(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8'
};

function send(response, status, body, headers = {}) {
  response.writeHead(status, headers);
  response.end(body);
}

function hasDistBundle() {
  return fs.existsSync(path.join(DIST_DIR, 'index.html'));
}

function ensureDistBundle() {
  if (hasDistBundle()) return;

  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  console.log('dist introuvable, génération en cours via "npm run build"...');
  const result = spawnSync(npmCommand, ['run', 'build'], {
    cwd: PROJECT_DIR,
    stdio: 'inherit',
    shell: false
  });

  if (result.status !== 0 || !hasDistBundle()) {
    console.error('Impossible de générer dist. Exécuter "npm run build" manuellement.');
    process.exit(result.status || 1);
  }
}

function safeFilePath(requestPath) {
  const decoded = decodeURIComponent(requestPath);
  const normalized = path.normalize(decoded).replace(/^([.][.][/\\])+/, '');
  const filePath = path.join(DIST_DIR, normalized);
  if (!filePath.startsWith(DIST_DIR)) return null;
  return filePath;
}

function serveFile(filePath, response) {
  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      serveIndex(response);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    response.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable'
    });

    fs.createReadStream(filePath)
      .on('error', () => send(response, 500, 'Internal Server Error'))
      .pipe(response);
  });
}

function serveIndex(response) {
  const indexPath = path.join(DIST_DIR, 'index.html');
  fs.readFile(indexPath, (error, content) => {
    if (error) {
      send(response, 500, 'dist/index.html introuvable');
      return;
    }

    send(response, 200, content, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache'
    });
  });
}

const server = http.createServer((request, response) => {
  const method = request.method || 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    send(response, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' });
    return;
  }

  const parsedUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  if (pathname.startsWith('/api/')) {
    send(response, 503, 'API non disponible sur ce serveur statique');
    return;
  }

  const candidatePath = pathname === '/' ? path.join(DIST_DIR, 'index.html') : safeFilePath(pathname);
  if (!candidatePath) {
    send(response, 403, 'Forbidden');
    return;
  }

  serveFile(candidatePath, response);
});

ensureDistBundle();

server.listen(PORT, HOST, () => {
  console.log(`Static dist server listening on http://${HOST}:${PORT}`);
  console.log(`Admin:  http://127.0.0.1:${PORT}/`);
  console.log(`Player: http://127.0.0.1:${PORT}/player?instance=1`);
});
