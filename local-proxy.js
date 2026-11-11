/**
 * MICRO-PROXY LOCAL SEGURO PARA PACKLINK PRO API v1
 * Permite ejecutar pruebas en entorno local (127.0.0.1:5500 / localhost:5500).
 * La clave de API se lee EXCLUSIVAMENTE desde la variable de entorno process.env.PACKLINK_API_KEY.
 * Falla de forma inmediata y explícita si la variable no está definida.
 * Cero secretos hardcodeados.
 *
 * Uso: PACKLINK_API_KEY="tu_clave_secreta" node local-proxy.js
 */

const http = require('http');
const https = require('https');

const PORT = 3001;
const PACKLINK_API_KEY = process.env.PACKLINK_API_KEY;

if (!PACKLINK_API_KEY || PACKLINK_API_KEY.trim().length === 0) {
  console.error('[Roneo Shop Local Proxy Error]: La variable de entorno PACKLINK_API_KEY no está definida.');
  console.error('Para iniciar el proxy local de desarrollo ejecute:');
  console.error('  $env:PACKLINK_API_KEY="su_clave_packlink"; node local-proxy.js (PowerShell)');
  console.error('  PACKLINK_API_KEY="su_clave_packlink" node local-proxy.js (Bash/Zsh)');
  process.exit(1);
}

const ALLOWED_LOCAL_ORIGINS = new Set([
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
]);

const server = http.createServer((req, res) => {
  const origin = req.headers.origin;

  if (origin && ALLOWED_LOCAL_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: false,
      error: `Método ${req.method} no permitido en el proxy local.`
    }));
    return;
  }

  let subPath = req.url || '';
  if (subPath.startsWith('/api/packlink')) {
    subPath = subPath.replace(/^\/api\/packlink/, '');
  }
  if (!subPath.startsWith('/')) {
    subPath = '/' + subPath;
  }

  const targetPath = `/v1${subPath}`;

  const options = {
    hostname: 'api.packlink.com',
    port: 443,
    path: targetPath,
    method: req.method,
    headers: {
      'Authorization': PACKLINK_API_KEY.trim(),
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };

  const proxyReq = https.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: false,
      error: 'Error conectando con Packlink PRO desde el proxy local',
      details: err.message
    }));
  });

  req.pipe(proxyReq);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[Roneo Shop] Micro-Proxy Seguro Packlink PRO activo en http://127.0.0.1:${PORT}`);
  console.log(`[Roneo Shop] Clave cargada correctamente desde process.env.PACKLINK_API_KEY`);
});
