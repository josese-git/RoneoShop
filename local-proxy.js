/**
 * MICRO-PROXY LOCAL PARA PACKLINK PRO.
 * La clave solo puede venir del entorno local PACKLINK_API_KEY.
 */

const http = require("http");
const https = require("https");

const PORT = 3001;
const API_KEY = process.env.PACKLINK_API_KEY;

if (!API_KEY) {
  console.error("Falta PACKLINK_API_KEY en el entorno local.");
  process.exit(1);
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (!["GET", "POST"].includes(req.method)) {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "Método no permitido" }));
    return;
  }

  let subPath = req.url || "";
  if (subPath.startsWith("/api/packlink")) {
    subPath = subPath.replace(/^\/api\/packlink/, "");
  }
  if (!subPath.startsWith("/")) {
    subPath = `/${subPath}`;
  }

  const targetPath = `/v1${subPath}`;
  const options = {
    hostname: "api.packlink.com",
    port: 443,
    path: targetPath,
    method: req.method,
    headers: {
      Authorization: API_KEY.trim(),
      "Content-Type": "application/json",
      Accept: "application/json"
    }
  };

  const proxyReq = https.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on("error", (error) => {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      ok: false,
      error: "Error conectando con Packlink PRO desde el proxy local",
      details: error.message
    }));
  });

  req.pipe(proxyReq);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[Roneo Shop] Proxy local activo en http://127.0.0.1:${PORT}`);
});
