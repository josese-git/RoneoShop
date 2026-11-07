/**
 * MICRO-PROXY LOCAL TRANSPARENTE PARA PACKLINK PRO API v1
 * Permite ejecutar pruebas directas desde 127.0.0.1:5500 sin restricciones de CORS en el navegador.
 * Uso: node local-proxy.js
 */

const http = require('http');
const https = require('https');

const PORT = 3001;
const DEFAULT_KEY = 'f6343535d64a6f27e3dfa60297abc964a5d9f1d0f546d091c8485722ddbc25a5';

const server = http.createServer((req, res) => {
  // Cabeceras CORS abiertas para desarrollo local
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
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
  const authHeader = req.headers['authorization'] || DEFAULT_KEY;

  const options = {
    hostname: 'api.packlink.com',
    port: 443,
    path: targetPath,
    method: req.method,
    headers: {
      'Authorization': authHeader.trim(),
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
  console.log(`[Roneo Shop] Micro-Proxy Packlink PRO activo en http://127.0.0.1:${PORT}`);
});

