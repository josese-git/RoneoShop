/**
 * FIREBASE CONFIGURATION & SDK EXPORTS - RONEO SHOP (FASE 5.1 DEFINITIVA)
 * Conexion oficial a Firebase v10.13.0 (roneoshop-es)
 * Firestore Database (default) + Firebase Storage (gs://roneoshop-es.firebasestorage.app)
 * Autenticacion: 1roneoshop@gmail.com
 * Incluye onSnapshot para sincronizacion reactiva en tiempo real (< 100ms)
 * Zero Emojis.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { 
  initializeFirestore,
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  updateDoc, 
  deleteField,
  writeBatch,
  onSnapshot,
  query, 
  orderBy 
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { 
  getStorage, 
  ref, 
  uploadBytes,
  uploadString, 
  getDownloadURL,
  listAll,
  deleteObject
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";

export const USE_FIREBASE = true;

export const firebaseConfig = {
  apiKey: "AIzaSyAeoLNitp5NrSoJ6QjTVHwXD6x7z1X8-Gc",
  authDomain: "roneoshop-es.firebaseapp.com",
  databaseURL: "https://roneoshop-es-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "roneoshop-es",
  storageBucket: "roneoshop-es.firebasestorage.app",
  messagingSenderId: "1085535693980",
  appId: "1:1085535693980:web:331c06119dbb47d779d159",
  measurementId: "G-21F9QR8W4N"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true
});

export const storage = getStorage(app);

export function isFirebaseActive() {
  return Boolean(USE_FIREBASE && firebaseConfig.apiKey && firebaseConfig.projectId);
}

export function sanitizeForFirestore(data) {
  if (data === null || data === undefined) return null;
  return JSON.parse(JSON.stringify(data, (key, value) => {
    if (value === undefined) return null;
    if (typeof value === 'number' && isNaN(value)) return 0;
    return value;
  }));
}

export function buildCleanStorageUrl(filePath, version = '') {
  const bucket = firebaseConfig.storageBucket || "roneoshop-es.firebasestorage.app";
  const cleanPath = String(filePath || '').replace(/^\/+/, '');
  const encodedPath = cleanPath.split('/').map(segment => encodeURIComponent(segment)).join('%2F');
  const vParam = version ? `&v=${version}` : '';
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}?alt=media${vParam}`;
}

export {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  deleteField,
  writeBatch,
  onSnapshot,
  query,
  orderBy,
  ref,
  uploadBytes,
  uploadString,
  getDownloadURL,
  listAll,
  deleteObject
};
