/**
 * CLOUD FUNCTIONS PROXY - RONEO SHOP
 * Endpoint Serverless para intermediar peticiones hacia https://api.packlink.com/v1
 * Asegura cabeceras CORS abiertas y encriptación SSL de extremo a extremo.
 */

const { onRequest } = require("firebase-functions/v2/https");
const https = require("https");

const DEFAULT_KEY = "f6343535d64a6f27e3dfa60297abc964a5d9f1d0f546d091c8485722ddbc25a5";

exports.packlinkProxy = onRequest({ cors: true }, (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");

  if (req.method === "OPTIONS") {
    return res.status(204).send("");
  }

  let subPath = req.path || "";
  if (subPath.startsWith("/api/packlink")) {
    subPath = subPath.replace(/^\/api\/packlink/, "");
  }
  if (!subPath.startsWith("/")) {
    subPath = "/" + subPath;
  }

  const queryString = req.url && req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  const targetPath = `/v1${subPath}${queryString}`;

  const authHeader = req.headers.authorization || DEFAULT_KEY;

  const options = {
    hostname: "api.packlink.com",
    port: 443,
    path: targetPath,
    method: req.method,
    headers: {
      "Authorization": authHeader.trim(),
      "Content-Type": "application/json",
      "Accept": "application/json"
    }
  };

  const proxyReq = https.request(options, (proxyRes) => {
    res.status(proxyRes.statusCode);
    for (const [key, value] of Object.entries(proxyRes.headers)) {
      if (key.toLowerCase() !== "transfer-encoding") {
        res.set(key, value);
      }
    }
    proxyRes.pipe(res);
  });

  proxyReq.on("error", (err) => {
    console.error("[packlinkProxy Error]:", err);
    res.status(502).json({
      ok: false,
      error: "Error conectando con Packlink PRO API desde Cloud Functions",
      details: err.message
    });
  });

  if (req.method === "POST" && req.body) {
    const bodyStr = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    proxyReq.write(bodyStr);
  }

  proxyReq.end();
});

