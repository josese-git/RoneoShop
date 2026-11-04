/**
 * STORE SERVICE - CAPA DE DATOS CONTRATO FIRESTORE (FASE 2 - 13 SECCIONES REALES)
 * Catálogo completo multirrubro (Ropa, Cabello, Cosmética) de yoanazafiro.com con clave de caché v3.
 */

import { USE_FIREBASE, db } from './firebase-config.js';

// Claves de almacenamiento y tiempo de vida (10 minutos)
// v3 renueva la caché para incluir los nuevos productos de Cabello y Cosmética
const PRODUCTS_CACHE_KEY = 'store_products_cache_v3';
const SETTINGS_CACHE_KEY = 'store_settings_cache_v3';
const CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * Configuración global de la tienda (Esquema ARCHITECTURE.md 2.C)
 */
export const MOCK_SETTINGS = {
  storeName: "Yoana Zafiro",
  announcementText: "NUEVA COLECCIÓN 2026 OTOÑO & INVIERNO",
  heroBannerDesktop: "https://yoanazafiro.com/cdn/shop/files/portada.jpg?v=1737318983&width=1200",
  heroBannerMobile: "https://yoanazafiro.com/cdn/shop/files/portada.jpg?v=1737318983&width=800",
  heroTitle: "Yoana Zafiro",
  shippingStandardPrice: 4.90,
  freeShippingThreshold: 60.00,
  categories: ["ropa", "cabello", "cosmetica", "novedades", "vestidos", "abrigos", "vaqueros", "rebajas"]
};

/**
 * Catálogo multirrubro de 10 productos extraídos de yoanazafiro.com
 */
