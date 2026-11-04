/**
 * FIREBASE CONFIGURATION - MODULAR SDK V10 (FASE 3.5)
 * Soporta conexión dinámica desde el panel de administración
 * o desde credenciales por defecto, compatible con Firebase Plan Spark (coste 0,00 €/mes).
 */

const STORAGE_KEY = 'store_firebase_config_v1';

// Credenciales por defecto (pueden ser sobreescritas en tiempo real desde /admin)
export const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

let app = null;
let db = null;
let auth = null;
let isInitialized = false;

/**
 * Obtiene la configuración guardada o por defecto
 */
export function getFirebaseConfig() {
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.apiKey && parsed.projectId) {
          return parsed;
        }
      }
    }
  } catch (e) {
    console.warn("[FirebaseConfig] Error leyendo configuración de localStorage:", e);
  }
  return DEFAULT_FIREBASE_CONFIG;
}

/**
 * Guarda nuevas credenciales de Firebase en localStorage
 * @param {Object} config
 */
export function saveFirebaseCredentials(config) {
  try {
    if (!config || !config.apiKey || !config.projectId) {
      throw new Error("La configuración debe contener al menos apiKey y projectId.");
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    return true;
  } catch (e) {
    console.error("[FirebaseConfig] Error guardando credenciales:", e);
    return false;
  }
}

/**
 * Elimina las credenciales y vuelve a modo local
 */
export function disconnectFirebase() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    app = null;
    db = null;
    auth = null;
    isInitialized = false;
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Comprueba si Firebase Firestore está activo y conectado
 */
export function isFirebaseActive() {
  return isInitialized && db !== null;
}

/**
 * Inicialización asíncrona de Firebase App y Firestore
 */
export async function initializeFirebase() {
  const config = getFirebaseConfig();

  if (!config.apiKey || !config.projectId || config.apiKey.includes("REPLACE_WITH")) {
    isInitialized = false;
    db = null;
    return false;
  }

  try {
    const { initializeApp, getApps } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js");
    const { getFirestore } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
    const { getAuth } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js");

    const existingApps = getApps();
    app = existingApps.length > 0 ? existingApps[0] : initializeApp(config);
    db = getFirestore(app);
    auth = getAuth(app);
    isInitialized = true;
    console.info("[Firebase] Conectado exitosamente a proyecto:", config.projectId);
    return true;
  } catch (error) {
    console.warn("[Firebase] No se pudo inicializar Firebase. Operando en modo local seguro:", error);
    isInitialized = false;
    db = null;
    return false;
  }
}

// Inicializar al cargar el módulo
await initializeFirebase();

export { app, db, auth };
