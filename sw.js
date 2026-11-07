/**
 * SERVICE WORKER BYPASS - RONEO SHOP (FASE 5.1 DEFINITIVA)
 * Garantiza que ninguna petición a Firebase Storage, Firestore o APIs de Google
 * sea interceptada ni corrompida con respuestas opacas sin CORS.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url || '';

  // NUNCA interceptar Firebase Storage, Firestore ni Google APIs
  if (
    url.includes('firebasestorage.googleapis.com') ||
    url.includes('firestore.googleapis.com') ||
    url.includes('googleapis.com') ||
    url.includes('gstatic.com') ||
    url.includes('wsrv.nl')
  ) {
    return; // Petición directa a la red sin interceptación
  }
});