export const MOCK_PRODUCTS = [
  // --- CATEGORÍA: ROPA / VAQUEROS ---
  {
    id: "vaquero-faja-levis",
    title: "VAQUERO FAJA LEVIS",
    slug: "vaquero-faja-levis",
    description: "Vaquero pitillo efecto faja moldeadora con tiro extra alto y tejido elástico confort que estiliza la figura.",
    category: "ropa",
    subcategory: "vaqueros",
    price: 24.95,
    compareAtPrice: null,
    weightKg: 0.50,
    active: true,
    featured: true,
    images: [
      "https://cdn.shopify.com/s/files/1/0893/4391/8412/files/WhatsAppImage2026-10-20at18.44.17.jpg?v=1792619717"
    ],
    variants: [
      { size: "XS", stock: 2, sku: "VF-LEV-XS" },
      { size: "S", stock: 4, sku: "VF-LEV-S" },
      { size: "M", stock: 6, sku: "VF-LEV-M" },
      { size: "L", stock: 3, sku: "VF-LEV-L" },
      { size: "XL", stock: 1, sku: "VF-LEV-XL" }
    ],
    createdAt: 1730715000000
  },
  // --- CATEGORÍA: ROPA / ABRIGOS (TOTALMENTE AGOTADO) ---
  {
    id: "abrigo-pandora",
    title: "ABRIGO PANDORA",
    slug: "abrigo-pandora",
    description: "Abrigo midi de paño estructurado en tono neutro con solapa clásica y botonadura frontal.",
    category: "ropa",
    subcategory: "abrigos",
    price: 19.95,
    compareAtPrice: null,
    weightKg: 0.95,
    active: true,
    featured: true,
    images: [
      "https://cdn.shopify.com/s/files/1/0893/4391/8412/files/WhatsAppImage2026-10-26at11.52.51.jpg?v=1793029856"
    ],
    variants: [
      { size: "S", stock: 0, sku: "AB-PAN-S" },
      { size: "M", stock: 0, sku: "AB-PAN-M" },
      { size: "L", stock: 0, sku: "AB-PAN-L" }
    ],
    createdAt: 1730715100000
  },
  // --- CATEGORÍA: ROPA / CONJUNTOS (EN REBAJA) ---
  {
    id: "conjunto-punto-milan",
    title: "CONJUNTO PUNTO MILÁN",
    slug: "conjunto-punto-milan",
    description: "Conjunto de dos piezas confeccionado en punto acanalado fino de tacto ultrasuave.",
    category: "ropa",
    subcategory: "novedades",
    price: 32.95,
    compareAtPrice: 39.95,
    weightKg: 0.60,
    active: true,
    featured: true,
    images: [
      "https://cdn.shopify.com/s/files/1/0893/4391/8412/files/WhatsAppImage2026-10-30at09.40.20.jpg?v=1793354711"
    ],
    variants: [
      { size: "S", stock: 2, sku: "CP-MIL-S" },
      { size: "M", stock: 4, sku: "CP-MIL-M" },
      { size: "L", stock: 1, sku: "CP-MIL-L" }
    ],
    createdAt: 1730715200000
  },
  // --- CATEGORÍA: ROPA / VESTIDOS ---
  {
    id: "vestido-midi-zafiro",
    title: "VESTIDO MIDI ZAFIRO",
    slug: "vestido-midi-zafiro",
    description: "Vestido midi de tirantes confeccionado en satén fluido con caída diagonal y espalda abierta.",
    category: "ropa",
    subcategory: "vestidos",
    price: 29.95,
    compareAtPrice: null,
    weightKg: 0.32,
    active: true,
    featured: true,
    images: [
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=700&q=80"
    ],
    variants: [
      { size: "S", stock: 3, sku: "VM-ZAF-S" },
      { size: "M", stock: 2, sku: "VM-ZAF-M" },
      { size: "L", stock: 4, sku: "VM-ZAF-L" }
    ],
    createdAt: 1730715300000
  },
  // --- CATEGORÍA: ROPA / NOVEDADES ---
  {
    id: "body-escote-espalda",
    title: "BODY ESCOTE ESPALDA",
    slug: "body-escote-espalda",
    description: "Body reductor sin costuras con escote profundo en la espalda y cierre inferior ajustable.",
    category: "ropa",
    subcategory: "novedades",
    price: 18.95,
    compareAtPrice: 24.95,
    weightKg: 0.18,
    active: true,
    featured: true,
    images: [
      "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=700&q=80"
    ],
    variants: [
      { size: "S", stock: 1, sku: "BO-ESP-S" },
      { size: "M", stock: 3, sku: "BO-ESP-M" }
    ],
    createdAt: 1730715400000
  },
  // --- CATEGORÍA: ROPA / PANTALONES ---
  {
    id: "pantalon-palazzo-beige",
    title: "PANTALÓN PALAZZO BEIGE",
    slug: "pantalon-palazzo-beige",
    description: "Pantalón de pernera ancha con pinzas marcadas y tiro alto sastre.",
    category: "ropa",
    subcategory: "vaqueros",
    price: 26.95,
    compareAtPrice: null,
    weightKg: 0.44,
    active: true,
    featured: true,
    images: [
      "https://images.unsplash.com/photo-1551803091-e20673f15770?auto=format&fit=crop&w=700&q=80"
    ],
    variants: [
      { size: "S", stock: 2, sku: "PP-BEI-S" },
      { size: "M", stock: 5, sku: "PP-BEI-M" },
      { size: "L", stock: 3, sku: "PP-BEI-L" },
      { size: "XL", stock: 2, sku: "PP-BEI-XL" }
    ],
    createdAt: 1730715500000
  },
  // --- CATEGORÍA: CABELLO / TRATAMIENTO CAPILAR (SECCIÓN 9 Y 10) ---
  {
    id: "champu-nutritivo-1000ml",
    title: "CHAMPÚ NUTRITIVO 1000ML",
    slug: "champu-nutritivo-1000ml",
    description: "Fórmula enriquecida con aminoácidos y proteínas de seda para recuperar cabellos deshidratados y castigados.",
    category: "cabello",
    subcategory: "cabello",
    price: 18.00,
    compareAtPrice: null,
    weightKg: 1.05,
    active: true,
    featured: true,
    images: [
      "https://yoanazafiro.com/cdn/shop/files/ee3a1c45-86e1-4770-99e2-187ed2170cb1.jpg?v=1737629409&width=800"
    ],
    // Agotado para reproducir la captura de la Sección 9
    variants: [
      { size: "1000ml", stock: 0, sku: "CH-NUT-1L" }
    ],
    createdAt: 1730715600000
  },
  {
    id: "secador-profesional-ionic",
    title: "SECADOR PROFESIONAL IONIC",
    slug: "secador-profesional-ionic",
    description: "Motor digital de alta potencia con tecnología de iones negativos para sellar cutícula y dar brillo extremo.",
    category: "cabello",
    subcategory: "cabello",
    price: 54.95,
    compareAtPrice: null,
    weightKg: 0.78,
    active: true,
    featured: true,
    images: [
      "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80"
    ],
    variants: [
      { size: "Única", stock: 5, sku: "SEC-PRO-ION" }
    ],
    createdAt: 1730715700000
  },
  // --- CATEGORÍA: COSMÉTICA COREANA (SECCIÓN 8) ---
  {
    id: "pack-cosmetica-coreana-glow",
    title: "PACK COSMÉTICA COREANA GLOW",
    slug: "pack-cosmetica-coreana-glow",
    description: "Rutina completa de 4 pasos con centella asiática, mucina de caracol y niacinamida para un efecto cristal 'Glass Skin'.",
    category: "cosmetica",
    subcategory: "cosmetica",
    price: 39.95,
    compareAtPrice: 48.00,
    weightKg: 0.65,
    active: true,
    featured: true,
    images: [
      "https://yoanazafiro.com/cdn/shop/files/IMG_0336_15f50c3f-3300-46f6-aed0-a59d5b53c1ae.png?v=1742232271&width=800"
    ],
    variants: [
      { size: "Set 4 piezas", stock: 3, sku: "PACK-K-GLOW" }
    ],
    createdAt: 1730715800000
  },
  {
    id: "serum-acido-hialuronico",
    title: "SÉRUM ÁCIDO HIALURÓNICO",
    slug: "serum-acido-hialuronico",
    description: "Concentrado multihialurónico de bajo y alto peso molecular con pantenol para una hidratación profunda 72 horas.",
    category: "cosmetica",
    subcategory: "cosmetica",
    price: 22.50,
    compareAtPrice: null,
    weightKg: 0.15,
    active: true,
    featured: true,
    images: [
      "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80"
    ],
    variants: [
      { size: "50ml", stock: 4, sku: "SER-HIA-50" }
    ],
    createdAt: 1730715900000
  }
];

