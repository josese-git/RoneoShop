/**
 * CLOUD FUNCTIONS PROXY - RONEO SHOP
 * Proxy server-side para Packlink PRO.
 * La credencial se lee exclusivamente desde Firebase Secret Manager.
 */

const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const https = require("https");

initializeApp();

const PACKLINK_API_KEY = defineSecret("PACKLINK_API_KEY");
const ALLOWED_ORIGINS = new Set([
  "https://roneoshop-es.web.app",
  "https://roneoshop-es.firebaseapp.com",
  "http://localhost:5500",
  "http://127.0.0.1:5500"
]);

async function isAuthorizedAdmin(req) {
  const header = req.get("Authorization") || "";
  if (!header.startsWith("Bearer ")) return false;

  try {
    const token = await getAuth().verifyIdToken(header.slice(7));
    return token.email === "1roneoshop@gmail.com";
  } catch (error) {
    console.warn("[packlinkProxy] Token Firebase no válido:", error.message);
    return false;
  }
}

exports.packlinkProxy = onRequest(
  {
    cors: true,
    secrets: [PACKLINK_API_KEY]
  },
  async (req, res) => {
    const origin = req.get("Origin") || "";
    if (!ALLOWED_ORIGINS.has(origin)) {
      return res.status(403).json({
        ok: false,
        error: "Origen no autorizado"
      });
    }

    res.set("Access-Control-Allow-Origin", origin);
    res.set("Vary", "Origin");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");

    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }

    if (!["GET", "POST"].includes(req.method)) {
      return res.status(405).json({
        ok: false,
        error: "Método no permitido"
      });
    }

    const secret = PACKLINK_API_KEY.value();

    if (!secret || secret.trim().length < 20) {
      console.error("[packlinkProxy] PACKLINK_API_KEY no está configurada");
      return res.status(500).json({
        ok: false,
        error: "Packlink no está configurado en el servidor"
      });
    }

    let subPath = req.path || "";

    if (subPath.startsWith("/api/packlink")) {
      subPath = subPath.replace(/^\/api\/packlink/, "");
    }

    if (!subPath.startsWith("/")) {
      subPath = `/${subPath}`;
    }

    // Solo exponemos las rutas necesarias: tarifas/localidades para el checkout
    // y operaciones de envío únicamente para el administrador autenticado.
    const isPublicRead =
      req.method === "GET" &&
      (subPath.startsWith("/services") || subPath.startsWith("/locations/postalcodes"));
    const isAdminRoute =
      req.method === "POST" || subPath.startsWith("/shipments");

    if (!isPublicRead && !isAdminRoute) {
      return res.status(404).json({
        ok: false,
        error: "Ruta Packlink no disponible"
      });
    }

    if (isAdminRoute && !(await isAuthorizedAdmin(req))) {
      return res.status(401).json({
        ok: false,
        error: "Se requiere autenticación de administrador"
      });
    }

    const queryString =
      req.url && req.url.includes("?")
        ? req.url.slice(req.url.indexOf("?"))
        : "";

    const targetPath = `/v1${subPath}${queryString}`;

    const options = {
      hostname: "api.packlink.com",
      port: 443,
      path: targetPath,
      method: req.method,
      headers: {
        Authorization: secret.trim(),
        "Content-Type": "application/json",
        Accept: "application/json"
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

    proxyReq.on("error", (error) => {
      console.error("[packlinkProxy] Error:", error.message);

      if (!res.headersSent) {
        res.status(502).json({
          ok: false,
          error: "Error conectando con Packlink PRO"
        });
      }
    });

    if (req.method === "POST" && req.body !== undefined) {
      const body =
        typeof req.body === "string"
          ? req.body
          : JSON.stringify(req.body);

      proxyReq.write(body);
    }

    proxyReq.end();
  }
);
