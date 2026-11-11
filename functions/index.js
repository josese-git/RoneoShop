/**
 * CLOUD FUNCTIONS PROXY SEGURO v2 - RONEO SHOP
 * Endpoint Serverless intermediario hacia la API oficial v1 de Packlink PRO (https://api.packlink.com/v1).
 * La clave de API se inyecta de forma 100% segura mediante Firebase Secret Manager (PACKLINK_API_KEY).
 * Cero exposición de secretos en frontend, logs o respuestas HTTP.
 */

const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const https = require("https");

// Inicialización de Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp();
}

// Vinculación exclusiva con Firebase Secret Manager
const packlinkApiKey = defineSecret("PACKLINK_API_KEY");

// Lista estricta de orígenes autorizados
const ALLOWED_ORIGINS = new Set([
  "https://roneoshop-es.web.app",
  "https://roneoshop-es.firebaseapp.com",
  "http://localhost:5500",
  "http://127.0.0.1:5500"
]);

// Administrador autorizado exclusivo de Roneo Shop
const AUTHORIZED_ADMIN_EMAIL = "1roneoshop@gmail.com";

/**
 * Valida si la petición incluye un Firebase ID Token válido del administrador autorizado.
 */
async function verifyAdminAuth(req) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return false;
  }

  const idToken = authHeader.slice(7).trim();
  if (!idToken) {
    return false;
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return Boolean(
      decodedToken &&
      decodedToken.email &&
      decodedToken.email.toLowerCase() === AUTHORIZED_ADMIN_EMAIL
    );
  } catch (err) {
    return false;
  }
}

exports.packlinkProxy = onRequest({ secrets: [packlinkApiKey] }, async (req, res) => {
  const origin = req.headers.origin;

  // 1. Control de CORS granular por origen
  if (origin) {
    if (ALLOWED_ORIGINS.has(origin)) {
      res.set("Access-Control-Allow-Origin", origin);
      res.set("Access-Control-Allow-Credentials", "true");
      res.set("Vary", "Origin");
    } else {
      return res.status(403).json({
        ok: false,
        error: "Acceso denegado: origen no autorizado."
      });
    }
  }

  // 2. Manejo de preflight OPTIONS
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");
    res.set("Access-Control-Max-Age", "86400");
    return res.status(204).send("");
  }

  // 3. Validación de método HTTP (únicamente GET y POST permitidos)
  if (req.method !== "GET" && req.method !== "POST") {
    res.set("Allow", "GET, POST, OPTIONS");
    return res.status(405).json({
      ok: false,
      error: `Método ${req.method} no permitido. Solo se admite GET, POST y OPTIONS.`
    });
  }

  // 4. Normalización y filtrado estricto de rutas permitidas
  let subPath = req.path || "/";
  if (subPath.startsWith("/api/packlink")) {
    subPath = subPath.replace(/^\/api\/packlink/, "");
  }
  if (!subPath.startsWith("/")) {
    subPath = "/" + subPath;
  }

  const isServicesRoute = (req.method === "GET" && (subPath === "/services" || subPath.startsWith("/services/")));
  const isLocationsRoute = (req.method === "GET" && (subPath === "/locations/postalcodes" || subPath.startsWith("/locations/postalcodes/")));
  const isShipmentsRoute = (subPath === "/shipments" || subPath.startsWith("/shipments/"));

  if (!isServicesRoute && !isLocationsRoute && !isShipmentsRoute) {
    return res.status(404).json({
      ok: false,
      error: `Ruta Packlink no permitida: ${subPath}`
    });
  }

  // 5. Exigir autenticación de administrador para POST, /shipments y consultas sensibles
  if (req.method === "POST" || isShipmentsRoute) {
    const isAdmin = await verifyAdminAuth(req);
    if (!isAdmin) {
      return res.status(401).json({
        ok: false,
        error: `Acceso no autorizado. Se requiere sesión de administrador activa (${AUTHORIZED_ADMIN_EMAIL}).`
      });
    }
  }

  // 6. Obtención segura de la clave desde Secret Manager
  let secretKey = "";
  try {
    secretKey = packlinkApiKey.value();
  } catch (err) {
    console.error("[packlinkProxy] Error al acceder a Secret Manager");
  }

  if (!secretKey || secretKey.trim().length === 0) {
    return res.status(500).json({
      ok: false,
      error: "Servicio de envíos temporalmente no configurado en el servidor."
    });
  }

  // 7. Preparación de la petición hacia Packlink PRO API v1
  const queryString = req.url && req.url.includes("?")
    ? req.url.slice(req.url.indexOf("?"))
    : "";
  const targetPath = `/v1${subPath}${queryString}`;

  const requestOptions = {
    hostname: "api.packlink.com",
    port: 443,
    path: targetPath,
    method: req.method,
    headers: {
      "Authorization": secretKey.trim(),
      "Content-Type": "application/json",
      "Accept": "application/json"
    }
  };

  const proxyReq = https.request(requestOptions, (proxyRes) => {
    res.status(proxyRes.statusCode);

    for (const [key, value] of Object.entries(proxyRes.headers)) {
      const lowerKey = key.toLowerCase();
      // Omitir cabeceras de transporte, cookies o cabeceras CORS de upstream
      if (
        lowerKey !== "transfer-encoding" &&
        lowerKey !== "set-cookie" &&
        !lowerKey.startsWith("access-control-")
      ) {
        res.set(key, value);
      }
    }

    proxyRes.pipe(res);
  });

  proxyReq.on("error", (err) => {
    console.error("[packlinkProxy Network Error]:", err.message);
    res.status(502).json({
      ok: false,
      error: "Error de comunicación con Packlink PRO API desde Cloud Functions",
      details: err.message
    });
  });

  if (req.method === "POST" && req.body) {
    const bodyStr = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    proxyReq.write(bodyStr);
  }

  proxyReq.end();
});
