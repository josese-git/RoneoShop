/**
 * FIREBASE CONFIGURATION - MODULAR SDK V10
 * Compatible con Firebase Plan Spark (coste 0,00 €/mes).
 */

// Bandera para activar/desactivar conexión a Firebase.
// En Fase 1 (boceto funcional local) se mantiene en false para no arrojar errores por credenciales vacías.
export const USE_FIREBASE = false;

// Credenciales de Firebase Spark (sustituir por tus variables de producción)
export const firebaseConfig = {
  apiKey: "AIzaSy_REPLACE_WITH_YOUR_FIREBASE_API_KEY",
  authDomain: "roneoshop-prod.firebaseapp.com",
  projectId: "roneoshop-prod",
  storageBucket: "roneoshop-prod.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:000000000000000000"
};

let app = null;
let db = null;
let auth = null;
let storage = null;

if (USE_FIREBASE) {
  // Carga condicional dinámica cuando se activen las credenciales reales
  try {
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js");
    const { getFirestore } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
    const { getAuth } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js");
    const { getStorage } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js");

    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    storage = getStorage(app);
  } catch (error) {
    console.warn("[Firebase] No se pudo conectar con Firebase. Operando en modo local.", error);
  }
}

export { app, db, auth, storage };