/**
 * Obtiene la configuración de la tienda con caché en sessionStorage
 */
export async function getStoreSettings() {
  try {
    const rawCache = sessionStorage.getItem(SETTINGS_CACHE_KEY);
    if (rawCache) {
      const parsed = JSON.parse(rawCache);
      if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
        return parsed.data;
      }
    }
  } catch (e) {
    console.warn("[StoreService] Error leyendo caché de settings", e);
  }

  let settings = MOCK_SETTINGS;

  if (USE_FIREBASE && db) {
    try {
      const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
      const docRef = doc(db, "settings", "store_config");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        settings = docSnap.data();
      }
    } catch (err) {
      console.warn("[StoreService] Fallo lectura Firestore settings, usando fallback", err);
    }
  }

  try {
    sessionStorage.setItem(
      SETTINGS_CACHE_KEY,
      JSON.stringify({ timestamp: Date.now(), data: settings })
    );
  } catch (e) {}

  return settings;
}

/**
 * Obtiene los productos del catálogo con caché en sessionStorage (clave v3)
 */
export async function getProducts() {
  try {
    const rawCache = sessionStorage.getItem(PRODUCTS_CACHE_KEY);
    if (rawCache) {
      const parsed = JSON.parse(rawCache);
      if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
        return parsed.data;
      }
    }
  } catch (e) {
    console.warn("[StoreService] Error leyendo caché de productos", e);
  }

  let products = MOCK_PRODUCTS;

  if (USE_FIREBASE && db) {
    try {
      const { collection, getDocs, query, where } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
      const q = query(collection(db, "products"), where("active", "==", true));
      const querySnapshot = await getDocs(q);
      const list = [];
      querySnapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      if (list.length > 0) {
        products = list;
      }
    } catch (err) {
      console.warn("[StoreService] Fallo lectura Firestore productos, usando fallback", err);
    }
  }

  try {
    sessionStorage.setItem(
      PRODUCTS_CACHE_KEY,
      JSON.stringify({ timestamp: Date.now(), data: products })
    );
  } catch (e) {}

  return products;
}
