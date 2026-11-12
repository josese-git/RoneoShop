/**
 * ACCOUNT SERVICE - RONEO SHOP
 * Modulo de gestion de cuentas de cliente, autenticacion con Firebase Auth,
 * persistencia de perfil y direcciones, pedidos propios y favoritos (users/{uid}/favorites).
 * Zero Emojis · 100% Vectores SVG · Coste 0,00€ Plan Blaze.
 */

import {
  auth,
  db,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signOut,
  onAuthStateChanged,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  where,
  sanitizeForFirestore
} from './firebase-config.js';

/**
 * Escucha cambios en el estado de autenticacion
 */
export function onAuthUserChange(callback) {
  if (!auth) return () => {};
  return onAuthStateChanged(auth, callback);
}

/**
 * Retorna el usuario autenticado actual o null
 */
export function getActiveUser() {
  return auth?.currentUser || null;
}

/**
 * Registro de nueva cuenta de cliente
 */
export async function registerCustomer(email, password, fullName = '') {
  if (!auth) throw new Error("Servicio de autenticación no disponible.");
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
  
  if (fullName && cred.user) {
    try {
      await updateProfile(cred.user, { displayName: fullName.trim() });
    } catch (e) {
      console.warn("[Account] Error actualizando nombre en perfil auth:", e);
    }
  }

  // Crear documento de perfil inicial
  const uid = cred.user.uid;
  const initialProfile = {
    email: cleanEmail,
    displayName: fullName.trim() || '',
    createdAt: Date.now(),
    phone: '',
    address: {
      street: '',
      apartment: '',
      city: '',
      province: '',
      zipCode: ''
    }
  };

  try {
    await setDoc(doc(db, 'users', uid), sanitizeForFirestore(initialProfile));
  } catch (e) {
    console.warn("[Account] Error creando perfil inicial en Firestore:", e);
  }

  return cred.user;
}

/**
 * Inicio de sesion
 */
export async function loginCustomer(email, password) {
  if (!auth) throw new Error("Servicio de autenticación no disponible.");
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
  return cred.user;
}

/**
 * Cierre de sesion
 */
export async function logoutCustomer() {
  if (!auth) return;
  await signOut(auth);
}

/**
 * Envio de correo para restablecimiento de contraseña
 */
export async function requestPasswordReset(email) {
  if (!auth) throw new Error("Servicio de autenticación no disponible.");
  const cleanEmail = String(email || '').trim().toLowerCase();
  await sendPasswordResetEmail(auth, cleanEmail);
}

/**
 * Obtiene el perfil del usuario desde Firestore
 */
export async function getCustomerProfile(uid) {
  if (!db || !uid) return null;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() };
    }
    return null;
  } catch (e) {
    console.error("[Account] Error obteniendo perfil:", e);
    return null;
  }
}

/**
 * Actualiza el perfil del usuario (nombre, telefono, direccion predeterminada)
 */
export async function updateCustomerProfile(uid, profileData = {}) {
  if (!db || !uid) throw new Error("No hay usuario autenticado.");
  const updates = {
    ...profileData,
    updatedAt: Date.now()
  };
  await setDoc(doc(db, 'users', uid), sanitizeForFirestore(updates), { merge: true });

  if (profileData.displayName && auth?.currentUser) {
    try {
      await updateProfile(auth.currentUser, { displayName: profileData.displayName.trim() });
    } catch (e) {}
  }
  return updates;
}

/**
 * Obtiene la lista de pedidos propios del cliente
 */
export async function getCustomerOrders(uid) {
  if (!db || !uid) return [];
  try {
    const q = query(collection(db, 'orders'), where('customerUid', '==', uid));
    const snap = await getDocs(q);
    const list = [];
    snap.forEach(d => {
      list.push({ orderNumber: d.id, ...d.data() });
    });
    // Ordenar en memoria por fecha descendente
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return list;
  } catch (e) {
    console.error("[Account] Error obteniendo pedidos del cliente:", e);
    return [];
  }
}

/**
 * Obtiene la lista de favoritos del cliente (users/{uid}/favorites)
 */
export async function getCustomerFavorites(uid) {
  if (!db || !uid) return [];
  try {
    const snap = await getDocs(collection(db, 'users', uid, 'favorites'));
    const list = [];
    snap.forEach(d => {
      list.push({ id: d.id, ...d.data() });
    });
    list.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    return list;
  } catch (e) {
    console.error("[Account] Error obteniendo favoritos:", e);
    return [];
  }
}

/**
 * Añade un producto a favoritos
 */
export async function addCustomerFavorite(uid, product) {
  if (!db || !uid || !product?.id) throw new Error("Datos de favorito no válidos.");
  const item = {
    id: product.id,
    title: product.title || '',
    price: product.price || 0,
    image: (Array.isArray(product.images) && product.images[0]) || product.image || '',
    slug: product.slug || product.id,
    addedAt: Date.now()
  };
  await setDoc(doc(db, 'users', uid, 'favorites', product.id), sanitizeForFirestore(item));
  return item;
}

/**
 * Elimina un producto de favoritos
 */
export async function removeCustomerFavorite(uid, productId) {
  if (!db || !uid || !productId) return;
  await deleteDoc(doc(db, 'users', uid, 'favorites', productId));
}

/**
 * Consulta de seguimiento de envio seguro para el cliente
 */
export async function getOrderTrackingInfo(reference) {
  if (!reference || reference === 'PENDIENTE-ENVIO' || reference === 'PENDIENTE-API') {
    return {
      available: false,
      message: "Tu paquete se está preparando en nuestro almacén. El seguimiento estará activo en cuanto el transportista recoja el paquete."
    };
  }

  if (!auth?.currentUser) {
    throw new Error("Se requiere iniciar sesión para consultar el estado del envío.");
  }

  const idToken = await auth.currentUser.getIdToken();
  const res = await fetch(`/api/packlink/track/${encodeURIComponent(reference)}`, {
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'Accept': 'application/json'
    }
  });

  if (!res.ok) {
    if (res.status === 404) {
      return {
        available: false,
        message: "Referencia de envío registrada. Los eventos de seguimiento se actualizarán en breve con el transportista oficial."
      };
    }
    throw new Error(`No se pudo consultar el seguimiento (HTTP ${res.status}).`);
  }

  const data = await res.json();
  return {
    available: true,
    ...data
  };
}
