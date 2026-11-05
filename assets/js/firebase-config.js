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
  writeBatch,
  query, 
  orderBy 
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { 
  getStorage, 
  ref, 
  uploadBytes,
  uploadString, 
  getDownloadURL,
  deleteObject,
  listAll
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

// CRÍTICO: ignoreUndefinedProperties evita que setDoc o writeBatch fallen si algún campo opcional es undefined
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true
});

export const storage = getStorage(app);

// Limpiador profundo para garantizar que ningún dato enviado a Firestore tenga undefined o NaN
export function sanitizeForFirestore(data) {
  if (data === null || data === undefined) return null;
  return JSON.parse(JSON.stringify(data, (key, value) => {
    if (value === undefined) return null;
    if (typeof value === 'number' && isNaN(value)) return 0;
    return value;
  }));
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
  writeBatch,
  query,
  orderBy,
  ref,
  uploadBytes,
  uploadString,
  getDownloadURL,
  deleteObject,
  listAll
};
